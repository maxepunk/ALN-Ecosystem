# The self-heal lane — the scanner's pack self-heal and the two owed tests (implementer brief, revision 2: three tasks)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops; activation; shim; benign emptiness), §5 (the pack
channel). Model: Opus. You dispatch no subagents; review arrives from
the orchestrator after each task's report. Revision 2 folds in the
plan-and-brief review of 2026-09-12 (scratch `self-heal-lane-review.md`)
and cuts the lane into THREE tasks, run in order in the same worktree,
each reviewed before the next starts. The dispatch names your task:
**Task A** (deliverables 1, 2, 5), **Task B** (3, 4), **Task C** (6).

## What this buys, and for whom

The GM's loop, on Thursday night. New tokens sync from Notion, the
orchestrator restarts with the new pack, and today every GM tablet
keeps scoring with the OLD rules until someone reloads it by hand: the
server warns about the hash mismatch and nothing on the tablet reads
that warning. After this lane the tablet notices the mismatch on the
first `sync:full` of a connection, heals itself at a safe moment (no
active session, or a session with no transactions yet), shows one toast
"Rules updated to <version>", and reconnects with the new hash;
mid-session it shows a banner and heals at the next safe moment; if the
new pack cannot be applied it shows a blocking screen with a plain
instruction instead of scoring with the wrong rules. One caveat the
review found: the orchestrator's login tokens live in its memory, so
after an orchestrator restart every tablet must log in again through
the connection wizard before it can heal — that is today's behavior and
stays; the heal happens on the first `sync:full` after that login. The
two tests the roadmap owes (a real timeout, the staging-cache race)
land here.

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
- `ALNScanner/src/network/connectionManager.js`: your edit is
  `_doConnect`'s collision retry (178–199) only; the credentials lane
  edits the auth payload (lines 28, 147) and merges before you — rebase
  on it.
- `ALNScanner/index.html`: your additions are the banner and backstop
  markup only; the panel lane edits the same file after your merge.
- `ALNScanner/src/utils/domEventBindings.js`: not yours (supervisor
  lane) — wire the backstop's Reload button as `data-action="app.reloadForPack"`;
  the delegation switch already routes the `app` target (:261-300).
- `ALNScanner/src/ui/renderers/HealthRenderer.js`, `AdminOperations.js`:
  not yours (supervisor lane).
- `backend/tests/e2e/setup/test-server.js`: only `restartOrchestrator`
  gains a `packPath` option (build on the merged harness minimum).
