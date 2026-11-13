# Which device decides what (design topic, opened 2026-11-13)

Status: with the owner. Three decisions asked on 2026-11-13. The topic
is settled when the owner has made them.

This is the third design topic in the order the owner confirmed, and it
is the proposal's change 2 ("a standalone game runs the same game code
as a networked one"). It covers three situations: a GM scanner that
loses its connection, a backend computer that dies during a session,
and a game with no backend at all.

Use the owner's words: backend, GM scanner, player scanner, account,
session, installation, pack. Put a decision in the words a GM would
use (`../rework/2026-11-10-owner-step-back.md`, last section).

## What the owner has already ruled here

Never ask these again.

- **No technical failure stops a game** (2026-11-02,
  `../DECISIONS.md`): "having to pause a game because a connection was
  lost or a device goes down mid-game is the worst possible scenario
  [...] the GMs need to know their available fallbacks to keep a game
  running with as minimal impact on the player experience as possible".
  The agent's readings of it were never confirmed: a device going down
  includes the backend's computer; a networked game that carries on
  from its devices stays the networked game it was declared as, and the
  devices' records are joined into the session's record afterwards; the
  engine may not require a second computer, and a game that needs the
  backend by its nature may end in an orderly way.
- **Standalone games: declared, never mixed** (2026-10-31, purpose
  stated 2026-11-02, `../DECISIONS.md`): a capability of the engine
  "to enable design and set-up of games that can run in environments
  where a network connection is simply not feasible, or other logistics
  making it more preferable to use only gm and/or player scanners
  (phone or hardware)". A game declares it. No game mixes networked and
  standalone devices. The hardware scanner plays a standalone game as
  the phone page does.
- **An installation may have no backend.** The kit model of 2026-06-11
  (`docs/decisions/2026-06-11-kit-model-install-tiers.md:54`) makes
  full networked, standalone GM, player scanners only and no backend
  all install tiers, not special cases. The installation profile can
  already say so (`orchestrator: false`), and the backend's own rule
  reads it (`backend/src/gameRules/resolution.js:41-58`). No scanner
  reads that file.
- **What a pack needs, and how much** (2026-09-04): the pack marks each
  need "block the show" or "skip it". The agent's call of 2026-11-10: a
  standalone game follows the same rule.
- **Claims are permanent, first come first served** (decision A2,
  2026-06-09), "may be a per-game configurable mechanic in the future".
  **A duplicate across GM scanners must show "already claimed by X"**
  (A7).
- **For ALN the GM keeps the token** once a player sells or exposes it
  (owner, 2026-11-10, `../rework/2026-11-10-what-the-engine-is.md`).
  Other games may hand it back.
- From this design pass: the session record only grows (`docs/adr/0001`);
  player scans stored on a scanner and sent late go into the session
  they were made in (`0003`); a GM sees a scan's result when the backend
  replies (`2026-11-13-the-messages-and-files.md`); every device shows
  a credential and gets it when it is added to the kit (`0004`).

## What happens today

Checked by the agent on 2026-11-13 unless marked.

- Networked, connected or not: the GM scanner checks its own copy of
  the session's state, checks its own list of scanned tokens, works out
  the points itself, marks the token as scanned, stores the scan to
  send, and shows the result at once
  (`ALNScanner/src/app/domains/gameOps.js:233-262`, `:300-345`). The
  backend's answer comes later.
- The GM scanner's rules are a second copy. Sixteen rules are written
  again outside the backend, and nothing checks five of them
  (`../relationships/2026-11-01-today-client-modules.md` section 6.2,
  not re-checked). They already differ: a standalone GM scanner refuses
  a scan only when paused (`LocalStorage.js:302`); the backend refuses
  unless the session is active (`transactionService.js:157`).
- A backend restart during a session: the trace is in
  `../rework/2026-11-12-owner-comments-on-proposal.md`.
- Standalone, from the standalone pass (`../2026-10-31-standalone-pass.md`,
  a checked document, not re-checked line by line): the GM picks
  standalone on the GM scanner's first screen; two standalone GM
  scanners are two separate games (SG-06); picking standalone again
  wipes the saved session and there is no report or export (SG-02, and
  `ALNScanner/CLAUDE.md`); the pack's game clock has no reader (SG-10);
  exposed evidence has no public view (SG-07); a player scanner records
  nothing anyone else can read; the hardware scanner has no standalone
  setting and shows a missing backend as a fault for the whole session.

## The decisions asked of the owner (2026-11-13)

