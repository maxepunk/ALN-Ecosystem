/**
 * E2E Test: Scoreboard Restart Recovery
 *
 * Verifies the scoreboard recovers after backend restart:
 * - connect_error triggers re-authentication (not 5min zombie timer)
 * - sync:full restores data after reconnection
 *
 * Uses restartOrchestrator() from test-server.js which stops/restarts
 * the backend process while preserving session data (file storage).
 *
 * Architecture notes:
 * - restartOrchestrator() captures currentPort and passes it to the new
 *   startOrchestrator() call — same port is reused, so the Playwright page
 *   at the OLD URL can reconnect automatically.
 * - storageType: 'file' is required so session data survives the restart
 *   (memory storage is wiped when the process exits).
 * - ScoreboardPage is a named export { ScoreboardPage }.
 * - GMScannerPage uses 'mobile' context for scanner, 'desktop' for scoreboard.
 *
 * @group scoreboard
 * @group resilience
 */

const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');

// Tests are serial — they share one orchestrator and must not race each other
test.describe.configure({ mode: 'serial' });

// Skip on desktop project — run once via mobile-chrome (same pattern as 07b, 23)
test.skip(({ isMobile }) => !isMobile, 'Scoreboard restart-recovery tests only run on mobile-chrome project');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;

test.describe('Scoreboard Restart Recovery', () => {

  // Use file storage so session survives restart
  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000,
      storageType: 'file'
    });
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors'
      ]
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
  });

  // Clean state between tests — stop and restart (with file storage) to isolate sessions
  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000,
      storageType: 'file'
    });
  });

  // ====================================================
  // TEST 1: Scoreboard recovers connection after restart
  // ====================================================

  test('scoreboard recovers connection after backend restart', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scoreboard = new ScoreboardPage(page);

    try {
      // Connect and verify LIVE
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
      console.log('Scoreboard connected pre-restart, status: LIVE');

      // Restart the backend (preserves session data, reuses same port)
      console.log('Restarting orchestrator...');
      orchestratorInfo = await restartOrchestrator({
        preserveSession: true,
        storageType: 'file',
        timeout: 30000
      });
      console.log(`Orchestrator restarted at ${orchestratorInfo.url}`);

      // Scoreboard should detect disconnection and re-authenticate automatically.
      // The connect_error handler in scoreboard.html detects AUTH_INVALID / AUTH_REQUIRED
      // and calls authenticate() + connectWebSocket() immediately (not the 5min zombie timer).
      // Wait for LIVE status to return — should be within ~10s, not 5 minutes.
      await scoreboard.waitForConnection(30000);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
      console.log('Scoreboard recovered LIVE status after restart');

    } finally {
      await page.close();
      await context.close();
    }
  });

  // ====================================================
  // TEST 2: Scoreboard data survives restart via sync:full
  // ====================================================

  test('scoreboard data survives backend restart via sync:full', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      // Open scoreboard and confirm connection
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      // Create session, process a black market transaction
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Restart Data Test', ['Persistent Team']);

      // Navigate to scanner tab and select team
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Persistent Team');

      // Scan a token in black market mode
      const token = testTokens.personalToken;
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      const resultTitle = await gmScanner.getResultTitle();
      console.log(`Scan result before restart: ${resultTitle}`);
      expect(resultTitle).not.toContain('Error');
      expect(resultTitle).not.toContain('Duplicate');

      // Verify score shows on scoreboard before restart
      await scoreboard.waitForScoreEntries(1, 15000);
      const preRestartScore = await scoreboard.getTeamScoreNumeric('Persistent Team');
      expect(preRestartScore).toBeGreaterThan(0);
      console.log(`Pre-restart score: $${preRestartScore}`);

      // Close GM scanner page — we only keep scoreboard open across restart
      await gmPage.close();
      await gmContext.close();

      // Restart orchestrator (file storage preserves session data)
      console.log('Restarting orchestrator to test data persistence...');
      orchestratorInfo = await restartOrchestrator({
        preserveSession: true,
        storageType: 'file',
        timeout: 30000
      });
      console.log(`Orchestrator restarted at ${orchestratorInfo.url}`);

      // Wait for scoreboard to reconnect and receive sync:full
      await scoreboard.waitForConnection(30000);

      // Verify data was restored via sync:full (includes scores for active session)
      await scoreboard.waitForScoreEntries(1, 15000);
      const postRestartScore = await scoreboard.getTeamScoreNumeric('Persistent Team');
      expect(postRestartScore).toBe(preRestartScore);
      console.log(`Post-restart score matches pre-restart: $${postRestartScore}`);

    } finally {
      await sbPage.close();
      await sbContext.close();
      // gmPage/gmContext may already be closed above — Playwright handles double-close gracefully
    }
  });
});
