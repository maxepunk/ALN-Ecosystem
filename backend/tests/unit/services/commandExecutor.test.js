'use strict';

// Mock logger to suppress output
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock config before any imports
jest.mock('../../../src/config', () => ({
  features: {
    videoPlayback: true
  },
  bluetooth: {
    scanTimeout: 15
  },
  storage: {
    logsDir: './logs',
    dataDir: './data'
  },
  logging: {
    level: 'info',
    format: 'json',
    maxFiles: 5,
    maxSize: '10m'
  }
}));

const { executeCommand } = require('../../../src/services/commandExecutor');

// Mock all services that executeCommand depends on
// These services export singletons (module.exports = new ServiceClass())
jest.mock('../../../src/services/sessionService', () => ({
  createSession: jest.fn(),
  getCurrentSession: jest.fn(),
  updateSession: jest.fn(),
  endSession: jest.fn(),
  addTeamToSession: jest.fn(),
}));

jest.mock('../../../src/services/transactionService', () => ({
  adjustTeamScore: jest.fn(),
  resetScores: jest.fn(),
  deleteTransaction: jest.fn(),
  createManualTransaction: jest.fn(),
}));

jest.mock('../../../src/services/videoQueueService', () => ({
  addVideoByFilename: jest.fn(),
  reorderQueue: jest.fn(),
  clearQueue: jest.fn(),
  skipCurrent: jest.fn(),
}));

jest.mock('../../../src/services/vlcService', () => ({
  resume: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../../../src/services/displayControlService', () => ({
  setIdleLoop: jest.fn(),
  setScoreboard: jest.fn(),
  toggleMode: jest.fn(),
  getStatus: jest.fn(),
}));

jest.mock('../../../src/services/bluetoothService', () => ({
  startScan: jest.fn(),
  stopScan: jest.fn(),
  pairDevice: jest.fn(),
  unpairDevice: jest.fn(),
  connectDevice: jest.fn(),
  disconnectDevice: jest.fn(),
}));

jest.mock('../../../src/services/audioRoutingService', () => ({
  setStreamRoute: jest.fn(),
  applyRouting: jest.fn(),
}));

jest.mock('../../../src/services/lightingService', () => ({
  activateScene: jest.fn(),
  refreshScenes: jest.fn(),
}));

