# The architecture pass: program document

**Status: ratified by the owner, 2026-10-30 (decision 16).** This
document records the owner's decisions from the pass's definition
session (Appendix A, decisions 1 to 16, rounds 1 to 7 on 2026-10-30)
and the evidence they rest on. It makes no new decision. Anything new
found while writing it went back to the owner as a question first
(decision 14). Section 11 maps every section to its decisions.

**In one paragraph.** The pass decides shared rules for runtime state,
the facts a running game changes (decisions 7 and 11). The kickoff
brief framed this as giving runtime state a rule like the one "one
truth" gives verdicts. It runs in two phases. Phase 1 decides the
shared rules for the whole engine with the owner, one question round
at a time, and ends with a new roadmap. Phase 2 changes the engine to
follow the rules, one area at a time, before the capture block, the
preview block and players' phones. It takes the show-ready gate's
second condition: the engine work that must land before green can
replace blue. First after ratification: green's three follow-ups as a
separate small task, and phase 1's cause analysis.

Vocabulary: `CONTEXT.md`, especially §2 (one truth, verdict), §4b
(runtime state, authority, copy, delivery path) and §7 (architecture
pass, truth sweep). Process: `docs/agents/process.md`.

## 1. What the pass is

**Architecture pass.** The whole-engine program that turns the lessons
of blue's run and the needs of the planned capabilities into the
engine's architecture and interfaces. Phase 1 decides the shared rules
and revises the roadmap. Phase 2 changes the engine to follow them,
each rule proven by a test. (`CONTEXT.md` §7; decision 7.)

The owner's direction (kickoff brief,
`docs/plans/briefs/2026-10-30-architecture-pass-kickoff.md`): "What's
more important than triaging the production fixes in ASAP is to
integrate the lessons that may be learned into our updated engine
architecture." The scope: "the whole engine." Blue keeps running the
game until the new engine is ready to swap in on green, and no date
governs the work (`CURRENT-STATE.md` §1).

Why the engine needs it, from the evidence. The kickoff brief states
the gap: "one truth" governs readiness only, and the runtime state the
GM watches has no rule like it (kickoff brief, "The recommendation on
the table"; "verdicts" is now the word for what one truth checks,
decision 3). The map of the engine as built found that the backend
keeps almost every game fact in one place, the current game session,
while every screen holds copies, and each client invented its own
rules for them
(`docs/plans/architecture-pass/2026-10-30-map-runtime-state.md` §1).
Blue's September fixes added one special case at a time: three more
places that update a tablet's claimed-token list, and a hand-written
table that re-sends a service's state when its health changes (blue's
fixes plan, W1 and W4, read with
`git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md`).

The owner's condition with decision 1 was that the orchestrator first
understand the engine being built and the roadmap being adjusted,
starting with how the truth sweep differs from the pass. The nine
evidence files in §8 were made for it. In short: the truth sweep was a
repair job on the routes by which service status reaches the GM's
admin panel, taking today's design as given; the pass decides the
design itself, for the whole engine (runtime-state map §1, item 9;
`CONTEXT.md` §7).

## 2. Scope

The whole engine, as `CONTEXT.md` §0 defines it: the backend
orchestrator, the GM scanner, the player scanners (web and ESP32), the
scoreboards and the config tool (decision 1). The questions also reach
the test environment (question 4) and the needs of the planned
capabilities: hot-apply, the preview engine, the capture block and
players' phones (decision 12).

The components keep their settled roles (decisions 5 and 9). The player
scanners, web and ESP32, have the same functions: they show token
content and report scans, with no scoring and no live game feed. The
GM scanner is the command center. The scoreboards show the public
results: team scores and exposed evidence.

