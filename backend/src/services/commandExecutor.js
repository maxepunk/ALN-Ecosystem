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
const vlcService = require('./vlcService');
const displayControlService = require('./displayControlService');
const bluetoothService = require('./bluetoothService');
const audioRoutingService = require('./audioRoutingService');
const lightingService = require('./lightingService');

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
 * @returns {Promise<{success: boolean, message: string, data?: any, source: string, broadcasts?: Array}>}
 */
async function executeCommand({ action, payload = {}, source = 'gm', trigger, deviceId, deviceType }) {
  logger.info(`[executeCommand] action=${action} source=${source}${trigger ? ` trigger=${trigger}` : ''}`);

  try {
    let resultMessage = '';
    let resultData = null;
    const broadcasts = []; // Array of {event, data, target} for caller to emit

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
        // Resume/play current video
        if (config.features.videoPlayback) {
          await vlcService.resume();
        }
        resultMessage = 'Video playback resumed';
        logger.info('Video playback resumed', { source, deviceId });
        break;

      case 'video:pause':
        // Pause current video
        if (config.features.videoPlayback) {
          await vlcService.pause();
        }
        resultMessage = 'Video playback paused';
        logger.info('Video playback paused', { source, deviceId });
        break;

      case 'video:stop':
        // Stop current video
        if (config.features.videoPlayback) {
          await vlcService.stop();
        }
        resultMessage = 'Video playback stopped';
        logger.info('Video playback stopped', { source, deviceId });
        break;

      case 'video:skip':
        videoQueueService.skipCurrent();
        // Broadcast video:skipped event
        broadcasts.push({
          event: 'video:skipped',
          data: { gmStation: deviceId },
          target: 'all'
        });
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

      case 'display:idle-loop': {
        // Switch display to idle loop mode
        const idleResult = await displayControlService.setIdleLoop();
        if (idleResult.success) {
          const eventData = {
            mode: 'IDLE_LOOP',
            changedBy: deviceId
          };
          // Broadcast to all clients
          broadcasts.push({
            event: 'display:mode',
            data: eventData,
            target: 'all'
          });
          resultData = eventData;
          resultMessage = 'Display switched to idle loop';
        } else {
          throw new Error(idleResult.error || 'Failed to switch to idle loop');
        }
        logger.info('Display set to idle loop', { source, deviceId });
        break;
      }

      case 'display:scoreboard': {
        // Switch display to scoreboard mode
        const scoreboardResult = await displayControlService.setScoreboard();
        if (scoreboardResult.success) {
          const eventData = {
            mode: 'SCOREBOARD',
            changedBy: deviceId
          };
          // Broadcast to all clients
          broadcasts.push({
            event: 'display:mode',
            data: eventData,
            target: 'all'
          });
          resultData = eventData;
          resultMessage = 'Display switched to scoreboard';
        } else {
          throw new Error(scoreboardResult.error || 'Failed to switch to scoreboard');
        }
        logger.info('Display set to scoreboard', { source, deviceId });
        break;
      }

      case 'display:toggle': {
        // Toggle between idle loop and scoreboard modes
        const toggleResult = await displayControlService.toggleMode();
        if (toggleResult.success) {
          const eventData = {
            mode: toggleResult.mode,
            changedBy: deviceId
          };
          // Broadcast to all clients
          broadcasts.push({
            event: 'display:mode',
            data: eventData,
            target: 'all'
          });
          resultData = eventData;
          resultMessage = `Display toggled to ${toggleResult.mode.toLowerCase()}`;
        } else {
          throw new Error(toggleResult.error || 'Failed to toggle display mode');
        }
        logger.info('Display toggled', { source, deviceId, newMode: toggleResult.mode });
        break;
      }

      case 'display:status': {
        // Get current display mode status
        const displayStatus = displayControlService.getStatus();
        // Caller should emit this directly to requesting socket only
        broadcasts.push({
          event: 'display:status',
          data: displayStatus,
          target: 'socket'
        });
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
        const txData = payload;
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
          'bluetooth:pair':       { method: 'pairDevice',       verb: 'paired' },
          'bluetooth:unpair':     { method: 'unpairDevice',     verb: 'unpaired' },
          'bluetooth:connect':    { method: 'connectDevice',    verb: 'connected' },
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
        await audioRoutingService.setStreamRoute(stream, sink);
        await audioRoutingService.applyRouting(stream);
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
        const soundService = require('./soundService');
        const entry = soundService.play(payload);
        if (!entry) {
          return { success: false, message: `Failed to play ${payload.file}`, source };
        }
        resultData = entry;
        resultMessage = `Playing ${payload.file}`;
        logger.info('Sound play requested', { source, deviceId, file: payload.file });
        break;
      }

      case 'sound:stop': {
        const soundService = require('./soundService');
        soundService.stop(payload);
        resultMessage = payload.file ? `Stopped ${payload.file}` : 'Stopped all sounds';
        logger.info('Sound stop requested', { source, deviceId, file: payload.file });
        break;
      }

      // --- Cue commands ---

      case 'cue:fire': {
        const cueEngineService = require('./cueEngineService');
        await cueEngineService.fireCue(payload.cueId);
        resultMessage = `Cue fired: ${payload.cueId}`;
        logger.info('Cue fired', { source, deviceId, cueId: payload.cueId });
        break;
      }

      case 'cue:enable': {
        const cueEngineService = require('./cueEngineService');
        cueEngineService.enableCue(payload.cueId);
        resultMessage = `Cue enabled: ${payload.cueId}`;
        logger.info('Cue enabled', { source, deviceId, cueId: payload.cueId });
        break;
      }

      case 'cue:disable': {
        const cueEngineService = require('./cueEngineService');
        cueEngineService.disableCue(payload.cueId);
        resultMessage = `Cue disabled: ${payload.cueId}`;
        logger.info('Cue disabled', { source, deviceId, cueId: payload.cueId });
        break;
      }

      // cue:stop, cue:pause, cue:resume — stub for Phase 1, full implementation in Phase 2
      case 'cue:stop':
      case 'cue:pause':
      case 'cue:resume':
        return {
          success: false,
          message: `${action} not yet implemented (Phase 2: compound cues)`,
          source
        };

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
      source,
      broadcasts
    };
  } catch (error) {
    logger.error(`[executeCommand] ${action} failed:`, error.message);
    return {
      success: false,
      message: error.message,
      source
    };
  }
}

module.exports = { executeCommand };
