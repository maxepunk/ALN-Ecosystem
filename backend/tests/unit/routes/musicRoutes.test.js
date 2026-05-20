const request = require('supertest');
const express = require('express');
const createRouter = require('../../../src/routes/musicRoutes');

describe('musicRoutes — GET /tracks', () => {
  let app;
  let musicService;

  beforeEach(() => {
    musicService = {
      _mpd: {
        sendCommand: jest.fn(async () =>
          'file: a.mp3\nTitle: A\nArtist: x\nTime: 180\n' +
          'file: b.mp3\nTitle: B\nArtist: y\nAlbum: Beta\nTime: 220\n'
        ),
      },
    };
    app = express();
    app.use('/api/music', createRouter({ musicService }));
  });

  it('returns parsed track list', async () => {
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toEqual([
      { file: 'a.mp3', title: 'A', artist: 'x', album: '', duration: 180 },
      { file: 'b.mp3', title: 'B', artist: 'y', album: 'Beta', duration: 220 },
    ]);
  });

  it('returns 503 when music service not connected', async () => {
    musicService._mpd = null;
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(503);
  });

  it('returns 500 when sendCommand throws', async () => {
    musicService._mpd.sendCommand = jest.fn().mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('boom');
  });

  it('handles empty track list', async () => {
    musicService._mpd.sendCommand = jest.fn().mockResolvedValue('');
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toEqual([]);
  });
});
