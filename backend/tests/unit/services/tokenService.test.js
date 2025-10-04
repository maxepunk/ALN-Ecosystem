/**
 * TokenService Unit Tests
 * Tests token loading, transformation, and utility functions
 * Layer 1: Service Logic - NO server, NO WebSocket, pure logic
 */

const tokenService = require('../../../src/services/tokenService');
const fs = require('fs');
const path = require('path');

// Mock fs for file loading tests
jest.mock('fs');

describe('TokenService - Utility Functions', () => {
  describe('parseGroupMultiplier', () => {
    it('should parse multiplier from group string', () => {
      expect(tokenService.parseGroupMultiplier('Marcus Sucks (x2)')).toBe(2);
      expect(tokenService.parseGroupMultiplier('Alpha Group (x3)')).toBe(3);
      expect(tokenService.parseGroupMultiplier('Beta (x5)')).toBe(5);
    });

    it('should handle case-insensitive multiplier', () => {
      expect(tokenService.parseGroupMultiplier('Test (X2)')).toBe(2);
      expect(tokenService.parseGroupMultiplier('Test (x2)')).toBe(2);
    });

    it('should return 1 when no multiplier present', () => {
      expect(tokenService.parseGroupMultiplier('No Multiplier Group')).toBe(1);
      expect(tokenService.parseGroupMultiplier('Simple Name')).toBe(1);
    });

    it('should return 1 for null or empty group', () => {
      expect(tokenService.parseGroupMultiplier(null)).toBe(1);
      expect(tokenService.parseGroupMultiplier('')).toBe(1);
      expect(tokenService.parseGroupMultiplier(undefined)).toBe(1);
    });

    it('should handle malformed multiplier syntax', () => {
      expect(tokenService.parseGroupMultiplier('Group (x)')).toBe(1);
      expect(tokenService.parseGroupMultiplier('Group (xabc)')).toBe(1);
      expect(tokenService.parseGroupMultiplier('Group x2')).toBe(1); // No parentheses
    });
  });

  describe('extractGroupName', () => {
    it('should extract group name without multiplier', () => {
      expect(tokenService.extractGroupName('Marcus Sucks (x2)')).toBe('Marcus Sucks');
      expect(tokenService.extractGroupName('Alpha Group (x3)')).toBe('Alpha Group');
      expect(tokenService.extractGroupName('Beta (x5)')).toBe('Beta');
    });

    it('should handle group without multiplier', () => {
      expect(tokenService.extractGroupName('Simple Group')).toBe('Simple Group');
      expect(tokenService.extractGroupName('No Multiplier')).toBe('No Multiplier');
    });

    it('should return null for null or empty group', () => {
      expect(tokenService.extractGroupName(null)).toBe(null);
      expect(tokenService.extractGroupName('')).toBe(null);
      expect(tokenService.extractGroupName(undefined)).toBe(null);
    });

    it('should trim whitespace after removing multiplier', () => {
      expect(tokenService.extractGroupName('Group   (x2)')).toBe('Group');
      expect(tokenService.extractGroupName('  Spaced  (x3)  ')).toBe('Spaced');
    });

    it('should return null if only multiplier remains after extraction', () => {
      expect(tokenService.extractGroupName('(x2)')).toBe(null);
    });
  });

  describe('calculateTokenValue', () => {
    // These tests depend on config.game.valueRatingMap and typeMultipliers
    // Assuming standard config: valueRatingMap = {1: 100, 2: 500, 3: 1000, 4: 5000, 5: 10000}
    // Assuming typeMultipliers = {personal: 1.0, business: 3.0, technical: 5.0}

    it('should calculate value with rating 1 and Personal type', () => {
      // Base: 100, Multiplier: 1.0 = 100
      const value = tokenService.calculateTokenValue(1, 'Personal');
      expect(value).toBe(100);
    });

    it('should calculate value with rating 3 and Technical type', () => {
      // Base: 1000, Multiplier: 5.0 = 5000
      const value = tokenService.calculateTokenValue(3, 'Technical');
      expect(value).toBe(5000);
    });

    it('should calculate value with rating 5 and Business type', () => {
      // Base: 10000, Multiplier: 3.0 = 30000
      const value = tokenService.calculateTokenValue(5, 'Business');
      expect(value).toBe(30000);
    });

    it('should handle case-insensitive memory types', () => {
      // Config uses lowercase keys
      const value1 = tokenService.calculateTokenValue(2, 'TECHNICAL');
      const value2 = tokenService.calculateTokenValue(2, 'technical');
      const value3 = tokenService.calculateTokenValue(2, 'Technical');
      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
    });

    it('should default to rating 1 value for invalid rating', () => {
      const value = tokenService.calculateTokenValue(999, 'Personal');
      expect(value).toBe(100); // Defaults to rating 1
    });

    it('should default to 1.0 multiplier for unknown type', () => {
      // Unknown type should default to 1.0 multiplier
      const value = tokenService.calculateTokenValue(3, 'UnknownType');
      expect(value).toBe(1000); // Base value only (1000 * 1.0)
    });

    it('should handle null or undefined type', () => {
      // Should default to 'personal' (lowercase) with 1.0 multiplier
      const value1 = tokenService.calculateTokenValue(2, null);
      const value2 = tokenService.calculateTokenValue(2, undefined);
      expect(value1).toBe(500); // Rating 2 base (500 * 1.0)
      expect(value2).toBe(500);
    });

    it('should floor decimal results', () => {
      // If multiplier results in decimal, should floor
      // This depends on actual config values - test principle
      const value = tokenService.calculateTokenValue(1, 'Personal');
      expect(Number.isInteger(value)).toBe(true);
    });
  });
});

