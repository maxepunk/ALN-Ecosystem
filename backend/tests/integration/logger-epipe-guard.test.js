/**
 * Closed-output-pipe reproduction (P22)
 *
 * The bug, in one sentence: when the process holding the read end of an
 * orchestrator's stdout/stderr dies — a Playwright worker that crashed, a PM2
 * daemon that was killed — every Console write fails, winston's OWN
 * uncaughtException handler fans the failure back through that same closed
 * Console transport, and the orphan writes ~40 MB/s into its own combined.log
 * until the disk is gone (this container has ~7 GB free).
 *
 * This is the only file under tests/integration/ that boots a real
 * orchestrator: nothing smaller can reproduce a storm whose engine is the
 * child process's own stdio pipe. It is bounded on every axis — a 10 s window,
 * a 200 MB cap that breaks the loop, its own temp DATA_DIR/LOGS_DIR, and a
 * process GROUP kill in `finally`. The three env flags below hold off the
 * heavy services — no VLC, no MPD, no Home Assistant. They do not hold off
 * audio: `audioRoutingService.init()` still runs its machine-wide
 * `pkill -f "pactl subscribe"` and `pactl` card probing, the same as every
 * Tier L harness boot. This test is therefore no more rig-hostile than the
 * E2E suite — and no less.
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const { TEST_ENV } = require('../e2e/setup/test-server');

const BACKEND = path.resolve(__dirname, '../..');
const SERVER = path.join(BACKEND, 'src/server.js');
const MPD_PID_FILE = '/tmp/aln-pm-mpd.pid';

const WINDOW_MS = 10_000;        // how long we hold the dead pipe open
const POLL_MS = 250;             // /health poll AND log-size poll
const SIZE_CAP = 200 * 1024 * 1024;  // break the loop before it costs the disk
const GREEN_CEILING = 1024 * 1024;   // a guarded orchestrator writes ~kilobytes
const GUARD_LINE = 'console transport silenced';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** An OS-assigned free port, so parallel runs never collide. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** GET /health; resolves the status code, or null when the server is not up. */
function health(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function waitForHealthy(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await health(port) === 200) return true;
    await sleep(POLL_MS);
  }
  return false;
}

const sizeOf = (file) => { try { return fs.statSync(file).size; } catch { return 0; } };

const TAIL_BYTES = 64 * 1024;

/**
 * The last `maxBytes` of a file, without ever allocating the whole thing.
 * On a regression the file this reads is the 200 MB storm itself — reading
 * it whole would cost the Jest process that same 200 MB. The guard line (when
 * present) sits at the very start of the post-guard growth, and that growth
 * is a handful of small per-request log lines (~18 KB observed for the full
 * 10 s window), so 64 KB is generous headroom while staying bounded on a
 * regression.
 */
function readTail(file, maxBytes) {
  let size;
  try {
    size = fs.statSync(file).size;
  } catch {
    return '';
  }
  const readSize = Math.min(size, maxBytes);
  if (readSize === 0) return '';
  const buffer = Buffer.alloc(readSize);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buffer, 0, readSize, size - readSize);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString('utf8');
}

/** PIDs of every `node src/server.js` currently on the machine. */
function serverPids() {
  const out = execSync("ps -eo pid,args | grep 'src/server.js' | grep -v grep || true").toString();
  return out.trim().split('\n').filter(Boolean).map(line => line.trim().split(/\s+/)[0]);
}

/** Fingerprint of the machine-wide MPD pid file: this test must not disturb it. */
function mpdFingerprint() {
  try {
    const stat = fs.statSync(MPD_PID_FILE);
    return `${fs.readFileSync(MPD_PID_FILE, 'utf8')}@${stat.mtimeMs}`;
  } catch {
    return 'absent';
  }
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

describe('A closed output pipe never fills the disk (P22)', () => {
  it('keeps an orphaned orchestrator alive with a silenced console instead of storming its log file', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-epipe-guard-'));
    const dataDir = path.join(tmpRoot, 'data');
    const logsDir = path.join(tmpRoot, 'logs');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(logsDir, { recursive: true });
    const combinedLog = path.join(logsDir, 'combined.log');

    const port = await freePort();
    const pidsBefore = serverPids();
    const mpdBefore = mpdFingerprint();

    const child = spawn('node', [SERVER], {
      cwd: BACKEND,
      detached: true,               // own process group: one kill takes the tree
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...TEST_ENV,
        // AFTER the TEST_ENV spread: the harness pins LOG_LEVEL='warn', and at
        // warn there is no per-request logging — nothing writes, and the storm
        // this test exists to reproduce never starts.
        LOG_LEVEL: 'info',
        PORT: String(port),
        DATA_DIR: dataDir,
        LOGS_DIR: logsDir,
        // No engine services: this reproduction must never touch the rig.
        ENABLE_VIDEO_PLAYBACK: 'false',
        ENABLE_MUSIC_PLAYBACK: 'false',
        LIGHTING_ENABLED: 'false',
      },
    });

    // Drain until we cut the pipe, so the OS buffer is not what stops the writes.
    child.stdout.resume();
    child.stderr.resume();

    let peakSize = 0;
    let capTripped = false;
    let elapsedAtBreak = 0;

    try {
      const healthy = await waitForHealthy(port, 20_000);
      expect(healthy).toBe(true);

      // The worker dies: the read end of both pipes goes away.
      child.stdout.destroy();
      child.stderr.destroy();

      const start = Date.now();
      while (Date.now() - start < WINDOW_MS) {
        await health(port);        // the write trigger: request logging at info
        peakSize = sizeOf(combinedLog);
        if (peakSize > SIZE_CAP) {
          capTripped = true;
          elapsedAtBreak = Date.now() - start;
          break;
        }
        await sleep(POLL_MS);
      }
      peakSize = Math.max(peakSize, sizeOf(combinedLog));

      // Bounded read: on a regression this file is the 200 MB storm itself,
      // and the guard-line assertion needs only its tail (see readTail above).
      const logTail = readTail(combinedLog, TAIL_BYTES);
      const guardLines = logTail.split('\n').filter(line => line.includes(GUARD_LINE));

      // eslint-disable-next-line no-console
      console.log(`[epipe-guard] combined.log ${peakSize} bytes after ` +
        `${capTripped ? `${elapsedAtBreak} ms (CAP TRIPPED)` : `${WINDOW_MS} ms`}; ` +
        `guard lines: ${guardLines.length}` +
        // The line itself, so a run's output is the evidence and not a pointer
        // to a temp file this test has already deleted.
        `${guardLines.length ? `\n[epipe-guard] ${guardLines[0]}` : ''}`);

      expect(capTripped).toBe(false);
      expect(peakSize).toBeLessThan(GREEN_CEILING);
      // Exactly one: the console is proven silenced (zero would mean the pipe
      // never failed and the reproduction proved nothing), and never twice —
      // stdout and stderr both fail, the line is written write-once.
      expect(guardLines).toHaveLength(1);
      expect(guardLines[0]).toContain('console output closed (');
      // The orphan SURVIVES: under PM2 a daemon's death must not kill a show.
      expect(alive(child.pid)).toBe(true);
    } finally {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
      await sleep(500);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    // Residue: nothing of ours outlives the test, and the machine-wide MPD is untouched.
    const newServers = serverPids().filter(pid => !pidsBefore.includes(pid));
    expect(newServers).toEqual([]);
    expect(mpdFingerprint()).toBe(mpdBefore);
  }, 40_000);
});
