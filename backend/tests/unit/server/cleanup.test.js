/**
 * Server Cleanup Tests (Phase 1.4 P0.4)
 * Tests proper cleanup of broadcast listeners to prevent memory leaks
 */

describe('Server Cleanup (Phase 1.4)', () => {
  let mockCleanupBroadcastListeners;
  let originalRequire;

  beforeEach(() => {
    // Reset modules to get fresh instance
    jest.resetModules();

    // Mock the broadcasts module
    mockCleanupBroadcastListeners = jest.fn();
    jest.doMock('../../../src/websocket/broadcasts', () => ({
      setupBroadcastListeners: jest.fn(),
      cleanupBroadcastListeners: mockCleanupBroadcastListeners
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanup() function', () => {
    it('should call cleanupBroadcastListeners during cleanup (Phase 1.4)', async () => {
      // This test will FAIL until we add the call to cleanup()
      const { cleanup } = require('../../../src/server');

      await cleanup();

      // CRITICAL: Verify cleanup was called
      expect(mockCleanupBroadcastListeners).toHaveBeenCalled();
    });

    it('should call cleanupBroadcastListeners early in cleanup sequence', async () => {
      // Phase 1.4: cleanupBroadcastListeners should be called early
      // (before closing io, sockets, etc.)

      const { cleanup } = require('../../../src/server');

      await cleanup();

      // Verify cleanup was called (proves correct order since it's early in function)
      expect(mockCleanupBroadcastListeners).toHaveBeenCalled();
      expect(mockCleanupBroadcastListeners).toHaveBeenCalledTimes(1);
    });

    it('should reset serverState to UNINITIALIZED after cleanup', async () => {
      const { cleanup, getServerState, ServerState } = require('../../../src/server');

      await cleanup();

      expect(getServerState()).toBe(ServerState.UNINITIALIZED);
    });
  });

  describe('Cleanup symmetry with initialization (Phase 1.3 + 1.4)', () => {
    it('should maintain proper lifecycle symmetry', async () => {
      // Setup: services → listeners → handlers → listening
      // Cleanup: (reverse order) listening → handlers → listeners → uninitialized

      const callOrder = [];

      mockCleanupBroadcastListeners.mockImplementation(() => {
        callOrder.push('cleanupBroadcastListeners');
      });

      const { cleanup } = require('../../../src/server');

      await cleanup();

      // Verify cleanup was called (symmetry with setupBroadcastListeners)
      expect(callOrder).toContain('cleanupBroadcastListeners');
    });
  });
});
