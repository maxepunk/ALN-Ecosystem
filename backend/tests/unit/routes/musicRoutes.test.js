const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const express = require('express');
const createRouter = require('../../../src/routes/musicRoutes');
const { MusicService } = require('../../../src/services/musicService');

describe('musicRoutes — GET /tracks', () => {
  let app;
  let musicService;

  beforeEach(() => {
    musicService = {
      listAllTracks: jest.fn().mockResolvedValue([
        { file: 'a.mp3', title: 'A', artist: 'x', album: '', duration: 180 },
        { file: 'b.mp3', title: 'B', artist: 'y', album: 'Beta', duration: 220 },
      ]),
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
    musicService.listAllTracks = jest.fn().mockRejectedValue(new Error('Music service not connected'));
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(503);
  });

  it('returns 500 when listAllTracks throws other error', async () => {
    musicService.listAllTracks = jest.fn().mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('boom');
  });

  it('handles empty track list', async () => {
    musicService.listAllTracks = jest.fn().mockResolvedValue([]);
    const res = await request(app).get('/api/music/tracks');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toEqual([]);
  });
});

describe('musicRoutes — playlists', () => {
  let app;
  let musicService;
  let tmpDir;
  let plFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-routes-'));
    plFile = path.join(tmpDir, 'music-playlists.json');
    fs.writeFileSync(plFile, JSON.stringify({
      playlists: [
        { id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3'] },
      ],
    }));
    // Use a real MusicService so PUT atomic-write tests can verify on-disk state.
    musicService = new MusicService({ playlistFile: plFile });
    app = express();
    app.use(express.json());
    app.use('/api/music', createRouter({ musicService }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /playlists returns current file content', async () => {
    const res = await request(app).get('/api/music/playlists');
    expect(res.status).toBe(200);
    expect(res.body.playlists).toHaveLength(1);
    expect(res.body.playlists[0].id).toBe('p1');
  });

  it('GET /playlists returns 503 when no playlist file configured', async () => {
    musicService._playlistFile = null;
    const res = await request(app).get('/api/music/playlists');
    expect(res.status).toBe(503);
  });

  it('GET /playlists returns empty list on ENOENT', async () => {
    fs.rmSync(plFile);
    const res = await request(app).get('/api/music/playlists');
    expect(res.status).toBe(200);
    expect(res.body.playlists).toEqual([]);
  });

  it('PUT /playlists writes atomically', async () => {
    const newPl = {
      playlists: [
        { id: 'new', name: 'New', shuffle: true, loop: false, crossfadeMs: 0, tracks: ['x.mp3'] },
        { id: 'two', name: 'Two', description: 'second one', shuffle: false, loop: true, crossfadeMs: 500, tracks: [] },
      ],
    };
    const res = await request(app).put('/api/music/playlists').send(newPl);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const disk = JSON.parse(fs.readFileSync(plFile, 'utf8'));
    expect(disk.playlists).toHaveLength(2);
    expect(disk.playlists[0].id).toBe('new');
    expect(disk.playlists[1].description).toBe('second one');
  });

  it('PUT /playlists rejects when body is missing playlists array', async () => {
    const res = await request(app).put('/api/music/playlists').send({ not: 'right' });
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects playlist with non-string track', async () => {
    const bad = {
      playlists: [{ id: 'x', name: 'X', shuffle: false, loop: false, crossfadeMs: 0, tracks: [42] }],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects playlist missing required fields', async () => {
    const bad = {
      playlists: [{ id: 'x', name: 'X' }],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects crossfadeMs out of range', async () => {
    const bad = {
      playlists: [{ id: 'x', name: 'X', shuffle: false, loop: false, crossfadeMs: 10000, tracks: [] }],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects duplicate ids', async () => {
    const bad = {
      playlists: [
        { id: 'dup', name: 'A', shuffle: false, loop: false, crossfadeMs: 0, tracks: [] },
        { id: 'dup', name: 'B', shuffle: false, loop: false, crossfadeMs: 0, tracks: [] },
      ],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });

  it('PUT /playlists rejects absolute paths in tracks', async () => {
    const bad = {
      playlists: [{ id: 'x', name: 'X', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['/etc/passwd'] }],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/relative/i);
  });

  it('PUT /playlists rejects .. segments in tracks', async () => {
    const bad = {
      playlists: [{ id: 'x', name: 'X', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['../../etc/passwd'] }],
    };
    const res = await request(app).put('/api/music/playlists').send(bad);
    expect(res.status).toBe(400);
  });

  it('PUT /playlists returns 503 when no playlist file configured', async () => {
    musicService._playlistFile = null;
    const res = await request(app)
      .put('/api/music/playlists')
      .send({ playlists: [] });
    expect(res.status).toBe(503);
  });
});
