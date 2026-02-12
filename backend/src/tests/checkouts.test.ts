import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, setupAdmin, createTestPerson, createTestTimer, createTestCheckout, prisma } from './helpers';

describe('Checkouts API', () => {
  let adminPin: string;
  let testPersonId: string;
  let testTimerId: string;

  beforeEach(async () => {
    adminPin = await setupAdmin();
    const person = await createTestPerson('Test Person');
    testPersonId = person.id;
    const timer = await createTestTimer(testPersonId, {
      name: 'Test Timer',
      defaultDailySeconds: 3600,
    });
    testTimerId = timer.id;
  });

  describe('POST /api/checkouts', () => {
    it('should create a new checkout', async () => {
      const res = await testRequest
        .post('/api/checkouts')
        .send({
          timerId: testTimerId,
          allocatedSeconds: 1800, // 30 minutes
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timerId', testTimerId);
      expect(res.body).toHaveProperty('allocatedSeconds', 1800);
      expect(res.body).toHaveProperty('status', 'ACTIVE');
    });

    it('should reject checkout if not enough time remaining', async () => {
      // Create first checkout using most of the time
      await testRequest
        .post('/api/checkouts')
        .send({
          timerId: testTimerId,
          allocatedSeconds: 3000,
        });
      
      // Try to create second checkout exceeding remaining time
      const res = await testRequest
        .post('/api/checkouts')
        .send({
          timerId: testTimerId,
          allocatedSeconds: 1000, // Would exceed 3600 total
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Not enough time remaining');
    });

    it('should require timerId and allocatedSeconds', async () => {
      const res = await testRequest
        .post('/api/checkouts')
        .send({});
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/checkouts/:id/start', () => {
    it('should start a checkout timer', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/start`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('startTime');
      expect(res.body.endTime).toBeNull();
    });

    it('should reject starting already running checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Start it first
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      
      // Try to start again
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/start`);
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already running');
    });

    it('should reject starting completed checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'COMPLETED' });
      
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/start`);
      
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent checkout', async () => {
      const res = await testRequest
        .post('/api/checkouts/non-existent-id/start');
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/checkouts/:id/pause', () => {
    it('should pause a running checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Start first
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      
      // Wait a bit to accumulate some time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then pause
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/pause`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'PAUSED');
    });

    it('should complete (not pause) when time runs out', async () => {
      const checkout = await createTestCheckout(testTimerId, { allocatedSeconds: 1, status: 'ACTIVE' });
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for time to run out
      const res = await testRequest.post(`/api/checkouts/${checkout.id}/pause`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'COMPLETED');
    });

    it('should reject pausing non-running checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Try to pause without starting
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/pause`);
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/checkouts/:id/stop', () => {
    it('should stop a checkout and mark as completed', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/stop`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'COMPLETED');
    });

    it('should stop a running checkout and record time', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Start first
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then stop
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/stop`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'COMPLETED');
    });

    it('should reject stopping already completed checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'COMPLETED' });
      
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/stop`);
      
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/checkouts/:id/cancel', () => {
    it('should cancel a checkout', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/cancel`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'CANCELLED');
    });

    it('should cancel a running checkout and record time', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Start first
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then cancel
      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/cancel`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'CANCELLED');
    });
  });

  describe('POST /api/checkouts/:id/force-active', () => {
    it('should force checkout to active state (admin only)', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'PAUSED' });

      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/force-active`)
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ACTIVE');
    });

    it('should return 401 without admin PIN', async () => {
      const checkout = await createTestCheckout(testTimerId);

      const res = await testRequest.post(`/api/checkouts/${checkout.id}/force-active`);

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent checkout', async () => {
      const res = await testRequest
        .post('/api/checkouts/non-existent-uuid/force-active')
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/checkouts/:id/force-expired', () => {
    it('should force checkout to expired/completed state (admin only)', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);

      const res = await testRequest
        .post(`/api/checkouts/${checkout.id}/force-expired`)
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'COMPLETED');
    });

    it('should return 401 without admin PIN', async () => {
      const checkout = await createTestCheckout(testTimerId);

      const res = await testRequest.post(`/api/checkouts/${checkout.id}/force-expired`);

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent checkout', async () => {
      const res = await testRequest
        .post('/api/checkouts/non-existent-uuid/force-expired')
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(404);
    });
  });

  describe('Transactional integrity', () => {
    it('should maintain data consistency on concurrent operations', async () => {
      const checkout = await createTestCheckout(testTimerId, {
        allocatedSeconds: 100,
        status: 'ACTIVE',
      });
      
      // Start the timer
      await testRequest.post(`/api/checkouts/${checkout.id}/start`);
      
      // Simulate concurrent pause requests
      const pausePromises = [
        testRequest.post(`/api/checkouts/${checkout.id}/pause`),
        testRequest.post(`/api/checkouts/${checkout.id}/pause`),
      ];
      
      const results = await Promise.all(pausePromises);
      
      // One should succeed, one should fail
      const successCount = results.filter(r => r.status === 200).length;
      const failCount = results.filter(r => r.status === 400).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      
      // Verify final state is consistent
      const finalCheckout = await prisma.checkout.findUnique({
        where: { id: checkout.id },
        include: { entries: true },
      });
      
      expect(finalCheckout?.status).toBe('PAUSED');
      // Should have exactly one time entry
      expect(finalCheckout?.entries.length).toBe(1);
    });

    it('should not create duplicate time entries on rapid start requests', async () => {
      const checkout = await createTestCheckout(testTimerId, { status: 'ACTIVE' });
      
      // Simulate rapid start requests
      const startPromises = [
        testRequest.post(`/api/checkouts/${checkout.id}/start`),
        testRequest.post(`/api/checkouts/${checkout.id}/start`),
        testRequest.post(`/api/checkouts/${checkout.id}/start`),
      ];
      
      await Promise.all(startPromises);
      
      // Verify only one time entry was created
      const entries = await prisma.timeEntry.findMany({
        where: { checkoutId: checkout.id },
      });
      
      expect(entries.length).toBe(1);
    });
  });
});
