/**
 * Server Initialization Order Tests (Phase 1.3 P0.3)
 * Tests correct initialization sequence to prevent race conditions
 */

describe('Server Initialization Order (Phase 1.3)', () => {
  describe('ServerState enum', () => {
    it('should define all required states', () => {
      // This test will fail until we add ServerState enum
      const { ServerState } = require('../../../src/server');

      expect(ServerState).toBeDefined();
      expect(ServerState.UNINITIALIZED).toBe('uninitialized');
      expect(ServerState.SERVICES_READY).toBe('services_ready');
      expect(ServerState.HANDLERS_READY).toBe('handlers_ready');
      expect(ServerState.LISTENING).toBe('listening');
    });
  });

  describe('Initialization order enforcement', () => {
    it('should start in UNINITIALIZED state', () => {
      // Reset server module
      jest.resetModules();
      const { getServerState } = require('../../../src/server');

      expect(getServerState()).toBe('uninitialized');
    });

    it('should transition to SERVICES_READY after initializeServices', async () => {
      jest.resetModules();

      // Mock app.js to prevent real service initialization
      jest.doMock('../../../src/app', () => {
        const mockApp = function () { };
        mockApp.use = jest.fn();
        mockApp.locals = {};
        mockApp.app = mockApp;
        mockApp.initializeServices = jest.fn().mockResolvedValue();
        return mockApp;
      });

      const { getServerState, initializeForTest } = require('../../../src/server');

      // Simulate service initialization
      await initializeForTest();

      expect(getServerState()).toBe('services_ready');
    });

    it('should throw error if setupWebSocketHandlers called before services ready', () => {
      jest.resetModules();
      const { setupWebSocketHandlersForTest } = require('../../../src/server');

      // Mock io instance
      const mockIo = { on: jest.fn() };

      // Should throw because state is UNINITIALIZED
      expect(() => {
        setupWebSocketHandlersForTest(mockIo);
      }).toThrow('Cannot setup handlers in state: uninitialized');
    });

    it('should allow setupWebSocketHandlers when services are ready', async () => {
      jest.resetModules();

      // Mock app.js
      jest.doMock('../../../src/app', () => {
        const mockApp = function () { };
        mockApp.use = jest.fn();
        mockApp.locals = {};
        mockApp.app = mockApp;
        mockApp.initializeServices = jest.fn().mockResolvedValue();
        return mockApp;
      });

      const { setupWebSocketHandlersForTest, initializeForTest } = require('../../../src/server');

      // Initialize services first
      await initializeForTest();

      // Mock io instance
      const mockIo = { on: jest.fn() };

      // Should NOT throw because state is SERVICES_READY
      expect(() => {
        setupWebSocketHandlersForTest(mockIo);
      }).not.toThrow();
    });

    it('should transition to HANDLERS_READY after setupWebSocketHandlers', async () => {
      jest.resetModules();

      // Mock app.js
      jest.doMock('../../../src/app', () => {
        const mockApp = function () { };
        mockApp.use = jest.fn();
        mockApp.locals = {};
        mockApp.app = mockApp;
        mockApp.initializeServices = jest.fn().mockResolvedValue();
        return mockApp;
      });

      const { getServerState, setupWebSocketHandlersForTest, initializeForTest } = require('../../../src/server');

      // Initialize services first
      await initializeForTest();

      // Setup handlers
      const mockIo = { on: jest.fn() };
      setupWebSocketHandlersForTest(mockIo);

      expect(getServerState()).toBe('handlers_ready');
    });
  });

  describe('Correct initialization sequence', () => {
    it('should call setupServiceListeners before setupWebSocketHandlers', async () => {
      jest.resetModules();

      const callOrder = [];

      // Mock app.js
      jest.doMock('../../../src/app', () => {
        const mockApp = function () { };
        mockApp.use = jest.fn();
        mockApp.locals = {};
        mockApp.app = mockApp;
        mockApp.initializeServices = jest.fn().mockResolvedValue();
        return mockApp;
      });

      // Mock functions to track call order
      jest.doMock('../../../src/websocket/broadcasts', () => ({
        setupBroadcastListeners: jest.fn(() => {
          callOrder.push('setupServiceListeners');
        }),
        cleanupBroadcastListeners: jest.fn()
      }));

      // Mock socket server to avoid binding ports
      jest.doMock('../../../src/websocket/socketServer', () => ({
        createSocketServer: jest.fn(() => ({
          on: jest.fn(),
          close: jest.fn(cb => cb && cb()),
          fetchSockets: jest.fn().mockResolvedValue([])
        }))
      }));

      const { startServerForTest } = require('../../../src/server');

      // Mock socket server creation
      const originalSetupWebSocketHandlers = jest.fn(() => {
        callOrder.push('setupWebSocketHandlers');
      });

      await startServerForTest({
        setupWebSocketHandlersOverride: originalSetupWebSocketHandlers
      });

      // Verify order: listeners BEFORE handlers
      expect(callOrder[0]).toBe('setupServiceListeners');
      expect(callOrder[1]).toBe('setupWebSocketHandlers');
    });
  });
});
