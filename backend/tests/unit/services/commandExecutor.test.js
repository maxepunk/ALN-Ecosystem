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
  setStreamVolume: jest.fn(),
}));

jest.mock('../../../src/services/lightingService', () => ({
  activateScene: jest.fn(),
  refreshScenes: jest.fn(),
}));

jest.mock('../../../src/services/soundService', () => ({
  play: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../../../src/services/spotifyService', () => ({
  play: jest.fn().mockResolvedValue(),
  pause: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  next: jest.fn().mockResolvedValue(),
  previous: jest.fn().mockResolvedValue(),
  setPlaylist: jest.fn().mockResolvedValue(),
  setVolume: jest.fn().mockResolvedValue(),
  verifyCacheStatus: jest.fn().mockResolvedValue({ status: 'verified', trackCount: 42 }),
  getState: jest.fn().mockReturnValue({ connected: true, state: 'playing', volume: 80 }),
  reset: jest.fn(),
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
  const soundService = require('../../../src/services/soundService');
  const spotifyService = require('../../../src/services/spotifyService');

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
    audioRoutingService.setStreamVolume.mockResolvedValue(true);

    lightingService.activateScene.mockResolvedValue(true);
    lightingService.refreshScenes.mockResolvedValue(true);

    soundService.play.mockReturnValue({ file: 'test.wav', id: 'sound-1' });
    soundService.stop.mockReturnValue(undefined);

    spotifyService.play.mockResolvedValue();
    spotifyService.pause.mockResolvedValue();
    spotifyService.stop.mockResolvedValue();
    spotifyService.next.mockResolvedValue();
    spotifyService.previous.mockResolvedValue();
    spotifyService.setPlaylist.mockResolvedValue();
    spotifyService.setVolume.mockResolvedValue();
    spotifyService.verifyCacheStatus.mockResolvedValue({ status: 'verified', trackCount: 42 });
    spotifyService.getState.mockReturnValue({ connected: true, state: 'playing', volume: 80 });
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

  describe('spotify commands', () => {
    it('should execute spotify:play', async () => {
      const result = await executeCommand({ action: 'spotify:play', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.play).toHaveBeenCalled();
      expect(result.broadcasts).toBeDefined();
      expect(result.broadcasts[0].event).toBe('spotify:status');
    });

    it('should execute spotify:pause', async () => {
      const result = await executeCommand({ action: 'spotify:pause', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.pause).toHaveBeenCalled();
    });

    it('should execute spotify:stop', async () => {
      const result = await executeCommand({ action: 'spotify:stop', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.stop).toHaveBeenCalled();
    });

    it('should execute spotify:next', async () => {
      const result = await executeCommand({ action: 'spotify:next', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.next).toHaveBeenCalled();
    });

    it('should execute spotify:previous', async () => {
      const result = await executeCommand({ action: 'spotify:previous', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.previous).toHaveBeenCalled();
    });

    it('should execute spotify:playlist with uri', async () => {
      const result = await executeCommand({
        action: 'spotify:playlist',
        payload: { uri: 'spotify:playlist:act2' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(spotifyService.setPlaylist).toHaveBeenCalledWith('spotify:playlist:act2');
    });

    it('should reject spotify:playlist without uri', async () => {
      const result = await executeCommand({
        action: 'spotify:playlist',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('uri required');
    });

    it('should execute spotify:volume with clamping', async () => {
      const result = await executeCommand({
        action: 'spotify:volume',
        payload: { volume: 80 },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(spotifyService.setVolume).toHaveBeenCalledWith(80);
    });

    it('should reject spotify:volume without volume', async () => {
      const result = await executeCommand({
        action: 'spotify:volume',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('volume required');
    });

    it('should execute spotify:cache:verify', async () => {
      const result = await executeCommand({
        action: 'spotify:cache:verify',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('verified');
      expect(result.data.trackCount).toBe(42);
    });
  });

  describe('audio:volume:set', () => {
    it('should set per-stream volume', async () => {
      const result = await executeCommand({
        action: 'audio:volume:set',
        payload: { stream: 'spotify', volume: 60 },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(audioRoutingService.setStreamVolume).toHaveBeenCalledWith('spotify', 60);
    });

    it('should reject without stream', async () => {
      const result = await executeCommand({
        action: 'audio:volume:set',
        payload: { volume: 60 },
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('stream and volume required');
    });

    it('should reject without volume', async () => {
      const result = await executeCommand({
        action: 'audio:volume:set',
        payload: { stream: 'spotify' },
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('stream and volume required');
    });
  });

  describe('cue lifecycle commands', () => {
    // Mock cueEngineService for these tests
    let cueEngineService;

    beforeEach(() => {
      jest.resetModules();
      cueEngineService = {
        stopCue: jest.fn().mockResolvedValue(),
        pauseCue: jest.fn().mockResolvedValue(),
        resumeCue: jest.fn().mockResolvedValue(),
      };
      jest.doMock('../../../src/services/cueEngineService', () => cueEngineService);
    });

    afterEach(() => {
      jest.dontMock('../../../src/services/cueEngineService');
    });

    it('should execute cue:stop', async () => {
      // Need to require executeCommand fresh after mocking
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:stop',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.stopCue).toHaveBeenCalledWith('opening');
      expect(result.broadcasts[0].event).toBe('cue:status');
      expect(result.broadcasts[0].data.state).toBe('stopped');
    });

    it('should reject cue:stop without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:stop',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
    });

    it('should execute cue:pause', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:pause',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.pauseCue).toHaveBeenCalledWith('opening');
      expect(result.broadcasts[0].data.state).toBe('paused');
    });

    it('should reject cue:pause without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:pause',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
    });

    it('should execute cue:resume', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:resume',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.resumeCue).toHaveBeenCalledWith('opening');
      expect(result.broadcasts[0].data.state).toBe('running');
    });

    it('should reject cue:resume without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:resume',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
    });
  });
});
