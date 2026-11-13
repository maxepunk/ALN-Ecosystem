# The design of the messages between the backend and the devices, and the files

Working notes for the conversation with the owner. This design topic
covers change 3 of the proposal (`../proposal/index.html`): one
definition, with a version number, of every message between the
backend and the devices, of the files the engine reads and writes (the
pack, the installation profile, the session record), and of what is
written on a token's tag.

Rules for this conversation (owner, 2026-11-13): say at the start which
decisions are the owner's; the topic is settled when those are made;
never ask whether a unit the agent defined is complete; no bare step or
round numbers; say "account" for ALN. And from 2026-11-12: before
showing the owner a choice, look for a ruling.

## What the owner has already ruled here

Checked by the agent on 2026-11-13 unless marked otherwise.

- A scan the backend refuses is final and is never stored for later;
  the player rescans. "Local content display is unaffected in all
  cases (core function stays offline-capable); the alert concerns the
  video/recording aspect only." (Decision A5, 2026-06-09,
  `docs/decisions/2026-06-09-tier-a-game-rule-semantics.md:66-76`.)
- A stored scan uploaded later never starts a video. A video token
  scanned when the video cannot play shows "video unavailable, rescan
  later". (Decision A4, same file, `:58-63`.)
- Player scans are accepted whenever a session exists, in setup and
  paused too, for testing the flow before a game. (Decision A6.)
- A GM who scans a token another GM already processed must see
  "already claimed by X", not a false "Transaction Complete!".
  (Decision A7.) A token is used up once transacted, first come first
  served across accounts. (Decision A2.)
- The phone page's "New / Revisited" mark is a nicety of the phone
  page, not part of what a player scanner must do. (Decision C6,
  `docs/decisions/2026-06-09-tier-cd-ux-scope.md`.)
- Players never have accounts or logins, on phones or scanners. The
  engine's only built-in identity is the device or session id. Game
  data stays on the kit. (`docs/plans/ROADMAP.md` section 2.1.)
- Every live connection must present a credential, and the device type
  a device declares about itself is retired. (Hardening plan rulings R5
  and R19, 2026-09-12. Not built.)
- Device credentials are issued automatically and are invisible
  (`CONTEXT.md` section 6, "Auth tiers"). WHETHER player devices get
  them was left to the owner: `docs/plans/ROADMAP.md` row 8.11,
  "Invisible device-tier tokens: yes or no".
- Starting and ending a session, show control and score changes stay
  with staff. A pack may assign any other function to a kind of device.
  Three kinds of device: personal, shared station, staffed.
  (`CONTEXT.md` "The floor";
  `docs/decisions/2026-06-11-engine-design-notes-b4-b10.md`, P3 and
  P4.)
- Each screen is sent only what it may show: "server-side per-surface
  projection" (`docs/plans/ROADMAP.md` section 7.1, adopted
  2026-07-17).
- The phone page and the hardware scanner stay equal in what they can
  do, not in how they look (`docs/plans/ROADMAP.md` section 2.5).
- A GM scanner holding a different pack than the backend heals itself:
  it fetches the backend's pack, applies it, connects again and shows
  one toast. If that fails, a blocking screen with a plain instruction.
  (Ruling R-C2-1, 2026-09-04,
  `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:349-354`.
  Not built.)
- One published, versioned protocol covers requests, answers, what
  screens are told, and the files (`../DECISIONS.md`, "One published
  protocol and an outside test bench", 2026-11-01).
- Standalone games are declared, never mixed with networked ones
  (`../DECISIONS.md`, "Standalone games: declared, never mixed").
- The kit's DNS name and certificate, which the web address on a tag
  depends on, wait for the players'-phones work
  (`docs/plans/ROADMAP.md` row 8.19).

## What happens today

From a helper's fact sheet of 2026-11-13 (read at commit `8f8167de`,
nothing run). "Checked" marks the lines the agent read itself.

A player's scan:

| Result | The phone page | The hardware scanner | Ruling |
|---|---|---|---|
| Recorded | Shows the memory at once, before the reply (`aln-memory-scanner/js/app.js:442-457`, checked). A video token: no picture, the text "New Memory!", then a full-screen "VIDEO MEMORY TRIGGERED" | Sends first and shows after the reply, up to 10 seconds (`Application.h:570-597`, checked). A video token: its picture with "Sending..." | They differ. No ruling |
| Recorded, video refused or busy | Memory, toast "Video unavailable, rescan to retry" | Picture, "VIDEO UNAVAILABLE / Rescan later" | Same. A4 |
| No session, or the session has ended | Memory shown, toast "No active session", not stored (`orchestratorIntegration.js:158-166`, checked) | "SCAN FAILED / NO SESSION", no memory, not stored (`Application.h:699-707`, checked) | They differ. The hardware scanner hides the memory, against A5's words |
| Another refusal (bad request and so on) | Memory, toast with the backend's message, final | Stores the scan as if the backend were unreachable (`services/ScanResponse.h:73-77`, checked) | They differ. The hardware scanner stores it, against A5 |
| Session in setup or paused | As recorded | Same | Same. A6 |
| No connection, scan stored | Memory, toast "Scan queued". A video token: "Video unavailable, rescan to retry" | Memory, no sign it was stored. A video token: "VIDEO UNAVAILABLE / Rescan later" (`Application.h:579-597`, checked) | They differ on ordinary tokens. No ruling |
| A stored scan uploaded later | Nothing | Nothing | Same |

