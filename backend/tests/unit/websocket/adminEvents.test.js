/**
 * adminEvents.js — Core command routing and transaction submission tests.
 *
 * Tests handleGmCommand (auth, routing, ack format, system:reset mutex)
 * and handleTransactionSubmit (envelope, session state, scoring).
 * Environment commands tested separately in adminEvents-envControl.test.js.
 */

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/commandExecutor');
jest.mock('../../../src/services/systemReset');
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/services/transactionService');
jest.mock('../../../src/services/offlineQueueService');
jest.mock('../../../src/services/videoQueueService');
jest.mock('../../../src/services/displayControlService');
jest.mock('../../../src/services/vlcMprisService');
jest.mock('../../../src/services/bluetoothService');
jest.mock('../../../src/services/audioRoutingService');
jest.mock('../../../src/services/lightingService');
jest.mock('../../../src/services/gameClockService');
jest.mock('../../../src/services/cueEngineService');
jest.mock('../../../src/services/soundService');
jest.mock('../../../src/websocket/eventWrapper', () => ({
  emitWrapped: jest.fn()
}));

const { handleGmCommand, handleTransactionSubmit } = require('../../../src/websocket/adminEvents');
const { executeCommand } = require('../../../src/services/commandExecutor');
const { performSystemReset } = require('../../../src/services/systemReset');
const sessionService = require('../../../src/services/sessionService');
const transactionService = require('../../../src/services/transactionService');
const offlineQueueService = require('../../../src/services/offlineQueueService');
const { emitWrapped } = require('../../../src/websocket/eventWrapper');

