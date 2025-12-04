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
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets,
} = require('../setup/websocket-client');

const {
  initializeGMScannerWithMode,
  getTeamScore,
} = require('../helpers/scanner-init');

const {
  waitForScoreUpdate,
  waitForScoreValue,
} = require('../helpers/wait-conditions');

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

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
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
      ADMIN_PASSWORD,
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
          teams: ['Team Alpha']
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
      password: ADMIN_PASSWORD
    });

    // Verify scanner is on scan screen
    const scanScreenVisible = await page.isVisible('#scanScreen');
    expect(scanScreenVisible).toBe(false); // Should be on team entry

    const teamEntryVisible = await page.isVisible('#teamEntryScreen');
    expect(teamEntryVisible).toBe(true);

    console.log('✓ Networked mode: Scanner connected and session created');
  });

  // ========================================
  // TEST 2: Personal Token Scan
  // ========================================

  test('scans Personal token and backend awards correct points', async () => {
    const token = testTokens.personalToken;
    const expectedScore = calculateExpectedScore(token);

    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
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
          teams: ['Team Alpha']
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
      password: ADMIN_PASSWORD
    });

    // Enter team
    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    // Listen for transaction broadcast (filter by specific token to prevent race conditions)
    const transactionPromise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token.SF_RFID,
      10000
    );

    // Simulate NFC scan (what NFC API would trigger)
    await scanner.manualScan(token.SF_RFID);
    console.log(`NFC scan simulated: ${token.SF_RFID} (${token.SF_MemoryType} ${token.SF_ValueRating}⭐)`);

    await scanner.waitForResult(5000);

    // Wait for backend broadcast
    const txEvent = await transactionPromise;
    expect(txEvent.data).toBeDefined();
    expect(txEvent.data.transaction).toBeDefined();
    expect(txEvent.data.transaction.tokenId).toBe(token.SF_RFID);
    expect(txEvent.data.transaction.status).toBe('accepted');

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    // Verify score via helper (pass socket for authoritative backend query)
    const score = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    expect(score).toBe(expectedScore);

    console.log(`✓ Networked mode: Personal token scored $${expectedScore.toLocaleString()}`);
  });

  // ========================================
  // TEST 3: Business Token with Type Multiplier
  // ========================================

  test('scans Business token and backend applies 3x multiplier', async () => {
    const token = testTokens.businessToken;
    const expectedScore = calculateExpectedScore(token);

    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'TEST_BUSINESS_SCAN',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Business Token',
          teams: ['Team Alpha']
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
      password: ADMIN_PASSWORD
    });

    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    // Listen for transaction broadcast (filter by specific token to prevent race conditions)
    const transactionPromise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token.SF_RFID,
      10000
    );

    // Simulate NFC scan (what NFC API would trigger)
    await scanner.manualScan(token.SF_RFID);
    console.log(`NFC scan simulated: ${token.SF_RFID} (${token.SF_MemoryType} ${token.SF_ValueRating}⭐)`);

    await scanner.waitForResult(5000);

    // Wait for backend broadcast
    const txEvent = await transactionPromise;
    expect(txEvent.data).toBeDefined();
    expect(txEvent.data.transaction).toBeDefined();
    expect(txEvent.data.transaction.tokenId).toBe(token.SF_RFID);
    expect(txEvent.data.transaction.status).toBe('accepted');

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    // Verify score with multiplier applied (pass socket for authoritative backend query)
    const score = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    expect(score).toBe(expectedScore);

    console.log(`✓ Networked mode: Business token scored $${expectedScore.toLocaleString()} (3x multiplier)`);
  });

  // ========================================
  // TEST 4: Group Completion Bonus
  // ========================================

  test('completes group and backend applies multiplier bonus', async () => {
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

    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'TEST_GROUP_COMPLETION',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Group Completion',
          teams: ['Team Alpha']
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
      password: ADMIN_PASSWORD
    });

    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    console.log(`Testing group completion: ${groupTokens[0].SF_Group}`);
    console.log(`  Tokens: ${groupTokens.map(t => t.SF_RFID).join(', ')}`);
    console.log(`  Base score: $${baseScore.toLocaleString()}`);
    console.log(`  Bonus: $${bonus.toLocaleString()}`);
    console.log(`  Expected total: $${expectedTotal.toLocaleString()}`);

    // Listen for group completion event (will fire after last token)
    const groupCompletionPromise = waitForEvent(socket, 'group:completed', null, 15000);

    // Scan all tokens in sequence
    for (let i = 0; i < groupTokens.length; i++) {
      const token = groupTokens[i];

      // Filter for THIS specific token's transaction event (prevent race conditions)
      const transactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === token.SF_RFID,
        10000
      );

      // Simulate NFC scan
      await scanner.manualScan(token.SF_RFID);

      await scanner.waitForResult(5000);

      const txEvent = await transactionPromise;
      expect(txEvent.data.transaction.tokenId).toBe(token.SF_RFID);
      expect(txEvent.data.transaction.status).toBe('accepted');

      console.log(`  Token ${i + 1}/${groupTokens.length} scanned: ${token.SF_RFID}`);

      // Navigate back to scan screen for next token (except after last one)
      if (i < groupTokens.length - 1) {
        await scanner.continueScan();
      }
    }

    // Wait for group completion event
    const groupEvent = await groupCompletionPromise;
    expect(groupEvent.data).toBeDefined();
    expect(groupEvent.data.teamId).toBe('Team Alpha');
    expect(groupEvent.data.bonusPoints).toBe(bonus);
    expect(groupEvent.data.completedAt).toBeDefined();

    // Wait for score:updated event after bonus applied (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    // Verify final score (base + bonus) (pass socket for authoritative backend query)
    const finalScore = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    expect(finalScore).toBe(expectedTotal);

    console.log(`✓ Networked mode: Group completed, bonus applied, $${expectedTotal.toLocaleString()} total`);
  });

  // ========================================
  // TEST 5: Same Team Duplicate Detection
  // ========================================

  test('backend rejects duplicate scan by same team', async () => {
    const token1 = testTokens.personalToken;
    const token2 = testTokens.businessToken;
    const score1 = calculateExpectedScore(token1);
    const score2 = calculateExpectedScore(token2);

    // Create WebSocket connection and session
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'TEST_SAME_TEAM_DUPLICATE',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Same Team Duplicate',
          teams: ['Team Alpha']
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
      password: ADMIN_PASSWORD
    });

    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    // FIRST SCAN: Token should be accepted
    // Listen for broadcast (transaction:new is sent to all GM stations)
    const tx1Promise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token1.SF_RFID,
      10000
    );

    await scanner.manualScan(token1.SF_RFID);

    await scanner.waitForResult(5000);

    const tx1Event = await tx1Promise;
    expect(tx1Event.data.transaction.tokenId).toBe(token1.SF_RFID);
    expect(tx1Event.data.transaction.status).toBe('accepted');

    console.log('✓ First scan accepted and broadcast received');

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    // Verify score after first scan (pass socket for authoritative backend query)
    const scoreAfterFirst = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    expect(scoreAfterFirst).toBe(score1);

    // Navigate back to scan screen for second scan
    await scanner.continueScan();

    // SECOND SCAN: Same team, same token → SHOULD BE REJECTED
    // NOTE: Duplicates are NOT broadcast. Only the scanner receives transaction:result.
    // We verify rejection by checking that score doesn't change and scanner shows result.

    await scanner.manualScan(token1.SF_RFID);

    await scanner.waitForResult(5000);

    console.log('✓ Second scan processed (duplicate expected)');

    // Wait for backend score to stabilize (polls until score === expected value)
    // Using condition-based waiting instead of arbitrary timeout (testing-anti-patterns skill)
    const scoreAfterDuplicate = await waitForScoreValue(page, '001', socket, score1, 2000);
    expect(scoreAfterDuplicate).toBe(score1); // Should still be score1, not doubled

    // Navigate back to scan screen for third scan
    await scanner.continueScan();

    // Verify scanner still functional - scan different token
    const tx3Promise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token2.SF_RFID,
      10000
    );

    await scanner.manualScan(token2.SF_RFID);

    await scanner.waitForResult(5000);

    const tx3Event = await tx3Promise;
    expect(tx3Event.data.transaction.tokenId).toBe(token2.SF_RFID);
    expect(tx3Event.data.transaction.status).toBe('accepted');

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    const finalScore = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    const expectedFinal = score1 + score2;
    expect(finalScore).toBe(expectedFinal); // First + second, duplicate didn't add

    console.log(`✓ Duplicate rejection confirmed: score unchanged, scanner still functional ($${expectedFinal.toLocaleString()} total)`);
  });

  // ========================================
  // TEST 6: Cross-Team Duplicate Detection
  // ========================================

  test('backend rejects duplicate scan by different team', async () => {
    const token1 = testTokens.personalToken;
    const token2 = testTokens.technicalToken;
    const score1 = calculateExpectedScore(token1);
    const score2 = calculateExpectedScore(token2);

    // Create WebSocket connection and session with TWO teams
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      'TEST_DIFFERENT_TEAM_DUPLICATE',
      'gm'
    );

    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Test Session - Different Team Duplicate',
          teams: ['Team Alpha', 'Detectives']  // Both teams for cross-team test
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
      password: ADMIN_PASSWORD
    });

    // TEAM 001: Scan first (should be ACCEPTED)
    await scanner.enterTeamName('Team Alpha');
    await scanner.confirmTeam();

    const tx1Promise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token1.SF_RFID,
      10000
    );

    await scanner.manualScan(token1.SF_RFID);

    await scanner.waitForResult(5000);

    const tx1Event = await tx1Promise;
    expect(tx1Event.data.transaction.tokenId).toBe(token1.SF_RFID);
    expect(tx1Event.data.transaction.teamId).toBe('Team Alpha');
    expect(tx1Event.data.transaction.status).toBe('accepted');

    console.log(`✓ Team 001 scan accepted: $${score1.toLocaleString()}`);

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '001', 2000);

    // Verify Team 001 scored (pass socket for authoritative backend query)
    const score001After1 = await getTeamScore(page, 'Team Alpha', 'networked', socket);
    expect(score001After1).toBe(score1);

    // SWITCH TO TEAM 002
    // finishTeam() works from result screen, returns to team entry
    await scanner.finishTeam();
    await scanner.enterTeamName('Detectives');
    await scanner.confirmTeam();

    console.log('✓ Switched to Team 002');

    // TEAM 002: Try same token (should be REJECTED - first-come-first-served)
    // No broadcast for duplicates - verify via score unchanged
    await scanner.manualScan(token1.SF_RFID);

    await scanner.waitForResult(5000);

    console.log('✓ Team 002 duplicate scan processed');

    // Wait for backend scores to stabilize (condition-based waiting)
    // Team 002 should get 0 (rejected), Team 001 should remain score1 (unchanged)
    const score002After2 = await waitForScoreValue(page, '002', socket, 0, 2000);
    const score001After2 = await waitForScoreValue(page, '001', socket, score1, 2000);

    expect(score001After2).toBe(score1);  // Team 001 unchanged
    expect(score002After2).toBe(0);    // Team 002 got nothing (rejected)

    console.log('✓ Cross-team rejection confirmed: Team 001 blocked Team 002');

    // Navigate back to scan screen for next scan
    await scanner.continueScan();

    // Verify Team 002 still functional - can scan different token
    const tx3Promise = waitForEvent(
      socket,
      'transaction:new',
      (event) => event.data.transaction.tokenId === token2.SF_RFID,
      10000
    );

    await scanner.manualScan(token2.SF_RFID);  // Different token

    await scanner.waitForResult(5000);

    const tx3Event = await tx3Promise;
    expect(tx3Event.data.transaction.tokenId).toBe(token2.SF_RFID);
    expect(tx3Event.data.transaction.teamId).toBe('Detectives');
    expect(tx3Event.data.transaction.status).toBe('accepted');

    // Wait for score:updated event (event-driven, not polling)
    await waitForScoreUpdate(socket, '002', 2000);

    const finalScore002 = await getTeamScore(page, 'Detectives', 'networked', socket);
    expect(finalScore002).toBe(score2);  // Team 002 can score with different token

    console.log(`✓ Team 002 still functional after rejection: $${score2.toLocaleString()} from different token`);
  });
});
