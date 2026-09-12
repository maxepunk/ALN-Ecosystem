# Adversarial verification — five load-bearing claims behind the re-sequencing

Scope: `/home/user/ALN-Ecosystem` only, at working branch `claude/phase3-b0`
tip `9bc6493`. The frozen-production baseline is a real ref:
`origin/production-2026-07` == `origin/main` == `a4ebacd`
(`git ls-remote --heads origin`), so every "difference from production"
below is a diff, not a doc reading. Planning-doc assertions were treated
as hypotheses and re-checked against code.

---

## CLAIM 1 — "Run intake has no dependency on the Design-workspace pages."

**VERDICT: CONFIRMED (a) · CONFIRMED (b) · (c) answered — with one
unpriced dependency the claim's own framing hides (see §1d).**

### (a) The session-bundle schema reserves an intake namespace — CONFIRMED

`backend/contracts/session-bundle.schema.json:166-177`:

```json
"intake": {
  "description": "RESERVED for Phase-4 D report intake (ROADMAP §4: roster
   before the game; director notes and photos during; accusation and
   whiteboard at the end). Names only — every member deliberately validates
   as any type; D designs the shapes.",
  "type": "object", "additionalProperties": false,
  "properties": { "roster": true, "directorNotes": true, "photos": true,
                  "accusation": true, "whiteboard": true }
}
```

All five ROADMAP §4 intake artifacts are named; every member is schema
`true` (any type), so D can pick shapes without a schemaVersion bump —
the schema's own additive-evolution rule at `:5`. The reservation is
contract-tested: `backend/tests/contract/session-bundle.schema.test.js`
(24 pins; `:148` pins `kind`). Ratification trail:
`docs/plans/2026-09-03-phase3-a3-slice7-report-wording.md:175-178`.

### (b) Nothing in the intake surface requires the pages / draft store / publish pipeline — CONFIRMED

Four independent checks, all negative:

1. **No pack write.** Intake writes runtime session state, not pack
   content. The only pack-side artifact intake touches is the
   `functions.report-intake` grant declaration, and it is **already
   authored** in `ALN-TokenData/game.json:135-139`
   (`"report-intake": {"classes": ["staffed"]}`). No editor is needed to
   create it.
2. **The pages explicitly decline to own it.** The mechanics editor
   renders the `functions` block READ-ONLY v1 —
   `docs/plans/2026-09-04-phase3-design-workspace-pages.md:165-166`
   ("`functions` renders READ-ONLY v1 (the E4 grant model owns its
   future)"). So even the built pages would not be intake's authoring
   path.
3. **No draft-store / publish-pipeline seam.** `config-tool/lib/draftStore.js`,
   `config-tool/lib/publish.js` and `config-tool/lib/packFs.js` operate on
   pack files under a `sourceDir`; the DraftStore's file whitelist is
   pack content (`config-tool/lib/routes.js:163-183` — `/drafts/:id/files/:name`).
   Session state is never a draft object.
4. **No config-tool reference in the runtime path.** `grep` for
   `serviceHealth|healthy|dormant|preflight|resolution|packNeeds` across
   `config-tool/` (excluding `node_modules`) hits exactly one file,
   `config-tool/public/js/sections/packs.js`, and that file is a **PS.1
   mock** with hardcoded verdict rows (`:52` is a literal
   `{kind:'endpoint', id:'display.main', verdict:'dormant', …}` fixture,
   loaded through `config-tool/public/js/components/prototypeSwitcher.js`).
   The dependency arrow runs pages → engine, never engine → pages.

### (c) Intake's REAL dependencies (files it must touch)

**Backend — session model + validation**

| What | File:line | Why |
|---|---|---|
| Session field home | `backend/src/models/session.js:50-59` (metadata defaults), `:187-193` (`addPlayerScan` — the closest existing "append a captured artifact" precedent) | intake needs an `intake` container + append methods |
| Joi schema | `backend/src/utils/validators.js:78-101` (`sessionSchema`) | **must be amended**: `validate()` runs `stripUnknown: true` (`:213-221`), and `Session` does `Object.assign(this, data)` on the RAW data (`session.js:76`), so an undeclared `intake` field would ride on the instance but be silently dropped from every validated copy. `playerScans` is the existing instance of this hazard (present on the model, absent from the schema). |
| Persistence | `backend/src/services/sessionService.js`, `backend/src/services/persistenceService.js` | intake must survive restart like `playerScans` |
| Grant algebra | `backend/src/gameRules/grants.js:15-37` | `report-intake` is declared by the PACK but is **not** in `FLOOR_FUNCTIONS`, `CLASS_ASSIGNMENTS` or `TIER_CEILINGS` — an intake command is either ungated or needs the function added to the engine tables |
| Command floor | `backend/src/services/commandExecutor.js:131-146` (`requiredFloorFunction` refusal) + the `CUE_ACTIONS` auth-floor guard | new `intake:*` gm:command actions must be classified |
| Wire delivery | `backend/src/websocket/syncHelpers.js:130-151` (`buildSyncFullPayload` return block) + `backend/src/websocket/broadcasts.js` | intake must ride `sync:full` for restore |
| Completeness pin | `backend/tests/contract/websocket/sync-full-completeness.test.js` | the structural test that catches an omitted section |

**Contracts to amend (contract-first is mandatory here)**

