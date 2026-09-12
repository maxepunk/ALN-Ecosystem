/**
 * Unit tests for displayDriver utility
 * Tests persistent-Chromium window management approach:
 * - Launch once, show/hide via xdotool (not kill/spawn)
 * - hideScoreboard uses windowminimize (not kill)
 * - cleanup() is the only place that kills the process
 */

jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execFile: jest.fn(),
  execFileSync: jest.fn(),
}));

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs');
  return {
    ...realFs,
    readFileSync: jest.fn((...args) => {
      // PID file reads are mocked; everything else uses real fs
      if (typeof args[0] === 'string' && (args[0].includes('aln-pm-') || args[0].includes('/proc/'))) {
        throw new Error('ENOENT');
      }
      return realFs.readFileSync(...args);
    }),
    writeFileSync: jest.fn((...args) => {
      // PID file writes are mocked; everything else uses real fs
      if (typeof args[0] === 'string' && args[0].includes('aln-pm-')) return;
      return realFs.writeFileSync(...args);
    }),
    unlinkSync: jest.fn((...args) => {
      // PID file unlinks are mocked; everything else uses real fs
      if (typeof args[0] === 'string' && args[0].includes('aln-pm-')) return;
      return realFs.unlinkSync(...args);
    }),
  };
});

// Reset module between tests to clear module-level state
// (browserProcess, visible are module-level vars)
let displayDriver;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  displayDriver = require('../../../src/utils/displayDriver');
});

