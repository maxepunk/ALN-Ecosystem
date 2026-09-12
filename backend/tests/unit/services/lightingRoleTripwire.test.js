/**
 * Ledger L7 drift tripwire (A3 slice 4, D-4.5) — BUILD-TIME only.
 *
 * The pack's lightingRoleFallbacks block is a TEMPORARY copy of venue
 * scene ids (it retires at C4 by deleting the key, the schema property,
 * and the gate rule). While it exists, every fallback must equal the
 * installation profile's binding for the same role — the two are copies
 * of one fact, and a one-sided edit is the silent-drift class.
 *
 * Deliberately NEVER a boot-time check: the harness legitimately mixes
 * injected packs with the default profile (red-team Rm7). Same shape as
 * the LEGACY_ALN_SCORING tripwire. Roles whose profile binding declares
 * a non-`ha` provider are skipped (C1 WLED headroom).
 *
 * Until the S4 cutover authors the ALN fallbacks block this iterates
 * zero entries — it bites the moment S4 lands.
 */

const fs = require('fs');
const path = require('path');

const GAME_JSON = path.resolve(__dirname, '../../../../ALN-TokenData/game.json');
const PROFILE_JSON = path.resolve(__dirname, '../../../config/profiles/aln-full-kit.json');

describe('L7 tripwire: ALN lightingRoleFallbacks mirror the profile bindings', () => {
  it('every fallback scene id equals the profile binding for its role (.ha projection)', () => {
    const game = JSON.parse(fs.readFileSync(GAME_JSON, 'utf8'));
    const profile = JSON.parse(fs.readFileSync(PROFILE_JSON, 'utf8'));
    const fallbacks = game.lightingRoleFallbacks || {};
    const bindings = (profile.bindings && profile.bindings.lighting) || {};

    const drifted = [];
    for (const [role, sceneId] of Object.entries(fallbacks)) {
      const binding = bindings[role];
      if (!binding || typeof binding.ha !== 'string') continue; // non-ha provider: skip (WLED headroom)
      if (binding.ha !== sceneId) {
        drifted.push(`${role}: fallback '${sceneId}' vs profile '${binding.ha}'`);
      }
    }
    expect(drifted).toEqual([]);
  });
});
