# The design of how the backend keeps a session's data

Working notes for the conversation with the owner. This design topic
covers change 1 (the session record) and change 5 (what belongs to a session,
an installation and a production) of the proposal
(`../proposal/index.html`). The method is question rounds: look the
facts up first, ask only what is the owner's to decide, give a
recommendation for each question, word it so "yes" accepts it. Every
answer goes at once onto the state page, into `../DECISIONS.md`, into
`CONTEXT.md` when a term settles, and into `docs/adr/` when a decision
is hard to reverse, surprising and a real trade-off.

## Settled

- The session record only grows (owner, 2026-11-13;
  `docs/adr/0001-the-session-record-only-grows.md`).
- The record holds accepted and refused transactions alike
  (decision B9, 2026-06-09: `backend/contracts/session-bundle.schema.json`,
  "Accepted and rejected claims alike").
- It carries the pack the game ran and the texts the players saw
  (owner, 2026-11-01, "The night's record and the after-game article").
- The capture planned in the roadmap joins it: the roster before the
  game, notes and photos during, the accusation and the whiteboard at
  the end (`docs/plans/ROADMAP.md`, the capture block).
- "Reset All Scores" means a fresh start: scores to zero, transactions
  and token claims cleared, player scans kept (decision A3, 2026-06-09,
  `docs/decisions/2026-06-09-tier-a-game-rule-semantics.md`).
- A pack never changes in the middle of a session (decision A2;
  `CONTEXT.md` "Activation").
- It also holds what the room did and what went wrong, one line for
  each event a person at the session would recognise, never things
  that change all the time (owner, 2026-11-13; `docs/adr/0002`).
- After a session ends, notes, photos and the accusation can be added
  until the next session is created; stored player scans that arrive
  late go into the session they were made in (owner, 2026-11-13;
  `docs/adr/0003`).
- What is wiped between groups and what stays; one session at a time;
  each line names the device (owner, 2026-11-13; `docs/adr/0003`).
- A transfer between accounts is one action and one line, built with
  the GM scanner's redesign (owner, 2026-11-13).

## Facts looked up before the questions of 2026-11-13

- One real session's report is in the repository
  (`docs/session-report-0327gamereal.md`): 27 March 2026, 2 hours 29
  minutes, 4 teams, 34 transactions. GMs deleted 2 transactions
  (tokens `fli002`, `jes003`), reset nothing, and adjusted three teams
  by hand: -75,000, -375,000 and +475,000. The report carries no reason
  for the adjustments.
- The session bundle is a file for the report, shaped as a summary of a
  finished session: session, scores, transactions, player scans, tokens,
  rules, and reserved names for the capture and for a non-ALN game's
  state. Nothing writes one yet. The agent's reading, not yet put to the
  owner as a decision: the bundle is worked out from the session record
  when the session is over.
- What a backend restart loses today is in
  `../rework/2026-11-12-owner-comments-on-proposal.md`. Putting the show
  back after a restart needs something to hold what the show was doing.

## The design tree, and where the edge is

Decided: the record only grows. Hanging off it:

1. What gets a line. Settled for the game, the pack and the capture.
   Open: the show and the problems. Asked 2026-11-13, question 1.
2. How a correction appears. Follows from "grows" and decision A3;
   stated to the owner, not asked. With it, one fact only the owner
   has: what the three hand adjustments of 27 March were. Asked
   2026-11-13, question 4.
3. Where a record starts and ends: what can be added after the end,
   and late scans. Asked 2026-11-13, question 2.
4. What belongs to a session, an installation and a production.
   Asked 2026-11-13, question 3.
5. Who keeps the record in a standalone game, and the order of scans
   taken without a connection. Waits for the design of which device
   decides what.
6. How screens are told what to show from the record. Waits for the
   design of the messages and files.
7. How long records are kept. Later, with the installation's settings.
   The agent's default until then: until the owner deletes them.

Taken as given unless the owner says otherwise (stated to the owner on
2026-11-13, and confirmed by the owner the same day): a backend runs one session at a time, with everything keyed
by the session so that nothing prevents more later
(`docs/plans/ROADMAP.md` section 2.2); each line names the device it
came from, not a person (`CONTEXT.md` "Pseudonymous default").

The agent's own decisions, not the owner's (engineering, to be written
up when the area is built): the record is a file per session that is
only added to, written before the reply is sent; each line gets its
order and time from the backend when it is added, and keeps the
device's own time as extra information; the format has a version number
(change 3).

## The first questions, as asked on 2026-11-13

Stated to the owner as following from decisions already made, with an
invitation to object (not asked as questions):

