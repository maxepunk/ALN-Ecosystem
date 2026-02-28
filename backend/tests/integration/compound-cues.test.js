/**
 * Compound Cue Integration Tests (Phase 2)
 *
 * Tests compound cue lifecycle:
 * - Timeline execution (fire → entries dispatched at correct times)
 * - Video conflict detection (conflict emitted, cue NOT started)
 * - Conflict resolution: Override (stop video, start cue) & Cancel (discard)
 * - Auto-cancel timer cleanup
 * - Cascading stop (parent → children)
 * - Pause/Resume state transitions
 * - Cycle detection (A → B → A)
 * - Max nesting depth enforcement
 *
 * Follows audio-routing-phase3.test.js pattern:
 * - jest.mock commandExecutor at module level
 * - Direct cueEngineService manipulation (no WebSocket server)
 * - jest.fn() for external calls, EventEmitter.on() for event assertions
 */

'use strict';

// --- Module-level mocks (must precede requires) ---

const mockExecuteCommand = jest.fn().mockResolvedValue({ success: true, broadcasts: [] });
jest.mock('../../src/services/commandExecutor', () => ({
    executeCommand: (...args) => mockExecuteCommand(...args),
    SERVICE_DEPENDENCIES: {
        'video:play': 'vlc',
        'video:pause': 'vlc',
        'video:stop': 'vlc',
        'video:skip': 'vlc',
        'video:queue:add': 'vlc',
        'spotify:play': 'spotify',
        'spotify:pause': 'spotify',
        'spotify:stop': 'spotify',
        'sound:play': 'sound',
        'sound:stop': 'sound',
        'lighting:scene:activate': 'lighting',
        'lighting:scenes:refresh': 'lighting',
        'audio:route:set': 'audio',
        'audio:volume:set': 'audio',
    },
}));

const mockIsPlaying = jest.fn().mockReturnValue(false);
const mockSkipCurrent = jest.fn().mockResolvedValue();
const mockGetCurrentVideo = jest.fn().mockReturnValue(null);
jest.mock('../../src/services/videoQueueService', () => ({
    isPlaying: (...args) => mockIsPlaying(...args),
    skipCurrent: (...args) => mockSkipCurrent(...args),
    getCurrentVideo: (...args) => mockGetCurrentVideo(...args),
}));

const mockGetElapsed = jest.fn().mockReturnValue(0);
jest.mock('../../src/services/gameClockService', () => ({
    getElapsed: (...args) => mockGetElapsed(...args),
}));

// --- Requires ---

const cueEngineService = require('../../src/services/cueEngineService');

// --- Test fixtures ---

/**
 * @returns {Object} A minimal compound cue definition with a timeline
 */
function makeCompoundCue(id, timeline, overrides = {}) {
    return {
        id,
        label: overrides.label || id,
        timeline,
        ...overrides,
    };
}

/**
 * @returns {Object} A simple (commands-only) cue definition
 */
function makeSimpleCue(id, commands, overrides = {}) {
    return {
        id,
        label: overrides.label || id,
        commands,
        ...overrides,
    };
}

// --- Test suites ---

const registry = require('../../src/services/serviceHealthRegistry');

