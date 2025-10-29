/**
 * Jest Configuration - Unit & Contract Tests
 * Runs unit and contract tests in parallel for fast feedback
 *
 * Usage: npm test OR npm run test:contract OR npm run test:unit
 */

const baseConfig = require('./jest.config.base');

module.exports = {
  ...baseConfig,

  // Test discovery - ONLY unit and contract tests
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.spec.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/',  // Exclude integration tests (use jest.integration.config.js)
    '/tests/e2e/',          // Exclude E2E tests (use Playwright)
    '/tests/functional/',   // Exclude functional tests (archived)
  ],

  // Timing
  testTimeout: 10000, // 10 seconds (contract tests need time for HTTP/WebSocket)

  // Output
  verbose: true,
};
