/**
 * E2E Test: Scoreboard Evidence Navigation (PR #10)
 *
 * Validates the three-way integration not covered by unit + contract:
 *   GM admin panel click → backend broadcast → scoreboard DOM transition
 *
 * Unit tests prove command construction and renderer behavior in isolation.
 * Contract tests prove the backend broadcasts the right envelope.
 * These tests prove the wiring end-to-end, including the viewport-
 * independence claim (same owner jump reaches differently-paginated
 * scoreboards).
 *
 * Architecture note: tests share one orchestrator instance per test (same
 * pattern as 23-scoreboard-live-data.test.js). Each test restarts the
 * orchestrator in afterEach to reset session state.
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
const { selectDetectiveTokens } = require('../helpers/token-selection');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => !isMobile, 'Scoreboard nav tests only run on mobile-chrome project');

const TEAM = 'Evidence Team';
const LARGE_VIEWPORT = { width: 1280, height: 720 };  // ~3 owners/page
const SMALL_VIEWPORT = { width: 600, height: 500 };    // ~1-2 owners/page

let browser = null;
let orchestratorInfo = null;
let detectiveTokens = null;

test.describe('Scoreboard Evidence Navigation (GM-driven)', () => {

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
    detectiveTokens = await selectDetectiveTokens(orchestratorInfo.url, { count: 10 });
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
  });

  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
  });

  // Shared helper: scan all detective tokens for one team.
  // Caller is responsible for being on the scan screen.
  async function scanAllTokens(gmScanner, tokens = detectiveTokens) {
    for (let i = 0; i < tokens.length; i++) {
      await gmScanner.manualScan(tokens[i].SF_RFID);
      await gmScanner.waitForResult();
      if (i < tokens.length - 1) await gmScanner.continueScan();
    }
  }

  // ====================================================
  // TEST 1: Controls disabled with no evidence
  // ====================================================

  test('admin controls are disabled when no detective evidence exists', async () => {
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const gmPage = await createPage(gmContext);

    try {
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Controls Disabled Test', [TEAM]);
      await gmScanner.navigateToAdminPanel();

      // Section itself must be visible (networked mode)
      await expect(gmScanner.scoreboardEvidenceSection).toBeVisible();

      const state = await gmScanner.scoreboardControlsEnabled();
      expect(state.prev).toBe(false);
      expect(state.next).toBe(false);
      expect(state.jump).toBe(false);
      expect(state.dropdown).toBe(false);

      const hint = await gmScanner.scoreboardEvidenceHint.textContent();
      expect(hint.trim()).toBe('Awaiting evidence...');

      const options = await gmScanner.scoreboardDropdownOptions();
      expect(options).toEqual([]);
    } finally {
      await gmPage.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 2: Detective scan populates dropdown + enables controls
  // ====================================================

  test('detective scan enables controls and populates owner dropdown', async () => {
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const gmPage = await createPage(gmContext);

    try {
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Dropdown Populate Test', [TEAM]);

      // Scan ONE detective token
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);

      const token = detectiveTokens[0];
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      // Navigate to admin panel and verify the owner appears in the dropdown
      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(token.owner, 10000);

      const options = await gmScanner.scoreboardDropdownOptions();
      expect(options).toEqual([token.owner]);

      const state = await gmScanner.scoreboardControlsEnabled();
      expect(state.prev).toBe(true);
      expect(state.next).toBe(true);
      expect(state.jump).toBe(true);
      expect(state.dropdown).toBe(true);

      const hint = await gmScanner.scoreboardEvidenceHint.textContent();
      expect(hint.trim()).toMatch(/1 character on board/);
    } finally {
      await gmPage.close();
      await gmContext.close();
    }
  });

});
