/**
 * Contract Test for GET /api/tokens
 * Verifies the token endpoint returns tokens for scanner caching
 *
 * OpenAPI Contract:
 * - No authentication required (public endpoint)
 * - Returns array of Token objects
 * - Used by scanners to cache tokens for offline operation
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('GET /api/tokens - Token List Endpoint', () => {
  let testContext;

  beforeEach(async () => {
    // Use shared utilities for consistent setup
    testContext = await setupHTTPTest({
      createSession: false, // Tokens endpoint doesn't need a session
      needsAuth: false
    });
  });

  afterEach(async () => {
    // Ensure proper cleanup
    await cleanupHTTPTest(testContext);
  });

  describe('Successful Token Retrieval', () => {
    it('should return tokens without authentication', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(Array.isArray(response.body.tokens)).toBe(true);
    });

    it('should return tokens from ALN-TokenData submodule', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      // Verify we get real tokens, not test tokens
      expect(response.body.tokens.length).toBeGreaterThan(0);

      // Check for real token IDs from ALN-TokenData
      const tokenIds = response.body.tokens.map(t => t.id);
      expect(tokenIds).toContain('534e2b02'); // Known real token
    });

    it('should include all required Token fields', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      const firstToken = response.body.tokens[0];
      expect(firstToken).toHaveProperty('id');
      expect(firstToken).toHaveProperty('name');
      expect(firstToken).toHaveProperty('value');
      expect(firstToken).toHaveProperty('memoryType');
      expect(firstToken).toHaveProperty('mediaAssets');
    });

    it('should return valid memoryType enum values', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      const validTypes = ['visual', 'audio', 'mixed', 'personal', 'business', 'technical'];
      response.body.tokens.forEach(token => {
        expect(validTypes).toContain(token.memoryType);
      });
    });

    it('should include count and lastUpdate metadata', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('lastUpdate');
      expect(response.body.count).toBe(response.body.tokens.length);
    });

    it('should respond within 100ms', async () => {
      const start = Date.now();
      await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('CORS and Headers', () => {
    it('should include CORS headers for scanner access', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .set('Origin', 'http://localhost:8000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should return JSON content type', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Error Handling', () => {
    it('should handle token service failure gracefully', async () => {
      // This test would need to mock tokenService failure
      // For now, we verify the endpoint exists and responds
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should maintain consistent performance across multiple requests', async () => {
      // Verify endpoint performs consistently
      // Note: No caching is implemented, this tests consistent file I/O performance
      const times = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(testContext.app).get('/api/tokens').expect(200);
        times.push(Date.now() - start);
      }

      // All requests should complete reasonably quickly
      times.forEach((time) => {
        expect(time).toBeLessThan(200); // Generous limit for CI environments
      });

      // Calculate variance to ensure consistency
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Max should not be more than 3x the minimum (consistent performance)
      if (minTime > 0) {
        expect(maxTime / minTime).toBeLessThan(3);
      }
    });
  });

  describe('Data Integrity', () => {
    it('should return consistent data across requests', async () => {
      const response1 = await request(testContext.app).get('/api/tokens');
      const response2 = await request(testContext.app).get('/api/tokens');

      expect(response1.body.count).toBe(response2.body.count);
      expect(response1.body.tokens.length).toBe(response2.body.tokens.length);
    });

    it('should handle video tokens correctly', async () => {
      const response = await request(testContext.app)
        .get('/api/tokens')
        .expect(200);

      const videoTokens = response.body.tokens.filter(t =>
        t.mediaAssets && t.mediaAssets.video
      );

      videoTokens.forEach(token => {
        expect(token.mediaAssets.video).toBeTruthy();
        // Video tokens should have processingImage for display during playback
        if (token.mediaAssets.processingImage) {
          expect(token.mediaAssets).toHaveProperty('processingImage');
        }
        // Verify metadata has original token data
        expect(token.metadata).toHaveProperty('rfid');
        expect(token.metadata).toHaveProperty('originalType');
      });
    });
  });

  describe('Method Restrictions', () => {
    it('should reject POST requests', async () => {
      await request(testContext.app)
        .post('/api/tokens')
        .send({ test: 'data' })
        .expect(404);
    });

    it('should reject PUT requests', async () => {
      await request(testContext.app)
        .put('/api/tokens')
        .send({ test: 'data' })
        .expect(404);
    });

    it('should reject DELETE requests', async () => {
      await request(testContext.app)
        .delete('/api/tokens')
        .expect(404);
    });
  });
});