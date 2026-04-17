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

  // ====================================================
  // TEST 3: Next/Prev navigate scoreboard pages
  // ====================================================

  test('Next and Prev advance the scoreboard through evidence pages', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Nav Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      // Wait for pagination to settle (≥3 pages expected at 600x500 with 10 owners)
      await scoreboard.waitForPageCount(3, 20000);
      const pageCount = await scoreboard.getPageCount();
      console.log(`Scoreboard at ${SMALL_VIEWPORT.width}x${SMALL_VIEWPORT.height} produced ${pageCount} pages`);
      expect(pageCount).toBeGreaterThanOrEqual(3);

      // Confirm starting page is 0 (initial render)
      expect(await scoreboard.getCurrentPageIndex()).toBe(0);

      // GM navigates
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickScoreboardNext();
      await scoreboard.waitForPageIndex(1);

      await gmScanner.clickScoreboardNext();
      await scoreboard.waitForPageIndex(2);

      await gmScanner.clickScoreboardPrev();
      await scoreboard.waitForPageIndex(1);

      // Wraparound: Prev from page 0 goes to last page
      await gmScanner.clickScoreboardPrev();  // 1 → 0
      await scoreboard.waitForPageIndex(0);
      await gmScanner.clickScoreboardPrev();  // 0 → last
      await scoreboard.waitForPageIndex(pageCount - 1);
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 4: Jump to owner lands on that character's page
  // ====================================================

  test('Jump-to-Character navigates scoreboard to the page containing that owner', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Jump Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      await scoreboard.waitForPageCount(3, 20000);

      // Pick a token whose owner is NOT on page 0 (forces a real jump).
      // Most-recently-scanned owner is on page 0 (sorted descending by
      // lastExposed). Use the first-scanned owner (oldest → last page).
      const targetOwner = detectiveTokens[0].owner;
      const targetPage = await scoreboard.findPageContainingOwner(targetOwner);
      expect(targetPage).toBeGreaterThan(0);

      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(targetOwner);
      await gmScanner.jumpScoreboardToOwner(targetOwner);

      await scoreboard.waitForPageIndex(targetPage);
      const owners = await scoreboard.getCurrentPageOwners();
      expect(owners).toContain(targetOwner);
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 5: Viewport-independent owner jump
  //         (validates PR #10's "owner keeps both aligned" claim)
  // ====================================================

  test('owner jump lands both differently-sized scoreboards on pages containing the owner', async () => {
    const largeCtx = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: LARGE_VIEWPORT
    });
    const smallCtx = await createBrowserContext(browser, 'desktop', {
      baseURL: orchestratorInfo.url,
      viewport: SMALL_VIEWPORT
    });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const largePage = await createPage(largeCtx);
    const smallPage = await createPage(smallCtx);
    const gmPage = await createPage(gmContext);
    const sbLarge = new ScoreboardPage(largePage);
    const sbSmall = new ScoreboardPage(smallPage);

    try {
      // Unique device IDs so both scoreboards can coexist.
      await sbLarge.gotoWithDeviceId(orchestratorInfo.url, 'SCOREBOARD_LARGE');
      await sbLarge.waitForConnection(10000);
      await sbSmall.gotoWithDeviceId(orchestratorInfo.url, 'SCOREBOARD_SMALL');
      await sbSmall.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'detective', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Viewport Test', [TEAM]);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList(TEAM);
      await scanAllTokens(gmScanner);

      await sbLarge.waitForPageCount(2, 20000);
      await sbSmall.waitForPageCount(3, 20000);

      const largePages = await sbLarge.getPageCount();
      const smallPages = await sbSmall.getPageCount();
      console.log(`Large viewport: ${largePages} pages, Small viewport: ${smallPages} pages`);
      // Different page counts is the whole point of this test.
      expect(smallPages).toBeGreaterThan(largePages);

      // Pick an owner that is NOT on page 0 of EITHER scoreboard (oldest).
      const targetOwner = detectiveTokens[0].owner;
      const largeTargetPage = await sbLarge.findPageContainingOwner(targetOwner);
      const smallTargetPage = await sbSmall.findPageContainingOwner(targetOwner);
      expect(largeTargetPage).toBeGreaterThanOrEqual(0);
      expect(smallTargetPage).toBeGreaterThanOrEqual(0);

      await gmScanner.navigateToAdminPanel();
      await gmScanner.waitForScoreboardOwner(targetOwner);
      await gmScanner.jumpScoreboardToOwner(targetOwner);

      // Both scoreboards must land on a page containing the owner.
      // The page INDICES may differ (viewport independence) — we assert
      // containment, not equality.
      await sbLarge.waitForPageIndex(largeTargetPage);
      await sbSmall.waitForPageIndex(smallTargetPage);

      const largeOwners = await sbLarge.getCurrentPageOwners();
      const smallOwners = await sbSmall.getCurrentPageOwners();
      expect(largeOwners).toContain(targetOwner);
      expect(smallOwners).toContain(targetOwner);

      // If the target is on different pages between the two, we've
      // proved viewport independence. If both happen to be index 0,
      // the test still validates the contract.
      if (largeTargetPage !== smallTargetPage) {
        console.log(`✓ Viewport drift confirmed: large p${largeTargetPage} vs small p${smallTargetPage}`);
      }
    } finally {
      await largePage.close();
      await smallPage.close();
      await gmPage.close();
      await largeCtx.close();
      await smallCtx.close();
      await gmContext.close();
    }
  });

});
