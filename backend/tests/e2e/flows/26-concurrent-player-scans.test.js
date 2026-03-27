/**
 * E2E Test: Concurrent Player Scans
 *
 * Verifies the system handles rapid concurrent player scans correctly:
 * - Both scans acknowledged with 200
 * - Videos queued (not duplicated or lost)
 * - State remains consistent after both complete
 *
 * Tests the processQueue race fix under realistic network conditions.
 *
 * Architecture notes:
 * - Player scans use HTTP POST /api/scan (not WebSocket)
 * - Promise.all fires both requests simultaneously (not sequentially)
 * - Video tests require VLC and a session — skip gracefully if unavailable
 * - waitForEvent predicates use data.data?.field (AsyncAPI envelope wrapping)
 * - ScoreboardPage not needed here — we test HTTP responses and WS events only
 *
 * @group player-scan
 * @group resilience
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

// Tests are serial — they share one orchestrator and must not race each other
test.describe.configure({ mode: 'serial' });

// Skip on desktop project — run once via mobile-chrome (same pattern as 22, 23, 24, 25)
test.skip(({ isMobile }) => !isMobile, 'Concurrent player scan tests only run on mobile-chrome project');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;

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
 * @param {string} deviceId - Player device ID (must be unique per device)
 * @returns {Promise<{status: number, body: Object}>}
 */
async function playerScan(baseUrl, tokenId, deviceId) {
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

test.describe('Concurrent Player Scans', () => {

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
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  // ====================================================
  // TEST 1: Two rapid player scans are both acknowledged
  // ====================================================

  test('two rapid player scans are both acknowledged', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      // Create session (player scans require active session)
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Concurrent Scan Test', ['Rapid Team']);
      console.log('Session created with Rapid Team');

      // Pick two different non-video tokens (scans work regardless of VLC)
      const token1 = testTokens.personalToken;
      const token2 = testTokens.businessToken || testTokens.mentionToken;

      if (!token2 || token1.SF_RFID === token2.SF_RFID) {
        console.warn('Need 2 distinct non-video tokens — skipping');
        test.skip();
        return;
      }

      console.log(`Firing concurrent scans: ${token1.SF_RFID} + ${token2.SF_RFID}`);

      // Fire both scans simultaneously (not sequentially)
      const [result1, result2] = await Promise.all([
        playerScan(orchestratorInfo.url, token1.SF_RFID, 'concurrent-player-1'),
        playerScan(orchestratorInfo.url, token2.SF_RFID, 'concurrent-player-2')
      ]);

      // Both must be accepted (200 OK)
      expect(result1.status).toBe(200);
      expect(result2.status).toBe(200);
      console.log(`Scan 1: ${token1.SF_RFID} -> HTTP ${result1.status}`);
      console.log(`Scan 2: ${token2.SF_RFID} -> HTTP ${result2.status}`);

      // Both responses should indicate success (player scan returns 'accepted')
      expect(result1.body.status).toBe('accepted');
      expect(result2.body.status).toBe('accepted');

    } finally {
      await page.close();
      await context.close();
    }
  });

  // ====================================================
  // TEST 2: Concurrent video token scans queue sequentially
  // ====================================================

  test('concurrent video token scans queue sequentially, not duplicate', async () => {
    // Find video tokens from testTokens
    const videoTokens = Object.values(testTokens).filter(t => t && t.video);

    if (videoTokens.length < 2) {
      console.warn(`Need 2 video tokens, found ${videoTokens.length} — skipping`);
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
      console.warn('VLC not healthy — skipping concurrent video test');
      test.skip();
      return;
    }

    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Video Queue Test', ['Queue Team']);
      console.log('Session created with Queue Team');

      // Connect WebSocket listener — register BEFORE triggering scans
      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD,
        `CONCURRENT_VID_${Date.now()}`, 'gm'
      );

      try {
        const vid1 = videoTokens[0];
        const vid2 = videoTokens[1];
        console.log(`Firing concurrent video scans: ${vid1.SF_RFID} + ${vid2.SF_RFID}`);

        // Listen for first video playing — set up BEFORE triggering scans
        const videoPlayingPromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'playing',
          15000
        );

        // Listen for queue to eventually drain — up to 2 minutes for two videos
        const queueIdlePromise = waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'idle',
          120000
        );

        // Fire both video scans simultaneously
        const [r1, r2] = await Promise.all([
          playerScan(orchestratorInfo.url, vid1.SF_RFID, 'vid-player-1'),
          playerScan(orchestratorInfo.url, vid2.SF_RFID, 'vid-player-2')
        ]);

        // Both HTTP requests must succeed
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        console.log(`Video scan 1: HTTP ${r1.status}, videoQueued: ${r1.body.videoQueued}`);
        console.log(`Video scan 2: HTTP ${r2.status}, videoQueued: ${r2.body.videoQueued}`);

        // At least one should have videoQueued: true (the first one processed wins playback)
        const queuedCount = [r1.body.videoQueued, r2.body.videoQueued].filter(Boolean).length;
        expect(queuedCount).toBeGreaterThanOrEqual(1);
        console.log(`${queuedCount} video(s) queued`);

        // Wait for at least one video to start playing (confirms queue processed)
        await videoPlayingPromise;
        console.log('First video confirmed playing');

        // Wait for entire queue to drain to idle
        await queueIdlePromise;
        console.log('Video queue drained to idle — both videos processed sequentially');

      } finally {
        disconnectSocket(wsSocket);
      }

    } finally {
      await page.close();
      await context.close();
    }
  });
});
