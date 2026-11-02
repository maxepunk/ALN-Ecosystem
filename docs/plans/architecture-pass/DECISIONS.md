# What the owner has decided

This is the architecture pass's decision record, written 2026-11-01. It
says what stands now, by topic. Each entry is the decision as it holds
today, with every later change already merged in, and a dated history
beneath it that says what changed, when and why. Decisions that no
longer hold are in "Superseded and withdrawn". The questions the owner
has not yet answered live on the owner site's Decisions page; the
"Still open" section only points there.

The owner's frame for all of it, in their words (2026-11-01): "design a
long-term optimal architecture for our engine that makes it intuitive
and easy to maintain, continue development on, and extend (proactive)".

Decisions, questions and design flaws go by title here and everywhere
the owner reads. Older dated records still use numbers; the last section
maps every old number to its title.

Sources: the program document (`docs/plans/2026-10-30-architecture-pass.md`,
whose Appendix A holds the definition session's decisions word for
word), the state page (`docs/plans/CURRENT-STATE.md`) and its git
history, the cause analysis, the engine-jobs document, the standalone
pass, the after-game survey, the owner site's Decisions page data, and
the inventory beside this file (`decision-record/inventory.md`).

Where a later decision contradicts part of an earlier one without
naming it, this record keeps the earlier decision as made and says, in
the entry and in "Read as overtaken, not yet confirmed", what the later
decision implies. Nothing inferred is written as if the owner had said
it.

---

## The goal and the frame

**Design for the long term, beyond ALN**

The pass designs the best architecture for the next iteration of the
engine, for long-term use and future development as its use grows
beyond ALN. Blue's fixes and findings are clues to where today's design
is off, never the driver: the pass is not a triage of ALN's issues
renamed as architecture fixes. The owner expects this frame to change
the approach, and how the design and the roadmap are discussed, more
than the fixes themselves. The owner's words for the goal: "design a
long-term optimal architecture for our engine that makes it intuitive
and easy to maintain, continue development on, and extend (proactive)",
in place of "fixing issues seen / fixed on blue to run ALN (reactive)".

Made 2026-10-31.

History:
- 2026-10-31. Made as owner direction, answering no question. The
  glossary's "architecture pass" entry carries it.
