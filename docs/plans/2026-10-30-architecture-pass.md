# The architecture pass: program document

**Status: draft for the owner's ratification, 2026-10-30.** This
document records the owner's decisions from the pass's definition
session (`docs/plans/CURRENT-STATE.md` §0, decisions 1 to 14, rounds 1
to 5 on 2026-10-30) and the evidence they rest on. It makes no new
decision. Anything new found while writing it went back to the owner
as a question first (decision 14). Section 11 maps every section to
its decisions.

**In one paragraph.** The pass gives the engine a rule for the facts a
running game changes, the way "one truth" already governs verdicts.
It runs in two phases. Phase 1 decides the shared rules for the whole
engine with the owner, one question round at a time, and ends with a
new roadmap. Phase 2 changes the engine to follow the rules, one area
at a time, before the capture block, the preview block and players'
phones. It takes the show-ready gate's second condition: the engine
work that must land before green can replace blue. First after
ratification: green's three follow-ups as a separate small task, and
phase 1's cause analysis.

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
repair job on one path, service status in the GM panel, inside
today's design; the pass decides the design itself, for the whole
engine (runtime-state map §1, item 9; `CONTEXT.md` §7).

## 2. Scope

The whole engine, as `CONTEXT.md` §0 defines it: the backend
orchestrator, the GM scanner, the player scanners (web and ESP32), the
scoreboards and the config tool (decision 1). The questions also reach
the test environment (question 4) and the needs of the planned
capabilities: hot-apply, the preview engine, the capture block and
players' phones (decision 12).

The components keep their settled roles (decision 9). The player
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
11). Phase 1 designs questions 1, 6, 8 and 9 together, as one rule for
live state (decision 11). The right-hand column names the evidence
that raised each question; every file named is in
`docs/plans/architecture-pass/` unless the cell says otherwise.

| # | Question | What raised it |
|---|---|---|
| 1 | Who decides each fact the GM sees? (the authority) | A deleted transaction's token stays refused on every tablet: each tablet keeps its own list of claimed tokens, and the backend's release never reaches it (blue's fix W1; runtime-state map R7 and §0) |
| 2 | Does a service's state travel with its health? | A health change sends only the health row, so the music and lighting panels froze on blue (blue's fix W4; runtime-state map §8 Q2) |
| 3 | How does the engine read the programs it drives? | By parsing text and event streams that nothing re-reads when they fail; one parser bug caused the long video stall (blue's fix W10 P1; runtime-state map §6) |
| 4 | Can anything other than the live engine touch the live show? | Tests share process files, the TV and the audio stack with the live engine, and a preview engine would too (blue's fixes W10 P2 to P4; runtime-state map §7; `2026-09-04-phase3-design-workspace-pages.md:302`) |
| 5 | Does one question get one answer? | Twenty-two questions have more than one answerer, such as "is a video playing" and "is this token claimed" (runtime-state map §5, corrected in §0) |
| 6 | What does each fact and each copy do at a boundary: a game starting or ending, a system reset, a restart, a pack change while running? | An ended game comes back after a restart and accepts player scans; a reset from the GM leaves music out of its rebuild (runtime-state map §0 and §8 Q6) |
| 7 | Does each component receive what its role needs, and no more? | The scoreboard receives every transaction and the whole token file and filters on its own side; the state endpoint answers anyone on the kit network without a login (runtime-state map §0; `2026-10-30-map-inbound.md`) |
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
bullet). The steps run in this order (decision 12):

| Step | The work | What the owner sees | What the owner decides | What gets written |
|---|---|---|---|---|
| 1. Cause analysis | One small workflow over every blue fix, every finding blue left unfixed, and every finding in the evidence files: readers grouped by cause, a merge, a refute-by-default check. For each finding: the problem area, the design cause, every other place with that cause, the design choice that removes it, the proving test (decision 8) | A short list of causes, each with the fixes and findings behind it | Whether the list is right: anything missing or wrongly grouped | The cause analysis |
| 2. Test rig | Rebuild the rung-1 rig from its recipe (`docs/plans/2026-09-12-container-baseline.md` §7) and reproduce the findings nobody has run: the GM panel falling behind live music, the ended game returning after a restart, the reset that leaves music out, the tablet that still refuses a deleted token. Phase 2's proof tests run on this rig too | A report of what the rig reproduced | Nothing; these are facts | Live-proof marks in the cause analysis |
| 3. Design | Rule by rule, with the skills `codebase-design` and `improve-codebase-architecture`. For the hard rules, two or three competing designs written side by side; for example: keeping claimed tokens correct when a tablet scans offline, getting a service's health and state to the panel together, and keeping tests and preview engines off the live machine. A throwaway prototype where the code's behaviour is uncertain; prototypes never merge. Every rule says how it serves hot-apply, the preview engine, capture and phones | One page per rule: the designs side by side, before-and-after diagrams, a recommendation. Pages are published for the owner to open, never left as temporary files | Which design | The rule and its proof test; its contract proposals; a decision record if it is hard to reverse; new terms in `CONTEXT.md` |
| 4. Review | An adversarial review of the draft rules and roadmap: two reviewers with different angles, a checker for each finding, one fleet at a time. A September review of this shape cost about six million helper tokens (`docs/agents/process.md` §2, rule 7 amendment) | Only the findings that would change a decision | Each such finding, as a question | Corrections to the record |
| 5. Roadmap | Phase 2's areas in build order | The proposed order, with the dependency behind each step | The order | The new roadmap |
| Ratification | Assemble the five documents | The five documents, already matching the decisions | Ratify | The state page names phase 2's first area |

This flow carries the September re-charter's elements (decision 2).
The evidence is the nine files in §8, plus steps 1 and 2. The draft
with numbered questions is the design pages of step 3 and the numbered
question rounds that settle them. The adversarial review is step 4.
The grill rounds are the question rounds throughout. Ratification
closes it.

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

- **Block 2, hardening.** Its remaining pieces are rebuilt inside
  phase 2 (decision 7). The on-hold briefs are not edited until the
  architecture pass rules on them (hardening plan ruling 34, an
  orchestrator ruling); their recovered review findings are evidence.
  The merged pieces (the equipment families, the dormancy core, the
  harness minimum): see question 15, pending.
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
  (`CURRENT-STATE.md` §6). Its three follow-ups, which stop a correct
  green logging a false "WirePlumber rule missing" warning at every
  boot, ship as one small task as soon as the definition session
  ends, alongside the pass (decision 4).

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
2. Phase 1, step 1: the cause analysis (decision 12). Step 2, the
   rig, follows it.

## 11. Decision index

| Section | Records decisions |
|---|---|
| 1. What the pass is | 1, 3, 7, 8 |
| 2. Scope | 1, 9, 12 |
| 3. The nine questions | 1, 5, 9, 11 |
| 4. Phase 1 | 2, 7, 8, 10, 12, 13, 14 |
| 5. Phase 2 | 6, 7 |
| 6. How blue's fixes are used | 8 |
| 7. How the pass revises the roadmap | 2, 4, 6, 7, 10 |
| 8. Evidence | the owner's condition in decision 1 (stated in §1) |
| 9. Records | 14 |
| 10. First steps | 4, 12 |

Decision 3 (the runtime-state terms) is used throughout and lives in
`CONTEXT.md` §4b.
