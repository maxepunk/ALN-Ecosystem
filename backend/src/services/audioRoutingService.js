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
 * Uses spawn for pw-loopback (combine-sink) and ProcessMonitor for pactl subscribe.
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const { execFileAsync } = require('../utils/execHelper');
const registry = require('./serviceHealthRegistry');
const ProcessMonitor = require('../utils/processMonitor');

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

/** How long to cache sink list (ms) — invalidated immediately on sink events */
const SINK_CACHE_TTL = 5000;

/** Debounce delay for BT sink change processing (ms) */
const BT_SINK_DEBOUNCE = 300;

class AudioRoutingService extends EventEmitter {
  constructor() {
    super();
    this._sinkMonitor = null;
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));

    // Sink list cache (reduces pactl calls — invalidated on sink events)
    this._sinkCache = null;
    this._sinkCacheTime = 0;
    this._btSinkDebounceTimer = null;

    // Combine-sink state
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];
    this._combineSinkModuleId = null;

    // Ducking engine state
    this._duckingRules = [];
    this._activeDuckingSources = {};  // { targetStream: ['video', 'sound'] }
    this._preDuckVolumes = {};        // { targetStream: originalVolume }

    // Sink-input registry: populated reactively from pactl subscribe events
    // Maps sink-input id (string) → { index, appName }
    this._sinkInputRegistry = new Map();
  }

  // ── Lifecycle ──

  /**
   * Initialize the audio routing service.
   * Loads persisted routing config and starts sink monitor.
   * @returns {Promise<void>}
   */
  async init() {
    // Kill stale pactl subscribe processes from previous instances that weren't
    // cleaned up (e.g., after SIGKILL from pm2 kill). Safe to call before our
    // own monitor starts since init() is called at startup.
    await this._killStaleMonitors();

    // Activate HDMI card profiles (handles boot-without-projector scenario)
    await this._activateHdmiCards();

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

    registry.report('audio', 'healthy', 'Audio routing initialized');
  }

  /**
   * On-demand health check. Probes pactl info and reports to registry.
   * @returns {Promise<boolean>} true if PipeWire/PulseAudio is reachable
   */
  async checkHealth() {
    try {
      await this._execFile('pactl', ['info']);
      registry.report('audio', 'healthy', 'PipeWire reachable');
      return true;
    } catch {
      registry.report('audio', 'down', 'PipeWire unreachable');
      return false;
    }
  }

  /**
   * Kill pactl subscribe process, prevent orphaned processes on shutdown.
   */
  cleanup() {
    if (this._sinkMonitor) {
      this._sinkMonitor.stop();
      this._sinkMonitor = null;
    }
    if (this._btSinkDebounceTimer) {
      clearTimeout(this._btSinkDebounceTimer);
      this._btSinkDebounceTimer = null;
    }
    this._invalidateSinkCache();

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
    this._sinkCache = null;
    this._sinkCacheTime = 0;
    this._combineSinkActive = false;
    this._combineSinkPids = [];
    this._combineSinkProcs = [];
    this._combineSinkModuleId = null;

    // Reset ducking engine state
    this._duckingRules = [];
    this._activeDuckingSources = {};
    this._preDuckVolumes = {};

    // Clear sink-input registry
    this._sinkInputRegistry.clear();

    registry.report('audio', 'down', 'Reset');
  }

  // ── Sink Discovery and Classification ──

  /**
   * Get all available PipeWire/PulseAudio sinks.
   * Runs `pactl list sinks short` and parses the tab-delimited output.
   * @returns {Promise<Array<{id: string, name: string, driver: string, format: string, state: string, type: string}>>}
   */
  async getAvailableSinks() {
    // Return cached result if still fresh (prevents redundant pactl calls
    // during cascading sink events — a single sink:added triggers 3-5 calls)
    const now = Date.now();
    if (this._sinkCache && (now - this._sinkCacheTime) < SINK_CACHE_TTL) {
      return this._sinkCache;
    }

    try {
      const stdout = await this._execFile('pactl', ['list', 'sinks', 'short']);
      this._sinkCache = this._parseSinkList(stdout);
      this._sinkCacheTime = now;
      return this._sinkCache;
    } catch (err) {
      logger.error('Failed to get available sinks', { error: err.message });
      return [];
    }
  }

  /**
   * Invalidate the sink list cache.
   * Called on sink:added/sink:removed events so the next getAvailableSinks()
   * fetches fresh data from PipeWire.
   * @private
   */
  _invalidateSinkCache() {
    this._sinkCache = null;
    this._sinkCacheTime = 0;
  }

  sinkExists(sinkName) {
    if (!this._sinkCache) return false;
    return this._sinkCache.some((s) => s.name === sinkName);
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
   * @param {string} stream - Stream name ('video', 'spotify', or 'sound')
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
   * Get current audio routing state snapshot (sync).
   * @returns {{routes: Object, defaultSink: string, combineSinkActive: boolean, ducking: Object, availableSinks: Array}}
   */
  getState() {
    const routes = {};
    for (const [stream, route] of Object.entries(this._routingData.routes)) {
      routes[stream] = typeof route === 'object' ? route.sink : route;
    }
    return {
      routes,
      defaultSink: this._routingData.defaultSink,
      combineSinkActive: this._combineSinkActive,
      ducking: { ...this._activeDuckingSources },
      availableSinks: this._buildAvailableSinksSnapshot(this._sinkCache || []),
    };
  }

  /**
   * Get full routing status for sync:full payloads.
   * @returns {Object} Full routing state
   */
  async getRoutingStatus() {
    // Normalize routes to flat strings (internal format is { sink: 'hdmi' })
    // so sync:full and routing:changed events use the same shape for the GM Scanner
    const routes = {};
    for (const [stream, route] of Object.entries(this._routingData.routes)) {
      routes[stream] = typeof route === 'object' ? route.sink : route;
    }
    return {
      routes,
      defaultSink: this._routingData.defaultSink,
      availableSinks: await this.getAvailableSinksWithCombine(),
    };
  }

  // ── Stream Routing ──

  /**
   * Apply routing for a stream: find the VLC sink-input and move it to the target sink.
   * Falls back to HDMI when the target sink is unavailable.
   * @param {string} stream - Stream name
   * @param {string} [sinkOverride] - Optional sink to use instead of the persisted route
   * @returns {Promise<void>}
   */
  async applyRouting(stream, sinkOverride) {
    this._validateStream(stream);

    const targetSinkType = sinkOverride || this.getStreamRoute(stream);
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
   * Fast path: checks the reactive registry first (populated by pactl subscribe events).
   * Fallback: polls `pactl list sink-inputs` when the registry hasn't caught up yet.
   * @param {string} appName - App name substring to match (e.g., 'VLC', 'spotifyd', 'pw-play')
   * @returns {Promise<{index: string}|null>} Sink-input object with index or null
   */
  async findSinkInput(appName) {
    // Fast path: check reactive registry (avoids pactl call on the common path)
    for (const [id, entry] of this._sinkInputRegistry) {
      if (entry.appName && entry.appName.toLowerCase().includes(appName.toLowerCase())) {
        return { index: id };
      }
    }

    // Fallback: poll pactl (registry might not have caught up yet for a brand-new process)
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

    // Single pactl call — find sink-input AND extract volume from same output
    // (previously called pactl list sink-inputs TWICE: once in findSinkInput, once here)
    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      const index = this._parseSinkInputs(stdout, appName);
      if (!index) return null;
      return this._extractVolumeForSinkInput(stdout, index);
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

    const allBtSinks = await this.getBluetoothSinks();
    const btSinks = allBtSinks.filter(s => this._isHighQualitySink(s));
    if (btSinks.length < allBtSinks.length) {
      const skipped = allBtSinks.filter(s => !this._isHighQualitySink(s));
      logger.warn('Skipping low-quality BT sinks (HFP/HSP) for combine-sink', {
        skipped: skipped.map(s => ({ name: s.name, format: s.format })),
      });
    }
    if (btSinks.length < 2) {
      throw new Error(
        `Need at least 2 Bluetooth speakers for combine-sink, found ${btSinks.length}`
      );
    }

    // 1. Create Null Sink (The Source)
    try {
      const stdout = await this._execFile('pactl', [
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

      proc.on('error', (err) => {
        logger.error('pw-loopback spawn error', { sink: sink.name, error: err.message });
        // NOTE: 'close' also fires after 'error' on ENOENT — _combineSinkActive guard
        // in _onCombineLoopbackExit prevents double teardown
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
        await this._execFile('pactl', ['unload-module', this._combineSinkModuleId]);
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
   * Build the GM-facing available sinks list from a raw sink array.
   * Filters internal sinks and adds virtual combine entry if active.
   * Used by both getState() (sync) and getAvailableSinksWithCombine() (async).
   * @param {Array} rawSinks - Raw sink list (from cache or fresh fetch)
   * @returns {Array} Filtered sink list for GM consumption
   * @private
   */
  _buildAvailableSinksSnapshot(rawSinks) {
    let sinks = rawSinks.filter(s =>
      s.name !== 'aln-combine' &&
      s.name !== 'combine-bt' &&
      s.name !== 'auto_null'
    );

    if (this._combineSinkActive) {
      sinks = [...sinks, {
        id: 'virtual-combine',
        name: 'aln-combine',
        driver: 'module-null-sink',
        format: '',
        state: 'RUNNING',
        type: 'combine',
        virtual: true,
        label: 'All Bluetooth Speakers',
      }];
    }

    return sinks;
  }

  /**
   * Get available sinks including the virtual combine-bt sink if active.
   * @returns {Promise<Array>} Array of sink objects (real + virtual)
   */
  async getAvailableSinksWithCombine() {
    const sinks = await this.getAvailableSinks();
    return this._buildAvailableSinksSnapshot(sinks);
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
   * Debounced version of _onBtSinkChanged.
   * Coalesces rapid sink events (e.g., BT speaker connect triggers multiple
   * PipeWire events) into a single processing cycle.
   * @private
   */
  _debouncedBtSinkChanged() {
    if (this._btSinkDebounceTimer) {
      clearTimeout(this._btSinkDebounceTimer);
    }
    this._btSinkDebounceTimer = setTimeout(() => {
      this._btSinkDebounceTimer = null;
      this._onBtSinkChanged();
    }, BT_SINK_DEBOUNCE);
  }

  /**
   * Handle unexpected exit of a pw-loopback process.
   * Tears down the entire combine-sink since it requires both loopbacks.
   * @param {number} exitedPid - PID of the exited process
   * @private
   */
  async _onCombineLoopbackExit(exitedPid) {
    if (!this._combineSinkActive) return;

    logger.warn('pw-loopback exited unexpectedly, tearing down combine-sink', {
      exitedPid,
    });

    // Kill any remaining processes (the one that didn't exit)
    this._killCombineSinkProcs();

    // Unload the null sink module (matches destroyCombineSink behavior)
    if (this._combineSinkModuleId) {
      try {
        await this._execFile('pactl', ['unload-module', this._combineSinkModuleId]);
        logger.info('Unloaded null sink after loopback exit', { moduleId: this._combineSinkModuleId });
      } catch (err) {
        logger.warn('Failed to unload null sink after loopback exit', {
          error: err.message, moduleId: this._combineSinkModuleId,
        });
      }
      this._combineSinkModuleId = null;
    }

    this.emit('combine-sink:destroyed');
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

  /**
   * Kill orphaned pactl subscribe and pw-loopback processes from previous server
   * instances. Called during init() before starting our own monitor.
   *
   * When PM2 sends SIGKILL (e.g., after `pm2 kill` or kill_timeout expiry),
   * child processes are re-parented to PID 1 and never cleaned up. Over multiple
   * restarts these accumulate and exhaust PipeWire's max-clients limit.
   * @private
   */
  async _killStaleMonitors() {
    for (const processName of ['pactl subscribe', 'pw-loopback']) {
      try {
        const stdout = await this._execFile('pgrep', ['-f', processName]);
        const pids = stdout.trim().split('\n').filter(Boolean);
        if (pids.length > 0) {
          logger.warn(`Killing ${pids.length} stale ${processName} process(es)`, { pids });
          await this._execFile('pkill', ['-f', processName]);
        }
      } catch {
        // pgrep exits 1 when no matches — expected when clean
      }
    }
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
   * Returns a promise so callers can await completion when ordering matters
   * (e.g., integration tests asserting on setStreamVolume calls).
   * Fire-and-forget callers in broadcasts.js should attach .catch() for safety.
   *
   * @param {string} source - Source stream name (e.g., 'video', 'sound')
   * @param {'started'|'completed'|'paused'|'resumed'} lifecycle - Lifecycle event
   * @returns {Promise<void>}
   */
  async handleDuckingEvent(source, lifecycle) {
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
        await this._handleDuckingStart(source, matchingRules);
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
   * Awaits pre-duck volume capture before applying duck to prevent a race
   * where the volume SET completes before the volume READ, causing the captured
   * pre-duck volume to be the already-ducked value.
   *
   * @param {string} source - Source stream name
   * @param {Array} matchingRules - Rules matching this source
   * @private
   */
  async _handleDuckingStart(source, matchingRules) {
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

      // Capture pre-duck volume BEFORE applying duck (was fire-and-forget — caused race
      // where volume SET could complete before volume READ, storing ducked value as pre-duck)
      if (this._preDuckVolumes[target] === undefined) {
        await this._capturePreDuckVolume(target);
      }

      // Guard: rules may have been cleared (loadDuckingRules called) while we awaited
      // volume capture — abort if the active sources array was reset
      if (!Array.isArray(this._activeDuckingSources[target])) {
        logger.debug('Ducking start aborted — rules were reset during volume capture', { source, target });
        continue;
      }

      // Calculate the lowest "to" value among all active sources for this target
      const effectiveVolume = this._calculateEffectiveVolume(target);

      // Apply the ducked volume
      this._setVolumeForDucking(target, effectiveVolume, 'apply');

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
        continue; // No active ducking for this target — check next
      }

      // Remove this source from active list
      this._activeDuckingSources[target] = this._activeDuckingSources[target]
        .filter(s => s !== source);

      if (this._activeDuckingSources[target].length === 0) {
        // No more active sources — restore to pre-duck volume
        const restoreVolume = this._preDuckVolumes[target] !== undefined
          ? this._preDuckVolumes[target] : 100;

        this._setVolumeForDucking(target, restoreVolume, 'restore');

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

        this._setVolumeForDucking(target, effectiveVolume, 're-evaluate');

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
   * Set stream volume with graceful handling for missing sink-inputs.
   * Shared by ducking start, restore, and re-evaluate paths.
   * @param {string} target - Target stream name
   * @param {number} volume - Volume to set
   * @param {string} context - Context label for logging (e.g., 'apply', 'restore', 're-evaluate')
   * @private
   */
  _setVolumeForDucking(target, volume, context) {
    this.setStreamVolume(target, volume).catch(err => {
      if (err.message.includes('No active sink-input')) {
        logger.warn(`Ducking ${context} skipped: sink-input not available`, { target, volume });
      } else {
        logger.error(`Failed to ${context} ducked volume`, { target, volume, error: err.message });
        this.emit('ducking:failed', { target, volume, context, error: err.message });
      }
    });
  }

  /**
   * Capture the pre-duck volume for a target stream asynchronously.
   * Only stores if not already captured (prevents overwriting during active ducking).
   *
   * @param {string} target - Target stream name
   * @private
   */
  _capturePreDuckVolume(target) {
    return this.getStreamVolume(target)
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
   * Uses ProcessMonitor for auto-restart with backoff and orphan prevention.
   */
  startSinkMonitor() {
    if (this._sinkMonitor) {
      return;
    }

    this._sinkMonitor = new ProcessMonitor({
      command: 'pactl',
      args: ['subscribe'],
      label: 'pactl-subscribe',
      pidFile: '/tmp/aln-pm-pactl-subscribe.pid',
    });

    this._sinkMonitor.on('line', (line) => {
      const event = this._parsePactlEvent(line);
      if (!event) return;

      if (event.action === 'new' && event.type === 'sink') {
        this._invalidateSinkCache();
        // Re-fetch sinks so getState() has fresh data when broadcast listeners fire
        this.getAvailableSinks().then(() => {
          this.emit('sink:added', { id: event.id });
          this._onSinkAdded(event.id);
          this._debouncedBtSinkChanged();
        }).catch(err => {
          logger.warn('Failed to refresh sinks after sink:added', { error: err.message });
          this.emit('sink:added', { id: event.id });
          this._debouncedBtSinkChanged();
        });
      } else if (event.action === 'remove' && event.type === 'sink') {
        this._invalidateSinkCache();
        this.getAvailableSinks().then(() => {
          this.emit('sink:removed', { id: event.id });
          this._debouncedBtSinkChanged();
        }).catch(err => {
          logger.warn('Failed to refresh sinks after sink:removed', { error: err.message });
          this.emit('sink:removed', { id: event.id });
          this._debouncedBtSinkChanged();
        });
      } else if ((event.action === 'new' || event.action === 'remove') && event.type === 'sink-input') {
        if (event.action === 'new') {
          this._identifySinkInput(event.id).catch(() => {});
        } else {
          this._sinkInputRegistry.delete(event.id);
        }
      } else if (event.action === 'change' && event.type === 'card') {
        // Card events — re-activate HDMI if card profile changed (e.g., projector hotplug)
        this._activateHdmiCards().catch(err => {
          logger.debug('Card change HDMI activation check failed', { error: err.message });
        });
      }
    });

    this._sinkMonitor.start();
  }

  /**
   * Identify a sink-input by its PulseAudio/PipeWire id and store it in the registry.
   * Runs `pactl list sink-inputs` once, parses the section for the given id, and
   * extracts application.name or application.process.binary.
   * Called on 'new' sink-input events from pactl subscribe.
   * @param {string} id - Sink-input id from pactl subscribe event
   * @returns {Promise<void>}
   * @private
   */
  async _identifySinkInput(id) {
    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      const sections = stdout.split(/Sink Input #/);
      for (const section of sections) {
        const idMatch = section.match(/^(\d+)/);
        if (idMatch && idMatch[1] === id) {
          const appMatch = section.match(/application\.name\s*=\s*"([^"]+)"/i) ||
                           section.match(/application\.process\.binary\s*=\s*"([^"]+)"/i);
          if (appMatch) {
            this._sinkInputRegistry.set(id, { index: id, appName: appMatch[1] });
          }
          break;
        }
      }
    } catch { /* non-fatal — registry just won't have this entry */ }
  }

  // ── Private helpers ──

  /**
   * Probe PipeWire cards and activate hdmi-stereo profile on any HDMI cards.
   * Called from init() and on card change events (HDMI hotplug).
   *
   * Pi 5 vc4-hdmi only supports IEC958_SUBFRAME_LE format — the ALSA
   * vc4-hdmi.conf conversion layer (PCM→IEC958) is used by the hdmi-stereo
   * ACP profile. The pro-audio profile bypasses this and fails.
   *
   * If HDMI isn't connected, hdmi-stereo won't exist and this fails
   * gracefully. On hotplug, PipeWire re-probes and the profile appears.
   * @private
   */
  async _activateHdmiCards() {
    try {
      const stdout = await this._execFile('pactl', ['list', 'cards', 'short']);
      if (!stdout.trim()) return;

      for (const line of stdout.trim().split('\n')) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;
        const cardName = parts[1];

        if (cardName.includes('hdmi')) {
          try {
            await this._execFile('pactl', ['set-card-profile', cardName, 'output:hdmi-stereo']);
            logger.info('Activated HDMI card profile', { cardName, profile: 'output:hdmi-stereo' });
          } catch (err) {
            logger.debug('Could not set hdmi-stereo profile (HDMI may not be connected)', {
              cardName, error: err.message,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to probe HDMI cards', { error: err.message });
    }
  }

  /**
   * Validate stream name against VALID_STREAMS.
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
   * Check if a BT sink supports high-quality audio (A2DP profile).
   * HFP/HSP sinks are mono 16kHz and produce garbled audio via pw-loopback.
   * Requires stereo (2+ channels) and sample rate >= 44100Hz.
   * @param {Object} sink - Sink object from _parseSinkList
   * @returns {boolean}
   * @private
   */
  _isHighQualitySink(sink) {
    if (!sink.format) return false;
    // Format example: "s16le 2ch 48000Hz"
    const chMatch = sink.format.match(/(\d+)ch/);
    const hzMatch = sink.format.match(/(\d+)Hz/);
    if (!chMatch || !hzMatch) return false;
    const channels = parseInt(chMatch[1], 10);
    const sampleRate = parseInt(hzMatch[1], 10);
    return channels >= 2 && sampleRate >= 44100;
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
        // Show last 2 bytes of MAC address for speaker identification
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
    const match = line.match(/^Event '(\w+)' on (sink|source|sink-input|source-output|card) #(\d+)$/);
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

      // Match application.name = "..." or application.process.binary = "..."
      // Fallback to process.binary handles spotifyd which sets application.name = ""
      const nameMatch = line.match(/application\.name\s*=\s*"([^"]+)"/);
      const binaryMatch = line.match(/application\.process\.binary\s*=\s*"([^"]+)"/);
      const match = nameMatch || binaryMatch;
      if (match && currentIdx) {
        if (match[1].includes(appName)) {
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
