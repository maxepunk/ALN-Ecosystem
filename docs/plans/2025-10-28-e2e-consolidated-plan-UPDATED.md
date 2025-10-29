# E2E Test Plan: User Journey Focus (UPDATED - Accurate Implementation Patterns)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete E2E test implementation for ALN Ecosystem, focusing on complete user journeys rather than component-level tests.

**Current Status:** 90 passing test runs (45 unique tests across 2 browsers) ✅
- 00-01 series: 58 passing (29 tests)
- 07a-c series: 32 passing (16 tests)
**Revised Target:** ~70 focused tests (not 110+) - ALREADY AT 64%!
**Estimated Time:** 2-3 hours remaining (Journey tests)
**Next:** Journey 1 (Player Scanner Offline-First), Journey 2 (Video Orchestration), Journey 3 (Multi-Device)

---

## CRITICAL: Implementation Notes

**This plan has been updated with ACTUAL code patterns from the codebase:**
- Real page object methods (GMScannerPage, PlayerScannerPage)
- Actual selectors (ID-based, not data-testid)
- Production token IDs (sof002, rat002, mab002, etc.)
- Correct helper function usage

**Test Token Strategy:**
- Use production token `jaw001` (ONLY video token) for Journey 2 (video tests)
- Player scanner has NO duplicate detection - can scan jaw001 multiple times to test video queueing
- Use production tokens (sof002, rat002, mab002, etc.) for Journey 1 & 3

---

## BATCH 1: Complete Test 07 Series ✅ COMPLETE

**Status:** ✅ ALL TESTS PASSING (16 unique tests, 32 runs across chromium + mobile-chrome)
**Tests:** 5 (07a) + 6 (07b) + 5 (07c) = 16 tests
**Time:** ~3 hours spent (07c debugging + systematic fix)
**Session Progress:** Started with 58 passing (00-01 series) → Now 90 passing (+32 from 07 series)

**Files:**
- ✅ `backend/tests/e2e/flows/07a-gm-scanner-standalone-blackmarket.test.js` (5 tests)
- ✅ `backend/tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js` (6 tests)
- ✅ `backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js` (5 tests) **FIXED**

**Rationale:** These tests validate critical parity between standalone (GitHub Pages deployment) and networked (orchestrator deployment) modes. Essential for architectural flexibility.

**Test 07b Implementation Notes:**
- Fixed by using established pattern: `page.evaluate(() => window.App.processNFCRead(...))` instead of `scanner.manualEntry()`
- Pattern bypasses UI prompt() dialog which blocks in headless Playwright
- All 6 tests now validate WebSocket transaction flow per AsyncAPI contract
- Tests confirm: `transaction:submit` → backend processing → `transaction:new` broadcast
- Scoring calculations verified: Personal (500), Business 3x (15,000), Group 3x (135,000)
- Duplicate detection validated: same team and cross-team rejections

**Test 07c Implementation Notes (2025-10-28) - COMPLETE:**
- **Status**: ✅ 10/10 tests passing, all scoring parity bugs FIXED
- **Bugs Found & Fixed**:
  1. ✅ Test helper anti-pattern (reimplemented scoring in test fallback) - Removed
  2. ✅ Missing `transaction.points` field in app.js - Added calculation
  3. ✅ Missing `TokenManager.getAllTokens()` method - Added to tokenManager.js
  4. ✅ **Root Cause: `saveLocalSession()` called BEFORE `updateLocalScores()`**
     - **Bug**: StandaloneDataManager saved transaction data before calculating scores
     - **Impact**: Last token's score remained in memory, not persisted to localStorage
     - **Fix**: Moved `saveLocalSession()` to AFTER `updateLocalScores()` in `addTransaction()`
     - **Location**: `ALNScanner/js/core/standaloneDataManager.js:26-36`
     - **Result**: All parity tests now pass (25,500 = 500 + 15,000 + 10,000 ✓)
- **Architectural Concern**: 4 bugs in standalone scoring revealed by systematic debugging
- **Recommendation**: See architectural refactor proposal (to be written) for long-term fix

---

## BATCH 2: Journey Tests (Accurate Patterns)

### Journey 1: Player Scanner Offline-First Complete Flow

**File:** `backend/tests/e2e/flows/40-player-scanner-offline-journey.test.js`
**Estimated Tests:** 8 tests
**Duration:** 45 minutes to implement

**User Story:**
> As a player, I open the scanner app at the event, scan memory tokens to view their media, lose connection when I walk around, continue scanning offline, reconnect later, and see my queued scans sync automatically with video playback triggering on the TV.

**Test Scenarios (CORRECTED PATTERNS):**

