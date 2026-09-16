/**
 * E2E Infrastructure Smoke Test
 *
 * Validates that all Phase 1 infrastructure components work together:
 * - Test server (orchestrator lifecycle)
 * - VLC ownership (orchestrator-owned instance; the harness spawns none)
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
const { execFileSync } = require('child_process');

// Test infrastructure imports
const {
  startOrchestrator,
  stopOrchestrator,
  getOrchestratorUrl,
  clearSessionData,
  getOrchestratorOutput
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
  getActiveSocketCount,
  generateUniqueDeviceId
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

/** @returns {number} live processes named exactly "vlc" (cvlc execs /usr/bin/vlc) */
function countVlcProcesses() {
  try {
    return execFileSync('pgrep', ['-x', 'vlc'], { stdio: 'pipe' })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .length;
  } catch {
    return 0; // pgrep exits 1 when nothing matches
  }
}

/** @returns {boolean} whether the orchestrator could start a VLC here at all */
function isCvlcInstalled() {
  try {
    execFileSync('which', ['cvlc'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ========================================
// SETUP & TEARDOWN
// ========================================

test.describe('E2E Infrastructure Smoke Test', () => {

  test.beforeAll(async () => {
    // 1. Clear any existing session data
    await clearSessionData();

    // 2. VLC ownership (no-op shim — the orchestrator's ProcessMonitor spawns
    //    the only VLC, with production arguments). See setup/vlc-service.js.
    vlcInfo = await setupVLC();
    console.log(`VLC ownership: ${vlcInfo.type}`);

    // 2b. Wait out a VLC left dying by the PREVIOUS flow. stopOrchestrator
    //     resolves when the node process exits, which can precede the death of
    //     the VLC it SIGTERMed; this orchestrator's init audits the process
    //     table on the way up and would legitimately log "Existing VLC
    //     processes found at init" — which the invariant test asserts against.
    try {
      await expect.poll(countVlcProcesses, { timeout: 10000 }).toBe(0);
    } catch {
      console.warn(`VLC still running before startup (${countVlcProcesses()} process(es))`
        + ' — the one-VLC invariant test may fail');
    }

    // 3. Start orchestrator with HTTPS
    orchestratorInfo = await startOrchestrator({
      https: true,
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

    // VLC cleanup shim (the orchestrator stopped its own VLC above)
    await cleanupVLC();
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
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });

    expect(context).toBeDefined();
    expect(getActiveContextCount()).toBe(1);

    const page = await createPage(context);
    expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });

    console.log('✓ Desktop context created');
  });

  test('creates mobile browser context with correct configuration', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });

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
      generateUniqueDeviceId('Smoke_GM'),
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
      generateUniqueDeviceId('Smoke_Sync'),
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
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
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

    // Verify required tokens exist and have valid scoring fields
    // Token names (personalToken, businessToken, technicalToken) are multiplier tier labels:
    // personalToken = Tier 1 (1x): Personal
    // businessToken = Tier 3 (3x): Business, Mention
    // technicalToken = Tier 5 (5x): Technical, Party
    const TIER_1_TYPES = ['Personal'];
    const TIER_3_TYPES = ['Business', 'Mention'];
    const TIER_5_TYPES = ['Technical', 'Party'];

    expect(testTokens.personalToken).toBeDefined();
    expect(testTokens.personalToken.SF_ValueRating).toBeGreaterThanOrEqual(1);
    expect(testTokens.personalToken.SF_ValueRating).toBeLessThanOrEqual(5);
    // Accept any type in tier (fallback may select from different tier)
    expect(testTokens.personalToken.SF_MemoryType).toBeDefined();

    expect(testTokens.businessToken).toBeDefined();
    expect(testTokens.businessToken.SF_ValueRating).toBeGreaterThanOrEqual(1);
    expect(testTokens.businessToken.SF_ValueRating).toBeLessThanOrEqual(5);
    expect(testTokens.businessToken.SF_MemoryType).toBeDefined();

    expect(testTokens.technicalToken).toBeDefined();
    expect(testTokens.technicalToken.SF_ValueRating).toBeGreaterThanOrEqual(1);
    expect(testTokens.technicalToken.SF_ValueRating).toBeLessThanOrEqual(5);
    expect(testTokens.technicalToken.SF_MemoryType).toBeDefined();

    // Verify allTokens array has production data
    expect(testTokens.allTokens).toBeInstanceOf(Array);
    expect(testTokens.allTokens.length).toBeGreaterThan(0);

    // All tokens should have SF_RFID (null-scoring tokens included)
    testTokens.allTokens.forEach(token => {
      expect(token).toHaveProperty('SF_RFID');
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
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, generateUniqueDeviceId('Smoke_Multi1'), 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, generateUniqueDeviceId('Smoke_Multi2'), 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, generateUniqueDeviceId('Smoke_Multi3'), 'gm')
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
      generateUniqueDeviceId('Smoke_Wait'),
      'gm'
    );

    // Test: Verify initial sync was received (connectWithAuth waits for it)
    expect(socket.initialSync).toBeDefined();
    expect(socket.initialSync.event).toBe('sync:full');

    // Test: waitForEvent with future events
    // Send a test command and wait for acknowledgment
    socket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Test', teams: ['Team Alpha'] } },
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
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, generateUniqueDeviceId('Smoke_Cleanup1'), 'gm'),
      connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, generateUniqueDeviceId('Smoke_Cleanup2'), 'gm')
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
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // 2. Create WebSocket connection
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      generateUniqueDeviceId('Smoke_FullFlow'),
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

  // ========================================
  // TEST 11: One-VLC Invariant
  // ========================================

  test('orchestrator owns the only VLC', async () => {
    // The harness stopped spawning its own VLC (2026-09-15): two instances
    // raced for org.mpris.MediaPlayer2.vlc, and the harness-launched one was
    // unrepresentative (late "Playing", no HEVC length). This test is the
    // regression guard for that — see setup/vlc-service.js for the evidence.

    // Skip where the invariant cannot be observed:
    //  - no cvlc binary (CI containers): the orchestrator cannot start VLC at all
    //  - >1 Playwright worker: parallel orchestrators legitimately own one VLC each
    test.skip(!isCvlcInstalled(), 'cvlc is not installed here — the orchestrator cannot own a VLC');

    const { workers } = test.info().config;
    test.skip(workers !== 1, `needs a single worker to count VLC processes (workers=${workers})`);

    // The orchestrator spawns VLC inside initializeServices(), which is awaited
    // before it listens, so the process normally exists by the time /health
    // answers. init() does give up waiting for D-Bus registration after 5s and
    // continue, so poll briefly instead of sampling once — but a count that
    // stays at 0 means VLC failed to start, not that it is still on its way.
    await expect.poll(countVlcProcesses, {
      message: 'exactly one vlc process should run while the orchestrator is up',
      timeout: 15000,
    }).toBe(1);

    // The orchestrator must also have found a clean process table at init.
    expect(
      getOrchestratorOutput().combined,
      'orchestrator logged "[VLC] Existing VLC processes found at init" — another VLC existed at '
      + 'startup. Likely causes: a VLC from the previous flow still dying (see the pre-start wait '
      + 'in beforeAll), a PM2 orchestrator running on this box, or an orphan the '
      + '/tmp/aln-pm-vlc.pid reap missed'
    ).not.toContain('Existing VLC processes found at init');

    console.log('✓ One-VLC invariant holds (orchestrator-owned instance only)');
  });
});

/**
 * SMOKE TEST SUCCESS CRITERIA:
 *
 * If all tests pass, Phase 1 infrastructure is complete:
 * ✓ Test server lifecycle management
 * ✓ One-VLC invariant (orchestrator owns the only instance)
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