- `backend/contracts/asyncapi.yaml` — `gm:command` action set + `sync:full` payload (`serviceHealth` block sits at `:655-672`, the sync:full neighbourhood)
- `backend/contracts/openapi.yaml` — `Session`/`GameState` schemas
- `backend/contracts/session-bundle.schema.json:166-177` — replace `true` members with real shapes (no version bump needed; additive)

**GM scanner (the capture surface)**

- `ALNScanner/src/app/domains/gameAdmin.js` — GameAdminDomain owns session lifecycle + report download; roster-before / accusation-at-end live here
- `ALNScanner/src/admin/SessionManager.js` — `session:create`/`session:start` are where a roster capture attaches
- `ALNScanner/src/core/sessionReportGenerator.js` — the current report consumer
- `ALNScanner/src/network/orchestratorClient.js:26-49` (`MESSAGE_TYPES`) — **any** new server→client intake broadcast must be added here or it silently never arrives
- `ALNScanner/index.html` + a new renderer under `ALNScanner/src/ui/renderers/`

**A dependency neither the claim nor the docs name: photo storage.**
`grep multer backend/src/routes/*.js` returns nothing — the backend has
**no binary upload path at all**. The only multer in the repo is
tool-side (`config-tool/lib/routes.js:3,251-275`, pack asset uploads),
which is exactly the surface intake must NOT depend on. One-tap photo
capture therefore needs a new engine-side media store + retention story
(ROADMAP §2.1.3-4 privacy defaults apply). This is real, unbuilt, and
absent from every intake estimate I can find.

### (d) Framing defect in the claim

"…written into the session **so the B9 session bundle carries it**"
assumes a bundle producer. There is none:
`backend/contracts/session-bundle.schema.json:5` — "**No Phase-3 emitter
exists; Phase-4 D intake is the first writer**"; and
`grep -rn "session-bundle" backend/src backend/scripts` returns **zero**
hits (only `backend/tests/contract/session-bundle.schema.test.js`).
ROADMAP §8.10 keeps the report pipeline on parsed markdown "owner-paced,
after Phase-4 D intake ships". So the intake unit as described is two
deliverables — capture→session AND the bundle emitter — not one.

---

## CLAIM 2 — "CS.2–CS.5 have no dependency on the Design-workspace pages."

**VERDICT: CONFIRMED, with one shared-surface caveat (§2c) that is an
ordering coupling, not a dependency.**

Ratified stage list read from
`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:380-400` (§8,
"Re-sequenced stages"). Note the doc's own order interleaves the pages
between CS.1 and CS.2 (`:389` — *"(Pages build PS.1–PS.6 runs next)"*),
so the question is whether CS.2–CS.5 *consume* anything the pages
produce. They do not.

### CS.2 — dormancy lifecycle + enum (doc `:392-395`)

Every named surface is engine or scanner:

| Deliverable | Surface | Evidence |
|---|---|---|
| Enum change `healthy\|down` → `healthy\|down\|dormant` | 3 contract sites + 1 validator | `backend/contracts/asyncapi.yaml:664` (sync:full serviceHealth), `asyncapi.yaml:2597` (`DomainStateHealth`, still carrying the never-emitted `degraded`), `backend/contracts/openapi.yaml:1998` (GameState), `backend/src/services/serviceHealthRegistry.js:42` (`if (status !== 'healthy' && status !== 'down')`) |
| Sticky dormant + both doors | `backend/src/services/serviceHealthRegistry.js` (`report()` `:42`, `reset()` `:149-157`) | engine |
| Session-start require gate + logged override | `backend/src/services/sessionService.js`, `backend/src/services/commandExecutor.js` | engine |
| Dormancy disable set | `backend/src/services/cueEngineService.js:61,167,192,223,229,505,848,867` + `backend/src/services/cue/standingEvaluator.js:150-192` (the existing `disabledCues` seam) | engine |
| GM render-safe dormant | `ALNScanner/src/ui/renderers/HealthRenderer.js:48,83,136` (three `=== 'healthy'` / `!== 'healthy'` sites) | scanner |
| E2E capability recompute | `backend/tests/e2e/helpers/capabilities.js:61` (`health[key]?.status === 'healthy'`) | test harness |
| CS.1 carry-overs (`disabledCueIds`, `video-file` need kind) | `backend/src/gameRules/resolution.js`, `backend/src/gameRules/packNeeds.js:22-104` | engine |

No config-tool file appears. Enum blast radius for pricing: **42 literal
`'healthy'`/`'down'` occurrences across 14 files** under `backend/src`
(`videoQueueService, commandExecutor, vlcMprisService, audioRoutingService,
gameClockService, systemReset, cueEngineService, lightingService,
soundService, musicService, bluetoothService, mprisPlayerBase,
serviceHealthRegistry, gameRules/resolution`), plus 3 scanner sites and 1
e2e-helper site.

### CS.3 — supervisor + fault verbs + self-heal (doc `:396-399`)

- Supervisor generalizes prior art already in-tree:
  `backend/src/utils/processMonitor.js` + `backend/src/services/vlcMprisService.js`
  (the 13-restarts-in-40s evidence is recorded at the c2c3 doc `:441-448`).
