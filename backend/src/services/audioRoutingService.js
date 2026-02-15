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

/** Map stream names to application process names */
const STREAM_APP_NAMES = {
  video: 'VLC',
  spotify: 'spotifyd',
  sound: 'pw-play',
};

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
/** Max consecutive monitor failures before giving up (prevents PipeWire connection exhaustion) */
const MONITOR_MAX_FAILURES = 5;
/** Backoff multiplier per consecutive failure */
const MONITOR_BACKOFF_MULTIPLIER = 2;

class AudioRoutingService extends EventEmitter {
  constructor() {
    super();
    this._monitorProc = null;
    this._monitorRestartTimer = null;
    this._monitorFailures = 0;
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));

    // Combine-sink state
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];

    // Ducking engine state
    this._duckingRules = [];
    this._activeDuckingSources = {};  // { targetStream: ['video', 'sound'] }
    this._preDuckVolumes = {};        // { targetStream: originalVolume }
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
    this._monitorFailures = 0;

    // Tear down combine-sink processes
    this._killCombineSinkProcs();

    logger.info('Audio routing service cleaned up');
  }

  /**
   * Full reset for tests: kill processes, remove listeners, reset state.
   */
  reset() {
    this.cleanup();
    this.removeAllListeners();
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];

    // Reset ducking engine state
    this._duckingRules = [];
    this._activeDuckingSources = {};
    this._preDuckVolumes = {};
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
    if (name === 'combine-bt' || name === 'aln-combine') {
      return 'combine';
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
  async getRoutingStatus() {
    return {
      routes: { ...this._routingData.routes },
      defaultSink: this._routingData.defaultSink,
      availableSinks: await this.getAvailableSinksWithCombine(),
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

    // Find the sink-input for this stream's application
    const appName = STREAM_APP_NAMES[stream] || 'VLC';
    const sinkInput = await this._findSinkInputWithRetry(appName);
    if (!sinkInput) {
      logger.warn(`${appName} sink-input not found, cannot apply routing`, { stream });
      return;
    }

    // Move the stream
    await this.moveStreamToSink(sinkInput.index, targetSink.name);

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
   * Find a sink-input by application name.
   * @param {string} appName - App name substring to match (e.g., 'VLC', 'spotifyd', 'pw-play')
   * @returns {Promise<{index: string}|null>} Sink-input object with index or null
   */
  async findSinkInput(appName) {
    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      const index = this._parseSinkInputs(stdout, appName);
      return index ? { index } : null;
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

  // ── Stream Validation ──

  /**
   * Check if a stream name is valid.
   * @param {string} stream - Stream name to validate
   * @returns {boolean} True if valid
   */
  isValidStream(stream) {
    return VALID_STREAMS.includes(stream);
  }

  // ── Volume Control ──

  /**
   * Set volume for a named stream.
   * @param {string} stream - Stream name (video, spotify, sound)
   * @param {number} volume - Volume percentage (0-100)
   * @returns {Promise<void>}
   */
  async setStreamVolume(stream, volume) {
    this._validateStream(stream);

    // Clamp volume to 0-100 range
    const clampedVolume = Math.max(0, Math.min(100, volume));

    // Get app name for this stream
    const appName = STREAM_APP_NAMES[stream];

    // Find the sink-input for this app
    const sinkInput = await this.findSinkInput(appName);
    if (!sinkInput || !sinkInput.index) {
      throw new Error(`No active sink-input found for stream '${stream}'`);
    }

    // Set the volume
    await this._execFile('pactl', ['set-sink-input-volume', sinkInput.index, `${clampedVolume}%`]);

    logger.info('Stream volume set', { stream, volume: clampedVolume, sinkInputIdx: sinkInput.index });
  }

  /**
   * Get current volume for a named stream.
   * @param {string} stream - Stream name
   * @returns {Promise<number|null>} Volume percentage or null if not found
   */
  async getStreamVolume(stream) {
    this._validateStream(stream);

    const appName = STREAM_APP_NAMES[stream];
    const sinkInput = await this.findSinkInput(appName);

    if (!sinkInput || !sinkInput.index) {
      return null;
    }

    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      const volumeMatch = this._extractVolumeForSinkInput(stdout, sinkInput.index);
      return volumeMatch;
    } catch (err) {
      logger.error('Failed to get stream volume', { stream, error: err.message });
      return null;
    }
  }

  // ── Combine-Sink Management ──

  /**
   * Create a virtual combine-sink that forwards audio to both BT speakers.
   * Spawns two pw-loopback processes, one per BT speaker, sharing a virtual
   * capture node named 'combine-bt'. Tracks PIDs for cleanup.
   *
   * Requires at least 2 connected Bluetooth speakers.
   * No-op if combine-sink is already active.
   * @returns {Promise<void>}
   */
  async createCombineSink() {
    if (this._combineSinkActive) {
      logger.info('Combine-sink already active, skipping creation');
      return;
    }

    const btSinks = await this.getBluetoothSinks();
    if (btSinks.length < 2) {
      throw new Error(
        `Need at least 2 Bluetooth speakers for combine-sink, found ${btSinks.length}`
      );
    }

    // 1. Create Null Sink (The Source)
    try {
      const stdout = await execFileAsync('pactl', [
        'load-module',
        'module-null-sink',
        'sink_name=aln-combine',
        'sink_properties=device.description=ALN_Multi_Speaker'
      ]);
      this._combineSinkModuleId = stdout.trim();
      logger.info('Created null sink aln-combine', { moduleId: this._combineSinkModuleId });
    } catch (err) {
      logger.error('Failed to create null sink', { error: err.message });
      throw err;
    }

    // 2. Spawn Loopbacks (The Cables)
    // Connect aln-combine.monitor -> Speaker Sinks
    const targetSinks = btSinks.slice(0, 2);
    const procs = [];
    const pids = [];

    for (const sink of targetSinks) {
      const proc = spawn('pw-loopback', [
        '--capture-props', 'node.target=aln-combine.monitor media.class=Stream/Input/Audio',
        '--playback-props', `node.target=${sink.name} node.latency=200/1000`, // 200ms latency request
      ]);

      // Handle unexpected exit of pw-loopback process
      proc.on('close', (code) => {
        logger.warn('pw-loopback process exited', { pid: proc.pid, code, sink: sink.name });
        this._onCombineLoopbackExit(proc.pid);
      });

      procs.push(proc);
      pids.push(proc.pid);

      logger.info('pw-loopback started', { pid: proc.pid, target: sink.name });
    }

    this._combineSinkActive = true;
    this._combineSinkPids = pids;
    this._combineSinkProcs = procs;

    const sinkNames = targetSinks.map(s => s.name);
    logger.info('Combine-sink created (Null Sink + Loopbacks)', { pids, sinks: sinkNames });

    this.emit('combine-sink:created', { pids, sinks: sinkNames });
  }

  /**
   * Tear down the combine-sink by killing all pw-loopback processes.
   * Safe to call when no combine-sink is active.
   * @returns {Promise<void>}
   */
  async destroyCombineSink() {
    if (!this._combineSinkActive) {
      return;
    }

    // 1. Kill Loopbacks
    this._killCombineSinkProcs();

    // 2. Unload Null Sink
    if (this._combineSinkModuleId) {
      try {
        await execFileAsync('pactl', ['unload-module', this._combineSinkModuleId]);
        logger.info('Unloaded null sink aln-combine', { moduleId: this._combineSinkModuleId });
      } catch (err) {
        logger.warn('Failed to unload null sink', { error: err.message, moduleId: this._combineSinkModuleId });
      }
      this._combineSinkModuleId = null;
    }

    logger.info('Combine-sink destroyed');
    this.emit('combine-sink:destroyed');
  }

  /**
   * Get available sinks including the virtual combine-bt sink if active.
   * @returns {Promise<Array>} Array of sink objects (real + virtual)
   */
  async getAvailableSinksWithCombine() {
    let sinks = await this.getAvailableSinks();

    // Remove any raw 'aln-combine' sinks (from pactl list) to avoid duplicates with our virtual entry
    // Also remove legacy 'combine-bt' if present
    sinks = sinks.filter(s => s.name !== 'aln-combine' && s.name !== 'combine-bt');

    // Only add virtual sink if combine is active
    if (this._combineSinkActive) {
      sinks.push({
        id: 'virtual-combine',
        name: 'aln-combine',
        driver: 'module-null-sink',
        format: '',
        state: 'RUNNING',
        type: 'combine',
        virtual: true,
        label: 'All Bluetooth Speakers',
      });
    }

    return sinks;
  }

  /**
   * Handle BT sink changes (called from sink:added / sink:removed).
   * Auto-creates combine-sink when 2+ BT speakers are available.
   * Auto-destroys combine-sink when fewer than 2 BT speakers remain.
   * @returns {Promise<void>}
   * @private
   */
  async _onBtSinkChanged() {
    try {
      const btSinks = await this.getBluetoothSinks();

      if (btSinks.length >= 2 && !this._combineSinkActive) {
        logger.info('Two BT speakers detected, auto-creating combine-sink');
        await this.createCombineSink();
      } else if (btSinks.length < 2 && this._combineSinkActive) {
        logger.info('Fewer than 2 BT speakers, auto-destroying combine-sink');
        await this.destroyCombineSink();
      }
    } catch (err) {
      logger.error('Failed to handle BT sink change for combine-sink', {
        error: err.message,
      });
    }
  }

  /**
   * Handle unexpected exit of a pw-loopback process.
   * Tears down the entire combine-sink since it requires both loopbacks.
   * @param {number} exitedPid - PID of the exited process
   * @private
   */
  _onCombineLoopbackExit(exitedPid) {
    if (!this._combineSinkActive) return;

    logger.warn('pw-loopback exited unexpectedly, tearing down combine-sink', {
      exitedPid,
    });

    // Kill any remaining processes (the one that didn't exit)
    this._killCombineSinkProcs();
  }

  /**
   * Kill all combine-sink pw-loopback processes and reset state.
   * @private
   */
  _killCombineSinkProcs() {
    for (const proc of this._combineSinkProcs) {
      try {
        proc.kill();
      } catch (err) {
        // Process may have already exited
        logger.debug('Failed to kill pw-loopback process', {
          pid: proc.pid,
          error: err.message,
        });
      }
    }

    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];
  }

  // ── Ducking Engine ──

  /**
   * Load ducking rules from config. Replaces any existing rules and clears active state.
   * Rules define automatic volume reduction when audio sources (video, sound) are active.
   *
   * @param {Array<{when: string, duck: string, to: number, fadeMs: number}>} rules - Ducking rules
   *   - when: source stream that triggers ducking (e.g., 'video', 'sound')
   *   - duck: target stream to duck (e.g., 'spotify')
   *   - to: volume percentage to duck to (0-100)
   *   - fadeMs: fade duration in milliseconds (reserved for future use)
   */
  loadDuckingRules(rules) {
    this._duckingRules = [...rules];
    this._activeDuckingSources = {};
    this._preDuckVolumes = {};

    logger.info('Ducking rules loaded', { ruleCount: rules.length });
  }

  /**
   * Handle a ducking lifecycle event from a source stream.
   * Called when video/sound starts, completes, pauses, or resumes.
   *
   * @param {string} source - Source stream name (e.g., 'video', 'sound')
   * @param {'started'|'completed'|'paused'|'resumed'} lifecycle - Lifecycle event
   */
  handleDuckingEvent(source, lifecycle) {
    if (!this._duckingRules || this._duckingRules.length === 0) {
      return;
    }

    // Find rules matching this source
    const matchingRules = this._duckingRules.filter(r => r.when === source);
    if (matchingRules.length === 0) {
      return;
    }

    switch (lifecycle) {
      case 'started':
      case 'resumed':
        this._handleDuckingStart(source, matchingRules);
        break;
      case 'completed':
      case 'paused':
        this._handleDuckingStop(source, matchingRules);
        break;
      default:
        logger.warn('Unknown ducking lifecycle event', { source, lifecycle });
    }
  }

  /**
   * Handle ducking start (source started or resumed).
   * Stores pre-duck volume if not already stored, adds source to active list,
   * and sets target volume to lowest active "to" value.
   *
   * @param {string} source - Source stream name
   * @param {Array} matchingRules - Rules matching this source
   * @private
   */
  _handleDuckingStart(source, matchingRules) {
    // Group rules by target stream
    const targetStreams = new Set(matchingRules.map(r => r.duck));

    for (const target of targetStreams) {
      // Initialize active sources array for this target if needed
      if (!this._activeDuckingSources[target]) {
        this._activeDuckingSources[target] = [];
      }

      // Don't double-add the same source
      if (!this._activeDuckingSources[target].includes(source)) {
        this._activeDuckingSources[target].push(source);
      }

      // Store pre-duck volume before first duck (async, fire-and-forget)
      if (this._preDuckVolumes[target] === undefined) {
        this._capturePreDuckVolume(target);
      }

      // Calculate the lowest "to" value among all active sources for this target
      const effectiveVolume = this._calculateEffectiveVolume(target);

      // Apply the ducked volume
      this.setStreamVolume(target, effectiveVolume).catch(err => {
        logger.error('Failed to set ducked volume', {
          target, volume: effectiveVolume, error: err.message
        });
      });

      // Emit ducking:changed event
      this.emit('ducking:changed', {
        stream: target,
        ducked: true,
        volume: effectiveVolume,
        activeSources: [...this._activeDuckingSources[target]],
        restoredVolume: this._preDuckVolumes[target] !== undefined
          ? this._preDuckVolumes[target] : 100,
      });

      logger.info('Ducking applied', {
        source, target, volume: effectiveVolume,
        activeSources: this._activeDuckingSources[target],
      });
    }
  }

  /**
   * Handle ducking stop (source completed or paused).
   * Removes source from active list, re-evaluates volume, and restores if no sources remain.
   *
   * @param {string} source - Source stream name
   * @param {Array} matchingRules - Rules matching this source
   * @private
   */
  _handleDuckingStop(source, matchingRules) {
    const targetStreams = new Set(matchingRules.map(r => r.duck));

    for (const target of targetStreams) {
      if (!this._activeDuckingSources[target]) {
        return; // No active ducking for this target
      }

      // Remove this source from active list
      this._activeDuckingSources[target] = this._activeDuckingSources[target]
        .filter(s => s !== source);

      if (this._activeDuckingSources[target].length === 0) {
        // No more active sources — restore to pre-duck volume
        const restoreVolume = this._preDuckVolumes[target] !== undefined
          ? this._preDuckVolumes[target] : 100;

        this.setStreamVolume(target, restoreVolume).catch(err => {
          logger.error('Failed to restore volume after ducking', {
            target, volume: restoreVolume, error: err.message
          });
        });

        // Emit ducking:changed — no longer ducked
        this.emit('ducking:changed', {
          stream: target,
          ducked: false,
          volume: restoreVolume,
          activeSources: [],
          restoredVolume: restoreVolume,
        });

        // Clean up pre-duck volume
        delete this._preDuckVolumes[target];

        logger.info('Ducking restored', { source, target, volume: restoreVolume });
      } else {
        // Other sources still active — re-evaluate to new lowest
        const effectiveVolume = this._calculateEffectiveVolume(target);

        this.setStreamVolume(target, effectiveVolume).catch(err => {
          logger.error('Failed to re-evaluate ducked volume', {
            target, volume: effectiveVolume, error: err.message
          });
        });

        // Emit ducking:changed — still ducked but at different level
        this.emit('ducking:changed', {
          stream: target,
          ducked: true,
          volume: effectiveVolume,
          activeSources: [...this._activeDuckingSources[target]],
          restoredVolume: this._preDuckVolumes[target] !== undefined
            ? this._preDuckVolumes[target] : 100,
        });

        logger.info('Ducking re-evaluated', {
          source, target, volume: effectiveVolume,
          remainingSources: this._activeDuckingSources[target],
        });
      }
    }
  }

  /**
   * Calculate the effective ducked volume for a target stream.
   * Uses the lowest "to" value among all active ducking sources.
   *
   * @param {string} target - Target stream name
   * @returns {number} Lowest "to" volume among active sources
   * @private
   */
  _calculateEffectiveVolume(target) {
    const activeSources = this._activeDuckingSources[target] || [];

    let lowestVolume = Infinity;
    for (const rule of this._duckingRules) {
      if (rule.duck === target && activeSources.includes(rule.when)) {
        if (rule.to < lowestVolume) {
          lowestVolume = rule.to;
        }
      }
    }

    return lowestVolume === Infinity ? 100 : lowestVolume;
  }

  /**
   * Capture the pre-duck volume for a target stream asynchronously.
   * Only stores if not already captured (prevents overwriting during active ducking).
   *
   * @param {string} target - Target stream name
   * @private
   */
  _capturePreDuckVolume(target) {
    this.getStreamVolume(target)
      .then(volume => {
        // Only store if still not set (race condition guard)
        if (this._preDuckVolumes[target] === undefined) {
          this._preDuckVolumes[target] = volume !== null ? volume : 100;
        }
      })
      .catch(err => {
        // Default to 100 if we can't read current volume
        if (this._preDuckVolumes[target] === undefined) {
          this._preDuckVolumes[target] = 100;
        }
        logger.warn('Failed to capture pre-duck volume, defaulting to 100', {
          target, error: err.message
        });
      });
  }

  // ── Routing with Fallback ──

  /**
   * Apply routing for a stream with fallback support.
   * Tries primary sink from route config, falls back to fallback sink if specified.
   * @param {string} stream - Stream name
   * @returns {Promise<void>}
   */
  async applyRoutingWithFallback(stream) {
    this._validateStream(stream);

    const route = this.getStreamRoute(stream);
    const appName = STREAM_APP_NAMES[stream];

    // Find the sink-input for this stream
    const sinkInput = await this.findSinkInput(appName);
    if (!sinkInput || !sinkInput.index) {
      logger.warn('No active sink-input found for fallback routing', { stream });
      return;
    }

    // Get route config (may have fallback field)
    const routeConfig = this._routingData.routes[stream];
    const primarySink = routeConfig?.sink || route;
    const fallbackSink = routeConfig?.fallback;

    // Try primary sink first
    try {
      const availableSinks = await this.getAvailableSinks();
      const targetSink = this._resolveTargetSink(primarySink, availableSinks);

      if (!targetSink) {
        throw new Error(`Primary sink '${primarySink}' not available`);
      }

      await this.moveStreamToSink(sinkInput.index, targetSink.name);
      logger.info('Applied routing with primary sink', { stream, sink: targetSink.name });
      return;
    } catch (primaryErr) {
      logger.warn('Primary sink failed, trying fallback', {
        stream,
        primarySink,
        error: primaryErr.message,
      });

      // Try fallback if specified
      if (!fallbackSink) {
        throw new Error(`Primary sink failed and no fallback configured: ${primaryErr.message}`);
      }

      const availableSinks = await this.getAvailableSinks();
      const fallbackTarget = this._resolveTargetSink(fallbackSink, availableSinks);

      if (!fallbackTarget) {
        throw new Error(`Fallback sink '${fallbackSink}' not available`);
      }

      await this.moveStreamToSink(sinkInput.index, fallbackTarget.name);
      logger.info('Applied routing with fallback sink', {
        stream,
        fallbackSink: fallbackTarget.name,
      });

      this.emit('routing:fallback', {
        stream,
        requestedSink: primarySink,
        actualSink: fallbackTarget.name,
      });
    }
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
    let receivedData = false;
    this._monitorProc.stdout.on('data', (data) => {
      receivedData = true;
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const event = this._parsePactlEvent(line);
        if (!event) continue;

        if (event.action === 'new' && event.type === 'sink') {
          this.emit('sink:added', { id: event.id });
          this._onSinkAdded(event.id);
          this._onBtSinkChanged();
        } else if (event.action === 'remove' && event.type === 'sink') {
          this.emit('sink:removed', { id: event.id });
          this._onBtSinkChanged();
        }
      }
    });

    this._monitorProc.stderr.on('data', (data) => {
      logger.debug('pactl subscribe stderr', { data: data.toString() });
    });

    this._monitorProc.on('close', (code) => {
      this._monitorProc = null;

      if (receivedData) {
        // Was running successfully, reset failure count
        this._monitorFailures = 0;
        logger.info('Sink monitor exited normally, restarting', { exitCode: code });
      } else {
        // Failed immediately (PipeWire unavailable)
        this._monitorFailures++;
        if (this._monitorFailures >= MONITOR_MAX_FAILURES) {
          logger.error(`Sink monitor failed ${this._monitorFailures} times, giving up. Restart orchestrator to retry.`);
          return;
        }
        logger.warn('Sink monitor exited', { exitCode: code, failures: this._monitorFailures });
      }

      const delay = MONITOR_RESTART_DELAY * Math.pow(MONITOR_BACKOFF_MULTIPLIER, this._monitorFailures);
      this._monitorRestartTimer = setTimeout(() => {
        this._monitorRestartTimer = null;
        logger.info('Restarting sink monitor', { delay });
        this.startSinkMonitor();
      }, delay);
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

      const type = this.classifySink(name);

      sinks.push({
        id,
        name,
        driver,
        format,
        state,
        type,
        label: this._generateSinkLabel(name, type),
      });
    }

    return sinks;
  }

  /**
   * Generate a human-readable label for a sink based on its name and type.
   * @param {string} name - Raw sink name
   * @param {string} type - Sink type ('hdmi', 'bluetooth', 'combine', 'other')
   * @returns {string} Human-readable label
   * @private
   */
  _generateSinkLabel(name, type) {
    if (type === 'hdmi') {
      return 'HDMI';
    }

    if (type === 'bluetooth') {
      // Extract MAC address from bluez_output.XX_XX_XX_XX_XX_XX.1
      // Format: "BT Speaker (XX:XX)"
      const match = name.match(/bluez_output\.([0-9A-F_]+)(\.\d+)?$/);
      if (match && match[1]) {
        const macPart = match[1].replace(/_/g, ':');
        // Show first 2 and last 2 bytes for brevity? Or full? 
        // Let's just show the last 2 bytes for brevity if it's long, 
        // but user usually wants to identify specific speakers.
        // Let's use last 2 bytes: XX:XX
        const parts = macPart.split(':');
        if (parts.length >= 2) {
          return `BT Speaker (${parts.slice(-2).join(':')})`;
        }
        return `BT Speaker (${macPart})`;
      }
      return 'Bluetooth Speaker';
    }

    if (type === 'combine') {
      return 'All Bluetooth Speakers';
    }

    // Fallback: use usage-agnostic name if possible, or just the raw name
    return name;
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
   * Extract volume percentage for a specific sink-input from pactl output.
   * @param {string} output - Raw pactl list sink-inputs output
   * @param {string} sinkInputIdx - Sink-input index to find
   * @returns {number|null} Volume percentage or null
   * @private
   */
  _extractVolumeForSinkInput(output, sinkInputIdx) {
    if (!output || !output.trim()) {
      return null;
    }

    const lines = output.split('\n');
    let currentIdx = null;
    let inTargetInput = false;

    for (const line of lines) {
      // Match "Sink Input #NNN"
      const idxMatch = line.match(/^Sink Input #(\d+)/);
      if (idxMatch) {
        currentIdx = idxMatch[1];
        inTargetInput = currentIdx === sinkInputIdx;
      }

      // If we're in the target sink-input, look for volume
      if (inTargetInput) {
        // Match "Volume: front-left: 65536 / 100% / 0.00 dB,   front-right: 65536 / 100% / 0.00 dB"
        const volumeMatch = line.match(/Volume:.*?(\d+)%/);
        if (volumeMatch) {
          return parseInt(volumeMatch[1], 10);
        }
      }
    }

    return null;
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
