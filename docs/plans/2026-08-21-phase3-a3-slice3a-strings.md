# Phase 3 A3 Slice 3a — Pack-Declared Strings (design)

Status: **DRAFT — census complete, recommendations below; owner
ratification needed only for the questions in the census §5. Decision-free
core (pre-fixes + strings.json plumbing) may build ahead of ratification,
per the slice-2 precedent.**

Opened: 2026-08-21, immediately after slice 2b closed (branch
`claude/phase3-a3-slice3a` to chain from the slice-2b tip `be24d96`).

Program scope (§3, audit F9): 3a = PURE TEXT/BRANDING into the pack, with
three pre-fixes — the scoreboard's hardcoded admin password, the
F-SHOW-29 idle-loop literal, and the "Case File" title, which is a
FUNCTIONAL xdotool selector (displayDriver window search) and must become
shared config consumed by both sides, never merely rebranded. Formatting
LOGIC is 3b; CSS taxonomy is 3c; the PWA is out of scope (ledger L3).

Census method: 6 parallel surface census agents + synthesis (workflow
`slice3a-census`, 2026-08-21, all sites verified against the working
tree). Totals: **160 3a sites, 50 → 3b, 16 → 3c, 35 out-of-scope.**

---

# A3 Slice 3a — Pack-Declared Strings: Census (synthesized, six surfaces)

All sites verified against the working tree 2026-08-21. Delivery mechanism (settled by existing plumbing, not an open question): a `strings.json` sidecar — `game.schema.json` already defines the `strings`/`theme` filename pointers (headroom, `ALN-TokenData/game.schema.json` ~451-458), and `backend/scripts/build-pack-manifest.js:39-40` already assigns manifest roles `strings`/`theme`. Missing pieces are work items, not decisions: author `ALN-TokenData/strings.json`, set `game.json.strings`, write `strings.schema.json` + activation-gate validation (none exists today), and add consumers (GM scanner via packLoader; scoreboard via its existing `/api/pack/files/*` fetch pattern proven at `scoreboard.html:1113-1129`; config-tool via `GET /api/config`, which must additionally expose pack identity — today it serves only `{env, scoring, cues, routing}`).

Pack-home paths below: `strings.*` = new strings.json keys; `modes[].*` / `entities.label` / `scoring.display` / `title` = existing game.json blocks (consumption gaps, not new keys); `shared-config` = engine/venue config, **never** pack (§2).

## 1. 3a sites by surface

### S1 — Backend scoreboard page + display driver

| Site | Literal | Proposed pack home | Couplings |
|---|---|---|---|
| `backend/public/scoreboard.html:9` | `<title>Case File: About Last Night</title>` | **shared-config** window marker + visible half composed from game.json `title` | **BOOBY TRAP (functional)**: `displayDriver.js:81` finds the kiosk window by this title. No test pins the title text — a rebrand passes CI and breaks HDMI show/hide at the venue. `ScoreboardPage.getTitle()` exists (:543) but no flow asserts it. Documented `backend/CLAUDE.md:227`, matrix 2.5. |
| `backend/src/utils/displayDriver.js:81` | `run('xdotool', ['search', '--name', 'Case File'])` | **shared-config** (same single source as the `<title>`) | Pair of :9. Unit tests (`displayDriver.test.js`) mock on `--name` arg position only — literal change is unit-test-invisible. Doc comment :10 + `backend/CLAUDE.md:227` restate the literal. |
| `backend/public/scoreboard.html:772` | `adminPassword: '@LN-c0nn3ct',` | **shared-config** (venue secret — see §2 pre-fix) | Must equal `.env` `ADMIN_PASSWORD` (`backend/.env:14` matches; `config/index.js:67` defaults `'admin'`). Same literal: `tests/e2e/helpers/test-config.js:13`, `tests/e2e/setup/test-server.js:80`, `backend/test-scoreboard-update.js:11`; referenced `.env.example:83`, `tests/e2e/README.md:152`, `backend/CLAUDE.md:578`. |
| `backend/public/scoreboard.html:692` | `<span>CASE FILE: ABOUT LAST NIGHT</span>` | `strings.scoreboard.header`, composing game.json `title` (already "About Last Night") | None functional — unlike :9, no selector coupling. Safe pure extraction. |
| `backend/public/scoreboard.html:716` + `:1286` | `<span class="ticker-empty">No scores recorded</span>` (static + JS re-render) | `strings.scoreboard.emptyTicker` (one key, two sites) | `.ticker-empty` **class** is load-bearing (`23-scoreboard-live-data.test.js:257`, `ScoreboardPage.js:48,285-289`); text is free. |
| `backend/public/scoreboard.html:1001` | `'<div class="evidence-empty">Awaiting evidence...</div>'` | `strings.scoreboard.emptyEvidence` — **shared key ×3** with ALNScanner `index.html:519` + `EvidencePickerRenderer.js:38` | **Exact-text E2E**: `27-scoreboard-evidence-navigation.test.js:109` `toBe('Awaiting evidence...')` — lockstep update or source the expectation from the pack. |
| `backend/public/scoreboard.html:1134` + `:1641` | `const owner = transaction.owner \|\| 'Unknown'` | `strings.scoreboard.unknownOwner` | Fallback label **doubles as the evidence-page grouping key** (`state.evidenceByOwner` Map key / `scoreboard:page` owner jump) — both sites must share one value. |
| `backend/public/scoreboard.html:724` | `Video Playing...` | `strings.scoreboard.videoOverlay` — *borderline, see Q5* | None. |
| `backend/public/scoreboard.html:729` | `INITIALIZING` | `strings.scoreboard.loading` — *borderline, see Q5* | `ScoreboardPage.js:400` waits on `#loadingIndicator` hidden state — id load-bearing, text free. |
| `backend/public/scoreboard.html:699` | `<span class="rec-indicator">REC</span>` | `strings.scoreboard.recIndicator` — *borderline, see Q5* | None (decorative surveillance motif). |

