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
