# Production fixes against the new engine — triage (2026-10-30)

Blue ran the September and October shows on its maintenance branch
`production-2026-07`. Between 2026-09-12 and 2026-09-18 a session fixed
real defects there. Its records live on that branch:
`docs/plans/2026-09-15-alnscanner-wiring-review.md` (the defect list,
with IDs) and `docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md`
(the fixes, packages W1–W10).

This record checks each of those fixes against the new engine: the
designated branch `claude/nice-curie-hescfv` at `b2968a9`, with
ALNScanner at `e83723c`. For each fix it asks one question: is the
defect still there, already gone, or does planned work change where the
fix belongs?

**How to use this record (owner, 2026-10-30).** It is evidence for the
whole-engine architecture pass, not a queue of ports. The aim is to
remove the classes of defect these fixes treat, through the engine's
architecture and interfaces.

**Method.** Each defect's code path was read on the new engine; the
evidence column cites it. "Identical to July" means the file has the
same content as the rollback tag `blue-2026-07`, so the new engine runs
the code blue ran before the fixes. No tests were run: these verdicts come from reading the code, and each
should be confirmed by a test that fails before the fix is built.

**Coverage.** This record covers the fixes blue made, not every finding
in blue's review: the findings blue left unfixed were not checked here.

**Verdict words.** Port: carry the fix's behaviour and its test into the
new engine. Drop: the new engine no longer needs it. The other verdicts
say where the work belongs instead.

## Verdicts

Paths are relative to the parent repository; scanner paths start with
`ALNScanner/`.

### GM scanner

| ID | Defect | New engine | Evidence | Where the fix belongs |
|---|---|---|---|---|
| A-3 | Deleting a transaction never frees its token on the stations | Present | `ALNScanner/src/network/messageRouters.js:47-54` removes the transaction and updates the score, never the token | Port |
| A-4 | Reset All Scores leaves every earlier token refused | Present | `messageRouters.js:56-58` clears backend scores only | Port |
| A-9 | A reload restores transactions without marking their tokens claimed | Present | `ALNScanner/src/core/storage/NetworkedStorage.js:357-359` | With the self-heal work: same message handler |
| A-1 | Team Details reads backend scores from an object that does not hold them | Present | `ALNScanner/src/ui/renderers/GameOpsRenderer.js:221` reads `backendScores` off the facade; `unifiedDataManager.js` defines none | Port |
| A-2 | Completed groups always show "In Progress", bonus $0 | Present | `ALNScanner/src/core/unifiedDataManager.js:569-572` delegates; neither strategy implements `getTeamCompletedGroups` | Port |
| E-1 | Game Activity shows Unknown, no stars, $0 for claimed tokens | Present | `ALNScanner/src/core/gameActivityBuilder.js:55-64` reads fields off the `{token, matchedId}` wrapper that `tokenManager.js:284,296` returns | Port |
| E-2 | The report's Final Totals leave out group bonuses | Present | `ALNScanner/src/core/sessionReportGenerator.js:241-266` sums sales and adjustments only | Port |
| E-3 | The report takes token owners from the local token file only | Present | `sessionReportGenerator.js:447` looks up by token id, ignoring the backend's owner | Port (minor) |
| E-4 | The report's table cells are not escaped | Already fixed | `sessionReportGenerator.js:424-433` escapes pipes and control characters | Drop |
| B-1 | The routing dropdown silently shows the first sink | Present | `ALNScanner/src/ui/renderers/EnvironmentRenderer.js:174,191` | Port, with the backend half |
| B-4 | The list of queued videos is never visible | Present | `ALNScanner/index.html:407` hides it inline; no renderer clears it | Port |
| C-7 | The device ID header reverts after a reload | Present | `ALNScanner/src/ui/settings.js:48-58` paints it in `save()` only | Port |
| B-5 | Check Now gives no feedback on a still-down service | Present on the panel | the health registry records check times; `HealthRenderer.js` never shows one | Port the panel half; the backend half is unchecked |
| B-7 | Two music volume controls | Present | `MusicRenderer.js:114` and the per-stream music slider in `EnvironmentRenderer.js:47` | Port (owner, 2026-09-15: "the fact that there are two sliders is kind of an issue") |
| FB | No offline state when the music server is down | Present | `ALNScanner/src/ui/renderers/MusicRenderer.js` identical to July | Port |

### Backend and test harness

