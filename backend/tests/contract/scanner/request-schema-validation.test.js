/**
 * Scanner Request Schema Validation
 *
 * Validates that scanner payloads (both ESP32 and PWA) conform to the
 * OpenAPI request body schema. Uses AJV compilation against the actual
 * openapi.yaml spec — catches schema drift that manual field checks miss.
 *
 * Canonical payloads match the output of:
 * - ESP32: PayloadBuilder.buildScanJson() / buildBatchJson()
 * - PWA: OrchestratorIntegration.scanToken() / processOfflineQueue()
 */

const { validateHTTPRequest, getHTTPRequestSchema } = require('../../helpers/contract-validator');

describe('Scanner Request Schema Validation', () => {

  describe('POST /api/scan — Single Scan Request', () => {

    test('ESP32 scan payload (all fields) passes schema validation', () => {
      const payload = {
        tokenId: 'kaa001',
        teamId: '001',
        deviceId: 'SCANNER_001',
        deviceType: 'esp32',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('ESP32 scan payload (no teamId) passes schema validation', () => {
      const payload = {
        tokenId: 'kaa001',
        deviceId: 'SCANNER_001',
        deviceType: 'esp32',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('PWA player scan payload (all fields) passes schema validation', () => {
      const payload = {
        tokenId: 'kaa001',
        teamId: 'Team Alpha',
        deviceId: 'PLAYER_1234567890',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    test('PWA player scan payload (no teamId) passes schema validation', () => {
      const payload = {
        tokenId: 'test_001',
        deviceId: 'PLAYER_1234567890',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).not.toThrow();
    });

    // --- Schema enforcement ---

    test('rejects missing tokenId', () => {
      const payload = {
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/tokenId/);
    });

    test('rejects missing deviceId', () => {
      const payload = {
        tokenId: 'tok',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/deviceId/);
    });

    test('rejects missing deviceType', () => {
      const payload = {
        tokenId: 'tok',
        deviceId: 'dev',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow(/deviceType/);
    });

    test('rejects invalid deviceType enum value', () => {
      const payload = {
        tokenId: 'tok',
        deviceId: 'dev',
        deviceType: 'gm',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow();
    });

    test('rejects empty tokenId', () => {
      const payload = {
        tokenId: '',
        deviceId: 'dev',
        deviceType: 'player',
        timestamp: '2026-04-01T12:00:00.000Z'
      };

      expect(() => validateHTTPRequest(payload, '/api/scan', 'post')).toThrow();
    });

    test('request schema has expected required fields', () => {
      const schema = getHTTPRequestSchema('/api/scan', 'post');
      expect(schema.required).toEqual(
        expect.arrayContaining(['tokenId', 'deviceId', 'deviceType'])
      );
    });

    test('request schema allows player and esp32 deviceTypes', () => {
      const schema = getHTTPRequestSchema('/api/scan', 'post');
      expect(schema.properties.deviceType.enum).toEqual(['player', 'esp32']);
    });
  });

  describe('POST /api/scan/batch — Batch Request', () => {

    test('ESP32 batch payload passes schema validation', () => {
      const payload = {
        batchId: 'SCANNER_001_0',
        transactions: [
          {
            tokenId: 'kaa001',
            teamId: '001',
            deviceId: 'SCANNER_001',
            deviceType: 'esp32',
            timestamp: '2026-04-01T12:00:00.000Z'
          },
          {
            tokenId: 'jaw002',
            deviceId: 'SCANNER_001',
            deviceType: 'esp32',
            timestamp: '2026-04-01T12:01:00.000Z'
          }
        ]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });

    test('PWA batch payload passes schema validation', () => {
      const payload = {
        batchId: 'a3f4b2c1-5678-90ab-cdef-1234567890ab',
        transactions: [
          {
            tokenId: 'token1',
            teamId: 'Team Alpha',
            deviceId: 'PLAYER_1234567890',
            deviceType: 'player',
            timestamp: '2026-04-01T12:00:00.000Z'
          }
        ]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });

    test('rejects missing batchId', () => {
      const payload = {
        transactions: [{ tokenId: 'tok', deviceId: 'dev', deviceType: 'player' }]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow(/batchId/);
    });

    test('rejects missing transactions', () => {
      const payload = { batchId: 'batch_1' };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow(/transactions/);
    });

    test('rejects transaction missing required deviceType', () => {
      const payload = {
        batchId: 'batch_1',
        transactions: [{ tokenId: 'tok', deviceId: 'dev' }]
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).toThrow();
    });

    test('accepts empty transactions array', () => {
      const payload = {
        batchId: 'batch_1',
        transactions: []
      };

      expect(() => validateHTTPRequest(payload, '/api/scan/batch', 'post')).not.toThrow();
    });
  });
});
