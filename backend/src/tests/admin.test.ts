import { describe, it, expect } from 'vitest';
import { testRequest, setupAdmin } from './helpers';

describe('Admin API', () => {
  describe('GET /api/admin/settings', () => {
    it('should return settings with hasPinConfigured false when no PIN is set', async () => {
      const res = await testRequest.get('/api/admin/settings');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasPinConfigured', false);
      expect(res.body).toHaveProperty('timezone', 'UTC');
    });

    it('should return settings with hasPinConfigured true when PIN is set', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest.get('/api/admin/settings');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasPinConfigured', true);
    });
  });

  describe('POST /api/admin/set-pin', () => {
    it('should set initial PIN when no PIN exists', async () => {
      const res = await testRequest
        .post('/api/admin/set-pin')
        .send({ newPin: '1234' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should require current PIN when changing existing PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .post('/api/admin/set-pin')
        .send({ newPin: '5678' });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Current PIN required');
    });

    it('should change PIN with correct current PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .post('/api/admin/set-pin')
        .send({ currentPin: '1234', newPin: '5678' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('should reject incorrect current PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .post('/api/admin/set-pin')
        .send({ currentPin: 'wrong', newPin: '5678' });
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid current PIN');
    });
  });

  describe('POST /api/admin/verify-pin', () => {
    it('should verify correct PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .post('/api/admin/verify-pin')
        .send({ pin: '1234' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid', true);
    });

    it('should reject incorrect PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .post('/api/admin/verify-pin')
        .send({ pin: 'wrong' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('valid', false);
    });

    it('should return error when no PIN is set', async () => {
      const res = await testRequest
        .post('/api/admin/verify-pin')
        .send({ pin: '1234' });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'PIN not configured');
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('should update timezone with valid PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .put('/api/admin/settings')
        .set('X-Admin-PIN', '1234')
        .send({ timezone: 'America/Los_Angeles' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timezone', 'America/Los_Angeles');
    });

    it('should persist timezone and return it on GET settings', async () => {
      await setupAdmin('1234');
      await testRequest
        .put('/api/admin/settings')
        .set('X-Admin-PIN', '1234')
        .send({ timezone: 'America/Chicago' });

      const res = await testRequest.get('/api/admin/settings');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timezone', 'America/Chicago');
    });

    it('should support UTC timezone', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .put('/api/admin/settings')
        .set('X-Admin-PIN', '1234')
        .send({ timezone: 'UTC' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timezone', 'UTC');
    });

    it('should support Europe/London timezone', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .put('/api/admin/settings')
        .set('X-Admin-PIN', '1234')
        .send({ timezone: 'Europe/London' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timezone', 'Europe/London');
    });

    it('should reject without admin PIN', async () => {
      await setupAdmin('1234');
      
      const res = await testRequest
        .put('/api/admin/settings')
        .send({ timezone: 'America/Los_Angeles' });
      
      expect(res.status).toBe(401);
    });
  });
});
