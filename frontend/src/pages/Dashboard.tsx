import { useQuery } from '@tanstack/react-query';
import { getPeople, getTimers } from '../services/api';
import { TimerCard } from '../components/Timer/TimerCard';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { data: people = [], isLoading: loadingPeople } = useQuery({
    queryKey: ['people'],
    queryFn: getPeople,
  });

  const { data: timers = [], isLoading: loadingTimers } = useQuery({
    queryKey: ['timers'],
    queryFn: getTimers,
    refetchInterval: 5000, // Refetch every 5 seconds to keep cards updated
  });

  const isLoading = loadingPeople || loadingTimers;

  // Group timers by person
  const timersByPerson = timers.reduce((acc, timer) => {
    const personId = timer.personId;
    if (!acc[personId]) {
      acc[personId] = [];
    }
    acc[personId].push(timer);
    return acc;
  }, {} as Record<string, typeof timers>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Daily Timers</h1>
          <Link
            to="/admin"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Admin Panel
          </Link>
        </div>

        {people.length === 0 || timers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="max-w-md mx-auto">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 mb-4"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {people.length === 0 ? 'No people yet' : 'No timers yet'}
              </h2>
              <p className="text-gray-600 mb-6">
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
                <h2 className="text-2xl font-bold mb-4">{person.name}</h2>
                <div className="space-y-4">
                  {personTimers.map((timer) => (
                    <TimerCard key={timer.id} timer={timer} />
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