As put, in plain words.

**1. A GM scanner loses its connection.** Two ways: the GM scanner
works out the result itself and shows it at once, marked "not
confirmed", stores the scan and sends it when the connection returns,
and shows the GM any scan the backend then refuses; or it shows nothing
until the connection returns. Recommended: the first. The cost: a
result a GM has told an account can be taken back. In ALN that can
hardly happen, because the GM keeps the token. Two rules with it: a
result the backend has confirmed is never taken back; if two GMs take
the same token, the scan that reached the backend first counts.

**2. The backend's computer dies during a session and does not come
back.** Recommended, one yes for all of it: the session goes on at the
GM scanners, each taking scans as in decision 1 and showing its own
part; video, music, lights and the TV scoreboard stop; when a backend
runs again (the same computer restarted, a spare, or after the session)
each GM scanner hands over what it stored and the scores and the record
are completed; the engine never requires a spare computer, and a kit
that brings one can move the session onto it; a game that cannot be
played without the backend says so in its pack, and every GM scanner
then tells its GM that the session cannot go on. What is given up: no
shared scores until a backend runs again.

**3. A game with no backend at all.** Three parts, one yes for all:
(1) the installation's settings say whether there is a backend, every
device gets that when it is added to the kit, the GM stops choosing
networked or standalone at start-up, and the pack says whether its game
can be played without a backend; (2) every device works alone while the
session runs, a GM scanner keeps its own part with the same rules as
the backend, several GM scanners each show only their own part and the
parts are put together afterwards, and a production that wants shared
scores during play brings a backend; (3) the GM scanner keeps the
session's record and the GM can save it off the device at the end; it
holds what the GMs scanned and not what players looked at.

Put as following from the rulings, with no decision asked:

- a. The choice on the page under change 2 is settled by these: the GM
  scanner runs all of the game's rules, the same code as the backend.
- b. In a standalone game the GM scanner runs the game clock and can
  show the scoreboard, exposed evidence included, on its own screen. A
  video token on a player scanner shows its picture and a line saying
  the video cannot be played here.
- c. Scans a GM scanner stored during a session count for that session
  even when they arrive after it ended. The scores change and the
  record shows they arrived late. (This extends `docs/adr/0003`, which
  says so only for player scans.)
- d. In a networked game a GM scanner with no connection cannot pause
  or end the session or run the room. Those controls show grey.

## Where the old site's questions went

- "A GM tablet cut off from the engine" (A): decision 1.
- "The show machine fails mid-game" (B) and the three readings of "No
  technical failure stops a game": decision 2. "How long the players
  may wait before shared scores are back" is not asked: the answer is
  until a backend runs again.
- "Which standalone games the engine must run" (H) and the two readings
  of "Standalone games: declared, never mixed": decision 3. "A
  standalone game may have no GM scanner at all" is not asked: the kit
  model already makes player scanners alone an install tier.
- Of the three small facts: the GMs keep a token (answered 2026-11-10).
  Whether the backend's computer has ever failed for good during a
  session, and any device expected soon, are not asked.

## For the agent's own engineering

- The GM scanner keeps a copy of the game part of the session's record
  while it is connected. With no connection it adds its own scans as
  lines marked not confirmed and works out results from the copy and
  those lines, with the same code as the backend.
- Every line needs an id that is unique across devices and the time
  the device made it, so that parts can be put together and the rules
  run again over the whole. The result must not depend on the order in
  which the parts arrive, except for the rule "the first to reach a
  running backend counts".
- A spare computer gets the record from the GM scanners' copies. What
  only the dead computer held (what the room did, problems) is missing
  until its disk is read.
- Putting parts together with no backend at all (one GM scanner
  collecting the others' parts, for example by reading codes off their
  screens) fits the same record. It is not designed now; say so to the
  owner if final scores without a backend are wanted.
- A device that was never added to a kit plays standalone with the pack
  it has. That keeps the public player scanner page working with no
  set-up.
- The hardware scanner gets a standalone setting: no Wi-Fi, no fault
  shown for the missing backend, nothing stored
  (`../2026-10-31-standalone-pass.md` section 4 lists the rows).
- At the end of a session the backend shows which GM scanners are not
  connected, since they may hold scans that are not in the scores yet.
- In a standalone game a player scanner stores nothing. If a game needs
  players' scans in a standalone record, that is new work: a way for a
  player scanner to pass its scans to a GM scanner.

## The owner's answers

(none yet)
