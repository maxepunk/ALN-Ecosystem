# Block 2 (the hardening block) — re-open plan and task ledger

**Status: DRAFT for the pre-build design red team, then the owner's
"before any code" decision (2026-09-12).** Governs CS.2–CS.5 of the ratified C2+C3 design.
Spec (binding authority): `2026-09-04-phase3-c2c3-resolution-dormancy.md`
§8, read with its §5/§6 adjudications; vocabulary `CONTEXT.md` §2, §4,
§5; charter `ROADMAP.md` §4 "Block 2". Census: `2026-09-12-block2-reopen-census.md`
(tree `e87f8c5`). This document adds the re-open rulings, the design
refinements the build needs that the spec leaves open, the task
decomposition, the stop-point inventory, and the checkpoint protocol.
Execution records append below in §9.

**Goal.** The engine tells the truth about health: dormant is a real
third state that never shows red; crashed stack software is restarted a
bounded number of times and then escalated with verbs; the preflight
labels every check paper or live; the GM scanner heals its own stale
pack.

**Method (owner-ruled 2026-09-12, Q1r):** subagent-driven development.
The orchestrator writes this plan and each task's brief, dispatches one
implementer per task (parallel only across disjoint file sets, in
separate worktrees on task branches merged back to `claude/nice-curie-hescfv`),
dispatches a task reviewer after each, runs the fix loop under the
five-round rule, and never edits code. Coupled seams are one task; a
cross-repo parity change is one task holding both sides. The house
close review runs as a workflow at CS.5. Schedule decisions are the
owner's at the §8 checkpoints.

## 1. Rulings recorded at re-open (2026-09-12)

| # | Ruling | Source |
|---|---|---|
| R1 | Build method (b), subagent-driven, with the three guardrails above | owner, grill Q1r |
| R2 | `superpowers@claude-plugins-official` declared; hook self-heals plugins; `subagent-driven-development` and `verification-before-completion` adopted in process.md §1 | owner, Q2 (landed `c921255`) |
| R3 | Workflows for review fleets and censuses, "well-designed and carefully constructed" | owner, Q3 |
| R4 | One PR per touched repo per block, owner merges, Block 3 restarts the branch from `main`; draft PR opens at block open | owner, Q4 |
| R5 | Every live connection must present a credential (GM login token or read-only token); the two tests that pin the open door are rewritten. T3b is in scope. | owner, 2026-09-12 (Q5r) |
| R6 | The restart supervisor ships ENABLED; the host config file carries the off switch | owner, 2026-09-12 (Q6r) |
| R7 | Block 3 fixes reach the producer side | owner, Q8 |
| R8 | Schedule, pauses, and the go-to-green decision are the owner's, taken at the §8 checkpoints on observable reports; no time pricing in this plan | owner, 2026-09-12 |

## 2. Census delta that changes the design (from the re-open census)

- The ALN profile declares NO `endpoints` block while the ALN manifest
  declares `hardware.endpoints['display.main']` (degrade). Under the
  CS.1 resolver that endpoint resolves DORMANT tonight — wrong for the
  full kit. CS.2 must author the ALN endpoints block (D-C2.3) in the
  same task that pins the interior.
- The toy manifest declares `endpoints: {}` and the toy-test-rig
  profile binds every role, so NOTHING can be dormant on the toy leg
  today. The S6 DoD flow needs a toy endpoint need plus a fixture
  profile that omits it (§5, T1b).
- `fireCue` returns `undefined` on a disabled cue and `cue:fire` acks
  success unconditionally (M3 unfixed); one Set serves GM disables and
  will serve dormancy (M4 unfixed); `service_down` cue holds and
  `videoQueueService`'s own hold list never expire, and `endSession`
  touches neither (M5 policy unbuilt).
- `ProcessMonitor` resets its failure counter whenever the child wrote
  ANY output before exiting, so a process that logs then crashes never
  trips `maxFailures`; VLC uses a flat 3 s retry with no backoff. Four
  different supervision shapes exist (ProcessMonitor, HA WebSocket
  linear reconnect, one-shot HA container start, unsupervised Chromium).
