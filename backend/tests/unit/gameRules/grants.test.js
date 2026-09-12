/**
 * B0 BS.1 — issuance-time grant computation (one-auth §1, v1 subset).
 *
 * granted = packAssignment(class) ∩ tierCeiling(tier) − (FLOOR if tier ≠ operator)
 *
 * v1 is ALN's behavior-identical degenerate table (one-auth §5): no pack
 * declares function assignments yet (that block is Phase-4 E4 headroom),
 * so packAssignment falls back to the engine's v1 class table. The FLOOR
 * trio is never minted below operator — the blast-radius cap (§4).
 */

const grants = require('../../../src/gameRules/grants');

describe('gameRules/grants — the one-auth v1 table', () => {
  it('exports the fixed FLOOR trio (one-auth §1)', () => {
    expect(grants.FLOOR_FUNCTIONS).toEqual(
      expect.arrayContaining(['session-lifecycle', 'show-control', 'score-intervention']));
    expect(grants.FLOOR_FUNCTIONS).toHaveLength(3);
    expect(Object.isFrozen(grants.FLOOR_FUNCTIONS)).toBe(true);
  });

  it('operator/staffed gets the FLOOR plus the staffed grants (today\'s GM token, unchanged in power)', () => {
    const fns = grants.computeGrants({ tier: 'operator', deviceClass: 'staffed' });
    for (const f of grants.FLOOR_FUNCTIONS) expect(fns).toContain(f);
    expect(fns).toContain('view-content');
    expect(fns).toContain('observe');
  });

  it("device/display gets exactly ['observe'] — the scoreboard's PLAIN read scope", () => {
    expect(grants.computeGrants({ tier: 'device', deviceClass: 'display' }))
      .toEqual(['observe']);
  });

  it("device/station gets exactly ['view-content'] — ALN v1, behaviorally today", () => {
    expect(grants.computeGrants({ tier: 'device', deviceClass: 'station' }))
      .toEqual(['view-content']);
  });

  it('the FLOOR is NEVER minted into a non-operator token, for every tier×class pair', () => {
    for (const tier of ['device', 'session']) {
      for (const deviceClass of ['staffed', 'station', 'personal', 'display']) {
        const fns = grants.computeGrants({ tier, deviceClass });
        for (const f of grants.FLOOR_FUNCTIONS) {
          expect(fns).not.toContain(f);
        }
      }
    }
  });

  it('an unknown tier or class computes to ZERO grants — deny by default, never a throw', () => {
    expect(grants.computeGrants({ tier: 'wizard', deviceClass: 'staffed' })).toEqual([]);
    expect(grants.computeGrants({ tier: 'operator', deviceClass: 'toaster' })).toEqual([]);
    expect(grants.computeGrants({})).toEqual([]);
  });

  it('maps every FLOOR-protected gm:command family to its floor function (the executor re-check vocabulary)', () => {
    expect(grants.requiredFloorFunction('session:end')).toBe('session-lifecycle');
    expect(grants.requiredFloorFunction('session:create')).toBe('session-lifecycle');
    expect(grants.requiredFloorFunction('system:reset')).toBe('session-lifecycle');
    expect(grants.requiredFloorFunction('cue:fire')).toBe('show-control');
    expect(grants.requiredFloorFunction('video:queue:add')).toBe('show-control');
    expect(grants.requiredFloorFunction('music:play')).toBe('show-control');
    expect(grants.requiredFloorFunction('score:adjust')).toBe('score-intervention');
    expect(grants.requiredFloorFunction('transaction:delete')).toBe('score-intervention');
    // B0 close review: health probes drive the registry that gates
    // operator commands — the service: family joined the map (it was
    // the ONE gm:command family an observe socket could fire).
    expect(grants.requiredFloorFunction('service:check')).toBe('show-control');
    // Non-floor actions return null — v1 leaves them to the operator
    // all-or-nothing ceiling (finer taxonomy is E4).
    expect(grants.requiredFloorFunction('transaction:submit')).toBeNull();
  });

  it('is a PURE module — no requires beyond nothing (the gameRules seam rule)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../src/gameRules/grants'), 'utf8');
    expect(src).not.toMatch(/require\(/);
  });
});
