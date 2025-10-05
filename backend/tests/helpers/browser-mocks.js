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
  queueManager: null        // GM Scanner checks this (line 143)
};

// Mock document (minimal - only what scanner uses)
global.document = {
  readyState: 'complete',
  getElementById: () => null,
  createElement: (tag) => ({
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

// Ensure console exists (Player Scanner uses console)
global.console = console;

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
