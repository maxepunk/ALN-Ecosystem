# Brief: Block 3 (truth sweep) census: the store-fed path

You are a census reader for the ALN-Ecosystem engine and GM scanner. The truth sweep audits every path from engine event to what the GM scanner's admin panel shows, on the store-fed path only, and fixes every place the panel shows something false. This census enumerates that path on the walked `main` tree so the unit can be priced. Read-only work: the only file you write is your output file.

## Where to work

Work only under `/home/user/ALN-Ecosystem/` (parent repo, branch `claude/nice-curie-hescfv` at commit `e87f8c5`, submodules checked out at their pins). The sibling directories `/home/user/ALNScanner`, `/home/user/ALN-TokenData`, `/home/user/ALNPlayerScan`, `/home/user/arduino-cyd-player-scanner` are separate clones; the parent tree is the one source of truth for this census.

## Vocabulary

Use the terms exactly as defined in `/home/user/ALN-Ecosystem/CONTEXT.md` §4 (service domain / `service:state`, dormant vs fault, alarm integrity, status with verbs) and §2 (drift tripwire). Read those sections before writing a line. The GM scanner's own map is `/home/user/ALN-Ecosystem/ALNScanner/CLAUDE.md` ("StateStore", "Network Layer", "MonitoringDisplay").

## Prior numbers to re-verify

`/home/user/ALN-Ecosystem/docs/plans/2026-09-04-recharter-audit-dependencies.md` "CLAIM 4" (10 domains, 55 producer edges, 10 restore guards, 5 reshaping adapters, 22 MESSAGE_TYPES, 8 forwarded events vs 7 consumers, 5 desync classes) was taken on an older tree: every number is a hypothesis to re-verify, never a fact to copy. The scope brake in `/home/user/ALN-Ecosystem/docs/plans/ROADMAP.md` §4 "Block 3" keeps `GameOpsRenderer`, `GameAdminRenderer`, `EvidencePickerRenderer` OUT.

## Steps

Every claim carries `file:line`. Every count is verified by a raw `grep -rn` command you show verbatim beside it.

1. **Producer edges.** In `backend/src/websocket/broadcasts.js`: the `pushServiceState` and `pushHeldState` definitions (debounce, bypasses), then every wiring edge that calls them. Table: domain | source service | event name | file:line | debounced?. Done when the edge count matches the grep.
2. **getState shapes.** For each of the 10 domains: the function that produces the state (`service.getState()` or a builder in `syncHelpers.js` / `environmentHelpers.js`), file:line, and the exact top-level keys it returns (read the code). Then the asyncapi schema describing that domain's state (schema name + line range) and every key present on one side and absent on the other.
3. **sync:full.** `buildSyncFullPayload` in `backend/src/websocket/syncHelpers.js`: every key and its builder; every caller of `buildSyncFullPayload`; what `backend/tests/contract/websocket/sync-full-completeness.test.js` pins.
4. **Transport.** `ALNScanner/src/network/messageRouters.js`: the `service:state` handler and the `sync:full` restore block, quoted verbatim; table: sync:full key → store domain → guard expression → replace or update. `ALNScanner/src/core/stateStore.js` `update` / `replace` semantics (merge depth, null and undefined handling, listener firing).
5. **Consumers.** `ALNScanner/src/admin/MonitoringDisplay.js`: every store subscription. Table: domain | handler file:line | renderer + method | reshaping code quoted | fields dropped. Name every reshaping adapter (the audit named five). Name the domain with no renderer class. Cite `refreshAllDisplays` and `_requestInitialState`.
6. **Ingress list.** `MESSAGE_TYPES` in `ALNScanner/src/network/orchestratorClient.js` verbatim; the asyncapi subscribe operation names; the diff both ways; the contract test that cross-checks them.
7. **The second state path.** Events `ALNScanner/src/core/unifiedDataManager.js` forwards from its strategy vs the listeners `ALNScanner/src/main.js` registers; orphans either way.
8. **Recorded desync classes.** For each of the five in the audit's "Leg 5": current code on main with file:line, and the test that covers it or the word UNCOVERED: (a) the mpd2 idle-FIFO and `_refreshAfterCommand`; (b) `EnvironmentRenderer` `_volumeValues`; (c) MPD `setvol` while stopped; (d) the `sync:full` omission class (the callers); (e) health binary comparisons vs an incoming `dormant` value. Then every "display truth" item the fix vehicle landed (`/home/user/ALN-Ecosystem/docs/plans/2026-09-05-train-fix-vehicle.md` §1.2) with its code anchor; the sweep re-tests these, never assumes them fixed.
9. **Existing tests on the store path.** Test files under `ALNScanner/tests` and `backend/tests` that exercise `stateStore`, `messageRouters`, `MonitoringDisplay`, each store-fed renderer, `service:state` push, `getState`, and the `service:state` assertions in `backend/tests/rung1/audit-flows.js`. Table: file | what it pins (one line).
10. **Screen capture.** Every Playwright screenshot or visual-comparison test under `ALNScanner/tests/e2e` and `backend/tests/e2e` (grep `toHaveScreenshot|screenshot`). Count and files.
11. **The matrix.** 10 rows (domains) × 7 columns: producer edges (count) | getState producer file:line | sync:full key | restore guard file:line | subscription file:line | adapter (name or none) | renderer (class.method or inline). Every cell holds a citation or the word MISSING.
12. **Counts table.** One row per step: verified count, the grep that verified it.

## Output

Write `/home/user/ALN-Ecosystem/docs/plans/2026-09-12-block3-truth-sweep-census.md`: a two-line header (tree commit, date), then one heading per step numbered as above, tables as specified. Prose only where a table cannot carry the fact. Final message: the output path, the step-12 counts, and one line for each place the tree disagrees with claim 4.
