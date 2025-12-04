/**
 * E2E Test: GM Scanner Admin Panel - Lifecycle
 *
 * Tests orchestrator lifecycle and session transition scenarios.
 * Uses per-test orchestrator to control start/stop sequences.
 *
 * @group admin-panel
 * @group lifecycle
 */

const { test, expect, chromium } = require('@playwright/test');

const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

const {
  createBrowserContext,
  createPage,
} = require('../setup/browser-contexts');

const {
  connectWithAuth,
  waitForEvent
} = require('../setup/websocket-client');

const {
  waitForMultipleEvents,
} = require('../../helpers/websocket-helpers');

const {
  initializeGMScannerWithMode,
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');

let browser = null;
let vlcInfo = null;

test.describe('GM Scanner Admin Panel - Lifecycle', () => {

  test.beforeAll(async () => {
    // One-time browser and VLC setup
    vlcInfo = await setupVLC();

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched for lifecycle tests');
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
    await cleanupVLC();
  });

  // PER-TEST ORCHESTRATOR SETUP
  let orchestratorInfo = null;
  let testTokens = null;

  test.beforeEach(async () => {
    await clearSessionData();

    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });

    testTokens = await selectTestTokens(orchestratorInfo.url);
    console.log('✓ Fresh orchestrator started for test');
  });

  test.afterEach(async () => {
    await stopOrchestrator();
    await clearSessionData();
    console.log('✓ Orchestrator stopped and cleaned');
  });

  test('should handle admin module cleanup on disconnect', async () => {
    // Create browser page
    const context = await createBrowserContext(browser);
    const page = await createPage(context);

    try {
      // Initialize GM Scanner (connection already established by helper)
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel (ensures admin modules initialized)
      await gmScanner.navigateToAdminPanel();

      // Simulate server disconnect by stopping orchestrator
      // This triggers real disconnect through proper event chain:
      // Socket.io disconnect → OrchestratorClient → ConnectionManager → UI update
      console.log('Simulating server disconnect by stopping orchestrator...');
      await stopOrchestrator();

      // Wait for disconnect to be detected and UI updated
      // Socket.io disconnect detection via ping timeout: pingInterval(25s) + pingTimeout(60s) = max 85s
      // This is NOT arbitrary timing - based on Socket.io configuration in backend/src/config/index.js
      // When server dies abruptly (SIGTERM without graceful close), Socket.io client must detect via ping timeout
      await page.waitForFunction(() => {
        const status = document.querySelector('.connection-status');
        return status && status.classList.contains('disconnected');
      }, { timeout: 90000 }); // 90s = 85s max detection + 5s buffer

      // Verify admin view still exists (no crashes from disconnect)
      expect(await gmScanner.adminView.count()).toBe(1);

      console.log('✓ Admin modules handle WebSocket disconnect gracefully');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should clear transaction history when session ends and new session starts', async () => {
    // REGRESSION TEST: Validates that transaction history is cleared when a session ends
    // Bug Context (Nov 2025):
    // - After ES6 migration, DataManager never receives reset notification on session end
    // - MonitoringDisplay receives session:update event but doesn't call DataManager.resetForNewSession()
    // - Transactions persist across session boundaries, causing stale data in history screens

    const context = await createBrowserContext(browser);
    const page = await createPage(context);

    try {
      // Connect WebSocket client
      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_SessionClear', 'gm');

      // Initialize scanner
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // CRITICAL: Navigate to admin panel BEFORE creating session
      // This ensures MonitoringDisplay is initialized and listening for session:update events
      // In real usage, users must be in admin panel to create sessions
      await gmScanner.navigateToAdminPanel();

      // Create first session (MonitoringDisplay now exists and will receive session:update)
      // HANDLES BOTH: 1 event (clean state) OR 2 events (existing session → ended then active)
      const sessionEventsPromise = waitForMultipleEvents(
        socket,
        'session:update',
        (events) => events.find(e => e.data.status === 'active'),  // Resolve when we get 'active' status
        10000
      );

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Session 1', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });

      // Wait for BOTH command ack AND session:update event(s)
      await Promise.all([
        waitForEvent(socket, 'gm:command:ack', null, 5000),
        sessionEventsPromise
      ]);

      console.log('Session 1 created and processed');

      // Switch back to scanner view to perform scan
      await gmScanner.scannerTab.click();
      await gmScanner.scannerView.waitFor({ state: 'visible', timeout: 5000 });

      // Perform scan to generate transaction
      await gmScanner.enterTeamName('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });

      const transactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      const txEvent = await transactionPromise;
      expect(txEvent.data.transaction.status).toBe('accepted');

      console.log('Transaction created in Session 1');

      // Navigate to admin panel and initialize modules
      await gmScanner.navigateToAdminPanel();

      // Navigate to history to verify transaction exists
      await gmScanner.viewFullHistory();
      await gmScanner.historyScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Verify history has transactions (behavior: scanning worked, not testing exact count)
      const countBeforeClear = await page.locator('#historyContainer .transaction-card').count();
      expect(countBeforeClear).toBeGreaterThan(0);

      console.log(`Transaction(s) visible in history screen (${countBeforeClear} total)`);

      // Return to admin panel to end session
      await gmScanner.adminTab.click();
      await gmScanner.adminView.waitFor({ state: 'visible', timeout: 5000 });

      // End session from admin panel
      const sessionEndPromise = waitForEvent(socket, 'session:update', (event) => event.data.status === 'ended', 10000);

      // Setup dialog handler BEFORE clicking (adminEndSession shows confirmation)
      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('Are you sure you want to end the session');
        await dialog.accept();
      });

      // Click End Session button
      await page.click('button[data-action="app.adminEndSession"]');

      // Verify session ended
      const sessionEndEvent = await sessionEndPromise;
      expect(sessionEndEvent.data.status).toBe('ended');

      console.log('Session 1 ended via admin panel');

      // Create Session 2 (no existing session since we just ended Session 1)
      // Should only get 1 event (status='active'), but use waitForMultipleEvents for robustness
      const session2EventsPromise = waitForMultipleEvents(
        socket,
        'session:update',
        (events) => events.find(e => e.data.status === 'active'),
        10000
      );

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Session 2', teams: ['002'] } },
        timestamp: new Date().toISOString()
      });

      await Promise.all([
        waitForEvent(socket, 'gm:command:ack', null, 5000),
        session2EventsPromise
      ]);

      console.log('Session 2 created and processed');

      // Navigate to history screen again
      await gmScanner.viewFullHistory();
      await gmScanner.historyScreen.waitFor({ state: 'visible', timeout: 5000 });

      // CRITICAL ASSERTION: Transaction history should be empty (with built-in retry)
      await expect(page.locator('#historyContainer .transaction-card')).toHaveCount(0);

      console.log('✓ Transaction history cleared after session end and new session start');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });
});