describe('displayDriver — window management', () => {
  describe('showScoreboard()', () => {
    test('launches Chromium on first call', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      expect(spawn).toHaveBeenCalledWith(
        'chromium-browser',
        expect.any(Array),
        expect.any(Object)
      );
    });

    test('CHROMIUM_BIN env overrides the browser binary (rung-1 seam)', async () => {
      // The rung-1 harness has Chromium at a non-default path
      // (Playwright's build); the venue Pi has chromium-browser on
      // PATH. Same seam class as PACK_PATH / PROFILE_PATH / DATA_DIR.
      process.env.CHROMIUM_BIN = '/opt/pw-browsers/chromium';
      try {
        const { spawn, execFile } = require('child_process');
        const mockProc = { pid: 1234, on: jest.fn(), killed: false };
        spawn.mockReturnValue(mockProc);
        execFile.mockImplementation((cmd, args, opts, cb) => {
          if (typeof opts === 'function') { cb = opts; }
          if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
          else cb(null, '', '');
        });

        await displayDriver.showScoreboard();

        expect(spawn).toHaveBeenCalledWith(
          '/opt/pw-browsers/chromium',
          expect.any(Array),
          expect.any(Object)
        );
      } finally {
        delete process.env.CHROMIUM_BIN;
      }
    });

    test('searches xdotool with the CONFIG window marker — never a hardcoded literal (slice 3a pre-fix 1)', async () => {
      // The driver half of the "Case File" booby-trap coupling
      // (capability-matrix 2.5): before this pin, the mocks above match
      // `--name` by POSITION only, so a rebrand of the search literal
      // passed CI and broke HDMI control at runtime. The page half +
      // cross-file tripwire live in scoreboardWindowMarker.test.js.
      const config = require('../../../src/config');
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);
      const searchValues = [];
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
          searchValues.push(args[2]);
          cb(null, '12345678\n', '');
        } else cb(null, '', '');
      });

      // Mutation-proof: the config DEFAULT equals the old hardcoded
      // literal, so asserting against the default would stay green if
      // the driver re-baked it. Search must follow a RUNTIME override.
      const original = config.display.scoreboardWindowMarker;
      try {
        config.display.scoreboardWindowMarker = 'MUTATION-SENTINEL-MARKER';
        await displayDriver.showScoreboard();
      } finally {
        config.display.scoreboardWindowMarker = original;
      }

      expect(searchValues.length).toBeGreaterThan(0);
      expect(new Set(searchValues)).toEqual(new Set(['MUTATION-SENTINEL-MARKER']));
    });

    test('returns false when the browser cannot launch (!running arm — deflaked coverage pin)', async () => {
      // This arm's coverage used to depend on suite interleaving — the
      // recurring ratchet flake. Force the launch failure deterministically.
      const { spawn, execFile } = require('child_process');
      // Chromium spawns but dies during the 1s alive-check (the handled
      // early-crash path: on('exit') nulls browserProcess → return false)
      spawn.mockReturnValue({
        pid: 4321,
        killed: false,
        on: jest.fn((event, handler) => { if (event === 'exit') setImmediate(handler); }),
      });
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') cb = opts;
        cb(null, '', '');
      });

      let freshDriver;
      jest.isolateModules(() => {
        freshDriver = require('../../../src/utils/displayDriver');
      });
      await expect(freshDriver.showScoreboard()).resolves.toBe(false);
    });

    test('covers the remaining branch arms deterministically (100% pin)', async () => {
      const { spawn, execFile } = require('child_process');
      const fsMock = require('fs');
      // Orphan PID file contains GARBAGE (isNaN arm at recovery) and
      // xdotool search returns NO windows (empty idList arm)
      const realRead = fsMock.readFileSync;
      fsMock.readFileSync = jest.fn((p, enc) => {
        if (String(p).includes('aln-pm-scoreboard-chromium.pid')) return 'garbage-pid';
        return realRead(p, enc);
      });
      const procHandlers = {};
      spawn.mockReturnValue({
        pid: 7777, killed: false,
        on: jest.fn((ev, h) => { procHandlers[ev] = h; }),
      });
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') cb = opts;
        // '\n' is TRUTHY but filters to an empty id list — hits the
        // length>0 false-arm (a bare '' short-circuits at `if (ids)`)
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '\n', '');
        else cb(null, '', '');
      });
      let freshDriver;
      const savedPort = process.env.PORT;
      process.env.PORT = ''; // falsy → module-load PORT-default arm
      jest.isolateModules(() => {
        freshDriver = require('../../../src/utils/displayDriver');
      });
      if (savedPort === undefined) delete process.env.PORT;
      else process.env.PORT = savedPort;
      // Two CONCURRENT calls: the second must reuse launchPromise (memo arm)
      const [a, b] = await Promise.all([
        freshDriver.showScoreboard(),
        freshDriver.showScoreboard(),
      ]);
      expect(spawn).toHaveBeenCalledTimes(1); // launchPromise memo held
      // browser launched but the window was never found → both false
      expect(a).toBe(false);
      expect(b).toBe(false);
      fsMock.readFileSync = realRead;
    });

    test('does NOT relaunch Chromium on subsequent calls', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      await displayDriver.showScoreboard();

      expect(spawn).toHaveBeenCalledTimes(1);
    });

    test('uses windowactivate and wmctrl fullscreen on subsequent calls', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      const calls = [];
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        calls.push({ cmd, args });
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      // First call: spawns and finds window
      await displayDriver.showScoreboard();
      calls.length = 0; // Reset tracking for second call

      // Second call: should NOT spawn, should use window management
      await displayDriver.showScoreboard();

      const xdotoolCalls = calls.filter(c => c.cmd === 'xdotool');
      const wmctrlCalls = calls.filter(c => c.cmd === 'wmctrl');

      // Should activate the window
      expect(xdotoolCalls.some(c => c.args[0] === 'windowactivate')).toBe(true);
      // Should force fullscreen via wmctrl
      expect(wmctrlCalls.length).toBeGreaterThan(0);
      expect(wmctrlCalls.some(c => c.args.includes('add,fullscreen'))).toBe(true);
    });

    test('returns true on success', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(true);
    });

    // Production-relevant failure paths. These run on the Pi when Chromium crashes
    // or window management fails; previously they were only covered incidentally on
    // ubuntu CI (no Chromium). Drive them deterministically so they're tested on any host.
    test('browser process "error" event clears state (Chromium crash)', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      expect(displayDriver.getStatus().browserPid).toBe(1234);

      // Simulate Chromium emitting 'error' after launch (e.g. GPU init failure / crash)
      const errorHandler = mockProc.on.mock.calls.find(([evt]) => evt === 'error')[1];
      errorHandler(new Error('chromium crashed'));

      const status = displayDriver.getStatus();
      expect(status.browserPid).toBeNull();
      expect(status.scoreboardVisible).toBe(false);
    });

    test('returns false when window activation fails', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else if (cmd === 'xdotool' && args[0] === 'windowactivate') cb(new Error('xdotool windowactivate failed'), '', '');
        else cb(null, '', '');
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(false);
    });

    test('launch survives a PID-file write failure (best-effort)', async () => {
      const { spawn, execFile } = require('child_process');
      const fs = require('fs');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });
      // The PID file write (orphan-recovery aid) is best-effort — if it throws,
      // launch must still succeed.
      fs.writeFileSync.mockImplementationOnce(() => { throw new Error('disk full'); });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(true);
    });

    test('returns false when browser running but window title not found', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // xdotool search --name always fails (no window with matching title)
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
          cb(new Error('no windows found'), '', '');
        } else {
          cb(null, '', '');
        }
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(false);
    });

    test('looks up window ID fresh on every showScoreboard call (no caching)', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      let searchCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
          searchCount++;
          cb(null, '12345678\n', '');
        } else {
          cb(null, '', '');
        }
      });

      await displayDriver.showScoreboard();
      await displayDriver.showScoreboard();
      await displayDriver.showScoreboard();

      expect(searchCount).toBe(3);
    });

  });

  describe('hideScoreboard()', () => {
    test('uses xdotool windowminimize, does NOT kill process', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      await displayDriver.hideScoreboard();

      // Process must NOT be killed
      expect(mockProc.kill).not.toHaveBeenCalled();

      // Should have called xdotool windowminimize
      expect(execFile).toHaveBeenCalledWith(
        'xdotool',
        expect.arrayContaining(['windowminimize']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    test('returns true when no window is tracked (no-op)', async () => {
      const { execFile } = require('child_process');
      // No browser launched — _findScoreboardWindow() returns null
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
          cb(new Error('no windows found'), '', '');
        } else {
          cb(null, '', '');
        }
      });

      const result = await displayDriver.hideScoreboard();
      expect(result).toBe(true);
    });

    test('returns true even if xdotool windowminimize fails (non-fatal)', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else if (cmd === 'xdotool' && args[0] === 'windowminimize') {
          cb(new Error('window not responding'), '', '');
        } else {
          cb(null, '', '');
        }
      });

      await displayDriver.showScoreboard();
      const result = await displayDriver.hideScoreboard();
      expect(result).toBe(true); // Non-fatal
    });

    test('sets visible to false', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      expect(displayDriver.isScoreboardVisible()).toBe(true);

      await displayDriver.hideScoreboard();
      expect(displayDriver.isScoreboardVisible()).toBe(false);
    });

    test('looks up window ID fresh on every hideScoreboard call', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      let searchCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') {
          searchCount++;
          cb(null, '12345678\n', '');
        } else {
          cb(null, '', '');
        }
      });

      await displayDriver.ensureBrowserRunning();
      searchCount = 0;
      await displayDriver.hideScoreboard();
      await displayDriver.hideScoreboard();

      expect(searchCount).toBe(2);
    });
  });

  describe('isScoreboardVisible()', () => {
    test('returns false before showScoreboard is called', () => {
      expect(displayDriver.isScoreboardVisible()).toBe(false);
    });

    test('returns true after successful showScoreboard', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      expect(displayDriver.isScoreboardVisible()).toBe(true);
    });
  });

  describe('getStatus()', () => {
    test('returns status object with expected fields', () => {
      const status = displayDriver.getStatus();
      expect(status).toHaveProperty('scoreboardVisible');
      expect(status).toHaveProperty('browserPid');
      expect(status).toHaveProperty('display');
      expect(status).toHaveProperty('scoreboardUrl');
    });

    test('reflects current state after showScoreboard', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      const status = displayDriver.getStatus();

      expect(status.scoreboardVisible).toBe(true);
      expect(status.browserPid).toBe(1234);
    });
  });

  describe('cleanup()', () => {
    test('kills browser process on cleanup', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      await displayDriver.cleanup();

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('no-ops if no browser process is running', async () => {
      // Should not throw
      await expect(displayDriver.cleanup()).resolves.not.toThrow();
    });

    test('removes PID file on cleanup after tracked process', async () => {
      const fs = require('fs');
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      await displayDriver.cleanup();

      // PID file should have been written on launch, then removed on cleanup
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('aln-pm-scoreboard-chromium.pid'),
        '1234'
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('aln-pm-scoreboard-chromium.pid')
      );
    });

    test('cleanup does not throw if PID file missing', async () => {
      const fs = require('fs');
      fs.unlinkSync.mockImplementation(() => { throw new Error('ENOENT'); });

      // cleanup with no browser process — PID file removal throws but cleanup succeeds
      await expect(displayDriver.cleanup()).resolves.not.toThrow();
    });

    test('escalates to SIGKILL when process survives SIGTERM', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      // process.kill(pid, 0) not throwing = process still alive after SIGTERM
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      try {
        await displayDriver.cleanup();

        // Should have probed with signal 0, then sent SIGKILL
        expect(killSpy).toHaveBeenCalledWith(1234, 0);
        expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
      } finally {
        killSpy.mockRestore();
      }
    });

    test('does not SIGKILL when process dies from SIGTERM', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      // process.kill(pid, 0) throwing ESRCH = process already dead
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        const err = new Error('ESRCH');
        err.code = 'ESRCH';
        throw err;
      });
      try {
        await displayDriver.cleanup();

        // Should have probed with signal 0 but NOT sent SIGKILL
        expect(killSpy).toHaveBeenCalledWith(1234, 0);
        expect(killSpy).not.toHaveBeenCalledWith(1234, 'SIGKILL');
      } finally {
        killSpy.mockRestore();
      }
    });
  });

  describe('ensureBrowserRunning()', () => {
    test('is exported and callable', () => {
      expect(typeof displayDriver.ensureBrowserRunning).toBe('function');
    });

    test('launches Chromium and returns true when spawn succeeds', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        cb(null, '', '');
      });

      const result = await displayDriver.ensureBrowserRunning();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    test('returns true without relaunching on second call', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        cb(null, '', '');
      });

      await displayDriver.ensureBrowserRunning();
      const result = await displayDriver.ensureBrowserRunning();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    test('returns false if Chromium crashes during startup', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // pkill finds no orphans (throws = no matching processes)
      execFileSync.mockImplementation(() => { throw new Error('no process found'); });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        cb(null, '', '');
      });

      // Simulate Chromium crashing: trigger the exit handler during the 1s alive check
      // The on('exit') handler is registered as the second .on() call
      const onExitHandler = () => {
        const exitCb = mockProc.on.mock.calls.find(c => c[0] === 'exit')?.[1];
        if (exitCb) exitCb(1, null); // exit code 1
      };
      // Trigger after spawn but before the 1s check completes
      setTimeout(onExitHandler, 100);

      const result = await displayDriver.ensureBrowserRunning();
      expect(result).toBe(false);
    });
  });

  describe('orphan Chromium cleanup', () => {
    test('kills orphaned Chromium via PID file before spawning new one', async () => {
      const fs = require('fs');
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // Simulate PID file from previous crashed server with a chromium process
      const readCalls = [];
      fs.readFileSync.mockImplementation((path) => {
        readCalls.push(path);
        if (path.includes('aln-pm-scoreboard-chromium.pid')) return '9999';
        if (path.includes('/proc/9999/cmdline')) return 'chromium-browser\0--kiosk\0';
        throw new Error('ENOENT');
      });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      try {
        await displayDriver.showScoreboard();

        // Should have killed the orphan PID from the PID file
        expect(killSpy).toHaveBeenCalledWith(9999, 'SIGKILL');
        // Should have spawned new Chromium after orphan cleanup
        expect(spawn).toHaveBeenCalledWith('chromium-browser', expect.any(Array), expect.any(Object));
      } finally {
        killSpy.mockRestore();
      }
    });

    test('proceeds with launch when no PID file exists', async () => {
      const fs = require('fs');
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // No PID file — readFileSync throws
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('chromium-browser', expect.any(Array), expect.any(Object));
    });

    test('skips 2-second wait when no orphaned Chromium was running', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // pkill throws when no matching process (exit code 1)
      execFileSync.mockImplementation(() => { throw new Error('no process found'); });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const start = Date.now();
      await displayDriver.showScoreboard();
      const elapsed = Date.now() - start;

      // _doLaunch() has a 1000ms alive check after spawn.
      // Without an orphan to kill, total should be ~1000ms (no 2s orphan wait).
      expect(elapsed).toBeLessThan(2500);
    });
  });
});

