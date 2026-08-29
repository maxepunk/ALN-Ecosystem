/**
 * Cue-block validation rules (Phase 3, A3 slice 4 S2 — D-4.3)
 *
 * validateCuesBlock is the pure, dependency-free authoring validator for
 * a pack's show cues: gate rules 1-7 as PACK-INTERNAL reads only (no
 * services, no venue resources — those stay at preflight, C1 §3.5).
 * packService calls it at activation; the config-tool imports it
 * directly at S4 (the writeScoring precedent), which is why it lives in
 * src/gameRules/ and must never pull winston/dotenv.
 *
 * The module also OWNS the row-2.22 cue-authoring vocabulary lists.
 * The engine tables (standingEvaluator, commandExecutor) and the pack
 * schema (cues.schema.json) are drift-tripwired against them here.
 *
 * Design doc: docs/plans/2026-08-29-phase3-a3-slice4-showcontrol-pack.md
 * (D-4.3 rules; §8 G1/R2/G2/G3 dispositions).
 */

const fs = require('fs');
const path = require('path');
const {
  validateCuesBlock,
  CUE_TRIGGER_EVENTS,
  CONDITION_OP_NAMES,
  CUE_ACTIONS,
  TOKEN_DERIVED_TRIGGER_EVENTS,
  CLOCK_PATTERN,
} = require('../../../src/gameRules/cueValidation');
const {
  EVENT_NORMALIZERS,
  CONDITION_OPS,
} = require('../../../src/services/cue/standingEvaluator');

const TOKEN_DATA_DIR = path.resolve(__dirname, '../../../../ALN-TokenData');
const COMMAND_EXECUTOR_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../src/services/commandExecutor.js'), 'utf8'
);

// A migrated-form ALN-like fixture: the two REAL guard cues (sceneId →
// role form) that gate rule 3 must never refuse (red-team G2 — their
// condition tokenId is the engine's filename-derived namespace), plus a
// standing token cue, a clock cue, a manual compound with a video entry.
const gameConfig = () => ({
  id: 'about-last-night',
  cues: 'cues.json',
  requires: ['cues.standing', 'cues.timeline', 'lighting.roles'],
  lightingRoles: ['gameplay', 'video-playback', 'blackout', 'police-arrival-1'],
  lightingRoleFallbacks: { gameplay: 'scene.game', 'video-playback': 'scene.video' },
});

const tokens = () => ({
  kaa001: { SF_RFID: 'kaa001' },
  jaw001: { SF_RFID: 'jaw001' },
});

const cuesFixture = () => ([
  {
    id: 'attention-before-video',
    label: 'Pre-Video Alert',
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
    id: 'restore-after-video',
    label: 'Post-Video Restore',
    trigger: {
      event: 'video:completed',
      conditions: [{ field: 'tokenId', op: 'neq', value: 'policesequencewoverlay' }],
    },
    commands: [{ action: 'lighting:scene:activate', payload: { role: 'gameplay' } }],
  },
  {
    id: 'token-fanfare',
    label: 'Token Fanfare',
    trigger: {
      event: 'transaction:accepted',
      conditions: [{ field: 'tokenId', op: 'in', value: ['kaa001', 'jaw001'] }],
    },
    commands: [{ action: 'sound:play', payload: { file: 'tension.wav' } }],
  },
  {
    id: 'halftime',
    label: 'Halftime',
    trigger: { clock: '01:00:00' },
    once: true,
    commands: [{ action: 'sound:play', payload: { file: '60min.wav' } }],
  },
  {
    id: 'endgame',
    label: 'ENDGAME',
    quickFire: true,
    trigger: null,
    timeline: [
      { at: 1, action: 'video:queue:add', payload: { videoFile: 'police.mp4' } },
      { at: 180, action: 'lighting:scene:activate', payload: { role: 'police-arrival-1' } },
      { at: 390, action: 'sound:play', payload: { file: 'policesounds.wav', target: 'bluetooth' } },
    ],
  },
]);

// Run the validator on a mutated copy of the green fixture set and
// return the problem messages.
const problemsAfter = (fn) => {
  const ctx = { cues: cuesFixture(), game: gameConfig(), toks: tokens() };
  fn(ctx);
  return validateCuesBlock(ctx.cues, ctx.game, ctx.toks);
};

