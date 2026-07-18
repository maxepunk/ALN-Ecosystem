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
 * PACK DECLARATION (A3 slice 2 §2i + D3s2): this module IS the
 * implementation of the pack's declared duplicate table:
 * - Pack-level `duplicatePolicy: {claim: 'once', view: 'unlimited'}` —
 *   the FCFS rules above, declared identically by both real packs; the
 *   capability gate refuses any other value.
 * - Per-mode `claims` flag ('consuming' default | 'non-consuming', D3s2):
 *   a NON-CONSUMING mode's transaction is a repeatable action — it is
 *   never blocked by the duplicate rules AND never registers a claim
 *   (findOriginalTransaction skips it; the per-device registry never
 *   learns it — transactionService gates the deviceTracking emission).
 *   A stored transaction whose mode the active pack cannot resolve is
 *   treated as CONSUMING (legacy history keeps blocking — the safe
 *   reading, mirrored by the scanner seam).
 */

const { resolveMode } = require('./modeSemantics');

/**
 * Does this transaction's mode register a consuming claim?
 * Unresolvable modes (legacy history, packless checkouts) are consuming.
 * @param {Object|null} gameConfig
 * @param {string} modeId
 * @returns {boolean}
 */
function isConsumingClaim(gameConfig, modeId) {
  const record = resolveMode(gameConfig, modeId);
  return record === null || record.claims !== 'non-consuming';
}

/**
 * Find the original accepted CONSUMING claim for a token in this session.
 * Non-consuming transactions never register as the claimant (D3s2).
 * @param {Object} args
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {string} args.tokenId
 * @param {string} args.sessionId
 * @param {Object|null} [args.gameConfig] - Active pack config for claims
 *   resolution (absent → every stored transaction is consuming, as before)
 * @returns {Object|null} The first accepted consuming claim, or null
 */
function findOriginalTransaction({ transactions, tokenId, sessionId, gameConfig = null }) {
  for (const existing of transactions || []) {
    if (existing.tokenId === tokenId &&
      existing.status === 'accepted' &&
      existing.sessionId === sessionId &&
      isConsumingClaim(gameConfig, existing.mode)) {
      return existing;
    }
  }
  return null;
}

/**
 * Apply the GM duplicate rules to an incoming transaction.
 * @param {Object} args
 * @param {Object} args.transaction - Incoming transaction
 *   ({tokenId, teamId, deviceId, deviceType, sessionId, mode})
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {Object<string, string[]>} args.scannedTokensByDevice - Per-device
 *   scan registry (session.metadata.scannedTokensByDevice)
 * @param {Object|null} [args.gameConfig] - Active pack config for per-mode
 *   claims resolution (D3s2)
 * @returns {{isDuplicate: boolean, original: Object|null}} original is the
 *   FCFS claimant when one exists (for the "claimed by Team X" message — A7)
 */
function checkDuplicate({ transaction, transactions, scannedTokensByDevice, gameConfig = null }) {
  // Defensive guard: only GM transactions are subject to duplicate rules.
  // (Non-GM scans don't reach processScan; if one ever did, it must not
  // be rejected — players re-scan freely.)
  if (transaction.deviceType !== 'gm') {
    return { isDuplicate: false, original: null };
  }

  // D3s2: a non-consuming action is repeatable BY DESIGN — not blocked by
  // the per-device rule, not blocked by an existing consuming claim, and
  // (because it never registers) not blocking anything later.
  if (!isConsumingClaim(gameConfig, transaction.mode)) {
    return { isDuplicate: false, original: null };
  }

  const original = findOriginalTransaction({
    transactions,
    tokenId: transaction.tokenId,
    sessionId: transaction.sessionId,
    gameConfig,
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
  isConsumingClaim,
};