describe('displayDriver — module-load environment fallbacks', () => {
  // These branches evaluate at require() time from the host environment
  // (network interfaces, DISPLAY, PORT). Pin them deterministically so file
  // coverage does not vary by machine (CI runners have different interface
  // sets than dev machines — this exact variance turned CI red while local
  // runs were green).
  const freshRequire = () => {
    let mod;
    jest.isolateModules(() => {
      mod = require('../../../src/utils/displayDriver');
    });
    return mod;
  };

  afterEach(() => {
    delete process.env.PORT;
    delete process.env.DISPLAY;
    jest.dontMock('os');
  });

  test('scoreboard URL falls back to localhost when no external IPv4 exists', () => {
    jest.doMock('os', () => ({
      ...jest.requireActual('os'),
      networkInterfaces: () => ({
        lo: [
          { internal: true, family: 'IPv4', address: '127.0.0.1' },
          { internal: false, family: 'IPv6', address: '::1' },
        ],
      }),
    }));
    delete process.env.PORT;

    const status = freshRequire().getStatus();
    expect(status.scoreboardUrl).toContain('https://localhost:3000/scoreboard');
  });

  test('scoreboard URL uses the first external IPv4 and honors PORT', () => {
    jest.doMock('os', () => ({
      ...jest.requireActual('os'),
      networkInterfaces: () => ({
        lo: [{ internal: true, family: 'IPv4', address: '127.0.0.1' }],
        eth0: [
          { internal: false, family: 'IPv6', address: 'fe80::1' },
          { internal: false, family: 'IPv4', address: '192.0.2.7' },
        ],
      }),
    }));
    process.env.PORT = '4444';

    const status = freshRequire().getStatus();
    expect(status.scoreboardUrl).toContain('https://192.0.2.7:4444/scoreboard');
  });

  test('DISPLAY defaults to :0 when unset and honors the env value when set', () => {
    delete process.env.DISPLAY;
    expect(freshRequire().getStatus().display).toBe(':0');

    process.env.DISPLAY = ':5';
    expect(freshRequire().getStatus().display).toBe(':5');
  });
});

