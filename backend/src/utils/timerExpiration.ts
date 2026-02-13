import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { getDayOfWeek, getCurrentTime, getStartOfDay } from './dateTime';
import { notifyCheckoutComplete } from './checkoutWebhook';

type TransactionClient = Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>;

/**
 * Shared helper: end an active checkout's time entry, update allocation usedSeconds,
 * and set checkout to final status. Used by forceStopExpiredCheckouts and completeCheckoutsThatRanOutOfTime.
 */
async function endCheckoutWithEntry(
  checkout: {
    id: string;
    allocationId: string;
    allocatedSeconds: number;
    usedSeconds: number;
    entries: Array<{ id: string; startTime: Date }>;
  },
  tx: TransactionClient,
  targetStatus: 'COMPLETED' | 'CANCELLED'
): Promise<void> {
  const now = new Date();
  let additionalSeconds = 0;

  if (checkout.entries.length > 0) {
    const activeEntry = checkout.entries[0];
    const actualDurationSeconds = Math.floor(
      (now.getTime() - activeEntry.startTime.getTime()) / 1000
    );
    const remainingSeconds = checkout.allocatedSeconds - checkout.usedSeconds;
    const durationSeconds = Math.min(actualDurationSeconds, remainingSeconds);

    await tx.timeEntry.update({
      where: { id: activeEntry.id },
      data: {
        endTime: now,
        durationSeconds,
      },
    });

    additionalSeconds = durationSeconds;
  }

  const totalUsedSeconds =
    targetStatus === 'COMPLETED'
      ? checkout.allocatedSeconds
      : Math.min(checkout.usedSeconds + additionalSeconds, checkout.allocatedSeconds);

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
      usedSeconds: totalUsedSeconds,
      status: targetStatus,
    },
  });
}

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

// Force stop all active checkouts for an expired timer (uses transaction).
// When expiration time elapses (including for forced-active allocations), we complete
// the checkouts, record time used, and clear manualOverride on allocations.
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

  if (activeCheckouts.length > 0) {
    const allocationIds = [...new Set(activeCheckouts.map((c) => c.allocationId))];

    await prisma.$transaction(async (tx) => {
      for (const checkout of activeCheckouts) {
        await endCheckoutWithEntry(checkout, tx, 'COMPLETED');
      }
      // Clear forced-active state when expiration elapses
      for (const allocationId of allocationIds) {
        await tx.dailyAllocation.update({
          where: { id: allocationId },
          data: { manualOverride: 'expired' },
        });
      }
    });

    for (const checkout of activeCheckouts) {
      notifyCheckoutComplete(checkout.id);
    }
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
      await endCheckoutWithEntry(checkout, tx, 'COMPLETED');
    });

    notifyCheckoutComplete(checkout.id);
  }
}
