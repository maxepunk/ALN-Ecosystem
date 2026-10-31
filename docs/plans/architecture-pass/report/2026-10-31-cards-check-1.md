# Card check 1: C1, C4, C6, C7, C5, C9, C10, C12

- **Date:** 2026-10-31. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv` (HEAD `1fc627b2`; code as of `12baf920` plus `089dd527`, ALNScanner `e83723c`).
- **Checked:** `docs/plans/architecture-pass/report/2026-10-31-cards-g1.json` (C1, C4, C6, C7) and `2026-10-31-cards-g2.json` (C5, C9, C10, C12) against `docs/plans/architecture-pass/2026-10-30-cause-analysis.md` (sections 1, 2, 5) and the cited code. Refute by default: a claim holds only where the line was read.
- **Method:** the analysis sections for each cause were read in full; every before-diagram box and arrow was matched to the cited lines; word limits and the Mermaid rules were checked by a script over the drafts and over every replacement below (all replacements pass). Replacement values are complete field values, ready to paste.
- **Line note:** analysis line numbers are as of HEAD `1fc627b2`.

**Result:** 48 verdicts; 30 hold, 18 corrected. The recurring faults: notes naming only some of the competing candidates (C1, C7, C9, C12), designTerms misusing *shallow* or *adapter* or naming an owner other than the one the after diagram marks (C1, C4, C5, C7, C9, C10, C12), and unlabelled Mermaid edges (C5, C9, C10, C12). Two before diagrams drew a mechanism the code does not have (C6, C7), one after diagram drew a competing candidate's change (C9), and one seenLive claims a sighting nobody recorded (C12).

## C1 (tablet copies of game facts), from cards-g1

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens say only what the analysis says | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:19` (section 1: delete refused, reset while disconnected, union on reconnect / add on scan / unmark on one error, team created by a scan); `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:59` statement. |
| 2. Before diagram shows the code's mechanism | holds | Delete message carries `transactionId, teamId, tokenId, updatedTeamScore` (`backend/src/websocket/broadcasts.js:254-260`); tablet takes only the transaction id (`ALNScanner/src/network/messageRouters.js:47-54`) and `removeTransactionFromBroadcast` leaves the claimed Set alone (`ALNScanner/src/core/storage/NetworkedStorage.js:394-403`); snapshot carries this device's claims only (`backend/src/websocket/gmAuth.js:149-152`), applied by union (`NetworkedStorage.js:453-460`, comment `:454-457`); the backend frees its own entry (`backend/src/services/transactionService.js:696-700`). |
| 3. After diagram is a listed candidate, competitors named | corrected | Draws candidate (a) correctly (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:89`), but the note names only (b) and (c); the analysis lists five candidates (a)-(e) at `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:89-93`, and C4's card names every competitor. Note rewritten to name (b)-(e) within 35 words. |
| 4. designTerms vocabulary and owner | corrected | "Re-implements the claim rule ... two implementations" misstates C1: the tablet does not re-implement the rule (that is C9), it keeps a copy updated by one hand-wired handler per message (`messageRouters.js:47-54,94-99`; `NetworkedStorage.js:394-403,453-460`). Rewritten to name the owner (the engine's transaction service, which frees the claim at `transactionService.js:696-700`) and say where the seam leaks. |
| 5. Example ids, findings, blueFixes, questions | holds | A-05, A-06, A-24, A-25, B-13, B-19, C-01, C-04, C-29, C-30 all map to C1 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1008,1010,1025,1040,1042`); findings 19 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1073`); W1 and questions 1, 8 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:19`, `:97`). seenLive empty is right: A-05/C-04 and A-06/C-30 are marked for live proof, not seen (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:99`; blue's sheet column "Live proof"). |
| 6. Mermaid rules | holds | Lint run over both sources: first line `flowchart LR`, 6 nodes, all labels quoted, at most 5 words per line and 2 lines, every edge labelled, `classDef`/`class` lines as specified, owner on `eng`. |

### Replacement values

```after.note
Candidate (a): tablets hold the engine's claim list plus their own unconfirmed scans, replaced by one function. Competing: (b) version per fact; (c) no tablet list; (d) one write rule; (e) per-domain change pushes.
```

```designTerms
The engine's transaction service should own the claimed-token fact; tablets should hold only its copy. Today the tablet's networked storage module updates its copy through one hand-wired handler per message, so the seam leaks: any path without a handler leaves the copy stale. No locality.
```

## C4 (game boundaries), from cards-g1

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:25` (ended game back after restart, reconnecting tablet loses history, scoreboard blank, once-only cue spent); statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:195` (no table, no boundary message, inferred from a changed session id). |
| 2. Before diagram | holds | Game end writes the ended record to `session:current` (`backend/src/services/sessionService.js:530-534`) and nulls the session (`:549-554`); restart restores `session:current` with no status check (`:108-111`); player scans accepted when any session exists (`backend/src/routes/scanRoutes.js:36-50`); `_reset` reached only from `reset()` (`backend/src/services/cueEngineService.js:1166-1167`); the reset ends with a log line, no snapshot (`backend/src/services/systemReset.js:226-241,300`). |
| 3. After diagram | holds | Candidate (a) drawn (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:233`), marked as candidate; note names (b)-(e) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:234-237`); owner on the table. |
| 4. designTerms | corrected | The draft names the session module as owner while the after diagram (and candidate (a)) make a boundary table the owner, and "shallow implementation of one case" misuses *shallow*. Rewritten: owner is a boundary-table module; the seam leak and lost locality stated. |
| 5. Ids and counts | holds | A-01, B-17, B-55, B-61, C-05, C-36, C-38, C-39, D-31 all map to C4 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1008,1025,1029-1030,1040,1043,1054`); findings 22 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1076`); W8, question 6 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:25`). seenLive empty: the C4 rows are live-proof "yes" (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:243`). |
| 6. Mermaid | holds | Lint clean: 7 and 8 nodes, all edges labelled, classes as specified. |

### Replacement values

```designTerms
A boundary-table module should own each fact's lifetime at a game boundary: clear, keep or re-fetch. No such interface exists, so the session, cue-engine, reset and tablet modules each encode their own cases; the seam leaks and one boundary change has no locality.
```

## C6 (snapshot and live update), from cards-g1

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:29` (History badge, `--:--`, device list alternates, six senders); statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:285` (restore path fires none of the live events). |
| 2. Before diagram | corrected | The snapshot/live split, replace vs merge and the adapters are in the code (`ALNScanner/src/network/messageRouters.js:125-136` replace, `:170-175` merge; `ALNScanner/src/core/stateStore.js:18-43,50-75`). But the diagram routes everything through the adapters to a screen labelled "no event on restore", and that is false for that path: `StateStore.replace` does notify listeners unless the value is equal (`stateStore.js:50-75`). The silent restore is the transaction list: `setTransactions` dispatches no event (`ALNScanner/src/core/unifiedDataManager.js:233-238`), which never touches the five adapters. Redrawn with a separate History-restore branch. |
| 3. After diagram | holds | Candidate (a) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:309`); note names (b) and (c) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:310-311`); owner on the one describe per fact. |
| 4. designTerms | holds | Owner named (each fact's engine module, one description); the snapshot builder's interface is a hand-passed list of every service (`backend/src/websocket/gmAuth.js:165`; B-95 at `{A}:293`), a fair use of *shallow*; the leak is stated. |
| 5. Ids and counts | holds | A-22, A-30, A-32, B-31, C-23, C-44, C-46, D-01 map to C6 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1010-1011,1027,1042,1044,1051`); findings 11 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1078`); questions 9, 8 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:29`); no blue fix named. seenLive empty: no C6 row was seen live (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:317`). |
| 6. Mermaid | holds | Lint clean on the draft (the corrected before diagram also passes: 8 nodes, every edge labelled). |

### Replacement values

```before.mermaid
flowchart LR
  fact["Engine fact<br/>clock, session, devices"]
  snapB["Snapshot builder<br/>six hand-assembled senders"]
  liveB["Live message builder<br/>separate code per fact"]
  replace["Tablet: replace<br/>drops absent keys"]
  merge["Tablet: merge<br/>skips equal pushes"]
  adapter["Five adapters<br/>reshape before drawing"]
  hist["History restore<br/>fires no event"]
  screen["Screen<br/>stale or blank"]
  fact -->|"on connect"| snapB
  fact -->|"on change"| liveB
  snapB -->|"one shape"| replace
  liveB -->|"another shape"| merge
  snapB -->|"transaction list"| hist
  replace -->|"reshaped"| adapter
  merge -->|"reshaped"| adapter
  adapter -->|"unnamed fields dropped"| screen
  hist -.->|"badge never told"| screen
  classDef fault stroke:#dc2626,stroke-width:3px;
  class snapB,liveB,adapter,hist fault;
```

## C7 (replies), from cards-g1

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:31` and statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:325`. "Replays at every reconnect" is a subset of "on every snapshot" (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:331`), not a contradiction. |
| 2. Before diagram | corrected | Batch answered with no game is logged "entry not persisted" and acked (`backend/src/routes/scanRoutes.js:347-352`); the web scanner resolves the batch on 200 (`aln-memory-scanner/js/orchestratorIntegration.js:296-322`); generic error kept for retry (`ALNScanner/src/network/networkedQueueManager.js:103-109,219-228`); ack matched by action only (`ALNScanner/src/admin/utils/CommandSender.js:44`). Fault: the draft sends the late reset ack into a node labelled "error means try later". The reset is a different rule, a 5-second timeout that reports failure (`ALNScanner/src/app/domains/gameAdmin.js:310-314`). Relabelled the tablet node to carry both rules and the edges to say what happens. |
| 3. After diagram | corrected | Candidate (a) drawn correctly (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:353`), but the note names only (b) and (c); (d) a write-ahead log and (e) serialised same-action sends are also listed (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:356-357`). Note rewritten. |
| 4. designTerms | corrected | "Reply module" names no module the candidate proposes; candidate (a)'s owner is one `commit(fact)` (`{A}:353`), which the after diagram marks. The split is three ways, not two: typed result, generic `error` (`backend/src/websocket/adminEvents.js:153,166,177,227,238,307`), action-only ack (`:118-122`). "Client adapters" is a loose use of *adapter*. Rewritten. |
| 5. Ids and counts | holds | B-21, B-22, B-64, B-65, B-69, C-32, C-33, C-35, D-12, D-13, D-14, D-15 map to C7 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1026,1030,1043,1052`); findings 18 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1079`); questions 1, 8 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:31`); no blue fix. seenLive empty: C7 has no blue finding and nothing seen live (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:363`). |
| 6. Mermaid | holds | Lint clean: 8 nodes per diagram, every edge labelled. |

