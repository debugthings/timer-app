import { describe, it, expect, beforeEach } from 'vitest';
import { setupAdmin, createTestPerson, createTestTimer, createTestCheckout, prisma } from './helpers';
import { completeCheckoutsThatRanOutOfTime } from '../utils/timerExpiration';

describe('Expiration Job', () => {
  beforeEach(async () => {
    await setupAdmin();
  });

  describe('completeCheckoutsThatRanOutOfTime', () => {
    it('should complete ACTIVE checkout when allocated time has run out', async () => {
      const person = await createTestPerson('Test');
      const timer = await createTestTimer(person.id, { defaultDailySeconds: 3600 });
      const checkout = await createTestCheckout(timer.id, { allocatedSeconds: 60, status: 'ACTIVE' });

      // Start the checkout with a time entry from 2 minutes ago (so we've "used" 120 seconds)
      const twoMinutesAgo = new Date(Date.now() - 120 * 1000);
      await prisma.timeEntry.create({
        data: {
          checkoutId: checkout.id,
          startTime: twoMinutesAgo,
        },
      });

      await prisma.checkout.update({
        where: { id: checkout.id },
        data: { status: 'ACTIVE' },
      });

      await completeCheckoutsThatRanOutOfTime();

      const updated = await prisma.checkout.findUnique({
        where: { id: checkout.id },
        include: { entries: true },
      });

      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.usedSeconds).toBe(60);
      expect(updated?.entries.every((e) => e.endTime !== null)).toBe(true);
    });

    it('should not complete checkout when time has not run out', async () => {
      const person = await createTestPerson('Test');
      const timer = await createTestTimer(person.id, { defaultDailySeconds: 3600 });
      const checkout = await createTestCheckout(timer.id, { allocatedSeconds: 3600, status: 'ACTIVE' });

      // Start with entry from 10 seconds ago
      const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
      await prisma.timeEntry.create({
        data: {
          checkoutId: checkout.id,
          startTime: tenSecondsAgo,
        },
      });

      await prisma.checkout.update({
        where: { id: checkout.id },
        data: { status: 'ACTIVE' },
      });

      await completeCheckoutsThatRanOutOfTime();

      const updated = await prisma.checkout.findUnique({
        where: { id: checkout.id },
      });

      expect(updated?.status).toBe('ACTIVE');
    });
  });
});