- `validateCommand` still has zero production callers;
  `backend/scripts/preflight.js` does not exist; `packNeeds` has no
  `video-file` kind; the rollup has no `disabledCueIds`.
- The three contract enum sites are `asyncapi.yaml:664`, `:2597`
  (carries the never-emitted `degraded`), `openapi.yaml:2005`; the
  scanner cross-check test does not compare enum values.
- `packLoader` has no `refresh()`; the two ROADMAP §8.5 tests are absent.
- `socketServer.js:53` scopes the entire credential check to
  `deviceType === 'gm'`; every production and harness client already
  presents an operator or observe token; only two tests pin the
  tokenless posture (Q5 fact check, 2026-09-12).

## 3. Design refinements this plan pins (attackable by the red team)

The spec leaves these open or names them without a mechanism. Each is a
ruling of this plan, ledgered here, reversible before build.

- **P1. Endpoint → service map.** The profile's endpoint families are
  physical keys (M6: `display.main`, `audio.sinks`, `lighting.instruments`,
  `stations`, `personal`). Dormancy is a SERVICE state. One pure module
  `backend/src/gameRules/endpointServices.js` owns the map:
  `display.main → ['vlc']`, `lighting.instruments → ['lighting']`,
  `audio.sinks → ['audio','sound','music']`, plus the rule
  `bluetooth` is dormant unless some declared sink carries `btAddress`.
  `stations`/`personal` map to no service (device-class needs only).
  An endpoint declared with `installed: false` counts as absent.
- **P2. Dependent needs follow their family.** When an endpoint family
  is dormant, needs that exist only to drive it resolve DORMANT, not
  fault: `lighting-role` and `lighting-role-ref` under a dormant
  `lighting.instruments`; `surface-channel` under a dormant
  `display.main`. This is M7's "the service verdict gates its resource
  verdicts" applied at paper depth. Unbound roles under an INSTALLED
  lighting endpoint stay FAULT (CS.1 adjudication 4 stands).
- **P3. Which cues get dormancy-disabled.** A cue is dormancy-disabled
  at session start when EVERY service-bearing command in it depends on
  a dormant service (nothing left for it to do). A mixed cue stays
  enabled; at fire, each command whose dependency is dormant is refused
  quietly (info log, no `cue:error`, no hold) and the rest run. This
  honors "disabled at session start" (C1 §2) and "degrade, never kill"
  together. `fireCue` on a WHOLLY dormant cue refuses outright with a
  reason (never held).
- **P4. Two disable sets, one predicate.** `cueEngineService` keeps
  `disabledCues` (GM, persisted) and gains `dormancyDisabledCues`
  (recomputed by the feed, never persisted). `isCueDisabled(id)` is
  the union; summaries carry `disabledBy: 'gm' | 'dormant' | null`;
  `cue:enable` on a dormancy-disabled cue is refused.
- **P5. Sticky dormant carries its door.** Registry entries become
  `{status, message, lastChecked, door?}` with `door: 'profile' |
  'operator'` present only when dormant. `report()` is ignored while
  latched (debug log); `startRevalidation` skips dormant ids;
  `isHealthy` is false for dormant; `isDormant(id)` is new; `reset()`
  clears latches and the feed re-applies them.
- **P6. The feed.** `backend/src/services/dormancyService.js`:
  `compute()` (pure over the frozen pack snapshot, the frozen profile,
  and the registry snapshot) returns `{dormantServices: [{id, reason,
  door}], disabledCueIds, verdicts, rollup}`; `apply()` marks the
  registry (door `profile`) and sets the cue engine's dormancy set;
  `recompute()` re-runs both, preserving operator-door latches. It runs
  after every service `init()` in `initializeServices` and before
  `startRevalidation`; at session create; on session restore in
  `sessionService.init`; and in `systemReset` after cues reload. The
  profile stays boot-frozen (recorded posture).
