// B0 BS.3 s1 — tool login + auth enforcement (design r2 D-B0.2r2 /
// D-B0.3r2).
//
// The tool gains a login: password → an OPERATOR token with
// aud 'config-tool' (the full O3 claim shape, grants via the engine's
// own pure algebra), verified header-borne on API calls. Enforcement:
// mutating routes require auth ALWAYS (even on loopback); read routes
// join them when the tool is bound beyond loopback. The aud pair is
// NOT interchangeable — an orchestrator-aud token never passes the
// tool's gate.
//
// Password/secret parity: the tool reads the SAME backend/.env the
// backend reads, with the backend's exact defaults — one password,
// both doors.

'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');

const { ToolAuth } = require('../lib/toolAuth');

const SECRET = 'test-secret-for-tool-auth';

describe('toolAuth', () => {
  let tmpDir, envPath, auth;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-toolauth-test-'));
    envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, `ADMIN_PASSWORD=venue-pass\nJWT_SECRET=${SECRET}\n`);
    auth = new ToolAuth({ envPath });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('login', () => {
    it('mints an operator token with aud config-tool and the full O3 claim shape', () => {
      const { token, expiresIn } = auth.login('venue-pass');
      assert.strictEqual(expiresIn, 86400);
      const decoded = jwt.verify(token, SECRET, { audience: 'config-tool' });
      assert.strictEqual(decoded.tier, 'operator');
      assert.strictEqual(decoded.class, 'staffed');
      assert.ok(Array.isArray(decoded.functions));
      for (const fn of ['session-lifecycle', 'show-control', 'score-intervention']) {
        assert.ok(decoded.functions.includes(fn), `missing floor function ${fn}`);
      }
    });

    it('refuses a wrong password', () => {
      assert.throws(() => auth.login('wrong'), /password|auth/i);
    });

    it('mirrors the backend defaults when .env lacks the keys (one password, both doors)', () => {
      fs.writeFileSync(envPath, 'PORT=3000\n');
      const bare = new ToolAuth({ envPath });
      const { token } = bare.login('admin');
      const decoded = jwt.verify(token, 'change-this-secret-in-production',
        { audience: 'config-tool' });
      assert.strictEqual(decoded.tier, 'operator');
    });
  });

  describe('verify', () => {
    it('accepts its own token; refuses an orchestrator-aud token signed with the SAME secret', () => {
      const { token } = auth.login('venue-pass');
      assert.ok(auth.verify(token));

      const orchToken = jwt.sign(
        { tier: 'operator', class: 'staffed', functions: [] },
        SECRET, { audience: 'orchestrator', expiresIn: '1h' });
      assert.strictEqual(auth.verify(orchToken), null);
    });

    it('refuses garbage and expired tokens', () => {
      assert.strictEqual(auth.verify('not-a-jwt'), null);
      const expired = jwt.sign(
        { tier: 'operator', class: 'staffed' },
        SECRET, { audience: 'config-tool', expiresIn: '-1s' });
      assert.strictEqual(auth.verify(expired), null);
    });
  });

  describe('exposure guard (B0 close review)', () => {
    it('names each live default credential as a problem; a configured .env is exposable', () => {
      assert.deepStrictEqual(auth.exposureProblems(), []);

      fs.writeFileSync(envPath, 'PORT=3000\n');
      const bare = new ToolAuth({ envPath });
      const problems = bare.exposureProblems();
      assert.strictEqual(problems.length, 2);
      assert.ok(problems.some((p) => /JWT_SECRET/.test(p)));
      assert.ok(problems.some((p) => /ADMIN_PASSWORD/.test(p)));
    });
  });

  describe('the orchestrator half of the aud pair (D-B0.3r2)', () => {
    // Obtained FROM the backend's /api/admin/auth at login (so it lives
    // in the backend's revocable store) and held SERVER-SIDE for the
    // music proxy — never sent to the browser.
    afterEach(() => { delete global.fetch; });

    it('login fetches and caches the backend operator token when the orchestrator is up', async () => {
      let seenBody = null;
      global.fetch = async (url, opts) => {
        assert.match(url, /\/api\/admin\/auth$/);
        seenBody = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ token: 'orch-token', expiresIn: 86400 }) };
      };
      const withOrch = new ToolAuth({ envPath, orchestratorUrl: 'https://orch:3000' });
      const app = express();
      app.use(express.json());
      app.post('/api/auth/login', withOrch.loginHandler());
      await request(app).post('/api/auth/login').send({ password: 'venue-pass' }).expect(200);
      assert.strictEqual(withOrch.getOrchestratorToken(), 'orch-token');
      assert.strictEqual(seenBody.password, 'venue-pass');
    });

    it('login still succeeds when the orchestrator is down; the proxy token stays null', async () => {
      global.fetch = async () => { throw new Error('ECONNREFUSED'); };
      const withOrch = new ToolAuth({ envPath, orchestratorUrl: 'https://orch:3000' });
      const app = express();
      app.use(express.json());
      app.post('/api/auth/login', withOrch.loginHandler());
      const res = await request(app).post('/api/auth/login')
        .send({ password: 'venue-pass' }).expect(200);
      assert.ok(res.body.token);
      assert.strictEqual(withOrch.getOrchestratorToken(), null);
    });
  });

  describe('enforcement wiring (server.js shape)', () => {
    // Mirror the server wiring: login open, then the gate on EVERYTHING
    // (D-B0.2r2 — reads included, loopback included; the accepted S8
    // objection), then a stand-in API surface.
    function buildApp() {
      const app = express();
      app.use(express.json());
      app.post('/api/auth/login', auth.loginHandler());
      app.use('/api', auth.enforce());
      app.get('/api/config', (req, res) => res.json({ ok: true }));
      app.put('/api/config/env', (req, res) => res.json({ success: true }));
      return app;
    }

    it('POST /api/auth/login returns a token for the right password, 401 for wrong', async () => {
      const app = buildApp();
      const ok = await request(app).post('/api/auth/login')
        .send({ password: 'venue-pass' }).expect(200);
      assert.ok(ok.body.token);
      await request(app).post('/api/auth/login')
        .send({ password: 'nope' }).expect(401);
    });

    it('EVERY route requires the token — reads and writes alike (r2)', async () => {
      const app = buildApp();
      await request(app).get('/api/config').expect(401);
      await request(app).put('/api/config/env').send({ PORT: '1' }).expect(401);

      const { body } = await request(app).post('/api/auth/login')
        .send({ password: 'venue-pass' }).expect(200);
      await request(app).get('/api/config')
        .set('Authorization', `Bearer ${body.token}`).expect(200);
      await request(app).put('/api/config/env')
        .set('Authorization', `Bearer ${body.token}`)
        .send({ PORT: '1' }).expect(200);
    });

    it('an orchestrator-aud token never passes the tool gate (the pair is not interchangeable)', async () => {
      const app = buildApp();
      const orchToken = jwt.sign(
        { tier: 'operator', class: 'staffed', functions: [] },
        SECRET, { audience: 'orchestrator', expiresIn: '1h' });
      await request(app).put('/api/config/env')
        .set('Authorization', `Bearer ${orchToken}`)
        .send({ PORT: '1' }).expect(401);
    });
  });
});
