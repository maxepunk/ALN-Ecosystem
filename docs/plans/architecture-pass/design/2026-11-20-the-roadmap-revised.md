# The roadmap, revised (third draft for the owner, 2026-11-20)

Status: draft. It is the fifth of the five documents the design hands
over (the program document
`docs/plans/2026-10-30-architecture-pass.md`, sections 4.2 and 7).
When the owner signs it off, `docs/plans/ROADMAP.md` is amended in
place and becomes its fifth revision. The text of the fourth stays in
git history. Until then `ROADMAP.md` is not edited. "The current
roadmap" below means `ROADMAP.md` as it stands today.

This is the third draft. Three independent readers checked the first
two and found forty-two faults between them. What each one changed is
in `2026-11-20-the-check-of-the-two-drafts.md`. The tests this
document points to are in `2026-11-20-each-decision-and-its-test.md`.

## 1. What stays as it is

Each line below says what a rule or a fact of the current roadmap is.
The section it comes from is named after it. The current roadmap's own
text for these stays word for word. Where a rule there has only a
title, the amended roadmap puts the rule's first sentence here before
the title.

What the work is for (section 1 of `ROADMAP.md`):

- The end is a platform released as open source. A designer builds a
  whole game as a pack inside the config tool, without touching code
  or settings files. A technician installs it at a venue. A GM runs
  it. Players play by tapping tokens, with no login, no user account
  and no app to install.

Rules that bind every piece of work (section 2):

- A player never has a login or a user account of their own. The only
  identity the engine keeps by itself is a device's or a session's.
  Identifying a person is a game's own choice and never the engine's
  default. A session's data stays on the kit unless the owner moves
  it. How long old sessions are kept is the owner's decision, for each
  game. These are the privacy rules that every later operator of the
  platform inherits. (2.1)
- Nothing that is built may assume there is only one kit, one pack or
  one production, where avoiding that assumption costs little. The
  check for every design: a pack is chosen by path or id and never
  taken to be the only one; an installation's settings likewise;
  nothing that identifies one kit is inside the engine's code; names
  and addresses on the network work for each kit; a game's media can
  move between computers. Features for several kits or packs come
  with the later work on running kits. The places in the design that
  make them possible are built now. (2.2)
- Media files are never stored in a pack. A pack lists the media
  files it needs, each with a check value. The files travel as a
  separate set that can be checked against the pack's list and moved
  between backend computers. A designer can upload the files a pack
  needs through the config tool. (2.3)
- A designer changes a game's values in the config tool, applies the
  change and plays it. The config tool's editor and applying a pack
  without restarting the backend are one piece of work. (2.4)
- The phone page and the hardware scanner can do the same things for a
  game, though they look different, and a game's kit says which kinds
  of device its players use. The firmware work this needs is committed
  work on the platform and does not wait for any one game's design.
  Everything a designer works on is data in the pack and never
  firmware: no mechanic may need hardware scanners re-flashed to be
  tuned. (2.5)
- The engine takes no side on a game's design. Who is identified, how
  many scanners there are and what is tracked are set by the pack and
  the kit. (2.6)

The five states the work is steered by (section 3). A decision to
deploy or to share is made at a state:

- **Coherent on main.** Everything built before this pass is merged
  and passes its tests. Reached on 2026-09-12.
- **Hardware-proven.** A second computer, green, is built from the
  deployment guide and passes the hardware pass at home, with today's
  engine and today's hand-run check list. Green has not been started.
  The pass is the owner's to schedule (the program document, section
  7). Green then serves as the place at home where work is tried on
  real equipment (ruling R17 of 2026-09-12).
- **Show-ready.** Deploying ALN on the new engine is the owner's
  choice to make. Its four conditions are restated in section 4.
- **Previewable.** A designer who did not build the engine can open
  the config tool, change the toy game and rehearse it. The live Home
  Assistant token and the admin password that sit in today's
  repository are changed before this state, before the first outside
  person touches the system (the owner, 2026-09-05).
- **Adoptable.** A stranger can set the platform up and learn it.

The five troubles the owner named, which the work is ordered to remove
(section 4): the GM scanner's panels showing something other than what
is really happening; not knowing whether each part works; piecing a
session together afterwards from photos and notes; the GM scanner's
layout being unhelpful in the middle of a game; and needing a
technician to get from power-on to a running show.

Rules of how the work runs:

- Blue runs every ALN session until one cutover. Nothing is deployed
  to the venue's computer before the owner's show-ready decision. No
  date governs the work.
- After a cutover, the engine is updated only between events. A pack
  can be updated at any time by publishing it. (section 7.4)
- Each piece of work gets its size when its detailed design is made,
  and the owner approves the size before building. (section 4)
- Schedule, pauses and the decision to go to green are the owner's,
  taken on reports of what can be observed (ruling R8 of 2026-09-12).
- One pull request for each repository a block of work touches,
  opened as a draft when the block opens and merged by the owner
  (ruling R4 of 2026-09-12).
- Anything put off must point at a numbered row of the roadmap's
  registry of deferred items. (the standing rule of 2026-08-29)
- The second game's design goes at the owner's pace beside all of
  this. The platform delivers all the technology that game needs, so
  that its design needs no more engineering. (section 7.2)

## 2. What the pass changed

The current roadmap has two pieces of work that were paused in
September. It calls them the hardening block (restarting crashed
programs, saying whether each part works, the preflight) and the truth
sweep (proving that every screen shows what is really happening). Both
are replaced by **the build**: changing the engine to match the design
the owner decided between 2026-11-10 and 2026-11-20 (the proposal's
seven changes; `docs/adr/0001` to `0011`).