### Replacement values

```before.mermaid
flowchart LR
  dev["Player device<br/>queued scans"]
  tab["Tablet<br/>GM scan or command"]
  eng["Engine<br/>replies before the write"]
  ok["200 processed<br/>batch stored nowhere"]
  err["Generic error<br/>no request id, not final"]
  ack["Command ack<br/>action name only"]
  devRule["Device rule<br/>200 means delete"]
  tabRule["Tablet rule<br/>error retries, 5s fails"]
  dev -->|"batch, no game"| eng
  tab -->|"scan, command"| eng
  eng -->|"no game"| ok
  ok -->|"deletes the scans"| devRule
  eng -->|"permanent scan failure"| err
  err -->|"replays every snapshot"| tabRule
  eng -->|"slow reset"| ack
  ack -->|"after the 5s timeout"| tabRule
  classDef fault stroke:#dc2626,stroke-width:3px;
  class ok,err,ack,devRule,tabRule fault;
```

```after.note
Candidate (a): replies carry request id and final flag; scan outcomes typed; one commit saves before replying. Competing: (b) per-item batch results; (c) status endpoint by client id; (d) intent log; (e) serialised same-action sends.
```

```designTerms
One commit module in the engine should own each request's outcome: which request, final or not, stored or not. That interface is split between typed results, generic errors and action-name acks, so the seam leaks and three clients each keep their own reply rule.
```

