# Phase 3 A3 Slice 1 — Modes to Open-Vocabulary Semantics Flags (design)

**Date:** 2026-07-18
**Status:** DRAFT for owner review — decisions D1–D3 open, everything else
proposed-with-rationale. Companion: program §3 slice 1, pack-schemas §1
(modes block) + addendum 4, adversarial R3/R9/R12, BILL scoping §2.1.
**Ground truth this design is built on (censused 2026-07-18, not
estimated):** 39 mode-literal branch points — backend 8 sites / 4 files
(`transactionService.js`, `models/transaction.js`, `gameRules/scoring.js`,
`utils/validators.js` Joi enum), scanner 31 sites / 10 files (uiManager,
settings, GameOpsRenderer, EvidencePickerRenderer, gameOps domain,
initializationSteps, sessionReportGenerator, LocalStorage,
IStorageStrategy, unifiedDataManager).

## 1. What slice 1 is (and is not)

Migrate mode BEHAVIOR from the literals `'blackmarket'`/`'detective'` to
the pack's per-mode semantics flags. After this slice the engine asks
"what does this mode DO" (flags), never "which of the two known modes is
this" (string equality). ALN keeps its mode ids on the wire through
Phase 3 (R12 skew policy); nothing renames.

NOT in slice 1: rule TABLES and policy variants (slice 2), formatting
logic and star/currency rendering (3b), CSS mode taxonomy (3c), per-mode
theming and >3-mode ergonomics (Track D), any effects machinery beyond
today's semantics (E5 — but see §3's shape constraint).

## 2. The flag vocabulary (v1 = what exists, stated openly)

Per-mode fields (all already in game.schema.json):

| Flag | v1 values ENGINE DRIVES | Openness rule |
|---|---|---|
| `scoringPolicy` | `standard` (tables), `none` | Schema: string. GATE: a mode whose scoringPolicy the engine doesn't implement is UNDRIVABLE → activation refused (the F2 principle at mode level). Future values (`graph`, …) arrive WITH their engine module + capability id. |
| `entityRole` | `ledger`, `attribution` | Same gate rule. Orthogonal to scoringPolicy by design — a future scored-attributed mode is schema-legal today. |
| `countsTowardGroups` | `true`/`false` | Boolean, engine-complete. |
| `displayBehavior.surface` | `scoreboard-rankings`, `scoreboard-evidence`, `none` | Same gate rule. `none` = transaction accepted, nothing publicly displayed (toy `appraise`). B12/slice 6 later makes the surface set itself pack-extensible; the RESOLUTION seam built here is what it plugs into. |
| `verb`, `label`, `defaultEntity` | strings | Presentation/prefill — never branched on. |

**Openness = three concrete properties** (BILL scoping §2.1 made real):
(1) N modes, not 2 — everything iterates `gameConfig.modes`;
(2) flag VALUES are open strings gated by engine capability, not closed
schema enums;
(3) new FLAGS arrive by schema evolution (schemaVersion bump + gate),
never by loosening `additionalProperties` — a typo'd flag name must stay
a validation error, not silent dead data.

**Proto-verb honesty:** ALN/toy modes are single-object verbs. BILL's
compound verbs add actor-gating + object sequences (E5). Slice 1's
commitment is only: mode = named action + semantics record, resolved
through ONE seam. E5 widens the record; it must not need a second seam.

## 3. Architecture: the modeSemantics seam

One new pure module per side (the parity surface extends to modes):

- **Backend:** `src/gameRules/modeSemantics.js` —
  `resolveMode(gameConfig, modeId)` → the flags record;
  `wireModeIds(gameConfig)` → the valid-id list for validation.
  Null/absent gameConfig (packs without game.json — see §5 parity-pack
  fix) → the LEGACY ALN table, baked here as the loud-warn shim (exactly
  the ledger-L2 pattern; new ledger row L5, retires when every pack in
  play ships game.json).
- **Scanner:** `src/core/modeSemantics.js`, same resolution against the
  packLoader's gameConfig. Unknown mode/flag value at the CLIENT logs
  loudly and disables that mode's UI affordance (the server gate is the
  authority; the client defends in depth).

All 39 sites consult the seam. Backend examples: transactionService's
"skip scoring unless blackmarket" → `scoringPolicy === 'standard'`;
group counting → `countsTowardGroups`; scoreboard routing →
`displayBehavior.surface`. Scanner examples: LocalStorage's scoring gate,
report sections (evidence log = modes with surface `scoreboard-evidence`;
transaction listing = `standard` modes), EvidencePicker gating, settings
toggle (§6).

