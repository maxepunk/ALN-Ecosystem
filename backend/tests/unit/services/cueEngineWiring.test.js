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

    ({ setupCueEngineForwarding } = require('../../../src/services/cueEngineWiring'));
  });

  describe('spotify event forwarding', () => {
    it('should forward spotify track:changed to cue engine as spotify:track:changed', () => {
      const mockSpotifyService = new EventEmitter();

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
        spotifyService: mockSpotifyService,
      });

      mockSpotifyService.emit('track:changed', { title: 'Test', artist: 'Artist' });

      expect(cueEngineService.handleGameEvent).toHaveBeenCalledWith(
        'spotify:track:changed',
        { title: 'Test', artist: 'Artist' }
      );
    });

    it('should not fail when spotifyService is not provided', () => {
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
});
