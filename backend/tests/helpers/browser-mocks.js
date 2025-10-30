/**
 * Browser API Mocks for Scanner Module Testing in Node.js
 * Provides minimal browser environment for ALNScanner modules
 */

// Mock localStorage
global.localStorage = {
  _data: {},
  getItem(key) {
    return this._data[key] || null;
  },
  setItem(key, value) {
    this._data[key] = String(value);
  },
  removeItem(key) {
    delete this._data[key];
  },
  clear() {
    this._data = {};
  }
};

// Mock window (minimal - only what scanner uses)
global.window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/gm-scanner/'
  },
  connectionManager: null,  // Scanner checks this
  sessionModeManager: null, // GM Scanner checks this (line 138)
  queueManager: null,       // GM Scanner checks this (line 143)
  dispatchEvent: () => {},  // Player Scanner dispatches custom events (orchestratorIntegration.js:204)
  CustomEvent: class CustomEvent {},  // Player Scanner creates custom events
  DataManager: null  // Will be set to global.DataManager after it's defined (see below)
};

// Mock document (minimal - only what scanner uses)
global.document = {
  readyState: 'complete',
  getElementById: () => ({
    // Return mock element with all properties scanner code might set
    disabled: false,
    textContent: '',
    value: '',
    checked: false,
    style: {},
    classList: {
      contains: () => false,
      add: () => {},
      remove: () => {},
      toggle: () => {}
    }
  }),
  createElement: (_tag) => ({
    href: '',
    download: '',
    click: () => {},
    remove: () => {}
  }),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  }
};

// Mock App global (GM Scanner uses App.viewController, App.updateAdminPanel)
global.App = {
  viewController: {
    init: () => {},  // App.init() calls this.viewController.init()
    initAdminModules: () => {}  // OrchestratorClient calls this on connection
  },
  updateAdminPanel: () => {}
};

// Mock InitializationSteps (Complete refactoring - Phases 1A-1J)
global.InitializationSteps = {
  // Phase 1D: UI initialization
  initializeUIManager: (uiManager) => {
    uiManager.init();
  },
  // Phase 0: Show loading screen (added Oct 28, 2024 in ALNScanner commit 0759242)
  // Called after initializeUIManager to ensure loading screen is visible
  // Matches ALNScanner/js/app/initializationSteps.js:203-208
  showLoadingScreen: async (uiManager) => {
    uiManager.showScreen('loading');
    // Ensure browser paints the loading screen before continuing (100ms delay)
    await new Promise(resolve => setTimeout(resolve, 100));
    global.Debug.log('Loading screen displayed');
  },
  // Phase 1E: Session mode manager creation
  createSessionModeManager: (SessionModeManagerClass, windowObj) => {
    windowObj.sessionModeManager = new SessionModeManagerClass();
    global.Debug.log('SessionModeManager initialized');
  },
  // Phase 1F: View controller initialization
  initializeViewController: (viewController) => {
    viewController.init();
  },
  // Phase 1G: Settings loading
  loadSettings: (settings) => {
    settings.load();
  },
  // Phase 1H: Data manager loading
  loadDataManager: (dataManager, uiManager) => {
    dataManager.loadTransactions();
    dataManager.loadScannedTokens();
    uiManager.updateHistoryBadge();
  },
  // Phase 1I: NFC support detection
  detectNFCSupport: async (nfcHandler) => {
    const supported = await nfcHandler.init();
    global.Debug.log(`NFC support: ${supported}`);
    return supported;
  },
  // Phase 1J: Service worker registration
  registerServiceWorker: async (navigatorObj, uiManager) => {
    if (!('serviceWorker' in navigatorObj)) {
      return false;
    }
    try {
      await navigatorObj.serviceWorker.register('./sw.js');
      global.Debug.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      global.Debug.log('Service Worker registration failed');
      uiManager.showError('Service Worker registration failed. Offline features may not work.');
      return false;
    }
  },
  // Phase 1A: Token database loading
  loadTokenDatabase: async (tokenManager, uiManager) => {
    // In Node.js tests, database is pre-populated - skip fetch if already loaded
    if (tokenManager.database && Object.keys(tokenManager.database).length > 0) {
      global.Debug.log(`Token database already loaded (${Object.keys(tokenManager.database).length} tokens)`);
      // Still build group inventory if not already done
      if (!tokenManager.groupInventory) {
        tokenManager.groupInventory = tokenManager.buildGroupInventory();
      }
      return true;
    }

    // Otherwise attempt fetch (browser context)
    const dbLoaded = await tokenManager.loadDatabase();
    if (!dbLoaded) {
      const errorMsg = 'CRITICAL: Token database failed to load. Cannot initialize scanner.';
      global.Debug.error(errorMsg);
      uiManager.showError(errorMsg);
      throw new Error('Token database initialization failed');
    }
    global.Debug.log('Token database loaded successfully');
    return true;
  },
  // Phase 1B: URL mode override
  applyURLModeOverride: (locationSearch, settings) => {
    const urlParams = new URLSearchParams(locationSearch);
    const modeParam = urlParams.get('mode');
    if (modeParam === 'blackmarket' || modeParam === 'black-market') {
      settings.mode = 'blackmarket';
      settings.save();
      global.Debug.log('Station mode set to blackmarket via URL parameter');
      return true;
    }
    return false;
  },
  // Phase 1C: Connection restoration decision logic
  determineInitialScreen: (sessionModeManager) => {
    const savedMode = sessionModeManager.restoreMode();
    if (!savedMode) {
      return { screen: 'gameModeScreen', action: null };
    }
    if (!sessionModeManager.isConnectionReady()) {
      return {
        screen: 'gameModeScreen',
        action: 'clearModeAndShowWizard'
      };
    }
    return { screen: 'teamEntry', action: null };
  },
  // Phase 1C: Connection restoration side effects
  applyInitialScreenDecision: (decision, sessionModeManager, uiManager, showWizardFn) => {
    if (decision.action === 'clearModeAndShowWizard') {
      global.Debug.warn('Networked mode restored but connection lost - showing wizard');
      sessionModeManager.clearMode();
      uiManager.showScreen(decision.screen);
      showWizardFn();
    } else {
      global.Debug.log(`Showing initial screen: ${decision.screen}`);
      uiManager.showScreen(decision.screen);
    }
  }
};

