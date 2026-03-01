/**
 * E2E Test: Player Video Lifecycle
 *
 * Narrative: "A player scans a video token — the automated cue+video chain plays out"
 *
 * Tests the most complex automated flow:
 *   player scan → standing cue (attention-before-video) → video plays → video completes → restore cue
 *
 * No browser UI needed for the trigger — uses HTTP POST + WebSocket observation.
 * GM admin panel is opened in browser to verify UI reflects the state.
 *
 * CRITICAL: GM scanner scans do NOT trigger video (transactionService skips video for GM).
 * Video is triggered by: (1) player scan with video token, or (2) admin panel video:queue:add.
 *
 * @group video
 * @group player-scan
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');
const https = require('https');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
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
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
  return stateResp.serviceHealth?.vlc?.status === 'healthy';
}

/**
 * POST /api/scan as a player device.
 * @param {string} baseUrl - Orchestrator URL
 * @param {string} tokenId - Token to scan
 * @param {string} deviceId - Player device ID
 * @returns {Promise<{status: number, body: Object}>}
 */
async function playerScan(baseUrl, tokenId, deviceId = 'e2e-player-device') {
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

test.describe('Player Video Lifecycle', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode`);
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    testTokens = await selectTestTokens(orchestratorInfo.url);
    videoToken = testTokens.videoToken;

    if (!videoToken) {
      console.warn('No video token available — all video lifecycle tests will be skipped');
    }

    // Check VLC health at suite level (individual tests re-check)
    const vlcHealthy = await isVLCHealthy(orchestratorInfo.url);
    if (!vlcHealthy) {
      console.warn('VLC not healthy — video lifecycle tests will be skipped');
    }
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('Player scan with video token triggers video playback', async () => {
    if (!videoToken) {
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      test.skip();
      console.log('VLC not healthy — skipping video playback test');
      return;
    }

    // Create a session first (need active session for scans)
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Video Lifecycle', ['Team Alpha']);

      // Connect a WebSocket listener for video events
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `VIDEO_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Player scan with video token
        console.log(`Player scanning video token: ${videoToken.SF_RFID} (video: ${videoToken.video})`);
        const scanResult = await playerScan(orchestratorInfo.url, videoToken.SF_RFID);

        expect(scanResult.status).toBe(200);
        expect(scanResult.body.videoQueued).toBe(true);
        console.log('Player scan accepted, video queued');

        // Wait for video:status event with status 'playing'
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const videoPlaying = await waitForEvent(wsSocket, 'video:status',
          (data) => data.data?.status === 'playing', 15000);
        expect(videoPlaying.data.status).toBe('playing');
        console.log('Video playing confirmed via WebSocket');

        // Verify GM admin panel shows the video
        const nowShowingValue = page.locator('#now-showing-value');
        await expect(nowShowingValue).toContainText(videoToken.video, { timeout: 10000 });
        console.log('GM admin panel shows video filename');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Standing cue fires automatically on video:loading', async () => {
    if (!videoToken) {
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      test.skip();
      console.log('VLC not healthy — skipping standing cue test');
      return;
    }

    // Fresh orchestrator: previous test's video/session state would interfere
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Standing Cue Test', ['Team Alpha']);

      // Connect WebSocket listener for cue:fired events
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `CUE_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Listen for cue:fired with attention-before-video
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const cueFiredPromise = waitForEvent(wsSocket, 'cue:fired',
          (data) => data.data?.cueId === 'attention-before-video', 15000);

        // Trigger video via player scan
        console.log(`Player scanning video token: ${videoToken.SF_RFID}`);
        await playerScan(orchestratorInfo.url, videoToken.SF_RFID, `e2e-player-cue-${Date.now()}`);

        // Wait for the standing cue to fire
        const cueFired = await cueFiredPromise;
        expect(cueFired.data.cueId).toBe('attention-before-video');
        console.log('Standing cue attention-before-video fired on video:loading');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Video completes and restore cue fires', async () => {
    if (!videoToken) {
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      test.skip();
      console.log('VLC not healthy — skipping restore cue test');
      return;
    }

    // Fresh orchestrator: previous test's video/session state would interfere
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Restore Cue Test', ['Team Alpha']);

      // Connect WebSocket listener
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `RESTORE_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Listen for both video completion and restore cue
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const restoreCuePromise = waitForEvent(wsSocket, 'cue:fired',
          (data) => data.data?.cueId === 'restore-after-video', 120000); // Videos can be long

        // Trigger video
        console.log(`Player scanning video token: ${videoToken.SF_RFID}`);
        await playerScan(orchestratorInfo.url, videoToken.SF_RFID, `e2e-player-restore-${Date.now()}`);

        // Wait for video to start
        await waitForEvent(wsSocket, 'video:status',
          (data) => data.data?.status === 'playing', 15000);
        console.log('Video started playing');

        // Wait for video to complete and restore cue to fire
        // This can take a while depending on video length
        const restoreCue = await restoreCuePromise;
        expect(restoreCue.data.cueId).toBe('restore-after-video');
        console.log('Restore cue fired after video completion');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

});
