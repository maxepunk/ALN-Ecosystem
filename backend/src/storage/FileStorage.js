/**
 * File Storage
 * Production storage implementation using node-persist
 * Wraps node-persist with proper cleanup and error handling
 */

const StorageInterface = require('./StorageInterface');
const storage = require('node-persist');
const path = require('path');
const logger = require('../utils/logger');

class FileStorage extends StorageInterface {
  constructor() {
    super();
    this.initialized = false;
    this.storageInstance = null;
    this.dataDir = null;
  }

  /**
   * Initialize the storage
   * @param {Object} options - Storage options
   * @returns {Promise<void>}
   */
  async init(options = {}) {
    if (this.initialized) {
      return;
    }

    try {
      // Create a new storage instance instead of using default
      // This allows proper cleanup and isolation
      this.storageInstance = storage.create();

      this.dataDir = options.dataDir || path.join(process.cwd(), 'data');

      await this.storageInstance.init({
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
      logger.info('File storage initialized', { dataDir: this.dataDir });
    } catch (error) {
      logger.error('Failed to initialize file storage', error);
      throw error;
    }
  }

  /**
   * Save data with key
   * @param {string} key - Storage key
   * @param {any} value - Data to store
   * @returns {Promise<void>}
   */
  async save(key, value) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    try {
      await this.storageInstance.setItem(key, value);
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
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    try {
      const data = await this.storageInstance.getItem(key);
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
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    try {
      await this.storageInstance.removeItem(key);
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
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    const data = await this.storageInstance.getItem(key);
    return data !== undefined;
  }

  /**
   * Get all keys
   * @returns {Promise<Array<string>>}
   */
  async keys() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    return this.storageInstance.keys();
  }

  /**
   * Get all values
   * @returns {Promise<Array>}
   */
  async values() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    return this.storageInstance.values();
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    try {
      await this.storageInstance.clear();
      logger.warn('All data cleared from file storage');
    } catch (error) {
      logger.error('Failed to clear storage', error);
      throw error;
    }
  }

  /**
   * Get storage size
   * @returns {Promise<number>} Number of stored items
   */
  async size() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    const keys = await this.storageInstance.keys();
    return keys.length;
  }

  /**
   * Cleanup resources (intervals, file handles)
   * CRITICAL for proper shutdown and test cleanup
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (!this.initialized || !this.storageInstance) {
      return;
    }

    try {
      // Stop the intervals created by node-persist
      // These are the root cause of our test isolation issues
      if (typeof this.storageInstance.stopExpiredKeysInterval === 'function') {
        this.storageInstance.stopExpiredKeysInterval();
      }
      if (typeof this.storageInstance.stopWriteQueueInterval === 'function') {
        this.storageInstance.stopWriteQueueInterval();
      }

      // Fallback: directly clear intervals if methods aren't available
      // node-persist stores these as private properties
      if (this.storageInstance._expiredKeysInterval) {
        clearInterval(this.storageInstance._expiredKeysInterval);
        this.storageInstance._expiredKeysInterval = null;
      }
      if (this.storageInstance._writeQueueInterval) {
        clearInterval(this.storageInstance._writeQueueInterval);
        this.storageInstance._writeQueueInterval = null;
      }

      this.initialized = false;
      this.storageInstance = null;
      logger.info('File storage cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup file storage', { error });
    }
  }

  /**
   * Reset storage
   * @returns {Promise<void>}
   */
  async reset() {
    await this.cleanup();
    this.initialized = false;
    this.storageInstance = null;
  }
}

module.exports = FileStorage;