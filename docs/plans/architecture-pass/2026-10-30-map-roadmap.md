# Map of the roadmap's reasoning and the paused hardening work (fact sheet)

Tree: `ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, commit `26fc2f2`, read 2026-10-30. Read-only reader output. Vocabulary follows `CONTEXT.md` (runtime state, authority, copy, delivery path: §4b, lines 377-400; one truth and verdict: §2, lines 181-196).

Short names used in citations: CS = `docs/plans/CURRENT-STATE.md` (current file, 175 lines); RM = `ROADMAP.md`; R4 = `2026-09-04-roadmap-r4-draft.md`; DEP = `2026-09-04-recharter-audit-dependencies.md`; COR = `2026-09-04-recharter-audit-corpus.md`; HP = `2026-09-12-block2-hardening-plan.md`; CEN = `2026-09-12-block3-truth-sweep-census.md`; REC = `2026-10-30-recovered-review-findings.md`; TRI = `2026-10-30-production-fixes-triage.md`; BR = blue's review, `git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-review.md` (line numbers are those of that file); CTX = `CONTEXT.md`; KO = `briefs/2026-10-30-architecture-pass-kickoff.md`. Briefs are cited by file name.

The pass's six questions (CS:17-24), labelled here PQ1 to PQ6: PQ1 who decides each fact the GM sees (the authority); PQ2 does a service's state travel with its health; PQ3 how the engine reads the programs it drives; PQ4 can a test touch the live show; PQ5 does one question get one answer; PQ6 who re-checks after a reset.

## Conclusions

1. **The sweep takes the structure as given; the pass decides it.** The truth sweep audits "every path from engine event to what the admin panel shows" and fixes "every place the panel shows something false", store-fed path only (RM:328-346). Its census is a fixed matrix, 10 domains by 7 columns (CEN:311-328), and its price is "5 adapters + 10 guards" (DEP:516-517). The pass asks who decides each fact for all runtime state (CS:17-20; CTX:392-400). The sweep never asks that. (Inference from those texts; no document states the contrast in one sentence.)
2. **The sweep's boundary is a scope brake, not a finding about the engine.** DEP:465-467 calls `GameOpsRenderer`, `GameAdminRenderer`, `EvidencePickerRenderer` "a different truth path, must be scoped OUT or the unit is unbounded". Those renderers are fed by `UnifiedDataManager`, not `StateStore` (CEN:5; `MonitoringDisplay.js:208-224` says "session is NOT a store domain").
3. **Blue's worst findings sit outside that brake.** Of the 29 triage rows I classify (section 2, table 2a), 11 are inside the sweep, 1 is an edge case, 17 are outside. Of the nine review findings the owner marked "Fix" (BR:133-136), six are outside (A-3, A-4, A-1, A-2, E-1, E-2) and three inside (B-7, B-2, B-3). Counts: see the completion check.
4. **The recorded reason for Block 2 before Block 3 is spent.** RM:345-346 and R4:490-492 (Q2) put the sweep after the health-state change "so the sweep pins the final vocabulary". The dormancy core landed that vocabulary (`serviceHealthRegistry.js:35` `HEALTH_STATUSES = healthy, down, dormant`). HP:981 and KO:80-84 say so. The census's section 8(e) ("dormant has not reached the health path at all", CEN:248-255) describes tree `e87f8c5` and is stale: `dormant` now appears in 19 files (`grep -rln dormant backend/src ALNScanner/src`, which includes 2 CSS files).
5. **The remaining hardening pieces add runtime state to the GM panel.** The preflight adds an 11th `service:state` domain and a 16th `sync:full` key (HP:192-197), a banner and backstop for the self-heal (self-heal-lane.md R-H4), health-card verbs and out-of-service latches (supervisor-lane.md). The sweep's matrix (10 domains) would be out of date before it ran. So the dependency runs from the pass to the pieces and the sweep, not the reverse (KO:80-84; inference).
6. **Two designs already assume the copy-and-infer pattern the pass questions.** The self-heal decides "a session boundary" by inferring it from a copy (`recentTransactions`), and its first draft read a field the wire never carries (REC:352-405, tree-SH-B1, blocking). The preflight panel's restore must clear on null (HP:546) because the 10 existing restore guards skip a missing key and leave stale state (CEN:155; RM:336-338).
7. **Same fact, more than one answerer, already in the merged core.** Display health: `probe()` and the exit handler classified one state opposite ways (REC:101-131). Held items: two stores, merged only at push time, kept separate by ruling (supervisor-lane.md R-S4; CTX:331-337). Profile identity: `/health` and `sync:full` both carry it, and the scanner has no consumer of either (`grep profile` in `messageRouters.js`, `MonitoringDisplay.js`, `main.js` returns nothing).
8. **A service's connection flag still lives beside its health word.** `musicService.js:73` (`this.connected`) and `:231` (`_setConnected`). `broadcasts.js:536-538` pushes only the `health` domain on `health:changed`. That is blue's B-2/B-3 shape, present on the new engine (TRI:63; PQ2).
9. **Contradictions inside the plan (section 3 and 5 give detail).** (a) The task and HP:98 say pins are in "section 3"; only P1-P16 are (HP:98-294); P17-P27 are in section 4 (HP:592-684, 705-782). (b) Who owns the `show-control` room join: supervisor row (HP:326), credentials and supervisor briefs ("the wiring step", credentials-lane.md:54-56, supervisor-lane.md:54-56), arms files (HP:511). (c) Who adds `preflight:run`: arms (HP:510; supervisor-lane.md:46) or wiring (HP:329, 333). (d) Lane start order: HP:326-327 say credentials and supervisor run "after the harness minimum"; ruling 30 (HP:962) says credentials after the profile check and supervisor after the dormancy survivors. (e) "The sweep rows" (HP:308, 549-561) is a Block 2 close piece; it is not the truth sweep (HP:297), and CS:128-132 lists no such piece.
10. **Gaps.** The sweep's own audit notes are lost (CS:136; TRI:96-99). Baseline screen images were never captured; R22 (HP:59) and CS:124-127 place them in "the sweep", but R22 attaches them to the sweep rows (HP:557-561), not to Block 3. No brief exists for the preflight arms, the panel, the wiring or the close review (CS:131-133). W10 P2 (shared PID files) is assigned to the supervisor (TRI:73) but the supervisor brief has no deliverable for it. The owner's confirmation of "an outside program can be an authority" is pending (CS:34-36).
11. **The six pieces with briefs are on hold, and ruling 34 says not to edit them** until the pass rules (HP:983). Their standing red-team findings are in REC §1-§4.

## 1. The blocks

Five pains (RM:247-261): panel-drift pain; is-it-working pain; reconstruction pain; scanner-UX pain; boot pain. Dependency claims are those of DEP (claims 1-5). Grill questions are R4 §9 (lines 484-575).

| Block | What it delivers | Pain served | Dependencies as DEP verified | Grill question that ruled its place | Status today |
|---|---|---|---|---|---|
| 1 Unlock (RM:273-291) | Whole-train review and merge walk; deployment-docs repair (Appendix C); boot-to-running posture; home hardware pass; screen baselines | Boot pain, first half (RM:283-287; R4:563-567). The block heading names no pain | Claim 5, REFUTED: Stage B not executable from the docs, 2 of 7 machine-state areas covered (DEP:521-586). Claim 3, REFUTED as stated: no screen golden masters, 16 visible changes (DEP:203-400, 249-252) | Q1 ladder and whole-train review (R4:484-488); Q9 first unit (R4:541-546); Q13 boot (R4:563-575); Q8 baselines (R4:536-539) | Coherent on main reached 2026-09-12 (RM:180-181). Appendix C closed by R24 (HP:974). Done except green's home hardware pass (CS:124-127). Baselines never captured (CS:125-127; CEN:296-307) |
| 2 Hardening (RM:293-326) | Third health word; supervisor; sticky dormancy and the start gate; scanner pack self-heal; preflight in panel and CLI plus human checklist; host-config file; block close | Is-it-working pain; part of panel-drift; boot pain second half (RM:293-295) | Claim 2, CONFIRMED: CS.2-CS.5 do not depend on the pages. Caveat: self-heal and hot-apply rewrite the same scanner pack-reload path, `packLoader.js` (DEP:121-199, 178-193). Claim 4 leg 5 item 5: the enum change lands under the sweep, so order matters (DEP:499-500) | Q2 re-order, ratified (R4:490-492); Q13 honesty rule (R4:563-575) | Done and merged: equipment families, dormancy core, harness minimum (P21, P22 only; HP:586-590, 955-957; CS:128-129). Paused: all other pieces (section 4) |
| 3 Truth sweep (RM:328-346) | Audit and fix every engine-event-to-panel path on the store-fed path; 5 recorded desync bugs re-tested; screen-capture tests | Panel-drift pain, "directly" (RM:328) | Claim 4, CONFIRMED bounded: 10 domains, 55 producer edges, 10 guards, 5 adapters; off-store renderers OUT (DEP:404-517). Runs after the health change (DEP:499-500) | Q2 (R4:490-492); Q8 screen tests join the sweep, priced at approval (R4:536-539) | Not started. Audit notes lost (CS:136). Census survives (CEN, tree `e87f8c5`) |
| 4 Capture (RM:348-373) | Roster, notes, photos, accusation capture; the session-bundle emitter; a photo store | Reconstruction pain | Claim 1: no dependency on the pages (CONFIRMED a, b); but three deliverables, not one: no bundle emitter exists, no binary upload path exists (DEP:12-119, 98-118) | Q3 position decided after pricing (R4:494-497); Q6 sub-scope split (R4:526-529) | Not started (CS:137) |
| 5 Preview (RM:375-401) | Pack manager; mechanics editor with verdict badges and hot-apply; rehearse affordance; first-run threshold; GM-scanner redesign enters design | Scanner-UX pain (design starts; RM:375-376) | No claim tests it directly. Claim 2 caveat: hot-apply composes with the self-heal on `packLoader.js` (DEP:178-193). Claim 1(b)2: the pages decline to own intake (DEP:50-55) | Q7 candidate contents (R4:531-534); Q12 rotate secrets before previewable (R4:558-561) | Not started (CS:137) |
| 6 Depth and close (RM:403-415) | Strings/theme editor, show designer, content view, hardware/roles editor, bindings page, profile-manager page; ledger sweep; era close record | The heading names none | No claim tests it. Nearest: claim 2 notes C4 bindings page and the L8 literal sit outside CS.2-CS.5 (DEP:188-193) | Q4 where "done" lives (R4:499-520); Q7 | Not started (CS:137) |

Notes. (a) The r4 draft's §9 header says Q4 "remains open" (R4:481-482, 499); the draft's own status line says Q4 closed and the draft was ratified (R4:3-5); the ratified roadmap carries the answer (RM:234-243). (b) RM:263 and RM:647-651 mark the calendar superseded by the owner on 2026-10-30; CS:138 agrees.

## 2. The truth sweep

**Charter.** "Audit every path from engine event to what the admin panel shows, and fix every place the panel shows something false; each fix gets a test on the rig. Scope is the store-fed path only" (RM:330-334). Audited surface: 10 service-state domains; 55 places the backend produces state; 10 reconnect-restore paths; 5 places the client reshapes data; 22 event types checked against the contract; one forwarded event with no consumer; 5 recorded desync bugs re-tested, not re-derived; screen-capture tests join (RM:335-343). Unpriced; price on 5 adapters and 10 guards (RM:343-344). Hardening plan adds R7 "Block 3 fixes reach the producer side" (HP:44) and R22's independent recount of the audit reports first (HP:59).

**Why the scope stops at the store-fed path (claim 4, quoted).** "Off-store renderers (a different truth path, must be scoped OUT or the unit is unbounded): `GameOpsRenderer`, `GameAdminRenderer`, `EvidencePickerRenderer`." (DEP:465-467.) The census confirmed it in code: `MonitoringDisplay._wireGameOpsSubscriptions` "has zero store subscriptions" (CEN:5, 182). `ALNScanner/CLAUDE.md` states the boundary: StateStore holds service domains with snapshot/shallow-merge semantics; "session/transaction data stays in UnifiedDataManager + storage strategies (list/accumulator semantics)". Claim 4 itself says the bounded price comes from adapters and guards, "not the domain count" (DEP:516-517).

**Census results (CEN, tree `e87f8c5`, every count re-verified; "Disagreements with claim 4: None", CEN:358-360).**
- Producer edges 55, 10 domains (CEN:34-51). Two undebounced paths: `video:failed` and `pushHeldState` (CEN:13-15).
- `sync:full` has 15 keys and 7 callers (CEN:76-107). Today the payload also carries `profile` (`syncHelpers.js`, read at `26fc2f2`), with no scanner consumer.
- 10 restore guards, truthiness-tested (`messageRouters.js:127-136`, read at `26fc2f2`); non-uniform key mapping (CEN:142-155). `StateStore.update` is a shallow merge, `replace` is wholesale (CEN:157-161).
- 5 reshaping adapters; `sound` has no renderer class; the gameclock adapter strips `startTime`, `totalPausedMs`, `expectedDuration` (CEN:165-184).
- 22 `MESSAGE_TYPES` equal the 22 AsyncAPI subscribe entries (CEN:188-207).
- 8 DataManager events forwarded, 7 consumed; orphan `session:updated` (CEN:211-226).
- Desync classes: mpd2 FIFO covered; `_volumeValues` covered; MPD `setvol` while stopped uncovered and unfixed; `sync:full` omission covered; health vs `dormant` pending Block 2 at census time (CEN:230-255).
- Code and contract disagree: music push carries `playlists`, contract prose says it does not (CEN:61, 363). The contract test uses `getState()`, not the push-time builder (CEN:283, 364). The `sound` restore guard has no test (CEN:272, 365).
- Zero screen-capture assertions; no baseline exists (CEN:296-307).
- Stale since: the dormancy core now covers 8(e) (see Conclusion 4). Re-count needed for producer edges (the `display` service and hardening pins add paths) and for domain count (P9 adds `preflight`).

**The recorded desync classes it re-tests** (DEP:479-500; CEN:230-255; R4:244-248): (1) mpd2 idle-FIFO desync; (2) audio-routing slider cache `_volumeValues`; (3) MPD `setvol` while stopped; (4) the `sync:full` omission class (4 recurrences, 7 callers); (5) health binary vs the `dormant` value. R4:244-248 names the fifth as "the health-word change landing under this sweep".

**What it would change in the engine's structure.** Inference from the charter and census: it would fix cells inside the existing matrix: name fields in adapters, make guards clear on absence, add the `sound` renderer and test, push a domain when its service's connection flips (blue's own fix 5, BR:103), fix producers per R7, add screen tests. **What it would not change:** the split between `StateStore` domains and `UnifiedDataManager` data; the `update`-versus-`replace` split between push and restore; the existence of a scanner copy of every domain; which module is the authority for any fact; the hand-written 10-guard restore block; the delivery of the same fact by both `service:state` and `sync:full` (CEN:142-155). The pass's PQ1/PQ2/PQ5 are about exactly those.

**Blue's review, finding by finding.** Codes: IN = decided by a store-fed renderer or by a producer feeding one (inside the sweep as chartered, with R7 for producer side); EDGE = on the audited surface but decided elsewhere, or a decision pending; OUT = decided by an off-store path or by engine code the sweep does not audit. "Path" names the renderer or path that decides it. Evidence for each path: BR table cell, TRI evidence column, plus the checks noted.

**2a. The 29 rows of the triage (TRI:41-76).**

| ID (TRI row) | Class | Path that decides it |
|---|---|---|
| A-3 delete never frees token | OUT | `gameOpsRouter` `transaction:deleted` to `dataManager.removeTransactionFromBroadcast` (`messageRouters.js:47-54`, read) and `NetworkedStorage` scanned set |
| A-4 reset leaves tokens refused | OUT | `gameOpsRouter` `scores:reset` to `clearBackendScores` (`messageRouters.js:56-58`, read) |
| A-9 reload does not mark tokens | OUT | `NetworkedStorage.js:357-359` (TRI:45). Shares the `sync:full` handler with the 10 guards, but the decision is in the data manager |
| A-1 Team Details reads missing scores | OUT | `GameOpsRenderer.js:221` (TRI:46) |
| A-2 groups always In Progress | OUT | `unifiedDataManager.js:569-572`, both strategies (TRI:47) |
| E-1 Game Activity Unknown | OUT | `gameActivityBuilder.js:55-64` (TRI:48) |
| E-2 report totals omit bonuses | OUT | `sessionReportGenerator.js:241-266` (TRI:49) |
| E-3 report owners from local file | OUT | `sessionReportGenerator.js:447` (TRI:50) |
| E-4 report cells unescaped | OUT | `sessionReportGenerator.js:424-433`; already fixed (TRI:51) |
| C-7 device ID header reverts | OUT | `settings.js:48-58` (TRI:54) |
| B-1 routing dropdown shows first sink | IN | `EnvironmentRenderer.js:174,191` on domain `audio` (TRI:52); backend half see the backend row |
| B-4 queued videos never visible | IN | `index.html:407` and `VideoRenderer` on domain `video` (TRI:53) |
| B-5 Check Now no feedback | IN | `HealthRenderer` on domain `health` (TRI:55). The ack half travels `gm:command:ack` through `domEventBindings`, not the store |
| B-7 two music volume controls | IN | `MusicRenderer.js:114` and `EnvironmentRenderer.js:47`, domains `music` and `audio` (TRI:56) |
| FB no offline state when music server down | IN | `MusicRenderer.js`, domain `music` (TRI:57) |
| B-2, B-3 lighting and music never refresh on connect flip | IN | Producer: `broadcasts.js:536-538` pushes only `health` on `health:changed` (read at `26fc2f2`); consumers `EnvironmentRenderer`, `MusicRenderer` (TRI:63). PQ2 |
| B-7 (backend) volume not broadcast | IN | `broadcasts.js` audio push list (TRI:64) |
| B-1 (backend) routes reported as aliases | IN | `audioRoutingService.js` getState, domain `audio` (TRI:65) |
| FA unrouted streams, idle-stream volume error | IN | `audioRoutingService.js`, domain `audio` (TRI:66) |
| FB (backend) music crash not visible at once | IN | `musicService.js:230` `_setConnected` reports to the registry only (TRI:72). PQ2 |
| W10 P1 video parser holds a message | IN | Producer of domain `video` by R7: `dbusSignalParser.js` (TRI:68). The cause is how the engine reads VLC, PQ3 |
| W9 P0.1 trust live position over cached state | EDGE | Absent on the new engine; "decide after P1" (TRI:69). A guard on `video` domain state |
| C-1 end of session wipes GM view | OUT | `sessionService.js:549-554` and `buildSyncFullPayload` session section (`syncHelpers.js:49,133`), consumed by session and transaction paths (TRI:67). Shares the `sync:full` handler with self-heal |
| W9 P0.2 skipped video loses position | OUT | `videoQueueService.js:479` completion event, consumer is the cue engine (TRI:70) |
| W9 P0.3 stale-process cleanup | OUT | `processMonitor.js` (TRI:71); supervisor |
| W10 P2 shared PID files | OUT | Fixed paths in five services (TRI:73); test and live system share files, PQ4 |
| W10 P3 leaked test child passes | OUT | Test harness (TRI:74); PQ4 |
| W10 P4 no kiosk-off switch | OUT | Test harness (TRI:75); PQ4 |
| W10 C1 harness starts second VLC | OUT | `tests/e2e/setup/vlc-service.js:84-90` (TRI:76); PQ4 |

The triage also lists three items "not checked" (TRI:78-80): W9 P0.4, the slider drag-guard reset, and B-5's backend half. They are unclassified here.

**2b. The 26 further IDs in blue's review that have no triage row** (BR tables, lines 34-95). Duplicates merged by the review: A-5 = E-1 (BR:19).

| ID | Class | Path that decides it |
|---|---|---|
| A-6 History badge hidden after reload | OUT | `main.js` DataManager listeners (BR:71) |
| A-7 blank RFID in Team Details | OUT | `GameOpsRenderer` (BR:72) |
| A-8 detective claim shows $ value | OUT | `NetworkedStorage.js:241-247`, `gameActivityBuilder.js:80-82`; owner accepted (BR:60, 140) |
| A-11 Session Details frozen | OUT | `session:update` to `SessionRenderer.render` in `_handleMessage` (`MonitoringDisplay.js:215-224`: "session is NOT a store domain") |
| A-12 queued result leaves success screen | OUT | scan result path (BR:74) |
| A-13 token counts disagree | OUT | scoreboard vs Team Details renderers (BR:75) |
| B-6 video status badge not in markup | IN | `VideoRenderer`, `index.html` (BR:77) |
| B-8 lighting grid built once | IN | `EnvironmentRenderer.js:91-100,133`; owner accepted (BR:64, 141) |
| B-9 cue grids built once | IN | `CueRenderer` (BR:78) |
| B-10 `StateStore.replace` shallow-equal skip | IN | `stateStore.js` (BR:79) |
| B-11 `AdminController.resume` no caller | OUT | controller lifecycle, no GM impact (BR:80) |
| B-12 restore and push shapes differ | IN | `sync:full` gameclock and cueengine vs `service:state` shapes: the restore-path audit (BR:81; RM:336-338) |
| C-2 standalone paused scan | OUT | `gameOps.js` (BR:38) |
| C-6 standalone admin shows ended as Active | OUT | `GameAdminRenderer.js` (BR:54) |
| C-8 overtime banner one-shot | OUT | `session:overtime` to `SessionRenderer.renderOvertime` (`MonitoringDisplay.js:230-232`); discrete event, not a store domain. Boundary case; classed OUT |
| C-9 duplicate does not name team | OUT | `gameOps` local guard (BR:82) |
| C-10 standalone Disconnected pill | OUT | header status (BR:83) |
| C-11 standalone no Delete button | OUT | `LocalStorage` (BR:84) |
| C-12 standalone no report path | OUT | `getSessionData` (BR:85) |
| C-15 History totals mislabelled | OUT | `GameOpsRenderer` totals (BR:86), product call |
| D-1 `cue:completed` no handler | EDGE | In the 22-event ingress audit (RM:340-341). `_handleMessage` has cases for `cue:fired` and `cue:error` only (`MonitoringDisplay.js:244-251`, read). The `cueengine` store domain still updates |
| D-3 `game-state:updated` never dispatched | EDGE | The 8-forwarded versus 7-consumed audit (CEN:211-226); consumer renderers are OUT |
| D-4 `#orchestrator-status` undefined | OUT | header markup (BR:90) |
| D-5 `offline:queue:processed` no consumer | IN | In the 22-event ingress list; accepted, never consumed (BR:91; RM:340-341) |
| E-5 report breakdown uses build-time scoring | OUT | `sessionReportGenerator` (BR:94) |
| E-6 report duration wall-clock | OUT | `sessionReportGenerator` (BR:95), info only |

