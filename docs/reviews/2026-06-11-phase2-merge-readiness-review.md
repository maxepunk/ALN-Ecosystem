# Phase 2 Merge Package — Independent Merge-Readiness Review

**Date:** 2026-06-11
**Reviewer:** independent session (per protocol in `docs/pr-drafts/2026-06-11-phase2-merge-prs.md`: nothing merges until a session other than the authoring one has reviewed each PR)
**Scope:** all five PRs in the package, reviewed at the SHAs pinned by the parent branch:

| PR | Repo | Branch | Head SHA | Verdict |
|----|------|--------|----------|---------|
| #1 | ALN-TokenData | `claude/phase2-token-schema` | 0ee77cd | **READY** |
| #10 | ALNScanner | `claude/phase2-domain-split` | e43a919 | **READY-WITH-NOTES** |
| #5 | ALNPlayerScan | `claude/phase2-es6-modules` | 5f99f16 | **READY-WITH-NOTES** (2 majors should be fixed first) |
| #6 | arduino-cyd-player-scanner | `claude/review-fix-batch` | 2f0fb50 | **READY-WITH-NOTES** (hardware merge gate stands) |
| #17 | ALN-Ecosystem (parent) | `claude/game-system-review-refactor-jbk05w` | f74c445 | **NOT-READY yet — CI red; 2 trivial blockers + 3 majors** |

**Method:** five parallel deep-review agents (one per submodule PR; parent PR split
into backend-refactor and E2E-harness/infra scopes), each re-running test suites
independently where the environment allowed, reviewing diffs against the intent
docs (`docs/reviews/2026-06-platform-review/`, `docs/decisions/2026-06-*`,
SCORING_LOGIC.md), plus direct verification of branch-state facts, CI logs, and
production tokens.json by the orchestrating session.

## Independently verified evidence

- Branch-state facts from the protocol doc confirmed: all branches 0 behind
  their mains except ALNScanner (1 behind = the PR #9 merge-commit object only;
  `git merge-tree` shows 0 conflicts). Parent branch pins all four submodules at
  exactly the PR branch tips.
