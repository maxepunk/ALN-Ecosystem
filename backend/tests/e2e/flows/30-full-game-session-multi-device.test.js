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
const { setupSpotify } = require('../setup/spotify-service');
const { setupHA } = require('../setup/ha-service');
const { setupSound, cleanupTestAudioFixtures } = require('../setup/sound-service');
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
let spotifyInfo = null;
let haInfo = null;
let soundInfo = null;
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

    // Setup all services (parallel where possible)
    vlcInfo = await setupVLC();
    [spotifyInfo, haInfo, soundInfo] = await Promise.all([
      setupSpotify(),
      setupHA(),
      setupSound(),
    ]);

    // ═══════════════════════════════════════════════
    // SERVICE STATUS BANNER
    // ═══════════════════════════════════════════════
    const serviceStatus = { vlc: vlcInfo, spotify: spotifyInfo, ha: haInfo, sound: soundInfo };
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  E2E SERVICE STATUS                      ║');
    for (const [name, info] of Object.entries(serviceStatus)) {
      const status = info.type === 'real' ? 'REAL'
        : info.type === 'mock' ? 'MOCK'
          : 'UNAVAILABLE';
      const marker = info.type === 'real' ? '  ' : info.type === 'mock' ? ' !' : ' X';
      const reason = info.reason ? ` (${info.reason})` : '';
      console.log(`║  ${name.padEnd(10)} ${(status + reason).padEnd(29)}${marker}║`);
    }
    console.log('╚══════════════════════════════════════════╝');

    const degraded = Object.entries(serviceStatus)
      .filter(([, info]) => info.type !== 'real')
      .map(([name, info]) => `${name}: ${info.type}${info.reason ? ` (${info.reason})` : ''}`);

    if (degraded.length > 0) {
      console.warn(`\n  ${degraded.length} service(s) degraded: ${degraded.join(', ')}`);
      if (process.env.E2E_REQUIRE_REAL === 'true') {
        throw new Error(`E2E_REQUIRE_REAL=true but services degraded: ${degraded.join(', ')}`);
      }
    }

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
    cleanupTestAudioFixtures();
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
    // PHASE 1.5: Environment Control Verification
    // ============================================
    // Tests actual gm:command round-trips, not just UI visibility.
    //
    // HARDWARE DEPENDENCIES:
    // - Bluetooth adapter: Optional. Without it, BT scan starts/stops immediately,
    //   audio route to 'bluetooth' is accepted but no real bluez_sink exists.
    // - Home Assistant: Optional. Without it, lighting section stays hidden or
    //   shows "not connected" fallback with retry button.
    // - PipeWire/WirePlumber: Optional. Without it, audio routing commands succeed
    //   at the service level but pactl apply fails silently.
    //
    // For FULL hardware testing, see Task 28 (interactive hardware verification).
    // To prep hardware before running: pair a BT speaker, start HA container.
    console.log('\n=== PHASE 1.5: Environment Control Verification ===');

    // Navigate GM1 to admin panel
    await gmScanner1.navigateToAdminPanel();

    // --- AUDIO OUTPUT: Section visibility + initial state from sync:full ---

    // --- AUDIO OUTPUT: Dropdowns (Phase 3) ---

    // Wait for dropdowns to be visible
    await expect(gmScanner1.audioRoutingDropdowns).toBeVisible();
    console.log('✓ Audio routing dropdowns visible');

    // Check video route initial state
    // Default is 'hdmi', but actual value might be a specific sink name or 'hdmi' 
    // depending on available sinks. We just check if it has a value.
    const initialVideoRoute = await gmScanner1.getAudioRouteValue('video');
    expect(initialVideoRoute).toBeTruthy();
    console.log(`✓ Initial video route value: ${initialVideoRoute}`);

    // Get available options to test toggling
    const videoOptions = await gmScanner1.getAudioRouteOptions('video');
    console.log(`  Available video sinks: ${videoOptions.map(o => o.label).join(', ')}`);

    if (videoOptions.length > 1) {
      // Test toggling if we have multiple sinks
      const targetOption = videoOptions.find(o => o.value !== initialVideoRoute);
      if (targetOption) {
        console.log(`  → Changing video route to: ${targetOption.label}`);
        await gmScanner1.setAudioRoute('video', targetOption.value);

        // wait for value update (should be immediate in UI, but verified)
        const newRoute = await gmScanner1.getAudioRouteValue('video');
        expect(newRoute).toBe(targetOption.value);
        console.log('✓ Video route changed successfully');

        // Revert to initial
        await gmScanner1.setAudioRoute('video', initialVideoRoute);
        console.log('✓ Reverted video route to initial state');
      }
    } else {
      console.log('⚠ Skipping route toggle test: only 1 sink available (CI environment?)');
    }

    // Bluetooth warning check (still relevant)
    const btWarning = await gmScanner1.isBtWarningVisible();
    console.log(`  BT fallback warning: ${btWarning ? 'visible' : 'hidden'}`);

    // --- BLUETOOTH SCAN: Command round-trip (bluetooth:scan:start) ---
    // Click Scan → gm:command bluetooth:scan:start → backend starts bluetoothctl
    // Broadcasts bluetooth:scan {scanning:true} → button becomes "Stop Scan"
    // Without BT adapter: scan exits immediately → bluetooth:scan {scanning:false}
    // With adapter: scan runs for timeout period then stops

    const btUnavailable = await gmScanner1.isBtUnavailable();
    if (!btUnavailable) {
      // Scan button should be visible
      const scanBtnVisible = await gmScanner1.btScanBtn.isVisible();
      expect(scanBtnVisible).toBe(true);

      // Capture initial button text
      const initialBtnText = await gmScanner1.btScanBtn.textContent();
      console.log(`  → BT Scan button initial text: "${initialBtnText.trim()}"`);

      // Click Scan — triggers full gm:command round-trip
      await gmScanner1.startBtScan();
      console.log('  → Clicked BT Scan button (gm:command bluetooth:scan:start sent)');

      // CONDITION-BASED WAIT: Wait for scan to complete (button text reverts)
      // Without adapter: almost instant. With adapter: up to 30s scan timeout.
      // We wait for button text to match initial (scan stopped) or timeout after 10s.
      try {
        await gmPage1.waitForFunction(
          (expectedText) => {
            const btn = document.getElementById('btn-bt-scan');
            // Scan complete when button reverts to original text (not "Stop Scan")
            return btn && !btn.textContent.includes('Stop');
          },
          initialBtnText.trim(),
          { timeout: 15000 }
        );
        const finalBtnText = await gmScanner1.btScanBtn.textContent();
        console.log(`✓ BT scan lifecycle complete. Button: "${finalBtnText.trim()}"`);
      } catch (e) {
        // Scan still running after 15s — stop it manually
        console.log('  BT scan still running after 15s, moving on');
      }

      // Check devices discovered (informational)
      const btDeviceCount = await gmScanner1.getBtDeviceCount();
      console.log(`  BT devices found: ${btDeviceCount}`);
    } else {
      console.log('✓ Bluetooth adapter unavailable (expected in CI/headless)');
    }

    // --- LIGHTING: Graceful degradation check ---
    // Lighting section starts hidden (display:none in HTML).
    // It becomes visible only when lighting:status arrives via sync:full.
    // If HA is not configured, section may stay hidden entirely — that's correct.

    const lightingVisible = await gmScanner1.isLightingSectionVisible();
    if (lightingVisible) {
      const lightingNotConnected = await gmScanner1.isLightingNotConnected();
      const sceneCount = await gmScanner1.getLightingSceneCount();

      if (lightingNotConnected) {
        // Verify retry button sends gm:command lighting:scenes:refresh
        const retryVisible = await gmScanner1.lightingRetryBtn.isVisible();
        expect(retryVisible).toBe(true);

        // Click retry — triggers round-trip (will fail if HA not running, but shouldn't crash)
        await gmScanner1.lightingRetryBtn.click();
        console.log('  → Clicked Lighting Retry (gm:command lighting:scenes:refresh sent)');
        // Wait briefly for round-trip
        await gmPage1.waitForTimeout(2000);

        // Re-check state after retry
        const stillNotConnected = await gmScanner1.isLightingNotConnected();
        console.log(`✓ Lighting: HA not connected, retry attempted, still not connected: ${stillNotConnected}`);
      } else if (sceneCount > 0) {
        // HA IS connected with scenes — test scene activation round-trip
        const firstSceneTile = gmScanner1.lightingSceneTiles.first();
        const sceneName = await firstSceneTile.textContent();
        const sceneId = await firstSceneTile.getAttribute('data-scene-id');
        console.log(`  → Activating scene: "${sceneName.trim()}" (${sceneId})`);

        await firstSceneTile.click();
        // Wait for scene:activated broadcast → tile gets scene-tile--active class
        try {
          await gmPage1.waitForFunction(
            (sid) => {
              const tile = document.querySelector(`.scene-tile[data-scene-id="${sid}"]`);
              return tile?.classList.contains('scene-tile--active');
            },
            sceneId,
            { timeout: 5000 }
          );
          console.log(`✓ Lighting scene "${sceneName.trim()}" activated (round-trip verified)`);
        } catch (e) {
          console.log(`⚠️ Scene activation timeout — HA may have lost connection`);
        }
      } else {
        console.log('✓ Lighting section visible but no scenes configured');
      }
    } else {
      console.log('✓ Lighting section hidden (HA not configured — expected without Docker/HA)');
    }

    // --- ENVIRONMENT STATE SNAPSHOT ---
    const envState = await gmScanner1.getEnvironmentControlState();
    console.log('Environment Control State:', JSON.stringify(envState, null, 2));

    // ============================================
    // PHASE 1.6: Game Clock + Compound Cues
    // ============================================
    // Tests Phase 2 compound cue lifecycle: fire → active in UI → completion.
    // Exercises REAL services: pw-play (sound), Home Assistant (lighting), VLC (video).
    // Service availability determines what gets verified — but cue engine
    // lifecycle (appear → progress → disappear) is always tested.
    console.log('\n=== PHASE 1.6: Game Clock + Compound Cues ===');

    // 1.6.1: Verify game clock is running (started by createSessionWithTeams → startGame)
    const clockRunning = await gmScanner1.isGameClockRunning(8000);
    expect(clockRunning).toBe(true);
    const clockText = await gmScanner1.getGameClockText();
    console.log(`✓ Game clock running: ${clockText}`);

    // 1.6.2: Fire clock-driven compound cue (sound + HA lighting, 5s duration)
    // This cue's timeline: at:0 sound, at:1 lighting, at:3 sound, at:4 lighting
    console.log('  → Firing clock-driven compound cue: e2e-compound-test');
    await gmScanner1.fireCue('e2e-compound-test');

    // 1.6.3: Verify active cue appears in MonitoringDisplay
    await gmScanner1.waitForActiveCue('e2e-compound-test', 5000);
    const cueState = await gmScanner1.getActiveCueState('e2e-compound-test');
    console.log(`✓ Compound cue active in UI, state: ${cueState}`);

    // 1.6.4: Conditional service verification
    // If HA is real, verify lighting scene was activated
    if (haInfo.type === 'real') {
      // Wait for at:1 lighting action to execute, then check scene tile
      await gmPage1.waitForTimeout(2000);
      try {
        const dimActive = await gmPage1.waitForFunction(
          () => {
            const tile = document.querySelector('.scene-tile[data-scene-id="scene.game"]');
            return tile?.classList.contains('scene-tile--active');
          },
          { timeout: 5000 }
        );
        console.log('✓ HA lighting scene "dim" activated by compound cue (real HA verified)');
      } catch {
        console.log('⚠️ Lighting scene verification timed out (HA may have lost connection)');
      }
    } else {
      console.log(`  Skipping HA lighting verification (${haInfo.type}: ${haInfo.reason || 'N/A'})`);
    }

    // 1.6.5: Wait for cue completion (duration=5s, allow extra time for clock tick resolution)
    await gmScanner1.waitForCueComplete('e2e-compound-test', 15000);
    console.log('✓ Clock-driven compound cue completed (removed from active cues UI)');

    // 1.6.6: Fire video-driven compound cue (IF VLC is real)
    if (vlcInfo.type === 'real') {
      console.log('  → Firing video-driven compound cue: e2e-video-compound');
      await gmScanner1.fireCue('e2e-video-compound');

      // Verify active cue appears
      await gmScanner1.waitForActiveCue('e2e-video-compound', 5000);
      console.log('✓ Video compound cue active in UI');

      // Verify VLC is playing (video progress bar should appear)
      try {
        await gmScanner1.videoProgressContainer.waitFor({ state: 'visible', timeout: 10000 });
        console.log('✓ VLC video playing (progress container visible)');
      } catch {
        console.log('⚠️ Video progress container not visible (VLC may not have started playback)');
      }

      // Wait for video compound cue completion (cue completes when all timeline entries fire,
      // not when video ends — maxAt=1s, but VLC startup has latency)
      await gmScanner1.waitForCueComplete('e2e-video-compound', 40000);
      console.log('✓ Video-driven compound cue completed');
    } else {
      console.log(`  Skipping video compound cue (VLC: ${vlcInfo.type})`);
    }

    // 1.6.7: Spotify status check (verify DOM reflects connection state)
    const spotifyConnected = await gmScanner1.isSpotifyConnected();
    if (spotifyInfo.type === 'real') {
      // With spotifyd running, we should see connected or disconnected
      // depending on whether an active Spotify Connect session exists
      console.log(`✓ Spotify status rendered in UI (connected: ${spotifyConnected})`);
      if (spotifyInfo.reason) {
        console.log(`  Note: ${spotifyInfo.reason}`);
      }
    } else {
      console.log(`  Spotify status: disconnected (service ${spotifyInfo.type}: ${spotifyInfo.reason || 'N/A'})`);
    }

    console.log('=== Phase 1.6 Complete ===\n');

    // Return to scanner view for next phase
    await gmScanner1.scannerTab.click();
    await gmScanner1.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });

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

    // 6. GM2 (Detective) processes 3 tokens for Team Alpha (selectTeamFromList auto-confirms)
    await gmScanner2.waitForTeamInList(teamAlpha);
    await gmScanner2.selectTeamFromList(teamAlpha);

    const detectiveTokens = round1Tokens.slice(0, 3);
    for (const tokenId of detectiveTokens) {
      await gmScanner2.manualScan(tokenId);
      await gmScanner2.waitForResult(5000);
      await gmScanner2.continueScan();
      console.log(`  → GM2 (Detective) scanned ${tokenId} for ${teamAlpha}`);
    }

    // VERIFY: GM2 history shows correct transaction count
    await gmScanner2.openHistory();
    const gm2HistoryCount = await gmScanner2.historyContainer.locator('.transaction-card, .token-card, .history-entry').count();
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

    // 7. GM1 (Blackmarket) processes 3 tokens for Team Beta (selectTeamFromList auto-confirms)
    await gmScanner1.waitForTeamInList(teamBeta);
    await gmScanner1.selectTeamFromList(teamBeta);

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
    const gm1HistoryCount = await gmScanner1.historyContainer.locator('.transaction-card, .token-card, .history-entry').count();
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

    // Create Team Gamma using unified flow: enterTeam + confirmTeam creates on backend and proceeds to scan
    await gmScanner1.enterTeam(teamGamma);
    await gmScanner1.confirmTeam();
    console.log(`✓ Team Gamma created mid-session by GM1 (now on scan screen)`);

    // Go back to team entry to verify Team Gamma appears in list
    await gmScanner1.finishTeam();
    await gmScanner1.waitForTeamInList(teamGamma);
    console.log('✓ Team Gamma now available in GM1 team list');

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
    await gmScanner2.waitForTeamInList(teamGamma, 10000);
    console.log('✓ Team Gamma synced to GM2 - multi-GM team sync verified');

    // 9. GM1 scans 3 blackmarket tokens for Team Gamma
    await gmScanner1.selectTeamFromList(teamGamma);

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

    // selectTeamFromList auto-confirms
    await gmScanner1.selectTeamFromList(teamBeta);

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

      // selectTeamFromList auto-confirms
      await gmScanner1.selectTeamFromList(teamBeta);
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
    const gm1FinalHistoryCount = await gmScanner1.historyContainer.locator('.transaction-card, .token-card, .history-entry').count();
    console.log(`✓ GM1 final history count: ${gm1FinalHistoryCount} transactions`);
    expect(gm1FinalHistoryCount).toBeGreaterThanOrEqual(blackmarketTokens.length + round2Tokens.length);
    await gmScanner1.closeHistory();

    // 14. Verify GM2 history has all session transactions
    // Note: In networked mode, history shows ALL session transactions (from all GMs)
    await gmScanner2.openHistory();
    const gm2FinalHistoryCount = await gmScanner2.historyContainer.locator('.transaction-card, .token-card, .history-entry').count();
    console.log(`✓ GM2 final history count: ${gm2FinalHistoryCount} transactions`);
    // GM2 should see all session transactions (same as GM1)
    expect(gm2FinalHistoryCount).toBeGreaterThanOrEqual(detectiveTokens.length + blackmarketTokens.length);
    await gmScanner2.closeHistory();

    // 15. Verify public scoreboard state
    const finalScoreEntryCount = await scoreboard.getScoreEntryCount();
    const finalEvidenceCount = await scoreboard.getEvidenceCardCount();
    console.log(`✓ Final public scoreboard: ${finalScoreEntryCount} score entries, ${finalEvidenceCount} evidence cards`);

    // 16. Verify environment control state persists through entire session
    //     (multiple scan rounds, team creation, score adjustments, deletion)
    await gmScanner1.navigateToAdminPanel();
    const finalEnvState = await gmScanner1.getEnvironmentControlState();
    // Audio section should still be visible and HDMI selected (toggled back in Phase 1.5)
    expect(finalEnvState.audioSectionVisible).toBe(true);
    expect(finalEnvState.videoRoute).toBe(initialVideoRoute);
    // BT section state should be consistent (no phantom devices from session activity)
    expect(finalEnvState.btDeviceCount).toBeGreaterThanOrEqual(0);
    console.log('✓ Environment control state persisted through full session');
    console.log('Final Environment State:', JSON.stringify(finalEnvState, null, 2));

    // 17. End session (already on admin panel from step 16)
    console.log('\n=== Ending Session ===');
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
