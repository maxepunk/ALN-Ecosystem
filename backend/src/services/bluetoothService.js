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
const { spawn } = require('child_process');
const config = require('../config');
const logger = require('../utils/logger');
const { execFileAsync } = require('../utils/execHelper');

/** MAC address validation regex */
const MAC_REGEX = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

/** Audio Sink UUID — used to filter audio devices from non-audio BT devices */
const AUDIO_SINK_UUID = '0000110b';

/** Regex for parsing device lines from bluetoothctl output */
const DEVICE_LINE_REGEX = /^Device ([0-9A-Fa-f:]{17}) (.+)$/;

/** Regex for parsing [NEW] and [CHG] Device lines from scan output.
 *  BlueZ emits [NEW] on first discovery but [CHG] for cached devices.
 *  The [\s\S]*? handles ANSI escapes and readline control chars (\x01\x02)
 *  that bluetoothctl embeds between brackets and text. */
const SCAN_DEVICE_REGEX = /\[[\s\S]*?(?:NEW|CHG)[\s\S]*?\] Device ([0-9A-Fa-f:]{17}) (.+)/;

class BluetoothService extends EventEmitter {
  constructor() {
    super();
    this._scanProc = null;
    this._pairProc = null;
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
    // MACs seen via RSSI/property updates only — resolved after scan ends
    const pendingResolve = new Set();

    this._scanProc = spawn('bluetoothctl', [
      '--timeout',
      String(scanTimeout),
      'scan',
      'on',
    ]);

    logger.info('Bluetooth scan started', { timeout: scanTimeout, pid: this._scanProc.pid });
    this.emit('scan:started', { timeout: scanTimeout });

    // Parse stdout line-by-line for device lines.
    // BlueZ emits [NEW] on first discovery but [CHG] for cached devices.
    // Cached devices often appear ONLY as RSSI/property updates with no name,
    // so we track those MACs and resolve names after the scan completes.
    let buffer = '';
    this._scanProc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop();

      for (const line of lines) {
        const match = line.match(SCAN_DEVICE_REGEX);
        if (match) {
          const address = match[1];
          const name = match[2];

          // Skip CHG lines that are just property updates (RSSI, ManufacturerData, etc.)
          // but track the MAC for post-scan name resolution
          if (/^[0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-]/.test(name) ||
              name.startsWith('RSSI:') || name.startsWith('ManufacturerData')) {
            if (!this._discoveredAddresses.has(address)) {
              pendingResolve.add(address);
            }
            continue;
          }

          // Deduplicate within same scan
          if (!this._discoveredAddresses.has(address)) {
            this._discoveredAddresses.add(address);
            pendingResolve.delete(address);
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

      // Resolve names for cached devices seen only via RSSI updates,
      // then emit scan:stopped so listeners see all devices before stop
      this._resolveUnnamedDevices(pendingResolve)
        .catch((err) => {
          logger.warn('Error resolving cached devices', { error: err.message });
        })
        .finally(() => {
          logger.info('Bluetooth scan stopped', { exitCode: code });
          this.emit('scan:stopped', { exitCode: code });
        });
    });
  }

  /**
   * Check if a scan is currently active
   * @returns {boolean}
   */
  isScanning() {
    return !!this._scanProc;
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
   * Pair a device using NoInputNoOutput agent, then trust it.
   * Uses a single interactive bluetoothctl session to avoid BlueZ cache
   * eviction — discovered devices are flushed when scan exits, so scan +
   * pair + trust must happen within the same process.
   *
   * @param {string} address - MAC address
   * @returns {Promise<void>}
   */
  async pairDevice(address) {
    this._validateMAC(address);

    // Stop any active scan to avoid D-Bus conflicts
    this.stopScan();

    logger.info('Pairing device', { address });
    await this._pairInteractive(address);

    // Resolve device name now that it's permanently in BlueZ cache
    const name = await this._getDeviceName(address);
    logger.info('Device paired and trusted', { address, name });
    this.emit('device:paired', { address, name });

    // Auto-connect — for speakers, pair without connect is useless
    try {
      await this._execFile('bluetoothctl', ['connect', address]);
      logger.info('Device auto-connected after pair', { address, name });
      this.emit('device:connected', { address, name });
    } catch (err) {
      logger.warn('Auto-connect after pair failed (connect manually)', {
        address, error: err.message,
      });
    }
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
    const name = await this._getDeviceName(address);
    logger.info('Device connected', { address, name });

    this.emit('device:connected', { address, name });
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
    if (this._pairProc) {
      this._pairProc.kill();
      this._pairProc = null;
    }
    logger.info('Bluetooth service cleaned up');
  }

  /**
   * Full reset for tests: kill processes, remove listeners, reset state
   */
  reset() {
    this.cleanup();
    this.removeAllListeners();
    this._discoveredAddresses = new Set();
  }

  // ── Private helpers ──

  /**
   * Look up names for MAC addresses seen during scan only as RSSI/property updates.
   * BlueZ caches device names from prior scans but only emits RSSI updates for
   * them in subsequent scans — the name never appears in scan output.
   * @param {Set<string>} addresses - MAC addresses to resolve
   * @returns {Promise<void>}
   * @private
   */
  async _resolveUnnamedDevices(addresses) {
    if (addresses.size === 0) return;

    logger.debug('Resolving cached devices from scan', { count: addresses.size });

    for (const address of addresses) {
      if (this._discoveredAddresses.has(address)) continue;

      try {
        const info = await this._execFile('bluetoothctl', ['info', address]);
        const nameMatch = info.match(/^\s*Name:\s*(.+)$/m);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          this._discoveredAddresses.add(address);
          this.emit('device:discovered', { address, name });
          logger.debug('Resolved cached device', { address, name });
        }
      } catch {
        logger.debug('Could not resolve device', { address });
      }
    }
  }

  /**
   * Get device name from BlueZ cache via bluetoothctl info
   * @param {string} address - MAC address
   * @returns {Promise<string|null>} Device name or null
   * @private
   */
  async _getDeviceName(address) {
    try {
      const info = await this._execFile('bluetoothctl', ['info', address]);
      const nameMatch = info.match(/^\s*Name:\s*(.+)$/m);
      return nameMatch ? nameMatch[1].trim() : null;
    } catch {
      return null;
    }
  }

  /**
   * Run scan + pair + trust in a single interactive bluetoothctl session.
   * BlueZ evicts unpaired devices from cache when StopDiscovery is sent
   * (i.e. when a scan process exits), so a separate-process pair always
   * gets "not available". Keeping one session avoids this.
   *
   * State machine: scan → discover → pair → trust → done
   *
   * @param {string} address - MAC address to pair
   * @returns {Promise<void>}
   * @private
   */
  _pairInteractive(address) {
    // connectTimeout for pair + 12s buffer for scan discovery
    const timeout = (config.bluetooth.connectTimeout + 12) * 1000;

    return new Promise((resolve, reject) => {
      const proc = spawn('bluetoothctl', ['--agent', 'NoInputNoOutput']);
      this._pairProc = proc;

      let buffer = '';
      let settled = false;
      let state = 'scan'; // scan → discover → pair → trust
      let stateOffset = 0;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this._pairProc = null;
          proc.kill();
          reject(new Error(`Pair timeout for ${address} (phase: ${state})`));
        }
      }, timeout);

      let discoverTimer = null;

      const transition = (newState) => {
        state = newState;
        stateOffset = buffer.length;
      };

      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (discoverTimer) clearTimeout(discoverTimer);
        this._pairProc = null;
        try {
          proc.stdin.write('scan off\n');
          proc.stdin.write('exit\n');
        } catch { /* stdin may be closed */ }
        setTimeout(() => { try { proc.kill(); } catch { /* already dead */ } }, 1000);
        if (err) reject(err);
        else resolve();
      };

