/**
 * E2E Test: GM Scanner Admin Panel - Session State
 *
 * Tests session/score management features requiring state synchronization.
 * Uses shared orchestrator with aggressive cleanup between tests.
 *
 * BROWSER-ONLY: No separate WebSocket clients - all interactions through Playwright page object.
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
  initializeGMScannerWithMode,
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');
const { GMScannerPage } = require('../helpers/page-objects/GMScannerPage');
const { calculateExpectedScore } = require('../helpers/scoring');

/**
 * Helper to add console capture to a page
 * Captures [DEBUG] logs from browser and forwards to test output
 */
function addConsoleCapture(page, testName) {
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG]') || text.includes('createAndSelectTeam') || text.includes('session:changed') || text.includes('[DataManager]') || text.includes('[MonitoringDisplay]') || text.includes('Skipping score')) {
      console.log(`[BROWSER:${testName}] ${text}`);
    }
  });
}

/**
 * The networked Reset All Scores confirm text. A networked reset also clears
 * transactions and the dedup guard (backend decision A3), so the wording must
 * promise that — asserted in every reset test below.
 */
const RESET_CONFIRM_TEXT =
  'Reset all team scores to zero? This also clears all transactions and makes every token scannable again.';

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

test.describe('GM Scanner Admin Panel - Session State', () => {
  // Skip on chromium to prevent parallel execution conflicts - session tests only on mobile-chrome
  test.skip(({ isMobile }) => !isMobile, 'Session-based tests only run on mobile-chrome (mobile-first PWA)');

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
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

  test.beforeEach(async ({ }, testInfo) => {
    // Fast-fail verification: ensure no session exists from previous test
    // This catches test isolation failures early with clear error messages
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[beforeEach] Starting test: ${testInfo.title}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const response = await fetch(`${orchestratorInfo.url}/api/state`, {
        headers: { 'Accept': 'application/json' },
        // Allow self-signed certs in test environment
        agent: new (require('https').Agent)({ rejectUnauthorized: false })
      });
      const state = await response.json();

      console.log(`[beforeEach] Backend state check:`);
      console.log(`  - Session exists: ${!!state.session}`);
      if (state.session) {
        console.log(`  - Session ID: ${state.session.id}`);
        console.log(`  - Session status: ${state.session.status}`);
        console.log(`  - Session name: ${state.session.name}`);
        console.log(`  - Teams: ${JSON.stringify(state.session.teams || [])}`);
      }
      console.log(`  - Scores count: ${state.scores?.length || 0}`);

      // Fail fast if session exists (indicates test isolation failure)
      if (state.session && state.session.status !== 'ended') {
        throw new Error(
          `TEST ISOLATION FAILURE: Session "${state.session.name}" (${state.session.id}) ` +
          `still exists in state "${state.session.status}" from previous test. ` +
          `afterEach cleanup did not work properly.`
        );
      }
      console.log(`[beforeEach] ✓ No active session - test isolation verified`);
    } catch (error) {
      if (error.message.includes('TEST ISOLATION FAILURE')) {
        throw error;
      }
      // Network errors are OK - orchestrator might be starting up
      console.log(`[beforeEach] Warning: Could not verify backend state: ${error.message}`);
    }
  });

  test.afterEach(async ({ }, testInfo) => {
    console.log(`\n[afterEach] Cleaning up after: ${testInfo.title}`);
    console.log(`[afterEach] Test status: ${testInfo.status}`);

    // Robust cleanup: close all browser contexts then restart orchestrator
    // This ensures complete session isolation between tests
    console.log(`[afterEach] Closing all browser contexts...`);
    await closeAllContexts();

    // Check current session state before restart (for debugging)
    try {
      const response = await fetch(`${orchestratorInfo.url}/api/state`, {
        headers: { 'Accept': 'application/json' },
        agent: new (require('https').Agent)({ rejectUnauthorized: false })
      });
      const state = await response.json();
      console.log(`[afterEach] Pre-restart state:`);
      console.log(`  - Session: ${state.session ? `${state.session.name} (${state.session.status})` : 'none'}`);
      console.log(`  - Scores: ${state.scores?.length || 0} teams`);
    } catch (e) {
      console.log(`[afterEach] Could not check pre-restart state: ${e.message}`);
    }

    // Restart orchestrator for clean state (required because in-memory sessions persist)
    console.log(`[afterEach] Stopping orchestrator...`);
    await stopOrchestrator();
    await clearSessionData();
    console.log(`[afterEach] Starting fresh orchestrator...`);
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000
    });
    console.log(`[afterEach] ✓ Orchestrator restarted for test isolation`);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('should handle session state synchronization', async () => {
    // Create browser page
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test1-SessionSync');

    try {
      // Initialize GM Scanner (connection already established by helper)
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel first (admin modules needed for session creation)
      await gmScanner.navigateToAdminPanel();

      // Create a test session with teams via admin panel UI
      await gmScanner.createSessionWithTeams('Admin Panel Test Session', ['Team Alpha', 'Detectives']);

      // Wait for session to be active using backend state verification
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active' && state.session?.name === 'Admin Panel Test Session',
        5000
      );

      // Verify session name is displayed in UI
      const sessionContainer = page.locator('#session-status-container');
      await expect(sessionContainer).toBeVisible();

      // Note: Actual session display format depends on MonitoringDisplay implementation
      // This test primarily validates that admin modules initialized without errors
      // and can process session state updates

      console.log('✓ Session state synchronized to admin panel');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should reset all team scores via admin panel', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test2-ResetScores');

    try {
      // Setup
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });


      // Navigate to admin panel first
      await gmScanner.navigateToAdminPanel();

      // Create session with teams via admin panel UI
      await gmScanner.createSessionWithTeams('Reset Test', ['Team Alpha', 'Detectives']);

      // Wait for session to be active
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // Scan a token for each team to populate the scoreboard
      // (Teams only appear in scoreboard after they have scores from scans)
      await gmScanner.scannerTab.click();
      // Wait for teamEntryScreen specifically (not just scannerView)
      // because #teamNameInput is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Scan for Team Alpha (selectTeamFromList auto-confirms)
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      // Use finishTeam() to return to teamEntryScreen (not continueScan which stays on scanScreen)
      await gmScanner.finishTeam();

      // Scan for Detectives (selectTeamFromList auto-confirms)
      await gmScanner.selectTeamFromList('Detectives');
      await gmScanner.manualScan(testTokens.businessToken.SF_RFID);
      // Use finishTeam() since we're done scanning for this team
      await gmScanner.finishTeam();

      // Navigate back to admin panel
      await gmScanner.navigateToAdminPanel();

      // Verify admin panel sections are rendered
      const scoresSection = page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      // Verify teams with scores appear in scoreboard
      // Note: Only teams with non-zero scores appear in scoreboard (Team Alpha, Detectives)
      // This is correct behavior - teams without scans don't clutter the scoreboard
      const scoreboardEntries = page.locator('#admin-score-board .scoreboard-entry');
      await expect(scoreboardEntries).toHaveCount(2, { timeout: 5000 });

      // Verify the two scanned teams have non-zero scores before reset
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const scores = state.scores || [];
          const teamAlpha = scores.find(s => s.teamId === 'Team Alpha');
          const detectives = scores.find(s => s.teamId === 'Detectives');
          return teamAlpha?.currentScore > 0 && detectives?.currentScore > 0;
        },
        5000
      );

      // Setup dialog handler BEFORE clicking.
      // Capture the message rather than asserting inside the handler — an
      // assertion failure in a dialog callback surfaces as an unhandled
      // rejection that can crash the Playwright worker.
      let resetDialogMessage = null;
      page.once('dialog', async dialog => {
        resetDialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click the reset button
      await page.click('button[data-action="app.adminResetScores"]');

      // Wait for backend to confirm scores are reset to zero
      // Both teams (Team Alpha, Detectives) remain in session with zero scores
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const scores = state.scores || [];
          // Both teams should have zero scores after reset
          return scores.length === 2 && scores.every(s => s.currentScore === 0);
        },
        5000
      );

      // A networked reset is NOT score-only (backend decision A3): it also
      // clears transactions and the dedup guard, so every token becomes
      // scannable again. The confirm text must say so — a GM who reads the
      // old "scores only" wording would not expect history to vanish.
      expect(resetDialogMessage).toBe(RESET_CONFIRM_TEXT);

      // After reset, both teams have zero scores so scoreboard should show 2 entries with $0
      await expect(scoreboardEntries).toHaveCount(2, { timeout: 10000 });

      console.log('✓ Score reset test completed successfully');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should adjust team score via team details screen', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test3-AdjustScore');

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel first
      await gmScanner.navigateToAdminPanel();

      // Create session with team via admin panel UI
      await gmScanner.createSessionWithTeams('Adjust Test', ['Team Alpha']);

      // Wait for session to be active
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active' && state.session?.name === 'Adjust Test',
        5000
      );

      // Return to scanner view to scan a token for Team Alpha
      await gmScanner.scannerTab.click();
      // Wait for teamEntryScreen specifically (not just scannerView)
      // because #teamNameInput is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Select Team Alpha and scan a token (selectTeamFromList auto-confirms)
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);

      // Calculate expected score using production scoring logic (DRY)
      const expectedTokenScore = calculateExpectedScore(testTokens.personalToken);
      const adjustmentAmount = 500;

      // Wait for score to update from transaction
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === expectedTokenScore;
        },
        5000
      );

      // Continue scanning, then navigate to admin panel
      await gmScanner.continueScan();
      await gmScanner.navigateToAdminPanel();

      // Now click team to see details
      await gmScanner.clickTeamInScoreBoard('Team Alpha');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Verify score adjustment controls are visible
      await expect(gmScanner.scoreAdjustmentInput).toBeVisible();

      // Adjust score via UI (add adjustment to existing score)
      await gmScanner.adjustTeamScore(adjustmentAmount, 'Test bonus');

      // Verify backend has updated score: token score + adjustment
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === expectedTokenScore + adjustmentAmount;
        },
        5000
      );

      // A-1: Team Details reads BACKEND truth. Reopen it so renderTeamDetails
      // runs against the post-adjustment score, and check the GM can actually
      // SEE that an adjustment happened — the adjustments section is the only
      // place the delta and its reason are surfaced. It stays display:none
      // until backendScore.adminAdjustments is non-empty.
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickTeamInScoreBoard('Team Alpha');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });

      await expect(gmScanner.teamAdminAdjustmentsSection).toBeVisible({ timeout: 5000 });
      await expect(gmScanner.teamAdminAdjustmentsSection).toContainText('Test bonus');

      // Total is backend currentScore, not a client recomputation
      const shownTotal = await gmScanner.getTeamDetailsScoreNumeric('total');
      expect(shownTotal).toBe(expectedTokenScore + adjustmentAmount);

      console.log('✓ Score adjustment via team details UI completed (adjustments section visible)');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should persist score data across page reload', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test4-PersistScore');

    try {
      // Setup session via browser UI
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Create session with team via admin panel UI
      await gmScanner.createSessionWithTeams('Persist Test', ['Team Alpha']);

      // Wait for session to be active
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active' && state.session?.name === 'Persist Test',
        5000
      );

      // Return to scanner to scan a token and build up score
      await gmScanner.scannerTab.click();
      // Wait for teamEntryScreen specifically (not just scannerView)
      // because #teamNameInput is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      // selectTeamFromList auto-confirms
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);

      // Calculate expected score using production scoring logic (DRY)
      const expectedTokenScore = calculateExpectedScore(testTokens.personalToken);
      const adjustmentAmount = 250;
      const expectedTotal = expectedTokenScore + adjustmentAmount;

      // Wait for score to update from transaction
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === expectedTokenScore;
        },
        5000
      );

      // Navigate back to admin and adjust score
      await gmScanner.continueScan();
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickTeamInScoreBoard('Team Alpha');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.adjustTeamScore(adjustmentAmount, 'Persistence test bonus');

      // Wait for backend to have total score (token score + adjustment)
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === expectedTotal;
        },
        5000
      );

      // Navigate to admin and verify score shows in UI
      await gmScanner.navigateToAdminPanel();
      const formattedTotal = expectedTotal.toLocaleString('en-US');
      await expect(page.locator('#admin-score-board')).toContainText(formattedTotal, { timeout: 3000 });

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
      await gmScanner2.navigateToAdminPanel();

      // Verify admin panel sections are rendered after reload
      const scoresSection = page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      // Verify score persisted (use same formatted total from before reload)
      await expect(page.locator('#admin-score-board')).toContainText(formattedTotal, { timeout: 3000 });

      console.log('✓ Score persistence test completed successfully');

    } finally {
      await page.close();
      await context.close();
    }
  });

  // NOTE: 'View Full Scoreboard' test removed - button was removed as part of
  // admin scoreboard consolidation. Admin panel now has full scoreboard inline.

  test('should navigate to full history when View Full History button clicked', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test6-ViewHistory');

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Create session with team via UI
      await gmScanner.createSessionWithTeams('Nav Test History', ['Team Alpha']);

      // Wait for session to be active
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // Click View Full History button (pure frontend navigation)
      await gmScanner.viewFullHistory();

      // Verify navigation to history
      await expect(gmScanner.scannerView).toBeVisible();
      await expect(gmScanner.adminView).not.toBeVisible();
      await expect(gmScanner.historyScreen).toBeVisible();

      console.log('✓ View Full History navigation completed');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('blocks scans while paused, allows them after resume (session-active gate)', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    addConsoleCapture(page, 'Test7-PauseGate');

    const token = testTokens.personalToken;

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();
      await gmScanner.createSessionWithTeams('Pause Gate Test', ['Team Alpha']);
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // Pause from the admin panel. pauseSession() waits for the CLIENT to render
      // .session-status--paused, i.e. dataManager.sessionState.status (the value
      // the scan gate reads in processNFCRead) is now 'paused' on this page.
      await gmScanner.pauseSession();
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'paused',
        5000
      );

      // Go to the scanner and select the team — UI navigation is allowed while
      // paused (the gate is only at scan time) — then attempt a scan. The new
      // networked session-active gate must BLOCK it (error toast, no result screen).
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.expectScanBlocked(token.SF_RFID, 'paused');

      // The blocked scan must NOT have recorded a transaction on the backend.
      const pausedState = await gmScanner.getStateFromBackend(orchestratorInfo.url);
      expect((pausedState.session?.transactions || []).length).toBe(0);

      // Resume. resumeSession() waits for the client to render active again.
      await gmScanner.navigateToAdminPanel();
      await gmScanner.resumeSession();
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // Back to the scanner: the same token (never marked, since the scan was
      // blocked) now scans successfully and scores. The scanner view returns to
      // whichever screen was last active — handle scanScreen or teamEntryScreen.
      await gmScanner.scannerTab.click();
      const onScan = await gmScanner.scanScreen.waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true).catch(() => false);
      if (!onScan) {
        await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
        await gmScanner.selectTeamFromList('Team Alpha');
      }
      await gmScanner.manualScan(token.SF_RFID);

      const resultTitle = await gmScanner.getResultTitle();
      expect(resultTitle).not.toContain('Error');
      expect(resultTitle).not.toContain('Cannot scan');

      const expectedScore = calculateExpectedScore(token);
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === expectedScore;
        },
        5000
      );

      console.log('✓ Scan blocked while paused; succeeded after resume');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('Reset All Scores makes an already-scanned token scannable again', async () => {
    // END-TO-END proof of the dedup-guard clearing chain (A-3/A-4 + W8):
    //   backend score:reset clears transactions AND the first-come guard
    //   → scores:reset broadcast + the sync:full built AFTER that clear
    //   → the scanner drops the token from its own local scanned set
    // If the sync:full were built BEFORE transactions were cleared (the
    // listener-order bug), the client would rebuild its dedup set from the
    // stale transaction list and reject the rescan with "Token Already
    // Scanned" — no backend call, nothing in the logs.
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    addConsoleCapture(page, 'Test8-ResetRescan');

    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();
      await gmScanner.createSessionWithTeams('Reset Rescan Test', ['Team Alpha']);
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // First scan — claims the token
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.scores?.find(s => s.teamId === 'Team Alpha')?.currentScore === expectedScore,
        5000
      );
      await gmScanner.finishTeam();

      // Reset all scores from the admin panel, asserting the confirm wording
      // promises exactly what the backend does.
      await gmScanner.navigateToAdminPanel();
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      await gmScanner.resetScoresBtn.click();

      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => (state.scores || []).every(s => s.currentScore === 0)
          && (state.session?.transactions || []).length === 0,
        5000
      );
      expect(dialogMessage).toBe(RESET_CONFIRM_TEXT);

      // Rescan the SAME token — must be accepted and score again.
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();

      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.scores?.find(s => s.teamId === 'Team Alpha')?.currentScore === expectedScore,
        5000
      );

      console.log('✓ Token scannable again after Reset All Scores');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('Reset All Scores still frees tokens after a system reset', async () => {
    // Same chain as above, but run on a session created by system:reset.
    // systemReset.js re-registers listeners from scratch; if it wired the
    // BROADCAST listeners before the session/score/persistence ones, the
    // sync:full following a later scores:reset would again be assembled from
    // not-yet-cleared transactions. Nothing else in the suite exercises a
    // scores:reset on a post-system-reset session.
    test.setTimeout(120000); // system reset + two sessions + several scans
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    addConsoleCapture(page, 'Test9-SysResetRescan');

    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();
      await gmScanner.createSessionWithTeams('Pre-SystemReset', ['Team Alpha']);

      // Claim the token in the FIRST session
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();
      await gmScanner.finishTeam();

      // End, then system:reset + create a fresh session (adminResetAndCreateNew)
      await gmScanner.navigateToAdminPanel();
      await gmScanner.endSession();
      await gmScanner.resetAndCreateNew('Post-SystemReset');
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active' && state.session?.name === 'Post-SystemReset',
        10000
      );

      // The new session starts with no teams — create one from the scanner.
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.enterTeam('Team Alpha');
      await gmScanner.confirmTeam();

      // The token is free again in the new session
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.scores?.find(s => s.teamId === 'Team Alpha')?.currentScore === expectedScore,
        5000
      );
      await gmScanner.finishTeam();

      // NOW the subject of the test: scores:reset on a post-system-reset session
      await gmScanner.navigateToAdminPanel();
      let sysResetDialogMessage = null;
      page.once('dialog', async (dialog) => {
        sysResetDialogMessage = dialog.message();
        await dialog.accept();
      });
      await gmScanner.resetScoresBtn.click();
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => (state.scores || []).every(s => s.currentScore === 0)
          && (state.session?.transactions || []).length === 0,
        5000
      );
      expect(sysResetDialogMessage).toBe(RESET_CONFIRM_TEXT);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();

      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.scores?.find(s => s.teamId === 'Team Alpha')?.currentScore === expectedScore,
        5000
      );

      console.log('✓ Token scannable again after Reset All Scores on a post-system-reset session');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('keeps the ended session, its history and the report button across a sync:request', async () => {
    // C-1/W8: endSession() used to null currentSession, so the NEXT sync:full
    // carried session: null with empty transactions. Re-opening the admin tab
    // calls refreshAllDisplays() → sync:request → sync:full, which wiped the
    // GM's history and replaced the ended-session panel (with its Download
    // Report button) with the empty "Create New Session" state — right at the
    // moment the GM wants the report.
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    addConsoleCapture(page, 'Test10-EndedSessionSurvives');

    const token = testTokens.personalToken;

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();
      await gmScanner.createSessionWithTeams('Ended Session Survives', ['Team Alpha']);

      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Team Alpha');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.expectScanAccepted();
      await gmScanner.finishTeam();

      await gmScanner.navigateToAdminPanel();
      await gmScanner.endSession();

      // Backend truth FIRST — establish what the ended session still holds
      // before touching the UI, so a later UI assertion cannot be satisfied by
      // a stale DOM that merely happens to agree.
      const state = await gmScanner.getStateFromBackend(orchestratorInfo.url);
      expect(state.session?.status).toBe('ended');
      expect((state.session?.transactions || []).length).toBe(1);

      // Force a FRESH sync:full: leaving and re-entering the admin view calls
      // MonitoringDisplay.refreshAllDisplays() → sync:request.
      //
      // The UI assertions below only mean something once that round-trip has
      // been APPLIED. Run too early they pass against the pre-sync DOM, which
      // still shows the correct ended panel from the session:update that ended
      // the session — i.e. they would pass even if sync:full wiped everything.
      // MonitoringDisplay.updateAllDisplays() logs on every sync:full it
      // applies; arm the wait BEFORE the tab switch so the round-trip cannot
      // complete before we are listening.
      const syncFullApplied = page.waitForEvent('console', {
        predicate: (msg) => msg.text().includes('[MonitoringDisplay] updateAllDisplays (Sync Full)'),
        timeout: 15000,
      });

      await gmScanner.scannerTab.click();
      await gmScanner.scannerView.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.navigateToAdminPanel();
      await syncFullApplied;

      // The ended-session panel and its Download Report button survive the
      // sync:full (the assertions retry, covering the render tick after the log)
      await expect(gmScanner.sessionEnded).toBeVisible({ timeout: 5000 });
      await expect(
        page.locator('button[data-action="app.downloadSessionReport"]')
      ).toBeVisible();

      // ...and so does the transaction history (claimed token cards)
      await gmScanner.viewFullHistory();
      const claimedCards = page.locator('#historyContainer .token-card.claimed');
      await expect(claimedCards).toHaveCount(1, { timeout: 5000 });

      console.log('✓ Ended session, history and Download Report survived sync:request');

    } finally {
      await page.close();
      await context.close();
    }
  });
});
