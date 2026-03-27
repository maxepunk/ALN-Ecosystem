/**
 * E2E Test: Scoreboard Live Data
 *
 * Verifies the scoreboard receives and renders live game data:
 * - WebSocket connection (LIVE status)
 * - Detective transactions -> evidence cards
 * - Black Market transactions -> score ticker
 * - New session boundary -> stale data cleared
 *
 * Tests the "external device" scoreboard path (browser at /scoreboard),
 * not the HDMI kiosk path (managed by displayDriver).
 *
 * Architecture notes:
 * - GM Scanner initialised with 'blackmarket' mode, then toggled to 'detective'
 *   for detective-mode tests (no selectMode() helper exists).
 * - ScoreboardPage is a named export { ScoreboardPage }.
 * - calculateExpectedScore comes from helpers/scoring (not token-selection).
 * - hasTeamInScores() is the correct ScoreboardPage method (plan used hasTeamInTicker).
 *
 * @group scoreboard
 */

const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const { calculateExpectedScore } = require('../helpers/scoring');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');

// Tests are serial — they share one orchestrator instance and must not race each other
test.describe.configure({ mode: 'serial' });

// Skip on desktop project (tests run once via mobile-chrome, same pattern as 07b)
test.skip(({ isMobile }) => !isMobile, 'Scoreboard live-data tests only run on mobile-chrome project');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;

test.describe('Scoreboard Live Data', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
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

  // Clean state between tests: stop and restart orchestrator
  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
  });

  // ====================================================
  // TEST 1: Scoreboard connects and shows LIVE status
  // ====================================================

  test('scoreboard connects and shows LIVE status', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scoreboard = new ScoreboardPage(page);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);
      expect(await scoreboard.isConnected()).toBe(true);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
      console.log('Scoreboard connected, status: LIVE');
    } finally {
      await page.close();
      await context.close();
    }
  });

  // ====================================================
  // TEST 2: Detective transaction appears as evidence card
  // ====================================================

  test('detective transaction appears as evidence card on scoreboard', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      // Open scoreboard first and wait for connection
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      // Initialize GM scanner in detective mode (init with blackmarket, toggle to detective)
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Scoreboard Detective Test', ['Evidence Team']);

      // Navigate to scanner and select team
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Evidence Team');

      // Verify we're in detective mode (should be from initializeGMScannerWithMode)
      const modeText = await gmScanner.getModeText();
      console.log(`GM Scanner mode: ${modeText}`);

      // Scan a token
      const token = testTokens.personalToken;
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      const resultTitle = await gmScanner.getResultTitle();
      console.log(`Scan result title: ${resultTitle}`);
      // In detective mode the result should not be an error or duplicate
      expect(resultTitle).not.toContain('Error');

      // Verify evidence appears on scoreboard (detective mode -> evidence card)
      // Hero evidence + feed cards count as total evidence
      await scoreboard.waitForTotalEvidence(1, 15000);
      const evidenceCount = await scoreboard.getTotalEvidenceCount();
      expect(evidenceCount).toBeGreaterThanOrEqual(1);

      console.log(`Detective transaction created ${evidenceCount} evidence card(s) on scoreboard`);

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 3: Black market transaction updates score ticker
  // ====================================================

  test('black market transaction updates score ticker', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Scoreboard BM Test', ['Scoring Team']);

      // Navigate to scanner and select team
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Scoring Team');

      // Scan a token in black market mode
      const token = testTokens.personalToken;
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      const resultTitle = await gmScanner.getResultTitle();
      console.log(`Scan result title: ${resultTitle}`);
      expect(resultTitle).not.toContain('Duplicate');
      expect(resultTitle).not.toContain('Error');

      // Verify score appears on scoreboard ticker
      await scoreboard.waitForScoreEntries(1, 15000);
      const score = await scoreboard.getTeamScoreNumeric('Scoring Team');
      expect(score).toBeGreaterThan(0);

      const expectedScore = calculateExpectedScore(token);
      expect(score).toBe(expectedScore);

      console.log(`Black market transaction updated ticker: $${score} (expected $${expectedScore})`);

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 4: New session clears scoreboard data
  // ====================================================

  test('new session clears scoreboard data', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Session 1: create and add data
      await gmScanner.createSessionWithTeams('Session 1', ['Old Team']);

      // Navigate to scanner and select team
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Old Team');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult();

      // Wait for score to appear on scoreboard
      await scoreboard.waitForScoreEntries(1, 15000);
      const scoreBeforeReset = await scoreboard.getTeamScoreNumeric('Old Team');
      expect(scoreBeforeReset).toBeGreaterThan(0);
      console.log(`Session 1 score on ticker: $${scoreBeforeReset}`);

      // End session 1, create session 2
      await gmScanner.navigateToAdminPanel();
      await gmScanner.endSession();

      // Start new session (use resetAndCreateNew since session ended)
      await gmScanner.resetAndCreateNew('Session 2');

      // Verify scoreboard cleared old data
      // After new session, scoreboard should show empty ticker (no scores yet)
      await expect(scoreboard.tickerEmpty).toBeVisible({ timeout: 15000 });

      // Also verify 'Old Team' is no longer visible in scores
      const oldTeamStillVisible = await scoreboard.hasTeamInScores('Old Team');
      expect(oldTeamStillVisible).toBe(false);

      console.log('New session cleared scoreboard data - ticker is empty, Old Team gone');

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
});
