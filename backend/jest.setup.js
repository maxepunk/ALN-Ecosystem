const fs = require('fs').promises;
const path = require('path');

// Track active resources for cleanup
const activeServers = new Set();
const activeSockets = new Set();

// DISABLED: Global setup/teardown causes race conditions when tests run in parallel
// Each test file should manage its own setup and cleanup using test utilities:
// - Contract tests: use setupTestServer() / cleanupTestServer() from ws-test-utils.js
// - Integration tests: use custom setup functions as needed
// - Unit tests: use jest.resetModules() in their own beforeEach

// The previous global cleanup was:
// 1. Clearing module cache after every test → breaks singleton services
// 2. Resetting ALL services after every test → causes conflicts between parallel tests
// 3. Deleting data directory → race conditions when tests share data

// Tests now manage their own lifecycle to avoid these issues