/**
 * E2E Test: GM Scanner Admin Panel - UI & Navigation
 *
 * Tests stateless UI features that don't mutate backend state.
 * Safe to run with shared orchestrator.
 *
 * @group admin-panel
 * @group ui
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

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

test.describe('GM Scanner Admin Panel - UI & Navigation', () => {

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
    console.log('Browser launched for UI tests');
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('should initialize admin panel without errors after connection', async () => {
    // Create browser page
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Track console errors (CRITICAL for regression detection)
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track uncaught exceptions (would catch TypeError: .on is not a function)
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    try {
      // Initialize GM Scanner in networked mode with WebSocket auth
      // This returns GMScannerPage object and already waits for connection
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Verify we're in scanner view initially
      await expect(gmScanner.scannerView).toBeVisible();

      // Navigate to admin panel (includes admin module initialization wait)
      console.log('Navigating to admin panel...');
      await gmScanner.navigateToAdminPanel();

      // Admin view is now visible and modules are initialized
      // (navigateToAdminPanel() includes the visibility wait + 1000ms initialization wait)

      // CRITICAL ASSERTION: No TypeError should occur
      expect(pageErrors).toHaveLength(0);

      // Verify no "is not a function" errors in console
      // Filter out Service Worker registration errors (pre-existing infrastructure issue)
      const apiErrors = consoleErrors.filter(err =>
        (err.includes('is not a function') || err.includes('TypeError')) &&
        !err.includes('Service Worker registration failed')
      );
      expect(apiErrors).toHaveLength(0);

      // Verify admin view is actually displayed
      await expect(gmScanner.adminView).toBeVisible();

      // Verify admin panel sections are rendered
      const sessionSection = await page.locator('.admin-section h3:has-text("Session Management")');
      await expect(sessionSection).toBeVisible();

      const videoSection = await page.locator('.admin-section h3:has-text("Video Controls")');
      await expect(videoSection).toBeVisible();

      const systemSection = await page.locator('.admin-section h3:has-text("System Status")');
      await expect(systemSection).toBeVisible();

      const scoresSection = await page.locator('.admin-section h3:has-text("Team Scores")');
      await expect(scoresSection).toBeVisible();

      const transactionsSection = await page.locator('.admin-section h3:has-text("Recent Transactions")');
      await expect(transactionsSection).toBeVisible();

      // Verify DOM elements that admin modules update are present
      const sessionContainer = await page.locator('#session-status-container');
      expect(await sessionContainer.count()).toBe(1);

      const videoInfo = await page.locator('#admin-current-video');
      expect(await videoInfo.count()).toBe(1);

      const orchestratorStatus = await page.locator('#orchestrator-status');
      expect(await orchestratorStatus.count()).toBe(1);

      console.log('✓ Admin panel initialized successfully without errors');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should support switching between views without errors', async () => {
    // Create browser page
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      // Initialize GM Scanner (connection already established by helper)
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Track errors
      const pageErrors = [];
      page.on('pageerror', error => {
        pageErrors.push(error.message);
      });

      // Switch between views multiple times
      const views = [
        { name: 'scanner', tab: gmScanner.scannerTab, view: gmScanner.scannerView },
        { name: 'admin', tab: gmScanner.adminTab, view: gmScanner.adminView },
        { name: 'scanner', tab: gmScanner.scannerTab, view: gmScanner.scannerView },
        { name: 'admin', tab: gmScanner.adminTab, view: gmScanner.adminView }
      ];

      for (const { name, tab, view } of views) {
        console.log(`Switching to ${name} view...`);

        if (name === 'admin') {
          // Use helper for admin view (ensures complete initialization)
          await gmScanner.navigateToAdminPanel();
        } else {
          // Standard navigation for scanner view
          await tab.click();
          await view.waitFor({ state: 'visible', timeout: 5000 });
        }

        // Verify correct view is shown
        await expect(view).toBeVisible();

        // No arbitrary timeout needed - proper waits are in place
      }

      // CRITICAL: No errors should occur during view switching
      expect(pageErrors).toHaveLength(0);

      console.log('✓ View switching works correctly');

    } finally {
      await page.close();
      await context.close();
    }
  });
});