### S2 — Backend services (server-produced GM-facing text)

| Site | Literal | Proposed pack home | Couplings |
|---|---|---|---|
| `backend/src/websocket/scanResponse.js:19` | `` `Token scanned successfully. ${transaction.points} points awarded.` `` | unit-aware wording from `scoring.display` (declared unit is `currency-usd`; "points" + raw unformatted number contradict it) — `strings.scoring.awardMessage` template | `scanResponse.test.js:22` exact `toBe`; contract fixture `event-handling.test.js:315`. Displayed verbatim by GM scanner. Reword only with coordinated test + contract-doc updates. |
| `backend/src/services/tokenService.js:164` | ``name: token.SF_Group \|\| `Memory ${id}` `` | `strings.terminology.tokenNoun` (or leave — internal fallback; see Q3) | Flows into group displays for ungrouped tokens. |
| `backend/scripts/lib/ReportGenerator.js:16` | `'# ALN Session Validation Report'` | derive from resolved pack `title` (validator already pack-aware via `scripts/lib/packResolver.js`) — low priority | Operator-facing markdown; no test pins found (verify at change time). |

### S3 — GM Scanner shell (`ALNScanner/index.html`)

| Site | Literal | Proposed pack home | Couplings |
|---|---|---|---|
| `index.html:6` | `<title>Memory Transaction Station</title>` | `strings.scanner.appTitle` | E2E `00-smoke.spec.js:16` `toHaveTitle(/Memory Transaction Station/i)`. |
| `index.html:70` | `<h1>Transaction Station</h1>` | `strings.scanner.appTitle` (short form) — engine-neutral, optional | None. |
| `index.html:71` | static seed `>Detective Mode</div>` (+ `mode-detective` class) | `modes[].label` (**existing**) — render at init / neutral placeholder; class half is 3c | `initializationSteps.test.js:18,32,46`, `uiManager.test.js:234,247`, E2E `02-standalone-mode.spec.js:227,234,239` pin `"<label> Mode"`; backend `GMScannerPage.js:485` reads the pill. `app.js:131-133` comment already flags the baked default. |
| `index.html:187` | `<h2>Tap Memory Token</h2>` | `strings.scanner.scanPrompt` | None. |
| `index.html:199` | `<div ... id="teamValueLabel">Total Value</div>` | `strings.scanner.statLabels` (pairs with `uiManager.js:299/302`) | None. |
| `index.html:216` | `<label>Memory Type:</label>` | `strings.terminology.categoryLabel` (**shared key ×3**: + `GameOpsRenderer.js:348`, config-tool `economy.js:71`) | None. |
| `index.html:224` | `<label>Value Rating:</label>` | `strings.terminology.ratingLabel` (shared with config-tool `economy.js:31`, `tokenBrowser.js:38`) | Coordinate key naming with 3b star consolidation. |
| `index.html:271` | `<h2>🏆 Black Market Scoreboard</h2>` | derive from `modes[].label` of the mode with `displayBehavior.surface === 'scoreboard-rankings'` — do NOT add a duplicate string key | Heading is wrong today for the toy-heist fixture ("Fence"). Button gating already surface-driven (slice 1). |
| `index.html:272` | `Team Rankings` | `entities.label.plural` (**existing, zero consumers**) | entities family (Q1). |
| `index.html:518` | `Scoreboard Evidence` (admin section title) | derive from evidence mode label + surface, or `strings.evidence.sectionTitle` | None. |
| `index.html:519` | `Awaiting evidence...` | `strings.scoreboard.emptyEvidence` (shared ×3) | See S1 :1001 row. |
| `index.html:526` | `<option value="">Jump to character…</option>` | `strings.attribution.entityNoun` ("character" = ALN vocabulary; no existing block covers owner attribution) | Runtime twin `EvidencePickerRenderer.js:54`. |
| entities.label family (static): `index.html:158` "Select Team", `:163` "Enter team name...", `:183` "Team … Ready", `:190-191`+`:233` "Finish Team", `:245` "Teams", `:285` "Team Details", `:534` "Team Scores" | "Team"/"Teams" hardcodes | `entities.label.singular/plural` (**existing** — declares "Account"/"Accounts", consumed by NOTHING: zero `entities` hits in `ALNScanner/src`) | Gated on Q1. E2E navigates by ids (`#teamEntryScreen`) — text-safe. `:285` overwritten at runtime by `GameOpsRenderer.js:134` — change together. |

