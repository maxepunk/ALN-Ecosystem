/**
 * Timezone utility — auto-derives the deployment's POSIX TZ string.
 *
 * Intended consumer: clients without local timezone config (primarily
 * ESP32 scanners) read this via GET /health and apply it via
 * setenv("TZ", ...) + tzset() so scan timestamps render in the host's
 * local time.
 *
 * Derivation strategy:
 *   1. IANA zone from Node Intl (e.g., "America/Los_Angeles")
 *   2. Read /usr/share/zoneinfo/<iana> binary
 *   3. Extract trailing newline-terminated POSIX TZ string
 *      (present in TZif v2+ files, standard since tzdata 2007)
 *   4. Fallback to "UTC0" on any failure
 *
 * Platform support: Linux (primary — Pi appliance). macOS has zoneinfo
 * at a different path and is not covered; falls back to UTC0.
 * Windows unsupported; UTC0 fallback.
 *
 * Result is cached — a process's timezone does not change after start.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const ZONEINFO_ROOT = '/usr/share/zoneinfo';
const IANA_SAFE = /^[A-Za-z0-9_+\-/]+$/;  // path-safety: block '..', nulls, etc.

let cached = null;

/**
 * Returns the deployment's POSIX TZ string (e.g., "PST8PDT,M3.2.0,M11.1.0").
 * Falls back to "UTC0" if auto-derivation fails.
 *
 * @returns {string} POSIX TZ string
 */
function getPosixTimezone() {
  if (cached !== null) return cached;
  cached = derivePosixTimezone();
  return cached;
}

/**
 * Reset the cache. Test-only helper.
 */
function _resetCache() {
  cached = null;
}

function derivePosixTimezone() {
  let iana;
  try {
    iana = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (err) {
    logger.warn('Timezone: Intl lookup failed', { error: err.message });
    return 'UTC0';
  }

  if (!iana || !IANA_SAFE.test(iana)) {
    logger.warn('Timezone: unsafe or empty IANA zone', { iana });
    return 'UTC0';
  }

  const zoneFile = path.join(ZONEINFO_ROOT, iana);
  // Sanity: ensure path hasn't escaped the zoneinfo root
  if (!path.resolve(zoneFile).startsWith(path.resolve(ZONEINFO_ROOT) + path.sep) &&
      path.resolve(zoneFile) !== path.resolve(ZONEINFO_ROOT)) {
    logger.warn('Timezone: path escape attempt', { iana, zoneFile });
    return 'UTC0';
  }

  let buf;
  try {
    buf = fs.readFileSync(zoneFile);
  } catch (err) {
    logger.warn('Timezone: zoneinfo file unavailable', { zoneFile, error: err.message });
    return 'UTC0';
  }

  // TZif v2+ footer: the file ends with \n<POSIX TZ>\n
  // Take the last non-empty line.
  const text = buf.toString('latin1');  // binary-safe for ASCII TZ strings
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const posix = lines[lines.length - 1];

  if (!posix) {
    logger.warn('Timezone: no POSIX footer in zoneinfo file', { zoneFile });
    return 'UTC0';
  }

  return posix;
}

module.exports = {
  getPosixTimezone,
  _resetCache,
};