Tally of 2a plus 2b: see the completion check. The owner's "Fix" tier: A-3, A-4, A-1, A-2, E-1, E-2 OUT; B-7, B-2, B-3 IN. "Address": B-5 IN, B-4 IN, C-7 OUT. "Lower": C-1, C-2, C-6, C-11, C-12 OUT. "Accept": A-8 OUT, B-8 IN (BR:129-141).

**Where one finding is shared with a hardening piece.** TRI:90-92: A-9 and C-1 sit in the same scanner handler the self-heal edits (the `sync:full` case). TRI:84-89: W9 P0.3, FB (backend) and W10 P2 live in the code the supervisor rewrites. These shared handlers are why the sweep and the pieces cannot be scheduled independently (Conclusion 5).

## 3. The hardening block's design

Pins counted with `grep -cE '^- \*\*P[0-9]+\.' docs/plans/2026-09-12-block2-hardening-plan.md` = 27. The same grep limited to lines 98-294 (section 3) = 16 (P1-P16); limited to lines 295-813 (section 4) = 11 (P21-P27 at HP:594-681, P17-P20 at HP:707-774). Assignment below accounts for all 27 (7+5+4+1+1+2+7 = 27). The "other" group is empty. Pins taken from the pins themselves; "gives the GM" is in game terms.