```javascript
const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const {
  createBrowserContext,
  createPage,
  closeAllContexts
} = require('../setup/browser-contexts');
const {
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets
} = require('../setup/websocket-client');
const PlayerScannerPage = require('../helpers/page-objects/PlayerScannerPage');
const GMScannerPage = require('../helpers/page-objects/GMScannerPage');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

describe('Journey 1: Player Scanner Offline-First Complete Flow', () => {

  beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, port: 3000, timeout: 30000 });

    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
  });

  afterAll(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  afterEach(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
  });

  test('01. Player opens app and auto-discovers orchestrator', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Check connection status (actual selector: #connection-status)
    const status = await playerScanner.getConnectionStatus();
    expect(status.connected).toBe(true);
    expect(status.status).toContain('Online');
  });

  test('02. Scan image token while connected - displays locally', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Scan production token: sof002 (Personal, image token)
    await playerScanner.manualEntry('sof002');
    await playerScanner.waitForMemoryDisplay();

    // Verify image displayed (actual method from page object)
    const imageSrc = await playerScanner.getDisplayedImage();
    expect(imageSrc).toContain('assets/images/sof002.bmp');
  });

  test('03. Scan video token while connected - queues video playback', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    const gmContext = await createBrowserContext(browser, 'desktop');
    const gmPage = await createPage(gmContext);
    const gmScanner = new GMScannerPage(gmPage);

    // Initialize GM scanner in networked mode to monitor video queue
    await gmScanner.goto();
    await gmScanner.waitForSelector(gmScanner.selectors.gameModeScreen);
    await gmPage.evaluate(() => window.App.selectGameMode('networked'));
    await gmPage.waitForSelector(gmScanner.selectors.connectionModal, { state: 'visible' });
    await gmScanner.manualConnect(
      orchestratorInfo.url,
      'Test_Admin_Station',
      'test-admin-password'
    );
    await gmScanner.waitForConnection();

    // Switch to admin tab to view video queue
    await gmScanner.switchToAdminTab();

    // Player scans production video token
    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await playerScanner.manualEntry('jaw001'); // Production video token

    // Wait for video processing modal (actual selector: #video-processing)
    await playerScanner.waitForVideoProcessingModal();

    // Verify video appears in GM scanner admin panel queue (actual selector: #video-queue-list)
    await gmPage.waitForSelector('#video-queue-list .queue-item', { timeout: 5000 });
    const queueItems = await gmPage.$$eval('#video-queue-list .queue-item', items =>
      items.map(item => item.textContent)
    );
    expect(queueItems.some(item => item.includes('jaw001'))).toBe(true);
  });

  test('04. Player loses connection - offline mode activates', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Simulate offline
    await page.context().setOffline(true);

    // Wait for connection status to change (page object method)
    await page.waitForTimeout(500); // Allow state update
    const status = await playerScanner.getConnectionStatus();
    expect(status.connected).toBe(false);

    // Verify offline queue indicator exists
    const queueSize = await playerScanner.getOfflineQueueSize();
    expect(queueSize).toBe(0); // Initially empty
  });

  test('05. Scan multiple tokens while offline - queued locally', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Scan multiple tokens (production tokens: sof002, rat002, mab002)
    const offlineTokens = ['sof002', 'rat002', 'mab002'];

    for (const tokenId of offlineTokens) {
      await playerScanner.manualEntry(tokenId);
      await playerScanner.waitForMemoryDisplay();

      // Continue scanning
      const currentScreen = await playerScanner.getCurrentScreen();
      if (currentScreen === 'memory') {
        await playerScanner.continueScan();
      }
    }

    // Verify offline queue
    const queueSize = await playerScanner.getOfflineQueueSize();
    expect(queueSize).toBe(3);
  });

  test('06. Player reconnects - offline queue syncs automatically', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Go offline and scan
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await playerScanner.manualEntry('sof002');
    await playerScanner.waitForMemoryDisplay();

    // Verify queued
    let queueSize = await playerScanner.getOfflineQueueSize();
    expect(queueSize).toBe(1);

    // Reconnect
    await page.context().setOffline(false);
    await page.waitForTimeout(1000); // Allow reconnection

    // Wait for queue to sync (page evaluates orchestrator.offlineQueue)
    await page.waitForFunction(() => {
      return window.orchestrator && window.orchestrator.offlineQueue.length === 0;
    }, { timeout: 5000 });

    queueSize = await playerScanner.getOfflineQueueSize();
    expect(queueSize).toBe(0);
  });

  test('07. Orchestrator processes all queued scans', async () => {
    const socket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'GM_ADMIN_MONITOR',
      'gm'
    );

    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Go offline and scan multiple tokens
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    const offlineTokens = ['sof002', 'rat002'];
    for (const tokenId of offlineTokens) {
      await playerScanner.manualEntry(tokenId);
      await playerScanner.waitForMemoryDisplay();
      const currentScreen = await playerScanner.getCurrentScreen();
      if (currentScreen === 'memory') {
        await playerScanner.continueScan();
      }
    }

    // Wait for transaction broadcasts
    const transaction1Promise = waitForEvent(socket, 'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === 'sof002',
      10000
    );
    const transaction2Promise = waitForEvent(socket, 'transaction:new',
      (event) => event.data.transaction && event.data.transaction.tokenId === 'rat002',
      10000
    );

    // Reconnect
    await page.context().setOffline(false);

    // Verify transactions processed
    const tx1 = await transaction1Promise;
    const tx2 = await transaction2Promise;

    expect(tx1.data.transaction.source).toBe('player-scanner');
    expect(tx2.data.transaction.source).toBe('player-scanner');
  });

  test('08. Queued video scan triggers VLC playback after sync', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    const gmContext = await createBrowserContext(browser, 'desktop');
    const gmPage = await createPage(gmContext);
    const gmScanner = new GMScannerPage(gmPage);

    // Setup GM scanner admin view
    await gmScanner.goto();
    await gmPage.evaluate(() => window.App.selectGameMode('networked'));
    await gmPage.waitForSelector(gmScanner.selectors.connectionModal, { state: 'visible' });
    await gmScanner.manualConnect(orchestratorInfo.url, 'Admin_Monitor', 'test-admin-password');
    await gmScanner.waitForConnection();
    await gmScanner.switchToAdminTab();

    // Player scans video token while offline
    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await playerScanner.manualEntry('jaw001');
    await playerScanner.waitForMemoryDisplay();

    // Reconnect and sync
    await page.context().setOffline(false);
    await page.waitForFunction(() => {
      return window.orchestrator && window.orchestrator.offlineQueue.length === 0;
    }, { timeout: 5000 });

    // Verify video queued in admin panel
    await gmPage.waitForSelector('#video-queue-list .queue-item', { timeout: 5000 });
    const queueItems = await gmPage.$$eval('#video-queue-list .queue-item', items =>
      items.map(item => item.textContent)
    );
    expect(queueItems.some(item => item.includes('jaw001'))).toBe(true);
  });
});
```

