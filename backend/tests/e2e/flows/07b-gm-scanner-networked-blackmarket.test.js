/**
 * E2E Test: GM Scanner Networked Mode - Black Market
 *
 * Comprehensive L3 E2E tests validating full transaction flow:
 * - Scanner initialization in networked mode ✓
 * - WebSocket authentication ✓
 * - Session creation via WebSocket ✓
 * - UI navigation ✓
 * - Transaction submission (scanner → backend via WebSocket) ✓
 * - Type multiplier scoring (Personal 1x, Business 3x, Technical 5x) ✓
 * - Group completion bonuses (variable multipliers) ✓
 * - Duplicate detection (same team & cross-team) ✓
 *
 * Validates NetworkedQueueManager constructor bug fix (config object vs bare client).
 * Uses DYNAMIC token selection - tests work with any production token data.
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
} = require('../helpers/scoring');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;  // Dynamically selected tokens

test.describe('GM Scanner Networked Mode - Black Market', () => {
  let orchestrator;
  let page;

  // Debug helper to capture browser console
  const captureConsole = (p) => {
    p.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`BROWSER [${type}]: ${text}`);
    });
    p.on('pageerror', err => {
      console.log(`BROWSER [pageerror]: ${err.message}`);
    });
  };
  // CRITICAL: Skip on desktop (chromium) project - only run on mobile-chrome
  // The backend only supports ONE active session at a time. With 2 projects
  // (chromium + mobile-chrome) running in parallel workers, both share the same
  // orchestrator instance and create competing sessions. The later session
  // overwrites the earlier one, causing waitForTeamInDropdown to find the wrong team.
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

    // Select test tokens dynamically from production database
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
    console.log('Browser launched for networked mode tests');
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

      console.log(`[beforeEach] Backend state check:`);
      console.log(`  - Session exists: ${!!state.session}`);
      if (state.session) {
        console.log(`  - Session name: ${state.session.name}`);
        console.log(`  - Session status: ${state.session.status}`);
      }

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
  // TEST 1: Scanner Connects in Networked Mode
  // ========================================

  test('connects to orchestrator and initializes in networked mode', async () => {
    // Generate unique team name for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;

    // Initialize scanner UI - this handles connection via browser
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI (browser-only pattern)
    await scanner.createSessionWithTeams('Test Session - Connection', [teamAlpha]);

    // Navigate back to scanner view
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

    // Verify scanner is on team entry screen (session created, ready to select team)
    const teamEntryVisible = await page.isVisible('#teamEntryScreen');
    expect(teamEntryVisible).toBe(true);

    // Verify team appears in dropdown (confirms session sync worked)
    await scanner.waitForTeamInDropdown(teamAlpha);

    console.log('✓ Networked mode: Scanner connected and session created via UI');
  });

  // ========================================
  // TEST 2: Personal Token Scan
  // ========================================

  test('scans Personal token and backend awards correct points', async () => {
    // Generate unique team name for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;

    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI (browser-only pattern)
    await scanner.createSessionWithTeams('Test Session - Single Scan', [teamAlpha]);

    // Navigate to scanner view and select team
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.waitForTeamInDropdown(teamAlpha);
    await scanner.selectTeam(teamAlpha);
    await scanner.confirmTeam();

    // Simulate NFC scan (what NFC API would trigger)
    await scanner.manualScan(token.SF_RFID);
    console.log(`NFC scan simulated: ${token.SF_RFID} (${token.SF_MemoryType} ${token.SF_ValueRating}⭐)`);

    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle = await scanner.getResultTitle();
    expect(resultTitle).not.toContain('Duplicate');
    expect(resultTitle).not.toContain('Error');

    // Wait for backend score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    // Verify score via backend query
    const score = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(score).toBe(expectedScore);

    console.log(`✓ Networked mode: Personal token scored $${expectedScore.toLocaleString()}`);
  });

  // ========================================
  // TEST 3: Business Token with Type Multiplier
  // ========================================

  test('scans Business token and backend applies 3x multiplier', async () => {
    // Generate unique team name for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;

    const token = testTokens.businessToken;
    const expectedScore = calculateExpectedScore(token);

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI (browser-only pattern)
    await scanner.createSessionWithTeams('Test Session - Business Token', [teamAlpha]);

    // Navigate to scanner view and select team
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.waitForTeamInDropdown(teamAlpha);
    await scanner.selectTeam(teamAlpha);
    await scanner.confirmTeam();

    // Simulate NFC scan (what NFC API would trigger)
    await scanner.manualScan(token.SF_RFID);
    console.log(`NFC scan simulated: ${token.SF_RFID} (${token.SF_MemoryType} ${token.SF_ValueRating}⭐)`);

    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle = await scanner.getResultTitle();
    expect(resultTitle).not.toContain('Duplicate');
    expect(resultTitle).not.toContain('Error');

    // Wait for backend score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === expectedScore;
      },
      5000
    );

    // Verify score via backend query
    const score = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(score).toBe(expectedScore);

    console.log(`✓ Networked mode: Business token scored $${expectedScore.toLocaleString()} (3x multiplier)`);
  });

  // ========================================
  // TEST 4: Group Completion Bonus
  // ========================================

  test('completes group and backend applies multiplier bonus', async () => {
    // Generate unique team name for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;

    const groupTokens = testTokens.groupTokens;

    if (groupTokens.length < 2) {
      console.warn('⚠️  Skipping group completion test: No group with 2+ tokens found');
      test.skip();
      return;
    }

    // Calculate expected scores using production logic
    const baseScore = groupTokens.reduce((sum, t) => sum + calculateExpectedScore(t), 0);
    const bonus = calculateExpectedGroupBonus(groupTokens);
    const expectedTotal = baseScore + bonus;

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI (browser-only pattern)
    await scanner.createSessionWithTeams('Test Session - Group Completion', [teamAlpha]);

    // Navigate to scanner view and select team
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.waitForTeamInDropdown(teamAlpha);
    await scanner.selectTeam(teamAlpha);
    await scanner.confirmTeam();

    console.log(`Testing group completion: ${groupTokens[0].SF_Group}`);
    console.log(`  Tokens: ${groupTokens.map(t => t.SF_RFID).join(', ')}`);
    console.log(`  Base score: $${baseScore.toLocaleString()}`);
    console.log(`  Bonus: $${bonus.toLocaleString()}`);
    console.log(`  Expected total: $${expectedTotal.toLocaleString()}`);

    // Scan all tokens in sequence
    for (let i = 0; i < groupTokens.length; i++) {
      const token = groupTokens[i];

      // Simulate NFC scan
      await scanner.manualScan(token.SF_RFID);

      await scanner.waitForResult(5000);

      // Verify transaction accepted via result screen UI
      const resultTitle = await scanner.getResultTitle();
      expect(resultTitle).not.toContain('Duplicate');
      expect(resultTitle).not.toContain('Error');

      console.log(`  Token ${i + 1}/${groupTokens.length} scanned: ${token.SF_RFID}`);

      // Navigate back to scan screen for next token (except after last one)
      if (i < groupTokens.length - 1) {
        await scanner.continueScan();
      }
    }

    // Wait for backend score to reach expected total (includes bonus)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === expectedTotal;
      },
      10000  // Longer timeout for group completion bonus processing
    );

    // Verify final score (base + bonus) via backend query
    const finalScore = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(finalScore).toBe(expectedTotal);

    console.log(`✓ Networked mode: Group completed, bonus applied, $${expectedTotal.toLocaleString()} total`);
  });

  // ========================================
  // TEST 5: Same Team Duplicate Detection
  // ========================================

  test('backend rejects duplicate scan by same team', async () => {
    // Generate unique team name for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;

    const token1 = testTokens.personalToken;
    const token2 = testTokens.businessToken;
    const score1 = calculateExpectedScore(token1);
    const score2 = calculateExpectedScore(token2);
    const expectedFinal = score1 + score2;

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Create session via admin panel UI (browser-only pattern)
    await scanner.createSessionWithTeams('Test Session - Same Team Duplicate', [teamAlpha]);

    // Navigate to scanner view and select team
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    await scanner.waitForTeamInDropdown(teamAlpha);
    await scanner.selectTeam(teamAlpha);
    await scanner.confirmTeam();

    // FIRST SCAN: Token should be accepted
    await scanner.manualScan(token1.SF_RFID);
    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle1 = await scanner.getResultTitle();
    expect(resultTitle1).not.toContain('Duplicate');
    expect(resultTitle1).not.toContain('Error');

    console.log('✓ First scan accepted');

    // Wait for backend score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === score1;
      },
      5000
    );

    // Verify score after first scan
    const scoreAfterFirst = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(scoreAfterFirst).toBe(score1);

    // Navigate back to scan screen for second scan
    await scanner.continueScan();

    // SECOND SCAN: Same team, same token → SHOULD BE REJECTED
    // Duplicates are not broadcast. Verify by checking score doesn't change.
    await scanner.manualScan(token1.SF_RFID);
    await scanner.waitForResult(5000);

    console.log('✓ Second scan processed (duplicate expected)');

    // Verify score unchanged (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        // Score should still be score1, not doubled
        return teamScore?.currentScore === score1;
      },
      2000
    );

    const scoreAfterDuplicate = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(scoreAfterDuplicate).toBe(score1); // Should still be score1, not doubled

    // Navigate back to scan screen for third scan
    await scanner.continueScan();

    // THIRD SCAN: Different token, should be accepted
    await scanner.manualScan(token2.SF_RFID);
    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle3 = await scanner.getResultTitle();
    expect(resultTitle3).not.toContain('Duplicate');
    expect(resultTitle3).not.toContain('Error');

    // Wait for final score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === expectedFinal;
      },
      5000
    );

    const finalScore = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(finalScore).toBe(expectedFinal); // First + third, duplicate didn't add

    console.log(`✓ Duplicate rejection confirmed: score unchanged, scanner still functional ($${expectedFinal.toLocaleString()} total)`);
  });

  // ========================================
  // TEST 6: Cross-Team Duplicate Detection
  // ========================================

  test('backend rejects duplicate scan by different team', async () => {
    // Generate unique team names for test isolation
    const teamAlpha = `Team Alpha ${Date.now()}`;
    const teamDetectives = `Team Detectives ${Date.now()}`;

    const token1 = testTokens.personalToken;
    const token2 = testTokens.technicalToken;
    const score1 = calculateExpectedScore(token1);
    const score2 = calculateExpectedScore(token2);

    // Initialize scanner in networked mode
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Verify logging works
    await page.evaluate(() => console.log("TEST CONSOLE LOG - IF YOU SEE THIS, LOGGING WORKS"));

    // Create new session via Admin Panel
    await scanner.createSessionWithTeams('Test Session - Cross Team Duplicate', [teamAlpha, teamDetectives]);

    // Navigate to scanner view
    await scanner.scannerTab.click();
    await scanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

    // TEAM ALPHA: Scan first (should be ACCEPTED)
    await scanner.waitForTeamInDropdown(teamAlpha);
    await scanner.selectTeam(teamAlpha);
    await scanner.confirmTeam();

    await scanner.manualScan(token1.SF_RFID);
    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle1 = await scanner.getResultTitle();
    expect(resultTitle1).not.toContain('Duplicate');
    expect(resultTitle1).not.toContain('Error');

    console.log(`✓ Team Alpha scan accepted: $${score1.toLocaleString()}`);

    // Wait for backend score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const teamScore = state.scores?.find(s => s.teamId === teamAlpha);
        return teamScore?.currentScore === score1;
      },
      5000
    );

    // Verify Team Alpha scored
    const scoreAlphaAfter1 = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    expect(scoreAlphaAfter1).toBe(score1);

    // SWITCH TO TEAM DETECTIVES
    // finishTeam() works from result screen, returns to team entry
    await scanner.finishTeam();
    await scanner.waitForTeamInDropdown(teamDetectives);
    await scanner.selectTeam(teamDetectives);
    await scanner.confirmTeam();

    console.log('✓ Switched to Team Detectives');

    // TEAM DETECTIVES: Try same token (should be REJECTED - first-come-first-served)
    await scanner.manualScan(token1.SF_RFID);
    await scanner.waitForResult(5000);

    console.log('✓ Team Detectives duplicate scan processed');

    // Verify scores via backend (condition-based polling)
    // Team Detectives should get 0 (rejected), Team Alpha should remain unchanged
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const alphaScore = state.scores?.find(s => s.teamId === teamAlpha);
        const detectivesScore = state.scores?.find(s => s.teamId === teamDetectives);
        // Alpha unchanged at score1, Detectives got 0
        return alphaScore?.currentScore === score1 &&
          (detectivesScore?.currentScore === 0 || !detectivesScore);
      },
      2000
    );

    const scoreAlphaAfter2 = await getTeamScore(page, teamAlpha, 'networked', orchestratorInfo.url);
    const scoreDetectivesAfter2 = await getTeamScore(page, teamDetectives, 'networked', orchestratorInfo.url);

    expect(scoreAlphaAfter2).toBe(score1);  // Team Alpha unchanged
    expect(scoreDetectivesAfter2).toBe(0);  // Team Detectives got nothing (rejected)

    console.log('✓ Cross-team rejection confirmed: Team Alpha blocked Team Detectives');

    // Navigate back to scan screen for next scan
    await scanner.continueScan();

    // TEAM DETECTIVES: Scan different token (should be ACCEPTED)
    await scanner.manualScan(token2.SF_RFID);
    await scanner.waitForResult(5000);

    // Verify transaction accepted via result screen UI
    const resultTitle3 = await scanner.getResultTitle();
    expect(resultTitle3).not.toContain('Duplicate');
    expect(resultTitle3).not.toContain('Error');

    // Wait for backend score update (condition-based polling)
    await scanner.waitForBackendState(
      orchestratorInfo.url,
      (state) => {
        const detectivesScore = state.scores?.find(s => s.teamId === teamDetectives);
        return detectivesScore?.currentScore === score2;
      },
      5000
    );

    const finalScoreDetectives = await getTeamScore(page, teamDetectives, 'networked', orchestratorInfo.url);
    expect(finalScoreDetectives).toBe(score2);  // Team Detectives can score with different token

    console.log(`✓ Team Detectives still functional after rejection: $${score2.toLocaleString()} from different token`);
  });
});
