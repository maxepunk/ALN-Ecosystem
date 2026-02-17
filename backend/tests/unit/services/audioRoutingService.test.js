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
const logger = require('../../../src/utils/logger');

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
        label: 'HDMI',
      }));
      expect(sinks[1]).toEqual(expect.objectContaining({
        id: '89',
        name: 'bluez_output.AA_BB_CC_DD_EE_FF.1',
        type: 'bluetooth',
        label: 'BT Speaker (EE:FF)', // Default logic uses last 2 bytes
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

    it('should classify combine-bt as combine', () => {
      expect(audioRoutingService.classifySink('combine-bt')).toBe('combine');
    });

    it('should classify unknown sinks as other', () => {
      expect(audioRoutingService.classifySink('alsa_output.usb-something')).toBe('other');
    });
  });

  // ── _generateSinkLabel() ──

  describe('_generateSinkLabel()', () => {
    it('should label hdmi as HDMI', () => {
      expect(audioRoutingService._generateSinkLabel('any.hdmi.sink', 'hdmi')).toBe('HDMI');
    });

    it('should label bluetooth with short MAC', () => {
      const name = 'bluez_output.AA_BB_CC_DD_EE_FF.1';
      expect(audioRoutingService._generateSinkLabel(name, 'bluetooth')).toBe('BT Speaker (EE:FF)');
    });

    it('should label bluetooth fallback if MAC missing', () => {
      expect(audioRoutingService._generateSinkLabel('bluez_output.weird_name', 'bluetooth')).toBe('Bluetooth Speaker');
    });

    it('should label combine sink', () => {
      expect(audioRoutingService._generateSinkLabel('combine-bt', 'combine')).toBe('All Bluetooth Speakers');
    });

    it('should use raw name for other types', () => {
      expect(audioRoutingService._generateSinkLabel('alsa_output.pci-0000_00_1f.3.analog-stereo', 'other')).toBe('alsa_output.pci-0000_00_1f.3.analog-stereo');
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

      // Simulate process exit with code 0 after receiving data (normal restart)
      mockProc1.stdout.emit('data', "Event 'new' on sink #42\n");
      mockProc1.emit('close', 0);

      // Advance timer to trigger restart (5000ms base, 0 failures = 5000ms)
      await jest.advanceTimersByTimeAsync(5000);

      // Should have spawned a second process
      expect(spawn).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should give up after max consecutive failures', async () => {
      jest.useFakeTimers();

      audioRoutingService._monitorFailures = 4; // One below max (5)
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValueOnce(mockProc);

      audioRoutingService.startSinkMonitor();

      // Simulate immediate failure (no data received)
      mockProc.emit('close', 1);

      // Advance timer well past any backoff
      await jest.advanceTimersByTimeAsync(600000);

      // Should NOT have spawned another process (gave up)
      expect(spawn).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  // ── getRoutingStatus() ──

  describe('getRoutingStatus()', () => {
    it('should return full routing state with available sinks', async () => {
      // Mock available sinks
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
      );

      const status = await audioRoutingService.getRoutingStatus();

      expect(status).toEqual(expect.objectContaining({
        routes: expect.objectContaining({
          video: 'hdmi',
        }),
        defaultSink: 'hdmi',
        availableSinks: expect.arrayContaining([
          expect.objectContaining({ type: 'hdmi' })
        ]),
      }));
    });

    it('should reflect updated routes', async () => {
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      // mock available sinks again for the call
      mockExecFileSuccess('');

      const status = await audioRoutingService.getRoutingStatus();
      expect(status.routes.video).toBe('bluetooth');
    });
  });

  describe('getRoutingStatus - routes shape', () => {
    it('should return routes as flat strings, not objects', async () => {
      // Set a route (internally stored as { sink: 'hdmi' })
      await audioRoutingService.setStreamRoute('video', 'hdmi');

      mockExecFileSuccess('');

      const status = await audioRoutingService.getRoutingStatus();

      // Route values must be plain strings for GM Scanner dropdown compatibility
      expect(status.routes.video).toBe('hdmi');
      expect(typeof status.routes.video).toBe('string');
    });

    it('should normalize all configured routes to strings', async () => {
      await audioRoutingService.setStreamRoute('video', 'hdmi');
      await audioRoutingService.setStreamRoute('spotify', 'bluetooth');
      await audioRoutingService.setStreamRoute('sound', 'aln-combine');

      mockExecFileSuccess('');

      const status = await audioRoutingService.getRoutingStatus();

      expect(status.routes.video).toBe('hdmi');
      expect(status.routes.spotify).toBe('bluetooth');
      expect(status.routes.sound).toBe('aln-combine');
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

        mockExecFileSuccess('42\n');

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

        mockExecFileSuccess('42\n');

        const handler = jest.fn();
        audioRoutingService.on('combine-sink:created', handler);

        await audioRoutingService.createCombineSink();

        expect(execFile).toHaveBeenCalledWith('pactl', [
          'load-module', 'module-null-sink',
          'sink_name=aln-combine',
          'sink_properties=device.description=ALN_Multi_Speaker'
        ], expect.any(Object), expect.any(Function));

        expect(audioRoutingService._combineSinkModuleId).toBe('42');

        expect(spawn).toHaveBeenCalledWith('pw-loopback', [
          '--capture-props', 'node.target=aln-combine.monitor media.class=Stream/Input/Audio',
          '--playback-props', 'node.target=bluez_output.AA_BB_CC_DD_EE_FF.1 node.latency=200/1000'
        ]);

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

        mockExecFileSuccess('42\n');

        await audioRoutingService.createCombineSink();

        // Should only spawn two pw-loopback processes
        expect(spawn).toHaveBeenCalledTimes(2);
        expect(audioRoutingService._combineSinkPids).toEqual([1001, 1002]);
      });
    });

    describe('destroyCombineSink()', () => {
      it('should unload null sink module, kill loopbacks, and reset state', async () => {
        const proc1 = createMockSpawnProc();
        proc1.pid = 123;
        const proc2 = createMockSpawnProc();
        proc2.pid = 456;

        audioRoutingService._combineSinkActive = true;
        audioRoutingService._combineSinkModuleId = '42';
        audioRoutingService._combineSinkPids = [123, 456];
        audioRoutingService._combineSinkProcs = [proc1, proc2];

        mockExecFileSuccess('');

        await audioRoutingService.destroyCombineSink();

        expect(proc1.kill).toHaveBeenCalled();
        expect(proc2.kill).toHaveBeenCalled();
        expect(execFile).toHaveBeenCalledWith('pactl', ['unload-module', '42'], expect.any(Object), expect.any(Function));

        expect(audioRoutingService._combineSinkActive).toBe(false);
        expect(audioRoutingService._combineSinkModuleId).toBeNull();
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
      it('should include aln-combine when combine-sink is active', async () => {
        audioRoutingService._combineSinkActive = true;

        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
          '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        expect(sinks.some(s => s.name === 'aln-combine')).toBe(true);
        const combineSink = sinks.find(s => s.name === 'aln-combine');
        expect(combineSink.type).toBe('combine');
        expect(combineSink.virtual).toBe(true);
        expect(combineSink.label).toBe('All Bluetooth Speakers');
      });



      it('should strip real aln-combine sink and add virtual entry when active', async () => {
        audioRoutingService._combineSinkActive = true;

        // Mock output that includes a real aln-combine sink from pactl
        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n' +
          '99\taln-combine\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        // Real aln-combine stripped, virtual added
        expect(sinks).toHaveLength(2); // HDMI + virtual combine

        const combineSink = sinks.find(s => s.name === 'aln-combine');
        expect(combineSink).toBeTruthy();
        expect(combineSink.id).toBe('virtual-combine'); // Virtual, not '99'
        expect(combineSink.virtual).toBe(true);
        expect(combineSink.type).toBe('combine');
        expect(combineSink.label).toBe('All Bluetooth Speakers');
      });

      it('should not include aln-combine when combine-sink is inactive', async () => {
        audioRoutingService._combineSinkActive = false;

        mockExecFileSuccess(
          '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
        );

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        expect(sinks.some(s => s.name === 'aln-combine')).toBe(false);
      });

      it('should include all real sinks alongside aln-combine', async () => {
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

    describe('getAvailableSinksWithCombine - filtering', () => {
      it('should exclude auto_null sink from available sinks', async () => {
        audioRoutingService.getAvailableSinks = jest.fn().mockResolvedValue([
          { id: '1', name: 'alsa_output.hdmi', driver: 'alsa', format: '', state: 'RUNNING', type: 'hdmi' },
          { id: '2', name: 'auto_null', driver: 'null', format: '', state: 'RUNNING', type: 'other' },
          { id: '3', name: 'bluez_output.XX_XX', driver: 'bluez', format: '', state: 'RUNNING', type: 'bluetooth' },
        ]);

        const sinks = await audioRoutingService.getAvailableSinksWithCombine();

        const sinkNames = sinks.map(s => s.name);
        expect(sinkNames).not.toContain('auto_null');
        expect(sinkNames).toContain('alsa_output.hdmi');
        expect(sinkNames).toContain('bluez_output.XX_XX');
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

        // Mock module load for createCombineSink
        mockExecFileSuccess('42\n');

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

  // ── Ducking Engine ──

  describe('ducking engine', () => {
    let setVolume;

    beforeEach(() => {
      setVolume = jest.spyOn(audioRoutingService, 'setStreamVolume').mockResolvedValue();
      jest.spyOn(audioRoutingService, 'getStreamVolume').mockResolvedValue(100);
    });

    describe('loadDuckingRules()', () => {
      it('should load ducking rules', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        expect(audioRoutingService._duckingRules).toHaveLength(1);
        expect(audioRoutingService._duckingRules[0]).toEqual({
          when: 'video', duck: 'spotify', to: 20, fadeMs: 500
        });
      });

      it('should replace existing rules', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);
        audioRoutingService.loadDuckingRules([
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 }
        ]);

        expect(audioRoutingService._duckingRules).toHaveLength(1);
        expect(audioRoutingService._duckingRules[0].when).toBe('sound');
      });

      it('should clear active ducking state when rules are reloaded', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);
        audioRoutingService.handleDuckingEvent('video', 'started');

        audioRoutingService.loadDuckingRules([]);
        expect(audioRoutingService._activeDuckingSources).toEqual({});
        expect(audioRoutingService._preDuckVolumes).toEqual({});
      });
    });

    describe('handleDuckingEvent() - started lifecycle', () => {
      it('should duck Spotify when video starts', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        expect(setVolume).toHaveBeenCalledWith('spotify', 20);
      });

      it('should duck lighter for sound effects', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 }
        ]);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        expect(setVolume).toHaveBeenCalledWith('spotify', 40);
      });

      it('should store pre-duck volume before first duck', async () => {
        audioRoutingService.getStreamVolume.mockResolvedValue(80);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');

        // Wait for async getStreamVolume to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(audioRoutingService._preDuckVolumes.spotify).toBe(80);
      });

      it('should not overwrite pre-duck volume if already stored', async () => {
        audioRoutingService.getStreamVolume.mockResolvedValue(80);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Pre-duck volume stored as 80
        expect(audioRoutingService._preDuckVolumes.spotify).toBe(80);

        // Now change mock to return 20 (current ducked volume)
        audioRoutingService.getStreamVolume.mockResolvedValue(20);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should NOT have overwritten to 20 — still 80
        expect(audioRoutingService._preDuckVolumes.spotify).toBe(80);
      });

      it('should track active ducking sources per target stream', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        expect(audioRoutingService._activeDuckingSources.spotify).toContain('video');

        audioRoutingService.handleDuckingEvent('sound', 'started');
        expect(audioRoutingService._activeDuckingSources.spotify).toContain('video');
        expect(audioRoutingService._activeDuckingSources.spotify).toContain('sound');
      });

      it('should use lowest "to" value when multiple sources are active', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        audioRoutingService.handleDuckingEvent('sound', 'started'); // Would be 40, but video says 20

        // Most recent call should still be 20 (lowest active)
        const lastCall = setVolume.mock.calls[setVolume.mock.calls.length - 1];
        expect(lastCall).toEqual(['spotify', 20]);
      });

      it('should not duck if no matching rule', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        expect(setVolume).not.toHaveBeenCalled();
      });

      it('should not double-add the same source', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'started');

        expect(audioRoutingService._activeDuckingSources.spotify).toHaveLength(1);
      });
    });

    describe('handleDuckingEvent() - completed lifecycle', () => {
      it('should restore Spotify when video completes', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');

        // Second call should restore to original volume (100 default)
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 100);
      });

      it('should not restore if another ducking source is still active', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        audioRoutingService.handleDuckingEvent('sound', 'started'); // Also active
        audioRoutingService.handleDuckingEvent('sound', 'completed'); // Sound done

        // Should NOT restore — video is still ducking, should be at 20
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 20);
      });

      it('should restore when last source completes', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('sound', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');
        audioRoutingService.handleDuckingEvent('sound', 'completed');

        // All sources done, should restore to 100
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 100);
      });

      it('should re-evaluate to higher ducking level when dominant source completes', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        audioRoutingService.handleDuckingEvent('sound', 'started'); // Stays at 20 (lowest)
        audioRoutingService.handleDuckingEvent('video', 'completed'); // Video done, sound still active

        // Should re-evaluate to sound's level (40), not restore fully
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 40);
      });

      it('should clean up pre-duck volume after full restore', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');

        expect(audioRoutingService._preDuckVolumes.spotify).toBeUndefined();
      });

      it('should handle completed event with no active ducking gracefully', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        // Complete without starting — should not throw or set volume
        audioRoutingService.handleDuckingEvent('video', 'completed');
        expect(setVolume).not.toHaveBeenCalled();
      });
    });

    describe('handleDuckingEvent() - paused/resumed lifecycle', () => {
      it('should restore volume when source is paused', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'paused');

        // Should restore to 100 (like completed, but source is still tracked as paused)
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 100);
      });

      it('should re-duck when source is resumed', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'paused');
        audioRoutingService.handleDuckingEvent('video', 'resumed');

        expect(setVolume).toHaveBeenLastCalledWith('spotify', 20);
      });

      it('should not fully restore on pause if another source is still active', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('sound', 'started');
        audioRoutingService.handleDuckingEvent('video', 'paused');

        // Sound is still active at 40, should not restore to 100
        expect(setVolume).toHaveBeenLastCalledWith('spotify', 40);
      });
    });

    describe('ducking:changed event emission', () => {
      it('should emit ducking:changed when ducking starts', () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:changed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');

        expect(handler).toHaveBeenCalledWith({
          stream: 'spotify',
          ducked: true,
          volume: 20,
          activeSources: ['video'],
          restoredVolume: 100,
        });
      });

      it('should emit ducking:changed when ducking ends', () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:changed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');

        const lastCall = handler.mock.calls[handler.mock.calls.length - 1][0];
        expect(lastCall).toEqual({
          stream: 'spotify',
          ducked: false,
          volume: 100,
          activeSources: [],
          restoredVolume: 100,
        });
      });

      it('should emit ducking:changed with multiple sources', () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:changed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'spotify', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('sound', 'started');

        const lastCall = handler.mock.calls[handler.mock.calls.length - 1][0];
        expect(lastCall.activeSources).toEqual(expect.arrayContaining(['video', 'sound']));
        expect(lastCall.volume).toBe(20); // lowest
      });
    });

    describe('reset integration', () => {
      it('should clear ducking state on reset()', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);
        audioRoutingService.handleDuckingEvent('video', 'started');

        audioRoutingService.reset();

        expect(audioRoutingService._duckingRules).toEqual([]);
        expect(audioRoutingService._activeDuckingSources).toEqual({});
        expect(audioRoutingService._preDuckVolumes).toEqual({});
      });
    });

    describe('edge cases', () => {
      it('should handle no rules loaded', () => {
        // No rules loaded at all
        audioRoutingService.handleDuckingEvent('video', 'started');
        expect(setVolume).not.toHaveBeenCalled();
      });

      it('should handle multiple target streams independently', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 },
          { when: 'video', duck: 'sound', to: 30, fadeMs: 300 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');

        expect(setVolume).toHaveBeenCalledWith('spotify', 20);
        expect(setVolume).toHaveBeenCalledWith('sound', 30);
      });

      it('should handle setStreamVolume errors gracefully', () => {
        setVolume.mockRejectedValue(new Error('No active sink-input'));

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        // Should not throw
        expect(() => {
          audioRoutingService.handleDuckingEvent('video', 'started');
        }).not.toThrow();
      });
    });

    describe('ducking engine - missing sink-input handling', () => {
      it('should not log error when target stream has no sink-input', async () => {
        // Load ducking rules
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        // Mock setStreamVolume to throw (spotifyd not running)
        audioRoutingService.setStreamVolume = jest.fn()
          .mockRejectedValue(new Error('No active sink-input found for stream \'spotify\''));

        // Trigger ducking
        audioRoutingService.handleDuckingEvent('video', 'started');

        // Wait for async .catch()
        await new Promise(r => setTimeout(r, 50));

        // Should warn, not error
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('sink-input not available for ducking'),
          expect.any(Object)
        );
        expect(logger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to set ducked volume'),
          expect.any(Object)
        );
      });

      it('should not log error when restoring volume and target has no sink-input', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        // Start ducking first (with successful volume set)
        const mockSetVolume = jest.fn()
          .mockResolvedValueOnce()  // First call (duck start) succeeds
          .mockRejectedValue(new Error('No active sink-input found for stream \'spotify\''));  // Restore fails
        audioRoutingService.setStreamVolume = mockSetVolume;

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(r => setTimeout(r, 10));

        jest.clearAllMocks();

        // Trigger restore
        audioRoutingService.handleDuckingEvent('video', 'completed');
        await new Promise(r => setTimeout(r, 50));

        // Should warn, not error
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('sink-input not available'),
          expect.any(Object)
        );
        expect(logger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to restore volume'),
          expect.any(Object)
        );
      });

      it('should still log error for unexpected volume failures', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'spotify', to: 20, fadeMs: 500 }
        ]);

        // Mock setStreamVolume to throw an unexpected error
        audioRoutingService.setStreamVolume = jest.fn()
          .mockRejectedValue(new Error('PipeWire connection refused'));

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(r => setTimeout(r, 50));

        // Should still log as error for unexpected failures
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to set ducked volume'),
          expect.any(Object)
        );
      });
    });
  });
});
