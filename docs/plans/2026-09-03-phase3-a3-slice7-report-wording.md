# A3 slice 7 — the B9 bundle schema + pack-declared report wording

**Status: DESIGN (census complete, verified ×2) — 2026-09-03.**
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
| 8.6 narrative slot (:203) | game-content (reserved) | Stays reserved; this slice deliberately adds NO `report` block to game.json (D-7.4). |

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
  `isScoringMode/isEvidenceMode` (`:19`). Verified directly:
  `applyPackScoring` (scanner `scoring.js:64`) mutates the exported
  `SCORING_CONFIG` tables in place, so the ★ cell already renders
  ACTIVE-pack values — no scoring-parity gap hides here.
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
  namespaces (`2026-07-17-bill-capability-scoping.md:71`). The Phase-4
  D gate reads "report intake writing B9 bundles" (ROADMAP §4).
  **Superseded draft found:** `2026-06-13-phase3-1-pack-schemas.md:184`
  drafts `"report": {"template": "templates/session-report.md.hbs"}` —
  dead under the ruling's "no template language" (D-7.4 tombstones it).

## 3. Design

### D-7.1 — The bundle schema is an engine contract artifact

Home: `backend/contracts/session-bundle.schema.json`, beside the
OpenAPI/AsyncAPI contracts — the bundle schema is engine-versioned,
never pack data (origin decision, pack-schemas `:180`). JSON Schema
draft matching the house style of the pack schemas.

Shape (v1):

- `bundleVersion` — const-pinned `"1.0.0"` in v1. Evolution rule
  documented in the schema description: additive = minor, breaking =
  major (the capability-id convention applied to a contract artifact).
- `engine` — `{engineVersion, packId, packVersion, contentHash}`: the
  provenance stamp, same identity fields every consumer already
  reports (A2 staleness identity).
- `session` — `{name, startTime, endTime, teams[]}`.
- `scores[]` — `{teamId, score, adminAdjustments[]:
  {delta, timestamp, reason, gmStation}}`.
- `transactions[]` — `{status, mode, tokenId, teamId, timestamp,
  points, summary, valueRating, memoryType}`.
- `playerScans[]` — `{tokenId, deviceId, timestamp}`.
- `tokens` — `{<tokenId>: {owner}}`: the projection of the token
  database the report actually consumes (census: `.owner` only).
- `intake` — RESERVED, all-optional: `{roster, directorNotes[],
  photos[], accusation, whiteboard}` named per the Phase-4 D gate's
  intake list (ROADMAP §4); shapes deliberately loose (empty object
  schemas with descriptions) — D-track designs them, this slice only
  reserves the names so the D gate has an address.
- `gameState` — RESERVED: one key per pack id
  (`additionalProperties` keyed by the pack-id pattern), engine never
  interprets the contents (the BILL requirement: graph + epidemic
  state will live here, never in ALN-shaped fields).

The four data sections carry exactly the fields the census proved
today's report dereferences (the 45-field input inventory) — the
bundle can render today's report with no field the schema doesn't
name. **No emitter is built** ("no Phase-3 consumer"): enforcement is
contract tests only — schema validity, a fixture bundle (derived from
the golden-master fixtures) validating green, the version const, and
the two reserved namespaces pinned present. Test home:
`backend/tests/contract/session-bundle.schema.test.js`.

### D-7.2 — Wording moves to `strings.report` + per-mode `verbNoun`; structure stays literal

The wording/structure boundary IS the census classification, which IS
the contract's Change Rules — three statements of the same line:

1. **The 12 heading-anchors and 6 delimiters stay engine-fixed
   literals in the generator.** Headings, table header rows, H1 and
   metadata formats, `---`, ★. Recorded consequence, accepted under
   the ruling: a divergent pack's report still carries the ALN-worded
   column headers (e.g. "Exposed By" over toy tipoffs) — the contract
   names column-header text as structure (Change Rule #2), and the
   pipeline reads columns by position. Revisitable only at the
   pipeline migration (ROADMAP §8.10), never unilaterally.
2. **The 25 wording literals route through `getString('report.…')`**
   with baked defaults byte-identical to today's text (the 3a
   pattern). Scanner `strings.js` `BAKED_STRINGS` gains a `report`
   section; the generator imports `getString` (module import, the
   `modeSemantics` precedent — strings are applied at Phase 1A load,
   long before any session-end report). Key plan (names final at
   S7.2, one key per census wording entry): `report.labels.*` (summary
   bullets, subsection labels), `report.empty.*` (three placeholders),
   `report.breakdown.*` (transactions/adjustments/sales words),
   `report.fallback.*` (dash, unknown, unknownDate),
   `report.duration.*` (h/m), `report.scanNoun`/`scanNounPlural`,
   `report.adjustmentLabel` ('Adjustment' — an engine event, not a
   mode, so it is strings territory, not verbNoun).
3. **`verbNoun` is a per-mode key** — the census located the gap as a
   mode property (3a census: "no declared noun for 'Sell'"), and the
   R-Q2 `claimedLabel`/`icon` machinery is its exact precedent:
   optional string on `modes[]` (schema + both resolver mirrors
   normalize + gate refusal twins for empty/non-string), rendered as
   the Scoring Timeline Type cell for the claim's mode, with the
   three-tier fallback (declared → engine-generic `'Claim'` → L6
   baked ALN table carrying `'Sale'`, drift-tripwired). ALN declares
   `blackmarket.verbNoun: "Sale"` → byte-identical. The toy's scoring
   mode declares its own (e.g. `"Fence"`).

