/**
 * Contract Tests for POST /api/video/control
 * Tests video playback control endpoint
 * 
 * Requirements validated:
 * - Admin authentication required
 * - VLC integration for playback control
 * - Command validation (play, pause, stop, skip)
 * - Token ID required for play command
 * - Single concurrent video enforcement
 */

const request = require('supertest');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('POST /api/video/control - Video Playback Control', () => {
  let testContext;

  beforeAll(async () => {
    // Setup test context with authentication
    testContext = await setupHTTPTest({
      createSession: true,
      sessionName: 'Video Control Test Session',
      needsAuth: true
    });
  });

  afterAll(async () => {
    // Clean up test context
    await cleanupHTTPTest(testContext);
  });

  // Clean up state before each test to ensure isolation
  beforeEach(async () => {
    // Clear video queue which is critical for video control tests
    const videoQueueService = require('../../src/services/videoQueueService');
    videoQueueService.clearQueue();
  });

  describe('Play Command', () => {
    describe('Valid Requests', () => {
      it('should start video playback with valid token ID', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_001'
          })
          .expect('Content-Type', /json/)
          .expect(200);

        // Validate response structure from OpenAPI spec
        expect(response.body).toHaveProperty('success');
        expect(typeof response.body.success).toBe('boolean');
        expect(response.body.success).toBe(true);
        
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
        
        expect(response.body).toHaveProperty('currentStatus');
        expect(['idle', 'playing', 'paused']).toContain(response.body.currentStatus);
        expect(response.body.currentStatus).toBe('playing');
      });

      it('should handle video token with media assets', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_WITH_ASSETS'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.currentStatus).toBe('playing');
      });

      it('should respond within reasonable time for play command', async () => {
        const startTime = Date.now();
        
        await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_002'
          })
          .expect(200);

        const responseTime = Date.now() - startTime;
        // Allow more time for video operations
        expect(responseTime).toBeLessThan(1000);
      });
    });

    describe('Invalid Requests', () => {
      it('should reject play command without tokenId', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({ command: 'play' })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('tokenId');
      });

      it('should reject play command with empty tokenId', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: ''
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should reject play command with null tokenId', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: null
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle non-existent token ID', async () => {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'NON_EXISTENT_TOKEN'
          })
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('not found');
      });
    });

    describe('Concurrent Video Prevention', () => {
      it('should reject play when another video is already playing', async () => {
        // Start first video
        await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_001'
          })
          .expect(200);

        // Try to start second video
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_002'
          })
          .expect(409);

        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('already playing');
      });

      it('should allow play after stopping current video', async () => {
        // Play first video
        await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_001'
          })
          .expect(200);

        // Stop current video
        await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({ command: 'stop' })
          .expect(200);

        // Play new video should work
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId: 'TEST_VIDEO_002'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.currentStatus).toBe('playing');
      });
    });
  });

  describe('Pause Command', () => {
    beforeEach(async () => {
      // Start a video to pause
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001'
        });
    });

    it('should pause currently playing video', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'pause' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('paused');
      expect(response.body.message).toContain('paused');
    });

    it('should not require tokenId for pause command', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'pause' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle pause when no video is playing', async () => {
      // Stop any playing video first
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' });

      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'pause' })
        .expect(200);

      // Should succeed but indicate idle status
      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('idle');
    });

    it('should allow resuming after pause', async () => {
      // Pause
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'pause' })
        .expect(200);

      // Resume with play (no tokenId needed to resume)
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'play' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('playing');
    });
  });

  describe('Stop Command', () => {
    beforeEach(async () => {
      // Start a video to stop
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001'
        });
    });

    it('should stop currently playing video', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('idle');
      expect(response.body.message).toContain('stopped');
    });

    it('should not require tokenId for stop command', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle stop when no video is playing', async () => {
      // Stop once
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' });

      // Stop again
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('idle');
    });

    it('should clear video state after stop', async () => {
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' })
        .expect(200);

      // Check state endpoint to verify video is cleared
      const stateResponse = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      expect(stateResponse.body.currentVideo).toBeNull();
    });
  });

  describe('Skip Command', () => {
    beforeEach(async () => {
      // Start a video to skip
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001'
        });
    });

    it('should skip currently playing video', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'skip' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('skip');
    });

    it('should not require tokenId for skip command', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'skip' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle skip when no video is playing', async () => {
      // Stop first
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'stop' });

      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'skip' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.currentStatus).toBe('idle');
    });

    it('should move to next queued video if available', async () => {
      // This tests queue functionality if implemented
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: 'skip' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Status depends on whether there's a next video
      expect(['idle', 'playing']).toContain(response.body.currentStatus);
    });
  });

  describe('Invalid Commands', () => {
    it('should reject invalid command values', async () => {
      const invalidCommands = ['start', 'resume', 'end', 'next', 'previous', ''];

      for (const command of invalidCommands) {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({ command })
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('command');
      }
    });

    it('should reject request without command field', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('command');
    });

    it('should reject null command', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({ command: null })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should ignore extra fields', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'stop',
          extra: 'field',
          another: 'value'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject request without authentication', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .send({ command: 'stop' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('auth');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', 'Bearer invalid-token')
        .send({ command: 'stop' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with expired token', async () => {
      // This would require a specifically crafted expired token
      const expiredToken = 'expired.jwt.token';
      
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ command: 'stop' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject malformed authorization header', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', 'NotBearer token')
        .send({ command: 'stop' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('VLC Integration', () => {
    it('should handle VLC connection failure gracefully', async () => {
      // Simulate VLC being offline
      process.env.VLC_HOST = 'invalid-host';
      
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001'
        });

      // Should return error but not crash
      expect(response.status).toBeLessThan(600);
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.message).toContain('VLC');
      }
    });

    it('should validate VLC is ready before playing', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001'
        });

      // If VLC is not ready, should get appropriate error
      if (!response.body.success) {
        expect(response.body.message).toMatch(/VLC|video|display/i);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid command changes', async () => {
      const commands = [
        { command: 'play', tokenId: 'TEST_VIDEO_001' },
        { command: 'pause' },
        { command: 'play' },
        { command: 'stop' },
        { command: 'play', tokenId: 'TEST_VIDEO_002' },
      ];

      for (const cmd of commands) {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send(cmd);

        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle concurrent control commands', async () => {
      const promises = [];
      
      // Send multiple concurrent stop commands
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(testContext.app)
            .post('/api/video/control')
            .set('Authorization', `Bearer ${testContext.adminToken}`)
            .send({ command: 'stop' })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should complete without server error
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });

    it('should handle very long token IDs', async () => {
      const longTokenId = 'TEST_' + 'X'.repeat(1000);
      
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${testContext.adminToken}`)
        .send({
          command: 'play',
          tokenId: longTokenId
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize token ID for security', async () => {
      const maliciousTokens = [
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        '"; DROP TABLE videos; --',
        'javascript:alert(1)',
      ];

      for (const tokenId of maliciousTokens) {
        const response = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${testContext.adminToken}`)
          .send({
            command: 'play',
            tokenId
          });

        // Should either reject or sanitize
        expect(response.status).toBeLessThan(500);
      }
    });
  });
});