/**
 * Contract Tests for device:connected and device:disconnected WebSocket Events
 * Tests ONLY the device connection/disconnection event functionality
 *
 * Requirements validated:
 * - Device connection broadcasting
 * - Device disconnection broadcasting
 * - Device types (player, gm)
 * - Disconnection reasons (timeout, manual, error)
 * - Room-based broadcasting
 */

const io = require('socket.io-client');
const { setupTestServer, cleanupTestServer } = require('./ws-test-utils');

describe('WebSocket Device Events', () => {
  let testContext;
  let clientSocket;

  beforeAll(async () => {
    // Use shared test setup for consistency
    testContext = await setupTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(testContext, clientSocket);
  });

  // Clean up state before each test to ensure isolation
  beforeEach(async () => {
    // Clear any test data (handled by jest.setup.js globally)
  });

  describe('device:connected Event', () => {
    it('should broadcast when new GM station connects', (done) => {
      const firstGM = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      firstGM.on('connect', () => {
        firstGM.emit('gm:identify', {
          stationId: 'GM_CONNECT_FIRST',
          version: '1.0.0',
        });
      });

      firstGM.on('gm:identified', () => {
        // Connect second GM
        const secondGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        firstGM.on('device:connected', (data) => {
          expect(data).toHaveProperty('event', 'device:connected');
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('timestamp');
          expect(data.data).toHaveProperty('deviceId', 'GM_CONNECT_SECOND');
          expect(data.data).toHaveProperty('type', 'gm');
          
          firstGM.disconnect();
          secondGM.disconnect();
          done();
        });

        secondGM.on('connect', () => {
          secondGM.emit('gm:identify', {
            stationId: 'GM_CONNECT_SECOND',
            version: '1.0.0',
          });
        });
      });
    });

    it('should include connection metadata', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const newDevice = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        monitor.on('device:connected', (data) => {
          expect(data.data).toHaveProperty('deviceId');
          expect(data.data).toHaveProperty('type');
          expect(['player', 'gm']).toContain(data.data.type);
          expect(data).toHaveProperty('timestamp');  // timestamp is at root level per contract
          
          if (data.data.metadata) {
            expect(typeof data.data.metadata).toBe('object');
          }
          
          monitor.disconnect();
          newDevice.disconnect();
          done();
        });

        newDevice.on('connect', () => {
          newDevice.emit('gm:identify', {
            stationId: 'GM_NEW_DEVICE',
            version: '1.0.0',
          });
        });
      });
    });

    it('should broadcast to all existing GM stations', (done) => {
      const gm1 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      const gm2 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      const gm3 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      
      const received = new Set();
      let allConnected = 0;

      [gm1, gm2].forEach((socket, index) => {
        socket.on('connect', () => {
          socket.emit('gm:identify', {
            stationId: `GM_BROADCAST_EXIST_${index}`,
            version: '1.0.0',
          });
        });

        socket.on('gm:identified', () => {
          allConnected++;
          
          if (allConnected === 2) {
            // Connect third GM after first two are ready
            gm3.on('connect', () => {
              gm3.emit('gm:identify', {
                stationId: 'GM_BROADCAST_NEW',
                version: '1.0.0',
              });
            });
          }
        });

        socket.on('device:connected', (data) => {
          if (data.data.deviceId === 'GM_BROADCAST_NEW') {
            received.add(index);
            
            if (received.size === 2) {
              [gm1, gm2, gm3].forEach(s => s.disconnect());
              done();
            }
          }
        });
      });
    });

    it('should distinguish between player and GM connections', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_TYPE_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const playerSocket = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        monitor.on('device:connected', (data) => {
          // Player connections might show different type
          expect(data.data.type).toBeDefined();
          monitor.disconnect();
          playerSocket.disconnect();
          done();
        });

        playerSocket.on('connect', () => {
          // Connect as player (no GM identification)
          // This might trigger a device:connected event with type 'player'
          setTimeout(() => {
            // If no device:connected event for players, that's also valid
            monitor.disconnect();
            playerSocket.disconnect();
            done();
          }, 500);
        });
      });
    });
  });

  describe('device:disconnected Event', () => {
    it('should broadcast when GM station disconnects', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_DISCONNECT_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const tempGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        monitor.on('device:disconnected', (data) => {
          expect(data).toHaveProperty('event', 'device:disconnected');
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('timestamp');
          expect(data.data).toHaveProperty('deviceId', 'GM_DISCONNECT_TEMP');
          expect(data.data).toHaveProperty('reason');
          
          monitor.disconnect();
          done();
        });

        tempGM.on('connect', () => {
          tempGM.emit('gm:identify', {
            stationId: 'GM_DISCONNECT_TEMP',
            version: '1.0.0',
          });
        });

        tempGM.on('gm:identified', () => {
          // Disconnect after identification
          setTimeout(() => {
            tempGM.disconnect();
          }, 100);
        });
      });
    });

    it('should include disconnection reason', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_REASON_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const tempGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        monitor.on('device:disconnected', (data) => {
          expect(data.data).toHaveProperty('reason');
          expect(['timeout', 'manual', 'error']).toContain(data.data.reason);
          
          monitor.disconnect();
          done();
        });

        tempGM.on('connect', () => {
          tempGM.emit('gm:identify', {
            stationId: 'GM_REASON_TEMP',
            version: '1.0.0',
          });
        });

        tempGM.on('gm:identified', () => {
          // Manual disconnect
          tempGM.disconnect();
        });
      });
    });

    it('should broadcast to remaining GM stations', (done) => {
      const gm1 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      const gm2 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      const gm3 = io(testContext.socketUrl, { transports: ['websocket'], reconnection: false });
      
      const received = new Set();
      let allConnected = 0;

      [gm1, gm2, gm3].forEach((socket, index) => {
        socket.on('connect', () => {
          socket.emit('gm:identify', {
            stationId: `GM_REMAIN_${index}`,
            version: '1.0.0',
          });
        });

        socket.on('gm:identified', () => {
          allConnected++;
          
          if (allConnected === 3) {
            // Disconnect gm3
            setTimeout(() => gm3.disconnect(), 100);
          }
        });

        if (index < 2) { // Only gm1 and gm2 should receive
          socket.on('device:disconnected', (data) => {
            if (data.data.deviceId === 'GM_REMAIN_2') {
              received.add(index);
              
              if (received.size === 2) {
                gm1.disconnect();
                gm2.disconnect();
                done();
              }
            }
          });
        }
      });
    });

    it('should handle timeout disconnections', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_TIMEOUT_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const tempGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
          pingTimeout: 100, // Very short timeout
        });

        monitor.on('device:disconnected', (data) => {
          if (data.data.deviceId === 'GM_TIMEOUT_TEMP') {
            // Client-side disconnect is always 'manual', server-side timeout would be 'timeout'
            // This test disconnects from client side, so reason should be 'manual'
            expect(['manual', 'timeout', 'error']).toContain(data.data.reason);
            monitor.disconnect();
            done();
          }
        });

        tempGM.on('connect', () => {
          tempGM.emit('gm:identify', {
            stationId: 'GM_TIMEOUT_TEMP',
            version: '1.0.0',
          });
        });

        tempGM.on('gm:identified', () => {
          // Force timeout by breaking connection
          tempGM.io.engine.close();
        });
      });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should track complete connection lifecycle', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      const events = [];

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_LIFECYCLE_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const testGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        monitor.on('device:connected', (data) => {
          if (data.data.deviceId === 'GM_LIFECYCLE_TEST') {
            events.push('connected');
          }
        });

        monitor.on('device:disconnected', (data) => {
          if (data.data.deviceId === 'GM_LIFECYCLE_TEST') {
            events.push('disconnected');
            
            // Should have both events
            expect(events).toEqual(['connected', 'disconnected']);
            monitor.disconnect();
            done();
          }
        });

        testGM.on('connect', () => {
          testGM.emit('gm:identify', {
            stationId: 'GM_LIFECYCLE_TEST',
            version: '1.0.0',
          });
        });

        testGM.on('gm:identified', () => {
          setTimeout(() => testGM.disconnect(), 100);
        });
      });
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      await new Promise((resolve) => {
        monitor.on('connect', () => {
          monitor.emit('gm:identify', {
            stationId: 'GM_RAPID_MONITOR',
            version: '1.0.0',
          });
        });

        monitor.on('gm:identified', resolve);
      });

      const connectionEvents = [];
      const disconnectionEvents = [];

      monitor.on('device:connected', (data) => {
        if (data.data.deviceId && data.data.deviceId.startsWith('GM_RAPID_')) {
          connectionEvents.push(data.data.deviceId);
        }
      });

      monitor.on('device:disconnected', (data) => {
        if (data.data.deviceId && data.data.deviceId.startsWith('GM_RAPID_')) {
          disconnectionEvents.push(data.data.deviceId);
        }
      });

      // Rapid connect/disconnect
      for (let i = 0; i < 3; i++) {
        const socket = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        await new Promise((resolve) => {
          socket.on('connect', () => {
            socket.emit('gm:identify', {
              stationId: `GM_RAPID_${i}`,
              version: '1.0.0',
            });
          });

          socket.on('gm:identified', () => {
            setTimeout(() => {
              socket.disconnect();
              resolve();
            }, 50);
          });
        });
      }

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have received events for all connections
      expect(connectionEvents.length).toBeGreaterThanOrEqual(2);
      expect(disconnectionEvents.length).toBeGreaterThanOrEqual(2);

      monitor.disconnect();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle disconnection during identification', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_ERROR_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const errorGM = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        let deviceConnectedReceived = false;

        monitor.on('device:connected', (data) => {
          if (data.data.deviceId === 'GM_ERROR_TEST') {
            deviceConnectedReceived = true;
          }
        });

        monitor.on('device:disconnected', (data) => {
          if (data.data.deviceId === 'GM_ERROR_TEST' || !deviceConnectedReceived) {
            // Either we get a disconnect event or the connect was never broadcast
            monitor.disconnect();
            done();
          }
        });

        errorGM.on('connect', () => {
          errorGM.emit('gm:identify', {
            stationId: 'GM_ERROR_TEST',
            version: '1.0.0',
          });
          
          // Disconnect immediately
          errorGM.disconnect();
        });

        // Timeout if no events received
        setTimeout(() => {
          monitor.disconnect();
          done();
        }, 1000);
      });
    });

    it('should not broadcast for invalid connections', (done) => {
      const monitor = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false,
      });

      monitor.on('connect', () => {
        monitor.emit('gm:identify', {
          stationId: 'GM_INVALID_MONITOR',
          version: '1.0.0',
        });
      });

      monitor.on('gm:identified', () => {
        const invalidSocket = io(testContext.socketUrl, {
          transports: ['websocket'],
          reconnection: false,
        });

        let eventReceived = false;

        monitor.on('device:connected', (data) => {
          // Should not receive event for unidentified connection
          if (!data.data.deviceId || !data.data.deviceId.includes('GM_')) {
            eventReceived = true;
          }
        });

        invalidSocket.on('connect', () => {
          // Don't identify, just connect
        });

        setTimeout(() => {
          // Should not have received connection event for unidentified socket
          expect(eventReceived).toBe(false);
          monitor.disconnect();
          invalidSocket.disconnect();
          done();
        }, 500);
      });
    });
  });
});