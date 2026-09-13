# Reader brief — T1a fact sheet (Block 2, stage CS.2)

You gather facts; you change nothing. Work only under
`/home/user/ALN-Ecosystem/` (the checkout is on branch
`claude/nice-curie-hescfv-t1b`; a reviewer is reading it concurrently —
you run no git commands that mutate anything, and no `npm` or `jest`).
The GM scanner is the submodule `/home/user/ALN-Ecosystem/ALNScanner/`
(the top-level `/home/user/ALNScanner` is a stale clone; it is never
read). Model: Sonnet. Vocabulary: `CONTEXT.md` §4 (dormant vs fault,
alarm integrity, status with verbs) — use those words.

Purpose: the orchestrator writes the T1a implementation brief (dormancy
core, health enum, session-start gate, render-safe scanner) from this
sheet. Every seam below gets an entry with the file path, the line range
you read, and the exact current code lines (quoted verbatim, at most 25
lines per seam — the signature, the branch, or the shape, not the whole
function). A seam you cannot find is reported as `NOT FOUND` with the
grep you ran; never a guess.

Write the sheet to
`/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-factsheet.md`,
one `## <seam id>` section per row, in this order. Reply with one line:
the count of seams answered / NOT FOUND and the sheet path.

| id | file | what to quote |
|---|---|---|
| R1 | `backend/src/services/serviceHealthRegistry.js` | `KNOWN_SERVICES`; the constructor seed; `report()` in full (validator + emit); `isHealthy`; `getSnapshot`; `startRevalidation`'s HEALTH_CHECKS map and loop; `reset()` |
| R2 | `backend/src/gameRules/resolution.js` | the `case 'service':` block; the `case 'endpoint':` block; `rollUp()` in full; the exported function signatures |
| R3 | `backend/src/gameRules/grants.js` | `FLOOR_ACTION_PREFIXES` (or whatever maps action prefixes to floor functions) and the `RULED_NON_FLOOR` set |
| R4 | `backend/src/services/commandExecutor.js` | the health gate (the `SERVICE_DEPENDENCIES` lookup and the rejection `message` template); the `case 'cue:fire'`, `'cue:enable'`, `'cue:disable'` blocks; the `case 'service:check'` block; the `case 'session:start'` block; how `payload` fields are validated for other actions (is there a `REQUIRED_PAYLOAD_FIELDS` table or per-case checks? quote one example); the `executeCommand` signature and what it returns |
| R5 | `backend/src/services/cueEngineService.js` | `_reset()` (the Sets); `getCueSummaries()`; `isCueDisabled` if it exists; `enableCue`/`disableCue`; `fireCue()` head through the disabled check and its return; `releaseCue` (or the held-release path) and what it returns; `_markPastClockCuesFired` signature and where it is called; `loadCues()` head; `checkHealth()`; the `service_down` hold creation site (where `heldItemsStore` gets a cue with reason `service_down`) |
| R6 | `backend/src/services/cue/standingEvaluator.js` | `findMatchingEventCues` and `findMatchingClockCues` signatures and the `disabledCues.has` lines; `toPersistence`/`fromPersistence` shapes |
| R7 | `backend/src/services/sessionService.js` | `startGame()` in full; `createSession()` head (where metadata is stamped: `pack` stamp lines); the restore path at `init()` where a non-ended session is restored (quote the lines that read persisted metadata); `endSession()` head |
| R8 | `backend/src/services/systemReset.js` | the post-reset wiring from "Re-initialize service availability" through `startRevalidation` (lines ~213–286) |
| R9 | `backend/src/app.js` | `initializeServices()` from the profile activation through `startRevalidation` (quote the order of `init()` calls and the revalidation start) |
| R10 | `backend/src/services/profileService.js` | every export and the shape `getProfile()`/equivalent returns (profileId, forPack, bindings, endpoints?) |
| R11 | `backend/src/websocket/syncHelpers.js` | `buildSyncFullPayload()` signature and the list of top-level keys it emits (quote the object literal keys); where `serviceHealth` and `pack` come from |
| R12 | `backend/src/routes/healthRoutes.js` | the `/health` response object literal (keys; the `pack` identity lines) |
| R13 | `backend/src/utils/displayDriver.js` | `_doLaunch()` head and its success/failure branches; the kiosk exit handler; `show()`/`hide()` names; `cleanup()`; any existing health `report` calls (grep `serviceHealthRegistry` in the file) |
| R14 | `backend/src/services/videoQueueService.js` | `canAcceptVideo` (or the function the player-scan route calls to decide `409 {status:'rejected'}`) and its return shape; the `_holdVideo` site |
| R15 | `backend/src/routes/scanRoutes.js` | the branch that returns `409 {status: 'rejected'}` for a video that cannot play (quote it) |
| R16 | `backend/contracts/asyncapi.yaml` | the `sync:full` `serviceHealth` schema block (around line 652–668); the `DomainStateHealth` schema (around 2590–2600); the `session:start` command payload schema (grep `session:start`); the `SyncFull` (or equivalent) top-level `required` list; the `Session` metadata schema (grep `metadata:` near the Session schema; quote its properties) |
| R17 | `backend/contracts/openapi.yaml` | the `GameState` `serviceHealth` status enum (around line 2005); the `/health` response schema's `pack` identity properties |
| R18 | `backend/tests/e2e/helpers/capabilities.js` | `requireCapabilities` and `requireDegraded` in full; `CAPABILITY_KEYS` |
| R19 | `backend/tests/e2e/helpers/assertions.js` | the health assertion at ~line 187 (the `['healthy','down']` expectation) with 5 lines of context |
| R20 | `backend/tests/rung1/audit-flows.js` | the service-health assertion (grep `healthy` — around line 85–95) |
| R21 | `backend/tests/contract/scanner/client-contract-conformance.test.js` | the test names (`describe`/`it` titles) and what `MESSAGE_TYPES` cross-check asserts; whether any test reads a health enum |
| R22 | `ALNScanner/src/ui/renderers/HealthRenderer.js` | `SERVICE_NAMES`; the collapse rule (around line 48–50); the `isDown` lines (around 83 and 136); the summary/toggle rendering (what text the header shows) |
| R23 | `ALNScanner/src/ui/renderers/CueRenderer.js` | how a cue summary's `enabled` (or `disabledBy`) drives the quick-fire tile and the standing-cue list (quote the lines that read `enabled`/`disabled`); the Enable/Disable button rendering |
| R24 | `ALNScanner/src/admin/SessionManager.js` | `startGame()` in full (the command send, the ack handling, the promise/timeout) |
| R25 | `ALNScanner/src/network/messageRouters.js` | the `gm:command:ack` handling (which router; what it does with `success:false`); the `sync:full` handler's field list for `serviceHealth` |
| R26 | `ALNScanner/src/ui/renderers/` and `src/admin/` | grep `'healthy'` and `'down'` across `ALNScanner/src` (excluding tests): every file:line with the line quoted |
| R27 | `backend/src/services/lightingService.js` | `checkConnection()` and the WebSocket `close` handler's `report` lines (the out-of-band report sites the sticky latch must ignore) |
| R28 | `backend/src/services/mprisPlayerBase.js` | `_setConnected()` and `reset()`'s report lines |
| R29 | `backend/tests/unit/services/serviceHealthRegistry.test.js` (or wherever the registry is unit-tested; grep) | the file path and the `describe` titles |
| R30 | `backend/src/gameRules/endpointServices.js` | the three exports' signatures and the reason strings (this file is new on the branch) |

Completion criterion: thirty sections, each with path + line range + quoted
lines or `NOT FOUND` + grep. Nothing paraphrased where a quote is asked.
