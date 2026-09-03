# Phase 3 · A3 owner-ruled closers — Q1 + Q2 + Q3 + Q5 + Q-3b-1 (closes slices 3a and 3b)

Status: **EXECUTED & CLOSED 2026-08-29** (execution record in §4; this slice closes 3a and 3b — see PHASE3-STATUS rows). Was: BUILD PLAN (rulings 2026-08-22, recorded in PHASE3-STATUS; site re-verification + Q2 design red-team complete — workflow `wf_b0aa8d32-70a`, the FIRST run under the ratified mixed-model subagent policy: 3 Sonnet readers + 2 Opus + 1 Fable red-team, 6/6 agents, ~1.24M tokens)
Branch: `claude/phase3-a3-closers` (PR #27, chained from the slice-5 tip `094ca22`)

## 0. Scope (the five rulings)

- **Q1 — Account rebrand**: wire `entities.label` as declared ("Account"/"Accounts"); GM screens visibly change Team→Account.
- **Q2 — claimed-label mechanism, option A as AMENDED by the red-team** (§2 — ruling R-Q2).
- **Q3 — tokenNoun**: `strings.terminology.tokenNoun`, game-flavored sites only. Re-verification found the family is nearly closed already: `tokenService.js:164` (`Memory ${id}`) is the ONLY open gap — the scanner's game-flavored sites are already whole-sentence pack strings from 3a.
- **Q5 — scoreboard chrome → pack strings**: "Video Playing..." (:724), "INITIALIZING" (:729), "REC" (:699), and the terminal connection-status set (LIVE/OFFLINE/CONNECTING…, 6 call sites) route through the existing `packStr()` machinery with byte-identical baked defaults.
- **Q-3b-1 — option (c)**: `{pointsFormatted}` joins `{points}` in awardMessage substitution (function replacements, pack money grammar). **ALN template reword (owner-directed, exact sentence): `"Token scanned successfully. {pointsFormatted} awarded."`** — renders "…$150,000 awarded." Baked engine default keeps `{points}` wording (packless byte-identical). Toy rewords to `"Take fenced. {pointsFormatted} added to the haul."` → "1,300 cr added to the haul."

OUT (recorded as decisions): report wording (Q4 stands — the generator's "Teams:"/"Sale"/section headers stay baked; the future report noun is a SEPARATE `verbNoun` field deferred to slice 7); duplicate/rejection wording (textContent-safe today, untouched); scoreboard delivery of mode wording (GM-scanner-only this slice); config-tool modes editing (raw-JSON authoring only — gap recorded for the B pages).

## 1. Re-verification deltas (the census was 3 slices old)

- GameOpsRenderer sites drifted +2 lines (now :49-50/:72/:106/:136/:208); claim sites now :466-478 (card) + :560-579 (timeline); SOLD/EXPOSED pins moved to uiManager.test.js:736/:788.
- NEW live Q1 sites the census missed: teamRegistry.js:248 ("Team name required" error — surfaces via showError), gameOps.js:130 ("Failed to select team"), gameOps.js:513 (alert "No team selected…"), app.js:207 (toast fallback "team"), LocalStorage.js:530 ("Team not found: …" — surfaces in standalone), **gameOps.js:464 confirm dialog "Reset all team scores to zero?" — E2E-LOAD-BEARING** (07d-02:289 asserts the text; must move in the same change). teamRegistry.js:206 'Select Team...' is DEAD CODE (zero callers) — delete, don't rename. sessionReportGenerator "Teams:" headers are Q4-OUT — untouched.
- Award path: `scanResponse.js` BAKED_AWARD_MESSAGE + raw `{points}` replaceAll; **drift tripwire scanResponse.test.js:74-83 pins ALN's sidecar byte-for-byte** — moves in lockstep with the reword.
- Scoreboard: all chrome sites confirmed at census lines; **four E2E sites hard-match 'LIVE'** (23:92, 24:100/117, 25:168 — the last bypasses the page object). These go PACK-DERIVED (loadPackStrings with baked fallback) in the same commit, because the toy will declare divergent chrome as the second consumer.
- Q2 substrate: modes[] is `additionalProperties:false` (schema edit required); `resolveMode()` both mirrors carry NO presentation normalization for the new fields yet; strings.schema.json's own description advertises `strings.modes.<id>.claimedLabel` — the LOSING home — and must be rewritten.

## 2. Ruling R-Q2 (option A as amended — 37 red-team objections folded, 6 BLOCKING all resolved)

1. **Fields**: `modes[].claimedLabel` — a TEMPLATE containing exactly one `{entity}` token (the R-3b-1 money-grammar precedent; resolves the SOLD-**to**/EXPOSED-**by** preposition trap and word-order lock-in). ALN declares `"SOLD to {entity}"` + `"EXPOSED by {entity}"`; icons `"💰"`/`"🔍"`. Schema: claimedLabel pattern = exactly one `{entity}`, maxLength 48, control-char exclusion; `icon` maxLength 4 + markup-char exclusion, documented as a TEXT GLYPH — **never** a class/attribute key (the CueRenderer `icon`-as-class precedent is the trap; render-site comment says so).
2. **NO schemaVersion bump — stated out loud with the reconciliation**: these join the modes block's PRESENTATION stratum (slice-1 §2: label/verb/defaultEntity — "never branched on"), not the semantics-flag stratum whose evolution rule demands bumps. D3s2 `claims`-flag precedent: additive-optional, absence = legacy behavior. Policy line added to packService's PACK_SCHEMA_VERSION comment.
3. **Three-tier fallback, semantics-derived, never id-keyed**: declared wins → undeclared field on a declared mode = engine-generic `"CLAIMED by {entity}"`, no icon → packless/L6 = both LEGACY_ALN_MODES bakes gain the fields (byte-identical ALN). Unresolvable mode id: generic phrase, no icon. Value semantics UNTOUCHED: earned-vs-worth stays gated on `isScoringMode()`; fixtures change so points ≠ potentialValue to pin the distinction.
4. **Substitution + escaping**: `escapeHtml(template).replaceAll('{entity}', () => escapeHtml(entity))` — function replacement (GetSubstitution), both halves escaped, at EVERY interpolation incl. fallbacks. NEW `pack-controlled strings` describe block in xssEscaping.test.js (markup-bearing claimedLabel AND icon render inert) — nothing pins pack-string escaping today.
5. **Gate posture**: absent fields = silent benign fallback (strings-class); DECLARED-but-undrivable (non-string, empty, missing/multiple `{entity}`) = activation-gate refusal twin (R-3b-1 class), scanner mirrors DECLINE-not-fail; resolver normalizes (type-check + strip C0/bidi controls).
6. **Parity mirrors**: BOTH resolveMode implementations normalize the fields (parity claim stays literally true; backend consumer-less, commented as pre-wiring for report/scoreboard).
7. **Consuming-claims headline**: the card headline resolves the CONSUMING claim (`isConsumingMode`), falling back to the first claim; timeline stays per-event (correct for repeatable actions). Builder consuming-blindness NOT fixed this slice — filed.
8. **Lockstep train** (drift tripwires pin both bakes `toEqual` the real ALN game.json): TokenData first (schema + ALN declarations + strings.schema description fix + manifest) → scanner (nested pin bump + bake + resolver + renderer + pins + dist rebuild) → backend/parent (bake + resolver + pins + toy declarations + manifest). Byte-identity FULL-STRING pins: ALN renders the exact current markup both modes.
9. **Sync pipeline**: `write_groups_block` gains `ensure_ascii=False` + an emoji round-trip test (default ASCII-escaping would churn game.json bytes/contentHash on every sync once icons land).
10. **`verb` stays, documented**: schema description marks it declared-not-yet-consumed (the present-tense affordance is Track-D UX); claimedLabel documented as the claim ANNOUNCEMENT only (not cross-checked against scoringPolicy — authoring hazard noted in the schema description).
11. **Fixtures**: parity-pack stays undeclared (living null-path fixture); toy declares all three modes (`"FENCED by {entity}"` 💼 / `"TIPPED by {entity}"` 🕵️ / `"APPRAISED by {entity}"` 🔍) + a dual-pack Tier-L rendered-wording pin (pack-derived via loadPackModes).

## 3. Build order

1. **TokenData**: schema fields + patterns + descriptions (modes boundary rule, verb note, strings.schema example fix); ALN game.json claimedLabel/icon; ALN strings.json awardMessage reword + `terminology.tokenNoun: "Memory"`; push, then parent/scanner pins.
2. **Scanner**: entities wiring (Q1 — sites incl. new finds + E2E dialog lockstep; baked Team/Teams default, declared wins; dead teamRegistry:206 deleted); modeSemantics bake+resolver; renderer claim sites (substitution/escaping/consuming-headline); pins; dist.
3. **Backend/parent**: backend modeSemantics bake+resolver; scanResponse `{pointsFormatted}` (pack money grammar) + tripwire/test lockstep; tokenService tokenNoun (getStrings pattern, baked 'Memory'); scoreboard chrome STR keys + pack-derived E2E LIVE pins; gate twins + tests; sync ensure_ascii; toy declarations (all families: modes wording, chrome incl. divergent live-status, awardMessage reword, tokenNoun "Take") + manifest.
4. Close ladder: full suites + ratchets, dual-pack Tier L, **mixed-model adversarial review per the ratified policy**, close records (3a + 3b move to FULLY CLOSED).

## 4. Execution record (2026-08-29)

Built in the §3 lockstep order; every step green before the next.

1. **TokenData `1d323a7`** (pushed 2026-08-28): schema fields + patterns +
   descriptions per §2 #1/#10; ALN declares `SOLD to {entity}` 💰 /
   `EXPOSED by {entity}` 🔍; awardMessage reword + `terminology.tokenNoun:
   "Memory"`; strings.schema example moved off the losing home; manifest
   regen. Pack contract suite 38/38.
2. **Scanner `dc71046`** (PR #13 draft, CI run 91 GREEN): modeSemantics
   bake+resolver (normalization per §2 #1/#5, DECLINE warns once-per-mode)
   + `claimAnnouncement()` (§2 #4 — escaped template, function
   replacement, per-FIELD fallback) + `applyPackEntities`/`entityLabel()`;
   GameOpsRenderer consuming-claim headline (§2 #7) + declared timeline
   glyphs (content-only); Q1 across renderer/statics/dialogs/errors/CSS
   empty-state; dead populateDropdown deleted; byte-identity full-string
   pins, entities tests, NEW pack-controlled-strings XSS block. 1556 unit
   + ratchet.
3. **Backend/parent `8567a8d`** (PR #27, CI run 140 GREEN incl. BOTH
   dual-pack Tier L legs): backend mirror normalization (silent value-level
   helpers, §2 #6) + gate refusal twins (claimedLabel/icon/entities.label);
   scanResponse `{pointsFormatted}` (pack money grammar, function
   replacements, LOCKSTEP pin "…$150,000 awarded." / no 'points');
   tokenService tokenNoun; Q5 scoreboard chrome via STR (9 keys, baked
   byte-identical); ScoreboardPage class-based connection gating +
   pack-derived text/dialog E2E assertions + 07b dual-pack claim pin;
   toy pack second-consumer declarations + manifest; sync ensure_ascii
   (§2 #9) + round-trip test. 2454 unit+contract + ratchet + lint; 344
   integration; 73 scripts.
4. **Adversarial review** (mixed-model per the ratified policy — 25
   agents / ~3.5M tokens: Fable injection lens, Opus parity + state, Sonnet
   coverage + honesty; per-finding refuters, Fable on MAJORs): 20 findings
   → **6 CONFIRMED / 14 refuted**, all six fixed (scanner `8c4a75d`,
   parent `a346dd5`):
   - MAJOR: local dist stale (the §3-step-2 rebuild was skipped — CI
     builds fresh so CI was never wrong, but local E2E was provably red;
     rebuilt, then 07d-01 4P/0F, 07b 6P/0F with the claim pin rendering
     live, 07d-02 6P/0F).
   - Two Q1 census-missed toasts (gameOps :124/:224) → entityLabel.
   - scanResponse afterEach mock defaults dead under `resetMocks:true` →
     beforeEach (mutation-verified the LOCKSTEP pin now exercises the
     rules-driven path).
   - tokenNoun declared branch had zero coverage (mutation: deleting the
     read stayed green) → PACK_PATH pin in claimsPolicy.test.js.
   Notable refutations: the U+061C bidi gap (no sink consequence), the
   maxLength-48 gate mirror (deliberately schema-only per §2 #5), the Q5
   uppercase mismatch (CSS uppercases all nine sites), the session-details
   "Teams:" line (dead code, pre-existing, outside the diff).
5. **Ratchet raises** (scanner `567dfa8`): initializationSteps functions
   90→95, teamRegistry 45/60/65 — both slice-touched; nothing lowered;
   backend ratchet unchanged (JSON-identical regen reverted).

Final heads: TokenData `1d323a7` · scanner `567dfa8` · parent `a346dd5`
(+ the STATUS/close-record commit). Main-build CI green (parent run 140,
scanner run 91); the small review-fix heads ride the same PRs.
**Slices 3a and 3b are FULLY CLOSED by this slice.**

Held owner items recorded at close: GitGuardian incident 36469941 —
RESOLVED 2026-08-29, owner marked it false-positive in the dashboard
(the flagged strings are the 3a review's deliberate fixtures; the
optional fixture rename was not requested); config-tool modes/entities editing gap → B
pages; builder consuming-blindness → filed (slice 2 residue).
