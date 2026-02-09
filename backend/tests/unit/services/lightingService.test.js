/**
 * Unit tests for Lighting Service
 * Tests Home Assistant REST API integration with axios mocking
 *
 * TDD: Written before implementation
 */

// Mock axios before requiring the service
jest.mock('axios');
const axios = require('axios');

// Mock dockerHelper for container lifecycle tests
jest.mock('../../../src/utils/dockerHelper', () => ({
  containerExists: jest.fn(),
  isContainerRunning: jest.fn(),
  startContainer: jest.fn(),
  stopContainer: jest.fn(),
}));
const dockerHelper = require('../../../src/utils/dockerHelper');

// Mock config to control lighting settings
jest.mock('../../../src/config', () => ({
  lighting: {
    enabled: true,
    homeAssistantUrl: 'http://localhost:8123',
    homeAssistantToken: 'test-ha-token',
    dockerManage: true,
    dockerContainer: 'homeassistant',
    dockerStopTimeout: 10,
  },
  // Provide other config sections that may be loaded transitively
  storage: { logsDir: '/tmp/test-logs', dataDir: '/tmp/test-data' },
  logging: { level: 'info', format: 'json', maxFiles: 5, maxSize: '10m' },
}));
const config = require('../../../src/config');

// Mock logger to suppress output
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
const logger = require('../../../src/utils/logger');

const lightingService = require('../../../src/services/lightingService');

