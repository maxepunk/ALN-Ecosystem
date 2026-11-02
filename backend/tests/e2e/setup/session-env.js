/**
 * E2E environment policy — the THIN layer over the shared rung-1
 * provisioning module (tests/rung1/provision.js; design + owner
 * rulings: docs/plans/2026-09-05-train-fix-vehicle.md §8.1).
 *
 * The module owns the mechanisms (bus, display, pipewire, Home
 * Assistant, Bluetooth mock, fixture generation). This file owns the
 * E2E POLICY:
 *
 * - Ambient-first for PHYSICS and the DISPLAY: live pipewire, real
 *   BlueZ, and a live X display are used, never replaced; only what
 *   is genuinely absent is provisioned. The message BUS is exempt —
 *   it is plumbing, not physics (below).
 * - One PRIVATE bus PER PLAYWRIGHT WORKER, worker 0 included: VLC's
 *   MPRIS name is a singleton per bus, so a shared bus made every
 *   concurrently-running test file share ONE real VLC (measured: 25
 *   files adopting one player) — and adopting a machine's AMBIENT bus
 *   risks driving a real player that owns the name there (a dev
 *   laptop's own VLC, a Pi's production one). The socket is keyed by
 *   the worker slot; Xvfb stays shared — X is multi-client.
 * - THE GATE: fake physics — daemons (pipewire, the Bluetooth mock) and
 *   the witness HA CONTAINER — are manufactured only for a run whose
 *   profile assigns stand-ins to the harness. A run pinned to a real
 *   venue profile provisions nothing there, so a venue machine cannot
 *   be polluted by construction. When no profile is pinned, the run
 *   gets the generated per-pack SIMULATION profile — the suite's
 *   identity is rung-1 tooling (machine verification is the
 *   preflight's job, not Playwright's), and the engine must boot with
 *   the SAME profile the harness provisions against (the old
 *   aln-full-kit default bound lighting roles to real venue scenes the
 *   witness HA does not serve, silently blocking the compound cue's
 *   active path).
 * - Fixture GENERATION is not behind the gate (Block 2 T1b ruling 10):
 *   the witness HA register (`/tmp/rung1/ha-config/configuration.yaml`)
 *   and the per-pack simulation profiles are PACK CONTENT — plain file
 *   writes, no daemon or Docker side effect — so `generateFixtures()`
 *   runs on EVERY provisioning pass regardless of an explicit profile
 *   pin. An explicit pin only replaces the GENERATED PROFILE PATH the
 *   engine boots with; the register still has to exist for whichever
 *   witness HA that pinned run's flows talk to (a pinned-but-still-
 *   simulated profile, like the dormant-lighting fixtures, gates true
 *   below and needs its bound witness scenes to actually exist).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../../src/utils/logger');
const provision = require('../../rung1/provision');

const BACKEND = path.resolve(__dirname, '../../..');
const RUNG1_DIR = '/tmp/rung1';
// Every pack the machine's ONE witness Home Assistant must serve —
// the union register covers all of them (dual-pack legs share the HA).
const KNOWN_PACK_DIRS = [
  path.resolve(BACKEND, '../ALN-TokenData'),
  path.resolve(BACKEND, 'tests/e2e/fixtures/packs/toy-heist'),
];
const WORKER_SLOT = process.env.TEST_PARALLEL_INDEX || '0';
const WORKER_BUS_SOCKET = path.join('/tmp/aln-e2e-env', `dbus-w${WORKER_SLOT}.sock`);
const E2E_DISPLAY = ':99'; // converged with the rig — X is multi-client

/**
 * A live session bus and X display, exported into process.env so every
 * child (the orchestrator, VLC, dbus-send probes) inherits them.
 * Ambient-first; never throws — a host where an arm cannot come up
 * behaves as before this module existed (VLC reports unavailable and
 * the capability gates skip loudly).
 *
 * @returns {{bus: boolean, display: boolean}} what is live afterward
 */
function ensureSessionEnv() {
  const result = { bus: false, display: false };

  // EVERY worker — worker 0 included — gets its own private bus
  // (owner-examined 2026-09-06). Ambient-first is the doctrine for
  // fake PHYSICS behind the profile gate; a message bus is plumbing,
  // and a private one manufactures nothing observable. Adopting the
  // machine's real bus was the residual hazard: on a dev laptop the
  // ambient MPRIS name can be the developer's OWN media player, on a
  // Pi the production one — the suite would adopt and drive it. A
  // private bus per worker also keeps one code path on every host and
  // makes the parallel-worker isolation unconditional (the audit found
  // the earlier ambient branch bypassed it silently).
  const address = provision.ensureBus({ socketPath: WORKER_BUS_SOCKET });
  if (address) {
    process.env.DBUS_SESSION_BUS_ADDRESS = address;
    result.bus = true;
    logger.info('[e2e-env] worker bus active', { worker: WORKER_SLOT, address });
  } else {
    // The worker bus failing must NOT silently fall back to whatever
    // ambient bus the host exported (close review MAJOR: that re-opens
    // the exact real-player hazard the private bus exists to prevent).
    // No bus at all = VLC reports unavailable = loud capability skips.
    delete process.env.DBUS_SESSION_BUS_ADDRESS;
    logger.warn('[e2e-env] worker bus failed — running BUS-LESS on '
      + 'purpose (no ambient fallback); video tests will skip loudly');
  }

  const curDisplay = process.env.DISPLAY;
  if (curDisplay && provision.displayAlive(curDisplay)) {
    result.display = true;
  } else {
    const display = provision.ensureXvfb({ display: E2E_DISPLAY });
    if (display) {
      process.env.DISPLAY = display;
      result.display = true;
    } else {
      logger.warn('[e2e-env] no X display — VLC playback may not progress');
    }
  }

  return result;
}

