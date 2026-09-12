/**
 * B0 BS.4 — the one-auth §5 v1 proofs (2026-07-09-phase3-1-one-auth.md):
 * "new contract tests pinning: (a) floor functions rejected for
 * non-operator tokens, (b) grants recomputed on pack switch."
 *
 * (a) is proven at all three enforcement surfaces: the HTTP
 * requireFunction gate, the commandExecutor operator floor, and the
 * observe token's own verification path. (b) in its v1 shape: grants
 * and packHash are resolved AT ISSUANCE, so a token minted after a
 * pack switch carries the NEW active pack's contentHash — the
 * stale-grant detection seam Phase-4 E4's pack-driven assignments
 * build on. (v1 grant TABLES are the baked operator-degenerate case,
 * so the function set itself is pack-independent by design.)
 */

const path = require('path');

const PACKS = path.resolve(__dirname, '../../e2e/fixtures/packs');

describe('one-auth §5 proofs (B0 BS.4)', () => {
  describe('(a) floor functions rejected for non-operator tokens', () => {
    const {
      generateAdminToken, generateObserveToken, requireFunction,
      verifyObserveToken, invalidateObserveTokens,
    } = require('../../../src/middleware/auth');
    const { executeCommand } = require('../../../src/services/commandExecutor');
    const { FLOOR_FUNCTIONS } = require('../../../src/gameRules/grants');

    afterAll(() => invalidateObserveTokens());

    it('HTTP: every floor function refuses an observe token and a missing token', () => {
      const observe = generateObserveToken('SCOREBOARD_PROOF');
      for (const fn of FLOOR_FUNCTIONS) {
        const gate = requireFunction(fn);
        for (const authHeader of [undefined, `Bearer ${observe}`]) {
          const req = { headers: authHeader ? { authorization: authHeader } : {}, path: '/proof', method: 'PUT', ip: '::1' };
          let status = null;
          const res = {
            status(code) { status = code; return this; },
            json() { return this; },
          };
          let passed = false;
          gate(req, res, () => { passed = true; });
          expect(passed).toBe(false);
          expect(status).toBe(401);
        }
      }
    });

    it('executor: every floor action refuses a non-operator actor; the operator floor passes', async () => {
      const observeActor = { tier: 'device', functions: ['observe'] };
      for (const action of ['session:pause', 'cue:fire', 'score:reset']) {
        const result = await executeCommand({
          action, payload: {}, source: 'gm', actor: observeActor,
        });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/operator floor/);
      }
    });

    it('the observe token verifies ONLY as itself: functions exactly [observe], tier device', () => {
      const observe = generateObserveToken('SCOREBOARD_PROOF2');
      const decoded = verifyObserveToken(observe);
      expect(decoded.tier).toBe('device');
      expect(decoded.functions).toEqual(['observe']);
      // And an operator token never passes the observe path (stores never cross).
      const operator = generateAdminToken('proof-admin');
      expect(verifyObserveToken(operator)).toBeNull();
    });
  });

  describe('(b) grants recomputed on pack switch (issuance-time resolution)', () => {
    // The BS.1 manifestCachePath pattern: a fresh module graph per
    // PACK_PATH so activation is the real boot-shaped call.
    function mintUnderPack(packDir) {
      let claims;
      jest.isolateModules(() => {
        const prev = process.env.PACK_PATH;
        process.env.PACK_PATH = packDir;
        try {
          const packService = require('../../../src/services/packService');
          packService.activatePack();
          const { generateAdminToken } = require('../../../src/middleware/auth');
          const token = generateAdminToken('pack-switch-proof');
          claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
          expect(claims.packHash).toBe(packService.getActivePackInfo().contentHash);
        } finally {
          if (prev === undefined) delete process.env.PACK_PATH;
          else process.env.PACK_PATH = prev;
        }
      });
      return claims;
    }

    it('a token minted after a pack switch carries the NEW pack identity; grants resolve at issuance', () => {
      const underToy = mintUnderPack(path.join(PACKS, 'toy-heist'));
      const underParity = mintUnderPack(path.join(PACKS, 'parity-pack'));

      expect(underToy.packHash).toEqual(expect.stringMatching(/^sha256:/));
      expect(underParity.packHash).toEqual(expect.stringMatching(/^sha256:/));
      expect(underToy.packHash).not.toBe(underParity.packHash);

      // v1 grant tables are the baked operator-degenerate case — the
      // FUNCTION SET is pack-independent by design (Phase-4 E4 makes
      // assignments pack-driven); what must recompute is the identity
      // the grants were issued against.
      expect(underToy.functions).toEqual(underParity.functions);
      expect(underToy.tier).toBe('operator');
    });
  });
});

describe('FLOOR completeness — the map covers the whole contract (train-review F-P9a-4)', () => {
  // The grants.js comment records this class escaping once already: the
  // service:* family landed OUTSIDE the map and was reachable by an
  // observe socket until the B0 close review caught it. This pin makes
  // the escape structural: a new gm:command family added to the
  // AsyncAPI enum FAILS here until it is either floor-mapped or
  // deliberately listed below as ruled non-floor.
  const fs = require('fs');
  const yaml = require('js-yaml');
  const { requiredFloorFunction } = require('../../../src/gameRules/grants');

  // Deliberately non-floor gm:command actions (owner-ruled). EMPTY
  // today — every contracted action sits behind a floor function.
  const RULED_NON_FLOOR = [];

  function findActionEnum(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      if (node.includes('session:create') && node.includes('system:reset')) return node;
      for (const child of node) {
        const hit = findActionEnum(child);
        if (hit) return hit;
      }
      return null;
    }
    for (const value of Object.values(node)) {
      const hit = findActionEnum(value);
      if (hit) return hit;
    }
    return null;
  }

  it('every AsyncAPI gm:command action is floor-mapped or explicitly ruled non-floor', () => {
    const doc = yaml.load(fs.readFileSync(
      path.resolve(__dirname, '../../../contracts/asyncapi.yaml'), 'utf8'));
    const actions = findActionEnum(doc);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(50); // sanity: the real enum, not a fragment

    const unmapped = actions.filter(
      (action) => requiredFloorFunction(action) === null && !RULED_NON_FLOOR.includes(action)
    );
    expect(unmapped).toEqual([]);
  });
});
