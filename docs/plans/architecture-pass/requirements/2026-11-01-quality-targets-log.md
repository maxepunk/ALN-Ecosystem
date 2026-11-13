# Quality targets: the sources (log for `2026-11-01-quality-targets.json`)

Written 2026-11-01; revised the same day after the check
(`check-quality.md`, 25 rows, all applied; the record is at the end).
One entry per target. Each names the files and lines or sections the
target's situation, number and status rest on. Nothing in a target comes
from anywhere else.

The file now holds 42 targets under 12 qualities: QT28 moved out to the
build plan (check row 18). Ids are not renumbered, so cross-references
in the check stay true; the sequence runs QT27, QT29.

Files, with the short names used below. Paths are under
`/home/user/ALN-Ecosystem/`.

- PROMISES = `docs/plans/architecture-pass/report/2026-10-31-engine-jobs.json`
  (the ten promises; each entry's `goal`, `needs`, `flaws`, `standalone`,
  `tests` and `functional` fields; line numbers are of that file)
- ROADMAP = `docs/plans/ROADMAP.md`
- STATE = `docs/plans/CURRENT-STATE.md` (section 0 holds decisions 20 to
  36; the line numbers below were re-read on 2026-11-01 after the check:
  decision 33 at lines 129 to 140, decision 34 at 141 to 149, decision 35
  at 150 to 164, decision 36 at 165 to 173, the open questions at 174 to
  182, section 1 at 287 to 297, section 3 at 317 to 326)
- GLOSSARY = `CONTEXT.md`
- DIRECTION = `docs/plans/architecture-pass/2026-10-30-map-direction.md`
- AFTER-GAME = `docs/plans/architecture-pass/2026-11-01-after-game-report.md`
- PLAN = `docs/plans/2026-10-30-architecture-pass.md` (the pass's nine
  questions, lines 96 to 106)
- PROCESS = `docs/agents/process.md`
- GUIDE = `CLAUDE.md` (the project's guide for developers); the two
  scanner guides inside the repository, `arduino-cyd-player-scanner/CLAUDE.md`
  and `aln-memory-scanner/CLAUDE.md`
- JARGON = `docs/plans/architecture-pass/report/site/checks/jargon-table.md`
  (the plain wordings: rows 10, 11, 15, 16, 20, 34, 35, 39, 40, 45, 46,
  47, 48, 49, 54, 62, 64, 65 were applied throughout)
- SITE-DECISIONS = `docs/plans/architecture-pass/report/site/decisions.json`
  (the owner's open questions, each with a status)
- SHAPE = `docs/plans/architecture-pass/report/2026-11-01-engine-shape.json`
  (the candidate shape; cited only to show what a target must NOT take
  from it, since the panel does not see it: STATE decision 35)

Two notes on the numbers. Where a target carries a time (half a second,
five seconds, ten seconds, one polling interval, within a second,
within minutes), the number comes from the promise's own test list in
PROMISES, which the owner has not ruled on one by one. Since the check
(row 3), each such time is also listed in the target's `numberToSet` as
"confirm: ...", so the owner confirms or changes it. Where no source
gives a number, the target says so in `numberToSet`.

A note on decision numbers. The targets name decisions and questions by
short plain titles (STATE decision 36). The numbers appear only here,
for cross-reference: the owner's decision on standalone games is 22; the
after-game decisions are 28; the thin first version is 30; the list of
design rounds is 31; the published protocol and the test bench are 33;
the sequencing names and test levels are 34; the panel's context plan
is 35; titles not numbers is 36. The roadmap's ratification question on
the boot-to-running posture and the preflight's honesty rule is its Q13;
the one on rotating secrets before the previewable state is its Q12.

## Staying up through a live show

**QT1, the engine restarts mid-show.** PROMISES: "Each lifecycle button
does exactly what its name says", need, line 387 ("a restart during a
show loses nothing"), and tests, lines 376 to 379; "One game, the same on
every screen", goal, line 89 (every screen shows the record also after
reconnecting); "Every tap gets its answer", tests, line 235 (a batch sent
again after a restart appears once). ROADMAP lines 262 to 265 and 288 to
291 (the boot pain; power on straight into a running system). The number
to set: no source gives a restart time. "Whether the game is in setup,
running, paused or ended" replaces "phase" (check row 5; STATE decision
31, lines 113 to 117: no page uses "phase" with a second meaning).

**QT2, an outside program dies.** PROMISES: "The room does what the
designer cued and the GM asked", goal, line 261 (one supervisor restarts
a crashed program a few times, then a red row with a Restart button),
needs, lines 264 to 266, tests, lines 306 and 307 (controls back within
about ten seconds; lighting panel shows unavailable then its tiles, no
reload). ROADMAP lines 303 to 306 (the supervisor: bounded restarts,
restart loops, escalate with a verb). GLOSSARY lines 334 to 343 (held
item: nothing is silently dropped), 363 to 372 (self-heal; supervisor).
The numbers to set: the restart count and window are called "bounded"
and "a few times" in every source, never set; the ten seconds come from
the promise's test (line 306) and are the owner's to confirm (check row
3; "about" dropped, since "about ten seconds" is not testable).