The owner ratified how the build runs on 2026-10-30 (the program
document, section 5). It changes the engine one area at a time. Each
area gets its detailed design just before it is built, and its tests
are written first. The paused pieces of September and the truth
sweep's purpose are rebuilt inside its areas. It is the engine work
that must land before green can replace blue. It ends "when every
rule's test passes on the rig". A few tests need a real hardware
scanner, phone or tag, which the rig does not have. Where those are
proven is a reading of the agent's (section 11).

Items of the current roadmap that the owner's decisions moved or
answered:

| In the current roadmap | What changed | By |
|---|---|---|
| The pieces of the hardening block that were never built | Each is built in an area of the build. Credentials: the first version. Restarting crashed programs and the GM's buttons for a fault, the check of the installation's settings file, and the fixes to "not installed" that were lost with the container during the pause: the room's equipment. A GM scanner fixing its own out-of-date pack: a whole game session. The preflight's checks, its command line and its panel: the preflight. The rest of the repair of the test set-up: the test bench. The last joining-up of those pieces is done in the areas themselves. The review that was to close the block becomes the review before the venue rehearsal (section 11, the fourth reading). | owner, 2026-10-30 |
| The truth sweep | Its purpose is met in every area that builds a screen: what each screen shows is read and checked against the record and the equipment's reports (test 1.10). Its five recorded faults are tests 1.9, 5.7 and 6.1 to 6.5. Its census goes onto the areas' lists of pending cases. The recount of its three audit reports is set aside: the reports were lost with the container, and the cause analysis is the evidence now. | owner, 2026-10-30; `docs/adr/0001` |
| Reference pictures of blue's screens, which were to be taken in September and never were | Taken at the start of the build, in the test bench. | owner, 2026-09-05 and ruling R22 of 2026-09-12 |
| "Build a thin first version that works end to end", in the order the owner confirmed on 2026-11-13 | It is the build's second area, the first version. The owner asked on 2026-11-20 why it exists. What it holds and why it comes where it does are the agent's engineering call, in section 7. | the order: owner, 2026-11-13 |
| The capture block's second deliverable, the file a finished session is handed over in | Built in the build. The session's record is that file. The capture block keeps the capture itself and the photo store. | `docs/adr/0001`, `0002` |
| Row 8.5, what a GM scanner does when its pack is out of date | Decided: every device fetches the right pack by itself. Built in the build, with the row's two tests (test 2.12). | owner, 2026-11-13 |
| Row 8.11, whether the kit's own machines get a credential | Answered yes. The row's other half, how a device is added to a kit, moves from the players' phones work to the first version's detailed design. It is the owner's decision there. | `docs/adr/0004` |
| Row 8.16, a GM's scan starting a video | Answered by the designer's rules: what a verb does can include what the room does. Built in the build (test 4.11). | `docs/adr/0011` |
| Row 8.17, the GM scanner's redesign | It keeps its place, after show-ready. It gains the transfer between accounts, which the owner placed with the redesign and not before. | owner, 2026-11-13 |
| Row 8.19, the web name and certificate | What depends on the name has changed: every tag's link will hold it. The name itself is needed early. When it is put into service is the owner's decision (section 11). | `docs/adr/0005` |
| The players' phones work | Six parts of it are built in the build: a phone's credential; each device sent only what the pack says it may show; what a device may do worked out from who is asking; the engine's word "entity" in the messages in place of "team"; the tag with the link first; and the player scanner page opened from a link. | `docs/adr/0004`, `0005`; owner, 2026-11-13 |
| The second game's modules | A game's scoring and verbs are the designer's. A developer adds only a capability the engine lacks, once, for every game. | `docs/adr/0011`, `0009` |
| Section 6, "Rollback is physical and immediate: swap back to blue" | No longer true by itself for the hardware scanners. Section 6, and a decision for the owner in section 11. | `docs/adr/0004`, `0005`, `0006` |

## 3. The build, up to show-ready

Eleven areas, in an order in which each needs only areas before it.

Every area is checked against ALN: ALN's pack, ALN's real sessions
from blue, and ALN's room. Every area is also checked against a toy
game that is scored differently from ALN, so that nothing in the
engine depends on ALN's rules.

Each area opens with its detailed design. The design comes to the
owner with the area's size and with whatever in it is the owner's to
decide. The area's tests are written first, from "Each decision and
its test" and from the area's list of pending cases. The area is
finished when they pass on the test bench.

### The test bench, and what the new engine is checked against

- **Built.** The way a test drives the engine from outside, through
  its messages and its pages. The tests themselves come with each
  area. The test rig: one computer with the real video player, music
  player, sound system and lights program, and stand-ins for the TV,
  the speakers, the lamps and the Bluetooth speaker. It was lost when
  the cloud container was reclaimed during the autumn's pause, and is
  rebuilt from its recipe. ALN's real sessions from blue, kept with
  the final scores blue gave. A new toy pack scored differently from
  ALN; today's toy pack uses ALN's formulas. Reference pictures of
  every screen of blue's GM scanner and scoreboard, taken from a copy
  of blue's release running on the rig; blue and its branch are not
  touched. For each later area, its list of pending cases: the
  reproductions in the cause analysis, the truth sweep's census, and
  the fixes made on blue.
- **Needs.** Nothing built. From the owner: session files from blue
  (section 11).
- **Gives.** Nothing a GM sees. Every later area is checked with it.
- **Paused in September and built here.** The rest of the repair of
  the test set-up.
- **Why first.** The owner decided on 2026-11-01 that the rig is built
  when building starts.

### The first version: a scan passes through every part of the new design

Earlier records call this "the thin first version".

