/**
 * Music Events — Contract Validation Tests (Schema-only, no server)
 *
 * Validates that music:* gm:command actions and the music service:state
 * domain payload conform to asyncapi.yaml. Pure schema validation — does
 * not exercise the actual command pipeline (covered by integration tests).
 */

const { validateWebSocketEvent } = require('../../helpers/contract-validator');

describe('Music — AsyncAPI contract', () => {
  describe('gm:command music:* actions', () => {
    const validatedActions = [
      'music:play',
      'music:pause',
      'music:stop',
      'music:next',
      'music:previous',
    ];

    it.each(validatedActions)('%s passes gm:command schema', (action) => {
      const cmd = {
        event: 'gm:command',
        data: { action, payload: {} },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(cmd, 'gm:command')).not.toThrow();
    });

    it('music:setVolume with volume payload validates', () => {
      const cmd = {
        event: 'gm:command',
        data: { action: 'music:setVolume', payload: { volume: 75 } },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(cmd, 'gm:command')).not.toThrow();
    });

    it('music:setShuffle with enabled payload validates', () => {
      const cmd = {
        event: 'gm:command',
        data: { action: 'music:setShuffle', payload: { enabled: true } },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(cmd, 'gm:command')).not.toThrow();
    });

    it('music:loadPlaylist with playlistId payload validates', () => {
      const cmd = {
        event: 'gm:command',
        data: { action: 'music:loadPlaylist', payload: { playlistId: 'all-tracks' } },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(cmd, 'gm:command')).not.toThrow();
    });
  });

  describe('service:state domain "music"', () => {
    it('full music state with playlists validates', () => {
      const ev = {
        event: 'service:state',
        data: {
          domain: 'music',
          state: {
            connected: true,
            state: 'playing',
            volume: 70,
            track: {
              file: 'a.mp3',
              title: 'Alpha',
              artist: 'OGRE',
              album: '',
              position: 12.5,
              duration: 180,
            },
            playlist: {
              id: 'all-tracks',
              name: 'All Tracks',
              position: 0,
              total: 66,
              shuffle: false,
              loop: true,
              crossfadeMs: 2000,
            },
            playlists: [
              { id: 'all-tracks', name: 'All Tracks', shuffle: false, loop: true, crossfadeMs: 2000, tracks: ['a.mp3'] },
            ],
            pausedByGameClock: false,
          },
        },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(ev, 'service:state')).not.toThrow();
    });

    it('minimal stopped music state validates', () => {
      const ev = {
        event: 'service:state',
        data: {
          domain: 'music',
          state: {
            connected: false,
            state: 'stopped',
            volume: 70,
            track: null,
            playlist: null,
            playlists: [],
            pausedByGameClock: false,
          },
        },
        timestamp: new Date().toISOString(),
      };
      expect(() => validateWebSocketEvent(ev, 'service:state')).not.toThrow();
    });
  });
});
