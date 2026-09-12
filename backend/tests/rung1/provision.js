/**
 * Shared rung-1 provisioning — ONE bring-up implementation for both
 * consumers of the simulated environment:
 *
 *   - the rig (tests/rung1/up.sh, via this file's CLI mode), and
 *   - the E2E suite (tests/e2e/setup/session-env.js).
 *
 * Before this module each carried its own copy of the recipes (bus
 * config, dockerd flags, pipewire launch, HA lifecycle), aligned only
 * by comments — and this code is the floor of every future unit's
 * close gate, where drift manufactures FALSE TEST VERDICTS. Design +
 * owner rulings: docs/plans/2026-09-05-train-fix-vehicle.md §8.1.
 * Recipes measured in docs/plans/2026-09-04-rung1-capability-research.md.
 *
 * THE GATE: fake physics may be manufactured only for a run whose
 * profile assigns stand-ins to the harness (harnessProvides). A real
 * venue profile provisions nothing — that policy lives in the
 * consumers; this module supplies the gate predicate and the arms.
 *
 * Process ownership (rig convention, venue-faithful): daemons run as
 * the dedicated non-root user; root does only what root must (docker,
 * useradd, chown).
 */

const { execFileSync, spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '../..');
const RUNG1_USER = process.env.RUNG1_USER || 'rung1vlc';
const HA_IMAGE = 'ghcr.io/home-assistant/home-assistant:stable';
const HA_URL = 'http://127.0.0.1:8123';
const HA_CONTAINER = 'rung1-ha';

const note = msg => process.stderr.write(`[rung1-provision] ${msg}\n`);

const isRoot = () => typeof process.getuid === 'function' && process.getuid() === 0;

/** argv prefix that runs a command as the dedicated user when root. */
function asUserArgv(cmd, args, extraEnv = {}) {
  const envPairs = Object.entries(extraEnv).map(([k, v]) => `${k}=${v}`);
  if (isRoot()) {
    return ['runuser', ['-u', RUNG1_USER, '--', 'env', ...envPairs, cmd, ...args]];
  }
  return ['env', [...envPairs, cmd, ...args]];
}

function ensureUser() {
  if (!isRoot()) return;
  try { execFileSync('id', [RUNG1_USER], { stdio: 'pipe' }); } catch {
    try { execFileSync('useradd', ['-m', RUNG1_USER], { stdio: 'pipe' }); } catch { /* concurrent creation or uncreatable — later spawns will tell */ }
  }
}

function sleepSync(seconds) {
  execFileSync('sleep', [String(seconds)]);
}

// --------------------------------------------------------------------
// Pure decisions (unit-tested: tests/unit/rung1/provision.test.js)
// --------------------------------------------------------------------

/**
 * The provisioning gate — the ratified definition applied literally
 * (CONTEXT.md §5b: a simulation IS an ordinary profile whose bindings
 * point at software stand-ins): does this profile realize anything
 * through the harness? True when the pinned C1 §1 endpoints interior
 * (D1) carries a harness marker VALUE — `display.main.output`
 * beginning `rung1-`, or any `audio.sinks[].id` beginning `rung1_`
 * (Block 2 T1b, plan §9 ruling 2: the interior has no `provider`
 * field, so `provider: 'rung1-harness'` is schema-illegal and no
 * longer the signal) — OR a lighting role binds to a witness scene,
 * OR a surface channel binds to a `-sim.` placeholder file. (The
 * endpoint check alone was too narrow — a pack with no endpoint
 * needs, like the toy pack, generates a simulation profile with an
 * empty endpoints block.) Safe default is NO — a missing, broken, or
 * real venue profile provisions nothing.
 * @param {object} profile - parsed installation profile
 * @returns {boolean}
 */
