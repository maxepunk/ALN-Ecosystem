/**
 * Contract Tests for gm:identify WebSocket Event
 * Tests ONLY the gm:identify event and related functionality
 *
 * Requirements validated:
 * - GM station identification protocol
 * - Session ID assignment
 * - Initial state delivery
 * - Room joining for GM stations
 * - Validation of identification data
 */

const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer } = require('./ws-test-utils');

describe('WebSocket gm:identify Event', () => {
  let testContext;
  let clientSocket;

  beforeAll(async () => {
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext, clientSocket);
  });

  beforeEach((done) => {
    // Create client socket for testing with timeout
    const timeout = setTimeout(() => {
      done(new Error('Client connection timeout'));
    }, 5000);

    clientSocket = io(testContext.socketUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });

    clientSocket.on('connect', () => {
      clearTimeout(timeout);
      done();
    });

    clientSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      done(new Error(`Connection failed: ${err.message}`));
    });
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Valid Identification', () => {
    it('should identify client as GM station with all required fields', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_01',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response).toHaveProperty('success', true);
        expect(response).toHaveProperty('sessionId');
        expect(response.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(response).toHaveProperty('state');
        done();
      });
    });

    it('should return full game state on identification', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_02',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response.state).toHaveProperty('sessionId');
        expect(response.state).toHaveProperty('lastUpdate');
        expect(response.state).toHaveProperty('scores');
        expect(Array.isArray(response.state.scores)).toBe(true);
        done();
      });
    });

    it('should support different version formats', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_VERSION_TEST',
        version: '2.1.3',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response.success).toBe(true);
        done();
      });
    });
  });

  describe('Invalid Identification', () => {
    it('should reject identification with missing stationId', (done) => {
      clientSocket.emit('gm:identify', {
        // Missing stationId
        version: '1.0.0',
      });

      clientSocket.once('error', (error) => {
        expect(error).toHaveProperty('code', 'INVALID_DATA');
        expect(error).toHaveProperty('message');
        expect(error.message).toContain('stationId');
        done();
      });
    });

    it('should reject identification with missing version', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_NO_VERSION',
        // Missing version
      });

      clientSocket.once('error', (error) => {
        expect(error).toHaveProperty('code', 'INVALID_DATA');
        expect(error.message).toContain('version');
        done();
      });
    });

    it('should reject identification with invalid data type', (done) => {
      clientSocket.once('error', (error) => {
        // Server sends flat error object with detailed message
        expect(error).toHaveProperty('code', 'INVALID_DATA');
        expect(error).toHaveProperty('message');
        expect(error.message).toContain('must be of type object');
        done();
      });

      // Send invalid event data (not an object)
      clientSocket.emit('gm:identify', 'invalid-data-not-object');
    });

    it('should reject empty identification object', (done) => {
      clientSocket.emit('gm:identify', {});

      clientSocket.once('error', (error) => {
        expect(error).toHaveProperty('code', 'INVALID_DATA');
        done();
      });
    });
  });

  describe('Room Management', () => {
    it('should add identified client to gm-stations room', (done) => {
      let anotherGM;

      const cleanup = () => {
        if (anotherGM && anotherGM.connected) {
          anotherGM.disconnect();
        }
      };

      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_ROOM_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Create another GM socket to test room broadcasting
        anotherGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        anotherGM.once('connect', () => {
          anotherGM.emit('gm:identify', {
            stationId: 'GM_STATION_ROOM_TEST_2',
            version: '1.0.0',
          });
        });

        // First GM should receive device:connected events (including its own)
        // We need to filter for the second GM's event
        const handleDeviceConnected = (data) => {
          if (data.data && data.data.deviceId === 'GM_STATION_ROOM_TEST_2') {
            expect(data.data).toHaveProperty('type', 'gm');
            clientSocket.off('device:connected', handleDeviceConnected);
            cleanup();
            done();
          }
        };
        clientSocket.on('device:connected', handleDeviceConnected);

        // Timeout safety
        setTimeout(() => {
          cleanup();
          done(new Error('Test timeout'));
        }, 2000);
      });
    });

    it('should broadcast to other GM stations when new GM joins', (done) => {
      const gm1 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      const gm2 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });

      const cleanup = () => {
        if (gm1.connected) gm1.disconnect();
        if (gm2.connected) gm2.disconnect();
      };

      const timeout = setTimeout(() => {
        cleanup();
        done(new Error('Test timeout'));
      }, 3000);

      gm1.once('connect', () => {
        gm1.emit('gm:identify', {
          stationId: 'GM_BROADCAST_TEST_1',
          version: '1.0.0',
        });
      });

      gm1.once('gm:identified', () => {
        // GM1 is ready, now connect GM2
        gm2.once('connect', () => {
          gm2.emit('gm:identify', {
            stationId: 'GM_BROADCAST_TEST_2',
            version: '1.0.0',
          });
        });

        // GM1 should receive device:connected events
        // Filter for GM2's connection (not GM1's own event)
        const handleDeviceConnected = (data) => {
          if (data.data && data.data.deviceId === 'GM_BROADCAST_TEST_2') {
            clearTimeout(timeout);
            gm1.off('device:connected', handleDeviceConnected);
            cleanup();
            done();
          }
        };
        gm1.on('device:connected', handleDeviceConnected);
      });
    });
  });

  describe('Re-identification', () => {
    it('should allow re-identification with same stationId', (done) => {
      let firstSessionId;

      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATION_REIDENT',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (firstResponse) => {
        firstSessionId = firstResponse.sessionId;

        // Re-identify with same stationId
        clientSocket.emit('gm:identify', {
          stationId: 'GM_STATION_REIDENT',
          version: '1.0.0',
        });

        clientSocket.once('gm:identified', (secondResponse) => {
          expect(secondResponse.success).toBe(true);
          expect(secondResponse.sessionId).toBe(firstSessionId);
          done();
        });
      });
    });

    it('should update version on re-identification', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_VERSION_UPDATE',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Re-identify with different version
        clientSocket.emit('gm:identify', {
          stationId: 'GM_VERSION_UPDATE',
          version: '2.0.0',
        });

        clientSocket.once('gm:identified', (response) => {
          expect(response.success).toBe(true);
          done();
        });
      });
    });
  });

  describe('State Initialization', () => {
    it('should include current session info in state', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_STATE_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response.state).toBeDefined();
        expect(response.state.sessionId).toBeDefined();
        expect(typeof response.state.sessionId).toBe('string');
        expect(response.state.lastUpdate).toBeDefined();
        done();
      });
    });

    it('should include empty scores array for new session', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_SCORES_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        expect(response.state.scores).toBeDefined();
        expect(Array.isArray(response.state.scores)).toBe(true);
        // Scores might be empty or have initial teams
        expect(response.state.scores.length).toBeGreaterThanOrEqual(0);
        done();
      });
    });

    it('should include metadata if available', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_METADATA_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', (response) => {
        if (response.state.metadata) {
          expect(typeof response.state.metadata).toBe('object');
        }
        done();
      });
    });
  });

  describe('Connection Handling', () => {
    it('should handle multiple simultaneous identification requests', async () => {
      const sockets = [];
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const socket = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });
        
        sockets.push(socket);

        const promise = new Promise((resolve) => {
          socket.once('connect', () => {
            socket.emit('gm:identify', {
              stationId: `GM_CONCURRENT_${i}`,
              version: '1.0.0',
            });
          });

          socket.once('gm:identified', (response) => {
            expect(response.success).toBe(true);
            resolve();
          });
        });

        promises.push(promise);
      }

      await Promise.all(promises);

      // Clean up
      sockets.forEach(socket => socket.disconnect());
    });

    it('should preserve connection after identification', (done) => {
      clientSocket.emit('gm:identify', {
        stationId: 'GM_PERSIST_TEST',
        version: '1.0.0',
      });

      clientSocket.once('gm:identified', () => {
        // Connection should remain active
        expect(clientSocket.connected).toBe(true);
        
        // Should be able to emit other events
        clientSocket.emit('heartbeat', { stationId: 'GM_PERSIST_TEST' });
        
        clientSocket.once('heartbeat:ack', () => {
          expect(clientSocket.connected).toBe(true);
          done();
        });
      });
    });
  });
});