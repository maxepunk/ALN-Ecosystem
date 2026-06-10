/**
 * Scan response shaping (wire-format concern, Phase 2 extraction)
 *
 * Builds the scan-result payload returned by transactionService.processScan
 * and forwarded to scanners as transaction:result (adminEvents) or the HTTP
 * scan response. Pure: takes the video status as plain values — the caller
 * (transactionService) injects videoQueueService state.
 */

/**
 * Human-readable result message for a processed transaction.
 * @param {Object} transaction - Processed transaction (model instance)
 * @param {string} [claimedBy] - Team that originally claimed the token (A7)
 * @returns {string}
 */
function responseMessage(transaction, claimedBy) {
  if (transaction.isAccepted()) {
    return `Token scanned successfully. ${transaction.points} points awarded.`;
  } else if (transaction.isDuplicate()) {
    if (claimedBy) {
      return `Token already claimed by ${claimedBy}`;
    }
    return 'Token already claimed';
  } else if (transaction.isRejected()) {
    return transaction.rejectionReason || 'Scan rejected.';
  }
  return 'Scan processed.';
}

/**
 * Build the full scan response payload.
 * @param {Object} args
 * @param {Object} args.transaction - Processed transaction (model instance)
 * @param {Object|null} args.token - Token, when found
 * @param {boolean} args.videoPlaying - Is a video currently playing
 * @param {number} [args.waitTime] - Remaining video time (when playing)
 * @param {Object} [args.extras] - Extra response fields (e.g. claimedBy)
 * @returns {Object} Scan response
 */
function buildScanResponse({ transaction, token, videoPlaying, waitTime, extras = {} }) {
  const response = {
    status: transaction.status,
    message: responseMessage(transaction, extras.claimedBy),
    transactionId: transaction.id,
    transaction: transaction, // Include the transaction object
    token: token, // Include the token for reference
  };

  // Add points if accepted
  if (transaction.isAccepted()) {
    response.points = transaction.points;
  }

  // Add original transaction ID if this is a duplicate
  if (transaction.isDuplicate()) {
    response.originalTransactionId = transaction.originalTransactionId;
    // Include which team claimed the token first
    if (extras.claimedBy) {
      response.claimedBy = extras.claimedBy;
    }
  }

  // Add video status
  if (videoPlaying) {
    response.videoPlaying = true;
    response.waitTime = waitTime;
  } else {
    response.videoPlaying = false;
  }

  // Add any extras
  Object.assign(response, extras);

  return response;
}

module.exports = { buildScanResponse, responseMessage };
