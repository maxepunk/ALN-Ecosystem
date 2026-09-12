/**
 * dormancyWording — the ONE sentence fragment for a dormant service's door
 * (Block 2 T1a, plan §3 pin P5; CONTEXT.md §4 "dormant vs fault").
 *
 * Dormancy has exactly two doors and the operator must hear the same two
 * sentences at every surface: the executor's refusal, the cue engine's quiet
 * skip, the registry's stored message, the preflight row, the GM dashboard.
 * Building each of those from this helper is what keeps them identical.
 *
 *   profile  → the equipment family is not installed at this venue tonight
 *   operator → a human latched the service out of service mid-run
 *
 * Pure and tiny by design: `gameRules/resolution.js` imports it, so it must
 * never import a service and must never do I/O.
 *
 * The GM Scanner carries a PARITY COPY at
 * `ALNScanner/src/ui/renderers/dormancyWording.js` — change both together.
 */

'use strict';

const DOOR_WORDING = Object.freeze({
  profile: 'not installed tonight',
  operator: 'out of service',
});

/**
 * @param {'profile'|'operator'} door
 * @returns {string} the fragment that completes "<serviceId> is ..."
 * @throws {Error} on any value that is not one of the two doors
 */
function doorWording(door) {
  if (!Object.prototype.hasOwnProperty.call(DOOR_WORDING, door)) {
    throw new Error(`unknown dormancy door '${door}' (expected 'profile' or 'operator')`);
  }
  return DOOR_WORDING[door];
}

module.exports = { doorWording, DOOR_WORDING };