Pin index: P1 HP:100; P2 :117; P3 :123; P4 :139; P5 :144; P6 :153; P7 :162; P8 :175; P9 :192; P10 :198; P11 :216; P12 :232; P13 :248; P14 :256; P15 :272; P16 :286; P21 :594; P22 :602; P23 :641; P24 :647; P25 :655; P26 :668; P27 :681; P17 :707; P18 :731; P19 :746; P20 :774.

The three questions asked of each mechanism: **(a)** adds runtime state to the GM panel? **(b)** relies on a copy being replaced, merged or added to? **(c)** adds a second path for a fact that already has one?

### 3.1 One truth and verdicts: P1, P2, P7, P17, P18, P19, P20 (7 pins)
- P1 equipment families map to dormant services (pure `endpointServices.js`); P2 dependent needs follow their family; P7 the require gate (`startGame({startAnyway, reason})`, override stamp, restore re-evaluation); P17 the profile file is checked against its schema at boot; P18 a schema-failed file still loads, an envelope-failed one does not; P19 the `profile:schema` row and the third `blocking` rule; P20 `valid` joins the profile identity on `/health` and `sync:full`.
- **Gives the GM:** a broken venue file refuses the start and names the field; required equipment missing refuses the start; a typed reason overrides and is logged (HP:162-174, 746-773; p1-profile-check.md:11-22).
- (a) Mostly no. P1, P2, P17, P18, P19 are pure or boot-time. P20 puts `valid` on a wire field the scanner does not read, so no panel change; the panel's view is a ledger row for the panel task (HP:972). P7 adds a typed dialog and a session stamp `preflightOverride` (session metadata).
- (b) The stamp is a verdict copy frozen at start, re-stamped with `restoredAt` after a restart (HP:171-173). Verdicts are recomputed, not merged.
- (c) Yes, in one place: profile identity travels by `/health` (HTTP) and `sync:full` (WebSocket) from one function, `getProfileInfo()` (HP:774-777). P18 also gives "is there a profile" two answers: `getProfile()` null on envelope failure, `getProfileInfo()` with `valid: false` (HP:731-745). PQ5.

