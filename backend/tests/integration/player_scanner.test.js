/**
 * Integration Test for Player Scanner Functionality
 * Tests player scanner endpoint behavior without game mechanics
 * 
 * Requirements validated:
 * - Player scanners don't enforce duplicate detection
 * - Player scanners don't create transactions
 * - Player scanners return media assets
 * - Video conflict detection (only one video at a time)
 * - System continues to work without creating game state
 */

const request = require('supertest');
const { setupTestServer, cleanupTestServer } = require('../contract/ws-test-utils');
const { testDelay } = require('./test-helpers');

describe('Player Scanner Integration', () => {
  let testContext;

  beforeAll(async () => {
    // Use shared test server setup
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  describe('Player Scanner Behavior', () => {
    it('should allow duplicate scans from same team', async () => {
      const tokenId = 'MEM_PLAYER_001';
      const teamId = 'TEAM_A';

      // First scan
      const scan1 = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId,
          teamId,
          scannerId: 'PLAYER_01',
        });

      expect(scan1.status).toBe(200);
      expect(scan1.body.status).toBe('accepted');

      // Duplicate scan from same team
      const scan2 = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId,
          teamId,
          scannerId: 'PLAYER_02',
        });

      // Should also succeed - no duplicate detection for players
      expect(scan2.status).toBe(200);
      expect(scan2.body.status).toBe('accepted');
    });

    it('should NOT return a transactionId', async () => {
      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PLAYER_002',
          teamId: 'TEAM_B',
          scannerId: 'PLAYER_03',
        });

      expect(response.status).toBe(200);
      expect(response.body.transactionId).toBeUndefined();
    });

    it('should return mediaAssets in response', async () => {
      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PLAYER_003',
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_04',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mediaAssets');
      expect(response.body.mediaAssets).toBeInstanceOf(Object);
    });

    it('should allow multiple teams to scan same token', async () => {
      const tokenId = 'MEM_PLAYER_004';

      // Team A scans
      const scanA = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId,
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_05',
        });

      expect(scanA.status).toBe(200);

      // Team B scans same token
      const scanB = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId,
          teamId: 'TEAM_B',
          scannerId: 'PLAYER_06',
        });

      expect(scanB.status).toBe(200);
    });

    it('should allow rapid repeated scans', async () => {
      const tokenId = 'MEM_PLAYER_005';
      const teamId = 'TEAM_A';

      // Rapid scans
      const scans = await Promise.all([
        request(testContext.app).post('/api/scan').send({ tokenId, teamId, scannerId: 'PLAYER_07' }),
        request(testContext.app).post('/api/scan').send({ tokenId, teamId, scannerId: 'PLAYER_08' }),
        request(testContext.app).post('/api/scan').send({ tokenId, teamId, scannerId: 'PLAYER_09' }),
      ]);

      // All should succeed
      scans.forEach(scan => {
        expect(scan.status).toBe(200);
        expect(scan.body.status).toBe('accepted');
      });
    });
  });

  describe('Video Conflict Detection', () => {
    it('should block video scan when another video is playing', async () => {
      // First video token
      const firstVideo = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_001',
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_10',
        });

      expect(firstVideo.status).toBe(200);
      expect(firstVideo.body.videoPlaying).toBe(true);

      // Second video token while first is playing
      const secondVideo = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_002',
          teamId: 'TEAM_B',
          scannerId: 'PLAYER_11',
        });

      // Should be rejected due to video conflict
      expect(secondVideo.status).toBe(409);
      expect(secondVideo.body.status).toBe('rejected');
      expect(secondVideo.body.message).toContain('playing');
      expect(secondVideo.body).toHaveProperty('waitTime');
    });

    it('should allow non-video scans while video is playing', async () => {
      // Video token
      const videoScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_003',
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_12',
        });

      // If video is already playing from previous test, expect rejection
      if (videoScan.status === 409) {
        expect(videoScan.body.message.toLowerCase()).toContain('video');
        // Stop any playing video and retry
        const adminAuth = await request(testContext.app)
          .post('/api/admin/auth')
          .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' });
        await request(testContext.app)
          .post('/api/video/control')
          .set('Authorization', `Bearer ${adminAuth.body.token}`)
          .send({ command: 'stop' });
        await testDelay(50);

        // Retry the video scan
        const retryScan = await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: 'TEST_VIDEO_003',
            teamId: 'TEAM_A',
            scannerId: 'PLAYER_12',
          });
        expect(retryScan.status).toBe(200);
      } else {
        expect(videoScan.status).toBe(200);
      }

      // Wait for video to start
      await testDelay(50);

      // Non-video token
      const normalScan = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PLAYER_006',
          teamId: 'TEAM_B',
          scannerId: 'PLAYER_13',
        });

      // Should succeed even while video is playing
      expect(normalScan.status).toBe(200);
      expect(normalScan.body.videoPlaying).toBe(false);
    });
  });

  describe('State Isolation', () => {
    it('should NOT create transactions in session', async () => {
      // Get initial state
      const initialState = await request(testContext.app).get('/api/state');
      const initialTransactionCount = initialState.body.recentTransactions?.length || 0;

      // Perform player scan
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PLAYER_007',
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_14',
        });

      // Check state again
      const newState = await request(testContext.app).get('/api/state');
      const newTransactionCount = newState.body.recentTransactions?.length || 0;

      // Transaction count should not increase
      expect(newTransactionCount).toBe(initialTransactionCount);
    });

    it('should NOT affect team scores', async () => {
      // Get initial scores
      const initialState = await request(testContext.app).get('/api/state');
      const initialScores = initialState.body.scores || [];

      // Perform multiple player scans
      for (let i = 0; i < 5; i++) {
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_PLAYER_${100 + i}`,
            teamId: 'TEAM_A',
            scannerId: `PLAYER_${20 + i}`,
          });
      }

      // Check scores again
      const newState = await request(testContext.app).get('/api/state');
      const newScores = newState.body.scores || [];

      // Scores should remain unchanged
      expect(newScores).toEqual(initialScores);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid token gracefully', async () => {
      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'INVALID_TOKEN_999',
          teamId: 'TEAM_A',
          scannerId: 'PLAYER_30',
        });

      // Should still return 200 (no error for player)
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('accepted');
      expect(response.body.mediaAssets).toEqual({});
    });

    it('should validate required fields', async () => {
      const response = await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PLAYER_008',
          // Missing teamId
          scannerId: 'PLAYER_31',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('teamId');
    });
  });
});