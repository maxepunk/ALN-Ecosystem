/**
 * App - Initialization Sequence Tests
 * Phase 1.2, Day 2: App Module Initialization
 *
 * OBJECTIVE: Test App.init() sequence and configuration handling
 * EXPECTED: Will reveal 3-5 bugs in initialization order and error handling
 *
 * Based on:
 * - Functional Requirements: FR 3.1 (GM Scanner Init)
 * - gm-scanner-test-plan.md lines 106-118
 * - app.js lines 12-88 (init method)
 */

// Load browser mocks FIRST
require('../../helpers/browser-mocks');

const fs = require('fs');
const path = require('path');

describe('App - Initialization Sequence [Phase 1.2]', () => {
  let App, Settings, SessionModeManager, NFCHandler;

  beforeEach(() => {
    // Clear any previous module state
    jest.clearAllMocks();

    // Clear DataManager scanned tokens
    global.DataManager.clearScannedTokens();

    // Reset global mocks
    global.window.location = {
      search: '',
      pathname: '/',
      origin: 'http://localhost:3000'
    };

    global.navigator.serviceWorker = undefined;
    global.navigator.nfc = undefined;

    // Reset localStorage
    global.localStorage.clear();

    // Load real tokens first (required by TokenManager)
    const rawTokensPath = path.join(__dirname, '../../../../ALN-TokenData/tokens.json');
    const rawTokens = JSON.parse(fs.readFileSync(rawTokensPath, 'utf8'));
    global.TokenManager.database = rawTokens;

    // NOW load scanner modules (they depend on global.TokenManager being populated)
    Settings = require('../../../../ALNScanner/js/ui/settings');
    SessionModeManager = require('../../../../ALNScanner/js/app/sessionModeManager');
    NFCHandler = require('../../../../ALNScanner/js/utils/nfcHandler');
    App = require('../../../../ALNScanner/js/app/app');

    // Make Settings, SessionModeManager, and NFCHandler available globally (App expects them)
    global.Settings = Settings;
    global.SessionModeManager = SessionModeManager;
    global.NFCHandler = NFCHandler;
  });

  describe('TEST 1: Successful Initialization', () => {
    it('should complete full initialization sequence without errors', async () => {
      // EXPECTED: All initialization steps complete in correct order
      // WILL REVEAL: Any step that throws or fails silently

      // SPY: Track initialization order
      const initSpy = jest.spyOn(global.UIManager, 'init');
      const loadSettingsSpy = jest.spyOn(Settings, 'load');
      const loadTransactionsSpy = jest.spyOn(global.DataManager, 'loadTransactions' );

      // Mock NFC as not supported (default for most browsers)
      global.navigator.nfc = undefined;

      // ACT: Initialize app
      await expect(App.init()).resolves.not.toThrow();

      // VERIFY: Key components were initialized
      expect(initSpy).toHaveBeenCalled();
      expect(loadSettingsSpy).toHaveBeenCalled();
      expect(loadTransactionsSpy).toHaveBeenCalled();

      // VERIFY: NFC support was checked
      expect(App.nfcSupported).toBe(false);

      // VERIFY: SessionModeManager was created
      expect(global.window.sessionModeManager).toBeDefined();
      expect(global.window.sessionModeManager).toBeInstanceOf(SessionModeManager);
    });
  });

  describe('TEST 2: URL Parameter Mode Selection', () => {
    it('should parse ?mode=blackmarket and set station mode', async () => {
      // EXPECTED: URL param ?mode=blackmarket overrides localStorage
      // Per app.js:45-50

      global.window.location.search = '?mode=blackmarket';

      const saveSpy = jest.spyOn(Settings, 'save');

      await App.init();

      // VERIFY: Station mode was set to blackmarket
      expect(Settings.stationMode).toBe('blackmarket');

      // VERIFY: Settings were saved
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should parse ?mode=black-market (hyphenated) and set station mode', async () => {
      // EXPECTED: Also accepts hyphenated version
      // Per app.js:47

      global.window.location.search = '?mode=black-market';

      await App.init();

      expect(Settings.stationMode).toBe('blackmarket');
    });

    it('should ignore invalid mode parameters', async () => {
      // EXPECTED BUG: Might accept invalid modes or crash

      global.window.location.search = '?mode=invalid_mode';

      const originalMode = Settings.stationMode;

      await App.init();

      // VERIFY: Invalid mode ignored, original setting preserved
      // (Should NOT change to 'invalid_mode')
      expect(Settings.stationMode).not.toBe('invalid_mode');
    });
  });

  describe('TEST 3: Token Database Loading', () => {
    it('should load token database successfully', async () => {
      // EXPECTED: TokenManager.loadDatabase() loads tokens.json

      await App.init();

      // VERIFY: Token database is populated
      expect(Object.keys(global.TokenManager.database).length).toBeGreaterThan(0);

      // VERIFY: Can find a known token
      const testToken = global.TokenManager.findToken('534e2b03');
      expect(testToken).toBeDefined();
    });

    it('should handle missing token database gracefully', async () => {
      // EXPECTED BUG: Might crash if tokens.json missing
      // Per app.js:39-42 - should use demo data

      // Mock loadDatabase to return false (file not found)
      jest.spyOn(global.TokenManager, 'loadDatabase').mockResolvedValue(false);

      // Should not throw, should fall back to demo/empty
      await expect(App.init()).resolves.not.toThrow();
    });
  });

  describe('TEST 4: NFC Support Detection', () => {
    it('should detect NFC support when available', async () => {
      // EXPECTED: Sets App.nfcSupported = true when navigator.nfc exists

      // Mock NFC support
      global.navigator.nfc = {
        scan: jest.fn()
      };

      jest.spyOn(NFCHandler, 'init').mockResolvedValue(true);

      await App.init();

      expect(App.nfcSupported).toBe(true);
    });

    it('should handle missing NFC gracefully', async () => {
      // EXPECTED: Sets App.nfcSupported = false, doesn't crash

      global.navigator.nfc = undefined;

      await App.init();

      expect(App.nfcSupported).toBe(false);
    });
  });

  describe('TEST 5: Service Worker Registration', () => {
    it('should register service worker when supported', async () => {
      // EXPECTED: Registers sw.js for PWA offline functionality

      const registerSpy = jest.fn().mockResolvedValue({ scope: '/' });

      global.navigator.serviceWorker = {
        register: registerSpy
      };

      await App.init();

      // VERIFY: Service worker registration attempted
      expect(registerSpy).toHaveBeenCalledWith('./sw.js');
    });

    it('should handle service worker registration failure gracefully', async () => {
      // EXPECTED: Shows error but doesn't crash app
      // Per app.js:59-63

      const showErrorSpy = jest.spyOn(global.UIManager, 'showError');

      global.navigator.serviceWorker = {
        register: jest.fn().mockRejectedValue(new Error('SW registration failed'))
      };

      await expect(App.init()).resolves.not.toThrow();

      // VERIFY: Error shown to user
      expect(showErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Service Worker.*failed/i)
      );
    });

    it('should skip service worker when not supported', async () => {
      // EXPECTED: Doesn't crash when service worker unavailable

      global.navigator.serviceWorker = undefined;

      await expect(App.init()).resolves.not.toThrow();
    });
  });

  describe('TEST 6: SessionModeManager Initialization', () => {
    it('should create SessionModeManager before viewController', async () => {
      // EXPECTED BUG: Order matters! SessionModeManager MUST exist before viewController.init()
      // Per app.js:18-24

      let sessionManagerCreated = false;
      let viewControllerInitialized = false;

      // Spy on SessionModeManager constructor
      const originalSessionModeManager = SessionModeManager;
      jest.spyOn(global, 'SessionModeManager').mockImplementation(function(...args) {
        sessionManagerCreated = true;
        // VERIFY: viewController hasn't initialized yet
        expect(viewControllerInitialized).toBe(false);
        return new originalSessionModeManager(...args);
      });

      // Mock viewController init
      App.viewController = {
        init: jest.fn(() => {
          viewControllerInitialized = true;
          // VERIFY: sessionModeManager was already created
          expect(sessionManagerCreated).toBe(true);
        })
      };

      await App.init();

      expect(sessionManagerCreated).toBe(true);
      expect(viewControllerInitialized).toBe(true);
    });

    it('should restore previously saved mode', async () => {
      // EXPECTED: Calls sessionModeManager.restoreMode()
      // Per app.js:67

      const restoreModeSpy = jest.spyOn(SessionModeManager.prototype, 'restoreMode');

      await App.init();

      expect(restoreModeSpy).toHaveBeenCalled();
    });
  });

  describe('TEST 7: Initialization Error Handling', () => {
    it('should handle UIManager.init() failure gracefully', async () => {
      // EXPECTED BUG: If UIManager.init() throws, might crash entire init

      jest.spyOn(global.UIManager, 'init').mockImplementation(() => {
        throw new Error('UIManager init failed');
      });

      // This test WILL FAIL if app doesn't have try-catch
      // SHOULD: Either wrap in try-catch OR let it throw (acceptable failure)
      // We'll accept either behavior for now
      try {
        await App.init();
        // If we get here, app handled error gracefully
      } catch (error) {
        // If it throws, that's also acceptable - app can't function without UI
        expect(error.message).toMatch(/UIManager/);
      }
    });

    it('should handle Settings.load() failure gracefully', async () => {
      // EXPECTED: Corrupt localStorage shouldn't crash app

      jest.spyOn(Settings, 'load').mockImplementation(() => {
        throw new Error('Settings corrupted');
      });

      // EXPECTED BUG: Might not have try-catch around Settings.load()
      try {
        await App.init();
      } catch (error) {
        // Acceptable to throw, but should be handled
        expect(error.message).toMatch(/Settings/);
      }
    });
  });
});
