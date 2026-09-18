/**
 * Jest test environment: node, plus a leaked-child check at teardown.
 *
 * `teardown()` runs after EVERY hook the test file declared — including its own
 * root-level `afterAll`, and including hooks registered by setup files. That
 * ordering is the entire point:
 *
 *   jest-circus runs afterAll hooks in DECLARATION order, and a setup file
 *   (`setupFilesAfterEach`) is declared before the test file's body. A guard
 *   living in an `afterAll` there therefore runs BEFORE a file's own root-level
 *   `afterAll` cleanup, and would flag a perfectly well-behaved file. Only a
 *   file that happened to clean up inside a `describe` would pass. Running in
 *   the environment's teardown makes "last" a structural property instead of a
 *   thing to get right by hand.
 *
 * Throwing here is reported by jest as a test-suite failure for that file, so a
 * leak is loud rather than silent.
 *
 * Wired via `testEnvironment` in jest.config.base.js, so it covers the unit,
 * contract and integration configs alike.
 */

const NodeEnvironment = require('jest-environment-node').default;
const { assertNoLiveChildren } = require('./live-children-guard');

class GuardedNodeEnvironment extends NodeEnvironment {
  async teardown() {
    // Check BEFORE super.teardown(): the assertion throws on a leak, and the
    // environment still has to be torn down either way.
    let leakError = null;
    try {
      await assertNoLiveChildren();
    } catch (err) {
      leakError = err;
    }

    await super.teardown();

    if (leakError) throw leakError;
  }
}

module.exports = GuardedNodeEnvironment;