### 3.2 The health words and dormancy: P3, P4, P5, P6, P16 (5 pins)
- P3 which cues are silenced; P4 three disable provenances (`gm`, `once`, `dormant`); P5 sticky dormant carries its `door`; P6 the feed (`dormancyService`: `compute`, `apply`, `recompute`, the operator-latch set); P16 the display is the ninth service.
- **Gives the GM:** equipment not installed tonight is grey, never red; half-silenced cues say so; a cue is refused quietly, not held; the display has a health row (HP:123-143, 286-293; CTX:338-349).
- (a) Yes. `door` on health entries; `disabledBy` and `dormantCommands` on cue summaries (domain `cueengine`); a ninth entry in `health` and `sync:full.serviceHealth`.
- (b) Mixed. The registry entry is a projection of two sources: the profile (recomputed) and the operator latch (held in `dormancyService`, "the authority; the registry entry is its projection", HP:154-158). `report()` is ignored while latched (HP:146-147), so the registry has two writers with a precedence rule. `dormancyDisabledCues` is recomputed, never persisted (HP:139-141). On the scanner, `store.update('health')` merges at top level, so a whole per-service entry is replaced; a key cannot be removed.
- (c) Yes. Is a service dormant: `dormancyService` latch set, registry entry, cue engine set (three holders). Display: health row, `displayStatus` in `sync:full` and `display:mode` (three). Run points: end of init, session create, system reset (HP:158-161); the display is the one service reset does not re-check (REC:183-197, finding 8; PQ6). PQ2, PQ5, PQ6.

