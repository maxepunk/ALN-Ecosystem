# Platform Review & Refactor Workflow

**Date:** 2026-06-09
**Status:** Proposed
**Goals:**
1. **Quality** — ensure code across all repos is top-notch, maintainable, and easy to develop further.
2. **Platform** — evolve the single-game ALN system into an engine that can run *different games* (varied mechanics, content, theming) without forking the codebase per game.

This document is the workflow design. Findings below come from a full-codebase
survey (backend + all 3 scanners + config-tool + sync scripts) conducted on the
date above.

---

## Part 1: Where We Are (Survey Findings)

### Engine/content separation today: ~35% data-driven

**Already externalized (keep building on these seams):**
| Concern | Location | Notes |
|---------|----------|-------|
| Scoring values | `ALN-TokenData/scoring-config.json` | baseValues + typeMultipliers, loaded by backend + GM Scanner + sync |
| Cue definitions | `backend/config/environment/cues.json` | Engine is generic; cues are data |
| Audio routing/ducking rules | `backend/config/environment/routing.json` | Stream *names* still hardcoded in engine |
| Music playlists | `backend/config/music-playlists.json` | Hot-reloaded |
| Lighting scenes | Home Assistant (runtime fetch) | Nothing game-specific in code |
| Token content | `ALN-TokenData/tokens.json` via Notion sync | Schema assumptions scattered, but data itself is external |

**Hardcoded game-specific logic (the refactor targets):**
| # | Concern | Locations | Severity |
|---|---------|-----------|----------|
| 1 | Group completion bonus — duplicated implementation | `backend/src/services/transactionService.js:370-393` AND `ALNScanner/src/core/storage/LocalStorage.js:345-386` | 🔴 Worst offender: same rules, two codebases |
| 2 | Transaction modes (detective = 0 points branch) | `transactionService.js:203-217` + scanner `LocalStorage.js:207-217` | 🔴 New modes require code changes in 2 places |
| 3 | Device-type duplicate rules (gm/player/esp32) | `transactionService.js:258-326`, enum at `models/transaction.js:146` | 🟡 ~50 lines of branching; could be config |
| 4 | Notion coupling | `scripts/sync_notion_to_tokens.py` — DB UUIDs hardcoded (lines 43-44), field names as string literals, rigid regexes | 🔴 New game = new Notion schema = script rewrite |
| 5 | UI copy & branding | `backend/public/scoreboard.html`, `ALNScanner/index.html` (titles, "Detective Mode", "Black Market Scoreboard", evidence-red CSS) | 🔴 No strings file; scattered inline |
| 6 | Memory type enum | `scoring-config.json` (good) but fallback duplicated in `backend/src/config/index.js:23`; validator accepts ANY string (silent 0x multiplier) | 🟡 |
| 7 | Cue condition operators, stream/sink names | `cueEngineService.js`, `audioRoutingService.js` | 🟡 Engine-level, lower priority |
| 8 | Token schema | No JSON Schema file; validation scattered across backend validators, scanner parsing, sync script | 🟡 |

### External dependency: GenAI post-game report pipeline

**Not visible from this codebase** (owner disclosure, 2026-06-09): the
post-game session report feeds a GenAI pipeline in
`github.com/maxepunk/aboutlastnight` (the `reports/` directory) that
generates a bespoke fictional news article narrating the game's events.
Surveyed 2026-06-09 (public repo; LangGraph + Claude SDK, 43 nodes, 10 human
checkpoints, Express console).

**The effective input contract** (what the pipeline's `parseRawInput` /
`SESSION_REPORT_SCHEMA` actually consumes from this ecosystem):

| Input | Source in ALN-Ecosystem | What the pipeline parses |
|-------|------------------------|--------------------------|
| `sessionReport` (markdown) | `ALNScanner/src/core/sessionReportGenerator.js` output | **"Detective Evidence Log" table** (exposed token IDs, leftmost column); **"Scoring Timeline" table** (`Time \| Type \| Detail \| Team \| Amount`; only `Type=Sale` rows; `Detail` = `tokenId/CharacterName`); **"Final Standings/Totals"** (shell-account name, total, rank, token count) |
| Token content + paper evidence | **Notion, fetched directly** by the pipeline | Full memory content, owner→character mapping |
| `roster`, `accusation`, `directorNotes`, photos, whiteboard | Manual GM input at pipeline runtime | Not this repo's concern |

Implications:

