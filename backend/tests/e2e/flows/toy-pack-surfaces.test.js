/**
 * E2E: the toy pack is the SECOND display-surfaces consumer (A3 slice 6).
 *
 * Proves the pack→client delivery of the `surfaces` block through the exact
 * channel scoreboard.html consumes (`GET /api/pack/files/game.json` at init):
 * the toy declares an idle-loop OPT-OUT (surfaces.idleLoop: null) and a
 * DIFFERENT evidence cadence (evidenceCycleMs 9000 vs ALN's 18000), and both
 * reach the served game.json verbatim. This is the "each pack drives a
 * different scoreboard param + the toy's opt-out" proof (design §5 S6.3).
 *
 * The ENFORCEMENT sides are unit-proven and capability-gated at runtime:
 *   - idle-loop opt-out → vlcMprisService (needs VLC; SKIPS on VLC-less runners)
 *   - scoreboard opt-out refusal → displayControlService unit tests
 * so this flow asserts the always-available DELIVERY seam, not the VLC path.
 *
 * @group display-surfaces
 * @group toy-pack
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const https = require('https');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { connectWithAuth, disconnectSocket } = require('../../helpers/websocket-core');
const { ADMIN_PASSWORD } = require('../helpers/test-config');

const TOY_PACK = path.resolve(__dirname, '../fixtures/packs/toy-heist');

/** GET a JSON path from the orchestrator (self-signed cert tolerated). */
function getJson(orchestratorUrl, urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${orchestratorUrl}${urlPath}`, {
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('request timeout')); });
  });
}

test.describe('Toy pack — display surfaces (second consumer)', () => {
  let orchestratorInfo = null;

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 60000,
      packPath: TOY_PACK,
    });
  });

  test.afterAll(async () => {
    await stopOrchestrator();
    await clearSessionData();
  });

  test('the toy pack ACTIVATES with a surfaces block (a second surfaces consumer)', async () => {
    // Reaching an authenticated GM connection at all proves the activation
    // gate accepted a second pack declaring `surfaces` + surfaces.select.
    const socket = await connectWithAuth(
      orchestratorInfo.url, ADMIN_PASSWORD, `TOY_SURF_${Date.now()}`, 'gm'
    );
    try {
      expect(socket.connected).toBe(true);
    } finally {
      disconnectSocket(socket);
    }
  });

  test('the served game.json carries the toy surfaces verbatim — the channel scoreboard.html reads', async () => {
    const { status, json } = await getJson(orchestratorInfo.url, '/api/pack/files/game.json');
    expect(status).toBe(200);
    expect(json.surfaces).toBeTruthy();
    // Opt-out declaration reaches the client (Q6-1): idleLoop null.
    expect(json.surfaces.idleLoop).toBeNull();
    // A DIFFERENT evidence cadence than ALN's 18000 (Q6-3) — scoreboard.html's
    // applyScoreboardSurface() reads exactly this path.
    expect(json.surfaces.scoreboard.evidenceCycleMs).toBe(9000);
  });
});
