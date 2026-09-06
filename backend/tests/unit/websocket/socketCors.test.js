/**
 * Train-review P4-1 — the Socket.io CORS origin check must accept the
 * same origins as the HTTP CORS check in app.js. The two regexes
 * diverged on `.local` mDNS hostnames: a GM scanner or scoreboard page
 * loaded from https://<name>.local got a working HTTP surface and a
 * SILENTLY rejected WebSocket handshake — and .env.example documents
 * .local as auto-allowed.
 */

const http = require('http');
const { createSocketServer } = require('../../../src/websocket/socketServer');

describe('Socket.io CORS origin check (P4-1)', () => {
  let io;
  let originFn;

  beforeAll(() => {
    io = createSocketServer(http.createServer());
    originFn = io.opts.cors.origin;
    expect(typeof originFn).toBe('function');
  });

  afterAll(() => {
    io.close();
  });

  const accepts = (origin) =>
    new Promise((resolve) => originFn(origin, (err, ok) => resolve(!err && ok === true)));

  it.each([
    'https://aln-pi.local:3000',
    'http://aln-pi.local',
    'https://my-kit-2.local:3000',
    'https://localhost:3000',
    'https://192.168.1.100:3000',
    'https://10.0.0.177:3000',
  ])('accepts %s (parity with the HTTP CORS regex)', async (origin) => {
    expect(await accepts(origin)).toBe(true);
  });

  it.each([
    'https://evil.example.com',
    'https://aln-pi.local.evil.example.com',
  ])('still refuses %s', async (origin) => {
    expect(await accepts(origin)).toBe(false);
  });
});
