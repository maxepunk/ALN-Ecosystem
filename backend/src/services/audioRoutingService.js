/**
 * Audio Routing Service
 * Singleton EventEmitter managing a routing table that maps named audio
 * streams to PipeWire sinks. Uses pactl CLI for sink discovery, stream
 * routing, and sink monitoring.
 *
 * Supports video, spotify, and sound audio streams with configurable
 * routing between HDMI and Bluetooth sinks.
 *
 * Uses execFile (not exec) to prevent shell injection.
 * Uses spawn for long-running pactl subscribe.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const { execFileAsync } = require('../utils/execHelper');

/** Valid stream names for Phase 1 */
const VALID_STREAMS = ['video', 'spotify', 'sound'];

/** Persistence key for routing config */
const PERSISTENCE_KEY = 'config:audioRouting';

/** Default routing state */
const DEFAULT_ROUTING = {
  routes: {
    video: { sink: 'hdmi' },
  },
  defaultSink: 'hdmi',
};

/** Timeout for pactl one-shot commands (ms) */
const PACTL_TIMEOUT = 5000;

/** Max retry time for findSinkInput (ms) */
const FIND_SINK_INPUT_MAX_WAIT = 2000;

/** Initial retry backoff for findSinkInput (ms) */
const FIND_SINK_INPUT_BACKOFF = 100;

/** Restart delay for pactl subscribe health check (ms) */
const MONITOR_RESTART_DELAY = 5000;

