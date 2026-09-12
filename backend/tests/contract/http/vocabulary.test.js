/**
 * B0 BS.1 — GET /api/vocabulary (contract test).
 *
 * The backend-served cue-authoring vocabulary (program Track B; design
 * r2 D-B0.3r2, doctrine D1 restoration): the endpoint must serve the
 * SAME exported tables the activation gate validates cues against —
 * one source, zero drift by construction. The config-tool's editors
 * (TRIGGER_EVENTS in cueEditor.js, ACTION_DEFS in commandForm.js)
 * re-source from here in BS.3.
 */

const request = require('supertest');
const app = require('../../../src/app');
const { validateHTTPResponse } = require('../../helpers/contract-validator');
const cueValidation = require('../../../src/gameRules/cueValidation');

describe('GET /api/vocabulary', () => {
  it('serves the engine vocabulary, valid against the OpenAPI contract', async () => {
    const response = await request(app.app).get('/api/vocabulary').expect(200);
    validateHTTPResponse(response, '/api/vocabulary', 'get', 200);
  });

  it('ZERO-DRIFT pin: the served tables ARE the validator\'s exports, verbatim', async () => {
    const response = await request(app.app).get('/api/vocabulary').expect(200);
    expect(response.body.triggerEvents).toEqual(cueValidation.CUE_TRIGGER_EVENTS);
    expect(response.body.conditionOperators).toEqual(cueValidation.CONDITION_OP_NAMES);
    expect(response.body.actions).toEqual(cueValidation.CUE_ACTIONS);
    expect(response.body.tokenDerivedTriggerEvents)
      .toEqual(cueValidation.TOKEN_DERIVED_TRIGGER_EVENTS);
  });

  it('is read-only engine metadata — no auth required (the /api/tokens posture)', async () => {
    await request(app.app).get('/api/vocabulary').expect(200);
  });
});
