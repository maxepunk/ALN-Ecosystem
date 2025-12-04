/**
 * E2E Test: GM Scanner Admin Panel - Transactions
 *
 * Tests transaction-heavy flows requiring pristine backend state.
 * Uses per-test orchestrator to ensure isolation.
 *
 * @group admin-panel
 * @group transactions
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

test.describe('GM Scanner Admin Panel - Transactions', () => {

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
    console.log('Browser launched for transaction tests');
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

  test('should show team details modal when team name clicked in admin score board', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Team_Click', 'gm');

      // Create session with teams
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Team Click Test', teams: ['Team Alpha', 'Detectives'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'gm:command:ack', null, 5000);

      // Perform scans to generate scores (so teams appear in admin score board)
      await gmScanner.enterTeamName('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Wait for score update
      await waitForEvent(socket, 'score:updated', null, 5000);

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Verify score board has at least the team we scanned
      const rowCount = await gmScanner.adminScoreBoard.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(1);

      // Click first team name (pure frontend - no WebSocket events)
      await gmScanner.clickTeamInScoreBoard('Team Alpha');

      // Verify team details screen appears (not modal - screen navigation)
      await expect(page.locator('#teamDetailsScreen')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('#teamDetailsTitle')).toContainText('001', { timeout: 3000 });

      console.log('✓ Clickable team names test completed');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should display team scores in admin panel after transaction', async () => {
    // Test verifies that score board in admin panel shows team scores after transaction
    // This catches regression where DataManager.backendScores remains empty due to missing DI

    const context = await createBrowserContext(browser);
    const page = await createPage(context);

    try {
      // Setup: Create session via WebSocket
      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Score_Test', 'gm');

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Score Display Test', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'gm:command:ack', null, 5000);

      // Initialize GM Scanner in networked mode
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Perform scan to generate score
      await gmScanner.enterTeamName('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Listen for transaction broadcast
      const transactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Wait for transaction to complete
      const txEvent = await transactionPromise;
      expect(txEvent.data.transaction.status).toBe('accepted');

      console.log(`Transaction completed: ${txEvent.data.transaction.tokenId}`);

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // CRITICAL: Verify score board shows team scores (NOT empty table)
      // This assertion catches the bug where DataManager.networkedSession is undefined
      // Note: Session may have multiple teams, so check for at least 1 row
      const rowCount = await page.locator('#admin-score-board tbody tr').count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
      await expect(page.locator('#admin-score-board')).toContainText('Team Alpha');

      // Verify score is numeric and visible
      const scoreBoardText = await page.locator('#admin-score-board').textContent();
      expect(scoreBoardText).toMatch(/\d+/); // Contains at least one digit (the score)

      console.log('✓ Admin panel score board displays team scores correctly');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should delete transaction and allow re-scanning token (networked mode)', async () => {
    const context = await createBrowserContext(browser);
    const page = await createPage(context);

    try {
      // Connect to orchestrator
      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Delete_Test', 'gm');

      // Create session
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Delete Test', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'session:update', null, 5000);

      // Initialize scanner
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Perform initial scan
      await gmScanner.enterTeamName('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Listen for transaction broadcast BEFORE scanning
      const transactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Wait for transaction event and capture transaction ID
      const txEvent = await transactionPromise;
      expect(txEvent.data.transaction.status).toBe('accepted');
      const transactionId = txEvent.data.transaction.id;

      console.log(`Initial scan complete. Transaction ID: ${transactionId}`);

      // Navigate to admin panel and then to team details
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickTeamInScoreBoard('Team Alpha');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      console.log('Team details screen visible, preparing to delete transaction...');

      // Listen for deletion broadcast BEFORE deleting
      const deletePromise = waitForEvent(socket, 'transaction:deleted', null, 10000);

      // Delete transaction
      await gmScanner.deleteTransaction(transactionId);

      // Verify deletion broadcast
      const deleteEvent = await deletePromise;
      expect(deleteEvent.data.transactionId).toBe(transactionId);
      expect(deleteEvent.data.teamId).toBe('Team Alpha');

      console.log('Transaction deleted successfully, broadcast received');

      // Verify score recalculated (should be back to 0)
      const scoreUpdateEvent = await waitForEvent(socket, 'score:updated', null, 5000);
      expect(scoreUpdateEvent.data.teamId).toBe('Team Alpha');
      expect(scoreUpdateEvent.data.currentScore).toBe(0); // Score should be 0 after deleting only transaction

      console.log('Score recalculated to 0 after deletion');

      // CRITICAL: Wait for backend persistence to complete
      // The transaction:deleted listener in stateService persists the session asynchronously
      // We need to ensure scannedTokensByDevice is persisted before re-scanning
      console.log('Waiting 1s for backend persistence to complete...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Return to scan screen to test re-scanning
      // Navigate back from team details to scoreboard
      const closeTeamDetailsBtn = page.locator('button[data-action="app.closeTeamDetails"]');
      await closeTeamDetailsBtn.click();
      await gmScanner.scoreboardScreen.waitFor({ state: 'visible', timeout: 3000 });

      // Close scoreboard to return to previous screen
      const closeScoreboardBtn = page.locator('button[data-action="app.closeScoreboard"]');
      await closeScoreboardBtn.click();

      // Should now be back on scan screen or team entry screen
      // Wait for either screen to appear
      await page.waitForFunction(() => {
        const teamEntry = document.getElementById('teamEntryScreen');
        const scanScreen = document.getElementById('scanScreen');
        return (teamEntry?.classList.contains('active') || scanScreen?.classList.contains('active'));
      }, { timeout: 3000 });

      // If on team entry, confirm team; if on scan screen, we're ready
      const isTeamEntry = await gmScanner.teamEntryScreen.isVisible();
      if (isTeamEntry) {
        await gmScanner.confirmTeam();
        await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 3000 });
      }

      // Listen for new transaction BEFORE re-scanning
      const rescanPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      // Re-scan the same token
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Verify token was accepted (NOT duplicate)
      const rescanEvent = await rescanPromise;
      expect(rescanEvent.data.transaction.status).toBe('accepted');
      expect(rescanEvent.data.transaction.tokenId).toBe(testTokens.personalToken.SF_RFID);

      console.log('✓ Token successfully re-scanned after deletion (not marked as duplicate)');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });
});