- **Built.** The session's record. The game's rules worked out from
  the pack, for the toy pack and for three of ALN's tokens with ALN's
  two verbs written as pack rules. The command that publishes a pack:
  it checks the pack, stamps it and makes it the pack in force. The
  messages, in one definition with a version, the form of a tag's link
  included. Credentials, and how a device is added to a kit. The
  backend assembled in one place. A GM scanner page with the first
  form of its controls: logging in, creating, starting and ending a
  session, creating an account, scanning. It keeps its own copy of the
  record and of the rules, carries on with no connection and hands
  over what it stored. A scoreboard page that is told what to show.
  The player scanner page opened from a link. A stand-in video player
  driven the way all equipment will be, with its restart after a crash
  and the GM's list of what was cut off. The same GM scanner page
  working in an installation with no backend. The firmware's two files
  that build and read messages, changed to the definition.
- **What a person can do with it.**
  1. Start the backend on a laptop with a pack of three tokens.
  2. Open the GM scanner page on a phone, log in, create a session and
     an account, and enter a token, typed or read from a tag.
  3. See the result on the GM scanner, and see the scoreboard page
     change on another screen.
  4. Open the player scanner page from a link like the one on a tag,
     with no login, and see the token's picture.
  5. Turn the phone's Wi-Fi off and enter another token. The result
     shows as "not confirmed". Turn Wi-Fi on. It becomes confirmed.
  6. Take one token on two GM scanners, one of them with no
     connection. The scan that reaches the backend first counts. The
     other GM is told which scan was refused and why.
  7. Stop the backend and start it again. The session, the scores and
     the login are back.
  8. End the session. A scan stored on a GM scanner arrives afterwards
     and lands in that session, marked late. Create the next session.
     Every screen is cleared, and the last session's record is kept.
  9. Open the GM scanner in an installation with no backend. The same
     verbs give the same scores, and the record can be saved.
  10. Let a rule ask the room for a video. A stand-in for the video
      player gets the command. Stop the stand-in half-way. The backend
      starts it again, the crash is a line in the record, and the
      video is on the GM's list to run or drop.
  11. Run the firmware's two files that build and read messages
      against the definition, on a computer.
- **Needs.** The test bench. Four detailed designs come first: the
  form of a line of the record; how a rule and a formula are written
  in a pack, with ALN's rules and the toy's shown to the owner written
  that way before anything is built; the language the messages are
  defined in, and how the firmware's code is checked against it; and
  how a device is added to a kit, which is the owner's decision. From
  the owner as well: the production's web name, because the length of
  a tag's link depends on it (section 11).
- **Gives.** The designer: a game's rules are theirs, shown on two
  packs. The GM: every device agrees on the game's facts, and a lost
  connection never stops a scan. No ALN session runs on it.
- **Paused in September and built here.** Credentials on every
  connection.

### The production's web name put into service, with its certificate

