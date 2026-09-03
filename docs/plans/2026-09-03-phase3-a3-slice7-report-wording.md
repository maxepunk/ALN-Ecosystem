# A3 slice 7 — the B9 bundle schema + pack-declared report wording

**Status: DESIGN r2 (census verified ×2; red-teamed, all 19 objections
adjudicated ACCEPTED and folded — §4a) — 2026-09-03.**
Ruling authority: program §13.4 (2026-08-29 amendment 4, both halves
owner-ruled). Vocabulary: root `CONTEXT.md`. Branch:
`claude/phase3-a3-slice7` (chained from the slice-6 tip `dbab5ad`,
draft PR #30 as the CI vehicle, opened at slice open).

The ruling, verbatim scope: (a) the B9 session-bundle schema lands as
an engine contract artifact — versioned, reserved per-game namespaces,
no Phase-3 consumer, unblocking the Phase-4 D gate; (b) report
mechanism = structured WORDING block, no template language.
Headings/structure stay engine-fixed as the external pipeline's parse
anchors (the report ★ is a contracted delimiter,
`ALNScanner/docs/session-report-contract.md:64`). Wording becomes
pack-declared, including the missing `verbNoun`. ALN renders
byte-identical under the golden master; the toy pack diverges. Scope =
the scanner generator only.

## 1. Extraction brake (R13)

Rows moved, cited from `docs/reviews/2026-06-platform-review/capability-matrix.md`:

| Row | Classification | What this slice does to it |
|---|---|---|
| 4.20 session report generator (:145) | game-flavored; section titles/columns an external contract | The wording half moves to pack data; the structure half stays engine-fixed, exactly as the row's action prescribes ("preserve ALN pipeline contract"). No reclassification. |
| 8.1–8.4 report structure (:198-201) | external contract | Untouched as structure; 8.2's own constraint ("pack-themed titles must NOT alter the parsed structure, Q11") is satisfied by construction — only wording moves. No reclassification. |
| 8.7 intake capture → session bundle (:204) | engine-fixed capture + game-configurable what | The row's named action "bundle format in report schema" is D-7.1. Capture itself stays Phase-4 D. No reclassification. |
| 8.6 narrative slot (:203) | game-content (reserved) | Stays reserved as a CONCEPT; the shipped `report.template` schema stub is retired as a live lie (D-7.4 r2). |
| 1.25 currency presentation (:58) | game-content (strings/format) | The row names `sessionReportGenerator._formatCurrency` explicitly; slice 3b moved every OTHER consumer and recorded this one as "Q4/slice-7 territory, NOT touched" (3b design doc :40). This slice completes the row's move (D-7.2 r2). No reclassification. |

Matrix top-action #8 (":219 template registry + versioned contract
test must land BEFORE strings extraction touches the report") is
already satisfied: the contract test landed in Phase 2.6; this slice
is the "pack-themable layer on top" it anticipated. No matrix row
changes classification — the brake passes with citations only.

## 2. Census record (workflow `wf_03423b14-aaf`, 2026-09-03; counts verified ×2)

Full structured result: the workflow journal + the design record here.
Reader legs: generator inventory (Sonnet), independent literal recount
(Haiku), contract/golden/pipeline (Sonnet), B9 corpus (Sonnet),
strings plumbing (Sonnet). The two counting legs agree: **118 raw
quote-delimited spans** in `ALNScanner/src/core/sessionReportGenerator.js`
(408 lines, clean at the scanner closers pin), of which 2 are JSDoc
comment text, leaving **116 real literals: 12 heading-anchor, 6
delimiter, 25 wording, 15 data, 58 code**. (One census-agent artifact
resolved: a "file changed mid-read" flag was the documented stale-clone
trap — the top-level `/home/user/ALNScanner` clone is a 404-line
pre-slice-1 vintage; the real submodule file is stable and the
inventory matches it.)

Load-bearing census facts:

- **The wording class (25 literals)** groups as: summary bullet labels
  (`:85-88`), the class-count parenthetical "N detective, N black
  market" (`:86`), breakdown words "transactions/adjustments" (`:76`)
  and "sales/adjustments" (`:216`), three empty-section placeholders
  (`:115/:173/:258`), the timeline Type labels `'Sale'` (`:146`) and
  `'Adjustment'` (`:157`) — the named verbNoun gap — three Activity
  Stats subsection labels (`:288/:302/:320`), the scan/scans plural
  pair (`:290/:305`), and the fallback copy family: `'—'` ×3
  (`:128/:243/:369`), `'Unknown'` ×2 (`:340/:401`), `'Unknown Date'`
  (`:384`), duration units `'h'/'m'` (`:406`).
- **The anchor classes (12+6)** are the contract's Change Rules #1–#5
  territory: seven pinned headings, four table header rows, the H1 and
  metadata line formats, three `---` separators, and the ★ Detail cell
  (`:235`; contract `:64`). The contract test pins all of it:
  `sessionReport.contract.test.js` GOLDEN_OUTPUT `:170-236` byte-exact
  (`:282` `toBe`), plus structural assertions `:290-441` (exact heading
  list, exact header strings, exactly 3 separators).
- **The pipeline is external and singular.** The only consumer of the
  markdown is `parseRawInput` in github.com/maxepunk/aboutlastnight
  (contract `:11`); zero in-repo parsers (grep-proven). The two other
  report mechanisms in-repo (`backend/scripts/validate-session.js`,
  `.claude/commands/session-report.md`) are unrelated formats that
  re-derive from raw backend data — out of scope per the ruling's
  "scanner generator only" line.
- **Generator inputs**: `generate({session, scores, transactions,
  playerScans})` (`:39`) + constructor `tokenDatabase` (`:25`, only
  `.owner` is read, `:339-340`) + two module imports: `SCORING_CONFIG`
  (`:15`, read `:232-234` for the ★ cell's baseValue/multiplier) and
  `isScoringMode/isEvidenceMode` (`:19`). CORRECTED by the red team
  (§4a lens-1 OBJ-2): `applyPackScoring` does mutate `SCORING_CONFIG`
  in place, so the ★ cell's NUMBERS are active-pack values — but the
  AFFIXES are not: `_formatCurrency` (`:349`) hardcodes
  `'$' + toLocaleString('en-US')`, while slice 3b made the money affix
  pack-declared (`scoring.display.format`; the toy already declares
  `"#,### cr"`) and every other scanner surface renders through
  `src/utils/formatCurrency.js`. 3b's design doc `:40` records the
  report generator as the ONE deliberately-untouched consumer,
  deferred to slice 7. This slice completes that re-point (D-7.2 r2).
- **The generator has no strings access today** (`strings.js` not
  imported; its own `:16` comment records the wording move as planned
  future work). The strings mechanism is ready to receive it:
  `strings.schema.json` is open-vocabulary (a `report` section is
  structurally legal with zero schema changes), the backend gate walks
  any section (`packService.js:463`), the packLoader carries the
  `strings` role through the staged refresh (`packLoader.js:63`), and
  scanner `strings.js` `getString()` (`:84`) is the single consumption
  API with `Object.hasOwn` walking. Neither real pack's `strings.json`
  has a `report` section yet.
- **B9 corpus** (24 `B9` hits + 17 related, all accounted): origin
  decision 2026-06-09 (`tier-b2-showcontrol-content-pipeline.md:35-47`)
  — engine emits a structured session bundle (versioned JSON) as the
  canonical artifact; the report is a themed rendering; the pipeline
  migration is owner-paced (ROADMAP §8.10) and gated on Phase-4 D
  intake. The bundle's most concrete carriage statement
  (`2026-06-09-platform-review-refactor-workflow.md:478`): report
  content + photos + notes + accusation + roster, mapping onto the
  pipeline's `rawSessionInput`. BILL requires reserved per-game state
  namespaces AND that the schema not assume ALN's shapes
  (`2026-07-17-bill-capability-scoping.md:71-73`). The Phase-4 D gate
  reads "report intake writing B9 bundles" (ROADMAP §4).
  **Superseded draft found — and it is LIVE surface, not just a plan
  doc:** `2026-06-13-phase3-1-pack-schemas.md:184` drafts
  `"report": {"template": …}`; the stub SHIPPED into
  `ALN-TokenData/game.schema.json:493` and both manifest builders
  still infer `role: "template"` for `templates/` paths. Dead under
  the ruling's "no template language" (D-7.4 r2 retires the live
  surfaces, not just the doc).

## 3. Design (r2 — §4a fixes folded)

### D-7.1 — The bundle schema is an engine contract artifact

Home: `backend/contracts/session-bundle.schema.json`, beside the
OpenAPI/AsyncAPI contracts — the bundle schema is engine-versioned,
never pack data (origin decision, pack-schemas `:180`). JSON Schema
draft matching the house style of the pack schemas.

Shape (v1):

- `schemaVersion` — integer const `1`, the HOUSE convention
  (game/strings/cues schemas all use an integer const with exact-match
  enforcement). Additive evolution = new OPTIONAL properties within
  the same version; a breaking change bumps the const. (The r1 semver
  `bundleVersion` is dropped — a const semver gives a validator
  nothing the integer doesn't, and it mixed two conventions in one
  repo. §4a lens-1 OBJ-9.)
- `engine` — `{engineVersion, packId, packVersion, contentHash}`: the
  provenance stamp, same identity fields every consumer already
  reports (A2 staleness identity). REQUIRED.
- **Only `schemaVersion` and `engine` are required.** The four
  ALN-shaped data sections below are all OPTIONAL, so a non-ALN game
  (BILL: graph + epidemic state) emits `engine` + `gameState` without
  fabricating empty transaction lists — the exact shape-assumption
  BILL:72 forbids. (§4a lens-1 OBJ-8.)
- `session` — `{name, startTime, endTime, teams[]}`.
- `scores[]` — `{teamId, score, adminAdjustments[]:
  {delta, timestamp, reason, gmStation}}`.
- `transactions[]` — `{status, mode, tokenId, teamId, timestamp,
  points, summary, valueRating, memoryType}`.
- `playerScans[]` — `{tokenId, deviceId, timestamp}`.
- `tokens` — `{<tokenId>: {owner}}`: the projection of the token
  database the report actually consumes (census: `.owner` only).
- `rules` — the ACTIVE pack's resolved rule snapshots the report's
  render depends on: `scoring` (`baseValues`, `typeMultipliers`,
  `display.format` — the `getScoringRules()` normalized shape) and
  `modes[]` (`id`, `label`, `verbNoun`, `scoringPolicy`,
  `displayBehavior.surface` — the resolver record shape). Without
  these a consumer cannot reproduce the ★ Detail cell or decide
  SECTION MEMBERSHIP; the census named both module imports and the r1
  shape dropped them (§4a lens-1 OBJ-3). No new derivation is
  invented — both snapshots already exist.
- `intake` — RESERVED: `{roster: true, directorNotes: true,
  photos: true, accusation: true, whiteboard: true}` — names only,
  every member schema `true` (any type). Reserving a name with a
  pinned type is not reserving a name; Phase-4 D designs the shapes
  (§4a lens-1 OBJ-8).
- `gameState` — RESERVED: `patternProperties` keyed by the pack-id
  pattern with `additionalProperties: false` (the r1
  "additionalProperties keyed by a pattern" was not a JSON Schema
  construct — §4a lens-1 OBJ-8). Engine never interprets the contents.

**No emitter is built** ("no Phase-3 consumer"): enforcement is
contract tests only — schema validity; a full fixture bundle derived
from the golden-master fixtures validating green; a MINIMAL non-ALN
fixture (`schemaVersion` + `engine` + `gameState` only) validating
green — the test that proves BILL:71 is satisfied rather than cited;
the version const; the reserved namespaces pinned present; and the
input-coverage assertion naming all FOUR census input classes
(payload, tokenDatabase projection, scoring rules, mode records).
Test home: `backend/tests/contract/session-bundle.schema.test.js`.

### D-7.2 — Wording moves to `strings.report` + per-mode `verbNoun`; structure stays literal

**The boundary, stated honestly (§4a lens-3 O1):** engine-fixed = the
contract's Change Rules #1–#5 (headings, table header rows, `---`,
the H1 and metadata line FORMATS, the ★ cell format). Everything else
that renders — including Rule #6's empty-section placeholders and the
pipeline-read summary bullet labels (contract `:32`) — moves to
pack-declared wording UNDER the byte-pin machinery below. Rule #6 and
the `:32` dependency are re-recorded accordingly in the contract v2
(D-7.3); the pipeline's view of ALN output is unchanged by
construction.