The pass works inside the standing rules: blue's containment
(`CURRENT-STATE.md` §4; work on the new engine never touches blue's
branch), the roadmap's standing constraints (`ROADMAP.md` §2), and
contracts before code (root `CLAUDE.md`, "Contract-First
Architecture").

## 3. The nine questions

The pass answers these for the whole engine (decisions 1, 5, 9 and
11). Each question gets its own rule and proof test. Phase 1 designs
questions 1, 6, 8 and 9 together, because between them they make one
rule for live state (decision 11). The right-hand column names the
evidence that raised each question; every file named is in
`docs/plans/architecture-pass/` unless the cell says otherwise.

| # | Question | What raised it |
|---|---|---|
| 1 | Who decides each fact the GM sees? (the authority) | A deleted transaction's token stays refused on every tablet: each tablet keeps its own list of claimed tokens, and the tablet ignores the backend's release when it arrives (blue's fix W1; runtime-state map R7 and §0) |
| 2 | Does a service's state travel with its health? | A health change sends only the health row, so the music and lighting panels could freeze (blue's review, B-2 and B-3; blue's fix W4; runtime-state map §8 Q2) |
| 3 | How does the engine read the programs it drives? | By parsing text and event streams that nothing re-reads when they fail; one parser bug caused the long video stall (blue's fix W10 P1; runtime-state map §6) |
| 4 | Can anything other than the live engine touch the live show? | Tests share process files, the TV and the audio stack with the live engine, and a preview engine would too (blue's fixes W10 P2 to P4; runtime-state map §7; `docs/plans/2026-09-04-phase3-design-workspace-pages.md:302`) |
| 5 | Does one question get one answer? | Twenty-two questions have more than one answerer, such as "is a video playing" and "is this token claimed" (runtime-state map §5, corrected in §0) |
| 6 | What does each fact and each copy do at a boundary: a game starting or ending, a system reset, a restart, a pack change while running? | An ended game comes back after a restart and accepts player scans; a reset from the GM leaves music out of its rebuild (runtime-state map §0 and §8 Q6) |
| 7 | Does each component receive what its role needs, and no more? | The scoreboard receives every transaction and the whole token file and filters on its own side; the state endpoint answers anyone on the kit network without a login (`2026-10-30-map-clients-tests.md` §1.1; runtime-state map §8, "what the six questions miss", item 3, and §0; `2026-10-30-map-inbound.md`) |
| 8 | How may a copy be updated, and can a screen tell how old it is? | The GM updates copies from the same message by four different rules; health entries and messages carry times that no screen reads (runtime-state map §1 and §8, "what the six questions miss", item 1; the unread times: §0) |
| 9 | Is each fact's reconnect snapshot built the same way as its live update? | For six facts it is not, and the GM applies the two by different rules (runtime-state map §4) |

## 4. Phase 1: decide the shared rules

Phase 1 decides the shared rules for the whole engine together.
Throwaway prototypes are allowed. It ends with the new roadmap
(decision 7).

### 4.1 How it runs

Every decision is made in a question round with the evidence in view,
and written into its document at once. The documents record decisions;
they are never where a decision is first made. Ratification is a skim
with no new decisions (decision 14; `docs/agents/process.md` §5, last
bullet). The steps run in this order (decisions 12 and 15):

| Step | The work | What the owner sees | What the owner decides | What gets written |
|---|---|---|---|---|
| 1. Cause analysis | One small workflow over every blue fix, every finding blue left unfixed, and every finding in the evidence files: readers split by source (blue's records, the backend, the GM scanner, the other clients and tests), then a merge that groups every finding by cause, then a refute-by-default check. For each finding: the problem area, the design cause, every other place with that cause, the design choice that removes it, the proving test (decision 8) | A short list of causes, each with the fixes and findings behind it | Whether the list is right: anything missing or wrongly grouped | The cause analysis |
| 2. Test rig | Rebuild the rung-1 rig from its recipe (`docs/plans/2026-09-12-container-baseline.md` §7) and reproduce the findings nobody has run: the GM panel falling behind live music, the ended game returning after a restart, the reset that leaves music out, the tablet that still refuses a deleted token. Phase 2's proof tests run on this rig too | A report of what the rig reproduced | Nothing; these are facts | Live-proof marks in the cause analysis |
| 3. Design | Rule by rule, with the skills `codebase-design` and `improve-codebase-architecture`. For the hard rules, two or three competing designs written side by side. Possible candidates for the hard rules, not decided: keeping claimed tokens correct when a tablet scans offline, getting a service's health and state to the panel together, and keeping tests and preview engines off the live machine. A throwaway prototype where the code's behaviour is uncertain; prototypes never merge. Every rule says how it serves hot-apply, the preview engine, capture and phones | One page per rule: the designs side by side, before-and-after diagrams, a recommendation. Pages are published for the owner to open, never left as temporary files | Which design | The rule and its proof test; its contract proposals; a decision record if it is hard to reverse; new terms in `CONTEXT.md` |
| 4. Build order | Phase 2's areas drafted in a proposed build order, with the dependency behind each step | Nothing yet; it comes to the owner in step 6 | Nothing yet | The draft roadmap |
| 5. Review | An adversarial review of the rules and the proposed build order: two reviewers with different angles, a checker for each finding, one fleet at a time. A September review of this shape cost about six million helper tokens (`docs/agents/process.md` §2, rule 7 amendment) | Nothing yet; its findings come to the owner in step 6 | Nothing yet | Nothing yet |
| 6. Question round | One round with the review's findings that would change a decision, and the build order | Only those findings, and the proposed order with the dependency behind each step | Each finding; the order | Corrections to the record; the new roadmap |
| Ratification | Assemble the five documents | The five documents, already matching the decisions | Ratify | The state page names phase 2's first area |

The pass is a roadmap revision run the way the September re-charter
ran: evidence, a draft with numbered questions, an adversarial review,
grill rounds, ratification (decision 2). Decision 15 sets the order of
phase 1's steps, shown above.

### 4.2 What phase 1 hands over

Five documents, each already matching the decisions made in the rounds
(decision 10):

1. **The rules.** One per question, each with a proof test in plain
   words: what to do, and what must happen. An illustration of the
   form only, not a decided test: "Delete a transaction; its token
   scans again on every tablet, with no reload."
2. **The cause analysis.** Every blue fix, every unfixed blue finding
   and every finding in the evidence, assigned to a cause and to the
   rule that removes it, or set aside with a reason.
3. **Contract proposals.** The message changes the rules need, drafted
   for the two contract files before any code changes.
4. **Decision records.** One short note per hard-to-reverse choice,
   in a new `docs/adr/` folder.
5. **The new roadmap.** Phase 2's areas in build order, the remaining
   hardening pieces and the truth sweep's purpose placed inside them,
   the show-ready gate restated, and the later blocks after phase 2.

### 4.3 When phase 1 ends

At the owner's ratification, and only once all of these hold
(decision 13):

- every question has a rule and a proof test;
- every finding and every blue fix is assigned to a rule, or set aside
  with a reason;
- every rule says how it serves the planned capabilities;
- the review's blocking findings are resolved;
- the rig reproduces each finding marked for live proof.

## 5. Phase 2: build the rules into the engine

Phase 2 changes the engine to follow the rules, one area at a time
(decision 7):

- It is the first work in the new roadmap, before the capture block,
  the preview block and players' phones.
- Each area gets its detailed design just before it is built, the way
  each block already opens (`ROADMAP.md` §10.3), and starts with its
  proof test failing on today's engine. Building follows the project's
  build method (`docs/agents/process.md` §1).
- The remaining hardening pieces are rebuilt inside its areas. So is
  the truth sweep's purpose: proving with rig tests and screen captures
  that every screen tells the truth, the scoring, transaction and
  session screens included (decision 6).
- It takes the show-ready gate's second condition, the slot the
  hardening block and the truth sweep held (`ROADMAP.md` §3 note).
- It ends, and the pass with it, when every rule's test passes on the
  rig.

## 6. How blue's fixes are used

Blue's fixes and the findings blue left unfixed are evidence of where
today's design is weak (decision 8). Phase 1's cause analysis reads
each one for its problem area, the design cause, every other place
with that cause, the design choice that removes it, and the proving
test. Fixes that share a cause become one design decision.

Two examples from the definition session (round 3):

- **Claimed tokens (blue's W1).** Blue added three more places that
  update each tablet's claimed-token list: after a reload, after a
  deleted transaction, after Reset All Scores. The cause: every tablet
  keeps its own list, so it must hear about every way a claim can
  change. A candidate for phase 1 to weigh, not decided: the tablet
  shows the backend's list, plus only its own offline scans the
  backend has not yet confirmed.
- **Frozen music and lighting panels (blue's W4).** Blue added a
  hand-written table that re-sends a service's own state when its
  health changes. The cause: health and state are separate facts on
  separate paths. A candidate for phase 1 to weigh, not decided: one
  record per service that carries both.

Blue keeps running shows on its own branch under its containment rules
(`CURRENT-STATE.md` §4).

## 7. How the pass revises the roadmap

The pass is a roadmap revision, run the way the September re-charter
ran (decision 2). Its fifth document becomes `ROADMAP.md` revision r5;
the r4 text survives in git history, as r3's did.

- **Block 2, hardening.** Its remaining pieces, except green's three
  follow-ups (decision 4), are rebuilt inside phase 2 (decision 7).
  The on-hold briefs are not edited until the architecture pass rules
  on them (hardening plan ruling 34, an orchestrator ruling); their
  recovered review findings are evidence. The merged pieces (the
  equipment families, the dormancy core, the harness minimum) stay in
  the engine. Phase 2 changes them only where a rule requires, and
  their standing review findings feed the cause analysis like every
  other finding (decision 15).
- **Block 3, the truth sweep.** Its charter is retired. Its purpose
  moves into phase 2 and covers every screen. Its census and its five
  recorded desync bugs are evidence (decision 6).
- **Other blocks.** The capture block, the preview block and the
  later blocks of `ROADMAP.md` §7, players' phones among them, come
  after phase 2 (decisions 7 and 10). The new roadmap places Block 6.
- **The show-ready gate.** Phase 2 takes the second condition
  (decision 7). The new roadmap restates the gate (decision 10).
- **Until r5 exists,** dated notes in `ROADMAP.md` §3, §4 and §10.1
  mark what has changed (decisions 6 and 7).
- **Green.** Its home hardware pass is the owner's to schedule
  (`CURRENT-STATE.md` §6). Its three follow-ups (the boot check that
  logs a false "WirePlumber rule missing" warning on a correct green,
  the two lines missing from the environment template, and the pip
  instruction the new operating system refuses) ship as one small task
  as soon as the definition session ends, alongside the pass (decision
  4).

## 8. The evidence the pass starts from

Nine files from the definition session, all committed in
`docs/plans/architecture-pass/`. Where the runtime-state map's §0
disagrees with its body, §0 wins.

| File | What it maps |
|---|---|
| `2026-10-30-map-direction.md` | Where the engine is going: 52 capabilities and what each asks of runtime state |
| `2026-10-30-map-roadmap.md` | The roadmap's reasoning: the blocks, the truth sweep's scope, the hardening pins by mechanism, each paused piece |
| `2026-10-30-map-backend-game.md` | Backend game state and its delivery |
| `2026-10-30-map-backend-show.md` | Backend show control, equipment, health and the outside programs |
| `2026-10-30-map-gm-scanner.md` | The GM scanner's copies and how each is written |
| `2026-10-30-map-clients-tests.md` | The scoreboard, both player scanners, the config tool, and how tests share the machine |
| `2026-10-30-map-inbound.md` | Everything each component sends to the backend, and how it hears back |
| `2026-10-30-map-runtime-state.md` | The merged map of every runtime fact, with the check's corrections in §0 |
| `2026-10-30-map-runtime-state-check.md` | The refute-by-default check of the map: 120 claims, 99 held |

Also evidence: blue's records on `production-2026-07` (read with
`git show origin/production-2026-07:<path>`), the triage
(`docs/plans/2026-10-30-production-fixes-triage.md`), and the
recovered review findings
(`docs/plans/2026-10-30-recovered-review-findings.md`). Nothing in the
nine files was observed on running software; step 2 of phase 1 exists
for that.

## 9. Records and working rules

- Decisions go on the state page at once, then into the phase 1
  documents (`docs/agents/process.md` §5). Terms go into `CONTEXT.md`
  as they settle.
- Phase 1's rules, cause analysis and contract proposals live in
  `docs/plans/architecture-pass/`; decision records in `docs/adr/`;
  the new roadmap in `ROADMAP.md`.
- Findings are committed as they land, and workflow fleets are sized
  to the question (`docs/agents/process.md` §2, rule 7 amendment). The
  adversarial review runs one fleet at a time (decision 12).

## 10. First steps after ratification

1. Green's three follow-ups, as one small task from their brief
   (`docs/plans/briefs/2026-09-13-green-followups.md`), alongside the
   pass (decision 4).
2. Phase 1, step 1: the cause analysis (decisions 12 and 15). Step 2, the
   rig, follows it.

## 11. Decision index

| Section | Records decisions |
|---|---|
| Status line | 16 |
| 1. What the pass is | 1, 3, 7 |
| 2. Scope | 1, 5, 9, 12 |
| 3. The nine questions | 1, 5, 9, 11 |
| 4. Phase 1 | 2, 7, 8, 10, 12, 13, 14, 15 |
| 5. Phase 2 | 6, 7 |
| 6. How blue's fixes are used | 8 |
| 7. How the pass revises the roadmap | 2, 4, 6, 7, 10, 15 |
| 8. Evidence | the owner's condition in decision 1 (stated in §1) |
| 9. Records | 12, 14 |
| 10. First steps | 4, 12, 15 |

Decision 3 (the runtime-state terms) is used throughout and lives in
`CONTEXT.md` §4b.

## Appendix A. The decision record

The definition session's decisions, moved here word for word from the
state page (`docs/plans/CURRENT-STATE.md` §0) when the owner ratified
this document; decision 16 records the ratification. The rounds are
the session's question rounds, all on 2026-10-30. Phase 1's decisions
go on the state page as they are made (§9).

1. The architecture pass is the next unit. The paused hardening
   pieces and the truth sweep wait for its answers. Its central
   question: who decides each fact the GM sees (the authority,
   `CONTEXT.md` §4b). It must also answer five more: does a
   service's state travel with its health; how does the engine read
   the programs it drives; can a test touch the live show; does one
   question get one answer; who re-checks after a reset. The owner's
   condition with the yes: the orchestrator must understand the
   engine being built and the roadmap being adjusted, starting with
   how the truth sweep differs from the pass.
2. The pass is a roadmap revision, run the way the September
   re-charter ran: evidence, a draft with numbered questions, an
   adversarial review, grill rounds, ratification. The
   `CONTEXT.md` entry for "architecture pass" waits until its
   difference from the truth sweep is settled.
3. Four terms are in `CONTEXT.md` §4b: runtime state, authority,
   copy, delivery path. An outside program can be an authority (VLC
   decides what is playing; confirmed in round 2). "Verdicts" names
   what one truth checks (§1).
4. Green's three follow-ups ship as one small task as soon as this
   planning session ends (round 2; the brief's hold line says so).
5. The question set (round 2). Question 4 becomes "can anything
   other than the live engine touch the live show?" (tests today, the
   preview engine later). Question 6 becomes "what does each fact and
   each copy do at a boundary?" (a game starting or ending, a system
   reset, a restart, a pack change while running). A seventh question
   asks what each component receives; the owner ruled that it must
   start from the settled roles of the player scanners (web and ESP32
   mirror each other), the GM scanner and the scoreboards. Its
   wording is open in round 3.
6. The truth sweep's charter is retired (round 2). Its purpose,
   proving with rig tests and screen captures that every screen tells
   the truth, moves into the build work the pass plans and covers
   every screen. Its census and five recorded desync bugs become
   evidence for the pass. `ROADMAP.md` §3, §4 and §10.1 and
   `CONTEXT.md` §7 carry notes.
7. The pass is one program in two phases (round 3, option c).
   Phase 1 decides the shared rules for the whole engine together,
   with throwaway prototypes allowed, and ends with the new roadmap.
   Phase 2 changes the engine to follow the rules, one area at a
   time, as the first work in that roadmap, before capture, preview
   and phones; it takes the show-ready gate's second condition
   (`ROADMAP.md` §3 note). Each area gets its detailed design just
   before it is built and starts with its proof test failing on
   today's engine. The remaining hardening pieces and the sweep's
   purpose are rebuilt inside phase 2. The pass ends when every
   rule's test passes on the rig. `CONTEXT.md` §7 has the
   "architecture pass" entry.
8. Blue's fixes and unfixed findings are evidence (round 3; the
   owner's meaning of the brief's question 6). For each: the problem
   area, the design cause, every other place with that cause, the
   design choice that removes it, and the proving test. Fixes that
   share a cause become one design decision.
9. The seventh question (round 3): "does each component receive
   what its role needs, and no more?", starting from the settled
   roles, which stay as designed (root `CLAUDE.md`, "How the Game
   Works"; `ROADMAP.md` §2.5): player scanners (web and ESP32, the
   same functions) show token content and report scans, with no
   scoring and no live feed; the GM scanner is the command center;
   the scoreboards show the public results: team scores and exposed
   evidence.
10. Phase 1 hands over five documents (round 4): the rules, one per
    question, each with a plain-words proof test (what to do, what
    must happen); the cause analysis (decision 8); contract
    proposals, drafted for the two contract files before code;
    decision records, one short note per hard-to-reverse choice, in
    a new `docs/adr/`; the new roadmap with phase 2's areas in build
    order, the remaining hardening pieces and the sweep's purpose
    placed inside them, the show-ready gate restated and the later
    blocks after phase 2.
11. Two more questions (round 4): 8, "how may a copy be updated,
    and can a screen tell how old it is?"; 9, "is each fact's
    reconnect snapshot built the same way as its live update?".
    Each question gets its own rule and test; phase 1 designs
    questions 1, 6, 8 and 9 together, because between them they
    make one rule for live state.
12. Phase 1's method (round 4), in order: (1) the cause analysis,
    one small workflow (readers grouped by cause, a merge, a
    skeptical check); (2) the rung-1 rig rebuilt from its recipe and
    used to reproduce the unrun findings (the music panel lag, the
    ended game returning after a restart, the reset without music,
    the refused deleted token); phase 2's proof tests run on it too;
    (3) design rule by rule with `codebase-design` (vocabulary,
    "design it twice") and `improve-codebase-architecture` (a visual
    report per design choice with before-and-after diagrams,
    published as a page), both confirmed for this pass: for the hard
    rules two or three competing designs side by side, a throwaway
    prototype where the code's behaviour is uncertain, never merged,
    and every rule saying how it serves hot-apply, the preview
    engine, capture and phones; (4) an adversarial review of the
    draft rules and roadmap: two reviewers with different angles, a
    checker per finding, one fleet at a time; (5) grill rounds on
    each decision; ratification.
13. Phase 1 ends at ratification, once every question has a rule
    and proof test, every finding and blue fix is assigned or set
    aside with a reason, every rule says how it serves the planned
    capabilities,
    the review's blocking findings are resolved, and the rig
    reproduces each finding marked for live proof (round 4).
14. Phase 1 runs as a flow in which every decision is made in a
    question round with the evidence in view, and written into its
    document at once; ratification is a skim with no new decisions
    (round 5). The approved flow: step 1, the owner confirms the
    cause list; step 2, facts only; step 3, one page per rule (the
    designs side by side, before-and-after diagrams, a
    recommendation) and the owner picks; step 4, only the review
    findings that would change a decision come back, as questions;
    step 5, the owner decides phase 2's build order; at ratification
    the state page names phase 2's first area. The rule stands for
    every unit: `docs/agents/process.md` §5, last bullet.
    (Decisions 10, 12 and 14 were completed on 2026-10-30 from the
    approved question text, after a record check found the first
    summaries too short.)
15. Three corrections from the record check (round 6). (a)
    Phase 1's order: cause analysis, test rig, design, a proposed
    build order, the review of the rules and the order, one
    question round with the review's findings and the order,
    ratification. (b) The merged hardening pieces (the equipment
    families, the dormancy core, the harness minimum) stay; phase 2
    changes them only where a rule requires, and their standing
    findings feed the cause analysis. (c) The cause analysis's
    readers are split by source (blue's records, the backend, the
    GM scanner, the other clients and tests); a merge groups every
    finding by cause; then the skeptical check. (Amends decisions
    12 and 14 where they differ.) Decisions 9, 11 and 13 were then
    completed from the approved question text after a second record
    check.
16. The owner ratified this program document (round 7,
    2026-10-30). The definition session closed; the architecture pass
    became the current unit, phase 1 first.
