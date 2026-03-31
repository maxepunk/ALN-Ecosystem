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

// Reset module between tests to clear module-level state
// (browserProcess, windowId, visible are module-level vars)
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(true);
    });

    test('returns false if window not found after launch', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // xdotool search always fails (no window found)
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') {
          cb(new Error('no windows found'), '', '');
        } else {
          cb(null, '', '');
        }
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(false);
    });
  });

  describe('hideScoreboard()', () => {
    test('uses xdotool windowminimize, does NOT kill process', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
      // No showScoreboard called — windowId is null
      const result = await displayDriver.hideScoreboard();
      expect(result).toBe(true);
    });

    test('returns true even if xdotool windowminimize fails (non-fatal)', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      expect(displayDriver.isScoreboardVisible()).toBe(true);

      await displayDriver.hideScoreboard();
      expect(displayDriver.isScoreboardVisible()).toBe(false);
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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
      expect(status).toHaveProperty('windowId');
      expect(status).toHaveProperty('display');
      expect(status).toHaveProperty('scoreboardUrl');
    });

    test('reflects current state after showScoreboard', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      const status = displayDriver.getStatus();

      expect(status.scoreboardVisible).toBe(true);
      expect(status.browserPid).toBe(1234);
      expect(status.windowId).toBe('12345678');
    });
  });

  describe('cleanup()', () => {
    test('kills browser process on cleanup', async () => {
      const { spawn, execFile } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
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

    test('runs pkill fallback after tracked process cleanup', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false, kill: jest.fn() };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();
      execFileSync.mockClear(); // Clear calls from _doLaunch orphan cleanup
      await displayDriver.cleanup();

      expect(execFileSync).toHaveBeenCalledWith(
        'pkill',
        ['-f', 'chromium.*--kiosk'],
        { timeout: 3000 }
      );
    });

    test('pkill fallback does not throw if no Chromium running', async () => {
      const { execFileSync } = require('child_process');
      execFileSync.mockImplementation(() => { throw new Error('no process found'); });

      // cleanup with no browser process — pkill throws but cleanup succeeds
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
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
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.ensureBrowserRunning();
      const result = await displayDriver.ensureBrowserRunning();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  describe('orphan Chromium cleanup', () => {
    test('kills orphaned Chromium before spawning new one in _doLaunch', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      await displayDriver.showScoreboard();

      // execFileSync (pkill) must have been called BEFORE spawn
      expect(execFileSync).toHaveBeenCalledWith(
        'pkill',
        ['-f', 'chromium.*--kiosk'],
        { timeout: 3000 }
      );

      // Verify pkill was called before spawn by checking call order
      const pkillCallOrder = execFileSync.mock.invocationCallOrder[0];
      const spawnCallOrder = spawn.mock.invocationCallOrder[0];
      expect(pkillCallOrder).toBeLessThan(spawnCallOrder);
    });

    test('proceeds with launch even if no orphaned Chromium exists', async () => {
      const { spawn, execFile, execFileSync } = require('child_process');
      const mockProc = { pid: 1234, on: jest.fn(), killed: false };
      spawn.mockReturnValue(mockProc);

      // pkill throws when no matching process — should not prevent launch
      execFileSync.mockImplementation(() => { throw new Error('no process found'); });

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; }
        if (cmd === 'xdotool' && args[0] === 'search') cb(null, '12345678\n', '');
        else cb(null, '', '');
      });

      const result = await displayDriver.showScoreboard();
      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('chromium-browser', expect.any(Array), expect.any(Object));
    });
  });
});
