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
        console.log(`VLC started: ${vlcInfo.type} mode on port ${vlcInfo.port}`);
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

            // Check VLC is actually connected to the orchestrator
            const stateResp = await page1.evaluate(async (url) => {
                const resp = await fetch(`${url}/api/state`, { method: 'GET' });
                return resp.json();
            }, orchestratorInfo.url);
            if (stateResp?.systemStatus?.vlc !== 'connected') {
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
            await expect(nowShowingValue).toContainText(videoFilename, { timeout: 15000 });

            // Verify play icon appears
            const nowShowingIcon = page2.locator('#now-showing-icon');
            await expect(nowShowingIcon).toHaveText('▶️');

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
            // We expect #active-cues-list to contain an item with data-cue-id="e2e-compound-test"
            // And state "Running"
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

});
