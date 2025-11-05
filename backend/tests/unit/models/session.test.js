/**
 * Session Model - Unit Tests
 * Tests for Phase 1.1 (P0.1): Server-side per-device duplicate detection
 */

const Session = require('../../../src/models/session');

describe('Session Model - Per-Device Duplicate Detection (P0.1)', () => {
  let session;

  beforeEach(() => {
    session = new Session({
      name: 'Test Session',
      teams: ['001', '002']
    });
  });

  describe('scannedTokensByDevice initialization', () => {
    test('should initialize scannedTokensByDevice as empty object for new session', () => {
      expect(session.metadata.scannedTokensByDevice).toBeDefined();
      expect(session.metadata.scannedTokensByDevice).toEqual({});
    });

    test('should migrate old sessions without scannedTokensByDevice', () => {
      const oldSession = new Session({
        name: 'Old Session',
        metadata: {
          gmStations: 1,
          playerDevices: 2,
          totalScans: 10,
          uniqueTokensScanned: ['kaa001']
          // No scannedTokensByDevice (old session)
        }
      });

      expect(oldSession.metadata.scannedTokensByDevice).toBeDefined();
      expect(oldSession.metadata.scannedTokensByDevice).toEqual({});
    });
  });

  describe('getDeviceScannedTokens()', () => {
    test('should return empty Set for device with no scans', () => {
      const tokens = session.getDeviceScannedTokens('GM_001');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(0);
    });

    test('should return Set of scanned tokens for device', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001', 'kaa002'];

      const tokens = session.getDeviceScannedTokens('GM_001');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(2);
      expect(tokens.has('kaa001')).toBe(true);
      expect(tokens.has('kaa002')).toBe(true);
    });

    test('should initialize empty array if device not in object', () => {
      const tokens = session.getDeviceScannedTokens('NEW_DEVICE');

      expect(tokens).toBeInstanceOf(Set);
      expect(tokens.size).toBe(0);
      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toEqual([]);
    });
  });

  describe('hasDeviceScannedToken()', () => {
    test('should return false for unscanned token', () => {
      const hasScanned = session.hasDeviceScannedToken('GM_001', 'kaa001');
      expect(hasScanned).toBe(false);
    });

    test('should return true for scanned token', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001'];

      const hasScanned = session.hasDeviceScannedToken('GM_001', 'kaa001');
      expect(hasScanned).toBe(true);
    });

    test('should return false for token scanned by different device', () => {
      session.metadata.scannedTokensByDevice['GM_001'] = ['kaa001'];

      const hasScanned = session.hasDeviceScannedToken('GM_002', 'kaa001');
      expect(hasScanned).toBe(false);
    });

    test('should handle non-existent device', () => {
      const hasScanned = session.hasDeviceScannedToken('NONEXISTENT', 'kaa001');
      expect(hasScanned).toBe(false);
    });
  });

  describe('addDeviceScannedToken()', () => {
    test('should add token to device scanned list', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');

      expect(session.metadata.scannedTokensByDevice['GM_001']).toContain('kaa001');
      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
    });

    test('should not add duplicate tokens', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa001'); // Duplicate

      const tokens = session.metadata.scannedTokensByDevice['GM_001'];
      expect(tokens.length).toBe(1);
      expect(tokens).toEqual(['kaa001']);
    });

    test('should allow multiple tokens for same device', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');
      session.addDeviceScannedToken('GM_001', 'kaa003');

      const tokens = session.metadata.scannedTokensByDevice['GM_001'];
      expect(tokens.length).toBe(3);
      expect(tokens).toEqual(['kaa001', 'kaa002', 'kaa003']);
    });

    test('should allow same token for different devices', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_002', 'kaa001');

      expect(session.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
      expect(session.hasDeviceScannedToken('GM_002', 'kaa001')).toBe(true);
    });

    test('should initialize array if device not exists', () => {
      session.addDeviceScannedToken('NEW_DEVICE', 'kaa001');

      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toBeDefined();
      expect(session.metadata.scannedTokensByDevice['NEW_DEVICE']).toContain('kaa001');
    });
  });

  describe('getDeviceScannedTokensArray()', () => {
    test('should return empty array for device with no scans', () => {
      const tokens = session.getDeviceScannedTokensArray('GM_001');
      expect(tokens).toEqual([]);
    });

    test('should return array of scanned tokens', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');

      const tokens = session.getDeviceScannedTokensArray('GM_001');
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens).toEqual(['kaa001', 'kaa002']);
    });

    test('should return empty array for non-existent device', () => {
      const tokens = session.getDeviceScannedTokensArray('NONEXISTENT');
      expect(tokens).toEqual([]);
    });
  });

  describe('toJSON() serialization', () => {
    test('should include scannedTokensByDevice in JSON output', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('PLAYER_001', 'kaa002');

      const json = session.toJSON();

      expect(json.metadata.scannedTokensByDevice).toBeDefined();
      expect(json.metadata.scannedTokensByDevice).toEqual({
        GM_001: ['kaa001'],
        PLAYER_001: ['kaa002']
      });
    });

    test('should serialize empty scannedTokensByDevice as empty object', () => {
      const json = session.toJSON();

      expect(json.metadata.scannedTokensByDevice).toEqual({});
    });
  });

  describe('Integration with existing Session functionality', () => {
    test('should not interfere with addTransaction()', () => {
      const transaction = {
        id: 'tx-001',
        tokenId: 'kaa001',
        deviceId: 'GM_001',
        teamId: '001',
        timestamp: new Date().toISOString()
      };

      session.addTransaction(transaction);

      expect(session.transactions).toHaveLength(1);
      expect(session.metadata.totalScans).toBe(1);
      // scannedTokensByDevice is managed by transactionService, not addTransaction
      expect(session.metadata.scannedTokensByDevice).toEqual({});
    });

    test('should persist across session serialization/deserialization', () => {
      session.addDeviceScannedToken('GM_001', 'kaa001');
      session.addDeviceScannedToken('GM_001', 'kaa002');

      const json = session.toJSON();
      const restored = Session.fromJSON(json);

      expect(restored.hasDeviceScannedToken('GM_001', 'kaa001')).toBe(true);
      expect(restored.hasDeviceScannedToken('GM_001', 'kaa002')).toBe(true);
      expect(restored.getDeviceScannedTokensArray('GM_001')).toEqual(['kaa001', 'kaa002']);
    });
  });
});
