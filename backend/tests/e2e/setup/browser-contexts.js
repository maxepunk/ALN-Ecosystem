/**
 * Browser Context Manager for Multi-Device E2E Testing
 *
 * Provides isolated browser contexts for simulating multiple devices (GM scanners,
 * player scanners, admin panels, scoreboard displays) connecting simultaneously.
 *
 * Key Features:
 * - Isolated browser contexts (separate cookies, storage, cache)
 * - Desktop and mobile viewport configurations
 * - HTTPS self-signed certificate support
 * - Multi-instance tracking for cleanup
 * - Automatic context lifecycle management
 *
 * Usage:
 * ```javascript
 * const { chromium } = require('@playwright/test');
 * const { createBrowserContext, createPage, closeAllContexts } = require('./browser-contexts');
 *
 * // Setup
 * const browser = await chromium.launch();
 *
 * // Create multiple GM scanner contexts (mobile viewport)
 * const gmContext1 = await createBrowserContext(browser, 'mobile');
 * const gmContext2 = await createBrowserContext(browser, 'mobile');
 *
 * // Create admin panel context (desktop viewport)
 * const adminContext = await createBrowserContext(browser, 'desktop');
 *
 * // Create pages
 * const gmPage1 = await createPage(gmContext1);
 * const gmPage2 = await createPage(gmContext2);
 * const adminPage = await createPage(adminContext);
 *
 * // Run tests with multiple devices...
 *
 * // Cleanup
 * await closeAllContexts();
 * await browser.close();
 * ```
 */

const { devices } = require('@playwright/test');

/**
 * Module-level tracking of all created browser contexts
 * Enables global cleanup in afterAll hooks
 * @type {Array<import('playwright').BrowserContext>}
 */
const activeContexts = [];

/**
 * Default viewport configurations for context types
 * Mirrors configurations from playwright.config.js
 */
const VIEWPORT_CONFIGS = {
  desktop: {
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: devices['Desktop Chrome'].userAgent,
  },
  mobile: {
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: devices['Pixel 5'].deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Pixel 5'].userAgent,
  },
};

/**
 * Pi-specific browser optimization arguments
 * Required for running Chromium on Raspberry Pi 4 with limited resources
 */
const PI_BROWSER_ARGS = [
  '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (Pi RAM optimization)
  '--no-sandbox', // Required for Pi compatibility
  '--disable-setuid-sandbox',
  '--disable-gpu', // GPU reserved for VLC video playback
  '--disable-web-security', // Allow self-signed certs in tests
];

/**
 * Create an isolated browser context with specified configuration
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {('desktop'|'mobile')} contextType - Context type (desktop or mobile)
 * @param {Object} [options={}] - Additional context options
 * @param {Object} [options.viewport] - Custom viewport override
 * @param {string} [options.userAgent] - Custom user agent override
 * @param {boolean} [options.ignoreHTTPSErrors=true] - Ignore SSL certificate errors
 * @param {Object} [options.permissions] - Permissions to grant (e.g., ['clipboard-read'])
 * @param {string} [options.locale] - Locale for the context (e.g., 'en-US')
 * @param {string} [options.timezoneId] - Timezone override (e.g., 'America/New_York')
 * @returns {Promise<import('playwright').BrowserContext>} Browser context
 *
 * @example
 * const browser = await chromium.launch();
 * const context = await createBrowserContext(browser, 'mobile');
 * const page = await context.newPage();
 */
async function createBrowserContext(browser, contextType = 'desktop', options = {}) {
  // Validate context type
  if (!['desktop', 'mobile'].includes(contextType)) {
    throw new Error(`Invalid contextType: ${contextType}. Must be 'desktop' or 'mobile'`);
  }

  // Get base configuration for context type
  const baseConfig = VIEWPORT_CONFIGS[contextType];

  // Merge base config with custom options
  const contextOptions = {
    ...baseConfig,
    viewport: options.viewport || baseConfig.viewport,
    userAgent: options.userAgent || baseConfig.userAgent,
    ignoreHTTPSErrors: options.ignoreHTTPSErrors !== undefined ? options.ignoreHTTPSErrors : true,
    permissions: options.permissions || [],
    locale: options.locale || 'en-US',
    timezoneId: options.timezoneId || 'America/New_York',
  };

  // Create browser context
  const context = await browser.newContext(contextOptions);

  // Track context for cleanup
  activeContexts.push(context);

  return context;
}