- Scanner pack self-heal has its anchor **today**, with no pages work:
  `backend/src/websocket/socketServer.js:46,123,135-140` captures the
  client `packHash` and warns on mismatch; the client half is
  `ALNScanner/src/network/orchestratorClient.js:101`
  (`packHash: packLoader.getActivePack()?.contentHash ?? null`).
- Hold policy: `backend/src/services/heldItemsStore.js:231` (`setAutoDiscard`),
  called only at `backend/src/services/cueEngineService.js:632` today.
- Fault-row verbs render in `ALNScanner/src/ui/renderers/HealthRenderer.js`
  and `HeldItemsRenderer.js`.

### CS.4 — preflight presentation (doc `:399-400`) and CS.5 — close

CS.4's owed faces are "GM panel + CLI twin". The GM panel is
`ALNScanner/src/admin/MonitoringDisplay.js`; the CLI is a
`backend/scripts/preflight.js` that does not exist yet (`ls backend/scripts`
confirms). CS.5 is the dual-pack Tier L + `rung1.yml` CI run. Neither
touches `config-tool/`.

### (c) The one honest caveat — a shared scanner surface, not a dependency

The ratification records a *composition*, not a prerequisite:
pages doc `:496-498` — "E10's client re-load composes with the
C2-ratified scanner SELF-HEAL (each orchestrator authoritative for its own
stations — no preview exemption machinery)". E10 step 4 (pages PS.2,
`:337-344`) and CS.3's self-heal both rewrite the same scanner pack-reload
path (`ALNScanner/src/core/packLoader.js`). Deferring the pages does not
break CS.3 — everything CS.3 needs is cited above — but whichever unit
lands second inherits an integration with the first. Two adjacent items
that reference the tool but are **outside** CS.2–CS.5 and should not be
confused with them: the C4 bindings page (c2c3 doc `:13-14`, "C4 (bindings
page) stays queued behind this unit's taxonomy") and the L8 ENDGAME
bluetooth literal, ruled to retire "during this build" i.e. the pages
build (pages doc `:485-487`; ledger row `docs/plans/PHASE3-STATUS.md:256`).
`ALN-TokenData/cues.json` still carries the literal today.

Also note R-C3-3's "restart strategies in **host config**" (c2c3 `:360-366`):
the config-tool's Venue side edits only `.env` (`config-tool/lib/envParser.js`)
and `backend/config/environment/routing.json`
(`config-tool/lib/configManager.js:35`). A new host-config file is a plain
file CS.3 can ship; a tool editor for it would be later, optional work.

---

## CLAIM 3 — "The new engine tree runs ALN's show equivalently to frozen production, so a cutover's run-value comes only from hardening/intake."

**VERDICT: REFUTED as stated.** The ALN-invariance pins are real but
cover a **narrow tier** (report bytes, money grammar, baked wording,
theme deep-equal). The GM- and audience-facing surface carries a
substantial *deliberate* delta, and there is **no golden master for the
GM scanner screens or the scoreboard's rendered output at all**. One of
the classes the prompt lists (session lifecycle setup→active) is not a
difference: it predates the pin.

### Sweep method (stated, per the completion criterion)

1. `git ls-remote --heads origin` → established `production-2026-07` ==
   `a4ebacd`; fetched it and used
   `git diff origin/production-2026-07...HEAD` as the primary instrument
   (parent `backend/src`, `backend/public`, `config-tool`; submodule
   pointer diffs then re-run inside `ALN-TokenData` `3e60fad..491c513`
   and `ALNScanner` `e38c1ea..deddaf9`).
2. Read every close record in `docs/plans/PHASE3-STATUS.md` (rows 26-42,
   the slice-4/6/7/theme/B0/CS.1 narrative blocks `:344-801`, the
   transitional-debt ledger `:247-262`, and the final-cutover
   enumeration `:964-1017`) to generate *candidate* differences.
3. Verified or refuted each candidate against code — never accepted a
   close record's "byte-identical" claim without reading the branch it
   depends on (this refuted three candidates: the phase label, the claim
   announcement, and the session lifecycle).
4. Targeted greps for the specific surfaces the prompt named
   (`awardMessage`, `adminPassword`, `phases`, `claims`, `allowNegative`,
   `observeToken`, fonts).

### (a) The ALN-invariance evidence — CONFIRMED, and narrow

| Pinned tier | Test file | What it pins |
|---|---|---|
| Session report, full | `ALNScanner/tests/contract/sessionReport.contract.test.js:288` | "GOLDEN MASTER: output matches the pinned contract string byte-for-byte" |
| Session report, sparse/empty | same file `:545,551` + fixtures `sparse-golden.md`, `empty-golden.md` | fallback wording byte-for-byte |
| Report retention of ALN wording | ledger L13, `docs/plans/PHASE3-STATUS.md:261` | `## Detective Evidence Log`, `Exposed By`, `Session Report` stay literal |
| Money grammar (backend) | `backend/tests/unit/gameRules/formatting.test.js:43-51` | "BYTE-IDENTITY with the legacy scanner expression under the ALN spec (incl. negatives)", `$-25,000` quirk pinned |
| Money grammar (scanner twin) | `ALNScanner/tests/unit/utils/formatCurrency.test.js:42` | same fixtures |
| Baked strings == ALN voice | `ALNScanner/tests/unit/core/strings.test.js:58-65` | LEGACY_ENTITY_LABEL / golden-coupled pins |
| Mode tables (both sides) | `backend/tests/unit/gameRules/modeSemantics.test.js`, `ALNScanner/tests/unit/core/modeSemantics.test.js` | baked table == real `game.json` modes (ledger L6 tripwire) |
| Theme | `ALNScanner/tests/unit/core/theme.test.js`, `ALNScanner/tests/unit/core/bundledThemeTripwire.test.js` | ALN `theme.json` one-deep-equal + bundled-submodule drift |
| Lighting roles == profile | `backend/tests/unit/services/lightingRoleTripwire.test.js` | `lightingRoleFallbacks` === profile `.ha` bindings |
| Scoreboard window marker | `backend/tests/unit/utils/scoreboardWindowMarker.test.js` | the xdotool-searched marker matches the served `<title>` |
| Award message | `backend/tests/unit/websocket/scanResponse.test.js` | drift-pins the ALN sidecar wording |

