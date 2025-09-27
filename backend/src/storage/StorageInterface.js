/**
 * Storage Interface
 * Abstract base class for all storage implementations
 * Defines the contract that all storage backends must implement
 */

class StorageInterface {
  /**
   * Initialize the storage backend
   * @param {Object} options - Backend-specific options
   * @returns {Promise<void>}
   */
  async init(options = {}) {
    throw new Error('init() must be implemented by subclass');
  }

  /**
   * Save data with key
   * @param {string} key - Storage key
   * @param {any} value - Data to store
   * @returns {Promise<void>}
   */
  async save(key, value) {
    throw new Error('save() must be implemented by subclass');
  }

  /**
   * Load data by key
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored data or null
   */
  async load(key) {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Delete data by key
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async delete(key) {
    throw new Error('delete() must be implemented by subclass');
  }

  /**
   * Check if key exists
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('exists() must be implemented by subclass');
  }

  /**
   * Get all keys
   * @returns {Promise<Array<string>>}
   */
  async keys() {
    throw new Error('keys() must be implemented by subclass');
  }

  /**
   * Get all values
   * @returns {Promise<Array>}
   */
  async values() {
    throw new Error('values() must be implemented by subclass');
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  /**
   * Get storage size
   * @returns {Promise<number>} Number of stored items
   */
  async size() {
    throw new Error('size() must be implemented by subclass');
  }

  /**
   * Cleanup resources (intervals, file handles, etc)
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Default implementation - subclasses can override if needed
    // No-op for storage backends that don't need cleanup
  }

  /**
   * Reset storage (mainly for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    await this.cleanup();
    await this.clear();
  }
}

module.exports = StorageInterface;