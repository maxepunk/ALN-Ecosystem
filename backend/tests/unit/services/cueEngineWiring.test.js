'use strict';

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const EventEmitter = require('events');

describe('cueEngineWiring', () => {
  let setupCueEngineForwarding;
  let listenerRegistry;
  let cueEngineService;

  beforeEach(() => {
    jest.resetModules();
    // Real listenerRegistry tracks listeners
    listenerRegistry = {
      addTrackedListener: jest.fn((emitter, event, handler, label) => {
        emitter.on(event, handler);
      }),
    };
    cueEngineService = new EventEmitter();
    cueEngineService.handleGameEvent = jest.fn();
    cueEngineService.handleClockTick = jest.fn();
    cueEngineService._tickActiveCompoundCues = jest.fn();
    cueEngineService.handleVideoProgressEvent = jest.fn();
    cueEngineService.handleVideoLifecycleEvent = jest.fn();
    cueEngineService.fireEventCuesAndWait = jest.fn();

    ({ setupCueEngineForwarding } = require('../../../src/services/cueEngineWiring'));
  });

  describe('music event forwarding', () => {
    it('should forward music track:changed to cue engine as music:track:changed', () => {
      const mockMusicService = new EventEmitter();

      const mockVideoQueueService = new EventEmitter();
      mockVideoQueueService.registerPrePlayHook = jest.fn();

      setupCueEngineForwarding({
        listenerRegistry,
        gameClockService: new EventEmitter(),
        transactionService: new EventEmitter(),
        videoQueueService: mockVideoQueueService,
        sessionService: new EventEmitter(),
        soundService: new EventEmitter(),
        cueEngineService,
        musicService: mockMusicService,
      });

      mockMusicService.emit('track:changed', { track: { title: 'Test', artist: 'Artist' } });

      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith(
        'music:track:changed',
        { track: { title: 'Test', artist: 'Artist' } }
      );
    });

    it('should not fail when musicService is not provided', () => {
      const mockVideoQueueService = new EventEmitter();
      mockVideoQueueService.registerPrePlayHook = jest.fn();

      expect(() => {
        setupCueEngineForwarding({
          listenerRegistry,
          gameClockService: new EventEmitter(),
          transactionService: new EventEmitter(),
          videoQueueService: mockVideoQueueService,
          sessionService: new EventEmitter(),
          cueEngineService,
        });
      }).not.toThrow();
    });
  });

  // Exercises every forwarding listener wired by setupCueEngineForwarding so the
  // wiring itself is regression-protected (a silently-dropped forward is exactly
  // the kind of bug unit tests should catch). Each case emits a source event and
  // asserts the corresponding cueEngineService method is invoked with the
  // normalized payload.
  describe('event forwarding (all wired listeners)', () => {
    let services;
    let prePlayHook;

    beforeEach(() => {
      const videoQueueService = new EventEmitter();
      videoQueueService.registerPrePlayHook = jest.fn((fn) => { prePlayHook = fn; });

      services = {
        listenerRegistry,
        gameClockService: new EventEmitter(),
        transactionService: new EventEmitter(),
        videoQueueService,
        sessionService: new EventEmitter(),
        soundService: new EventEmitter(),
        musicService: new EventEmitter(),
        cueEngineService,
      };

      setupCueEngineForwarding(services);
    });

    it('forwards gameclock:tick → handleClockTick + _tickActiveCompoundCues', () => {
      services.gameClockService.emit('gameclock:tick', { elapsed: 42 });
      expect(cueEngineService.handleClockTick).toHaveBeenCalledWith(42);
      expect(cueEngineService._tickActiveCompoundCues).toHaveBeenCalledWith(42);
    });

    it('forwards transaction:accepted', () => {
      const payload = { transaction: { id: 't1' } };
      services.transactionService.emit('transaction:accepted', payload);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('transaction:accepted', payload);
    });

    it('forwards group:completed', () => {
      const data = { group: 'Server Logs' };
      services.transactionService.emit('group:completed', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('group:completed', data);
    });

    it('fires video:loading via the (blocking) pre-play hook', () => {
      const data = { tokenId: 'abc', video: 'v.mp4' };
      expect(typeof prePlayHook).toBe('function');
      prePlayHook(data);
      expect(cueEngineService.fireEventCuesAndWait).toHaveBeenCalledWith('video:loading', data);
    });

    it('forwards video:started as a game event', () => {
      const data = { videoPath: 'v.mp4' };
      services.videoQueueService.emit('video:started', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('video:started', data);
    });

    it('forwards video:progress → handleVideoProgressEvent', () => {
      const data = { position: 0.5 };
      services.videoQueueService.emit('video:progress', data);
      expect(cueEngineService.handleVideoProgressEvent).toHaveBeenCalledWith(data);
    });

    it('forwards video lifecycle paused/resumed/completed', () => {
      // paused/resumed/completed are wired to BOTH the game-event handler
      // (standing-cue evaluation, F-TOOL-09/E6) and the lifecycle handler
      // (compound-cue timeline control)
      services.videoQueueService.emit('video:paused', { a: 1 });
      expect(cueEngineService.handleVideoLifecycleEvent).toHaveBeenCalledWith('paused', { a: 1 });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('video:paused', { a: 1 });

      services.videoQueueService.emit('video:resumed', { a: 2 });
      expect(cueEngineService.handleVideoLifecycleEvent).toHaveBeenCalledWith('resumed', { a: 2 });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('video:resumed', { a: 2 });

      services.videoQueueService.emit('video:completed', { a: 3 });
      expect(cueEngineService.handleVideoLifecycleEvent).toHaveBeenCalledWith('completed', { a: 3 });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('video:completed', { a: 3 });
    });

    it('forwards session:created with only the sessionId', () => {
      services.sessionService.emit('session:created', { id: 'sess-1', name: 'ignored' });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('session:created', { sessionId: 'sess-1' });
    });

    it('forwards player-scan:added as player:scan', () => {
      const data = { tokenId: 'tok' };
      services.sessionService.emit('player-scan:added', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('player:scan', data);
    });

    it('forwards sound:completed', () => {
      const data = { file: 's.wav' };
      services.soundService.emit('sound:completed', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('sound:completed', data);
    });

    it('forwards cue:completed (cue chaining)', () => {
      const data = { cueId: 'c1' };
      cueEngineService.emit('cue:completed', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('cue:completed', data);
    });

    it('forwards gameclock:started', () => {
      const data = { startTime: 123 };
      services.gameClockService.emit('gameclock:started', data);
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('gameclock:started', data);
    });

    it('forwards music playback:changed and playlist:changed with a music: prefix', () => {
      services.musicService.emit('playback:changed', { state: 'playing' });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('music:playback:changed', { state: 'playing' });

      services.musicService.emit('playlist:changed', { id: 'p1' });
      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith('music:playlist:changed', { id: 'p1' });
    });
  });
});
