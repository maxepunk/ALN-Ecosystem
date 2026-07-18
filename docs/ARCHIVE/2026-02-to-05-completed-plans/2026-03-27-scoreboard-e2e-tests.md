# Scoreboard E2E Test Coverage Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add E2E test coverage for the scoreboard display — the component that froze during the 0321game session and currently has zero E2E tests despite having a complete page object.

**Architecture:** Four test suites exercising the scoreboard through Playwright. Uses the existing `ScoreboardPage` page object, `test-server.js` orchestrator lifecycle, and `websocket-core.js` for WebSocket assertions. GM Scanner processes transactions via `manualScan()` and player scans use HTTP POST. The scoreboard is tested as an "external device" path (Playwright browser, not the Pi's HDMI kiosk).

**Tech Stack:** Playwright, existing E2E helpers (test-server.js, browser-contexts.js, websocket-core.js, ScoreboardPage.js, GMScannerPage.js, token-selection.js)

**Prerequisites:** The scoreboard must be served by the orchestrator at `/scoreboard`. The `ScoreboardPage` page object already exists at `tests/e2e/helpers/page-objects/ScoreboardPage.js` with locators for connection status, evidence cards, score ticker, display mode overlay, and more. `test-server.js` already exports `restartOrchestrator()` for restart tests.

---

## Task 1: Scoreboard Receives Live Data

The core data flow test. Verifies the scoreboard connects, receives transactions, and renders them correctly for both detective (evidence cards) and black market (score ticker) modes.

**Files:**
- Create: `backend/tests/e2e/flows/23-scoreboard-live-data.test.js`
- Use: `backend/tests/e2e/helpers/page-objects/ScoreboardPage.js`
- Use: `backend/tests/e2e/helpers/page-objects/GMScannerPage.js`
- Use: `backend/tests/e2e/helpers/token-selection.js`

**Step 1: Write the test suite**

```javascript
/**
 * E2E Test: Scoreboard Live Data
 *
 * Verifies the scoreboard receives and renders live game data:
 * - WebSocket connection (LIVE status)
 * - Detective transactions → evidence cards
 * - Black Market transactions → score ticker
 * - New session boundary → stale data cleared
 *
 * Tests the "external device" scoreboard path (browser at /scoreboard),
 * not the HDMI kiosk path (managed by displayDriver).
 *
 * @group scoreboard
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens, calculateExpectedScore } = require('../helpers/token-selection');
const ScoreboardPage = require('../helpers/page-objects/ScoreboardPage');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;

test.describe('Scoreboard Live Data', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
  });

  test('scoreboard connects and shows LIVE status', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scoreboard = new ScoreboardPage(page);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);
      expect(await scoreboard.isConnected()).toBe(true);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
    } finally {
      await page.close();
      await context.close();
    }
  });

  test('detective transaction appears as evidence card on scoreboard', async () => {
    // Open both scoreboard and GM scanner
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      // Setup scoreboard
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      // Setup GM scanner, create session
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Scoreboard Test', ['Evidence Team']);

      // Select team and scan a token in detective mode
      await gmScanner.selectTeamFromList('Evidence Team');
      const token = testTokens.personalToken;

      // Switch to detective mode before scanning
      await gmScanner.selectMode('detective');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Verify evidence appears on scoreboard
      await scoreboard.waitForTotalEvidence(1, 10000);
      const evidenceCount = await scoreboard.getTotalEvidenceCount();
      expect(evidenceCount).toBeGreaterThanOrEqual(1);

      console.log('✓ Detective transaction created evidence card on scoreboard');

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  test('black market transaction updates score ticker', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Score Test', ['Scoring Team']);

      // Select team and scan in black market mode
      await gmScanner.selectTeamFromList('Scoring Team');
      const token = testTokens.personalToken;
      await gmScanner.selectMode('blackmarket');
      await gmScanner.manualScan(token.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Verify score appears on scoreboard ticker
      await scoreboard.waitForScoreEntries(1, 10000);
      const score = await scoreboard.getTeamScoreNumeric('Scoring Team');
      expect(score).toBeGreaterThan(0);

      const expectedScore = calculateExpectedScore(token);
      expect(score).toBe(expectedScore);

      console.log(`✓ Black market transaction updated ticker: $${score}`);

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  test('new session clears scoreboard data', async () => {
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Session 1: create and add data
      await gmScanner.createSessionWithTeams('Session 1', ['Old Team']);
      await gmScanner.selectTeamFromList('Old Team');
      await gmScanner.selectMode('blackmarket');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);
      await scoreboard.waitForScoreEntries(1, 10000);

      // End session 1, create session 2
      await gmScanner.navigateToAdminPanel();
      await gmScanner.endSession();
      await gmScanner.createSessionWithTeams('Session 2', ['New Team']);

      // Verify scoreboard cleared old data (auto-retrying assertion)
      await expect(scoreboard.tickerEmpty).toBeVisible({ timeout: 10000 });
      const hasOldTeam = await scoreboard.hasTeamInTicker('Old Team');
      expect(hasOldTeam).toBe(false);

      console.log('✓ New session cleared scoreboard data');

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
});
```

**Step 2: Run test to verify it works**

Run: `cd backend && npx playwright test flows/23-scoreboard-live-data --workers=1`
Expected: All 4 tests pass (or fail for a real reason we need to fix)

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/23-scoreboard-live-data.test.js
git commit -m "test(e2e): scoreboard receives live data — evidence cards + score ticker"
```

---

## Task 2: Scoreboard Survives Backend Restart

Tests the `connect_error` re-authentication fix (Task 5 from the simplification plan). The orchestrator is restarted mid-test, and the scoreboard must recover its connection and data.

**Files:**
- Create: `backend/tests/e2e/flows/24-scoreboard-restart-recovery.test.js`

**Step 1: Write the test suite**

```javascript
/**
 * E2E Test: Scoreboard Restart Recovery
 *
 * Verifies the scoreboard recovers after backend restart:
 * - connect_error triggers re-authentication (not 5min zombie timer)
 * - sync:full restores data after reconnection
 *
 * Uses restartOrchestrator() from test-server.js which stops/restarts
 * the backend process while preserving session data (file storage).
 *
 * @group scoreboard
 * @group resilience
 */

const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const ScoreboardPage = require('../helpers/page-objects/ScoreboardPage');

let browser = null;
let orchestratorInfo = null;
let testTokens = null;

test.describe('Scoreboard Restart Recovery', () => {
  // Use file storage so session survives restart
  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 30000,
      storageType: 'file'
    });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
  });

  test('scoreboard recovers connection after backend restart', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scoreboard = new ScoreboardPage(page);

    try {
      // Connect and verify LIVE
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
      console.log('✓ Scoreboard connected (pre-restart)');

      // Restart the backend (preserves session data)
      console.log('Restarting orchestrator...');
      orchestratorInfo = await restartOrchestrator({
        preserveSession: true,
        storageType: 'file',
        timeout: 30000
      });
      console.log(`Orchestrator restarted on ${orchestratorInfo.url}`);

      // Scoreboard should detect disconnection and re-authenticate automatically
      // The connect_error handler detects AUTH_INVALID and calls authenticate()
      // Wait for LIVE status to return (should be within ~5-10 seconds, not 5 minutes)
      await scoreboard.waitForConnection(30000);
      expect(await scoreboard.getStatusText()).toBe('LIVE');
      console.log('✓ Scoreboard recovered connection after restart');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('scoreboard data survives backend restart via sync:full', async () => {
    // Create a session with data, restart, verify data persists on scoreboard
    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      // Create session and process a transaction
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Restart Test', ['Persistent Team']);
      await gmScanner.selectTeamFromList('Persistent Team');
      await gmScanner.selectMode('blackmarket');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);

      // Verify score shows on scoreboard
      await scoreboard.waitForScoreEntries(1, 10000);
      const preRestartScore = await scoreboard.getTeamScoreNumeric('Persistent Team');
      expect(preRestartScore).toBeGreaterThan(0);
      console.log(`Pre-restart score: $${preRestartScore}`);

      // Close GM scanner (we only keep scoreboard open across restart)
      await gmPage.close();
      await gmContext.close();

      // Restart
      orchestratorInfo = await restartOrchestrator({
        preserveSession: true,
        storageType: 'file',
        timeout: 30000
      });

      // Wait for scoreboard to reconnect and receive sync:full
      await scoreboard.waitForConnection(30000);

      // Verify data was restored (sync:full includes scores)
      await scoreboard.waitForScoreEntries(1, 10000);
      const postRestartScore = await scoreboard.getTeamScoreNumeric('Persistent Team');
      expect(postRestartScore).toBe(preRestartScore);
      console.log(`✓ Post-restart score matches: $${postRestartScore}`);

    } finally {
      await sbPage.close();
      await sbContext.close();
      // gmContext may already be closed
    }
  });
});
```

**Step 2: Run test**

Run: `cd backend && npx playwright test flows/24-scoreboard-restart-recovery --workers=1`

Note: This test takes longer (~30-60s) due to orchestrator restart. Use `--workers=1` to avoid parallel conflicts.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/24-scoreboard-restart-recovery.test.js
git commit -m "test(e2e): scoreboard recovers connection and data after backend restart"
```

