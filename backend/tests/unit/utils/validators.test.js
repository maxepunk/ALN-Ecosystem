const { validate, transactionSchema, gmTransactionSchema } = require('../../../src/utils/validators');
const { v4: uuidv4 } = require('uuid');

describe('validators.js - deviceId field validation', () => {
  describe('transactionSchema', () => {
    it('should accept deviceId field', () => {
      const transaction = {
        id: uuidv4(),  // UUID required
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_SCANNER_01',  // deviceId (not scannerId)
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),  // UUID required
        status: 'accepted',
        points: 10
      };

      const result = validate(transaction, transactionSchema);

      expect(result).toHaveProperty('deviceId');
      expect(result.deviceId).toBe('GM_SCANNER_01');
    });

    it('should reject transaction without deviceId', () => {
      const transaction = {
        id: 'test-id',
        tokenId: '534e2b03',
        teamId: '001',
        // Missing deviceId
        timestamp: new Date().toISOString(),
        sessionId: 'session-id',
        status: 'accepted',
        points: 10
      };

      expect(() => validate(transaction, transactionSchema)).toThrow();
    });
  });

  describe('gmTransactionSchema', () => {
    it('should accept deviceId field', () => {
      const scanRequest = {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_SCANNER_01',  // deviceId (not scannerId)
        mode: 'blackmarket',  // Required field per AsyncAPI contract
        timestamp: new Date().toISOString()
      };

      const result = validate(scanRequest, gmTransactionSchema);

      expect(result).toHaveProperty('deviceId');
      expect(result.deviceId).toBe('GM_SCANNER_01');
    });

    it('should reject scan request without deviceId', () => {
      const scanRequest = {
        tokenId: '534e2b03',
        teamId: '001',
        mode: 'blackmarket',
        // Missing deviceId
        timestamp: new Date().toISOString()
      };

      expect(() => validate(scanRequest, gmTransactionSchema)).toThrow();
    });

    it('should accept valid deviceId formats', () => {
      const validDeviceIds = [
        'GM_SCANNER_01',
        'PLAYER_SCANNER_01',
        'GM_Station_1',
        'test-device-123'
      ];

      validDeviceIds.forEach(deviceId => {
        const scanRequest = {
          tokenId: '534e2b03',
          teamId: '001',  // Required field
          deviceId,
          mode: 'blackmarket',  // Required field per AsyncAPI contract
          timestamp: new Date().toISOString()
        };

        const result = validate(scanRequest, gmTransactionSchema);
        expect(result.deviceId).toBe(deviceId);
      });
    });
  });
});
