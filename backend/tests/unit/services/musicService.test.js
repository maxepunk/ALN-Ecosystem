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
const { TimeoutError } = require('../../../src/utils/withTimeout');

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

  it('checkConnection() reports music healthy on a successful ping', async () => {
    // Regression: the 0523game incident. A system:reset marks music 'down' in
    // the health registry while the mpd2 client stays alive. The 15s
    // revalidation then pings successfully — but if the ping-success path does
    // not re-report 'healthy', music stays 'down' forever and commandExecutor's
    // SERVICE_DEPENDENCIES gate silently rejects every music:* command.
    // Every other service's health check reports BOTH directions; music must too.
    await service.init();
    registry.report.mockClear(); // drop init()'s 'healthy' call so we observe checkConnection alone
    const ok = await service.checkConnection();
    expect(ok).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('music', 'healthy', expect.any(String));
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
    // Two sendCommand calls (NOT sendCommands — see _handlePlayerEvent for the why)
    service._mpd.sendCommand = jest.fn()
      .mockResolvedValueOnce('state: playing\nsong: 0\nelapsed: 12.5\nduration: 180\n')
      .mockResolvedValueOnce('file: a.mp3\nTitle: Alpha\nArtist: Test\nAlbum: TestA\n');

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
  });

  it('updates playlist.position from status.song when playlist is loaded', async () => {
    service.playlist = { id: 'p1', name: 'P1', position: 0, total: 5, shuffle: false, loop: false, crossfadeMs: 0 };
    service._mpd.sendCommand = jest.fn()
      .mockResolvedValueOnce('state: playing\nsong: 3\nelapsed: 5\nduration: 180\n')
      .mockResolvedValueOnce('file: c.mp3\nTitle: C\nArtist: x\n');
    service._mpd.emit('system-player');
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    expect(service.playlist.position).toBe(3);
  });

  // Anti-confidence regression: real MPD returns raw protocol strings
  // (`play`/`pause`/`stop`), not the canonical names. The unit tests above
  // mock with canonical names which masked a bug found in E2E — pauseForGameClock
  // and the frontend MusicRenderer all compare against `'playing'`, so raw
  // `'play'` silently failed every check. The MPD_STATE_MAP normalization
  // in _handlePlayerEvent is the fix; this test locks it in.
  it.each([
    ['play', 'playing'],
    ['pause', 'paused'],
    ['stop', 'stopped'],
  ])('normalizes raw MPD state "%s" → canonical "%s"', async (raw, canonical) => {
    service._mpd.sendCommand = jest.fn()
      .mockResolvedValueOnce(`state: ${raw}\n`)
      .mockResolvedValueOnce('');
    const handler = jest.fn();
    service.on('playback:changed', handler);
    service._mpd.emit('system-player');
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    expect(service.state).toBe(canonical);
    if (canonical !== 'stopped') {
      expect(handler).toHaveBeenCalledWith({ state: canonical });
    }
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

  it('playlist file: skips structurally invalid entries (no id / no tracks array)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-test-'));
    const plFile = path.join(tmpDir, 'music-playlists.json');
    // Mixture: valid, missing id, missing tracks array, null, non-object — only the valid one survives
    fs.writeFileSync(plFile, JSON.stringify({
      playlists: [
        { id: 'good', name: 'Good', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['a.mp3'] },
        { name: 'NoId', tracks: [] },              // line 124 branch: missing id
        { id: 'NoTracks' },                        // line 124 branch: missing tracks
        null,                                      // line 124 branch: falsy entry
      ],
    }));
    const s = new MusicService({ playlistFile: plFile });
    await s.init();
    try {
      const loaded = s.getPlaylists();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('good');
    } finally {
      await s.cleanup();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('playlist file: tolerates a parsed object with no `playlists` key (uses || [] fallback)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-music-test-'));
    const plFile = path.join(tmpDir, 'music-playlists.json');
    fs.writeFileSync(plFile, JSON.stringify({ otherKey: 'x' })); // no playlists array
    const s = new MusicService({ playlistFile: plFile });
    await s.init();
    try {
      expect(s.getPlaylists()).toEqual([]);
    } finally {
      await s.cleanup();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('cleanup() is safe to call without init() (no _mpd to disconnect)', async () => {
    const s = new MusicService(); // never initted, _mpd is null
    await expect(s.cleanup()).resolves.toBeUndefined();
    expect(s.connected).toBe(false);
  });

  it('loadPlaylist rejects a playlist whose tracks is not an array (defensive guard)', async () => {
    service._playlists.set('bad-tracks', { id: 'bad-tracks', name: 'Bad', shuffle: false, loop: false, crossfadeMs: 0, tracks: 'not-an-array' });
    await expect(service.loadPlaylist('bad-tracks')).rejects.toThrow(/no tracks array/i);
  });

  it('loadPlaylist rejects a playlist with a non-string track entry (defensive guard)', async () => {
    service._playlists.set('bad-track', { id: 'bad-track', name: 'Bad', shuffle: false, loop: false, crossfadeMs: 0, tracks: ['ok.mp3', 42, 'also-ok.mp3'] });
    await expect(service.loadPlaylist('bad-track')).rejects.toThrow(/non-string tracks/i);
  });

  it('_quoteMpdArg rejects MPD-control characters (newline / CR / NUL)', () => {
    expect(() => service._quoteMpdArg('safe.mp3')).not.toThrow();
    expect(() => service._quoteMpdArg('bad\nfile.mp3')).toThrow(/invalid character/i);
    expect(() => service._quoteMpdArg('bad\rfile.mp3')).toThrow(/invalid character/i);
    expect(() => service._quoteMpdArg('bad\x00file.mp3')).toThrow(/invalid character/i);
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
      mpdRuntimeDir: tmpDir,
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
    expect(cfg).toContain('name           "aln-music"');
    expect(cfg).not.toContain('application_name');
  });

  it('creates playlist directory under the MPD runtime dir', async () => {
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

  it('ProcessMonitor "exited" event flips this.connected to false', async () => {
    service.connected = true;
    await service.spawnMpd();
    expect(service._procMon).toBeDefined();
    // The spawnMpd handler registers an 'exited' listener; firing it
    // should drop us out of healthy state regardless of why MPD died.
    service._procMon.emit('exited', { code: 1, signal: 'SIGKILL' });
    expect(service.connected).toBe(false);
  });

  it('ProcessMonitor "exited" event also reports "down" to health registry', async () => {
    // Without this, commandExecutor's SERVICE_DEPENDENCIES gate keeps
    // dispatching music:* commands to a dead MPD because health remains
    // 'healthy' from the original successful init.
    await service.spawnMpd();
    registry.report.mockClear();  // wipe any spawn-time noise

    service._procMon.emit('exited', { code: 137, signal: 'SIGKILL' });
    expect(registry.report).toHaveBeenCalledWith(
      'music',
      'down',
      expect.stringContaining('SIGKILL')
    );
  });

  it('ProcessMonitor "exited" event drops the stale mpd2 client', async () => {
    // After exit, the existing _mpd handle points at the dead instance.
    // checkConnection's reactive reconnect needs _mpd to be null to fire,
    // so the exit handler must clear it.
    await service.init();
    expect(service._mpd).toBeDefined();
    // Need a _procMon to test the exit handler — spawnMpd installs both.
    await service.spawnMpd();
    service._procMon.emit('exited', { code: 0, signal: null });
    expect(service._mpd).toBeNull();
  });
});

describe('MusicService — reset', () => {
  it('reset() clears state without disconnecting MPD', () => {
    const service = new MusicService();
    service.connected = true;
    service.state = 'playing';
    service.volume = 50;
    service.track = { file: 'x.mp3', title: 'X' };
    service.playlist = { id: 'a', name: 'A', position: 2, total: 5 };
    service._pausedByGameClock = true;
    service.reset();
    expect(service.state).toBe('stopped');
    expect(service.volume).toBe(70);
    expect(service.track).toBe(null);
    expect(service.playlist).toBe(null);
    expect(service._pausedByGameClock).toBe(false);
  });
});

// Regression guard: 2026-05-22 incident — MPD working files (pid/db/log/state/m3u)
// were placed inside config.storage.dataDir, causing node-persist's
// expiredKeysInterval to crash every ~2 min on the non-JSON files.
// spawnMpd() must refuse to spawn when _mpdRuntimeDir overlaps persistence.
describe('MusicService — node-persist isolation guard', () => {
  let tmpRoot;
  let musicDir;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aln-guard-test-'));
    musicDir = path.join(tmpRoot, 'music');
    fs.mkdirSync(musicDir);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('refuses to spawn MPD when mpdRuntimeDir equals persistence dataDir', async () => {
    const config = require('../../../src/config');
    const bad = new MusicService({ mpdRuntimeDir: config.storage.dataDir, musicDir });
    await expect(bad.spawnMpd()).rejects.toThrow(/must not be inside persistence dataDir/);
  });

  it('refuses to spawn MPD when mpdRuntimeDir is nested inside persistence dataDir', async () => {
    const config = require('../../../src/config');
    const nested = path.join(config.storage.dataDir, 'some-subdir');
    const bad = new MusicService({ mpdRuntimeDir: nested, musicDir });
    await expect(bad.spawnMpd()).rejects.toThrow(/must not be inside persistence dataDir/);
  });

  it('singleton exported by musicService.js does not violate the invariant', () => {
    const config = require('../../../src/config');
    const singleton = require('../../../src/services/musicService');
    const persistAbs = path.resolve(config.storage.dataDir);
    const mpdAbs = path.resolve(singleton._mpdRuntimeDir);
    expect(mpdAbs).not.toBe(persistAbs);
    expect(mpdAbs.startsWith(persistAbs + path.sep)).toBe(false);
  });
});

describe('MusicService — bounded I/O (_send)', () => {
  it('passes a normal command through and resolves', async () => {
    const service = new MusicService({ opTimeoutMs: 50 });
    await service.init();
    service._mpd.sendCommand.mockResolvedValue('OK');
    await expect(service.play()).resolves.toBeDefined();
    expect(service._mpd.sendCommand).toHaveBeenCalledWith('play');
  });

  it('rejects with TimeoutError and drops the client when a command hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {})); // never settles

    await expect(service.play()).rejects.toBeInstanceOf(TimeoutError);

    expect(service._mpd).toBeNull();          // shared ref dropped
    expect(service.connected).toBe(false);
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('timed out'));
    expect(wedged.disconnect).toHaveBeenCalled(); // dead client cleaned up
  });

  it('does not tear down a client that was already replaced (same-reference guard)', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {}));

    const p = service.play();                 // captures `wedged`
    // Simulate checkConnection reconnecting a fresh client mid-flight:
    const fresh = { sendCommand: jest.fn().mockResolvedValue(''), disconnect: jest.fn() };
    service._mpd = fresh;

    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    expect(service._mpd).toBe(fresh);         // fresh client preserved
    expect(fresh.disconnect).not.toHaveBeenCalled();
  });

  it('loadPlaylist times out cleanly when sendCommands hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    service._playlists = new Map([['p1', { id: 'p1', name: 'P1', tracks: ['a.mp3'] }]]);
    service._mpd.sendCommands.mockImplementation(() => new Promise(() => {}));
    await expect(service.loadPlaylist('p1')).rejects.toBeInstanceOf(TimeoutError);
    expect(service._mpd).toBeNull();
  });

  // F-SHOW-11: the idle handlers are the highest-frequency mpd2 round-trips
  // in the system. Raw sendCommand calls hang forever on a desynced client
  // and never tear it down — they must ride the same _send chokepoint.
  it('_handlePlayerEvent routes through _send — wedged client torn down (F-SHOW-11)', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {})); // never settles

    wedged.emit('system-player');
    await new Promise(r => setTimeout(r, 80));

    expect(service._mpd).toBeNull();          // shared ref dropped
    expect(service.connected).toBe(false);
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('timed out'));
  });

  it('_handleMixerEvent routes through _send — wedged client torn down (F-SHOW-11)', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    const wedged = service._mpd;
    wedged.sendCommand.mockImplementation(() => new Promise(() => {}));

    wedged.emit('system-mixer');
    await new Promise(r => setTimeout(r, 80));

    expect(service._mpd).toBeNull();
    expect(service.connected).toBe(false);
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('timed out'));
  });
});

