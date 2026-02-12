import { useQuery } from '@tanstack/react-query';
import { getPeople, getTimersCurrent } from '../services/api';
import { TimerCard } from '../components/Timer/TimerCard';
import { ThemeToggle } from '../components/ThemeToggle';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { data: people = [], isLoading: loadingPeople } = useQuery({
    queryKey: ['people'],
    queryFn: getPeople,
  });

  const { data: timersData, isLoading: loadingTimers } = useQuery({
    queryKey: ['timers-current'],
    queryFn: getTimersCurrent,
    refetchInterval: 5000, // Refetch every 5 seconds with all details
  });

  const timersWithCurrent = timersData?.timers ?? [];
  const isLoading = loadingPeople || loadingTimers;

  // Group timers by person
  const timersByPerson = timersWithCurrent.reduce((acc, item) => {
    const personId = item.timer.personId;
    if (!acc[personId]) {
      acc[personId] = [];
    }
    acc[personId].push(item);
    return acc;
  }, {} as Record<string, typeof timersWithCurrent>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Daily Timers</h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/admin"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Admin Panel
            </Link>
          </div>
        </div>

        {people.length === 0 || timersWithCurrent.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {people.length === 0 ? 'No people yet' : 'No timers yet'}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {people.length === 0
                  ? 'Get started by adding people who will use timers, then create timers for them.'
                  : 'Add timers to track daily time allocations for activities.'}
              </p>
              <Link
                to="/admin"
                className="inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                {people.length === 0 ? 'Add Your First Person' : 'Add Your First Timer'}
              </Link>
            </div>
          </div>
        ) : (
          people.map((person) => {
            const personTimers = timersByPerson[person.id] || [];
            if (personTimers.length === 0) return null;

            return (
              <div key={person.id} className="mb-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{person.name}</h2>
                <div className="space-y-4">
                  {personTimers.map(({ timer, allocation }) => (
                    <TimerCard key={timer.id} timer={timer} allocation={allocation} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
