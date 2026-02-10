import { useGlobalAlarm } from '../hooks/useGlobalAlarm';

export function AlarmBanner() {
  const { alarmState, acknowledgeAlarm } = useGlobalAlarm();

  if (!alarmState?.isActive) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-red-600 text-white px-4 py-3 shadow-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl shrink-0">⏰</span>
        <span className="font-semibold truncate">
          {alarmState.timerName} - {alarmState.reason === 'completed' ? "Time's Up!" : 'Timer Expired'}
        </span>
      </div>
      <button
        onClick={acknowledgeAlarm}
        className="px-4 py-2 bg-white dark:bg-gray-100 text-red-600 dark:text-red-700 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-gray-200 transition-colors shrink-0"
      >
        Acknowledge
      </button>
    </div>
  );
}
