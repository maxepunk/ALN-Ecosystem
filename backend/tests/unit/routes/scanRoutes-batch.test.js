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

    transactionService.tokens.set('kaa001', token1);
    transactionService.tokens.set('kaa002', token2);
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha', timestamp: new Date().toISOString() },
            { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha', timestamp: new Date().toISOString() }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'invalid-token', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'bad-token', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
          { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
          { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' },
          { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'nonexistent-token', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'bad', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'kaa002', deviceId: 'GM_001', teamId: 'Team Alpha' },
            { tokenId: 'also-bad', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
            { tokenId: 'kaa001', deviceId: 'GM_001', teamId: 'Team Alpha' }
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
});