- **P7. The require gate.** `sessionService.startGame({startAnyway =
  false, reason = null})`: after the status check it evaluates the
  preflight; a `no-go` rollup throws `NO-GO: <problems>` unless
  `startAnyway` is true AND `reason` is a non-empty string, in which
  case it logs at warn and stamps `session.metadata.preflightOverride =
  {reason, at, problems}`. `session:start` payload documents both
  fields. "Typed" means the GM types the reason.
- **P8. The preflight stamp and its one evaluator.**
  `backend/src/services/preflightService.js` `evaluate({live})` returns
  `{profileId, forPack, packHash, computedAt, depth, rows, rollup}`
  where a row is `{id, group, verdict: 'go'|'warn'|'no-go'|'dormant'|
  'unknown', depth: 'paper'|'live', reason, verbs: []}`. CS.2 builds it
  with the resolver rows plus the service arm; CS.4 adds the other
  arms and the two presentations. The result is stamped on
  `session.metadata.preflight` at create and start.
- **P9. Delivery of preflight results.** A new `service:state` domain
  `preflight` (`DomainStatePreflight`) plus a nullable `sync:full`
  `preflight` key carrying the last evaluation. No new discrete event;
  `MESSAGE_TYPES` stays untouched. Block 3 audits this domain like the
  other ten.
