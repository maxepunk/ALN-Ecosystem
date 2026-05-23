/**
 * Sync Full Payload Helpers
 * Builds the common sync:full payload used by:
 * - gmAuth.js (initial GM connect)
 * - broadcasts.js (offline:queue:processed, scores:reset)
 * - server.js (sync:request handler)
 * - stateRoutes.js (GET /api/state HTTP endpoint)
 *
 * Callers merge context-specific fields (e.g., deviceScannedTokens, reconnection).
 */

const config = require('../config');
const serviceHealthRegistry = require('../services/serviceHealthRegistry');
const displayControlService = require('../services/displayControlService');
const { DisplayMode } = displayControlService;
const { buildEnvironmentState } = require('./environmentHelpers');
const logger = require('../utils/logger');

/**
 * Build the common sync:full payload from current service state.
 *
 * @param {Object} options
 * @param {Object} options.sessionService
 * @param {Object} options.transactionService
 * @param {Object} options.videoQueueService
 * @param {Object} [options.bluetoothService]
 * @param {Object} [options.audioRoutingService]
 * @param {Object} [options.lightingService]
 * @param {Object} [options.gameClockService]
 * @param {Object} [options.cueEngineService]
 * @param {Object} [options.musicService]
 * @param {Object} [options.soundService]
 * @param {Object} [options.deviceFilter] - Optional filter options
 * @param {boolean} [options.deviceFilter.connectedOnly=false] - Only include connected devices
 * @returns {Promise<Object>} sync:full payload
 */
async function buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  musicService,
  soundService,
  deviceFilter = {},
}) {
  const session = sessionService.getCurrentSession();

  // Video state — single source of truth is videoQueueService.getState().
  // Same shape as service:state video-domain pushes; both write to the GM
  // Scanner's 'video' store domain so shapes MUST match (StateStore.update
  // is a shallow merge — shape drift would leave orphan fields forever).
  // Previously read videoQueueService.currentStatus / .currentVideo which
  // were removed in commit 756ee7fa (2026-02-28 getState() migration).
  const videoStatus = videoQueueService.getState();

  const scores = transactionService.getTeamScores();

  // Enrich ALL transactions with token data (for full state restoration)
  // Frontend DataManager needs complete transaction history.
  const recentTransactions = (session?.transactions || []).map(transaction => {
    const token = transactionService.getToken(transaction.tokenId);
    return {
      id: transaction.id,
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
      deviceId: transaction.deviceId,
      mode: transaction.mode,
      status: transaction.status,
      points: transaction.points,
      timestamp: transaction.timestamp,
      memoryType: token?.memoryType || 'UNKNOWN',
      valueRating: token?.metadata?.rating || 0,
      group: token?.metadata?.group || token?.groupId || 'No Group',
      summary: transaction.summary || null,
      isUnknown: !token,
      owner: token?.metadata?.owner || null,
    };
  });

  // Build device list (optionally filtering to connected-only)
  let devices = [];
  if (session) {
    let deviceList = session.connectedDevices || [];
    if (deviceFilter.connectedOnly) {
      deviceList = deviceList.filter(d => d.connectionStatus === 'connected');
    }
    devices = deviceList.map(device => ({
      deviceId: device.id,
      type: device.type,
      name: device.name,
      connectionTime: device.connectionTime,
      ipAddress: device.ipAddress,
    }));
  }

  // Registry snapshot: all 8 services with status, message, lastChecked
  const serviceHealth = serviceHealthRegistry.getSnapshot();

  const environment = await buildEnvironmentState({
    bluetoothService,
    audioRoutingService,
    lightingService,
  });

  // Phase 1: Game Clock state
  const gameClock = buildGameClockState(gameClockService);

  // Phase 1: Cue Engine state
  const cueEngine = buildCueEngineState(cueEngineService);

  // Music state (MPD)
  const music = buildMusicState(musicService);

  // Phase 3: Held items (blocked by service outage or resource contention)
  const heldItems = buildHeldItemsState(cueEngineService, videoQueueService);

  // Sound playback state
  const sound = soundService ? soundService.getState() : { playing: [] };

  // Display mode status (singleton import — no call site changes needed)
  // Use getStatus() but strip volatile `timestamp` to keep ETag stable
  const displayStatusRaw = displayControlService.getStatus
    ? displayControlService.getStatus()
    : { currentMode: DisplayMode.IDLE_LOOP, previousMode: DisplayMode.IDLE_LOOP, pendingVideo: null };
  const { timestamp: _ts, ...displayStatus } = displayStatusRaw;

  return {
    session: session ? session.toJSON() : null,
    scores,
    recentTransactions,
    videoStatus,
    devices,
    serviceHealth,
    playerScans: session?.playerScans || [],
    environment,
    gameClock,
    cueEngine,
    music,
    heldItems,
    sound,
    displayStatus,
  };
}