1. **The 12 heading-anchors and 6 delimiters stay engine-fixed
   literals in the generator.** Recorded consequence, accepted under
   the ruling: a divergent pack's report still carries the ALN-worded
   structure strings — the "Exposed By" column header AND the
   "Detective Evidence Log" heading (ALN's own mode name) over, say,
   toy tipoffs. This is a deliberate ALN-flavored retention with a
   named retirement, so it gets a LEDGER ROW at S7.2 (L13,
   post-Phase-3 class: trigger = the §8.10 bundle migration; tripwire
   = the golden master + the structural-invariant suite below), per
   the L4/L8 precedent (§4a lens-3 O2).
2. **The 25 wording literals route through `getString('report.…')`**
   with baked defaults byte-identical to today's text. Scanner
   `strings.js` `BAKED_STRINGS` gains a `report` section; the
   generator imports `getString` (module import, the `modeSemantics`
   precedent). **ALN declares NO report section** (r2 reversal, §4a
   lens-2 OBJ-2): the bake IS ALN's report voice, exactly the shipped
   `LEGACY_ENTITY_LABEL` pattern (`modeSemantics.js:60-68`, inverted
   pin) — this makes the golden master a COMPLETE proof of the tier
   that actually renders (the contract test runs with no pack
   applied), instead of resting on a hand-enumerated tripwire whose
   only precedent already under-covers. The toy pack declares the
   section and proves openness. A structural pin asserts
   `BAKED_STRINGS.report` deep-equals a literal snapshot so a
   mis-keyed bake fails loudly rather than rendering null.
3. **Sanitization happens at the wording boundary, not per site**
   (§4a lens-1 OBJ-1 + lens-2 OBJ-6): every pack-declared report leaf
   passes through ONE `reportText()` wrapper — `getString` + escape
   `|`, map newlines to spaces, strip control/bidi characters (the
   R-Q2 normalization class) — before it reaches ANY sink. This
   retires the r1 two-bucket taxonomy and its uncovered third case
   (`report.duration.*` and the date/duration fallbacks render inside
   the Change-Rule-#5 metadata line, which is neither a table cell
   nor a whole line). Byte-neutral under baked/ALN wording, so the
   golden master is untouched. `_formatSaleDetail`'s existing
   `|`-only escape is upgraded to the same helper for `tx.summary`
   and owner-derived cell values.
4. **`verbNoun` is a per-mode key — two tiers, as the R-Q2 machinery
   actually behaves** (§4a lens-1 OBJ-7 + lens-2 OBJ-4): optional
   string on `modes[]` (schema + both resolver mirrors carry the same
   value-level normalization as `claimedLabel`, R-Q2; gate refusal
   twins for empty/non-string). The Scoring Timeline Type cell
   renders `resolveMode(tx.mode)?.verbNoun ?? GENERIC_VERB_NOUN`
   (`'Claim'`) — where the ACTIVE table is the pack table when one is
   applied, or the L6 baked ALN table otherwise. ALN's game.json
   declares `blackmarket.verbNoun: "Sale"` and
   `LEGACY_ALN_MODES` gains the same value in the same change — the
   EXISTING both-directions modes drift tripwire
   (`modeSemantics.test.js:367`) then enforces they never drift.
   There is no baked third tier at render time; a divergent pack that
   declares modes but omits verbNoun gets the engine-generic
   `'Claim'`, never ALN's `'Sale'`. `'Adjustment'` (an engine event,
   not a mode) is `report.adjustmentLabel`.