class AudioRoutingService extends EventEmitter {
  constructor() {
    super();
    this._monitorProc = null;
    this._monitorRestartTimer = null;
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));
  }

  // ── Lifecycle ──

  /**
   * Initialize the audio routing service.
   * Loads persisted routing config and starts sink monitor.
   * @returns {Promise<void>}
   */
  async init() {
    // Load persisted routing config
    const persisted = await persistenceService.load(PERSISTENCE_KEY);
    if (persisted && persisted.routes) {
      this._routingData = persisted;
      logger.info('Audio routing config restored from persistence', {
        routes: persisted.routes,
      });
    } else {
      logger.info('Audio routing using defaults', {
        routes: this._routingData.routes,
      });
    }

    // Start sink monitor
    this.startSinkMonitor();
  }

  /**
   * Kill pactl subscribe process, prevent orphaned processes on shutdown.
   */
  cleanup() {
    if (this._monitorProc) {
      this._monitorProc.kill();
      this._monitorProc = null;
    }
    if (this._monitorRestartTimer) {
      clearTimeout(this._monitorRestartTimer);
      this._monitorRestartTimer = null;
    }
    logger.info('Audio routing service cleaned up');
  }

  /**
   * Full reset for tests: kill processes, remove listeners, reset state.
   */
  reset() {
    this.cleanup();
    this.removeAllListeners();
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));
  }

  // ── Sink Discovery and Classification ──

  /**
   * Get all available PipeWire/PulseAudio sinks.
   * Runs `pactl list sinks short` and parses the tab-delimited output.
   * @returns {Promise<Array<{id: string, name: string, driver: string, format: string, state: string, type: string}>>}
   */
  async getAvailableSinks() {
    try {
      const stdout = await this._execFile('pactl', ['list', 'sinks', 'short']);
      return this._parseSinkList(stdout);
    } catch (err) {
      logger.error('Failed to get available sinks', { error: err.message });
      return [];
    }
  }

  /**
   * Classify a sink name by type.
   * @param {string} name - Sink name from pactl
   * @returns {'bluetooth' | 'hdmi' | 'other'}
   */
  classifySink(name) {
    if (name.startsWith('bluez_output')) {
      return 'bluetooth';
    }
    if (name.toLowerCase().includes('hdmi')) {
      return 'hdmi';
    }
    return 'other';
  }

  /**
   * Get all Bluetooth sinks.
   * @returns {Promise<Array>} Array of bluetooth sinks
   */
  async getBluetoothSinks() {
    const sinks = await this.getAvailableSinks();
    return sinks.filter(s => s.type === 'bluetooth');
  }

  /**
   * Get the first HDMI sink.
   * @returns {Promise<Object|null>} HDMI sink or null
   */
  async getHdmiSink() {
    const sinks = await this.getAvailableSinks();
    return sinks.find(s => s.type === 'hdmi') || null;
  }

  // ── Routing Table Management ──

  /**
   * Set the sink for a named stream and persist.
   * @param {string} stream - Stream name (Phase 0: only 'video')
   * @param {string} sink - Target sink: 'hdmi', 'bluetooth', or specific sink name
   * @returns {Promise<void>}
   */
  async setStreamRoute(stream, sink) {
    this._validateStream(stream);

    this._routingData.routes[stream] = { sink };

    // Persist
    await persistenceService.save(PERSISTENCE_KEY, this._routingData);

    logger.info('Stream route updated', { stream, sink });
    this.emit('routing:changed', { stream, sink });
  }

  /**
   * Get the current route for a named stream.
   * @param {string} stream - Stream name
   * @returns {string} Sink name or type
   */
  getStreamRoute(stream) {
    this._validateStream(stream);

    const route = this._routingData.routes[stream];
    return route ? route.sink : this._routingData.defaultSink;
  }

  /**
   * Get full routing status for sync:full payloads.
   * @returns {Object} Full routing state
   */
  getRoutingStatus() {
    return {
      routes: { ...this._routingData.routes },
      defaultSink: this._routingData.defaultSink,
    };
  }

  // ── Stream Routing ──

  /**
   * Apply routing for a stream: find the VLC sink-input and move it to the target sink.
   * Falls back to HDMI when the target sink is unavailable.
   * @param {string} stream - Stream name
   * @returns {Promise<void>}
   */
  async applyRouting(stream) {
    this._validateStream(stream);

    const targetSinkType = this.getStreamRoute(stream);
    const availableSinks = await this.getAvailableSinks();

    // Resolve target sink name
    let targetSink = this._resolveTargetSink(targetSinkType, availableSinks);
    let fellBack = false;

    if (!targetSink && targetSinkType !== 'hdmi') {
      // Fall back to HDMI
      const hdmiSink = availableSinks.find(s => s.type === 'hdmi');
      if (hdmiSink) {
        targetSink = hdmiSink;
        fellBack = true;
        logger.warn('Target sink unavailable, falling back to HDMI', {
          stream,
          requestedSink: targetSinkType,
          actualSink: hdmiSink.name,
        });
      }
    }

    if (!targetSink) {
      logger.error('No available sink for routing', { stream, targetSinkType });
      throw new Error(`No available sink for stream '${stream}'`);
    }

    // Find VLC sink-input with retry
    const sinkInputIdx = await this._findSinkInputWithRetry('VLC');
    if (!sinkInputIdx) {
      logger.warn('VLC sink-input not found, cannot apply routing', { stream });
      return;
    }

    // Move the stream
    await this.moveStreamToSink(sinkInputIdx, targetSink.name);

    if (fellBack) {
      this.emit('routing:fallback', {
        stream,
        requestedSink: targetSinkType,
        actualSink: targetSink.name,
      });
    }

    this.emit('routing:applied', {
      stream,
      sink: targetSink.name,
      sinkType: targetSink.type,
    });

    logger.info('Routing applied', {
      stream,
      sink: targetSink.name,
      sinkType: targetSink.type,
      fellBack,
    });
  }

  /**
   * Find a VLC sink-input by parsing `pactl list sink-inputs`.
   * Looks for `application.name = "VLC media player"`.
   * @param {string} appName - App name substring to match (e.g., 'VLC')
   * @returns {Promise<string|null>} Sink-input index or null
   */
  async findSinkInput(appName) {
    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      return this._parseSinkInputs(stdout, appName);
    } catch (err) {
      logger.error('Failed to list sink-inputs', { error: err.message });
      return null;
    }
  }

  /**
   * Move a sink-input to a specific sink.
   * @param {string} sinkInputIdx - Sink-input index
   * @param {string} sinkName - Target sink name
   * @returns {Promise<void>}
   */
  async moveStreamToSink(sinkInputIdx, sinkName) {
    await this._execFile('pactl', ['move-sink-input', sinkInputIdx, sinkName]);
    logger.debug('Moved sink-input to sink', { sinkInputIdx, sinkName });
  }

  // ── Sink Monitor ──

  /**
   * Start monitoring PipeWire sink additions/removals via `pactl subscribe`.
   * Emits sink:added / sink:removed events.
   * Auto-restarts on process exit with backoff.
   */
  startSinkMonitor() {
    if (this._monitorProc) {
      return;
    }

    this._monitorProc = spawn('pactl', ['subscribe']);
    logger.info('Sink monitor started', { pid: this._monitorProc.pid });

    let buffer = '';
    this._monitorProc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const event = this._parsePactlEvent(line);
        if (!event) continue;

        if (event.action === 'new' && event.type === 'sink') {
          this.emit('sink:added', { id: event.id });
          this._onSinkAdded(event.id);
        } else if (event.action === 'remove' && event.type === 'sink') {
          this.emit('sink:removed', { id: event.id });
        }
      }
    });

    this._monitorProc.stderr.on('data', (data) => {
      logger.debug('pactl subscribe stderr', { data: data.toString() });
    });

    this._monitorProc.on('close', (code) => {
      this._monitorProc = null;
      logger.warn('Sink monitor exited', { exitCode: code });

      // Auto-restart with backoff
      this._monitorRestartTimer = setTimeout(() => {
        this._monitorRestartTimer = null;
        logger.info('Restarting sink monitor');
        this.startSinkMonitor();
      }, MONITOR_RESTART_DELAY);
    });
  }

  // ── Private helpers ──

  /**
   * Validate stream name (Phase 0: only 'video')
   * @param {string} stream
   * @throws {Error} If stream name is invalid
   * @private
   */
  _validateStream(stream) {
    if (!VALID_STREAMS.includes(stream)) {
      throw new Error(`Invalid stream name: '${stream}'. Valid streams: ${VALID_STREAMS.join(', ')}`);
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
    return execFileAsync(cmd, args, PACTL_TIMEOUT);
  }

  /**
   * Parse `pactl list sinks short` tab-delimited output.
   * Each line: id\tname\tdriver\tformat\tstate
   * @param {string} output - Raw pactl output
   * @returns {Array<{id: string, name: string, driver: string, format: string, state: string, type: string}>}
   * @private
   */
  _parseSinkList(output) {
    if (!output || !output.trim()) {
      return [];
    }

    const sinks = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;

      const id = parts[0];
      const name = parts[1];
      const driver = parts[2] || '';
      const format = parts[3] || '';
      const state = parts[4] || '';

      sinks.push({
        id,
        name,
        driver,
        format,
        state,
        type: this.classifySink(name),
      });
    }

    return sinks;
  }

  /**
   * Parse a `pactl subscribe` event line.
   * Format: "Event 'action' on type #id"
   * @param {string} line - Single line from pactl subscribe
   * @returns {{action: string, type: string, id: string}|null}
   * @private
   */
  _parsePactlEvent(line) {
    const match = line.match(/^Event '(\w+)' on (sink|source|sink-input|source-output) #(\d+)$/);
    if (!match) return null;

    return {
      action: match[1],
      type: match[2],
      id: match[3],
    };
  }

  /**
   * Parse `pactl list sink-inputs` output to find a specific application's sink-input index.
   * Looks for `application.name = "..."` containing the search term.
   * @param {string} output - Raw pactl output
   * @param {string} appName - Application name substring to search for
   * @returns {string|null} Sink-input index or null
   * @private
   */
  _parseSinkInputs(output, appName) {
    if (!output || !output.trim()) {
      return null;
    }

    const lines = output.split('\n');
    let currentIdx = null;

    for (const line of lines) {
      // Match "Sink Input #NNN"
      const idxMatch = line.match(/^Sink Input #(\d+)/);
      if (idxMatch) {
        currentIdx = idxMatch[1];
      }

      // Match application.name = "..."
      const nameMatch = line.match(/application\.name\s*=\s*"([^"]+)"/);
      if (nameMatch && currentIdx) {
        if (nameMatch[1].includes(appName)) {
          return currentIdx;
        }
      }
    }

    return null;
  }

  /**
   * Find VLC sink-input with retry and exponential backoff.
   * Retries up to 2 seconds with 100ms initial backoff.
   * @param {string} appName - Application name to search for
   * @returns {Promise<string|null>} Sink-input index or null
   * @private
   */
  async _findSinkInputWithRetry(appName) {
    let elapsed = 0;
    let backoff = FIND_SINK_INPUT_BACKOFF;

    while (elapsed < FIND_SINK_INPUT_MAX_WAIT) {
      const idx = await this.findSinkInput(appName);
      if (idx) return idx;

      // Wait before retrying
      await this._sleep(backoff);
      elapsed += backoff;
      backoff *= 2; // Exponential backoff
    }

    // Final attempt
    return this.findSinkInput(appName);
  }

  /**
   * Resolve a target sink type/name to an actual available sink.
   * @param {string} sinkType - 'hdmi', 'bluetooth', or specific sink name
   * @param {Array} availableSinks - Array of available sink objects
   * @returns {Object|null} Matching sink or null
   * @private
   */
  _resolveTargetSink(sinkType, availableSinks) {
    // Try exact name match first
    const exactMatch = availableSinks.find(s => s.name === sinkType);
    if (exactMatch) return exactMatch;

    // Try type match
    const typeMatch = availableSinks.find(s => s.type === sinkType);
    return typeMatch || null;
  }

  /**
   * Handle a newly added sink. If the video route targets bluetooth and
   * the new sink is bluetooth, auto-apply routing (Decision D2).
   * @param {string} sinkId - PipeWire sink ID
   * @private
   */
  async _onSinkAdded(sinkId) {
    try {
      // Check if video route targets bluetooth
      const videoRoute = this.getStreamRoute('video');
      if (videoRoute !== 'bluetooth') return;

      // Check if the new sink is bluetooth by querying available sinks
      const sinks = await this.getAvailableSinks();
      const newSink = sinks.find(s => s.id === sinkId);
      if (!newSink || newSink.type !== 'bluetooth') return;

      logger.info('Bluetooth sink appeared, auto-applying video routing', {
        sinkId,
        sinkName: newSink.name,
      });

      await this.applyRouting('video');
    } catch (err) {
      logger.error('Failed to auto-apply routing on sink added', {
        sinkId,
        error: err.message,
      });
      this.emit('routing:error', {
        stream: 'video',
        error: err.message,
        context: 'auto-routing on sink added',
      });
    }
  }

  /**
   * Promise-based sleep utility.
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new AudioRoutingService();
