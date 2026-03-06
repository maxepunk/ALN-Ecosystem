/**
 * Token Model - Null Scoring Fields
 *
 * Tokens with null SF_ValueRating and/or SF_MemoryType are valid.
 * These tokens participate in gameplay but earn $0 in Black Market mode.
 */

const Token = require('../../../src/models/token');

describe('Token Model - Null Scoring Fields', () => {
  const baseToken = {
    id: 'null001',
    name: 'Memory null001',
    value: 0,
    memoryType: 'UNKNOWN',
    groupId: null,
    mediaAssets: {
      image: 'assets/images/null001.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'null001',
      group: '',
      originalType: null,
      owner: null
    }
  };

  it('should accept token with null metadata.rating', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    expect(() => new Token(data)).not.toThrow();
  });

  it('should accept token with undefined metadata.rating (missing field)', () => {
    const data = { ...baseToken };
    // rating not present in metadata at all
    expect(() => new Token(data)).not.toThrow();
  });

  it('should accept token with null metadata.originalType', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, originalType: null, rating: null } };
    expect(() => new Token(data)).not.toThrow();
  });

  it('should still reject invalid rating values (not null, not 1-5)', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: 999 } };
    expect(() => new Token(data)).toThrow();
  });

  it('should still reject rating of 0 (below minimum)', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: 0 } };
    expect(() => new Token(data)).toThrow();
  });

  it('should preserve null rating in constructed token', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    const token = new Token(data);
    expect(token.metadata.rating).toBeNull();
  });

  it('should have value of 0 for null-scoring tokens', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    const token = new Token(data);
    expect(token.value).toBe(0);
  });
});