Each device also refuses a tag it does not know before sending
anything.

A GM's scan (not checked line by line by the agent):

- Accepted: the green "Transaction Complete!" shows before any reply,
  with the value from the GM scanner's own copy of the pack
  (`ALNScanner/src/app/domains/gameOps.js:319-376`).
- A duplicate first scanned on the same GM scanner: blocked on the
  scanner, nothing sent, no account named.
- A duplicate first claimed on another GM scanner: blocked on the
  scanner if it heard the claim; otherwise the green screen, then a
  toast "Token already claimed by X, no points awarded".
- Session not active, unknown token, no account selected: a toast.
- No connection: the same green screen plus an "N queued" badge. When
  stored scans are sent later, the first to reach the backend wins, not
  the first scanned.
- After a GM deletes a transaction the backend frees the token, but the
  GM scanner that scanned it keeps refusing it
  (`ALNScanner/src/network/messageRouters.js:47-54`).

A tag: two records, text first. The text is the token id. The second
is a web address,
`https://aln-orchestrator.local:3000/player-scanner/?token=<id>`
(`ALN-TokenData/tag-writer.html:444-446`). The hardware scanner and the
GM scanner read only the text. A phone's own reader opens the address.
A new name in that address means rewriting every tag (the helper's
inference).

Who can read what, with no identification (`backend/src`, checked):
the whole pack, with each token's owner, summary and value, and all
media (`routes/packRoutes.js:19-46`); the whole live state, with
accounts, scores, every transaction and player scan
(`routes/stateRoutes.js:32-45`). Any device can also post a scan for
any token id, which can start a video. The scoreboard receives the
whole state and shows scores, exposed evidence and the countdown.

What a device says when it connects: the GM scanner sends its login
token, its name, a version fixed at 1.0.0 and the hash of its pack. On
a different pack the backend writes one line to its log and tells
nobody (`websocket/socketServer.js:139-148`, checked). The phone page
and the hardware scanner have no connect step: they send a health
check with an id they chose, with no version and no pack identity.

Matching a tag's text to a token id is done three ways: the phone page
lowercases and strips; the GM scanner ignores case, colons and hyphens;
the hardware scanner wants the exact text. ALN's 81 ids are already
lowercase.

## The decisions needed from the owner (asked 2026-11-13)

Three decisions. The topic is settled, from the owner's side, when
these are made.

1. What a player sees after a scan, the same on the phone page and the
   hardware scanner. Recommended:
   - The memory appears at once. The scanner does not wait for the
     backend's reply. (For ALN. Another game's pack could make a
     scanner wait.)
   - No session, or the session has ended: the memory, with a notice
     that the scan was not recorded. (A5's words. The hardware scanner
     shows "NO SESSION" and no memory today.)
   - A video token: the token's picture, with a line that the video is
     starting on the TV. If it cannot play now: "Video unavailable,
     rescan later" (A4).
   - No connection: an ordinary token shows the memory and nothing
     else. A video token shows "Video unavailable, rescan later" (A4).
   - The wording comes from the pack's text.
2. Every scanner and screen that belongs to the kit has a credential
   (roadmap row 8.11). Recommended: yes. It is issued when the venue
   technician adds the device to the kit. Nobody types a login and a
   player sees nothing. A device without one can read nothing and send
   nothing. Players' own phones are decided with that later work.
3. A device that is out of date. Recommended: when a device connects it
   says which pack it holds and which version of the messages it
   speaks. A wrong pack: it fetches the right one by itself (ruling
   R-C2-1, extended from the GM scanner to every device). Old software
   on a GM scanner, a phone page or the scoreboard: the page reloads
   itself from the backend. A hardware scanner whose firmware is too
   old: it cannot fix itself, so it says "UPDATE NEEDED" on its own
   screen, shows red on the GM scanner with what to do, and the
   preflight reports it before a session. The backend keeps working
   with older firmware until a change to the messages truly breaks it.

Stated to the owner as following from rulings already made, with an
invitation to object:

- Each device is sent only what it may show. The scoreboard no longer
  receives every transaction. A player scanner no longer holds each
  token's value, type, group, owner and summary. The owner was asked to
  say if ALN's players are meant to see any of those.
- A GM sees the result of a scan when the backend replies (A7). What a
  GM sees with no connection belongs to the design of which device
  decides what.
- A tag keeps what it holds today. The name in its web address comes
  with the kit's DNS work (row 8.19). Changing that name later means
  rewriting every tag.
- A token id is lowercase letters, digits and underscores, and every
  device matches it the same way.

## Notes for the agent's own engineering (not the owner's)

- A stored scan carries no session id today, and a hardware scanner may
  have no real clock (no internet on the kit's network). Placing a late
  scan in "the session it was made in" (`docs/adr/0003`) needs the
  scanner to know the session or the time. The backend can give both in
  its replies and health checks.
- Every scan reaches the backend when there is a connection, also a
  duplicate, so that the session record holds it (`docs/adr/0001`). A
  device no longer blocks a duplicate by itself.
- The refusals are defined once, with what each tells the device to
  show. The four results on the page: accepted; refused, with the
  reason; held for later; failed, worth retrying.
- The config tool sends its changes as messages (the page's smaller
  change).

## Answers

(None yet.)
