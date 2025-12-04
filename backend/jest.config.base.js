/**
 * Base Jest Configuration
 * Shared settings across all test types (unit, contract, integration)
 *
 * DO NOT run this directly - use jest.config.js or jest.integration.config.js
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Transformation
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.globalTeardown.js',

  // Force exit after tests complete (required for Socket.IO and HTTP servers)
  forceExit: true,

  // Mock management
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Module management
  // CRITICAL: Do NOT reset modules - singleton services use explicit reset()/init()
  resetModules: false,

  // Ignore patterns
  // CRITICAL: Allow transformation of ALNScanner (which is outside root but imported)
  transformIgnorePatterns: [
    '/node_modules/(?!(@ALNScanner|ALNScanner)/)',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
