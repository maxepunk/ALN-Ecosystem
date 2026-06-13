'use strict';
/**
 * Secret masking for GET /api/config (F-TOOL-02 / E7).
 *
 * The config tool is a pre-show tool, but regardless of network posture the
 * read API must not hand out backend secrets. Any env key ending in
 * _PASSWORD / _TOKEN / _SECRET / _KEY / _PASS / _APIKEY / API_KEY is
 * replaced with MASK_SENTINEL in reads. Suffix-anchored, so SSL_KEY_PATH
 * stays readable. Over-masking is safe: the sentinel-skip on write-back
 * means a wrongly-masked key is merely hidden, never clobbered.
 *
 * Writes: configManager.writeEnvValues treats MASK_SENTINEL as "unchanged"
 * and skips the key, so UI save flows that echo masked values back are
 * no-ops for the secret while new values are written normally.
 */

const SECRET_KEY_PATTERN = /(_PASSWORD|_TOKEN|_SECRET|_KEY|_PASS|_APIKEY|API_KEY)$/i;
const MASK_SENTINEL = '••••••••'; // '••••••••'

function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(key);
}

/** Return a copy of an env map with non-empty secret values masked. */
function maskSecrets(env) {
  const masked = {};
  for (const [key, value] of Object.entries(env)) {
    masked[key] = isSecretKey(key) && value !== '' ? MASK_SENTINEL : value;
  }
  return masked;
}

module.exports = { SECRET_KEY_PATTERN, MASK_SENTINEL, isSecretKey, maskSecrets };