**What is NOT pinned anywhere:** the GM scanner's rendered screens and
the scoreboard's rendered visual output. `grep -rl "byte-identical|
byte-for-byte|golden"` across `backend/tests ALNScanner/tests
config-tool/tests` returns 24 files, none of which is a screen snapshot.

### (b) User-visible run differences, production-2026-07 → tip

**Class A — GM scanner wording/identity (deliberate, ruled)**

1. **Team → Account, everywhere.** `ALN-TokenData/game.json:92-97`
   declares `entities.label {singular:"Account", plural:"Accounts"}`;
   applied at `ALNScanner/src/app/initializationSteps.js:206-231` —
   rewrites `teamEntryTitle` ("Select Account"), `currentTeamNoun`,
   `uniqueTeamsLabel`, `scoreboardSubtitle` ("Account Rankings"),
   `adminScoreboardTitle` ("Account Scores"), `teamDetailsTitle`, the
   `teamNameInput` placeholder, every `app.finishTeam` button label, and
   the CSS-rendered empty-team-list string
   (`ALNScanner/src/styles/screens/scanner.css:645-648`). Production had
   these as static text (`ALNScanner/index.html` diff at
   `e38c1ea..deddaf9`, lines 158, 183, 245, 272, 534).
2. **Award toast reworded.** Production:
   `` `Token scanned successfully. ${transaction.points} points awarded.` ``
   (`origin/production-2026-07:backend/src/websocket/scanResponse.js:18`).
   Tip: `ALN-TokenData/strings.json` `scoring.awardMessage` =
   `"Token scanned successfully. {pointsFormatted} awarded."` rendered
   through `backend/src/websocket/scanResponse.js:26-42` → **"$150,000
   awarded."** The word "points" is gone from the ALN scan response.
3. **New header chrome.** `ALNScanner/index.html` gains
   `#modeSelector` (a segmented per-pack mode control alongside the
   existing pill) and a pack-identity line
   `Pack: <version> (<hash>) · <source>` with a `⚠ bundled` badge
   (`index.html` diff hunks at `:68-79`; rendered by
   `ALNScanner/src/app/initializationSteps.js:239+ renderPackInfo`).
4. **Star ratings dropped from three GM sites.** `ALN-TokenData/theme.json`
   = `{"rating": {"display": "none"}}`; consumed at
   `ALNScanner/src/ui/uiManager.js:484-489` (the detective result screen
   **hides the whole Value Rating row, label included**),
   `ALNScanner/src/ui/renderers/GameOpsRenderer.js:465-466` (Base Rating
   field omitted) and `:494-496` (activity-card rating line omitted).
5. **Semantic mode colours re-keyed.**
   `ALNScanner/src/styles/variables.css:31-39` replaces
   `--color-mode-detective/--color-mode-blackmarket` with
   `--color-mode-scoring/--color-mode-evidence` +
   `--color-accent-value`; `scanner.css:198-205` deletes the per-mode
   transaction-card border rules. Close record claims ALN
   byte-visual-identical (`PHASE3-STATUS.md:39`); the deleted
   `.transaction-card.detective/.blackmarket` border rules are the one
   place I could not confirm a replacement renders the same accent.

**Class B — show-control content the GM operates by name**

6. **Five ALN spine cues renamed.** Production
   `backend/config/environment/cues.json` carried
   `cue-1772422843217`, `…894866`, `…917681`, `…984913`, `…423004537`;
   the tip's `ALN-TokenData/cues.json` carries `warning-90min`,
   `warning-60min`, `warning-30min`, `warning-15min`, `endgame`. These
   are the ids/labels the GM sees and fires in the Quick Fire grid.
7. **Cue lighting is role-indirect.** Cues now name roles resolved
   through `backend/config/profiles/aln-full-kit.json:11-19`; the venue
   `config/environment/cues.json` was deleted. Behaviour is preserved
   *only because the profile is fully bound* — a missing/renamed profile
   degrades loudly instead of firing (ledger L7,
   `docs/plans/PHASE3-STATUS.md:255`).

**Class C — scoring/adjustment behaviour**

8. **Negative team scores are now legal and rendered.** Production pinned
   `currentScore: Joi.number().integer().min(0).required()`
   (`origin/production-2026-07:backend/src/utils/validators.js:105`); the
   tip drops the floor (`backend/src/utils/validators.js:140`) and gates
   on the pack — `ALN-TokenData/game.json:71-73`
   `scoring.semantics.allowNegative: true`, enforced at
   `backend/src/services/transactionService.js:125-128` and `:847`.
   A GM `score:adjust` past zero now succeeds and displays negative.
