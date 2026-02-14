/**
 * Unit tests for systemReset.js — performSystemReset()
 *
 * Validates that all services (including Phase 2 spotifyService) are properly
 * reset and that infrastructure is re-initialized with all required services.
 */

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/persistenceService', () => ({
  archiveSession: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../src/websocket/listenerRegistry', () => ({
  cleanup: jest.fn(),
  addTrackedListener: jest.fn(),
}));
jest.mock('../../../src/websocket/broadcasts', () => ({
  cleanupBroadcastListeners: jest.fn(),
  setupBroadcastListeners: jest.fn(),
}));
jest.mock('../../../src/services/cueEngineWiring', () => ({
  setupCueEngineForwarding: jest.fn(),
}));

describe('performSystemReset', () => {
  let performSystemReset;
  let mockIo;
  let mockServices;
  let broadcasts;
  let cueEngineWiring;
  let listenerRegistry;

  beforeEach(() => {
    jest.clearAllMocks();

    broadcasts = require('../../../src/websocket/broadcasts');
    cueEngineWiring = require('../../../src/services/cueEngineWiring');
    listenerRegistry = require('../../../src/websocket/listenerRegistry');
    ({ performSystemReset } = require('../../../src/services/systemReset'));

    mockIo = { emit: jest.fn() };

    mockServices = {
      sessionService: {
        getCurrentSession: jest.fn().mockReturnValue(null),
        endSession: jest.fn().mockResolvedValue(),
        reset: jest.fn().mockResolvedValue(),
        setupPersistenceListeners: jest.fn(),
      },
      stateService: {
        reset: jest.fn().mockResolvedValue(),
        setupTransactionListeners: jest.fn(),
      },
      transactionService: {
        reset: jest.fn(),
        registerSessionListener: jest.fn(),
      },
      videoQueueService: {
        reset: jest.fn(),
      },
      offlineQueueService: {
        reset: jest.fn().mockResolvedValue(),
      },
      displayControlService: {
        reset: jest.fn(),
        init: jest.fn(),
      },
      vlcService: {},
      bluetoothService: {
        reset: jest.fn(),
      },
      audioRoutingService: {
        reset: jest.fn(),
      },
      lightingService: {
        reset: jest.fn(),
      },
      gameClockService: {
        reset: jest.fn(),
      },
      cueEngineService: {
        reset: jest.fn(),
      },
      soundService: {
        reset: jest.fn(),
      },
      spotifyService: {
        reset: jest.fn(),
      },
    };
  });

  it('should call spotifyService.reset() during system reset', async () => {
    await performSystemReset(mockIo, mockServices);

    expect(mockServices.spotifyService.reset).toHaveBeenCalledTimes(1);
  });

  it('should not throw when spotifyService is not provided', async () => {
    const { spotifyService, ...servicesWithout } = mockServices;
    await expect(performSystemReset(mockIo, servicesWithout)).resolves.not.toThrow();
  });

  it('should pass spotifyService to setupBroadcastListeners', async () => {
    await performSystemReset(mockIo, mockServices);

    expect(broadcasts.setupBroadcastListeners).toHaveBeenCalledWith(
      mockIo,
      expect.objectContaining({
        spotifyService: mockServices.spotifyService,
      })
    );
  });

  it('should pass spotifyService to setupCueEngineForwarding', async () => {
    await performSystemReset(mockIo, mockServices);

    expect(cueEngineWiring.setupCueEngineForwarding).toHaveBeenCalledWith(
      expect.objectContaining({
        spotifyService: mockServices.spotifyService,
      })
    );
  });

  it('should reset all Phase 1 and Phase 2 services', async () => {
    await performSystemReset(mockIo, mockServices);

    // Core services
    expect(mockServices.sessionService.reset).toHaveBeenCalled();
    expect(mockServices.stateService.reset).toHaveBeenCalled();
    expect(mockServices.transactionService.reset).toHaveBeenCalled();
    expect(mockServices.videoQueueService.reset).toHaveBeenCalled();
    expect(mockServices.offlineQueueService.reset).toHaveBeenCalled();

    // Phase 0 environment services
    expect(mockServices.bluetoothService.reset).toHaveBeenCalled();
    expect(mockServices.audioRoutingService.reset).toHaveBeenCalled();
    expect(mockServices.lightingService.reset).toHaveBeenCalled();

    // Phase 1 services
    expect(mockServices.gameClockService.reset).toHaveBeenCalled();
    expect(mockServices.cueEngineService.reset).toHaveBeenCalled();
    expect(mockServices.soundService.reset).toHaveBeenCalled();

    // Phase 2 services
    expect(mockServices.spotifyService.reset).toHaveBeenCalled();
  });

  it('should reset spotifyService before re-initializing infrastructure', async () => {
    const callOrder = [];
    mockServices.spotifyService.reset = jest.fn(() => callOrder.push('spotifyReset'));
    broadcasts.setupBroadcastListeners.mockImplementation(() => callOrder.push('setupBroadcast'));

    await performSystemReset(mockIo, mockServices);

    const spotifyIdx = callOrder.indexOf('spotifyReset');
    const broadcastIdx = callOrder.indexOf('setupBroadcast');
    expect(spotifyIdx).toBeLessThan(broadcastIdx);
  });
});