- **Backend unit + contract: 2068/2068 tests, 109 suites, 0 skips/todos** (re-run
  in a clean checkout). The previously quarantined system-reset integration test
  is genuinely un-quarantined with a root-cause fix (sibling test's fixed sleep),
  not hidden.
- **Backend integration: 336/336 tests, 36 suites** (re-run, ~4 min).
- **GM Scanner: 1364/1364 tests, coverage ratchet pass, lint pass, production
  build pass** (re-run).
- **Player Scanner: 141/141 tests, lint pass** (re-run). `jest --coverage` FAILS
  (see PR #5 MAJOR-3).
- **ESP32: 120/120 native tests, 8/8 suites** — `pio` registry blocked in the
  sandbox; reproduced byte-equivalent native env via g++ with identical flags +
  real ArduinoJson 7.4.2 / Unity 2.6.0.
- **Tier L E2E (CI, run 27381966217): 112 passed / 0 failed / 58 capability-gated
  loud skips** — matches the PR claim.
- **Production tokens.json (81 tokens) validates clean** against the new
  tokens.schema.json (manual rule-by-rule validation). Confirms the content
  note: the only live group is single-member `Marcus Mention (x1)` — no
  completable group exists in live data.

---

## PR #17 (parent) — blockers and majors

CI on head f74c445 is **red**: `Backend Unit + Contract Tests` fails at the
lint step, and that failure currently masks a second gate failure behind it.

### BLOCKER B1 — ESLint errors (CI fails before tests run)
- `backend/tests/integration/reconnection.test.js:129` and `:170` — `no-void`
  (`void gm1.initialSync;`)
- `backend/tests/unit/e2e-harness/page-object-consistency.test.js:65` —
  `no-regex-spaces` (`/^  (?:async )?/` → `/^ {2}(?:async )?/`)

Three one-line fixes.

### BLOCKER B2 — coverage gate fails once lint is fixed
`npm test -- --coverage` exits 1: `src/services/tokenService.js` branches
92.59% vs committed 95% threshold. Cause: the new `TOKENS_PATH` injection
branch (`tokenService.js:75`) is never exercised by unit/contract tests (plus
the data-dependent >350-char summary-truncation branch). CI runs both
`--coverage` and `coverage:check`, so this WILL fail CI after B1 is fixed.
**Fix: add a unit test setting `TOKENS_PATH` (and/or a long-summary truncation
test). Do not ratchet the threshold down.**

### MAJOR P17-M1 — session lifecycle writes bypass the F-BCORE-07 write queue
`sessionService.js` adds `_writeQueue` and routes `saveCurrentSession()`
through it, but `createSession()` (~173), `updateSession()` (~320), and
`endSession()` (~421) still call persistence directly. A queued
transaction-persist write in flight during `endSession()` can land after the
ended-status write — older-snapshot-wins; on restart an ended session could
resurrect as active. Small window, but this is live-event restart correctness
and F-BCORE-07 is one of the PR's own headline fixes — currently half-applied.
Fix: route all three through the queue (`endSession` must snapshot before
nulling `currentSession`).

### MAJOR P17-M2 — bootstrap hook installs an UNSCOPED global credential helper
`.claude/hooks/session-start.sh:46-49` echoes `password=$TOKEN` for every host
git contacts — a modified `.gitmodules` URL or any non-GitHub remote fetch
would receive the fine-grained PAT. The hook auto-runs on every future web
session once merged to main. One-line fix: scope as
`git config --global credential.https://github.com.helper '...'`.
(Hook is otherwise clean: web-session-gated, idempotent, no destructive git
ops, refuses to move diverged branches, push preflight is `--dry-run` only.)

### MAJOR P17-M3 — no-fixed-sleeps lint is bypassable; two unannotated racy sleeps exist today
The rule restricts only the `waitForTimeout` property in `tests/e2e/flows/**`.
`07d-04-admin-environment-control.test.js:352` and `:438` use bare
`new Promise(r => setTimeout(r, 1500))` settles with comments admitting
they're racy. Fix: extend the lint rule and convert the two settles to
condition polls.

### Parent-PR minors (follow-up, non-blocking)
- `waitForEvent` (`tests/helpers/websocket-core.js:151-154`) leaks listeners on
  timeout; two diverging `waitForEvent` implementations coexist; stale
  cache-era comments contradict the 2.x.3 redesign.
- Two call sites in `22-player-video-lifecycle.test.js` (150→158, 267→270)
  register the listener after the triggering action — the exact race the
  redesign bans (Tier H only, fails loud).
- Fixture pack is not schema-validated (only production tokens.json is);
  TOKENS_PATH failure modes log quietly (suggest WARN banner when active).
- Hook appends duplicate lines to `CLAUDE_ENV_FILE` on every SessionStart fire.
- `sessionService.archiveOldSessions()` calls nonexistent
  `session.isCompleted()` (pre-existing dead code — TypeError if ever invoked).
- `offlineQueueService.processQueue()` drains GM queue during paused/setup
  sessions as `processed` (currently unreachable; hazard if D2 reconnect path
  is ever wired).
- `teamScoreStash` leak in `broadcasts.js` when persistence listener
  early-returns (bounded, cosmetic).
- Contract-test example batchId `'SCANNER_001_0'` predates the ESP32 nonce
  format (passes — schema unconstrained — but drifts from real firmware
  output).
- CI nits: ALNScanner `npm ci` not in setup-node cache; `retries: 2` can mask
  Tier L flakes; `scripts/requirements.txt:5` references a deleted script.
- Group-completion parity backend↔scanner: core rules agree (blackmarket-only,
  min-2-token). Cosmetic divergences: bonus base = catalog values (backend) vs
  recorded tx points (scanner) — differs only if token values change
  mid-session; backend records `completedGroups` for x1 groups, scanner
  doesn't (no scoring impact).

### Refactor claims — all verified real (backend scope)
session.scores single canonical store (no residual score copies; atomic
dup-check→claim; A3 reset semantics exact); gameRules/ purity confirmed;
cueEngine facade with E1 mark-don't-fire restore; audioRouting facade
(awaited-write, op serialization, refcounted ducking); all 10 DomainState
schemas present and contract tests validate live producer output; dead events
fully gone from backend AND both scanner submodules; ProcessMonitor
spawn-error handler empirically prevents the ENOENT crash; scoreboard
socket.io served locally (works without internet); gm:command:ack exactly
`{action, success, message}` at all three emit sites; sync:full contains all
nine claimed sections.

---

## PR #1 — ALN-TokenData: READY

Single additive schema file; no runtime impact. All 81 production tokens
validate. Schema honestly documents the SF_Group microformat as v1 with v2
deferred to Phase 3/A1. No findings.

Note for the re-pin step: the nested `data` gitlinks inside ALNScanner and
aln-memory-scanner still pin the pre-schema ALN-TokenData main (15d8d2e).
Harmless (schema is additive) but decide whether the re-pin commit should bump
nested pins too, for consistency.

## PR #10 — ALNScanner: READY-WITH-NOTES

All 15 fix commits verified faithful to their cited findings (A1, A7, C7, C1,
B9) with genuine regression tests. Structural split mechanically confirmed
wiring-only: identical event-case sets in message routing, same 10 store
subscription domains, zero dropped app.js methods, all 61 `data-action`
bindings resolve, byte-identical id/data-action surfaces in index.html.
Standalone group completion (`length > 1`) exactly matches backend and
SCORING_LOGIC.md.

- **MAJOR (pre-existing, fast follow-up before next live event):** unescaped
  NFC-controlled tokenId in attribute context —
  `src/ui/renderers/GameOpsRenderer.js:476`
  (`data-token-id="${tokenId}"`). Same hostile-NFC threat model as the
  F-GMS-04 sites this PR fixed; carried verbatim from main (not a regression;
  not on the F-GMS-04 flagged list). One-line `escapeHtml` fix.
- MINOR (pre-existing, same family): `GameOpsRenderer.js:103` (group toast,
  raw teamId/groupId), `:255-256` (raw adjustment reason/gmStation) —
  text-node context only.
- MINOR: duplicate-verdict repaint can overwrite an unrelated fresh scan's
  result screen after offline-queue replay (compare displayed RFID first).
- MINOR: `messageRouters.js:191-193` comment claims `session:overtime`
  handling it doesn't do (behavior unchanged; comment wrong).
- **Deploy reminder:** `dist/` is gitignored. After the submodule pointer bump,
  the Pi (and any E2E run) MUST `cd ALNScanner && npm run build` or it silently
  serves the pre-PR scanner.

## PR #5 — ALNPlayerScan: READY-WITH-NOTES — fix the two majors first

Queue 4xx/5xx semantics, module extraction (UMD preserved, script order,
globals), mode detection, deviceId persistence, img.onerror wiring: all
verified good. The P0 requeue-forever and 409-requeue bugs are genuinely
fixed. Contract test covers the new batchId payloads accurately.

- **MAJOR PS-1 (fix before merge — silent scan loss):** stable `batchId` is
  reused while batch composition mutates. `orchestratorIntegration.js:207-213`
  rebuilds the retry batch via `splice(0, 10)`; a scan queued between a
  lost-response send and the retry rides under the already-processed batchId;
  backend idempotency cache (`scanRoutes.js:217-224`, keyed on batchId alone)
  returns the cached response; client sees ok → clears queue → **new scan
  silently lost**. The pre-PR behavior produced a duplicate (benign for
  player scans) where this produces a loss. Fix: persist the pending batch
  CONTENTS alongside the id; resend exactly that snapshot until resolved.
- **MAJOR PS-2 (fix before merge — headline fix inert in production):** the SW
  API branch (`sw.js:97`, `url.href.includes(':3000')`) shadows the new
  tokens.json network-first-with-cache-fallback branch (`sw.js:121`) for ALL
  same-origin URLs in networked deployments (scanner is served from port
  3000). Offline reload → 503 with no cache fallback → app degrades to the
  built-in test token. Fix: order the tokens.json branch first, or scope the
  API branch to `/api/`+`/health` paths.
- **MAJOR PS-3:** advertised coverage ratchet is broken — `jest --coverage`
  deterministically exits 1 (`jest.config.js` threshold for `js/app.js`, but
  tests load app.js via `fs.readFileSync`+`eval`, so no coverage data exists);
  no `coverage:check` script despite the commit description. CI only runs
  `npm test`, masking this.
- MINOR: SW tokens.json fallback covers network rejection but not HTTP error
  responses (404/500 → returned as-is instead of cached copy); no reentrancy
  guard on `processOfflineQueue` + batch fetch has no timeout (same umbrella
  fix as PS-1); partial batch failures logged as full success (inspect
  `failedCount`); `if (!response)` guard unreachable in real browsers.

## PR #6 — arduino-cyd-player-scanner: READY-WITH-NOTES

409 classification keys on exactly the two real backend 409 body shapes
(verified against `scanRoutes.js` and openapi.yaml oneOf); malformed/partial
bodies fail safe to queue (duplicate-tolerant, never loss); single bounded
attempt confirmed on the scan path; batch-id nonce buffer math sound and
contract-accepted; counter still advances only on success. No double-queue
path; JSON properly escaped via ArduinoJson; overlay geometry fits the TFT.

- **MAJOR ESP-1 (owner decision at the smoke test):** on `REJECTED_NO_SESSION`
  the firmware shows SCAN_FAILED and never displays the token's local
  image/audio — conflicts with decision A5's bullet "local content display is
  unaffected in all cases" (while matching A5's other bullet about reusing the
  failure screen). Practically bites only pre/post-game. Bless explicitly or
  keep the content display with the failure as overlay.
- **MAJOR ESP-2 (record-keeping):** what shipped is the parity-audit's
  bounded-synchronous variant (~10s worst-case main-loop block), not the
  "async send" the TRIAGE index line for F-PARITY-06 says. Acceptable;
  correct the record.
- MINOR: nonce RNG sampled pre-WiFi (bootloader-seeded; negligible risk —
  lazy generation at first upload is cheap hardening); reboot-window
  retry now duplicates instead of losing (correct trade, worth a comment);
  serial-command path duplicates the outcome switch (drift risk).
- **MERGE GATE (unchanged from protocol): owner flashes a CYD and runs a
  boot + scan smoke test.** Native tests cannot prove TLS timing, real RNG
  entropy, or TFT rendering.

---

## Recommended sequence to green

1. On the parent branch: fix **B1** (3 lint one-liners) + **B2** (TOKENS_PATH
   unit test) + **P17-M2** (scope the credential helper — one line) +
   **P17-M1** (route 3 lifecycle saves through the write queue) + **P17-M3**
   (lint rule + 2 settle conversions). Push; confirm all CI jobs green.
2. On ALNPlayerScan branch: fix **PS-1** (pending-batch snapshot) and **PS-2**
   (SW branch order); PS-3 (remove or repair the dead coverage threshold).
   Re-run `npm test`.
3. Merge the four submodule PRs (any order). PR #6 merges at/with the owner's
   CYD flash smoke test (decide ESP-1 while there).
4. Re-pin commit on the parent branch (decide nested-data-pin question);
   re-review the re-pin as part of PR #17 per protocol; merge #17 last.
5. Post-merge: Pi pulls main, `cd ALNScanner && npm run build`, then
   `npm run test:e2e:tier-h`.
6. Fast follow-up before the next live event: GM scanner escaping batch
   (GameOpsRenderer.js:476 + the two text-node sites).