9. **Two standalone score bugs fixed** (adjustment wiped by the next
   scan's invariant recompute; rebuild dropping `adminAdjustments`) —
   `docs/plans/PHASE3-STATUS.md:35` (D2s2 closer), scanner side
   `ALNScanner/src/core/storage/LocalStorage.js`.

**Class D — wall scoreboard (the classes the prompt named, confirmed)**

10. **Fonts self-hosted → the venue's scoreboard actually changes
    appearance.** `backend/public/scoreboard.html` drops the
    `fonts.googleapis.com` stylesheet + both preconnects for
    `<link href="/fonts/fonts.css">`, with 16 woff2 files added under
    `backend/public/fonts/`. The in-file comment is explicit: *"the CDN
    links silently failed at the offline-LAN venue, so the intended
    faces never rendered where it matters"*. Production rendered
    fallback stacks; the tip renders IBM Plex Mono / Libre Baskerville /
    Special Elite. `--font-display` (Playfair Display) was deleted as a
    dead token. Ledger L11, `docs/plans/PHASE3-STATUS.md:259`.
11. **Observe token replaces the embedded admin password, and renewal is
    a page reload.** Production had `adminPassword: '@LN-c0nn3ct'` in the
    page and did a `POST /api/admin/auth` round trip; the tip injects
    `observeToken: '%%OBSERVE_TOKEN%%'` per serve
    (`backend/src/routes/resourceRoutes.js` `renderScoreboardHtml`) and
    renews by RELOAD — "retires the 24h/restart blank-TV residual"
    (`docs/plans/PHASE3-STATUS.md:651-653`).
12. **The scoreboard no longer consumes a GM-station slot or shows as a
    device.** `backend/src/websocket/gmAuth.js:50-130` — display-class
    sockets (`socket.tier === 'device'`) skip `DeviceConnection`
    creation, `canAcceptGmStation()` and `sessionService.updateDevice()`.
    The GM's device list / count changes.
13. **Kiosk window title changed** to
    `Case File: About Last Night — %%WINDOW_MARKER%%` (functional: the
    `xdotool` search key).
14. **Evidence page cadence is now pack-driven.**
    `ALN-TokenData/game.json:174-179` `surfaces.scoreboard.evidenceCycleMs: 18000`
    reproduces production's 18s/12s two-tier exactly — no visible change,
    but the value now travels with the pack.

**Class E — preflight/doc truthfulness (the prompt's fifth class)**

15. The ducking-engine regression introduced post-S4 was found and fixed
    (`docs/plans/PHASE3-STATUS.md:505-524`); the close gate now runs
    `npm run lint`. Frozen production predates S4 and is unaffected —
    so this is a *tree* fix, not a production→tip difference.
16. Preflight §4.4/§13.3 were rewritten pack-aware; the slice-4 S4 cue
    checks were rewritten. See CLAIM 5 for the parts that went stale.

**Candidates I REFUTED (do not belong on the list)**

- **Session lifecycle `setup`→`active` is NOT a difference.** It already
  exists in the pin: `origin/production-2026-07:backend/src/services/commandExecutor.js:148`
  (`case 'session:start'`), `…/sessionService.js:167,189,216,374`,
  `…/utils/validators.js:60` (`valid('setup','active','paused','ended')`).
- **Game-clock phase label does not appear for ALN.** ALN declares one
  phase (`game.json:141-152`) and
  `backend/src/services/gameClockService.js:117-119` nulls the table
  below 2 entries, so `ALNScanner/src/ui/renderers/SessionRenderer.js:184-193`
  keeps `#game-clock-phase` hidden.
- **Game-activity claim announcements are byte-identical.** Production
  `GameOpsRenderer.js:464-470` hardcoded `💰 SOLD to X` / `🔍 EXPOSED by X`;
  `ALN-TokenData/game.json:33-34,47-48` declares exactly those templates
  and icons.
- **Duplicate detection is unchanged for ALN.** The new per-mode `claims`
  flag (`backend/src/gameRules/duplicatePolicy.js:35-38,86-91`) defaults
  to consuming, and neither ALN mode declares `claims`.
- **Report output is unchanged** for normal session names (goldens above;
  the new `_cell()` sanitizer only alters names containing `|` or
  control characters).

### Conclusion on claim 3

The engine *logic* invariance is well-evidenced. The **run** is not
equivalent: an operator walking up to the cutover machine meets a
different vocabulary ("Account"), a different scan toast, no star
ratings, a new mode selector and pack line, renamed cues, a
differently-typeset wall display, and a scoring rule that now permits
negatives. All of it is ruled and intentional — but it means a cutover
carries GM-retraining and visual-regression risk that "run-value comes
only from the hardening/intake work" does not budget for.

---

## CLAIM 4 — "A scanner state-truth sweep is a bounded unit."

**VERDICT: CONFIRMED — bounded, enumerable, and small. Checklist and
counts below; the honest price is dominated by the five adapter/guard
classes, not by the domain count.**

### Leg 1 — producer side: `backend/src/websocket/broadcasts.js`

`pushServiceState(domain, service)` at `:487-493` (50ms per-domain
debounce); `pushHeldState()` at `:589-593` (undebounced).
**10 domains, 55 producer wiring edges:**

| Domain | Edges | Source events (file:line) |
|---|---|---|
| `music` | 6 | `:496-508` — playback/volume/track/position/playlist:changed, playlists:reloaded (uses `buildMusicState`, **not** raw `getState()` — the playlists array) |
| `video` | 13 | `:512` vlc `state:changed`; `:514-520` 6 lifecycle; `:523-529` `video:failed` (**bypasses the debounce**); `:530-533` 5 queue events |
| `health` | 1 | `:536-538` `health:changed` |
| `bluetooth` | 7 | `:541-546` |
| `audio` | 6 | `:548-553` (incl. `ducking:changed`) |
| `lighting` | 2 | `:555-560` |
| `sound` | 4 | `:562-567` |
| `gameclock` | 5 | `:569-576` (incl. `phase:changed`; deliberately never pushed on tick) |
| `cueengine` | 4 | `:578-585` |
| `held` | 7 | `:594-600` (3 cue + 4 video) |

### Leg 2 — transport + restore

- Incremental: `ALNScanner/src/network/messageRouters.js:170-175`
  (`service:state` → `store.update(domain, state)` — **shallow merge**).
- Bulk restore: `messageRouters.js:125-137` — **10 `store.replace()`
  calls, each behind an `if (payload.X)` truthiness guard**. Key-name
  mapping is non-uniform and is a real drift risk: `serviceHealth`→`health`,
  `environment.bluetooth/audio/lighting`→3 domains, `gameClock`→`gameclock`,
  `cueEngine`→`cueengine`, `heldItems`→`held` (re-wrapped as `{items}`),
  `videoStatus`→`video`.
- Producer of that payload: `backend/src/websocket/syncHelpers.js:130-151`.
- Existing pin: `backend/tests/contract/websocket/sync-full-completeness.test.js`.

### Leg 3 — consumer side: `ALNScanner/src/admin/MonitoringDisplay.js`

**10 store subscriptions**, wired at `:52-65` through four domain
groupers, at `:88, 98, 113, 119, 141, 146, 159, 164, 176, 183`.
`StateStore` API: `ALNScanner/src/core/stateStore.js:18` (`update`),
`:50` (`replace`), `:87/:92` (`on`/`off`).

**Renderers on the store path — 7 classes + 1 inline handler** (of 10
files in `ALNScanner/src/ui/renderers/`):

| Domain | Renderer | Adapter risk to audit |
|---|---|---|
| `cueengine` | `CueRenderer` | `:88-96` arrays → `Map`/`Set` rebuild each push |
| `held` | `HeldItemsRenderer` | `:98-100` `renderSnapshot(state?.items \|\| [])` |
| `video` | `VideoRenderer` | `:104-116` **`mapVideoState` reshapes 6 fields**; anything the backend adds is invisible |
| `sound` | *(none — inline `innerHTML` at `:119-131`)* | the one domain with no renderer class |
| `lighting` | `EnvironmentRenderer.renderLighting` | `:141-143` |
| `audio` | `EnvironmentRenderer.renderAudio` **+ fan-out** | `:146-157` also derives ducking and calls `MusicRenderer.renderDucking` — a **cross-domain** edge |
| `bluetooth` | `EnvironmentRenderer.renderBluetooth` | `:159-162` |
| `music` | `MusicRenderer` | `:164-166` |
| `health` | `HealthRenderer` | `:176-179`; 3 binary `'healthy'` sites at `HealthRenderer.js:48,83,136` |
| `gameclock` | `SessionRenderer.renderGameClock` | `:183-190` — the adapter **"STRIPS unknown fields by design"** (its own comment); a new clock field surfaces nowhere until named here |

Off-store renderers (a different truth path, must be scoped OUT or the
unit is unbounded): `GameOpsRenderer`, `GameAdminRenderer`,
`EvidencePickerRenderer`.

### Leg 4 — the second (non-StateStore) state path

`ALNScanner/src/core/unifiedDataManager.js:154-173` forwards **8**
strategy events; `ALNScanner/src/main.js:131-177` registers **7**
listeners. **`session:updated` is forwarded and has no `main.js`
consumer** — an already-present asymmetry the sweep should adjudicate.
Wire ingress list: `ALNScanner/src/network/orchestratorClient.js:26-49`
— **22 `MESSAGE_TYPES`**; an event absent from this array silently never
arrives (documented gotcha, `ALNScanner/CLAUDE.md`).

### Leg 5 — known desync classes already in the record

1. **mpd2 idle-FIFO desync.** `backend/src/services/musicService.js:66`,
   `:238`, `:263-274`, `:485` — a single positional FIFO shared by
   commands and idle events; a desynced client never rejects, it hangs.
   Mitigation is `_refreshAfterCommand()` + `withTimeout` (3000ms). The
   comment names the symptom exactly: *"every GM panel freezes until a
   manual sync:full"*.
2. **Audio-routing display fragility.**
   `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:47,228,246,250,267`
   — `_volumeValues` is a client-side cache of last-known slider values
   that must survive dropdown rebuilds (BT reconnect); it is the
   renderer's own truth, not the backend's.
3. **MPD `setvol` while stopped fails** ("All outputs are disabled") —
   a live GM-panel edge found by the CS.1 audit,
   `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:491-494`.
4. **`sync:full` omission class, 4 recurrences** (`scores:reset`,
   `offline:queue:processed`, `integration-test-server.js`,
   `soundService`) — `backend/CLAUDE.md` "CRITICAL sync:full
   Completeness"; 7 caller sites.
5. **Health binary vs the incoming `dormant` value** — CS.2 changes the
   enum under this sweep; sequencing the two matters.

### Priceable checklist (what a sweep must cover)

- 10 domains × {producer edges, `getState()` shape, sync:full key,
  `store.replace` guard, subscription, adapter, renderer} = **70 cells**
- 55 producer wiring edges to confirm each fires the right domain
- 10 truthiness guards in `messageRouters.js:125-137` (a falsy section
  leaves stale store state)
- 5 reshaping adapters (`mapVideoState`, gameclock strip, cueengine
  Map/Set, held unwrap, audio→music ducking fan-out)
- 1 domain with no renderer class (`sound`)
- 8 forwarded DataManager events vs 7 consumers
- 22 `MESSAGE_TYPES` cross-checked against the AsyncAPI subscribe set
- 5 recorded desync classes to re-test rather than re-derive

That is a bounded unit. The count that should drive the estimate is the
**5 adapters + 10 guards**, not the 10 domains.

---

## CLAIM 5 — "Stage B (green-Pi hardware validation) is executable from the deployment docs today."

**VERDICT: REFUTED.** `DEPLOYMENT_GUIDE.md` (1,294 lines) covers most of
the ROADMAP §3b machine-state list, but it has **one total gap (Home
Assistant), two structural gaps (media transfer, installation profile),
one self-contradiction, and three actively-wrong sections** that would
send an owner down dead ends. ROADMAP §3b itself says "The deployment
guide owns the authoritative checklist; gaps found at Stage B are doc
defects" — these are those defects, findable now.

### ROADMAP §3b machine-state list, item by item

| §3b item | Covered? | Evidence |
|---|---|---|
| **OS** | PARTIAL | `DEPLOYMENT_GUIDE.md:703-721` "Prepare Raspberry Pi" is `apt update` + deps + PM2 + clone. No imaging/flash step, no Pi-5 config (`gpu_mem`, HEVC, `--vout=gles2` live only in `backend/CLAUDE.md`), no user creation beyond the security note at `:1160-1171`. |
| **PM2** | YES | `:58`, `:713`, `:584-612` (incl. `pm2 save` + `pm2 startup`), `:1183` |
| **WirePlumber drop-in** | YES | `:765-790` — full heredoc + `systemctl --user restart wireplumber`; canonical copy at `docs/wireplumber/51-aln-vlc-no-restore.lua` |
| **SSL certificates** | PARTIAL | `:318-346` self-signed openssl recipe + `:347-362` env + `:379-394` trust workflow. **Spike S2 (Cloudflare DNS-01), which ROADMAP §3b says "runs during this setup", has zero coverage** (`grep -i "cloudflare\|dns-01\|acme\|certbot"` → 0 hits). |
| **`.env`** | PARTIAL | `:119-160` shows a 12-key block; the real template `backend/.env.example` has **153 lines / ~40 keys**, including `HOME_ASSISTANT_URL/TOKEN`, `LIGHTING_ENABLED`, `HA_DOCKER_MANAGE`, `HA_DOCKER_CONTAINER`, `BLUETOOTH_*`, `AUDIO_DEFAULT_OUTPUT`, `ENABLE_MUSIC_PLAYBACK` — none of which appear in the guide's block. Also missing entirely from both: `PACK_PATH`, `PROFILE_PATH`, `SCOREBOARD_WINDOW_MARKER`, `IDLE_LOOP_FILE`, `CHROMIUM_BIN`. |
| **Home Assistant Docker volume (`scene.*` lives only there)** | **NO — total gap** | `grep -i "home assistant\|homeassistant\|docker"` over `DEPLOYMENT_GUIDE.md` → **0 hits**. The preflight checklist concedes it: `docs/preflight-checklist.md:1350` — *"Home Assistant needs to be installed and configured separately."* Preflight only **verifies** (`:1324-1378`, `:1408-1427`); nothing **installs**. Seven `scene.*` ids are load-bearing (`backend/config/profiles/aln-full-kit.json:11-19`, `ALN-TokenData/game.json:161-170`) and exist in no repository. |
| **Git-excluded media (videos, music, audio)** | PARTIAL | `.gitignore:10` excludes `backend/public/videos/*.mp4`, `:17,19` `public/music/*.mp3|wav`. Guide `:499-537` says "add .mp4 to `backend/public/videos/`" and `:66-75,1123-1129` documents `npm run music:seed` — but there is **no bulk transfer/inventory/verification procedure for moving a show's media to a new machine**, which is exactly what a green Pi needs. **`idle-loop.mp4` is never mentioned** in the guide (`grep -i "idle-loop\|idle loop"` → 0 hits) even though `backend/src/config/index.js:115` defaults to it and `backend/config/profiles/aln-full-kit.json:20-22` binds `aln-idle` to it. |

### Gaps beyond the §3b list

- **Installation profile — undocumented.** `PROFILE_PATH` /
  `backend/config/profiles/aln-full-kit.json` appear nowhere in the
  guide. On the tip, this file is what binds every lighting role and the
  idle-loop channel; a green Pi with a missing/renamed profile degrades
  loudly (ledger L7/L12) with no doc telling the owner why.
- **Bluetooth self-contradiction.** `DEPLOYMENT_GUIDE.md:1140-1142`
  ("Performance Optimization → For Raspberry Pi") instructs
  `sudo systemctl disable bluetooth` — in the same guide as a system
  whose GM panel pairs and routes to a BT speaker
  (`backend/src/services/bluetoothService.js`, preflight §7.6-7.7 at
  `docs/preflight-checklist.md:691-736`). An owner following the guide
  literally disables a Stage-B acceptance target.

### Actively-wrong sections on the current tree

- **`:916-935` "Authentication Details"** instructs the owner to edit
  `const CONFIG = { adminPassword: '@LN-c0nn3ct', … }` in
  `backend/public/scoreboard.html`. That line **no longer exists** — B0
  replaced it with a serve-time `observeToken: '%%OBSERVE_TOKEN%%'`
  (diff of `backend/public/scoreboard.html`, prod→tip).
- **`:944-950` troubleshooting** runs
  `grep adminPassword backend/public/scoreboard.html` — returns nothing;
  the owner would conclude the install is broken.
- **`:1154`** repeats "update `scoreboard.html` to match".
- **`docs/preflight-checklist.md:1379` "12.3 spotifyd Running — REQUIRED"**
  — spotifyd is not part of the system; music is MPD spawned by
  `backend/src/services/musicService.js`.

### Verdict

Stage B is executable **for the host fundamentals** (OS deps, PM2, VLC,
WirePlumber, self-signed SSL, ports, submodules) — roughly the
`docs/preflight-checklist.md` §1-§11 territory. It is **not executable
end-to-end**: an owner following the docs exactly gets no Home Assistant
(so no lighting scenes — one of the six things ROADMAP §3b says Stage B
exists to validate), no S2 certificate path, no installation profile, no
idle loop, no media, and three sections that instruct edits to code that
no longer exists. The pre-work is a bounded doc unit: **1 install
procedure to write (HA + volume + the 7 scenes), 1 media-transfer
procedure, 1 profile section, ~28 `.env` keys to reconcile, 4 stale
sections to fix, 1 contradiction to remove** — and it should land before
green is built, not be discovered on the bench.

---

## Counts and the single most planning-relevant surprise

**Counts**

| Thing | Count | Anchor |
|---|---|---|
| Intake namespace members reserved | 5 | `session-bundle.schema.json:171-175` |
| B9 bundle emitters in the engine | **0** | `grep -rn "session-bundle" backend/src backend/scripts` |
| Intake dependency files named (backend / contracts / scanner) | 7 / 3 / 5 | §1c |
| Config-tool files reachable from CS.2–CS.5 | **0** | §2 |
| Health-enum contract sites + validator | 3 + 1 | asyncapi `:664`, `:2597`; openapi `:1998`; registry `:42` |
| Backend files carrying `'healthy'`/`'down'` literals | 14 files / 42 occurrences | §2 |
| GM/audience-visible prod→tip differences enumerated | **16** (5 classes) | §3b |
| Prod→tip difference candidates refuted | 5 | §3b |
| Golden-master/byte-pin test files | 11 tiers | §3a |
| Screen-level golden masters (GM scanner or scoreboard) | **0** | §3a |
| `service:state` domains / producer wiring edges | 10 / 55 | `broadcasts.js:487-600` |
| StateStore subscriptions / reshaping adapters / sync:full guards | 10 / 5 / 10 | `MonitoringDisplay.js`, `messageRouters.js:125-137` |
| `MESSAGE_TYPES` ingress list | 22 | `orchestratorClient.js:26-49` |
| ROADMAP §3b machine-state items fully covered by the deployment docs | **2 of 7** (PM2, WirePlumber) | §5 |
| Deployment/preflight sections actively wrong on the tip | 4 | §5 |

**The single most planning-relevant surprise**

**Intake's stated destination has no producer, and the re-sequencing is
priced as if it did.** The claim under test is "captured on the GM
scanner, written into the session *so the B9 session bundle carries it*."
The bundle schema is real and contract-tested — but
`backend/contracts/session-bundle.schema.json:5` states outright "**No
Phase-3 emitter exists**", and a grep over `backend/src` and
`backend/scripts` finds **zero** references to it. Meanwhile ROADMAP
§8.10 keeps the actual report pipeline on parsed markdown, "owner-paced,
after Phase-4 D intake ships", pinned byte-for-byte by
`ALNScanner/tests/contract/sessionReport.contract.test.js:288`.

So moving intake earlier does not buy one unit. It buys three, in this
order: (1) capture UI + session fields + contracts (§1c), (2) the bundle
emitter nobody owns in any phase document, and (3) a photo/binary store
the engine has never had — `grep multer backend/src/routes/*.js` returns
nothing; the only upload path in the repo is the config-tool's, which is
precisely the surface intake is supposed to be independent of. Until (2)
and (3) are priced, "run intake" is a name for an unbounded unit wearing
a bounded one's estimate — and that, not a pages dependency, is what
should decide whether it moves forward in the sequence.

Runner-up, from claim 3: the ALN-invariance evidence is genuine but pins
only the *report bytes, money grammar, baked wording and theme
deep-equal*. There is no golden master for a single GM screen or for the
wall scoreboard's rendered output — which is exactly where the 16
confirmed user-visible differences live.