## C5 (boot and reset), from cards-g2

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:27` and statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:251` (boot: persistence then broadcasts; reset: broadcasts then persistence, shorter list, listeners added twice). seenLive "reproduced in-process by the review" is the analysis's own wording for B-53 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:260,277`). |
| 2. Before diagram | holds | Boot: `sessionService.init()` registers persistence (`backend/src/app.js:206`, `sessionService.js:177-184`) before `setupBroadcastListeners` in `backend/src/server.js:139`/`:288`; cue forwarding once at boot (`app.js:250-261`). Reset: broadcasts at `backend/src/services/systemReset.js:138`, session/persistence listeners at `:160-163`, cue forwarding again `:168-180`; the reset is called with no `musicService` (`backend/src/websocket/adminEvents.js:77-90`, cited at `{A}:257`), so the music push is never re-added. |
| 3. After diagram | holds | Candidate (a) `assembleEngine()` (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:269`), marked as candidate; note names (b) and (c) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:270-271`). |
| 4. designTerms | corrected | "Two shallow implementations of one interface" misuses *shallow* (a shallow module is one whose interface is nearly as complex as its implementation; boot and reset are two hand copies of one job). Rewritten to name the owner (an engine-assembly module), the leak (every caller knows every service and the order) and locality. |
| 5. Ids and counts | holds | A-53, B-01, B-02, B-03, B-53, C-37, D-30 map to C5 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1013,1024,1029,1043,1053`); 4 examples cover all distinct rows; findings 7 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1077`); question 6 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:27`). blueFixes []: the analysis says blue *met* the ordering fault while fixing W4, it does not name a fix behind C5 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:27`). |
| 6. Mermaid | corrected | `boot --> music` (before) and `boot --> asm`, `reset --> asm`, `asm --> music` (after) are unlabelled; the rules give edges only in the labelled form. Both sources rewritten with labels; lint clean. |

