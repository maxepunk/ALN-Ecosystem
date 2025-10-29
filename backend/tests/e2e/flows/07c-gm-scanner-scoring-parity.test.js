/**
 * E2E Test: GM Scanner Scoring Parity (Standalone vs Networked)
 *
 * Validates that scoring calculations produce IDENTICAL results in both modes.
 * This ensures architectural flexibility - the system can be deployed either:
 * - Standalone mode (GitHub Pages, no orchestrator)
 * - Networked mode (with orchestrator backend)
 *
 * Critical for maintaining deployment options without scoring discrepancies.
 *
 * Production Tokens Used:
 * - sof002: Personal, 2 stars = 500 points
 * - rat002: Business, 4 stars = 15,000 points (5,000 × 3)
 * - mab002: Personal, 5 stars = 10,000 points
 * - mor002: Business, 4 stars, group "Exposing the Truth (x3)" = 15,000 points
 * - jav002: Business, 4 stars, group "Exposing the Truth (x3)" = 15,000 points
 * - asm002: Business, 4 stars, group "Exposing the Truth (x3)" = 15,000 points
 *   Group completion: 45,000 × 3 = 135,000 total
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
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets,
} = require('../setup/websocket-client');

const {
  initializeGMScannerWithMode,
  getTeamScore,
} = require('../helpers/scanner-init');

// Global state
let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

test.describe('GM Scanner Scoring Parity - Standalone vs Networked', () => {

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
    console.log('Browser launched for scoring parity tests');
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
  // TEST 1: Single Personal Token Parity
  // ========================================

  test('Personal token (sof002) scores identically: 500 points in both modes', async () => {
    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('001');
    await standaloneScanner.confirmTeam();
    await standalonePage.waitForSelector(standaloneScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await standalonePage.waitForTimeout(500);

    // Scan token in standalone mode
    await standalonePage.evaluate((tokenId) => {
      if (!window.UIManager.updateScoreboard) {
        window.UIManager.updateScoreboard = () => {};
      }
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, '001', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_PARITY_PERSONAL',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Parity Test - Personal Token',
          teams: ['002']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const networkedContext = await createBrowserContext(browser, 'mobile');
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const transactionPromise = waitForEvent(
      adminSocket,
      'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === 'sof002',
      10000
    );

    await networkedScanner.enterTeam('002');
    await networkedScanner.confirmTeam();
    await networkedPage.waitForSelector(networkedScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await networkedPage.waitForTimeout(500);

    // Scan token in networked mode
    await networkedPage.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await networkedScanner.waitForResult(5000);
    await transactionPromise;

    const networkedScore = await getTeamScore(networkedPage, '002', 'networked');

    // PARITY CHECK
    expect(standaloneScore).toBe(500);
    expect(networkedScore).toBe(500);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Personal token scored ${standaloneScore} in both modes`);
  });

  // ========================================
  // TEST 2: Business Token with Multiplier Parity
  // ========================================

  test('Business token (rat002) scores identically: 15,000 points in both modes', async () => {
    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('003');
    await standaloneScanner.confirmTeam();
    await standalonePage.waitForSelector(standaloneScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await standalonePage.waitForTimeout(500);

    await standalonePage.evaluate((tokenId) => {
      if (!window.UIManager.updateScoreboard) {
        window.UIManager.updateScoreboard = () => {};
      }
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'rat002');
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, '003', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_PARITY_BUSINESS',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Parity Test - Business Token',
          teams: ['004']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const networkedContext = await createBrowserContext(browser, 'mobile');
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const transactionPromise = waitForEvent(
      adminSocket,
      'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === 'rat002',
      10000
    );

    await networkedScanner.enterTeam('004');
    await networkedScanner.confirmTeam();
    await networkedPage.waitForSelector(networkedScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await networkedPage.waitForTimeout(500);

    await networkedPage.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'rat002');
    await networkedScanner.waitForResult(5000);
    await transactionPromise;

    const networkedScore = await getTeamScore(networkedPage, '004', 'networked');

    // PARITY CHECK
    expect(standaloneScore).toBe(15000);
    expect(networkedScore).toBe(15000);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Business token scored ${standaloneScore} in both modes (3x multiplier)`);
  });

  // ========================================
  // TEST 3: Group Completion Parity
  // ========================================

  test('Group completion (Exposing the Truth x3) scores identically: 135,000 points in both modes', async () => {
    const groupTokens = ['mor002', 'jav002', 'asm002'];

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('005');
    await standaloneScanner.confirmTeam();
    await standalonePage.waitForSelector(standaloneScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await standalonePage.waitForTimeout(500);

    // Scan group tokens in standalone mode
    for (let i = 0; i < groupTokens.length; i++) {
      const tokenId = groupTokens[i];
      await standalonePage.evaluate((tid) => {
        if (!window.UIManager.updateScoreboard) {
          window.UIManager.updateScoreboard = () => {};
        }
        window.App.processNFCRead({
          id: tid,
          source: 'manual',
          raw: tid
        });
      }, tokenId);
      await standaloneScanner.waitForResult(5000);

      if (i < groupTokens.length - 1) {
        await standaloneScanner.continueScan();
      }
    }

    const standaloneScore = await getTeamScore(standalonePage, '005', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_PARITY_GROUP',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Parity Test - Group Completion',
          teams: ['006']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const networkedContext = await createBrowserContext(browser, 'mobile');
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await networkedScanner.enterTeam('006');
    await networkedScanner.confirmTeam();
    await networkedPage.waitForSelector(networkedScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await networkedPage.waitForTimeout(500);

    // Scan group tokens in networked mode
    for (let i = 0; i < groupTokens.length; i++) {
      const tokenId = groupTokens[i];
      const transactionPromise = waitForEvent(
        adminSocket,
        'transaction:new',
        (event) => event.data.transaction && event.data.transaction.tokenId === tokenId,
        10000
      );

      await networkedPage.evaluate((tid) => {
        window.App.processNFCRead({
          id: tid,
          source: 'manual',
          raw: tid
        });
      }, tokenId);
      await networkedScanner.waitForResult(5000);
      await transactionPromise;

      if (i < groupTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    const networkedScore = await getTeamScore(networkedPage, '006', 'networked');

    // PARITY CHECK
    expect(standaloneScore).toBe(135000);
    expect(networkedScore).toBe(135000);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Group completion scored ${standaloneScore} in both modes (3x group multiplier)`);
  });

  // ========================================
  // TEST 4: Mixed Token Sequence Parity
  // ========================================

  test('Mixed token sequence scores identically in both modes', async () => {
    // Test should EXPOSE group multiplier bug in standalone mode
    // mab002 is part of "Marcus Sucks (x2)" group but group is incomplete
    // Expected: Standalone should NOT apply group multiplier (should match networked)
    const mixedTokens = ['sof002', 'rat002', 'mab002']; // Personal + Business + Personal with incomplete group

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('007');
    await standaloneScanner.confirmTeam();
    await standalonePage.waitForSelector(standaloneScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await standalonePage.waitForTimeout(500);

    for (let i = 0; i < mixedTokens.length; i++) {
      const tokenId = mixedTokens[i];
      await standalonePage.evaluate((tid) => {
        if (!window.UIManager.updateScoreboard) {
          window.UIManager.updateScoreboard = () => {};
        }
        window.App.processNFCRead({
          id: tid,
          source: 'manual',
          raw: tid
        });
      }, tokenId);
      await standaloneScanner.waitForResult(5000);

      if (i < mixedTokens.length - 1) {
        await standaloneScanner.continueScan();
      }
    }

    const standaloneScore = await getTeamScore(standalonePage, '007', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_PARITY_MIXED',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Parity Test - Mixed Sequence',
          teams: ['008']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const networkedContext = await createBrowserContext(browser, 'mobile');
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await networkedScanner.enterTeam('008');
    await networkedScanner.confirmTeam();
    await networkedPage.waitForSelector(networkedScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await networkedPage.waitForTimeout(500);

    for (let i = 0; i < mixedTokens.length; i++) {
      const tokenId = mixedTokens[i];
      const transactionPromise = waitForEvent(
        adminSocket,
        'transaction:new',
        (event) => event.data.transaction && event.data.transaction.tokenId === tokenId,
        10000
      );

      await networkedPage.evaluate((tid) => {
        window.App.processNFCRead({
          id: tid,
          source: 'manual',
          raw: tid
        });
      }, tokenId);
      await networkedScanner.waitForResult(5000);
      await transactionPromise;

      if (i < mixedTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    const networkedScore = await getTeamScore(networkedPage, '008', 'networked');

    // PARITY CHECK
    // Expected: sof002 (500) + rat002 (15,000) + mab002 (10,000) = 25,500
    // mab002 is part of incomplete group - should NOT get group bonus in either mode
    // NOTE: This test will FAIL if standalone mode has the group multiplier bug
    const expectedScore = 25500;
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Mixed sequence scored ${standaloneScore} in both modes`);
  });

  // ========================================
  // TEST 5: Duplicate Rejection Parity
  // ========================================

  test('Duplicate rejection behavior matches in both modes', async () => {
    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('009');
    await standaloneScanner.confirmTeam();
    await standalonePage.waitForSelector(standaloneScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await standalonePage.waitForTimeout(500);

    // First scan - should succeed
    await standalonePage.evaluate((tokenId) => {
      if (!window.UIManager.updateScoreboard) {
        window.UIManager.updateScoreboard = () => {};
      }
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await standaloneScanner.waitForResult(5000);
    await standaloneScanner.continueScan();

    // Second scan - should be duplicate
    await standalonePage.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, '009', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'TEST_PARITY_DUPLICATE',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Parity Test - Duplicate',
          teams: ['010']
        }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const networkedContext = await createBrowserContext(browser, 'mobile');
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await networkedScanner.enterTeam('010');
    await networkedScanner.confirmTeam();
    await networkedPage.waitForSelector(networkedScanner.selectors.scanScreen, { state: 'visible', timeout: 5000 });
    await networkedPage.waitForTimeout(500);

    // First scan - should succeed
    await networkedPage.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await networkedScanner.waitForResult(5000);
    await networkedScanner.continueScan();

    // Second scan - should be duplicate
    await networkedPage.evaluate((tokenId) => {
      window.App.processNFCRead({
        id: tokenId,
        source: 'manual',
        raw: tokenId
      });
    }, 'sof002');
    await networkedScanner.waitForResult(5000);

    const networkedScore = await getTeamScore(networkedPage, '010', 'networked');

    // PARITY CHECK - both modes should only count the token once
    expect(standaloneScore).toBe(500);
    expect(networkedScore).toBe(500);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Duplicate rejection behaved identically (final score: ${standaloneScore})`);
  });
});
