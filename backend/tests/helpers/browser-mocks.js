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
  CustomEvent: class CustomEvent {}  // Player Scanner creates custom events
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
  viewController: null,
  updateAdminPanel: () => {}
};

// Mock Debug global (GM Scanner uses Debug.log)
global.Debug = {
  log: () => {},
  warn: () => {},
  error: () => {}
};

// Mock ConnectionManager (referenced but not imported in orchestratorClient.js:503)
// In browser, loaded via separate <script> tag
global.ConnectionManager = class ConnectionManager {};

// Mock Settings global (App module uses Settings.deviceId, Settings.stationMode)
// In browser, loaded via separate <script> tag
// Will be overwritten by actual Settings module when imported
global.Settings = {
  deviceId: '001',
  stationMode: 'detective',
  load: () => {},
  save: () => {}
};

// Load REAL TokenManager (scanner's token database module)
// This will be populated with real tokens.json data in test setup
const TokenManager = require('../../../ALNScanner/js/core/tokenManager');
global.TokenManager = TokenManager;

// Mock DataManager global (App.recordTransaction uses DataManager.markTokenAsScanned)
// In browser, loaded via separate <script> tag
// TokenManager.buildGroupInventory() requires parseGroupInfo and normalizeGroupName
global.DataManager = {
  markTokenAsScanned: () => {},
  addTransaction: () => {},
  clearSession: () => {},
  calculateTokenValue: () => 0,
  backendScores: new Map(),
  isTokenScanned: () => false,  // For duplicate detection check in processNFCRead

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
global.io = require('socket.io-client');

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

module.exports = {};  // Exports nothing - mocks are global side effects
