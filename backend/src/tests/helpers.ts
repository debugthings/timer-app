// Environment should already be set by setup.ts
import { vi } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../index';

export const testRequest = request(app);

/** Set fake system time for tests. Use with restoreTestTime() in afterEach. */
export function setTestTime(date: Date | string) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(typeof date === 'string' ? new Date(date) : date);
}

/** Restore real timers after setTestTime(). */
export function restoreTestTime() {
  vi.useRealTimers();
}

/** Monday Feb 9, 2026 10:00 AM America/New_York (15:00 UTC) */
export const MONDAY_FEB_9_2026 = new Date('2026-02-09T15:00:00.000Z');

/** Sunday Feb 8, 2026 10:00 AM America/New_York (15:00 UTC) */
export const SUNDAY_FEB_8_2026 = new Date('2026-02-08T15:00:00.000Z');

/** Saturday Feb 7, 2026 10:00 AM America/New_York (15:00 UTC) */
export const SATURDAY_FEB_7_2026 = new Date('2026-02-07T15:00:00.000Z');

// Helper to create admin settings with a known PIN
export async function setupAdmin(pin: string = '1234', timezone: string = 'America/New_York') {
  const bcrypt = await import('bcrypt');
  const hashedPin = await bcrypt.default.hash(pin, 10);
  await prisma.settings.create({
    data: {
      adminPinHash: hashedPin,
      timezone,
    },
  });
  return pin;
}

// Helper to set timezone for tests (updates existing settings from setupAdmin)
export async function setTestTimezone(timezone: string) {
  await prisma.settings.update({
    where: { id: 1 },
    data: { timezone },
  });
}

// Helper to create a test person
export async function createTestPerson(name: string = 'Test Person') {
  return prisma.person.create({
    data: { name },
  });
}

// Helper to create a test timer
export async function createTestTimer(personId: string, options: {
  name?: string;
  defaultDailySeconds?: number;
  schedules?: Array<{ dayOfWeek: number; seconds: number; expirationTime?: string }>;
} = {}) {
  const {
    name = 'Test Timer',
    defaultDailySeconds = 3600,
    schedules = [],
  } = options;

  return prisma.timer.create({
    data: {
      name,
      personId,
      defaultDailySeconds,
      schedules: schedules.length > 0 ? {
        create: schedules,
      } : undefined,
    },
    include: {
      schedules: true,
    },
  });
}

// Helper to create a test checkout
export async function createTestCheckout(timerId: string, options: {
  allocatedSeconds?: number;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
} = {}) {
  const { allocatedSeconds = 1800, status = 'ACTIVE' } = options;
  
  // Get or create daily allocation
  const timer = await prisma.timer.findUnique({ where: { id: timerId } });
  if (!timer) throw new Error('Timer not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let allocation = await prisma.dailyAllocation.findFirst({
    where: { timerId, date: today },
  });

  if (!allocation) {
    allocation = await prisma.dailyAllocation.create({
      data: {
        timerId,
        date: today,
        totalSeconds: timer.defaultDailySeconds,
        usedSeconds: 0,
      },
    });
  }

  return prisma.checkout.create({
    data: {
      timerId,
      allocationId: allocation.id,
      allocatedSeconds,
      usedSeconds: 0,
      status,
    },
    include: {
      entries: true,
    },
  });
}

// Re-export prisma for direct use in tests
export { prisma };
