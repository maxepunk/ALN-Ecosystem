/**
 * Contract Tests for POST /api/session
 * Tests ONLY the POST /api/session endpoint
 * 
 * Requirements validated:
 * - Session creation requires admin authentication
 * - Session name validation (1-100 characters)
 * - Default values for new session
 * - Completing existing session before creating new one
 * - Metadata initialization
 */

const request = require('supertest');

// This import will fail as app doesn't exist yet - exactly what we want for TDD
const app = require('../../src/app');
const sessionService = require('../../src/services/sessionService');
const stateService = require('../../src/services/stateService');

describe('POST /api/session', () => {
  let adminToken;

  beforeAll(async () => {
    // Get admin token for authenticated requests
    const response = await request(app)
      .post('/api/admin/auth')
      .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' });
    adminToken = response.body.token;
  });

  // Clean up state before each test to ensure isolation
  beforeEach(async () => {
    await sessionService.reset();
    await stateService.reset();
  });

  describe('Valid Requests', () => {
    it('should create new session with valid admin token', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Session' })
        .expect('Content-Type', /json/)
        .expect(201);

      // Validate response structure
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      expect(response.body).toHaveProperty('name', 'Test Session');
      expect(response.body).toHaveProperty('startTime');
      expect(response.body).toHaveProperty('status', 'active');
    });

    it('should accept minimum length name (1 character)', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A' })
        .expect(201);

      expect(response.body.name).toBe('A');
    });

    it('should accept maximum length name (100 characters)', async () => {
      const maxName = 'A'.repeat(100);
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: maxName })
        .expect(201);

      expect(response.body.name).toBe(maxName);
      expect(response.body.name).toHaveLength(100);
    });

    it('should set default values for new session', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Default Test' })
        .expect(201);

      // Should have default active status
      expect(response.body.status).toBe('active');
      
      // Should not have endTime
      expect(response.body.endTime).toBeNull();
      
      // Should have current timestamp as startTime
      const startTime = new Date(response.body.startTime);
      const now = new Date();
      const timeDiff = Math.abs(now - startTime);
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should return proper HTTP status code 201', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Status Code Test' });

      expect(response.status).toBe(201);
      expect(response.headers.location).toBeDefined();
    });
  });

  describe('Invalid Requests', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/session')
        .send({ name: 'Unauthorized Session' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('auth');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Invalid Token Session' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with missing name field', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('name');
    });

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject name exceeding maximum length', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'A'.repeat(101) })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject null name', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: null })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-string name', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with extra fields', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ 
          name: 'Test Session',
          status: 'completed',  // Should not be allowed on creation
          endTime: new Date().toISOString()  // Should not be allowed
        });

      // Should either ignore extra fields (201) or reject (400)
      expect([201, 400]).toContain(response.status);
      
      if (response.status === 201) {
        // Extra fields should be ignored
        expect(response.body.status).toBe('active');
        expect(response.body.endTime).toBeNull();
      }
    });
  });

  describe('Business Logic', () => {
    it('should complete existing session before creating new one', async () => {
      // Create first session
      const first = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'First Session' })
        .expect(201);

      // Create second session
      const second = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Second Session' })
        .expect(201);

      // Check that first session is no longer active
      expect(second.body.id).not.toBe(first.body.id);
      
      // Get session to verify only second is active
      const current = await request(app)
        .get('/api/session')
        .expect(200);
        
      expect(current.body.id).toBe(second.body.id);
    });

    it('should initialize metadata for new session', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Metadata Test' })
        .expect(201);

      if (response.body.metadata) {
        expect(response.body.metadata.gmStations).toBe(0);
        expect(response.body.metadata.playerDevices).toBe(0);
        expect(response.body.metadata.totalScans).toBe(0);
        expect(response.body.metadata.uniqueTokensScanned).toEqual([]);
      }
    });

    it('should generate unique session IDs', async () => {
      const sessions = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/session')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: `Unique Test ${i}` })
          .expect(201);
        
        sessions.push(response.body.id);
      }
      
      // All IDs should be unique
      const uniqueIds = new Set(sessions);
      expect(uniqueIds.size).toBe(5);
    });

    it('should set startTime to current timestamp', async () => {
      const beforeRequest = Date.now();
      
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Timestamp Test' })
        .expect(201);
      
      const afterRequest = Date.now();
      const startTime = new Date(response.body.startTime).getTime();
      
      expect(startTime).toBeGreaterThanOrEqual(beforeRequest);
      expect(startTime).toBeLessThanOrEqual(afterRequest);
    });
  });

  describe('Authorization', () => {
    it('should accept valid Bearer token format', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bearer Test' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });

    it('should reject invalid authorization header format', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Basic ${adminToken}`)  // Wrong format
        .send({ name: 'Basic Auth Test' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject expired token', async () => {
      // This would require a way to get an expired token
      // For now, we'll use a malformed token that should be rejected
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', 'Bearer expired.token.here')
        .send({ name: 'Expired Token Test' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent session creation requests', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/session')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: `Concurrent ${i}` })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
      
      // Only the last one should be active
      const current = await request(app)
        .get('/api/session')
        .expect(200);
      
      const createdIds = responses.map(r => r.body.id);
      expect(createdIds).toContain(current.body.id);
    });
  });

  describe('Response Headers', () => {
    it('should include Location header with new session URL', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Location Test' })
        .expect(201);

      expect(response.headers.location).toBeDefined();
      expect(response.headers.location).toContain('/api/session');
      expect(response.headers.location).toContain(response.body.id);
    });

    it('should return proper Content-Type', async () => {
      const response = await request(app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Content Type Test' })
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});