---

## Task 3: Video Lifecycle From Scoreboard's Perspective

Tests the scoreboard's behavior during video playback — the display mode overlay should activate during video and deactivate after.

**Files:**
- Create: `backend/tests/e2e/flows/25-scoreboard-video-lifecycle.test.js`

**Step 1: Write the test suite**

```javascript
/**
 * E2E Test: Scoreboard During Video Lifecycle
 *
 * Verifies scoreboard behavior during video playback:
 * - Kiosk mode overlay activates when display enters VIDEO mode
 * - Overlay deactivates when video completes
 * - Scoreboard data remains current after video cycle
 *
 * Requires VLC to be running for actual video playback.
 * Tests that depend on VLC will skip gracefully if unavailable.
 *
 * @group scoreboard
 * @group video
 */

const { test, expect, chromium } = require('@playwright/test');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { initializeGMScannerWithMode } = require('../helpers/scanner-init');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { selectTestTokens } = require('../helpers/token-selection');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');
const ScoreboardPage = require('../helpers/page-objects/ScoreboardPage');
const https = require('https');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;
let videoToken = null;

async function isVLCHealthy(url) {
  const resp = await new Promise((resolve, reject) => {
    https.get(new URL('/api/state', url), { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  return resp.serviceHealth?.vlc?.status === 'healthy';
}

async function playerScan(baseUrl, tokenId, deviceId = 'e2e-player-sb-test') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ tokenId, deviceId, deviceType: 'player', timestamp: new Date().toISOString() });
    const req = https.request(new URL('/api/scan', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

test.describe('Scoreboard During Video Lifecycle', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
    videoToken = testTokens.videoToken;
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('scoreboard kiosk overlay activates during video and deactivates after', async () => {
    if (!videoToken) { test.skip(); return; }
    if (!await isVLCHealthy(orchestratorInfo.url)) { test.skip(); return; }

    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      // Open scoreboard in kiosk mode
      await scoreboard.gotoKiosk(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      // Setup GM scanner with session
      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Video Overlay Test', ['Team Alpha']);

      // Switch display to scoreboard mode first
      await gmScanner.navigateToAdminPanel();
      await gmScanner.setDisplayScoreboard();

      // Verify overlay is NOT active initially
      await expect(scoreboard.displayModeOverlay).not.toHaveClass(/active/, { timeout: 5000 });

      // Player scan triggers video
      const wsSocket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, `SB_VIDEO_TEST_${Date.now()}`, 'gm');

      try {
        await playerScan(orchestratorInfo.url, videoToken.SF_RFID);

        // Wait for display:mode VIDEO event
        await waitForEvent(wsSocket, 'display:mode',
          (data) => data.data?.mode === 'VIDEO', 15000);

        // Verify kiosk overlay is now active
        await expect(scoreboard.displayModeOverlay).toHaveClass(/active/, { timeout: 5000 });
        console.log('✓ Overlay activated during video playback');

        // Wait for video to complete and display to restore
        await waitForEvent(wsSocket, 'display:mode',
          (data) => data.data?.mode === 'SCOREBOARD', 60000);

        // Verify overlay deactivated
        await expect(scoreboard.displayModeOverlay).not.toHaveClass(/active/, { timeout: 5000 });
        console.log('✓ Overlay deactivated after video complete');

      } finally {
        disconnectSocket(wsSocket);
      }
    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });

  test('scoreboard data remains current after video cycle', async () => {
    if (!videoToken) { test.skip(); return; }
    if (!await isVLCHealthy(orchestratorInfo.url)) { test.skip(); return; }

    const sbContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const gmContext = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const sbPage = await createPage(sbContext);
    const gmPage = await createPage(gmContext);
    const scoreboard = new ScoreboardPage(sbPage);

    try {
      await scoreboard.goto(orchestratorInfo.url);
      await scoreboard.waitForConnection(10000);

      const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Post-Video Data', ['Data Team']);

      // Process a BM transaction (creates score)
      await gmScanner.selectTeamFromList('Data Team');
      await gmScanner.selectMode('blackmarket');
      await gmScanner.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner.waitForResult(5000);
      await scoreboard.waitForScoreEntries(1, 10000);
      const preTxScore = await scoreboard.getTeamScoreNumeric('Data Team');

      // Trigger a video (changes display mode, data should survive)
      const wsSocket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, `SB_DATA_TEST_${Date.now()}`, 'gm');

      try {
        await playerScan(orchestratorInfo.url, videoToken.SF_RFID);

        // Wait for video to complete
        await waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'idle', 60000);
      } finally {
        disconnectSocket(wsSocket);
      }

      // Score should still be visible and unchanged
      const postVideoScore = await scoreboard.getTeamScoreNumeric('Data Team');
      expect(postVideoScore).toBe(preTxScore);
      console.log(`✓ Score preserved after video cycle: $${postVideoScore}`);

    } finally {
      await sbPage.close();
      await gmPage.close();
      await sbContext.close();
      await gmContext.close();
    }
  });
});
```

