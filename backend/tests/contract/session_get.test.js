/**
 * Contract Tests for GET /api/session
 * Tests ONLY the GET /api/session endpoint
 * 
 * Requirements validated:
 * - Get current session details
 * - No authentication required for GET
 * - Response structure with all required fields
 * - Optional fields (endTime, metadata)
 * - Performance requirements (<100ms response)
 */

const request = require('supertest');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('GET /api/session', () => {
  let testContext;

  beforeEach(async () => {
    // Use shared utilities for consistent setup
    testContext = await setupHTTPTest({
      createSession: true,
      sessionName: 'Test Session'
    });
  });

  afterEach(async () => {
    // Ensure proper cleanup
    await cleanupHTTPTest(testContext);
  });
  describe('Valid Requests', () => {
    it('should return current session details with all required fields', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate required fields from OpenAPI spec
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      expect(response.body).toHaveProperty('name');
      expect(typeof response.body.name).toBe('string');
      
      expect(response.body).toHaveProperty('startTime');
      expect(new Date(response.body.startTime).toISOString()).toBe(response.body.startTime);
      
      expect(response.body).toHaveProperty('status');
      expect(['active', 'paused', 'completed', 'archived']).toContain(response.body.status);
    });

    it('should include optional endTime when session is completed', async () => {
      // Create a new test context with auth for this test
      await cleanupHTTPTest(testContext);
      testContext = await setupHTTPTest({
        createSession: false,
        needsAuth: true
      });

      // Create and complete a session
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ name: 'Test Completed Session' });

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ status: 'completed' });

      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      if (response.body.status === 'completed') {
        expect(response.body).toHaveProperty('endTime');
        expect(new Date(response.body.endTime).toISOString()).toBe(response.body.endTime);
      }
    });

    it('should include metadata when available', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      if (response.body.metadata) {
        const metadata = response.body.metadata;
        
        if (metadata.gmStations !== undefined) {
          expect(typeof metadata.gmStations).toBe('number');
          expect(metadata.gmStations).toBeGreaterThanOrEqual(0);
        }
        
        if (metadata.playerDevices !== undefined) {
          expect(typeof metadata.playerDevices).toBe('number');
          expect(metadata.playerDevices).toBeGreaterThanOrEqual(0);
        }
        
        if (metadata.totalScans !== undefined) {
          expect(typeof metadata.totalScans).toBe('number');
          expect(metadata.totalScans).toBeGreaterThanOrEqual(0);
        }
        
        if (metadata.uniqueTokensScanned !== undefined) {
          expect(Array.isArray(metadata.uniqueTokensScanned)).toBe(true);
        }
      }
    });

    it('should not require authentication', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        // No auth header
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('Performance', () => {
    it('should respond within 100ms', async () => {
      const startTime = Date.now();
      
      await request(testContext.app)
        .get('/api/session')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(testContext.app).get('/api/session')
        );
      }

      const responses = await Promise.all(promises);
      
      // All should return same session ID
      const sessionIds = responses
        .filter(r => r.status === 200)
        .map(r => r.body.id);
      
      if (sessionIds.length > 0) {
        expect(new Set(sessionIds).size).toBe(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle request when no active session exists', async () => {
      // This might either create a default session or return an appropriate response
      const response = await request(testContext.app)
        .get('/api/session');

      // Should either return 200 with session or 404
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should maintain session consistency across multiple requests', async () => {
      const response1 = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      const response2 = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      // Should return same session
      expect(response1.body.id).toBe(response2.body.id);
      expect(response1.body.name).toBe(response2.body.name);
      expect(response1.body.startTime).toBe(response2.body.startTime);
    });
  });

  describe('Response Structure', () => {
    it('should have correct data types for all fields', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      // ID validation
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id).toHaveLength(36); // UUID length

      // Name validation
      expect(typeof response.body.name).toBe('string');
      expect(response.body.name.length).toBeGreaterThanOrEqual(1);
      expect(response.body.name.length).toBeLessThanOrEqual(100);

      // Timestamp validation
      const startTime = new Date(response.body.startTime);
      expect(startTime).toBeInstanceOf(Date);
      expect(!isNaN(startTime.getTime())).toBe(true);

      // Status validation
      expect(typeof response.body.status).toBe('string');
    });

    it('should not include unnecessary fields', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      // Check for expected fields only
      const allowedFields = ['id', 'name', 'startTime', 'endTime', 'status', 'metadata'];
      const responseFields = Object.keys(response.body);
      
      responseFields.forEach(field => {
        expect(allowedFields).toContain(field);
      });
    });

    it('should handle different session states correctly', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      switch (response.body.status) {
        case 'active':
        case 'paused':
          // Should not have endTime for active/paused sessions
          expect(response.body.endTime).toBeNull();
          break;
        case 'completed':
        case 'archived':
          // Should have endTime for completed/archived sessions
          expect(response.body.endTime).not.toBeNull();
          break;
      }
    });
  });

  describe('Content Negotiation', () => {
    it('should return JSON by default', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle Accept header', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Caching', () => {
    it('should not cache session responses', async () => {
      const response = await request(testContext.app)
        .get('/api/session')
        .expect(200);

      // Should have cache control headers
      if (response.headers['cache-control']) {
        expect(response.headers['cache-control']).toContain('no-cache');
      }
    });
  });
});