/**
 * Unit tests for syncHelpers
 * Tests buildHeldItemsState() graceful degradation and recentTransactions enrichment
 */

'use strict';

const { buildSyncFullPayload, buildHeldItemsState } = require('../../../src/websocket/syncHelpers');

describe('buildSyncFullPayload recentTransactions enrichment', () => {
  function makeMinimalServices({ transactions = [], token = null } = {}) {
    const session = {
      id: 'test-session',
      transactions,
      connectedDevices: [],
      playerScans: [],
      toJSON: () => ({ id: 'test-session', teams: [], status: 'active' }),
    };
    return {
      sessionService: { getCurrentSession: () => session },
      transactionService: {
        getTeamScores: () => [],
        getToken: () => token,
      },
      videoQueueService: {
        getState: () => ({
          status: 'idle',
          currentVideo: null,
          queue: [],
          queueLength: 0,
          connected: false,
        }),
      },
    };
  }

  it('should include owner, group, and isUnknown in recentTransactions', async () => {
    const tx = {
      id: 'tx-1', tokenId: 'tok1', teamId: 'Team A', deviceId: 'gm-1',
      mode: 'blackmarket', status: 'accepted', points: 100,
      timestamp: new Date().toISOString(), summary: null,
    };
    const token = {
      memoryType: 'Technical',
      metadata: { rating: 3, group: 'Server Logs (x3)', owner: 'Alex Reeves' },
      groupId: 'Server Logs',
    };
    const services = makeMinimalServices({ transactions: [tx], token });
    const payload = await buildSyncFullPayload(services);

    expect(payload.recentTransactions).toHaveLength(1);
    const enriched = payload.recentTransactions[0];
    expect(enriched).toHaveProperty('owner', 'Alex Reeves');
    expect(enriched).toHaveProperty('group', 'Server Logs (x3)');
    expect(enriched).toHaveProperty('isUnknown', false);
  });

  it('should set isUnknown true and owner null for unknown tokens', async () => {
    const tx = {
      id: 'tx-2', tokenId: 'unknown-xyz', teamId: 'Team B', deviceId: 'gm-1',
      mode: 'blackmarket', status: 'accepted', points: 0,
      timestamp: new Date().toISOString(), summary: null,
    };
    const services = makeMinimalServices({ transactions: [tx], token: null });
    const payload = await buildSyncFullPayload(services);

    const enriched = payload.recentTransactions[0];
    expect(enriched.isUnknown).toBe(true);
    expect(enriched.owner).toBeNull();
    expect(enriched.group).toBe('No Group');
  });
});

describe('buildSyncFullPayload sound field', () => {
  function makeMinimalServicesWithSound({ soundState = { playing: [] } } = {}) {
    const session = {
      id: 'test-session',
      transactions: [],
      connectedDevices: [],
      playerScans: [],
      toJSON: () => ({ id: 'test-session', teams: [], status: 'active' }),
    };
    return {
      sessionService: { getCurrentSession: () => session },
      transactionService: {
        getTeamScores: () => [],
        getToken: () => null,
      },
      videoQueueService: {
        getState: () => ({
          status: 'idle',
          currentVideo: null,
          queue: [],
          queueLength: 0,
          connected: false,
        }),
      },
      soundService: { getState: () => soundState },
    };
  }

  it('should include sound field with playing array when soundService is provided', async () => {
    const soundState = { playing: [{ file: 'attention.wav', pid: 1234 }] };
    const services = makeMinimalServicesWithSound({ soundState });
    const payload = await buildSyncFullPayload(services);

    expect(payload).toHaveProperty('sound');
    expect(payload.sound).toEqual(soundState);
    expect(payload.sound.playing).toHaveLength(1);
    expect(payload.sound.playing[0].file).toBe('attention.wav');
  });

  it('should fallback to { playing: [] } when soundService is not provided', async () => {
    const services = makeMinimalServicesWithSound();
    delete services.soundService;
    const payload = await buildSyncFullPayload(services);

    expect(payload).toHaveProperty('sound');
    expect(payload.sound).toEqual({ playing: [] });
  });

  it('should include sound field with empty playing array when no sounds active', async () => {
    const services = makeMinimalServicesWithSound({ soundState: { playing: [] } });
    const payload = await buildSyncFullPayload(services);

    expect(payload).toHaveProperty('sound');
    expect(payload.sound.playing).toEqual([]);
  });
});

describe('buildSyncFullPayload videoStatus shape', () => {
  function makeServicesWithVideo(videoState) {
    const session = {
      id: 'test-session',
      transactions: [],
      connectedDevices: [],
      playerScans: [],
      toJSON: () => ({ id: 'test-session', teams: [], status: 'active' }),
    };
    return {
      sessionService: { getCurrentSession: () => session },
      transactionService: {
        getTeamScores: () => [],
        getToken: () => null,
      },
      videoQueueService: {
        getState: () => videoState,
      },
    };
  }

  it('mirrors videoQueueService.getState() shape — playing state', async () => {
    const playingState = {
      status: 'playing',
      currentVideo: { tokenId: 'tok-x', filename: 'tok-x.mp4', position: 0.42, duration: 30 },
      queue: [],
      queueLength: 0,
      connected: true,
    };
    const services = makeServicesWithVideo(playingState);
    const payload = await buildSyncFullPayload(services);

    expect(payload.videoStatus).toEqual(playingState);
  });

  it('mirrors videoQueueService.getState() shape — idle state', async () => {
    const idleState = {
      status: 'idle',
      currentVideo: null,
      queue: [],
      queueLength: 0,
      connected: false,
    };
    const services = makeServicesWithVideo(idleState);
    const payload = await buildSyncFullPayload(services);

    expect(payload.videoStatus).toEqual(idleState);
    expect(payload.videoStatus.status).toBe('idle');
    expect(payload.videoStatus.currentVideo).toBeNull();
  });
});

