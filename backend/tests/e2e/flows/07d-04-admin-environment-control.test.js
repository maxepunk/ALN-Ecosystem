/**
 * E2E Test: GM Scanner Admin Panel - Environment Control
 *
 * Narrative: "A GM manages venue environment — music, speakers, lighting, audio routing"
 *
 * All tests follow the same conditional pattern: check service health via /api/state,
 * test if healthy, test.skip() if not. The Pi runs the full system — these services
 * ARE expected to be available.
 *
 * @group admin-panel
 * @group environment
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
let serviceHealth = null;
let testTokens = null;

/**
 * Fetch serviceHealth snapshot from /api/state.
 * @param {string} orchestratorUrl - Backend URL
 * @returns {Promise<Object>} serviceHealth map
 */
async function fetchServiceHealth(orchestratorUrl) {
  const stateResponse = await new Promise((resolve, reject) => {
    const url = new URL('/api/state', orchestratorUrl);
    const req = https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
  return stateResponse.serviceHealth || {};
}

/**
 * Send a GM command via temporary WebSocket connection.
 * Follows the same pattern as GMScannerPage.startGame().
 *
 * @param {string} orchestratorUrl - Backend URL
 * @param {string} action - Command action (e.g., 'spotify:play')
 * @param {Object} payload - Command payload
 * @returns {Promise<Object>} Command acknowledgement
 */
async function sendGMCommand(orchestratorUrl, action, payload = {}) {
  const deviceId = `CMD_HELPER_${Date.now()}`;
  const socket = await connectWithAuth(orchestratorUrl, ADMIN_PASSWORD, deviceId, 'gm');
  try {
    const ackPromise = waitForEvent(socket, 'gm:command:ack',
      (ack) => ack?.data?.action === action, 10000);
    socket.emit('gm:command', {
      event: 'gm:command',
      data: { action, payload },
      timestamp: new Date().toISOString()
    });
    return await ackPromise;
  } finally {
    disconnectSocket(socket);
  }
}

test.describe('GM Scanner - Environment Control', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode`);
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    // Capture initial service health for conditional tests
    serviceHealth = await fetchServiceHealth(orchestratorInfo.url);
    console.log('Service health snapshot:', Object.entries(serviceHealth).map(
      ([k, v]) => `${k}:${v.status}`
    ).join(', '));

    // Pre-fetch test tokens for ducking test (needs video file)
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterEach(async () => {
    // Session isolation: close all browser contexts, restart orchestrator,
    // and refresh serviceHealth. Matches 07d-02/07d-03 pattern.
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    try {
      serviceHealth = await fetchServiceHealth(orchestratorInfo.url);
    } catch (e) {
      console.warn(`afterEach: Could not refresh serviceHealth: ${e.message}`);
    }
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('GM controls Spotify playback', async () => {
    if (serviceHealth.spotify?.status !== 'healthy') {
      test.skip();
      console.log('Spotify not healthy — skipping');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Spotify Test', ['Team Alpha']);

      // Pause Spotify via gm:command
      const pauseAck = await sendGMCommand(orchestratorInfo.url, 'spotify:pause');
      expect(pauseAck.data.success).toBe(true);
      console.log('Spotify paused:', pauseAck.data.message);

      // Resume Spotify via gm:command
      const playAck = await sendGMCommand(orchestratorInfo.url, 'spotify:play');
      expect(playAck.data.success).toBe(true);
      console.log('Spotify playing:', playAck.data.message);

      // Verify Now Playing section visible on admin panel
      await gmScanner.navigateToAdminPanel();
      const nowPlaying = page.locator('#now-playing-section');
      await expect(nowPlaying).toBeVisible({ timeout: 10000 });
      console.log('Now Playing section visible on admin panel');

    } finally {
      await context.close();
    }
  });

  test('GM initiates Bluetooth scan', async () => {
    if (serviceHealth.bluetooth?.status !== 'healthy') {
      test.skip();
      console.log('Bluetooth not healthy — skipping');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('BT Scan Test', ['Team Alpha']);
      await gmScanner.navigateToAdminPanel();

      // Bluetooth section should be visible (not the "unavailable" fallback)
      await expect(gmScanner.btScanBtn).toBeVisible({ timeout: 10000 });
      const btUnavailable = page.locator('#bt-unavailable');
      expect(await btUnavailable.isVisible()).toBe(false);

      // Start Bluetooth scan via UI button
      await gmScanner.startBtScan();

      // Verify scan status indicator appears
      const btScanStatus = page.locator('#bt-scan-status');
      await expect(btScanStatus).toBeVisible({ timeout: 10000 });
      console.log('Bluetooth scan initiated, status indicator visible');

      // We don't need to wait for full scan completion (15s default) —
      // just verifying the scan starts is enough for this flow test.

    } finally {
      await context.close();
    }
  });

  test('GM activates lighting scene', async () => {
    if (serviceHealth.lighting?.status !== 'healthy') {
      test.skip();
      console.log('Lighting not healthy — skipping');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Lighting Test', ['Team Alpha']);
      await gmScanner.navigateToAdminPanel();

      // Lighting section should show connected state (not "not connected")
      const lightingNotConnected = page.locator('#lighting-not-connected');
      expect(await lightingNotConnected.isVisible()).toBe(false);

      // Check for available scene tiles
      const sceneTiles = page.locator('#lighting-scenes .scene-tile');
      const tileCount = await sceneTiles.count();

      if (tileCount > 0) {
        // Click first available scene tile
        const firstScene = sceneTiles.first();
        const sceneId = await firstScene.getAttribute('data-scene-id');
        console.log(`Activating lighting scene: ${sceneId}`);
        await firstScene.click();

        // Allow time for scene activation round-trip (HA API call)
        await page.waitForTimeout(2000);
        console.log(`Lighting scene ${sceneId} activated via UI`);
      } else {
        // No scenes available — HA connected but no scenes configured
        console.log('No lighting scenes available (HA connected but no scenes)');
      }

    } finally {
      await context.close();
    }
  });

  test('GM changes audio routing', async () => {
    if (serviceHealth.audio?.status !== 'healthy') {
      test.skip();
      console.log('Audio not healthy — skipping');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Audio Routing Test', ['Team Alpha']);
      await gmScanner.navigateToAdminPanel();

      // Audio output section should be visible
      const audioSection = page.locator('#audio-output-section');
      await expect(audioSection).toBeVisible({ timeout: 10000 });

      // Get available audio route options for video stream
      const options = await gmScanner.getAudioRouteOptions('video');
      console.log(`Audio route options for video: ${options.map(o => o.label).join(', ')}`);

      if (options.length > 1) {
        // Change to a different route
        const currentValue = await gmScanner.getAudioRouteValue('video');
        const newOption = options.find(o => o.value !== currentValue) || options[1];
        await gmScanner.setAudioRoute('video', newOption.value);
        console.log(`Audio route changed from ${currentValue} to ${newOption.value}`);

        // Verify the dropdown reflects the change
        const updatedValue = await gmScanner.getAudioRouteValue('video');
        expect(updatedValue).toBe(newOption.value);
      }

      // Note: audio:volume:set requires an active PipeWire sink-input
      // (VLC/Spotify/pw-play must be playing). Volume tested in video lifecycle tests.

    } finally {
      await context.close();
    }
  });

  test('Spotify auto-ducks when video plays', async () => {
    const spotifyHealthy = serviceHealth.spotify?.status === 'healthy';
    const vlcHealthy = serviceHealth.vlc?.status === 'healthy';
    const videoToken = testTokens?.videoToken;

    if (!spotifyHealthy || !vlcHealthy) {
      test.skip();
      console.log(`Spotify=${spotifyHealthy}, VLC=${vlcHealthy} — both needed for ducking test`);
      return;
    }

    if (!videoToken) {
      test.skip();
      console.log('No video token available — cannot test auto-ducking');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Ducking Test', ['Team Alpha']);

      // Ensure Spotify is playing (ducking requires active Spotify playback)
      await sendGMCommand(orchestratorInfo.url, 'spotify:play');

      // Connect WebSocket listener for ducking events
      // audio:ducking:status is NOT cached — listener must be registered before trigger
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `DUCKING_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Register BOTH ducking listeners BEFORE triggering video.
        // audio:ducking:status is NOT cached — both listeners must exist before
        // the trigger to avoid a race if the video is very short.
        // Concurrent listeners on the same event work because waitForEvent uses
        // predicate filtering: duckingOnPromise matches ducked=true, duckingOffPromise
        // skips ducked=true and waits for ducked=false.
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const duckingOnPromise = waitForEvent(wsSocket, 'audio:ducking:status',
          (data) => data.data?.ducked === true, 20000);
        const duckingOffPromise = waitForEvent(wsSocket, 'audio:ducking:status',
          (data) => data.data?.ducked === false, 120000); // Videos can be long

        // Queue video via admin command (triggers VLC playback + ducking)
        await sendGMCommand(orchestratorInfo.url, 'video:queue:add', {
          videoFile: videoToken.video
        });
        console.log(`Video queued: ${videoToken.video}`);

        // Wait for ducking to activate
        const duckingActive = await duckingOnPromise;
        expect(duckingActive.data.ducked).toBe(true);
        console.log(`Spotify ducked to volume ${duckingActive.data.volume}`);

        // Wait for ducking to deactivate after video completes
        const duckingOff = await duckingOffPromise;
        expect(duckingOff.data.ducked).toBe(false);
        console.log('Ducking restored after video completion');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Cascading pause suspends Spotify', async () => {
    if (serviceHealth.spotify?.status !== 'healthy') {
      test.skip();
      console.log('Spotify not healthy — skipping cascading pause test');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Cascading Pause Test', ['Team Alpha']);

      // Ensure Spotify is playing before we pause the session
      await sendGMCommand(orchestratorInfo.url, 'spotify:play');

      // Connect WebSocket listener for spotify:status events
      // spotify:status is NOT cached — listener must be registered before trigger
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `SPOTIFY_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Register listener for Spotify paused-by-game-clock BEFORE pausing
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const spotifyPausedPromise = waitForEvent(wsSocket, 'spotify:status',
          (data) => data.data?.pausedByGameClock === true, 10000);

        // Pause session — should cascade to Spotify
        await gmScanner.pauseSession();
        console.log('Session paused');

        // Wait for Spotify to report pausedByGameClock
        const spotifyPaused = await spotifyPausedPromise;
        expect(spotifyPaused.data.pausedByGameClock).toBe(true);
        console.log('Spotify paused by game clock cascade');

        // Register listener for resume BEFORE resuming session
        const spotifyResumedPromise = waitForEvent(wsSocket, 'spotify:status',
          (data) => data.data?.pausedByGameClock === false, 10000);

        // Resume session — should cascade to Spotify
        await gmScanner.resumeSession();
        console.log('Session resumed');

        // Wait for Spotify to report resumed
        const spotifyResumed = await spotifyResumedPromise;
        expect(spotifyResumed.data.pausedByGameClock).toBe(false);
        console.log('Spotify resumed after game clock cascade');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

});