### 3.3 The supervisor and the verbs: P10, P11, P12, P13 (4 pins)
- P10 supervision (`ProcessMonitor` kinds, sliding flap window, `gave-up`, dormancy-aware, Chromium as a monitor consumer); P11 host config as the single source (`host.json`); P12 verbs are commands (`service:restart`, `service:out-of-service`, `service:in-service`, `preflight:run`); P13 one hold-expiry method.
- **Gives the GM:** a crashing service restarts a bounded number of times, then goes red with "crashed N times in Ws, supervision stopped; Restart to try again"; buttons Restart, Run without it, Put back in service; holds expire at session end, at reset, and when the service is taken out of service (supervisor-lane.md:18-30).
- (a) Yes: the `gave-up` message in the health entry; the operator-door latch; verbs on the health card. Verb results arrive on `gm:command:ack`, state via `service:state`, consistent with the simplified ack (root CLAUDE.md event notes).
- (b) Held items: the two stores stay separate; expiry iterates both; the video list gets a rule ("every held video is blocked by `vlc`", supervisor-lane.md R-S4) rather than a field. `sync:full.heldItems` is a bare array and the push wraps it as `{items}` (CEN:70, 326), re-wrapped on restore (`messageRouters.js:134`).
- (c) Yes. "Is this program running" has the child process (`ProcessMonitor`), the D-Bus name-owner path in adopt mode, the service's own flag, and the registry (supervisor-lane.md:82-84; R-S3). `gave-up` adds a fifth signal into the registry. PQ2, PQ3, PQ4 (W10 P2 not covered), PQ6.

