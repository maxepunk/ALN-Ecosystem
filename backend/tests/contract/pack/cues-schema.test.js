/**
 * Pack Show-Cues Schema Contract (Phase 3, A3 slice 4 S1)
 *
 * cues.schema.json is the AUTHORING half of the row-2.22 cue-authoring
 * contract (the S2 activation gate is the runtime half). It pins today's
 * engine cue shape — commands XOR timeline, flat {at, action, payload}
 * timeline entries, trigger null/absent both legal — with ONE deliberate
 * difference: `lighting:scene:activate` payloads carry a `role` from the
 * pack's lighting vocabulary, never a concrete venue `sceneId` (B8; the
 * installation profile binds role → instrument).
 *
 * Design doc: docs/plans/2026-08-29-phase3-a3-slice4-showcontrol-pack.md
 * (D-4.2; owner answers §4).
 */

const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const {
  EVENT_NORMALIZERS,
  CONDITION_OPS,
} = require('../../../src/services/cue/standingEvaluator');

const TOKEN_DATA_DIR = path.resolve(__dirname, '../../../../ALN-TokenData');

const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

// A migrated-form document exercising every authorable shape: event
// trigger + conditions, explicit null trigger, absent trigger, clock
// trigger, compound timeline (unsorted entries, duplicate `at` values —
// both occur in the real ENDGAME cue), role-form lighting payloads,
// sound target routing, once, cue-level routing.
const validDoc = () => ({
  kind: 'cues',
  schemaVersion: 1,
  cues: [
    {
      id: 'attention-before-video',
      label: 'Pre-Video Alert',
      icon: 'alert',
      trigger: {
        event: 'video:loading',
        conditions: [{ field: 'tokenId', op: 'neq', value: 'policesequencewoverlay' }],
      },
      commands: [
        { action: 'sound:play', payload: { file: 'attention.wav' } },
        { action: 'lighting:scene:activate', payload: { role: 'video-playback' } },
      ],
    },
    {
      id: 'warning-90min',
      label: '90min WARNING',
      quickFire: true,
      trigger: null,
      commands: [{ action: 'sound:play', payload: { file: '90min.wav' } }],
    },
    {
      id: 'tension-hit',
      label: 'Tension Hit',
      icon: 'sound',
      quickFire: true,
      commands: [{ action: 'sound:play', payload: { file: 'tension.wav' } }],
    },
    {
      id: 'halftime-sting',
      label: 'Halftime Sting',
      trigger: { clock: '01:00:00' },
      once: true,
      routing: { sound: 'bluetooth' },
      commands: [{ action: 'sound:play', payload: { file: 'tension.wav' } }],
    },
    {
      id: 'endgame',
      label: 'ENDGAME',
      quickFire: true,
      timeline: [
        { at: 1, action: 'video:queue:add', payload: { videoFile: 'policesequencewoverlay.mp4' } },
        { at: 180, action: 'lighting:scene:activate', payload: { role: 'police-arrival-1' } },
        { at: 1, action: 'lighting:scene:activate', payload: { role: 'video-playback' } },
        { at: 390, action: 'sound:play', payload: { file: 'policesounds.wav', target: 'bluetooth' } },
        { at: 600, action: 'lighting:scene:activate', payload: { role: 'gameplay' } },
      ],
    },
  ],
});

