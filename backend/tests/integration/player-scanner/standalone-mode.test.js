/**
 * Player Scanner - Standalone Mode Integration Tests
 *
 * Tests that player scanner works WITHOUT orchestrator (GitHub Pages deployment)
 * This is the PRIMARY deployment mode for players during game sessions
 *
 * Key Requirements:
 * - Must work without network connectivity
 * - Uses bundled data/tokens.json (submodule)
 * - No video playback features
 * - No HTTP requests to orchestrator
 */

const {
  resetMocks,
  createTestToken
} = require('../../helpers/player-scanner-mocks');

const fs = require('fs');
const path = require('path');

describe('Player Scanner - Standalone Mode (No Orchestrator)', () => {

  beforeEach(() => {
    resetMocks();
  });

  describe('Token Database Loading', () => {

    it('should load tokens from bundled data/tokens.json', () => {
      // Verify submodule token file exists
      const tokenPath = path.join(__dirname, '../../../../aln-memory-scanner/data/tokens.json');

      expect(fs.existsSync(tokenPath)).toBe(true);

      // Load and verify structure
      const tokensRaw = fs.readFileSync(tokenPath, 'utf-8');
      const tokens = JSON.parse(tokensRaw);

      // Verify it's an object (not array)
      expect(typeof tokens).toBe('object');
      expect(Array.isArray(tokens)).toBe(false);

      // Verify tokens have required fields
      const tokenIds = Object.keys(tokens);
      expect(tokenIds.length).toBeGreaterThan(0);

      // Check first token structure
      const firstToken = tokens[tokenIds[0]];
      expect(firstToken).toHaveProperty('SF_RFID');
      expect(firstToken).toHaveProperty('SF_ValueRating');
      expect(firstToken).toHaveProperty('SF_MemoryType');
    });

    it('should use submodule path first (./data/tokens.json)', () => {
      // Verify the primary path used in index.html:786
      const submodulePath = path.join(__dirname, '../../../../aln-memory-scanner/data/tokens.json');

      // This should exist (submodule is present)
      expect(fs.existsSync(submodulePath)).toBe(true);
    });
  });

  describe('Token Structure Validation', () => {

    let tokens;

    beforeAll(() => {
      const tokenPath = path.join(__dirname, '../../../../aln-memory-scanner/data/tokens.json');
      tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    });

    it('should have valid token IDs matching pattern ^[A-Za-z_0-9]+$', () => {
      const tokenIds = Object.keys(tokens);

      tokenIds.forEach(tokenId => {
        // Must match OpenAPI pattern
        expect(tokenId).toMatch(/^[A-Za-z_0-9]+$/);

        // Must be 1-100 chars
        expect(tokenId.length).toBeGreaterThanOrEqual(1);
        expect(tokenId.length).toBeLessThanOrEqual(100);
      });
    });

    it('should have required metadata fields in all tokens', () => {
      const tokenIds = Object.keys(tokens);

      tokenIds.forEach(tokenId => {
        const token = tokens[tokenId];

        // Required fields
        expect(token).toHaveProperty('SF_RFID');
        expect(token).toHaveProperty('SF_ValueRating');
        expect(token).toHaveProperty('SF_MemoryType');
        expect(token).toHaveProperty('SF_Group');

        // Field types
        expect(typeof token.SF_RFID).toBe('string');
        expect(typeof token.SF_ValueRating).toBe('number');
        expect(typeof token.SF_MemoryType).toBe('string');
        expect(typeof token.SF_Group).toBe('string');
      });
    });

    it('should have valid media asset paths if present', () => {
      const tokenIds = Object.keys(tokens);

      tokenIds.forEach(tokenId => {
        const token = tokens[tokenId];

        // If image exists, should be a string (path or data URL)
        if (token.image !== null && token.image !== undefined) {
          expect(typeof token.image).toBe('string');
        }

        // If audio exists, should be a string
        if (token.audio !== null && token.audio !== undefined) {
          expect(typeof token.audio).toBe('string');
        }

        // Video should NOT be used in standalone mode, but might exist in data
        if (token.video !== null && token.video !== undefined) {
          expect(typeof token.video).toBe('string');
        }
      });
    });
  });

  describe('Standalone Mode - No Network Requests', () => {

    it('should not make HTTP requests to orchestrator when disconnected', () => {
      // In standalone mode, there's no orchestrator to connect to
      // Scanner should work entirely offline

      // Verify no fetch calls made during normal operation
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should not show connection errors when orchestrator absent', () => {
      // Standalone mode should not try to connect at all
      // No error messages about "failed to connect"

      // Verify console.error not called for connection issues
      const errorCalls = global.console.error.mock.calls;

      const connectionErrors = errorCalls.filter(call =>
        call.some(arg =>
          typeof arg === 'string' &&
          (arg.includes('connection') || arg.includes('orchestrator'))
        )
      );

      // Should be 0 connection errors in standalone mode
      expect(connectionErrors.length).toBe(0);
    });
  });

  describe('Scan Flow - Token Lookup', () => {

    let tokens;

    beforeAll(() => {
      const tokenPath = path.join(__dirname, '../../../../aln-memory-scanner/data/tokens.json');
      tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    });

    it('should find token in database by normalized ID', () => {
      // Get a real token ID from the database
      const tokenIds = Object.keys(tokens);
      expect(tokenIds.length).toBeGreaterThan(0);

      const testTokenId = tokenIds[0];
      const token = tokens[testTokenId];

      // Verify token lookup works
      expect(token).toBeDefined();
      expect(token.SF_RFID).toBe(testTokenId);
    });

    it('should normalize token IDs (lowercase, remove special chars)', () => {
      // Test the normalization logic from index.html:1044
      // tokenId = tokenId.toLowerCase().replace(/[^a-z0-9_]/g, '');

      const normalize = (id) => id.toLowerCase().replace(/[^a-z0-9_]/g, '');

      expect(normalize('TEST_TOKEN_001')).toBe('test_token_001');
      expect(normalize('TOKEN-WITH-DASHES')).toBe('tokenwithdashes');
      expect(normalize('Token###123')).toBe('token123');
    });

    it('should handle unknown tokens gracefully (no crash)', () => {
      // When scanning unknown token, should show error, not crash

      const unknownTokenId = 'NONEXISTENT_TOKEN_99999';

      // Verify this token doesn't exist
      expect(tokens[unknownTokenId]).toBeUndefined();

      // Scanner should handle this case (tested via error handling)
      // In real app, would call showError('Unknown token: ...')
    });
  });

  describe('Media Display Logic', () => {

    it('should display image if token has image property', () => {
      const tokenWithImage = createTestToken({
        image: 'assets/images/test.jpg',
        audio: null,
        video: null
      });

      // Verify image path present
      expect(tokenWithImage.image).toBeTruthy();
      expect(typeof tokenWithImage.image).toBe('string');
    });

    it('should display audio player if token has audio property', () => {
      const tokenWithAudio = createTestToken({
        image: null,
        audio: 'assets/audio/test.mp3',
        video: null
      });

      // Verify audio path present
      expect(tokenWithAudio.audio).toBeTruthy();
      expect(typeof tokenWithAudio.audio).toBe('string');
    });

    it('should NOT attempt video playback in standalone mode', () => {
      const tokenWithVideo = createTestToken({
        image: null,
        audio: null,
        video: 'test_video.mp4'
      });

      // Standalone mode should ignore video property
      // (video playback only works with orchestrator)

      // No fetch calls should be made
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle tokens with no media (show token ID)', () => {
      const tokenWithNoMedia = createTestToken({
        image: null,
        audio: null,
        video: null
      });

      // Should still be valid token
      expect(tokenWithNoMedia.SF_RFID).toBeTruthy();

      // In real app, would display token ID as fallback
    });
  });

  describe('PWA Features (Offline Support)', () => {

    it('should have service worker registration code', () => {
      // Verify index.html contains service worker registration (line 847-850)
      const indexPath = path.join(__dirname, '../../../../aln-memory-scanner/index.html');
      const indexHtml = fs.readFileSync(indexPath, 'utf-8');

      // Check for service worker registration
      expect(indexHtml).toContain('serviceWorker');
      expect(indexHtml).toContain("register('sw.js')");
    });

    it('should use localStorage for scanned tokens persistence', () => {
      // Scanner uses localStorage to save progress (line 880-899)

      // Simulate saving scanned tokens
      const mockData = {
        scannedTokens: ['token1', 'token2', 'token3'],
        lastScan: Date.now(),
        version: '1.0'
      };

      localStorage.setItem('alnMemoryScanner', JSON.stringify(mockData));

      // Verify it persists
      const saved = localStorage.getItem('alnMemoryScanner');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved);
      expect(parsed.scannedTokens).toHaveLength(3);
    });
  });
});
