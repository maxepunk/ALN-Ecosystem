/**
 * E2E Test Configuration
 * Centralizes test constants and environment-specific values
 *
 * This file externalizes hardcoded secrets and URLs to enable:
 * 1. Environment-specific test configuration
 * 2. CI/CD integration without committing secrets
 * 3. Local development flexibility
 */

module.exports = {
  // Admin authentication
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || '@LN-c0nn3ct',

  // Orchestrator connection
  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || 'https://localhost:3000',

  // Test timeouts (milliseconds)
  DEFAULT_TIMEOUT: 10000,
  EXTENDED_TIMEOUT: 30000,
  NETWORK_IDLE_TIMEOUT: 5000,

  // Device configuration for testing
  TEST_DEVICES: {
    GM_SCANNER: {
      deviceId: 'GM_TEST',
      stationName: 'Test_Station',
      type: 'gm'
    },
    PLAYER_SCANNER: {
      deviceId: 'PLAYER_TEST',
      type: 'player'
    }
  }
};
