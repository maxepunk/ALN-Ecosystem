# Block 2 plan — pre-build red team: findings and rulings (2026-09-12)

Three lenses attacked `2026-09-12-block2-hardening-plan.md` before any
code: doctrine and parity (Fable), security and host boundaries (Opus),
state machine and lifecycle (Opus). Their reports are the primary
sources (`docs/plans/briefs/2026-09-12-redteam-*.md` are the briefs;
the reports are copied beside them at fold time). This record carries
the orchestrator's ruling on every finding; the plan is rewritten once
from these rulings. Ruling vocabulary: ACCEPT (fold as proposed),
ACCEPT-MOD (fold with the stated change), REFUTE (with the reason),
DEFER (with the home). Owner-visible rulings are marked ★ for the
"before any code" report.

## Doctrine and parity lens (31 findings: 3 blocking, 11 major, 14 minor, 3 notes)

| id | sev | ruling | what changes in the plan |
|---|---|---|---|
| D-1 | BLOCKING | ACCEPT ★ | The display becomes the ninth registry service, contract-first. My "the eight stand" constraint was not ratified and broke R-C3-3 for the process ROADMAP §5 names. T1a introduces the id (`display`), its report on kiosk launch/exit, its dormant door via `display.main`, the contract `required` list, the scanner name, the capabilities key; T3 supervises it and gives it `service:restart display`. |
| D-2 | BLOCKING | ACCEPT | T1a: `resolution.js` service case gains `dormant` (live, reason from the door); rollup counts it under `dormantServices`, never `problems`; end-to-end pin on the toy dormant fixture. |
| D-3 | BLOCKING | ACCEPT-MOD ★ | Dormancy keys on the equipment families the pack MANIFEST declares as needs (C1 §2 row 3 verbatim), absent from or `installed:false` in the profile. Consequence: the ALN manifest declares `audio.sinks` and `lighting.instruments` beside `display.main` (all `degrade`); the toy manifest declares `lighting.instruments` and `audio.sinks`; the simulation generator stays correct by construction; `toy-test-rig` declares every family it provides. Pins: nothing dormant on rung 1 and on both default Tier L legs; rung-1 audit unchanged. T1b becomes a two-repo task (ALN-TokenData manifest + parent). |
| D-4 | MAJOR | ACCEPT | P3: a compound cue with ANY timeline entry on a dormant service is dormancy-disabled whole; unit test on a compound cue under dormant vlc. |
| D-5 | MAJOR | ACCEPT ★ | P3 recorded as a deliberate refinement of D-C3.2, argued from S2's own reasoning; the phrase "degrade, never kill" removed; cue summaries gain `dormantCommands: [{action, service, door}]`; the quick-fire button carries the badge (scanner half of T3). |
| D-6 | MAJOR | ACCEPT | Contract enum entries and `DomainStatePreflight` ride the tasks that implement them (T3, T4). T1a pre-registers code-side tables only (`REQUIRED_PAYLOAD_FIELDS`, the `preflight:` floor prefix in `grants.js`). The `sync:full.preflight` key and the domain move to T4; T1a keeps the session stamp and `profile`. |
| D-7 | MAJOR | ACCEPT | T3 holds both sides of the verbs (backend cases + HealthRenderer buttons + AdminOperations wiring + dist rebuild). T5 = self-heal + the two owed tests, depending on T1a only. |
| D-8 | MAJOR | ACCEPT-MOD | DoD (g) restated: paper rows agree byte-for-byte between CLI and panel; the CLI's live arms are local only (host, files, certificate); service and display rows print `unknown` with the label. |
| D-9 | MAJOR | ACCEPT | F-P2-3 lands in T4's pack-integrity arm: `resolvePackFile` compares `fs.realpathSync` to the pack dir; both manifest builders skip symlinks; a red-first test with a symlink escaping the pack dir. |
| D-10 | MAJOR | ACCEPT | T4 devices arm gains `sinks.<id>` rows (paper: declared; live: pactl sink present, Bluetooth connected for bluetooth-transport sinks; `unknown` when audio is down or dormant) and a `stations.pack` row (connected GM sockets whose packHash ≠ active). |
| D-11 | MAJOR | ACCEPT | P8's result carries a fixed `limits` block (`verifies`, `cannotVerify`, `humanChecklist`); T6 renders it as the panel footer; T4's CLI prints it as the header; the checklist document's retained sections are the `cannotVerify` list. |
| D-12 | MAJOR | ACCEPT | Rows quote `resolve()`'s verdicts verbatim (`runs|dormant|fault|no-go|unknown`) plus a separate `severity` field for the certificate warn class; preflight-only arms emit needs in the same vocabulary; the rollup is `resolve()`'s. |
| D-13 | MAJOR | ACCEPT (merged with SEC-09/10) | `refresh()` fetches from the CONNECTED orchestrator's URL regardless of serving origin (R-C2-1 verbatim); the asserting principal and the supplying principal are then the same, which is what removes SEC-09's loop. See SEC-09 for the guards. |
| D-14 | MAJOR | ACCEPT (with SEC-17) | `capabilities.js`: dormant is a third state; `requireCapabilities` and `requireDegraded` both skip on a dormant dependency with the recorded reason "dormant by profile"; `requireDormant` added for the S6 flow. |
| D-15 | MINOR | ACCEPT | T1b runs first, then T1a. |
| D-16 | MINOR | ACCEPT | Source of truth for the evaluation = the last evaluation held by `preflightService`; the session stamp and the domain push derive from it. T4 lists every domain-count edit (contract enum, prose, bullets, schema, the domain test's producers and `describe.each`, scanner mapping); T7b edits the CONTEXT.md and ROADMAP domain counts. |
| D-17 | MINOR | ACCEPT (with SEC-02) | T1a adds `['preflight:', 'show-control']` to `grants.js`; the `service:` verbs inherit the existing row. |
| D-18 | MINOR | ACCEPT | T1a: `canAcceptVideo` returns `reason: 'vlc_dormant'`, message "video not installed tonight"; `service:check` on a dormant id short-circuits with "not installed tonight". |
| D-19 | MINOR | ACCEPT | T1a adds `tests/e2e/helpers/assertions.js` and `tests/rung1/audit-flows.js` to its sweep. |
| D-20 | MINOR | ACCEPT | T1b adds a mixed cue (sound + lighting role) and a compound cue to the toy pack. |
| D-21 | MINOR | ACCEPT | The dormancy check runs before lighting-role normalization. |
| D-22 | MINOR | ACCEPT (with SEC-01) | The gate evaluates live and consults `rollup.blocking` only. |
| D-23 | MINOR | ACCEPT-MOD (overturned by SM-1) | Operator-door latches SURVIVE `system:reset` (the equipment did not change); `dormancyService` owns them and re-applies both doors; they are lost on a process restart, recorded. |
| D-24 | MINOR | ACCEPT | Flap window is sliding over exit timestamps; DoD (e) pins its strategy through `HOST_CONFIG_PATH`; DoD (h) names the orchestrator restart with a different `packPath`. |
| D-25 | MINOR | ACCEPT | P2 re-cited to C1 §2 row 3 and CS.1 adjudication 4; contradiction ruled: the endpoint wins, bindings under a dormant family are ignored with a warn. |
| D-26 | MINOR | ACCEPT | §1 records the re-slice: the operator door rides T3 with the verb commands. |
| D-27 | MINOR | ACCEPT | T7 splits into T7a (the enumerated §2.2 sweep rows) and T7b (close). |
| D-31 | MINOR | ACCEPT | The preflight's resource rows come from iterating the pack's cue commands through `validateCommand` (its first production caller); `preflightService` adds only token videos via the `video-file` need. |
| D-28 | NOTE | ACCEPT | Domain-modeling rows for flap window, gave-up, door, feed, require gate, preflight stamp, limits, service domain, "Put back in service"; the "Held item" expiry sentence fixed at T3. |
| D-29 | NOTE | ACCEPT | Restamp the plan's tree at ratification. |
| D-30 | NOTE | ACCEPT | Recorded as `host.json` headroom (`processes.<id>.bin/user`), not built. |

## Security and host-boundaries lens (26 findings: 3 blocking, 14 major, 6 minor, 3 notes)

| id | sev | ruling | what changes in the plan |
|---|---|---|---|
| SEC-01 | BLOCKING | ACCEPT ★ | P7: the gate consults only unresolved `require`-class needs. `resolve()` computes `rollup.blocking` that only the require rule can populate; no arm T4 adds may widen it; the thrown message lists blocking reasons only; DoD (f) restated against `rollup.blocking`. |
| SEC-02 | BLOCKING | ACCEPT | P12 names `preflight:run → show-control`; `grants.js` joins T1a's file list; the brief pins that `RULED_NON_FLOOR` stays empty and grows only by owner ruling. |
| SEC-03 | BLOCKING | ACCEPT | P12: `service:restart`, `service:in-service`, `service:out-of-service`, `preflight:run` are ungated by the health gate and exempt from the dormant branch, in the `service:check` idiom; T3 red-first: in-service succeeds on a latched service, restart on a down one, out-of-service on a down one. |
| SEC-04 | MAJOR | ACCEPT | T1a red-first: an actor with `functions: ['observe']` is refused each new action with the floor message; the enum-vs-floor proof stays green with `RULED_NON_FLOOR` empty. |
| SEC-05 | MAJOR | ACCEPT | `hostConfigService` validates with AJV at read time and clamps per field with a loud warn (enabled boolean; maxFailures 1–20; restartDelayMs 250–60000; backoffMultiplier 1–10; flapWindowMs 5000–600000); `ProcessMonitor` caps the computed delay (300000 ms) and falls back on a non-finite delay; one test per out-of-range field. |
| SEC-06 | MAJOR | ACCEPT ★ | Defaults live in code; the repo ships `config/host.example.json`; `config/host.json` is gitignored and optional (absent = defaults, no warn); `HOST_CONFIG_PATH` is the venue seam. The venue's off switch is a hand-edited JSON file on the show machine, stated plainly. |
| SEC-07 | MAJOR | ACCEPT | The `preflight` domain is operator-only: emitted to a `show-control` room joined by sockets whose functions include it; `sync:full.preflight` is null for tier `device`; red-first: an observe socket receives no push and a null key. |
| SEC-08 | MAJOR | ACCEPT-MOD ★ | T3b's invariant: every connection presents a verified operator or observe token AND `deviceType: 'gm'`; any other deviceType is refused at handshake (no production client sends one; the contract's `admin` value is verified sender-less by grep and removed). `sync:request` stays open to any credentialed socket, stated. `room-broadcasts.test.js` joins T3b. Red-first: operator token + `deviceType: 'player'` → `connect_error`. |
| SEC-09 | MAJOR | ACCEPT (with D-13) | Heal fetches from the connected orchestrator (so asserter = supplier); at most one heal per connection; never re-heal a hash `refresh()` already produced; the divergent-origin case and the no-loop assertion join T5's tests. |
| SEC-10 | MAJOR | ACCEPT | `refresh()` is `loadPack()`'s network tier verbatim (reusing `_stagedRefresh` and `_activate`, channel overridden to the connected orchestrator), no cache or bundled fallback; a failed refresh leaves the active pointer and cache untouched; the staging-race test asserts exactly that. |
| SEC-11 | MAJOR | ACCEPT | The actor is threaded through; the override stamp is `{reason, at, blocking, byDeviceId, byTier}` and the warn logs the same fields as metadata; T1a's test asserts both. |
| SEC-12 | MAJOR | ACCEPT | Both `reason` fields are normalized (control and bidi strip, no pipes, 350 code points, refused when empty after normalization); `maxLength` pinned on `message` at both health sites and on the reason payloads; text goes in log metadata, never interpolated. |
| SEC-13 | MAJOR | ACCEPT | The seven domain sites enumerated in T4; `door` added at both health sites in T1a; `profile` (T1a) and `preflight` (T4) join `SyncFull` as required-and-nullable; CONTEXT's domain count in T7b. |
| SEC-14 | MAJOR | ACCEPT-MOD ★ (superseded by SM-17) | The `btAddress` rule is dropped entirely: the Bluetooth service is the adapter, a capability, never profile-dormant (only the operator door can latch it). The sink interior stays C1 §1 verbatim. |
| SEC-15 | MAJOR | ACCEPT | T1b adds a toy manifest variant declaring `onAbsent: 'require'` on `lighting.instruments` (a second fixture pack directory built from the toy pack); DoD (f) names it; the ALN pack stays `degrade`. |
| SEC-16 | MAJOR | ACCEPT | Every shell-out through `execHelper` with a bounded timeout; no sync fs on the evaluate path; DNS via `dns.Resolver` with a timeout; gateway reachability as a bounded TCP connect; single-flight guard and a total wall-clock budget with over-budget arms reporting `unknown`; `preflight:run` rate-limited per socket. |
| SEC-17 | MINOR | ACCEPT (with D-14) | As D-14. |
| SEC-18 | MINOR | ACCEPT | `KNOWN_SERVICES` check on `markDormant`/`clearDormant` and the three `service:*` cases, in the `service:check` wording. |
| SEC-19 | MINOR | ACCEPT | Both `sync:request` handlers use the non-mutating getter; a test that a display's `sync:request` leaves `scannedTokensByDevice` unchanged. |
| SEC-20 | MINOR | ACCEPT (with D-1) | Resolved by the ninth service; the display-liveness preflight row carries `service:restart display`. |
| SEC-21 | MINOR | ACCEPT | P15 records what the gate does and does not achieve; T3b keys observe-token eviction on deviceId so one client cannot flush the venue TVs. |
| SEC-22 | MINOR | ACCEPT | `/health` carries `{profileId, forPack}` only; the HTTP read-plane posture is stated beside P15. |
| SEC-23 | NOTE | ACCEPT-MOD | T3 tightens the orphan match to an exact argv comparison; the runtime-dir move is recorded as `host.json` headroom. |
| SEC-24 | NOTE | ACCEPT (via D-6) | No contract entry precedes its implementation, so nothing to ledger; the code-side pre-registration is noted in T1a. |
| SEC-25 | NOTE | ACCEPT-MOD ★ | T4 states `unknown` as the expected ALN network verdict until the owner records the kit's network values (SSID, orchestrator IP and name); an owner task, not a fixture guess. |

