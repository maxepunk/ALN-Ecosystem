/**
 * Transaction Events - Contract Validation Tests
 * Tests transaction:submit, transaction:result, transaction:new, and score:adjusted events
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');

describe('Transaction Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    // Setup HTTP server + WebSocket
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    // Cleanup server
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Reset services to clean state (follow session-events.test.js pattern)
    await resetAllServices();

    // Re-setup broadcast listeners after reset
    const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
    const videoQueueService = require('../../../src/services/videoQueueService');
    const offlineQueueService = require('../../../src/services/offlineQueueService');
    const transactionService = require('../../../src/services/transactionService');

    cleanupBroadcastListeners();

    // Re-register persistence listeners (Slice 5: cleanupBroadcastListeners clears registry)
    sessionService.setupPersistenceListeners();

    setupBroadcastListeners(testContext.io, {
      sessionService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // Create session for transaction tests
    await sessionService.createSession({
      name: 'Transaction Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
    await sessionService.startGame();

    // Connect WebSocket (GM Scanner simulation) using helper
    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_TRANSACTIONS');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await resetAllServices();
  });

  describe('transaction:result response', () => {
    it('should match AsyncAPI schema when transaction accepted', async () => {
      // Setup: Listen for transaction:result BEFORE submitting
      const resultPromise = waitForEvent(socket, 'transaction:result');

      // Trigger: Submit transaction (using real token from tokens.json)
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // Real token: Technical, rating=3
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',  // P0.1: Required for device-type-specific behavior
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:result response
      const event = await resultPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'transaction:result');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:result');
    });

    it('returns status:queued and a valid envelope when system is offline', async () => {
      const offlineQueueService = require('../../../src/services/offlineQueueService');
      offlineQueueService.setOfflineStatus(true);

      try {
        const resultPromise = waitForEvent(socket, 'transaction:result');
        socket.emit('transaction:submit', {
          event: 'transaction:submit',
          data: {
            tokenId: '534e2b03',
            teamId: 'Team Alpha',
            deviceId: 'GM_CONTRACT_TEST',
            deviceType: 'gm',
            mode: 'blackmarket'
          },
          timestamp: new Date().toISOString()
        });

        const event = await resultPromise;
        expect(event.data.status).toBe('queued');
        // Passes only because P2.1 widened the enum AND the offline emit carries
        // the contract-required tokenId/teamId/points (P2.2 production fix).
        validateWebSocketEvent(event, 'transaction:result');
      } finally {
        // Deterministic teardown: reset() clears the queue and sets isOffline=false
        // directly, so the offline->online transition does NOT schedule a
        // setImmediate replay of the queued tx against the live session.
        await offlineQueueService.reset();
      }
    });

    it('echoes the client-supplied clientTxId back on the result', async () => {
      const resultPromise = waitForEvent(socket, 'transaction:result');
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'blackmarket',
          clientTxId: 'ctx-abc-123'
        },
        timestamp: new Date().toISOString()
      });

      const event = await resultPromise;
      expect(event.data.clientTxId).toBe('ctx-abc-123');
      validateWebSocketEvent(event, 'transaction:result');
    });

    it('returns status:rejected for an invalid (unknown) token — a permanent rejection', async () => {
      const resultPromise = waitForEvent(socket, 'transaction:result');
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'NONEXISTENT_FAKE_TOKEN_999',
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'blackmarket',
          clientTxId: 'ctx-invalid'
        },
        timestamp: new Date().toISOString()
      });

      const event = await resultPromise;
      // Permanent rejection (an invalid token never becomes valid) → 'rejected',
      // NOT transient 'error'. This lets the GM scanner remove the queued entry,
      // unmark the token for re-scan, and stop retrying it forever (paused/
      // not-active stay 'error' = transient, retried on resume).
      expect(event.data.status).toBe('rejected');
      expect(event.data.message).toContain('Invalid token');
      expect(event.data.clientTxId).toBe('ctx-invalid');
      validateWebSocketEvent(event, 'transaction:result');
    });
  });

  describe('transaction:new broadcast', () => {
    it('should match AsyncAPI schema when broadcasted to GMs', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',  // Real token: Personal, rating=1
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',  // P0.1: Required for device-type-specific behavior
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Wrapped envelope structure
      expect(event).toHaveProperty('event', 'transaction:new');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Validate: owner field present (tac001 owner = 'Taylor Chase')
      expect(event.data.transaction).toHaveProperty('owner', 'Taylor Chase');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should include summary field when token has summary (detective mode)', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit detective mode transaction for token with summary
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'det001',  // Detective token with summary field
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'  // Detective mode
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary is included
      expect(event.data.transaction).toHaveProperty('summary');
      expect(event.data.transaction.summary).toBe('Security footage from warehouse district - timestamp 23:47');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should handle tokens without summary gracefully', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction for token without summary
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'alr001',  // Token without summary field
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary is null or undefined (graceful handling)
      expect(event.data.transaction.summary).toBeNull();

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should transmit HTML/special characters in summary without modification', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit transaction for token with HTML/special characters
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'det999',  // Token with HTML/special characters in summary
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'detective'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: Summary contains unescaped HTML (backend does not escape)
      expect(event.data.transaction.summary).toBe('<script>alert("XSS")</script> Test & "special" \'chars\'');

      // Validate: Against AsyncAPI contract schema (ajv)
      validateWebSocketEvent(event, 'transaction:new');
    });

    it('should include teamScore from transaction:accepted', async () => {
      // Setup: Listen for transaction:new BEFORE submitting
      const broadcastPromise = waitForEvent(socket, 'transaction:new');

      // Trigger: Submit blackmarket transaction
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'hos001',  // Business, rating=3
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For transaction:new broadcast
      const event = await broadcastPromise;

      // Validate: teamScore is a sibling of transaction (not nested inside)
      expect(event.data).toHaveProperty('teamScore');
      expect(event.data.teamScore).toHaveProperty('teamId', 'Team Alpha');
      expect(event.data.teamScore).toHaveProperty('currentScore');
      expect(typeof event.data.teamScore.currentScore).toBe('number');
      expect(event.data.teamScore.currentScore).toBeGreaterThan(0);
    });
  });

  describe('score:adjusted broadcast', () => {
    it('should broadcast score:adjusted event on admin score adjustment', async () => {
      // First process a token so the team has a score
      const txPromise = waitForEvent(socket, 'transaction:new');
      socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: 'Team Alpha',
          deviceId: 'GM_CONTRACT_TEST',
          deviceType: 'gm',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await txPromise;

      // Now listen for score:adjusted and trigger admin adjustment
      const adjustPromise = waitForEvent(socket, 'score:adjusted');
      transactionService.adjustTeamScore('Team Alpha', 5000, 'bonus', 'GM_CONTRACT_TEST');

      const event = await adjustPromise;
      expect(event).toHaveProperty('event', 'score:adjusted');
      expect(event).toHaveProperty('data');
      expect(event.data).toHaveProperty('teamScore');
      expect(event.data.teamScore).toHaveProperty('teamId', 'Team Alpha');
      expect(event.data.teamScore).toHaveProperty('currentScore');
      expect(typeof event.data.teamScore.currentScore).toBe('number');
    });
  });
});

describe('TransactionResult status enum (contract)', () => {
  const yaml = require('js-yaml');
  const fs = require('fs');
  const path = require('path');

  const asyncapi = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8')
  );
  const statusEnum =
    asyncapi.components.messages.TransactionResult.payload.properties.data.properties.status.enum;

  it('includes every status the backend actually emits', () => {
    // accepted/duplicate: transactionService.createScanResponse
    // error: invalid-token reject() (transaction.js maps reject -> 'error')
    // queued: adminEvents.js offline path
    // rejected: transactionService.processScan no-active-session early return
    expect(statusEnum).toEqual(
      expect.arrayContaining(['accepted', 'duplicate', 'error', 'queued', 'rejected'])
    );
  });

  it('declares an OPTIONAL clientTxId on submit, result, and error (echoed correlation id)', () => {
    const msgs = asyncapi.components.messages;
    const submitData = msgs.TransactionSubmit.payload.properties.data;
    const resultData = msgs.TransactionResult.payload.properties.data;
    const errorData = msgs.Error.payload.properties.data;

    // Present in all three messages' data.properties (runtime echo is asserted
    // separately via .toBe(); this locks the contract DOCUMENT itself).
    expect(submitData.properties.clientTxId).toBeDefined();
    expect(resultData.properties.clientTxId).toBeDefined();
    expect(errorData.properties.clientTxId).toBeDefined();

    // ...and OPTIONAL — never in data.required, so old clients that omit it still validate.
    expect(submitData.required || []).not.toContain('clientTxId');
    expect(resultData.required || []).not.toContain('clientTxId');
    expect(errorData.required || []).not.toContain('clientTxId');
  });
});