5. **Currency affixes re-point** (§4a lens-1 OBJ-2 — completes the
   slice-3b deferral this generator's row 1.25 records):
   `_formatCurrency`/`_formatSignedCurrency` re-point at
   `formatCurrency`/`formatNumber` from `src/utils/formatCurrency.js`,
   and the ★ cell's baseValue renders through `formatNumber` (the
   helper 3b shipped naming this exact breakdown shape). Byte-neutral
   for ALN by 3b's own byte-identity statement (`formatCurrency.js:9-11`,
   including the `$-25,000` negative quirk in the golden). The toy
   divergence fixture asserts `cr` amounts — a credits game stops
   rendering dollars in its own report.
6. **The class-count parenthetical** generalizes by SEMANTIC CLASS
   with a residue term (§4a lens-2 OBJ-3 + OBJ-4):
   `report.classLabels.evidence` (baked `'detective'`) and
   `report.classLabels.scoring` (baked `'black market'`) keep ALN's
   exact two-term shape; a third engine-generic term (baked
   `'other'`) renders ONLY when accepted claims fall in neither class
   — toy's `appraise` mode is the shipped counterexample — with a
   loud debug warn, so claims never vanish silently from the summary
   of a contract-bound artifact. ALN has exactly one mode per class,
   so its residue count is structurally zero and the bytes are
   untouched. Rejected alternative, recorded: deriving class labels
   from `modes[].label.toLowerCase()` — order/casing-fragile and
   coupled to R-Q1 rebranding.
