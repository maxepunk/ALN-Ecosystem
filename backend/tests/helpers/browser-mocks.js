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
  dispatchEvent: () => { },  // Player Scanner dispatches custom events (orchestratorIntegration.js:204)
  addEventListener: () => { }, // App.js uses this for session:ready events
  removeEventListener: () => { },
  CustomEvent: global.CustomEvent || class CustomEvent { },  // Use native CustomEvent if available
  DataManager: null  // Will be set to global.DataManager after it's defined (see below)
};

// Mock document (minimal - only what scanner uses)
// Create a reusable mock element factory
const createMockElement = () => ({
  // Return mock element with all properties scanner code might set
  disabled: false,
  textContent: '',
  value: '',
  checked: false,
  style: {},
  dataset: {},
  classList: {
    contains: () => false,
    add: () => { },
    remove: () => { },
    toggle: () => { }
  },
  // Phase 4.1: ConnectionManager._updateGlobalConnectionStatus uses querySelector
  querySelector: () => createMockElement(),
  querySelectorAll: () => [],
  // Event handling
  addEventListener: () => { },
  removeEventListener: () => { },
  dispatchEvent: () => true,
  // DOM manipulation - MonitoringDisplay uses remove() to remove transaction elements
  remove: () => { },
  // DOM manipulation - MonitoringDisplay uses insertAdjacentHTML for game activity log
  insertAdjacentHTML: () => { },
  innerHTML: '',
  children: [],
  firstChild: null,
  appendChild: () => createMockElement(),
  closest: () => null
});

global.document = {
  readyState: 'complete',
  getElementById: () => createMockElement(),
  querySelector: () => createMockElement(),
  querySelectorAll: () => [],
  createElement: (_tag) => ({
    href: '',
    download: '',
    click: () => { },
    remove: () => { },
    ...createMockElement()
  }),
  body: {
    appendChild: () => { },
    removeChild: () => { },
    ...createMockElement()
  }
};

// Mock App global (GM Scanner uses App.viewController, App.updateAdminPanel)
global.App = {
  viewController: {
    init: () => { },  // App.init() calls this.viewController.init()
    initAdminModules: () => { }  // OrchestratorClient calls this on connection
  },
  updateAdminPanel: () => { }
};