- **P10. Supervision shape.** `ProcessMonitor` gains a flap window:
  exits are counted within `flapWindowMs` regardless of output, and
  `maxFailures` inside the window trips `gave-up`; `restart()` clears
  the counter and starts; `status()` reports `{running, failures,
  gaveUp}`. Strategies come from host config (P11). On `gave-up` the
  owning service reports `down` with the message "crashed N times in
  Ws — supervision stopped; Restart to try again". The HA WebSocket
  reconnect and container start keep their shapes but gain the same
  bound and the same escalation message. Chromium gets ProcessMonitor
  supervision with the same strategy table; the display is NOT a ninth
  registry service (the contract's required eight stand); display
  liveness is a preflight row (P12).
- **P11. Host config.** `backend/config/host.json` (venue/machine
  owned, never pack or profile content) with `host.schema.json`:
  `{ "supervision": { "<process>": { "enabled", "maxFailures",
  "restartDelayMs", "backoffMultiplier", "flapWindowMs" } } }` for
  `vlc`, `mpd`, `chromium`, `haWebSocket`, `haContainer`. Read once at
  boot by `hostConfigService` through a `HOST_CONFIG_PATH` seam with
  the loud-override warn (the profileService template). Shipped
  defaults: enabled, 5 failures, 3000 ms, ×2, 60 s window. Shipped `enabled: true`
  (owner ruling 2026-09-12).
- **P12. Verbs are commands.** New gm:command actions:
  `service:restart {serviceId}` (vlc: monitor restart + owner
  re-resolve; music: MPD respawn; lighting: container ensure +
  reconnect; audio/sound/bluetooth: re-run `init()` probe; gameclock/
  cueengine: no-op success), `service:out-of-service {serviceId,
  reason}` (dormant's second door: operator latch, floor function
  `show-control`), `service:in-service {serviceId}` (clears the operator
  latch, recomputes, probes). Re-route is the existing `audio:route:set`;
  Release/Discard are the existing held commands. The scanner renders
  verbs per status.
- **P13. Hold policy.** `endSession` expires every `service_down` hold
  in both stores (`cueEngineService.expireHolds('session_end')`,
  `videoQueueService.expireHolds()`), emitting the existing discarded
  events. Dormant never holds: `fireCue` refuses (P3); `processQueue`
  refuses a video when `vlc` is dormant by failing the item with
  "video unavailable (not installed tonight)" instead of holding; the
  player-scan route answers its existing `409 {status:'rejected'}` wire
  for a dormant `vlc`. `video_busy` keeps its 10 s auto-discard.
- **P14. Self-heal.** The server's active pack identity already rides
  `sync:full.pack`. The scanner compares it to
  `packLoader.getActivePack().contentHash` on every `sync:full`; on
  mismatch, when orchestrator-served, it calls the new
  `packLoader.refresh()` (network tier only; throws on failure),
  re-applies the loaded pack through `tokenManager`, reconnects with the
  new `packHash`, and shows one toast "Rules updated to <version>". On
  failure it shows a blocking screen with a plain instruction (reload)
  and stops there. The server keeps its warn. The two §8.5 tests land in
  this task.
- **P15. Every connection presents a credential (R5).** `socketServer.js`
  requires an operator or observe token for EVERY connection; the two
  tests that pin the tokenless posture are rewritten to expect
  `connect_error`. GM impact: none (every client already complies).

## 4. Task decomposition

Worktrees: task branches `claude/nice-curie-hescfv-<task>` cut from the
designated branch; each merged back by the orchestrator after its task
review; the designated branch is the only one pushed. Scanner tasks run
in the ALNScanner submodule on its own task branches the same way.
Backend tasks that both touch `commandExecutor.js` and the asyncapi
action list are sequenced (T3 before T4); T1a pre-registers every new
action name in the contract enum, `REQUIRED_PAYLOAD_FIELDS`, and the
floor map so later tasks add switch cases only.

| Task | Stage | Repo | Runs with | Model |
|---|---|---|---|---|
| T1b profile interior + endpoint map + fixtures | CS.2 | backend, TokenData? (no: manifests only under backend fixtures and ALN-TokenData `pack-manifest.json` for the toy? — see below) | T1a | sonnet |
| T1a dormancy core + enum + gate + render-safe scanner | CS.2 | backend + contracts + ALNScanner + e2e helper | T1b | opus |
| T3 supervisor + host config + verbs + holds | CS.3 | backend + contracts | T4, T5 | opus |
| T3b every connection presents a credential | CS.3 | backend | T3 | sonnet |
| T4 preflight arms + CLI + video-file need + F-P2-7/8 | CS.4 | backend + contracts + docs | T3, T5 | opus |
| T5 scanner self-heal + verbs + §8.5 tests | CS.3 | ALNScanner | T3, T4 | opus |
| T6 scanner preflight panel | CS.4 | ALNScanner | after T5 | sonnet |
| T7 close: hygiene, workflows, records, dist, legs | CS.5 | all | after all | sonnet + review workflow |

T1b touches only pack manifests, profiles, the profile schema, the new
pure module, and their tests, so it runs beside T1a. The toy pack's
manifest lives at `backend/tests/e2e/fixtures/packs/toy-heist/`; the
ALN manifest at `ALN-TokenData/pack-manifest.json` is NOT edited (its
endpoint declaration already exists; the ALN change is the profile).

### T1b — endpoint interior, endpoint map, profiles and fixtures (CS.2)

Files: `backend/config/profiles/installation-profile.schema.json`
(endpoints interior), `backend/config/profiles/aln-full-kit.json`
(endpoints block), `backend/src/gameRules/endpointServices.js` (new),
`backend/tests/e2e/fixtures/packs/toy-heist/pack-manifest.json`
(add `hardware.endpoints['lighting.instruments']` degrade, rebuild the
manifest with `node backend/scripts/build-pack-manifest.js`),
`backend/tests/e2e/fixtures/profiles/toy-test-rig.json` (declare
lighting installed), new `backend/tests/e2e/fixtures/profiles/toy-dormant-lighting.json`
(omits `lighting.instruments`), `backend/scripts/lib/simulationProfile.js`
(declare the pinned interior shape for generated endpoints),
`backend/tests/contract/profile/installation-profile-schema.test.js`,
`backend/tests/unit/gameRules/endpointServices.test.js` (new),
`.github/workflows/test.yml` (a third Tier L leg: toy pack with
`E2E_PROFILE_PATH` = the dormant profile, capability-gated like the
others).

Produces: `servicesForEndpoint(id)`, `dormantServicesFor(profile)`
→ `{serviceId: reason}` (applies the `btAddress` rule), `ENDPOINT_FAMILIES`.
Interior (schema, `additionalProperties: false`): `display.main
{installed: boolean, output?: string}`, `audio.sinks: [{id, installed,
btAddress?, label?}]`, `lighting.instruments {installed, provider}`,
`stations {count}`, `personal {expected}`.

Red-first tests: schema refuses an unknown endpoint key and an
`installed` that is not boolean; the ALN profile validates and declares
all five families installed; `dormantServicesFor(aln)` is empty;
`dormantServicesFor(toyDormant)` is `{lighting: 'not installed tonight'}`;
a profile whose sinks carry no `btAddress` yields `bluetooth` dormant;
the simulation generator's output validates against the schema.

Done when: both profiles and the simulation output validate; the toy
manifest regenerates with a fresh `contentHash`; the new leg appears in
the matrix; all listed tests pass red-then-green; lint clean.

### T1a — dormancy core, enum, require gate, render-safe scanner (CS.2)

Files (backend): `serviceHealthRegistry.js` (P5), `gameRules/resolution.js`
(P2 dependent-need rule; endpoint `installed:false`), `services/dormancyService.js`
(new, P6), `services/preflightService.js` (new, P8 minimal: resolver rows +
service arm), `cueEngineService.js` + `cue/standingEvaluator.js` (P3, P4:
two sets, `isCueDisabled`, `fireCue` returns `{fired, reason, services?}`,
`enableCue` returns `{ok, reason}`, `setDormancyDisabled(ids)`, summaries
`disabledBy`), `commandExecutor.js` (dormant rejection branch "<svc> is
not installed tonight (dormant): <reason>"; `cue:fire` acks `success:false`
with the reason when not fired; `cue:enable` refusal; pre-register
`service:restart`, `service:out-of-service`, `service:in-service`,
`preflight:run` in `REQUIRED_PAYLOAD_FIELDS` and the floor map with
no switch case yet), `sessionService.js` (P7 gate; feed at create and
restore; stamp), `systemReset.js` (feed after cues reload), `app.js`
(feed before `startRevalidation`), `websocket/syncHelpers.js`
(`preflight` key, `profile` identity), `routes/healthRoutes.js`
(`profile` identity, F-P2-8), contracts: `asyncapi.yaml` (three enum
sites → `[healthy, down, dormant]`, `degraded` deleted; `door`
optional; new actions in the enum; `session:start` payload fields;
`sync:full.preflight` and `.profile`; `DomainStatePreflight`),
`openapi.yaml` (`GameState` enum; `/health` profile), the scanner
cross-check test gains an enum-values assertion across the three sites
and the registry validator; `backend/tests/e2e/helpers/capabilities.js`
(dormant is its own capability state: `caps[key] = false`,
`caps.dormant[key] = true`). Files (scanner): `HealthRenderer.js`
(three states: healthy ok, down red with Check Now, dormant grey with
the door's wording "not installed tonight" / "out of service"; collapse
when every service is healthy or dormant; summary counts "N/M
operational, K not installed"), its unit test.

Consumes from T1b: `dormantServicesFor`, `ENDPOINT_FAMILIES`.

Red-first tests (seams): registry (`markDormant` latches; `report`
ignored while latched; `clearDormant` unlatches; snapshot carries
`door`; revalidation skips dormant; `reset` clears); dormancyService
(ALN profile → nothing dormant, no disabled cues; toy dormant profile →
`lighting` dormant, the toy's lighting-only cue in `disabledCueIds`, a
mixed cue not in it; operator latch survives `recompute`); cue engine
(wholly dormant cue: `fireCue` → `{fired:false, reason:'dormant'}` and
NO hold; mixed cue fires, dormant command refused with an info log and
no `cue:error`; `enableCue` on dormancy-disabled → `{ok:false}`; GM set
persists, dormancy set does not; both honored by `findMatching*`);
commandExecutor (dormant wording; `cue:fire` ack false; `cue:enable`
refusal); startGame (no-go throws naming problems; `startAnyway`
without reason throws; with reason starts and stamps the override);
systemReset (dormancy re-applied after reset — the M2 pin);
contracts (the three sites agree; scanner cross-check); HealthRenderer
(dormant renders grey, no Check Now, collapsed when all healthy or
dormant). Integration: `service-state-push` gains a dormant push;
`sync:full` completeness test covers `preflight` and `profile`.

Done when: every test above passes red-then-green; backend unit +
contract + integration green; scanner unit green; lint and ratchet clean
in both repos; dist rebuilt.

### T3 — supervisor, host config, verbs, hold policy (CS.3)

Files: `utils/processMonitor.js` (P10), `config/host.json` +
`config/host.schema.json` + `services/hostConfigService.js` (P11),
`vlcMprisService.js`, `musicService.js`, `lightingService.js`,
`utils/displayDriver.js` (strategies from host config; gave-up →
registry `down` with the escalation message; `restart()` entry points),
`commandExecutor.js` (three `service:*` cases, P12), `sessionService.js`
`endSession` (P13), `cueEngineService.js` `expireHolds`,
`videoQueueService.js` (`expireHolds`; dormant vlc fails the item, never
holds), `routes/scanRoutes.js` (dormant vlc → the 409 rejected wire),
`contracts/asyncapi.yaml` (verb payloads documented), tests for each.
Consumes from T1a: registry `isDormant`, `markDormant` doors, the
pre-registered actions.

Red-first tests: ProcessMonitor (a child that prints then exits
N times within the window trips `gave-up`; outside the window the
counter decays; `restart()` after gave-up starts again); host config
(defaults load; `HOST_CONFIG_PATH` override warns; a bad file degrades to
defaults loudly); vlc (gave-up reports `down` with the escalation
message; `service:restart` restarts and re-resolves the owner); music
and lighting equivalents; chromium (supervised, bounded); `endSession`
expires holds in both stores with discarded events; dormant vlc video
path (no hold, item failed, scan route 409); `service:out-of-service`
latches with door `operator`, requires `show-control`, recompute
disables dependent cues; `service:in-service` clears and probes.

Done when: tests pass red-then-green; backend suites green; the rig
scenario "kill cvlc five times in a minute" shows the red row message in
`getSnapshot()` and `service:restart` recovers (rung-1 audit-flows
assertion added).

### T3b — every connection presents a credential (CS.3)

Files: `websocket/socketServer.js` (P15), `tests/unit/websocket/socketMiddleware.test.js`,
`tests/integration/admin-interventions.test.js`. Red-first: a tokenless
socket gets `connect_error AUTH_REQUIRED`; an observe token connects
read-only; the scoreboard E2E flow still passes. Done when both suites
are green and the scoreboard flow passes.

### T4 — preflight arms, CLI, video-file need, pack integrity (CS.4)

Files: `gameRules/packNeeds.js` (+ `video-file` kind from token `video`
fields and `video:queue:add` payloads incl. timelines) and
`gameRules/resolution.js` (its case: live file check), `services/preflightService.js`
(arms: pack refs incl. videos and sounds; bindings with live scene
existence when lighting is healthy else `unknown`; services from the
registry incl. dormant; media incl. the bound idle-loop file; network
from `profile.network.kitNetwork` (DNS answers `orchestratorName` with
`orchestratorIp`; gateway reachable) else `unknown`; devices (connected
staffed count vs manifest min; stations `unknown` until synced counts
exist); host (disk free, CPU temperature, load, listening ports 3000 and
8000, PID-file orphans); certificate expiry as `warn` only (R8);
display liveness (kiosk process alive and an observe socket connected);
pack integrity (each manifest file's sha1 vs disk, F-P2-7) — every row
labeled paper or live with the profile id), `commandExecutor.js`
(`preflight:run` case → evaluate live → push domain `preflight` +
stamp), `websocket/broadcasts.js` (domain wiring), `scripts/preflight.js`
(new CLI: `--pack`, `--profile`, `--json`; without a running engine the
service and display arms report `unknown`), `docs/preflight-checklist.md`
(restructure: groups the instrument covers point at it; host
fundamentals stay hand-run), tests. Consumes from T1a: `preflightService`
skeleton, the `preflight` domain schema, the pre-registered action.

Red-first tests: each arm on the ALN and toy packs (paper rows without
inventory; live rows with a stubbed inventory); the CLI's JSON equals
the service's rows for the same tree; `video-file` needs appear for
every token video and cue video; pack integrity flags an edited file.

Done when: tests pass; CLI runs on both packs from a clean checkout;
the checklist document's absorbed sections each point at a row id.

### T5 — scanner self-heal, verbs, §8.5 tests (CS.3, ALNScanner)

Files: `src/core/packLoader.js` (`refresh()`), `src/network/networkedSession.js`
or `messageRouters.js` (`sync:full` hash compare → heal), `src/core/tokenManager.js`
(re-apply path), `src/network/connectionManager.js` (reconnect with the
new hash), a backstop screen, `src/ui/renderers/HealthRenderer.js`
(verbs: Restart on down; Run without it on down; Put back in service on
operator-dormant; wired through `domEventBindings.js` and `AdminOperations.js`
to the three `service:*` commands), tests: heal path (mismatch →
refresh → reconnect → one toast), backstop (refresh fails → blocking
screen), the behavioral timeout test (a hung fetch aborts after the
timeout and falls through), the staging-cache race test (forced
interleaving leaves the pointer untouched), verbs render per status.

Done when: scanner unit green; the L2 suite green; E2E: a scanner
loaded with a different pack hash reconnects with the server's hash
after one toast (a new backend E2E flow on the toy leg, using
`E2E_PACK_PATH` to boot a divergent server pack).

### T6 — scanner preflight panel (CS.4, ALNScanner)

Files: `src/ui/renderers/PreflightRenderer.js` (new: grouped rows,
verdict, paper/live label, profile id, computed-at, a "Run preflight"
button → `preflight:run`), `MonitoringDisplay.js` (subscribe domain
`preflight`), `messageRouters.js` (`sync:full.preflight` restore with a
guard that also clears on null — the Block 3 stale-store lesson applied
early), `index.html` (the section), tests. Done when: unit green; L2
green; the rows render from a fixture equal to the CLI's JSON.

### T7 — close (CS.5)

Workflows hardening (LC-6/P9b-9: `permissions:` blocks, action SHA
pins, concurrency on `capability-probe.yml`); rig hygiene (P9b-4/8 per
the review's wording); the §2.2 test-quality and contract-truth sweep
(rows from the census once filled); records (CLAUDE.md files for the
enum, the domain, the verbs, host config; CONTEXT.md if a term
sharpened; PHASE3-STATUS row; CURRENT-STATE); dist rebuild; the close
gate: backend unit + contract + integration + ratchet + lint; scanner
unit + ratchet + lint + L2; config-tool; scripts; dual-pack Tier L
legs plus the dormant-lighting leg; `rung1.yml`; the whole-unit
adversarial review as a workflow (finders per task, Opus medium; lenses:
state-machine and security, Opus high; parity lens re-executing the
health enum on both sides; refuters, Fable high for MAJORs); all
findings dispositioned; execution record appended.

## 5. DoD pins (S6 plus this plan)

(a) On the toy pack with the dormant-lighting profile: a lighting
gm:command is refused with "not installed tonight" and NO hold appears.
(b) The toy's lighting-only cue is in the dormancy-disabled set at
session create AND after a restart restore; a mixed cue is not.
(c) `sync:full.serviceHealth.lighting.status === 'dormant'` with `door:
'profile'`. (d) The GM health dashboard renders lighting grey and stays
collapsed (post dist rebuild). (e) On the rig, killing `cvlc` five times
inside a minute yields a red vlc row carrying the escalation message
and `service:restart` recovers playback. (f) A profile that omits a
`require` endpoint makes `session:start` refuse; `startAnyway` with a
typed reason starts and the override is stamped and logged. (g) The CLI's
JSON and the panel's rows agree for the same tree. (h) A scanner loaded
with a stale pack reconnects with the server's hash after one toast.

## 6. Global constraints

Contract-first at every wire change (three enum sites, new actions, the
new domain, the sync:full keys). Red-first at the seams named per task;
no test at an unagreed seam. No new discrete WebSocket event;
`MESSAGE_TYPES` untouched. The registry's eight services stand. Ratchet
never lowered; lint clean in both repos; every close gate includes the
integration suite. Vocabulary per `CONTEXT.md`; every temporary construct
gets a ledger row. Implementers never dispatch subagents. Every claim of
"done" is verified against the diff and a fresh run.

## 7. Scope inventory and stop points (replaces the estimate — owner ruling 2026-09-12)

The owner ruled that pricing in time units is not this plan's to make:
schedule, pause, and go-to-green decisions are the owner's, taken at the
checkpoints in §8 on observable reports. This section states what each
task delivers and whether the tree is a coherent stopping point after it.

| Task | Delivers (observable) | Depends on | Stop point after it? What the GM has |
|---|---|---|---|
| T1b | Profile equipment interior pinned in the schema; ALN kit declares its equipment; toy fixture with lighting uninstalled; endpoint→service map; a third Tier L leg | — | Yes. No behavior change yet. |
| T1a | Three health words end to end (registry, three contract sites, scanner); sticky dormant with its door; cues silenced when their equipment is absent; session-start refusal with typed override; preflight stamp (service rows only); profile identity in `/health` and `sync:full` | T1b | **Yes — the Block 2a candidate.** Uninstalled equipment never shows red; a session cannot start with required equipment missing. No supervisor, no verbs, no preflight panel. |
| T3 | Bounded restart with a flap window and escalation; host config file with a path seam; `service:restart` / `service:out-of-service` / `service:in-service` commands; holds expire at session end; dormant video refused, never held | T1a | Yes, coherent; the commands exist but the GM sees their buttons only after T5. |
| T3b | Every live connection presents a credential; the two open-door tests rewritten | T1a | Yes. |
| T4 | Preflight arms (pack files incl. videos, bindings, services, media, network, staffing, host, certificate as warn, display liveness, pack integrity); the command-line twin; the checklist document points at the instrument | T1a | Yes; the CLI is usable, the panel waits for T6. |
| T5 | Scanner heals its own stale pack with one toast and a backstop screen; dashboard verbs; the two owed pack-loader tests | T1a | Yes. |
| T6 | Preflight panel in the GM scanner | T4, T5 | Yes. |
| T7 | Close: hygiene items, records, dist, both end-to-end legs plus the dormant leg, the whole-unit adversarial review | all landed tasks | Required before ANY merge, wherever the owner stops. |

Dependency rounds: T1a‖T1b → T3‖T4‖T5 (T3b with T3) → T6 → T7. A
stop at T1a means T7 runs on that tree.

## 8. Checkpoints and reporting (owner decides; wording ruled 2026-09-12)

The owner makes every schedule, pause, and go-to-green decision. The
orchestrator stops and reports at these six points, named in plain
words, and nowhere else:

1. **Before any code.** The red-teamed plan and the §7 inventory are
   on the table. The owner decides whether the first round starts.
2. **After the dormancy core lands** (T1a and T1b reviewed and
   merged). The owner decides: continue, stop here and move to the
   green machine, or change the order.
3. **After the supervisor, the preflight, and the self-heal land**
   (T3, T4, T5, and the panel T6 reviewed and merged).
4. **After the close review** (T7 done; the tree is ready to merge).
5. **Before Block 3 builds** (its design and red team are done).
6. **After each Block 3 fix cluster** is proven on the rig.

Every report has the same five lines: what landed (commits, tests that
went red then green, gates passed); what is in flight; what is blocked
and on whom; what the GM has if we stop here; open risks. Reports carry
no time estimates.

Between checkpoints the orchestrator does not stop to ask. Rulings on
plan conflicts are the orchestrator's and are written in §9, per the
ruled method.

## 9. Execution record

(appended per stage close: commits, test counts, review verdicts, rulings)