### 3.4 Credentials on every connection: P15 (1 pin)
- Every socket presents a verified operator or observe token; the handshake carries no `deviceType`; the verified tier decides every gate; displays hold no device row; `sync:request` uses a non-mutating getter (HP:272-285, with R19 at HP:56).
- **Gives the GM:** nothing visible on show night except that a tokenless device is refused; the scoreboard behaves as today (credentials-lane.md:26-35). The pin states the limit: the read plane is not private (HP:283-285).
- (a) No. (b) No panel copy. One server-side read that wrote (`getDeviceScannedTokens()` writes an empty array) becomes non-mutating (credentials-lane.md:141-145). (c) It removes a second path: the self-declared station word versus the verified tier (ten reader sites, credentials-lane.md:97-106). PQ5 (one question, "who is this socket", gets one answer).

### 3.5 Self-heal: P14 (1 pin)
- The scanner compares `sync:full.pack.contentHash` to its active pack; at a session boundary it fetches from the connected orchestrator, validates, flips the pointer, re-applies, reconnects, and shows one toast; mid-session a banner; failure a blocking backstop (HP:256-271).
- **Gives the GM:** tablets pick up a new pack with one toast instead of scoring with old rules until someone reloads (self-heal-lane.md:16-34).
- (a) Yes: toast, `#packMismatchBanner`, `packBackstopScreen`, and a client latch Map keyed by socket id and hash (self-heal-lane.md R-H2, R-H4).
- (b) Yes, and it is the clearest "replace a copy" design: the pack is replaced wholesale after validation. Partial failure: "an apply-time throw lands on the new pointer" with the old cache already collected (R-H1). The boundary is inferred from a copy of transactions (R-H2), which is the blocking defect.
- (c) Yes. Pack identity reaches the scanner by the handshake `packHash`, `sync:full.pack`, and `/api/pack/*`; P14 adds a client-triggered refresh. PQ1 (the scanner's pack is a copy), PQ6.

### 3.6 The preflight and its panel: P8, P9 (2 pins; the panel has no pin of its own, HP:540-547)
- P8 one evaluator (`preflightService.evaluate`, rows quote `resolve()` verdicts, a fixed `limits` block); P9 delivery by a new operator-only `service:state` domain `preflight` in a `show-control` room, and `sync:full.preflight` required-and-nullable.
- **Gives the GM:** one button for a go/no-go list labelled paper or live, with its own limits on its face, in the panel and the command line (HP:175-197; RM:306-317).
- (a) Yes: an 11th domain, a 16th `sync:full` key, a panel section, a second room.
- (b) The service "holds the last evaluation (the one source); the session stamp and the domain push derive from it" (HP:186-190). Push updates by shallow merge, restore replaces. The panel's restore "also clears on null" (HP:546), unlike the other 10 guards.
- (c) Partly. Rows quote the registry's health and the profile (service arm, bindings arm), so a fact such as lighting health appears in `health` and again in a preflight row. The CLI and panel are two presentations of one evaluator (DoD g, HP:829). A second audience path (`show-control` room) exists beside the `gm` room. "Seven contract and test sites" per new domain (HP:197, 513-515) is the cost of the current delivery design. PQ2, PQ5, PQ3 (live arms read pactl, Home Assistant, host).

### 3.7 The test harness: P21, P22, P23, P24, P25, P26, P27 (7 pins)
- P21 per-worker data and log directories; P22 a closed output pipe never fills the disk; P23 the health timer stops at test end; P24 deterministic atomic fixtures; P25 a run can be torn down; P26 one command mirrors CI; P27 small hygiene. Only P21 and P22 were built (HP:586-590, 955-957).
- **Gives the GM:** nothing directly; trustworthy runs, and P22 changes production behaviour: a dead pipe silences the console instead of filling the disk (HP:617-622).
- (a) No. (b) No. (c) P21 gives each worker its own data directory instead of the shared one a test wiped (HP:950). P25 reaps only the rig's own PID files; service code keeps fixed PID paths (TRI:73), so W10 P2 stays open. PQ4.

## 4. The paused pieces

Names are the plan's plain names (HP:297-311). Brief names are in `docs/plans/briefs/`. "Pass questions" are PQ1-PQ6 above. "If one authority and one delivery path" gives inference only.

**4.1 The profile check** (`2026-09-12-p1-profile-check.md`). Delivers: a broken venue file refuses the session start and names the field; the typed override still works. Pins P17-P20. Standing finding: tree-P1-F01, blocking: the broken fixture would sit in a directory a contract test sweeps (REC:407-440; brief line 3). The plan-and-brief review's 18 findings were folded (HP:705). Pass questions: PQ5 (P18's two answers to "is there a profile"), PQ1 (profile identity on two paths). If one authority and one path: the validity check itself, nothing; where the panel gets `valid` changes (one delivery of profile identity instead of `/health` and `sync:full`; inference).

