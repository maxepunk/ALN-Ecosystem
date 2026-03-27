/**
 * E2E Test: Scoreboard During Video Lifecycle
 *
 * Verifies scoreboard behavior during video playback:
 * - Kiosk mode overlay activates when display enters VIDEO mode
 * - Overlay deactivates when video completes
 * - Scoreboard data remains current after video cycle
 *
 * Requires VLC to be running for actual video playback.
 * Tests that depend on VLC will skip gracefully if unavailable.
 *
 * Architecture notes:
 * - Overlay only activates in kiosk mode (?kiosk=true), not regular scoreboard URL
 * - display:mode VIDEO event triggers overlay.classList.add('active')
 * - display:mode SCOREBOARD event triggers overlay.classList.remove('active')
 * - Player scan with video token triggers the video chain
 * - ScoreboardPage is a named export { ScoreboardPage }
 * - waitForEvent predicates must use data.data?.field (AsyncAPI envelope wrapping)
 *
 * @group scoreboard
 * @group video
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');
const { ScoreboardPage } = require('../helpers/page-objects/ScoreboardPage');
const https = require('https');

// Tests are serial — they share one orchestrator and must not race each other
test.describe.configure({ mode: 'serial' });

// Skip on desktop project — run once via mobile-chrome (same pattern as 22, 23, 24)
test.skip(({ isMobile }) => !isMobile, 'Scoreboard video lifecycle tests only run on mobile-chrome project');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;
let videoToken = null;

/**
 * Check if VLC is healthy via /api/state.
 * @param {string} orchestratorUrl - Backend URL
 * @returns {Promise<boolean>} true if VLC status is 'healthy'
 */
async function isVLCHealthy(orchestratorUrl) {
  const stateResp = await new Promise((resolve, reject) => {
    const url = new URL('/api/state', orchestratorUrl);
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse /api/state response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
  });
  return stateResp.serviceHealth?.vlc?.status === 'healthy';
}

/**
 * POST /api/scan as a player device.
 * @param {string} baseUrl - Orchestrator URL
 * @param {string} tokenId - Token to scan
 * @param {string} [deviceId] - Player device ID
 * @returns {Promise<{status: number, body: Object}>}
 */
