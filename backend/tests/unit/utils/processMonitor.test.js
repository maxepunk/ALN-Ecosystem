/**
 * Unit tests for ProcessMonitor utility
 * Reusable self-healing spawned-process monitor.
 *
 * TDD: Written before implementation
 */

const EventEmitter = require('events');

jest.mock('child_process');
const { spawn } = require('child_process');

jest.mock('fs');
const fs = require('fs');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const ProcessMonitor = require('../../../src/utils/processMonitor');

// ── Helpers ──

// ProcessMonitor keeps only the BASENAME of a caller's pidFile and puts it in
// ALN_PIDFILE_DIR (see the module header). Callers still pass their /tmp paths,
// so assertions have to compare against the RESOLVED path.
const resolvePid = (p) => ProcessMonitor.resolvePidFile(p);

function createMockSpawnProc() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  proc.pid = 99999;
  return proc;
}

describe('ProcessMonitor', () => {
  let monitor;
  let mockProc;

  beforeEach(() => {
    jest.useFakeTimers();
    mockProc = createMockSpawnProc();
    spawn.mockReturnValue(mockProc);

    // Default: no PID file exists (clean boot). Overridden in orphan recovery tests.
    fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
    fs.writeFileSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});

    monitor = new ProcessMonitor({
      command: 'pactl',
      args: ['subscribe'],
      label: 'pactl-subscribe',
    });
  });

  afterEach(() => {
    monitor.stop();
    // Trigger close handler to clean up process.on('exit') handler
    // (exit handler removal moved from stop() to close handler)
    mockProc.emit('close', 0, null);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('start()', () => {
    it('should spawn process with correct command, args, and stdio', () => {
      monitor.start();
      expect(spawn).toHaveBeenCalledWith('pactl', ['subscribe'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    });

    it('should be idempotent (no-op if already running)', () => {
      monitor.start();
      monitor.start();
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should set isRunning() to true', () => {
      expect(monitor.isRunning()).toBe(false);
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it("handles spawn 'error' (e.g. binary not installed) without throwing — close drives the failure path", () => {
      const logger = require('../../../src/utils/logger');
      monitor.start();

      // Node emits 'error' then 'close' (code -2) when spawn fails (ENOENT).
      // Unhandled, the 'error' event would be an uncaughtException that
      // kills the whole orchestrator instead of degrading the one service.
      expect(() => {
        mockProc.emit('error', new Error('spawn pactl ENOENT'));
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'pactl-subscribe spawn failed',
        expect.objectContaining({ error: 'spawn pactl ENOENT', command: 'pactl' })
      );

      // The close handler still runs the normal failure-count/backoff path
      mockProc.emit('close', -2, null);
      expect(monitor.isRunning()).toBe(false);
    });
  });

  describe('line-buffered stdout', () => {
    it('should emit line events for each complete stdout line', () => {
      monitor.start();
      const lines = [];
      monitor.on('line', (line) => lines.push(line));

      mockProc.stdout.emit('data', Buffer.from('line one\nline two\n'));
      expect(lines).toEqual(['line one', 'line two']);
    });

    it('should handle partial lines correctly (buffer keeps incomplete tail)', () => {
      monitor.start();
      const lines = [];
      monitor.on('line', (line) => lines.push(line));

      mockProc.stdout.emit('data', Buffer.from('partial'));
      expect(lines).toEqual([]);

      mockProc.stdout.emit('data', Buffer.from(' complete\n'));
      expect(lines).toEqual(['partial complete']);
    });

    it('should ignore empty/whitespace-only lines', () => {
      monitor.start();
      const lines = [];
      monitor.on('line', (line) => lines.push(line));

      mockProc.stdout.emit('data', Buffer.from('real\n\n   \nother\n'));
      expect(lines).toEqual(['real', 'other']);
    });
  });

  describe('stderr logging', () => {
    it('should log stderr at debug level', () => {
      const logger = require('../../../src/utils/logger');
      monitor.start();
      mockProc.stderr.emit('data', Buffer.from('some warning'));
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('stderr'),
        expect.objectContaining({ data: 'some warning' })
      );
    });
  });

  describe('auto-restart on process exit', () => {
    it('should auto-restart with exponential backoff when process exits', () => {
      monitor.start();
      spawn.mockClear();

      // Process exits without receiving data (immediate failure)
      mockProc.emit('close', 1);
      expect(spawn).not.toHaveBeenCalled();

      // After backoff delay (5000ms * 2^1 = 10000ms for first failure)
      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      jest.advanceTimersByTime(10000);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should reset failure count when process ran successfully (received data)', () => {
      monitor.start();

      // Send some data so receivedData = true
      mockProc.stdout.emit('data', Buffer.from('some data\n'));

      // Process exits after success
      spawn.mockClear();
      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 0);

      // Restart delay should be base delay (5000ms * 2^0 = 5000ms) since failures reset to 0
      jest.advanceTimersByTime(5000);
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should emit restarted event on restart', () => {
      monitor.start();
      const events = [];
      monitor.on('restarted', (data) => events.push(data));

      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 1);
      jest.advanceTimersByTime(10000);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(expect.objectContaining({ attempt: 1 }));
    });

    it('should give up after max consecutive failures and emit gave-up', () => {
      const gaveUpHandler = jest.fn();
      monitor.on('gave-up', gaveUpHandler);
      monitor.start();

      // Simulate 5 consecutive failures (default max)
      for (let i = 0; i < 5; i++) {
        const nextProc = createMockSpawnProc();
        spawn.mockReturnValue(nextProc);

        mockProc.emit('close', 1);
        jest.advanceTimersByTime(100000); // Advance past any backoff
        mockProc = nextProc;
      }

      // 5th failure should trigger gave-up (0-indexed: failures 1,2,3,4,5)
      // After the 5th process exits without data:
      mockProc.emit('close', 1);

      expect(gaveUpHandler).toHaveBeenCalledWith(
        expect.objectContaining({ failures: expect.any(Number) })
      );
    });

    it('should not restart after max failures', () => {
      monitor = new ProcessMonitor({
        command: 'test',
        args: [],
        label: 'test',
        maxFailures: 2,
      });
      monitor.start();

      // Fail twice
      const proc2 = createMockSpawnProc();
      spawn.mockReturnValue(proc2);
      mockProc.emit('close', 1);
      jest.advanceTimersByTime(100000);

      spawn.mockClear();
      proc2.emit('close', 1);
      jest.advanceTimersByTime(100000);

      // No more restarts
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    it('should kill process and prevent restart', () => {
      monitor.start();
      monitor.stop();

      expect(mockProc.kill).toHaveBeenCalled();
      expect(monitor.isRunning()).toBe(false);

      // Process close event should NOT trigger restart
      spawn.mockClear();
      mockProc.emit('close', 0);
      jest.advanceTimersByTime(100000);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should clear pending restart timers', () => {
      monitor.start();

      // Trigger a restart timer
      mockProc.emit('close', 1);

      // Stop before restart fires
      monitor.stop();

      spawn.mockClear();
      jest.advanceTimersByTime(100000);
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should clean up process.on("exit") handler when child exits after stop', () => {
      const removeSpy = jest.spyOn(process, 'removeListener');
      monitor.start();
      monitor.stop();
      // Exit handler NOT removed yet — it's the safety net
      const removeCallsAfterStop = removeSpy.mock.calls.filter(c => c[0] === 'exit').length;
      // Child exits
      mockProc.emit('close', 0, null);
      // NOW exit handler removed
      const removeCallsAfterClose = removeSpy.mock.calls.filter(c => c[0] === 'exit').length;
      expect(removeCallsAfterClose).toBeGreaterThan(removeCallsAfterStop);
    });

    it('should be safe to call multiple times', () => {
      monitor.start();
      monitor.stop();
      monitor.stop(); // Should not throw
    });

    it('should be safe to call without start', () => {
      monitor.stop(); // Should not throw
    });

    it('should not emit line events after stop (race condition guard)', () => {
      monitor.start();
      const lines = [];
      monitor.on('line', (line) => lines.push(line));

      // Stop the monitor — sets _stopped = true and kills process
      monitor.stop();

      // Simulate buffered stdout data arriving AFTER stop (Node.js event loop race)
      // The data handler closure still references the stdout stream
      mockProc.stdout.emit('data', Buffer.from('late arriving data\n'));

      expect(lines).toEqual([]);
    });
  });

  describe('orphan prevention', () => {
    it('should register a process.on("exit") handler that sends SIGKILL', () => {
      const onSpy = jest.spyOn(process, 'on');
      monitor.start();

      expect(onSpy).toHaveBeenCalledWith('exit', expect.any(Function));

      // Get the handler and call it
      const exitHandler = onSpy.mock.calls.find(c => c[0] === 'exit')[1];
      exitHandler();
      expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('custom configuration', () => {
    it('should respect custom maxFailures', () => {
      const gaveUpHandler = jest.fn();
      monitor = new ProcessMonitor({
        command: 'test',
        args: [],
        label: 'test',
        maxFailures: 1,
      });
      monitor.on('gave-up', gaveUpHandler);
      monitor.start();

      // First failure should trigger gave-up
      mockProc.emit('close', 1);
      expect(gaveUpHandler).toHaveBeenCalled();
    });

    it('should respect custom restartDelay and backoffMultiplier', () => {
      monitor = new ProcessMonitor({
        command: 'test',
        args: [],
        label: 'test',
        restartDelay: 1000,
        backoffMultiplier: 3,
      });
      monitor.start();
      spawn.mockClear();

      // First failure: delay = 1000 * 3^1 = 3000ms
      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 1);

      jest.advanceTimersByTime(2999);
      expect(spawn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  // ── 4a: Custom stdio and env ──

  describe('custom stdio and env', () => {
    it('should pass custom stdio to spawn', () => {
      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: ['--no-loop'],
        label: 'vlc',
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      customMonitor.start();

      expect(spawn).toHaveBeenCalledWith('cvlc', ['--no-loop'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      customMonitor.stop();
    });

    it('should pass custom env to spawn', () => {
      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: [],
        label: 'vlc',
        env: { DISPLAY: ':0', HOME: '/tmp' },
      });
      customMonitor.start();

      expect(spawn).toHaveBeenCalledWith('cvlc', [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { DISPLAY: ':0', HOME: '/tmp' },
      });
      customMonitor.stop();
    });

    it('should not crash when stdout is null (ignored in stdio)', () => {
      const nullStdoutProc = new EventEmitter();
      nullStdoutProc.stdout = null;
      nullStdoutProc.stderr = new EventEmitter();
      nullStdoutProc.kill = jest.fn();
      nullStdoutProc.pid = 88888;
      spawn.mockReturnValueOnce(nullStdoutProc);

      const customMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: [],
        label: 'vlc',
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      expect(() => customMonitor.start()).not.toThrow();
      customMonitor.stop();
    });
  });

  // ── 4b: stderr counts toward receivedData ──

  describe('stderr receivedData', () => {
    it('should reset failure count when only stderr received (not stdout)', () => {
      monitor.start();

      // Emit stderr data (not stdout) — process ran successfully
      mockProc.stderr.emit('data', Buffer.from('some output\n'));

      // Process exits — should be treated as normal exit (failures reset)
      spawn.mockClear();
      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 0);

      // Restart delay should be base delay (5000ms * 2^0 = 5000ms), not backoff
      jest.advanceTimersByTime(5000);
      expect(spawn).toHaveBeenCalledTimes(1);
    });
  });

  // ── 4c: exited event ──

  describe('exited event', () => {
    it('should emit exited with code and signal when process dies', () => {
      monitor.start();
      const events = [];
      monitor.on('exited', (data) => events.push(data));

      mockProc.emit('close', 1, 'SIGTERM');

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ code: 1, signal: 'SIGTERM' });
    });

    it('should emit exited even when stopped (intentional kill)', () => {
      monitor.start();
      const events = [];
      monitor.on('exited', (data) => events.push(data));

      monitor.stop();
      mockProc.emit('close', null, 'SIGTERM');

      expect(events).toHaveLength(1);
    });
  });

  // ── 4d: restarted event ordering ──

  describe('restarted event ordering', () => {
    it('should emit restarted AFTER process is spawned (not before)', () => {
      monitor.start();
      let procWasRunningWhenRestarted = false;

      monitor.on('restarted', () => {
        procWasRunningWhenRestarted = monitor.isRunning();
      });

      const newProc = createMockSpawnProc();
      spawn.mockReturnValue(newProc);
      mockProc.emit('close', 1);
      jest.advanceTimersByTime(10000);

      expect(procWasRunningWhenRestarted).toBe(true);
    });
  });

  // ── 5: Orphan recovery (PID files) ──

  describe('orphan recovery (PID files)', () => {
    let pidMonitor;

    beforeEach(() => {
      pidMonitor = new ProcessMonitor({
        command: 'dbus-monitor',
        args: ['--session', '--monitor'],
        label: 'test-monitor',
        pidFile: '/tmp/aln-pm-test-monitor.pid',
      });
    });

    afterEach(() => {
      pidMonitor.stop();
    });

    it('should kill orphaned process found in PID file on start', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-test-monitor.pid')) return '12345';
        if (filePath === '/proc/12345/cmdline') return 'dbus-monitor\0--session\0--monitor';
        throw new Error('ENOENT');
      });

      pidMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      killSpy.mockRestore();
    });

    it('should NOT kill process if PID was reused by different command', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-test-monitor.pid')) return '12345';
        if (filePath === '/proc/12345/cmdline') return 'node\0src/server.js';
        throw new Error('ENOENT');
      });

      pidMonitor.start();

      expect(killSpy).not.toHaveBeenCalledWith(12345, expect.anything());
      killSpy.mockRestore();
    });

    it('should handle missing PID file gracefully (clean boot)', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      expect(() => pidMonitor.start()).not.toThrow();
      expect(spawn).toHaveBeenCalled();
    });

    it('should handle dead process gracefully (ESRCH)', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-test-monitor.pid')) return '12345';
        if (filePath === '/proc/12345/cmdline') return 'dbus-monitor\0--session\0--monitor';
        throw new Error('ENOENT');
      });

      expect(() => pidMonitor.start()).not.toThrow();
      expect(spawn).toHaveBeenCalled();
      killSpy.mockRestore();
    });

    it('should write PID file after spawn', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      pidMonitor.start();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        resolvePid('/tmp/aln-pm-test-monitor.pid'),
        String(mockProc.pid)
      );
    });

    it('should remove PID file on stop', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      pidMonitor.start();
      pidMonitor.stop();

      expect(fs.unlinkSync).toHaveBeenCalledWith(resolvePid('/tmp/aln-pm-test-monitor.pid'));
    });

    it('should NOT write PID file when pidFile option is omitted', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('ENOENT'); });

      monitor.start();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  // ── 6: orphanMatch option (P0.3 — cvlc execs to vlc, so this._command never
  // appears in /proc/PID/cmdline; orphanMatch lets callers match the resolved
  // binary instead) ──

  describe('orphanMatch option', () => {
    let orphanMatchMonitor;

    beforeEach(() => {
      orphanMatchMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: ['--fullscreen'],
        label: 'VLC',
        pidFile: '/tmp/aln-pm-vlc.pid',
        orphanMatch: ['vlc', 'cvlc'],
      });
    });

    afterEach(() => {
      orphanMatchMonitor.stop();
    });

    it('should kill orphan when cmdline is the resolved binary (vlc), not the wrapper (cvlc)', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return '/usr/bin/vlc\0-I\0dummy\0--fullscreen';
        throw new Error('ENOENT');
      });

      orphanMatchMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(54321, 'SIGTERM');
      killSpy.mockRestore();
    });

    it('should kill orphan when cmdline still shows the wrapper (cvlc)', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return 'cvlc\0--fullscreen';
        throw new Error('ENOENT');
      });

      orphanMatchMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(54321, 'SIGTERM');
      killSpy.mockRestore();
    });

    it('should NOT kill when PID was reused by an unrelated process', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return 'node\0something.js';
        throw new Error('ENOENT');
      });

      orphanMatchMonitor.start();

      expect(killSpy).not.toHaveBeenCalledWith(54321, expect.anything());
      killSpy.mockRestore();
    });

    it('should fall back to this._command matching when orphanMatch is not provided', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      const defaultMatchMonitor = new ProcessMonitor({
        command: 'dbus-monitor',
        args: ['--session'],
        label: 'test-monitor-2',
        pidFile: '/tmp/aln-pm-test-monitor-2.pid',
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-test-monitor-2.pid')) return '11111';
        if (filePath === '/proc/11111/cmdline') return 'dbus-monitor\0--session';
        throw new Error('ENOENT');
      });

      defaultMatchMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(11111, 'SIGTERM');
      killSpy.mockRestore();
      defaultMatchMonitor.stop();
    });

    it('should NOT kill when an unrelated binary path merely CONTAINS a matcher as a substring', () => {
      // Regression guard: match must be on the argv[0] basename, not a
      // substring of the whole cmdline (which would false-positive on paths
      // like /opt/vlc-tools/x.js).
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return 'node\0/opt/vlc-tools/x.js';
        throw new Error('ENOENT');
      });

      orphanMatchMonitor.start();

      expect(killSpy).not.toHaveBeenCalledWith(54321, expect.anything());
      killSpy.mockRestore();
    });

    it('should NOT kill a differently-named binary whose basename merely starts with a matcher', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return '/usr/bin/vlc-wrapper\0--fullscreen';
        throw new Error('ENOENT');
      });

      orphanMatchMonitor.start();

      expect(killSpy).not.toHaveBeenCalledWith(54321, expect.anything());
      killSpy.mockRestore();
    });

    it('should handle an empty cmdline (zombie process) without throwing or killing', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc.pid')) return '54321';
        // A zombie/defunct process has an empty (but readable) cmdline file.
        if (filePath === '/proc/54321/cmdline') return '';
        throw new Error('ENOENT');
      });

      expect(() => orphanMatchMonitor.start()).not.toThrow();

      expect(killSpy).not.toHaveBeenCalledWith(54321, expect.anything());
      killSpy.mockRestore();
    });

    it('should kill when orphanMatch is passed as a single string (not array)', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});
      const stringMatchMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: ['--fullscreen'],
        label: 'VLC-string',
        pidFile: '/tmp/aln-pm-vlc-string.pid',
        orphanMatch: 'vlc',
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === resolvePid('/tmp/aln-pm-vlc-string.pid')) return '54321';
        if (filePath === '/proc/54321/cmdline') return '/usr/bin/vlc\0-I\0dummy';
        throw new Error('ENOENT');
      });

      stringMatchMonitor.start();

      expect(killSpy).toHaveBeenCalledWith(54321, 'SIGTERM');
      killSpy.mockRestore();
      stringMatchMonitor.stop();
    });
  });

  // ── 7: PID-file isolation (ALN_PIDFILE_DIR) ──
  //
  // Regression guard for 2026-09-15: a unit run on the production Pi built a
  // real ProcessMonitor with pidFile '/tmp/aln-pm-vlc.pid', and start() ->
  // _killOrphan() SIGTERMed the pid it found there — the live show's VLC — then
  // overwrote the file with the mocked pid. Nothing in the jest layers may read
  // or write a pidfile outside ALN_PIDFILE_DIR.

  describe('PID-file isolation (ALN_PIDFILE_DIR)', () => {
    const realFs = jest.requireActual('fs');
    const nodePath = require('path');

    it('resolves pidfiles into ALN_PIDFILE_DIR, keeping only the basename', () => {
      const dir = process.env.ALN_PIDFILE_DIR;
      expect(dir).toBeTruthy();
      expect(dir).not.toBe('/tmp');

      const resolved = ProcessMonitor.resolvePidFile('/tmp/aln-pm-vlc.pid');

      expect(resolved).toBe(nodePath.join(dir, 'aln-pm-vlc.pid'));
      expect(resolved.startsWith(dir)).toBe(true);
      expect(resolved).not.toBe('/tmp/aln-pm-vlc.pid');
    });

    it('returns null when no pidFile is supplied', () => {
      expect(ProcessMonitor.resolvePidFile(null)).toBeNull();
      expect(ProcessMonitor.resolvePidFile(undefined)).toBeNull();
      expect(ProcessMonitor.resolvePidFile('')).toBeNull();
    });

    it('stores the resolved path on the instance, not the caller literal', () => {
      const vlcMonitor = new ProcessMonitor({
        command: 'cvlc',
        args: ['--fullscreen'],
        label: 'VLC-isolation',
        pidFile: '/tmp/aln-pm-vlc.pid',
        orphanMatch: ['vlc', 'cvlc'],
      });

      expect(vlcMonitor._pidFile).toBe(nodePath.join(process.env.ALN_PIDFILE_DIR, 'aln-pm-vlc.pid'));
      vlcMonitor.stop();
    });

    it('_killOrphan reads the overridden dir and never touches /tmp/aln-pm-*.pid', () => {
      const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {});

      // Real pidfile, real read, real /proc — only child_process.spawn stays
      // mocked. The pidfile points at THIS process (a live, definitely-running
      // pid), so the only thing standing between the monitor and a kill is the
      // argv[0] matcher: argv[0] here is 'node', the monitor matches
      // 'definitely-not-a-real-binary'. A kill would mean the guard is gone.
      const probePath = nodePath.join(process.env.ALN_PIDFILE_DIR, 'aln-pm-isolation-probe.pid');
      realFs.writeFileSync(probePath, String(process.pid));
      fs.readFileSync.mockImplementation((...args) => realFs.readFileSync(...args));

      const probeMonitor = new ProcessMonitor({
        command: 'definitely-not-a-real-binary',
        args: [],
        label: 'isolation-probe',
        pidFile: '/tmp/aln-pm-isolation-probe.pid',
      });

      try {
        probeMonitor.start();

        expect(probeMonitor._pidFile).toBe(probePath);
        expect(killSpy).not.toHaveBeenCalled();

        // Every path the monitor touched stayed inside the private dir.
        const touched = [
          ...fs.readFileSync.mock.calls.map((c) => c[0]),
          ...fs.writeFileSync.mock.calls.map((c) => c[0]),
          ...fs.unlinkSync.mock.calls.map((c) => c[0]),
        ].filter((c) => typeof c === 'string' && c.includes('aln-pm-'));

        expect(touched.length).toBeGreaterThan(0);
        for (const target of touched) {
          expect(target.startsWith(process.env.ALN_PIDFILE_DIR)).toBe(true);
          expect(target.startsWith('/tmp/aln-pm-')).toBe(false);
        }
      } finally {
        probeMonitor.stop();
        killSpy.mockRestore();
        try { realFs.unlinkSync(probePath); } catch { /* stop() may have removed it */ }
      }
    });
  });
});
