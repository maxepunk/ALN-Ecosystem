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
      port: 3000,
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
    const context = await createBrowserContext(browser);
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
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test2-ResetScores');

    // Helper to log backend state at checkpoints
    // Uses page.request (Playwright's built-in) which handles HTTPS properly
    const logBackendState = async (checkpoint) => {
      try {
        const response = await page.request.get(`${orchestratorInfo.url}/api/state`);
        const state = await response.json();
        console.log(`\n[DEBUG:${checkpoint}] Backend State:`);
        console.log(`  Session: ${state.session ? `${state.session.name} (${state.session.status})` : 'none'}`);
        console.log(`  Session teams: ${JSON.stringify(state.session?.teams || [])}`);
        console.log(`  Scores count: ${state.scores?.length || 0}`);
        if (state.scores?.length > 0) {
          console.log(`  Scores detail:`);
          state.scores.forEach(s => {
            console.log(`    - ${s.teamId}: ${s.currentScore} (txCount: ${s.transactionCount})`);
          });
        }
      } catch (e) {
        console.log(`[DEBUG:${checkpoint}] Error fetching state: ${e.message}`);
      }
    };

    try {
      // CHECKPOINT 1: Before any setup
      await logBackendState('1-BEFORE-SETUP');

      // Setup
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // CHECKPOINT 2: After scanner init
      await logBackendState('2-AFTER-SCANNER-INIT');

      // Navigate to admin panel first
      await gmScanner.navigateToAdminPanel();

      // Create session with teams via admin panel UI
      await gmScanner.createSessionWithTeams('Reset Test', ['Team Alpha', 'Detectives']);

      // CHECKPOINT 3: After session creation
      await logBackendState('3-AFTER-SESSION-CREATE');

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
      // because #teamSelect is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Scan for Team Alpha
      await gmScanner.selectTeam('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      // Use finishTeam() to return to teamEntryScreen (not continueScan which stays on scanScreen)
      await gmScanner.finishTeam();

      // CHECKPOINT 4: After Team Alpha scan
      await logBackendState('4-AFTER-TEAM-ALPHA-SCAN');

      // Scan for Detectives
      await gmScanner.selectTeam('Detectives');
      await gmScanner.confirmTeam();
      await gmScanner.manualScan(testTokens.businessToken.SF_RFID);
      // Use finishTeam() since we're done scanning for this team
      await gmScanner.finishTeam();

      // CHECKPOINT 5: After Detectives scan
      await logBackendState('5-AFTER-DETECTIVES-SCAN');

      // Navigate back to admin panel
      await gmScanner.navigateToAdminPanel();

      // DEBUG: Check what backend /api/state returns for scores
      await logBackendState('6-AFTER-ADMIN-NAV');

      // DEBUG: Check frontend backendScores Map size via localStorage or DOM
      const frontendScoreInfo = await page.evaluate(() => {
        // Try to get score info from the rendered table
        const rows = document.querySelectorAll('#admin-score-board tbody tr');
        const rowData = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            rowData.push({ team: cells[0]?.textContent, score: cells[1]?.textContent });
          }
        });
        return {
          rowCount: rows.length,
          rowData
        };
      });
      console.log(`[DEBUG:7-FRONTEND-SCOREBOARD] Rendered rows: ${JSON.stringify(frontendScoreInfo)}`);

      // Verify admin panel sections are rendered
      const scoresSection = page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      // Verify teams with scores appear in scoreboard
      // Note: Only teams with non-zero scores appear in scoreboard (Team Alpha, Detectives)
      // This is correct behavior - teams without scans don't clutter the scoreboard
      const scoreboardRows = page.locator('#admin-score-board tbody tr');
      await expect(scoreboardRows).toHaveCount(2, { timeout: 5000 });

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

      // Setup dialog handler BEFORE clicking
      page.once('dialog', async dialog => {
        expect(dialog.message()).toContain('Are you sure you want to reset all team scores');
        await dialog.accept();
      });

      // Click the reset button
      await page.click('button[data-action="app.adminResetScores"]');

      // Wait for backend to confirm scores are reset to zero
      // All 5 teams (001, 002, 003, Team Alpha, Detectives) remain in session with zero scores
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const scores = state.scores || [];
          // All teams should have zero scores after reset
          return scores.length === 5 && scores.every(s => s.currentScore === 0);
        },
        5000
      );

      // After reset, all teams have zero scores so scoreboard should be empty
      // (scoreboard only shows teams with non-zero scores)
      await expect(scoreboardRows).toHaveCount(0, { timeout: 5000 });

      console.log('✓ Score reset test completed successfully');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should adjust team score via team details screen', async () => {
    const context = await createBrowserContext(browser, 'mobile');
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
      // because #teamSelect is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

      // Select Team Alpha and scan a token
      await gmScanner.selectTeam('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);

      // Wait for score to update from transaction (personalToken has $500 value)
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === 500;
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

      // Adjust score via UI (add +500 to existing $500)
      await gmScanner.adjustTeamScore(500, 'Test bonus');

      // Verify backend has updated score: $500 from transaction + $500 adjustment = $1000
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === 1000;
        },
        5000
      );

      console.log('✓ Score adjustment via team details UI completed');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should persist score data across page reload', async () => {
    const context = await createBrowserContext(browser, 'mobile');
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
      // because #teamSelect is inside teamEntryScreen
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeam('Team Alpha');
      await gmScanner.confirmTeam();
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);

      // Wait for score to update from transaction
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === 500;
        },
        5000
      );

      // Navigate back to admin and adjust score by 250 more
      await gmScanner.continueScan();
      await gmScanner.navigateToAdminPanel();
      await gmScanner.clickTeamInScoreBoard('Team Alpha');
      await gmScanner.teamDetailsScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.adjustTeamScore(250, 'Persistence test bonus');

      // Wait for backend to have total score of 750
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => {
          const teamScore = state.scores?.find(s => s.teamId === 'Team Alpha');
          return teamScore?.currentScore === 750;
        },
        5000
      );

      // Navigate to admin and verify initial score shows in UI
      await gmScanner.navigateToAdminPanel();
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
      await gmScanner2.navigateToAdminPanel();

      // Verify admin panel sections are rendered after reload
      const scoresSection = page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      // Verify score persisted
      await expect(page.locator('#admin-score-board')).toContainText('750', { timeout: 3000 });

      console.log('✓ Score persistence test completed successfully');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should navigate to full scoreboard when View Full Scoreboard button clicked', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    // Capture browser console logs for debugging
    addConsoleCapture(page, 'Test5-ViewScoreboard');

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Create session with teams via UI
      await gmScanner.createSessionWithTeams('Nav Test Scoreboard', ['Team Alpha', 'Detectives']);

      // Wait for session to be active
      await gmScanner.waitForBackendState(
        orchestratorInfo.url,
        (state) => state.session?.status === 'active',
        5000
      );

      // Click View Full Scoreboard button (pure frontend navigation)
      await gmScanner.viewFullScoreboard();

      // Verify navigation to scoreboard
      await expect(gmScanner.scannerView).toBeVisible();
      await expect(gmScanner.adminView).not.toBeVisible();
      await expect(gmScanner.scoreboardScreen).toBeVisible();

      console.log('✓ View Full Scoreboard navigation completed');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should navigate to full history when View Full History button clicked', async () => {
    const context = await createBrowserContext(browser, 'mobile');
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
});
