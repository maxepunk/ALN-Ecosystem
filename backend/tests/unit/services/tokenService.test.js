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

// Mock Winston logger (tokenService must log through it, not console — F-BCORE-22)
jest.mock('../../../src/utils/logger');
const logger = require('../../../src/utils/logger');

describe('TokenService - Utility Functions', () => {
  // The "(xN)" parser (parseGroupMultiplier) DIED at the tokens-v2
  // cutover (A3 slice 2b, D3b): the sync is the sole microformat parser;
  // runtime multipliers come from the pack's `groups` block only.
  it('the retired suffix parser is NOT exported (v2 cutover pin)', () => {
    expect(tokenService.parseGroupMultiplier).toBeUndefined();
  });

  describe('extractGroupName (v2: pure name passthrough)', () => {
    it('should handle group without multiplier', () => {
      expect(tokenService.extractGroupName('Simple Group')).toBe('Simple Group');
      expect(tokenService.extractGroupName('No Multiplier')).toBe('No Multiplier');
    });

    it('should return null for null or empty group', () => {
      expect(tokenService.extractGroupName(null)).toBe(null);
      expect(tokenService.extractGroupName('')).toBe(null);
      expect(tokenService.extractGroupName(undefined)).toBe(null);
    });

    it('trims whitespace (v2 pure names — a suffixed SF_Group is schema-illegal)', () => {
      expect(tokenService.extractGroupName('  Spaced Name  ')).toBe('Spaced Name');
      expect(tokenService.extractGroupName('   ')).toBe(null);
    });
  });

  describe('calculateTokenValue', () => {
    // Values come from the ACTIVE pack's game.json scoring block via
    // packService.getScoringRules() (A3 slice 2, ledger L1 retirement)

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

    it('matches memory types EXACT-CASE — mismatches score the UNKNOWN bucket (D2b canon)', () => {
      // Types are pack-declared ids matched verbatim (scanner parity —
      // its lookup was always exact-case). The activation gate refuses
      // case-mismatched TOKENS at boot, so runtime mismatches only occur
      // for wire-supplied strings — which score UNKNOWN (0×), never a
      // silently-wrong table hit.
      expect(tokenService.calculateTokenValue(2, 'Technical')).toBe(125000);
      expect(tokenService.calculateTokenValue(2, 'TECHNICAL')).toBe(0);
      expect(tokenService.calculateTokenValue(2, 'technical')).toBe(0);
      expect(tokenService.calculateTokenValue(2, null)).toBe(0);
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
      SF_Group: 'Alpha Group',
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
      SF_Group: 'Beta',
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

    it('should log through Winston, never the console (F-BCORE-22)', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        fs.readFileSync.mockReturnValue(JSON.stringify(mockTokensObject));

        tokenService.loadRawTokens();
        tokenService.loadTokens();

        expect(console.log).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should not log an ERROR when the first path is missing but the second loads (F-BCORE-22)', () => {
      // First path absent (normal on deployments without the ALN-TokenData
      // checkout) — must not produce a scary error on every boot
      fs.readFileSync
        .mockImplementationOnce(() => {
          throw new Error('ENOENT: no such file or directory');
        })
        .mockReturnValueOnce(JSON.stringify(mockTokensObject));

      const rawTokens = tokenService.loadRawTokens();

      expect(rawTokens).toEqual(mockTokensObject);
      expect(console.error).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log an error through Winston when ALL paths fail', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => tokenService.loadRawTokens()).toThrow('CRITICAL');
      expect(logger.error).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('PACK_PATH injection seam (Phase 2.x.4, generalized in 3 A2)', () => {
    afterEach(() => {
      delete process.env.PACK_PATH;
    });

    it('loads <PACK_PATH>/tokens.json first when set, winning over submodule defaults', () => {
      process.env.PACK_PATH = '/packs/fixture-pack';
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTokensObject));

      const rawTokens = tokenService.loadRawTokens();

      expect(rawTokens).toEqual(mockTokensObject);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(fs.readFileSync.mock.calls[0][0]).toBe('/packs/fixture-pack/tokens.json');
    });

    it('fails LOUD with no fallback when the injected pack has no readable tokens.json', () => {
      // An override that silently fell back would run the system
      // split-brained: the harness thinks it injected a pack the server
      // never loaded. Refusing to boot is the only honest behavior.
      process.env.PACK_PATH = '/packs/missing';
      fs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => tokenService.loadRawTokens()).toThrow(/PACK_PATH override active/);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1); // submodule fallbacks never touched
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

      // Check transformed structure (v2: SF_Group is the pure name; the
      // multiplier comes ONLY from the active pack's `groups` block — this
      // suite never activates a pack, so the undeclared/packless reading
      // is 1. The pack-derive path is pinned in claimsPolicy.test.js D1b.)
      expect(token001).toMatchObject({
        id: 'token001',
        name: 'Alpha Group', // Uses SF_Group as name
        memoryType: 'Technical',
        groupId: 'Alpha Group',
        groupMultiplier: 1
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
        group: 'Alpha Group', // v2: SF_Group is the pure name, verbatim in metadata
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

    it('should truncate summaries over 350 chars and warn (AsyncAPI contract)', () => {
      const longSummary = 'x'.repeat(400);
      const tokenWithLongSummary = {
        'verbose001': {
          SF_RFID: 'verbose001',
          SF_ValueRating: 2,
          SF_MemoryType: 'Personal',
          SF_Group: '',
          summary: longSummary
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(tokenWithLongSummary));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].metadata.summary).toHaveLength(350);
      expect(tokens[0].metadata.summary).toBe(longSummary.substring(0, 350));
      expect(logger.warn).toHaveBeenCalled();
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
