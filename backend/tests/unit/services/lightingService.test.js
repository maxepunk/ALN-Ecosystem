/**
 * Unit tests for Lighting Service
 * Tests Home Assistant REST API integration with axios mocking
 *
 * TDD: Written before implementation
 */

// Mock axios before requiring the service
jest.mock('axios');
const axios = require('axios');

// Mock ws module for WebSocket tests
// Use a class-based mock that survives jest.clearAllMocks()
const mockWsInstances = [];
jest.mock('ws', () => {
  const { EventEmitter } = require('events');
  class MockWS extends EventEmitter {
    constructor(...args) {
      super();
      this._constructorArgs = args;
      this.send = jest.fn();
      this.close = jest.fn();
      this.readyState = 1;
      this.OPEN = 1;
      mockWsInstances.push(this);
    }
  }
  return MockWS;
});
const MockWebSocket = require('ws');

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
const registry = require('../../../src/services/serviceHealthRegistry');

describe('LightingService', () => {
  beforeEach(() => {
    lightingService.reset();
    jest.clearAllMocks();
    mockWsInstances.length = 0;

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

    it('should report healthy to registry when status changes to connected', async () => {
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });

      await lightingService.checkConnection();

      expect(registry.isHealthy('lighting')).toBe(true);
      expect(registry.getStatus('lighting').message).toBe('Connected to Home Assistant');
    });

    it('should not emit health:changed when status unchanged', async () => {
      // First call — connects
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });
      await lightingService.checkConnection();

      const handler = jest.fn();
      registry.on('health:changed', handler);

      // Second call — still connected
      await lightingService.checkConnection();

      expect(handler).not.toHaveBeenCalled();
      registry.removeListener('health:changed', handler);
    });

    it('should report down to registry on connection loss', async () => {
      // First establish connection
      axios.get.mockResolvedValue({ status: 200, data: { message: 'API running.' } });
      await lightingService.checkConnection();

      // Now lose connection
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.checkConnection();

      expect(registry.isHealthy('lighting')).toBe(false);
      expect(registry.getStatus('lighting').message).toBe('Home Assistant unreachable');
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

    it('should fail empty when HA is unreachable — no fixture fallback (F-SHOW-10)', async () => {
      // Production must NOT fall back to tests/fixtures/scenes.json: phantom
      // scenes mask HA outages and let pre-show verification pass against
      // scenes HA does not have.
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

      const scenes = await lightingService.getScenes();

      expect(scenes).toEqual([]);
    });

    it('should preserve the last known scene cache on a transient HA failure', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: [{ entity_id: 'scene.known', attributes: { friendly_name: 'Known' } }],
      });
      await lightingService.getScenes();

      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.getScenes();

      // Last-known-good cache survives (still HA-sourced, never fixture data)
      expect(lightingService.getCachedScenes()).toEqual([
        { id: 'scene.known', name: 'Known' },
      ]);
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

    it('emits the preserved cache (not an empty array) when the HA re-fetch fails', async () => {
      // Seed the cache via a successful fetch.
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: [{ entity_id: 'scene.game', attributes: { friendly_name: 'Game' } }],
      });
      await lightingService.getScenes();

      const handler = jest.fn();
      lightingService.on('scenes:refreshed', handler);

      // A transient HA failure must NOT wipe the GM's scene grid: getScenes()
      // returns [] but deliberately preserves this._scenes, so refreshScenes must
      // broadcast the preserved cache, not the empty failure result.
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await lightingService.refreshScenes();

      expect(handler).toHaveBeenCalledWith({
        scenes: [{ id: 'scene.game', name: 'Game' }],
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

      // Set connected = true so it actually POSTs to HA (not simulated)
      registry.report('lighting', 'healthy');

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

      registry.report('lighting', 'healthy');
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

      registry.report('lighting', 'healthy');
      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.ambient');

      expect(lightingService.getActiveScene()).toBe('scene.ambient');
    });

    it('should use sceneId as sceneName when scene not in cache', async () => {
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      registry.report('lighting', 'healthy');
      axios.post.mockResolvedValue({ status: 200, data: [] });
      await lightingService.activateScene('scene.unknown');

      expect(handler).toHaveBeenCalledWith({
        sceneId: 'scene.unknown',
        sceneName: 'scene.unknown',
      });
    });

    it('should throw when lighting not connected', async () => {
      await expect(lightingService.activateScene('scene.test'))
        .rejects.toThrow('Lighting service not connected');
    });

    it('should throw on HA error (no fake event)', async () => {
      registry.report('lighting', 'healthy');
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);
      axios.post.mockRejectedValue(new Error('Service not found'));

      await expect(lightingService.activateScene('scene.nonexistent'))
        .rejects.toThrow('Service not found');
      expect(handler).not.toHaveBeenCalled();
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

      registry.report('lighting', 'healthy');
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
        await expect(lightingService.cleanup()).resolves.toBeUndefined();
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

  // ── WebSocket monitor ──

  describe('WebSocket monitor', () => {
    const haApiMock = (url) => {
      if (url === 'http://localhost:8123/api/') {
        return Promise.resolve({ status: 200 });
      }
      if (url === 'http://localhost:8123/api/states') {
        return Promise.resolve({ status: 200, data: [] });
      }
      return Promise.reject(new Error('Unexpected URL'));
    };

    it('should connect to HA WebSocket URL on init', async () => {
      axios.get.mockImplementation(haApiMock);

      await lightingService.init();

      expect(mockWsInstances.length).toBe(1);
      expect(mockWsInstances[0]._constructorArgs[0]).toBe('ws://localhost:8123/api/websocket');
    });

    it('should authenticate with token after auth_required message', async () => {
      axios.get.mockImplementation(haApiMock);

      await lightingService.init();
      const ws = mockWsInstances[0];

      ws.emit('message', JSON.stringify({ type: 'auth_required' }));

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'auth',
        access_token: 'test-ha-token',
      }));
    });

    it('should subscribe to state_changed events after auth_ok', async () => {
      axios.get.mockImplementation(haApiMock);

      await lightingService.init();
      const ws = mockWsInstances[0];

      ws.emit('message', JSON.stringify({ type: 'auth_ok' }));

      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"subscribe_events"'));
      const sentMsg = JSON.parse(ws.send.mock.calls[ws.send.mock.calls.length - 1][0]);
      expect(sentMsg.type).toBe('subscribe_events');
      expect(sentMsg.event_type).toBe('state_changed');
      expect(sentMsg.id).toBeDefined();
    });

    it('should emit scene:activated on scene state change event', async () => {
      axios.get.mockImplementation(haApiMock);

      await lightingService.init();

      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      const ws = mockWsInstances[0];

      ws.emit('message', JSON.stringify({
        type: 'event',
        event: {
          data: {
            entity_id: 'scene.game_start',
            new_state: {
              state: 'scening',
              attributes: { friendly_name: 'Game Start' },
            },
          },
        },
      }));

      expect(handler).toHaveBeenCalledWith({
        sceneId: 'scene.game_start',
        sceneName: 'Game Start',
      });
    });

    it('should report health down on WebSocket close', async () => {
      jest.useFakeTimers();

      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      const ws = mockWsInstances[0];
      ws.emit('message', JSON.stringify({ type: 'auth_ok' }));
      expect(registry.isHealthy('lighting')).toBe(true);

      ws.emit('close');

      expect(registry.isHealthy('lighting')).toBe(false);

      lightingService.reset();
      jest.useRealTimers();
    });

    it('should auto-reconnect with backoff after WebSocket close', async () => {
      jest.useFakeTimers();

      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      expect(mockWsInstances.length).toBe(1);

      const firstWs = mockWsInstances[0];
      firstWs.emit('close');

      await jest.advanceTimersByTimeAsync(5000);

      expect(mockWsInstances.length).toBe(2);

      lightingService.reset();
      jest.useRealTimers();
    });

    it('should close WebSocket on cleanup and prevent reconnect', async () => {
      jest.useFakeTimers();

      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      const ws = mockWsInstances[0];

      await lightingService.cleanup();

      expect(ws.close).toHaveBeenCalled();

      // Should not reconnect after cleanup
      await jest.advanceTimersByTimeAsync(30000);
      expect(mockWsInstances.length).toBe(1);

      jest.useRealTimers();
    });

    it('should not crash if WebSocket connection fails', async () => {
      jest.useFakeTimers();

      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      // Simulate error event on the WebSocket (connection refused)
      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.emit('error', new Error('Connection refused'));
      ws.emit('close');

      // WS close reports health down, but HTTP was healthy
      // Service degrades gracefully (no crash), WS reconnect will be attempted
      expect(mockWsInstances.length).toBe(1);

      // Reconnect attempt happens after delay
      await jest.advanceTimersByTimeAsync(5000);
      expect(mockWsInstances.length).toBe(2);

      lightingService.reset();
      jest.useRealTimers();
    });
  });

  describe('WebSocket monitor — lifecycle guards', () => {
    // These branches were previously "covered" only by contract tests
    // accidentally dialing a phantom HA via the committed backend/.env token
    // (removed in jest.config.base.js). The ws lifecycle is the async
    // reporter that caused the lighting health-gate CI flake — cover it
    // deliberately.
    const haApiMock = (url) => {
      if (url === 'http://localhost:8123/api/') {
        return Promise.resolve({ status: 200 });
      }
      if (url === 'http://localhost:8123/api/states') {
        return Promise.resolve({ status: 200, data: [] });
      }
      return Promise.reject(new Error('Unexpected URL'));
    };

    it('does not open a WebSocket when no token is configured', () => {
      config.lighting.homeAssistantToken = '';

      lightingService._connectWebSocket();

      expect(mockWsInstances.length).toBe(0);
    });

    it('closes the existing WebSocket when reconnecting over a live one', async () => {
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const firstWs = mockWsInstances[0];

      lightingService._connectWebSocket();

      expect(firstWs.close).toHaveBeenCalled();
      expect(mockWsInstances.length).toBe(2);
    });

    it('cancels a pending reconnect timer when connecting directly', async () => {
      jest.useFakeTimers();
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      mockWsInstances[0].emit('close'); // schedules a 5s reconnect
      lightingService._connectWebSocket(); // must cancel it (2nd instance)

      await jest.advanceTimersByTimeAsync(30000);
      // No third instance from the stale timer
      expect(mockWsInstances.length).toBe(2);

      lightingService.reset();
      jest.useRealTimers();
    });

    it('stops permanently on auth_invalid (no reconnect with a bad token)', async () => {
      jest.useFakeTimers();
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const ws = mockWsInstances[0];

      ws.emit('message', JSON.stringify({ type: 'auth_invalid' }));

      expect(ws.close).toHaveBeenCalled();
      ws.emit('close');
      await jest.advanceTimersByTimeAsync(30000);
      expect(mockWsInstances.length).toBe(1);

      lightingService.reset();
      jest.useRealTimers();
    });

    it('ignores subscription result messages and events without data', async () => {
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const ws = mockWsInstances[0];
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      expect(() => {
        ws.emit('message', JSON.stringify({ type: 'result', success: true }));
        ws.emit('message', JSON.stringify({ type: 'event' }));
      }).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('ignores state changes for non-scene entities', async () => {
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      mockWsInstances[0].emit('message', JSON.stringify({
        type: 'event',
        event: { data: { entity_id: 'light.kitchen', new_state: { state: 'on' } } },
      }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('falls back to the entity_id when a scene has no friendly_name', async () => {
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const handler = jest.fn();
      lightingService.on('scene:activated', handler);

      mockWsInstances[0].emit('message', JSON.stringify({
        type: 'event',
        event: { data: { entity_id: 'scene.finale', new_state: { state: 'scening', attributes: {} } } },
      }));

      expect(handler).toHaveBeenCalledWith({ sceneId: 'scene.finale', sceneName: 'scene.finale' });
    });

    it('a late close event after cleanup() must NOT report lighting down', async () => {
      // The flake class: async down-reports landing after teardown clobber
      // externally-asserted health state. After cleanup, the close handler
      // must be inert.
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();
      const ws = mockWsInstances[0];

      await lightingService.cleanup();
      const reportSpy = jest.spyOn(registry, 'report');
      reportSpy.mockClear();

      ws.emit('close');

      expect(reportSpy).not.toHaveBeenCalledWith('lighting', 'down', expect.anything());
    });

    it('a scheduled reconnect that fires after cleanup() does not reconnect', async () => {
      jest.useFakeTimers();
      axios.get.mockImplementation(haApiMock);
      await lightingService.init();

      mockWsInstances[0].emit('close'); // schedules 5s reconnect
      await lightingService.cleanup();  // sets _wsStopped

      await jest.advanceTimersByTimeAsync(30000);
      expect(mockWsInstances.length).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('getScenes() — degraded short-circuits', () => {
    it('returns [] without a round-trip when unhealthy AND no token', async () => {
      registry.report('lighting', 'down', 'test');
      config.lighting.homeAssistantToken = '';

      const scenes = await lightingService.getScenes();

      expect(scenes).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('falls back to entity_id for scenes without friendly_name', async () => {
      registry.report('lighting', 'healthy', 'test');
      axios.get.mockResolvedValue({
        status: 200,
        data: [{ entity_id: 'scene.bare', attributes: {} }],
      });

      const scenes = await lightingService.getScenes();

      expect(scenes).toEqual([{ id: 'scene.bare', name: 'scene.bare' }]);
    });
  });

  describe('_startReconnect() idempotence', () => {
    it('does not stack a second interval when already running', async () => {
      jest.useFakeTimers();
      const checkSpy = jest.spyOn(lightingService, 'checkConnection').mockResolvedValue();

      lightingService._startReconnect();
      lightingService._startReconnect();

      await jest.advanceTimersByTimeAsync(30000);
      expect(checkSpy).toHaveBeenCalledTimes(1);

      lightingService.reset();
      jest.useRealTimers();
    });
  });

  describe('sceneExists()', () => {
    it('should return true when sceneId is in cached scenes', () => {
      // Populate cache directly
      lightingService._scenes = [
        { id: 'scene.game_start', name: 'Game Start' },
        { id: 'scene.intermission', name: 'Intermission' },
      ];

      expect(lightingService.sceneExists('scene.game_start')).toBe(true);
    });

    it('should return false when sceneId is not in cached scenes', () => {
      lightingService._scenes = [
        { id: 'scene.game_start', name: 'Game Start' },
      ];

      expect(lightingService.sceneExists('scene.nonexistent')).toBe(false);
    });

    it('should return false when scene cache is empty', () => {
      lightingService._scenes = [];

      expect(lightingService.sceneExists('scene.test')).toBe(false);
    });
  });
});
