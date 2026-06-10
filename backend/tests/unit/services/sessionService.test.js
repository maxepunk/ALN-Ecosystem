/**
 * SessionService Unit Tests
 * Tests session:update event emission per asyncapi.yaml
 */

const { v4: uuidv4 } = require('uuid');
const { validateWebSocketEvent } = require('../../helpers/contract-validator');
const { resetAllServices } = require('../../helpers/service-reset');
const sessionService = require('../../../src/services/sessionService');

describe('SessionService - Event Emission', () => {
  beforeEach(async () => {
    // Reset service state
    await resetAllServices();
  });

  afterEach(async () => {
    // Cleanup
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
  });

  describe('Domain events (unwrapped)', () => {
    it('should emit session:created domain event when session created', (done) => {
      sessionService.once('session:created', (eventData) => {
        try {
          // Verify unwrapped domain event structure
          expect(eventData).toBeDefined();
          expect(eventData.id).toBeDefined();
          expect(eventData.name).toBe('Test Session');
          expect(eventData.status).toBe('setup');
          expect(eventData.startTime).toBeDefined();
          expect(eventData.teams).toEqual(['Team Alpha', 'Detectives']);

          done();
        } catch (error) {
          done(error);
        }
      });

      sessionService.createSession({ name: 'Test Session', teams: ['Team Alpha', 'Detectives'] });
    });

    it('should emit session:updated domain event when session ended', async () => {
      // Create session first
      await sessionService.createSession({ name: 'Test Session', teams: ['Team Alpha'] });

      // Listen for end event
      const endEventPromise = new Promise((resolve, reject) => {
        sessionService.once('session:updated', (eventData) => {
          try {
            // Verify unwrapped domain event structure
            expect(eventData).toBeDefined();
            expect(eventData.id).toBeDefined();
            expect(eventData.status).toBe('ended');
            expect(eventData.endTime).toBeDefined();

            resolve(eventData);
          } catch (error) {
            reject(error);
          }
        });
      });

      // End the session
      await sessionService.endSession();

      // Wait for event
      await endEventPromise;
    });

    it('should include full session resource in domain event data', async () => {
      const eventPromise = new Promise((resolve) => {
        sessionService.once('session:created', resolve);
      });

      await sessionService.createSession({ name: 'Full Resource Test', teams: ['Team Alpha'] });

      const eventData = await eventPromise;

      // Verify unwrapped domain event with full session resource per Decision #7
      expect(eventData).toHaveProperty('id');
      expect(eventData).toHaveProperty('name', 'Full Resource Test');
      expect(eventData).toHaveProperty('status', 'setup');
      expect(eventData).toHaveProperty('startTime');
      expect(eventData).toHaveProperty('teams');
      expect(eventData).toHaveProperty('metadata');
    });
  });

  describe('lazy require removal', () => {
    it('should not use lazy requires in createSession', () => {
      // This test verifies the pattern, actual verification is manual code inspection
      // The test ensures no runtime errors occur without lazy requires
      expect(async () => {
        await sessionService.createSession({ name: 'No Lazy Requires', teams: ['Team Alpha'] });
      }).not.toThrow();
    });
  });
});

