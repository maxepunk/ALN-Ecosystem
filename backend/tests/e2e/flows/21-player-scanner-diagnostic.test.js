/**
 * DIAGNOSTIC TEST: Investigate why Player Scanner doesn't send POST /api/scan
 * Following systematic-debugging skill Phase 1: Root Cause Investigation
 */

const { test, expect, chromium } = require('@playwright/test');

const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { createBrowserContext, createPage, closeAllContexts } = require('../setup/browser-contexts');
const { createSessionViaWebSocket } = require('../setup/session-helpers');
const PlayerScannerPage = require('../helpers/page-objects/PlayerScannerPage');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

test.describe('Player Scanner Diagnostic', () => {

  test.beforeAll(async () => {
    await clearSessionData();
    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({ https: true, timeout: 30000 });
    browser = await chromium.launch({ headless: true });

    // Create session
    const session = await createSessionViaWebSocket(orchestratorInfo.url, {
      sessionName: 'Diagnostic Session',
      mode: 'test',
      password: ADMIN_PASSWORD
    });
    console.log(`✓ Session created: ${session.name}`);
  });

  test.afterAll(async () => {
    await closeAllContexts();
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('DIAGNOSTIC: Trace Player Scanner initialization and handleScan flow', async () => {
    const context = await createBrowserContext(browser, 'mobile', { baseURL: orchestratorInfo.url });
    const page = await createPage(context);
    const scanner = new PlayerScannerPage(page);

    // LAYER 1: Page Load
    console.log('=== LAYER 1: Loading Player Scanner ===');
    await scanner.gotoNetworked(orchestratorInfo.url);

    // Check if page loaded
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // LAYER 2: Window object inspection
    console.log('\n=== LAYER 2: Window Object Inspection ===');
    const windowState = await page.evaluate(() => {
      return {
        hasApp: typeof window.app !== 'undefined',
        appType: typeof window.app,
        hasOrchestrator: typeof window.orchestrator !== 'undefined',
        orchestratorType: typeof window.orchestrator,
        isStandalone: window.orchestrator?.isStandalone,
        connected: window.orchestrator?.connected,
        currentUrl: window.location.href,
        pathname: window.location.pathname
      };
    });
    console.log('Window state:', JSON.stringify(windowState, null, 2));

    // LAYER 3: Check if handleScan exists
    console.log('\n=== LAYER 3: Function Availability ===');
    const functions = await page.evaluate(() => {
      return {
        hasHandleScan: typeof window.app?.handleScan === 'function',
        hasProcessToken: typeof window.app?.processToken === 'function',
        hasOrchestratorLogScan: typeof window.orchestrator?.logScan === 'function'
      };
    });
    console.log('Functions available:', JSON.stringify(functions, null, 2));

    // LAYER 4: Test handleScan with instrumentation
    console.log('\n=== LAYER 4: Calling handleScan() with instrumentation ===');

    // Set up console log capture
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Set up network monitoring
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
    });

    // Call handleScan with logging
    const scanResult = await page.evaluate((tokenId) => {
      console.log('[TEST] About to call handleScan with tokenId:', tokenId);

      if (!window.app) {
        return { error: 'window.app not defined' };
      }

      if (typeof window.app.handleScan !== 'function') {
        return { error: 'handleScan is not a function' };
      }

      // Call handleScan
      try {
        window.app.handleScan(tokenId);
        console.log('[TEST] handleScan called successfully');
        return { success: true };
      } catch (e) {
        console.error('[TEST] handleScan threw error:', e.message);
        return { error: e.message };
      }
    }, 'sof002');

    console.log('Scan result:', JSON.stringify(scanResult, null, 2));

    // Wait a moment for any async operations
    await page.waitForTimeout(2000);

    // LAYER 5: Check what happened
    console.log('\n=== LAYER 5: Post-Scan Analysis ===');
    console.log('Console logs:');
    consoleLogs.forEach(log => console.log('  ', log));

    console.log('\nNetwork requests captured:');
    requests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
      if (req.postData) console.log(`    Body: ${req.postData}`);
    });

    // Check if /api/scan was called
    const scanRequests = requests.filter(r => r.url.includes('/api/scan'));
    console.log(`\n/api/scan requests found: ${scanRequests.length}`);

    // LAYER 6: Check orchestrator state after scan
    console.log('\n=== LAYER 6: Orchestrator State ===');
    const orchestratorState = await page.evaluate(() => {
      if (!window.orchestrator) return { error: 'orchestrator not defined' };
      return {
        isStandalone: window.orchestrator.isStandalone,
        connected: window.orchestrator.connected,
        queueSize: window.orchestrator.offlineQueue?.length || 0,
        hasLogScan: typeof window.orchestrator.logScan === 'function'
      };
    });
    console.log('Orchestrator state:', JSON.stringify(orchestratorState, null, 2));

    // Report findings
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log(`✓ Page loaded: ${!!pageTitle}`);
    console.log(`✓ window.app exists: ${windowState.hasApp}`);
    console.log(`✓ window.orchestrator exists: ${windowState.hasOrchestrator}`);
    console.log(`✓ handleScan exists: ${functions.hasHandleScan}`);
    console.log(`✓ handleScan executed: ${scanResult.success}`);
    console.log(`✗ POST /api/scan sent: ${scanRequests.length > 0}`);

    if (!windowState.hasOrchestrator) {
      console.log('\n⚠️  ROOT CAUSE CANDIDATE: window.orchestrator not initialized');
      console.log('   Networked mode may not be detected');
    } else if (windowState.isStandalone) {
      console.log('\n⚠️  ROOT CAUSE CANDIDATE: isStandalone = true');
      console.log('   Player Scanner thinks it\'s in standalone mode');
    } else if (!windowState.connected) {
      console.log('\n⚠️  ROOT CAUSE CANDIDATE: connected = false');
      console.log('   Orchestrator not connected');
    }
  });
});