| ID | Defect | New engine | Evidence | Where the fix belongs |
|---|---|---|---|---|
| B-2, B-3 | The lighting and music panels never refresh when the service connects or drops | Present | `backend/src/websocket/broadcasts.js:536-537` pushes only the health domain on a health change | Port |
| B-7 | Per-stream volume changes are not broadcast to other stations | Present | `broadcasts.js:549`: the audio push list carries no volume event | Port |
| B-1 | Audio routes are reported as aliases, not sink names | Present | `backend/src/services/audioRoutingService.js` identical to July | Port |
| FA | Unrouted streams show no effective sink; volume on an idle stream errors | Present | `audioRoutingService.js` identical to July | Port |
| C-1 | Ending a session wipes the GM's view on the next sync | Present | `backend/src/services/sessionService.js:549-554` clears the session; `backend/src/websocket/syncHelpers.js:49,133` then builds from nothing | With the self-heal work: the retained ended session changes what the scanner sees at a session boundary, so the two are designed together |
| W10 P1 | The real cause of "video stays stopped about 28 seconds": the parser that reads the video player's status messages holds a message until the next one arrives | Present | `backend/src/utils/dbusSignalParser.js` identical to July | Port first: it is a root cause |
| W9 P0.1 | Trust the video's live position over the cached state | Absent | `backend/src/services/videoQueueService.js` has no such guard | Decide after P1: the guard covered a symptom of P1 |
| W9 P0.2 | A skipped video's position is lost on completion | Present | `videoQueueService.js:479` emits completion without a position | Port; check the cue engine's consumer |
| W9 P0.3 | Stale-process clean-up can match the wrong process | Present | `backend/src/utils/processMonitor.js` identical to July | Supervisor work: it rewrites this code |
| FB | A music-server crash is not visible at once; recovery waits for the next health sweep | Present | `backend/src/services/musicService.js` identical to July; `_setConnected` at `:230` reports to the health registry only | Supervisor work, with its regression test |
| W10 P2 | Tests and the live system share fixed process-ID files, so a unit test can kill the live video player | Present | fixed paths at `vlcMprisService.js:117`, `musicService.js:607`, `audioRoutingService.js:793`, `bluetoothService.js:501`, `backend/src/utils/displayDriver.js:53` | Supervisor work; required before tests run on a Pi |
| W10 P3 | A test that leaves a real child process running still passes | Absent | no such guard | With the deferred test-harness work; required before tests run on a Pi |
| W10 P4 | No switch keeps the kiosk browser off the TV during tests | Absent | no such switch | Same |
| W10 C1 | The end-to-end harness starts a second video player beside the engine's own | Present | `backend/tests/e2e/setup/vlc-service.js:84-90` | With the test-harness work |

Not checked: W9 P0.4 (diagnostic logging only), the slider drag-guard
reset (ALNScanner `fc45c28` on the production branch), and the backend
half of B-5.

## What the new architecture changes

1. **Process supervision.** The planned supervisor work rewrites how the
   engine starts, restarts and cleans up the video player, the music
   server and the kiosk browser. W9 P0.3, the backend half of FB, and
   W10 P2 live in that code. They belong in the supervisor brief as
   requirements with their regression tests, not as code ported now and
   replaced later.
2. **Reconnect handling.** The self-heal work edits the scanner handler
   that C-1's client half and A-9 touch, and C-1's backend half changes
   what that handler receives at a session boundary.
3. **Root cause first.** W10 P1 is the cause of the video symptom that
   W9 P0.1 guarded against. Port P1 first, then decide whether P0.1 is
   worth keeping as a second line of defence.
4. **The truth sweep's audit.** Its fact sheets were lost with the
   container in the pause. The production review covers most of the
   same ground for the GM panel, so its findings can serve as the
   sweep's fix list there.
5. **Carry behaviour and tests, not diffs.** Of the files the production
   line changed, most were also rewritten on the new engine: 13 of 23
   backend files and 13 of 17 scanner files. The production commits will
   not apply cleanly; their regression tests encode failures seen at the
   venue, and those are what must carry over.

## Open on blue, and therefore expected on the new engine

Owner, 2026-10-30: the GM panel does not keep up with live music
playback without a refresh. The new engine runs the same July code for
the music service and the panel's music section (`musicService.js` and
`MusicRenderer.js` are identical to the July tag), so the defect is
expected there too, alongside the music bugs production already fixed.
That is an expectation, not a demonstration: the files at both ends are
identical to July, but the path between them has changed
(`backend/src/websocket/broadcasts.js`, `cueEngineWiring.js`,
`ALNScanner/src/admin/MonitoringDisplay.js`, `messageRouters.js`).
Diagnosing it needs a live reproduction on the test rig or at the venue.
