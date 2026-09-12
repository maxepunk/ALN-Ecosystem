# Lens: state machine and lifecycle

Read /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/briefs/redteam-common.md first.

Attack these mechanisms in the plan (§3 pins P1–P8, P10, P13, P14 and tasks T1a, T1b, T3, T5):
1. The sticky dormant latch (P5) against every out-of-band `report()` caller the census lists (§2) and
   the boot ordering in backend/src/app.js initializeServices: can a report arrive after the feed and
   flip a dormant service? Can `reset()` + the feed race with startRevalidation?
2. The feed's four run points (P6): session create, restore in `sessionService.init`, systemReset,
   boot. Trace the actual code for each (backend/src/services/sessionService.js,
   systemReset.js, app.js). Which run point can execute before cues are loaded or before the
   profile is activated? What happens to an operator-door latch across each?
3. Two disable sets (P3/P4) against the standing evaluator's persistence
   (backend/src/services/cue/standingEvaluator.js toPersistence/fromPersistence) and the E1
   restore path: can a dormancy-disabled id leak into persistence? Can a GM-disabled cue lose its
   flag on recompute? Is the "every service-bearing command dormant" rule computable from
   cues.json + SERVICE_DEPENDENCIES for compound (timeline) cues?
4. `fireCue` return-shape change (P3): every caller of fireCue in the tree (grep) and what each
   does with the new return; the quick-fire ack path in commandExecutor.
5. Hold policy (P13): the `service_down` cue hold at cueEngineService.js fireCue, the video hold at
   videoQueueService.processQueue, endSession ordering (does suspend happen before or after expiry?
   can a hold be created after expiry within the same end?), and the player-scan route's 409 wire.
6. Supervision (P10): ProcessMonitor's close handler, the flap window vs `receivedData`, `stop()`
   semantics during a pending restart timer, PID-file handling across `restart()`, and the
   vlcMprisService 'exited'/'restarted' handlers; the HA WebSocket reconnect interval and container
   start; Chromium in displayDriver.js `_doLaunch` — what breaks if it becomes a ProcessMonitor?
7. Self-heal (P14): the sync:full handler path in ALNScanner/src/network/messageRouters.js and
   networkedSession.js, packLoader's pointer/cache semantics for a `refresh()`, tokenManager's
   loadDatabase re-entrancy (can scoring/strings/theme be re-applied mid-session safely?), and
   the connectionManager reconnect path: can heal loop forever if the server's pack changes twice?
8. The require gate (P7) vs restore: a restored ACTIVE session never passes startGame — where does
   dormancy for a restored session get applied, and is the preflight stamp refreshed?

Output file: /tmp/claude-0/-home-user/84692604-1422-5e48-a295-cc91e6bc4a0e/scratchpad/redteam-state.md
