'use strict';

/**
 * Cue-Block Validation — pack-internal gate rules (A3 slice 4 S2, D-4.3)
 *
 * Pure module: no I/O, no services, no logger. packService calls
 * validateCuesBlock() at activation; the config-tool imports it directly
 * before writing pack cues (S4, the writeScoring precedent). That shared
 * seam is why this lives in gameRules/ and must never pull winston or
 * dotenv (D-4.7d).
 *
 * This module OWNS the row-2.22 cue-authoring vocabulary:
 * - CUE_TRIGGER_EVENTS: the events a standing cue may trigger on. The
 *   engine table (standingEvaluator EVENT_NORMALIZERS) and the pack
 *   schema (cues.schema.json) are drift-tripwired against this list —
 *   grow all three together.
 * - CONDITION_OP_NAMES: mirrors CONDITION_OPS the same way.
 * - CUE_ACTIONS: the actions a pack cue may dispatch, with required
 *   payload fields. Deliberately a SUBSET of gm:command: session
 *   lifecycle, score intervention, and transaction surgery are
 *   operator-only (the auth floor) — pack data never drives them.
 *   Admin/maintenance actions (system, bluetooth pairing, held-item
 *   management, per-client scoreboard paging, health probes, direct
 *   cue:fire — chaining rides standing triggers on cue:completed) are
 *   also out. Lighting payloads carry `role`, not `sceneId`; S3
 *   normalizes role → sceneId at the top of executeCommand.
 *
 * Every rule is a PACK-INTERNAL pure read (red-team G1/R2): nothing here
 * touches a service or checks a venue file. Venue-resource existence
 * stays at preflight (C1 §3 item 5).
 *
 * Messages carry the two-flavor language (slice-1 ratification):
 * "self-contradictory" for flavor-i, "not driveable by this engine yet"
 * for flavor-ii. The gate cannot assume schema validation ran, so shape
 * rules recheck what cues.schema.json also refuses.
 */

const CUE_TRIGGER_EVENTS = [
  'cue:completed',
  'gameclock:started',
  'group:completed',
  'music:playback:changed',
  'music:playlist:changed',
  'music:track:changed',
  'phase:changed',
  'player:scan',
  'session:created',
  'sound:completed',
  'transaction:accepted',
  'video:completed',
  'video:loading',
  'video:paused',
  'video:resumed',
  'video:started',
];

const CONDITION_OP_NAMES = ['eq', 'gt', 'gte', 'in', 'lt', 'lte', 'neq'];

/**
 * Trigger events whose normalizer tokenId comes from the pack token
 * database. Rule 3 resolves condition tokenIds against tokens.json for
 * these ONLY — `video:*` trigger tokenIds are a filename-derived engine
 * namespace (videoQueueService mints them for standalone videos) and are
 * exempt (red-team G2; the ALN guard cues depend on this).
 */
const TOKEN_DERIVED_TRIGGER_EVENTS = ['player:scan', 'transaction:accepted'];

/** Strict authoring form for trigger.clock. Same pattern as the schema. */
const CLOCK_PATTERN = /^[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]$/;

/** The cue-action vocabulary: action → required payload fields. */
const CUE_ACTIONS = {
  'sound:play': { requiredFields: ['file'] },
  'sound:stop': { requiredFields: [] },
  'lighting:scene:activate': { requiredFields: ['role'] },
  'video:queue:add': { requiredFields: ['videoFile'] },
  'video:play': { requiredFields: [] },
  'video:pause': { requiredFields: [] },
  'video:stop': { requiredFields: [] },
  'video:skip': { requiredFields: [] },
  'video:seek': { requiredFields: ['position'] },
  'music:play': { requiredFields: [] },
  'music:pause': { requiredFields: [] },
  'music:stop': { requiredFields: [] },
  'music:next': { requiredFields: [] },
  'music:previous': { requiredFields: [] },
  'music:setVolume': { requiredFields: ['volume'] },
  'music:setShuffle': { requiredFields: ['enabled'] },
  'music:setLoop': { requiredFields: ['enabled'] },
  'music:loadPlaylist': { requiredFields: ['playlistId'] },
  'music:seek': { requiredFields: ['position'] },
  'display:scoreboard': { requiredFields: [] },
  'display:idle-loop': { requiredFields: [] },
  'display:return-to-video': { requiredFields: [] },
  'audio:route:set': { requiredFields: ['sink'] },
  'audio:volume:set': { requiredFields: ['stream', 'volume'] },
};

const actionVocabulary = () => Object.keys(CUE_ACTIONS).sort().join(', ');

/**
 * Validate a pack's cues block plus its lighting-role declarations.
 * Pure pack-internal reads only.
 *
 * @param {Array<Object>|null} cuesArray - Parsed cues (null when the
 *   pack declares no cues file). Benign emptiness: nothing declared,
 *   nothing refused.
 * @param {Object} gameConfig - The pack's game.json content.
 * @param {Object} tokens - The pack's tokens.json content.
 * @returns {string[]} Fully worded problems; empty means the block is
 *   coherent and driveable.
 */
