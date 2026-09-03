# Home Assistant Docker Container Lifecycle Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Backend auto-starts the HA Docker container on server startup and auto-stops it on shutdown, so GMs never need to manually run `docker start homeassistant`.

**Architecture:** Lightweight `dockerHelper.js` utility wrapping `child_process.execFile` for Docker CLI commands (same pattern as `bluetoothService._execFile`). `lightingService` calls the helper during `init()` and `cleanup()`. Ownership rule: only stop what we started.

**Tech Stack:** Node.js `child_process.execFile`, Docker CLI, Jest mocks

---

### Task 1: Write failing tests for dockerHelper utility

**Files:**
- Create: `backend/tests/unit/utils/dockerHelper.test.js`

**Step 1: Write the failing tests**

```javascript
/**
 * Unit tests for Docker Helper utility
 * Tests Docker CLI command wrappers with mocked child_process.execFile
 */

jest.mock('child_process');
const { execFile } = require('child_process');

const {
  containerExists,
  isContainerRunning,
  startContainer,
  stopContainer,
} = require('../../../src/utils/dockerHelper');

describe('dockerHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── containerExists() ──

  describe('containerExists()', () => {
    it('should return true when container is found', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'homeassistant\n', '');
      });

      const exists = await containerExists('homeassistant');

      expect(exists).toBe(true);
      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['ps', '-a', '--filter', 'name=^homeassistant$', '--format', '{{.Names}}'],
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should return false when container is not found', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, '', '');
      });

      const exists = await containerExists('homeassistant');

      expect(exists).toBe(false);
    });

    it('should return false when docker is not installed', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('ENOENT: docker not found'), '', '');
      });

      const exists = await containerExists('homeassistant');

      expect(exists).toBe(false);
    });
  });

  // ── isContainerRunning() ──

  describe('isContainerRunning()', () => {
    it('should return true when container is running', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'homeassistant\n', '');
      });

      const running = await isContainerRunning('homeassistant');

      expect(running).toBe(true);
      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['ps', '--filter', 'name=^homeassistant$', '--filter', 'status=running', '--format', '{{.Names}}'],
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should return false when container exists but is stopped', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, '', '');
      });

      const running = await isContainerRunning('homeassistant');

      expect(running).toBe(false);
    });

    it('should return false when docker command fails', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Docker daemon not running'), '', '');
      });

      const running = await isContainerRunning('homeassistant');

      expect(running).toBe(false);
    });
  });

  // ── startContainer() ──

  describe('startContainer()', () => {
    it('should call docker start and resolve', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'homeassistant\n', '');
      });

      await startContainer('homeassistant');

      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['start', 'homeassistant'],
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should throw when docker start fails', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('No such container'), '', '');
      });

      await expect(startContainer('homeassistant')).rejects.toThrow('No such container');
    });
  });

  // ── stopContainer() ──

  describe('stopContainer()', () => {
    it('should call docker stop with timeout flag', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'homeassistant\n', '');
      });

      await stopContainer('homeassistant', 10);

      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '10', 'homeassistant'],
        expect.objectContaining({ timeout: 30000 }),
        expect.any(Function)
      );
    });

    it('should default to 10s stop timeout', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'homeassistant\n', '');
      });

      await stopContainer('homeassistant');

      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '10', 'homeassistant'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should throw when docker stop fails', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Container not running'), '', '');
      });

      await expect(stopContainer('homeassistant')).rejects.toThrow('Container not running');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/utils/dockerHelper.test.js --no-coverage`
Expected: FAIL with "Cannot find module '../../../src/utils/dockerHelper'"

**Step 3: Commit**

```bash
git add backend/tests/unit/utils/dockerHelper.test.js
git commit -m "test: add failing tests for dockerHelper utility (TDD red)"
```

---

### Task 2: Implement dockerHelper utility

**Files:**
- Create: `backend/src/utils/dockerHelper.js`

**Step 1: Write minimal implementation**

