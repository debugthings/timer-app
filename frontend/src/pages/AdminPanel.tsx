import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  getPeople,
  getTimers,
  createPerson,
  createTimer,
  updateTimer,
  updateAllocation,
  deletePerson,
  deleteTimer,
  updateSettings,
} from '../services/api';
import { formatTime, hoursToSeconds } from '../utils/time';
import { useAdmin } from '../contexts/AdminContext';
import { Timer } from '../types';

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

  const updateTimerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTimer>[1] }) =>
      updateTimer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
      setTimerForm({ name: '', personId: '', hours: 2, minutes: 0 });
      setDefaultExpirationTime('');
      setShowTimerForm(false);
      setEditingTimer(null);
      setUseSchedule(false);
      setSchedules([]);
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ timerId, totalSeconds }: { timerId: string; totalSeconds: number }) =>
      updateAllocation(timerId, { totalSeconds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timers'] });
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
    const newSelected = new Set(selectedDays);
    if (newSelected.has(day)) {
      newSelected.delete(day);
    } else {
      newSelected.add(day);
    }
    setSelectedDays(newSelected);
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
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={handleExitAdmin}
            className="text-blue-500 hover:underline mb-2 inline-block"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        {/* People Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">People</h2>
            <button
              onClick={() => setShowPersonForm(!showPersonForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {showPersonForm ? 'Cancel' : 'Add Person'}
            </button>
          </div>

          {showPersonForm && (
            <form onSubmit={handleCreatePerson} className="mb-4 p-4 bg-gray-50 rounded">
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Person name"
                className="w-full px-3 py-2 border rounded-lg mb-3"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                disabled={createPersonMutation.isPending}
              >
                {createPersonMutation.isPending ? 'Creating...' : 'Create Person'}
              </button>
            </form>
          )}

          <div className="space-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">{person.name}</span>
                <button
                  onClick={() => handleDeletePerson(person.id, person.name)}
                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
            {people.length === 0 && (
              <p className="text-gray-500 text-center py-4">No people yet</p>
            )}
          </div>
        </div>

        {/* Timers Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Timers</h2>
            <button
              onClick={() => {
                setShowTimerForm(!showTimerForm);
                if (showTimerForm) {
                  setEditingTimer(null);
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              disabled={people.length === 0}
            >
              {showTimerForm ? 'Cancel' : 'Add Timer'}
            </button>
          </div>

          {showTimerForm && (
            <form onSubmit={handleSubmitTimer} className="mb-4 p-4 bg-gray-50 rounded">
              <input
                type="text"
                value={timerForm.name}
                onChange={(e) => setTimerForm({ ...timerForm, name: e.target.value })}
                placeholder="Timer name (e.g., Screen Time, Homework)"
                className="w-full px-3 py-2 border rounded-lg mb-3"
                required
              />
              <select
                value={timerForm.personId}
                onChange={(e) => setTimerForm({ ...timerForm, personId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg mb-3"
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
                <label className="block text-sm font-medium mb-1">
                  Default Daily Time
                  <span className="text-xs text-gray-500 ml-2">(used for days without a schedule)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Hours</label>
                    <input
                      type="number"
                      value={timerForm.hours}
                      onChange={(e) =>
                        setTimerForm({ ...timerForm, hours: parseInt(e.target.value) || 0 })
                      }
                      min="0"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                    <input
                      type="number"
                      value={timerForm.minutes}
                      onChange={(e) =>
                        setTimerForm({ ...timerForm, minutes: parseInt(e.target.value) || 0 })
                      }
                      min="0"
                      max="59"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Default Start Time */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Default Start Time (optional)
                  <span className="text-xs text-gray-500 ml-2">(applies to all days unless schedule overrides)</span>
                </label>
                <input
                  type="time"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Timer becomes available at this time each day (24-hour format). Leave empty to start at midnight.
                </p>
              </div>

              {/* Default Expiration Time */}
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">
                  Default Expiration Time (optional)
                  <span className="text-xs text-gray-500 ml-2">(applies to all days unless schedule overrides)</span>
                </label>
                <input
                  type="time"
                  value={defaultExpirationTime}
                  onChange={(e) => setDefaultExpirationTime(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Timer expires at this time each day (24-hour format). Leave empty for no expiration.
                </p>
              </div>

              {/* Schedule Editor */}
              <div className="mb-3 p-4 border rounded-lg bg-white">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Custom Weekly Schedule</label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSchedule(!useSchedule);
                      if (useSchedule) {
                        setSchedules([]);
                        setSelectedDays(new Set());
                      }
                    }}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    {useSchedule ? 'Use default time' : 'Set custom schedule'}
                  </button>
                </div>

                {useSchedule && (
                  <div>
                    <div className="mb-3">
                      <label className="block text-xs text-gray-600 mb-2">Select days:</label>
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
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {getDayName(day)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">Hours</label>
                        <input
                          type="number"
                          value={scheduleHours}
                          onChange={(e) => setScheduleHours(parseInt(e.target.value) || 0)}
                          min="0"
                          placeholder="0"
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-1">Minutes</label>
                        <input
                          type="number"
                          value={scheduleMinutes}
                          onChange={(e) => setScheduleMinutes(parseInt(e.target.value) || 0)}
                          min="0"
                          max="59"
                          placeholder="0"
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 mb-1">
                        Start Time (optional)
                      </label>
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Timer becomes available at this time (24-hour format). Leave empty to start at midnight.
                      </p>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs text-gray-600 mb-1">
                        Expiration Time (optional)
                      </label>
                      <input
                        type="time"
                        value={scheduleExpirationTime}
                        onChange={(e) => setScheduleExpirationTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Timer expires at this time (24-hour format). Leave empty for no expiration.
                      </p>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={handleAddSchedule}
                        disabled={selectedDays.size === 0}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Set Time
                      </button>
                    </div>

                    {schedules.length > 0 && (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700 mb-2">Weekly Schedule:</div>
                        <div className="flex flex-wrap gap-2">
                          {schedules.map((schedule) => (
                            <div
                              key={schedule.dayOfWeek}
                              className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-200 rounded"
                            >
                              <span className="font-medium">{getDayName(schedule.dayOfWeek)}:</span>
                              <span>{formatTime(schedule.seconds)}</span>
                              {(schedule.startTime || schedule.expirationTime) && (
                                <span className="text-xs text-blue-600">
                                  ({schedule.startTime || '00:00'} - {schedule.expirationTime || '23:59'})
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveScheduleDay(schedule.dayOfWeek)}
                                className="text-red-600 hover:text-red-800 ml-1"
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

          <div className="space-y-2">
            {timers.map((timer) => (
              <div key={timer.id} className="p-3 bg-gray-50 rounded">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-medium">{timer.name}</div>
                    <div className="text-sm text-gray-600">
                      {timer.person?.name} • Default: {formatTime(timer.defaultDailySeconds)}
                      {(timer.defaultStartTime || timer.defaultExpirationTime) && (
                        <> • Window: {timer.defaultStartTime || '00:00'} - {timer.defaultExpirationTime || '23:59'}</>
                      )}
                      {timer.todayAllocation && (
                        <> • Today: {formatTime(timer.todayAllocation.totalSeconds)}</>
                      )}
                    </div>
                    {timer.schedules && timer.schedules.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditTimer(timer)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTimer(timer.id, timer.name)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {timer.todayAllocation && (
                  <div className="flex gap-1 pt-2 border-t border-gray-200">
                    <span className="text-xs text-gray-500 self-center mr-2">Quick adjust:</span>
                    <button
                      onClick={() => handleAdjustTime(timer, -10)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      -10m
                    </button>
                    <button
                      onClick={() => handleAdjustTime(timer, -5)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      -5m
                    </button>
                    <button
                      onClick={() => handleAdjustTime(timer, -1)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      -1m
                    </button>
                    <button
                      onClick={() => handleAdjustTime(timer, 1)}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      +1m
                    </button>
                    <button
                      onClick={() => handleAdjustTime(timer, 5)}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      +5m
                    </button>
                    <button
                      onClick={() => handleAdjustTime(timer, 10)}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded"
                      disabled={updateAllocationMutation.isPending}
                    >
                      +10m
                    </button>
                  </div>
                )}
              </div>
            ))}
            {timers.length === 0 && (
              <p className="text-gray-500 text-center py-4">No timers yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Settings</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <div className="flex gap-2">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg"
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
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This affects timer availability times and day calculations. Current: {settings?.timezone || 'UTC'}
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTimer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Delete Timer</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the timer "<strong>{deletingTimer.name}</strong>"? 
              This action cannot be undone and will also delete all associated data.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDeleteTimer}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
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