/**
 * Build game clock state for sync:full payload.
 * Gracefully degrades when service is unavailable.
 *
 * @param {Object} gameClockService - GameClockService instance (optional)
 * @returns {Object} Game clock state
 */
function buildGameClockState(gameClockService) {
  const expectedDuration = config.session.sessionTimeout * 60;
  try {
    if (!gameClockService) {
      return { status: 'stopped', elapsed: 0, expectedDuration };
    }
    const state = gameClockService.getState();
    return {
      status: state.status,
      elapsed: state.elapsed,
      expectedDuration
    };
  } catch (err) {
    logger.warn('Failed to gather game clock state for sync:full', { error: err.message });
    return { status: 'stopped', elapsed: 0, expectedDuration };
  }
}

/**
 * Build cue engine state for sync:full payload.
 * Gracefully degrades when service is unavailable.
 *
 * @param {Object} cueEngineService - CueEngineService instance (optional)
 * @returns {Object} Cue engine state
 */
function buildCueEngineState(cueEngineService) {
  try {
    if (!cueEngineService) {
      return { loaded: false, cues: [], activeCues: [], disabledCues: [] };
    }
    return {
      loaded: cueEngineService.getCues().length > 0,
      cues: cueEngineService.getCueSummaries(),
      activeCues: cueEngineService.getActiveCues(),
      disabledCues: cueEngineService.getDisabledCues()
    };
  } catch (err) {
    logger.warn('Failed to gather cue engine state for sync:full', { error: err.message });
    return { loaded: false, cues: [], activeCues: [], disabledCues: [] };
  }
}

/**
 * Build music state for sync:full payload.
 * Includes playlists array so GM Scanner can populate the picker without
 * a second round-trip. Gracefully degrades when service is unavailable.
 *
 * @param {Object} musicService - MusicService instance (optional)
 * @returns {Object} Music state with playlists
 */
function buildMusicState(musicService) {
  const defaultState = {
    connected: false,
    state: 'stopped',
    volume: 70,
    track: null,
    playlist: null,
    pausedByGameClock: false,
    playlists: [],
  };
  try {
    if (!musicService) return defaultState;
    const state = musicService.getState();
    const playlists = typeof musicService.getPlaylists === 'function'
      ? musicService.getPlaylists()
      : [];
    return { ...state, playlists };
  } catch (err) {
    logger.warn('Failed to gather music state for sync:full', { error: err.message });
    return defaultState;
  }
}

/**
 * Build held items state for sync:full payload.
 * Combines held videos and held cues into a single array.
 * Gracefully degrades when services are unavailable.
 *
 * @param {Object|null} cueEngineService - CueEngineService instance (Phase 3e)
 * @param {Object|null} videoQueueService - VideoQueueService instance
 * @returns {Array} Held items array
 */
function buildHeldItemsState(cueEngineService, videoQueueService) {
  const items = [];
  try {
    if (videoQueueService && typeof videoQueueService.getHeldVideos === 'function') {
      items.push(...videoQueueService.getHeldVideos());
    }
  } catch (err) {
    logger.warn('Failed to gather held video state for sync:full', { error: err.message });
  }
  try {
    if (cueEngineService && typeof cueEngineService.getHeldCues === 'function') {
      items.push(...cueEngineService.getHeldCues());
    }
  } catch (err) {
    logger.warn('Failed to gather held cue state for sync:full', { error: err.message });
  }
  return items;
}

module.exports = { buildSyncFullPayload, buildHeldItemsState, buildMusicState };
