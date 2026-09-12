# The self-heal lane — the scanner's pack self-heal and the two owed tests (implementer brief)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §5 (activation frozen at boot, the pack channel). Model:
Opus. You dispatch no subagents; review arrives from the orchestrator
after your report.

## What this buys, and for whom

The GM's loop, on Thursday night. New tokens sync from Notion, the
orchestrator restarts with the new pack, and today every GM tablet
keeps scoring with the OLD rules until someone reloads it by hand: the
server warns about the hash mismatch and nothing on the tablet reads
that warning. After this task the tablet notices the mismatch on its
next `sync:full`, heals itself at a safe moment (no active session, or
no local transactions for the session), shows one toast "Rules updated
to <version>", and reconnects with the new hash; mid-session it shows a
banner and heals at the next safe moment; if the heal fails it shows a
blocking screen with a plain instruction instead of scoring with the
wrong rules. The two tests the roadmap owes (a real timeout, the
staging-cache race) land here.

## Where you work

The worktree `.worktrees/self-heal` on branch
`claude/nice-curie-hescfv-self-heal`, cut from the designated branch
after the harness minimum merged; its `ALNScanner/` submodule is checked
out on the ALNScanner branch of the same name. ALNScanner + the backend
E2E harness and one new flow. Never touch backend `src/`,
`ALN-TokenData/`, or another worktree. Push nothing. Commit per
deliverable, scanner and backend commits separate.

Shared-file rules (plan §1 R15; the credentials and supervisor lanes
build in parallel; the preflight panel comes after you):
- `ALNScanner/src/network/messageRouters.js`: the `sync:full` case in
  `sharedInfraRouter` is yours; the panel lane edits it after your
  merge. Touch no other router.
