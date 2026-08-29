/**
 * E2E: toy pack drives role-addressed lighting (A3 slice 4 S5, D-4.8)
 *
 * The toy pack is the SECOND cue consumer: this flow proves the whole
 * role mechanism generic — a pack that is not ALN declares lighting
 * roles, an installation profile binds them, and a fired cue reaches a
 * REAL Home Assistant scene through the resolver.
 *
 * Capability-gated on lighting (requireCapabilities — SKIPS LOUDLY on
 * HA-less runners), so the slice gate does NOT rest on this flow: the
 * always-on proof is tests/integration/lighting-role-resolution.test.js.
 *
 * HA scene ids are MACHINE STATE (the HA Docker volume — never in git),
 * so the profile used here is written AT RUNTIME: the flow discovers a
 * real scene from the running system, binds the toy role to it in a
 * temp profile, and restarts the orchestrator with that profile pinned
 * per-call through the S5 profilePath seam (the packPath analog).
 *
 * @group show-control
 * @group toy-pack
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { startOrchestrator, stopOrchestrator, clearSessionData } = require('../setup/test-server');
const { getCapabilities, requireCapabilities, formatManifest } = require('../helpers/capabilities');
const { ADMIN_PASSWORD } = require('../helpers/test-config');
const { connectWithAuth, waitForEvent, disconnectSocket } = require('../../helpers/websocket-core');

const TOY_PACK = path.resolve(__dirname, '../fixtures/packs/toy-heist');
const STATIC_PROFILE = path.resolve(__dirname, '../fixtures/profiles/toy-test-rig.json');

/** Send one gm:command over a temporary socket (07d-04 idiom). */
async function sendGMCommand(orchestratorUrl, action, payload = {}) {
  const deviceId = `TOY_CMD_${Date.now()}`;
  const socket = await connectWithAuth(orchestratorUrl, ADMIN_PASSWORD, deviceId, 'gm');
  try {
    const ackPromise = waitForEvent(socket, 'gm:command:ack',
      (ack) => ack?.data?.action === action, 10000);
    socket.emit('gm:command', {
      event: 'gm:command',
      data: { action, payload },
      timestamp: new Date().toISOString()
    });
    return await ackPromise;
  } finally {
    disconnectSocket(socket);
  }
}

/** GET /api/state (self-signed cert tolerated). */
function getState(orchestratorUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${orchestratorUrl}/api/state`, {
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('state probe timeout')); });
  });
}

test.describe('Toy pack — role-addressed lighting (second consumer)', () => {
  let orchestratorInfo = null;
  let caps = null;
  let tmpProfileDir = null;

  test.beforeAll(async () => {
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 60000,
      packPath: TOY_PACK,
      profilePath: STATIC_PROFILE,
    });
    caps = await getCapabilities(orchestratorInfo.url);
    console.log(`Capability manifest: ${formatManifest(caps)}`);
    tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-toy-profile-'));
  });

  test.afterAll(async () => {
    await stopOrchestrator();
    await clearSessionData();
    if (tmpProfileDir) fs.rmSync(tmpProfileDir, { recursive: true, force: true });
  });

  test('the toy pack ACTIVATES with cues and exposes both quick-fire summaries', async () => {
    // Reaching here at all proves the gate accepted a second cues-bearing
    // pack. The summaries prove the engine loaded them from the pack.
    const socket = await connectWithAuth(
      orchestratorInfo.url, ADMIN_PASSWORD, `TOY_SYNC_${Date.now()}`, 'gm'
    );
    try {
      // connectWithAuth resolves AFTER the connect-time sync:full and
      // stashes it on socket.initialSync (websocket-core).
      const sync = socket.initialSync;
      const cues = (sync.data || sync).cueEngine?.cues || [];
      const ids = cues.map(c => c.id).sort();
      expect(ids).toEqual(['heist-sting', 'vault-alarm-hit']);
      expect(cues.every(c => c.quickFire)).toBe(true);
    } finally {
      disconnectSocket(socket);
    }
  });

  test('a toy role bound to a REAL discovered HA scene fires end-to-end with zero failed commands', async () => {
    requireCapabilities(test, caps, ['lighting']);

    // 1. Discover a real scene from the running system (machine state).
    await sendGMCommand(orchestratorInfo.url, 'lighting:scenes:refresh');
    const state = await getState(orchestratorInfo.url);
    const scenes = state.lighting?.scenes || [];
    expect(scenes.length, 'HA reported no scenes — cannot bind a role').toBeGreaterThan(0);
    const realSceneId = scenes[0].id;
    console.log(`Discovered HA scene: ${realSceneId}`);

    // 2. Bind the toy role to it in a runtime profile; restart with the
    //    profile pinned per-call (the S5 seam under test).
    const runtimeProfile = path.join(tmpProfileDir, 'runtime-rig.json');
    fs.writeFileSync(runtimeProfile, JSON.stringify({
      kind: 'installation-profile',
      schemaVersion: 1,
      profileId: 'toy-runtime-rig',
      forPack: 'midnight-heist',
      orchestrator: true,
      bindings: { lighting: { 'vault-alarm': { ha: realSceneId } } },
    }));
    await stopOrchestrator();
    await clearSessionData();
    orchestratorInfo = await startOrchestrator({
      https: true,
      timeout: 60000,
      packPath: TOY_PACK,
      profilePath: runtimeProfile,
    });

    // 3. A session must be ACTIVE for the cue engine to fire.
    await sendGMCommand(orchestratorInfo.url, 'session:create', { name: 'Toy Roles', teams: [] });
    await sendGMCommand(orchestratorInfo.url, 'session:start', {});

    // 4. Fire the lighting cue and observe the full lifecycle. The S3
    //    failure-visibility fix means a bad resolution would surface as
    //    cue:error / failedCommands — an empty failure set IS the proof
    //    the role resolved and the real scene activated.
    const observer = await connectWithAuth(
      orchestratorInfo.url, ADMIN_PASSWORD, `TOY_OBSERVER_${Date.now()}`, 'gm'
    );
    try {
      const errors = [];
      observer.on('cue:error', (e) => errors.push(e));
      const completedPromise = waitForEvent(observer, 'cue:completed',
        (e) => e?.data?.cueId === 'vault-alarm-hit', 15000);

      const ack = await sendGMCommand(orchestratorInfo.url, 'cue:fire', { cueId: 'vault-alarm-hit' });
      expect(ack.data.success).toBe(true);

      const completed = await completedPromise;
      expect(completed.data.failedCommands || []).toEqual([]);
      expect(completed.data.completedCommands).toEqual([
        { action: 'lighting:scene:activate' },
      ]);
      expect(errors).toEqual([]);
      console.log(`Toy role 'vault-alarm' drove ${realSceneId} through the resolver — second consumer proven`);
    } finally {
      disconnectSocket(observer);
    }
  });
});