7. **Fallback keys reuse the pack's existing vocabulary** (§4a lens-1
   OBJ-6 + lens-2 OBJ-7): the owner fallback is
   `report.fallback.unknownOwner`, resolved declared-report-key →
   declared `scoreboard.unknownOwner` → baked `'Unknown'` — so the
   toy's existing `"Unattributed"` voice reaches its report without a
   second declaration (the layered resolve is required: bare reuse
   would render null, since `scoreboard.unknownOwner` has no baked
   default). The duration and date fallbacks get their own keys
   (`unknownDuration`, `unknownDate`) — one key per concept, never
   one key for two. Standing key-plan rule: a new report key is
   created only when no existing strings key names the concept.
8. **No report string routes through `entities.label`** (unchanged
   from r1, red-team-confirmed sound): ALN's declared label is
   `Account` while the golden says `Teams:` — report labels are
   report keys.

**The test plan IS the acceptance argument (r2, §4a lens-2 OBJ-1 +
lens-1 OBJ-5):**

- The existing golden master passes UNTOUCHED (pins the dense render
  of the baked tier — which is now provably ALN's tier by
  construction).
- A SECOND byte-exact golden fixture lands FIRST (tests-first): a
  sparse session — zero evidence claims, an owner-less token, a
  missing endTime, a reason-less adjustment, a single-scan device, a
  scanned-never-turned-in token — pinning with `toBe()` the eleven
  wording defaults that produce zero bytes in the dense golden
  (placeholders, dashes, Unknowns, `Unknown Date`, the
  never-turned-in label, the singular `scan`).
