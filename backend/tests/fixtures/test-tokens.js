/**
 * Test Token Fixtures
 * Deterministic token data for reliable testing
 *
 * Purpose: Eliminate test fragility from real token data dependency
 * Usage: Import in tests that need predictable token data
 *
 * NOTE: Uses real tokens from ALN-TokenData where possible for consistency
 */

module.exports = {
  // Real group from ALN-TokenData: "Marcus Sucks" (x2 multiplier, 2 tokens)
  // Complete group for testing group completion bonuses
  MARCUS_SUCKS: {
    groupName: 'Marcus Sucks',
    multiplier: 2,
    tokens: [
      {
        id: 'rat001',
        image: 'assets/images/rat001.png',
        audio: 'assets/audio/rat001.mp3',
        video: null,
        processingImage: null,
        SF_RFID: 'rat001',
        SF_ValueRating: 4,
        SF_MemoryType: 'Business',
        SF_Group: 'Marcus Sucks(x2)' // Note: no space before (x2)
      },
      {
        id: 'asm001',
        image: 'assets/images/asm001.png',
        audio: 'assets/audio/asm001.wav',
        video: null,
        processingImage: null,
        SF_RFID: 'asm001',
        SF_ValueRating: 3,
        SF_MemoryType: 'Personal',
        SF_Group: 'Marcus Sucks (x2)' // Note: space before (x2) - inconsistency in data
      }
    ]
  },

  // Fictional incomplete group for testing partial collection scenarios
  SERVER_LOGS: {
    groupName: 'Server Logs',
    multiplier: 3,
    totalTokens: 5, // Only 2 provided - intentionally incomplete
    tokens: [
      {
        id: 'test_srv001',
        image: null,
        audio: null,
        video: null,
        processingImage: null,
        SF_RFID: 'test_srv001',
        SF_ValueRating: 2,
        SF_MemoryType: 'Technical',
        SF_Group: 'Server Logs (x3)'
      },
      {
        id: 'test_srv002',
        image: null,
        audio: null,
        video: null,
        processingImage: null,
        SF_RFID: 'test_srv002',
        SF_ValueRating: 3,
        SF_MemoryType: 'Technical',
        SF_Group: 'Server Logs (x3)'
      }
    ]
  },

  // Real standalone tokens from ALN-TokenData
  STANDALONE_TOKENS: [
    {
      id: '534e2b02',
      image: 'assets/images/534e2b02.jpg',
      audio: 'assets/audio/534e2b02.mp3',
      video: null,
      processingImage: null,
      SF_RFID: '534e2b02',
      SF_ValueRating: 3,
      SF_MemoryType: 'Technical',
      SF_Group: ''
    },
    {
      id: '534e2b03',
      image: null,
      audio: null,
      video: 'test_30sec.mp4',
      processingImage: '534e2b03.jpg',
      SF_RFID: '534e2b03',
      SF_ValueRating: 3,
      SF_MemoryType: 'Technical',
      SF_Group: ''
    },
    {
      id: 'hos001',
      image: 'assets/images/hos001.png',
      audio: null,
      video: null,
      processingImage: null,
      SF_RFID: 'hos001',
      SF_ValueRating: 3,
      SF_MemoryType: 'Business',
      SF_Group: ''
    }
  ],

  // Real tokens from ALN-TokenData for specific test scenarios
  VIDEO_TOKEN: {
    id: 'jaw001',
    image: null,
    audio: null,
    video: 'jaw001.mp4',
    processingImage: 'assets/images/jaw001.png',
    SF_RFID: 'jaw001',
    SF_ValueRating: 5,
    SF_MemoryType: 'Personal',
    SF_Group: ''
  },

  AUDIO_TOKEN: {
    id: 'tac001',
    image: 'assets/images/tac001.jpg',
    audio: 'assets/audio/tac001.wav',
    video: null,
    processingImage: null,
    SF_RFID: 'tac001',
    SF_ValueRating: 1,
    SF_MemoryType: 'Personal',
    SF_Group: ''
  },

  IMAGE_TOKEN: {
    id: 'fli001',
    image: 'assets/images/fli001.png',
    audio: null,
    video: null,
    processingImage: null,
    SF_RFID: 'fli001',
    SF_ValueRating: 1,
    SF_MemoryType: 'Personal',
    SF_Group: ''
  },

  /**
   * Get all tokens as an object keyed by ID (matches ALN-TokenData format)
   * Usage: TokenManager.database = TestTokens.getAllAsObject()
   */
  getAllAsObject() {
    const tokens = {};

    // Add Marcus Sucks group (real tokens)
    this.MARCUS_SUCKS.tokens.forEach(token => {
      tokens[token.id] = token;
    });

    // Add Server Logs group (test tokens)
    this.SERVER_LOGS.tokens.forEach(token => {
      tokens[token.id] = token;
    });

    // Add standalone tokens (real tokens)
    this.STANDALONE_TOKENS.forEach(token => {
      tokens[token.id] = token;
    });

    // Add special tokens (real tokens)
    tokens[this.VIDEO_TOKEN.id] = this.VIDEO_TOKEN;
    tokens[this.AUDIO_TOKEN.id] = this.AUDIO_TOKEN;
    tokens[this.IMAGE_TOKEN.id] = this.IMAGE_TOKEN;

    return tokens;
  },

  /**
   * Get all tokens as an array (for iteration)
   */
  getAllAsArray() {
    return Object.values(this.getAllAsObject());
  },

  /**
   * Get tokens from a specific group
   */
  getGroup(groupName) {
    if (groupName.includes('Marcus Sucks')) {
      return this.MARCUS_SUCKS.tokens;
    }
    if (groupName.includes('Server Logs')) {
      return this.SERVER_LOGS.tokens;
    }
    return [];
  }
};
