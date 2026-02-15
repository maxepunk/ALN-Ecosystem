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

    it('should clear cached destination on reset', () => {
      spotifyService._dbusDest = 'org.mpris.MediaPlayer2.spotifyd.instance99';
      spotifyService.reset();
      expect(spotifyService._dbusDest).toBeNull();
    });
  });

  describe('cache verification', () => {
    it('should return verified when cache directory has tracks', async () => {
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'readdirSync').mockReturnValue(['track1.ogg', 'track2.ogg']);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('verified');
    });

    it('should return missing when cache directory is empty', async () => {
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      jest.spyOn(require('fs'), 'readdirSync').mockReturnValue([]);
      const status = await spotifyService.verifyCacheStatus();
      expect(status.status).toBe('missing');
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
  });
});
