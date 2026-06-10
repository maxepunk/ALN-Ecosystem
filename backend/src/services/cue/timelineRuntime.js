'use strict';

/**
 * Timeline Runtime
 *
 * Manages active compound cue timelines, drive modes, entry firing,
 * cascade stop/pause/resume, and routing resolution.
 *
 * Implements E5 (decision 2026-06-10): continuous-elapsed, three-segment model.
 *
 * Segments:
 *   1. Pre-video (clock-driven): entries before the video entry fire on game-clock time.
 *      If no video entry, the entire cue is clock-driven.
 *   2. Boundary pause: at the video entry, the clock PAUSES while VLC loads.
 *      Load time never consumes timeline. elapsed freezes.
 *   3. Video-driven: once video:progress arrives with the correct tokenId,
 *      elapsed = video position and entries fire at video position.
 *      F-SHOW-08: correlated by capturedVideoTokenId (captured at fire time),
 *      not broadcast to all hasVideo cues.
 *   4. Post-video (clock-driven resume): after video completion (natural OR skip),
 *      elapsed is set to the actual video end position and clock-driving resumes
 *      seamlessly. post-video entries fire relative to the real completion time.
 *
 * Constraint v1: one video entry per compound cue (validated at start).
 *
 * F-SHOW-20: unified progress unit 0-1 everywhere (getActiveCues and cue:status).
 */

const logger = require('../../utils/logger');

/**
 * @typedef {Object} ActiveCue
 * @property {string} cueId
 * @property {'running'|'paused'|'stopped'} state
 * @property {number} startTime - Date.now() at start
 * @property {number} elapsed - Current cue-relative elapsed seconds (continuous across segments)
 * @property {number} startElapsed - Game clock time at cue start (for pre-video/post-video clock math)
 * @property {number} clockAnchorElapsed - Game clock time used to anchor post-video resume
 * @property {number} elapsedAtClockAnchor - Cue-elapsed at the post-video anchor point
 * @property {Array<Object>} timeline
 * @property {number} maxAt - Max timeline at value
 * @property {number} videoEntryIndex - Index of the video entry in timeline (-1 if none)
 * @property {number|null} videoEntryAt - `at` value of the video entry (null if none)
 * @property {boolean} hasVideo - Whether cue has a video entry
 * @property {'pre-video'|'boundary'|'video'|'post-video'|'clock'} driveMode
 * @property {boolean} videoStarted
 * @property {number} videoDuration
 * @property {string|null} capturedVideoTokenId - tokenId from video entry payload (F-SHOW-08)
 * @property {Set<number>} firedEntries - Set of fired entry indices
 * @property {Array<Object>} completedCommands
 * @property {Array<Object>} failedCommands
 * @property {string|null} spawnedBy
 * @property {Set<string>} children
 * @property {Set<string>} parentChain
 */

class TimelineRuntime {
  constructor({ executeCommand }) {
    /**
     * Running compound cues indexed by cue ID.
     * @type {Map<string, ActiveCue>}
     */
    this.activeCues = new Map();

    /**
     * Injected executeCommand function (avoids circular dependency at module level).
     * @type {function}
     */
    this._executeCommand = executeCommand;
  }