describe('adminEvents.js', () => {
  let mockSocket;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      id: 'socket-1',
      deviceId: 'gm-001',
      deviceType: 'gm',
    };
    mockIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    executeCommand.mockResolvedValue({ success: true, message: 'OK' });
    performSystemReset.mockResolvedValue(undefined);
    offlineQueueService.isOffline = false;
  });

  describe('handleGmCommand', () => {
    test('rejects unauthenticated socket', async () => {
      mockSocket.deviceType = null;
      mockSocket.deviceId = null;

      await handleGmCommand(mockSocket, { data: { action: 'session:start' } }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'AUTH_REQUIRED'
      }));
    });

    test('routes action to executeCommand', async () => {
      await handleGmCommand(mockSocket, {
        data: { action: 'session:start', payload: {} }
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'session:start',
        source: 'gm',
        deviceId: 'gm-001'
      }));
    });

    test('sends ack with action, success, message', async () => {
      executeCommand.mockResolvedValue({ success: true, message: 'Session started' });

      await handleGmCommand(mockSocket, {
        data: { action: 'session:start', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', {
        action: 'session:start',
        success: true,
        message: 'Session started'
      });
    });

    test('sends failure ack on executeCommand error', async () => {
      executeCommand.mockRejectedValue(new Error('Invalid state'));

      await handleGmCommand(mockSocket, {
        data: { action: 'session:pause', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', {
        action: 'session:pause',
        success: false,
        message: 'Invalid state'
      });
    });

    test('handles system:reset directly (not via executeCommand)', async () => {
      await handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      expect(performSystemReset).toHaveBeenCalled();
      expect(executeCommand).not.toHaveBeenCalled();
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', expect.objectContaining({
        action: 'system:reset',
        success: true
      }));
    });

    test('system:reset mutex prevents concurrent resets', async () => {
      // First reset hangs (never resolves)
      let resolveFirst;
      performSystemReset.mockImplementation(() => new Promise(r => { resolveFirst = r; }));

      const first = handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      // Second reset should fail immediately
      await handleGmCommand(mockSocket, {
        data: { action: 'system:reset', payload: {} }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'gm:command:ack', expect.objectContaining({
        action: 'system:reset',
        success: false,
        message: expect.stringContaining('already in progress')
      }));

      // Clean up first reset
      resolveFirst();
      await first;
    });

    test('unwraps AsyncAPI envelope (data.data)', async () => {
      await handleGmCommand(mockSocket, {
        event: 'gm:command',
        data: { action: 'cue:fire', payload: { cueId: 'intro' } },
        timestamp: '2026-04-01T00:00:00Z'
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'cue:fire',
        payload: { cueId: 'intro' }
      }));
    });

    test('handles flat data (no envelope) for backwards compatibility', async () => {
      await handleGmCommand(mockSocket, {
        action: 'music:play',
        payload: {}
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'music:play'
      }));
    });
  });

  describe('handleTransactionSubmit', () => {
    beforeEach(() => {
      sessionService.getCurrentSession.mockReturnValue({
        id: 'session-1', status: 'active', teams: ['Team1']
      });
      transactionService.processScan.mockResolvedValue({
        status: 'processed',
        transactionId: 'tx-1',
        transaction: { id: 'tx-1', tokenId: 'tok1', teamId: 'Team1' },
        points: 50000,
        message: 'Token processed'
      });
    });

    test('rejects socket without deviceId', async () => {
      mockSocket.deviceId = null;

      await handleTransactionSubmit(mockSocket, { data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' } }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'AUTH_REQUIRED'
      }));
    });

    test('rejects missing envelope (no data.data)', async () => {
      await handleTransactionSubmit(mockSocket, { tokenId: 'tok1', mode: 'blackmarket' }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('envelope')
      }));
    });

    test('enriches transaction with socket deviceId and deviceType', async () => {
      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(transactionService.processScan).toHaveBeenCalledWith(expect.objectContaining({
        deviceId: 'gm-001',
        deviceType: 'gm'
      }));
    });

    test('rejects when no session exists (SESSION_NOT_FOUND) and echoes clientTxId', async () => {
      sessionService.getCurrentSession.mockReturnValue(null);

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket', clientTxId: 'ctx-nf' }
      }, mockIo);

      // clientTxId MUST be echoed so the scanner's replay fast-fails instead of
      // hanging the 30s timeout (the matcher always carries a clientTxId).
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'SESSION_NOT_FOUND',
        clientTxId: 'ctx-nf'
      }));
    });

    test('rejects when session is paused (SESSION_PAUSED) and echoes clientTxId', async () => {
      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'paused' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket', clientTxId: 'ctx-pause' }
      }, mockIo);

      // Most reachable case: scanning into a paused session (normal lifecycle).
      // Without the echo the scanner hangs 30s then retries; with it, it fast-fails
      // and keeps the entry to retry on resume.
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        error: 'SESSION_PAUSED',
        clientTxId: 'ctx-pause'
      }));
    });

    test('paused transaction:result (transactionId: null) validates against the AsyncAPI contract (F-BCORE-08)', async () => {
      const { validateWebSocketEvent } = require('../../helpers/contract-validator');

      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'paused' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket', clientTxId: 'ctx-contract' }
      }, mockIo);

      const call = emitWrapped.mock.calls.find(c => c[1] === 'transaction:result');
      expect(call).toBeDefined();

      // Transient rejections (paused/setup) never created a transaction, so
      // transactionId is null — the contract must permit that
      expect(call[2].transactionId).toBeNull();

      const envelope = {
        event: 'transaction:result',
        data: call[2],
        timestamp: new Date().toISOString()
      };
      expect(() => validateWebSocketEvent(envelope, 'transaction:result')).not.toThrow();
    });

    test('echoes clientTxId on AUTH_REQUIRED when socket is unidentified', async () => {
      mockSocket.deviceId = null;

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket', clientTxId: 'ctx-auth' }
      }, mockIo);

      // Read from the raw envelope (validate() has not run yet at this guard).
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'AUTH_REQUIRED',
        clientTxId: 'ctx-auth'
      }));
    });

    test('rejects when session is in setup (SESSION_NOT_ACTIVE)', async () => {
      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'setup' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        error: 'SESSION_NOT_ACTIVE'
      }));
    });

    test('queues transaction when system is offline', async () => {
      offlineQueueService.isOffline = true;
      offlineQueueService.enqueueGmTransaction = jest.fn().mockReturnValue({
        transactionId: 'queued-1'
      });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(offlineQueueService.enqueueGmTransaction).toHaveBeenCalled();
      // Offline result must be contract-complete (tokenId/teamId/points are
      // required by the AsyncAPI TransactionResult schema; points=0 pre-scoring).
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        status: 'queued',
        tokenId: 'tok1',
        teamId: 'Team1',
        points: 0
      }));
    });

    test('echoes clientTxId on QUEUE_FULL when the offline queue is full', async () => {
      offlineQueueService.isOffline = true;
      offlineQueueService.enqueueGmTransaction = jest.fn().mockReturnValue(null);  // queue full

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket', clientTxId: 'ctx-full' }
      }, mockIo);

      // Without the echo, a full-queue rejection would hang the replay 30s (the
      // exact failure the durability feature exists to prevent).
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'QUEUE_FULL',
        clientTxId: 'ctx-full'
      }));
    });

    test('returns contract-compliant result on success', async () => {
      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        status: 'processed',
        transactionId: 'tx-1',
        tokenId: 'tok1',
        teamId: 'Team1',
        points: 50000
      }));
    });
  });
});