- `backend/tests/helpers/websocket-core.js`: untouched.

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-factsheet.md`,
read in full before the first edit, corrected and extended by the review:
- `src/core/packLoader.js` (457 lines) exports only `loadPack()`
  (130-182); no `refresh` exists. `_stagedRefresh()` (210-286) flips the
  `aln_pack_active` pointer and GCs old caches (263-269, `_deleteOtherPackCaches`
  288-297) as soon as its own checks pass; stage failures return null
  with the active pack untouched (272-285). `_active` (the loader's
  identity) is set only in `_activate()` (426-431) and is read by the
  handshake (`orchestratorClient.js:88-102`) and by `renderPackInfo()`
  (`initializationSteps.js:238-259`). `FETCH_TIMEOUT_MS = 8000` is a
  module constant (:46); the constructor injects only fetch, caches,
  storage, sha1 and pathname (80-94); `AbortSignal.timeout` ignores
  Jest fake timers.
- `src/core/tokenManager.js` `loadDatabase()` (50-116) is the only
  apply entry point; it always calls `loadPack()` again; its ONLY
  refusals are `schemaVersion` (60-66, `PACK_SCHEMA_VERSION = 2`) and an
  unusable token map; apply-time throws are caught into `return false`
  (106-115). Absent scoring, modes, strings, theme and undeclared groups
  WARN by design and load continues (`scoring.js:64-79` LEGACY SHIM;
  `modeSemantics.js:84-92, 375-392`; CONTEXT §2 shim and benign
  emptiness); three green tests pin that (`tokenManager.test.js:111,
  127-141, 186-196`).
- The operator's mode is validated once at startup only
  (`initializationSteps.js:276-287` `validateSettingsMode`, called from
  `app.js:126`); a mode the pack does not declare makes `resolveMode`
  return null (`modeSemantics.js:235-237, 273-277`) and the backend then
  accepts scans and pays 0 as `unknown-mode` (`transactionService.js:243-256`).
  The DOM projections `applyPackStringsToDom()` / `applyThemeColorsToDom()`
  run only at initialization (`initializationSteps.js:160-164, 177`).
- `sync:full.pack = {packId, version, contentHash}` is on the wire
  (`syncHelpers.js:150`); nothing client-side reads `payload.pack`. The
  router's `sync:full` case is `messageRouters.js:92-155`;
  `handleSessionBoundary()` at 94, `setTransactions(payload.recentTransactions)`
  at 105 and `updateSessionState()` at 119-123 overwrite the facts the
  boundary predicate needs — read them first. The router's services
  object carries only client, connectionManager, queueManager and
  adminController (`networkedSession.js:141-165`); `_messageHandler` is
  synchronous; the event-forwarding idiom is at :186-199 and
  `app.js:185-199` (`auth:required`).
- `getTransactions()` in networked mode returns the SERVER's
  `recentTransactions` for all devices (`NetworkedStorage.js:29, 354-358`),
  empty on a page's first `sync:full`.
- `connectionManager.js` retries `DEVICE_ID_COLLISION` inside its
  generic exponential backoff (178-199); `AUTH_INVALID` is terminal
  (164-176: clears the token, dispatches `auth:required`, the wizard
  blocks). The backend's admin-token store is process memory
  (`auth.js:13, 73, 91-96`): after `restartOrchestrator` every saved
  JWT is `AUTH_INVALID`; flow 24 closes the GM page for this reason
  (`24-scoreboard-restart-recovery.test.js:177-186`).
- UI: `showToast.js` auto-dismisses (36-39); no banner component; the
  blocking pattern is `ConnectionWizard`'s full-screen modal.
- `sw.js:24` exempts `aln-pack-*` from cache GC; keep it.
- Backend harness: `restartOrchestrator()` (`test-server.js:397-425`)
  ignores `options.packPath`; `startOrchestrator({packPath})` prefers the
  caller's value. The per-worker `LOGS_DIR` (harness minimum) holds the
  worker's `combined.log`; the server logs the client's `packHash` at
  connect and a `GM client pack MISMATCH` warn when it differs
  (`socketServer.js:129-146`). Fixture hashes: `toy-heist` =
  `toy-heist-require` (`sha256:966e775a…`, packId `midnight-heist`,
  modes fence/tipoff/appraise); `parity-pack` (`sha256:3d42ec85…`, modes
  blackmarket/detective). The only hash-changing pair is `toy-heist` ↔
  `parity-pack`. Flows 07b/07c drive the GM scanner in the browser.
  CORS admits only configured origins, localhost, RFC1918 and `.local`
  (`app.js:50-72`, `socketServer.js:17-40`).
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

## Orchestrator rulings on what the pin leaves open (recorded in the plan's record)

- **R-H1 Validate, then flip, then apply.** `packLoader.refresh({baseUrl})`
  stages from `<baseUrl>/api/pack/*` and returns `{staged, commit(),
  discard()}` without touching the pointer. `tokenManager` gains two
  methods extracted from `loadDatabase()`: `validatePack(pack)` — a pure
  check returning `{ok, reason}` that mirrors the apply chain's ONLY two
  refusals (`schemaVersion` = 2; a usable non-empty token map); every
  shim and benign-emptiness condition warns as today and never refuses
  (the three green tests stay green) — and `applyPack(pack)` (steps
  3–7), followed by `validateSettingsMode(settings)` with a mode-wire
  re-render (a mode id the new pack does not declare is reset, never
  silently scored zero) and the DOM projections `applyPackStringsToDom()`
  / `applyThemeColorsToDom()` re-applied. `loadDatabase()` becomes
  `loadPack()` → `validatePack` → `applyPack` (a refusal keeps today's
  `return false`). `commit()` = flip the pointer, GC, AND set `_active`
  to the staged identity with `source: 'network'`; then `renderPackInfo()`
  is re-called. A STAGE failure (network, HTTP, sha1) is not a refusal:
  `discard()`, keep the banner, re-attempt at the next connection. A
  validation refusal: `discard()` (pointer and caches untouched) and the
  backstop. An apply-time throw: the backstop, with the pointer already
  flipped and the previous cache already GC'd (stated, not tested).
- **R-H2 The boundary.** Evaluated at the top of the `sync:full` case
  before `handleSessionBoundary()`, `setTransactions()` and
  `updateSessionState()`: a boundary is the FIRST `sync:full` of a
  connection whose `payload.session` is null, OR whose
  `payload.recentTransactions` filtered to `payload.session.id` is empty
  (read from the payload, before the local list is overwritten). The
  latch is a Map keyed `${services.client.socket.id}:${serverHash}`,
  cleared on disconnect (a new connection legitimately earns a new
  attempt).
- **R-H3 The reconnect.** After `applyPack`, disconnect and reconnect
  with the new `packHash`; on `DEVICE_ID_COLLISION` wait 750 ms and
  retry once; then the normal path.
- **R-H4 The UI.** Banner: a new persistent element `#packMismatchBanner`
  (non-blocking, text `Rules changed on the orchestrator — they will
  apply when this session ends`), hidden once healed. Backstop: a new
  blocking screen `packBackstopScreen` in the ConnectionWizard idiom,
  text `The new rules could not be applied. Reload this page. If it
  happens again, restart the orchestrator.`, with one Reload button
  wired as `data-action="app.reloadForPack"`. The heal itself runs in
  App: the router compares, decides, latches, then dispatches a session
  event (the `auth:required` idiom); App performs the heal, the toast,
  the banner and the backstop.
- **R-H5 The owed backend flow.** `tests/e2e/flows/32-pack-self-heal.test.js`,
  tagged for the toy leg: start on `toy-heist`, open the GM scanner in
  the browser in networked mode, create a session and end it (a
  boundary), `restartOrchestrator({packPath: parity-pack})`, then
  re-authenticate the scanner in the browser through the connection
  wizard (the restart empties the in-memory admin-token store), and
  assert the heal on the FIRST `sync:full` of that new connection: the
  toast text; the settings pack line showing the new hash prefix; and,
  from the worker's `combined.log`, that the reconnect logged the new
  client `packHash` and emitted no fresh `GM client pack MISMATCH`
  warn. `restartOrchestrator` gains `packPath` (caller's value wins).

## Task A — deliverables 1, 2, 5 (the loader, the manager, the owed tests)

1. `packLoader.refresh({baseUrl})` per R-H1, reusing the network tier's
   code paths (no copy). Red-first: refresh stages and verifies sha1 per
   file; `commit()` flips, GCs and updates `_active` (the handshake
   value and `renderPackInfo()` read the new identity); `discard()`
   leaves pointer, caches and `_active` untouched; a divergent serving
   origin (page from the Vite dev server or a `.local` name on the kit
   network, socket to the orchestrator) fetches from `baseUrl`; a stage
   failure returns a discardable result, the active pack untouched.
2. `tokenManager.validatePack` / `applyPack`; `loadDatabase()`
   refactored onto them (the 26 existing tests stay green, including
   the three that pin warn-not-refuse). Red-first: each of the two
   refusal reasons; a pack with no scoring block validates ok (warns);
   `applyPack` on a validated pack equals today's `loadDatabase()` end
   state; after `applyPack` an undeclared operator mode is reset and the
   mode wire re-rendered; the DOM projections are re-applied.
5. The two §8.5 tests in `tests/unit/core/packLoader.test.js`: (a) a
   fetch that never resolves → `loadPack()` aborts at its timeout and
   falls through to the cache tier (behaviour, not signal wiring; add a
   `timeoutMs` constructor option to `PackLoader`, default 8000, and use
   a signal-aware fetch mock — the abort is real time); (b) the
   staging-cache race forced by interleaving (one file rejects, a
   sibling's `staging.put()` lands after `caches.delete`) → the stray
   cache is swept on the next successful refresh.

Task A gate: scanner `npm test`; `npm run test:coverage && npm run
coverage:check`; `npm run lint` (192 baseline plus the new tests).

## Task B — deliverables 3, 4 (the router, the UI, the reconnect)

3. The `sync:full` case: hash comparison, boundary predicate, latch,
   the dispatched session event; App: the heal, the toast, the banner,
   the backstop (R-H4; `index.html` gains the two elements). Red-first:
   heal at a boundary → one toast; mid-session → banner, no heal;
   second mismatch for the same hash on the same connection → no second
   refresh attempt AND the backstop still shown; a validation refusal
   leaves pointer and caches untouched and shows the backstop; a stage
   failure keeps the banner and shows no backstop.
4. The reconnect with the bounded collision retry (`connectionManager`,
   R-H3). Red-first: one collision then success; two collisions fall to
   the normal path.

Task B gate: scanner `npm test`; `npm run test:coverage && npm run
coverage:check`; `npm run lint`; `npm run test:e2e`; `npm run build`.

## Task C — deliverable 6 (the harness option and the owed flow)

6. Backend: `restartOrchestrator({packPath})` and flow 32 (R-H5). Run it
   on the rig's toy leg after a `dist` rebuild (`backend/public/gm-scanner`
   symlinks to it); take `/tmp/rung1/e2e.lock` with `flock` first; the
   Tier L legs self-provision their engine; never stop the shared arms.

Task C gate: backend `npm test` (the contract suite must still see
`MESSAGE_TYPES` untouched); flow 32 on the toy leg; `df -h /` before
and after.

## Completion criterion (per task, then the lane)

Every deliverable of the task has a commit; every red-first seam went
red on the old code and green on the new (say how you saw red); the
192 baseline tests plus the new ones pass; `MESSAGE_TYPES` and the
contracts are unchanged; `sw.js:24` still exempts `aln-pack-*`; the
diff touches no file the shared-file rules reserve.

## Report

Create `.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-lane-report.md`
at the start of Task A and extend it per task: status, commits (scanner
and backend), what went red and how, the run tails, any ruling you had
to make, concerns. Return to the orchestrator only: status, commits,
one-line test summary, concerns.