Whether this is built before the cutover is the owner's decision
(section 11). The current roadmap places it with the players' phones
work (row 8.19, the owner's ruling of 2026-09-12). The name itself is
needed either way, in the first version.

- **Built.** What the owner decided on 2026-07-09: the kit brings its
  own network; the backend's computer answers for the name on that
  network; the public name points at the backend's address once; the
  certificate is issued through the domain's DNS and renewed at home
  between events. The devices that run the GM scanner and the second
  scoreboard reach the backend with no warning. One spare tag and two
  phones confirm what the research on tags says.
- **Needs.** The first version. From the owner: access to the name's
  domain.
- **Gives.** Players: an iPhone and an Android phone scan a token the
  same way. The GM: no certificate warning.
- **If the owner leaves it with players' own phones.** This area
  leaves the build. Test 2.31 goes with it. The tags keep the id first
  until then, which every scanner of the new engine reads. The devices
  reach the backend at its fixed address, with the warning accepted
  once on each. When the name is later put into service, every
  device's stored data is tied to the old address, so each is added to
  the kit again.

### A whole game session on the GM scanner, the scoreboard page and the player scanner page

- **Built.** All of ALN's rules as pack rules, the group bonus
  included, and what turns blue's session files into the new record so
  that they can be played again. The rest of the toy pack's rules. The
  game clock and its phases. Every game screen and control of the GM
  scanner, in today's layout: creating, starting, pausing and ending a
  session, scanning, history, the scoreboard, an account's details,
  changing a score, deleting a sale, resetting the scores, the view of
  players' scans, the list of devices. What the owner's decisions add
  to those screens: the "not confirmed" mark, the notice of a refused
  scan, no choice of mode at start-up, what still works when the
  backend is gone. The GM scanner reading a tag whenever it is on
  screen. The scoreboard page complete. The player scanner page
  complete. Every device fetching the right pack by itself, and a page
  with old software reloading itself. Each device sent only what the
  pack says. The session's file. A second backend taking over a
  session from what the GM scanners hold. A game with no backend
  complete: the clock and the scoreboard on the GM scanner, saving the
  record, putting several GM scanners' records together.
- **Needs.** The first version.
- **Gives.** The GM: the game's screens show what the record says, on
  every device and after any reconnect. That is the first of the five
  troubles, for the game's screens. The designer: ALN's whole ruleset
  shown to be pack rules.
- **Paused in September and built here.** A GM scanner fixing its own
  out-of-date pack. The truth sweep's purpose, for the scoring,
  transaction and session screens.

### The room's equipment, each piece driven the same way and shown as it really is

- **Built.** The video player, the music player, sound effects, audio
  routing, Bluetooth, the lights and the TV's browser, each taking
  commands the same way and giving one report: what it is doing,
  whether it is working, and when that was last checked. Playing,
  pausing and stopping a video at a GM's command, and what the TV
  shows: the idle loop, the scoreboard or a video. One part of the
  backend that starts every program, restarts one that crashes a set
  number of times, and stops them all with the backend. The Restart
  button, and putting a piece out of service and back. Not installed
  shown grey. The check of the installation's settings file at start,
  and the refusal to start a session with its typed override. The host
  file. One sequence of steps for power-on, for a restart and for
  resetting the system. Music, lights, volumes and what the TV shows
  coming back after a restart. A copy of the backend started for a
  test leaving the installed one alone. The GM scanner's panels for
  all of this, each worked out from the piece's own report.
- **Needs.** The first version.
- **Gives.** The GM: whether each part works, and panels for the room
  that show what is really happening. Those are the second trouble and
  the rest of the first. The technician: the backend's computer
  powers on into a running system.
- **Paused in September and built here.** Restarting crashed programs
  and the GM's buttons for a fault. The check of the installation's
  settings file. The fixes to "not installed" that were lost during
  the pause. The host file.

### Cues, the video queue and held items

- **Built.** Cues and their timelines, the queue of videos that scans
  and cues ask for, music lowered under a video, and held items. Each
  is changed so that what it did is a line in the record and its panel
  is worked out from the record and the equipment's reports. A verb
  can ask the room for something, and ALN's rule that a player's scan
  of a video token plays its video is a pack rule. A cue never changes
  the game. The GM's list of what a restart cut off or missed,
  complete. Held items dropped when the session ends, or when the
  piece they wait for is put out of service.
- **Needs.** A whole game session, and the room's equipment.
- **Gives.** The GM: the show's panels show what is really happening,
  and after a restart the GM sees what was skipped.
- **Paused in September and built here.** Held items that expire. The
  truth sweep's purpose, for the show's panels.

### The hardware scanner's firmware

- **Built.** The firmware is changed where it stands. It gets a
  credential when the scanner is added to the kit, a version number it
  reports, the time taken from the backend, and a check of the
  backend's certificate. It announces itself to the backend with or
  without a session. It matches a token's id the way every other
  program does, and reads a tag written either way. It shows a player
  the same as the phone page. It fetches the pack's files it needs by
  itself. It takes new firmware over the air when it starts, never in
  a session, with room for two copies, and the backend gains the part
  that offers a firmware file with its version. It says "UPDATE
  NEEDED" when it cannot update. It has a setting for an installation
  with no backend.
- **Designed here.** What the firmware trusts when it checks the
  backend's certificate, and how it gets the time before that check.
  The design must let the certificate change later, when the web name
  is put into service, with no cable (test 2.42).
- **Needs.** The first version and a whole game session. Cues and
  videos, for its tests with video tokens. Green at home with a real
  hardware scanner, for the tests marked "real devices".
- **Gives.** Players: the same on both player scanners. The
  technician: no cable after the cutover's flash.

### The preflight

- **Built.** One check that answers go or no-go before a session, with
  every row traced to a setting. It checks the lights' scenes, the
  sound outputs, the media files a pack names, the computer and the
  pack. It runs from the command line and from the GM scanner, and
  shows on the GM scanner's panel. Every row says whether it was
  checked from files alone or against the running equipment. It states
  what only a person can check, with the short list for that person.
  It lists a hardware scanner that is out of date, counts the scanners
  and scoreboards that are connected, and says whether the TV's
  scoreboard page is really showing.
- **Needs.** The room's equipment, and cues and videos. For its rows
  about hardware scanners, the firmware's version number and its
  announcing itself.
- **Gives.** The GM and the technician: one answer before a session.
  That is the rest of the second trouble and of the fifth.
- **Paused in September and built here.** The preflight's checks, its
  command line and its panel.

### The config tool's link to the engine, the tag tools, the checks after a session and the report

- **Built.** The config tool publishes a pack with the same command as
  the first version's, and saves an installation's settings through
  the engine's definitions. It stops writing the backend's files and
  signing logins with the backend's secret. Its screen for ALN's base
  values and type multipliers is kept and edits the same numbers,
  which become tables that ALN's formulas read. The tag tools write
  and read tags with the link first. The checks after a session read
  the record. The report is made from the record: its structure is
  fixed in the engine and its wording comes from the pack, as the
  owner ruled on 2026-08-29, and its form stays pinned by a test, the
  ★ included, until ALN's Director Console reads the session's file
  (row 8.10). It can be downloaded in a game with no backend too.
- **Needs.** A whole game session, and cues and videos.
- **Gives.** The technician and the designer: the config tool goes on
  working with the new engine. The director: the same report, from one
  record.
- **Not built here.** The config tool's screens for verbs and
  formulas. They belong to the config tool's pages for previewing a
  game (section 5).

### Releasing and installing the engine, and ALN's content and settings in the new form

- **Built.** A release: one numbered package that holds the backend,
  the pages it serves and the firmware it offers to hardware scanners.
  Installing one, and going back to the one before. Every program
  reporting the release it runs. The pages for an installation with no
  backend, as a set of files that can be put where that installation
  keeps its pages. The deployment guide rewritten for the new engine:
  installing it, adding each device to the kit, updates over the air,
  going back. With it the tidying of documents the owner ruled into
  the truth sweep on 2026-09-12: old investigation files archived or
  deleted, and a guide's "last verified" date changed only when it was
  really verified. ALN's pack complete in the new form. ALN's
  installation settings in the new form: its equipment, its audio
  routes and playlists, its network values. ALN's Notion sync
  producing the new form of pack. The steps for updating ALN's tokens
  before a game. ALN's media listed in the pack and carried
  separately.
- **Needs.** Every area above.
- **Gives.** The technician: updating a kit and going back are one
  step each.

### Moving ALN to the new engine

- **Done here.** Green, with the new engine installed from the new
  guide, passes the hardware pass at home, with the tests marked "real
  devices". The cutover plan with its way back is written and comes to
  the owner. Each hardware scanner that will serve the new engine is
  flashed once by USB. Each device is added to the kit. One full
  rehearsal at the venue, the way back included. The list of what
  looks or works differently is rewritten for the new engine from the
  reference pictures of blue's screens, the border of the transaction
  card among them, and reviewed by the owner as GM. Then the owner
  decides. At the cutover, and not before, the public copies of the GM
  scanner and the player scanner page that ALN keeps for a game with
  no backend are replaced with the new ones. After the cutover blue
  stays frozen for the first events. The tags are rewritten with the
  link first once the owner calls the new engine good and the web
  name is in service.
- **Needs.** Every area above.

Which areas could be built at the same time follows from the needs
above. A whole game session and the room's equipment need only the
first version, and so does putting the web name into service. The
preflight and the area with the config tool's link do not need each
other. Whether areas are built side by side is one of the readings in
section 11.

## 4. Show-ready, restated

Deploying ALN on the new engine becomes the owner's choice when all
four hold:

1. **Hardware-proven**, as the current roadmap defines it: green is
   built from the guide and passes the hardware pass at home.
2. **The build is finished.** Every test in "Each decision and its
   test" that has no mark passes on the test bench. Every test marked
   "real devices" passes on green at home with the new engine
   installed from its guide. If the owner leaves the web name with
   players' own phones, test 2.31 is not among them. ALN's real
   sessions give the same final scores. The report keeps its form.
3. **One full rehearsal at the venue**, with the cutover plan's way
   back rehearsed too.
4. **The owner has reviewed, as GM, the list of what looks or works
   differently.** The current roadmap's list of sixteen (its Appendix
   B) is rewritten for the new engine before this.

