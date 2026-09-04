/**
 * resolve — the ratified C1 §2 resolution table as one pure function
 * (C2+C3 design §8, 2026-09-04; CONTEXT.md "One truth, three loops").
 *
 * The single comparison every surface quotes: pack needs (from
 * collectPackNeeds) vs what the loaded profile declares, deepened by
 * whatever live facts the caller gathered. No I/O here — the caller
 * owns file loading and probing.
 *
 * Each verdict carries the depth it reached — 'paper' (declared
 * inventory only) or 'live' (a supplied real-world fact decided it) —
 * and consumers must surface that label plus the profile identity
 * (CONTEXT.md "Paper vs live checks").
 *
 * @param {Array<object>} needs - from collectPackNeeds
 * @param {object} profile - an installation profile (any environment)
 * @param {object} [inventory] - live facts the caller gathered;
 *   absent facts leave verdicts at paper depth (unknown never faults)
 * @returns {{verdicts: Array<{need: object, verdict: string,
 *   depth: string, reason: string}>, rollup: object}}
 */
function resolve(needs, profile, inventory = {}) {
  const verdicts = [];
  const bindings = (profile && profile.bindings) || {};

  for (const need of needs) {
    verdicts.push(resolveOne(need, profile, bindings, inventory));
  }

  return { verdicts, rollup: rollUp(verdicts) };
}

function resolveOne(need, profile, bindings, inventory) {
  switch (need.kind) {
    case 'lighting-role': {
      const bound = (bindings.lighting || {})[need.id];
      if (bound) {
        return verdict(need, 'runs', 'paper', `bound: ${bound.ha}`);
      }
      if (need.fallback) {
        // Ledger L7's loud path: unbound but the pack authors a
        // fallback scene — the show runs, degraded, and says so.
        return verdict(
          need, 'runs', 'paper',
          `unbound; runs via pack fallback ${need.fallback}`
        );
      }
      // No binding, no fallback: this role's commands will refuse at
      // runtime ("role unbound tonight") — surfaced pre-show here.
      return verdict(
        need, 'fault', 'paper', `role '${need.id}' unbound, no fallback`
      );
    }
    case 'endpoint': {
      // C1 §2: an endpoint the profile declares is present; one it
      // omits is absent — dormant under degrade ("not installed
      // tonight", never red), NO-GO under require.
      const declared = (profile && profile.endpoints) || {};
      if (Object.prototype.hasOwnProperty.call(declared, need.id)) {
        return verdict(need, 'runs', 'paper', 'declared by profile');
      }
      if (need.onAbsent === 'require') {
        return verdict(
          need, 'no-go', 'paper',
          `required endpoint '${need.id}' not installed at this venue`
        );
      }
      return verdict(
        need, 'dormant', 'paper', `'${need.id}' not installed tonight`
      );
    }
    case 'device-class': {
      // C1 §2: connected devices below the pack minimum = NO-GO.
      // Counts are live facts; with none supplied the verdict stays
      // paper and unverified — unknown never faults.
      const counts = inventory.deviceCounts;
      if (!counts || counts[need.id] === undefined) {
        return verdict(
          need, 'runs', 'paper',
          `minimum ${need.min} '${need.id}' unverified (no live counts)`
        );
      }
      if (counts[need.id] >= need.min) {
        return verdict(
          need, 'runs', 'live', `${counts[need.id]} '${need.id}' connected`
        );
      }
      return verdict(
        need, 'no-go', 'live',
        `${counts[need.id]} '${need.id}' connected, pack requires ${need.min}`
      );
    }
    case 'surface-channel': {
      const surf = (bindings.surfaces || {})[need.id];
      if (surf) {
        return verdict(need, 'runs', 'paper', `bound: ${surf.file}`);
      }
      return verdict(
        need, 'dormant', 'paper',
        `channel '${need.id}' not installed tonight`
      );
    }
    case 'sound': {
      const files = inventory.soundFiles;
      if (!files) {
        return verdict(
          need, 'runs', 'paper', `'${need.id}' unverified (no live listing)`
        );
      }
      if (files.includes(need.id)) {
        return verdict(need, 'runs', 'live', `'${need.id}' present`);
      }
      return verdict(need, 'fault', 'live', `sound file '${need.id}' missing`);
    }
    case 'service': {
      // C1 §2: orchestrator present => every stack service is
      // expected; one that is not running is a FAULT, never dormant.
      const health = (inventory.serviceHealth || {})[need.id];
      if (health === undefined) {
        return verdict(
          need, 'runs', 'paper', `'${need.id}' expected (stack service)`
        );
      }
      if (health === 'healthy') {
        return verdict(need, 'runs', 'live', `'${need.id}' healthy`);
      }
      return verdict(
        need, 'fault', 'live', `stack service '${need.id}' is ${health}`
      );
    }
    case 'capability':
      // The activation gate already refused any pack whose declared
      // capabilities this engine cannot drive; by resolution time
      // they hold by construction.
      return verdict(need, 'runs', 'paper', 'activation-gated');
    case 'lighting-role-ref': {
      // A cue's reference to a role runs exactly when the role does.
      const roleNeed = {
        kind: 'lighting-role', id: need.id,
        fallback: need.fallback || null,
      };
      const mirrored = resolveOne(roleNeed, profile, bindings, inventory);
      return verdict(need, mirrored.verdict, mirrored.depth, mirrored.reason);
    }
    default:
      return verdict(need, 'runs', 'paper', 'not yet resolved');
  }
}

function verdict(need, v, depth, reason) {
  return { need, verdict: v, depth, reason };
}

function rollUp(verdicts) {
  if (verdicts.some((v) => v.verdict === 'no-go')) {
    return { status: 'no-go' };
  }
  const degraded = verdicts.some(
    (v) => v.verdict === 'dormant' || v.verdict === 'fault'
  );
  return { status: degraded ? 'go-degraded' : 'go' };
}

module.exports = { resolve };
