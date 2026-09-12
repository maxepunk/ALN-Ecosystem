/**
 * TRIGGER_EVENTS ←→ backend EVENT_NORMALIZERS linkage tripwire (A3 slice 5,
 * review I — the F-TOOL-09 hand-mirror finally gets a drift alarm).
 *
 * The cue editor's TRIGGER_EVENTS table is a hand-mirror of the backend's
 * standing-cue trigger vocabulary (the matrix-2.22 authoring contract, now
 * also the phase-start trigger vocabulary the activation gate advertises in
 * its refusal messages). This test pins the EVENT-NAME set equal in both
 * directions, and the new phase:changed row's condition-field list equal to
 * the normalizer's actual output keys.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const CUE_EDITOR = path.join(__dirname, '..', 'public', 'js', 'components', 'cueEditor.js');
const STANDING_EVALUATOR = path.join(
  __dirname, '..', '..', 'backend', 'src', 'services', 'cue', 'standingEvaluator.js'
);

test('TRIGGER_EVENTS mirrors the backend EVENT_NORMALIZERS key set exactly (both directions)', async () => {
  const { TRIGGER_EVENTS } = await import(CUE_EDITOR);
  // eslint-disable-next-line global-require
  const { EVENT_NORMALIZERS } = require(STANDING_EVALUATOR);

  const editorKeys = Object.keys(TRIGGER_EVENTS).sort();
  const backendKeys = Object.keys(EVENT_NORMALIZERS).sort();
  assert.deepStrictEqual(
    editorKeys, backendKeys,
    'cueEditor TRIGGER_EVENTS drifted from backend EVENT_NORMALIZERS — update the hand-mirror'
  );
});

test("the phase:changed row's fields list matches the normalizer's output keys", async () => {
  const { TRIGGER_EVENTS } = await import(CUE_EDITOR);
  // eslint-disable-next-line global-require
  const { EVENT_NORMALIZERS } = require(STANDING_EVALUATOR);

  const normalized = EVENT_NORMALIZERS['phase:changed']({
    phaseId: 'the-job', previousPhaseId: 'casing', label: 'The Job', elapsed: 1800, via: 'time',
  });
  assert.deepStrictEqual(
    [...TRIGGER_EVENTS['phase:changed'].fields].sort(),
    Object.keys(normalized).sort()
  );
});
