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
} from './helpers';
import { getTimerAvailability, forceStopExpiredCheckouts } from '../utils/timerExpiration';

describe('Timer Expiration', () => {
  beforeEach(async () => {
    await setupAdmin('1234', 'America/New_York');
    await setTestTimezone('America/New_York');
  });

  afterEach(() => {
    restoreTestTime();
  });

  describe('getTimerAvailability', () => {
    it('should return available: false, reason before_start when before start time', async () => {
      // 10:00 AM Monday Feb 9, 2026
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

      const result = await getTimerAvailability(timer.id);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('before_start');
    });

    it('should return available: false, reason after_expiration when after expiration time', async () => {
      // 8:00 PM Monday Feb 9, 2026
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

      const result = await getTimerAvailability(timer.id);

      expect(result.available).toBe(false);
      expect(result.reason).toBe('after_expiration');
    });

    it('should return available: true when within time window', async () => {
      // 2:00 PM Monday Feb 9, 2026
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

      const result = await getTimerAvailability(timer.id);

      expect(result.available).toBe(true);
    });

    it('should return available: true for non-existent timer', async () => {
      const result = await getTimerAvailability('non-existent-uuid');

      expect(result.available).toBe(true);
    });
  });

  describe('forceStopExpiredCheckouts', () => {
    it('should cancel active checkouts when timer is expired', async () => {
      // Start at 2 PM (within window), create active checkout, then move to 8 PM (expired)
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
      const checkout = await createTestCheckout(timer.id, { status: 'ACTIVE' });
      const fiveMinutesAgo = new Date('2026-02-09T18:55:00.000Z');
      await prisma.timeEntry.create({
        data: {
          checkoutId: checkout.id,
          startTime: fiveMinutesAgo,
        },
      });

      // Move time to 8 PM (after expiration)
      setTestTime('2026-02-10T01:00:00.000Z');

      await forceStopExpiredCheckouts(timer.id);

      const updated = await prisma.checkout.findUnique({
        where: { id: checkout.id },
        include: { entries: true },
      });

      expect(updated?.status).toBe('CANCELLED');
      expect(updated?.entries.every((e) => e.endTime !== null)).toBe(true);
    });
  });
});
