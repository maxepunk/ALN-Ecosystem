/**
 * Home Assistant Service Helper for E2E Testing
 *
 * Real-first: checks if HA Docker container is running, starts it if needed,
 * verifies API health.
 * NO MOCK FALLBACK — either real or unavailable.
 *
 * Returns: { type: 'real' | 'unavailable', reason?: string, url?: string, token?: string }
 */

'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');
const logger = require('../../../src/utils/logger');

const execFileAsync = promisify(execFile);

const HA_CONTAINER_NAME = 'homeassistant';
const HA_URL = process.env.HOME_ASSISTANT_URL || 'http://localhost:8123';
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN || '';
const HA_HEALTH_TIMEOUT = 30000; // 30s for container startup
const HA_HEALTH_INTERVAL = 2000; // Check every 2s

/**
 * Check if HA container is running
 * @returns {Promise<boolean>}
 */
async function isHAContainerRunning() {
  try {
    // Use sg docker wrapper if needed (user in docker group but shell doesn't inherit)
    const { stdout } = await execFileAsync('sg', [
      'docker', '-c',
      `docker inspect -f '{{.State.Running}}' ${HA_CONTAINER_NAME}`
    ], { timeout: 5000 });
    return stdout.trim() === 'true';
  } catch {
    // Try without sg wrapper (in case docker group is inherited)
    try {
      const { stdout } = await execFileAsync('docker', [
        'inspect', '-f', '{{.State.Running}}', HA_CONTAINER_NAME
      ], { timeout: 5000 });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }
}

/**
 * Check if HA API is responding
 * @returns {Promise<boolean>}
 */
async function isHAApiHealthy() {
  if (!HA_TOKEN) return false;
  try {
    const response = await axios.get(`${HA_URL}/api/`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
      timeout: 3000
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Try to start the HA container
 * @returns {Promise<boolean>}
 */
async function startHAContainer() {
  try {
    await execFileAsync('sg', [
      'docker', '-c',
      `docker start ${HA_CONTAINER_NAME}`
    ], { timeout: 15000 });
    return true;
  } catch {
    try {
      await execFileAsync('docker', ['start', HA_CONTAINER_NAME], { timeout: 15000 });
      return true;
    } catch (err) {
      logger.debug('[E2E HA] Failed to start container:', err.message);
      return false;
    }
  }
}

/**
 * Wait for HA API to become healthy
 * @returns {Promise<boolean>}
 */
async function waitForHAHealth() {
  const deadline = Date.now() + HA_HEALTH_TIMEOUT;
  while (Date.now() < deadline) {
    if (await isHAApiHealthy()) return true;
    await new Promise(r => setTimeout(r, HA_HEALTH_INTERVAL));
  }
  return false;
}

/**
 * Setup Home Assistant for E2E testing
 * @returns {Promise<{type: string, reason?: string, url?: string}>}
 */
async function setupHA() {
  // 0. Check if HA token is configured
  if (!HA_TOKEN) {
    return { type: 'unavailable', reason: 'HOME_ASSISTANT_TOKEN not set' };
  }

  // 1. Check if API is already healthy
  if (await isHAApiHealthy()) {
    logger.info('[E2E HA] Home Assistant API already healthy');
    return { type: 'real', url: HA_URL };
  }

  // 2. Check if container exists but isn't running
  const running = await isHAContainerRunning();
  if (!running) {
    logger.info('[E2E HA] Container not running, attempting to start...');
    const started = await startHAContainer();
    if (!started) {
      return { type: 'unavailable', reason: `container '${HA_CONTAINER_NAME}' not found or Docker unavailable` };
    }
  }

  // 3. Wait for API health
  logger.info('[E2E HA] Waiting for API health check...');
  const healthy = await waitForHAHealth();
  if (!healthy) {
    return { type: 'unavailable', reason: 'container running but API health check timed out' };
  }

  logger.info('[E2E HA] Home Assistant API healthy');
  return { type: 'real', url: HA_URL };
}

module.exports = { setupHA };
