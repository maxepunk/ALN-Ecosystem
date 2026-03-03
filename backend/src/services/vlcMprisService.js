// backend/src/services/vlcMprisService.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const registry = require('./serviceHealthRegistry');
const { spawn, execFileSync } = require('child_process');
const MprisPlayerBase = require('./mprisPlayerBase');

const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

class VlcMprisService extends MprisPlayerBase {
  constructor() {
    super({
      destination: 'org.mpris.MediaPlayer2.vlc',
      label: 'VLC',
      healthServiceId: 'vlc',
      signalDebounceMs: 100, // VLC signals are less chatty than Spotify
    });
    this._previousDelta = null;
    this._loopEnabled = false;
    this._rawVolume = 1.0; // MPRIS 0.0-1.0 — avoids lossy 256→100→256 round-trip
    this._vlcProc = null;
    this._vlcRestartTimer = null;
    this._vlcStopped = false;      // Flag to prevent restart after intentional stop
    this._processExitHandler = null; // For orphan prevention
  }

  // ── VLC Process Management ──

  /**
   * Spawn the VLC process with platform-appropriate args.
   * Simple restart-on-exit wrapper — always restarts after 3s unless stopped.
   * NOT using ProcessMonitor: its receivedData heuristic checks stdout,
   * but VLC writes to stderr, causing false maxFailures give-up.
   */
  _spawnVlcProcess() {
    if (this._vlcProc) return; // Already running

    // Remove stale exit handler from previous spawn (prevents listener leak on crash/restart cycles)
    if (this._processExitHandler) {
      process.removeListener('exit', this._processExitHandler);
      this._processExitHandler = null;
    }

    // Kill any orphaned VLC from a previous crash (prevents D-Bus name conflict
    // where the stale instance holds org.mpris.MediaPlayer2.vlc and our new
    // spawn gets a PID-suffixed name that _destination won't find)
    try { execFileSync('pkill', ['-x', 'cvlc']); } catch { /* none running */ }

    const args = this._buildVlcArgs();
    const env = { ...process.env, DISPLAY: process.env.DISPLAY || ':0' };

    logger.info('[VLC] Spawning process', { args: args.join(' ') });
    this._vlcProc = spawn('cvlc', args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'], // stderr only (for error logging)
    });

    this._vlcProc.stderr.on('data', (data) => {
      // Log VLC errors but don't treat as health signal
      const msg = data.toString().trim();
      if (msg) logger.debug('[VLC] stderr:', msg);
    });

    this._vlcProc.on('close', (code, signal) => {
      logger.warn('[VLC] Process exited', { code, signal });
      this._vlcProc = null;
      this._setConnected(false);

      if (!this._vlcStopped) {
        logger.info('[VLC] Scheduling restart in 3s');
        this._vlcRestartTimer = setTimeout(() => {
          this._vlcRestartTimer = null;
          this._spawnVlcProcess();
        }, 3000);
      }
    });