- The structural assertions (heading list, header rows, separator
  count, metadata regex, H1) extract into a reusable INVARIANT HELPER
  run three times: ALN render, toy render, and an ADVERSARIAL fixture
  whose every report key carries `|`, newlines, `##`, and bidi
  controls — asserting the structure is byte-identical to ALN's. That
  third run is the test of the slice's central safety property.
- The wording-content assertions that currently hardcode ALN literals
  (`| Sale |`, `2 detective`, `Adjustment`) re-express against the
  resolved wording, so structure and wording fail independently.
- A generation-time provenance warn (§4a lens-2 OBJ-5): when the
  active pack's load source is not `network`, or a declared strings
  sidecar failed to apply, the generator logs loudly — the markdown
  itself carries no pack identity (recorded asymmetry, D-7.3), so the
  warn is the only staleness signal at the point of export.

**No new capability id (D-7.5, unchanged, red-team-confirmed):**
report wording is benign-wording (3a doctrine); absent keys = today's
text. The gate gains only the verbNoun refusal twins.

### D-7.3 — The contract doc revs to v2

`ALNScanner/docs/session-report-contract.md` records the r2
mechanism: Change Rules #1–#5 unchanged as structure, with a note
that the H1/metadata FORMAT lines are escape-protected at the wording
boundary (their interpolations can carry pack wording, sanitized);
Rule #6 rewritten — placeholder and label wording is pack-declared
with the baked tier as ALN's voice, byte-pinned by the two golden
fixtures; the `:32` "Total Transactions" pipeline dependency
re-recorded under the same machinery; the provenance asymmetry named
(the bundle carries an `engine` stamp, the markdown cannot without
breaking bytes); the Phase 3 Migration Path section updated to record
the slice-7 landing and point at ROADMAP §8.10.

