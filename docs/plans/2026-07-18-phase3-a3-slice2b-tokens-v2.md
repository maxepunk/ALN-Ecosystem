# Phase 3 A3 Slice 2b — Tokens v2 + Pack-Declared Category Vocabulary (design)

**Status: RATIFIED 2026-07-18 — owner ruled YES on all three decisions
(D1b groups block in game.json / D2b exact-case canon / D3b sync as the
sole "(xN)" parser). Build opens after slice 2 closes.**

Slice 2b was owner-added at the 2026-07-17 adversarial review: replace the
string-parsed token microformats with structured, pack-declared vocabulary
— (a) `SF_Group` "Name (xN)" regex-parsed at many sites, (b)
`SF_MemoryType` as a free string keyed into scoring tables, (c)
tokens.schema.json v2 generally (its own description says a structured
group field "will be v2").

This document currently contains the CONSUM ER CENSUS (ground truth,
swept 2026-07-18 across all five repos immediately after the slice-2
decision-free core landed — the census is NOT rotted by the pending
slice-2 owner decisions D1s2–D4s2, which touch clock/score/claims/
validator surfaces, not token-schema consumers). Design sections follow
after slice 2 closes.

**Census-driven fixes ALREADY EXECUTED (slice-2 scope, landed `66124cc`):**
the sweep found two consumers of the deleted `scoring-config.json` outside
the backend-scoped L1 census — the config-tool economy editor (read AND
write; writes were silently ignored) and the Notion sync's
`load_valid_memory_types` (silent hardcoded fallback). Both re-pointed at
`game.json`. It also corrected the manifest-builder EXCLUDE entry to
TOMBSTONE doctrine (byte-parity-pinned with the Python builder).

---

## Census: SF_Group / SF_MemoryType / SF_ValueRating / tokens.schema.json consumers

### Framing facts

- The raw `SF_Group` "Name (xN)" string threads through the WHOLE system
  as a string. The backend transforms once at load (`tokenService.loadTokens`
  → `groupId`/`groupMultiplier`) but also preserves the raw string in
  `metadata.group`. The GM Scanner stores the raw string on every
  transaction (`transaction.group = token.SF_Group`) and RE-PARSES it with
  `parseGroupInfo()` at many downstream display/scoring sites.
- **FOUR separate regex implementations** of the `(xN)` microformat:
  `backend/src/services/tokenService.js`, `backend/scripts/lib/TokenLoader.js`,
  `ALNScanner/src/core/scoring.js` (canonical), `ALNScanner/src/core/tokenManager.js`
  (`_parseGroupInfoFallback`).
- tokens.schema.json v1 pins the microformat: `SF_Group` pattern
  `^$|^.+ \(x[1-9][0-9]*\)$`; `SF_MemoryType` CLOSED enum
  `[Personal,Business,Technical,Mention,Party,null]`; `SF_ValueRating` int 1-5.

### 1. SF_Group parse sites (break under a structured object) — 20 production sites / 8 files

**Backend src:** `tokenService.js:11-15` (parseGroupMultiplier regex),
`:22-25` (extractGroupName regex), `:141-142` (load-time derive), `:150`
(raw as display name — PASSTHROUGH), `:163` (metadata.group raw —
PASSTHROUGH).

**Backend scripts:** `lib/TokenLoader.js:20-24`, `:31-34` (duplicate
regexes), `:69-70` (derive), `:87` (rawGroup passthrough).

