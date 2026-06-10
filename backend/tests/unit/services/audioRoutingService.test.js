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
const registry = require('../../../src/services/serviceHealthRegistry');

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

    it('should parse card events', () => {
      expect(audioRoutingService._parsePactlEvent("Event 'change' on card #59")).toEqual({
        action: 'change', type: 'card', id: '59',
      });
    });
  });

  describe('_parseSinkInputs with application.process.binary fallback', () => {
    it('finds app by application.process.binary when application.name is empty', () => {
      const output = [
        'Sink Input #42',
        '\tProperties:',
        '\t\tapplication.name = ""',
        '\t\tapplication.process.binary = "pw-play"',
      ].join('\n');
      expect(audioRoutingService._parseSinkInputs(output, 'pw-play')).toBe('42');
    });

    it('still finds VLC by application.name when set', () => {
      const output = [
        'Sink Input #99',
        '\tProperties:',
        '\t\tapplication.name = "VLC media player (LibVLC 3.0.23)"',
        '\t\tapplication.process.binary = "vlc"',
      ].join('\n');
      expect(audioRoutingService._parseSinkInputs(output, 'VLC')).toBe('99');
    });

    it('skips sink-inputs where neither field matches', () => {
      const output = [
        'Sink Input #10',
        '\tProperties:',
        '\t\tapplication.name = ""',
        '\t\tapplication.process.binary = "chromium"',
        'Sink Input #20',
        '\tProperties:',
        '\t\tapplication.name = ""',
        '\t\tapplication.process.binary = "pw-play"',
      ].join('\n');
      expect(audioRoutingService._parseSinkInputs(output, 'pw-play')).toBe('20');
    });

    // Anti-confidence regression: MPD hardcodes application.name to
    // "Music Player Daemon" regardless of config, and its binary is `mpd`
    // (not `aln-music`). Our MPD config's `name "aln-music"` field lands
    // in PipeWire as `media.name`. Without the media.name fallback,
    // STREAM_APP_NAMES.music = 'aln-music' would never match MPD's
    // sink-input → audio:volume:set / audio:route:set / ducking silently
    // no-op for music. This test locks in the media.name match path.
    it('finds MPD by media.name when application.name and binary are generic', () => {
      const output = [
        'Sink Input #1957',
        '\t\tapplication.name = "Music Player Daemon"',
        '\t\tapplication.process.binary = "mpd"',
        '\t\tmedia.name = "aln-music"',
        '\t\tnode.name = "Music Player Daemon"',
      ].join('\n');
      expect(audioRoutingService._parseSinkInputs(output, 'aln-music')).toBe('1957');
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

  // ── Sink cache ──

  describe('sink cache', () => {
    it('should return cached sinks within TTL (no second pactl call)', async () => {
      mockExecFileSuccess(
        '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
      );

      const first = await audioRoutingService.getAvailableSinks();
      const second = await audioRoutingService.getAvailableSinks();

      expect(first).toEqual(second);
      // Only one pactl call — second was a cache hit
      expect(execFile).toHaveBeenCalledTimes(1);
    });

    it('should fetch fresh data after cache invalidation', async () => {
      let callCount = 0;
      execFile.mockImplementation((cmd, args, opts, cb) => {
        callCount++;
        if (callCount === 1) {
          cb(null, '47\talsa_output.hdmi\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n', '');
        } else {
          cb(null, '47\talsa_output.hdmi\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n89\tbluez_output.AA_BB.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n', '');
        }
      });

      const first = await audioRoutingService.getAvailableSinks();
      expect(first).toHaveLength(1);

      audioRoutingService._invalidateSinkCache();
      const second = await audioRoutingService.getAvailableSinks();
      expect(second).toHaveLength(2);
      expect(callCount).toBe(2);
    });

    it('should invalidate cache on reset()', async () => {
      mockExecFileSuccess(
        '47\talsa_output.hdmi\tPipeWire\ts32le 2ch 48000Hz\tRUNNING\n'
      );

      await audioRoutingService.getAvailableSinks();
      expect(audioRoutingService._sinkCache).not.toBeNull();

      audioRoutingService.reset();
      expect(audioRoutingService._sinkCache).toBeNull();
      expect(audioRoutingService._sinkCacheTime).toBe(0);
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
        audioRoutingService.setStreamRoute('notastream', 'hdmi')
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
      expect(() => audioRoutingService.getStreamRoute('notastream')).toThrow('Invalid stream name');
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
        audioRoutingService.applyRouting('notastream')
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

    // Task 10: Fast-path from registry
    it('should return from registry without calling pactl when registry has a match', async () => {
      // Pre-populate registry directly (simulating a prior _identifySinkInput call)
      audioRoutingService._sinkInputRegistry.set('55', { index: '55', appName: 'VLC media player' });

      const result = await audioRoutingService.findSinkInput('VLC');

      expect(result).toEqual({ index: '55' });
      // pactl should NOT have been called (fast path)
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should fall back to pactl when registry is empty', async () => {
      mockExecFileSuccess([
        'Sink Input #77',
        '\tProperties:',
        '\t\tapplication.name = "VLC media player"',
      ].join('\n'));

      const result = await audioRoutingService.findSinkInput('VLC');

      expect(result).toEqual({ index: '77' });
      expect(execFile).toHaveBeenCalledWith(
        'pactl', ['list', 'sink-inputs'], expect.any(Object), expect.any(Function)
      );
    });

    it('should fall back to pactl when registry has entries but none match', async () => {
      audioRoutingService._sinkInputRegistry.set('10', { index: '10', appName: 'Firefox' });

      mockExecFileSuccess([
        'Sink Input #77',
        '\tProperties:',
        '\t\tapplication.name = "VLC media player"',
      ].join('\n'));

      const result = await audioRoutingService.findSinkInput('VLC');

      expect(result).toEqual({ index: '77' });
    });

    it('registry match is case-insensitive substring', async () => {
      audioRoutingService._sinkInputRegistry.set('99', { index: '99', appName: 'vlc media player' });

      const result = await audioRoutingService.findSinkInput('VLC');

      expect(result).toEqual({ index: '99' });
      expect(execFile).not.toHaveBeenCalled();
    });
  });

  describe('findSinkInput fast-path resolves by stream name', () => {
    beforeEach(() => {
      audioRoutingService._sinkInputRegistry.clear();
    });

    test('hits fast path for MPD even when appName is "Music Player Daemon"', async () => {
      // Simulate what _identifySinkInput would store after seeing an MPD sink-input
      audioRoutingService._sinkInputRegistry.set('42', {
        index: '42',
        appName: 'Music Player Daemon',
        stream: 'music',
      });

      // Spy on pactl call — fast path should NOT touch it
      const execSpy = jest.spyOn(audioRoutingService, '_execFile').mockResolvedValue('');

      const result = await audioRoutingService.findSinkInput('aln-music');

      expect(result).toEqual({ index: '42' });
      expect(execSpy).not.toHaveBeenCalled();
    });

    test('falls back to pactl when registry entry has no resolved stream', async () => {
      // Pre-stream-resolution state (registry written but stream not yet set)
      audioRoutingService._sinkInputRegistry.set('42', {
        index: '42',
        appName: 'Music Player Daemon',
        stream: null,
      });

      const execSpy = jest.spyOn(audioRoutingService, '_execFile').mockResolvedValue(`
Sink Input #42
	media.name = "aln-music"
    `.trim());

      const result = await audioRoutingService.findSinkInput('aln-music');

      expect(result).toEqual({ index: '42' });
      expect(execSpy).toHaveBeenCalled();
    });

    test('still hits appName substring fast path for VLC', async () => {
      audioRoutingService._sinkInputRegistry.set('17', {
        index: '17',
        appName: 'VLC media player (LibVLC 3.0.21)',
        stream: 'video',
      });

      const execSpy = jest.spyOn(audioRoutingService, '_execFile').mockResolvedValue('');

      const result = await audioRoutingService.findSinkInput('VLC');

      expect(result).toEqual({ index: '17' });
      expect(execSpy).not.toHaveBeenCalled();
    });
  });

  // ── Sink Monitor ──

  describe('startSinkMonitor()', () => {
    it('should spawn pactl subscribe', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      audioRoutingService.startSinkMonitor();

      expect(spawn).toHaveBeenCalledWith('pactl', ['subscribe'], expect.any(Object));
    });

    it('should emit sink:added on new sink event', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Mock the getAvailableSinks call that now runs before emit
      mockExecFileSuccess('89\tbluez_output.AA_BB.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE');

      const handler = jest.fn();
      audioRoutingService.on('sink:added', handler);

      audioRoutingService.startSinkMonitor();

      // Simulate pactl subscribe output
      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink #89\n"));

      // Wait for async getAvailableSinks().then() to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: '89',
      }));
    });

    it('should emit sink:removed on remove sink event', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Mock the getAvailableSinks call that now runs before emit
      mockExecFileSuccess('');

      const handler = jest.fn();
      audioRoutingService.on('sink:removed', handler);

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'remove' on sink #89\n"));

      // Wait for async getAvailableSinks().then() to complete
      await new Promise(resolve => setTimeout(resolve, 50));

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

      // BT sink exists, VLC sink-input found, but move-sink-input fails
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sinks' && args[2] === 'short') {
          cb(null, '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE\n', '');
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
          cb(new Error('Failure: No such entity'), '', '');
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

      // Simulate 5 consecutive immediate failures (no data received)
      const procs = [];
      for (let i = 0; i < 6; i++) {
        procs.push(createMockSpawnProc());
      }
      spawn.mockReturnValueOnce(procs[0])
        .mockReturnValueOnce(procs[1])
        .mockReturnValueOnce(procs[2])
        .mockReturnValueOnce(procs[3])
        .mockReturnValueOnce(procs[4])
        .mockReturnValueOnce(procs[5]);

      audioRoutingService.startSinkMonitor();

      // Each proc exits immediately without data → failure count increments
      for (let i = 0; i < 5; i++) {
        procs[i].emit('close', 1);
        await jest.advanceTimersByTimeAsync(600000); // Past any backoff
      }

      // 5th failure should have triggered gave-up — no 6th spawn
      // Initial spawn + 4 restarts = 5 total spawn calls
      // The 5th proc exits and hits maxFailures, so no 6th spawn
      procs[4].emit('close', 1);
      await jest.advanceTimersByTimeAsync(600000);

      // Should NOT have spawned a 6th process
      expect(spawn).toHaveBeenCalledTimes(5);

      jest.useRealTimers();
    });

    // Task 9: Sink-input registry via subscribe events
    it('should populate registry on sink-input new event', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Mock _identifySinkInput's pactl list sink-inputs call
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #42',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        cb(null, '', '');
      });

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink-input #42\n"));

      // Wait for async _identifySinkInput to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(true);
      expect(audioRoutingService._sinkInputRegistry.get('42')).toEqual({
        index: '42',
        appName: 'VLC media player',
        stream: 'video',
      });
    });

    it('should remove entry from registry on sink-input remove event', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '', ''));

      // Pre-populate registry
      audioRoutingService._sinkInputRegistry.set('42', { index: '42', appName: 'VLC media player' });

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'remove' on sink-input #42\n"));

      // Synchronous path — no async needed, but await a tick to be safe
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(false);
    });

    it('should not emit sink:added or sink:removed on sink-input events', async () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);
      execFile.mockImplementation((cmd, args, opts, cb) => cb(null, '', ''));

      const addedHandler = jest.fn();
      const removedHandler = jest.fn();
      audioRoutingService.on('sink:added', addedHandler);
      audioRoutingService.on('sink:removed', removedHandler);

      audioRoutingService.startSinkMonitor();

      mockProc.stdout.emit('data', Buffer.from("Event 'new' on sink-input #42\n"));
      mockProc.stdout.emit('data', Buffer.from("Event 'remove' on sink-input #42\n"));

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(addedHandler).not.toHaveBeenCalled();
      expect(removedHandler).not.toHaveBeenCalled();
    });
  });

  // ── Sink-input registry reset ──

  describe('reset() clears sink-input registry', () => {
    it('should clear _sinkInputRegistry on reset()', () => {
      audioRoutingService._sinkInputRegistry.set('42', { index: '42', appName: 'VLC media player' });
      audioRoutingService._sinkInputRegistry.set('55', { index: '55', appName: 'pw-play' });

      audioRoutingService.reset();

      expect(audioRoutingService._sinkInputRegistry.size).toBe(0);
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
      await audioRoutingService.setStreamRoute('music', 'bluetooth');
      await audioRoutingService.setStreamRoute('sound', 'some-other-sink');

      mockExecFileSuccess('');

      const status = await audioRoutingService.getRoutingStatus();

      expect(status.routes.video).toBe('hdmi');
      expect(status.routes.music).toBe('bluetooth');
      expect(status.routes.sound).toBe('some-other-sink');
    });
  });

  // ── Persistence format ──

  describe('Persistence format', () => {
    it('should persist in correct format: { routes: { video: { sink } }, defaultSink, volumes }', async () => {
      await audioRoutingService.setStreamRoute('video', 'bluetooth');

      expect(persistenceService.save).toHaveBeenCalledWith(
        'config:audioRouting',
        {
          routes: {
            video: { sink: 'bluetooth' },
          },
          defaultSink: 'hdmi',
          volumes: {},
        }
      );
    });
  });

  // ── init() ──

  describe('init()', () => {
    // Helper: mock execFile so pgrep/pkill calls from _killStaleMonitors resolve
    function mockExecFileForInit() {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        // pgrep/pkill: no stale processes found (exit code 1)
        if (cmd === 'pgrep' || cmd === 'pkill') {
          cb(new Error('no matches'), '', '');
          return;
        }
        // getAvailableSinks() pre-populates sink cache during init
        if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'sinks') {
          cb(null, '0\talsa_output.hdmi\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tIDLE', '');
          return;
        }
        cb(null, '', '');
      });
    }

    it('should load persisted routing on init', async () => {
      persistenceService.load.mockResolvedValue({
        routes: { video: { sink: 'bluetooth' } },
        defaultSink: 'hdmi',
      });

      mockExecFileForInit();
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(persistenceService.load).toHaveBeenCalledWith('config:audioRouting');
      expect(audioRoutingService.getStreamRoute('video')).toBe('bluetooth');
    });

    it('should start sink monitor on init', async () => {
      persistenceService.load.mockResolvedValue(null);
      mockExecFileForInit();
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(spawn).toHaveBeenCalledWith('pactl', ['subscribe'], expect.any(Object));
    });

    it('should use defaults when no persisted data', async () => {
      persistenceService.load.mockResolvedValue(null);
      mockExecFileForInit();
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(audioRoutingService.getStreamRoute('video')).toBe('hdmi');
    });

    it('should kill stale pactl subscribe processes on init', async () => {
      persistenceService.load.mockResolvedValue(null);
      const pkillCalls = [];
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (cmd === 'pgrep') {
          // Simulate finding stale processes
          cb(null, '12345\n67890\n', '');
          return;
        }
        if (cmd === 'pkill') {
          pkillCalls.push(args);
          cb(null, '', '');
          return;
        }
        cb(null, '', '');
      });
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(pkillCalls).toEqual([
        ['-f', 'pactl subscribe'],
      ]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Killing 2 stale pactl subscribe'),
        expect.any(Object)
      );
    });
  });

  // ── persisted config schema (volumes field) ──

  describe('persisted config schema (volumes field)', () => {
    beforeEach(() => {
      persistenceService.load.mockReset();
    });

    it('init() tolerates legacy config without volumes field', async () => {
      persistenceService.load.mockResolvedValue({
        routes: { video: { sink: 'hdmi' } },
        defaultSink: 'hdmi',
      });
      // sinks short and HDMI card activation
      mockExecFileSuccess('');
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      // Should have loaded routes
      expect(audioRoutingService.getStreamRoute('video')).toBe('hdmi');
      // Should have an empty volumes object (default)
      expect(audioRoutingService._routingData.volumes).toEqual({});

      audioRoutingService.cleanup();
    });

    it('init() loads volumes field when present', async () => {
      persistenceService.load.mockResolvedValue({
        routes: { video: { sink: 'hdmi' } },
        defaultSink: 'hdmi',
        volumes: { video: 75, music: 80 },
      });
      mockExecFileSuccess('');
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(audioRoutingService._routingData.volumes).toEqual({ video: 75, music: 80 });

      audioRoutingService.cleanup();
    });

    it('init() with no persisted config initializes empty volumes', async () => {
      persistenceService.load.mockResolvedValue(null);
      mockExecFileSuccess('');
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(audioRoutingService._routingData.volumes).toEqual({});

      audioRoutingService.cleanup();
    });

    it('reset() restores empty volumes', () => {
      audioRoutingService._routingData.volumes = { video: 50 };
      audioRoutingService.reset();
      expect(audioRoutingService._routingData.volumes).toEqual({});
    });
  });

  // ── HDMI card activation ──

  describe('HDMI card activation', () => {
    it('should activate HDMI cards with off profile on init', async () => {
      persistenceService.load.mockResolvedValue(null);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (cmd === 'pgrep' || cmd === 'pkill') {
          cb(new Error('no matches'), '', '');
          return;
        }
        // _activateHdmiCards: list cards short
        if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'cards') {
          cb(null,
            '59\talsa_card.platform-107c701400.hdmi\talsa\n' +
            '60\talsa_card.platform-107c706400.hdmi\talsa\n' +
            '80\tbluez_card.AA_BB_CC_DD_EE_FF\tmodule-bluez5-device.c',
            '');
          return;
        }
        // _activateHdmiCards: set-card-profile
        if (cmd === 'pactl' && args[0] === 'set-card-profile') {
          cb(null, '', '');
          return;
        }
        cb(null, '', '');
      });
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      // Verify set-card-profile was called for both HDMI cards
      const setCalls = execFile.mock.calls.filter(
        c => c[0] === 'pactl' && c[1]?.[0] === 'set-card-profile'
      );
      expect(setCalls).toHaveLength(2);
      expect(setCalls[0][1]).toEqual(['set-card-profile', 'alsa_card.platform-107c701400.hdmi', 'output:hdmi-stereo']);
      expect(setCalls[1][1]).toEqual(['set-card-profile', 'alsa_card.platform-107c706400.hdmi', 'output:hdmi-stereo']);
    });

    it('should handle HDMI card activation failure gracefully', async () => {
      persistenceService.load.mockResolvedValue(null);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (cmd === 'pgrep' || cmd === 'pkill') {
          cb(new Error('no matches'), '', '');
          return;
        }
        if (cmd === 'pactl' && args[0] === 'list' && args[1] === 'cards') {
          cb(null, '59\talsa_card.platform-107c701400.hdmi\talsa', '');
          return;
        }
        if (cmd === 'pactl' && args[0] === 'set-card-profile') {
          cb(new Error('Sink not available'), '', '');
          return;
        }
        cb(null, '', '');
      });
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      // Should not throw
      await expect(audioRoutingService.init()).resolves.not.toThrow();
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

    it('should prevent monitor restart after cleanup (shutdown guard)', () => {
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      audioRoutingService.startSinkMonitor();

      // Simulate data received (so close handler would normally restart)
      mockProc.stdout.emit('data', 'Event on sink #47\n');

      audioRoutingService.cleanup();

      // Simulate the close event firing (would normally schedule restart)
      mockProc.emit('close', 0);

      // Should NOT have scheduled a restart — spawn only called once (the initial start)
      expect(spawn).toHaveBeenCalledTimes(1);
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

      await audioRoutingService.setStreamVolume('music', 75);

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

    it('persists the volume into _routingData.volumes', async () => {
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('video', 75);

      expect(audioRoutingService._routingData.volumes.video).toBe(75);
    });

    it('persists the clamped value, not the raw input', async () => {
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('video', 150);

      expect(audioRoutingService._routingData.volumes.video).toBe(100);
    });

    it('calls persistenceService.save with updated config', async () => {
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('music', 60);

      expect(persistenceService.save).toHaveBeenCalledWith(
        'config:audioRouting',
        expect.objectContaining({
          volumes: expect.objectContaining({ music: 60 }),
        })
      );
    });

    it('does NOT persist when no sink-input is found (volume set failed)', async () => {
      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue(null);

      await expect(audioRoutingService.setStreamVolume('video', 50))
        .rejects.toThrow(/No active sink-input/);

      // _routingData.volumes should NOT have video — we don't want to persist
      // volumes for streams that never got the pactl call through
      expect(audioRoutingService._routingData.volumes.video).toBeUndefined();
      expect(persistenceService.save).not.toHaveBeenCalled();
    });
  });

  // ── getStreamVolume() ──

  describe('getStreamVolume()', () => {
    it('should read volume with a single pactl call (not two)', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #42',
            '\tDriver: PipeWire',
            '\tState: RUNNING',
            '\tVolume: front-left: 49152 /  75% / -7.50 dB,   front-right: 49152 /  75% / -7.50 dB',
            '\tProperties:',
            '\t\tapplication.name = "Music Player Daemon"',
            '\t\tmedia.name = "aln-music"',
          ].join('\n'), '');
          return;
        }
        cb(new Error('unexpected'), '', '');
      });

      const volume = await audioRoutingService.getStreamVolume('music');

      expect(volume).toBe(75);
      // Only ONE pactl call — not two (previously called findSinkInput + list sink-inputs separately)
      expect(execFile).toHaveBeenCalledTimes(1);
    });

    it('should return null when stream has no sink-input', async () => {
      mockExecFileSuccess([
        'Sink Input #100',
        '\tProperties:',
        '\t\tapplication.name = "Firefox"',
      ].join('\n'));

      const volume = await audioRoutingService.getStreamVolume('music');
      expect(volume).toBeNull();
    });
  });

  // ── VALID_STREAMS expansion ──

  describe('VALID_STREAMS expansion', () => {
    it('should accept music as a valid stream', () => {
      expect(audioRoutingService.isValidStream('music')).toBe(true);
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


  // ── Ducking Engine ──

  describe('ducking engine', () => {
    // setVolume spies on _setStreamVolumeLive (the no-persist path used by ducking),
    // NOT setStreamVolume — ducking must not persist transient duck/restore values.
    let setVolume;
    // Flush all pending microtasks and macro-tasks so async _handleDuckingStart completes
    const flushPromises = () => new Promise(r => setTimeout(r, 0));

    beforeEach(() => {
      setVolume = jest.spyOn(audioRoutingService, '_setStreamVolumeLive').mockResolvedValue();
      jest.spyOn(audioRoutingService, 'getStreamVolume').mockResolvedValue(100);
    });

    describe('loadDuckingRules()', () => {
      it('should load ducking rules', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        expect(audioRoutingService._duckingRules).toHaveLength(1);
        expect(audioRoutingService._duckingRules[0]).toEqual({
          when: 'video', duck: 'music', to: 20, fadeMs: 500
        });
      });

      it('should replace existing rules', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);
        audioRoutingService.loadDuckingRules([
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 }
        ]);

        expect(audioRoutingService._duckingRules).toHaveLength(1);
        expect(audioRoutingService._duckingRules[0].when).toBe('sound');
      });

      it('should clear active ducking state when rules are reloaded', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);
        audioRoutingService.handleDuckingEvent('video', 'started');

        audioRoutingService.loadDuckingRules([]);
        expect(audioRoutingService._activeDuckingSources).toEqual({});
        expect(audioRoutingService._preDuckVolumes).toEqual({});
      });
    });

    describe('handleDuckingEvent() - started lifecycle', () => {
      it('should duck Music when video starts', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        // _handleDuckingStart is async (awaits volume capture) — flush microtask queue
        await flushPromises();
        expect(setVolume).toHaveBeenCalledWith('music', 20);
      });

      it('should duck lighter for sound effects', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 }
        ]);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        // _handleDuckingStart is async (awaits volume capture) — flush microtask queue
        await flushPromises();
        expect(setVolume).toHaveBeenCalledWith('music', 40);
      });

      it('should store pre-duck volume before first duck', async () => {
        audioRoutingService.getStreamVolume.mockResolvedValue(80);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');

        // Wait for async getStreamVolume to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(audioRoutingService._preDuckVolumes.music).toBe(80);
      });

      it('should not overwrite pre-duck volume if already stored', async () => {
        audioRoutingService.getStreamVolume.mockResolvedValue(80);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Pre-duck volume stored as 80
        expect(audioRoutingService._preDuckVolumes.music).toBe(80);

        // Now change mock to return 20 (current ducked volume)
        audioRoutingService.getStreamVolume.mockResolvedValue(20);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should NOT have overwritten to 20 — still 80
        expect(audioRoutingService._preDuckVolumes.music).toBe(80);
      });

      it('should track active ducking sources per target stream', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        expect(audioRoutingService._activeDuckingSources.music).toContain('video');

        audioRoutingService.handleDuckingEvent('sound', 'started');
        expect(audioRoutingService._activeDuckingSources.music).toContain('video');
        expect(audioRoutingService._activeDuckingSources.music).toContain('sound');
      });

      it('should use lowest "to" value when multiple sources are active', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        // Flush microtask queue for first duck (awaits volume capture)
        await flushPromises();
        audioRoutingService.handleDuckingEvent('sound', 'started'); // Would be 40, but video says 20
        await flushPromises();

        // Most recent call should still be 20 (lowest active)
        const lastCall = setVolume.mock.calls[setVolume.mock.calls.length - 1];
        expect(lastCall).toEqual(['music', 20]);
      });

      it('should not duck if no matching rule', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('sound', 'started');
        expect(setVolume).not.toHaveBeenCalled();
      });

      it('should not double-add the same source', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'started');

        expect(audioRoutingService._activeDuckingSources.music).toHaveLength(1);
      });

      it('should capture pre-duck volume before applying duck (race fix)', async () => {
        // Simulate the race: getStreamVolume takes time to resolve.
        // Without the fix, _setVolumeForDucking (sync) runs before the async
        // getStreamVolume resolves, so the captured value would be the already-ducked one.
        // With the fix, _handleDuckingStart awaits capture before applying duck.
        let resolveVolume;
        const volumePromise = new Promise(resolve => { resolveVolume = resolve; });
        audioRoutingService.getStreamVolume.mockReturnValue(volumePromise);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        // Start ducking — _handleDuckingStart awaits volume capture before setVolume
        const duckingPromise = audioRoutingService._handleDuckingStart('video',
          audioRoutingService._duckingRules);

        // Volume read has NOT completed yet — setVolume should NOT have been called
        expect(setVolume).not.toHaveBeenCalled();
        expect(audioRoutingService._preDuckVolumes.music).toBeUndefined();

        // Now resolve the volume read with 75
        resolveVolume(75);
        await duckingPromise;

        // Volume captured BEFORE duck applied — pre-duck should be 75 (not 20)
        expect(audioRoutingService._preDuckVolumes.music).toBe(75);
        // Duck was applied after capture
        expect(setVolume).toHaveBeenCalledWith('music', 20);
      });
    });

    describe('handleDuckingEvent() - completed lifecycle', () => {
      it('should process all target streams even when first has no active ducking', async () => {
        // Rules: video ducks BOTH music AND sound
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'video', duck: 'sound', to: 30, fadeMs: 200 },
        ]);

        // Only start ducking for 'sound', NOT for 'music'
        // Manually set up state so music has no active sources but sound does
        audioRoutingService._activeDuckingSources = { sound: ['video'] };
        audioRoutingService._preDuckVolumes = { sound: 80 };

        // Complete video — should restore 'sound' even though 'music' has no active sources
        audioRoutingService.handleDuckingEvent('video', 'completed');
        await flushPromises(); // duck/restore writes are serialized per target

        // 'sound' should be restored to pre-duck volume
        expect(setVolume).toHaveBeenCalledWith('sound', 80);
      });

      it('should restore Music when video completes', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await audioRoutingService.handleDuckingEvent('video', 'completed');
        await flushPromises(); // duck/restore writes are serialized per target

        // Second call should restore to original volume (100 default)
        expect(setVolume).toHaveBeenLastCalledWith('music', 100);
      });

      it('should not restore if another ducking source is still active', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        await audioRoutingService.handleDuckingEvent('sound', 'started'); // Also active
        await audioRoutingService.handleDuckingEvent('sound', 'completed'); // Sound done
        await flushPromises(); // duck/restore writes are serialized per target

        // Should NOT restore — video is still ducking, should be at 20
        expect(setVolume).toHaveBeenLastCalledWith('music', 20);
      });

      it('should restore when last source completes', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await audioRoutingService.handleDuckingEvent('sound', 'started');
        await audioRoutingService.handleDuckingEvent('video', 'completed');
        await audioRoutingService.handleDuckingEvent('sound', 'completed');
        await flushPromises(); // duck/restore writes are serialized per target

        // All sources done, should restore to 100
        expect(setVolume).toHaveBeenLastCalledWith('music', 100);
      });

      it('should re-evaluate to higher ducking level when dominant source completes', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started'); // Duck to 20
        await audioRoutingService.handleDuckingEvent('sound', 'started'); // Stays at 20 (lowest)
        await audioRoutingService.handleDuckingEvent('video', 'completed'); // Video done, sound still active
        await flushPromises(); // duck/restore writes are serialized per target

        // Should re-evaluate to sound's level (40), not restore fully
        expect(setVolume).toHaveBeenLastCalledWith('music', 40);
      });

      it('should clean up pre-duck volume after full restore', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');

        expect(audioRoutingService._preDuckVolumes.music).toBeUndefined();
      });

      it('should handle completed event with no active ducking gracefully', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        // Complete without starting — should not throw or set volume
        audioRoutingService.handleDuckingEvent('video', 'completed');
        expect(setVolume).not.toHaveBeenCalled();
      });
    });

    describe('handleDuckingEvent() - paused/resumed lifecycle', () => {
      it('should restore volume when source is paused', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await audioRoutingService.handleDuckingEvent('video', 'paused');
        await flushPromises(); // duck/restore writes are serialized per target

        // Should restore to 100 (like completed, but source is still tracked as paused)
        expect(setVolume).toHaveBeenLastCalledWith('music', 100);
      });

      it('should re-duck when source is resumed', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        await flushPromises();
        audioRoutingService.handleDuckingEvent('video', 'paused');
        audioRoutingService.handleDuckingEvent('video', 'resumed');
        await flushPromises();

        expect(setVolume).toHaveBeenLastCalledWith('music', 20);
      });

      it('should not fully restore on pause if another source is still active', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await audioRoutingService.handleDuckingEvent('sound', 'started');
        await audioRoutingService.handleDuckingEvent('video', 'paused');
        await flushPromises(); // duck/restore writes are serialized per target

        // Sound is still active at 40, should not restore to 100
        expect(setVolume).toHaveBeenLastCalledWith('music', 40);
      });
    });

    describe('ducking:changed event emission', () => {
      it('should emit ducking:changed when ducking starts', async () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:changed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        // _handleDuckingStart is async — flush microtask queue
        await flushPromises();

        expect(handler).toHaveBeenCalledWith({
          stream: 'music',
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
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        audioRoutingService.handleDuckingEvent('video', 'completed');

        const lastCall = handler.mock.calls[handler.mock.calls.length - 1][0];
        expect(lastCall).toEqual({
          stream: 'music',
          ducked: false,
          volume: 100,
          activeSources: [],
          restoredVolume: 100,
        });
      });

      it('should emit ducking:changed with multiple sources', async () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:changed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'sound', duck: 'music', to: 40, fadeMs: 200 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        await flushPromises();
        audioRoutingService.handleDuckingEvent('sound', 'started');
        await flushPromises();

        const lastCall = handler.mock.calls[handler.mock.calls.length - 1][0];
        expect(lastCall.activeSources).toEqual(expect.arrayContaining(['video', 'sound']));
        expect(lastCall.volume).toBe(20); // lowest
      });
    });

    describe('reset integration', () => {
      it('should clear ducking state on reset()', () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
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

      it('should handle multiple target streams independently', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 },
          { when: 'video', duck: 'sound', to: 30, fadeMs: 300 },
        ]);

        audioRoutingService.handleDuckingEvent('video', 'started');
        // _handleDuckingStart is async — flush microtask queue
        await flushPromises();

        expect(setVolume).toHaveBeenCalledWith('music', 20);
        expect(setVolume).toHaveBeenCalledWith('sound', 30);
      });

      it('should handle setStreamVolume errors gracefully', () => {
        setVolume.mockRejectedValue(new Error('No active sink-input'));

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
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
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        // Mock _setStreamVolumeLive to throw (MPD not running) — ducking uses the no-persist path
        audioRoutingService._setStreamVolumeLive = jest.fn()
          .mockRejectedValue(new Error('No active sink-input found for stream \'music\''));

        // Trigger ducking
        audioRoutingService.handleDuckingEvent('video', 'started');

        // Wait for async .catch()
        await new Promise(r => setTimeout(r, 50));

        // Should warn, not error
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('sink-input not available'),
          expect.any(Object)
        );
        expect(logger.error).not.toHaveBeenCalledWith(
          expect.stringContaining('Failed to apply ducked volume'),
          expect.any(Object)
        );
      });

      it('should not log error when restoring volume and target has no sink-input', async () => {
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        // Start ducking first (with successful volume set)
        const mockSetVolume = jest.fn()
          .mockResolvedValueOnce()  // First call (duck start) succeeds
          .mockRejectedValue(new Error('No active sink-input found for stream \'music\''));  // Restore fails
        audioRoutingService._setStreamVolumeLive = mockSetVolume;

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
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        // Mock _setStreamVolumeLive to throw an unexpected error
        audioRoutingService._setStreamVolumeLive = jest.fn()
          .mockRejectedValue(new Error('PipeWire connection refused'));

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(r => setTimeout(r, 50));

        // Should still log as error for unexpected failures
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to apply ducked volume'),
          expect.any(Object)
        );
      });

      it('should emit ducking:failed for non-missing-sink errors', async () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:failed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService._setStreamVolumeLive = jest.fn()
          .mockRejectedValue(new Error('PipeWire daemon not responding'));

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(r => setTimeout(r, 50));

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({
          target: 'music',
          error: expect.stringContaining('PipeWire')
        }));
      });

      it('should NOT emit ducking:failed for missing sink-input', async () => {
        const handler = jest.fn();
        audioRoutingService.on('ducking:failed', handler);

        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
        ]);

        audioRoutingService._setStreamVolumeLive = jest.fn()
          .mockRejectedValue(new Error('No active sink-input for music'));

        audioRoutingService.handleDuckingEvent('video', 'started');
        await new Promise(r => setTimeout(r, 50));

        expect(handler).not.toHaveBeenCalled();
      });
    });

    // ── Restore robustness (F-SHOW-05/06/27, decision E3) ──
    // E3 owner override: restore to the CAPTURED pre-duck volume (operator
    // intent at duck time); fall back to the persisted user volume ONLY when
    // capture is missing. The hardcoded-100 fallback is dead either way.
    describe('restore robustness (F-SHOW-05/06/27, decision E3)', () => {
      beforeEach(() => {
        // Return the applied volume like the real _setStreamVolumeLive does
        // (setStreamVolume persists the returned clamped value)
        setVolume.mockImplementation(async (stream, vol) =>
          Math.max(0, Math.min(100, vol)));
      });

      it('(a) does not restore on a redundant stop (empty-but-truthy active array)', async () => {
        // Sequence from F-SHOW-05: duck → pause (restore, array left []) →
        // completed (redundant). Pre-fix the empty array passed the truthy
        // check and forced volume to hardcoded 100, clobbering the GM's 60.
        audioRoutingService.getStreamVolume.mockResolvedValue(60);
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 0 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await audioRoutingService.handleDuckingEvent('video', 'paused');
        await flushPromises();

        setVolume.mockClear();
        const changed = jest.fn();
        audioRoutingService.on('ducking:changed', changed);

        await audioRoutingService.handleDuckingEvent('video', 'completed');
        await flushPromises();

        expect(setVolume).not.toHaveBeenCalled();
        expect(changed).not.toHaveBeenCalled();
      });

      it('(b) falls back to the persisted user volume when capture is missing — never 100', async () => {
        // Duck arrives before the music sink-input exists: capture reads null.
        // Restore target must be the persisted user volume (65), not 100.
        audioRoutingService._routingData.volumes.music = 65;
        audioRoutingService.getStreamVolume.mockResolvedValue(null);
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 0 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await flushPromises();
        await audioRoutingService.handleDuckingEvent('video', 'completed');
        await flushPromises();

        expect(setVolume).toHaveBeenCalledWith('music', 65);
        expect(setVolume).not.toHaveBeenCalledWith('music', 100);
      });

      it('(c) GM volume:set during an active duck refreshes the captured restore target', async () => {
        audioRoutingService.getStreamVolume.mockResolvedValue(60);
        audioRoutingService.loadDuckingRules([
          { when: 'video', duck: 'music', to: 20, fadeMs: 0 },
        ]);

        await audioRoutingService.handleDuckingEvent('video', 'started');
        await flushPromises();
        expect(audioRoutingService._preDuckVolumes.music).toBe(60);

        // GM adjusts music volume live mid-duck — restore target follows
        await audioRoutingService.setStreamVolume('music', 75);
        expect(audioRoutingService._preDuckVolumes.music).toBe(75);

        setVolume.mockClear();
        await audioRoutingService.handleDuckingEvent('video', 'completed');
        await flushPromises();

        expect(setVolume).toHaveBeenCalledWith('music', 75);
      });

      it('(d) serializes duck/restore volume writes per target (no apply/restore inversion)', async () => {
        // F-SHOW-06: a short sound's restore must not overtake the still-in-
        // flight duck apply (which would leave music stuck at duck volume).
        let releaseFirstWrite;
        const firstWriteGate = new Promise(r => { releaseFirstWrite = r; });
        const writes = [];
        setVolume.mockImplementation(async (stream, vol) => {
          writes.push(`start:${vol}`);
          if (writes.length === 1) await firstWriteGate; // slow first pactl pipeline
          writes.push(`end:${vol}`);
          return vol;
        });
        audioRoutingService.getStreamVolume.mockResolvedValue(60);
        audioRoutingService.loadDuckingRules([
          { when: 'sound', duck: 'music', to: 40, fadeMs: 0 },
        ]);

        // handleDuckingEvent awaits its queued writes — do NOT await here,
        // the first write is gated to simulate a slow pactl pipeline
        const startEvent = audioRoutingService.handleDuckingEvent('sound', 'started');
        await flushPromises(); // capture resolves, duck apply starts (blocked on gate)
        const stopEvent = audioRoutingService.handleDuckingEvent('sound', 'completed');
        await flushPromises();

        // Restore (60) must not start while the duck apply (40) is in flight
        expect(writes).toEqual(['start:40']);

        releaseFirstWrite();
        await Promise.all([startEvent, stopEvent]);
        await flushPromises();
        expect(writes).toEqual(['start:40', 'end:40', 'start:60', 'end:60']);
      });
    });
  });

  // ── Health registry reporting ──

  describe('health registry reporting', () => {
    it('should report healthy on init', async () => {
      mockExecFileSuccess(''); // _killStaleMonitors
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);

      await audioRoutingService.init();

      expect(registry.isHealthy('audio')).toBe(true);
      expect(registry.getStatus('audio').message).toBe('Audio routing initialized');
    });

    it('should report down on reset', async () => {
      // First make it healthy
      mockExecFileSuccess('');
      const mockProc = createMockSpawnProc();
      spawn.mockReturnValue(mockProc);
      await audioRoutingService.init();
      expect(registry.isHealthy('audio')).toBe(true);

      audioRoutingService.reset();

      expect(registry.isHealthy('audio')).toBe(false);
    });

    it('checkHealth should report healthy when pactl info succeeds', async () => {
      mockExecFileSuccess('Server Name: PulseAudio (on PipeWire)\nServer Version: 1.0\n');

      const result = await audioRoutingService.checkHealth();

      expect(result).toBe(true);
      expect(registry.isHealthy('audio')).toBe(true);
    });

    it('checkHealth should report down when pactl info fails', async () => {
      mockExecFileError('Connection refused');

      const result = await audioRoutingService.checkHealth();

      expect(result).toBe(false);
      expect(registry.isHealthy('audio')).toBe(false);
    });

    it('checkHealth should return boolean (not throw)', async () => {
      mockExecFileError('timeout');

      const result = await audioRoutingService.checkHealth();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('sinkExists()', () => {
    it('should return true when sink name is in cache', () => {
      audioRoutingService._sinkCache = [
        { id: 1, name: 'alsa_output.hdmi', driver: 'PipeWire', state: 'IDLE' },
        { id: 2, name: 'bluez_output.AA_BB', driver: 'PipeWire', state: 'RUNNING' },
      ];

      expect(audioRoutingService.sinkExists('bluez_output.AA_BB')).toBe(true);
    });

    it('should return false when sink name is not in cache', () => {
      audioRoutingService._sinkCache = [
        { id: 1, name: 'alsa_output.hdmi', driver: 'PipeWire', state: 'IDLE' },
      ];

      expect(audioRoutingService.sinkExists('nonexistent_sink')).toBe(false);
    });

    it('should return false when sink cache is null (not yet populated)', () => {
      audioRoutingService._sinkCache = null;

      expect(audioRoutingService.sinkExists('any_sink')).toBe(false);
    });
  });

  // ── getState() ──

  describe('getState()', () => {
    it('should include availableSinks from cache', () => {
      // Directly populate sink cache (avoids mock chain issues in full suite)
      audioRoutingService._sinkCache = [
        { id: '1', name: 'some_hdmi_sink', driver: 'PipeWire', format: 's16le 2ch 48000Hz', state: 'RUNNING', type: 'hdmi', label: 'HDMI' },
        { id: '2', name: 'bluez_output.AA_BB_CC_DD_EE_FF.1', driver: 'PipeWire', format: 's16le 2ch 44100Hz', state: 'RUNNING', type: 'bluetooth', label: 'BT Speaker (EE:FF)' },
      ];

      const state = audioRoutingService.getState();

      expect(state.availableSinks).toBeDefined();
      expect(state.availableSinks).toHaveLength(2);
      expect(state.availableSinks[0].type).toBe('hdmi');
      expect(state.availableSinks[1].type).toBe('bluetooth');
    });

    it('should filter auto_null sink from availableSinks', () => {
      audioRoutingService._sinkCache = [
        { id: '1', name: 'bluez_output.AA_BB.1', driver: 'PipeWire', format: 's16le 2ch 44100Hz', state: 'RUNNING', type: 'bluetooth', label: 'BT Speaker (AA:BB)' },
        { id: '2', name: 'auto_null', driver: 'PipeWire', format: '', state: 'SUSPENDED', type: 'other', label: 'auto_null' },
      ];

      const state = audioRoutingService.getState();

      // auto_null filtered out
      expect(state.availableSinks).toHaveLength(1);
      expect(state.availableSinks[0].type).toBe('bluetooth');
    });

    it('should return empty availableSinks when cache is empty', () => {
      const state = audioRoutingService.getState();
      expect(state.availableSinks).toEqual([]);
    });

    test('getState returns a defensive copy of the persisted volumes', () => {
      audioRoutingService._routingData.volumes = { video: 75, music: 40 };

      const state = audioRoutingService.getState();

      expect(state.volumes).toEqual({ video: 75, music: 40 });

      state.volumes.video = 0;
      expect(audioRoutingService._routingData.volumes.video).toBe(75);
    });

    test('getState returns empty volumes object when none persisted', () => {
      audioRoutingService._routingData.volumes = {};
      expect(audioRoutingService.getState().volumes).toEqual({});
    });
  });

  // ── Persistence decoupling: ducking vs public setStreamVolume ──
  //
  // Regression guard: setStreamVolume() persists to _routingData.volumes (user intent).
  // The ducking engine MUST NOT persist its transient duck/restore volumes — otherwise,
  // a restart mid-duck (or session end mid-duck) would leave the ducked value persisted,
  // and the reactive _identifySinkInput path would re-apply it on the next sink-input.
  // Ducking must use the live-only path (_setStreamVolumeLive); setStreamVolume is reserved
  // for user intent (live + persist).
  describe('ducking persistence decoupling', () => {
    // Flush microtasks for fire-and-forget paths in ducking
    const flushPromises = () => new Promise(r => setTimeout(r, 0));

    it('ducking does NOT persist via persistenceService.save', async () => {
      // Reset persistence mock so we only see calls made during the ducking event
      persistenceService.save.mockReset();
      persistenceService.save.mockResolvedValue();

      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      jest.spyOn(audioRoutingService, 'getStreamVolume').mockResolvedValue(80);
      mockExecFileSuccess('');

      audioRoutingService.loadDuckingRules([
        { when: 'video', duck: 'music', to: 20, fadeMs: 500 }
      ]);
      await audioRoutingService.handleDuckingEvent('video', 'started');
      // Allow any fire-and-forget promises (the _setVolumeForDucking chain) to settle
      await flushPromises();

      // The ducking engine should NOT have persisted anything
      expect(persistenceService.save).not.toHaveBeenCalled();
      // And the in-memory state should NOT have music in volumes
      expect(audioRoutingService._routingData.volumes.music).toBeUndefined();
    });

    it('setStreamVolume (public) still persists', async () => {
      persistenceService.save.mockReset();
      persistenceService.save.mockResolvedValue();

      jest.spyOn(audioRoutingService, 'findSinkInput').mockResolvedValue({ index: '42' });
      mockExecFileSuccess('');

      await audioRoutingService.setStreamVolume('video', 75);

      expect(audioRoutingService._routingData.volumes.video).toBe(75);
      expect(persistenceService.save).toHaveBeenCalledWith(
        'config:audioRouting',
        expect.objectContaining({
          volumes: expect.objectContaining({ video: 75 })
        })
      );
    });
  });

  // ── Reactive volume application on _identifySinkInput ──
  //
  // When a new sink-input appears (e.g., VLC starts a video, MPD plays a track),
  // _identifySinkInput() registers it AND re-applies the user's persisted volume.
  // This makes the orchestrator the source of truth for per-stream volume across
  // VLC/MPD restarts — instead of relying on WirePlumber's restore-stream.
  describe('reactive volume application on _identifySinkInput()', () => {
    const flushPromises = () => new Promise(r => setTimeout(r, 0));

    it('applies persisted video volume when a VLC sink-input appears', async () => {
      // Seed a persisted video volume
      audioRoutingService._routingData.volumes = { video: 65 };

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #42',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player (Pulse audio output)"',
          ].join('\n'), '');
          return;
        }
        cb(null, '', '');
      });

      await audioRoutingService._identifySinkInput('42');

      // Registry populated
      expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(true);

      // pactl set-sink-input-volume was called with the persisted value
      const setVolCalls = execFile.mock.calls.filter(
        c => c[1][0] === 'set-sink-input-volume'
      );
      expect(setVolCalls.length).toBe(1);
      expect(setVolCalls[0][1]).toEqual(['set-sink-input-volume', '42', '65%']);
    });

    it('applies persisted music volume when an MPD (aln-music) sink-input appears', async () => {
      audioRoutingService._routingData.volumes = { music: 80 };

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          // MPD sets application.name = "Music Player Daemon" but our config
          // puts "aln-music" in media.name — the helper must match on media.name
          cb(null, [
            'Sink Input #55',
            '\tProperties:',
            '\t\tapplication.name = "Music Player Daemon"',
            '\t\tmedia.name = "aln-music"',
          ].join('\n'), '');
          return;
        }
        cb(null, '', '');
      });

      await audioRoutingService._identifySinkInput('55');

      // The registry registers what was found by app/binary first — but volume
      // application must still resolve to the 'music' stream via media.name.
      const setVolCalls = execFile.mock.calls.filter(
        c => c[1][0] === 'set-sink-input-volume'
      );
      expect(setVolCalls.length).toBe(1);
      expect(setVolCalls[0][1]).toEqual(['set-sink-input-volume', '55', '80%']);
    });

    it('does NOT apply volume when stream has no persisted entry', async () => {
      // Empty volumes — nothing should be applied
      audioRoutingService._routingData.volumes = {};

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #42',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        cb(null, '', '');
      });

      await audioRoutingService._identifySinkInput('42');

      // Registry still populated
      expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(true);
      // But NO volume application
      const setVolCalls = execFile.mock.calls.filter(
        c => c[1][0] === 'set-sink-input-volume'
      );
      expect(setVolCalls.length).toBe(0);
    });

    it('still registers the sink-input even if volume application fails', async () => {
      audioRoutingService._routingData.volumes = { video: 65 };

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #42',
            '\tProperties:',
            '\t\tapplication.name = "VLC media player"',
          ].join('\n'), '');
          return;
        }
        if (args[0] === 'set-sink-input-volume') {
          cb(new Error('pactl: connection refused'), '', '');
          return;
        }
        cb(null, '', '');
      });

      // Should not throw despite the failed volume application
      await expect(audioRoutingService._identifySinkInput('42')).resolves.toBeUndefined();

      // Registry still populated
      expect(audioRoutingService._sinkInputRegistry.has('42')).toBe(true);
      expect(audioRoutingService._sinkInputRegistry.get('42')).toEqual({
        index: '42',
        appName: 'VLC media player',
        stream: 'video',
      });
    });

    it('does NOT apply volume when sink-input is not a known stream (e.g., Firefox)', async () => {
      audioRoutingService._routingData.volumes = { video: 65, music: 80 };

      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'list' && args[1] === 'sink-inputs') {
          cb(null, [
            'Sink Input #99',
            '\tProperties:',
            '\t\tapplication.name = "Firefox"',
          ].join('\n'), '');
          return;
        }
        cb(null, '', '');
      });

      await audioRoutingService._identifySinkInput('99');

      // Registry populated for Firefox
      expect(audioRoutingService._sinkInputRegistry.has('99')).toBe(true);
      // No volume application — Firefox isn't a known stream
      const setVolCalls = execFile.mock.calls.filter(
        c => c[1][0] === 'set-sink-input-volume'
      );
      expect(setVolCalls.length).toBe(0);
    });
  });

  describe('_verifyWirePlumberRule', () => {
    let warnSpy;
    beforeEach(() => {
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    test('logs a warning when the rule file is absent', async () => {
      const accessSpy = jest.spyOn(require('fs').promises, 'access')
        .mockRejectedValue(new Error('ENOENT'));

      await audioRoutingService._verifyWirePlumberRule();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WirePlumber rule missing'),
        expect.any(Object)
      );
      accessSpy.mockRestore();
    });

    test('does not warn when the rule file is present', async () => {
      const accessSpy = jest.spyOn(require('fs').promises, 'access')
        .mockResolvedValue(undefined);

      await audioRoutingService._verifyWirePlumberRule();

      expect(warnSpy).not.toHaveBeenCalled();
      accessSpy.mockRestore();
    });

    test('is invoked from init()', async () => {
      const verifySpy = jest.spyOn(audioRoutingService, '_verifyWirePlumberRule')
        .mockResolvedValue(undefined);
      // Mock the other init side effects that touch the host
      jest.spyOn(audioRoutingService, '_killStaleMonitors').mockResolvedValue();
      jest.spyOn(audioRoutingService, '_activateHdmiCards').mockResolvedValue();
      jest.spyOn(audioRoutingService, 'startSinkMonitor').mockImplementation(() => {});
      jest.spyOn(audioRoutingService, 'getAvailableSinks').mockResolvedValue([]);
      jest.spyOn(persistenceService, 'load').mockResolvedValue(null);

      await audioRoutingService.init();

      expect(verifySpy).toHaveBeenCalledTimes(1);
    });
  });
});
