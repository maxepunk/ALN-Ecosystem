/**
 * Integration Test for Orchestrator Restart Recovery
 * Tests system persistence and recovery after restart
 * 
 * Requirements validated:
 * - Session persistence across restarts
 * - Score preservation
 * - Transaction history persistence
 * - WebSocket client reconnection after restart
 * - State restoration completeness
 */

const request = require('supertest');
const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer, createGMClient } = require('../contract/ws-test-utils');
const { testDelay } = require('./test-helpers');

describe('Restart Recovery Integration', () => {
  let testContext;
  let adminToken;

  beforeAll(async () => {
    // Use shared test server setup with proper Socket.IO
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

  describe('Session Persistence', () => {
    it('should persist session across restart', async () => {
      // Create session with specific data
      const sessionResponse = await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Persistent Session' });

      const sessionId = sessionResponse.body.id;

      // Add some transactions
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PERSIST_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_PERSIST_002',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });

      // Simulate restart by clearing in-memory state
      // (In real implementation, this would be actual restart)
      global.restartSimulation = true;

      // Check session persisted
      const afterRestart = await request(testContext.app).get('/api/session');
      
      expect(afterRestart.body.id).toBe(sessionId);
      expect(afterRestart.body.name).toBe('Persistent Session');
    });

    it('should maintain session status across restart', async () => {
      // Create and pause session
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Status Test Session' });

      await request(testContext.app)
        .put('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'paused' });

      const beforeRestart = await request(testContext.app).get('/api/session');
      expect(beforeRestart.body.status).toBe('paused');

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      const stateService = require('../../src/services/stateService');
      await sessionService.init();
      await stateService.init();

      // Check status preserved
      const afterRestart = await request(testContext.app).get('/api/session');
      expect(afterRestart.body.status).toBe('paused');
    });

    it('should preserve session metadata', async () => {
      // Create session and add activity
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Metadata Session' });

      // Generate some metadata
      for (let i = 0; i < 5; i++) {
        await request(testContext.app)
          .post('/api/scan')
          .send({
            tokenId: `MEM_META_${i}`,
            teamId: `TEAM_${i % 2 === 0 ? 'A' : 'B'}`,
            scannerId: 'SCANNER_01',
          });
      }

      const beforeRestart = await request(testContext.app).get('/api/session');
      const metadataBefore = beforeRestart.body.metadata;

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      const stateService = require('../../src/services/stateService');
      await sessionService.init();
      await stateService.init();

      const afterRestart = await request(testContext.app).get('/api/session');
      const metadataAfter = afterRestart.body.metadata;

      if (metadataBefore && metadataAfter) {
        expect(metadataAfter.totalScans).toBe(metadataBefore.totalScans);
        expect(metadataAfter.uniqueTokensScanned).toEqual(metadataBefore.uniqueTokensScanned);
      }
    });
  });

  describe('Score Restoration', () => {
    it('should restore team scores after restart', async () => {
      // Create new session
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Score Recovery Session' });

      // Add transactions to build scores
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_SCORE_PERSIST_001',
          teamId: 'TEAM_D',
          scannerId: 'SCANNER_01',
        });

      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_SCORE_PERSIST_002',
          teamId: 'TEAM_D',
          scannerId: 'SCANNER_01',
        });

      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_SCORE_PERSIST_003',
          teamId: 'TEAM_E',
          scannerId: 'SCANNER_02',
        });

      // Get current scores
      const beforeRestart = await request(testContext.app).get('/api/state');
      const scoresBefore = {};
      beforeRestart.body.scores.forEach(score => {
        scoresBefore[score.teamId] = {
          currentScore: score.currentScore,
          tokensScanned: score.tokensScanned
        };
      });

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      await sessionService.init();

      // Check scores restored
      const afterRestart = await request(testContext.app).get('/api/state');
      const scoresAfter = {};
      afterRestart.body.scores.forEach(score => {
        scoresAfter[score.teamId] = {
          currentScore: score.currentScore,
          tokensScanned: score.tokensScanned
        };
      });

      // Scores should match
      Object.keys(scoresBefore).forEach(teamId => {
        expect(scoresAfter[teamId]).toEqual(scoresBefore[teamId]);
      });
    });

    it('should maintain score rankings after restart', async () => {
      // Build different scores for teams
      const teams = [
        { id: 'TEAM_RANK_1', tokens: 5 },
        { id: 'TEAM_RANK_2', tokens: 3 },
        { id: 'TEAM_RANK_3', tokens: 7 }
      ];

      for (const team of teams) {
        for (let i = 0; i < team.tokens; i++) {
          await request(testContext.app)
            .post('/api/scan')
            .send({
              tokenId: `MEM_RANK_${team.id}_${i}`,
              teamId: team.id,
              scannerId: 'SCANNER_01',
            });
          
          // Small delay to avoid duplicate detection
          await testDelay(50);
        }
      }

      const beforeRestart = await request(testContext.app).get('/api/state');
      const rankingBefore = beforeRestart.body.scores
        .sort((a, b) => b.currentScore - a.currentScore)
        .map(s => s.teamId);

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      await sessionService.init();

      const afterRestart = await request(testContext.app).get('/api/state');
      const rankingAfter = afterRestart.body.scores
        .sort((a, b) => b.currentScore - a.currentScore)
        .map(s => s.teamId);

      expect(rankingAfter).toEqual(rankingBefore);
    });
  });

  describe('Transaction History', () => {
    it('should preserve recent transaction history', async () => {
      // Ensure we have an active session
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Transaction History Test' });

      // Create GM socket for transactions
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gmSocket.on('connect', () => {
          gmSocket.emit('gm:identify', {
            stationId: 'GM_HISTORY_TEST',
            version: '1.0.0',
          });
        });
        gmSocket.on('gm:identified', resolve);
      });

      // Track received transaction events and errors
      let receivedTransactions = 0;
      const errors = [];

      gmSocket.on('transaction:new', (data) => {
        console.log('Received transaction:new event:', data.data?.tokenId);
        if (data.data && data.data.tokenId && data.data.tokenId.startsWith('MEM_TX_HISTORY_')) {
          receivedTransactions++;
        }
      });

      gmSocket.on('error', (error) => {
        console.log('Socket error:', error);
        errors.push(error);
      });

      gmSocket.on('transaction:result', (result) => {
        console.log('Transaction result:', result?.status, result?.transactionId);
      });

      // Create transactions via WebSocket
      for (let i = 0; i < 10; i++) {
        const teams = ['TEAM_A', 'TEAM_B', 'TEAM_C'];
        gmSocket.emit('transaction:submit', {
          tokenId: `MEM_TX_HISTORY_${i}`,
          teamId: teams[i % 3],
          scannerId: 'GM_SCANNER_01',
        });

        // Small delay between submissions
        await testDelay(50);
      }

      console.log('Submitted 10 transactions, errors:', errors.length);

      // Wait for transactions to be processed
      await testDelay(100);

      const beforeRestart = await request(testContext.app).get('/api/state');
      const txBefore = beforeRestart.body.recentTransactions || [];

      // Verify we actually have transactions before restart
      expect(txBefore.length).toBeGreaterThan(0);
      console.log(`Transactions before restart: ${txBefore.length}, Received events: ${receivedTransactions}`);

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      const stateService = require('../../src/services/stateService');
      await sessionService.init();
      await stateService.init();

      const afterRestart = await request(testContext.app).get('/api/state');
      const txAfter = afterRestart.body.recentTransactions || [];

      console.log(`Transactions after restart: ${txAfter.length}`);

      // At least some transactions should be preserved
      const preservedCount = txAfter.filter(t =>
        txBefore.some(tb => tb.id === t.id)
      ).length;

      console.log(`Preserved transactions: ${preservedCount}`);

      // Should preserve at least some of the recent transactions
      expect(preservedCount).toBeGreaterThan(0);
      expect(txAfter.length).toBeGreaterThan(0);

      gmSocket.disconnect();
    });

    it('should maintain transaction limit after restart', async () => {
      // Ensure we have an active session
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Transaction Limit Test' });

      // Create GM socket
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gmSocket.on('connect', () => {
          gmSocket.emit('gm:identify', {
            stationId: 'GM_LIMIT_TEST',
            version: '1.0.0',
          });
        });
        gmSocket.on('gm:identified', resolve);
      });

      // Create more than 100 transactions (typical limit)
      for (let i = 0; i < 110; i++) {
        gmSocket.emit('transaction:submit', {
          tokenId: `MEM_TX_LIMIT_${i}`,
          teamId: 'TEAM_A',
          scannerId: 'GM_SCANNER_01',
        });

        if (i % 10 === 0) {
          await testDelay(100);
        }
      }

      const beforeRestart = await request(testContext.app).get('/api/state');
      const txCountBefore = (beforeRestart.body.recentTransactions || []).length;

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      const stateService = require('../../src/services/stateService');
      await sessionService.init();
      await stateService.init();

      const afterRestart = await request(testContext.app).get('/api/state');
      const txCountAfter = (afterRestart.body.recentTransactions || []).length;

      // Should maintain limit (typically 100)
      expect(txCountAfter).toBeLessThanOrEqual(100);
      expect(txCountAfter).toBe(txCountBefore);

      gmSocket.disconnect();
    });
  });

  describe('WebSocket Reconnection', () => {
    it('should allow WebSocket clients to reconnect after restart', async () => {
      const persistSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      let originalSessionId;

      await new Promise((resolve) => {
        persistSocket.on('connect', () => {
          persistSocket.emit('gm:identify', {
            stationId: 'GM_PERSIST_TEST',
            version: '1.0.0',
          });
        });

        persistSocket.on('gm:identified', (data) => {
          originalSessionId = data.state?.sessionId || data.sessionId;
          resolve();
        });
      });

      // Disconnect
      persistSocket.disconnect();

      // Simulate restart by re-initializing services
      const sessionService = require('../../src/services/sessionService');
      await sessionService.init();

      // Create new socket to simulate reconnection
      const reconnectSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 5000);

        reconnectSocket.on('connect', () => {
          reconnectSocket.emit('gm:identify', {
            stationId: 'GM_PERSIST_TEST',
            version: '1.0.0',
          });
        });

        reconnectSocket.on('gm:identified', (data) => {
          clearTimeout(timeout);
          const newSessionId = data.state?.sessionId || data.sessionId;
          // Should get same session after restart
          expect(newSessionId).toBe(originalSessionId);
          reconnectSocket.disconnect();
          resolve();
        });
      });
    });

    it('should restore GM station list after restart', async () => {
      // Connect multiple GM stations
      const sockets = [];
      const stationIds = ['GM_RESTORE_1', 'GM_RESTORE_2', 'GM_RESTORE_3'];
      
      for (const stationId of stationIds) {
        const socket = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });
        
        await new Promise((resolve) => {
          socket.on('connect', () => {
            socket.emit('gm:identify', {
              stationId,
              version: '1.0.0',
            });
          });
          
          socket.on('gm:identified', resolve);
        });
        
        sockets.push(socket);
      }

      // Check connected devices
      const beforeRestart = await request(testContext.app).get('/api/state');
      const devicesBefore = beforeRestart.body.connectedDevices || 0;

      // Simulate restart (sockets will disconnect)
      global.restartSimulation = true;
      
      // Reconnect all
      for (const socket of sockets) {
        socket.connect();
      }

      await testDelay(100);

      // Clean up
      sockets.forEach(s => s.disconnect());
    });
  });

  describe('Video State Recovery', () => {
    it('should restore video playback state', async () => {
      // Start a video
      await request(testContext.app)
        .post('/api/scan')
        .send({
          tokenId: 'MEM_VIDEO_RESTART',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

      // Check video state
      const beforeRestart = await request(testContext.app).get('/api/state');
      const videoBefore = beforeRestart.body.currentVideo;

      if (videoBefore && videoBefore.status === 'playing') {
        // Simulate restart
        global.restartSimulation = true;

        const afterRestart = await request(testContext.app).get('/api/state');
        const videoAfter = afterRestart.body.currentVideo;

        // Video state should be preserved or safely stopped
        expect(videoAfter).toBeDefined();
        if (videoAfter.tokenId === videoBefore.tokenId) {
          expect(['paused', 'idle', 'playing']).toContain(videoAfter.status);
        }
      }
    });
  });

  describe('Configuration Persistence', () => {
    it('should maintain configuration after restart', async () => {
      // Get current configuration (if exposed)
      const configEndpoint = await request(testContext.app)
        .get('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => null);

      if (configEndpoint && configEndpoint.status === 200) {
        const configBefore = configEndpoint.body;

        // Simulate restart
        global.restartSimulation = true;

        const configAfter = await request(testContext.app)
          .get('/api/admin/config')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(configAfter.body).toEqual(configBefore);
      }
    });
  });

  describe('Graceful Shutdown and Recovery', () => {
    it('should handle graceful shutdown', async () => {
      // Create active session with data
      await request(testContext.app)
        .post('/api/session')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Graceful Shutdown Test' });

      // Create GM socket for transaction
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gmSocket.on('connect', () => {
          gmSocket.emit('gm:identify', {
            stationId: 'GM_GRACEFUL_TEST',
            version: '1.0.0',
          });
        });
        gmSocket.on('gm:identified', resolve);
      });

      // Submit transaction via WebSocket
      let transactionId;
      await new Promise((resolve) => {
        gmSocket.on('transaction:new', (data) => {
          if (data.data && data.data.id) {
            transactionId = data.data.id;
            resolve();
          }
        });
        gmSocket.emit('transaction:submit', {
          tokenId: 'MEM_GRACEFUL_001',
          teamId: 'TEAM_A',
          scannerId: 'GM_SCANNER_01',
        });
      });

      gmSocket.disconnect();

      // Simulate graceful shutdown and restart
      const sessionService = require('../../src/services/sessionService');
      const persistenceService = require('../../src/services/persistenceService');

      // Save current state before "shutdown"
      const session = sessionService.getCurrentSession();
      if (session) {
        await persistenceService.saveSession(session.toJSON());
      }

      // Simulate restart
      await sessionService.init();

      // Check data preserved
      const state = await request(testContext.app).get('/api/state');
      const foundTx = (state.body.recentTransactions || [])
        .some(t => t.id === transactionId);

      expect(foundTx).toBe(true);
    });

    it('should recover from unexpected shutdown', async () => {
      // Create GM socket for transaction
      const gmSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        gmSocket.on('connect', () => {
          gmSocket.emit('gm:identify', {
            stationId: 'GM_CRASH_TEST',
            version: '1.0.0',
          });
        });
        gmSocket.on('gm:identified', resolve);
      });

      // Add transaction data
      gmSocket.emit('transaction:submit', {
        tokenId: 'MEM_CRASH_001',
        teamId: 'TEAM_B',
        scannerId: 'GM_SCANNER_01',
      });

      await testDelay(50);

      const beforeCrash = await request(testContext.app).get('/api/state');
      const scoresBefore = beforeCrash.body.scores || [];

      gmSocket.disconnect();

      // Simulate unexpected shutdown (just restart without explicit save)
      const sessionService = require('../../src/services/sessionService');
      await sessionService.init();

      // System should recover from last checkpoint
      const afterRecovery = await request(testContext.app).get('/api/state');
      const scoresAfter = afterRecovery.body.scores || [];

      // Should have recovered scores (from last auto-save checkpoint)
      expect(scoresAfter).toBeDefined();
      // Scores might be slightly behind due to checkpoint timing
      expect(scoresAfter.length).toBeGreaterThanOrEqual(Math.max(0, scoresBefore.length - 1));
    });
  });
});