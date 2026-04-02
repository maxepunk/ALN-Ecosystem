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
        action: 'spotify:play',
        payload: {}
      }, mockIo);

      expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({
        action: 'spotify:play'
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

    test('rejects when no session exists (SESSION_NOT_FOUND)', async () => {
      sessionService.getCurrentSession.mockReturnValue(null);

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'error', expect.objectContaining({
        code: 'SESSION_NOT_FOUND'
      }));
    });

    test('rejects when session is paused (SESSION_PAUSED)', async () => {
      sessionService.getCurrentSession.mockReturnValue({ id: 's1', status: 'paused' });

      await handleTransactionSubmit(mockSocket, {
        data: { tokenId: 'tok1', teamId: 'Team1', mode: 'blackmarket' }
      }, mockIo);

      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        error: 'SESSION_PAUSED'
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
      expect(emitWrapped).toHaveBeenCalledWith(mockSocket, 'transaction:result', expect.objectContaining({
        status: 'queued'
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
