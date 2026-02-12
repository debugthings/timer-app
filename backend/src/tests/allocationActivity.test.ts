import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupAdmin,
  createTestPerson,
  createTestTimer,
  createTestCheckout,
  prisma,
  setTestTime,
  restoreTestTime,
  setTestTimezone,
  MONDAY_FEB_9_2026,
} from './helpers';
import { computeAllocationActive } from '../utils/allocationActivity';

describe('Allocation Activity', () => {
  beforeEach(async () => {
    await setupAdmin('1234', 'America/New_York');
    await setTestTimezone('America/New_York');
  });

  afterEach(() => {
    restoreTestTime();
  });

  describe('computeAllocationActive', () => {
    it('should return active: true when manualOverride is active and before start time', async () => {
      // 10:00 AM Monday Feb 9, 2026 (before 12:00 start)
      setTestTime('2026-02-09T15:00:00.000Z');

      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        schedules: [
          {
            dayOfWeek: 1, // Monday
            seconds: 3600,
            startTime: '12:00',
            expirationTime: '18:00',
          },
        ],
      });
      const checkout = await createTestCheckout(timer.id);
      await prisma.dailyAllocation.update({
        where: { id: checkout.allocationId },
        data: { manualOverride: 'active' },
      });

      const result = await computeAllocationActive(checkout.allocationId);

      expect(result.active).toBe(true);
    });

    it('should return active: false when manualOverride is expired', async () => {
      setTestTime('2026-02-09T15:00:00.000Z');

      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        schedules: [
          {
            dayOfWeek: 1,
            seconds: 3600,
            startTime: '12:00',
            expirationTime: '18:00',
          },
        ],
      });
      const checkout = await createTestCheckout(timer.id);
      await prisma.dailyAllocation.update({
        where: { id: checkout.allocationId },
        data: { manualOverride: 'expired' },
      });

      const result = await computeAllocationActive(checkout.allocationId);

      expect(result.active).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should return active: false when after expiration time', async () => {
      // 8:00 PM Monday Feb 9, 2026 (after 18:00 expiration)
      setTestTime('2026-02-10T01:00:00.000Z');

      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        schedules: [
          {
            dayOfWeek: 1,
            seconds: 3600,
            startTime: '12:00',
            expirationTime: '18:00',
          },
        ],
      });
      const checkout = await createTestCheckout(timer.id);

      const result = await computeAllocationActive(checkout.allocationId);

      expect(result.active).toBe(false);
      expect(result.reason).toBe('after_expiration');
    });

    it('should return active: true when within available window (no override)', async () => {
      // 2:00 PM Monday Feb 9, 2026 (between 12:00 and 18:00)
      setTestTime('2026-02-09T19:00:00.000Z');

      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        schedules: [
          {
            dayOfWeek: 1,
            seconds: 3600,
            startTime: '12:00',
            expirationTime: '18:00',
          },
        ],
      });
      const checkout = await createTestCheckout(timer.id);

      const result = await computeAllocationActive(checkout.allocationId);

      expect(result.active).toBe(true);
    });
  });
});
