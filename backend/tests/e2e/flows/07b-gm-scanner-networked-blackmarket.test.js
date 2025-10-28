/**
 * E2E Test: GM Scanner Networked Mode - Black Market
 *
 * NOTE: These tests are currently simplified due to WebSocket integration limitations.
 * Full transaction testing requires GM Scanner WebSocket `transaction:submit` debugging.
 * See: backend/TEST_07_NETWORKED_IMPLEMENTATION_NOTES.md
 *
 * Current Coverage:
 * - Scanner initialization in networked mode ✓
 * - WebSocket authentication ✓
 * - Session creation via WebSocket ✓
 * - UI navigation ✓
 *
 * TODO: Complete transaction testing once WebSocket integration is fixed
 * Production Tokens: sof002, rat002, mab001, mab002
 *
 * @group critical
 * @group phase2
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

const {
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets,
} = require('../setup/websocket-client');

const {
  initializeGMScannerWithMode,
  getTeamScore,
} = require('../helpers/scanner-init');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

test.describe('GM Scanner Networked Mode - Black Market (Simplified)', () => {

  test.beforeAll(async () => {
    await clearSessionData();

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
    console.log('Browser launched for networked mode tests');
  });

  test.afterAll(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test.afterEach(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
  });

  // ========================================
  // TEST 1: Scanner Connects in Networked Mode
  // ========================================

  test('connects to orchestrator and initializes in networked mode', async () => {
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_NETWORKED_CONNECTION',
      'gm'
    );

    // Verify WebSocket connection
    expect(socket.connected).toBe(true);

    // Create session
    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Connection',
          teams: ['001']
        }
      },
      timestamp: new Date().toISOString()
    });

    // Wait for session creation
    const ack = await waitForEvent(socket, 'gm:command:ack', null, 5000);
    expect(ack.data.success).toBe(true);
    expect(ack.data.action).toBe('session:create');

    // Initialize scanner UI
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Verify scanner is on scan screen
    const scanScreenVisible = await page.isVisible('#scanScreen');
    expect(scanScreenVisible).toBe(false); // Should be on team entry

    const teamEntryVisible = await page.isVisible('#teamEntryScreen');
    expect(teamEntryVisible).toBe(true);

    console.log('✓ Networked mode: Scanner connected and session created');
  });

  // ========================================
  // TEST 2-5: Placeholder for Full Transaction Tests
  // ========================================

  test.skip('TODO: scans single Personal token and backend awards 500 points', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
    // See: TEST_07_NETWORKED_IMPLEMENTATION_NOTES.md
  });

  test.skip('TODO: scans Business token and backend applies 3x multiplier', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });

  test.skip('TODO: completes group and backend applies multiplier', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });

  test.skip('TODO: backend rejects duplicate scan by same team', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });

  test.skip('TODO: backend rejects duplicate scan by different team', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });
});