**GM Scanner:** `core/scoring.js:92-116` (canonical parseGroupInfo),
`core/tokenManager.js:88-89` (buildGroupInventory parse), `:108` (raw into
Set — PASSTHROUGH), `:142-156` (fallback regex #4),
`core/unifiedDataManager.js:14,523-525` (delegator), `:611,632` (bonus
display parse of `t.group`), `:714,719,723` (bonus math + breakdown keyed
by parsed name), `core/storage/LocalStorage.js:367,379,389` (completion
matching), `ui/renderers/GameOpsRenderer.js:306,330` (card display parse),
`app/domains/gameOps.js:296-297` (writes raw string onto transactions —
the ORIGIN of the re-parsed string in records), `ui/uiManager.js:457`
(raw display — PASSTHROUGH).

**config-tool:** `tokenBrowser.js:11,62,96` — dropdown/filter/cell treat
the raw string as an OPAQUE value (exact-match, no parse) — PASSTHROUGH.

**Notion sync:** `sync_notion_to_tokens.py:504,514,533-534,714` — emits
the "Name (xN)" string VERBATIM (never parses the multiplier) — the
microformat's producer.

**Zero consumers:** PWA (demo-data literal only), ESP32, tag-writer/
token-checkin/aln-tools (token IDs only).

### 2. SF_MemoryType consumers (~29 sites)

**Scoring lookups (6):** backend `tokenService.js:62-68,143-146`
(LOWERCASED key); `TokenLoader.js:74-77` (lowercased); scanner
`core/scoring.js:148-158` (**EXACT-CASE** — see hazards);
`GameOpsRenderer.js:303`; `gameActivityBuilder.js:27-30,69-72`;
config-tool `tokenBrowser.js:84`.

**Passthrough/display (~16):** backend `tokenService.js:152,164`,
`scanRoutes.js:76,116,316,337`; scanner `uiManager.js:455`,
`GameOpsRenderer.js:298,349`, `gameOps.js:295`,
`gameActivityBuilder.js:57-62`, `tokenManager.js:109`,
`sessionReportGenerator.js:231`; config-tool `tokenBrowser.js:9,60,94`,
`economy.js:77-131` (vocab-AGNOSTIC editor — iterates whatever keys exist).

**Hardcoded vocab lists outside pack game.json:** scanner `scoring.js:23`
(L2 baked shim, loud), backend `packService.js:86-89` (legacy shim, loud),
`sync_notion_to_tokens.py:85` (DEFAULT_VALID_MEMORY_TYPES fallback),
**`tokens.schema.json:61` CLOSED enum — the one hard v2 vocabulary
blocker**.

**Validation:** sync `load_valid_memory_types` + `validate_tokens`
(warning-only; now reads game.json), config-tool `validators.js:53-61`
(shape only), backend `utils/validators.js:36` (shape only).

### 3. SF_ValueRating beyond scoring (~14 sites)

Scoring lookups (backend tokenService/TokenLoader); star DISPLAY at
scanner `uiManager.js:467` (`'⭐'.repeat`), `GameOpsRenderer.js:354`,
config-tool `tokenBrowser.js:95`; VALIDATION at `tokens.schema.json:53-58`
(int 1-5), backend `validators.js:50` (Joi 1-5), sync range check
(`:526-530,772-776`); rest passthrough (scanRoutes, gameOps,
gameActivityBuilder, sessionReportGenerator).

### 4. tokens.schema.json / shape validation

3 file copies (canonical ALN-TokenData + `ALNScanner/data/` submodule +
`ALNScanner/dist/` build artifact); backend-internal Joi `tokenSchema`
(`utils/validators.js:32-53` — validates the TRANSFORMED shape, not raw
SF_); consumers of DERIVED `groupId`/`groupMultiplier` (unaffected by v2
as long as the loader still produces them): `gameRules/scoring.js`,
`transactionService.js:382,388,444`, `scripts/lib/ScoringCalculator.js:150`,
`GroupBonusCheck.js:197`, `GroupCompletionCheck.js:243`. Contract tests:
`tokens-schema.test.js` (AJV + group-consistency regex `:59`),
`pack-schemas.test.js` (compiles schema `:42`; typeMultipliers coverage
`:83-89`; completable-group regex `:165`).

### 5. Notion sync pipeline emission

`parse_sf_fields` (496-550): regex `SF_Field:\s*\[([^\]]*)\]` over Notion
Description. Emits `SF_RFID` (lowercased), `SF_ValueRating` (int),
`SF_MemoryType` (verbatim string, no mapping), `SF_Group` (verbatim
"Name (xN)" — multiplier NOT parsed), `SF_Summary`→`summary`.
Validation: warning-only type/rating checks + soft jsonschema. A
near-duplicate helper exists at
`.claude/skills/about-last-night-notion/scripts/sync_to_tokens.py`
(outside the pipeline — must not be forgotten in v2).

### Loud-vs-silent failure analysis (drives v2 sequencing)

**Structured SF_Group:** parse sites THROW (loud — `.match`/`.replace` on
an object skips the falsy guard); schema + Joi fail loud. SILENT sites:
scanner `uiManager.js:457` renders `[object Object]`; backend
`tokenService.js:150,163` store the object (delayed displaced failure);
config-tool browser compares/displays `[object Object]`;
`gameOps.js:296` persists the object onto transactions (re-parsed later at
6+ sites); `tokenManager.js:108` pollutes the group-inventory Set.

**Pack-declared type vocabulary:** SILENT-ZERO is the dominant risk —
every lookup is `typeMultipliers[type] ?? unknown/0`, so an undeclared id
silently scores 0×. Specific hazards: (1) **case-sensitivity parity
split** — backend lowercases both table and key; scanner `scoring.js:153`
is exact-case: a lowercased-id vocabulary silently scores 0× ONLY on the
standalone scanner (networked/standalone divergence, the worst class);
(2) baked shims freeze the ALN vocab (loud-warn when active, but any new
id under the shim scores 0×); (3) the tokens.schema.json enum fails LOUD
on any new id — the enum is the deliberate v2 unlock point.

### Census totals

SF_Group parse sites 20 (8 files, 4 regex impls; PWA/ESP32/NFC-tools 0).
SF_MemoryType ~29 (6 scoring lookups / ~16 passthrough / 4 hardcoded
lists + 1 closed enum / 3 validators). SF_ValueRating ~14. Schema: 3
copies + 1 Joi + 3 test validators. Test files touching these are listed
in the census transcript and re-derived trivially (`grep -rn SF_Group
--include='*.test.js'`).

---

## Design (RECOMMENDATIONS — drafted 2026-07-18, pending owner ratification)

### D-2b-1. Group shape: multiplier moves to the PACK, tokens carry only the name

Two candidate shapes for killing the "(xN)" microformat:

- **(a) Structured per-token object**: `"group": {"name": "Server Logs",
  "multiplier": 5}`. Kills the regex but KEEPS the redundancy — every
  member token still repeats the multiplier, and the
  inconsistent-variant failure class (typo'd multiplier splits a group;
  pinned today by `tokens-schema.test.js:59`) survives in structured form.
- **(b) RECOMMENDED — pack-declared groups block**: tokens carry only
  `SF_Group: "Server Logs"` (pure name); `game.json` gains a `groups`
  block (`{"Server Logs": {"multiplier": 5}}`). The multiplier is a GAME
  RULE and moves to where rules live (scoring/clock/modes are already
  there); the per-token redundancy and its whole failure class DIE; the
  backend loader derives `groupMultiplier` from the pack instead of
  parsing; the contract test flips from "members agree on the suffix" to
  "every token group name is declared in game.json groups" (stronger,
  simpler). Gate: a v2 pack whose tokens name an undeclared group is
  refused at activation (loud, boot-time).

### D-2b-2. Authoring stays in Notion; the SYNC becomes the only parser

Notion authors keep writing `SF_Group: [Server Logs (x5)]` — the
authoring UX does not change. `sync_notion_to_tokens.py` becomes the
SINGLE parser of the microformat: it splits name/multiplier at
authoring-time, emits v2 `tokens.json` (name only) AND the `game.json`
`groups` block (+ manifest regen, which it already does). Consequence:
the four runtime regex implementations are DELETED, not consolidated —
parsing exists exactly once, in Python, at the authoring boundary.
(Consistency check moves into the sync: two elements declaring the same
group with different multipliers is a sync-time ERROR, not a runtime
split.) The `.claude/skills/about-last-night-notion/scripts/sync_to_tokens.py`
near-duplicate must be updated or retired in the same change.

### D-2b-3. Type vocabulary: open the enum, gate the coverage, fix the case split

`tokens.schema.json` `SF_MemoryType` enum OPENS to plain string (the same
openness move as slice 1's mode flags); enforcement moves to the gate
family: activation refuses a pack whose tokens use a type absent from its
own `scoring.typeMultipliers` (the existing contract test already checks
this repo-side; the gate makes it engine-side). THE CASE RULING lands
here: RECOMMEND canonical-exact-case (types are pack-declared ids; the
backend drops its lowercase normalization in `getScoringRules`/
`calculateTokenValue`, the scanner already matches exact-case) — one rule
both sides, no silent 0× divergence. (The alternative — lowercase
everywhere — touches more sites and changes the pack authoring contract.)

### D-2b-4. Migration: ATOMIC per-pack cutover, no dual-format window

tokens.json has a SINGLE producer (the sync) and packs ship atomically
(manifest contentHash). RECOMMEND: `tokens.schema.json` v2 + a
`schemaVersion` bump the capability gate already enforces exactly — a v1
engine refuses a v2 pack and vice versa, loudly, at boot. No tolerance
window, no dual-parser debt. Both real packs regenerate in the cutover
commit; the frozen-production model means nothing deployed reads mid-
migration state.

### D-2b-5. Slice-3a ownership split

2b owns DATA-SHAPE sites (everything in the census parse tables). 3a owns
DISPLAY-STRING sites: `uiManager.js:457/455/467`, `GameOpsRenderer`
card text, config-tool browser cells, star-glyph rendering. Rule of
thumb: if the site would break under a v2 shape it is 2b; if it would
merely show different TEXT it is 3a. `SF_ValueRating` stays a 1-5 int
(display semantics are 3a; no 2b change).

### Estimate (census-based, honest)

Backend loader + scripts TokenLoader (2 derive sites + gate) ≈ 0.5
session; scanner (delete 4 parser impls, group inventory from pack
groups block, ~11 sites) ≈ 1 session; sync emission + consistency errors
+ skill-helper twin ≈ 0.5; schema v2 + contract tests + both packs
regenerated + dual-pack gate ≈ 0.5-1. **Total ≈ 2.5-3 sessions** (A2
correction factor already applied — census is real, not estimated).

### Owner decisions needed before opening (D1b-D3b)

- **D1b**: group shape (a) vs (b) — recommendation (b), multiplier in the
  pack's `groups` block.
- **D2b**: type-case canon — recommendation exact-case pack ids, backend
  drops lowercase normalization (the parity split dies by making the
  scanner's behavior the canon, not the bug).
- **D3b**: Notion authoring unchanged + sync-as-sole-parser
  (recommendation: yes) — includes ruling that same-group-different-
  multiplier becomes a sync-time hard error.