    // Orphan prevention: kill VLC if Node exits unexpectedly
    this._processExitHandler = () => {
      if (this._vlcProc) {
        this._vlcProc.kill('SIGTERM');
      }
    };
    process.on('exit', this._processExitHandler);
  }

  /**
   * Stop VLC process and prevent restart.
   */
  _stopVlcProcess() {
    this._vlcStopped = true;

    if (this._vlcRestartTimer) {
      clearTimeout(this._vlcRestartTimer);
      this._vlcRestartTimer = null;
    }

    if (this._processExitHandler) {
      process.removeListener('exit', this._processExitHandler);
      this._processExitHandler = null;
    }

    if (this._vlcProc) {
      this._vlcProc.kill('SIGTERM');
      this._vlcProc = null;
    }

    // Belt-and-suspenders: pkill catches cases where SIGTERM is ignored
    // or the child was reparented before SIGTERM was processed (Node exits
    // immediately after kill(), VLC becomes orphan under init).
    try { execFileSync('pkill', ['-x', 'cvlc']); } catch { /* none running */ }
  }

  /**
   * Wait for VLC to become reachable on D-Bus after spawn.
   * Polls checkConnection() every 500ms for up to timeoutMs.
   * Returns true if connected, false if timed out (non-fatal — D-Bus monitor will catch later).
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<boolean>}
   */
  async _waitForVlcReady(timeoutMs = 5000) {
    const interval = 500;
    const maxAttempts = Math.ceil(timeoutMs / interval);

    for (let i = 0; i < maxAttempts; i++) {
      const connected = await this.checkConnection();
      if (connected) return true;
      await new Promise(r => setTimeout(r, interval));
    }

    return false;
  }

  /**
   * Build cvlc command-line arguments.
   * @returns {string[]}
   */
  _buildVlcArgs() {
    const baseArgs = [
      '--no-loop', '-A', 'pulse', '--fullscreen',
      '--video-on-top', '--no-video-title-show',
      '--no-video-deco', '--no-osd',
    ];
    const hwArgs = this._getHwAccelArgs();
    return hwArgs.length > 0 ? [...baseArgs, ...hwArgs] : baseArgs;
  }

  /**
   * Detect Raspberry Pi model and return hardware acceleration flags.
   * Pi 4: v4l2_m2m hardware decode.
   * Pi 5: --vout=gl (prevents HDMI signal loss from DRM plane conflicts with Xorg).
   * VLC_HW_ACCEL env var overrides auto-detection.
   * @returns {string[]}
   */
  _getHwAccelArgs() {
    if (process.env.VLC_HW_ACCEL !== undefined) {
      return process.env.VLC_HW_ACCEL ? process.env.VLC_HW_ACCEL.split(' ') : [];
    }
    try {
      const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
      if (model.includes('Raspberry Pi 5')) return ['--vout=gl'];
      if (model.includes('Raspberry Pi 4')) return ['--codec=avcodec', '--avcodec-hw=v4l2_m2m'];
    } catch {
      // Not a Pi (dev machine, CI)
    }
    return [];
  }

  // ── Init ──

  /**
   * Initialize VLC MPRIS service.
   * Spawns VLC process, waits for D-Bus registration, starts playback monitor.
   */
  async init() {
    logger.info('[VLC] Initializing MPRIS service');

    // Spawn VLC process (backend owns VLC lifecycle now)
    this._vlcStopped = false;
    this._spawnVlcProcess();

    // Wait for VLC to register on D-Bus
    const ready = await this._waitForVlcReady();
    if (ready) {
      logger.info('[VLC] D-Bus connection established');
    } else {
      logger.warn('[VLC] Not ready after spawn (D-Bus monitor will detect when available)');
    }

    // Start D-Bus monitor regardless — catches state changes
    this.startPlaybackMonitor();
  }

  // ── Video Playback ──

  /**
   * Play a video file via MPRIS OpenUri.
   * Disables loop first, then opens the file URI.
   * @param {string} videoPath - Filename, relative path, or full URL
   * @returns {Promise<Object>} VLC status
   */
  async playVideo(videoPath) {
    await this._ensureConnection();

    // Disable loop for regular videos (idle loop will re-enable)
    await this.setLoop(false);

    // Build file:// URI from path
    const uri = this._buildVideoUri(videoPath);

    await this._dbusCall(`${PLAYER_IFACE}.OpenUri`, [`string:${uri}`]);

    logger.info('[VLC] Video playback started', { videoPath });
    this.emit('video:played', videoPath);

    return await this.getStatus();
  }

  /**
   * Convert video path to file:// URI for MPRIS OpenUri.
   * @param {string} videoPath
   * @returns {string} file:// URI or pass-through URL
   */
  _buildVideoUri(videoPath) {
    if (videoPath.startsWith('http') || videoPath.startsWith('file://')) {
      return videoPath;
    }
    if (videoPath.startsWith('/')) {
      return `file://${process.cwd()}/public${videoPath}`;
    }
    // Bare filename — relative to videos directory
    return `file://${process.cwd()}/public/videos/${videoPath}`;
  }

  // ── Transport Controls ──

  async stop() {
    await this._transport('Stop');
    this.emit('video:stopped');
    logger.info('[VLC] Video playback stopped');
  }

  async pause() {
    await this._transport('Pause');
    this.emit('video:paused');
    logger.info('[VLC] Video playback paused');
  }

  async resume() {
    await this._transport('Play');
    this.emit('video:resumed');
    logger.info('[VLC] Video playback resumed');
  }

  /**
   * Skip current video — MPRIS Stop + emit video:skipped.
   * videoQueueService handles queue advancement.
   */
  async skip() {
    await this._transport('Stop');
    this.emit('video:skipped');
    logger.info('[VLC] Video skipped');
  }

  // ── Status ──

  /**
   * Get VLC status by actively reading D-Bus properties.
   * Reads Position, PlaybackStatus, and Metadata directly — does not rely
   * on the passive D-Bus monitor for state or track info.
   * @returns {Promise<Object>} {connected, state, currentItem, position, length, time, volume, fullscreen, loop}
   */
  async getStatus() {
    await this._ensureConnection();

    // Read PlaybackStatus directly (monitor may not have received signal yet)
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'PlaybackStatus');
      if (stdout.includes('"Playing"')) this.state = 'playing';
      else if (stdout.includes('"Paused"')) this.state = 'paused';
      else this.state = 'stopped';
    } catch {
      // PlaybackStatus read failed — keep cached state
    }

    // Read Metadata directly (monitor may not have received signal yet)
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'Metadata');
      const parsed = this._parseMetadata(stdout);
      if (parsed) {
        this.track = parsed;
      }
    } catch {
      // Metadata read failed — keep cached track
    }

    // Read current position from D-Bus (not tracked by PropertiesChanged)
    let positionUs = 0;
    try {
      const { stdout } = await this._dbusGetProperty(PLAYER_IFACE, 'Position');
      const match = stdout.match(/int64\s+(\d+)/);
      positionUs = match ? parseInt(match[1], 10) : 0;
    } catch {
      // Position read failed — use 0
    }

    const lengthSec = this.track?.length || 0;
    const timeSec = positionUs / 1000000;
    const positionRatio = lengthSec > 0 ? Math.min(1, timeSec / lengthSec) : 0;

    return {
      connected: true,
      state: this.state,
      currentItem: this.track?.filename || null,
      position: positionRatio,   // 0.0-1.0 ratio (backward compat)
      length: lengthSec,         // seconds
      time: timeSec,             // seconds
      volume: Math.round(this._rawVolume * 256), // 0.0-1.0 MPRIS → 0-256 (no lossy intermediate)
      fullscreen: false,         // Not available via MPRIS; VLC launched fullscreen
      loop: this._loopEnabled,
    };
  }

  // ── Volume (0-256 external ↔ 0.0-1.0 MPRIS) ──

  /**
   * Set VLC volume.
   * @param {number} volume - Volume level 0-256 (VLC HTTP compat range)
   */
  async setVolume(volume) {
    const clamped = Math.max(0, Math.min(256, volume));
    const normalized = clamped / 256;
    await this._dbusSetProperty(PLAYER_IFACE, 'Volume', 'double', normalized);
    logger.info('[VLC] Volume set', { volume: clamped });
  }

  // ── Seek ──

  /**
   * Seek to absolute position via MPRIS SetPosition.
   * Uses SetPosition (absolute) not Seek (relative offset).
   * @param {number} position - Position in seconds
   */
  async seek(position) {
    await this._ensureConnection();
    const positionUs = Math.round(position * 1000000);
    // SetPosition requires a track object path — VLC uses a fixed path
    await this._dbusCall(`${PLAYER_IFACE}.SetPosition`, [
      'objpath:/org/mpris/MediaPlayer2/TrackList/NoTrack',
      `int64:${positionUs}`,
    ]);
    logger.info('[VLC] Seeked to position', { position });
  }

  // ── Loop ──

  /**
   * Set loop mode via MPRIS LoopStatus property.
   * @param {boolean} enabled - true = Playlist loop, false = None
   */
  async setLoop(enabled) {
    const status = enabled ? 'Playlist' : 'None';
    await this._dbusSetProperty(PLAYER_IFACE, 'LoopStatus', 'string', status);
    this._loopEnabled = enabled;
    logger.debug(`[VLC] Loop ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ── Idle Loop ──

  /**
   * Initialize idle loop video at startup.
   * Checks FEATURE_IDLE_LOOP env and file existence before playing.
   */
  async initializeIdleLoop() {
    if (process.env.FEATURE_IDLE_LOOP === 'false') {
      logger.info('[VLC] Idle loop disabled by configuration');
      return;
    }

    if (!this._idleLoopExists()) {
      logger.warn('[VLC] Idle loop video not found');
      return;
    }

    try {
      await this._initializeIdleLoopDelay();
      await this.playVideo('idle-loop.mp4');
      await this.setLoop(true);
      logger.info('[VLC] Idle loop initialized with continuous playback');
    } catch (err) {
      logger.warn('[VLC] Failed to initialize idle loop:', err.message);
    }
  }

  /**
   * Return to idle loop after video playback.
   */
  async returnToIdleLoop() {
    if (process.env.FEATURE_IDLE_LOOP === 'false') {
      return;
    }

    try {
      await this.playVideo('idle-loop.mp4');
      await this.setLoop(true);
      logger.info('[VLC] Returned to idle loop');
    } catch (err) {
      logger.warn('[VLC] Failed to return to idle loop:', err.message);
    }
  }

  /**
   * Check if idle loop video file exists. Extracted for test mockability.
   * @returns {boolean}
   */
  _idleLoopExists() {
    const idleVideoPath = path.join(__dirname, '../../public/videos/idle-loop.mp4');
    return fs.existsSync(idleVideoPath);
  }

  /**
   * Delay before initializing idle loop. Extracted for test mockability.
   */
  _initializeIdleLoopDelay() {
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  // ── Connection ──

  /**
   * Delegate to service health registry.
   * @returns {boolean}
   */
  isConnected() {
    return registry.isHealthy('vlc');
  }

  // ── State Change Processing (Sole Authority) ──

  /**
   * Process debounced MPRIS property changes — sole authority for VLC state.
   * Emits state:changed with {previous, current} format for broadcasts.js compat.
   */
  _processStateChange(signal) {
    const properties = signal.properties || {};

    // Auto-recover health: receiving an MPRIS signal means VLC is alive
    if (!registry.isHealthy('vlc')) {
      registry.report('vlc', 'healthy', 'MPRIS signal received');
    }

    // PlaybackStatus
    if ('PlaybackStatus' in properties) {
      const newState = properties.PlaybackStatus.toLowerCase();
      this.state = newState;
    }

    // Volume: 0.0-1.0 → store raw + 0-100 internal
    if ('Volume' in properties) {
      this._rawVolume = properties.Volume;
      this.volume = Math.round(properties.Volume * 100);
    }

    // Metadata: parse filename and length from raw signal
    let newFilename = this.track?.filename || null;
    if (signal.raw && signal.raw.includes('xesam:url')) {
      const parsed = this._parseMetadata(signal.raw);
      if (parsed) {
        this.track = parsed;
        newFilename = parsed.filename;
      }
    }

    // State delta detection — emit state:changed for broadcasts.js
    const currentDelta = {
      state: this.state,
      filename: newFilename,
    };

    if (this._previousDelta &&
        (this._previousDelta.state !== currentDelta.state ||
         this._previousDelta.filename !== currentDelta.filename)) {
      this.emit('state:changed', {
        previous: { ...this._previousDelta },
        current: { ...currentDelta },
      });
    }

    this._previousDelta = currentDelta;
  }

  // ── Metadata Parsing ──

  /**
   * Parse VLC metadata from raw D-Bus output.
   * Extracts xesam:url (→ filename) and mpris:length (→ seconds).
   * @param {string} raw - Raw dbus-monitor signal output
   * @returns {{url: string, filename: string, length: number}|null}
   */
  _parseMetadata(raw) {
    if (!raw) return null;

    const urlMatch = raw.match(/xesam:url[\s\S]*?string\s+"([^"]*)"/);
    if (!urlMatch) return null;

    const url = urlMatch[1];
    const filename = url.split('/').pop() || null;

    const lengthMatch = raw.match(/mpris:length[\s\S]*?int64\s+(\d+)/);
    const lengthUs = lengthMatch ? parseInt(lengthMatch[1], 10) : 0;
    const length = lengthUs / 1000000; // microseconds → seconds

    return { url, filename, length };
  }

  // ── Lifecycle ──

  /**
   * Reset VLC-specific state plus base class cleanup.
   * Preserves VLC process — system reset should not kill VLC.
   */
  reset() {
    super.reset(); // stops D-Bus monitor, reports health down, resets state
    this._previousDelta = null;
    this._loopEnabled = false;
    this._rawVolume = 1.0;
    // VLC process intentionally preserved (same as Spotify's spotifyd)
  }

  /**
   * Full cleanup — stop VLC process and remove all listeners.
   * Called on server shutdown (not on system reset).
   */
  cleanup() {
    this._stopVlcProcess();
    super.cleanup(); // calls reset() + removeAllListeners()
  }
}

module.exports = new VlcMprisService();
