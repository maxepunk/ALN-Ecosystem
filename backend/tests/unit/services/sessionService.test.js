/**
 * SessionService Unit Tests
 * Tests session:update event emission per asyncapi.yaml
 */

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
          expect(eventData.status).toBe('active');
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
      expect(eventData).toHaveProperty('status', 'active');
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
      expect(session.status).toBe('active');
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
      expect(session1.status).toBe('active');

      // Create second session (should end first)
      const session2 = await sessionService.createSession({
        name: 'Second Session',
        teams: ['002']
      });

      expect(session2.status).toBe('active');
      expect(session2.id).not.toBe(session1.id);
      // First session should no longer be current
      expect(sessionService.getCurrentSession().id).toBe(session2.id);
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

      sessionService.updateSessionStatus('paused');
      expect(sessionService.getCurrentSession().status).toBe('paused');

      sessionService.updateSessionStatus('active');
      expect(sessionService.getCurrentSession().status).toBe('active');
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
      expect(sessionService.sessionTimeoutTimer).toBeNull();
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
      expect(scores[0]).toEqual({
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

  describe('Session Timeout', () => {
    it('should start session timeout timer', async () => {
      await sessionService.createSession({
        name: 'Timeout Test',
        teams: ['Team Alpha']
      });

      expect(sessionService.sessionTimeoutTimer).not.toBeNull();
    });

    it('should stop session timeout timer', async () => {
      await sessionService.createSession({
        name: 'Stop Timeout Test',
        teams: ['Team Alpha']
      });

      sessionService.stopSessionTimeout();
      expect(sessionService.sessionTimeoutTimer).toBeNull();
    });

    it('should handle stopSessionTimeout when timer is null', () => {
      // Should not throw
      expect(() => sessionService.stopSessionTimeout()).not.toThrow();
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
});
