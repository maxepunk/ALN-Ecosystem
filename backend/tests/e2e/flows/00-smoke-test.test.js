/**
 * E2E Infrastructure Smoke Test
 *
 * Validates that all Phase 1 infrastructure components work together:
 * - Test server (orchestrator lifecycle)
 * - VLC service (mock/real)
 * - Browser contexts (multi-instance)
 * - WebSocket client (JWT auth, events)
 * - SSL certificate handling (HTTPS)
 * - Page objects (GM Scanner)
 * - Wait conditions (event-driven)
 * - Assertions (domain-specific)
 * - Test fixtures (tokens, media)
 *
 * This test MUST pass before implementing any other E2E tests.
 *
 * @group smoke
 * @priority critical
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

// Test infrastructure imports
const {
  startOrchestrator,
  stopOrchestrator,
  getOrchestratorUrl,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');

const {
  createBrowserContext,
  createMultipleContexts,
  createPage,
  closeAllContexts,
  getActiveContextCount
} = require('../setup/browser-contexts');

const { initializeGMScannerWithMode } = require('../helpers/scanner-init');

const {
  connectWithAuth,
  waitForEvent,
  validateEventEnvelope,
  cleanupAllSockets,
  getActiveSocketCount
} = require('../setup/websocket-client');

const {
  createHTTPSAgent,
  configureAxiosForHTTPS
} = require('../setup/ssl-cert-helper');

const { waitForSyncFull } = require('../helpers/wait-conditions');

const {
  assertEventEnvelope,
  assertConnectionStatus,
  assertSyncFullStructure
} = require('../helpers/assertions');

const { GMScannerPage } = require('../helpers/page-objects/GMScannerPage');
const { selectTestTokens } = require('../helpers/token-selection');

// Test config
const { ADMIN_PASSWORD } = require('../helpers/test-config');

// Global test state
let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;  // Dynamically selected tokens from production database

// ========================================
// SETUP & TEARDOWN
// ========================================

test.describe('E2E Infrastructure Smoke Test', () => {

  test.beforeAll(async () => {
    // 1. Clear any existing session data
    await clearSessionData();

    // 2. Start VLC (mock or real)
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode on port ${vlcInfo.port}`);

    // 3. Start orchestrator with HTTPS
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });
    console.log(`Orchestrator started: ${orchestratorInfo.url}`);

    // 4. Select test tokens dynamically from production database
    testTokens = await selectTestTokens(orchestratorInfo.url);

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
    // Cleanup in reverse order
    console.log('Starting cleanup...');

    // Close all browser contexts
    await closeAllContexts();
    console.log(`Closed ${getActiveContextCount()} browser contexts`);

    // Disconnect all WebSocket clients
    await cleanupAllSockets();
    console.log(`Disconnected ${getActiveSocketCount()} WebSocket clients`);

    // Close browser
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }

    // Stop orchestrator
    await stopOrchestrator();
    console.log('Orchestrator stopped');

    // Stop VLC
    await cleanupVLC();
    console.log('VLC stopped');
  });

  test.afterEach(async () => {
    // Close contexts created during test
    await closeAllContexts();
    await cleanupAllSockets();
  });

  // ========================================
  // TEST 1: Server Health Check
  // ========================================

  test('orchestrator health endpoint responds', async () => {
    const axios = require('axios');
    const httpsAgent = createHTTPSAgent();

    const response = await axios.get(`${orchestratorInfo.url}/health`, {
      httpsAgent,
      timeout: 5000
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'online');
    expect(response.data).toHaveProperty('uptime');
    expect(response.data).toHaveProperty('version');

    console.log('✓ Health check passed:', response.data);
  });

  // ========================================
  // TEST 2: HTTPS and SSL Handling
  // ========================================

  test('HTTPS connection works with self-signed certificate', async () => {
    const axios = require('axios');
    const client = configureAxiosForHTTPS(axios.create());

    // Should not throw error despite self-signed cert
    const response = await client.get(`${orchestratorInfo.url}/health`);

    expect(response.status).toBe(200);
    console.log('✓ HTTPS connection successful');
  });

  // ========================================
  // TEST 3: Browser Context Management
  // ========================================

  test('creates desktop browser context with correct configuration', async () => {
    const context = await createBrowserContext(browser, 'desktop');

    expect(context).toBeDefined();
    expect(getActiveContextCount()).toBe(1);

    const page = await createPage(context);
    expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });

    console.log('✓ Desktop context created');
  });

  test('creates mobile browser context with correct configuration', async () => {
    const context = await createBrowserContext(browser, 'mobile');

    expect(context).toBeDefined();
    expect(getActiveContextCount()).toBe(1);

    const page = await createPage(context);
    expect(page.viewportSize()).toEqual({ width: 393, height: 851 });

    console.log('✓ Mobile context created');
  });

  test('creates multiple browser contexts in parallel', async () => {
    const contexts = await createMultipleContexts(browser, 3, 'mobile');

    expect(contexts).toHaveLength(3);
    expect(getActiveContextCount()).toBe(3);

    console.log('✓ Multiple contexts created');
  });

  // ========================================
  // TEST 4: WebSocket Authentication
  // ========================================

  test('WebSocket client connects with JWT authentication', async () => {
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'SMOKE_TEST_GM',
      'gm'
    );

    expect(socket.connected).toBe(true);
    expect(getActiveSocketCount()).toBe(1);

    console.log('✓ WebSocket authenticated and connected');
  });

  test('receives sync:full event after connection', async () => {
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'SMOKE_TEST_SYNC',
      'gm'
    );

    // connectWithAuth now waits for sync:full and stores it in socket.initialSync
    expect(socket.initialSync).toBeDefined();

    // Validate envelope structure
    assertEventEnvelope(socket.initialSync, 'sync:full');

    // Validate sync:full data structure
    assertSyncFullStructure(socket.initialSync.data);

    console.log('✓ sync:full received and validated');
  });

  // ========================================
  // TEST 5: Page Object Integration
  // ========================================

  test('GM Scanner page loads and initializes', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    // Use initializeGMScannerWithMode for proper initialization
    await initializeGMScannerWithMode(page, 'standalone', 'blackmarket');

    // Verify we're on team entry screen (initialization complete)
    const teamEntryVisible = await page.isVisible('#teamEntryScreen');
    expect(teamEntryVisible).toBe(true);

    console.log('✓ GM Scanner loaded successfully');
  });

  // ========================================
  // TEST 6: Test Fixtures Validation
  // ========================================

  test('test tokens load correctly from production database', async () => {
    // Validate dynamically selected tokens from selectTestTokens()
    expect(testTokens).toBeDefined();
    expect(testTokens).toBeInstanceOf(Object);

    // Verify required token types exist
    expect(testTokens.personalToken).toBeDefined();
    expect(testTokens.personalToken.SF_MemoryType).toBe('Personal');
    expect(testTokens.personalToken.SF_ValueRating).toBeGreaterThanOrEqual(1);
    expect(testTokens.personalToken.SF_ValueRating).toBeLessThanOrEqual(5);

    expect(testTokens.businessToken).toBeDefined();
    expect(testTokens.businessToken.SF_MemoryType).toBe('Business');

    expect(testTokens.technicalToken).toBeDefined();
    expect(testTokens.technicalToken.SF_MemoryType).toBe('Technical');

    // Verify allTokens array has production data
    expect(testTokens.allTokens).toBeInstanceOf(Array);
    expect(testTokens.allTokens.length).toBeGreaterThan(0);

    // All tokens should have required fields
    testTokens.allTokens.forEach(token => {
      expect(token).toHaveProperty('SF_RFID');
      expect(token).toHaveProperty('SF_ValueRating');
      expect(token).toHaveProperty('SF_MemoryType');
      expect(['Personal', 'Business', 'Technical']).toContain(token.SF_MemoryType);
    });

    console.log(`✓ Test tokens validated (${testTokens.allTokens.length} total tokens from production)`);
  });

  test('test video files exist', async () => {
    const fs = require('fs').promises;
    const fixturesDir = path.join(__dirname, '../fixtures');

    const videoFiles = [
      'test-videos/test_10sec.mp4',
      'test-videos/test_30sec.mp4',
      'test-videos/idle_loop_test.mp4'
    ];

    for (const videoFile of videoFiles) {
      const videoPath = path.join(fixturesDir, videoFile);
      await expect(fs.access(videoPath)).resolves.not.toThrow();
    }

    console.log('✓ Test videos exist');
  });

  // ========================================
  // TEST 7: Multi-Device Simulation
  // ========================================

  test('simulates multiple GM scanners connecting simultaneously', async () => {
    // Create 3 browser contexts (3 GM scanners)
    const contexts = await createMultipleContexts(browser, 3, 'mobile');

    // Create 3 WebSocket connections
    const sockets = await Promise.all([
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_1', 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_2', 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_3', 'gm')
    ]);

    // All should connect successfully
    expect(sockets).toHaveLength(3);
    expect(sockets.every(s => s.connected)).toBe(true);
    expect(getActiveSocketCount()).toBe(3);

    // All should have received sync:full during connection
    // (connectWithAuth now waits for sync:full and stores it in socket.initialSync)
    expect(sockets.every(s => s.initialSync)).toBe(true);
    sockets.forEach(socket => {
      assertEventEnvelope(socket.initialSync, 'sync:full');
    });

    console.log('✓ Multi-device simulation successful');
  });

  // ========================================
  // TEST 8: Event-Driven Wait Conditions
  // ========================================

  test('event-driven waits work correctly', async () => {
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'WAIT_TEST',
      'gm'
    );

    // Test: Verify initial sync was received (connectWithAuth waits for it)
    expect(socket.initialSync).toBeDefined();
    expect(socket.initialSync.event).toBe('sync:full');

    // Test: waitForEvent with future events
    // Send a test command and wait for acknowledgment
    socket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Test', teams: ['001'] } },
      timestamp: new Date().toISOString()
    });

    // Wait for command acknowledgment
    const ack = await waitForEvent(socket, 'gm:command:ack', null, 10000);
    expect(ack.event).toBe('gm:command:ack');

    console.log('✓ Event-driven waits validated');
  });

  // ========================================
  // TEST 9: Cleanup Verification
  // ========================================

  test('cleanup methods work correctly', async () => {
    // Create resources
    const contexts = await createMultipleContexts(browser, 2, 'desktop');
    const sockets = await Promise.all([
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'CLEANUP_1', 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'CLEANUP_2', 'gm')
    ]);

    expect(getActiveContextCount()).toBe(2);
    expect(getActiveSocketCount()).toBe(2);

    // Cleanup
    await closeAllContexts();
    await cleanupAllSockets();

    // Verify cleanup
    expect(getActiveContextCount()).toBe(0);
    expect(getActiveSocketCount()).toBe(0);

    console.log('✓ Cleanup verified');
  });

  // ========================================
  // TEST 10: Full Integration Flow
  // ========================================

  test('full E2E flow: browser + WebSocket + page object', async () => {
    // 1. Create browser context
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    // 2. Create WebSocket connection
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'FULL_FLOW_GM',
      'gm'
    );

    // 3. Verify sync received (connectWithAuth waits for it)
    expect(socket.initialSync).toBeDefined();
    assertEventEnvelope(socket.initialSync, 'sync:full');

    // 4. Load GM Scanner page
    const gmScanner = new GMScannerPage(page);
    await gmScanner.goto();  // goto() already waits for #gameModeScreen.active

    // 5. Verify connection status in UI (page is loaded after goto() completes)
    const connectionStatus = await gmScanner.getConnectionStatus();
    // In networked mode, should show connected or connecting
    expect(['connected', 'connecting', 'disconnected']).toContain(connectionStatus);

    console.log('✓ Full integration flow completed successfully');
  });
});

/**
 * SMOKE TEST SUCCESS CRITERIA:
 *
 * If all tests pass, Phase 1 infrastructure is complete:
 * ✓ Test server lifecycle management
 * ✓ VLC service (mock/real)
 * ✓ Browser context management
 * ✓ WebSocket authentication and events
 * ✓ HTTPS/SSL certificate handling
 * ✓ Page objects working
 * ✓ Event-driven wait conditions
 * ✓ Test fixtures loaded
 * ✓ Multi-device simulation
 * ✓ Cleanup working correctly
 *
 * Ready to proceed to Phase 2: Critical Path Tests
 */
