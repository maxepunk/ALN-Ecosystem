/**
 * Offline Queue Service
 * Manages queuing of transactions when system is offline
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const persistenceService = require('./persistenceService');

class OfflineQueueService extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.maxQueueSize = 100;
    this.isOffline = false;
    this.processingQueue = false;
  }

  /**
   * Initialize the service
   */
  async init() {
    try {
      // Load any persisted queue
      const persistedQueue = await persistenceService.load('offlineQueue');
      if (persistedQueue && Array.isArray(persistedQueue)) {
        this.queue = persistedQueue;
        logger.info('Loaded offline queue', { queueSize: this.queue.length });
      }
    } catch (error) {
      logger.error('Failed to load offline queue', error);
    }
  }

  /**
   * Add transaction to offline queue
   * @param {Object} transaction - Transaction to queue
   * @returns {boolean} - True if queued successfully
   */
  enqueue(transaction) {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn('Offline queue full', { maxSize: this.maxQueueSize });
      return false;
    }

    const queuedItem = {
      ...transaction,
      queuedAt: new Date().toISOString(),
      queueId: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.queue.push(queuedItem);
    this.persistQueue();
    
    logger.info('Transaction queued for offline processing', { 
      queueId: queuedItem.queueId,
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
    });

    this.emit('transaction:queued', queuedItem);
    return true;
  }

  /**
   * Process all queued transactions
   * @returns {Promise<Array>} - Processed transactions
   */
  async processQueue() {
    if (this.processingQueue || this.queue.length === 0) {
      return [];
    }

    this.processingQueue = true;
    const processed = [];
    const failed = [];

    logger.info('Processing offline queue', { queueSize: this.queue.length });

    try {
      const transactionService = require('./transactionService');
      const sessionService = require('./sessionService');
      const session = sessionService.getCurrentSession();

      if (!session) {
        logger.warn('Cannot process queue: no active session');
        this.processingQueue = false;
        return [];
      }

      // Process each queued item
      while (this.queue.length > 0) {
        const queuedItem = this.queue.shift();
        
        try {
          const result = await transactionService.processScan(queuedItem, session);
          processed.push({ ...result, queueId: queuedItem.queueId });
          
          logger.info('Processed queued transaction', {
            queueId: queuedItem.queueId,
            status: result.status,
          });
        } catch (error) {
          logger.error('Failed to process queued transaction', {
            queueId: queuedItem.queueId,
            error: error.message,
          });
          failed.push(queuedItem);
        }
      }

      // Re-queue failed items
      if (failed.length > 0) {
        this.queue.unshift(...failed);
        logger.warn('Re-queued failed transactions', { count: failed.length });
      }

      await this.persistQueue();
      this.emit('queue:processed', { processed, failed });

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
    this.queue = [];
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

    if (wasOffline && !offline) {
      // Coming back online - process queue
      logger.info('System back online, processing queued transactions');
      this.processQueue();
    } else if (!wasOffline && offline) {
      logger.warn('System going offline, transactions will be queued');
    }

    this.emit('status:changed', { offline });
  }

  /**
   * Persist queue to storage
   * @private
   */
  async persistQueue() {
    try {
      await persistenceService.save('offlineQueue', this.queue);
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
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      processingQueue: this.processingQueue,
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
    this.queue = [];
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