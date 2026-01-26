// Set test environment FIRST, before any imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../index';

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean up database before each test in correct order
  await prisma.timeEntry.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.dailyAllocation.deleteMany();
  await prisma.timerSchedule.deleteMany();
  await prisma.timer.deleteMany();
  await prisma.person.deleteMany();
  await prisma.settings.deleteMany();
});

afterAll(async () => {
  // Final cleanup
  await prisma.timeEntry.deleteMany();
  await prisma.checkout.deleteMany();
  await prisma.dailyAllocation.deleteMany();
  await prisma.timerSchedule.deleteMany();
  await prisma.timer.deleteMany();
  await prisma.person.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.$disconnect();
});
