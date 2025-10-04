/**
 * DataManager Unit Tests (Scanner Module)
 * Tests CRITICAL game logic needed for standalone mode
 * Layer 1: Service Logic - NO browser, NO server, pure logic
 *
 * NOTE: These tests EXPECT class-based architecture
 * Current DataManager is singleton - tests will FAIL until refactored
 */

const path = require('path');

// This will fail initially - DataManager is not yet a class
// Test-driven refactoring: write test first, then refactor to pass
const DataManager = require(path.join(__dirname, '../../../..', 'ALNScanner/js/core/dataManager.js'));

describe('DataManager - Score Calculation (CRITICAL for Standalone Mode)', () => {
  let dataManager;
  let mockTokenManager;
  let mockSettings;

  beforeEach(() => {
    // Mock dependencies
    mockTokenManager = {
      findToken: jest.fn(),
      getGroupInventory: jest.fn()
    };

    mockSettings = {
      deviceId: 'TEST_SCANNER',
      stationMode: 'blackmarket'
    };

    // EXPECTS class - will fail until refactored
    dataManager = new DataManager({
      tokenManager: mockTokenManager,
      settings: mockSettings
    });
  });

  afterEach(() => {
    // Clean up if DataManager has EventTarget methods
    if (dataManager && dataManager.removeEventListener) {
      // Clean up event listeners if needed
    }
  });

  describe('calculateTokenValue', () => {
    it('should calculate value for rating 1, Personal type', () => {
      const transaction = {
        valueRating: 1,
        memoryType: 'Personal',
        isUnknown: false
      };

      // BASE_VALUES[1] = 100, TYPE_MULTIPLIERS['Personal'] = 1
      const value = dataManager.calculateTokenValue(transaction);

      expect(value).toBe(100);
    });

    it('should calculate value for rating 3, Technical type', () => {
      const transaction = {
        valueRating: 3,
        memoryType: 'Technical',
        isUnknown: false
      };

      // BASE_VALUES[3] = 1000, TYPE_MULTIPLIERS['Technical'] = 5
      const value = dataManager.calculateTokenValue(transaction);

      expect(value).toBe(5000);
    });

    it('should calculate value for rating 5, Business type', () => {
      const transaction = {
        valueRating: 5,
        memoryType: 'Business',
        isUnknown: false
      };

      // BASE_VALUES[5] = 10000, TYPE_MULTIPLIERS['Business'] = 3
      const value = dataManager.calculateTokenValue(transaction);

      expect(value).toBe(30000);
    });

    it('should return 0 for unknown tokens', () => {
      const transaction = {
        valueRating: 3,
        memoryType: 'Technical',
        isUnknown: true
      };

      const value = dataManager.calculateTokenValue(transaction);

      expect(value).toBe(0);
    });

    it('should handle missing valueRating gracefully', () => {
      const transaction = {
        memoryType: 'Personal',
        isUnknown: false
      };

      const value = dataManager.calculateTokenValue(transaction);

      expect(value).toBe(0); // No rating = 0
    });

    it('should handle unknown memoryType with default multiplier', () => {
      const transaction = {
        valueRating: 2,
        memoryType: 'UnknownType',
        isUnknown: false
      };

      const value = dataManager.calculateTokenValue(transaction);

      // BASE_VALUES[2] = 500, default multiplier = 1
      expect(value).toBe(500);
    });
  });

  describe('parseGroupInfo', () => {
    it('should parse group with multiplier', () => {
      const result = dataManager.parseGroupInfo('Marcus Sucks (x2)');

      expect(result).toEqual({
        name: 'Marcus Sucks',
        multiplier: 2
      });
    });

    it('should parse group with different multiplier', () => {
      const result = dataManager.parseGroupInfo('Alpha Group (x3)');

      expect(result).toEqual({
        name: 'Alpha Group',
        multiplier: 3
      });
    });

    it('should handle group without multiplier', () => {
      const result = dataManager.parseGroupInfo('Simple Group');

      expect(result).toEqual({
        name: 'Simple Group',
        multiplier: 1
      });
    });

    it('should return default for null or empty group', () => {
      expect(dataManager.parseGroupInfo(null)).toEqual({
        name: 'Unknown',
        multiplier: 1
      });

      expect(dataManager.parseGroupInfo('')).toEqual({
        name: 'Unknown',
        multiplier: 1
      });
    });

    it('should handle invalid multiplier (less than 1)', () => {
      // Current implementation logs warning and uses 1
      const result = dataManager.parseGroupInfo('Test (x0)');

      expect(result.multiplier).toBe(1);
    });

    it('should trim whitespace from group name', () => {
      const result = dataManager.parseGroupInfo('  Spaced Group  (x2)  ');

      expect(result.name).toBe('Spaced Group');
      expect(result.multiplier).toBe(2);
    });
  });

  describe('normalizeGroupName', () => {
    it('should normalize to lowercase', () => {
      expect(dataManager.normalizeGroupName('Marcus Sucks')).toBe('marcus sucks');
    });

    it('should trim whitespace', () => {
      expect(dataManager.normalizeGroupName('  Extra  Spaces  ')).toBe('extra spaces');
    });

    it('should collapse multiple spaces to single space', () => {
      expect(dataManager.normalizeGroupName('Multiple   Spaces   Here')).toBe('multiple spaces here');
    });

    it('should normalize apostrophes', () => {
      expect(dataManager.normalizeGroupName("Marcus' Crew")).toBe("marcus' crew");
      expect(dataManager.normalizeGroupName("Marcus\u2019 Crew")).toBe("marcus' crew"); // Curly apostrophe
    });

    it('should return empty string for null or undefined', () => {
      expect(dataManager.normalizeGroupName(null)).toBe('');
      expect(dataManager.normalizeGroupName(undefined)).toBe('');
    });
  });

  describe('isTokenScanned', () => {
    it('should return false for unscanned token', () => {
      const result = dataManager.isTokenScanned('token001');

      expect(result).toBe(false);
    });

    it('should return true after marking token as scanned', () => {
      dataManager.markTokenAsScanned('token001');

      const result = dataManager.isTokenScanned('token001');

      expect(result).toBe(true);
    });

    it('should track multiple scanned tokens', () => {
      dataManager.markTokenAsScanned('token001');
      dataManager.markTokenAsScanned('token002');

      expect(dataManager.isTokenScanned('token001')).toBe(true);
      expect(dataManager.isTokenScanned('token002')).toBe(true);
      expect(dataManager.isTokenScanned('token003')).toBe(false);
    });
  });

  describe('calculateTeamScoreWithBonuses', () => {
    beforeEach(() => {
      // Setup group inventory mock
      mockTokenManager.getGroupInventory.mockReturnValue({
        'alpha group': {
          displayName: 'Alpha Group',
          multiplier: 2,
          tokens: new Set(['token001', 'token002', 'token003'])
        },
        'beta': {
          displayName: 'Beta',
          multiplier: 3,
          tokens: new Set(['token004', 'token005'])
        }
      });
    });

    it('should calculate base score without completed groups', () => {
      // Add transactions without completing any group
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 1,
          memoryType: 'Personal',
          group: 'Alpha Group (x2)',
          rfid: 'token001',
          isUnknown: false
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      expect(result.baseScore).toBe(100); // 1 * Personal
      expect(result.bonusScore).toBe(0); // No completed groups
      expect(result.totalScore).toBe(100);
      expect(result.completedGroups).toBe(0);
    });

    it('should calculate bonus when group completed', () => {
      // Complete Alpha Group (3 tokens)
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 3,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token001',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 3,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token002',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 3,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token003',
          isUnknown: false
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      // Each token: rating 3 (1000) * Technical (5) = 5000
      // Base: 3 * 5000 = 15000
      // Bonus: 15000 * (2-1) = 15000 (x2 multiplier)
      expect(result.baseScore).toBe(15000);
      expect(result.bonusScore).toBe(15000);
      expect(result.totalScore).toBe(30000);
      expect(result.completedGroups).toBe(1);
    });

    it('should handle multiple completed groups', () => {
      // Complete both Alpha and Beta groups
      dataManager.transactions = [
        // Alpha Group
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 2,
          memoryType: 'Business',
          group: 'Alpha Group (x2)',
          rfid: 'token001',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 2,
          memoryType: 'Business',
          group: 'Alpha Group (x2)',
          rfid: 'token002',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 2,
          memoryType: 'Business',
          group: 'Alpha Group (x2)',
          rfid: 'token003',
          isUnknown: false
        },
        // Beta Group
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 1,
          memoryType: 'Personal',
          group: 'Beta (x3)',
          rfid: 'token004',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 1,
          memoryType: 'Personal',
          group: 'Beta (x3)',
          rfid: 'token005',
          isUnknown: false
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      // Alpha: 3 * (500 * 3) = 4500 base, 4500 bonus (x2)
      // Beta: 2 * (100 * 1) = 200 base, 400 bonus (x3 = 2 * base)
      expect(result.baseScore).toBe(4700);
      expect(result.bonusScore).toBe(4900);
      expect(result.totalScore).toBe(9600);
      expect(result.completedGroups).toBe(2);
    });

    it('should ignore detective mode transactions', () => {
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'detective', // Not blackmarket
          valueRating: 5,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token001',
          isUnknown: false
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      expect(result.baseScore).toBe(0);
      expect(result.bonusScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });

    it('should ignore unknown tokens in score calculation', () => {
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 5,
          memoryType: 'Technical',
          group: 'Unknown Group',
          rfid: 'unknown',
          isUnknown: true
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      expect(result.baseScore).toBe(0);
      expect(result.bonusScore).toBe(0);
    });

    it('should calculate scores only for specified team', () => {
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          valueRating: 3,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token001',
          isUnknown: false
        },
        {
          teamId: '002', // Different team
          stationMode: 'blackmarket',
          valueRating: 5,
          memoryType: 'Technical',
          group: 'Alpha Group (x2)',
          rfid: 'token002',
          isUnknown: false
        }
      ];

      const result = dataManager.calculateTeamScoreWithBonuses('001');

      // Only token001 should be counted (rating 3, Technical = 5000)
      expect(result.baseScore).toBe(5000);
    });
  });

  describe('getTeamCompletedGroups', () => {
    beforeEach(() => {
      mockTokenManager.getGroupInventory.mockReturnValue({
        'alpha group': {
          displayName: 'Alpha Group',
          multiplier: 2,
          tokens: new Set(['token001', 'token002', 'token003'])
        },
        'beta': {
          displayName: 'Beta',
          multiplier: 3,
          tokens: new Set(['token004', 'token005'])
        },
        'single token': {
          displayName: 'Single Token',
          multiplier: 2,
          tokens: new Set(['token006']) // Single token - should be ignored
        },
        'no bonus': {
          displayName: 'No Bonus',
          multiplier: 1,
          tokens: new Set(['token007', 'token008']) // No bonus - should be ignored
        }
      });
    });

    it('should return empty array when no groups completed', () => {
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          rfid: 'token001',
          isUnknown: false
        }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed).toEqual([]);
    });

    it('should detect completed group', () => {
      // Complete Alpha Group
      dataManager.transactions = [
        {
          teamId: '001',
          stationMode: 'blackmarket',
          rfid: 'token001',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          rfid: 'token002',
          isUnknown: false
        },
        {
          teamId: '001',
          stationMode: 'blackmarket',
          rfid: 'token003',
          isUnknown: false
        }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed.length).toBe(1);
      expect(completed[0]).toMatchObject({
        name: 'Alpha Group',
        normalizedName: 'alpha group',
        multiplier: 2,
        tokenCount: 3
      });
    });

    it('should detect multiple completed groups', () => {
      // Complete both Alpha and Beta
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token001', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token002', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token003', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token004', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token005', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed.length).toBe(2);
      expect(completed.map(g => g.name)).toContain('Alpha Group');
      expect(completed.map(g => g.name)).toContain('Beta');
    });

    it('should ignore single-token groups', () => {
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token006', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed.length).toBe(0); // Single token groups ignored
    });

    it('should ignore groups with multiplier <= 1', () => {
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token007', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token008', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed.length).toBe(0); // No bonus groups ignored
    });

    it('should not count incomplete groups', () => {
      // Only 2 of 3 Alpha tokens
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token001', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token002', isUnknown: false }
        // token003 missing
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      expect(completed.length).toBe(0);
    });

    it('should only count teams blackmarket transactions', () => {
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token001', isUnknown: false },
        { teamId: '001', stationMode: 'detective', rfid: 'token002', isUnknown: false }, // Detective mode
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token003', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      // token002 not counted (detective mode), so Alpha incomplete
      expect(completed.length).toBe(0);
    });

    it('should ignore unknown tokens', () => {
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token001', isUnknown: false },
        { teamId: '001', stationMode: 'blackmarket', rfid: 'unknown', isUnknown: true }, // Unknown
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token003', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      // Unknown token not counted, so Alpha incomplete
      expect(completed.length).toBe(0);
    });

    it('should only count specified teams tokens', () => {
      dataManager.transactions = [
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token001', isUnknown: false },
        { teamId: '002', stationMode: 'blackmarket', rfid: 'token002', isUnknown: false }, // Different team
        { teamId: '001', stationMode: 'blackmarket', rfid: 'token003', isUnknown: false }
      ];

      const completed = dataManager.getTeamCompletedGroups('001');

      // token002 belongs to team 002, so Alpha incomplete for team 001
      expect(completed.length).toBe(0);
    });
  });
});
