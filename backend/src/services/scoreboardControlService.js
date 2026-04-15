/**
 * Scoreboard Control Service
 *
 * Tiny EventEmitter singleton that turns GM-issued scoreboard page navigation
 * commands into broadcast events. The backend does NOT track scoreboard page
 * state — scoreboards compute pagination client-side from viewport. This
 * service is a pure passthrough:
 *
 *   commandExecutor.executeCommand('scoreboard:page:next')
 *     → scoreboardControlService.next()
 *       → emits 'scoreboard:page:requested' {action: 'next'}
 *         → broadcasts.js forwards to 'gm' room as 'scoreboard:page'
 *           → scoreboard.html handler calls manualTransitionToPage()
 *
 * Both HDMI and remote scoreboards live in the `gm` room (see gmAuth.js),
 * so a single broadcast reaches both. Viewport differences mean page counts
 * may differ; next/prev are applied per client, `owner` is resolved per
 * client via each scoreboard's local evidence state.
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

class ScoreboardControlService extends EventEmitter {
  /**
   * Advance to the next evidence page on all scoreboards.
   */
  next() {
    logger.debug('[scoreboardControlService] next()');
    this.emit('scoreboard:page:requested', { action: 'next' });
  }

  /**
   * Return to the previous evidence page on all scoreboards.
   */
  prev() {
    logger.debug('[scoreboardControlService] prev()');
    this.emit('scoreboard:page:requested', { action: 'prev' });
  }

  /**
   * Jump to the page containing the given character owner.
   * Scoreboards that do not currently show this owner will no-op.
   *
   * PRECONDITION: `owner` is a non-empty string (validated by the caller —
   * commandExecutor for gm:command dispatch).
   *
   * @param {string} owner - Character owner name (e.g. "Alex Reeves")
   */
  jumpToOwner(owner) {
    logger.debug('[scoreboardControlService] jumpToOwner()', { owner });
    this.emit('scoreboard:page:requested', { action: 'owner', owner });
  }
}

module.exports = new ScoreboardControlService();
