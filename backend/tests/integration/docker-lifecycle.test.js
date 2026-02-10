/**
 * Docker Container Lifecycle Integration Test
 *
 * Tests REAL Docker container start/stop against the actual Docker daemon.
 * No mocking of child_process or dockerHelper — these tests verify that
 * the Docker CLI commands actually work.
 *
 * Prerequisites:
 * - Docker installed and accessible (user in 'docker' group)
 * - 'homeassistant' container exists (created via docker create/run)
 *
 * If Docker is not accessible, the entire suite is skipped gracefully.
 *
 * Run:
 *   sg docker -c "npx jest tests/integration/docker-lifecycle.test.js --runInBand"
 *   or: npm run test:docker
 */

// DO NOT mock child_process — we want real Docker commands
// DO mock axios — prevent real HA API calls during lightingService.init()
jest.mock('axios');
const axios = require('axios');

// Mock logger to suppress noise
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { containerExists, isContainerRunning, startContainer, stopContainer } = require('../../src/utils/dockerHelper');
const config = require('../../src/config');

// ── Pre-flight: Check Docker access ──

let dockerAvailable = false;
let containerPresent = false;
let initialContainerRunning = false;

beforeAll(async () => {
  // Check if Docker is accessible
  try {
    dockerAvailable = await containerExists('dockerhelper_test_probe');
    // If we got here (true or false), Docker is accessible
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }

  if (!dockerAvailable) {
    // Try one more time — containerExists catches errors and returns false,
    // so test by checking a known container
    try {
      const { execFile } = require('child_process');
      await new Promise((resolve, reject) => {
        execFile('docker', ['info', '--format', '{{.ID}}'], { timeout: 5000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      dockerAvailable = true;
    } catch {
      dockerAvailable = false;
    }
  }

  if (!dockerAvailable) {
    console.warn('⚠ Docker not accessible — skipping docker-lifecycle tests');
    console.warn('  Run with: sg docker -c "npx jest tests/integration/docker-lifecycle.test.js --runInBand"');
    return;
  }

  // Check if homeassistant container exists
  containerPresent = await containerExists(config.lighting.dockerContainer);
  if (!containerPresent) {
    console.warn(`⚠ Container '${config.lighting.dockerContainer}' not found — skipping lifecycle tests`);
    return;
  }

  // Record initial state so we can restore it
  initialContainerRunning = await isContainerRunning(config.lighting.dockerContainer);
  console.log(`Docker lifecycle tests: container '${config.lighting.dockerContainer}' initial state: ${initialContainerRunning ? 'running' : 'stopped'}`);
});

afterAll(async () => {
  if (!dockerAvailable || !containerPresent) return;

  // Restore container to initial state
  const currentlyRunning = await isContainerRunning(config.lighting.dockerContainer);

  if (initialContainerRunning && !currentlyRunning) {
    console.log('Restoring container to running state...');
    await startContainer(config.lighting.dockerContainer);
  } else if (!initialContainerRunning && currentlyRunning) {
    console.log('Restoring container to stopped state...');
    await stopContainer(config.lighting.dockerContainer, 10);
  }

  console.log('Docker lifecycle tests: container state restored');
});

// ── dockerHelper direct tests (real Docker) ──

describe('dockerHelper (real Docker)', () => {
  const skipUnless = () => {
    if (!dockerAvailable) return true;
    return false;
  };

  it('should detect Docker is accessible', () => {
    if (!dockerAvailable) {
      console.warn('SKIPPED: Docker not accessible');
      return;
    }
    expect(dockerAvailable).toBe(true);
  });

  it('should return true for existing container', async () => {
    if (!dockerAvailable || !containerPresent) return;

    const exists = await containerExists(config.lighting.dockerContainer);
    expect(exists).toBe(true);
  });

  it('should return false for non-existent container', async () => {
    if (!dockerAvailable) return;

    const exists = await containerExists('nonexistent_container_xyz_999');
    expect(exists).toBe(false);
  });

  it('should report correct running state', async () => {
    if (!dockerAvailable || !containerPresent) return;

    const running = await isContainerRunning(config.lighting.dockerContainer);
    // We recorded the initial state — verify it matches
    expect(running).toBe(initialContainerRunning);
  });

  it('should stop a running container', async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Ensure container is running first
    if (!await isContainerRunning(config.lighting.dockerContainer)) {
      await startContainer(config.lighting.dockerContainer);
      // Brief wait for Docker to register state change
      await new Promise(r => setTimeout(r, 1000));
    }

    await stopContainer(config.lighting.dockerContainer, 10);
    await new Promise(r => setTimeout(r, 1000));

    const running = await isContainerRunning(config.lighting.dockerContainer);
    expect(running).toBe(false);
  });

  it('should start a stopped container', async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Container should be stopped from previous test
    const wasStopped = !(await isContainerRunning(config.lighting.dockerContainer));
    if (!wasStopped) {
      await stopContainer(config.lighting.dockerContainer, 10);
      await new Promise(r => setTimeout(r, 1000));
    }

    await startContainer(config.lighting.dockerContainer);
    await new Promise(r => setTimeout(r, 1000));

    const running = await isContainerRunning(config.lighting.dockerContainer);
    expect(running).toBe(true);
  });
});

// ── lightingService Docker lifecycle (real Docker, mocked axios) ──

describe('lightingService Docker lifecycle (real Docker)', () => {
  let lightingService;
  let savedNodeEnv;

  beforeEach(() => {
    if (!dockerAvailable || !containerPresent) return;

    // Clear module cache to get a fresh lightingService singleton
    jest.resetModules();

    // Re-require with fresh module state
    // (config and dockerHelper are NOT mocked — they use real Docker)
    jest.mock('axios');
    jest.mock('../../src/utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    lightingService = require('../../src/services/lightingService');
    const freshAxios = require('axios');

    // Mock HA API responses (we're testing Docker, not HA connectivity)
    freshAxios.get.mockImplementation((url) => {
      if (url.endsWith('/api/')) {
        return Promise.resolve({ status: 200, data: { message: 'API running.' } });
      }
      if (url.endsWith('/api/states')) {
        return Promise.resolve({ status: 200, data: [] });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    // Override NODE_ENV so _ensureContainerRunning doesn't skip
    savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Restore NODE_ENV
    process.env.NODE_ENV = savedNodeEnv;

    // Reset lightingService state
    if (lightingService) {
      lightingService.reset();
    }
  });

  it('should auto-start a stopped container during init()', async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Ensure container is stopped
    if (await isContainerRunning(config.lighting.dockerContainer)) {
      await stopContainer(config.lighting.dockerContainer, 10);
      await new Promise(r => setTimeout(r, 1000));
    }

    // init() should start the container
    await lightingService.init();
    await new Promise(r => setTimeout(r, 2000));

    const running = await isContainerRunning(config.lighting.dockerContainer);
    expect(running).toBe(true);
  });

  it('should stop container on cleanup() when we started it', async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Ensure container is stopped so init() will start it
    if (await isContainerRunning(config.lighting.dockerContainer)) {
      await stopContainer(config.lighting.dockerContainer, 10);
      await new Promise(r => setTimeout(r, 1000));
    }

    // init() starts it, sets _containerStartedByUs = true
    await lightingService.init();
    await new Promise(r => setTimeout(r, 2000));

    // Verify it's running
    expect(await isContainerRunning(config.lighting.dockerContainer)).toBe(true);

    // cleanup() should stop it
    await lightingService.cleanup();
    await new Promise(r => setTimeout(r, 2000));

    const running = await isContainerRunning(config.lighting.dockerContainer);
    expect(running).toBe(false);
  });

  it('should NOT stop container on cleanup() when it was already running', async () => {
    if (!dockerAvailable || !containerPresent) return;

    // Ensure container is already running before init
    if (!await isContainerRunning(config.lighting.dockerContainer)) {
      await startContainer(config.lighting.dockerContainer);
      await new Promise(r => setTimeout(r, 2000));
    }

    // init() sees it's already running → _containerStartedByUs stays false
    await lightingService.init();

    // cleanup() should NOT stop it
    await lightingService.cleanup();
    await new Promise(r => setTimeout(r, 1000));

    const running = await isContainerRunning(config.lighting.dockerContainer);
    expect(running).toBe(true);
  });
});
