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
        expect(killSpy).toHaveBeenCalledWith(9999, 'SIGTERM');
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

      // Without an orphan to kill, launch should NOT include the 2-second cleanup wait.
      // Allow generous margin for test execution overhead, but should be well under 2000ms.
      expect(elapsed).toBeLessThan(1500);
    });
  });
});