---

### Journey 2: Video Orchestration Complete Flow

**File:** `backend/tests/e2e/flows/41-video-orchestration-journey.test.js`
**Estimated Tests:** 7 tests
**Duration:** 45 minutes to implement

**CRITICAL NOTE:** Production has ONLY ONE video token (jaw001.mp4). Player scanner has NO duplicate detection, so we can scan jaw001 multiple times to test video queueing. GM scanner has duplicate detection but does NOT trigger video playback, so duplicate detection is irrelevant for video tests.

**User Story:**
> As a GM, when players scan memory tokens with video content, I expect the video to automatically queue, play on the TV via VLC, complete without freezing, and return to the idle loop - all without manual intervention.

**Test Scenarios (CORRECTED PATTERNS):**

```javascript
const { test, expect, chromium } = require('@playwright/test');
const axios = require('axios');
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const {
  createBrowserContext,
  createPage,
  closeAllContexts
} = require('../setup/browser-contexts');
const PlayerScannerPage = require('../helpers/page-objects/PlayerScannerPage');
const GMScannerPage = require('../helpers/page-objects/GMScannerPage');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

describe('Journey 2: Video Orchestration Complete Flow', () => {

  beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000,
      env: { FEATURE_VIDEO_PLAYBACK: 'true', FEATURE_IDLE_LOOP: 'true' }
    });

    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
  });

  afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  afterEach(async () => {
    await closeAllContexts();
  });

  test('01. Orchestrator detects VLC and starts idle loop', async () => {
    // Check orchestrator health
    const healthResponse = await axios.get(`${orchestratorInfo.url}/health`, {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    const health = healthResponse.data;

    expect(health.vlc.connected).toBe(true);

    // Check VLC status (actual VLC HTTP API pattern)
    const vlcAuth = Buffer.from(`:vlc`).toString('base64');
    const vlcResponse = await axios.get(`http://localhost:${vlcInfo.port}/requests/status.json`, {
      headers: { Authorization: `Basic ${vlcAuth}` }
    });
    const vlcStatus = vlcResponse.data;

    // If idle loop enabled, should be playing
    if (process.env.FEATURE_IDLE_LOOP === 'true') {
      expect(vlcStatus.state).toBe('playing');
    }
  });

  test('02. Player scan triggers video queue addition', async () => {
    const context = await createBrowserContext(browser, 'mobile');
    const page = await createPage(context);
    const playerScanner = new PlayerScannerPage(page);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Scan production video token (jaw001 - ONLY video token in production)
    await playerScanner.manualEntry('jaw001');

    // Should show video processing modal (actual selector)
    await playerScanner.waitForVideoProcessingModal(5000);

    expect(await playerScanner.isVideoProcessingModalVisible()).toBe(true);
  });

  test('03. Video appears in backend queue', async () => {
    const gmContext = await createBrowserContext(browser, 'desktop');
    const gmPage = await createPage(gmContext);
    const gmScanner = new GMScannerPage(gmPage);

    // Initialize GM scanner admin view
    await gmScanner.goto();
    await gmPage.evaluate(() => window.App.selectGameMode('networked'));
    await gmPage.waitForSelector(gmScanner.selectors.connectionModal, { state: 'visible' });
    await gmScanner.manualConnect(orchestratorInfo.url, 'Admin_Video_Monitor', 'test-admin-password');
    await gmScanner.waitForConnection();
    await gmScanner.switchToAdminTab();

    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await playerScanner.manualEntry('jaw001');

    // Check queue in admin panel (actual selector: #video-queue-list)
    await gmPage.waitForSelector('#video-queue-list .queue-item', { timeout: 5000 });
    const queueItems = await gmPage.$$eval('#video-queue-list .queue-item', items =>
      items.map(item => item.textContent)
    );

    expect(queueItems.length).toBeGreaterThan(0);
    expect(queueItems.some(item => item.includes('jaw001'))).toBe(true);
  });

  test('04. VLC switches from idle loop to queued video', async () => {
    const gmContext = await createBrowserContext(browser, 'desktop');
    const gmPage = await createPage(gmContext);
    const gmScanner = new GMScannerPage(gmPage);

    await gmScanner.goto();
    await gmPage.evaluate(() => window.App.selectGameMode('networked'));
    await gmPage.waitForSelector(gmScanner.selectors.connectionModal, { state: 'visible' });
    await gmScanner.manualConnect(orchestratorInfo.url, 'Admin_VLC_Monitor', 'test-admin-password');
    await gmScanner.waitForConnection();
    await gmScanner.switchToAdminTab();

    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await playerScanner.manualEntry('jaw001');

    // Poll VLC status for video playback (use waitForFunction pattern)
    const vlcAuth = Buffer.from(`:vlc`).toString('base64');

    await gmPage.waitForFunction(async ({ vlcPort, auth, videoFile }) => {
      try {
        const response = await fetch(`http://localhost:${vlcPort}/requests/status.json`, {
          headers: { Authorization: `Basic ${auth}` }
        });
        const status = await response.json();
        return status.information?.category?.meta?.filename?.includes(videoFile);
      } catch (e) {
        return false;
      }
    }, { vlcPort: vlcInfo.port, auth: vlcAuth, videoFile: 'jaw001.mp4' }, { timeout: 15000 });

    // Verify video playing in admin UI (actual selector: #video-info)
    const videoInfo = await gmPage.textContent('#video-info');
    expect(videoInfo).toContain('jaw001');
  });

  test('05. Video completes without freezing or errors', async () => {
    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await playerScanner.manualEntry('jaw001'); // Production video token

    // Wait for video to complete (video + buffer)
    const vlcAuth = Buffer.from(`:vlc`).toString('base64');

    await playerPage.waitForFunction(async ({ vlcPort, auth }) => {
      try {
        const response = await fetch(`http://localhost:${vlcPort}/requests/status.json`, {
          headers: { Authorization: `Basic ${auth}` }
        });
        const status = await response.json();
        // Video completed when state is stopped or back to idle loop
        return status.state === 'stopped' || status.information?.category?.meta?.filename?.includes('idle-loop');
      } catch (e) {
        return false;
      }
    }, { vlcPort: vlcInfo.port, auth: vlcAuth }, { timeout: 20000 });

    // Verify VLC not paused/errored (actual VLC states: playing, paused, stopped)
    const vlcResponse = await axios.get(`http://localhost:${vlcInfo.port}/requests/status.json`, {
      headers: { Authorization: `Basic ${vlcAuth}` }
    });
    expect(vlcResponse.data.state).not.toBe('paused');
  });

  test('06. Idle loop resumes after video completion', async () => {
    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();
    await playerScanner.manualEntry('jaw001'); // Production video

    const vlcAuth = Buffer.from(`:vlc`).toString('base64');

    // Wait for video to finish and idle loop to resume
    await playerPage.waitForFunction(async ({ vlcPort, auth }) => {
      try {
        const response = await fetch(`http://localhost:${vlcPort}/requests/status.json`, {
          headers: { Authorization: `Basic ${auth}` }
        });
        const status = await response.json();
        return status.information?.category?.meta?.filename?.includes('idle-loop') && status.state === 'playing';
      } catch (e) {
        return false;
      }
    }, { vlcPort: vlcInfo.port, auth: vlcAuth }, { timeout: 30000 });

    const vlcResponse = await axios.get(`http://localhost:${vlcInfo.port}/requests/status.json`, {
      headers: { Authorization: `Basic ${vlcAuth}` }
    });

    expect(vlcResponse.data.information.category.meta.filename).toContain('idle-loop');
    expect(vlcResponse.data.state).toBe('playing');
  });

  test('07. Multiple videos queue and play sequentially', async () => {
    const gmContext = await createBrowserContext(browser, 'desktop');
    const gmPage = await createPage(gmContext);
    const gmScanner = new GMScannerPage(gmPage);

    await gmScanner.goto();
    await gmPage.evaluate(() => window.App.selectGameMode('networked'));
    await gmPage.waitForSelector(gmScanner.selectors.connectionModal, { state: 'visible' });
    await gmScanner.manualConnect(orchestratorInfo.url, 'Admin_Multi_Video', 'test-admin-password');
    await gmScanner.waitForConnection();
    await gmScanner.switchToAdminTab();

    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);

    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Queue jaw001 three times (player scanner has NO duplicate detection)
    // This tests: sequential queueing, FIFO processing, queue management
    const videoScans = ['jaw001', 'jaw001', 'jaw001'];

    for (const tokenId of videoScans) {
      await playerScanner.manualEntry(tokenId);
      await playerScanner.waitForVideoProcessingModal();
      await playerScanner.waitForVideoProcessingModalHidden(5000);
      await playerPage.waitForTimeout(500); // Allow queue update
    }

    // Verify queue has 3 instances of jaw001 (actual selector: #video-queue-list .queue-item)
    await gmPage.waitForFunction(
      (count) => document.querySelectorAll('#video-queue-list .queue-item').length === count,
      3,
      { timeout: 5000 }
    );

    const queueCount = await gmPage.$$eval('#video-queue-list .queue-item', items => items.length);
    expect(queueCount).toBe(3);

    // Wait for first jaw001 to start playing
    const vlcAuth = Buffer.from(`:vlc`).toString('base64');
    await gmPage.waitForFunction(async ({ vlcPort, auth, videoFile }) => {
      try {
        const response = await fetch(`http://localhost:${vlcPort}/requests/status.json`, {
          headers: { Authorization: `Basic ${auth}` }
        });
        const status = await response.json();
        return status.information?.category?.meta?.filename?.includes(videoFile);
      } catch (e) {
        return false;
      }
    }, { vlcPort: vlcInfo.port, auth: vlcAuth, videoFile: 'jaw001.mp4' }, { timeout: 15000 });

    // Verify queue decrements as videos play (wait for queue to be 2 after first video starts)
    await gmPage.waitForFunction(
      () => document.querySelectorAll('#video-queue-list .queue-item').length === 2,
      { timeout: 20000 }
    );

    const updatedQueueCount = await gmPage.$$eval('#video-queue-list .queue-item', items => items.length);
    expect(updatedQueueCount).toBeLessThan(3);
  });
});
```

---

### Journey 3: Multi-Device Real-Time Coordination

**File:** `backend/tests/e2e/flows/42-multi-device-coordination-journey.test.js`
**Estimated Tests:** 8 tests
**Duration:** 60 minutes to implement

(Continuing with accurate patterns based on actual codebase...)


**User Story:**
> As a GM running an event, I have 3 GM scanners at different stations, 2 player scanners roaming, and 1 scoreboard on the TV. When tokens are scanned simultaneously, all devices update in real-time with accurate scores and rankings without conflicts.

**Test Scenarios (CORRECTED PATTERNS - Using actual page objects and WebSocket helpers):**

```javascript
const { test, expect, chromium } = require('@playwright/test');
const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');
const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const {
  createBrowserContext,
  createPage,
  closeAllContexts
} = require('../setup/browser-contexts');
const {
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets
} = require('../setup/websocket-client');
const {
  initializeGMScannerWithMode,
  getTeamScore
} = require('../helpers/scanner-init');
const GMScannerPage = require('../helpers/page-objects/GMScannerPage');
const PlayerScannerPage = require('../helpers/page-objects/PlayerScannerPage');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