- 2026-11-01. The owner's own words for the goal were recorded, and the
  rest of the design half was reordered to fit this frame (see "Design
  top-down, hardest-to-reverse choices first").

**The architecture pass is the work now**

The architecture pass is the current work, design half first. The
paused hardening pieces and the truth sweep wait for its answers. It
covers the whole engine: the backend orchestrator, the GM scanner, the
player scanners (web and ESP32), the scoreboards and the config tool.
Blue keeps running the game until the new engine is ready to swap in on
green, and no date governs the work. The owner's condition with the
yes: the orchestrator must understand the engine being built and the
roadmap being adjusted, starting with how the truth sweep differs from
the pass. The questions the pass must answer are listed under "The nine
questions the pass answers".

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Made as the next work, with six
  questions, the central one being who decides each fact the GM sees.
  The owner asked: "how is the truth sweep different from the
  architecture pass?" The nine evidence files in the program document
  were made to meet that condition.
- 2026-10-30, the definition session, in the rounds that reworded and
  widened the question set. Two of the six questions were reworded and
  three more added; the set is now nine (see "The nine questions the
  pass answers").
- 2026-10-30, the definition session's sign-off. The owner ratified the
  program document, and the pass became the current work, design half
  first ("The owner ratified the program document").

**Blue's fixes are evidence of design causes**

Blue's fixes, and the findings blue left unfixed, are evidence of where
today's design is weak. They are never the driver of the pass. For each
one the cause analysis records the problem area, the design cause, every
other place with that cause, the design choice that removes it, and the
proving test. Fixes that share a cause become one design decision. The
sixteen design flaws the cause analysis found are now test cases: every
design in the design rounds is checked against them.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Made. The owner's meaning of the
  kickoff brief's question on blue's fixes was an evidence method, not
  a process for future fixes. Two worked examples: the claimed-token
  list (three more places that update it) and the frozen music and
  lighting panels (a hand-written table that re-sends state).
- 2026-10-31. Qualified by "Design for the long term, beyond ALN": clues
  to where the design is off, never the driver.
- 2026-11-01. "Design top-down, hardest-to-reverse choices first" made
  the sixteen flaws test cases for the designs.

---

## The words

**Four words for the game's live facts**

Four terms are in the glossary: runtime state (every fact about a
running game that can change during it), authority (the place that
decides a runtime fact), copy (that fact held anywhere else) and
delivery path (its route from the authority to a screen). An outside
program can be an authority: VLC decides what is playing. "Verdicts"
names what one truth checks.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Made. The outside-program clause
  was flagged for the owner.
- 2026-10-30, the definition session, the round after. The owner
  confirmed that an outside program can be an authority.

**Promises, qualities, moments, venue technician**

A promise is what a person can count on at a given moment. The owner's
page is organized around the promises, and "job" is retired. The draft
has ten promises; whether they are the right ten is still open (see
"Still open"). Parts keep promises; design flaws break them. A quality
is something every part must have so a promise holds everywhere; it is
never a promise itself. A moment is when a promise matters: a
production stage, a point in a show, release day. The person who fits a
kit to a venue is the venue technician, not "installer". Promises carry
titles only, so a card reads without memorizing ids. The title "The
game fits the venue it is in tonight" is itself a promise. Shared work
that several promises depend on needs no word of its own: each piece
becomes one part.

Made 2026-11-01.

History:
- 2026-10-31. The front of the cause analysis was rebuilt around the
  engine's ten "jobs", at the owner's request, because the flaw list
  was hard to follow.
- 2026-11-01. Made. The owner found "job" forced once the jobs were
  restated from people's side and the relationship map split them into
  promises, qualities and parts. The glossary carries the words.
- 2026-11-01. Widened by "Titles, not numbers, and a topic record":
  decisions, questions and design flaws also go by title.

**Name each step by what it does**

One set of sequencing names. The architecture pass has a design half
and a build half. Its steps are named by what they do: the
requirements, the panel, the design rounds, the build plan, the hostile
review, the final questions, the owner's sign-off. The roadmap's blocks
go by name only (the unlock block, the hardening block, the truth
sweep, the capture block, the preview block, the depth-and-close
block). Question rounds go by date. Test levels go by name: logic only;
real programs with stand-in hardware; the home test bed; the venue. No
page uses a bare phase, step, block or round number.

Made 2026-11-01.

History:
- 2026-11-01. The owner asked "which phase 1?" and the ambiguity was
  recorded with "Design top-down, hardest-to-reverse choices first".
- 2026-11-01. Made, owner OK, except decision numbers, which the owner
  put under discussion. "Titles, not numbers, and a topic record"
  settled that the same day.

---

## What the engine must do

**The nine questions the pass answers**

The pass answers these nine questions for the whole engine:

- Who decides each fact: who decides each fact the GM sees (the
  authority)?
- Service state travels with its health: does a service's state travel
  with its health?
- How the engine reads its programs: how does the engine read the
  programs it drives?
- Only the live engine touches the show: can anything other than the
  live engine touch the live show (tests today, the preview engine
  later)?
- One question gets one answer: does one question get one answer?
- Each fact at a game boundary: what does each fact and each copy do at
  a boundary (a game starting or ending, a system reset, a restart, a
  pack change while running)?
- Each component gets what its role needs: does each component receive
  what its role needs, and no more?
- How copies update and show their age: how may a copy be updated, and
  can a screen tell how old it is?
- Reconnect snapshot built like live update: is each fact's reconnect
  snapshot built the same way as its live update?

The nine stand. Since the design half was reordered top-down, the
design rounds go by the hardest decisions to reverse, not one rule per
question. The record does not yet say in so many words how the nine
fit that order; the reading here, that they serve as checks on each
design, is to be confirmed with the owner.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Six questions, with "Who decides
  each fact" central. "Only the live engine touches the show" then read
  "can a test touch the live show?" and "Each fact at a game boundary"
  read "who re-checks after a reset?".
- 2026-10-30, the definition session, the round after. "Only the live
  engine touches the show" became "can anything other than the live
  engine touch the live show?" and "Each fact at a game boundary"
  became "what does each fact and each copy do at a boundary?". "Each
  component gets what its role needs" was added, on what each component
  receives; the owner ruled it must start from the settled roles.
- 2026-10-30, the definition session, the round after that. "Each
  component gets what its role needs" was worded (see "The role
  question starts from settled roles").
- 2026-10-30, the definition session, the round that settled the
  method. "How copies update and show their age" and "Reconnect
  snapshot built like live update" were added from the code map. Each
  question was to get its own rule and test, and "Who decides each
  fact", "Each fact at a game boundary", "How copies update and show
  their age" and "Reconnect snapshot built like live update" were to be
  designed together as one rule for live state.
- 2026-11-01. "Design top-down, hardest-to-reverse choices first"
  ordered the design rounds by decision, not by question. Whether
  "designed together" and "one rule per question" still hold is to be
  confirmed.

**The role question starts from settled roles**

The components keep their settled roles. The player scanners, web and
ESP32, have the same functions: they show token content and report
scans, with no scoring and no live game feed. The GM scanner is the
command center. The scoreboards show the public results: team scores
and exposed evidence. The question about roles reads "does each
component receive what its role needs, and no more?", and it starts
from these roles.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that reworded the
  questions. The owner said "sure" to widening two questions but found
  that the new role question ignored the settled roles; it was sent
  back to be reworded from them.
- 2026-10-30, the definition session, the round after. Made with the
  wording above.

**Standalone games: declared, never mixed**

Standalone games are a capability of the engine: a game can be designed
and set up to run with no engine, where a network connection is not
feasible, or where other logistics make it better to use only GM
scanners, player scanners (phone or hardware), or both. In the owner's
words (2026-11-02): "Standalone games are a capability of the "engine"
to enable design and set-up of games that can run in environments where
a network connection is simply not feasible, or other logistics making
it more preferable to use only gm and/or player scanners (phone or
hardware) for a game."

A game declares that it is standalone, and no game mixes networked and
standalone devices. Standalone games join the list every design choice
must serve, beside applying a change while the engine runs, the trial
copy of the engine, capture and players' phones. The hardware scanner
plays standalone games as the phone's scanner does: the owner's words
name "player scanners (phone or hardware)", which answers "The hardware
scanner's standalone mode". Where the fact "this game is standalone" is
held (the venue profile, the pack, the game's record or each device) is
a question for the design rounds. Read from the owner's "gm and/or
player scanners", to be confirmed: a standalone game may have no GM
tablet at all.

Made 2026-10-31; its purpose stated 2026-11-02.

History:
- 2026-10-31, the question round of 2026-10-30 to 2026-11-01. Made: yes
  to whole standalone games, no to mixed games. On the ESP32 the owner
  asked why a standalone mode would be new, given parity; it was
  recorded as covered under the parity rule, pending the owner's word.
- 2026-10-31. A standalone pass checked the sixteen flaws against a
  whole standalone game and raised three questions, now on the
  Decisions page.
- 2026-11-01. The venue promise on the owner site carries these words
  as a clause ("The venue promise names declared standalone").
- 2026-11-02. In the chat after version 9 of the site, the owner said
  what standalone games are for (quoted above). The agent had asked
  whether they are an occasional fallback or a line of shows; the owner
  saw no distinction between the two, and the purpose replaces that
  framing. The statement answers "The hardware scanner's standalone
  mode", which had waited for the owner's explicit word since
  2026-10-31.

**The night's record and the after-game article**

What the players receive after the show, and their contact details, are
the game's business, outside the engine; the engine's record is
designed so the game's own tools can read it. The second half of the
promise "Every tap gets its answer, and the night can be told
afterwards" names the director and the players after the show. The
engine makes the players no promise of their own for what they receive
after the show. The night's record carries the pack the game ran and
the texts the players saw, so the article quotes what they held.
Players' emails stay outside the engine; later the game's own tools
could collect them from the ticketing service. The Director Console
stays a separate program, for now, that reads the engine's record; the
record is designed so the console can later become ALN's own part of
the engine's Review stage. The two clocks (a sale stamped by the
tablet, an adjustment by the engine) join the flaw "Tablets and phones
decide facts the engine owns" as a finding. Whether paper documents
join the pack, with "unlocked" recorded during play, was not answered
and waits for the design rounds.

Made 2026-11-01.

History:
- 2026-11-01. The owner asked to bring the after-game article and
  emailer into the engine map. A read-only survey asked six questions;
  the owner answered five of them, and the first half of the third, the
  same day. Whether paper documents join the pack was not answered. The
  answers were folded into the promise's people, the night's record
  part, the flaw card, the glossary's Review entry and the roadmap's
  capture block.

**One published protocol and an outside test bench**

One published, versioned protocol defines everything that crosses the
engine's edge: what a device may ask, what the engine answers, what it
tells screens, and the files that carry a game or a night (the pack,
the venue profile, the night's record, the media list). Every program's
code is generated from it or checked against it. It consolidates
today's scattered contracts (the backend contracts, the venue-profile
schema, the pack schemas) and it is designed in an early design round,
not merely collected. The tests become a test bench outside the engine.
"Proof" stays a quality every part must meet. Together these two
replace the candidate shape's part called "Joins and proofs" (shared
shapes written once and tests on an engine of their own).

Made 2026-11-01.

History:
- 2026-11-01. Proposed with "Independent architects propose the
  top-level design" and recorded as pending: the owner leaned yes and
  asked first for a careful explanation of the published protocol and
  where it fits in the big picture.
- 2026-11-01. Made after the explanation. The pending note was removed.

**No technical failure stops a game**

A lost connection or a device that goes down mid-game must not stop
the game. At that moment the GMs must know the fallbacks that keep it
running, with as little effect on the players as possible. In the
owner's words: "For more or less all use cases, having to pause a game
because a connection was lost or a device goes down mid-game is the
worst possible scenario. During a game situation, the GMs need to know
their available fallbacks to keep a game running with as minimal impact
on the player experience as possible if at all possible if ever there's
a technical failure mid-game."

Two readings follow, to be confirmed with the owner. First, a GM tablet
that loses the engine keeps taking scans and the game carries on,
rather than refusing scans until the connection returns; the quality
target "A tablet reconnects to the same facts" had left that choice
open. Second, the design must say how a networked game carries on if
the show machine itself fails. That meets "Standalone games: declared,
never mixed": whether a game may carry on with its devices alone, and
how the results come back together, is a question for the owner.

Made 2026-11-02.

History:
- 2026-11-02. The owner's comment, in the chat after version 9 of the
  site, on the agent's question of what a GM tablet does when it loses
  the show machine mid-show.

**The engine is hardware-flexible; the roadmap sets the bounds**

The hardware is fixed only in that ALN runs on the kit the owner has
bought. The mature engine is meant to be flexible about hardware, so
the fundamental architecture must allow that flexibility later. The
current roadmap sets realistic bounds: which flexibility it builds now,
and where it names specific hardware requirements. In the owner's
words: "The hardware is fixed only insofar as I have the hardware I
have on which I am running ALN, but the point of the engine in its
mature form is that it is flexible meaning that we should build the
fundamental architecture to allow flexibility with the hardware down
the line. Meanwhile, we need to set realistic boundaries about what our
current roadmap should incorporate in terms of that flexibility vs.
where it should establish specific hardware requirements." Where the
current roadmap draws that line is open, for the design rounds and the
build plan.

Made 2026-11-02.

History:
- 2026-11-02. The owner's comment, in the chat after version 9 of the
  site, on the agent's question "Which hardware is fixed?".

**Two kinds of game extension**

A game can be extended in two ways, and the design keeps them apart.

- A new game mechanic built from what the engine can already do: a new
  action for the players, or a new way for the game to respond to
  triggers the engine already has. The game's own maker builds it,
  inside the game; in the long term it may be shared with other game
  makers for their games. The owner's example: players change the
  room's lighting by scanning different tokens on a player scanner.
- A response the engine cannot give yet. A developer extends the engine
  so that any game can use it. The owner's example: adding a service
  such as Snapcast for audio in several rooms, so that different areas
  get different soundtracks and the GMs can play a sound cue on every
  speaker or on chosen speakers (areas or rooms of the game space).

Two questions stay open, as the owner named them: how an extension made
for all games relates to the engine's main release, and which piece
each kind of extension changes (packs, the engine's code, added outside
services). The owner's wording is tentative ("should probably",
"probably"), and this record keeps it so. In the owner's words: "Game
mechanics could be different ways to combine existing in-engine
capabilities to create different gameplay verbs for the players to
engage with or different ways the game might actually respond to
existing game triggers within the engine. This should probably be able
to be done by the game's own maker inside that game. (though possibly,
in the long term, with a way to share with other game makers for their
games too) Game mechanics could also be for an existing gameplay action
triggering a response that the game engine is not currently capable of.
This probably requires a developer to extend the code of the engine in
a way that any game can use."

