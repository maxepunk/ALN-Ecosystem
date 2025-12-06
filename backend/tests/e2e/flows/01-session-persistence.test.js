/**
 * E2E Test: Session Persistence
 *
 * Tests session persistence across orchestrator restarts.
 *
 * SEPARATED FROM 01-session-lifecycle.test.js because:
 * - Different infrastructure needs (controlled restart vs shared process)
 * - Lifecycle tests need restart-between-tests for isolation
 * - Persistence test needs controlled restart timing
 *
 * This follows E2E best practice: tests with different infrastructure
 * requirements should be in separate files (like 07a/b/c series).
 *
 * @group critical-path
 * @priority critical
 * @phase 2
 */

const { test, expect, chromium } = require('@playwright/test');

// Test infrastructure imports
const {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  clearSessionData
} = require('../setup/test-server');

const { setupVLC, cleanup: cleanupVLC } = require('../setup/vlc-service');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

const {
  closeAllContexts
} = require('../setup/browser-contexts');

const {
  connectWithAuth,
  waitForEvent,
  cleanupAllSockets,
  generateUniqueDeviceId
} = require('../setup/websocket-client');

// Global test state
let browser = null;
let orchestratorInfo = null;
let vlcInfo = null;

// ========================================
// SETUP & TEARDOWN
// ========================================

test.describe('Session Persistence E2E Test', () => {
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
    // 1. Clear any existing session data
    await clearSessionData();

    // 2. Start VLC (mock or real)
    vlcInfo = await setupVLC();
    console.log(`VLC started: ${vlcInfo.type} mode on port ${vlcInfo.port}`);

    // 3. Launch browser (not used in this test, but maintains consistency)
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ]
    });
    console.log('Browser launched');
  });

  test.afterAll(async () => {
    // Cleanup in reverse order
    console.log('Starting cleanup...');

    // Close all browser contexts
    await closeAllContexts();

    // Disconnect all WebSocket clients
    await cleanupAllSockets();

    // Close browser
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }

    // Stop orchestrator
    await stopOrchestrator();
    console.log('Orchestrator stopped');

    // Stop VLC
    await cleanupVLC();
    console.log('VLC stopped');
  });

  test.afterEach(async () => {
    // Close contexts and sockets
    await closeAllContexts();
    await cleanupAllSockets();

    console.log('Test cleanup complete');
  });

  // ========================================
  // TEST: Session persists across orchestrator restart
  // ========================================

  test('session persists across orchestrator restart', async () => {
    // This test REQUIRES file storage for persistence across restart
    orchestratorInfo = await startOrchestrator({
      https: true,
      port: 3000,
      storageType: 'file'  // Explicit opt-in to file storage
    });

    let socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      generateUniqueDeviceId('Persist_Create'),
      'gm'
    );

    // Create session
    socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: {
          name: 'Persistent Session',
          teams: ['Team Alpha', 'Detectives']
        }
      },
      timestamp: new Date().toISOString()
    });

    const createUpdate = await waitForEvent(socket, 'session:update', null, 5000);
    const originalSessionId = createUpdate.data.id;
    const originalStartTime = createUpdate.data.startTime;

    console.log('Session created, restarting orchestrator...');

    // Disconnect socket before restart
    await cleanupAllSockets();

    // Restart orchestrator (preserving session data)
    await restartOrchestrator({ preserveSession: true });

    console.log('Orchestrator restarted, reconnecting...');

    // Reconnect after restart
    socket = await connectWithAuth(
      orchestratorInfo.url,
      ADMIN_PASSWORD,
      generateUniqueDeviceId('Persist_Verify'),
      'gm'
    );

    // Verify session was restored in initial sync
    expect(socket.initialSync.data.session).not.toBeNull();
    expect(socket.initialSync.data.session.id).toBe(originalSessionId);
    expect(socket.initialSync.data.session.name).toBe('Persistent Session');
    expect(socket.initialSync.data.session.teams).toEqual(['Team Alpha', 'Detectives']);
    expect(socket.initialSync.data.session.startTime).toBe(originalStartTime);

    console.log('✓ Session persisted across restart');
  });
});

/**
 * SESSION PERSISTENCE TEST SUCCESS CRITERIA:
 *
 * If this test passes:
 * ✓ Sessions persist to disk storage correctly
 * ✓ Orchestrator restart preserves session data
 * ✓ SessionService.init() loads sessions on startup
 * ✓ WebSocket sync:full includes restored session
 * ✓ Session ID, metadata, and timestamps preserved
 *
 * This validates the complete persistence layer from disk to WebSocket sync.
 */
