/**
 * Bluetooth Service
 * Singleton EventEmitter wrapping bluetoothctl CLI for Bluetooth
 * speaker management. Supports scan, pair, connect, disconnect
 * with MAC validation and Audio Sink UUID filtering.
 *
 * Uses execFile (not exec) to prevent shell injection.
 * Phase 0: single speaker. Phase 4: multi-speaker via arrays.
 */

const EventEmitter = require('events');
const { execFile, spawn } = require('child_process');
const config = require('../config');
const logger = require('../utils/logger');

/** MAC address validation regex */
const MAC_REGEX = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

/** Audio Sink UUID — used to filter audio devices from non-audio BT devices */
const AUDIO_SINK_UUID = '0000110b';

/** Regex for parsing device lines from bluetoothctl output */
const DEVICE_LINE_REGEX = /^Device ([0-9A-Fa-f:]{17}) (.+)$/;

/** Regex for parsing [NEW] Device lines from scan output */
const NEW_DEVICE_REGEX = /\[NEW\] Device ([0-9A-Fa-f:]{17}) (.+)/;

class BluetoothService extends EventEmitter {
  constructor() {
    super();
    this._scanProc = null;
    this._discoveredAddresses = new Set();
  }

  /**
   * Initialize the Bluetooth service
   * @returns {Promise<void>}
   */
  async init() {
    const available = await this.isAvailable();
    if (available) {
      logger.info('Bluetooth service initialized — adapter available');
    } else {
      logger.warn('Bluetooth service initialized — no adapter or adapter powered off');
    }
  }

  /**
   * Check if a Bluetooth adapter is available and powered on
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const stdout = await this._execFile('bluetoothctl', ['show']);
      return /Powered:\s*yes/i.test(stdout);
    } catch {
      return false;
    }
  }

  /**
   * Get detailed adapter status
   * @returns {Promise<Object|null>} Adapter status or null if unavailable
   */
  async getAdapterStatus() {
    try {
      const stdout = await this._execFile('bluetoothctl', ['show']);

      const addressMatch = stdout.match(/Controller ([0-9A-Fa-f:]{17})/);
      const address = addressMatch ? addressMatch[1] : null;

      return {
        address,
        powered: /Powered:\s*yes/i.test(stdout),
        discoverable: /Discoverable:\s*yes/i.test(stdout),
        discovering: /Discovering:\s*yes/i.test(stdout),
      };
    } catch (err) {
      logger.error('Failed to get adapter status', { error: err.message });
      return null;
    }
  }

