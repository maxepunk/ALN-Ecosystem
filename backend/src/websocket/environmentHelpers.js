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
 * Async because bluetoothService methods shell out to bluetoothctl.
 *
 * @param {Object} options
 * @param {Object} [options.bluetoothService] - BluetoothService instance (optional)
 * @param {Object} [options.audioRoutingService] - AudioRoutingService instance (optional)
 * @param {Object} [options.lightingService] - LightingService instance (optional)
 * @returns {Promise<Object>} Environment state snapshot
 */
async function buildEnvironmentState({ bluetoothService, audioRoutingService, lightingService } = {}) {
  // Bluetooth — async calls, catch errors individually
  let bluetooth = DEFAULTS.bluetooth;
  if (bluetoothService) {
    try {
      const [available, pairedDevices, connectedDevices] = await Promise.all([
        bluetoothService.isAvailable(),
        bluetoothService.getPairedDevices(),
        bluetoothService.getConnectedDevices(),
      ]);
      bluetooth = {
        available,
        scanning: bluetoothService.isScanning(),
        pairedDevices,
        connectedDevices,
      };
    } catch (err) {
      logger.warn('Failed to gather bluetooth state for sync:full', { error: err.message });
    }
  }

  // Audio — sync call
  let audio = DEFAULTS.audio;
  if (audioRoutingService) {
    try {
      audio = await audioRoutingService.getRoutingStatus();
    } catch (err) {
      logger.warn('Failed to gather audio state for sync:full', { error: err.message });
    }
  }

  // Lighting — sync calls
  let lighting = DEFAULTS.lighting;
  if (lightingService) {
    try {
      lighting = {
        connected: lightingService.isConnected(),
        scenes: lightingService.getCachedScenes(),
        activeScene: lightingService.getActiveScene(),
      };
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