## 5. After show-ready

The order of the current roadmap stands, and so does what the owner
ruled into each piece of work. Each is named here by what it does,
with the current roadmap's name for it after.

- **Recording a session as it is played** (the capture block). The
  roster before the game, notes and photos during it, the accusation
  at the end. They become lines in the session's record, which the
  build has already made. Roster, notes and the accusation come first
  and photos second, as the owner ruled. Somewhere to keep photos is
  still to design. Whether this comes before or after the next item is
  decided once it is sized, as the current roadmap says.
- **The config tool's pages for previewing a game** (the preview
  block). It reaches previewable. Its contents are the candidate the
  owner ratified: the page that manages packs, the editor for a game's
  mechanics together with applying a pack without restarting the
  backend, a rehearsal on a copy of the backend, and a first-run path
  with the toy pack. Its final contents wait on the open questions in
  the design of the config tool's structure, as the current roadmap
  says. The editor now covers a game's verbs and formulas as well as
  its values. The GM scanner's redesign is designed beside it. The
  secrets in today's repository are changed before the first outside
  person uses it.
- **The rest of the config tool's pages** (the depth-and-close block).
  Everything the owner ruled in stays in: the editor for texts and
  look with its preview on a real device; the show's cues on a
  timeline of true length; the content view; the editor for the
  equipment a game needs and the view of what a venue must bring; the
  page that ties a pack's names to a venue's real equipment, and the
  small page that manages installation settings. All five pages are
  built, each after a drawn mock-up the owner has seen, and anything
  put off gets a row the owner approves. It ends with the check that
  no temporary shortcut recorded in the project is left without
  someone named to remove it.
- **Players' own phones.** What is left after the build: what a player
  sees when a token arrives on their own phone, actions that take two
  tokens, which phones are accepted, and how many phones one kit can
  carry. The web name put into service too, unless the owner places
  it before the cutover.
- **The second game.** The capabilities it needs that the engine does
  not have (a score read off a graph, state that spreads between
  players, its own screen), each added once for every game. The
  platform delivers all of them, and the game's design goes at the
  owner's pace.
- **Tools for writing a game's content.** Replacing Notion with an
  interface for a game's whole content: tokens, characters, timeline,
  puzzles. Uploading a game's media files.
- **Running kits and the public release.** It reaches adoptable.
  Before anything is public: a licence is chosen, the documents are
  written for people and checked for private details, and the privacy
  rules are stated. The secret that is a tracked file in today's
  repository is removed from its files and from its history by then at
  the latest, as the current roadmap rules. The engine's new
  repository never holds it. One cost bears on the licence: the
  hardware scanner's firmware uses two libraries under the GPL,
  version 3. Publishing the firmware means either publishing it under
  the GPL or replacing those two libraries first. That choice is the
  owner's, made with the licence.

## 6. The cutover, and the way back

What the current roadmap says (its section 6, the owner, 2026-08-29).
The cutover is a swap of computers. Green is built as a real
production computer. Blue stays untouched until then and frozen for
the first events after. Green takes the backend's address, "so
scanners, tablets, and hardware scanners never notice the machine
changed". And: "Rollback is physical and immediate: swap back to
blue".

Three of the owner's decisions of 2026-11-13 change the last two
sentences. The agent did not say so when they were made.

- The hardware scanners get new firmware, flashed once by USB
  (`docs/adr/0006`). Blue cannot talk to a scanner on the new
  firmware, and by the owner's decision nothing in the new engine has
  to work with an old part.
- Every device gets its credential from the new backend
  (`docs/adr/0004`).
- The tags get the link first (`docs/adr/0005`). Blue's firmware reads
  only a tag with the id first.

What going back to blue now takes, part by part:

- **The backend's computer.** Swap back to blue. Immediate, as before.
- **The devices that run the GM scanner, and the second scoreboard.**
  Open blue's address again. This is immediate as long as the new
  engine is never served at blue's own address and port, because a
  browser keeps each address's data apart. The cutover plan must hold
  to that.
- **The hardware scanners.** Each needs blue's firmware flashed back
  by USB, with a laptop. Or blue keeps a set of its own that is never
  flashed. This is a decision for the owner (section 11).
