/**
 * Storage Factory
 * Returns appropriate storage implementation based on environment
 */

const MemoryStorage = require('./MemoryStorage');
const FileStorage = require('./FileStorage');
const StorageInterface = require('./StorageInterface');

/**
 * Create storage instance based on environment
 * @param {Object} options - Configuration options
 * @param {string} options.type - Force specific storage type ('memory' or 'file')
 * @param {string} options.dataDir - Data directory for file storage
 * @returns {StorageInterface} Storage implementation
 */
function createStorage(options = {}) {
  // Allow explicit type override
  if (options.type === 'memory') {
    return new MemoryStorage();
  }

  if (options.type === 'file') {
    return new FileStorage();
  }

  // Default: Use memory for tests, file for production
  const isTestEnvironment = process.env.NODE_ENV === 'test';

  if (isTestEnvironment) {
    // Tests always use memory storage for perfect isolation
    return new MemoryStorage();
  } else {
    // Production uses file storage for persistence
    return new FileStorage();
  }
}

module.exports = {
  createStorage,
  StorageInterface,
  MemoryStorage,
  FileStorage
};