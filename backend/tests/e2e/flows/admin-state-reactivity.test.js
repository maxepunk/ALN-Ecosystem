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
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');

let browser = null;
let orchestratorInfo = null;

test.describe('GM Scanner - Multi-Client Reactivity', () => {
    // Tests are mobile-first in this project, but Admin Panel is desktop-focused.
    // We'll use the default project (chromium) for desktop view.

    test.beforeAll(async () => {
        await clearSessionData();
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
    });

    test('Video State: GM1 scan command updates GM2 UI', async () => {
        const context1 = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
        const page1 = await createPage(context1);

        // 1. SETUP: Open Admin Panel in a second context (GM2)
        const context2 = await browser.newContext({ baseURL: orchestratorInfo.url }); // Ensure baseURL is set for the new context
        const page2 = await context2.newPage();

        // Assuming initAdminPanel is a helper function that navigates to the admin panel and logs in
        // For this test, we will use initializeGMScannerWithMode for GM2 as well, then navigate to admin panel
        // This keeps consistency with how GM1 is initialized.
        // If `initAdminPanel` is a new helper, it should be defined elsewhere.
        // For now, we'll keep the original flow for GM2 initialization but add the console listener.
        // The original line `const page2 = await createPage(context2);` is implicitly replaced by the new context/page creation.

        try {
            // 0. Prepare Text Data - We need a valid Video Token
            // This hits the backend API to find a token that triggers video
            const tokens = await selectTestTokens(orchestratorInfo.url);
            if (!tokens.videoToken) {
                test.skip('No video token available in database - skipping video reactivity test');
                return;
            }
            const videoTokenId = tokens.videoToken.SF_RFID;
            const videoFilename = tokens.videoToken.video;

            // 1. Init GM1 & GM2
            const gm1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });
            const gm2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', { orchestratorUrl: orchestratorInfo.url, password: ADMIN_PASSWORD });

            // GM1: Enters a Team to be ready to scan
            await gm1.enterTeam('Team Reactivity');
            await gm1.confirmTeam();

            // GM2: Navigates to Admin Panel to observe
            await gm2.navigateToAdminPanel();

            // Wait for display to settle on GM2
            // Note: Video container might be hidden initially if no video playing
            // We check for the container that SHOULD appear
            const videoControlPanel = page2.locator('#video-control-panel');
            await expect(videoControlPanel).toBeAttached();

            // 2. TRIGGER: GM1 Scans a Video Token
            // This mimics the exact production flow: Scan -> Backend -> Broadcast -> UI Update
            console.log(`GM1 scanning video token: ${videoTokenId} (${videoFilename})`);
            await gm1.manualScan(videoTokenId);

            // GM1 should see "Token Accepted" or similar result
            await expect(page1.locator('#resultStatus')).toContainText('Access Granted'); // or whatever success message

            // 3. VERIFY: GM2 UI matches expected state
            // The #now-showing-value element should update to show the video name
            const nowShowingValue = page2.locator('#now-showing-value');

            // We expect the video filename to appear in the "Now Playing" text
            // e.g. "Now Playing: 'some_video.mp4'" or just "some_video.mp4" depending on renderer
            await expect(nowShowingValue).toContainText(videoFilename, { timeout: 10000 });

            // Verify status badge removed/hidden or updated? 
            // VideoRenderer logic: "Now Playing: [filename]"
            // Status badge logic: #video-status-badge might not exist in the new UI layout?
            // Let's check index.html for #video-status-badge... IT DOES NOT EXIST in the Phase 4.2 layout!
            // The renderer tries to getElementById('video-status-badge') but it might be null.
            // The icon #now-showing-icon IS updated.
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
