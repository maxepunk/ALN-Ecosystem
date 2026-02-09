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