describe('displayDriver — deterministic branch coverage (CI-environment parity)', () => {
  // Cover the else-arms that full-suite runs only hit incidentally on some
  // hosts — file coverage must not depend on the machine running the tests.
  test('showScoreboard returns false when xdotool search finds no window', async () => {
    const { spawn, execFile } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '', '');
      else cb(null, '', '');
    });

    const ok = await displayDriver.showScoreboard();
    expect(ok).toBe(false);
  });

  test('showScoreboard returns false when search output is whitespace only', async () => {
    const { spawn, execFile } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '\n', '');
      else cb(null, '', '');
    });

    const ok = await displayDriver.showScoreboard();
    expect(ok).toBe(false);
  });

  test('orphan recovery skips a PID whose cmdline is not chromium', async () => {
    const fs = require('fs');
    const { spawn, execFile } = require('child_process');
    fs.readFileSync.mockImplementation((p) => {
      if (typeof p === 'string' && p.includes('aln-pm-')) return '4242';
      if (typeof p === 'string' && p.includes('/proc/')) return 'node\0server.js';
      return jest.requireActual('fs').readFileSync(p);
    });
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    await displayDriver.showScoreboard();
    expect(killSpy).not.toHaveBeenCalledWith(4242, 'SIGKILL');
    killSpy.mockRestore();
  });
});

