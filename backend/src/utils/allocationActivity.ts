import { prisma } from '../index';
import { getTimerAvailability } from './timerExpiration';
import { forceStopExpiredCheckouts } from './timerExpiration';

export interface AllocationActiveResult {
  active: boolean;
  reason?: 'before_start' | 'after_expiration';
}

/**
 * Compute the active state for an allocation based on manualOverride and natural availability.
 * Uses getTimerAvailability (timezone-aware) for start/expiration checks.
 */
export async function computeAllocationActive(allocationId: string): Promise<AllocationActiveResult> {
  const allocation = await prisma.dailyAllocation.findUnique({
    where: { id: allocationId },
    include: {
      timer: {
        include: {
          schedules: true,
        },
      },
      checkouts: {
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      },
    },
  });

  if (!allocation) {
    return { active: true };
  }

  const manualOverride = allocation.manualOverride as 'active' | 'expired' | null;
  const timerId = allocation.timerId;

  const availability = await getTimerAvailability(timerId);

  // manualOverride === 'expired' → active = false
  if (manualOverride === 'expired') {
    return { active: false, reason: availability.reason };
  }

  // Past expiration time → active = false. Only force-stop if there's an active session.
  if (availability.reason === 'after_expiration') {
    if (allocation.checkouts.length > 0) {
      await forceStopExpiredCheckouts(timerId);
    }
    return { active: false, reason: 'after_expiration' };
  }

  // manualOverride === 'active' and before start → active = true
  if (availability.reason === 'before_start' && manualOverride === 'active') {
    return { active: true };
  }

  // Else use natural availability
  return {
    active: availability.available,
    reason: availability.reason,
  };
}
