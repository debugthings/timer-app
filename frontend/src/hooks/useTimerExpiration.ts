import { useQuery } from '@tanstack/react-query';
import { getTimerCurrent } from '../services/api';

/**
 * Returns whether the timer is expired (allocation.active === false).
 * Used by ActiveTimer on TimerDetail page.
 */
export function useTimerExpiration(timerId: string | undefined): boolean {
  const { data } = useQuery({
    queryKey: ['timer-current', timerId],
    queryFn: () => getTimerCurrent(timerId!),
    enabled: !!timerId,
    refetchInterval: 10000,
  });

  return data?.allocation?.active === false;
}
