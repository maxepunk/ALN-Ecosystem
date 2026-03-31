/**
 * Command Executor
 * Shared command execution logic for both WebSocket handler and cue engine
 *
 * This module extracts the gm:command switch statement from adminEvents.js
 * so both GM manual commands and automated cue dispatches can reuse the logic.
 */

'use strict';

const logger = require('../utils/logger');
const config = require('../config');

// Service imports
const sessionService = require('./sessionService');
const transactionService = require('./transactionService');
const videoQueueService = require('./videoQueueService');
const displayControlService = require('./displayControlService');
const bluetoothService = require('./bluetoothService');
const audioRoutingService = require('./audioRoutingService');
const lightingService = require('./lightingService');
const soundService = require('./soundService');
const spotifyService = require('./spotifyService');
const registry = require('./serviceHealthRegistry');

// Service dependency map for pre-dispatch health checks
const SERVICE_DEPENDENCIES = {
  'video:play': 'vlc',
  'video:pause': 'vlc',
  'video:stop': 'vlc',
  'video:skip': 'vlc',
  'video:queue:add': 'vlc',
  // video:queue:reorder and video:queue:clear intentionally UNGATED —
  // pure queue operations (no VLC calls). GM must manage queue during VLC outage.
  'display:idle-loop': 'vlc',
  'spotify:play': 'spotify',
  'spotify:pause': 'spotify',
  'spotify:stop': 'spotify',
  'spotify:next': 'spotify',
  'spotify:previous': 'spotify',
  'spotify:playlist': 'spotify',
  'spotify:volume': 'spotify',
  // spotify:cache:verify intentionally UNGATED — cache check, no D-Bus needed
  // service:check intentionally UNGATED — health probe bypasses health gate
  'sound:play': 'sound',
  'sound:stop': 'sound',
  'lighting:scene:activate': 'lighting',
  'lighting:scenes:refresh': 'lighting',
  'bluetooth:pair': 'bluetooth',
  'bluetooth:unpair': 'bluetooth',
  'bluetooth:connect': 'bluetooth',
  'bluetooth:disconnect': 'bluetooth',
  'bluetooth:scan:start': 'bluetooth',
  'bluetooth:scan:stop': 'bluetooth',
  'audio:route:set': 'audio',
  'audio:volume:set': 'audio',
};

// Lookup tables for command dispatch
const SPOTIFY_TRANSPORT = {
  'spotify:play': 'play',
  'spotify:pause': 'pause',
  'spotify:stop': 'stop',
  'spotify:next': 'next',
  'spotify:previous': 'previous',
};

/**
 * Execute a gm:command action.
 * Called by WebSocket handler (source: 'gm') and cue engine (source: 'cue').
 *
 * @param {Object} params
 * @param {string} params.action - The command action (e.g., 'session:create')
 * @param {Object} params.payload - Action-specific payload
 * @param {string} params.source - 'gm' or 'cue'
 * @param {string} [params.trigger] - Provenance string when source is 'cue'
 * @param {string} [params.deviceId] - Device ID (for logging/transactions)
 * @param {string} [params.deviceType] - Device type (for transactions)
 * @returns {Promise<{success: boolean, message: string, data?: any, source: string}>}
 */
