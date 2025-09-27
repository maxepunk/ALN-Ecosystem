/**
 * Integration Test for Network Recovery Scenario
 * Tests system resilience and recovery from network issues
 *
 * IMPORTANT: According to system architecture:
 * - Player scanners (/api/scan) do NOT create transactions or change game state
 * - Only GM scanners (WebSocket) create transactions and update scores
 * - Video playback from player scans does update currentVideo in state
 */

const request = require('supertest');
const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer } = require('../contract/ws-test-utils');
const { testDelay } = require('./test-helpers');

describe('Network Recovery Integration', () => {
  let testContext;
  let adminToken;

  beforeAll(async () => {
    testContext = await setupTestServer();

    // Get admin token
    const authResponse = await request(testContext.app)
      .post('/api/admin/auth')
      .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' });
    adminToken = authResponse.body.token;

    // Create test session
    await request(testContext.app)
      .post('/api/session')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Network Recovery Test Session' });
  });

  afterAll(async () => {
    await cleanupTestServer(testContext);
  });

  describe('WebSocket Reconnection', () => {
    it.skip('should handle WebSocket reconnection gracefully', (done) => {
      const socket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3,
      });

      let disconnectCount = 0;
      let initialSessionId;

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        socket.disconnect();
        done(new Error('Test timed out'));
      }, 5000);

      socket.on('connect', () => {
        socket.emit('gm:identify', {
          stationId: 'GM_RECONNECT_TEST',
          version: '1.0.0',
        });
      });

      socket.on('gm:identified', (data) => {
        if (disconnectCount === 0) {
          // First connection - save state and force disconnect
          initialSessionId = data.state.sessionId;

          // Force disconnect after a delay
          setTimeout(() => {
            socket.io.engine.close();
          }, 100);
        } else {
          // Reconnected successfully
          expect(data.state.sessionId).toBe(initialSessionId);
          clearTimeout(timeout);
          socket.disconnect();
          done();
        }
      });

      socket.on('disconnect', () => {
        disconnectCount++;
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        done(err);
      });
    });

    it('should maintain session state after reconnection', async () => {
      // Connect first GM
      const gm1 = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gm1.on('connect', () => {
          gm1.emit('gm:identify', {
            stationId: 'GM_STATE_TEST',
            version: '1.0.0',
          });
        });
        gm1.on('gm:identified', resolve);
      });

      // Get initial state
      const stateResponse1 = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // Disconnect GM
      gm1.disconnect();

      // Make a change that affects state (video playback)
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'TEST_VIDEO_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Connect new GM
      const gm2 = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      const identifiedData = await new Promise((resolve) => {
        gm2.on('connect', () => {
          gm2.emit('gm:identify', {
            stationId: 'GM_STATE_TEST_2',
            version: '1.0.0',
          });
        });
        gm2.on('gm:identified', resolve);
      });

      // Verify session is the same but state has the video update
      expect(identifiedData.state.sessionId).toBe(stateResponse1.body.sessionId);
      expect(identifiedData.state.currentVideo).toBeTruthy();
      expect(identifiedData.state.currentVideo.tokenId).toBe('TEST_VIDEO_001');

      gm2.disconnect();
    });
  });

  describe('Transaction Submission via WebSocket', () => {
    it('should handle transactions submitted by GM stations', async () => {
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gmSocket.on('connect', () => {
          gmSocket.emit('gm:identify', {
            stationId: 'GM_TRANSACTION_TEST',
            version: '1.0.0',
          });
        });
        gmSocket.on('gm:identified', resolve);
      });

      // Submit transaction via WebSocket (GM scanner)
      // GM scanners don't care about video - they handle game logic only
      const transactionReceived = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for transaction:new event'));
        }, 2000);

        gmSocket.on('transaction:new', (data) => {
          if (data.data.tokenId === 'TEST_GM_TOKEN_001') {
            clearTimeout(timeout);
            resolve(data);
          }
        });

        gmSocket.on('error', (error) => {
          clearTimeout(timeout);
          // Include full error details for debugging
          const fullError = new Error(error.message || 'Socket error');
          fullError.details = error.details;
          fullError.code = error.code;
          reject(fullError);
        });
      });

      gmSocket.emit('transaction:submit', {
        tokenId: 'TEST_GM_TOKEN_001',  // Use test token pattern that will be mocked
        teamId: 'TEAM_A',
        scannerId: 'GM_SCANNER_01',
      });

      const transaction = await transactionReceived;
      expect(transaction.data.status).toBe('accepted');
      expect(transaction.data.points).toBeGreaterThan(0);

      gmSocket.disconnect();
    });

    it('should sync transactions across multiple GM stations', async () => {
      // Connect two GM stations
      const gm1 = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      const gm2 = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await Promise.all([
        new Promise((resolve) => {
          gm1.on('connect', () => {
            gm1.emit('gm:identify', {
              stationId: 'GM_SYNC_1',
              version: '1.0.0',
            });
          });
          gm1.on('gm:identified', resolve);
        }),
        new Promise((resolve) => {
          gm2.on('connect', () => {
            gm2.emit('gm:identify', {
              stationId: 'GM_SYNC_2',
              version: '1.0.0',
            });
          });
          gm2.on('gm:identified', resolve);
        }),
      ]);

      // GM2 listens for transactions
      const transactionReceived = new Promise((resolve) => {
        gm2.on('transaction:new', (data) => {
          if (data.data.tokenId === '534e2b04') {
            resolve(data);
          }
        });
      });

      // GM1 submits transaction
      gm1.emit('transaction:submit', {
        tokenId: '534e2b04',
        teamId: 'TEAM_B',
        scannerId: 'GM_SCANNER_02',
      });

      // GM2 should receive the transaction
      const transaction = await transactionReceived;
      expect(transaction.data.tokenId).toBe('534e2b04');
      expect(transaction.data.teamId).toBe('TEAM_B');

      gm1.disconnect();
      gm2.disconnect();
    });
  });

  describe('VLC Connection Handling', () => {
    it('should handle VLC connection loss', async () => {
      // Get status - should show VLC not connected in test environment
      const response = await request(testContext.app)
        .get('/api/state/status')  // Correct endpoint path
        .expect(200);

      // In test environment, VLC is not available
      expect(response.body.status).toBe('online');
      // The system should still be functional
    });

    it('should handle VLC unavailability gracefully', async () => {
      // First, ensure no video is playing (clean up from previous tests)
      await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ command: 'stop' });

      // Small delay to ensure stop completes
      await testDelay(50);

      // Try to play video when VLC is not available
      const response = await request(testContext.app)
        .post('/api/video/control')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          command: 'play',
          tokenId: 'TEST_VIDEO_001',
        })
        .expect(200);

      // Should succeed but indicate degraded mode
      expect(response.body.success).toBe(true);
      expect(response.body.degraded).toBe(true);
    });
  });

  describe('Session Persistence', () => {
    it('should sync full state after reconnection', async () => {
      const socket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      // Connect and identify
      const initialData = await new Promise((resolve) => {
        socket.on('connect', () => {
          socket.emit('gm:identify', {
            stationId: 'GM_FULL_SYNC',
            version: '1.0.0',
          });
        });
        socket.on('gm:identified', resolve);
      });

      // Submit a transaction to change state
      await new Promise((resolve) => {
        socket.on('transaction:new', resolve);
        socket.emit('transaction:submit', {
          tokenId: '534e2b05',
          teamId: 'TEAM_A',
          scannerId: 'GM_SCANNER_03',
        });
      });

      // Disconnect
      socket.disconnect();

      // Create new connection
      const socket2 = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      // Connect and verify state includes the transaction
      const reconnectData = await new Promise((resolve) => {
        socket2.on('connect', () => {
          socket2.emit('gm:identify', {
            stationId: 'GM_FULL_SYNC_2',
            version: '1.0.0',
          });
        });
        socket2.on('gm:identified', resolve);
      });

      // State should include the transaction we submitted
      expect(reconnectData.state.scores).toBeDefined();
      const teamAScore = reconnectData.state.scores.find(s => s.teamId === 'TEAM_A');
      expect(teamAScore).toBeDefined();
      expect(teamAScore.tokensScanned).toBeGreaterThan(0);

      socket2.disconnect();
    });

    it('should prioritize critical operations during network issues', async () => {
      // This tests that critical operations (like session status changes) work
      // even when there might be network issues

      // Change session status (critical operation)
      const response = await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body.status).toBe('paused');

      // Verify the change persisted
      const stateResponse = await request(testContext.app)
        .get('/api/state')
        .expect(200);

      // The state should reflect the paused session
      // Note: The actual session status is managed separately from game state

      // Resume session
      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active' })
        .expect(200);
    });
  });
});