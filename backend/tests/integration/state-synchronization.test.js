/**
 * State Synchronization Integration Tests
 * Tests new GM connection → sync:full with complete state
 *
 * Phase 5.4 Test 4: Validates FR 1.7 (State Synchronization)
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('State Synchronization Integration', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();
    await transactionService.reset();
  });

  it('should send complete sync:full on new GM connection', async () => {
    // Setup: Create session with transactions
    await sessionService.createSession({
      name: 'Sync Test Session',
      teams: ['001', '002']
    });

    // Create a transaction for team 001
    const session = sessionService.getCurrentSession();
    const result = await transactionService.processScan({
      tokenId: '534e2b03',
      teamId: '001',
      deviceId: 'SETUP_GM',
      mode: 'blackmarket'
    }, session);

    // Add transaction to session (matches handleTransactionSubmit flow)
    await sessionService.addTransaction(result.transaction);

    // Connect new GM and wait for gm:identified (which triggers sync:full)
    const socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'LATE_JOINING_GM');

    // Request sync manually to validate sync:request handler
    const syncPromise = waitForEvent(socket, 'sync:full');
    socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: sync:full structure
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
    expect(team001Score.currentScore).toBe(5000); // Token 534e2b03: Technical (5x) * rating 3 (1000) = 5000

    // Validate: Recent transactions include our transaction
    expect(syncEvent.data.recentTransactions).toHaveLength(1);
    expect(syncEvent.data.recentTransactions[0].tokenId).toBe('534e2b03');

    // Cleanup
    socket.disconnect();
  });

  it('should include video status in sync:full', async () => {
    await sessionService.createSession({
      name: 'Video Sync Test',
      teams: ['001']
    });

    // Connect GM
    const socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'VIDEO_SYNC_GM');

    // Request sync
    const syncPromise = waitForEvent(socket, 'sync:full');
    socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: videoStatus structure
    expect(syncEvent.data.videoStatus).toBeDefined();
    expect(syncEvent.data.videoStatus).toHaveProperty('status');
    expect(syncEvent.data.videoStatus).toHaveProperty('queueLength');

    // When no video playing, status should be idle
    expect(syncEvent.data.videoStatus.status).toBe('idle');
    expect(syncEvent.data.videoStatus.tokenId).toBeNull();

    socket.disconnect();
  });

  it('should include systemStatus in sync:full', async () => {
    await sessionService.createSession({
      name: 'System Status Test',
      teams: ['001']
    });

    const socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'SYSTEM_STATUS_GM');

    // Request sync
    const syncPromise = waitForEvent(socket, 'sync:full');
    socket.emit('sync:request');
    const syncEvent = await syncPromise;

    // Validate: systemStatus structure
    expect(syncEvent.data.systemStatus).toBeDefined();
    expect(syncEvent.data.systemStatus).toHaveProperty('orchestrator');
    expect(syncEvent.data.systemStatus).toHaveProperty('vlc');
    expect(syncEvent.data.systemStatus.orchestrator).toBe('online');

    socket.disconnect();
  });
});