**The class-count parenthetical (`:86`)** generalizes by SEMANTIC
CLASS, not by mode: membership is already flag-driven
(`isEvidenceMode`/`isScoringMode` counts), so the two class words
become `report.classLabels.evidence` (baked `'detective'`) and
`report.classLabels.scoring` (baked `'black market'`). Rejected
alternative, recorded: deriving them from `modes[].label.toLowerCase()`
— fragile on declaration order and casing, and it would couple report
bytes to a UI label that Q1-era rebranding already moves
independently. For the same reason **no report string routes through
`entities.label`**: ALN's declared label is now `Account`, and the
golden master says `Teams:` — report wording resolves ONLY from
`strings.report` + baked defaults.

**ALN byte-identity and the toy divergence, as tests:** the golden
master (`toBe(GOLDEN_OUTPUT)`) passes UNCHANGED — that pin is the
acceptance test for the whole refactor. ALN's `strings.json` declares
the report section verbatim (the 3a house pattern: the sidecar is the
game's voice; baked defaults exist for packless/undeclared tiers), a
drift tripwire pins baked === ALN-declared. The toy pack declares
divergent wording and a new unit fixture asserts the diverged render
(placeholders, class labels, verbNoun at minimum), so openness is
tested, not assumed (the slice-3c "toy shipped ALN's exact five"
lesson).

**Markdown-structure safety (wording is free text):** wording that
lands inside table cells (verbNoun, adjustmentLabel, cell fallbacks)
gets the same cell sanitization `tx.summary` already has (`|` escaped,
newlines to spaces), so no pack wording can add or split columns.
Whole-line wording (placeholders, subsection labels) can only damage
the declaring pack's OWN report — the pipeline consumes only ALN's,
which is byte-pinned — accepted as the benign-wording class, recorded
here and in the contract doc.

**No new capability id (D-7.5 folded in):** report wording is
benign-wording (3a precedent: strings shipped with no capability;
R-Q2 added mode keys with none). Absent keys = today's text. The gate
gains only the verbNoun refusal twins.

### D-7.3 — The contract doc revs to v2

`ALNScanner/docs/session-report-contract.md` records the mechanism:
Change Rules #1–#5 unchanged (structure, still
never-change-without-pipeline-coordination); Rule #6 rewritten — the
placeholder/wording strings are pack-declared with ALN's declarations
byte-pinned by the golden master, so the pipeline's view of ALN output
is unchanged by construction; the Phase 3 Migration Path section
updated to record the slice-7 landing and point at ROADMAP §8.10 for
the bundle migration.

### D-7.4 — Tombstones

The `report.template` `.hbs` draft (pack-schemas `:184`) and its
manifest `role: "template"` example (`:225`) are superseded by the
ruling's "no template language" — a correction note lands in
pack-schemas.md (the slice-1 back-annotation precedent). game.json
gains NO `report` block this slice; the A1 "narrative/report config"
slot stays dormant headroom (matrix row 8.6).

## 4. Owner questions

**None held.** Both halves were ruled 2026-08-29 (program §13.4); the
remaining calls are derivations, each recorded above with its
rationale for the red team to attack: column headers stay engine-fixed
(the contract names them structure, Rule #2); class labels are
strings keys, not mode-label derivations; verbNoun is a mode key on
the R-Q2 precedent; no capability id. If the red team shows any of
these is genuinely owner-taste rather than derivation, it goes to a
grill-with-docs batch before build — that is the tripwire, not a
formality.

## 5. Build order

- **S7.1 — bundle schema** (backend only, pure additive):
  `session-bundle.schema.json` + fixture bundle + contract tests
  (validity, version const, reserved namespaces, field coverage vs the
  census input inventory).
- **S7.2 — wording block** (lockstep TokenData → scanner → backend):
  TokenData: `game.schema.json` modes `verbNoun` + ALN
  `game.json` (`blackmarket.verbNoun`) + ALN `strings.json` report
  section verbatim + manifest regen. Backend: gate refusal twins +
  resolver-mirror normalization (modeSemantics both sides). Scanner:
  `BAKED_STRINGS.report` + generator re-point (all 25 wording sites +
  verbNoun render + cell sanitization) with the golden master
  passing untouched; drift tripwires. Toy pack: divergent report
  wording + verbNoun + manifest regen + the divergence fixture test.
  Contract doc v2 + pack-schemas tombstone note. Config-tool: OUT
  (strings editing is B-pages territory; nothing here changes what it
  reads today).
- **S7.3 — close**: dual-pack Tier L, fresh ratchet, mixed-model
  adversarial review per the subagent policy, close record.

Each stage runs under the implement/tdd/code-review frame: tests
first at the seams named above (contract tests for S7.1; the golden
master + new divergence/tripwire tests for S7.2), per-stage two-axis
review, commit.

## 6. Residue

- The pipeline migration itself: ROADMAP §8.10, owner-paced, post
  Phase-4 D — nothing here starts it.
- Intake shapes inside the bundle: Phase-4 D designs them; this slice
  reserves names only.
- Divergent-pack column-header wording (the D-7.2 consequence):
  revisit at §8.10, recorded in the contract doc v2.
- Standalone report support (matrix 4.20 gap: networked-only) — out
  of scope, unchanged.

## 7. Estimate

S7.1 ≈ 1 work session; S7.2 ≈ 1.5–2 (four-repo lockstep, byte-pin
discipline); S7.3 ≈ 1. Slice ≈ **3.5–4 work sessions**, plus the
pre-build design red-team.

## 8. Execution record

(Filled as stages close.)

- 2026-09-03: slice OPENED post task-#23 review (owner-confirmed);
  branch + draft PR #30 at open; census workflow `wf_03423b14-aaf`
  (5 agents, counts verified ×2); this design doc drafted.
