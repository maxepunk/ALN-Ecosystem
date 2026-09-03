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

const {
  resolveMode, wireModeIds, defaultModeId, setLegacyWarnHook,
  normalizedClaimedLabel, normalizedIcon, normalizedEntityLabel,
  LEGACY_ALN_MODES,
} = modeSemantics;

// ALN-shaped config (mirrors ALN-TokenData/game.json modes)
const ALN_CONFIG = {
  schemaVersion: 2,
  modes: [
    {
      id: 'blackmarket', label: 'Black Market', verb: 'Sell',
      scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true,
      displayBehavior: { surface: 'scoreboard-rankings', when: 'immediate' },
      claimedLabel: 'SOLD to {entity}', icon: '💰',
    },
    {
      id: 'detective', label: 'Detective', verb: 'Expose',
      scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'Nova',
      countsTowardGroups: false,
      displayBehavior: { surface: 'scoreboard-evidence', fields: ['summary', 'owner'], when: 'immediate' },
      claimedLabel: 'EXPOSED by {entity}', icon: '🔍',
    },
  ],
};

// Toy-shaped config (mirrors toy-heist game.json modes) — the open-vocabulary
// proof: NONE of these ids appear anywhere in engine code.
const TOY_CONFIG = {
  schemaVersion: 2,
  modes: [
    {
      id: 'fence', label: 'Fence', verb: 'Fence',
      scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true,
      displayBehavior: { surface: 'scoreboard-rankings', when: 'immediate' },
      claimedLabel: 'FENCED by {entity}', icon: '💼',
    },
    {
      id: 'tipoff', label: 'Tip-Off', verb: 'Leak',
      scoringPolicy: 'none', entityRole: 'attribution', defaultEntity: 'The Dispatcher',
      countsTowardGroups: false,
      displayBehavior: { surface: 'scoreboard-evidence', fields: ['summary'], when: 'immediate' },
      claimedLabel: 'TIPPED by {entity}', icon: '🕵️',
    },
    {
      id: 'appraise', label: 'Appraise', verb: 'Appraise',
      scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false,
      displayBehavior: { surface: 'none' },
      claimedLabel: 'APPRAISED by {entity}', icon: '🔍',
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
      id: 'blackmarket', label: 'Black Market', verb: 'Sell', verbNoun: null,
      scoringPolicy: 'standard', entityRole: 'ledger', defaultEntity: null,
      countsTowardGroups: true, claims: 'consuming',
      claimedLabel: 'SOLD to {entity}', icon: '💰',
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

  it('normalizes absent claims to consuming — the legacy behavior (D3s2)', () => {
    const config = {
      modes: [
        { id: 'm', label: 'M', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false },
        { id: 'nc', label: 'NC', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false, claims: 'non-consuming' },
      ],
    };
    expect(resolveMode(config, 'm').claims).toBe('consuming');
    expect(resolveMode(config, 'nc').claims).toBe('non-consuming');
    // The baked ALN shim modes are consuming too (no claims field)
    expect(resolveMode(null, 'blackmarket').claims).toBe('consuming');
  });

  it('returns a defensive copy — mutating the record cannot corrupt the config', () => {
    const record = resolveMode(ALN_CONFIG, 'detective');
    record.displayBehavior.fields.push('corrupted');
    record.scoringPolicy = 'standard';
    expect(resolveMode(ALN_CONFIG, 'detective').displayBehavior.fields).toEqual(['summary', 'owner']);
    expect(resolveMode(ALN_CONFIG, 'detective').scoringPolicy).toBe('none');
  });
});

describe('presentation-field normalization (R-Q2 — the scanner-mirror half of the parity claim)', () => {
  it('resolveMode carries normalized claimedLabel/icon; absent fields normalize to null', () => {
    expect(resolveMode(TOY_CONFIG, 'fence').claimedLabel).toBe('FENCED by {entity}');
    expect(resolveMode(TOY_CONFIG, 'fence').icon).toBe('💼');
    const bare = { modes: [{ id: 'm', label: 'M', scoringPolicy: 'none', entityRole: 'ledger', countsTowardGroups: false }] };
    expect(resolveMode(bare, 'm').claimedLabel).toBeNull();
    expect(resolveMode(bare, 'm').icon).toBeNull();
  });

  it('normalizedClaimedLabel requires exactly one {entity} and no other braces (value-level, silent)', () => {
    expect(normalizedClaimedLabel('SOLD to {entity}')).toBe('SOLD to {entity}');
    expect(normalizedClaimedLabel('{entity} strikes')).toBe('{entity} strikes');
    expect(normalizedClaimedLabel('CLAIMED')).toBeNull();
    expect(normalizedClaimedLabel('{entity} beats {entity}')).toBeNull();
    expect(normalizedClaimedLabel('SOLD to {entity} {x}')).toBeNull();
    expect(normalizedClaimedLabel(42)).toBeNull();
    // control/bidi strip happens BEFORE the template check
    expect(normalizedClaimedLabel('SOLD\u202e to {entity}')).toBe('SOLD to {entity}');
  });

  it('normalizedIcon accepts 1-4 plain code points; markup/empty/over-long/non-string decline', () => {
    expect(normalizedIcon('💰')).toBe('💰');
    expect(normalizedIcon('💰⭐')).toBe('💰⭐');
    expect(normalizedIcon('<b>')).toBeNull();
    expect(normalizedIcon('')).toBeNull();
    expect(normalizedIcon('💰💰💰💰💰')).toBeNull();
    expect(normalizedIcon(7)).toBeNull();
  });

  it('normalizedEntityLabel requires non-empty singular AND plural strings', () => {
    expect(normalizedEntityLabel({ singular: 'Account', plural: 'Accounts' }))
      .toEqual({ singular: 'Account', plural: 'Accounts' });
    expect(normalizedEntityLabel({ singular: '', plural: 'Xs' })).toBeNull();
    expect(normalizedEntityLabel({ singular: 'X' })).toBeNull();
    expect(normalizedEntityLabel('Account')).toBeNull();
    expect(normalizedEntityLabel(undefined)).toBeNull();
  });

  it('the baked ALN shim carries the byte-identical legacy announcements', () => {
    setLegacyWarnHook(() => {});
    expect(resolveMode(null, 'blackmarket').claimedLabel).toBe('SOLD to {entity}');
    expect(resolveMode(null, 'blackmarket').icon).toBe('💰');
    expect(resolveMode(null, 'detective').claimedLabel).toBe('EXPOSED by {entity}');
    expect(resolveMode(null, 'detective').icon).toBe('🔍');
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

describe('verbNoun (slice 7 — the report Type-cell noun)', () => {
  const { normalizedVerbNoun } = modeSemantics;
  const gameWithVerbNoun = {
    modes: [
      { id: 'fence', label: 'Fence', scoringPolicy: 'standard', entityRole: 'ledger', countsTowardGroups: true, verbNoun: 'Fence' },
      { id: 'plain', label: 'Plain', scoringPolicy: 'none', entityRole: 'attribution', countsTowardGroups: false },
    ],
  };

  it('normalizedVerbNoun accepts a short noun, strips control/bidi, refuses table-breakers (value-level, silent)', () => {
    expect(normalizedVerbNoun('Sale')).toBe('Sale');
    expect(normalizedVerbNoun('Hot Tip')).toBe('Hot Tip');
    expect(normalizedVerbNoun('Sa‎le')).toBe('Sale');
    expect(normalizedVerbNoun('Sa|le')).toBeNull();
    expect(normalizedVerbNoun('Sa{le}')).toBeNull();
    expect(normalizedVerbNoun('')).toBeNull();
    expect(normalizedVerbNoun('x'.repeat(25))).toBeNull();
    expect(normalizedVerbNoun(7)).toBeNull();
  });

  it('counts CODE POINTS, not UTF-16 units (JSON Schema maxLength semantics — the schema cap and this twin must agree)', () => {
    expect(normalizedVerbNoun('💰'.repeat(13))).toBe('💰'.repeat(13)); // 26 units, 13 code points — legal
    expect(normalizedVerbNoun('💰'.repeat(25))).toBeNull(); // 25 code points — over the cap
  });

  it('resolveMode carries a declared verbNoun and normalizes absence to null', () => {
    expect(resolveMode(gameWithVerbNoun, 'fence').verbNoun).toBe('Fence');
    expect(resolveMode(gameWithVerbNoun, 'plain').verbNoun).toBeNull();
  });

  it('the baked ALN table declares blackmarket verbNoun Sale (with the drift tripwire binding it)', () => {
    expect(LEGACY_ALN_MODES.find((m) => m.id === 'blackmarket').verbNoun).toBe('Sale');
    expect(LEGACY_ALN_MODES.find((m) => m.id === 'detective').verbNoun).toBeUndefined();
  });
});