```javascript
/**
 * Docker Helper Utility
 * Lightweight wrappers around Docker CLI commands via execFile.
 * Uses execFile (not exec) to prevent shell injection.
 *
 * @module utils/dockerHelper
 */

const { execFile } = require('child_process');

const DOCKER_TIMEOUT = 30000; // 30s command timeout

/**
 * Promise wrapper around child_process.execFile for Docker commands.
 * @param {string[]} args - Docker CLI arguments
 * @returns {Promise<string>} stdout
 * @private
 */
function _dockerExec(args) {
  return new Promise((resolve, reject) => {
    execFile('docker', args, { timeout: DOCKER_TIMEOUT }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Check if a Docker container exists (any state).
 * @param {string} name - Container name
 * @returns {Promise<boolean>}
 */
async function containerExists(name) {
  try {
    const stdout = await _dockerExec([
      'ps', '-a', '--filter', `name=^${name}$`, '--format', '{{.Names}}'
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a Docker container is currently running.
 * @param {string} name - Container name
 * @returns {Promise<boolean>}
 */
async function isContainerRunning(name) {
  try {
    const stdout = await _dockerExec([
      'ps', '--filter', `name=^${name}$`, '--filter', 'status=running', '--format', '{{.Names}}'
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Start a stopped Docker container.
 * @param {string} name - Container name
 * @returns {Promise<void>}
 * @throws {Error} If container doesn't exist or Docker fails
 */
async function startContainer(name) {
  await _dockerExec(['start', name]);
}

/**
 * Stop a running Docker container.
 * @param {string} name - Container name
 * @param {number} [timeout=10] - Seconds to wait before SIGKILL
 * @returns {Promise<void>}
 * @throws {Error} If container doesn't exist or Docker fails
 */
async function stopContainer(name, timeout = 10) {
  await _dockerExec(['stop', '-t', String(timeout), name]);
}

module.exports = { containerExists, isContainerRunning, startContainer, stopContainer };
```

**Step 2: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/utils/dockerHelper.test.js --no-coverage`
Expected: PASS — 9 tests

**Step 3: Commit**

```bash
git add backend/src/utils/dockerHelper.js
git commit -m "feat: add dockerHelper utility for container lifecycle commands"
```

---

### Task 3: Add config vars for Docker management

**Files:**
- Modify: `backend/src/config/index.js` (lighting section)
- Modify: `backend/.env.example` (documentation)

**Step 1: Add config vars to lighting section**

In `backend/src/config/index.js`, add 3 new properties to the `lighting` config object (after `homeAssistantToken`):

```javascript
  // Lighting Configuration (Home Assistant)
  lighting: {
    enabled: process.env.LIGHTING_ENABLED !== 'false',
    homeAssistantUrl: process.env.HOME_ASSISTANT_URL || 'http://localhost:8123',
    homeAssistantToken: process.env.HOME_ASSISTANT_TOKEN || '',
    dockerManage: process.env.HA_DOCKER_MANAGE !== 'false',
    dockerContainer: process.env.HA_DOCKER_CONTAINER || 'homeassistant',
    dockerStopTimeout: parseInt(process.env.HA_DOCKER_STOP_TIMEOUT || '10', 10),
  },
```

**Step 2: Add env vars to .env.example**

Append to the `ENVIRONMENT CONTROL (Phase 0)` section in `backend/.env.example`:

```env
# Docker container lifecycle management for Home Assistant
# Set to false to disable auto-start/stop of the HA container
HA_DOCKER_MANAGE=true
# Docker container name for Home Assistant
HA_DOCKER_CONTAINER=homeassistant
# Seconds to wait for graceful container stop (before SIGKILL)
HA_DOCKER_STOP_TIMEOUT=10
```

**Step 3: Run tests to verify no regressions**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -5`
Expected: All 714+ tests pass (config is loaded at module scope; adding new keys is safe)

**Step 4: Commit**

```bash
git add backend/src/config/index.js backend/.env.example
git commit -m "feat: add Docker lifecycle config vars (HA_DOCKER_MANAGE, container, timeout)"
```

---

### Task 4: Write failing tests for lightingService Docker integration

**Files:**
- Modify: `backend/tests/unit/services/lightingService.test.js`

**Step 1: Add dockerHelper mock and config vars to existing test file**

