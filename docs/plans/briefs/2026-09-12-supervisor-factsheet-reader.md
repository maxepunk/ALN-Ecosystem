# Fact sheet brief — the supervisor and the fault buttons (reader)

You read; you write exactly one file, the fact sheet named under Output. Change nothing else, run no git write commands, run no tests except the read-only `npx jest <file>` runs named below, dispatch no subagents. Work only under `/home/user/ALN-Ecosystem/`; the top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are stale clones: never read them. Every claim cites file:line; every count is verified by a grep you paste. Model: Sonnet.

The sheet OPENS with a section "Conclusions (at most 40 lines)": the facts most likely to change the design, the risks, and the gaps between the plan and the code. The orchestrator reads only that section; the implementer reads the whole sheet.

## Why
The plan's pins P10 (supervision), P11 (host config), P12 (the verbs as commands), P13 (hold policy) and P16 (the display service) in `docs/plans/2026-09-12-block2-hardening-plan.md` §3, and the piece's file list in §4 ("the supervisor and the fault buttons"), were written from a census of an older tree. The brief must be written from the tree as it is now.

## Questions
1. `backend/src/utils/processMonitor.js` in full: the restart loop, the failure counter and its reset rule, backoff, PID files, the exit and close handlers, `stop()`; every consumer (grep `new ProcessMonitor`) with the options each passes and whether it is a long-running observer or a service (vlc, mpd, chromium, pactl subscribe, the two D-Bus monitors).
2. How each service reports health today (`serviceHealthRegistry.report` call sites per service) and what `markDormant`/`isDormant` the registry exposes after the dormancy core; the revalidation map in `app.js` and `systemReset.js`.
3. `vlcMprisService.js`: adopt versus self-spawn (`VLC_SELF_SPAWN`), what "adopt mode" does, the flat retry; `musicService.js`: MPD spawn and the client reconnect; `lightingService.js`: the HA WebSocket reconnect and the Docker container ensure; `displayDriver.js`: launch, the exit handler after ruling 27, `probe()`, hide/show, the orphan sweep.
4. `commandExecutor.js`: the `service:check` case (the idiom the three new commands copy), `SERVICE_DEPENDENCIES`, `REQUIRED_PAYLOAD_FIELDS` (the four future actions the dormancy core reserved), the dormant branch, the operator floor and `grants.js` prefixes; the exact switch gap where new cases go (line numbers).
5. Holds: `heldItemsStore.js` and `videoQueueService`'s own hold list; who discards, when; `endSession` and `systemReset` today (do they expire anything?).
6. The socket authentication file `backend/src/websocket/gmAuth.js`: how rooms are joined today, where an operator-only `show-control` room join would go (the collision matrix names this gap), and how `broadcasts.js` emits to rooms.
7. Contracts: where the `gm:command` `action` enum lives in `backend/contracts/asyncapi.yaml` (line), its neighbours, and the ack schema; the `DomainStateHealth` schema.
8. Scanner: `ALNScanner/src/ui/renderers/HealthRenderer.js` after the dormancy core (the three states, the summary button, the door wording), `AdminOperations.js` and `domEventBindings.js` (how a button reaches a `gm:command`), `CueRenderer.js` quick-fire badge; the existing tests for each.
9. Existing config seams: `backend/config/` layout, how `config/index.js` reads env, `.gitignore` entries under config, and any `host` mention today.
10. Tests today for processMonitor, displayDriver, commandExecutor's service cases, and the health renderer: file names and counts (run each with `npx jest <file>` from the right directory and paste the summary lines).

## Completion criterion
All ten answered with file:line; every consumer of ProcessMonitor listed; the switch gap and the enum line named; the room-join site named.

## Output
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-factsheet.md`. Reply with at most three lines: status, path, the one fact most likely to change the design.
