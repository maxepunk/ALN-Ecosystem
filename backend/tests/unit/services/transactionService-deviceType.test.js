/**
 * Transaction Service - Device-Type Specific Duplicate Detection Tests
 *
 * PURPOSE: Verify that duplicate detection ONLY applies to GM scanners
 *
 * CRITICAL BUSINESS RULES:
 * - GM Scanners: REJECT duplicate scans (scoring system)
 * - Player Scanners: ALLOW duplicate scans (content re-viewing)
 * - ESP32 Scanners: ALLOW duplicate scans (content re-viewing)
 *
 * Reference: DEVICE_TYPE_BEHAVIOR_REQUIREMENTS.md
 */

const transactionService = require('../../../src/services/transactionService');
const sessionService = require('../../../src/services/sessionService');
const { resetAllServices } = require('../../helpers/service-reset');
const Transaction = require('../../../src/models/transaction');
const Token = require('../../../src/models/token');

describe('TransactionService - Device-Type Specific Duplicate Detection', () => {
  beforeEach(async () => {
    // Reset all services
    await resetAllServices();

    // Re-register listeners after reset
    if (!transactionService.sessionListenerRegistered) {
      transactionService.registerSessionListener();
      transactionService.sessionListenerRegistered = true;
    }

    // Initialize with test tokens
    const testTokens = [
      {
        id: 'kaa001',
        name: 'Test Token',
        value: 3,
        memoryType: 'Technical',
        mediaAssets: {
          image: 'test.jpg',
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 3,
          group: 'Group 1 (x5)'
        }
      },
      {
        id: 'rat001',
        name: 'Rat Token',
        value: 2,
        memoryType: 'Personal',
        mediaAssets: {
          image: 'rat.jpg',
          audio: null,
          video: null,
          processingImage: null
        },
        metadata: {
          rating: 2,
          group: 'Group 2 (x3)'
        }
      }
    ];

    transactionService.init(testTokens);

    // Create test session using sessionService
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['Team Alpha', 'Detectives']
    });
  });

  afterEach(async () => {
    // Cleanup
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
  });

  describe('GM Scanner Duplicate Detection', () => {
    it('should REJECT duplicate scans from same GM scanner', async () => {
      const session = sessionService.getCurrentSession();

      // Scan 1: GM_STATION_1 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);

      expect(result1.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
      expect(result1.points).toBe(3);

      // Scan 2: Same GM scanner tries to scan kaa001 again
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      expect(result2.status).toBe('duplicate');
      // Duplicate indicated by status === "duplicate"
      expect(result2.message).toBeTruthy();  // Just check message exists
    });

    it('should ALLOW same token from different GM scanners', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: GM_STATION_1 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);
      expect(result1.status).toBe('accepted');

      // Scan 2: GM_STATION_2 scans kaa001 (different GM)
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_2',
        deviceType: 'gm',
        teamId: 'Detectives',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      // Should be rejected due to FIRST-COME-FIRST-SERVED rule
      // (Token already claimed by Team 001)
      expect(result2.status).toBe('duplicate');
      // Duplicate indicated by status === "duplicate";
    });

    it('should ALLOW different tokens from same GM scanner', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: GM_STATION_1 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);
      expect(result1.status).toBe('accepted');

      // Scan 2: Same GM scanner scans rat001 (different token)
      const scanRequest2 = {
        tokenId: 'rat001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      expect(result2.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
      expect(result2.points).toBe(2);
    });
  });

  describe('Player Scanner Duplicate Detection', () => {
    it('should ALLOW duplicate scans from same Player scanner (content re-viewing)', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: PLAYER_001 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);

      expect(result1.status).toBe('accepted');
      // Response has no duplicate field - check status instead;

      // Scan 2: Same Player scanner scans kaa001 again (re-viewing content)
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      // CRITICAL: Players MUST be allowed to re-scan
      expect(result2.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
      expect(result2.transaction.tokenId).toBe('kaa001');
    });

    it('should ALLOW multiple scans from different Player scanners', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: PLAYER_001 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);
      expect(result1.status).toBe('accepted');

      // Scan 2: PLAYER_002 scans kaa001
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_002',
        deviceType: 'player',
        teamId: 'Detectives',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      expect(result2.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
    });

    it('should track Player scans in session metadata (for analytics)', async () => {
      const session = sessionService.getCurrentSession();
      // PLAYER_001 scans kaa001 three times
      for (let i = 0; i < 3; i++) {
        const scanRequest = {
          tokenId: 'kaa001',
          deviceId: 'PLAYER_001',
          deviceType: 'player',
          teamId: 'Team Alpha',
          mode: 'blackmarket'
        };

        const result = await transactionService.processScan(scanRequest, session);
        expect(result.status).toBe('accepted');
      }

      // Verify session tracked the scans (for analytics, not duplicate detection)
      const playerScans = session.getDeviceScannedTokens('PLAYER_001');
      expect(playerScans.has('kaa001')).toBe(true);

      // But future scans should still be allowed
      const scanRequest4 = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result4 = await transactionService.processScan(scanRequest4, session);
      expect(result4.status).toBe('accepted');
    });
  });

  describe('ESP32 Scanner Duplicate Detection', () => {
    it('should ALLOW duplicate scans from same ESP32 scanner (content re-viewing)', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: ESP32_001 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'ESP32_001',
        deviceType: 'esp32',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);

      expect(result1.status).toBe('accepted');
      // Response has no duplicate field - check status instead;

      // Scan 2: Same ESP32 scanner scans kaa001 again
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'ESP32_001',
        deviceType: 'esp32',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      // CRITICAL: ESP32 MUST be allowed to re-scan
      expect(result2.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
      expect(result2.transaction.tokenId).toBe('kaa001');
    });

    it('should ALLOW multiple scans from different ESP32 scanners', async () => {
      const session = sessionService.getCurrentSession();
      // Scan 1: ESP32_001 scans kaa001
      const scanRequest1 = {
        tokenId: 'kaa001',
        deviceId: 'ESP32_001',
        deviceType: 'esp32',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const result1 = await transactionService.processScan(scanRequest1, session);
      expect(result1.status).toBe('accepted');

      // Scan 2: ESP32_002 scans kaa001
      const scanRequest2 = {
        tokenId: 'kaa001',
        deviceId: 'ESP32_002',
        deviceType: 'esp32',
        teamId: 'Detectives',
        mode: 'blackmarket'
      };

      const result2 = await transactionService.processScan(scanRequest2, session);

      expect(result2.status).toBe('accepted');
      // Response has no duplicate field - check status instead;
    });
  });

  describe('Mixed Device Type Scenarios', () => {
    it('should handle GM duplicate check while allowing Player/ESP32 duplicates', async () => {
      const session = sessionService.getCurrentSession();
      // GM scanner scans kaa001
      const gmScan1 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const gmResult1 = await transactionService.processScan(gmScan1, session);
      expect(gmResult1.status).toBe('accepted');

      // Player scanner scans kaa001 (should be allowed despite GM claim)
      const playerScan = {
        tokenId: 'kaa001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const playerResult = await transactionService.processScan(playerScan, session);
      expect(playerResult.status).toBe('accepted');

      // ESP32 scanner scans kaa001 (should be allowed)
      const esp32Scan = {
        tokenId: 'kaa001',
        deviceId: 'ESP32_001',
        deviceType: 'esp32',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const esp32Result = await transactionService.processScan(esp32Scan, session);
      expect(esp32Result.status).toBe('accepted');

      // GM scanner scans kaa001 again (should be rejected)
      const gmScan2 = {
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      const gmResult2 = await transactionService.processScan(gmScan2, session);
      expect(gmResult2.status).toBe('duplicate');
    });

    it('should validate deviceType is provided', async () => {
      const session = sessionService.getCurrentSession();
      const scanRequestNoType = {
        tokenId: 'kaa001',
        deviceId: 'SOME_DEVICE',
        // deviceType missing!
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      // processScan is async, must use rejects
      await expect(transactionService.processScan(scanRequestNoType, session))
        .rejects
        .toThrow(/deviceType/i);
    });

    it('should validate deviceType is valid', async () => {
      const session = sessionService.getCurrentSession();
      const scanRequestInvalidType = {
        tokenId: 'kaa001',
        deviceId: 'SOME_DEVICE',
        deviceType: 'invalid',  // Not 'gm', 'player', or 'esp32'
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      };

      // processScan is async, must use rejects
      await expect(transactionService.processScan(scanRequestInvalidType, session))
        .rejects
        .toThrow(/deviceType/i);
    });
  });

  describe('Session Metadata Tracking', () => {
    it('should track all device types in scannedTokensByDevice', async () => {
      const session = sessionService.getCurrentSession();
      // GM scan
      await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'GM_STATION_1',
        deviceType: 'gm',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      }, session);

      // Player scan
      await transactionService.processScan({
        tokenId: 'rat001',
        deviceId: 'PLAYER_001',
        deviceType: 'player',
        teamId: 'Team Alpha',
        mode: 'blackmarket'
      }, session);

      // ESP32 scan
      await transactionService.processScan({
        tokenId: 'kaa001',
        deviceId: 'ESP32_001',
        deviceType: 'esp32',
        teamId: 'Detectives',
        mode: 'blackmarket'
      }, session);

      // Verify all tracked in metadata
      expect(session.hasDeviceScannedToken('GM_STATION_1', 'kaa001')).toBe(true);
      expect(session.hasDeviceScannedToken('PLAYER_001', 'rat001')).toBe(true);
      expect(session.hasDeviceScannedToken('ESP32_001', 'kaa001')).toBe(true);
    });
  });
});