At the top of the test file (after the existing `jest.mock('axios')` line), add the dockerHelper mock:

```javascript
jest.mock('../../../src/utils/dockerHelper', () => ({
  containerExists: jest.fn(),
  isContainerRunning: jest.fn(),
  startContainer: jest.fn(),
  stopContainer: jest.fn(),
}));
const dockerHelper = require('../../../src/utils/dockerHelper');
```

Update the config mock to include new Docker management vars:

```javascript
jest.mock('../../../src/config', () => ({
  lighting: {
    enabled: true,
    homeAssistantUrl: 'http://localhost:8123',
    homeAssistantToken: 'test-ha-token',
    dockerManage: true,
    dockerContainer: 'homeassistant',
    dockerStopTimeout: 10,
  },
  storage: { logsDir: '/tmp/test-logs', dataDir: '/tmp/test-data' },
  logging: { level: 'info', format: 'json', maxFiles: 5, maxSize: '10m' },
}));
```

In `beforeEach()`, add resets for the new config vars and dockerHelper:

```javascript
beforeEach(() => {
  lightingService.reset();
  jest.clearAllMocks();

  // Restore default config for each test
  config.lighting.enabled = true;
  config.lighting.homeAssistantUrl = 'http://localhost:8123';
  config.lighting.homeAssistantToken = 'test-ha-token';
  config.lighting.dockerManage = true;
  config.lighting.dockerContainer = 'homeassistant';
  config.lighting.dockerStopTimeout = 10;
});
```

**Step 2: Add new Docker management test suite**

Append before the closing `});` of the main describe block:

```javascript
  // ── Docker container management ──

  describe('Docker container management', () => {
    describe('init() — container auto-start', () => {
      beforeEach(() => {
        // Default: HA reachable after container start
        axios.get.mockImplementation((url) => {
          if (url === 'http://localhost:8123/api/') {
            return Promise.resolve({ status: 200, data: { message: 'API running.' } });
          }
          if (url === 'http://localhost:8123/api/states') {
            return Promise.resolve({ status: 200, data: [] });
          }
          return Promise.reject(new Error('Unexpected URL'));
        });
      });

      it('should start container when it exists but is stopped', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();

        await lightingService.init();

        expect(dockerHelper.containerExists).toHaveBeenCalledWith('homeassistant');
        expect(dockerHelper.isContainerRunning).toHaveBeenCalledWith('homeassistant');
        expect(dockerHelper.startContainer).toHaveBeenCalledWith('homeassistant');
      });

      it('should skip start when container is already running', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(true);

        await lightingService.init();

        expect(dockerHelper.startContainer).not.toHaveBeenCalled();
      });

      it('should skip start when container does not exist', async () => {
        dockerHelper.containerExists.mockResolvedValue(false);

        await lightingService.init();

        expect(dockerHelper.isContainerRunning).not.toHaveBeenCalled();
        expect(dockerHelper.startContainer).not.toHaveBeenCalled();
      });

      it('should skip Docker management when dockerManage is false', async () => {
        config.lighting.dockerManage = false;

        await lightingService.init();

        expect(dockerHelper.containerExists).not.toHaveBeenCalled();
      });

      it('should skip Docker management in test environment', async () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';

        await lightingService.init();

        expect(dockerHelper.containerExists).not.toHaveBeenCalled();
        process.env.NODE_ENV = origEnv;
      });

      it('should not throw when Docker commands fail', async () => {
        dockerHelper.containerExists.mockRejectedValue(new Error('Docker daemon not running'));

        await lightingService.init();

        // Should still attempt HA connection (graceful degradation)
        expect(axios.get).toHaveBeenCalled();
      });
    });

    describe('cleanup() — container auto-stop', () => {
      it('should stop container on cleanup when we started it', async () => {
        // Simulate: container was stopped, we started it
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        await lightingService.cleanup();

        expect(dockerHelper.stopContainer).toHaveBeenCalledWith('homeassistant', 10);
      });

      it('should NOT stop container when it was already running', async () => {
        // Simulate: container was already running before init
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(true);
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        await lightingService.cleanup();

        expect(dockerHelper.stopContainer).not.toHaveBeenCalled();
      });

      it('should not throw when container stop fails', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockRejectedValue(new Error('timeout'));

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();

        // Should not throw
        await expect(lightingService.cleanup()).resolves.not.toThrow();
      });
    });

    describe('reset()', () => {
      it('should clear container tracking state without touching Docker', async () => {
        dockerHelper.containerExists.mockResolvedValue(true);
        dockerHelper.isContainerRunning.mockResolvedValue(false);
        dockerHelper.startContainer.mockResolvedValue();
        dockerHelper.stopContainer.mockResolvedValue();

        axios.get.mockResolvedValue({ status: 200, data: [] });

        await lightingService.init();
        jest.clearAllMocks();

        lightingService.reset();

        // stopContainer should NOT be called during reset
        expect(dockerHelper.stopContainer).not.toHaveBeenCalled();
      });
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/services/lightingService.test.js --no-coverage`
Expected: FAIL — new Docker tests fail because `lightingService.init()` doesn't call dockerHelper yet, and `cleanup()` is sync (not async)

