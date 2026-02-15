/**
 * Unit tests for Bluetooth Service
 * Tests bluetoothctl CLI integration with child_process mocking
 */

const EventEmitter = require('events');

// Mock child_process before requiring the service
jest.mock('child_process');
const { execFile, spawn } = require('child_process');

// Mock logger to prevent actual logging
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const bluetoothService = require('../../../src/services/bluetoothService');

describe('BluetoothService', () => {
  beforeEach(() => {
    bluetoothService.reset();
    jest.clearAllMocks();
  });

  // ── Parsing helpers (critical — exact output formats from Task 4) ──

  describe('device line parsing', () => {
    it('should parse device line: "Device AA:BB:CC:DD:EE:FF Speaker Name"', () => {
      const match = 'Device AA:BB:CC:DD:EE:FF My Speaker'.match(
        /^Device ([0-9A-Fa-f:]{17}) (.+)$/
      );
      expect(match[1]).toBe('AA:BB:CC:DD:EE:FF');
      expect(match[2]).toBe('My Speaker');
    });

    it('should parse device line with lowercase MAC', () => {
      const match = 'Device aa:bb:cc:dd:ee:ff My Speaker'.match(
        /^Device ([0-9A-Fa-f:]{17}) (.+)$/
      );
      expect(match[1]).toBe('aa:bb:cc:dd:ee:ff');
      expect(match[2]).toBe('My Speaker');
    });
  });

  describe('MAC address validation', () => {
    it('should reject invalid MAC addresses', async () => {
      await expect(bluetoothService.connectDevice('not-a-mac')).rejects.toThrow(
        'Invalid MAC address'
      );
      await expect(bluetoothService.connectDevice('AA:BB:CC:DD:EE')).rejects.toThrow(
        'Invalid MAC address'
      );
    });

    it('should reject MAC with wrong separators', async () => {
      await expect(
        bluetoothService.connectDevice('AA-BB-CC-DD-EE-FF')
      ).rejects.toThrow('Invalid MAC address');
    });

    it('should accept valid MAC addresses', async () => {
      // Mock execFile to succeed for a valid MAC
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Connecting...\nConnection successful\n', '');
      });

      await expect(
        bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF')
      ).resolves.not.toThrow();
    });
  });

  // ── isAvailable() ──

  describe('isAvailable()', () => {
    it('should return true when adapter is powered on', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Controller 2C:81:BF:0D:E4:C1 (public)',
            '\tName: raspberrypi',
            '\tPowered: yes',
            '\tDiscoverable: no',
          ].join('\n'),
          ''
        );
      });

      const result = await bluetoothService.isAvailable();
      expect(result).toBe(true);
      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['show'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return false when no adapter present', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('No default controller available'), '', '');
      });

      const result = await bluetoothService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when adapter is powered off', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Controller 2C:81:BF:0D:E4:C1 (public)',
            '\tName: raspberrypi',
            '\tPowered: no',
          ].join('\n'),
          ''
        );
      });

      const result = await bluetoothService.isAvailable();
      expect(result).toBe(false);
    });
  });

  // ── getAdapterStatus() ──

  describe('getAdapterStatus()', () => {
    it('should parse bluetoothctl show output', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Controller 2C:81:BF:0D:E4:C1 (public)',
            '\tName: raspberrypi',
            '\tAlias: raspberrypi',
            '\tPowered: yes',
            '\tDiscoverable: no',
            '\tDiscovering: no',
          ].join('\n'),
          ''
        );
      });

      const status = await bluetoothService.getAdapterStatus();
      expect(status).toEqual(
        expect.objectContaining({
          address: '2C:81:BF:0D:E4:C1',
          powered: true,
          discoverable: false,
          discovering: false,
        })
      );
    });

    it('should return null when no adapter', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('No default controller available'), '', '');
      });

      const status = await bluetoothService.getAdapterStatus();
      expect(status).toBeNull();
    });
  });

  // ── startScan() ──

  describe('startScan()', () => {
    let mockProc;

    beforeEach(() => {
      mockProc = new EventEmitter();
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.kill = jest.fn();
      mockProc.pid = 12345;
      spawn.mockReturnValue(mockProc);
    });

    it('should spawn bluetoothctl with --timeout and scan on', () => {
      bluetoothService.startScan(20);

      expect(spawn).toHaveBeenCalledWith('bluetoothctl', [
        '--timeout',
        '20',
        'scan',
        'on',
      ]);
    });

    it('should use config default timeout when not specified', () => {
      bluetoothService.startScan();

      expect(spawn).toHaveBeenCalledWith('bluetoothctl', [
        '--timeout',
        expect.any(String),
        'scan',
        'on',
      ]);
    });

    it('should emit scan:started event', () => {
      const handler = jest.fn();
      bluetoothService.on('scan:started', handler);

      bluetoothService.startScan(10);

      expect(handler).toHaveBeenCalled();
    });

    it('should no-op if already scanning (Decision D8)', () => {
      const result1 = bluetoothService.startScan(10);
      const result2 = bluetoothService.startScan(10);

      expect(result2).toEqual({ alreadyScanning: true });
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should parse stdout for device:discovered events', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      // Simulate bluetoothctl stdout output
      mockProc.stdout.emit(
        'data',
        Buffer.from('[NEW] Device 2C:81:BF:0D:E4:C1 JBL Flip 6\n')
      );

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '2C:81:BF:0D:E4:C1',
          name: 'JBL Flip 6',
        })
      );
    });

    it('should ignore non-device stdout lines', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      mockProc.stdout.emit(
        'data',
        Buffer.from('Discovery started\nSetDiscoveryFilter success\n')
      );

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit scan:stopped when process exits', async () => {
      const handler = jest.fn();
      bluetoothService.on('scan:stopped', handler);

      bluetoothService.startScan(10);
      mockProc.emit('close', 0);

      // scan:stopped is emitted after async post-scan resolution
      await new Promise(resolve => bluetoothService.once('scan:stopped', resolve));
      expect(handler).toHaveBeenCalled();
    });

    it('should deduplicate discovered devices within same scan', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      // Same device twice
      mockProc.stdout.emit(
        'data',
        Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n')
      );
      mockProc.stdout.emit(
        'data',
        Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF RSSI: -55\n')
      );
      // CHG RSSI line is filtered out (not a name), so only 1 event
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should parse device lines with ANSI escape codes from bluetoothctl', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      // Real bluetoothctl output includes ANSI color codes and readline markers
      const ansiLine = '[\x01\x1b[0;92m\x02NEW\x01\x1b[0m\x02] Device F4:4E:FD:53:5D:F2 W-KING X10\n';
      mockProc.stdout.emit('data', Buffer.from(ansiLine));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'F4:4E:FD:53:5D:F2',
          name: 'W-KING X10',
        })
      );
    });

    it('should discover cached devices from CHG lines with names', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      // Cached device appears as CHG with name (not NEW)
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF JBL Speaker\n'));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'AA:BB:CC:DD:EE:FF',
          name: 'JBL Speaker',
        })
      );
    });

    it('should filter out RSSI-only and ManufacturerData CHG lines', () => {
      const handler = jest.fn();
      bluetoothService.on('device:discovered', handler);

      bluetoothService.startScan(10);

      mockProc.stdout.emit('data', Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF RSSI: -57\n'));
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF ManufacturerData Key: 0x0075\n'));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should resolve cached devices via bluetoothctl info after scan ends', async () => {
      const discoveredHandler = jest.fn();
      const stoppedHandler = jest.fn();
      bluetoothService.on('device:discovered', discoveredHandler);
      bluetoothService.on('scan:stopped', stoppedHandler);

      // Mock bluetoothctl info response for the cached device
      execFile.mockImplementation((cmd, args, opts, cb) => {
        if (args[0] === 'info' && args[1] === 'F4:4E:FD:53:5D:F2') {
          cb(null, [
            'Device F4:4E:FD:53:5D:F2 (public)',
            '\tName: W-KING X10',
            '\tAlias: W-KING X10',
            '\tPaired: no',
            '\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)',
            '\tConnected: no',
          ].join('\n'), '');
        } else {
          cb(new Error('Unknown command'), '', '');
        }
      });

      bluetoothService.startScan(10);

      // Device appears only as RSSI updates during scan (cached by BlueZ)
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device F4:4E:FD:53:5D:F2 RSSI: -56\n'));
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device F4:4E:FD:53:5D:F2 RSSI: -58\n'));

      // No discovery during scan (RSSI lines filtered)
      expect(discoveredHandler).not.toHaveBeenCalled();

      // Scan ends — triggers post-scan resolution
      mockProc.emit('close', 0);

      // Wait for async resolution to complete
      await new Promise(resolve => bluetoothService.once('scan:stopped', resolve));

      expect(discoveredHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'F4:4E:FD:53:5D:F2',
          name: 'W-KING X10',
        })
      );
      expect(stoppedHandler).toHaveBeenCalled();
    });

    it('should not re-resolve devices already discovered during scan', async () => {
      const discoveredHandler = jest.fn();
      bluetoothService.on('device:discovered', discoveredHandler);

      bluetoothService.startScan(10);

      // Device appears with name first, then RSSI updates
      mockProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF JBL Speaker\n'));
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF RSSI: -50\n'));

      expect(discoveredHandler).toHaveBeenCalledTimes(1);

      mockProc.emit('close', 0);
      await new Promise(resolve => bluetoothService.once('scan:stopped', resolve));

      // Should still be only 1 discovery (no duplicate from resolution)
      expect(discoveredHandler).toHaveBeenCalledTimes(1);
      // execFile should NOT have been called for info resolution
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should emit scan:stopped even if resolution fails', async () => {
      const stoppedHandler = jest.fn();
      bluetoothService.on('scan:stopped', stoppedHandler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('bluetoothctl not found'), '', '');
      });

      bluetoothService.startScan(10);

      // RSSI-only device
      mockProc.stdout.emit('data', Buffer.from('[CHG] Device AA:BB:CC:DD:EE:FF RSSI: -70\n'));

      mockProc.emit('close', 0);
      await new Promise(resolve => bluetoothService.once('scan:stopped', resolve));

      // scan:stopped still emitted despite resolution error
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  // ── stopScan() ──

  describe('stopScan()', () => {
    it('should kill active scan process', () => {
      const mockProc = new EventEmitter();
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.kill = jest.fn();
      mockProc.pid = 12345;
      spawn.mockReturnValue(mockProc);

      bluetoothService.startScan(10);
      bluetoothService.stopScan();

      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should be safe to call when no scan is active', () => {
      expect(() => bluetoothService.stopScan()).not.toThrow();
    });
  });

  // ── getPairedDevices() ──

  describe('getPairedDevices()', () => {
    it('should parse bluetoothctl devices Paired output and filter by Audio Sink UUID', async () => {
      // Step 1: list paired devices
      execFile.mockImplementationOnce((cmd, args, opts, cb) => {
        cb(
          null,
          'Device 2C:81:BF:0D:E4:C1 JBL Flip 6\nDevice AA:BB:CC:DD:EE:FF Keyboard\n',
          ''
        );
      });

      // Step 2: info for first device (has Audio Sink UUID)
      execFile.mockImplementationOnce((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Device 2C:81:BF:0D:E4:C1 (public)',
            '\tName: JBL Flip 6',
            '\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)',
            '\tUUID: A/V Remote Control         (0000110e-0000-1000-8000-00805f9b34fb)',
            '\tConnected: yes',
          ].join('\n'),
          ''
        );
      });

      // Step 3: info for second device (no Audio Sink UUID)
      execFile.mockImplementationOnce((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Device AA:BB:CC:DD:EE:FF (public)',
            '\tName: Keyboard',
            '\tUUID: Human Interface Device    (00001124-0000-1000-8000-00805f9b34fb)',
            '\tConnected: yes',
          ].join('\n'),
          ''
        );
      });

      const devices = await bluetoothService.getPairedDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(
        expect.objectContaining({
          address: '2C:81:BF:0D:E4:C1',
          name: 'JBL Flip 6',
          connected: true,
        })
      );
    });

    it('should return empty array when no paired devices', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, '', '');
      });

      const devices = await bluetoothService.getPairedDevices();
      expect(devices).toEqual([]);
    });
  });

  // ── getConnectedDevices() ──

  describe('getConnectedDevices()', () => {
    it('should parse bluetoothctl devices Connected and filter by Audio Sink UUID', async () => {
      // Step 1: list connected devices
      execFile.mockImplementationOnce((cmd, args, opts, cb) => {
        cb(null, 'Device 2C:81:BF:0D:E4:C1 JBL Flip 6\n', '');
      });

      // Step 2: info (has Audio Sink UUID)
      execFile.mockImplementationOnce((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Device 2C:81:BF:0D:E4:C1 (public)',
            '\tName: JBL Flip 6',
            '\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)',
            '\tConnected: yes',
          ].join('\n'),
          ''
        );
      });

      const devices = await bluetoothService.getConnectedDevices();

      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(
        expect.objectContaining({
          address: '2C:81:BF:0D:E4:C1',
          name: 'JBL Flip 6',
          connected: true,
        })
      );
    });

    it('should return empty array when no connected devices', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, '', '');
      });

      const devices = await bluetoothService.getConnectedDevices();
      expect(devices).toEqual([]);
    });
  });

  // ── isAudioDevice() ──

  describe('isAudioDevice()', () => {
    it('should return true when device has Audio Sink UUID 0000110b', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Device 2C:81:BF:0D:E4:C1 (public)',
            '\tUUID: Audio Sink                (0000110b-0000-1000-8000-00805f9b34fb)',
          ].join('\n'),
          ''
        );
      });

      const result = await bluetoothService.isAudioDevice('2C:81:BF:0D:E4:C1');
      expect(result).toBe(true);
    });

    it('should return false when device lacks Audio Sink UUID', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(
          null,
          [
            'Device AA:BB:CC:DD:EE:FF (public)',
            '\tUUID: Human Interface Device    (00001124-0000-1000-8000-00805f9b34fb)',
          ].join('\n'),
          ''
        );
      });

      const result = await bluetoothService.isAudioDevice('AA:BB:CC:DD:EE:FF');
      expect(result).toBe(false);
    });

    it('should validate MAC address before checking', async () => {
      await expect(
        bluetoothService.isAudioDevice('invalid')
      ).rejects.toThrow('Invalid MAC address');
    });
  });

  // ── pairDevice() — interactive session (scan + pair + trust in one process) ──

  describe('pairDevice()', () => {
    let mockPairProc;

    beforeEach(() => {
      mockPairProc = new EventEmitter();
      mockPairProc.stdout = new EventEmitter();
      mockPairProc.stderr = new EventEmitter();
      mockPairProc.stdin = { write: jest.fn() };
      mockPairProc.kill = jest.fn();
      mockPairProc.pid = 54321;
      spawn.mockReturnValue(mockPairProc);
    });

    it('should spawn interactive bluetoothctl and run scan → pair → trust', async () => {
      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      expect(spawn).toHaveBeenCalledWith('bluetoothctl', ['--agent', 'NoInputNoOutput']);
      expect(mockPairProc.stdin.write).toHaveBeenCalledWith('scan on\n');

      // Simulate: scan starts → device discovered → pair success → trust success
      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n'));

      expect(mockPairProc.stdin.write).toHaveBeenCalledWith('pair AA:BB:CC:DD:EE:FF\n');

      mockPairProc.stdout.emit('data', Buffer.from('Pairing successful\n'));

      expect(mockPairProc.stdin.write).toHaveBeenCalledWith('trust AA:BB:CC:DD:EE:FF\n');

      mockPairProc.stdout.emit('data', Buffer.from('Changing AA:BB:CC:DD:EE:FF trust succeeded\n'));

      await pairPromise;
    });

    it('should emit device:paired on successful pair', async () => {
      const handler = jest.fn();
      bluetoothService.on('device:paired', handler);

      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n'));
      mockPairProc.stdout.emit('data', Buffer.from('Pairing successful\n'));
      mockPairProc.stdout.emit('data', Buffer.from('trust succeeded\n'));

      await pairPromise;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ address: 'AA:BB:CC:DD:EE:FF' })
      );
    });

    it('should validate MAC address before pairing', async () => {
      await expect(
        bluetoothService.pairDevice('not-valid')
      ).rejects.toThrow('Invalid MAC address');
    });

    it('should reject when pair fails with error', async () => {
      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n'));
      mockPairProc.stdout.emit('data', Buffer.from(
        'Failed to pair: org.bluez.Error.AuthenticationFailed\n'
      ));

      await expect(pairPromise).rejects.toThrow(/Failed to pair/);
    });

    it('should handle already-paired devices (AlreadyExists)', async () => {
      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n'));
      mockPairProc.stdout.emit('data', Buffer.from('org.bluez.Error.AlreadyExists\n'));

      expect(mockPairProc.stdin.write).toHaveBeenCalledWith('trust AA:BB:CC:DD:EE:FF\n');

      mockPairProc.stdout.emit('data', Buffer.from('trust succeeded\n'));

      await pairPromise;
    });

    it('should stop active scan before pairing', async () => {
      // Start a scan first
      const scanProc = new EventEmitter();
      scanProc.stdout = new EventEmitter();
      scanProc.stderr = new EventEmitter();
      scanProc.kill = jest.fn();
      scanProc.pid = 99999;
      spawn.mockReturnValueOnce(scanProc);

      bluetoothService.startScan(10);

      // Now pair — should stop the scan first
      spawn.mockReturnValue(mockPairProc);
      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      expect(scanProc.kill).toHaveBeenCalled();

      // Complete the pair
      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.stdout.emit('data', Buffer.from('[NEW] Device AA:BB:CC:DD:EE:FF Speaker\n'));
      mockPairProc.stdout.emit('data', Buffer.from('Pairing successful\n'));
      mockPairProc.stdout.emit('data', Buffer.from('trust succeeded\n'));

      await pairPromise;
    });

    it('should reject when process exits before pair completes', async () => {
      const pairPromise = bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      mockPairProc.stdout.emit('data', Buffer.from('Discovery started\n'));
      mockPairProc.emit('close', 1);

      await expect(pairPromise).rejects.toThrow(/bluetoothctl exited/);
    });
  });

  // ── connectDevice() ──

  describe('connectDevice()', () => {
    it('should call bluetoothctl connect with valid MAC', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Connection successful\n', '');
      });

      await bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['connect', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit device:connected on successful connect', async () => {
      const handler = jest.fn();
      bluetoothService.on('device:connected', handler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Connection successful\n', '');
      });

      await bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'AA:BB:CC:DD:EE:FF',
        })
      );
    });

    it('should reject on connection failure', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Connection failed'), '', 'Failed to connect');
      });

      await expect(
        bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF')
      ).rejects.toThrow();
    });
  });

  // ── disconnectDevice() ──

  describe('disconnectDevice()', () => {
    it('should call bluetoothctl disconnect', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Successful disconnected\n', '');
      });

      await bluetoothService.disconnectDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['disconnect', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit device:disconnected on disconnect', async () => {
      const handler = jest.fn();
      bluetoothService.on('device:disconnected', handler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Successful disconnected\n', '');
      });

      await bluetoothService.disconnectDevice('AA:BB:CC:DD:EE:FF');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'AA:BB:CC:DD:EE:FF',
        })
      );
    });

    it('should validate MAC address before disconnecting', async () => {
      await expect(
        bluetoothService.disconnectDevice('bad-mac')
      ).rejects.toThrow('Invalid MAC address');
    });
  });

  // ── unpairDevice() ──

  describe('unpairDevice()', () => {
    it('should call bluetoothctl remove', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Device has been removed\n', '');
      });

      await bluetoothService.unpairDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['remove', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should emit device:unpaired on successful remove', async () => {
      const handler = jest.fn();
      bluetoothService.on('device:unpaired', handler);

      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Device has been removed\n', '');
      });

      await bluetoothService.unpairDevice('AA:BB:CC:DD:EE:FF');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ address: 'AA:BB:CC:DD:EE:FF' })
      );
    });

    it('should validate MAC address before removing', async () => {
      await expect(
        bluetoothService.unpairDevice('invalid')
      ).rejects.toThrow('Invalid MAC address');
    });
  });

  // ── cleanup() ──

  describe('cleanup()', () => {
    it('should kill active scan process', () => {
      const mockProc = new EventEmitter();
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.kill = jest.fn();
      mockProc.pid = 99999;
      spawn.mockReturnValue(mockProc);

      bluetoothService.startScan(10);
      bluetoothService.cleanup();

      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should be safe to call when no scan is active', () => {
      expect(() => bluetoothService.cleanup()).not.toThrow();
    });
  });

  // ── reset() ──

  describe('reset()', () => {
    it('should kill processes, remove listeners, and reset state', () => {
      const mockProc = new EventEmitter();
      mockProc.stdout = new EventEmitter();
      mockProc.stderr = new EventEmitter();
      mockProc.kill = jest.fn();
      mockProc.pid = 11111;
      spawn.mockReturnValue(mockProc);

      // Start a scan and add a listener
      bluetoothService.startScan(10);
      bluetoothService.on('device:discovered', jest.fn());

      bluetoothService.reset();

      // Scan process should be killed
      expect(mockProc.kill).toHaveBeenCalled();

      // Listeners should be removed
      expect(bluetoothService.listenerCount('device:discovered')).toBe(0);

      // Should be able to start a new scan (not blocked by alreadyScanning)
      const newMockProc = new EventEmitter();
      newMockProc.stdout = new EventEmitter();
      newMockProc.stderr = new EventEmitter();
      newMockProc.kill = jest.fn();
      newMockProc.pid = 22222;
      spawn.mockReturnValue(newMockProc);

      const result = bluetoothService.startScan(10);
      expect(result).not.toEqual({ alreadyScanning: true });
    });
  });
});
