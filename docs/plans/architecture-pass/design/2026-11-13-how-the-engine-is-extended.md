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

## The owner's answers

(none yet)
