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

/**
 * Poll GET /api/state until the music domain reports `playing` (P17-M3:
 * replaces fixed 1500ms settles after music:loadPlaylist — MPD actually
 * reporting `playing` is the observable condition both downstream
 * assertions depend on).
 */
async function waitForMusicPlaying(orchestratorUrl, timeoutMs = 15000) {
  await expect(async () => {
    const music = await new Promise((resolve, reject) => {
      const req = https.get(`${orchestratorUrl}/api/state`, {
        rejectUnauthorized: false,
        timeout: 5000,
      }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body).music || {}); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('state probe timeout')); });
    });
    expect(music.state).toBe('playing');
  }).toPass({ timeout: timeoutMs });
}

/**
 * Read the audio routing snapshot the backend reports (sync:full shape).
 * @param {string} orchestratorUrl
 * @returns {Promise<{routes: Object, defaultSink: string, availableSinks: Array, volumes: Object}>}
 */
async function fetchAudioState(orchestratorUrl) {
  return await new Promise((resolve, reject) => {
    const req = https.get(`${orchestratorUrl}/api/state`, {
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body).environment?.audio || {}); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('state probe timeout')); });
  });
}

/**
 * Poll /api/state until the backend reports the given per-stream volume (F3).
 * The slider dispatch is debounced 150ms client-side, so the persisted value —
 * not the slider position — is the observable that proves the command landed.
 */