- **The tags.** Nothing to undo. The new firmware reads a tag written
  either way, so the tags are rewritten only after the owner calls the
  new engine good. Once they are rewritten there is no going back to
  blue. The current roadmap has blue frozen and then wiped by that
  time.

Rehearsals at the venue meet the same fact. The current roadmap
rehearses with the real kit and swaps back before leaving. A venue
scanner flashed for a rehearsal has to be flashed back before blue's
next session.

The rule for borrowing a component for a test (the owner, 2026-08-29):
piece by piece, each with one line saying safe or risky and how to
restore it, and "never a change that could affect a component's
in-game function". The lines, restated for the new engine:

| Component | Line |
|---|---|
| Bluetooth speaker | Safe. Pairing is stored on each computer, so pairing with green cannot disturb the venue's pairing. |
| Smart bulb | Risky. Pairing a venue bulb with green's Home Assistant can un-pair it from the venue's. Use a bulb from home. |
| Hardware scanner | Risky, where it was reversible. It can no longer be lent to the new engine by editing its settings: it needs the new firmware by USB, and blue's firmware by USB to return. Do not borrow one that blue needs, unless the owner decides otherwise in section 11. |
| A game's tag | Never rewrite one before the owner calls the new engine good. Blue's scanners cannot read a tag with the link first. Use spare tags. |
| A device that runs the GM scanner | Safe, as long as the new engine is not served at blue's address and port. |
| The second scoreboard | Reversible. Point its browser at the new scoreboard. To restore, point it back and check that blue's scoreboard shows. |

## 7. How the build is carried out

These are the agent's engineering calls. Each one follows from the
design, and its reason is given. The owner can overrule any of them.

- **The order of the areas, and what the first version holds.** The
  owner's decisions changed how a session is kept, where the rules
  come from, what the messages are and who may connect. Every other
  part of the engine reads and writes through those. A line of the
  record is what a rule produces, what a message carries and what a
  screen is worked out from, so those parts can only be shown to fit
  by passing one scan through all of them, on a backend, a GM scanner
  and a screen together. That is the first version. After it each area
  builds one part together with the screens that show it, so that each
  area's tests can pass when the area is finished.
- **Today's code.** Where one of the owner's decisions changed how a
  part works, that part is written to the decision. So the session
  store, how a scan is handled, the messages and the GM scanner's own
  copy of the rules are written new. Where no decision touched a
  part, its code is kept: the code that drives the video player,
  music, sound, audio, Bluetooth, lights and the TV's browser, and the
  firmware. Kept code is changed where the design needs it. The owner
  decided on 2026-11-01 that where today's code is changed in place,
  what it does today is pinned down by tests first. That holds for the
  firmware and for the equipment code alike: tests from outside, on
  the rig, pin what each does before it is changed. Today's own tests
  of that code mostly reach inside it (59 of the backend's 110 unit
  test files load a service file directly), so they are rewritten to
  work from outside or dropped. Each area's detailed design lists what
  is new and what is kept. The table by program is in
  `2026-11-13-how-todays-code-moves.md`, section 2.
- **Where the code is kept.** Two decisions settle it: one definition
  that every program is checked against, and the same rules code in
  the backend and in the GM scanner. Programs that must agree at every
  change are kept and released together, in one repository. The
  hardware scanner's firmware agrees with them through a handful of
  messages, is built with other tools, carries 86 MB of copied
  libraries and serves one kind of hardware. It keeps its own
  repository and is checked against the definition each release
  publishes. ALN's pack, media and tools are ALN's and stay outside
  the engine.
- **A new repository for the engine.** The end is a public platform
  with nothing of any one game in it and no secret. Today's repository
  holds ALN's content and tools beside the engine, and a live secret
  as a tracked file. Building in a folder of it would put two of every
  program side by side for the whole build, run every old test on
  every change, and need its history rewritten when the engine is
  lifted out. So the engine's code starts in a new repository. Each
  file moved names the commit it came from. Creating the repository
  needs the owner's account (section 11).
- **A release is one numbered package.** Today the installed game is
  several separately versioned checkouts, a folder built on the
  backend's computer, and files copied by hand. Going back a version
  leaves parts of the newer one in place (the cause analysis, cause
  15; test 6.23). A technician installs one package and goes back by
  installing the one before, and every program says which release it
  runs. The steps for an emergency on a game day are rewritten for
  this in the guide. One thing a package does not solve: the programs
  the backend drives are installed on the computer by the guide's
  steps, under names that belong to one release of the operating
  system. The preflight checks the computer and names what is missing.

## 8. The hardware the engine requires and supports

The owner said on 2026-11-02 that the design must allow other hardware
later, and that the roadmap sets which hardware it requires now. The
list was to come with the build plan. This is the agent's proposal,
for the owner to confirm or correct (section 11).

| State | The engine requires | Proven with |
|---|---|---|
| Show-ready, a game with a backend | One computer running Linux, with the programs the backend drives installed as the guide says: the video player, the music player, the sound system, Bluetooth, a browser, and Home Assistant where lights are used. A Wi-Fi network that belongs to the kit. One device with a recent browser for each GM, reaching the backend over a secure connection. Reading tags on it needs an Android device with Chrome. | ALN's kit: a Raspberry Pi 5 on Raspberry Pi OS Trixie, the only system the guide covers; the kit's router; two Android tablets. Video files must be in the format a Pi 5 can decode. |
| Show-ready, only when the pack and the installation's settings ask for it | A screen on the backend's computer for video and the scoreboard. Speakers, by cable or Bluetooth. Lights that Home Assistant can drive. Hardware scanners. A second screen with a browser. Tags. | A TV on HDMI; a W-KING X10 Bluetooth speaker; Home Assistant scenes; three hardware scanners (an ESP32-2432S028R board with an MFRC522 reader); a Raspberry Pi 4 as the second scoreboard; ALN's tags, of which the one whose contents are on record is an NTAG215. |
| Show-ready, a game with no backend | One Android device with Chrome for each GM. Player scanners if the game uses them. Somewhere the installation's pages are kept, which is part of the owner's decision on how a device is added to a kit. | The same tablets and scanners. Today ALN's pages for this are kept on a public web host. |
| Previewable | A computer for the designer that runs the config tool and a copy of the backend with stand-ins. Which operating systems is decided when those pages are designed. Today the backend runs on Linux. | Not yet proven. |
| Players' own phones | iPhones and Android phones that open a tag's link by themselves. The production's web name in service. Which phones are accepted is row 8.12. | Not yet proven. |
| Adoptable | A published list of the basic hardware for a stranger. The current roadmap leaves a second kit and its costs deliberately unplanned. | Not yet written. |

