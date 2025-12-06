/**
 * DIAGNOSTIC TEST: History Auto-Update
 *
 * Purpose: Trace event flow to identify WHERE failure occurs
 * Run with: DIAGNOSTIC_MODE=true npm run test:e2e -- 07d-diagnostic
 *
 * Expected Flow:
 * 1. [BACKEND INPUT] gm:command (session:create)
 * 2. [BACKEND OUTPUT] session:update
 * 3. [BROADCAST OUTPUT] session:{id}::session:update
 * 4. [FRONTEND-WS INPUT] session:update
 * 5. [BACKEND INPUT] transaction:submit
 * 6. [BACKEND OUTPUT] transaction:new
 * 7. [BROADCAST OUTPUT] session:{id}::transaction:new
 * 8. [FRONTEND-WS INPUT] transaction:new
 * 9. [DataManager INPUT] addTransaction
 * 10. [DataManager OUTPUT] transaction:added
 * 11. [UI UPDATE] UIManager.renderTransactions
 *
 * Failure Points to Watch:
 * - Gap between BACKEND OUTPUT and FRONTEND INPUT = broadcast not delivered
 * - Frontend receives but no DataManager INPUT = MonitoringDisplay not calling addTransaction
 * - DataManager INPUT but no OUTPUT = Event emission broken
 * - DataManager OUTPUT but no UI UPDATE = main.js listener not triggered
 */

const { test, expect, chromium } = require('@playwright/test');

