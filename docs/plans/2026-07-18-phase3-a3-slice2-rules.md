# Phase 3 A3 Slice 2 — Rules Migration & Gate Headroom-Rejection (design)

**Date:** 2026-07-18
**Status:** ✅ EXECUTED IN FULL — SLICE CLOSED 2026-07-18. Decision-free
core + all four owner-ratified closers (§6a rulings, §6b execution
record) + the 35-agent closer adversarial review (25 confirmed findings
fixed + pinned at parent `4b9464c` / scanner `10d7467`, 4 refuted).
Close gate: backend 2328 + integration 342 + scanner 1442
(fresh-coverage ratchet) + PWA/config-tool/ESP32 green + dual-pack
Tier L twice (112P+113P/0F/0-flaky both times) + CI green on both heads.
Actual cost ≈ the honest estimate's upper band (§5 priced 2.5–3.5
sessions; the fallout line priced the gate catching things — it did).
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
*Execution note (2026-07-18):* the FORCED minimal fix landed with the L1
retirement — `scoringConfigLoader` re-points at `ALN-TokenData/game.json`
scoring with a loud throw on a missing block (no baked fallback: a
validator must never silently validate against wrong constants). Depth
beyond that (stamped-pack resolution, mode-literal seams, AND §2f
scored-only bonus math in `ScoringCalculator` — which diverges for any
future none∧counting pack, though not for ALN) still rides D4s2.

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

## 6b. CLOSER EXECUTION RECORD (2026-07-18 — all four rulings BUILT)

- **D1s2 BUILT** (parent `5ab7fdc`): phases gate in `_gateCheck` — anything
  beyond the degenerate single-phase-at-0 (multi-phase, non-zero start,
  trigger-start) refuses with "not driveable by this engine yet (see
  slice 5)"; language rule pinned both directions. The gate's FIRST catch
  was the toy pack itself (casing@0/the-job@1800, the §2g census shape) —
  trimmed to a single phase until slice 5 restores it, manifest regen'd.
- **D2s2 BUILT** (parent `d2e69f5`, scanner `41381c8`): contract-first
  signed-currentScore descriptions (wire schemas never had a minimum);
  `getScoringRules().allowNegative` (strict === true; shim mirrors ALN
  true, tripwire extended); adjustTeamScore REJECTS zero-crossing
  adjustments under a no-negatives pack (before the audit push — ledger
  stays additive for the validators); rebuild path floors loudly (the one
  reachable negative); **LATENT CRASH FIXED**: the Joi min(0) fired at
  session-restore hydration, so any persisted negative (reachable — no
  mutation path checked) crashed restore at boot. Scanner parity + TWO
  pre-existing standalone bugs fixed (adjustment wiped by next scan's
  invariant recompute; rebuild dropping adminAdjustments entirely).
- **D3s2 BUILT** (parent `e6877c5`, scanner `67996b3`, TokenData
  `ca90dc0`): schema+gate+engine+scanner as ONE change. `claims` open
  string on modes[] (absent → 'consuming' — the legacy behavior, so
  NEITHER real pack changes and every tripwire stays green);
  duplicatePolicy: non-consuming never blocked AND never registers
  (findOriginalTransaction skips it; deviceTracking emission gated —
  single decision point); ENGINE_MODE_CAPS.claims; flavor-ii
  re-instantiated per its header (separate limitations channel):
  non-consuming ∧ countsTowardGroups refuses with the named retirement.
  Scanner: isConsumingMode + all five local claim sites gated (incl. the
  transaction:new broadcast that would otherwise lock a non-consuming
  token fleet-wide). Group math needed NO change under the v1 constraint.
- **D4s2 BUILT** (parent `6b96917`): `packResolver.js` resolves the
  session's STAMPED pack (match/mismatch/unstamped verdicts, PACK_PATH,
  logger-free so validation can't pollute its own evidence; report opens
  with a Pack Resolution section); TokenLoader/scoringConfigLoader
  parameterized by pack dir (no silent fallback under an explicit dir);
  every mode literal through the seam (ScoringCalculator's old literal
  paid UNKNOWN modes full catalog value); DetectiveModeCheck →
  NonScoringModeCheck; TransactionFlowCheck's closed enum → wireModeIds;
  §2f bonus math reused from gameRules (scored∧counting only); dead
  LogParser method deleted; the two UNWIRED validators swept (fixing
  GroupBonusCheck's mode-blind completion set); scripts/lib gained its
  FIRST tests (11); backend/CLAUDE.md's "15 validators" corrected to the
  9 wired. Full pipeline smoke-verified against a synthetic stamped
  session.
- **CI ratchet catch** (scanner `cd0a9d6`, parent `8a7df6f`): the
  closers' new gameOps branches dropped coverage below the floor — CI's
  fresh-coverage run caught what the stale local check passed; six
  App-facade tests cover the claims gates + floor surfacing (60-floor →
  69.04% branches). Lesson recorded: scanner coverage:check is only as
  fresh as the last local --coverage run.

## 6a. RULINGS (owner, 2026-07-18) — slice 2 decision items CLOSED

- **D1s2 = GATE + TOY TRIM.** Owner challenged whether act support is
  SPECIFICALLY planned; verified against program §3: "Slice 5 —
  clock/phase params (B11): duration/overtime landed in slice 2; phases +
  trigger-starts here" — a concrete named slice, not a vague deferral.
  Build: refuse multi-phase packs with the named "see slice 5" retirement;
  trim toy to single phase until slice 5 restores it.
- **D2s2 = IMPLEMENT allowNegative.** Pack-conditional score floor:
  admin adjustments may take a team negative when the pack declares
  allowNegative true. Contract-first (teamScore schema min(0) becomes
  pack-conditional); both sides + validators aligned.
- **D3s2 = BOTH claim policies available.** Supersedes the keep-consuming
  recommendation: a per-mode claims flag (consuming default,
  non-consuming available to pack authors) lands WITH its full
  enforcement — schema + gate + duplicatePolicy + scanner parity in one
  change, never schema-dead. v1 constraint: non-consuming ∧
  countsTowardGroups gates as a flavor-ii limitation (non-consumed
  presence in group completion needs its own design — named retirement).
- **D4s2 = FULL validator sweep.** Validators resolve the session's
  stamped pack, mode literals go through the semantics seam,
  ScoringCalculator adopts §2f scored-only bonus math.

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
