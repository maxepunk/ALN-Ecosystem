/**
 * B0 BS.1 — the operator floor at the executor choke point (design r2
 * D-B0.3r2; red-team S3/S7 + doctrine D2).
 *
 * Two floors, one choke point: the cue floor (source !== 'gm' ⇒
 * CUE_ACTIONS only, slice-4 S6) and now the OPERATOR floor — a
 * gm-boundary command hitting a FLOOR action must present an explicit
 * actor whose granted functions include the action's floor function.
 * Deny-by-default: a gm-sourced floor action with NO actor is refused
 * (S7 — no defaulted identity), and a display-tier actor is refused
 * (S3 — a restricted token is restricted over EVERY transport).
 */

const { executeCommand } = require('../../../src/services/commandExecutor');
const { FLOOR_FUNCTIONS } = require('../../../src/gameRules/grants');

const OPERATOR = Object.freeze({
  tier: 'operator',
  functions: Object.freeze([...FLOOR_FUNCTIONS, 'view-content', 'observe']),
});
const DISPLAY = Object.freeze({ tier: 'device', functions: Object.freeze(['observe']) });

describe('commandExecutor operator floor (S3/S7/D2)', () => {
  it('REFUSES a gm-sourced FLOOR action with NO actor — deny by default', async () => {
    const result = await executeCommand({ action: 'session:pause', payload: {}, source: 'gm' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/operator floor|session-lifecycle/);
  });

  it('REFUSES a display-tier actor on a floor action over the SAME choke point', async () => {
    const result = await executeCommand({
      action: 'score:reset', payload: {}, source: 'gm', actor: DISPLAY,
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/operator floor|score-intervention/);
  });

  it('an operator actor passes the floor — the refusal, if any, is the ordinary downstream kind', async () => {
    const result = await executeCommand({
      action: 'session:pause', payload: {}, source: 'gm', actor: OPERATOR,
    });
    // No session exists in this harness — downstream may fail, but NEVER
    // with the floor's wording (the floor is passed).
    expect(String(result.message)).not.toMatch(/operator floor/);
  });

  it('cue-sourced CUE_ACTIONS are untouched by the operator floor (the cue floor governs them)', async () => {
    const result = await executeCommand({
      action: 'sound:stop', payload: {}, source: 'cue', trigger: 'test',
    });
    expect(String(result.message)).not.toMatch(/operator floor/);
  });

  it('a NON-floor action with no actor is not floor-refused (v1 leaves it to the ceiling)', async () => {
    const result = await executeCommand({ action: 'service:check', payload: {}, source: 'gm' });
    expect(String(result.message)).not.toMatch(/operator floor/);
  });
});
