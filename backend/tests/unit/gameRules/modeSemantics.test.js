/**
 * modeSemantics — the modes seam (Phase 3 A3 slice 1)
 *
 * Covers: flag resolution against pack-declared modes (open vocabulary),
 * record normalization, wire-id derivation, pack-default selection, and
 * the legacy ALN shim (ledger L6) including its drift tripwire against
 * the real ALN game.json.
 */

const fs = require('fs');
const path = require('path');
const modeSemantics = require('../../../src/gameRules/modeSemantics');

const { resolveMode, wireModeIds, defaultModeId, setLegacyWarnHook, LEGACY_ALN_MODES } = modeSemantics;

// ALN-shaped config (mirrors ALN-TokenData/game.json modes)
const ALN_CONFIG = {
  schemaVersion: 1,
  modes: [
    {
      id: 'blackmarket', label: 'Black Market', verb: 'Sell',
      scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true,
      displayBehavior: { surface: 'scoreboard-rankings', when: 'immediate' },
    },
    {
      id: 'detective', label: 'Detective', verb: 'Expose',
      scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'Nova',
      countsTowardGroups: false,
      displayBehavior: { surface: 'scoreboard-evidence', fields: ['summary', 'owner'], when: 'immediate' },
    },
  ],
};

// Toy-shaped config (mirrors toy-heist game.json modes) — the open-vocabulary
// proof: NONE of these ids appear anywhere in engine code.
const TOY_CONFIG = {
  schemaVersion: 1,
  modes: [
    {
      id: 'fence', label: 'Fence', verb: 'Fence',
      scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true,
      displayBehavior: { surface: 'scoreboard-rankings', when: 'immediate' },
    },
    {
      id: 'tipoff', label: 'Tip-Off', verb: 'Leak',
      scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'The Dispatcher',
      countsTowardGroups: false,
      displayBehavior: { surface: 'scoreboard-evidence', fields: ['summary'], when: 'immediate' },
    },
    {
      id: 'appraise', label: 'Appraise', verb: 'Appraise',
      scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false,
      displayBehavior: { surface: 'none' },
    },
  ],
};

beforeEach(() => {
  modeSemantics._resetForTesting();
});

describe('resolveMode — pack-declared flags', () => {
  it('resolves a standard/ledger/counting mode (ALN blackmarket)', () => {
    const record = resolveMode(ALN_CONFIG, 'blackmarket');
    expect(record).toEqual({
      id: 'blackmarket', label: 'Black Market', verb: 'Sell',
      scoringPolicy: 'standard', entityRole: 'ledger', defaultEntity: null,
      countsTowardGroups: true,
      displayBehavior: { surface: 'scoreboard-rankings', fields: [], when: 'immediate' },
    });
  });

  it('resolves a none/attribution mode with defaultEntity (ALN detective)', () => {
    const record = resolveMode(ALN_CONFIG, 'detective');
    expect(record.scoringPolicy).toBe('none');
    expect(record.entityRole).toBe('attribution');
    expect(record.defaultEntity).toBe('Nova');
    expect(record.countsTowardGroups).toBe(false);
    expect(record.displayBehavior).toEqual({
      surface: 'scoreboard-evidence', fields: ['summary', 'owner'], when: 'immediate',
    });
  });

  it('resolves modes the engine has never heard of (open vocabulary)', () => {
    expect(resolveMode(TOY_CONFIG, 'fence').scoringPolicy).toBe('standard');
    expect(resolveMode(TOY_CONFIG, 'tipoff').defaultEntity).toBe('The Dispatcher');
    expect(resolveMode(TOY_CONFIG, 'appraise').displayBehavior.surface).toBe('none');
  });

  it('returns null for a mode id the config does not declare', () => {
    expect(resolveMode(ALN_CONFIG, 'fence')).toBeNull();
    expect(resolveMode(TOY_CONFIG, 'blackmarket')).toBeNull();
    expect(resolveMode(ALN_CONFIG, undefined)).toBeNull();
    expect(resolveMode(ALN_CONFIG, '')).toBeNull();
  });

  it('normalizes an absent displayBehavior to {surface: none, fields: [], when: immediate}', () => {
    const config = { modes: [{ id: 'silent', label: 'Silent', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false }] };
    expect(resolveMode(config, 'silent').displayBehavior).toEqual({
      surface: 'none', fields: [], when: 'immediate',
    });
  });

  it('coerces countsTowardGroups strictly (only literal true counts)', () => {
    const config = { modes: [{ id: 'm', label: 'M', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: 'yes' }] };
    expect(resolveMode(config, 'm').countsTowardGroups).toBe(false);
  });

  it('returns a defensive copy — mutating the record cannot corrupt the config', () => {
    const record = resolveMode(ALN_CONFIG, 'detective');
    record.displayBehavior.fields.push('corrupted');
    record.scoringPolicy = 'standard';
    expect(resolveMode(ALN_CONFIG, 'detective').displayBehavior.fields).toEqual(['summary', 'owner']);
    expect(resolveMode(ALN_CONFIG, 'detective').scoringPolicy).toBe('none');
  });
});

describe('wireModeIds / defaultModeId', () => {
  it('derives wire ids in declaration order', () => {
    expect(wireModeIds(ALN_CONFIG)).toEqual(['blackmarket', 'detective']);
    expect(wireModeIds(TOY_CONFIG)).toEqual(['fence', 'tipoff', 'appraise']);
  });

  it('defaults to the FIRST declared mode', () => {
    expect(defaultModeId(ALN_CONFIG)).toBe('blackmarket');
    expect(defaultModeId(TOY_CONFIG)).toBe('fence');
  });
});

describe('legacy ALN shim (debt ledger L6)', () => {
  it('null/absent gameConfig resolves against the baked ALN table', () => {
    expect(resolveMode(null, 'blackmarket').scoringPolicy).toBe('standard');
    expect(resolveMode(null, 'detective').entityRole).toBe('attribution');
    expect(resolveMode(undefined, 'fence')).toBeNull();
    expect(wireModeIds(null)).toEqual(['blackmarket', 'detective']);
    expect(defaultModeId(null)).toBe('blackmarket');
  });

  it('an empty modes array rides the shim too (a pack with no modes is not driveable)', () => {
    expect(wireModeIds({ modes: [] })).toEqual(['blackmarket', 'detective']);
  });

  it('warns LOUDLY exactly once per process when the shim engages', () => {
    const warns = [];
    setLegacyWarnHook((msg) => warns.push(msg));

    resolveMode(null, 'blackmarket');
    resolveMode(null, 'detective');
    wireModeIds(null);

    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('LEGACY MODE TABLE ACTIVE');
    expect(warns[0]).toContain('L6');
  });

  it('does NOT warn when a real config is supplied', () => {
    const warns = [];
    setLegacyWarnHook((msg) => warns.push(msg));

    resolveMode(ALN_CONFIG, 'blackmarket');
    wireModeIds(TOY_CONFIG);

    expect(warns).toHaveLength(0);
  });

  it('DRIFT TRIPWIRE: the baked table mirrors the real ALN game.json modes block exactly', () => {
    // The shim must never drift from the pack it stands in for. This reads
    // the actual submodule file — monorepo-relative, same convention as the
    // pack contract suite.
    const gamePath = path.join(__dirname, '../../../../ALN-TokenData/game.json');
    const realModes = JSON.parse(fs.readFileSync(gamePath, 'utf8')).modes;
    expect(JSON.parse(JSON.stringify(LEGACY_ALN_MODES))).toEqual(realModes);
  });
});
