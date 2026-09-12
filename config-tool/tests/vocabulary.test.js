// B0 BS.3 s3 — the served-vocabulary client module (D1 restored: the
// editors stop hand-mirroring the engine's cue vocabulary; the SERVED
// sets decide what is offered, local tables only DECORATE).
//
// The drift this kills is real and bidirectional: the hand-mirrored
// ACTION_DEFS offered cue:fire/enable/disable — actions the activation
// gate REFUSES in pack cues — and lacked video:skip/seek, music:seek,
// display:return-to-video, which are legal.

'use strict';
const { before, describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

let vocab;

before(async () => {
  vocab = await import('../public/js/utils/vocabulary.js');
});

const SERVED = {
  triggerEvents: ['group:completed', 'engine:new-event'],
  conditionOperators: ['eq', 'gt'],
  actions: {
    'sound:play': { file: 'string' },
    'video:seek': { position: 'number' },
    'music:setShuffle': { enabled: 'boolean' },
  },
  tokenDerivedTriggerEvents: ['player:scan'],
};

const BAKED_TRIGGERS = {
  'group:completed': { label: 'Group Completed', fields: ['teamId'] },
  'stale:event': { label: 'Gone From Engine', fields: [] },
};

const BAKED_ACTIONS = {
  'sound:play': { label: 'Play Sound', category: 'sound', fields: [{ key: 'file', type: 'sound-picker', label: 'Sound File', required: true }] },
  'cue:fire': { label: 'Fire Cue', category: 'cue', fields: [] },
};

describe('vocabulary', () => {
  beforeEach(() => vocab.setVocabulary(null));

  it('without a served vocabulary, falls back to the baked tables (loud fallback posture)', () => {
    assert.deepStrictEqual(
      vocab.getTriggerEventNames(BAKED_TRIGGERS),
      Object.keys(BAKED_TRIGGERS));
    assert.deepStrictEqual(
      vocab.getActionEntries(BAKED_ACTIONS).map((e) => e.action),
      Object.keys(BAKED_ACTIONS));
  });

  it('the SERVED set decides which trigger events are offered; baked entries decorate', () => {
    vocab.setVocabulary(SERVED);
    const names = vocab.getTriggerEventNames(BAKED_TRIGGERS);
    assert.deepStrictEqual(names, ['group:completed', 'engine:new-event']);
    // A served event the baked table doesn't know still renders,
    // undecorated — and a stale baked event is NOT offered.
    const known = vocab.decorateTriggerEvent('group:completed', BAKED_TRIGGERS);
    assert.strictEqual(known.label, 'Group Completed');
    const unknown = vocab.decorateTriggerEvent('engine:new-event', BAKED_TRIGGERS);
    assert.strictEqual(unknown.label, 'engine:new-event');
    assert.deepStrictEqual(unknown.fields, []);
  });

  it('the SERVED set decides which actions are offered: gate-refused baked actions drop, new engine actions gain a DERIVED form', () => {
    vocab.setVocabulary(SERVED);
    const entries = vocab.getActionEntries(BAKED_ACTIONS);
    const actions = entries.map((e) => e.action);
    assert.ok(!actions.includes('cue:fire'), 'gate-refused action must not be offered');
    assert.ok(actions.includes('video:seek'));

    const derived = entries.find((e) => e.action === 'video:seek').def;
    assert.strictEqual(derived.category, 'video');
    assert.deepStrictEqual(derived.fields, [
      { key: 'position', type: 'number', label: 'position', required: true },
    ]);
    const bool = entries.find((e) => e.action === 'music:setShuffle').def;
    assert.deepStrictEqual(bool.fields[0], {
      key: 'enabled', type: 'boolean-select', label: 'enabled', required: true,
    });

    // Known actions keep their rich baked decoration (pickers etc.).
    const decorated = entries.find((e) => e.action === 'sound:play').def;
    assert.strictEqual(decorated.fields[0].type, 'sound-picker');
  });

  it('condition operators come from the served set when present', () => {
    const baked = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'];
    assert.deepStrictEqual(vocab.getConditionOps(baked), baked);
    vocab.setVocabulary(SERVED);
    assert.deepStrictEqual(vocab.getConditionOps(baked), ['eq', 'gt']);
  });
});