describe('buildGameClockState expectedDuration', () => {
  it('should derive expectedDuration from SESSION_TIMEOUT config', async () => {
    // Save original
    const originalTimeout = process.env.SESSION_TIMEOUT;
    process.env.SESSION_TIMEOUT = '90';  // 90 minutes

    // Re-require to pick up new env
    jest.resetModules();
    const { buildSyncFullPayload: freshBuild } = require('../../../src/websocket/syncHelpers');

    const session = {
      id: 'test', transactions: [], connectedDevices: [], playerScans: [],
      toJSON: () => ({ id: 'test', teams: [], status: 'active' }),
    };
    const payload = await freshBuild({
      sessionService: { getCurrentSession: () => session },
      transactionService: { getTeamScores: () => [], getToken: () => null },
      videoQueueService: { getState: () => ({ status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false }) },
      gameClockService: null,  // null triggers fallback path
    });

    expect(payload.gameClock.expectedDuration).toBe(5400);  // 90 * 60

    // Restore
    if (originalTimeout !== undefined) {
      process.env.SESSION_TIMEOUT = originalTimeout;
    } else {
      delete process.env.SESSION_TIMEOUT;
    }
    jest.resetModules();
  });
});

describe('buildHeldItemsState()', () => {
  it('should return empty array when no held items exist', () => {
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toEqual([]);
  });

  it('should return held video items from videoQueueService', () => {
    const heldItems = [
      { id: 'held-1', type: 'video', tokenId: 'tok1', reason: 'service_down', status: 'held', heldAt: Date.now() },
      { id: 'held-2', type: 'video', tokenId: 'tok2', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue(heldItems) };

    const result = buildHeldItemsState(null, mockVideoQueueService);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('held-1');
    expect(result[1].id).toBe('held-2');
  });

  it('should gracefully return empty array when videoQueueService is null', () => {
    const result = buildHeldItemsState(null, null);
    expect(result).toEqual([]);
  });

  it('should gracefully return empty array when getHeldVideos throws', () => {
    const mockVideoQueueService = {
      getHeldVideos: jest.fn().mockImplementation(() => { throw new Error('unexpected'); }),
    };

    const result = buildHeldItemsState(null, mockVideoQueueService);
    expect(result).toEqual([]);
  });

  it('should return held cue items from cueEngineService', () => {
    const heldCues = [
      { id: 'held-cue-1', type: 'cue', cueId: 'test-cue', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue(heldCues) };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('cue');
    expect(result[0].cueId).toBe('test-cue');
  });

  it('should combine held cues and held videos', () => {
    const heldCues = [
      { id: 'held-cue-1', type: 'cue', cueId: 'cue1', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const heldVideos = [
      { id: 'held-video-1', type: 'video', tokenId: 'tok1', reason: 'service_down', status: 'held', heldAt: Date.now() },
    ];
    const mockCueEngineService = { getHeldCues: jest.fn().mockReturnValue(heldCues) };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue(heldVideos) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toHaveLength(2);
    expect(result.find(i => i.type === 'cue')).toBeDefined();
    expect(result.find(i => i.type === 'video')).toBeDefined();
  });

  it('should gracefully handle cueEngineService.getHeldCues throwing', () => {
    const mockCueEngineService = {
      getHeldCues: jest.fn().mockImplementation(() => { throw new Error('cue error'); }),
    };
    const mockVideoQueueService = { getHeldVideos: jest.fn().mockReturnValue([]) };

    const result = buildHeldItemsState(mockCueEngineService, mockVideoQueueService);
    expect(result).toEqual([]);
  });
});

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('buildSyncFullPayload contract conformance (CC-2)', () => {
  function makeServices() {
    // NOTE: session.id MUST be a valid UUID — SyncFull.data.session.id has
    // format:uuid and the contract validator loads ajv-formats (enforced even
    // under strict:false). A non-UUID id (e.g. 'sess-1') makes the first test
    // throw a format error before the reconnect-restore-field assertions run.
    const session = {
      id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103', transactions: [], connectedDevices: [], playerScans: [],
      toJSON: () => ({
        id: '2a2f9d45-5d2d-441d-b32c-52c939f3c103', name: 'Test', startTime: new Date().toISOString(),
        status: 'active', teams: [], metadata: {},
      }),
    };
    return {
      sessionService: { getCurrentSession: () => session },
      transactionService: { getTeamScores: () => [], getToken: () => null },
      videoQueueService: {
        getState: () => ({
          status: 'idle', currentVideo: null, queue: [], queueLength: 0, connected: false,
        }),
      },
    };
  }

  it('produces an envelope that validates against the SyncFull schema', async () => {
    const data = await buildSyncFullPayload(makeServices());
    const event = { event: 'sync:full', data, timestamp: new Date().toISOString() };
    expect(() => validateWebSocketEvent(event, 'sync:full')).not.toThrow();
  });

  it('SyncFull schema documents all reconnect-restore fields', async () => {
    // Fail-first lever: a payload missing the newly-required fields must be
    // REJECTED, proving the schema now documents (and requires) them.
    const data = await buildSyncFullPayload(makeServices());
    for (const field of ['playerScans', 'environment', 'gameClock', 'cueEngine', 'music', 'sound', 'displayStatus']) {
      delete data[field];
    }
    const event = { event: 'sync:full', data, timestamp: new Date().toISOString() };
    expect(() => validateWebSocketEvent(event, 'sync:full')).toThrow(/required/i);
  });
});