1. **The session-report markdown is an external contract** — specifically the
   three table structures above (section titles, column order, the
   `tokenId/CharacterName` Detail format, `Type=Sale` row semantics).
   Renaming a column heading in `sessionReportGenerator.js` breaks the
   pipeline silently. Action (Phase 2): document this as a versioned schema
   in this repo + add a contract test snapshotting the table structures.
2. **Notion is dual-consumed.** The reports pipeline fetches token content
   from Notion independently of `sync_notion_to_tokens.py`. The future
   in-house content DB (Phase 5) therefore has TWO consumers to serve, and
   the source-adapter design (Phase 3.2e) should account for the reports
   pipeline as a second client of the content source.
3. **For the platform goal**, the pipeline mirrors this repo's situation: a
   reusable engine (LangGraph workflow, evidence layers, theming system with
   journalist/detective themes already separated) wrapped in ALN-specific
   content (Nova/Marcus/NPC framing, prompts, shell-account economy). A new
   game's narrative output = a new theme + prompt pack there, plus whatever
   session-report sections its mechanics produce here. The game.json / pack
   design (Phase 3) should reserve a slot for narrative-pipeline config.

### Quality infrastructure: strong tests, weak lint enforcement, several God files

**Strong:** Backend 4-layer test strategy (154 test files, per-file coverage
ratchet with 332 entries, CI-gated). ALNScanner 71 test files + ratchet (252
entries). Contracts comprehensive (OpenAPI 1879L, AsyncAPI 2379L). Deps
current. Zero TODO/FIXME markers. Active conventional-commit history.

**Gaps:**
| Gap | Detail |
|-----|--------|
| Lint not in CI | Backend has ESLint+Prettier but no CI job runs them |
| No lint config at all | ALNScanner, aln-memory-scanner, config-tool |
| God files (backend) | `audioRoutingService.js` 1394L, `cueEngineService.js` 1169L, `videoQueueService.js` 977L, `transactionService.js` 972L |
| God files (GM Scanner) | `app/app.js` 1672L, `ui/uiManager.js` 1132L |
| Player scanner architecture | `aln-memory-scanner/index.html` 846L inline script — no modules, 2 test files, no coverage ratchet |
| config-tool rigor | 3 test files, no lint, no coverage thresholds |
| No pre-commit hooks | Developer discipline only |
| No root README / system architecture doc | CLAUDE.md files are good but agent-oriented |

---

## Part 2: Strategic Decisions (Recommendations)

### D1. Platform = single engine + game definition packs. NOT a fork.
A fork means every bug fixed twice, forever. Instead: one engine, and each game
is a **game pack** — a directory/submodule of pure data:

```
game-pack/
├── game.json            # mechanics: modes, scoring rules, device rules,
│                        #   group-completion rules, duplicate policies
├── strings.json         # all UI copy, titles, mode names, theming tokens
├── theme.css            # colors/branding (evidence-red → whatever)
├── tokens.json          # token content (today's ALN-TokenData)
├── scoring-config.json  # already exists
├── cues.json            # show control (already data-driven)
├── playlists.json       # music
└── assets/              # images, audio, video
```

ALN becomes *game pack #1*, proving the engine by construction. The existing
`ALN-TokenData` submodule pattern already shows how packs distribute to
scanners.

### D2. Review first, but scope refactors to serve the platform goal.
Don't refactor twice. Example: splitting `transactionService.js` (a quality
finding) should extract a **rules module** whose interface *is* the
engine/game seam (a platform requirement). Every Phase-2 refactor must answer
"does this move us toward the seam or just shuffle code?"

### D3. Fix the duplicated scoring/group logic first.
It's simultaneously the worst quality defect (parity drift risk between
networked and standalone modes — already flagged in `docs/SCORING_LOGIC.md`)
and the heart of the engine/game seam. A shared rules module (distributed the
same way `scoring-config.json` already is, via the ALN-TokenData submodule or
a new shared-logic location) kills both birds.

### D4. Contract-first applies to the game pack too.
This repo already has a contract-first culture (OpenAPI/AsyncAPI). The game
pack gets the same treatment: **write the `game.json` JSON Schema before
migrating any code to read it.** Same for a tokens.json schema (currently
nonexistent — validation is scattered and permissive).

---

## Part 3: The Workflow (Phases)

Each phase = one or more PRs on feature branches, gated by the existing
coverage ratchet + `verify-merge-ready.sh`. Review reports and design docs are
committed to `docs/reviews/` and `docs/proposals/` so findings survive between
sessions.

