# Block 2 (the hardening block) — re-open plan and task ledger

**Status: RED-TEAMED (three lenses, 99 findings, every one ruled in
`2026-09-12-block2-redteam-adjudication.md`); awaiting the owner's
"before any code" decision (2026-09-12).** Governs CS.2–CS.5 of the
ratified C2+C3 design. Spec (binding authority):
`2026-09-04-phase3-c2c3-resolution-dormancy.md` §8, read with its §5/§6
adjudications; vocabulary `CONTEXT.md` §2, §4, §5; charter `ROADMAP.md`
§4 "Block 2". Census: `2026-09-12-block2-reopen-census.md` (tree
`e87f8c5`; plan restamped at `git rev-parse HEAD` of the commit that
carries this text). This document adds the re-open rulings, the design
refinements the build needs that the spec leaves open, the task
decomposition, the stop-point inventory, and the checkpoint protocol.
Execution records append below in §9.

**Goal.** The engine tells the truth about health: dormant is a real
third state that never shows red; crashed stack software is restarted a
bounded number of times and then escalated with verbs; the preflight
labels every check paper or live and states its own limits; the GM
scanner heals its own stale pack at a session boundary.

**Method (owner-ruled 2026-09-12, Q1r):** subagent-driven development.
The orchestrator writes this plan and each task's brief, dispatches one
implementer per task (parallel only across disjoint file sets, in
separate worktrees on task branches merged back to
`claude/nice-curie-hescfv`), dispatches a task reviewer after each,
runs the fix loop under the five-round rule, and never edits code.
Coupled seams are one task; a cross-repo parity change is one task
holding both sides. The house close review runs as a workflow at CS.5.
Schedule decisions are the owner's at the §8 checkpoints.

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
| R9 | The pre-build red team's 99 findings are ruled in the adjudication record (first recorded as 100 from the three lens headers; the security report's count line says 14 MAJOR where its table holds 13 — recounted from the tables at checkpoint 1, every id present in the adjudication); the twelve owner-visible rulings (★ there) are reported at the "before any code" checkpoint | orchestrator, 2026-09-12 |
| R10 | Re-slice recorded: dormant's operator door rides T3 with the verb commands (ratified CS.2 text put both doors in CS.2) | orchestrator, 2026-09-12 (D-26) |
| R11 | The kit's network values were already in the repo (owner, checkpoint 1: "don't you have the ssid, ip, dns name in our repos already?"); T1b authors the ALN profile's `network` block: SSID `aboutlastnetwork`, IP `192.168.0.191` (owner-stated production values; the ESP32 sample config's `Sidewinder` / `10.0.0.177` are not the production values), `localDnsOverride: true` per CONTEXT.md §5. The DNS name is NOT in the repo as a decision (the July design's `play.aboutlastnightgame.com` sits beside placeholder SSID/IP values) — `orchestratorName` stays omitted until the owner states it. SEC-25's "owner task" narrows to that one value | owner + orchestrator, 2026-09-12 |

## 2. Census delta that changes the design (from the re-open census)

- The ALN profile declares NO `endpoints` block while the ALN manifest
  declares `hardware.endpoints['display.main']` (degrade); the toy
  manifest declares `endpoints: {}`; the generated simulation profile
  declares only the families a manifest names. Dormancy must key on
  manifest-declared families, and both manifests must declare the
  families they really use (T1b).
- `fireCue` returns `undefined` on a disabled cue and `cue:fire` acks
  success unconditionally (M3 unfixed); one Set serves GM disables,
  `once` consumption, and would serve dormancy (M4 unfixed; the census
  missed the two `once` auto-disable sites); `service_down` cue holds
  and the video queue's own hold list never expire, and `endSession`
  touches neither (M5 policy unbuilt).
- `ProcessMonitor` resets its failure counter whenever the child wrote
  ANY output before exiting; VLC uses a flat 3 s retry; three of its
  five consumers are long-running observers that must never be capped.
  Four supervision shapes exist; Chromium has none and no red row.
- `validateCommand` has zero production callers;
  `backend/scripts/preflight.js` does not exist; `packNeeds` has no
  `video-file` kind; the rollup has no `disabledCueIds` and its
  `dormantServices` carries a stale r1 comment.
- The three contract enum sites are `asyncapi.yaml:664`, `:2597`
  (carries the never-emitted `degraded`), `openapi.yaml:2005`; the
  scanner cross-check test does not compare enum values; `grants.js`
  floors `service:` but not `preflight:`.
- `packLoader` has no `refresh()`; its pointer flip precedes consumer
  validation; the two ROADMAP §8.5 tests are absent.
- `socketServer.js:53` scopes the entire credential check to
  `deviceType === 'gm'`; every production and harness client already
  presents a token; three tests pin the tokenless posture.

## 3. Design pins (each a ruling of this plan; the adjudication record cites the finding behind every change)

- **P1. Equipment families → dormant services (refinement of M6's open
  interior, SB-2 ★).** The profile's `endpoints` interior is C1 §1
  verbatim: `display.main {installed, output?}`, `audio.sinks:
  [{id, installed, btAddress?, label?}]`, `lighting.instruments
  {installed, provider}`, `stations {count}`, `personal {expected}`.
  Dormancy keys on a family the pack MANIFEST declares as a need
  (`hardware.endpoints.<family>`) that the profile omits or declares
  `installed: false`. The pure module `gameRules/endpointServices.js`
  owns the map: `display.main → vlc, display`; `lighting.instruments →
  lighting`; `audio.sinks` (declared, none installed) → `sound, music`;
  `audio` dormant only when no sink AND no `display.main` (an installed
  display implies the HDMI sink). The Bluetooth service is the adapter,
  a capability: never profile-dormant. `stations` and `personal` map
  to no service. `hardware.stack.<svc>.onAbsent` is read for row
  severity only; a down stack service is a fault with verbs (C1 §2
  row 1) and never blocks a start. The simulation generator declares
  every family the manifest names, so rung 1 is never dormant.
- **P2. Dependent needs follow their family (C1 §2 row 3; CS.1
  adjudication 4).** Under a dormant `lighting.instruments`,
  `lighting-role` and `lighting-role-ref` resolve DORMANT; under a
  dormant `display.main`, `surface-channel` does. Unbound roles under
  an INSTALLED family stay FAULT. Bindings under a dormant family are
  ignored with a warn (the endpoint wins).
