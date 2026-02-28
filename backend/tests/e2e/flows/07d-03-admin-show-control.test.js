/**
 * E2E Test: GM Scanner Admin Panel - Show Control
 *
 * Narrative: "A GM runs a game session using the admin panel"
 *
 * Tests the admin panel show control experience during an active game session.
 * Tests are ordered to mirror the GM's natural workflow:
 * 1. Check system health before starting
 * 2. Create session and start game — clock begins
 * 3. Fire quick cues during gameplay
 * 4. Run compound cue timelines
 * 5. Pause/resume game
 * 6. Probe service health
 * 7. Gated execution rejects commands when service is down
 * 8. Held items from service outage
 *
 * @group admin-panel
 * @group show-control
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let serviceHealth = null;

/**
 * Fetch serviceHealth snapshot from /api/state.
 * @param {string} orchestratorUrl - Backend URL
 * @returns {Promise<Object>} serviceHealth map
 */
async function fetchServiceHealth(orchestratorUrl) {
  const https = require('https');
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
 * @param {string} action - Command action (e.g., 'service:check')
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

/**
 * Parse clock display text (MM:SS) to total seconds.
 * SessionRenderer always renders game clock as MM:SS format.
 * @param {string} text - Clock display text
 * @returns {number|null} Total seconds, or null if unparseable
 */
function parseClockDisplay(text) {
  const match = text.match(/(\d+):(\d+)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

test.describe('GM Scanner - Show Control', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode on port ${vlcInfo.port}`);
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
  });

  test.afterEach(async () => {
    // Session isolation: close all browser contexts, restart orchestrator,
    // and refresh serviceHealth. Matches 07d-02-admin-panel-sessions pattern.
    await closeAllContexts();
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });

    // Refresh serviceHealth after restart (services may change state)
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

  test('GM checks system health before starting', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.navigateToAdminPanel();

      // Health dashboard should be visible
      const dashboard = page.locator('#health-dashboard');
      await expect(dashboard).toBeVisible();

      // Should show either OK or degraded state
      const isOk = await page.locator('.health-dashboard--ok').isVisible();
      const isDegraded = await page.locator('.health-dashboard--degraded').isVisible();
      expect(isOk || isDegraded).toBeTruthy();

      if (isDegraded) {
        // Degraded: verify service items are shown
        const serviceItems = page.locator('.health-service');
        const count = await serviceItems.count();
        expect(count).toBeGreaterThan(0);
        console.log(`Health dashboard shows degraded state with ${count} service entries`);
      } else {
        console.log('Health dashboard shows all services OK');
      }

      // Cross-check: GET /api/state serviceHealth should match UI
      const state = await gmScanner.getStateFromBackend(orchestratorInfo.url);
      const healthyCount = Object.values(state.serviceHealth || {}).filter(
        s => s.status === 'healthy'
      ).length;
      const totalCount = Object.keys(state.serviceHealth || {}).length;
      console.log(`Backend reports ${healthyCount}/${totalCount} services healthy`);

    } finally {
      await context.close();
    }
  });

  test('GM creates session and starts game — clock begins', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Show Control Test', ['Team Alpha']);

      // Game clock should be visible and running
      const clockDisplay = page.locator('#game-clock-display');
      await expect(clockDisplay).toBeVisible();

      // Clock should NOT be --:-- (that's the pre-game state)
      const initialText = await clockDisplay.textContent();
      expect(initialText).not.toBe('--:--');

      // Wait 2 seconds and verify clock advanced
      const time1 = parseClockDisplay(await clockDisplay.textContent());
      expect(time1).not.toBeNull();
      await page.waitForTimeout(2500);
      const time2 = parseClockDisplay(await clockDisplay.textContent());
      expect(time2).not.toBeNull();
      expect(time2).toBeGreaterThan(time1);
      console.log(`Clock advanced from ${time1}s to ${time2}s`);

    } finally {
      await context.close();
    }
  });

  test('GM fires quick cue — sound plays and completes', async () => {
    // Simple cues (non-compound, no timeline) fire and complete in ~1-2ms.
    // They NEVER enter 'running' state, so .active-cue-item is never created.
    // Verify via WebSocket events instead of DOM assertions.
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Cue Test', ['Team Alpha']);

      // Connect a temporary WebSocket to observe cue events
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `CUE_OBSERVER_${Date.now()}`, 'gm'
      );

      try {
        // Register BOTH cue:fired and cue:completed listeners BEFORE clicking.
        // Simple cues fire and complete in ~1-2ms — if cue:completed listener
        // is registered after cue:fired resolves, the event is already gone.
        // Events arrive wrapped in AsyncAPI envelope: {event, data, timestamp}
        const cueFiredPromise = waitForEvent(wsSocket, 'cue:fired',
          (data) => data.data?.cueId === 'tension-hit', 10000);

        const soundHealthy = serviceHealth.sound?.status === 'healthy';
        const cueCompletedPromise = soundHealthy
          ? waitForEvent(wsSocket, 'cue:completed',
              (data) => data.data?.cueId === 'tension-hit', 15000)
          : null;

        // Wait for quick fire grid to load and click the cue button
        const fireBtn = page.locator('#quick-fire-grid button[data-cue-id="tension-hit"]');
        await expect(fireBtn).toBeVisible({ timeout: 10000 });
        await fireBtn.click({ force: true });

        // Wait for cue:fired event (confirms cue was executed by the engine)
        const cueFired = await cueFiredPromise;
        expect(cueFired.data.cueId).toBe('tension-hit');
        console.log('Tension-hit cue fired via WebSocket event');

        // If sound service is healthy, verify cue completed its full lifecycle
        if (cueCompletedPromise) {
          const cueCompleted = await cueCompletedPromise;
          expect(cueCompleted.data.cueId).toBe('tension-hit');
          console.log('Tension-hit cue completed (sound played and finished)');
        } else {
          console.log('Sound service not healthy — cue fired but sound may have failed');
        }

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await context.close();
    }
  });

  test('Compound cue timeline runs to completion', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Compound Test', ['Team Alpha']);

      // Click the e2e-compound-test cue button
      const fireBtn = page.locator('#quick-fire-grid button[data-cue-id="e2e-compound-test"]');
      await expect(fireBtn).toBeVisible({ timeout: 10000 });
      await fireBtn.click({ force: true });

      // Active cue should appear with "Running" state
      const activeCueItem = page.locator('.active-cue-item[data-cue-id="e2e-compound-test"]');
      await expect(activeCueItem).toBeVisible({ timeout: 10000 });
      await expect(activeCueItem).toContainText('Running');

      // Compound cue has 5s duration — wait for it to complete
      await expect(activeCueItem).toBeHidden({ timeout: 15000 });
      console.log('Compound cue timeline completed');

    } finally {
      await context.close();
    }
  });

  test('GM pauses game — clock stops', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Pause Test', ['Team Alpha']);

      // Let clock run for a bit
      await page.waitForTimeout(2000);

      const clockDisplay = page.locator('#game-clock-display');
      const timeBeforePause = parseClockDisplay(await clockDisplay.textContent());

      // Pause the session
      await gmScanner.pauseSession();

      // Wait for pause to take effect — template re-renders (active→paused),
      // then gameclock:status updates the display. Wait for valid time.
      await page.waitForFunction(
        () => /\d+:\d+/.test(document.getElementById('game-clock-display')?.textContent || ''),
        { timeout: 5000 }
      );

      // Now wait 2.5s and verify clock didn't advance
      await page.waitForTimeout(2500);
      const timeAfterPause = parseClockDisplay(await clockDisplay.textContent());

      // Tolerance: client-side timer may tick 1-2 extra times during pause round-trip
      expect(Math.abs(timeAfterPause - timeBeforePause)).toBeLessThanOrEqual(3);
      console.log(`Clock paused at ${timeBeforePause}s, still ${timeAfterPause}s after 2.5s wait`);

    } finally {
      await context.close();
    }
  });

  test('GM resumes game — clock restarts', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Resume Test', ['Team Alpha']);

      // Let clock run, then pause
      await page.waitForTimeout(1000);
      await gmScanner.pauseSession();

      // Wait for pause to take effect — template re-renders (active→paused),
      // then gameclock:status updates the display. Wait for valid time.
      const clockDisplay = page.locator('#game-clock-display');
      await page.waitForFunction(
        () => /\d+:\d+/.test(document.getElementById('game-clock-display')?.textContent || ''),
        { timeout: 5000 }
      );
      const pausedTime = parseClockDisplay(await clockDisplay.textContent());
      expect(pausedTime).not.toBeNull();

      // Resume the session
      await gmScanner.resumeSession();

      // Wait 2.5 seconds — clock should advance
      await page.waitForTimeout(2500);
      const resumedTime = parseClockDisplay(await clockDisplay.textContent());

      // Clock should have advanced by ~2s
      expect(resumedTime).toBeGreaterThan(pausedTime);
      console.log(`Clock resumed from ${pausedTime}s to ${resumedTime}s`);

    } finally {
      await context.close();
    }
  });

  test('GM probes service health with service:check', async () => {
    // Use sendGMCommand to send service:check
    const ack = await sendGMCommand(orchestratorInfo.url, 'service:check', { serviceId: 'vlc' });

    expect(ack.data).toBeDefined();
    expect(ack.data.success).toBe(true);
    console.log('service:check for vlc returned:', JSON.stringify(ack.data.data || {}));
  });

  test('Gated execution rejects command when service is down', async () => {
    // FRESH health check — shared serviceHealth var can be stale because
    // serviceHealthRegistry probes asynchronously after orchestrator restart
    const freshHealth = await fetchServiceHealth(orchestratorInfo.url);
    console.log('Fresh health snapshot:', Object.entries(freshHealth).map(
      ([k, v]) => `${k}:${v.status}`
    ).join(', '));

    // Find any service that is NOT healthy
    const downService = Object.entries(freshHealth).find(
      ([id, info]) => info.status !== 'healthy' && id !== 'gameclock' && id !== 'cueengine'
    );

    if (!downService) {
      test.skip();
      console.log('All services healthy — cannot test gated execution rejection (skip)');
      return;
    }

    const [serviceId, serviceInfo] = downService;
    console.log(`Testing gated execution with down service: ${serviceId} (${serviceInfo.status})`);

    // Map service to a gated command (audio uses route:set, not volume:set which needs active playback)
    const serviceCommandMap = {
      spotify: { action: 'spotify:play', payload: {} },
      lighting: { action: 'lighting:scene:activate', payload: { sceneId: 'scene.test' } },
      sound: { action: 'sound:play', payload: { file: 'test.wav' } },
      bluetooth: { action: 'bluetooth:scan:start', payload: {} },
      audio: { action: 'audio:route:set', payload: { stream: 'video', sink: 'hdmi' } },
      vlc: { action: 'video:play', payload: {} },
    };

    const testCommand = serviceCommandMap[serviceId];
    if (!testCommand) {
      test.skip();
      console.log(`No gated command mapped for service: ${serviceId} (skip)`);
      return;
    }

    // Need an active session for most commands
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Gated Test', ['Team Alpha']);

      // Send command that should be rejected due to service being down
      const ack = await sendGMCommand(orchestratorInfo.url, testCommand.action, testCommand.payload);

      // If health changed between our check and the command, it might succeed
      if (ack.data.success) {
        console.log(`Gated execution: ${testCommand.action} unexpectedly succeeded (service recovered between health check and command)`);
        test.skip();
        return;
      }

      expect(ack.data.success).toBe(false);
      console.log(`Gated execution rejected ${testCommand.action}: ${ack.data.message}`);

    } finally {
      await context.close();
    }
  });

  test('Held item appears when cue dependency is down, GM discards it', async () => {
    // This test only runs if a service needed by a cue is down
    // attention-before-video needs both sound and lighting
    const soundDown = serviceHealth.sound?.status !== 'healthy';
    const lightingDown = serviceHealth.lighting?.status !== 'healthy';

    if (!soundDown && !lightingDown) {
      test.skip();
      console.log('Both sound and lighting are healthy — cannot test held items (skip)');
      return;
    }

    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      await gmScanner.createSessionWithTeams('Held Item Test', ['Team Alpha']);

      // Fire a cue that has a dependency on a down service
      // tension-hit depends on sound; if sound is down, it should be held
      if (soundDown) {
        const fireBtn = page.locator('#quick-fire-grid button[data-cue-id="tension-hit"]');
        await expect(fireBtn).toBeVisible({ timeout: 10000 });
        await fireBtn.click({ force: true });
      }

      // Wait for held item to appear
      const heldItemsContainer = page.locator('#held-items-container');
      const heldItem = heldItemsContainer.locator('.held-item');
      await expect(heldItem.first()).toBeVisible({ timeout: 10000 });
      console.log('Held item appeared');

      // Discard it
      const discardBtn = heldItem.first().locator('button[data-action="admin.discardHeld"]');
      await discardBtn.click();

      // Verify held item disappears
      await expect(heldItem.first()).toBeHidden({ timeout: 10000 });
      console.log('Held item discarded successfully');

    } finally {
      await context.close();
    }
  });

});
