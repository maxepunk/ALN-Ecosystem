/**
 * Audio Routing Service
 * Singleton EventEmitter managing a routing table that maps named audio
 * streams to PipeWire sinks. Uses pactl CLI for sink discovery, stream
 * routing, and sink monitoring.
 *
 * Supports video, music, and sound audio streams with configurable
 * routing between HDMI and Bluetooth sinks.
 *
 * Uses execFile (not exec) to prevent shell injection.
 * Uses ProcessMonitor for pactl subscribe.
 *
 * Composition root: wires DuckingEngine (ducking state machine) and
 * pactlClient (pure pactl parsers/exec) into the service facade.
 *
 * Split-seam refactor per reviewer blueprint:
 *   - pactlClient.js: pure pactl parsers + exec, no state
 *   - duckingEngine.js: ducking state machine, port-injected volume ops
 *   - audioRoutingService.js (this): routing table + persistence + sink cache
 *     + sink monitor + volume intent; wires DuckingEngine port to itself
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const registry = require('./serviceHealthRegistry');
const ProcessMonitor = require('../utils/processMonitor');
const pactlClient = require('./audio/pactlClient');
const DuckingEngine = require('./audio/duckingEngine');

/** Valid stream names */
const VALID_STREAMS = ['video', 'music', 'sound'];

/** Map stream names to application process names */
const STREAM_APP_NAMES = {
  video: 'VLC',
  music: 'aln-music',
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
  // Per-stream persisted volumes (0-100). Empty by default.
  // Populated by setStreamVolume() and applied reactively in _identifySinkInput().
  // Orchestrator-owned (we don't rely on WirePlumber's restore-stream for our streams).
  volumes: {},
};

/** Max retry time for findSinkInput (ms) */
const FIND_SINK_INPUT_MAX_WAIT = 2000;

/** Initial retry backoff for findSinkInput (ms) */
const FIND_SINK_INPUT_BACKOFF = 100;

/** How long to cache sink list (ms) — invalidated immediately on sink events */
const SINK_CACHE_TTL = 5000;

