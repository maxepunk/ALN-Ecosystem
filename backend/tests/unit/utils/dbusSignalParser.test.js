/**
 * Unit tests for DbusSignalParser utility
 * Parses dbus-monitor --monitor multi-line output into structured signal objects.
 *
 * TDD: Written before implementation
 */

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const DbusSignalParser = require('../../../src/utils/dbusSignalParser');

describe('DbusSignalParser', () => {
  let parser;

  beforeEach(() => {
    parser = new DbusSignalParser();
  });

  describe('message boundary detection', () => {
    it('should detect signal message boundary and emit on next boundary', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      // First signal
      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/bluez/hci0/dev_AA_BB_CC_DD_EE_FF; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged');
      parser.feedLine('   string "org.bluez.Device1"');

      // Second signal boundary triggers emit of first
      parser.feedLine('signal time=1234567891.000 sender=:1.5 -> destination=(null destination) serial=43 path=/other; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged');

      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('signal');
    });

    it('should accumulate body lines between boundaries', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/test; interface=org.test.Iface; member=TestMember');
      parser.feedLine('   string "first arg"');
      parser.feedLine('   string "second arg"');

      // Trigger emit
      parser.flush();

      expect(signals).toHaveLength(1);
      expect(signals[0].raw).toContain('first arg');
      expect(signals[0].raw).toContain('second arg');
    });
  });

  describe('header parsing', () => {
    it('should parse path, interface, and member from header line', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/bluez/hci0/dev_AA_BB_CC; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged');
      parser.flush();

      expect(signals[0].path).toBe('/org/bluez/hci0/dev_AA_BB_CC');
      expect(signals[0].interface).toBe('org.freedesktop.DBus.Properties');
      expect(signals[0].member).toBe('PropertiesChanged');
    });

    it('should parse sender from header line', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.42 -> destination=(null destination) serial=10 path=/test; interface=org.test; member=Foo');
      parser.flush();

      expect(signals[0].sender).toBe(':1.42');
    });
  });

  describe('flush()', () => {
    it('should emit pending accumulated message', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/test; interface=org.test; member=Test');
      parser.feedLine('   string "value"');

      expect(signals).toHaveLength(0);
      parser.flush();
      expect(signals).toHaveLength(1);
    });

    it('should be safe to call when no pending message', () => {
      parser.flush(); // Should not throw
    });

    it('should be safe to call multiple times', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/test; interface=org.test; member=Foo');
      parser.flush();
      parser.flush();

      expect(signals).toHaveLength(1);
    });
  });

  describe('non-signal message filtering', () => {
    it('should ignore method call messages', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('method call time=1234567890.123 sender=:1.5 -> destination=org.bluez serial=42 path=/org/bluez; interface=org.bluez.Adapter1; member=StartDiscovery');
      parser.flush();

      expect(signals).toHaveLength(0);
    });

    it('should ignore method return messages', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('method return time=1234567890.123 sender=:1.5 -> destination=:1.10 serial=42 reply_serial=41');
      parser.flush();

      expect(signals).toHaveLength(0);
    });

    it('should ignore error messages', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('error time=1234567890.123 sender=:1.5 -> destination=:1.10 serial=42 reply_serial=41 error_name=org.bluez.Error.Failed');
      parser.flush();

      expect(signals).toHaveLength(0);
    });
  });

  describe('PropertiesChanged parsing', () => {
    function feedPropertiesChanged(parser, changedInterface, propsBody) {
      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/test/device; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged');
      parser.feedLine(`   string "${changedInterface}"`);
      parser.feedLine('   array [');
      for (const line of propsBody) {
        parser.feedLine(line);
      }
      parser.feedLine('   ]');
      parser.feedLine('   array [');
      parser.feedLine('   ]');
    }

    it('should extract changedInterface from first string arg', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.bluez.Device1', [
        '      dict entry(',
        '         string "Connected"',
        '         variant             boolean true',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].changedInterface).toBe('org.bluez.Device1');
    });

    it('should parse boolean true property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.bluez.Device1', [
        '      dict entry(',
        '         string "Connected"',
        '         variant             boolean true',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Connected: true });
    });

    it('should parse boolean false property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.bluez.Device1', [
        '      dict entry(',
        '         string "Connected"',
        '         variant             boolean false',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Connected: false });
    });

    it('should parse string property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.mpris.MediaPlayer2.Player', [
        '      dict entry(',
        '         string "PlaybackStatus"',
        '         variant             string "Playing"',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ PlaybackStatus: 'Playing' });
    });

    it('should parse double property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.mpris.MediaPlayer2.Player', [
        '      dict entry(',
        '         string "Volume"',
        '         variant             double 0.75',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Volume: 0.75 });
    });

    it('should parse int32 property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.test.Iface', [
        '      dict entry(',
        '         string "Position"',
        '         variant             int32 42',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Position: 42 });
    });

    it('should parse uint32 property', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.test.Iface', [
        '      dict entry(',
        '         string "Count"',
        '         variant             uint32 100',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Count: 100 });
    });

    it('should parse multiple properties in one signal', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      feedPropertiesChanged(parser, 'org.bluez.Device1', [
        '      dict entry(',
        '         string "Connected"',
        '         variant             boolean true',
        '      )',
        '      dict entry(',
        '         string "Paired"',
        '         variant             boolean true',
        '      )',
      ]);
      parser.flush();

      expect(signals[0].properties).toEqual({ Connected: true, Paired: true });
    });

    it('should provide raw text for complex nested values', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/mpris/MediaPlayer2; interface=org.freedesktop.DBus.Properties; member=PropertiesChanged');
      parser.feedLine('   string "org.mpris.MediaPlayer2.Player"');
      parser.feedLine('   array [');
      parser.feedLine('      dict entry(');
      parser.feedLine('         string "Metadata"');
      parser.feedLine('         variant             array [');
      parser.feedLine('            dict entry(');
      parser.feedLine('               string "xesam:title"');
      parser.feedLine('               variant                   string "Test Song"');
      parser.feedLine('            )');
      parser.feedLine('         ]');
      parser.feedLine('      )');
      parser.feedLine('   ]');
      parser.feedLine('   array [');
      parser.feedLine('   ]');
      parser.flush();

      expect(signals[0].raw).toContain('xesam:title');
      expect(signals[0].raw).toContain('Test Song');
    });
  });

  describe('edge cases', () => {
    it('should handle empty body signal', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/test; interface=org.test; member=Empty');
      parser.flush();

      expect(signals).toHaveLength(1);
      expect(signals[0].member).toBe('Empty');
    });

    it('should not crash on malformed input', () => {
      const logger = require('../../../src/utils/logger');
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      // Random garbage
      parser.feedLine('totally random garbage line');
      parser.feedLine('another bad line');
      parser.flush();

      expect(signals).toHaveLength(0);
    });

    it('should handle signal without standard fields gracefully', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      // Minimal signal header — no path/interface but starts with 'signal '
      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42');
      parser.flush();

      // Should still emit (with null fields) or skip gracefully
      // Implementation choice: skip if no path/interface/member
    });

    it('should handle multiple complete signals in sequence', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      // Signal 1
      parser.feedLine('signal time=1234567890.123 sender=:1.5 -> destination=(null destination) serial=42 path=/org/test1; interface=org.test; member=First');
      parser.feedLine('   string "data1"');

      // Signal 2 (triggers emit of 1)
      parser.feedLine('signal time=1234567891.123 sender=:1.5 -> destination=(null destination) serial=43 path=/org/test2; interface=org.test; member=Second');
      parser.feedLine('   string "data2"');

      // Signal 3 (triggers emit of 2)
      parser.feedLine('signal time=1234567892.123 sender=:1.5 -> destination=(null destination) serial=44 path=/org/test3; interface=org.test; member=Third');

      // Flush to get signal 3
      parser.flush();

      expect(signals).toHaveLength(3);
      expect(signals[0].member).toBe('First');
      expect(signals[1].member).toBe('Second');
      expect(signals[2].member).toBe('Third');
    });
  });
  // ─────────────────────────────────────────────────────────────────────────
  // W10 F-C2: a message must complete without waiting for the NEXT message.
  //
  // dbus-monitor writes each message as a multi-line block with no terminator.
  // Boundary-only completion meant the LAST message in a burst sat unparsed
  // until the next signal arrived — at the venue on 2026-09-15 the
  // "PlaybackStatus=Playing" block reached the bus at +0.231 s but was not
  // parsed in-process until +28.274 s, when the end-of-video "Stopped" header
  // arrived. That is the ~28-30 s waitForVlcLoaded timeout.
  // ─────────────────────────────────────────────────────────────────────────
  describe('structural completion (PropertiesChanged)', () => {
    const {
      NAME_ACQUIRED,
      LOOP_STATUS,
      CAN_PLAY,
      METADATA_PLAYING,
    } = require('../../helpers/dbus-monitor-samples');

    it('should emit a real Metadata+PlaybackStatus block with nothing following it', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of METADATA_PLAYING) parser.feedLine(line);

      // No following header, no flush() — the block is structurally complete.
      expect(signals).toHaveLength(1);
      expect(signals[0].changedInterface).toBe('org.mpris.MediaPlayer2.Player');
      expect(signals[0].properties.PlaybackStatus).toBe('Playing');
      expect(signals[0].sender).toBe(':1.2607');
    });

    it('should emit on the final top-level line, not one line early', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of METADATA_PLAYING.slice(0, -1)) parser.feedLine(line);
      expect(signals).toHaveLength(0);

      parser.feedLine(METADATA_PLAYING[METADATA_PLAYING.length - 1]);
      expect(signals).toHaveLength(1);
    });

    it('should emit a small real block (LoopStatus) with nothing following it', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of LOOP_STATUS) parser.feedLine(line);

      expect(signals).toHaveLength(1);
      expect(signals[0].properties).toEqual({ LoopStatus: 'None' });
    });

    it('should keep the raw body intact when completing structurally', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of METADATA_PLAYING) parser.feedLine(line);

      expect(signals[0].raw).toContain('xesam:url');
      expect(signals[0].raw).toContain('kai001.mp4');
      expect(signals[0].raw).toContain('mpris:length');
    });

    it('should emit two back-to-back blocks in order with no duplicates', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of LOOP_STATUS) parser.feedLine(line);
      expect(signals).toHaveLength(1);

      for (const line of CAN_PLAY) parser.feedLine(line);
      expect(signals).toHaveLength(2);

      // The arrival of the next header must NOT re-emit an already-emitted block
      for (const line of METADATA_PLAYING) parser.feedLine(line);
      expect(signals).toHaveLength(3);

      parser.flush();
      expect(signals).toHaveLength(3);
      expect(signals[0].properties.LoopStatus).toBe('None');
      expect(signals[1].properties.CanPlay).toBe(true);
      expect(signals[2].properties.PlaybackStatus).toBe('Playing');
    });

    // MED: dbus-monitor does not escape embedded quotes. A value that re-pairs
    // the quote match must not leak its closers into the nesting count.
    it('should not complete early on a string value containing quotes and closers', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      // Real Metadata block with one extra entry whose title is adversarial
      const titleEntry = [
        '                dict entry(',
        '                   string "xesam:title"',
        '                   variant                      string "Take 5" ]]) mix"',
        '                )',
      ];
      const insertAt = METADATA_PLAYING.findIndex((l) => l.includes('"xesam:url"')) - 1;
      const lines = [
        ...METADATA_PLAYING.slice(0, insertAt),
        ...titleEntry,
        ...METADATA_PLAYING.slice(insertAt),
      ];

      for (const line of lines) parser.feedLine(line);

      expect(signals).toHaveLength(1);
      expect(signals[0].properties.PlaybackStatus).toBe('Playing');
      expect(signals[0].raw).toContain('Take 5');
    });

    it('should not complete early on a file path containing brackets', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      const lines = METADATA_PLAYING.map((l) =>
        l.replace('kai001.mp4', 'kai001 [take ]2)].mp4'));

      for (const line of lines) parser.feedLine(line);

      expect(signals).toHaveLength(1);
      expect(signals[0].properties.PlaybackStatus).toBe('Playing');
    });

    it('should not structurally complete a non-PropertiesChanged signal', () => {
      const signals = [];
      parser.on('signal', (s) => signals.push(s));

      for (const line of NAME_ACQUIRED) parser.feedLine(line);

      expect(signals).toHaveLength(0);
      parser.flush();
      expect(signals).toHaveLength(1);
      expect(signals[0].member).toBe('NameAcquired');
    });
  });

  describe('idle flush fallback', () => {
    const {
      NAME_ACQUIRED,
      METADATA_PLAYING,
    } = require('../../helpers/dbus-monitor-samples');

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should flush a non-PropertiesChanged signal after the idle interval', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of NAME_ACQUIRED) p.feedLine(line);
      expect(signals).toHaveLength(0);

      jest.advanceTimersByTime(99);
      expect(signals).toHaveLength(0);

      jest.advanceTimersByTime(1);
      expect(signals).toHaveLength(1);
      expect(signals[0].member).toBe('NameAcquired');
    });

    // HIGH-1: idle-flushing a partial PropertiesChanged block would emit it
    // without PlaybackStatus AND strand the remaining lines, which feedLine
    // drops once the header has been consumed. Worse than the original bug.
    it('should never idle-flush an incomplete PropertiesChanged block', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      const half = METADATA_PLAYING.slice(0, Math.floor(METADATA_PLAYING.length / 2));
      for (const line of half) p.feedLine(line);

      jest.advanceTimersByTime(10000);
      expect(signals).toHaveLength(0);

      // Still delivered at the next message boundary (pre-existing behaviour)
      p.feedLine(NAME_ACQUIRED[0]);
      expect(signals).toHaveLength(1);
      expect(signals[0].member).toBe('PropertiesChanged');
    });

    // HIGH-1: a pipe-chunk split mid-block must not cost us the tail
    it('should emit one complete signal when a block is split by an idle gap', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of METADATA_PLAYING.slice(0, 20)) p.feedLine(line);

      jest.advanceTimersByTime(5000);
      expect(signals).toHaveLength(0);

      for (const line of METADATA_PLAYING.slice(20)) p.feedLine(line);

      expect(signals).toHaveLength(1);
      expect(signals[0].properties.PlaybackStatus).toBe('Playing');
      expect(signals[0].raw).toContain('kai001.mp4');
    });

    it('should re-arm the idle timer on each new line', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      p.feedLine(NAME_ACQUIRED[0]);
      jest.advanceTimersByTime(80);
      p.feedLine(NAME_ACQUIRED[1]);
      jest.advanceTimersByTime(80);
      expect(signals).toHaveLength(0);

      jest.advanceTimersByTime(20);
      expect(signals).toHaveLength(1);
    });

    it('should not fire the idle timer after a structural emit', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of METADATA_PLAYING) p.feedLine(line);
      expect(signals).toHaveLength(1);

      jest.advanceTimersByTime(1000);
      expect(signals).toHaveLength(1);
    });

    it('dispose() should cancel a pending idle flush', () => {
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of NAME_ACQUIRED) p.feedLine(line);
      p.dispose();

      jest.advanceTimersByTime(1000);
      expect(signals).toHaveLength(0);
    });

    it('should default the idle interval to 500ms', () => {
      const p = new DbusSignalParser();
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of NAME_ACQUIRED) p.feedLine(line);
      jest.advanceTimersByTime(499);
      expect(signals).toHaveLength(0);

      jest.advanceTimersByTime(1);
      expect(signals).toHaveLength(1);
    });

    it('should never arm the idle timer when idleFlushMs is 0 (flush() still works)', () => {
      const p = new DbusSignalParser({ idleFlushMs: 0 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      for (const line of NAME_ACQUIRED) p.feedLine(line);
      jest.advanceTimersByTime(10000);
      expect(signals).toHaveLength(0);

      p.flush();
      expect(signals).toHaveLength(1);
    });

    it('should ignore whitespace-only body lines when counting PropertiesChanged arguments', () => {
      const { LOOP_STATUS } = require('../../helpers/dbus-monitor-samples');
      const p = new DbusSignalParser({ idleFlushMs: 100 });
      const signals = [];
      p.on('signal', (s) => signals.push(s));

      // A blank line between arguments must not count as an argument, so the
      // block still completes exactly on its real final line — not one early.
      const [header, ...body] = LOOP_STATUS;
      p.feedLine(header);
      p.feedLine(body[0]);
      p.feedLine('   ');
      for (const line of body.slice(1, -1)) p.feedLine(line);
      expect(signals).toHaveLength(0);
      p.feedLine(body[body.length - 1]);
      expect(signals).toHaveLength(1);
      expect(signals[0].properties.LoopStatus).toBeDefined();
    });
  });
});
