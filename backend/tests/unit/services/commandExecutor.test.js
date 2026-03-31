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

const { executeCommand, validateCommand, SERVICE_DEPENDENCIES } = require('../../../src/services/commandExecutor');

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
  pauseCurrent: jest.fn(),
  resumeCurrent: jest.fn(),
  videoFileExists: jest.fn(),
}));

jest.mock('../../../src/services/vlcMprisService', () => ({
  resume: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  checkConnection: jest.fn(),
}));

jest.mock('../../../src/services/displayControlService', () => ({
  setIdleLoop: jest.fn(),
  setScoreboard: jest.fn(),
  returnToVideo: jest.fn(),
  getStatus: jest.fn(),
}));

jest.mock('../../../src/services/bluetoothService', () => ({
  startScan: jest.fn(),
  stopScan: jest.fn(),
  pairDevice: jest.fn(),
  unpairDevice: jest.fn(),
  connectDevice: jest.fn(),
  disconnectDevice: jest.fn(),
  checkHealth: jest.fn(),
  isAvailable: jest.fn(),
}));

jest.mock('../../../src/services/audioRoutingService', () => ({
  setStreamRoute: jest.fn(),
  applyRouting: jest.fn(),
  setStreamVolume: jest.fn(),
  sinkExists: jest.fn(),
  checkHealth: jest.fn(),
}));

jest.mock('../../../src/services/lightingService', () => ({
  activateScene: jest.fn(),
  refreshScenes: jest.fn(),
  sceneExists: jest.fn(),
  checkConnection: jest.fn(),
}));

jest.mock('../../../src/services/soundService', () => ({
  play: jest.fn(),
  stop: jest.fn(),
  fileExists: jest.fn(),
  checkHealth: jest.fn(),
}));

jest.mock('../../../src/services/serviceHealthRegistry', () => ({
  isHealthy: jest.fn().mockReturnValue(true),
  getStatus: jest.fn().mockReturnValue({ status: 'healthy', message: 'Connected', lastChecked: new Date() }),
  report: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
}));

jest.mock('../../../src/services/spotifyService', () => ({
  play: jest.fn().mockResolvedValue(),
  pause: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  next: jest.fn().mockResolvedValue(),
  previous: jest.fn().mockResolvedValue(),
  setPlaylist: jest.fn().mockResolvedValue(),
  setVolume: jest.fn().mockResolvedValue(),
  checkConnection: jest.fn().mockResolvedValue(true),
  activate: jest.fn().mockResolvedValue(true),
  verifyCacheStatus: jest.fn().mockResolvedValue({ status: 'verified', trackCount: 42 }),
  getState: jest.fn().mockReturnValue({ connected: true, state: 'playing', volume: 80 }),
  reset: jest.fn(),
}));

