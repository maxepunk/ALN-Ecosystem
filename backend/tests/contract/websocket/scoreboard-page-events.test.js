/**
 * Scoreboard Page Navigation - Contract Validation Tests
 * Tests scoreboard:page broadcasts against AsyncAPI schema.
 *
 * scoreboard:page is broadcast via scoreboardControlService EventEmitter → broadcasts.js
 * → emitToRoom(io, 'gm', 'scoreboard:page', data).
 *
 * Both GM scanners and scoreboard HTML clients (deviceId SCOREBOARD_*) live
 * in the `gm` room and receive this broadcast.
 *
 * Layer 3 (Contract): Validates event envelope + payload shape, not business logic.
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { connectAndIdentify, waitForEvent, sendGmCommand } = require('../../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../../helpers/integration-test-server');
const { resetAllServices } = require('../../helpers/service-reset');
const { setupBroadcastListeners, cleanupBroadcastListeners } = require('../../../src/websocket/broadcasts');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const videoQueueService = require('../../../src/services/videoQueueService');
const offlineQueueService = require('../../../src/services/offlineQueueService');

describe('Scoreboard Page Events - Contract Validation', () => {
  let testContext;
  let socket;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    cleanupBroadcastListeners();
    await resetAllServices();

    setupBroadcastListeners(testContext.io, {
      sessionService,
      videoQueueService,
      offlineQueueService,
      transactionService
    });

    // A session is required for GM auth in these tests.
    await sessionService.createSession({
      name: 'Scoreboard Page Test Session',
      teams: ['Team Alpha']
    });
    await sessionService.startGame();

    socket = await connectAndIdentify(testContext.socketUrl, 'gm', 'TEST_GM_SCOREBOARD');
  });

  afterEach(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    cleanupBroadcastListeners();
    await resetAllServices();
  });

  describe('scoreboard:page event', () => {
    it('should broadcast scoreboard:page with action=next on scoreboard:page:next command', async () => {
      const eventPromise = waitForEvent(socket, 'scoreboard:page');
      sendGmCommand(socket, 'scoreboard:page:next', {});
      const event = await eventPromise;

      expect(event).toHaveProperty('event', 'scoreboard:page');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(event.data.action).toBe('next');
      expect(event.data.owner).toBeUndefined();

      validateWebSocketEvent(event, 'scoreboard:page');
    });

    it('should broadcast scoreboard:page with action=prev on scoreboard:page:prev command', async () => {
      const eventPromise = waitForEvent(socket, 'scoreboard:page');
      sendGmCommand(socket, 'scoreboard:page:prev', {});
      const event = await eventPromise;

      expect(event.data.action).toBe('prev');
      validateWebSocketEvent(event, 'scoreboard:page');
    });

    it('should broadcast scoreboard:page with owner on scoreboard:page:owner command', async () => {
      const eventPromise = waitForEvent(socket, 'scoreboard:page');
      sendGmCommand(socket, 'scoreboard:page:owner', { owner: 'Alex Reeves' });
      const event = await eventPromise;

      expect(event.data.action).toBe('owner');
      expect(event.data.owner).toBe('Alex Reeves');

      validateWebSocketEvent(event, 'scoreboard:page');
    });

    it('should trim whitespace from owner before broadcasting', async () => {
      const eventPromise = waitForEvent(socket, 'scoreboard:page');
      sendGmCommand(socket, 'scoreboard:page:owner', { owner: '  Alex Reeves  ' });
      const event = await eventPromise;

      expect(event.data.owner).toBe('Alex Reeves');
      validateWebSocketEvent(event, 'scoreboard:page');
    });

    it('should reject scoreboard:page:owner with missing owner via gm:command:ack', async () => {
      const ackPromise = waitForEvent(socket, 'gm:command:ack');
      sendGmCommand(socket, 'scoreboard:page:owner', {});
      const ack = await ackPromise;

      expect(ack.data.success).toBe(false);
      expect(ack.data.action).toBe('scoreboard:page:owner');
      expect(ack.data.message).toMatch(/owner is required/i);
    });
  });
});