**Step 3: Commit**

```bash
git add backend/tests/unit/services/lightingService.test.js
git commit -m "test: add failing tests for lightingService Docker lifecycle (TDD red)"
```

---

### Task 5: Implement Docker lifecycle in lightingService

**Files:**
- Modify: `backend/src/services/lightingService.js`

**Step 1: Add dockerHelper import and state to constructor**

At the top of `lightingService.js`, after the existing `require` statements, add:

```javascript
const dockerHelper = require('../utils/dockerHelper');
```

In the constructor, add tracking state:

```javascript
  constructor() {
    super();
    this._connected = false;
    this._scenes = [];
    this._activeScene = null;
    this._reconnectInterval = null;
    this._containerStartedByUs = false;
  }
```

**Step 2: Add `_ensureContainerRunning()` private method**

Add this method in the `// ── Private helpers ──` section:

```javascript
  /**
   * Ensure the HA Docker container is running.
   * Skipped in test env or when dockerManage is disabled.
   * Non-blocking: catches all errors, logs warnings, never throws.
   * @returns {Promise<void>}
   * @private
   */
  async _ensureContainerRunning() {
    if (process.env.NODE_ENV === 'test' || !config.lighting.dockerManage) {
      return;
    }

    const container = config.lighting.dockerContainer;

    try {
      const exists = await dockerHelper.containerExists(container);
      if (!exists) {
        logger.info('HA Docker container not found — skipping auto-start', { container });
        return;
      }

      const running = await dockerHelper.isContainerRunning(container);
      if (running) {
        logger.info('HA Docker container already running', { container });
        return;
      }

      logger.info('Starting HA Docker container', { container });
      await dockerHelper.startContainer(container);
      this._containerStartedByUs = true;
      logger.info('HA Docker container started', { container });
    } catch (err) {
      logger.warn('Failed to manage HA Docker container — continuing without', {
        container,
        error: err.message,
      });
    }
  }
```

**Step 3: Call `_ensureContainerRunning()` in `init()`**

Modify the `init()` method to call the new method before `checkConnection()`:

```javascript
  async init() {
    if (!config.lighting.enabled) {
      logger.info('Lighting service disabled via config');
      return;
    }

    if (!config.lighting.homeAssistantToken) {
      logger.info('Lighting service skipped — no Home Assistant token configured');
      return;
    }

    // Ensure HA Docker container is running before attempting connection
    await this._ensureContainerRunning();

    try {
      await this.checkConnection();
      // ... rest unchanged
```

**Step 4: Make `cleanup()` async and add container stop**

Replace the existing `cleanup()` method:

```javascript
  /**
   * Clean up resources — clears reconnect interval and optionally stops
   * the HA Docker container (only if we started it).
   * @returns {Promise<void>}
   */
  async cleanup() {
    this._clearReconnect();

    if (this._containerStartedByUs) {
      const container = config.lighting.dockerContainer;
      const timeout = config.lighting.dockerStopTimeout;
      try {
        logger.info('Stopping HA Docker container (we started it)', { container });
        await dockerHelper.stopContainer(container, timeout);
        logger.info('HA Docker container stopped', { container });
      } catch (err) {
        logger.warn('Failed to stop HA Docker container', { container, error: err.message });
      }
      this._containerStartedByUs = false;
    }

    logger.info('Lighting service cleaned up');
  }
```

