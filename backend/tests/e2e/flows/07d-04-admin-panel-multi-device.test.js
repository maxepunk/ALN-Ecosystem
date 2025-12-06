/**
 * E2E Test: GM Scanner Admin Panel - Multi-Device
 *
 * Tests multi-device broadcast scenarios requiring pristine WebSocket room state.
 * Uses per-test orchestrator to ensure clean rooms.
 *
 * @group admin-panel
 * @group multi-device
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
  initializeGMScannerWithMode,
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');

let browser = null;
let vlcInfo = null;

test.describe('GM Scanner Admin Panel - Multi-Device', () => {

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
    console.log('Browser launched for multi-device tests');
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

  test('should auto-update history screen when new transaction added while screen visible', async () => {
    // MULTI-DEVICE SCENARIO: Two GM Scanner instances simulate realistic usage
    // Scanner 1: Monitoring history screen
    // Scanner 2: Performs scan that triggers auto-update on Scanner 1

    const context1 = await createBrowserContext(browser, 'mobile');
    const page1 = await createPage(context1);
    const context2 = await createBrowserContext(browser, 'mobile');
    const page2 = await createPage(context2);

    try {
      // Setup: Create session via WebSocket
      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_History_Monitor', 'gm');

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'History Update Test', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(
        socket,
        'session:update',
        (event) => event.data.status === 'active' && event.data.name === 'History Update Test',
        5000
      );

      // SCANNER 1: Initialize and navigate to history screen (monitoring station)
      const gmScanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // CRITICAL: Initialize admin modules by navigating to admin panel first
      // This ensures MonitoringDisplay listens for transaction:new broadcasts
      await gmScanner1.navigateToAdminPanel();

      // Navigate to history via "View Full History" button from admin panel
      await gmScanner1.viewFullHistory();

      // CRITICAL: Wait for history screen to be fully active (not just visible)
      // Auto-update logic only renders when screen has .active class
      await page1.waitForFunction(() => {
        const historyScreen = document.getElementById('historyScreen');
        return historyScreen?.classList.contains('active');
      }, { timeout: 3000 });

      // Count initial transactions (should be 0 - fresh session)
      const initialCount = await page1.locator('#historyContainer .transaction-card').count();
      console.log(`Initial transaction count: ${initialCount}`);

      // SCANNER 2: Initialize and perform scan (active scanning station)
      const gmScanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Wait for session sync to populate dropdown, then select team
      await gmScanner2.waitForTeamInDropdown('Team Alpha');
      await gmScanner2.selectTeam('Team Alpha');
      await gmScanner2.confirmTeam();

      // Wait for scan screen to be ready
      await gmScanner2.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner2.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Listen for transaction broadcast on TEST socket (to verify scan succeeded)
      const testSocketTransactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      // DEBUGGING: Listen for console logs from Scanner 1 to verify it receives the event
      page1.on('console', msg => {
        const text = msg.text();
        if (text.includes('MonitoringDisplay') || text.includes('transaction') ||
            text.includes('DataManager') || text.includes('history') || text.includes('active')) {
          console.log(`[Scanner 1 Browser Console] ${text}`);
        }
      });

      // DEBUGGING: Check if history screen has 'active' class
      const hasActiveClass = await page1.evaluate(() => {
        const historyScreen = document.getElementById('historyScreen');
        return {
          exists: !!historyScreen,
          hasActive: historyScreen?.classList.contains('active'),
          classes: historyScreen?.className
        };
      });
      console.log(`History screen status:`, hasActiveClass);

      // Perform scan on Scanner 2
      await gmScanner2.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner2.waitForResult(5000);

      // Wait for transaction broadcast on test socket
      const txEvent = await testSocketTransactionPromise;
      expect(txEvent.data.transaction.status).toBe('accepted');

      console.log(`Test socket received transaction:new: ${txEvent.data.transaction.tokenId}`);

      // VERIFICATION: Scanner 1's history screen should auto-update
      // Verify history screen still visible (didn't navigate away)
      await expect(gmScanner1.historyScreen).toBeVisible();

      // Verify transaction count increased (auto-update via transaction:new broadcast)
      await expect(page1.locator('#historyContainer .transaction-card')).toHaveCount(initialCount + 1, { timeout: 3000 });

      console.log('✓ History auto-update test completed (multi-device scenario)');

      socket.disconnect();
    } finally {
      await page1.close();
      await context1.close();
      await page2.close();
      await context2.close();
    }
  });

  test('should broadcast transaction deletion to all connected GM devices', async () => {
    // Create two browser contexts for multi-device scenario
    const context1 = await createBrowserContext(browser);
    const context2 = await createBrowserContext(browser);
    const page1 = await createPage(context1);
    const page2 = await createPage(context2);

    // Capture browser console for debugging
    page1.on('console', msg => {
      if (msg.text().includes('[main.js]') || msg.text().includes('[DataManager]') || msg.text().includes('[MonitoringDisplay]')) {
        console.log(`[BROWSER SCANNER 1] ${msg.text()}`);
      }
    });
    page2.on('console', msg => {
      if (msg.text().includes('[main.js]') || msg.text().includes('[DataManager]') || msg.text().includes('[MonitoringDisplay]')) {
        console.log(`[BROWSER SCANNER 2] ${msg.text()}`);
      }
    });

    try {
      // Connect orchestrator clients for both scanners
      const socket1 = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Monitor', 'gm');
      const socket2 = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Deleter', 'gm');

      // Create session
      socket1.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Multi-Device Delete Test', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket1, 'session:update', null, 5000);

      // Initialize both scanners
      // CRITICAL: Pass testSocket to ensure backend completes identification before proceeding
      // This guarantees scanners are in session room and will receive transaction:new broadcasts
      const gmScanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD,
        testSocket: socket1
      });

      const gmScanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD,
        testSocket: socket2
      });

      // Scanner 2: Perform scan to generate transaction
      // Wait for session sync to populate dropdown, then select team
      await gmScanner2.waitForTeamInDropdown('Team Alpha');
      await gmScanner2.selectTeam('Team Alpha');
      await gmScanner2.confirmTeam();
      await gmScanner2.scanScreen.waitFor({ state: 'visible', timeout: 5000 });

      // CRITICAL: Wait for BOTH scanners to receive transaction:new broadcast
      // This ensures Scanner 1's DataManager has the transaction before deletion
      const transaction1Promise = waitForEvent(
        socket1,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );
      const transaction2Promise = waitForEvent(
        socket2,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      await gmScanner2.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner2.waitForResult(5000);

      // Wait for both scanners to receive and process the transaction
      const [tx1Event, tx2Event] = await Promise.all([transaction1Promise, transaction2Promise]);
      const transactionId = tx2Event.data.transaction.id;

      console.log(`Transaction created on Scanner 2: ${transactionId}`);
      console.log('Both scanners received transaction:new broadcast');

      // Scanner 1: Navigate to team details to monitor
      await gmScanner1.navigateToAdminPanel();
      await gmScanner1.clickTeamInScoreBoard('Team Alpha');
      await gmScanner1.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      console.log('Scanner 1 monitoring team details...');

      // GUARD: Verify at least one transaction is visible (proves rendering works)
      await expect(page1.locator('.token-detail-card')).toHaveCount(1, { timeout: 5000 });

      // Count initial transactions
      const initialTransactionCount = await page1.locator('.token-detail-card').count();
      expect(initialTransactionCount).toBeGreaterThan(0);  // Explicit guard against rendering bugs
      console.log(`Scanner 1 sees ${initialTransactionCount} transaction(s) before deletion`);

      // Also verify the specific transaction exists
      const deleteBtn1 = page1.locator(`button[data-action="app.deleteTeamTransaction"][data-arg="${transactionId}"]`);
      await expect(deleteBtn1).toBeVisible({ timeout: 5000 });

      // Scanner 2: Navigate to team details to delete
      await gmScanner2.navigateToAdminPanel();
      await gmScanner2.clickTeamInScoreBoard('Team Alpha');
      await gmScanner2.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      console.log('Scanner 2 in team details, preparing to delete...');

      // Both scanners listen for deletion broadcast
      const delete1Promise = waitForEvent(socket1, 'transaction:deleted', null, 10000);
      const delete2Promise = waitForEvent(socket2, 'transaction:deleted', null, 10000);

      // Scanner 2: Delete transaction
      await gmScanner2.deleteTransaction(transactionId);

      // Verify both scanners received deletion broadcast
      const [delete1Event, delete2Event] = await Promise.all([delete1Promise, delete2Promise]);
      expect(delete1Event.data.transactionId).toBe(transactionId);
      expect(delete2Event.data.transactionId).toBe(transactionId);

      console.log('Both scanners received deletion broadcast');

      // Verify Scanner 1's UI auto-updated (count-based assertion more reliable than not.toBeVisible)
      // The event chain: transaction:deleted → DataManager.removeTransaction() → CustomEvent → main.js → UIManager.renderTeamDetails()
      await expect(page1.locator('.token-detail-card')).toHaveCount(initialTransactionCount - 1, { timeout: 10000 });

      // Also verify the specific delete button is gone
      await expect(deleteBtn1).not.toBeAttached({ timeout: 1000 });

      console.log('✓ Scanner 1 UI auto-updated after Scanner 2 deleted transaction (transaction count decreased)');

      socket1.disconnect();
      socket2.disconnect();
    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