**QT3, a tablet loses its wifi for a minute.** PROMISES: "Anyone reading
a screen can act on it", tests, line 616 (cut a tablet's connection for
a minute: panels show old numbers, header disconnected); "Each person
sees their part", tests, line 480 (reconnects under its own station name
within five seconds); "One game, the same on every screen", tests, lines
159 and 160 (a delete frees the token on another tablet; a reconnecting
tablet after Reset All Scores accepts an old token), and its flaw C6,
line 108 (connect-time and live facts from different code). PLAN line
105 (the pass's question: how may a copy be updated, and can a screen
tell how old it is). Status "proposed", not settled (check row 2): the
tests are not owner rulings and a question in PLAN asks rather than
settles; SITE-DECISIONS, group "About the promises", question
"promises", status `open`. What a disconnected tablet does with a scan
(refuse, or keep and answer later) had no source and is now marked open
for the design round on where authority lives across devices, offline
included (check row 6; STATE decision 31, lines 101 to 118; STATE line
224: "the shape is silent on a short offline claim list on a
disconnected tablet"). The five seconds (line 480) are the owner's to
confirm (check row 3).

**QT4, nothing silently lost or doubled.** PROMISES: "Every tap gets its
answer", goal, line 188 (one reply in one form: which request, the
outcome, final or not, stored or not), tests, lines 234, 235 and 237
(a batch with no game; the same batch after a restart; two Skip
presses), flaw C7, line 200. GUIDE `arduino-cyd-player-scanner/CLAUDE.md`
lines 418 to 426 (a final refusal is not queued; a queued or
video-rejected scan says video unavailable); `aln-memory-scanner/CLAUDE.md`
lines 239 to 247 (final refusals never queued; a batch is snapshotted
and resent until resolved; replayed scans never trigger videos).

## Every screen telling the truth

**QT5, age and certainty on every fact.** PROMISES: "Anyone reading a
screen can act on it", goal, line 577 (every fact and reply carries how
old and how sure), need, line 628, tests, lines 616 and 617 (kill the
engine: each scanner shows offline within one poll interval; the TV's
clock unconfirmed, not counting), flaws C10 and C3, lines 590 and 600;
"One game, the same on every screen", goal, line 89. PLAN line 105. The
number to set: "one poll interval" is today's interval, not a target.
Status "proposed", not settled (check row 2): the promise's goal and
tests and the pass's question are not owner rulings (SITE-DECISIONS,
question "promises", status `open`).

**QT6, red means act now, grey means absent on purpose.** PROMISES:
"Anyone reading a screen can act on it", tests, lines 614 and 615 (a
mistyped profile path shows a red row, not a green summary; a mixed cue
with lighting dormant names the skipped command), needs, lines 580 and
581, flaw C10 for the equipment job, line 290 (six installed services
read not installed, a calm green count). GLOSSARY lines 344 to 358
(dormant vs fault, ratified 2026-09-04; alarm integrity), 418 to 430 (a
dormant service's process is not started), 431 to 443 (a profile file
that fails its check refuses the start, ruling R12 of the hardening
block). DIRECTION line 156 (the ruled fix is a failed-check row and a
start refusal).

**QT7, no screen shows a verdict the engine has not given.** PROMISES:
"Every tap gets its answer", flaw C9, line 210 (Transaction Complete for
a scan the engine refuses; in a standalone game a scan into a paused game
shows complete), tests, line 162 under "One game, the same on every
screen" (the result screen never says complete and shows the engine's
reason), and that promise's flaw C9, line 113. PLAN line 98 (who decides
each fact). STATE lines 36 to 45 (decision 22, named in the target as
"the owner's decision on standalone games": the standalone tablet is the
decider under the same rules). PROMISES line 228 (the standalone tablet
runs Answering, so a refusal shows).

**QT8, the preflight tells its own limits.** ROADMAP lines 313 to 321
(the honesty rule, the roadmap's ratification question Q13, named in the
target as "the owner's ruling that the preflight states its own limits":
the preflight states its limits, labels each check paper or live, the
physical tap-through stays on the human checklist). GLOSSARY lines 184
to 200 (one truth: every surface quotes the same verdicts), 431 to 452
(preflight; paper vs live: a green at home is never mistaken for venue
readiness), 523 to 531 (a simulation is an ordinary profile). PROMISES:
"Anyone reading a screen can act on it", need, line 628 (the venue
technician's go is a go, a desk check never passes for a room check, the
editor and the show use the same words), needs, line 582 (live verdict
badges: the same words in the editor as at the show).

## The designer's iteration speed

**QT9, change a value and play within minutes.** ROADMAP lines 128 to
135 (section 2.4: edit, apply, playtest, repeat; the editor and applying
a change while the engine runs are one deliverable). PROMISES: "The
designer changes a value and plays it within minutes", need, line 438,
goal, line 401 (the engine applies at a moment the lifecycle allows,
never mid-game, or refuses and says why), tests, line 428 (within a
bounded time, or applies at the next window, or refuses). DIRECTION line
183 (the pages ratification: applying a change refuses while a game is
active or paused) and line 39 (the loop today needs end, apply, create,
start). The number to set: the promise's title says "within minutes";
no source fixes them.

**QT10, a bad pack dies at the desk.** GLOSSARY lines 206 to 215 (the
gate: two refusal kinds, self-contradictory and not driveable by this
engine yet, and messages must say which), 598 to 605 (draft and publish:
editing never touches the live pack; publish runs the engine's own
check; an unedited publish is a no-op), 184 to 197 (the designer's loop:
mistakes die at the desk). PROMISES: "The designer changes a value",
need, line 438 (the engine's own check refuses a bad pack at the desk).
GUIDE line 146 (the activation gate refuses packs whose tokens name
undeclared groups).

**QT11, the trial copy never touches the show.** PROMISES: "The designer
changes a value", goal, line 401 (a preview engine is a second instance,
touches nothing live, equipment reads as not installed on a laptop),
needs, line 406, flaw C8, line 414, tests, line 429. ROADMAP lines 388 to
395 (the preview block). DIRECTION lines 194 to 197 (the preview ships
with a preview profile; the isolation seam). PLAN line 101 (can anything
other than the live engine touch the live show).

