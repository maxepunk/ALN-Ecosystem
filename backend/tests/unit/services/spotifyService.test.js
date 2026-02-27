jest.mock('child_process');

describe('SpotifyService', () => {
  let spotifyService, execFile;

  /**
   * Helper: mock execFile to resolve with given stdout
   */
  function mockExecFileSuccess(stdout) {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(null, stdout, '');
    });
  }

  /**
   * Helper: mock execFile to reject with given error
   */
  function mockExecFileError(message) {
    execFile.mockImplementation((cmd, args, opts, cb) => {
      cb(new Error(message), '', '');
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const cp = require('child_process');
    execFile = cp.execFile;
    spotifyService = require('../../../src/services/spotifyService');
    spotifyService.reset();
    // Pre-seed D-Bus destination to skip discovery (spotifyd appends .instance{PID})
    spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd';
    spotifyService._dbusCacheTime = Date.now();
    // Pre-seed connected to skip _ensureConnection probe in transport calls
    spotifyService.connected = true;
    // Mock activation delay to avoid 1.5s real wait per test
    spotifyService._activationDelay = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    spotifyService.cleanup();
  });

  describe('transport controls', () => {
    it('should call dbus-send for play', async () => {
      mockExecFileSuccess('');
      await spotifyService.play();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Play']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for pause', async () => {
      mockExecFileSuccess('');
      await spotifyService.pause();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Pause']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for stop', async () => {
      mockExecFileSuccess('');
      await spotifyService.stop();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Stop']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call dbus-send for next', async () => {
      mockExecFileSuccess('');
      await spotifyService.next();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Next']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should call Player.Previous via D-Bus', async () => {
      mockExecFileSuccess('');
      await spotifyService.previous();
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send',
        expect.arrayContaining(['org.mpris.MediaPlayer2.Player.Previous']),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('playlist switching', () => {
    it('should call OpenUri with spotify URI', async () => {
      mockExecFileSuccess('');
      await spotifyService.setPlaylist('spotify:playlist:act2');
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['string:spotify:playlist:act2']),
        expect.any(Object), expect.any(Function)
      );
    });
  });

  describe('volume control', () => {
    it('should set volume via dbus property', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(80);
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['variant:double:0.8']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should clamp volume to 0-100', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(150);
      expect(execFile).toHaveBeenCalledWith(
        'dbus-send', expect.arrayContaining(['variant:double:1']),
        expect.any(Object), expect.any(Function)
      );
    });

    it('should clamp negative volume to 0', async () => {
      mockExecFileSuccess('');
      await spotifyService.setVolume(-50);
      expect(spotifyService.volume).toBe(0);
    });
  });

  describe('connection detection', () => {
    it('should detect when spotifyd is not running', async () => {
      spotifyService._dbusDest = null; // Force discovery
      mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
      const result = await spotifyService.checkConnection();
      expect(result).toBe(false);
    });

    it('should detect when spotifyd is running and playing', async () => {
      mockExecFileSuccess('variant       string "Playing"');
      const result = await spotifyService.checkConnection();
      expect(result).toBe(true);
      expect(spotifyService.state).toBe('playing');
    });

    it('should detect when spotifyd is running and paused', async () => {
      mockExecFileSuccess('variant       string "Paused"');
      const result = await spotifyService.checkConnection();
      expect(result).toBe(true);
      expect(spotifyService.state).toBe('paused');
    });
  });

  describe('connection:changed event', () => {
    it('should emit connection:changed when connection status changes to true', async () => {
      const handler = jest.fn();
      spotifyService.on('connection:changed', handler);
      spotifyService.connected = false;

      mockExecFileSuccess('variant       string "Playing"');
      await spotifyService.checkConnection();

      expect(handler).toHaveBeenCalledWith({ connected: true });
    });

    it('should emit connection:changed when connection status changes to false', async () => {
      const handler = jest.fn();
      spotifyService.on('connection:changed', handler);
      spotifyService.connected = true;

      spotifyService._dbusDest = null;
      mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
      await spotifyService.checkConnection();

      expect(handler).toHaveBeenCalledWith({ connected: false });
    });

    it('should NOT emit connection:changed when status stays the same', async () => {
      const handler = jest.fn();
      spotifyService.on('connection:changed', handler);
      spotifyService.connected = true;

      mockExecFileSuccess('variant       string "Playing"');
      await spotifyService.checkConnection();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('D-Bus discovery', () => {
    it('should discover spotifyd instance name from D-Bus', async () => {
      spotifyService._dbusDest = null; // Force discovery
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n  string "org.mpris.MediaPlayer2.spotifyd.instance12345"\n]`;
      // First call: discovery (ListNames), second call: actual command
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) cb(null, listNamesOutput, '');
        else cb(null, '', '');
      });
      await spotifyService.play();
      expect(spotifyService._dbusDest).toBe('org.mpris.MediaPlayer2.spotifyd.instance12345');
    });

    it('should throw when spotifyd not found on D-Bus', async () => {
      spotifyService._dbusDest = null; // Force discovery
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      await expect(spotifyService.play()).rejects.toThrow('spotifyd not found on D-Bus');
    });

    it('should cache discovered destination', async () => {
      spotifyService._dbusDest = null;
      const listNamesOutput = `array [\n  string "org.mpris.MediaPlayer2.spotifyd.instance99"\n]`;
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) cb(null, listNamesOutput, '');
        else cb(null, '', '');
      });
      await spotifyService.play();
      // Clear call count, reset mock for second operation
      execFile.mockClear();
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, '', '');
      });
      await spotifyService.pause();
      // Only 1 execFile call for pause (no discovery needed — dest is cached)
      expect(execFile).toHaveBeenCalledTimes(1);
    });

    it('should clear all cached state on reset', () => {
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance99';
      spotifyService._spotifydDest = 'rs.spotifyd.instance99';
      spotifyService._recovering = true;
      spotifyService.connected = true;
      spotifyService.state = 'playing';
      spotifyService.track = { title: 'Test', artist: 'Artist' };
      spotifyService.reset();
      expect(spotifyService._dbusDest).toBeNull();
      expect(spotifyService._spotifydDest).toBeNull();
      expect(spotifyService._recovering).toBe(false);
      expect(spotifyService.connected).toBe(false);
      expect(spotifyService.state).toBe('stopped');
      expect(spotifyService.track).toBeNull();
    });
  });

  describe('_findDbusDest', () => {
    it('should find D-Bus name matching pattern', async () => {
      spotifyService._dbusDest = null;
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n  string "rs.spotifyd.instance12345"\n  string "org.mpris.MediaPlayer2.spotifyd.instance12345"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
      expect(result).toBe('rs.spotifyd.instance12345');
    });

    it('should return null when no match found', async () => {
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
      expect(result).toBeNull();
    });

    it('should return null on D-Bus error', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Connection refused'), '', '');
      });
      const result = await spotifyService._findDbusDest('rs\\.spotifyd\\.');
      expect(result).toBeNull();
    });
  });

  describe('_discoverSpotifydDest', () => {
    it('should find native spotifyd D-Bus name', async () => {
      spotifyService._spotifydDest = null;
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n  string "rs.spotifyd.instance12345"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      const result = await spotifyService._discoverSpotifydDest();
      expect(result).toBe('rs.spotifyd.instance12345');
    });

    it('should cache the discovered destination', async () => {
      spotifyService._spotifydDest = null;
      const listNamesOutput = `array [\n  string "rs.spotifyd.instance99"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      await spotifyService._discoverSpotifydDest();
      execFile.mockClear();
      const result = await spotifyService._discoverSpotifydDest();
      expect(result).toBe('rs.spotifyd.instance99');
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should return null when spotifyd not on D-Bus', async () => {
      spotifyService._spotifydDest = null;
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      const result = await spotifyService._discoverSpotifydDest();
      expect(result).toBeNull();
    });
  });

  // Helper: MPRIS ListNames response for re-discovery after TransferPlayback
  const mprisListNamesOutput = `array [\n  string "org.mpris.MediaPlayer2.spotifyd.instance123"\n]`;

  describe('activate', () => {
    // activate() flow: TransferPlayback → wait → clear _dbusDest → checkConnection()
    // checkConnection() calls _discoverDbusDest() → _findDbusDest(ListNames) → Properties.Get
    // So successful activation = 3 execFile calls minimum

    it('should call TransferPlayback via native D-Bus interface', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      spotifyService._spotifydCacheTime = Date.now();
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) {
          // TransferPlayback — must use /rs/spotifyd/Controls path (not /)
          expect(args).toContain('--dest=rs.spotifyd.instance123');
          expect(args).toContain('/rs/spotifyd/Controls');
          expect(args).toContain('rs.spotifyd.Controls.TransferPlayback');
          cb(null, '', '');
        } else if (callCount === 2) {
          // MPRIS re-discovery (ListNames)
          cb(null, mprisListNamesOutput, '');
        } else {
          // Properties.Get (checkConnection)
          cb(null, 'variant       string "Playing"', '');
        }
      });
      const result = await spotifyService.activate();
      expect(result).toBe(true);
      expect(spotifyService.connected).toBe(true);
    });

    it('should discover native dest if not cached', async () => {
      spotifyService._spotifydDest = null;
      const nativeListNamesOutput = `array [\n  string "rs.spotifyd.instance456"\n]`;
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) cb(null, nativeListNamesOutput, ''); // native discovery
        else if (callCount === 2) cb(null, '', '');               // TransferPlayback
        else if (callCount === 3) cb(null, mprisListNamesOutput, ''); // MPRIS re-discovery
        else cb(null, 'variant       string "Paused"', '');       // Properties.Get
      });
      const result = await spotifyService.activate();
      expect(result).toBe(true);
      expect(spotifyService._spotifydDest).toBe('rs.spotifyd.instance456');
    });

    it('should return false when spotifyd not found', async () => {
      spotifyService._spotifydDest = null;
      const listNamesOutput = `array [\n  string "org.freedesktop.DBus"\n]`;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, listNamesOutput, '');
      });
      const result = await spotifyService.activate();
      expect(result).toBe(false);
      expect(spotifyService.connected).toBe(false);
    });

    it('should return false when TransferPlayback fails', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      spotifyService._spotifydCacheTime = Date.now();
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('D-Bus method call failed'), '', '');
      });
      const result = await spotifyService.activate();
      expect(result).toBe(false);
    });

    it('should emit connection:changed on successful activation', async () => {
      const handler = jest.fn();
      spotifyService.on('connection:changed', handler);
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      spotifyService._spotifydCacheTime = Date.now();
      spotifyService.connected = false;
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) cb(null, '', '');                    // TransferPlayback
        else if (callCount === 2) cb(null, mprisListNamesOutput, ''); // MPRIS re-discovery
        else cb(null, 'variant       string "Playing"', '');      // Properties.Get
      });
      await spotifyService.activate();
      expect(handler).toHaveBeenCalledWith({ connected: true });
    });
  });

  describe('init', () => {
    it('should attempt activate first', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      spotifyService._spotifydCacheTime = Date.now();
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) cb(null, '', '');                    // TransferPlayback
        else if (callCount === 2) cb(null, mprisListNamesOutput, ''); // MPRIS re-discovery
        else cb(null, 'variant       string "Playing"', '');      // Properties.Get
      });
      await spotifyService.init();
      expect(spotifyService.connected).toBe(true);
    });

    it('should fall back to checkConnection when activate fails', async () => {
      spotifyService._spotifydDest = null;
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance99';
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) {
          // Discovery for native dest — not found
          cb(null, `array [\n  string "org.freedesktop.DBus"\n]`, '');
        } else {
          // checkConnection — MPRIS available (dest pre-seeded)
          cb(null, 'variant       string "Paused"', '');
        }
      });
      await spotifyService.init();
      expect(spotifyService.connected).toBe(true);
    });

    it('should not throw when both activate and checkConnection fail', async () => {
      spotifyService._spotifydDest = null;
      spotifyService._dbusDest = null;
      mockExecFileError('Connection refused');
      await spotifyService.init();
      expect(spotifyService.connected).toBe(false);
    });
  });

  describe('reactive recovery in _dbusCall', () => {
    it('should retry after recovery when first call fails', async () => {
      // Flow: original MPRIS call fails → clear caches → discover native →
      // TransferPlayback → wait → discover MPRIS → checkConnection →
      // checkConnection._refreshMetadata (fire-and-forget) → retry original command
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) {
          // Original Play call — fails (stale MPRIS dest)
          cb(new Error('org.freedesktop.DBus.Error.ServiceUnknown'), '', '');
        } else if (callCount === 2) {
          // Recovery: _discoverSpotifydDest → ListNames
          cb(null, `array [\n  string "rs.spotifyd.instance999"\n]`, '');
        } else if (callCount === 3) {
          // Recovery: activate → TransferPlayback
          cb(null, '', '');
        } else if (callCount === 4) {
          // Recovery: checkConnection → _discoverDbusDest → ListNames
          cb(null, `array [\n  string "org.mpris.MediaPlayer2.spotifyd.instance999"\n]`, '');
        } else if (callCount === 5) {
          // Recovery: checkConnection → Properties.Get
          cb(null, 'variant       string "Playing"', '');
        } else {
          // Call 6: checkConnection._refreshMetadata (fire-and-forget)
          // Call 7: Retry of the original Play command
          cb(null, '', '');
        }
      });
      await spotifyService.play();
      expect(spotifyService.state).toBe('playing');
      expect(spotifyService._recovering).toBe(false);
    });

    it('should throw if recovery also fails', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      mockExecFileError('org.freedesktop.DBus.Error.ServiceUnknown');
      await expect(spotifyService.play()).rejects.toThrow();
    });

    it('should not recurse infinitely on repeated failures', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance123';
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        cb(new Error('D-Bus error'), '', '');
      });
      await expect(spotifyService.play()).rejects.toThrow();
      expect(callCount).toBeLessThan(20);
    });
  });

  describe('cache verification', () => {
    it('should return verified when cache directory has tracks', async () => {
      jest.spyOn(require('fs').promises, 'readdir').mockResolvedValue(['track1.ogg', 'track2.ogg']);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('verified');
      expect(status.trackCount).toBe(2);
    });

    it('should return missing when cache directory is empty', async () => {
      jest.spyOn(require('fs').promises, 'readdir').mockResolvedValue([]);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('missing');
    });

    it('should return missing when cache directory does not exist (ENOENT)', async () => {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      jest.spyOn(require('fs').promises, 'readdir').mockRejectedValue(err);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('missing');
      expect(status.message).toBe('Cache directory not found');
    });
  });

  describe('pause cascade', () => {
    it('should track pausedByGameClock flag', async () => {
      mockExecFileSuccess('');
      await spotifyService.play(); // Set state to 'playing' first
      await spotifyService.pauseForGameClock();
      expect(spotifyService.isPausedByGameClock()).toBe(true);
    });

    it('should resume only if paused by game clock', async () => {
      mockExecFileSuccess('');
      await spotifyService.play(); // Set state to 'playing' first
      await spotifyService.pauseForGameClock();
      await spotifyService.resumeFromGameClock();
      expect(spotifyService.isPausedByGameClock()).toBe(false);
    });

    it('should NOT resume if GM manually paused', async () => {
      mockExecFileSuccess('');
      await spotifyService.pause(); // GM manual pause
      // Game clock resume should not unpause
      expect(spotifyService.isPausedByGameClock()).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit playback:changed on play', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.play();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('should emit playback:changed on next', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.next();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('should emit playback:changed on previous', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.previous();
      expect(handler).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('should emit playback:changed on pause', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.pause();
      expect(handler).toHaveBeenCalledWith({ state: 'paused' });
    });

    it('should emit playback:changed on stop', async () => {
      const handler = jest.fn();
      spotifyService.on('playback:changed', handler);
      mockExecFileSuccess('');
      await spotifyService.stop();
      expect(handler).toHaveBeenCalledWith({ state: 'stopped' });
    });
  });

  describe('_parseMetadata', () => {
    it('should parse title and artist from D-Bus metadata output', () => {
      const stdout = `
        dict entry(
          string "xesam:title"
          variant             string "Midnight City"
        )
        dict entry(
          string "xesam:artist"
          variant             array [
            string "M83"
          ]
        )
      `;
      const result = spotifyService._parseMetadata(stdout);
      expect(result).toEqual({ title: 'Midnight City', artist: 'M83' });
    });

    it('should return null when no title present', () => {
      const stdout = `dict entry(\n  string "xesam:artist"\n  variant string "M83"\n)`;
      const result = spotifyService._parseMetadata(stdout);
      expect(result).toBeNull();
    });

    it('should return null for empty/null input', () => {
      expect(spotifyService._parseMetadata(null)).toBeNull();
      expect(spotifyService._parseMetadata('')).toBeNull();
    });

    it('should default artist to Unknown Artist when missing', () => {
      const stdout = `dict entry(\n  string "xesam:title"\n  variant             string "Untitled"\n)`;
      const result = spotifyService._parseMetadata(stdout);
      expect(result).toEqual({ title: 'Untitled', artist: 'Unknown Artist' });
    });
  });

  describe('_refreshMetadata', () => {
    it('should update track and return true when metadata changes', async () => {
      const metadataOutput = `dict entry(\n  string "xesam:title"\n  variant             string "New Song"\n  string "xesam:artist"\n  variant             array [\n    string "Artist"\n  ]\n)`;
      mockExecFileSuccess(metadataOutput);
      const changed = await spotifyService._refreshMetadata();
      expect(changed).toBe(true);
      expect(spotifyService.track).toEqual({ title: 'New Song', artist: 'Artist' });
    });

    it('should return false when metadata stays the same', async () => {
      spotifyService.track = { title: 'Same', artist: 'Artist' };
      const metadataOutput = `dict entry(\n  string "xesam:title"\n  variant             string "Same"\n  string "xesam:artist"\n  variant             array [\n    string "Artist"\n  ]\n)`;
      mockExecFileSuccess(metadataOutput);
      const changed = await spotifyService._refreshMetadata();
      expect(changed).toBe(false);
    });

    it('should return false on D-Bus error', async () => {
      mockExecFileError('D-Bus error');
      const changed = await spotifyService._refreshMetadata();
      expect(changed).toBe(false);
    });

    it('should emit track:changed when track changes to a new value', async () => {
      const handler = jest.fn();
      spotifyService.on('track:changed', handler);
      const metadataOutput = `dict entry(\n  string "xesam:title"\n  variant             string "Track"\n  string "xesam:artist"\n  variant             array [\n    string "Band"\n  ]\n)`;
      mockExecFileSuccess(metadataOutput);
      await spotifyService._refreshMetadata();
      expect(handler).toHaveBeenCalledWith({ track: { title: 'Track', artist: 'Band' } });
    });

    it('should NOT emit track:changed when metadata is null', async () => {
      const handler = jest.fn();
      spotifyService.on('track:changed', handler);
      mockExecFileSuccess('no metadata here');
      await spotifyService._refreshMetadata();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('track:changed after transport', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule metadata refresh after next()', async () => {
      mockExecFileSuccess('');
      const spy = jest.spyOn(spotifyService, '_refreshMetadata').mockResolvedValue(true);
      await spotifyService.next();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);
      expect(spy).toHaveBeenCalled();
    });

    it('should schedule metadata refresh after play()', async () => {
      mockExecFileSuccess('');
      const spy = jest.spyOn(spotifyService, '_refreshMetadata').mockResolvedValue(true);
      await spotifyService.play();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);
      expect(spy).toHaveBeenCalled();
    });

    it('should NOT schedule metadata refresh after pause()', async () => {
      mockExecFileSuccess('');
      const spy = jest.spyOn(spotifyService, '_refreshMetadata').mockResolvedValue(true);
      await spotifyService.pause();
      jest.advanceTimersByTime(500);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should handle metadata refresh failure gracefully', async () => {
      mockExecFileSuccess('');
      jest.spyOn(spotifyService, '_refreshMetadata').mockRejectedValue(new Error('fail'));
      await spotifyService.next();
      // Should not throw
      jest.advanceTimersByTime(200);
    });
  });

  describe('getState', () => {
    it('should include track in state', () => {
      spotifyService.track = { title: 'Song', artist: 'Artist' };
      const state = spotifyService.getState();
      expect(state.track).toEqual({ title: 'Song', artist: 'Artist' });
    });

    it('should return null track when not set', () => {
      const state = spotifyService.getState();
      expect(state.track).toBeNull();
    });
  });

  describe('_buildDbusArgs', () => {
    it('should build correct args array', () => {
      const args = spotifyService._buildDbusArgs('org.test', 'org.test.Method', ['arg1']);
      expect(args).toEqual([
        '--session', '--type=method_call', '--print-reply',
        '--dest=org.test', '/org/mpris/MediaPlayer2',
        'org.test.Method', 'arg1'
      ]);
    });
  });

  describe('D-Bus cache TTL', () => {
    beforeEach(() => {
      spotifyService.reset();
      jest.spyOn(spotifyService, '_activationDelay').mockResolvedValue();
    });

    it('should re-discover MPRIS dest after TTL expires', async () => {
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance1';
      spotifyService._dbusCacheTime = Date.now() - 400000; // 6+ min ago (TTL = 5 min)

      jest.spyOn(spotifyService, '_findDbusDest').mockResolvedValue('org.mpris.MediaPlayer2.spotifyd.instance2');

      const dest = await spotifyService._discoverDbusDest();
      expect(dest).toBe('org.mpris.MediaPlayer2.spotifyd.instance2');
      expect(spotifyService._findDbusDest).toHaveBeenCalled();
    });

    it('should return cached MPRIS dest within TTL', async () => {
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance1';
      spotifyService._dbusCacheTime = Date.now(); // just cached

      jest.spyOn(spotifyService, '_findDbusDest');

      const dest = await spotifyService._discoverDbusDest();
      expect(dest).toBe('org.mpris.MediaPlayer2.spotifyd.instance1');
      expect(spotifyService._findDbusDest).not.toHaveBeenCalled();
    });

    it('should re-discover native spotifyd dest after TTL expires', async () => {
      spotifyService._spotifydDest = 'rs.spotifyd.instance100';
      spotifyService._spotifydCacheTime = Date.now() - 400000;

      jest.spyOn(spotifyService, '_findDbusDest').mockResolvedValue('rs.spotifyd.instance200');

      const dest = await spotifyService._discoverSpotifydDest();
      expect(dest).toBe('rs.spotifyd.instance200');
    });

    it('should clear cache timestamps on reset', () => {
      spotifyService._dbusCacheTime = Date.now();
      spotifyService._spotifydCacheTime = Date.now();
      spotifyService.reset();
      expect(spotifyService._dbusCacheTime).toBe(0);
      expect(spotifyService._spotifydCacheTime).toBe(0);
    });
  });

  describe('_ensureConnection', () => {
    beforeEach(() => {
      spotifyService.reset();
      spotifyService._dbusCacheTime = Date.now();
      jest.spyOn(spotifyService, '_activationDelay').mockResolvedValue();
    });

    it('should pass when already connected', async () => {
      spotifyService.connected = true;
      jest.spyOn(spotifyService, 'checkConnection');

      await spotifyService._ensureConnection();
      expect(spotifyService.checkConnection).not.toHaveBeenCalled();
    });

    it('should run checkConnection when disconnected', async () => {
      spotifyService.connected = false;
      jest.spyOn(spotifyService, 'checkConnection').mockResolvedValue(true);

      await spotifyService._ensureConnection();
      expect(spotifyService.checkConnection).toHaveBeenCalled();
    });

    it('should throw when checkConnection fails', async () => {
      spotifyService.connected = false;
      jest.spyOn(spotifyService, 'checkConnection').mockResolvedValue(false);

      await expect(spotifyService._ensureConnection())
        .rejects.toThrow('Spotify not connected');
    });
  });

  describe('_transport calls _ensureConnection', () => {
    beforeEach(() => {
      spotifyService.reset();
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd';
      spotifyService._dbusCacheTime = Date.now();
      spotifyService.connected = true;
      jest.spyOn(spotifyService, '_activationDelay').mockResolvedValue();
    });

    it('should validate connection before D-Bus call', async () => {
      jest.spyOn(spotifyService, '_ensureConnection').mockResolvedValue();
      jest.spyOn(spotifyService, '_dbusCall').mockResolvedValue({});

      await spotifyService.play();
      expect(spotifyService._ensureConnection).toHaveBeenCalled();
    });

    it('should reject when not connected', async () => {
      jest.spyOn(spotifyService, '_ensureConnection').mockRejectedValue(
        new Error('Spotify not connected')
      );

      await expect(spotifyService.play()).rejects.toThrow('Spotify not connected');
    });
  });
});