  /**
   * Create and register an active cue entry.
   * Validates video-entry count (constraint v1).
   *
   * @param {Object} params
   * @param {Object} params.cue - Cue definition
   * @param {number} params.startElapsed - Game clock at start
   * @param {Set<string>} params.parentChain - Parent chain
   * @param {string|null} params.spawnedBy - Parent cue ID
   * @returns {ActiveCue}
   */
  createActiveCue({ cue, startElapsed, parentChain, spawnedBy }) {
    const { id: cueId, timeline } = cue;

    // Find the video entry (constraint v1: warn if more than one)
    const videoIndices = [];
    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.action === 'video:play' || entry.action === 'video:queue:add') {
        videoIndices.push(i);
      }
    }

    if (videoIndices.length > 1) {
      logger.warn(`[TimelineRuntime] Compound cue "${cueId}" has ${videoIndices.length} video entries (constraint v1: only one supported)`, {
        cueId,
        videoEntries: videoIndices.map(i => ({ index: i, at: timeline[i].at })),
      });
    }

    const hasVideo = videoIndices.length > 0;
    const videoEntryIndex = hasVideo ? videoIndices[0] : -1;
    const videoEntryAt = hasVideo ? timeline[videoEntryIndex].at : null;

    // Compute max timeline position (duration)
    const maxAt = Math.max(...timeline.map(e => e.at), 0);

    const activeCue = {
      cueId,
      state: 'running',
      startTime: Date.now(),
      elapsed: 0,
      startElapsed,            // Game clock time when cue started (for pre/post-video)
      clockAnchorElapsed: startElapsed, // Updated when transitioning back to clock mode
      elapsedAtClockAnchor: 0,          // Cue elapsed at the last clock anchor
      timeline,
      maxAt,
      videoEntryIndex,
      videoEntryAt,
      hasVideo,
      driveMode: hasVideo ? 'pre-video' : 'clock',
      videoStarted: false,
      videoDuration: 0,
      capturedVideoTokenId: null,  // F-SHOW-08: set when video entry fires
      firedEntries: new Set(),
      completedCommands: [],
      failedCommands: [],
      spawnedBy: spawnedBy || null,
      children: new Set(),
      parentChain: parentChain || new Set(),
    };

    this.activeCues.set(cueId, activeCue);
    return activeCue;
  }

  /**
   * Get an active cue by ID.
   * @param {string} cueId
   * @returns {ActiveCue|undefined}
   */
  get(cueId) {
    return this.activeCues.get(cueId);
  }

  /**
   * Remove an active cue by ID.
   * @param {string} cueId
   */
  delete(cueId) {
    this.activeCues.delete(cueId);
  }

  /**
   * Check if a cue is active.
   * @param {string} cueId
   * @returns {boolean}
   */
  has(cueId) {
    return this.activeCues.has(cueId);
  }

  /**
   * Get all active cues as an array of status summaries for the wire.
   * F-SHOW-20: progress unit is 0-1.
   *
   * @returns {Array<{cueId: string, state: string, progress: number, duration: number}>}
   */
  getActiveCues() {
    const result = [];
    for (const [cueId, activeCue] of this.activeCues) {
      const effectiveDuration = activeCue.videoDuration || activeCue.maxAt;
      result.push({
        cueId,
        state: activeCue.state,
        progress: effectiveDuration > 0 ? Math.min(1, activeCue.elapsed / effectiveDuration) : 0,
        duration: effectiveDuration,
      });
    }
    return result;
  }

  /**
   * Clear all active cues (for reset).
   */
  clearAll() {
    this.activeCues.clear();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entry firing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fire all unfired timeline entries at or before the given elapsed time.
   * Marks entries as fired BEFORE executing (prevents double-fire).
   *
   * @param {string} cueId
   * @param {number} elapsed - Current elapsed time in seconds (cue-relative)
   * @param {Object} cueDef - Cue definition (for routing resolution)
   * @param {function} onError - Called with (entry, err) for each failed command
   * @returns {Promise<void>}
   */
  async fireEntries(cueId, elapsed, cueDef, onError) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return;

    const { timeline, firedEntries, parentChain } = activeCue;

    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.at > elapsed) continue;
      if (firedEntries.has(i)) continue;

      // E5: Do not fire video-relative entries via clock before video starts.
      // An entry is "video-relative" if it comes after the video entry in the timeline.
      // (videoEntryIndex = -1 means no video, all entries are clock-relative)
      if (activeCue.hasVideo &&
          activeCue.driveMode !== 'video' &&
          activeCue.driveMode !== 'post-video' &&
          activeCue.videoEntryAt !== null &&
          entry.at > activeCue.videoEntryAt) {
        // This entry is after the video boundary — skip until video drive mode
        continue;
      }

      // Mark as fired BEFORE executing (prevents double-fire on concurrent calls)
      firedEntries.add(i);

      // When the video entry fires, capture the tokenId (F-SHOW-08)
      if (i === activeCue.videoEntryIndex) {
        const tokenId = entry.payload?.tokenId || null;
        activeCue.capturedVideoTokenId = tokenId;
        // Transition to boundary pause: wait for video:progress
        activeCue.driveMode = 'boundary';
        logger.info(`[TimelineRuntime] Video entry fired, entering boundary pause: ${cueId}`, { tokenId });
      }

      const resolvedPayload = this._resolveRouting(entry.action, entry.payload || {}, cueDef);

      try {
        const result = await this._executeCommand({
          action: entry.action,
          payload: resolvedPayload,
          source: 'cue',
          trigger: `cue:${cueId}`,
        });
        if (result?.data?.completion) await result.data.completion;
        activeCue.completedCommands.push({ action: entry.action, position: entry.at });
      } catch (err) {
        logger.error(`[TimelineRuntime] Command failed in "${cueId}" at ${entry.at}s: ${entry.action}`, err.message);
        activeCue.failedCommands.push({ action: entry.action, position: entry.at, error: err.message });
        if (onError) onError(entry, err);
      }
    }
  }

  /**
   * Advance clock-driven compound cues.
   * Called from gameclock:tick handler.
   *
   * Segments handled:
   *   - 'clock': pure clock-driven (no video)
   *   - 'pre-video': clock-driven up to the video boundary (entries after videoEntryAt skipped)
   *   - 'boundary': timer FROZEN — video is loading, do not advance elapsed
   *   - 'post-video': clock-driven from elapsedAtClockAnchor + (clockElapsed - clockAnchorElapsed)
   *
   * @param {number} clockElapsed - Current game clock elapsed (absolute)
   * @param {function(string, number, Object): void} onStatus - Status emission callback
   * @param {function(string): Object} getCueDef - Get cue definition by ID
   * @param {function(string, Object): void} onError - Error callback
   */
  tickClock(clockElapsed, onStatus, getCueDef, onError) {
    for (const [cueId, activeCue] of this.activeCues) {
      if (activeCue.state !== 'running') continue;

      const mode = activeCue.driveMode;

      if (mode === 'video') continue; // Video-driven: handled by handleVideoProgress

      if (mode === 'boundary') {
        // Boundary pause: timeline paused while VLC loads — do not advance elapsed
        // Still emit progress at the frozen value
        const effectiveDuration = activeCue.videoDuration || activeCue.maxAt;
        const progress = effectiveDuration > 0
          ? Math.min(1, activeCue.elapsed / effectiveDuration) : 0;
        onStatus(cueId, activeCue, progress);
        continue;
      }

      // 'clock' or 'pre-video' or 'post-video'
      let relativeElapsed;
      if (mode === 'post-video') {
        // Continuous clock-relative: resume from where video ended
        relativeElapsed = activeCue.elapsedAtClockAnchor +
          (clockElapsed - activeCue.clockAnchorElapsed);
      } else {
        // 'clock' or 'pre-video': standard relative
        relativeElapsed = clockElapsed - activeCue.startElapsed;
      }

      activeCue.elapsed = relativeElapsed;

      const effectiveDuration = activeCue.videoDuration || activeCue.maxAt;
      const progress = effectiveDuration > 0
        ? Math.min(1, relativeElapsed / effectiveDuration) : 0;
      onStatus(cueId, activeCue, progress);

      // Fire entries
      this.fireEntries(cueId, relativeElapsed, getCueDef(cueId), (entry, err) => {
        if (onError) onError(cueId, entry, err);
      }).catch(err => {
        logger.error(`[TimelineRuntime] Error ticking compound cue "${cueId}":`, err.message);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Video progress / lifecycle (E5 + F-SHOW-08)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handle video:progress event.
   * F-SHOW-08: Only advance cues whose capturedVideoTokenId matches.
   *
   * @param {Object} data - { position: 0-1 ratio, duration: seconds, tokenId?: string }
   * @param {function(string, Object, number): void} onStatus
   * @param {function(string): Object} getCueDef
   * @param {function(string, Object): void} onError
   */
  handleVideoProgress(data, onStatus, getCueDef, onError) {
    const { position, duration, tokenId: eventTokenId } = data;
    if (position === undefined) return;

    const positionSeconds = (duration && duration > 0) ? position * duration : position;

    for (const [cueId, activeCue] of this.activeCues) {
      if (!activeCue.hasVideo) continue;

      // F-SHOW-08: skip if tokenId doesn't match the captured video tokenId
      if (activeCue.driveMode === 'boundary' || activeCue.driveMode === 'video') {
        // capturedVideoTokenId was set when the video entry fired
        if (activeCue.capturedVideoTokenId !== null &&
            eventTokenId !== undefined &&
            eventTokenId !== activeCue.capturedVideoTokenId) {
          // Unrelated video — skip
          continue;
        }
      } else {
        // Not yet in video mode — only accept if boundary
        if (activeCue.driveMode !== 'boundary') continue;
      }

      if (activeCue.state !== 'running') continue;

      if (!activeCue.videoStarted) {
        // Transition from boundary → video-driven
        activeCue.videoStarted = true;
        activeCue.driveMode = 'video';
        logger.info(`[TimelineRuntime] Video progress received, switching to video-driven: ${cueId}`);
      }

      // Store video duration (first value wins — VLC may correct it slightly)
      if (duration > 0 && !activeCue.videoDuration) {
        activeCue.videoDuration = duration;
      }

      activeCue.elapsed = positionSeconds;

      const effectiveDuration = activeCue.videoDuration || activeCue.maxAt;
      const progress = effectiveDuration > 0
        ? Math.min(1, positionSeconds / effectiveDuration) : 0;
      onStatus(cueId, activeCue, progress);

      this.fireEntries(cueId, positionSeconds, getCueDef(cueId), (entry, err) => {
        if (onError) onError(cueId, entry, err);
      }).catch(err => {
        logger.error(`[TimelineRuntime] Error advancing video-driven cue "${cueId}":`, err.message);
      });
    }
  }

  /**
   * Handle video lifecycle events (paused/resumed/completed).
   * F-SHOW-08: Only affect cues whose capturedVideoTokenId matches the event.
   *
   * @param {'paused'|'resumed'|'completed'} eventType
   * @param {Object} data - { tokenId?: string, position?: number, skipped?: boolean }
   * @param {function(string, Object, number): void} onStatus
   * @param {function(string): Object} getCueDef
   * @param {function(string, Object): void} onError
   * @param {number} currentClockElapsed - Current game clock elapsed for post-video anchoring
   * @returns {Array<{cueId: string, completedCommands: Array, failedCommands: Array}>} Completed cue records
   */
  handleVideoLifecycle(eventType, data, onStatus, getCueDef, onError, currentClockElapsed) {
    const eventTokenId = data?.tokenId;
    const completedCues = [];

    for (const [cueId, activeCue] of this.activeCues) {
      if (!activeCue.hasVideo) continue;

      // F-SHOW-08: correlation check — skip cues that haven't started their video
      if (eventType === 'paused' || eventType === 'resumed') {
        // Guard: only affect cues that are in video drive mode
        if (!activeCue.videoStarted) continue;
        if (activeCue.driveMode !== 'video') continue;

        // F-SHOW-08: tokenId correlation
        if (activeCue.capturedVideoTokenId !== null &&
            eventTokenId !== undefined &&
            eventTokenId !== activeCue.capturedVideoTokenId) {
          continue;
        }
      }

      if (eventType === 'paused') {
        if (activeCue.state !== 'running') continue;
        activeCue.state = 'paused';
        logger.info(`[TimelineRuntime] Video-driven cue paused: ${cueId}`);
        onStatus(cueId, activeCue, null);

      } else if (eventType === 'resumed') {
        if (activeCue.state !== 'paused') continue;
        activeCue.state = 'running';
        logger.info(`[TimelineRuntime] Video-driven cue resumed: ${cueId}`);
        onStatus(cueId, activeCue, null);

      } else if (eventType === 'completed') {
        // Guard: ignore video:completed from unrelated videos (F-SHOW-08)
        if (!activeCue.videoStarted) continue;
        if (activeCue.driveMode !== 'video') continue;

        if (activeCue.capturedVideoTokenId !== null &&
            eventTokenId !== undefined &&
            eventTokenId !== activeCue.capturedVideoTokenId) {
          continue;
        }

        // E5: post-video segment — check if there are post-video entries
        const hasPostVideoEntries = activeCue.timeline.some((e, idx) => {
          if (firedEntryIndex => firedEntryIndex === idx) return false; // already fired
          return e.at > (activeCue.videoEntryAt || 0) && !activeCue.firedEntries.has(idx);
        });

        // Determine actual elapsed at video end.
        // E5: "clock-driven resumes from actual video end time"
        let videoEndElapsed;
        if (data?.skipped && data.position !== undefined) {
          // Skip: actual position at skip time (provided by the event)
          videoEndElapsed = data.position;
        } else if (activeCue.videoDuration > 0) {
          // Natural end: use the known video duration as the authoritative end position.
          // The last progress event may not have been at exactly 100% (VLC often fires
          // video:completed slightly before or after the last position event), so use
          // videoDuration as the canonical end time.
          videoEndElapsed = activeCue.videoDuration;
        } else {
          // Fallback: no duration known — use last-known elapsed
          videoEndElapsed = activeCue.elapsed;
        }

        // Check for post-video entries: entries with at > videoEntryAt that are not fired yet
        const pendingPostVideoEntries = activeCue.timeline.some((e, idx) =>
          e.at > (activeCue.videoEntryAt || 0) && !activeCue.firedEntries.has(idx)
        );

        if (pendingPostVideoEntries) {
          // E5: transition to post-video clock mode
          activeCue.driveMode = 'post-video';
          activeCue.elapsed = videoEndElapsed;
          activeCue.elapsedAtClockAnchor = videoEndElapsed;
          activeCue.clockAnchorElapsed = currentClockElapsed;
          logger.info(`[TimelineRuntime] Video completed, transitioning to post-video clock mode: ${cueId}`, {
            videoEndElapsed,
            currentClockElapsed,
          });
          // Continue as clock-driven from here (don't complete yet)
        } else {
          // No post-video entries — cue is complete
          const { completedCommands, failedCommands } = activeCue;
          logger.info(`[TimelineRuntime] Video-driven cue completed: ${cueId}`);
          this.activeCues.delete(cueId);
          completedCues.push({ cueId, completedCommands, failedCommands });
        }
      }
    }

    return completedCues;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stop / pause / resume (cascade)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Stop a compound cue (cascade to children).
   * @param {string} cueId
   * @returns {Promise<{stopped: boolean, wasActive: boolean}>}
   */
  async stopCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue) {
      logger.info(`[TimelineRuntime] stopCue: "${cueId}" not active, ignoring`);
      return { stopped: false, wasActive: false };
    }

    // Cascade stop to children first
    for (const childId of activeCue.children) {
      await this.stopCue(childId);
    }

    const hadVideoStarted = activeCue.hasVideo && activeCue.videoStarted;

    activeCue.state = 'stopped';
    this.activeCues.delete(cueId);
    logger.info(`[TimelineRuntime] Stopped compound cue: ${cueId}`);

    return { stopped: true, wasActive: true, hadVideoStarted };
  }

  /**
   * Pause a compound cue.
   * @param {string} cueId
   * @returns {{ paused: boolean, hadVideoStarted: boolean }}
   */
  pauseCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') {
      logger.info(`[TimelineRuntime] pauseCue: "${cueId}" not running, ignoring`);
      return { paused: false, hadVideoStarted: false };
    }

    const hadVideoStarted = activeCue.hasVideo && activeCue.videoStarted;

    activeCue.state = 'paused';
    logger.info(`[TimelineRuntime] Paused compound cue: ${cueId}`);

    // Cascade pause to children
    for (const childId of activeCue.children) {
      const child = this.activeCues.get(childId);
      if (child && child.state === 'running') {
        child.state = 'paused';
        logger.info(`[TimelineRuntime] Cascade-paused child cue: ${childId}`);
      }
    }

    return { paused: true, hadVideoStarted };
  }

  /**
   * Resume a paused compound cue.
   * @param {string} cueId
   * @returns {{ resumed: boolean, hadVideoStarted: boolean }}
   */
  resumeCue(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'paused') {
      logger.info(`[TimelineRuntime] resumeCue: "${cueId}" not paused, ignoring`);
      return { resumed: false, hadVideoStarted: false };
    }

    const hadVideoStarted = activeCue.hasVideo && activeCue.videoStarted;

    activeCue.state = 'running';
    logger.info(`[TimelineRuntime] Resumed compound cue: ${cueId}`);

    // Cascade resume to children
    for (const childId of activeCue.children) {
      const child = this.activeCues.get(childId);
      if (child && child.state === 'paused') {
        child.state = 'running';
        logger.info(`[TimelineRuntime] Cascade-resumed child cue: ${childId}`);
      }
    }

    return { resumed: true, hadVideoStarted };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Completion check
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a clock/post-video-driven compound cue has completed.
   * Video-driven cues complete via handleVideoLifecycle, not here.
   *
   * @param {string} cueId
   * @returns {{completed: boolean, completedCommands?: Array, failedCommands?: Array}}
   */
  checkCompletion(cueId) {
    const activeCue = this.activeCues.get(cueId);
    if (!activeCue || activeCue.state !== 'running') return { completed: false };

    // Video-driven cues (in video mode) complete via handleVideoLifecycle
    if (activeCue.driveMode === 'video') return { completed: false };

    const { timeline, firedEntries, maxAt, elapsed } = activeCue;

    if (firedEntries.size >= timeline.length && elapsed >= maxAt) {
      const { completedCommands, failedCommands } = activeCue;
      this.activeCues.delete(cueId);
      logger.info(`[TimelineRuntime] Compound cue completed: ${cueId}`, {
        completed: completedCommands.length, failed: failedCommands.length,
      });
      return { completed: true, completedCommands, failedCommands };
    }

    return { completed: false };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Routing resolution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolve 3-tier routing for a timeline command payload.
   * Priority: command-level target > cue-level routing > global (no injection).
   *
   * @param {string} action
   * @param {Object} payload
   * @param {Object} [cueDef]
   * @returns {Object}
   */
  _resolveRouting(action, payload, cueDef) {
    if (payload.target) return payload;

    if (cueDef && cueDef.routing) {
      const streamType = action.split(':')[0];
      const cueTarget = cueDef.routing[streamType];
      if (cueTarget) return { ...payload, target: cueTarget };
    }

    return payload;
  }
}

module.exports = TimelineRuntime;
