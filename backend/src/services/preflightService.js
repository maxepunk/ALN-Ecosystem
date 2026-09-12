/**
 * preflightService — the ONE preflight evaluator (Block 2 T1a, plan §3 pin
 * P8; CONTEXT.md §5 "preflight", "paper vs live").
 *
 * Everything that asks "will tonight work?" asks HERE, and gets one answer:
 * rows quoting resolve()'s verdicts VERBATIM, a rollup, the `blocking` list
 * the session-start gate reads, and a `limits` block that says out loud
 * what this check does not verify. Two evaluators would eventually give two
 * answers, and a GM who has been told "GO" by one screen and "NO-GO" by
 * another stops believing both.
 *
 * `limits` is the honesty rule's face. A preflight that implies it checked
 * the speakers when it only read a JSON file is worse than no preflight:
 * it converts "I should walk the room" into "the computer says we're fine".
 *
 * T1a builds the MINIMAL arm: the resolver rows, the live service arm,
 * `blocking`, `limits`, and `getLast()`. The validateCommand resource arm,
 * the `video-file` need, shell-outs, DNS, the wall-clock budget and the
 * domain push are T4's. NOTHING here touches the network, the shell, or the
 * filesystem — the evaluation is a pure read over frozen snapshots plus the
 * in-memory health registry.
 */

'use strict';

const { collectPackNeeds } = require('../gameRules/packNeeds');
const { resolve } = require('../gameRules/resolution');
const registry = require('./serviceHealthRegistry');

/**
 * What this evaluation verifies, and — the load-bearing half — what it
 * cannot. T4 moves items from `cannotVerify` to `verifies` as its arms
 * land; `humanChecklist` never empties, because some things only a person
 * standing in the room can confirm.
 */
const LIMITS = Object.freeze({
  verifies: Object.freeze([
    'pack needs against the profile (paper)',
    'service health (live)',
  ]),
  cannotVerify: Object.freeze([
    'media files',
    'lighting scenes in Home Assistant',
    'audio sinks',
    'network',
    'host resources',
    'certificate',
  ]),
  humanChecklist: Object.freeze([
    'speakers placed and powered',
    'TV on the right input',
    'tokens on set',
  ]),
});

/** The last evaluation — the ONE source the session stamp and T4's domain
 * push both derive from. @type {object|null} */
let last = null;

/**
 * Thrown by sessionService.startGame when the preflight is NO-GO and the
 * caller did not ask to start anyway. Carries the reasons so the WebSocket
 * layer can build the `NO-GO: ` ack (R11) without re-evaluating.
 */
class PreflightNoGoError extends Error {
  /** @param {string[]} blocking */
  constructor(blocking = []) {
    super(`preflight NO-GO: ${blocking.join('; ')}`);
    this.name = 'PreflightNoGoError';
    this.blocking = blocking;
  }
}

/**
 * @param {{live?: boolean}} [opts] - `live: true` supplies the health
 *   registry snapshot, deepening service verdicts from paper to live.
 * @returns {{profileId: string|null, forPack: string|null, packHash: string|null,
 *   computedAt: string, depth: 'paper'|'live',
 *   rows: Array<{id: string, kind: string, verdict: string, depth: string,
 *     reason: string, severity: string|null, verbs: string[]}>,
 *   rollup: object, blocking: string[], limits: object}}
 */
function evaluate({ live = false } = {}) {
  const packService = require('./packService');
  const profileService = require('./profileService');

  const manifest = packService.getManifest();
  const pack = {
    game: packService.getGameConfig(),
    cues: { cues: packService.getCues() || [] },
    manifest,
  };
  const needs = collectPackNeeds(pack);
  const profile = profileService.getProfile();

  // R16: the resolver reads either shape; the snapshot is the richer one
  // (it carries the door, so a dormant row can name which door latched it).
  const inventory = live ? { serviceHealth: registry.getSnapshot() } : {};

  const { verdicts, rollup } = resolve(needs, profile, inventory);
  const stack = (manifest && manifest.hardware && manifest.hardware.stack) || {};

  const rows = verdicts.map((v) => ({
    id: `${v.need.kind}:${v.need.id}`,
    kind: v.need.kind,
    verdict: v.verdict,
    depth: v.depth,
    reason: v.reason,
    severity: severityOf(v, stack),
    // Loop 3: every row eventually says what to do about it. T4 fills these.
    verbs: [],
  }));

  const info = profileService.getProfileInfo();
  const packInfo = packService.getActivePackInfo();

  last = {
    profileId: info ? info.profileId : null,
    forPack: info ? (info.forPack ?? null) : null,
    packHash: packInfo ? packInfo.contentHash : null,
    computedAt: new Date().toISOString(),
    depth: live ? 'live' : 'paper',
    rows,
    rollup,
    blocking: rollup.blocking,
    limits: LIMITS,
  };
  return last;
}

/**
 * The certificate warn class for a row. A `no-go` is `blocking` — the one
 * severity that refuses a start. A `fault` takes the pack's own declared
 * importance for that stack service (`hardware.stack.<id>.onAbsent`),
 * defaulting to `degrade`. Everything else has no severity: dormant is not
 * a problem, and `runs` is not news.
 * @private
 */
function severityOf(v, stack) {
  if (v.verdict === 'no-go') return 'blocking';
  if (v.verdict === 'fault') {
    const decl = stack[v.need.id];
    return (decl && decl.onAbsent) || 'degrade';
  }
  return null;
}

/** @returns {object|null} the last evaluation, or null before the first. */
function getLast() {
  return last;
}

/** Test-only: forget the last evaluation. */
function _resetForTesting() {
  last = null;
}

module.exports = { evaluate, getLast, PreflightNoGoError, LIMITS, _resetForTesting };
