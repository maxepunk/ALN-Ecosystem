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

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { setupBroadcastListeners } = require('../../src/websocket/broadcasts');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Transaction Flow Integration', () => {
  let testContext, gmSocket;

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
    if (gmSocket?.connected) gmSocket.disconnect();
    await sessionService.reset();
  });

  describe('Blackmarket Mode Transactions', () => {
    it('should process blackmarket transaction and broadcast to all GMs', async () => {
      // Setup: Connect GM in blackmarket mode
      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_BLACKMARKET');

      // Listen for expected events
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');
      const newPromise = waitForEvent(gmSocket, 'transaction:new');
      const scorePromise = waitForEvent(gmSocket, 'score:updated');

      // Trigger: Submit blackmarket transaction
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Technical rating=3 → 1000 * 5.0 = 5000 points
          teamId: '001',
          deviceId: 'GM_BLACKMARKET',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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
      // Setup: Connect GM in detective mode
      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DETECTIVE');

      // Listen for expected events
      const resultPromise = waitForEvent(gmSocket, 'transaction:result');
      const newPromise = waitForEvent(gmSocket, 'transaction:new');

      // NOTE: We do NOT expect score:updated for detective mode
      let scoreEventReceived = false;
      gmSocket.once('score:updated', () => {
        scoreEventReceived = true;
      });

      // Trigger: Submit detective transaction
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '002',
          deviceId: 'GM_DETECTIVE',
          mode: 'detective'  // Detective mode = logging only, no scoring
        },
        timestamp: new Date().toISOString()
      });

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
      // Setup: Connect TWO GMs (realistic 2-GM game setup)
      const gmBlackmarket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_BLACKMARKET');
      const gmDetective = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DETECTIVE');

      // Listen for broadcasts on BOTH GMs
      const bmNewPromise = waitForEvent(gmBlackmarket, 'transaction:new');
      const detNewPromise = waitForEvent(gmDetective, 'transaction:new');

      // Trigger: Blackmarket GM submits transaction
      gmBlackmarket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_BLACKMARKET',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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
      gmBlackmarket.disconnect();
      gmDetective.disconnect();
    });

    it('should handle concurrent transactions from different teams', async () => {
      // Setup: 2 GMs, both in blackmarket mode
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_001');
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_002');

      // Listen for results
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      const result2Promise = waitForEvent(gm2, 'transaction:result');

      // Trigger: Both GMs submit transactions concurrently for different teams
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // 5000 points
          teamId: '001',
          deviceId: 'GM_TEAM_001',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Different token (value will vary)
          teamId: '002',
          deviceId: 'GM_TEAM_002',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For both results
      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      // Validate: Both transactions succeed independently
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.teamId).toBe('001');

      expect(result2.data.status).toBe('accepted');
      expect(result2.data.teamId).toBe('002');

      // Validate: Scores updated independently
      const team001Score = transactionService.teamScores.get('001');
      const team002Score = transactionService.teamScores.get('002');
      expect(team001Score.currentScore).toBe(5000);
      expect(team002Score.currentScore).toBeGreaterThan(0);  // tac001 value

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate scan by different team (first-come-first-served)', async () => {
      // Setup: 2 GMs, both in blackmarket mode
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_1');
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_DUP_2');

      // First scan - should succeed (team 001 claims token)
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_DUP_1',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.points).toBe(5000);

      // Second scan - same token, different team - should be duplicate
      const result2Promise = waitForEvent(gm2, 'transaction:result');
      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // SAME token
          teamId: '002',        // Different team
          deviceId: 'GM_DUP_2',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Duplicate detected
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('claimed');  // Message: "Token already claimed by 001"
      // Error message should mention claiming team (001)
      expect(result2.data.message).toContain('001');

      // Validate: Only first team got points
      const team001Score = transactionService.teamScores.get('001');
      const team002Score = transactionService.teamScores.get('002');
      expect(team001Score.currentScore).toBe(5000);
      expect(team002Score.currentScore).toBe(0);

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
    });

    it('should detect duplicate scan by same team', async () => {
      // Setup: 1 GM
      gmSocket = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_SAME_TEAM');

      // First scan - accepted
      const result1Promise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_SAME_TEAM',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');

      // Second scan - same token, same team - duplicate
      const result2Promise = waitForEvent(gmSocket, 'transaction:result');
      gmSocket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // SAME token
          teamId: '001',        // SAME team
          deviceId: 'GM_SAME_TEAM',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

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
