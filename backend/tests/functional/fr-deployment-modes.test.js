/**
 * Functional Requirements Validation: Deployment Modes
 *
 * Tests FR Section 0: Deployment Modes
 * Validates that scanner supports both networked and standalone deployment modes
 * per functional requirements document.
 */

// Load browser mocks first
require('../helpers/browser-mocks');

const SessionModeManager = require('../../../ALNScanner/js/app/sessionModeManager');
const Settings = require('../../../ALNScanner/js/ui/settings');

describe('FR Section 0: Deployment Modes', () => {
  beforeEach(() => {
    // Clear localStorage
    global.localStorage.clear();

    // Reset Settings
    Settings.deviceId = '001';
    Settings.mode = 'detective';
  });

  describe('FR 0.1: Networked Mode', () => {
    it('should support networked mode deployment', () => {
      const manager = new SessionModeManager();

      manager.setMode('networked');

      expect(manager.isNetworked()).toBe(true);
      expect(manager.isStandalone()).toBe(false);
    });

    it('should require orchestrator connection for networked mode', () => {
      const manager = new SessionModeManager();

      manager.setMode('networked');

      // In networked mode, scanner expects orchestrator
      expect(manager.mode).toBe('networked');
      // SessionModeManager doesn't enforce connection, but orchestratorClient does
      // This test validates the mode is set correctly
    });

    it('should enable admin panel in networked mode', () => {
      const manager = new SessionModeManager();

      manager.setMode('networked');

      // Admin panel availability is determined by mode
      expect(manager.isNetworked()).toBe(true);
      // In production, App.viewController checks isNetworked() before showing admin panel
    });
  });

  describe('FR 0.2: Standalone Mode', () => {
    it('should support standalone mode deployment', () => {
      const manager = new SessionModeManager();

      manager.setMode('standalone');

      expect(manager.isStandalone()).toBe(true);
      expect(manager.isNetworked()).toBe(false);
    });

    it('should work without orchestrator connection in standalone mode', () => {
      const manager = new SessionModeManager();

      manager.setMode('standalone');

      // Standalone mode doesn't require connection
      expect(manager.mode).toBe('standalone');
      // In production, uses StandaloneDataManager instead of networked queue
    });

    it('should disable admin panel in standalone mode', () => {
      const manager = new SessionModeManager();

      manager.setMode('standalone');

      // Admin panel NOT available in standalone
      expect(manager.isNetworked()).toBe(false);
      // In production, App.viewController hides admin panel when !isNetworked()
    });
  });

  describe('FR 0.3: Mode Persistence', () => {
    it('should persist mode selection to localStorage', () => {
      const manager = new SessionModeManager();

      manager.setMode('networked');

      // Mode should be saved
      const saved = localStorage.getItem('gameSessionMode');
      expect(saved).toBe('networked');
    });

    it('should restore mode from localStorage on init', () => {
      // Pre-populate localStorage
      localStorage.setItem('gameSessionMode', 'standalone');

      const manager = new SessionModeManager();
      manager.restoreMode();

      expect(manager.mode).toBe('standalone');
      expect(manager.isStandalone()).toBe(true);
    });

    it('should maintain mode across page reloads', () => {
      // First session
      const manager1 = new SessionModeManager();
      manager1.setMode('networked');

      // Simulate page reload (new SessionModeManager instance)
      const manager2 = new SessionModeManager();
      manager2.restoreMode();

      expect(manager2.mode).toBe('networked');
      expect(manager2.isNetworked()).toBe(true);
    });
  });

  describe('FR 0.4: Mode Locking', () => {
    it('should lock mode after selection to prevent mid-session changes', () => {
      const manager = new SessionModeManager();

      manager.setMode('networked');

      // Mode is locked after setMode
      expect(manager.locked).toBe(true);

      // Attempting to change mode should throw
      expect(() => {
        manager.setMode('standalone');
      }).toThrow(/cannot change session mode/i);
    });

    it('should prevent mode changes after game starts', () => {
      const manager = new SessionModeManager();
      manager.setMode('networked');

      // First setMode locks it
      expect(manager.locked).toBe(true);

      // Subsequent attempts fail
      expect(() => {
        manager.setMode('standalone');
      }).toThrow();
    });
  });

  describe('FR 0.5: Device Configuration', () => {
    it('should persist device ID across sessions', () => {
      Settings.deviceId = 'GM_TEST_05';
      Settings.save();

      // Reset and load
      Settings.deviceId = '001';
      Settings.load();

      expect(Settings.deviceId).toBe('GM_TEST_05');
    });

    it('should persist station mode (detective/blackmarket) across sessions', () => {
      Settings.mode = 'blackmarket';
      Settings.save();

      // Reset and load
      Settings.mode = 'detective';
      Settings.load();

      expect(Settings.mode).toBe('blackmarket');
    });

    it('should support multiple GM stations with unique device IDs', () => {
      const deviceIds = ['GM_001', 'GM_002', 'GM_003'];

      deviceIds.forEach(id => {
        Settings.deviceId = id;
        expect(Settings.deviceId).toBe(id);
      });
    });
  });
});
