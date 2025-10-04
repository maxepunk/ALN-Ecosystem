/**
 * Jest Setup - Runs before each test file
 *
 * INTENTIONALLY MINIMAL: No global setup/teardown to avoid race conditions
 * in parallel test execution.
 *
 * ## Test Isolation Strategy
 *
 * Each test type manages its own lifecycle:
 *
 * 1. **Unit Tests**: Use mocks, no shared state
 *
 * 2. **Contract Tests**: Use test-server.js helpers
 *    - beforeAll(): setupTestServer()
 *    - afterAll(): cleanupTestServer()
 *    - beforeEach(): Reset stateful services (sessionService, videoQueueService, etc.)
 *
 * 3. **Integration Tests**: Use integration-test-server.js helpers
 *    - beforeAll(): setupIntegrationTestServer()
 *    - afterAll(): cleanupIntegrationTestServer()
 *    - beforeEach(): Reset services but preserve server connection
 *
 * ## Why No Global Setup?
 *
 * Previous attempts at global setup/teardown caused:
 * - Race conditions when tests run in parallel
 * - Module cache conflicts with singleton services
 * - Data directory deletion while tests are using it
 *
 * ## Global Teardown
 *
 * HTTP agent cleanup is handled in jest.globalTeardown.js which runs
 * ONCE after ALL test files complete (safe for process-wide cleanup).
 */

// This file is intentionally left empty
// See comments above for test isolation strategy
