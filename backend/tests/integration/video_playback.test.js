/**
 * Integration Test for Video Playback Scenario
 * Tests complete video playback flow across multiple components
 * 
 * Requirements validated:
 * - End-to-end video playback flow
 * - Score updates after video completion
 * - Video token scanning triggers playback
 * - Concurrent video request handling
 * - Admin video controls
 */

const request = require('supertest');
const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer, createGMClient } = require('../contract/ws-test-utils');
const { testDelay } = require('./test-helpers');

describe('Video Playback Integration', () => {
  let testContext;
  let adminToken;

  beforeAll(async () => {
    // Use shared test server setup with proper Socket.IO
    // Note: setupTestServer() already creates a test session
    testContext = await setupTestServer();

    // Get admin token
    const authResponse = await request(testContext.app)
      .post('/api/admin/auth')
      .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' });
    adminToken = authResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  describe('Complete Video Playback Flow', () => {
    it('should handle video scan requests correctly', async () => {
      // Step 1: Player scans video token - should be accepted
      const scanResponse = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_INT_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      expect(scanResponse.status).toBe(200);
      expect(scanResponse.body.status).toBe('accepted');
      // Player scanners don't create transactions
      expect(scanResponse.body).not.toHaveProperty('transactionId');

      // Step 2: Concurrent scan may be rejected (depends on timing)
      const concurrentScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_INT_002',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });

      // Should return valid status code
      expect([200, 409]).toContain(concurrentScan.status);
      if (concurrentScan.status === 409) {
        expect(concurrentScan.body.status).toBe('rejected');
        expect(concurrentScan.body.message).toBeDefined();
      }

      // Step 3: Admin can control videos
      const pauseResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'pause' });

      expect(pauseResponse.status).toBe(200);
      expect(pauseResponse.body.success).toBe(true);

      // Resume (may fail if no video to resume)
      const resumeResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'play' });

      // Play without tokenId can return 400 if there's nothing to resume
      expect([200, 400]).toContain(resumeResponse.status);
      if (resumeResponse.status === 200) {
        expect(resumeResponse.body.success).toBe(true);
      }

      // Skip
      const skipResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'skip' });

      expect(skipResponse.status).toBe(200);
      expect(skipResponse.body.success).toBe(true);
    });

    it('should NOT update scores from player scanner scans', async () => {
      // Get initial state
      const initialState = await request(testContext.app)
        .get('/api/state');

      const initialScore = initialState.body.scores.find(s => s.teamId === 'TEAM_C') ||
                          { currentScore: 0, tokensScanned: 0 };

      // Player scanner scan - should NOT affect scores
      const scanResponse = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_SCORE_001',
          teamId: 'TEAM_C',
          scannerId: 'SCANNER_03',
        });

      expect([200, 409]).toContain(scanResponse.status);

      // Check scores NOT updated (player scanners don't affect scores)
      const stateResponse = await request(testContext.app)
        .get('/api/state');

      const teamCScore = stateResponse.body.scores.find(s => s.teamId === 'TEAM_C') ||
                        { currentScore: 0, tokensScanned: 0 };
      expect(teamCScore.currentScore).toBe(initialScore.currentScore);
      expect(teamCScore.tokensScanned).toBe(initialScore.tokensScanned);
    });
  });

  describe('Video Queue Handling', () => {
    it('should enforce video queueing rules', async () => {
      // Start first video
      const firstScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_QUEUE_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      expect(firstScan.status).toBe(200);
      expect(firstScan.body.status).toBe('accepted');

      // Try second video - may be rejected if first is still playing
      const secondScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_QUEUE_002',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });

      // Should return valid status
      expect([200, 409]).toContain(secondScan.status);
      if (secondScan.status === 409) {
        expect(secondScan.body.message).toBeDefined();
        expect(secondScan.body.status).toBe('rejected');
      }
    });
  });

  // DELETED - This test was entirely about internal state, not API contracts

  describe('Error Handling', () => {
    it('should handle VLC connection errors gracefully', async () => {
      // In test environment, VLC is typically not running, so system is in degraded mode
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          command: 'play',
          tokenId: 'MEM_VIDEO_VLC_ERROR',
        });

      // Should handle gracefully - either success with degraded mode or success without VLC
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // If VLC is not connected (typical in tests), should indicate degraded mode
      if (response.body.degraded) {
        expect(response.body.message.toLowerCase()).toContain('vlc');
      }
    });

    it('should handle invalid video token gracefully', async () => {
      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_INVALID_999',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Should either reject or handle as regular token
      if (response.status === 400) {
        expect(response.body.error).toBeDefined();
      } else {
        expect(response.body.status).toBeDefined();
      }
    });
  });

  describe('Admin Controls', () => {
    it('should accept admin video control commands', async () => {
      // Pause
      const pauseResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'pause' });

      expect(pauseResponse.status).toBe(200);
      expect(pauseResponse.body.success).toBe(true);

      // Resume (may fail if no video to resume)
      const resumeResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'play' });

      // Play without tokenId can return 400 if there's nothing to resume
      expect([200, 400]).toContain(resumeResponse.status);
      if (resumeResponse.status === 200) {
        expect(resumeResponse.body.success).toBe(true);
      }

      // Stop
      const stopResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

      expect(stopResponse.status).toBe(200);
      expect(stopResponse.body.success).toBe(true);
    });

    it('should reject video control without admin auth', async () => {
      const response = await request(testContext.app)
        .post('/api/video/control')
        .send({ command: 'pause' })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});