**QT12, the designer never touches code or firmware.** ROADMAP lines 48
to 54 (the designer never touches code or configuration files), 137 to
149 (section 2.5: everything a designer iterates on is pack data, never
firmware; never a mechanic whose loop needs re-flashing a fleet).
PROMISES: "The designer's game is the game the whole kit plays", goal,
line 23, needs, line 31; PROMISES purpose, lines 3 and 4. The new game
"uses only what the engine can already do" (check row 7): GLOSSARY lines
26 to 30 ("The engine can run any game that fits its implemented
model"); a game that needs more is the case QT21 covers, through the
gate's second refusal kind (GLOSSARY lines 206 to 215).

## Operating it without technical help

**QT13, the venue technician.** ROADMAP lines 55 to 61 (fills in a
profile, connects names to instruments on one page, one-button preflight
with every line traceable), 232 to 236 (adoptable: a stranger stands the
platform up), 480 to 486 (Stage B: every gap in the docs is a doc
defect). GLOSSARY lines 409 to 413 (venue technician), 507 to 514
(Deploy, the hand-off from designer to venue technician to GM).
PROMISES: "The game fits the venue it is in tonight", need, line 562,
tests, line 553 (build a clean machine from the deployment guide; "the
install line works"). "No terminal" now covers only the profile, the
bindings and the preflight, which ROADMAP section 1 puts in the tool's
pages; that building the machine needs no terminal has no source and is
marked proposed (check row 8). The number to set: no source gives a
set-up time.

**QT14, power on to a running show.** ROADMAP lines 260 to 265 (the boot
pain: today a technician brings the Pi up, opens a terminal, hand-walks a
check), 288 to 291 (boot-to-running posture, the roadmap's ratification
question Q13, named in the target as "the owner's ruling that the
machine powers on straight into a running show"), 310 to 312 (the
preflight shown in the GM's panel plus the human checklist). PROMISES:
"The room does what the designer cued", need, line 317 (the GM sees at
once that it did not and what to press). "The video and music players,
the kit network's name" replaces "the players, the network name" (check
row 9): GLOSSARY lines 481 to 489 (kit network); JARGON row 49 (the
music player). The number to set: no source gives a boot time.

**QT15, the GM runs the show alone.** GLOSSARY lines 359 to 362 (status
with verbs: Restart, Re-route, Run-without-it, never bare bad news), 344
to 355 (dormant's second door: taken out of service, set by the GM
mid-show). PROMISES: "The room does what the designer cued", goal, line
261, need, line 317; "Anyone reading a screen can act on it", need, line
628 (red means act now). ROADMAP lines 62 to 64 (the GM runs the show
from four sections).

**QT16, the director.** STATE lines 71 to 88 (decision 28, named in the
target as "the after-game decisions": the record carries the pack and
the texts the players saw; the console stays a separate program that
reads the record; the two clocks join the flaw list). AFTER-GAME lines
36 to 47 (today's intake: the GM tablet's report pasted and re-parsed),
79 to 91 (the two clocks: on games 100326 and 100426 the adjustments
printed nine hours away from the sales; the console shifts them back),
112 to 128 (the owner's answers). ROADMAP lines 62 to 65 (the post-game
report builds itself from material captured during play), 358 to 386
(the capture block: roster, notes, photos, accusation; the bundle emitter
stamps the pack and the texts). GLOSSARY lines 532 to 549 (Review;
Director). PROMISES: "Every tap gets its answer", goal, line 188, flaw
C11, line 215 (the downloaded report's two totals disagree). The `why`
now argues from the long-term goal and names the two clocks as a test
case in two recorded games, not "every game" (check row 4; STATE
decision 26, lines 46 to 54, and decision 31, lines 118 to 123).

## Easy to understand and change, for people and for AI agents

**QT17, one place decides each fact; catch-up equals live; one state
after start and reset.** PLAN lines 98, 102, 103 and 106 (the pass's
questions: who decides each fact; does one question get one answer;
what each fact does at a boundary; is the reconnect catch-up built the
same way as the live update). GLOSSARY lines 383 to 406 (runtime state,
authority, copy, delivery path, settled 2026-10-30 as WORDS: lines 383
to 388 say they "decide nothing about how the engine should hold
them"). PROMISES: "One game, the same on every screen", flaws C11 and
C6, lines 118 and 108, tests, line 161 (build the live message and the
connect-time entry from the same state: equal keys and values); "The
room does what the designer cued", flaw C11, line 295 ("is a video
playing" has eight answers); "Each lifecycle button", goal, line 332
(one lifecycle; engine start, Reset System and tests run the same
steps), flaw C5, line 353; "A change is proven", tests, line 681 (after
a reset the music panel within a second; a cue on video start exactly
once). Three changes from the check: the situation now says what must
be true (same fields and values; same state after start and reset, each
proven by a test) and not how ("one piece of code builds", "one and the
same list of steps"), since PROMISES goals at lines 89 and 332 are the
candidate shape's Lifecycle and Delivery design, withheld from the panel
(check row 10; STATE decision 35, lines 150 to 164); "keys" became
"fields"; the status is "proposed", since questions and words settle
nothing (check row 2); the `why` argues from the long-term goal and
names today's eight answers and two lists as test cases (check row 4).

**QT18, one source for every shared format: the published protocol.**
STATE lines 129 to 140 (decision 33, made 2026-11-01, named in the
target as "the owner's decision on the published protocol and the test
bench": one versioned definition of everything that crosses the
engine's edge, what a device may ask, what the engine answers, what it
tells screens, and the files that carry a game or a night, the pack, the
venue profile, the night's record, the media list; every program's code
generated from it or checked against it). The situation quotes that
decision (check row 11; the earlier wording omitted the venue profile
and the media list and did not call the definition versioned, and the
status called the decision pending). STATE lines 101 to 118 (decision
31: the protocol is a design round). GUIDE lines 236 to 251
(contract-first: update the written contracts before changing any
message; the scanner payload tests catch drift). PROMISES: "A change is
proven", goal, line 642 (shared shapes are written once), flaw C14, line
660 (names and shapes kept by hand on each side, nothing checks they
agree); "The designer's game", flaw C14, line 42 (the hardware scanner
cannot read the pack's own token file). JARGON row 39 (the plain wording
for "contract"); the target uses the owner's word, "the published
protocol", with a plain gloss on first use.

**QT19, documented for people and agents.** STATE lines 34 to 35
(decision 20, named in the target as "the owner's decision that
documents are fixed as we go"; it settles that, and not which pages
exist), 119 to 123 (the owner's words: intuitive, easy to maintain,
continue development on, and extend). PROCESS lines 213 to 232 (the
writing standard; a newcomer must be able to read them; a document that
disagrees with the code is fixed by the same work), line 17 (writing for
agents applies to every document an agent consumes). ROADMAP lines 626
to 648 (section 9: the documentation system, per block), 593 to 596
(human-facing docs; today's docs are written for agents). GLOSSARY lines
1 to 19 (the glossary's purpose), 696 to 712 (promise, part, quality;
"part" is one piece of the candidate design, so the target says "piece
of the engine"). The page per piece and the newcomer measure are
proposed: no source names either (check row 12).

**QT20, no ALN words in the engine.** ROADMAP lines 151 to 154 (section
2.6: the engine holds no opinion). GLOSSARY lines 26 to 30 (the engine
holds no opinions about game design), 88 to 93 (the engine reads a
mode's flags, never its name), 166 to 173 (each pack declares its own
word for a score-holder), 746 to 766 (section 8: ALN vocabulary is pack
content, not engine language). PROMISES: "The designer's game", roles,
line 21 (the engine itself, which must not know ALN's words), meaning,
line 16 (the toy pack proves the engine is generic).

## Easy to extend

**QT21, a new game.** ROADMAP lines 542 to 557 (section 7.2: the second
game's modules as generic, pack-parameterized modules; hidden state;
graph scoring), 527 to 540 (section 7.1: multi-tap actions for both
platforms), 151 to 154. GLOSSARY lines 216 to 227 (capability: ids are
append-only, adding one is a minor version; a pack lists what it needs;
the gate refuses and names a missing one; additive keys need no version
bump), 248 to 253 (toy pack; dual-pack gate). PROMISES: "The designer's
game", needs, line 27 (scoring models, hidden facts, multi-tap actions
and the word for a score-holder come from the pack); PROMISES purpose,
lines 10 and 11.

**QT22, a new kind of device or screen.** ROADMAP lines 137 to 149
(section 2.5: parity in engine capabilities; the kit declares which
device classes its players use), 613 (deferral row 8.8, named in the
target as "the deferral registry's row on pack-defined new display
surfaces": the constellation renderer belongs to the second game's
modules; making the surface SET extensible stays headroom), 542 to 547
(the constellation display). GLOSSARY lines 475 to 480 (remote display,
ruled 2026-09-12: a count in the profile, the preflight counts
display-class connections against it), 606 to 612 (observe token: the
read-only display pass). DIRECTION line 90 (the hardening ruling: every
connection presents a verified pass; the handshake's own device-type
word retired) and line 286 (rulings R5 and R19). PROMISES: "Each person
sees their part", goal, line 454 (every connection shows a verified
pass: kind, name, role), flaw C13, line 468 (a client's own word or a
route's default decides), needs, line 460. Three changes from the check
(row 13): the preflight count is kept to what the sources rule, remote
displays, and phones once their number is set (QT34); the new display
is written as the sources have it, the second game's constellation
added "without changing the existing displays or any other game", with
no "seam" or "renderer" (JARGON rows A75 and F158 to F160 retire both
words); the `why` argues from the long-term goal and names today's
connection word as a test case (check row 4).

**QT23, a new outside program, driven, feeding or reading.** PROMISES:
"The room does what the designer cued", goal, line 261 (one interface
per outside program, "as the candidate shape has it"; a setting says
whether the engine starts or adopts each program), needs, lines 264 and
265 (the engine tells its own player from a stranger's). The situation
no longer says "one interface per kind" and "one new adapter behind
that interface": that is the candidate design, withheld from the panel
(check row 14; STATE decision 35; JARGON row 20); it now says what must
be true, that nothing outside the code that talks to the program and
the venue profile changes. DIRECTION lines 170 to 172 (child identity;
host modes self and adopt), line 286 (ruling R18). GLOSSARY lines 368
to 372 (how each service restarts is host configuration, not pack or
profile content). PLAN line 100 (how does the engine read the programs
it drives). ROADMAP lines 559 to 571 (section 7.3: Notion becomes one
replaceable adapter). PROMISES: "The designer's game", needs, line 30 (a
replacement for Notion feeds the same pack through the same gate). STATE
lines 71 to 88 (decision 28, answers 3 and 5, named in the target as
"the after-game decisions": the console stays separate and reads the
record; the record is shaped so it can later run inside Review).
AFTER-GAME lines 124 to 126.

**QT24, a new kit, machine or operating system.** ROADMAP lines 102 to
110 (section 2.2: no one-kit, one-pack, one-production assumptions; pack
and profile selected by path or id; no kit-unique identifiers in engine
code), 584 to 587 (fleet growth deliberately unplanned, kept cheap).
PROMISES: "The game fits the venue it is in tonight", goal, line 503
(kit names live only in the profile), tests, lines 551 and 553 (a new
operating-system release renames the speaker rule and the TV's browser:
no warning, the TV page opens; a clean machine from the guide), flaw C15,
line 540, need, line 562; PROMISES purpose, line 8.

## Testable without the live show

**QT25, a whole game at the desk, and rehearsal.** GLOSSARY lines 453 to
463 (the environment ladder: four levels, same engine, same pack, same
checks, gaps recorded with reasons, ratified 2026-09-04 with every level
as early as possible), 464 to 470 (witness lights generated from the
pack's needs), 515 to 531 (Rehearse: every player action in simulated
form, the show reacting for real; "one concept with many depths";
Simulation: an ordinary profile pointing at stand-ins; "one can be
generated from a pack's own needs"). STATE lines 141 to 149 (decision
34: test levels by name, "logic only; real programs with stand-in
hardware; the home test bed; the venue"; the target uses those names in
place of "rung" and "the bare automatic test run", check row 15).
PROMISES: "A change is proven", goal, line 642 (tests run in levels,
from logic alone through the real engine with stand-ins to a home test
bed and the venue). ROADMAP lines 476 to 494 (Stage A proves logic and
contracts, Stage B hardware). "One can be generated" and "one kind of
rehearsal at different depths" follow the glossary's own words (check
row 15).

**QT26, two games, honest tests, checked stand-ins.** GLOSSARY lines 248
to 253 (toy pack kept forever; the full suite passes twice). PROMISES:
"A change is proven", flaw C16, line 670 (stand-ins never checked
against the real code; skipped tests and silent passes count as
passing), tests, line 680 (a test compares every fake with the real
class "and fails on a member the real class lacks or a different return
shape"; the target says this in plain words, a stand-in that offers
something the real program does not or answers in a different format,
and does not add the case of a member the real class gains, which the
source does not name: check row 16), need, line 692 (when every test
passes, the show still runs for ALN and the toy game); purpose, line 11.
DIRECTION line 252 (tests skip loudly with recorded reasons, never
silently). The status no longer argues from today's faults (check row
4).

**QT27, tests never touch a live show.** PLAN line 101 (the pass's
question: can anything other than the live engine touch the live show).
PROMISES: "A change is proven", flaw C8, line 655 (a test run killed the
live show's video player on blue; fixed temporary names; machine-wide
kills), needs, lines 645 and 646 (line 645: "in the candidate shape a
test engine runs as an engine of its own", so the target no longer says
every test run is a running copy of the engine, which is the candidate's
answer and also false for logic-only tests: check row 17; STATE
decisions 34 and 35), tests, line 679 (start a live engine, run the
tests: every program keeps running, the tracking files unchanged).
DIRECTION lines 32 and 38 (a second engine on the live machine is unsafe
today; the fixed paths are one-kit assumptions), 248 to 256. ROADMAP
lines 102 to 110. JARGON rows 10 and 47 (the plain wordings). The status
no longer cites the blue incident as a reason (check row 4); it stays in
the flaw list as a test case.

**QT28, a thin first version first: moved out.** STATE lines 94 to 100
(decision 30: the rig is built at the start of building, as part of the
new test bench where a thin first version of the new design runs end to
end) and 101 to 118 (decision 31: a build plan that starts with that thin
first version). Removed from the quality targets on 2026-11-01 (check
row 18): it is an order of building, which the build plan carries, and a
quality is something every part must have (GLOSSARY lines 709 to 712).
Neither decision names the version's contents; the earlier target's
list (one player scan on a stand-in device, one GM claim, one cue firing
a witness light, one screen updating, on both games) was a proposal and
goes to the build plan as one, not as a settled target. The test bench
itself is covered by QT25 to QT27.

## Privacy and access

**QT29, players have no accounts.** ROADMAP lines 81 to 95 (section 2.1,
its first two rules, named in the target as "the rules that players have
no accounts and no login and that the only built-in identity is the
device or session id"; person-level identity is game policy), 66 to 69,
151 to 154. GLOSSARY lines 569 to 579 (actor vs device; auth tiers), 613
to 615 (pseudonymous default). PROMISES: "Each person sees their part",
goal, line 454; purpose, line 5.

**QT30, data stays on the kit.** ROADMAP lines 96 to 100 (section 2.1,
its third and fourth rules, named in the target as "the rules that game
data stays on the kit and that retention is the owner's decision per
game"), 365 to 369 (the photo store designed under the privacy
defaults). STATE lines 80 to 83 (decision 28, answer 4, named in the
target as "the after-game decision that players' emails stay outside
the engine"). AFTER-GAME line 103 (the question asked about "emails and
consent") and lines 120 to 121 (the owner answered for emails only), so
the target says "email addresses stay outside the engine" and no longer
adds consent (check row 19). AFTER-GAME lines 72 to 77 (publishing the
article and sending the emails are the owner moving data off the kit).
PROMISES: "Every tap gets its answer", needs, line 193 (data kept on the
kit, retention set per game). The target's phrase "the engine keeps
nothing past it" is the testable reading of the fourth rule; the default
periods are the number to set.

**QT31, every connection presents a pass; the floor; the owner's
secrets.** GLOSSARY lines 580 to 597 (the floor, owner-fixed 2026-07-09:
session lifecycle, show control and score intervention are always
operator-only; every action re-checked at execution, deny by default,
every transport; the target's sentence "checked against what its pass
allows, however it arrives, and refused unless allowed" is that entry in
plain words). "One door, checked once" was the candidate shape's design
(SHAPE, quality "Only the GM moves the game": "the one door every
request passes"), withheld from the panel, and a metaphor: removed, with
"every door must be a door" and "the owner's keys" in the `why` (check
row 20; STATE decision 35; PROCESS section 4, no metaphors). ROADMAP
lines 81 to 84, 222 to 230 (the previewable state: the committed token
and admin password rotate before the first outside person, the roadmap's
ratification question Q12, named in the target as "the owner's ruling
that the committed secrets rotate before the first outside person
touches the system"), 588 to 596 (the release block: untrack and sweep
git history). DIRECTION line 90 and line 286 (ruling R5: credentials on
every connection). PROMISES: "Each person sees their part", tests, lines
477 and 478 (no credential: refused, nothing arrives), need, line 488 (a
stranger sees nothing; the engine knows which tablet did it), needs,
line 462 (secrets rotate before any outsider). The automatic secret
check is proposed: no source names it.

**QT32, each screen gets only its part.** ROADMAP lines 527 to 540
(section 7.1: server-side per-surface projection and actor-centric
permission resolution, adopted 2026-07-17). PLAN line 104 (the pass's
question: does each component receive what its role needs and no more;
the scoreboard filters on its own side today). DIRECTION line 232 (ALN's
scoreboard receives full transaction data and filters client-side, fatal
for a hidden-information game). PROMISES: "Each person sees their part",
tests, line 479 (connect as a TV: only exposed evidence and team totals),
needs, lines 458 and 459; "One game, the same on every screen", goal,
line 89 (hidden facts never reach the wrong screen), need, line 172.

## Running well on the show machine and the venue network at the size of a show

**QT33, a full game at tonight's size, with headroom.** STATE lines 317
to 326 (section 3: two GM tablets, three hardware scanners, the TV on
HDMI from the Pi's browser, a Pi 4 showing the scoreboard, HDMI and a
Bluetooth speaker, a fixed address on the kit wifi). STATE lines 150 to
164 (decision 35, named in the target as "the owner's plan for the
panel's context": the setting is "one two-hour show for a few dozen
devices"; the target carries that scale and the number to set is the kit
size within it, check row 21). GLOSSARY lines 490 to 494 (the show
machine is a Pi), 431 to 443 (the preflight checks the host itself:
disk, temperature, processes, ports; it refuses a start only for an
unmet required need or a broken profile, so "refuses a start that would
break the load limits" is now proposed, not sourced: check row 21), 481
to 489 (the kit works with no internet). PROMISES: "The room does what
the designer cued", tests, line 305 (a video reports started within half
a second; the owner's to confirm, check row 3). GUIDE line 9 (a two-hour
immersive game). The scan answer time, the delivery time and the machine
limits are numbers to set: no source gives them.

**QT34, how many phones one kit carries.** ROADMAP line 537 (section 7.1:
"kit capacity work precedes phone load", and nothing more; so "the
profile declares it and the preflight counts phones against it" is
proposed, modeled on remote displays: check row 22). DIRECTION line 44
and line 238 (no capacity number exists anywhere). PROMISES: "Each
person sees their part", needs, line 458 (a measured capacity for how
many phones one kit carries; no number exists). GLOSSARY lines 475 to
480 (the model for counting connections against the profile: remote
displays; a ruling for displays, not for phones).

**QT35, a small pack, a checked media bundle, a bounded first sync.**
ROADMAP lines 112 to 126 (section 2.3: media never in the pack; the pack
names files with hashes; a bundle checked against the pack's list and
moved between machines; the hardware scanner's sync is the model).
GLOSSARY lines 31 to 42 (a pack is measured in kilobytes; the media
bundle). PROMISES: "The designer's game", goal, line 23 (media files
checked by a fingerprint of their content), flaw C15, line 47 (nothing
checks that every named file is there), needs, line 28. GUIDE lines 438
to 445 (first boot of a hardware scanner: 30 to 40 MB, 5 to 15 minutes,
per-file progress on the screen). The acceptable first-sync time is the
number to set; today's figure is given for scale.

**QT36, no internet needed.** GLOSSARY lines 481 to 489 (kit network: the
Pi answers the name; the router needs three settings; the kit works with
no internet connection). ROADMAP lines 752 to 754 (appendix B, item 11:
the wall scoreboard's typefaces self-hosted after the CDN failed at the
offline venue), 455 to 465 (green takes the reserved address, devices
never notice). PROMISES: "The game fits the venue it is in tonight",
needs, line 507 (a name server the engine reads but does not drive).

## Standalone and offline

**QT37, a game declared standalone.** STATE lines 36 to 45 (decision 22,
part a, named in the target as "the owner's decision on standalone
games": a whole game with no engine, the GM scanner and the player
scanners each alone, as a choice a game can declare), 174 to 182 (open:
one GM tablet per standalone game, question 24; where the standalone
fact is held). GLOSSARY lines 94 to 99 (deployment mode, standalone),
244 to 247 (parity surface: the standalone implementation must match the
engine's rules). PROMISES: "The game fits the venue", flaw N1, line 516
(each device reads a missing engine as an outage), tests, lines 550 and
552 (pause and scan: refused; a player device says "standalone", not
"offline"), need, line 562; "Anyone reading a screen", standalone, line
608 (a Verdict stand-in marks every engine duty dormant: grey); "Each
lifecycle button", standalone, line 371 (the tablet opens a game it
cannot name, pause or replace); "Every tap gets its answer", standalone,
line 228 (starting over deletes the finished game); "One game",
standalone, line 151. "Whether the game is in setup, running, paused or
ended" replaces "the game's phase" (check row 5); the `why` argues from
the long-term goal and names today's all-night outage as a test case
(check row 4).

**QT38, no mixed game.** STATE lines 36 to 45 (decision 22, part b, named
in the target as "the owner's decision on standalone games": no game
mixes networked and standalone devices). PROMISES: "The game fits the
venue", flaw N1, line 516 (nothing can refuse a mixed game).

**QT39, the standalone record, and the hardware scanner's parity.**
STATE lines 36 to 45 (decision 22: the ESP32's missing standalone mode is
a parity gap, recorded on the owner's reasoning, the owner's explicit
word asked), 174 to 182 (open: one GM tablet per standalone game,
question 24; exposure and video tokens with no engine, question 25).
SITE-DECISIONS, group "About standalone games", question 24, status
`open`: it decides "whether a standalone tablet's record of the night
can hold player scans", so the target no longer says what the players
found reaches the record; that is now listed as open (check row 23).
ROADMAP lines 137 to 149 (section 2.5). PROMISES: "The designer's game",
standalone, line 55 (one pack per game, its version on the record);
"Every tap gets its answer", standalone, line 228 (nothing records what
players found), flaw N1, line 225; "The game fits the venue",
standalone, line 544 (the hardware scanner trails the phone in seven of
24 abilities). "The token's content" replaces "the memory", ALN's word
(GLOSSARY lines 746 to 766; QT20 bars it from the engine): check row 23.

**QT40, the offline queue in a networked game.** GUIDE
`arduino-cyd-player-scanner/CLAUDE.md` lines 410 to 426 (a network
failure queues the scan; line 419: a no-session refusal of a live scan
is FINAL and not queued; a queued video token says video unavailable;
queued scans never trigger playback), 428 to 436 (the background task
uploads in batches; batch ids stable across retries);
`aln-memory-scanner/CLAUDE.md` lines 238 to 247 (only network-level
failures are queued; a batch is snapshotted and resent verbatim; replayed
scans never trigger videos). PROMISES: "Every tap gets its answer",
tests, lines 234 (a batch sent while no game exists: the device keeps
the scans or the engine stores them, never "processed" with nothing
kept) and 235, flaw C7, line 200 (a device deletes scans the engine
never kept and replays scans that can never succeed). The target now
separates the two cases so it agrees with QT4: a LIVE scan refused for
no game is final; scans ALREADY KEPT and sent when no game exists follow
the batch rule (check row 24). The number to set: today's queue limits
(100 on the phone, a card file on the hardware scanner) are
implementation facts, not a target.

## Safe release and rollback

**QT41, one matching set.** PROMISES: "A change is proven", flaw C15,
line 665 (several separately versioned checkouts, hand-copied media and
hand-run steps that nothing compares; a rollback quietly runs a
mixture), tests, line 682 (roll back: every checkout moves, a status
check lists any that did not), need, line 692 (the machine carries one
matching set), goal, line 642 (Release checks what each machine carries
at start). "The designer's game", goal, line 23 (a mismatch shows when a
device connects), tests, line 63. ROADMAP lines 455 to 470 (section 6),
580 to 583 (section 7.4: steady-state releases). JARGON row 62 (the plain
wording for "one described set"). The `why` argues from the long-term
goal and names today's mixture as a test case (check row 4).

**QT42, the owner alone, between events, replug to roll back.** ROADMAP
lines 160 to 166 (frozen production until the show-ready decision), 455
to 470 (the cutover is a hardware swap; green takes the reserved address;
rollback is swapping back), 580 to 583 (engine updates only between
events; pack updates any time). GLOSSARY lines 654 to 663 (frozen
production; cutover). PROMISES: "A change is proven", need, line 692 (the
owner decides when a new version goes to the venue and can swap back by
replugging a machine); purpose, line 9. STATE lines 287 to 297 (section
1: the game runs on blue until the new engine is ready).

## More than one copy, kit or pack without rework

**QT43, many copies of one engine.** ROADMAP lines 102 to 110 (section
2.2), 575 to 579 (section 7.4: a kit holds a library of installed packs;
the operator picks one per event), 584 to 587 (a second kit). STATE
lines 101 to 118 (decision 31, named in the target as "the owner's list
of design rounds": "how one engine runs as many separate copies" is a
design round). PROMISES: "A change is proven", needs, line 646 (the same
per-engine naming layer for test runs, previews and a second kit, built
once), parts and goal, lines 642 and 686; "The designer changes a
value", flaw C8, line 414; "The game fits the venue", flaw C8, line 526
(the engine and its helpers assume one engine per machine). DIRECTION
lines 32, 194 to 196 and 256 (a test run and a preview engine need the
same namespace seam). JARGON rows 10 and 11. The number of copies one
machine must carry is a number to set: the sources name two (the show's
and a trial or test copy) without fixing a limit.

## The check of 2026-11-01: 25 rows, 25 applied, 0 rejected

Each row of `check-quality.md` was read against the source it names
before it was applied. Where the row's source held, the change went in;
no row's source failed, so none is rejected. The log entries above carry
the detail; this list is the index.

| Row | Where | Verified against | Applied as |
|---|---|---|---|
| 1 | `status` of QT7, QT8, QT14, QT16, QT18, QT19, QT22, QT23, QT28, QT29, QT30, QT31, QT37, QT38, QT39, QT43 | STATE decision 36, lines 165 to 173 (titles not numbers; ids only inside records) | Every decision and ratification question named by a short plain title; the numbers kept here (the note on decision numbers above). QT28 is removed under row 18. |
| 2 | `status` of QT3, QT5, QT17 | SITE-DECISIONS question "promises", status `open`; GLOSSARY lines 383 to 388; PLAN lines 96 to 106 are questions | All three now "proposed", each saying why: tests not ruled one by one; a question asks, it does not settle; the glossary's words decide nothing about how the engine holds them. |
| 3 | QT2, QT3, QT33 times | PROMISES lines 306, 480, 305 are the promises' tests | "confirm: ten seconds", "confirm: five seconds", "confirm: half a second (from the promise's test)" added to `numberToSet`; "about" dropped from QT2. |
| 4 | `why` of QT16, QT17, QT22, QT37, QT41; `status` of QT26, QT27 | STATE decision 26, lines 46 to 54; decision 31, lines 118 to 123; AFTER-GAME lines 79 to 91 (two games named, the console shifts the times back) | Each reason rewritten from the long-term goal; today's fault stays only as "a test case for this target, not its reason". QT16 names two recorded games, not every game. QT26 and QT27 statuses cite sources without today's faults. |
| 5 | QT1, QT37 "phase" | STATE decision 31, lines 113 to 117; decision 34 | "whether the game is in setup, running, paused or ended". |
| 6 | QT3 scan during the minute | STATE decision 31 (the design round on authority across devices, offline included); STATE line 224 (the shape is silent on it); no source in the log | The GM always sees what became of the scan; which of the two a disconnected tablet does is marked open for that design round. |
| 7 | QT12 any new game | GLOSSARY lines 26 to 30 ("fits its implemented model"); the gate, lines 206 to 215 | "a new game of their own that uses only what the engine can already do"; a game that needs more is refused with the capability named, the case QT21 covers. |
| 8 | QT13 "no terminal for any of this" | PROMISES line 553 ("the install line works"); ROADMAP lines 55 to 61 name only the profile, the bindings and the preflight | No terminal for the profile, the bindings and the preflight; no terminal for building the machine marked proposed in the status. |
| 9 | QT14 "the players" | GLOSSARY lines 481 to 489; JARGON row 49 | "the video and music players, the kit network's name". |
| 10 | QT17 how, not what | STATE decision 35, lines 150 to 164; PROMISES lines 89 and 332 are the candidate shape's goals | Same fields and values in catch-up and live message, proven by a test; same state after start, Reset System and a test's reset, proven by a test; "keys" became "fields". |
| 11 | QT18 situation and status | STATE decision 33, lines 129 to 140, made 2026-11-01 | The decision's own list (what a device may ask, what the engine answers, what it tells screens; the pack, the venue profile, the night's record, the media list), "one versioned definition", "generated from it or checked against it"; status settled by that decision. |
| 12 | QT19 "part" and per-part page | STATE decision 20, lines 34 to 35; GLOSSARY lines 705 to 708 ("Part" is a piece of the candidate design); decision 35 | "for each piece of the engine a short page"; the page per piece marked proposed beside the newcomer measure; the status says what decision 20 settles. |
| 13 | QT22 seam, renderer, preflight count | ROADMAP lines 542 to 547 and 613 (constellation only; the surface set is headroom); GLOSSARY lines 475 to 480; JARGON rows A75, F158 to F160 | The new display written as the sources have it, with no "seam" or "renderer"; the count kept to remote displays, and phones once their number is set. |
| 14 | QT23 interface and adapter | PROMISES line 261 ("as the candidate shape has it"); STATE decision 35; JARGON row 20 | "Supporting the new program changes nothing outside the code that talks to that program and the venue profile"; why: "the engine should change in one place only". |
| 15 | QT25 ladder words | STATE decision 34, lines 141 to 149; GLOSSARY lines 515 to 531 | The four test levels by name; "one can be generated from the pack's needs"; "one kind of rehearsal at different depths"; the status names the levels too. |
| 16 | QT26 class and member | PROMISES line 680 (lacks, or a different return shape; nothing on a gained member); PROCESS section 4 | "if a stand-in offers something the real program does not, or answers in a different format, the comparison fails and names the difference". |
| 17 | QT27 every run its own engine | PROMISES line 645 ("in the candidate shape a test engine runs as an engine of its own"); STATE decisions 34 and 35 | "Every test run keeps its own files, network ports and settings, and cannot stop a program it did not start." |
| 18 | QT28 whole target | STATE decision 30, lines 94 to 100; decision 31 (the build plan starts with the thin first version); GLOSSARY lines 709 to 712 (a quality is something every part must have) | Removed from the targets; the build plan carries it. The former contents are kept above as a proposal for that plan. The file has 42 targets; "Testable without the live show" has three. |
| 19 | QT30 emails and consent | AFTER-GAME line 103 (the question) and lines 120 to 121 (the answer names emails only); STATE lines 80 to 83 | "Players' email addresses stay outside the engine." |
| 20 | QT31 one door | GLOSSARY lines 580 to 597 (deny by default, re-checked at execution, every transport); SHAPE quality "Only the GM moves the game" ("the one door every request passes" is the candidate's); STATE decision 35; PROCESS section 4 | "Every action is checked against what its pass allows, however it arrives, and is refused unless allowed"; why: "every request must be checked, and the first outsider must not hold the owner's passwords". |
| 21 | QT33 preflight and scale | GLOSSARY lines 431 to 443 (host checks; refusal only for an unmet required need or a broken profile); STATE decision 35, lines 150 to 164 ("one two-hour show for a few dozen devices") | The preflight checks disk, temperature, processes and ports and shows each as go or no-go; refusing a start over a load limit is proposed; the scale of a few dozen devices is in the situation and the number to set. |
| 22 | QT34 profile and count | ROADMAP line 537 ("kit capacity work precedes phone load", nothing more); GLOSSARY lines 475 to 480 rule for displays only | Measured before the first phone is admitted stays settled in direction; "the profile declares it and the preflight counts phones against it, as it does for remote displays" marked proposed. |
| 23 | QT39 player scans and "memory" | SITE-DECISIONS question 24, status `open` (whether a standalone tablet's record can hold player scans); STATE lines 174 to 182; GLOSSARY lines 746 to 766 | The sentence on what the players found reaching the record removed; listed as open beside exposure and video tokens; "it shows the token's content". |
| 24 | QT40 against QT4 | `arduino-cyd-player-scanner/CLAUDE.md` line 419 (a no-session refusal of a live scan is final, not queued); PROMISES line 234 (the batch case) | A live scan refused for no game is shown refused and never kept; scans already kept and sent when no game exists follow the batch rule (kept by the device or stored by the engine, never "processed" with nothing kept). |
| 25 | The log's STATE pointers | STATE as it stands: decision 33 at 129 to 140 (made), open questions at 174 to 182, section 3 at 317 to 326, section 1 at 287 to 297 | Re-pointed in the header note and in QT18, QT33, QT37, QT39, QT42; decisions 33 to 36 cited where the targets rest on them (QT3, QT17, QT18, QT22, QT23, QT25, QT27, QT31, QT33, and the note on decision numbers). |

## Done-when check

- Every quality the task lists has at least one testable target: ten
  listed qualities, nine with four targets and "Testable without the
  live show" with three (QT28 moved to the build plan), plus two the
  sources demand (safe release and rollback, from "A change is proven
  before it reaches anyone, and the owner alone sends it to the show"
  and roadmap sections 3, 6 and 7.4; more than one copy, kit or pack,
  from roadmap section 2.2 and the owner's list of design rounds).
- Every promise is served: counted from the JSON after the check, each
  of the ten titles appears in at least four targets' `promises` lists.
- Every target names a source above or carries "proposed" in its status
  (the whole of QT3, QT5 and QT17; the machine build without a terminal
  in QT13; the page per piece and the newcomer measure in QT19; the
  automatic secret check in QT31; the sizes, limits and load refusal in
  QT33; the profile count in QT34).
- No target carries a promise number, a capability number, a decision
  or question number, a step, phase, block or round number, a finding
  id, the word "phase" for a game's state, or an em dash; checked by
  search over the JSON after the check was applied.
- Every time quoted from a promise's test (ten seconds, five seconds,
  half a second) is listed in `numberToSet` as the owner's to confirm.
