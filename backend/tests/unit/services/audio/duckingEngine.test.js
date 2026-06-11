/**
 * Unit tests for DuckingEngine — ducking state machine.
 *
 * Tests the engine via a fake port interface (no pactl/service knowledge needed).
 * Includes regression tests for the bugs fixed in this module:
 *   - F-SHOW-05: empty-array guard + hardcoded-100 fallback removal
 *   - F-SHOW-06: per-target op serialization
 *   - F-SHOW-07: per-instance refcount for same-source overlapping sounds
 *   - F-SHOW-27: null capture falls back to persisted user volume, not 100
 *
 * Decision E3 semantics tested:
 *   - Restore target = captured pre-duck volume (live read)
 *   - Fallback to getUserVolume() when capture missing
 *   - No hardcoded 100 unless both are unavailable
 *   - GM volume adjustment mid-duck (refreshPreDuckCapture) updates restore target
 */

const DuckingEngine = require('../../../../src/services/audio/duckingEngine');

// ── Port factory ──

/**
 * Create a fake port with controllable getVolume and setVolumeLive.
 * @param {Object} opts
 * @param {number|null} opts.liveVolume - volume returned by getVolume (null = sink-input absent)
 * @param {number|null} opts.userVolume - volume returned by getUserVolume (null = no persisted vol)
 */
function makePort({ liveVolume = 100, userVolume = null } = {}) {
  const calls = [];
  return {
    getVolume: jest.fn().mockResolvedValue(liveVolume),
    setVolumeLive: jest.fn().mockImplementation((stream, volume) => {
      calls.push({ stream, volume });
      return Promise.resolve(volume);
    }),
    getUserVolume: jest.fn().mockReturnValue(userVolume),
    _calls: calls,
  };
}

const RULES_VIDEO_SOUND = [
  { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
  { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
];

// ── Constructor ──

describe('DuckingEngine constructor', () => {
  it('throws when port is missing getVolume', () => {
    expect(() => new DuckingEngine({ setVolumeLive: jest.fn(), getUserVolume: jest.fn() }))
      .toThrow('DuckingEngine requires a port');
  });

  it('throws when port is missing setVolumeLive', () => {
    expect(() => new DuckingEngine({ getVolume: jest.fn(), getUserVolume: jest.fn() }))
      .toThrow('DuckingEngine requires a port');
  });

  it('throws when port is missing getUserVolume', () => {
    expect(() => new DuckingEngine({ getVolume: jest.fn(), setVolumeLive: jest.fn() }))
      .toThrow('DuckingEngine requires a port');
  });

  it('constructs successfully with valid port', () => {
    const port = makePort();
    expect(() => new DuckingEngine(port)).not.toThrow();
  });
});

// ── loadRules ──

describe('DuckingEngine.loadRules()', () => {
  let engine;
  let port;

  beforeEach(() => {
    port = makePort();
    engine = new DuckingEngine(port);
  });

  it('loads rules and clears prior state', async () => {
    engine.loadRules(RULES_VIDEO_SOUND);
    expect(engine._rules).toHaveLength(2);
    // State should be clear
    expect(engine._instanceCounts).toEqual({});
    expect(engine._preDuckVolumes).toEqual({});
  });

  it('replaces existing rules', () => {
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);
    engine.loadRules([{ when: 'sound', duck: 'music', to: 40, fadeMs: 0 }]);
    expect(engine._rules).toHaveLength(1);
    expect(engine._rules[0].when).toBe('sound');
  });

  it('clears active state when rules reloaded mid-duck', async () => {
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);
    await engine.handleEvent('video', 'started');
    expect(engine._totalInstances('music')).toBe(1);

    engine.loadRules([]);
    expect(engine._instanceCounts).toEqual({});
    expect(engine._preDuckVolumes).toEqual({});
  });
});

// ── Basic ducking start/stop ──