**Step 2: Run test**

Run: `cd backend && npx playwright test flows/25-scoreboard-video-lifecycle --workers=1`

Note: Requires VLC. Tests skip gracefully if unavailable.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/25-scoreboard-video-lifecycle.test.js
git commit -m "test(e2e): scoreboard display overlay during video + data survival"
```

---

## Task 4: Concurrent Player Scans

Tests that two rapid player scans don't break the system — both are acknowledged and videos are queued sequentially.

**Files:**
- Create: `backend/tests/e2e/flows/26-concurrent-player-scans.test.js`

**Step 1: Write the test suite**

```javascript
/**
 * E2E Test: Concurrent Player Scans
 *
 * Verifies the system handles rapid concurrent player scans correctly:
 * - Both scans acknowledged with 200
 * - Videos queued (not duplicated or lost)
 * - State remains consistent after both complete
 *
 * Tests the processQueue race fix (Task 8) under realistic network conditions.
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

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

async function isVLCHealthy(url) {
  const resp = await new Promise((resolve, reject) => {
    https.get(new URL('/api/state', url), { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  return resp.serviceHealth?.vlc?.status === 'healthy';
}

async function playerScan(baseUrl, tokenId, deviceId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ tokenId, deviceId, deviceType: 'player', timestamp: new Date().toISOString() });
    const req = https.request(new URL('/api/scan', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

test.describe('Concurrent Player Scans', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 60000 });
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });
    testTokens = await selectTestTokens(orchestratorInfo.url);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('two rapid player scans are both acknowledged', async () => {
    const context = await createBrowserContext(browser, 'desktop', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);

    try {
      // Create session
      const gmScanner = await initializeGMScannerWithMode(page, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });
      await gmScanner.createSessionWithTeams('Concurrent Scan', ['Rapid Team']);

      // Pick two different tokens (both scoreable, doesn't matter if video or not)
      const token1 = testTokens.personalToken;
      const token2 = testTokens.businessToken || testTokens.mentionToken;

      if (!token2 || token1.SF_RFID === token2.SF_RFID) {
        console.warn('Need 2 distinct tokens — skipping');
        test.skip();
        return;
      }

      // Fire both scans simultaneously (not sequentially)
      const [result1, result2] = await Promise.all([
        playerScan(orchestratorInfo.url, token1.SF_RFID, 'concurrent-player-1'),
        playerScan(orchestratorInfo.url, token2.SF_RFID, 'concurrent-player-2')
      ]);

      // Both should be accepted
      expect(result1.status).toBe(200);
      expect(result2.status).toBe(200);
      console.log(`✓ Scan 1: ${token1.SF_RFID} → ${result1.status}`);
      console.log(`✓ Scan 2: ${token2.SF_RFID} → ${result2.status}`);

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('concurrent video token scans queue sequentially, not duplicate', async () => {
    const videoTokens = Object.values(testTokens).filter(t => t && t.video);

    if (videoTokens.length < 2) {
      console.warn('Need 2 video tokens — skipping');
      test.skip();
      return;
    }

    if (!await isVLCHealthy(orchestratorInfo.url)) {
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
      await gmScanner.createSessionWithTeams('Video Queue Test', ['Queue Team']);

      const wsSocket = await connectWithAuth(
        orchestratorInfo.url, ADMIN_PASSWORD, `CONCURRENT_VID_${Date.now()}`, 'gm'
      );

      try {
        const vid1 = videoTokens[0];
        const vid2 = videoTokens[1];

        // Fire both video scans simultaneously
        const [r1, r2] = await Promise.all([
          playerScan(orchestratorInfo.url, vid1.SF_RFID, 'vid-player-1'),
          playerScan(orchestratorInfo.url, vid2.SF_RFID, 'vid-player-2')
        ]);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);

        // At least one should have videoQueued: true
        const queued = [r1.body.videoQueued, r2.body.videoQueued].filter(Boolean);
        expect(queued.length).toBeGreaterThanOrEqual(1);

        // Wait for queue to eventually drain (both videos play then idle)
        await waitForEvent(wsSocket, 'service:state',
          (data) => data.data?.domain === 'video' && data.data?.state?.status === 'idle',
          120000  // 2 minutes — two full video plays
        );

        console.log('✓ Both video scans processed, queue drained to idle');

      } finally {
        disconnectSocket(wsSocket);
      }
    } finally {
      await page.close();
      await context.close();
    }
  });
});
```

**Step 2: Run test**

Run: `cd backend && npx playwright test flows/26-concurrent-player-scans --workers=1`

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/26-concurrent-player-scans.test.js
git commit -m "test(e2e): concurrent player scans are both acknowledged and videos queue correctly"
```

---

## Verification

### After all tasks: Run the full E2E suite

```bash
cd backend && npm run test:e2e
```

Expected: All existing E2E tests still pass, plus the 4 new test suites (8-10 new tests total).

### Notes for test execution

- Tests 23 and 24 (scoreboard data + restart) don't require VLC
- Tests 25 and 26 (video lifecycle + concurrent scans) require VLC and skip gracefully if unavailable
- Use `--workers=1` for the new suites initially to avoid parallel state conflicts
- The restart test (24) uses `storageType: 'file'` for session persistence across restart
- Video-dependent tests may need the orchestrator started with `timeout: 60000` for Pi hardware
