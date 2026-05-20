const fs = require('fs');
const os = require('os');
const path = require('path');

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

  it('checkConnection() reconnects when _mpd is null but service not stopped', async () => {
    // The 15s health revalidation calls checkConnection — it must recover
    // from a startup race where init() ran before MPD's socket was ready.
    expect(service._mpd).toBeUndefined();
    const ok = await service.checkConnection();
    expect(ok).toBe(true);
    expect(service._mpd).toBeDefined();
    expect(service.connected).toBe(true);
  });

  it('checkConnection() returns false after cleanup() (stopped)', async () => {
    await service.init();
    await service.cleanup();
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
  });

  it('checkConnection() drops the client and returns false when ping rejects', async () => {
    await service.init();
    service._mpd.sendCommand = jest.fn().mockRejectedValue(new Error('broken pipe'));
    const ok = await service.checkConnection();
    expect(ok).toBe(false);
    expect(service._mpd).toBeNull();
    expect(service.connected).toBe(false);
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

describe('MusicService — game clock', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
    service._mpd.sendCommand = jest.fn().mockResolvedValue('');
  });

  it('pauseForGameClock pauses when playing and sets the flag', async () => {
    service.state = 'playing';
    await service.pauseForGameClock();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('pause 1');
    expect(service._pausedByGameClock).toBe(true);
  });

  it('pauseForGameClock no-op when not playing', async () => {
    service.state = 'paused';
    await service.pauseForGameClock();
    expect(service._mpd.sendCommand).not.toHaveBeenCalled();
    expect(service._pausedByGameClock).toBe(false);
  });

  it('resumeFromGameClock resumes only if paused-by-clock flag is set', async () => {
    service._pausedByGameClock = true;
    await service.resumeFromGameClock();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
    expect(service._pausedByGameClock).toBe(false);
  });

  it('resumeFromGameClock no-op when paused by user (flag false)', async () => {
    service._pausedByGameClock = false;
    service.state = 'paused';
    await service.resumeFromGameClock();
    expect(service._mpd.sendCommand).not.toHaveBeenCalled();
  });
});