describe('DuckingEngine basic start/stop', () => {
  let engine;
  let port;
  let changedEvents;

  beforeEach(() => {
    port = makePort({ liveVolume: 75 });
    engine = new DuckingEngine(port);
    changedEvents = [];
    engine.setCallbacks(
      event => changedEvents.push(event),
      null
    );
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);
  });

  it('ducks music when video starts', async () => {
    await engine.handleEvent('video', 'started');
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 20);
  });

  it('captures pre-duck volume before applying duck', async () => {
    await engine.handleEvent('video', 'started');
    expect(engine._preDuckVolumes.music).toBe(75);
    expect(port.getVolume).toHaveBeenCalledWith('music');
    // Volume set AFTER capture
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 20);
  });

  it('restores pre-duck volume when video completes (E3)', async () => {
    await engine.handleEvent('video', 'started');
    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 75);
  });

  it('emits ducking:changed on start with correct fields', async () => {
    await engine.handleEvent('video', 'started');
    expect(changedEvents).toHaveLength(1);
    expect(changedEvents[0]).toMatchObject({
      stream: 'music',
      ducked: true,
      volume: 20,
      restoredVolume: 75,
    });
  });

  it('emits ducking:changed on stop with ducked=false', async () => {
    await engine.handleEvent('video', 'started');
    changedEvents.length = 0;
    await engine.handleEvent('video', 'completed');
    expect(changedEvents).toHaveLength(1);
    expect(changedEvents[0]).toMatchObject({
      stream: 'music',
      ducked: false,
      volume: 75,
      activeSources: [],
    });
  });

  it('no-ops when no rules loaded', async () => {
    engine.loadRules([]);
    await engine.handleEvent('video', 'started');
    expect(port.setVolumeLive).not.toHaveBeenCalled();
  });

  it('no-ops when source has no matching rule', async () => {
    await engine.handleEvent('sound', 'started'); // no sound rule loaded
    expect(port.setVolumeLive).not.toHaveBeenCalled();
  });

  it('pauses restore volume and resumes duck', async () => {
    await engine.handleEvent('video', 'started');
    port.setVolumeLive.mockClear();

    await engine.handleEvent('video', 'paused');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 75); // restored

    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'resumed');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 20); // re-ducked
  });

  it('cleans up preDuckVolumes after full restore', async () => {
    await engine.handleEvent('video', 'started');
    await engine.handleEvent('video', 'completed');
    expect(engine._preDuckVolumes.music).toBeUndefined();
  });

  it('does not re-apply duck when same source started twice', async () => {
    await engine.handleEvent('video', 'started');
    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'started'); // duplicate start
    // Should be a no-op (volume already at correct level)
    expect(port.setVolumeLive).not.toHaveBeenCalled();
  });
});

// ── Multi-source ducking ──

describe('DuckingEngine multi-source', () => {
  let engine;
  let port;

  beforeEach(() => {
    port = makePort({ liveVolume: 80 });
    engine = new DuckingEngine(port);
    engine.loadRules(RULES_VIDEO_SOUND);
  });

  it('uses lowest "to" when multiple sources are active', async () => {
    await engine.handleEvent('video', 'started'); // would duck to 20
    port.setVolumeLive.mockClear();
    await engine.handleEvent('sound', 'started'); // would be 40, but 20 is lower
    const calls = port.setVolumeLive.mock.calls.filter(c => c[0] === 'music');
    // No call at 40 — 20 is already active
    for (const call of calls) {
      expect(call[1]).toBe(20);
    }
  });

  it('re-evaluates to higher level when dominant source completes', async () => {
    await engine.handleEvent('video', 'started'); // 20
    await engine.handleEvent('sound', 'started'); // stays 20
    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed'); // video done; sound at 40 remains
    await engine._opQueues.music; // wait for serialized re-evaluate
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 40);
  });

  it('restores fully only when ALL sources complete', async () => {
    await engine.handleEvent('video', 'started');
    await engine.handleEvent('sound', 'started');
    port.setVolumeLive.mockClear();

    await engine.handleEvent('sound', 'completed');
    await engine._opQueues.music;
    // Video still active — music NOT restored (should be re-evaluated to 20 if anything)
    const musicAt80 = port.setVolumeLive.mock.calls
      .filter(c => c[0] === 'music' && c[1] === 80);
    expect(musicAt80).toHaveLength(0);

    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    // Now both done — restore to 80 (pre-duck)
    await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 80);
  });
});

