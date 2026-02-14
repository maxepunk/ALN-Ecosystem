'use strict';

describe('Session Lifecycle', () => {
  let sessionService, transactionService, gameClockService;

  beforeEach(async () => {
    jest.resetModules();
    sessionService = require('../../../src/services/sessionService');
    transactionService = require('../../../src/services/transactionService');
    gameClockService = require('../../../src/services/gameClockService');
    // Reset services to clean state
    await sessionService.reset();
    gameClockService.reset();
  });

  afterEach(() => {
    gameClockService.cleanup();
  });

  describe('session:create creates setup session', () => {
    it('should create session with status setup', async () => {
      const session = await sessionService.createSession({ name: 'Test Game' });
      expect(session.status).toBe('setup');
    });

    it('should not start the game clock on create', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      expect(gameClockService.getState().status).toBe('stopped');
    });

    it('should emit session:created with setup status', async () => {
      const handler = jest.fn();
      sessionService.on('session:created', handler);
      await sessionService.createSession({ name: 'Test Game' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'setup' })
      );
    });
  });

  describe('session:start transitions setup to active', () => {
    it('should transition session to active', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      const session = sessionService.getCurrentSession();
      expect(session.status).toBe('active');
    });

    it('should record gameStartTime on session', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      const session = sessionService.getCurrentSession();
      expect(session.gameStartTime).toBeTruthy();
    });

    it('should start the game clock', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      expect(gameClockService.getState().status).toBe('running');
    });

    it('should emit session:started event', async () => {
      const handler = jest.fn();
      sessionService.on('session:started', handler);
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          gameStartTime: expect.any(String)
        })
      );
    });

    it('should throw if session is not in setup state', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame(); // Now active
      await expect(sessionService.startGame()).rejects.toThrow();
    });

    it('should throw if no session exists', async () => {
      await expect(sessionService.startGame()).rejects.toThrow();
    });
  });

  describe('transactions rejected unless active', () => {
    it('should reject scan during setup', async () => {
      await sessionService.createSession({ name: 'Test Game', teams: ['Team A'] });
      // Session is in setup - processScan should reject
      const result = await transactionService.processScan({
        tokenId: 'test-token',
        teamId: 'Team A',
        deviceId: 'gm-1',
        deviceType: 'gm',
        mode: 'blackMarket'
      });
      expect(result.status).toBe('rejected');
      expect(result.reason || result.message).toMatch(/no active game/i);
    });
  });

  describe('active session tests', () => {
    beforeEach(async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.startGame();
    });

    describe('pause/resume integrates with game clock', () => {
      it('should pause game clock on session:pause', async () => {
        await sessionService.updateSession({ status: 'paused' });
        expect(gameClockService.getState().status).toBe('paused');
      });

      it('should resume game clock on session:resume', async () => {
        await sessionService.updateSession({ status: 'paused' });
        await sessionService.updateSession({ status: 'active' });
        expect(gameClockService.getState().status).toBe('running');
      });

      it('should stop game clock on session end', async () => {
        await sessionService.endSession();
        expect(gameClockService.getState().status).toBe('stopped');
      });
    });

    describe('game clock state persisted on session', () => {
      it('should include gameClock in session after startGame', async () => {
        const session = sessionService.getCurrentSession();
        expect(session.gameClock).toBeDefined();
        expect(session.gameClock.startTime).toBeTruthy();
      });
    });
  });

  describe('end session from setup state', () => {
    it('should allow ending a session that is still in setup', async () => {
      await sessionService.createSession({ name: 'Test Game' });
      await sessionService.endSession();
      expect(sessionService.getCurrentSession()).toBeNull();
    });
  });

  describe('pause cascade includes Spotify', () => {
    it('should pause Spotify on session:pause', async () => {
      const spotifyService = require('../../../src/services/spotifyService');
      jest.spyOn(spotifyService, 'pauseForGameClock').mockResolvedValue();
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      expect(spotifyService.pauseForGameClock).toHaveBeenCalled();
    });

    it('should resume Spotify on session:resume only if pausedByGameClock', async () => {
      const spotifyService = require('../../../src/services/spotifyService');
      jest.spyOn(spotifyService, 'pauseForGameClock').mockResolvedValue();
      jest.spyOn(spotifyService, 'resumeFromGameClock').mockResolvedValue();
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      await sessionService.updateSession({ status: 'active' });
      expect(spotifyService.resumeFromGameClock).toHaveBeenCalled();
    });
  });

  describe('pause cascade includes cue engine', () => {
    it('should suspend cue engine on session:pause', async () => {
      const cueEngineService = require('../../../src/services/cueEngineService');
      jest.spyOn(cueEngineService, 'suspend');
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      expect(cueEngineService.suspend).toHaveBeenCalled();
    });

    it('should activate cue engine on session:resume', async () => {
      const cueEngineService = require('../../../src/services/cueEngineService');
      jest.spyOn(cueEngineService, 'suspend');
      jest.spyOn(cueEngineService, 'activate');
      await sessionService.createSession({ name: 'Test' });
      await sessionService.startGame();
      await sessionService.updateSession({ status: 'paused' });
      await sessionService.updateSession({ status: 'active' });
      expect(cueEngineService.activate).toHaveBeenCalled();
    });
  });
});