### Replacement values

```designTerms
An engine-assembly module should own which services exist, their listeners and the order they are wired. Today boot and reset each implement that by hand, so every caller knows every service and the ordering rule: the seam leaks and a change has no locality.
```

```before.mermaid
flowchart TD
  boot["Engine start<br/>one service list"]
  reset["Reset System<br/>shorter list, no music"]
  persist["Storage listeners<br/>clear transactions"]
  bcast["Broadcasts<br/>build snapshot"]
  cues["Cue forwarding"]
  music["Music panel push"]
  boot -->|"1st"| persist
  boot -->|"2nd"| bcast
  boot -->|"once"| cues
  boot -->|"wires"| music
  reset -->|"1st"| bcast
  reset -->|"2nd"| persist
  reset -->|"again"| cues
  reset -.->|"never"| music
  classDef fault stroke:#dc2626,stroke-width:3px;
  class reset,bcast,cues fault;
```

```after.mermaid
flowchart TD
  boot["Engine start"]
  reset["Reset System<br/>teardown first"]
  asm["Engine assembly<br/>one list, one order"]
  persist["Storage listeners<br/>clear transactions"]
  bcast["Broadcasts<br/>build snapshot"]
  cues["Cue forwarding"]
  music["Music panel push"]
  boot -->|"calls"| asm
  reset -->|"calls after teardown"| asm
  asm -->|"1st"| persist
  asm -->|"2nd"| bcast
  asm -->|"once"| cues
  asm -->|"wires"| music
  classDef owner stroke:#0f766e,stroke-width:3px;
  class asm owner;
```

