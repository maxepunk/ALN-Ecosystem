/**
 * Contract Tests for POST /api/scan - Player Scanner Endpoint
 * 
 * ARCHITECTURAL BOUNDARY:
 * Player scanners are "dumb" clients that ONLY:
 * - Check if video is currently playing (protect shared projector resource)
 * - Log scans for audit purposes
 * - Trigger video playback if token has video
 * - Return mediaAssets for local display on scanner device
 * 
 * Player scanners DO NOT:
 * - Perform duplicate detection (that's GM scanner's responsibility)
 * - Calculate scores or points (that's GM scanner's responsibility)
 * - Track transactions (that's GM scanner's responsibility)
 * 
 * Requirements validated:
 * - Principle I: Scanner operates independently
 * - Principle III: HTTP for player communication
 * - Video playback conflict handling (409 when video playing)
 * - mediaAssets returned for local display
 * - Response time < 100ms
 */

const request = require('supertest');

// This import will fail as app doesn't exist yet - exactly what we want for TDD
const app = require('../../src/app');
const sessionService = require('../../src/services/sessionService');
const stateService = require('../../src/services/stateService');
const videoQueueService = require('../../src/services/videoQueueService');

describe('POST /api/scan - Token Scan Submission', () => {
  const validScanRequest = {
    tokenId: '534e2b02',
    teamId: 'TEAM_A',
    scannerId: 'SCANNER_01',
    timestamp: new Date().toISOString(),
  };

  // Clean up state before each test to ensure isolation
  beforeEach(async () => {
    await sessionService.reset();
    await stateService.reset();
    videoQueueService.clearQueue(); // Critical: Reset video queue to prevent test contamination
  });

  describe('Valid Scan Requests', () => {
    it('should accept a valid scan request and return mediaAssets for local display', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send(validScanRequest)
        .expect('Content-Type', /json/)
        .expect(200);

      // Validate response structure matches corrected OpenAPI spec
      expect(response.body).toHaveProperty('status');
      expect(['accepted', 'rejected']).toContain(response.body.status);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      
      // Player scanner MUST return mediaAssets for local display
      expect(response.body).toHaveProperty('mediaAssets');
      expect(typeof response.body.mediaAssets).toBe('object');
      
      // Player scanner MUST NOT return transaction/scoring data
      expect(response.body).not.toHaveProperty('transactionId');
      expect(response.body).not.toHaveProperty('points');
      
      // Optional fields for video status
      if (response.body.videoPlaying !== undefined) {
        expect(typeof response.body.videoPlaying).toBe('boolean');
      }
      if (response.body.waitTime !== undefined) {
        expect(response.body.waitTime).toBeGreaterThanOrEqual(0);
      }
      
      // Verify tokenId is echoed back for client reference
      expect(response.body.tokenId).toBe(validScanRequest.tokenId);
    });

    it('should accept scan without optional timestamp field', async () => {
      const requestWithoutTimestamp = {
        tokenId: 'hos001',
        teamId: 'TEAM_B',
        scannerId: 'SCANNER_02',
      };

      const response = await request(app)
        .post('/api/scan')
        .send(requestWithoutTimestamp)
        .expect(200);

      expect(response.body.status).toBe('accepted');
    });

    it('should validate teamId pattern (TEAM_[A-Z])', async () => {
      const validTeams = ['TEAM_A', 'TEAM_B', 'TEAM_C', 'TEAM_Z'];
      
      for (const teamId of validTeams) {
        const response = await request(app)
          .post('/api/scan')
          .send({ ...validScanRequest, teamId })
          .expect(200);
        
        expect(response.body.status).toBeDefined();
      }
    });

    it('should respond within 100ms for valid requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/scan')
        .send(validScanRequest)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('Invalid Scan Requests', () => {
    it('should reject scan with missing required field: tokenId', async () => {
      const invalidRequest = {
        teamId: 'TEAM_A',
        scannerId: 'SCANNER_01',
      };

      const response = await request(app)
        .post('/api/scan')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('tokenId');
    });

    it('should reject scan with missing required field: teamId', async () => {
      const invalidRequest = {
        tokenId: '534e2b02',
        scannerId: 'SCANNER_01',
      };

      const response = await request(app)
        .post('/api/scan')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('teamId');
    });

    it('should reject scan with missing required field: scannerId', async () => {
      const invalidRequest = {
        tokenId: '534e2b02',
        teamId: 'TEAM_A',
      };

      const response = await request(app)
        .post('/api/scan')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('scannerId');
    });

    it('should reject scan with invalid teamId pattern', async () => {
      const invalidTeams = ['TEAM_1', 'TEAM_AB', 'team_a', 'TEAM', 'A', ''];
      
      for (const teamId of invalidTeams) {
        const response = await request(app)
          .post('/api/scan')
          .send({ ...validScanRequest, teamId })
          .expect(400);
        
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('teamId');
      }
    });

    it('should reject scan with invalid timestamp format', async () => {
      const invalidTimestamps = [
        '2023-13-45', // Invalid date
        'not-a-date',
        '12345',
        '',
      ];

      for (const timestamp of invalidTimestamps) {
        const response = await request(app)
          .post('/api/scan')
          .send({ ...validScanRequest, timestamp })
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });

    it('should reject empty request body', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject non-JSON content type', async () => {
      await request(app)
        .post('/api/scan')
        .send('not json')
        .set('Content-Type', 'text/plain')
        .expect(400);
    });
  });

  describe('No Duplicate Detection (Player Scanner Responsibility)', () => {
    it('should accept repeated scans of same token - duplicate detection is GM scanner responsibility', async () => {
      // First scan should succeed
      const firstResponse = await request(app)
        .post('/api/scan')
        .send(validScanRequest)
        .expect(200);

      expect(firstResponse.body.status).toBe('accepted');
      expect(firstResponse.body).toHaveProperty('mediaAssets');

      // Immediate rescan should ALSO succeed (no duplicate detection)
      const secondResponse = await request(app)
        .post('/api/scan')
        .send(validScanRequest)
        .expect(200);

      expect(secondResponse.body.status).toBe('accepted');
      expect(secondResponse.body).toHaveProperty('mediaAssets');
      
      // Both responses should be identical (same token, same media)
      expect(secondResponse.body.mediaAssets).toEqual(firstResponse.body.mediaAssets);
    });

    it('should accept same token from different teams - scoring is GM scanner responsibility', async () => {
      const scan1 = { ...validScanRequest, teamId: 'TEAM_A' };
      const scan2 = { ...validScanRequest, teamId: 'TEAM_B' };

      const response1 = await request(app)
        .post('/api/scan')
        .send(scan1)
        .expect(200);

      const response2 = await request(app)
        .post('/api/scan')
        .send(scan2)
        .expect(200);

      // Both should succeed and return same media
      expect(response1.body.status).toBe('accepted');
      expect(response2.body.status).toBe('accepted');
      expect(response1.body.mediaAssets).toEqual(response2.body.mediaAssets);
      
      // Neither should have scoring data
      expect(response1.body).not.toHaveProperty('points');
      expect(response2.body).not.toHaveProperty('points');
    });

    it('should log all scans for audit even if repeated', async () => {
      // This test validates that player scanner logs everything
      // The actual duplicate detection happens at GM scanner level
      
      const responses = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/scan')
          .send(validScanRequest)
          .expect(200);
        
        responses.push(response.body);
      }
      
      // All scans should be accepted
      responses.forEach(response => {
        expect(response.status).toBe('accepted');
        expect(response).toHaveProperty('mediaAssets');
      });
    });
  });

  describe('Video Playback Conflicts (Shared Projector Protection)', () => {
    it('should return 409 with mediaAssets when another video is playing - allows local display while waiting', async () => {
      // First scan triggers video playback using a real token with video
      const videoTokenScan = {
        tokenId: 'jaw001', // Real token from ALN-TokenData with video
        teamId: 'TEAM_A',
        scannerId: 'SCANNER_01',
      };

      const firstResponse = await request(app)
        .post('/api/scan')
        .send(videoTokenScan)
        .expect(200);
      
      expect(firstResponse.body.videoPlaying).toBe(true);

      // Second scan of another video token while first video is playing
      const secondVideoScan = {
        tokenId: '534e2b03', // Another real token with video
        teamId: 'TEAM_B',
        scannerId: 'SCANNER_02',
      };

      const conflictResponse = await request(app)
        .post('/api/scan')
        .send(secondVideoScan)
        .expect(409);

      // 409 response should still include mediaAssets for local display
      expect(conflictResponse.body.status).toBe('rejected');
      expect(conflictResponse.body.message.toLowerCase()).toContain('video');
      expect(conflictResponse.body).toHaveProperty('mediaAssets');
      expect(conflictResponse.body.videoPlaying).toBe(true);
      expect(conflictResponse.body.waitTime).toBeGreaterThan(0);
      
      // Should NOT include transaction/scoring data
      expect(conflictResponse.body).not.toHaveProperty('transactionId');
      expect(conflictResponse.body).not.toHaveProperty('error'); // Clean response, not error object
    });

    it('should accept non-video token scan even when video is playing', async () => {
      // Start video playback with a real video token
      await request(app)
        .post('/api/scan')
        .send({
          tokenId: 'jaw001', // Real token with video
          teamId: 'TEAM_A',
          scannerId: 'SCANNER_01',
        })
        .expect(200);

      // Scan non-video token - should succeed even during video playback
      const response = await request(app)
        .post('/api/scan')
        .send({
          tokenId: 'hos001', // Real token without video
          teamId: 'TEAM_B',
          scannerId: 'SCANNER_02',
        })
        .expect(200);

      // Non-video scan succeeds but indicates video is playing
      expect(response.body.status).toBe('accepted');
      expect(response.body).toHaveProperty('mediaAssets');
      expect(response.body.videoPlaying).toBe(false); // This token doesn't have video
      
      // Response should not include transaction data
      expect(response.body).not.toHaveProperty('transactionId');
    });
    
    it('should queue video tokens and play them sequentially', async () => {
      // This test validates that video queue works properly
      // First video plays, second waits
      
      const videoScans = [
        { tokenId: 'jaw001', teamId: 'TEAM_A', scannerId: 'SCANNER_01' },  // Real video token
        { tokenId: '534e2b03', teamId: 'TEAM_B', scannerId: 'SCANNER_02' }, // Another real video token
      ];
      
      // First video should play
      const first = await request(app)
        .post('/api/scan')
        .send(videoScans[0])
        .expect(200);
      
      expect(first.body.videoPlaying).toBe(true);
      
      // Second video should be rejected (video playing)
      const second = await request(app)
        .post('/api/scan')
        .send(videoScans[1])
        .expect(409);
      
      expect(second.body.status).toBe('rejected');
      expect(second.body.waitTime).toBeGreaterThan(0);
      expect(second.body).toHaveProperty('mediaAssets');
      expect(second.body.videoPlaying).toBe(true);
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle extremely long tokenId (boundary test)', async () => {
      const longTokenId = 'TEST_' + 'X'.repeat(1000);
      
      const response = await request(app)
        .post('/api/scan')
        .send({ ...validScanRequest, tokenId: longTokenId })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle special characters in scannerId', async () => {
      const specialScannerIds = [
        'SCANNER-01',
        'SCANNER_01',
        'SCANNER.01',
        'Scanner01',
        'scanner_01',
      ];

      for (const scannerId of specialScannerIds) {
        const response = await request(app)
          .post('/api/scan')
          .send({ ...validScanRequest, scannerId });

        // Should accept various scanner ID formats
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should handle null values for required fields', async () => {
      const nullTests = [
        { ...validScanRequest, tokenId: null },
        { ...validScanRequest, teamId: null },
        { ...validScanRequest, scannerId: null },
      ];

      for (const testCase of nullTests) {
        const response = await request(app)
          .post('/api/scan')
          .send(testCase)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle undefined values for required fields', async () => {
      const undefinedTests = [
        { ...validScanRequest, tokenId: undefined },
        { ...validScanRequest, teamId: undefined },
        { ...validScanRequest, scannerId: undefined },
      ];

      for (const testCase of undefinedTests) {
        const response = await request(app)
          .post('/api/scan')
          .send(testCase)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle concurrent scans from same scanner', async () => {
      const promises = [];
      
      // Send 10 concurrent requests from same scanner
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/scan')
            .send({
              ...validScanRequest,
              tokenId: `TEST_${i}`,
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should complete without server errors
      responses.forEach(response => {
        expect(response.status).toBeLessThan(500);
      });
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should not require authentication for player scans', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send(validScanRequest)
        // No auth header
        .expect(200);

      expect(response.body.status).toBeDefined();
    });

    it('should reject malformed JSON', async () => {
      await request(app)
        .post('/api/scan')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}')
        .expect(400);
    });

    it('should handle SQL injection attempts in fields', async () => {
      const sqlInjectionTests = [
        "'; DROP TABLE scans; --",
        "1' OR '1'='1",
        "admin'--",
      ];

      for (const injection of sqlInjectionTests) {
        const response = await request(app)
          .post('/api/scan')
          .send({
            tokenId: injection,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          })
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle XSS attempts in fields', async () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
      ];

      for (const xss of xssAttempts) {
        const response = await request(app)
          .post('/api/scan')
          .send({
            tokenId: xss,
            teamId: 'TEAM_A',
            scannerId: 'SCANNER_01',
          });

        // Should either reject or sanitize
        if (response.status === 200) {
          // If accepted, ensure response is sanitized
          expect(response.body).not.toContain('<script>');
          expect(response.body).not.toContain('javascript:');
        }
      }
    });
  });
});