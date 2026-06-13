/**
 * Session content registry (Phase 2 split: sessionService content mutations)
 *
 * Team / device / scan additions to the current session — neither lifecycle
 * (create/start/pause/end) nor persistence policy. Functions over the
 * sessionService instance; the facade delegates.
 */

const logger = require('../../utils/logger');

/**
 * Add a new team to the current session mid-game.
 * Single source of truth for team creation — all teams MUST be created here.
 * @param {Object} service - sessionService instance
 * @param {string} teamId - The team identifier (any non-empty string)
 * @returns {Promise<Object>} The created TeamScore instance
 */
async function addTeamToSession(service, teamId) {
  if (!service.currentSession) {
    throw new Error('No active session');
  }

  // Trim and normalize team ID
  const normalizedTeamId = teamId.trim();

  // Check for duplicate team
  const existingTeam = service.currentSession.scores.find(s => s.teamId === normalizedTeamId);
  if (existingTeam) {
    throw new Error(`Team "${teamId}" already exists in session`);
  }

  // Create new team score using the TeamScore model
  const TeamScore = require('../../models/teamScore');
  const newTeamScore = TeamScore.createInitial(normalizedTeamId);

  // Add the live instance to session.scores (the single canonical store —
  // transactionService reads and mutates it directly, no sync step)
  service.currentSession.scores.push(newTeamScore);

  // Persist and broadcast
  await service.saveCurrentSession();
  service.emit('session:updated', service.getCurrentSession());

  logger.info('Team added to session', {
    teamId: normalizedTeamId,
    sessionId: service.currentSession.id
  });

  return newTeamScore;
}

/**
 * Add transaction to current session.
 * @param {Object} service - sessionService instance
 * @param {Object} transaction - Transaction to add
 * @returns {Promise<Object>} The added transaction
 */
async function addTransaction(service, transaction) {
  if (!service.currentSession) {
    throw new Error('No active session');
  }

  service.currentSession.addTransaction(transaction);
  await service.saveCurrentSession();
  service.emit('transaction:added', transaction);
  return transaction;
}

/**
 * Add a player scan to current session (token discovery tracking, no scoring).
 * @param {Object} service - sessionService instance
 * @param {Object} scanData - Player scan data
 * @returns {Promise<Object>} The created player scan record
 */
async function addPlayerScan(service, scanData) {
  if (!service.currentSession) {
    throw new Error('No active session');
  }

  const playerScan = service.currentSession.addPlayerScan(scanData);
  await service.saveCurrentSession();

  logger.info('Player scan recorded', {
    sessionId: service.currentSession.id,
    scanId: playerScan.id,
    tokenId: scanData.tokenId,
    deviceId: scanData.deviceId,
    playerScanCount: service.currentSession.playerScans.length
  });

  // Emit event for broadcasts.js to handle WebSocket notification
  service.emit('player-scan:added', playerScan);

  return playerScan;
}

/**
 * Update device in current session.
 * @param {Object} service - sessionService instance
 * @param {Object} device - Device to update
 * @returns {Promise<void>}
 */
async function updateDevice(service, device) {
  if (!service.currentSession) {
    throw new Error('No active session');
  }

  const { isNew, isReconnection } = service.currentSession.updateDevice(device);
  await service.saveCurrentSession();
  service.emit('device:updated', { device, isNew, isReconnection });
}

/**
 * Remove device from current session.
 * @param {Object} service - sessionService instance
 * @param {string} deviceId - Device ID to remove
 * @returns {Promise<void>}
 */
async function removeDevice(service, deviceId) {
  if (!service.currentSession) {
    return;
  }

  service.currentSession.removeDevice(deviceId);
  await service.saveCurrentSession();
  service.emit('device:removed', deviceId);
}

module.exports = {
  addTeamToSession,
  addTransaction,
  addPlayerScan,
  updateDevice,
  removeDevice,
};
