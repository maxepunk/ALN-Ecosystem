/**
 * Test Mocks for Player Scanner (aln-memory-scanner)
 *
 * Provides browser environment mocking for testing player scanner components
 * Designed for ESP32-compatible code (simple, minimal dependencies)
 */

// Mock localStorage for player scanner
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index) => Object.keys(store)[index] || null
  };
})();

global.localStorage = localStorageMock;

// Mock window object (minimal - only what player scanner uses)
global.window = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/player-scanner/',
    search: ''
  },
  dispatchEvent: jest.fn(),
  CustomEvent: class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock document (minimal - for DOM manipulation tests)
global.document = {
  getElementById: jest.fn((id) => ({
    classList: {
      contains: jest.fn(),
      add: jest.fn(),
      remove: jest.fn()
    },
    src: '',
    style: { display: '' },
    disabled: false
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn(() => ({
    classList: { add: jest.fn() }
  })),
  body: {
    appendChild: jest.fn()
  }
};

// Mock console (player scanner uses console.log/error)
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Mock navigator (for NFC, camera detection)
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn()
  },
  vibrate: jest.fn(),
  userAgent: 'Mozilla/5.0 (Test)'
};

// Mock fetch (for HTTP requests to orchestrator)
global.fetch = jest.fn();

// Helper to create mock fetch responses
const createMockResponse = (status, body, ok = true) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(body),
  text: jest.fn().mockResolvedValue(JSON.stringify(body))
});

// Mock AbortSignal.timeout (may not be available in all test environments)
if (!global.AbortSignal || !global.AbortSignal.timeout) {
  global.AbortSignal = {
    timeout: (ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    }
  };

  global.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

// Mock setInterval/clearInterval to prevent hanging tests
const intervals = new Map();
let intervalId = 0;

// Create jest mocks with implementations
global.setInterval = jest.fn();
global.setInterval.mockImplementation((fn, delay) => {
  const id = ++intervalId;
  intervals.set(id, { fn, delay });
  return id;
});

global.clearInterval = jest.fn();
global.clearInterval.mockImplementation((id) => {
  intervals.delete(id);
});

// Expose for tests that want to manually trigger intervals
global._mockIntervals = intervals;

// Mock setTimeout/clearTimeout
global.setTimeout = jest.fn((fn, delay) => {
  return jest.requireActual('timers').setTimeout(fn, delay);
});

global.clearTimeout = jest.fn((id) => {
  return jest.requireActual('timers').clearTimeout(id);
});

/**
 * Test Helper: Reset all mocks between tests
 */
const resetMocks = () => {
  localStorageMock.clear();
  global.fetch.mockReset();
  global.console.log.mockReset();
  global.console.error.mockReset();
  global.window.dispatchEvent.mockReset();
  global.setInterval.mockClear();  // Clear setInterval call history
  global.clearInterval.mockClear();  // Clear clearInterval call history
  intervals.clear();
  intervalId = 0;
};

/**
 * Test Helper: Setup mock fetch to return specific response
 */
const mockFetchResponse = (status, body, ok = true) => {
  global.fetch.mockResolvedValueOnce(createMockResponse(status, body, ok));
};

/**
 * Test Helper: Setup mock fetch to fail with network error
 */
const mockFetchNetworkError = (message = 'Network error') => {
  global.fetch.mockRejectedValueOnce(new Error(message));
};

/**
 * Test Helper: Get last fetch call details
 */
const getLastFetchCall = () => {
  const calls = global.fetch.mock.calls;
  if (calls.length === 0) return null;

  const [url, options] = calls[calls.length - 1];
  return {
    url,
    method: options?.method || 'GET',
    headers: options?.headers || {},
    body: options?.body ? JSON.parse(options.body) : null
  };
};

/**
 * Test Helper: Wait for async operations
 */
const waitForAsync = () => new Promise(resolve => setImmediate(resolve));

/**
 * Test Helper: Create test token data
 */
const createTestToken = (overrides = {}) => ({
  SF_RFID: 'test_token_001',
  SF_ValueRating: 3,
  SF_MemoryType: 'Technical',
  SF_Group: 'Test Group',
  image: 'assets/images/test.jpg',
  audio: null,
  video: null,
  ...overrides
});

module.exports = {
  resetMocks,
  mockFetchResponse,
  mockFetchNetworkError,
  getLastFetchCall,
  waitForAsync,
  createTestToken,
  createMockResponse
};