describe('Compound Cue Integration (Phase 2)', () => {
    beforeEach(() => {
        // Reset cue engine state
        cueEngineService._reset();

        // Reset all mocks
        mockExecuteCommand.mockClear();
        mockIsPlaying.mockReturnValue(false);
        mockSkipCurrent.mockClear();
        mockGetCurrentVideo.mockReturnValue(null);
        mockGetElapsed.mockReturnValue(0);

        // Set all services healthy (Phase 3: fireCue checks service health)
        for (const svc of ['sound', 'lighting', 'vlc', 'spotify', 'bluetooth', 'audio']) {
            registry.report(svc, 'healthy', 'test default');
        }

        // Use fake timers for auto-cancel tests
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        cueEngineService.removeAllListeners();
    });

    // ============================================================
    // 1. Timeline Execution
    // ============================================================

    describe('Timeline Execution', () => {
        it('should fire at:0 entries immediately on fireCue', async () => {
            const cue = makeCompoundCue('tension-hit', [
                { at: 0, action: 'sound:play', payload: { file: 'tension.wav' } },
                { at: 0, action: 'lighting:scene', payload: { scene: 'red-alert' } },
                { at: 5, action: 'sound:play', payload: { file: 'resolve.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('tension-hit', 'test');

            // Only at:0 entries should fire immediately
            expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
            expect(mockExecuteCommand).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'sound:play', payload: { file: 'tension.wav' } })
            );
            expect(mockExecuteCommand).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'lighting:scene', payload: { scene: 'red-alert' } })
            );
        });

        it('should register compound cue as active after fire', async () => {
            const cue = makeCompoundCue('bg-music', [
                { at: 0, action: 'spotify:play', payload: {} },
                { at: 30, action: 'sound:play', payload: { file: 'sting.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('bg-music', 'test');

            const activeCues = cueEngineService.getActiveCues();
            expect(activeCues).toHaveLength(1);
            expect(activeCues[0]).toMatchObject({
                cueId: 'bg-music',
                state: 'running',
            });
        });

        it('should emit cue:fired and cue:started events', async () => {
            const events = [];
            cueEngineService.on('cue:fired', (p) => events.push({ event: 'fired', ...p }));
            cueEngineService.on('cue:started', (p) => events.push({ event: 'started', ...p }));

            const cue = makeCompoundCue('test-cue', [
                { at: 0, action: 'sound:play', payload: { file: 'x.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('test-cue', 'manual');

            expect(events).toEqual(expect.arrayContaining([
                expect.objectContaining({ event: 'fired', cueId: 'test-cue' }),
                expect.objectContaining({ event: 'started', cueId: 'test-cue' }),
            ]));
        });
    });

    // ============================================================
    // 2. Video Conflict Detection (unified held system)
    // ============================================================

    describe('Video Conflict Detection (held system)', () => {
        it('should emit cue:held with reason video_busy when video is already playing', async () => {
            mockIsPlaying.mockReturnValue(true);
            mockGetCurrentVideo.mockReturnValue('drm007.mp4');

            const events = [];
            cueEngineService.on('cue:held', (p) => events.push(p));

            const cue = makeCompoundCue('video-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('video-cue', 'test');

            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                type: 'cue',
                cueId: 'video-cue',
                reason: 'video_busy',
                currentVideo: 'drm007.mp4',
                status: 'held',
            });
        });

        it('should NOT register cue as active during video conflict', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('video-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('video-cue', 'test');

            expect(cueEngineService.getActiveCues()).toHaveLength(0);
        });

        it('should store video conflict in getHeldCues()', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('video-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('video-cue', 'test');

            const held = cueEngineService.getHeldCues();
            expect(held).toHaveLength(1);
            expect(held[0].cueId).toBe('video-cue');
            expect(held[0].reason).toBe('video_busy');
        });

        it('should NOT detect conflict for cues without video entries', async () => {
            mockIsPlaying.mockReturnValue(true);

            const events = [];
            cueEngineService.on('cue:held', (p) => events.push(p));

            const cue = makeCompoundCue('sound-only', [
                { at: 0, action: 'sound:play', payload: { file: 'beep.wav' } },
                { at: 10, action: 'sound:play', payload: { file: 'delayed.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('sound-only', 'test');

            expect(events).toHaveLength(0);
            expect(cueEngineService.getActiveCues()).toHaveLength(1);
        });
    });

    // ============================================================
    // 3. Held Cue Release (replaces Override)
    // ============================================================

    describe('Held Cue Release (video_busy)', () => {
        it('should skip current video and start the cue on releaseCue', async () => {
            mockIsPlaying.mockReturnValue(true);
            mockGetCurrentVideo.mockReturnValue('drm007.mp4');

            const cue = makeCompoundCue('override-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
                { at: 30, action: 'sound:play', payload: { file: 'end.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('override-cue', 'test');

            const held = cueEngineService.getHeldCues();
            expect(held).toHaveLength(1);

            mockIsPlaying.mockReturnValue(false);
            await cueEngineService.releaseCue(held[0].id);

            expect(mockSkipCurrent).toHaveBeenCalledTimes(1);

            const activeCues = cueEngineService.getActiveCues();
            expect(activeCues).toHaveLength(1);
            expect(activeCues[0].cueId).toBe('override-cue');
        });

        it('should clear held cues and conflict timers after release', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('override-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('override-cue', 'test');

            const heldId = cueEngineService.getHeldCues()[0].id;

            mockIsPlaying.mockReturnValue(false);
            await cueEngineService.releaseCue(heldId);

            expect(cueEngineService.getHeldCues()).toHaveLength(0);
            expect(cueEngineService.conflictTimers.has('override-cue')).toBe(false);
        });

        it('should fire at:0 entries when release starts the cue', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('override-entries', [
                { at: 0, action: 'sound:play', payload: { file: 'hit.wav' } },
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('override-entries', 'test');

            const heldId = cueEngineService.getHeldCues()[0].id;

            mockExecuteCommand.mockClear();
            mockIsPlaying.mockReturnValue(false);

            await cueEngineService.releaseCue(heldId);

            expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
        });
    });

    // ============================================================
    // 4. Held Cue Discard (replaces Cancel)
    // ============================================================

    describe('Held Cue Discard (video_busy)', () => {
        it('should NOT start the cue on discardCue', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('cancel-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('cancel-cue', 'test');

            const heldId = cueEngineService.getHeldCues()[0].id;
            cueEngineService.discardCue(heldId);

            expect(cueEngineService.getActiveCues()).toHaveLength(0);
            expect(mockSkipCurrent).not.toHaveBeenCalled();
        });

        it('should clean up held cues and conflict timers on discard', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('cancel-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('cancel-cue', 'test');

            const heldId = cueEngineService.getHeldCues()[0].id;
            cueEngineService.discardCue(heldId);

            expect(cueEngineService.getHeldCues()).toHaveLength(0);
        });

        it('should throw when discarding non-existent held cue', () => {
            expect(() => cueEngineService.discardCue('held-cue-999')).toThrow(/not found/i);
        });
    });

    // ============================================================
    // 5. Video Conflict Auto-Discard Timer
    // ============================================================

    describe('Video Conflict Auto-Discard Timer', () => {
        it('should auto-discard held cue after 10 seconds', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('auto-cancel-cue', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('auto-cancel-cue', 'test');

            expect(cueEngineService.getHeldCues()).toHaveLength(1);
            expect(cueEngineService.conflictTimers.has('auto-cancel-cue')).toBe(true);

            jest.advanceTimersByTime(10001);

            expect(cueEngineService.getHeldCues()).toHaveLength(0);
            expect(cueEngineService.conflictTimers.has('auto-cancel-cue')).toBe(false);
        });

        it('should NOT auto-discard if released before timer expires', async () => {
            mockIsPlaying.mockReturnValue(true);

            const cue = makeCompoundCue('resolved-early', [
                { at: 0, action: 'video:play', payload: { filename: 'jaw001.mp4' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('resolved-early', 'test');

            const heldId = cueEngineService.getHeldCues()[0].id;
            cueEngineService.discardCue(heldId);

            // Advance timers — should not throw
            jest.advanceTimersByTime(10001);

            expect(cueEngineService.getHeldCues()).toHaveLength(0);
        });
    });

    // ============================================================
    // 6. Cascading Stop
    // ============================================================

    describe('Cascading Stop', () => {
        it('should stop parent and all child cues', async () => {
            // Parent cue fires a child cue at t=0, both have delayed entries to stay active
            const parent = makeCompoundCue('parent', [
                { at: 0, action: 'cue:fire', payload: { cueId: 'child' } },
                { at: 60, action: 'sound:play', payload: { file: 'parent-end.wav' } },
            ]);
            const child = makeCompoundCue('child', [
                { at: 0, action: 'sound:play', payload: { file: 'child.wav' } },
                { at: 30, action: 'sound:play', payload: { file: 'delayed.wav' } },
            ]);

            cueEngineService.loadCues([parent, child]);

            // Mock cue:fire to actually fire the child cue (simulate commandExecutor)
            mockExecuteCommand.mockImplementation(async (cmd) => {
                if (cmd.action === 'cue:fire' && cmd.payload?.cueId === 'child') {
                    await cueEngineService.fireCue('child', 'cue:parent', new Set(['parent']));
                }
                return { success: true, broadcasts: [] };
            });

            await cueEngineService.fireCue('parent', 'test');

            // Both should be active
            expect(cueEngineService.getActiveCues()).toHaveLength(2);

            const events = [];
            cueEngineService.on('cue:status', (p) => events.push(p));

            await cueEngineService.stopCue('parent');

            expect(cueEngineService.getActiveCues()).toHaveLength(0);

            // Both should emit stopped events
            const stoppedEvents = events.filter(e => e.state === 'stopped');
            expect(stoppedEvents).toHaveLength(2);
            expect(stoppedEvents.map(e => e.cueId)).toEqual(
                expect.arrayContaining(['parent', 'child'])
            );
        });
    });

    // ============================================================
    // 7. Pause / Resume
    // ============================================================

    describe('Pause / Resume', () => {
        it('should pause a running cue and emit paused status', async () => {
            const cue = makeCompoundCue('pausable', [
                { at: 0, action: 'sound:play', payload: { file: 'x.wav' } },
                { at: 30, action: 'sound:play', payload: { file: 'y.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('pausable', 'test');

            const events = [];
            cueEngineService.on('cue:status', (p) => events.push(p));

            await cueEngineService.pauseCue('pausable');

            expect(events).toContainEqual({ cueId: 'pausable', state: 'paused' });

            const activeCues = cueEngineService.getActiveCues();
            expect(activeCues[0].state).toBe('paused');
        });

        it('should resume a paused cue and emit running status', async () => {
            const cue = makeCompoundCue('resumable', [
                { at: 0, action: 'sound:play', payload: { file: 'x.wav' } },
                { at: 30, action: 'sound:play', payload: { file: 'y.wav' } },
            ]);

            cueEngineService.loadCues([cue]);
            await cueEngineService.fireCue('resumable', 'test');
            await cueEngineService.pauseCue('resumable');

            const events = [];
            cueEngineService.on('cue:status', (p) => events.push(p));

            await cueEngineService.resumeCue('resumable');

            expect(events).toContainEqual({ cueId: 'resumable', state: 'running' });
        });

        it('should ignore pauseCue on a non-running cue', async () => {
            const events = [];
            cueEngineService.on('cue:status', (p) => events.push(p));

            await cueEngineService.pauseCue('nonexistent');

            expect(events).toHaveLength(0);
        });

        it('should ignore resumeCue on a non-paused cue', async () => {
            const events = [];
            cueEngineService.on('cue:status', (p) => events.push(p));

            await cueEngineService.resumeCue('nonexistent');

            expect(events).toHaveLength(0);
        });
    });

    // ============================================================
    // 8. Cycle Detection
    // ============================================================

    describe('Cycle Detection', () => {
        it('should emit cue:error when a cue cycle is detected', async () => {
            // Cue A fires Cue B at t=0, Cue B fires Cue A at t=0 → cycle
            const cueA = makeCompoundCue('cue-a', [
                { at: 0, action: 'cue:fire', payload: { cueId: 'cue-b' } },
            ]);
            const cueB = makeCompoundCue('cue-b', [
                { at: 0, action: 'cue:fire', payload: { cueId: 'cue-a' } },
            ]);

            cueEngineService.loadCues([cueA, cueB]);

            // Wire up mock to simulate nested cue firing
            mockExecuteCommand.mockImplementation(async (cmd) => {
                if (cmd.action === 'cue:fire' && cmd.payload?.cueId === 'cue-b') {
                    await cueEngineService.fireCue('cue-b', 'cue:cue-a', new Set(['cue-a']));
                } else if (cmd.action === 'cue:fire' && cmd.payload?.cueId === 'cue-a') {
                    // This would create a cycle — cue-a is already in parent chain
                    const chain = new Set(['cue-a', 'cue-b']);
                    await cueEngineService.fireCue('cue-a', 'cue:cue-b', chain);
                }
                return { success: true, broadcasts: [] };
            });

            const errors = [];
            cueEngineService.on('cue:error', (p) => errors.push(p));

            await cueEngineService.fireCue('cue-a', 'test');

            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
                cueId: 'cue-a',
                error: expect.stringContaining('Cycle detected'),
            });
        });
    });

    // ============================================================
    // 9. Max Nesting Depth
    // ============================================================

    describe('Max Nesting Depth', () => {
        it('should emit cue:error when nesting exceeds MAX_NESTING_DEPTH (5)', async () => {
            // Create a chain of 6 cues: depth-0 → depth-1 → ... → depth-5
            const cues = [];
            for (let i = 0; i < 6; i++) {
                const next = i < 5 ? `depth-${i + 1}` : null;
                const timeline = next
                    ? [{ at: 0, action: 'cue:fire', payload: { cueId: next } }]
                    : [{ at: 0, action: 'sound:play', payload: { file: 'end.wav' } }];
                cues.push(makeCompoundCue(`depth-${i}`, timeline));
            }

            cueEngineService.loadCues(cues);

            // Wire mock to cascade fireCue calls with proper parent chains
            mockExecuteCommand.mockImplementation(async (cmd) => {
                if (cmd.action === 'cue:fire' && cmd.payload?.cueId) {
                    const target = cmd.payload.cueId;
                    const depthNum = parseInt(target.split('-')[1]);
                    // Build parent chain from depth-0 up to current depth
                    const chain = new Set();
                    for (let j = 0; j < depthNum; j++) {
                        chain.add(`depth-${j}`);
                    }
                    await cueEngineService.fireCue(target, `cue:depth-${depthNum - 1}`, chain);
                }
                return { success: true, broadcasts: [] };
            });

            const errors = [];
            cueEngineService.on('cue:error', (p) => errors.push(p));

            await cueEngineService.fireCue('depth-0', 'test');

            // depth-5 should be rejected (chain has 5 entries: depth-0..depth-4)
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
                cueId: 'depth-5',
                error: expect.stringContaining('Max nesting depth'),
            });

            // Only depth-0 through depth-4 should be active (5 cues)
            expect(cueEngineService.getActiveCues().length).toBeLessThanOrEqual(5);
        });
    });
});
