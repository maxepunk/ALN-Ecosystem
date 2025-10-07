/**
 * NFCHandler Module Unit Tests
 * Tests NFC scanning functionality
 *
 * Phase 5 - STEP 11 (FINAL)
 * Tests: NFC support detection, scan start/stop, token ID extraction, error handling, simulation
 */

describe('NFCHandler Module', () => {
  let NFCHandler;
  let mockNDEFReader;
  let mockDebug;

  beforeEach(() => {
    // Reset module cache
    jest.resetModules();

    // Mock Debug module BEFORE requiring NFCHandler
    mockDebug = {
      log: jest.fn()
    };
    global.Debug = mockDebug;

    // Mock NDEFReader class
    mockNDEFReader = {
      scan: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Mock window.NDEFReader
    global.NDEFReader = jest.fn(() => mockNDEFReader);
    global.window = {
      NDEFReader: global.NDEFReader
    };

    // Mock TextDecoder
    global.TextDecoder = jest.fn().mockImplementation((encoding) => ({
      decode: jest.fn((data) => {
        // Simple mock: return string representation of data
        if (data instanceof Uint8Array) {
          return String.fromCharCode.apply(null, data);
        }
        return String(data || '');
      })
    }));

    // Import NFCHandler AFTER all mocks are set up
    NFCHandler = require('../../../../ALNScanner/js/utils/nfcHandler');

    // Reset NFCHandler state
    NFCHandler.reader = null;
    NFCHandler.isScanning = false;
  });

  afterEach(() => {
    delete global.window;
    delete global.Debug;
    delete global.TextDecoder;
    delete global.NDEFReader;
  });

  describe('init() - NFC Support Detection', () => {
    it('should return true when NDEFReader is supported', async () => {
      global.window.NDEFReader = jest.fn();

      const supported = await NFCHandler.init();

      // BEHAVIORAL: Verify support detection
      expect(supported).toBe(true);
    });

    it('should return false when NDEFReader is not supported', async () => {
      delete global.window.NDEFReader;

      const supported = await NFCHandler.init();

      // BEHAVIORAL: Verify no support detection
      expect(supported).toBe(false);
    });
  });

  describe('startScan() - Start NFC Scanning', () => {
    it('should throw error when NFC not supported', async () => {
      delete global.window.NDEFReader;

      // BEHAVIORAL: Verify error thrown
      await expect(NFCHandler.startScan(jest.fn(), jest.fn()))
        .rejects.toThrow('NFC not supported');
    });

    it('should create NDEFReader and start scanning', async () => {
      const onRead = jest.fn();
      const onError = jest.fn();

      await NFCHandler.startScan(onRead, onError);

      // BEHAVIORAL: Verify NDEFReader created and scan started
      expect(global.window.NDEFReader).toHaveBeenCalled();
      expect(mockNDEFReader.scan).toHaveBeenCalled();
      expect(NFCHandler.isScanning).toBe(true);
      expect(NFCHandler.reader).toBe(mockNDEFReader);
    });

    it('should register reading event listener', async () => {
      const onRead = jest.fn();

      await NFCHandler.startScan(onRead, jest.fn());

      // BEHAVIORAL: Verify "reading" event listener registered
      expect(mockNDEFReader.addEventListener).toHaveBeenCalledWith(
        'reading',
        expect.any(Function)
      );
    });

    it('should register readingerror event listener', async () => {
      const onError = jest.fn();

      await NFCHandler.startScan(jest.fn(), onError);

      // BEHAVIORAL: Verify "readingerror" event listener registered
      expect(mockNDEFReader.addEventListener).toHaveBeenCalledWith(
        'readingerror',
        expect.any(Function)
      );
    });

    it('should call onRead callback when reading event fires', async () => {
      const onRead = jest.fn();

      await NFCHandler.startScan(onRead, jest.fn());

      // Get the registered "reading" event handler
      const readingHandler = mockNDEFReader.addEventListener.mock.calls
        .find(call => call[0] === 'reading')[1];

      // Simulate reading event with mock message
      const mockEvent = {
        message: { records: [] },
        serialNumber: 'ABC123'
      };
      readingHandler(mockEvent);

      // BEHAVIORAL: Verify onRead called with extracted token data
      expect(onRead).toHaveBeenCalledWith({
        id: 'ABC123',
        source: 'serial-fallback',
        raw: 'ABC123'
      });
    });

    it('should call onError callback when readingerror event fires', async () => {
      const onError = jest.fn();

      await NFCHandler.startScan(jest.fn(), onError);

      // Get the registered "readingerror" event handler
      const errorHandler = mockNDEFReader.addEventListener.mock.calls
        .find(call => call[0] === 'readingerror')[1];

      // Simulate error event
      const mockError = new Error('NFC read failed');
      errorHandler(mockError);

      // BEHAVIORAL: Verify onError called and Debug.log called
      expect(onError).toHaveBeenCalledWith(mockError);
      expect(mockDebug.log).toHaveBeenCalledWith(
        expect.stringContaining('NFC Read Error'),
        true
      );
    });
  });

  describe('extractTokenId() - Token ID Extraction', () => {
    it('should use serial number fallback when no records', () => {
      const message = { records: [] };
      const serialNumber = 'SERIAL123';

      const result = NFCHandler.extractTokenId(message, serialNumber);

      // BEHAVIORAL: Verify serial fallback
      expect(result).toEqual({
        id: 'SERIAL123',
        source: 'serial-fallback',
        raw: 'SERIAL123'
      });

      // BEHAVIORAL: Verify Debug.log called
      expect(mockDebug.log).toHaveBeenCalledWith('No NDEF records, using serial');
    });

    it('should extract ID from text record', () => {
      const mockTextData = new Uint8Array([116, 111, 107, 101, 110, 49, 50, 51]); // "token123"
      const message = {
        records: [{
          recordType: 'text',
          encoding: 'utf-8',
          data: mockTextData
        }]
      };

      const result = NFCHandler.extractTokenId(message, 'SERIAL');

      // BEHAVIORAL: Verify text record extraction
      expect(result.source).toBe('text-record');
      expect(result.id).toBeTruthy();
    });

    it('should extract ID from URL record', () => {
      const mockUrlData = new Uint8Array([104, 116, 116, 112, 58, 47, 47, 101, 120, 46, 99, 111, 109]); // "http://ex.com"
      const message = {
        records: [{
          recordType: 'url',
          data: mockUrlData
        }]
      };

      const result = NFCHandler.extractTokenId(message, 'SERIAL');

      // BEHAVIORAL: Verify URL record extraction
      expect(result.source).toBe('url-record');
      expect(result.id).toBeTruthy();
    });

    it('should use generic decode for unknown record types', () => {
      const mockData = new Uint8Array([116, 101, 115, 116]); // "test"
      const message = {
        records: [{
          recordType: 'unknown',
          data: mockData
        }]
      };

      const result = NFCHandler.extractTokenId(message, 'SERIAL');

      // BEHAVIORAL: Verify generic decode or serial fallback
      expect(result.source).toMatch(/generic-decode|serial-fallback/);
    });

    it('should fallback to serial when records exist but are unreadable', () => {
      const message = {
        records: [{
          recordType: 'empty',
          data: null
        }]
      };

      const result = NFCHandler.extractTokenId(message, 'FALLBACK_SERIAL');

      // BEHAVIORAL: Verify serial fallback
      expect(result).toEqual({
        id: 'FALLBACK_SERIAL',
        source: 'serial-fallback',
        raw: 'FALLBACK_SERIAL'
      });

      expect(mockDebug.log).toHaveBeenCalledWith('No readable records, using serial');
    });
  });

  describe('stopScan() - Stop NFC Scanning', () => {
    it('should set isScanning to false', () => {
      NFCHandler.isScanning = true;

      NFCHandler.stopScan();

      // BEHAVIORAL: Verify scanning stopped
      expect(NFCHandler.isScanning).toBe(false);
    });
  });

  describe('simulateScan() - Simulated Scanning', () => {
    it('should return simulated token data', () => {
      const result = NFCHandler.simulateScan();

      // BEHAVIORAL: Verify simulated data structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('source', 'simulated');
      expect(result).toHaveProperty('raw');
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('should return different IDs on multiple calls', () => {
      const results = new Set();

      // Call simulateScan multiple times
      for (let i = 0; i < 10; i++) {
        results.add(NFCHandler.simulateScan().id);
      }

      // BEHAVIORAL: Verify randomness (at least some variation)
      // Note: There's a small chance all 10 calls return the same ID from the pool,
      // but it's unlikely enough that this test should pass
      expect(results.size).toBeGreaterThan(1);
    });
  });
});
