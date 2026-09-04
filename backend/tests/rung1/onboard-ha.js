#!/usr/bin/env node
/**
 * Onboards the rung-1 Home Assistant (or logs into an already
 * onboarded one) entirely via its REST API and writes the auth state
 * the engine needs. Recipe proven 2026-09-04 (research doc): the
 * onboarding `integration` step REQUIRES redirect_uri, and
 * /api/onboarding 404s once onboarding completes, so readiness and
 * mode detection use /auth/providers.
 *
 * Usage: node onboard-ha.js <rung1Dir>
 * Writes: <rung1Dir>/ha-auth.json {access_token, refresh_token}
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.HA_URL || 'http://127.0.0.1:8123';
const CID = BASE + '/';
const USER = 'rung1';
const PASS = 'rung1-harness-password';
const rung1Dir = process.argv[2];
if (!rung1Dir) {
  console.error('usage: onboard-ha.js <rung1Dir>');
  process.exit(2);
}

async function jpost(p, data, { form = false, tok = null } = {}) {
  const body = form
    ? new URLSearchParams(data).toString()
    : JSON.stringify(data);
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: {
      'Content-Type': form
        ? 'application/x-www-form-urlencoded'
        : 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`${p} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function main() {
  // Fresh instance? /api/onboarding serves 200 pre-onboarding only.
  const ob = await fetch(BASE + '/api/onboarding');
  let code;
  if (ob.ok) {
    const steps = await ob.json();
    const userDone = steps.find((s) => s.step === 'user')?.done;
    if (!userDone) {
      ({ auth_code: code } = await jpost('/api/onboarding/users', {
        client_id: CID, name: USER, username: USER,
        password: PASS, language: 'en',
      }));
    }
  }
  if (!code) {
    // Already has a user: login flow.
    const flow = await jpost('/auth/login_flow', {
      client_id: CID, handler: ['homeassistant', null],
      redirect_uri: CID,
    });
    const res = await jpost(`/auth/login_flow/${flow.flow_id}`, {
      client_id: CID, username: USER, password: PASS,
    });
    code = res.result;
  }
  const tokens = await jpost('/auth/token', {
    grant_type: 'authorization_code', code, client_id: CID,
  }, { form: true });

  // Finish remaining onboarding steps (integration NEEDS redirect_uri).
  const ob2 = await fetch(BASE + '/api/onboarding');
  if (ob2.ok) {
    for (const s of await ob2.json()) {
      if (s.done) continue;
      const payload = s.step === 'integration'
        ? { client_id: CID, redirect_uri: CID }
        : {};
      await jpost(`/api/onboarding/${s.step}`, payload, {
        tok: tokens.access_token,
      }).catch((e) => console.error(`onboarding ${s.step}: ${e.message}`));
    }
  }

  fs.writeFileSync(
    path.join(rung1Dir, 'ha-auth.json'),
    JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    }, null, 2) + '\n'
  );
  console.log('ha-auth.json written');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
