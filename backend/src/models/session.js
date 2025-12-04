/**
 * Session Model
 * Represents a complete game instance from start to finish
 */

const { v4: uuidv4 } = require('uuid');
const { sessionSchema, validate } = require('../utils/validators');

class Session {
  /**
   * Create a new Session instance
   * @param {Object} data - Session data
   */
  constructor(data = {}) {
    // Generate ID if not provided
    if (!data.id) {
      data.id = uuidv4();
    }

    // Set defaults
    if (!data.startTime) {
      data.startTime = new Date().toISOString();
    }

    if (!data.status) {
      data.status = 'active';
    }

    if (!data.transactions) {
      data.transactions = [];
    }

    if (!data.connectedDevices) {
      data.connectedDevices = [];
    }

    if (!data.videoQueue) {
      data.videoQueue = [];
    }

    if (!data.scores) {
      data.scores = [];
    }

    if (!data.metadata) {
      data.metadata = {
        gmStations: 0,
        playerDevices: 0,
        totalScans: 0,
        uniqueTokensScanned: [],
        scannedTokensByDevice: {},  // Per-device duplicate detection tracking
      };
    }

    // Ensure scannedTokensByDevice exists (migration for old sessions)
    if (!data.metadata.scannedTokensByDevice) {
      data.metadata.scannedTokensByDevice = {};
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate session data
   * @param {Object} data - Session data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, sessionSchema);
    return validated;
  }

  /**
   * Check if session is active
   * @returns {boolean}
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Check if session is paused
   * @returns {boolean}
   */
  isPaused() {
    return this.status === 'paused';
  }

  /**
   * Start/resume the session
   */
  start() {
    if (this.status === 'paused' || this.status === 'active') {
      this.status = 'active';
    } else {
      throw new Error(`Cannot start session with status ${this.status}`);
    }
  }

  /**
   * Pause the session
   */
  pause() {
    if (this.status === 'active') {
      this.status = 'paused';
    } else {
      throw new Error(`Cannot pause session with status ${this.status}`);
    }
  }

  /**
   * Complete the session (sets status to 'ended' per contract)
   */
  complete() {
    if (this.status === 'active' || this.status === 'paused') {
      this.status = 'ended';
      this.endTime = new Date().toISOString();
    } else {
      throw new Error(`Cannot complete session with status ${this.status}`);
    }
  }

  /**
   * Add a transaction to the session
   * @param {Object} transaction - Transaction to add
   * NOTE: Idempotent - won't add duplicate if already present
   */
  addTransaction(transaction) {
    // Idempotency check: Don't add if already in array
    // (transactionService adds to session.transactions atomically during processScan)
    const exists = this.transactions.some(tx => tx.id === transaction.id);
    if (exists) {
      return; // Already added, skip
    }

    this.transactions.push(transaction);
    this.metadata.totalScans++;

    // Track unique tokens
    if (!this.metadata.uniqueTokensScanned.includes(transaction.tokenId)) {
      this.metadata.uniqueTokensScanned.push(transaction.tokenId);
    }

    // Scores are managed by transactionService, NOT by Session model
    // Session only stores transactions for persistence
  }

  /**
   * Add or update a device connection
   * @param {Object} device - Device connection to add/update
   * @returns {boolean} True if device was newly added, false if updated
   */
  updateDevice(device) {
    const index = this.connectedDevices.findIndex(d => d.id === device.id);
    const isNew = index === -1;

    if (index >= 0) {
      this.connectedDevices[index] = device;
    } else {
      this.connectedDevices.push(device);
      if (device.type === 'gm') {
        this.metadata.gmStations++;
      } else {
        this.metadata.playerDevices++;
      }
    }

    return isNew;
  }

  /**
   * Remove a device connection
   * @param {string} deviceId - Device ID to remove
   */
  removeDevice(deviceId) {
    const index = this.connectedDevices.findIndex(d => d.id === deviceId);
    if (index >= 0) {
      const device = this.connectedDevices[index];
      this.connectedDevices.splice(index, 1);
      if (device.type === 'gm') {
        this.metadata.gmStations = Math.max(0, this.metadata.gmStations - 1);
      } else {
        this.metadata.playerDevices = Math.max(0, this.metadata.playerDevices - 1);
      }
      // console.log(`[Session] Removed device ${deviceId}. Remaining GMs: ${this.metadata.gmStations}`);
    }
  }