- **P3. Which cues are silenced (refinement of D-C3.2, argued from
  S2's reasoning, D-5 ★).** At session start a cue is dormancy-disabled
  when it has at least one service-bearing command AND every one of
  them depends on a dormant service, or when any entry of its
  TIMELINE depends on one (a compound cue is never "mixed"). A mixed
  simple cue stays enabled; its summary carries `dormantCommands:
  [{action, service, door}]` and the quick-fire tile shows the badge;
  at fire, each dormant command is refused quietly (info log, no
  `cue:error`, no hold) and the rest run. `fireCue` returns
  `{fired, held, reason}`: a wholly dormant cue is refused outright
  (never held); `cue:fire` acks `held` as success with the parked
  message and refusals as `success:false`; `releaseCue` propagates the
  outcome and re-holds with the new reason on a refusal. The dormancy
  check runs before lighting-role normalization. When a cue id leaves
  the dormancy set during an active session, its past-due clock
  threshold is marked fired (reuse `_markPastClockCuesFired`).
- **P4. Three disable provenances.** `disabledCues` (GM, persisted),
  `spentOnceCues` (fired once-cues, persisted), `dormancyDisabledCues`
  (recomputed, never persisted). `isCueDisabled(id)` is the union;
  summaries carry `disabledBy: 'gm' | 'once' | 'dormant' | null`;
  `cue:enable` on a dormancy-disabled cue is refused.
- **P5. Sticky dormant carries its door.** Registry entries are
  `{status, message, lastChecked, door?}`, `door: 'profile' |
  'operator'` present only when dormant. `report()` is ignored while
  latched (debug log); `startRevalidation` skips dormant ids;
  `isHealthy` is false and `isDormant` true for dormant; `reset()`
  preserves dormant entries; `markDormant`/`clearDormant` check
  `KNOWN_SERVICES`. One wording helper keyed on `door` ("not installed
  tonight" / "out of service") serves the executor, the renderer
  summary and the row.
- **P6. The feed.** `services/dormancyService.js` owns `compute()`
  (pure over the frozen pack snapshot, the frozen profile and the
  registry), `apply()`, `recompute()`, AND the operator-latch set (the
  authority; the registry entry is its projection; latches survive
  `system:reset` and are lost on a process restart, recorded). Run
  points: the end of `initializeServices` (after every service init,
  before revalidation; this also covers restore after a restart), at
  session create, inside system reset after cues reload. The profile
  stays boot-frozen.
- **P7. The require gate.** `sessionService.startGame({startAnyway,
  reason}, actor)`: after the status check it evaluates live and
  refuses only when `blocking` (unresolved `onAbsent: require` needs,
  the one list the require rule alone can populate) is non-empty; no
  arm added later may widen it. `startAnyway` needs a normalized,
  non-empty `reason` (control and bidi strip, no pipes, 350 code
  points); the override stamp is `{reason, at, blocking, byDeviceId,
  byTier}` and the warn logs the same fields as metadata. The typed
  dialog ships in the same task as the gate (SB-6 ★). On restore of a
  non-ended session at boot the evaluation is re-run and re-stamped
  with `restoredAt`; a `no-go` there is a loud warn and a GM-visible
  row, never a refusal.
- **P8. One preflight evaluator.** `services/preflightService.js`
  `evaluate({live})` returns `{profileId, forPack, packHash,
  computedAt, depth, rows, rollup, blocking, limits}`. Rows quote
  `resolve()`'s verdicts verbatim (`runs | dormant | fault | no-go |
  unknown`), carry `depth`, `reason`, `verbs`, and a `severity` field
  (the certificate warn class; `fault` severity from
  `stack.onAbsent`). Resource rows come from iterating the pack's cue
  commands through `validateCommand` (its first production caller);
  the service adds only token videos via the `video-file` need. The
  fixed `limits` block (`verifies`, `cannotVerify`, `humanChecklist`)
  is the honesty rule's face. The service holds the last evaluation
  (the one source); the session stamp and the domain push derive from
  it. Every shell-out goes through `execHelper` with a bounded
  timeout; no sync fs on the evaluate path; DNS via `dns.Resolver`
  with a timeout; gateway reachability as a bounded TCP connect; a
  single-flight guard and a total wall-clock budget, over-budget arms
  reporting `unknown`.
- **P9. Delivery.** A new `service:state` domain `preflight`
  (`DomainStatePreflight`), OPERATOR-ONLY: emitted to a `show-control`
  room joined by sockets whose functions include it; `sync:full.
  preflight` is required-and-nullable and null for tier `device`. No
  new discrete event; `MESSAGE_TYPES` untouched. The seven contract
  and test sites for a new domain are enumerated in T4.
- **P10. Supervision.** `ProcessMonitor` gains `supervisionKind`:
  services (vlc, mpd, chromium) get a sliding flap window over exit
  timestamps, `maxFailures` inside it trips `gave-up`, a computed-delay
  cap and a non-finite fallback; observers (pactl subscribe, the two
  D-Bus monitors) keep unbounded restart with backoff and never
  escalate. `restart()` clears the pending timer, kills the child and
  awaits close, resets the counter, starts, emits `restarted`. On
  `gave-up` the owning service reports `down` with "crashed N times in
  Ws — supervision stopped; Restart to try again". Supervision is
  dormancy-aware: a profile-dormant service's child is neither started
  nor restarted; an operator latch stops restarts; `service:in-service`
  starts it. Chromium is display-aware: restart only while the
  scoreboard is the intended visible mode, with `_doLaunch`'s orphan
  sweep as the pre-start hook; dead-while-hidden relaunches on show.
  The HA WebSocket reconnect stays unbounded with a capped backoff and
  escalates on elapsed downtime; `down` is reported on `auth_invalid`.
- **P11. Host config is the single source (SM-13 ★).**
  `backend/config/host.json` is gitignored and optional (absent =
  defaults, no warn); the repo ships `config/host.example.json` and
  `host.schema.json`; `HOST_CONFIG_PATH` is the venue seam with the
  loud-override warn. Per process (`vlc`, `mpd`, `chromium`,
  `pactlSubscribe`, `dbusMonitorVlc`, `dbusMonitorBluez`, `haWebSocket`,
  `haContainer`): `mode: 'self' | 'adopt' | 'off'` plus `maxFailures`
  1–20, `restartDelayMs` 250–60000, `backoffMultiplier` 1–10,
  `flapWindowMs` 5000–600000 (observers: `backoffCapMs`; HA:
  `escalateAfterMs`). Read once at boot, AJV-validated, clamped per
  field with a loud warn. `VLC_SELF_SPAWN` and `ENABLE_MUSIC_PLAYBACK`
  become deprecated aliases read once with a warn. Shipped `mode:
  self` (R6). The venue's off switch is a hand-edited JSON file on the
  show machine. Headroom recorded: `processes.<id>.bin/user`, the
  runtime dir.
- **P12. Verbs are commands.** `service:restart {serviceId}` (vlc:
  monitor restart + owner re-resolve, or owner re-resolve only in adopt
  mode with the ack saying so; music: MPD respawn; lighting: container
  ensure + reconnect; display: relaunch; audio/sound/bluetooth: re-run
  the `init()` probe; gameclock/cueengine: no-op success),
  `service:out-of-service {serviceId, reason}` (operator door: latch,
  stop restarts, expire every hold blocked by that service),
  `service:in-service {serviceId}` (clear the latch, start the child,
  recompute, mark past-due cues fired, probe), `preflight:run`. Floors:
  `service:` inherits `show-control`; `preflight:` → `show-control`
  added; `RULED_NON_FLOOR` stays empty. All four are ungated by the
  health gate and exempt from the dormant branch, in the
  `service:check` idiom; `service:check` on a dormant id acks the door
  wording without probing; `serviceId` is checked against
  `KNOWN_SERVICES`. `reason` is normalized as in P7 and `maxLength` is
  pinned on `message` at both health sites.
- **P13. Hold policy.** One expiry method, called unconditionally by
  `endSession` and by system reset, iterates both stores and calls the
  per-item service discard (the store emits nothing). An operator
  latch expires the holds it blocks immediately. Dormant never holds:
  `fireCue` refuses (P3); `processQueue` fails an already-queued item
  when `vlc` is dormant instead of holding; the player-scan route's
  existing `409 {status:'rejected'}` wire needs no change. `video_busy`
  keeps its 10 s auto-discard.
- **P14. Self-heal (refinement of R-C2-1, SB-7 ★).** The scanner
  compares `sync:full.pack.contentHash` to its active pack. At a
  session boundary (first `sync:full` of a connection with no active
  session, or no local transactions for the current session) it heals:
  `packLoader.refresh({baseUrl})` fetches from the CONNECTED
  orchestrator regardless of serving origin, as `loadPack()`'s network
  tier verbatim (staging, sha1 verify, no cache or bundled fallback),
  validates the consumer re-apply against the staged content, and only
  then flips the pointer and GCs; then it re-applies through
  `tokenManager`, reconnects with the new hash (tolerating one
  `DEVICE_ID_COLLISION` with a short bounded retry), and shows one
  toast "Rules updated to <version>". At most one attempt per
  `{connection, serverHash}`; a failed heal shows the blocking
  backstop with a plain instruction. Mid-session a mismatch shows a
  persistent non-blocking banner and heals at the next boundary. The
  server keeps its warn. The two §8.5 tests land in this task.
- **P15. Every connection presents a credential (R5; SEC-08 ★).** The
  handshake requires a verified operator or observe token AND
  `deviceType: 'gm'`; any other deviceType is refused (no production
  client sends one; the contract's `admin` value is removed after a
  grep proves no sender). The whole identity block leaves the branch;
  only the collision check stays GM-scoped. `sync:request` stays open
  to any credentialed socket and uses the non-mutating getter. Observe
  tokens evict per deviceId. `/health` carries only `{profileId,
  forPack}`. What the gate achieves: the tokenless path is gone and
  every socket carries verified claims; the read plane is not private
  (the observe credential is mintable by any LAN client that serves
  the scoreboard page), stated plainly.
- **P16. The display is the ninth service (D-1 ★).** Owned by
  `displayDriver`: healthy when the kiosk process is alive or hidden
  after a successful launch; down when it died while visible or a
  launch failed; dormant via `display.main`. Contract-first at the
  three enum sites' neighbours (`DomainStateHealth.required`,
  `sync:full`), the scanner's `SERVICE_NAMES`, the capabilities key.
  `display:scoreboard` depends on `display` and `display:return-to-video`
  on `vlc` in `SERVICE_DEPENDENCIES`; `display:status` stays ungated.

## 4. Task decomposition

Worktrees: task branches `claude/nice-curie-hescfv-<task>` cut from the
designated branch; each merged back by the orchestrator after its task
review; the designated branch is the only one pushed. Scanner tasks run
in the ALNScanner submodule on its own task branches the same way. No
contract entry precedes its implementation (D-6): each task carries its
own contract edits. T1b runs first; T1a after it.

| Task | Stage | Repos | Runs with | Model |
|---|---|---|---|---|
| T1b families, fixtures, endpoint map | CS.2 | backend, ALN-TokenData (manifest) | first | sonnet |
| T1a dormancy core, enum, gate + dialog, render-safe scanner | CS.2 | backend + contracts + ALNScanner + e2e helpers | after T1b | opus |
| T3 supervisor, host config, verbs both sides, holds, display | CS.3 | backend + contracts + ALNScanner | T4, T5 | opus |
| T3b every connection presents a credential | CS.3 | backend + contracts | with T3 | sonnet |
| T4 preflight arms, domain, CLI, video-file need, pack integrity | CS.4 | backend + contracts + docs | T3, T5 | opus |
| T5 scanner self-heal + the two §8.5 tests | CS.3 | ALNScanner (+ one backend E2E flow) | T3, T4 | opus |
| T6 scanner preflight panel | CS.4 | ALNScanner | after T4, T5 | sonnet |
| T7a the §2.2 sweep rows | CS.5 | all | after T6 | sonnet |
| T7b close | CS.5 | all | after T7a | sonnet + review workflow |

### T1b — families, fixtures, endpoint map (CS.2)

Files: `backend/config/profiles/installation-profile.schema.json`
(P1 interior, `additionalProperties: false`); `backend/config/profiles/aln-full-kit.json`
(endpoints: all families installed; `network` authored per R11:
`mode: kit-network`, `kitNetwork: {ssid: "aboutlastnetwork",
orchestratorIp: "192.168.0.191", localDnsOverride: true}` — SSID and IP
are the owner's stated production values (2026-09-12; the ESP32
`sample_config.txt` values `Sidewinder` / `10.0.0.177` are not the
production values); `localDnsOverride: true` is the ratified posture
(`CONTEXT.md` §5 "Kit network": the Pi answers the name on the LAN);
`orchestratorName` is OMITTED until the owner states the kit's DNS name
— the only value in the repo, `play.aboutlastnightgame.com`, is an
example in `2026-07-09-phase3-1-installation-profile.md` beside the
placeholders `ALN-GAME` / `10.11.0.2`, not a recorded decision; the
schema allows the omission and the T4 network row then reports the
name as `unknown`); `ALN-TokenData/pack-manifest.json` (`hardware.endpoints`
gains `audio.sinks` and `lighting.instruments`, degrade; manifest
rebuilt; parent pin bumped); `backend/tests/e2e/fixtures/packs/toy-heist/`
(manifest gains `lighting.instruments` and `audio.sinks` degrade; cues
gain one mixed cue (sound + lighting role) and one compound cue with a
lighting entry; manifest rebuilt); a second fixture pack
`toy-heist-require/` built from the toy pack with `lighting.instruments:
{onAbsent: 'require'}`; `backend/tests/e2e/fixtures/profiles/toy-test-rig.json`
(every provided family installed); new
`toy-dormant-lighting.json` (omits `lighting.instruments`);
`backend/scripts/lib/simulationProfile.js` (declares the pinned interior
for every manifest family); `backend/src/gameRules/endpointServices.js`
(new); tests: schema, endpoint map, generator; `.github/workflows/test.yml`
(two more Tier L legs: toy + dormant profile; require pack + dormant
profile; capability-gated like the others).

Produces: `ENDPOINT_FAMILIES`, `servicesForFamily(id)`,
`dormantServicesFor(manifest, profile)` → `{serviceId: {reason}}`.

Red-first: schema refuses an unknown family and a non-boolean
`installed`; the ALN profile validates and declares all five families;
`dormantServicesFor(alnManifest, aln)` is empty; `(toy, toyTestRig)`
empty; `(toy, toyDormant)` = `{lighting}`; the generator's output for
both packs validates and yields nothing dormant; a sinks-declared,
none-installed profile with a display yields `sound, music` only;
bluetooth never appears. Done when both manifests regenerate, the pin
bump is recorded, the legs appear in the matrix, tests pass
red-then-green, lint clean.

### T1a — dormancy core, enum, gate, render-safe scanner (CS.2)

Backend: `serviceHealthRegistry.js` (P5), `gameRules/resolution.js`
(P2; `installed:false`; the `service` case's `dormant` branch;
`dormantServices` → `dormantNeeds` with the stale comment fixed),
`gameRules/grants.js` (`preflight:` prefix), `services/dormancyService.js`
(new, P6 incl. the operator-latch set), `services/preflightService.js`
(new, P8 minimal: resolver rows + service arm + `blocking` + `limits`),
`cueEngineService.js` + `cue/standingEvaluator.js` (P3, P4, the
`_markPastClockCuesFired` hook, `releaseCue` outcome), `commandExecutor.js`
(dormant branch with the door wording helper; `cue:fire` three-valued
ack; `cue:enable` refusal; `service:check` dormant short-circuit;
`REQUIRED_PAYLOAD_FIELDS` for the four future actions; no switch cases),
`sessionService.js` (P7 gate + stamp + restore re-evaluation; feed at
create), `systemReset.js`, `app.js` (feed at the end of init),
`utils/displayDriver.js` (P16 report on launch/exit), `videoQueueService.js`
(`canAcceptVideo` dormant wording), `websocket/syncHelpers.js` +
`routes/healthRoutes.js` (`profile` identity), contracts (three enum
sites → `[healthy, down, dormant]`, `degraded` deleted; `door` at both
health sites; `display` in `DomainStateHealth.required` and `sync:full`;
`profile` required-nullable in `SyncFull`; `session:start` payload;
Session metadata `preflight` and `preflightOverride`; `message`
`maxLength`), the scanner cross-check test's enum assertion,
`tests/e2e/helpers/capabilities.js` (three-state; `requireCapabilities`
and `requireDegraded` skip on dormant with the recorded reason;
`requireDormant`), `tests/e2e/helpers/assertions.js`,
`tests/rung1/audit-flows.js`. Scanner: `HealthRenderer.js` (three
states; door wording; collapse only when all healthy or
profile-dormant; summary toggle), `CueRenderer.js` (dormancy-disabled
cues grey with door wording, no Enable, greyed tile, `dormantCommands`
badge), `admin/SessionManager.js` + a dialog (NO-GO ack → typed reason →
resend with `startAnyway`), `SERVICE_NAMES` gains `display`, tests, dist.

Red-first (seams): registry latch/ignore/clear/door/skip/preserve;
dormancyService (ALN → nothing; toy dormant → `lighting` + the
lighting-only cue and the compound cue disabled, the mixed cue not;
operator latch survives `system:reset`); cue engine (wholly dormant
refused, no hold; mixed fires with the dormant command refused
quietly; held acks as success; `releaseCue` re-holds on refusal;
provenance for gm/once/dormant; GM and once sets persist, dormancy set
does not); executor (door wording both doors; acks; refusals; observe
actor refused each new action); startGame (blocking refuses; override
without reason refuses; with reason starts, stamps actor, logs
metadata; a fault does not refuse); restore re-evaluation; systemReset
re-applies both doors; contracts agree at all sites; sync:full
completeness covers `profile`; HealthRenderer and CueRenderer states;
the dialog round-trip. Done when backend unit + contract + integration,
scanner unit + L2, lint and ratchet are green in both repos and dist is
rebuilt.

### T3 — supervisor, host config, verbs both sides, holds, display (CS.3)

Backend: `utils/processMonitor.js` (P10), `config/host.example.json`,
`config/host.schema.json`, `services/hostConfigService.js` (P11),
`.gitignore` (`config/host.json`), `vlcMprisService.js`, `musicService.js`,
`lightingService.js`, `utils/displayDriver.js` (strategies, modes,
escalation, `restart()` entry points, display-aware Chromium, HA
elapsed-time escalation), `commandExecutor.js` (three `service:*` cases,
ungated; `display:*` dependencies), `cueEngineService.js` +
`videoQueueService.js` + `sessionService.js` + `systemReset.js`
(P13 expiry; operator-latch expiry), contracts (the three actions and
their payloads; `sync:full` unchanged). Scanner: `HealthRenderer.js`
verbs per status (Check Now / Restart / Run without it / Put back in
service; Re-route links the routing panel), `AdminOperations.js` +
`domEventBindings.js` wiring, `CueRenderer.js` quick-fire badge, tests,
dist. Red-first: flap window trips inside the sliding window and decays
outside; observers never escalate; `restart()` on a hung child; delay
cap and non-finite fallback; one test per out-of-range host field;
alias env vars warn; dormancy-aware start/restart; `gave-up` reports
`down` with the message; `service:in-service` succeeds on a latched
service and marks past-due cues fired; `service:restart` succeeds on a
down one; `service:out-of-service` latches, stops restarts, expires its
holds; expiry at session end and at reset; already-queued video fails
under a latch; Chromium restarts only while visible; the rung-1 audit
gains the five-kills scenario and the recovered playback. Done when
backend suites, scanner unit + L2, lint, ratchet are green; dist
rebuilt.

### T3b — every connection presents a credential (CS.3)

Files: `websocket/socketServer.js` (P15), `server.js` and
`tests/helpers/integration-test-server.js` (`sync:request` getter),
`middleware/auth.js` (observe eviction per deviceId), contracts
(`deviceType` enum narrowed after the grep), tests:
`tests/unit/websocket/socketMiddleware.test.js`,
`tests/integration/admin-interventions.test.js`,
`tests/integration/room-broadcasts.test.js`. Red-first: tokenless →
`connect_error`; operator token + `deviceType: 'player'` →
`connect_error`; observe token connects read-only; a display's
`sync:request` leaves `scannedTokensByDevice` unchanged; the scoreboard
E2E flow passes.

### T4 — preflight arms, domain, CLI, video-file need, pack integrity (CS.4)

Files: `gameRules/packNeeds.js` (+ `video-file`), `gameRules/resolution.js`
(its case), `services/preflightService.js` (arms: pack refs via
`validateCommand`; bindings with live scene existence when lighting is
healthy else `unknown`; services incl. dormant and severity; media;
`sinks.<id>` rows; `stations.pack` row; network from
`profile.network.kitNetwork` (paper: the block is present and complete;
live: the host holds `orchestratorIp` on an interface and
`orchestratorName` resolves to it — rung 3 only, `unknown` elsewhere;
`unknown` with the label when the block is absent, R11); devices; host (disk,
temperature, load, ports, PID files); certificate as `warn`; display
liveness with `service:restart display`; pack integrity: sha1 per
manifest file and `realpathSync` containment (F-P2-3/F-P2-7); the exec
discipline of P8), `services/packService.js` (`resolvePackFile`
containment), both manifest builders (skip symlinks),
`commandExecutor.js` (`preflight:run`, rate-limited per socket),
`websocket/broadcasts.js` (the `show-control` room and the domain
push), `websocket/syncHelpers.js` (`preflight` key, null for tier
device), contracts (the seven sites: `domain` enum line, prose, bullets,
`DomainStatePreflight`, the domain test's producers and `describe.each`,
`SyncFull` required-nullable), `scripts/preflight.js` (`--pack`,
`--profile`, `--json`; live arms local only; prints `limits` as its
header), `docs/preflight-checklist.md` (restructure: absorbed sections
point at row ids; retained sections are the `cannotVerify` list),
tests. Red-first: each arm on both packs; the observe socket receives no
`preflight` push and a null key; the CLI's paper rows equal the
service's; `video-file` needs for every token and cue video; integrity
flags an edited file and a symlink escaping the pack dir; over-budget
arms report `unknown`.

### T5 — scanner self-heal + the two §8.5 tests (CS.3, ALNScanner)

Files: `src/core/packLoader.js` (`refresh({baseUrl})`, validate-then-
flip), `src/network/networkedSession.js` / `messageRouters.js` (boundary
gating, the latch, the banner), `src/core/tokenManager.js` (re-apply
with validation), `src/network/connectionManager.js` (reconnect with
the bounded collision retry), a backstop screen, tests: heal at a
boundary → one toast; mid-session → banner, no heal; second mismatch
for the same hash → backstop; divergent serving origin heals from the
connected orchestrator; re-apply failure leaves pointer and cache
untouched; the behavioral timeout test; the staging-cache race test.
Plus one backend E2E flow on the toy leg restarting the orchestrator
with a different `packPath` and asserting the reconnect with the new
hash (DoD h).

### T6 — scanner preflight panel (CS.4, ALNScanner)

Files: `src/ui/renderers/PreflightRenderer.js` (grouped rows, verdict
and severity, paper/live label, profile id, computed-at, the `limits`
footer, a "Run preflight" button), `MonitoringDisplay.js`,
`messageRouters.js` (`sync:full.preflight` restore that also clears on
null), `index.html`, tests. Done when unit and L2 are green and the rows
render from a fixture equal to the CLI's paper output.

### T7a — the §2.2 sweep rows (CS.5)

The 22 close-gate ids from the census §13 (S2-2, S2-3, S2-4, WE-4,
F-P8a-1, F-P8a-3, F-P8b-1, F-P8b-3, F-P8b-4, F-P8b-5, F-P9a-1, F-P9a-2,
F-P9a-3, P9b-2, P9b-6, P4-5, P4-6, P4-7, LA-6, WE-2, LA-7, LA-8) plus
P1-observation, each executed or dispositioned with a reason; the
workflow hardening (LC-6/P9b-9); rig hygiene (P9b-4/P9b-8).

### T7b — close (CS.5)

Records (CLAUDE.md files for the enum, the ninth service, the domain,
the verbs, host config; CONTEXT.md domain-modeling rows: flap window,
gave-up, door, feed, require gate, preflight stamp, limits, the domain
count, "Put back in service", the held-video expiry sentence;
ROADMAP's Block 3 domain count; PHASE3-STATUS row; CURRENT-STATE); dist
rebuild; the close gate (backend unit + contract + integration + ratchet
+ lint; scanner unit + ratchet + lint + L2; config-tool; scripts; the
Tier L legs: ALN, toy, dormant, require; `rung1.yml`); the whole-unit
adversarial review as a workflow (finders per task, Opus medium;
lenses: state machine and security, Opus high; parity re-executing the
enum on both sides; refuters, Fable high for MAJORs); every finding
dispositioned; execution record appended.

## 5. DoD pins

(a) Toy pack, dormant-lighting profile: a lighting gm:command is refused
"not installed tonight" and NO hold appears. (b) The lighting-only cue
and the compound cue are dormancy-disabled at create and after a
restart; the mixed cue is not. (c) `sync:full.serviceHealth.lighting`
is `{status: 'dormant', door: 'profile'}`. (d) The dashboard renders
lighting grey and stays collapsed; the cue list renders the silenced
cues grey. (e) On the rig, with a strategy pinned through
`HOST_CONFIG_PATH`, five `cvlc` kills inside the sliding window yield a
red vlc row with the escalation message and `service:restart` recovers
playback. (f) The require fixture pack with the dormant profile makes
`session:start` refuse with the blocking reason; `startAnyway` with a
typed reason starts, and the stamp and log carry the actor. (g) The
CLI's paper rows and the panel's rows are byte-identical for the same
tree. (h) A scanner whose orchestrator restarts with a different pack
reconnects with the new hash after one toast at the next boundary.
(i) An operator-door latch survives `system:reset`, keeps the dashboard
expanded, and "Put back in service" clears it. (j) An observe socket
never receives a `preflight` push.

## 6. Global constraints

Contract-first at every wire change, each in the task that implements
it. Red-first at the seams named per task; no test at an unagreed seam.
No new discrete WebSocket event; `MESSAGE_TYPES` untouched. Ratchet
never lowered; lint clean in both repos; every close gate includes the
integration suite. Vocabulary per `CONTEXT.md`; every temporary
construct gets a ledger row. Implementers never dispatch subagents.
Every claim of "done" is verified against the diff and a fresh run.
`RULED_NON_FLOOR` grows only by owner ruling.

## 7. Scope inventory and stop points (owner ruling 2026-09-12)

The owner makes every schedule, pause, and go-to-green decision at the
§8 checkpoints on observable reports. Each row says what a task
delivers and whether the tree is a coherent stopping point after it.

| Task | Delivers (observable) | Depends on | Stop point? What the GM has |
|---|---|---|---|
| T1b | Equipment interior pinned; both packs declare their families; toy fixtures for dormant and require; endpoint map; two more Tier L legs | — | Yes. No behavior change yet. |
| T1a | Three health words end to end incl. the display; sticky dormant with its door; cues silenced when their equipment is absent, rendered as such; the session-start refusal with the typed override dialog; the stamp; profile identity | T1b | **Yes — the Block 2a candidate.** Uninstalled equipment never shows red; a session cannot start with required equipment missing, and the GM has the door. No supervisor, no verbs, no preflight panel. |
| T3 (+T3b) | Bounded restart with escalation for services, unbounded for observers; host config; the three service verbs with their buttons; holds expire; display supervised; every connection credentialed | T1a | Yes. |
| T4 | The preflight arms, the operator-only domain, the CLI, pack integrity | T1a | Yes; the panel waits for T6. |
| T5 | The scanner heals its stale pack at a boundary; the two owed tests | T1a | Yes. |
| T6 | The preflight panel with its limits footer | T4, T5 | Yes. |
| T7a | The enumerated sweep rows | T6 | Yes. |
| T7b | Close | T7a | Required before ANY merge, wherever the owner stops. |

Dependency rounds: T1b → T1a → T3‖T3b‖T4‖T5 → T6 → T7a → T7b.

## 8. Checkpoints and reporting (owner decides; wording ruled 2026-09-12)

The owner makes every schedule, pause, and go-to-green decision. The
orchestrator stops and reports at these six points, named in plain
words, and nowhere else:

1. **Before any code.** The red-teamed plan and the §7 inventory are
   on the table. The owner decides whether the first round starts.
2. **After the dormancy core lands** (T1b and T1a reviewed and
   merged). The owner decides: continue, stop here and move to the
   green machine, or change the order.
3. **After the supervisor, the preflight, and the self-heal land**
   (T3, T3b, T4, T5, and the panel T6 reviewed and merged).
4. **After the close review** (T7a and T7b done; the tree is ready to
   merge).
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

### 2026-09-12 — block opened (owner: "go ahead and start T1b")

- Draft PR opened at block open (R4): maxepunk/ALN-Ecosystem#35. TokenData and ALNScanner draft PRs open with their first commits.
- Method frame: `superpowers:subagent-driven-development` + `verification-before-completion`; briefs under `docs/plans/briefs/`; the skill's ledger at `.superpowers/sdd/2026-09-12-block2-hardening-plan/progress.md` mirrors here.
- Pre-flight conflict scan run (ledger table). Rulings recorded, each with its cost if wrong:
  1. T1b runs in the main checkout on task branch `claude/nice-curie-hescfv-t1b`; worktrees begin when tasks run in parallel (a worktree lacks node_modules, submodules and the scanner dist the Tier L legs need).
  2. The simulation generator emits the pinned endpoints interior with stand-in VALUES (`display.main.output: 'rung1-xvfb'`, sinks `rung1_hdmi`/`rung1_bt`, `provider: 'home-assistant'`); `harnessProvides()` recognizes those markers in place of `provider: 'rung1-harness'`, which the pinned interior forbids.
  3. `toy-dormant-lighting.json` is toy-test-rig minus `lighting.instruments`, bindings kept (P2 ignores them with a warn from T1a).
  4. `toy-heist-require` keeps packId `midnight-heist`; its contentHash is its identity (A2).
  5. For T1a: once the P7 gate lands, the toy-require-dormant leg passes through the E2E helper sending `startAnyway` with a typed reason on that leg, plus one flow asserting the refusal (DoD f). The plan text left this open.
  6. Round 3 re-sequenced to T3b → T3 (‖ T5) → T4: T3/T3b share `asyncapi.yaml`, T3/T4 share `commandExecutor.js` and the contracts, so the plan's "parallel only across disjoint file sets" rule forbids T3 ‖ T3b ‖ T4.
- Owner-visible carry: `aln-full-kit.json` `stations.count` is set to the manifest's recommended 3 until the owner states tonight's count at Stage B; `orchestratorName` stays absent until the owner names it.
- T1b brief: `briefs/2026-09-12-t1b-families-fixtures-endpoint-map.md` (Sonnet implementer). Base commit recorded in the ledger at dispatch.

### 2026-09-12 — T1b CLOSED (equipment families, fixtures, endpoint map)

- Commits `34571c0..2152b9f` (9 parent commits, fast-forwarded into the designated branch at `2152b9f`); ALN-TokenData `6f9bc30` on its `claude/nice-curie-hescfv` (draft PR opened). Base `7caeef3`.
- Tests: unit + contract 2909/2909 (146 suites), ratchet 85/85, lint clean, workflow YAML parses with four legs (`production`, `toy-heist`, `toy-dormant-lighting`, `toy-require-dormant`). Four Tier L legs run locally: zero failures outside the container's recorded base set (see ruling 9). Orchestrator re-ran the suite and ratchet fresh before merging.
- Review (Opus): spec ✅, quality Approved; one Important finding (pinned-profile legs never generated the witness register on a clean runner) fixed in round 1 and verified by a scoped re-review; seven Minor findings deferred to the close review (ledger).
- Rulings made during the task, each with its cost if wrong (ledger holds the long form):
  7. The four pre-existing tests pinning the "no endpoints block" world were re-pinned in T1b, not deferred.
  8. `contentHash` covers only `files[]`; the manifest's `hardware` block escapes pack identity — accepted finding, home: T4's pack-integrity arm (both builders + parity tests). Ruling 4 amended: fixture packs are distinguished by directory.
  9. The container's Tier L baseline is not green (6 production / 14 toy failures from 3-worker contention and a pre-existing `generate-fixtures.js` parity-pack race); local bar = no failures outside that set; CI is the gate; the race goes to T7a rig hygiene.
  10. E2E fixture generation (the witness register) runs on every run regardless of `E2E_PROFILE_PATH`; the explicit profile only replaces the generated path.
  11–20 (made while writing T1a's brief): the NO-GO ack is `success:false` + message `NO-GO: <reasons; joined>`; the typed dialog lives in the scanner app layer using the existing `prompt()` idiom; `display` health semantics (healthy on launch, down on launch failure or exit-while-visible, healthy "closed while hidden" on hidden exit, down when video playback is disabled by host config); restore re-evaluation at the end of `initializeServices`; the require leg passes through the E2E helper's `startAnyway` override only when the pack path names `toy-heist-require`; `resolve()` reads inventory health as a string or the snapshot entry; `cue:enable` re-arms a spent once-cue and is refused on a dormancy-disabled cue; rollup = `{status, dormantNeeds, problems, blocking}`; health `message` maxLength 300; the scanner's nested `data` pin moves to `6f9bc30` in T1a.
- Deviation accepted: `cues.timeline` added to the toy pack's `requires` (the activation gate demanded it for the new compound cue).
- Owner-visible carries: `aln-full-kit.json` declares `audio.sinks: [hdmi]` only (routing.json names one target) and `stations.count: 3` (the manifest's recommended count) — both corrected at Stage B; `orchestratorName` absent until the owner names it.
- T1a brief: `briefs/2026-09-12-t1a-dormancy-core.md` (Opus implementer; reader fact sheet brief beside it). Next: T1a.

### 2026-09-12 — T1a CLOSED (dormancy core, health enum, require gate, render-safe scanner) — the dormancy core has landed

- Commits `95d69c6..c222dbe` (22 parent commits, fast-forwarded into the designated branch); ALNScanner `cb5395c` + `be0d701` on its `claude/nice-curie-hescfv` (the scanner's nested `data` pin at `6f9bc30`); base `04a94b9`.
- Tests: backend unit + contract 3104/3104 (150 suites), ratchet 85/85, lint clean, integration 348/348; scanner 1717/1717 (90 suites), ratchet, lint, `dist` rebuilt; rung-1 audit 13/13 with the 8-real-services line including `display`; all four Tier L legs ZERO failures locally (144/143/141/141), both new flows (`30-dormancy-lighting`, `31-preflight-require-gate`) 16/16 on every leg. The orchestrator re-ran the backend and scanner suites fresh before merging.
- Review (Opus, four passes over 81 files): spec ✅, quality Approved; one Important (plan-mandated: `familyInstalled` for `stations`/`personal`) and two test-hygiene minors fixed in round 1 with three rulings; scoped re-review: all addressed. Eight Minor findings deferred to the close review (ledger).
- Three real defects surfaced by the Tier L legs and fixed inside the task: a runtime E2E fixture bound a lighting role without declaring the family (P2 made it bite); four ALN-pinned flows never pinned the ALN profile; ruling 15's override reached one of three `session:start` seams (now one shared `startGameOnSocket` helper).
- Rulings 21–24 (ledger holds the long form): `dormancyWording` lives in `gameRules/` (pure); `service:check` gains a read-only `display` probe; profile schema validation at boot is a real gap → T4; `stations` installed iff `count >= 1`, `personal` iff `expected === true`. Ruling 9 amended: with the log storm capped the container runs all four legs clean, so the local bar is zero failures.
- Findings carried: (i) a Winston EPIPE loop fills `backend/logs` at ~40 MB/s when a Playwright worker dies with an orchestrator alive (T7a rig hygiene: guard stdout errors; per-orchestrator LOGS_DIR); (ii) the scanner has no CSS for `health-service--down/--ok` — the dashboard never rendered red before this task (Block 3 truth sweep); (iii) `display` reads `down` on any host without a kiosk (honest; a dev profile omitting `display.main` makes it dormant); (iv) health `message` maxLength 300 is contracted but not enforced (T3).
- Docs updated in this record's commit: root and backend CLAUDE.md say nine services and the three health words.
- Checkpoint 2 ("after the dormancy core lands") reached; report sent to the owner.


### 2026-09-12 — T1a follow-ups CLOSED (CI kiosk launch, scanner review-bot fixes, display exit semantics)

Three small tasks closed T1a's CI after the dormancy core merged. Briefs: `briefs/2026-09-12-t1a-ci-rung1-kiosk.md`, `briefs/2026-09-12-t1a-scanner-pr17-findings.md`, `briefs/2026-09-12-t1a-fu2-display-exit.md` (all Sonnet implementers, Sonnet reviewers).

- **CI kiosk launch** (worktree branch, commits `2bca350..928d521`, merged `--no-ff` at `fae51b6`): Rung-1 run 13 on `c222dbe` failed 12/13 because the hosted runner has no Chromium, so T1a's ninth service reported `down`. Fix: `rung1.yml` installs Playwright's Chromium into `/opt/pw-browsers` with the container-identical symlink; `up.sh` resolves `CHROMIUM_BIN` by a chain (env → the symlink → Playwright's `executablePath()` → empty with a note). Runs 14–16 stayed red (Chrome-for-Testing directory layout; then "No usable sandbox": Ubuntu 24.04 runners restrict unprivileged user namespaces); run 17 green 13/13 after the sysctl; run 18 green on the merge. Review: Approved, no findings.
- **Scanner review-bot findings** (ALNScanner `8bc9e68`, `e7f9c6f`, `e83723c`, fast-forwarded into its `claude/nice-curie-hescfv`; parent pin `6b223d0`): the Claude Code Review bot's three findings on ALNScanner PR #17 were real — quick-fire and standing-row change detection keyed on the dormant command COUNT (a changed service or door left stale text), and the collapsed health summary was a `div` a keyboard could reach but not activate. Fixed: signatures key on `disabledBy` plus the first dormant command's service and door; the summary is a real `<button>`; passthrough tests for `toggleHealthDetail`. Scanner 1726/1726, ratchet, lint, build. Review: Approved, no findings. One reply posted on the PR #17 thread.
- **Display exit semantics** (branch from `6b223d0`, commits `af6940c` + `019f1cf`, merged `--no-ff` at `fb2c29c`): Test run 297's integration job saw the debounce test take two health pushes because the runner's `chromium-browser` stub died of SIGABRT while hidden and T1a's exit handler called that `healthy`. Ruling 27 (below). Review: Approved with one Important (the SIGKILL-escalation path cleared `terminating` before the async exit event could read it) fixed in round 1 (`019f1cf`: only the exit handler reads and clears the flag); scoped re-review: all addressed. Backend 3111/3111, displayDriver 58/58, integration 348/348, ratchet, lint. One minor deferred (a long comment on a one-line teardown); one out-of-scope note for the close review (`cleanup()` has no re-entrancy guard against a double shutdown signal — pre-existing, inert).
- Rulings 25–28, each with its cost if wrong (ledger holds the long form):
  25. `rung1.yml` installs Playwright's Chromium with the container-identical symlink; `up.sh` resolves `CHROMIUM_BIN` by the chain above and says so when none exists; the audit's expectation stays. — cost: none.
  26. A CI-fix task branch may be pushed for verification (the Rung-1 workflow self-triggers on its paths) and is deleted after merge. — cost: one extra remote branch per CI fix. (The session credential could not delete `claude/nice-curie-hescfv-t1a-ci`; owner cleanup.)
  27. (refines 13) The display exit handler reports `healthy` "closed while hidden" only for a clean close (code 0 or the driver's own SIGTERM, including its SIGKILL escalation) after a successful launch; any other exit while hidden, or an exit before the alive-check, is `down` with the code and signal; an exit while visible stays `down`. — cost: none; a crash showing red is the alarm-integrity rule.
  28. `rung1.yml` sets `kernel.apparmor_restrict_unprivileged_userns=0` before bring-up (runner physics; engine launch flags unchanged). — cost: none (a runner-only sysctl).
- CI verdicts on the designated branch: run 297 (`3345b6d`, dispatched by hand after a `[skip ci]` docs push superseded the PR sync) 9/10 — integration red on the debounce test → ruling 27; run 298 (`6b223d0`) 10/10; run 299 (`fae51b6`) 9/10 — Tier L `toy-require-dormant` red on `24-scoreboard-restart-recovery` "data survives restart" 3/3 attempts; Rung-1 run 18 green. Run 300 (`fb2c29c`) records its verdict below when it lands.
- Run 299's red leg is a pre-existing harness race, not T1a's (evidence in the ledger): with `workers=3` every worker's non-preserving `startOrchestrator` calls `clearSessionData()`, which in the Playwright process takes the file branch and deletes every file in the SHARED `backend/data/`; a restart test's restored instance reads its session from that directory a few seconds after its stop. In all three attempts a parallel worker's wipe landed inside that window (0.3–1.3 s after the stop). The same test was green on the other three legs and on this leg in runs 297/298. Home: T7a rig hygiene, beside the per-orchestrator LOGS_DIR finding — a per-worker DATA_DIR in `test-server.js` with `clearSessionData` scoped to it. No fix dispatched: a go-to-green call for the owner at checkpoint 2.
- Findings carried: (v) the shared-`data/` wipe race above (T7a); (vi) `displayDriver.cleanup()` re-entrancy (close review); (vii) the revalidation timer imports after Jest teardown — eight other integration files lack a `stopRevalidation()` teardown (rig hygiene); (viii) the Winston EPIPE loop and the LOGS_DIR finding stand (T7a).
- Owner-visible carries: delete the remote branch `claude/nice-curie-hescfv-t1a-ci`; the DNS name, the Bluetooth sink name, and the station count at Stage B.
- Process notes for the record (owner asked whether the process was followed): the orchestrator re-ran the backend and scanner suites fresh before every merge; the Tier L legs and the rung-1 audit were run by the implementer, not re-run by the orchestrator, before T1a's merge (CI ran them instead — an accepted gap, recorded); the `[skip ci]` docs push that superseded a PR sync is why records now push only after the code push's run has finished.
