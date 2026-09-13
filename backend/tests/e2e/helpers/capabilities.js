/**
 * E2E Capability Manifest (Phase 2.x.1)
 *
 * ONE way for flows to learn what this environment can do, and ONE way to
 * gate tests on it — replacing every hand-rolled serviceHealth fetch.
 *
 * Vocabulary: docs/proposals/2026-06-11-capability-vocabulary.md (shared
 * with the Phase 3 installation-profile schema and venue preflight).
 *
 * SCOPE HONESTY (kit-model decision, stack/endpoints refinement): this
 * manifest describes a TEST environment, where the stack itself can be
 * partial (no cvlc binary, no PipeWire daemon) in ways production never
 * is. Capability=false here usually means "stack tool missing on this
 * machine" — which production would treat as a FAULT. Only endpoint
 * absence realistically simulates a production install tier.
 *
 * RULES (enforced in review):
 * - Primary-path tests skip LOUDLY via requireCapabilities — never a
 *   silent if/else on environment.
 * - Designed-degradation tests gate the OPPOSITE way
 *   (requireDegraded) and are their own named tests.
 */

const https = require('https');

// Per-orchestrator-URL cache (a flow's orchestrator health doesn't change
// mid-flow; repeated calls are free)
const manifestCache = new Map();

/** The harness capability vocabulary (subset of the shared vocabulary
 *  that a test machine can meaningfully vary). */
const CAPABILITY_KEYS = ['vlc', 'sound', 'music', 'bluetooth', 'audio', 'lighting', 'display'];

/**
 * Probe the running orchestrator for this environment's capabilities.
 * @param {string} orchestratorUrl - e.g. https://localhost:43667
 * Each key is a BOOLEAN meaning "healthy" (unchanged), plus two parallel
 * maps the three-word vocabulary needs (Block 2 T1a D12): `_status[key]`
 * carries the actual word ('healthy' | 'down' | 'dormant') and `_door[key]`
 * which door latched a dormant one.
 *
 * @returns {Promise<Object>} e.g. { vlc:false, sound:false, music:false,
 *   bluetooth:false, audio:false, lighting:false, display:false,
 *   _status: {...}, _door: {...}, _health: <raw snapshot> }
 */
async function getCapabilities(orchestratorUrl) {
  if (manifestCache.has(orchestratorUrl)) return manifestCache.get(orchestratorUrl);

  const health = await new Promise((resolve, reject) => {
    const req = https.get(`${orchestratorUrl}/api/state`, {
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body).serviceHealth || {}); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('capability probe timeout')); });
  });

  const caps = { _health: health, _status: {}, _door: {} };
  for (const key of CAPABILITY_KEYS) {
    caps[key] = health[key]?.status === 'healthy';
    caps._status[key] = health[key]?.status;
    caps._door[key] = health[key]?.door;
  }
  manifestCache.set(orchestratorUrl, caps);
  return caps;
}

/**
 * Gate a test on required capabilities — uniform LOUD skip.
 * Call inside the test body (Playwright test.skip(condition, reason)).
 *
 * @param {import('@playwright/test').TestType} test - the Playwright test object
 * @param {Object} caps - manifest from getCapabilities()
 * @param {string[]} required - capability keys the primary path needs
 */
function requireCapabilities(test, caps, required) {
  const missing = required.filter((k) => !caps[k]);
  // T1a D12: a capability that is DORMANT is absent BY DESIGN — this
  // profile does not install that equipment. Skipping is right; skipping
  // with "missing on this environment" is not: it reads as a broken test
  // machine and sends whoever reads the CI log hunting a fault that does
  // not exist. Only when EVERY missing key is dormant is that the story.
  const allDormant = missing.length > 0
    && missing.every((k) => isDormant(caps, k));
  if (allDormant) {
    test.skip(true, `dormant (not installed in this profile): [${missing.join(', ')}]`);
    return;
  }
  test.skip(missing.length > 0,
    `requires capabilities [${required.join(', ')}] — missing: [${missing.join(', ')}] on this environment`);
}

/** @private */
function isDormant(caps, key) {
  return (caps._status && caps._status[key]) === 'dormant';
}

/**
 * Gate a designed-degradation test the OPPOSITE way: it only runs when at
 * least one of the listed capabilities is ABSENT (a healthy full-kit Pi
 * cannot exercise the degradation path).
 *
 * @param {import('@playwright/test').TestType} test
 * @param {Object} caps
 * @param {string[]} anyAbsent - capability keys, at least one must be absent
 */
function requireDegraded(test, caps, anyAbsent) {
  // T1a D12: a DORMANT key does NOT satisfy this gate. These tests exist to
  // exercise the DOWN path — the held item, the red row, the retry — and a
  // venue that never installed the equipment cannot exercise any of it.
  const anyDown = anyAbsent.some((k) => !caps[k] && !isDormant(caps, k));
  const dormantOnly = !anyDown && anyAbsent.some((k) => isDormant(caps, k));
  test.skip(!anyDown,
    dormantOnly
      ? `degradation test — [${anyAbsent.filter((k) => isDormant(caps, k)).join(', ')}] `
        + 'is dormant here, not down; dormancy is not degradation'
      : `degradation test — requires at least one of [${anyAbsent.join(', ')}] to be down (all healthy here)`);
}

/**
 * Gate a DORMANCY test: it runs only when every named capability is
 * dormant. The mirror of requireDegraded — one gate per posture, so a flow
 * that means "prove the grey path" cannot accidentally pass on a machine
 * where the service merely fell over.
 *
 * @param {import('@playwright/test').TestType} test
 * @param {Object} caps
 * @param {string[]} keys - capability keys, ALL must be dormant
 */
function requireDormant(test, caps, keys) {
  const notDormant = keys.filter((k) => !isDormant(caps, k));
  test.skip(notDormant.length > 0,
    'dormancy test — requires ['
    + `${keys.join(', ')}] to be dormant; found `
    + notDormant.map((k) => `${k}:${(caps._status || {})[k] || 'unknown'}`).join(', '));
}

/** One-line manifest for logs/reports. */
function formatManifest(caps) {
  return CAPABILITY_KEYS.map((k) => `${k}:${caps[k] ? '✓' : '✗'}`).join(' ');
}

/**
 * Re-probe (drops the cache entry first). Use after operations that can
 * change service health mid-flow (e.g., system:reset).
 * @param {string} orchestratorUrl
 */
async function refreshCapabilities(orchestratorUrl) {
  manifestCache.delete(orchestratorUrl);
  return getCapabilities(orchestratorUrl);
}

/**
 * Poll until a capability becomes healthy (live flap recovery — e.g., VLC
 * momentarily reports down under load and gated commands would reject).
 * This is a DYNAMIC wait, distinct from the static manifest gates.
 * @param {string} orchestratorUrl
 * @param {string} key - capability key
 * @param {number} [timeout=10000]
 */
async function waitForCapability(orchestratorUrl, key, timeout = 10000) {
  const start = Date.now();
  for (;;) {
    const caps = await refreshCapabilities(orchestratorUrl);
    if (caps[key]) return caps;
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for capability '${key}' to become healthy`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

module.exports = {
  CAPABILITY_KEYS,
  getCapabilities,
  refreshCapabilities,
  requireCapabilities,
  requireDegraded,
  requireDormant,
  formatManifest,
  waitForCapability,
};
