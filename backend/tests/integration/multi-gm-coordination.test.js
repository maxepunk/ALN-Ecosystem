/**
 * Multi-GM Coordination Integration Tests
 *
 * Tests server-level coordination of multiple independent GM stations.
 * Uses manual socket.emit() to simulate independent GMs (not real scanner code).
 *
 * Rationale: Scanner modules (App, Settings) are singleton objects designed for
 * one-GM-per-browser-tab isolation. In Node.js tests, module caching returns
 * the same object for all requires, causing state collision between GM instances.
 *
 * This is NOT a bug - it's the scanner's production architecture.
 * Multi-GM coordination is tested at the server layer here.
 * End-to-end multi-GM flows tested via manual QA (multiple real browser tabs).
 */

const { connectAndIdentify, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');

describe('Multi-GM Coordination', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    await sessionService.reset();

    // Create session with multiple teams
    await sessionService.createSession({
      name: 'Multi-GM Coordination Test',
      teams: ['001', '002']
    });
  });

  afterEach(async () => {
    await sessionService.reset();
  });

  describe('Concurrent Transaction Processing', () => {
    it('should handle concurrent transactions from different teams', async () => {
      // Setup: 2 independent GM clients (simulated via manual socket.emit)
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_001');
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_002');

      // Listen for results on both GMs
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      const result2Promise = waitForEvent(gm2, 'transaction:result');

      // Trigger: Both GMs submit transactions concurrently
      // Using manual socket.emit to simulate independent GM clients
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',
          teamId: '001',
          deviceId: 'GM_TEAM_001',
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',
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

  describe('First-Come-First-Served Duplicate Detection', () => {
    it('should detect duplicate scan by different team', async () => {
      // Setup: 2 independent GM clients
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
      expect(result2.data.message).toContain('claimed');
      expect(result2.data.message).toContain('001');  // Claiming team

      // Validate: Only first team got points
      const team001Score = transactionService.teamScores.get('001');
      const team002Score = transactionService.teamScores.get('002');
      expect(team001Score.currentScore).toBe(5000);
      expect(team002Score.currentScore).toBe(0);

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
    });
  });
});