describe('commandExecutor', () => {
  const sessionService = require('../../../src/services/sessionService');
  const transactionService = require('../../../src/services/transactionService');
  const videoQueueService = require('../../../src/services/videoQueueService');
  const vlcService = require('../../../src/services/vlcService');
  const displayControlService = require('../../../src/services/displayControlService');
  const bluetoothService = require('../../../src/services/bluetoothService');
  const audioRoutingService = require('../../../src/services/audioRoutingService');
  const lightingService = require('../../../src/services/lightingService');

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    sessionService.createSession.mockResolvedValue({ id: 'test-session', name: 'Test' });
    sessionService.getCurrentSession.mockReturnValue({
      id: 'test-session',
      status: 'active',
      teams: []
    });
    sessionService.updateSession.mockResolvedValue(true);
    sessionService.endSession.mockResolvedValue(true);
    sessionService.addTeamToSession.mockResolvedValue(true);

    transactionService.adjustTeamScore.mockReturnValue(undefined);
    transactionService.resetScores.mockReturnValue(undefined);
    transactionService.deleteTransaction.mockReturnValue({
      deletedTransaction: { teamId: 'team1' },
      updatedScore: { currentScore: 100 }
    });
    transactionService.createManualTransaction.mockResolvedValue({
      transactionId: 'tx-123',
      points: 50
    });

    videoQueueService.addVideoByFilename.mockReturnValue(undefined);
    videoQueueService.reorderQueue.mockReturnValue(undefined);
    videoQueueService.clearQueue.mockReturnValue(undefined);
    videoQueueService.skipCurrent.mockReturnValue(undefined);

    vlcService.resume.mockResolvedValue(true);
    vlcService.pause.mockResolvedValue(true);
    vlcService.stop.mockResolvedValue(true);

    displayControlService.setIdleLoop.mockResolvedValue({ success: true });
    displayControlService.setScoreboard.mockResolvedValue({ success: true });
    displayControlService.toggleMode.mockResolvedValue({ success: true, mode: 'SCOREBOARD' });
    displayControlService.getStatus.mockReturnValue({ currentMode: 'IDLE_LOOP' });

    bluetoothService.startScan.mockReturnValue(undefined);
    bluetoothService.stopScan.mockReturnValue(undefined);
    bluetoothService.pairDevice.mockResolvedValue(true);
    bluetoothService.unpairDevice.mockResolvedValue(true);
    bluetoothService.connectDevice.mockResolvedValue(true);
    bluetoothService.disconnectDevice.mockResolvedValue(true);

    audioRoutingService.setStreamRoute.mockResolvedValue(true);
    audioRoutingService.applyRouting.mockResolvedValue(true);

    lightingService.activateScene.mockResolvedValue(true);
    lightingService.refreshScenes.mockResolvedValue(true);
  });

  it('should export executeCommand function', () => {
    expect(typeof executeCommand).toBe('function');
  });

  describe('session commands', () => {
    it('should execute session:create with source gm', async () => {
      const result = await executeCommand({
        action: 'session:create',
        payload: { name: 'Test Game' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test Game');
      expect(result.source).toBe('gm');
    });

    it('should execute session:create with source cue', async () => {
      const result = await executeCommand({
        action: 'session:create',
        payload: { name: 'Auto Game' },
        source: 'cue',
        trigger: 'manual'
      });
      expect(result.success).toBe(true);
      expect(result.source).toBe('cue');
    });

    it('should execute session:pause', async () => {
      const result = await executeCommand({
        action: 'session:pause',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('paused');
    });

    it('should execute session:resume', async () => {
      const result = await executeCommand({
        action: 'session:resume',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('resumed');
    });

    it('should execute session:end', async () => {
      const result = await executeCommand({
        action: 'session:end',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('ended');
    });

    it('should execute session:addTeam', async () => {
      const result = await executeCommand({
        action: 'session:addTeam',
        payload: { teamId: 'Team Alpha' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Team Alpha');
    });

    it('should reject session:addTeam without teamId', async () => {
      const result = await executeCommand({
        action: 'session:addTeam',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });
  });

  describe('video commands', () => {
    it('should execute video:play', async () => {
      const result = await executeCommand({
        action: 'video:play',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('resumed');
    });

    it('should execute video:queue:add', async () => {
      const result = await executeCommand({
        action: 'video:queue:add',
        payload: { videoFile: 'test.mp4' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('test.mp4');
    });
  });

  describe('display commands', () => {
    it('should execute display:idle-loop', async () => {
      const result = await executeCommand({
        action: 'display:idle-loop',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('idle loop');
      expect(result.data).toBeDefined();
      expect(result.data.mode).toBe('IDLE_LOOP');
    });

    it('should execute display:scoreboard', async () => {
      const result = await executeCommand({
        action: 'display:scoreboard',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('SCOREBOARD');
    });

    it('should execute display:toggle', async () => {
      const result = await executeCommand({
        action: 'display:toggle',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.data.mode).toBe('SCOREBOARD');
    });

    it('should execute display:status', async () => {
      const result = await executeCommand({
        action: 'display:status',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.data.displayStatus).toBeDefined();
    });
  });

  describe('scoring commands', () => {
    it('should execute score:adjust', async () => {
      const result = await executeCommand({
        action: 'score:adjust',
        payload: { teamId: 'team1', delta: 100, reason: 'bonus' },
        source: 'gm',
        deviceId: 'gm-1'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('team1');
    });

    it('should execute score:reset', async () => {
      const result = await executeCommand({
        action: 'score:reset',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset');
    });
  });

  describe('transaction commands', () => {
    it('should execute transaction:delete', async () => {
      const result = await executeCommand({
        action: 'transaction:delete',
        payload: { transactionId: 'tx-123' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('tx-123');
    });

    it('should execute transaction:create', async () => {
      const result = await executeCommand({
        action: 'transaction:create',
        payload: {
          tokenId: 'token-1',
          teamId: 'team1',
          mode: 'blackmarket'
        },
        source: 'gm',
        deviceId: 'gm-1',
        deviceType: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('team1');
    });
  });

  describe('bluetooth commands', () => {
    it('should execute bluetooth:scan:start', async () => {
      const result = await executeCommand({
        action: 'bluetooth:scan:start',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('scan started');
    });

    it('should execute bluetooth:pair', async () => {
      const result = await executeCommand({
        action: 'bluetooth:pair',
        payload: { address: 'AA:BB:CC:DD:EE:FF' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('paired');
    });
  });

  describe('audio commands', () => {
    it('should execute audio:route:set', async () => {
      const result = await executeCommand({
        action: 'audio:route:set',
        payload: { stream: 'video', sink: 'bluetooth' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('bluetooth');
    });
  });

  describe('lighting commands', () => {
    it('should execute lighting:scene:activate', async () => {
      const result = await executeCommand({
        action: 'lighting:scene:activate',
        payload: { sceneId: 'scene1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('scene1');
    });
  });

  describe('unknown actions', () => {
    it('should return error for unknown action', async () => {
      const result = await executeCommand({
        action: 'nonexistent:action',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown/i);
    });

    it('should include source in error result', async () => {
      const result = await executeCommand({
        action: 'invalid:command',
        payload: {},
        source: 'cue',
        trigger: 'cue:opening@0s'
      });
      expect(result.source).toBe('cue');
      expect(result.success).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should catch and return service errors', async () => {
      const sessionService = require('../../../src/services/sessionService');
      sessionService.createSession.mockRejectedValueOnce(new Error('Service error'));

      const result = await executeCommand({
        action: 'session:create',
        payload: { name: 'Test' },
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Service error');
    });
  });
});
