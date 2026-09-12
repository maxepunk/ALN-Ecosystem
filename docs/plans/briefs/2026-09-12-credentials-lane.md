# The credentials lane — every connection presents a credential (implementer brief)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §4 (alarm integrity). Model: Opus. You dispatch no
subagents; review arrives from the orchestrator after your report.

## What this buys, and for whom

The system loop. Tonight any socket that says it is not a GM station
connects with no credential at all: no token check, no claims, and the
server treats it as a guest. The GM's instruments (health, preflight,
the show-control verbs) are meant to be seen only by credentialed
stations. After this task every socket presents a verified credential
at the handshake or is refused there, and a display's reconnect stops
writing into the session's per-device scan map. Show-night behavior
that changes: a tablet or display with no credential gets a
`connect_error` at once instead of a half-connected socket; the
scoreboard keeps working exactly as today (it already sends a
credential). Stated plainly: the observe credential is not private; it is
mintable by any client on the kit network that
loads the scoreboard page.

## Where you work

The worktree `.worktrees/credentials` on branch
`claude/nice-curie-hescfv-credentials`, cut from the designated branch
`claude/nice-curie-hescfv` by the orchestrator after the harness minimum
merged. Backend only (`backend/`) plus the contract prose. Never touch
`ALNScanner/`, `ALN-TokenData/`, or any other worktree. Push nothing.
Commit per seam with a message naming the pin.

Shared-file rules (plan §1 R15 — other lanes build in parallel):
- `backend/contracts/asyncapi.yaml`: edit ONLY the handshake description
  prose near line 30 (`deviceType`). Do not touch the `action` enum or
  any schema block.
- `backend/src/websocket/gmAuth.js`: edit ONLY the `sync:request`
  getter line (~151). Add no room join; the `show-control` room belongs
  to the wiring step after the lanes merge.
- `backend/src/websocket/socketServer.js` is yours in full.

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-factsheet.md`:
§1 (the handshake middleware: the single `if (deviceType === 'gm')` at
`socketServer.js:53` wraps token verify, collision check and
claim-stamping; a bare `next()` at 151–152 lets every other deviceType
in unverified), §2 (observe tokens: minting at `resourceRoutes.js:205`,
cap eviction at `auth.js:145-148`), §3 (`sync:request`: the mutating
getter `session.getDeviceScannedTokens()` at `session.js:380-387`
writes an empty array into `scannedTokensByDevice`; the non-mutating
twin `getDeviceScannedTokensArray()` at `session.js:421-423`; three
call sites `server.js:94`, `tests/helpers/integration-test-server.js:124`,
`gmAuth.js:151`), §4 (every socket client: the GM scanner and the
scoreboard both send `deviceType: 'gm'`; the scoreboard at
`public/scoreboard.html:1564` relies on the `verifyObserveToken`
fall-through at `socketServer.js:71-73`), §5 (`admin` has no sender:
prose in `asyncapi.yaml:30`, `openapi.yaml:88`,
`backend/backend_docs/WEBSOCKET_QUICK_REFERENCE.md:54`; JSDoc in `websocket-core.js:24`
and `tests/e2e/setup/websocket-client.js:99`; a dead fake-auth branch in
`tests/helpers/integration-test-server.js:75,91`), §6 (the three tests
that pin the open door, with their current counts), §7 (the scoreboard
E2E flows 23 and 24 that must keep passing).

## The pin (plan §3 P15, ruling R5)

The handshake requires a verified operator or observe token AND
`deviceType: 'gm'`; any other deviceType is refused (no production
client sends one; the contract's `admin` value is removed — the fact
sheet's grep proves no sender). The whole identity block leaves the
`if` branch; only the collision check stays GM-station-scoped.
`sync:request` stays open to any credentialed socket and uses the
non-mutating getter. `/health` is untouched by this lane.

HELD, not in this brief: "observe tokens evict per deviceId". The fact
sheet (§2, conclusion 6) shows every observe token today carries the
same literal `deviceId: 'SCOREBOARD'`, so per-deviceId eviction as
written would evict every other display on each page load. The owner
decides; do not implement any eviction change.

## Deliverables, each red-first at its seam

1. **Contract first.** `asyncapi.yaml` handshake prose: `deviceType`
   is `"gm"` only; the `"admin"` mention goes. Same prose fix in
   `openapi.yaml:88` and `backend/backend_docs/WEBSOCKET_QUICK_REFERENCE.md:54`; the JSDoc
   at `websocket-core.js:24` and `tests/e2e/setup/websocket-client.js:99`;
   the dead `admin` fake-auth branch in
   `tests/helpers/integration-test-server.js` removed. Commit this
   first, alone.
2. **The handshake.** In `socketServer.js` the credential block runs
   for every connection. Order: (a) `deviceType !== 'gm'` → refuse with
   `connect_error` message `AUTH_REQUIRED: deviceType must be gm`;
   (b) missing token → the existing `AUTH_REQUIRED: Token required for GM stations`
   refusal; (c) missing `deviceId` → the existing refusal; (d) operator
   token, else observe token, as today; (e) the collision check for GM
   stations as today (the scoreboard exemption unchanged); (f) claims
   stamped as today. The bare `next()` for other device types is gone.
   Red-first (unit, `tests/unit/websocket/socketMiddleware.test.js`):
   tokenless → `connect_error`; operator token + `deviceType: 'player'`
   → `connect_error` with the message above; observe token +
   `deviceType: 'gm'` connects with the read-only claims; operator token
   + `deviceType: 'gm'` connects as today. The existing case titled
   "should allow non-GM connections without authentication" (§6, line
   98) is rewritten into the first of these, not deleted.
3. **`sync:request` never writes.** The three call sites use
   `getDeviceScannedTokensArray()` (wrapped in `new Set(...)` where a
   Set is consumed). Red-first: a `sync:request` from a socket whose
   deviceId has no entry leaves `session.metadata.scannedTokensByDevice`
   without that key (assert on the session object; unit or integration,
   your call, say which in the report).
4. **The two integration tests.** `admin-interventions.test.js:711-716`:
   the unauthenticated socket now expects `connect_error` (it awaits
   `connect` today and would hang). `room-broadcasts.test.js:81`: the
   `'player'` socket is refused after this change; rewrite the case to
   an observe-token socket with `deviceType: 'gm'` and assert what the
   code does for it (§1/§7 say which rooms an observe socket joins); if
   an observe socket legitimately receives the broadcast the test was
   isolating, say so in the report and assert that instead.
5. **The scoreboard keeps working.** Flows
   `tests/e2e/flows/23-scoreboard-live-data.test.js` and
   `24-scoreboard-restart-recovery.test.js` pass on the rig (production
   leg). The rig's shared arms are up under `/tmp/rung1`; boot the engine
   with `backend/tests/rung1/engine.sh start` and stop it after; never
   stop the shared arms.

## Runs before your report (fresh, in this order; paste the last lines)

`cd backend && npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; the two scoreboard flows above. Check
`df -h /` before and after any run that spawns an orchestrator.

## Completion criterion

Every deliverable has a commit; every red-first seam went red on the
old code and green on the new (say how you saw red); the three tests
in §6 run with their new counts; the fact sheet's `admin` grep returns
only history; the diff touches no file outside the lists above.

## Report

Write `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-lane-report.md`:
status, commits, what went red and how, the run tails, deliverable 4's
finding about the observe socket, concerns. Return to the orchestrator
only: status, commits, one-line test summary, concerns.
