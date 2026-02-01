import { useState, useEffect, useRef } from 'react';
import { Timer, AlarmSound } from '../../types';
import { formatTime } from '../../utils/time';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createCheckout, startCheckout, pauseCheckout, updateTimerAlarmSound } from '../../services/api';
import { showNotification, startContinuousAlarm, stopContinuousAlarm, ALARM_SOUND_LABELS } from '../../utils/notifications';
import { useTimerAvailability } from '../../hooks/useTimerExpiration';

interface TimerCardProps {
  timer: Timer;
}

export function TimerCard({ timer }: TimerCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [showAlarmSelector, setShowAlarmSelector] = useState(false);
  const operationInProgress = useRef(false); // Prevent double-clicks
  const allocation = timer.todayAllocation;
  const hasNotifiedRef = useRef(false);
  const availability = useTimerAvailability(timer.id);
  const isAvailable = availability.available;
  
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

  const dailyRemainingSeconds = allocation
    ? allocation.totalSeconds - liveUsedSeconds
    : timer.defaultDailySeconds;

  const progressPercent = allocation
    ? (liveUsedSeconds / allocation.totalSeconds) * 100
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
          
          // Show notification, alarm, and modal (only once)
          if (!hasNotifiedRef.current) {
            hasNotifiedRef.current = true;
            startContinuousAlarm(timer.alarmSound);
            setShowAlarmModal(true);
            showNotification(`${timer.name} - Timer Complete!`, {
              body: `Checkout time has ended for ${timer.person?.name || 'timer'}.`,
              requireInteraction: true,
            });
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
        // Quick checkout 30 minutes if no active checkout
        const checkoutSeconds = Math.min(dailyRemainingSeconds, 30 * 60);
        const result = await createCheckout({
          timerId: timer.id,
          allocatedSeconds: checkoutSeconds,
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

  const handleCardClick = () => {
    navigate(`/timer/${timer.id}`);
  };
  
  const handleAcknowledgeAlarm = () => {
    stopContinuousAlarm();
    setShowAlarmModal(false);
  };
  
  const handleAlarmSoundPreview = (sound: AlarmSound) => {
    // Just play the sound as a preview (no auth needed)
    startContinuousAlarm(sound);
    setTimeout(() => stopContinuousAlarm(), 1500);
  };
  
  const handleAlarmSoundChange = async (newSound: AlarmSound) => {
    try {
      await updateTimerAlarmSound(timer.id, newSound);
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      setShowAlarmSelector(false);

      // Play preview of the saved sound
      handleAlarmSoundPreview(newSound);
    } catch (error) {
      console.error('Failed to update alarm sound:', error);
    }
  };

  return (
    <>
      <div 
        onClick={handleCardClick}
        className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer"
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-xl font-bold">{timer.name}</h3>
            <p className="text-gray-600 text-sm">{timer.person?.name}</p>
            {scheduleSummary && (
              <p className="text-blue-600 text-xs mt-1">
                Schedule: {scheduleSummary}
              </p>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAlarmSelector(!showAlarmSelector);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 mt-1 flex items-center gap-1"
            >
              🔔 {ALARM_SOUND_LABELS[timer.alarmSound]}
            </button>
            {showAlarmSelector && (
              <div 
                className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 space-y-1 min-w-[200px]"
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
                        timer.alarmSound === sound ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                      }`}
                      title="Click to preview • Double-click to save"
                    >
                      {ALARM_SOUND_LABELS[sound]}
                      {timer.alarmSound === sound && (
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
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                Not Yet Available
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                Expired
              </span>
            )
          ) : hasActiveCheckout ? (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Active
            </span>
          ) : null}
        </div>

        <div className="mb-3 space-y-2">
          {/* Daily progress bar */}
          <div>
            {hasActiveCheckout && <div className="text-xs text-gray-500 mb-1">Daily Progress</div>}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {/* Checkout progress bar (only when active) */}
          {hasActiveCheckout && activeCheckout && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Checkout Progress</div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
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

        {!hasActiveCheckout ? (
          <div className="flex justify-between items-center text-sm mb-4">
            <span className="text-gray-600">
              {formatTime(liveUsedSeconds)} used
            </span>
            <span className="font-bold text-lg">{formatTime(dailyRemainingSeconds)} left</span>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {/* Daily allocation */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Daily:</span>
              <span className="font-medium">{formatTime(dailyRemainingSeconds)} left</span>
            </div>
            {/* Active checkout */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Checkout:</span>
              <span className="font-bold text-lg text-blue-600">{formatTime(checkoutRemainingSeconds)} left</span>
            </div>
          </div>
        )}

        {/* Start/Stop buttons */}
        {isAvailable && dailyRemainingSeconds > 0 && (
          <div className="flex gap-2">
            {!hasActiveCheckout && (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm"
              >
                {loading ? 'Starting...' : 'Start'}
              </button>
            )}
            
            {hasActiveCheckout && !hasActiveEntry && (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-sm"
              >
                {loading ? 'Starting...' : 'Resume'}
              </button>
            )}
            
            {hasActiveCheckout && hasActiveEntry && isRunning && (
              <button
                onClick={handlePause}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium text-sm"
              >
                {loading ? 'Pausing...' : 'Pause'}
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/timer/${timer.id}`);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-sm"
            >
              Details
            </button>
          </div>
        )}
      </div>
      
      {/* Alarm Acknowledgment Modal */}
      {showAlarmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
          }}
        >
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-3xl font-bold text-red-600 mb-4">
                Time's Up!
              </h2>
              <p className="text-lg text-gray-700 mb-2 font-semibold">
                {timer.name}
              </p>
              <p className="text-md text-gray-600 mb-6">
                Checkout time has ended for {timer.person?.name || 'timer'}.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAcknowledgeAlarm();
                }}
                className="w-full px-6 py-4 bg-red-500 text-white text-xl font-bold rounded-lg hover:bg-red-600 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
