/**
 * E2E session environment — the rung-1 conditions, self-provisioned.
 *
 * VLC (the engine's video player) needs two things this suite's hosts
 * don't always have: a D-Bus session bus to publish its MPRIS control
 * interface on, and an X display for its video output (without one,
 * every item lands `stopped` and completion events never fire — the
 * rung-1 rig's first live-flow audit finding). Root containers add a
 * third: VLC refuses to run as root, so a dedicated user must own it.
 *
 * This module provides the first two, idempotently, using the recipes
 * MEASURED in docs/plans/2026-09-04-rung1-capability-research.md and
 * implemented by backend/tests/rung1/up.sh (the bus config below is
 * that script's, verbatim in substance — permissive so a root-launched
 * orchestrator can talk to the non-root user's VLC on the same bus;
 * drift note: change either copy only with the other in view).
 * The non-root VLC spawn itself lives in vlc-service.js.
 *
 * Fix-vehicle S5 (2026-09-06, owner-ruled): before this module, the
 * suite silently reported "VLC unavailable" on any bus-less or root
 * host, which disabled every video test.
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../../../src/utils/logger');

const ENV_DIR = '/tmp/aln-e2e-env';
// The HA/pipewire arms share /tmp/rung1 with the rung-1 rig ON PURPOSE:
// one Home Assistant and one pipewire per machine (the rig's up.sh is
// idempotent against the same paths, so neither system fights the other,
// and HA's onboarded state persists across runs in rung1/ha-config).
const RUNG1_DIR = '/tmp/rung1';
const HA_URL = 'http://127.0.0.1:8123';
const VLC_USER = 'rung1vlc';
// One bus PER PLAYWRIGHT WORKER, not one shared bus. VLC's MPRIS name
// (org.mpris.MediaPlayer2.vlc) is a singleton per bus, so a shared bus
// makes every concurrently-running test file share ONE real VLC — the
// first full dual-pack run under workers=3 showed 25 files adopting one
// player and stomping each other's playback (now-showing stuck on
// "Idle Loop", compound cues never turning active). Keying the socket
// by the worker slot gives each worker its own bus + its own VLC; the
// orchestrators that worker spawns inherit the address. The slot index
// is stable and bounded (0..workers-1), so daemons are reused across
// runs instead of accumulating. Xvfb stays shared — X is multi-client.
const WORKER_SLOT = process.env.TEST_PARALLEL_INDEX || '0';
const BUS_SOCKET = path.join(ENV_DIR, `dbus-w${WORKER_SLOT}.sock`);
const E2E_DISPLAY = ':97';

/** Is a session bus at `address` alive? */
function busAlive(address) {
  try {
    execFileSync('dbus-send', [
      '--session', '--dest=org.freedesktop.DBus', '--type=method_call',
      '/', 'org.freedesktop.DBus.ListNames',
    ], {
      timeout: 2000, stdio: 'pipe',
      env: { ...process.env, DBUS_SESSION_BUS_ADDRESS: address },
    });
    return true;
  } catch {
    return false;
  }
}