const {
  startOrchestrator,
  stopOrchestrator,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

const {
  createBrowserContext,
  createPage,
} = require('../setup/browser-contexts');

const {
  connectWithAuth,
  waitForEvent,
} = require('../setup/websocket-client');

const {
  initializeGMScannerWithMode,
} = require('../helpers/scanner-init');

const { selectTestTokens } = require('../helpers/token-selection');

const {
  createDiagnosticLogger,
  instrumentFrontend,
  dumpStateOnFailure
} = require('../helpers/diagnostic-logger');

let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;
let testTokens = null;

test.describe('DIAGNOSTIC: History Auto-Update', () => {
  // CRITICAL: Skip on desktop (chromium) project - only run on mobile-chrome
  // The backend only supports ONE active session at a time. With 2 projects
  // (chromium + mobile-chrome) running in parallel workers, both share the same
  // orchestrator instance and create competing sessions. The later session
  // overwrites the earlier one, causing test failures.
  //
  // serial mode only affects tests within a single project - it doesn't prevent
  // parallel execution across different projects. We skip desktop since this is
  // a mobile-first PWA and mobile-chrome better represents the target platform.
  //
  // NOTE: browserName === 'chromium' for BOTH projects (mobile-chrome uses Chromium engine)
  // Use isMobile fixture to distinguish between desktop and mobile viewports.
  test.skip(({ isMobile }) => !isMobile, 'Session-based tests only run on mobile-chrome (mobile-first PWA)');

  test.beforeAll(async () => {
    await clearSessionData();

    vlcInfo = await setupVLC();
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      timeout: 30000
    });

    testTokens = await selectTestTokens(orchestratorInfo.url);

    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched for diagnostic test');
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
    await stopOrchestrator();
    await cleanupVLC();
  });

  test('should trace event flow for history auto-update', async () => {
    const logger = createDiagnosticLogger('history-auto-update');

    const context1 = await createBrowserContext(browser, 'mobile');
    const page1 = await createPage(context1);
    const context2 = await createBrowserContext(browser, 'mobile');
    const page2 = await createPage(context2);

    try {
      // ========== PHASE 1: Session Creation ==========
      logger.log('TEST', 'PHASE', 'Creating session via WebSocket');

      const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, 'GM_Diagnostic', 'gm');

      // Log socket connection
      logger.log('TEST', 'EVENT', 'Socket connected', { id: socket.id });

      // DIAGNOSTIC: Log when socket receives ANY event (with full payload)
      socket.onAny((event, data) => {
        // Log full payload for session:update to see why filter fails
        if (event === 'session:update') {
          logger.frontendReceived(event, {
            event,
            status: data?.data?.status,
            name: data?.data?.name,
            id: data?.data?.id,
            fullPayload: JSON.stringify(data).substring(0, 300)
          });
        } else {
          logger.frontendReceived(event, { event, hasData: !!data });
        }
      });

      logger.backendInput('gm:command', { action: 'session:create' });

      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:create', payload: { name: 'Diagnostic Test', teams: ['Team Alpha'] } },
        timestamp: new Date().toISOString()
      });

      logger.log('TEST', 'WAIT', 'Waiting for session:update...');

      const sessionUpdate = await waitForEvent(
        socket,
        'session:update',
        (event) => event.data.status === 'active' && event.data.name === 'Diagnostic Test',
        10000 // Longer timeout for diagnostics
      );

      logger.backend('session:update', { status: sessionUpdate.data.status });
      logger.log('TEST', 'PHASE', '✓ Session created successfully');

      // ========== PHASE 2: Scanner Initialization ==========
      logger.log('TEST', 'PHASE', 'Initializing Scanner 1 (monitoring)');

      const gmScanner1 = await initializeGMScannerWithMode(page1, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Instrument frontend
      await instrumentFrontend(page1, logger);

      // Navigate to admin panel
      logger.log('TEST', 'ACTION', 'Navigating to admin panel');
      await gmScanner1.navigateToAdminPanel();

      // Navigate to history
      logger.log('TEST', 'ACTION', 'Opening history screen');
      await gmScanner1.viewFullHistory();

      // DIAGNOSTIC: Verify history screen is active
      const historyState = await page1.evaluate(() => ({
        exists: !!document.getElementById('historyScreen'),
        hasActive: document.getElementById('historyScreen')?.classList.contains('active'),
        classes: document.getElementById('historyScreen')?.className
      }));
      logger.log('TEST', 'STATE', 'History screen status', historyState);

      if (!historyState.hasActive) {
        logger.error('TEST', 'History screen is not active!', historyState);
      }

      // Count initial transactions
      const initialCount = await page1.locator('#historyContainer .transaction-card').count();
      logger.log('TEST', 'STATE', `Initial transaction count: ${initialCount}`);

      // ========== PHASE 3: Second Scanner Scan ==========
      logger.log('TEST', 'PHASE', 'Initializing Scanner 2 (scanning)');

      const gmScanner2 = await initializeGMScannerWithMode(page2, 'networked', 'blackmarket', {
        orchestratorUrl: orchestratorInfo.url,
        password: ADMIN_PASSWORD
      });

      // Wait for session sync to populate dropdown, then select team
      await gmScanner2.waitForTeamInDropdown('Team Alpha');
      await gmScanner2.selectTeam('Team Alpha');
      await gmScanner2.confirmTeam();

      await gmScanner2.scanScreen.waitFor({ state: 'visible', timeout: 5000 });
      await gmScanner2.manualEntryBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Listen for transaction broadcast on test socket
      const testSocketTransactionPromise = waitForEvent(
        socket,
        'transaction:new',
        (event) => event.data.transaction.tokenId === testTokens.personalToken.SF_RFID,
        10000
      );

      logger.log('TEST', 'ACTION', 'Scanner 2 scanning token', { tokenId: testTokens.personalToken.SF_RFID });

      // Perform scan
      await gmScanner2.manualScan(testTokens.personalToken.SF_RFID);
      await gmScanner2.waitForResult(5000);

      logger.log('TEST', 'WAIT', 'Waiting for transaction:new broadcast...');

      // Wait for transaction broadcast
      const txEvent = await testSocketTransactionPromise;
      logger.backend('transaction:new', { tokenId: txEvent.data.transaction.tokenId });

      expect(txEvent.data.transaction.status).toBe('accepted');
      logger.log('TEST', 'PHASE', '✓ Transaction broadcast received on test socket');

      // ========== PHASE 4: Verify Auto-Update ==========
      logger.log('TEST', 'PHASE', 'Verifying Scanner 1 history auto-updated');

      // Give frontend time to process event
      await page1.waitForTimeout(1000);

      // Check transaction count
      const finalCount = await page1.locator('#historyContainer .transaction-card').count();
      logger.log('TEST', 'RESULT', `Final transaction count: ${finalCount} (expected: ${initialCount + 1})`);

      // DIAGNOSTIC: Check DataManager state
      const dataManagerState = await page1.evaluate(() => ({
        transactions: window.DataManager?.transactions?.length,
        hasAddTransaction: typeof window.DataManager?.addTransaction === 'function',
        hasEventListener: !!window.DataManager?.addEventListener
      }));
      logger.log('TEST', 'STATE', 'DataManager state', dataManagerState);

      // VERIFICATION
      if (finalCount !== initialCount + 1) {
        logger.error('TEST', 'AUTO-UPDATE FAILED', {
          expected: initialCount + 1,
          actual: finalCount,
          diff: finalCount - initialCount
        });

        // Dump state on failure
        await dumpStateOnFailure(page1, orchestratorInfo.url, logger);
      }

      expect(finalCount).toBe(initialCount + 1);

      logger.log('TEST', 'RESULT', '✓ History auto-updated successfully');

      socket.disconnect();

    } catch (error) {
      logger.error('TEST', 'FAILED', { message: error.message });
      await dumpStateOnFailure(page1, orchestratorInfo.url, logger);
      throw error;

    } finally {
      logger.dumpTimeline();
      logger.analyzeGaps();

      await page1.close();
      await context1.close();
      await page2.close();
      await context2.close();
    }
  });
});