class AudioRoutingService extends EventEmitter {
  constructor() {
    super();
    this._sinkMonitor = null;
    this._routingData = JSON.parse(JSON.stringify(DEFAULT_ROUTING));

    // Sink list cache (reduces pactl calls — invalidated on sink events)
    this._sinkCache = null;
    this._sinkCacheTime = 0;

    // Sink-input registry: populated reactively from pactl subscribe events
    // Maps sink-input id (string) → { index, appName }
    this._sinkInputRegistry = new Map();

    // DuckingEngine — wired to this service via port interface.
    // Port provides the three volume operations the engine needs, keeping
    // the engine free of pactl/service knowledge.
    this._duckingEngine = new DuckingEngine({
      getVolume: stream => this.getStreamVolume(stream),
      setVolumeLive: (stream, volume) => this._setStreamVolumeLive(stream, volume),
      getUserVolume: stream => {
        const vol = this._routingData.volumes[stream];
        return (typeof vol === 'number') ? vol : null;
      },
    });

    // Wire DuckingEngine events back to this EventEmitter so consumers see
    // the same event shapes they did before the extraction.
    this._duckingEngine.setCallbacks(
      event => this.emit('ducking:changed', event),
      event => this.emit('ducking:failed', event)
    );
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

    // Verify WirePlumber config drop-in that disables restore-stream for VLC.
    // Non-fatal — warns loudly if missing (incident 2026-05-22 defense).
    await this._verifyWirePlumberRule();

    // Activate HDMI card profiles (handles boot-without-projector scenario)
    await this._activateHdmiCards();

    // Load persisted routing config
    const persisted = await persistenceService.load(PERSISTENCE_KEY);
    if (persisted && persisted.routes) {
      this._routingData = persisted;
      // Backward compat: legacy configs lack the volumes field. Add empty object
      // so callers can safely read this._routingData.volumes without optional chaining.
      if (!this._routingData.volumes) {
        this._routingData.volumes = {};
      }
      logger.info('Audio routing config restored from persistence', {
        routes: persisted.routes,
        volumes: this._routingData.volumes,
      });
    } else {
      logger.info('Audio routing using defaults', {
        routes: this._routingData.routes,
      });
    }

    // Start sink monitor
    this.startSinkMonitor();

    // Pre-populate sink cache so first getState() has data
    await this.getAvailableSinks().catch(err => {
      logger.warn('Failed to pre-populate sink cache', { error: err.message });
    });

    // Report health via a real probe (F-SHOW-23) — an unconditional 'healthy'
    // here let audio commands pass the SERVICE_DEPENDENCIES gate and fail
    // downstream for up to 15s (until revalidation) when PipeWire was down.
    await this.checkHealth();
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
    this._invalidateSinkCache();

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

    // Reset ducking engine state
    this._duckingEngine.reset();

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
    return this._sinkCache.some(s => s.name === sinkName);
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
   * @param {string} stream - Stream name ('video', 'music', or 'sound')
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
   * @returns {{routes: Object, defaultSink: string, ducking: Object, availableSinks: Array, volumes: Object}}
   */
  getState() {
    const routes = {};
    for (const [stream, route] of Object.entries(this._routingData.routes)) {
      routes[stream] = typeof route === 'object' ? route.sink : route;
    }
    return {
      routes,
      defaultSink: this._routingData.defaultSink,
      ducking: this._duckingEngine.getActiveState(),
      availableSinks: this._buildAvailableSinksSnapshot(this._sinkCache || []),
      volumes: { ...this._routingData.volumes },
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
      availableSinks: await this.getAvailableSinks(),
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
      throw new Error(`No available sink for stream '${stream}' (requested: ${targetSinkType})`);
    }

    const appName = STREAM_APP_NAMES[stream];
    const sinkInput = await this._findSinkInputWithRetry(appName);

    if (!sinkInput || !sinkInput.index) {
      logger.warn('No active sink-input found', { stream });
      return;
    }

    await this.moveStreamToSink(sinkInput.index, targetSink.name);

    this.emit('routing:applied', {
      stream,
      sink: targetSink.name,
      sinkType: targetSink.type,
      fellBack,
    });

    if (fellBack) {
      this.emit('routing:fallback', {
        stream,
        requestedSink: targetSinkType,
        actualSink: targetSink.name,
      });
    }

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
   * @param {string} appName - App name substring to match (e.g., 'VLC', 'aln-music', 'pw-play')
   * @returns {Promise<{index: string}|null>} Sink-input object with index or null
   */
  async findSinkInput(appName) {
    // Map the queried appName back to a canonical stream name (e.g., 'aln-music' → 'music')
    // so registry entries that resolved their stream during _identifySinkInput hit the fast
    // path even when application.name doesn't substring-match (the MPD case).
    let queriedStream = null;
    for (const [stream, configuredName] of Object.entries(STREAM_APP_NAMES)) {
      if (configuredName.toLowerCase() === appName.toLowerCase()) {
        queriedStream = stream;
        break;
      }
    }

    for (const [id, entry] of this._sinkInputRegistry) {
      // Fast path A: match by resolved stream (catches MPD)
      if (queriedStream && entry.stream === queriedStream) {
        return { index: id };
      }
      // Fast path B: appName substring (existing path, catches VLC/pw-play)
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
   * Apply a stream volume to the live pactl sink-input WITHOUT persisting.
   * Internal helper shared by setStreamVolume (user intent — also persists) and
   * the DuckingEngine port (transient duck/restore — no persistence).
   *
   * Persistence decoupling rationale: _routingData.volumes represents user intent
   * and is re-applied reactively when new sink-inputs spawn (see _identifySinkInput).
   * Ducking writes transient values — if those were persisted, an orchestrator
   * restart mid-duck (or session end mid-duck) would persist the ducked value as
   * user intent, and the next sink-input would come up ducked.
   *
   * @param {string} stream - Stream name (video, music, sound)
   * @param {number} volume - Volume percentage (0-100)
   * @returns {Promise<number>} The clamped volume actually applied
   * @private
   */
  async _setStreamVolumeLive(stream, volume) {
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

    // Set the live volume
    await this._execFile('pactl', ['set-sink-input-volume', sinkInput.index, `${clampedVolume}%`]);

    logger.info('Stream volume set', { stream, volume: clampedVolume, sinkInputIdx: sinkInput.index });

    return clampedVolume;
  }

  /**
   * Set volume for a named stream (user intent: live + persist).
   * Applies the volume via pactl AND persists it into _routingData.volumes so that
   * future sink-inputs for this stream come up at the user-chosen level (the
   * orchestrator re-applies reactively from _identifySinkInput; WirePlumber's
   * restore-stream is bypassed for our streams via a separate config drop-in).
   *
   * Decision E3: if this target is currently ducked, the new volume becomes the
   * restore target (refreshPreDuckCapture) so unducking restores to what the user
   * just set, not the stale pre-duck capture.
   *
   * For transient volume changes that should NOT be persisted (e.g., ducking),
   * use _setStreamVolumeLive directly.
   *
   * @param {string} stream - Stream name (video, music, sound)
   * @param {number} volume - Volume percentage (0-100)
   * @returns {Promise<void>}
   */
  async setStreamVolume(stream, volume) {
    const clampedVolume = await this._setStreamVolumeLive(stream, volume);

    this._routingData.volumes[stream] = clampedVolume;

    // Decision E3: a GM volume adjustment DURING an active duck refreshes the
    // captured restore target — the capture tracks current operator intent,
    // so the eventual restore lands on the GM's latest value, not a stale one.
    if (Array.isArray(this._activeDuckingSources[stream])
        && this._activeDuckingSources[stream].length > 0) {
      this._preDuckVolumes[stream] = clampedVolume;
    }

    await persistenceService.save(PERSISTENCE_KEY, this._routingData);

    // E3: if this stream is currently ducked, refresh the restore target so
    // unducking restores to the volume the user just set.
    this._duckingEngine.refreshPreDuckCapture(stream, clampedVolume);
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

  /**
   * Build the GM-facing available sinks list from a raw sink array.
   * Filters internal auto_null sink.
   * @param {Array} rawSinks - Raw sink list (from cache or fresh fetch)
   * @returns {Array} Filtered sink list for GM consumption
   * @private
   */
  _buildAvailableSinksSnapshot(rawSinks) {
    return rawSinks.filter(s => s.name !== 'auto_null');
  }

  /**
   * Kill orphaned pactl subscribe processes from previous server instances.
   * Called during init() before starting our own monitor.
   *
   * When PM2 sends SIGKILL (e.g., after `pm2 kill` or kill_timeout expiry),
   * child processes are re-parented to PID 1 and never cleaned up. Over multiple
   * restarts these accumulate and exhaust PipeWire's max-clients limit.
   * @private
   */
  async _killStaleMonitors() {
    try {
      const stdout = await this._execFile('pgrep', ['-f', 'pactl subscribe']);
      const pids = stdout.trim().split('\n').filter(Boolean);
      if (pids.length > 0) {
        logger.warn(`Killing ${pids.length} stale pactl subscribe process(es)`, { pids });
        await this._execFile('pkill', ['-f', 'pactl subscribe']);
      }
    } catch {
      // pgrep exits 1 when no matches — expected when clean
    }
  }

  /**
   * Verify the WirePlumber config drop-in that disables restore-stream for VLC.
   * Without this rule, WP persists VLC's mute/volume state and can silently
   * restore a stale muted state across orchestrator restarts (incident 2026-05-22).
   * Non-fatal — orchestrator continues with degraded protection if missing.
   * @private
   */
  async _verifyWirePlumberRule() {
    const rulePath = '/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua';
    try {
      await require('fs').promises.access(rulePath);
    } catch {
      logger.warn(
        'WirePlumber rule missing — VLC mute/volume state may persist across sessions. ' +
        'Without this rule, a stale muted state can silently break video audio after restart. ' +
        'Install procedure: see backend/CLAUDE.md "WirePlumber Configuration Dependency" or ' +
        'DEPLOYMENT_GUIDE.md Step 5.',
        { rulePath }
      );
    }
  }

  // ── Ducking Engine ──

  /**
   * Load ducking rules from config. Replaces any existing rules and clears active state.
   * Rules define automatic volume reduction when audio sources (video, sound) are active.
   *
   * B7 note: clears active duck state. A future venue hot-reload path should drain
   * (await all pending ops, restore any active ducks) before clearing rules. The
   * current clear-and-reset is safe for show-start reloads but would leave music
   * ducked if called mid-show.
   *
   * @param {Array<{when: string, duck: string, to: number, fadeMs: number}>} rules - Ducking rules
   *   - when: source stream that triggers ducking (e.g., 'video', 'sound')
   *   - duck: target stream to duck (e.g., 'music')
   *   - to: volume percentage to duck to (0-100)
   *   - fadeMs: fade duration in milliseconds (reserved for future use)
   */
  loadDuckingRules(rules) {
    this._duckingEngine.loadRules(rules);
    logger.info('Ducking rules loaded', { ruleCount: rules.length });
  }

  /**
   * Handle a ducking lifecycle event from a source stream.
   * Called when video/sound starts, completes, pauses, or resumes.
   * Returns a promise so callers can await completion when ordering matters
   * (e.g., integration tests asserting on _setStreamVolumeLive calls).
   * Fire-and-forget callers in broadcasts.js should attach .catch() for safety.
   *
   * @param {string} source - Source stream name (e.g., 'video', 'sound')
   * @param {'started'|'completed'|'paused'|'resumed'} lifecycle - Lifecycle event
   * @returns {Promise<void>}
   */
  handleDuckingEvent(source, lifecycle) {
    return this._duckingEngine.handleEvent(source, lifecycle);
  }

  // ── Compatibility shims for tests that read internal ducking state directly ──
  // The integration and unit tests inspect _activeDuckingSources and _preDuckVolumes
  // directly. These getters proxy to the DuckingEngine's state to keep tests green
  // without requiring test rewrites. New tests should use getState().ducking instead.

  get _activeDuckingSources() {
    return this._duckingEngine.getActiveState();
  }

  // Setter needed because integration tests inject state directly
  set _activeDuckingSources(value) {
    // Map the old format ({ target: [source, ...] }) to the new instance count format
    this._duckingEngine._instanceCounts = {};
    for (const [target, sources] of Object.entries(value || {})) {
      this._duckingEngine._instanceCounts[target] = {};
      for (const src of sources) {
        const prev = this._duckingEngine._instanceCounts[target][src] || 0;
        this._duckingEngine._instanceCounts[target][src] = prev + 1;
      }
    }
  }

  get _preDuckVolumes() {
    return this._duckingEngine._preDuckVolumes;
  }

  set _preDuckVolumes(value) {
    this._duckingEngine._preDuckVolumes = value;
  }

  get _duckingRules() {
    return this._duckingEngine._rules;
  }

  set _duckingRules(value) {
    this._duckingEngine._rules = value;
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

    this._sinkMonitor.on('line', line => {
      const event = this._parsePactlEvent(line);
      if (!event) return;

      if (event.action === 'new' && event.type === 'sink') {
        this._invalidateSinkCache();
        // Re-fetch sinks so getState() has fresh data when broadcast listeners fire
        this.getAvailableSinks().then(() => {
          this.emit('sink:added', { id: event.id });
          this._onSinkAdded(event.id);
        }).catch(err => {
          logger.warn('Failed to refresh sinks after sink:added', { error: err.message });
          this.emit('sink:added', { id: event.id });
        });
      } else if (event.action === 'remove' && event.type === 'sink') {
        this._invalidateSinkCache();
        this.getAvailableSinks().then(() => {
          this.emit('sink:removed', { id: event.id });
        }).catch(err => {
          logger.warn('Failed to refresh sinks after sink:removed', { error: err.message });
          this.emit('sink:removed', { id: event.id });
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
   * Resolve a stream name from any identity string seen on a sink-input
   * (application.name, application.process.binary, or media.name).
   * Substring match against STREAM_APP_NAMES values.
   * @param {string} identity - Identity string from pactl output
   * @returns {string|null} Stream name (video/music/sound) or null
   * @private
   */
  _streamForAppName(identity) {
    if (!identity) return null;
    const lower = identity.toLowerCase();
    for (const [stream, appName] of Object.entries(STREAM_APP_NAMES)) {
      if (lower.includes(appName.toLowerCase())) {
        return stream;
      }
    }
    return null;
  }

  /**
   * Identify a sink-input by its PulseAudio/PipeWire id and store it in the registry.
   * Runs `pactl list sink-inputs` once, parses the section for the given id, and
   * extracts application.name, application.process.binary, or media.name.
   * Called on 'new' sink-input events from pactl subscribe.
   *
   * F-SHOW-24: uses pactlClient.parseSinkInputById (unified parser) instead of
   * the inline section-parsing loop that previously duplicated _parseSinkInputs logic.
   *
   * Reactive volume application: after registration, looks up the persisted
   * volume for the resolved stream (if any) and applies it via pactl. This is
   * how the orchestrator owns per-stream volume across VLC/MPD restarts — the
   * persisted value in _routingData.volumes is the source of truth, not
   * WirePlumber's restore-stream.
   *
   * @param {string} id - Sink-input id from pactl subscribe event
   * @returns {Promise<void>}
   * @private
   */
  async _identifySinkInput(id) {
    let appName = null;
    let stream = null;
    try {
      const stdout = await this._execFile('pactl', ['list', 'sink-inputs']);
      const parsed = pactlClient.parseSinkInputById(stdout, id);

      if (parsed) {
        const { appName: name, binary, mediaName } = parsed;

        // Stream resolution must check ALL three identity sources — MPD sets
        // application.name = "Music Player Daemon" but our `name "aln-music"`
        // in MPD config lands in media.name and is the only unique signal.
        stream = this._streamForAppName(name)
              || this._streamForAppName(binary)
              || this._streamForAppName(mediaName);

        // First identity with content wins for registry storage.
        const firstIdentity = name || binary || mediaName;
        if (firstIdentity) {
          appName = firstIdentity;
          // Persist resolved stream alongside appName so findSinkInput's fast path
          // works for MPD (where application.name="Music Player Daemon" doesn't
          // substring-match 'aln-music').
          this._sinkInputRegistry.set(id, { index: id, appName, stream });
        }
      }
    } catch { /* non-fatal — registry just won't have this entry */ }

    // Reactive volume application: re-apply user's persisted volume if any.
    // Wrapped in its own try/catch so a failed pactl set doesn't undo the
    // registry registration we already did above.
    if (stream) {
      const persistedVolume = this._routingData.volumes[stream];
      if (typeof persistedVolume === 'number') {
        try {
          await this._execFile('pactl', ['set-sink-input-volume', id, `${persistedVolume}%`]);
          logger.info('Applied persisted volume to new sink-input', {
            stream, id, volume: persistedVolume, appName,
          });
        } catch (err) {
          logger.warn('Failed to apply persisted volume to new sink-input', {
            stream, id, volume: persistedVolume, error: err.message,
          });
        }
      }
    }
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
   * Delegates to pactlClient so this service doesn't import execHelper directly.
   * @param {string} cmd
   * @param {string[]} args
   * @returns {Promise<string>} stdout
   * @private
   */
  _execFile(cmd, args) {
    return pactlClient.execFile(cmd, args);
  }

  /**
   * Parse `pactl list sinks short` tab-delimited output.
   * Delegates to pactlClient.parseSinkList with injected classifier/labeler.
   * @param {string} output - Raw pactl output
   * @returns {Array<{id: string, name: string, driver: string, format: string, state: string, type: string}>}
   * @private
   */
  _parseSinkList(output) {
    return pactlClient.parseSinkList(
      output,
      name => this.classifySink(name),
      (name, type) => this._generateSinkLabel(name, type)
    );
  }

  /**
   * Generate a human-readable label for a sink based on its name and type.
   * @param {string} name - Raw sink name
   * @param {string} type - Sink type ('hdmi', 'bluetooth', 'other')
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

    // Fallback: use usage-agnostic name if possible, or just the raw name
    return name;
  }

  /**
   * Parse a `pactl subscribe` event line.
   * Delegates to pactlClient.parsePactlEvent.
   * @param {string} line - Single line from pactl subscribe
   * @returns {{action: string, type: string, id: string}|null}
   * @private
   */
  _parsePactlEvent(line) {
    return pactlClient.parsePactlEvent(line);
  }

  /**
   * Parse `pactl list sink-inputs` output to find a specific application's sink-input index.
   * Delegates to pactlClient.parseSinkInputsByAppName (F-SHOW-24 unified parser).
   * @param {string} output - Raw pactl output
   * @param {string} appName - Application name substring to search for
   * @returns {string|null} Sink-input index or null
   * @private
   */
  _parseSinkInputs(output, appName) {
    return pactlClient.parseSinkInputsByAppName(output, appName);
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
   * Delegates to pactlClient.extractVolumeForSinkInput.
   * @param {string} output - Raw pactl list sink-inputs output
   * @param {string} sinkInputIdx - Sink-input index to find
   * @returns {number|null} Volume percentage or null
   * @private
   */
  _extractVolumeForSinkInput(output, sinkInputIdx) {
    return pactlClient.extractVolumeForSinkInput(output, sinkInputIdx);
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
