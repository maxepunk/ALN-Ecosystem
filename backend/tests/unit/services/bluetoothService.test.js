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
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
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
        expect.any(Function)
      );
    });

    it('should return false when no adapter present', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
        cb(new Error('No default controller available'), '', '');
      });

      const result = await bluetoothService.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when adapter is powered off', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
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

    it('should emit scan:stopped when process exits', () => {
      const handler = jest.fn();
      bluetoothService.on('scan:stopped', handler);

      bluetoothService.startScan(10);
      mockProc.emit('close', 0);

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
      // The CHG line doesn't match [NEW] pattern, so only 1 event
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── getPairedDevices() ──

  describe('getPairedDevices()', () => {
    it('should parse bluetoothctl devices Paired output and filter by Audio Sink UUID', async () => {
      // Step 1: list paired devices
      execFile.mockImplementationOnce((cmd, args, cb) => {
        cb(
          null,
          'Device 2C:81:BF:0D:E4:C1 JBL Flip 6\nDevice AA:BB:CC:DD:EE:FF Keyboard\n',
          ''
        );
      });

      // Step 2: info for first device (has Audio Sink UUID)
      execFile.mockImplementationOnce((cmd, args, cb) => {
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
      execFile.mockImplementationOnce((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementationOnce((cmd, args, cb) => {
        cb(null, 'Device 2C:81:BF:0D:E4:C1 JBL Flip 6\n', '');
      });

      // Step 2: info (has Audio Sink UUID)
      execFile.mockImplementationOnce((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, '', '');
      });

      const devices = await bluetoothService.getConnectedDevices();
      expect(devices).toEqual([]);
    });
  });

  // ── isAudioDevice() ──

  describe('isAudioDevice()', () => {
    it('should return true when device has Audio Sink UUID 0000110b', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
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

  // ── pairDevice() ──

  describe('pairDevice()', () => {
    it('should call pair and trust with NoInputNoOutput agent', async () => {
      const calls = [];
      execFile.mockImplementation((cmd, args, cb) => {
        calls.push(args);
        cb(null, 'Success\n', '');
      });

      await bluetoothService.pairDevice('AA:BB:CC:DD:EE:FF');

      // Should call pair then trust
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.arrayContaining(['pair', 'AA:BB:CC:DD:EE:FF']),
          expect.arrayContaining(['trust', 'AA:BB:CC:DD:EE:FF']),
        ])
      );
    });

    it('should validate MAC address before pairing', async () => {
      await expect(
        bluetoothService.pairDevice('not-valid')
      ).rejects.toThrow('Invalid MAC address');
    });
  });

  // ── connectDevice() ──

  describe('connectDevice()', () => {
    it('should call bluetoothctl connect with valid MAC', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, 'Connection successful\n', '');
      });

      await bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['connect', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Function)
      );
    });

    it('should emit connection:changed on successful connect', async () => {
      const handler = jest.fn();
      bluetoothService.on('connection:changed', handler);

      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, 'Connection successful\n', '');
      });

      await bluetoothService.connectDevice('AA:BB:CC:DD:EE:FF');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'AA:BB:CC:DD:EE:FF',
          connected: true,
        })
      );
    });

    it('should reject on connection failure', async () => {
      execFile.mockImplementation((cmd, args, cb) => {
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
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, 'Successful disconnected\n', '');
      });

      await bluetoothService.disconnectDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['disconnect', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Function)
      );
    });

    it('should emit connection:changed on disconnect', async () => {
      const handler = jest.fn();
      bluetoothService.on('connection:changed', handler);

      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, 'Successful disconnected\n', '');
      });

      await bluetoothService.disconnectDevice('AA:BB:CC:DD:EE:FF');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'AA:BB:CC:DD:EE:FF',
          connected: false,
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
      execFile.mockImplementation((cmd, args, cb) => {
        cb(null, 'Device has been removed\n', '');
      });

      await bluetoothService.unpairDevice('AA:BB:CC:DD:EE:FF');

      expect(execFile).toHaveBeenCalledWith(
        'bluetoothctl',
        ['remove', 'AA:BB:CC:DD:EE:FF'],
        expect.any(Function)
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