Made 2026-11-02.

History:
- 2026-11-02. The owner's comment, in the chat after version 9 of the
  site, on the agent's question "When a future game needs a new kind of
  mechanic, who adds it?". The owner found that the question mixed two
  framings: what is being extended, and which piece the extension
  changes.

**The engine says what is fixed and what each production sets**

The engine is meant to serve many games in many production settings,
so it stays agnostic about any one production's numbers: the devices
and phones in a kit, the time from power-on to a running show, set-up
time, how long records are kept, and the like. Someone adopting the
engine needs to know which requirements are fixed and which affordances
the engine allows, so they can fit it to their needs and their venue.
ALN is one production: one game, one venue, the hardware the owner
bought. The owner's next game may share them; the next person to use
the engine may not. In the owner's words: "many are stuff that the
engine itself should be relatively agnostic about if it's going to be
open sourced to support many different games in many different
production scenarios. [...] what they need to know is what is a fixes
requirement vs what affordances the engine allows in order for them to
fit its use into their needs and venue realities."

Read from this, to be confirmed: the quality targets' numbers split
into the engine's fixed requirements and stated limits on one side, and
each production's own settings on the other, with ALN's as the first
set.

Made 2026-11-02.

History:
- 2026-11-02. The owner's comment, in the chat after version 9 of the
  site, on the show-size and timing numbers the agent proposed to ask.

