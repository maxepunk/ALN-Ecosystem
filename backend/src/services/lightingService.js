/**
 * Lighting Service
 * Singleton EventEmitter wrapping the Home Assistant REST API
 * for scene-based lighting control. Graceful degradation when
 * HA is unreachable or token is unconfigured.
 *
 * Phase 0: scene activation only.
 */

const EventEmitter = require('events');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const dockerHelper = require('../utils/dockerHelper');

class LightingService extends EventEmitter {
  constructor() {
    super();
    this._connected = false;
    this._scenes = [];
    this._activeScene = null;
    this._reconnectInterval = null;
    this._containerStartedByUs = false;
  }

  // ── Connection management ──

  /**
   * Initialize the lighting service.
   * Non-blocking: logs warning on failure, never throws.
   * @returns {Promise<void>}
   */
  async init() {
    if (!config.lighting.enabled) {
      logger.info('Lighting service disabled via config');
      return;
    }

    if (!config.lighting.homeAssistantToken) {
      logger.info('Lighting service skipped — no Home Assistant token configured');
      return;
    }

    // Ensure HA Docker container is running before attempting connection
    await this._ensureContainerRunning();

    try {
      await this.checkConnection();

      if (this._connected) {
        await this.getScenes();
        logger.info('Lighting service initialized — connected to Home Assistant', {
          sceneCount: this._scenes.length,
        });
      } else {
        logger.warn('Lighting service initialized — Home Assistant unreachable');
      }
    } catch (err) {
      logger.warn('Lighting service init failed — continuing without lighting', {
        error: err.message,
      });
    }

    // Start periodic reconnect when disconnected
    if (!this._connected) {
      this._startReconnect();
    }
  }

  /**
   * Check if the service is connected to Home Assistant.
   * Returns false when token is empty or HA is unreachable.
   * @returns {boolean}
   */
  isConnected() {
    if (!config.lighting.homeAssistantToken) {
      return false;
    }
    return this._connected;
  }

  /**
   * Ping Home Assistant API to check connection status.
   * Emits connection:changed when status changes.
   * @returns {Promise<void>}
   */
  async checkConnection() {
    if (!config.lighting.homeAssistantToken) {
      return;
    }

    const wasConnected = this._connected;

    try {
      await axios.get(`${config.lighting.homeAssistantUrl}/api/`, {
        headers: this._getHeaders(),
        timeout: 5000,
      });
      this._connected = true;
    } catch {
      this._connected = false;
    }

    if (wasConnected !== this._connected) {
      this.emit('connection:changed', { connected: this._connected });

      if (this._connected) {
        logger.info('Home Assistant connection established');
        this._clearReconnect();
      } else {
        logger.warn('Home Assistant connection lost');
        this._startReconnect();
      }
    }
  }

  // ── Scene management ──

  /**
   * Fetch scenes from Home Assistant.
   * If HA is unreachable, falls back to local fixtures for testing/dev.
   * GET /api/states, filter scene.* entities.
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getScenes() {
    try {
      if (!this._connected && !config.lighting.homeAssistantToken) {
        return this._loadFallbackScenes();
      }

      const response = await axios.get(`${config.lighting.homeAssistantUrl}/api/states`, {
        headers: this._getHeaders(),
        timeout: 5000, // Reduced timeout for faster fallback
      });

      const scenes = response.data
        .filter((entity) => entity.entity_id.startsWith('scene.'))
        .map((entity) => ({
          id: entity.entity_id,
          name: entity.attributes.friendly_name,
        }));

      this._scenes = scenes;
      this._usingFallback = false;
      return scenes;
    } catch (err) {
      logger.warn('Failed to fetch scenes from Home Assistant — using fallback fixtures', {
        error: err.message
      });
      return this._loadFallbackScenes();
    }
  }

  /**
   * Load scenes from local fixture file.
   * @returns {Promise<Array<{id: string, name: string}>>}
   * @private
   */
  async _loadFallbackScenes() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      // Resolve path relative to this file: ../../tests/fixtures/scenes.json
      const fixturePath = path.join(__dirname, '../../tests/fixtures/scenes.json');

      const data = await fs.readFile(fixturePath, 'utf8');
      const scenes = JSON.parse(data);

