/**
 * Shared utilities for HTTP contract tests
 * Provides consistent setup/teardown and dynamic port allocation
 * Modeled after the successful ws-test-utils.js pattern
 */

const request = require('supertest');

/**
 * Setup HTTP test environment with all services properly initialized
 * @param {Object} options - Configuration options
 * @param {boolean} options.createSession - Whether to create a test session (default: true)
 * @param {string} options.sessionName - Name for the test session
 * @param {boolean} options.needsAuth - Whether to get admin token (default: false)
 * @returns {Promise<{app, server, port, baseUrl, session, adminToken}>}
 */
async function setupHTTPTest(options = {}) {
  const {
    createSession = true,
    sessionName = 'Test Session',
    needsAuth = false
  } = options;

  // Clean environment
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_PASSWORD = 'test-admin-password';

  // Reset modules to get fresh instances
  jest.resetModules();

  // Import fresh app instance
  const app = require('../../src/app');
  const { initializeServices } = require('../../src/app');
  
  // Initialize all services (handles token loading and everything)
  await initializeServices();
  
  // Import services for resetting
  const sessionService = require('../../src/services/sessionService');
  const stateService = require('../../src/services/stateService');
  const transactionService = require('../../src/services/transactionService');
  const videoQueueService = require('../../src/services/videoQueueService');

  // Reset all services to clean state
  await sessionService.reset();
  await stateService.reset();
  if (transactionService.reset) {
    await transactionService.reset();
  }
  if (videoQueueService.reset) {
    videoQueueService.reset();
  }

  // Create server with dynamic port allocation
  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(0, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(srv);
      }
    });
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  // Create test session if requested
  let session = null;
  if (createSession) {
    session = await sessionService.createSession({ name: sessionName });
    // Ensure GameState is created from session
    stateService.createStateFromSession(session);
  }

  // Get admin token if requested
  let adminToken = null;
  if (needsAuth) {
    const authResponse = await request(app)
      .post('/api/admin/auth')
      .send({ password: process.env.ADMIN_PASSWORD });
    
    if (authResponse.status === 200) {
      adminToken = authResponse.body.token;
    }
  }

  return {
    app,
    server,
    port,
    baseUrl,
    session,
    adminToken
  };
}

/**
 * Cleanup HTTP test environment
 * @param {Object} context - The context returned from setupHTTPTest
 */
async function cleanupHTTPTest(context) {
  // Handle case where setup failed and context is undefined
  if (!context) {
    return;
  }

  const { server } = context;

  // CRITICAL: Clean up broadcast listeners FIRST to prevent accumulation
  const { cleanupBroadcastListeners } = require('../../src/websocket/broadcasts');
  cleanupBroadcastListeners();

  // Import all services for comprehensive cleanup
  const sessionService = require('../../src/services/sessionService');
  const stateService = require('../../src/services/stateService');
  const transactionService = require('../../src/services/transactionService');
  const videoQueueService = require('../../src/services/videoQueueService');
  const offlineQueueService = require('../../src/services/offlineQueueService');
  const persistenceService = require('../../src/services/persistenceService');
  const vlcService = require('../../src/services/vlcService');

  // End session if exists
  if (sessionService.getCurrentSession()) {
    await sessionService.endSession();
  }

  // Reset all service states for test isolation
  await sessionService.reset();
  await stateService.reset();
  if (transactionService.reset) {
    await transactionService.reset();
  }
  if (videoQueueService.reset) {
    videoQueueService.reset();
  }
  if (offlineQueueService.reset) {
    await offlineQueueService.reset();
  }
  if (vlcService.reset) {
    vlcService.reset();
  }

  // CRITICAL: Reset offline mode to prevent test contamination
  global.offlineMode = false;
  offlineQueueService.setOfflineStatus(false);
  offlineQueueService.queue = [];
  offlineQueueService.processingQueue = false;

  // Clear persistence storage to avoid cross-test contamination
  await persistenceService.delete('gameState:current');
  await persistenceService.delete('offlineQueue');
  await persistenceService.delete('session:current');

  // Clear any global variables
  if (global.io) {
    global.io = null;
  }

  // Close HTTP server
  if (server) {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  // Clear any timers
  jest.clearAllTimers();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

/**
 * Helper to create a valid scan request payload
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Scan request payload
 */
function createScanPayload(overrides = {}) {
  return {
    tokenId: 'MEM_001',
    teamId: 'TEAM_A',
    scannerId: 'SCANNER_01',
    ...overrides
  };
}

/**
 * Helper to create a valid transaction submission payload
 * @param {Object} overrides - Optional field overrides
 * @returns {Object} Transaction payload
 */
function createTransactionPayload(overrides = {}) {
  return {
    tokenId: 'MEM_001',
    teamId: 'TEAM_A',
    scannerId: 'GM_SCANNER_01',
    ...overrides
  };
}

/**
 * Helper to wait for a condition with timeout
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} timeout - Maximum wait time in ms (default: 5000)
 * @param {number} interval - Check interval in ms (default: 100)
 * @returns {Promise<boolean>} True if condition met, false if timeout
 */
async function waitForCondition(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
}

/**
 * Helper to make authenticated request
 * @param {Object} app - Express app instance
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} path - Request path
 * @param {string} token - Admin JWT token
 * @returns {Object} Supertest request object with auth header
 */
function authenticatedRequest(app, method, path, token) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${token}`);
}

module.exports = {
  setupHTTPTest,
  cleanupHTTPTest,
  createScanPayload,
  createTransactionPayload,
  waitForCondition,
  authenticatedRequest
};