// Mock Debug global (GM Scanner uses Debug.log)
// Preserve existing jest mocks if they exist (for Debug logging verification tests)
if (!global.Debug) {
  global.Debug = {
    log: () => {},
    warn: () => {},
    error: () => {}
  };
}

// Mock ConnectionManager (referenced but not imported in orchestratorClient.js:503)
// In browser, loaded via separate <script> tag
global.ConnectionManager = class ConnectionManager {
  migrateLocalStorage() {
    // No-op for tests
  }
};

// Mock Settings global (App module uses Settings.deviceId, Settings.mode)
// In browser, loaded via separate <script> tag
// Will be overwritten by actual Settings module when imported
global.Settings = {
  _mode: 'detective',  // Default mode (can be overridden by tests)
  deviceId: '001',

  // Getter/setter for mode to enable test overrides
  get mode() {
    return this._mode;
  },

  set mode(value) {
    this._mode = value;
    // Also update localStorage to match real Settings behavior
    global.localStorage.setItem('mode', value);
  },

  load: function() {
    // Load from localStorage if available
    const storedMode = global.localStorage.getItem('mode');
    if (storedMode) {
      this._mode = storedMode;
    }
  },

  save: function() {
    global.localStorage.setItem('mode', this._mode);
    global.localStorage.setItem('deviceId', this.deviceId);
  }
};

// Load REAL TokenManager (scanner's token database module)
// This will be populated with real tokens.json data in test setup
const TokenManager = require('../../../ALNScanner/js/core/tokenManager');
global.TokenManager = TokenManager;

