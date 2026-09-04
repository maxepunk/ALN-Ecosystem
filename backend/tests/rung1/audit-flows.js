#!/usr/bin/env node
/**
 * Rung-1 live-flow audit (CS.1): drives the RUNNING engine through the
 * real show chain and asserts against REAL external state — no mocks.
 *
 * The flagship chain: one player scan of a video token →
 *   scan route → video queue → the engine's own VLC plays →
 *   standing cue `attention-before-video` fires on video:loading →
 *   sound:play (real pw-play, null sink) + lighting role
 *   `video-playback` resolved through the SIMULATION PROFILE →
 *   real Home Assistant flips the witness register one-hot →
 *   video completes → `restore-after-video` flips it back to gameplay.
 *
 * Usage: node audit-flows.js   (engine.sh start first; reads env from
 * /tmp/rung1/env.sh values via ha-auth.json + defaults)
 * Exit 0 = every assertion passed.
 */
/* eslint-disable no-console */
const path = require('path');
const { io } = require('socket.io-client');

const RUNG1 = process.env.RUNG1_DIR || '/tmp/rung1';
const PORT = process.env.RUNG1_ENGINE_PORT || 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const HA = 'http://127.0.0.1:8123';
// Committed dev credential (backend/.env) — rung-1 is a local harness.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@LN-c0nn3ct';
const haToken = require(path.join(RUNG1, 'ha-auth.json')).access_token;

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function haWitnessState() {
  const res = await fetch(`${HA}/api/states`, {
    headers: { Authorization: `Bearer ${haToken}` },
  });
  const states = await res.json();
  const on = states
    .filter((s) => s.entity_id.startsWith('input_boolean.witness_'))
    .filter((s) => s.state === 'on')
    .map((s) => s.entity_id.replace('input_boolean.witness_', ''));
  return on.sort();
}

/** Poll until the witness register is exactly [role] (one-hot). */
async function awaitWitness(role, timeoutMs = 30000) {
  const want = JSON.stringify([role.replace(/-/g, '_')]);
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = JSON.stringify(await haWitnessState());
    if (last === want) return { ok: true, last };
    await sleep(500);
  }
  return { ok: false, last };
}

async function main() {
  // --- auth + socket ------------------------------------------------
  const authRes = await fetch(`${BASE}/api/admin/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const { token } = await authRes.json();
  record('admin auth', Boolean(token));

  const socket = io(BASE, {
    transports: ['websocket'],
    auth: {
      token, deviceId: 'rung1-audit', deviceType: 'gm', version: '1.0.0',
    },
  });

  const events = [];
  const syncFull = await new Promise((resolve, reject) => {
    socket.on('connect_error', (e) => reject(new Error(`connect: ${e.message}`)));
    socket.on('sync:full', (env) => resolve(env.data || env));
    socket.onAny((name, payload) => events.push({ name, payload, t: Date.now() }));
    setTimeout(() => reject(new Error('sync:full timeout')), 10000);
  });
  record('sync:full on connect', Boolean(syncFull),
    `pack=${syncFull?.pack?.packId ?? 'MISSING'}`);

  const health = syncFull.serviceHealth || {};
  const healthy = Object.entries(health)
    .filter(([, v]) => v.status === 'healthy').map(([k]) => k).sort();
  record('service health (7 real services)',
    ['audio', 'cueengine', 'gameclock', 'lighting', 'music', 'sound', 'vlc']
      .every((s) => healthy.includes(s)),
    `healthy: ${healthy.join(',')}`);

  function command(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const onAck = (env) => {
        const d = env.data || env;
        if (d.action !== action) return;
        socket.off('gm:command:ack', onAck);
        d.success ? resolve(d) : reject(new Error(`${action}: ${d.message}`));
      };
      socket.on('gm:command:ack', onAck);
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action, payload },
        timestamp: new Date().toISOString(),
      });
      setTimeout(() => {
        socket.off('gm:command:ack', onAck);
        reject(new Error(`${action}: ack timeout`));
      }, 8000);
    });
  }

  // --- session lifecycle -------------------------------------------
  await command('session:create', { name: 'rung1-audit', teams: [] });
  await command('session:start', {});
  record('session create + start', true);

  // --- GM lighting role through the profile to real HA -------------
  await command('lighting:scene:activate', { role: 'gameplay' });
  const w1 = await awaitWitness('gameplay', 15000);
  record('GM role activation flips real HA witness (one-hot)', w1.ok,
    `register=${w1.last}`);

  // --- flagship: player scan → video → standing cues → HA ----------
  const scanRes = await fetch(`${BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenId: 'kai001', deviceId: 'rung1-player', deviceType: 'player',
      timestamp: new Date().toISOString(),
    }),
  });
  record('player scan accepted (video token kai001)', scanRes.ok,
    `http ${scanRes.status}`);

  const w2 = await awaitWitness('video-playback', 20000);
  record('standing cue attention-before-video → witness video_playback',
    w2.ok, `register=${w2.last}`);

  const w3 = await awaitWitness('gameplay', 45000);
  record('video completed → restore-after-video → witness gameplay',
    w3.ok, `register=${w3.last}`);

  const cueFired = events.filter((e) => e.name === 'cue:fired')
    .map((e) => (e.payload.data || e.payload).cueId);
  record('cue:fired broadcasts observed',
    cueFired.includes('attention-before-video')
      && cueFired.includes('restore-after-video'),
    `fired: ${cueFired.join(',')}`);

  const vlcPlayed = events.some((e) => {
    if (e.name !== 'service:state') return false;
    const d = e.payload.data || e.payload;
    return d.domain === 'video'
      && d.state?.currentVideo?.tokenId === 'kai001'
      && ['playing', 'loading'].includes(d.state?.status);
  });
  record('engine VLC actually played kai001.mp4 (service:state)', vlcPlayed);

  // --- sound + music through real pipewire/MPD ---------------------
  await command('sound:play', { file: 'tension.wav' });
  record('sound:play tension.wav (real pw-play, null sink)', true);

  // MPD's pulse mixer attaches only while the output is OPEN, so
  // volume must follow play (audit finding: setvol while stopped →
  // MPD "All outputs are disabled" — the venue GM panel has the same
  // edge when the slider moves with music stopped).
  const { execFileSync } = require('child_process');
  execFileSync('mpc', ['add', 'rung1-silence.wav'],
    { env: { ...process.env, MPD_HOST: '/tmp/aln-mpd.sock' } });
  await command('music:play', {});
  await sleep(1500);
  await command('music:setVolume', { volume: 37 });
  record('music play + setVolume against engine-spawned MPD', true);
  await command('music:stop', {});

  await command('session:end', {});
  record('session end', true);

  socket.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  record('audit run', false, e.message);
  process.exit(1);
});