**4.2 The dormancy-core fixes** (`2026-09-13-dormancy-survivors.md`). Delivers: seven fixes so grey never hides a fault: an unknown equipment family no longer breaks "Create Session"; the display's Check Now no longer turns a real red green; a down display recovers and does not stay red after reset; a queue drains behind a dormant TV; a deliberate stop is not a crash; a half-silenced standing cue says so; a mistyped service name no longer answers healthy. Standing findings: 12 standing of 29 found (5 major, 7 minor) (REC:27-52). The brief covers findings 2, 11, 3, 4, 5, 8, 7, 9, 6, 12 in seven deliverables; finding 1 goes to the profile check, finding 10 to the arms (brief lines 40-49; HP:972). The implementation was lost before review (HP:979). Pass questions: PQ5 (findings 2/11 three answers on three paths; 3/4 `probe()` vs exit handler), PQ6 (5/8 display after reset), PQ2 (display state vs health). If one authority and one path: deliverables 4, 5, 6, 7 nothing; 2 mostly nothing (the retained verdict is a single record the driver already half-keeps); 3 changes (a reset would ask each authority instead of marking every service `down` first, REC:183-197; inference); 1 could move to the activation gate, which today is blind to `hardware` (REC:93; inference).

**4.3 Credentials** (`2026-09-12-credentials-lane.md`, revision 3). Delivers: a device with no credential is refused at once; the scoreboard still works and holds no station slot; each display's credential carries its id. Standing findings: 13 standing of 36 found, including two blocking (tree-C3, doctrine-C-2: the minted display id needs a reserved `SCOREBOARD` namespace) and three orchestrator rulings never applied to the brief (REC:253-305). Pass questions: PQ5 (who is this socket), PQ1 (the `sync:request` read that wrote), PQ4 (test helper arity, 43 files, R27, HP:64). If one authority and one path: nothing in the credential design; the audience of each domain (the `show-control` room) would be declared with the domain rather than in the auth file (inference).

**4.4 The supervisor** (`2026-09-12-supervisor-lane.md`, revision 2). Delivers: section 3.3. Standing: revision 2 never re-reviewed; dormancy-core findings were to be folded in (brief line 3). The triage adds requirements: W9 P0.3, FB backend, W10 P2 (TRI:84-89). Gap: the brief has no PID-path deliverable. Pass questions: PQ2, PQ3, PQ4, PQ6. If one authority and one path: this changes most. A service's connection flag, health word, supervision outcome and latch would travel as one record (deliverable 4 reports `down` into the registry separately from `connected`, the B-2/B-3 shape); adopt-mode exit detection and monitor exit would be one reading of the program (R-S3); the two held stores would not need an iterate-both expiry (R-S4). Deliverables 1, 3 (host file) and 2 (the restart policy) stay (inference).

