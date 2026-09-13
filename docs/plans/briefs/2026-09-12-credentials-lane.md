# The credentials lane — every connection presents a verified credential (implementer brief, revision 3)

Read this first; it is your single source of requirements, with the
exact values to use verbatim. Vocabulary: `CONTEXT.md` §2 (one truth,
three loops), §4 (alarm integrity), §6 (identity and attribution: auth
tiers; the observe token). Model: Opus. You dispatch no subagents;
review arrives from the orchestrator after your report. Revision 3
folds in the plan-and-brief review of 2026-09-12 and its two scoped
re-reviews (scratch `credentials-lane-review.md`, `-rereview.md`,
`-rereview-3.md`).

## What this buys, and for whom

The system loop. Tonight the server trusts a word the client says about
itself at the handshake: a socket that says it is a GM station is
checked for a credential; a socket that says anything else is let in
with no credential at all. The same self-declared word then decides the
admin-command gate and the identify path; the scoreboard's exemption
from the "same station id twice" check keys on its id starting with
`SCOREBOARD_`, another self-declared fact. After this task every socket
presents a verified credential at the handshake or is refused there,
and the VERIFIED credential's TIER decides every gate and exemption:
`tier === 'operator'` (a GM tablet's login token, class `staffed`) or
`tier === 'device'` (a display's observe token, class `display`);
anything else fails closed. Show-night behavior that changes: a device
with no credential gets a `connect_error` at once; a scanner build
still sending the old word keeps connecting (the word is simply never
read); the scoreboard keeps working exactly as today and still holds
no device row (visible-change item 13); each scoreboard display's
credential now carries the id the display asked for, so the preflight
can count remote displays later (ruling R21). Stated plainly: the
observe credential is not private; it is mintable by any client on
the kit network that loads the scoreboard page.

## Where you work

The worktree `.worktrees/credentials` on branch
`claude/nice-curie-hescfv-credentials`, cut from the designated branch
after the harness minimum merged; its `ALNScanner/` submodule is checked
out on the ALNScanner branch of the same name. Backend, the scanner's
connection files, the scoreboard page, the contracts, the test helpers.
Never touch `ALN-TokenData/` or another worktree. Push nothing. Commit
per seam with a message naming the pin; backend and scanner commits
separate.

Shared-file rules (plan §1 R15; the supervisor and self-heal lanes
build in parallel; you merge FIRST):
- `backend/contracts/asyncapi.yaml`: the handshake section only (the
  auth object near line 30, the `connect_error` bullets near line 57);
  never the `action` enum or the domain-state schemas.
- `backend/src/websocket/gmAuth.js`: the identify-time scanned-tokens
  fetch at line 151 and the two lines that read the socket's type (80,
  199) only; the device-record literal at line 68 stays; add no room
  join (nothing in this lane needs the `show-control` room; the wiring
  step owns it).
- `ALNScanner/src/network/connectionManager.js`: the auth payload only
  (the config default at line 28 and the payload at 147); the
  self-heal lane edits `_doConnect`'s collision retry (178–199), a
  different function, and rebases on your merge.
- `ALNScanner/src/network/orchestratorClient.js`: the auth payload
  only (71, 95).
- The test helpers `tests/helpers/websocket-helpers.js` and
  `tests/helpers/websocket-core.js` are cross-lane interfaces (43 test
  files, about 120 call sites): their signatures stay ARITY-SAFE in
  this lane (see deliverable 6); the parameter removal is the wiring
  step's mechanical sweep after the lanes merge (ledger row in the
  plan's record).
- `backend/src/websocket/socketServer.js`, `server.js`,
  `adminEvents.js`, `broadcasts.js`, `deviceTracking.js`,
  `routes/resourceRoutes.js`, `middleware/auth.js`,
  `public/scoreboard.html` are yours.

## The facts you build on

Fact sheet `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-factsheet.md`
(§1 handshake; §2 observe tokens; §3 `sync:request`; §4 every client;
§5 the `admin` occurrences; §6 the three tests; §7 the scoreboard E2E
flows), corrected and extended by the review:
- What a verified token carries (`middleware/auth.js`): an operator
  token mints `tier: 'operator'`, `class: 'staffed'` (58–62); an observe
  token mints `tier: 'device'`, `class: 'display'`, functions exactly
  `['observe']` (130–150). There is NO class named `operator`; the class
  axis (`gameRules/grants.js:24-28`) is `staffed | station | personal |
  display`; the tier axis is `operator | device | session`. Existing
  carve-outs key on the tier: `gmAuth.js:61` and `broadcasts.js:647`
  read `socket.tier === 'device'`; `adminEvents.js:165` reads
  `socket.tier !== 'operator'`. A legacy claim-less token stamps
  `socket.tier = null` (`socketServer.js:116`): the fail-closed case.
- Today's provenance rule for `deviceId` (`socketServer.js:120-126`):
  the claim for tier `device`, the handshake otherwise. The A2
  staleness warn (`socketServer.js:136-148`) compares the HANDSHAKE
  `packHash` against the active pack; both token kinds also carry a
  server-minted `packHash` claim (`auth.js:63,137`) — the handshake
  value is the one that must keep being read.
- Every reader of the self-declared handshake type (`grep -rn
  "socket\.deviceType" backend/src` → ten sites): `socketServer.js:53`
  (the gate), `:85` (`isScoreboard = deviceId.startsWith('SCOREBOARD_')`),
  `:125` (the stamp); `server.js:123` (`socket.isAuthenticated && socket.deviceType
  === 'gm'`, the only production trigger of `handleGmIdentify`);
  `adminEvents.js:32` (`AUTH_REQUIRED` unless `'gm'`), `:113` and
  `:192` (both feed the SCAN-RECORD field); `broadcasts.js:653-654`
  (device-list label, reached only by operator sockets because
  `:647-649` excludes tier `device`); `gmAuth.js:80` and `:199`;
  `deviceTracking.js:31` (a disconnect log field).
- Two DIFFERENT fields share the name and stay untouched: the
  device-record type (`gmAuth.js:68` literal `'gm'`,
  `deviceConnection.js:229`, Joi `valid('player','gm')` at
  `validators.js:125`, asyncapi enum `[gm, player]` at :203 and :711)
  and the scan-record type (`gmTransactionSchema.deviceType`
  `valid('gm')` at `validators.js:177`; `transaction.js:155-156`;
  `duplicatePolicy.js:87`; `commandExecutor.js:554`; the scanner's
  `gameOps.js:342` and `NetworkedStorage.js:143`; the HTTP scan routes).
- Clients that send the word: `ALNScanner/src/network/connectionManager.js:28,147`,
  `orchestratorClient.js:71,95`, `backend/public/scoreboard.html:1564`.
- Test helpers that carry it: `tests/helpers/websocket-helpers.js:79-161`
  (`connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout = 5000)`; a token is minted
  only for `'gm'` at :89; the `'gm'` branch at :107-155 decides whether
  to await `sync:full`), `tests/helpers/websocket-core.js:30,56`
  (`connectWithAuth(baseUrl, password, deviceId, deviceType, options)`),
  `tests/helpers/integration-test-server.js:73-91` (a dead `admin`
  fake-auth branch) and `:153` (the harness's twin of `server.js:123`),
  `tests/e2e/setup/websocket-client.js:99`.
- Contract and doc residue: `asyncapi.yaml:30` (auth object) and `:57`
  ("Invalid deviceId or deviceType" bullet); `openapi.yaml:81` (a stale
  "AUTH_REQUIRED, INVALID_TOKEN, or TOKEN_EXPIRED" code list) and `:88`;
  `backend/backend_docs/WEBSOCKET_QUICK_REFERENCE.md:54`;
  `tests/e2e/setup/WEBSOCKET_CLIENT_README.md:13,24`,
  `SSL_CERT_HELPER_README.md:132-149,256,341`, `USAGE_EXAMPLE.js`;
  `ALNScanner/CLAUDE.md` (the handshake paragraph).
- Rooms: every identified socket joins `gm` (`gmAuth.js:106`); the
  `isDisplay` carve-out at :61 covers registration and capacity only;
  displays get no device row (the `if (!isDisplay)` guard at
  `gmAuth.js:119` around `updateDevice` at :120; `broadcasts.js:647-649`).
- Identity of a display today: `routes/resourceRoutes.js:205` mints
  every observe token with the literal `'SCOREBOARD'`; the page's own id
  (`SCOREBOARD_DISPLAY_<ts>` or `?deviceId=`, `scoreboard.html:744-767`)
  never reaches the mint; the HDMI kiosk is launched with
  `?deviceId=SCOREBOARD_HDMI` (`displayDriver.js:77`).
- `sync:request` mutation: `session.getDeviceScannedTokens()`
  (`models/session.js:380-387`) writes an empty array; the non-mutating
  twin `getDeviceScannedTokensArray()` (`:421-423`); three call sites
  `server.js:94`, `tests/helpers/integration-test-server.js:124`,
  `gmAuth.js:151` (the identify-time fetch).

## The pin (plan §3 P15 as amended by rulings R5, R19, R21)

Every connection presents a verified operator or observe token at the
handshake; the handshake carries no station type; the verified TIER
decides every gate and exemption (`operator` or `device`; anything else
fails closed — the plan's R19 and P15 now say "tier" too: there is no
class named `operator`; a display's class `display` and tier `device`
coincide); the scoreboard's collision exemption keys on tier
`device`, not on a name prefix; `sync:request` and the identify-time
fetch use the non-mutating getter; the contract's `admin` value and the
handshake `deviceType` field are removed on both sides; a handshake that
still carries the field is accepted and the field never read (plan §4's
red-first line amended to match: a service-worker-cached scanner build
must not be locked out on show night). The observe token carries the
id the display asked for. `/health` is untouched.

## Deliverables, each red-first at its seam

1. **Contract first.** `asyncapi.yaml`: the handshake auth object is
   `{token (required), deviceId (required), version (optional),
   packHash (optional)}`; `deviceType` and `admin` gone; the
   `connect_error` bullet list reads: `AUTH_REQUIRED: Token required`,
   `AUTH_REQUIRED: deviceId required`, `AUTH_INVALID: <the existing
   invalid-token text>`, the existing collision message; the "Invalid
   deviceId or deviceType" bullet at :57 corrected. Same fix in
   `openapi.yaml:81` and `:88`, `WEBSOCKET_QUICK_REFERENCE.md:54`, the
   `ALNScanner/CLAUDE.md` handshake paragraph, and the helper docs
   named above. Red-first: a contract test that loads the spec the way
   `tests/contract/websocket/phase1-events.test.js:59-61` does and
   asserts `expect(asyncapi.info.description).not.toContain('deviceType')`
   and `.not.toMatch(/"admin"/)` — the QUOTED enum spelling from the
   handshake object (`"gm" | "admin"`, :30); the unquoted `/api/admin/auth`
   (:17, :24, :28) and `logout/admin action` (:56) stay and must not
   trip it (the handshake object lives in `info.description`, :24-37;
   the device-record enum at :203/:711 is outside it).
   Commit this first, alone.
2. **The handshake** (`socketServer.js`; the credential block runs for
   every connection). Order: (a) missing token → `AUTH_REQUIRED: Token
   required`; (b) missing `deviceId` → the existing refusal; (c) operator
   token, else observe token, as today; (d) provenance per field: `tier`,
   `class`, `functions` ← the verified claims; `deviceId` ← the claim
   for tier `device`, the handshake otherwise (today's rule); `version`
   and `packHash` ← the handshake (the A2 staleness warn keeps comparing
   the client's hash); a token with no tier → refused (fail closed);
   (e) the collision check applies to tier `operator`; tier `device` is
   exempt (the `SCOREBOARD_` prefix test at :85 is deleted); (f) a
   handshake that still sends `deviceType` is accepted and the field is
   never read. Red-first (unit, `tests/unit/websocket/socketMiddleware.test.js`,
   asserting on the SERVER socket's `tier`/`functions` through
   `io.of('/').sockets` as the suite already does at :423-425): tokenless
   → `connect_error`; operator token with a handshake `deviceType:
   'player'` → connected with `tier === 'operator'` (the word carries no
   meaning); observe token → connected with `tier === 'device'` and
   functions `['observe']`. The fail-closed rule for a token with no
   tier has no red-first seam of its own (`verifyToken` already refuses
   any token outside the `adminTokens` store, so a claim-less token is
   `AUTH_INVALID` today); exercise the new branch with
   `jest.mock('../../../src/middleware/auth')` — `socketServer.js:9`
   destructures the verifiers at require time.
   Regression guards (green today, kept): two tier-`device` sockets with
   the same `deviceId` both connect; two operator sockets with the same
   `deviceId` trip the collision rule. The existing case "should allow
   non-GM connections without authentication" is rewritten into the
   first of these.
3. **Every server reader switched, per site.** `server.js:123` becomes
   `if (socket.isAuthenticated)` (both tiers identify: the scoreboard
   needs its rooms and `sync:full`); the harness twin
   `integration-test-server.js:153` the same. `adminEvents.js:32` refuses
   unless `socket.tier === 'operator'`, with the existing `error` event
   `code: 'AUTH_REQUIRED'`. `adminEvents.js:113` and `:192` stop reading
   the socket and pass the literal `'gm'` into the scan-record field.
   `broadcasts.js:653-654`: only operator sockets arrive there, so
   `type` is the literal `'gm'` and the label is unconditionally
   `'GM Station'`; the `'Admin'` fallback is deleted. `gmAuth.js:80` and `:199` stop reading the socket (`:80` is
   deleted; `:199` passes the device record's own type). `gmAuth.js:68`
   and `deviceConnection.js:229` change nothing (device-record type).
   `deviceTracking.js:31` drops the log field. Red-first: an observe
   socket issuing `gm:command` receives the `error` event with `code:
   'AUTH_REQUIRED'` (assert the code, not a bare refusal); a display
   socket identifies and receives `sync:full`. Regression guard: the
   scoreboard occupies no station slot and no device row.
4. **`sync:request` and the identify-time fetch never write.** The
   three call sites use `getDeviceScannedTokensArray()` (wrapped in
   `new Set(...)` where a Set is consumed). Red-first: a `sync:request`
   from a tier-`device` socket whose deviceId has no entry leaves
   `session.metadata.scannedTokensByDevice` without that key (pinning
   both halves: the getter never writes, and the endpoint stays open
   to a display).
5. **The clients stop sending the word, and displays get their id.**
   `connectionManager.js:28,147` and `orchestratorClient.js:71,95`
   (scanner unit tests updated; any scanner contract test pinning the
   handshake shape updated); `scoreboard.html:1564`. The scoreboard
   serve (`resourceRoutes.js:205`) reads `req.query.deviceId`,
   normalizes it (trim; 1–64 characters of `A-Za-z0-9_-`; anything else
   → `'SCOREBOARD'`), and mints the observe token with it; the page's
   `?deviceId=` already reaches the page (:744-767). Red-first: a serve
   with `?deviceId=SCOREBOARD_NETWORK` yields a token whose `deviceId`
   claim is `SCOREBOARD_NETWORK`; `?deviceId=../x` yields `SCOREBOARD`.
   Rebuild `dist`.
6. **The helpers and the three named tests.** `connectAndIdentify` and
   `connectWithAuth` keep their arity in this lane: the `deviceType`
   position is documented as ignored ("legacy position; removed by the
   wiring step's sweep") and both gain an `{observe: true}` option in a NEW fifth position
   (`connectAndIdentify`) or inside the existing `options` object
   (`connectWithAuth`) that mints an observe token through `generateObserveToken(deviceId)` and
   awaits `sync:full` (a display gets one once deliverable 3 lands);
   the `'gm'`-only token minting at `websocket-helpers.js:89` becomes
   unconditional for non-observe calls. The dead `admin` branch in
   `integration-test-server.js:73-91` is removed and its handshake
   mirrors deliverable 2. `admin-interventions.test.js:711-716` expects
   `connect_error`. `room-broadcasts.test.js:81` is inverted: a
   tier-`device` socket RECEIVES `gm`-room broadcasts and holds no
   device row (pins visible-change item 13); the old "outside the gm
   room" purpose is unrepresentable and is retired with a comment
   saying why.
7. **The scoreboard and the scanner keep working end to end.** Flows
   `tests/e2e/flows/23-scoreboard-live-data.test.js`,
   `24-scoreboard-restart-recovery.test.js`, and the scanner-driven
   flows `07b`/`07c` pass on the rig (production leg); the scanner's
   own `npm run test:e2e` passes. Take `/tmp/rung1/e2e.lock` with
   `flock` before any E2E or Tier L run (the lanes share the rig); never
   stop the shared arms under `/tmp/rung1`.

## Runs before your report (fresh, in this order; paste the last lines)

Backend: `npm test`; `npm run coverage:check`; `npm run lint`;
`npm run test:integration`; the four E2E flows above. Scanner (in the
worktree's `ALNScanner/`): `npm test`; `npm run test:coverage && npm run
coverage:check`; `npm run lint`; `npm run test:e2e`; `npm run build`.
Check `df -h /` before and after any run that spawns an orchestrator.

## Completion criterion

Every deliverable has a commit; every red-first seam went red on the
old code and green on the new (say how you saw red; regression guards
are marked as such); `grep -rn "socket\.deviceType\|auth\.deviceType\|deviceType:" backend/src/websocket/socketServer.js backend/src/server.js backend/src/websocket/broadcasts.js backend/src/websocket/deviceTracking.js ALNScanner/src/network backend/public/scoreboard.html`
returns nothing, `grep -n "socket\.deviceType" backend/src/websocket/gmAuth.js`
returns nothing (its line 68 device-record literal stays), and the
handshake section of `asyncapi.yaml` contains no `deviceType`; the scan-record and device-record fields are
untouched; no SOURCE file outside the lists above changes (test files
touched only as deliverable 6 names).

## Report

Create `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-lane-report.md`
at the start and extend it as you go: status, commits (backend and
scanner), what went red and how, the run tails, what an observe socket
receives, concerns. Return to the orchestrator only: status, commits,
one-line test summary, concerns.
