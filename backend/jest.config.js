/**
 * Jest Configuration - Unit & Contract Tests
 * Runs unit and contract tests in parallel for fast feedback
 *
 * Usage: npm test OR npm run test:contract OR npm run test:unit
 */

const fs = require('fs');
const path = require('path');
const baseConfig = require('./jest.config.base');

// Per-file coverage thresholds (unit + contract only — not shared with integration config)
const thresholdsPath = path.resolve(__dirname, '.coverage-thresholds.json');
const coverageThreshold = fs.existsSync(thresholdsPath)
  ? JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'))
  : { global: { branches: 80, functions: 80, lines: 80, statements: 80 } };

module.exports = {
  ...baseConfig,

  // Test discovery - ONLY unit and contract tests
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.spec.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/',  // Exclude integration tests (use jest.integration.config.js)
    '/tests/e2e/',          // Exclude E2E tests (use Playwright)
  ],

  // Per-file coverage ratchet (prevents regression per source file)
  coverageThreshold,

  // Timing
  testTimeout: 10000, // 10 seconds (contract tests need time for HTTP/WebSocket)

  // Output
  verbose: true,
};
