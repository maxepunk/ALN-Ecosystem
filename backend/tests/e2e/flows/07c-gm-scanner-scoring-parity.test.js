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
  // CRITICAL: Skip on desktop (chromium) project - only run on mobile-chrome
  // The backend only supports ONE active session at a time. With 2 projects
  // (chromium + mobile-chrome) running in parallel workers, both share the same
  // orchestrator instance and create competing sessions. The later session
  // overwrites the earlier one, causing test failures.
  //
  // serial mode only affects tests within a single project - it doesn't prevent
  // parallel execution across different projects. We skip desktop since this is
  // a mobile-first PWA and mobile-chrome better represents the target platform.
  //
  // NOTE: browserName === 'chromium' for BOTH projects (mobile-chrome uses Chromium engine)
  // Use isMobile fixture to distinguish between desktop and mobile viewports.
  test.skip(({ isMobile }) => !isMobile, 'Session-based tests only run on mobile-chrome (mobile-first PWA)');
  test.describe.configure({ mode: 'serial' });

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
    console.log('Browser launched for scoring parity tests');

    // Dynamically select tokens from production data
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterAll(async () => {
    await closeAllContexts({ orchestratorUrl: orchestratorInfo?.url });
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test.beforeEach(async ({ }, testInfo) => {
    // Fast-fail verification: ensure no session exists from previous test
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[beforeEach] Starting test: ${testInfo.title}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const response = await fetch(`${orchestratorInfo.url}/api/state`, {
        headers: { 'Accept': 'application/json' },
        agent: new (require('https').Agent)({ rejectUnauthorized: false })
      });
      const state = await response.json();

      if (state.session && state.session.status !== 'ended') {
        throw new Error(
          `TEST ISOLATION FAILURE: Session "${state.session.name}" still exists. ` +
          `afterEach cleanup did not work properly.`
        );
      }
      console.log(`[beforeEach] ✓ No active session - test isolation verified`);
    } catch (error) {
      if (error.message.includes('TEST ISOLATION FAILURE')) {
        throw error;
      }
      console.log(`[beforeEach] Warning: Could not verify backend state: ${error.message}`);
    }
  });

  test.afterEach(async ({ }, testInfo) => {
    console.log(`\n[afterEach] Cleaning up after: ${testInfo.title}`);
    console.log(`[afterEach] Test status: ${testInfo.status}`);

    // Close all browser contexts first
    console.log(`[afterEach] Closing all browser contexts...`);
    await closeAllContexts({ orchestratorUrl: orchestratorInfo?.url });

    // Restart orchestrator for clean state (required because in-memory sessions persist)
    console.log(`[afterEach] Stopping orchestrator...`);
    await stopOrchestrator();
    await clearSessionData();
    console.log(`[afterEach] Starting fresh orchestrator...`);
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000
    });
    console.log(`[afterEach] ✓ Orchestrator restarted for test isolation`);
  });

  // ========================================
  // TEST 1: Single Personal Token Parity
  // ========================================

  test('Personal token scores identically in both modes', async () => {
    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);
    const parityTeam = `ParityP_${Date.now()}`;

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName(parityTeam);
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, parityTeam, 'standalone');

    // NETWORKED MODE (browser-only pattern)
    const networkedContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI
    await networkedScanner.createSessionWithTeams('Parity Test - Personal Token', [parityTeam]);

    // Navigate to scanner view and select team
    await networkedScanner.scannerTab.click();
    await networkedScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await networkedScanner.waitForTeamInDropdown(parityTeam);
    await networkedScanner.selectTeam(parityTeam);
    await networkedScanner.confirmTeam();

    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);

    // Wait for backend score update (condition-based polling)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    const networkedScore = await getTeamScore(networkedPage, parityTeam, 'networked', orchestratorInfo.url);

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
    const parityTeam = `ParityB_${Date.now()}`;

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName(parityTeam);
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, parityTeam, 'standalone');

    // NETWORKED MODE (browser-only pattern)
    const networkedContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI
    await networkedScanner.createSessionWithTeams('Parity Test - Business Token', [parityTeam]);

    // Navigate to scanner view and select team
    await networkedScanner.scannerTab.click();
    await networkedScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await networkedScanner.waitForTeamInDropdown(parityTeam);
    await networkedScanner.selectTeam(parityTeam);
    await networkedScanner.confirmTeam();

    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);

    // Wait for backend score update (condition-based polling)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    const networkedScore = await getTeamScore(networkedPage, parityTeam, 'networked', orchestratorInfo.url);

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

    const parityTeam = `ParityG_${Date.now()}`;

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

    await standaloneScanner.enterTeamName(parityTeam);
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
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

    const standaloneScore = await getTeamScore(standalonePage, parityTeam, 'standalone');

    // NETWORKED MODE (browser-only pattern)
    const networkedContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI
    await networkedScanner.createSessionWithTeams('Parity Test - Group Completion', [parityTeam]);

    // Navigate to scanner view and select team
    await networkedScanner.scannerTab.click();
    await networkedScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await networkedScanner.waitForTeamInDropdown(parityTeam);
    await networkedScanner.selectTeam(parityTeam);
    await networkedScanner.confirmTeam();

    // Scan group tokens in networked mode
    for (let i = 0; i < groupTokens.length; i++) {
      const token = groupTokens[i];

      await networkedScanner.manualScan(token.SF_RFID);
      await networkedScanner.waitForResult(5000);

      if (i < groupTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    // Wait for backend score update with group bonus (condition-based polling)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        return teamScore?.currentScore === expectedTotal;
      },
      10000  // Longer timeout for group completion bonus processing
    );

    const networkedScore = await getTeamScore(networkedPage, parityTeam, 'networked', orchestratorInfo.url);

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
    const parityTeam = `ParityM_${Date.now()}`;

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

    await standaloneScanner.enterTeamName(parityTeam);
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    for (let i = 0; i < mixedTokens.length; i++) {
      const token = mixedTokens[i];
      await standaloneScanner.manualScan(token.SF_RFID);
      await standaloneScanner.waitForResult(5000);

      if (i < mixedTokens.length - 1) {
        await standaloneScanner.continueScan();
      }
    }

    const standaloneScore = await getTeamScore(standalonePage, parityTeam, 'standalone');

    // NETWORKED MODE (browser-only pattern)
    const networkedContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI
    await networkedScanner.createSessionWithTeams('Parity Test - Mixed Sequence', [parityTeam]);

    // Navigate to scanner view and select team
    await networkedScanner.scannerTab.click();
    await networkedScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await networkedScanner.waitForTeamInDropdown(parityTeam);
    await networkedScanner.selectTeam(parityTeam);
    await networkedScanner.confirmTeam();

    for (let i = 0; i < mixedTokens.length; i++) {
      const token = mixedTokens[i];

      await networkedScanner.manualScan(token.SF_RFID);
      await networkedScanner.waitForResult(5000);

      if (i < mixedTokens.length - 1) {
        await networkedScanner.continueScan();
      }
    }

    // Wait for backend score update (condition-based polling)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    const networkedScore = await getTeamScore(networkedPage, parityTeam, 'networked', orchestratorInfo.url);

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
    const parityTeam = `ParityD_${Date.now()}`;

    console.log(`Testing duplicate rejection with token ${token.SF_RFID} (expected score: $${expectedScore.toLocaleString()})`);

    // STANDALONE MODE
    const standaloneContext = await createBrowserContext(browser, 'mobile');
    const standalonePage = await createPage(standaloneContext);
    const standaloneScanner = await initializeGMScannerWithMode(standalonePage, 'standalone', 'blackmarket');

    await standaloneScanner.enterTeamName(parityTeam);
    await standaloneScanner.confirmTeam();
    await standaloneScanner.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
    await standaloneScanner.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

    // First scan - should succeed
    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);
    await standaloneScanner.continueScan();

    // Second scan - should be duplicate
    await standaloneScanner.manualScan(token.SF_RFID);
    await standaloneScanner.waitForResult(5000);

    const standaloneScore = await getTeamScore(standalonePage, parityTeam, 'standalone');

    // NETWORKED MODE (browser-only pattern)
    const networkedContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const networkedPage = await createPage(networkedContext);
    const networkedScanner = await initializeGMScannerWithMode(networkedPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI
    await networkedScanner.createSessionWithTeams('Parity Test - Duplicate', [parityTeam]);

    // Navigate to scanner view and select team
    await networkedScanner.scannerTab.click();
    await networkedScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await networkedScanner.waitForTeamInDropdown(parityTeam);
    await networkedScanner.selectTeam(parityTeam);
    await networkedScanner.confirmTeam();

    // First scan - should succeed
    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);

    // Wait for backend score update (first scan)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    await networkedScanner.continueScan();

    // Second scan - should be duplicate (score should remain unchanged)
    await networkedScanner.manualScan(token.SF_RFID);
    await networkedScanner.waitForResult(5000);

    // Verify score unchanged after duplicate (condition-based polling)
    await networkedScanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === parityTeam);
        // Score should still be expectedScore, not doubled
        return teamScore?.currentScore === expectedScore;
      },
      2000
    );

    const networkedScore = await getTeamScore(networkedPage, parityTeam, 'networked', orchestratorInfo.url);

    // PARITY CHECK - both modes should only count the token once
    expect(standaloneScore).toBe(expectedScore);
    expect(networkedScore).toBe(expectedScore);
    expect(standaloneScore).toBe(networkedScore);

    console.log(`✓ PARITY VERIFIED: Duplicate rejection behaved identically (final score: $${standaloneScore.toLocaleString()})`);
  });
});
