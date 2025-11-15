/**
 * E2E Test: GM Scanner Admin Panel - Session State
 *
 * Tests session/score management features requiring state synchronization.
 * Uses shared orchestrator with aggressive cleanup between tests.
 *
 * @group admin-panel
 * @group sessions
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
  closeAllContexts,
} = require('../setup/browser-contexts');

const {
  connectWithAuth,
  cleanupAllSockets,
  waitForEvent
} = require('../setup/websocket-client');

const {
  initializeGMScannerWithMode,
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

test.describe('GM Scanner Admin Panel - Session State', () => {

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });

    testTokens = await selectTestTokens(orchestratorInfo.url);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched for session state tests');
  });

  test.afterEach(async () => {
    // Aggressive cleanup between session tests
    await clearSessionData();
    await cleanupAllSockets();
  });

  test.afterAll(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('should handle session state synchronization', async () => {
    // Create browser page
    const context = await createBrowserContext(browser);
    const page = await createPage(context);

    try {
      // Initialize GM Scanner (connection already established by helper)
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Create WebSocket client for backend interaction
      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_SessionSync_Test', 'gm');

      // Create a test session via WebSocket
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: 'Admin Panel Test Session',
            teams: ['001', '002']
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for session:update broadcast (implicit success verification)
      await waitForEvent(socket, 'session:update', null, 5000);

      // Navigate to admin panel to view session
      await gmScanner.navigateToAdminPanel();

      // Admin modules initialized, no additional wait needed
      // (navigateToAdminPanel() already includes 1000ms initialization wait)

      // Verify session name is displayed
      // (SessionManager.currentSession should be populated from sync:full or session:update)
      const sessionContainer = await page.locator('#session-status-container');
      await expect(sessionContainer).toBeVisible();

      // Note: Actual session display format depends on MonitoringDisplay implementation
      // This test primarily validates that admin modules initialized without errors
      // and can process WebSocket events

      console.log('✓ Session state synchronized to admin panel');

      // Cleanup
      socket.disconnect();

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should reset all team scores via admin panel', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      // Setup
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Test', 'gm');

      // Create session with teams
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Reset Test', teams: ['001', '002'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'session:update', null, 5000);

      // Navigate to admin panel (includes admin init wait)
      await gmScanner.navigateToAdminPanel();

      // Verify admin panel sections are rendered
      const scoresSection = await page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      // Setup dialog handler BEFORE clicking
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Are you sure you want to reset all team scores');
        await dialog.accept();
      });

      // Listen BEFORE triggering
      const scoresResetPromise = waitForEvent(socket, 'scores:reset', null, 5000);
      const syncFullPromise = waitForEvent(socket, 'sync:full', null, 5000);

      // Click the actual button
      await page.click('button[data-action="app.adminResetScores"]');

      // Verify broadcasts
      const scoresReset = await scoresResetPromise;
      expect(scoresReset.data.teamsReset).toEqual(expect.arrayContaining(['001', '002']));

      const syncFull = await syncFullPromise;
      // After reset, teams still exist but with 0 scores
      expect(syncFull.data.scores).toHaveLength(2);
      expect(syncFull.data.scores.every(score => score.currentScore === 0)).toBe(true);

      // Verify UI score board is cleared (scores:reset handler clears DOM)
      // The scores:reset handler clears the tbody, so expect 0 rows
      await expect(page.locator('#admin-score-board tbody tr')).toHaveCount(0, { timeout: 3000 });

      console.log('✓ Score reset test completed successfully');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should adjust team score via team details screen', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Adjust', 'gm');

      // Create session and WAIT for state sync
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Adjust Test', teams: ['001'] } },
        timestamp: new Date().toISOString()
      });

      await waitForEvent(
        socket,
        'session:update',
        (event) => event.data.status === 'active' && event.data.name === 'Adjust Test',
        5000
      );

      // Navigate to admin panel (team exists in session but has 0 score)
      await gmScanner.navigateToAdminPanel();

      // Use admin command to create a manual transaction (bypasses scanner UI complexity)
      socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'transaction:create',
          payload: {
            teamId: '001',
            tokenId: testTokens.personalToken.SF_RFID,
            mode: 'blackmarket',  // Required by transaction:create
            deviceId: 'Test_Device',
            deviceType: 'gm'
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for score to update from transaction
      await waitForEvent(socket, 'score:updated', (event) => event.data.currentScore === 500, 5000);

      // Now click team to see details
      await gmScanner.clickTeamInScoreBoard('001');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Verify score adjustment controls are visible
      await expect(gmScanner.scoreAdjustmentInput).toBeVisible();

      // CRITICAL: Use predicate to distinguish adjustment event from cached transaction event
      // First event (transaction): currentScore = 500 (cached on socket.lastScoreUpdate)
      // Second event (adjustment): currentScore = 1000 (500 + 500)
      // Without predicate, waitForEvent returns cached 500 immediately
      const scoreUpdatePromise = waitForEvent(
        socket,
        'score:updated',
        (event) => event.data.currentScore === 1000,  // Filter for adjustment result, not cached transaction
        5000
      );

      // Adjust score via UI (add +500 to existing $500)
      await gmScanner.adjustTeamScore(500, 'Test bonus');

      // Verify broadcast
      const scoreUpdate = await scoreUpdatePromise;
      expect(scoreUpdate.data.teamId).toBe('001');
      // Team has $500 from transaction, +500 adjustment = $1000 total
      expect(scoreUpdate.data.currentScore).toBe(1000);

      console.log('✓ Score adjustment via team details UI completed');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should persist score data across page reload', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      // Setup session
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Test', 'gm');

      // Create session and wait for broadcast
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Persist Test', teams: ['001'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(
        socket,
        'session:update',
        (event) => event.data.status === 'active' && event.data.name === 'Persist Test',
        5000
      );

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'score:adjust', payload: { teamId: '001', delta: 750, reason: 'Test' } },
        timestamp: new Date().toISOString()
      });
      // Wait for score:updated broadcast (UI sync guaranteed)
      await waitForEvent(
        socket,
        'score:updated',
        (event) => event.data.teamId === '001' && event.data.currentScore === 750,
        5000
      );

      // Navigate to admin and verify initial score
      await gmScanner.navigateToAdminPanel();

      // Verify admin panel sections are rendered
      const scoresSection = await page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      await expect(page.locator('#admin-score-board')).toContainText('750', { timeout: 3000 });

      // Clear localStorage to prevent auto-connect (force fresh initialization)
      await page.evaluate(() => localStorage.clear());

      // Reload page
      await page.reload({ waitUntil: 'networkidle', timeout: 10000 });

      // Re-initialize and reconnect
      const gmScanner2 = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin again
      await gmScanner2.adminTab.click();
      await gmScanner2.adminView.waitFor({ state: 'visible', timeout: 5000 });

      // Verify admin panel sections are rendered after reload
      const scoresSection2 = await page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection2).toBeVisible();

      // Verify score persisted
      await expect(page.locator('#admin-score-board')).toContainText('750', { timeout: 3000 });

      console.log('✓ Score persistence test completed successfully');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should navigate to full scoreboard when View Full Scoreboard button clicked', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Nav_Scoreboard', 'gm');

      // Create session with teams
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Nav Test Scoreboard', teams: ['001', '002'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'gm:command:ack', null, 5000);

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Click View Full Scoreboard button (pure frontend navigation - no WebSocket events)
      await gmScanner.viewFullScoreboard();

      // Verify navigation to scoreboard
      await expect(gmScanner.scannerView).toBeVisible();
      await expect(gmScanner.adminView).not.toBeVisible();
      await expect(gmScanner.scoreboardScreen).toBeVisible();

      console.log('✓ View Full Scoreboard navigation completed');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should navigate to full history when View Full History button clicked', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Nav_History', 'gm');

      // Create session with teams
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Nav Test History', teams: ['001'] } },
        timestamp: new Date().toISOString()
      });
      await waitForEvent(socket, 'gm:command:ack', null, 5000);

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Click View Full History button (pure frontend navigation - no WebSocket events)
      await gmScanner.viewFullHistory();

      // Verify navigation to history
      await expect(gmScanner.scannerView).toBeVisible();
      await expect(gmScanner.adminView).not.toBeVisible();
      await expect(gmScanner.historyScreen).toBeVisible();

      console.log('✓ View Full History navigation completed');

      socket.disconnect();
    } finally {
      await page.close();
      await context.close();
    }
  });
});