No hardware is named inside the engine's code. A pack names the kinds
of equipment it needs, and an installation's settings say what is
there (the roadmap's rule 2.2).

## 9. The roadmap's registry of deferred items, row by row

| Row | The item | Where it stands after this revision |
|---|---|---|
| 8.1 | Checking that the media a pack names exists, and showing what a pack needs | The page that manages packs, in the config tool's pages for previewing a game. The preflight separately checks that named files are present. |
| 8.2 | A speaker named inside ALN's pack, which the owner ruled is to be removed | The same page, as before. The debt stays recorded until then. |
| 8.3 | Where the idle loop's video is named | The pack's half goes with row 8.1, as before. |
| 8.4 | A view that answers "what does bringing this hardware unlock?" | A later piece of work on venue tools, as before. |
| 8.5 | A GM scanner whose pack is out of date, and two tests | Answered and built in the build: a whole game session, test 2.12. |
| 8.6 | Applying a changed pack without restarting the backend | One piece of work with the mechanics editor, as before. Until then a published pack is taken up when the backend next starts, between sessions, as today. The build makes the ground for it: the pack is read at one moment, and every device fetches the right one. |
| 8.7 | The documentation audit of 2026-06-18 | A sorting of what is still open, with the rest of the config tool's pages, as before. The guides are rewritten for the new engine in the build, which closes part of it. |
| 8.8 | Screens of a new kind that a pack defines | The second game's work, as before. |
| 8.9 | Reading a game's content from sources other than Notion | Tools for writing a game's content, as before. |
| 8.10 | ALN's report pipeline reading the session's file | At the owner's pace. The session's file is now written in the build, so the first real one exists at the cutover. Until the Director Console reads it, the report keeps its exact form, the ★ included, pinned by a test. |
| 8.11 | Whether the kit's own machines get a credential | Answered yes. How a device is added to a kit is decided by the owner in the first version's detailed design. |
| 8.12 | Which phones and browsers are accepted | Players' own phones, as before. |
| 8.13 | Questions on managing accounts and players, and on what players can do | Partly answered by `docs/adr/0011`: what an account is and the verbs are the designer's. The rest, as before. |
| 8.14 | Hardware scanners finding the backend by themselves | Parked, as before. |
| 8.15 | A second game of ALN's kind | Running kits, as before. |
| 8.16 | A GM's scan starting a video | Answered and built in the build: cues and videos, test 4.11. |
| 8.17 | The GM scanner's redesign | After show-ready, as before. It carries the transfer between accounts, a control to advance the phase by hand, and cue times set from a phase. |
| 8.18 | Loading a saved set-up in the config tool refuses the whole load for a fault it did not cause | With the config tool's pages for previewing a game, as before. If the build's change to how the config tool saves settings rebuilds that load, the fix is made then. |
| 8.19 | The web name and certificate | The name itself: stated by the owner for the first version. Putting it into service: the owner's decision, section 11. |

Three more items. The second scoreboard as a piece of equipment the
installation's settings count (ruling R21) is built in the room's
equipment and checked by the preflight. Working out how many phones a
kit can carry stays with players' own phones. And the Wi-Fi password
in today's repository: the owner put off removing it on 2026-09-12,
and it has no row. Proposed: it goes with the other secrets, changed
before previewable and removed from the files and the history before
anything is public (section 11).

## 10. The project's list of temporary shortcuts

The project keeps a list of temporary shortcuts in the code, each with
what removes it (`docs/plans/PHASE3-STATUS.md`). The rule is that none
is left without someone named to remove it. After this revision:

| Shortcut | What removes it |
|---|---|
| L2, L9: the GM scanner falls back to scoring values built into it | The build. The new GM scanner has no such fallback: a pack with no usable rules is refused. |
| L6: both sides fall back to a built-in table of ALN's modes | The build, for the same reason. |
| L3: the player scanner page reads the pack only to show which one it has | The build. The page is sent what the pack says its kind may show. |
| L4: the word "team" stays in the messages | The build. The messages are written new and use the engine's word, entity. The current roadmap had this with the players' phones work. |
| L14: the tag tools load fonts from the internet | The build, when the tag tools are rebuilt. |
| L15: publishing from the config tool writes into the pack's folder with no record of the change | The build, when the config tool's publishing is rebuilt. If part is left for the page that manages packs, the line stays open under that page. |
| L7: lighting falls back to scene names written in the pack | The page that ties a pack's names to a venue's equipment, as before. |
| L8: a speaker named in ALN's pack | The page that manages packs, as before. |
| L12: the idle loop's file is read from the engine's settings when the installation's settings do not name it | The same page as L7, as before. |
| L13: ALN's wording inside the report's fixed structure | Row 8.10, as before. |
| L16: a throwaway first try at the page that manages packs | That page, as before. |

## 11. What is the owner's in this revision

1. **To sign off this revision**, or send it back. The amended roadmap
   keeps every rule's text as it is. Where a rule has only a title,
   such as "Growth without corners" or "The engine holds no opinion",
   the amended roadmap puts the rule's first sentence from section 1
   before the title and keeps the title after it, so earlier records
   can still be found.
2. **The way back for the hardware scanners** (section 6). Two ways.
   Either the new engine gets hardware scanners of its own, and
   blue's three stay as they are until blue is retired. Going back is
   then a swap again, and a rehearsal never touches a scanner blue
   needs. It costs as many more scanners as a session uses, built
   before the first venue rehearsal; afterwards they are the
   production's spares. Or the venue's three are flashed for each
   rehearsal and for the cutover, and flashed back to return. That
   needs no new hardware. Each return is three flashes by USB before
   blue can run a session, and each rehearsal changes devices blue
   needs. Recommended: scanners of its own, because the owner's rule
   for borrowing forbids "a change that could affect a component's
   in-game function". One fact is needed either way: how many spare
   hardware scanners there are.
3. **The production's web name, in two parts.** First, the name
   itself. It is needed for the first version whatever is decided
   next, because the length of a tag's link depends on it. A hardware
   scanner reads a tag in one read only if the link after `https://`
   is 36 characters or fewer, the token's id included. The example in
   the owner's decision of 2026-07-09, `play.aboutlastnightgame.com`,
   fits with a short path. The owner states the name. Second, when
   the name is put into service. The owner placed this with the
   players' phones work on 2026-09-12. Since 2026-11-13 more depends
   on it: every tag's link holds the name; what a device has stored
   is tied to the address it reached the backend at, so a change of
   address later means adding every device to the kit again; and the
   two phones cannot be tried with a real tag until it is in service.
   Recommended: before the cutover, as its own area after the first
   version. It asks of the owner access to the name's domain, and the
   renewal at home between events that the owner decided on
   2026-07-09.
4. **How a device is added to a kit.** It comes to the owner in the
   first version's detailed design, with its options. It now also
   covers an installation with no backend: where its pages are kept,
   and what answers a tag's link there.
5. **The hardware list** (section 8), to confirm or correct. And one
   fact: any device the owner expects to use soon that is not in
   ALN's kit.
6. **Five readings of the agent's, to correct if wrong.**
   - A pull request for each repository an area touches, merged by
     the owner, with each area read as the block the rule of
     2026-09-12 speaks of.
   - The tests that need a real hardware scanner, phone or tag are
     proven on green at home, since the test rig has none.
   - Areas that do not need each other may be built at the same time,
     under the rule for parallel work the owner set for the hardening
     block on 2026-09-12 (ruling R15).
   - The reviews the owner agreed for the hardening block on
     2026-09-12 (ruling R26) apply to each area: its detailed design
     is attacked before building, each task gets a reviewer and a
     tester who tries to break it, one review of everything comes
     before the venue rehearsal, and one after it for whatever changes
     then.
   - A phone's credential "lasts for one session" is read as: it is
     not carried into the next session, and a phone is given one even
     when no session exists, so that it can show a memory.
7. **One small placement to approve.** The Wi-Fi password in today's
   repository goes with the other secrets (section 9).
8. **Three needs when the build starts.** A few session files from
   real ALN sessions on blue, with the report downloaded for each, and
   which pack and which of blue's versions each ran. The go-ahead to
   create the engine's repository. And green built and through its
   hardware pass before the hardware scanner's tests are due.

To know, with nothing to decide. By the current roadmap the GM
scanner's redesign comes after show-ready, so GMs get today's layout
at the cutover, with what the owner's decisions add. One fact is new.
The game screens are built around ALN's fields and two modes, so the
build writes them new, and the redesign then writes them again. The
agent would keep the order: a changed instrument in a GM's hands at
the cutover is the risk the show-ready conditions exist for. The
order stands unless the owner changes it.

One question of 2026-11-01 is still unanswered, and nothing in the
build depends on it: whether paper documents join the pack, with
"unlocked" recorded during play. It is asked again when recording a
session is designed.

## 12. The five documents, and the conditions for ending the design

The owner decided on 2026-10-30 what the design hands over and when it
ends. Where each stands:

| Document | Where it is |
|---|---|
| The rules, each with a test in plain words | `2026-11-20-each-decision-and-its-test.md`, sections 1 to 5. They go by decision and not by the pass's nine questions. That is the agent's call of 2026-11-02, which the owner can overrule. |
| The cause analysis, with every finding assigned | `../2026-10-30-cause-analysis.md` assigns each of its 358 findings to one of sixteen causes or sets it aside. Section 7 of the tests document assigns each cause to what removes it and to its tests. |
| Proposals for the two contract files | Overtaken by the one definition of the messages, which is written in the first version's detailed design, before any code. The agent's call of 2026-11-02, as above. |
| Decision notes | `docs/adr/0001` to `0011`. |
| The new roadmap | This document. |

| Condition for ending | Where it stands |
|---|---|
| Every finding and every fix made on blue is assigned to a rule, or set aside with a reason | The tests document, section 7. |
| Every rule says how it serves the planned capabilities and standalone games | The tests document, section 8. |
| The review's blocking findings are resolved | The method names a review by two reviewers with different angles, with each finding checked (`../DECISIONS.md`, "The design half's method and tools"). One independent reader checked the first drafts. Two with different angles checked the second. The agent checked every finding against the records. Each finding and what it changed is in `2026-11-20-the-check-of-the-two-drafts.md`. |
| Every question has a rule and a test | Overtaken: the rules go by decision. The agent's call of 2026-11-02. |
| The rig reproduces each finding marked for proof | The owner decided on 2026-11-01 that the rig is built when building starts. Reading that as overtaking this condition is the agent's call of 2026-11-02, which the owner can overrule. The findings become tests of the areas (the tests document, section 6). |
