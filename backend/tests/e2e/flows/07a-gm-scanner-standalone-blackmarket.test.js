/**
 * E2E Test: GM Scanner Standalone Mode - Black Market
 *
 * Tests token scanning in standalone mode (no orchestrator connection).
 * Validates local scoring calculations, duplicate detection, and group completion.
 *
 * Production Tokens Used:
 * - sof002: Personal, 2 stars = 500 points
 * - rat002: Business, 4 stars = 15,000 points
 * - mab001: Personal, 5 stars, group "Marcus Sucks (x2)" = 10,000 points
 * - mab002: Personal, 5 stars, group "Marcus Sucks (x2)" = 10,000 points
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

// Global state
let browser = null;
let orchestratorInfo = null; // Still needed for backend to exist
let vlcInfo = null;

test.describe('GM Scanner Standalone Mode - Black Market', () => {

  test.beforeAll(async () => {
    await clearSessionData();

    // Start VLC and orchestrator (for token loading, not connection)
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });

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

  test('scans single Personal token and awards 500 points', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'standalone', 'blackmarket');

    // Ensure we're on scan screen after entering team
    await scanner.enterTeam('001');
    await scanner.confirmTeam();

    // Wait for scan screen to be fully visible
    await scanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Scan screen visible');

    // Wait for manual entry button to be enabled (indicates app is ready)
    await scanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.manualEntryBtn.waitFor({ state: 'attached', timeout: 5000 });

    // Scan token using Page Object pattern (ES6 architecture - no window.App)
    // manualEntry() handles dialog interaction via Page Object
    await scanner.manualScan('sof002');
    console.log('Token scanned via Page Object');

    // Wait for result
    await scanner.waitForResult(5000);

    // DEBUG: Check localStorage contents
    const localStorageDebug = await page.evaluate(() => {
      const session = localStorage.getItem('standaloneSession');
      return {
        raw: session,
        parsed: session ? JSON.parse(session) : null
      };
    });
    console.log('📦 localStorage.standaloneSession:', JSON.stringify(localStorageDebug.parsed, null, 2));

    const score = await getTeamScore(page, '001', 'standalone');
    expect(score).toBe(500);

    console.log('✓ Personal token scored correctly: 500 points');
  });
});
