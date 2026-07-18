# Phase 3 A3 Slice 2 — Rules Migration & Gate Headroom-Rejection (design)

**Date:** 2026-07-18
**Status:** DRAFT for owner ratification (program §12.3: slice 2 does NOT
open without this consolidated restatement + honest re-price; it also does
not open before the slice-1 gate is CI-green). Decisions D1s2–D4s2 in §6
need owner answers.
**Ground truth this draft is built on (censused 2026-07-18, not
estimated):** every consumer/obligation in §2 was located by grep/read the
day this doc was written; both real packs' rule blocks were diffed (§3).

## 1. What slice 2 is (and is not)

The backend stops being pack-blind: scoring, group, duplicate, and clock
RULES are read from the active pack's game.json (via the slice-0
`packService.getGameConfig()` snapshot), the legacy `scoring-config.json`
retires, and the capability gate flips remaining declared-but-unread rule
headroom from silently-ignored to LOUDLY-REJECTED. The slice-1 flavor-ii
coherence refusal retires behind scored-only group-contribution semantics.

NOT in slice 2: rule-table VARIANTS beyond what the packs declare today
(threshold/ordered groups, per-entity claims — the gate names them and
refuses); `scoring.display` formatting (slice 3b owns the currency/star
formatters; see §2k); phases EXECUTION (slice 5 — slice 2 only gates it,
§2g); tokens v2 (slice 2b).

## 2. Consolidated obligations register (the §12.3 point of this doc)

Each row: WHAT, WHERE (censused), SOURCE of the obligation.

**a. Backend scoring migration.** `src/config/index.js` (valueRating map
from `scoring-config.json`, hardcoded fallback) → pack `scoring` block via
`getGameConfig()`. NOTE: `Token.value` is BAKED at load from that map —
token values must derive from the ACTIVE pack at the same boot moment
(`initializeServices` already couples `activatePack()` + token load).
Packless checkouts fall back to the baked legacy table with a loud warn
(the L6 shim doctrine, same family). [program §3]

**b. L1 retirement.** `scoring-config.json` DELETED from ALN-TokenData in
the same coordinated change; the migration-parity contract pin
(`tests/contract/pack/pack-schemas.test.js:132`) deletes with it, as its
own comment instructs. The tokens-schema scoreability test
(`tests/contract/token-data/tokens-schema.test.js:69`) re-points at
`game.json.scoring`. [ledger L1]

**c. L5 retirement.** Backend-authoritative E2E flows switch to the pack
oracle: `tests/e2e/helpers/scoring.js` callers stop defaulting to the
legacy table; the TWO-ORACLE comment block retires. [ledger L5]

**d. Precision on the other ledger rows.** L2 (scanner baked scoring
shim) does NOT retire here — its trigger is final-cutover + one cycle.
L6 (mode-table shims both sides) does NOT retire here — it retires when
every pack in play ships game.json. Slice 2 retires exactly L1 + L5.

**e. Clock consumption.** `config.session.sessionTimeout` is the sole
duration source today (`sessionService.js:64,74,248`,
`syncHelpers.js:163`); pack `gameClock.duration`/`overtimeAt` are never
read, and the toy pack ALREADY diverges silently (3600/3300 vs config
7200; overtime==duration for ALN, distinct for toy — the F2 tripwire
working as designed). Migration: duration + overtimeAt from
`getGameConfig().gameClock` with config fallback for packless checkouts;
DELETE the masking contract pin (`pack-schemas.test.js:143-146`), per its
design. [program §3, audit F2]

**f. Group-contribution semantics + flavor-ii retirement (D3, ratified
2026-07-18).** `gameRules/scoring.js#groupBonusAmount` computes from
token CATALOG values — the sole reason `scoringPolicy:'none' ∧
countsTowardGroups` is refused today. Redefine: completion counts any
counting-mode claim; the BONUS BASE sums only SCORED contributions
(none-mode claims contribute presence + $0). Then DELETE the flavor-ii
refusal in `packService._coherenceCheck` and its language-rule tests —
event-only groups become legal with zero new vocabulary. PARITY: the
scanner's `LocalStorage._checkGroupCompletion` + bonus math must move in
the same slice (the mode half moved in slice 1; this is the rules half of
the same surface). [slice-1 design §4; program §12.2]

**g. Phases gate (NEW census finding).** Both packs declare
`gameClock.phases`; the engine reads none of it, and the TOY pack
declares TWO real phases (`casing`@0, `the-job`@1800) — silently ignored
headroom of exactly the class the doctrine refuses. Slice 2 gates it:
a pack whose phases are more than the degenerate single-phase-at-0 is
refused as "not driveable by this engine yet (see slice 5)" (flavor-ii
family, named retirement). CONSEQUENCE: the toy pack trims to a single
phase until slice 5 restores it (the toy grows WITH each slice —
methodology §5). Owner decision D1s2.

**h. `scoring.semantics.allowNegative` (NEW census finding).** Declared
by both packs (ALN true, toy false), read by NOTHING, and in tension with
`teamScoreSchema`'s `currentScore: min(0)`. Either implement it in slice
2 (admin adjustments may take a team negative when the pack allows it) or
gate-refuse `true` until implemented — but ALN declares `true`, so
refusal means editing the ALN pack. Owner decision D2s2 (recommendation:
implement — it is small, and the flag exists because the owner asked for
the semantics).

