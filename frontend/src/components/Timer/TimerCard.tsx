import { useState, useEffect, useRef } from 'react';
import { Timer, AlarmSound } from '../../types';
import { formatTime } from '../../utils/time';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { createCheckout, startCheckout, pauseCheckout, stopCheckout, updateTimerAlarmSound, createAuditLog } from '../../services/api';
import { stopContinuousAlarm, ALARM_SOUND_LABELS, normalizeAlarmSound, playAlarmPreview } from '../../utils/notifications';
import { useTimerAvailability } from '../../hooks/useTimerExpiration';
import { useGlobalAlarm } from '../../hooks/useGlobalAlarm';

interface TimerCardProps {
  timer: Timer;
}

export function TimerCard({ timer }: TimerCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showAlarmSelector, setShowAlarmSelector] = useState(false);
  const operationInProgress = useRef(false); // Prevent double-clicks
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allocation = timer.todayAllocation;
  const hasNotifiedRef = useRef(false);
  const hasExpiredAlarmRef = useRef(false);
  const availability = useTimerAvailability(timer.id, {
    pollIntervalMs: (timer.defaultExpirationTime || timer.defaultStartTime) ? 10000 : 60000,
  });
  const isAvailable = availability.available;
  const { alarmState, triggerAlarm, acknowledgeAlarm } = useGlobalAlarm();

  // Quick checkout options (only show if enough time remaining)
  const remainingSeconds = allocation
    ? allocation.totalSeconds - allocation.usedSeconds
    : timer.defaultDailySeconds;

  const quickOptions = [
    { label: '10m', minutes: 10 },
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '45m', minutes: 45 },
    { label: '1hr', minutes: 60 },
  ].filter(option => option.minutes * 60 <= remainingSeconds);

  const createCheckoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });
  
  const activeCheckout = allocation?.checkouts?.find(
    (c) => c.status === 'ACTIVE' || c.status === 'PAUSED'
  );
  const hasActiveCheckout = !!activeCheckout;
  const isRunning = activeCheckout?.status === 'ACTIVE';
  const hasActiveEntry = activeCheckout?.entries?.some((e) => !e.endTime);

  // Calculate real-time elapsed seconds for active timers
  const [liveUsedSeconds, setLiveUsedSeconds] = useState(allocation?.usedSeconds || 0);

  useEffect(() => {
    if (isRunning && hasActiveEntry && activeCheckout) {
      const activeEntry = activeCheckout.entries?.find((e) => !e.endTime);
      if (!activeEntry) return;

      const interval = setInterval(() => {
        // Calculate elapsed time from the entry's start time
        const now = new Date();
        const startTime = new Date(activeEntry.startTime);
        const entryElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const totalElapsed = activeCheckout.usedSeconds + entryElapsed;
        setLiveUsedSeconds(totalElapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // When not running, use the actual allocation used seconds
      setLiveUsedSeconds(allocation?.usedSeconds || 0);
    }
  }, [isRunning, hasActiveEntry, activeCheckout, allocation?.usedSeconds]);

  // Daily remaining should show time available for new sessions (ignoring current active checkout)
  const dailyRemainingSeconds = allocation
    ? allocation.totalSeconds - allocation.usedSeconds
    : timer.defaultDailySeconds;

  // Daily progress should always be based on the total daily allocation used (not current session)
  const progressPercent = allocation
    ? (allocation.usedSeconds / allocation.totalSeconds) * 100
    : 0;

  // Calculate checkout-specific elapsed and remaining
  const [liveCheckoutUsed, setLiveCheckoutUsed] = useState(activeCheckout?.usedSeconds || 0);
  
  useEffect(() => {
    // Reset notification flag when checkout changes
    if (activeCheckout?.id) {
      hasNotifiedRef.current = false;
    }
  }, [activeCheckout?.id]);
  
  // Cleanup alarm on unmount
  useEffect(() => {
    return () => {
      stopContinuousAlarm();
    };
  }, []);

  // Trigger alarm when timer reaches end-of-day expiration
  useEffect(() => {
    if (availability.reason === 'after_expiration' && !hasExpiredAlarmRef.current) {
      hasExpiredAlarmRef.current = true;
      triggerAlarm(timer.id, timer.name, timer.person?.name, 'expired', normalizeAlarmSound(timer.alarmSound));
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    }
  }, [availability.reason, timer.id, timer.name, timer.person?.name, timer.alarmSound, triggerAlarm, queryClient]);

  useEffect(() => {
    if (isRunning && hasActiveEntry && activeCheckout) {
      const activeEntry = activeCheckout.entries?.find((e) => !e.endTime);
      if (!activeEntry) return;

      const interval = setInterval(() => {
        const now = new Date();
        const startTime = new Date(activeEntry.startTime);
        const entryElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const totalCheckoutElapsed = activeCheckout.usedSeconds + entryElapsed;
        
        // Check if checkout time is complete
        if (totalCheckoutElapsed >= activeCheckout.allocatedSeconds) {
          setLiveCheckoutUsed(activeCheckout.allocatedSeconds);
          
          // Trigger alarm (plays sound and shows acknowledge UI in TimerCard - only once)
          if (!hasNotifiedRef.current) {
            hasNotifiedRef.current = true;
            triggerAlarm(timer.id, timer.name, timer.person?.name, 'completed', timer.alarmSound);
          }
        } else {
          setLiveCheckoutUsed(totalCheckoutElapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setLiveCheckoutUsed(activeCheckout?.usedSeconds || 0);
    }
  }, [isRunning, hasActiveEntry, activeCheckout, timer.name, timer.person?.name]);

  // Handle click outside and focus loss for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Small delay to ensure button click handlers run first
      setTimeout(() => {
        const target = event.target as Element;
        // Don't close if clicking on dropdown content or the dropdown button
        if (dropdownRef.current && !dropdownRef.current.contains(target)) {
          // Check if we're not clicking on the dropdown trigger button
          const dropdownButton = dropdownRef.current.parentElement?.querySelector('button[aria-haspopup]');
          if (!dropdownButton?.contains(target)) {
            setShowAlarmSelector(false);
          }
        }
      }, 1);
    };

    const handleFocusOut = (event: FocusEvent) => {
      // Delay to allow click events to process first
      setTimeout(() => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.relatedTarget as Node)) {
          setShowAlarmSelector(false);
        }
      }, 100);
    };

    if (showAlarmSelector) {
      document.addEventListener('click', handleClickOutside);
      dropdownRef.current?.addEventListener('focusout', handleFocusOut);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      dropdownRef.current?.removeEventListener('focusout', handleFocusOut);
    };
  }, [showAlarmSelector]);

  const checkoutRemainingSeconds = activeCheckout
    ? activeCheckout.allocatedSeconds - liveCheckoutUsed
    : 0;

  // Generate schedule summary
  const getScheduleSummary = () => {
    if (!timer.schedules || timer.schedules.length === 0) {
      return null;
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Group schedules by seconds
    const groupedByTime = timer.schedules.reduce((acc, schedule) => {
      const key = schedule.seconds.toString();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(schedule.dayOfWeek);
      return acc;
    }, {} as Record<string, number[]>);

    // Create summary strings
    const parts = Object.entries(groupedByTime).map(([seconds, days]) => {
      const sortedDays = days.sort((a, b) => a - b);
      const dayStr = sortedDays.map(d => dayNames[d]).join('/');
      return `${dayStr}: ${formatTime(parseInt(seconds))}`;
    });

    return parts.join(', ');
  };

  const scheduleSummary = getScheduleSummary();

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-clicks using ref (checked before state update)
    if (operationInProgress.current || loading) return;
    operationInProgress.current = true;
    setLoading(true);
    
    try {
      if (!activeCheckout) {
        // Create checkout for ALL remaining time (like TimerDetail)
        const result = await createCheckout({
          timerId: timer.id,
          allocatedSeconds: remainingSeconds,
        });
        await startCheckout(result.id);
      } else {
        await startCheckout(activeCheckout.id);
      }
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    } catch (error) {
      console.error('Failed to start timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double-clicks using ref
    if (operationInProgress.current || loading || !activeCheckout) return;
    operationInProgress.current = true;
    setLoading(true);

    try {
      await pauseCheckout(activeCheckout.id);
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    } catch (error) {
      console.error('Failed to pause timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent double-clicks using ref
    if (operationInProgress.current || loading || !activeCheckout) return;
    operationInProgress.current = true;
    setLoading(true);

    try {
      await stopCheckout(activeCheckout.id);
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    } catch (error) {
      console.error('Failed to stop timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handleAcknowledgeAlarm = async () => {
    acknowledgeAlarm();

    // Stop the current session immediately
    if (activeCheckout) {
      try {
        await stopCheckout(activeCheckout.id);
        queryClient.invalidateQueries({ queryKey: ['timers'] });
      } catch (error) {
        console.error('Failed to stop timer:', error);
      }
    }

    // Log the alarm acknowledgment
    try {
      await createAuditLog(timer.id, {
        action: 'alarm_acknowledged',
        details: 'User acknowledged alarm',
      });
    } catch (error) {
      console.error('Failed to log alarm acknowledgment:', error);
    }
  };
  
  const handleAlarmSoundPreview = async (sound: AlarmSound) => {
    // Play the alarm preview (automatically handles stopping previous previews)
    await playAlarmPreview(sound);

    // Log the alarm preview action
    try {
      await createAuditLog(timer.id, {
        action: 'alarm_preview',
        details: `User previewed alarm sound (${sound})`,
      });
    } catch (error) {
      console.error('Failed to log alarm preview:', error);
    }
  };
  
  const handleAlarmSoundChange = async (newSound: AlarmSound) => {
    try {
      await updateTimerAlarmSound(timer.id, newSound);
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      setShowAlarmSelector(false);

      // Play preview of the saved sound
      handleAlarmSoundPreview(normalizeAlarmSound(newSound));
    } catch (error) {
      console.error('Failed to update alarm sound:', error);
    }
  };

  const handleQuickCheckout = async (minutes: number) => {
    if (operationInProgress.current || createCheckoutMutation.isPending) return;
    operationInProgress.current = true;

    try {
      // Create checkout and immediately start it
      const checkoutResult = await createCheckoutMutation.mutateAsync({
        timerId: timer.id,
        allocatedSeconds: minutes * 60,
      });

      // Immediately start the checkout
      await startCheckout(checkoutResult.id);

      queryClient.invalidateQueries({ queryKey: ['timers'] });
    } catch (error) {
      console.error('Failed to create/start quick checkout:', error);
    } finally {
      operationInProgress.current = false;
    }
  };

  const isThisTimerAlarming = alarmState?.isActive && alarmState?.timerId === timer.id;

  return (
    <>
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 ${isThisTimerAlarming ? 'ring-2 ring-red-500 ring-opacity-100' : ''}`}>
        {isThisTimerAlarming && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <h3 className="font-bold text-red-700 dark:text-red-400">
                    {alarmState?.reason === 'completed' ? "Time's Up!" : 'Timer Expired'}
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {alarmState?.reason === 'completed'
                      ? `Checkout time has ended for ${alarmState?.personName || 'timer'}.`
                      : 'This timer has expired for today and has been stopped.'}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAcknowledgeAlarm();
                }}
                className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors shrink-0"
              >
                Acknowledge
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{timer.name}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{timer.person?.name}</p>
            {scheduleSummary && (
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                Schedule: {scheduleSummary}
              </p>
            )}
            {(timer.defaultStartTime || timer.defaultExpirationTime) && (
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Available: {timer.defaultStartTime || '00:00'} – {timer.defaultExpirationTime || '23:59'}
              </p>
            )}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAlarmSelector(!showAlarmSelector);
                }}
                className="text-xs text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 mt-1 flex items-center gap-1"
                aria-expanded={showAlarmSelector}
                aria-haspopup="listbox"
              >
                🔔 {ALARM_SOUND_LABELS[normalizeAlarmSound(timer.alarmSound)]}
              </button>
              {showAlarmSelector && (
                <div
                  ref={dropdownRef}
                  className="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 space-y-1 min-w-[200px] max-h-[280px] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                  role="listbox"
                  tabIndex={-1}
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-2">
                    Click to preview • Double-click to save:
                  </div>
                  {(Object.keys(ALARM_SOUND_LABELS) as AlarmSound[]).map((sound) => (
                    <div key={sound} className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.nativeEvent?.stopImmediatePropagation?.();
                          handleAlarmSoundPreview(sound);
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.nativeEvent?.stopImmediatePropagation?.();
                          handleAlarmSoundChange(sound);
                        }}
                        className={`flex-1 text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm ${
                          normalizeAlarmSound(timer.alarmSound) === sound ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' : ''
                        }`}
                        title="Click to preview • Double-click to save"
                      >
                        {ALARM_SOUND_LABELS[sound]}
                        {normalizeAlarmSound(timer.alarmSound) === sound && (
                          <span className="ml-2 text-blue-600">✓</span>
                        )}
                      </button>
                    </div>
                  ))}
                  <div className="text-xs text-gray-400 mt-2 pt-2 border-t">
                    💡 Click to preview • Double-click to save
                  </div>
                </div>
              )}
            </div>
            {showAlarmSelector && (
              <div 
                className="absolute z-10 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 space-y-1 min-w-[200px] max-h-[280px] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-xs text-gray-500 font-semibold mb-2">
                  Click to preview • Double-click to save:
                </div>
                {(Object.keys(ALARM_SOUND_LABELS) as AlarmSound[]).map((sound) => (
                  <div key={sound} className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAlarmSoundPreview(sound);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAlarmSoundChange(sound);
                      }}
                      className={`flex-1 text-left px-3 py-2 rounded hover:bg-gray-100 text-sm ${
                        normalizeAlarmSound(timer.alarmSound) === sound ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                      }`}
                      title="Click to preview • Double-click to save"
                    >
                      {ALARM_SOUND_LABELS[sound]}
                      {normalizeAlarmSound(timer.alarmSound) === sound && (
                        <span className="ml-2 text-blue-600">✓</span>
                      )}
                    </button>
                  </div>
                ))}
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t">
                  💡 Click to preview • Double-click to save
                </div>
              </div>
            )}
          </div>
          {!isAvailable ? (
            availability.reason === 'before_start' ? (
              <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full text-sm font-medium">
                Not Yet Available
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded-full text-sm font-medium">
                Expired Today
              </span>
            )
          ) : hasActiveCheckout ? (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
              Active
            </span>
          ) : null}
        </div>

        {/* Detailed availability message */}
        {!isAvailable && (
          <div className="text-xs text-center mb-2 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            {availability.reason === 'before_start'
              ? 'Timer will become available at its start time today'
              : 'Timer has reached its expiration time for today and will reset tomorrow'}
            {(timer.defaultStartTime || timer.defaultExpirationTime) && (
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Window: {timer.defaultStartTime || '00:00'} - {timer.defaultExpirationTime || '23:59'}
              </div>
            )}
          </div>
        )}

        <div className="mb-3 space-y-2">
          {/* Daily progress bar */}
          <div>
            {hasActiveCheckout && <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Daily Progress</div>}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {/* Checkout progress bar (only when active) */}
          {hasActiveCheckout && activeCheckout && (
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Checkout Progress</div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ 
                    width: `${(liveCheckoutUsed / activeCheckout.allocatedSeconds) * 100}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Time Display */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
          {!hasActiveCheckout ? (
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                {formatTime(dailyRemainingSeconds)}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-200">remaining today</div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {formatTime(liveUsedSeconds)} used
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Daily allocation */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Daily Remaining:</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatTime(dailyRemainingSeconds)}</span>
              </div>
              {/* Active checkout */}
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Current Session:</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatTime(checkoutRemainingSeconds)}</span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 text-center">
                {formatTime(liveUsedSeconds)} used today
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isAvailable && dailyRemainingSeconds > 0 && (
          <div className="space-y-3">
            {/* Action buttons row */}
            <div className="flex gap-2 items-center">
              {/* Main action buttons */}
              <div className="flex gap-2 flex-1">
                {!hasActiveCheckout && (
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium text-base"
                  >
                    {loading ? 'Starting...' : 'Start'}
                  </button>
                )}

                {hasActiveCheckout && !hasActiveEntry && (
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium text-base"
                  >
                    {loading ? 'Starting...' : 'Resume'}
                  </button>
                )}

                {hasActiveCheckout && hasActiveEntry && (
                  <div className="flex gap-2 flex-1">
                    {isRunning && (
                      <button
                        onClick={handlePause}
                        disabled={loading}
                        className="flex-1 px-3 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium text-sm"
                      >
                        {loading ? 'Pausing...' : 'Pause'}
                      </button>
                    )}
                    <button
                      onClick={handleStop}
                      disabled={loading}
                      className="flex-1 px-3 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium text-sm"
                    >
                      {loading ? 'Stopping...' : 'Stop'}
                    </button>
                  </div>
                )}
              </div>

              {/* Small details button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/timer/${timer.id}`);
                }}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 font-medium text-sm"
                title="View details"
              >
                📊
              </button>
            </div>

            {/* Quick checkout buttons */}
            {!hasActiveCheckout && quickOptions.length > 0 && (
              <div>
                <div className="text-sm text-gray-700 dark:text-gray-200 mb-2 font-medium">Quick Start:</div>
                <div className="grid grid-cols-3 gap-2">
                  {quickOptions.slice(0, 5).map((option) => (
                    <button
                      key={option.label}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickCheckout(option.minutes);
                      }}
                      disabled={createCheckoutMutation.isPending}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
