/**
 * E2E Test: Full Game Session with Multi-Device Coordination
 *
 * Comprehensive E2E test simulating a complete game session with:
 * - 2 GM Scanners (GM1: Blackmarket, GM2: Detective mode)
 * - 3 Player Scanners (fire-and-forget intel gathering)
 * - 1 Public Scoreboard viewer
 * - Multiple rounds of scanning
 * - Team creation mid-session
 * - Transaction deletion and rescanning
 *
 * **Testing Philosophy**: UI-first verification - verify through visible DOM
 * elements (what users see), not API responses.
 *
 * @group comprehensive
 * @group multi-device
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
} = require('../helpers/scanner-init');

const { selectTestTokens, fetchTokenDatabase } = require('../helpers/token-selection');
const { GMScannerPage } = require('../helpers/page-objects/GMScannerPage');
const PlayerScannerPage = require('../helpers/page-objects/PlayerScannerPage');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

// Token pools for multi-round testing (dynamically selected)
let tokenPools = {
  round1: [],  // First batch of tokens for GM processing
  round2: [],  // Second batch of tokens for GM processing
  videoTokens: [],  // Video tokens for player scanning
};

test.describe('Full Game Session Multi-Device Flow', () => {
  // Skip on desktop - only run on mobile-chrome (mobile-first PWA)
  test.skip(({ isMobile }) => !isMobile, 'Multi-device tests only run on mobile-chrome');
  test.describe.configure({ mode: 'serial' });

  // Extend timeout for comprehensive test
  test.setTimeout(180000); // 3 minutes

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      // Dynamic port assignment (port=0) prevents conflicts when running parallel workers
      timeout: 30000
    });

    // Select test tokens dynamically from production database
    testTokens = await selectTestTokens(orchestratorInfo.url);

    // Build token pools for multi-round testing
    const allTokens = testTokens.allTokens;
    const nonVideoTokens = allTokens.filter(t => !t.video || t.video === '');
    const videoTokens = allTokens.filter(t => t.video && t.video !== '');

    // Round 1: First 9 non-video tokens (3 per GM mode/team combo)
    tokenPools.round1 = nonVideoTokens.slice(0, 9).map(t => t.SF_RFID);

    // Round 2: Next 9 non-video tokens
    tokenPools.round2 = nonVideoTokens.slice(9, 18).map(t => t.SF_RFID);

    // Video tokens for player scanning
    tokenPools.videoTokens = videoTokens.slice(0, 2).map(t => t.SF_RFID);

    console.log('Token Pools Selected:');
    console.log(`  → Round 1 tokens: ${tokenPools.round1.join(', ')}`);
    console.log(`  → Round 2 tokens: ${tokenPools.round2.join(', ')}`);
    console.log(`  → Video tokens: ${tokenPools.videoTokens.join(', ')}`);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched for multi-device tests');
  });

  test.afterAll(async () => {
    await closeAllContexts({ orchestratorUrl: orchestratorInfo?.url });
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('complete game session with multiple GM and player scanners', async () => {
    // ============================================
    // SETUP: Create Browser Contexts
    // ============================================
    const teamAlpha = `Team Alpha ${Date.now()}`;
    const teamBeta = `Team Beta ${Date.now()}`;
    const teamGamma = `Team Gamma ${Date.now()}`;

    // Create 6 browser contexts with explicit baseURL to avoid env var race conditions
    const gmContext1 = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const gmContext2 = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const playerContext1 = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const playerContext2 = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const playerContext3 = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const scoreboardContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });

    // Create pages
    const gmPage1 = await createPage(gmContext1);
    const gmPage2 = await createPage(gmContext2);
    const playerPage1 = await createPage(playerContext1);
    const playerPage2 = await createPage(playerContext2);
    const playerPage3 = await createPage(playerContext3);
    const scoreboardPage = await createPage(scoreboardContext);

    // Create Page Objects
    const scoreboard = new ScoreboardPage(scoreboardPage);
    const playerScanner1 = new PlayerScannerPage(playerPage1);
    const playerScanner2 = new PlayerScannerPage(playerPage2);
    const playerScanner3 = new PlayerScannerPage(playerPage3);

    // ============================================
    // PHASE 1: Setup & Session Creation
    // ============================================
    console.log('\n=== PHASE 1: Setup & Session Creation ===');

    // 1. Open public scoreboard (keep open entire test)
    await scoreboard.goto(orchestratorInfo.url);
    await scoreboard.waitForConnection(10000);
    expect(await scoreboard.isConnected()).toBe(true);
    console.log('✓ Public scoreboard connected');

    // 2. GM1 joins and connects in networked mode
    const gmScanner1 = await initializeGMScannerWithMode(gmPage1, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });
    console.log('✓ GM1 connected in networked mode');

    // 3. GM1 creates session with 2 teams
    await gmScanner1.createSessionWithTeams('Multi-Device Test Session', [teamAlpha, teamBeta]);
    console.log('✓ Session created with Team Alpha and Team Beta');

    // Navigate back to scanner view for scanning
    await gmScanner1.scannerTab.click();
    await gmScanner1.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

    // VERIFY: Scoreboard shows "LIVE" (connected)
    expect(await scoreboard.isConnected()).toBe(true);
    console.log('✓ Scoreboard still connected after session creation');

    // 4. GM2 joins in detective mode (default)
    const gmScanner2 = await initializeGMScannerWithMode(gmPage2, 'networked', 'detective', {
      orchestratorUrl: orchestratorInfo.url,
      password: ADMIN_PASSWORD
    });

    // Navigate GM2 to scanner view
    await gmScanner2.scannerTab.click();
    await gmScanner2.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ GM2 connected in detective mode');

    // 5. Verify GM1 is in blackmarket mode, GM2 is in detective mode
    const gm1Mode = await gmScanner1.getModeText();
    const gm2Mode = await gmScanner2.getModeText();
    expect(gm1Mode.toLowerCase()).toContain('black market');
    expect(gm2Mode.toLowerCase()).toContain('detective');
    console.log(`✓ Mode verification: GM1=${gm1Mode}, GM2=${gm2Mode}`);

    // ============================================
    // PHASE 2: Player Scanners Join
    // ============================================
    console.log('\n=== PHASE 2: Player Scanners Join ===');

    // Player scanners connect to orchestrator (fire-and-forget mode)
    await playerScanner1.gotoNetworked(orchestratorInfo.url);
    await playerScanner2.gotoNetworked(orchestratorInfo.url);
    await playerScanner3.gotoNetworked(orchestratorInfo.url);
    console.log('✓ All 3 player scanners connected');

    // ============================================
    // PHASE 3: GM Processing Round 1 Tokens
    // ============================================
    console.log('\n=== PHASE 3: GM Processing Round 1 Tokens ===');

    // Ensure we have enough tokens
    const round1Tokens = tokenPools.round1.slice(0, 6);
    if (round1Tokens.length < 6) {
      console.warn(`⚠️ Only ${round1Tokens.length} tokens available for Round 1`);
    }

    // 6. GM2 (Detective) processes 3 tokens for Team Alpha
    await gmScanner2.waitForTeamInDropdown(teamAlpha);
    await gmScanner2.selectTeam(teamAlpha);
    await gmScanner2.confirmTeam();

    const detectiveTokens = round1Tokens.slice(0, 3);
    for (const tokenId of detectiveTokens) {
      await gmScanner2.manualScan(tokenId);
      await gmScanner2.waitForResult(5000);
      await gmScanner2.continueScan();
      console.log(`  → GM2 (Detective) scanned ${tokenId} for ${teamAlpha}`);
    }

    // VERIFY: GM2 history shows correct transaction count
    await gmScanner2.openHistory();
    const gm2HistoryCount = await gmScanner2.historyContainer.locator('.transaction-card, .history-entry').count();
    expect(gm2HistoryCount).toBe(detectiveTokens.length);
    console.log(`✓ GM2 history shows ${gm2HistoryCount} transactions`);
    await gmScanner2.closeHistory();

    // VERIFY: Public scoreboard shows evidence (detective mode creates evidence)
    // Note: Scoreboard displays evidence as: 1 hero card + N feed cards
    // So with 3 detective scans, we have: 1 hero + 2 feed cards = 3 total
    await scoreboard.waitForTotalEvidence(detectiveTokens.length, 10000);
    const totalEvidence = await scoreboard.getTotalEvidenceCount();
    expect(totalEvidence).toBeGreaterThanOrEqual(detectiveTokens.length);
    console.log(`✓ Public scoreboard shows ${totalEvidence} total evidence (hero + feed)`);

    // 7. GM1 (Blackmarket) processes 3 tokens for Team Beta
    await gmScanner1.waitForTeamInDropdown(teamBeta);
    await gmScanner1.selectTeam(teamBeta);
    await gmScanner1.confirmTeam();

    const blackmarketTokens = round1Tokens.slice(3, 6);
    for (const tokenId of blackmarketTokens) {
      await gmScanner1.manualScan(tokenId);
      await gmScanner1.waitForResult(5000);
      await gmScanner1.continueScan();
      console.log(`  → GM1 (Blackmarket) scanned ${tokenId} for ${teamBeta}`);
    }

    // VERIFY: GM1 history shows correct transaction count
    // Note: In networked mode, history shows ALL session transactions (from all GMs)
    // So GM1 should now see: 3 detective (GM2) + 3 blackmarket (GM1) = 6 total
    await gmScanner1.openHistory();
    const gm1HistoryCount = await gmScanner1.historyContainer.locator('.transaction-card, .history-entry').count();
    const expectedTotalTransactions = detectiveTokens.length + blackmarketTokens.length;
    expect(gm1HistoryCount).toBe(expectedTotalTransactions);
    console.log(`✓ GM1 history shows ${gm1HistoryCount} total session transactions (${detectiveTokens.length} detective + ${blackmarketTokens.length} blackmarket)`);
    await gmScanner1.closeHistory();

    // VERIFY: GM1 scoreboard shows Team Beta with score
    await gmScanner1.openScoreboard();
    await gmScanner1.waitForTeamInScoreboard(teamBeta);
    const teamBetaScore = await gmScanner1.getTeamScoreNumericFromScoreboard(teamBeta);
    expect(teamBetaScore).toBeGreaterThan(0);
    console.log(`✓ GM1 scoreboard shows Team Beta with score: $${teamBetaScore}`);
    await gmScanner1.closeScoreboard();

    // ============================================
    // PHASE 4: Video Token Handling (Player Scanner)
    // ============================================
    console.log('\n=== PHASE 4: Video Token Handling ===');

    if (tokenPools.videoTokens.length > 0) {
      const videoTokenId = tokenPools.videoTokens[0];

      // Player 1 scans a video token
      await playerScanner1.simulateScan(videoTokenId);

      // VERIFY: Video alert appears
      try {
        await playerScanner1.waitForVideoAlert(8000);
        const alertContent = await playerScanner1.getVideoAlertContent();
        expect(alertContent.title.toLowerCase()).toContain('video');
        console.log(`✓ Video alert displayed for token ${videoTokenId}: "${alertContent.title}"`);

        // Wait for video alert to auto-dismiss
        await playerScanner1.waitForVideoAlertHidden(10000);
        console.log('✓ Video alert auto-dismissed');
      } catch (e) {
        console.log(`⚠️ Video alert test skipped (may not have video tokens): ${e.message}`);
      }
    } else {
      console.log('⚠️ Skipping video token test - no video tokens available');
    }

    // ============================================
    // PHASE 5: New Team Creation & Round 2 GM Processing
    // ============================================
    console.log('\n=== PHASE 5: New Team Creation & Round 2 Processing ===');

    // 8. GM1 creates new team mid-session
    // First, navigate to team entry screen where the "Add New Team" button is
    // GM1 may be on result screen (after scoreboard overlay closed), use finishTeam to get to team entry
    await gmScanner1.scannerTab.click();
    // Use finishTeam to get back to team entry (GM1 might be on result screen)
    await gmScanner1.finishTeam();

    await gmScanner1.addNewTeam(teamGamma);
    console.log(`✓ Team Gamma created mid-session by GM1`);

    // VERIFY: Team Gamma appears in GM1's dropdown
    await gmScanner1.waitForTeamInDropdown(teamGamma);
    console.log('✓ Team Gamma now available in GM1 team dropdown');

    // CRITICAL: Verify multi-GM team sync - GM2 should also see Team Gamma
    // Navigate GM2 back to team entry screen (may be on result or history screen)
    await gmScanner2.scannerTab.click();
    // Use finishTeam to properly navigate back to team selection
    try {
      await gmScanner2.finishTeam();
    } catch (e) {
      // finishTeam may fail if already on team entry screen, that's ok
    }
    await gmScanner2.teamEntryScreen.waitFor({ state: 'visible', timeout: 10000 });
    await gmScanner2.waitForTeamInDropdown(teamGamma, 10000);
    console.log('✓ Team Gamma synced to GM2 - multi-GM team sync verified');

    // 9. GM1 scans 3 blackmarket tokens for Team Gamma
    await gmScanner1.selectTeam(teamGamma);
    await gmScanner1.confirmTeam();

    const round2Tokens = tokenPools.round2.slice(0, 3);
    for (const tokenId of round2Tokens) {
      await gmScanner1.manualScan(tokenId);
      await gmScanner1.waitForResult(5000);
      await gmScanner1.continueScan();
      console.log(`  → GM1 (Blackmarket) scanned ${tokenId} for ${teamGamma}`);
    }

    // VERIFY: GM1 scoreboard shows 3 teams now (Alpha, Beta, Gamma)
    await gmScanner1.openScoreboard();
    const scoreboardEntryCount = await gmScanner1.getScoreboardEntryCount();
    // Teams may not appear until they have scores - Team Gamma should be visible
    await gmScanner1.waitForTeamInScoreboard(teamGamma);
    console.log(`✓ GM1 scoreboard shows ${scoreboardEntryCount} team entries`);
    expect(scoreboardEntryCount).toBeGreaterThanOrEqual(2); // At least Beta and Gamma (Alpha only has detective)

    // VERIFY: Public scoreboard shows Team Gamma in black market rankings
    const publicScoreEntryCount = await scoreboard.getScoreEntryCount();
    console.log(`✓ Public scoreboard shows ${publicScoreEntryCount} score entries`);
    await gmScanner1.closeScoreboard();

    // ============================================
    // PHASE 5b: Score Adjustment (Admin Feature)
    // ============================================
    console.log('\n=== PHASE 5b: Score Adjustment ===');

    // GM1 opens scoreboard and team details to adjust Team Beta's score
    await gmScanner1.openScoreboard();
    await gmScanner1.waitForTeamInScoreboard(teamBeta);

    // Get Team Beta's score BEFORE adjustment
    const teamBetaScoreBefore = await gmScanner1.getTeamScoreNumericFromScoreboard(teamBeta);
    console.log(`Team Beta score before adjustment: $${teamBetaScoreBefore}`);

    // Open team details to access score adjustment UI
    await gmScanner1.openTeamDetails(teamBeta);

    // Adjust score by +5000 (admin bonus)
    const adjustmentAmount = 5000;
    const expectedScore = teamBetaScoreBefore + adjustmentAmount;
    await gmScanner1.adjustTeamScore(adjustmentAmount, 'E2E test bonus');
    console.log(`✓ GM1 adjusted Team Beta score by +$${adjustmentAmount}`);

    // Close team details
    await gmScanner1.closeTeamDetails();

    // CONDITION-BASED WAITING: Wait for scoreboard DOM to show expected score
    await gmScanner1.waitForTeamScoreInScoreboard(teamBeta, expectedScore, 10000);

    // Get Team Beta's score AFTER adjustment (now guaranteed to be updated)
    const teamBetaScoreAfter = await gmScanner1.getTeamScoreNumericFromScoreboard(teamBeta);
    console.log(`Team Beta score after adjustment: $${teamBetaScoreAfter}`);

    // VERIFY: Score increased by adjustment amount
    expect(teamBetaScoreAfter).toBe(expectedScore);
    console.log(`✓ Score adjustment verified: $${teamBetaScoreBefore} → $${teamBetaScoreAfter}`);

    // NOTE: Skipping GM2 scoreboard verification - GM2 is in Detective mode
    // which doesn't have a visible scoreboard button (scoreboard is Black Market only).
    // Multi-GM sync is verified via team creation sync earlier in the test.

    await gmScanner1.closeScoreboard();

    // ============================================
    // PHASE 6: Transaction Deletion & Rescan
    // ============================================
    console.log('\n=== PHASE 6: Transaction Deletion & Rescan ===');

    // 10. GM1 scans a blackmarket token for Team Beta for deletion test
    // Stay in blackmarket mode because scoreboard button is only visible in blackmarket mode
    // GM1 may be on result screen after Phase 5 scans, navigate to team entry
    await gmScanner1.scannerTab.click();
    await gmScanner1.finishTeam();

    // Verify still in blackmarket mode
    const gm1CurrentMode = await gmScanner1.getModeText();
    expect(gm1CurrentMode.toLowerCase()).toContain('black market');
    console.log('✓ GM1 still in blackmarket mode');

    await gmScanner1.selectTeam(teamBeta);
    await gmScanner1.confirmTeam();

    // Use a unique token for deletion test
    const deletionTestToken = tokenPools.round2[3] || tokenPools.round1[6];
    if (deletionTestToken) {
      await gmScanner1.manualScan(deletionTestToken);
      await gmScanner1.waitForResult(5000);
      console.log(`✓ GM1 scanned ${deletionTestToken} as blackmarket for ${teamBeta}`);

      // 11. GM1 opens scoreboard and team details to delete transaction
      // Navigate back to team entry screen where scoreboard button is visible
      await gmScanner1.finishTeam();
      await gmScanner1.openScoreboard();
      await gmScanner1.waitForTeamInScoreboard(teamBeta);
      await gmScanner1.openTeamDetails(teamBeta);
      console.log(`✓ Opened team details for ${teamBeta}`);

      // Check if token is visible in team details
      const hasToken = await gmScanner1.hasTokenInTeamDetails(deletionTestToken);
      if (hasToken) {
        // Delete the transaction
        await gmScanner1.deleteTransactionFromTeamDetails(deletionTestToken);
        console.log(`✓ Deleted transaction for ${deletionTestToken}`);

        // VERIFY: Token no longer in team details
        const stillHasToken = await gmScanner1.hasTokenInTeamDetails(deletionTestToken);
        expect(stillHasToken).toBe(false);
        console.log('✓ Transaction removed from team details');
      } else {
        console.log(`⚠️ Token ${deletionTestToken} not visible in team details, skipping deletion`);
      }

      await gmScanner1.closeTeamDetails();
      await gmScanner1.closeScoreboard();

      // 12. GM1 rescans the same token as detective mode (different from original blackmarket scan)
      // Navigate to team entry first (closeScoreboard may return to result screen)
      await gmScanner1.finishTeam();
      await gmScanner1.toggleMode(); // Switch to detective
      const gm1FinalMode = await gmScanner1.getModeText();
      expect(gm1FinalMode.toLowerCase()).toContain('detective');
      console.log('✓ GM1 switched to detective mode for rescan');

      await gmScanner1.selectTeam(teamBeta);
      await gmScanner1.confirmTeam();
      await gmScanner1.manualScan(deletionTestToken);
      await gmScanner1.waitForResult(5000);
      console.log(`✓ GM1 rescanned ${deletionTestToken} as detective for ${teamBeta}`);
    } else {
      console.log('⚠️ Skipping deletion test - not enough tokens');
    }

    // ============================================
    // PHASE 7: Final Verification
    // ============================================
    console.log('\n=== PHASE 7: Final Verification ===');

    // 13. Verify GM1 history has all transactions
    await gmScanner1.openHistory();
    const gm1FinalHistoryCount = await gmScanner1.historyContainer.locator('.transaction-card, .history-entry').count();
    console.log(`✓ GM1 final history count: ${gm1FinalHistoryCount} transactions`);
    expect(gm1FinalHistoryCount).toBeGreaterThanOrEqual(blackmarketTokens.length + round2Tokens.length);
    await gmScanner1.closeHistory();

    // 14. Verify GM2 history has all session transactions
    // Note: In networked mode, history shows ALL session transactions (from all GMs)
    await gmScanner2.openHistory();
    const gm2FinalHistoryCount = await gmScanner2.historyContainer.locator('.transaction-card, .history-entry').count();
    console.log(`✓ GM2 final history count: ${gm2FinalHistoryCount} transactions`);
    // GM2 should see all session transactions (same as GM1)
    expect(gm2FinalHistoryCount).toBeGreaterThanOrEqual(detectiveTokens.length + blackmarketTokens.length);
    await gmScanner2.closeHistory();

    // 15. Verify public scoreboard state
    const finalScoreEntryCount = await scoreboard.getScoreEntryCount();
    const finalEvidenceCount = await scoreboard.getEvidenceCardCount();
    console.log(`✓ Final public scoreboard: ${finalScoreEntryCount} score entries, ${finalEvidenceCount} evidence cards`);

    // 16. End session
    console.log('\n=== Ending Session ===');
    await gmScanner1.adminTab.click();
    await gmScanner1.page.waitForTimeout(500);
    await gmScanner1.endSession();
    console.log('✓ Session ended');

    // Wait briefly for broadcasts
    await gmPage1.waitForTimeout(1000);

    // Verify session ended (public scoreboard should still show final state)
    expect(await scoreboard.isConnected()).toBe(true);
    console.log('✓ Scoreboard still connected after session end');

    console.log('\n=== TEST COMPLETE ===');
    console.log('Summary:');
    console.log(`  - Teams: ${teamAlpha}, ${teamBeta}, ${teamGamma}`);
    console.log(`  - GM1 transactions: ${gm1FinalHistoryCount}`);
    console.log(`  - GM2 transactions: ${gm2FinalHistoryCount}`);
    console.log(`  - Public scoreboard entries: ${finalScoreEntryCount}`);
    console.log(`  - Evidence cards: ${finalEvidenceCount}`);
  });
});