describe('displayDriver — PID-file write guard', () => {
  test('skips PID-file write when spawn returns a process without a pid', async () => {
    const fs = require('fs');
    const { spawn, execFile } = require('child_process');
    spawn.mockReturnValue({ on: jest.fn(), killed: false }); // no pid
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });

    await displayDriver.showScoreboard();
    const pidWrites = fs.writeFileSync.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('aln-pm-')
    );
    expect(pidWrites).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Block 2 T1a D9 — the display is the NINTH service (plan §3 pin P16,
// ruling R13). The kiosk is a piece of the venue like VLC or the lighting
// rig, and until now nothing on the health dashboard said whether it was
// alive. The driver owns the report because the driver is the only thing
// that knows.
// ══════════════════════════════════════════════════════════════════════
describe('displayDriver — health reporting (T1a D9, pin P16)', () => {
  let registry;

  const armExecFile = () => {
    const { execFile } = require('child_process');
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });
  };

  beforeEach(() => {
    registry = require('../../../src/services/serviceHealthRegistry');
    registry.clearDormant('display');
    registry.report('display', 'down', 'Not yet checked');
    jest.spyOn(registry, 'report');
  });

  afterEach(() => jest.restoreAllMocks());

  test('a successful launch reports display healthy', async () => {
    const { spawn } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    armExecFile();

    await displayDriver.ensureBrowserRunning();

    expect(registry.report).toHaveBeenCalledWith('display', 'healthy', 'kiosk launched');
  });

  test('a failed launch reports display down', async () => {
    const { spawn } = require('child_process');
    // The 'error' handler nulls browserProcess; the driver's alive check
    // then sees nothing and returns false.
    spawn.mockImplementation(() => {
      const proc = {
        pid: undefined, killed: false,
        on: (event, handler) => { if (event === 'error') setImmediate(() => handler(new Error('ENOENT'))); },
      };
      return proc;
    });
    armExecFile();

    const ok = await displayDriver.ensureBrowserRunning();

    expect(ok).toBe(false);
    expect(registry.report).toHaveBeenCalledWith('display', 'down', 'kiosk launch failed');
  });

  test('an exit while VISIBLE is down — the scoreboard vanished mid-show', async () => {
    const { spawn } = require('child_process');
    const handlers = {};
    spawn.mockReturnValue({
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
    });
    armExecFile();

    await displayDriver.showScoreboard();
    expect(displayDriver.isScoreboardVisible()).toBe(true);
    registry.report.mockClear();

    handlers.exit(1, null);

    // Block 2 T1a follow-up 2 (ruling 27): the visible-exit message now
    // carries code/signal, same as the hidden-crash message below.
    expect(registry.report).toHaveBeenCalledWith(
      'display', 'down', 'kiosk exited while visible (code 1, signal null)'
    );
  });

  test('an exit while HIDDEN stays healthy — it relaunches on the next show', async () => {
    // Chromium being closed while minimized is not a fault: nothing is
    // being displayed, and showScoreboard() relaunches. Reporting red here
    // would put a permanent alarm on a healthy idle system.
    const { spawn } = require('child_process');
    const handlers = {};
    spawn.mockReturnValue({
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
    });
    armExecFile();

    await displayDriver.ensureBrowserRunning();
    expect(displayDriver.isScoreboardVisible()).toBe(false);
    registry.report.mockClear();

    handlers.exit(0, null);

    expect(registry.report).toHaveBeenCalledWith(
      'display', 'healthy', 'kiosk closed while hidden; relaunches on show'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Block 2 T1a fix round 1, ruling 22: probe().
//
// `service:check` could ask eight of the nine services how they are and
// answered "Unknown service: display" for the ninth — the one service a GM
// is most likely to poke at, because the kiosk is the piece of equipment
// they can SEE. probe() is the read-only answer: it re-reports what the
// driver already knows and LAUNCHES NOTHING. A probe that launched would
// turn a pre-show health sweep into an unrequested takeover of the HDMI
// output while VLC was on it.
// ══════════════════════════════════════════════════════════════════════
describe('displayDriver — probe() (T1a fix round 1, ruling 22)', () => {
  let registry;

  const armExecFile = () => {
    const { execFile } = require('child_process');
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });
  };

  // jest.config.base.js pins ENABLE_VIDEO_PLAYBACK=false for the whole
  // unit run so nothing spawns a real VLC. That is the HOST-CONFIG arm of
  // probe(), which would shadow every other branch here — so each test
  // states the posture it is actually about instead of inheriting the
  // harness default, and the host-config test sets it back to 'false'.
  beforeEach(() => {
    process.env.ENABLE_VIDEO_PLAYBACK = 'true';
    jest.resetModules();
    displayDriver = require('../../../src/utils/displayDriver');
    registry = require('../../../src/services/serviceHealthRegistry');
    registry.clearDormant('display');
    registry.report('display', 'down', 'Not yet checked');
    jest.spyOn(registry, 'report');
  });

  afterEach(() => {
    process.env.ENABLE_VIDEO_PLAYBACK = 'false';
    jest.restoreAllMocks();
  });

  test('a live kiosk probes healthy and says so', async () => {
    const { spawn } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    armExecFile();
    await displayDriver.ensureBrowserRunning();
    registry.report.mockClear();

    expect(displayDriver.probe()).toBe(true);
    expect(registry.report).toHaveBeenCalledWith('display', 'healthy', 'kiosk running');
  });

  test('probe() LAUNCHES NOTHING — it is read-only', async () => {
    const { spawn } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    armExecFile();

    displayDriver.probe();

    expect(spawn).not.toHaveBeenCalled();
  });

  test('no kiosk while hidden stays healthy — it relaunches on the next show (R13)', () => {
    // Never launched, nothing visible: the idle posture. Red here would put
    // a permanent alarm on a system that is working exactly as intended.
    expect(displayDriver.isScoreboardVisible()).toBe(false);

    expect(displayDriver.probe()).toBe(true);
    expect(registry.report).toHaveBeenCalledWith(
      'display', 'healthy', 'kiosk closed while hidden; relaunches on show'
    );
  });

  test('no kiosk while it should be VISIBLE is down', async () => {
    const { spawn } = require('child_process');
    const proc = { pid: 1234, killed: false, on: jest.fn() };
    spawn.mockReturnValue(proc);
    armExecFile();
    await displayDriver.showScoreboard();
    expect(displayDriver.isScoreboardVisible()).toBe(true);

    // The process died but the driver still believes it is on screen — the
    // exit event has not been delivered yet, so `visible` is still true.
    // This is the same aliveness predicate ensureBrowserRunning() uses.
    proc.killed = true;
    registry.report.mockClear();

    expect(displayDriver.probe()).toBe(false);
    expect(registry.report).toHaveBeenCalledWith('display', 'down', 'kiosk not running');
  });

  test('host config wins over everything: video playback off is down', async () => {
    // A host with video playback disabled is not using this output at all,
    // whatever happens to be open on it — the same final word
    // displayControlService.init() gives the setting.
    process.env.ENABLE_VIDEO_PLAYBACK = 'false';
    jest.resetModules();
    const driver = require('../../../src/utils/displayDriver');
    const reg = require('../../../src/services/serviceHealthRegistry');
    reg.clearDormant('display');
    jest.spyOn(reg, 'report');

    const { spawn } = require('child_process');
    spawn.mockReturnValue({ pid: 1234, on: jest.fn(), killed: false });
    armExecFile();
    await driver.ensureBrowserRunning();   // a live kiosk...
    reg.report.mockClear();

    // ...still probes DOWN.
    expect(driver.probe()).toBe(false);
    expect(reg.report).toHaveBeenCalledWith(
      'display', 'down', 'video playback disabled (host config)'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════
// Block 2 T1a follow-up 2 — ruling 27 (refines ruling 13 / R13, T1a D9
// pin P16). CI Test run 297 saw a chromium-browser stub abort with
// SIGABRT a second after launch, WHILE HIDDEN. The old exit handler
// judged only by visibility and reported that crash "healthy" — a
// down → healthy transition that leaked an extra `health:changed` push
// into another test's 50ms debounce window
// (tests/integration/service-state-push.test.js). The fix judges by HOW
// the kiosk exited and WHETHER it had launched successfully:
//   - code 0, or the driver's own kill (`terminating`), after a
//     successful launch → healthy, "closed while hidden"
//   - anything else while hidden (non-zero code, a foreign signal, or an
//     exit before the launch's alive-check passed) → down, crash message
//   - visible → down (as before), message now carries code/signal too
// ══════════════════════════════════════════════════════════════════════
describe('displayDriver — exit-handler crash detection (T1a follow-up 2, ruling 27)', () => {
  let registry;

  const armExecFile = () => {
    const { execFile, execFileSync } = require('child_process');
    // Skip the 2s orphan-recovery wait — not what these tests are about.
    execFileSync.mockImplementation(() => { throw new Error('no matching process'); });
    execFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      if (cmd === 'xdotool' && args[0] === 'search' && args[1] === '--name') cb(null, '12345678\n', '');
      else cb(null, '', '');
    });
  };

  beforeEach(() => {
    registry = require('../../../src/services/serviceHealthRegistry');
    registry.clearDormant('display');
    registry.report('display', 'down', 'Not yet checked');
    jest.spyOn(registry, 'report');
  });

  afterEach(() => jest.restoreAllMocks());

  test('exit while hidden with SIGABRT after a successful launch is down, not healthy', async () => {
    const { spawn } = require('child_process');
    const handlers = {};
    spawn.mockReturnValue({
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
    });
    armExecFile();

    await displayDriver.ensureBrowserRunning();
    expect(displayDriver.isScoreboardVisible()).toBe(false);
    registry.report.mockClear();

    // The exit fires later, unrelated to any driver action — a real crash.
    handlers.exit(null, 'SIGABRT');

    expect(registry.report).toHaveBeenCalledWith(
      'display', 'down', 'kiosk crashed while hidden (code null, signal SIGABRT)'
    );
  });

  test('exit while hidden with a non-zero code after a successful launch is down', async () => {
    const { spawn } = require('child_process');
    const handlers = {};
    spawn.mockReturnValue({
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
    });
    armExecFile();

    await displayDriver.ensureBrowserRunning();
    registry.report.mockClear();

    handlers.exit(1, null);

    expect(registry.report).toHaveBeenCalledWith(
      'display', 'down', 'kiosk crashed while hidden (code 1, signal null)'
    );
  });

  test('exit while hidden with code 0 after a successful launch stays healthy', async () => {
    const { spawn } = require('child_process');
    const handlers = {};
    spawn.mockReturnValue({
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
    });
    armExecFile();

    await displayDriver.ensureBrowserRunning();
    registry.report.mockClear();

    handlers.exit(0, null);

    expect(registry.report).toHaveBeenCalledWith(
      'display', 'healthy', 'kiosk closed while hidden; relaunches on show'
    );
  });

  test("exit while hidden via the driver's own SIGTERM (cleanup) stays healthy — deliberate stop", async () => {
    const { spawn } = require('child_process');
    const handlers = {};
    const mockProc = {
      pid: 1234, killed: false,
      on: (event, handler) => { handlers[event] = handler; },
      kill: jest.fn(),
    };
    spawn.mockReturnValue(mockProc);
    armExecFile();

    await displayDriver.ensureBrowserRunning();
    expect(displayDriver.isScoreboardVisible()).toBe(false);
    registry.report.mockClear();

    // cleanup() sets the driver's own `terminating` flag and calls
    // kill('SIGTERM') synchronously before its internal 1s await — fire
    // the (mocked) process's exit now, as the real Chromium would.
    const cleanupPromise = displayDriver.cleanup();
    handlers.exit(null, 'SIGTERM');

    expect(registry.report).toHaveBeenCalledWith(
      'display', 'healthy', 'kiosk closed while hidden; relaunches on show'
    );

    await cleanupPromise;
  });

  test('exit while hidden BEFORE the alive-check passes (launch failed) is down and never flips healthy', async () => {
    const { spawn } = require('child_process');
    let exitHandler;
    spawn.mockReturnValue({
      pid: 4321, killed: false,
      on: (event, handler) => { if (event === 'exit') exitHandler = handler; },
    });
    armExecFile();

    const changes = [];
    const onChange = (e) => { if (e.serviceId === 'display') changes.push(e.status); };
    registry.on('health:changed', onChange);

    const launchResult = displayDriver.ensureBrowserRunning();
    // The chromium-browser stub aborts a second after launch — well
    // before the driver's own 1s alive-check completes.
    exitHandler(null, 'SIGABRT');

    const ok = await launchResult;
    registry.off('health:changed', onChange);

    expect(ok).toBe(false);
    expect(displayDriver.getStatus().browserPid).toBeNull();
    expect(registry.report).toHaveBeenCalledWith(
      'display', 'down', 'kiosk crashed while hidden (code null, signal SIGABRT)'
    );
    expect(registry.report).toHaveBeenCalledWith('display', 'down', 'kiosk launch failed');
    expect(registry.report).not.toHaveBeenCalledWith('display', 'healthy', expect.anything());
    // No down → healthy → down flap: the alive-check's own report never
    // needed to flip anything, so health:changed never reported 'healthy'.
    expect(changes).not.toContain('healthy');
  });
});
