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

// ## ProcessMonitor PID-file isolation (defence in depth)
//
// jest.config.base.js allocates ONE temp dir per run and every forked worker
// inherits it through process.env. This is the backstop for the case where that
// inheritance does not happen (a worker launched with a scrubbed env, a suite
// run through a config that does not extend the base). Falling through to the
// default /tmp would let ProcessMonitor._killOrphan() SIGTERM a process owned
// by the production orchestrator, so the fallback is a private directory, never
// /tmp. Runs before the test file's own requires (setupFilesAfterEnv).
//
// jest.globalTeardown.js only knows the PARENT's directory, so a fallback dir
// created inside a worker has to clean itself up here. Removing it after every
// test file is safe: resolvePidFile() recreates the directory on demand, and a
// pidfile is only meaningful while its process is alive.
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORKER_FALLBACK_PREFIX = 'aln-jest-worker-';

if (!process.env.ALN_PIDFILE_DIR) {
  process.env.ALN_PIDFILE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), WORKER_FALLBACK_PREFIX));
}

if (path.basename(process.env.ALN_PIDFILE_DIR).startsWith(WORKER_FALLBACK_PREFIX)) {
  afterAll(() => {
    try {
      fs.rmSync(process.env.ALN_PIDFILE_DIR, { recursive: true, force: true });
    } catch {
      // Best effort — it is a temp dir either way.
    }
  });
}

// Nothing else here on purpose — see the isolation strategy above.
