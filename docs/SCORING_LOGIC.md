# ALN Scoring Logic - Single Source of Truth

Last verified: 2026-07-18 (A3 slice 2 rewrite — the commit that changed scoring truth)

## Overview

This document defines how scoring WORKS in the ALN engine and where the
values COME FROM. Since Phase 3 A3 slice 2 there is exactly one shared
source of scoring values: **the active game pack's `game.json` `scoring`
block** (`ALN-TokenData/game.json` for the production ALN pack). The
legacy `scoring-config.json` is retired (debt ledger L1, closed) and the
engine formulas below apply to WHATEVER tables the pack declares.

The dollar values shown in this document are the **ALN production pack's**
tables — they are an example of a pack, not engine constants. A different
pack (e.g. the toy-heist fixture) legitimately declares different values,
and the dual-pack test gate runs both.

## Value Delivery Architecture (Phase 3 A2/A3)

| Consumer | Read path | Fallback when the pack has no usable scoring block |
|----------|-----------|-----------------------------------------------------|
| Backend | `packService.getScoringRules()` → `tokenService.calculateTokenValue` (token values bake at boot, same moment as `activatePack()`) | Baked legacy ALN table (`LEGACY_ALN_SCORING`), LOUD once-per-process warn, drift-tripwired against ALN `game.json` |
| GM Scanner (standalone) | Runtime pack load: `packLoader` → `applyPackScoring(gameConfig.scoring)` in `src/core/scoring.js` | Vendored baked table (ledger L2), LOUD `[scoring] LEGACY SHIM ACTIVE` warn, drift-tripwired against `data/game.json` |
| E2E expectations | `loadPackScoring(orchestratorUrl)` — fetched from the RUNNING orchestrator's pack channel (single oracle, ledger L5 retired) | None — calculators THROW on a missing oracle |
| Post-session validators | `scripts/lib/scoringConfigLoader.js` → `ALN-TokenData/game.json` scoring | None — throws (a validator must never validate against baked constants) |

**Normalization (backend `getScoringRules()`):** rating keys become
numbers, type keys are LOWERCASED, and an `unknown` multiplier is always
present (0 unless the pack overrides it). Lookups use `??` (not `||`) so a
pack may legitimately declare a `0` multiplier.

**Rules freeze at boot:** the pack snapshot is frozen by
`packService.activatePack()`. A pack publish changes scoring only on the
next orchestrator restart (backend) / next pack load (scanner) — never
mid-session.

## ALN Production Pack Tables (`ALN-TokenData/game.json` `scoring`)

### Base Values (SF_ValueRating)

| Rating | Value |
|--------|-------|
| 1 | $10,000 |
| 2 | $25,000 |
| 3 | $50,000 |
| 4 | $75,000 |
| 5 | $150,000 |

### Type Multipliers (SF_MemoryType)

| Type | Multiplier |
|------|------------|
| Personal | 1x |
| Mention | 3x |
| Business | 3x |
| Party | 5x |
| Technical | 5x |
| UNKNOWN / empty | 0x (no points) |

**Empty Field Handling (engine rule, pack-independent):**
- Missing/empty/undeclared `SF_MemoryType` scores with the `unknown`
  multiplier (0x unless the pack declares otherwise = $0)
- Missing/empty `SF_ValueRating` defaults to $0 base value

## Token Score Formula (engine rule)

```
tokenScore = scoring.baseValues[valueRating] × scoring.typeMultipliers[memoryType]
```

**Examples (ALN tables):**
- 1-star Personal: $10,000 × 1 = $10,000
- 3-star Business: $50,000 × 3 = $150,000
- 5-star Technical: $150,000 × 5 = $750,000

## Group Completion Bonus (engine rule)

When a team collects ALL tokens in a group, they receive a bonus multiplier.

**Requirements:**
- Group must have 2+ tokens
- Group multiplier must be > 1x
- Team must collect ALL tokens in the group

**Formula:**
```
bonus = (groupMultiplier - 1) × totalGroupBaseScore
```

**Example: "Server Logs (x5)" group (ALN tables)**
- Group contains 3 tokens worth $15,000 base
- Team collects all 3 tokens
- Bonus = (5 - 1) × $15,000 = $60,000
- Total group value = $15,000 + $60,000 = $75,000

