/**
 * SessionModeManager Unit Tests
 *
 * Tests networked vs standalone mode logic per Functional Requirements Section 0
 * (Deployment Modes architectural constraint)
 */

// Load browser mocks first
require('../../helpers/browser-mocks');

const SessionModeManager = require('../../../../ALNScanner/js/app/sessionModeManager');

describe('SessionModeManager - Mode Logic', () => {
  let manager;

  beforeEach(() => {
    // Clear localStorage before each test
    global.localStorage.clear();

    // Create new instance
    manager = new SessionModeManager();
  });

  describe('Mode Selection', () => {
    it('should initialize with no mode selected', () => {
      expect(manager.mode).toBeNull();
      expect(manager.locked).toBe(false);
    });

    it('should allow selecting networked mode and auto-lock', () => {
      manager.setMode('networked');

      expect(manager.mode).toBe('networked');
      expect(manager.locked).toBe(true); // Auto-locked on setMode
    });

    it('should allow selecting standalone mode and auto-lock', () => {
      manager.setMode('standalone');

      expect(manager.mode).toBe('standalone');
      expect(manager.locked).toBe(true); // Auto-locked on setMode
    });

    it('should reject invalid mode', () => {
      expect(() => {
        manager.setMode('invalid');
      }).toThrow();

      expect(manager.mode).toBeNull();
    });
  });

  describe('Mode Persistence', () => {
    it('should save mode to localStorage on setMode', () => {
      manager.setMode('networked');

      const saved = localStorage.getItem('gameSessionMode');
      expect(saved).toBe('networked');
    });

    it('should restore mode from localStorage', () => {
      // Pre-populate localStorage
      localStorage.setItem('gameSessionMode', 'standalone');

      // Create new manager (should restore)
      const newManager = new SessionModeManager();
      const restored = newManager.restoreMode();

      expect(restored).toBe('standalone');
      expect(newManager.mode).toBe('standalone');
    });

    it('should return null when no saved mode exists', () => {
      const restored = manager.restoreMode();

      expect(restored).toBeNull();
    });

    it('should clear mode from localStorage', () => {
      manager.setMode('networked');
      expect(localStorage.getItem('gameSessionMode')).toBe('networked');

      manager.clearMode();

      expect(localStorage.getItem('gameSessionMode')).toBeNull();
      expect(manager.mode).toBeNull();
      expect(manager.locked).toBe(false);
    });
  });

  describe('Mode Locking', () => {
    it('should auto-lock mode on setMode to prevent changes', () => {
      manager.setMode('networked');

      // Implementation auto-locks when mode is set
      expect(manager.locked).toBe(true);

      expect(() => {
        manager.setMode('standalone');
      }).toThrow(/cannot change session mode/i);

      expect(manager.mode).toBe('networked');
    });

    it('should unlock mode when explicitly cleared', () => {
      manager.setMode('networked');

      // Already locked from setMode
      expect(manager.locked).toBe(true);

      manager.clearMode();

      expect(manager.locked).toBe(false);
      expect(manager.mode).toBeNull();
    });
  });

  describe('Mode Checking Helpers', () => {
    it('should identify networked mode correctly', () => {
      expect(manager.isNetworked()).toBe(false);

      manager.setMode('networked');
      expect(manager.isNetworked()).toBe(true);

      // Create new manager for standalone test (can't call setMode twice due to lock)
      const standaloneManager = new SessionModeManager();
      standaloneManager.setMode('standalone');
      expect(standaloneManager.isNetworked()).toBe(false);
    });

    it('should identify standalone mode correctly', () => {
      expect(manager.isStandalone()).toBe(false);

      manager.setMode('standalone');
      expect(manager.isStandalone()).toBe(true);

      // Create new manager for networked test (can't call setMode twice due to lock)
      const networkedManager = new SessionModeManager();
      networkedManager.setMode('networked');
      expect(networkedManager.isStandalone()).toBe(false);
    });
  });

  describe('Connection Validation (Networked Mode)', () => {
    it('should check for connection manager in networked mode', () => {
      manager.locked = false; // Unlock to allow setting
      manager.mode = 'networked'; // Set without triggering init

      // No connection manager set
      expect(manager.isConnectionReady()).toBe(false);
    });

    it('should validate connection manager exists and is connected', () => {
      // Set mode first (required for connection check)
      manager.locked = false; // Unlock to allow setting
      manager.mode = 'networked'; // Set without triggering init

      // Mock connection manager with isConnected=true
      global.window.connectionManager = {
        client: {
          isConnected: true
        }
      };

      expect(manager.isConnectionReady()).toBe(true);

      // Cleanup
      global.window.connectionManager = null;
    });

    it('should return false when connection manager exists but not connected', () => {
      // Set mode first (required for connection check)
      manager.locked = false; // Unlock to allow setting
      manager.mode = 'networked'; // Set without triggering init

      // Mock disconnected connection manager
      global.window.connectionManager = {
        client: {
          isConnected: false
        }
      };

      expect(manager.isConnectionReady()).toBe(false);

      // Cleanup
      global.window.connectionManager = null;
    });

    it('should not require connection for standalone mode', () => {
      manager.setMode('standalone');

      // No connection manager - should still be "ready"
      expect(manager.isConnectionReady()).toBe(true);
    });
  });

  describe('Functional Requirements Compliance', () => {
    it('FR 0: should support networked mode deployment', () => {
      manager.setMode('networked');

      expect(manager.mode).toBe('networked');
      expect(manager.isNetworked()).toBe(true);
    });

    it('FR 0: should support standalone mode deployment', () => {
      manager.setMode('standalone');

      expect(manager.mode).toBe('standalone');
      expect(manager.isStandalone()).toBe(true);
    });

    it('FR 0: should persist mode across page reloads', () => {
      // Simulate initial load
      manager.setMode('networked');

      // Simulate page reload (new instance)
      const newManager = new SessionModeManager();
      const restored = newManager.restoreMode();

      expect(restored).toBe('networked');
      expect(newManager.mode).toBe('networked');
    });

    it('FR 0: should require explicit mode selection (no default)', () => {
      const newManager = new SessionModeManager();

      expect(newManager.mode).toBeNull();
      expect(newManager.isNetworked()).toBe(false);
      expect(newManager.isStandalone()).toBe(false);
    });
  });
});
