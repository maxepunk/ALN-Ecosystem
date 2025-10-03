/**
 * Offline Queue Service
 * Manages queuing of transactions when system is offline
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');
const transactionService = require('./transactionService');
const sessionService = require('./sessionService');
// NOTE: stateService removed - no longer called directly (aggregator pattern)
// stateService will listen to 'offline:queue:processed' event instead

// Track instances for debugging
let instanceCount = 0;

class OfflineQueueService extends EventEmitter {
  constructor() {
    super();
    this.playerScanQueue = [];  // Player scan logs
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
      // Load persisted queues
      const persistedData = await persistenceService.load('offlineQueue');
      if (persistedData) {
        // Handle new format with separate queues
        if (persistedData.playerScans && Array.isArray(persistedData.playerScans)) {
          this.playerScanQueue = persistedData.playerScans;
        }
        if (persistedData.gmTransactions && Array.isArray(persistedData.gmTransactions)) {
          this.gmTransactionQueue = persistedData.gmTransactions;
        }
        logger.info('Loaded offline queues', {
          playerScans: this.playerScanQueue.length,
          gmTransactions: this.gmTransactionQueue.length
        });
      } else if (Array.isArray(persistedData)) {
        // Handle legacy format (old single queue)
        // Migrate old queue items to player scan queue for backward compatibility
        this.playerScanQueue = persistedData;
        logger.info('Migrated legacy offline queue to player scan queue', {
          queueSize: this.playerScanQueue.length
        });
      }
    } catch (error) {
      logger.error('Failed to load offline queues', error);
    }
  }

  /**
   * Add transaction to offline queue
   * @param {Object} transaction - Transaction to queue
   * @returns {Object|null} - Queued item with IDs if successful, null if queue is full
   */
  enqueue(scanLog) {
    if (this.playerScanQueue.length >= this.maxQueueSize) {
      logger.warn('Player scan queue full', { maxSize: this.maxQueueSize });
      return null;
    }

    const { v4: uuidv4 } = require('uuid');
    const queuedItem = {
      ...scanLog,
      queuedAt: new Date().toISOString(),
      queueId: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: scanLog.transactionId || uuidv4(), // Keep for compatibility
    };

    this.playerScanQueue.push(queuedItem);
    this.persistQueue();

    logger.info('Player scan queued for offline logging', {
      queueId: queuedItem.queueId,
      tokenId: scanLog.tokenId,
      deviceId: scanLog.deviceId,
    });

    this.emit('scan:queued', queuedItem);
    return queuedItem;
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
   * Process all queued transactions
   * @returns {Promise<Array>} - Processed transactions
   */
  async processQueue() {
    if (this.processingQueue || (this.playerScanQueue.length === 0 && this.gmTransactionQueue.length === 0)) {
      return [];
    }

    this.processingQueue = true;
    const processed = [];
    const failed = [];

    logger.info('Processing offline queues', {
      playerScans: this.playerScanQueue.length,
      gmTransactions: this.gmTransactionQueue.length
    });

    try {
      // Process player scan logs (just log them, no scoring)
      while (this.playerScanQueue.length > 0) {
        const scanLog = this.playerScanQueue.shift();

        try {
          logger.info('Processing queued player scan log', {
            queueId: scanLog.queueId,
            tokenId: scanLog.tokenId,
            deviceId: scanLog.deviceId,
            timestamp: scanLog.timestamp
          });

          processed.push({
            type: 'player_scan',
            queueId: scanLog.queueId,
            tokenId: scanLog.tokenId,
            transactionId: scanLog.transactionId,
            status: 'logged',
            message: 'Scan log synced'
          });

          this.emit('scan:logged', scanLog);
        } catch (error) {
          logger.error('Failed to process queued scan log', {
            queueId: scanLog.queueId,
            error: error.message,
          });
          failed.push(scanLog);
        }
      }

      // Process GM transactions (actual scoring)
      const session = sessionService.getCurrentSession();
      if (this.gmTransactionQueue.length > 0 && !session) {
        logger.warn('Cannot process GM transactions: no active session');
        // Keep GM transactions in queue for later
      } else {
        while (this.gmTransactionQueue.length > 0) {
          const gmTransaction = this.gmTransactionQueue.shift();

          try {
            // Preserve the transaction ID
            const scanWithId = {
              ...gmTransaction,
              id: gmTransaction.transactionId
            };

            const result = await transactionService.processScan(scanWithId, session);

            // Add to session for state updates
            if (result.transaction && result.status === 'accepted') {
              logger.info('Adding transaction to session', {
                transactionId: result.transaction.id,
                tokenId: result.transaction.tokenId
              });
              await sessionService.addTransaction(result.transaction);
            } else {
              logger.warn('Not adding transaction to session', {
                hasTransaction: !!result.transaction,
                status: result.status
              });
            }

            processed.push({
              type: 'gm_transaction',
              ...result,
              queueId: gmTransaction.queueId
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

      // Re-queue failed items to their appropriate queues
      if (failed.length > 0) {
        failed.forEach(item => {
          if (item.queueId?.startsWith('scan_')) {
            this.playerScanQueue.unshift(item);
          } else if (item.queueId?.startsWith('gm_')) {
            this.gmTransactionQueue.unshift(item);
          }
        });
        logger.warn('Re-queued failed items', { count: failed.length });
      }

      await this.persistQueue();

      // Emit offline:queue:processed event per AsyncAPI contract (wrapped envelope)
      // stateService will listen to this and emit sync:full with updated state
      this.emit('offline:queue:processed', {
        event: 'offline:queue:processed',
        data: {
          queueSize: processed.length,
          results: processed.map(item => ({
            transactionId: item.transactionId || item.id,
            status: item.status === 'failed' ? 'failed' : 'processed'
          }))
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
   * Get current queue size
   * @returns {number} - Number of queued transactions
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  async clearQueue() {
    this.playerScanQueue = [];
    this.gmTransactionQueue = [];
    await this.persistQueue();
    this.emit('queue:cleared');
    logger.info('Offline queues cleared');
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
          playerQueueSize: this.playerScanQueue.length,
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
        playerScans: this.playerScanQueue,
        gmTransactions: this.gmTransactionQueue
      });
    } catch (error) {
      logger.error('Failed to persist offline queues', error);
    }
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      isOffline: this.isOffline,
      playerQueueSize: this.playerScanQueue.length,
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
    this.playerScanQueue = [];
    this.gmTransactionQueue = [];
    this.isOffline = false;
    this.processingQueue = false;

    // Clear persisted queue if in test mode
    if (process.env.NODE_ENV === 'test') {
      await persistenceService.delete('offlineQueue');
    }

    // 4. Log completion
    logger.info('Offline queue service reset');
  }
}

// Export singleton instance
module.exports = new OfflineQueueService();

// Export resetForTests method
module.exports.resetForTests = () => module.exports.reset();