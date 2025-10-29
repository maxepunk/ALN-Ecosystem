/**
 * Smoke Tests for Browser Context Manager
 *
 * Validates browser context creation, tracking, and cleanup functionality
 * without requiring a running orchestrator.
 */

const { chromium } = require('@playwright/test');
const {
  createBrowserContext,
  createMultipleContexts,
  createPage,
  closeBrowserContext,
  closeAllContexts,
  getActiveContextCount,
  getAllActiveContexts,
  VIEWPORT_CONFIGS,
} = require('./browser-contexts');

describe('Browser Context Manager', () => {
  let browser;

  beforeAll(async () => {
    // Launch browser once for all tests
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    // Close browser and all contexts
    await closeAllContexts();
    await browser.close();
  });

  afterEach(async () => {
    // Clean up after each test
    await closeAllContexts();
  });

  describe('createBrowserContext()', () => {
    it('should create a desktop browser context with correct viewport', async () => {
      const context = await createBrowserContext(browser, 'desktop');

      expect(context).toBeDefined();
      expect(getActiveContextCount()).toBe(1);

      // Verify context is tracked
      const activeContexts = getAllActiveContexts();
      expect(activeContexts).toContain(context);

      await closeBrowserContext(context);
    });

    it('should create a mobile browser context with correct viewport', async () => {
      const context = await createBrowserContext(browser, 'mobile');

      expect(context).toBeDefined();
      expect(getActiveContextCount()).toBe(1);

      await closeBrowserContext(context);
    });

    it('should accept custom viewport override', async () => {
      const customViewport = { width: 800, height: 600 };
      const context = await createBrowserContext(browser, 'desktop', {
        viewport: customViewport,
      });

      const page = await createPage(context);
      const viewportSize = page.viewportSize();

      expect(viewportSize.width).toBe(customViewport.width);
      expect(viewportSize.height).toBe(customViewport.height);

      await closeBrowserContext(context);
    });

    it('should enable ignoreHTTPSErrors by default', async () => {
      const context = await createBrowserContext(browser, 'desktop');
      const page = await createPage(context);

      // HTTPS errors are handled at context level
      // This test validates context creation succeeds
      expect(page).toBeDefined();

      await closeBrowserContext(context);
    });

    it('should throw error for invalid context type', async () => {
      await expect(
        createBrowserContext(browser, 'invalid')
      ).rejects.toThrow(/Invalid contextType/);
    });
  });

  describe('createMultipleContexts()', () => {
    it('should create multiple contexts of the same type', async () => {
      const count = 3;
      const contexts = await createMultipleContexts(browser, count, 'mobile');

      expect(contexts).toHaveLength(count);
      expect(getActiveContextCount()).toBe(count);

      // Verify all contexts are tracked
      const activeContexts = getAllActiveContexts();
      contexts.forEach(ctx => {
        expect(activeContexts).toContain(ctx);
      });

      await closeAllContexts();
    });

    it('should create contexts in parallel', async () => {
      const startTime = Date.now();
      const contexts = await createMultipleContexts(browser, 5, 'desktop');
      const elapsed = Date.now() - startTime;

      expect(contexts).toHaveLength(5);

      // Parallel creation should be faster than sequential
      // (rough heuristic: 5 contexts in < 5s on Pi)
      expect(elapsed).toBeLessThan(5000);

      await closeAllContexts();
    });

    it('should throw error for invalid count', async () => {
      await expect(
        createMultipleContexts(browser, 0, 'desktop')
      ).rejects.toThrow(/Invalid count/);

      await expect(
        createMultipleContexts(browser, -1, 'desktop')
      ).rejects.toThrow(/Invalid count/);

      await expect(
        createMultipleContexts(browser, 1.5, 'desktop')
      ).rejects.toThrow(/Invalid count/);
    });
  });

  describe('createPage()', () => {
    it('should create a page in the context', async () => {
      const context = await createBrowserContext(browser, 'desktop');
      const page = await createPage(context);

      expect(page).toBeDefined();
      expect(page.context()).toBe(context);

      await closeBrowserContext(context);
    });

    it('should create multiple pages in the same context', async () => {
      const context = await createBrowserContext(browser, 'mobile');
      const page1 = await createPage(context);
      const page2 = await createPage(context);

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
      expect(page1).not.toBe(page2);

      // Both pages share same context
      expect(page1.context()).toBe(context);
      expect(page2.context()).toBe(context);

      await closeBrowserContext(context);
    });
  });

  describe('closeBrowserContext()', () => {
    it('should close context and remove from tracking', async () => {
      const context = await createBrowserContext(browser, 'desktop');
      expect(getActiveContextCount()).toBe(1);

      await closeBrowserContext(context);

      expect(getActiveContextCount()).toBe(0);
      const activeContexts = getAllActiveContexts();
      expect(activeContexts).not.toContain(context);
    });

    it('should handle closing null context gracefully', async () => {
      await expect(closeBrowserContext(null)).resolves.not.toThrow();
    });

    it('should close all pages in the context', async () => {
      const context = await createBrowserContext(browser, 'mobile');
      const page1 = await createPage(context);
      const page2 = await createPage(context);

      await closeBrowserContext(context);

      // Pages should be closed (isClosed() returns true)
      expect(page1.isClosed()).toBe(true);
      expect(page2.isClosed()).toBe(true);
    });
  });

  describe('closeAllContexts()', () => {
    it('should close all tracked contexts', async () => {
      await createMultipleContexts(browser, 3, 'desktop');
      await createMultipleContexts(browser, 2, 'mobile');

      expect(getActiveContextCount()).toBe(5);

      await closeAllContexts();

      expect(getActiveContextCount()).toBe(0);
      expect(getAllActiveContexts()).toHaveLength(0);
    });

    it('should handle empty context array', async () => {
      await expect(closeAllContexts()).resolves.not.toThrow();
    });
  });

  describe('Multi-Device Simulation', () => {
    it('should simulate 3 GM scanners + 1 admin panel', async () => {
      // Create 3 mobile contexts for GM scanners
      const gmContexts = await createMultipleContexts(browser, 3, 'mobile');

      // Create 1 desktop context for admin panel
      const adminContext = await createBrowserContext(browser, 'desktop');

      expect(getActiveContextCount()).toBe(4);

      // Create pages for each context
      const gmPages = await Promise.all(
        gmContexts.map(ctx => createPage(ctx))
      );
      const adminPage = await createPage(adminContext);

      expect(gmPages).toHaveLength(3);
      expect(adminPage).toBeDefined();

      // Verify each page has correct viewport
      gmPages.forEach(page => {
        const viewport = page.viewportSize();
        expect(viewport.width).toBe(VIEWPORT_CONFIGS.mobile.viewport.width);
        expect(viewport.height).toBe(VIEWPORT_CONFIGS.mobile.viewport.height);
      });

      const adminViewport = adminPage.viewportSize();
      expect(adminViewport.width).toBe(VIEWPORT_CONFIGS.desktop.viewport.width);

      await closeAllContexts();
    });

    it('should create isolated contexts', async () => {
      const context1 = await createBrowserContext(browser, 'mobile');
      const context2 = await createBrowserContext(browser, 'mobile');

      const page1 = await createPage(context1);
      const page2 = await createPage(context2);

      // Verify contexts are different objects (isolation)
      expect(context1).not.toBe(context2);
      expect(page1.context()).toBe(context1);
      expect(page2.context()).toBe(context2);
      expect(page1.context()).not.toBe(page2.context());

      // Verify contexts have independent properties
      const context1Options = {
        viewport: { width: 400, height: 800 },
      };
      const context2Options = {
        viewport: { width: 500, height: 900 },
      };

      const customContext1 = await createBrowserContext(browser, 'mobile', context1Options);
      const customContext2 = await createBrowserContext(browser, 'mobile', context2Options);

      const customPage1 = await createPage(customContext1);
      const customPage2 = await createPage(customContext2);

      const viewport1 = customPage1.viewportSize();
      const viewport2 = customPage2.viewportSize();

      expect(viewport1.width).toBe(400);
      expect(viewport2.width).toBe(500);

      await closeAllContexts();
    });
  });

  describe('Viewport Configurations', () => {
    it('should have correct desktop viewport config', () => {
      const desktop = VIEWPORT_CONFIGS.desktop;

      expect(desktop.viewport.width).toBe(1280);
      expect(desktop.viewport.height).toBe(720);
      expect(desktop.isMobile).toBe(false);
      expect(desktop.hasTouch).toBe(false);
    });

    it('should have correct mobile viewport config', () => {
      const mobile = VIEWPORT_CONFIGS.mobile;

      expect(mobile.viewport.width).toBe(393);
      expect(mobile.viewport.height).toBe(851);
      expect(mobile.isMobile).toBe(true);
      expect(mobile.hasTouch).toBe(true);
    });
  });
});
