/**
 * Sync Full Payload Helpers
 * Builds the common sync:full payload used by gmAuth.js (initial connect)
 * and broadcasts.js (offline:queue:processed).
 *
 * Callers merge context-specific fields (e.g., deviceScannedTokens, reconnection).
 */

const vlcService = require('../services/vlcService');
const { buildEnvironmentState } = require('./environmentHelpers');
const logger = require('../utils/logger');

/**
 * Build the common sync:full payload from current service state.
 *
 * @param {Object} options
 * @param {Object} options.sessionService
 * @param {Object} options.transactionService
 * @param {Object} options.videoQueueService
 * @param {Object} [options.offlineQueueService]
 * @param {Object} [options.bluetoothService]
 * @param {Object} [options.audioRoutingService]
 * @param {Object} [options.lightingService]
 * @param {Object} [options.gameClockService]
 * @param {Object} [options.cueEngineService]
 * @param {Object} [options.deviceFilter] - Optional filter options
 * @param {boolean} [options.deviceFilter.connectedOnly=false] - Only include connected devices
 * @returns {Promise<Object>} sync:full payload
 */
async function buildSyncFullPayload({
  sessionService,
  transactionService,
  videoQueueService,
  offlineQueueService,
  bluetoothService,
  audioRoutingService,
  lightingService,
  gameClockService,
  cueEngineService,
  spotifyService,
  deviceFilter = {},
}) {
  const session = sessionService.getCurrentSession();

  const videoStatus = {
    status: videoQueueService.currentStatus || 'idle',
    queueLength: (videoQueueService.queue || []).length,
    tokenId: videoQueueService.currentVideo?.tokenId || null,
    duration: videoQueueService.currentVideo?.duration || null,
    progress: videoQueueService.currentVideo?.progress || null,
    expectedEndTime: videoQueueService.currentVideo?.expectedEndTime || null,
    error: videoQueueService.currentVideo?.error || null,
  };

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
      summary: transaction.summary || null,
    };
  });

  // Get VLC connection status
  const vlcConnected = vlcService?.isConnected ? vlcService.isConnected() : false;

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

  const systemStatus = {
    orchestrator: 'online',
    vlc: vlcConnected ? 'connected' : 'disconnected',
  };

  // Add offline status when offlineQueueService is available
  if (offlineQueueService) {
    systemStatus.offline = offlineQueueService.isOffline || false;
  }

  const environment = await buildEnvironmentState({
    bluetoothService,
    audioRoutingService,
    lightingService,
  });

  // Phase 1: Game Clock state
  const gameClock = buildGameClockState(gameClockService);

  // Phase 1: Cue Engine state
  const cueEngine = buildCueEngineState(cueEngineService);

  // Phase 2: Spotify state
  const spotify = buildSpotifyState(spotifyService);

  return {
    session: session ? session.toJSON() : null,
    scores,
    recentTransactions,
    videoStatus,
    devices,
    systemStatus,
    playerScans: session?.playerScans || [],
    environment,
    gameClock,
    cueEngine,
    spotify,
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
  try {
    if (!gameClockService) {
      return { status: 'stopped', elapsed: 0, expectedDuration: 7200 };
    }
    const state = gameClockService.getState();
    return {
      status: state.status,
      elapsed: state.elapsed,
      expectedDuration: 7200  // 2 hours default; make configurable later
    };
  } catch (err) {
    logger.warn('Failed to gather game clock state for sync:full', { error: err.message });
    return { status: 'stopped', elapsed: 0, expectedDuration: 7200 };
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
 * Build Spotify state for sync:full payload.
 * Gracefully degrades when service is unavailable.
 *
 * @param {Object} spotifyService - SpotifyService instance (optional)
 * @returns {Object} Spotify state
 */
function buildSpotifyState(spotifyService) {
  try {
    if (!spotifyService) {
      return { connected: false, state: 'stopped', volume: 100, pausedByGameClock: false };
    }
    return spotifyService.getState();
  } catch (err) {
    logger.warn('Failed to gather Spotify state for sync:full', { error: err.message });
    return { connected: false, state: 'stopped', volume: 100, pausedByGameClock: false };
  }
}

module.exports = { buildSyncFullPayload };
