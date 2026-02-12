import { useEffect, useState } from 'react';
import { getTimerExpiration } from '../services/api';

export interface TimerAvailability {
  available: boolean;
  reason?: 'before_start' | 'after_expiration';
  expired: boolean; // Backward compatibility
  forceExpired?: boolean; // Whether timer was forcibly expired by admin
  forceActive?: boolean; // Whether timer was forcibly activated by admin
}

export interface UseTimerAvailabilityOptions {
  /** Poll more frequently when timer has expiration time (default: 60000ms) */
  pollIntervalMs?: number;
}

export function useTimerAvailability(timerId: string | undefined, options?: UseTimerAvailabilityOptions): TimerAvailability {
  const pollIntervalMs = options?.pollIntervalMs ?? 60000;
  const [availability, setAvailability] = useState<TimerAvailability>({
    available: true,
    reason: undefined,
    expired: false,
  });

  useEffect(() => {
    if (!timerId) return;

    const checkAvailability = async () => {
      try {
        const data = await getTimerExpiration(timerId);
        setAvailability({
          available: data.available ?? true,
          reason: data.reason,
          expired: data.expired ?? false,
          forceExpired: data.forceExpired ?? false,
          forceActive: data.forceActive ?? false,
        });
      } catch (error) {
        console.error('Failed to check availability:', error);
      }
    };

    // Check immediately
    checkAvailability();

    const interval = setInterval(checkAvailability, pollIntervalMs);

    return () => clearInterval(interval);
  }, [timerId, pollIntervalMs]);

  return availability;
}

// Backward compatibility - returns just the expired flag
export function useTimerExpiration(timerId: string | undefined): boolean {
  const availability = useTimerAvailability(timerId);
  return availability.expired;
}
