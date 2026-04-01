/**
 * Environment State Helpers
 * Builds environment state snapshot for sync:full payloads.
 * Used by gmAuth.js (initial connect) and broadcasts.js (offline:queue:processed).
 *
 * Gracefully degrades when services are unavailable — returns safe defaults.
 */

const logger = require('../utils/logger');

/** Default fallback values when services are unavailable */
const DEFAULTS = {
  bluetooth: {
    available: false,
    scanning: false,
    pairedDevices: [],
    connectedDevices: [],
  },
  audio: {
    routes: { video: 'hdmi' },
    defaultSink: 'hdmi',
    availableSinks: [],
  },
  lighting: {
    connected: false,
    scenes: [],
    activeScene: null,
  },
};

/**
 * Build the environment state object for sync:full payloads.
 * Uses cached getState() from each service (no subprocess spawns).
 *
 * @param {Object} options
 * @param {Object} [options.bluetoothService] - BluetoothService instance (optional)
 * @param {Object} [options.audioRoutingService] - AudioRoutingService instance (optional)
 * @param {Object} [options.lightingService] - LightingService instance (optional)
 * @returns {Object} Environment state snapshot
 */
function buildEnvironmentState({ bluetoothService, audioRoutingService, lightingService } = {}) {
  let bluetooth = DEFAULTS.bluetooth;
  if (bluetoothService) {
    try {
      bluetooth = bluetoothService.getState();
    } catch (err) {
      logger.warn('Failed to gather bluetooth state for sync:full', { error: err.message });
    }
  }

  let audio = DEFAULTS.audio;
  if (audioRoutingService) {
    try {
      audio = audioRoutingService.getState();
    } catch (err) {
      logger.warn('Failed to gather audio state for sync:full', { error: err.message });
    }
  }

  let lighting = DEFAULTS.lighting;
  if (lightingService) {
    try {
      lighting = lightingService.getState();
    } catch (err) {
      logger.warn('Failed to gather lighting state for sync:full', { error: err.message });
    }
  }

  return { bluetooth, audio, lighting };
}

module.exports = {
  buildEnvironmentState,
  DEFAULTS,
};
