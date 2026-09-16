const EventEmitter = require('events');

jest.mock('child_process');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('MprisPlayerBase', () => {
  let MprisPlayerBase, execFile, spawn, registry, logger;

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
    proc.pid = 99999;
    return proc;
  }

  /** Create a concrete subclass for testing the abstract base */
  function createTestPlayer(overrides = {}) {
    const TestPlayer = class extends MprisPlayerBase {
      _getDestination() {
        return this._destination;
      }

      _processStateChange(signal) {
        const properties = signal.properties || {};
        if ('PlaybackStatus' in properties) {
          const newState = properties.PlaybackStatus.toLowerCase();
          if (newState !== this.state) {
            this.state = newState;
            this.emit('playback:changed', { state: newState });
          }
        }
        if ('Volume' in properties) {
          const newVolume = Math.round(properties.Volume * 100);
          if (newVolume !== this.volume) {
            this.volume = newVolume;
            this.emit('volume:changed', { volume: newVolume });
          }
        }
      }

      _parseMetadata() {
        return null;
      }
    };

    // Apply any method overrides
    for (const [key, val] of Object.entries(overrides)) {
      TestPlayer.prototype[key] = val;
    }

    return new TestPlayer({
      destination: 'org.mpris.MediaPlayer2.testplayer',
      label: 'test',
      healthServiceId: 'vlc',
      signalDebounceMs: 50,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.useFakeTimers();
    const cp = require('child_process');
    execFile = cp.execFile;
    spawn = cp.spawn;
    spawn.mockReturnValue(createMockSpawnProc());
    MprisPlayerBase = require('../../../src/services/mprisPlayerBase');
    registry = require('../../../src/services/serviceHealthRegistry');
    logger = require('../../../src/utils/logger');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should store config from constructor options', () => {
      const player = createTestPlayer();
      expect(player._destination).toBe('org.mpris.MediaPlayer2.testplayer');
      expect(player._label).toBe('test');
      expect(player._healthServiceId).toBe('vlc');
      expect(player._signalDebounceMs).toBe(50);
    });

    it('should initialize state properties to defaults', () => {
      const player = createTestPlayer();
      expect(player.state).toBe('stopped');
      expect(player.volume).toBe(100);
      expect(player.track).toBeNull();
    });

    it('should default signalDebounceMs to 300 if not provided', () => {
      const TestPlayer = class extends MprisPlayerBase {
        _getDestination() { return this._destination; }
        _processStateChange() {}
        _parseMetadata() { return null; }
      };
      const player = new TestPlayer({
        destination: 'org.mpris.MediaPlayer2.test',
        label: 'test',
        healthServiceId: 'vlc',
      });
      expect(player._signalDebounceMs).toBe(300);
    });
  });

  describe('_buildDbusArgs()', () => {
    it('should build correct argument array for dbus-send', () => {
      const player = createTestPlayer();
      const args = player._buildDbusArgs(
        'org.mpris.MediaPlayer2.testplayer',
        'org.mpris.MediaPlayer2.Player.Play'
      );
      expect(args).toEqual([
        '--session', '--type=method_call', '--print-reply',
        '--dest=org.mpris.MediaPlayer2.testplayer',
        '/org/mpris/MediaPlayer2',
        'org.mpris.MediaPlayer2.Player.Play',
      ]);
    });

    it('should append additional args when provided', () => {
      const player = createTestPlayer();
      const args = player._buildDbusArgs(
        'org.mpris.MediaPlayer2.testplayer',
        'org.freedesktop.DBus.Properties.Get',
        ['string:org.mpris.MediaPlayer2.Player', 'string:PlaybackStatus']
      );
      expect(args).toContain('string:org.mpris.MediaPlayer2.Player');
      expect(args).toContain('string:PlaybackStatus');
    });
  });

  describe('_dbusCall()', () => {
    it('should call execFileAsync with correct args and return stdout', async () => {
      const player = createTestPlayer();
      mockExecFileSuccess('variant   string "Playing"');
      const result = await player._dbusCall('org.mpris.MediaPlayer2.Player.Play');
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          '--dest=org.mpris.MediaPlayer2.testplayer',
          'org.mpris.MediaPlayer2.Player.Play',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
      expect(result.stdout).toBe('variant   string "Playing"');
    });

    it('should throw on execFile failure', async () => {
      const player = createTestPlayer();
      mockExecFileError('D-Bus connection refused');
      await expect(player._dbusCall('org.mpris.MediaPlayer2.Player.Play'))
        .rejects.toThrow('D-Bus connection refused');
    });

    it('should throw if _getDestination() returns null', async () => {
      const player = createTestPlayer({
        _getDestination() { return null; }
      });
      await expect(player._dbusCall('org.mpris.MediaPlayer2.Player.Play'))
        .rejects.toThrow();
    });
  });

  describe('_dbusGetProperty()', () => {
    it('should call _dbusCall with Properties.Get method and correct args', async () => {
      const player = createTestPlayer();
      mockExecFileSuccess('variant   string "Playing"');
      await player._dbusGetProperty('org.mpris.MediaPlayer2.Player', 'PlaybackStatus');
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining([
          'org.freedesktop.DBus.Properties.Get',
          'string:org.mpris.MediaPlayer2.Player',
          'string:PlaybackStatus',
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('_dbusSetProperty()', () => {
    it('should call _dbusCall with Properties.Set method and variant arg', async () => {
      const player = createTestPlayer();
      mockExecFileSuccess('');
      await player._dbusSetProperty(
        'org.mpris.MediaPlayer2.Player', 'Volume', 'double', '0.5'
      );
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
  });

  describe('_transport()', () => {
    it('should call _dbusCall with PLAYER_IFACE method', async () => {
      const player = createTestPlayer();
      // Pre-seed healthy to skip _ensureConnection
      registry.report('vlc', 'healthy');
      mockExecFileSuccess('');
      await player._transport('Play');
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Play']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should call _ensureConnection before _dbusCall', async () => {
      const player = createTestPlayer();
      // Service not healthy → _ensureConnection will probe
      registry.report('vlc', 'down');
      // First call = checkConnection (Properties.Get), second = transport
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) {
          // checkConnection call: return PlaybackStatus
          cb(null, 'variant   string "Stopped"', '');
        } else {
          // transport call
          cb(null, '', '');
        }
      });
      await player._transport('Play');
      expect(callCount).toBe(2);
    });

    it('should throw if service is not connected and checkConnection fails', async () => {
      const player = createTestPlayer();
      registry.report('vlc', 'down');
      mockExecFileError('No such name');
      await expect(player._transport('Play')).rejects.toThrow();
    });
  });

  describe('startPlaybackMonitor()', () => {
    it('should create ProcessMonitor and start it', () => {
      const player = createTestPlayer();
      player.startPlaybackMonitor();
      expect(spawn).toHaveBeenCalledWith(
        'dbus-monitor',
        expect.arrayContaining(['--session', '--monitor']),
        expect.any(Object)
      );
    });

    it('should be idempotent (no-op if already monitoring)', () => {
      const player = createTestPlayer();
      player.startPlaybackMonitor();
      player.startPlaybackMonitor();
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should emit parsed MPRIS signals through debounce', () => {
      const player = createTestPlayer();
      const stateChangeSpy = jest.fn();
      player.on('playback:changed', stateChangeSpy);

      player.startPlaybackMonitor();
      const proc = spawn.mock.results[0].value;

      // Simulate a PropertiesChanged signal from dbus-monitor
      const signalLines = [
        "signal time=1234 sender=:1.42 -> destination=(null destination) serial=100 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
        '   string "org.mpris.MediaPlayer2.Player"',
        '   array [',
        '      dict entry(',
        '         string "PlaybackStatus"',
        '         variant             string "Playing"',
        '      )',
        '   ]',
      ];

      for (const line of signalLines) {
        proc.stdout.emit('data', line + '\n');
      }

      // Send boundary for next signal to flush the current one
      proc.stdout.emit('data', 'signal time=9999 sender=:1.42 -> destination=(null destination) serial=101 path=/other; interface=other; member=Other\n');

      // Debounce timer hasn't fired yet
      expect(stateChangeSpy).not.toHaveBeenCalled();

      // Advance past debounce
      jest.advanceTimersByTime(60);
      expect(stateChangeSpy).toHaveBeenCalledWith({ state: 'playing' });
    });

    // W10 F-C2 regression: at the venue on 2026-09-15 VLC emitted the
    // "Playing" block LAST in its start-up burst, with the next signal ~28 s
    // later at end-of-video. Boundary-only parsing left the state at 'stopped'
    // for that whole window — the waitForVlcLoaded timeout.
    it('should reach playing on the venue signal order with nothing following', () => {
      const {
        LOOP_STATUS, CAN_PLAY, TRACK_LIST, METADATA_PLAYING,
      } = require('../../helpers/dbus-monitor-samples');

      const player = createTestPlayer();
      const stateChangeSpy = jest.fn();
      player.on('playback:changed', stateChangeSpy);

      player.startPlaybackMonitor();
      const proc = spawn.mock.results[0].value;

      for (const block of [LOOP_STATUS, CAN_PLAY, TRACK_LIST, METADATA_PLAYING]) {
        for (const line of block) {
          proc.stdout.emit('data', line + '\n');
        }
      }

      // No further input at all — only the debounce window elapses
      jest.advanceTimersByTime(60);

      expect(stateChangeSpy).toHaveBeenCalledWith({ state: 'playing' });
      expect(player.state).toBe('playing');
    });
  });

  describe('stopPlaybackMonitor()', () => {
    it('should stop ProcessMonitor and clear debounce', () => {
      const player = createTestPlayer();
      player.startPlaybackMonitor();
      const proc = spawn.mock.results[0].value;

      player.stopPlaybackMonitor();
      expect(proc.kill).toHaveBeenCalled();
      expect(player._playbackMonitor).toBeNull();
      expect(player._signalDebounceTimer).toBeNull();
    });

    it('should discard pending signal without processing', () => {
      const player = createTestPlayer();
      const stateChangeSpy = jest.fn();
      player.on('playback:changed', stateChangeSpy);

      player.startPlaybackMonitor();
      const proc = spawn.mock.results[0].value;

      // Feed a signal but don't wait for debounce
      proc.stdout.emit('data', "signal time=1234 sender=:1.42 -> destination=(null destination) serial=100 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged\n");
      proc.stdout.emit('data', '   string "org.mpris.MediaPlayer2.Player"\n');
      proc.stdout.emit('data', '      dict entry(\n');
      proc.stdout.emit('data', '         string "PlaybackStatus"\n');
      proc.stdout.emit('data', '         variant             string "Playing"\n');
      proc.stdout.emit('data', '      )\n');
      // Flush with next signal boundary
      proc.stdout.emit('data', 'signal time=9999 sender=:1.42 -> destination=(null destination) serial=101 path=/other; interface=other; member=Other\n');

      player.stopPlaybackMonitor();
      jest.advanceTimersByTime(1000);
      expect(stateChangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('signal debounce and merge', () => {
    it('should merge rapid signals within debounce window', () => {
      const player = createTestPlayer();
      const playbackSpy = jest.fn();
      const volumeSpy = jest.fn();
      player.on('playback:changed', playbackSpy);
      player.on('volume:changed', volumeSpy);

      player.startPlaybackMonitor();
      const proc = spawn.mock.results[0].value;

      // First signal: PlaybackStatus
      const signal1Lines = [
        "signal time=1234 sender=:1.42 -> destination=(null destination) serial=100 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
        '   string "org.mpris.MediaPlayer2.Player"',
        '   array [',
        '      dict entry(',
        '         string "PlaybackStatus"',
        '         variant             string "Playing"',
        '      )',
        '   ]',
      ];

      for (const line of signal1Lines) {
        proc.stdout.emit('data', line + '\n');
      }

      // Second signal (within debounce window): Volume
      const signal2Lines = [
        "signal time=1235 sender=:1.42 -> destination=(null destination) serial=101 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged",
        '   string "org.mpris.MediaPlayer2.Player"',
        '   array [',
        '      dict entry(',
        '         string "Volume"',
        '         variant             double 0.75',
        '      )',
        '   ]',
      ];

      for (const line of signal2Lines) {
        proc.stdout.emit('data', line + '\n');
      }

      // Third boundary to flush second signal
      proc.stdout.emit('data', 'signal time=9999 sender=:1.42 -> destination=(null destination) serial=102 path=/other; interface=other; member=Other\n');

      // Debounce timer resets on second signal, so nothing yet
      jest.advanceTimersByTime(30);
      expect(playbackSpy).not.toHaveBeenCalled();

      // After debounce fires, BOTH properties should be processed in one call
      jest.advanceTimersByTime(30);
      expect(playbackSpy).toHaveBeenCalledWith({ state: 'playing' });
      expect(volumeSpy).toHaveBeenCalledWith({ volume: 75 });
    });
  });

  describe('checkConnection()', () => {
    it('should read PlaybackStatus and report healthy', async () => {
      const player = createTestPlayer();
      mockExecFileSuccess('variant   string "Playing"');
      const result = await player.checkConnection();
      expect(result).toBe(true);
      expect(registry.isHealthy('vlc')).toBe(true);
    });

    it('should update state from PlaybackStatus response', async () => {
      const player = createTestPlayer();
      mockExecFileSuccess('variant   string "Playing"');
      await player.checkConnection();
      expect(player.state).toBe('playing');
    });

    it('should report down on failure', async () => {
      const player = createTestPlayer();
      mockExecFileError('No such name');
      const result = await player.checkConnection();
      expect(result).toBe(false);
      expect(registry.isHealthy('vlc')).toBe(false);
    });

    it('should emit playback:changed when state changes during check', async () => {
      const player = createTestPlayer();
      const spy = jest.fn();
      player.on('playback:changed', spy);
      mockExecFileSuccess('variant   string "Paused"');
      await player.checkConnection();
      expect(spy).toHaveBeenCalledWith({ state: 'paused' });
    });

    it('should not emit playback:changed when state is unchanged', async () => {
      const player = createTestPlayer();
      player.state = 'stopped';
      const spy = jest.fn();
      player.on('playback:changed', spy);
      mockExecFileSuccess('variant   string "Stopped"');
      await player.checkConnection();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getState()', () => {
    it('should return state shape with connected, state, volume, track', () => {
      const player = createTestPlayer();
      registry.report('vlc', 'healthy');
      player.state = 'playing';
      player.volume = 80;
      player.track = { title: 'Test' };

      const state = player.getState();
      expect(state).toEqual({
        connected: true,
        state: 'playing',
        volume: 80,
        track: { title: 'Test' },
      });
    });

    it('should return connected=false when health registry shows down', () => {
      const player = createTestPlayer();
      registry.report('vlc', 'down');
      const state = player.getState();
      expect(state.connected).toBe(false);
    });
  });

  describe('reset()', () => {
    it('should stop monitor, clear state, report health down', () => {
      const player = createTestPlayer();
      registry.report('vlc', 'healthy');
      player.state = 'playing';
      player.volume = 50;
      player.track = { title: 'Track' };
      player.startPlaybackMonitor();

      player.reset();

      expect(player.state).toBe('stopped');
      expect(player.volume).toBe(100);
      expect(player.track).toBeNull();
      expect(player._playbackMonitor).toBeNull();
      expect(registry.isHealthy('vlc')).toBe(false);
    });
  });

  describe('cleanup()', () => {
    it('should reset and remove all listeners', () => {
      const player = createTestPlayer();
      const spy = jest.fn();
      player.on('playback:changed', spy);

      player.cleanup();

      expect(player.state).toBe('stopped');
      expect(player.listenerCount('playback:changed')).toBe(0);
    });
  });

  describe('_ensureConnection()', () => {
    it('should no-op when service is healthy', async () => {
      const player = createTestPlayer();
      registry.report('vlc', 'healthy');
      // Should resolve without calling execFile
      await player._ensureConnection();
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should probe via checkConnection when service is down', async () => {
      const player = createTestPlayer();
      registry.report('vlc', 'down');
      mockExecFileSuccess('variant   string "Stopped"');
      await player._ensureConnection();
      expect(execFile).toHaveBeenCalled();
    });

    it('should throw if checkConnection fails', async () => {
      const player = createTestPlayer();
      registry.report('vlc', 'down');
      mockExecFileError('No such name');
      await expect(player._ensureConnection()).rejects.toThrow('not connected');
    });
  });

  describe('_handleMprisSignal()', () => {
    it('should ignore signals from non-Player interface', () => {
      const player = createTestPlayer();
      const spy = jest.fn();
      player.on('playback:changed', spy);

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2',
        properties: { PlaybackStatus: 'Playing' },
      });

      jest.advanceTimersByTime(500);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should debounce and process Player interface signals', () => {
      const player = createTestPlayer();
      const spy = jest.fn();
      player.on('playback:changed', spy);

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        properties: { PlaybackStatus: 'Playing' },
      });

      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(60);
      expect(spy).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('should merge properties from rapid consecutive signals', () => {
      const player = createTestPlayer();
      const playbackSpy = jest.fn();
      const volumeSpy = jest.fn();
      player.on('playback:changed', playbackSpy);
      player.on('volume:changed', volumeSpy);

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        properties: { PlaybackStatus: 'Playing' },
      });

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        properties: { Volume: 0.6 },
      });

      jest.advanceTimersByTime(60);
      expect(playbackSpy).toHaveBeenCalledWith({ state: 'playing' });
      expect(volumeSpy).toHaveBeenCalledWith({ volume: 60 });
    });
  });

  describe('MPRIS signal sender filtering', () => {
    it('should ignore signals from unknown senders when owner is resolved', () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      jest.advanceTimersByTime(100);

      // State should NOT change (signal was from wrong sender)
      expect(player.state).toBe('stopped');
    });

    it('should process signals from matching sender', () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.50',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      jest.advanceTimersByTime(100);

      expect(player.state).toBe('playing');
    });

    it('should trigger _refreshOwner on sender mismatch', () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';
      player._refreshOwner = jest.fn().mockResolvedValue(undefined);

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      expect(player._refreshOwner).toHaveBeenCalledTimes(1);
      // Signal itself is still dropped (state unchanged)
      jest.advanceTimersByTime(100);
      expect(player.state).toBe('stopped');
    });

    it('should not trigger multiple _refreshOwner calls during resolution', async () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';
      // _refreshOwner that stays pending
      let resolveRefresh;
      player._refreshOwner = jest.fn().mockImplementation(
        () => new Promise(r => { resolveRefresh = r; })
      );

      // Two rapid mismatched signals
      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });
      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Paused' },
        raw: '',
      });

      expect(player._refreshOwner).toHaveBeenCalledTimes(1);
      resolveRefresh();
    });

    it('should accept signals from new sender after successful re-resolution', async () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';

      // Mock _refreshOwner to update owner to new sender
      player._refreshOwner = jest.fn().mockImplementation(async () => {
        player._ownerBusName = ':1.99';
        player._resolvingOwner = false;
      });

      // First signal: mismatch triggers re-resolution, signal dropped
      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      // Let _refreshOwner resolve
      await Promise.resolve();
      await Promise.resolve();

      // Second signal from new sender: should now pass
      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      jest.advanceTimersByTime(100);
      expect(player.state).toBe('playing');
    });

    it('should preserve old owner if re-resolution fails', async () => {
      const player = createTestPlayer();
      player._ownerBusName = ':1.50';

      // Mock _resolveOwner to set null (resolution failure)
      mockExecFileError('No such name');

      // Trigger mismatch — default _refreshOwner calls _resolveOwner which fails
      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      // Let _refreshOwner resolve
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Old owner preserved
      expect(player._ownerBusName).toBe(':1.50');

      // P0.4: restore-stale-owner branch logs the kept owner
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/re-resolution failed/i),
        expect.objectContaining({ owner: ':1.50' })
      );
    });

    it('should process all signals when owner is not resolved (null)', () => {
      const player = createTestPlayer();
      // _ownerBusName defaults to null

      player._handleMprisSignal({
        changedInterface: 'org.mpris.MediaPlayer2.Player',
        sender: ':1.99',
        properties: { PlaybackStatus: 'Playing' },
        raw: '',
      });

      jest.advanceTimersByTime(100);

      expect(player.state).toBe('playing');
    });
  });

  describe('P0.4 instrumentation', () => {
    describe('sender-mismatch logging', () => {
      it('should log ONE info line for repeated mismatches from the same sender', () => {
        const player = createTestPlayer();
        player._ownerBusName = ':1.50';
        player._refreshOwner = jest.fn().mockResolvedValue(undefined);

        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Paused' },
          raw: '',
        });
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });

        const mismatchLogs = logger.info.mock.calls.filter(
          ([, meta]) => meta && meta.sender === ':1.99'
        );
        expect(mismatchLogs).toHaveLength(1);
        expect(mismatchLogs[0][1]).toEqual(
          expect.objectContaining({ label: 'test', sender: ':1.99', owner: ':1.50' })
        );
      });

      it('should log once per distinct mismatched sender', () => {
        const player = createTestPlayer();
        player._ownerBusName = ':1.50';
        player._refreshOwner = jest.fn().mockResolvedValue(undefined);

        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.98',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });

        const mismatchLogs = logger.info.mock.calls.filter(
          ([, meta]) => meta && (meta.sender === ':1.98' || meta.sender === ':1.99')
        );
        expect(mismatchLogs).toHaveLength(2);
      });

      it('should clear the mismatched-sender set on _resolveOwner (logs again after re-resolution)', async () => {
        const player = createTestPlayer();
        mockExecFileError('No such name'); // every _resolveOwner() call fails fast
        player._ownerBusName = ':1.50';

        // First mismatch: logs once, internally triggers _refreshOwner -> _resolveOwner
        // (fails, old owner preserved).
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        logger.info.mockClear();

        // Simulate a fresh, unrelated resolution (e.g. VLC restart) — this
        // must clear the mismatched-sender set regardless of outcome.
        await player._resolveOwner();
        player._ownerBusName = ':1.50'; // pin owner back for a clean mismatch check
        player._refreshOwner = jest.fn().mockResolvedValue(undefined);
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });

        const mismatchLogs = logger.info.mock.calls.filter(
          ([, meta]) => meta && meta.sender === ':1.99'
        );
        expect(mismatchLogs).toHaveLength(1);
      });
    });

    describe('_resolveOwner() logging', () => {
      it('should log at info level on success, including destination/owner/previous', async () => {
        const player = createTestPlayer();
        player._ownerBusName = ':1.40';
        mockExecFileSuccess('string ":1.77"');

        await player._resolveOwner();

        expect(player._ownerBusName).toBe(':1.77');
        expect(logger.info).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            destination: 'org.mpris.MediaPlayer2.testplayer',
            owner: ':1.77',
            previous: ':1.40',
          })
        );
        // Scoped to this specific message (not "no debug call ever"), so an
        // unrelated future debug line elsewhere doesn't break this test.
        expect(logger.debug.mock.calls.some(([msg]) => /Resolved D-Bus owner/.test(msg))).toBe(false);
      });

      it('should log an info "owner not resolved" line when the dbus call fails', async () => {
        const player = createTestPlayer();
        mockExecFileError('No such name');

        await player._resolveOwner();

        expect(player._ownerBusName).toBeNull();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('owner not resolved'),
          expect.objectContaining({ destination: 'org.mpris.MediaPlayer2.testplayer' })
        );
      });

      it('should log an info "owner not resolved" line when the reply has no owner match', async () => {
        const player = createTestPlayer();
        mockExecFileSuccess('unparseable reply');

        await player._resolveOwner();

        expect(player._ownerBusName).toBeNull();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('owner not resolved'),
          expect.objectContaining({ destination: 'org.mpris.MediaPlayer2.testplayer' })
        );
      });

      it('should clear the mismatch-log dedup only when the resolved owner actually changes', async () => {
        const player = createTestPlayer();
        player._ownerBusName = ':1.50';

        const mismatchLogCount = () =>
          logger.info.mock.calls.filter(([, meta]) => meta && meta.sender === ':1.99').length;

        // Cycle 1: foreign sender mismatches, refresh resolves to the SAME owner.
        mockExecFileSuccess('string ":1.50"');
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(mismatchLogCount()).toBe(1);

        // Cycle 2: same sender, same owner again — dedup Set was NOT cleared
        // (owner unchanged), so this must stay suppressed.
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Paused' },
          raw: '',
        });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(mismatchLogCount()).toBe(1);

        // Cycle 3: this mismatch is still suppressed (checked before its
        // refresh runs), but its refresh resolves to a DIFFERENT owner —
        // clearing the dedup Set for the next signal.
        mockExecFileSuccess('string ":1.77"');
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Playing' },
          raw: '',
        });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(mismatchLogCount()).toBe(1);
        expect(player._ownerBusName).toBe(':1.77');

        // Cycle 4: dedup Set is now empty — same sender logs again.
        player._handleMprisSignal({
          changedInterface: 'org.mpris.MediaPlayer2.Player',
          sender: ':1.99',
          properties: { PlaybackStatus: 'Paused' },
          raw: '',
        });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        expect(mismatchLogCount()).toBe(2);
      });
    });
  });
});
