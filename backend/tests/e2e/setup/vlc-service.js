/**
 * VLC Service Helper for E2E Testing — COMPATIBILITY SHIM (spawns nothing)
 *
 * The orchestrator owns the only VLC instance. `vlcMprisService.init()` starts
 * `cvlc` under a ProcessMonitor with PRODUCTION arguments (including the Pi 5
 * `--vout=gles2` auto-detection and `-A pulse`), supervises it, and reaps
 * orphans via its `aln-pm-vlc.pid` file. Under E2E that file lives in the
 * harness's private ALN_PIDFILE_DIR (see test-server.js), not /tmp, so E2E and
 * the production PM2 orchestrator never reap each other's children. E2E flows
 * therefore exercise the same VLC
 * the show runs on.
 *
 * WHY THIS FILE NO LONGER SPAWNS VLC
 * ----------------------------------
 * This helper predates orchestrator-owned VLC (2026-03-02). It used to start
 * its own `cvlc --intf dummy --no-video-title-show --quiet` before the
 * orchestrator, which then found the D-Bus bus name already taken and drove
 * THAT instance. Two problems, both measured at the venue on 2026-09-15:
 *
 * 1. Latency. On the bench (no display attached, Xorg with no connected
 *    output) the harness instance reported PlaybackStatus=Playing ~29.5 s
 *    after OpenUri. The orchestrator's instance, in-process, is 0.32 s from
 *    play command to observed "playing" — no gap at any hop. The harness
 *    instance is launched with no `--vout` flag, so its video-output creation
 *    is the plausible (not proven) cause; either way it is not what production
 *    does.
 * 2. Missing metadata. Even WITH a display, the harness instance reported no
 *    `mpris:length` for an HEVC clip until playback ended, so
 *    videoQueueService emitted no `video:progress` at all (the `length > 0`
 *    guard) and video-driven compound cues parked in boundary mode forever.
 *    The same clip through a single production-argument instance reported
 *    `mpris:length` within 1.0 s.
 *
 * Two instances also race for `org.mpris.MediaPlayer2.vlc`, so which process
 * answered a D-Bus call was never stable.
 *
 * `setupVLC()` and `cleanup()` remain exported (19 flows call them before
 * `startOrchestrator()` / in `afterAll`) and are now no-ops. Video flows gate
 * on the `vlc` capability from `helpers/capabilities.js` instead of on a
 * harness-owned mode string.
 *
 * Evidence: docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md
 *   → "Venue step 2" and "Grounded conclusion for W9".
 *
 * @module tests/e2e/setup/vlc-service
 */

const { execFileSync } = require('child_process');
const logger = require('../../../src/utils/logger');

const VLC_DBUS_DEST = 'org.mpris.MediaPlayer2.vlc';

/**
 * Diagnostic only: is SOMETHING answering on the VLC MPRIS bus name?
 *
 * Tests must NOT gate on this — a bus-name ping says nothing about which
 * process owns the name or whether the orchestrator considers VLC healthy.
 * Use `helpers/capabilities.js` (`getCapabilities` / `requireCapabilities` /
 * `waitForCapability`), which reads the orchestrator's own serviceHealth.
 *
 * @returns {Promise<boolean>} true if the MPRIS bus name responds to a Ping
 */
async function isVLCAvailable() {
  try {
    execFileSync('dbus-send', [
      '--session',
      `--dest=${VLC_DBUS_DEST}`,
      '--print-reply',
      '/org/mpris/MediaPlayer2',
      'org.freedesktop.DBus.Peer.Ping'
    ], { timeout: 2000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * No-op compatibility shim. VLC is started and supervised by the orchestrator.
 *
 * @returns {Promise<{type: string, note: string}>}
 */
async function setupVLC() {
  logger.debug('setupVLC() is a no-op — the orchestrator owns VLC');
  return {
    type: 'orchestrator',
    note: 'VLC is owned by the orchestrator ProcessMonitor'
  };
}

/**
 * No-op compatibility shim. The orchestrator stops its VLC on shutdown
 * (`vlcMprisService.cleanup()` stops the ProcessMonitor).
 *
 * @returns {Promise<void>}
 */
async function cleanup() {
  // Nothing to clean up: this helper owns no process.
}

module.exports = {
  // Diagnostics
  isVLCAvailable,

  // Compatibility shims (no-ops)
  setupVLC,
  cleanup,
  reset: cleanup,
};
