# Phase 3 · B0 — tooling foundation (design doc)

Opened 2026-09-04 on `claude/phase3-b0` (chained from the theme-unit
tip `8752d53`; draft PR #32 at open). Governed as a full unit: census
→ design rounds → red-team → staged build with per-stage two-axis
reviews → whole-unit adversarial review → dual-gate close.

## 1. Scope and inputs

B0 is the Track B foundation the Design-workspace pages stand on
(program Track B; §7 R1; §13.6; the 2026-06-11 config-tool pre-read;
the one-auth/O3 doc's v1 subset; the 2026-09-03 §14 rulings):

- **B0.1 — pack/profile store with draft→publish.** The tool stops
  editing live files. Drafts are tool-private; publish is the explicit
  step that lands content where the engine reads it.
- **B0.2 — app shell + shared store + model-module discipline +
  frontend test harness.** The five pages must not become five
  snowflakes; the musicModel exemplar becomes the norm; the DOM layer
  becomes testable.
- **B0.3 — operator-tier auth v1**, including its BACKEND substrate:
  token claims, issuance-time grant computation, the function check in
  commandExecutor/routes, and the scoreboard token with a PLAIN read
  scope. Players and scanners NEVER get user-facing logins (§13.6);
  `/api/scan` stays anonymous with its ledger row.

Boundary notes: E10 hot-apply belongs to the PAGES unit (§14.2 floor),
but B0's store must not preclude it — publish-time re-activation is the
named adjacency. The preset system is C1's replacement target, not
B0's; B0 must not extend it.

## 2. Census record (2026-09-04 — two independent legs, counts ×2-verified)

Both legs derived every count from the tree independently; all
load-bearing numbers AGREE. One grouping difference reconciled: six
write OPERATIONS over five live TARGET groups (upload + delete share
the asset-dir target).

**The tool today** (`config-tool/`): `server.js` (41L, loopback-only,
NO auth — a documented pre-show posture; `CONFIG_TOOL_HOST` opt-in
warns) + `lib/` ×5 (`configManager.js` 434L, `routes.js` 314L,
`envParser.js` 116L, `validators.js` 151L, `secrets.js` 33L) + one
SPA shell (`public/index.html`) with 6 lazy section modules + `tests/`
×8 files (node:test; supertest for routes).

**21 API endpoints** (routes.js; pre-read's "27" is drift): 9
read-only, 12 mutating. Every mutating route lands DIRECTLY on a
live-file writer — no draft layer exists anywhere.

**The six live write operations** (the sites B0.1 must absorb):
1. `writeEnvValues` → `backend/.env` (configManager.js:104-118)
2. `writeScoring` → `ALN-TokenData/game.json` + in-place manifest
   rebuild (:120-150, manifest :155-160)
3. `writeCues` → `ALN-TokenData/cues.json` + manifest rebuild +
   rollback (:162-234)
4. `writeRouting` → `backend/config/environment/routing.json`
   (:236-239)
5. Asset upload → LIVE `backend/public/{audio,videos}` (multer
   destination, routes.js:104-118)
6. `deleteAsset` → same live dirs (configManager.js:296-301)

Presets (configManager.js:318-431) are a flat snapshot/restore that
fans out to writers 1-4 — same targets, not a seventh; the system is
C1's replacement target. Shared atomic `_writeJson` (tmp+rename,
:244-253) and validate-before-write exist and carry forward.

**What fights draft→publish** (both legs, identical list):
`DEFAULT_PATHS` hardcoded live map (:21-39); direct submodule
working-tree writes; `_rebuildPackManifest` in place on every write
(no content-hash-as-draft-identity); presets snapshotting live files;
uploads landing in the live serving dirs.

**Test harness**: node:test only — no jsdom, no Playwright in
devDependencies. Covered: configManager, envParser, routes
(supertest), formatting, musicModel, one conditionBuilder pure
function. UNCOVERED: `lib/validators.js` + `lib/secrets.js` (no
dedicated file) and 14 of 17 `public/js` files (app shell, all six
components incl. the 382L timelineView, five of six sections, both
utils). Census oddity for the record: `cueTriggerEvents.test.js`
tests the BACKEND's standingEvaluator, not config-tool code.

**Backend auth surface today** (the B0.3 substrate touchpoints):
- `middleware/auth.js:93` `requireAdmin` — Bearer JWT, all-or-nothing
  `role:'admin'`; SINGLE consumer (`adminRoutes.js:58`, GET /logs).
  Issuance: `POST /api/admin/auth` (adminRoutes.js:17 →
  generateAdminToken, auth.js:17-41; claims today are only
  `{id, role, timestamp}`).
- WS handshake (`socketServer.js:45-104`): JWT + role check only for
  `deviceType==='gm'`; `gmAuth.js:30` re-checks; `adminEvents.js:31`
  gates gm:command by deviceType.
- `commandExecutor.js:117-123` — the cue-vs-gm FLOOR guard: the
  execution-time choke point where O3's FLOOR functions
  (session-lifecycle / show-control / score-intervention) re-check.
- Scoreboard: `resourceRoutes.js` injects `ADMIN_PASSWORD` into the
  served page — the mechanism the PLAIN read-scope token replaces.
- `/api/scan` (scanRoutes.js:19): anonymous by ruling (§13.6 ledger).
- One-auth v1 subset status: ENTIRELY unbuilt — no tier/class/function
  claims, no grant computation, no function-scoped middleware.

**Pre-read decision table vs today** (both legs agree): keep-items all
stand (server/routes/supertest, atomic writes, el()/CSS, timelineView
kept-not-upgraded, tokenBrowser, musicModel-as-exemplar, no-build
vanilla JS). NOT built: B0.1 store, B0.2 shared store + DOM harness
(pure-logic tests only), B0.3 auth AND the served-vocabulary
re-sourcing (`TRIGGER_EVENTS` cueEditor.js:10 / `ACTION_DEFS`
commandForm.js:8 still hand-mirrored), validators
schema-per-store-kind, preset→profile replacement (C1's, tracked
there). The pre-read's own gate — "Track B pages must not be built
before B0 lands" — is confirmed still unmet, which is why B0 is this
unit.

**E10 adjacency (context only, not scoped):**
`packService.activatePack()` is boot-only with exactly one call site
(`app.js:192`); the frozen-snapshot pattern plus the existing
`_cachedScoringRules` reset already anticipate re-activation. B0.1's
publish flow must leave a clean seam for a later post-boot
re-activation call, and must not add a second pack-state authority.

## 3. Design (next stage)
