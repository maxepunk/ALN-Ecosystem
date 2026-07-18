/**
 * Pure scoring rules — the engine/game seam (Phase 2)
 *
 * Every scoring rule COMPUTATION lives here as a pure function over plain
 * data: no I/O, no EventEmitter, no service reads, no Node APIs. State
 * mutation (TeamScore instances in session.scores) and event emission stay
 * in transactionService; this module only decides amounts and outcomes.
 *
 * PARITY: this is the surface that must agree with the GM Scanner's
 * standalone implementation (ALNScanner LocalStorage._checkGroupCompletion
 * and friends). Functions depend only on plain token fields
 * (value, groupId, groupMultiplier) and plain transaction fields
 * (teamId, tokenId, status, mode, points, timestamp) so the module is
 * environment-agnostic and can move into the game-pack distribution
 * channel when runtime pack loading lands (Phase 3).
 *
 * Rule decisions encoded:
 * - A1 (2026-06-09), generalized by slice 1: only accepted transactions in
 *   a countsTowardGroups mode count toward group completion — evidence
 *   modes are testimony, not set progress
 * - A2/B1, generalized by slice 1: a scoringPolicy other than 'standard'
 *   awards 0 points
 * - Groups need 2+ member tokens to be completable
 * - Group bonus = (multiplier − 1) × Σ all member token values
 *
 * MODES (Phase 3 A3 slice 1): behavior branches on the pack's per-mode
 * semantics flags via gameRules/modeSemantics — never on mode-id string
 * equality. Every function takes the active gameConfig (callers pass
 * packService.getGameConfig(); null rides the modeSemantics legacy shim,
 * ledger L6). A transaction whose mode the config does not declare scores
 * nothing and counts toward nothing (see modeSemantics header for why
 * that is the safe reading; wire ingress makes it unreachable live).
 */

const { resolveMode } = require('./modeSemantics');

/**
 * Points awarded for processing a token in a given mode.
 * @param {Object} token - Token with a plain `value` field
 * @param {string} mode - A mode id declared by the active pack
 * @param {Object|null} gameConfig - The active pack's game.json
 * @returns {number}
 */
function pointsFor(token, mode, gameConfig) {
  const semantics = resolveMode(gameConfig, mode);
  return semantics && semantics.scoringPolicy === 'standard' ? token.value : 0;
}

/**
 * Token IDs a team has banked: accepted transactions in group-counting
 * modes only (decision A1 generalized — the group-completion currency is
 * `countsTowardGroups`, not a mode id).
 * @param {Array<Object>} transactions - Session transaction history
 * @param {string} teamId
 * @param {Object|null} gameConfig - The active pack's game.json
 * @returns {Set<string>}
 */
function teamBankedTokenIds(transactions, teamId, gameConfig) {
  return new Set(
    (transactions || [])
      .filter(tx =>
        tx.teamId === teamId &&
        tx.status === 'accepted' &&
        resolveMode(gameConfig, tx.mode)?.countsTowardGroups === true
      )
      .map(tx => tx.tokenId)
  );
}

/**
 * All tokens belonging to a group.
 * @param {Map<string, Object>} tokens - Token catalog keyed by ID
 * @param {string} groupId
 * @returns {Array<Object>}
 */
function groupTokens(tokens, groupId) {
  if (!groupId) return [];
  return Array.from(tokens.values()).filter(t => t.groupId === groupId);
}

/**
 * Has the team banked EVERY member token of the group?
 * @param {Object} args
 * @param {Map<string, Object>} args.tokens - Token catalog keyed by ID
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {string} args.teamId
 * @param {string} args.groupId
 * @param {string|null} [args.currentTokenId] - In-flight token being
 *   processed (claimed but possibly not yet in transactions)
 * @param {Object|null} [args.gameConfig] - The active pack's game.json
 * @returns {boolean}
 */
function isGroupComplete({ tokens, transactions, teamId, groupId, currentTokenId = null, gameConfig = null }) {
  const members = groupTokens(tokens, groupId);

  // Groups need at least 2 tokens to be completable
  if (members.length <= 1) return false;

  const banked = teamBankedTokenIds(transactions, teamId, gameConfig);
  if (currentTokenId) {
    banked.add(currentTokenId);
  }

  return members.every(token => banked.has(token.id));
}

