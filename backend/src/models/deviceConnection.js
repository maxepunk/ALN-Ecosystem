/**
 * DeviceConnection Model
 * Tracks connected scanner devices and GM stations
 */

const { deviceConnectionSchema, validate } = require('../utils/validators');

class DeviceConnection {
  /**
   * Create a new DeviceConnection instance
   * @param {Object} data - DeviceConnection data
   */
  constructor(data = {}) {
    // Set defaults
    if (!data.connectionTime) {
      data.connectionTime = new Date().toISOString();
    }

    if (!data.lastHeartbeat) {
      data.lastHeartbeat = new Date().toISOString();
    }

    if (!data.connectionStatus) {
      data.connectionStatus = 'connected';
    }

    if (!data.syncState) {
      data.syncState = {
        lastSyncTime: new Date().toISOString(),
        pendingUpdates: 0,
        syncErrors: 0,
      };
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate device connection data
   * @param {Object} data - DeviceConnection data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, deviceConnectionSchema);
    return validated;
  }

  /**
   * Check if device is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connectionStatus === 'connected';
  }

  /**
   * Check if device is disconnected
   * @returns {boolean}
   */
  isDisconnected() {
    return this.connectionStatus === 'disconnected';
  }

  /**
   * Check if device is reconnecting
   * @returns {boolean}
   */
  isReconnecting() {
    return this.connectionStatus === 'reconnecting';
  }

  /**
   * Check if device is a player scanner
   * @returns {boolean}
   */
  isPlayer() {
    return this.type === 'player';
  }

  /**
   * Check if device is a GM station
   * @returns {boolean}
   */
  isGM() {
    return this.type === 'gm';
  }

  /**
   * Update heartbeat timestamp
   */
  updateHeartbeat() {
    this.lastHeartbeat = new Date().toISOString();
  }

  /**
   * Check if device has timed out
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {boolean}
   */
  hasTimedOut(timeoutMs = 60000) {
    const lastBeat = new Date(this.lastHeartbeat).getTime();
    const now = Date.now();
    return (now - lastBeat) > timeoutMs;
  }

  /**
   * Mark device as connected
   */
  connect() {
    this.connectionStatus = 'connected';
    this.connectionTime = new Date().toISOString();
    this.lastHeartbeat = new Date().toISOString();
    this.syncState.syncErrors = 0;
  }

  /**
   * Mark device as disconnected
   */
  disconnect() {
    this.connectionStatus = 'disconnected';
  }

  /**
   * Mark device as reconnecting
   */
  reconnect() {
    this.connectionStatus = 'reconnecting';
  }

  /**
   * Update sync state after successful sync
   */
  syncSuccess() {
    this.syncState.lastSyncTime = new Date().toISOString();
    this.syncState.pendingUpdates = 0;
    this.syncState.syncErrors = 0;
  }

  /**
   * Update sync state after sync error
   */
  syncError() {
    this.syncState.syncErrors++;
  }

  /**
   * Add pending update
   */
  addPendingUpdate() {
    this.syncState.pendingUpdates++;
  }

  /**
   * Clear pending updates
   * @param {number} count - Number of updates to clear (default: all)
   */
  clearPendingUpdates(count = null) {
    if (count === null) {
      this.syncState.pendingUpdates = 0;
    } else {
      this.syncState.pendingUpdates = Math.max(0, this.syncState.pendingUpdates - count);
    }
  }

  /**
   * Check if device needs sync
   * @returns {boolean}
   */
  needsSync() {
    return this.syncState.pendingUpdates > 0;
  }

  /**
   * Get connection duration in seconds
   * @returns {number} Duration in seconds
   */
  getConnectionDuration() {
    const start = new Date(this.connectionTime).getTime();
    const now = Date.now();
    return Math.floor((now - start) / 1000);
  }

  /**
   * Get time since last sync in seconds
   * @returns {number} Time in seconds
   */
  getTimeSinceSync() {
    const lastSync = new Date(this.syncState.lastSyncTime).getTime();
    const now = Date.now();
    return Math.floor((now - lastSync) / 1000);
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name || null,
      connectionTime: this.connectionTime,
      lastHeartbeat: this.lastHeartbeat,
      connectionStatus: this.connectionStatus,
      ipAddress: this.ipAddress || null,
      syncState: this.syncState,
    };
  }

  /**
   * Create DeviceConnection from JSON data
   * @param {Object} json - JSON data
   * @returns {DeviceConnection}
   */
  static fromJSON(json) {
    return new DeviceConnection(json);
  }

  /**
   * Create DeviceConnection from WebSocket handshake
   * @param {Object} identifyData - Identify message data
   * @param {string} ipAddress - Device IP address
   * @returns {DeviceConnection}
   */
  static fromIdentify(identifyData, ipAddress = null) {
    return new DeviceConnection({
      id: identifyData.deviceId,
      type: identifyData.deviceType,
      name: identifyData.name || null,
      connectionTime: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      connectionStatus: 'connected',
      ipAddress: ipAddress,
      syncState: {
        lastSyncTime: new Date().toISOString(),
        pendingUpdates: 0,
        syncErrors: 0,
      },
    });
  }
}

module.exports = DeviceConnection;