/**
 * AdminConfig Model
 * System configuration managed through admin panel
 */

const { adminConfigSchema, validate } = require('../utils/validators');
const bcrypt = require('bcrypt');

class AdminConfig {
  /**
   * Create a new AdminConfig instance
   * @param {Object} data - AdminConfig data
   */
  constructor(data = {}) {
    // Set defaults
    if (!data.vlcConfig) {
      data.vlcConfig = {
        host: 'localhost',
        port: 8080,
        password: 'vlc',
      };
    }

    if (!data.sessionConfig) {
      data.sessionConfig = {
        maxPlayers: 10,
        maxGmStations: 5,
        duplicateWindow: 5,
        sessionTimeout: 120,
      };
    }

    if (!data.networkConfig) {
      data.networkConfig = {
        orchestratorPort: 3000,
        corsOrigins: ['http://localhost:3000', 'http://localhost:8080'],
        staticIps: {},
      };
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate admin config data
   * @param {Object} data - AdminConfig data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, adminConfigSchema);
    return validated;
  }

  /**
   * Check if VLC is configured
   * @returns {boolean}
   */
  isVlcConfigured() {
    return !!(this.vlcConfig && 
              this.vlcConfig.host && 
              this.vlcConfig.port && 
              this.vlcConfig.password);
  }

  /**
   * Get VLC connection URL
   * @returns {string}
   */
  getVlcUrl() {
    return `http://${this.vlcConfig.host}:${this.vlcConfig.port}`;
  }

  /**
   * Check if a CORS origin is allowed
   * @param {string} origin - Origin to check
   * @returns {boolean}
   */
  isOriginAllowed(origin) {
    return this.networkConfig.corsOrigins.includes(origin);
  }

  /**
   * Add a CORS origin
   * @param {string} origin - Origin to add
   * @returns {boolean} True if added, false if already exists
   */
  addCorsOrigin(origin) {
    if (this.isOriginAllowed(origin)) {
      return false;
    }
    this.networkConfig.corsOrigins.push(origin);
    return true;
  }

  /**
   * Remove a CORS origin
   * @param {string} origin - Origin to remove
   * @returns {boolean} True if removed, false if not found
   */
  removeCorsOrigin(origin) {
    const index = this.networkConfig.corsOrigins.indexOf(origin);
    if (index === -1) {
      return false;
    }
    this.networkConfig.corsOrigins.splice(index, 1);
    return true;
  }

  /**
   * Get static IP for device
   * @param {string} deviceId - Device ID
   * @returns {string|null} Static IP or null if not configured
   */
  getStaticIp(deviceId) {
    return this.networkConfig.staticIps?.[deviceId] || null;
  }

  /**
   * Set static IP for device
   * @param {string} deviceId - Device ID
   * @param {string} ipAddress - IP address to assign
   */
  setStaticIp(deviceId, ipAddress) {
    if (!this.networkConfig.staticIps) {
      this.networkConfig.staticIps = {};
    }
    this.networkConfig.staticIps[deviceId] = ipAddress;
  }

  /**
   * Remove static IP for device
   * @param {string} deviceId - Device ID
   * @returns {boolean} True if removed, false if not found
   */
  removeStaticIp(deviceId) {
    if (!this.networkConfig.staticIps?.[deviceId]) {
      return false;
    }
    delete this.networkConfig.staticIps[deviceId];
    return true;
  }

  /**
   * Check if device count is within limits
   * @param {number} playerCount - Current player count
   * @param {number} gmCount - Current GM count
   * @returns {Object} Validation result
   */
  validateDeviceLimits(playerCount, gmCount) {
    return {
      playersOk: playerCount <= this.sessionConfig.maxPlayers,
      gmsOk: gmCount <= this.sessionConfig.maxGmStations,
      playersRemaining: Math.max(0, this.sessionConfig.maxPlayers - playerCount),
      gmsRemaining: Math.max(0, this.sessionConfig.maxGmStations - gmCount),
    };
  }

  /**
   * Update VLC configuration
   * @param {Object} vlcConfig - New VLC configuration
   */
  updateVlcConfig(vlcConfig) {
    Object.assign(this.vlcConfig, vlcConfig);
    this.validate(this);
  }

  /**
   * Update session configuration
   * @param {Object} sessionConfig - New session configuration
   */
  updateSessionConfig(sessionConfig) {
    Object.assign(this.sessionConfig, sessionConfig);
    this.validate(this);
  }

  /**
   * Update network configuration
   * @param {Object} networkConfig - New network configuration
   */
  updateNetworkConfig(networkConfig) {
    Object.assign(this.networkConfig, networkConfig);
    this.validate(this);
  }

  /**
   * Hash VLC password for storage
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  static async hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify VLC password
   * @param {string} password - Plain text password to verify
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  static async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Convert to JSON representation (with password masked)
   * @returns {Object}
   */
  toJSON() {
    return {
      vlcConfig: {
        host: this.vlcConfig.host,
        port: this.vlcConfig.port,
        password: '***', // Never expose password
      },
      sessionConfig: this.sessionConfig,
      networkConfig: this.networkConfig,
    };
  }

  /**
   * Convert to secure JSON (for storage)
   * @returns {Object}
   */
  toSecureJSON() {
    return {
      vlcConfig: this.vlcConfig,
      sessionConfig: this.sessionConfig,
      networkConfig: this.networkConfig,
    };
  }

  /**
   * Create AdminConfig from JSON data
   * @param {Object} json - JSON data
   * @returns {AdminConfig}
   */
  static fromJSON(json) {
    return new AdminConfig(json);
  }

  /**
   * Create default admin configuration
   * @returns {AdminConfig}
   */
  static createDefault() {
    return new AdminConfig();
  }

  /**
   * Merge configurations (for updates)
   * @param {AdminConfig} current - Current configuration
   * @param {Object} updates - Updates to apply
   * @returns {AdminConfig}
   */
  static merge(current, updates) {
    const merged = current.toSecureJSON();

    if (updates.vlcConfig) {
      Object.assign(merged.vlcConfig, updates.vlcConfig);
    }

    if (updates.sessionConfig) {
      Object.assign(merged.sessionConfig, updates.sessionConfig);
    }

    if (updates.networkConfig) {
      Object.assign(merged.networkConfig, updates.networkConfig);
    }

    return new AdminConfig(merged);
  }
}

module.exports = AdminConfig;