### S4 — GM Scanner JS (uiManager, renderers, domains, app)

| Site | Literal | Proposed pack home | Couplings |
|---|---|---|---|
| `src/ui/renderers/GameOpsRenderer.js:468` | `💰 SOLD to ${…}` | per-mode claimed label — new declared key (Q2: `modes[].claimedLabel` vs `strings.modes.<id>.claimedLabel`); icon → `modes[].icon` | `uiManager.test.js:696` `toContain('SOLD to')`. In-code comment :465-466: *"wording is slice-3a scope"* — the strongest 3a marker in the codebase. `verb: 'Sell'` cannot derive "SOLD" (English morphology). |
| `GameOpsRenderer.js:471` | `🔍 EXPOSED by ${…}` | same mechanism (verb "Expose" declared) | `uiManager.test.js:748` `toContain('EXPOSED by')`. Branch already mode-semantics-driven. |
| `GameOpsRenderer.js:561` | `isScoringMode(event.mode) ? '💰' : '🔍'` | `modes[].icon` (new key; same icons as :468/:471) | None. |
| `GameOpsRenderer.js:492` + `:573` | `Intel` button / `Intel:` label | `strings.terminology.summaryLabel` | None. |
| `GameOpsRenderer.js:348` | `Memory Type` detail label | `strings.terminology.categoryLabel` | None. |
| entities.label family (JS): `GameOpsRenderer.js:47-48` "No Teams Yet…", `:70` `Team ${id}`, `:104` group toast, `:134` `Team ${teamId}`, `:206` "This team hasn't scanned…"; `src/core/teamRegistry.js:287-288` "Recent Teams:"/"Session Teams:"; `src/app/domains/gameOps.js:124` "Please enter a team name", `:223` "…select a team…" | "Team"/"team" hardcodes | `entities.label.singular/plural` (existing) | Gated on Q1. `uiManager.test.js:391` `toContain('No Teams Yet')`; backend `GMScannerPage.js:799` selects by teamId text (prefix-resilient); verify GMScannerPage team-details locators before changing :134. |
| `src/ui/uiManager.js:299` / `:302` | `'Score'` / `'Total Value'` | `strings.scanner.statLabels` (mode-conditional; toggle logic stays engine) | None text-based. |
| `src/ui/uiManager.js:228` | `` `${modeLabel(mode)} Mode` `` suffix | `strings.scanner.modeSuffix` template — *borderline; label itself already pack-driven* | Exact concatenation pinned ×4 (see index.html:71 row); comment :215-216 notes byte-identity is deliberate for page objects. |
| `src/app/domains/gameOps.js:284` | `'No points awarded'` | `strings.scoring` unit-aware wording (family with `app.js:235` "— no points awarded" and `scanResponse.js:19`) | `transaction-failed-consumer.test.js:102,153` `toContain`. |
| `src/app/app.js:234-235` | `'Token already claimed'` fallback + `— no points awarded` suffix | `strings.scoring` wording family (backend message passes through verbatim — see S2 coupling) | `transaction-failed-consumer.test.js:77`. |
| `src/ui/renderers/EvidencePickerRenderer.js:37` | `` `${n} character${…} on board` `` | `strings.attribution.entityNoun` | `EvidencePickerRenderer.test.js` hint asserts. |
| `EvidencePickerRenderer.js:38` | `'Awaiting evidence...'` | `strings.scoreboard.emptyEvidence` (shared ×3) | `EvidencePickerRenderer.test.js:52-70` exact `toBe`. |
| `EvidencePickerRenderer.js:54` | `'<option value="">Jump to character…</option>'` | `strings.attribution.entityNoun` | Static twin `index.html:526`. |

### S5 — Session report generator (**censused; NOT extracted in 3a by default — see Q4**)

