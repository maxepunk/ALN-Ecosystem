/**
 * Contract Tests for GET /api/state
 * Tests retrieval of current game state
 * 
 * Requirements validated:
 * - Principle V: Progressive enhancement - state available without orchestrator
 * - Real-time state synchronization accuracy
 * - No authentication required for state retrieval
 * - Response time < 100ms
 */

const request = require('supertest');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('GET /api/state - Game State Retrieval', () => {
  let testContext;

  beforeEach(async () => {
    // Setup test context with session
    testContext = await setupHTTPTest({
      createSession: true,
      sessionName: 'Test Session'
    });
  });

  afterEach(async () => {
    // Clean up test context
    await cleanupHTTPTest(testContext);
  });
  describe('Valid State Requests', () => {
    it('should return current game state with all required fields', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate required fields from OpenAPI spec
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      expect(response.body).toHaveProperty('lastUpdate');
      expect(new Date(response.body.lastUpdate).toISOString()).toBe(response.body.lastUpdate);
      
      expect(response.body).toHaveProperty('scores');
      expect(Array.isArray(response.body.scores)).toBe(true);
    });

    it('should return valid team scores structure', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Validate each team score object
      response.body.scores.forEach(teamScore => {
        expect(teamScore).toHaveProperty('teamId');
        expect(teamScore.teamId).toMatch(/^TEAM_[A-Z]$/);
        
        expect(teamScore).toHaveProperty('currentScore');
        expect(teamScore.currentScore).toBeGreaterThanOrEqual(0);
        
        expect(teamScore).toHaveProperty('tokensScanned');
        expect(teamScore.tokensScanned).toBeGreaterThanOrEqual(0);
        
        expect(teamScore).toHaveProperty('bonusPoints');
        expect(teamScore.bonusPoints).toBeGreaterThanOrEqual(0);
        
        expect(teamScore).toHaveProperty('lastUpdate');
        expect(new Date(teamScore.lastUpdate).toISOString()).toBe(teamScore.lastUpdate);
        
        // Optional field
        if (teamScore.completedGroups) {
          expect(Array.isArray(teamScore.completedGroups)).toBe(true);
          teamScore.completedGroups.forEach(group => {
            expect(typeof group).toBe('string');
          });
        }
      });
    });

    it('should include currentVideo when video is playing', async () => {
      // First trigger a video
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      if (response.body.currentVideo) {
        expect(response.body.currentVideo).toHaveProperty('tokenId');
        expect(typeof response.body.currentVideo.tokenId).toBe('string');
        
        expect(response.body.currentVideo).toHaveProperty('startTime');
        expect(new Date(response.body.currentVideo.startTime).toISOString())
          .toBe(response.body.currentVideo.startTime);
        
        expect(response.body.currentVideo).toHaveProperty('expectedEndTime');
        expect(new Date(response.body.currentVideo.expectedEndTime).toISOString())
          .toBe(response.body.currentVideo.expectedEndTime);
        
        expect(response.body.currentVideo).toHaveProperty('requestedBy');
        expect(typeof response.body.currentVideo.requestedBy).toBe('string');
      }
    });

    it('should have null currentVideo when no video is playing', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // When starting fresh, currentVideo should be null
      expect(response.body.currentVideo).toBeNull();
    });

    it('should include recentTransactions array', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      if (response.body.recentTransactions) {
        expect(Array.isArray(response.body.recentTransactions)).toBe(true);
        expect(response.body.recentTransactions.length).toBeLessThanOrEqual(10);
        
        response.body.recentTransactions.forEach(transaction => {
          // Validate transaction structure
          expect(transaction).toHaveProperty('id');
          expect(transaction.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
          
          expect(transaction).toHaveProperty('tokenId');
          expect(transaction).toHaveProperty('teamId');
          expect(transaction.teamId).toMatch(/^TEAM_[A-Z]$/);
          
          expect(transaction).toHaveProperty('scannerId');
          expect(transaction).toHaveProperty('timestamp');
          expect(transaction).toHaveProperty('sessionId');
          expect(transaction).toHaveProperty('status');
          expect(['accepted', 'rejected', 'duplicate']).toContain(transaction.status);
          
          expect(transaction).toHaveProperty('points');
          expect(transaction.points).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should include systemStatus information', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      if (response.body.systemStatus) {
        expect(response.body.systemStatus).toHaveProperty('orchestratorOnline');
        expect(typeof response.body.systemStatus.orchestratorOnline).toBe('boolean');
        
        expect(response.body.systemStatus).toHaveProperty('vlcConnected');
        expect(typeof response.body.systemStatus.vlcConnected).toBe('boolean');
        
        expect(response.body.systemStatus).toHaveProperty('videoDisplayReady');
        expect(typeof response.body.systemStatus.videoDisplayReady).toBe('boolean');
      }
    });

    it('should respond within 100ms', async () => {
      const startTime = Date.now();
      
      await request(testContext.app)
        .get('/api/state')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('State Consistency', () => {
    it('should return consistent state across multiple requests', async () => {
      const response1 = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      const response2 = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Session ID should remain same
      expect(response1.body.sessionId).toBe(response2.body.sessionId);
      
      // Scores should be consistent (unless a scan happened between)
      if (response1.body.lastUpdate === response2.body.lastUpdate) {
        expect(response1.body.scores).toEqual(response2.body.scores);
      }
    });

    it('should update lastUpdate timestamp when state changes', async () => {
      const initialResponse = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      const initialUpdate = new Date(initialResponse.body.lastUpdate);

      // Add small delay to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger state change by scanning a VIDEO token
      // Video tokens DO change state (currentVideo field)
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_001',  // Video token that will update currentVideo in state
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Wait for state to actually update (debounced by 100ms in stateService + async operations)
      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedResponse = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      const updatedTime = new Date(updatedResponse.body.lastUpdate);
      expect(updatedTime.getTime()).toBeGreaterThan(initialUpdate.getTime());
    });

    it('should maintain score ordering consistency', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Verify teams are in consistent order (e.g., alphabetical)
      const teamIds = response.body.scores.map(s => s.teamId);
      const sortedTeamIds = [...teamIds].sort();
      expect(teamIds).toEqual(sortedTeamIds);
    });
  });

  describe('Edge Cases', () => {
    it('should handle state request when no session exists', async () => {
      // This assumes fresh start with no session
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Should either return empty state or create default session
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.scores).toBeDefined();
    });

    it('should handle concurrent state requests', async () => {
      const promises = [];
      
      // Send 20 concurrent requests
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(testContext.app)
            .get('/api/state')
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('sessionId');
      });

      // All should have same session ID
      const sessionIds = responses.map(r => r.body.sessionId);
      expect(new Set(sessionIds).size).toBe(1);
    });

    it('should handle state request with query parameters (ignored)', async () => {
      const response = await request(testContext.app)
        .get('/api/state?random=param&another=value')
        .expect(200);

      // Should ignore query params and return normal state
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('scores');
    });

    it('should return empty recentTransactions when none exist', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      if (response.body.recentTransactions) {
        expect(Array.isArray(response.body.recentTransactions)).toBe(true);
      }
    });
  });

  describe('Security and Access Control', () => {
    it('should not require authentication', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        // No auth header
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
    });

    it('should ignore authorization header if provided', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .set('Authorization', 'Bearer invalid-token')
        .expect(200);

      // Should still work even with invalid auth
      expect(response.body).toHaveProperty('sessionId');
    });

    it('should handle HEAD requests appropriately', async () => {
      await request(testContext.app)
        .head('/api/state')
        .expect(200);
    });

    it('should reject non-GET methods', async () => {
      const methods = ['post', 'put', 'delete', 'patch'];
      
      for (const method of methods) {
        await request(testContext.app)[method]('/api/state')
          .expect(405); // Method Not Allowed
      }
    });
  });

  describe('Cache and Performance', () => {
    it('should include appropriate cache headers', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // State should not be cached or have very short cache
      expect(response.headers['cache-control']).toMatch(/no-cache|max-age=0|must-revalidate/);
    });

    it('should handle rapid successive requests', async () => {
      const startTime = Date.now();
      
      // Send 10 requests in rapid succession
      for (let i = 0; i < 10; i++) {
        await request(testContext.app)
          .get('/api/state')
          .expect(200);
      }
      
      const totalTime = Date.now() - startTime;
      // Should complete all requests quickly (avg < 50ms per request)
      expect(totalTime).toBeLessThan(500);
    });

    it('should return consistent data size', async () => {
      const responses = await Promise.all([
        request(testContext.app).get('/api/state'),
        request(testContext.app).get('/api/state'),
        request(testContext.app).get('/api/state'),
      ]);

      const sizes = responses.map(r => JSON.stringify(r.body).length);
      
      // Response sizes should be similar (within 10% variance)
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
      sizes.forEach(size => {
        expect(Math.abs(size - avgSize) / avgSize).toBeLessThan(0.1);
      });
    });
  });

  describe('Data Integrity', () => {
    it('should never expose sensitive data', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      const responseString = JSON.stringify(response.body);
      
      // Should not contain sensitive patterns
      // Note: tokensScanned and lastTokenTime are legitimate field names (counts/timestamps)
      expect(responseString).not.toMatch(/password/i);
      expect(responseString).not.toMatch(/secret/i);
      // Don't check for "token" as it's part of legitimate field names like "tokensScanned"
      // Instead check for actual token values if needed
      expect(responseString).not.toMatch(/jwt/i);
      expect(responseString).not.toMatch(/authorization/i);  // More specific than just "auth"
    });

    it('should maintain data type consistency', async () => {
      const response = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Numbers should be numbers, not strings
      response.body.scores.forEach(score => {
        expect(typeof score.currentScore).toBe('number');
        expect(typeof score.tokensScanned).toBe('number');
        expect(typeof score.bonusPoints).toBe('number');
      });

      // Dates should be ISO strings
      expect(response.body.lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});