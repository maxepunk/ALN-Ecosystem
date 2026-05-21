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
const fs = require('fs');
const path = require('path');

const MUSIC_DIR = path.resolve(__dirname, '../../../public/music');

/**
 * Returns true when at least one MP3 is present in backend/public/music/.
 * The directory is gitignored — fresh CI clones won't have any tracks even
 * if the seed playlist (committed) references them. Without MP3s, MPD adds
 * non-existent filenames and the music never actually plays — pause/cascade/
 * ducking flows all fail silently in misleading ways. Pi-only by design.
 */
function musicLibraryPopulated() {
  try {
    return fs.readdirSync(MUSIC_DIR).some(f => f.toLowerCase().endsWith('.mp3'));
  } catch {
    return false;
  }
}

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
 * @param {string} action - Command action (e.g., 'music:play')
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

  test('GM controls music playback', async () => {
    if (serviceHealth.music?.status !== 'healthy') {
      console.log('Music not healthy — skipping');
      test.skip();
      return;
    }
    if (!musicLibraryPopulated()) {
      console.log('backend/public/music/ empty — skipping (Pi-only test)');
      test.skip();
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Music Test', ['Team Alpha']);

      // Persistent listener for music service:state — needed to verify actual
      // MPD state transitions, not just gm:command ACKs (which fire before
      // MPD's idle event reports the new playback state).
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `MUSIC_TEST_${Date.now()}`, 'gm'
      );

      try {
        // Music starts in a 'stopped' state with no queue. To meaningfully
        // exercise pause/play we first load a playlist (which adds tracks and
        // auto-starts playback per musicService.loadPlaylist). loadPlaylist's
        // ACK returns once MPD has accepted the batch, but MPD's idle event
        // (which updates musicService.state to 'playing') is async. Wait for
        // the state push before issuing pause so we test real state machine,
        // not just the command pipeline.
        const playingPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'music' &&
            data.data?.state?.state === 'playing', 10000);
        const loadAck = await sendGMCommand(orchestratorInfo.url, 'music:loadPlaylist',
          { playlistId: 'all-tracks' });
        expect(loadAck.data.success).toBe(true);
        await playingPromise;
        console.log('Music playlist loaded + MPD reports playing');

        // Pause music via gm:command — verify MPD actually pauses
        const pausedPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'music' &&
            data.data?.state?.state === 'paused', 10000);
        const pauseAck = await sendGMCommand(orchestratorInfo.url, 'music:pause');
        expect(pauseAck.data.success).toBe(true);
        await pausedPromise;
        console.log('Music paused via gm:command');

        // Resume music via gm:command — verify MPD actually plays again
        const playingAgainPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'music' &&
            data.data?.state?.state === 'playing', 10000);
        const playAck = await sendGMCommand(orchestratorInfo.url, 'music:play');
        expect(playAck.data.success).toBe(true);
        await playingAgainPromise;
        console.log('Music resumed via gm:command');

        // Verify Music section visible on admin panel
        await gmScanner.navigateToAdminPanel();
        const musicSection = page.locator('#music-section');
        await expect(musicSection).toBeVisible({ timeout: 10000 });
        console.log('Music section visible on admin panel');

      } finally {
        disconnectSocket(wsSocket);
      }
    } finally {
      await context.close();
    }
  });

  test('GM initiates Bluetooth scan', async () => {
    if (serviceHealth.bluetooth?.status !== 'healthy') {
      console.log('Bluetooth not healthy — skipping');
      test.skip();
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
      console.log('Lighting not healthy — skipping');
      test.skip();
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
      console.log('Audio not healthy — skipping');
      test.skip();
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
      // (VLC/aln-music/pw-play must be playing). Volume tested in video lifecycle tests.

    } finally {
      await context.close();
    }
  });

  test('Music auto-ducks when video plays', async () => {
    const musicHealthy = serviceHealth.music?.status === 'healthy';
    const vlcHealthy = serviceHealth.vlc?.status === 'healthy';
    const videoToken = testTokens?.videoToken;

    if (!musicHealthy || !vlcHealthy) {
      console.log(`Music=${musicHealthy}, VLC=${vlcHealthy} — both needed for ducking test`);
      test.skip();
      return;
    }
    if (!musicLibraryPopulated()) {
      console.log('backend/public/music/ empty — skipping (Pi-only test)');
      test.skip();
      return;
    }

    if (!videoToken) {
      console.log('No video token available — cannot test auto-ducking');
      test.skip();
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

      // Load + auto-play All Tracks so music is an active duck target.
      // (Ducking only fires against streams with a live PipeWire sink-input.)
      await sendGMCommand(orchestratorInfo.url, 'music:loadPlaylist',
        { playlistId: 'all-tracks' });
      // Brief settle so the PipeWire sink-input for aln-music exists before
      // the video duck-event fires.
      await new Promise(r => setTimeout(r, 1500));

      // Connect WebSocket listener for service:state (audio domain) events
      // service:state for audio is NOT cached — listener must be registered before trigger
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `DUCKING_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Wait specifically for VIDEO to be in the duck source list — not just
        // any ducking activity. Site-specific cues (e.g., attention-before-video
        // playing a sound on video:loading) can independently duck music BY
        // 'sound', which would falsely satisfy a generic `length > 0` predicate.
        // The test's intent is "video triggers ducking", so be explicit.
        // Events arrive wrapped in AsyncAPI envelope: {event, data: {domain, state}, timestamp}
        const duckingByVideoPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'audio' &&
            Array.isArray(data.data?.state?.ducking?.music) &&
            data.data.state.ducking.music.includes('video'), 30000);

        // Queue video via admin command (triggers VLC playback + ducking)
        await sendGMCommand(orchestratorInfo.url, 'video:queue:add', {
          videoFile: videoToken.video
        });
        console.log(`Video queued: ${videoToken.video}`);

        // Wait for video-driven ducking to activate
        const duckingActive = await duckingByVideoPromise;
        expect(duckingActive.data.state.ducking.music).toContain('video');
        console.log(`Music ducked by: ${duckingActive.data.state.ducking.music.join(', ')}`);

        // Register the duck-end listener AFTER duck-on matched so we only catch
        // the post-video-end clear, not any earlier sound-duck clears that may
        // have fired before video started. There's a theoretical microtask gap
        // here that could miss the duck-end event, but production video tokens
        // are seconds-to-minutes long — ample time to register the listener.
        const duckingByVideoEndedPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'audio' &&
            Array.isArray(data.data?.state?.ducking?.music) &&
            !data.data.state.ducking.music.includes('video'), 120000); // Videos can be long

        // Wait for ducking by video to deactivate when video completes
        const duckingOff = await duckingByVideoEndedPromise;
        expect(duckingOff.data.state.ducking.music).not.toContain('video');
        console.log('Video-driven ducking ended after video completion');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Cascading pause suspends music', async () => {
    if (serviceHealth.music?.status !== 'healthy') {
      console.log('Music not healthy — skipping cascading pause test');
      test.skip();
      return;
    }
    if (!musicLibraryPopulated()) {
      console.log('backend/public/music/ empty — skipping (Pi-only test)');
      test.skip();
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

      // Load + auto-play All Tracks so music is in a 'playing' state — the
      // game-clock cascade only sets `pausedByGameClock` if music was playing
      // (per musicService.pauseForGameClock).
      await sendGMCommand(orchestratorInfo.url, 'music:loadPlaylist',
        { playlistId: 'all-tracks' });
      // Brief settle so MPD actually reports `state: playing` to the service.
      await new Promise(r => setTimeout(r, 1500));

      // Connect WebSocket listener for service:state (music domain) events
      // service:state is NOT cached — listener must be registered before trigger
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `MUSIC_LISTENER_${Date.now()}`, 'gm'
      );

      try {
        // Register listener for music paused-by-game-clock BEFORE pausing
        // Events arrive wrapped in AsyncAPI envelope: {event, data: {domain, state}, timestamp}
        const musicPausedPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'music' &&
            data.data?.state?.pausedByGameClock === true, 10000);

        // Pause session — should cascade to music
        await gmScanner.pauseSession();
        console.log('Session paused');

        // Wait for music to report pausedByGameClock
        const musicPaused = await musicPausedPromise;
        expect(musicPaused.data.state.pausedByGameClock).toBe(true);
        console.log('Music paused by game clock cascade');

        // Register listener for resume BEFORE resuming session
        const musicResumedPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'music' &&
            data.data?.state?.pausedByGameClock === false, 10000);

        // Resume session — should cascade to music
        await gmScanner.resumeSession();
        console.log('Session resumed');

        // Wait for music to report resumed
        const musicResumed = await musicResumedPromise;
        expect(musicResumed.data.state.pausedByGameClock).toBe(false);
        console.log('Music resumed after game clock cascade');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

});