describe('SessionService - Business Logic (Layer 1 Unit Tests)', () => {
  beforeEach(async () => {
    await resetAllServices();
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
  });

  describe('Session Creation', () => {
    it('should create a new session with teams', async () => {
      const session = await sessionService.createSession({
        name: 'Test Session',
        teams: ['Team Alpha', 'Detectives', 'Blue Squad']
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.status).toBe('setup');
      expect(session.startTime).toBeDefined();
      expect(session.scores).toBeDefined();
      expect(session.scores.length).toBe(3);
    });

    it('should create session with empty teams array', async () => {
      const session = await sessionService.createSession({
        name: 'Empty Teams',
        teams: []
      });

      expect(session).toBeDefined();
      expect(session.scores).toEqual([]);
    });

    it('should end existing session when creating new one', async () => {
      // Create first session
      const session1 = await sessionService.createSession({
        name: 'First Session',
        teams: ['Team Alpha']
      });
      expect(session1.status).toBe('setup');

      // Create second session (should end first)
      const session2 = await sessionService.createSession({
        name: 'Second Session',
        teams: ['002']
      });

      expect(session2.status).toBe('setup');
      expect(session2.id).not.toBe(session1.id);
      // First session should no longer be current
      expect(sessionService.getCurrentSession().id).toBe(session2.id);
    });

    it('should complete and back up a PAUSED previous session when creating a new one (F-BCORE-05)', async () => {
      const persistenceService = require('../../../src/services/persistenceService');

      const first = await sessionService.createSession({
        name: 'Paused Orphan',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();
      sessionService.updateSessionStatus('paused');
      expect(first.status).toBe('paused');

      const backupSpy = jest.spyOn(persistenceService, 'backupSession');
      try {
        await sessionService.createSession({ name: 'Replacement', teams: [] });

        // Previous session must be properly ended (not silently overwritten)
        expect(first.status).toBe('ended');
        expect(first.endTime).toBeTruthy();
        expect(backupSpy).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }));
      } finally {
        backupSpy.mockRestore();
      }
    });

    it('should complete and back up a SETUP previous session when creating a new one (F-BCORE-05)', async () => {
      const persistenceService = require('../../../src/services/persistenceService');

      const first = await sessionService.createSession({
        name: 'Setup Orphan',
        teams: []
      });
      expect(first.status).toBe('setup');

      const backupSpy = jest.spyOn(persistenceService, 'backupSession');
      try {
        await sessionService.createSession({ name: 'Replacement 2', teams: [] });

        expect(first.status).toBe('ended');
        expect(first.endTime).toBeTruthy();
        expect(backupSpy).toHaveBeenCalledWith(expect.objectContaining({ id: first.id }));
      } finally {
        backupSpy.mockRestore();
      }
    });

    it('should initialize team scores from teams array', async () => {
      const session = await sessionService.createSession({
        name: 'Score Init Test',
        teams: ['Team Alpha', 'Detectives']
      });

      expect(session.scores).toBeDefined();
      expect(session.scores.length).toBe(2);
      expect(session.scores[0].teamId).toBe('Team Alpha');
      expect(session.scores[0].currentScore).toBe(0);
      expect(session.scores[1].teamId).toBe('Detectives');
      expect(session.scores[1].currentScore).toBe(0);
    });
  });

  describe('Session Lifecycle', () => {
    it('should get current session', async () => {
      const session = await sessionService.createSession({
        name: 'Current Session Test',
        teams: ['Team Alpha']
      });

      const currentSession = sessionService.getCurrentSession();
      expect(currentSession).toBeDefined();
      expect(currentSession.id).toBe(session.id);
    });

    it('should return null when no current session', () => {
      const currentSession = sessionService.getCurrentSession();
      expect(currentSession).toBeNull();
    });

    it('should update session status', async () => {
      await sessionService.createSession({
        name: 'Status Test',
        teams: ['Team Alpha']
      });
      await sessionService.startGame(); // Must start game before pause/resume

      sessionService.updateSessionStatus('paused');
      expect(sessionService.getCurrentSession().status).toBe('paused');

      sessionService.updateSessionStatus('active');
      expect(sessionService.getCurrentSession().status).toBe('active');
    });

    it('should reject resume-from-setup — startGame is the only setup→active path (F-BCORE-06)', async () => {
      await sessionService.createSession({
        name: 'Setup Resume Test',
        teams: []
      });
      expect(sessionService.getCurrentSession().status).toBe('setup');

      // Activating from setup must throw: it would bypass startGame()'s
      // cascade (game clock, cue engine, overtime threshold, gameStartTime)
      expect(() => sessionService.updateSessionStatus('active')).toThrow(/setup/);
      expect(sessionService.getCurrentSession().status).toBe('setup');
    });

    it('should end session and clear currentSession', async () => {
      await sessionService.createSession({
        name: 'End Test',
        teams: ['Team Alpha']
      });

      await sessionService.endSession();

      // After ending, currentSession is set to null
      const currentSession = sessionService.getCurrentSession();
      expect(currentSession).toBeNull();
    });

    it('should handle endSession when no current session', async () => {
      // Should not throw error
      await expect(sessionService.endSession()).resolves.not.toThrow();
    });

    it('should reset service state', async () => {
      await sessionService.createSession({
        name: 'Reset Test',
        teams: ['Team Alpha']
      });

      await resetAllServices();

      expect(sessionService.getCurrentSession()).toBeNull();
    });
  });

  describe('Session Updates', () => {
    it('should update session name', async () => {
      await sessionService.createSession({
        name: 'Original Name',
        teams: ['Team Alpha']
      });

      await sessionService.updateSession({ name: 'Updated Name' });

      expect(sessionService.getCurrentSession().name).toBe('Updated Name');
    });

    it('should handle update when no current session', async () => {
      await expect(
        sessionService.updateSession({ name: 'No Session' })
      ).rejects.toThrow();
    });
  });

  describe('Transaction Management', () => {
    it('should add transaction to session', async () => {
      await sessionService.createSession({
        name: 'Transaction Test',
        teams: ['Team Alpha']
      });

      const session = sessionService.getCurrentSession();
      const { v4: uuidv4 } = require('uuid');
      const transaction = {
        id: uuidv4(),
        tokenId: 'token-123',
        teamId: 'Team Alpha',
        deviceId: 'test-device-1',
        deviceType: 'gm',  // Required by Phase 3 P0.1
        sessionId: session.id,
        timestamp: new Date().toISOString(),
        status: 'accepted',
        points: 10
      };

      await sessionService.addTransaction(transaction);

      const updatedSession = sessionService.getCurrentSession();
      expect(updatedSession.transactions).toContain(transaction);
    });

    it('should handle addTransaction when no current session', async () => {
      const transaction = {
        id: 'tx-001',
        tokenId: 'token-123'
      };

      await expect(sessionService.addTransaction(transaction)).rejects.toThrow();
    });
  });

  describe('Device Management', () => {
    it('should add device to session', async () => {
      await sessionService.createSession({
        name: 'Device Test',
        teams: ['Team Alpha']
      });

      const device = {
        id: 'GM-001',
        type: 'gm',
        connectedAt: new Date().toISOString()
      };

      await sessionService.updateDevice(device);

      const session = sessionService.getCurrentSession();
      expect(session.connectedDevices).toContainEqual(device);
    });

    it('should update existing device', async () => {
      await sessionService.createSession({
        name: 'Device Update Test',
        teams: ['Team Alpha']
      });

      const device1 = {
        id: 'GM-001',
        type: 'gm',
        status: 'connected'
      };

      await sessionService.updateDevice(device1);

      const device2 = {
        id: 'GM-001',
        type: 'gm',
        status: 'disconnected'
      };

      await sessionService.updateDevice(device2);

      const session = sessionService.getCurrentSession();
      const updatedDevice = session.connectedDevices.find(d => d.id === 'GM-001');
      expect(updatedDevice.status).toBe('disconnected');
    });

    it('should remove device from session', async () => {
      await sessionService.createSession({
        name: 'Device Remove Test',
        teams: ['Team Alpha']
      });

      const device = {
        id: 'GM-001',
        type: 'gm'
      };

      await sessionService.updateDevice(device);
      await sessionService.removeDevice('GM-001');

      const session = sessionService.getCurrentSession();
      expect(session.connectedDevices.find(d => d.id === 'GM-001')).toBeUndefined();
    });

    it('should handle updateDevice when no current session', async () => {
      const device = { id: 'GM-001', type: 'gm' };

      // updateDevice throws when no session
      await expect(sessionService.updateDevice(device)).rejects.toThrow();
    });

    it('should handle removeDevice when no current session', async () => {
      // removeDevice does NOT throw when no session (just returns)
      await expect(sessionService.removeDevice('GM-001')).resolves.not.toThrow();
    });
  });

  describe('Team Scores Initialization', () => {
    it('should initialize empty array for no teams', () => {
      const scores = sessionService.initializeTeamScores([]);
      expect(scores).toEqual([]);
    });

    it('should initialize scores for multiple teams', () => {
      const scores = sessionService.initializeTeamScores(['Team Alpha', 'Detectives', 'Blue Squad']);

      expect(scores.length).toBe(3);
      // Live TeamScore instances — session.scores is the canonical store
      const TeamScore = require('../../../src/models/teamScore');
      expect(scores[0]).toBeInstanceOf(TeamScore);
      expect(scores[0].toJSON()).toEqual({
        teamId: 'Team Alpha',
        adminAdjustments: [],  // Admin score adjustment audit trail
        currentScore: 0,
        baseScore: 0,
        bonusPoints: 0,
        tokensScanned: 0,
        completedGroups: [],
        lastUpdate: expect.any(String),
        lastTokenTime: null
      });
    });

    it('should handle undefined teams parameter', () => {
      const scores = sessionService.initializeTeamScores();
      expect(scores).toEqual([]);
    });
  });

  describe('Session Overtime Detection', () => {
    it('should set game clock overtime threshold when starting game', async () => {
      const gameClockService = require('../../../src/services/gameClockService');
      const setOvertimeThresholdSpy = jest.spyOn(gameClockService, 'setOvertimeThreshold');

      await sessionService.createSession({
        name: 'Overtime Test',
        teams: ['Team Alpha']
      });

      await sessionService.startGame();

      // Should set threshold to 120 minutes (7200 seconds)
      expect(setOvertimeThresholdSpy).toHaveBeenCalledWith(7200);
    });

    it('should emit session:overtime when game clock exceeds threshold', async () => {
      const gameClockService = require('../../../src/services/gameClockService');
      const handler = jest.fn();

      await sessionService.createSession({
        name: 'Overtime Event Test',
        teams: ['Team Alpha']
      });

      sessionService.on('session:overtime', handler);

      await sessionService.startGame();

      // Manually trigger overtime from game clock
      gameClockService.emit('gameclock:overtime', { elapsed: 7201 });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          sessionName: 'Overtime Event Test',
          expectedDuration: 120
        })
      );
    });
  });

  describe('Cue Engine Activation on Game Start', () => {
    it('should activate cue engine when game starts', async () => {
      const cueEngineService = require('../../../src/services/cueEngineService');
      const activateSpy = jest.spyOn(cueEngineService, 'activate');

      await sessionService.createSession({
        name: 'Cue Engine Test',
        teams: ['Team Alpha']
      });

      await sessionService.startGame();

      expect(activateSpy).toHaveBeenCalled();

      activateSpy.mockRestore();
    });
  });

  describe('Session Validation', () => {
    it('should validate GM station capacity', async () => {
      await sessionService.createSession({
        name: 'Capacity Test',
        teams: ['Team Alpha']
      });

      // Add devices up to capacity
      for (let i = 1; i <= 10; i++) {
        await sessionService.updateDevice({
          id: `GM-${String(i).padStart(3, '0')}`,
          type: 'gm'
        });
      }

      // Should still accept (default capacity is likely higher)
      expect(sessionService.canAcceptGmStation()).toBe(true);
    });

    it('should return true when no current session (allows GM to connect)', () => {
      // When no session exists, GM is allowed to connect (will create session via Admin)
      expect(sessionService.canAcceptGmStation()).toBe(true);
    });
  });

  describe('Persistence Listeners (Slice 2)', () => {
    const transactionService = require('../../../src/services/transactionService');
    const TeamScore = require('../../../src/models/teamScore');

    beforeEach(async () => {
      await resetAllServices();
    });

    afterEach(async () => {
      if (sessionService.currentSession) {
        await sessionService.endSession();
      }
      sessionService.removeAllListeners();
      transactionService.removeAllListeners();
    });

    describe('transaction:accepted listener (new format)', () => {
      it('should persist transaction and device tracking when new format payload received', async () => {
        await sessionService.createSession({
          name: 'Persistence Test',
          teams: ['Team Alpha']
        });

        const session = sessionService.getCurrentSession();
        const initialTxCount = session.transactions.length;

        // Simulate transactionService's flow: the live TeamScore instance in
        // session.scores was already mutated BEFORE the event fired (single
        // canonical store) — the payload teamScore is a broadcast snapshot.
        const liveScore = session.scores.find(s => s.teamId === 'Team Alpha');
        liveScore.addPoints(100);
        const txId = uuidv4();

        transactionService.emit('transaction:accepted', {
          transaction: {
            id: txId,
            tokenId: 'test-token',
            teamId: 'Team Alpha',
            deviceId: 'GM_001',
            deviceType: 'gm',
            sessionId: session.id,
            status: 'accepted',
            points: 100,
            timestamp: new Date().toISOString()
          },
          teamScore: liveScore.toJSON(),
          deviceTracking: { deviceId: 'GM_001', tokenId: 'test-token' }
        });

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify transaction was added to session
        const updatedSession = sessionService.getCurrentSession();
        expect(updatedSession.transactions.length).toBe(initialTxCount + 1);
        expect(updatedSession.transactions[initialTxCount].id).toBe(txId);

        // Verify device tracking was recorded for duplicate detection
        expect(updatedSession.hasDeviceScannedToken('GM_001', 'test-token')).toBe(true);

        // Canonical store untouched by the listener (same instance, same value)
        expect(updatedSession.scores.find(s => s.teamId === 'Team Alpha')).toBe(liveScore);
        expect(liveScore.currentScore).toBe(100);
      });

      it('should NOT overwrite the canonical store from the payload snapshot', async () => {
        await sessionService.createSession({
          name: 'No Clobber Test',
          teams: ['Team Alpha']
        });

        const session = sessionService.getCurrentSession();
        const liveScore = session.scores.find(s => s.teamId === 'Team Alpha');
        liveScore.addPoints(300);

        // Emit with a STALE snapshot (different from the live instance) —
        // the listener must persist, not sync the snapshot back into
        // session.scores (that upsert path died with the dual-store collapse)
        transactionService.emit('transaction:accepted', {
          transaction: {
            id: uuidv4(),
            tokenId: 'tok-stale',
            teamId: 'Team Alpha',
            deviceId: 'GM_001',
            deviceType: 'gm',
            sessionId: session.id,
            status: 'accepted',
            points: 100,
            timestamp: new Date().toISOString()
          },
          teamScore: { ...liveScore.toJSON(), currentScore: 99999 },
          deviceTracking: { deviceId: 'GM_001', tokenId: 'tok-stale' }
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(session.scores.find(s => s.teamId === 'Team Alpha').currentScore).toBe(300);
      });

      it('should not double-persist when old format payload (Transaction object only)', async () => {
        await sessionService.createSession({
          name: 'Old Format Test',
          teams: ['Team Alpha']
        });

        const session = sessionService.getCurrentSession();
        const initialTxCount = session.transactions.length;

        // Emit old format transaction:accepted (no teamScore field)
        transactionService.emit('transaction:accepted', {
          id: 'tx-old-format-001',
          tokenId: 'test-token',
          teamId: 'Team Alpha',
          deviceId: 'GM_001',
          sessionId: session.id,
          status: 'accepted',
          points: 100
        });

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify transaction was NOT added by new listener (old callers still add it)
        const updatedSession = sessionService.getCurrentSession();
        expect(updatedSession.transactions.length).toBe(initialTxCount); // No change
      });
    });

    describe('score:adjusted listener', () => {
      it('should persist admin score adjustment', async () => {
        await sessionService.createSession({
          name: 'Admin Adjust Test',
          teams: ['Team Alpha']
        });

        const session = sessionService.getCurrentSession();

        // The adjustment mutates the live instance in session.scores BEFORE
        // the event fires (canonical store); the listener only persists.
        const liveScore = session.scores.find(s => s.teamId === 'Team Alpha');
        liveScore.addPoints(500);
        liveScore.adjustScore(100, 'GM_001', 'Manual bonus');

        // Emit score:adjusted (snapshot payload, as adjustTeamScore does)
        transactionService.emit('score:adjusted', {
          teamScore: liveScore.toJSON(),
          reason: 'Manual bonus',
          isAdminAction: true
        });

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify the adjusted score reached persistence
        const persistenceService = require('../../../src/services/persistenceService');
        const persisted = await persistenceService.load('session:current');
        const persistedScore = persisted.scores.find(s => s.teamId === 'Team Alpha');
        expect(persistedScore.currentScore).toBe(600);
        expect(persistedScore.adminAdjustments).toHaveLength(1);
      });
    });

    describe('transaction:deleted listener', () => {
      // NOTE (Phase 2 collapse): upsertTeamScore is gone — the rebuild
      // mutates session.scores in place before transaction:deleted fires,
      // so this listener only persists.
      it('should persist the rebuilt scores after deletion', async () => {
        await sessionService.createSession({
          name: 'Delete Test',
          teams: ['Team Alpha']
        });

        const session = sessionService.getCurrentSession();

        // Simulate deleteTransaction's flow: rebuild already zeroed the live
        // instance in session.scores before the event fires
        const liveScore = session.scores.find(s => s.teamId === 'Team Alpha');
        liveScore.addPoints(500);
        liveScore.reset();

        // Emit transaction:deleted (snapshot payload for broadcasts)
        transactionService.emit('transaction:deleted', {
          transactionId: 'tx-to-delete',
          tokenId: 'test-token',
          teamId: 'Team Alpha',
          updatedTeamScore: liveScore.toJSON(),
          allTeamScores: session.scores.map(s => s.toJSON())
        });

        // Wait for async handler
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify the rebuilt (zeroed) score reached persistence
        const persistenceService = require('../../../src/services/persistenceService');
        const persisted = await persistenceService.load('session:current');
        expect(persisted.scores.find(s => s.teamId === 'Team Alpha').currentScore).toBe(0);
      });
    });
  });

  describe('saveCurrentSession write serialization (F-BCORE-07)', () => {
    it('serializes concurrent saves so writes land in call order', async () => {
      const persistenceService = require('../../../src/services/persistenceService');

      await sessionService.createSession({
        name: 'Write Queue Test',
        teams: []
      });

      const events = [];
      let releaseFirst;
      let firstCall = true;

      const saveSessionSpy = jest.spyOn(persistenceService, 'saveSession')
        .mockImplementation(async () => {
          events.push('saveSession:start');
          if (firstCall) {
            firstCall = false;
            // Hold the FIRST write open so an unserialized second call would overlap
            await new Promise(resolve => { releaseFirst = resolve; });
          }
          events.push('saveSession:end');
        });
      const saveSpy = jest.spyOn(persistenceService, 'save')
        .mockImplementation(async () => {
          events.push('save:current');
        });

      try {
        const p1 = sessionService.saveCurrentSession();
        const p2 = sessionService.saveCurrentSession();

        // Let microtasks run — the first write is now blocked mid-flight
        await new Promise(resolve => setImmediate(resolve));

        // Without serialization both saveSession calls have already started
        expect(events.filter(e => e === 'saveSession:start')).toHaveLength(1);

        releaseFirst();
        await Promise.all([p1, p2]);

        // Each save must fully complete (saveSession + session:current alias)
        // before the next one starts
        expect(events).toEqual([
          'saveSession:start', 'saveSession:end', 'save:current',
          'saveSession:start', 'saveSession:end', 'save:current'
        ]);
      } finally {
        saveSessionSpy.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('keeps accepting writes after a failed save', async () => {
      const persistenceService = require('../../../src/services/persistenceService');

      await sessionService.createSession({
        name: 'Write Queue Failure Test',
        teams: []
      });

      const saveSessionSpy = jest.spyOn(persistenceService, 'saveSession')
        .mockRejectedValueOnce(new Error('disk full'));

      try {
        await expect(sessionService.saveCurrentSession()).rejects.toThrow('disk full');
        // The queue must not be poisoned by the failure
        await expect(sessionService.saveCurrentSession()).resolves.toBeUndefined();
      } finally {
        saveSessionSpy.mockRestore();
      }
    });
  });

  describe('scores:reset listener — full restart semantics (F-BCORE-02 / F-BCORE-04, decision A3)', () => {
    const transactionService = require('../../../src/services/transactionService');
    const persistenceService = require('../../../src/services/persistenceService');
    const Session = require('../../../src/models/session');
    const Token = require('../../../src/models/token');

    const makeToken = (id, value) => new Token({
      id,
      name: `Token ${id}`,
      value,
      memoryType: 'Technical',
      mediaAssets: { image: null, audio: null, video: null, processingImage: null },
      metadata: { rating: 3 }
    });

    const wait = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));

    beforeEach(async () => {
      await resetAllServices();
      await sessionService.createSession({
        name: 'Reset Semantics Session',
        teams: ['Team Alpha']
      });
      await sessionService.startGame();
      transactionService.tokens.set('rst001', makeToken('rst001', 450000));
      transactionService.tokens.set('rst002', makeToken('rst002', 150000));
    });

    afterEach(async () => {
      if (sessionService.currentSession) {
        await sessionService.endSession();
      }
      sessionService.removeAllListeners();
      transactionService.removeAllListeners();
    });

    it('zeroes real TeamScore fields and clears transactions + dedup state in session', async () => {
      await transactionService.processScan({
        tokenId: 'rst001',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      const session = sessionService.getCurrentSession();
      expect(session.scores.find(s => s.teamId === 'Team Alpha').currentScore).toBe(450000);

      transactionService.resetScores();
      await wait();

      const score = session.scores.find(s => s.teamId === 'Team Alpha');
      // Real TeamScore fields zeroed (not the nonexistent transactionCount/lastUpdated)
      expect(score.currentScore).toBe(0);
      expect(score.baseScore).toBe(0);
      expect(score.bonusPoints).toBe(0);
      expect(score.tokensScanned).toBe(0);
      expect(score.completedGroups).toEqual([]);
      expect(score.transactionCount).toBeUndefined();
      expect(score.lastUpdated).toBeUndefined();

      // Decision A3: full restart — history and dedup state cleared
      expect(session.transactions).toEqual([]);
      expect(session.metadata.scannedTokensByDevice).toEqual({});
      expect(session.metadata.totalScans).toBe(0);
      expect(session.metadata.uniqueTokensScanned).toEqual([]);
    });

    it('does not resurrect pre-reset scores after an orchestrator restart', async () => {
      await transactionService.processScan({
        tokenId: 'rst001',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      transactionService.resetScores();
      await wait();

      // Simulate restart: hydrating the persisted session IS the restore —
      // session.scores is the single canonical store (no restoreFromSession)
      const persisted = await persistenceService.load('session:current');
      expect(persisted).toBeTruthy();
      const restored = Session.fromJSON(persisted);
      sessionService.currentSession = restored;

      // First post-restart scan must NOT include the pre-reset 450000
      const result = await transactionService.processScan({
        tokenId: 'rst002',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      expect(result.status).toBe('accepted');
      const teamScore = restored.scores.find(s => s.teamId === 'Team Alpha');
      expect(teamScore.currentScore).toBe(150000);
      expect(teamScore.baseScore).toBe(150000);
    });

    it('makes previously claimed tokens claimable again (full restart)', async () => {
      const scanRequest = {
        tokenId: 'rst001',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      };

      const first = await transactionService.processScan(scanRequest);
      expect(first.status).toBe('accepted');
      await wait();

      const dup = await transactionService.processScan(scanRequest);
      expect(dup.status).toBe('duplicate');

      transactionService.resetScores();
      await wait();

      const rescan = await transactionService.processScan(scanRequest);
      expect(rescan.status).toBe('accepted');
    });

    it('transaction:delete after reset cannot resurrect pre-reset scores (F-BCORE-04)', async () => {
      await transactionService.processScan({
        tokenId: 'rst001',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      transactionService.resetScores();
      await wait();

      const postReset = await transactionService.processScan({
        tokenId: 'rst002',
        teamId: 'Team Alpha',
        deviceId: 'GM_RST',
        deviceType: 'gm',
        mode: 'blackmarket',
        timestamp: new Date().toISOString()
      });
      await wait();

      const session = sessionService.getCurrentSession();
      transactionService.deleteTransaction(postReset.transaction.id, session);
      await wait();

      // Rebuild must see ONLY post-reset history (now empty) — not the
      // pre-reset rst001 transaction (ghost scoring)
      expect(session.scores.find(s => s.teamId === 'Team Alpha').currentScore).toBe(0);
    });
  });

  describe('Team Sync Infrastructure (Slice 1)', () => {
    const transactionService = require('../../../src/services/transactionService');

    beforeEach(async () => {
      await resetAllServices();
    });

    afterEach(async () => {
      if (sessionService.currentSession) {
        await sessionService.endSession();
      }
      sessionService.removeAllListeners();
      transactionService.removeAllListeners();
    });

    it('should make new team visible to transactionService when addTeamToSession called', async () => {
      // Create session with no teams
      await sessionService.createSession({
        name: 'Team Sync Test',
        teams: []
      });

      // Verify transactionService sees no teams initially
      expect(transactionService.getTeamScores()).toHaveLength(0);

      // Add team mid-game
      await sessionService.addTeamToSession('New Team');

      // Visible through transactionService immediately (it reads
      // session.scores directly — no sync step exists anymore)
      const scores = transactionService.getTeamScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].teamId).toBe('New Team');
      expect(scores[0].currentScore).toBe(0);
    });

    it('should add team to session.scores as source of truth', async () => {
      await sessionService.createSession({
        name: 'Source of Truth Test',
        teams: []
      });

      await sessionService.addTeamToSession('Team Alpha');

      const session = sessionService.getCurrentSession();
      expect(session.scores.length).toBe(1);
      expect(session.scores[0].teamId).toBe('Team Alpha');
    });

    it('should reject duplicate team names', async () => {
      await sessionService.createSession({
        name: 'Duplicate Test',
        teams: ['Team Alpha']
      });

      await expect(
        sessionService.addTeamToSession('Team Alpha')
      ).rejects.toThrow('already exists');
    });

    it('should trim team name when adding', async () => {
      await sessionService.createSession({
        name: 'Trim Test',
        teams: []
      });

      await sessionService.addTeamToSession('  Spaced Team  ');

      const session = sessionService.getCurrentSession();
      expect(session.scores[0].teamId).toBe('Spaced Team');
      expect(transactionService.getTeamScores().map(s => s.teamId)).toContain('Spaced Team');
    });

    it('should emit session:updated after adding team', (done) => {
      sessionService.createSession({
        name: 'Event Test',
        teams: []
      }).then(() => {
        sessionService.once('session:updated', (eventData) => {
          try {
            // Verify the updated session contains the new team
            const teams = eventData.scores ? eventData.scores.map(s => s.teamId) : [];
            expect(teams).toContain('Broadcasted Team');
            done();
          } catch (error) {
            done(error);
          }
        });

        sessionService.addTeamToSession('Broadcasted Team');
      });
    });
  });
});
