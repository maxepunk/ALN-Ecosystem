jest.mock('mpd2', () => {
  const { EventEmitter } = require('events');
  class MockMpdClient extends EventEmitter {
    constructor() {
      super();
      this._connected = true;
      this.sendCommand = jest.fn().mockResolvedValue('');
      this.sendCommands = jest.fn().mockResolvedValue([]);
      this.disconnect = jest.fn(async () => { this._connected = false; });
    }
  }
  return { connect: jest.fn(async () => new MockMpdClient()) };
});

const mpd2 = require('mpd2');
const registry = require('../../../src/services/serviceHealthRegistry');
const { MusicService } = require('../../../src/services/musicService');

// resetMocks: true in jest.config.base.js wipes mock implementations
// between tests, so we must re-establish the mpd2.connect impl here.
beforeEach(() => {
  jest.spyOn(registry, 'report').mockImplementation(() => {});
  mpd2.connect.mockImplementation(async () => {
    const { EventEmitter } = require('events');
    const client = new EventEmitter();
    client._connected = true;
    client.sendCommand = jest.fn().mockResolvedValue('');
    client.sendCommands = jest.fn().mockResolvedValue([]);
    client.disconnect = jest.fn(async () => { client._connected = false; });
    return client;
  });
});

describe('MusicService — construction', () => {
  let service;
  beforeEach(() => {
    service = new MusicService();
  });

  it('has correct initial state', () => {
    expect(service.getState()).toEqual({
      connected: false,
      state: 'stopped',
      volume: 70,
      track: null,
      playlist: null,
      pausedByGameClock: false,
    });
  });

  it('getState returns a defensive copy', () => {
    const snap = service.getState();
    snap.state = 'mutated';
    expect(service.getState().state).toBe('stopped');
  });
});

describe('MusicService — lifecycle', () => {
  let service;

  beforeEach(() => {
    service = new MusicService();
  });

  it('init() connects mpd2 and reports healthy', async () => {
    await service.init();
    expect(mpd2.connect).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/mpd\.sock$/),
    }));
    expect(service.connected).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('music', 'healthy', expect.any(String));
  });

  it('init() handles connection failure', async () => {
    mpd2.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await service.init();
    expect(service.connected).toBe(false);
    expect(registry.report).toHaveBeenCalledWith('music', 'down', expect.stringContaining('ECONNREFUSED'));
  });

  it('cleanup() disconnects and clears state', async () => {
    await service.init();
    await service.cleanup();
    expect(service.connected).toBe(false);
  });

  it('checkConnection() pings via ping command', async () => {
    await service.init();
    const ok = await service.checkConnection();
    expect(ok).toBe(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('ping');
  });

  it('checkConnection() returns false on failure', async () => {
    await service.init();
    service._mpd.sendCommand = jest.fn().mockRejectedValue(new Error('socket closed'));
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });

  it('checkConnection() returns false when not initialized', async () => {
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });
});

describe('MusicService — transports', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('play() sends "play"', async () => {
    await service.play();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
  });

  it('pause() sends "pause 1"', async () => {
    await service.pause();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('pause 1');
  });

  it('stop() sends "stop"', async () => {
    await service.stop();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('stop');
  });

  it('next() sends "next"', async () => {
    await service.next();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('next');
  });

  it('previous() sends "previous"', async () => {
    await service.previous();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('previous');
  });

  it('transports throw when not connected', async () => {
    await service.cleanup();
    await expect(service.play()).rejects.toThrow(/not connected/i);
  });
});

describe('MusicService — settings', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('setVolume(50) rounds and sends "setvol 50"', async () => {
    await service.setVolume(50);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('setvol 50');
  });

  it('setVolume(50.7) rounds to 51', async () => {
    await service.setVolume(50.7);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('setvol 51');
  });

  it('setVolume rejects out-of-range values', async () => {
    await expect(service.setVolume(-1)).rejects.toThrow(/range/i);
    await expect(service.setVolume(101)).rejects.toThrow(/range/i);
  });

  it('setVolume rejects non-numeric values', async () => {
    await expect(service.setVolume('loud')).rejects.toThrow(/invalid/i);
    await expect(service.setVolume(NaN)).rejects.toThrow(/invalid/i);
  });

  it('setShuffle(true) sends "random 1"', async () => {
    await service.setShuffle(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('random 1');
  });

  it('setShuffle(false) sends "random 0"', async () => {
    await service.setShuffle(false);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('random 0');
  });

  it('setLoop(true) sends "repeat 1"', async () => {
    await service.setLoop(true);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('repeat 1');
  });

  it('setLoop(false) sends "repeat 0"', async () => {
    await service.setLoop(false);
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('repeat 0');
  });
});

const FIXTURE_PLAYLISTS = [
  { id: 'p1', name: 'Test One', shuffle: false, loop: true, crossfadeMs: 2000, tracks: ['a.mp3', 'b.mp3', 'c.mp3'] },
  { id: 'p2', name: 'Test Two', shuffle: true, loop: false, crossfadeMs: 0, tracks: ['x.mp3'] },
];

describe('MusicService — loadPlaylist', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    service._playlists = new Map(FIXTURE_PLAYLISTS.map(p => [p.id, p]));
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
    service._mpd.sendCommands = jest.fn().mockResolvedValue([]);
  });

  it('loads playlist, sets crossfade/random/repeat, clears, adds tracks, plays', async () => {
    await service.loadPlaylist('p1');
    const calls = service._mpd.sendCommands.mock.calls[0][0];
    expect(calls).toEqual([
      'crossfade 2',
      'random 0',
      'repeat 1',
      'clear',
      'add "a.mp3"',
      'add "b.mp3"',
      'add "c.mp3"',
      'play',
    ]);
  });

  it('emits playlist:changed with the loaded playlist info', async () => {
    const handler = jest.fn();
    service.on('playlist:changed', handler);
    await service.loadPlaylist('p1');
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p1',
      name: 'Test One',
      total: 3,
      shuffle: false,
      loop: true,
      crossfadeMs: 2000,
      position: 0,
    }));
  });

  it('rejects unknown playlist id', async () => {
    await expect(service.loadPlaylist('nope')).rejects.toThrow(/unknown.*nope/i);
  });

  it('escapes quotes and backslashes in track filenames', async () => {
    service._playlists.set('special', {
      id: 'special', name: 'X', shuffle: false, loop: false, crossfadeMs: 0,
      tracks: ['has "quote".mp3', 'back\\slash.mp3'],
    });
    await service.loadPlaylist('special');
    const calls = service._mpd.sendCommands.mock.calls[0][0];
    expect(calls).toContain('add "has \\"quote\\".mp3"');
    expect(calls).toContain('add "back\\\\slash.mp3"');
  });

  it('handles 0ms crossfade as "crossfade 0"', async () => {
    await service.loadPlaylist('p2');
    const calls = service._mpd.sendCommands.mock.calls[0][0];
    expect(calls[0]).toBe('crossfade 0');
    expect(calls[1]).toBe('random 1');
    expect(calls[2]).toBe('repeat 0');
  });
});
