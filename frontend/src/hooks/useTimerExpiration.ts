import { useEffect, useState } from 'react';
import axios from 'axios';

export interface TimerAvailability {
  available: boolean;
  reason?: 'before_start' | 'after_expiration';
  expired: boolean; // Backward compatibility
  forceExpired?: boolean; // Whether timer was forcibly expired by admin
}

export function useTimerAvailability(timerId: string | undefined): TimerAvailability {
  const [availability, setAvailability] = useState<TimerAvailability>({
    available: true,
    reason: undefined,
    expired: false,
  });

  useEffect(() => {
    if (!timerId) return;

    const checkAvailability = async () => {
      try {
        const response = await axios.get(`/api/timers/${timerId}/expiration`);
        setAvailability({
          available: response.data.available ?? true,
          reason: response.data.reason,
          expired: response.data.expired ?? false,
          forceExpired: response.data.forceExpired ?? false,
        });
      } catch (error) {
        console.error('Failed to check availability:', error);
      }
    };

    // Check immediately
    checkAvailability();

    // Check every minute
    const interval = setInterval(checkAvailability, 60000);

    return () => clearInterval(interval);
  }, [timerId]);

  return availability;
}

// Backward compatibility - returns just the expired flag
export function useTimerExpiration(timerId: string | undefined): boolean {
  const availability = useTimerAvailability(timerId);
  return availability.expired;
}