function harnessProvides(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const { endpoints } = profile;
  if (endpoints && typeof endpoints === 'object') {
    const display = endpoints['display.main'];
    if (display && typeof display === 'object'
        && typeof display.output === 'string' && display.output.startsWith('rung1-')) {
      return true;
    }
    const sinks = endpoints['audio.sinks'];
    if (Array.isArray(sinks)
        && sinks.some(s => s && typeof s.id === 'string' && s.id.startsWith('rung1_'))) {
      return true;
    }
  }
  const { bindings } = profile;
  if (!bindings || typeof bindings !== 'object') return false;
  const { lighting } = bindings;
  if (lighting && typeof lighting === 'object'
      && Object.values(lighting).some(
        b => b && typeof b.ha === 'string' && b.ha.startsWith('scene.witness_')
      )) {
    return true;
  }
  const { surfaces } = bindings;
  if (surfaces && typeof surfaces === 'object'
      && Object.values(surfaces).some(
        b => b && typeof b.file === 'string' && b.file.includes('-sim.')
      )) {
    return true;
  }
  return false;
}

/**
 * Container lifecycle decision from `docker ps -a` output
 * (format '{{.Names}}\t{{.State}}'). Covers ALL states — the first
 * S5 build read running-only `docker ps`, so a stopped container was
 * invisible and `docker run` died on the name conflict.
 * @param {string} psAllText
 * @returns {'adopt'|'start'|'create'}
 */
function decideHaContainerAction(psAllText) {
  for (const line of String(psAllText).split('\n')) {
    const [name, state] = line.split('\t');
    if (name === HA_CONTAINER) {
      return state === 'running' ? 'adopt' : 'start';
    }
  }
  return 'create';
}

/**
 * The FULL Home Assistant decision, port ownership included. If
 * something answers on 8123 and OUR container is not the running
 * thing, it is by definition somebody else's installation — refuse.
 * (Close-review MAJOR: the first build refused foreign HAs only on
 * the create branch, so an exited rung1-ha sitting beside a real HA
 * was `docker start`ed — which cannot bind the taken port — and the
 * REAL installation was then adopted, onboarded, and driven.)
 * @param {boolean} httpUp - does anything answer on 8123?
 * @param {string} psAllText - docker ps -a output
 * @returns {'adopt'|'start'|'create'|'refuse-foreign'}
 */
function decideHaAction(httpUp, psAllText) {
  const action = decideHaContainerAction(psAllText);
  if (httpUp && action !== 'adopt') return 'refuse-foreign';
  return action;
}

/** Best-effort pid file (the exact names down.sh kills by — its own
 * header records a process-generation leak from a name mismatch). */
function writePid(pidFile, pid) {
  if (!pidFile || !pid) return;
  try { fs.writeFileSync(pidFile, `${pid}\n`); } catch { /* teardown loses this one */ }
}

/**
 * Union of several packs' needs lists, deduplicated by kind + id —
 * one witness Home Assistant serves every pack the machine tests.
 * SORTED so the union is ORDER-INDEPENDENT: it feeds the witness
 * register whose content hash decides an HA restart, and the dual-pack
 * legs pass the packs in opposite order — an insertion-ordered union
 * made the hash flip per leg and restarted the shared HA mid-run
 * (measured: the toy lighting flow read an empty scene list during
 * the restart window on both packs).
 * @param {Array<Array<object>>} needsLists
 * @returns {Array<object>}
 */
function unionNeeds(needsLists) {
  const byKey = new Map();
  for (const list of needsLists) {
    for (const need of list) {
      const key = `${need.kind}:${need.id}`;
      if (!byKey.has(key)) byKey.set(key, need);
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, need]) => need);
}

// --------------------------------------------------------------------
// Probes
// --------------------------------------------------------------------