      this._scenes = scenes;
      this._usingFallback = true;
      logger.info('Loaded fallback lighting scenes', { count: scenes.length });
      return scenes;
    } catch (err) {
      logger.error('Failed to load fallback scenes', { error: err.message });
      return [];
    }
  }

  /**
   * Return cached scene list without making an HTTP call.
   * @returns {Array<{id: string, name: string}>}
   */
  getCachedScenes() {
    return this._scenes;
  }

  /**
   * Re-fetch scenes from HA, update cache, emit scenes:refreshed.
   * @returns {Promise<void>}
   */
  async refreshScenes() {
    const scenes = await this.getScenes();
    this.emit('scenes:refreshed', { scenes });
  }

  /**
   * Activate a scene.
   * If using fallback or HA unreachable, simulates activation.
   * POST /api/services/scene/turn_on with {entity_id}.
   * Emits scene:activated with {sceneId, sceneName}.
   * @param {string} sceneId - The scene entity_id (e.g. 'scene.game')
   * @returns {Promise<void>}
   */
  async activateScene(sceneId) {
    // Resolve friendly name from cache
    const cached = this._scenes.find((s) => s.id === sceneId);
    const sceneName = cached ? cached.name : sceneId;

    if (this._usingFallback || !this._connected) {
      logger.info('Simulating scene activation (Fallback/Offline)', { sceneId, sceneName });
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      try {
        await axios.post(
          `${config.lighting.homeAssistantUrl}/api/services/scene/turn_on`,
          { entity_id: sceneId },
          { headers: this._getHeaders(), timeout: 5000 }
        );
        logger.info('Scene activated via HA', { sceneId, sceneName });
      } catch (err) {
        logger.error('Failed to activate scene on HA', { sceneId, error: err.message });
        // Don't throw, just log. UI should still update optimistically or we could choose not to emit.
        // For now, we emit so the UI feels responsive even if HA flakes.
      }
    }

    this._activeScene = sceneId;
    this.emit('scene:activated', { sceneId, sceneName });
  }

  /**
   * Return the last-activated scene ID, or null.
   * @returns {string|null}
   */
  getActiveScene() {
    return this._activeScene;
  }

  // ── Lifecycle ──

  /**
   * Clean up resources — clears reconnect interval and optionally stops
   * the HA Docker container (only if we started it).
   * @returns {Promise<void>}
   */
  async cleanup() {
    this._clearReconnect();

    if (this._containerStartedByUs) {
      const container = config.lighting.dockerContainer;
      const timeout = config.lighting.dockerStopTimeout;
      try {
        logger.info('Stopping HA Docker container (we started it)', { container });
        await dockerHelper.stopContainer(container, timeout);
        logger.info('HA Docker container stopped', { container });
      } catch (err) {
        logger.warn('Failed to stop HA Docker container', { container, error: err.message });
      }
      this._containerStartedByUs = false;
    }

    logger.info('Lighting service cleaned up');
  }

  /**
   * Full reset for tests: clear interval, remove listeners, reset state.
   */
  reset() {
    this._clearReconnect();
    this.removeAllListeners();
    this._connected = false;
    this._usingFallback = false;
    this._scenes = [];
    this._activeScene = null;
    this._containerStartedByUs = false;
  }

  // ── Private helpers ──

  /**
   * Ensure the HA Docker container is running.
   * Skipped in test env or when dockerManage is disabled.
   * Non-blocking: catches all errors, logs warnings, never throws.
   * @returns {Promise<void>}
   * @private
   */
  async _ensureContainerRunning() {
    if (process.env.NODE_ENV === 'test' || !config.lighting.dockerManage) {
      return;
    }

    const container = config.lighting.dockerContainer;

    try {
      const exists = await dockerHelper.containerExists(container);
      if (!exists) {
        logger.info('HA Docker container not found — skipping auto-start', { container });
        return;
      }

      const running = await dockerHelper.isContainerRunning(container);
      if (running) {
        logger.info('HA Docker container already running', { container });
        return;
      }

      logger.info('Starting HA Docker container', { container });
      await dockerHelper.startContainer(container);
      this._containerStartedByUs = true;
      logger.info('HA Docker container started', { container });
    } catch (err) {
      logger.warn('Failed to manage HA Docker container — continuing without', {
        container,
        error: err.message,
      });
    }
  }

  /**
   * Build the auth headers for HA API calls.
   * @returns {Object}
   * @private
   */
  _getHeaders() {
    return {
      Authorization: `Bearer ${config.lighting.homeAssistantToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Start periodic reconnect interval (30s).
   * Only starts if not already running.
   * @private
   */
  _startReconnect() {
    if (this._reconnectInterval) {
      return;
    }
    this._reconnectInterval = setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  /**
   * Clear the periodic reconnect interval.
   * @private
   */
  _clearReconnect() {
    if (this._reconnectInterval) {
      clearInterval(this._reconnectInterval);
      this._reconnectInterval = null;
    }
  }
}

// Export singleton instance
module.exports = new LightingService();