/**
 * Create multiple browser contexts of the same type
 *
 * Useful for simulating N devices connecting simultaneously
 * (e.g., 3 GM scanners, 2 player scanners)
 *
 * @param {import('playwright').Browser} browser - Playwright browser instance
 * @param {number} count - Number of contexts to create
 * @param {('desktop'|'mobile')} contextType - Context type (desktop or mobile)
 * @param {Object} [options={}] - Additional context options
 * @returns {Promise<Array<import('playwright').BrowserContext>>} Array of browser contexts
 *
 * @example
 * const browser = await chromium.launch();
 * const gmContexts = await createMultipleContexts(browser, 3, 'mobile');
 * const gmPages = await Promise.all(gmContexts.map(ctx => createPage(ctx)));
 */
async function createMultipleContexts(browser, count, contextType = 'desktop', options = {}) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Invalid count: ${count}. Must be a positive integer`);
  }

  // Create contexts in parallel
  const contextPromises = Array.from({ length: count }, () =>
    createBrowserContext(browser, contextType, options)
  );

  return await Promise.all(contextPromises);
}

/**
 * Create a new page in the specified browser context
 *
 * Automatically configures page for HTTPS and other common settings
 *
 * @param {import('playwright').BrowserContext} context - Browser context
 * @returns {Promise<import('playwright').Page>} Page instance
 *
 * @example
 * const context = await createBrowserContext(browser, 'mobile');
 * const page = await createPage(context);
 * await page.goto('https://localhost:3000/gm-scanner/');
 */
async function createPage(context) {
  const page = await context.newPage();

  // Configure page for common E2E test scenarios
  // (HTTPS errors already handled by context ignoreHTTPSErrors)

  return page;
}

/**
 * Close a single browser context
 *
 * Removes context from tracking array and closes all associated pages
 *
 * @param {import('playwright').BrowserContext} context - Context to close
 * @returns {Promise<void>}
 *
 * @example
 * const context = await createBrowserContext(browser, 'desktop');
 * // ... use context ...
 * await closeBrowserContext(context);
 */
async function closeBrowserContext(context) {
  if (!context) {
    return;
  }

  // Remove from tracking array
  const index = activeContexts.indexOf(context);
  if (index > -1) {
    activeContexts.splice(index, 1);
  }

  // Close context (automatically closes all pages)
  await context.close();
}

/**
 * Close all tracked browser contexts
 *
 * Use in afterAll hooks to ensure clean test teardown
 * Prevents memory leaks from unclosed contexts
 *
 * @returns {Promise<void>}
 *
 * @example
 * afterAll(async () => {
 *   await closeAllContexts();
 *   await browser.close();
 * });
 */
async function closeAllContexts() {
  // Close all contexts in parallel
  await Promise.all(activeContexts.map(context => context.close()));

  // Clear tracking array
  activeContexts.length = 0;
}

/**
 * Get the number of currently active contexts
 *
 * Useful for debugging and validation
 *
 * @returns {number} Number of active contexts
 *
 * @example
 * expect(getActiveContextCount()).toBe(3); // Verify 3 contexts created
 */
function getActiveContextCount() {
  return activeContexts.length;
}

/**
 * Get all active browser contexts
 *
 * Useful for advanced test scenarios requiring context inspection
 *
 * @returns {Array<import('playwright').BrowserContext>} Array of active contexts
 *
 * @example
 * const contexts = getAllActiveContexts();
 * console.log(`Active contexts: ${contexts.length}`);
 */
function getAllActiveContexts() {
  return [...activeContexts]; // Return copy to prevent external mutation
}

module.exports = {
  // Core functions
  createBrowserContext,
  createMultipleContexts,
  createPage,
  closeBrowserContext,
  closeAllContexts,

  // Inspection functions
  getActiveContextCount,
  getAllActiveContexts,

  // Constants (exported for advanced use cases)
  VIEWPORT_CONFIGS,
  PI_BROWSER_ARGS,
};