/** Is a D-Bus bus at `address` alive (any bus type)? */
function busAlive(address) {
  try {
    execFileSync('dbus-send', [
      `--bus=${address}`, '--dest=org.freedesktop.DBus',
      '--type=method_call', '--print-reply',
      '/', 'org.freedesktop.DBus.ListNames',
    ], { timeout: 2000, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

/** Names currently registered on the bus at `address` (empty on error). */
function busNames(address) {
  try {
    return execFileSync('dbus-send', [
      `--bus=${address}`, '--dest=org.freedesktop.DBus',
      '--type=method_call', '--print-reply',
      '/', 'org.freedesktop.DBus.ListNames',
    ], { timeout: 2000, stdio: 'pipe' }).toString();
  } catch { return ''; }
}

/** Is an X display alive? */
function displayAlive(display) {
  try {
    execFileSync('xdotool', ['getdisplaygeometry'], {
      timeout: 2000,
      stdio: 'pipe',
      env: { ...process.env, DISPLAY: display },
    });
    return true;
  } catch { return false; }
}

/** Is a pulse server at `pulseServer` (or the ambient one) alive? */
function pipewireAlive(pulseServer) {
  try {
    const env = { ...process.env };
    if (pulseServer) env.PULSE_SERVER = pulseServer;
    else delete env.PULSE_SERVER;
    execFileSync('pactl', ['info'], { timeout: 3000, stdio: 'pipe', env });
    return true;
  } catch { return false; }
}

// --------------------------------------------------------------------
// Arms (each idempotent; each degrades to null + a loud note)
// --------------------------------------------------------------------

/**
 * A permissive session bus at exactly `socketPath` (the rig's verbatim
 * config: any user may own names and talk, so a root-run orchestrator
 * drives the non-root user's VLC on one bus). The caller owns the
 * ambient-first policy; this manages only its own socket.
 * @returns {string|null} bus address
 */
function ensureBus({ socketPath, type = 'session', pidFile = null }) {
  const address = `unix:path=${socketPath}`;
  if (busAlive(address)) return address;
  try {
    const dir = path.dirname(socketPath);
    fs.mkdirSync(dir, { recursive: true });
    if (isRoot()) {
      // The daemon runs as the dedicated user (rig convention) and
      // must be able to BIND in this directory — a root-owned 755 dir
      // fails silently (measured: the per-worker bus never came up).
      ensureUser();
      try { execFileSync('chown', [RUNG1_USER, dir], { stdio: 'pipe' }); } catch { /* fs perms */ }
    }
    // A dead socket FILE (daemon killed by a container restart) blocks
    // the new daemon's bind — measured: ensureBus silently failed on
    // the stale worker socket. But the first busAlive probe times out
    // at 2s, which a merely LOADED machine can exceed (close review:
    // unlinking a live socket orphans everything connected to it) — so
    // a present socket gets one generous second opinion before removal.
    if (fs.existsSync(socketPath)) {
      try {
        execFileSync('dbus-send', [
          `--bus=${address}`, '--dest=org.freedesktop.DBus',
          '--type=method_call', '--print-reply',
          '/', 'org.freedesktop.DBus.ListNames',
        ], { timeout: 8000, stdio: 'pipe' });
        return address; // alive after all — the 2s probe was just slow
      } catch { fs.rmSync(socketPath, { force: true }); }
    }
    const confPath = `${socketPath}.conf`;
    fs.writeFileSync(confPath, `<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>${type}</type>
  <listen>unix:path=${socketPath}</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow user="*"/>
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
`);
    if (isRoot()) {
      ensureUser();
      try { execFileSync('chown', [RUNG1_USER, confPath], { stdio: 'pipe' }); } catch { /* fs perms */ }
    }
    const [cmd, args] = asUserArgv('dbus-daemon', [`--config-file=${confPath}`, '--nofork']);
    const daemon = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    daemon.on('error', e => note(`dbus-daemon spawn failed: ${e.message}`));
    daemon.unref();
    writePid(pidFile, daemon.pid);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !busAlive(address)) sleepSync(0.2);
    if (busAlive(address)) {
      try { fs.chmodSync(socketPath, 0o666); } catch { /* cross-uid best effort */ }
      note(`bus up (${type}): ${address}`);
      return address;
    }
  } catch (e) {
    note(`bus setup failed (${socketPath}): ${e.message}`);
  }
  note(`bus did not come up: ${socketPath}`);
  return null;
}

/**
 * A virtual X display (shared machine-wide — X is multi-client).
 * @returns {string|null} the display
 */
function ensureXvfb({ display = ':99', pidFile = null } = {}) {
  if (displayAlive(display)) return display;
  try {
    ensureUser();
    const [cmd, args] = asUserArgv('Xvfb', [display, '-screen', '0', '1280x720x24']);
    const xvfb = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    xvfb.on('error', e => note(`Xvfb spawn failed: ${e.message}`));
    xvfb.unref();
    writePid(pidFile, xvfb.pid);
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !displayAlive(display)) sleepSync(0.2);
    if (displayAlive(display)) { note(`xvfb up: ${display}`); return display; }
  } catch (e) {
    note(`xvfb setup failed: ${e.message}`);
  }
  note(`xvfb did not come up: ${display}`);
  return null;
}

/**
 * Pipewire + wireplumber + pipewire-pulse under `xdgDir`, as the
 * dedicated user, with the rig's two null sinks (the audio arm's fake
 * physics: real routing, simulated outputs). Idempotent, including
 * the sinks.
 * @returns {string|null} PULSE_SERVER value
 */
function ensurePipewire({ xdgDir, busAddress, pidDir = null }) {
  const pulseServer = `unix:${path.join(xdgDir, 'pulse', 'native')}`;
  const daemonEnv = {
    XDG_RUNTIME_DIR: xdgDir,
    ...(busAddress ? { DBUS_SESSION_BUS_ADDRESS: busAddress } : {}),
  };
  const run = (cmd, args) => {
    const [c, a] = asUserArgv(cmd, args, daemonEnv);
    return spawnSync(c, a, { timeout: 5000, stdio: 'pipe' });
  };
  try {
    if (!pipewireAlive(pulseServer)) {
      fs.mkdirSync(xdgDir, { recursive: true });
      if (isRoot()) {
        ensureUser();
        execFileSync('chown', ['-R', RUNG1_USER, xdgDir], { stdio: 'pipe' });
        fs.chmodSync(xdgDir, 0o700);
      }
      // Pid-file names are down.sh's exact vocabulary (pwpulse, not
      // pipewire-pulse).
      const pidNames = { pipewire: 'pipewire', wireplumber: 'wireplumber', 'pipewire-pulse': 'pwpulse' };
      for (const cmd of ['pipewire', 'wireplumber', 'pipewire-pulse']) {
        const [c, a] = asUserArgv(cmd, [], daemonEnv);
        const proc = spawn(c, a, { detached: true, stdio: 'ignore' });
        proc.on('error', e => note(`${cmd} spawn failed: ${e.message}`));
        proc.unref();
        if (pidDir) writePid(path.join(pidDir, `${pidNames[cmd]}.pid`), proc.pid);
      }
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline && !pipewireAlive(pulseServer)) sleepSync(0.3);
    }
    if (pipewireAlive(pulseServer)) {
      const sinks = run('pactl', ['list', 'short', 'sinks']);
      const have = sinks.stdout ? sinks.stdout.toString() : '';
      for (const sink of ['rung1_hdmi', 'rung1_bt']) {
        if (!have.includes(sink)) {
          run('pactl', ['load-module', 'module-null-sink', `sink_name=${sink}`]);
        }
      }
      note(`pipewire up: ${pulseServer}`);
      return pulseServer;
    }
  } catch (e) {
    note(`pipewire setup failed: ${e.message}`);
  }
  note('pipewire did not come up');
  return null;
}

function dockerOk() {
  try {
    execFileSync('docker', ['info'], { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch { return false; }
}

/** dockerd with the measured container flags. @returns {boolean} */
function ensureDockerd({ logDir }) {
  if (dockerOk()) return true;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    const log = fs.openSync(path.join(logDir, 'dockerd.log'), 'a');
    const d = spawn(
      'dockerd',
      ['--iptables=false', '--bridge=none', '--storage-driver=vfs'],
      { detached: true, stdio: ['ignore', log, log] }
    );
    d.on('error', e => note(`dockerd spawn failed: ${e.message}`));
    d.unref();
    writePid(path.join(logDir, 'dockerd.pid'), d.pid);
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !dockerOk()) sleepSync(2);
  } catch (e) {
    note(`dockerd setup failed: ${e.message}`);
  }
  return dockerOk();
}

async function haHttpReady() {
  for (const p of ['/auth/providers', '/api/onboarding']) {
    try {
      const r = await fetch(`${HA_URL}${p}`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return true;
    } catch { /* keep probing */ }
  }
  return false;
}

/**
 * The witness Home Assistant: adopt it running, START it stopped,
 * create it absent — and refuse to touch an HA that is not ours (port
 * 8123 answering with no rung1-ha container = a REAL installation;
 * the lighting arm skips loudly rather than polluting the machine).
 * Credentials: a still-valid long-lived token from ha-auth.json, else
 * tests/rung1/onboard-ha.js (which mints one).
 *
 * @param {object} opts
 * @param {string} opts.rung1Dir
 * @param {boolean} [opts.restartIfRunning=false] - config changed
 * @returns {Promise<{url: string, token: string}|null>}
 */
async function ensureHA({ rung1Dir, restartIfRunning = false }) {
  const authPath = path.join(rung1Dir, 'ha-auth.json');
  try {
    const httpUp = await haHttpReady();
    if (!dockerOk() && httpUp) {
      note('HA answers on 8123 but docker is not ours to ask — a real '
        + 'installation? Refusing to adopt; lighting arm unavailable.');
      return null;
    }
    if (!dockerOk() && !ensureDockerd({ logDir: rung1Dir })) {
      note('dockerd unavailable — lighting arm skips');
      return null;
    }
    const psAll = execFileSync(
      'docker',
      ['ps', '-a', '--format', '{{.Names}}\t{{.State}}'],
      { timeout: 10000 }
    ).toString();
    const action = decideHaAction(httpUp, psAll);
    if (action === 'refuse-foreign') {
      note('HA answers on 8123 but our container is not the running '
        + 'thing — somebody else\'s installation. Refusing to touch it; '
        + 'lighting arm unavailable.');
      return null;
    }
    if (action === 'create') {
      try {
        execFileSync('docker', ['run', '-d', '--name', HA_CONTAINER,
          '--network=host', '-v', `${path.join(rung1Dir, 'ha-config')}:/config`,
          HA_IMAGE], { stdio: 'pipe', timeout: 300000 });
      } catch (e) {
        // Name conflict = another worker created it first; fall through
        // to the readiness poll. Anything else is real.
        if (!String(e.message).includes('already in use')
            && !String(e.stderr || '').includes('already in use')) throw e;
        note('rung1-ha created by a concurrent worker — waiting on it');
      }
    } else if (action === 'start') {
      execFileSync('docker', ['start', HA_CONTAINER], { stdio: 'pipe', timeout: 60000 });
      note('rung1-ha was stopped — started it (state preserved)');
    } else if (restartIfRunning) {
      execFileSync('docker', ['restart', HA_CONTAINER], { stdio: 'pipe', timeout: 120000 });
      note('rung1-ha restarted (witness config changed)');
    }
    const deadline = Date.now() + 180000;
    while (!(await haHttpReady())) {
      if (Date.now() > deadline) throw new Error('HA did not become ready');
      await new Promise(r => setTimeout(r, 3000));
    }
    // Credentials
    const tokenValid = async tok => {
      try {
        const r = await fetch(`${HA_URL}/api/`, {
          headers: { Authorization: `Bearer ${tok}` },
          signal: AbortSignal.timeout(3000),
        });
        return r.ok;
      } catch { return false; }
    };
    let token = null;
    if (fs.existsSync(authPath)) {
      try {
        const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        if (auth.long_lived_token && await tokenValid(auth.long_lived_token)) {
          token = auth.long_lived_token;
        }
      } catch { /* re-onboard below */ }
    }
    if (!token) {
      execFileSync(
        process.execPath,
        [path.join(__dirname, 'onboard-ha.js'), rung1Dir],
        { stdio: 'pipe', timeout: 90000 }
      );
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
      token = auth.long_lived_token || auth.access_token;
    }
    note('HA up (lighting arm live)');
    return { url: HA_URL, token };
  } catch (e) {
    note(`HA arm unavailable — lighting stays down: ${e.message}`);
    return null;
  }
}

/**
 * The Bluetooth arm. Ambient-first: a machine with REAL BlueZ on the
 * real system bus keeps it — no mock, nothing exported. Otherwise a
 * private permissive SYSTEM bus + python-dbusmock's bluez5 template +
 * one mock adapter, so the engine's unmodified bluetoothctl and
 * dbus-monitor work against it (measured recipe, 2026-09-04).
 *
 * @param {object} opts
 * @param {string} opts.rung1Dir
 * @returns {{mode: 'real'}|{mode: 'mock', address: string}|null}
 */
function ensureBluetoothMock({ rung1Dir }) {
  try {
    // Real BlueZ present on the ambient system bus?
    try {
      const names = execFileSync('dbus-send', [
        '--system', '--dest=org.freedesktop.DBus', '--type=method_call',
        '--print-reply', '/', 'org.freedesktop.DBus.ListNames',
      ], { timeout: 2000, stdio: 'pipe' }).toString();
      if (names.includes('org.bluez')) {
        note('real BlueZ on the ambient system bus — using it, no mock');
        return { mode: 'real' };
      }
    } catch { /* no ambient system bus — the mock's home ground */ }

    const socketPath = path.join(rung1Dir, 'system-bus.sock');
    const address = ensureBus({
      socketPath, type: 'system',
      pidFile: path.join(rung1Dir, 'system-bus.pid'),
    });
    if (!address) return null;

    if (!busNames(address).includes('org.bluez')) {
      const python = resolveDbusmockPython(rung1Dir);
      if (!python) {
        note('python-dbusmock unavailable — bluetooth arm skips '
          + '(install python3-dbusmock, or allow the venv bootstrap)');
        return null;
      }
      const mock = spawn(python, ['-m', 'dbusmock', '--system', '--template', 'bluez5'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, DBUS_SYSTEM_BUS_ADDRESS: address },
      });
      mock.on('error', e => note(`dbusmock spawn failed: ${e.message}`));
      mock.unref();
      writePid(path.join(rung1Dir, 'btmock.pid'), mock.pid);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && !busNames(address).includes('org.bluez')) {
        sleepSync(0.3);
      }
      if (!busNames(address).includes('org.bluez')) {
        note('bluez5 mock did not register — bluetooth arm skips');
        return null;
      }
    }
    // One adapter, so `bluetoothctl list` has a controller to show.
    // Checked through the REAL client (proves the whole path), added
    // idempotently, and retried briefly: the template's convenience
    // methods attach shortly AFTER the bus name appears (measured:
    // an immediate AddAdapter raced it and got UnknownMethod).
    const hasController = () => {
      const check = spawnSync('bluetoothctl', ['list'], {
        timeout: 5000,
        env: { ...process.env, DBUS_SYSTEM_BUS_ADDRESS: address },
      });
      return (check.stdout ? check.stdout.toString() : '').includes('Controller');
    };
    if (!hasController()) {
      const deadline = Date.now() + 10000;
      for (;;) {
        try {
          execFileSync('dbus-send', [
            `--bus=${address}`, '--dest=org.bluez', '--type=method_call',
            '--print-reply', '/', 'org.bluez.Mock.AddAdapter',
            'string:hci0', 'string:rung1-host',
          ], { timeout: 5000, stdio: 'pipe' });
          break;
        } catch (e) {
          // On deadline, fall through to the hasController() verdict
          // below instead of rethrowing: a racing worker's AddAdapter
          // may have landed (its second call errors "already exists"),
          // and the CLIENT check is the truth anyway (close review).
          if (Date.now() > deadline) { note(`AddAdapter gave up: ${e.message.split('\n')[0]}`); break; }
          sleepSync(0.3);
        }
      }
    }
    if (!hasController()) {
      note('bluetoothctl does not see the mock adapter — bluetooth arm skips');
      return null;
    }
    note(`bluetooth mock up: ${address} (bluetoothctl sees hci0)`);
    return { mode: 'mock', address };
  } catch (e) {
    note(`bluetooth arm failed: ${e.message}`);
    return null;
  }
}

/**
 * python with dbusmock importable: a system interpreter that already
 * has it (apt python3-dbusmock), else a bootstrapped venv.
 *
 * The venv recipe is exact (measured 2026-09-04, and the naive form
 * re-measured broken 2026-09-06): dbusmock needs the dbus C bindings,
 * which come ONLY from the distro package (apt python3-dbus) — pip
 * "installs" dbus-python but its extension doesn't import. So: the
 * venv must be built --system-site-packages on an interpreter that
 * SEES the distro bindings (`import dbus` works), and python-dbusmock
 * installs --no-deps so pip never substitutes a broken dbus-python.
 * The distro bindings track the DISTRO python (3.12 here), which is
 * not always `python3` (3.11 here) — hence the candidate walk.
 */
function resolveDbusmockPython(rung1Dir) {
  const canImport = (bin, mod = 'dbusmock') => {
    try {
      execFileSync(bin, ['-c', `import ${mod}`], { timeout: 15000, stdio: 'pipe' });
      return true;
    } catch { return false; }
  };
  const candidates = ['python3', 'python3.12', 'python3.13', 'python3.11'];
  for (const bin of candidates) {
    if (canImport(bin)) return bin;
  }
  const venvDir = path.join(rung1Dir, 'btmock-venv');
  const venvPython = path.join(venvDir, 'bin', 'python');
  if (fs.existsSync(venvPython) && canImport(venvPython)) return venvPython;
  // Build lock: at workers=3 the rebuild path rm-rf'd the SHARED venv
  // out from under a sibling mid-pip (close review). mkdir is atomic —
  // exactly one worker builds; the others wait on the finished venv.
  const lockDir = path.join(rung1Dir, 'btmock-venv.lock');
  try {
    fs.mkdirSync(lockDir);
  } catch {
    // A builder is (or was) at work. Stale locks (a killed builder)
    // age out; otherwise poll for the sibling's finished venv.
    try {
      const age = Date.now() - fs.statSync(lockDir).mtimeMs;
      if (age < 5 * 60 * 1000) {
        const deadline = Date.now() + 180000;
        while (Date.now() < deadline) {
          if (!fs.existsSync(lockDir)) break;
          sleepSync(2);
        }
        if (fs.existsSync(venvPython) && canImport(venvPython)) return venvPython;
        note('sibling venv build did not deliver — bluetooth arm skips here');
        return null;
      }
      fs.rmSync(lockDir, { recursive: true, force: true });
      fs.mkdirSync(lockDir);
    } catch { return null; }
  }
  try {
  for (const bin of candidates) {
    try { execFileSync(bin, ['--version'], { timeout: 5000, stdio: 'pipe' }); } catch { continue; }
    try {
      fs.rmSync(venvDir, { recursive: true, force: true });
      execFileSync(
        bin,
        ['-m', 'venv', '--system-site-packages', venvDir],
        { timeout: 60000, stdio: 'pipe' }
      );
      if (!canImport(venvPython, 'dbus')) continue; // distro bindings invisible to this interpreter
      execFileSync(
        path.join(venvDir, 'bin', 'pip'),
        ['install', '--quiet', '--no-deps', 'python-dbusmock'],
        { timeout: 120000, stdio: 'pipe' }
      );
      if (canImport(venvPython)) {
        note(`dbusmock venv built on ${bin}`);
        return venvPython;
      }
    } catch (e) {
      note(`dbusmock venv bootstrap on ${bin} failed: ${e.message}`);
    }
  }
  return null;
  } finally {
    try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* gone */ }
  }
}

