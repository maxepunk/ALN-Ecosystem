/**
 * MprisPlayerBase — shared D-Bus MPRIS service foundation.
 *
 * Extracts common D-Bus MPRIS patterns: dbus-send calls, property get/set,
 * transport controls, playback monitoring via dbus-monitor + signal parsing,
 * connection health checks, and state management.
 *
 * Subclasses override:
 *   _getDestination()      — static (VLC) or dynamic discovery (Spotify)
 *   _processStateChange()  — service-specific property handling
 *   _parseMetadata()       — service-specific metadata parsing
 *   _dbusCall()            — override entirely for recovery logic (Spotify)
 */

'use strict';

const EventEmitter = require('events');
const { execFile } = require('child_process');
const logger = require('../utils/logger');
const registry = require('./serviceHealthRegistry');
const ProcessMonitor = require('../utils/processMonitor');
const DbusSignalParser = require('../utils/dbusSignalParser');

const DBUS_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

// Wrap execFile to always return {stdout, stderr}
function execFileAsync(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

class MprisPlayerBase extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string|null} options.destination - Static D-Bus destination (null for dynamic)
   * @param {string} options.label - Service label for logging
   * @param {string} options.healthServiceId - Service ID for health registry
   * @param {number} [options.signalDebounceMs=300] - Debounce window for MPRIS signals
   */
  constructor({ destination, label, healthServiceId, signalDebounceMs = 300 }) {
    super();
    this._destination = destination;
    this._label = label;
    this._healthServiceId = healthServiceId;
    this._signalDebounceMs = signalDebounceMs;

    // Playback state
    this.state = 'stopped';
    this.volume = 100;
    this.track = null;

    // D-Bus playback monitor
    this._playbackMonitor = null;
    this._mprisSignalParser = null;
    this._signalDebounceTimer = null;
    this._pendingSignal = null;

    // Unique D-Bus name for sender filtering (prevents cross-contamination)
    this._ownerBusName = null;
    this._resolvingOwner = false;
  }

  // ── Core D-Bus Methods ──

  /**
   * Build dbus-send argument array.
   * @param {string} dest - D-Bus destination
   * @param {string} method - D-Bus method to call
   * @param {string[]} [args] - Additional args
   * @returns {string[]}
   */
  _buildDbusArgs(dest, method, args = []) {
    return [
      '--session', '--type=method_call', '--print-reply',
      '--dest=' + dest, DBUS_PATH,
      method, ...args
    ];
  }

  /**
   * Execute a D-Bus method call. Override entirely for recovery logic.
   * Base: get destination → build args → exec → throw on failure.
   * @param {string} method - D-Bus method
   * @param {string[]} [args] - Additional args
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  async _dbusCall(method, args = []) {
    const dest = this._getDestination();
    if (!dest) throw new Error(`${this._label} not found on D-Bus`);
    const cmdArgs = this._buildDbusArgs(dest, method, args);
    return execFileAsync('dbus-send', cmdArgs, { timeout: 5000 });
  }

  /**
   * Get the D-Bus destination. Override for dynamic discovery.
   * @returns {string|null}
   */
  _getDestination() {
    return this._destination;
  }

  /**
   * Get a D-Bus property.
   * @param {string} iface - Interface name
   * @param {string} property - Property name
   */
  async _dbusGetProperty(iface, property) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Get', [
      `string:${iface}`, `string:${property}`
    ]);
  }

  /**
   * Set a D-Bus property.
   * @param {string} iface - Interface name
   * @param {string} property - Property name
   * @param {string} type - D-Bus type
   * @param {string} value - Value to set
   */
  async _dbusSetProperty(iface, property, type, value) {
    return this._dbusCall('org.freedesktop.DBus.Properties.Set', [
      `string:${iface}`, `string:${property}`, `variant:${type}:${value}`
    ]);
  }

  /**
   * Transport control helper — _ensureConnection then invoke MPRIS Player method.
   * @param {string} method - MPRIS Player method name (e.g., 'Play')
   */
  async _transport(method) {
    await this._ensureConnection();
    await this._dbusCall(`${PLAYER_IFACE}.${method}`);
  }

  // ── Connection Health ──

  /**
   * Update connected state via service health registry.
   * @param {boolean} connected
   */
  _setConnected(connected) {
    registry.report(this._healthServiceId,
      connected ? 'healthy' : 'down',
      connected ? 'D-Bus connected' : 'D-Bus unreachable'
    );
  }

  /**
   * Pre-command validation — verifies service is reachable.
   * Probes if not healthy; throws if still unreachable.
   */
  async _ensureConnection() {
    if (registry.isHealthy(this._healthServiceId)) return;
    const ok = await this.checkConnection();
    if (!ok) throw new Error(`${this._label} not connected`);
  }

  /**
   * Check connection by reading PlaybackStatus. Reports health.
   * Syncs internal state from actual D-Bus status.
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'PlaybackStatus');
      this._setConnected(true);

      let newState;
      if (stdout.includes('"Playing"')) newState = 'playing';
      else if (stdout.includes('"Paused"')) newState = 'paused';
      else newState = 'stopped';

      if (newState !== this.state) {
        this.state = newState;
        this.emit('playback:changed', { state: newState });
      }
      return true;
    } catch {
      this._setConnected(false);
      return false;
    }
  }

  // ── State ──

  /**
   * Get current service state snapshot.
   * @returns {{connected: boolean, state: string, volume: number, track: Object|null}}
   */
  getState() {
    return {
      connected: registry.isHealthy(this._healthServiceId),
      state: this.state,
      volume: this.volume,
      track: this.track,
    };
  }

  // ── D-Bus Playback Monitor ──

  /**
   * Start monitoring MPRIS property changes via dbus-monitor.
   * Idempotent — no-op if already monitoring.
   */
  startPlaybackMonitor() {
    if (this._playbackMonitor) return;

    const matchRule = "type='signal',interface='org.freedesktop.DBus.Properties',path='/org/mpris/MediaPlayer2'";

    this._playbackMonitor = new ProcessMonitor({
      command: 'dbus-monitor',
      args: ['--session', '--monitor', matchRule],
      label: `${this._label}-dbus-monitor`,
      pidFile: `/tmp/aln-pm-${this._label.toLowerCase()}-dbus-monitor.pid`,
    });

    this._mprisSignalParser = new DbusSignalParser();

    this._playbackMonitor.on('line', (line) => {
      this._mprisSignalParser.feedLine(line);
    });

    this._mprisSignalParser.on('signal', (signal) => {
      this._handleMprisSignal(signal);
    });

    this._playbackMonitor.start();
    logger.info(`[${this._label}] MPRIS D-Bus monitor started`);
  }

  /**
   * Stop the MPRIS D-Bus playback monitor.
   * Clears debounce timers first; pending signals are discarded.
   */
  stopPlaybackMonitor() {
    if (this._signalDebounceTimer) {
      clearTimeout(this._signalDebounceTimer);
      this._signalDebounceTimer = null;
    }
    this._pendingSignal = null;

    if (this._playbackMonitor) {
      this._playbackMonitor.stop();
      this._playbackMonitor = null;
    }
    if (this._mprisSignalParser) {
      this._mprisSignalParser = null;
    }
  }

  /**
   * Handle a parsed MPRIS D-Bus signal. Debounces rapid signals by MERGING
   * properties (not replacing). During track transitions, D-Bus sends
   * PlaybackStatus and Metadata in separate signals — both must be captured.
   * @private
   */
  _handleMprisSignal(signal) {
    if (signal.changedInterface !== 'org.mpris.MediaPlayer2.Player') return;

    // Filter by sender to prevent cross-contamination between MPRIS players.
    // If _ownerBusName is null (not yet resolved), process all signals (safe fallback).
    if (this._ownerBusName && signal.sender && signal.sender !== this._ownerBusName) {
      // Sender mismatch — could be restarted instance or different player.
      // Trigger async re-resolution (debounced by flag) and drop this signal.
      if (!this._resolvingOwner) {
        this._resolvingOwner = true;
        this._refreshOwner().finally(() => { this._resolvingOwner = false; });
      }
      return;
    }

    if (!this._pendingSignal) {
      this._pendingSignal = { properties: {}, raw: '' };
    }
    if (signal.properties) {
      Object.assign(this._pendingSignal.properties, signal.properties);
    }
    if (signal.raw) {
      this._pendingSignal.raw += (this._pendingSignal.raw ? '\n' : '') + signal.raw;
    }

    if (this._signalDebounceTimer) {
      clearTimeout(this._signalDebounceTimer);
    }

    this._signalDebounceTimer = setTimeout(() => {
      this._signalDebounceTimer = null;
      const merged = this._pendingSignal;
      this._pendingSignal = null;
      this._processStateChange(merged);
    }, this._signalDebounceMs);
  }

  // ── D-Bus Owner Resolution ──

  /**
   * Resolve our well-known D-Bus destination to its unique bus name.
   * Used for sender filtering in _handleMprisSignal to prevent
   * cross-contamination between MPRIS players (e.g., VLC vs Spotify).
   * Non-fatal: if resolution fails, _ownerBusName stays null and
   * all signals are processed (fallback to pre-filter behavior).
   */
  async _resolveOwner() {
    const dest = this._getDestination();
    if (!dest) {
      this._ownerBusName = null;
      return;
    }
    try {
      const { stdout } = await execFileAsync('dbus-send', [
        '--session', '--type=method_call', '--print-reply',
        '--dest=org.freedesktop.DBus', '/org/freedesktop/DBus',
        'org.freedesktop.DBus.GetNameOwner', `string:${dest}`
      ], { timeout: 2000 });
      const match = stdout.match(/string "([^"]+)"/);
      this._ownerBusName = match ? match[1] : null;
      if (this._ownerBusName) {
        logger.debug(`[${this._label}] Resolved D-Bus owner`, {
          destination: dest, owner: this._ownerBusName,
        });
      }
    } catch {
      this._ownerBusName = null;
    }
  }

  /**
   * Re-resolve D-Bus owner after sender mismatch.
   * Default: re-resolve same destination. Spotify overrides to re-discover.
   * On failure, preserves old _ownerBusName to prevent cross-contamination.
   */
  async _refreshOwner() {
    const oldOwner = this._ownerBusName;
    await this._resolveOwner();
    if (!this._ownerBusName && oldOwner) {
      this._ownerBusName = oldOwner;
    }
  }

  // ── Subclass Hooks (must override) ──

  /**
   * Process debounced MPRIS property changes. Subclass must implement.
   * @param {Object} signal - Merged signal with {properties, raw}
   * @abstract
   */
  _processStateChange(/* signal */) {
    throw new Error('_processStateChange must be implemented by subclass');
  }

  /**
   * Parse metadata from raw D-Bus output. Subclass must implement.
   * @param {string} raw - Raw dbus-send output
   * @returns {Object|null}
   * @abstract
   */
  _parseMetadata(/* raw */) {
    throw new Error('_parseMetadata must be implemented by subclass');
  }

  // ── Lifecycle ──

  /**
   * Full reset — stop monitor, clear state, report health down.
   */
  reset() {
    this.stopPlaybackMonitor();
    registry.report(this._healthServiceId, 'down', 'Reset');
    this.state = 'stopped';
    this.volume = 100;
    this.track = null;
    this._ownerBusName = null;
    this._resolvingOwner = false;
  }

  /**
   * Cleanup — reset and remove all listeners.
   */
  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

module.exports = MprisPlayerBase;
