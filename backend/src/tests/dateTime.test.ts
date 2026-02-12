import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import {
  setupAdmin,
  createTestPerson,
  createTestTimer,
  prisma,
  setTestTimezone,
} from './helpers';
import { getStartOfDay, getDayOfWeek, getSecondsForDay } from '../utils/dateTime';

describe('DateTime Utils', () => {
  beforeEach(async () => {
    await setupAdmin('1234', 'America/New_York');
    await setTestTimezone('America/New_York');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStartOfDay', () => {
    it('should return start of day in configured timezone', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date('2026-02-09T19:30:00.000Z')); // 2:30 PM Eastern

      const result = await getStartOfDay();

      expect(result).toEqual(new Date('2026-02-09T00:00:00.000Z'));
    });

    it('should handle date parameter for specific day', async () => {
      const date = new Date('2026-02-15T14:00:00.000Z');
      const result = await getStartOfDay(date);

      expect(result).toEqual(new Date('2026-02-15T00:00:00.000Z'));
    });
  });

  describe('getDayOfWeek', () => {
    it('should return 0 for Sunday', () => {
      const date = new Date('2026-02-08T12:00:00.000Z'); // Sunday
      expect(getDayOfWeek(date)).toBe(0);
    });

    it('should return 1 for Monday', () => {
      const date = new Date('2026-02-09T12:00:00.000Z'); // Monday
      expect(getDayOfWeek(date)).toBe(1);
    });

    it('should return 6 for Saturday', () => {
      const date = new Date('2026-02-07T12:00:00.000Z'); // Saturday
      expect(getDayOfWeek(date)).toBe(6);
    });
  });

  describe('getSecondsForDay', () => {
    it('should return schedule seconds when schedule exists for day', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        schedules: [
          { dayOfWeek: 1, seconds: 7200 },
          { dayOfWeek: 2, seconds: 5400 },
        ],
      });
      const monday = new Date('2026-02-09T12:00:00.000Z');
      const tuesday = new Date('2026-02-10T12:00:00.000Z');

      const mondaySeconds = await getSecondsForDay(timer.id, monday);
      const tuesdaySeconds = await getSecondsForDay(timer.id, tuesday);

      expect(mondaySeconds).toBe(7200);
      expect(tuesdaySeconds).toBe(5400);
    });

    it('should return defaultDailySeconds when no schedule for day', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id, {
        defaultDailySeconds: 3600,
        schedules: [{ dayOfWeek: 1, seconds: 7200 }],
      });
      const wednesday = new Date('2026-02-11T12:00:00.000Z'); // No schedule

      const result = await getSecondsForDay(timer.id, wednesday);

      expect(result).toBe(3600);
    });
  });
});