---

## How the design is made, and in what order

**One program: design half, then build half**

The pass is one program in two halves. The design half decides the
shared rules for the whole engine with the owner, one question round at
a time, with throwaway prototypes allowed, and ends with the new
roadmap. The build half changes the engine to follow the design, one
area at a time, as the first work in that roadmap, before the capture
block, the preview block and players' phones. It takes the show-ready
gate's second condition. The remaining hardening pieces and the truth
sweep's purpose are rebuilt inside it. Each area gets its detailed
design just before it is built. The build half starts with a thin
first version of the new design running end to end on a new test bench.
The pass ends when every rule's test passes on the rig.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Made as two phases, the third
  option the owner was shown. The owner had asked why the pass changes
  no code and when the engine code changes. Each area was to start with
  its proof test failing on today's engine.
- 2026-11-01. The halves were renamed design half and build half
  ("Name each step by what it does").
- 2026-11-01. "Build the test rig when building starts" and "Design
  top-down, hardest-to-reverse choices first" made the build plan start
  with a thin first version on a new test bench. Starting each area
  with its proof test failing on today's engine returns only if the
  move from today's engine chooses to change it in place. The record
  does not name this as a change to the two-halves decision; the
  reading is to be confirmed.

**Run the pass like the re-charter**

The pass is a roadmap revision, run the way the September re-charter
ran: evidence, a draft with questions, a hostile review, question
rounds, the owner's sign-off. Its new roadmap becomes the roadmap's
next revision; the earlier text survives in git history. The glossary
entry for "architecture pass" is written. The order of the design
half's steps is the top-down order. On the owner's pages the draft's
questions go by title, not number.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. Made, with ratification as the
  last step's name. The glossary entry waited until the pass's
  difference from the truth sweep was settled.
- 2026-10-30, the definition session, two rounds later. The difference
  was settled and the entry written.
- 2026-11-01. The order of the steps became the top-down order, and
  "Titles, not numbers, and a topic record" replaced numbered
  questions with titled ones on the owner's pages. "Name each step by
  what it does" named the last step the owner's sign-off.

**The truth sweep's charter is retired**

The truth sweep's charter is retired. Its purpose, proving with rig
tests and screen captures that every screen tells the truth, moves into
the build work the pass plans and covers every screen, the scoring,
transaction and session screens included. Its census and its five
recorded desync bugs are evidence for the pass. The roadmap and the
glossary carry notes.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that reworded the
  questions. Made. The sweep had been a repair job on the routes by
  which service status reaches the GM's admin panel, taking today's
  design as given; the pass decides the design itself.

**Five documents the design half hands over**

The design half hands over: the rules, one per question, each with a
proof test in plain words (what to do, and what must happen); the cause
analysis, with every blue fix and every finding assigned to a cause and
a rule or set aside with a reason; contract proposals, drafted for the
two contract files before code; decision records, one short note per
hard-to-reverse choice, in a new `docs/adr/` folder; and the new
roadmap, with the build half's areas in order, the remaining hardening
pieces and the sweep's purpose placed inside them, the show-ready gate
restated and the later blocks after the build half. Two parts of this
are read as overtaken, to be confirmed with the owner: "one per
question", by the design rounds going by hard-to-reverse decision; and
the contract proposals, by the one published protocol.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that settled the
  method. Made.
- 2026-11-01. "Design top-down, hardest-to-reverse choices first"
  orders the design by decision, not by question, so "one rule per
  question" may change; "One published protocol and an outside test
  bench" would turn the contract proposals into one protocol. The
  record does not name either as a change to this decision; both
  readings are to be confirmed.

**The design half's method and tools**

The design half's work, in its current order: the cause analysis (done:
readers split by source, merged by cause, checked); the requirements
(the owner's answers on the promises, quality targets written as
testable situations, and the ways the platform must be extended, and by
whom); the independent panel; the design rounds, ordered by the hardest
decisions to reverse; the build plan; the hostile review (two reviewers
with different angles, a checker for each finding, one group of
reviewers at a time); the final questions; the owner's sign-off. The
design rounds use the skills `codebase-design` and
`improve-codebase-architecture`. Each round writes two or three
competing designs side by side, with before-and-after diagrams,
published as pages for the owner, never left as temporary files. A
throwaway prototype is written where the code's behaviour is uncertain
and never merged. Every design is checked against the promises, the
quality targets, the extension cases and the sixteen design flaws, and
every rule says how it serves hot-apply, the preview engine, capture,
players' phones and standalone games. The test rig is built when
building starts, not before design.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that settled the
  method. Made, in the order: cause analysis, with its readers grouped
  by cause; the test rig rebuilt and used to reproduce the unrun
  findings; design rule by rule; the hostile review; grill rounds;
  ratification. The two design skills were confirmed for this pass.