  /**
   * Start scanning for nearby Bluetooth devices.
   * Uses spawn to parse stdout line-by-line for discovered devices.
   * Guards against duplicate scans (Decision D8).
   *
   * @param {number} [timeout] - Scan timeout in seconds (default: config.bluetooth.scanTimeout)
   * @returns {{ alreadyScanning: true }|undefined}
   */
  startScan(timeout) {
    if (this._scanProc) {
      return { alreadyScanning: true };
    }

    const scanTimeout = timeout || config.bluetooth.scanTimeout;
    this._discoveredAddresses = new Set();

    this._scanProc = spawn('bluetoothctl', [
      '--timeout',
      String(scanTimeout),
      'scan',
      'on',
    ]);

    logger.info('Bluetooth scan started', { timeout: scanTimeout, pid: this._scanProc.pid });
    this.emit('scan:started', { timeout: scanTimeout });

    // Parse stdout line-by-line for [NEW] Device lines
    let buffer = '';
    this._scanProc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop();

      for (const line of lines) {
        const match = line.match(NEW_DEVICE_REGEX);
        if (match) {
          const address = match[1];
          const name = match[2];

          // Deduplicate within same scan
          if (!this._discoveredAddresses.has(address)) {
            this._discoveredAddresses.add(address);
            this.emit('device:discovered', { address, name });
            logger.debug('Device discovered', { address, name });
          }
        }
      }
    });

    this._scanProc.stderr.on('data', (data) => {
      logger.debug('bluetoothctl scan stderr', { data: data.toString() });
    });

    this._scanProc.on('close', (code) => {
      this._scanProc = null;
      logger.info('Bluetooth scan stopped', { exitCode: code });
      this.emit('scan:stopped', { exitCode: code });
    });
  }

  /**
   * Stop an active scan
   */
  stopScan() {
    if (this._scanProc) {
      this._scanProc.kill();
      // The 'close' handler will set _scanProc = null and emit scan:stopped
    }
  }

  /**
   * Get paired devices, filtered by Audio Sink UUID
   * @returns {Promise<Array<{address: string, name: string, connected: boolean}>>}
   */
  async getPairedDevices() {
    return this._getFilteredDevices('Paired');
  }

  /**
   * Get connected devices, filtered by Audio Sink UUID
   * @returns {Promise<Array<{address: string, name: string, connected: boolean}>>}
   */
  async getConnectedDevices() {
    return this._getFilteredDevices('Connected');
  }

  /**
   * Check if a device is an audio device (has Audio Sink UUID 0000110b)
   * @param {string} address - MAC address
   * @returns {Promise<boolean>}
   */
  async isAudioDevice(address) {
    this._validateMAC(address);

    try {
      const stdout = await this._execFile('bluetoothctl', ['info', address]);
      return stdout.includes(AUDIO_SINK_UUID);
    } catch {
      return false;
    }
  }

  /**
   * Pair a device using NoInputNoOutput agent, then trust it
   * @param {string} address - MAC address
   * @returns {Promise<void>}
   */
  async pairDevice(address) {
    this._validateMAC(address);

    logger.info('Pairing device', { address });
    await this._execFile('bluetoothctl', ['--agent', 'NoInputNoOutput', 'pair', address]);
    await this._execFile('bluetoothctl', ['trust', address]);
    logger.info('Device paired and trusted', { address });

    this.emit('device:paired', { address });
  }

  /**
   * Connect to a paired device
   * @param {string} address - MAC address
   * @returns {Promise<void>}
   */
  async connectDevice(address) {
    this._validateMAC(address);

    logger.info('Connecting to device', { address });
    await this._execFile('bluetoothctl', ['connect', address]);
    logger.info('Device connected', { address });

    this.emit('device:connected', { address });
  }

  /**
   * Disconnect from a device
   * @param {string} address - MAC address
   * @returns {Promise<void>}
   */
  async disconnectDevice(address) {
    this._validateMAC(address);

    logger.info('Disconnecting device', { address });
    await this._execFile('bluetoothctl', ['disconnect', address]);
    logger.info('Device disconnected', { address });

    this.emit('device:disconnected', { address });
  }

  /**
   * Remove (unpair) a device
   * @param {string} address - MAC address
   * @returns {Promise<void>}
   */
  async unpairDevice(address) {
    this._validateMAC(address);

    logger.info('Removing device', { address });
    await this._execFile('bluetoothctl', ['remove', address]);
    logger.info('Device removed', { address });

    this.emit('device:unpaired', { address });
  }

  /**
   * Kill active scan process, prevent orphaned processes on shutdown
   */
  cleanup() {
    if (this._scanProc) {
      this._scanProc.kill();
      this._scanProc = null;
    }
    logger.info('Bluetooth service cleaned up');
  }

  /**
   * Full reset for tests: kill processes, remove listeners, reset state
   */
  reset() {
    // 1. Kill scan process
    if (this._scanProc) {
      this._scanProc.kill();
      this._scanProc = null;
    }

    // 2. Remove all event listeners
    this.removeAllListeners();

    // 3. Reset state
    this._discoveredAddresses = new Set();
  }

  // ── Private helpers ──

  /**
   * Validate MAC address format
   * @param {string} address
   * @throws {Error} If MAC address is invalid
   * @private
   */
  _validateMAC(address) {
    if (!MAC_REGEX.test(address)) {
      throw new Error(`Invalid MAC address: ${address}`);
    }
  }

  /**
   * Promise wrapper around child_process.execFile
   * @param {string} cmd
   * @param {string[]} args
   * @returns {Promise<string>} stdout
   * @private
   */
  _execFile(cmd, args) {
    const timeout = config.bluetooth.connectTimeout * 1000;
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Get devices filtered by Audio Sink UUID
   * @param {string} filter - 'Paired' or 'Connected'
   * @returns {Promise<Array>}
   * @private
   */
  async _getFilteredDevices(filter) {
    try {
      const stdout = await this._execFile('bluetoothctl', ['devices', filter]);

      if (!stdout.trim()) {
        return [];
      }

      const lines = stdout.trim().split('\n');
      const devices = [];

      for (const line of lines) {
        const match = line.match(DEVICE_LINE_REGEX);
        if (match) {
          const address = match[1];
          const name = match[2];

          // Fetch device info once — check both Audio Sink UUID and connected status
          try {
            const info = await this._execFile('bluetoothctl', ['info', address]);
            const isAudio = info.includes(AUDIO_SINK_UUID);

            if (isAudio) {
              const connected = /Connected:\s*yes/i.test(info);
              devices.push({ address, name, connected });
            }
          } catch {
            // Device info unavailable, skip it
            logger.debug('Could not get info for device', { address });
          }
        }
      }

      return devices;
    } catch (err) {
      logger.error(`Failed to get ${filter} devices`, { error: err.message });
      return [];
    }
  }
}

// Export singleton instance
module.exports = new BluetoothService();