**i. duplicatePolicy consumption + the D2 `claims` consideration.** Both
packs declare `{claim: 'once', view: 'unlimited'}`; `gameRules/
duplicatePolicy.js` implements exactly that, hardcoded. Slice 2 wires the
read (gate already refuses unknown values via `requires`; add explicit
drivability: `claim` ∉ {once} or `view` ∉ {unlimited} → named refusal).
D2's deferred question lands here: if the owner wants NON-consuming
appraise, a per-mode `claims` flag arrives WITH its duplicatePolicy
enforcement (schema + gate + engine in one change — never schema-dead).
Owner decision D3s2 (default: keep consuming-appraise, no flag).

**j. Gate headroom-rejection (the slice's stated principle).** After
a/e/i, every remaining declared-but-unread rule field is either consumed,
gated with a named retirement, or explicitly presentation-scoped:
`groupRules.type` ∉ {all} / `minSize` ≠ 2 / `bonusFormula` ∉
{multiplier-minus-one-times-base} → refuse (named: "slice 2 implements
the declared table only"); phases → §2g; allowNegative → §2h.

**k. `scoring.display` stays 3b — stated honestly.** The scanner's
formatters hardcode `$` (the known 5-implementation fork); the toy pack
declares `credits`. This is presentation drift, ACCEPTED transitional
with slice-3b retirement — gating it would refuse both real packs.
Recorded here so the 3b slice inherits the obligation explicitly.

**l. R2 same-commit pair.** The pack-rollback runbook lands in
DEPLOYMENT_GUIDE (TokenData checkout last-good + restart, or PACK_PATH
pin — legal because rules freeze at boot) AND preflight §4.4 is rewritten
to validate pack-manifest.json + game.json scoring. [adversarial R2]

**m. SCORING_LOGIC.md full rewrite.** Assigned to this slice by the
2026-07-18 holistic review (the commit that changes scoring truth); the
staleness banner comes down with it. [STATUS doc-refresh obligations]

**n. Post-session validators (out-of-census consumers, slice-1 scope
note).** `backend/scripts/lib/scoringConfigLoader.js` requires
scoring-config.json DIRECTLY — the retirement breaks `npm run
session:validate` outright, so this is NOT optional: the loader re-points
at the session's stamped pack (sessions record pack identity since A2) or
the active pack's game.json; `ScoringCalculator`/`ScoringIntegrityCheck`/
`DetectiveModeCheck`/`LogParser` mode literals resolve through the same
seam family. Owner decision D4s2 on depth (recommendation: in-scope —
they mis-validate any non-ALN session today and the wall-scoreboard
precedent shows out-of-census consumers bite at the gate).

**o. Wall scoreboard rankings side (precedent check).** Slice 1 made the
scoreboard's EVIDENCE filter pack-driven after the gate caught it; slice
2 sweeps `public/` once more for scoring/rules literals (the rankings
path renders backend-computed scores, so expected clean — verify, don't
assume).

## 3. Pack rule-block diff (censused)

| Block | ALN | toy-heist | Engine today |
|---|---|---|---|
| scoring.baseValues | 10k–150k | 100–2800 | legacy file (backend) / pack (scanner) |
| scoring.typeMultipliers | 1/3/3/5/5/0 | 2/1/4/2/6/0 | same split |
| scoring.display | currency-usd | credits | unread (3b) |
| scoring.semantics.allowNegative | true | false | unread (§2h) |
| groupRules | all, min 2, ×−1 formula | identical | hardcoded match |
| duplicatePolicy | once / unlimited | identical | hardcoded match |
| gameClock | 7200 / 7200 / 1 phase | 3600 / 3300 / 2 phases | config only (§2e/§2g) |

## 4. Architecture

One principle, both sides: rules resolve through the SAME seam family
slice 1 built. Backend: `getGameConfig()` feeds (a) token-value
derivation at load, (b) `gameRules/scoring.js` (which already takes
gameConfig for modes — the scoring tables ride the same parameter), (c)
clock setup, (d) duplicate policy. No new singletons; packService remains
the sole config authority; shims stay loud and legacy-shaped. Scanner:
`applyPackScoring` already runtime-loads the tables (A2); slice 2's
scanner work is the group-contribution parity (§2f) only.

## 5. Estimate (honest, census-based)

Backend rules migration + clock + gate extensions ≈0.75 · contribution
semantics BOTH sides with parity tests ≈0.75 · scripts/lib re-point
≈0.5 · docs (SCORING_LOGIC rewrite, DEPLOYMENT_GUIDE runbook, preflight
§4.4) ≈0.5 · dual-pack gate runs + fallout (slice-1 precedent: the gate
WILL catch something) ≈0.5 → **≈2.5–3.5 sessions** (A2 ran 2.3–2.7× its
estimate; this figure already prices the fallout line).

## 6. Owner decisions needed before opening

- **D1s2 — phases gate:** refuse multi-phase packs with the slice-5
  retirement + trim the toy pack to one phase until then? (RECOMMENDED)
  Alternative: leave phases silently unread (violates the doctrine).
- **D2s2 — allowNegative:** implement in slice 2 (RECOMMENDED) or
  gate-refuse `true` (requires editing the ALN pack's declaration).
- **D3s2 — `claims` flag:** keep D2 consuming-appraise, no flag
  (RECOMMENDED) or land per-mode `claims` with duplicatePolicy
  enforcement now.
- **D4s2 — post-session validators:** full re-point in-scope
  (RECOMMENDED — scoringConfigLoader breaks outright at L1 retirement)
  or minimal loader fix + defer the mode-literal sweep.