async function executeCommand({ action, payload = {}, source = 'gm', trigger, deviceId, deviceType }) {
  logger.info(`[executeCommand] action=${action} source=${source}${trigger ? ` trigger=${trigger}` : ''}`);

  try {
    // Pre-dispatch health check: reject commands when required service is down
    const requiredService = SERVICE_DEPENDENCIES[action];
    if (requiredService && !registry.isHealthy(requiredService)) {
      const { status, message } = registry.getStatus(requiredService);
      return {
        success: false,
        message: `${requiredService} is ${status}: ${message}`,
        source
      };
    }

    let resultMessage = '';
    let resultData = null;

    // Lazy require: circular dependency (commandExecutor ↔ cueEngineService)
    let _cueEngine;
    const getCueEngine = () => {
      if (!_cueEngine) _cueEngine = require('./cueEngineService');
      return _cueEngine;
    };

    switch (action) {
      // --- Session commands ---

      case 'session:create':
        // Create new session in setup state (service will emit session:created → broadcasts.js wraps as session:update)
        await sessionService.createSession({
          name: payload.name || 'New Session',
          teams: payload.teams || []
        });
        resultMessage = `Session "${payload.name || 'New Session'}" created successfully (in setup)`;
        logger.info('Session created', {
          source,
          deviceId,
          name: payload.name,
          teams: payload.teams
        });
        break;

      case 'session:start':
        // Transition session from setup to active (starts game clock)
        await sessionService.startGame();
        resultMessage = 'Game started';
        logger.info('Game started', { source, deviceId });
        break;

      case 'session:pause':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.updateSession({ status: 'paused' });
        resultMessage = 'Session paused successfully';
        logger.info('Session paused', { source, deviceId });
        break;

      case 'session:resume':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.updateSession({ status: 'active' });
        resultMessage = 'Session resumed successfully';
        logger.info('Session resumed', { source, deviceId });
        break;

      case 'session:end':
        // Service will emit session:updated → broadcasts.js wraps as session:update
        await sessionService.endSession();
        resultMessage = 'Session ended successfully';
        logger.info('Session ended', { source, deviceId });
        break;

      case 'session:addTeam': {
        const { teamId } = payload;
        if (!teamId) {
          throw new Error('teamId is required');
        }

        // Just trim - no arbitrary validation. GM types it, we store it.
        const trimmedTeamId = teamId.trim();
        if (!trimmedTeamId) {
          throw new Error('Team name cannot be empty');
        }

        const session = sessionService.getCurrentSession();
        if (!session) {
          throw new Error('No active session');
        }

        await sessionService.addTeamToSession(trimmedTeamId);
        resultMessage = `Team "${trimmedTeamId}" added to session`;
        logger.info('Team added to session', { source, deviceId, teamId: trimmedTeamId });
        break;
      }

      // --- Video commands ---

      case 'video:play':
        if (config.features.videoPlayback) {
          await videoQueueService.resumeCurrent();
        }
        resultMessage = 'Video playback resumed';
        logger.info('Video playback resumed', { source, deviceId });
        break;

      case 'video:pause':
        if (config.features.videoPlayback) {
          await videoQueueService.pauseCurrent();
        }
        resultMessage = 'Video playback paused';
        logger.info('Video playback paused', { source, deviceId });
        break;

      case 'video:stop':
        if (config.features.videoPlayback) {
          await videoQueueService.skipCurrent();
          videoQueueService.clearQueue();
        }
        resultMessage = 'Video playback stopped';
        logger.info('Video playback stopped', { source, deviceId });
        break;

      case 'video:skip':
        if (config.features.videoPlayback) {
          await videoQueueService.skipCurrent();
        }
        resultMessage = 'Video skipped successfully';
        logger.info('Video skipped', { source, deviceId });
        break;

      case 'video:queue:add': {
        // Add video to queue by filename
        const { videoFile } = payload;
        if (!videoFile) {
          throw new Error('videoFile is required for video:queue:add');
        }
        videoQueueService.addVideoByFilename(videoFile, deviceId);
        resultMessage = `Video ${videoFile} added to queue`;
        logger.info('Video added to queue', { source, deviceId, videoFile });
        break;
      }

      case 'video:queue:reorder': {
        // Reorder queue
        const { fromIndex, toIndex } = payload;
        if (fromIndex === undefined || toIndex === undefined) {
          throw new Error('fromIndex and toIndex are required for video:queue:reorder');
        }
        videoQueueService.reorderQueue(fromIndex, toIndex);
        resultMessage = `Queue reordered: moved position ${fromIndex} to ${toIndex}`;
        logger.info('Queue reordered', { source, deviceId, fromIndex, toIndex });
        break;
      }

      case 'video:queue:clear':
        // Clear entire queue
        videoQueueService.clearQueue();
        resultMessage = 'Video queue cleared';
        logger.info('Video queue cleared', { source, deviceId });
        break;

      // --- Display commands ---

      case 'display:idle-loop':
      case 'display:scoreboard':
      case 'display:return-to-video': {
        // Local helper for display command handling (DRY)
        async function handleDisplayCommand(serviceMethod, modeName, logMessage) {
          const result = await serviceMethod();
          if (!result.success) throw new Error(result.error || `Failed: ${logMessage}`);
          const mode = result.mode || modeName;
          resultData = { mode };
          resultMessage = logMessage;
          logger.info(logMessage, { source, deviceId, mode });
        }

        // Execute appropriate display command
        if (action === 'display:idle-loop') {
          await handleDisplayCommand(
            () => displayControlService.setIdleLoop(),
            'IDLE_LOOP',
            'Display switched to idle loop'
          );
        } else if (action === 'display:scoreboard') {
          await handleDisplayCommand(
            () => displayControlService.setScoreboard(),
            'SCOREBOARD',
            'Display switched to scoreboard'
          );
        } else if (action === 'display:return-to-video') {
          await handleDisplayCommand(
            () => displayControlService.returnToVideo(),
            'VIDEO',
            'Returned to video from scoreboard overlay'
          );
        }
        break;
      }

      case 'display:status': {
        // Get current display mode status
        const displayStatus = displayControlService.getStatus();
        resultData = { displayStatus };
        resultMessage = `Display mode: ${displayStatus.currentMode}`;
        logger.info('Display status requested', { source, deviceId, status: displayStatus });
        break;
      }

      // --- Scoring commands ---

      case 'score:adjust': {
        // Adjust team score by delta
        const { teamId, delta, reason } = payload;
        if (!teamId || delta === undefined) {
          throw new Error('teamId and delta are required for score:adjust');
        }
        transactionService.adjustTeamScore(teamId, delta, reason || 'Admin adjustment', deviceId);
        resultMessage = `Team ${teamId} score adjusted by ${delta}`;
        logger.info('Team score adjusted', {
          source,
          deviceId,
          teamId,
          delta,
          reason
        });
        break;
      }

      case 'score:reset': {
        // Reset all team scores
        transactionService.resetScores();
        const session = sessionService.getCurrentSession();
        resultMessage = 'All team scores reset to zero';
        logger.info('All team scores reset', {
          source,
          deviceId,
          sessionId: session?.id
        });
        break;
      }

      // --- Transaction commands ---

      case 'transaction:delete': {
        // Delete transaction and recalculate scores
        const { transactionId } = payload;
        if (!transactionId) {
          throw new Error('transactionId is required for transaction:delete');
        }
        const deleteSession = sessionService.getCurrentSession();
        if (!deleteSession) {
          throw new Error('No active session');
        }
        const deleteResult = transactionService.deleteTransaction(transactionId, deleteSession);
        resultMessage = `Transaction ${transactionId} deleted, team ${deleteResult.deletedTransaction.teamId} score recalculated`;
        logger.info('Transaction deleted', {
          source,
          deviceId,
          transactionId,
          affectedTeam: deleteResult.deletedTransaction.teamId,
          newScore: deleteResult.updatedScore.currentScore,
        });
        break;
      }

      case 'transaction:create': {
        // Create manual transaction
        const txData = { ...payload };
        if (!txData.tokenId || !txData.teamId || !txData.mode) {
          throw new Error('tokenId, teamId, and mode are required for transaction:create');
        }
        const createSession = sessionService.getCurrentSession();
        if (!createSession) {
          throw new Error('No active session');
        }
        // Add deviceId and deviceType from command context
        txData.deviceId = deviceId;
        txData.deviceType = deviceType || 'gm';
        const createResult = await transactionService.createManualTransaction(txData);
        resultMessage = `Manual transaction created for team ${txData.teamId}: ${createResult.points} points`;
        logger.info('Manual transaction created', {
          source,
          deviceId,
          transactionId: createResult.transactionId,
          tokenId: txData.tokenId,
          teamId: txData.teamId,
          points: createResult.points,
        });
        break;
      }

      // --- System commands ---

      case 'system:reset':
        // System reset is NOT extracted - it requires io and direct service references
        // This case is handled separately in adminEvents.js due to mutex and complexity
        throw new Error('system:reset must be handled by adminEvents.js directly');

      // --- Bluetooth commands ---

      case 'bluetooth:scan:start': {
        const timeout = payload?.timeout || config.bluetooth.scanTimeout;
        bluetoothService.startScan(timeout);
        resultMessage = `Bluetooth scan started (${timeout}s timeout)`;
        logger.info('Bluetooth scan started', { source, deviceId, timeout });
        break;
      }

      case 'bluetooth:scan:stop': {
        bluetoothService.stopScan();
        resultMessage = 'Bluetooth scan stopped';
        logger.info('Bluetooth scan stopped', { source, deviceId });
        break;
      }

      case 'bluetooth:pair':
      case 'bluetooth:unpair':
      case 'bluetooth:connect':
      case 'bluetooth:disconnect': {
        const BT_COMMANDS = {
          'bluetooth:pair': { method: 'pairDevice', verb: 'paired' },
          'bluetooth:unpair': { method: 'unpairDevice', verb: 'unpaired' },
          'bluetooth:connect': { method: 'connectDevice', verb: 'connected' },
          'bluetooth:disconnect': { method: 'disconnectDevice', verb: 'disconnected' },
        };
        if (!payload?.address) throw new Error('address is required');
        const { method, verb } = BT_COMMANDS[action];
        await bluetoothService[method](payload.address);
        resultMessage = `Device ${payload.address} ${verb}`;
        logger.info(`Bluetooth device ${verb}`, { source, deviceId, address: payload.address });
        break;
      }

      // --- Audio routing commands ---

      case 'audio:route:set': {
        const { stream = 'video', sink } = payload || {};
        if (!sink) throw new Error('sink is required');
        // Apply first to validate sink exists, THEN persist
        await audioRoutingService.applyRouting(stream, sink);
        await audioRoutingService.setStreamRoute(stream, sink);
        resultMessage = `Audio route set: ${stream} -> ${sink}`;
        logger.info('Audio route set', { source, deviceId, stream, sink });
        break;
      }

      // --- Lighting commands ---

      case 'lighting:scene:activate': {
        if (!payload?.sceneId) throw new Error('sceneId is required');
        await lightingService.activateScene(payload.sceneId);
        resultMessage = `Scene ${payload.sceneId} activated`;
        logger.info('Lighting scene activated', { source, deviceId, sceneId: payload.sceneId });
        break;
      }

      case 'lighting:scenes:refresh': {
        await lightingService.refreshScenes();
        resultMessage = 'Lighting scenes refreshed';
        logger.info('Lighting scenes refreshed', { source, deviceId });
        break;
      }

      // --- Sound commands ---

      case 'sound:play': {
        // Resolve routing target if not explicitly provided
        if (!payload.target) {
          const route = audioRoutingService.getStreamRoute('sound');
          if (route && route !== 'hdmi') {
            const sinks = await audioRoutingService.getAvailableSinks();
            const sink = sinks.find(s => s.name === route) || sinks.find(s => s.type === route);
            if (sink) {
              payload = { ...payload, target: sink.name };
            }
          }
        }
        const entry = soundService.play(payload);
        if (!entry) throw new Error(`Failed to play ${payload.file}`);
        resultData = entry;
        resultMessage = `Playing ${payload.file}`;
        logger.info('Sound play requested', { source, deviceId, file: payload.file, target: payload.target || 'default' });
        break;
      }

      case 'sound:stop': {
        soundService.stop(payload);
        resultMessage = payload.file ? `Stopped ${payload.file}` : 'Stopped all sounds';
        logger.info('Sound stop requested', { source, deviceId, file: payload.file });
        break;
      }

      // --- Cue commands ---

      case 'cue:fire': {
        if (!payload.cueId) throw new Error('cueId required');
        const cueEngineService = getCueEngine();
        await cueEngineService.fireCue(payload.cueId);
        resultMessage = `Cue fired: ${payload.cueId}`;
        logger.info('Cue fired', { source, deviceId, cueId: payload.cueId });
        break;
      }

      case 'cue:enable': {
        if (!payload.cueId) throw new Error('cueId required');
        const cueEngineService = getCueEngine();
        cueEngineService.enableCue(payload.cueId);
        resultMessage = `Cue enabled: ${payload.cueId}`;
        logger.info('Cue enabled', { source, deviceId, cueId: payload.cueId });
        break;
      }

      case 'cue:disable': {
        if (!payload.cueId) throw new Error('cueId required');
        const cueEngineService = getCueEngine();
        cueEngineService.disableCue(payload.cueId);
        resultMessage = `Cue disabled: ${payload.cueId}`;
        logger.info('Cue disabled', { source, deviceId, cueId: payload.cueId });
        break;
      }

      // --- Cue lifecycle commands (Phase 2) ---

      case 'cue:stop': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.stopCue(cueId);
        resultMessage = `Cue stopped: ${cueId}`;
        logger.info('Cue stopped', { source, deviceId, cueId });
        break;
      }

      case 'cue:pause': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.pauseCue(cueId);
        resultMessage = `Cue paused: ${cueId}`;
        logger.info('Cue paused', { source, deviceId, cueId });
        break;
      }

      case 'cue:resume': {
        const cueEngineService = getCueEngine();
        const { cueId } = payload;
        if (!cueId) throw new Error('cueId required');
        await cueEngineService.resumeCue(cueId);
        resultMessage = `Cue resumed: ${cueId}`;
        logger.info('Cue resumed', { source, deviceId, cueId });
        break;
      }

      case 'held:release': {
        const { heldId } = payload;
        if (!heldId) throw new Error('heldId required');
        if (heldId.startsWith('held-cue-')) {
          await getCueEngine().releaseCue(heldId);
        } else if (heldId.startsWith('held-video-')) {
          videoQueueService.releaseHeld(heldId);
        } else {
          throw new Error(`Unknown held item type: ${heldId}`);
        }
        resultMessage = `Held item released: ${heldId}`;
        logger.info('Held item released', { source, deviceId, heldId });
        break;
      }

      case 'held:discard': {
        const { heldId } = payload;
        if (!heldId) throw new Error('heldId required');
        if (heldId.startsWith('held-cue-')) {
          getCueEngine().discardCue(heldId);
        } else if (heldId.startsWith('held-video-')) {
          videoQueueService.discardHeld(heldId);
        } else {
          throw new Error(`Unknown held item type: ${heldId}`);
        }
        resultMessage = `Held item discarded: ${heldId}`;
        logger.info('Held item discarded', { source, deviceId, heldId });
        break;
      }

      case 'held:release-all': {
        const cueEngine = getCueEngine();
        for (const held of cueEngine.getHeldCues()) {
          await cueEngine.releaseCue(held.id);
        }
        for (const held of videoQueueService.getHeldVideos()) {
          videoQueueService.releaseHeld(held.id);
        }
        resultMessage = 'All held items released';
        logger.info('All held items released', { source, deviceId });
        break;
      }

      case 'held:discard-all': {
        const cueEngine = getCueEngine();
        for (const held of cueEngine.getHeldCues()) {
          cueEngine.discardCue(held.id);
        }
        for (const held of videoQueueService.getHeldVideos()) {
          videoQueueService.discardHeld(held.id);
        }
        resultMessage = 'All held items discarded';
        logger.info('All held items discarded', { source, deviceId });
        break;
      }

      // --- Spotify commands (Phase 2) ---

      case 'spotify:play':
      case 'spotify:pause':
      case 'spotify:stop':
      case 'spotify:next':
      case 'spotify:previous': {
        const method = SPOTIFY_TRANSPORT[action];
        await spotifyService[method]();
        resultMessage = `Spotify: ${method}`;
        logger.info(`Spotify ${method}`, { source, deviceId });
        break;
      }

      case 'spotify:playlist': {
        const { uri } = payload;
        if (!uri) throw new Error('uri required');
        await spotifyService.setPlaylist(uri);
        resultMessage = `Spotify playlist: ${uri}`;
        logger.info('Spotify playlist set', { source, deviceId, uri });
        break;
      }

      case 'spotify:volume': {
        const { volume } = payload;
        if (volume === undefined) throw new Error('volume required');
        await spotifyService.setVolume(volume);
        resultMessage = `Spotify volume: ${volume}`;
        logger.info('Spotify volume set', { source, deviceId, volume });
        break;
      }

      case 'spotify:cache:verify': {
        const status = await spotifyService.verifyCacheStatus();
        resultData = status;
        resultMessage = 'Cache verification complete';
        logger.info('Spotify cache verified', { source, deviceId, status: status.status });
        break;
      }

      // --- Service health check (Phase 3) ---

      case 'service:check': {
        const HEALTH_CHECKS = {
          vlc: () => require('./vlcMprisService').checkConnection(),
          spotify: () => spotifyService.checkConnection(),
          lighting: () => lightingService.checkConnection(),
          bluetooth: () => bluetoothService.isAvailable(),
          audio: () => audioRoutingService.checkHealth(),
          sound: () => soundService.checkHealth(),
          gameclock: () => true,
          cueengine: () => getCueEngine().checkHealth(),
        };

        const { serviceId } = payload;

        if (serviceId) {
          // Check single service
          const check = HEALTH_CHECKS[serviceId];
          if (!check) {
            throw new Error(`Unknown service: ${serviceId}`);
          }
          let checkResult;
          try {
            checkResult = await check();
          } catch {
            checkResult = false;
          }
          resultData = { [serviceId]: !!checkResult };
          resultMessage = `Health check: ${serviceId} = ${checkResult ? 'healthy' : 'down'}`;
        } else {
          // Check all services
          const results = {};
          for (const [id, check] of Object.entries(HEALTH_CHECKS)) {
            try {
              results[id] = !!(await check());
            } catch {
              results[id] = false;
            }
          }
          resultData = results;
          const healthy = Object.values(results).filter(Boolean).length;
          resultMessage = `Health check: ${healthy}/${Object.keys(results).length} services healthy`;
        }
        logger.info('Service health check', { source, deviceId, serviceId: serviceId || 'all', results: resultData });
        break;
      }

      // --- Audio volume control (Phase 2) ---

      case 'audio:volume:set': {
        const { stream, volume } = payload;
        if (!stream || volume === undefined) throw new Error('stream and volume required');
        await audioRoutingService.setStreamVolume(stream, volume);
        resultMessage = `Volume set: ${stream}=${volume}`;
        logger.info('Audio volume set', { source, deviceId, stream, volume });
        break;
      }

      default:
        return {
          success: false,
          message: `Unknown action: ${action}`,
          source
        };
    }

    return {
      success: true,
      message: resultMessage,
      data: resultData,
      source
    };
  } catch (error) {
    logger.error(`[executeCommand] ${action} failed`, { error: error.message, action, source });
    return {
      success: false,
      message: error.message,
      source
    };
  }
}

async function validateCommand(action, payload = {}) {
  const requiredService = SERVICE_DEPENDENCIES[action];
  const errors = [];

  // 1. Check service health
  if (requiredService && !registry.isHealthy(requiredService)) {
    errors.push({ type: 'service', service: requiredService, status: registry.getStatus(requiredService) });
  }

  // 2. Check resource existence
  switch (action) {
    case 'sound:play':
      if (!soundService.fileExists(payload.file))
        errors.push({ type: 'resource', message: `Sound file not found: ${payload.file}` });
      break;
    case 'video:queue:add':
      if (!videoQueueService.videoFileExists(payload.videoFile))
        errors.push({ type: 'resource', message: `Video file not found: ${payload.videoFile}` });
      break;
    case 'lighting:scene:activate':
      if (!lightingService.sceneExists(payload.sceneId))
        errors.push({ type: 'resource', message: `Scene not found: ${payload.sceneId}` });
      break;
    case 'audio:route:set':
      if (!audioRoutingService.sinkExists(payload.sink))
        errors.push({ type: 'resource', message: `Audio sink not found: ${payload.sink}` });
      break;
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { executeCommand, validateCommand, SERVICE_DEPENDENCIES };