- 2026-10-30, the definition session, the record check's round. The
  order corrected (a proposed build order drafted before the review,
  and one question round with the review's findings and the order) and
  the readers changed: split by source, then merged by cause, then
  checked ("Corrections to the readers and the hardening pieces").
- 2026-10-31. Standalone games joined the list every rule serves
  ("Standalone games: declared, never mixed").
- 2026-11-01. The test rig moved to the start of building ("Build the
  test rig when building starts").
- 2026-11-01. The order became top-down and the design rounds go by
  decision ("Design top-down, hardest-to-reverse choices first").

**When the design half is finished**

The design half ends at the owner's sign-off, and only once all of
these hold: every finding and every blue fix is assigned to a rule, or
set aside with a reason; every rule says how it serves the planned
capabilities and standalone games; the review's blocking findings are
resolved; every question has a rule and a proof test; and the rig
reproduces each finding marked for live proof. Two of these are read as
overtaken, to be confirmed with the owner: "every question has a
rule", by the top-down order of the design rounds; and the rig
condition, by "Build the test rig when building starts", which builds
the rig when building starts.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that settled the
  method. Made with five conditions.
- 2026-10-31. "Standalone games: declared, never mixed" put standalone
  games on the list every rule must serve.
- 2026-11-01. "Build the test rig when building starts" moves the rig
  after design. The record does not name this as a change to the end
  conditions; the reading is to be confirmed.
- 2026-11-01. "Design top-down, hardest-to-reverse choices first" may
  change "every question has a rule"; to be confirmed.

**Corrections to the readers and the hardening pieces**

The merged hardening pieces (the kinds of equipment a pack can ask for
and a venue profile can name, the code that marks equipment not
installed tonight, and the smallest test set-up) stay in the engine. The build half changes them
only where a rule requires, and their standing review findings fed the
cause analysis like every other finding. The cause analysis's readers
were split by source (blue's records, the backend, the GM scanner, the
other clients and tests), then a merge grouped every finding by cause,
then a skeptical check ran. That work is done.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the record check's round. Made
  as three corrections from a record check: the design half's order,
  the hardening pieces, the readers. The owner said yes to all three.
- 2026-11-01. The correction to the order was superseded by "Build the
  test rig when building starts" and "Design top-down,
  hardest-to-reverse choices first". The hardening pieces and the
  readers stand.

**Build the test rig when building starts**

The test rig no longer comes before design. It is built at the start of
building, as part of the new test bench where a thin first version of
the new design runs end to end, not to reproduce today's problems first.
Exception: if the decision on how to move from today's engine chooses to
change it in place, pinning down today's behaviour first comes back.

Made 2026-11-01.

History:
- 2026-10-30. The rig had been the design half's second step, meant to
  reproduce four unrun findings before design (the deleted token still
  refused, the music panel behind live music, the ended game returning
  after a restart, the reset that leaves music out). The question "how
  much the rig proves before design" was open.
- 2026-11-01. Made, answering "withdraw that question?". The question
  is withdrawn.

**Design top-down, hardest-to-reverse choices first**

The rest of the design half goes top-down. First finish the
requirements: the owner's answers, plus quality targets written as
testable situations and the ways the platform must be extended, and by
whom. Then design rounds ordered by the hardest decisions to reverse:
how the engine holds the game's state; the published protocol and file
formats; where authority lives across devices, offline and standalone
included; how games and venues extend the engine; how one engine runs
as many separate copies; how today's engine moves to the new design.
Each round has two or three designs side by side, checked against the
promises, the quality targets, the extension cases and today's sixteen
design flaws as test cases. Then a build plan that starts with a thin
first version. The owner site is to be reframed fully to the long-term
frame, and the sequencing words are made unambiguous.

Made 2026-11-01.

History:
- 2026-11-01. Made, for the frame of "Design for the long term, beyond
  ALN". It amends "The design half's method and tools", "Decide in
  question rounds, never at sign-off" and "Corrections to the readers
  and the hardening pieces". The owner asked "which phase 1?", so no
  page uses a bare phase, step, round or block number again.
- 2026-11-01. The owner's words for the goal were recorded the same
  day: "design a long-term optimal architecture for our engine that
  makes it intuitive and easy to maintain, continue development on, and
  extend (proactive)", in place of "fixing issues seen / fixed on blue
  to run ALN (reactive)".

**Independent architects propose the top-level design**

An independent panel of architects, who have not seen the
orchestrator's reasoning, proposes and stress-tests the top-level
design decisions before the first design round. The owner said the
context the panel gets is critical: its brief comes to the owner before
the panel runs. What the panel sees, and when, is "What the architects'
panel sees, and when".

Made 2026-11-01.

History:
- 2026-11-01. Made.

**What the architects' panel sees, and when**

The panel first gets the goal, the requirements (the promises with the
owner's answers, the confirmed quality targets and extension cases, the
standing constraints) and the setting (one owner and AI agents
developing it; the hardware and a local network that can drop; one
two-hour show for a few dozen devices). Only after its first proposals
does it get today's engine as facts and the sixteen design flaws as test
situations. Withheld: the orchestrator's recommendations, the candidate
shape of the engine's parts (it enters in a second round as one more
proposal) and the earlier lists of design choices. Three architects
with different lenses propose blind, then critique each other and the
candidate shape. A synthesis lists the decisions, options, costs, trial
runs and the owner's questions. The panel runs after the owner confirms
the requirements, and its brief goes to the owner first.

Made 2026-11-01.

History:
- 2026-11-01. Made, owner OK.

---

## The owner's site

**The owner's site: five linked pages**

The owner's page is five linked pages built from one set of data: the
engine (the front page), decisions, promises, parts and design flaws.
The history of earlier wordings and changes lives in a change log. The
owner relied on nothing in the single page it replaced, so nothing from
it had to stay. The site is to be reframed to the long-term frame, and
its decisions, questions and design flaws are to go by title in place
of numbers. Version 9, published 2026-11-02, did both: six linked pages
(the engine, decisions, requirements, design, today's engine and the
change log), titles in place of numbers, and the sequencing names.

Made 2026-11-01.

History:
- 2026-11-01. Before this, the owner said of the single page: "the 17
  part candidate shape is never diagrammed. this is still not showing
  me how everything comes together." The page gained a drawing of the
  whole engine, and the owner then asked for the page's structure to be
  thought through before going on.
- 2026-11-01. Made: five linked pages and a change log. The site went
  live the same day.
- 2026-11-01. "Design top-down, hardest-to-reverse choices first" asks
  for the site to be reframed to the long-term frame; "Titles, not
  numbers, and a topic record" asks for titles on its pages. Both wait
  for the next version of the site.
- 2026-11-02. Version 9 shipped both, with Requirements, Design and
  Today's engine in place of Promises, Parts and Design flaws.

**The Decisions page holds only your decisions**

The Decisions page asks the owner only what the owner alone can decide,
each question explained by what it means in practice. Choices that are
the agent's to make are listed as the agent's calls, each with its
reason, so the owner can overrule any: how the requirements are worded
and grouped, how the panel runs, technical defaults, and readings that
follow from the owner's earlier decisions. The requirements are offered
for review, not as decisions. The questions come from the top-down
frame: the product facts and priorities that the hardest-to-reverse
choices depend on.

Made 2026-11-02.

History:
- 2026-11-02. The owner asked whether all eighteen questions on version
  9's Decisions page were really theirs to make, and whether they were
  the questions the top-down frame needs. The agent's answer: four were,
  plus part of a fifth, and most came from the bottom-up period. The
  owner said to rework the page, after commenting on the seven open
  questions the agent proposed instead.

---

## How the work runs

**Green's follow-ups ship when the definition session ends**

Green's three follow-ups (the boot check that logged a false
"WirePlumber rule missing" warning on a correct green, the two lines
missing from the environment template, and the pip instruction the new
operating system refuses) ship as one small task as soon as the
definition session ends, alongside the pass. Done: merged 2026-10-30 at
`089dd527`, after a task review, a whole-branch review and one fix wave.

