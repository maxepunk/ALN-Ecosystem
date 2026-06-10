/**
 * Scan Routes - Batch Endpoint Tests
 * Phase 1.2 (P0.2): Offline Queue Acknowledgment with Idempotency
 */

const request = require('supertest');
const express = require('express');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const { resetAllServices } = require('../../helpers/service-reset');
const Token = require('../../../src/models/token');

describe('POST /api/scan/batch - Phase 1.2 (P0.2)', () => {
  let app, io;

  beforeEach(async () => {
    // Reset all services
    await resetAllServices();

    // Setup Express app with Socket.io mock
    app = express();
    app.use(express.json());

    // Mock Socket.io
    const mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    io = mockIo;
    app.locals.io = io;

    // Mount routes
    const scanRoutes = require('../../../src/routes/scanRoutes');
    app.use('/api/scan', scanRoutes);

    // Create session
    await sessionService.createSession({
      name: 'Test Session',
      teams: ['Team Alpha', 'Detectives']
    });

    // Initialize tokens
    const token1 = new Token({
      id: 'kaa001',
      name: 'Test Memory 1',
      value: 100,
      memoryType: 'Technical',
      mediaAssets: { image: null, audio: null, video: null, processingImage: null },
      metadata: { rfid: 'kaa001', rating: 3 }
    });

    const token2 = new Token({
      id: 'kaa002',
      name: 'Test Memory 2',
      value: 150,
      memoryType: 'Business',
      mediaAssets: { image: null, audio: null, video: null, processingImage: null },
      metadata: { rfid: 'kaa002', rating: 4 }
    });

    const videoToken = new Token({
      id: 'vid001',
      name: 'Test Video Memory',
      value: 200,
      memoryType: 'Personal',
      mediaAssets: { image: null, audio: null, video: 'vid001.mp4', processingImage: null },
      metadata: { rfid: 'vid001', rating: 5 }
    });

    transactionService.tokens.set('kaa001', token1);
    transactionService.tokens.set('kaa002', token2);
    transactionService.tokens.set('vid001', videoToken);
  });

  afterEach(async () => {
    if (sessionService.currentSession) {
      await sessionService.endSession();
    }
    sessionService.removeAllListeners();
    transactionService.removeAllListeners();
  });

  describe('batchId validation', () => {
    test('should require batchId parameter', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          // Missing batchId
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('batchId is required');
    });

    test('should accept valid batchId', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'test-batch-123',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.batchId).toBe('test-batch-123');
    });
  });

  describe('batch processing', () => {
    test('should process all transactions in batch', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-001',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha', timestamp: new Date().toISOString() },
            { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha', timestamp: new Date().toISOString() }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.batchId).toBe('batch-001');
      expect(response.body.totalCount).toBe(2);
      expect(response.body.processedCount).toBe(2);
      expect(response.body.failedCount).toBe(0);
      expect(response.body.results).toHaveLength(2);
    });

    test('should include batchId in response', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-with-id',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('batchId', 'batch-with-id');
      expect(response.body).toHaveProperty('processedCount');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('failedCount');
      expect(response.body).toHaveProperty('results');
    });

    test('should count successful and failed transactions correctly', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-002',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'invalid-token', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(3);
      expect(response.body.processedCount).toBe(2);
      expect(response.body.failedCount).toBe(1);
    });
  });

  describe('batch:ack event emission', () => {
    test('should emit batch:ack event after processing', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-ack-test',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);

      // Verify Socket.io emit was called
      expect(io.to).toHaveBeenCalledWith('device:GM_001');
      expect(io.emit).toHaveBeenCalledWith(
        'batch:ack',
        expect.objectContaining({
          event: 'batch:ack',
          data: expect.objectContaining({
            batchId: 'batch-ack-test',
            processedCount: 1,
            totalCount: 1,
            failedCount: 0
          }),
          timestamp: expect.any(String)
        })
      );
    });

    test('should include failure details in batch:ack', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-with-failures',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'bad-token', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);

      // Check emit call for failure details
      expect(io.emit).toHaveBeenCalledWith(
        'batch:ack',
        expect.objectContaining({
          data: expect.objectContaining({
            failedCount: 1,
            failures: expect.arrayContaining([
              expect.objectContaining({
                tokenId: 'bad-token',
                error: expect.any(String)
              })
            ])
          })
        })
      );
    });
  });

  describe('idempotency (duplicate batchId)', () => {
    test('should return cached result for duplicate batchId', async () => {
      const batchData = {
        batchId: 'idempotent-batch',
        transactions: [
          { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
        ]
      };

      // First request
      const response1 = await request(app)
        .post('/api/scan/batch')
        .send(batchData);

      expect(response1.status).toBe(200);
      expect(response1.body.processedCount).toBe(1);
      const firstResult = response1.body;

      // Second request with SAME batchId
      const response2 = await request(app)
        .post('/api/scan/batch')
        .send(batchData);

      expect(response2.status).toBe(200);
      expect(response2.body).toEqual(firstResult);

      // Should return exact same result
      expect(response2.body.batchId).toBe('idempotent-batch');
      expect(response2.body.processedCount).toBe(1);
      expect(response2.body.results).toEqual(firstResult.results);
    });

    test('should not reprocess transactions for duplicate batchId', async () => {
      const batchData = {
        batchId: 'no-reprocess',
        transactions: [
          { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
          { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
        ]
      };

      // Process once
      const response1 = await request(app)
        .post('/api/scan/batch')
        .send(batchData);

      expect(response1.status).toBe(200);
      expect(response1.body.processedCount).toBe(2);

      // Clear emit mock to track second call
      io.emit.mockClear();

      // Try again with same batchId
      const response2 = await request(app)
        .post('/api/scan/batch')
        .send(batchData);

      expect(response2.status).toBe(200);

      // Socket.io emit should NOT be called for cached results
      // (batch:ack already emitted in first request)
      expect(io.emit).not.toHaveBeenCalled();

      // But the response should be identical
      expect(response2.body).toEqual(response1.body);
    });

    test('should allow different batchId to process normally', async () => {
      // First batch
      const response1 = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-A',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response1.status).toBe(200);
      expect(response1.body.batchId).toBe('batch-A');

      // Second batch with DIFFERENT batchId
      const response2 = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-B',
          transactions: [
            { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response2.status).toBe(200);
      expect(response2.body.batchId).toBe('batch-B');

      // Both should have processed successfully
      expect(response1.body.processedCount).toBe(1);
      expect(response2.body.processedCount).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should handle invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-invalid-token',
          transactions: [
            { tokenId: 'nonexistent-token', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.processedCount).toBe(0);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.results[0].status).toBe('failed');
      expect(response.body.results[0].error).toContain('Token not recognized');
    });

    test('should handle mixed success and failure', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-mixed',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'bad', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' },
            { tokenId: 'also-bad', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.totalCount).toBe(4);
      expect(response.body.processedCount).toBe(2);
      expect(response.body.failedCount).toBe(2);
    });

    test('should validate transactions array', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-no-array',
          transactions: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Transactions must be an array');
    });
  });

  describe('response structure', () => {
    test('should include all required fields in response', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'complete-response',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'player', teamId: 'Team Alpha' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        batchId: expect.any(String),
        processedCount: expect.any(Number),
        totalCount: expect.any(Number),
        failedCount: expect.any(Number),
        results: expect.any(Array)
      });
    });
  });

  // Decision A4 (2026-06-09): replayed scans NEVER trigger video playback.
  // If video was unavailable at scan time, the player is alerted at scan time;
  // a drained offline queue must not start playback hours later (F-SCAN-05).
  describe('video tokens in batch replay (A4)', () => {
    let addToQueueSpy;

    beforeEach(() => {
      const videoQueueService = require('../../../src/services/videoQueueService');
      addToQueueSpy = jest.spyOn(videoQueueService, 'addToQueue').mockImplementation(() => {});

      // VLC healthy — even with video available, batch must never queue
      const registry = require('../../../src/services/serviceHealthRegistry');
      registry.report('vlc', 'healthy', 'Batch A4 test');
    });

    afterEach(() => {
      addToQueueSpy.mockRestore();
    });

    test('never queues videos for batch-replayed scans (with session)', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-a4-video',
          transactions: [
            { tokenId: 'vid001', deviceId: 'PLAYER_01', deviceType: 'player', timestamp: new Date().toISOString() }
          ]
        });

      expect(response.status).toBe(200);
      expect(addToQueueSpy).not.toHaveBeenCalled();
      expect(response.body.results[0].status).toBe('processed');
      expect(response.body.results[0].videoQueued).toBe(false);
    });

    test('never queues videos for batch-replayed scans (no session)', async () => {
      await sessionService.endSession();

      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'batch-a4-video-nosession',
          transactions: [
            { tokenId: 'vid001', deviceId: 'PLAYER_01', deviceType: 'player', timestamp: new Date().toISOString() }
          ]
        });

      expect(response.status).toBe(200);
      expect(addToQueueSpy).not.toHaveBeenCalled();
      expect(response.body.results[0].videoQueued).toBe(false);
    });
  });

  // F-SCAN-14: each batch entry is validated against playerScanRequestSchema
  // (same schema as POST /api/scan). Invalid entries become failed results
  // and are NOT persisted; the rest of the batch still processes.
  describe('per-item validation (F-SCAN-14)', () => {
    test('entry missing deviceType fails validation and is not persisted', async () => {
      const before = sessionService.currentSession.playerScans.length;

      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'f-scan-14-no-devicetype',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'PLAYER_01' }  // missing deviceType
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.processedCount).toBe(0);
      expect(response.body.results[0].status).toBe('failed');
      expect(response.body.results[0].error).toMatch(/deviceType/);
      expect(sessionService.currentSession.playerScans.length).toBe(before);
    });

    test('entry with invalid deviceType (gm) fails validation', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'f-scan-14-gm-devicetype',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'GM_001', deviceType: 'gm' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.results[0].status).toBe('failed');
    });

    test('entry with malformed timestamp fails validation', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'f-scan-14-bad-timestamp',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'PLAYER_01', deviceType: 'player', timestamp: 'not-a-date' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.results[0].status).toBe('failed');
    });

    test('non-object entry fails gracefully without crashing the batch', async () => {
      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'f-scan-14-non-object',
          transactions: [
            'just-a-string',
            { tokenId: 'kaa001', deviceId: 'PLAYER_01', deviceType: 'player' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.failedCount).toBe(1);
      expect(response.body.processedCount).toBe(1);
      expect(response.body.results[0].status).toBe('failed');
      expect(response.body.results[0].tokenId).toBeNull();
      expect(response.body.results[1].status).toBe('processed');
    });

    test('valid entries still process alongside invalid ones', async () => {
      const before = sessionService.currentSession.playerScans.length;

      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'f-scan-14-mixed',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'PLAYER_01', deviceType: 'player', timestamp: new Date().toISOString() },
            { tokenId: 'kaa002', deviceId: 'PLAYER_01' }  // missing deviceType
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.processedCount).toBe(1);
      expect(response.body.failedCount).toBe(1);

      const after = sessionService.currentSession.playerScans;
      expect(after.length).toBe(before + 1);
      expect(after[before].tokenId).toBe('kaa001');
    });

    // ESP32 scans taken before SNTP sync are stamped 1970-01-01 + uptime
    // (Application.h generateTimestamp pre-sync branch). Persisting them
    // verbatim corrupts session timelines and post-session analysis, so
    // they are rejected as failed results (F-SCAN-14).
    describe('pre-sync (1970-epoch) timestamps', () => {
      test('entry with 1970 timestamp is rejected as failed and not persisted', async () => {
        const before = sessionService.currentSession.playerScans.length;

        const response = await request(app)
          .post('/api/scan/batch')
          .send({
            batchId: 'f-scan-14-epoch',
            transactions: [
              { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32', timestamp: '1970-01-01T02:13:44.000Z' }
            ]
          });

        expect(response.status).toBe(200);
        expect(response.body.failedCount).toBe(1);
        expect(response.body.processedCount).toBe(0);
        expect(response.body.results[0].status).toBe('failed');
        expect(response.body.results[0].error).toMatch(/timestamp|clock/i);
        expect(sessionService.currentSession.playerScans.length).toBe(before);
      });

      test('mixed batch: epoch entry fails, synced entry persists', async () => {
        const before = sessionService.currentSession.playerScans.length;

        const response = await request(app)
          .post('/api/scan/batch')
          .send({
            batchId: 'f-scan-14-epoch-mixed',
            transactions: [
              { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32', timestamp: '1970-01-01T00:42:00.000Z' },
              { tokenId: 'kaa002', deviceId: 'SCANNER_001', deviceType: 'esp32', timestamp: new Date().toISOString() }
            ]
          });

        expect(response.body.processedCount).toBe(1);
        expect(response.body.failedCount).toBe(1);

        const after = sessionService.currentSession.playerScans;
        expect(after.length).toBe(before + 1);
        expect(after[before].tokenId).toBe('kaa002');
      });

      test('entry without timestamp is still accepted (server assigns now)', async () => {
        const response = await request(app)
          .post('/api/scan/batch')
          .send({
            batchId: 'f-scan-14-no-timestamp',
            transactions: [
              { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32' }
            ]
          });

        expect(response.body.processedCount).toBe(1);
        expect(response.body.failedCount).toBe(0);
      });
    });
  });

  describe('session.playerScans persistence', () => {
    test('persists each valid entry to session.playerScans', async () => {
      const before = sessionService.currentSession.playerScans.length;

      await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'persist-multi',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32', timestamp: '2026-04-16T23:10:00.000-07:00' },
            { tokenId: 'kaa002', deviceId: 'SCANNER_001', deviceType: 'esp32', timestamp: '2026-04-16T23:10:05.000-07:00' }
          ]
        });

      const after = sessionService.currentSession.playerScans;
      expect(after.length).toBe(before + 2);
      expect(after[before].tokenId).toBe('kaa001');
      expect(after[before].deviceType).toBe('esp32');
      // F-SCAN-14: per-item Joi validation normalizes timestamps to UTC ISO
      // (same instant; same behavior as the single-scan endpoint)
      expect(after[before].timestamp).toBe('2026-04-17T06:10:00.000Z');
      expect(after[before + 1].tokenId).toBe('kaa002');
    });

    test('skips persistence for unknown tokens but persists valid ones in mixed batch', async () => {
      const before = sessionService.currentSession.playerScans.length;

      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'persist-mixed',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32' },
            { tokenId: 'UNKNOWN_XYZ', deviceId: 'SCANNER_001', deviceType: 'esp32' }
          ]
        });

      expect(response.body.processedCount).toBe(1);
      expect(response.body.failedCount).toBe(1);

      const after = sessionService.currentSession.playerScans;
      expect(after.length).toBe(before + 1);
      expect(after[before].tokenId).toBe('kaa001');
      expect(after.some(ps => ps.tokenId === 'UNKNOWN_XYZ')).toBe(false);
    });

    test('when no active session, returns 200 without persisting', async () => {
      await sessionService.endSession();

      const response = await request(app)
        .post('/api/scan/batch')
        .send({
          batchId: 'persist-no-session',
          transactions: [
            { tokenId: 'kaa001', deviceId: 'SCANNER_001', deviceType: 'esp32' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.processedCount).toBe(1);
      expect(sessionService.currentSession).toBeNull();
    });
  });
});
