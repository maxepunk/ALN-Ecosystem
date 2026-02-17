/**
 * Unit Tests: adminEvents.js - Environment Control gm:command Actions
 *
 * Tests the 9 new environment control cases added to handleGmCommand():
 * - bluetooth:scan:start, bluetooth:scan:stop
 * - bluetooth:pair, bluetooth:unpair
 * - bluetooth:connect, bluetooth:disconnect
 * - audio:route:set
 * - lighting:scene:activate, lighting:scenes:refresh
 *
 * Pattern: Mock the three services, call handleGmCommand with a fake socket,
 * verify service methods called with correct args and ack emitted.
 */

// Mock services BEFORE requiring adminEvents
jest.mock('../../../src/services/bluetoothService', () => ({
  startScan: jest.fn(),
  stopScan: jest.fn(),
  pairDevice: jest.fn().mockResolvedValue(),
  unpairDevice: jest.fn().mockResolvedValue(),
  connectDevice: jest.fn().mockResolvedValue(),
  disconnectDevice: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../src/services/audioRoutingService', () => ({
  setStreamRoute: jest.fn().mockResolvedValue(),
  applyRouting: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../src/services/lightingService', () => ({
  activateScene: jest.fn().mockResolvedValue(),
  refreshScenes: jest.fn().mockResolvedValue(),
}));

// Mock other services that adminEvents requires
jest.mock('../../../src/services/sessionService', () => ({
  createSession: jest.fn(),
  updateSession: jest.fn(),
  endSession: jest.fn(),
  getCurrentSession: jest.fn(),
  addTeamToSession: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/transactionService', () => ({
  processScan: jest.fn(),
  adjustTeamScore: jest.fn(),
  resetScores: jest.fn(),
  deleteTransaction: jest.fn(),
  createManualTransaction: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/offlineQueueService', () => ({
  isOffline: false,
  enqueueGmTransaction: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/stateService', () => ({
  getCurrentState: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/videoQueueService', () => ({
  skipCurrent: jest.fn(),
  addVideoByFilename: jest.fn(),
  reorderQueue: jest.fn(),
  clearQueue: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/vlcService', () => ({
  resume: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
}));