// ── F-SHOW-05: Empty-array guard ──

describe('F-SHOW-05: empty-array guard / hardcoded-100 removal', () => {
  let engine;
  let port;

  it('does NOT restore when activeSources array is empty (truthy-but-empty guard)', async () => {
    // Sequence that triggered the bug: video starts (duck) → video paused
    // (restore, preDuck deleted, array left []) → video completed (second stop)
    // Before fix: second stop found empty-but-truthy array, restored to 100.
    port = makePort({ liveVolume: 60, userVolume: 60 });
    engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started'); // duck
    await engine.handleEvent('video', 'paused'); // restore (first stop)
    port.setVolumeLive.mockClear();

    await engine.handleEvent('video', 'completed'); // second stop — should be no-op
    // With the fix: totalInstances is already 0, so this is skipped
    expect(port.setVolumeLive).not.toHaveBeenCalled();
  });

  it('restore falls back to getUserVolume() when pre-duck capture is missing, not 100', async () => {
    // Simulate a state where _preDuckVolumes was cleared (e.g., loadRules mid-duck)
    // but we still get a 'completed' event. Should fall back to getUserVolume, not 100.
    port = makePort({ liveVolume: 70, userVolume: 65 });
    engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    // Manually inject active state without pre-duck capture to test fallback
    await engine.handleEvent('video', 'started');
    delete engine._preDuckVolumes.music; // simulate missing capture

    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;

    // Should restore to userVolume (65), not hardcoded 100
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 65);
  });
});

// ── F-SHOW-06: Per-target op serialization ──

describe('F-SHOW-06: per-target op serialization', () => {
  it('serializes duck-apply and restore so apply always completes before restore', async () => {
    const callOrder = [];
    let resolveFirst;
    const firstCallBarrier = new Promise(r => { resolveFirst = r; });

    const port = {
      getVolume: jest.fn().mockResolvedValue(80),
      setVolumeLive: jest.fn().mockImplementation(async (stream, volume) => {
        if (callOrder.length === 0) {
          // First call (duck-apply) blocks until we release it
          await firstCallBarrier;
        }
        callOrder.push({ stream, volume });
        return volume;
      }),
      getUserVolume: jest.fn().mockReturnValue(80),
    };

    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'sound', duck: 'music', to: 40, fadeMs: 0 }]);

    // Start ducking — awaiting ensures capture + enqueue happens in order
    await engine.handleEvent('sound', 'started');

    // Immediately complete — the restore should be queued AFTER the apply
    await engine.handleEvent('sound', 'completed');

    // At this point: both ops are enqueued but first is blocked.
    // Release the first call — both should now run in order.
    resolveFirst();

    // Wait for the entire op queue to drain
    await engine._opQueues.music;

    expect(callOrder).toHaveLength(2);
    // Apply must come before restore (F-SHOW-06)
    expect(callOrder[0].volume).toBe(40); // duck-apply
    expect(callOrder[1].volume).toBe(80); // restore
  });

  it('queues multiple ops and executes them in order (apply → re-evaluate → restore)', async () => {
    // This is the classic "apply then restore without interleaving from a different target"
    const callOrder = [];
    const port = {
      getVolume: jest.fn().mockResolvedValue(80),
      setVolumeLive: jest.fn().mockImplementation(async (stream, volume) => {
        callOrder.push(volume);
        return volume;
      }),
      getUserVolume: jest.fn().mockReturnValue(80),
    };

    const engine = new DuckingEngine(port);
    engine.loadRules([
      { when: 'video', duck: 'music', to: 20, fadeMs: 0 },
      { when: 'sound', duck: 'music', to: 40, fadeMs: 0 },
    ]);

    await engine.handleEvent('video', 'started'); // apply 20
    await engine.handleEvent('sound', 'started'); // re-evaluate (still 20)
    await engine.handleEvent('video', 'completed'); // re-evaluate to 40
    await engine.handleEvent('sound', 'completed'); // restore to 80
    await engine._opQueues.music;

    // The restore (80) must come after the re-evaluate (40)
    const musicCalls = callOrder;
    const restoreIdx = musicCalls.lastIndexOf(80);
    const reevalIdx = musicCalls.lastIndexOf(40);
    expect(restoreIdx).toBeGreaterThan(reevalIdx);
  });
});

