/**
 * Pure GM duplicate policy — the engine/game seam (Phase 2)
 *
 * GM token processing is exclusive: each memory token is "used up" once
 * transacted (decision A2). Two rules, both per-session:
 * - Per-device: a GM device processes each token at most once
 * - First-come-first-served: once ANY team's claim is accepted, no other
 *   team can claim the token (the rejection identifies the claimant — A7)
 *
 * Player/ESP32 scans NEVER reach this policy: they go through scanRoutes,
 * which performs no duplicate checks by design (players re-view memories
 * freely). The old unreachable non-GM analytics branch and its never-
 * consumed transaction:rescan event died with this extraction (F-BCORE-12).
 *
 * Pure: no session reads, no events, no Node APIs (scanner-parity surface,
 * like gameRules/scoring.js).
 *
 * PACK DECLARATION (A3 slice 2 §2i): this module IS the implementation of
 * the pack's declared duplicatePolicy table — `{claim: 'once', view:
 * 'unlimited'}`, declared identically by both real packs. The capability
 * gate (packService._gateCheck) refuses any OTHER declared value with a
 * named message, so a pack can never declare a policy this code doesn't
 * enforce. A new policy value (e.g. non-consuming claims, the D2-deferred
 * `claims` flag) arrives WITH its enforcement here — never schema-dead.
 */

/**
 * Find the original accepted claim for a token in this session.
 * @param {Object} args
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {string} args.tokenId
 * @param {string} args.sessionId
 * @returns {Object|null} The first accepted claim, or null
 */
function findOriginalTransaction({ transactions, tokenId, sessionId }) {
  for (const existing of transactions || []) {
    if (existing.tokenId === tokenId &&
      existing.status === 'accepted' &&
      existing.sessionId === sessionId) {
      return existing;
    }
  }
  return null;
}

/**
 * Apply the GM duplicate rules to an incoming transaction.
 * @param {Object} args
 * @param {Object} args.transaction - Incoming transaction
 *   ({tokenId, teamId, deviceId, deviceType, sessionId})
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {Object<string, string[]>} args.scannedTokensByDevice - Per-device
 *   scan registry (session.metadata.scannedTokensByDevice)
 * @returns {{isDuplicate: boolean, original: Object|null}} original is the
 *   FCFS claimant when one exists (for the "claimed by Team X" message — A7)
 */
function checkDuplicate({ transaction, transactions, scannedTokensByDevice }) {
  // Defensive guard: only GM transactions are subject to duplicate rules.
  // (Non-GM scans don't reach processScan; if one ever did, it must not
  // be rejected — players re-scan freely.)
  if (transaction.deviceType !== 'gm') {
    return { isDuplicate: false, original: null };
  }

  const original = findOriginalTransaction({
    transactions,
    tokenId: transaction.tokenId,
    sessionId: transaction.sessionId,
  });

  // Per-device: this GM device already processed this token
  const deviceTokens = (scannedTokensByDevice || {})[transaction.deviceId] || [];
  if (deviceTokens.includes(transaction.tokenId)) {
    return { isDuplicate: true, original };
  }

  // FCFS: token already claimed by any team
  if (original) {
    return { isDuplicate: true, original };
  }

  return { isDuplicate: false, original: null };
}

module.exports = {
  checkDuplicate,
  findOriginalTransaction,
};
