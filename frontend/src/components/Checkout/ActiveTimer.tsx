import { useState, useEffect, useRef, useCallback } from 'react';
import { Checkout } from '../../types';
import { formatTime } from '../../utils/time';
import { startCheckout, pauseCheckout, stopCheckout } from '../../services/api';
import { showNotification, normalizeAlarmSound } from '../../utils/notifications';
import { useTimerExpiration } from '../../hooks/useTimerExpiration';
import { useGlobalAlarm } from '../../hooks/useGlobalAlarm';

interface ActiveTimerProps {
  checkout: Checkout;
  onUpdate: () => void;
}

export function ActiveTimer({ checkout, onUpdate }: ActiveTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(checkout.usedSeconds);
  const [isRunning, setIsRunning] = useState(checkout.status === 'ACTIVE');
  const [loading, setLoading] = useState(false);
  const operationInProgress = useRef(false); // Prevent double-clicks
  const hasNotifiedRef = useRef(false);
  const autoPausingRef = useRef(false); // Prevent multiple auto-pause attempts
  const isExpired = useTimerExpiration(checkout.timerId);
  const { alarmState, triggerAlarm, acknowledgeAlarm } = useGlobalAlarm();

  const remainingSeconds = checkout.allocatedSeconds - elapsedSeconds;
  const hasActiveEntry = checkout.entries?.some((e) => !e.endTime);

  // Sync local elapsed seconds with server data when checkout changes
  // This handles cases where you navigate away and come back
  useEffect(() => {
    setElapsedSeconds(checkout.usedSeconds);
    setIsRunning(checkout.status === 'ACTIVE');
    // Reset notification flag when checkout changes
    hasNotifiedRef.current = false;
    autoPausingRef.current = false;
  }, [checkout.id, checkout.usedSeconds, checkout.status]);

  // Cleanup alarm on unmount is handled by GlobalAlarmProvider

  const handlePause = useCallback(async () => {
    // Prevent double-clicks and concurrent operations
    if (operationInProgress.current || loading) return;
    operationInProgress.current = true;
    setLoading(true);
    
    try {
      await pauseCheckout(checkout.id);
      setIsRunning(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to pause timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  }, [checkout.id, loading, onUpdate]);

  // Calculate real-time elapsed seconds for active timers
  useEffect(() => {
    if (isRunning && hasActiveEntry) {
      const activeEntry = checkout.entries?.find((e) => !e.endTime);
      if (!activeEntry) return;

      const interval = setInterval(() => {
        // Calculate elapsed time from the entry's start time
        const now = new Date();
        const startTime = new Date(activeEntry.startTime);
        const entryElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const totalElapsed = checkout.usedSeconds + entryElapsed;

        if (totalElapsed >= checkout.allocatedSeconds) {
          // Auto-stop when time runs out
          setElapsedSeconds(checkout.allocatedSeconds);

          // Auto-pause (only once, prevent race condition)
          // Alarm notifications are handled by TimerCard on dashboard
          if (!autoPausingRef.current) {
            autoPausingRef.current = true;
            handlePause();
          }
        } else {
          setElapsedSeconds(totalElapsed);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRunning, hasActiveEntry, checkout.allocatedSeconds, checkout.usedSeconds, checkout.entries, checkout.id, handlePause]);

  // Handle timer expiration
  useEffect(() => {
    if (isExpired && (checkout.status === 'ACTIVE' || checkout.status === 'PAUSED')) {
      // Timer expired, show notification and alarm
      const alarmSound = normalizeAlarmSound(checkout.timer?.alarmSound || 'helium');
      triggerAlarm(checkout.timer?.name || 'Timer', checkout.timer?.person?.name, 'expired', alarmSound);
      showNotification('Timer Expired', {
        body: 'This timer has expired for today and has been stopped.',
        requireInteraction: true,
      });
      onUpdate(); // Refresh to show cancelled status
    }
  }, [isExpired, checkout.status, checkout.id, checkout.timer?.alarmSound, checkout.timer?.name, checkout.timer?.person?.name, triggerAlarm, onUpdate]);

  const handleAcknowledgeAlarm = () => {
    acknowledgeAlarm();
  };

  const handleStart = async () => {
    // Prevent double-clicks
    if (operationInProgress.current || loading) return;
    operationInProgress.current = true;
    setLoading(true);
    
    try {
      await startCheckout(checkout.id);
      setIsRunning(true);
      onUpdate();
    } catch (error) {
      console.error('Failed to start timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handleStop = async () => {
    // Prevent double-clicks
    if (operationInProgress.current || loading) return;
    if (!confirm('Stop this checkout and return unused time?')) return;

    operationInProgress.current = true;
    setLoading(true);
    
    try {
      await stopCheckout(checkout.id);
      onUpdate();
    } catch (error) {
      console.error('Failed to stop timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const progressPercent = (elapsedSeconds / checkout.allocatedSeconds) * 100;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Active Checkout</h3>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Time display */}
      <div className="text-center mb-6">
        <div className="text-5xl font-bold mb-2">{formatTime(remainingSeconds)}</div>
        <div className="text-gray-600">
          {formatTime(elapsedSeconds)} used of {formatTime(checkout.allocatedSeconds)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!hasActiveEntry && checkout.status !== 'COMPLETED' && checkout.status !== 'CANCELLED' && (
          <button
            onClick={handleStart}
            disabled={loading || remainingSeconds <= 0}
            className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
          >
            {loading ? 'Starting...' : 'Start'}
          </button>
        )}

        {hasActiveEntry && isRunning && (
          <button
            onClick={handlePause}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
          >
            {loading ? 'Pausing...' : 'Pause'}
          </button>
        )}

        {checkout.status !== 'COMPLETED' && checkout.status !== 'CANCELLED' && (
          <button
            onClick={handleStop}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
          >
            {loading ? 'Stopping...' : 'Stop'}
          </button>
        )}
      </div>

      {checkout.status === 'COMPLETED' && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-center">
          Checkout completed
        </div>
      )}

      {checkout.status === 'CANCELLED' && (
        <div className="mt-4 p-3 bg-gray-100 text-gray-700 rounded-lg text-center">
          Checkout cancelled
        </div>
      )}

      {/* Alarm Acknowledgment Modal */}
      {alarmState?.isActive && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4">⏰</div>
              <h2 className="text-3xl font-bold text-red-600 mb-4">
                {alarmState?.reason === 'expired' ? 'Timer Expired!' : 'Time\'s Up!'}
              </h2>
              <p className="text-lg text-gray-700 mb-2 font-semibold">
                {alarmState?.timerName}
              </p>
              <p className="text-md text-gray-600 mb-6">
                {alarmState?.reason === 'expired'
                  ? `This timer has expired for today and has been stopped.`
                  : `Checkout time has ended for ${alarmState?.personName || 'timer'}.`}
              </p>
              <button
                onClick={handleAcknowledgeAlarm}
                className="w-full px-6 py-4 bg-red-500 text-white text-xl font-bold rounded-lg hover:bg-red-600 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
