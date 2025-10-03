const Transaction = require('../../../src/models/transaction');
const { v4: uuidv4 } = require('uuid');

describe('Transaction model - deviceId field', () => {
  describe('constructor', () => {
    it('should accept deviceId field', () => {
      const tx = new Transaction({
        id: uuidv4(),  // UUID required
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_01',  // deviceId (not scannerId)
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),  // UUID required
        status: 'accepted',
        points: 10
      });

      expect(tx.deviceId).toBe('GM_01');
    });
  });

  describe('toJSON()', () => {
    it('should serialize with deviceId field', () => {
      const tx = new Transaction({
        id: uuidv4(),  // UUID required
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),  // UUID required
        status: 'accepted',
        points: 10
      });

      const json = tx.toJSON();

      expect(json).toHaveProperty('deviceId');
      expect(json.deviceId).toBe('GM_01');
      expect(json).not.toHaveProperty('scannerId');  // Should NOT have scannerId
    });

    it('should include deviceId in all serializations', () => {
      const tx = new Transaction({
        id: uuidv4(),  // UUID required
        tokenId: 'tac001',
        teamId: '002',
        deviceId: 'PLAYER_SCANNER_01',
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),  // UUID required
        status: 'accepted',
        points: 5
      });

      const json = tx.toJSON();

      expect(json.deviceId).toBe('PLAYER_SCANNER_01');
      expect(Object.keys(json)).toContain('deviceId');
      expect(Object.keys(json)).not.toContain('scannerId');
    });
  });

  describe('fromJSON()', () => {
    it('should deserialize deviceId field', () => {
      const json = {
        id: uuidv4(),  // UUID required
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_01',
        timestamp: new Date().toISOString(),
        sessionId: uuidv4(),  // UUID required
        status: 'accepted',
        points: 10
      };

      const tx = Transaction.fromJSON(json);

      expect(tx.deviceId).toBe('GM_01');
    });
  });
});
