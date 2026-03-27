/**
 * Shared Promise wrapper around child_process.execFile.
 * Used by audioRoutingService, bluetoothService, and dockerHelper.
 *
 * Uses execFile (not exec) to prevent shell injection.
 *
 * @module utils/execHelper
 */

const { execFile } = require('child_process');

/**
 * Execute a command via execFile and return stdout as a Promise.
 * @param {string} cmd - Command to execute
 * @param {string[]} args - Command arguments
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<string>} stdout
 */
function execFileAsync(cmd, args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Execute a command via execFile and return {stdout, stderr} as a Promise.
 * Used by MPRIS services that need stderr for diagnostics.
 * @param {string} cmd - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Object} [opts] - Options (passed to execFile, default timeout 5000ms)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execFileWithStderr(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 5000, ...opts }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
}

module.exports = { execFileAsync, execFileWithStderr };