describe('MusicService — idle events', () => {
  let service;
  beforeEach(async () => {
    service = new MusicService();
    await service.init();
  });

  it('on "system-player" event, emits playback:changed and track:changed', async () => {
    service._mpd.sendCommand = jest.fn(async (cmd) => {
      if (cmd === 'status') return 'state: playing\nsong: 0\nelapsed: 12.5\nduration: 180\n';
      if (cmd === 'currentsong') return 'file: a.mp3\nTitle: Alpha\nArtist: Test\nAlbum: TestA\n';
      return '';
    });

    const playbackHandler = jest.fn();
    const trackHandler = jest.fn();
    service.on('playback:changed', playbackHandler);
    service.on('track:changed', trackHandler);

    service._mpd.emit('system-player');
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));

    expect(playbackHandler).toHaveBeenCalledWith({ state: 'playing' });
    expect(trackHandler).toHaveBeenCalledWith({
      track: {
        file: 'a.mp3',
        title: 'Alpha',
        artist: 'Test',
        album: 'TestA',
        position: 12.5,
        duration: 180,
      },
    });
    expect(service.state).toBe('playing');
    expect(service.track.title).toBe('Alpha');
    service._stopPositionPolling();
  });

  it('on "system-mixer" event, emits volume:changed when volume changes', async () => {
    service._mpd.sendCommand = jest.fn().mockResolvedValue('volume: 55\n');
    const handler = jest.fn();
    service.on('volume:changed', handler);
    service._mpd.emit('system-mixer');
    await new Promise(r => setImmediate(r));
    expect(handler).toHaveBeenCalledWith({ volume: 55 });
    expect(service.volume).toBe(55);
  });

  it('on "system-mixer" event, does NOT emit if volume unchanged', async () => {
    service._mpd.sendCommand = jest.fn().mockResolvedValue('volume: 70\n');
    const handler = jest.fn();
    service.on('volume:changed', handler);
    service._mpd.emit('system-mixer');
    await new Promise(r => setImmediate(r));
    expect(handler).not.toHaveBeenCalled();
  });

  it('starts position polling when state transitions to playing', async () => {
    jest.useFakeTimers();
    try {
      service._mpd.sendCommand = jest.fn(async (cmd) => {
        if (cmd === 'status') return 'state: playing\nsong: 0\nelapsed: 30\nduration: 180\n';
        if (cmd === 'currentsong') return 'file: a.mp3\nTitle: A\nArtist: x\n';
        return '';
      });
      service._mpd.emit('system-player');
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      const callsAfterEvent = service._mpd.sendCommand.mock.calls.length;
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(service._mpd.sendCommand.mock.calls.length).toBeGreaterThan(callsAfterEvent);
      service._stopPositionPolling();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops position polling when state leaves playing', async () => {
    jest.useFakeTimers();
    try {
      service._mpd.sendCommand = jest.fn(async (cmd) => {
        if (cmd === 'status') return 'state: paused\nelapsed: 30\nduration: 180\n';
        return 'file: a.mp3\nTitle: A\n';
      });
      service._startPositionPolling();
      service._stopPositionPolling();
      const callsBefore = service._mpd.sendCommand.mock.calls.length;
      jest.advanceTimersByTime(2000);
      expect(service._mpd.sendCommand.mock.calls.length).toBe(callsBefore);
    } finally {
      jest.useRealTimers();
    }
  });

  it('playlist file: loads playlists on init', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-'));
    const plFile = path.join(tmpDir, 'music-playlists.json');
    fs.writeFileSync(plFile, JSON.stringify({
      playlists: [
        { id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 1000, tracks: ['a.mp3'] },
        { id: 'p2', name: 'P2', shuffle: true, loop: false, crossfadeMs: 0, tracks: ['b.mp3', 'c.mp3'] },
      ],
    }));
    const s = new MusicService({ playlistFile: plFile });
    await s.init();
    try {
      expect(s.getPlaylists()).toHaveLength(2);
      expect(s.getPlaylists()[0].id).toBe('p1');
      expect(s.getPlaylist('p2').tracks).toEqual(['b.mp3', 'c.mp3']);
    } finally {
      await s.cleanup();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('playlist file: reloads playlists when file changes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-'));
    const plFile = path.join(tmpDir, 'music-playlists.json');
    fs.writeFileSync(plFile, JSON.stringify({
      playlists: [{ id: 'p1', name: 'P1', shuffle: false, loop: true, crossfadeMs: 0, tracks: [] }],
    }));
    const s = new MusicService({ playlistFile: plFile });
    await s.init();
    try {
      expect(s.getPlaylists()).toHaveLength(1);
      fs.writeFileSync(plFile, JSON.stringify({
        playlists: [{ id: 'new', name: 'New', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['z.mp3'] }],
      }));
      await new Promise(r => setTimeout(r, 250));
      expect(s.getPlaylists()).toHaveLength(1);
      expect(s.getPlaylists()[0].id).toBe('new');
    } finally {
      await s.cleanup();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('playlist file: gracefully handles missing file', async () => {
    const s = new MusicService({ playlistFile: '/nonexistent/path/music-playlists.json' });
    await s.init();
    try {
      expect(s.getPlaylists()).toEqual([]);
    } finally {
      await s.cleanup();
    }
  });

  it('clears track when no file is playing', async () => {
    service.track = { file: 'old.mp3', title: 'Old', artist: '', album: '', position: 0, duration: 0 };
    service._mpd.sendCommand = jest.fn(async (cmd) => {
      if (cmd === 'status') return 'state: stopped\n';
      if (cmd === 'currentsong') return '';
      return '';
    });
    const trackHandler = jest.fn();
    service.on('track:changed', trackHandler);
    service._mpd.emit('system-player');
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    expect(service.track).toBe(null);
    expect(trackHandler).toHaveBeenCalledWith({ track: null });
  });
});

jest.mock('../../../src/utils/processMonitor', () => {
  const { EventEmitter } = require('events');
  // Use a real class so resetMocks doesn't strip the constructor body.
  // We also expose a calls log on the constructor itself for assertion.
  class MockProcessMonitor extends EventEmitter {
    constructor(opts) {
      super();
      this._opts = opts;
      this.start = jest.fn();
      this.stop = jest.fn();
      MockProcessMonitor._instances.push(this);
      MockProcessMonitor._lastOpts = opts;
    }
  }
  MockProcessMonitor._instances = [];
  MockProcessMonitor._lastOpts = null;
  return MockProcessMonitor;
});

describe('MusicService — spawnMpd', () => {
  let service;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-mpd-test-'));
    const musicDir = path.join(tmpDir, 'music');
    fs.mkdirSync(musicDir);
    service = new MusicService({
      socketPath: path.join(tmpDir, 'mpd.sock'),
      configFile: path.join(tmpDir, 'mpd.conf'),
      musicDir,
      dataDir: tmpDir,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the MPD config file with absolute paths', async () => {
    await service.spawnMpd();
    expect(fs.existsSync(path.join(tmpDir, 'mpd.conf'))).toBe(true);
    const cfg = fs.readFileSync(path.join(tmpDir, 'mpd.conf'), 'utf8');
    expect(cfg).toContain(`music_directory   "${path.join(tmpDir, 'music')}"`);
    expect(cfg).toContain(`bind_to_address   "${path.join(tmpDir, 'mpd.sock')}"`);
    expect(cfg).toContain('application_name "aln-music"');
  });

  it('creates playlist directory under dataDir', async () => {
    await service.spawnMpd();
    expect(fs.existsSync(path.join(tmpDir, 'aln-mpd-playlists'))).toBe(true);
  });

  it('starts a ProcessMonitor for mpd', async () => {
    const ProcessMonitor = require('../../../src/utils/processMonitor');
    await service.spawnMpd();
    expect(ProcessMonitor._lastOpts).toMatchObject({
      command: 'mpd',
      label: 'mpd',
      pidFile: '/tmp/aln-pm-mpd.pid',
    });
    expect(ProcessMonitor._lastOpts.args).toContain('--no-daemon');
    expect(service._procMon.start).toHaveBeenCalled();
  });

  it('refuses to spawn without musicDir', async () => {
    const bad = new MusicService({ socketPath: '/tmp/x.sock' });
    await expect(bad.spawnMpd()).rejects.toThrow(/musicDir/);
  });
});

describe('MusicService — reset', () => {
  it('reset() clears state and stops timers without disconnecting MPD', () => {
    const service = new MusicService();
    service.connected = true;
    service.state = 'playing';
    service.volume = 50;
    service.track = { file: 'x.mp3', title: 'X' };
    service.playlist = { id: 'a', name: 'A', position: 2, total: 5 };
    service._pausedByGameClock = true;
    service._positionTimer = setInterval(() => {}, 1000);
    const stopSpy = jest.spyOn(service, '_stopPositionPolling');
    service.reset();
    expect(stopSpy).toHaveBeenCalled();
    expect(service.state).toBe('stopped');
    expect(service.volume).toBe(70);
    expect(service.track).toBe(null);
    expect(service.playlist).toBe(null);
    expect(service._pausedByGameClock).toBe(false);
  });
});
