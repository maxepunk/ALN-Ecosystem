/**
 * Unit tests for Audio Routing Service
 * Tests PipeWire/pactl CLI integration with child_process mocking
 *
 * TDD: Written before implementation
 */

const EventEmitter = require('events');

// Mock child_process before requiring the service
jest.mock('child_process');
const { execFile, spawn } = require('child_process');

// Mock persistenceService
jest.mock('../../../src/services/persistenceService', () => ({
  save: jest.fn().mockResolvedValue(undefined),
  load: jest.fn().mockResolvedValue(null),
}));
const persistenceService = require('../../../src/services/persistenceService');

// Mock logger to suppress output
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const audioRoutingService = require('../../../src/services/audioRoutingService');

// ── Helpers ──

/**
 * Helper: create a mock spawn process with EventEmitter stdout/stderr
 */
function createMockSpawnProc() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  proc.pid = 99999;
  return proc;
}

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

describe('AudioRoutingService', () => {
  beforeEach(() => {
    audioRoutingService.reset();
    jest.clearAllMocks();
  });

  // ── Parsing helpers ──

  describe('_parseSinkList()', () => {
    it('should parse pactl list sinks short', () => {
      const output = [
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
        '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE',
      ].join('\n');
      const sinks = audioRoutingService._parseSinkList(output);
      expect(sinks).toHaveLength(2);
      expect(sinks[0]).toEqual(expect.objectContaining({
        id: '47',
        name: 'alsa_output.platform-fef00700.hdmi.hdmi-stereo',
        type: 'hdmi',
      }));
      expect(sinks[1]).toEqual(expect.objectContaining({
        id: '89',
        name: 'bluez_output.AA_BB_CC_DD_EE_FF.1',
        type: 'bluetooth',
      }));
    });

    it('should handle empty output', () => {
      const sinks = audioRoutingService._parseSinkList('');
      expect(sinks).toEqual([]);
    });

    it('should skip malformed lines', () => {
      const output = [
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
        'garbage line',
        '',
      ].join('\n');
      const sinks = audioRoutingService._parseSinkList(output);
      expect(sinks).toHaveLength(1);
    });
  });

  describe('_parsePactlEvent()', () => {
    it('should parse new sink event', () => {
      expect(audioRoutingService._parsePactlEvent("Event 'new' on sink #89")).toEqual({
        action: 'new',
        type: 'sink',
        id: '89',
      });
    });

    it('should parse remove sink event', () => {
      expect(audioRoutingService._parsePactlEvent("Event 'remove' on sink #89")).toEqual({
        action: 'remove',
        type: 'sink',
        id: '89',
      });
    });

    it('should return null for non-sink events', () => {
      expect(audioRoutingService._parsePactlEvent("Event 'change' on server")).toBeNull();
    });

    it('should return null for unrecognized lines', () => {
      expect(audioRoutingService._parsePactlEvent('some random text')).toBeNull();
    });
  });

  // ── classifySink() ──

  describe('classifySink()', () => {
    it('should classify bluez_output as bluetooth', () => {
      expect(audioRoutingService.classifySink('bluez_output.AA_BB_CC_DD_EE_FF.1')).toBe('bluetooth');
    });

    it('should classify hdmi sink as hdmi (case-insensitive)', () => {
      expect(audioRoutingService.classifySink('alsa_output.platform-fef00700.hdmi.hdmi-stereo')).toBe('hdmi');
    });

    it('should classify HDMI uppercase as hdmi', () => {
      expect(audioRoutingService.classifySink('alsa_output.HDMI-A-1')).toBe('hdmi');
    });

    it('should classify unknown sinks as other', () => {
      expect(audioRoutingService.classifySink('alsa_output.usb-something')).toBe('other');
    });
  });

  // ── getAvailableSinks() ──

  describe('getAvailableSinks()', () => {
    it('should run pactl list sinks short and return parsed sinks', async () => {
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
        '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
      );

      const sinks = await audioRoutingService.getAvailableSinks();

      expect(execFile).toHaveBeenCalledWith(
        'pactl',
        ['list', 'sinks', 'short'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(sinks).toHaveLength(2);
      expect(sinks[0].type).toBe('hdmi');
      expect(sinks[1].type).toBe('bluetooth');
    });

    it('should return empty array when pactl fails', async () => {
      mockExecFileError('Connection failure: Connection refused');

      const sinks = await audioRoutingService.getAvailableSinks();
      expect(sinks).toEqual([]);
    });
  });

  // ── getBluetoothSinks() ──

  describe('getBluetoothSinks()', () => {
    it('should return only bluetooth sinks', async () => {
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
        '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
      );

      const btSinks = await audioRoutingService.getBluetoothSinks();

      expect(btSinks).toHaveLength(1);
      expect(btSinks[0].type).toBe('bluetooth');
      expect(btSinks[0].name).toBe('bluez_output.AA_BB_CC_DD_EE_FF.1');
    });

    it('should return empty array when no bluetooth sinks', async () => {
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
      );

      const btSinks = await audioRoutingService.getBluetoothSinks();
      expect(btSinks).toEqual([]);
    });
  });

  // ── getHdmiSink() ──

  describe('getHdmiSink()', () => {
    it('should return first HDMI sink', async () => {
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
        '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
      );

      const hdmiSink = await audioRoutingService.getHdmiSink();

      expect(hdmiSink).toBeTruthy();
      expect(hdmiSink.type).toBe('hdmi');
      expect(hdmiSink.name).toBe('alsa_output.platform-fef00700.hdmi.hdmi-stereo');
    });

    it('should return null when no HDMI sink', async () => {
      mockExecFileSuccess(
        '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
      );

      const hdmiSink = await audioRoutingService.getHdmiSink();
      expect(hdmiSink).toBeNull();
    });
  });

  // ── Stream route management ──

  describe('setStreamRoute()', () => {
    it('should persist route via persistenceService', async () => {
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      expect(persistenceService.save).toHaveBeenCalledWith(
        'config:audioRouting',
        expect.objectContaining({
          routes: { video: { sink: 'bluetooth' } },
        })
      );
    });

    it('should emit routing:changed event', async () => {
      const handler = jest.fn();
      audioRoutingService.on('routing:changed', handler);

      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      expect(handler).toHaveBeenCalledWith({
        stream: 'video',
        sink: 'bluetooth',
      });
    });

    it('should reject invalid stream name', async () => {
      await expect(
        audioRoutingService.setStreamRoute('music', 'hdmi')
      ).rejects.toThrow('Invalid stream name');
    });

    it('should reject empty stream name', async () => {
      await expect(
        audioRoutingService.setStreamRoute('', 'hdmi')
      ).rejects.toThrow('Invalid stream name');
    });
  });

  describe('getStreamRoute()', () => {
    it('should return persisted preference', async () => {
      // Set a route first
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      const route = audioRoutingService.getStreamRoute('video');
      expect(route).toBe('bluetooth');
    });

    it('should default to hdmi when no route set', () => {
      const route = audioRoutingService.getStreamRoute('video');
      expect(route).toBe('hdmi');
    });

    it('should reject invalid stream name', () => {
      expect(() => audioRoutingService.getStreamRoute('music')).toThrow('Invalid stream name');
    });
  });

  // ── applyRouting() ──

  describe('applyRouting()', () => {
    it('should find VLC sink-input and move to target sink', async () => {
      const calls = [];
      execFile.mockImplementation((cmd, args, opts, cb) => {
        calls.push({ cmd, args: [...args] });

        // First call: list sinks short (for resolving target sink name)
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          cb(null, '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n', '');
          return;
        }

        // Second call: list sink-inputs
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #201',
            '\tDriver: PipeWire',
            '\tState: RUNNING',
            '\tSink: 47 <alsa_output.platform-fef00700.hdmi.hdmi-stereo>',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
            '\t\tmedia.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }

        // Third call: move-sink-input
        if (args[0] === 'move-sink-input') {
          cb(null, '', '');
          return;
        }

        cb(new Error(`Unexpected call: ${args.join(' ')}`), '', '');
      });

      // Route is 'hdmi' by default
      await audioRoutingService.applyRouting('video');

      // Should have called move-sink-input
      const moveCall = calls.find(c => c.args[0] === 'move-sink-input');
      expect(moveCall).toBeTruthy();
      expect(moveCall.args[1]).toBe('201');
      expect(moveCall.args[2]).toBe('alsa_output.platform-fef00700.hdmi.hdmi-stereo');
    });

    it('should emit routing:applied on success', async () => {
      const handler = jest.fn();
      audioRoutingService.on('routing:applied', handler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          cb(null, '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n', '');
          return;
        }
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #201',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        if (args[0] === 'move-sink-input') {
          cb(null, '', '');
          return;
        }
        cb(new Error('unexpected'), '', '');
      });

      await audioRoutingService.applyRouting('video');

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        stream: 'video',
        sink: expect.any(String),
      }));
    });

    it('should retry findSinkInput with backoff up to 2s', async () => {
      jest.useFakeTimers();

      let sinkInputCallCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          cb(null, '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n', '');
          return;
        }
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          sinkInputCallCount++;
          if (sinkInputCallCount < 3) {
            // No VLC sink-input found yet
            cb(null, '', '');
          } else {
            // VLC appears on 3rd try
            cb(null, [
              'Sink Input #201',
              '\tProperties:',
              '\t\tapplication.name = "VLC media player"',
            ].join('\n'), '');
          }
          return;
        }
        if (args[0] === 'move-sink-input') {
          cb(null, '', '');
          return;
        }
        cb(new Error('unexpected'), '', '');
      });

      const promise = audioRoutingService.applyRouting('video');

      // Advance through retries
      await jest.advanceTimersByTimeAsync(100); // 1st retry
      await jest.advanceTimersByTimeAsync(200); // 2nd retry

      await promise;

      expect(sinkInputCallCount).toBe(3);

      jest.useRealTimers();
    });

    it('should fall back to HDMI when BT unavailable and emit routing:fallback', async () => {
      // Set route to bluetooth
      await audioRoutingService.setStreamRoute('video', 'bluetooth');
      jest.clearAllMocks();

      const fallbackHandler = jest.fn();
      audioRoutingService.on('routing:fallback', fallbackHandler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          // Only HDMI available, no bluetooth
          cb(null, '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n', '');
          return;
        }
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #201',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        if (args[0] === 'move-sink-input') {
          cb(null, '', '');
          return;
        }
        cb(new Error('unexpected'), '', '');
      });

      await audioRoutingService.applyRouting('video');

      expect(fallbackHandler).toHaveBeenCalledWith(expect.objectContaining({
        stream: 'video',
        requestedSink: 'bluetooth',
        actualSink: expect.stringContaining('hdmi'),
      }));
    });

    it('should throw when no sinks are available at all', async () => {
      mockExecFileSuccess(''); // pactl list sinks short returns empty

      await expect(
        audioRoutingService.applyRouting('video')
      ).rejects.toThrow("No available sink for stream 'video'");
    });

    it('should reject invalid stream name', async () => {
      await expect(
        audioRoutingService.applyRouting('music')
      ).rejects.toThrow('Invalid stream name');
    });
  });

  // ── findSinkInput() ──

  describe('findSinkInput()', () => {
    it('should parse sink-inputs output to find VLC', async () => {
      mockExecFileSuccess([
        'Sink Input #100',
        '\tDriver: PipeWire',
        '\tState: RUNNING',
        '\tProperties:',
        '\t\tapplication.name = "Firefox"',
        '',
        'Sink Input #201',
        '\tDriver: PipeWire',
        '\tState: RUNNING',
        '\tProperties:',
        '\t\tapplication.name = "VLC media player"',
      ].join('\n'));

      const result = await audioRoutingService.findSinkInput('VLC');
      expect(result).toEqual({ index: '201' });
    });

    it('should return null when VLC not found', async () => {
      mockExecFileSuccess([
        'Sink Input #100',
        '\tProperties:',
        '\t\tapplication.name = "Firefox"',
      ].join('\n'));

      const result = await audioRoutingService.findSinkInput('VLC');
      expect(result).toBeNull();
    });

    it('should return null on empty output', async () => {
      mockExecFileSuccess('');

      const result = await audioRoutingService.findSinkInput('VLC');
      expect(result).toBeNull();
    });
  });

  // ── Sink Monitor ──

  describe('startSinkMonitor()', () => {
    it('should spawn pactl subscribe', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      audioRoutingService.startSinkMonitor();

      expect(spawn).toHaveBeenCalledWith('pactl', ['subscribe']);
    });

    it('should emit sink:added on new sink event', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      const handler = jest.fn();
      audioRoutingService.on('sink:added', handler);

      audioRoutingService.startSinkMonitor();

      // Simulate pactl subscribe output
      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: '89',
      }));
    });

    it('should emit sink:removed on remove sink event', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      const handler = jest.fn();
      audioRoutingService.on('sink:removed', handler);

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'remove' on sink #89\n"));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: '89',
      }));
    });

    it('should ignore non-sink events', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      const addedHandler = jest.fn();
      const removedHandler = jest.fn();
      audioRoutingService.on('sink:added', addedHandler);
      audioRoutingService.on('sink:removed', removedHandler);

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'change' on server\n"));

      expect(addedHandler).not.toHaveBeenCalled();
      expect(removedHandler).not.toHaveBeenCalled();
    });

    it('should auto-apply routing when bluetooth sink added and video route is bluetooth', async () => {
      // Set route to bluetooth
      await audioRoutingService.setStreamRoute('video', 'bluetooth');
      jest.clearAllMocks();

      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Mock the execFile for getAvailableSinks and applyRouting calls
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          cb(null, [
            '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
            '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE',
          ].join('\n'), '');
          return;
        }
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #201',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        if (args[0] === 'move-sink-input') {
          cb(null, '', '');
          return;
        }
        cb(null, '', '');
      });

      audioRoutingService.startSinkMonitor();

      // Simulate a new bluetooth sink appearing
      // We need to mock getAvailableSinks to identify the sink type
      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));

      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have attempted to apply routing (called pactl list sinks to resolve)
      const sinkListCalls = execFile.mock.calls.filter(
        call => call[1][0] === 'list' && call[1][1] === 'sinks'
      );
      expect(sinkListCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit routing:error when auto-routing fails on sink added', async () => {
      // Set route to bluetooth
      await audioRoutingService.setStreamRoute('video', 'bluetooth');
      jest.clearAllMocks();

      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Mock getAvailableSinks to identify BT sink, but fail on applyRouting
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          callCount++;
          if (callCount === 1) {
            // First call from _onSinkAdded → getAvailableSinks — BT sink exists
            cb(null, '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n', '');
          } else {
            // Second call from applyRouting → getAvailableSinks — no sinks (trigger error)
            cb(null, '', '');
          }
          return;
        }
        cb(null, '', '');
      });

      const errorHandler = jest.fn();
      audioRoutingService.on('routing:error', errorHandler);

      audioRoutingService.startSinkMonitor();
      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));

      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorHandler).toHaveBeenCalledWith(expect.objectContaining({
        stream: 'video',
        context: 'auto-routing on sink added',
      }));
    });

    it('should auto-restart monitor on process exit with backoff', async () => {
      jest.useFakeTimers();

      const mockProc1 = createMockSpawnProc();
      const mockProc2 = createMockSpawnProc();
      spawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

      audioRoutingService.startSinkMonitor();

      // Simulate process exit
      mockProc1.emit('close', 1);

      // Advance timer to trigger restart
      await jest.advanceTimersByTimeAsync(5000);

      // Should have spawned a second process
      expect(spawn).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  // ── getRoutingStatus() ──

  describe('getRoutingStatus()', () => {
    it('should return full routing state', () => {
      const status = audioRoutingService.getRoutingStatus();

      expect(status).toEqual(expect.objectContaining({
        routes: expect.objectContaining({
          video: expect.objectContaining({
            sink: 'hdmi',
          }),
        }),
        defaultSink: 'hdmi',
      }));
    });

    it('should reflect updated routes', async () => {
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      const status = audioRoutingService.getRoutingStatus();
      expect(status.routes.video.sink).toBe('bluetooth');
    });
  });

  // ── Persistence format ──

  describe('Persistence format', () => {
    it('should persist in correct format: { routes: { video: { sink } }, defaultSink }', async () => {
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      expect(persistenceService.save).toHaveBeenCalledWith(
        'config:audioRouting',
        {
          routes: {
            video: { sink: 'bluetooth' },
          },
          defaultSink: 'hdmi',
        }
      );
    });
  });

  // ── init() ──

  describe('init()', () => {
    it('should load persisted routing on init', async () => {
      persistenceService.load.mockResolvedValue({
        routes: { video: { sink: 'bluetooth' } },
        defaultSink: 'hdmi',
      });

      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(persistenceService.load).toHaveBeenCalledWith('config:audioRouting');
      expect(audioRoutingService.getStreamRoute('video')).toBe('bluetooth');
    });

    it('should start sink monitor on init', async () => {
      persistenceService.load.mockResolvedValue(null);
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(spawn).toHaveBeenCalledWith('pactl', ['subscribe']);
    });

    it('should use defaults when no persisted data', async () => {
      persistenceService.load.mockResolvedValue(null);
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(audioRoutingService.getStreamRoute('video')).toBe('hdmi');
    });
  });

  // ── cleanup() ──

  describe('cleanup()', () => {
    it('should kill pactl subscribe process', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      audioRoutingService.startSinkMonitor();
      audioRoutingService.cleanup();

      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should be safe to call when no monitor is running', () => {
      expect(() => audioRoutingService.cleanup()).not.toThrow();
    });
  });

  // ── reset() ──

  describe('reset()', () => {
    it('should kill processes, remove listeners, and reset state', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      audioRoutingService.startSinkMonitor();
      audioRoutingService.on('routing:changed', jest.fn());

      // Set a route to verify state resets
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      audioRoutingService.reset();

      expect(mockProc.kill).toHaveBeenCalled();
      expect(audioRoutingService.listenerCount('routing:changed')).toBe(0);
      // After reset, should be back to default
      expect(audioRoutingService.getStreamRoute('video')).toBe('hdmi');
    });
  });

  // ── moveStreamToSink() ──

  describe('moveStreamToSink()', () => {
    it('should call pactl move-sink-input with correct args', async () => {
      mockExecFileSuccess('');

      await audioRoutingService.moveStreamToSink('201', 'alsa_output.platform-fef00700.hdmi.hdmi-stereo');

      expect(execFile).toHaveBeenCalledWith(
        'pactl',
        ['move-sink-input', '201', 'alsa_output.platform-fef00700.hdmi.hdmi-stereo'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should reject when pactl fails', async () => {
      mockExecFileError('Failure: No such entity');

      await expect(
        audioRoutingService.moveStreamToSink('201', 'nonexistent_sink')
      ).rejects.toThrow();
    });
  });

  // ── audio:volume:set ──

  describe('audio:volume:set', () => {
    it('should set volume for a valid stream via pactl', async () => {
      // Mock findSinkInput to return a sink-input index
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('spotify', 75);

      expect(execFile).toHaveBeenCalledWith(
        'pactl', ['set-sink-input-volume', '42', '75%'],
        expect.any(Object), expect.any(Function)
      );
    });

    it('should reject invalid stream names', async () => {
      await expect(audioRoutingService.setStreamVolume('invalid', 50))
        .rejects.toThrow(/invalid stream/i);
    });

    it('should clamp volume to 0-100 range', async () => {
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('video', 150);

      expect(execFile).toHaveBeenCalledWith(
        'pactl', ['set-sink-input-volume', '42', '100%'],
        expect.any(Object), expect.any(Function)
      );
    });
  });

  // ── VALID_STREAMS expansion ──

  describe('VALID_STREAMS expansion', () => {
    it('should accept spotify as a valid stream', () => {
      expect(audioRoutingService.isValidStream('spotify')).toBe(true);
    });

    it('should accept sound as a valid stream', () => {
      expect(audioRoutingService.isValidStream('sound')).toBe(true);
    });
  });

  // ── fallback routing ──

  describe('fallback routing', () => {
    it('should try fallback sink when primary is unavailable', async () => {
      // Mock findSinkInput to return a sink-input
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });

      // Mock getAvailableSinks to return only HDMI (no bluetooth)
      jest.spyOn(audioRoutingService, 'getAvailableSinks').mockResolvedValue([
        {
          id: '47',
          name: 'alsa_output.platform-fef00700.hdmi.hdmi-stereo',
          type: 'hdmi',
        },
      ]);

      // Mock moveStreamToSink to succeed
      const moveStream = jest.spyOn(audioRoutingService, 'moveStreamToSink');
      moveStream.mockResolvedValue(undefined);

      // Set up route with primary bluetooth (unavailable) and fallback hdmi
      audioRoutingService._routingData.routes.video = {
        sink: 'bluez_output.missing',
        fallback: 'hdmi',
      };

      await audioRoutingService.applyRoutingWithFallback('video');

      // Should move to fallback HDMI sink since bluetooth is not available
      expect(moveStream).toHaveBeenCalledWith('42', 'alsa_output.platform-fef00700.hdmi.hdmi-stereo');
    });
  });

  // ── Combine-sink management ──

  describe('combine-sink management', () => {
    describe('createCombineSink()', () => {
      it('should create combine-sink from two BT speakers using pw-loopback', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
        ]);

        const mockProc1 = createMockSpawnProc();
        mockProc1.pid = 1001;
        const mockProc2 = createMockSpawnProc();
        mockProc2.pid = 1002;
        spawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

        await audioRoutingService.createCombineSink();

        // Should spawn two pw-loopback processes
        expect(spawn).toHaveBeenCalledTimes(2);
        expect(spawn).toHaveBeenCalledWith(
          'pw-loopback',
          expect.arrayContaining([
            expect.stringContaining('bluez_output.AA_BB_CC_DD_EE_FF.1'),
          ])
        );
        expect(spawn).toHaveBeenCalledWith(
          'pw-loopback',
          expect.arrayContaining([
            expect.stringContaining('bluez_output.11_22_33_44_55_66.1'),
          ])
        );

        expect(audioRoutingService._combineSinkActive).toBe(true);
        expect(audioRoutingService._combineSinkPids).toEqual([1001, 1002]);
      });

      it('should reject when fewer than two BT speakers are available', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
        ]);

        await expect(audioRoutingService.createCombineSink())
          .rejects.toThrow('Need at least 2 Bluetooth speakers');
      });

      it('should reject when no BT speakers are available', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([]);

        await expect(audioRoutingService.createCombineSink())
          .rejects.toThrow('Need at least 2 Bluetooth speakers');
      });

      it('should not create if combine-sink is already active', async () => {
        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [1001, 1002];

        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
        ]);

        // Should not spawn additional processes
        await audioRoutingService.createCombineSink();
        expect(spawn).not.toHaveBeenCalledWith('pw-loopback', expect.any(Array));
      });

      it('should emit combine-sink:created on success', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
        ]);

        const mockProc1 = createMockSpawnProc();
        mockProc1.pid = 1001;
        const mockProc2 = createMockSpawnProc();
        mockProc2.pid = 1002;
        spawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

        const handler = jest.fn();
        audioRoutingService.on('combine-sink:created', handler);

        await audioRoutingService.createCombineSink();

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          pids: [1001, 1002],
          sinks: expect.arrayContaining([
            'bluez_output.AA_BB_CC_DD_EE_FF.1',
            'bluez_output.11_22_33_44_55_66.1',
          ]),
        }));
      });

      it('should use first two BT speakers when more than two are available', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
          { id: '91', name: 'bluez_output.77_88_99_AA_BB_CC.1', type: 'bluetooth' },
        ]);

        const mockProc1 = createMockSpawnProc();
        mockProc1.pid = 1001;
        const mockProc2 = createMockSpawnProc();
        mockProc2.pid = 1002;
        spawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

        await audioRoutingService.createCombineSink();

        // Should only spawn two pw-loopback processes
        expect(spawn).toHaveBeenCalledTimes(2);
        expect(audioRoutingService._combineSinkPids).toEqual([1001, 1002]);
      });
    });

    describe('destroyCombineSink()', () => {
      it('should kill pw-loopback processes and reset state', async () => {
        const proc1 = createMockSpawnProc();
        proc1.pid = 123;
        const proc2 = createMockSpawnProc();
        proc2.pid = 456;

        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [123, 456];
        audioRoutingService._combineSinkProcs = [proc1, proc2];

        await audioRoutingService.destroyCombineSink();

        expect(proc1.kill).toHaveBeenCalled();
        expect(proc2.kill).toHaveBeenCalled();
        expect(audioRoutingService._combineSinkActive).toBe(false);
        expect(audioRoutingService._combineSinkPids).toEqual([]);
        expect(audioRoutingService._combineSinkProcs).toEqual([]);
      });

      it('should be safe to call when no combine-sink is active', async () => {
        await expect(audioRoutingService.destroyCombineSink()).resolves.not.toThrow();
        expect(audioRoutingService._combineSinkActive).toBe(false);
      });

      it('should emit combine-sink:destroyed on teardown', async () => {
        const proc1 = createMockSpawnProc();
        proc1.pid = 123;

        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [123];
        audioRoutingService._combineSinkProcs = [proc1];

        const handler = jest.fn();
        audioRoutingService.on('combine-sink:destroyed', handler);

        await audioRoutingService.destroyCombineSink();

        expect(handler).toHaveBeenCalled();
      });

      it('should handle already-exited processes gracefully', async () => {
        const proc1 = createMockSpawnProc();
        proc1.pid = 123;
        proc1.kill.mockImplementation(() => {
          throw new Error('kill ESRCH');
        });

        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [123];
        audioRoutingService._combineSinkProcs = [proc1];

        // Should not throw even if kill fails
        await expect(audioRoutingService.destroyCombineSink()).resolves.not.toThrow();
        expect(audioRoutingService._combineSinkActive).toBe(false);
      });
    });

    describe('getAvailableSinksWithCombine()', () => {
      it('should include combine-bt when combine-sink is active', async () => {
        audioRoutingService._combineSinkActive = true;

        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
          '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        expect(sinks.some(s => s.name === 'combine-bt')).toBe(true);
        const combineSink = sinks.find(s => s.name === 'combine-bt');
        expect(combineSink.type).toBe('combine');
        expect(combineSink.virtual).toBe(true);
      });

      it('should not include combine-bt when combine-sink is inactive', async () => {
        audioRoutingService._combineSinkActive = false;

        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        expect(sinks.some(s => s.name === 'combine-bt')).toBe(false);
      });

      it('should include all real sinks alongside combine-bt', async () => {
        audioRoutingService._combineSinkActive = true;

        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
          '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        // 2 real sinks + 1 virtual combine-bt
        expect(sinks).toHaveLength(3);
        expect(sinks.filter(s => s.virtual !== true)).toHaveLength(2);
      });
    });

    describe('auto-create / auto-destroy', () => {
      it('should auto-create combine-sink when second BT speaker connects', async () => {
        const createSpy = jest.spyOn(audioRoutingService, 'createCombineSink').mockResolvedValue();

        // Simulate two BT sinks now available
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
        ]);

        await audioRoutingService._onBtSinkChanged();

        expect(createSpy).toHaveBeenCalled();
      });

      it('should auto-destroy combine-sink when BT speaker disconnects (fewer than 2)', async () => {
        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [1001, 1002];
        audioRoutingService._combineSinkProcs = [createMockSpawnProc(), createMockSpawnProc()];

        const destroySpy = jest.spyOn(audioRoutingService, 'destroyCombineSink').mockResolvedValue();

        // Only one BT sink remaining
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
        ]);

        await audioRoutingService._onBtSinkChanged();

        expect(destroySpy).toHaveBeenCalled();
      });

      it('should not auto-create when only one BT speaker is available', async () => {
        const createSpy = jest.spyOn(audioRoutingService, 'createCombineSink').mockResolvedValue();

        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
        ]);

        await audioRoutingService._onBtSinkChanged();

        expect(createSpy).not.toHaveBeenCalled();
      });

      it('should not auto-destroy when combine-sink is not active', async () => {
        audioRoutingService._combineSinkActive = false;
        const destroySpy = jest.spyOn(audioRoutingService, 'destroyCombineSink').mockResolvedValue();

        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
        ]);

        await audioRoutingService._onBtSinkChanged();

        expect(destroySpy).not.toHaveBeenCalled();
      });
    });

    describe('cleanup integration', () => {
      it('should destroy combine-sink on cleanup()', () => {
        const proc1 = createMockSpawnProc();
        proc1.pid = 1001;
        const proc2 = createMockSpawnProc();
        proc2.pid = 1002;

        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [1001, 1002];
        audioRoutingService._combineSinkProcs = [proc1, proc2];

        audioRoutingService.cleanup();

        expect(proc1.kill).toHaveBeenCalled();
        expect(proc2.kill).toHaveBeenCalled();
        expect(audioRoutingService._combineSinkActive).toBe(false);
        expect(audioRoutingService._combineSinkPids).toEqual([]);
        expect(audioRoutingService._combineSinkProcs).toEqual([]);
      });

      it('should reset combine-sink state on reset()', () => {
        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkPids = [1001, 1002];
        audioRoutingService._combineSinkProcs = [createMockSpawnProc(), createMockSpawnProc()];

        audioRoutingService.reset();

        expect(audioRoutingService._combineSinkActive).toBe(false);
        expect(audioRoutingService._combineSinkPids).toEqual([]);
        expect(audioRoutingService._combineSinkProcs).toEqual([]);
      });
    });

    describe('pw-loopback process lifecycle', () => {
      it('should auto-destroy combine-sink if a pw-loopback process exits unexpectedly', async () => {
        jest.spyOn(audioRoutingService, 'getBluetoothSinks').mockResolvedValue([
          { id: '89', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', type: 'bluetooth' },
          { id: '90', name: 'bluez_output.11_22_33_44_55_66.1', type: 'bluetooth' },
        ]);

        const mockProc1 = createMockSpawnProc();
        mockProc1.pid = 1001;
        const mockProc2 = createMockSpawnProc();
        mockProc2.pid = 1002;
        spawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2);

        await audioRoutingService.createCombineSink();
        expect(audioRoutingService._combineSinkActive).toBe(true);

        // Simulate one pw-loopback process exiting
        mockProc1.emit('close', 1);

        // Allow async handler to run
        await new Promise(resolve => setTimeout(resolve, 10));

        // Combine-sink should be torn down
        expect(audioRoutingService._combineSinkActive).toBe(false);
        expect(mockProc2.kill).toHaveBeenCalled();
      });
    });
  });
});