describe('MusicService — checkConnection recovery', () => {
  it('reports down and drops the client when ping hangs', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    const reportSpy = jest.spyOn(registry, 'report');
    service._mpd.sendCommand.mockImplementation(() => new Promise(() => {})); // ping hangs

    const ok = await service.checkConnection();

    expect(ok).toBe(false);
    expect(service._mpd).toBeNull();
    expect(reportSpy).toHaveBeenCalledWith('music', 'down', expect.stringContaining('ping'));
  });

  it('reconnects a fresh client on the next check after a drop', async () => {
    const service = new MusicService({ opTimeoutMs: 20 });
    await service.init();
    service._mpd = null;          // simulate post-drop state
    service.connected = false;

    const ok = await service.checkConnection(); // hits the !this._mpd reconnect branch

    expect(ok).toBe(true);
    expect(service._mpd).not.toBeNull();
    expect(service.connected).toBe(true);
  });
});

describe('MusicService — listAllTracks', () => {
  it('parses listallinfo output into track metadata (covers the _send arrow + parseListAllInfo)', async () => {
    const service = new MusicService({ opTimeoutMs: 50 });
    await service.init();
    service._mpd.sendCommand.mockResolvedValue(
      'file: 001 - Song.mp3\nTitle: Song\nArtist: Artist\nAlbum: Album\nTime: 180\n' +
      'file: 002 - Two.mp3\nTitle: Two\nTime: 90\n'
    );

    const tracks = await service.listAllTracks();

    expect(service._mpd.sendCommand).toHaveBeenCalledWith('listallinfo');
    expect(tracks).toEqual([
      { file: '001 - Song.mp3', title: 'Song', artist: 'Artist', album: 'Album', duration: 180 },
      { file: '002 - Two.mp3', title: 'Two', artist: '', album: '', duration: 90 },
    ]);
  });
});
