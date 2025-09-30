/**
 * Transaction Model
 * Records each player scanning action in the game
 */

const { v4: uuidv4 } = require('uuid');
const { transactionSchema, validate } = require('../utils/validators');

class Transaction {
  /**
   * Create a new Transaction instance
   * @param {Object} data - Transaction data
   */
  constructor(data = {}) {
    // Generate ID if not provided
    if (!data.id) {
      data.id = uuidv4();
    }

    // Set timestamp if not provided
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    // Default status to accepted if not provided
    if (!data.status) {
      data.status = 'accepted';
    }

    // Default points to 0 if not provided
    if (data.points === undefined) {
      data.points = 0;
    }

    this.validate(data);
    Object.assign(this, data);
  }

  /**
   * Validate transaction data
   * @param {Object} data - Transaction data to validate
   * @throws {ValidationError} If validation fails
   */
  validate(data) {
    const validated = validate(data, transactionSchema);
    return validated;
  }

  /**
   * Check if transaction was accepted
   * @returns {boolean}
   */
  isAccepted() {
    return this.status === 'accepted';
  }

  /**
   * Check if transaction was rejected
   * @returns {boolean}
   */
  isRejected() {
    return this.status === 'rejected';
  }

  /**
   * Check if transaction is duplicate
   * @returns {boolean}
   */
  isDuplicate() {
    return this.status === 'duplicate';
  }

  /**
   * Accept the transaction
   * @param {number} points - Points to award
   */
  accept(points) {
    this.status = 'accepted';
    this.points = points || 0;
    this.rejectionReason = null;
  }

  /**
   * Reject the transaction
   * @param {string} reason - Reason for rejection
   */
  reject(reason) {
    this.status = 'rejected';
    this.points = 0;
    this.rejectionReason = reason;
  }

  /**
   * Mark as duplicate
   * @param {string} originalTransactionId - ID of original transaction
   */
  markAsDuplicate(originalTransactionId) {
    this.status = 'duplicate';
    this.points = 0;
    this.originalTransactionId = originalTransactionId;
    this.rejectionReason = `Duplicate of transaction ${originalTransactionId}`;
  }

  /**
   * Convert to JSON representation
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      tokenId: this.tokenId,
      teamId: this.teamId,
      scannerId: this.scannerId,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      status: this.status,
      rejectionReason: this.rejectionReason || null,
      points: this.points,
      originalTransactionId: this.originalTransactionId || null,
    };
  }

  /**
   * Create Transaction from JSON data
   * @param {Object} json - JSON data
   * @returns {Transaction}
   */
  static fromJSON(json) {
    return new Transaction(json);
  }

  /**
   * Create Transaction from scan request
   * @param {Object} scanRequest - Scan request data
   * @param {string} sessionId - Current session ID
   * @returns {Transaction}
   */
  static fromScanRequest(scanRequest, sessionId) {
    return new Transaction({
      id: scanRequest.id, // Use provided ID if available
      tokenId: scanRequest.tokenId,
      teamId: scanRequest.teamId,
      scannerId: scanRequest.scannerId,
      stationMode: scanRequest.stationMode || 'blackmarket', // Track game mode
      timestamp: scanRequest.timestamp || new Date().toISOString(),
      sessionId: sessionId,
      status: 'accepted',
      points: 0, // Will be set by transaction service
    });
  }

  /**
   * Check if this transaction is within duplicate window of another
   * @param {Transaction} other - Other transaction to compare
   * @param {number} windowSeconds - Duplicate window in seconds
   * @returns {boolean}
   */
  isWithinDuplicateWindow(other, windowSeconds = 5) {
    if (this.tokenId !== other.tokenId || this.sessionId !== other.sessionId) {
      return false;
    }

    const thisTime = new Date(this.timestamp).getTime();
    const otherTime = new Date(other.timestamp).getTime();
    const diffSeconds = Math.abs(thisTime - otherTime) / 1000;

    return diffSeconds <= windowSeconds;
  }
}

module.exports = Transaction;