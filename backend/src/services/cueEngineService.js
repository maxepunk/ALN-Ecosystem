'use strict';

/**
 * Cue Engine Service — Facade
 *
 * Public API and event-emission wrapper composing:
 *   - StandingEvaluator  (src/services/cue/standingEvaluator.js)
 *   - TimelineRuntime    (src/services/cue/timelineRuntime.js)
 *   - HeldItemsStore     (src/services/heldItemsStore.js)
 *
 * This module keeps its original public API and events unchanged.
 * Consumers: commandExecutor (circular dep — lazy requires), cueEngineWiring,
 * sessionService, broadcasts, syncHelpers.
 *
 * E5 (decision 2026-06-10): three-segment timeline model — see TimelineRuntime.
 * F-SHOW-08: video event correlation by tokenId — see TimelineRuntime.
 * F-SHOW-16: unified held store with try-all release-all — see HeldItemsStore.
 * F-SHOW-20: unified progress unit 0-1 — see TimelineRuntime.getActiveCues().
 *
 * Doc-drift D-8: cue:status internal event does NOT broadcast as a discrete
 * event. Both cue:started and cue:status are only pushServiceState('cueengine')
 * triggers in broadcasts.js.
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const { executeCommand, SERVICE_DEPENDENCIES } = require('./commandExecutor');
const registry = require('./serviceHealthRegistry');
const { doorWording } = require('./dormancyWording');
const HeldItemsStore = require('./heldItemsStore');
const TimelineRuntime = require('./cue/timelineRuntime');
const {
  EVENT_NORMALIZERS,
  CONDITION_OPS,
  parseClockTime,
  evaluateConditions,
  findMatchingEventCues,
  findMatchingClockCues,
  resetClockWarnings,
  toPersistence: standingToPersistence,
  fromPersistence: standingFromPersistence,
} = require('./cue/standingEvaluator');

// Re-export for backward-compat and testing (parseClockTime was exported from the class)
// Assigned below after class definition.

class CueEngineService extends EventEmitter {
  constructor() {
    super();
    this._timeline = new TimelineRuntime({ executeCommand });
    this._heldStore = new HeldItemsStore();
    this._reset();
  }

  _reset() {
    // A new/empty cue set: forget prior invalid-clock warn latches so a
    // fixed pack re-warns (S6 review, F5-state).
    resetClockWarnings();
    /** @type {Map<string, Object>} All loaded cues indexed by ID */
    this.cues = new Map();
    // Three disable PROVENANCES (Block 2 T1a, plan §3 pin P4). They are
    // separate sets, not one, because they answer different questions and
    // have different lifetimes: only a GM can undo the first, only a
    // re-arm the second, and only a profile change the third.
    /** @type {Set<string>} A GM disabled it by hand. Persisted. */
    this.disabledCues = new Set();
    /** @type {Set<string>} A once-cue that already fired. Persisted. */
    this.spentOnceCues = new Set();
    /**
     * @type {Set<string>} Every service it needs is dormant. RECOMPUTED at
     * boot / session create / system reset by dormancyService.applyDormancy,
     * and deliberately NEVER persisted — a profile edit must change it.
     */
    this.dormancyDisabledCues = new Set();
    /**
     * @type {Map<string, Array<{action: string, service: string, door: string}>>}
     * Per cue, the commands that WOULD run against a dormant service. A
     * mixed cue keeps running; this is what the GM sees on its tile.
     */
    this._dormantCommands = new Map();
    /** @type {boolean} Whether the engine is actively evaluating standing cues */
    this.active = false;
    /** @type {Set<string>} Clock cue IDs that have already fired (prevents re-fire) */
    this.firedClockCues = new Set();
    /** @type {number|undefined} Elapsed at restore time (E1 re-marking in loadCues) */
    this._restoredClockElapsed = undefined;

    // Clear timeline runtime state
    if (this._timeline) {
      this._timeline.clearAll();
    }

    // Clear held store
    if (this._heldStore) {
      this._heldStore.reset();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Proxy: activeCues (for tests/consumers that access directly)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Direct access to activeCues Map (used by tests and legacy consumers).
   * @returns {Map<string, Object>}
   */
  get activeCues() {
    return this._timeline.activeCues;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cue loading
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load cue definitions from an array.
   * Validates each cue and indexes by ID.
   *
   * @param {Array<Object>} cuesArray
   * @throws {Error} If a cue has both commands and timeline
   */
  loadCues(cuesArray) {
    if (this._timeline.activeCues.size > 0) {
      logger.warn(`[CueEngine] Stopping ${this._timeline.activeCues.size} active compound cue(s) before reloading`);
      for (const cueId of [...this._timeline.activeCues.keys()]) {
        this.stopCue(cueId);
      }
    }

    const newCues = new Map();

    for (const cue of cuesArray) {
      if (cue.commands && cue.timeline) {
        throw new Error(`Cue "${cue.id}": commands and timeline are mutually exclusive`);
      }
      // Slice 4 S2 hardening: the Map used to silently last-win on a
      // duplicate id, dropping a cue. The pack gate refuses duplicates
      // upstream; this defends venue files and injected fixtures.
      if (newCues.has(cue.id)) {
        throw new Error(`Cue "${cue.id}": duplicate cue id (cue ids must be unique)`);
      }

      newCues.set(cue.id, {
        ...cue,
        commands: cue.commands || [],
        conditions: cue.trigger?.conditions || cue.conditions || [],
        once: cue.once || false,
        quickFire: cue.quickFire || false,
        icon: cue.icon || null,
      });
    }

    this.cues = newCues;

    // Re-apply E1 mark-without-firing if restore() ran before cue
    // definitions were available (sessionService.init() precedes cue load)
    if (this._restoredClockElapsed !== undefined) {
      this._markPastClockCuesFired(this._restoredClockElapsed);
    }

    registry.report('cueengine', 'healthy', `Loaded ${newCues.size} cues`);
    logger.info(`[CueEngine] Loaded ${newCues.size} cues (${this.getStandingCues().length} standing)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State / summaries
  // ─────────────────────────────────────────────────────────────────────────

  getState() {
    return {
      cues: this.getCueSummaries(),
      activeCues: this.getActiveCues(),
      disabledCues: this.getDisabledCues(),
    };
  }

  getCues() {
    return Array.from(this.cues.values());
  }

  getStandingCues() {
    return this.getCues().filter(cue => cue.trigger);
  }

  /**
   * Is this cue disabled by ANY provenance (P4)? The one question every
   * caller should ask; the three sets are an implementation detail.
   * @param {string} cueId
   * @returns {boolean}
   */
  isCueDisabled(cueId) {
    return this.disabledCues.has(cueId)
      || this.spentOnceCues.has(cueId)
      || this.dormancyDisabledCues.has(cueId);
  }

  /**
   * Which provenance disabled this cue, or null. Precedence when several
   * apply: dormant (the venue's fact) beats gm (a person's choice) beats
   * once (a spent trigger) — most-structural first, so the GM reads the
   * reason they cannot change before the ones they can.
   * @param {string} cueId
   * @returns {'gm'|'once'|'dormant'|null}
   */
  disabledByOf(cueId) {
    if (this.dormancyDisabledCues.has(cueId)) return 'dormant';
    if (this.disabledCues.has(cueId)) return 'gm';
    if (this.spentOnceCues.has(cueId)) return 'once';
    return null;
  }

  /** The union of the three provenances, as a Set (evaluator input). */
  _disabledUnion() {
    return new Set([
      ...this.disabledCues,
      ...this.spentOnceCues,
      ...this.dormancyDisabledCues,
    ]);
  }

  getDisabledCues() {
    return Array.from(this._disabledUnion());
  }

  checkHealth() {
    const cues = this.getCues();
    registry.report('cueengine', 'healthy',
      cues.length > 0 ? `${cues.length} cues loaded` : 'No cues configured');
    return true;
  }

  getCueSummaries() {
    return this.getCues().map(cue => {
      let triggerType = null;
      if (cue.trigger) {
        if (cue.trigger.event) triggerType = 'event';
        else if (cue.trigger.clock) triggerType = 'clock';
      }

      return {
        id: cue.id,
        label: cue.label,
        icon: cue.icon,
        quickFire: cue.quickFire,
        once: cue.once,
        triggerType,
        enabled: !this.isCueDisabled(cue.id),
        // P4: WHY it is off, so the GM panel can grey a dormant cue
        // differently from one they switched off themselves.
        disabledBy: this.disabledByOf(cue.id),
        // P3: the mixed-cue badge — commands that will be skipped quietly
        // when this (still enabled) cue fires.
        dormantCommands: this._dormantCommands.get(cue.id) || [],
      };
    });
  }

  /**
   * Get all active compound cues with progress info.
   * F-SHOW-20: progress unit is 0-1.
   * @returns {Array<Object>}
   */
  getActiveCues() {
    return this._timeline.getActiveCues();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Held items (facade over HeldItemsStore)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all currently held cues.
   * @returns {Array<Object>}
   */
  getHeldCues() {
    return this._heldStore.getByType('cue');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cue enable/disable/activate/suspend
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Re-enable a cue a GM switched off, or re-arm a spent once-cue (R17).
   * REFUSES a dormancy-disabled cue: the GM cannot enable their way out of
   * equipment that is not in the room — the honest answer is the door's,
   * not a button that appears to work and then refuses at fire.
   * @param {string} cueId
   * @returns {{ok: boolean, reason?: string}}
   */
  enableCue(cueId) {
    if (this.dormancyDisabledCues.has(cueId)) {
      const reason = this._dormantRefusalReason(cueId);
      logger.info(`[CueEngine] Refused enable of dormancy-disabled cue: ${reason}`);
      return { ok: false, reason };
    }
    this.disabledCues.delete(cueId);
    this.spentOnceCues.delete(cueId);
    logger.info(`[CueEngine] Enabled cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'enabled' });
    return { ok: true };
  }

  disableCue(cueId) {
    this.disabledCues.add(cueId);
    logger.info(`[CueEngine] Disabled cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'disabled' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dormancy (Block 2 T1a D5, pin P3)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * The service a cue command depends on, or undefined. Object.hasOwn, not
   * a truthy index: cue actions are PACK CONTENT, and an action named
   * 'constructor' must not resolve a service off the prototype chain
   * (the C11 class this repo guards everywhere pack data indexes an object).
   * @param {string} action
   * @returns {string|undefined}
   * @private
   */
  static _serviceFor(action) {
    return Object.hasOwn(SERVICE_DEPENDENCIES, action)
      ? SERVICE_DEPENDENCIES[action]
      : undefined;
  }

  /**
   * Recompute which cues are silenced because every service they need is
   * dormant. Called by dormancyService at boot, at session create, and
   * after a system reset — never persisted, always derived.
   *
   * The rule (P3, refining D-C3.2):
   *   - a SIMPLE cue with at least one service-bearing command, ALL of whose
   *     service-bearing commands sit on dormant services → silenced;
   *   - a SIMPLE cue with only SOME on dormant services → still enabled, and
   *     the dormant ones are recorded so the panel can badge it and fireCue
   *     can skip them quietly;
   *   - a COMPOUND cue with ANY dormant timeline entry → silenced whole. A
   *     timeline is a shape in time; running half of one is worse than not
   *     running it (S2's reasoning, D-5).
   *   - a cue with NO service-bearing command at all is never touched.
   *
   * @param {{dormantServiceIds: string[], doorOf: Object<string,string>}} result
   */
  applyDormancy({ dormantServiceIds = [], doorOf = {} } = {}) {
    const dormant = new Set(dormantServiceIds);
    const previouslyDisabled = this.dormancyDisabledCues;
    const nextDisabled = new Set();
    const nextDormantCommands = new Map();

    for (const cue of this.cues.values()) {
      const entries = cue.timeline ? cue.timeline : (cue.commands || []);
      const serviceBearing = [];
      const dormantOnes = [];
      for (const entry of entries) {
        const service = CueEngineService._serviceFor(entry.action);
        if (!service) continue;                 // ungated command: not a dependency
        serviceBearing.push(service);
        if (dormant.has(service)) {
          dormantOnes.push({
            action: entry.action,
            service,
            door: doorOf[service] || 'profile',
          });
        }
      }

      if (dormantOnes.length > 0) {
        nextDormantCommands.set(cue.id, dormantOnes);
      }
      if (serviceBearing.length === 0) continue;

      const whollyDormant = cue.timeline
        ? dormantOnes.length > 0
        : dormantOnes.length === serviceBearing.length;
      if (whollyDormant) nextDisabled.add(cue.id);
    }

    const left = [...previouslyDisabled].filter((id) => !nextDisabled.has(id));

    this.dormancyDisabledCues = nextDisabled;
    this._dormantCommands = nextDormantCommands;

    if (left.length > 0 && this.active) {
      // A cue that comes BACK mid-session must not replay a clock threshold
      // that passed while it was silenced (catch-up storm), nor stay armed
      // to fire it ten minutes late. Same mark-don't-fire policy as restore.
      const elapsed = require('./gameClockService').getElapsed();
      this._markPastClockCuesFired(elapsed);
      logger.info(
        `[CueEngine] ${left.length} cue(s) left the dormancy set; ` +
        `past-due clock thresholds marked fired at ${elapsed}s`,
        { cues: left }
      );
    }

    logger.info(
      `[CueEngine] Dormancy applied: ${nextDisabled.size} cue(s) silenced, ` +
      `${nextDormantCommands.size} cue(s) with skipped commands`,
      { dormantServices: [...dormant] }
    );
    this.emit('cue:status', { cueId: null, state: 'dormancy-updated' });
  }

  /**
   * The one sentence a dormancy refusal says, built from the door.
   * @param {string} cueId
   * @returns {string}
   * @private
   */
  _dormantRefusalReason(cueId) {
    const [first] = this._dormantCommands.get(cueId) || [];
    if (!first) return `${cueId} is dormant`;
    return `${cueId} is ${doorWording(first.door)} (${first.service})`;
  }

  activate() {
    this.active = true;
    logger.info('[CueEngine] Activated');
  }

  suspend() {
    this.active = false;
    logger.info('[CueEngine] Suspended');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Standing cue evaluation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle a game event for standing cue evaluation.
   * @param {string} eventName
   * @param {Object} payload
   */
  handleGameEvent(eventName, payload) {
    if (!this.active) return;

    const matchingCues = findMatchingEventCues(this.cues, this._disabledUnion(), eventName, payload);

    for (const cue of matchingCues) {
      this.fireCue(cue.id, `event:${eventName}`).catch(err => {
        logger.error(`[CueEngine] Failed to fire cue "${cue.id}" from event "${eventName}":`, err.message);
      });
    }
  }

  /**
   * Fire all matching event-triggered standing cues and AWAIT completion.
   * Does NOT check this.active — pre-play hooks are playback UX.
   * @param {string} eventName
   * @param {Object} payload
   */
  async fireEventCuesAndWait(eventName, payload) {
    const matchingCues = findMatchingEventCues(this.cues, this._disabledUnion(), eventName, payload);

    for (const cue of matchingCues) {
      try {
        await this.fireCue(cue.id, `event:${eventName}`);
      } catch (err) {
        logger.error(`[CueEngine] fireEventCuesAndWait: cue "${cue.id}" failed:`, err.message);
      }
    }
  }

  /**
   * Handle a game clock tick for clock-triggered standing cues.
   * @param {number} elapsedSeconds
   */
  handleClockTick(elapsedSeconds) {
    if (!this.active) return;

    const clockCues = findMatchingClockCues(this.cues, this._disabledUnion(), this.firedClockCues, elapsedSeconds);

    for (const cue of clockCues) {
      this.firedClockCues.add(cue.id);
      this.fireCue(cue.id, `clock:${cue.trigger.clock}`).catch(err => {
        logger.error(`[CueEngine] Failed to fire clock cue "${cue.id}":`, err.message);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compound cue ticking (clock→timeline advancement)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Advance clock-driven compound cues. Called from gameclock:tick handler.
   * @param {number} elapsed - Current game clock elapsed (absolute)
   */
  _tickActiveCompoundCues(elapsed) {
    this._timeline.tickClock(
      elapsed,
      (cueId, activeCue, progress) => {
        // F-SHOW-20: progress 0-1
        this.emit('cue:status', {
          cueId,
          state: activeCue.state,
          progress,
          duration: activeCue.videoDuration || activeCue.maxAt,
        });
      },
      (cueId) => this.cues.get(cueId),
      (cueId, entry, err) => {
        this.emit('cue:error', {
          cueId,
          action: entry.action,
          position: entry.at,
          error: err.message,
        });
      }
    );

    // Check completions
    for (const cueId of [...this._timeline.activeCues.keys()]) {
      const result = this._timeline.checkCompletion(cueId);
      if (result.completed) {
        this.emit('cue:completed', {
          cueId,
          completedCommands: result.completedCommands,
          failedCommands: result.failedCommands,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Video progress / lifecycle (delegates to TimelineRuntime)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle video progress event.
   * E5 + F-SHOW-08: correlated by tokenId.
   * @param {Object} data - { position: 0-1, duration: seconds, tokenId?: string }
   */
  handleVideoProgressEvent(data) {
    this._timeline.handleVideoProgress(
      data,
      (cueId, activeCue, progress) => {
        // F-SHOW-20: progress 0-1
        this.emit('cue:status', {
          cueId,
          state: activeCue.state,
          progress,
          duration: activeCue.videoDuration || activeCue.maxAt,
        });
      },
      (cueId) => this.cues.get(cueId),
      (cueId, entry, err) => {
        this.emit('cue:error', {
          cueId,
          action: entry.action,
          position: entry.at,
          error: err.message,
        });
      }
    );
  }

  /**
   * Handle video lifecycle events (paused/resumed/completed).
   * E5 + F-SHOW-08.
   * @param {'paused'|'resumed'|'completed'} eventType
   * @param {Object} data
   */
  handleVideoLifecycleEvent(eventType, data) {
    const gameClockService = require('./gameClockService');
    const currentClockElapsed = gameClockService.getElapsed();

    const completedCues = this._timeline.handleVideoLifecycle(
      eventType,
      data,
      (cueId, activeCue, _progress) => {
        this.emit('cue:status', { cueId, state: activeCue.state });
      },
      (cueId) => this.cues.get(cueId),
      (cueId, entry, err) => {
        this.emit('cue:error', {
          cueId,
          action: entry?.action,
          position: entry?.at || null,
          error: err.message,
        });
      },
      currentClockElapsed
    );

    for (const { cueId, completedCommands, failedCommands } of completedCues) {
      this.emit('cue:completed', { cueId, completedCommands, failedCommands });
    }
  }

  /**
   * Direct video progress handler (used by tests that call handleVideoProgress directly).
   * Simulates VLC progress arriving for a specific cue by ID.
   * Sets video drive mode so E5 boundary guard allows post-boundary entries to fire.
   * @param {string} cueId
   * @param {number} position - seconds
   */
  handleVideoProgress(cueId, position) {
    const activeCue = this._timeline.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    // E5: transition from boundary to video-driven on first progress call
    if (!activeCue.videoStarted) {
      activeCue.videoStarted = true;
      activeCue.driveMode = 'video';
    }

    activeCue.elapsed = position;

    const videoDuration = activeCue.videoDuration || activeCue.maxAt;
    const progress = videoDuration > 0 ? Math.min(1, position / videoDuration) : 0;

    this.emit('cue:status', {
      cueId,
      state: activeCue.state,
      progress,
      duration: videoDuration,
    });

    this._timeline.fireEntries(cueId, position, this.cues.get(cueId), (entry, err) => {
      this.emit('cue:error', {
        cueId,
        action: entry.action,
        position: entry.at,
        error: err.message,
      });
    }).catch(err => {
      logger.error(`[CueEngine] Error advancing video-driven cue "${cueId}":`, err.message);
    });

    const result = this._timeline.checkCompletion(cueId);
    if (result.completed) {
      this.emit('cue:completed', {
        cueId,
        completedCommands: result.completedCommands,
        failedCommands: result.failedCommands,
      });
    }
  }

  /**
   * Handle video paused for a specific cue (legacy API for tests).
   * @param {string} cueId
   */
  handleVideoPaused(cueId) {
    const activeCue = this._timeline.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    activeCue.state = 'paused';
    logger.info(`[CueEngine] Video-driven cue paused: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'paused' });
  }

  /**
   * Handle video resumed for a specific cue (legacy API for tests).
   * @param {string} cueId
   */
  handleVideoResumed(cueId) {
    const activeCue = this._timeline.get(cueId);
    if (!activeCue || activeCue.state !== 'paused') return;

    activeCue.state = 'running';
    logger.info(`[CueEngine] Video-driven cue resumed: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'running' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cue firing
  // ─────────────────────────────────────────────────────────────────────────

  /** Maximum nesting depth */
  static MAX_NESTING_DEPTH = 5;

  /**
   * Fire a cue by ID.
   * @param {string} cueId
   * @param {string} [trigger]
   * @param {Set<string>} [parentChain]
   * @param {'gm'|'cue'} [source='cue'] - Who fired it (F-SHOW-15: manual GM
   *   fires carry source 'gm' per the asyncapi CueFired contract)
   */
  async fireCue(cueId, trigger, parentChain, source = 'cue') {
    const cue = this.cues.get(cueId);
    if (!cue) throw new Error(`Cue "${cueId}" not found`);

    // DORMANCY FIRST (P3), before every other gate including lighting-role
    // normalization inside executeCommand. A wholly dormant cue is REFUSED
    // outright: not held (a hold promises a later run and nothing is
    // coming), not cue:error (nothing is broken), just an info log. This is
    // alarm integrity at the cue level.
    if (this.dormancyDisabledCues.has(cueId)) {
      const reason = this._dormantRefusalReason(cueId);
      logger.info(`[CueEngine] Refusing dormant cue: ${reason}`);
      return { fired: false, held: false, reason };
    }

    if (this.disabledCues.has(cueId) || this.spentOnceCues.has(cueId)) {
      logger.info(`[CueEngine] Skipping disabled cue: ${cueId}`);
      return { fired: false, held: false, reason: `${cueId} is disabled` };
    }

    if (parentChain && parentChain.has(cueId)) {
      logger.warn(`[CueEngine] Cycle detected: "${cueId}" is already in chain [${[...parentChain].join(' → ')}]`);
      this.emit('cue:error', { cueId, action: null, position: null, error: `Cycle detected` });
      return { fired: false, held: false, reason: `Cycle detected` };
    }

    if (cue.timeline && this._timeline.has(cueId)) {
      logger.warn(`[CueEngine] Compound cue "${cueId}" already running, skipping re-fire`);
      this.emit('cue:error', { cueId, action: null, position: null, error: `Already running` });
      return { fired: false, held: false, reason: `Already running` };
    }

    if (parentChain && parentChain.size >= CueEngineService.MAX_NESTING_DEPTH) {
      logger.warn(`[CueEngine] Max nesting depth (${CueEngineService.MAX_NESTING_DEPTH}) reached for "${cueId}"`);
      this.emit('cue:error', {
        cueId,
        action: null,
        position: null,
        error: `Max nesting depth (${CueEngineService.MAX_NESTING_DEPTH}) exceeded`,
      });
      return {
        fired: false, held: false,
        reason: `Max nesting depth (${CueEngineService.MAX_NESTING_DEPTH}) exceeded`,
      };
    }

    // Service health check. A DORMANT dependency is skipped here, never
    // held: this cue is mixed (the wholly-dormant case returned above), and
    // its live half must still run.
    const cmds = cue.timeline ? cue.timeline : cue.commands;
    const blockedServices = [];
    for (const cmd of cmds) {
      const dep = CueEngineService._serviceFor(cmd.action);
      if (dep && registry.isDormant(dep)) continue;
      if (dep && !registry.isHealthy(dep) && !blockedServices.includes(dep)) {
        blockedServices.push(dep);
      }
    }
    if (blockedServices.length > 0) {
      const held = this._heldStore.holdItem({
        type: 'cue',
        cueId: cue.id,
        trigger: trigger || null,
        parentChain: parentChain || null,
        blockedBy: blockedServices,
        reason: 'service_down',
      });
      this.emit('cue:held', held);
      return {
        fired: false, held: true,
        reason: `${cueId} held: ${blockedServices.join(', ')}`,
      };
    }

    if (cue.timeline) {
      return this._startCompoundCue(cue, trigger, parentChain, source);
    }

    // Simple cue
    this.emit('cue:fired', { cueId, trigger: trigger || null, source });

    const completedCommands = [];
    const failedCommands = [];
    const dormantHere = new Set(
      (this._dormantCommands.get(cueId) || []).map((c) => c.action)
    );

    for (const cmd of cue.commands) {
      if (dormantHere.has(cmd.action)) {
        // Quietly, by design: no cue:error, no failedCommands entry. The
        // equipment is absent, not broken.
        logger.info(
          `[CueEngine] Skipping dormant command in cue "${cueId}": ${cmd.action}`
        );
        continue;
      }
      try {
        const result = await executeCommand({
          action: cmd.action,
          payload: cmd.payload || {},
          source: 'cue',
          trigger: `cue:${cueId}`,
        });
        // executeCommand catches its own throws and returns
        // {success:false} — a failed command must never count as
        // completed (slice 4 S3, D-4.4: an unresolvable lighting role
        // fails through the cue:error channel).
        if (result?.success === false) {
          logger.error(`[CueEngine] Command rejected in cue "${cueId}": ${cmd.action} — ${result.message}`);
          failedCommands.push({ action: cmd.action, error: result.message });
          this.emit('cue:error', { cueId, action: cmd.action, position: null, error: result.message });
          continue;
        }
        if (result?.data?.completion) await result.data.completion;
        completedCommands.push({ action: cmd.action });
      } catch (err) {
        logger.error(`[CueEngine] Command failed in cue "${cueId}": ${cmd.action}`, err.message);
        failedCommands.push({ action: cmd.action, error: err.message });
        this.emit('cue:error', { cueId, action: cmd.action, position: null, error: err.message });
      }
    }

    this.emit('cue:completed', { cueId, completedCommands, failedCommands });

    if (cue.once) {
      this._markOnceSpent(cueId);
    }

    return { fired: true, held: false };
  }

  /**
   * A once-cue has fired: park it in its OWN provenance set, not the GM's
   * (P4). Before T1a both landed in disabledCues, so a GM could not tell
   * "I turned this off" from "it already went".
   * @param {string} cueId
   * @private
   */
  _markOnceSpent(cueId) {
    this.spentOnceCues.add(cueId);
    logger.info(`[CueEngine] Auto-disabled once cue: ${cueId}`);
    this.emit('cue:status', { cueId, state: 'disabled' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compound cue start
  // ─────────────────────────────────────────────────────────────────────────

  async _startCompoundCue(cue, trigger, parentChain, source = 'cue') {
    const { id: cueId, timeline } = cue;

    const hasVideo = timeline.some(e =>
      e.action === 'video:play' || e.action === 'video:queue:add'
    );

    // Video conflict detection
    if (hasVideo) {
      const videoQueueService = require('./videoQueueService');
      if (videoQueueService.isPlaying()) {
        const currentVideo = videoQueueService.getCurrentVideo();
        logger.warn(`[CueEngine] Video conflict for cue "${cueId}": video already playing`);

        const held = this._heldStore.holdItem({
          type: 'cue',
          cueId,
          trigger: trigger || null,
          parentChain: parentChain || null,
          blockedBy: [],
          reason: 'video_busy',
          currentVideo,
        });

        this.emit('cue:held', held);

        // F-SHOW-16: timer keyed by heldId, not cueId
        this._heldStore.setAutoDiscard(held.id, () => {
          logger.info(`[CueEngine] Auto-discarded video_busy held cue: ${cueId}`);
          try {
            this.discardCue(held.id);
          } catch {
            // Already released or discarded
          }
        }, 10000);

        return { fired: false, held: true, reason: `${cueId} held: video_busy` };
      }
    }

    const gameClockService = require('./gameClockService');
    const startElapsed = gameClockService.getElapsed();

    const chain = new Set(parentChain || []);
    chain.add(cueId);

    let spawnedBy = null;
    if (parentChain && parentChain.size > 0) {
      const arr = [...parentChain];
      spawnedBy = arr[arr.length - 1];
    }

    const activeCue = this._timeline.createActiveCue({
      cue,
      startElapsed,
      parentChain: chain,
      spawnedBy,
    });

    // Register as child of parent
    if (spawnedBy && this._timeline.has(spawnedBy)) {
      this._timeline.get(spawnedBy).children.add(cueId);
    }

    this.emit('cue:fired', { cueId, trigger: trigger || null, source });
    this.emit('cue:started', { cueId, hasVideo, duration: activeCue.maxAt });

    logger.info(`[CueEngine] Started compound cue: ${cueId} (${timeline.length} entries, duration: ${activeCue.maxAt}s, video: ${hasVideo})`);

    // Fire at:0 entries immediately
    await this._timeline.fireEntries(cueId, 0, this.cues.get(cueId), (entry, err) => {
      this.emit('cue:error', {
        cueId,
        action: entry.action,
        position: entry.at,
        error: err.message,
      });
    });

    // Check completion (all entries at 0, maxAt=0)
    const result = this._timeline.checkCompletion(cueId);
    if (result.completed) {
      this.emit('cue:completed', {
        cueId,
        completedCommands: result.completedCommands,
        failedCommands: result.failedCommands,
      });
    }

    if (cue.once) {
      this._markOnceSpent(cueId);
    }

    return { fired: true, held: false };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stop / pause / resume (facade over TimelineRuntime)
  // ─────────────────────────────────────────────────────────────────────────

  async stopCue(cueId) {
    // Clear held store timer (video_busy conflicts)
    const heldByThisCue = this._heldStore.getByType('cue').filter(h => h.cueId === cueId);
    for (const h of heldByThisCue) {
      // Just clear the auto-discard timer, not the item
      this._heldStore._clearTimer(h.id);
    }

    const result = await this._timeline.stopCue(cueId);
    if (!result.wasActive) {
      logger.info(`[CueEngine] stopCue: "${cueId}" not active, ignoring`);
      return;
    }

    // Cascade stop to video
    if (result.hadVideoStarted) {
      try {
        const videoQueueService = require('./videoQueueService');
        await videoQueueService.skipCurrent();
        videoQueueService.clearQueue();
        logger.info(`[CueEngine] Cascaded stop to video for cue: ${cueId}`);
      } catch (err) {
        logger.error(`[CueEngine] Failed to cascade stop to video for cue: ${cueId}`, err.message);
      }
    }

    // Emit per stopped cue, children first (cascade order from the runtime)
    for (const stoppedId of result.stoppedIds || [cueId]) {
      this.emit('cue:status', { cueId: stoppedId, state: 'stopped' });
    }
  }

  async pauseCue(cueId) {
    const result = this._timeline.pauseCue(cueId);
    if (!result.paused) {
      logger.info(`[CueEngine] pauseCue: "${cueId}" not running, ignoring`);
      return;
    }

    this.emit('cue:status', { cueId, state: 'paused' });

    // Emit status for children
    const activeCue = this._timeline.get(cueId);
    if (activeCue) {
      for (const childId of activeCue.children) {
        this.emit('cue:status', { cueId: childId, state: 'paused' });
      }
    }

    // Cascade pause to video
    if (result.hadVideoStarted) {
      try {
        const videoQueueService = require('./videoQueueService');
        await videoQueueService.pauseCurrent();
      } catch (err) {
        logger.error(`[CueEngine] Failed to cascade pause to video for cue: ${cueId}`, err.message);
      }
    }
  }

  async resumeCue(cueId) {
    const result = this._timeline.resumeCue(cueId);
    if (!result.resumed) {
      logger.info(`[CueEngine] resumeCue: "${cueId}" not paused, ignoring`);
      return;
    }

    this.emit('cue:status', { cueId, state: 'running' });

    // Emit status for children
    const activeCue = this._timeline.get(cueId);
    if (activeCue) {
      for (const childId of activeCue.children) {
        this.emit('cue:status', { cueId: childId, state: 'running' });
      }
    }

    // Cascade resume to video
    if (result.hadVideoStarted) {
      try {
        const videoQueueService = require('./videoQueueService');
        await videoQueueService.resumeCurrent();
      } catch (err) {
        logger.error(`[CueEngine] Failed to cascade resume to video for cue: ${cueId}`, err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Held cue management (facade over HeldItemsStore)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Release a held cue and re-fire it.
   *
   * The re-fire can fail a SECOND time — the world moved on while the item
   * sat in the queue (a GM disabled the cue, another service fell over, the
   * profile now calls its equipment dormant). When it does, the item is
   * RE-HELD carrying the new reason rather than silently vanishing, and the
   * caller is told so it can ack honestly (T1a D5/D6).
   *
   * @param {string} heldId
   * @returns {Promise<{released: boolean, reason?: string}>}
   */
  async releaseCue(heldId) {
    const held = this._heldStore.find(heldId);
    if (!held) throw new Error(`Held cue not found: ${heldId}`);

    if (held.reason === 'video_busy') {
      const videoQueueService = require('./videoQueueService');
      await videoQueueService.skipCurrent();
    } else {
      const stillDown = (held.blockedBy || []).filter(
        svc => !registry.isHealthy(svc) && !registry.isDormant(svc)
      );
      if (stillDown.length > 0) {
        throw new Error(`Cannot release held cue: services still down: ${stillDown.join(', ')}`);
      }
    }

    const released = this._heldStore.release(heldId);
    this.emit('cue:released', { heldId: released.id, cueId: released.cueId });

    const outcome = await this.fireCue(
      released.cueId, released.trigger, released.parentChain || undefined
    );

    if (outcome && outcome.fired) return { released: true };

    const reason = (outcome && outcome.reason) || `${released.cueId} did not fire`;
    if (!outcome || !outcome.held) {
      // fireCue held it again itself (outcome.held) — do not double-hold.
      const reHeld = this._heldStore.holdItem({
        type: 'cue',
        cueId: released.cueId,
        trigger: released.trigger || null,
        parentChain: released.parentChain || null,
        blockedBy: held.blockedBy || [],
        reason,
      });
      this.emit('cue:held', reHeld);
    }
    logger.info(`[CueEngine] Re-held cue after a refused release: ${reason}`);
    return { released: false, reason };
  }

  /**
   * Discard a held cue.
   * @param {string} heldId
   */
  discardCue(heldId) {
    const discarded = this._heldStore.discard(heldId);
    this.emit('cue:discarded', { heldId: discarded.id, cueId: discarded.cueId });
    logger.info('[CueEngine] Cue discarded', { heldId: discarded.id, cueId: discarded.cueId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Condition evaluation (exposed for legacy consumers / tests)
  // ─────────────────────────────────────────────────────────────────────────

  evaluateConditions(conditions, context) {
    return evaluateConditions(conditions, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence (E1)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Serialize standing cue state for persistence (E1).
   * Stored in session.cueEngine beside gameClock.
   * @returns {Object}
   */
  toPersistence() {
    return standingToPersistence(
      this.firedClockCues, this.disabledCues, this.spentOnceCues, this.active
    );
  }

  /**
   * Restore standing cue state from persistence (E1).
   * Mark-without-firing policy: clock cues whose threshold is at-or-below
   * the restored elapsed time are marked fired WITHOUT firing them — a
   * restart must neither replay past cues (catch-up storm) nor leave
   * automation dead. Cue definitions may not be loaded yet
   * (sessionService.init() runs before app.js loads cues.json), so the
   * restored elapsed is remembered and the marking is re-applied by
   * loadCues().
   * @param {Object} snapshot
   * @param {number} [elapsedSeconds=0] - Restored game clock elapsed time
   */
  restore(snapshot, elapsedSeconds = 0) {
    if (!snapshot) return;
    const state = standingFromPersistence(snapshot);
    this.firedClockCues = state.firedClockCues;
    this.disabledCues = state.disabledCues;
    this.spentOnceCues = state.spentOnceCues;
    this.active = state.active;
    this._restoredClockElapsed = elapsedSeconds;
    this._markPastClockCuesFired(elapsedSeconds);
    logger.info('[CueEngine] Restored from persistence', {
      firedClockCues: this.firedClockCues.size,
      disabledCues: this.disabledCues.size,
      spentOnceCues: this.spentOnceCues.size,
      active: this.active,
      elapsedSeconds,
    });
  }

  /**
   * Mark all clock cues whose threshold has already passed as fired (E1).
   * Does NOT fire them — restore policy is mark-don't-fire.
   * @param {number} elapsedSeconds - Game clock elapsed time
   * @private
   */
  _markPastClockCuesFired(elapsedSeconds) {
    for (const cue of this.getStandingCues()) {
      if (!cue.trigger?.clock) continue;
      try {
        if (parseClockTime(cue.trigger.clock) <= elapsedSeconds) {
          this.firedClockCues.add(cue.id);
        }
      } catch (err) {
        logger.warn(`[CueEngine] Skipping clock cue with invalid time during restore: ${cue.id}`, err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Reset / cleanup
  // ─────────────────────────────────────────────────────────────────────────

  reset() {
    this._reset();
    registry.report('cueengine', 'down', 'Reset');
  }

  cleanup() {
    this.reset();
    this.removeAllListeners();
  }
}

// Backward-compat static export
CueEngineService.parseClockTime = parseClockTime;

// Re-export for tests
module.exports = new CueEngineService();
