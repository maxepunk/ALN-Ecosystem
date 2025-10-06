/**
 * OrchestratorClient Unit Tests
 *
 * Tests WebSocket client event handling per AsyncAPI contract
 * Validates connection, reconnection, event emitters, and cleanup
 */

// Load browser mocks first
require('../../helpers/browser-mocks');

// Create mockSocket
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  once: jest.fn(),
  connected: false
};

// Set global.io to a mock function that returns mockSocket
// (OrchestratorClient uses global.io, not require('socket.io-client'))
global.io = jest.fn().mockReturnValue(mockSocket);

// Now load OrchestratorClient - it will use global.io
const OrchestratorClient = require('../../../../ALNScanner/js/network/orchestratorClient');

describe('OrchestratorClient - WebSocket Event Handling', () => {
  let client;

  beforeEach(() => {
    // Clear localStorage
    global.localStorage.clear();

    // Reset window.location to defaults (test isolation)
    global.window.location.pathname = '/gm-scanner/';
    global.window.location.origin = 'http://localhost:3000';

    // Reset mock socket state
    mockSocket.connected = false;
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.once.mockClear();

    // Reset global.io mock calls and re-set return value
    global.io.mockClear();
    global.io.mockReturnValue(mockSocket);

    // Create client instance
    client = new OrchestratorClient({
      url: 'http://localhost:3000',
      deviceId: 'GM_TEST',
      version: '1.0.0'
    });
  });

  afterEach(() => {
    if (client) {
      client.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(client.config.url).toBe('http://localhost:3000');
      expect(client.config.deviceId).toBe('GM_TEST');
      expect(client.config.version).toBe('1.0.0');
    });

    it('should auto-detect orchestrator URL when served from orchestrator', () => {
      global.window.location.pathname = '/gm-scanner/';
      global.window.location.origin = 'http://192.168.1.100:3000';

      const newClient = new OrchestratorClient();

      expect(newClient.config.url).toBe('http://192.168.1.100:3000');

      // Cleanup
      newClient.cleanup();
    });

    it('should load saved URL from localStorage', () => {
      // Set pathname to NOT match '/gm-scanner/' so localStorage is checked
      global.window.location.pathname = '/';

      localStorage.setItem('orchestrator_url', 'http://192.168.1.50:3000');

      const newClient = new OrchestratorClient();

      expect(newClient.config.url).toBe('http://192.168.1.50:3000');

      // Cleanup
      newClient.cleanup();
    });

    it('should initialize with disconnected state', () => {
      expect(client.isConnected).toBe(false);
      expect(client.connectionStatus).toBe('disconnected');
      expect(client.socket).toBeNull();
    });
  });

  describe('Connection', () => {
    beforeEach(() => {
      // Set token (required for connection)
      client.token = 'test-jwt-token';
    });

    it('should require token before connecting', async () => {
      const clientWithoutToken = new OrchestratorClient({
        url: 'http://localhost:3000',
        deviceId: 'GM_TEST'
      });

      await clientWithoutToken.connect();

      expect(clientWithoutToken.connectionStatus).toBe('disconnected');
      expect(io).not.toHaveBeenCalled();

      clientWithoutToken.cleanup();
    });

    it('should create socket connection with auth in handshake', async () => {
      await client.connect();

      expect(io).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          auth: {
            token: 'test-jwt-token',
            deviceId: 'GM_TEST',
            deviceType: 'gm',
            version: '1.0.0'
          }
        })
      );
    });

    it('should set connection status to connecting', async () => {
      await client.connect();

      expect(client.connectionStatus).toBe('connecting');
    });

    it('should prevent duplicate connections', async () => {
      const mockSocket = {
        connected: true,
        on: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn()
      };

      client.socket = mockSocket;

      await client.connect();

      // Should not create new connection
      expect(io).not.toHaveBeenCalled();
    });
  });

  describe('Event Listener Registration', () => {
    beforeEach(() => {
      client.token = 'test-token';
    });

    it('should register all AsyncAPI server events', async () => {
      await client.connect();

      // Verify socket was created
      expect(client.socket).toBeDefined();
      expect(client.socket).toBe(mockSocket);

      // Verify all AsyncAPI server→client events are registered
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('gm:identified', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('transaction:new', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('transaction:result', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('video:status', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('score:updated', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('group:completed', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('device:connected', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('device:disconnected', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('sync:full', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('session:update', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('gm:command:ack', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('offline:queue:processed', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Event Emitter Functionality', () => {
    it('should register event handlers', () => {
      const handler = jest.fn();

      client.on('test:event', handler);

      expect(client.eventHandlers['test:event']).toContain(handler);
    });

    it('should call registered handlers when event emitted', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      client.on('test:event', handler1);
      client.on('test:event', handler2);

      client.emit('test:event', { data: 'test' });

      expect(handler1).toHaveBeenCalledWith({ data: 'test' });
      expect(handler2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove specific event handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      client.on('test:event', handler1);
      client.on('test:event', handler2);

      client.off('test:event', handler1);

      client.emit('test:event', { data: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should remove all handlers for event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      client.on('test:event', handler1);
      client.on('test:event', handler2);

      client.off('test:event');

      client.emit('test:event', { data: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle errors in event handlers gracefully', () => {
      const badHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = jest.fn();

      client.on('test:event', badHandler);
      client.on('test:event', goodHandler);

      // Should not throw
      expect(() => {
        client.emit('test:event', {});
      }).not.toThrow();

      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('Disconnection', () => {
    beforeEach(() => {
      client.token = 'test-token';
    });

    it('should disconnect socket and cleanup', () => {
      const mockSocket = {
        connected: true,
        on: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn()
      };

      client.socket = mockSocket;
      client.isConnected = true;

      client.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
      expect(client.connectionStatus).toBe('disconnected');
    });
  });

  describe('Rate Limiting', () => {
    it('should queue events when rate limited', () => {
      const fn = jest.fn();

      client.addToRateLimitQueue(fn);

      // Should be queued
      expect(client.rateLimitQueue).toHaveLength(1);
    });

    it('should process rate limit queue with delay', (done) => {
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      client.addToRateLimitQueue(fn1);
      client.addToRateLimitQueue(fn2);

      // Both should be rate limited (not execute immediately)
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();

      // First should execute after ~100ms, second after ~200ms
      setTimeout(() => {
        expect(fn1).toHaveBeenCalled();
        expect(fn2).toHaveBeenCalled();
        done();
      }, 250);
    });
  });

  describe('State Request', () => {
    beforeEach(() => {
      client.token = 'test-token';
    });

    it('should emit state:request when connected', async () => {
      await client.connect();

      // Verify socket was created
      expect(client.socket).toBe(mockSocket);

      // Set socket to connected state
      mockSocket.connected = true;

      client.requestStateSync();

      expect(mockSocket.emit).toHaveBeenCalledWith('state:request', {});
    });

    it('should not request state when disconnected', () => {
      client.socket = {
        connected: false,
        emit: jest.fn()
      };

      client.requestStateSync();

      expect(client.socket.emit).not.toHaveBeenCalled();
    });

    it('should rate limit state requests (max 1 per 5 seconds)', async () => {
      await client.connect();

      // Set socket to connected state
      mockSocket.connected = true;

      // First request should work
      client.requestStateSync();
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);

      // Second request within 5 seconds should be rate limited
      client.requestStateSync();
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should clear all timers on cleanup', () => {
      client.rateLimitTimer = setTimeout(() => {}, 1000);
      client.saveTimer = setTimeout(() => {}, 1000);

      client.cleanup();

      expect(client.rateLimitTimer).toBeNull();
      expect(client.saveTimer).toBeNull();
    });

    it('should reset connection state on cleanup', () => {
      client.isConnected = true;
      client.sessionId = 'test-session';
      client.connectedDevices = ['device1', 'device2'];

      client.cleanup();

      expect(client.isConnected).toBe(false);
      expect(client.connectionStatus).toBe('disconnected');
      expect(client.sessionId).toBeNull();
      expect(client.connectedDevices).toEqual([]);
    });

    it('should limit rate queue size on cleanup', () => {
      // Fill queue with 100 items
      for (let i = 0; i < 100; i++) {
        client.rateLimitQueue.push(() => {});
      }

      client.cleanup();

      // Should keep only last 50
      expect(client.rateLimitQueue.length).toBe(50);
    });
  });

  describe('Connection Status', () => {
    it('should report connection status correctly', () => {
      client.isConnected = true;
      client.sessionId = 'test-session-id';
      client.connectedDevices = ['device1', 'device2'];

      const status = client.getConnectionStatus();

      expect(status.isConnected).toBe(true);
      expect(status.status).toBe('disconnected'); // from initial state
      expect(status.sessionId).toBe('test-session-id');
      expect(status.connectedDevices).toBe(2);
      expect(status.queueSize).toBe(0);
    });
  });
});
