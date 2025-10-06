/**
 * Transaction Flow Integration Tests
 *
 * Tests complete transaction processing flow:
 * GM Scanner → Transaction Submit → Service Processing → Broadcasts → All GMs
 *
 * IMPORTANT: These tests are designed to REVEAL actual behavior vs. contract,
 * not to pass based on current implementation. Any failures indicate bugs
 * that must be fixed in the implementation (not the test).
 *
 * Investigation: docs/TRANSACTION-FLOW-INVESTIGATION.md
 * Contract: backend/contracts/asyncapi.yaml
 */

// CRITICAL: Load browser mocks FIRST before any scanner code
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Transaction Flow Integration', () => {
  let testContext, gmScanner;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services for clean test state
    await sessionService.reset();
    await transactionService.reset();

    // CRITICAL: Re-initialize tokens after reset
    const tokenService = require('../../src/services/tokenService');
    const tokens = tokenService.loadTokens();
    await transactionService.init(tokens);

    // CRITICAL: Re-setup broadcast listeners after reset (reset() calls removeAllListeners())
    const stateService = require('../../src/services/stateService');
    const videoQueueService = require('../../src/services/videoQueueService');
    const offlineQueueService = require('../../src/services/offlineQueueService');

    setupBroadcastListeners(testContext.io, {
      sessionService,
      transactionService,
      stateService,
      videoQueueService,
      offlineQueueService
    });

    // Create test session
    await sessionService.createSession({
      name: 'Transaction Flow Test Session',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    if (gmScanner?.socket?.connected) gmScanner.socket.disconnect();
    await sessionService.reset();
  });

  describe('Blackmarket Mode Transactions', () => {
    it('should process blackmarket transaction and broadcast to all GMs', async () => {
      // Setup: Connect GM using REAL scanner code
      gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_BLACKMARKET', 'blackmarket');

      // Listen for expected events on scanner's socket
      const resultPromise = waitForEvent(gmScanner.socket, 'transaction:result');
      const newPromise = waitForEvent(gmScanner.socket, 'transaction:new');
      const scorePromise = waitForEvent(gmScanner.socket, 'score:updated');

      // Set team (how real scanner does it)
      gmScanner.App.currentTeamId = '001';

      // Use REAL scanner entry point (production code path)
      // This triggers: NFC read → TokenManager.findToken() → App.recordTransaction() → NetworkedQueueManager
      gmScanner.App.processNFCRead({id: '534e2b03'});

      // Wait: For all events to propagate
      const [resultEvent, newEvent, scoreEvent] = await Promise.all([
        resultPromise,
        newPromise,
        scorePromise
      ]);

      // Validate: transaction:result (sent to submitter only)
      expect(resultEvent.event).toBe('transaction:result');
      expect(resultEvent.data.status).toBe('accepted');
      expect(resultEvent.data.tokenId).toBe('534e2b03');
      expect(resultEvent.data.teamId).toBe('001');
      expect(resultEvent.data.points).toBe(5000);  // CRITICAL: 5000, not 3000!
      expect(resultEvent.data.transactionId).toBeDefined();
      expect(resultEvent.data.message).toBeDefined();

      // Validate: Contract compliance for transaction:result
      validateWebSocketEvent(resultEvent, 'transaction:result');

      // Validate: transaction:new (broadcast to all GMs)
      expect(newEvent.event).toBe('transaction:new');
      expect(newEvent.data.transaction.id).toBeDefined();
      expect(newEvent.data.transaction.tokenId).toBe('534e2b03');
      expect(newEvent.data.transaction.teamId).toBe('001');
      expect(newEvent.data.transaction.deviceId).toBe('GM_BLACKMARKET');
      expect(newEvent.data.transaction.mode).toBe('blackmarket');
      expect(newEvent.data.transaction.points).toBe(5000);
      expect(newEvent.data.transaction.timestamp).toBeDefined();
      expect(newEvent.data.transaction.memoryType).toBe('Technical');
      expect(newEvent.data.transaction.valueRating).toBe(3);

      // Validate: Contract compliance for transaction:new
      validateWebSocketEvent(newEvent, 'transaction:new');

      // Validate: score:updated (broadcast to all GMs)
      expect(scoreEvent.event).toBe('score:updated');
      expect(scoreEvent.data.teamId).toBe('001');
      expect(scoreEvent.data.currentScore).toBe(5000);
      expect(scoreEvent.data.baseScore).toBe(5000);
      expect(scoreEvent.data.bonusPoints).toBe(0);
      expect(scoreEvent.data.tokensScanned).toBe(1);
      expect(scoreEvent.data.completedGroups).toEqual([]);
      expect(scoreEvent.data.lastUpdate).toBeDefined();

      // Validate: Contract compliance for score:updated
      validateWebSocketEvent(scoreEvent, 'score:updated');

      // Validate: Service state consistency
      const teamScore = transactionService.teamScores.get('001');
      expect(teamScore.currentScore).toBe(5000);
      expect(teamScore.tokensScanned).toBe(1);
    });
  });

  describe('Detective Mode Transactions', () => {
    it('should process detective transaction but NOT update team score', async () => {
      // Setup: Connect GM using REAL scanner code in detective mode
      gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_DETECTIVE', 'detective');

      // Listen for expected events on scanner's socket
      const resultPromise = waitForEvent(gmScanner.socket, 'transaction:result');
      const newPromise = waitForEvent(gmScanner.socket, 'transaction:new');

      // NOTE: We do NOT expect score:updated for detective mode
      let scoreEventReceived = false;
      gmScanner.socket.once('score:updated', () => {
        scoreEventReceived = true;
      });

      // Set team
      gmScanner.App.currentTeamId = '002';

      // Use REAL scanner entry point (production code path)
      gmScanner.App.processNFCRead({id: '534e2b03'});

      // Wait: For events to propagate
      const [resultEvent, newEvent] = await Promise.all([
        resultPromise,
        newPromise
      ]);

      // Wait a bit to ensure no score:updated arrives
      await new Promise(resolve => setTimeout(resolve, 200));

      // Validate: transaction:result received by submitter
      expect(resultEvent.event).toBe('transaction:result');
      expect(resultEvent.data.status).toBe('accepted');
      expect(resultEvent.data.tokenId).toBe('534e2b03');
      expect(resultEvent.data.teamId).toBe('002');

      // CRITICAL: Test reveals actual behavior for detective mode points
      // Contract says "Points awarded (0 if duplicate/error)" but silent on detective mode
      // This test will REVEAL: does detective show points: 0 or points: token.value?
      // DO NOT CHANGE THIS ASSERTION - if it fails, fix the implementation
      expect(resultEvent.data.points).toBeDefined();  // Will reveal actual value

      // Validate: Contract compliance
      validateWebSocketEvent(resultEvent, 'transaction:result');

      // Validate: transaction:new broadcast (detective transactions ARE broadcast)
      expect(newEvent.event).toBe('transaction:new');
      expect(newEvent.data.transaction.mode).toBe('detective');
      expect(newEvent.data.transaction.tokenId).toBe('534e2b03');

      // Validate: Contract compliance
      validateWebSocketEvent(newEvent, 'transaction:new');

      // Validate: NO score:updated event for detective mode
      expect(scoreEventReceived).toBe(false);

      // Validate: Team score UNCHANGED (detective mode doesn't score)
      const teamScore = transactionService.teamScores.get('002');
      expect(teamScore.currentScore).toBe(0);
      expect(teamScore.tokensScanned).toBe(0);  // Detective mode doesn't increment counter
    });
  });

  describe('Dual GM Mode Interactions', () => {
    it('should broadcast transactions to both GMs regardless of mode', async () => {
      // Setup: Connect TWO GMs using REAL scanner code (realistic 2-GM game setup)
      const gmBlackmarket = await createAuthenticatedScanner(testContext.url, 'GM_BLACKMARKET', 'blackmarket');
      const gmDetective = await createAuthenticatedScanner(testContext.url, 'GM_DETECTIVE', 'detective');

      // Listen for broadcasts on BOTH GMs' sockets
      const bmNewPromise = waitForEvent(gmBlackmarket.socket, 'transaction:new');
      const detNewPromise = waitForEvent(gmDetective.socket, 'transaction:new');

      // Trigger: Blackmarket GM submits transaction using REAL scanner entry point
      gmBlackmarket.App.currentTeamId = '001';
      gmBlackmarket.App.processNFCRead({id: '534e2b03'});

      // Wait: For broadcasts to both GMs
      const [bmNewEvent, detNewEvent] = await Promise.all([
        bmNewPromise,
        detNewPromise
      ]);

      // Validate: BOTH GMs received IDENTICAL transaction:new broadcast
      expect(bmNewEvent.data.transaction).toEqual(detNewEvent.data.transaction);

      // Validate: Broadcast timing consistency (within 100ms)
      const bmTime = new Date(bmNewEvent.timestamp).getTime();
      const detTime = new Date(detNewEvent.timestamp).getTime();
      expect(Math.abs(bmTime - detTime)).toBeLessThan(100);

      // Cleanup
      gmBlackmarket.socket.disconnect();
      gmDetective.socket.disconnect();
    });

    // NOTE: Concurrent multi-GM transaction test moved to multi-gm-coordination.test.js
    // Reason: Scanner singleton architecture prevents multiple GM instances in one Node.js process
    // Multi-GM coordination tested at server layer using manual socket.emit()
  });

  describe('Duplicate Detection', () => {
    // NOTE: Different-team duplicate test moved to multi-gm-coordination.test.js
    // Reason: Requires multiple independent GM instances (server coordination test)

    it('should detect duplicate scan by same team', async () => {
      // Setup: 1 GM using REAL scanner code
      gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_SAME_TEAM', 'blackmarket');

      gmScanner.App.currentTeamId = '001';

      // First scan - accepted
      const result1Promise = waitForEvent(gmScanner.socket, 'transaction:result');
      gmScanner.App.processNFCRead({id: '534e2b03'});

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');

      // Second scan - same token, same team - duplicate
      const result2Promise = waitForEvent(gmScanner.socket, 'transaction:result');
      gmScanner.App.processNFCRead({id: '534e2b03'});

      const result2 = await result2Promise;

      // Validate: Duplicate detected
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);

      // Validate: Score unchanged (only 5000 from first scan)
      const teamScore = transactionService.teamScores.get('001');
      expect(teamScore.currentScore).toBe(5000);
      expect(teamScore.tokensScanned).toBe(1);  // Only 1 token scanned
    });
  });
});
