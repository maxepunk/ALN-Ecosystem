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
const { ADMIN_PASSWORD } = require('../helpers/test-config');

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

const { selectTestTokens } = require('../helpers/token-selection');
const {
  calculateExpectedScore,
  calculateExpectedGroupBonus,
  calculateExpectedTotalScore,
} = require('../helpers/scoring');

// Global state
let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;  // Dynamically selected tokens

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

    // Dynamically select tokens from production data
    testTokens = await selectTestTokens(orchestratorInfo.url);
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

  test('Personal token scores identically in both modes', async () => {
    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName('Team Alpha');
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Scan token in standalone mode
    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, 'Team Alpha', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
      password: ADMIN_PASSWORD
    });

    const transactionPromise = waitForEvent(
      adminSocket,
      'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === token.SF_RFID,
      10000
    );

    await networkedScanner.enterTeamName('Detectives');
    await networkedScanner.confirmTeam();
    await networkedScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await networkedScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Scan token in networked mode
    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);
    await transactionPromise;

    const networkedScore = await getTeamScore(networkedPage, 'Detectives', 'networked', adminSocket);

    // PARITY CHECK
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Personal token (${token.SF_RFID}) scored $${standaloneScore} in both modes`);
  });

  // ========================================
  // TEST 2: Business Token with Multiplier Parity
  // ========================================

  test('Business token scores identically in both modes', async () => {
    const token = testTokens.businessToken;
    const expectedScore = calculateExpectedScore(token);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName('Blue Squad');
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, 'Blue Squad', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
      password: ADMIN_PASSWORD
    });

    const transactionPromise = waitForEvent(
      adminSocket,
      'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === token.SF_RFID,
      10000
    );

    await networkedScanner.enterTeamName('Red Team');
    await networkedScanner.confirmTeam();
    await networkedScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await networkedScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);
    await transactionPromise;

    const networkedScore = await getTeamScore(networkedPage, '004', 'networked', adminSocket);

    // PARITY CHECK
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Business token (${token.SF_RFID}) scored $${expectedScore.toLocaleString()} in both modes (3x multiplier)`);
  });

  // ========================================
  // TEST 3: Group Completion Parity
  // ========================================

  test('Group completion scores identically in both modes', async () => {
    const groupTokens = testTokens.groupTokens;

    if (groupTokens.length < 2) {
      console.warn('⚠️  Skipping group completion parity test: No group with 2+ tokens found');
      test.skip();
      return;
    }

    // Calculate expected scores using production logic
    const baseScore = groupTokens.reduce((sum, t) => sum + calculateExpectedScore(t), 0);
    const bonus = calculateExpectedGroupBonus(groupTokens);
    const expectedTotal = baseScore + bonus;

    console.log(`Testing group completion parity: ${groupTokens[0].SF_Group}`);
    console.log(`  Tokens: ${groupTokens.map(t => t.SF_RFID).join(', ')}`);
    console.log(`  Base score: $${baseScore.toLocaleString()}`);
    console.log(`  Bonus: $${bonus.toLocaleString()}`);
    console.log(`  Expected total: $${expectedTotal.toLocaleString()}`);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName('Green Team');
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Scan group tokens in standalone mode
    for (let i = 0; i < groupTokens.length; i++) {
      const token = groupTokens[i];
      await standaloneScanner.manualScan(token.SF_RFID);
      await standaloneScanner.waitForResult(5000);

      if (i < groupTokens.length - 1) {
        await standaloneScanner.continueScan();
      }
    }

    const standaloneScore = await getTeamScore(standalonePage, '005', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
      password: ADMIN_PASSWORD
    });

    await networkedScanner.enterTeamName('Yellow Squad');
    await networkedScanner.confirmTeam();
    await networkedScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await networkedScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Scan group tokens in networked mode
    for (let i = 0; i < groupTokens.length; i++) {
      const token = groupTokens[i];
      const transactionPromise = waitForEvent(
        adminSocket,
        'transaction:new',
        (event) => event.data.transaction && event.data.transaction.tokenId === token.SF_RFID,
        10000
      );

      await networkedScanner.manualScan(token.SF_RFID);
      await networkedScanner.waitForResult(5000);
      await transactionPromise;

      if (i < groupTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    const networkedScore = await getTeamScore(networkedPage, '006', 'networked', adminSocket);

    // PARITY CHECK
    expect(standaloneScore).toBe(expectedTotal);
    expect(networkedScore).toBe(expectedTotal);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Group "${groupTokens[0].SF_Group}" scored $${standaloneScore.toLocaleString()} in both modes`);
  });

  // ========================================
  // TEST 4: Mixed Token Sequence Parity
  // ========================================

  test('Mixed token sequence scores identically in both modes', async () => {
    // Test incomplete group handling - scan tokens from group but NOT all of them
    // Expected: No group bonus should be applied in either mode
    const mixedTokens = [
      testTokens.personalToken,
      testTokens.businessToken,
      testTokens.groupTokens.length > 0 ? testTokens.groupTokens[0] : testTokens.technicalToken
    ];

    // Calculate expected score (sum of individual tokens, NO bonus)
    const expectedScore = mixedTokens.reduce((sum, t) => sum + calculateExpectedScore(t), 0);

    console.log('Testing mixed sequence (incomplete group):');
    mixedTokens.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.SF_RFID}: ${t.SF_MemoryType} ${t.SF_ValueRating}⭐ = $${calculateExpectedScore(t).toLocaleString()}${t.SF_Group ? ` (group: ${t.SF_Group})` : ''}`);
    });
    console.log(`  Expected total (no bonus): $${expectedScore.toLocaleString()}`);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName('Purple Crew');
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    for (let i = 0; i < mixedTokens.length; i++) {
      const token = mixedTokens[i];
      await standaloneScanner.manualScan(token.SF_RFID);
      await standaloneScanner.waitForResult(5000);

      if (i < mixedTokens.length - 1) {
        await standaloneScanner.continueScan();
      }
    }

    const standaloneScore = await getTeamScore(standalonePage, '007', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
      password: ADMIN_PASSWORD
    });

    await networkedScanner.enterTeam('008');
    await networkedScanner.confirmTeam();
    await networkedScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await networkedScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    for (let i = 0; i < mixedTokens.length; i++) {
      const token = mixedTokens[i];
      const transactionPromise = waitForEvent(
        adminSocket,
        'transaction:new',
        (event) => event.data.transaction && event.data.transaction.tokenId === token.SF_RFID,
        10000
      );

      await networkedScanner.manualScan(token.SF_RFID);
      await networkedScanner.waitForResult(5000);
      await transactionPromise;

      if (i < mixedTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    const networkedScore = await getTeamScore(networkedPage, '008', 'networked', adminSocket);

    // PARITY CHECK - No group bonus should be applied
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Mixed sequence (incomplete group) scored $${standaloneScore.toLocaleString()} in both modes`);
  });

  // ========================================
  // TEST 5: Duplicate Rejection Parity
  // ========================================

  test('Duplicate rejection behavior matches in both modes', async () => {
    // Use unique token for duplicate detection test
    const token = testTokens.uniqueTokens.length > 0 ? testTokens.uniqueTokens[0] : testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    console.log(`Testing duplicate rejection with token ${token.SF_RFID} (expected score: $${expectedScore.toLocaleString()})`);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeam('009');
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // First scan - should succeed
    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);
    await standaloneScanner.continueScan();

    // Second scan - should be duplicate
    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, '009', 'standalone');

    // NETWORKED MODE
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
      password: ADMIN_PASSWORD
    });

    await networkedScanner.enterTeam('010');
    await networkedScanner.confirmTeam();
    await networkedScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    // Wait for manual entry button ready (replaces arbitrary timeout)
    await networkedScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // First scan - should succeed
    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);
    await networkedScanner.continueScan();

    // Second scan - should be duplicate
    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);

    const networkedScore = await getTeamScore(networkedPage, '010', 'networked', adminSocket);

    // PARITY CHECK - both modes should only count the token once
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Duplicate rejection behaved identically (final score: $${standaloneScore.toLocaleString()})`);
  });
});
