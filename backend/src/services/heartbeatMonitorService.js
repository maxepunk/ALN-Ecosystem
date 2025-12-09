/**
 * Heartbeat Monitor Service
 * Monitors HTTP-based devices (player scanners, ESP32) for heartbeat timeouts
 *
 * HTTP devices poll /health?deviceId=X&type=player to maintain connection.
 * This service periodically checks lastHeartbeat using the existing
 * DeviceConnection.hasTimedOut() method and marks devices as disconnected
 * when they stop polling.
 *
 * Uses shared disconnectDevice helper for consistency with WebSocket disconnects.
 * Follows vlcService pattern for lifecycle management.
 */

const logger = require('../utils/logger');
const sessionService = require('./sessionService');
const DeviceConnection = require('../models/deviceConnection');
const { disconnectDevice } = require('../websocket/deviceHelpers');

// Configuration - match player scanner polling interval (10s) with 3x tolerance
const HEARTBEAT_TIMEOUT_MS = 30000;  // 30 seconds (player scanner polls every 10s)
const CHECK_INTERVAL_MS = 15000;     // Check every 15 seconds

class HeartbeatMonitorService {
  constructor() {
    this.io = null;
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Initialize the service with Socket.io instance
   * @param {Server} io - Socket.io server instance
   */
  init(io) {
    if (!io) {
      throw new Error('HeartbeatMonitorService requires Socket.io instance');
    }
    this.io = io;
    logger.info('HeartbeatMonitorService initialized');
  }

  /**
   * Start monitoring device heartbeats
   * Follows pattern from vlcService.startHealthCheck()
   */
  start() {
    if (this.isRunning) {
      logger.warn('HeartbeatMonitorService already running');
      return;
    }

    if (!this.io) {
      throw new Error('HeartbeatMonitorService not initialized - call init() first');
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.checkDeviceHeartbeats();
    }, CHECK_INTERVAL_MS);

    logger.info('HeartbeatMonitorService started', {
      timeoutMs: HEARTBEAT_TIMEOUT_MS,
      checkIntervalMs: CHECK_INTERVAL_MS
    });
  }

  /**
   * Stop monitoring device heartbeats
   * Follows pattern from vlcService.stopHealthCheck()
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('HeartbeatMonitorService stopped');
  }

  /**
   * Check all HTTP-based devices for heartbeat timeout
   * Uses existing DeviceConnection.hasTimedOut() method
   */
  async checkDeviceHeartbeats() {
    const session = sessionService.getCurrentSession();
    if (!session) {
      return; // No session, nothing to check
    }

    const devicesToDisconnect = [];

    // Find HTTP-based devices (player, esp32) that have timed out
    // GM devices use WebSocket and are handled by deviceTracking.js
    for (const deviceData of session.connectedDevices) {
      // Skip devices that are already disconnected
      if (deviceData.connectionStatus !== 'connected') {
        continue;
      }

      // Skip WebSocket-based devices (GM) - they're handled by deviceTracking.js
      if (deviceData.type === 'gm') {
        continue;
      }

      // Use existing DeviceConnection model to check timeout
      const device = DeviceConnection.fromJSON(deviceData);
      if (device.hasTimedOut(HEARTBEAT_TIMEOUT_MS)) {
        devicesToDisconnect.push(deviceData);
      }
    }

    // Process disconnections using shared helper
    for (const device of devicesToDisconnect) {
      try {
        await disconnectDevice(this.io, device, 'timeout');
      } catch (error) {
        logger.error('Failed to disconnect timed-out device', {
          deviceId: device.id,
          error: error.message
        });
      }
    }
  }

  /**
   * Reset the service (for testing)
   * Follows pattern from other services
   */
  reset() {
    this.stop();
    this.io = null;
  }
}

// Export singleton instance
module.exports = new HeartbeatMonitorService();