describe('cue vocabulary tripwires (row 2.22 — grow every side together)', () => {
  it('TRIPWIRE: CUE_TRIGGER_EVENTS is the engine normalizer table', () => {
    expect([...CUE_TRIGGER_EVENTS].sort()).toEqual(Object.keys(EVENT_NORMALIZERS).sort());
  });

  it('TRIPWIRE: CONDITION_OP_NAMES is the engine CONDITION_OPS table', () => {
    expect([...CONDITION_OP_NAMES].sort()).toEqual(Object.keys(CONDITION_OPS).sort());
  });

  it('TRIPWIRE: the pack schema enums match the validator lists', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(TOKEN_DATA_DIR, 'cues.schema.json'), 'utf8'));
    expect([...schema.$defs.triggerEvent.enum].sort()).toEqual([...CUE_TRIGGER_EVENTS].sort());
    expect([...schema.$defs.conditionOp.enum].sort()).toEqual([...CONDITION_OP_NAMES].sort());
    expect(schema.$defs.trigger.oneOf
      .find(b => b.properties && b.properties.clock).properties.clock.pattern)
      .toBe(CLOCK_PATTERN.source);
  });

  it('TRIPWIRE: every cue-action is a real executeCommand case (CLAUDE.md ground-truth grep)', () => {
    const cases = new Set(
      [...COMMAND_EXECUTOR_SRC.matchAll(/case '([A-Za-z:-]+)':/g)].map(m => m[1])
    );
    for (const action of Object.keys(CUE_ACTIONS)) {
      expect(cases).toContain(action);
    }
  });

  it('TRIPWIRE: validator payload requirements cover the engine required fields (lighting exempt — role-form by design)', () => {
    // REQUIRED_PAYLOAD_FIELDS maps lighting:scene:activate → ['sceneId'];
    // pack cues carry role instead (S3 normalizes role → sceneId at the
    // top of executeCommand), so lighting is exempt from this pin.
    const m = COMMAND_EXECUTOR_SRC.match(/const REQUIRED_PAYLOAD_FIELDS = \{([\s\S]*?)\};/);
    expect(m).not.toBeNull();
    const engineRequired = {};
    for (const [, action, fields] of m[1].matchAll(/'([a-z:-]+)':\s*\[([^\]]*)\]/g)) {
      engineRequired[action] = [...fields.matchAll(/'([^']+)'/g)].map(f => f[1]);
    }
    for (const [action, fields] of Object.entries(engineRequired)) {
      if (action === 'lighting:scene:activate') continue;
      if (!CUE_ACTIONS[action]) continue;
      for (const f of fields) {
        expect(CUE_ACTIONS[action].requiredFields).toContain(f);
      }
    }
  });

  it('the vocabulary excludes floor and admin actions (auth floor: session/score/transaction/system are operator-only)', () => {
    for (const action of Object.keys(CUE_ACTIONS)) {
      expect(action).not.toMatch(/^(session|score|transaction|system|held|cue|scoreboard|service|bluetooth):/);
    }
    expect(TOKEN_DERIVED_TRIGGER_EVENTS).toEqual(['player:scan', 'transaction:accepted']);
  });
});

describe('validateCuesBlock — green fixtures', () => {
  it('the migrated-form fixture set (incl. BOTH real guard cues) produces zero problems', () => {
    expect(validateCuesBlock(cuesFixture(), gameConfig(), tokens())).toEqual([]);
  });

  it('benign emptiness: nothing declared, nothing refused', () => {
    expect(validateCuesBlock(null, { id: 'plain-pack' }, {})).toEqual([]);
  });

  it('rule 3 exemption is pinned: video:* trigger tokenIds live in the engine namespace, never the pack token namespace', () => {
    // 'policesequencewoverlay' is NOT in tokens() — the guard cues must
    // stay green anyway (red-team G2: the id is minted from a video
    // FILENAME by videoQueueService, not declared by the pack).
    const onlyGuards = cuesFixture().slice(0, 2);
    expect(validateCuesBlock(onlyGuards, gameConfig(), tokens())).toEqual([]);
  });
});

describe('rule 1 — lighting roles must be declared', () => {
  it('an undeclared role in a flat command is refused as self-contradictory', () => {
    const out = problemsAfter(c => { c.cues[0].commands[1].payload.role = 'disco-mode'; });
    expect(out.join('\n')).toMatch(/disco-mode/);
    expect(out.join('\n')).toMatch(/self-contradictory/);
  });

  it('an undeclared role in a timeline entry is refused', () => {
    const out = problemsAfter(c => { c.cues[4].timeline[1].payload.role = 'disco-mode'; });
    expect(out.length).toBeGreaterThan(0);
  });

  it('a concrete sceneId in a pack lighting payload is refused (roles only; concrete ids live in the profile and lightingRoleFallbacks)', () => {
    const out = problemsAfter(c => {
      c.cues[0].commands[1].payload = { sceneId: 'scene.video' };
    });
    expect(out.join('\n')).toMatch(/scene\.video/);
  });
});

