# The credentials lane — every connection presents a verified credential (implementer brief)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §4 (alarm integrity), §6 (identity and attribution: the
observe token). Model: Opus. You dispatch no subagents; review arrives
from the orchestrator after your report.

## What this buys, and for whom

The system loop. Tonight the server trusts a word the client says about
itself at the handshake: a socket that says it is a GM station is
checked for a credential; a socket that says anything else is let in
with no credential at all. The same self-declared word then decides the
admin-command gate, the sync-request handler, the device record and the
device list the GM sees; the scoreboard's exemption from the
"same station id twice" check keys on its id starting with
`SCOREBOARD_`, another self-declared fact. After this task every socket
presents a verified credential at the handshake or is refused there,
and the VERIFIED credential's class (operator or display) decides every
gate, label and exemption. Show-night behavior that changes: a device
with no credential gets a `connect_error` at once; the GM's device list
labels the two scoreboard displays "Display" instead of "Admin" (a
label for a client that does not exist); the scoreboard keeps working
exactly as today. Stated plainly: the observe credential is not
private; it is mintable by any client on the kit network that loads
the scoreboard page.

## Where you work

The worktree `.worktrees/credentials` on branch
`claude/nice-curie-hescfv-credentials`, cut from the designated branch
`claude/nice-curie-hescfv` by the orchestrator after the harness
minimum merged; its `ALNScanner/` submodule is checked out on the
ALNScanner branch of the same name. Backend, the scanner's connection
files, the scoreboard page, the contracts, the test helpers. Never
touch `ALN-TokenData/` or another worktree. Push nothing. Commit per
seam with a message naming the pin; backend and scanner commits
separate.

Shared-file rules (plan §1 R15; the supervisor and self-heal lanes
build in parallel; you merge FIRST):
- `backend/contracts/asyncapi.yaml`: the handshake section only (the
  auth object near line 30 and any handshake schema); never the
  `action` enum or the domain-state schemas.
- `backend/src/websocket/gmAuth.js`: the `sync:request` getter line
  and the lines that record the station type (68, 80, 199) only; add
  no room join (the wiring step owns the `show-control` room).
- `ALNScanner/src/network/connectionManager.js`: the auth payload only
  (the config default at line 28 and the payload at 147); the
  self-heal lane edits `_doConnect`'s collision retry (178–199), a
  different function, and rebases on your merge.
- `ALNScanner/src/network/orchestratorClient.js`: the auth payload
  only (71, 95).
