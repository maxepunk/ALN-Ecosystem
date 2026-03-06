/**
 * TokenService Unit Tests
 * Tests token loading, transformation, and utility functions
 * Layer 1: Service Logic - NO server, NO WebSocket, pure logic
 *
 * DRY PRINCIPLE: Expected scores are calculated using production scoring logic
 * from tokenService.calculateTokenValue() to ensure tests stay in sync when
 * scoring config changes.
 */

const tokenService = require('../../../src/services/tokenService');
const fs = require('fs');
const path = require('path');

// DRY helper: use production function for expected values
const calcExpected = (rating, type) => tokenService.calculateTokenValue(rating, type);

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
    // Values loaded dynamically from ALN-TokenData/scoring-config.json

    it('should calculate value with rating 1 and Personal type', () => {
      // Base: 10000, Multiplier: 1.0 = 10000
      const value = tokenService.calculateTokenValue(1, 'Personal');
      expect(value).toBe(10000);
    });

    it('should calculate value with rating 3 and Technical type', () => {
      // Base: 50000, Multiplier: 5.0 = 250000
      const value = tokenService.calculateTokenValue(3, 'Technical');
      expect(value).toBe(250000);
    });

    it('should calculate value with rating 5 and Business type', () => {
      // Base: 150000, Multiplier: 3.0 = 450000
      const value = tokenService.calculateTokenValue(5, 'Business');
      expect(value).toBe(450000);
    });

    it('should handle case-insensitive memory types', () => {
      // Config uses lowercase keys
      const value1 = tokenService.calculateTokenValue(2, 'TECHNICAL');
      const value2 = tokenService.calculateTokenValue(2, 'technical');
      const value3 = tokenService.calculateTokenValue(2, 'Technical');
      expect(value1).toBe(value2);
      expect(value2).toBe(value3);
    });

    it('should default to $0 for invalid rating', () => {
      const value = tokenService.calculateTokenValue(999, 'Personal');
      expect(value).toBe(0); // Missing/invalid rating = $0 base
    });

    it('should calculate value for Mention type (3x multiplier)', () => {
      const value = tokenService.calculateTokenValue(2, 'Mention');
      expect(value).toBe(calcExpected(2, 'Business')); // Both are 3x
    });

    it('should calculate value for Party type (5x multiplier)', () => {
      const value = tokenService.calculateTokenValue(3, 'Party');
      expect(value).toBe(calcExpected(3, 'Technical')); // Both are 5x
    });

    it('should use unknown multiplier (0) for unknown type', () => {
      // Unknown types should use the unknown multiplier (0) to prevent exploitation
      const value = tokenService.calculateTokenValue(3, 'UnknownType');
      expect(value).toBe(0); // Base value * 0 = 0 (security: unknown tokens score nothing)
    });

    it('should handle null or undefined type (scores $0)', () => {
      // Empty type defaults to 'unknown' (0x multiplier) = $0
      const value1 = tokenService.calculateTokenValue(2, null);
      const value2 = tokenService.calculateTokenValue(2, undefined);
      expect(value1).toBe(0);
      expect(value2).toBe(0);
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
      processingImage: null,
      owner: 'Alex Reeves'
    },
    'token002': {
      SF_RFID: 'token002',
      SF_ValueRating: 5,
      SF_MemoryType: 'Business',
      SF_Group: 'Beta (x3)',
      image: null,
      audio: '/assets/audio/token002.mp3',
      video: null,
      processingImage: null,
      owner: 'Ashe Motoko'
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
      // No owner field — should default to null
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

      // DRY: Use production scoring logic - Rating 3, Technical (5x)
      const expectedValue = calcExpected(3, 'Technical');
      expect(token001.value).toBe(expectedValue);
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

    it('should include metadata structure with owner', () => {
      const tokens = tokenService.loadTokens();
      const token001 = tokens.find(t => t.id === 'token001');

      expect(token001.metadata).toEqual({
        rfid: 'token001',
        group: 'Alpha Group (x2)',
        originalType: 'Technical',
        rating: 3,
        summary: null,
        owner: 'Alex Reeves'
      });
    });

    it('should default owner to null when not present in token data', () => {
      const tokens = tokenService.loadTokens();
      const token003 = tokens.find(t => t.id === 'token003');

      expect(token003.metadata.owner).toBeNull();
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

      expect(incomplete.memoryType).toBe('UNKNOWN'); // Was 'Personal'
      expect(incomplete.value).toBe(0); // UNKNOWN = 0x multiplier
      expect(incomplete.groupId).toBe(null);
      expect(incomplete.groupMultiplier).toBe(1);
    });

    it('should handle token with both null SF_ValueRating and null SF_MemoryType', () => {
      const nullScoringToken = {
        'scoreless001': {
          SF_RFID: 'scoreless001',
          SF_ValueRating: null,
          SF_MemoryType: null,
          SF_Group: '',
          image: 'assets/images/scoreless001.bmp',
          audio: null,
          video: null,
          processingImage: null,
          owner: 'Test Character'
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(nullScoringToken));
      const tokens = tokenService.loadTokens();
      const token = tokens[0];

      expect(token.memoryType).toBe('UNKNOWN');
      expect(token.value).toBe(0);
      expect(token.metadata.rating).toBeNull();
      expect(token.metadata.originalType).toBeNull();
      expect(token.metadata.owner).toBe('Test Character');
      expect(token.id).toBe('scoreless001');
    });

    it('should load tokens with Mention memory type', () => {
      const mentionToken = {
        'mention001': {
          SF_RFID: 'mention001',
          SF_ValueRating: 3,
          SF_MemoryType: 'Mention',
          SF_Group: ''
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mentionToken));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].memoryType).toBe('Mention');
      expect(tokens[0].value).toBe(calcExpected(3, 'Mention'));
    });

    it('should load tokens with Party memory type', () => {
      const partyToken = {
        'party001': {
          SF_RFID: 'party001',
          SF_ValueRating: 4,
          SF_MemoryType: 'Party',
          SF_Group: ''
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(partyToken));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].memoryType).toBe('Party');
      expect(tokens[0].value).toBe(calcExpected(4, 'Party'));
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

});
