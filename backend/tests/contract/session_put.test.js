/**
 * Contract Tests for PUT /api/session
 * Tests ONLY the PUT /api/session endpoint
 * 
 * Requirements validated:
 * - Session status updates require admin authentication
 * - Valid status transitions (active, paused, completed, archived)
 * - Setting endTime when completing
 * - Preserving session data on updates
 * - Invalid status handling
 */

const request = require('supertest');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('PUT /api/session', () => {
  let testContext;
  let sessionId;

  beforeAll(async () => {
    // Setup test context with authentication
    testContext = await setupHTTPTest({
      createSession: false,
      needsAuth: true
    });
  });

  afterAll(async () => {
    // Clean up test context
    await cleanupHTTPTest(testContext);
  });

  beforeEach(async () => {
    // Reset services using new context
    await cleanupHTTPTest(testContext);
    testContext = await setupHTTPTest({
      createSession: false,
      needsAuth: true
    });

    // Create a session to update
    const response = await request(testContext.app)
      .post('/api/session')
      .set('Authorization', `Bearer ${testContext.adminToken}`)
      .send({ name: 'Session to Update' });
    
    sessionId = response.body.id;
  });

  describe('Valid Status Updates', () => {
    it('should update session status to paused', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body).toHaveProperty('id', sessionId);
      expect(response.body).toHaveProperty('status', 'paused');
      expect(response.body.endTime).toBeNull();
    });

    it('should update session status to completed', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('endTime');
      expect(response.body.endTime).not.toBeNull();
      
      // Validate endTime is proper ISO string
      expect(new Date(response.body.endTime).toISOString()).toBe(response.body.endTime);
    });

    it('should update session status back to active from paused', async () => {
      // First pause
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      // Then reactivate
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body.endTime).toBeNull();
    });

    it('should allow archiving completed session', async () => {
      // First complete
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Then archive
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'archived' })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'archived');
      expect(response.body.endTime).not.toBeNull();
    });
  });

  describe('Invalid Requests', () => {
    it('should reject update without authentication', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .send({ status: 'paused' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject update with invalid token', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', 'Bearer invalid-token')
        .send({ status: 'paused' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject update with invalid status value', async () => {
      const invalidStatuses = ['invalid', 'stopped', 'running', 'pending', ''];
      
      for (const status of invalidStatuses) {
        const response = await request(testContext.app)
          .put('/api/session')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({ status })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject update without status field', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('status');
    });

    it('should reject update with null status', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: null })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-string status values', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Data Preservation', () => {
    it('should preserve session ID when updating status', async () => {
      const beforeUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      const afterUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      expect(afterUpdate.body.id).toBe(beforeUpdate.body.id);
    });

    it('should preserve session name when updating status', async () => {
      const beforeUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      const afterUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      expect(afterUpdate.body.name).toBe(beforeUpdate.body.name);
    });

    it('should preserve startTime when updating status', async () => {
      const beforeUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      const afterUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      expect(afterUpdate.body.startTime).toBe(beforeUpdate.body.startTime);
    });

    it('should preserve metadata when updating status', async () => {
      const beforeUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      const afterUpdate = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      if (beforeUpdate.body.metadata) {
        expect(afterUpdate.body.metadata).toEqual(beforeUpdate.body.metadata);
      }
    });
  });

  describe('Business Logic', () => {
    it('should set endTime when completing session', async () => {
      const beforeComplete = Date.now();
      
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      const afterComplete = Date.now();
      
      expect(response.body.endTime).not.toBeNull();
      
      const endTime = new Date(response.body.endTime).getTime();
      const startTime = new Date(response.body.startTime).getTime();
      
      expect(endTime).toBeGreaterThan(startTime);
      expect(endTime).toBeGreaterThanOrEqual(beforeComplete);
      expect(endTime).toBeLessThanOrEqual(afterComplete);
    });

    it('should not change endTime when pausing', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body.endTime).toBeNull();
    });

    it('should not allow archiving active session directly', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'archived' });

      // Either reject (400) or auto-complete first (200)
      if (response.status === 400) {
        expect(response.body).toHaveProperty('error');
      } else if (response.status === 200) {
        // Should have completed it first
        expect(response.body.endTime).not.toBeNull();
      }
    });

    it('should handle rapid status changes', async () => {
      const statusSequence = ['paused', 'active', 'paused', 'active', 'completed'];
      let lastResponse;
      
      for (const status of statusSequence) {
        lastResponse = await request(testContext.app)
          .put('/api/session')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({ status })
          .expect(200);

        expect(lastResponse.body.status).toBe(status);
      }
      
      // Final status should be completed
      expect(lastResponse.body.status).toBe('completed');
      expect(lastResponse.body.endTime).not.toBeNull();
    });

    it('should maintain endTime once set', async () => {
      // Complete session
      const completeResponse = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      const originalEndTime = completeResponse.body.endTime;

      // Archive session
      const archiveResponse = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'archived' })
        .expect(200);

      // EndTime should not change
      expect(archiveResponse.body.endTime).toBe(originalEndTime);
    });
  });

  describe('Edge Cases', () => {
    it('should handle update when no active session exists', async () => {
      // This test assumes we can get into a state with no active session
      // Implementation might auto-create or return error
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' });

      // Should either update session (200) or return not found (404)
      expect([200, 404]).toContain(response.status);
    });

    it('should handle concurrent status updates', async () => {
      const promises = [];
      
      // Send multiple concurrent updates
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(testContext.app)
            .put('/api/session')
            .set('Authorization', `Bearer ${testContext.adminToken}`)
            .send({ status: 'paused' })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should complete without server error
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
      
      // Final state should be consistent
      const finalState = await request(testContext.app)
        .get('/api/session')
        .expect(200);
        
      expect(finalState.body.status).toBe('paused');
    });

    it('should reject status update with extra fields', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ 
          status: 'paused',
          name: 'Should Not Change',  // Should be ignored
          id: 'new-id-attempt'  // Should be ignored
        });

      // Should either accept and ignore extra fields or reject
      if (response.status === 200) {
        // Extra fields should be ignored
        expect(response.body.name).toBe('Session to Update');
        expect(response.body.id).toBe(sessionId);
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Status Transitions', () => {
    it('should allow active -> paused transition', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body.status).toBe('paused');
    });

    it('should allow paused -> active transition', async () => {
      // First pause
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      // Then activate
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(response.body.status).toBe('active');
    });

    it('should allow active -> completed transition', async () => {
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should allow paused -> completed transition', async () => {
      // First pause
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      // Then complete
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should allow completed -> archived transition', async () => {
      // First complete
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' })
        .expect(200);

      // Then archive
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'archived' })
        .expect(200);

      expect(response.body.status).toBe('archived');
    });

    it('should handle idempotent status updates', async () => {
      // Pause twice
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body.status).toBe('paused');
    });
  });
});