## C9 (the client decides), from cards-g2

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:35` and statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:436` (tablet verdict first, corrected only by a toast; standalone gaps; phone's own team and seen list). seenLive empty: A-34, C-07, C-58 are live-proof "yes" (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:477`). |
| 2. Before diagram | holds | Networked gate on the tablet's own status copy (`ALNScanner/src/app/domains/gameOps.js:233-240`); standalone paused check only (`ALNScanner/src/core/storage/LocalStorage.js:300-306`) and the refusal not acted on (`gameOps.js:355-361`); points on the result screen from the tablet (`ALNScanner/src/ui/uiManager.js:466,473`, cited `{A}:442`); correction as a toast (`ALNScanner/src/app/app.js:232-264`); player team discarded (`{A}:453`). |
| 3. After diagram | corrected | Two faults. The note names only (c); the analysis also lists (b) a shared rules package and (d) no team or seen mark on player scans (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:468-471`). And the after diagram draws the phone as "displays, never decides" sending "scan, no team", which is candidate (c)/(d), not (a); candidate (a) changes only the tablet. Note rewritten; phone kept as it is today, with a dotted edge saying the candidate leaves it unchanged. |
| 4. designTerms | corrected | "No shared adapter" misuses *adapter*, and "the gate" is not in the game-rules module (it is the session-status check). Rewritten: owner is the engine's game-rules module (scoring, completion, duplicate rules), the tablet holds a second implementation (`ALNScanner/src/core/storage/LocalStorage.js:394-438` against `backend/src/gameRules/scoring.js:133`), the seam leaks verdicts, no locality. |
| 5. Ids and counts | holds | A-02, A-34, B-62, C-07, C-09, C-58, D-09, D-10 map to C9 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1008,1011,1030,1040,1045,1051`); findings 18 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1081`); questions 1, 5 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:35`); no blue fix. |
| 6. Mermaid | corrected | `gm --> tab` (both diagrams) and `rules --> eng`, `rules --> local` (after) are unlabelled. Both sources rewritten with labels; lint clean. |

### Replacement values

```after.note
Candidate (a): networked shows the engine's verdict only, pending first; standalone uses a rules module the engine also loads. Competing: (b) one shared rules package; (c) devices only display; (d) players send no team.
```

```designTerms
The engine's game-rules module should own scoring, group completion and duplicate rules behind one interface both sides load. Today the tablet holds a second implementation kept in step by comment, so the seam leaks verdicts: a rule change lands in two places, with no locality.
```

```before.mermaid
flowchart LR
  gm["GM scans token"]
  tab["Tablet<br/>own copy of rules"]
  screen["Result screen<br/>Transaction Complete"]
  eng["Engine<br/>game rules, the authority"]
  toast["Toast<br/>corrects later"]
  local["Standalone store<br/>paused checked, ended not"]
  phone["Player phone<br/>own team, own seen list"]
  gm -->|"scan"| tab
  tab -->|"points, gate, match"| screen
  tab -->|"submit, networked"| eng
  eng -.->|"refused"| toast
  tab -->|"standalone"| local
  phone -->|"team engine discards"| eng
  classDef fault stroke:#dc2626,stroke-width:3px;
  class tab,screen,local,phone fault;
```

```after.mermaid
flowchart LR
  gm["GM scans token"]
  tab["Tablet<br/>shows verdict only"]
  screen["Result screen<br/>pending, then verdict"]
  eng["Engine<br/>game rules, the authority"]
  rules["Shared rules module<br/>loaded by both"]
  local["Standalone store<br/>uses shared rules"]
  phone["Player phone<br/>own team, own seen list"]
  gm -->|"scan"| tab
  tab -->|"submit, networked"| eng
  eng -->|"verdict with points"| screen
  rules -->|"loaded"| eng
  rules -->|"loaded"| local
  tab -->|"standalone"| local
  phone -.->|"unchanged by this candidate"| eng
  classDef owner stroke:#0f766e,stroke-width:3px;
  class eng owner;
```

