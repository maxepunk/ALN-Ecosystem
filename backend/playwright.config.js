/**
 * Playwright Test Configuration
 * Optimized for Raspberry Pi 4 (8GB RAM) Environment
 *
 * Hardware Configuration:
 * - RAM: 8GB (Node.js max 2GB)
 * - GPU: 256MB allocated for video decoding
 * - Network: HTTPS with self-signed certificates
 * - Display: HDMI output available
 *
 * Usage:
 * - npm run test:e2e                    # Run E2E tests (2 workers)
 * - npm run test:e2e:fast               # Run E2E tests (3 workers, max speed)
 * - npm run test:e2e:headed             # Run with visible browser (1 worker)
 * - npm run test:e2e:ui                 # Interactive UI mode
 * - npx playwright test --list          # List all tests
 * - npx playwright show-report          # View HTML report
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './tests/e2e/flows',

  // Timeout per test (60s for video playback scenarios)
  timeout: 60000,

  // Global setup/teardown
  // globalSetup: require.resolve('./tests/e2e/setup/global-setup.js'),
  // globalTeardown: require.resolve('./tests/e2e/setup/global-teardown.js'),

  // Expect timeout for assertions
  expect: {
    timeout: 5000,
  },

  // Test run settings
  fullyParallel: false, // CRITICAL: Sequential execution for session-based tests
  forbidOnly: !!process.env.CI, // Prevent .only() in CI
  retries: process.env.CI ? 2 : 1, // Retry once on failure (twice in CI)
  workers: process.env.CI ? 1 : 2, // 8GB Pi: 2 workers for local dev, 1 for CI safety

  // Reporter configuration
  reporter: [
    ['list'], // Console output during test run
    ['html', { outputFolder: 'playwright-report', open: 'never' }], // HTML report
    ['json', { outputFile: 'playwright-report/results.json' }], // JSON for CI parsing
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.ORCHESTRATOR_URL || 'https://localhost:3000',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Screenshots on failure only
    screenshot: 'only-on-failure',

    // Videos on failure only (saves disk space on Pi)
    video: 'retain-on-failure',

    // Traces on failure (for debugging)
    trace: 'retain-on-failure',

    // CRITICAL: Accept self-signed SSL certificates
    // Required for HTTPS testing on local network
    ignoreHTTPSErrors: true,

    // Action timeout (clicking, typing, etc.)
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Test projects (browser configurations)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },

        // Pi-specific browser optimizations (8GB RAM)
        launchOptions: {
          args: [
            '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (good practice)
            '--no-sandbox', // Required for Pi compatibility
            '--disable-setuid-sandbox',
            // Conditionally disable GPU if VLC is using it for video playback
            ...(process.env.FEATURE_VIDEO_PLAYBACK !== 'false' ? ['--disable-gpu'] : []),
            '--disable-web-security', // Allow self-signed certs in tests
          ],
        },
      },
    },

    // Mobile viewport testing (for GM/Player scanner PWA testing)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },

        // Mobile-specific optimizations (8GB RAM)
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // Conditionally disable GPU if VLC is using it for video playback
            ...(process.env.FEATURE_VIDEO_PLAYBACK !== 'false' ? ['--disable-gpu'] : []),
          ],
        },
      },
    },
  ],

  // Web server configuration (optional - auto-start orchestrator for tests)
  // DISABLED: Tests manage orchestrator lifecycle via test-server.js
  // Each test suite calls startOrchestrator() in beforeAll() with specific options
  /*
  webServer: {
    command: 'npm run dev:no-video', // Start orchestrator without VLC
    url: 'https://localhost:3000/health',
    timeout: 120000, // 2 minutes for server startup
    reuseExistingServer: !process.env.CI, // Reuse if already running
    ignoreHTTPSErrors: true, // Accept self-signed cert
    stdout: 'pipe',
    stderr: 'pipe',
  },
  */
});