describe('rule 2 — action vocabulary + payload shape', () => {
  it('an action outside the cue-action vocabulary is a DRIVABILITY limitation naming the vocabulary', () => {
    const out = problemsAfter(c => { c.cues[3].commands[0].action = 'confetti:launch'; });
    const msg = out.join('\n');
    expect(msg).toMatch(/confetti:launch/);
    expect(msg).toMatch(/not driveable by this engine yet/);
    expect(msg).toMatch(/sound:play/); // vocabulary embedded (phases-gate precedent)
  });

  it('a floor-crossing action (session:end) is refused — pack data cannot drive operator-only functions', () => {
    const out = problemsAfter(c => { c.cues[3].commands[0] = { action: 'session:end', payload: {} }; });
    expect(out.join('\n')).toMatch(/session:end/);
  });

  it('a missing required payload field is refused (sound:play without file)', () => {
    const out = problemsAfter(c => { c.cues[3].commands[0].payload = {}; });
    expect(out.join('\n')).toMatch(/file/);
  });

  it('video:queue:add without videoFile is refused', () => {
    const out = problemsAfter(c => { delete c.cues[4].timeline[0].payload.videoFile; });
    expect(out.join('\n')).toMatch(/videoFile/);
  });
});

describe('rule 3 — token-derived trigger tokenIds resolve against the pack', () => {
  it('a transaction:accepted condition naming an undeclared token is refused', () => {
    const out = problemsAfter(c => {
      c.cues[2].trigger.conditions[0] = { field: 'tokenId', op: 'eq', value: 'ghost999' };
    });
    expect(out.join('\n')).toMatch(/ghost999/);
    expect(out.join('\n')).toMatch(/self-contradictory/);
  });

  it('an "in" list with one undeclared member is refused, naming the member', () => {
    const out = problemsAfter(c => {
      c.cues[2].trigger.conditions[0].value = ['kaa001', 'ghost999'];
    });
    expect(out.join('\n')).toMatch(/ghost999/);
  });

  it('player:scan tokenId conditions are checked the same way', () => {
    const out = problemsAfter(c => {
      c.cues[2].trigger = {
        event: 'player:scan',
        conditions: [{ field: 'tokenId', op: 'eq', value: 'ghost999' }],
      };
    });
    expect(out.join('\n')).toMatch(/ghost999/);
  });

  it('non-tokenId fields on token-derived triggers are NOT resolved against tokens', () => {
    const out = problemsAfter(c => {
      c.cues[2].trigger.conditions[0] = { field: 'teamId', op: 'eq', value: 'ghost999' };
    });
    expect(out).toEqual([]);
  });
});

describe('rule 5 — lightingRoleFallbacks keys must be declared roles', () => {
  it('a fallback for an undeclared role is refused', () => {
    const out = problemsAfter(c => {
      c.game.lightingRoleFallbacks = { 'disco-mode': 'scene.disco' };
    });
    expect(out.join('\n')).toMatch(/disco-mode/);
    expect(out.join('\n')).toMatch(/self-contradictory/);
  });
});

describe('rule 6 — pointer/requires coherence (authoring lint, D-4.1)', () => {
  it('standing triggers without cues.standing in requires are refused', () => {
    const out = problemsAfter(c => { c.game.requires = ['cues.timeline', 'lighting.roles']; });
    expect(out.join('\n')).toMatch(/cues\.standing/);
  });

  it('a timeline without cues.timeline in requires is refused', () => {
    const out = problemsAfter(c => { c.game.requires = ['cues.standing', 'lighting.roles']; });
    expect(out.join('\n')).toMatch(/cues\.timeline/);
  });

  it('lightingRoles without lighting.roles in requires is refused even with NO cues file', () => {
    const out = validateCuesBlock(null, {
      id: 'x', lightingRoles: ['gameplay'], requires: [],
    }, {});
    expect(out.join('\n')).toMatch(/lighting\.roles/);
  });

  it('a manual-only, flat, lighting-free cue set needs no capability ids (accepted D-4.1 exposure class)', () => {
    const out = validateCuesBlock(
      [{ id: 'sting', label: 'Sting', quickFire: true, commands: [{ action: 'sound:play', payload: { file: 'x.wav' } }] }],
      { id: 'x', cues: 'cues.json' },
      {}
    );
    expect(out).toEqual([]);
  });

  it('over-declaring requires is never refused here (unknown ids are the capability gate\'s job)', () => {
    const out = problemsAfter(c => { c.game.requires.push('scoring.tabular'); });
    expect(out).toEqual([]);
  });
});

