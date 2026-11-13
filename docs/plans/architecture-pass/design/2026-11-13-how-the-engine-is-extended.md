# How the engine is extended (design topic, opened 2026-11-13)

Status: with the owner. Three decisions asked on 2026-11-13. The topic
is settled when the owner has made them.

This is the fourth design topic in the order the owner confirmed. It is
the proposal's change 6 (a known place in the code for a new kind of
rule, equipment or screen), with change 4 (one pattern for video,
music, sound and lights, and their programs restarted when they crash)
and change 7 (the backend assembled in one place; a copy started for a
test or a rehearsal leaves the installed backend as it was).

Put a decision in the words a GM or a game's maker would use
(`../rework/2026-11-10-owner-step-back.md`, last section).

## What the owner has already ruled here

Never ask these again.

- **Two kinds of game extension** (2026-11-02, `../DECISIONS.md`). A
  game's maker builds a new mechanic from what the engine can already
  do, inside the game. A developer extends the engine for a response it
  cannot give yet, so that any game can use it. The owner's examples:
  players change the room's lighting by scanning tokens (the first
  kind); audio in several rooms (the second). The owner left two
  questions open by name, and they are decisions 1 and 2 below: "What a
  game's maker may build inside the pack" and "How an extension for all
  games reaches a production".
