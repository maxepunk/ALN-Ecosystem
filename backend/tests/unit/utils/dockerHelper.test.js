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

  // ── Input Validation ──

  describe('name validation', () => {
    it.each([
      ['containerExists', containerExists],
      ['isContainerRunning', isContainerRunning],
      ['startContainer', startContainer],
      ['stopContainer', stopContainer],
    ])('%s should reject null name', async (fnName, fn) => {
      await expect(fn(null)).rejects.toThrow('Container name must be a non-empty string');
      expect(execFile).not.toHaveBeenCalled();
    });

    it.each([
      ['containerExists', containerExists],
      ['isContainerRunning', isContainerRunning],
      ['startContainer', startContainer],
      ['stopContainer', stopContainer],
    ])('%s should reject empty string name', async (fnName, fn) => {
      await expect(fn('')).rejects.toThrow('Container name must be a non-empty string');
      expect(execFile).not.toHaveBeenCalled();
    });

    it.each([
      ['containerExists', containerExists],
      ['isContainerRunning', isContainerRunning],
      ['startContainer', startContainer],
      ['stopContainer', stopContainer],
    ])('%s should reject non-string name', async (fnName, fn) => {
      await expect(fn(123)).rejects.toThrow('Container name must be a non-empty string');
      expect(execFile).not.toHaveBeenCalled();
    });
  });

  describe('stopContainer timeout validation', () => {
    it('should reject NaN timeout', async () => {
      await expect(stopContainer('mycontainer', NaN)).rejects.toThrow('Timeout must be a non-negative number');
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should reject negative timeout', async () => {
      await expect(stopContainer('mycontainer', -5)).rejects.toThrow('Timeout must be a non-negative number');
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should reject Infinity timeout', async () => {
      await expect(stopContainer('mycontainer', Infinity)).rejects.toThrow('Timeout must be a non-negative number');
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should reject string timeout', async () => {
      await expect(stopContainer('mycontainer', '10')).rejects.toThrow('Timeout must be a non-negative number');
      expect(execFile).not.toHaveBeenCalled();
    });

    it('should accept zero timeout', async () => {
      execFile.mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'mycontainer\n', '');
      });

      await stopContainer('mycontainer', 0);

      expect(execFile).toHaveBeenCalledWith(
        'docker',
        ['stop', '-t', '0', 'mycontainer'],
        expect.any(Object),
        expect.any(Function)
      );
    });
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
