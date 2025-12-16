/**
 * Admin Intervention Integration Tests
 *
 * Tests admin commands → service execution → state updates → broadcasts
 *
 * CRITICAL: These tests validate admin control panel functionality using REAL GM Scanner.
 * Tests serve dual purpose:
 * 1. Validate implemented commands work correctly
 * 2. REVEAL missing commands through test failures (contract compliance validation)
 *
 * Contract: backend/contracts/asyncapi.yaml (gm:command, gm:command:ack)
 * Functional Requirements: Section 4.2 (Admin Panel Intervention)
 */

// CRITICAL: Load browser mocks FIRST before any scanner code
require('../helpers/browser-mocks');

const { createAuthenticatedScanner, waitForEvent } = require('../helpers/websocket-helpers');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const { validateWebSocketEvent } = require('../helpers/contract-validator');
const { resetAllServices, resetAllServicesForTesting, logTestFileEntry, logTestFileExit } = require('../helpers/service-reset');
const sessionService = require('../../src/services/sessionService');
const transactionService = require('../../src/services/transactionService');
const TestTokens = require('../fixtures/test-tokens');
const videoQueueService = require('../../src/services/videoQueueService');

describe('Admin Intervention Integration', () => {
  let testContext, gmAdmin, gmObserver;

  beforeAll(async () => {
    logTestFileEntry('admin-interventions.test.js');
    testContext = await setupIntegrationTestServer();
  });

  afterAll(async () => {
    await cleanupIntegrationTestServer(testContext);
    logTestFileExit('admin-interventions.test.js');
  });

  beforeEach(async () => {
    // Complete reset cycle: cleanup → reset → setup
    await resetAllServicesForTesting(testContext.io, {
      sessionService,
      transactionService,
      stateService: require('../../src/services/stateService'),
      videoQueueService,
      offlineQueueService: require('../../src/services/offlineQueueService')
    });

    // Re-initialize tokens after reset
    const testTokens = TestTokens.getAllAsArray();
    await transactionService.init(testTokens);

    // Create test session
    await sessionService.createSession({
      name: 'Admin Intervention Test',
      teams: ['Team Alpha', 'Detectives']
    });

    // Connect admin GM and observer GM with unique IDs to prevent collisions
    const timestamp = Date.now();
    gmAdmin = await createAuthenticatedScanner(testContext.url, `GM_ADMIN_${timestamp}`, 'blackmarket');
    gmObserver = await createAuthenticatedScanner(testContext.url, `GM_OBSERVER_${timestamp}`, 'blackmarket');
  });

  afterEach(async () => {
    // Use scanner.cleanup() to properly disconnect and clear resources
    if (gmAdmin?.cleanup) await gmAdmin.cleanup();
    if (gmObserver?.cleanup) await gmObserver.cleanup();
  });

  describe('Score Adjustment', () => {
    it('should adjust team score via admin command and broadcast to all GMs', async () => {
      // Setup: Create initial score by processing a transaction
      await transactionService.processScan({
        tokenId: 'rat001',
        teamId: 'Team Alpha',
        deviceId: 'SETUP',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      }, sessionService.getCurrentSession());

      // Verify initial score
      let teamScores = transactionService.getTeamScores();
      let teamScore = teamScores.find(s => s.teamId === 'Team Alpha');
      expect(teamScore.currentScore).toBe(40); // rat001 = 40

      // CRITICAL: Set up listeners BEFORE command to avoid race condition
      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // CRITICAL: Wait for score:updated event with ADJUSTED score (not setup transaction score)
      const scorePromise = new Promise((resolve) => {
        gmObserver.socket.on('score:updated', (event) => {
          if (event.data.currentScore === -460) { // Expected after adjustment: 40 - 500 = -460
            resolve(event);
          }
        });
      });

      // Trigger: Admin adjusts score (penalty)
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: 'Team Alpha',
            delta: -500,
            reason: 'Rule violation penalty'
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for command ack and score broadcast
      const [ack, scoreEvent] = await Promise.all([ackPromise, scorePromise]);

      // Validate: Command acknowledged to sender
      expect(ack.event).toBe('gm:command:ack');
      expect(ack.data.action).toBe('score:adjust');
      expect(ack.data.success).toBe(true);
      expect(ack.data.message).toContain('adjusted');

      // Validate: Contract compliance for ack
      validateWebSocketEvent(ack, 'gm:command:ack');

      // Validate: Score updated broadcast reached observer
      expect(scoreEvent.data.teamId).toBe('Team Alpha');
      expect(scoreEvent.data.currentScore).toBe(-460); // 40 - 500

      // Validate: Admin adjustments array populated
      expect(scoreEvent.data.adminAdjustments).toBeDefined();
      expect(scoreEvent.data.adminAdjustments).toHaveLength(1);
      expect(scoreEvent.data.adminAdjustments[0].delta).toBe(-500);
      expect(scoreEvent.data.adminAdjustments[0].reason).toBe('Rule violation penalty');
      expect(scoreEvent.data.adminAdjustments[0].gmStation).toContain('GM_ADMIN');

      // Validate: Service state matches broadcast
      teamScores = transactionService.getTeamScores();
      teamScore = teamScores.find(s => s.teamId === 'Team Alpha');
      expect(teamScore.currentScore).toBe(-460);
      expect(teamScore.adminAdjustments).toHaveLength(1);
    });

    it('should handle positive score adjustments (bonus points)', async () => {
      // Create initial score
      await transactionService.processScan({
        tokenId: 'asm001',
        teamId: 'Detectives',
        deviceId: 'SETUP',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      }, sessionService.getCurrentSession());

      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // Wait for score event with ADJUSTED value
      const scorePromise = new Promise((resolve) => {
        gmObserver.socket.on('score:updated', (event) => {
          if (event.data.currentScore === 2030) { // 30 + 2000
            resolve(event);
          }
        });
      });

      // Admin adds bonus points
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: 'Detectives',
            delta: 2000,
            reason: 'Exceptional gameplay bonus'
          }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, scoreEvent] = await Promise.all([ackPromise, scorePromise]);

      expect(ack.data.success).toBe(true);
      expect(scoreEvent.data.currentScore).toBe(2030); // 30 + 2000

      const teamScores = transactionService.getTeamScores();
      const teamScore = teamScores.find(s => s.teamId === 'Detectives');
      expect(teamScore.currentScore).toBe(2030);
    });

    it('should reject score adjustment for non-existent team', async () => {
      const errorPromise = waitForEvent(gmAdmin.socket, 'error');

      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: '999', // Non-existent team
            delta: 100,
            reason: 'Test'
          }
        },
        timestamp: new Date().toISOString()
      });

      const errorEvent = await errorPromise;

      expect(errorEvent.event).toBe('error');
      expect(errorEvent.data.code).toBe('SERVER_ERROR');
      expect(errorEvent.data.details).toContain('Team 999 not found');
    });
  });

  describe('Session Lifecycle Control', () => {
    it('should create session via admin command', async () => {
      // End current session first
      await sessionService.endSession();

      // Set up listeners AFTER ending session to avoid race with beforeEach session
      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // Wait for session:update with specific name to avoid catching wrong event
      const sessionUpdatePromise = new Promise((resolve) => {
        gmObserver.socket.on('session:update', (event) => {
          if (event.data.name === 'Admin Created Session') {
            resolve(event);
          }
        });
      });

      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:create',
          payload: {
            name: 'Admin Created Session',
            teams: ['Team Alpha', 'Detectives', 'Blue Squad']
          }
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      expect(ack.data.success).toBe(true);
      expect(ack.data.action).toBe('session:create');
      expect(sessionUpdate.data.name).toBe('Admin Created Session');
      expect(sessionUpdate.data.teams).toEqual(['Team Alpha', 'Detectives', 'Blue Squad']);
      expect(sessionUpdate.data.status).toBe('active');
    });

    it('should pause session and reject new transactions', async () => {
      const sessionUpdatePromise = waitForEvent(gmObserver.socket, 'session:update');
      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // Pause session
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:pause',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      // Validate: Command acknowledged
      expect(ack.data.success).toBe(true);
      expect(ack.data.action).toBe('session:pause');

      // Validate: Session update broadcast
      expect(sessionUpdate.data.status).toBe('paused');
      validateWebSocketEvent(sessionUpdate, 'session:update');

      // Verify: Transaction rejected when session paused
      const resultPromise = waitForEvent(gmObserver.socket, 'transaction:result');

      gmObserver.socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_OBSERVER',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result = await resultPromise;

      expect(result.data.status).toBe('error');
      expect(result.data.message).toContain('paused');
      expect(result.data.error).toBe('SESSION_PAUSED');
    });

    it('should resume session and allow transactions', async () => {
      // First pause
      await sessionService.updateSession({ status: 'paused' });

      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // Wait for session:update with active status
      const sessionUpdatePromise = new Promise((resolve) => {
        gmObserver.socket.on('session:update', (event) => {
          if (event.data.status === 'active') {
            resolve(event);
          }
        });
      });

      // Resume session
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:resume',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('active');

      // Verify: Transaction accepted after resume
      const resultPromise = waitForEvent(gmObserver.socket, 'transaction:result');

      gmObserver.socket.emit('transaction:submit', {
        event: 'transaction:submit',
        data: {
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'GM_OBSERVER',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        },
        timestamp: new Date().toISOString()
      });

      const result = await resultPromise;

      expect(result.data.status).toBe('accepted');
      expect(result.data.points).toBe(40);
    });

    it('should end session and cleanup services', async () => {
      // Create some transactions first
      // Slice 5: processScan gets session internally, no longer passed as param
      await transactionService.processScan({
        tokenId: 'rat001',
        teamId: 'Team Alpha',
        deviceId: 'SETUP',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      });

      let teamScores = transactionService.getTeamScores();
      const scoreBefore = teamScores.find(s => s.teamId === 'Team Alpha');
      expect(scoreBefore.currentScore).toBe(40);

      // Use predicate to filter for 'ended' status (avoid receiving stale 'active' session:update)
      const isEndedSession = (data) => data?.data?.status === 'ended';
      const sessionUpdatePromise = waitForEvent(gmObserver.socket, 'session:update', isEndedSession);
      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // End session
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'session:end',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const [ack, sessionUpdate] = await Promise.all([ackPromise, sessionUpdatePromise]);

      expect(ack.data.success).toBe(true);
      expect(sessionUpdate.data.status).toBe('ended');
      expect(sessionUpdate.data.endTime).toBeDefined();

      // Verify: Scores cleared after session end
      await new Promise(resolve => setTimeout(resolve, 100));
      teamScores = transactionService.getTeamScores();
      // Scores should be cleared (array is empty, not reset to 0)
      expect(teamScores.length).toBe(0);
    });
  });

  describe('Video Control', () => {
    it('should skip current video', async () => {
      // TODO: This test requires video to be playing
      // For now, test that command is acknowledged even with no video
      const ackPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'video:skip',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const ack = await ackPromise;

      expect(ack.data.success).toBe(true);
      expect(ack.data.action).toBe('video:skip');
    });
  });

  describe('Contract-Specified Commands (Not Yet Implemented)', () => {
    describe('Video Playback Control - FR 4.2.2', () => {
      it('should play video via admin command', async () => {
        // Per AsyncAPI contract line 1012 and FR 4.2.2 line 898
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:play',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:play');
      });

      it('should pause video via admin command', async () => {
        // Per AsyncAPI contract line 1013 and FR 4.2.2 line 899
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:pause',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:pause');
      });

      it('should stop video via admin command', async () => {
        // Per AsyncAPI contract line 1014 and FR 4.2.2 line 900
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:stop',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:stop');
      });
    });

    describe('Video Queue Management - FR 4.2.2', () => {
      it('should add video to queue via admin command', async () => {
        // Per AsyncAPI contract line 1016 and FR 4.2.2 lines 906-920
        // FR: "Add: Specify video filename (same as tokenId)"
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:queue:add',
            payload: {
              videoFile: 'jaw001.mp4'
            }
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:queue:add');
      });

      it('should reorder video queue via admin command', async () => {
        // Per AsyncAPI contract line 1017 and FR 4.2.2 lines 906-920
        // FR: "Reorder: Move video from position X to position Y"

        // First, add videos to the queue to have something to reorder
        const videoQueueService = require('../../src/services/videoQueueService');
        const transactionService = require('../../src/services/transactionService');
        const TestTokens = require('../fixtures/test-tokens');
        const token = transactionService.tokens.get('534e2b03');
        videoQueueService.addToQueue(token, 'GM_ADMIN');
        videoQueueService.addToQueue(token, 'GM_ADMIN');
        videoQueueService.addToQueue(token, 'GM_ADMIN');

        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:queue:reorder',
            payload: {
              fromIndex: 0,
              toIndex: 2
            }
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:queue:reorder');
      });

      it('should clear video queue via admin command', async () => {
        // Per AsyncAPI contract line 1018 and FR 4.2.2 lines 906-920
        // FR: "Clear queue (remove all)"
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'video:queue:clear',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('video:queue:clear');
      });
    });

    describe('Transaction Intervention - FR 4.2.4', () => {
      it('should delete transaction via admin command', async () => {
        // Per AsyncAPI contract line 1019 and FR 4.2.4 lines 944-974
        // FR: "Delete transaction (undo erroneous scan)"
        // FR: "Recalculate affected team score, broadcast update"

        // Setup: Create a transaction first
        await transactionService.processScan({
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'SETUP',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        }, sessionService.getCurrentSession());

        const session = sessionService.getCurrentSession();
        const transactionId = session.transactions[0].id;

        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'transaction:delete',
            payload: {
              transactionId: transactionId
            }
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('transaction:delete');
      });

      it('should create manual transaction via admin command', async () => {
        // Per AsyncAPI contract line 1020 and FR 4.2.4 lines 944-974
        // FR: "Create manual transaction (when physical scan failed)"
        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'transaction:create',
            payload: {
              tokenId: 'asm001',
              teamId: 'Detectives',
              deviceId: 'ADMIN_MANUAL',
              deviceType: 'gm',  // Required by Phase 3 P0.1
              mode: 'blackmarket'
            }
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('transaction:create');
      });
    });

    describe('System Control - FR 4.2.5', () => {
      it('should reset entire system via admin command', async () => {
        // Per AsyncAPI contract line 1021 and FR 4.2.5 lines 980-985
        // FR: "System Reset - Reset all scores, transactions, session, video queue"
        // FR: "Full nuclear option"

        // Setup: Create some data first
        await transactionService.processScan({
          tokenId: 'rat001',
          teamId: 'Team Alpha',
          deviceId: 'SETUP',
          deviceType: 'gm',  // Required by Phase 3 P0.1
          mode: 'blackmarket'
        }, sessionService.getCurrentSession());

        // Verify data exists before reset
        const teamScoresBefore = transactionService.getTeamScores();
        expect(teamScoresBefore.length).toBeGreaterThan(0);

        const responsePromise = Promise.race([
          waitForEvent(gmAdmin.socket, 'gm:command:ack'),
          waitForEvent(gmAdmin.socket, 'error')
        ]);

        gmAdmin.socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'system:reset',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });

        const result = await responsePromise;

        // Test for CORRECT behavior - will FAIL if unimplemented (reveals gap)
        expect(result.event).toBe('gm:command:ack');
        expect(result.data.success).toBe(true);
        expect(result.data.action).toBe('system:reset');

        // After reset, all data should be cleared
        const teamScoresAfter = transactionService.getTeamScores();
        expect(teamScoresAfter.length).toBe(0);
      });
    });
  });

  describe('Authorization & Error Handling', () => {
    it('should reject commands from unauthenticated clients', async () => {
      // Create unauthenticated socket (don't identify)
      const io = require('socket.io-client');
      const unauthSocket = io(testContext.socketUrl, {
        transports: ['websocket'],
        reconnection: false
      });

      await waitForEvent(unauthSocket, 'connect');

      const errorPromise = waitForEvent(unauthSocket, 'error');

      // Try to send command without auth
      unauthSocket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: 'Team Alpha',
            delta: 100
          }
        },
        timestamp: new Date().toISOString()
      });

      const errorEvent = await errorPromise;

      expect(errorEvent.data.code).toBe('AUTH_REQUIRED');

      unauthSocket.disconnect();
    });

    it('should handle invalid command action', async () => {
      const errorPromise = waitForEvent(gmAdmin.socket, 'error');

      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'invalid:action',
          payload: {}
        },
        timestamp: new Date().toISOString()
      });

      const errorEvent = await errorPromise;

      expect(errorEvent.data.code).toBe('INVALID_COMMAND');
      expect(errorEvent.data.message).toContain('Unknown action');
    });

    it('should handle missing required parameters', async () => {
      const errorPromise = waitForEvent(gmAdmin.socket, 'error');

      // score:adjust requires teamId and delta
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            // Missing teamId and delta
            reason: 'Test'
          }
        },
        timestamp: new Date().toISOString()
      });

      const errorEvent = await errorPromise;

      expect(errorEvent.data.code).toBe('SERVER_ERROR');
      expect(errorEvent.data.details).toContain('required');
    });
  });

  describe('Multi-Client Broadcast Verification', () => {
    it('should send ack to sender only, broadcasts to all GMs', async () => {
      // Create initial score
      await transactionService.processScan({
        tokenId: 'rat001',
        teamId: 'Team Alpha',
        deviceId: 'SETUP',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        mode: 'blackmarket'
      }, sessionService.getCurrentSession());

      // Track events on BOTH clients
      const adminAckPromise = waitForEvent(gmAdmin.socket, 'gm:command:ack');

      // Wait for score event with ADJUSTED value
      const observerScorePromise = new Promise((resolve) => {
        gmObserver.socket.on('score:updated', (event) => {
          if (event.data.currentScore === -960) { // 40 - 1000 = -960
            resolve(event);
          }
        });
      });

      // Admin issues command
      gmAdmin.socket.emit('gm:command', {
        event: 'gm:command',
        data: {
          action: 'score:adjust',
          payload: {
            teamId: 'Team Alpha',
            delta: -1000
          }
        },
        timestamp: new Date().toISOString()
      });

      // Wait for both events
      const [adminAck, observerScore] = await Promise.all([
        adminAckPromise,
        observerScorePromise
      ]);

      // Validate: Admin received ack
      expect(adminAck.event).toBe('gm:command:ack');
      expect(adminAck.data.success).toBe(true);

      // Validate: Observer received score update (side effect)
      expect(observerScore.event).toBe('score:updated');
      expect(observerScore.data.currentScore).toBe(-960); // 40 - 1000

      // Observer should NOT receive ack (ack is to sender only)
      // We can't easily test "did not receive" without waiting, so we validate timing
      const ackTimestamp = new Date(adminAck.timestamp).getTime();
      const scoreTimestamp = new Date(observerScore.timestamp).getTime();

      // Both should be very close in time (same server action)
      expect(Math.abs(ackTimestamp - scoreTimestamp)).toBeLessThan(100);
    });
  });
});
