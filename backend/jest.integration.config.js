module.exports = {
  ...require('./jest.config.js'),
  testMatch: ['**/integration/*.test.js'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially
  bail: false, // Continue even if a test fails
  forceExit: true, // Force exit after tests complete
  detectOpenHandles: false, // Don't detect open handles in normal runs
  // Integration tests often need more time
  slowTestThreshold: 10000, // Warn about tests slower than 10s
};