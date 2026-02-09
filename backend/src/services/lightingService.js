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

class LightingService extends EventEmitter {
  constructor() {
    super();
    this._connected = false;
    this._scenes = [];
    this._activeScene = null;
    this._reconnectInterval = null;
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

    try {
      await this.checkConnection();

      if (this._connected) {
        await this._fetchScenes();
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
   * GET /api/states, filter scene.* entities.
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getScenes() {
    try {
      const response = await axios.get(`${config.lighting.homeAssistantUrl}/api/states`, {
        headers: this._getHeaders(),
        timeout: 10000,
      });

      const scenes = response.data
        .filter((entity) => entity.entity_id.startsWith('scene.'))
        .map((entity) => ({
          id: entity.entity_id,
          name: entity.attributes.friendly_name,
        }));

      this._scenes = scenes;
      return scenes;
    } catch (err) {
      logger.error('Failed to fetch scenes from Home Assistant', { error: err.message });
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
   * Activate a scene on Home Assistant.
   * POST /api/services/scene/turn_on with {entity_id}.
   * Emits scene:activated with {sceneId, sceneName}.
   * @param {string} sceneId - The scene entity_id (e.g. 'scene.game_start')
   * @returns {Promise<void>}
   */
  async activateScene(sceneId) {
    await axios.post(
      `${config.lighting.homeAssistantUrl}/api/services/scene/turn_on`,
      { entity_id: sceneId },
      { headers: this._getHeaders() }
    );

    this._activeScene = sceneId;

    // Resolve friendly name from cache
    const cached = this._scenes.find((s) => s.id === sceneId);
    const sceneName = cached ? cached.name : sceneId;

    this.emit('scene:activated', { sceneId, sceneName });
    logger.info('Scene activated', { sceneId, sceneName });
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
   * Clean up resources — clears reconnect interval.
   */
  cleanup() {
    this._clearReconnect();
    logger.info('Lighting service cleaned up');
  }

  /**
   * Full reset for tests: clear interval, remove listeners, reset state.
   */
  reset() {
    this._clearReconnect();
    this.removeAllListeners();
    this._connected = false;
    this._scenes = [];
    this._activeScene = null;
  }

  // ── Private helpers ──

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
   * Fetch scenes and store in cache (used during init).
   * @returns {Promise<void>}
   * @private
   */
  async _fetchScenes() {
    await this.getScenes();
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