## State machine and lifecycle lens (43 findings: 9 blocking, 24 major, 9 minor, 1 note)

| id | sev | ruling | what changes in the plan |
|---|---|---|---|
| SB-1 | BLOCKING | ACCEPT (via D-3) | Dormancy keys on manifest-declared families; the generator declares every family the manifest names, so nothing is dormant on rung 1; red-first: `dormantServicesFor(generateSimulationProfile(needs))` is empty for both packs. |
| SB-2 | BLOCKING | ACCEPT-MOD ★ | P1 is recorded as a deliberate refinement of M6's open interior: an absent equipment family marks the services that exist only to drive it DORMANT (the registry mark the ratified design names in D-C3.1 and S6 pin c) and their features follow (cues silenced, commands refused). The map is the pin. The pack's `hardware.stack.<svc>.onAbsent`, collected and unread today, is read for row SEVERITY only (a down stack service is a fault with verbs under C1 §2 row 1; it never blocks a start). |
| SB-3 | BLOCKING | ACCEPT | When a cue id leaves the dormancy set during an active session, past-due clock cues are marked fired (reuse `_markPastClockCuesFired` scoped to the removed ids); T3 red-first beside `service:in-service`. |
| SB-4 | BLOCKING | ACCEPT-MOD (with D-1) | The display is the ninth service, so escalation has a target and a verb. Chromium supervision is display-aware: restart only while the scoreboard is the intended visible mode; `_doLaunch`'s orphan sweep is the pre-start hook; dead-while-hidden is normal and relaunches on show. |
| SB-5 | BLOCKING | ACCEPT | `ProcessMonitor` gains `supervisionKind: 'service' | 'observer'`; observers (pactl subscribe, the two D-Bus monitors) keep unbounded restart with backoff and never escalate; all five consumers are named in the host table. |
| SB-6 | BLOCKING | ACCEPT ★ | The typed "start anyway" dialog lands in T1a's scanner slice (`SessionManager.startGame` handles a NO-GO ack by asking for a reason and re-sending with `startAnyway`); gate and door ship together. |
| SB-7 | BLOCKING | ACCEPT-MOD ★ | Recorded refinement of R-C2-1: the heal runs at a session boundary only (first `sync:full` of a connection with no active session, or no local transactions for the current session); mid-session a mismatch shows a persistent, non-blocking banner and heals at the next boundary. The blocking backstop is reserved for a heal that FAILS. |
| SB-8 | BLOCKING | ACCEPT | `refresh()` validates then flips: stage, verify sha1s, run the consumer re-apply against the staged content, and only then write the pointer and GC; on re-apply failure the staging cache is discarded and the pointer untouched. |
| SB-9 | BLOCKING | ACCEPT | Collapse only when every service is healthy or profile-dormant; an operator-door latch keeps the dashboard expanded; the collapsed summary is also a toggle. Renderer test on an operator-door fixture. |
| SM-1 | MAJOR | ACCEPT ★ | `dormancyService` owns the operator-latch set (the authority); the registry entry is the projection; `recompute()` re-applies both doors after any reset; red-first: out-of-service survives `system:reset`. Overturns D-23. |
| SM-2 | MAJOR | ACCEPT | Disable provenance is `'gm' | 'once' | 'dormant'`; `once` consumption moves to its own persisted set; `disabledBy` for a fired once-cue pinned by test. The census method note (SN-1) is recorded for Block 3. |
| SM-3 | MAJOR | ACCEPT | `fireCue` returns `{fired, held, reason}`; the ack reports held as success with the parked message and refusals as `success:false`; every reason string enumerated in T1a. |
| SM-4 | MAJOR | ACCEPT | `releaseCue` propagates the fire outcome to its ack; on a refusal the hold is re-created with the new reason so nothing is dropped. |
| SM-5 | MAJOR | ACCEPT | An operator-door latch immediately expires every hold blocked by that service, emitting the discarded events; T3 red-first beside `service:out-of-service`. |
| SM-6 | MAJOR | ACCEPT | `CueRenderer` joins T1a's scanner slice: dormancy-disabled cues render grey with the door's wording, no Enable button, greyed quick-fire tile. |
| SM-7 | MAJOR | ACCEPT | One wording helper keyed on `door` (backend) with a scanner mirror, used by the executor, the summary and the row; both doors pinned. |
| SM-8 | MAJOR | ACCEPT | `resolve()`'s rollup field becomes `dormantNeeds`; its stale r1 comment is fixed in the same commit; P7 reads the preflight evaluation's `blocking`. |
| SM-9 | MAJOR | ACCEPT (via D-6) | No contract entry precedes its implementation. |
| SM-10 | MAJOR | ACCEPT (via D-17, SEC-02) | `preflight:` → `show-control` added; the redundant `service:` instruction deleted. |
| SM-11 | MAJOR | ACCEPT | The `sessionService.init` run point is dropped; the feed runs at the end of boot (after every init, before revalidation), at session create, and inside system reset. |
| SM-12 | MAJOR | ACCEPT | Supervision is dormancy-aware: a profile-dormant service's child is neither started nor restarted; an operator latch stops restarts; `service:in-service` starts it. |
| SM-13 | MAJOR | ACCEPT ★ | `host.json` is the single source. Per process `mode: 'self' | 'adopt' | 'off'` plus the strategy fields; `VLC_SELF_SPAWN` and `ENABLE_MUSIC_PLAYBACK` become deprecated aliases read once by `hostConfigService` with a loud warn. |
| SM-14 | MAJOR | ACCEPT | `restart()` = clear the pending timer, kill the child and await its close, reset the counter, `start()`, emit `restarted`. |
| SM-15 | MAJOR | ACCEPT (via SEC-15) | The require fixture pack. |
| SM-16 | MAJOR | ACCEPT (via D-12, SEC-01) | Rows quote `resolve()` verdicts verbatim; `fault` rows carry severity from `stack.onAbsent`; only `blocking` gates. |
| SM-17 | MAJOR | ACCEPT ★ | The `btAddress` rule is dropped; the Bluetooth service is never profile-dormant. |
| SM-18 | MAJOR | ACCEPT | The map splits: `audio.sinks` declared and none installed → `sound` and `music` dormant; `audio` dormant only when no sink AND no `display.main` (an installed display implies the HDMI sink). |
| SM-19 | MAJOR | ACCEPT-MOD | Predicate: at least one service-bearing command AND all of them on dormant services. With the display a service, `display:scoreboard` depends on `display` and `display:return-to-video` on `vlc` in `SERVICE_DEPENDENCIES`; `display:status` stays ungated. |
| SM-20 | MAJOR | ACCEPT (via D-19) | `assertions.js` joins T1a. |
| SM-21 | MAJOR | ACCEPT | The heal's reconnect tolerates one `DEVICE_ID_COLLISION` with a short bounded retry; pinned in T5 with a delayed server-side disconnect. |
| SM-22 | MAJOR | ACCEPT | Heal latch: at most one attempt per `{connection, serverHash}`; a second mismatch for the same hash goes to the backstop (or the mid-session banner) and stops. |
| SM-23 | MAJOR | ACCEPT | On restore of a non-ended session at boot, re-evaluate and re-stamp with `restoredAt`; a `no-go` is a loud warn plus a GM-visible row, never a refusal of a running session. `sync:full.preflight` is the service's last evaluation; the session stamp is separate. |
| SM-24 | MAJOR | ACCEPT | The `processQueue` branch stays for items queued before a latch; the test enqueues first and latches second; the scan-route wire is unchanged. |
| Sm-1 | MINOR | ACCEPT | Cross-reference corrected. |
| Sm-2 | MINOR | ACCEPT | `expireHolds` iterates the items and calls the per-item service discard. |
| Sm-3 | MINOR | ACCEPT | One expiry method called unconditionally by `endSession` and `systemReset`. |
| Sm-4 | MINOR | ACCEPT | `reset()` preserves dormant entries. |
| Sm-5 | MINOR | ACCEPT | `service:check` on a dormant service acks the door wording without probing. |
| Sm-6 | MINOR | ACCEPT | The whole identity block leaves the branch; only the collision check stays GM-scoped. |
| Sm-7 | MINOR | ACCEPT | In adopt mode `service:restart vlc` is owner re-resolve only, and the ack says so. |
| Sm-8 | MINOR | ACCEPT | The HA WebSocket reconnect stays unbounded with a capped backoff and escalates on elapsed downtime; `down` is reported on `auth_invalid` before `_wsStopped`. |
| Sm-9 | MINOR | ACCEPT | The domain enum line is named in T4. |
| SN-1 | NOTE | ACCEPT | Census greps for a seam cover its mutators by name; recorded for the Block 3 censuses. |

## Owner-visible rulings (★) for the "before any code" report

D-1, D-3/SB-2, D-5, SB-6, SB-7, SEC-01, SEC-06, SEC-08, SEC-14/SM-17, SEC-25, SM-1, SM-13.
