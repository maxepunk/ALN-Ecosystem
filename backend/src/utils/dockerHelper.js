/**
 * Docker Helper Utility
 * Lightweight wrappers around Docker CLI commands via execFile.
 * Uses execFile (not exec) to prevent shell injection.
 *
 * @module utils/dockerHelper
 */

const { execFileAsync } = require('./execHelper');

const DOCKER_TIMEOUT = 30000; // 30s command timeout

/**
 * Execute a Docker CLI command.
 * @param {string[]} args - Docker CLI arguments
 * @returns {Promise<string>} stdout
 * @private
 */
function _dockerExec(args) {
  return execFileAsync('docker', args, DOCKER_TIMEOUT);
}

/**
 * Validate container name parameter.
 * @param {string} name - Container name to validate
 * @throws {Error} If name is not a non-empty string
 * @private
 */
function _validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Container name must be a non-empty string');
  }
}

/**
 * Check if a Docker container exists (any state).
 * @param {string} name - Container name
 * @returns {Promise<boolean>}
 */
async function containerExists(name) {
  _validateName(name);
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
  _validateName(name);
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
  _validateName(name);
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
  _validateName(name);
  if (typeof timeout !== 'number' || timeout < 0 || !Number.isFinite(timeout)) {
    throw new Error('Timeout must be a non-negative number');
  }
  await _dockerExec(['stop', '-t', String(timeout), name]);
}

module.exports = { containerExists, isContainerRunning, startContainer, stopContainer };
