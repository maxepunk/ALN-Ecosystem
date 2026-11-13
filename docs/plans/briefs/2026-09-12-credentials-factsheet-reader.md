# Fact sheet brief — credentials on every connection (reader)

You read; you write exactly one file, the fact sheet named under Output. Change nothing else, run no git write commands, run no tests except the read-only `npx jest <file>` runs named below, dispatch no subagents. Work only under `/home/user/ALN-Ecosystem/`; the top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are stale clones: never read them. Every claim cites file:line; every count is verified by a grep you paste. Model: Sonnet.

The sheet OPENS with a section "Conclusions (at most 40 lines)": the facts most likely to change the design, the risks, and the gaps between the plan and the code. The orchestrator reads only that section; the implementer reads the whole sheet.

## Why
Pin P15 in `docs/plans/2026-09-12-block2-hardening-plan.md` §3 and the piece's file list in §4 ("credentials on every connection") describe closing the tokenless handshake path. The brief must be written from the tree as it is now.

## Questions
1. `backend/src/websocket/socketServer.js`: the handshake middleware in full — where `deviceType` scopes the credential check, what a non-`gm` deviceType gets today, the collision check, what claims a verified token carries (`tier`, `class`, `functions`, `deviceId`, `packHash`).
2. `backend/src/middleware/auth.js` and the observe-token minting path (`resourceRoutes.js` scoreboard serve): how observe tokens are stored and capped, eviction today, and how the scoreboard page presents its token.
3. `sync:request`: where it is handled (`server.js`, `gmAuth.js`?), what it mutates today (the non-mutating getter the pin wants), and the integration test server's copy (`tests/helpers/integration-test-server.js`).
4. Every client that connects a socket: the GM scanner (`ALNScanner/src/network/orchestratorClient.js` auth payload), the scoreboard page (`backend/public/scoreboard.html`), E2E helpers, integration tests — grep `deviceType` and `auth:` in each; list which send a token and which do not.
5. The contract: `asyncapi.yaml` handshake/auth section (line), the `deviceType` enum (`gm | admin`), and every place `admin` appears in code or tests (grep) so the pin's "removed after a grep proves no sender" can be settled.
6. The three tests the pin names (`tests/unit/websocket/socketMiddleware.test.js`, `tests/integration/admin-interventions.test.js`, `tests/integration/room-broadcasts.test.js`): which cases pin the tokenless posture (quote them) and their counts (run each).
7. The scoreboard E2E flow(s) that must keep passing (file names; what they assert about connection).

## Completion criterion
All seven answered with file:line; the sender list complete; every `admin` occurrence listed.

## Output
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-factsheet.md`. Reply with at most three lines.