// Per-process memo: one provisioning pass per (pack, pinned-profile)
// pair — every orchestrator start in a worker reuses it (the arms are
// idempotent anyway; this saves the repeated probing). SUCCESSES are
// cached for the process; FAILURES only briefly (close review MAJOR:
// one transient fixture-generation timeout used to be cached forever,
// silently reverting every later flow in the run to the engine's
// default venue profile with no arm provisioned and one warn line).
const _runMemo = new Map();
const FAILURE_RETRY_MS = 60000;
const isFailureResult = (r) => (!r.profilePath && !r.explicitPin) || (r.provisioned && !r.ha);

/**
 * Provision the environment for ONE run posture and resolve the
 * profile its orchestrator must boot with.
 *
 * @param {object} opts
 * @param {string|null} [opts.packPath] - backend-relative pack pin
 * @param {string|null} [opts.profilePath] - explicit profile pin
 *   (caller wins; passed through UNCHANGED so existing pins keep
 *   their semantics). Absent → the generated simulation profile.
 * @returns {Promise<{profilePath: string|null, ha: {url:string,token:string}|null, provisioned: boolean}>}
 */
async function provisionForRun({ packPath = null, profilePath = null } = {}) {
  const packDirAbs = packPath
    ? path.resolve(BACKEND, packPath)
    : KNOWN_PACK_DIRS[0];
  const explicit = profilePath || process.env.E2E_PROFILE_PATH || null;
  const memoKey = `${packDirAbs}|${explicit || 'auto'}`;
  const cached = _runMemo.get(memoKey);
  if (cached) {
    if (!isFailureResult(cached.result)
        || Date.now() - cached.at < FAILURE_RETRY_MS) {
      return cached.result;
    }
    _runMemo.delete(memoKey);
    logger.warn('[e2e-env] cached provisioning FAILURE aged out — retrying', { memoKey });
  }

  ensureSessionEnv();

  let resolvedProfilePath = explicit;
  let haConfigChanged = false;
  try {
    // Block 2 T1b ruling 10: the witness register is PACK CONTENT —
    // generated from the pack's lighting roles (generateFixtures is its
    // SOLE writer under tests/e2e) — so it must exist for every run,
    // pinned profile or not. Generate fixtures for the run's pack plus
    // every known pack unconditionally (one witness register serving
    // all legs, per-pack profiles); an explicit profile pin only
    // replaces the GENERATED PROFILE PATH this run boots with.
    const packDirs = [...new Set([packDirAbs, ...KNOWN_PACK_DIRS])];
    const gen = provision.generateFixtures({ rung1Dir: RUNG1_DIR, packDirs });
    haConfigChanged = gen.haConfigChanged;
    if (gen.ok) {
      if (!explicit) {
        const { packId } = JSON.parse(fs.readFileSync(path.join(packDirAbs, 'pack-manifest.json'), 'utf8'));
        resolvedProfilePath = path.join(RUNG1_DIR, `simulation-profile-${packId}.json`);
      }
    } else {
      logger.warn('[e2e-env] fixture generation failed — run proceeds '
        + (explicit
          ? 'on the pinned profile; the witness HA register may be stale or absent'
          : 'on the engine default profile, unprovisioned'));
    }
  } catch (err) {
    logger.warn('[e2e-env] profile resolution failed', { error: err.message });
  }

  // The gate: read the profile this run will actually boot with.
  let profileJson = null;
  if (resolvedProfilePath) {
    try {
      profileJson = JSON.parse(fs.readFileSync(path.resolve(BACKEND, resolvedProfilePath), 'utf8'));
    } catch (err) {
      logger.warn(
        '[e2e-env] profile unreadable — provisioning nothing',
        { profile: resolvedProfilePath, error: err.message }
      );
    }
  }
  const gate = provision.harnessProvides(profileJson);

  let ha = null;
  if (gate) {
    // Audio: a live ambient pipewire (a real machine's) is used as-is;
    // otherwise the rig's, with its null-sink fake physics.
    if (!provision.pipewireAlive(null)) {
      const pulse = provision.ensurePipewire({
        xdgDir: path.join(RUNG1_DIR, 'xdg'),
        busAddress: process.env.DBUS_SESSION_BUS_ADDRESS,
      });
      if (pulse) process.env.PULSE_SERVER = pulse;
    }
    // Bluetooth: real BlueZ is used as-is; otherwise the mocked daemon
    // on a private system bus, exported so the orchestrator's
    // bluetoothctl and dbus-monitor children reach it.
    const bt = provision.ensureBluetoothMock({ rung1Dir: RUNG1_DIR });
    if (bt && bt.mode === 'mock') {
      process.env.DBUS_SYSTEM_BUS_ADDRESS = bt.address;
    }
    ha = await provision.ensureHA({
      rung1Dir: RUNG1_DIR, restartIfRunning: haConfigChanged,
    });
  } else {
    // Real posture means REAL env too: stand-in exports from an
    // earlier provisioned flow in this same worker process must not
    // leak into this run's orchestrator (close review — a pinned
    // real-profile flow was still pointed at the mock system bus and
    // the rig's pulse socket).
    delete process.env.PULSE_SERVER;
    delete process.env.DBUS_SYSTEM_BUS_ADDRESS;
    logger.info(
      '[e2e-env] profile assigns nothing to the harness — '
      + 'provisioning nothing, stand-in env cleared (real posture)',
      { profile: resolvedProfilePath || '(engine default)' }
    );
  }

  const result = {
    profilePath: resolvedProfilePath, ha,
    provisioned: gate, explicitPin: !!explicit,
  };
  _runMemo.set(memoKey, { result, at: Date.now() });
  return result;
}

module.exports = { ensureSessionEnv, provisionForRun };
