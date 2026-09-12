# Fact sheet brief — the scanner's pack self-heal (reader)

You read; you write exactly one file, the fact sheet named under Output. Change nothing else, run no git write commands, run no tests except the read-only `npx jest <file>` runs named below, dispatch no subagents. Work only under `/home/user/ALN-Ecosystem/`; the top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are stale clones: never read them. Every claim cites file:line; every count is verified by a grep you paste. Model: Sonnet.

The sheet OPENS with a section "Conclusions (at most 40 lines)": the facts most likely to change the design, the risks, and the gaps between the plan and the code. The orchestrator reads only that section; the implementer reads the whole sheet.

## Why
Pin P14 in `docs/plans/2026-09-12-block2-hardening-plan.md` §3 and the piece's file list in §4 ("the scanner's pack self-heal") describe the GM scanner healing a stale pack at a session boundary. The sync-workflow fact sheet (`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/token-sync-workflow.md` §6) already established that the scanner loads the pack once at app start and never notices a mid-session change. The brief must be written from the tree as it is now.

## Questions
1. `ALNScanner/src/core/packLoader.js` in full: `loadPack()`'s three tiers, the staging cache, sha1 verify, the pointer flip, GC, what `{packId, version, contentHash, source}` it records and where; whether any `refresh` exists; the serving-origin channel rule.
2. `ALNScanner/src/core/tokenManager.js` `loadDatabase()` and `applyPackScoring()`: what "re-apply" means and what validates the consumer against staged content.
3. `ALNScanner/src/network/networkedSession.js`, `messageRouters.js` (`sharedInfraRouter` `sync:full` case — the collision matrix says the panel shares it), `connectionManager.js` (handshake auth payload with `packHash`, reconnect, `DEVICE_ID_COLLISION` handling), `orchestratorClient.js` (`MESSAGE_TYPES`).
4. What `sync:full` carries about the pack today (`backend/src/websocket/syncHelpers.js`, the contract's `SyncFull.pack`) and what the server does on a handshake hash mismatch (`socketServer.js` warn).
5. The "session boundary" definition in P14: which local facts the scanner has (active session, local transactions for the current session) and where they live (`unifiedDataManager`, `NetworkedStorage`).
6. UI: how a toast and a persistent banner are shown today (`uiManager.js`), and whether a blocking backstop screen pattern exists (the connection wizard?).
7. The two owed tests named "§8.5" (ROADMAP §8.5 — quote the two test descriptions) and the service worker's cache GC exemption for `aln-pack-*` (`ALNScanner/sw.js`).
8. The backend E2E flow the piece owes (restart the orchestrator with a different `packPath` and assert the reconnect with the new hash): what `restartOrchestrator` supports today (`backend/tests/e2e/setup/test-server.js`), which fixture packs differ in hash, and how flow 31 drives a session.
9. Existing tests for packLoader, tokenManager, networkedSession, connectionManager (files, counts, run them).

## Completion criterion
All nine answered with file:line; the boundary facts named; the two §8.5 tests quoted.

## Output
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-factsheet.md`. Reply with at most three lines.
