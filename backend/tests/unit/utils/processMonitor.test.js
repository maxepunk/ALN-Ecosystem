/**
 * Unit tests for ProcessMonitor utility
 * Reusable self-healing spawned-process monitor.
 *
 * TDD: Written before implementation
 */

const EventEmitter = require('events');

jest.mock('child_process');
const { spawn } = require('child_process');

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const ProcessMonitor = require('../../../src/utils/processMonitor');

// ── Helpers ──

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
    monitor = new ProcessMonitor({
      command: 'pactl',
      args: ['subscribe'],
      label: 'pactl-subscribe',
    });
  });

  afterEach(() => {
    monitor.stop();
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

    it('should clean up process.on("exit") handler', () => {
      const removeSpy = jest.spyOn(process, 'removeListener');
      monitor.start();
      monitor.stop();
      expect(removeSpy).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('should be safe to call multiple times', () => {
      monitor.start();
      monitor.stop();
      monitor.stop(); // Should not throw
    });

    it('should be safe to call without start', () => {
      monitor.stop(); // Should not throw
    });
  });

  describe('orphan prevention', () => {
    it('should register a process.on("exit") handler that kills the child', () => {
      const onSpy = jest.spyOn(process, 'on');
      monitor.start();

      expect(onSpy).toHaveBeenCalledWith('exit', expect.any(Function));

      // Get the handler and call it
      const exitHandler = onSpy.mock.calls.find(c => c[0] === 'exit')[1];
      exitHandler();
      expect(mockProc.kill).toHaveBeenCalled();
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
});