describe('pack show-cues schema contract (slice 4 S1)', () => {
  let validate;
  let schema;

  beforeAll(() => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    schema = readJson(TOKEN_DATA_DIR, 'cues.schema.json');
    validate = ajv.compile(schema);
  });

  const explain = () => (validate.errors || [])
    .map(e => `${e.instancePath || '(root)'}: ${e.message}`)
    .join('\n  ');

  it('the migrated-form document validates (every authorable shape)', () => {
    if (!validate(validDoc())) throw new Error(`violations:\n  ${explain()}`);
  });

  describe('cue structure refusal twins', () => {
    const mutate = (fn) => {
      const doc = validDoc();
      fn(doc);
      return validate(doc);
    };

    it('commands AND timeline on one cue is refused (XOR)', () => {
      expect(mutate(d => { d.cues[2].timeline = [{ at: 0, action: 'sound:play' }]; })).toBe(false);
    });

    it('NEITHER commands nor timeline is refused', () => {
      expect(mutate(d => { delete d.cues[2].commands; })).toBe(false);
    });

    it('empty commands array is refused (a cue must do something)', () => {
      expect(mutate(d => { d.cues[2].commands = []; })).toBe(false);
    });

    it('missing id / missing label are refused', () => {
      expect(mutate(d => { delete d.cues[0].id; })).toBe(false);
      expect(mutate(d => { delete d.cues[0].label; })).toBe(false);
    });

    it('id outside the project id convention is refused', () => {
      expect(mutate(d => { d.cues[0].id = 'Pre Video Alert'; })).toBe(false);
    });

    it('icon is a CSS class key — injection-shaped values are refused', () => {
      expect(mutate(d => { d.cues[0].icon = 'alert"><script>'; })).toBe(false);
    });

    it('the dead `duration` key is refused (engine-unread; S4 drops it at migration)', () => {
      expect(mutate(d => { d.cues[4].duration = 7; })).toBe(false);
    });

    it('routing accepts only the three stream keys', () => {
      expect(mutate(d => { d.cues[3].routing = { voice: 'bluetooth' }; })).toBe(false);
    });
  });

  describe('trigger vocabulary (row 2.22 authoring contract)', () => {
    const mutate = (fn) => {
      const doc = validDoc();
      fn(doc);
      return validate(doc);
    };

    it('an event outside the engine normalizer table is refused', () => {
      expect(mutate(d => { d.cues[0].trigger.event = 'video:exploded'; })).toBe(false);
    });

    it('a condition op outside CONDITION_OPS is refused', () => {
      expect(mutate(d => { d.cues[0].trigger.conditions[0].op = 'matches'; })).toBe(false);
    });

    it('op "in" requires an array value (a scalar silently never fires at runtime)', () => {
      expect(mutate(d => {
        d.cues[0].trigger.conditions[0] = { field: 'tokenId', op: 'in', value: 'kaa001' };
      })).toBe(false);
    });

    it('a trigger with BOTH event and clock is refused', () => {
      expect(mutate(d => { d.cues[0].trigger = { event: 'video:loading', clock: '00:10:00' }; })).toBe(false);
    });

    it('an unparseable clock string is refused (it would throw per tick at runtime)', () => {
      expect(mutate(d => { d.cues[3].trigger = { clock: '90 minutes' }; })).toBe(false);
      expect(mutate(d => { d.cues[3].trigger = { clock: '1:2:3' }; })).toBe(false);
    });

    it('conditions on a clock trigger are refused (the engine never evaluates them)', () => {
      expect(mutate(d => {
        d.cues[3].trigger = { clock: '01:00:00', conditions: [{ field: 'x', op: 'eq', value: 1 }] };
      })).toBe(false);
    });

    it('TRIPWIRE: the schema trigger-event enum IS the engine normalizer table', () => {
      const schemaEvents = [...schema.$defs.triggerEvent.enum].sort();
      expect(schemaEvents).toEqual(Object.keys(EVENT_NORMALIZERS).sort());
    });

    it('TRIPWIRE: the schema op enum IS the engine CONDITION_OPS table', () => {
      const schemaOps = [...schema.$defs.conditionOp.enum].sort();
      expect(schemaOps).toEqual(Object.keys(CONDITION_OPS).sort());
    });
  });

  describe('lighting payloads carry roles, never venue scene ids (B8)', () => {
    const mutate = (fn) => {
      const doc = validDoc();
      fn(doc);
      return validate(doc);
    };

    it('a concrete sceneId in a flat-command lighting payload is refused', () => {
      expect(mutate(d => {
        d.cues[0].commands[1].payload = { sceneId: 'scene.video' };
      })).toBe(false);
    });

    it('a concrete sceneId in a timeline lighting payload is refused', () => {
      expect(mutate(d => {
        d.cues[4].timeline[1].payload = { sceneId: 'scene.police_1' };
      })).toBe(false);
    });

    it('a lighting payload without a role is refused', () => {
      expect(mutate(d => { d.cues[0].commands[1].payload = {}; })).toBe(false);
    });

    it('a role outside the role-name convention is refused', () => {
      expect(mutate(d => {
        d.cues[0].commands[1].payload = { role: 'Scene.Video' };
      })).toBe(false);
    });
  });

  describe('timeline entry shape (flat {at, action, payload})', () => {
    const mutate = (fn) => {
      const doc = validDoc();
      fn(doc);
      return validate(doc);
    };

    it('a missing `at` is refused (NaN-poisons maxAt at runtime)', () => {
      expect(mutate(d => { delete d.cues[4].timeline[0].at; })).toBe(false);
    });

    it('a negative or non-numeric `at` is refused', () => {
      expect(mutate(d => { d.cues[4].timeline[0].at = -1; })).toBe(false);
      expect(mutate(d => { d.cues[4].timeline[0].at = '180'; })).toBe(false);
    });

    it('a nested `command` key is refused (two census legs miscounted this shape)', () => {
      expect(mutate(d => {
        d.cues[4].timeline[0] = { at: 1, command: { action: 'sound:play' } };
      })).toBe(false);
    });
  });

  describe('file header (sidecar convention, strings precedent)', () => {
    it('wrong kind, wrong schemaVersion, and a missing cues array are refused', () => {
      const base = validDoc();
      expect(validate({ ...base, kind: 'strings' })).toBe(false);
      expect(validate({ ...base, schemaVersion: 2 })).toBe(false);
      const { cues, ...headless } = base;
      expect(validate(headless)).toBe(false);
    });

    it('the bare venue wrapper {cues: [...]} without the header is refused', () => {
      // The venue file has no header; the PACK sidecar requires one —
      // S4 authors it in at migration.
      expect(validate({ cues: validDoc().cues })).toBe(false);
    });
  });
});
