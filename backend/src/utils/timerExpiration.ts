import { prisma } from '../index';
import { getDayOfWeek, getCurrentTime } from './dateTime';

// Check if a timer is available based on start and expiration times
export async function getTimerAvailability(timerId: string): Promise<{
  available: boolean;
  reason?: 'before_start' | 'after_expiration';
}> {
  const dayOfWeek = await getDayOfWeek(new Date());
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
          const durationSeconds = Math.floor(
            (now.getTime() - activeEntry.startTime.getTime()) / 1000
          );

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
