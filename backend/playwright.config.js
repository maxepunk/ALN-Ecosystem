/**
 * Playwright Test Configuration
 * Optimized for Raspberry Pi 4 Environment
 *
 * Hardware Constraints:
 * - RAM: Limited (256MB Node.js max)
 * - GPU: 256MB allocated for video decoding
 * - Network: HTTPS with self-signed certificates
 * - Display: HDMI output available
 *
 * Usage:
 * - npm run test:e2e                    # Run all E2E tests
 * - npm run test:e2e -- --headed        # Run with visible browser
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
  fullyParallel: false, // CRITICAL: Sequential execution for Pi
  forbidOnly: !!process.env.CI, // Prevent .only() in CI
  retries: process.env.CI ? 2 : 1, // Retry once on failure (twice in CI)
  workers: 1, // CRITICAL: Run tests one at a time (Pi RAM constraint)

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

        // Pi-specific browser optimizations
        launchOptions: {
          args: [
            '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm (Pi RAM optimization)
            '--no-sandbox', // Required for Pi compatibility
            '--disable-setuid-sandbox',
            '--disable-gpu', // GPU reserved for VLC video playback
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

        // Mobile-specific optimizations
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
          ],
        },
      },
    },
  ],

  // Web server configuration (optional - auto-start orchestrator for tests)
  // Uncomment if you want Playwright to manage the server lifecycle
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
