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
const { resetAllServices, resetAllServicesForTesting } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const TestTokens = require('../fixtures/test-tokens');

describe('Multi-GM Coordination', () => {
  let testContext;

  beforeAll(async () => {
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
  });

  beforeEach(async () => {
    // Complete reset cycle: cleanup → reset → setup
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService: require('../../src/services/stateService'),
      videoQueueService: require('../../src/services/videoQueueService'),
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Create session with multiple teams
    await sessionService.createSession({
      name: 'Multi-GM Coordination Test',
      teams: ['Team Alpha', 'Detectives']
    });
  });

  afterEach(async () => {
    // Cleanup now happens in beforeEach via resetAllServicesForTesting
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
          teamId: 'Team Alpha',
          deviceId: 'GM_TEAM_001',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'tac001',
          teamId: 'Detectives',
          deviceId: 'GM_TEAM_002',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      // Wait: For both results
      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      // Validate: Both transactions succeed independently
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.teamId).toBe('Team Alpha');

      expect(result2.data.status).toBe('accepted');
      expect(result2.data.teamId).toBe('Detectives');

      // Validate: Scores updated independently
      const team001Score = transactionService.teamScores.get('Team Alpha');
      const team002Score = transactionService.teamScores.get('Detectives');
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('534e2b03'));
      expect(team002Score.currentScore).toBe(TestTokens.getExpectedPoints('tac001'));

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
          teamId: 'Team Alpha',
          deviceId: 'GM_DUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result1 = await result1Promise;
      expect(result1.data.status).toBe('accepted');
      expect(result1.data.points).toBe(TestTokens.getExpectedPoints('534e2b03'));

      // Second scan - same token, different team - should be duplicate
      const result2Promise = waitForEvent(gm2, 'transaction:result');
      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: '534e2b03',  // SAME token
          teamId: 'Detectives',        // Different team
          deviceId: 'GM_DUP_2',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result2 = await result2Promise;

      // Validate: Duplicate detected
      expect(result2.data.status).toBe('duplicate');
      expect(result2.data.points).toBe(0);
      expect(result2.data.message).toContain('claimed');
      expect(result2.data.message).toContain('Team Alpha');  // Claiming team

      // Validate: Only first team got points
      const team001Score = transactionService.teamScores.get('Team Alpha');
      const team002Score = transactionService.teamScores.get('Detectives');
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('534e2b03'));
      expect(team002Score.currentScore).toBe(0);

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
    });
  });

  describe('Group Completion Coordination', () => {
    it('should prevent group completion if other team claimed a token', async () => {
      // Team 001 scans first token (rat001)
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_001');

      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_TEAM_001',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await result1Promise;

      // Team 002 scans second token (asm001) - "steals" it
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_002');

      const result2Promise = waitForEvent(gm2, 'transaction:result');
      gm2.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: 'Detectives', // Different team
          deviceId: 'GM_TEAM_002',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await result2Promise;

      // Verify: Team 001 did NOT complete group (asm001 claimed by team 002)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === 'Team Alpha');
      const team002Score = scores.find(s => s.teamId === 'Detectives');

      expect(team001Score.completedGroups).toEqual([]); // NOT complete
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team002Score.completedGroups).toEqual([]); // Also not complete
      expect(team002Score.bonusPoints).toBe(0);

      // Both teams have only their individual token values
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('rat001'));
      expect(team002Score.currentScore).toBe(TestTokens.getExpectedPoints('asm001'));

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
    });

    it('should broadcast group:completed to all connected GMs', async () => {
      // Connect 3 independent GMs
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_1');
      const gm2 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_2');
      const gm3 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_GROUP_3');

      // CRITICAL: Set up ALL listeners BEFORE any transactions
      const groupCompletedPromises = [
        waitForEvent(gm1, 'group:completed'),
        waitForEvent(gm2, 'group:completed'),
        waitForEvent(gm3, 'group:completed')
      ];

      // First transaction
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_GROUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await result1Promise;

      // Second transaction (completes group)
      const result2Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: 'Team Alpha',
          deviceId: 'GM_GROUP_1',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await result2Promise;

      // Now wait for group:completed broadcasts
      const [event1, event2, event3] = await Promise.all(groupCompletedPromises);

      // Validate: All 3 GMs received identical group:completed event
      expect(event1.data).toEqual(event2.data);
      expect(event2.data).toEqual(event3.data);

      expect(event1.data.group).toBe('Marcus Sucks');
      // Group bonus = sum(token values) * (multiplier - 1) per transactionService.js:361-365
      const expectedGroupBonus = (TestTokens.getExpectedPoints('rat001') + TestTokens.getExpectedPoints('asm001')) * (TestTokens.MARCUS_SUCKS.multiplier - 1);
      expect(event1.data.bonusPoints).toBe(expectedGroupBonus);

      // Cleanup
      gm1.disconnect();
      gm2.disconnect();
      gm3.disconnect();
    });

    it('should NOT complete group with detective mode scans (no scoring)', async () => {
      // Connect GM that will submit transactions
      const gm1 = await connectAndIdentify(testContext.socketUrl, 'gm', 'GM_TEAM_001');

      // First transaction: BLACKMARKET mode (scoring)
      const result1Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_TEAM_001',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });
      await result1Promise;

      // Second transaction: DETECTIVE mode (logging only, no scoring)
      const result2Promise = waitForEvent(gm1, 'transaction:result');
      gm1.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'asm001',
          teamId: 'Team Alpha',
          deviceId: 'GM_TEAM_001',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'detective' // Detective mode
        },
        timestamp: new Date().toISOString()
      });
      await result2Promise;

      // Wait a bit to ensure no group:completed event
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify: Group NOT completed (detective mode doesn't count toward groups)
      const scores = transactionService.getTeamScores();
      const team001Score = scores.find(s => s.teamId === 'Team Alpha');
      expect(team001Score.completedGroups).toEqual([]); // NOT complete
      expect(team001Score.bonusPoints).toBe(0); // NO bonus
      expect(team001Score.currentScore).toBe(TestTokens.getExpectedPoints('rat001')); // Only rat001 (blackmarket scan)

      // Cleanup
      gm1.disconnect();
    });
  });
});