### D-7.4 — Tombstones (r2: the LIVE surfaces, not just the doc)

The template mechanism is dead under the ruling, and it is shipped in
three places (§4a lens-1 OBJ-4): (1) `ALN-TokenData/game.schema.json:493`
`report.template` — REMOVED (a pack author reading the shipped schema
must not be told templates are supported); (2) BOTH manifest builders'
`templates/` → `role: "template"` inference
(`backend/scripts/build-pack-manifest.js:45` + the Python byte-parity
twin) — removed together, byte-neutral for every real pack (none
ships a `templates/` dir; the parity suite proves it); (3) the
pack-schemas.md `:184` draft — correction note (the slice-1
back-annotation precedent). game.json gains NO `report` block; the
narrative slot (matrix 8.6) stays a reserved CONCEPT with no shipped
stub.

## 4. Owner questions

**None held.** Both halves were ruled 2026-08-29 (program §13.4); the
remaining calls are derivations recorded above, and the doctrine
red-team leg independently judged the no-questions claim sound (§4a).
The tripwire stands: if build work surfaces a genuine taste call, it
goes to a grill-with-docs batch before code.

## 4a. Design red-team record (2026-09-03, pre-build — workflow `wf_0568e580-301`)

Three lenses per the subagent policy: contract+injection (Opus),
byte-identity+tiers (Opus), doctrine+parity+scope (Fable). Verdicts:
lens 1 "not build-ready, no blocking" (5 MAJOR / 4 MINOR); lens 2
"not sound as written — implementable, acceptance argument must be
repaired" (3 MAJOR / 4 MINOR); lens 3 PASS (3 MINOR, ruling fidelity
confirmed clause-by-clause, no scope creep, no gate). **All 19
objections adjudicated ACCEPTED** (none refuted; several merged) and
folded into §3 r2:

| Objection | Fix landed in |
|---|---|
| L1-OBJ-1 + L2-OBJ-6 (uncovered metadata-line sinks; `\|`-only escape at ★) | D-7.2 #3: boundary-level `reportText()` sanitizer |
| L1-OBJ-2 (report still renders `$`/en-US; 3b deferral) | D-7.2 #5 + §1 row 1.25 + §2 correction |
| L1-OBJ-3 (bundle omits scoring rules + mode semantics) | D-7.1 `rules` section + 4-class coverage test |
| L1-OBJ-4 (live `report.template` schema stub + builder role) | D-7.4 r2 |
| L1-OBJ-5 (structural invariants never run against hostile wording) | D-7.2 test plan: invariant helper ×3 + adversarial fixture |
| L1-OBJ-8 (gameState/intake reserve nothing; ALN-shaped spine) | D-7.1: patternProperties, `true` members, optional sections, minimal non-ALN fixture |
| L1-OBJ-6 + L2-OBJ-7 (unknownOwner duplicate; conflated fallbacks) | D-7.2 #7 layered resolve + one-key-per-concept rule |
| L1-OBJ-7 + L2-OBJ-4 (three-tier verbNoun misdescribes R-Q2; ALN 'Sale' leak) | D-7.2 #4 two-tier restatement |
| L1-OBJ-9 (semver const contradicts house convention) | D-7.1 integer `schemaVersion` |
| L2-OBJ-1 (11 wording sites produce zero golden bytes) | D-7.2 test plan: sparse-session golden, tests-first |
| L2-OBJ-2 (golden pins baked tier; tripwire precedent under-covers) | D-7.2 #2 reversal: ALN declares no report section; bake = ALN voice |
| L2-OBJ-3 (classes not a partition; toy `appraise`) | D-7.2 #6 residue term + warn + toy fixture appraise claim |
| L2-OBJ-5 (Phase-1A staleness; markdown carries no pack identity) | D-7.2 provenance warn + D-7.3 asymmetry record |
| L3-O1 (boundary ≠ census ≠ Change Rules at the edges) | D-7.2 preamble restated; D-7.3 records `:32` |
| L3-O2 (ALN-flavored retention needs a ledger row) | D-7.2 #1: ledger row L13 at S7.2 |
| L3-O3 (lockstep arrow contradicts body + precedent) | §5 S7.2 order corrected |

