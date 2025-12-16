/**
 * Minimal diagnostic test: Does the app load at all?
 *
 * This test verifies the most basic requirement:
 * - The production build is accessible at /gm-scanner/
 * - The main ES6 module loads without 404 errors
 * - ES6 architecture initialized (game mode screen visible, NO window.App globals)
 */

const { test, expect, chromium } = require('@playwright/test');

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

// Global state
let browser = null;
let orchestrator = null;

test.describe('GM Scanner - App Loading', () => {

  test.beforeAll(async () => {
    // Clear any existing session data
    await clearSessionData();

    console.log('Setting up VLC for E2E tests...');
    await setupVLC();

    console.log('Starting orchestrator for E2E tests');
    orchestrator = await startOrchestrator({
      https: true,
      preserveSession: false
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
    console.log('Browser launched');
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    if (orchestrator) {
      await stopOrchestrator(orchestrator);
    }
    await cleanupVLC();
  });

  test.afterEach(async () => {
    await closeAllContexts();
  });

  test('loads the app without 404 errors', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    console.log('📱 Navigating to /gm-scanner/');

    // Track 404 errors (but ignore expected fallback attempts like data/tokens.json)
    const errors404 = [];
    page.on('response', response => {
      if (response.status() === 404) {
        const url = response.url();
        // Ignore expected fallback paths (tokenManager tries data/ then falls back to root)
        if (!url.includes('/data/tokens.json')) {
          errors404.push(url);
        }
      }
    });

    // Navigate to scanner with fresh localStorage
    await page.goto('/gm-scanner/', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    console.log('📦 Checking if app loaded...');

    // CONDITION-BASED WAIT: Wait for ES6 initialization to complete
    // The app completes 11-phase init and shows game mode screen
    // The game mode screen gets .active class when initialization is done
    const gameModeScreen = await page.waitForSelector('#gameModeScreen.active', {
      state: 'visible',
      timeout: 15000  // 11 phases + token loading can take time
    });

    // Verify ES6 architecture (NO window.App globals)
    const hasWindowApp = await page.evaluate(() => {
      return typeof window.App !== 'undefined';
    });

    console.log(`✅ Game mode screen visible: ${!!gameModeScreen}`);
    console.log(`✅ No window.App global (ES6 architecture): ${!hasWindowApp}`);
    console.log(`❌ 404 errors: ${errors404.length > 0 ? errors404.join(', ') : 'none'}`);

    // Assertions
    expect(errors404.length).toBe(0);
    expect(gameModeScreen).toBeTruthy();
    expect(hasWindowApp).toBe(false); // ES6 architecture should NOT have window.App
  });
});
