/**
 * Unit tests for pactlClient — pure pactl output parsers.
 *
 * No process mocks needed: these parsers are pure functions operating on strings.
 * All tests use fixture strings taken from real pactl output.
 */

// Mock execHelper to avoid child_process dependency
jest.mock('../../../../src/utils/execHelper', () => ({
  execFileAsync: jest.fn(),
}));

const {
  parseSinkList,
  parsePactlEvent,
  parseSinkInputSection,
  parseSinkInputsByAppName,
  parseSinkInputById,
  extractVolumeForSinkInput,
} = require('../../../../src/services/audio/pactlClient');

// ── Helpers for parseSinkList ──

/** Simple classify function for test use */
function testClassify(name) {
  if (name.startsWith('bluez_output')) return 'bluetooth';
  if (name.toLowerCase().includes('hdmi')) return 'hdmi';
  return 'other';
}

/** Simple label function for test use */
function testLabel(name, type) {
  if (type === 'hdmi') return 'HDMI';
  if (type === 'bluetooth') return `BT:${name}`;
  return name;
}

// ── Fixture strings ──

const SINK_LIST_FIXTURE = [
  '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
  '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE',
].join('\n');

const SINK_INPUTS_FIXTURE = [
  'Sink Input #42',
  '\tDriver: PipeWire',
  '\tState: RUNNING',
  '\tProperties:',
  '\t\tapplication.name = "VLC media player (LibVLC 3.0.23)"',
  '\t\tapplication.process.binary = "vlc"',
  '\t\tmedia.name = "some video"',
  '\t\tnode.name = "VLC media player (LibVLC 3.0.23)"',
  '\tVolume: front-left: 65536 / 100% / 0.00 dB,   front-right: 65536 / 100% / 0.00 dB',
  '',
  'Sink Input #1957',
  '\tProperties:',
  '\t\tapplication.name = "Music Player Daemon"',
  '\t\tapplication.process.binary = "mpd"',
  '\t\tmedia.name = "aln-music"',
  '\t\tnode.name = "Music Player Daemon"',
  '\tVolume: front-left: 39321 / 60% / -8.34 dB,   front-right: 39321 / 60% / -8.34 dB',
  '',
  'Sink Input #200',
  '\tProperties:',
  '\t\tapplication.name = ""',
  '\t\tapplication.process.binary = "pw-play"',
  '\t\tmedia.name = "audio.wav"',
  '\tVolume: front-left: 52429 / 80% / -5.39 dB,   front-right: 52429 / 80% / -5.39 dB',
].join('\n');

// ── parseSinkList ──

describe('parseSinkList()', () => {
  it('parses two-sink output into structured objects', () => {
    const sinks = parseSinkList(SINK_LIST_FIXTURE, testClassify, testLabel);
    expect(sinks).toHaveLength(2);
    expect(sinks[0]).toMatchObject({
      id: '47',
      name: 'alsa_output.platform-fef00700.hdmi.hdmi-stereo',
      type: 'hdmi',
      label: 'HDMI',
      state: 'RUNNING',
    });
    expect(sinks[1]).toMatchObject({
      id: '89',
      name: 'bluez_output.AA_BB_CC_DD_EE_FF.1',
      type: 'bluetooth',
    });
  });

  it('returns empty array for empty output', () => {
    expect(parseSinkList('', testClassify, testLabel)).toEqual([]);
    expect(parseSinkList(null, testClassify, testLabel)).toEqual([]);
  });

  it('skips malformed lines with fewer than 2 tab-fields', () => {
    const output = [
      '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
      'garbage line',
      '',
    ].join('\n');
    const sinks = parseSinkList(output, testClassify, testLabel);
    expect(sinks).toHaveLength(1);
    expect(sinks[0].type).toBe('hdmi');
  });

  it('handles missing optional fields gracefully', () => {
    const output = '47\tsome.sink.name';
    const sinks = parseSinkList(output, testClassify, testLabel);
    expect(sinks).toHaveLength(1);
    expect(sinks[0].driver).toBe('');
    expect(sinks[0].format).toBe('');
    expect(sinks[0].state).toBe('');
  });
});

// ── parsePactlEvent ──

describe('parsePactlEvent()', () => {
  it('parses new sink event', () => {
    expect(parsePactlEvent("Event 'new' on sink #89")).toEqual({
      action: 'new',
      type: 'sink',
      id: '89',
    });
  });

  it('parses remove sink event', () => {
    expect(parsePactlEvent("Event 'remove' on sink #89")).toEqual({
      action: 'remove',
      type: 'sink',
      id: '89',
    });
  });

  it('parses sink-input events', () => {
    expect(parsePactlEvent("Event 'new' on sink-input #42")).toEqual({
      action: 'new',
      type: 'sink-input',
      id: '42',
    });
  });

  it('parses card events', () => {
    expect(parsePactlEvent("Event 'change' on card #59")).toEqual({
      action: 'change',
      type: 'card',
      id: '59',
    });
  });

  it('returns null for non-matching events (server-level events)', () => {
    expect(parsePactlEvent("Event 'change' on server")).toBeNull();
  });

  it('returns null for unrecognized lines', () => {
    expect(parsePactlEvent('some random text')).toBeNull();
    expect(parsePactlEvent('')).toBeNull();
  });
});

