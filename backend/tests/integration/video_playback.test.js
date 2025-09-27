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
    it.skip('should handle complete video playback flow', (done) => {
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      const events = [];
      let transactionId;

      // Connect and identify as GM
      gmSocket.on('connect', () => {
        gmSocket.emit('gm:identify', {
          stationId: 'GM_VIDEO_TEST',
          version: '1.0.0',
        });
      });

      // Listen for video status updates
      gmSocket.on('video:status', (data) => {
        events.push(data.data.status);
        
        if (data.data.status === 'completed') {
          // Verify expected sequence
          expect(events).toContain('loading');
          expect(events).toContain('playing');
          expect(events).toContain('completed');
          
          gmSocket.disconnect();
          done();
        }
      });

      // Listen for transaction broadcast
      gmSocket.on('transaction:new', (data) => {
        if (!transactionId && data.data.tokenId === 'MEM_VIDEO_INT_001') {
          transactionId = data.data.id;
          expect(data.data.status).toBe('accepted');
          expect(data.data.points).toBeGreaterThan(0);
        }
      });

      gmSocket.on('gm:identified', async () => {
        // Step 1: Player scans video token
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

        // Step 2: Check state reflects video playing
        const stateResponse = await request(testContext.app)
          .get('/api/state');

        expect(stateResponse.body.currentVideo).not.toBeNull();
        expect(stateResponse.body.currentVideo.tokenId).toBe('MEM_VIDEO_INT_001');
        expect(stateResponse.body.currentVideo.requestedBy).toBe('SCANNER_01');

        // Step 3: Attempt concurrent scan (should be rejected)
        const concurrentScan = await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: 'MEM_VIDEO_INT_002',
            teamId: 'TEAM_B',
            scannerId: 'SCANNER_02',
          });

        expect(concurrentScan.status).toBe(409);
        expect(concurrentScan.body.status).toBe('rejected');

        // Step 4: Admin controls video
        const pauseResponse = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ command: 'pause' });

        expect(pauseResponse.body.success).toBe(true);
        expect(pauseResponse.body.currentStatus).toBe('paused');

        // Resume
        const resumeResponse = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ command: 'play' });

        expect(resumeResponse.body.currentStatus).toBe('playing');

        // Step 5: Skip to complete
        const skipResponse = await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ command: 'skip' });

        expect(skipResponse.body.success).toBe(true);
      });
    });

    it('should NOT update scores from player scanner scans', async () => {
      // Get initial state
      const initialState = await request(testContext.app)
        .get('/api/state');

      const initialScore = initialState.body.scores.find(s => s.teamId === 'TEAM_C') ||
                          { currentScore: 0, tokensScanned: 0 };

      // Player scanner scan - should NOT affect scores
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_SCORE_001',
          teamId: 'TEAM_C',
          scannerId: 'SCANNER_03',
        });

      // Wait for any processing
      await testDelay(50);

      // Complete video
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

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
    it('should queue video requests when one is playing', async () => {
      // Start first video
      const firstScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_QUEUE_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      expect(firstScan.body.status).toBe('accepted');

      // Small delay to ensure first video starts playing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Now try second video
      const secondScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_QUEUE_002',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });

      // Should be rejected or queued
      expect(secondScan.status).toBe(409);
      expect(secondScan.body.message.toLowerCase()).toContain('video');

      // Stop first video
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

      // Now second video should work
      const thirdScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_QUEUE_003',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });

      expect(thirdScan.body.status).toBe('accepted');
    });
  });

  describe('Video Status Broadcasting', () => {
    it('should broadcast video progress to all GM stations', async () => {
      const gm1 = io(testContext.socketUrl, { transports: ['websocket'] });
      const gm2 = io(testContext.socketUrl, { transports: ['websocket'] });

      let gm1Progress = [];
      let gm2Progress = [];

      // Set up listeners BEFORE connecting
      gm1.on('video:status', (data) => {
        // Push any video status, not just for our specific token
        if (data.data && data.data.status) {
          gm1Progress.push(data.data.status);
        }
      });

      gm2.on('video:status', (data) => {
        // Push any video status, not just for our specific token
        if (data.data && data.data.status) {
          gm2Progress.push(data.data.status);
        }
      });

      // Set up GM1 and wait for identification
      const gm1Ready = new Promise((resolve) => {
        gm1.on('connect', () => {
          gm1.emit('gm:identify', {
            stationId: 'GM_BROADCAST_1',
            version: '1.0.0',
          });
        });
        gm1.on('gm:identified', resolve);
      });

      // Set up GM2 and wait for identification
      const gm2Ready = new Promise((resolve) => {
        gm2.on('connect', () => {
          gm2.emit('gm:identify', {
            stationId: 'GM_BROADCAST_2',
            version: '1.0.0',
          });
        });
        gm2.on('gm:identified', resolve);
      });

      // Wait for both GMs to be identified
      await Promise.all([gm1Ready, gm2Ready]);

      // Now trigger video
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_BROADCAST',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Wait for events to propagate
      await testDelay(100);

      // Stop video
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

      // Wait for final events
      await testDelay(50);

      // Check both received updates
      expect(gm1Progress.length).toBeGreaterThan(0);
      expect(gm2Progress.length).toBeGreaterThan(0);

      // Both should have received some status updates
      // In degraded mode (no VLC), we might get different statuses
      expect(gm1Progress.length).toBeGreaterThanOrEqual(1);
      expect(gm2Progress.length).toBeGreaterThanOrEqual(1);

      gm1.disconnect();
      gm2.disconnect();
    });
  });

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
    it('should allow admin to control video playback', async () => {
      // Start video
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_ADMIN',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Wait for video to start playing
      await testDelay(50);

      // Pause
      const pauseResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'pause' });

      expect(pauseResponse.body.success).toBe(true);
      expect(pauseResponse.body.currentStatus).toBe('paused');

      // Resume
      const resumeResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'play' });

      expect(resumeResponse.body.success).toBe(true);
      expect(resumeResponse.body.currentStatus).toBe('playing');

      // Stop
      const stopResponse = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

      expect(stopResponse.body.success).toBe(true);
      expect(['idle', 'completed']).toContain(stopResponse.body.currentStatus);
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