- `backend/src/websocket/socketServer.js` is yours in full.

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-factsheet.md`
(§1 handshake; §2 observe tokens; §3 `sync:request`; §4 every client;
§5 the `admin` occurrences; §6 the three tests; §7 the scoreboard E2E
flows), plus the consumer list below, grepped 2026-09-12:
- Server consumers of the self-declared type: `socketServer.js:53`
  (the gate), `:85` (`isScoreboard = deviceId.startsWith('SCOREBOARD_')`),
  `:117` (functions stamped); `server.js:123`
  (`socket.deviceType === 'gm'`); `websocket/adminEvents.js:32`
  (`AUTH_REQUIRED` when not `'gm'`), `:113`; `websocket/broadcasts.js:653-654`
  (device list `type` and the label `'GM Station'`/`'Admin'`);
  `websocket/gmAuth.js:68, 80, 199`; `models/deviceConnection.js:229`.
- What a verified token carries (fact sheet §1): `tier`, `class`,
  `functions`, `deviceId`, `packHash`; an observe token is tier
  `device`, class `display`, functions exactly `['observe']`
  (`middleware/auth.js:130-150`).
- Clients that send the word: `ALNScanner/src/network/connectionManager.js:28,147`,
  `orchestratorClient.js:71,95`, `backend/public/scoreboard.html:1564`.
- Test helpers that carry it: `tests/helpers/websocket-helpers.js:79-161`
  (`connectAndIdentify(url, deviceType, deviceId)`),
  `tests/helpers/websocket-core.js:30,56` (`connectWithAuth(baseUrl,
  password, deviceId, deviceType, options)`),
  `tests/helpers/integration-test-server.js:73-91,153` (a dead
  `admin` fake-auth branch), `tests/e2e/setup/websocket-client.js:99`.
- Contract and doc mentions: `asyncapi.yaml:30`, `openapi.yaml:88`,
  `backend/backend_docs/WEBSOCKET_QUICK_REFERENCE.md:54`,
  `ALNScanner/CLAUDE.md` (the handshake paragraph).
- A DIFFERENT field with the same name stays untouched: the scan and
  transaction record's `deviceType` (`gm | player | esp32`, which
  kind of scanner produced a scan): `models/transaction.js`,
  `services/transactionService.js`, `services/commandExecutor.js:554`,
  `ALNScanner/src/app/domains/gameOps.js:342`,
  `src/core/storage/NetworkedStorage.js:143`, the HTTP scan routes.
- `sync:request` mutation: `session.getDeviceScannedTokens()`
  (`models/session.js:380-387`) writes an empty array; the non-mutating
  twin `getDeviceScannedTokensArray()` (`:421-423`); three call sites
  `server.js:94`, `tests/helpers/integration-test-server.js:124`,
  `gmAuth.js:151`.

## The pin (plan §3 P15 as amended by rulings R5 and R19)

Every connection presents a verified operator or observe token at the
handshake; the handshake carries no station type; the verified
credential class decides every gate, label and exemption; the
scoreboard's collision exemption keys on the display class, not on a
name prefix; `sync:request` stays open to any credentialed socket and
uses the non-mutating getter; the contract's `admin` value and the
handshake `deviceType` field are removed on both sides. The
eviction-per-deviceId clause is dropped (R19). `/health` is untouched.

## Deliverables, each red-first at its seam

1. **Contract first.** `asyncapi.yaml`: the handshake auth object is
   `{token (required), deviceId (required), version (optional),
   packHash (optional)}`; `deviceType` and `admin` gone; the
   `connect_error` messages listed: `AUTH_REQUIRED: Token required`,
   `AUTH_REQUIRED: deviceId required`, `AUTH_INVALID: <reason>` (use
   the existing invalid-token message text as it is today), and the
   existing collision message. Same fix in `openapi.yaml:88`,
   `WEBSOCKET_QUICK_REFERENCE.md:54`, the `ALNScanner/CLAUDE.md`
   handshake paragraph. Commit this first, alone.
2. **The handshake.** In `socketServer.js` the credential block runs
   for every connection: (a) missing token → `AUTH_REQUIRED: Token
   required`; (b) missing `deviceId` → the existing refusal;
   (c) operator token, else observe token, as today; (d) the socket's
   identity fields come from the VERIFIED claims only (`tier`, `class`,
   `functions`, `deviceId`, `packHash`); nothing is copied from the
   handshake except `deviceId`, `version` and `packHash`; (e) the
   collision check applies to operator-class sockets; display-class
   sockets are exempt (the `SCOREBOARD_` prefix test is deleted);
   (f) a handshake that still sends `deviceType` is accepted and the
   field is never read. Red-first (unit,
   `tests/unit/websocket/socketMiddleware.test.js`): tokenless →
   `connect_error`; operator token with a handshake `deviceType:
   'player'` connects as an operator (the word carries no meaning);
   observe token connects with the read-only claims; two display-class
   sockets with the same `deviceId` both connect; two operator sockets
   with the same `deviceId` trip the collision rule as today. The
   existing case "should allow non-GM connections without
   authentication" is rewritten into the first of these.
3. **Every server consumer switched to the class.** `server.js:123`,
   `adminEvents.js:32` and `:113`, `broadcasts.js:653-654` (label
   `'GM Station'` for operator class, `'Display'` for display class),
   `gmAuth.js:68, 80, 199`, `deviceConnection.js:229`. Red-first: an
   observe socket issuing `gm:command` is refused by class; the device
   list labels a display `'Display'`; the scoreboard occupies no
   station slot (visible-change item 13 stays true).
4. **`sync:request` never writes.** The three call sites use
   `getDeviceScannedTokensArray()` (wrapped in `new Set(...)` where a
   Set is consumed). Red-first: a `sync:request` from a socket whose
   deviceId has no entry leaves `session.metadata.scannedTokensByDevice`
   without that key.
5. **The clients stop sending the word.** `connectionManager.js:28,147`
   and `orchestratorClient.js:71,95` (scanner unit tests updated;
   any scanner contract test that pins the handshake shape updated);
   `scoreboard.html:1564`. Rebuild `dist`.
6. **The helpers and the three named tests.** `connectAndIdentify` and
   `connectWithAuth` lose their `deviceType` parameter and every
   caller is updated (grep; leave no ignored parameter behind); the
   dead `admin` branch in `integration-test-server.js` is removed and
   its handshake mirrors deliverable 2; `admin-interventions.test.js:711-716`
   expects `connect_error`; `room-broadcasts.test.js:81` becomes an
   observe-token socket and asserts what the code does for it (say in
   the report what an observe socket receives).
7. **The scoreboard and the scanner keep working end to end.** Flows
   `tests/e2e/flows/23-scoreboard-live-data.test.js`,
   `24-scoreboard-restart-recovery.test.js`, and the scanner-driven
   flows `07b`/`07c` pass on the rig (production leg); the scanner's
   own `npm run test:e2e` passes. The rig's shared arms are up under
   `/tmp/rung1`; take `/tmp/rung1/e2e.lock` with `flock` before any
   E2E or Tier L run (the other lanes share the rig); never stop the
   shared arms.

## Runs before your report (fresh, in this order; paste the last lines)

Backend: `npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; the four E2E flows above. Scanner (in the
worktree's `ALNScanner/`): `npm test`; `npm run coverage:check`;
`npm run lint`; `npm run test:e2e`; `npm run build`. Check `df -h /`
before and after any run that spawns an orchestrator.

## Completion criterion

Every deliverable has a commit; every red-first seam went red on the
old code and green on the new (say how you saw red); `grep -rn
deviceType` over `backend/src/websocket`, `backend/src/server.js`,
`backend/src/models/deviceConnection.js`, the scanner's `network/`
directory, the scoreboard page and the contracts' handshake section
returns nothing; the scan-record field is untouched; the diff touches
no file outside the lists above.

## Report

Create `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-lane-report.md`
at the start and extend it as you go: status, commits (backend and
scanner), what went red and how, the run tails, what an observe socket
receives, concerns. Return to the orchestrator only: status, commits,
one-line test summary, concerns.