- Corrections stay visible. A deleted transaction stays in the record
  marked as undone, and the token can be scanned again, as today. A
  score adjustment is a line with the amount, the team, the GM scanner
  it came from and the reason if one was typed. "Reset All Scores"
  keeps its meaning (a fresh start, decision A3) as a line; everything
  before it stays in the record and no longer counts.
- The record already holds every scan (accepted or refused), the pack
  the session ran, the texts the players saw, and the capture planned
  in the roadmap.

Asked, each with a recommendation worded so "yes" accepts it:

1. Does the session record also hold what the room did and what went
   wrong? Recommended: yes, one line for each thing a person at the
   session would call an event (a video started and finished, a GM
   paused the music, a scanner lost its connection, a program crashed
   and was restarted), never things that change all the time. A restart
   can then put the TV, the music and a running cue back from the
   record, and the report and the session validation read one place.
   Scores never depend on those lines.
2. After a session ends. Recommended: notes, photos and the accusation
   can be added to an ended session until the next session is created;
   stored player scans that arrive late go into the session they were
   made in, marked late, never into the next group's; nothing else is
   accepted after the end. (Sales and exposures a GM scanner stored
   while it had no connection wait for the design of which device
   decides what.)
3. What is wiped between groups and what stays. Recommended rule:
   everything a group's play produced is wiped from every screen and
   scanner when the next session is created and lives on only in that
   session's record (teams, transactions, scores, the clock, cues
   fired, scans stored on scanners, what the TV was showing).
   Everything about the room stays through sessions and restarts (which
   gear is installed, the GMs' logins, volumes and audio routes, the
   Bluetooth speaker, the scanners that belong to the kit). The pack
   and its media belong to the production and change only when a new
   pack is applied, never in the middle of a session.
4. A question of fact only the owner can answer: what were the three
   hand adjustments on 27 March? If GMs move money between teams by
   hand as part of play, the record could carry a transfer as one line,
   so its two sides cannot drift apart.

## The owner's answers to the first questions (2026-11-13)

Word for word:

> 1 - yes
> 2 - this makes sense.
> 3 - agreed
>
> Answer: I don't recall what those adjustments were, but GMs do move
> money between teams/accounts by hand as part of play in ALN. (what's
> identified as teams in the backend are really framed as accounts in
> ALN)
>
> the two things you're taking as given are accurate.

So: the record holds what the room did and what went wrong
(`docs/adr/0002`); the after-end rule and the wipe/stay rule stand
(`docs/adr/0003`); one session at a time, and lines name the device.
The owner raised no objection to "corrections stay visible".

Wording from here on: for ALN say "account", never "team". The
engine's own word is "entity" (`CONTEXT.md` section 1).

## The closing questions, as asked on 2026-11-13

1. A transfer between accounts as one action. GMs move money between
   accounts today by typing two separate adjustments. Recommended: a
   transfer becomes one action on the GM scanner (pick two accounts,
   type the amount once) and one line in the record, so the two sides
   cannot differ and it can be undone as one. It is built with the GM
   scanner's redesign, not now. Nothing in this design topic depends
   on it, because the record takes new kinds of line.
2. The summary of this design topic, for the owner to confirm as the
   whole of it:
   the record only grows; what it holds; scores and screens are worked
   out from it and a restart reads it back; the after-end rule; the
   wipe/stay rule; one session at a time; lines name the device. Left
   for later steps: who keeps the record in a standalone game and the
   order of scans taken without a connection (the design of which
   device decides what); how screens are told what to show (the design
   of the messages and files); how long records are kept (with the
   installation's settings).

## The owner's answers to the closing questions (2026-11-13)

Word for word:

> 1- yes
> IS this the whole of step 1: You're the one who's defined each step,
> so I'm not sure that I can answer this question without you
> explicitly defining what you need from me in order to be able to
> consider 'step 1' complete. Be careful about falling into jargon and
> labels that we haven't explicitly agreed upon (like your current
> definition of 'steps')

So: a transfer between accounts becomes one action for the GM and one
line in the record, built with the GM scanner's redesign
(`docs/plans/ROADMAP.md` row 8.17; glossary term "Transfer").

And two corrections to how the agent works with the owner:

- Never ask the owner whether a unit of work the agent defined is
  complete. Say at the start of each design topic which decisions are
  the owner's. The topic is settled when those are made. The rest is
  the agent's engineering detail.
- No bare step or round numbers. The owner's rule of 2026-11-01 ("Name
  each step by what it does", `../DECISIONS.md`) already said so: name
  each piece of work by what it does; question rounds go by date.

## Status: settled (2026-11-13)

Every decision on this topic that was the owner's has been made. They
are listed under "Settled" above and in `../DECISIONS.md` ("Since the
proposal"). Left for the agent, to be written up when the area is
built: how the record is stored, its format and version, and when a
line is written to disk.