- `backend/tests/e2e/setup/test-server.js`: only `restartOrchestrator`
  gains a `packPath` option (the harness minimum has just changed this
  file's data-directory handling; build on the merged version).
- `ALNScanner/src/ui/renderers/HealthRenderer.js`,
  `AdminOperations.js`, `domEventBindings.js`: not yours (supervisor
  lane).

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-factsheet.md`,
read in full before the first edit. The load-bearing facts:
- `src/core/packLoader.js` (457 lines) exports only `loadPack()`
  (130-182); no `refresh` exists. `_stagedRefresh()` (210-286) flips
  the `aln_pack_active` pointer and GCs old caches (263-269) as soon as
  its own checks pass (sha1 per file, non-empty token map, declared
  sidecars) — it never asks the consumer. The staging-cache race is
  comment-documented at 275-281; `_deleteOtherPackCaches` at 288-297.
- `src/core/tokenManager.js` `loadDatabase()` (50-116) is the only
  apply entry point; it always calls `loadPack()` again; its
  `schemaVersion` gate (60-66, `PACK_SCHEMA_VERSION = 2`) is the only
  refusal and runs AFTER the flip. The apply chain (steps 3–7: tokens,
  info, gameConfig, `applyPackScoring`/`applyPackGroups`,
  `applyPackModes`/`applyPackEntities`, `applyPackStrings`,
  `applyPackTheme`, `buildGroupInventory`) mutates module state in
  place with no undo; `applyPackScoring` returns false on a bad shape
  and nobody reads it.
- `sync:full.pack = {packId, version, contentHash}` is on the wire
  (`backend/src/websocket/syncHelpers.js:150`); nothing client-side
  reads `payload.pack`. The router's `sync:full` case is
  `messageRouters.js:92-155`; `handleSessionBoundary()` at 94 and
  `updateSessionState()` at 119-123 overwrite the facts the boundary
  predicate needs — read them first.
- Boundary facts: `unifiedDataManager.currentSessionId` (set at
  542-543, 947, 961) and `getTransactions()` (274-276; networked
  strategy's list at `NetworkedStorage.js:29,354-358`).
- `connectionManager.js` retries `DEVICE_ID_COLLISION` inside its
  generic exponential backoff (178-199; `maxRetries` 5; 1 s→30 s).
- UI: `showToast.js` auto-dismisses (36-39); no banner component; the
  blocking pattern is `ConnectionWizard`'s full-screen modal, driven by
  `auth:required` (`app.js:185-196`).
- `sw.js:24` exempts `aln-pack-*` from cache GC; keep it.
- Backend harness: `restartOrchestrator()` (`test-server.js:397-425`)
  ignores `options.packPath`; `startOrchestrator({packPath})` prefers
  the caller's value (127, 143-145). Fixture hashes: `toy-heist` =
  `toy-heist-require` (`sha256:966e775a…`, packId `midnight-heist`);
  `parity-pack` (`sha256:3d42ec85…`). The only hash-changing pair is
  `toy-heist` ↔ `parity-pack`. Flow 31 is the template for driving a
  session over the wire; flows 07b/07c drive the GM scanner in the
  browser.
- Green baseline: packLoader 30, tokenManager 26, networkedSession 82,
  connectionManager 54.

## The pin (plan §3 P14, binding in full; read it before the first edit)

Compare `sync:full.pack.contentHash` to the active pack; heal at a
session boundary through the CONNECTED orchestrator's pack channel
regardless of serving origin, as `loadPack()`'s network tier verbatim
(staging, sha1 verify, no cache or bundled fallback); validate the
consumer re-apply against the staged content and only then flip and
GC; re-apply; reconnect with the new hash tolerating one
`DEVICE_ID_COLLISION`; one toast "Rules updated to <version>"; at most
one attempt per `{connection, serverHash}`; a failed heal shows the
blocking backstop; mid-session a persistent non-blocking banner; the
server keeps its warn; the two §8.5 tests land here.

## Orchestrator rulings on what the pin leaves open (recorded in the plan's record with cost if wrong)

- **R-H1 Validate, then flip, then apply.** `packLoader.refresh({baseUrl})`
  stages from `<baseUrl>/api/pack/*` and returns `{staged, commit(),
  discard()}` without touching the pointer. `tokenManager` gains two
  methods extracted from `loadDatabase()`: `validatePack(pack)` — a pure
  check returning `{ok, reason}` that mirrors every refusal the apply
  chain can make (`schemaVersion` = 2; non-empty token map; scoring has
  both non-empty tables; every token group declared in `groups`; the
  shape checks `applyPackModes`/`applyPackEntities`/`applyPackStrings`/
  `applyPackTheme` perform) — and `applyPack(pack)` (steps 3–7).
  `loadDatabase()` becomes `loadPack()` → `validatePack` → `applyPack`
  (a refusal keeps today's `return false`). The heal: stage →
  `validatePack(staged)` → on ok `commit()` (flip + GC) → `applyPack` →
  reconnect; on refusal `discard()` and the backstop. The apply
  functions keep their in-place mutation; the predicates are the
  single source both paths use.
- **R-H2 The boundary.** Evaluated at the top of the `sync:full` case
  before `handleSessionBoundary()` and `updateSessionState()`: a
  boundary is a `sync:full` whose `payload.session` is null, OR whose
  session id has no local transactions on this device
  (`getTransactions()` filtered to that session id is empty). The latch
  is a Map keyed `${connectionId}:${serverHash}` cleared on disconnect.
- **R-H3 The reconnect.** After `applyPack`, disconnect and reconnect
  with the new `packHash`; on `DEVICE_ID_COLLISION` wait 750 ms and
  retry once; then the normal path.
- **R-H4 The UI.** Banner: a new persistent element `#packMismatchBanner`
  (non-blocking, text `Rules changed on the orchestrator — they will
  apply when this session ends`), hidden once healed. Backstop: a new
  blocking screen `packBackstopScreen` in the ConnectionWizard idiom,
  text `The new rules could not be applied. Reload this page. If it
  happens again, restart the orchestrator.`, with one Reload button.
- **R-H5 The owed backend flow.** `tests/e2e/flows/32-pack-self-heal.test.js`,
  tagged for the toy leg: start on `toy-heist`, open the GM scanner in
  the browser in networked mode, create a session and end it (a
  boundary), `restartOrchestrator({packPath: parity-pack})`, then assert
  the scanner's toast text, the settings pack line showing the new
  hash prefix, and the server's device record carrying the new
  `packHash` (via the connected-devices data `sync:full` reports).
  `restartOrchestrator` gains `packPath` (caller's value wins);
  `connectWithAuth` is untouched unless the flow needs a raw socket.

## Deliverables, each red-first at its seam (scanner unless said)

1. `packLoader.refresh({baseUrl})` per R-H1, reusing the network tier's
   code paths (no copy). Red-first: refresh stages and verifies sha1
   per file; `commit()` flips and GCs; `discard()` leaves pointer and
   caches untouched; a divergent serving origin (page from GitHub
   Pages, socket to the orchestrator) fetches from `baseUrl`.
2. `tokenManager.validatePack` / `applyPack`; `loadDatabase()`
   refactored onto them (26 existing tests stay green). Red-first: each
   refusal reason; `applyPack` on a validated pack equals today's
   `loadDatabase()` end state.
3. The `sync:full` case: hash comparison, boundary predicate, latch,
   heal, toast; the mid-session banner. Red-first: heal at a boundary
   → one toast; mid-session → banner, no heal; second mismatch for the
   same hash on the same connection → no second attempt; re-apply
   failure leaves pointer and cache untouched and shows the backstop.
4. The reconnect with the bounded collision retry (`connectionManager`).
   Red-first: one collision then success; two collisions fall to the
   normal path.
5. The two §8.5 tests in `tests/unit/core/packLoader.test.js`: (a) a
   fetch that never resolves → `loadPack()` aborts at its timeout and
   falls through to the cache tier (behaviour, not signal wiring);
   (b) the staging-cache race forced by interleaving (one file rejects,
   a sibling's `staging.put()` lands after `caches.delete`) → the stray
   cache is swept on the next successful refresh.
6. Backend: `restartOrchestrator({packPath})` and flow 32 (R-H5). Run it
   on the rig's toy leg: the shared arms are up under `/tmp/rung1`; the
   Tier L legs self-provision their engine; never stop the shared arms.
   Rebuild `dist` first (`backend/public/gm-scanner` symlinks to it).

## Runs before your report (fresh; paste the last lines)

Scanner: `npm test`, `npm run coverage:check`, `npm run lint`,
`npm run test:e2e`, `npm run build`. Backend: `npm test` (the contract
suite must still see `MESSAGE_TYPES` untouched), flow 32 on the toy
leg. Check `df -h /` before and after any run that spawns an
orchestrator.

## Completion criterion

Every deliverable has a commit; every red-first seam went red on the
old code and green on the new (say how you saw red); the 192 baseline
tests plus the new ones pass; `MESSAGE_TYPES` and the contracts are
unchanged; `sw.js:24` still exempts `aln-pack-*`; the diff touches no
file the shared-file rules reserve.

## Report

Write `.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-lane-report.md`:
status, commits (scanner and backend), what went red and how, the run
tails, any ruling you had to make, concerns. Return to the orchestrator
only: status, commits, one-line test summary, concerns.
