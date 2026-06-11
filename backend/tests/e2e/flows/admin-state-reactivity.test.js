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
const { selectTestTokens } = require('../helpers/token-selection');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

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
            const stateResp = await gm1.getStateFromBackend(orchestratorInfo.url);
            if (stateResp?.serviceHealth?.vlc?.status !== 'healthy') {
                test.skip('VLC not connected to orchestrator - skipping video reactivity test');
                return;
            }

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
            const stateResp2 = await gm1.getStateFromBackend(orchestratorInfo.url);
            const cueDepsHealthy = stateResp2?.serviceHealth?.sound?.status === 'healthy'
                && stateResp2?.serviceHealth?.lighting?.status === 'healthy';
            test.skip(!cueDepsHealthy,
                'sound/lighting not healthy — running-cue propagation requires real services (held propagation covered separately)');

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

            const stateResp = await gm1.getStateFromBackend(orchestratorInfo.url);
            const cueDepsHealthy = stateResp?.serviceHealth?.sound?.status === 'healthy'
                && stateResp?.serviceHealth?.lighting?.status === 'healthy';
            test.skip(cueDepsHealthy,
                'all cue dependencies healthy — held-path propagation requires a degraded service');

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