/** Is an X display at `display` alive? */
function displayAlive(display) {
  try {
    execFileSync('xdotool', ['getdisplaygeometry'], {
      timeout: 2000, stdio: 'pipe',
      env: { ...process.env, DISPLAY: display },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a live session bus and X display exist, exporting
 * DBUS_SESSION_BUS_ADDRESS and DISPLAY into process.env so every
 * child (the orchestrator, VLC, dbus-send probes) inherits them.
 *
 * Never throws: on a host where an arm cannot come up, the suite
 * behaves exactly as before this module existed (VLC reports
 * unavailable and the capability gates skip loudly).
 *
 * @returns {{bus: boolean, display: boolean}} what is live afterward
 */
function ensureSessionEnv() {
  const result = { bus: false, display: false };

  // --- session bus -------------------------------------------------
  const existing = process.env.DBUS_SESSION_BUS_ADDRESS;
  if (existing && busAlive(existing)) {
    result.bus = true;
  } else {
    const address = `unix:path=${BUS_SOCKET}`;
    if (busAlive(address)) {
      process.env.DBUS_SESSION_BUS_ADDRESS = address;
      result.bus = true;
    } else {
      try {
        fs.mkdirSync(ENV_DIR, { recursive: true });
        const confPath = path.join(ENV_DIR, `dbus-e2e-w${WORKER_SLOT}.conf`);
        // The rung-1 permissive session-bus config (up.sh): any user may
        // own names and talk — that is what lets a root orchestrator
        // drive a non-root user's VLC over one bus.
        fs.writeFileSync(confPath, `<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=${BUS_SOCKET}</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow user="*"/>
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
`);
        const daemon = spawn('dbus-daemon', ['--config-file=' + confPath, '--nofork'], {
          detached: true, stdio: 'ignore',
        });
        daemon.on('error', (err) => {
          logger.warn('[e2e-env] dbus-daemon spawn failed', { error: err.message });
        });
        daemon.unref();
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && !busAlive(address)) {
          execFileSync('sleep', ['0.2']);
        }
        if (busAlive(address)) {
          try { fs.chmodSync(BUS_SOCKET, 0o666); } catch { /* cross-uid best effort */ }
          process.env.DBUS_SESSION_BUS_ADDRESS = address;
          result.bus = true;
          logger.info('[e2e-env] session bus started', { address });
        } else {
          logger.warn('[e2e-env] session bus did not come up — video tests will skip loudly');
        }
      } catch (err) {
        logger.warn('[e2e-env] session bus setup failed', { error: err.message });
      }
    }
  }

  // --- X display ---------------------------------------------------
  const curDisplay = process.env.DISPLAY;
  if (curDisplay && displayAlive(curDisplay)) {
    result.display = true;
  } else if (displayAlive(E2E_DISPLAY)) {
    process.env.DISPLAY = E2E_DISPLAY;
    result.display = true;
  } else {
    try {
      const xvfb = spawn('Xvfb', [E2E_DISPLAY, '-screen', '0', '1280x720x24'], {
        detached: true, stdio: 'ignore',
      });
      xvfb.on('error', (err) => {
        logger.warn('[e2e-env] Xvfb spawn failed', { error: err.message });
      });
      xvfb.unref();
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && !displayAlive(E2E_DISPLAY)) {
        execFileSync('sleep', ['0.2']);
      }
      if (displayAlive(E2E_DISPLAY)) {
        process.env.DISPLAY = E2E_DISPLAY;
        result.display = true;
        logger.info('[e2e-env] Xvfb started', { display: E2E_DISPLAY });
      } else {
        logger.warn('[e2e-env] Xvfb did not come up — VLC playback may not progress');
      }
    } catch (err) {
      logger.warn('[e2e-env] Xvfb setup failed', { error: err.message });
    }
  }

  return result;
}

/**
 * Seed the video files the pack's tokens name, from the committed
 * 10-second sample, when missing on disk. Mirrors the token-video
 * block of tests/rung1/generate-fixtures.js (drift note: change
 * either copy only with the other in view).
 *
 * This is what kills the vacuous-pass mechanism: video tests used to
 * pass silently whenever these files happened not to exist.
 *
 * @param {string} packDir - pack directory holding tokens.json
 * @returns {string[]} filenames seeded
 */
function seedVideoFixtures(packDir) {
  const backend = path.resolve(__dirname, '../../..');
  const sample = path.join(backend, 'tests/e2e/fixtures/test-videos/test_10sec.mp4');
  const videosDir = path.join(backend, 'public/videos');
  const seeded = [];
  try {
    const tokens = JSON.parse(fs.readFileSync(path.join(packDir, 'tokens.json'), 'utf8'));
    fs.mkdirSync(videosDir, { recursive: true });
    for (const token of Object.values(tokens)) {
      if (token && typeof token.video === 'string' && token.video.length > 0) {
        const dst = path.join(videosDir, token.video);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(sample, dst);
          seeded.push(token.video);
        }
      }
    }
    if (seeded.length > 0) {
      logger.info('[e2e-env] video fixtures seeded', { seeded });
    }
  } catch (err) {
    logger.warn('[e2e-env] video fixture seeding failed', { error: err.message });
  }
  return seeded;
}

/**
 * Ensure pipewire (with pipewire-pulse) is serving, so the engine's
 * audio routing (pactl) is REAL — the rung-1 posture. Runs the daemons
 * as the dedicated non-root user when the suite is root (up.sh recipe,
 * shared XDG_RUNTIME_DIR under /tmp/rung1 so the rig and the suite use
 * ONE pipewire); exports PULSE_SERVER so root-run orchestrators reach
 * the user-owned socket. Never throws — a host without pipewire keeps
 * today's behavior (audio reports down, gates skip loudly).
 */
function ensurePipewire() {
  const xdg = path.join(RUNG1_DIR, 'xdg');
  const pulseSock = path.join(xdg, 'pulse', 'native');
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const probeEnv = { ...process.env, PULSE_SERVER: `unix:${pulseSock}`, XDG_RUNTIME_DIR: xdg };
  const alive = () => {
    try { execFileSync('pactl', ['info'], { timeout: 3000, stdio: 'pipe', env: probeEnv }); return true; }
    catch { return false; }
  };
  try {
    if (!alive()) {
      fs.mkdirSync(xdg, { recursive: true });
      if (asRoot) {
        try { execFileSync('id', [VLC_USER], { stdio: 'pipe' }); }
        catch { try { execFileSync('useradd', ['-m', VLC_USER], { stdio: 'pipe' }); } catch { /* spawn will tell */ } }
        execFileSync('chown', ['-R', VLC_USER, xdg], { stdio: 'pipe' });
      }
      const daemonEnv = {
        ...process.env, XDG_RUNTIME_DIR: xdg,
        DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || '',
      };
      const launch = (cmd) => {
        const argv = asRoot
          ? ['runuser', ['-u', VLC_USER, '--', 'env', `XDG_RUNTIME_DIR=${xdg}`, cmd]]
          : [cmd, []];
        const proc = spawn(argv[0], argv[1], { detached: true, stdio: 'ignore', env: daemonEnv });
        proc.on('error', (e) => logger.warn(`[e2e-env] ${cmd} spawn failed`, { error: e.message }));
        proc.unref();
      };
      launch('pipewire');
      launch('wireplumber');
      launch('pipewire-pulse');
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !alive()) execFileSync('sleep', ['0.3']);
    }
    if (alive()) {
      process.env.PULSE_SERVER = `unix:${pulseSock}`;
      logger.info('[e2e-env] pipewire OK', { socket: pulseSock });
      return true;
    }
    logger.warn('[e2e-env] pipewire did not come up — audio stays down (loud skips)');
  } catch (err) {
    logger.warn('[e2e-env] pipewire setup failed', { error: err.message });
  }
  return false;
}

