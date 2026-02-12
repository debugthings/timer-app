import { prisma } from '../index';
import { getDayOfWeek, getCurrentTime, getStartOfDay } from './dateTime';

// Check if a timer is available based on start and expiration times (timezone-aware)
export async function getTimerAvailability(timerId: string): Promise<{
  available: boolean;
  reason?: 'before_start' | 'after_expiration';
}> {
  const today = await getStartOfDay();
  const dayOfWeek = getDayOfWeek(today);
  const currentTime = await getCurrentTime();
  
  // Get the timer with its schedule for today
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: {
      schedules: {
        where: {
          dayOfWeek,
        },
      },
    },
  });
  
  if (!timer) {
    return { available: true };
  }
  
  // Check schedule-specific times first, then fall back to defaults
  const schedule = timer.schedules[0];
  const startTime = schedule?.startTime || timer.defaultStartTime;
  const expirationTime = schedule?.expirationTime || timer.defaultExpirationTime;
  
  // Check if before start time
  if (startTime && currentTime < startTime) {
    return { available: false, reason: 'before_start' };
  }
  
  // Check if after expiration time
  if (expirationTime && currentTime >= expirationTime) {
    return { available: false, reason: 'after_expiration' };
  }
  
  return { available: true };
}

// Check if a timer is expired based on its schedule (backward compatibility)
export async function isTimerExpired(timerId: string): Promise<boolean> {
  const availability = await getTimerAvailability(timerId);
  return availability.reason === 'after_expiration';
}

// Force stop all active checkouts for an expired timer (uses transaction)
export async function forceStopExpiredCheckouts(timerId: string): Promise<void> {
  const activeCheckouts = await prisma.checkout.findMany({
    where: {
      timerId,
      status: {
        in: ['ACTIVE', 'PAUSED'],
      },
    },
    include: {
      entries: {
        where: {
          endTime: null,
        },
      },
    },
  });

  // Process all checkouts in a single transaction
  if (activeCheckouts.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const checkout of activeCheckouts) {
        let totalUsedSeconds = checkout.usedSeconds;
        let additionalSeconds = 0;

        // End any active time entry
        if (checkout.entries.length > 0) {
          const activeEntry = checkout.entries[0];
          const now = new Date();
          const actualDurationSeconds = Math.floor(
            (now.getTime() - activeEntry.startTime.getTime()) / 1000
          );

          // Cap duration at remaining allocated time to prevent overrun
          const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
          const durationSeconds = Math.min(actualDurationSeconds, remainingSeconds);

          await tx.timeEntry.update({
            where: { id: activeEntry.id },
            data: {
              endTime: now,
              durationSeconds,
            },
          });

          totalUsedSeconds += durationSeconds;
          additionalSeconds = durationSeconds;
        }

        // Cap total used seconds at allocated amount
        totalUsedSeconds = Math.min(totalUsedSeconds, checkout.allocatedSeconds);

        // Update allocation with used time
        if (additionalSeconds > 0) {
          await tx.dailyAllocation.update({
            where: { id: checkout.allocationId },
            data: {
              usedSeconds: {
                increment: additionalSeconds,
              },
            },
          });
        }

        // Mark checkout as cancelled
        await tx.checkout.update({
          where: { id: checkout.id },
          data: {
            usedSeconds: totalUsedSeconds,
            status: 'CANCELLED',
          },
        });
      }
    });
  }
}

/**
 * Complete checkouts that have run out of allocated time (used when UI is disconnected).
 * Runs independently of requests - call from background job.
 */
export async function completeCheckoutsThatRanOutOfTime(): Promise<void> {
  const activeCheckouts = await prisma.checkout.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      entries: {
        where: { endTime: null },
      },
    },
  });

  for (const checkout of activeCheckouts) {
    if (checkout.entries.length === 0) continue;

    const activeEntry = checkout.entries[0];
    const now = new Date();
    const entryElapsed = Math.floor((now.getTime() - activeEntry.startTime.getTime()) / 1000);
    const totalUsedSeconds = checkout.usedSeconds + entryElapsed;

    if (totalUsedSeconds < checkout.allocatedSeconds) continue; // Not yet expired

    await prisma.$transaction(async (tx) => {
      const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
      const durationSeconds = Math.min(entryElapsed, remainingSeconds);

      await tx.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: now,
          durationSeconds,
        },
      });

      const additionalSeconds = Math.min(durationSeconds, remainingSeconds);
      if (additionalSeconds > 0) {
        await tx.dailyAllocation.update({
          where: { id: checkout.allocationId },
          data: {
            usedSeconds: { increment: additionalSeconds },
          },
        });
      }

      await tx.checkout.update({
        where: { id: checkout.id },
        data: {
          usedSeconds: checkout.allocatedSeconds,
          status: 'COMPLETED',
        },
      });
    });
  }
}
