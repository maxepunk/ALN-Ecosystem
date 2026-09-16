/**
 * PID-file path resolution (ALN_PIDFILE_DIR)
 *
 * Every PID file this orchestrator writes is named `aln-pm-<thing>.pid`, and
 * callers pass an absolute `/tmp/...` path. Only the BASENAME is honoured — the
 * directory always comes from `process.env.ALN_PIDFILE_DIR`, defaulting to
 * `/tmp`, which is what production uses.
 *
 * This is a hard safety boundary, not a convenience. `ProcessMonitor.start()`
 * → `_killOrphan()` and `displayDriver._doLaunch()` both SIGTERM/SIGKILL the pid
 * they read out of these files. With fixed `/tmp` paths, three unrelated
 * process trees share one file: the PM2 production orchestrator, every
 * E2E-spawned orchestrator, and any jest suite that builds a real
 * ProcessMonitor. On 2026-09-15 that let the unit suite reap the live show's
 * VLC on the production box, then overwrite the pidfile with a mocked pid.
 *
 * Lives in its own module (rather than on ProcessMonitor) so that suites which
 * `jest.mock('../utils/processMonitor')` still get real resolution, and so
 * displayDriver does not have to depend on ProcessMonitor just to find a path.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/** Directory used when ALN_PIDFILE_DIR is unset (production). */
const DEFAULT_PIDFILE_DIR = '/tmp';

// Bad ALN_PIDFILE_DIR values already warned about, so a caller that resolves on
// every use (displayDriver) does not spam the log.
const warnedDirs = new Set();

/**
 * Warn once per distinct bad value.
 * @param {string} dir
 * @param {string} reason
 */
function warnOnce(dir, reason) {
  if (warnedDirs.has(dir)) return;
  warnedDirs.add(dir);
  logger.warn('ALN_PIDFILE_DIR unusable — falling back to /tmp, process reaping may be unsafe', {
    dir,
    reason,
  });
}

/**
 * Resolve a pidfile path into the active pidfile directory.
 *
 * Keeps the caller's basename and replaces the directory. Read at call time,
 * never cached, so an env var set after module load still applies.
 *
 * A relative or unwritable `ALN_PIDFILE_DIR` falls back to `/tmp` with a
 * WARNING rather than silently producing a path nothing can read or write —
 * a path that cannot be read disables orphan reaping without any symptom.
 *
 * @param {string|null|undefined} pidFile - Caller-supplied path (absolute or bare basename)
 * @returns {string|null} Resolved absolute path, or null when no pidFile was given
 */
function resolvePidFile(pidFile) {
  if (!pidFile) return null;

  const configured = process.env.ALN_PIDFILE_DIR;
  let dir = DEFAULT_PIDFILE_DIR;

  if (configured) {
    if (!path.isAbsolute(configured)) {
      warnOnce(configured, 'not an absolute path');
    } else {
      dir = configured;
    }
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // Unwritable or racing another process. `recursive: true` does not throw on
    // an existing directory, so this really is a problem — but it must never
    // throw at construction time, so fall back to /tmp instead.
    if (dir !== DEFAULT_PIDFILE_DIR) {
      warnOnce(dir, err.message);
      dir = DEFAULT_PIDFILE_DIR;
    } else {
      logger.warn('Could not create the default pidfile directory', { dir, error: err.message });
    }
  }

  return path.join(dir, path.basename(pidFile));
}

module.exports = { resolvePidFile, DEFAULT_PIDFILE_DIR };