// ── F-SHOW-07: Per-instance refcount ──

describe('F-SHOW-07: per-instance refcount for same-source overlap', () => {
  let engine;
  let port;

  beforeEach(() => {
    port = makePort({ liveVolume: 75 });
    engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'sound', duck: 'music', to: 40, fadeMs: 0 }]);
  });

  it('does NOT restore when first sound ends but second sound still plays', async () => {
    // Sound A starts
    await engine.handleEvent('sound', 'started');
    // Sound B starts (same source class = 'sound')
    await engine.handleEvent('sound', 'started');
    port.setVolumeLive.mockClear();

    // Sound A completes — should NOT restore (B still playing)
    await engine.handleEvent('sound', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;

    // No restore to 75 should have happened
    const restoreCalls = port.setVolumeLive.mock.calls
      .filter(c => c[0] === 'music' && c[1] === 75);
    expect(restoreCalls).toHaveLength(0);

    // Instance count should be 1 (B still running)
    expect(engine._instanceCounts.music.sound).toBe(1);
  });

  it('restores when the last sound instance ends', async () => {
    await engine.handleEvent('sound', 'started'); // instance 1
    await engine.handleEvent('sound', 'started'); // instance 2
    port.setVolumeLive.mockClear();

    await engine.handleEvent('sound', 'completed'); // count → 1 (still ducked)
    await engine.handleEvent('sound', 'completed'); // count → 0 (last)

    // Now should restore to pre-duck volume
    if (engine._opQueues.music) await engine._opQueues.music;

    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 75);
  });

  it('tracks instance counts correctly across multiple starts/stops', async () => {
    await engine.handleEvent('sound', 'started'); // count: 1
    await engine.handleEvent('sound', 'started'); // count: 2
    await engine.handleEvent('sound', 'started'); // count: 3

    expect(engine._instanceCounts.music.sound).toBe(3);

    await engine.handleEvent('sound', 'completed'); // count: 2
    expect(engine._instanceCounts.music.sound).toBe(2);

    await engine.handleEvent('sound', 'completed'); // count: 1
    expect(engine._instanceCounts.music.sound).toBe(1);

    await engine.handleEvent('sound', 'completed'); // count: 0 → restore
    // After restore, instanceCounts[music] is deleted
    expect(engine._instanceCounts.music).toBeUndefined();
  });

  it('handles excess completed events gracefully (count does not go negative)', async () => {
    await engine.handleEvent('sound', 'started');
    await engine.handleEvent('sound', 'completed'); // count → 0, restore

    port.setVolumeLive.mockClear();
    // Spurious second completed — should be no-op (totalInstances is 0)
    await engine.handleEvent('sound', 'completed');
    expect(port.setVolumeLive).not.toHaveBeenCalled();
  });
});

// ── F-SHOW-27: Null capture fallback to persisted user volume ──

describe('F-SHOW-27: null capture falls back to persisted user volume', () => {
  it('uses getUserVolume() when live read returns null (sink-input absent)', async () => {
    const port = makePort({ liveVolume: null, userVolume: 65 });
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');

    // Pre-duck should be 65 (persisted user volume), not 100
    expect(engine._preDuckVolumes.music).toBe(65);

    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 65);
  });

  it('uses 100 as last-resort when both live read and getUserVolume are null', async () => {
    const port = makePort({ liveVolume: null, userVolume: null });
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');
    expect(engine._preDuckVolumes.music).toBe(100); // last resort

    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 100);
  });

  it('uses live read when available (not fallback)', async () => {
    const port = makePort({ liveVolume: 55, userVolume: 75 });
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');

    // Should use live read (55), not userVolume (75)
    expect(engine._preDuckVolumes.music).toBe(55);
  });
});

