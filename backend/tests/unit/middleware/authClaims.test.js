/**
 * B0 BS.1 — operator-tier claims + function-scoped middleware
 * (design r2 D-B0.3r2; one-auth §1/§5).
 *
 * Issuance mints the FULL O3 claim shape; verification REQUIRES
 * tier + function + audience — a decoded-but-unscoped token is never
 * enough (the red-team's S1 bypass class). Legacy-shape tokens fail
 * CLOSED (the in-memory token store empties on every restart, so no
 * live compat window exists).
 */

const jwt = require('jsonwebtoken');
const auth = require('../../../src/middleware/auth');
const { FLOOR_FUNCTIONS } = require('../../../src/gameRules/grants');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe('operator token claims (one-auth §1 full shape)', () => {
  it('generateAdminToken mints tier/class/deviceId/functions/packHash/aud', () => {
    const token = auth.generateAdminToken('GM_01');
    const decoded = jwt.decode(token);
    expect(decoded.tier).toBe('operator');
    expect(decoded['class']).toBe('staffed');
    expect(decoded.deviceId).toBe('GM_01');
    for (const f of FLOOR_FUNCTIONS) expect(decoded.functions).toContain(f);
    expect(decoded).toHaveProperty('packHash'); // null when packless — key present
    expect(decoded.aud).toBe('orchestrator');
    // Back-compat fields stay (existing consumers read role)
    expect(decoded.role).toBe('admin');
  });

  it('an aud override mints for that audience (the config-tool pair)', () => {
    const token = auth.generateAdminToken('tool', { aud: 'config-tool' });
    expect(jwt.decode(token).aud).toBe('config-tool');
  });
});

describe('requireFunction — fail-closed, audience-checked (S1/S4)', () => {
  it('401s with no Authorization header', () => {
    const mw = auth.requireFunction('observe');
    const res = mockRes();
    mw({ headers: {}, path: '/x', method: 'GET', ip: '::1' }, res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(401);
  });

  it('403s FORBIDDEN when the token lacks the required function — decode alone is never enough', () => {
    const token = auth.generateAdminToken('GM_01');
    const mw = auth.requireFunction('function-that-does-not-exist');
    const res = mockRes();
    mw({ headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' },
      res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('401s on an audience mismatch — a config-tool token never opens an orchestrator door (S4)', () => {
    const token = auth.generateAdminToken('tool', { aud: 'config-tool' });
    const mw = auth.requireFunction('session-lifecycle'); // default audience: orchestrator
    const res = mockRes();
    mw({ headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' },
      res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(401);
  });

  it('passes an operator token holding the function, attaching req.admin', () => {
    const token = auth.generateAdminToken('GM_01');
    const mw = auth.requireFunction('session-lifecycle');
    const req = { headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' };
    const res = mockRes();
    let passed = false;
    mw(req, res, () => { passed = true; });
    expect(passed).toBe(true);
    expect(req.admin.tier).toBe('operator');
    expect(req.admin.functions).toContain('session-lifecycle');
  });

  it('a foreign-signed token with perfect claims still fails — store membership stands (S1)', () => {
    const forged = jwt.sign(
      { id: 'x', role: 'admin', tier: 'operator', 'class': 'staffed', functions: [...FLOOR_FUNCTIONS] },
      'not-the-secret', { audience: 'orchestrator' });
    const mw = auth.requireFunction('session-lifecycle');
    const res = mockRes();
    mw({ headers: { authorization: `Bearer ${forged}` }, path: '/x', method: 'GET', ip: '::1' },
      res, () => { throw new Error('must not pass'); });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAdmin absorbed — operator tier REQUIRED, decode alone never enough (S1)', () => {
  it('passes a freshly minted operator token (today\'s consumers unbroken)', () => {
    const token = auth.generateAdminToken('GM_01');
    const req = { headers: { authorization: `Bearer ${token}` }, path: '/x', method: 'GET', ip: '::1' };
    const res = mockRes();
    let passed = false;
    auth.requireAdmin(req, res, () => { passed = true; });
    expect(passed).toBe(true);
  });
});
