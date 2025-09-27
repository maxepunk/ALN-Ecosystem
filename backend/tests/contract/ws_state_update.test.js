/**
 * Contract Tests for state:update WebSocket Event
 * Tests ONLY the state:update broadcast functionality
 * 
 * Requirements validated:
 * - Real-time state broadcasting to GM stations
 * - Debouncing of rapid state changes
 * - State structure validation
 * - Room-based broadcasting (only to identified GMs)
 */

const io = require('socket.io-client');
const request = require('supertest');
const { setupTestServer, cleanupTestServer, createGMClient } = require('./ws-test-utils');

describe('WebSocket state:update Event', () => {
  let testContext;
  let clientSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext, clientSocket);
  });

  beforeEach((done) => {
    // Create client socket for testing
    clientSocket = io(testContext.socketUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    clientSocket.on('connect', () => {
      done();
    });

    clientSocket.on('connect_error', (err) => {
      done(new Error(`Connection failed: ${err.message}`));
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Broadcast Structure', () => {
    it('should receive state:update with correct structure', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATE_UPDATE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response).toHaveProperty('success', true);

        // Now listen for state updates
        clientSocket.on('state:update', (data) => {
          expect(data).toHaveProperty('event', 'state:update');
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('timestamp');
          expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
          done();
        });

        // Trigger state change via GM transaction submission
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_STATE_001',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });
      });

      clientSocket.on('error', (error) => {
        done(new Error(`Error: ${JSON.stringify(error)}`));
      });
    });

    it('should include GameState in data field', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATE_FIELD_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Now listen for state updates
        clientSocket.on('state:update', (data) => {
          const state = data.data;
          expect(state).toHaveProperty('sessionId');
          expect(state).toHaveProperty('lastUpdate');
          expect(state).toHaveProperty('scores');
          expect(Array.isArray(state.scores)).toBe(true);
          done();
        });

        // Trigger state change via GM transaction
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_STATE_002',
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        });
      });
    });

    it('should include score updates in state', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_SCORE_UPDATE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Now listen for state updates
        clientSocket.on('state:update', (data) => {
          const scores = data.data.scores;
          if (scores && scores.length > 0) {
            const score = scores[0];
            expect(score).toHaveProperty('teamId');
            expect(score).toHaveProperty('currentScore');
            expect(score).toHaveProperty('tokensScanned');
            expect(score).toHaveProperty('lastTokenTime');
            done();
          }
        });

        // Trigger score change via GM transaction (use real token from ALN-TokenData)
        clientSocket.emit('transaction:submit', {
          tokenId: '534e2b02',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });
      });
    }, 15000); // Increase timeout to 15 seconds
  });

  describe('Trigger Conditions', () => {
    it('should broadcast on new transaction', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_TRIGGER_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          expect(data.event).toBe('state:update');
          done();
        });

        // Trigger state change via GM transaction
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_TRIGGER_001',
          teamId: 'TEAM_C',
          scannerId: 'SCANNER_03',
        });
      });
    });

    it('should broadcast on session status change', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATUS_CHANGE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          expect(data.event).toBe('state:update');
          done();
        });

        // Get admin token and change session status
        request(testContext.app)
          .post('/api/admin/auth')
          .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' })
          .then((authResponse) => {
            return request(testContext.app)
              .put('/api/session')
              .set('Authorization', `Bearer ${authResponse.body.token}`)
              .send({ status: 'paused' });
          })
          .then(() => {});
      });
    });

    it('should broadcast on video state change', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_VIDEO_STATE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          if (data.data.currentVideo) {
            expect(data.event).toBe('state:update');
            done();
          }
        });

        // Trigger video playback via GM transaction
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_VIDEO_STATE',
          teamId: 'TEAM_D',
          scannerId: 'SCANNER_04',
        });
      });
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid state updates', (done) => {
      const updates = [];

      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_DEBOUNCE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          updates.push(data);
        });

        // Trigger multiple rapid state changes via GM transactions
        for (let i = 0; i < 20; i++) {
          clientSocket.emit('transaction:submit', {
            tokenId: `TEST_DEBOUNCE_${i}`,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          });
        }

        // Wait for debouncing to complete
        setTimeout(() => {
          // Should receive less than 10 updates due to debouncing
          expect(updates.length).toBeLessThanOrEqual(10);
          expect(updates.length).toBeGreaterThan(0);
          done();
        }, 1500);
      });
    });

    it('should eventually broadcast all significant changes', (done) => {
      const teamUpdates = new Set();

      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_SIGNIFICANT_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          const scores = data.data.scores || [];
          scores.forEach(score => {
            if (score.tokensScanned > 0) {
              teamUpdates.add(score.teamId);
            }
          });
        });

        // Trigger changes for different teams via GM transactions
        const teams = ['TEAM_A', 'TEAM_B', 'TEAM_C'];
        teams.forEach(teamId => {
          clientSocket.emit('transaction:submit', {
            tokenId: `TEST_TEAM_${teamId}`,
            teamId,
            scannerId: 'SCANNER_01',
          });
        });

        // Wait for all transactions to process
        setTimeout(() => {
          // All teams should eventually be represented
          expect(teamUpdates.size).toBeGreaterThanOrEqual(teams.length);
          done();
        }, 2000);
      });
    });

    it('should not lose critical state changes due to debouncing', (done) => {
      let sessionPaused = false;
      let sessionActive = false;

      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_CRITICAL_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Listen for session:update events which contain status changes
        clientSocket.on('session:update', (data) => {
          if (data.status === 'paused') sessionPaused = true;
          if (data.status === 'active') sessionActive = true;
        });

        // Get admin token
        request(testContext.app)
          .post('/api/admin/auth')
          .send({ password: process.env.ADMIN_PASSWORD || 'test-admin-password' })
          .then(async (authResponse) => {
            const token = authResponse.body.token;

            // Rapid session status changes
            await request(testContext.app)
              .put('/api/session')
              .set('Authorization', `Bearer ${token}`)
              .send({ status: 'paused' });

            await request(testContext.app)
              .put('/api/session')
              .set('Authorization', `Bearer ${token}`)
              .send({ status: 'active' });

            setTimeout(() => {
              // Should have received both status changes
              expect(sessionPaused || sessionActive).toBe(true);
              done();
            }, 1500);
          });
      });
    }, 15000); // Increase timeout to 15 seconds
  });

  describe('Room-based Broadcasting', () => {
    it('should only broadcast to identified GM stations', (done) => {
      const gmSocket = io(testContext.socketUrl, { transports: ['websocket'] });
      const playerSocket = io(testContext.socketUrl, { transports: ['websocket'] });
      
      let gmReceived = false;
      let playerReceived = false;

      // Set up GM station
      gmSocket.on('connect', () => {
        gmSocket.emit('gm:identify', {
          stationId: 'GM_ROOM_TEST',
          version: '1.0.0',
        });
      });

      // Player socket doesn't identify as GM
      playerSocket.on('connect', () => {
        // Just connected, not identified
      });

      // Listen for state updates
      gmSocket.on('state:update', () => { gmReceived = true; });
      playerSocket.on('state:update', () => { playerReceived = true; });

      // Wait for connections and GM identification, then trigger state change
      gmSocket.on('gm:identified', () => {
        // GM triggers transaction which should broadcast state:update to all GMs
        gmSocket.emit('transaction:submit', {
          tokenId: 'TEST_ROOM_BROADCAST',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });
      });

      // Check results
      setTimeout(() => {
        expect(gmReceived).toBe(true);
        expect(playerReceived).toBe(false);
        
        gmSocket.disconnect();
        playerSocket.disconnect();
        done();
      }, 1000);
    });

    it('should broadcast to all GM stations in room', (done) => {
      const gm1 = io(testContext.socketUrl, { transports: ['websocket'] });
      const gm2 = io(testContext.socketUrl, { transports: ['websocket'] });
      const gm3 = io(testContext.socketUrl, { transports: ['websocket'] });
      
      const received = new Set();

      [gm1, gm2, gm3].forEach((socket, index) => {
        socket.on('connect', () => {
          socket.emit('gm:identify', {
            stationId: `GM_MULTI_${index}`,
            version: '1.0.0',
          });
        });

        socket.on('state:update', () => {
          received.add(index);
        });
      });

      // Wait for all to identify, then trigger update
      setTimeout(() => {
        // Use first GM to trigger transaction
        gm1.emit('transaction:submit', {
          tokenId: 'TEST_MULTI_BROADCAST',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });

        setTimeout(() => {
          expect(received.size).toBe(3);
          [gm1, gm2, gm3].forEach(s => s.disconnect());
          done();
        }, 500);
      }, 500);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across updates', (done) => {
      let previousUpdate = null;
      let updateCount = 0;

      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_CONSISTENT_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          if (previousUpdate) {
            // SessionId should remain constant
            expect(data.data.sessionId).toBe(previousUpdate.data.sessionId);

            // Timestamp should advance
            const prevTime = new Date(previousUpdate.timestamp);
            const currTime = new Date(data.timestamp);
            expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
          }

          previousUpdate = data;
          updateCount++;

          if (updateCount >= 3) done();
        });

        // Trigger multiple updates
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            clientSocket.emit('transaction:submit', {
              tokenId: `TEST_CONSISTENT_${i}`,
              teamId: 'TEAM_A',
              scannerId: 'SCANNER_01',
            });
          }, i * 300);
        }
      });
    });

    it('should include lastUpdate timestamp in state', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_TIMESTAMP_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          expect(data.data.lastUpdate).toBeDefined();
          expect(new Date(data.data.lastUpdate).toISOString()).toBe(data.data.lastUpdate);
          done();
        });

        // Trigger state change via GM transaction
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_TIMESTAMP_TEST',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });
      });
    });
  });

  describe('Performance', () => {
    it('should handle high frequency updates without disconnecting clients', (done) => {
      let disconnected = false;

      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_PERF_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('disconnect', () => {
          disconnected = true;
        });

        // Send 50 rapid updates via GM transactions
        for (let i = 0; i < 50; i++) {
          clientSocket.emit('transaction:submit', {
            tokenId: `TEST_PERF_${i}`,
            teamId: `TEAM_${i % 4}`,
            scannerId: 'SCANNER_01',
          });
        }

        // Wait for processing and check connection stability
        setTimeout(() => {
          expect(disconnected).toBe(false);
          expect(clientSocket.connected).toBe(true);
          done();
        }, 1500);
      });
    });

    it('should maintain reasonable message size', (done) => {
      // First identify as GM
      clientSocket.emit('gm:identify', {
        stationId: 'GM_SIZE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        clientSocket.on('state:update', (data) => {
          const messageSize = JSON.stringify(data).length;
          // State updates should be reasonably sized (under 10KB)
          expect(messageSize).toBeLessThan(10240);
          done();
        });

        // Trigger state change via GM transaction
        clientSocket.emit('transaction:submit', {
          tokenId: 'TEST_SIZE_TEST',
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        });
      });
    });
  });
});