/**
 * Regenerate the pack-derived fixtures (witness HA config from the
 * UNION of the packs, per-pack simulation profiles, media
 * placeholders) via tests/rung1/generate-fixtures.js — the one truth.
 * @returns {{ok: boolean, haConfigChanged: boolean}}
 */
function generateFixtures({ rung1Dir, packDirs }) {
  const configPath = path.join(rung1Dir, 'ha-config', 'configuration.yaml');
  const hash = () => {
    try {
      return crypto.createHash('sha1')
        .update(fs.readFileSync(configPath)).digest('hex');
    } catch { return null; }
  };
  const before = hash();
  const res = spawnSync(
    process.execPath,
    [path.join(__dirname, 'generate-fixtures.js'), rung1Dir, ...packDirs],
    { timeout: 60000, stdio: 'pipe' }
  );
  if (res.status !== 0) {
    note(`fixture generation failed: ${res.stderr}`);
    return { ok: false, haConfigChanged: false };
  }
  return { ok: true, haConfigChanged: before !== null && hash() !== before };
}

module.exports = {
  RUNG1_USER,
  HA_CONTAINER,
  harnessProvides,
  decideHaContainerAction,
  decideHaAction,
  unionNeeds,
  busAlive,
  displayAlive,
  pipewireAlive,
  ensureUser,
  ensureBus,
  ensureXvfb,
  ensurePipewire,
  ensureDockerd,
  ensureHA,
  ensureBluetoothMock,
  generateFixtures,
};