async function waitForAudioVolume(orchestratorUrl, stream, volume, timeoutMs = 10000) {
  await expect(async () => {
    const audio = await fetchAudioState(orchestratorUrl);
    expect(audio.volumes?.[stream]).toBe(volume);
  }).toPass({ timeout: timeoutMs });
}

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
const { getCapabilities, refreshCapabilities, requireCapabilities, formatManifest, waitForCapability } = require('../helpers/capabilities');
let caps = null;
let testTokens = null;

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
    console.log(`VLC ownership: ${vlcInfo.type}`);
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    // Capture initial service health for conditional tests
    caps = await getCapabilities(orchestratorInfo.url);
    console.log(`Capability manifest: ${formatManifest(caps)}`);
    console.log('Service health snapshot:', Object.entries(caps._health).map(
      ([k, v]) => `${k}:${v.status}`
    ).join(', '));

    // Pre-fetch test tokens for ducking test (needs video file)
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterEach(async () => {
    // Session isolation: close all browser contexts, restart orchestrator,
    // and refresh the capability manifest. Matches 07d-02/07d-03 pattern.
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    try {
      caps = await refreshCapabilities(orchestratorInfo.url);
    } catch (e) {
      console.warn(`afterEach: Could not refresh capabilities: ${e.message}`);
    }
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('GM controls music playback', async () => {
    requireCapabilities(test, caps, ['music']);
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
    requireCapabilities(test, caps, ['bluetooth']);

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
    requireCapabilities(test, caps, ['lighting']);

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

        // Condition wait: tile reflects activation when the HA round-trip
        // completes (service:state lighting push re-renders the tile)
        await expect(page.locator(`.scene-tile[data-scene-id="${sceneId}"].scene-tile--active`))
          .toBeVisible({ timeout: 10000 });
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
    requireCapabilities(test, caps, ['audio']);

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

      // Get available audio route options for video stream.
      // B-1/L-1: option[0] is the disabled `value=""` "Unknown sink"
      // placeholder. It is not a route and cannot be selected — filter it out
      // before picking a target, or selectOption('') throws.
      const routeState = await gmScanner.getAudioRouteState('video');
      // A silent `return` here would report a PASS for a test that asserted
      // nothing. The audio service can be healthy while no real sink exists
      // (the internal auto_null is filtered out of availableSinks), so the
      // routing UI renders nothing — skip loudly instead.
      test.skip(routeState === null,
        'audio routing dropdowns not rendered (no live PipeWire sink)');
      console.log(`Audio route options for video: ${routeState.selectable.map(o => o.label).join(', ')}`);
      if (routeState.unknown) {
        console.log('Current video route is the "Unknown sink" placeholder (backend route matches no live sink)');
      }

      // F1 (venue 2026-09-15): a cold panel showed the HDMI sink for Video but
      // "Unknown sink" for Music and Sound — the backend omitted streams with no
      // explicit route even though they play on the default sink. Read BEFORE the
      // route change below, which would create an explicit route and mask it.
      const coldAudio = await fetchAudioState(orchestratorInfo.url);
      console.log(`Cold backend routes: ${JSON.stringify(coldAudio.routes)} (defaultSink ${coldAudio.defaultSink})`);
      // Aliases only resolve to concrete names when real sinks exist; a machine
      // whose only sink is the filtered-out auto_null has nothing to resolve to.
      test.skip(!coldAudio.availableSinks?.length,
        'no live PipeWire sinks — routes cannot resolve to concrete names');
      expect(Object.keys(coldAudio.routes).sort()).toEqual(['music', 'sound', 'video']);

      for (const stream of ['video', 'music', 'sound']) {
        expect(coldAudio.routes[stream], `backend route for ${stream}`).toBeTruthy();

        const streamState = await gmScanner.getAudioRouteState(stream);
        expect(streamState, `${stream} routing dropdown should render`).not.toBeNull();
        // A real sink name, not the disabled "Unknown sink" placeholder — and one
        // the GM could also pick from the list.
        expect(streamState.value, `${stream} route shown on the panel`).not.toBe('');
        expect(streamState.selectable.map(o => o.value)).toContain(streamState.value);
        console.log(`Cold panel route for ${stream}: ${streamState.value}`);
      }

      if (routeState.selectable.length > 1) {
        // Change to a different REAL route
        const currentValue = routeState.value;
        const newOption = routeState.selectable.find(o => o.value !== currentValue)
          || routeState.selectable[1];
        await gmScanner.setAudioRoute('video', newOption.value);
        console.log(`Audio route changed from ${currentValue || '(unknown sink)'} to ${newOption.value}`);

        // Verify the dropdown reflects the change
        const updatedValue = await gmScanner.getAudioRouteValue('video');
        expect(updatedValue).toBe(newOption.value);
      }

      // F3 (venue 2026-09-15): moving a slider for a stream with nothing playing
      // was rejected ("No active sink-input found for stream 'sound'") and toasted
      // as an error. Nothing plays on the sound stream in this test — exactly the
      // pre-show case. The level must be accepted and persisted as operator intent.
      const soundSlider = page.locator('input.volume-slider[data-stream="sound"]');
      await expect(soundSlider).toBeVisible();
      // Drive the real control: `input` is what domEventBindings listens for
      // (debounced 150ms → audioController.setVolume → audio:volume:set).
      await soundSlider.fill('45');
      await soundSlider.dispatchEvent('input');

      // Backend truth that the command was accepted, not merely quiet.
      await waitForAudioVolume(orchestratorInfo.url, 'sound', 45);

      // Secondary check — waitForAudioVolume above already proves the ack
      // succeeded. A rejected ack would ALSO surface to the operator as
      // "Command failed: ..." appended by uiManager.showError as a
      // div.error-message inside #error-container (NOT a .toast), auto-dismissed
      // after 5s, so the wait above stays inside that window.
      const volumeErrors = await page.locator('#error-container .error-message').allTextContents();
      console.log(`Operator errors after idle volume set: ${JSON.stringify(volumeErrors)}`);
      expect(volumeErrors.join(' | ')).not.toContain('Command failed');

    } finally {
      await context.close();
    }
  });

  test('Music auto-ducks when video plays', async () => {
    // The duck-off wait below allows up to 120s for the video to complete — that alone
    // exceeds the global 60s budget. Also give slow VLC start + duck-on headroom under
    // full-suite CPU load (this test runs the real video→ducking wire end-to-end).
    test.setTimeout(150000);
    requireCapabilities(test, caps, ['music', 'vlc']);
    const videoToken = testTokens?.videoToken;
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
      // Wait until MPD actually reports `playing` — the PipeWire sink-input
      // for aln-music exists once playback is live, which is what the video
      // duck-event needs as a target (was a fixed 1500ms settle, P17-M3).
      await waitForMusicPlaying(orchestratorInfo.url);

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
            data.data.state.ducking.music.includes('video'), 60000);

        // Re-confirm VLC is healthy right before queuing. vlc health was checked at the top,
        // but under full-suite load it can momentarily flap 'down', and video:queue:add is
        // REJECTED (not queued) when its vlc dependency is down → no video:started → no
        // ducking → the duck-on wait times out. (Duck-on bumped to 60s for slow VLC start.)
        await waitForCapability(orchestratorInfo.url, 'vlc', 10000);

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
        // When ducking FULLY clears, audioRoutingService.getState().ducking is a
        // sparse map that omits the 'music' key — so ducking.music is `undefined`,
        // not `[]` (contract-compliant; the GM scanner reads it via `?.`). Tolerate
        // that: "video no longer ducks music" means music is absent OR an array
        // without 'video'. (Requiring Array.isArray here missed the full-restore
        // case and hung for 120s.)
        const duckingByVideoEndedPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'audio' &&
            !((data.data?.state?.ducking?.music) || []).includes('video'), 120000); // Videos can be long

        // Wait for ducking by video to deactivate when video completes
        const duckingOff = await duckingByVideoEndedPromise;
        expect(duckingOff.data.state.ducking.music || []).not.toContain('video');
        console.log('Video-driven ducking ended after video completion');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Cascading pause suspends music', async () => {
    requireCapabilities(test, caps, ['music']);
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
      // Wait until MPD actually reports `playing` — pauseForGameClock only
      // sets `pausedByGameClock` when music was playing (was a fixed 1500ms
      // settle, P17-M3).
      await waitForMusicPlaying(orchestratorInfo.url);

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
