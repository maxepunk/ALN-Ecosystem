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
});