/**
 * The paying multiplier for a group (read from any member token).
 * @param {Map<string, Object>} tokens - Token catalog keyed by ID
 * @param {string} groupId
 * @returns {number} The multiplier, or 0 when the group doesn't exist or
 *   pays no bonus (multiplier <= 1)
 */
function groupMultiplier(tokens, groupId) {
  const members = groupTokens(tokens, groupId);
  if (members.length === 0) return 0;

  const multiplier = members[0].groupMultiplier || 1;
  return multiplier > 1 ? multiplier : 0;
}

/**
 * Total bonus paid on completing a group:
 * (multiplier − 1) × Σ all member token values.
 * @param {Map<string, Object>} tokens - Token catalog keyed by ID
 * @param {string} groupId
 * @returns {number} 0 when the group pays no bonus
 */
function groupBonusAmount(tokens, groupId) {
  const multiplier = groupMultiplier(tokens, groupId);
  if (multiplier === 0) return 0;

  return groupTokens(tokens, groupId)
    .reduce((sum, token) => sum + token.value * (multiplier - 1), 0);
}

/**
 * Recompute the full score table from transaction history (the rebuild
 * path used after transaction deletion). Pure: returns plain score rows;
 * the caller applies them to live TeamScore instances and replays admin
 * adjustments on top.
 *
 * Base score honors recorded transaction points (history is authoritative
 * even if token values changed since); bonuses are recomputed from the
 * current token catalog.
 *
 * @param {Object} args
 * @param {Map<string, Object>} args.tokens - Token catalog keyed by ID
 * @param {Array<Object>} args.transactions - Session transaction history
 * @param {Array<string>} args.teamIds - Team membership (teams with no
 *   transactions still get a zero row)
 * @param {Object|null} [args.gameConfig] - The active pack's game.json
 * @returns {Array<{teamId: string, baseScore: number, bonusPoints: number,
 *   currentScore: number, tokensScanned: number, completedGroups: string[],
 *   lastTokenTime: string|null}>}
 */
function computeTeamScores({ tokens, transactions, teamIds, gameConfig = null }) {
  const rows = new Map();
  const zeroRow = (teamId) => ({
    teamId,
    baseScore: 0,
    bonusPoints: 0,
    currentScore: 0,
    tokensScanned: 0,
    completedGroups: [],
    lastTokenTime: null,
  });

  for (const teamId of teamIds || []) {
    rows.set(teamId, zeroRow(teamId));
  }

  // Scoring transactions: accepted, in a standard-scoring mode (parity
  // with the live path's scoringPolicy gate)
  const scoring = (transactions || [])
    .filter(tx =>
      tx.status === 'accepted' &&
      resolveMode(gameConfig, tx.mode)?.scoringPolicy === 'standard'
    );

  for (const tx of scoring) {
    let row = rows.get(tx.teamId);
    if (!row) {
      // Defensive: a transaction for a team missing from membership
      // shouldn't drop points
      row = zeroRow(tx.teamId);
      rows.set(tx.teamId, row);
    }
    row.baseScore += tx.points || 0;
    row.tokensScanned += 1;
    row.lastTokenTime = tx.timestamp;
  }

  // Group completion per team, from the same banked-token rule (A1)
  for (const row of rows.values()) {
    const banked = teamBankedTokenIds(scoring, row.teamId, gameConfig);
    const groupIds = new Set();
    for (const tokenId of banked) {
      const token = tokens.get(tokenId);
      if (token && token.groupId) {
        groupIds.add(token.groupId);
      }
    }

    for (const groupId of groupIds) {
      if (isGroupComplete({ tokens, transactions: scoring, teamId: row.teamId, groupId, gameConfig })) {
        row.completedGroups.push(groupId);
        row.bonusPoints += groupBonusAmount(tokens, groupId);
      }
    }

    row.currentScore = row.baseScore + row.bonusPoints;
  }

  return Array.from(rows.values());
}

module.exports = {
  pointsFor,
  teamBankedTokenIds,
  groupTokens,
  isGroupComplete,
  groupMultiplier,
  groupBonusAmount,
  computeTeamScores,
};
