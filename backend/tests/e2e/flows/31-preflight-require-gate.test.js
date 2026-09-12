/**
 * E2E: the require gate refuses a start, and the typed override gets past it
 * (Block 2 T1a D14, DoD f)
 *
 * The toy-heist-require pack marks `lighting.instruments` as
 * `onAbsent: require`, and the pinned profile does not install it. A
 * session must not start into that: "required" has to mean something or
 * the word is decoration. But the GM may know something the profile does
 * not, so there is a way past — and its price is typing WHY, once, into a
 * record that outlives the night.
 *
 * The pack directory IS the pack's identity (same packId and contentHash
 * as toy-heist — only the onAbsent word differs), so this flow pins it per
 * call and runs on every Tier L leg.
 *
 * @group show-control
 * @group toy-pack
 * @group dormancy
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const https = require('https');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { connectWithAuth, disconnectSocket } = require('../../helpers/websocket-core');
const { sendGMCommand } = require('../helpers/gm-command');

const REQUIRE_PACK = path.resolve(__dirname, '../fixtures/packs/toy-heist-require');
const DORMANT_PROFILE = path.resolve(__dirname, '../fixtures/profiles/toy-dormant-lighting.json');

const PINS = { https: true, timeout: 60000, packPath: REQUIRE_PACK, profilePath: DORMANT_PROFILE };

/** GET /api/session (self-signed cert tolerated). */
function getSession(orchestratorUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${orchestratorUrl}/api/session`, {
      rejectUnauthorized: false, timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('session probe timeout')); });
  });
}

test.describe('Preflight — the require gate', () => {
  let orchestratorInfo = null;

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator(PINS);
  });

  test.afterEach(async () => {
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator(PINS);
  });

  test.afterAll(async () => {
    await stopOrchestrator();
    await clearSessionData();
  });

  test('session:start is REFUSED with NO-GO and the session stays in setup', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Require Night', teams: [] });

    const ack = await sendGMCommand(orchestratorInfo.url, 'session:start', {});

    expect(ack.data.success).toBe(false);
    expect(ack.data.message).toMatch(/^NO-GO: /);
    expect(ack.data.message).toContain("required endpoint 'lighting.instruments' not installed at this venue");

    const session = await getSession(orchestratorInfo.url);
    expect(session.status).toBe('setup');
    expect(session.metadata.preflight.status).toBe('no-go');
    expect(session.metadata.preflight.blocking).toEqual([
      "required endpoint 'lighting.instruments' not installed at this venue",
    ]);
    expect(session.metadata.preflightOverride).toBeNull();
  });

  test('startAnyway without a reason is refused — a click-through is not an override', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Require Night', teams: [] });

    const ack = await sendGMCommand(orchestratorInfo.url, 'session:start', { startAnyway: true });

    expect(ack.data.success).toBe(false);
    expect(ack.data.message).toBe('startAnyway requires a reason');
    expect((await getSession(orchestratorInfo.url)).status).toBe('setup');
  });

  test('a typed reason starts the game and is stamped with who said it', async () => {
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Require Night', teams: [] });

    // Send this one on a socket whose deviceId we know, so the stamp's
    // attribution can be checked rather than merely asserted non-null.
    const deviceId = `OVERRIDE_GM_${Date.now()}`;
    const socket = await connectWithAuth(orchestratorInfo.url, ADMIN_PASSWORD, deviceId, 'gm');
    let ack;
    try {
      const { waitForEvent } = require('../../helpers/websocket-core');
      const ackPromise = waitForEvent(socket, 'gm:command:ack',
        (a) => a?.data?.action === 'session:start', 10000);
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:start', payload: { startAnyway: true, reason: 'e2e override' } },
        timestamp: new Date().toISOString(),
      });
      ack = await ackPromise;
    } finally {
      disconnectSocket(socket);
    }

    expect(ack.data.success).toBe(true);

    const session = await getSession(orchestratorInfo.url);
    expect(session.status).toBe('active');
    expect(session.metadata.preflightOverride).toMatchObject({
      reason: 'e2e override',
      blocking: ["required endpoint 'lighting.instruments' not installed at this venue"],
      byDeviceId: deviceId,
      byTier: 'operator',
    });
    expect(typeof session.metadata.preflightOverride.at).toBe('string');
  });
});
