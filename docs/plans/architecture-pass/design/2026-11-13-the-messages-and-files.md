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

## The owner's answers (2026-11-13)

Word for word:

> 1 - yes
> 2 - What does it mean 'players' own phones are decided with that
> later work'? We need to make sure we design the architecture to
> enable this and can't handwave it as a vague 'later' consideration.
> 3 - yes, and we should also investigate whether it's possible enable
> OTA firmware updates for the hardware scanner.
>
> Comments on things that follow from my prior rulings:
> 1 - ALN players are not intended to see those (except what gets baked
> into the BMP files associated with each token--like for example, the
> owner is baked into the token BMP that's displayed for each token),
> but another game may want player scanners to get more information, so
> we need to make sure we're determining what each device may show
> based on the game the device is running.
> 2 - yes
> 3 - yes, keep in mind this may need to be adjusted to make phone
> scanners iphone compatible.
> 4 - yes

So:

- Decision 1 is made: what a player sees after a scan, the same on the
  phone page and the hardware scanner, as recommended above.
- Decision 3 is made: a device that is out of date, as recommended
  above. The owner added: find out whether the hardware scanner can
  take firmware updates over the air. Research started 2026-11-13:
  `docs/plans/2026-11-13-hardware-scanner-ota-research.md` (written by
  a helper; not there until it finishes).
- Decision 2 (credentials) is NOT made. The agent had written "players'
  own phones are decided with that later work". The owner: the
  architecture must be designed to enable players' own phones now. See
  the next section. The decision was put again in full the same day.
- What each kind of device is sent is decided by the game it is
  running, in the pack. For ALN, a player scanner gets each token's
  picture (with what is baked into the picture, such as the owner's
  name), its sound and its video name, and not the value, type, group,
  owner or summary fields. Another game's pack may give a player
  scanner more.
- A GM sees the result of a scan when the backend replies: yes.
- A tag keeps what it holds today: yes, and its layout may need
  adjusting so that players' own phones work on iPhone. Research
  started 2026-11-13 on what iPhones and Android phones need from a
  tag: `docs/plans/2026-11-13-phone-tap-to-web-tag-research.md` (same
  caveat). The tag layout comes back to the owner as one decision when
  that is in.
- A token id is lowercase letters, digits and underscores: yes.

## Players' own phones: what the owner has already decided

The agent should have carried this into the design and did not. None
of it is new. Checked on 2026-11-13.

- Players' phones join the kit's own Wi-Fi, never the venue's. The
  backend answers a real name there (the example given was
  `play.aboutlastnightgame.com`), through DNS that runs on the
  backend's computer, with a real certificate. It works with no
  internet. (`docs/decisions/2026-07-09-kit-network-posture.md`. The
  DNS and certificate work is deferred to the players'-phones work:
  `docs/plans/ROADMAP.md` row 8.19.)
- A player's phone reaches the game by tapping a token: the phone's
  own tag reader opens the web address on the tag. Nothing is
  installed. Reading tags from inside a web page works only on Android
  and is rejected as the basis. (Design principle P7,
  `docs/decisions/2026-06-11-engine-design-notes-b4-b10.md`. The iPhone
  test passed on a production token on 2026-07-17:
  `docs/plans/PHASE3-STATUS.md`, "Spike results".)
- Three kinds of device: personal (a player's own phone), shared
  station (kit hardware), staffed (staff devices). The pack says which
  kinds a game uses and what each may do. (P3 and P4.) The functions a
  pack assigns: view content, transact (by mode), bind to an entity,
  and the three that always stay with staff. ALN's pack already
  declares them: `ALN-TokenData/game.json`, the `functions` block
  (personal devices may view content and nothing else).
- Every device holds one kind of credential, in three strengths: staff
  log in; kit hardware is enrolled; a player's phone gets a
  pseudonymous one from the backend on its first visit, with no login.
  What a credential allows is worked out when it is issued: what the
  pack gives that kind of device, capped by its strength, never the
  three staff-only functions. (`docs/plans/2026-07-09-phase3-1-one-auth.md`;
  built for staff and the scoreboard in `backend/src/gameRules/grants.js`,
  which still uses its own table and not the pack's block.)
- A phone that keeps a session is not thereby identified. Whether a
  person is ever named is the game's choice. (P8; `docs/plans/ROADMAP.md`
  section 2.1.)
- Each device is sent only what it may show, worked out on the backend
  (the one-auth addendum of 2026-07-17). And an action can be allowed
  for the person acting, shown by something they scan, with the device
  only carrying it (same addendum).
- The phone page and the hardware scanner stay equal in what they can
  do (`docs/plans/ROADMAP.md` section 2.5).

What the proposal's changes must carry so that this works:

- Change 1: one entry point that checks what the sender's credential
  allows, not which program sent the message. A phone, a hardware
  scanner and a GM scanner all come in the same way.
- Change 3: the credential is part of what every device sends; the
  reply says what to show; each device is sent only its part; the
  tag's layout and its web address are in the definition.
- Change 5: a kit device's credential belongs to the installation. A
  player's phone's belongs to one session (put to the owner
  2026-11-13: it follows from "what a group's play produced is wiped").
- Nothing may assume a `.local` name or a self-signed certificate. The
  backend's public name is a setting of the installation.

Still open here, and whose it is:

- Whether the kit's own scanners and screens get an enrolled credential
  (roadmap row 8.11): the owner's. Put again 2026-11-13, in full.
- The tag's layout for phones (record order; a real name; whether the
  address should carry a code that cannot be guessed, since a token's
  id can be): the owner's, after the research is in.
- How a phone that may do more than view gets tied to an account: each
  game's design, through the pack's "bind to an entity" function. Not
  an engine decision.

## Firmware updates over the air: what the research found (2026-11-13)

The note is `docs/plans/2026-11-13-hardware-scanner-ota-research.md`,
written by a helper from the Arduino-ESP32 core's own files, Espressif's
documentation and this repository. The agent checked these of its
claims itself: the sizes of the firmware slots in the core's partition
tables at tag 3.3.2 (read from `raw.githubusercontent.com`); the hook
`verifyRollbackLater()` in the core; the last recorded firmware size in
the scanner's commit `b58961e`; that the firmware has no update code;
that it accepts any certificate; that it asks internet time servers for
the time.

- Possible, on one condition: each hardware scanner needs one more
  flash over USB, to a layout with room for two copies of the firmware.
  Today's layout (`no_ota`) holds one copy and the firmware has no code
  that can replace itself.
- Room: two copies of up to 1,966,080 bytes each (`min_spiffs`) or
  2,031,616 (`no_fs`). The firmware's last recorded size is 1,214,487
  bytes (2025-11-09). Today's size is not measured: one build on the Pi
  is needed.
- A power cut during an update leaves the old firmware working. To be
  protected from a new firmware that starts and then fails, the
  firmware must confirm itself only after its own checks (the core
  confirms it too early by default).
- The helper's reading: fetch the file to the SD card with the download
  that already works, check it, then flash from the card. That also
  allows an update from a card with no network.
- An update belongs at start-up, never in a session.

Three findings from that research that bear on this design:

- The firmware does not check who it is talking to: every HTTPS request
  accepts any certificate
  (`arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:714`,
  `:945`, `:979`).
- The firmware has no version number and never tells the backend which
  build it runs (the research note's row 1.17). "A device says which
  version it speaks" needs one.
- The scanner asks internet time servers for the time
  (`OrchestratorService.h:120`). The kit's network has no internet, so
  a scanner there never learns the time, and its scans carry a 1970
  placeholder. The backend has to give scanners the time.

A correction: `../rework/owner-questions.md:334` (the retired site's
questions) says the board's partition leaves no room for an update over
the air. That is true of the layout chosen, not of the board.

Put to the owner on 2026-11-13: the new engine's hardware scanner takes
its updates over the air. Recommended: yes. The cutover already flashes
every hardware scanner over USB, so that flash installs the two-copy
layout, and it is the last one that needs a cable.

## The tag's layout: what the research found, and the owner's note (2026-11-13)

The note is `docs/plans/2026-11-13-phone-tap-to-web-tag-research.md`.
Its first lines say which claims the agent checked.

- An iPhone looks through the whole tag for a web address and uses the
  first one. It shows a notification, and the page opens in Safari when
  the player touches it. iPhone XS and later. A web page on an iPhone
  cannot read tags itself.
- An Android phone looks only at the FIRST record on a tag. Ours is the
  token id as text, so a tap alone opens nothing. Android 16 and 17
  also change how a web-address tag opens (17 adds an "open link"
  step).
- The owner, 2026-11-13: "an android phone using the phone scanner
  currently first accesses the player scanner being served by the
  backend before scanning a tag." The phone page then reads tags
  itself, in Chrome, and takes the token id record. So today's layout
  serves both phones, each by its own path: Android opens the page
  first and scans inside it; an iPhone taps and the tag's address opens
  the page.
- The design principle P7 of 2026-06-11 expected one path for both: the
  phone's own tag reader opening the address, with reading inside the
  page "rejected as the basis". On Android that needs the address to be
  the first record. With the id first, Android's working path is the
  one P7 set aside.
- The hardware scanner reads 32 bytes in one exchange and accepts only
  a first text record. With the address first it would have to read
  further (two exchanges unless the address is 36 characters or fewer
  after `https://`) and go through the records. Its code comments name
  the gap between two reads as the main cause of failed scans in the
  past.
- The GM scanner, the phone page and the token check-in tool already
  find the id record wherever it is. The tag-writing tool insists on id
  first.
- With the address first, a token held to a GM's Android device while
  the GM scanner is not scanning would open the phone page and send a
  player scan.
- The one real tag whose bytes are in the repository points at
  `raspberrypi.local`, not `aln-orchestrator.local`. No record says
  what the other tags hold.
- A fixed address proves nothing about a tap: it can be typed, copied
  or, with ids like `mar004`, guessed. A long random code would stop
  guessing and nothing else. A tag that makes a new address at every
  tap exists (NTAG 424 DNA) and is a different kind of tag.
- For a designer: on a phone, sound does not start until the player
  touches the screen once. On an iPhone every scan is a notification to
  touch and a fresh page. On Android with the address first, every tap
  opens a new tab unless the page's own reading is running.
- Nothing was tried on a phone. The note lists the five-minute tests.

Two findings for the agent's own engineering:

- The backend sends a header (Strict-Transport-Security) that, once a
  real certificate is in use, makes every browser refuse the site with
  no way through if the certificate has run out. On a kit with no
  internet that would lock out every phone and tablet. The preflight
  must report the certificate's remaining life, and that header should
  not be sent by a kit's backend.
- With credentials, a scan must come from a device the backend knows.
  That does not prove a tap either.

Checked by the agent on 2026-11-13 before putting the decision:

- The principle of 11 June, word for word: "For personal devices, the
  token to device channel is the OS handling NDEF URL records
  (background tag reading), opening the web client with token context:
  cross-platform (iOS+Android), zero-install. In-page NFC APIs (WebNFC)
  are Android-only and rejected as the basis."
  (`docs/decisions/2026-06-11-engine-design-notes-b4-b10.md:77-85`.)
  With the id first on the tag this holds for an iPhone only.
- The decision of 9 July: the kit brings its own network, and one
  public name (the example was `play.aboutlastnightgame.com`) is set
  once and answered on the kit's network by DNS on the backend's
  computer (`docs/decisions/2026-07-09-kit-network-posture.md`). So the
  name inside a tag's address belongs to the production, and any kit of
  that production answers it.
- The hardware scanner's own comment on why it reads once: one
  exchange removes "the inter-exchange window where card RF-coupling
  wobble can drop the card out of ACTIVE state (the dominant historical
  failure mode)"
  (`arduino-cyd-player-scanner/ALNScanner_v5/hal/RFIDReader.h:612-619`).
- The GM scanner reads tags only between choosing an account and
  finishing or cancelling it (`ALNScanner/src/app/domains/gameOps.js:118-145`
  starts it, `:386-407` stop it). On the screen where the account is chosen no reading
  runs, so the Android device handles a tag by itself there.

What the order on the tag changes, and what it does not:

- On an iPhone, nothing. Every scan is the phone opening the address.
- On Android, only how the player first reaches the phone page: by
  tapping a token (address first), or by a QR code or an address given
  at the door (id first). After that the page reads the tags in both
  cases, because a tap that the phone handles by itself opens a new
  browser tab each time (the helper's reading of Chrome's code; not
  tried on a phone).
- Address first costs: new reading in the hardware scanner (a second
  exchange unless the address is 36 characters or fewer after
  `https://`, such as `play.aboutlastnightgame.com/t/mar004`); a token
  held to a GM's Android device while no reading runs opens the phone
  page and sends a player scan; a rewrite of every tag.

Put to the owner on 2026-11-13, as one decision with three parts:

1. A tag holds two things: the token's id, and the web address of the
   phone page for that token. Every reader of the engine finds the id
   wherever it sits on the tag. (The GM scanner, the phone page and the
   check-in tool already do. The hardware scanner and the tag-writing
   tool have to learn to.)
2. Which of the two comes first is each production's choice, made when
   its tags are written.
3. ALN keeps the id first. An iPhone taps. An Android phone opens the
   page first, as today. The principle of 11 June gets one sentence
   added: on Android the page reads the tags once it is open, and the
   order on the tag decides only how the player first gets there.

Stated to the owner as following from this, with no decision asked:

- The address inside a tag names the production, never one kit. Every
  ALN tag is rewritten once, when the real name exists. ALN's order can
  still be changed up to that rewrite.
- The address is inside physical objects, so no update can change it.
  It is made as short as it can be, and the backend keeps answering it
  for as long as the tags exist.
- A player's own phone is sent a memory when it scans that token, on
  the kit's Wi-Fi with this session's credential. A scan from a phone
  shows that the phone had the token's address. It does not show that
  it touched the token: the address can be passed on, and ids such as
  `mar004` can be guessed. The definition has a place for a code per
  token that cannot be guessed, written into the address and checked by
  the backend. It stops guessing and not passing on. It is not turned
  on for ALN unless the owner says so; if it is wanted for ALN it goes
  into the same rewrite.
- Limits of the phones that a designer should know: on an iPhone every
  scan is a notification to touch and a page loaded afresh; on any
  phone, sound starts only after the player has touched the page once.

For the agent's own engineering (the owner was told in one line):

- Every scan from an iPhone is a fresh page load. The phone page must
  start fast and keep what it needs in the phone's storage for that
  site and on the backend, never only in the page's memory.
- The address should have no port number, because a phone keeps what a
  site stored under the name and the port together.
- A kit's backend must not send the Strict-Transport-Security header,
  and the preflight must show how many days the certificate has left.
- The hardware scanner's new reading must leave an id-first tag on its
  single exchange.
- The checks on a phone (the research note's U1 to U3) belong with the
  kit's DNS and certificate work, before the tags are rewritten. The
  decision above does not wait for them.


## The tag decision again, in plain words (2026-11-13)

The owner, on the decision as first put: "can you rewrite decision 1
in clear, plain english for me please?" Sent again as below. One point
of substance changed: the first wording counted "every tag is
rewritten" as a cost of putting the link first. The tags need one
rewrite either way before an iPhone opens the page without a security
warning, because the link has to carry the kit's real web name. So the
rewrite is not a cost of either side.

- A tag has two things written on it: the token's id, and a web link
  that opens that token in the player scanner page.
- The hardware scanner and the GM scanner read the id. An iPhone reads
  the link. An Android phone reads the id, after the player has opened
  the player scanner page.
- The question is which is written first. Only Android phones care:
  an Android phone looks at whatever comes first and ignores the rest.
- Id first (the tags as they are): an Android player opens the page,
  then scans from inside it. An iPhone player holds the phone to a
  token.
- Link first: an Android player could hold the phone to a token with
  nothing open and the page would open. Two things get worse. The
  hardware scanners need new firmware that reads further into the tag,
  and reading in two goes is what caused failed scans in the past
  (only a very short link avoids it). A token that touches a GM's
  Android device while the GM scanner is not waiting for a scan opens
  the player page and records a player scan.
- Recommended: ALN's tags stay as they are, id first. The new engine
  reads a tag written either way, so another game can choose link
  first with no change to the engine.
- What a yes changes on paper: the rule of 11 June (a player's phone
  opens the page by touching a token, on iPhone and Android alike)
  stays true on iPhone only for ALN. On Android the player opens the
  page first.

## The owner's answers on the last three decisions (2026-11-13)

Word for word:

> 1 - no, let's stick with the decision that AFTER the cutover, iphone
> and android paths to scan a token should be the same. That seems like
> the better long-term choice, does it not?
> 2 - yes to credentials
> 3 - yes to OTA updates for hardware scanner

**The tag: the link is written first, after the cutover.** The owner
kept the rule of 11 June as written. The agent's recommendation (ALN
keeps the id first, Android players open the page before scanning,
each production chooses the order) is withdrawn. Asked "does it not?",
the agent answered yes, for four reasons: one instruction for every
player (hold your phone to a token); one way in to design, build and
test, where today there are two; it rests on what every phone does
with a tag, while reading tags from inside a page works in Chrome only
and is a draft, not a standard; and both costs can be designed away.
The agent had weighed the hardware scanner's firmware change too
heavily.

What follows, all of it the agent's engineering unless marked:

- One layout: the web link first, the token's id as text second. The
  tag-writing tool writes that and checks it.
- The link names the production and has no port number. It must be
  short enough that the hardware scanner still gets the id in one
  read. Arithmetic from the captured tag's layout, not yet measured on
  a scanner: one read returns at most 60 bytes of the tag (pages 3 to
  17); reading the id from the text record needs 18 bytes plus the
  link plus the id, so the link after `https://` may be 36 characters
  with a 6-character id (`play.aboutlastnightgame.com/t/mar004` is
  exactly 36). Reading the id from the end of the link instead needs
  11 bytes plus the link, which allows 49 characters. Decide which at
  build time; the tag-writing tool refuses a tag that breaks the limit.
- The new hardware-scanner firmware reads a tag written either way.
  Then green works with today's tags, the scanners are flashed first,
  and the tags are rewritten after the cutover with no day on which
  everything must change at once. Today's firmware reads only a tag
  with the id first, so no tag is rewritten while blue runs ALN.
- The GM scanner keeps reading tags whenever it is on screen, so a
  token that touches a GM's device goes to the GM scanner and the
  phone does not open the link. The player scanner page, opened on a
  device that holds a staff credential, records no player scan. (Both
  pages are served under the same name, so the page can tell.)
- The player scanner page is built for a fresh page load at every scan,
  on both phones. Reading tags from inside the page is no longer the
  way in on Android. Stated to the owner; if each tap opens a new tab
  on Android (the helper's reading of Chrome's code) and that proves a
  nuisance, reading inside the page can come back as an extra, never as
  the way in.
- The check on real phones: one spare tag written link first with the
  real name, one iPhone, one Android phone. It belongs at the start of
  the work on the kit's DNS and certificate (roadmap row 8.19), before
  any tag is rewritten.
- To raise with the owner when the kit's DNS work is designed, not
  before: what a player sees who taps a token before joining the kit's
  Wi-Fi. With the public name pointing at the kit's own address (the
  9 July decision) the browser shows an error. The public name could
  instead answer with a page that says to join the Wi-Fi.

**Credentials: yes.** Every device shows the backend a credential
before it can read or send anything. Staff log in. The kit's own
scanners and screens get theirs when they are added to the kit (this
answers roadmap row 8.11: yes). A player's own phone gets one on its
first visit, with nothing for the player to do, and it lasts for one
session. A device with none can read nothing and send nothing.

**Firmware over the air for the hardware scanner: yes.** The cutover's
USB flash gives each scanner the layout with room for two copies. After
that a scanner fetches new firmware from the backend when it starts up,
never during a session.

The four statements put beside the tag decision (a to d) drew no
objection. Statement a's last sentence (ALN's order can still change up
to the rewrite) no longer applies. Statement c stands: no code that
cannot be guessed for ALN; the place for one is in the definition.

## Status: settled (2026-11-13)

Every decision the agent needed from the owner on the messages between
the backend and the devices, and on the files, is made:

1. What a player sees after a scan, the same on the player scanner
   page and the hardware scanner.
2. What a device that is out of date does.
3. The pack says what each kind of device is sent.
4. Every device shows a credential, in three kinds.
5. The hardware scanner takes its firmware over the air.
6. After the cutover both phones scan a token the same way, and the
   link is written first on the tag.

Decision notes: `docs/adr/0004`, `0005`, `0006`. What is left is
engineering detail: the exact list of messages and their fields, the
form of the link, how a credential is stored on each device, the
firmware's update steps.
