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
The owner has firsthand knowledge of "works well enough to run ALN but feels
broken" areas — notably parts of the GM scanner interface. This knowledge
exists nowhere in the codebase and is the cheapest defect-discovery mechanism
available. Before any agent review: a structured walkthrough capturing each
known issue into `known-issues.md` (symptom, where it appears, severity,
current workaround, repro steps if known). These entries direct reviewer
attention and become the seed of the defect backlog.

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
| GM Scanner | `app.js`, `uiManager.js`, storage strategies, networked session |
| Player scanners (web + ESP32) | inline-script architecture, offline queues, asset sync |
| config-tool + scripts | route handlers, Notion sync robustness |
| Cross-cutting | scoring parity audit, token schema consistency, contract conformance |
| **Runtime behavior (exploratory)** | Drive the *built* GM scanner + player scanner against a live backend (Playwright); exercise every admin-panel function and gameplay flow; verify behavior matches contract + intent, not just "doesn't crash". Seeded by `known-issues.md`. |

The runtime-behavior unit is deliberately different in kind from the static
reviews: static review finds structural debt, but "feels kind of broken"
defects only surface when the real UI is driven end-to-end.

**Output per unit:** ranked findings with file:line refs, each tagged:
- `runtime-defect` — confirmed misbehavior (gets a failing test before any fix)
- `fix-now` — small, safe, immediate
- `fix-in-phase-2` — structural, batched
- `subsumed-by-platform-refactor` — don't touch; Phase 3 rebuilds this anyway
- `wontfix` — documented and accepted

The tagging step is what prevents refactoring twice — and prevents polishing
UI code that Phase 3 will replace with themeable/configurable equivalents.

### Phase 2 — Debt paydown (≈2-4 sessions, driven by Phase 1 tags)
Only `fix-now` and `fix-in-phase-2` items. Likely contents (pre-validated by
this survey, confirm against Phase 1 reports):
1. **Shared rules module** for group completion + mode scoring (kills the
   backend/LocalStorage duplication — see D3). This is the flagship item.
2. Split `app.js` (GM Scanner) by responsibility: NFC input / screen
   coordination / admin actions.
3. Split `audioRoutingService.js` (routing vs ducking engine).
4. Migrate `aln-memory-scanner` inline script to ES6 modules (mirror
   ALNScanner's earlier migration; its plan docs are in `docs/plans/`).
5. Tighten validation: memoryType enum check (or explicit UNKNOWN warning),
   tokens.json JSON Schema.

**Exit criteria:** no file > ~1000 lines in critical paths; group/mode logic
exists in exactly one place per runtime; ratchets all green.

### Phase 3 — Engine/game-pack separation (≈5-7 sessions, design doc first)

**Phase 3.0 — Capability classification matrix (the systematic walk-through).**
Since there is no concrete second game yet, the schema design is grounded in a
systematic inventory instead: walk every capability across backend services,
GM scanner, both player scanners, and config-tool, and classify each along two
independent axes:

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
      and pull them into config delivered at sync time.
   g. Generalize cue-engine event normalizers / stream names (only if a real
      second game needs it — defer otherwise)
3. **Restructure** ALN content as the first game pack (likely: evolve the
   ALN-TokenData submodule into the pack, since distribution plumbing to all
   scanners already exists).
4. Update contracts (OpenAPI/AsyncAPI) wherever payloads gain game-pack
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

- **Order is load-bearing:** 0 → 1 → 2 → 3 → 4. Phase 1 review units can run
  in parallel; Phase 3 extractions are sequential PRs.
- **Every finding gets a tag** before any refactor starts (prevents double
  work and scope creep).
- **Failing test first for every confirmed defect:** a `runtime-defect` is
  not "fixed" until a test that reproduced it passes. This converts the
  owner's "feels broken" knowledge into permanent regression protection.
- **Contract-first** for every API/event/schema change, including game.json.
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
