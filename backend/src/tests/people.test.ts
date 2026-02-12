import { describe, it, expect, beforeEach } from 'vitest';
import { testRequest, setupAdmin, createTestPerson, createTestTimer } from './helpers';

describe('People API', () => {
  let adminPin: string;

  beforeEach(async () => {
    adminPin = await setupAdmin();
  });

  describe('GET /api/people', () => {
    it('should return empty array when no people exist', async () => {
      const res = await testRequest.get('/api/people');
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all people with their timers', async () => {
      const person = await createTestPerson('John Doe');
      await createTestTimer(person.id, { name: 'Screen Time' });
      
      const res = await testRequest.get('/api/people');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toHaveProperty('name', 'John Doe');
      expect(res.body[0].timers).toHaveLength(1);
      expect(res.body[0].timers[0]).toHaveProperty('name', 'Screen Time');
    });
  });

  describe('GET /api/people/:id', () => {
    it('should return a person by ID', async () => {
      const person = await createTestPerson('Jane Doe');
      
      const res = await testRequest.get(`/api/people/${person.id}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'Jane Doe');
    });

    it('should return 404 for non-existent person', async () => {
      const res = await testRequest.get('/api/people/non-existent-id');
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/people', () => {
    it('should create a new person with admin PIN', async () => {
      const res = await testRequest
        .post('/api/people')
        .set('X-Admin-PIN', adminPin)
        .send({ name: 'New Person' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'New Person');
      expect(res.body).toHaveProperty('id');
    });

    it('should reject without admin PIN', async () => {
      const res = await testRequest
        .post('/api/people')
        .send({ name: 'New Person' });
      
      expect(res.status).toBe(401);
    });

    it('should require name field', async () => {
      const res = await testRequest
        .post('/api/people')
        .set('X-Admin-PIN', adminPin)
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Name is required');
    });
  });

  describe('PUT /api/people/:id', () => {
    it('should update a person with admin PIN', async () => {
      const person = await createTestPerson('Old Name');
      
      const res = await testRequest
        .put(`/api/people/${person.id}`)
        .set('X-Admin-PIN', adminPin)
        .send({ name: 'New Name' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'New Name');
    });

    it('should handle non-existent person gracefully', async () => {
      const res = await testRequest
        .put('/api/people/non-existent-id')
        .set('X-Admin-PIN', adminPin)
        .send({ name: 'New Name' });
      
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Person not found');
    });
  });

  describe('DELETE /api/people/:id', () => {
    it('should delete a person and their timers with admin PIN', async () => {
      const person = await createTestPerson('To Delete');
      await createTestTimer(person.id, { name: 'Timer to Delete' });
      
      const res = await testRequest
        .delete(`/api/people/${person.id}`)
        .set('X-Admin-PIN', adminPin);
      
      expect(res.status).toBe(200);
      
      // Verify person is deleted
      const checkRes = await testRequest.get(`/api/people/${person.id}`);
      expect(checkRes.status).toBe(404);
    });

    it('should reject without admin PIN', async () => {
      const person = await createTestPerson('To Delete');
      
      const res = await testRequest
        .delete(`/api/people/${person.id}`);
      
      expect(res.status).toBe(401);
    });
  });
});
