/**
 * App-shell behavior: the express middleware app.js assembles around the
 * routes — CORS origin policy and the ESP32 parse-failed contract. These
 * live in app.js itself (not any router), so they get their own suite.
 */

const request = require('supertest');
const app = require('../../../src/app');

describe('App shell (app.js middleware)', () => {
  describe('CORS origin policy', () => {
    it('allows a configured origin (corsOrigins list)', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('allows any localhost origin under NODE_ENV=test (dynamic port allocation)', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://localhost:9999');
      expect(res.headers['access-control-allow-origin']).toBe('https://localhost:9999');
    });

    it('allows RFC1918 local-network origins (venue LAN scanners)', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://192.168.1.50:8443');
      expect(res.headers['access-control-allow-origin']).toBe('https://192.168.1.50:8443');
    });

    it('rejects a public internet origin', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.example.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Not allowed by CORS');
    });
  });

  describe('unparseable JSON bodies (ESP32 queue-clearing contract)', () => {
    it('returns 200 PARSE_FAILED so the scanner discards the entry instead of retrying forever', async () => {
      const res = await request(app)
        .post('/api/scan')
        .set('Content-Type', 'application/json')
        .send('{"tokenId": "kaa001", "deviceId":'); // truncated JSON
      expect(res.status).toBe(200);
      expect(res.body.error).toBe('PARSE_FAILED');
    });
  });
});
