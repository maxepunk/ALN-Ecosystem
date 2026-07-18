/**
 * SessionService restart-restore tests (F-SHOW-01/03, decision E1)
 *
 * After an orchestrator restart mid-game, sessionService.init() must restore
 * the cue engine runtime state (active flag, fired clock cues, disabled cues)
 * and the game clock overtime threshold — not just the clock itself.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../../src/services/persistenceService', () => ({
  load: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(undefined),
  saveSession: jest.fn().mockResolvedValue(undefined),
  loadSession: jest.fn().mockResolvedValue(null),
  backupSession: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
}));

describe('SessionService restart restore (F-SHOW-01)', () => {
  let sessionService, gameClockService, cueEngineService, persistenceService;

  const CLOCK_CUES = [
    {
      id: 'hour-mark', label: 'Hour Mark',
      trigger: { clock: '00:30:00' }, // 1800s — past at restore
      commands: [],
    },
    {
      id: 'endgame', label: 'Endgame',
      trigger: { clock: '01:30:00' }, // 5400s — future at restore
      commands: [],
    },
  ];

  function buildSessionJSON({ status = 'active', elapsedMs = 3600000 } = {}) {
    return {
      id: uuidv4(),
      name: 'Restored Game',
      startTime: new Date(Date.now() - elapsedMs).toISOString(),
      endTime: null,
      status,
      transactions: [],
      connectedDevices: [],
      videoQueue: [],
      scores: [],
      playerScans: [],
      metadata: {
        gmStations: 0,
        playerDevices: 0,
        totalScans: 0,
        uniqueTokensScanned: [],
        scannedTokensByDevice: {},
      },
      gameClock: {
        startTime: Date.now() - elapsedMs, // 3600s elapsed
        pausedAt: status === 'paused' ? Date.now() : null,
        totalPausedMs: 0,
        overtimeThreshold: 7200,
      },
      cueEngine: {
        active: status === 'active',
        firedClockCues: [],
        disabledCues: ['some-disabled-cue'],
      },
    };
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-require AFTER resetModules — the mock factory produces a fresh
    // instance per module registry, and sessionService binds to that one.
    persistenceService = require('../../../src/services/persistenceService');
    sessionService = require('../../../src/services/sessionService');
    gameClockService = require('../../../src/services/gameClockService');
    cueEngineService = require('../../../src/services/cueEngineService');

    gameClockService.reset();
    cueEngineService.reset();
    sessionService.initState();
  });

  afterEach(() => {
    cueEngineService.cleanup();
    gameClockService.cleanup();
    sessionService.removeAllListeners();
    const listenerRegistry = require('../../../src/websocket/listenerRegistry');
    listenerRegistry.cleanup();
  });

  it('restores and ACTIVATES the cue engine when the restored session is active', async () => {
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? buildSessionJSON() : null
    );

    await sessionService.init();

    expect(cueEngineService.active).toBe(true);
    expect(cueEngineService.disabledCues.has('some-disabled-cue')).toBe(true);
  });

  it('re-applies the overtime threshold from the persisted game clock', async () => {
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? buildSessionJSON() : null
    );

    await sessionService.init();

    expect(gameClockService.overtimeThreshold).toBe(7200);
  });

  it('marks past clock cues as fired without firing them (E1 mark-don\'t-fire)', async () => {
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? buildSessionJSON() : null
    );

    await sessionService.init();

    // App init order: cues.json is loaded AFTER sessionService.init()
    cueEngineService.loadCues(CLOCK_CUES);

    const fired = [];
    cueEngineService.on('cue:fired', (d) => fired.push(d.cueId));

    // Next tick after restore: past cue must NOT fire, future not yet due
    cueEngineService.handleClockTick(3601);
    await new Promise((r) => setTimeout(r, 10));
    expect(fired).toEqual([]);
    expect(cueEngineService.firedClockCues.has('hour-mark')).toBe(true);

    // Future clock cue still fires at its threshold
    cueEngineService.handleClockTick(5400);
    await new Promise((r) => setTimeout(r, 10));
    expect(fired).toContain('endgame');
  });

  it('does NOT activate the cue engine for a paused restored session', async () => {
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? buildSessionJSON({ status: 'paused' }) : null
    );

    await sessionService.init();

    expect(cueEngineService.active).toBe(false);
  });

  it('suspends the cue engine at session end (F-SHOW-13, decision E4)', async () => {
    // Event-triggered standing cues must not keep firing during post-game
    // cleanup (e.g., music:track:changed cues on cleanup music).
    await sessionService.init();
    await sessionService.createSession({ name: 'End Test', teams: [] });
    await sessionService.startGame();
    expect(cueEngineService.active).toBe(true);

    await sessionService.endSession();

    expect(cueEngineService.active).toBe(false);
  });

  it('persists cue engine runtime state beside gameClock on save', async () => {
    await sessionService.init();
    await sessionService.createSession({ name: 'Persist Test', teams: [] });
    await sessionService.startGame();

    const saved = persistenceService.saveSession.mock.calls.at(-1)[0];
    expect(saved.cueEngine).toEqual({
      active: true,
      firedClockCues: [],
      disabledCues: [],
    });
    expect(saved.gameClock).toEqual(
      expect.objectContaining({ overtimeThreshold: expect.any(Number) })
    );

    await sessionService.endSession();
  });

  // ── Phase 3 A2: pack-mismatch warning on restore ────────────────────────
  // A session's rules are frozen at start; its pack stamp is the mechanism.
  // Restoring under a DIFFERENT active pack must be loud.

  function packWarns(logger) {
    return logger.warn.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('DIFFERENT pack')
    );
  }

  it('loud-warns when a restored session was created under a different pack', async () => {
    const logger = require('../../../src/utils/logger');
    const json = buildSessionJSON();
    json.metadata.pack = {
      packId: 'some-other-game',
      version: '2.0.0',
      contentHash: `sha256:${'d'.repeat(64)}`,
    };
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? json : null
    );

    await sessionService.init();

    expect(packWarns(logger)).toHaveLength(1);
    await sessionService.endSession();
  });

  it('does not warn when the restored session matches the active pack', async () => {
    const logger = require('../../../src/utils/logger');
    const packService = require('../../../src/services/packService');
    const json = buildSessionJSON();
    json.metadata.pack = packService.getActivePackInfo();
    expect(json.metadata.pack).not.toBeNull(); // test env runs the real ALN pack
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? json : null
    );

    await sessionService.init();

    expect(packWarns(logger)).toHaveLength(0);
    await sessionService.endSession();
  });

  it('warns for legacy sessions with no pack stamp (unknown provenance)', async () => {
    const logger = require('../../../src/utils/logger');
    const json = buildSessionJSON(); // metadata has no pack key at all
    persistenceService.load.mockImplementation(async (key) =>
      key === 'session:current' ? json : null
    );

    await sessionService.init();

    expect(packWarns(logger)).toHaveLength(1);
    await sessionService.endSession();
  });
});