// Mock DataManager global (App.recordTransaction uses DataManager.markTokenAsScanned)
// In browser, loaded via separate <script> tag
// TokenManager.buildGroupInventory() requires parseGroupInfo and normalizeGroupName
global.DataManager = {
  transactions: [],  // Transaction history array - required by App.updateAdminPanel() fallback
  scannedTokens: new Set(),  // Track scanned tokens for duplicate detection

  markTokenAsScanned(tokenId) {
    this.scannedTokens.add(tokenId);
  },

  isTokenScanned(tokenId) {
    return this.scannedTokens.has(tokenId);
  },

  // Clear scanned tokens (for duplicate detection bypass or test cleanup)
  clearScannedTokens() {
    this.scannedTokens.clear();
  },

  // Clear all data (for test cleanup between tests)
  clearAll() {
    this.scannedTokens.clear();
    this.transactions = [];
    this.backendScores.clear();
  },

  addTransaction: () => {},
  loadTransactions: () => {},  // App.init() loads transaction history
  loadScannedTokens: () => {},  // App.init() loads scanned tokens
  clearSession: () => {},

  // Called by OrchestratorClient when new session detected (sync:full or session:update events)
  // Matches ALNScanner/js/core/dataManager.js:191-207
  resetForNewSession(sessionId = null) {
    this.scannedTokens.clear();
    this.transactions = [];
    this.currentSessionId = sessionId;

    // Match scanner localStorage behavior
    if (global.localStorage) {
      global.localStorage.removeItem('scannedTokens');
      if (sessionId) {
        global.localStorage.setItem('currentSessionId', sessionId);
      } else {
        global.localStorage.removeItem('currentSessionId');
      }
    }
  },

  calculateTokenValue: () => 0,
  backendScores: new Map(),

  // Called by OrchestratorClient when score:updated event received
  updateTeamScoreFromBackend(scoreData) {
    if (scoreData && scoreData.teamId) {
      this.backendScores.set(scoreData.teamId, scoreData);
    }
  },

  // Required by TokenManager.buildGroupInventory()
  parseGroupInfo(groupName) {
    if (!groupName) {
      return { name: 'Unknown', multiplier: 1 };
    }
    const trimmed = groupName.trim();
    const match = trimmed.match(/^(.+?)\s*\(x(\d+)\)$/i);
    if (match) {
      const name = match[1].trim();
      const multiplier = parseInt(match[2]) || 1;
      return multiplier < 1 ? { name, multiplier: 1 } : { name, multiplier };
    }
    return { name: trimmed, multiplier: 1 };
  },

  normalizeGroupName(name) {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['\u2018\u2019]/g, "'");
  }
};

// CRITICAL: Link window.DataManager to global.DataManager so OrchestratorClient can access it
// OrchestratorClient checks "if (window.DataManager)" and calls updateTeamScoreFromBackend
global.window.DataManager = global.DataManager;

// Mock UIManager global (App.recordTransaction uses UIManager.updateSessionStats, etc.)
// In browser, loaded via separate <script> tag
global.UIManager = {
  updateSessionStats: () => {},
  showTokenResult: () => {},
  updateHistoryBadge: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
  showScreen: () => {},
  updateModeDisplay: () => {},
  updateTeamDisplay: () => {},
  updateHistoryStats: () => {},
  renderTransactions: () => {},
  showGroupCompletionNotification: () => {},
  init: () => {}
};

// Ensure console exists (Player Scanner uses console)
global.console = console;

// CustomEvent (Player Scanner uses 'new CustomEvent()')
global.CustomEvent = window.CustomEvent;

// Socket.io-client (scanner expects it globally)
// NOTE: Tests that need to MOCK socket.io-client should set global.io to their mock
// Integration tests that need REAL socket.io-client should load it after browser-mocks
// Unit tests that mock should set: global.io = jest.fn().mockReturnValue(mockSocket);
if (typeof global.io === 'undefined') {
  // Only set if not already defined (integration tests will define it, unit tests mock it)
  global.io = require('socket.io-client');
}

// Fetch API (for scanner HTTP requests)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Mock setInterval/clearInterval to prevent scanners from keeping Node.js alive
// Scanners use these for connection monitoring, which we control in tests
const intervals = new Map();
let intervalId = 0;

global.setInterval = (fn, delay) => {
  const id = ++intervalId;
  intervals.set(id, { fn, delay });
  // Don't actually run the interval - tests control execution
  return id;
};

global.clearInterval = (id) => {
  intervals.delete(id);
};

// Expose for tests that want to manually trigger intervals
global._mockIntervals = intervals;

// Mock StandaloneDataManager (used by SessionModeManager in standalone mode)
global.StandaloneDataManager = class StandaloneDataManager {
  constructor() {
    // No-op for unit tests
  }
};

// Mock global functions used by SessionModeManager
global.showConnectionWizard = () => {
  // No-op for unit tests
};

// Mock alert() for error handling tests
global.alert = () => {
  // No-op for unit tests
};

module.exports = {};  // Exports nothing - mocks are global side effects
