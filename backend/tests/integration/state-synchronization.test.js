/**
 * State Synchronization Integration Tests - REAL SCANNER
 * Tests late-joining GM receives complete state via sync:full
 *
 * TRANSFORMATION: Phase 3.6e - Use real scanner for late-joining GM
 * - Late-joining GM uses createAuthenticatedScanner() (real scanner integration)
 * - Prior state setup via service calls (fast, clear intent)
 * - Tests single-GM integration (late-joiner receives sync correctly)
 *
 * Phase 5.4 Test 4: Validates FR 1.7 (State Synchronization)
 */

// CRITICAL: Load browser mocks FIRST
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { resetAllServices } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('State Synchronization Integration - REAL Scanner', () => {
  let testContext, scanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await resetAllServices();});

  afterEach(async () => {
    // Use scanner.cleanup() to properly disconnect and clear resources
    if (scanner?.cleanup) await scanner.cleanup();
  });

  it('should send complete sync:full on new GM connection', async () => {
    // Setup: Create session with prior state (via service calls - fast, clear intent)
    await sessionService.createSession({
      name: 'Sync Test Session',
      teams: ['001', '002']
    });

    // Create prior transaction for team 001 (before late-joiner connects)
    const session = sessionService.getCurrentSession();
    const result = await transactionService.processScan({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'SETUP_GM',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        deviceType: 'gm',  // Required by Phase 3 P0.1
      mode: 'blackmarket'
    }, session);

    // Add transaction to session (matches handleTransactionSubmit flow)
    await sessionService.addTransaction(result.transaction);

    // Connect late-joining GM using REAL scanner
    scanner = await createAuthenticatedScanner(testContext.url, 'LATE_JOINING_GM', 'blackmarket');

    // Request sync manually to validate sync:request handler
    const syncPromise = waitForEvent(scanner.socket, 'sync:full');
    scanner.socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: sync:full structure (real scanner receives correct envelope)
    expect(syncEvent.event).toBe('sync:full');
    expect(syncEvent.data).toHaveProperty('session');
    expect(syncEvent.data).toHaveProperty('scores');
    expect(syncEvent.data).toHaveProperty('recentTransactions');
    expect(syncEvent.data).toHaveProperty('videoStatus');
    expect(syncEvent.data).toHaveProperty('devices');
    expect(syncEvent.data).toHaveProperty('systemStatus');

    // Validate: Session data
    const sessionData = syncEvent.data.session;
    expect(sessionData.name).toBe('Sync Test Session');
    expect(sessionData.status).toBe('active');
    expect(sessionData.teams).toEqual(['001', '002']);

    // Validate: Scores include both teams
    expect(syncEvent.data.scores).toHaveLength(2);
    const team001Score = syncEvent.data.scores.find(s => s.teamId === '001');
    expect(team001Score.currentScore).toBe(30); // Token 534e2b03: value = 30 points (from test fixtures)

    // Validate: Recent transactions include our prior transaction
    expect(syncEvent.data.recentTransactions).toHaveLength(1);
    expect(syncEvent.data.recentTransactions[0].tokenId).toBe('534e2b03');
  });

  it('should include video status in sync:full', async () => {
    await sessionService.createSession({
      name: 'Video Sync Test',
      teams: ['001']
    });

    // Connect GM using REAL scanner
    scanner = await createAuthenticatedScanner(testContext.url, 'VIDEO_SYNC_GM', 'blackmarket');

    // Request sync
    const syncPromise = waitForEvent(scanner.socket, 'sync:full');
    scanner.socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: videoStatus structure (real scanner receives correct structure)
    expect(syncEvent.data.videoStatus).toBeDefined();
    expect(syncEvent.data.videoStatus).toHaveProperty('status');
    expect(syncEvent.data.videoStatus).toHaveProperty('queueLength');

    // When no video playing, status should be idle
    expect(syncEvent.data.videoStatus.status).toBe('idle');
    expect(syncEvent.data.videoStatus.tokenId).toBeNull();
  });

  it('should include systemStatus in sync:full', async () => {
    await sessionService.createSession({
      name: 'System Status Test',
      teams: ['001']
    });

    // Connect GM using REAL scanner
    scanner = await createAuthenticatedScanner(testContext.url, 'SYSTEM_STATUS_GM', 'blackmarket');

    // Request sync
    const syncPromise = waitForEvent(scanner.socket, 'sync:full');
    scanner.socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: systemStatus structure (real scanner receives correct structure)
    expect(syncEvent.data.systemStatus).toBeDefined();
    expect(syncEvent.data.systemStatus).toHaveProperty('orchestrator');
    expect(syncEvent.data.systemStatus).toHaveProperty('vlc');
    expect(syncEvent.data.systemStatus.orchestrator).toBe('online');
  });
});