All wording in `ALNScanner/src/core/sessionReportGenerator.js` is byte-pinned by the B9 external contract: `docs/session-report-contract.md`, GOLDEN_OUTPUT in `tests/contract/sessionReport.contract.test.js` (:170-260 golden, :296-325 anchors), and the external GenAI pipeline `parseRawInput` (github.com/maxepunk/aboutlastnight) which parses headings and position-based columns. Matrix 8.2: pack-themed titles must NOT alter parsed structure; Q11 (titles fixed vs per-game) unresolved. Section MEMBERSHIP is already flag-driven (slice 1); only wording is baked. Sites recorded for the future slice-7 `report.template` migration: `:86` "(N detective, N black market)" → `modes[].label`; `:110` "## Detective Evidence Log" (pipeline anchor); `:115` empty-state; `:122` "| Token | Owner | Exposed By | … |" → verb-derived; `:146` `type: 'Sale'` → verb-noun form (schema gap — no declared noun for "Sell"); `:180` "| … | Team | … |" + `:46`/`:85` "Teams" → entities.label; `:216` "sales/adjustments" breakdown. Engine-generic headings (`:45`, `:83`, `:90`, `:168`, `:208`, `:253` etc.) are slice-7 template territory regardless.

### S6 — Config tool

| Site | Literal | Proposed pack home | Couplings |
|---|---|---|---|
| `config-tool/public/index.html:6` | `<title>ALN Config Tool</title>` | derive from game.json `title` — requires `GET /api/config` to expose pack identity (work item) | None — zero UI-text test coupling anywhere on this surface. |
| `config-tool/public/index.html:17` | `<div class="sidebar__logo">ALN</div>` | derive from `title` (abbrev.) or new meta shortName | None. |
| `config-tool/public/js/sections/economy.js:22` | `'Dollar value per star rating (Black Market mode)'` | derive from `modes[].label` (scoring mode) + `scoring.display.unit` | None. |
| `economy.js:31` / `:73` | `'Stars'` / `'Example (3★)'` | `strings.terminology.ratingLabel` (+ glyph belongs to 3b) | None. |
| `economy.js:32` | `'Base Value ($)'` | derive symbol from `scoring.display` (declared `$#,###`, read by nobody) | 3b symbol duplication (`formatting.js`). |
| `economy.js:63` / `:71` | `'Multiplier applied per memory type'` / `'Memory Type'` | `strings.terminology.categoryLabel` (type NAMES already data-driven; only axis labels are baked) | None. |
| `tokenBrowser.js:38` | `` `${r} Star` `` | `strings.terminology.ratingLabel` | None (also grammatically wrong plural). |
| `config-tool/lib/validators.js:54` | `'…mapping memory types to multipliers'` | n/a — reword to engine-neutral "types" (not a pack extraction) | None. |

## 2. Shared-config / venue list — 3a must NOT move these into the pack

**Pre-fix 1 — "Case File" window marker (the booby trap).** `displayDriver.js:81` discovers the Chromium kiosk window via `xdotool search --name 'Case File'` (substring/regex) against `scoreboard.html:9`'s `<title>`. Matrix 2.5 classifies this **engine-fixed mechanism coupled to a game-content string** and prescribes the order: extract a **stable non-themed window marker** (e.g. fixed title suffix `ALN-SCOREBOARD`) into ONE shared engine config value consumed by BOTH `displayDriver.js` and `scoreboard.html` (server-injected/templated title) **before** any strings extraction; only then may the visible title compose `strings.scoreboard.header` + pack `title`. Never rebrand-only — failure is runtime-only with green CI (unit mocks match `--name` by position; no E2E asserts the title). Update `backend/CLAUDE.md:227` + `displayDriver.js:10` doc comments in the same change. Note: nothing in config-tool references the marker, so no ripple there — but if the shared home is a new config file rather than `.env`, config-tool's env editor (`infra.js` ENV_GROUPS) won't surface it without a follow-up.

**Pre-fix 2 — scoreboard admin password.** `scoreboard.html:772` bakes `'@LN-c0nn3ct'` into a publicly served static file, matching live `backend/.env:14` `ADMIN_PASSWORD` (matrix 2.34: venue-config secret; remediation "Fix hardcode (not pack work)"). Fix: server-injected credential/config at serve time, or a scoped display-token flow for the kiosk deviceId — then delete the literal. Coordinate the FIVE co-located literals in one change: `scoreboard.html:772`, `tests/e2e/helpers/test-config.js:13`, `tests/e2e/setup/test-server.js:80`, `backend/test-scoreboard-update.js:11`, `.env.example:83` reference — otherwise tests mask the defect. The existing venue surface is `config-tool` `infra.js:31` (ADMIN_PASSWORD env editor). The value never enters the pack.

