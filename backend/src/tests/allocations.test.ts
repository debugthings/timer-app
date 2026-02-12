import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, setupAdmin, createTestPerson, createTestTimer, createTestCheckout } from './helpers';

describe('Allocations API', () => {
  let adminPin: string;

  beforeEach(async () => {
    adminPin = await setupAdmin();
  });

  describe('POST /api/allocations/:id/force-active', () => {
    it('should force allocation to active state', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id);
      const checkout = await createTestCheckout(timer.id);
      const allocationId = checkout.allocationId;

      const res = await testRequest
        .post(`/api/allocations/${allocationId}/force-active`)
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('manualOverride', 'active');
      expect(res.body).toHaveProperty('id', allocationId);
    });

    it('should return 401 without admin PIN', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id);
      const checkout = await createTestCheckout(timer.id);
      const allocationId = checkout.allocationId;

      const res = await testRequest
        .post(`/api/allocations/${allocationId}/force-active`);

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent allocation', async () => {
      const res = await testRequest
        .post('/api/allocations/non-existent-uuid-12345/force-active')
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/allocations/:id/force-expired', () => {
    it('should force allocation to expired state', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id);
      const checkout = await createTestCheckout(timer.id);
      const allocationId = checkout.allocationId;

      const res = await testRequest
        .post(`/api/allocations/${allocationId}/force-expired`)
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('manualOverride', 'expired');
      expect(res.body).toHaveProperty('id', allocationId);
    });

    it('should return 401 without admin PIN', async () => {
      const person = await createTestPerson();
      const timer = await createTestTimer(person.id);
      const checkout = await createTestCheckout(timer.id);
      const allocationId = checkout.allocationId;

      const res = await testRequest
        .post(`/api/allocations/${allocationId}/force-expired`);

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent allocation', async () => {
      const res = await testRequest
        .post('/api/allocations/non-existent-uuid-12345/force-expired')
        .set('X-Admin-PIN', adminPin);

      expect(res.status).toBe(500);
    });
  });
});
