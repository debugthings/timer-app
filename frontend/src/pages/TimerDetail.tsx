import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTimer, createCheckout, startCheckout, stopCheckout, getAuditLogs } from '../services/api';
import { ActiveTimer } from '../components/Checkout/ActiveTimer';
import { formatTime } from '../utils/time';
import { useTimerAvailability } from '../hooks/useTimerExpiration';

export function TimerDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const operationInProgress = useRef(false); // Prevent double-clicks
  const availability = useTimerAvailability(id);
  const isAvailable = availability.available;

  const { data: timer, isLoading } = useQuery({
    queryKey: ['timer', id],
    queryFn: () => getTimer(id!),
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs', id],
    queryFn: () => getAuditLogs(id!, 20), // Get last 20 audit events
    refetchInterval: 10000, // Refetch every 10 seconds to show new logs
  });

  const createCheckoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timer', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!timer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Timer not found</div>
      </div>
    );
  }

  const allocation = timer.todayAllocation;
  const remainingSeconds = allocation
    ? allocation.totalSeconds - allocation.usedSeconds
    : timer.defaultDailySeconds;

  const activeCheckout = allocation?.checkouts?.find(
    (c) => c.status === 'ACTIVE' || c.status === 'PAUSED'
  );

  const handleGeneralStart = async () => {
    // Prevent double-clicks
    if (operationInProgress.current || loading) return;
    operationInProgress.current = true;
    setLoading(true);
    
    try {
      // Create checkout for ALL remaining time
      const result = await createCheckoutMutation.mutateAsync({
        timerId: timer.id,
        allocatedSeconds: remainingSeconds,
      });
      await startCheckout(result.id);
      queryClient.invalidateQueries({ queryKey: ['timer', id] });
    } catch (error) {
      console.error('Failed to start timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handleQuickCheckout = async (minutes: number) => {
    // Prevent double-clicks
    if (operationInProgress.current || createCheckoutMutation.isPending) return;
    operationInProgress.current = true;
    
    try {
      const seconds = minutes * 60;
      const result = await createCheckoutMutation.mutateAsync({
        timerId: timer.id,
        allocatedSeconds: seconds,
      });
      // Automatically start the checkout after creating it
      await startCheckout(result.id);
      queryClient.invalidateQueries({ queryKey: ['timer', id] });
    } catch (error) {
      console.error('Failed to create checkout:', error);
    } finally {
      operationInProgress.current = false;
    }
  };

  const handleStop = async () => {
    if (!activeCheckout) return;
    
    // Prevent double-clicks
    if (operationInProgress.current || loading) return;
    operationInProgress.current = true;
    setLoading(true);
    
    try {
      await stopCheckout(activeCheckout.id);
      queryClient.invalidateQueries({ queryKey: ['timer', id] });
    } catch (error) {
      console.error('Failed to stop timer:', error);
    } finally {
      setLoading(false);
      operationInProgress.current = false;
    }
  };

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['timer', id] });
  };

  // Quick checkout options (only show if enough time remaining)
  const quickOptions = [
    { label: '15m', minutes: 15 },
    { label: '30m', minutes: 30 },
    { label: '1hr', minutes: 60 },
  ].filter(option => option.minutes * 60 <= remainingSeconds);

  // Check if this is a "general" checkout (allocated = all remaining at creation time)
  // We use a 60 second tolerance to account for time passing between allocation and checkout creation
  const isGeneralCheckout = activeCheckout && allocation &&
    activeCheckout.allocatedSeconds >= (allocation.totalSeconds - allocation.usedSeconds - 60);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/" className="text-blue-500 hover:underline mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold">{timer.name}</h1>
          <p className="text-gray-600">{timer.person?.name}</p>
        </div>

        {/* Availability warning */}
        {!isAvailable && (
          <div className={`rounded-lg p-4 mb-6 ${availability.reason === 'before_start' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-medium ${availability.reason === 'before_start' ? 'text-yellow-800' : 'text-red-800'}`}>
              {availability.reason === 'before_start' 
                ? 'This timer is not yet available for today. Please check back later.'
                : 'This timer has expired for today. It will become available again tomorrow.'}
            </p>
          </div>
        )}

        {/* Today's allocation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Today's Allocation</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-bold">
                {formatTime(allocation?.totalSeconds || timer.defaultDailySeconds)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Used</div>
              <div className="text-2xl font-bold">{formatTime(allocation?.usedSeconds || 0)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-sm text-gray-600">Remaining</div>
              <div className="text-3xl font-bold text-blue-500">{formatTime(remainingSeconds)}</div>
            </div>
          </div>

          {/* State 1: No Active Checkout - Show Start button and Quick Start buttons */}
          {!activeCheckout && isAvailable && remainingSeconds > 0 && (
            <div className="mt-4 space-y-3">
              {/* General Start Button */}
              <button
                onClick={handleGeneralStart}
                disabled={loading || createCheckoutMutation.isPending}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium text-lg"
              >
                {loading ? 'Starting...' : 'Start'}
              </button>
              
              {/* Quick Start Buttons */}
              {quickOptions.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 mb-2 font-medium">Quick Start:</div>
                  <div className="flex gap-2">
                    {quickOptions.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => handleQuickCheckout(option.minutes)}
                        disabled={createCheckoutMutation.isPending}
                        className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium text-lg"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* State 2: General Checkout Active - Show Stop button */}
          {activeCheckout && isGeneralCheckout && (
            <div className="mt-4">
              <button
                onClick={handleStop}
                disabled={loading}
                className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium text-lg"
              >
                {loading ? 'Stopping...' : 'Stop'}
              </button>
            </div>
          )}

          {/* State 3: Quick Start Checkout Active - No buttons (Active Timer component handles controls) */}
        </div>

        {/* Active checkout */}
        {activeCheckout && (
          <div className="mb-6">
            <ActiveTimer checkout={activeCheckout} onUpdate={handleUpdate} />
          </div>
        )}

        {/* Checkout history */}
        {allocation && allocation.checkouts && allocation.checkouts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Today's Checkout History</h3>
            <div className="space-y-2">
              {allocation.checkouts
                .filter((c) => c.status === 'COMPLETED' || c.status === 'CANCELLED')
                .map((checkout) => (
                  <div
                    key={checkout.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <span className="font-medium">{formatTime(checkout.allocatedSeconds)}</span>
                      <span className="text-gray-600 ml-2">
                        (used: {formatTime(checkout.usedSeconds)})
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        checkout.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {checkout.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Audit Logs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Timer Activity</h3>
          {auditLogs.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {auditLogs.map((log: any) => {
                const getActionIcon = (action: string) => {
                  switch (action) {
                    case 'checkout_start': return '▶️';
                    case 'checkout_pause': return '⏸️';
                    case 'checkout_stop': return '⏹️';
                    case 'checkout_cancel': return '❌';
                    case 'alarm_triggered': return '🔊';
                    case 'alarm_acknowledged': return '✅';
                    case 'alarm_preview': return '👁️';
                    default: return '📝';
                  }
                };

                const getActionLabel = (action: string) => {
                  switch (action) {
                    case 'checkout_start': return 'Started';
                    case 'checkout_pause': return 'Paused';
                    case 'checkout_stop': return 'Stopped';
                    case 'checkout_cancel': return 'Cancelled';
                    case 'alarm_triggered': return 'Alarm Triggered';
                    case 'alarm_acknowledged': return 'Alarm Acknowledged';
                    case 'alarm_preview': return 'Sound Previewed';
                    default: return action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                  }
                };

                return (
                <div
                  key={log.id}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                >
                    <div className="flex items-center flex-1">
                      <span className="mr-3 text-lg">{getActionIcon(log.action)}</span>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{getActionLabel(log.action)}</span>
                        {log.details && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{log.details}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>No timer activity yet</p>
              <p className="text-sm">Timer actions will appear here when you start, stop, or interact with timers</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