describe('rule 7 — shape rules (the gate cannot assume schema validation ran)', () => {
  it('7a: a duplicate cue id is refused as self-contradictory', () => {
    const out = problemsAfter(c => { c.cues[1].id = 'attention-before-video'; });
    expect(out.join('\n')).toMatch(/duplicate/i);
    expect(out.join('\n')).toMatch(/self-contradictory/);
  });

  it('7a: an empty id or a malformed cue entry is refused with a named message, never a raw TypeError', () => {
    expect(problemsAfter(c => { c.cues[0].id = ''; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[0] = null; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[0] = 'not-a-cue'; }).length).toBeGreaterThan(0);
  });

  it('7a: commands AND timeline (or neither, or empty) is refused', () => {
    expect(problemsAfter(c => { c.cues[0].timeline = [{ at: 0, action: 'sound:play', payload: { file: 'x.wav' } }]; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { delete c.cues[0].commands; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[0].commands = []; }).length).toBeGreaterThan(0);
  });

  it('7b: an unknown trigger event is a drivability limitation; an unparseable clock is self-contradictory (it would throw per tick)', () => {
    const unknownEvent = problemsAfter(c => { c.cues[0].trigger.event = 'video:exploded'; }).join('\n');
    expect(unknownEvent).toMatch(/video:exploded/);
    expect(unknownEvent).toMatch(/not driveable by this engine yet/);

    const badClock = problemsAfter(c => { c.cues[3].trigger = { clock: '90 minutes' }; }).join('\n');
    expect(badClock).toMatch(/90 minutes/);
    expect(badClock).toMatch(/self-contradictory/);
  });

  it('7b: a trigger with BOTH event and clock (or neither) is refused', () => {
    expect(problemsAfter(c => { c.cues[0].trigger = { event: 'video:loading', clock: '00:10:00' }; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[0].trigger = {}; }).length).toBeGreaterThan(0);
  });

  it('7c: an unknown condition op is refused (unknown ops silently never fire); "in" with a scalar is the same dead class', () => {
    expect(problemsAfter(c => { c.cues[0].trigger.conditions[0].op = 'matches'; }).join('\n')).toMatch(/matches/);
    expect(problemsAfter(c => { c.cues[2].trigger.conditions[0].value = 'kaa001'; }).length).toBeGreaterThan(0);
  });

  it('7d: a timeline entry with a missing/negative/non-finite `at` or a non-string action is refused (NaN poisons maxAt)', () => {
    expect(problemsAfter(c => { delete c.cues[4].timeline[0].at; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[4].timeline[0].at = -1; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[4].timeline[0].at = Infinity; }).length).toBeGreaterThan(0);
    expect(problemsAfter(c => { c.cues[4].timeline[0].action = 7; }).length).toBeGreaterThan(0);
  });

  it('7e: a second video entry in one timeline is refused (F-SHOW-08 — the cue correlates ONE video)', () => {
    const out = problemsAfter(c => {
      c.cues[4].timeline.push({ at: 500, action: 'video:queue:add', payload: { videoFile: 'second.mp4' } });
    });
    expect(out.join('\n')).toMatch(/video/);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('two-flavor language rule (slice-1 ratification, pinned)', () => {
  it('limitations are NEVER called incoherent or self-contradictory', () => {
    const out = problemsAfter(c => { c.cues[3].commands[0].action = 'confetti:launch'; });
    const limitation = out.find(p => p.includes('not driveable'));
    expect(limitation).toBeDefined();
    expect(limitation).not.toMatch(/incoherent/i);
    expect(limitation).not.toMatch(/self-contradictory/i);
  });

  it('contradictions never borrow the drivability wording', () => {
    const out = problemsAfter(c => { c.cues[1].id = 'attention-before-video'; });
    const contradiction = out.find(p => p.includes('self-contradictory'));
    expect(contradiction).toBeDefined();
    expect(contradiction).not.toMatch(/not driveable/);
  });
});