**Pre-fix 3 — idle-loop literal (F-SHOW-29).** All three functional literals live in `vlcMprisService.js` (`:315` initializeIdleLoop, `:332` returnToIdleLoop, `:345` `_idleLoopExists` path) — matrix 2.3's cited sites (`displayControlService.js:6,135`, `videoQueueService.js:852-853`) are now comments only (stale row; log the correction). 3a consolidates to ONE engine/venue config key (all three sites, or the guard checks a different file than VLC plays); the matrix's `display.idleLoop` **pack** home is deliberately deferred to slice 6/B12+F5 — videos are not pack content yet and the mp4 lives in `backend/public/videos`, outside the pack dir (PHASE3-STATUS.md:168 flags the asset-channel question). Couplings: `FEATURE_IDLE_LOOP` env (:303/:327 — stays engine), unit pins `vlcMprisService.test.js:549,616` `stringContaining('idle-loop.mp4')` + `videoQueueService.test.js:1194`, E2E flow 08, sync exemption `sync_notion_to_tokens.py:814` `ALIGNMENT_EXEMPT_STEMS`, `scripts/tests/test_sync_pipeline.py:159`, `docs/preflight-checklist.md`. **Out-of-census defect found**: `idle-loop.mp4` is absent from `backend/public/videos/` in this checkout — the `_idleLoopExists()` guard is silently disabling the idle loop right now (file a ticket; not 3a work).

**Never pack, no change needed:** UDP discovery constants `ALN_DISCOVER`/`ALN_ORCHESTRATOR` (`discoveryService.js:81,83` — wire protocol, test-pinned); PM2 name `aln-orchestrator` + `/tmp/aln-*` PID/socket files + logger defaultMeta; deviceIds `SCOREBOARD_DISPLAY` (`scoreboard.html:743`) / `SCOREBOARD_HDMI` + kiosk URL (`displayDriver.js:54`); connection-status strings CONNECTING/LIVE/OFFLINE/etc. (`scoreboard.html:697,1402-1496` — engine chrome; **'LIVE' is page-object-pinned**, `ScoreboardPage.js:100`) and `gameOps.js:232` "Cannot scan: session is …" (**exact-string page-object coupling**, `GMScannerPage.js:325`); duplicate-scan chrome (`gameOps.js:260-284` headline strings, `scanResponse.js:21/24` A7 messages — contract-adjacent); ALN-TokenData NFC tools' self-branding (live inside the pack repo); `modeSemantics.js` baked shims (scanner + backend + scoreboard `Set(['detective'])` at :1112 — sanctioned L6-family, drift-tripwired, NOT gaps). Adjacent notes for the ledger: `scoreboard.html:799/892` numeric `7200` fallback duplicates pack `gameClock.duration`; `scoreboard.html:12-14` Google Fonts CDN links are an offline-LAN risk (same class as the fixed socket.io CDN bug, :733-735) — ledger-row candidates, not string sites.

## 3. 3b / 3c handoff (classify-only census)