**Validation:** `validators.js` Joi mode enum → dynamic check against
`wireModeIds()`. CONTRACT-FIRST: openapi/asyncapi mode fields change from
the two-value enum to `type: string` + documented runtime-validation
rule, in the same commit as the validator (the pack-schemas addendum 2
correction becomes true here).

**Gate extension (this slice):** `_gateCheck` gains mode-drivability —
every declared mode's scoringPolicy/entityRole/surface must be in the
engine's implemented sets, else LOUD refusal listing the undrivable
mode(s). ENGINE_CAPABILITIES gains nothing yet (D1 governs how it grows
later): drivability derives from the mode records; `requires` remains the
pack's explicit extra declaration.

## 4. Coherence validator (R9)

Lives beside the gate (`_coherenceCheck`), runs at activation AND in the
pack contract suite. The gate answers "can the engine run each field";
coherence answers "do the fields contradict each other."

Hard errors (refuse activation):
- `scoringPolicy: 'none'` ∧ `countsTowardGroups: true` — group progress
  that can never pay out is an authoring bug, not a mechanic.
- `defaultEntity` present ∧ `entityRole: 'ledger'` — prefilling a wallet
  name is cross-wired semantics.
- Duplicate mode ids; empty modes array.

Deliberately LEGAL (documented so nobody "fixes" them):
- `entityRole: 'attribution'` ∧ `scoringPolicy: 'standard'` (future
  scored-attributed modes);
- `displayBehavior.surface: 'none'` with any scoringPolicy (silent
  modes are a real design tool);
- `scoringPolicy: 'none'` ∧ `entityRole: 'ledger'` — see D2.

## 5. Fixture + migration mechanics

- **parity-pack gets a minimal game.json** (two ALN-shaped modes) so the
  scoring-parity flows exercise the seam rather than the L5 shim. The
  shim path keeps its own unit tests.
- Both real packs' game.json already carry full flag records (A1) — no
  pack edits needed beyond D2's appraise resolution.
- Slice gate: dual-pack Tier L green + the new modeSemantics unit suites
  on both sides + contract tests pinning wire-validation behavior
  (unknown mode rejected with the same error shape as today).

## 6. UI boundary (R3 — scope ENDS here)

The binary game-mode toggle (settings + gameOps) becomes a segmented
selector rendered from `gameConfig.modes` (`label` text, `id` value),
both operation modes. Persisted `Settings.mode` validated against the
active pack's ids at startup — a stale id (pack switched under a saved
setting) resets to `modes[0]` with a loud log. Scoreboard/evidence
surfaces render by `displayBehavior.surface`. Everything visual beyond
that (badge styling, >3-mode layout, per-mode theming) is Track D, and
the toy pack stays within what the segmented control renders.

## 7. Open decisions (owner)

**D1 — capability-id naming convention (pre-slice-1, binds the gate's
wire vocabulary forever).** PROPOSED: lowercase `area.variant` where
`area` = the game.json block governed (`scoring`, `groupRules`,
`duplicatePolicy`, `clock`, `surfaces`, `interaction`) and `variant`
names the model (`scoring.tabular`, `scoring.graph`, `groupRules.all`,
`groupRules.threshold`, `interaction.compound-scan`). Ids are
append-only: never renamed or removed while any deployed engine reads
them; adding = engine minor bump, removing = major. The slice-0 baseline
already follows this shape.

**D2 — `appraise` semantics (R9's forced example).** As authored
(`none`+`ledger`+surface `none`), appraising CLAIMS a token FCFS for $0 —
a consuming evaluation. Options:
  (a) RATIFY consuming-appraise: a real risk mechanic, drivable today
      with zero new machinery; revisit at slice 2 if wanted. (RECOMMENDED
      — and it keeps `none`+`ledger` as the documented "claim recorded,
      nothing scored" reading.)
  (b) Non-claiming appraise: requires a per-mode `claims` flag whose
      enforcement lives in duplicatePolicy — that migration is SLICE 2
      scope, so the flag would be schema-dead for a slice (gate doctrine
      says a declared-but-unenforced flag is exactly the silent-headroom
      class we refuse). If chosen: appraise stays consuming until
      slice 2 lands `claims`, then flips.
  (c) Drop appraise — rejected by default: the 3-mode pack is what
      forces the R3 selector to be actually data-driven.

**D3 — coherence severity posture.** PROPOSED: the §4 hard-error list
refuses activation (same channel as the gate); everything else is legal
and documented — no warning tier in slice 1 (warnings that gate nothing
rot into noise; a future authoring-time lint in the B pages is the right
home for advisories).

## 8. Estimate

≈1.5–2.5 sessions honest (census-based: 8 backend sites are one focused
pass; 31 scanner sites + selector UI + both contract files + parity-pack
fixture + coherence/gate tests carry the bulk). Within the program §9
re-priced A3 envelope.