- **Extension is designed from the kinds of addition, not from one
  game** (2026-11-12). The 28 cases in
  `../requirements/2026-11-01-extension-cases.json` are each marked as
  settled by the owner, with the source. (Case EX12's "whoever declares
  it" is out of date since `docs/adr/0008`.)
- **A game is a pack: data, never code.** Code written for one game
  heads toward zero (`../rework/2026-11-10-what-the-engine-is.md`,
  point 2; `docs/plans/ROADMAP.md` section 1).
- **The floor** (owner-fixed, 2026-07-09, `CONTEXT.md` section 6):
  starting and ending a session, running the show, and changing a score
  always stay with staff. The code applies it to a pack's cues: a cue
  may run show commands only, never session, score or transaction
  commands (`backend/src/gameRules/cueValidation.js:18-27`, checked).
- **Nothing a designer tunes may need devices re-flashed** (design
  principle P6, 2026-06-11).
- **What keeps the backend's programs running** (hardening plan R6,
  R13, R18, R20; 2026-09-12): the backend starts and supervises them,
  through one path; a program that keeps crashing is reported "down"
  with what to do. Restart, out of service and back in service are GM
  commands (the plan's P12). Held items expire at session end (P13).
- **After a restart, a clock cue that came due is marked as fired and
  not run** (decision E1, 2026-06-10). Cues suspend at session end
  (E4). The config tool is used before a session only (E7).
- **No test or rehearsal runs during a live session** (2026-11-12). A
  rehearsal uses an ordinary installation profile that points at
  stand-ins (`CONTEXT.md` section 5b; case EX14).
- The GMs' logins belong to the installation and stay through restarts
  (`docs/adr/0003`).

## What happens today

- A pack's cue can react to: the clock and its phases, an accepted GM
  scan, a completed group, video events, a session being created, a
  player's scan, a sound ending, another cue ending, music events
  (`backend/src/services/cueEngineWiring.js:49-143`, checked). So the
  owner's lighting example can be written in a pack today. A cue's
  conditions compare fields of the event with six operators.
- A cue can run sound, lighting, video and music commands and nothing
  else (`backend/src/gameRules/cueValidation.js:91-108`, checked).
- A backend restart during a session: the trace is in
  `../rework/2026-11-12-owner-comments-on-proposal.md`. Music stays
  stopped, the TV goes back to the idle loop, a cue part-way through
  stops, held items are lost, every GM is logged out.
- One program crashing: it is restarted, and what it was playing is not
  put back. The music code has no step that resumes after the player is
  started again, and a video that cannot play is marked failed
  (`backend/src/services/videoQueueService.js:126-136`, checked;
  `musicService.js` searched for a resume step, none found).
- Adding a capability today means changing code in many places with no
  pattern (the proposal's change 6, "Today").

## The decisions asked of the owner (2026-11-13)

As put, in plain words.

**1. What a game's maker can build in the pack, with no developer.**
Recommended, one yes for all of it:
- every value, text, colour, token and timing;
- a way to turn in a token, built from the choices the engine offers
  (does it score, does it use the token up, where does it show);
- rules of the form "when this happens, do that", where "this" is
  anything the session's record notes, with simple checks on facts the
  engine names, and "that" is anything the installed gear can do;
- such a rule never changes points, used tokens or the session by
  itself: those change only through the game's scoring rules or a GM
  (the floor of 9 July, kept);
- a pack never holds calculations or code: a developer adds a new fact
  to check, a new thing to do or a new way of scoring as one file,
  once, for every game.

The one real choice inside it: whether a maker's "when this, do that"
rule may change the game (give points, for one). Yes would let a maker
build a bonus with no developer, and a GM could see an account's money
move with nobody having acted. No keeps today's rule. Recommended: no.

**2. How a new capability reaches a production.** Two ways: it is part
of the engine and arrives with an engine update; or a production can
also install an add-on beside its engine without waiting. Recommended:
the first. An addition is one file in a known place, so a production in
a hurry runs its own build with that file added. No add-on loading: the
game's rules also run inside the GM scanner's page and a hardware
scanner's abilities are in its firmware, so an add-on would have to
reach three kinds of program, and every device would have to say which
add-ons it has.

**3. What comes back by itself after a restart.** Recommended: after
the backend restarts in the middle of a session, these come back by
themselves: the session, the clock, the GMs' logins, the music where it
stopped, what the TV was showing, the lights and the volumes. These do
not replay by themselves: a video that was cut off, a cue that was
part-way through, and a cue that came due while the backend was down.
They are listed on the GM scanner and the GM runs or drops each. The
same holds when only the video player or the music player crashes and
is restarted.

Put with them, no decision asked: a copy of the backend started for a
test or a rehearsal uses stand-ins, and only one copy at a time holds
the real TV, speakers and lights.

## Where the old site's questions went

- "What a game's maker may build inside the pack" (D): decision 1. Its
  four steps were rules for the room as today; rules for the room that
  read more of the game; rules that also change the game; scripts in
  the pack. The recommendation stops after the second.
- "How an extension for all games reaches a production" (E): decision 2.
- "Where the trial copy runs while a show runs" (F): answered by the
  owner on 2026-11-12 (no test or rehearsal during a live session).
- "A player who sends a scan without the token" (G): `docs/adr/0005`,
  the known limit, stated to the owner on 2026-11-13.

## For the agent's own engineering

- Three places, each a list of named things that the backend builds at
  start-up from one folder: rules, equipment, screens. The engine's
  list of capabilities is worked out from what is in the lists, so the
  start-up check of a pack and the code cannot disagree.
- The rules folder is loaded by the backend and built into the GM
  scanner (`docs/adr/0007`). The equipment and screens folders are the
  backend's.
- "When this, do that" has one home in show control, in the backend
  only. Its triggers are the kinds of line in the session's record. Its
  conditions read named facts. Its responses are the equipment's
  commands. It never writes game lines.
- Each place is checked against at least two of the 28 cases and
  against the test "what an addition must not need to touch".
- To put the music back where it stopped, the equipment part keeps what
  it was doing (playlist, track, position) with the installation's
  data. That is not a line in the session's record: the record takes
  one line for each event a person would recognise, never continuous
  readings (`docs/adr/0002`).
- Still to settle, the agent's own: how the config tool applies a
  change. The proposal page says it should send its changes to the
  backend as messages, as the scanners do, where today it writes the
  engine's files and runs the engine's check itself. An installation
  with no backend has nothing to send to, so the answer has two cases.
  Wait for the facts on the config tool
  (`2026-11-13-how-todays-code-moves-facts.md`, section H) and settle
  it with how today's code moves. Not put to the owner.
- After a restart the GM scanner shows one list: what was cut off and
  what came due while the backend was down, each with run and drop.
  The list is the held items the GM already knows.

## The owner's answers (2026-11-13)

Word for word:

> 1 - I think you're getting confused here. Why would you recommend no
> to a game designer (what you're calling a maker) being able to design
> the rules of a game? This seems like you're somehow getting caught up
> in a bias towards maintaining the existing ALN ruleset instead of
> designing an engine that allows NEW games to be designed which MUST
> INCLUDE how things are scored / the verbs a designer can allow players
> to engage in using tokens.
> 2 - the first.
> 3 - agreed with the recommendation.

**Decision 2 is made:** a new capability becomes part of the engine and
arrives with an engine update; no add-ons (`docs/adr/0009`).

**Decision 3 is made:** what comes back by itself after a restart, as
recommended (`docs/adr/0010`).

**Decision 1 was put wrongly and goes back to the agent.** What the
owner ruled in sending it back: the engine must let a designer design
the rules of a NEW game in the pack, and that MUST INCLUDE how things
are scored and the verbs a designer lets players use with tokens. The
word is "designer", not "maker".

What the agent got wrong, to be checked against the records before
answering:

- It recommended that a designer's rule may never change the game
  (points, used tokens) and that "a pack never holds calculations". It
  gave the floor of 2026-07-09 as the reason. The floor says which
  people and devices may do staff actions (start and end a session, run
  the show, change a score by hand). It does not say the game's own
  rules belong to developers.
- It took today's code as the model: one scoring formula in code, with
  only its numbers in the pack, and cues that may run the room only.
  That is ALN's ruleset, which is the bias the owner named.
- It leaned on case EX4 ("a new scoring model added once: developer,
  then designer") without reading what the owner's own design records
  say a designer builds.

Before answering: read the owner's records on rules, scoring and verbs
in full (design principles P1 to P6 and open questions O1 to O5 of
2026-06-11; the phase 3 program; the roadmap's final outcome, section
2.6 and the mechanics editor row; the glossary's engine and pack
contract; the second game's scoping; cases EX3, EX4, EX20, EX22; what
`game.json` already declares). Then state back what a designer designs
and where a developer comes in, and put only what is still open.

## What the owner's records say about rules, scoring and verbs

Read by the agent on 2026-11-13, after the correction.

- The roadmap's final outcome (owner, 2026-08-29,
  `docs/plans/ROADMAP.md` section 1): "A game designer builds a
  complete game as a pack: mechanics, economy, text, theme, show cues,
  content, inside the design tool. They never touch code or
  configuration files." (The original has a dash where this has the
  first colon.) "Tuning ALN's economy and tuning a contagion game's
  spread rate are the same action, because both are just pack values."
- The roadmap's section 7.2: the second game's new parts (two-tap
  actions, hidden state that spreads, graph state and graph scoring,
  the constellation screen) are "generic, pack-parameterized modules,
  tunable in the mechanics editor like any other pack values", so the
  owner "finishes its design at his own pace with no further software
  engineering".
- The phase 3 program, section 1 (ratified 2026-06-12): for games that
  fit the engine's implemented model, a new game is a pack with no
  engine change; a game in a new mechanical class ships a small set of
  generic modules, and code written for one game trends toward zero.
- The decision of 2026-11-02, "Two kinds of game extension": the
  designer combines "existing in-engine capabilities to create
  different gameplay verbs for the players to engage with or different
  ways the game might actually respond to existing game triggers"; a
  developer is for "a response that the game engine is not currently
  capable of".
- Cases EX3 (a third way to turn in a token: designer), EX10 (the
  designer declares the two-tap action's rules), EX22 (the pack says
  what a scan causes: designer). Case EX4 ("a new scoring model added
  once: developer, then designer") says in its own status line that
  placing a new way of scoring with the developer is "as the agent
  running the pass reads it". The owner never said it.
- Design principles P1 and P4 (2026-06-11): the scoring entity is a
  ledger whose meaning the game defines; what each kind of device may
  do, transacting included, is the pack's assignment.

What the code does today, which the agent wrongly took as the model:

- A pack's mode has a verb and picks named policies
  (`ALN-TokenData/game.json`: `scoringPolicy: "standard"` or `"none"`,
  `countsTowardGroups`, `displayBehavior`). The pack holds the scoring
  tables. The formulas are in the engine's code and the pack names
  them: `requires: ["scoring.tabular", "groupRules.all", ...]`,
  `groupRules.completion.bonusFormula:
  "multiplier-minus-one-times-base"`,
  `backend/src/gameRules/scoring.js:51` (checked).
- So a designer today can tune ALN's numbers and add a mode from ALN's
  choices. A game scored another way needs a developer. That is the
  limit the owner rejects.

## Decision 1, corrected, as put again (2026-11-13)

A designer designs the game's rules in the pack, in the config tool,
with no developer:

- what a token carries: the values on each token that the rules use,
  under the designer's own names;
- what an account is (a team, a player, a faction) and what it holds
  (money, points, or more than one thing);
- the verbs: each thing a player or a GM can do with a token, with its
  name, who may do it and on which kind of device, and when it is
  allowed;
- what each verb does: how many points it gives or takes and from which
  account, written as a formula over the token's values, tables and
  what the account has done so far; whether the token is used up; what
  is shown, and where; what the room does;
- what the game does by itself: a bonus when a set is complete, a
  change when a phase starts.

Examples given to the owner, none of them ALN's: deposit (a player
holds a token to a station, their faction gets its value, doubled in
the last ten minutes); steal (a GM scans a token another faction has
deposited, it moves, and the first faction loses half its value); a
faction with one token of every colour gets 100 more.

A developer comes in only when a rule needs something the engine has no
capability for yet (the second game's graph score, state that spreads,
a new kind of screen, audio in several rooms). The capability is added
once, in the engine (`docs/adr/0009`), and every designer can use it.

ALN's own rules (selling, exposing, value times type, the group bonus)
stop being the engine's built-in model and become rules written in
ALN's pack.

Two things stay: the three staff-only actions (start and end a session,
run the show by hand, change a score by hand); and a pack holds rules
and formulas built in the config tool, never program code.

## What the correction changes in the design (the agent's engineering)

- The pack's rules become: the values a token carries, the accounts
  and what they hold, verbs, what each verb does, and what the game
  does by itself. Today's modes, scoring tables, group rules and
  duplicate policy are ALN's instance of these.
- A formula is data: a fixed set of operations (arithmetic, a table
  look-up, a count or a sum over what the account has done, a
  comparison). It always finishes, it is checked when the pack is
  published, and the same code works it out in the backend and inside
  the GM scanner (`docs/adr/0007`). It is not a script.
- The engine's code holds the capabilities rules are built from: the
  kinds of thing that can happen, the facts a rule can read, the
  operations of a formula, the effects. A developer's addition is one
  of these, in one file (`docs/adr/0009`).
- An effect is either a change to the game, written as a line in the
  session's record with the rule that caused it, or a request to the
  room, handed to show control. In a game with no backend the requests
  to the room are skipped.
- Show control keeps its own "when this, do that" for the room (cues
  on a video ending, on the clock). It never writes game lines.
- The proposal's change 6 has to be redrawn: its "Today" says there is
  one way of scoring, and its "Proposed" has a new way of scoring as a
  file a developer writes.
- Tests: ALN's rules written the new way must give the same scores as
  today's code on recorded sessions, and the toy game must be scored a
  different way, to prove the rules are not ALN's.