async function playerScan(baseUrl, tokenId, deviceId = 'e2e-player-sb-video') {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/scan', baseUrl);
    const postData = JSON.stringify({
      tokenId,
      deviceId,
      deviceType: 'player',
      timestamp: new Date().toISOString()
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse scan response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

test.describe('Scoreboard During Video Lifecycle', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors'
      ]
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
    videoToken = testTokens.videoToken;

    if (!videoToken) {
      console.warn('No video token available — video lifecycle tests will be skipped');
    }
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  // Clean state between tests — stop and restart to isolate sessions
  test.afterEach(async () => {
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    // Re-read videoToken from fresh testTokens after restart
    testTokens = await selectTestTokens(orchestratorInfo.url);
    videoToken = testTokens.videoToken;
  });

  // ====================================================
  // TEST 1: Scoreboard kiosk overlay lifecycle during video playback
  // ====================================================
  //
  // Architecture of display:mode events:
  // - Player scan → video pre-play hook switches to VIDEO mode (no emit)
  // - Video completes → _handleVideoComplete → _doSetIdleLoop → emits IDLE_LOOP
  // - IDLE_LOOP and VIDEO modes activate the kiosk overlay (covers scoreboard content)
  // - Sending display:scoreboard command → _doSetScoreboard → emits SCOREBOARD
  // - SCOREBOARD mode deactivates the overlay (scoreboard content visible again)
  //
  // Verified behavior:
  // 1. Before any video: overlay NOT active (no display:mode event yet)
  // 2. After video completes: display:mode IDLE_LOOP fires → overlay ACTIVE
  // 3. After display:scoreboard command: display:mode SCOREBOARD → overlay deactivated

  test('scoreboard kiosk overlay activates during video and deactivates after', async () => {
    if (!videoToken) {
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      console.warn('VLC not healthy — skipping kiosk overlay test');
      test.skip();
      return;
    }

    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      // Open scoreboard in kiosk mode — overlay only activates in ?kiosk=true
      await scoreboard.gotoKiosk(orchestratorInfo.url);
      // In kiosk mode, the status indicator is hidden via CSS (display:none).
      // waitForConnection() waits for visibility which fails for the hidden span.
      // Use waitForFunction to poll statusText content directly, bypassing visibility.
      await sbPage.waitForFunction(
        () => document.getElementById('statusText')?.textContent === 'LIVE',
        null,
        { timeout: 10000 }
      );
      console.log('Scoreboard connected in kiosk mode');

      // Setup GM scanner with session (need active session for player scans to work)
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Video Lifecycle Test', ['Team Alpha']);

      // Verify overlay is NOT active initially (no display:mode event received yet)
      await expect(scoreboard.displayModeOverlay).not.toHaveClass(/active/, { timeout: 5000 });
      console.log('Overlay not active before video');

      // Connect WebSocket listener — must register BEFORE triggering the video
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `SB_VIDEO_LIFECYCLE_${Date.now()}`, 'gm'
      );

      try {
        // Register listeners BEFORE scan to avoid any race condition

        // Listen for video playing (confirms video started)
        const videoPlayingPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'playing',
          15000
        );

        // Listen for display mode return to IDLE_LOOP after video completes
        // This fires from _handleVideoComplete → _doSetIdleLoop (since previousMode = IDLE_LOOP)
        const idleLoopModePromise = waitForEvent(wsSocket, 'display:mode',
          (data) => data.data?.mode === 'IDLE_LOOP',
          60000  // Video can take up to 60s to complete
        );

        // Player scan triggers video
        console.log(`Player scanning video token: ${videoToken.SF_RFID}`);
        const scanResult = await playerScan(orchestratorInfo.url, videoToken.SF_RFID);
        expect(scanResult.status).toBe(200);
        expect(scanResult.body.videoQueued).toBe(true);
        console.log('Player scan accepted, video queued');

        // Wait for video to start playing
        await videoPlayingPromise;
        console.log('Video confirmed playing via service:state');

        // Wait for video to complete (returns to IDLE_LOOP mode)
        await idleLoopModePromise;
        console.log('display:mode IDLE_LOOP received after video completed');

        // IDLE_LOOP mode activates the kiosk overlay (VLC idle loop covers the scoreboard)
        await expect(scoreboard.displayModeOverlay).toHaveClass(/active/, { timeout: 5000 });
        console.log('Kiosk overlay activated by IDLE_LOOP mode after video');

        // Send display:scoreboard command to restore scoreboard view
        // This emits display:mode SCOREBOARD which deactivates the overlay
        const scoreboardModePromise = waitForEvent(wsSocket, 'display:mode',
          (data) => data.data?.mode === 'SCOREBOARD',
          5000
        );
        wsSocket.emit('gm:command', { action: 'display:scoreboard', payload: {} });
        await scoreboardModePromise;
        console.log('display:mode SCOREBOARD received after display:scoreboard command');

        // Overlay should be deactivated (SCOREBOARD mode removes active class)
        await expect(scoreboard.displayModeOverlay).not.toHaveClass(/active/, { timeout: 5000 });
        console.log('Kiosk overlay deactivated after returning to SCOREBOARD mode');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  // ====================================================
  // TEST 2: Scoreboard data survives video cycle
  // ====================================================

  test('scoreboard data remains current after video cycle', async () => {
    if (!videoToken) {
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      console.warn('VLC not healthy — skipping data survival test');
      test.skip();
      return;
    }

    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);
      console.log('Scoreboard connected');

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Post-Video Data', ['Data Team']);

      // Navigate to scanner and select team
      await gmScanner.scannerTab.click();
      await gmScanner.teamEntryScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner.selectTeamFromList('Data Team');

      // Process a black market transaction (creates score entry on scoreboard)
      const token = testTokens.personalToken;
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult();

      const resultTitle = await gmScanner.getResultTitle();
      console.log(`BM scan result: ${resultTitle}`);
      expect(resultTitle).not.toContain('Error');
      expect(resultTitle).not.toContain('Duplicate');

      // Verify score shows on scoreboard before video
      await scoreboard.waitForScoreEntries(1, 15000);
      const preTxScore = await scoreboard.getTeamScoreNumeric('Data Team');
      expect(preTxScore).toBeGreaterThan(0);
      console.log(`Pre-video score: $${preTxScore}`);

      // Connect WebSocket listener — register before triggering video
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `SB_DATA_SURVIVAL_${Date.now()}`, 'gm'
      );

      try {
        // Listen for video idle (queue drained) — set up BEFORE triggering scan
        const videoIdlePromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'idle',
          60000
        );

        // Trigger a video via player scan
        console.log(`Triggering video with token: ${videoToken.SF_RFID}`);
        const scanResult = await playerScan(
          orchestratorInfo.url, videoToken.SF_RFID, `e2e-data-survival-${Date.now()}`
        );
        expect(scanResult.status).toBe(200);
        console.log('Video scan accepted');

        // Wait for video to complete (back to idle)
        await videoIdlePromise;
        console.log('Video playback completed, queue idle');

      } finally {
        disconnectSocket(wsSocket);
      }

      // Score should still be visible and unchanged after video cycle
      await scoreboard.waitForScoreEntries(1, 10000);
      const postVideoScore = await scoreboard.getTeamScoreNumeric('Data Team');
      expect(postVideoScore).toBe(preTxScore);
      console.log(`Score preserved after video cycle: $${postVideoScore}`);

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
});