**Step 5: Update `reset()` to clear tracking state**

```javascript
  reset() {
    this._clearReconnect();
    this.removeAllListeners();
    this._connected = false;
    this._scenes = [];
    this._activeScene = null;
    this._containerStartedByUs = false;
  }
```

**Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/lightingService.test.js --no-coverage`
Expected: PASS — all existing tests + new Docker tests pass

**Step 7: Commit**

```bash
git add backend/src/services/lightingService.js
git commit -m "feat: add Docker container lifecycle to lightingService init/cleanup"
```

---

### Task 6: Update server.js shutdown to await async cleanup

**Files:**
- Modify: `backend/src/server.js`

**Step 1: Change `lightingService.cleanup()` to `await lightingService.cleanup()`**

In `backend/src/server.js` in the `shutdown()` function, find line:

```javascript
    lightingService.cleanup();
```

Change to:

```javascript
    await lightingService.cleanup();
```

**Step 2: Run full test suite**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -5`
Expected: All tests pass (714+)

**Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "fix: await async lightingService.cleanup() for Docker container stop"
```

---

### Task 7: Run full test suite and verify

**Step 1: Run backend unit + contract tests**

Run: `cd backend && npm test`
Expected: 714+ tests pass

**Step 2: Run GM Scanner unit tests**

Run: `cd ALNScanner && npm test`
Expected: 858 tests pass

**Step 3: Run backend integration tests**

Run: `cd backend && npm run test:integration`
Expected: All integration tests pass

**Step 4: Commit any fixes if needed, then tag completion**

```bash
# If all tests pass, no commit needed for this task
```

---

### Task 8: Interactive manual verification

**Prerequisites:** HA container must exist on the system (`docker ps -a` shows `homeassistant`).

**Step 1: Stop HA if running**

```bash
docker stop homeassistant
docker ps -a --filter name=homeassistant  # Verify: status = Exited
```

**Step 2: Start backend, verify auto-start**

```bash
cd backend && npm run dev:full
# In logs, look for:
#   "Starting HA Docker container" { container: 'homeassistant' }
#   "HA Docker container started" { container: 'homeassistant' }
#   "Home Assistant connection established"
```

```bash
# In another terminal:
docker ps --filter name=homeassistant  # Verify: status = Up
```

**Step 3: Stop backend (Ctrl+C), verify auto-stop**

```bash
# In logs, look for:
#   "Stopping HA Docker container (we started it)" { container: 'homeassistant' }
#   "HA Docker container stopped"
```

```bash
docker ps -a --filter name=homeassistant  # Verify: status = Exited
```

**Step 4: Leave HA running, start backend, verify no double-start**

```bash
docker start homeassistant
# Wait 15s for HA to boot
cd backend && npm run dev:full
# In logs, look for:
#   "HA Docker container already running" { container: 'homeassistant' }
```

**Step 5: Stop backend, verify container stays running**

```bash
# Ctrl+C on backend
# In logs, should NOT see "Stopping HA Docker container"
docker ps --filter name=homeassistant  # Verify: STILL running
```

```bash
# Clean up
docker stop homeassistant
```

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `backend/src/utils/dockerHelper.js` | Create | ~60 |
| `backend/src/config/index.js` | Add 3 config vars | ~3 |
| `backend/src/services/lightingService.js` | Add Docker lifecycle | ~50 |
| `backend/src/server.js` | `await` cleanup call | 1 |
| `backend/.env.example` | Document new env vars | ~6 |
| `backend/tests/unit/utils/dockerHelper.test.js` | Create | ~130 |
| `backend/tests/unit/services/lightingService.test.js` | Add Docker tests | ~120 |

## Verification

```bash
cd backend && npm test              # Unit + contract tests
cd backend && npm run test:integration  # Integration tests
cd ALNScanner && npm test           # GM Scanner unit tests
# Manual: Steps 1-5 from Task 8
```
