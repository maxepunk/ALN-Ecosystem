# Phase 3 · A3 slice 3b — pack-driven formatting (currency + stars)

Status: **DRAFT** (census VERIFIED 2026-08-21 against the post-3a tree; decision-free core may build ahead per the slice-2 precedent)
Program: §3/F9 (A3a strings ✅ decision-free core / **3b formatting logic** / 3c CSS taxonomy)
Census: 3a design doc §3 handoff, re-verified by a dedicated sweep at parent `4dee0aa` / ALNScanner `ee9cd17` / TokenData `80a2c22` — every claimed site confirmed (2 line drifts, both in 3a-touched files; corrections logged in §1), 11 additional findings (§1b).

## 0. The mechanism (settled by existing headroom, one grammar ruling)

`game.json` `scoring.display` has been declared since A1 in EVERY pack — and has **zero readers**: `packService._normalizeScoring()` and the scanner's `applyPackScoring()` both actively DROP it. The packs already declare genuinely divergent specs:

| Pack | `scoring.display` |
|---|---|
| ALN (production) | `{"unit": "currency-usd", "format": "$#,###"}` |
| toy-heist | `{"unit": "credits", "format": "#,### cr"}` — no `$`, SUFFIX-positioned unit |
| parity-pack | same as ALN (and no strings sidecar — the null path) |

**Ruling R-3b-1 (recommended; the only mechanism decision):** `format` becomes the driving spec, parsed with a deliberately minimal grammar — one `#,###` **number token** (signed integer, en-US-style comma grouping via `toLocaleString` semantics) wrapped by **literal prefix/suffix affixes** (everything before/after the token, verbatim). Nothing else: no decimals, no alternative separators, no multi-token formats — the schema's `format` gains a pattern requiring exactly one `#,###` occurrence, and the activation gate refuses formats the engine can't drive (schema-open/gate-enforced house rule, same as modes/strings). `unit` stays an informational id (no consumer in 3b).

**Verbatim discipline (byte-identity for ALN):** `"$#,###"` ⇒ `'$' + value.toLocaleString('en-US')` — including the **negative quirk**: the sign rides the number token, so `-25000` renders `$-25,000`, byte-identical to today's `formatCurrency` output (and to the B9 golden's `$-25,000` line). The toy leg renders `25,000 cr` / `-25,000 cr`.