let _haMemo; // per-process: probe once, reuse for every orchestrator start

/**
 * Ensure Home Assistant is up and return its credentials — the rung-1
 * lighting arm (measured working in this container:
 * docs/plans/2026-09-04-rung1-capability-research.md). Reuses the rig's
 * own pieces end to end: the persisted /tmp/rung1/ha-config (witness
 * scenes generated from the pack), the rung1-ha container, and
 * tests/rung1/onboard-ha.js (now minting a long-lived token — the
 * engine's expected credential shape). Never throws: a host that cannot
 * run docker/HA returns null and lighting stays down with loud skips.
 *
 * @param {string} packDir - pack whose witness fixtures seed a FIRST
 *   bring-up (ignored when ha-config already exists)
 * @returns {Promise<{url: string, token: string}|null>}
 */
async function ensureHA(packDir) {
  if (_haMemo !== undefined) return _haMemo;
  const backend = path.resolve(__dirname, '../../..');
  const authPath = path.join(RUNG1_DIR, 'ha-auth.json');
  const ready = async () => {
    try { const r = await fetch(`${HA_URL}/auth/providers`, { signal: AbortSignal.timeout(3000) }); return r.ok; }
    catch { return false; }
  };
  const tokenValid = async (tok) => {
    try {
      const r = await fetch(`${HA_URL}/api/`, {
        headers: { Authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(3000),
      });
      return r.ok;
    } catch { return false; }
  };
  try {
    if (!(await ready())) {
      // dockerd (the measured container flags)
      try { execFileSync('docker', ['info'], { stdio: 'pipe', timeout: 5000 }); }
      catch {
        fs.mkdirSync(ENV_DIR, { recursive: true });
        const d = spawn('dockerd', ['--iptables=false', '--bridge=none', '--storage-driver=vfs'], {
          detached: true, stdio: ['ignore',
            fs.openSync(path.join(ENV_DIR, 'dockerd.log'), 'a'),
            fs.openSync(path.join(ENV_DIR, 'dockerd.log'), 'a')],
        });
        d.on('error', (e) => logger.warn('[e2e-env] dockerd spawn failed', { error: e.message }));
        d.unref();
        const dl = Date.now() + 30000;
        for (;;) {
          try { execFileSync('docker', ['info'], { stdio: 'pipe', timeout: 5000 }); break; }
          catch { if (Date.now() > dl) throw new Error('dockerd did not come up'); execFileSync('sleep', ['2']); }
        }
      }
      // first bring-up on a fresh machine: the rig's own fixture generator
      if (!fs.existsSync(path.join(RUNG1_DIR, 'ha-config', 'configuration.yaml'))) {
        execFileSync(process.execPath,
          [path.join(backend, 'tests/rung1/generate-fixtures.js'), packDir, RUNG1_DIR],
          { stdio: 'pipe', timeout: 60000 });
      }
      const names = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { timeout: 10000 }).toString();
      if (!names.split('\n').includes('rung1-ha')) {
        try { execFileSync('docker', ['rm', '-f', 'rung1-ha'], { stdio: 'pipe', timeout: 20000 }); } catch { /* absent */ }
        execFileSync('docker', ['run', '-d', '--name', 'rung1-ha', '--network=host',
          '-v', `${path.join(RUNG1_DIR, 'ha-config')}:/config`,
          'ghcr.io/home-assistant/home-assistant:stable'], { stdio: 'pipe', timeout: 300000 });
      }
      const dl = Date.now() + 180000;
      while (!(await ready())) {
        if (Date.now() > dl) throw new Error('HA did not become ready');
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    // credentials: reuse a still-valid long-lived token, else (re)onboard
    let token = null;
    if (fs.existsSync(authPath)) {
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      if (auth.long_lived_token && await tokenValid(auth.long_lived_token)) token = auth.long_lived_token;
    }
    if (!token) {
      execFileSync(process.execPath, [path.join(backend, 'tests/rung1/onboard-ha.js'), RUNG1_DIR],
        { stdio: 'pipe', timeout: 90000 });
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      token = auth.long_lived_token || auth.access_token;
    }
    _haMemo = { url: HA_URL, token };
    logger.info('[e2e-env] Home Assistant OK (lighting arm live)');
  } catch (err) {
    logger.warn('[e2e-env] HA arm unavailable — lighting stays down (loud skips)', { error: err.message });
    _haMemo = null;
  }
  return _haMemo;
}

module.exports = { ensureSessionEnv, ensurePipewire, ensureHA, seedVideoFixtures };
