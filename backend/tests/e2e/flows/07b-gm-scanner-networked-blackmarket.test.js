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

  test('scans single Personal token and backend awards 500 points', async () => {
    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_SINGLE_SCAN',
      'gm'
    );

    // Create session
    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Single Scan',
          teams: ['001']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(socket, 'gm:command:ack', null, 5000);

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Enter team
    await scanner.enterTeam('001');
    await scanner.confirmTeam();

    // Listen for transaction broadcast
    const transactionPromise = waitForEvent(socket, 'transaction:new', null, 10000);

    // Simulate NFC scan (what NFC API would trigger)
    await page.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'nfc',
        raw: tokenId
      });
    }, 'sof002');
    console.log('NFC scan simulated');

    await scanner.waitForResult(5000);

    // Wait for backend broadcast
    const txEvent = await transactionPromise;
    expect(txEvent.data).toBeDefined();
    expect(txEvent.data.transaction).toBeDefined();
    expect(txEvent.data.transaction.tokenId).toBe('sof002');

    // Verify score via helper
    const score = await getTeamScore(page, '001', 'networked');
    expect(score).toBe(500);

    console.log('✓ Networked mode: Personal token scored 500 points');
  });

  test('scans Business token and backend applies 3x multiplier', async () => {
    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_BUSINESS_SCAN',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Business Token',
          teams: ['001']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(socket, 'gm:command:ack', null, 5000);

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await scanner.enterTeam('001');
    await scanner.confirmTeam();

    // Listen for transaction broadcast
    const transactionPromise = waitForEvent(socket, 'transaction:new', null, 10000);

    // Simulate NFC scan (what NFC API would trigger)
    await page.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'nfc',
        raw: tokenId
      });
    }, 'rat002');
    console.log('NFC scan simulated');

    await scanner.waitForResult(5000);

    // Wait for backend broadcast
    const txEvent = await transactionPromise;
    expect(txEvent.data).toBeDefined();
    expect(txEvent.data.transaction).toBeDefined();
    expect(txEvent.data.transaction.tokenId).toBe('rat002');

    // Verify score with multiplier applied
    const score = await getTeamScore(page, '001', 'networked');
    expect(score).toBe(15000);

    console.log('✓ Networked mode: Business token scored 15,000 points (3x multiplier)');
  });

  test('completes group and backend applies multiplier', async () => {
    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_GROUP_COMPLETION',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Group Completion',
          teams: ['001']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(socket, 'gm:command:ack', null, 5000);

    // Initialize scanner
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await scanner.enterTeam('001');
    await scanner.confirmTeam();

    // "Marcus Sucks (x2)" group - all 5 tokens required for completion
    // Base values: mab002(10k) + jek001(100) + fli001(500) + rat001(15k) + asm001(1k) = 26,600
    // With x2 multiplier bonus: 26,600 + 26,600 = 53,200
    const groupTokens = ['mab002', 'jek001', 'fli001', 'rat001', 'asm001'];

    // Listen for group completion event (will fire after last token)
    const groupCompletionPromise = waitForEvent(socket, 'group:completed', null, 15000);

    // Scan all tokens in sequence
    for (let i = 0; i < groupTokens.length; i++) {
      const tokenId = groupTokens[i];

      const transactionPromise = waitForEvent(socket, 'transaction:new', null, 10000);

      // Simulate NFC scan
      await page.evaluate((tid) => {
        window.App.processNFCRead({
          id: tid,
          source: 'nfc',
          raw: tid
        });
      }, tokenId);

      await scanner.waitForResult(5000);

      const txEvent = await transactionPromise;
      expect(txEvent.data.transaction.tokenId).toBe(tokenId);

      console.log(`Token ${i + 1}/5 scanned: ${tokenId}`);
    }

    // Wait for group completion event
    const groupEvent = await groupCompletionPromise;
    expect(groupEvent.data).toBeDefined();
    expect(groupEvent.data.group).toBe('Marcus Sucks');  // AsyncAPI: 'group' not 'groupId'
    expect(groupEvent.data.bonusPoints).toBe(26600);     // AsyncAPI: 'bonusPoints' not 'bonus'
    expect(groupEvent.data.teamId).toBe('001');
    expect(groupEvent.data.completedAt).toBeDefined();   // Timestamp added by broadcast

    // Verify final score (base + bonus)
    const finalScore = await getTeamScore(page, '001', 'networked');
    expect(finalScore).toBe(53200);

    console.log('✓ Networked mode: Group completed, x2 multiplier applied, 53,200 total points');
  });

  test.skip('TODO: backend rejects duplicate scan by same team', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });

  test.skip('TODO: backend rejects duplicate scan by different team', async () => {
    // Requires: GM Scanner WebSocket transaction:submit debugging
  });
});
