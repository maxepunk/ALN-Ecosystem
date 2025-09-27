/**
 * Memory Storage
 * In-memory storage implementation for testing
 * No file I/O, no intervals, perfect isolation
 */

const StorageInterface = require('./StorageInterface');

class MemoryStorage extends StorageInterface {
  constructor() {
    super();
    this.data = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the storage
   * @param {Object} options - Ignored for memory storage
   * @returns {Promise<void>}
   */
  async init(options = {}) {
    this.initialized = true;
    // No file operations, no intervals - instant initialization
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
    // Deep clone to prevent reference issues
    this.data.set(key, JSON.parse(JSON.stringify(value)));
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
    const value = this.data.get(key);
    // Return deep clone to prevent mutations
    return value ? JSON.parse(JSON.stringify(value)) : null;
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
    this.data.delete(key);
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
    return this.data.has(key);
  }

  /**
   * Get all keys
   * @returns {Promise<Array<string>>}
   */
  async keys() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    return Array.from(this.data.keys());
  }

  /**
   * Get all values
   * @returns {Promise<Array>}
   */
  async values() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    // Return deep clones of all values
    return Array.from(this.data.values()).map(v =>
      JSON.parse(JSON.stringify(v))
    );
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    this.data.clear();
  }

  /**
   * Get storage size
   * @returns {Promise<number>} Number of stored items
   */
  async size() {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }
    return this.data.size;
  }

  /**
   * Cleanup resources - no-op for memory storage
   * @returns {Promise<void>}
   */
  async cleanup() {
    // No intervals, no file handles - nothing to clean up
    this.initialized = false;
  }

  /**
   * Reset storage
   * @returns {Promise<void>}
   */
  async reset() {
    this.data.clear();
    this.initialized = false;
  }
}

module.exports = MemoryStorage;