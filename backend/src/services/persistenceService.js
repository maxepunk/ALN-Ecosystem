/**
 * Persistence Service
 * Node-persist based storage for all game data
 */

const storage = require('node-persist');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

class PersistenceService {
  constructor() {
    this.initialized = false;
    this.dataDir = config.storage.dataDir;
  }

  /**
   * Initialize storage
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      await storage.init({
        dir: this.dataDir,
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,
        ttl: false,
        expiredInterval: 2 * 60 * 1000, // 2 minutes
        forgiveParseErrors: false,
      });

      this.initialized = true;
      logger.info('Persistence service initialized', { dataDir: this.dataDir });
    } catch (error) {
      logger.error('Failed to initialize persistence service', error);
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Save data with key
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   * @returns {Promise<void>}
   */
  async save(key, data) {
    await this.ensureInitialized();
    try {
      await storage.setItem(key, data);
      logger.debug('Data saved', { key });
    } catch (error) {
      logger.error('Failed to save data', { key, error });
      throw error;
    }
  }

  /**
   * Load data by key
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored data or null
   */
  async load(key) {
    await this.ensureInitialized();
    try {
      const data = await storage.getItem(key);
      logger.debug('Data loaded', { key, found: !!data });
      return data || null;
    } catch (error) {
      logger.error('Failed to load data', { key, error });
      throw error;
    }
  }

  /**
   * Delete data by key
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.ensureInitialized();
    try {
      await storage.removeItem(key);
      logger.debug('Data deleted', { key });
    } catch (error) {
      logger.error('Failed to delete data', { key, error });
      throw error;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    await this.ensureInitialized();
    const data = await storage.getItem(key);
    return data !== undefined;
  }

  /**
   * Get all keys
   * @returns {Promise<Array<string>>}
   */
  async keys() {
    await this.ensureInitialized();
    return storage.keys();
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    await this.ensureInitialized();
    try {
      await storage.clear();
      logger.warn('All data cleared from storage');
    } catch (error) {
      logger.error('Failed to clear storage', error);
      throw error;
    }
  }

  /**
   * Get all values
   * @returns {Promise<Array>}
   */
  async values() {
    await this.ensureInitialized();
    return storage.values();
  }

  /**
   * Get storage size
   * @returns {Promise<number>} Number of stored items
   */
  async size() {
    await this.ensureInitialized();
    const keys = await storage.keys();
    return keys.length;
  }

  /**
   * Save session data
   * @param {Object} session - Session to save
   * @returns {Promise<void>}
   */
  async saveSession(session) {
    const key = `session:${session.id}`;
    await this.save(key, session);
  }

  /**
   * Load session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>}
   */
  async loadSession(sessionId) {
    const key = `session:${sessionId}`;
    return this.load(key);
  }

  /**
   * Get all sessions
   * @returns {Promise<Array>}
   */
  async getAllSessions() {
    await this.ensureInitialized();
    const keys = await storage.keys();
    const sessionKeys = keys.filter(k => k.startsWith('session:'));
    const sessions = [];

    for (const key of sessionKeys) {
      const session = await storage.getItem(key);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Save game state
   * @param {Object} state - Game state to save
   * @returns {Promise<void>}
   */
  async saveGameState(state) {
    await this.save('gameState:current', state);
  }

  /**
   * Load game state
   * @returns {Promise<Object|null>}
   */
  async loadGameState() {
    return this.load('gameState:current');
  }

  /**
   * Save admin configuration
   * @param {Object} config - Admin config to save
   * @returns {Promise<void>}
   */
  async saveAdminConfig(config) {
    await this.save('config:admin', config);
  }

  /**
   * Load admin configuration
   * @returns {Promise<Object|null>}
   */
  async loadAdminConfig() {
    return this.load('config:admin');
  }

  /**
   * Save token data
   * @param {Array} tokens - Tokens array
   * @returns {Promise<void>}
   */
  async saveTokens(tokens) {
    await this.save('tokens:all', tokens);
  }

  /**
   * Load token data
   * @returns {Promise<Array>}
   */
  async loadTokens() {
    const tokens = await this.load('tokens:all');
    return tokens || [];
  }

  /**
   * Create backup of session
   * @param {Object} session - Session to backup
   * @returns {Promise<void>}
   */
  async backupSession(session) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `backup:session:${session.id}:${timestamp}`;
    await this.save(key, session);
    logger.info('Session backed up', { sessionId: session.id, timestamp });
  }

  /**
   * Archive completed session
   * @param {Object} session - Session to archive
   * @returns {Promise<void>}
   */
  async archiveSession(session) {
    const key = `archive:session:${session.id}`;
    await this.save(key, session);
    await this.delete(`session:${session.id}`);
    logger.info('Session archived', { sessionId: session.id });
  }

  /**
   * Get archived sessions
   * @returns {Promise<Array>}
   */
  async getArchivedSessions() {
    await this.ensureInitialized();
    const keys = await storage.keys();
    const archiveKeys = keys.filter(k => k.startsWith('archive:session:'));
    const sessions = [];

    for (const key of archiveKeys) {
      const session = await storage.getItem(key);
      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Clean old backups
   * @param {number} maxAge - Maximum age in hours
   * @returns {Promise<number>} Number of backups deleted
   */
  async cleanOldBackups(maxAge = 24) {
    await this.ensureInitialized();
    const keys = await storage.keys();
    const backupKeys = keys.filter(k => k.startsWith('backup:'));
    const maxAgeMs = maxAge * 60 * 60 * 1000;
    const now = Date.now();
    let deleted = 0;

    for (const key of backupKeys) {
      // Extract timestamp from key
      const parts = key.split(':');
      const timestamp = parts[parts.length - 1];
      const backupTime = new Date(timestamp.replace(/-/g, ':')).getTime();

      if (now - backupTime > maxAgeMs) {
        await storage.removeItem(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info('Old backups cleaned', { deleted, maxAge });
    }

    return deleted;
  }
}

// Export singleton instance
module.exports = new PersistenceService();