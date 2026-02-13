import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  getSettings,
  getPeople,
  getTimers,
  getTimerCurrent,
  getAdminAuditLogs,
  createPerson,
  createTimer,
  updateTimer,
  updateAllocation,
  deletePerson,
  deleteTimer,
  updateSettings,
  createCheckout,
  startCheckout,
  pauseCheckout,
  stopCheckout,
  forceAllocationActive,
  forceAllocationExpired,
} from '../services/api';
import { formatTime, hoursToSeconds } from '../utils/time';
import { useAdmin } from '../contexts/AdminContext';
import { Timer } from '../types';
import { ThemeToggle } from '../components/ThemeToggle';

export function AdminPanel() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { clearAdminSession, refreshSession } = useAdmin();

  // Refresh session on user activity
  useEffect(() => {
    const handleActivity = () => refreshSession();

    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, [refreshSession]);

  const handleExitAdmin = () => {
    clearAdminSession();
    navigate('/');
  };

  const handleUpdateTimezone = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ timezone });
    } catch (error) {
      console.error('Failed to update timezone:', error);
    }
  };
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [showTimerForm, setShowTimerForm] = useState(false);
  const [personName, setPersonName] = useState('');
  const [timerForm, setTimerForm] = useState({
    name: '',
    personId: '',
    hours: 2,
    minutes: 0,
  });
  const [defaultStartTime, setDefaultStartTime] = useState('');
  const [defaultExpirationTime, setDefaultExpirationTime] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [useSchedule, setUseSchedule] = useState(false);
  const [schedules, setSchedules] = useState<Array<{ dayOfWeek: number; seconds: number; startTime?: string; expirationTime?: string }>>([]);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [scheduleHours, setScheduleHours] = useState(1);
  const [scheduleMinutes, setScheduleMinutes] = useState(0);
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleExpirationTime, setScheduleExpirationTime] = useState('');
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null);
  const [deletingTimer, setDeletingTimer] = useState<{ id: string; name: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Update timezone state when settings load
  useEffect(() => {
    if (settings?.timezone) {
      setTimezone(settings.timezone);
    }
  }, [settings?.timezone]);

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: getPeople,
  });

  const { data: timers = [] } = useQuery({
    queryKey: ['timers'],
    queryFn: getTimers,
  });

  // Fetch /current for each timer to get allocation with manualOverride
  const currentQueries = useQueries({
    queries: timers.map((t) => ({
      queryKey: ['timer-current', t.id],
      queryFn: () => getTimerCurrent(t.id),
    })),
  });

  // Merge timers with their current allocation data
  const timersWithCurrent = timers.map((timer, i) => {
    const currentData = currentQueries[i]?.data;
    if (!currentData) return { ...timer, todayAllocation: undefined };
    return {
      ...timer,
      ...currentData.timer,
      todayAllocation: currentData.allocation,
    };
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['adminAuditLogs'],
    queryFn: () => getAdminAuditLogs(50),
    refetchInterval: 1000,
  });

  const createPersonMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setPersonName('');
      setShowPersonForm(false);
    },
  });

  const createTimerMutation = useMutation({
    mutationFn: createTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      setTimerForm({ name: '', personId: '', hours: 2, minutes: 0 });
      setShowTimerForm(false);
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const deleteTimerMutation = useMutation({
    mutationFn: deleteTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const createCheckoutMutation = useMutation({
    mutationFn: createCheckout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: (checkoutId: string) => startCheckout(checkoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const pauseTimerMutation = useMutation({
    mutationFn: (checkoutId: string) => pauseCheckout(checkoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: (checkoutId: string) => stopCheckout(checkoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
    },
  });

  const forceActiveMutation = useMutation({
    mutationFn: (allocationId: string) => forceAllocationActive(allocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer-current'] });
    },
  });

  const forceExpiredMutation = useMutation({
    mutationFn: (allocationId: string) => forceAllocationExpired(allocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer-current'] });
    },
  });

  const updateTimerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTimer>[1] }) =>
      updateTimer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer-current'] });
      setTimerForm({ name: '', personId: '', hours: 2, minutes: 0 });
      setDefaultExpirationTime('');
      setShowTimerForm(false);
      setEditingTimer(null);
      setUseSchedule(false);
      setSchedules([]);
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ timerId, totalSeconds, date }: { timerId: string; totalSeconds: number; date?: string }) =>
      updateAllocation(timerId, { totalSeconds, ...(date && { date }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      queryClient.invalidateQueries({ queryKey: ['timer-current'] });
    },
  });

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPersonMutation.mutateAsync({ name: personName });
  };

  const handleSubmitTimer = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSeconds = hoursToSeconds(timerForm.hours) + (timerForm.minutes * 60);
    
    const timerData = {
      name: timerForm.name,
      personId: timerForm.personId,
      defaultDailySeconds: totalSeconds,
      defaultStartTime: defaultStartTime || undefined,
      defaultExpirationTime: defaultExpirationTime || undefined,
      schedules: useSchedule && schedules.length > 0 ? schedules : undefined,
    };
    
    if (editingTimer) {
      await updateTimerMutation.mutateAsync({
        id: editingTimer.id,
        data: timerData,
      });
    } else {
      await createTimerMutation.mutateAsync(timerData);
    }
    
    // Reset schedule state
    setUseSchedule(false);
    setSchedules([]);
    setSelectedDays(new Set());
    setScheduleHours(1);
    setScheduleMinutes(0);
    setDefaultStartTime('');
    setDefaultExpirationTime('');
  };

  const handleToggleDay = (day: number) => {
    const existingSchedule = schedules.find(s => s.dayOfWeek === day);
    if (existingSchedule) {
      // Populate form fields with stored values
      const hours = Math.floor(existingSchedule.seconds / 3600);
      const minutes = Math.floor((existingSchedule.seconds % 3600) / 60);
      setScheduleHours(hours);
      setScheduleMinutes(minutes);
      setScheduleStartTime(existingSchedule.startTime || '');
      setScheduleExpirationTime(existingSchedule.expirationTime || '');
      // Select this day for editing
      setSelectedDays(new Set([day]));
    } else {
      const newSelected = new Set(selectedDays);
      if (newSelected.has(day)) {
        newSelected.delete(day);
      } else {
        newSelected.add(day);
      }
      setSelectedDays(newSelected);
    }
  };

  const handleAddSchedule = () => {
    if (selectedDays.size === 0) return;
    
    const newSchedules = [...schedules];
    const seconds = hoursToSeconds(scheduleHours) + (scheduleMinutes * 60);
    
    // Remove any existing schedules for selected days
    selectedDays.forEach(day => {
      const index = newSchedules.findIndex(s => s.dayOfWeek === day);
      if (index !== -1) {
        newSchedules.splice(index, 1);
      }
    });
    
    // Add new schedules
    selectedDays.forEach(day => {
      newSchedules.push({ 
        dayOfWeek: day, 
        seconds,
        startTime: scheduleStartTime || undefined,
        expirationTime: scheduleExpirationTime || undefined,
      });
    });
    
    setSchedules(newSchedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    setSelectedDays(new Set());
    setScheduleHours(1);
    setScheduleMinutes(0);
    setScheduleStartTime('');
    setScheduleExpirationTime('');
  };

  const handleRemoveScheduleDay = (day: number) => {
    setSchedules(schedules.filter(s => s.dayOfWeek !== day));
  };

  const getDayName = (day: number) => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return names[day];
  };

  const handleDeletePerson = async (id: string, name: string) => {
    if (confirm(`Delete ${name} and all their timers?`)) {
      await deletePersonMutation.mutateAsync(id);
    }
  };

  const handleDeleteTimer = (id: string, name: string) => {
    setDeletingTimer({ id, name });
  };

  const confirmDeleteTimer = async () => {
    if (deletingTimer) {
      await deleteTimerMutation.mutateAsync(deletingTimer.id);
      setDeletingTimer(null);
    }
  };

  const cancelDeleteTimer = () => {
    setDeletingTimer(null);
  };

  // Helper functions for timer control
  const getActiveCheckout = (timer: Timer) => {
    if (!timer.todayAllocation?.checkouts) return null;
    return timer.todayAllocation.checkouts.find(c => c.status === 'ACTIVE') || null;
  };

  const getPausedCheckout = (timer: Timer) => {
    if (!timer.todayAllocation?.checkouts) return null;
    return timer.todayAllocation.checkouts.find(c => c.status === 'PAUSED') || null;
  };

  const canStartTimer = (timer: Timer) => {
    if (!timer.todayAllocation) return false;
    const remainingSeconds = timer.todayAllocation.totalSeconds - timer.todayAllocation.usedSeconds;
    return remainingSeconds > 0 && !getActiveCheckout(timer);
  };

  const canResumeTimer = (timer: Timer) => {
    return !!getPausedCheckout(timer);
  };

  const canStopTimer = (timer: Timer) => {
    return !!getActiveCheckout(timer);
  };

  // Find all current day's timers (those with today's allocation)
  const getCurrentDayTimers = () => {
    return timersWithCurrent.filter(timer => timer.todayAllocation);
  };

  // Helper function to reset timer form to default state
  const resetTimerForm = () => {
    setTimerForm({ name: '', personId: '', hours: 2, minutes: 0 });
    setDefaultStartTime('');
    setDefaultExpirationTime('');
    setUseSchedule(false);
    setSchedules([]);
    setSelectedDays(new Set());
    setScheduleHours(1);
    setScheduleMinutes(0);
    setEditingTimer(null);
  };

  const handleStartTimer = async (timer: Timer) => {
    if (!timer.todayAllocation) return;

    const remainingSeconds = timer.todayAllocation.totalSeconds - timer.todayAllocation.usedSeconds;
    if (remainingSeconds <= 0) return;

    // Create a checkout for all remaining time
    const checkout = await createCheckoutMutation.mutateAsync({
      timerId: timer.id,
      allocatedSeconds: remainingSeconds,
    });

    // Then start the checkout
    await startTimerMutation.mutateAsync(checkout.id);
  };

  const handleStopTimer = async (timer: Timer) => {
    const activeCheckout = getActiveCheckout(timer);
    if (activeCheckout) {
      await stopTimerMutation.mutateAsync(activeCheckout.id);
    }
  };

  const handlePauseTimer = async (timer: Timer) => {
    const activeCheckout = getActiveCheckout(timer);
    if (activeCheckout) {
      await pauseTimerMutation.mutateAsync(activeCheckout.id);
    }
  };

  const handleResumeTimer = async (timer: Timer) => {
    const pausedCheckout = getPausedCheckout(timer);
    if (pausedCheckout) {
      await startTimerMutation.mutateAsync(pausedCheckout.id);
    }
  };

  const handleForceActive = async (timer: Timer & { todayAllocation?: { id: string } }) => {
    if (!timer.todayAllocation?.id) return;
    await forceActiveMutation.mutateAsync(timer.todayAllocation.id);
  };

  const handleForceExpired = async (timer: Timer & { todayAllocation?: { id: string } }) => {
    if (!timer.todayAllocation?.id) return;
    await forceExpiredMutation.mutateAsync(timer.todayAllocation.id);
  };

  const handleEditTimer = (timer: Timer) => {
    // Convert seconds back to hours and minutes
    const hours = Math.floor(timer.defaultDailySeconds / 3600);
    const minutes = Math.floor((timer.defaultDailySeconds % 3600) / 60);
    
    setTimerForm({
      name: timer.name,
      personId: timer.personId,
      hours,
      minutes,
    });
    
    // Load default times
    setDefaultStartTime(timer.defaultStartTime || '');
    setDefaultExpirationTime(timer.defaultExpirationTime || '');
    
    // Load existing schedules if any
    if (timer.schedules && timer.schedules.length > 0) {
      setUseSchedule(true);
      setSchedules(timer.schedules.map(s => ({
        dayOfWeek: s.dayOfWeek,
        seconds: s.seconds,
        startTime: s.startTime,
        expirationTime: s.expirationTime,
      })));
    } else {
      setUseSchedule(false);
      setSchedules([]);
    }
    
    setEditingTimer(timer);
    setShowTimerForm(true);
  };

  const handleAdjustTime = async (timer: Timer, minutesToAdd: number) => {
    const allocation = timer.todayAllocation;
    if (!allocation) return;
    
    const secondsToAdd = minutesToAdd * 60;
    const newTotal = Math.max(0, allocation.totalSeconds + secondsToAdd);
    
    await updateAllocationMutation.mutateAsync({
      timerId: timer.id,
      totalSeconds: newTotal,
      date: allocation.date,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <button
              onClick={handleExitAdmin}
              className="text-blue-500 dark:text-blue-400 hover:underline mb-2 inline-block"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* People Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">People</h2>
            <button
              onClick={() => setShowPersonForm(!showPersonForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              {showPersonForm ? 'Cancel' : 'Add Person'}
            </button>
          </div>

          {showPersonForm && (
            <form onSubmit={handleCreatePerson} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Person name"
                className="w-full px-3 py-2 border rounded-lg mb-3 dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:placeholder-gray-400"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
                disabled={createPersonMutation.isPending}
              >
                {createPersonMutation.isPending ? 'Creating...' : 'Create Person'}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <span className="font-medium text-gray-900 dark:text-white">{person.name}</span>
                <button
                  onClick={() => handleDeletePerson(person.id, person.name)}
                  className="px-3 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
            {people.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No people yet</p>
            )}
          </div>
        </div>

        {/* Timers Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Timers</h2>
            <button
              onClick={() => {
                if (!showTimerForm) {
                  // Opening the form for new timer - reset all fields
                  resetTimerForm();
                } else {
                  // Closing the form
                  setEditingTimer(null);
                }
                setShowTimerForm(!showTimerForm);
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              disabled={people.length === 0}
            >
              {showTimerForm ? 'Cancel' : 'Add Timer'}
            </button>
          </div>

          {showTimerForm && (
            <form onSubmit={handleSubmitTimer} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <input
                type="text"
                value={timerForm.name}
                onChange={(e) => setTimerForm({ ...timerForm, name: e.target.value })}
                placeholder="Timer name (e.g., Screen Time, Homework)"
                className="w-full px-3 py-2 border rounded-lg mb-3 dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:placeholder-gray-400"
                required
              />
              <select
                value={timerForm.personId}
                onChange={(e) => setTimerForm({ ...timerForm, personId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg mb-3 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                required
              >
                <option value="">Select person</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                  Default Daily Time
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(used for days without a schedule)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Hours</label>
                    <input
                      type="number"
                      value={timerForm.hours}
                      onChange={(e) =>
                        setTimerForm({ ...timerForm, hours: parseInt(e.target.value) || 0 })
                      }
                      min="0"
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Minutes</label>
                    <input
                      type="number"
                      value={timerForm.minutes}
                      onChange={(e) =>
                        setTimerForm({ ...timerForm, minutes: parseInt(e.target.value) || 0 })
                      }
                      min="0"
                      max="59"
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Default Start Time */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Default Start Time (optional)
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(applies to all days unless schedule overrides)</span>
                </label>
                <input
                  type="time"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Timer becomes available at this time each day (24-hour format). Leave empty to start at midnight.
                </p>
              </div>

              {/* Default Expiration Time */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                  Default Expiration Time (optional)
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(applies to all days unless schedule overrides)</span>
                </label>
                <input
                  type="time"
                  value={defaultExpirationTime}
                  onChange={(e) => setDefaultExpirationTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Timer expires at this time each day (24-hour format). Leave empty for no expiration.
                </p>
              </div>

              {/* Schedule Editor */}
              <div className="mb-3 p-4 border rounded-lg bg-white dark:bg-gray-600 dark:border-gray-500">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Custom Weekly Schedule</label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSchedule(!useSchedule);
                      if (useSchedule) {
                        setSchedules([]);
                        setSelectedDays(new Set());
                      }
                    }}
                    className="text-sm text-blue-500 dark:text-blue-400 hover:underline"
                  >
                    {useSchedule ? 'Use default time' : 'Set custom schedule'}
                  </button>
                </div>

                {useSchedule && (
                  <div>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-300 mb-2">Select days:</label>
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleToggleDay(day)}
                            className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                              selectedDays.has(day)
                                ? 'bg-blue-500 text-white'
                                : schedules.some(s => s.dayOfWeek === day)
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
                                : 'bg-gray-100 dark:bg-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {getDayName(day)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Hours</label>
                        <input
                          type="number"
                          value={scheduleHours}
                          onChange={(e) => setScheduleHours(parseInt(e.target.value) || 0)}
                          min="0"
                          placeholder="0"
                          className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:placeholder-gray-400"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Minutes</label>
                        <input
                          type="number"
                          value={scheduleMinutes}
                          onChange={(e) => setScheduleMinutes(parseInt(e.target.value) || 0)}
                          min="0"
                          max="59"
                          placeholder="0"
                          className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white dark:placeholder-gray-400"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                        Start Time (optional)
                      </label>
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Timer becomes available at this time (24-hour format). Leave empty to start at midnight.
                      </p>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                        Expiration Time (optional)
                      </label>
                      <input
                        type="time"
                        value={scheduleExpirationTime}
                        onChange={(e) => setScheduleExpirationTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Timer expires at this time (24-hour format). Leave empty for no expiration.
                      </p>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        disabled={selectedDays.size === 0}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Set Time
                      </button>
                    </div>

                    {schedules.length > 0 && (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700 dark:text-gray-200 mb-2">Weekly Schedule:</div>
                        <div className="flex flex-wrap gap-2">
                          {schedules.map((schedule) => (
                            <div
                              key={schedule.dayOfWeek}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleToggleDay(schedule.dayOfWeek)}
                              onKeyDown={(e) => e.key === 'Enter' && handleToggleDay(schedule.dayOfWeek)}
                              className="flex items-center gap-2 px-2 py-1 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/50"
                            >
                              <span className="font-medium text-gray-900 dark:text-white">{getDayName(schedule.dayOfWeek)}:</span>
                              <span>{formatTime(schedule.seconds)}</span>
                              {(schedule.startTime || schedule.expirationTime) && (
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                  ({schedule.startTime || '00:00'} - {schedule.expirationTime || '23:59'})
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemoveScheduleDay(schedule.dayOfWeek); }}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 ml-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                disabled={editingTimer ? updateTimerMutation.isPending : createTimerMutation.isPending}
              >
                {editingTimer 
                  ? (updateTimerMutation.isPending ? 'Updating...' : 'Update Timer')
                  : (createTimerMutation.isPending ? 'Creating...' : 'Create Timer')}
              </button>
            </form>
          )}

          {/* Current Day Timer Management */}
          {getCurrentDayTimers().map((currentDayTimer) => (
            <div key={currentDayTimer.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center">
                <span className="mr-2">🎯</span>
                Manage Today's Timer: {currentDayTimer.name}
              </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Timer Info */}
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        <strong>Person:</strong> {currentDayTimer.person?.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        <strong>Status:</strong>{' '}
                        {getActiveCheckout(currentDayTimer) && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                            Active
                          </span>
                        )}
                        {getPausedCheckout(currentDayTimer) && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                            Paused
                          </span>
                        )}
                        {!getActiveCheckout(currentDayTimer) && !getPausedCheckout(currentDayTimer) && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-full">
                            Ready
                          </span>
                        )}
                      </div>
                      {currentDayTimer.todayAllocation && (
                        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          <strong>Time Remaining:</strong>{' '}
                          <span className={currentDayTimer.todayAllocation.totalSeconds - currentDayTimer.todayAllocation.usedSeconds > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
                            {formatTime(currentDayTimer.todayAllocation.totalSeconds - currentDayTimer.todayAllocation.usedSeconds)} / {formatTime(currentDayTimer.todayAllocation.totalSeconds)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {canStartTimer(currentDayTimer) && (
                          <button
                            onClick={() => handleStartTimer(currentDayTimer)}
                            disabled={createCheckoutMutation.isPending || startTimerMutation.isPending}
                            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
                          >
                            {createCheckoutMutation.isPending || startTimerMutation.isPending ? 'Starting...' : '▶️ Start'}
                          </button>
                        )}
                        {canResumeTimer(currentDayTimer) && (
                          <button
                            onClick={() => handleResumeTimer(currentDayTimer)}
                            disabled={startTimerMutation.isPending}
                            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                          >
                            {startTimerMutation.isPending ? 'Resuming...' : '▶️ Resume'}
                          </button>
                        )}
                        {canStopTimer(currentDayTimer) && (
                          <button
                            onClick={() => handleStopTimer(currentDayTimer)}
                            disabled={stopTimerMutation.isPending}
                            className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 text-sm font-medium"
                          >
                            {stopTimerMutation.isPending ? 'Stopping...' : '⏹️ Stop'}
                          </button>
                        )}
                        {getActiveCheckout(currentDayTimer) && (
                          <button
                            onClick={() => handlePauseTimer(currentDayTimer)}
                            disabled={pauseTimerMutation.isPending}
                            className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm font-medium"
                          >
                            {pauseTimerMutation.isPending ? 'Pausing...' : '⏸️ Pause'}
                          </button>
                        )}
                      </div>

                      {/* Force Controls - Always available for today's timer */}
                      <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Force Controls:</div>
                        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
                          <button
                            onClick={() => handleForceActive(currentDayTimer)}
                            disabled={forceActiveMutation.isPending}
                            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                              currentDayTimer.todayAllocation?.manualOverride === 'active'
                                ? 'bg-green-600 text-white dark:bg-green-600'
                                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            Active
                          </button>
                          <button
                            onClick={() => handleForceExpired(currentDayTimer)}
                            disabled={forceExpiredMutation.isPending}
                            className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                              currentDayTimer.todayAllocation?.manualOverride === 'expired'
                                ? 'bg-red-600 text-white dark:bg-red-600'
                                : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            Expired
                          </button>
                        </div>
                      </div>

                      {/* Quick Time Adjustments - always show so admin can add time even when out */}
                      {currentDayTimer.todayAllocation && (
                        <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Adjust:</div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, -10)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              -10m
                            </button>
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, -5)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              -5m
                            </button>
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, -1)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              -1m
                            </button>
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, 1)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              +1m
                            </button>
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, 5)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              +5m
                            </button>
                            <button
                              onClick={() => handleAdjustTime(currentDayTimer, 10)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 rounded"
                              disabled={updateAllocationMutation.isPending}
                            >
                              +10m
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

          <div className="space-y-2">
            {timersWithCurrent.map((timer) => (
              <div key={timer.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{timer.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {timer.person?.name} • Default: {formatTime(timer.defaultDailySeconds)}
                      {(timer.defaultStartTime || timer.defaultExpirationTime) && (
                        <> • Window: {timer.defaultStartTime || '00:00'} - {timer.defaultExpirationTime || '23:59'}</>
                      )}
                      {timer.todayAllocation && (
                        <>
                          {' • Today: '}
                          <span className={timer.todayAllocation.totalSeconds - timer.todayAllocation.usedSeconds > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatTime(timer.todayAllocation.totalSeconds - timer.todayAllocation.usedSeconds)} remaining
                          </span>
                          {' / ' + formatTime(timer.todayAllocation.totalSeconds) + ' total'}
                        </>
                      )}
                    </div>
                    {timer.schedules && timer.schedules.length > 0 && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Schedule: {timer.schedules.map(s => {
                          let timeWindow = '';
                          if (s.startTime || s.expirationTime) {
                            timeWindow = ` (${s.startTime || '00:00'} - ${s.expirationTime || '23:59'})`;
                          }
                          return `${getDayName(s.dayOfWeek)}: ${formatTime(s.seconds)}${timeWindow}`;
                        }).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {getActiveCheckout(timer) && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                        Active
                      </span>
                    )}
                    {getPausedCheckout(timer) && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                        Paused
                      </span>
                    )}
                    <button
                      onClick={() => handleEditTimer(timer)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTimer(timer.id, timer.name)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {timers.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No timers yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Section */}
      <div className="mt-8 max-w-7xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-1 text-gray-900 dark:text-white">Audit Log</h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">Recent timer activity across all timers</p>
          {auditLogs.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {auditLogs.map((log: { id: string; action: string; details?: string; createdAt: string; timer?: { name: string; person?: { name: string } } }) => {
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
                    default: return action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                  }
                };

                const timerLabel = log.timer
                  ? `${log.timer.name}${log.timer.person ? ` (${log.timer.person.name})` : ''}`
                  : 'Unknown timer';

                return (
                  <div
                    key={log.id}
                    className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                  >
                    <div className="flex items-center flex-1">
                      <span className="mr-3 text-lg">{getActionIcon(log.action)}</span>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{getActionLabel(log.action)}</span>
                        <span className="text-gray-500 dark:text-gray-300 ml-2">— {timerLabel}</span>
                        {log.details && (
                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">{log.details}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-300">No activity yet</div>
          )}
        </div>
      </div>

      {/* Settings Section */}
      <div className="mt-8 max-w-7xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Settings</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <div className="flex gap-2">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
              </select>
              <button
                onClick={handleUpdateTimezone}
                disabled={updateSettingsMutation.isPending}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This affects timer availability times and day calculations. Current: {settings?.timezone || 'UTC'}
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTimer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Delete Timer</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete the timer "<strong>{deletingTimer.name}</strong>"? 
              This action cannot be undone and will also delete all associated data.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteTimer}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTimer}
                disabled={deleteTimerMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteTimerMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
