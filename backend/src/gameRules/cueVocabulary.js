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
 * `standingEvaluator.js`, in the cue service directory.
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
   * Fields: tokenId, teamId, deviceType, points, teamScore, hasGroupBonus.
   *
   * memoryType / valueRating / groupId were REMOVED from the advertised
   * vocabulary (train-review P1-3): the Transaction wire object never
   * carried them, so a condition on any of the three could never match —
   * an authoring lie. Re-adding them is real feature work (enrich the
   * payload from the token at emit), owned by the show-designer depth
   * work, never by silently advertising undefined.
   */
  'transaction:accepted': (payload) => ({
    tokenId: payload.transaction.tokenId,
    teamId: payload.transaction.teamId,
    deviceType: payload.transaction.deviceType,
    points: payload.transaction.points,
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