// Mock InitializationSteps (Complete refactoring - Phases 1A-1J)
global.InitializationSteps = {
  // Phase 1D: UI initialization
  initializeUIManager: (uiManager) => {
    uiManager.init();
  },
  // Phase 0: Show loading screen (added Oct 28, 2024 in ALNScanner commit 0759242)
  // Called after initializeUIManager to ensure loading screen is visible
  // Matches ALNScanner/src/app/initializationSteps.js:203-208
  showLoadingScreen: async (uiManager) => {
    uiManager.showScreen('loading');
    // Ensure browser paints the loading screen before continuing (100ms delay)
    await new Promise(resolve => setTimeout(resolve, 100));
    global.Debug.log('Loading screen displayed');
  },
  // Phase 1E: Session mode manager creation
  createSessionModeManager: (SessionModeManagerClass, windowObj) => {
    const instance = new SessionModeManagerClass();
    if (windowObj) {
      windowObj.sessionModeManager = instance;
    } else if (typeof window !== 'undefined') {
      // Fallback to global window if not passed (legacy support)
      window.sessionModeManager = instance;
    }
    global.Debug.log('SessionModeManager initialized');
    return instance;
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
  // Phase 1C: Connection restoration decision logic (legacy - non-validating)
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
  // Phase 4.1: Connection restoration with full validation
  // In test environment, skip HTTP validation - return autoConnect for networked mode
  validateAndDetermineInitialScreen: async (sessionModeManager) => {
    const savedMode = sessionModeManager.restoreMode();

    // No saved mode - show game mode selection
    if (!savedMode) {
      return { screen: 'gameModeScreen', action: null, savedMode: null, validationResult: null };
    }

    // Standalone mode - no validation needed
    if (savedMode === 'standalone') {
      return { screen: 'teamEntry', action: 'initStandalone', savedMode, validationResult: null };
    }

    // Networked mode - skip HTTP validation in tests, assume valid
    // Tests set up localStorage with valid token and orchestrator URL
    const token = global.localStorage.getItem('aln_auth_token');
    const orchestratorUrl = global.localStorage.getItem('aln_orchestrator_url');

    if (token && orchestratorUrl) {
      // In test environment, skip HTTP validation and return valid
      // The test server is running and session is created in beforeEach
      global.Debug.log('[Mock InitSteps] Skipping HTTP validation in test environment');
      return {
        screen: 'loading',
        action: 'autoConnect',
        savedMode,
        validationResult: { valid: true, reason: null, details: { tokenValid: true, orchestratorReachable: true, sessionExists: true } }
      };
    }

    // Missing token or URL - show wizard
    return {
      screen: 'gameModeScreen',
      action: 'clearModeAndShowWizard',
      savedMode,
      validationResult: { valid: false, reason: 'Missing token or orchestrator URL' }
    };
  },
  // Phase 4.1: Connection restoration side effects (updated signature)
  applyInitialScreenDecision: async (decision, sessionModeManager, uiManager, showWizardFn, initNetworkedModeFn = null) => {
    console.log('DEBUG [Mock applyInitialScreenDecision]: decision.action =', decision.action);
    console.log('DEBUG [Mock applyInitialScreenDecision]: initNetworkedModeFn is', initNetworkedModeFn ? 'PROVIDED' : 'NULL');
    if (decision.action === 'clearModeAndShowWizard') {
      global.Debug.warn('Networked mode restored but connection lost - showing wizard');
      sessionModeManager.clearMode();
      uiManager.showScreen(decision.screen);
      showWizardFn();
    } else if (decision.action === 'initStandalone') {
      global.Debug.log('Restoring standalone mode');
      sessionModeManager.setMode('standalone');
      uiManager.showScreen(decision.screen);
    } else if (decision.action === 'autoConnect') {
      global.Debug.log('Valid token found - attempting auto-connect');
      console.log('DEBUG [Mock applyInitialScreenDecision]: Entering autoConnect branch');
      uiManager.showScreen(decision.screen);

      try {
        sessionModeManager.setMode('networked');
        console.log('DEBUG [Mock applyInitialScreenDecision]: Mode set to networked');
        if (initNetworkedModeFn) {
          console.log('DEBUG [Mock applyInitialScreenDecision]: Calling initNetworkedModeFn...');
          await initNetworkedModeFn();
          console.log('DEBUG [Mock applyInitialScreenDecision]: initNetworkedModeFn completed successfully');
          global.Debug.log('Auto-connect successful - showing team entry');
          uiManager.showScreen('teamEntry');
        } else {
          throw new Error('initNetworkedModeFn not provided for auto-connect');
        }
      } catch (error) {
        global.Debug.log('Auto-connect failed - showing wizard');
        console.error('DEBUG [Mock applyInitialScreenDecision]: Auto-connect error:', error);
        sessionModeManager.clearMode();
        uiManager.showScreen('gameModeScreen');
        showWizardFn();
      }
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
    log: () => { },
    warn: () => { },
    error: () => { }
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

  load: function () {
    // Load from localStorage if available
    const storedMode = global.localStorage.getItem('mode');
    if (storedMode) {
      this._mode = storedMode;
    }
  },

  save: function () {
    global.localStorage.setItem('mode', this._mode);
    global.localStorage.setItem('deviceId', this.deviceId);
  }
};

// Load REAL TokenManager (scanner's token database module)
// Note: DataManager mock removed — old core/dataManager.js was renamed to
// core/unifiedDataManager.js (DRY/SOLID cleanup 2026-02-07). TokenManager
// doesn't import DataManager, and App receives it via constructor injection.
// The global.DataManager mock object below still provides test methods.
const TokenManagerModule = require('../../../ALNScanner/src/core/tokenManager');
// Handle ES6 default export
const TokenManager = TokenManagerModule.default || TokenManagerModule;

// Mock buildGroupInventory if it doesn't exist (it might depend on DOM/other things)
if (!TokenManager.buildGroupInventory) {
  TokenManager.buildGroupInventory = () => ({});
}
global.TokenManager = TokenManager;

// Mock DataManager global — extends EventTarget for Phase 2+ event-based wiring
// In browser, loaded via separate <script> tag
// TokenManager.buildGroupInventory() requires parseGroupInfo and normalizeGroupName
class MockDataManager extends EventTarget {
  constructor() {
    super();
    this.transactions = [];  // Transaction history array - required by App.updateAdminPanel() fallback
    this.scannedTokens = new Set();  // Track scanned tokens for duplicate detection
    this.playerScans = [];
    this._networkedStrategy = null;
    this.backendScores = new Map();
    this.currentSessionId = null;
    // Phase 2+ state
    this.sessionState = {};
    this.environmentState = {
      audio: { routes: {}, availableSinks: [], defaultSink: 'hdmi' },
      lighting: { connected: false, scenes: [], activeScene: null },
      bluetooth: { scanning: false, pairedDevices: [], connectedDevices: [] },
    };
    this.cueState = { cues: new Map(), activeCues: new Map(), disabledCues: new Set() };
  }

  markTokenAsScanned(tokenId) {
    this.scannedTokens.add(tokenId);
  }

  isTokenScanned(tokenId) {
    return this.scannedTokens.has(tokenId);
  }

  // Clear scanned tokens (for duplicate detection bypass or test cleanup)
  clearScannedTokens() {
    this.scannedTokens.clear();
  }

  // Restore scanned tokens from server state (handles reconnection)
  // Called by OrchestratorClient.js when sync:full received with deviceScannedTokens
  setScannedTokensFromServer(serverTokens) {
    if (!Array.isArray(serverTokens)) {
      console.log('[MockDataManager] setScannedTokensFromServer: invalid input (not array)');
      return;
    }
    this.scannedTokens = new Set(serverTokens);
    console.log(`[MockDataManager] Synced ${serverTokens.length} scanned tokens from server`);
  }

  // Sync player scans from server (Game Activity feature)
  // Called by NetworkedSession.js when sync:full received with playerScans
  setPlayerScansFromServer(serverPlayerScans) {
    if (!Array.isArray(serverPlayerScans)) {
      console.log('[MockDataManager] setPlayerScansFromServer: invalid input (not array)');
      return;
    }
    this.playerScans = serverPlayerScans;
    console.log(`[MockDataManager] Synced ${serverPlayerScans.length} player scans from server`);
  }

  // Clear all data (for test cleanup between tests)
  clearAll() {
    this.scannedTokens.clear();
    this.transactions = [];
    this.backendScores.clear();
    this.playerScans = [];
  }

  // UnifiedDataManager mode initialization (app.js)
  // Sets _networkedStrategy so app.js can update the socket reference
  async initializeNetworkedMode(socket) {
    this._networkedStrategy = { socket, isReady: () => true };
  }

  async initializeStandaloneMode() {
    this._networkedStrategy = null;
  }

  addTransaction() { }

  addTransactionFromBroadcast(tx) {
    if (tx) this.transactions.push(tx);
  }

  handlePlayerScan() { }
  loadTransactions() { }  // App.init() loads transaction history
  loadScannedTokens() { }  // App.init() loads scanned tokens
  saveScannedTokens() { }  // Called by orchestratorClient.js on transaction:deleted
  clearSession() { }

  // Called by MonitoringDisplay when transaction:deleted event received
  removeTransaction(transactionId) {
    const index = this.transactions.findIndex(t => t.id === transactionId);
    if (index !== -1) {
      const removed = this.transactions.splice(index, 1)[0];
      // Also remove from scannedTokens if present
      if (removed?.tokenId) {
        this.scannedTokens.delete(removed.tokenId);
      }
    }
  }

  // Called by OrchestratorClient when new session detected (sync:full or session:update events)
  resetForNewSession(sessionId = null) {
    this.scannedTokens.clear();
    this.transactions = [];
    this.playerScans = [];
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
  }

  calculateTokenValue() { return 0; }

  // Called by MonitoringDisplay when scores:reset event received
  clearBackendScores() {
    this.backendScores.clear();
  }

  // Called by OrchestratorClient when score:updated event received
  updateTeamScoreFromBackend(scoreData) {
    if (scoreData && scoreData.teamId) {
      this.backendScores.set(scoreData.teamId, scoreData);
    }
  }

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
  }

  normalizeGroupName(name) {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['\u2018\u2019]/g, "'");
  }

  // Phase 2+ methods called by networkedSession.js and MonitoringDisplay
  updateSessionState(payload) {
    if (!payload) {
      this.sessionState = {};
      this.currentSessionId = null;
    } else {
      this.sessionState = { ...this.sessionState, ...payload };
      if (payload.id) this.currentSessionId = payload.id;
    }
    this.dispatchEvent(new CustomEvent('session-state:updated', {
      detail: { session: this.sessionState }
    }));
  }

  updateAudioState(payload) {
    if (!payload) return;
    if (payload.routes) this.environmentState.audio.routes = { ...payload.routes };
    if (payload.availableSinks) this.environmentState.audio.availableSinks = payload.availableSinks;
    this.dispatchEvent(new CustomEvent('audio-state:updated', {
      detail: { audio: { ...this.environmentState.audio } }
    }));
  }

  updateLightingState(payload) {
    if (!payload) return;
    const lighting = this.environmentState.lighting;
    if (payload.connected !== undefined) lighting.connected = payload.connected;
    if (payload.scenes) lighting.scenes = payload.scenes;
    if (payload.sceneId) lighting.activeScene = { id: payload.sceneId };
    this.dispatchEvent(new CustomEvent('lighting-state:updated', {
      detail: { lighting: { ...lighting } }
    }));
  }

  updateBluetoothState(payload) {
    if (!payload) return;
    const bt = this.environmentState.bluetooth;
    if (payload.scanning !== undefined) bt.scanning = payload.scanning;
    if (payload.pairedDevices) bt.pairedDevices = payload.pairedDevices;
    if (payload.connectedDevices) bt.connectedDevices = payload.connectedDevices;
    this.dispatchEvent(new CustomEvent('bluetooth-state:updated', {
      detail: { bluetooth: { ...bt } }
    }));
  }

  updateCueState(payload) {
    this.dispatchEvent(new CustomEvent('cue-state:updated', { detail: payload }));
  }

  reportCueConflict(payload) {
    this.dispatchEvent(new CustomEvent('cue:conflict', { detail: payload }));
  }

  getCueState() {
    return {
      cues: this.cueState.cues,
      activeCues: this.cueState.activeCues,
      disabledCues: this.cueState.disabledCues,
    };
  }

  // Phase 2+ methods called by networkedSession.js event handlers
  updateVideoState(payload) {
    this.dispatchEvent(new CustomEvent('video-state:updated', { detail: payload }));
  }

  updateCueStatus(payload) {
    this.dispatchEvent(new CustomEvent('cue-state:updated', { detail: payload }));
  }

  handleCueConflict(payload) {
    this.dispatchEvent(new CustomEvent('cue:conflict', { detail: payload }));
  }

  updateAudioDucking(payload) {
    this.dispatchEvent(new CustomEvent('audio-ducking:updated', { detail: payload }));
  }

  updateBluetoothScan(payload) {
    const bt = this.environmentState.bluetooth;
    if (payload.scanning !== undefined) bt.scanning = payload.scanning;
    this.dispatchEvent(new CustomEvent('bluetooth-scan:updated', { detail: payload }));
  }

  updateBluetoothDevice(payload) {
    this.dispatchEvent(new CustomEvent('bluetooth-device:updated', { detail: payload }));
  }
}

global.DataManager = new MockDataManager();

// CRITICAL: Link window.DataManager to global.DataManager so OrchestratorClient can access it
// OrchestratorClient checks "if (window.DataManager)" and calls updateTeamScoreFromBackend
global.window.DataManager = global.DataManager;

// Mock UIManager global (App.recordTransaction uses UIManager.updateSessionStats, etc.)
// In browser, loaded via separate <script> tag
global.UIManager = {
  updateSessionStats: () => { },
  showTokenResult: () => { },
  updateHistoryBadge: () => { },
  showError: () => { },
  showWarning: () => { },
  showInfo: () => { },
  showScreen: () => { },
  updateModeDisplay: () => { },
  updateTeamDisplay: () => { },
  updateHistoryStats: () => { },
  renderTransactions: () => { },
  showGroupCompletionNotification: () => { },
  showToast: () => { },  // Phase 4.1: Used by _initializeNetworkedMode for connection status
  hideToast: () => { },  // Phase 4.1: Used to hide connection toast
  init: () => { }
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