describe('LightingService', () => {
  beforeEach(() => {
    lightingService.reset();
    jest.clearAllMocks();

    // Restore default config for each test
    config.lighting.enabled = true;
    config.lighting.homeAssistantUrl = 'http://localhost:8123';
    config.lighting.homeAssistantToken = 'test-ha-token';
    config.lighting.dockerManage = true;
    config.lighting.dockerContainer = 'homeassistant';
    config.lighting.dockerStopTimeout = 10;
  });

  // ── init() ──

  describe('init()', () => {
    it('should connect and fetch scenes when HA available', async () => {
      // Mock checkConnection (GET /api/)
      axios.get.mockImplementation((url) => {
        if (url === 'http://localhost:8123/api/') {
          return Promise.resolve({ status: 200, data: { message: 'API running.' } });
        }
        if (url === 'http://localhost:8123/api/states') {
          return Promise.resolve({
            status: 200,
            data: [
              { entity_id: 'scene.game_start', attributes: { friendly_name: 'Game Start' } },
              { entity_id: 'light.living_room', attributes: { friendly_name: 'Living Room' } },
              { entity_id: 'scene.blackout', attributes: { friendly_name: 'Blackout' } },
            ],
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await lightingService.init();

      expect(lightingService.isConnected()).toBe(true);
      const scenes = lightingService.getCachedScenes();
      expect(scenes).toHaveLength(2);
      expect(scenes[0]).toEqual({ id: 'scene.game_start', name: 'Game Start' });
      expect(scenes[1]).toEqual({ id: 'scene.blackout', name: 'Blackout' });
    });

    it('should succeed silently when HA unreachable (graceful degradation)', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await lightingService.init();

      expect(lightingService.isConnected()).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should skip when token is empty string', async () => {
      config.lighting.homeAssistantToken = '';

      await lightingService.init();

      expect(axios.get).not.toHaveBeenCalled();
      expect(lightingService.isConnected()).toBe(false);
    });

    it('should skip when config.lighting.enabled is false', async () => {
      config.lighting.enabled = false;

      await lightingService.init();

      expect(axios.get).not.toHaveBeenCalled();
      expect(lightingService.isConnected()).toBe(false);
    });
  });

  // ── isConnected() ──

  describe('isConnected()', () => {
    it('should return false when token is empty', () => {
      config.lighting.homeAssistantToken = '';
      expect(lightingService.isConnected()).toBe(false);
    });

    it('should return false when HA unreachable', () => {
      // Default state before init — not connected
      expect(lightingService.isConnected()).toBe(false);
    });

    it('should return true after successful connection', async () => {
      axios.get.mockImplementation((url) => {
        if (url === 'http://localhost:8123/api/') {
          return Promise.resolve({ status: 200, data: { message: 'API running.' } });
        }
        if (url === 'http://localhost:8123/api/states') {
          return Promise.resolve({ status: 200, data: [] });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await lightingService.init();
      expect(lightingService.isConnected()).toBe(true);
    });
  });

  // ── checkConnection() ──

  describe('checkConnection()', () => {
    it('should GET /api/ ping and update connection status to true', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });

      await lightingService.checkConnection();

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:8123/api/',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-ha-token',
          }),
        })
      );
      expect(lightingService.isConnected()).toBe(true);
    });

    it('should emit connection:changed with {connected: true} when status changes', async () => {
      const handler = jest.fn();
      lightingService.on('connection:changed', handler);

      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });

      await lightingService.checkConnection();

      expect(handler).toHaveBeenCalledWith({ connected: true });
    });

    it('should not emit connection:changed when status unchanged', async () => {
      // First call — connects
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });
      await lightingService.checkConnection();

      const handler = jest.fn();
      lightingService.on('connection:changed', handler);

      // Second call — still connected
      await lightingService.checkConnection();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit connection:changed with {connected: false} on connection loss', async () => {
      // First establish connection
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });
      await lightingService.checkConnection();

      const handler = jest.fn();
      lightingService.on('connection:changed', handler);

      // Now lose connection
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.checkConnection();

      expect(handler).toHaveBeenCalledWith({ connected: false });
      expect(lightingService.isConnected()).toBe(false);
    });

    it('should skip when token is empty', async () => {
      config.lighting.homeAssistantToken = '';

      await lightingService.checkConnection();

      expect(axios.get).not.toHaveBeenCalled();
      expect(lightingService.isConnected()).toBe(false);
    });
  });

  // ── Periodic reconnect ──

  describe('periodic reconnect', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start periodic reconnect every 30s when disconnected after init', async () => {
      // Init fails — HA unreachable
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.init();

      expect(lightingService.isConnected()).toBe(false);

      // Now make HA available
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });

      // Advance 30 seconds
      await jest.advanceTimersByTimeAsync(30000);

      expect(lightingService.isConnected()).toBe(true);
    });

    it('should clear reconnect interval on cleanup()', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.init();

      await lightingService.cleanup();

      // Advance time — should NOT attempt reconnect
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });
      await jest.advanceTimersByTimeAsync(60000);

      // Still disconnected because interval was cleared
      expect(lightingService.isConnected()).toBe(false);
    });
  });

  // ── getScenes() ──

  describe('getScenes()', () => {
    it('should fetch states, filter scene.* entities, return [{id, name}]', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.game_start', attributes: { friendly_name: 'Game Start' } },
          { entity_id: 'light.living_room', attributes: { friendly_name: 'Living Room' } },
          { entity_id: 'scene.blackout', attributes: { friendly_name: 'Blackout' } },
          { entity_id: 'scene.ambient', attributes: { friendly_name: 'Ambient' } },
          { entity_id: 'switch.fan', attributes: { friendly_name: 'Fan' } },
        ],
      });

      const scenes = await lightingService.getScenes();

      expect(axios.get).toHaveBeenCalledWith(
        'http://localhost:8123/api/states',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-ha-token',
          }),
        })
      );
      expect(scenes).toHaveLength(3);
      expect(scenes).toEqual([
        { id: 'scene.game_start', name: 'Game Start' },
        { id: 'scene.blackout', name: 'Blackout' },
        { id: 'scene.ambient', name: 'Ambient' },
      ]);
    });

    it('should return empty array when HA unreachable', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const scenes = await lightingService.getScenes();
      expect(scenes).toEqual([]);
    });

    it('should update the scene cache', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.test', attributes: { friendly_name: 'Test Scene' } },
        ],
      });

      await lightingService.getScenes();

      const cached = lightingService.getCachedScenes();
      expect(cached).toEqual([{ id: 'scene.test', name: 'Test Scene' }]);
    });
  });

  // ── getCachedScenes() ──

  describe('getCachedScenes()', () => {
    it('should return cached list without HTTP call', () => {
      // No HTTP calls made
      const cached = lightingService.getCachedScenes();
      expect(cached).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should return previously fetched scenes', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.warm', attributes: { friendly_name: 'Warm' } },
        ],
      });

      await lightingService.getScenes();
      jest.clearAllMocks();

      const cached = lightingService.getCachedScenes();
      expect(cached).toEqual([{ id: 'scene.warm', name: 'Warm' }]);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  // ── refreshScenes() ──

  describe('refreshScenes()', () => {
    it('should re-fetch from HA and update cache', async () => {
      // Initial fetch
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [
          { entity_id: 'scene.old', attributes: { friendly_name: 'Old Scene' } },
        ],
      });
      await lightingService.getScenes();

      // Refresh with new data
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [
          { entity_id: 'scene.new', attributes: { friendly_name: 'New Scene' } },
        ],
      });

      await lightingService.refreshScenes();

      const cached = lightingService.getCachedScenes();
      expect(cached).toEqual([{ id: 'scene.new', name: 'New Scene' }]);
    });

    it('should emit scenes:refreshed with {scenes}', async () => {
      const handler = jest.fn();
      lightingService.on('scenes:refreshed', handler);

      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.test', attributes: { friendly_name: 'Test' } },
        ],
      });

      await lightingService.refreshScenes();

      expect(handler).toHaveBeenCalledWith({
        scenes: [{ id: 'scene.test', name: 'Test' }],
      });
    });
  });

  // ── activateScene() ──

  describe('activateScene()', () => {
    it('should POST to /api/services/scene/turn_on with entity_id', async () => {
      axios.post.mockResolvedValue({ status: 200, data: [] });

      // Pre-populate scene cache so we can resolve the name
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.game_start', attributes: { friendly_name: 'Game Start' } },
        ],
      });
      await lightingService.getScenes();

      await lightingService.activateScene('scene.game_start');

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:8123/api/services/scene/turn_on',
        { entity_id: 'scene.game_start' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-ha-token',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should emit scene:activated with {sceneId, sceneName}', async () => {
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      // Pre-populate scene cache
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.blackout', attributes: { friendly_name: 'Blackout' } },
        ],
      });
      await lightingService.getScenes();

      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.blackout');

      expect(handler).toHaveBeenCalledWith({
        sceneId: 'scene.blackout',
        sceneName: 'Blackout',
      });
    });

    it('should update this._activeScene', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.ambient', attributes: { friendly_name: 'Ambient' } },
        ],
      });
      await lightingService.getScenes();

      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.ambient');

      expect(lightingService.getActiveScene()).toBe('scene.ambient');
    });

    it('should use sceneId as sceneName when scene not in cache', async () => {
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.unknown');

      expect(handler).toHaveBeenCalledWith({
        sceneId: 'scene.unknown',
        sceneName: 'scene.unknown',
      });
    });

    it('should throw when HA returns an error', async () => {
      axios.post.mockRejectedValue(new Error('Service not found'));

      await expect(
        lightingService.activateScene('scene.nonexistent')
      ).rejects.toThrow();
    });
  });

  // ── getActiveScene() ──

  describe('getActiveScene()', () => {
    it('should return null when no scene has been activated', () => {
      expect(lightingService.getActiveScene()).toBeNull();
    });

    it('should return last-activated scene ID', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [
          { entity_id: 'scene.a', attributes: { friendly_name: 'A' } },
          { entity_id: 'scene.b', attributes: { friendly_name: 'B' } },
        ],
      });
      await lightingService.getScenes();

      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.a');
      await lightingService.activateScene('scene.b');

      expect(lightingService.getActiveScene()).toBe('scene.b');
    });
  });

  // ── cleanup() ──

  describe('cleanup()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clear reconnect interval', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.init();

      await lightingService.cleanup();

      // Verify no further reconnect attempts
      axios.get.mockClear();
      await jest.advanceTimersByTimeAsync(60000);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should be safe to call when no interval is active', async () => {
      await expect(lightingService.cleanup()).resolves.toBeUndefined();
    });
  });

  // ── reset() ──

  describe('reset()', () => {
    it('should clear interval, remove listeners, and reset state', async () => {
      jest.useFakeTimers();

      // Set up state
      axios.get.mockImplementation((url) => {
        if (url === 'http://localhost:8123/api/') {
          return Promise.resolve({ status: 200, data: { message: 'API running.' } });
        }
        if (url === 'http://localhost:8123/api/states') {
          return Promise.resolve({
            status: 200,
            data: [
              { entity_id: 'scene.test', attributes: { friendly_name: 'Test' } },
            ],
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
      await lightingService.init();

      // Add a listener
      lightingService.on('scene:activated', jest.fn());

      lightingService.reset();

      // State should be cleared
      expect(lightingService.isConnected()).toBe(false);
      expect(lightingService.getCachedScenes()).toEqual([]);
      expect(lightingService.getActiveScene()).toBeNull();
      expect(lightingService.listenerCount('scene:activated')).toBe(0);

      // No reconnect attempts after reset
      axios.get.mockClear();
      await jest.advanceTimersByTimeAsync(60000);
      expect(axios.get).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  // ── Docker container management ──

  describe('Docker container management', () => {
    let origNodeEnv;

    beforeEach(() => {
      // Save NODE_ENV and set to non-test so Docker management code executes
      origNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = origNodeEnv;
    });

    describe('init() — container auto-start', () => {
      beforeEach(() => {
        // Default: HA reachable after container start
        axios.get.mockImplementation((url) => {
          if (url === 'http://localhost:8123/api/') {
            return Promise.resolve({ status: 200, data: { message: 'API running.' } });
          }
          if (url === 'http://localhost:8123/api/states') {
            return Promise.resolve({ status: 200, data: [] });
          }
          return Promise.reject(new Error('Unexpected URL'));
        });
      });

      it('should start container when it exists but is stopped', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();

        await lightingService.init();

        expect(dockerHelper.containerExists).toHaveBeenCalledWith('homeassistant');
        expect(dockerHelper.isContainerRunning).toHaveBeenCalledWith('homeassistant');
        expect(dockerHelper.startContainer).toHaveBeenCalledWith('homeassistant');
      });

      it('should skip start when container is already running', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(true);

        await lightingService.init();

        expect(dockerHelper.startContainer).not.toHaveBeenCalled();
      });

      it('should skip start when container does not exist', async () => {
        dockerHelper.containerExists.mockResolvedValue(false);

        await lightingService.init();

        expect(dockerHelper.isContainerRunning).not.toHaveBeenCalled();
        expect(dockerHelper.startContainer).not.toHaveBeenCalled();
      });

      it('should skip Docker management when dockerManage is false', async () => {
        config.lighting.dockerManage = false;

        await lightingService.init();

        expect(dockerHelper.containerExists).not.toHaveBeenCalled();
      });

      it('should skip Docker management in test environment', async () => {
        process.env.NODE_ENV = 'test';

        await lightingService.init();

        expect(dockerHelper.containerExists).not.toHaveBeenCalled();
      });

      it('should not throw when Docker commands fail', async () => {
        dockerHelper.containerExists.mockRejectedValue(new Error('Docker daemon not running'));

        await lightingService.init();

        // Should still attempt HA connection (graceful degradation)
        expect(axios.get).toHaveBeenCalled();
      });
    });

    describe('cleanup() — container auto-stop', () => {
      it('should stop container on cleanup when we started it', async () => {
        // Simulate: container was stopped, we started it
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        await lightingService.cleanup();

        expect(dockerHelper.stopContainer).toHaveBeenCalledWith('homeassistant', 10);
      });

      it('should NOT stop container when it was already running', async () => {
        // Simulate: container was already running before init
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(true);
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        await lightingService.cleanup();

        expect(dockerHelper.stopContainer).not.toHaveBeenCalled();
      });

      it('should not throw when container stop fails', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockRejectedValue(new Error('timeout'));

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();

        // Should not throw
        await expect(lightingService.cleanup()).resolves.not.toThrow();
      });
    });

    describe('reset()', () => {
      it('should clear container tracking state without touching Docker', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        jest.clearAllMocks();

        lightingService.reset();

        // stopContainer should NOT be called during reset
        expect(dockerHelper.stopContainer).not.toHaveBeenCalled();
      });
    });
  });
});