      const addrPattern = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      proc.stdout.on('data', (data) => {
        buffer += data.toString();
        // Strip ANSI escape codes for reliable pattern matching
        const recent = buffer.slice(stateOffset)
          .replace(/\x1b\[[0-9;]*[a-zA-Z]|\x01|\x02/g, '');

        switch (state) {
          case 'scan':
            if (/Discovery started/i.test(recent)) {
              transition('discover');
              // If device not discovered within 8s, attempt pair anyway
              // (it might already be in BlueZ cache from a prior scan)
              discoverTimer = setTimeout(() => {
                if (state === 'discover' && !settled) {
                  logger.debug('Discovery timeout, attempting pair anyway', { address });
                  transition('pair');
                  proc.stdin.write(`pair ${address}\n`);
                }
              }, 8000);
            }
            break;

          case 'discover':
            if (new RegExp(`Device ${addrPattern}`, 'i').test(recent)) {
              clearTimeout(discoverTimer);
              logger.debug('Device discovered in scan, pairing', { address });
              transition('pair');
              proc.stdin.write(`pair ${address}\n`);
            }
            break;

          case 'pair':
            if (/Pairing successful/i.test(recent)) {
              logger.debug('Pair successful, trusting device', { address });
              transition('trust');
              proc.stdin.write(`trust ${address}\n`);
            } else if (/AlreadyExists/i.test(recent)) {
              logger.debug('Already paired, trusting device', { address });
              transition('trust');
              proc.stdin.write(`trust ${address}\n`);
            } else if (/Failed to pair|org\.bluez\.Error/i.test(recent)) {
              const errMatch = recent.match(
                /(?:Failed to pair|org\.bluez\.Error\.\w+)[^\n]*/
              );
              finish(new Error(
                errMatch ? errMatch[0].trim() : `Failed to pair ${address}`
              ));
            } else if (/not available/i.test(recent)) {
              finish(new Error(`Device ${address} not available for pairing`));
            }
            break;

          case 'trust':
            if (/trust succeeded|Trusted: yes/i.test(recent)) {
              finish(null);
            }
            break;
        }
      });

      proc.stderr.on('data', (data) => {
        logger.debug('bluetoothctl pair stderr', { data: data.toString() });
      });

      proc.on('close', (code) => {
        finish(new Error(
          `bluetoothctl exited (code ${code}) before pair completed`
        ));
      });

      // Start scan to populate BlueZ device cache
      proc.stdin.write('scan on\n');
    });
  }

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
    return execFileAsync(cmd, args, config.bluetooth.connectTimeout * 1000);
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