**4.5 The self-heal** (`2026-09-12-self-heal-lane.md`, revision 3). Delivers: section 3.5; plus the two owed packLoader tests (ROADMAP row 8.5). Standing: tree-SH-B1 blocking (REC:352-405). Flow renumbered 33 (brief line 3). Pass questions: PQ1 (the scanner's pack is a copy), PQ6. If one authority and one path: the replace-the-copy core stays. The boundary rule would change: read from the session's state (the authority) instead of inferred from `recentTransactions`; C-1's retained ended session and A-9 meet the same handler (TRI:90-92); the router's `sync:full` case would shrink if guards were declared per domain (inference).

**4.6 The preflight arms and the command line** (no brief; fact sheet lost). Delivers: before the show the machine checks scenes, sinks, media, host and integrity and says what it cannot see; the CLI prints the same rows. Standing: REC:442-447 summary of 20 design-changing facts: `evaluate()` is synchronous but live arms need async (3 `sessionService` callers); no `unknown` verdict exists; `validateCommand` has zero callers and ignores dormancy; `resolvePackFile` containment is lexical while the Python builder follows symlinks; no operator-only room; `buildSyncFullPayload` has no tier parameter. Pass questions: PQ3, PQ5, PQ2, PQ4. If one authority and one path: the evaluator and rows stay; the service arm should quote the registry, not re-probe; the room and nullable key follow whatever the pass decides for domain audiences (inference). Finding 10 (`ORCHESTRATOR_KINDS` too wide) goes here (brief survivors lines 47-49).

**4.7 The preflight panel** (no brief). Delivers: the checks in the GM's panel with the limits footer. Standing: ledger row for the panel's view of `profile.valid` (HP:972); restore must clear on null (HP:546). Pass questions: PQ1, PQ5. If one authority and one path: depends on whether a new domain costs seven sites (HP:197); a declared-domain mechanism shrinks it (inference).

**4.8 The final wiring** (no brief). Delivers: the run command, its enum entry, the display Restart button, contract reconciliation (HP:333), plus the mechanical removal of the ignored `deviceType` parameter from 43 test files (R27, HP:64). Standing: the room-join and `preflight:run` ownership conflicts (Conclusion 9). Pass questions: PQ4 (test helpers), PQ5. If one authority and one path: nothing, except the room join if audiences are declared per domain.

**4.9 The close review** (no brief). Delivers: records, `dist` rebuild, the close gate, a whole-unit adversarial review (HP:563-576); required before any merge (HP:861). Pass questions: all six; it reviews the others. If one authority and one path: the lenses would add authority and delivery-path (inference); nothing else.

**4.10 The green follow-ups** (`2026-09-13-green-followups.md`). Delivers: a correct green stops logging a false "WirePlumber rule missing" at every boot; the environment template carries two bus variables; the requirements file gives the apt line. No review findings recorded. Pass questions: none directly (PQ3 at most: a boot check of a file the audio chain needs). If one authority and one path: nothing. Whether they ship before green's test is open with the owner (CS:140-143).

**4.11 The sweep rows** (extra, not in the task's list; HP:549-561). A Block 2 close piece: 22 close-gate ids from the old census, the profile check at boot-observation, plus R22's recount, documents row, border check and reference screenshots. CS:128-132 does not list it. Do not confuse it with Block 3.

## 5. How the pieces depend on each other

Plan order (HP:863): harness minimum, profile check, [credentials, supervisor, self-heal, preflight arms in parallel], panel, wiring, sweep fixes, pre-rehearsal review (then delta review). Stop points (HP:852-861): the dormancy core is "the Block 2a candidate"; each later piece is a coherent stop; the close review is "required before ANY merge". Six checkpoints (HP:871-881). Merge order with full suite after each: credentials, supervisor, self-heal, arms, then panel, wiring, sweep (HP:337-339).

Dependencies as stated: supervisor after the dormancy survivors (ruling 30, HP:962); credentials after the profile check (both edit `asyncapi.yaml`, HP:962); arms after the profile check (HP:329, 962); panel after the arms and the self-heal (HP:859); sweep fixes after supervisor, self-heal and panel (HP:332); wiring after the lanes (HP:333). Most are **file-collision** dependencies (R15, HP:52; credentials-lane.md:48-73; self-heal-lane.md:46-64), not logical ones. The self-heal and the panel both edit the router's `sync:full` case and `index.html`.

Which the pass's questions would change (inference):
- The sweep-fix dependency on the panel, supervisor and self-heal (HP:332) rests on the panel changing under them; under PQ1/PQ2 the sweep either folds into the pass's design or follows it (Conclusions 4, 5).
- The "self-heal before panel" serialization (R15, HP:52) exists because both edit one hand-written `sync:full` case. If restore were declared per domain, the serialization goes.
- The supervisor's dependency on the dormancy survivors stays; its internal shape changes (4.4).
- The preflight arms depend on the profile check for the `profile` kind and `blocking`; stays.
- Nothing in the pass's questions changes the harness-first order. PQ4 adds work: P23-P27 (deferred, HP:588-590) and the PID-path gap.
- The dependency audit's claim 2 caveat (self-heal and hot-apply share `packLoader.js`, DEP:178-193) stays; it concerns Block 5.

## Completion check

- Pins: `grep -cE '^- \*\*P[0-9]+\.' docs/plans/2026-09-12-block2-hardening-plan.md` = 27; section 3 lines 98-294 = 16; section 4 lines 295-813 = 11. Assigned: 7+5+4+1+1+2+7 = 27.
- Blocks 1-6: six rows in section 1.
- Paused pieces: ten entries (4.1-4.10) plus one extra (4.11).
- Blue's review: 29 triage rows (table 2a) plus 26 further IDs (table 2b) = 55 classified. Command: within each table, `grep -E '^\| '` then count the second column. Result 2a: IN 11, EDGE 1, OUT 17. Result 2b: IN 6, EDGE 2, OUT 18. Total IN 17, EDGE 3, OUT 35. (The review lists 43 IDs, 17 of which have triage rows; 43 - 17 = 26 further IDs; the triage's extra rows FA, FB, W9, W10 are not review IDs.)
