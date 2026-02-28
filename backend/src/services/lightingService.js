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
const WebSocket = require('ws');
const config = require('../config');
const logger = require('../utils/logger');
const dockerHelper = require('../utils/dockerHelper');
const registry = require('./serviceHealthRegistry');

class LightingService extends EventEmitter {
  constructor() {
    super();
    this._scenes = [];
    this._activeScene = null;
    this._reconnectInterval = null;
    this._containerStartedByUs = false;

    // WebSocket real-time event monitor
    this._ws = null;
    this._wsReconnectTimer = null;
    this._wsReconnectAttempts = 0;
    this._wsMessageId = 0;
    this._wsStopped = false;
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

      if (registry.isHealthy('lighting')) {
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

    // Start periodic reconnect when disconnected (HTTP fallback).
    // Defense-in-depth: WebSocket is primary for real-time events, but
    // HTTP polling acts as a slow fallback if the WS connection fails
    // silently (e.g., proxy drops without close frame). 30s interval
    // is slow enough to avoid health status flicker with WS lifecycle.
    if (!registry.isHealthy('lighting')) {
      this._startReconnect();
    }

    // Start WebSocket connection for real-time event monitoring (primary)
    this._connectWebSocket();
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
    return registry.isHealthy('lighting');
  }

  /**
   * Ping Home Assistant API to check connection status.
   * Reports health to serviceHealthRegistry.
   * @returns {Promise<void>}
   */
  async checkConnection() {
    if (!config.lighting.homeAssistantToken) {
      return;
    }

    const wasHealthy = registry.isHealthy('lighting');

    try {
      await axios.get(`${config.lighting.homeAssistantUrl}/api/`, {
        headers: this._getHeaders(),
        timeout: 5000,
      });
      registry.report('lighting', 'healthy', 'Connected to Home Assistant');
    } catch {
      registry.report('lighting', 'down', 'Home Assistant unreachable');
    }

    const isNowHealthy = registry.isHealthy('lighting');

    if (wasHealthy !== isNowHealthy) {
      if (isNowHealthy) {
        logger.info('Home Assistant connection established');
        this._clearReconnect();
      } else {
        logger.warn('Home Assistant connection lost');
        this._startReconnect();
      }
    }
  }

  // ── WebSocket real-time event monitor ──

  /**
   * Connect to Home Assistant WebSocket API for real-time events.
   * Non-blocking: logs warning on failure, never throws.
   * @private
   */
  _connectWebSocket() {
    if (!config.lighting.homeAssistantToken || this._wsStopped) {
      return;
    }

    const wsUrl = config.lighting.homeAssistantUrl.replace(/^http/, 'ws') + '/api/websocket';

    try {
      this._ws = new WebSocket(wsUrl);
    } catch (err) {
      logger.warn('Failed to create HA WebSocket connection', { error: err.message });
      return;
    }

    this._ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleWsMessage(msg);
      } catch (err) {
        logger.debug('Failed to parse HA WebSocket message', { error: err.message });
      }
    });

    this._ws.on('close', () => {
      this._handleWsClose();
    });

    this._ws.on('error', (err) => {
      logger.debug('HA WebSocket error', { error: err.message });
    });
  }

  /**
   * Handle incoming HA WebSocket message.
   * @param {Object} msg - Parsed JSON message
   * @private
   */
  _handleWsMessage(msg) {
    switch (msg.type) {
      case 'auth_required':
        this._ws.send(JSON.stringify({
          type: 'auth',
          access_token: config.lighting.homeAssistantToken,
        }));
        break;

      case 'auth_ok':
        this._wsReconnectAttempts = 0;
        this._wsMessageId++;
        this._ws.send(JSON.stringify({
          id: this._wsMessageId,
          type: 'subscribe_events',
          event_type: 'state_changed',
        }));
        registry.report('lighting', 'healthy', 'Connected via WebSocket');
        logger.info('HA WebSocket authenticated and subscribed');
        break;

      case 'auth_invalid':
        logger.error('HA WebSocket auth failed — invalid token');
        if (this._ws) this._ws.close();
        this._wsStopped = true; // Don't reconnect with bad token
        break;

      case 'event':
        if (msg.event?.data) {
          this._handleStateChanged(msg.event.data);
        }
        break;

      case 'result':
        // Subscription acknowledgement — no action needed
        break;
    }
  }

  /**
   * Handle HA state_changed event data.
   * @param {Object} eventData - { entity_id, new_state: { state, attributes } }
   * @private
   */
  _handleStateChanged(eventData) {
    const { entity_id, new_state } = eventData;

    if (entity_id?.startsWith('scene.') && new_state?.state === 'scening') {
      const sceneName = new_state.attributes?.friendly_name || entity_id;
      this._activeScene = entity_id;
      this.emit('scene:activated', { sceneId: entity_id, sceneName });
      logger.info('Scene activated via HA WebSocket', { sceneId: entity_id, sceneName });
    }
  }

  /**
   * Handle WebSocket close — schedule reconnect with backoff.
   * @private
   */
  _handleWsClose() {
    this._ws = null;

    if (this._wsStopped) return;

    registry.report('lighting', 'down', 'WebSocket disconnected');

    this._wsReconnectAttempts++;
    const delay = Math.min(5000 * this._wsReconnectAttempts, 30000);

    this._wsReconnectTimer = setTimeout(() => {
      this._wsReconnectTimer = null;
      if (!this._wsStopped) {
        logger.info('Reconnecting HA WebSocket', { attempt: this._wsReconnectAttempts });
        this._connectWebSocket();
      }
    }, delay);
  }

  /**
   * Close WebSocket and prevent reconnection.
   * @private
   */
  _closeWebSocket() {
    this._wsStopped = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    if (this._wsReconnectTimer) {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = null;
    }
    this._wsReconnectAttempts = 0;
    this._wsMessageId = 0;
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
      // Short-circuit to fallback only when BOTH conditions are true (no token AND unhealthy).
      // When only one is true, the axios call below will fail and the catch block handles fallback.
      if (!registry.isHealthy('lighting') && !config.lighting.homeAssistantToken) {
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

  sceneExists(sceneId) {
    return this._scenes.some((s) => s.id === sceneId);
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
   * Throws if lighting is unavailable or HA API call fails.
   * POST /api/services/scene/turn_on with {entity_id}.
   * Emits scene:activated with {sceneId, sceneName} only on confirmed success.
   * @param {string} sceneId - The scene entity_id (e.g. 'scene.game')
   * @returns {Promise<void>}
   */
  async activateScene(sceneId) {
    if (!registry.isHealthy('lighting')) {
      throw new Error('Lighting service not connected');
    }

    // Resolve friendly name from cache
    const cached = this._scenes.find((s) => s.id === sceneId);
    const sceneName = cached ? cached.name : sceneId;

    await axios.post(
      `${config.lighting.homeAssistantUrl}/api/services/scene/turn_on`,
      { entity_id: sceneId },
      { headers: this._getHeaders(), timeout: 5000 }
    );
    logger.info('Scene activated via HA', { sceneId, sceneName });

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
    this._closeWebSocket();

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
    this._closeWebSocket();
    this._wsStopped = false; // Allow reconnect after reset (unlike cleanup)
    this.removeAllListeners();
    registry.report('lighting', 'down', 'Reset');
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