Note: the pack's `groupRules` block declares `{type, minSize,
bonusFormula}`. The engine currently implements exactly the declared ALN
table (`all` / `2` / `multiplier-minus-one-times-base`); the pack gate
refuses any other declaration with a named "slice 2 implements the
declared table only" error rather than silently ignoring it.

## Implementation Locations

| Component | File | Symbol | Notes |
|-----------|------|--------|-------|
| Pack Rules (authoritative) | `ALN-TokenData/game.json` | `scoring` block | Per-pack tables; sole shared source since L1 retired |
| Backend Rules Read | `backend/src/services/packService.js` | `getScoringRules()` | Normalized snapshot of the active pack; loud baked shim for packless checkouts |
| Backend Token Values | `backend/src/services/tokenService.js` | `calculateTokenValue` | Bakes `Token.value` at load from the active pack |
| Backend Group Logic | `backend/src/gameRules/scoring.js` | `isGroupComplete` / `groupBonusAmount` | Pure functions, adapted by `transactionService.js` `processScan` (live scan path) and the post-deletion rebuild |
| GM Scanner Config | `ALNScanner/src/core/scoring.js` | `SCORING_CONFIG` / `applyPackScoring` | Runtime pack scoring; vendored baked shim (ledger L2) warns LOUDLY when active |
| GM Scanner Group Logic | `ALNScanner/src/core/storage/LocalStorage.js` | `_checkGroupCompletion` | Client-side group completion and bonus calculation (standalone mode) |

## CRITICAL: Parity Warning

The GROUP-COMPLETION logic is implemented in TWO places with a subtle
timing difference (values are shared via the pack; the rules code is not):

**Networked Mode (Backend)**
- Backend calculates score during scan processing
- Group completion check **includes the current token being scanned**
- This is the authoritative calculation

**Standalone Mode (GM Scanner)**
- GM Scanner calculates locally when offline
- Group completion check runs **after transaction is added**
- May have subtle timing differences in edge cases

**Maintenance Rule:**
When updating scoring logic, you MUST:
1. Update BOTH implementation files (`gameRules/scoring.js` is the parity
   surface the scanner implementation must match)
2. Verify behavior against BOTH packs (ALN + toy-heist — the dual-pack gate)
3. Test group completion behavior in both modes
4. Document any intentional differences

**Known, ACCEPTED divergences (verified by the 2026-06-11 merge-readiness
review — core rules agree: blackmarket-only, min-2-token groups):**

1. **Group-bonus base source.** Backend computes the bonus from CATALOG
   values at completion time (`gameRules/scoring.js`); the GM Scanner's
   standalone path sums the RECORDED transaction points
   (`LocalStorage._checkGroupCompletion`). These differ only if a token's
   catalog value changes mid-session — impossible on both sides, because
   rules freeze at pack activation (backend) / pack load (scanner) and a
   pack publish never lands mid-session. Accepted; do not "fix" one side
   without the other.
2. **x1 groups in completedGroups.** Backend records completion for
   multiplier-1 groups (bonus = 0); the scanner does not track them. No
   scoring impact — display/bookkeeping difference only. Accepted.

Both divergences dissolve when one rules implementation serves both modes
(Phase 3 C-track direction; not yet scheduled).

## tokens.json SF_Group Format

Groups are specified in `tokens.json` with the format:
```
"SF_Group": "Group Name (xN)"
```

Where `N` is the multiplier. Examples:
- `"Server Logs (x5)"` - 5x multiplier group
- `"Email Archives (x3)"` - 3x multiplier group
- `""` - No group (standalone token)

## Non-Scoring Modes

Modes are pack-declared (slice 1, `game.json` `modes[]`). A mode with
`scoringPolicy: 'none'` (ALN's `detective`) records transactions but
scores nothing — ALN detective display uses star ratings for PRESENTATION
only. Mode semantics live in `modeSemantics.js` (both sides), not here.

## Score Floor (`scoring.semantics.allowNegative` — slice 2 closer D2s2)

Team scores are SIGNED. The pack declares whether they may go negative
(`scoring.semantics.allowNegative`; ALN `true`, toy-heist `false`;
absent semantics on a declared scoring block = conservative floor):

- **allowNegative true**: admin adjustments may take a team below zero;
  the negative persists, restores, and broadcasts (the wire contracts
  never had a minimum).
- **allowNegative false**: an adjustment that would cross zero is
  REJECTED before it records (never silently clamped — the adjustment
  ledger stays additive for the post-session validators). The one
  reachable negative is a deletion-rebuild whose base an accepted
  adjustment leaned on: the rebuild FLOORS at 0 with a loud warn, and
  the session validator models the same floor.

Enforcement: backend `transactionService.adjustTeamScore` +
`rebuildScoresFromTransactions`; scanner `LocalStorage.adjustTeamScore`
+ `_recalculateTeamScores` (parity-pinned).

## Claims and Scoring (per-mode `claims` flag — slice 2 closer D3s2)

A mode's `claims` flag ('consuming' default | 'non-consuming') is a
DUPLICATE-RULES concern, but it touches scoring truth in one place: a
non-consuming mode may not declare `countsTowardGroups` (refused at
activation — non-consumed group presence has no contribution semantics
yet), so non-consuming claims are invisible to BOTH group currencies
(completion and bonus base) by construction. The scanner defends in
depth by driving the combination with `countsTowardGroups: false` when a
never-gated bundled pack ships it.

## Phases (gate only — slice 2 closer D1s2)

`gameClock.phases` beyond the degenerate single-phase-at-0 refuses at
activation ("not driveable by this engine yet (see slice 5)"). Phases do
not touch scoring today; recorded here because the same activation gate
family protects the scoring blocks above.