## C10 (unknown shown as normal), from cards-g2

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow and whyItHappens | holds | `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:37` and statement `docs/plans/architecture-pass/2026-10-30-cause-analysis.md:485`; "nobody at the venue notices" and seenLive rest on A-74 "a greyed card went unnoticed at the venue" (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:495`). |
| 2. Before diagram | holds | Dormancy recomputes from manifest and profile into the registry (`backend/src/services/dormancyService.js:188-194`); the registry emits only on a status change (`backend/src/services/serviceHealthRegistry.js:97-105`); snapshot defaults `stopped` and `hdmi` (`backend/src/websocket/syncHelpers.js:187-190`, `environmentHelpers.js:18-29`); the panel counts healthy and collapses when profile-dormant (`ALNScanner/src/ui/renderers/HealthRenderer.js:73-86`); TV clock keeps counting (`backend/public/scoreboard.html:974-1000`, cited `{A}:505`). |
| 3. After diagram | holds | Candidate (a) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:520`); note names (b) and (c) (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:521-522`); owner on the registry. |
| 4. designTerms | corrected | "Each renderer module is shallow: it draws whatever arrives" misuses *shallow*, and two owners are named while the after diagram marks one (the registry). Rewritten with one owner and the seam leak (errors cross as defaults). |
| 5. Ids and counts | holds | A-16, A-74, B-72, B-76, C-03, C-47, C-48, D-11, D-22 map to C10 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1009,1015,1031,1040,1044,1052-1053`); findings 20 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1082`); questions 8, 2 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:37`); no blue fix. |
| 6. Mermaid | corrected | `prof --> dorm` and `push --> panel` are unlabelled in both diagrams. Both sources rewritten with labels; lint clean. |

### Replacement values

```designTerms
The health registry should own whether each service fact is known, unknown or stale, and when it was seen. Today the pushed facts' interface carries neither, so snapshot builders turn errors into defaults and the seam leaks: a failure crosses as a normal value.
```

```before.mermaid
flowchart LR
  prof["Venue profile<br/>fails to load"]
  dorm["Dormancy service<br/>reads no equipment"]
  reg["Health registry<br/>emits on change only"]
  snap["Snapshot builders<br/>catch error, send default"]
  push["Push to tablets<br/>no age, no unknown"]
  panel["Health panel<br/>calm green 3 of 9"]
  tv["TV clock<br/>keeps counting"]
  prof -->|"missing or invalid"| dorm
  dorm -->|"six not installed"| reg
  reg -->|"check time never shown"| push
  snap -->|"clock stopped, route hdmi"| push
  push -->|"drawn as normal"| panel
  push -.->|"engine gone, no signal"| tv
  classDef fault stroke:#dc2626,stroke-width:3px;
  class dorm,snap,push,panel,tv fault;
```

```after.mermaid
flowchart LR
  prof["Venue profile<br/>fails to load"]
  dorm["Dormancy service<br/>reports profile failed"]
  reg["Health registry<br/>known, unknown, stale"]
  snap["Snapshot builders<br/>send unknown, not default"]
  push["Push to tablets<br/>time observed, status"]
  panel["Health panel<br/>red profile row"]
  tv["TV clock<br/>drawn unconfirmed"]
  prof -->|"missing or invalid"| dorm
  dorm -->|"profile failed"| reg
  reg -->|"usable or not, time"| push
  snap -->|"unknown, not default"| push
  push -->|"drawn as unknown"| panel
  push -->|"stale past limit"| tv
  classDef owner stroke:#0f766e,stroke-width:3px;
  class reg owner;
```

## C12 (the pack and edited files), from cards-g2

