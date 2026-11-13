# Step 1 of the design: how the backend keeps a session's data

Working notes for the conversation with the owner. Step 1 covers
change 1 (the session record) and change 5 (what belongs to a session,
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

## Facts looked up for round 1

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
   Open: the show and the problems. ROUND 1, question 1.
2. How a correction appears. Follows from "grows" and decision A3; put
   to the owner as a confirmation. ROUND 1, question 2. With it, one
   fact only the owner has: what the three hand adjustments of 27 March
   were. ROUND 1, question 3.
3. Where a record starts and ends: what can be added after the end,
   and late scans. ROUND 1, question 4.
4. What belongs to a session, an installation and a production.
   ROUND 1, question 5.
5. Who keeps the record in a standalone game, and the order of scans
   taken without a connection. Waits for step 3 (which device decides
   what).
6. How screens are told what to show from the record. Waits for step 2
   (the messages and files).
7. How long records are kept. Later, with the installation's settings.
   The agent's default until then: until the owner deletes them.

Taken as given unless the owner says otherwise (stated to the owner in
round 1): a backend runs one session at a time, with everything keyed
by the session so that nothing prevents more later
(`docs/plans/ROADMAP.md` section 2.2); each line names the device it
came from, not a person (`CONTEXT.md` "Pseudonymous default").

The agent's own decisions, not the owner's (engineering, to be written
up when the area is built): the record is a file per session that is
only added to, written before the reply is sent; each line gets its
order and time from the backend when it is added, and keeps the
device's own time as extra information; the format has a version number
(change 3).

## Round 1, as asked on 2026-11-13

1. Does the session record also hold what the room did and what went
   wrong? Recommended: yes, one line for each thing a person at the
   session would call an event (a video started and finished, a GM
   paused the music, a scanner lost its connection, a program crashed
   and was restarted), never continuous readings. A restart can then
   put the TV, the music and a running cue back from the record, and
   the report and the session validation read one place. Scores never
   depend on those lines.
2. Corrections stay visible. Recommended: yes. A deleted transaction
   stays in the record marked as undone, and the token can be scanned
   again, as today. A score adjustment is a line with the amount, the
   team, the GM scanner it came from and the reason if one was typed.
   "Reset All Scores" keeps its meaning (a fresh start) as a line;
   everything before it stays in the record and no longer counts.
3. What were the three hand adjustments on 27 March? If GMs move money
   between teams by hand as part of play, the record could carry a
   transfer as one line, so its two sides cannot drift apart.
4. After a session ends. Recommended: notes, photos and the accusation
   can be added to an ended session until the next session is created;
   stored player scans that arrive late go into the session they were
   made in, marked late, never into the next group's; nothing else is
   accepted after the end. (Sales and exposures a GM scanner stored
   while it had no connection wait for step 3.)
5. What is wiped between groups and what stays. Recommended rule:
   everything a group's play produced is wiped from every screen and
   scanner when the next session is created and lives on only in that
   session's record (teams, transactions, scores, the clock, cues
   fired, scans stored on scanners, what the TV was showing).
   Everything about the room stays through sessions and restarts (which
   gear is installed, the GMs' logins, volumes and audio routes, the
   Bluetooth speaker, the scanners that belong to the kit). The pack
   and its media belong to the production and change only when a new
   pack is applied, never in the middle of a session.

## Answers

(None yet.)