Delivery mirrors scoring/strings: backend normalizer STOPS dropping `display` (exposed via `getScoringRules()` or a sibling accessor, frozen at activation); scanner `applyPackScoring` stores it; baked ALN fallback (`$#,###`) on both sides, benign-formatting class (wrong format can't corrupt scoring — silent per-key fallback, no loud shim, same doctrine as strings).

## 1. Verified site inventory (census sweep, post-3a tree)

### Currency — consolidation targets (IN)

| # | Site | Now | 3b action |
|---|---|---|---|
| C1 | `ALNScanner/src/utils/formatCurrency.js:14` (canonical, **17** call sites: uiManager ×2, GameOpsRenderer ×15) | `'$' + v.toLocaleString()` | becomes the pack-driven formatter (parsed `format`, baked ALN fallback); call sites unchanged |
| C5 | `ALNScanner/src/app/app.js:205` | inline `` ` +$${bonus.toLocaleString()}` `` | route through formatCurrency |
| C7 | `ALNScanner/src/ui/uiManager.js:445` | `'$0'` literal (unknown-token, scoring mode) | `formatCurrency(0)` |
| C10 | `ALNScanner/index.html:297/301/307` | static `$0` seeds | rewritten at init from the pack format (same applyPackStringsToDom pass class) |
| M2 | `GameOpsRenderer.js:309/315` | `${baseValue.toLocaleString()}` symbol-less grouped money | route through the number-token half (grouping must follow the pack format) |
| C4 | `backend/public/scoreboard.html:1328` | inline `$${score.toLocaleString()}` | page-side `formatMoney()` driven by the game.json the page ALREADY fetches (slice-1 modes fetch); baked fallback |
| C6 | `config-tool/public/js/utils/formatting.js` (3 call sites) + `economy.js:133` example lines | `Intl …'USD'` hardcode | drive from the pack's declared format (config-tool reads game.json directly); ALSO fix the schema-illegal `{currency:…}` fixture shape in `configManager.test.js:19/107` (real packs use `{unit, format}`) |
| — | E2E page objects: `ScoreboardPage.js:314/421`, `GMScannerPage.js:1494/1531` | `[$,]` strip regex ×4 + `$${n.toLocaleString()}` construction | ONE shared pack-driven parse/format helper in `tests/e2e/helpers` (fed by `loadPackScoring().display` — the block already rides the existing fetch); the toy leg breaks string-compares the moment C4/C1 go pack-driven, so this lands in the SAME unit |

### Currency — OUT (classified, not forgotten)

- **Report generator** (`sessionReportGenerator.js` `_formatCurrency:348` / `_formatSignedCurrency:357` / `_formatSaleDetail:235` — census undercounted: **3** formatter methods): B9 external golden contract (`sessionReport.contract.test.js`, `docs/session-report-contract.md`), Q4/slice-7 territory. Byte-pinned `en-US`, `$`, `★` U+2605, `×`. NOT touched.
- **Debug/log strays** (`gameOps.js:350`, `unifiedDataManager.js:732` + `:827` (M1)): diagnostic text, not display — stays baked (same class as the validator family).
- **Backend validators family** (`ReportGenerator.js` ×6, `ScoringCalculator.js:270`, `ScoringIntegrityCheck.js:128/187`): operator diagnostics, ALN-named by prior ruling (slice-1 scope note) — re-point when that family migrates, not 3b.
- **PWA `generate-qr.py:131`** (7th star impl, census miss M6): ledger L3 — the A3 slices do not touch the PWA.
- **`index.html.backup`** (M8): stale dead file — delete opportunistically, not a site.
- **Award message** (`scanResponse.js` `{points}` raw interpolation, M4): **Q-3b-1, held** (§4).

### Stars

| # | Site | Now | 3b action |
|---|---|---|---|
| S1 | `uiManager.js:470` | `'⭐'.repeat(rating \|\| 0)` | shared `formatStars()` (construction centralized; per-surface glyph KEPT — §4 Q-3b-2) |
| S2 | `GameOpsRenderer.js:354` | odd `⭐ + '⭐'.repeat(max(0, rating-1))` | same helper (removes the odd construction; output identical for 1-5) |
| S3 | `GameOpsRenderer.js:484` | `'★'.repeat(r) + '☆'.repeat(5-r)` — **the only hardcoded 5-scale; `r>5` throws RangeError, `r=0` renders ☆☆☆☆☆** | helper with `scale` derived from `Object.keys(scoring.baseValues).length` + clamping (defect fix; scale is schema-frozen at 5 today — `game.schema.json` requires keys 1..5 — so no visible change, future-proof only) |
| S5/S6 | config-tool `tokenBrowser.js:95`, `economy.js:58` | `'★'.repeat(…)` | same helper (config-tool copy) |
| — | S2/S3 have **no test pin anywhere** (no GameOpsRenderer.test.js) | | pins land WITH the helper (TDD) |
| — | `assertScoreFormat` (`backend/tests/e2e/helpers/assertions.js:57`, exported, **zero callers**) | dead helper | delete or wire; do not leave dead oracle surface (single-oracle doctrine) |

Scoreboard evidence pips (`scoreboard.html:1094`, census miss M5) are progress indicators, not value formatting — OUT.

## 2. Test-coupling ledger (the lockstep surface)

Exact-output pins that move WITH their site or pin the baked fallback (full list in the census report): `formatCurrency.test.js` (property-based, `$`+toLocaleString — becomes the baked-fallback pin + gains pack-format cases), `uiManager.test.js` (`$5,000` ×5, `⭐⭐⭐` ×3, `$0`…), `app.groupCompleted.test.js` (`+$60,000`), `transaction-failed-consumer.test.js`, `07d-02` (`toLocaleString('en-US')` grouping pin), scanner report pins (OUT — golden), `scanResponse.test.js` (award pins — held with Q-3b-1), config-tool `configManager.test.js` display round-trip (fixture shape fix). Dual-pack Tier L is the real gate: with C4 + page objects pack-driven, the toy leg exercises `#,### cr` for real.

## 3. Sequencing (decision-free core)

1. **Schema + gate**: `format` pattern (exactly one `#,###`) + gate refusal for undrivable formats; both real packs already comply. Contract pins.
2. **Format grammar**: one parser, two vendored copies max (backend `gameRules`-adjacent pure fn + scanner util; drift-tripwired against each other via the shared fixture packs — same twin-pin pattern as the mode shims).
3. **Backend**: normalizer keeps `display` (accessor), scoreboard page `formatMoney()` + injection-free (page already fetches game.json). E2E page-object shared helper in the same commit (toy leg protection).
4. **Scanner**: `applyPackScoring` stores display; `formatCurrency` pack-driven; C5/C7/C10/M2 routed; `formatStars()` helper + S1/S2/S3 + defect fix + new pins.
5. **Config-tool**: formatter driven from pack; fixture shape fix.
6. Close ladder: full suites + ratchets, dual-pack Tier L, adversarial review workflow over the 3b delta, STATUS/design close records.

## 4. Owner questions (HELD — do not build)

- **Q-3b-1 — award-message number formatting.** The 3a census already flagged the contradiction: ALN declares `currency-usd` but the award message interpolates `{points}` RAW (`150000`) with the word "points". Formatting it (`$150,000`) changes ALN's visible wording and makes "points" read oddly; the clean fix is a reworded ALN template (e.g. "{points} awarded" with a formatted value) — a wording decision. Options: (a) `{points}` stays raw (status quo), (b) `{points}` becomes format-driven and ALN's sidecar rewords, (c) add a second placeholder (`{pointsFormatted}`) and let packs choose. Recommend (c) — additive, zero visible change until a pack opts in.
- **Q-3b-2 — star glyph declaration.** Three glyphs today (⭐ scan-result/stats, ★/☆ token cards, ★ config-tool). Pack-declaring the glyph (`scoring.display.ratingGlyph`?) is theming; recommend KEEP per-surface baked glyphs in 3b (construction centralizes, glyphs stay) and revisit under 3c/theme.json. Note Q1 (3a, entities.label) is still open and unrelated.

## 5. Execution record (2026-08-21 — decision-free core COMPLETE)

Built same-day in landing order: **schema pattern + gate + `gameRules/formatting.js`** (parent `0ba7017`, TokenData `d8a65d9` — 8 pins red → green); **scanner half** (ALNScanner `f5c2d00`: pack-driven formatCurrency + formatStars with the RangeError defect fix + all call sites + static seeds); **scoreboard page + E2E harness + config-tool** (parent `8205aee`: vendored MONEY grammar at the ticker, four `[\$,]`-strip sites → format-agnostic parsing, numeric score waits, config-tool formatter + schema-legal fixture fix). Flows 23 + 30 verified dual-pack at each coordinated step.

**Adversarial review round 1** (workflow: 5 lenses → strict refuters; 24 agents / 0 errors; 19 raw → 14 confirmed / 5 refuted → **6 distinct defects, all fixed same-day** — ALNScanner `04e8b79`, parent `e60dfc9`): (A, MAJOR) pack-controlled affixes reached GameOpsRenderer **innerHTML unescaped at 12 sites** — a drivable, gate-passing format could execute markup in the GM origin holding the admin JWT; all sites now `escapeHtml(formatCurrency(...))`, pinned by a markup-bearing-format render test. (B) uiManager's detective-result star site was left ad-hoc despite formatStars's centralization claim — routed. (C, MAJOR) every E2E money assertion had become affix-BLIND: flow 23 (ticker) and flow 30 (scanner scoreboard) now pin rendered text against `formatMoneyExpected(score, moneySpec(pack))` on both packs; the false in-page comment corrected; the dead helper exports gained their intended consumers. (D) scoring-formatting.test's reset relied on the shim path restoring tables (it does not) — snapshot-and-restore. (E) packService display pinned through the activation-frozen path. (F) config-tool grammar twin gained tests + an honest negatives note (Intl's `-$25,000` vs the engine's `$-25,000`; unreachable in the tool's previews). Ledger note (pre-existing, OUT of 3b): scoring.js's shim path does not restore the baked TABLES after a pack applied different ones — a single-load-per-session reality today, but worth a row.

**Close gate (final heads parent `e60dfc9` / ALNScanner `04e8b79` / TokenData `d8a65d9`, ALL exit codes read directly):** backend 2411 unit+contract + fresh ratchet (`gameRules/formatting.js` at 100%) + lint; integration 342; scanner 1503 + ratchet + L2 50 ×2 (rebuilt dist); config-tool 97; dual-pack Tier L **ALN 112P / 0F / 0-flaky** + **toy 113P / 0F / 0-flaky**; scanner CI runs 86 + 87 green. **Remaining 3b work = Q-3b-1 / Q-3b-2 only (held for owner).**

## 6. Estimate

~2-3 focused sessions for the decision-free core (§3 items 1-5 + close ladder). The page-object helper and the C4 conversion MUST land together (toy-leg breakage otherwise); everything else is independently commitable.