**3b — formatting logic.** Currency: **5 primary implementations** (audit's ×5 confirmed) — `ALNScanner/src/utils/formatCurrency.js` (canonical, ~15 call sites, the consolidation target), `ALNScanner/src/core/sessionReportGenerator.js` (×2 methods, contract-pinned en-US), `backend/public/scoreboard.html` (inline, E2E-parsed: `ScoreboardPage.js:421` strips `[$,]`), `ALNScanner/src/app/app.js` (inline), `config-tool/public/js/utils/formatting.js` (Intl, hardcodes USD) — plus strays: `ALNScanner/src/ui/uiManager.js` (`'$0'`), `ALNScanner/src/app/domains/gameOps.js:350`, `ALNScanner/src/core/unifiedDataManager.js:732`, `ALNScanner/index.html` static `$0` defaults, `backend/scripts/lib/ReportGenerator.js` + `ScoringCalculator.js` + `ScoringIntegrityCheck.js` (validator family). Stars: **6 implementations** (audit said ×4; census found +2 in config-tool) — `ALNScanner/src/ui/uiManager.js:467`, `ALNScanner/src/ui/renderers/GameOpsRenderer.js:354` (odd `1+repeat(rating-1)` construction) and `:484` (**the only hardcoded 5-scale** — `'☆'.repeat(5-rating)`; scale derivable from `scoring.baseValues` keys), `ALNScanner/src/core/sessionReportGenerator.js:235` (contract-pinned), `config-tool/public/js/components/tokenBrowser.js:95`, `config-tool/public/js/sections/economy.js:49`. Declared-but-unread home already exists: `scoring.display {unit:'currency-usd', format:'$#,###'}` — **no consumer parses it**; 3b decides whether `format` becomes the driving spec.

**3c — CSS/mode/type taxonomy.** Files: `ALNScanner/src/styles/variables.css` (`--color-mode-*`), `ALNScanner/src/styles/components.css`, `ALNScanner/src/styles/screens/admin.css` (`.type-personal…` closed set vs pack-open vocabulary), `ALNScanner/src/styles/screens/scanner.css`; class emitters `ALNScanner/src/ui/uiManager.js:229` (`mode-${id}`), `ALNScanner/index.html:71`, `ALNScanner/src/ui/renderers/GameOpsRenderer.js:482,486,560`; `backend/public/scoreboard.html` (`.mode-detective` rules :632-639 + the unconverted `?mode=detective` URL-param branch :948-951 — should key off `displayBehavior.surface` when 3c runs).

## 4. R13 extraction-brake citation (program §3 standing rule)

This slice moves the game-content halves of capability-matrix rows **4.3** (residual mode-label seeds/derived headings — labels themselves went pack-side in slice 1), **4.5**, **4.6**, **4.18**, **4.21** (GM scanner screen copy, scoreboard-screen branding, game-activity claim wording/terminology, app titles), **1.25/1.26** (the unit/label **string** half only — formatter/glyph logic is 3b's), the scoreboard branding sites within **2.5**'s game-content half, and the **6.x** authoring-surface labels (6.2/6.5-adjacent editor copy). None of these rows is classified `engine-fixed` or `venue-config` in the moved half. Three rows are deliberately NOT moved to the pack: **2.5**'s mechanism half (engine-fixed window discovery — the pre-fix implements the matrix's own remediation, a stable non-themed marker in shared config, before any theming); **2.34** (venue-config secret — the pre-fix removes the hardcode per the matrix's "Fix hardcode (not pack work)"); **2.3**'s pack declaration (partial move: 3a consolidates the literal to engine config; `display.idleLoop` in the pack is sequenced behind slice 6/B12+F5 because videos are not yet pack content — logged here as an explicit partial-deferral, together with the row's stale line-number correction: functional literals are in `vlcMprisService.js:315/332/345`, not `displayControlService.js`). Rows **4.20 + 8.1-8.4** (session report) are censused but excluded from extraction pending Q4/Q11 — the external-contract classification stands. Row **5.3** (PWA/ESP32 branding) is untouched per debt-ledger L3 and audit F8. No row is reclassified by this slice.

## 5. Open design questions (owner decisions)

> **ALL FIVE RULED 2026-08-22** (PHASE3-STATUS "Owner rulings 2026-08-22"): Q1 = Account rebrand IS intended fiction (wire as declared); Q2 = Option A (claimedLabel+icon on the mode, game.json, red-team before build); Q3 = as proposed; Q4 = OUT confirmed; Q5 = scoreboard chrome joins strings.scoreboard.*. Build = the closers package (`claude/phase3-a3-closers`).

- **Q1 — entities.label ratification (blocks the largest 3a family, ~20 sites).** game.json declares `"Account"/"Accounts"`; every surface says "Team". Wiring consumers as-declared is a **visible copy change** (Team→Account) on GM screens, dropdowns, and toasts. Ratify the intended ALN label — fix the pack to "Team"/"Teams", or accept the rebrand — before any consumer lands. (Wire field stays `teamId` per ledger L4 regardless.)
- **Q2 — claimed-label mechanism.** "SOLD to"/"EXPOSED by" (+ 💰/🔍 icons) need a declared per-mode past-tense/status form; `modes[].verb` ("Sell"/"Expose") cannot derive it. Choose: new `modes[].claimedLabel` + `modes[].icon` fields (schema change to the modes block) vs `strings.modes.<id>.*` in the sidecar (no game.schema change). Same mechanism later feeds the report's `'Sale'` noun (verbNoun) if Q4 opts in.
- **Q3 — token-noun boundary.** The pack can name the scannable object ("Memory" vs engine "token"): "Tap Memory Token", `tokenService.js:164` fallback, vs generic "N tokens collected" / config-tool "Token Browser". Decide whether `strings.terminology.tokenNoun` exists and where the line sits (proposal: game-flavored sites only; engine "token" vocabulary stays), or 3a ships without it.
- **Q4 — report wording in or out.** Default per this census: **out** (B9 external contract, golden test, unresolved Q11; slice 7 owns `report.template`). Opting in means a deliberate, versioned contract bump coordinated with the aboutlastnight/reports pipeline — confirm the default or schedule the bump.
- **Q5 — scoreboard theming depth.** Borderline engine-chrome strings on the themed kiosk: "Video Playing...", "INITIALIZING", "REC" (and optionally the terminal-styled connection statuses). Include in `strings.scoreboard.*` or leave as engine copy — cheap either way; full "Classified Evidence Terminal" theming is 3c/theme.json territory regardless.

## 6. Estimate (census-based)

~**5-7 focused sessions** for the default scope (report strings excluded per Q4):

1. **Pre-fixes** (window marker + password de-bake incl. 5 co-located test/dev literals + idle-loop consolidation, with E2E/unit lockstep): ~1-1.5 sessions.
2. **Strings infrastructure** (strings.json authoring, strings.schema.json + activation-gate validation, manifest/packLoader/scoreboard-fetch/config-tool `GET /api/config` identity exposure): ~1-1.5 sessions.
3. **GM scanner site conversions** (~25 sites incl. claimed-labels, terminology, mode-seed; heavy test lockstep: `uiManager.test.js` ×6 pins, `transaction-failed-consumer.test.js`, `EvidencePickerRenderer.test.js`, `initializationSteps.test.js`, E2E specs 00/02, backend page objects): ~1.5-2 sessions.
4. **Scoreboard + backend text + config-tool** (header/empties/unknownOwner shared keys, `scanResponse.js` wording + contract-doc coordination, config-tool labels): ~1 session.
5. **entities.label wiring** (post-Q1 only; mechanical but wide, ~20 sites + page-object verification): ~0.5-1 session.

Add ~1 session if Q4 opts the report in (contract version bump + golden regeneration + pipeline coordination). Main schedule risks: Q1 stalling item 5, and the exact-string test lockstep in item 3 — every extraction PR must carry its test updates or CI goes red without protecting anything (the two real hazards, the window title and the password, have **no** failing test today).

---

## 7. EXECUTION RECORD — decision-free core (2026-08-21)

The census's decision-free scope is BUILT, reviewed, and fix-swept. Q1–Q5 remain HELD FOR OWNER; the families they gate (entities.label ~20 sites, claimed-labels, tokenNoun, report opt-in, scoreboard theming depth) are the only 3a work outstanding.

**Landed, in order** (branch `claude/phase3-a3-slice3a` chained from slice-2b tip `be24d96`; PR #23 draft CI vehicle; TokenData + ALNScanner slice branches carry the pack/scanner halves):

1. **Pre-fixes (§2)** — window marker (`config.display.scoreboardWindowMarker` consumed by BOTH displayDriver and the served page via `%%WINDOW_MARKER%%` injection; tripwire suite `scoreboardWindowMarker.test.js`), password de-bake (serve-time `%%ADMIN_PASSWORD%%` injection; the five co-located literals coordinated), idle-loop consolidation (`config.display.idleLoopFile`, F-SHOW-29): parent `1f024d2`, `612bea8`, `2f806a1`.
2. **Strings infrastructure** — `strings.schema.json` (open vocabulary: sections of non-empty string leaves, nesting allowed, kind/schemaVersion const), `packService._loadDeclaredStrings` + `getStrings()` with the declared⇒must-load gate (undeclared ⇒ null, benign-wording class, no loud shim; frozen-at-activation snapshot): parent `ceb7eb6`, TokenData `4a6d403`/`818bb62`.
3. **Scoreboard consumer vertical** — served page consumes the pack sidecar via `%%PACK_STRINGS%%` injection + `STR` table (header, emptyTicker, emptyEvidence, unknownOwner — the last doubling as the evidence-page grouping key); ALN sidecar authored VERBATIM; toy pack declares a genuinely second wording; parity-pack deliberately undeclared (the null path): parent `927dc0c`, TokenData `18c8011`.
4. **GM scanner consumer** — packLoader grew the `strings` rules role (staged refresh, sha1-verified, declared⇒must-load; cache tier resolves via the cached game.json pointer; bundled tier best-effort); `core/strings.js` (`applyPackStrings`/`getString`, baked ALN defaults drift-pinned, kind/schemaVersion client mirror that DECLINES, `Object.hasOwn` walk); consumers: document title, scan prompt, mode-conditional stat labels, shared ×3 emptyEvidence admin hint via `applyPackStringsToDom` (Phase 1A); flow-27 hint pin flipped to pack-derived — the toy Tier-L leg proves the scanner renders "Awaiting tips..." end-to-end: ALNScanner `f719b5a`, TokenData `5a986ab`.
5. **Award message (S2)** — `scanResponse` accepted-branch wording reads `strings.scoring.awardMessage` (`{points}` placeholder contract) from the activation snapshot; ALN declares it verbatim (drift-pinned), toy rewords; duplicate/rejection chrome stays engine (A7): parent `7158f7e`, TokenData `1f72591`.
6. **Config-tool (S6)** — `GET /api/config` exposes pack identity `{id, title, version, contentHash, modes}` (nulls for packless dirs); SPA titles itself from `pack.title`; economy subtitle derives its mode label from the pack's declared scoring mode (`scoringPolicy === 'standard'`). Terminology keys (categoryLabel/ratingLabel) deliberately deferred to coordinate with 3b naming: parent `7158f7e`.

**Adversarial review (workflow-orchestrated, round 1):** 6 lenses → dedup → 1 strict refuter per finding; 30 agents, 0 errors; 24 raw → 22 CONFIRMED / 2 refuted, collapsing to 7 distinct defects — ALL RESOLVED same-day (parent `87bf568`, `76b100b`; ALNScanner `ee9cd17`; TokenData `80a2c22`):

- **Stored XSS / script-context breakout (CRITICAL):** `JSON.stringify` leaves `<` unescaped — a pack string containing `</script>` broke out of the scoreboard's inline script block (the page that holds the venue admin password). `jsonForScript` emits `\u003c` (+ U+2028/U+2029); breakout tripwire round-trips the injected JSON. *(Found independently by self-review minutes before the workflow confirmed it 3-lens.)*
- **`replaceAll` `$`-substitution corruption (MAJOR, 3 lenses):** string replacements run GetSubstitution — a password `p@$$w0rd` served MANGLED (silent scoreboard auth failure), `$'` spliced the rest of the page into the literal. All three injections now use FUNCTION replacements; pinned with `$$`/`$&`/`$'` payloads.
- **Gate top-level type guard (MAJOR):** declared sidecar of JSON `null` CRASHED activation; primitives/arrays destructured to empty sections and PASSED silently. Refused cleanly now (scanner mirror already had the guard).
- **Fast-path sidecar loss on the pre-3a upgrade path (MAJOR):** a cache staged by pre-3a code (rules set {game,tokens}) holds the 3a pack's game.json WITHOUT the sidecar; sw.js's `aln-pack-*` GC exemption preserves it across the code update, and the hash-matched fast path activated it — baked wording until the next contentHash change while the backend rendered pack wording. Fast path now treats the incomplete cache as no-cache and refreshes; the OFFLINE cache tier deliberately still tolerates it (cached tokens with baked wording beat stale bundled tokens — pinned as doctrine).
- **Canonical-filename contract (role-vs-pointer split, 5 findings):** manifest builders role `strings` only for the literal `strings.json` while game.json's pointer allowed any `*.json` — a schema-legal `wording.json` rebranded the backend and silently left the scanner baked. Closed at three layers: `game.schema.json` pins the pointer `const 'strings.json'` (declaring = presence, not naming; relaxation requires role-follows-pointer in both builders + loader first), the gate refuses divergent pointers (hand-built PACK_PATH packs bypass the schema), and the scanner's staged refresh FAILS when game.json declares a sidecar the manifest never staged.
- **Scoreboard STR truthiness:** pack leaves now route through `packStr()` (non-empty STRING or baked) — a schema-drifted nested value rendered `[object Object]`/threw in escapeHtml under bare `||`.
- **Missed consumer:** history screen's static 'Total Value' label (same `statLabels.totalValue` key, static/never-toggled behavior preserved).
- **Test-quality sweep:** displayDriver marker pin made mutation-proof (runtime config override — the default equals the old literal); strings schemaVersion refusal pinned BOTH directions; scoreboard STR baked fallbacks drift-pinned against the ALN sidecar + all four keys asserted + packless serve path pinned; scanner strings baked table drift-pinned; award-message template + ALN-verbatim drift pin.

**Verification (running record):** backend 2375 unit+contract + fresh ratchet + lint; scanner 1477 + ratchet (strings.js enters at 100/100/100) + L2 E2E 50 passed on rebuilt dist ×2; config-tool 95; flow-27 dual-pack ×2 (pre- and post-flip; ALN 6P + toy 6P each); scanner CI green (`f719b5a`, `ee9cd17` dispatched); parent CI green through `241995e` (the `927dc0c` red was a single `no-void` lint error — CI runs `eslint --quiet`, errors-only — fixed by giving the loaded sidecar a real consumer: the flow-27 pack-derived header assertion). **Close gate on the final heads (parent `c580345`, ALNScanner `ee9cd17`, TokenData `80a2c22`) — ALL GREEN:** backend 2375 unit+contract + fresh ratchet + lint (exit code read directly); integration 342 (36 suites, exit 0); dual-pack Tier L: **ALN 111P / 0F** (1 retry-passed flaky — flow 24 scoreboard-restart-recovery, re-run solo 2P/0-flaky: worker-contention timing, same class as the slice-2b one-off, not a strings regression) + **toy 113P / 0F / 0-flaky**; parent CI run 120 GREEN across all 8 jobs (both Tier L matrix legs); scanner CI run 85 GREEN. CI history note: runs 115/118 were slice-inflicted lint reds (`no-void` placeholder; raw U+2028/U+2029 in source read as line terminators) — both fixed same-day, and BOTH exposed the `| tail` exit-code-masking verification anti-pattern locally (now eliminated: lint/test exit codes read directly, the slice-1 lesson re-learned and re-pinned).