describe('commandExecutor', () => {
  const sessionService = require('../../../src/services/sessionService');
  const transactionService = require('../../../src/services/transactionService');
  const videoQueueService = require('../../../src/services/videoQueueService');
  const vlcService = require('../../../src/services/vlcMprisService');
  const displayControlService = require('../../../src/services/displayControlService');
  const bluetoothService = require('../../../src/services/bluetoothService');
  const audioRoutingService = require('../../../src/services/audioRoutingService');
  const lightingService = require('../../../src/services/lightingService');
  const soundService = require('../../../src/services/soundService');
  const spotifyService = require('../../../src/services/spotifyService');
  const registry = require('../../../src/services/serviceHealthRegistry');

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
    videoQueueService.skipCurrent.mockResolvedValue(undefined);
    videoQueueService.pauseCurrent.mockResolvedValue(undefined);
    videoQueueService.resumeCurrent.mockResolvedValue(undefined);
    videoQueueService.videoFileExists.mockReturnValue(true);

    displayControlService.setIdleLoop.mockResolvedValue({ success: true });
    displayControlService.setScoreboard.mockResolvedValue({ success: true });
    displayControlService.returnToVideo.mockResolvedValue({ success: true, mode: 'VIDEO' });
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
    audioRoutingService.sinkExists.mockReturnValue(true);

    lightingService.activateScene.mockResolvedValue(true);
    lightingService.refreshScenes.mockResolvedValue(true);
    lightingService.sceneExists.mockReturnValue(true);

    soundService.play.mockReturnValue({ file: 'test.wav', id: 'sound-1' });
    soundService.stop.mockReturnValue(undefined);
    soundService.fileExists.mockReturnValue(true);

    registry.isHealthy.mockReturnValue(true);
    registry.getStatus.mockReturnValue({ status: 'healthy', message: 'Connected', lastChecked: new Date() });

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
    it('should route video:play through videoQueueService.resumeCurrent()', async () => {
      const result = await executeCommand({
        action: 'video:play',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('resumed');
      expect(videoQueueService.resumeCurrent).toHaveBeenCalled();
      expect(vlcService.resume).not.toHaveBeenCalled();
    });

    it('should route video:pause through videoQueueService.pauseCurrent()', async () => {
      const result = await executeCommand({
        action: 'video:pause',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('paused');
      expect(videoQueueService.pauseCurrent).toHaveBeenCalled();
      expect(vlcService.pause).not.toHaveBeenCalled();
    });

    it('should route video:stop through videoQueueService (skip then clear)', async () => {
      const callOrder = [];
      videoQueueService.skipCurrent.mockImplementation(() => { callOrder.push('skip'); return Promise.resolve(); });
      videoQueueService.clearQueue.mockImplementation(() => { callOrder.push('clear'); });

      const result = await executeCommand({
        action: 'video:stop',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('stopped');
      expect(videoQueueService.skipCurrent).toHaveBeenCalled();
      expect(videoQueueService.clearQueue).toHaveBeenCalled();
      expect(callOrder).toEqual(['skip', 'clear']);
      expect(vlcService.stop).not.toHaveBeenCalled();
    });

    it('should await video:skip', async () => {
      const result = await executeCommand({
        action: 'video:skip',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(videoQueueService.skipCurrent).toHaveBeenCalled();
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

    it('should execute display:status', async () => {
      const result = await executeCommand({
        action: 'display:status',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(result.data.displayStatus).toBeDefined();
    });

    it('should execute display:return-to-video', async () => {
      displayControlService.returnToVideo.mockResolvedValue({ success: true, mode: 'VIDEO' });
      const result = await executeCommand({
        action: 'display:return-to-video',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(displayControlService.returnToVideo).toHaveBeenCalled();
    });

    it('should handle display:return-to-video failure', async () => {
      displayControlService.returnToVideo.mockResolvedValue({ success: false, error: 'No video playing' });
      const result = await executeCommand({
        action: 'display:return-to-video',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
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

  describe('audio:route:set - apply-before-persist', () => {
    it('should not persist route if applyRouting fails', async () => {
      audioRoutingService.setStreamRoute.mockResolvedValue();
      audioRoutingService.applyRouting.mockRejectedValue(new Error('No available sink'));

      const result = await executeCommand({
        action: 'audio:route:set',
        payload: { stream: 'video', sink: 'nonexistent' },
        source: 'gm',
        deviceId: 'test-device'
      });

      expect(result.success).toBe(false);
      // setStreamRoute should NOT have been called because applyRouting failed
      expect(audioRoutingService.setStreamRoute).not.toHaveBeenCalled();
    });

    it('should persist route after successful applyRouting', async () => {
      audioRoutingService.setStreamRoute.mockResolvedValue();
      audioRoutingService.applyRouting.mockResolvedValue();

      const result = await executeCommand({
        action: 'audio:route:set',
        payload: { stream: 'video', sink: 'hdmi' },
        source: 'gm',
        deviceId: 'test-device'
      });

      expect(result.success).toBe(true);
      // applyRouting called first, then setStreamRoute persists
      const applyOrder = audioRoutingService.applyRouting.mock.invocationCallOrder[0];
      const setOrder = audioRoutingService.setStreamRoute.mock.invocationCallOrder[0];
      expect(applyOrder).toBeLessThan(setOrder);
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

    it('should log error message in metadata when command throws', async () => {
      // Arrange: applyRouting succeeds (default mock), but setStreamRoute rejects.
      // This tests the logger.error metadata format in the catch block.
      const mockAudioRouting = require('../../../src/services/audioRoutingService');
      mockAudioRouting.setStreamRoute = jest.fn().mockRejectedValue(new Error('Sink not found'));
      const logger = require('../../../src/utils/logger');

      // Act
      const result = await executeCommand({
        action: 'audio:route:set',
        payload: { stream: 'video', sink: 'nonexistent' },
        source: 'gm',
        deviceId: 'test-device'
      });

      // Assert: error message must appear in structured metadata, not as a dropped string
      expect(result.success).toBe(false);
      expect(result.message).toBe('Sink not found');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('audio:route:set failed'),
        expect.objectContaining({ error: 'Sink not found' })
      );
    });
  });

  describe('spotify commands', () => {
    it('should execute spotify:play', async () => {
      const result = await executeCommand({ action: 'spotify:play', payload: {}, source: 'gm' });
      expect(result.success).toBe(true);
      expect(spotifyService.play).toHaveBeenCalled();
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

    it('should reject spotify:reconnect as unknown action (removed)', async () => {
      const result = await executeCommand({
        action: 'spotify:reconnect',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown action');
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

  describe('service:check', () => {
    // service:check uses lazy-require for cueEngineService, like other cue commands
    let cueEngineService;

    beforeEach(() => {
      jest.resetModules();
      cueEngineService = {
        getCues: jest.fn().mockReturnValue([{ id: 'cue1' }]),
      };
      jest.doMock('../../../src/services/cueEngineService', () => cueEngineService);
    });

    afterEach(() => {
      jest.dontMock('../../../src/services/cueEngineService');
    });

    it('should check a single service by serviceId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const vlcService = require('../../../src/services/vlcMprisService');
      vlcService.checkConnection.mockResolvedValue(true);

      const result = await executeCommand({
        action: 'service:check',
        payload: { serviceId: 'vlc' },
        source: 'gm'
      });

      expect(result.success).toBe(true);
      expect(vlcService.checkConnection).toHaveBeenCalled();
    });

    it('should check all services when no serviceId given', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const vlcService = require('../../../src/services/vlcMprisService');
      const spotifyService = require('../../../src/services/spotifyService');
      const lightingService = require('../../../src/services/lightingService');
      const bluetoothService = require('../../../src/services/bluetoothService');
      const audioRoutingService = require('../../../src/services/audioRoutingService');
      const soundService = require('../../../src/services/soundService');

      vlcService.checkConnection.mockResolvedValue(true);
      spotifyService.checkConnection.mockResolvedValue(true);
      lightingService.checkConnection.mockResolvedValue(undefined);
      bluetoothService.isAvailable.mockResolvedValue(true);
      audioRoutingService.checkHealth.mockResolvedValue(true);
      soundService.checkHealth.mockResolvedValue(true);

      const result = await executeCommand({
        action: 'service:check',
        payload: {},
        source: 'gm'
      });

      expect(result.success).toBe(true);
      expect(vlcService.checkConnection).toHaveBeenCalled();
      expect(spotifyService.checkConnection).toHaveBeenCalled();
      expect(lightingService.checkConnection).toHaveBeenCalled();
      expect(bluetoothService.isAvailable).toHaveBeenCalled();
      expect(audioRoutingService.checkHealth).toHaveBeenCalled();
      expect(soundService.checkHealth).toHaveBeenCalled();
    });

    it('should return error for unknown serviceId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'service:check',
        payload: { serviceId: 'nonexistent' },
        source: 'gm'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('nonexistent');
    });

    it('should handle check failure gracefully', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const vlcService = require('../../../src/services/vlcMprisService');
      vlcService.checkConnection.mockRejectedValue(new Error('connection refused'));

      const result = await executeCommand({
        action: 'service:check',
        payload: { serviceId: 'vlc' },
        source: 'gm'
      });

      // Should still succeed — the check itself ran, even if the service is down
      expect(result.success).toBe(true);
      expect(result.data.vlc).toBe(false);
    });

    it('should not be gated by health check (intentionally ungated)', async () => {
      const { executeCommand, SERVICE_DEPENDENCIES } = require('../../../src/services/commandExecutor');

      // service:check should NOT appear in SERVICE_DEPENDENCIES
      expect(SERVICE_DEPENDENCIES['service:check']).toBeUndefined();
    });
  });

  describe('cue lifecycle commands', () => {
    // Mock cueEngineService for these tests
    let cueEngineService;

    beforeEach(() => {
      jest.resetModules();
      cueEngineService = {
        fireCue: jest.fn().mockResolvedValue(),
        enableCue: jest.fn(),
        disableCue: jest.fn(),
        stopCue: jest.fn().mockResolvedValue(),
        pauseCue: jest.fn().mockResolvedValue(),
        resumeCue: jest.fn().mockResolvedValue(),
      };
      jest.doMock('../../../src/services/cueEngineService', () => cueEngineService);
    });

    afterEach(() => {
      jest.dontMock('../../../src/services/cueEngineService');
    });

    it('should execute cue:fire', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:fire',
        payload: { cueId: 'opening' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.fireCue).toHaveBeenCalledWith('opening');
    });

    it('should reject cue:fire without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:fire',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
    });

    it('should execute cue:enable', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:enable',
        payload: { cueId: 'standing-1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.enableCue).toHaveBeenCalledWith('standing-1');
    });

    it('should reject cue:enable without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:enable',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
    });

    it('should execute cue:disable', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:disable',
        payload: { cueId: 'standing-1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.disableCue).toHaveBeenCalledWith('standing-1');
    });

    it('should reject cue:disable without cueId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');

      const result = await executeCommand({
        action: 'cue:disable',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('cueId required');
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

  describe('held item commands', () => {
    let cueEngineService;
    let videoQueueService;

    beforeEach(() => {
      jest.resetModules();
      cueEngineService = {
        releaseCue: jest.fn().mockResolvedValue(),
        discardCue: jest.fn(),
        getHeldCues: jest.fn().mockReturnValue([
          { id: 'held-cue-1' }, { id: 'held-cue-2' }
        ]),
      };
      videoQueueService = {
        releaseHeld: jest.fn(),
        discardHeld: jest.fn(),
        getHeldVideos: jest.fn().mockReturnValue([
          { id: 'held-video-1' }
        ]),
      };
      jest.doMock('../../../src/services/cueEngineService', () => cueEngineService);
      jest.doMock('../../../src/services/videoQueueService', () => videoQueueService);
    });

    afterEach(() => {
      jest.dontMock('../../../src/services/cueEngineService');
      jest.dontMock('../../../src/services/videoQueueService');
    });

    it('should route held:release to cueEngineService for held-cue-* IDs', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:release',
        payload: { heldId: 'held-cue-1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.releaseCue).toHaveBeenCalledWith('held-cue-1');
      expect(videoQueueService.releaseHeld).not.toHaveBeenCalled();
    });

    it('should route held:release to videoQueueService for held-video-* IDs', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:release',
        payload: { heldId: 'held-video-1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(videoQueueService.releaseHeld).toHaveBeenCalledWith('held-video-1');
      expect(cueEngineService.releaseCue).not.toHaveBeenCalled();
    });

    it('should route held:discard to cueEngineService for held-cue-* IDs', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:discard',
        payload: { heldId: 'held-cue-2' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.discardCue).toHaveBeenCalledWith('held-cue-2');
      expect(videoQueueService.discardHeld).not.toHaveBeenCalled();
    });

    it('should route held:discard to videoQueueService for held-video-* IDs', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:discard',
        payload: { heldId: 'held-video-1' },
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(videoQueueService.discardHeld).toHaveBeenCalledWith('held-video-1');
      expect(cueEngineService.discardCue).not.toHaveBeenCalled();
    });

    it('should reject held:release without heldId', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:release',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('heldId required');
    });

    it('should reject held:release with unknown prefix', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:release',
        payload: { heldId: 'held-unknown-1' },
        source: 'gm'
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown held item type');
    });

    it('should release all held items via held:release-all', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:release-all',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.releaseCue).toHaveBeenCalledWith('held-cue-1');
      expect(cueEngineService.releaseCue).toHaveBeenCalledWith('held-cue-2');
      expect(videoQueueService.releaseHeld).toHaveBeenCalledWith('held-video-1');
    });

    it('should discard all held items via held:discard-all', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor');
      const result = await executeCommand({
        action: 'held:discard-all',
        payload: {},
        source: 'gm'
      });
      expect(result.success).toBe(true);
      expect(cueEngineService.discardCue).toHaveBeenCalledWith('held-cue-1');
      expect(cueEngineService.discardCue).toHaveBeenCalledWith('held-cue-2');
      expect(videoQueueService.discardHeld).toHaveBeenCalledWith('held-video-1');
    });
  });

  describe('pre-dispatch health check (Phase 3a)', () => {
    beforeEach(() => {
      // Default: all services healthy (use mockImplementation to override prior mockImplementation calls)
      registry.isHealthy.mockImplementation(() => true);
      registry.getStatus.mockReturnValue({ status: 'healthy', message: 'Connected', lastChecked: new Date() });
    });

    it('should reject video:play when VLC is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'vlc');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'Connection lost' });

      const result = await executeCommand({ action: 'video:play', source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('vlc');
      expect(result.message).toContain('down');
      expect(videoQueueService.resumeCurrent).not.toHaveBeenCalled();
    });

    it('should reject spotify:play when spotify is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'spotify');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'D-Bus unavailable' });

      const result = await executeCommand({ action: 'spotify:play', source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('spotify');
      expect(spotifyService.play).not.toHaveBeenCalled();
    });

    it('should reject sound:play when sound is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'sound');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'pw-play not found' });

      const result = await executeCommand({ action: 'sound:play', payload: { file: 'test.wav' }, source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('sound');
      expect(soundService.play).not.toHaveBeenCalled();
    });

    it('should reject lighting:scene:activate when lighting is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'lighting');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'HA container not running' });

      const result = await executeCommand({ action: 'lighting:scene:activate', payload: { sceneId: 'scene1' }, source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('lighting');
      expect(lightingService.activateScene).not.toHaveBeenCalled();
    });

    it('should reject bluetooth:pair when bluetooth is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'bluetooth');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'No adapter found' });

      const result = await executeCommand({ action: 'bluetooth:pair', payload: { address: 'AA:BB:CC:DD:EE:FF' }, source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('bluetooth');
      expect(bluetoothService.pairDevice).not.toHaveBeenCalled();
    });

    it('should reject audio:route:set when audio is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'audio');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'PipeWire unavailable' });

      const result = await executeCommand({ action: 'audio:route:set', payload: { stream: 'video', sink: 'hdmi' }, source: 'gm' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('audio');
      expect(audioRoutingService.applyRouting).not.toHaveBeenCalled();
    });

    it('should allow commands with no service dependency regardless of health', async () => {
      // session:create has no service dependency
      const result = await executeCommand({
        action: 'session:create',
        payload: { name: 'Test', teams: ['Alpha'] },
        source: 'gm'
      });

      expect(result.success).toBe(true);
    });

    it('should allow video:queue:clear even when VLC is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'vlc');

      const result = await executeCommand({ action: 'video:queue:clear', source: 'gm' });

      expect(result.success).toBe(true);
      expect(videoQueueService.clearQueue).toHaveBeenCalled();
    });

    it('should allow video:queue:reorder even when VLC is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'vlc');

      const result = await executeCommand({
        action: 'video:queue:reorder',
        payload: { fromIndex: 0, toIndex: 1 },
        source: 'gm'
      });

      expect(result.success).toBe(true);
      expect(videoQueueService.reorderQueue).toHaveBeenCalled();
    });

    it('should allow spotify:cache:verify even when spotify is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'spotify');

      const result = await executeCommand({ action: 'spotify:cache:verify', source: 'gm' });

      expect(result.success).toBe(true);
    });

    it('should allow video:play when VLC is healthy', async () => {
      const result = await executeCommand({ action: 'video:play', source: 'gm' });

      expect(result.success).toBe(true);
      expect(videoQueueService.resumeCurrent).toHaveBeenCalled();
    });

    it('should include source in health check rejection', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'vlc');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'Connection lost' });

      const result = await executeCommand({ action: 'video:play', source: 'cue' });

      expect(result.success).toBe(false);
      expect(result.source).toBe('cue');
    });
  });

  describe('validateCommand()', () => {
    it('should return valid: true when service healthy and no resource checks needed', async () => {
      const result = await validateCommand('video:play', {});

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid: true for actions with no service dependency', async () => {
      const result = await validateCommand('session:create', { name: 'Test' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return service error when required service is down', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'vlc');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'VLC unreachable' });

      const result = await validateCommand('video:play', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'service',
        service: 'vlc',
        status: expect.objectContaining({ status: 'down' })
      });
    });

    it('should return resource error when sound file not found', async () => {
      soundService.fileExists.mockReturnValue(false);

      const result = await validateCommand('sound:play', { file: 'missing.wav' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'resource',
        message: expect.stringContaining('missing.wav')
      });
    });

    it('should return resource error when video file not found', async () => {
      videoQueueService.videoFileExists.mockReturnValue(false);

      const result = await validateCommand('video:queue:add', { videoFile: 'missing.mp4' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'resource',
        message: expect.stringContaining('missing.mp4')
      });
    });

    it('should return resource error when scene not found', async () => {
      lightingService.sceneExists.mockReturnValue(false);

      const result = await validateCommand('lighting:scene:activate', { sceneId: 'scene.unknown' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'resource',
        message: expect.stringContaining('scene.unknown')
      });
    });

    it('should return resource error when audio sink not found', async () => {
      audioRoutingService.sinkExists.mockReturnValue(false);

      const result = await validateCommand('audio:route:set', { sink: 'nonexistent_sink' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'resource',
        message: expect.stringContaining('nonexistent_sink')
      });
    });

    it('should return both service AND resource errors simultaneously', async () => {
      registry.isHealthy.mockImplementation((id) => id !== 'sound');
      registry.getStatus.mockReturnValue({ status: 'down', message: 'pw-play not found' });
      soundService.fileExists.mockReturnValue(false);

      const result = await validateCommand('sound:play', { file: 'missing.wav' });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].type).toBe('service');
      expect(result.errors[1].type).toBe('resource');
    });

    it('should return valid: true when resource exists', async () => {
      soundService.fileExists.mockReturnValue(true);

      const result = await validateCommand('sound:play', { file: 'fanfare.wav' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle undefined payload without throwing', async () => {
      // validateCommand defaults payload={}, so payload.file is undefined
      // The resource check still calls fileExists(undefined) — does not throw
      const result = await validateCommand('video:play');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    it('should detect missing resource when payload field is undefined', async () => {
      soundService.fileExists.mockReturnValue(false);

      const result = await validateCommand('sound:play');

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('resource');
      expect(result.errors[0].message).toContain('undefined');
    });
  });
});
