/**
 * Unit tests for VLC MPRIS Service
 * Tests D-Bus MPRIS interface for VLC video playback control.
 *
 * Replaces vlcService.test.js (HTTP-based) with MPRIS-based tests.
 * VlcMprisService extends MprisPlayerBase with VLC-specific behavior:
 *   - Static destination (org.mpris.MediaPlayer2.vlc)
 *   - Video lifecycle events (video:played, video:stopped, etc.)
 *   - Backward-compatible getStatus() shape (0-256 volume, 0.0-1.0 position ratio)
 *   - state:changed events with {previous, current} delta format
 *   - Idle loop management
 */

const EventEmitter = require('events');

jest.mock('child_process');

describe('VlcMprisService', () => {
  let vlcMprisService, execFile, execFileSync, spawn, registry;

  function mockExecFileSuccess(stdout = '') {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, stdout, '');
    });
  }

  function mockExecFileError(message) {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error(message), '', '');
    });
  }

  function createMockSpawnProc() {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    proc.pid = 77777;
    return proc;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const cp = require('child_process');
    execFile = cp.execFile;
    execFileSync = cp.execFileSync;
    spawn = cp.spawn;
    spawn.mockImplementation(() => createMockSpawnProc());
    vlcMprisService = require('../../../src/services/vlcMprisService');
    registry = require('../../../src/services/serviceHealthRegistry');
    vlcMprisService.reset();
    // Pre-seed healthy for command tests
    registry.report('vlc', 'healthy');
  });

  afterEach(() => {
    vlcMprisService.cleanup();
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('should configure static destination org.mpris.MediaPlayer2.vlc', () => {
      expect(vlcMprisService._destination).toBe('org.mpris.MediaPlayer2.vlc');
    });

    it('should set VLC label and health service ID', () => {
      expect(vlcMprisService._label).toBe('VLC');
      expect(vlcMprisService._healthServiceId).toBe('vlc');
    });

    it('should use 100ms signal debounce (less chatty than Spotify)', () => {
      expect(vlcMprisService._signalDebounceMs).toBe(100);
    });
  });

  // ── Init ──

  describe('init', () => {
    beforeEach(() => {
      // Mock VLC process spawn to prevent side effects
      vlcMprisService._spawnVlcProcess = jest.fn();
      vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(true);
      vlcMprisService._resolveOwner = jest.fn().mockResolvedValue(undefined);
    });

    it('should spawn VLC process and wait for D-Bus', async () => {
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);
      await vlcMprisService.init();

      expect(vlcMprisService._spawnVlcProcess).toHaveBeenCalled();
      expect(vlcMprisService._waitForVlcReady).toHaveBeenCalled();
    });

    it('should start playback monitor', async () => {
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);
      await vlcMprisService.init();

      expect(spawn).toHaveBeenCalledWith(
        'dbus-monitor',
        expect.arrayContaining(['--session', '--monitor']),
        expect.any(Object)
      );
    });

    it('should handle connection failure gracefully', async () => {
      vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(false);
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);
      await vlcMprisService.init();

      // Monitor starts regardless — catches when VLC is ready
      expect(spawn).toHaveBeenCalled();
    });
  });

  // ── playVideo ──

  describe('playVideo', () => {
    beforeEach(() => {
      mockExecFileSuccess('');
    });

    it('should call MPRIS OpenUri with file:// prefix for bare filename', async () => {
      await vlcMprisService.playVideo('test-video.mp4');

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.mpris.MediaPlayer2.Player.OpenUri',
          expect.stringContaining('file://'),
        ]),
        expect.any(Object),
        expect.any(Function)
      );
      // The file:// URI should include the video filename
      const openUriCall = execFile.mock.calls.find(
        c => c[1].includes('org.mpris.MediaPlayer2.Player.OpenUri')
      );
      const uriArg = openUriCall[1].find(a => a.startsWith('string:file://'));
      expect(uriArg).toContain('test-video.mp4');
    });

    it('should convert relative path starting with /', async () => {
      await vlcMprisService.playVideo('/videos/test.mp4');

      const openUriCall = execFile.mock.calls.find(
        c => c[1].includes('org.mpris.MediaPlayer2.Player.OpenUri')
      );
      const uriArg = openUriCall[1].find(a => a.startsWith('string:file://'));
      expect(uriArg).toContain('/public/videos/test.mp4');
    });

    it('should pass through http:// URLs unchanged', async () => {
      await vlcMprisService.playVideo('http://example.com/video.mp4');

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.mpris.MediaPlayer2.Player.OpenUri',
          'string:http://example.com/video.mp4',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should pass through file:// URLs unchanged', async () => {
      await vlcMprisService.playVideo('file:///absolute/path/video.mp4');

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'string:file:///absolute/path/video.mp4',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should disable loop before playing', async () => {
      const callMethods = [];
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callMethods.push(args[5]); // method is at index 5 in _buildDbusArgs output
        cb(null, '', '');
      });

      await vlcMprisService.playVideo('test.mp4');

      // setLoop(false) → Properties.Set must come BEFORE OpenUri
      const setIdx = callMethods.findIndex(m => m === 'org.freedesktop.DBus.Properties.Set');
      const openIdx = callMethods.findIndex(m => m === 'org.mpris.MediaPlayer2.Player.OpenUri');
      expect(setIdx).toBeGreaterThanOrEqual(0);
      expect(openIdx).toBeGreaterThan(setIdx);
    });

    it('should emit video:played event with video path', async () => {
      const handler = jest.fn();
      vlcMprisService.on('video:played', handler);

      await vlcMprisService.playVideo('test.mp4');

      expect(handler).toHaveBeenCalledWith('test.mp4');
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.playVideo('test.mp4')).rejects.toThrow();
    });

    it('should not emit video:played on D-Bus failure', async () => {
      mockExecFileError('D-Bus error');
      const handler = jest.fn();
      vlcMprisService.on('video:played', handler);

      await expect(vlcMprisService.playVideo('test.mp4')).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Transport: stop ──

  describe('stop', () => {
    it('should call MPRIS Stop', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.stop();

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Stop']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit video:stopped event', async () => {
      mockExecFileSuccess('');
      const handler = jest.fn();
      vlcMprisService.on('video:stopped', handler);

      await vlcMprisService.stop();

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.stop()).rejects.toThrow('VLC not connected');
    });

    it('should not emit video:stopped on D-Bus failure', async () => {
      mockExecFileError('D-Bus error');
      const handler = jest.fn();
      vlcMprisService.on('video:stopped', handler);

      await expect(vlcMprisService.stop()).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Transport: pause ──

  describe('pause', () => {
    it('should call MPRIS Pause', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.pause();

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Pause']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit video:paused event', async () => {
      mockExecFileSuccess('');
      const handler = jest.fn();
      vlcMprisService.on('video:paused', handler);

      await vlcMprisService.pause();

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.pause()).rejects.toThrow('VLC not connected');
    });
  });

  // ── Transport: resume ──

  describe('resume', () => {
    it('should call MPRIS Play', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.resume();

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Play']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit video:resumed event', async () => {
      mockExecFileSuccess('');
      const handler = jest.fn();
      vlcMprisService.on('video:resumed', handler);

      await vlcMprisService.resume();

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.resume()).rejects.toThrow('VLC not connected');
    });
  });

  // ── getStatus ──

  describe('getStatus', () => {
    it('should return backward-compatible status shape', async () => {
      vlcMprisService.volume = 50; // internal 0-100
      vlcMprisService._rawVolume = 0.5; // raw MPRIS value for lossless 0-256 conversion
      vlcMprisService._loopEnabled = false;

      // Mock D-Bus property reads: PlaybackStatus, Metadata, Position
      execFile.mockImplementation((cmd, args, opts, cb) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('PlaybackStatus')) {
          cb(null, '   variant       string "Playing"\n', '');
        } else if (argsStr.includes('Metadata')) {
          cb(null, '   variant       array [\n      dict entry(\n         string "xesam:url"\n         variant             string "file:///path/to/video.mp4"\n      )\n      dict entry(\n         string "mpris:length"\n         variant             int64 120000000\n      )\n   ]\n', '');
        } else {
          // Position: 60 seconds = 60000000 microseconds
          cb(null, '   variant       int64 60000000\n', '');
        }
      });

      const status = await vlcMprisService.getStatus();

      expect(status).toEqual(expect.objectContaining({
        connected: true,
        state: 'playing',
        currentItem: 'video.mp4',
        position: 0.5,   // 60/120 = 0.5 ratio
        length: 120,      // seconds
        time: 60,         // seconds
        volume: 128,      // 0.5 * 256 = 128
        fullscreen: false,
        loop: false,
      }));
    });

    it('should handle no track metadata gracefully', async () => {
      vlcMprisService.state = 'stopped';
      vlcMprisService.track = null;

      execFile.mockImplementation((cmd, args, opts, cb) => {
        const argsStr = args.join(' ');
        if (argsStr.includes('PlaybackStatus')) {
          cb(null, '   variant       string "Stopped"\n', '');
        } else if (argsStr.includes('Metadata')) {
          // Empty metadata — no xesam:url
          cb(null, '   variant       array [\n   ]\n', '');
        } else {
          cb(null, '   variant       int64 0\n', '');
        }
      });

      const status = await vlcMprisService.getStatus();

      expect(status.currentItem).toBeNull();
      expect(status.position).toBe(0);
      expect(status.length).toBe(0);
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.getStatus()).rejects.toThrow('VLC not connected');
    });
  });

  // ── setVolume ──

  describe('setVolume', () => {
    it('should convert 0-256 to MPRIS 0.0-1.0 and set Volume property', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.setVolume(128); // 128/256 = 0.5

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.freedesktop.DBus.Properties.Set',
          'string:org.mpris.MediaPlayer2.Player',
          'string:Volume',
          'variant:double:0.5',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should clamp to valid range (0-256)', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.setVolume(300); // clamped to 256 → 1.0

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['variant:double:1']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.setVolume(128)).rejects.toThrow();
    });
  });

  // ── seek ──

  describe('seek', () => {
    it('should call MPRIS SetPosition with absolute microseconds', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.seek(30); // 30 seconds

      // SetPosition requires track object path + absolute position in microseconds
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.mpris.MediaPlayer2.Player.SetPosition',
          'objpath:/org/mpris/MediaPlayer2/TrackList/NoTrack',
          'int64:30000000',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.seek(30)).rejects.toThrow();
    });
  });

  // ── setLoop ──

  describe('setLoop', () => {
    it('should set LoopStatus to Playlist when enabled', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.setLoop(true);

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.freedesktop.DBus.Properties.Set',
          'string:org.mpris.MediaPlayer2.Player',
          'string:LoopStatus',
          'variant:string:Playlist',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should set LoopStatus to None when disabled', async () => {
      mockExecFileSuccess('');
      await vlcMprisService.setLoop(false);

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'string:LoopStatus',
          'variant:string:None',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw when VLC not connected', async () => {
      registry.report('vlc', 'down', 'Test');
      mockExecFileError('D-Bus unreachable');

      await expect(vlcMprisService.setLoop(true)).rejects.toThrow();
    });
  });

  // ── initializeIdleLoop ──

  describe('initializeIdleLoop', () => {
    beforeEach(() => {
      mockExecFileSuccess('');
      vlcMprisService._initializeIdleLoopDelay = jest.fn().mockResolvedValue(undefined);
    });

    it('should play idle-loop.mp4 with loop enabled', async () => {
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(true);

      await vlcMprisService.initializeIdleLoop();

      // Should call OpenUri for idle-loop.mp4
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.mpris.MediaPlayer2.Player.OpenUri',
          expect.stringContaining('idle-loop.mp4'),
        ]),
        expect.any(Object),
        expect.any(Function)
      );

      // Should set LoopStatus to Playlist (after playVideo)
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'string:LoopStatus',
          'variant:string:Playlist',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should skip when FEATURE_IDLE_LOOP is false', async () => {
      const original = process.env.FEATURE_IDLE_LOOP;
      process.env.FEATURE_IDLE_LOOP = 'false';

      await vlcMprisService.initializeIdleLoop();

      // No OpenUri calls should have been made
      const openUriCalls = execFile.mock.calls.filter(
        c => c[1].includes('org.mpris.MediaPlayer2.Player.OpenUri')
      );
      expect(openUriCalls).toHaveLength(0);

      process.env.FEATURE_IDLE_LOOP = original;
    });

    it('should skip when idle video file does not exist', async () => {
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(false);

      await vlcMprisService.initializeIdleLoop();

      const openUriCalls = execFile.mock.calls.filter(
        c => c[1].includes('org.mpris.MediaPlayer2.Player.OpenUri')
      );
      expect(openUriCalls).toHaveLength(0);
    });

    it('should handle errors gracefully without throwing', async () => {
      vlcMprisService._idleLoopExists = jest.fn().mockReturnValue(true);
      mockExecFileError('D-Bus error');

      // Should not throw — errors are caught and logged
      await vlcMprisService.initializeIdleLoop();
    });
  });

  // ── returnToIdleLoop ──

  describe('returnToIdleLoop', () => {
    beforeEach(() => {
      mockExecFileSuccess('');
    });

    it('should play idle-loop.mp4 with loop enabled', async () => {
      await vlcMprisService.returnToIdleLoop();

      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.mpris.MediaPlayer2.Player.OpenUri',
          expect.stringContaining('idle-loop.mp4'),
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should skip when FEATURE_IDLE_LOOP is false', async () => {
      const original = process.env.FEATURE_IDLE_LOOP;
      process.env.FEATURE_IDLE_LOOP = 'false';

      await vlcMprisService.returnToIdleLoop();

      const openUriCalls = execFile.mock.calls.filter(
        c => c[1].includes('org.mpris.MediaPlayer2.Player.OpenUri')
      );
      expect(openUriCalls).toHaveLength(0);

      process.env.FEATURE_IDLE_LOOP = original;
    });

    it('should handle errors gracefully without throwing', async () => {
      mockExecFileError('D-Bus error');
      // Should not throw
      await vlcMprisService.returnToIdleLoop();
    });
  });

  // ── _processStateChange (sole state authority for VLC) ──

  describe('_processStateChange', () => {
    it('should emit state:changed on playback state change', () => {
      // Initialize delta tracking
      vlcMprisService._previousDelta = { state: 'stopped', filename: null };

      const handler = jest.fn();
      vlcMprisService.on('state:changed', handler);

      vlcMprisService._processStateChange({
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      expect(handler).toHaveBeenCalledWith({
        previous: { state: 'stopped', filename: null },
        current: { state: 'playing', filename: null },
      });
      expect(vlcMprisService.state).toBe('playing');
    });

    it('should emit state:changed on filename change via metadata', () => {
      vlcMprisService.state = 'playing';
      vlcMprisService._previousDelta = { state: 'playing', filename: 'video-a.mp4' };

      const handler = jest.fn();
      vlcMprisService.on('state:changed', handler);

      vlcMprisService._processStateChange({
        properties: {},
        raw: 'xesam:url\n         variant\n            string "file:///path/to/video-b.mp4"\n   mpris:length\n         variant\n            int64 120000000',
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        previous: expect.objectContaining({ filename: 'video-a.mp4' }),
        current: expect.objectContaining({ filename: 'video-b.mp4' }),
      }));
    });

    it('should NOT emit state:changed when state is unchanged', () => {
      vlcMprisService.state = 'playing';
      vlcMprisService._previousDelta = { state: 'playing', filename: null };

      const handler = jest.fn();
      vlcMprisService.on('state:changed', handler);

      vlcMprisService._processStateChange({
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should update internal volume on Volume property change', () => {
      vlcMprisService._previousDelta = { state: 'stopped', filename: null };

      vlcMprisService._processStateChange({
        properties: { Volume: 0.75 },
        raw: '',
      });

      expect(vlcMprisService.volume).toBe(75); // 0.75 * 100
    });

    it('should auto-recover health on signal receipt', () => {
      registry.report('vlc', 'down', 'Test');
      expect(registry.isHealthy('vlc')).toBe(false);

      vlcMprisService._previousDelta = { state: 'stopped', filename: null };

      vlcMprisService._processStateChange({
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      expect(registry.isHealthy('vlc')).toBe(true);
    });

    it('should set baseline on first signal after reset (no state:changed emitted)', () => {
      // After reset, _previousDelta is null — first signal sets baseline without emitting
      vlcMprisService._previousDelta = null; // simulates post-reset state

      const handler = jest.fn();
      vlcMprisService.on('state:changed', handler);

      vlcMprisService._processStateChange({
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      // No state:changed emitted (no previous to compare against)
      expect(handler).not.toHaveBeenCalled();
      // But internal state IS updated
      expect(vlcMprisService.state).toBe('playing');
      expect(vlcMprisService._previousDelta).toEqual({ state: 'playing', filename: null });

      // Second signal with a change DOES emit
      vlcMprisService._processStateChange({
        properties: { PlaybackStatus: 'Paused' },
        raw: '',
      });

      expect(handler).toHaveBeenCalledWith({
        previous: { state: 'playing', filename: null },
        current: { state: 'paused', filename: null },
      });
    });
  });

  // ── _parseMetadata ──

  describe('_parseMetadata', () => {
    it('should extract filename from xesam:url', () => {
      const raw = [
        'xesam:url',
        '         variant',
        '            string "file:///home/user/public/videos/test-video.mp4"',
        '   mpris:length',
        '         variant',
        '            int64 180000000',
      ].join('\n');

      const result = vlcMprisService._parseMetadata(raw);

      expect(result).toEqual(expect.objectContaining({
        filename: 'test-video.mp4',
        url: 'file:///home/user/public/videos/test-video.mp4',
      }));
    });

    it('should extract length from mpris:length (microseconds → seconds)', () => {
      const raw = [
        'xesam:url',
        '         variant',
        '            string "file:///path/video.mp4"',
        '   mpris:length',
        '         variant',
        '            int64 120000000',
      ].join('\n');

      const result = vlcMprisService._parseMetadata(raw);

      expect(result.length).toBe(120); // 120000000 / 1000000 = 120 seconds
    });

    it('should return null when no xesam:url found', () => {
      const result = vlcMprisService._parseMetadata('some irrelevant dbus output');
      expect(result).toBeNull();
    });
  });

  // ── isConnected ──

  describe('isConnected', () => {
    it('should return true when registry reports healthy', () => {
      registry.report('vlc', 'healthy');
      expect(vlcMprisService.isConnected()).toBe(true);
    });

    it('should return false when registry reports down', () => {
      registry.report('vlc', 'down', 'Test');
      expect(vlcMprisService.isConnected()).toBe(false);
    });
  });

  // ── reset ──

  describe('reset', () => {
    it('should stop playback monitor', () => {
      mockExecFileSuccess('');
      vlcMprisService.startPlaybackMonitor();
      expect(vlcMprisService._playbackMonitor).not.toBeNull();

      vlcMprisService.reset();
      expect(vlcMprisService._playbackMonitor).toBeNull();
    });

    it('should report health as down', () => {
      registry.report('vlc', 'healthy');
      vlcMprisService.reset();
      expect(registry.isHealthy('vlc')).toBe(false);
    });

    it('should reset VLC-specific state', () => {
      vlcMprisService.state = 'playing';
      vlcMprisService.volume = 50;
      vlcMprisService._previousDelta = { state: 'playing', filename: 'test.mp4' };
      vlcMprisService._loopEnabled = true;

      vlcMprisService.reset();

      expect(vlcMprisService.state).toBe('stopped');
      expect(vlcMprisService.volume).toBe(100);
      expect(vlcMprisService._previousDelta).toBeNull();
      expect(vlcMprisService._loopEnabled).toBe(false);
    });

    it('should clear pending VLC restart timer', () => {
      jest.useFakeTimers();

      // Simulate a pending restart timer (VLC crashed, 3s timer scheduled)
      vlcMprisService._vlcRestartTimer = setTimeout(() => {
        vlcMprisService._spawnVlcProcess();
      }, 3000);

      const spawnCountBefore = spawn.mock.calls.length;

      vlcMprisService.reset();

      // Timer should be cleared
      expect(vlcMprisService._vlcRestartTimer).toBeNull();

      // Advancing time should NOT trigger a spawn (timer was cleared)
      jest.advanceTimersByTime(5000);
      expect(spawn.mock.calls.length).toBe(spawnCountBefore);

      jest.useRealTimers();
    });
  });

  // ── VLC Process Spawn ──

  describe('_spawnVlcProcess', () => {
    it('should spawn cvlc with platform args', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      expect(spawn).toHaveBeenCalledWith(
        'cvlc',
        expect.arrayContaining(['--fullscreen', '--no-osd', '-A', 'pulse']),
        expect.objectContaining({
          env: expect.objectContaining({ DISPLAY: expect.any(String) }),
        })
      );
    });

    it('should not spawn if already running', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();
      const firstCallCount = spawn.mock.calls.length;

      vlcMprisService._spawnVlcProcess(); // second call — should no-op
      expect(spawn.mock.calls.length).toBe(firstCallCount);
    });

    it('should schedule restart on process exit', () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      const spawnCountBefore = spawn.mock.calls.length;

      // Simulate VLC exiting
      proc.emit('close', 1, null);

      // Should schedule restart
      expect(vlcMprisService._vlcRestartTimer).not.toBeNull();

      // After 3s, should respawn
      jest.advanceTimersByTime(3000);
      expect(spawn.mock.calls.length).toBe(spawnCountBefore + 1);

      jest.useRealTimers();
    });

    it('should remove stale process.on(exit) handler before registering new one', () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      const firstHandler = vlcMprisService._processExitHandler;
      const removeListenerSpy = jest.spyOn(process, 'removeListener');

      // Simulate VLC crash + restart
      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      proc.emit('close', 1, null);
      jest.advanceTimersByTime(3000);

      // Should have removed the old handler before adding new one
      expect(removeListenerSpy).toHaveBeenCalledWith('exit', firstHandler);
      expect(vlcMprisService._processExitHandler).not.toBe(firstHandler);

      removeListenerSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should kill stale VLC before spawning', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      expect(execFileSync).toHaveBeenCalledWith('pkill', ['-x', 'vlc']);
    });

    it('should clear _ownerBusName on VLC process exit', () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._ownerBusName = ':1.42';
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      proc.emit('close', 1, null);

      expect(vlcMprisService._ownerBusName).toBeNull();
      jest.useRealTimers();
    });

    it('should re-resolve D-Bus owner after crash restart', async () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(true);
      vlcMprisService._resolveOwner = jest.fn().mockResolvedValue(undefined);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;

      // Simulate VLC crash
      proc.emit('close', 1, null);

      // Advance past the 3s restart delay
      jest.advanceTimersByTime(3000);

      // Flush async callbacks (waitForVlcReady + resolveOwner)
      await jest.runAllTimersAsync();

      expect(vlcMprisService._waitForVlcReady).toHaveBeenCalled();
      expect(vlcMprisService._resolveOwner).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not call _resolveOwner if VLC not ready after crash restart', async () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._waitForVlcReady = jest.fn().mockResolvedValue(false);
      vlcMprisService._resolveOwner = jest.fn().mockResolvedValue(undefined);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;

      // Simulate VLC crash
      proc.emit('close', 1, null);

      // Advance past the 3s restart delay
      jest.advanceTimersByTime(3000);

      // Flush async callbacks
      await jest.runAllTimersAsync();

      expect(vlcMprisService._waitForVlcReady).toHaveBeenCalled();
      expect(vlcMprisService._resolveOwner).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should NOT restart when _vlcStopped is true', () => {
      jest.useFakeTimers();
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      vlcMprisService._vlcStopped = true;
      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      const spawnCountBefore = spawn.mock.calls.length;

      proc.emit('close', 0, 'SIGTERM');

      jest.advanceTimersByTime(5000);
      expect(spawn.mock.calls.length).toBe(spawnCountBefore); // No new spawn

      jest.useRealTimers();
    });
  });

  // ── _stopVlcProcess ──

  describe('_stopVlcProcess', () => {
    it('should kill VLC process and set stopped flag', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      vlcMprisService._stopVlcProcess();

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(vlcMprisService._vlcStopped).toBe(true);
      expect(vlcMprisService._vlcProc).toBeNull();
    });

    it('should clear pending restart timer', () => {
      jest.useFakeTimers();
      vlcMprisService._vlcRestartTimer = setTimeout(() => {}, 3000);
      vlcMprisService._stopVlcProcess();
      expect(vlcMprisService._vlcRestartTimer).toBeNull();
      jest.useRealTimers();
    });
  });

  // ── _waitForVlcReady ──

  describe('_waitForVlcReady', () => {
    it('should resolve true when checkConnection succeeds', async () => {
      mockExecFileSuccess('variant       string "Stopped"\n');
      const result = await vlcMprisService._waitForVlcReady(1000);
      expect(result).toBe(true);
    });

    it('should resolve false after timeout when VLC never connects', async () => {
      mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
      const result = await vlcMprisService._waitForVlcReady(600); // short timeout
      expect(result).toBe(false);
    });
  });

  // ── cleanup ──

  describe('cleanup', () => {
    it('should stop VLC process', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      vlcMprisService.cleanup();

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should remove all listeners', () => {
      vlcMprisService.on('test-event', () => {});
      expect(vlcMprisService.listenerCount('test-event')).toBe(1);

      vlcMprisService.cleanup();
      expect(vlcMprisService.listenerCount('test-event')).toBe(0);
    });
  });

  // ── Platform Detection ──

  describe('_getHwAccelArgs', () => {
    const originalEnv = process.env.VLC_HW_ACCEL;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.VLC_HW_ACCEL = originalEnv;
      } else {
        delete process.env.VLC_HW_ACCEL;
      }
    });

    it('should return [] when VLC_HW_ACCEL is empty string', () => {
      process.env.VLC_HW_ACCEL = '';
      expect(vlcMprisService._getHwAccelArgs()).toEqual([]);
    });

    it('should split VLC_HW_ACCEL by spaces', () => {
      process.env.VLC_HW_ACCEL = '--vout=gl --extra';
      expect(vlcMprisService._getHwAccelArgs()).toEqual(['--vout=gl', '--extra']);
    });
  });

  // ── reset preserves VLC process ──

  describe('reset (VLC process preservation)', () => {
    it('should NOT kill VLC process on reset', () => {
      vlcMprisService._getHwAccelArgs = jest.fn().mockReturnValue([]);
      vlcMprisService._spawnVlcProcess();

      const proc = spawn.mock.results[spawn.mock.results.length - 1].value;
      vlcMprisService.reset();

      expect(proc.kill).not.toHaveBeenCalled();
      expect(vlcMprisService._vlcProc).not.toBeNull();
    });
  });
});
