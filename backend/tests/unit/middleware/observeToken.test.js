/**
 * B0 BS.1 — the scoreboard observe token (design r2 D-B0.3r2; one-auth
 * §3 'display' row; red-team S1/S8).
 *
 * A device-tier, display-class token with exactly ['observe'], minted
 * per page serve into an INDEPENDENT store: it never enters
 * adminTokens, so every HTTP gate refuses it at 401 (S1 — the
 * unauthenticated /scoreboard serve must never become an issuance
 * oracle for anything requireAdmin/requireFunction accepts), and
 * flushing the observe store never kills a GM session (S8).
 */

const jwt = require('jsonwebtoken');
const auth = require('../../../src/middleware/auth');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('observe token — claims and store separation', () => {
  it('mints tier device / class display / functions exactly [observe]', () => {
    const token = auth.generateObserveToken('SCOREBOARD');
    const decoded = jwt.decode(token);
    expect(decoded.tier).toBe('device');
    expect(decoded['class']).toBe('display');
    expect(decoded.functions).toEqual(['observe']);
    expect(decoded.deviceId).toBe('SCOREBOARD');
    expect(decoded.aud).toBe('orchestrator');
    expect(decoded).toHaveProperty('packHash');
    // NEVER role admin — nothing downstream may mistake it (S1).
    expect(decoded.role).toBeUndefined();
  });

  it('requireAdmin 401s an observe token — it is not in the admin store and not operator tier', () => {
    const token = auth.generateObserveToken('SCOREBOARD');
    const res = mockRes();
    auth.requireAdmin(
      { headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' },
      res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(401);
  });

  it("requireFunction('observe') ALSO 401s it — HTTP is closed to the display class entirely", () => {
    const token = auth.generateObserveToken('SCOREBOARD');
    const res = mockRes();
    auth.requireFunction('observe')(
      { headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' },
      res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(401);
  });

  it('verifyObserveToken accepts a minted observe token and returns its claims', () => {
    const token = auth.generateObserveToken('SCOREBOARD');
    const claims = auth.verifyObserveToken(token);
    expect(claims).not.toBeNull();
    expect(claims.tier).toBe('device');
    expect(claims.functions).toEqual(['observe']);
  });

  it('verifyObserveToken REJECTS an operator token — the stores never cross', () => {
    const admin = auth.generateAdminToken('GM_01');
    expect(auth.verifyObserveToken(admin)).toBeNull();
  });

  it('verifyObserveToken rejects a forged token with perfect claims', () => {
    const forged = jwt.sign(
      { tier: 'device', 'class': 'display', functions: ['observe'], deviceId: 'SCOREBOARD' },
      'not-the-secret', { audience: 'orchestrator' });
    expect(auth.verifyObserveToken(forged)).toBeNull();
  });

  it('flushing observe tokens never touches a live GM session (S8 rotation)', () => {
    const observe = auth.generateObserveToken('SCOREBOARD');
    const admin = auth.generateAdminToken('GM_01');
    auth.invalidateObserveTokens();
    expect(auth.verifyObserveToken(observe)).toBeNull();
    expect(auth.verifyToken(admin)).not.toBeNull();
  });

  it('the store is CAPPED: the mint rides an unauthenticated serve, so beyond the cap the oldest entry is evicted (B0 close review)', () => {
    auth.invalidateObserveTokens();
    const first = auth.generateObserveToken('TV_FIRST');
    for (let i = 0; i < 500; i++) {
      auth.generateObserveToken(`TV_${i}`);
    }
    // A LAN curl loop can churn tokens but never grow the heap: the
    // earliest mint has been evicted, the newest still verifies.
    expect(auth.verifyObserveToken(first)).toBeNull();
    const latest = auth.generateObserveToken('TV_LATEST');
    expect(auth.verifyObserveToken(latest)).not.toBeNull();
    auth.invalidateObserveTokens();
  });
});