function validateCuesBlock(cuesArray, gameConfig, tokens) {
  const problems = [];
  if (!gameConfig || typeof gameConfig !== 'object') return problems;

  const roles = new Set(Array.isArray(gameConfig.lightingRoles) ? gameConfig.lightingRoles : []);
  const requires = new Set(Array.isArray(gameConfig.requires) ? gameConfig.requires : []);
  const tokenIds = new Set(tokens && typeof tokens === 'object' ? Object.keys(tokens) : []);

  // Rule 5: fallbacks bind declared roles only.
  const fallbacks = gameConfig.lightingRoleFallbacks;
  if (fallbacks && typeof fallbacks === 'object') {
    for (const role of Object.keys(fallbacks)) {
      if (!roles.has(role)) {
        problems.push(
          `lightingRoleFallbacks — fallback declared for role '${role}' which lightingRoles never declares; self-contradictory`
        );
      }
    }
  }

  // Feature usage, feeding the rule-6 requires lint.
  let usesStanding = false;
  let usesTimeline = false;
  let usesRoles = roles.size > 0;

  // Shared command/timeline-entry checks (rules 1, 2).
  const checkAction = (cueId, where, entry) => {
    if (typeof entry.action !== 'string' || entry.action.length === 0) {
      problems.push(`${where} — action must be a non-empty string; self-contradictory`);
      return;
    }
    const def = CUE_ACTIONS[entry.action];
    if (!def) {
      problems.push(
        `${where} — action '${entry.action}' is not in the engine cue-action vocabulary ` +
        `(${actionVocabulary()}); not driveable by this engine yet`
      );
      return;
    }
    const payload = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
    if (entry.action === 'lighting:scene:activate') {
      usesRoles = true;
      if (typeof payload.sceneId === 'string') {
        problems.push(
          `${where} — pack cues address lights by role; concrete scene id '${payload.sceneId}' ` +
          'belongs in the installation profile bindings (or lightingRoleFallbacks), never in pack content; self-contradictory'
        );
      }
    }
    for (const field of def.requiredFields) {
      if (payload[field] === undefined || payload[field] === '') {
        problems.push(
          `${where} — '${entry.action}' payload is missing required field '${field}'; self-contradictory`
        );
      }
    }
    if (entry.action === 'lighting:scene:activate'
        && typeof payload.role === 'string' && payload.role.length > 0
        && !roles.has(payload.role)) {
      problems.push(
        `${where} — lighting role '${payload.role}' is never declared in lightingRoles; self-contradictory`
      );
    }
  };

  const checkConditions = (cueId, trig) => {
    if (trig.conditions === undefined) return;
    if (!Array.isArray(trig.conditions)) {
      problems.push(`cues['${cueId}'] — trigger.conditions must be an array; self-contradictory`);
      return;
    }
    trig.conditions.forEach((cond, i) => {
      if (!cond || typeof cond !== 'object'
          || typeof cond.field !== 'string' || cond.field.length === 0) {
        problems.push(
          `cues['${cueId}'].conditions[${i}] — malformed condition (non-empty field, op, value required); self-contradictory`
        );
        return;
      }
      if (!CONDITION_OP_NAMES.includes(cond.op)) {
        problems.push(
          `cues['${cueId}'].conditions[${i}] — op '${cond.op}' is not a condition operator ` +
          `(operators: ${CONDITION_OP_NAMES.join(', ')}); an unknown op silently never fires; self-contradictory`
        );
        return;
      }
      if (cond.op === 'in' && !Array.isArray(cond.value)) {
        problems.push(
          `cues['${cueId}'].conditions[${i}] — op 'in' needs an array value; a scalar silently never matches; self-contradictory`
        );
        return;
      }
      // Rule 3: token-derived triggers only; video:* tokenIds are the
      // engine's filename namespace and are exempt.
      if (TOKEN_DERIVED_TRIGGER_EVENTS.includes(trig.event) && cond.field === 'tokenId') {
        const values = cond.op === 'in' ? cond.value
          : (cond.op === 'eq' || cond.op === 'neq') ? [cond.value] : [];
        for (const v of values) {
          if (typeof v === 'string' && !tokenIds.has(v)) {
            problems.push(
              `cues['${cueId}'].conditions[${i}] — condition tokenId '${v}' resolves against the pack ` +
              `token database and is never declared (token-derived triggers: ${TOKEN_DERIVED_TRIGGER_EVENTS.join(', ')}); self-contradictory`
            );
          }
        }
      }
    });
  };

  if (Array.isArray(cuesArray)) {
    const seenIds = new Set();
    cuesArray.forEach((cue, i) => {
      // Malformed entries refuse with a named message, never a raw
      // TypeError (phases-gate precedent).
      if (!cue || typeof cue !== 'object'
          || typeof cue.id !== 'string' || cue.id.length === 0
          || typeof cue.label !== 'string' || cue.label.length === 0) {
        problems.push(
          `cues[${i}] — malformed cue entry (non-empty id and non-empty label are required); self-contradictory`
        );
        return;
      }
      if (seenIds.has(cue.id)) {
        problems.push(
          `cues — duplicate cue id '${cue.id}' is self-contradictory (cues must be uniquely identifiable; loadCues would silently last-win)`
        );
      }
      seenIds.add(cue.id);

      const hasCommands = Array.isArray(cue.commands) && cue.commands.length > 0;
      const hasTimeline = Array.isArray(cue.timeline) && cue.timeline.length > 0;
      if (hasCommands === hasTimeline) {
        problems.push(
          `cues['${cue.id}'] — a cue must have exactly one of commands or timeline (non-empty); self-contradictory`
        );
        return;
      }
      if (hasTimeline) usesTimeline = true;

      // Rule 7b: trigger coherence.
      const trig = cue.trigger;
      if (trig !== undefined && trig !== null) {
        if (typeof trig !== 'object') {
          problems.push(
            `cues['${cue.id}'] — trigger must be an object or null; self-contradictory`
          );
        } else {
          usesStanding = true;
          const hasEvent = typeof trig.event === 'string' && trig.event.length > 0;
          const hasClock = typeof trig.clock === 'string' && trig.clock.length > 0;
          if (hasEvent === hasClock) {
            problems.push(
              `cues['${cue.id}'] — trigger must be exactly one of {event} or {clock} (or null for manual-only); self-contradictory`
            );
          } else if (hasEvent) {
            if (!CUE_TRIGGER_EVENTS.includes(trig.event)) {
              problems.push(
                `cues['${cue.id}'] — trigger.event '${trig.event}' is not an event this engine emits ` +
                `(cue-trigger vocabulary: ${CUE_TRIGGER_EVENTS.join(', ')}); not driveable by this engine yet`
              );
            }
            checkConditions(cue.id, trig);
          } else if (!CLOCK_PATTERN.test(trig.clock)) {
            problems.push(
              `cues['${cue.id}'] — trigger.clock '${trig.clock}' is not HH:MM:SS; an unparseable clock ` +
              'string would throw out of the tick listener once per second mid-show; self-contradictory'
            );
          }
        }
      }

      if (hasCommands) {
        cue.commands.forEach((cmd, j) => {
          if (!cmd || typeof cmd !== 'object') {
            problems.push(`cues['${cue.id}'].commands[${j}] — malformed command entry; self-contradictory`);
            return;
          }
          checkAction(cue.id, `cues['${cue.id}'].commands[${j}]`, cmd);
        });
      }

      if (hasTimeline) {
        let videoEntries = 0;
        cue.timeline.forEach((entry, j) => {
          if (!entry || typeof entry !== 'object') {
            problems.push(`cues['${cue.id}'].timeline[${j}] — malformed timeline entry; self-contradictory`);
            return;
          }
          // Rule 7d: a missing `at` NaN-poisons the cue's computed end
          // time and the cue never completes.
          if (!(typeof entry.at === 'number' && Number.isFinite(entry.at) && entry.at >= 0)) {
            problems.push(
              `cues['${cue.id}'].timeline[${j}] — 'at' must be a finite non-negative number of seconds ` +
              "(a missing or malformed 'at' poisons the cue's end time and the cue never completes); self-contradictory"
            );
            return;
          }
          if (entry.action === 'video:queue:add') videoEntries += 1;
          checkAction(cue.id, `cues['${cue.id}'].timeline[${j}]`, entry);
        });
        // Rule 7e (F-SHOW-08): the three-segment timeline correlates
        // exactly one video.
        if (videoEntries > 1) {
          problems.push(
            `cues['${cue.id}'] — ${videoEntries} video entries in one timeline; a compound cue ` +
            'correlates exactly ONE video (F-SHOW-08); self-contradictory'
          );
        }
      }
    });
  }

  // Rule 6 (D-4.1 authoring lint): features used without the matching
  // capability id in `requires` would activate on a pre-slice-4 engine
  // with the show control silently ignored.
  const lintRequire = (used, capId, what) => {
    if (used && !requires.has(capId)) {
      problems.push(
        `requires — ${what} but '${capId}' is missing from requires; an engine without it would ` +
        'activate this pack with its show control silently ignored; self-contradictory'
      );
    }
  };
  lintRequire(usesStanding, 'cues.standing', 'cues declare standing triggers');
  lintRequire(usesTimeline, 'cues.timeline', 'cues declare compound timelines');
  lintRequire(usesRoles, 'lighting.roles', 'lighting roles are declared or referenced');

  return problems;
}

module.exports = {
  validateCuesBlock,
  CUE_TRIGGER_EVENTS,
  CONDITION_OP_NAMES,
  CUE_ACTIONS,
  TOKEN_DERIVED_TRIGGER_EVENTS,
  CLOCK_PATTERN,
};