  /**
   * Get recent transactions
   * @param {number|null} count - Number of recent transactions to return (null = all)
   * @returns {Array} Recent transactions
   */
  getRecentTransactions(count = null) {
    // Return all transactions by default (null = all)
    // CRITICAL: sync:full needs complete transaction history for frontend team details
    if (count === null) {
      return this.transactions;
    }

    // If count specified, return last N transactions (backward compatible)
    const start = Math.max(0, this.transactions.length - count);
    return this.transactions.slice(start);
  }

  /**
   * Get active video queue items
   * @returns {Array} Active video queue items
   */
  getActiveVideoQueue() {
    return this.videoQueue.filter(item => item.status === 'pending' || item.status === 'playing');
  }

  /**
   * Get connected devices by type
   * @param {string} type - Device type ('gm' or 'player')
   * @returns {Array} Connected devices of specified type
   */
  getConnectedDevicesByType(type) {
    return this.connectedDevices.filter(d => d.type === type && d.connectionStatus === 'connected');
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime || null,
      status: this.status,
      teams: this.scores.map(score => score.teamId),
      transactions: this.transactions,
      connectedDevices: this.connectedDevices,
      videoQueue: this.videoQueue,
      scores: this.scores,
      metadata: this.metadata,
    };
  }

  /**
   * Convert to API response representation (OpenAPI compliant)
   * Only returns fields defined in the API contract
   * @returns {Object}
   */
  toAPIResponse() {
    return {
      id: this.id,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime || null,
      status: this.status,
      metadata: this.metadata,
    };
  }

  /**
   * Create Session from JSON data
   * @param {Object} json - JSON data
   * @returns {Session}
   */
  static fromJSON(json) {
    return new Session(json);
  }

  /**
   * Get session duration in seconds
   * @returns {number} Duration in seconds
   */
  getDuration() {
    const start = new Date(this.startTime).getTime();
    const end = this.endTime
      ? new Date(this.endTime).getTime()
      : Date.now();
    return Math.floor((end - start) / 1000);
  }

  /**
   * Check if session can accept more GM stations
   * @param {number} maxGmStations - Maximum allowed GM stations
   * @returns {boolean}
   */
  canAcceptGmStation(maxGmStations) {
    const connectedGms = this.getConnectedDevicesByType('gm').length;
    return connectedGms < maxGmStations;
  }

  /**
   * Get scanned tokens for a specific device
   * @param {string} deviceId - Device ID
   * @returns {Set<string>} Set of scanned token IDs
   */
  getDeviceScannedTokens(deviceId) {
    if (!this.metadata.scannedTokensByDevice[deviceId]) {
      this.metadata.scannedTokensByDevice[deviceId] = [];
    }

    // Return as Set for O(1) lookup performance
    return new Set(this.metadata.scannedTokensByDevice[deviceId]);
  }

  /**
   * Check if a device has already scanned a token
   * @param {string} deviceId - Device ID
   * @param {string} tokenId - Token ID
   * @returns {boolean} True if device has scanned this token
   */
  hasDeviceScannedToken(deviceId, tokenId) {
    const scannedTokens = this.getDeviceScannedTokens(deviceId);
    return scannedTokens.has(tokenId);
  }

  /**
   * Add a scanned token for a device
   * @param {string} deviceId - Device ID
   * @param {string} tokenId - Token ID to add
   */
  addDeviceScannedToken(deviceId, tokenId) {
    if (!this.metadata.scannedTokensByDevice[deviceId]) {
      this.metadata.scannedTokensByDevice[deviceId] = [];
    }

    // Only add if not already present
    if (!this.metadata.scannedTokensByDevice[deviceId].includes(tokenId)) {
      this.metadata.scannedTokensByDevice[deviceId].push(tokenId);
    }
  }

  /**
   * Get all scanned tokens for a device as array (for serialization)
   * @param {string} deviceId - Device ID
   * @returns {Array<string>} Array of scanned token IDs
   */
  getDeviceScannedTokensArray(deviceId) {
    return this.metadata.scannedTokensByDevice[deviceId] || [];
  }
}

module.exports = Session;
