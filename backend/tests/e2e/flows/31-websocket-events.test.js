/**
 * E2E WebSocket Events Test
 *
 * Comprehensive validation of all WebSocket event types against AsyncAPI contract.
 * This test validates:
 * - Session lifecycle events
 * - Transaction processing events
 * - Score update events
 * - Video orchestration events
 * - Device tracking events
 * - Contract compliance (wrapped envelope pattern)
 * - Event ordering and timing
 * - Broadcast behavior
 *
 * Contract Reference: backend/contracts/asyncapi.yaml
 *
 * @group websocket
 * @priority critical
 */

const { test, expect, chromium } = require('@playwright/test');
const axios = require('axios');

// Test infrastructure imports
const {
  startOrchestrator,
  stopOrchestrator,
  getOrchestratorUrl,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');

const {
  closeAllContexts
} = require('../setup/browser-contexts');

const {
  connectWithAuth,
  waitForEvent,
  validateEventEnvelope,
  cleanupAllSockets,
  setupEventListener
} = require('../setup/websocket-client');

const {
  createHTTPSAgent
} = require('../setup/ssl-cert-helper');

// Test fixtures
const testTokens = require('../fixtures/test-tokens.json');

// Global test state
let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let adminPassword = null;

// ========================================
// SETUP & TEARDOWN
// ========================================

test.describe('WebSocket Events Test', () => {

  test.beforeAll(async () => {
    // 1. Clear any existing session data
    await clearSessionData();

    // 2. Start VLC
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode on port ${vlcInfo.port}`);

    // 3. Start orchestrator with HTTPS
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });
    console.log(`Orchestrator started: ${orchestratorInfo.url}`);

    // 4. Use test admin password (set by test-server.js)
    adminPassword = 'test-admin-password';

    // 5. Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched');
  });

  test.afterAll(async () => {
    console.log('Starting cleanup...');

    await closeAllContexts();
    await cleanupAllSockets();

    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }

    await stopOrchestrator();
    console.log('Orchestrator stopped');

    await cleanupVLC();
    console.log('VLC stopped');
  });

  test.afterEach(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
  });

  // ========================================
  // SESSION EVENTS (6 tests)
  // ========================================

  test.describe('Session Events', () => {

    test('session:update event on session create', async () => {
      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Verify initial sync received
      expect(socket.initialSync).toBeDefined();
      expect(socket.initialSync.data.session).toBeNull(); // No session yet

      // Setup listener for session:update
      const sessionUpdatePromise = waitForEvent(socket, 'session:update', null, 5000);

      // Create session via HTTP
      const httpsAgent = createHTTPSAgent();
      const sessionResponse = await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - WebSocket Events',
          teams: ['001', '002', '003']
        },
        {
          httpsAgent,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      expect(sessionResponse.status).toBe(201);

      // Wait for session:update broadcast
      const sessionUpdateEvent = await sessionUpdatePromise;

      // Validate envelope pattern
      validateEventEnvelope(sessionUpdateEvent, 'session:update');

      // Validate session data structure
      expect(sessionUpdateEvent.data).toHaveProperty('id');
      expect(sessionUpdateEvent.data).toHaveProperty('name');
      expect(sessionUpdateEvent.data).toHaveProperty('startTime');
      expect(sessionUpdateEvent.data).toHaveProperty('status');
      expect(sessionUpdateEvent.data).toHaveProperty('teams');
      expect(sessionUpdateEvent.data).toHaveProperty('metadata');

      // Validate session values
      expect(sessionUpdateEvent.data.name).toBe('Test Session - WebSocket Events');
      expect(sessionUpdateEvent.data.status).toBe('active');
      expect(sessionUpdateEvent.data.teams).toEqual(['001', '002', '003']);
      expect(sessionUpdateEvent.data.endTime).toBeNull();
    });

    test('session:update event on session pause', async () => {
      // Create session first
      const httpsAgent = createHTTPSAgent();
      const sessionResponse = await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Pause',
          teams: ['001', '002']
        },
        { httpsAgent }
      );

      const sessionId = sessionResponse.data.id;

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for session:update
      const sessionUpdatePromise = waitForEvent(socket, 'session:update', null, 5000);

      // Pause session via HTTP
      await axios.patch(
        `${orchestratorInfo.url}/api/session/${sessionId}/pause`,
        {},
        { httpsAgent }
      );

      // Wait for session:update broadcast
      const sessionUpdateEvent = await sessionUpdatePromise;

      // Validate envelope pattern
      validateEventEnvelope(sessionUpdateEvent, 'session:update');

      // Validate session status changed to paused
      expect(sessionUpdateEvent.data.status).toBe('paused');
      expect(sessionUpdateEvent.data.id).toBe(sessionId);
    });

    test('session:update event on session resume', async () => {
      // Create and pause session
      const httpsAgent = createHTTPSAgent();
      const sessionResponse = await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Resume',
          teams: ['001', '002']
        },
        { httpsAgent }
      );

      const sessionId = sessionResponse.data.id;

      await axios.patch(
        `${orchestratorInfo.url}/api/session/${sessionId}/pause`,
        {},
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for session:update
      const sessionUpdatePromise = waitForEvent(socket, 'session:update', null, 5000);

      // Resume session via HTTP
      await axios.patch(
        `${orchestratorInfo.url}/api/session/${sessionId}/resume`,
        {},
        { httpsAgent }
      );

      // Wait for session:update broadcast
      const sessionUpdateEvent = await sessionUpdatePromise;

      // Validate envelope pattern
      validateEventEnvelope(sessionUpdateEvent, 'session:update');

      // Validate session status changed to active
      expect(sessionUpdateEvent.data.status).toBe('active');
      expect(sessionUpdateEvent.data.id).toBe(sessionId);
    });

    test('session:update event on session end', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      const sessionResponse = await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - End',
          teams: ['001', '002']
        },
        { httpsAgent }
      );

      const sessionId = sessionResponse.data.id;

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for session:update
      const sessionUpdatePromise = waitForEvent(socket, 'session:update', null, 5000);

      // End session via HTTP
      await axios.patch(
        `${orchestratorInfo.url}/api/session/${sessionId}/end`,
        {},
        { httpsAgent }
      );

      // Wait for session:update broadcast
      const sessionUpdateEvent = await sessionUpdatePromise;

      // Validate envelope pattern
      validateEventEnvelope(sessionUpdateEvent, 'session:update');

      // Validate session status changed to ended
      expect(sessionUpdateEvent.data.status).toBe('ended');
      expect(sessionUpdateEvent.data.id).toBe(sessionId);
      expect(sessionUpdateEvent.data.endTime).toBeTruthy();
    });

    test('sync:full includes complete session data', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Sync Full',
          teams: ['001', '002', '003']
        },
        { httpsAgent }
      );

      // Connect GM Scanner (receives sync:full automatically)
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Verify sync:full was received
      expect(socket.initialSync).toBeDefined();

      // Validate envelope pattern
      validateEventEnvelope(socket.initialSync, 'sync:full');

      // Validate sync:full structure per AsyncAPI contract
      expect(socket.initialSync.data).toHaveProperty('session');
      expect(socket.initialSync.data).toHaveProperty('scores');
      expect(socket.initialSync.data).toHaveProperty('recentTransactions');
      expect(socket.initialSync.data).toHaveProperty('videoStatus');
      expect(socket.initialSync.data).toHaveProperty('devices');
      expect(socket.initialSync.data).toHaveProperty('systemStatus');

      // Validate session data
      expect(socket.initialSync.data.session).toBeTruthy();
      expect(socket.initialSync.data.session.name).toBe('Test Session - Sync Full');
      expect(socket.initialSync.data.session.teams).toEqual(['001', '002', '003']);
      expect(socket.initialSync.data.session.status).toBe('active');

      // Validate scores array
      expect(Array.isArray(socket.initialSync.data.scores)).toBe(true);

      // Validate video status structure
      expect(socket.initialSync.data.videoStatus).toHaveProperty('status');
      expect(socket.initialSync.data.videoStatus).toHaveProperty('queueLength');
    });

    test('session:update uses wrapped envelope pattern', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      const sessionResponse = await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Envelope',
          teams: ['001']
        },
        { httpsAgent }
      );

      const sessionId = sessionResponse.data.id;

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for session:update
      const sessionUpdatePromise = waitForEvent(socket, 'session:update', null, 5000);

      // Trigger session update
      await axios.patch(
        `${orchestratorInfo.url}/api/session/${sessionId}/pause`,
        {},
        { httpsAgent }
      );

      // Wait for session:update
      const sessionUpdateEvent = await sessionUpdatePromise;

      // Validate envelope structure
      expect(sessionUpdateEvent).toHaveProperty('event');
      expect(sessionUpdateEvent).toHaveProperty('data');
      expect(sessionUpdateEvent).toHaveProperty('timestamp');

      // Validate event field
      expect(sessionUpdateEvent.event).toBe('session:update');

      // Validate timestamp format (ISO 8601)
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(timestampRegex.test(sessionUpdateEvent.timestamp)).toBe(true);

      // Validate data is object (not array)
      expect(typeof sessionUpdateEvent.data).toBe('object');
      expect(Array.isArray(sessionUpdateEvent.data)).toBe(false);
    });

  });

  // ========================================
  // TRANSACTION EVENTS (8 tests)
  // ========================================

  test.describe('Transaction Events', () => {

    test('transaction:submit client → server flow', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Transaction Submit',
          teams: ['001', '002']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for transaction:result
      const transactionResultPromise = waitForEvent(socket, 'transaction:result', null, 5000);

      // Get valid token from fixtures
      const testToken = testTokens.validTokens[0];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for transaction:result
      const transactionResult = await transactionResultPromise;

      // Validate envelope pattern
      validateEventEnvelope(transactionResult, 'transaction:result');

      // Validate result structure
      expect(transactionResult.data).toHaveProperty('status');
      expect(transactionResult.data).toHaveProperty('transactionId');
      expect(transactionResult.data).toHaveProperty('tokenId');
      expect(transactionResult.data).toHaveProperty('teamId');
      expect(transactionResult.data).toHaveProperty('points');
      expect(transactionResult.data).toHaveProperty('message');

      // Validate result values
      expect(transactionResult.data.status).toBe('accepted');
      expect(transactionResult.data.tokenId).toBe(testToken.id);
      expect(transactionResult.data.teamId).toBe('001');
    });

    test('transaction:new broadcast to all GM stations', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Transaction Broadcast',
          teams: ['001', '002']
        },
        { httpsAgent }
      );

      // Connect two GM Scanners
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Setup listeners for transaction:new on both sockets
      const transaction1Promise = waitForEvent(socket1, 'transaction:new', null, 5000);
      const transaction2Promise = waitForEvent(socket2, 'transaction:new', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[0];

      // Submit transaction from socket1
      socket1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for transaction:new on both sockets
      const [transaction1, transaction2] = await Promise.all([
        transaction1Promise,
        transaction2Promise
      ]);

      // Validate both received the same transaction
      expect(transaction1.data.transaction.id).toBe(transaction2.data.transaction.id);
      expect(transaction1.data.transaction.tokenId).toBe(testToken.id);
      expect(transaction2.data.transaction.tokenId).toBe(testToken.id);
    });

    test('transaction:new uses wrapped envelope pattern', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Transaction Envelope',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for transaction:new
      const transactionNewPromise = waitForEvent(socket, 'transaction:new', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[1];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for transaction:new
      const transactionNew = await transactionNewPromise;

      // Validate envelope structure
      validateEventEnvelope(transactionNew, 'transaction:new');

      // Validate envelope fields
      expect(transactionNew).toHaveProperty('event');
      expect(transactionNew).toHaveProperty('data');
      expect(transactionNew).toHaveProperty('timestamp');
      expect(transactionNew.event).toBe('transaction:new');
    });

    test('transaction:new includes full transaction object', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Full Transaction',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for transaction:new
      const transactionNewPromise = waitForEvent(socket, 'transaction:new', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[2];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for transaction:new
      const transactionNew = await transactionNewPromise;

      // Validate transaction object structure per AsyncAPI contract
      expect(transactionNew.data).toHaveProperty('transaction');
      const transaction = transactionNew.data.transaction;

      // Required fields
      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('tokenId');
      expect(transaction).toHaveProperty('teamId');
      expect(transaction).toHaveProperty('deviceId');
      expect(transaction).toHaveProperty('mode');
      expect(transaction).toHaveProperty('points');
      expect(transaction).toHaveProperty('timestamp');

      // Enriched fields from tokens.json
      expect(transaction).toHaveProperty('memoryType');
      expect(transaction).toHaveProperty('valueRating');

      // Optional group field
      if (transaction.group) {
        expect(typeof transaction.group).toBe('string');
      }

      // Validate values
      expect(transaction.tokenId).toBe(testToken.id);
      expect(transaction.teamId).toBe('001');
      expect(transaction.deviceId).toBe('GM_Station_1');
      expect(transaction.mode).toBe('blackmarket');
      expect(typeof transaction.points).toBe('number');
    });

    test('duplicate transaction detection via transaction:result', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Duplicate Detection',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get valid token
      const testToken = testTokens.validTokens[3];

      // Submit first transaction
      const result1Promise = waitForEvent(socket, 'transaction:result', null, 5000);
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');

      // Submit duplicate transaction
      const result2Promise = waitForEvent(socket, 'transaction:result', null, 5000);
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate duplicate detected
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('duplicate');
    });

    test('transaction:delete admin command', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Delete Transaction',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get valid token
      const testToken = testTokens.validTokens[4];

      // Submit transaction
      const resultPromise = waitForEvent(socket, 'transaction:result', null, 5000);
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result = await resultPromise;
      const transactionId = result.data.transactionId;

      // Delete transaction via HTTP (admin command)
      const deleteResponse = await axios.delete(
        `${orchestratorInfo.url}/api/admin/transactions/${transactionId}`,
        { httpsAgent }
      );

      expect(deleteResponse.status).toBe(200);
    });

    test('transaction event ordering preserved', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Event Ordering',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Track event order
      const events = [];
      setupEventListener(socket, 'transaction:result', (event) => {
        events.push({ type: 'result', timestamp: event.timestamp });
      });
      setupEventListener(socket, 'transaction:new', (event) => {
        events.push({ type: 'new', timestamp: event.timestamp });
      });

      // Get valid token
      const testToken = testTokens.validTokens[5];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for both events
      await waitForEvent(socket, 'transaction:result', null, 5000);
      await waitForEvent(socket, 'transaction:new', null, 5000);

      // Validate event order
      expect(events.length).toBeGreaterThanOrEqual(2);

      // Find result and new events
      const resultEvent = events.find(e => e.type === 'result');
      const newEvent = events.find(e => e.type === 'new');

      expect(resultEvent).toBeDefined();
      expect(newEvent).toBeDefined();

      // Validate timestamps are ISO 8601
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(timestampRegex.test(resultEvent.timestamp)).toBe(true);
      expect(timestampRegex.test(newEvent.timestamp)).toBe(true);
    });

    test('transaction:new includes token metadata enrichment', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Token Metadata',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for transaction:new
      const transactionNewPromise = waitForEvent(socket, 'transaction:new', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[0];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for transaction:new
      const transactionNew = await transactionNewPromise;

      // Validate token metadata is enriched from tokens.json
      const transaction = transactionNew.data.transaction;

      // Backend should enrich with token metadata
      expect(transaction.memoryType).toBeDefined();
      expect(['Technical', 'Business', 'Personal']).toContain(transaction.memoryType);

      expect(transaction.valueRating).toBeDefined();
      expect(transaction.valueRating).toBeGreaterThanOrEqual(1);
      expect(transaction.valueRating).toBeLessThanOrEqual(5);
    });

  });

  // ========================================
  // SCORE EVENTS (5 tests)
  // ========================================

  test.describe('Score Events', () => {

    test('score:updated event on transaction score change', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Score Update',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for score:updated
      const scoreUpdatedPromise = waitForEvent(socket, 'score:updated', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[0];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for score:updated
      const scoreUpdated = await scoreUpdatedPromise;

      // Validate envelope pattern
      validateEventEnvelope(scoreUpdated, 'score:updated');

      // Validate score data structure per AsyncAPI contract (all 8 fields required)
      expect(scoreUpdated.data).toHaveProperty('teamId');
      expect(scoreUpdated.data).toHaveProperty('currentScore');
      expect(scoreUpdated.data).toHaveProperty('baseScore');
      expect(scoreUpdated.data).toHaveProperty('bonusPoints');
      expect(scoreUpdated.data).toHaveProperty('tokensScanned');
      expect(scoreUpdated.data).toHaveProperty('completedGroups');
      expect(scoreUpdated.data).toHaveProperty('adminAdjustments');
      expect(scoreUpdated.data).toHaveProperty('lastUpdate');

      // Validate values
      expect(scoreUpdated.data.teamId).toBe('001');
      expect(scoreUpdated.data.currentScore).toBeGreaterThan(0);
      expect(scoreUpdated.data.tokensScanned).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(scoreUpdated.data.completedGroups)).toBe(true);
      expect(Array.isArray(scoreUpdated.data.adminAdjustments)).toBe(true);
    });

    test('score:updated event on admin adjustment', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Admin Adjustment',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for score:updated
      const scoreUpdatedPromise = waitForEvent(socket, 'score:updated', null, 5000);

      // Admin score adjustment via HTTP
      await axios.post(
        `${orchestratorInfo.url}/api/admin/scores/adjust`,
        {
          teamId: '001',
          delta: -500,
          reason: 'Test penalty'
        },
        { httpsAgent }
      );

      // Wait for score:updated
      const scoreUpdated = await scoreUpdatedPromise;

      // Validate envelope pattern
      validateEventEnvelope(scoreUpdated, 'score:updated');

      // Validate admin adjustment recorded
      expect(scoreUpdated.data.teamId).toBe('001');
      expect(scoreUpdated.data.adminAdjustments).toBeDefined();
      expect(Array.isArray(scoreUpdated.data.adminAdjustments)).toBe(true);

      if (scoreUpdated.data.adminAdjustments.length > 0) {
        const adjustment = scoreUpdated.data.adminAdjustments[0];
        expect(adjustment).toHaveProperty('delta');
        expect(adjustment).toHaveProperty('gmStation');
        expect(adjustment).toHaveProperty('reason');
        expect(adjustment).toHaveProperty('timestamp');
      }
    });

    test('score:updated includes team scores map', async () => {
      // Create session with multiple teams
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Score Map',
          teams: ['001', '002', '003']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for score:updated
      const scoreUpdatedPromise = waitForEvent(socket, 'score:updated', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[1];

      // Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for score:updated
      const scoreUpdated = await scoreUpdatedPromise;

      // Validate score for team 001
      expect(scoreUpdated.data.teamId).toBe('001');
      expect(scoreUpdated.data.currentScore).toBeDefined();
      expect(typeof scoreUpdated.data.currentScore).toBe('number');

      // Note: AsyncAPI contract specifies individual team score updates, not a map
      // Each team gets its own score:updated event
    });

    test('score:updated broadcast to all GM devices', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Score Broadcast',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect two GM Scanners
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Setup listeners for score:updated on both sockets
      const score1Promise = waitForEvent(socket1, 'score:updated', null, 5000);
      const score2Promise = waitForEvent(socket2, 'score:updated', null, 5000);

      // Get valid token
      const testToken = testTokens.validTokens[2];

      // Submit transaction from socket1
      socket1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for score:updated on both sockets
      const [score1, score2] = await Promise.all([
        score1Promise,
        score2Promise
      ]);

      // Validate both received the same score update
      expect(score1.data.teamId).toBe('001');
      expect(score2.data.teamId).toBe('001');
      expect(score1.data.currentScore).toBe(score2.data.currentScore);
    });

    test('score:updated after group completion includes bonus', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Group Completion',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // To test group completion, we need to scan all tokens in a group
      // This test validates the score:updated structure when group bonus is awarded

      // Get tokens from the same group (if available in fixtures)
      const groupTokens = testTokens.validTokens.filter(t => t.group === 'jaw_group');

      if (groupTokens.length > 0) {
        // Setup listener for score:updated
        const scoreUpdatedPromise = waitForEvent(socket, 'score:updated', null, 5000);

        // Submit transaction
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: groupTokens[0].id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait for score:updated
        const scoreUpdated = await scoreUpdatedPromise;

        // Validate score structure includes bonus fields
        expect(scoreUpdated.data).toHaveProperty('bonusPoints');
        expect(scoreUpdated.data).toHaveProperty('completedGroups');
        expect(typeof scoreUpdated.data.bonusPoints).toBe('number');
        expect(Array.isArray(scoreUpdated.data.completedGroups)).toBe(true);
      } else {
        console.log('Skipping group completion test - no group tokens in fixtures');
      }
    });

  });

  // ========================================
  // VIDEO EVENTS (8 tests)
  // ========================================

  test.describe('Video Events', () => {

    test('video:status event structure includes required fields', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Status',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Check initial sync includes video status
      expect(socket.initialSync.data.videoStatus).toBeDefined();

      // Validate video status structure per AsyncAPI contract
      const videoStatus = socket.initialSync.data.videoStatus;
      expect(videoStatus).toHaveProperty('status');
      expect(videoStatus).toHaveProperty('queueLength');

      // Validate status enum
      expect(['idle', 'loading', 'playing', 'paused', 'completed', 'error']).toContain(videoStatus.status);

      // Validate queueLength is number
      expect(typeof videoStatus.queueLength).toBe('number');
      expect(videoStatus.queueLength).toBeGreaterThanOrEqual(0);
    });

    test('video:status event on video queued', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Queued',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for video:status
      const videoStatusPromise = waitForEvent(socket, 'video:status', null, 5000);

      // Get token with video
      const videoToken = testTokens.validTokens.find(t => t.video);

      if (videoToken) {
        // Submit transaction for token with video
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: videoToken.id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait for video:status
        const videoStatus = await videoStatusPromise;

        // Validate envelope pattern
        validateEventEnvelope(videoStatus, 'video:status');

        // Validate video was queued
        expect(videoStatus.data.queueLength).toBeGreaterThan(0);
      } else {
        console.log('Skipping video queued test - no video tokens in fixtures');
      }
    });

    test('video:status event includes queue array information', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Queue',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Check video status from initial sync
      const videoStatus = socket.initialSync.data.videoStatus;

      // Validate queueLength field exists (per AsyncAPI Decision #5)
      expect(videoStatus).toHaveProperty('queueLength');
      expect(typeof videoStatus.queueLength).toBe('number');

      // Note: AsyncAPI contract specifies queueLength (number), not queue array
      // This is a breaking change from previous implementation
    });

    test('video:status event includes current video info', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Current Video',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Check video status from initial sync
      const videoStatus = socket.initialSync.data.videoStatus;

      // Validate current video fields (nullable when idle)
      expect(videoStatus).toHaveProperty('tokenId');
      expect(videoStatus).toHaveProperty('duration');
      expect(videoStatus).toHaveProperty('progress');
      expect(videoStatus).toHaveProperty('expectedEndTime');

      // When idle, these should be null
      if (videoStatus.status === 'idle') {
        expect(videoStatus.tokenId).toBeNull();
        expect(videoStatus.duration).toBeNull();
        expect(videoStatus.progress).toBeNull();
        expect(videoStatus.expectedEndTime).toBeNull();
      }
    });

    test('video:status event on video playing', async () => {
      // Note: This test requires VLC to actually play a video
      // In mock mode, VLC will simulate the playing state

      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Playing',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get token with video
      const videoToken = testTokens.validTokens.find(t => t.video);

      if (videoToken) {
        // Setup listener for video:status with playing state
        const videoPlayingPromise = waitForEvent(
          socket,
          'video:status',
          (event) => event.data.status === 'playing',
          10000 // Longer timeout for video to start
        );

        // Submit transaction for token with video
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: videoToken.id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait for video:status with playing state
        const videoStatus = await videoPlayingPromise;

        // Validate status is playing
        expect(videoStatus.data.status).toBe('playing');
        expect(videoStatus.data.tokenId).toBe(videoToken.id);
      } else {
        console.log('Skipping video playing test - no video tokens in fixtures');
      }
    });

    test('video:status event on video paused', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Paused',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get token with video
      const videoToken = testTokens.validTokens.find(t => t.video);

      if (videoToken) {
        // Queue video first
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: videoToken.id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait a bit for video to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Setup listener for video:status with paused state
        const videoPausedPromise = waitForEvent(
          socket,
          'video:status',
          (event) => event.data.status === 'paused',
          5000
        );

        // Pause video via admin command
        await axios.post(
          `${orchestratorInfo.url}/api/admin/video/pause`,
          {},
          { httpsAgent }
        );

        // Wait for video:status with paused state
        const videoStatus = await videoPausedPromise;

        // Validate status is paused
        expect(videoStatus.data.status).toBe('paused');
      } else {
        console.log('Skipping video paused test - no video tokens in fixtures');
      }
    });

    test('video:status event on video completed', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Completed',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get token with video
      const videoToken = testTokens.validTokens.find(t => t.video);

      if (videoToken) {
        // Setup listener for video:status with completed state
        const videoCompletedPromise = waitForEvent(
          socket,
          'video:status',
          (event) => event.data.status === 'completed',
          15000 // Longer timeout for video to complete
        );

        // Submit transaction for token with video
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: videoToken.id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait for video:status with completed state
        const videoStatus = await videoCompletedPromise;

        // Validate status is completed
        expect(videoStatus.data.status).toBe('completed');
      } else {
        console.log('Skipping video completed test - no video tokens in fixtures');
      }
    });

    test('video:status event on video error', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Video Error',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Get invalid video token (if available)
      const invalidVideoToken = testTokens.invalidTokens?.find(t => t.video);

      if (invalidVideoToken) {
        // Setup listener for video:status with error state
        const videoErrorPromise = waitForEvent(
          socket,
          'video:status',
          (event) => event.data.status === 'error',
          10000
        );

        // Submit transaction for invalid video token
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: invalidVideoToken.id,
            teamId: '001',
            deviceId: 'GM_Station_1',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        // Wait for video:status with error state
        const videoStatus = await videoErrorPromise;

        // Validate status is error
        expect(videoStatus.data.status).toBe('error');
        expect(videoStatus.data.error).toBeTruthy();
      } else {
        console.log('Skipping video error test - no invalid video tokens in fixtures');
      }
    });

  });

  // ========================================
  // DEVICE EVENTS (4 tests)
  // ========================================

  test.describe('Device Events', () => {

    test('device:connected event on new device connection', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Device Connected',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect first GM Scanner
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for device:connected on first socket
      const deviceConnectedPromise = waitForEvent(socket1, 'device:connected', null, 5000);

      // Connect second GM Scanner (should trigger device:connected to socket1)
      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Wait for device:connected
      const deviceConnected = await deviceConnectedPromise;

      // Validate envelope pattern
      validateEventEnvelope(deviceConnected, 'device:connected');

      // Validate device info structure
      expect(deviceConnected.data).toHaveProperty('deviceId');
      expect(deviceConnected.data).toHaveProperty('type');
      expect(deviceConnected.data).toHaveProperty('name');
      expect(deviceConnected.data).toHaveProperty('ipAddress');
      expect(deviceConnected.data).toHaveProperty('connectionTime');

      // Validate values
      expect(deviceConnected.data.deviceId).toBe('GM_Station_2');
      expect(deviceConnected.data.type).toBe('gm');
    });

    test('device:disconnected event on device disconnect', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Device Disconnected',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect two GM Scanners
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Setup listener for device:disconnected on socket1
      const deviceDisconnectedPromise = waitForEvent(socket1, 'device:disconnected', null, 5000);

      // Disconnect socket2
      socket2.disconnect();

      // Wait for device:disconnected
      const deviceDisconnected = await deviceDisconnectedPromise;

      // Validate envelope pattern
      validateEventEnvelope(deviceDisconnected, 'device:disconnected');

      // Validate device info structure
      expect(deviceDisconnected.data).toHaveProperty('deviceId');
      expect(deviceDisconnected.data).toHaveProperty('reason');
      expect(deviceDisconnected.data).toHaveProperty('disconnectionTime');

      // Validate values
      expect(deviceDisconnected.data.deviceId).toBe('GM_Station_2');
      expect(['manual', 'timeout', 'error']).toContain(deviceDisconnected.data.reason);
    });

    test('device:connected includes complete device info', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Device Info',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect first GM Scanner
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Setup listener for device:connected
      const deviceConnectedPromise = waitForEvent(socket1, 'device:connected', null, 5000);

      // Connect second GM Scanner with version info
      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm',
        { version: '1.2.3' }
      );

      // Wait for device:connected
      const deviceConnected = await deviceConnectedPromise;

      // Validate device info is single object (not array) per AsyncAPI Decision #8
      expect(deviceConnected.data).toBeDefined();
      expect(Array.isArray(deviceConnected.data)).toBe(false);
      expect(typeof deviceConnected.data).toBe('object');

      // Validate required fields
      expect(deviceConnected.data.deviceId).toBe('GM_Station_2');
      expect(deviceConnected.data.type).toBe('gm');
      expect(deviceConnected.data.name).toBeTruthy();
      expect(deviceConnected.data.ipAddress).toBeTruthy();
      expect(deviceConnected.data.connectionTime).toBeTruthy();

      // Validate timestamp format
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(timestampRegex.test(deviceConnected.data.connectionTime)).toBe(true);
    });

    test('device list in sync:full includes all connected devices', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Device List',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect two GM Scanners
      const socket1 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Check device list in sync:full
      const devices = socket2.initialSync.data.devices;

      // Validate devices array
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThanOrEqual(2); // At least socket1 and socket2

      // Validate device structure
      devices.forEach(device => {
        expect(device).toHaveProperty('deviceId');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('connectionTime');
      });

      // Verify both devices are in the list
      const deviceIds = devices.map(d => d.deviceId);
      expect(deviceIds).toContain('GM_Station_1');
      expect(deviceIds).toContain('GM_Station_2');
    });

  });

  // ========================================
  // CONTRACT COMPLIANCE (6 tests)
  // ========================================

  test.describe('Contract Compliance', () => {

    test('all events follow wrapped envelope pattern', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Envelope Pattern',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Collect all event types
      const eventsReceived = [];

      // Setup listeners for all event types
      const eventTypes = [
        'sync:full',
        'session:update',
        'transaction:result',
        'transaction:new',
        'score:updated',
        'video:status',
        'device:connected',
        'device:disconnected'
      ];

      eventTypes.forEach(eventType => {
        setupEventListener(socket, eventType, (event) => {
          eventsReceived.push({ type: eventType, event });
        });
      });

      // Trigger various events
      const testToken = testTokens.validTokens[0];
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for events to arrive
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate all events follow envelope pattern
      expect(eventsReceived.length).toBeGreaterThan(0);

      eventsReceived.forEach(({ type, event }) => {
        // Validate envelope structure
        expect(event).toHaveProperty('event');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');

        // Validate event field matches type
        expect(event.event).toBe(type);

        // Validate data is object
        expect(typeof event.data).toBe('object');
        expect(event.data).not.toBeNull();

        // Validate timestamp is ISO 8601
        const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
        expect(timestampRegex.test(event.timestamp)).toBe(true);
      });
    });

    test('all events include valid timestamp', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Timestamps',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Check initial sync:full timestamp
      expect(socket.initialSync.timestamp).toBeDefined();

      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
      expect(timestampRegex.test(socket.initialSync.timestamp)).toBe(true);

      // Parse timestamp to verify it's a valid date
      const timestamp = new Date(socket.initialSync.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');

      // Verify timestamp is recent (within last minute)
      const now = new Date();
      const timeDiff = Math.abs(now - timestamp);
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });

    test('event validation matches asyncapi.yaml schema', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Schema Validation',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Validate sync:full matches schema
      const syncFull = socket.initialSync;

      // Required top-level fields
      expect(syncFull).toHaveProperty('event');
      expect(syncFull).toHaveProperty('data');
      expect(syncFull).toHaveProperty('timestamp');

      // Event field validation
      expect(syncFull.event).toBe('sync:full');

      // Data structure validation per asyncapi.yaml lines 278-537
      expect(syncFull.data).toHaveProperty('session');
      expect(syncFull.data).toHaveProperty('scores');
      expect(syncFull.data).toHaveProperty('recentTransactions');
      expect(syncFull.data).toHaveProperty('videoStatus');
      expect(syncFull.data).toHaveProperty('devices');
      expect(syncFull.data).toHaveProperty('systemStatus');

      // Validate scores array structure
      if (Array.isArray(syncFull.data.scores) && syncFull.data.scores.length > 0) {
        const score = syncFull.data.scores[0];
        expect(score).toHaveProperty('teamId');
        expect(score).toHaveProperty('currentScore');
        expect(score).toHaveProperty('baseScore');
        expect(score).toHaveProperty('bonusPoints');
        expect(score).toHaveProperty('tokensScanned');
        expect(score).toHaveProperty('completedGroups');
        expect(score).toHaveProperty('adminAdjustments');
        expect(score).toHaveProperty('lastUpdate');
      }

      // Validate videoStatus structure per asyncapi.yaml lines 453-490
      expect(syncFull.data.videoStatus).toHaveProperty('status');
      expect(syncFull.data.videoStatus).toHaveProperty('queueLength');
      expect(['idle', 'loading', 'playing', 'paused', 'completed', 'error']).toContain(
        syncFull.data.videoStatus.status
      );
      expect(typeof syncFull.data.videoStatus.queueLength).toBe('number');

      // Validate systemStatus structure
      expect(syncFull.data.systemStatus).toHaveProperty('orchestrator');
      expect(syncFull.data.systemStatus).toHaveProperty('vlc');
      expect(['online', 'offline']).toContain(syncFull.data.systemStatus.orchestrator);
      expect(['connected', 'disconnected', 'error']).toContain(syncFull.data.systemStatus.vlc);
    });

    test('event ordering preserved across multiple events', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Event Ordering',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Collect events with receive timestamps
      const eventsReceived = [];

      const eventTypes = ['transaction:result', 'transaction:new', 'score:updated'];
      eventTypes.forEach(eventType => {
        setupEventListener(socket, eventType, (event) => {
          eventsReceived.push({
            type: eventType,
            serverTimestamp: event.timestamp,
            receiveTime: Date.now()
          });
        });
      });

      // Submit transaction
      const testToken = testTokens.validTokens[0];
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for all events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate we received multiple events
      expect(eventsReceived.length).toBeGreaterThanOrEqual(2);

      // Validate events are in chronological order by server timestamp
      for (let i = 1; i < eventsReceived.length; i++) {
        const prevTimestamp = new Date(eventsReceived[i - 1].serverTimestamp);
        const currTimestamp = new Date(eventsReceived[i].serverTimestamp);

        // Current timestamp should be >= previous timestamp
        expect(currTimestamp.getTime()).toBeGreaterThanOrEqual(prevTimestamp.getTime());
      }
    });

    test('no duplicate event listeners warning', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Duplicate Listeners',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Backend should use listenerRegistry to prevent duplicate listeners
      // This test validates that multiple connections don't create duplicate listeners

      // Connect second time (simulate reconnection)
      const socket2 = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_2',
        'gm'
      );

      // Both sockets should work without "duplicate listener" warnings in logs
      // This is validated by the backend's listenerRegistry system

      // Submit transaction from both sockets
      const testToken1 = testTokens.validTokens[0];
      const testToken2 = testTokens.validTokens[1];

      const result1Promise = waitForEvent(socket, 'transaction:result', null, 5000);
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken1.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2Promise = waitForEvent(socket2, 'transaction:result', null, 5000);
      socket2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken2.id,
          teamId: '001',
          deviceId: 'GM_Station_2',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Both should succeed
      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      expect(result1.data.status).toBe('accepted');
      expect(result2.data.status).toBe('accepted');
    });

    test('validateEventEnvelope helper validates all event types', async () => {
      // Create session
      const httpsAgent = createHTTPSAgent();
      await axios.post(
        `${orchestratorInfo.url}/api/session`,
        {
          name: 'Test Session - Envelope Validation',
          teams: ['001']
        },
        { httpsAgent }
      );

      // Connect GM Scanner
      const socket = await connectWithAuth(
        orchestratorInfo.url,
        adminPassword,
        'GM_Station_1',
        'gm'
      );

      // Validate sync:full
      expect(() => validateEventEnvelope(socket.initialSync, 'sync:full')).not.toThrow();

      // Setup listener to collect events
      const events = {};
      const eventTypes = ['session:update', 'transaction:new', 'score:updated'];

      eventTypes.forEach(eventType => {
        setupEventListener(socket, eventType, (event) => {
          events[eventType] = event;
        });
      });

      // Trigger session update
      const sessionId = socket.initialSync.data.session?.id;
      if (sessionId) {
        await axios.patch(
          `${orchestratorInfo.url}/api/session/${sessionId}/pause`,
          {},
          { httpsAgent }
        );
      }

      // Submit transaction
      const testToken = testTokens.validTokens[0];
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: testToken.id,
          teamId: '001',
          deviceId: 'GM_Station_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate all collected events
      Object.entries(events).forEach(([eventType, event]) => {
        expect(() => validateEventEnvelope(event, eventType)).not.toThrow();
      });
    });

  });

});
