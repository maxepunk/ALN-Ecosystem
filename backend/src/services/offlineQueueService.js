/**
 * Offline Queue Service
 * Manages queuing of GM transactions when the system is flagged offline.
 *
 * SCOPE (D2, 2026-06-09): the player-scan queue and the HTTP 202
 * "queued for processing" acceptance path were DELETED. The drain never
 * persisted player scans (F-SCAN-04) and no production code ever set the
 * offline flag. Player scanners own offline queueing client-side and
 * replay via POST /api/scan/batch.
 *
 * The GM-transaction queue remains: adminEvents.js enqueues transaction:submit
 * payloads while isOffline is true and processQueue() re-processes them
 * through transactionService.processScan() when the flag clears. Note that
 * nothing in production currently sets isOffline — this path is reachable
 * only via setOfflineStatus() (tests).
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const transactionService = require('./transactionService');
const sessionService = require('./sessionService');

// Track instances for debugging
let instanceCount = 0;

class OfflineQueueService extends EventEmitter {
  constructor() {
    super();
    this.gmTransactionQueue = [];  // GM scoring transactions
    this.maxQueueSize = 100;
    this.isOffline = false;
    this.processingQueue = false;
    this.instanceId = ++instanceCount;
  }

  /**
   * Initialize the service
   */
  async init() {
    try {
      // Load persisted queue
      const persistedData = await persistenceService.load('offlineQueue');
      if (persistedData?.gmTransactions && Array.isArray(persistedData.gmTransactions)) {
        this.gmTransactionQueue = persistedData.gmTransactions;
        logger.info('Loaded offline GM transaction queue', {
          gmTransactions: this.gmTransactionQueue.length
        });
      }
    } catch (error) {
      logger.error('Failed to load offline queue', error);
    }
  }

  /**
   * Add GM transaction to offline queue for scoring
   * @param {Object} transaction - GM transaction to queue
   * @returns {Object|null} - Queued item with IDs if successful, null if queue is full
   */
  enqueueGmTransaction(transaction) {
    if (this.gmTransactionQueue.length >= this.maxQueueSize) {
      logger.warn('GM transaction queue full', { maxSize: this.maxQueueSize });
      return null;
    }

    const { v4: uuidv4 } = require('uuid');
    const queuedItem = {
      ...transaction,
      queuedAt: new Date().toISOString(),
      queueId: `gm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: transaction.transactionId || uuidv4(),
    };

    this.gmTransactionQueue.push(queuedItem);
    this.persistQueue();

    logger.info('GM transaction queued for offline processing', {
      queueId: queuedItem.queueId,
      transactionId: queuedItem.transactionId,
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
    });

    this.emit('transaction:queued', queuedItem);
    return queuedItem;
  }

  /**
   * Process all queued GM transactions
   * @returns {Promise<Array>} - Processed transactions
   */
  async processQueue() {
    if (this.processingQueue || this.gmTransactionQueue.length === 0) {
      return [];
    }

    this.processingQueue = true;
    const processed = [];
    const failed = [];

    logger.info('Processing offline GM transaction queue', {
      gmTransactions: this.gmTransactionQueue.length
    });

    try {
      // Process GM transactions (actual scoring)
      const session = sessionService.getCurrentSession();
      if (!session || !session.isActive()) {
        // ACTIVE-only (merge-readiness review minor): GM transactions are
        // rejected during paused/setup sessions, so draining the queue then
        // would consume scans and report them 'processed' while the game
        // never scored them. Keep them queued until the session is active.
        logger.warn('Cannot process GM transactions: session not active', {
          sessionStatus: session ? session.status : 'none',
        });
      } else {
        while (this.gmTransactionQueue.length > 0) {
          const gmTransaction = this.gmTransactionQueue.shift();

          try {
            // Preserve the transaction ID
            const scanWithId = {
              ...gmTransaction,
              id: gmTransaction.transactionId
            };

            // Slice 5: Session param removed - processScan gets session internally
            // Event-driven persistence handles transaction storage via transaction:accepted
            const result = await transactionService.processScan(scanWithId);

            // Normalize to contract: status must be 'processed' or 'failed'
            processed.push({
              type: 'gm_transaction',
              transactionId: result.transactionId || gmTransaction.transactionId,
              status: 'processed',  // AsyncAPI contract: "processed" | "failed"
              error: null,
              queueId: gmTransaction.queueId,
              // Include original transaction result for internal tracking
              transactionStatus: result.status,  // 'accepted', 'duplicate', etc.
              tokenId: result.tokenId || gmTransaction.tokenId,
              teamId: gmTransaction.teamId,
              points: result.points || 0
            });

            logger.info('Processed queued GM transaction', {
              queueId: gmTransaction.queueId,
              status: result.status,
              transactionId: result.transactionId
            });
          } catch (error) {
            logger.error('Failed to process queued GM transaction', {
              queueId: gmTransaction.queueId,
              error: error.message,
            });
            failed.push(gmTransaction);
          }
        }
      }

      // Re-queue failed items
      if (failed.length > 0) {
        failed.forEach(item => this.gmTransactionQueue.unshift(item));
        logger.warn('Re-queued failed items', { count: failed.length });
      }

      await this.persistQueue();

      // Emit offline:queue:processed event per AsyncAPI contract (wrapped envelope)
      this.emit('offline:queue:processed', {
        event: 'offline:queue:processed',
        data: {
          queueSize: processed.length,
          results: processed  // Pass through normalized results with all fields
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Emitted offline:queue:processed event', {
        queueSize: processed.length,
        failed: failed.length
      });

    } catch (error) {
      logger.error('Queue processing error', error);
    } finally {
      this.processingQueue = false;
    }

    return processed;
  }

  /**
   * Clear the queue
   */
  async clearQueue() {
    this.gmTransactionQueue = [];
    await this.persistQueue();
    this.emit('queue:cleared');
    logger.info('Offline queue cleared');
  }

  /**
   * Set offline status
   * @param {boolean} offline - Whether system is offline
   */
  setOfflineStatus(offline) {
    const wasOffline = this.isOffline;
    this.isOffline = offline;

    // Only process and emit if status actually changed
    if (wasOffline !== offline) {
      logger.info('Offline status changed', {
        wasOffline,
        isOffline: offline,
        instanceId: this.instanceId
      });

      if (wasOffline && !offline) {
        // Coming back online - process queue
        logger.info('System back online, processing queued transactions', {
          gmQueueSize: this.gmTransactionQueue.length
        });
        // Process queue asynchronously - don't await to avoid blocking
        setImmediate(async () => {
          try {
            await this.processQueue();
          } catch (error) {
            logger.error('Failed to process offline queue', error);
          }
        });
      } else if (!wasOffline && offline) {
        logger.warn('System going offline, transactions will be queued');
      }

      this.emit('status:changed', { offline });
    }
  }

  /**
   * Persist queue to storage
   * @private
   */
  async persistQueue() {
    try {
      await persistenceService.save('offlineQueue', {
        gmTransactions: this.gmTransactionQueue
      });
    } catch (error) {
      logger.error('Failed to persist offline queue', error);
    }
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      isOffline: this.isOffline,
      gmQueueSize: this.gmTransactionQueue.length,
      maxQueueSize: this.maxQueueSize,
      processingQueue: this.processingQueue,
      instanceId: this.instanceId,
    };
  }

  /**
   * Reset service state (for testing)
   * @returns {Promise<void>}
   */
  async reset() {
    // 1. Clear timers/intervals FIRST (none in this service)

    // 2. Remove all listeners
    this.removeAllListeners();

    // 3. Reset state
    this.gmTransactionQueue = [];
    this.isOffline = false;
    this.processingQueue = false;

    // Clear persisted queue
    await persistenceService.delete('offlineQueue');

    // 4. Log completion
    logger.info('Offline queue service reset');
  }
}

// Export singleton instance
module.exports = new OfflineQueueService();

// Export resetForTests method
module.exports.resetForTests = () => module.exports.reset();
