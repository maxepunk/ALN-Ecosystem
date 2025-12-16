/**
 * E2E Test: GM Scanner Standalone Mode - Black Market
 *
 * Tests token scanning in standalone mode (no orchestrator connection).
 * Validates local scoring calculations using dynamic token selection.
 * Uses production token data via /api/tokens for data-agnostic testing.
 *
 * @group critical
 * @group phase2
 */

const { test, expect, chromium } = require('@playwright/test');

// Test infrastructure
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');

const {
  createBrowserContext,
  createPage,
  closeAllContexts,
} = require('../setup/browser-contexts');

const {
  initializeGMScannerWithMode,
  getTeamScore,
  scanTokenSequence
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');
const { calculateExpectedScore } = require('../helpers/scoring');

// Global state
let browser = null;
let orchestratorInfo = null; // Still needed for backend to exist
let vlcInfo = null;
let testTokens = null;  // Dynamically selected tokens

test.describe('GM Scanner Standalone Mode - Black Market', () => {

  test.beforeAll(async () => {
    await clearSessionData();

    // Start VLC and orchestrator (for token loading, not connection)
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000
    });

    // Select test tokens dynamically from production database
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
    console.log('Browser launched for standalone mode tests');
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test.afterEach(async () => {
    await closeAllContexts();
  });

  // ========================================
  // TEST 1: Single Token Scan
  // ========================================

  test('scans single Personal token and awards correct points', async () => {
    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'standalone', 'blackmarket');

    // Ensure we're on scan screen after entering team
    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    // Wait for scan screen to be fully visible
    await scanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Scan screen visible');

    // Wait for manual entry button to be enabled (indicates app is ready)
    await scanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.manualEntryBtn.waitFor({ state: 'attached', timeout: 5000 });

    // Scan token using Page Object pattern (ES6 architecture - no window.App)
    await scanner.manualScan(token.SF_RFID);
    console.log(`Token scanned: ${token.SF_RFID} (${token.SF_MemoryType} ${token.SF_ValueRating}⭐)`);

    // Wait for result
    await scanner.waitForResult(5000);

    // Verify standalone mode calculated score correctly
    const score = await getTeamScore(page, 'Team Alpha', 'standalone');
    expect(score).toBe(expectedScore);

    console.log(`✓ Standalone mode: Personal token scored $${expectedScore.toLocaleString()}`);
  });
});
