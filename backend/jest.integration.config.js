/**
 * Jest Configuration - Integration Tests
 * Runs integration tests sequentially to prevent state contamination
 *
 * Usage: npm run test:integration
 */

const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,

  // Test discovery - ONLY integration tests
  roots: ['<rootDir>/tests'],
  testMatch: ['**/integration/**/*.test.js'],

  // Timing - integration tests need more time for multi-service coordination
  testTimeout: 30000, // 30 seconds
  slowTestThreshold: 10000, // Warn if test takes > 10 seconds

  // Execution - sequential to prevent state contamination between tests
  maxWorkers: 1, // Run tests one at a time

  // Error handling
  bail: false, // Continue running tests even if one fails

  // Debug options
  detectOpenHandles: false, // Don't detect open handles in normal runs (too noisy)

  // Output
  verbose: true,
};
