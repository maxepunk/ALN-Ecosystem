/**
 * Music HTTP routes — OpenAPI contract validation (schema-only).
 */

const { validateHTTPResponse, validateHTTPRequest } = require('../../helpers/contract-validator');

describe('Music — OpenAPI contract', () => {
  describe('GET /api/music/tracks', () => {
    it('200 with full track shape validates', () => {
      const response = {
        status: 200,
        body: {
          tracks: [
            { file: 'a.mp3', title: 'Alpha', artist: 'OGRE', album: '', duration: 184 },
            { file: 'b.mp3', title: 'Beta',  artist: 'X',    album: 'Y', duration: 220 },
          ],
        },
      };
      expect(() => validateHTTPResponse(response, '/api/music/tracks', 'get', 200)).not.toThrow();
    });

    it('200 with empty array validates', () => {
      const response = { status: 200, body: { tracks: [] } };
      expect(() => validateHTTPResponse(response, '/api/music/tracks', 'get', 200)).not.toThrow();
    });

    it('503 error shape validates', () => {
      const response = {
        status: 503,
        body: { error: 'Music service not connected' },
      };
      expect(() => validateHTTPResponse(response, '/api/music/tracks', 'get', 503)).not.toThrow();
    });
  });

  describe('GET /api/music/playlists', () => {
    it('200 with playlist array validates', () => {
      const response = {
        status: 200,
        body: {
          playlists: [
            { id: 'all-tracks', name: 'All Tracks', shuffle: false, loop: true, crossfadeMs: 2000, tracks: ['a.mp3'] },
            { id: 'p2', name: 'Mood', description: 'chill', shuffle: true, loop: false, crossfadeMs: 1000, tracks: ['b.mp3', 'c.mp3'] },
          ],
        },
      };
      expect(() => validateHTTPResponse(response, '/api/music/playlists', 'get', 200)).not.toThrow();
    });
  });

  describe('PUT /api/music/playlists', () => {
    it('valid request body validates', () => {
      const body = {
        playlists: [
          { id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3'] },
        ],
      };
      expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).not.toThrow();
    });

    it('rejects body missing playlists array', () => {
      expect(() => validateHTTPRequest({ wrong: 'shape' }, '/api/music/playlists', 'put')).toThrow();
    });

    it('rejects playlist missing required fields', () => {
      const body = { playlists: [{ id: 'p1', name: 'P1' }] };
      expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).toThrow();
    });

    it('rejects crossfadeMs out of range', () => {
      const body = {
        playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: false, crossfadeMs: 10000, tracks: [] }],
      };
      expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).toThrow();
    });

    it('rejects tracks containing non-string', () => {
      const body = {
        playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: false, crossfadeMs: 0, tracks: [42] }],
      };
      expect(() => validateHTTPRequest(body, '/api/music/playlists', 'put')).toThrow();
    });

    it('200 response with {ok: true} validates', () => {
      const response = { status: 200, body: { ok: true } };
      expect(() => validateHTTPResponse(response, '/api/music/playlists', 'put', 200)).not.toThrow();
    });
  });
});
