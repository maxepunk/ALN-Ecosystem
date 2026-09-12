/**
 * Scan response shaping (wire-format concern, Phase 2 extraction)
 *
 * Builds the scan-result payload returned by transactionService.processScan
 * and forwarded to scanners as transaction:result (adminEvents) or the HTTP
 * scan response. Pure: takes the video status as plain values — the caller
 * (transactionService) injects videoQueueService state. (The award-message
 * wording reads the activation-frozen pack strings snapshot — config, not
 * state, same standing as renderScoreboardHtml's injection.)
 */

const { getStrings, getScoringRules } = require('../services/packService');
const { parseMoneyFormat, formatMoney } = require('../gameRules/formatting');

// Baked ALN wording, `{points}` placeholder. Packs reword via
// strings.scoring.awardMessage (slice 3a) with `{points}` (raw number)
// and/or `{pointsFormatted}` (pack money grammar — R-Q-3b-1 option c;
// the ALN sidecar now declares "{pointsFormatted} awarded." and renders
// "$150,000 awarded.", drift-pinned in scanResponse.test.js). This baked
// packless default keeps the `{points}` wording byte-identical.
// Everything else in this file stays engine chrome (A7
// duplicate/rejection messages are contract-adjacent, census §2
// out-of-pack list).
const BAKED_AWARD_MESSAGE = 'Token scanned successfully. {points} points awarded.';

function awardMessage(points) {
  const declared = getStrings()?.scoring?.awardMessage;
  const template = (typeof declared === 'string' && declared.length > 0)
    ? declared
    : BAKED_AWARD_MESSAGE;
  // Function replacements (GetSubstitution): a formatted value like
  // "$1,300" must never be re-read as a $-pattern by replaceAll.
  // Optional-chained: a malformed rules snapshot falls back to the baked
  // money spec — formatting must never crash a scan response.
  const formatted = formatMoney(points, parseMoneyFormat(getScoringRules()?.display?.format));
  return template
    .replaceAll('{points}', () => String(points))
    .replaceAll('{pointsFormatted}', () => formatted);
}

/**
 * Human-readable result message for a processed transaction.
 * @param {Object} transaction - Processed transaction (model instance)
 * @param {string} [claimedBy] - Team that originally claimed the token (A7)
 * @returns {string}
 */
function responseMessage(transaction, claimedBy) {
  if (transaction.isAccepted()) {
    return awardMessage(transaction.points);
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