| Claim | Verdict | Evidence |
|---|---|---|
| 1. atAShow, whyItHappens, seenLive | corrected | atAShow holds (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:41`, `:599`). whyItHappens lists "phone" among the parts that load the pack at their own moment; the analysis says the web player scanner reads a nested copy of its own, separately from the TV, ESP32, tablet and tool (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:599`; `aln-memory-scanner/js/app.js:61-87`). seenLive cannot be confirmed: blue's source for A-94 is a conditional in the deployment guide ("Skip the fast-forward in step 4 and a new token shows as UNKNOWN", `git show origin/production-2026-07:DEPLOYMENT_GUIDE.md`, line 1145), and the analysis marks the A-94 half for live proof (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:638`; row `:610`), so no sighting is recorded. |
| 2. Before diagram | holds | Pack frozen at activation (`backend/src/app.js:192,201-203`, cited `{A}:605-606`); file route resolves a path against the frozen inventory then sends the disk file (`backend/src/services/packService.js:1450-1459`, `backend/src/routes/packRoutes.js:34-45`); token endpoint re-reads (`backend/src/routes/resourceRoutes.js:53-65`); mismatch only logged (`backend/src/websocket/socketServer.js:139-148`); publish makes no engine call (`config-tool/lib/publish.js`, only the activation gate run in its own process at `:78,140-144`). |
| 3. After diagram | corrected | Candidate (a) drawn correctly (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:629`), but the note omits (d), per-file apply rules or one apply verb (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:632`). Note rewritten within 35 words. |
| 4. designTerms | corrected | "Its interface is shallow" misnames the fault and "each client is its own adapter" misuses *adapter*. The pack service's interface leaks the disk: `resolvePackFile` checks the frozen inventory and then hands out the live path (`packService.js:1450-1459`), while the token service re-reads around it (`resourceRoutes.js:53-65`). Rewritten. |
| 5. Ids and counts | holds | B-07, B-20, B-28, C-08, D-03, D-04, D-08, D-18, D-38, D-41 map to C12 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1024-1026,1040,1051-1052,1054-1055`); findings 20 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:1084`); questions 6, 5, 8 (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md:41`, `:636`); no blue fix. |
| 6. Mermaid | corrected | `disk --> files`, `disk --> tokens` (before) and `view --> files`, `view --> tokens` (after) are unlabelled. Both sources rewritten with labels; lint clean. |

### Replacement values

```whyItHappens
The engine freezes one pack at start, yet its file endpoints serve whatever is on disk and its token endpoint re-reads every call. The TV, tablet and hardware scanner each load it at their own moment and keep it; the phone reads its own copy. No message says it changed.
```

```seenLive
""
```

```after.note
Candidate (a): one versioned pack view; a swap makes a new view and one pack-changed event; files served from frozen copy. Competing: (b) restart-only packs; (c) clients keep no pack files; (d) per-file apply rules.
```

```designTerms
The pack service should own one versioned pack view. Its interface leaks the disk: it checks a path against the frozen inventory, then serves live bytes, and the token service re-reads the file around it, so frozen and live state cross the seam. No locality.
```

```before.mermaid
flowchart LR
  tool["Config tool<br/>publishes pack"]
  disk["Pack on disk<br/>new bytes"]
  frozen["Engine rules<br/>frozen at start"]
  files["File endpoint<br/>serves disk bytes"]
  tokens["Token endpoint<br/>re-reads every call"]
  tv["TV<br/>loads at page open"]
  tab["Tablet<br/>loads at app start"]
  tool -->|"writes"| disk
  tool -.->|"no message"| frozen
  disk -->|"read once at start"| frozen
  disk -->|"live bytes"| files
  disk -->|"re-read each call"| tokens
  files -->|"new rules"| tv
  files -->|"manifest old, bytes new"| tab
  tab -.->|"pack mismatch, log only"| frozen
  classDef fault stroke:#dc2626,stroke-width:3px;
  class frozen,files,tokens,tv,tab fault;
```

```after.mermaid
flowchart LR
  tool["Config tool<br/>publishes pack"]
  disk["Pack on disk<br/>new bytes"]
  view["Pack view<br/>one version, frozen copy"]
  files["File endpoint<br/>serves the frozen copy"]
  tokens["Token endpoint<br/>reads the view"]
  tv["TV<br/>told pack changed"]
  tab["Tablet<br/>compares hash, shows behind"]
  tool -->|"writes"| disk
  disk -->|"swap makes new view"| view
  view -->|"frozen bytes"| files
  view -->|"one version"| tokens
  view -->|"pack changed event"| tv
  view -->|"pack in every snapshot"| tab
  classDef owner stroke:#0f766e,stroke-width:3px;
  class view owner;
```