## 5. Build order

- **S7.1 — bundle schema** (backend only, pure additive):
  `session-bundle.schema.json` (r2 shape) + the three fixtures (full
  ALN-shaped, minimal non-ALN, both validating) + contract tests
  (validity, integer version const, reserved namespaces genuinely
  constrained, 4-class input coverage).
- **S7.2 — wording block** (lockstep TokenData → backend → scanner →
  toy pack): TokenData: `game.schema.json` modes `verbNoun` +
  `report.template` stub REMOVED + ALN `game.json`
  (`blackmarket.verbNoun: "Sale"`) + manifest regen (ALN strings.json
  UNCHANGED — declares no report section by design). Backend: gate
  refusal twins + resolver-mirror value normalization + BOTH manifest
  builders drop the `template` role (byte-parity suite re-proven).
  Scanner: sparse-session golden + invariant helper + adversarial
  fixture FIRST (red), then `BAKED_STRINGS.report` + `reportText()`
  boundary sanitizer + generator re-point (25 wording sites +
  verbNoun + currency re-point + class-residue term + provenance
  warn) to green with BOTH goldens untouched/passing; baked-snapshot
  pin; `LEGACY_ALN_MODES.blackmarket.verbNoun`. Toy pack: divergent
  report section + verbNoun + an `appraise` claim in the fixture +
  manifest regen. Ledger row L13. Contract doc v2 + pack-schemas
  correction note. Config-tool: OUT (strings editing is B-pages
  territory).
- **S7.3 — close**: dual-pack Tier L, fresh ratchet, `npm run lint`
  both repos (the standing correction from the 2026-09-03 regression
  record), mixed-model adversarial review per the subagent policy,
  close record.

Each stage runs under the implement/tdd/code-review frame: tests
first at the seams named above, per-stage two-axis review, commit.

## 6. Residue

- The pipeline migration itself: ROADMAP §8.10, owner-paced, post
  Phase-4 D — nothing here starts it.
- Intake shapes inside the bundle: Phase-4 D designs them; this slice
  reserves names only (`true` schemas).
- Divergent-pack ALN-flavored structure wording: ledger row L13
  (D-7.2 #1) — the row replaces r1's bare residue note.
- Standalone report support (matrix 4.20 gap: networked-only) — out
  of scope, unchanged.

## 7. Estimate

S7.1 ≈ 1 work session; S7.2 ≈ 2–2.5 (the r2 test plan grew it: two
goldens, invariant ×3, adversarial fixture, currency re-point,
four-repo lockstep); S7.3 ≈ 1. Slice ≈ **4–4.5 work sessions**.

## 8. Execution record

(Filled as stages close.)

- 2026-09-03: slice OPENED post task-#23 review (owner-confirmed);
  branch + draft PR #30 at open; census workflow `wf_03423b14-aaf`
  (5 agents, counts verified ×2); design r1 drafted.
- 2026-09-03: pre-build design red-team `wf_0568e580-301` (2 Opus +
  1 Fable, 19 objections, 0 refuted) — design revised to r2, §4a
  adjudication table. Estimate re-priced 3.5–4 → 4–4.5.
