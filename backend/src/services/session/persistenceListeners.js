/**
 * Session persistence listeners (Phase 2 split: sessionService plumbing)
 *
 * sessionService owns ALL session persistence. These are the cross-service
 * listener bodies that persist transactionService events onto the current
 * session. They are registration functions over the sessionService instance
 * (the facade delegates) so systemReset.js / service-reset.js can re-wire
 * them after resets in the established order.
 *
 * Score notes (dual-ownership collapse): session.scores holds the live
 * TeamScore instances — transactionService mutates them in place BEFORE
 * emitting. Event teamScore payloads are broadcast snapshots; these
 * listeners only persist, they never sync snapshots back into the store.
 */

const logger = require('../../utils/logger');
const listenerRegistry = require('../../websocket/listenerRegistry');

/**
 * Listen for scores:reset to apply full-restart semantics to the session.
 * Decision A3 (2026-06-09): "Reset All Scores" = full game restart.
 * @param {Object} service - sessionService instance
 */
function setupScoreListeners(service) {
  // Lazy import to avoid circular dependency at module load time
  const transactionService = require('../transactionService');

  listenerRegistry.addTrackedListener(transactionService, 'scores:reset', async () => {
    if (!service.currentSession) {
      logger.warn('No session during scores:reset');
      return;
    }

    try {
      // The TeamScore instances in session.scores (the single canonical
      // store) were already zeroed in place by transactionService.resetScores()
      // before this event fired — nothing to sync here (F-BCORE-02 class of
      // bug is structurally gone with the dual-store collapse).

      // Decision A3: clear transaction history (F-BCORE-04: a later
      // transaction:delete rebuild must not resurrect pre-reset scores)
      // and dedup state so tokens become claimable again.
      // playerScans are intel-tracking, not points — intentionally kept.
      service.currentSession.transactions = [];
      service.currentSession.metadata.totalScans = 0;
      service.currentSession.metadata.uniqueTokensScanned = [];
      service.currentSession.metadata.scannedTokensByDevice = {};

      await service.saveCurrentSession();
      service.emit('session:updated', service.currentSession);

      logger.info('Session reset (scores zeroed, transactions and dedup state cleared)', {
        sessionId: service.currentSession.id,
        teamsReset: service.currentSession.scores.map(s => s.teamId)
      });
    } catch (error) {
      logger.error('Failed to reset session scores', { error: error.message });
    }
  }, 'sessionService->transactionService:scores:reset');

  logger.debug('SessionService: score listeners bound to transactionService');
}

/**
 * Persistence listeners for the event architecture: transaction:accepted,
 * score:adjusted, transaction:deleted. The SINGLE RESPONSIBILITY owner for
 * session persistence.
 * @param {Object} service - sessionService instance
 */
function setupPersistenceListeners(service) {
  // Lazy import to avoid circular dependency at module load time
  const transactionService = require('../transactionService');

  // Listen for transaction:accepted (single event per transaction, includes teamScore)
  listenerRegistry.addTrackedListener(transactionService, 'transaction:accepted',
    async (payload) => {
      // Handle both old format (Transaction object) and new format (payload with teamScore)
      // OLD: transaction object directly
      // NEW: { transaction, teamScore, deviceTracking, groupBonus }
      const transaction = payload.transaction || payload;
      const deviceTracking = payload.deviceTracking;

      if (!service.currentSession) {
        logger.warn('No session during transaction:accepted - cannot persist', {
          transactionId: transaction.id
        });
        return;
      }

      try {
        // Only add transaction if this is new format (callers no longer add directly)
        // The new format includes teamScore, old format doesn't
        if (payload.teamScore !== undefined) {
          // NEW FORMAT: Full event-driven persistence
          // Add transaction to session (idempotent - Session.addTransaction checks for duplicates)
          const txData = transaction.toJSON ? transaction.toJSON() : transaction;
          service.currentSession.addTransaction(txData);

          // Update device tracking for duplicate detection
          if (deviceTracking) {
            service.currentSession.addDeviceScannedToken(deviceTracking.deviceId, deviceTracking.tokenId);
          }

          // No score sync needed: transactionService already mutated the
          // live TeamScore instance in session.scores (the canonical store).
          // payload.teamScore is a snapshot for broadcast consumers only.

          await service.saveCurrentSession();

          // Emit transaction:added for broadcasts.js to broadcast transaction:new
          service.emit('transaction:added', txData);
          service.emit('session:updated', service.currentSession);

          logger.debug('Persisted transaction via new event flow', {
            transactionId: transaction.id,
            teamId: transaction.teamId,
            hasTeamScore: !!payload.teamScore
          });
        }
        // OLD FORMAT: transaction object only - callers still handle persistence
        // Don't duplicate the save, just log for debugging
      } catch (error) {
        logger.error('Failed to persist transaction', {
          error: error.message,
          transactionId: transaction.id
        });
      }
    }, 'sessionService->transactionService:transaction:accepted');

  // Listen for score:adjusted (admin-only score changes)
  listenerRegistry.addTrackedListener(transactionService, 'score:adjusted',
    async (payload) => {
      if (!service.currentSession) {
        logger.warn('No session during score:adjusted');
        return;
      }

      const { teamScore, reason, isAdminAction } = payload;
      if (!teamScore) {
        logger.warn('score:adjusted received without teamScore');
        return;
      }

      try {
        // The adjustment already mutated the live TeamScore instance in
        // session.scores (canonical store) — this listener only persists.
        await service.saveCurrentSession();
        service.emit('session:updated', service.currentSession);

        logger.info('Persisted admin score adjustment', {
          teamId: teamScore.teamId,
          reason,
          isAdminAction
        });
      } catch (error) {
        logger.error('Failed to persist score adjustment', {
          error: error.message,
          teamId: teamScore?.teamId
        });
      }
    }, 'sessionService->transactionService:score:adjusted');

  // Listen for transaction:deleted (includes updatedTeamScore snapshot)
  listenerRegistry.addTrackedListener(transactionService, 'transaction:deleted',
    async (payload) => {
      if (!service.currentSession) {
        logger.warn('No session during transaction:deleted');
        return;
      }

      const { transactionId, tokenId, teamId, updatedTeamScore } = payload;

      try {
        // Transaction already removed and scores already rebuilt in place
        // on session.scores (canonical store) by deleteTransaction() —
        // this listener only persists. (The old per-team upsert dance and
        // its F-BCORE-03 desync class are structurally gone.)
        await service.saveCurrentSession();
        service.emit('session:updated', service.currentSession);

        logger.info('Persisted transaction deletion', {
          transactionId,
          tokenId,
          teamId,
          hasUpdatedScore: !!updatedTeamScore
        });
      } catch (error) {
        logger.error('Failed to persist transaction deletion', {
          error: error.message,
          transactionId
        });
      }
    }, 'sessionService->transactionService:transaction:deleted');

  logger.debug('SessionService: persistence listeners bound to transactionService');
}

module.exports = { setupScoreListeners, setupPersistenceListeners };