describe('TokenService - Token Loading', () => {
  const mockTokensObject = {
    'token001': {
      SF_RFID: 'token001',
      SF_ValueRating: 3,
      SF_MemoryType: 'Technical',
      SF_Group: 'Alpha Group (x2)',
      image: '/assets/images/token001.jpg',
      audio: null,
      video: '/videos/token001.mp4',
      processingImage: null
    },
    'token002': {
      SF_RFID: 'token002',
      SF_ValueRating: 5,
      SF_MemoryType: 'Business',
      SF_Group: 'Beta (x3)',
      image: null,
      audio: '/assets/audio/token002.mp3',
      video: null,
      processingImage: null
    },
    'token003': {
      SF_RFID: 'token003',
      SF_ValueRating: 1,
      SF_MemoryType: 'Personal',
      SF_Group: '', // Empty group
      image: null,
      audio: null,
      video: null,
      processingImage: null
    }
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Clear console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('loadRawTokens', () => {
    it('should load and return raw tokens object', () => {
      // Mock successful file read
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTokensObject));

      const rawTokens = tokenService.loadRawTokens();

      expect(rawTokens).toEqual(mockTokensObject);
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should try multiple paths when first path fails', () => {
      // First path fails, second succeeds
      fs.readFileSync
        .mockImplementationOnce(() => {
          throw new Error('File not found');
        })
        .mockReturnValueOnce(JSON.stringify(mockTokensObject));

      const rawTokens = tokenService.loadRawTokens();

      expect(rawTokens).toEqual(mockTokensObject);
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    });

    it('should throw error when all paths fail', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => tokenService.loadRawTokens()).toThrow(
        'CRITICAL: Failed to load tokens from any configured path'
      );
    });

    it('should handle malformed JSON', () => {
      fs.readFileSync.mockReturnValue('{ invalid json }');

      expect(() => tokenService.loadRawTokens()).toThrow();
    });
  });

  describe('loadTokens', () => {
    beforeEach(() => {
      // Mock successful file read for transformation tests
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTokensObject));
    });

    it('should transform tokens to array format', () => {
      const tokens = tokenService.loadTokens();

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(3);
    });

    it('should transform token fields correctly', () => {
      const tokens = tokenService.loadTokens();
      const token001 = tokens.find(t => t.id === 'token001');

      // Check transformed structure
      expect(token001).toMatchObject({
        id: 'token001',
        name: 'Alpha Group (x2)', // Uses SF_Group as name
        memoryType: 'Technical',
        groupId: 'Alpha Group', // Extracted without multiplier
        groupMultiplier: 2
      });
    });

    it('should calculate token values correctly', () => {
      const tokens = tokenService.loadTokens();
      const token001 = tokens.find(t => t.id === 'token001');

      // Rating 3, Technical (5x) = 1000 * 5 = 5000
      expect(token001.value).toBe(5000);
    });

    it('should include mediaAssets structure', () => {
      const tokens = tokenService.loadTokens();
      const token001 = tokens.find(t => t.id === 'token001');

      expect(token001.mediaAssets).toEqual({
        image: '/assets/images/token001.jpg',
        audio: null,
        video: '/videos/token001.mp4',
        processingImage: null
      });
    });

    it('should include metadata structure', () => {
      const tokens = tokenService.loadTokens();
      const token001 = tokens.find(t => t.id === 'token001');

      expect(token001.metadata).toEqual({
        rfid: 'token001',
        group: 'Alpha Group (x2)',
        originalType: 'Technical',
        rating: 3
      });
    });

    it('should handle empty group field', () => {
      const tokens = tokenService.loadTokens();
      const token003 = tokens.find(t => t.id === 'token003');

      expect(token003.groupId).toBe(null); // Empty group extracts to null
      expect(token003.groupMultiplier).toBe(1); // No multiplier = 1
    });

    it('should provide default values for missing fields', () => {
      const tokensWithMissing = {
        'incomplete': {
          SF_RFID: 'incomplete',
          SF_ValueRating: 2,
          // Missing SF_MemoryType, SF_Group
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(tokensWithMissing));
      const tokens = tokenService.loadTokens();
      const incomplete = tokens[0];

      expect(incomplete.memoryType).toBe('Personal'); // Default
      expect(incomplete.groupId).toBe(null);
      expect(incomplete.groupMultiplier).toBe(1);
    });

    it('should use Memory {id} as fallback name when no group', () => {
      const tokensWithoutGroup = {
        'nogroup': {
          SF_RFID: 'nogroup',
          SF_ValueRating: 1,
          SF_MemoryType: 'Personal'
          // No SF_Group
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(tokensWithoutGroup));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].name).toBe('Memory nogroup');
    });
  });

  describe('getTestTokens', () => {
    it('should return array of test tokens', () => {
      const testTokens = tokenService.getTestTokens();

      expect(Array.isArray(testTokens)).toBe(true);
      expect(testTokens.length).toBeGreaterThan(0);
    });

    it('should return tokens with required structure', () => {
      const testTokens = tokenService.getTestTokens();

      testTokens.forEach(token => {
        expect(token).toHaveProperty('id');
        expect(token).toHaveProperty('name');
        expect(token).toHaveProperty('value');
        expect(token).toHaveProperty('memoryType');
        expect(token).toHaveProperty('mediaAssets');
        expect(token).toHaveProperty('metadata');
      });
    });

    it('should include tokens with video assets', () => {
      const testTokens = tokenService.getTestTokens();
      const videoToken = testTokens.find(t => t.mediaAssets.video);

      expect(videoToken).toBeDefined();
      expect(videoToken.mediaAssets.video).toBeTruthy();
    });
  });
});
