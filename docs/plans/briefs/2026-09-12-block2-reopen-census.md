# Brief: Block 2 (hardening block) re-open census

You are a census reader for the ALN-Ecosystem engine. This census re-verifies, on the walked `main` tree, every surface the hardening block will change, so the block can be re-priced at open. Read-only work: the only file you write is your output file.

## Where to work

Work only under `/home/user/ALN-Ecosystem/` (parent repo, branch `claude/nice-curie-hescfv` at commit `e87f8c5`, submodules checked out at their pins). The sibling directories `/home/user/ALNScanner`, `/home/user/ALN-TokenData`, `/home/user/ALNPlayerScan`, `/home/user/arduino-cyd-player-scanner` are separate clones; the parent tree is the one source of truth for this census.

## Vocabulary

Use the terms exactly as defined in `/home/user/ALN-Ecosystem/CONTEXT.md`: §2 (activation, the gate, verdict, shim, drift tripwire), §4 (dormant vs fault, alarm integrity, status with verbs, self-heal, supervisor, held item, service domain), §5 (preflight, paper vs live, environment ladder). Read those three sections before writing a line.

## What the block will build

The ratified design is `/home/user/ALN-Ecosystem/docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md` §8 (normative), with §5 and §6 for the red-team adjudications. Stages: CS.2 dormancy lifecycle + enum, CS.3 supervisor + verbs + self-heal, CS.4 preflight presentation, CS.5 close. The previous census (§2 of that document, 2026-09-04) and the dependency audit `/home/user/ALN-Ecosystem/docs/plans/2026-09-04-recharter-audit-dependencies.md` "CLAIM 2" were taken on an older tree: every number there is a hypothesis to re-verify, never a fact to copy.

## Steps

Every claim carries `file:line`. Every count is verified by a raw `grep -rn` command you show verbatim beside it.

1. **Health enum blast radius.** Every occurrence of the string literals `'healthy'`, `'down'`, `'degraded'`, `'dormant'` (single or double quoted) under `backend/src`, `backend/contracts`, `backend/tests/e2e/helpers`, `backend/tests/rung1`, `backend/scripts`, `ALNScanner/src`, `config-tool/lib`, `config-tool/public/js` (skip `node_modules` and `dist`). Table columns: file:line | literal | one-line context | consumer class (producer report / comparison / contract enum / renderer / test helper / other). Done when the row count equals the grep count.
2. **serviceHealthRegistry.** The full public API of `backend/src/services/serviceHealthRegistry.js` with file:line; every caller of `report(` in `backend/src` grouped by service, each marked in-band (health check) or out-of-band (monitor, socket, timeout callback); `reset()`; `startRevalidation` and its `HEALTH_CHECKS` map; the `getSnapshot` shape. Done when every `report(` call site is listed.
3. **system:reset path.** The ordered sequence in `backend/src/services/systemReset.js` and what each step does to the registry, the cue engine's disabled sets, `profileService`, `packService`. Cite each step.
4. **The disabledCues seam.** Every site in `backend/src/services/cueEngineService.js` and `backend/src/services/cue/standingEvaluator.js` that reads, writes, persists or restores the disabled set; the return value of `fireCue`; how `commandExecutor` acks `cue:fire`; `cue:enable` / `cue:disable` handling. Done when each site is cited.
5. **SERVICE_DEPENDENCIES.** The map in `backend/src/services/commandExecutor.js`, the rejection wording, `validateCommand()` and every caller of it.
6. **Holds.** `backend/src/services/heldItemsStore.js` public API; every caller of `setAutoDiscard` / `registerAutoDiscard`; the `service_down` hold path in `cueEngineService`; `videoQueueService`'s own hold list and its expiry or the absence of one; what session end does to holds. Cite each.
7. **Prior-art supervision.** `backend/src/utils/processMonitor.js` restart logic (backoff shape, bound on attempts, flap detection, PID files); `vlcMprisService` spawn and restart path and `VLC_SELF_SPAWN` handling; `musicService` MPD spawn; `displayDriver` Chromium spawn; `lightingService` HA container lifecycle. For each: bounded attempts? loop detection? escalation? Cite.
8. **session:start.** The `commandExecutor` case and the `sessionService` transition; any existing gate or override on start; the seam where a require-gate attaches. Cite.
9. **packHash self-heal anchors.** `backend/src/websocket/socketServer.js` packHash capture and warn; `ALNScanner/src/network/orchestratorClient.js` packHash; `ALNScanner/src/core/packLoader.js` public API (load, refresh, staging, `getActivePack`); `ALNScanner/src/network/connectionManager.js` reconnect path; the two tests named in ROADMAP §8.5 (packLoader behavioral timeout; staging-cache race): present or absent under `ALNScanner/tests` (show the grep).
10. **Preflight protos.** `validateCommand` resource checks; `packService` staleness compare; `backend/scripts/check-health.sh`; whether `backend/scripts/preflight.js` exists; `backend/src/gameRules/packNeeds.js` need kinds and `backend/src/gameRules/resolution.js` exported API and rollup shape; the two CS.1 carry-overs (`disabledCueIds` in the rollup; a video-file need kind): implemented or still open, with citations.
11. **Contract sites.** Every health status enum in `backend/contracts/asyncapi.yaml` and `backend/contracts/openapi.yaml` (line numbers); the scanner contract cross-check test file; the `sync:full` `serviceHealth` schema.
12. **Renderers and helpers.** `ALNScanner/src/ui/renderers/HealthRenderer.js` and `HeldItemsRenderer.js`: every health-status comparison and the collapse rule; `backend/tests/e2e/helpers/capabilities.js` status reads.
13. **Fix-vehicle deferrals to Block 2.** Read `/home/user/ALN-Ecosystem/docs/plans/2026-09-05-train-fix-vehicle.md` §2.1 and §2.2. For each item id there, one row: id | one-line meaning | current code state on main with file:line (or "no code anchor").
14. **Counts table.** One row per step: verified count, the grep that verified it.

## Output

Write `/home/user/ALN-Ecosystem/docs/plans/2026-09-12-block2-reopen-census.md`: a two-line header (tree commit, date), then one heading per step numbered as above, tables as specified. Prose only where a table cannot carry the fact. Final message: the output path, the step-14 counts, and one line for each place the tree disagrees with the 2026-09-04 census or the dependency audit.
