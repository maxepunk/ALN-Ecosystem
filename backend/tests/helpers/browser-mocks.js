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
  connectionManager: null  // Scanner checks this
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

// Socket.io-client (scanner expects it globally)
global.io = require('socket.io-client');

// Fetch API (for scanner HTTP requests)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

module.exports = {};  // Exports nothing - mocks are global side effects
