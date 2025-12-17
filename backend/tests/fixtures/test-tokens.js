/**
 * Test Token Fixtures - BACKEND FORMAT
 * Deterministic token data for reliable testing
 *
 * Purpose: Eliminate test fragility from real token data dependency
 * Usage: Import in tests that need predictable token data
 *
 * CRITICAL: All tokens are in BACKEND format (transformed from scanner format)
 * - Includes: name, value, memoryType, mediaAssets{}, metadata{}
 * - Does NOT include: SF_* scanner fields (those are in metadata for reference)
 * - Matches backend/src/models/token.js schema validation requirements
 *
 * DRY PRINCIPLE: Token values are calculated using production scoring logic
 * from tokenService.calculateTokenValue(). This ensures test fixtures stay
 * in sync when scoring config changes.
 *
 * NOTE: Uses real tokens from ALN-TokenData where possible for consistency
 */

const { calculateTokenValue } = require('../../src/services/tokenService');

module.exports = {
  // Real group from ALN-TokenData: "Marcus Sucks" (x2 multiplier, 2 tokens)
  // Complete group for testing group completion bonuses (TRANSFORMED TO BACKEND FORMAT)
  MARCUS_SUCKS: {
    groupName: 'Marcus Sucks',
    multiplier: 2,
    tokens: [
      {
        id: 'rat001',
        name: 'Marcus Sucks',
        value: calculateTokenValue(4, 'Business'),  // rating 4, Business type
        memoryType: 'Business',
        groupId: 'Marcus Sucks',
        groupMultiplier: 2,
        mediaAssets: {
          image: 'assets/images/rat001.png',
          audio: 'assets/audio/rat001.mp3',
          video: null,
          processingImage: null
        },
        metadata: {
          rfid: 'rat001',
          group: 'Marcus Sucks(x2)',
          originalType: 'Business',
          rating: 4
        }
      },
      {
        id: 'asm001',
        name: 'Marcus Sucks',
        value: calculateTokenValue(3, 'Personal'),  // rating 3, Personal type
        memoryType: 'Personal',
        groupId: 'Marcus Sucks',
        groupMultiplier: 2,
        mediaAssets: {
          image: 'assets/images/asm001.png',
          audio: 'assets/audio/asm001.wav',
          video: null,
          processingImage: null
        },
        metadata: {
          rfid: 'asm001',
          group: 'Marcus Sucks (x2)',
          originalType: 'Personal',
          rating: 3
        }
      }
    ]
  },

  // Fictional incomplete group for testing partial collection scenarios (BACKEND FORMAT)
  SERVER_LOGS: {
    groupName: 'Server Logs',
    multiplier: 3,
    totalTokens: 5, // Only 2 provided - intentionally incomplete
    tokens: [
      {
        id: 'test_srv001',
        name: 'Server Logs',
        value: calculateTokenValue(2, 'Technical'),  // rating 2, Technical type
        memoryType: 'Technical',
        groupId: 'Server Logs',
        groupMultiplier: 3,
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rfid: 'test_srv001',
          group: 'Server Logs (x3)',
          originalType: 'Technical',
          rating: 2
        }
      },
      {
        id: 'test_srv002',
        name: 'Server Logs',
        value: calculateTokenValue(3, 'Technical'),  // rating 3, Technical type
        memoryType: 'Technical',
        groupId: 'Server Logs',
        groupMultiplier: 3,
        mediaAssets: {
          image: null,
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rfid: 'test_srv002',
          group: 'Server Logs (x3)',
          originalType: 'Technical',
          rating: 3
        }
      }
    ]
  },

  // Real standalone tokens from ALN-TokenData (TRANSFORMED TO BACKEND FORMAT)
  STANDALONE_TOKENS: [
    {
      id: '534e2b02',
      name: 'Memory 534e2b02',
      value: calculateTokenValue(3, 'Technical'),  // rating 3, Technical type
      memoryType: 'Technical',
      groupId: null,
      groupMultiplier: 1,
      mediaAssets: {
        image: 'assets/images/534e2b02.jpg',
        audio: 'assets/audio/534e2b02.mp3',
        video: null,
        processingImage: null
      },
      metadata: {
        rfid: '534e2b02',
        group: '',
        originalType: 'Technical',
        rating: 3
      }
    },
    {
      id: '534e2b03',
      name: 'Memory 534e2b03',
      value: calculateTokenValue(3, 'Technical'),  // rating 3, Technical type
      memoryType: 'Technical',
      groupId: null,
      groupMultiplier: 1,
      mediaAssets: {
        image: null,
        audio: null,
        video: 'test_30sec.mp4',
        processingImage: '534e2b03.jpg'
      },
      metadata: {
        rfid: '534e2b03',
        group: '',
        originalType: 'Technical',
        rating: 3
      }
    },
    {
      id: 'hos001',
      name: 'Memory hos001',
      value: calculateTokenValue(3, 'Business'),  // rating 3, Business type
      memoryType: 'Business',
      groupId: null,
      groupMultiplier: 1,
      mediaAssets: {
        image: 'assets/images/hos001.png',
        audio: null,
        video: null,
        processingImage: null
      },
      metadata: {
        rfid: 'hos001',
        group: '',
        originalType: 'Business',
        rating: 3
      }
    }
  ],

  // Real tokens from ALN-TokenData for specific test scenarios (TRANSFORMED TO BACKEND FORMAT)
  VIDEO_TOKEN: {
    id: 'jaw001',
    name: 'Memory jaw001',
    value: calculateTokenValue(5, 'Personal'),  // rating 5, Personal type
    memoryType: 'Personal',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: null,
      audio: null,
      video: 'jaw001.mp4',
      processingImage: 'assets/images/jaw001.png'
    },
    metadata: {
      rfid: 'jaw001',
      group: '',
      originalType: 'Personal',
      rating: 5
    }
  },

  AUDIO_TOKEN: {
    id: 'tac001',
    name: 'Memory tac001',
    value: calculateTokenValue(1, 'Business'),  // rating 1, Business type
    memoryType: 'Business',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/tac001.jpg',
      audio: 'assets/audio/tac001.wav',
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'tac001',
      group: '',
      originalType: 'Personal',
      rating: 1
    }
  },

  IMAGE_TOKEN: {
    id: 'fli001',
    name: 'Memory fli001',
    value: calculateTokenValue(1, 'Personal'),  // rating 1, Personal type
    memoryType: 'Personal',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/fli001.png',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'fli001',
      group: '',
      originalType: 'Personal',
      rating: 1
    }
  },

  // Detective mode tokens with summary field
  DETECTIVE_TOKEN_WITH_SUMMARY: {
    id: 'det001',
    name: 'Memory det001',
    value: calculateTokenValue(2, 'Technical'),  // rating 2, Technical type
    memoryType: 'Technical',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/placeholder.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'det001',
      group: '',
      originalType: 'Technical',
      rating: 2,
      summary: 'Security footage from warehouse district - timestamp 23:47'
    }
  },

  DETECTIVE_TOKEN_WITHOUT_SUMMARY: {
    id: 'alr001',
    name: 'Memory alr001',
    value: calculateTokenValue(3, 'Technical'),  // rating 3, Technical type
    memoryType: 'Technical',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/placeholder.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'alr001',
      group: '',
      originalType: 'Technical',
      rating: 3,
      summary: null
    }
  },

  DETECTIVE_TOKEN_WITH_HTML: {
    id: 'det999',
    name: 'Memory det999',
    value: calculateTokenValue(2, 'Technical'),  // rating 2, Technical type
    memoryType: 'Technical',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/placeholder.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'det999',
      group: '',
      originalType: 'Technical',
      rating: 2,
      summary: '<script>alert("XSS")</script> Test & "special" \'chars\''
    }
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

    // Add detective mode tokens
    tokens[this.DETECTIVE_TOKEN_WITH_SUMMARY.id] = this.DETECTIVE_TOKEN_WITH_SUMMARY;
    tokens[this.DETECTIVE_TOKEN_WITHOUT_SUMMARY.id] = this.DETECTIVE_TOKEN_WITHOUT_SUMMARY;
    tokens[this.DETECTIVE_TOKEN_WITH_HTML.id] = this.DETECTIVE_TOKEN_WITH_HTML;

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
  },

  /**
   * Get expected points value for a token by ID (DRY helper for tests)
   * Returns 0 for unknown tokens (matching production behavior)
   * @param {string} tokenId - Token ID to look up
   * @returns {number} Expected point value from dynamic calculation
   */
  getExpectedPoints(tokenId) {
    const allTokens = this.getAllAsObject();
    const token = allTokens[tokenId];
    return token ? token.value : 0;
  }
};