Made 2026-10-30.

History:
- 2026-10-30, the definition session. The owner leaned yes ("ok, I
  think?").
- 2026-10-30, the definition session, the round after. Made.
- 2026-10-30. Merged.

**Decide in question rounds, never at sign-off**

Every decision is made in a question round with the evidence in view,
and written into its document at once. Documents record decisions; they
are never where a decision is first made. Anything new found while
writing comes back to the owner as a question first. The owner's
sign-off is a skim with no new decisions. The rule stands for every
unit of work, not only the pass. The flow of the design half's rounds
is the top-down order.

Made 2026-10-30.

History:
- 2026-10-30, the definition session, the round that settled how
  decisions are made. Made, with an approved flow: the owner confirms
  the cause list; facts only from the rig; one page per rule with the
  owner's pick; the review's findings that would change a decision come
  back as questions; the owner decides the build order; at
  ratification the state page names the build half's first area.
- 2026-10-30, the definition session, the record check's round. The
  flow's order corrected.
- 2026-11-01. The flow became the top-down order ("Design top-down,
  hardest-to-reverse choices first"). The rule itself is unchanged and
  is written in the process guide.

**The owner ratified the program document**

The owner ratified the program document on 2026-10-30. The definition
session closed, and the architecture pass became the current work,
design half first.

Made 2026-10-30.

History:
- 2026-10-30, the definition session's sign-off. Made. The definition
  session's decisions moved into the program document's appendix word
  for word.

**No rule for documents: fix as we go**

The pass has no rule for the project's written documents (guides,
READMEs, contracts, code comments) that disagree with the code. They
are fixed as we go, always: when work finds that a document disagrees
with the code, the same piece of work fixes the document. Dated records
stay as written.

Made 2026-10-31.

History:
- 2026-10-30. Asked, in the question round of 2026-10-30 to 2026-11-01,
  whether the pass needs a rule for such documents.
- 2026-10-31. Made. The process guide carries it.

**Titles, not numbers, and a topic record**

Decisions, questions and design flaws go by short plain titles in
conversation and on the owner's pages. Ids stay only inside records,
for cross-reference. The decision record is reorganized by topic: what
stands now, each written as current truth with a dated history beneath;
superseded decisions move into that history. This record is that
reorganization, and it replaces the numbered list on the state page.
The owner: "I've been using them because you've been using them, but
they're not necessarily clear or the best approach."

Made 2026-11-01.

History:
- 2026-11-01. "Name each step by what it does" got the owner's OK
  except for decision numbers, which the owner put under discussion.
- 2026-11-01. Made.

---

## Superseded and withdrawn

Dated by the day each was replaced or withdrawn. Each says what it
said, when it was made, and what replaced it.

- **2026-10-30. Two of the original questions' wordings.** "Can a test
  touch the live show?" and "who re-checks after a reset?", from the
  definition session's opening, were replaced the same day by "can
  anything other than the live engine touch the live show?" and "what
  does each fact and each copy do at a boundary?" (see "The nine
  questions the pass answers").
- **2026-10-30. The design half's first order.** Cause analysis, test
  rig, design rule by rule, hostile review, grill rounds, ratification,
  from the definition session's round that settled the method. Replaced
  the same day, in the record check's round, by an order with the build
  order drafted before the review and one question round ("Corrections
  to the readers and the hardening pieces", its correction to the
  order).
- **2026-11-01. The approved flow of the rounds.** The owner confirms
  the cause list; facts only; one page per rule with the owner's pick;
  review findings as questions; the owner decides the build order;
  ratification. Made 2026-10-30. Replaced by the top-down order
  ("Design top-down, hardest-to-reverse choices first"). The rule that
  every decision is made in a round stands.
- **2026-11-01. "Job" and "installer".** The engine's requirements were
  ten "jobs" (from 2026-10-31), and the person who fits a kit to a
  venue was the "installer" (in the roadmap as "venue installer" since
  2026-09-04). Replaced by "promise" and "venue technician"
  ("Promises, qualities, moments, venue technician").
- **2026-11-01. The design half's corrected order.** Cause analysis,
  test rig, design, a proposed build order, its review, one question
  round, ratification. Made 2026-10-30 in the record check's round.
  Replaced by "Build the test rig when building starts" and "Design
  top-down, hardest-to-reverse choices first".
- **2026-11-01. "How much the rig proves before design" (withdrawn).**
  It asked how many of the findings marked for live proof the test rig
  should reproduce before design starts. Asked 2026-10-30. Withdrawn by
  "Build the test rig when building starts". The owner site's
  Decisions page still lists it as open and needs updating.
- **2026-11-01. The part "Joins and proofs".** In the candidate shape,
  one part held the shapes two parts share, written once, and the tests
  on an engine of their own. Replaced by "One published protocol and an
  outside test bench".
- **2026-11-01. "Phase 1" and "phase 2", and bare step, block and
  round numbers.** In use since 2026-10-30. Replaced by the design half
  and the build half, steps named by what they do, blocks by name,
  rounds by date and test levels by name ("Name each step by what it
  does").
- **2026-11-01. Decision and question numbers on the owner's pages, and
  the numbered decision list on the state page.** Replaced by titles
  and by this record ("Titles, not numbers, and a topic record").

Read as overtaken, not yet confirmed. The record does not say these in
so many words; a later decision contradicts part of an earlier one
without naming it. Each is flagged in its entry and should be put to
the owner:

- Each build area starting with its proof test failing on today's
  engine ("One program: design half, then build half"), overtaken by
  "Build the test rig when building starts" unless the move from
  today's engine changes it in place.
- One rule per question, and the four live-state questions designed
  together ("The nine questions the pass answers", "Five documents the
  design half hands over", "When the design half is finished"),
  overtaken by the design rounds going by hard-to-reverse decision.
- Contract proposals as the third handover document ("Five documents
  the design half hands over"), overtaken by the one published
  protocol.
- The rig reproducing each finding marked for live proof as an end
  condition ("When the design half is finished"), overtaken by the rig
  being built when building starts.

---

## Still open

The open questions live on the owner site's Decisions page ("What the
Engine Promises", https://claude.ai/artifact/RzL2FzCZ4eESSNMYwkkKPL),
each with its evidence on the same screen. By title:

About the promises:
- Are these the right ten promises? (This holds the earlier question
  "Is the list of design flaws right?", folded in when the promises
  replaced the flaw list as the front of the work.)
- Two clauses added to the pack promise (applied; the owner's word
  asked).
- The roles promise covers who may act (applied; the owner's word
  asked).
- The venue promise names declared standalone (applied; the owner's
  word asked). It holds "Is the missing standalone declaration a flaw?".
- Split the tap promise in two?
- Keep the venue promise whole?
- Proof and release in one promise? It holds "Flaws none of the pass's
  questions covers" (joins kept by hand on two sides, the deployed
  kit's unchecked pieces, tests that pass without proving the real
  path).
- Which promise carries equipment state on screens?

About standalone games:
- One GM tablet per standalone game?
- Exposed evidence and video with no engine.

About the game's record:
- Record every refused GM scan attempt? The owner asked for the
  orchestrator's view; it is yes, record every attempt and its answer
  and show it nowhere until a feature needs it.

Raised on 2026-11-02, and being written into the reworked Decisions
page ("The Decisions page holds only your decisions"), which will also
move several questions above into the agent's calls:
- Where the qualities pull against each other: the owner asked to see
  the specific conflicts and what each means in practice before
  answering.
- Whether everything updates together on release day: the owner leans
  yes ("Generally speaking, yes") and asked what it means in practice,
  now and once the new engine runs ALN.
- How a networked game carries on if the show machine fails mid-game,
  against "Standalone games: declared, never mixed" (from "No technical
  failure stops a game").
- Which shapes of standalone game the engine supports (GM scanners,
  player scanners or both; how many GM tablets).
- Where the current roadmap draws the line between hardware flexibility
  built now and specific hardware requirements ("The engine is
  hardware-flexible; the roadmap sets the bounds").
- How an extension made for all games relates to the engine's main
  release, and which piece each kind of extension changes ("Two kinds
  of game extension").
- Which numbers are the engine's fixed requirements and limits, and
  which are ALN's own settings ("The engine says what is fixed and what
  each production sets").

Kept for the design rounds, not questions now: the Decisions page's
list of twelve design choices, from where "this game is standalone" is
declared (the venue profile, the pack, the game's record or each
device) to whether paper documents join the pack, with "unlocked"
recorded during play. Between them: how facts reach screens, the life
of a game, the game rules as shared code, the equipment's interface,
the standalone tablet, the scoreboard, the config tool, when a changed
pack may be adopted, where the start-or-adopt setting lives, and the
order of the work.

One item on the page is no longer open: "How much the rig proves before
design" was withdrawn (see "Superseded and withdrawn").

---

## For older records: number to title

Dated records still use the numbers. This table maps every old number
to its title and the section where it now lives. "Decisions" numbers are
the state page's and the program document's appendix; "Q" numbers are
the program document's nine questions; letters are the owner site's
questions; "AG" numbers are the after-game survey's six questions.

### Decisions 1 to 36

| Old number | Title | Where in this record |
|---|---|---|
| 1 | The architecture pass is the work now | The goal and the frame |
| 2 | Run the pass like the re-charter | How the design is made, and in what order |
| 3 | Four words for the game's live facts | The words |
| 4 | Green's follow-ups ship when the definition session ends | How the work runs |
| 5 | Two questions reworded, one role question added | In the history of "The nine questions the pass answers" (What the engine must do) |
| 6 | The truth sweep's charter is retired | How the design is made, and in what order |
| 7 | One program: design half, then build half | How the design is made, and in what order |
| 8 | Blue's fixes are evidence of design causes | The goal and the frame |
| 9 | The role question starts from settled roles | What the engine must do |
| 10 | Five documents the design half hands over | How the design is made, and in what order |
| 11 | Two questions on copies and reconnects | In the history of "The nine questions the pass answers" (What the engine must do) |
| 12 | The design half's method and tools | How the design is made, and in what order |
| 13 | When the design half is finished | How the design is made, and in what order |
| 14 | Decide in question rounds, never at sign-off | How the work runs |
| 15 | Corrections to the readers and the hardening pieces | How the design is made, and in what order (its correction to the order: Superseded and withdrawn) |
| 16 | The owner ratified the program document | How the work runs |
| 17 | Is the list of design flaws right? | Still open, folded into "Are these the right ten promises?" |
| 18 | Flaws none of the pass's questions covers | Still open, folded into "Proof and release in one promise?" |
| 19 | Record every refused GM scan attempt? | Still open |
| 20 | No rule for documents: fix as we go | How the work runs |
| 21 | How much the rig proves before design | Superseded and withdrawn (withdrawn) |
| 22 | Standalone games: declared, never mixed | What the engine must do (its ESP32 reading: Still open) |
| 23 | Is the missing standalone declaration a flaw? | Still open, folded into "The venue promise names declared standalone" |
| 24 | One GM tablet per standalone game? | Still open |
| 25 | Exposed evidence and video with no engine | Still open |
| 26 | Design for the long term, beyond ALN | The goal and the frame |
| 27 | Promises, qualities, moments, venue technician | The words |
| 28 | The night's record and the after-game article | What the engine must do |
| 29 | The owner's site: five linked pages | The owner's site |
| 30 | Build the test rig when building starts | How the design is made, and in what order |
| 31 | Design top-down, hardest-to-reverse choices first | How the design is made, and in what order |
| 32 | Independent architects propose the top-level design | How the design is made, and in what order |
| 33 | One published protocol and an outside test bench | What the engine must do |
| 34 | Name each step by what it does | The words |
| 35 | What the architects' panel sees, and when | How the design is made, and in what order |
| 36 | Titles, not numbers, and a topic record | How the work runs |

### The program document's nine questions

| Old number | Title | Where in this record |
|---|---|---|
| Q1 | Who decides each fact | The nine questions the pass answers (What the engine must do) |
| Q2 | Service state travels with its health | The nine questions the pass answers |
| Q3 | How the engine reads its programs | The nine questions the pass answers |
| Q4 | Only the live engine touches the show | The nine questions the pass answers |
| Q5 | One question gets one answer | The nine questions the pass answers |
| Q6 | Each fact at a game boundary | The nine questions the pass answers |
| Q7 | Each component gets what its role needs | The nine questions the pass answers; The role question starts from settled roles |
| Q8 | How copies update and show their age | The nine questions the pass answers |
| Q9 | Reconnect snapshot built like live update | The nine questions the pass answers |

### The owner site's questions

| Old key | Title | Where in this record |
|---|---|---|
| Promises | Are these the right ten promises? | Still open |
| A | Two clauses added to the pack promise | Still open |
| B | The roles promise covers who may act | Still open |
| C | The venue promise names declared standalone | Still open |
| D | Split the tap promise in two? | Still open |
| E | Keep the venue promise whole? | Still open |
| F | Proof and release in one promise? | Still open |
| G | Which promise carries equipment state on screens? | Still open |

### The after-game survey's six questions

Asked on 2026-11-01. The owner answered five of them, and the first
half of the third, the same day; the second half of the third (paper
documents) waits for the design rounds. The answers are the entry "The
night's record and the after-game article" (What the engine must do).

| Old number | What it asked | Where in this record |
|---|---|---|
| AG1 | Does the night's-record promise name the director and the players? | The night's record and the after-game article (yes) |
| AG2 | Do the players after the show get a promise of their own? | The night's record and the after-game article (no: the game's business) |
| AG3 | Does the night's record carry the pack and the texts; do paper documents join the pack? | The night's record and the after-game article (first half yes; paper documents: Still open, kept for the design rounds) |
| AG4 | Does the engine ever hold players' emails and consent? | The night's record and the after-game article (no) |
| AG5 | What does "integrate" the Director Console mean? | The night's record and the after-game article (separate, reads the record; shaped for the Review stage later) |
| AG6 | Do the two clocks join an existing flaw or become a new one? | The night's record and the after-game article (they join "Tablets and phones decide facts the engine owns") |