// ── parseSinkInputSection ──

describe('parseSinkInputSection()', () => {
  it('extracts all three identity fields from a VLC section', () => {
    const section = [
      '42',
      '\t\tapplication.name = "VLC media player (LibVLC 3.0.23)"',
      '\t\tapplication.process.binary = "vlc"',
      '\t\tmedia.name = "some video"',
    ].join('\n');

    const result = parseSinkInputSection(section);
    expect(result).toEqual({
      appName: 'VLC media player (LibVLC 3.0.23)',
      binary: 'vlc',
      mediaName: 'some video',
    });
  });

  it('extracts only application.name when others are absent', () => {
    const section = '\t\tapplication.name = "Firefox"';
    const result = parseSinkInputSection(section);
    expect(result.appName).toBe('Firefox');
    expect(result.binary).toBeNull();
    expect(result.mediaName).toBeNull();
  });

  it('extracts media.name for MPD where appName is generic', () => {
    const section = [
      '\t\tapplication.name = "Music Player Daemon"',
      '\t\tapplication.process.binary = "mpd"',
      '\t\tmedia.name = "aln-music"',
    ].join('\n');
    const result = parseSinkInputSection(section);
    expect(result.appName).toBe('Music Player Daemon');
    expect(result.binary).toBe('mpd');
    expect(result.mediaName).toBe('aln-music');
  });

  it('returns null for missing fields', () => {
    const result = parseSinkInputSection('no properties here');
    expect(result.appName).toBeNull();
    expect(result.binary).toBeNull();
    expect(result.mediaName).toBeNull();
  });
});

// ── parseSinkInputsByAppName (F-SHOW-24: unified replacement) ──

describe('parseSinkInputsByAppName()', () => {
  it('finds VLC by application.name substring', () => {
    expect(parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'VLC')).toBe('42');
  });

  it('finds MPD by media.name when application.name is generic (F-SHOW-24 key case)', () => {
    // MPD sets application.name = "Music Player Daemon" but config's
    // `name "aln-music"` lands in media.name — only unique signal
    expect(parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'aln-music')).toBe('1957');
  });

  it('finds pw-play by application.process.binary when application.name is empty', () => {
    expect(parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'pw-play')).toBe('200');
  });

  it('returns null when appName does not match any sink-input', () => {
    expect(parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'Firefox')).toBeNull();
  });

  it('returns null for empty output', () => {
    expect(parseSinkInputsByAppName('', 'VLC')).toBeNull();
    expect(parseSinkInputsByAppName(null, 'VLC')).toBeNull();
  });

  it('returns first matching sink-input when multiple exist', () => {
    // VLC appears at index 42 — should return 42, not the later MPD entry
    expect(parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'VLC')).toBe('42');
  });

  it('does not match "Music Player Daemon" when searching for aln-music by name only', () => {
    // Sanity: application.name "Music Player Daemon" does NOT include "aln-music"
    const result = parseSinkInputsByAppName(SINK_INPUTS_FIXTURE, 'aln-music');
    // Should match via media.name, not application.name
    expect(result).toBe('1957');
  });
});

// ── parseSinkInputById ──

describe('parseSinkInputById()', () => {
  it('finds VLC section by id 42', () => {
    const result = parseSinkInputById(SINK_INPUTS_FIXTURE, '42');
    expect(result).not.toBeNull();
    expect(result.appName).toContain('VLC');
    expect(result.binary).toBe('vlc');
  });

  it('finds MPD section by id 1957', () => {
    const result = parseSinkInputById(SINK_INPUTS_FIXTURE, '1957');
    expect(result).not.toBeNull();
    expect(result.appName).toBe('Music Player Daemon');
    expect(result.mediaName).toBe('aln-music');
  });

  it('returns null when id does not exist', () => {
    expect(parseSinkInputById(SINK_INPUTS_FIXTURE, '9999')).toBeNull();
  });

  it('returns null for empty output', () => {
    expect(parseSinkInputById('', '42')).toBeNull();
  });
});

// ── extractVolumeForSinkInput ──

describe('extractVolumeForSinkInput()', () => {
  it('extracts 100% volume for VLC sink-input 42', () => {
    expect(extractVolumeForSinkInput(SINK_INPUTS_FIXTURE, '42')).toBe(100);
  });

  it('extracts 60% volume for MPD sink-input 1957', () => {
    expect(extractVolumeForSinkInput(SINK_INPUTS_FIXTURE, '1957')).toBe(60);
  });

  it('extracts 80% volume for pw-play sink-input 200', () => {
    expect(extractVolumeForSinkInput(SINK_INPUTS_FIXTURE, '200')).toBe(80);
  });

  it('returns null when sink-input id not found', () => {
    expect(extractVolumeForSinkInput(SINK_INPUTS_FIXTURE, '9999')).toBeNull();
  });

  it('returns null for empty output', () => {
    expect(extractVolumeForSinkInput('', '42')).toBeNull();
    expect(extractVolumeForSinkInput(null, '42')).toBeNull();
  });
});