### Phase 0 — Guardrails (≈1 session, do before anything else)
Cheap insurance that makes every later phase safer:
1. Record a green baseline (run all suites per Verification Checkpoints).
2. Add ESLint + Prettier to ALNScanner, aln-memory-scanner, config-tool
   (start permissive — match existing style, don't reformat the world).
3. Add a lint job to `.github/workflows/test.yml` (parent + ALNScanner CI).
4. Add coverage ratchet to aln-memory-scanner and config-tool (even with low
   thresholds — the ratchet only prevents *regression*).
5. Optional: Husky + lint-staged pre-commit.

**Exit criteria:** CI fails on lint violations; all components have a ratchet.

### Phase 1 — Structured quality review (≈3-4 sessions, parallelizable)
Component-by-component review with a fixed rubric, executed by parallel
review agents, consolidated into `docs/reviews/2026-06-platform-review/`.

**Phase 1.0 — Known-issues intake (FIRST, requires owner).**
Owner clarification (2026-06-09): most "works but feels broken" defects are
*objectively findable by good code review* — they are wiring defects, not
vague UX feel. Known defect classes to hunt for explicitly:
- Frontend inputs that don't actually communicate with the backend
  (handler fires but command never sent, or sent malformed)
- Interface not updating when backend state changes (broadcast emitted but
  no UI subscriber, or subscriber updates the wrong element)
- **Missing UI controls** relative to what a standard interface for the task
  would have (e.g., playback controls lacking expected affordances)
- **Duplicated UI elements wired up differently** (two buttons for the "same"
  action going through different code paths with different behavior)

The intake walkthrough is still valuable for prioritization (which screens
hurt most), but the discovery burden shifts to review — specifically to the
**end-to-end flow traces** unit below, which traces every interactive element
and every system-originated update through its full cross-component chain.

**Owner-elicitation track (parallel to discovery — the TOP-DOWN half of
planning).** Discovery is bottom-up (what the code is); these artifacts are
top-down (what the platform should be), they come from the owner's head, not
the repos, and they gate later phases:

1. **Known-issues braindump** (described above) — gates: triage ranking.
2. **Platform requirements & variability spec** — what kinds of games should
   this support? Which dimensions must vary (scoring? token mechanics? team
   structure? narrative output? venue/AV setup?) and which are explicitly
   fixed or out of scope? Two or three sketched hypothetical games, even
   rough ones. Gates: Phase 3 design. Without this, Phase 3 produces "ALN,
   generalized" — baking ALN's shape into the engine by default.
3. **GM UX workflow requirements** — what must be visible at a glance during
   a live game; what must be reachable in ≤2 taps under pressure; what is
   deliberately hard to hit (destructive actions); pregame/postgame
   checklists as the GM actually runs them. Gates: Phase 3.3 UX design.

None of these depend on discovery output — they can be elicited in
structured conversations at any time, and discovery runs concurrently.

**Rubric (in priority order):**
1. Correctness bugs, race conditions, and *incomplete implementations*
   (handlers that never fire, unwired UI, dead branches, half-finished
   features)
2. Duplication / parity-drift risks (cross-component!)
3. Contract drift (code vs openapi.yaml/asyncapi.yaml)
4. Structure: SRP violations, God files, mixed concerns
5. Test gaps (untested branches in critical paths)
6. Style/idiom (lowest priority — lint now handles most of this)

**Review units (one report each):**
| Unit | Focus |
|------|-------|
| Backend: transaction/session/scoring | `transactionService`, `sessionService`, scoring parity vs scanner |
| Backend: show control | `cueEngineService`, `audioRoutingService`, `videoQueueService`, `commandExecutor` (the 4 biggest files) |
| Backend: websocket/broadcast layer | `broadcasts.js`, `adminEvents.js`, sync:full assembly |
| GM Scanner (static) | `app.js`, `uiManager.js`, storage strategies, networked session — structure, duplication, test gaps |
| Player scanner: web PWA (static) | inline-script architecture, offline queue, collection log, service worker |
| Player scanner: ESP32 (static) | `ALNScanner_v5/` services + UI layers, SD queue, asset sync, batch upload |
| **Player-scanner parity audit** | The web PWA and ESP32 are two implementations of ONE role (see below) — behavior-by-behavior parity matrix |
| config-tool + scripts | route handlers, Notion sync robustness |
| Cross-cutting | scoring parity audit, token schema consistency, contract conformance, **session-report output format** (external contract — see GenAI pipeline note below) |
| **End-to-end flow traces (cross-component)** | See below — the wiring-defect hunt, organized by *flow*, not by component |
| **Capability classification matrix** (moved from Phase 3.0) | Read-only classification walk over the same code: every capability tagged engine-fixed / game-configurable / game-content, and required / networked-only / standalone-only / optional. Produced DURING discovery because the `subsumed-by-platform-refactor` tag depends on it — reviewers can't judge subsumption without knowing what the platform refactor will touch. Phase 3.0 then finalizes this matrix into the game.json schema rather than starting from scratch. |
| **Runtime behavior (exploratory)** | Drive the *built* GM scanner + player scanner against a live backend (Playwright); exercise every admin-panel function and gameplay flow; verify behavior matches contract + intent, not just "doesn't crash". Seeded by `known-issues.md` and the flow-trace findings. Sequenced last in discovery (needs environment setup; static findings direct the exploration). |

**Two lenses applied by EVERY unit (finding classes, not separate units):**
- **Doc drift**: verify the component's CLAUDE.md / README claims against the
  code; flag overstatements and understatements. (Motivating case: root
  CLAUDE.md's "ESP32 Standalone: No" misrepresents verified offline
  capability.) Doc drift misleads future agent sessions — treat it as a
  defect, not a nitpick.
- **Test quality**: the coverage ratchet proves tests *exist*, not that they
  assert real behavior. Flag tests that mirror implementation, mock the
  thing under test, or pass vacuously — Phase 2's safety depends on knowing
  which tests can actually be leaned on.

**Opportunistic check**: if real past-game session data exists in the repo
(`logs/`, session storage), run `npm run session:validate` against it —
real-game discrepancies are evidence, not speculation.

**The flow-trace unit is deliberately NOT component-scoped.** The submodules
are deeply interdependent — a GM-scanner-only wiring trace would miss
defects in flows that *originate* elsewhere and only *terminate* at the GM
interface (or vice versa). The unit of analysis is the end-to-end flow,
traced across every component it touches, in every applicable deployment
topology. The flow inventory (derived from the AsyncAPI/OpenAPI contracts —
every channel/event/endpoint must appear in at least one flow; orphans are
dead code or missing features):

1. **GM command flows** — each admin control: DOM handler → `gm:command` →
   `commandExecutor` → service → `service:state`/broadcast → UI update,
   including `gm:command:ack` handling and failure paths
2. **GM transaction flows** — scan → transaction → `transaction:accepted` →
   score/scoreboard/Game Activity updates; duplicate-rejection paths; BOTH
   networked (backend-authoritative) and standalone (LocalStorage) variants
3. **Player-scan flows — traced separately per implementation** (web PWA
   and ESP32 are peer implementations; "same as web" is never assumed):
   - Web: QR/NFC scan → token lookup → POST `/api/scan` → `player:scan`
     broadcast → GM Game Activity; video token → video queue → display +
     `display:mode:changed` → GM Now Playing; collection log update
   - ESP32: RFID/NDEF read → local token-DB gate (UNKNOWN TOKEN refusal) →
     POST `/api/scan` → same downstream chain; video token → 2.5s modal +
     orchestrator playback; 409-duplicate display path
   - **Replay semantics parity**: ESP32 batch upload (`/api/scan/batch`,
     10 at a time) vs web queue replay — do late-replayed scans trigger
     videos? Do both produce identical `player:scan` broadcasts, Game
     Activity entries, and `session.playerScans` persistence?
4. **Reconnection/sync flows** — connect/reconnect → `sync:full` → every
   consuming panel restores (playerScans, gameClock, cueEngine, music,
   serviceHealth, heldItems, sound)
5. **Cue-engine-originated flows** — game event → cue fires → commands →
   service effects → broadcasts → GM active-cues display; held-item paths
   (outage → held → release/discard)
6. **Offline-queue flows** — GM queue, player-scanner queue, ESP32 SD queue:
   queue → reconnect → replay → dedup/ordering on arrival
7. **Scoreboard display flows** — transactions (both modes) →
   `backend/public/scoreboard.html` updates
8. **Service-health flows** — service failure/recovery → registry →
   `service:state(health)` → GM dashboard + command gating

Each flow trace flags links that are missing, duplicated, inconsistent
between components, or divergent between deployment topologies. The
Phase 1.0 defect classes apply at every link. `data-flow-tracer`
methodology; contracts are the reference for intended behavior.

**Player-scanner parity audit (dedicated deliverable).** The ESP32 scanner
is not an accessory — it is a *hardware implementation of the player-scanner
role*, intended to have feature parity with the web PWA. The audit produces
a behavior-by-behavior matrix across both implementations:

| Behavior | Compare |
|----------|---------|
| Scan input → token resolution | QR/Web-NFC + normalize (web) vs RFID/NDEF + cleanTokenId (ESP32) — same tokenId semantics? |
| Unknown-token handling | ESP32 gates on local DB (refuses to send); does web do the same? |
| Media display | image+audio rendering, video-token behavior (processingImage vs 2.5s modal + "Sending...") |
| Duplicate (409) handling | both must allow re-viewing — identical UX outcome? |
| Offline queue + replay | localStorage queue (max 100) vs SD `queue.jsonl` + batch upload — ordering, dedup, video-trigger-on-replay semantics |
| Collection / memory log | web keeps localStorage collection; ESP32 equivalent absent — gap or decision? |
| Offline core function | **Both do the core job offline** (scan → display content): web via service worker + localStorage, ESP32 via SD assets + local token DB (verified: `Application.h` displays regardless of connection state). Parity ✓ — only video triggering + reporting need the orchestrator on either |
| Standalone *deployment stance* | web: explicit never-connect mode (path-based); ESP32: no equivalent stance — offline it still queues for eventual sync (100-entry FIFO cap) and shows disconnected status. Open spec question: does ESP32 need an explicit "no orchestrator exists" config (suppress queue/status), or is de facto offline operation sufficient? |
| Token/asset sync | submodule + service worker (web) vs manifest-based wireless sync (ESP32) |
| Team association | optional teamId (web) vs config.txt TEAM_ID (ESP32) |
| Connection awareness | exponential-backoff monitoring (web) vs 10s health polling + ConnectionState (ESP32) |
| Backend payload conformance | both validated by `backend/tests/contract/scanner/request-schema-validation.test.js` — extend, don't duplicate |

Every divergence is classified: **intentional** (hardware constraint —
document in the role spec), **drift** (accidental — fix), or **missing
feature** (backlog with owner decision). The output doubles as the first
draft of the *player-scanner role spec*, which Phase 3 treats as an engine
artifact (each game pack runs on both implementations; deviations stay
documented in one place).

**Output per unit:** ranked findings with file:line refs, each tagged:
- `runtime-defect` — confirmed misbehavior (gets a failing test before any fix)
- `fix-now` — small, safe, immediate
- `fix-in-phase-2` — structural, batched
- `subsumed-by-platform-refactor` — don't touch; Phase 3 rebuilds this anyway
- `wontfix` — documented and accepted

The tagging step is what prevents refactoring twice — and prevents polishing
UI code that Phase 3 will replace with themeable/configurable equivalents.

### Phase 2 — Debt paydown (≈2-4 sessions, driven by Phase 1 tags)
Only `fix-now` and `fix-in-phase-2` items. The list below is a set of
**hypotheses from the initial survey, not commitments** — each is confirmed,
re-ranked, or killed at the triage checkpoint based on discovery findings
and the platform requirements (see owner-elicitation track). Nothing here is
authorized to start until triage:
1. **Shared rules module** for group completion + mode scoring (kills the
   backend/LocalStorage duplication — see D3). This is the flagship item.
2. Split `app.js` + `uiManager.js` (GM Scanner) — and split them along the
   **target UX domain boundaries** (see Phase 3 frontend track), not
   arbitrary technical seams:
   - **Game Operations** — scanning, scores, logged memories, transactions
   - **Environment** — lighting, music/soundtrack volume, audio routing,
     bluetooth
   - **Game Admin** — pregame setup, session lifecycle, postgame report
   This way the structural refactor (Phase 2) and the UX restructure
   (Phase 3) are the same cut, done once. Phase 2 moves code into these
   modules without redesigning screens; Phase 3 redesigns the screens on
   top of the already-separated modules.
3. Split `audioRoutingService.js` (routing vs ducking engine).
4. Migrate `aln-memory-scanner` inline script to ES6 modules (mirror
   ALNScanner's earlier migration; its plan docs are in `docs/plans/`).
5. Tighten validation: memoryType enum check (or explicit UNKNOWN warning),
   tokens.json JSON Schema.
6. **Session-report contract test**: versioned schema doc for the report
   markdown (the three table structures the GenAI pipeline parses — see
   external-dependency section) + a test snapshotting section titles,
   column order, and the `tokenId/CharacterName` Detail format in
   `sessionReportGenerator.js` output.

**Exit criteria:** no file > ~1000 lines in critical paths; group/mode logic
exists in exactly one place per runtime; ratchets all green.

### Phase 2.x — E2E harness as platform infrastructure (≈2 sessions)

**Added 2026-06-11** (owner-committed) after the Phase 2 closeout audit ran
the E2E suites off-Pi for the first time and assessed the harness design
(see `docs/reviews/2026-06-platform-review/e2e-harness-assessment.md`).
Full plan: `docs/plans/2026-06-11-phase2x-e2e-harness.md`.

Not test chores — three of four items rehearse Phase 3/4 product problems:
1. **Capability manifest + declared per-flow requirements** — co-designed
   with the venue-profile schema (B7/B8): the same vocabulary drives the
   harness and Phase 3's venue preflight go/no-go.
2. **Tier L / Tier H suite split** — Tier L (logic/UI, ~115 tests) becomes
   the CI floor Phase 3 development runs against on every change; Tier H
   (hardware) is the Pi pre-show/release gate.
3. **Content-independent fixture/pack injection** — the first consumer of
   the "give the system a different pack" seam; Phase 4's acceptance tests
   (toy second game through full E2E, deployment-topology validation)
   execute through this machinery.
4. websocket-core event-cache redesign (the false-quarantine footgun).

**Sequencing:** 2.x precedes the Phase 3 BUILD (3.1.5 onward); Phase 3.0/3.1
*design docs* proceed in parallel and co-design the capability vocabulary.
Already landed from the audit: page-object drift gates in the unit suite,
loud-skip/named-degradation-test pattern across flows.

### Phase 3 — Engine/game-pack separation (program doc supersedes this section)

> **2026-06-11:** Phase 3 is now structured by
> `docs/plans/2026-06-11-phase3-program.md` (the Phase 3.0 design doc):
> five tracks (A Pack spine / B Tooling / C Install layer / D GM
> experience / E Player platform), toy-pack-as-second-consumer
> methodology, and a recommended Definition of Done (A+B+C gate the
> phase; D/E are parallel tracks) pending owner ratification. The
> section below is preserved as original context.

### Phase 3 (original sketch) — Engine/game-pack separation (≈5-7 sessions, design doc first)

**Phase 3.0 — Finalize the capability classification matrix.**
The matrix is *produced* during Phase 1 discovery (see review units — it had
to move there because finding-tagging depends on it). Phase 3.0 revisits it
with the review findings and triage decisions in hand, resolves the
classification calls that were marked uncertain, and carries it into the
game.json schema design. Since there is no concrete second game yet, the
schema design is grounded in this systematic inventory: every capability
across backend services, GM scanner, both player scanners, and config-tool,
classified along two independent axes:

| Axis | Values |
|------|--------|
| **Variability** | engine-fixed / game-configurable (game.json) / game-content (tokens, cues, assets, strings) |
| **Deployment** | required always / networked-only / standalone-only / optional module |

The deployment axis is first-class because the system already *claims* several
topologies that have never been field-tested (player-scanner-only, standalone
GM with no orchestrator, full networked). The matrix doc
(`docs/proposals/`) becomes both the backbone of the `game.json` schema AND
the test matrix for Phase 4.

1. **Design doc** (`docs/proposals/`): `game.json` schema covering modes
   (names, point formulas, scoreboard behavior), device-type policies,
   group rules, team rules. Review the schema against *two* hypothetical
   games to avoid baking ALN assumptions in.
2. **Extraction sequence** (each its own PR, lowest risk first):
   a. Strings/branding → `strings.json` + theme variables (touches HTML only)
   b. Mode/scoring rules → `game.json` (uses Phase 2's shared rules module)
   c. Device-type duplicate policies → `game.json`
   d. Group completion rules → `game.json`
   e. Content pipeline: extract a source-adapter interface from
      `sync_notion_to_tokens.py` (Notion = first adapter; DB IDs and field
      mapping become adapter config)
   f. **ESP32 game-pack support** (in scope per owner): the device already
      downloads tokens + assets via the backend manifest API — extend the
      manifest to carry strings/theming/behavior config so the firmware
      stays game-agnostic; audit `ALNScanner_v5/` for hardcoded ALN strings
      and pull them into config delivered at sync time. Governed by the
      **player-scanner role spec** (Phase 1 parity-audit output): the spec
      defines the role once; web PWA and ESP32 each implement it, and any
      game pack must run on BOTH implementations to count as supported.
   g. Generalize cue-engine event normalizers / stream names (only if a real
      second game needs it — defer otherwise)
3. **Frontend UX restructure (GM Scanner).** Owner-directed redesign of the
   entire frontend around three separated domains:
   | Domain | Contains |
   |--------|----------|
   | **Game Operations** | scanning, scores, logged memories, transactions |
   | **Environment** | lights, soundtrack/volume, audio routing, speakers |
   | **Game Admin** | pregame setup, session lifecycle, postgame report |
   Sequenced here (not Phase 2) because it rebuilds the same surfaces the
   strings/theming extraction (3.2a) touches — design them together, build
   once. Prerequisite: Phase 2's module split along the same boundaries.
   Phase 1's wiring-defect inventory feeds this directly: rather than
   patching duplicated/miswired controls in the old layout, each control is
   rebuilt *correctly once* in its proper domain. (Defects in flows that
   survive into the new UX still get failing tests first; defects in UI that
   the restructure deletes get tagged `subsumed-by-platform-refactor`.)

   **UX design stage (REQUIRED, before any rebuild).** The restructure is a
   design problem before it is a code problem. Sequence: (a) GM UX workflow
   requirements from the owner-elicitation track + Phase 1 defect inventory
   → (b) wireframes/interactive mockups for the three domains → (c) owner
   review checkpoint (walk through a simulated game night against the
   mockups) → (d) only then implementation. No screen is rebuilt without an
   approved design for it.

   **Game Admin stretch goal — report-pipeline intake (owner direction).**
   The GenAI pipeline's manual runtime inputs (`roster`, `accusation`,
   `directorNotes`, session photos, whiteboard photo — see external-
   dependency section) are all things the GM *has or does during the game*.
   The Game Admin domain should be designed with capture points for them so
   the post-game process is assembled instead of reconstructed:
   - **Pregame setup** already exists → capture character roster there
   - **During game**: lightweight quick-capture director notes (timestamped,
     optionally linked to a team/transaction — GM is busy, so one-tap +
     dictation-friendly) and photo capture/annotation via the PWA camera
   - **Endgame**: accusation capture + whiteboard photo as explicit
     post-game checklist steps
   - **Output**: a session bundle (report markdown + photos + notes +
     accusation + roster) mapping 1:1 onto the pipeline's `rawSessionInput`
     — ultimately submittable straight to its `POST /api/session/{id}/start`
     endpoint, with curation/approval remaining in the pipeline's console
   Design the Game Admin UX with these capture points from the start even if
   implementation lands after the core platform work; retrofitting capture
   flows into a finished UX is far costlier than reserving space for them.
   The Phase 2.6 report schema should anticipate this bundle format.
4. **Restructure** ALN content as the first game pack (likely: evolve the
   ALN-TokenData submodule into the pack, since distribution plumbing to all
   scanners already exists).
5. Update contracts (OpenAPI/AsyncAPI) wherever payloads gain game-pack
   indirection.

### Phase 4 — Prove it (≈2-3 sessions)
Two acceptance tests, run together:

1. **Toy second game pack** — different title/copy/theme, different mode
   names and point formulas, a tweaked group rule, a handful of test tokens —
   full E2E suite passes **with zero engine-code changes**. Keep the toy pack
   in-repo as a permanent regression fixture and as the "how to make a new
   game" documentation-by-example.
2. **Deployment topology validation** — exercise each claimed topology from
   the Phase 3.0 matrix (full networked / standalone GM / player-scanner-only
   / no-orchestrator) with scripted E2E runs, since these have not been field
   tested. Defects found here feed the same tagged backlog.

### Phase 5 (future) — In-house content authoring
Owner direction: eventually bring content development in-house (internal
database + content-creation interface) instead of Notion. The architecture
already points the way; no work needed now beyond keeping the seams clean:
- The **tokens.json JSON Schema** (Phase 2) is the contract any authoring
  tool must emit — write it with this future in mind.
- The **source-adapter interface** (Phase 3.2e) makes an internal content DB
  "just another adapter" alongside Notion.
- The likely seed is **config-tool** (already an Express + web-UI pattern for
  editing cues/playlists/config) growing a token/content editor, or a sibling
  app following the same pattern.

---

## Part 4: Working Agreements

- **Order is load-bearing, with one flexibility:** Phase 1 is read-only
  (reports committed to the parent repo) and may run before or alongside
  Phase 0; Phase 0 MUST complete before Phase 2 (no code changes without
  lint/ratchet gates in place). Then 2 → 3 → 4. Phase 1 review units can
  run in parallel; Phase 3 extractions are sequential PRs.
- **Two-track access model:** the real split is not read-vs-write phases but
  *parent-writable* vs *submodule-write-required*. Parent-writable now:
  `backend/`, `config-tool/`, `scripts/`, `docs/`, `contracts/`, CI
  workflows — so parent-side Phase 0 (backend lint CI job, config-tool
  lint/tests) can land at any time, and backend-side Phase 2 items unblock
  immediately after triage. Submodule-write-required (needs scanner repos
  added to session scope, or a scoped fine-grained PAT as an environment
  secret): ALNScanner/aln-memory-scanner lint configs, all scanner
  refactors, ALN-TokenData restructuring.
- **Every finding gets a tag** before any refactor starts (prevents double
  work and scope creep).
- **Failing test first for every confirmed defect:** a `runtime-defect` is
  not "fixed" until a test that reproduced it passes. This converts the
  owner's "feels broken" knowledge into permanent regression protection.
- **Contract-first** for every API/event/schema change, including game.json.
- **Decisions get recorded:** architecturally significant choices during
  Phases 2-3 (seam placements, schema shapes, what stays engine-fixed) are
  captured as short decision records in `docs/decisions/` — the *why*
  survives the session that decided it.
- **Submodule discipline:** scanner-affecting changes follow
  `SUBMODULE_MANAGEMENT.md`; rebuild ALNScanner dist before backend E2E.
- **Session reports:** after risky phases, `npm run session:validate latest`
  against a real or simulated game session.

## Owner Decisions (resolved 2026-06-09)

1. **Second game:** none concrete yet; expect modified mechanics + extended
   features. → Phase 3.0 capability-classification matrix replaces
   "design against a known game"; schema reviewed against two hypotheticals.
2. **Content pipeline:** Notion for now; long-term direction is in-house
   content DB + authoring interface. → Phase 5 added; tokens.json schema and
   source-adapter interface are designed as its foundation.
3. **ESP32:** definitely in scope for game-pack support. → Phase 3.2f added
   (manifest-delivered strings/theming/config; firmware string audit).
4. **Known runtime issues exist** ("works well enough but feels broken",
   esp. GM scanner UI). → Phase 1.0 known-issues intake + dedicated
   runtime-behavior review unit + `runtime-defect` tag + failing-test-first
   working agreement.
5. **Deployment topologies** (player-scanner-only, no-orchestrator) are
   designed but not field-tested. → Deployment axis added to Phase 3.0
   matrix; topology validation added to Phase 4.
6. **"Feels broken" = mostly review-findable wiring defects** (inputs not
   reaching backend, stale UI, missing/duplicated controls). → GM Scanner
   review unit upgraded to a full interactive-element wiring trace
   (Phase 1.0 defect classes).
7. **Frontend needs a UX restructure** into Game Operations / Environment /
   Game Admin domains. → Phase 3.3 added; Phase 2 module split aligned to
   the same boundaries so the cut happens once.
8. **GenAI report pipeline exists downstream** (`aboutlastnight/reports`
   repo, generates fictional blog article from post-game report). → Session
   report format treated as an external contract; cross-cutting review unit
   covers it; narrative config reserved as a game-pack slot.
9. **Best-of-all-worlds goal: GM interface absorbs report-pipeline intake**
   (photo capture/curation/annotation, director note-taking, roster and
   accusation capture) to streamline post-game processes. → Added as a
   designed-for stretch goal in the Game Admin domain (Phase 3.3); session
   bundle format anticipated in the Phase 2.6 report schema.
10. **ESP32 = hardware player scanner with feature-parity intent** (not a
    peripheral accessory). → Dedicated player-scanner parity audit added to
    Phase 1 (behavior matrix, divergences classified as intentional / drift /
    missing); its output becomes the player-scanner *role spec*, an engine
    artifact in Phase 3. Player-scan flow traces run per-implementation.
    **Correction (owner + code-verified):** the ESP32 is NOT network-
    dependent for its core job — scan → display works fully offline (local
    token DB + SD assets; `Application.h` displays regardless of connection
    state). "Always networked" in the root CLAUDE.md describes its sync
    *intent*, not a functional requirement. The narrower open question:
    should it gain an explicit standalone deployment stance (never-sync
    config) to mirror the web scanner's, or is offline-resilient operation
    sufficient? Root CLAUDE.md's mode table ("Standalone: No") should be
    clarified either way — documentation finding for Phase 1.
