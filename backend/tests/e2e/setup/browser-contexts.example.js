/**
 * Usage Examples for Browser Context Manager
 *
 * This file demonstrates common patterns for using browser contexts
 * in E2E tests that simulate multi-device scenarios.
 */

const { chromium } = require('@playwright/test');
const {
  createBrowserContext,
  createMultipleContexts,
  createPage,
  closeAllContexts,
} = require('./browser-contexts');
const GMScannerPage = require('../helpers/page-objects/GMScannerPage');

/**
 * Example 1: Single GM Scanner Test
 * Simplest usage pattern for single-device tests
 */
async function example1_singleDevice() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create mobile context for GM Scanner
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);

    // Use page object
    const scanner = new GMScannerPage(page);
    await scanner.goto();
    await scanner.enterTeam('001');
    await scanner.confirmTeam();
    await scanner.manualEntry('sof002');

    console.log('Single device test complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 2: Multiple GM Scanners (Concurrent Scanning)
 * Test 3 GM scanners processing scans simultaneously
 */
async function example2_multipleGMScanners() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create 3 mobile contexts for GM scanners
    const contexts = await createMultipleContexts(browser, 3, 'mobile');
    const pages = await Promise.all(contexts.map(ctx => createPage(ctx)));

    // Create page objects for each scanner
    const scanners = pages.map(page => new GMScannerPage(page));

    // Navigate all scanners to GM Scanner app
    await Promise.all(scanners.map(scanner => scanner.goto()));

    // Each scanner selects different team
    await scanners[0].enterTeam('001');
    await scanners[1].enterTeam('002');
    await scanners[2].enterTeam('003');

    await Promise.all(scanners.map(scanner => scanner.confirmTeam()));

    // Scan tokens concurrently
    await Promise.all([
      scanners[0].manualEntry('sof002'),
      scanners[1].manualEntry('jaw001'),
      scanners[2].manualEntry('vic003'),
    ]);

    console.log('Multi-scanner concurrent test complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 3: GM Scanner + Admin Panel
 * Test admin panel observing GM scanner activity
 */
async function example3_gmScannerAndAdmin() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create mobile context for GM Scanner
    const gmContext = await createBrowserContext(browser, 'mobile');
    const gmPage = await createPage(gmContext);

    // Create desktop context for Admin Panel
    const adminContext = await createBrowserContext(browser, 'desktop');
    const adminPage = await createPage(adminContext);

    // Setup GM Scanner
    const gmScanner = new GMScannerPage(gmPage);
    await gmScanner.goto();
    await gmScanner.enterTeam('001');
    await gmScanner.confirmTeam();

    // Setup Admin Panel (navigate and authenticate)
    await adminPage.goto('https://localhost:3000/admin/');
    // Admin authentication would happen here...

    // GM performs scan
    await gmScanner.manualEntry('sof002');

    // Admin panel receives WebSocket update (verify in adminPage)
    await adminPage.waitForTimeout(1000);

    console.log('GM Scanner + Admin Panel test complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 4: Full System Test (GM + Player + Admin + Scoreboard)
 * Test all components of the system simultaneously
 */
async function example4_fullSystemTest() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create 2 GM scanner contexts (mobile)
    const gmContexts = await createMultipleContexts(browser, 2, 'mobile');
    const gmPages = await Promise.all(gmContexts.map(ctx => createPage(ctx)));
    const gmScanners = gmPages.map(page => new GMScannerPage(page));

    // Create player scanner context (mobile)
    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);

    // Create admin panel context (desktop)
    const adminContext = await createBrowserContext(browser, 'desktop');
    const adminPage = await createPage(adminContext);

    // Create scoreboard display context (desktop)
    const scoreboardContext = await createBrowserContext(browser, 'desktop');
    const scoreboardPage = await createPage(scoreboardContext);

    // Initialize all pages
    await Promise.all([
      ...gmScanners.map(scanner => scanner.goto()),
      playerPage.goto('https://localhost:3000/player-scanner/'),
      adminPage.goto('https://localhost:3000/admin/'),
      scoreboardPage.goto('https://localhost:3000/scoreboard'),
    ]);

    // Setup GM scanners
    await gmScanners[0].enterTeam('001');
    await gmScanners[1].enterTeam('002');
    await Promise.all(gmScanners.map(scanner => scanner.confirmTeam()));

    // Perform scans
    await gmScanners[0].manualEntry('sof002');
    await gmScanners[1].manualEntry('jaw001');

    // Player scanner scans token
    // (Player scanner interactions would be defined in PlayerScannerPage object)

    // Verify scoreboard updates
    await scoreboardPage.waitForTimeout(1000);

    console.log('Full system test complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 5: Offline Mode Test (Multiple Scanners Going Offline)
 * Test offline queue synchronization when scanners reconnect
 */
async function example5_offlineModeTest() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create 2 GM scanner contexts
    const contexts = await createMultipleContexts(browser, 2, 'mobile');
    const pages = await Promise.all(contexts.map(ctx => createPage(ctx)));
    const scanners = pages.map(page => new GMScannerPage(page));

    // Navigate both scanners
    await Promise.all(scanners.map(scanner => scanner.goto()));

    // Setup teams
    await scanners[0].enterTeam('001');
    await scanners[1].enterTeam('002');
    await Promise.all(scanners.map(scanner => scanner.confirmTeam()));

    // Simulate offline mode (disconnect from orchestrator)
    // This would involve mocking network failures or stopping the orchestrator

    // Perform scans while offline
    await scanners[0].manualEntry('sof002');
    await scanners[1].manualEntry('jaw001');

    // Verify offline queue has scans
    const offline1 = await scanners[0].isOffline();
    const offline2 = await scanners[1].isOffline();
    console.log(`Scanner 1 offline: ${offline1}, Scanner 2 offline: ${offline2}`);

    // Simulate reconnection and verify sync
    // (Orchestrator restart would happen here)

    console.log('Offline mode test complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 6: Viewport Testing (Mobile vs Desktop)
 * Test responsive behavior across different viewport sizes
 */
async function example6_viewportTesting() {
  const browser = await chromium.launch({ headless: false });

  try {
    // Create mobile context
    const mobileContext = await createBrowserContext(browser, 'mobile');
    const mobilePage = await createPage(mobileContext);

    // Create desktop context
    const desktopContext = await createBrowserContext(browser, 'desktop');
    const desktopPage = await createPage(desktopContext);

    // Create custom viewport context
    const customContext = await createBrowserContext(browser, 'desktop', {
      viewport: { width: 1920, height: 1080 },
    });
    const customPage = await createPage(customContext);

    // Navigate all pages
    await Promise.all([
      mobilePage.goto('https://localhost:3000/gm-scanner/'),
      desktopPage.goto('https://localhost:3000/admin/'),
      customPage.goto('https://localhost:3000/scoreboard'),
    ]);

    // Verify viewports
    console.log('Mobile viewport:', mobilePage.viewportSize());
    console.log('Desktop viewport:', desktopPage.viewportSize());
    console.log('Custom viewport:', customPage.viewportSize());

    console.log('Viewport testing complete');
  } finally {
    await closeAllContexts();
    await browser.close();
  }
}

/**
 * Example 7: Jest Test Integration
 * Typical pattern for using browser contexts in Jest E2E tests
 */
describe('Multi-Device E2E Test', () => {
  let browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await closeAllContexts();
    await browser.close();
  });

  afterEach(async () => {
    // Clean up contexts after each test
    await closeAllContexts();
  });

  it('should support concurrent GM scanner sessions', async () => {
    // Create 3 GM scanner contexts
    const contexts = await createMultipleContexts(browser, 3, 'mobile');
    const pages = await Promise.all(contexts.map(ctx => createPage(ctx)));
    const scanners = pages.map(page => new GMScannerPage(page));

    // Navigate all scanners
    await Promise.all(scanners.map(scanner => scanner.goto()));

    // Verify all scanners loaded
    for (const scanner of scanners) {
      const status = await scanner.getConnectionStatus();
      expect(status).toBeDefined();
    }
  });

  it('should isolate scanner sessions', async () => {
    const context1 = await createBrowserContext(browser, 'mobile');
    const context2 = await createBrowserContext(browser, 'mobile');

    const page1 = await createPage(context1);
    const page2 = await createPage(context2);

    const scanner1 = new GMScannerPage(page1);
    const scanner2 = new GMScannerPage(page2);

    await scanner1.goto();
    await scanner2.goto();

    // Each scanner has independent state
    await scanner1.enterTeam('001');
    await scanner2.enterTeam('002');

    await scanner1.confirmTeam();
    await scanner2.confirmTeam();

    // Verify isolation
    expect(page1.context()).not.toBe(page2.context());
  });
});

// Run examples (uncomment to execute)
// example1_singleDevice();
// example2_multipleGMScanners();
// example3_gmScannerAndAdmin();
// example4_fullSystemTest();
// example5_offlineModeTest();
// example6_viewportTesting();
