import { prisma } from '../index';
import { getTimerAvailability, forceStopExpiredCheckouts, completeCheckoutsThatRanOutOfTime } from '../utils/timerExpiration';

const JOB_INTERVAL_MS = 60_000; // Run every 60 seconds

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Process checkouts that need backend updates regardless of UI connection:
 * 1. Complete checkouts where allocated time has run out
 * 2. Force-stop checkouts for timers past end-of-day expiration
 */
async function runExpirationJob(): Promise<void> {
  try {
    // 1. Complete checkouts that ran out of time (time allocated for session expired)
    await completeCheckoutsThatRanOutOfTime();

    // 2. Force-stop checkouts for timers past end-of-day expiration
    const activeCheckouts = await prisma.checkout.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { timerId: true },
      distinct: ['timerId'],
    });

    const timerIds = [...new Set(activeCheckouts.map((c) => c.timerId))];

    for (const timerId of timerIds) {
      const availability = await getTimerAvailability(timerId);
      if (availability.reason === 'after_expiration') {
        await forceStopExpiredCheckouts(timerId);
      }
    }
  } catch (error) {
    console.error('Expiration job error:', error);
  }
}

/**
 * Start the background expiration job. Runs every 60 seconds.
 * Skips in test environment.
 */
export function startExpirationJob(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (intervalId) return;

  runExpirationJob(); // Run immediately on startup
  intervalId = setInterval(runExpirationJob, JOB_INTERVAL_MS);
  console.log('Expiration job started (runs every 60s)');
}

/**
 * Stop the background expiration job (for graceful shutdown).
 */
export function stopExpirationJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Expiration job stopped');
  }
}
