/**
 * One data directory and one log directory per test worker (P21)
 *
 * Three Playwright workers used to share backend/data/: worker 2's clean
 * start (clearSessionData) deleted worker 1's LIVE session file mid-flow —
 * the red leg on CI run 299. Each worker now gets
 * /tmp/aln-e2e-env/w<slot>/{data,logs}, slot = TEST_PARALLEL_INDEX (the same
 * key the worker's private session bus uses, session-env.js), and a worker
 * can only ever clear its own directory. The child's cwd stays backend/.
 *
 * The slots used here ('unit-a', 'unit-b', ...) are deliberately not shaped
 * like a Playwright slot, so this test can never clear a real worker's data.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../../e2e/setup/session-env', () => ({
  // The reason this is mocked: provisionForRun boots a session bus, an X
  // display and a witness Home Assistant. A unit test asserting on the env
  // handed to spawn must provision nothing.
  provisionForRun: jest.fn(async () => ({ profilePath: null, ha: null })),
}));
jest.mock('axios', () => ({
  create: () => ({ get: jest.fn(async () => ({ status: 200, data: { status: 'online' } })) }),
}));

const { spawn } = require('child_process');
const {
  workerEnvDirs,
  clearSessionData,
  startOrchestrator,
  stopOrchestrator,
} = require('../../e2e/setup/test-server');

/** A stand-in for the spawned orchestrator: exits when it is killed. */
function fakeChild() {
  const child = new EventEmitter();
  child.pid = 424242;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => { setImmediate(() => child.emit('exit', 0, 'SIGTERM')); return true; });
  return child;
}

const seed = (dir) => {
  fs.mkdirSync(path.join(dir, 'aln-mpd-playlists'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.json'), '{"live":true}');
  fs.writeFileSync(path.join(dir, 'scores.json'), '[]');
  fs.writeFileSync(path.join(dir, 'aln-mpd-playlists', 'set.m3u'), 'x');
};
const filesIn = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .filter(e => e.isFile()).map(e => e.name).sort();

describe('Per-worker data and log directories (P21)', () => {
  const envKeys = ['TEST_PARALLEL_INDEX', 'STORAGE_TYPE', 'ORCHESTRATOR_URL'];
  const usedSlots = new Set();
  let savedEnv;

  /** Point this process at slot `slot` and remember it for cleanup. */
  const useSlot = (slot) => {
    process.env.TEST_PARALLEL_INDEX = slot;
    usedSlots.add(slot);
    return workerEnvDirs();
  };

  beforeEach(() => {
    savedEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  afterAll(() => {
    for (const slot of usedSlots) {
      fs.rmSync(path.join('/tmp/aln-e2e-env', `w${slot}`), { recursive: true, force: true });
    }
  });

  describe('workerEnvDirs', () => {
    it('keys both directories on the worker slot, and defaults to slot 0', () => {
      delete process.env.TEST_PARALLEL_INDEX;
      expect(workerEnvDirs()).toEqual({
        dataDir: '/tmp/aln-e2e-env/w0/data',
        logsDir: '/tmp/aln-e2e-env/w0/logs',
      });

      process.env.TEST_PARALLEL_INDEX = '2';
      expect(workerEnvDirs()).toEqual({
        dataDir: '/tmp/aln-e2e-env/w2/data',
        logsDir: '/tmp/aln-e2e-env/w2/logs',
      });
    });

    it('is stable across restarts within one worker', () => {
      process.env.TEST_PARALLEL_INDEX = '1';
      expect(workerEnvDirs()).toEqual(workerEnvDirs());
    });
  });

  describe('clearSessionData', () => {
    it('clears this worker\'s data directory and leaves every other worker alone', async () => {
      const theirs = useSlot('unit-b').dataDir;   // the neighbour, seeded first
      const mine = useSlot('unit-a').dataDir;     // and now WE are worker unit-a
      seed(theirs);
      seed(mine);

      await clearSessionData();

      expect(filesIn(mine)).toEqual([]);
      expect(filesIn(theirs)).toEqual(['scores.json', 'session.json']);
      // Subdirectories are not session state (MPD owns aln-mpd-playlists/).
      expect(fs.existsSync(path.join(mine, 'aln-mpd-playlists', 'set.m3u'))).toBe(true);
    });

    it('clears files even under STORAGE_TYPE=memory (the memory branch is gone)', async () => {
      // The deleted branch reset a persistenceService singleton in the HARNESS
      // process, which no spawned orchestrator ever read. The respawn is the
      // isolation for in-process state; this function only owns the files.
      process.env.STORAGE_TYPE = 'memory';
      const mine = useSlot('unit-c').dataDir;
      seed(mine);

      await clearSessionData();

      expect(filesIn(mine)).toEqual([]);
    });

    it('is a no-op when the worker directory does not exist yet', async () => {
      const { dataDir } = useSlot('unit-missing');
      expect(fs.existsSync(dataDir)).toBe(false);

      await expect(clearSessionData()).resolves.toBeUndefined();
    });
  });

  describe('the spawned orchestrator', () => {
    afterEach(async () => {
      await stopOrchestrator();
    });

    it('carries both directories under this worker\'s slot, with cwd still backend/', async () => {
      useSlot('unit-spawn');
      spawn.mockImplementation(() => fakeChild());

      await startOrchestrator({ https: false, port: 34599, storageType: 'memory' });

      expect(spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = spawn.mock.calls[0];
      expect(command).toBe('node');
      expect(args[0]).toMatch(/src\/server\.js$/);
      expect(options.env.DATA_DIR).toBe('/tmp/aln-e2e-env/wunit-spawn/data');
      expect(options.env.LOGS_DIR).toBe('/tmp/aln-e2e-env/wunit-spawn/logs');
      expect(path.resolve(options.cwd)).toBe(path.resolve(__dirname, '../../..'));
      // Both directories exist before the child needs them.
      expect(fs.existsSync('/tmp/aln-e2e-env/wunit-spawn/data')).toBe(true);
      expect(fs.existsSync('/tmp/aln-e2e-env/wunit-spawn/logs')).toBe(true);
    });
  });
});
