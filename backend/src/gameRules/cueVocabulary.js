'use strict';

/**
 * Cue Vocabulary — Game-Event Normalizer Table
 *
 * Pure module (no I/O). Provides the game-event normalizer table used by
 * the cue engine's EVENT_NORMALIZERS registry. Separates game-rule vocabulary
 * (transaction:accepted fields, group:completed fields) from engine-event
 * normalizers (video/music/sound/clock/session) per the split-seam proposal
 * in docs/reviews/2026-06-platform-review/showcontrol-internals-review.md.
 *
 * Only game-transaction vocabulary lives here. Engine events are defined in
 * src/services/cue/standingEvaluator.js.
 */

/**
 * Game-event normalizers for cue condition evaluation.
 * Each normalizer flattens a complex event payload into a flat context object
 * whose field names are part of the cue-authoring vocabulary.
 *
 * @type {Object.<string, function(Object): Object>}
 */
const GAME_EVENT_NORMALIZERS = {
  /**
   * transaction:accepted — flat vocabulary for cue conditions.
   * Fields: tokenId, teamId, deviceType, points, memoryType, valueRating,
   *         groupId, teamScore, hasGroupBonus.
   */
  'transaction:accepted': (payload) => ({
    tokenId: payload.transaction.tokenId,
    teamId: payload.transaction.teamId,
    deviceType: payload.transaction.deviceType,
    points: payload.transaction.points,
    memoryType: payload.transaction.memoryType,
    valueRating: payload.transaction.valueRating,
    groupId: payload.transaction.groupId,
    teamScore: payload.teamScore?.currentScore ?? 0,
    hasGroupBonus: payload.groupBonus !== null,
  }),

  /**
   * group:completed — flat vocabulary for cue conditions.
   * Fields: teamId, groupId, multiplier, bonus.
   */
  'group:completed': (payload) => ({
    teamId: payload.teamId,
    groupId: payload.groupId,
    multiplier: payload.multiplier,
    bonus: payload.bonus,
  }),
};

module.exports = { GAME_EVENT_NORMALIZERS };
