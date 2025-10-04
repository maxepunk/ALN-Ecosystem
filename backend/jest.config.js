/**
 * Jest Configuration - Unit & Contract Tests
 * Runs unit and contract tests in parallel for fast feedback
 *
 * Usage: npm test OR npm run test:contract OR npm run test:unit
 */

const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,

  // Test discovery
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.spec.js'],

  // Timing
  testTimeout: 10000, // 10 seconds (contract tests need time for HTTP/WebSocket)

  // Output
  verbose: true,
};