describe('Journey 3: Multi-Device Real-Time Coordination', () => {

  beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, port: 3000, timeout: 30000 });

    browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
  });

  afterAll(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  afterEach(async () => {
    await closeAllContexts();
    await cleanupAllSockets();
  });

  test('01. Connect 3 GM scanners, 2 player scanners', async () => {
    // Create session via WebSocket (actual pattern from test 01)
    const adminSocket = await connectWithAuth(
      orchestratorInfo.url,
      'test-admin-password',
      'ADMIN_SESSION_CREATE',
      'gm'
    );

    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: { name: 'Multi-Device Test', teams: ['001', '002', '003', '004'] }
      },
      timestamp: new Date().toISOString()
    });

    await waitForEvent(adminSocket, 'gm:command:ack', (event) => event.data.action === 'session:create', 5000);

    // Create 3 GM scanner contexts
    const gm1Context = await createBrowserContext(browser, 'mobile');
    const gm1Page = await createPage(gm1Context);
    const gmScanner1 = await initializeGMScannerWithMode(gm1Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const gm2Context = await createBrowserContext(browser, 'mobile');
    const gm2Page = await createPage(gm2Context);
    const gmScanner2 = await initializeGMScannerWithMode(gm2Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const gm3Context = await createBrowserContext(browser, 'mobile');
    const gm3Page = await createPage(gm3Context);
    const gmScanner3 = await initializeGMScannerWithMode(gm3Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Create 2 player scanner contexts
    const player1Context = await createBrowserContext(browser, 'mobile');
    const player1Page = await createPage(player1Context);
    const playerScanner1 = new PlayerScannerPage(player1Page);
    await playerScanner1.gotoNetworked(orchestratorInfo.url);
    await playerScanner1.waitForInitialization();

    const player2Context = await createBrowserContext(browser, 'mobile');
    const player2Page = await createPage(player2Context);
    const playerScanner2 = new PlayerScannerPage(player2Page);
    await playerScanner2.gotoNetworked(orchestratorInfo.url);
    await playerScanner2.waitForInitialization();

    // Verify all connected
    const status1 = await gmScanner1.getConnectionStatus();
    const status2 = await gmScanner2.getConnectionStatus();
    const status3 = await gmScanner3.getConnectionStatus();
    const playerStatus1 = await playerScanner1.getConnectionStatus();
    const playerStatus2 = await playerScanner2.getConnectionStatus();

    expect(status1).toBe('connected');
    expect(status2).toBe('connected');
    expect(status3).toBe('connected');
    expect(playerStatus1.connected).toBe(true);
    expect(playerStatus2.connected).toBe(true);
  });

  test('02. GM scans token - all devices receive state update', async () => {
    // Create session
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_MULTI_DEVICE', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Test Session', teams: ['001'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    // Create 3 GM scanners
    const gm1Context = await createBrowserContext(browser, 'mobile');
    const gm1Page = await createPage(gm1Context);
    const gmScanner1 = await initializeGMScannerWithMode(gm1Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const gm2Context = await createBrowserContext(browser, 'mobile');
    const gm2Page = await createPage(gm2Context);
    const gmScanner2 = await initializeGMScannerWithMode(gm2Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const gm3Context = await createBrowserContext(browser, 'mobile');
    const gm3Page = await createPage(gm3Context);
    const gmScanner3 = await initializeGMScannerWithMode(gm3Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // GM1 scans token for team 001 (production token: sof002 = 500 points)
    await gmScanner1.enterTeam('001');
    await gmScanner1.confirmTeam();
    await gmScanner1.manualEntry('sof002');
    await gmScanner1.waitForResult();

    // Wait for state to propagate
    await gm1Page.waitForTimeout(1000);

    // Verify all GMs show updated score (actual page object method)
    const score1 = await getTeamScore(gm1Page, '001', 'networked');
    const score2 = await getTeamScore(gm2Page, '001', 'networked');
    const score3 = await getTeamScore(gm3Page, '001', 'networked');

    expect(score1).toBe(500);
    expect(score2).toBe(500);
    expect(score3).toBe(500);
  });

  test('03. Two GM stations scan simultaneously - no race conditions', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_RACE_TEST', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Race Test', teams: ['002', '003'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const gm1Context = await createBrowserContext(browser, 'mobile');
    const gm1Page = await createPage(gm1Context);
    const gmScanner1 = await initializeGMScannerWithMode(gm1Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const gm2Context = await createBrowserContext(browser, 'mobile');
    const gm2Page = await createPage(gm2Context);
    const gmScanner2 = await initializeGMScannerWithMode(gm2Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Setup teams
    await gmScanner1.enterTeam('002');
    await gmScanner1.confirmTeam();
    await gmScanner2.enterTeam('003');
    await gmScanner2.confirmTeam();

    // Scan simultaneously (production tokens: rat002 = 15000, mab002 = 10000)
    const scan1Promise = gmScanner1.manualEntry('rat002').then(() => gmScanner1.waitForResult());
    const scan2Promise = gmScanner2.manualEntry('mab002').then(() => gmScanner2.waitForResult());

    await Promise.all([scan1Promise, scan2Promise]);
    await gm1Page.waitForTimeout(1000);

    // Verify both scores recorded correctly (no lost updates)
    const score2 = await getTeamScore(gm1Page, '002', 'networked');
    const score3 = await getTeamScore(gm1Page, '003', 'networked');

    expect(score2).toBe(15000); // Business 4-star: 5000 × 3 = 15000
    expect(score3).toBe(10000); // Personal 5-star: 10000 × 1 = 10000
  });

  test('04. Rapid successive scans from one GM - all process correctly', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_RAPID_TEST', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Rapid Test', teams: ['001'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const gmContext = await createBrowserContext(browser, 'mobile');
    const gmPage = await createPage(gmContext);
    const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Scan sequence (production tokens)
    const rapidTokens = ['sof002', 'rat002', 'mab002'];
    await scanTokenSequence(gmScanner, rapidTokens, '001');

    // Verify all transactions processed
    const finalScore = await getTeamScore(gmPage, '001', 'networked');
    const expectedScore = 500 + 15000 + 10000; // sof002(500) + rat002(15000) + mab002(10000) = 25500
    expect(finalScore).toBe(expectedScore);
  });

  test('05. Player scans video during GM activity - no conflicts', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_MIXED_TEST', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Mixed Test', teams: ['004'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const gmContext = await createBrowserContext(browser, 'mobile');
    const gmPage = await createPage(gmContext);
    const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);
    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // GM scans for score
    await gmScanner.enterTeam('004');
    await gmScanner.confirmTeam();
    const gmScanPromise = gmScanner.manualEntry('sof002').then(() => gmScanner.waitForResult());

    // Player scans video simultaneously
    const playerScanPromise = playerScanner.manualEntry('jaw001').then(() =>
      playerScanner.waitForVideoProcessingModal()
    );

    await Promise.all([gmScanPromise, playerScanPromise]);

    // Verify both processed
    const score = await getTeamScore(gmPage, '004', 'networked');
    expect(score).toBe(500);

    const videoModalVisible = await playerScanner.isVideoProcessingModalVisible();
    expect(videoModalVisible).toBe(true);
  });

  test('06. Scoreboard rankings adjust as teams score', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_SCOREBOARD_TEST', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Scoreboard Test', teams: ['001', '002'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    const gmContext = await createBrowserContext(browser, 'mobile');
    const gmPage = await createPage(gmContext);
    const gmScanner = await initializeGMScannerWithMode(gmPage, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // View scoreboard (actual page object method)
    await gmScanner.openScoreboard();

    // Get initial rankings
    const initialRankings = await gmScanner.getTeamRankings();
    expect(initialRankings.length).toBe(2);

    // Close scoreboard, scan token for team 002
    await gmScanner.closeScoreboard();
    await gmScanner.enterTeam('002');
    await gmScanner.confirmTeam();
    await gmScanner.manualEntry('mab002'); // High value token
    await gmScanner.waitForResult();

    // View scoreboard again
    await gmScanner.finishTeam();
    await gmScanner.openScoreboard();
    const updatedRankings = await gmScanner.getTeamRankings();

    // Team 002 should now have higher score
    const team002Rank = updatedRankings.find(r => r.team.includes('002'));
    expect(parseInt(team002Rank.score)).toBeGreaterThan(0);
  });

  test('07. GM scanner disconnects and reconnects - receives full state sync', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_RECONNECT_TEST', 'gm');
    adminSocket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:create', payload: { name: 'Reconnect Test', teams: ['001'] } },
      timestamp: new Date().toISOString()
    });
    await waitForEvent(adminSocket, 'gm:command:ack', null, 5000);

    // GM1 scans token
    const gm1Context = await createBrowserContext(browser, 'mobile');
    const gm1Page = await createPage(gm1Context);
    const gmScanner1 = await initializeGMScannerWithMode(gm1Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    await gmScanner1.enterTeam('001');
    await gmScanner1.confirmTeam();
    await gmScanner1.manualEntry('sof002');
    await gmScanner1.waitForResult();

    // Get score
    const scoreBefore = await getTeamScore(gm1Page, '001', 'networked');
    expect(scoreBefore).toBe(500);

    // Close GM1 (disconnect)
    await gm1Context.close();

    // Create new GM2 and connect
    const gm2Context = await createBrowserContext(browser, 'mobile');
    const gm2Page = await createPage(gm2Context);
    const gmScanner2 = await initializeGMScannerWithMode(gm2Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    // Should receive sync with existing score
    const scoreAfter = await getTeamScore(gm2Page, '001', 'networked');
    expect(scoreAfter).toBe(500); // Same score from before disconnect
  });

  test('08. All devices disconnect gracefully', async () => {
    const adminSocket = await connectWithAuth(orchestratorInfo.url, 'test-admin-password', 'ADMIN_DISCONNECT_TEST', 'gm');

    const gm1Context = await createBrowserContext(browser, 'mobile');
    const gm1Page = await createPage(gm1Context);
    await initializeGMScannerWithMode(gm1Page, 'networked', 'blackmarket', {
      orchestratorUrl: orchestratorInfo.url,
      password: 'test-admin-password'
    });

    const playerContext = await createBrowserContext(browser, 'mobile');
    const playerPage = await createPage(playerContext);
    const playerScanner = new PlayerScannerPage(playerPage);
    await playerScanner.gotoNetworked(orchestratorInfo.url);
    await playerScanner.waitForInitialization();

    // Close all
    await gm1Context.close();
    await playerContext.close();

    await gm1Page.waitForTimeout(1000);

    // Verify orchestrator still healthy
    const axios = require('axios');
    const healthResponse = await axios.get(`${orchestratorInfo.url}/health`, {
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    expect(healthResponse.data.status).toBe('ok');
  });
});
```

---

## Implementation Order (UPDATED)

### Phase 1: Complete Test 07 Series (NEARLY COMPLETE)
**Status:** Test 07a ✅ (10/10), Test 07b ✅ (6/6), Test 07c ⏸️ (pending)
**Time:** ~30 minutes remaining (07c only)

**Tasks:**
1. ✅ COMPLETE: Fixed Test 07b WebSocket transaction debugging
   - Root cause: Used `scanner.manualEntry()` which triggers prompt() dialog blocking in headless mode
   - Solution: Applied established pattern from test 07a using `page.evaluate(() => window.App.processNFCRead(...))`
   - Result: 6/6 tests passing, validates full WebSocket transaction flow
2. ✅ COMPLETE: Test 07b's 6 transaction tests (networked mode validation)
3. ⏸️ PENDING: Create Test 07c scoring parity validation (compare standalone vs networked results)

### Phase 2: Journey 1 - Offline-First Flow
**Time:** 45 minutes
**File:** `backend/tests/e2e/flows/40-player-scanner-offline-journey.test.js`

### Phase 3: Journey 2 - Video Orchestration
**Time:** 45 minutes
**File:** `backend/tests/e2e/flows/41-video-orchestration-journey.test.js`

### Phase 4: Journey 3 - Multi-Device Coordination
**Time:** 60 minutes
**File:** `backend/tests/e2e/flows/42-multi-device-coordination-journey.test.js`

### Phase 5: Cleanup & Documentation
**Time:** 30 minutes

**Tasks:**
- Update E2E_TEST_IMPLEMENTATION_PLAN.md with actual completion status
- Add updated plan reference to docs

---

## Success Criteria (UNCHANGED)

**Journey 1 (Offline-First):**
- ✅ Player scanner operates without orchestrator
- ✅ Offline queue persists locally
- ✅ Automatic sync on reconnect
- ✅ Videos trigger after offline scan sync

**Journey 2 (Video Orchestration):**
- ✅ VLC plays videos from queue
- ✅ Idle loop starts and resumes correctly
- ✅ Videos complete without freezing
- ✅ Multi-video queue processes sequentially

**Journey 3 (Multi-Device):**
- ✅ 5+ devices connect simultaneously
- ✅ Concurrent scans process without conflicts
- ✅ Real-time score updates across all devices
- ✅ Scoreboard rankings update live
- ✅ Device disconnect/reconnect handled gracefully

**Overall:**
- ✅ ~70 focused tests pass (not 110+)
- ✅ No redundancy with contract/unit tests
- ✅ Complete user journeys validated end-to-end
- ✅ Documentation updated

---

## Running the Tests

```bash
# Run all tests
cd backend
npx playwright test

# Run specific journey
npx playwright test 40-player-scanner-offline-journey
npx playwright test 41-video-orchestration-journey
npx playwright test 42-multi-device-coordination-journey

# Run Test 07 series only
npx playwright test 07a-gm-scanner-standalone-blackmarket
npx playwright test 07b-gm-scanner-networked-blackmarket
npx playwright test 07c-gm-scanner-scoring-parity

# Debug mode
npx playwright test --ui
npx playwright test 40-player-scanner-offline-journey --debug
```

---

## Key Implementation Changes from Original Plan

### ✅ **What Changed:**
1. **Removed non-existent helpers** - Plan no longer references `authenticateAdmin()`, `createSession()`, etc.
2. **Used actual page objects** - GMScannerPage and PlayerScannerPage methods
3. **Corrected selectors** - ID-based (`#scanScreen`) instead of data-testid
4. **Real token IDs** - Production tokens (sof002, rat002, mab002, jaw001)
5. **Accurate WebSocket patterns** - `connectWithAuth()` and `waitForEvent()` from actual helpers
6. **Video token strategy** - Use jaw001 (ONLY production video), player scanner allows duplicate scans for multi-video testing

### ✅ **What Stayed the Same:**
- Overall journey structure (3 journeys, ~23 tests)
- Success criteria
- User stories
- Test rationale (integration over duplication)

---

**Plan Status:** UPDATED - Ready for execution with accurate implementation patterns
**Next Step:** Begin Phase 1 (Test 07b/07c) or Phase 2 (Journey 1) after approval