// --------------------------------------------------------------------
// CLI (the rig's entry): provision the standard arm set and print a
// JSON result for up.sh to consume. Tokens never ride stdout —
// up.sh reads ha-auth.json itself.
//   node provision.js --rung1-dir /tmp/rung1 --pack <dir> [--pack <dir>]
//     [--bus-socket /tmp/rung1/dbus.sock] [--display :99] [--no-bt]
// --------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const opt = (name, dflt) => {
      const i = argv.indexOf(`--${name}`);
      return i >= 0 ? argv[i + 1] : dflt;
    };
    const packs = [];
    argv.forEach((a, i) => { if (a === '--pack') packs.push(argv[i + 1]); });
    const rung1Dir = opt('rung1-dir', '/tmp/rung1');
    const busSocket = opt('bus-socket', path.join(rung1Dir, 'dbus.sock'));
    const display = opt('display', ':99');
    fs.mkdirSync(rung1Dir, { recursive: true });
    ensureUser();

    const fixtures = packs.length
      ? generateFixtures({ rung1Dir, packDirs: packs })
      : { ok: true, haConfigChanged: false };
    // The RIG's engine env pins the unsuffixed simulation-profile.json,
    // so ONLY this CLI (the rig's entry) maintains that compat copy —
    // the generator writing it for whichever pack came first let a toy
    // E2E leg silently repoint the rig's engine (close review, MINOR).
    if (fixtures.ok && packs.length) {
      try {
        const { packId } = JSON.parse(fs.readFileSync(
          path.join(packs[0], 'pack-manifest.json'), 'utf8'
        ));
        fs.copyFileSync(
          path.join(rung1Dir, `simulation-profile-${packId}.json`),
          path.join(rung1Dir, 'simulation-profile.json')
        );
      } catch (e) { note(`compat profile copy failed: ${e.message}`); }
    }
    const bus = ensureBus({
      socketPath: busSocket,
      pidFile: path.join(rung1Dir, 'dbus.pid'),
    });
    const xvfb = ensureXvfb({
      display, pidFile: path.join(rung1Dir, 'xvfb.pid'),
    });
    const pulse = ensurePipewire({
      xdgDir: path.join(rung1Dir, 'xdg'), busAddress: bus, pidDir: rung1Dir,
    });
    const ha = await ensureHA({
      rung1Dir, restartIfRunning: fixtures.haConfigChanged,
    });
    const bt = argv.includes('--no-bt')
      ? null : ensureBluetoothMock({ rung1Dir });

    const result = {
      fixtures: fixtures.ok,
      bus,
      display: xvfb,
      pulseServer: pulse,
      ha: ha ? { url: ha.url } : null,
      bt: bt || null,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const failed = ['fixtures', 'bus', 'display', 'pulseServer', 'ha']
      .filter(k => !result[k]);
    if (failed.length) {
      note(`arm(s) failed: ${failed.join(', ')}`);
      process.exit(1);
    }
  })().catch(e => { note(e.stack || e.message); process.exit(1); });
}
