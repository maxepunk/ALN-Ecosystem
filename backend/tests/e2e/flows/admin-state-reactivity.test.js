/**
 * E2E Test: GM Scanner Admin Panel - State Reactivity (Split Brain Verification)
 *
 * Verifies that ephemeral state (Video, Cues, Environment) propagates correctly
 * between multiple Admin Panel clients. This ensures the "Split Brain" issue is resolved
 * by moving state to UnifiedDataManager.
 *
 * SCENARIO:
 * 1. GM1 sends a command (e.g., Play Video).
 * 2. GM2 (passive observer) should see the state update automatically.
 *
 * @group admin-panel
 * @group reactivity
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { getCapabilities, requireCapabilities, requireDegraded, waitForCapability } = require('../helpers/capabilities');
const { selectTestTokens } = require('../helpers/token-selection');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

/**
 * Send a GM command over a throwaway admin socket.
 * Same pattern as GMScannerPage.startGame() / 07d-03's helper.
 */
async function sendGMCommand(orchestratorUrl, action, payload = {}) {
    const socket = await connectWithAuth(orchestratorUrl, ADMIN_PASSWORD, `CMD_HELPER_${Date.now()}`, 'gm');
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

/**
 * Make sure an active session exists, creating one only if needed.
 *
 * This suite deliberately shares ONE orchestrator across its tests and never
 * restarts it, so a session created by an earlier test is still live. Calling
 * createSessionWithTeams() blindly would hang waiting for a "Create New
 * Session" button that a live session hides.
 */
async function ensureActiveSession(gm, orchestratorUrl, name, teams) {
    const state = await gm.getStateFromBackend(orchestratorUrl);
    if (!state?.session || state.session.status === 'ended') {
        await gm.createSessionWithTeams(name, teams);
        return;
    }
    await gm.navigateToAdminPanel();
}

test.describe('GM Scanner - Multi-Client Reactivity', () => {
    // Tests are mobile-first in this project, but Admin Panel is desktop-focused.
    // We'll use the default project (chromium) for desktop view.

    test.beforeAll(async () => {
        await clearSessionData();
        // VLC must be set up BEFORE orchestrator starts (vlcService connects on startup)
        vlcInfo = await setupVLC();
        console.log(`VLC started: ${vlcInfo.type} mode`);
        orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
        browser = await chromium.launch({
            headless: true,
            args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
        });
    });

    test.afterAll(async () => {
        await closeAllContexts();
        if (browser) await browser.close();
        await stopOrchestrator();
        await cleanupVLC();
    });

    test('Video State: GM1 queue command updates GM2 UI', async () => {
        // Headroom over the global 60s for two-GM setup + VLC loading→playing confirmation
        // under full-suite CPU load. (The earlier deterministic hang was an in-page
        // evaluate(fetch) with no timeout — fixed below by using page.request; this is just
        // load headroom, not a hang workaround.)
        test.setTimeout(90000);
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url });
        const page2 = await context2.newPage();

        try {
            // 0. Find a valid video file for the test
            // GM scanning does NOT auto-play video (that's player scanner territory).
            // Video playback is triggered via admin panel queue controls.
            const tokens = await selectTestTokens(orchestratorInfo.url);
            if (!tokens.videoToken) {
                test.skip('No video token available in database - skipping video reactivity test');
                return;
            }
            const videoFilename = tokens.videoToken.video;

            // 1. Init GM1 & GM2
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            // Check VLC is actually connected to the orchestrator. Use page.request
            // (gm1.getStateFromBackend) rather than an in-page evaluate(fetch): the in-page
            // fetch runs through the page's service worker / JS context and was hanging here
            // with no timeout. page.request bypasses the SW and is the established pattern.
            const caps = await getCapabilities(orchestratorInfo.url);
            requireCapabilities(test, caps, ['vlc']);

            // GM1: Create session, then navigate to Admin Panel
            await gm1.createSessionWithTeams('Reactivity Test', ['Team Reactivity']);
            // createSessionWithTeams ends on admin panel already

            // GM2: Navigate to Admin Panel to observe
            await gm2.navigateToAdminPanel();

            // Wait for video control panel to be present on both GMs
            await expect(page1.locator('#video-control-panel')).toBeAttached();
            await expect(page2.locator('#video-control-panel')).toBeAttached();

            // 2. TRIGGER: GM1 queues a video via admin panel UI
            // Use the manual queue input to add a video file
            console.log(`GM1 queuing video: ${videoFilename}`);
            await page1.fill('#manual-video-input', videoFilename);
            await page1.click('button[data-action="app.adminAddVideoToQueue"]');

            // 3. VERIFY: GM2 UI shows the video playing
            // The #now-showing-value element should update to show the video name
            const nowShowingValue = page2.locator('#now-showing-value');
            await expect(nowShowingValue).toContainText(videoFilename, { timeout: 20000 });

            // Verify play icon appears. Explicit generous timeout (was the 5s expect default):
            // the loading→playing transition and its service:state push to GM2 can lag well
            // past 5s while VLC confirms playback under load.
            const nowShowingIcon = page2.locator('#now-showing-icon');
            await expect(nowShowingIcon).toHaveText('▶️', { timeout: 30000 });

        } finally {
            await context1.close();
            await context2.close();
        }
    });

    test('Video State: pending queue list renders on GM2 when videos are queued', async () => {
        // B-4: #video-queue-container carried a hard-coded inline display:none
        // that nothing ever cleared, so the "Queue: N pending" counter ticked up
        // while the list of what was queued stayed invisible on every station.
        test.setTimeout(120000);
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url });
        const page2 = await context2.newPage();

        try {
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            const caps = await getCapabilities(orchestratorInfo.url);
            requireCapabilities(test, caps, ['vlc']);

            await ensureActiveSession(gm1, orchestratorInfo.url, 'Queue Render Test', ['Team Queue']);
            await gm2.navigateToAdminPanel();
            await expect(page2.locator('#video-control-panel')).toBeAttached();

            // This suite shares one orchestrator, so an earlier test can leave a
            // video playing (and its own entries queued). Start from a known
            // empty queue or the pending count below is whatever the previous
            // test happened to leave behind.
            await sendGMCommand(orchestratorInfo.url, 'video:stop');
            await gm2.waitForVideoIdle(20000);
            await expect(gm2.videoQueueContainer).toBeHidden({ timeout: 20000 });

            // The queue reported to clients contains only PENDING items — the
            // video currently playing has already left it. So queue THREE to
            // observe a stable two-row list: #1 plays, #2 and #3 wait. All
            // three fixtures run 25s+, ample for the assertion.
            await waitForCapability(orchestratorInfo.url, 'vlc', 10000);
            for (const file of ['test_30sec.mp4', 'kai001.mp4', 'rem001.mp4']) {
                const ack = await sendGMCommand(orchestratorInfo.url, 'video:queue:add', { videoFile: file });
                expect(ack.data.success).toBe(true);
            }

            // GM2 (the station that issued nothing) sees the wrapper AND the rows
            await expect(gm2.videoQueueContainer).toBeVisible({ timeout: 20000 });
            await expect(gm2.videoQueueItems).toHaveCount(2, { timeout: 20000 });
            await expect(gm2.videoQueueCount).toHaveText('2', { timeout: 20000 });

            // Clearing the queue hides the wrapper again (the other half of the toggle)
            await sendGMCommand(orchestratorInfo.url, 'video:queue:clear');
            await expect(gm2.videoQueueContainer).toBeHidden({ timeout: 20000 });

        } finally {
            await sendGMCommand(orchestratorInfo.url, 'video:stop').catch(() => {});
            await context1.close();
            await context2.close();
        }
    });

    test('Audio State: GM1 per-stream volume change updates GM2 slider', async () => {
        // B-7: setStreamVolume now emits volume:changed and the audio domain
        // push carries `volumes`, so a level set on one station reaches every
        // other one. Before, a second GM's slider stayed at the old value until
        // a reconnect rebuilt it from sync:full — two GMs disagreeing about how
        // loud the music is, mid-show.
        test.setTimeout(120000);
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url });
        const page2 = await context2.newPage();

        try {
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            const caps = await getCapabilities(orchestratorInfo.url);
            requireCapabilities(test, caps, ['audio', 'music']);

            await ensureActiveSession(gm1, orchestratorInfo.url, 'Volume Reactivity Test', ['Team Volume']);
            await gm1.navigateToAdminPanel();
            await gm2.navigateToAdminPanel();

            // The routing UI (dropdown + volume slider per stream) renders only
            // from live PipeWire sinks, and the internal `auto_null` sink is
            // filtered out. A machine with no real output device therefore has
            // no slider to move — skip loudly rather than assert on nothing.
            const slider1 = page1.locator('input[data-stream="music"]');
            const slider2 = page2.locator('input[data-stream="music"]');
            const hasSlider = (await slider1.count()) > 0 && (await slider2.count()) > 0;
            test.skip(!hasSlider,
                'no real PipeWire sink on this machine (only auto_null) — per-stream volume UI is not rendered');

            // audio:volume:set needs a live sink-input to act on, so music must
            // actually be playing (same precondition as the ducking test).
            await sendGMCommand(orchestratorInfo.url, 'music:loadPlaylist', { playlistId: 'all-tracks' });

            // backend/public/music/ is gitignored, so the seed playlist can be
            // committed while the library is empty. MPD then queues filenames
            // that do not exist and never reaches `playing` — skip loudly
            // rather than time out on a wait that can never succeed.
            const musicState = await gm1.getStateFromBackend(orchestratorInfo.url);
            const trackCount = musicState?.music?.playlist?.tracks?.length ?? 0;
            test.skip(trackCount === 0,
                'music library empty on this machine (no MP3s in backend/public/music/) — MPD cannot reach playing');

            await expect(async () => {
                const state = await gm1.getStateFromBackend(orchestratorInfo.url);
                expect(state?.music?.state).toBe('playing');
            }).toPass({ timeout: 20000 });

            // Pick a target that differs from the current level so the change is observable
            const current = parseInt(await slider1.inputValue(), 10);
            const target = current > 50 ? 35 : 75;

            // Drive the real control: `input` is what domEventBindings listens for
            // (debounced 150ms → audioController.setVolume → audio:volume:set).
            await slider1.fill(String(target));
            await slider1.dispatchEvent('input');

            // GM2's slider follows via the audio-domain service:state push
            await expect(async () => {
                expect(parseInt(await slider2.inputValue(), 10)).toBe(target);
            }).toPass({ timeout: 20000 });

            console.log(`GM2 music slider followed GM1 to ${target}%`);

        } finally {
            await sendGMCommand(orchestratorInfo.url, 'music:stop').catch(() => {});
            await context1.close();
            await context2.close();
        }
    });

    test('Cue State: GM1 fire command updates GM2 UI', async () => {
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url });
        const page2 = await context2.newPage();

        try {
            // 1. Init GM1 & GM2 as Admin Panels
            // We use initializeGMScannerWithMode to get past login/setup, then go to Admin
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            // PRIMARY user flow — the fixture cue depends on sound + lighting;
            // with a down dependency it is HELD by design. Skip LOUDLY so the
            // report shows whether the primary path ran; the held cross-client
            // propagation is its own test below.
            const caps = await getCapabilities(orchestratorInfo.url);
            requireCapabilities(test, caps, ['sound', 'lighting']); // held propagation covered separately

            await gm1.navigateToAdminPanel();
            await gm2.navigateToAdminPanel();

            // 2. GM1 Fires a Cue using Real UI
            // The cue is configured as quickFire: true in cues.json, so it appears in the grid
            console.log('GM1 clicking real Quick Fire button for e2e-compound-test...');

            // Wait for grid to load and button to be visible
            const fireBtn = page1.locator('#quick-fire-grid button[data-cue-id="e2e-compound-test"]');
            await expect(fireBtn).toBeVisible({ timeout: 10000 });

            // Click the real button
            await fireBtn.click({ force: true });

            // 3. VERIFY: GM2 UI updates Active Cues list
            const activeCueItem = page2.locator('.active-cue-item[data-cue-id="e2e-compound-test"]');

            // Wait for it to appear (backend roundtrip + render)
            await expect(activeCueItem).toBeVisible({ timeout: 10000 });
            await expect(activeCueItem).toContainText('Running');

            // 4. GM1 Stops the Cue using Real UI
            // The active cue item has a Stop button rendered by CueRenderer
            const stopBtn = page1.locator('.active-cue-item[data-cue-id="e2e-compound-test"] button[data-action="admin.stopCue"]');
            await expect(stopBtn).toBeVisible({ timeout: 10000 });
            await stopBtn.click({ force: true });

            // 5. VERIFY: GM2 UI removes the cue
            await expect(activeCueItem).toBeHidden({ timeout: 30000 });

        } finally {
            await context1.close();
            await context2.close();
        }
    });

    test('Cue State: HELD cue propagates to GM2 held-items panel (degraded services)', async () => {
        // Cross-client propagation of the HELD path: when a cue dependency
        // is down, GM1's fire results in a held item that must appear on
        // GM2's held panel (service:state domain 'held' fan-out). This is
        // the designed venue-degradation behavior and only testable when a
        // dependency is actually down — skips loudly on a fully-healthy Pi.
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url });
        const page2 = await context2.newPage();

        try {
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            const caps = await getCapabilities(orchestratorInfo.url);
            requireDegraded(test, caps, ['sound', 'lighting']);

            await gm1.navigateToAdminPanel();
            await gm2.navigateToAdminPanel();

            const fireBtn = page1.locator('#quick-fire-grid button[data-cue-id="e2e-compound-test"]');
            await expect(fireBtn).toBeVisible({ timeout: 10000 });
            await fireBtn.click({ force: true });

            // GM2 (the NON-firing client) must see the held item appear,
            // with the type-prefixed wire ID the release routing depends on
            const heldItem2 = page2.locator('.held-item[data-held-id^="held-cue-"]');
            await expect(heldItem2.first()).toBeVisible({ timeout: 10000 });
            console.log('GM2 sees HELD cue — cross-client held propagation verified');

        } finally {
            await context1.close();
            await context2.close();
        }
    });

});