jest.mock('../../../src/services/displayControlService', () => ({
  setIdleLoop: jest.fn(),
  setScoreboard: jest.fn(),
  toggleMode: jest.fn(),
  getStatus: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock eventWrapper
jest.mock('../../../src/websocket/eventWrapper', () => ({
  emitWrapped: jest.fn(),
  emitToRoom: jest.fn(),
}));

const { handleGmCommand } = require('../../../src/websocket/adminEvents');
const { emitWrapped } = require('../../../src/websocket/eventWrapper');
const bluetoothService = require('../../../src/services/bluetoothService');
const audioRoutingService = require('../../../src/services/audioRoutingService');
const lightingService = require('../../../src/services/lightingService');
const config = require('../../../src/config');

/**
 * Create a mock authenticated GM socket
 */
function createMockSocket() {
  return {
    id: 'socket-test-123',
    deviceId: 'gm-test-01',
    deviceType: 'gm',
    emit: jest.fn(),
    broadcast: { emit: jest.fn() },
  };
}

/**
 * Create wrapped gm:command data envelope
 */
function createCommand(action, payload = {}) {
  return {
    event: 'gm:command',
    data: { action, payload },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to extract the gm:command:ack call from emitWrapped mock
 */
function getAck() {
  const ackCall = emitWrapped.mock.calls.find(
    (call) => call[1] === 'gm:command:ack'
  );
  return ackCall ? ackCall[2] : null;
}

describe('adminEvents.js - Environment Control gm:command Actions', () => {
  let socket;
  let mockIo;

  beforeEach(() => {
    jest.clearAllMocks();
    socket = createMockSocket();
    mockIo = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
  });

  // ── Bluetooth Scan ──

  describe('bluetooth:scan:start', () => {
    it('should call bluetoothService.startScan with default timeout', async () => {
      await handleGmCommand(socket, createCommand('bluetooth:scan:start'), mockIo);

      expect(bluetoothService.startScan).toHaveBeenCalledWith(config.bluetooth.scanTimeout);
      const ack = getAck();
      expect(ack).toBeTruthy();
      expect(ack.action).toBe('bluetooth:scan:start');
      expect(ack.success).toBe(true);
    });

    it('should use payload.timeout when provided', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:scan:start', { timeout: 30 }),
        mockIo
      );

      expect(bluetoothService.startScan).toHaveBeenCalledWith(30);
    });
  });

  describe('bluetooth:scan:stop', () => {
    it('should call bluetoothService.stopScan', async () => {
      await handleGmCommand(socket, createCommand('bluetooth:scan:stop'), mockIo);

      expect(bluetoothService.stopScan).toHaveBeenCalled();
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:scan:stop');
      expect(ack.success).toBe(true);
    });
  });

  // ── Bluetooth Pair/Unpair ──

  describe('bluetooth:pair', () => {
    it('should call bluetoothService.pairDevice with address', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:pair', { address: 'AA:BB:CC:DD:EE:FF' }),
        mockIo
      );

      expect(bluetoothService.pairDevice).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:pair');
      expect(ack.success).toBe(true);
    });

    it('should fail when address is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:pair', {}),
        mockIo
      );

      expect(bluetoothService.pairDevice).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:pair');
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/address.*required/i);
    });
  });

  describe('bluetooth:unpair', () => {
    it('should call bluetoothService.unpairDevice with address', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:unpair', { address: 'AA:BB:CC:DD:EE:FF' }),
        mockIo
      );

      expect(bluetoothService.unpairDevice).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:unpair');
      expect(ack.success).toBe(true);
    });

    it('should fail when address is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:unpair', {}),
        mockIo
      );

      expect(bluetoothService.unpairDevice).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/address.*required/i);
    });
  });

  // ── Bluetooth Connect/Disconnect ──

  describe('bluetooth:connect', () => {
    it('should call bluetoothService.connectDevice with address', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:connect', { address: 'AA:BB:CC:DD:EE:FF' }),
        mockIo
      );

      expect(bluetoothService.connectDevice).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:connect');
      expect(ack.success).toBe(true);
    });

    it('should fail when address is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:connect', {}),
        mockIo
      );

      expect(bluetoothService.connectDevice).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/address.*required/i);
    });
  });

  describe('bluetooth:disconnect', () => {
    it('should call bluetoothService.disconnectDevice with address', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:disconnect', { address: 'AA:BB:CC:DD:EE:FF' }),
        mockIo
      );

      expect(bluetoothService.disconnectDevice).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
      const ack = getAck();
      expect(ack.action).toBe('bluetooth:disconnect');
      expect(ack.success).toBe(true);
    });

    it('should fail when address is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('bluetooth:disconnect', {}),
        mockIo
      );

      expect(bluetoothService.disconnectDevice).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/address.*required/i);
    });
  });

  // ── Audio Routing ──

  describe('audio:route:set', () => {
    it('should call setStreamRoute and applyRouting with defaults', async () => {
      await handleGmCommand(
        socket,
        createCommand('audio:route:set', { sink: 'bluetooth' }),
        mockIo
      );

      expect(audioRoutingService.applyRouting).toHaveBeenCalledWith('video', 'bluetooth');
      expect(audioRoutingService.setStreamRoute).toHaveBeenCalledWith('video', 'bluetooth');
      const ack = getAck();
      expect(ack.action).toBe('audio:route:set');
      expect(ack.success).toBe(true);
    });

    it('should use payload.stream when provided', async () => {
      await handleGmCommand(
        socket,
        createCommand('audio:route:set', { stream: 'video', sink: 'hdmi' }),
        mockIo
      );

      expect(audioRoutingService.applyRouting).toHaveBeenCalledWith('video', 'hdmi');
      expect(audioRoutingService.setStreamRoute).toHaveBeenCalledWith('video', 'hdmi');
    });

    it('should fail when sink is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('audio:route:set', {}),
        mockIo
      );

      expect(audioRoutingService.setStreamRoute).not.toHaveBeenCalled();
      expect(audioRoutingService.applyRouting).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/sink.*required/i);
    });
  });

  // ── Lighting ──

  describe('lighting:scene:activate', () => {
    it('should call lightingService.activateScene with sceneId', async () => {
      await handleGmCommand(
        socket,
        createCommand('lighting:scene:activate', { sceneId: 'scene.game_start' }),
        mockIo
      );

      expect(lightingService.activateScene).toHaveBeenCalledWith('scene.game_start');
      const ack = getAck();
      expect(ack.action).toBe('lighting:scene:activate');
      expect(ack.success).toBe(true);
    });

    it('should fail when sceneId is missing', async () => {
      await handleGmCommand(
        socket,
        createCommand('lighting:scene:activate', {}),
        mockIo
      );

      expect(lightingService.activateScene).not.toHaveBeenCalled();
      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/sceneId.*required/i);
    });
  });

  describe('lighting:scenes:refresh', () => {
    it('should call lightingService.refreshScenes', async () => {
      await handleGmCommand(
        socket,
        createCommand('lighting:scenes:refresh'),
        mockIo
      );

      expect(lightingService.refreshScenes).toHaveBeenCalled();
      const ack = getAck();
      expect(ack.action).toBe('lighting:scenes:refresh');
      expect(ack.success).toBe(true);
    });
  });

  // ── Auth guard ──

  describe('authorization', () => {
    it('should reject env control commands from non-GM sockets', async () => {
      const playerSocket = {
        id: 'socket-player-1',
        deviceId: 'player-1',
        deviceType: 'player',
        emit: jest.fn(),
      };

      await handleGmCommand(
        playerSocket,
        createCommand('bluetooth:scan:start'),
        mockIo
      );

      expect(bluetoothService.startScan).not.toHaveBeenCalled();
      // Should emit error, not ack
      const errorCall = emitWrapped.mock.calls.find(
        (call) => call[1] === 'error'
      );
      expect(errorCall).toBeTruthy();
      expect(errorCall[2].code).toBe('AUTH_REQUIRED');
    });
  });

  // ── Service error propagation ──

  describe('error propagation', () => {
    it('should return failure ack when bluetooth service throws', async () => {
      bluetoothService.pairDevice.mockRejectedValueOnce(new Error('Connection refused'));

      await handleGmCommand(
        socket,
        createCommand('bluetooth:pair', { address: 'AA:BB:CC:DD:EE:FF' }),
        mockIo
      );

      const ack = getAck();
      expect(ack.action).toBe('bluetooth:pair');
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/Connection refused/);
    });

    it('should return failure ack when audio routing service throws', async () => {
      audioRoutingService.setStreamRoute.mockRejectedValueOnce(
        new Error('No available sink')
      );

      await handleGmCommand(
        socket,
        createCommand('audio:route:set', { sink: 'bluetooth' }),
        mockIo
      );

      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/No available sink/);
    });

    it('should return failure ack when lighting service throws', async () => {
      lightingService.activateScene.mockRejectedValueOnce(
        new Error('Home Assistant unreachable')
      );

      await handleGmCommand(
        socket,
        createCommand('lighting:scene:activate', { sceneId: 'scene.test' }),
        mockIo
      );

      const ack = getAck();
      expect(ack.success).toBe(false);
      expect(ack.message).toMatch(/Home Assistant unreachable/);
    });
  });
});
