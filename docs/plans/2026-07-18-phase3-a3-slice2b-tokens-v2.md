# Phase 3 A3 Slice 2b — Tokens v2 + Pack-Declared Category Vocabulary (design)

**Status: DRAFT — pre-open census complete (2026-07-18); design + estimate
NOT yet written; owner ratification required before any build (program
§12.3 discipline, same as slice 2).**

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

## Not yet written (blocks opening the slice)

1. **Design**: v2 shapes (structured group object? pack-declared
   `categories` block replacing the SF_MemoryType free string? star-count
   as presentation?), migration strategy (v1 tolerance window vs atomic
   cutover — note the schema enum and pattern fail LOUD, which is an
   asset), Notion authoring format changes, and the ONE-parser rule
   (4 regex impls → a single shared parse seam per side, or none at all).
2. **Sequencing interaction**: slice 3a (strings/presentation) touches the
   same display sites; decide which slice owns which sites to avoid
   double-migration.
3. **Honest estimate** from the census counts.
4. **Owner decisions** (to be enumerated with the design).
