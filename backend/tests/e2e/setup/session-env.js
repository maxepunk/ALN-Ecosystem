/**
 * E2E environment policy — the THIN layer over the shared rung-1
 * provisioning module (tests/rung1/provision.js; design + owner
 * rulings: docs/plans/2026-09-05-train-fix-vehicle.md §8.1).
 *
 * The module owns the mechanisms (bus, display, pipewire, Home
 * Assistant, Bluetooth mock, fixture generation). This file owns the
 * E2E POLICY:
 *
 * - Ambient-first: a live environment is used, never replaced. Only
 *   what is genuinely absent is provisioned.
 * - One bus PER PLAYWRIGHT WORKER: VLC's MPRIS name is a singleton
 *   per bus, so a shared bus made every concurrently-running test
 *   file share ONE real VLC (measured: 25 files adopting one player).
 *   The socket is keyed by the worker slot; Xvfb stays shared — X is
 *   multi-client.
 * - THE GATE: fake physics are manufactured only for a run whose
 *   profile assigns stand-ins to the harness. A run pinned to a real
 *   profile provisions nothing, so a venue machine cannot be polluted
 *   by construction. When no profile is pinned, the run gets the
 *   generated per-pack SIMULATION profile — the suite's identity is
 *   rung-1 tooling (machine verification is the preflight's job, not
 *   Playwright's), and the engine must boot with the SAME profile the
 *   harness provisions against (the old aln-full-kit default bound
 *   lighting roles to real venue scenes the witness HA does not
 *   serve, silently blocking the compound cue's active path).
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

  // Ambient-first holds ONLY for worker 0: on a host with a live
  // session bus, letting every parallel worker adopt it recreates the
  // shared-VLC-singleton contention the per-worker buses exist to
  // prevent (model-window audit: the bypass was silent and total on
  // any bus-having host). Worker 0 keeps the ambient bus — the
  // single-worker hardware/dev posture unchanged; workers 1+ always
  // get their own socket. Each branch logs itself.
  const existing = process.env.DBUS_SESSION_BUS_ADDRESS;
  const isParallelWorker = Number(WORKER_SLOT) > 0;
  if (!isParallelWorker && existing && provision.busAlive(existing)) {
    logger.info('[e2e-env] worker 0 using the ambient session bus', { existing });
    result.bus = true;
  } else {
    const address = provision.ensureBus({ socketPath: WORKER_BUS_SOCKET });
    if (address) {
      process.env.DBUS_SESSION_BUS_ADDRESS = address;
      result.bus = true;
      logger.info('[e2e-env] worker bus active', { worker: WORKER_SLOT, address });
    } else {
      logger.warn('[e2e-env] no session bus — video tests will skip loudly');
    }
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
// idempotent anyway; this saves the repeated probing).
const _runMemo = new Map();

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
  if (_runMemo.has(memoKey)) return _runMemo.get(memoKey);

  ensureSessionEnv();

  let resolvedProfilePath = explicit;
  let haConfigChanged = false;
  try {
    if (!explicit) {
      // Generate fixtures for the run's pack plus every known pack —
      // one witness register serving all legs, per-pack profiles.
      const packDirs = [...new Set([packDirAbs, ...KNOWN_PACK_DIRS])];
      const gen = provision.generateFixtures({ rung1Dir: RUNG1_DIR, packDirs });
      haConfigChanged = gen.haConfigChanged;
      if (gen.ok) {
        const { packId } = JSON.parse(fs.readFileSync(path.join(packDirAbs, 'pack-manifest.json'), 'utf8'));
        resolvedProfilePath = path.join(RUNG1_DIR, `simulation-profile-${packId}.json`);
      } else {
        logger.warn('[e2e-env] fixture generation failed — run proceeds '
          + 'on the engine default profile, unprovisioned');
      }
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
    logger.info(
      '[e2e-env] profile assigns nothing to the harness — '
      + 'provisioning nothing (real environment posture)',
      { profile: resolvedProfilePath || '(engine default)' }
    );
  }

  const result = { profilePath: resolvedProfilePath, ha, provisioned: gate };
  _runMemo.set(memoKey, result);
  return result;
}

module.exports = { ensureSessionEnv, provisionForRun };
