/**
 * E2E Test: Display Control - Admin Panel
 *
 * Tests the full flow of display mode control from GM Scanner admin panel.
 * Verifies UI elements, mode toggling, and multi-scanner sync.
 *
 * Phase 4.2 Feature: HDMI display state machine control
 * - IDLE_LOOP: VLC plays idle-loop.mp4 on repeat
 * - SCOREBOARD: Browser shows scoreboard.html fullscreen
 * - VIDEO: Transitional state during memory token video playback
 *
 * @group display-control
 * @group admin-panel
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

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

test.describe('Display Control - Admin Panel', () => {

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
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
    console.log('Browser launched for display control tests');
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('should show display control UI elements in admin panel', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      // Initialize GM Scanner in networked mode
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Verify display control UI elements exist
      await expect(gmScanner.nowShowingValue).toBeVisible();
      await expect(gmScanner.nowShowingIcon).toBeVisible();
      await expect(gmScanner.pendingQueueCount).toBeVisible();
      await expect(gmScanner.btnIdleLoop).toBeVisible();
      await expect(gmScanner.btnScoreboard).toBeVisible();

      // Verify initial state shows Idle Loop (default)
      await expect(gmScanner.nowShowingValue).toHaveText('Idle Loop');
      await expect(gmScanner.nowShowingIcon).toHaveText('🔄');
      await expect(gmScanner.btnIdleLoop).toHaveClass(/active/);
      await expect(gmScanner.btnScoreboard).not.toHaveClass(/active/);

      console.log('✓ Display control UI elements verified');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should toggle display mode from Idle Loop to Scoreboard', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();

      // Verify initial state: Idle Loop is active
      await expect(gmScanner.btnIdleLoop).toHaveClass(/active/);
      await expect(gmScanner.nowShowingValue).toHaveText('Idle Loop');

      // Click Scoreboard button
      await gmScanner.setDisplayScoreboard();

      // Verify state changed to Scoreboard (auto-retrying assertions)
      await expect(gmScanner.btnScoreboard).toHaveClass(/active/);
      await expect(gmScanner.btnIdleLoop).not.toHaveClass(/active/);
      await expect(gmScanner.nowShowingValue).toHaveText('Scoreboard');
      await expect(gmScanner.nowShowingIcon).toHaveText('🏆');

      console.log('✓ Toggled to Scoreboard mode');

      // Toggle back to Idle Loop
      await gmScanner.setDisplayIdleLoop();

      // Verify state changed back (auto-retrying assertions)
      await expect(gmScanner.btnIdleLoop).toHaveClass(/active/);
      await expect(gmScanner.btnScoreboard).not.toHaveClass(/active/);
      await expect(gmScanner.nowShowingValue).toHaveText('Idle Loop');
      await expect(gmScanner.nowShowingIcon).toHaveText('🔄');

      console.log('✓ Toggled back to Idle Loop mode');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should sync display mode across multiple GM scanners', async () => {
    // Create two browser contexts for two separate scanners
    const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const context2 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page1 = await createPage(context1);
    const page2 = await createPage(context2);

    try {
      // Initialize both scanners
      const gmScanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      const gmScanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Both navigate to admin panel
      await gmScanner1.navigateToAdminPanel();
      await gmScanner2.navigateToAdminPanel();

      // Verify both start with same initial state (Idle Loop)
      await expect(gmScanner1.nowShowingValue).toHaveText('Idle Loop');
      await expect(gmScanner2.nowShowingValue).toHaveText('Idle Loop');

      // Scanner 1 changes to Scoreboard
      await gmScanner1.setDisplayScoreboard();

      // Verify Scanner 2 received the broadcast and updated (auto-retrying assertion)
      await expect(gmScanner2.nowShowingValue).toHaveText('Scoreboard');
      await expect(gmScanner2.btnScoreboard).toHaveClass(/active/);

      console.log('✓ Display mode synced across multiple scanners');

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('should show "Returns To" indicator during video playback', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();

      // First, set mode to Scoreboard so we can verify "Returns to" shows correctly
      await gmScanner.setDisplayScoreboard();

      // Verify mode changed
      await expect(gmScanner.nowShowingValue).toHaveText('Scoreboard');

      // Returns To should be hidden when no video is playing
      await expect(gmScanner.returnsToContainer).toBeHidden();

      console.log('✓ Returns To indicator is hidden when no video playing');

      // Note: Testing actual video playback requires queueing a video via scan,
      // which would require a full session + scan flow. This is covered in
      // integration tests with VLC. Here we just verify the UI element exists
      // and is properly hidden when no video is playing.

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should handle display control without errors during view switching', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    // Track errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Navigate to admin panel
      await gmScanner.navigateToAdminPanel();

      // Toggle display mode
      await gmScanner.setDisplayScoreboard();

      // Verify mode changed
      await expect(gmScanner.nowShowingValue).toHaveText('Scoreboard');

      // Switch back to scanner view
      await gmScanner.scannerTab.click();
      await gmScanner.scannerView.waitFor({ state: 'visible', timeout: 5000 });

      // Switch back to admin view
      await gmScanner.navigateToAdminPanel();

      // Verify display mode persisted (still Scoreboard)
      await expect(gmScanner.nowShowingValue).toHaveText('Scoreboard');

      // No errors should have occurred
      expect(pageErrors).toHaveLength(0);

      console.log('✓ Display control works correctly during view switching');

    } finally {
      await page.close();
      await context.close();
    }
  });
});