// ── Decision E3: refreshPreDuckCapture ──

describe('Decision E3: refreshPreDuckCapture', () => {
  it('updates pre-duck restore target when GM adjusts volume mid-duck', async () => {
    const port = makePort({ liveVolume: 70 });
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');
    expect(engine._preDuckVolumes.music).toBe(70);

    // GM adjusts volume to 50 while video is playing
    engine.refreshPreDuckCapture('music', 50);
    expect(engine._preDuckVolumes.music).toBe(50);

    // Now video completes — should restore to 50 (the refreshed value)
    port.setVolumeLive.mockClear();
    await engine.handleEvent('video', 'completed');
    if (engine._opQueues.music) await engine._opQueues.music;
    expect(port.setVolumeLive).toHaveBeenCalledWith('music', 50);
  });

  it('is a no-op when target is not currently ducked', async () => {
    const port = makePort({ liveVolume: 70 });
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    // Not ducked — refreshPreDuckCapture should do nothing
    engine.refreshPreDuckCapture('music', 50);
    expect(engine._preDuckVolumes.music).toBeUndefined();
  });
});

// ── getActiveState ──

describe('DuckingEngine.getActiveState()', () => {
  it('returns empty object when no ducking active', () => {
    const port = makePort();
    const engine = new DuckingEngine(port);
    engine.loadRules(RULES_VIDEO_SOUND);
    expect(engine.getActiveState()).toEqual({});
  });

  it('returns active sources for ducked targets', async () => {
    const port = makePort();
    const engine = new DuckingEngine(port);
    engine.loadRules(RULES_VIDEO_SOUND);
    await engine.handleEvent('video', 'started');

    const state = engine.getActiveState();
    expect(state.music).toContain('video');
  });

  it('removes target when all sources complete', async () => {
    const port = makePort();
    const engine = new DuckingEngine(port);
    engine.loadRules(RULES_VIDEO_SOUND);
    await engine.handleEvent('video', 'started');
    await engine.handleEvent('video', 'completed');

    expect(engine.getActiveState()).toEqual({});
  });
});

// ── reset ──

describe('DuckingEngine.reset()', () => {
  it('clears all state', async () => {
    const port = makePort();
    const engine = new DuckingEngine(port);
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);
    await engine.handleEvent('video', 'started');

    engine.reset();

    expect(engine._rules).toEqual([]);
    expect(engine._instanceCounts).toEqual({});
    expect(engine._preDuckVolumes).toEqual({});
    expect(engine._opQueues).toEqual({});
  });
});

// ── Error handling ──

describe('DuckingEngine error handling', () => {
  it('calls onDuckingFailed for unexpected setVolumeLive errors', async () => {
    const port = makePort();
    port.setVolumeLive.mockRejectedValue(new Error('PipeWire connection refused'));
    const engine = new DuckingEngine(port);
    const failedEvents = [];
    engine.setCallbacks(null, event => failedEvents.push(event));
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');
    // Wait for op queue to drain
    await engine._opQueues.music;

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]).toMatchObject({
      target: 'music',
      error: expect.stringContaining('PipeWire'),
    });
  });

  it('does NOT call onDuckingFailed for missing sink-input (No active sink-input)', async () => {
    const port = makePort();
    port.setVolumeLive.mockRejectedValue(new Error('No active sink-input found for stream \'music\''));
    const engine = new DuckingEngine(port);
    const failedEvents = [];
    engine.setCallbacks(null, event => failedEvents.push(event));
    engine.loadRules([{ when: 'video', duck: 'music', to: 20, fadeMs: 0 }]);

    await engine.handleEvent('video', 'started');
    await engine._opQueues.music;

    // Missing sink-input is a warn, not a failure event
    expect(failedEvents).toHaveLength(0);
  });
});
