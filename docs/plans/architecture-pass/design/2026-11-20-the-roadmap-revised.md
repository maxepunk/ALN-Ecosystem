# The roadmap, revised (draft for the owner, 2026-11-20)

Status: draft. It is the second of the two documents the design hands
over (the program document, sections 5 and 7). When the owner signs it
off, `docs/plans/ROADMAP.md` is amended in place. The roadmap as it
stands today is its fourth revision, called r4 below. The amended one
is r5, and the r4 text stays in git history. Until then `ROADMAP.md` is not edited.
The first document is `2026-11-20-each-decision-and-its-test.md`.

## 1. What stays as it is

Each line below is a rule or a fact of the current roadmap, written
out. The section it comes from is named after it, so a reader can
check the wording there.

What the work is for (section 1 of `ROADMAP.md`):

- The end is a platform released as open source. A designer builds a
  whole game as a pack inside the config tool, without touching code
  or settings files. A technician installs it at a venue. A GM runs
  it. Players play by tapping tokens, with no account and no app.

Rules that bind every piece of work (section 2):

- Players never have accounts or logins. The only identity the engine
  keeps is a device's or a session's, unless a game's own design asks
  a player for more. A session's data stays on the kit unless the
  owner moves it, and the owner decides how long it is kept. (2.1)
- Nothing that is built may assume there is only one kit, one pack or
  one production, where avoiding that assumption costs little. A pack
  and an installation's settings are chosen by name or path, never
  taken to be the only ones. (2.2)
- Media files are never stored in a pack. A pack lists the files it
  needs, and the files are carried separately. (2.3)
- A designer changes a game's values in the config tool, applies the
  change and plays it. The roadmap makes the tool's editor and
  applying a pack without restarting the backend one piece of work.
  (2.4)
- The phone page and the hardware scanner can do the same things for a
  game, though they look different. Nothing a designer changes may
  need a hardware scanner re-flashed. (2.5)
- The engine takes no side on a game's design. Who is identified, how
  many scanners there are and what is tracked are set by the pack and
  the kit. (2.6)

The five states the work is steered by (section 3). A decision to
deploy or to share is made at a state:

- **Coherent on main.** Everything built before this pass is merged
  and passes its tests. Reached on 2026-09-12.
- **Hardware-proven.** A second computer, built from the guide, passes
  the test on real equipment at home.
- **Show-ready.** Deploying ALN on the new engine is the owner's
  choice to make.
- **Previewable.** A designer who did not build the engine can open
  the config tool, change the toy game and rehearse it.
- **Adoptable.** A stranger can set the platform up and learn it.

The five troubles the owner named, which the work is ordered to remove
(section 4): the GM scanner's panels showing something other than what
is really happening; not knowing whether each part works; piecing a
session together afterwards from photos and notes; the GM scanner's
layout being unhelpful in the middle of a game; and needing a
technician to get from power-on to a running show.

Also unchanged:

- Blue runs every ALN session until one cutover. No date governs the
  work.
- What each later piece of work is for: recording a session as it is
  played; the config tool's pages for previewing and editing a game;
  players' own phones; the second game; tools for writing a game's
  content; running kits and the public release.
- Each piece of work gets its size when its detailed design is made,
  and the owner approves the size before building.

## 2. What the pass changed

The current roadmap has two pieces of work that were paused in
September. It calls them the hardening block (restarting crashed
programs, saying whether each part works, the preflight) and the truth
sweep (proving that every screen shows what is really happening). Both
are replaced by **the build**: changing the engine to match the design
the owner decided between 2026-11-10 and 2026-11-20 (the proposal's
seven changes; `docs/adr/0001` to `0011`). The owner ratified how the
build runs on 2026-10-30: one area at a
time, each area with its detailed design just before it is built and
its tests written first, finished when every test passes on the test
rig. It is the engine work that must land before green can replace
blue.

Items of the r4 roadmap that the owner's decisions moved or answered:

| r4 | What changed | By |
|---|---|---|
| The parts of the hardening block that were never built (credentials, restarting crashed programs, a GM scanner fixing its own out-of-date pack, the preflight, the check of an installation's settings at start) | Built inside the build's areas, section 3 | owner, 2026-10-30 |
| The truth sweep | Its purpose is met in the build. Every screen is worked out from the session's record, and a capture of every screen is checked against the record | owner, 2026-10-30; `docs/adr/0001` |
| The capture block's second deliverable, the file a finished session is handed over in | Built in the build. The session's record is that file. The capture block keeps the capture itself and the photo store | `docs/adr/0001`, `0002` |
| Row 8.5, what a GM scanner does when its pack is out of date | Decided: it fixes itself. Built in the build | owner, 2026-11-13 |
| Row 8.11, whether the kit's own machines get a credential | Answered yes | `docs/adr/0004` |
| Row 8.16, a GM's scan starting a video | Answered by the designer's rules: what a verb does can include what the room does | `docs/adr/0011` |
| Row 8.17, the GM scanner's redesign | Gains the transfer between accounts. Its place is a decision for the owner, section 8 | owner, 2026-11-13 |
| Row 8.19, the kit's real name and certificate | Needed earlier: the name is written into every tag once the link comes first. Its place is a decision for the owner, section 8 | `docs/adr/0005` |
| The players' phones block | Part of it is built in the build: a phone's credential, the tag with the link first, the phone page opened from a link | `docs/adr/0004`, `0005`; owner, 2026-11-13 |
| The second game's modules | A game's scoring and verbs are the designer's. A developer adds only a capability the engine lacks | `docs/adr/0011` |
| Section 6, "going back is immediate: swap back to blue" | No longer true by itself. Section 6 below | `docs/adr/0004`, `0005`, `0006` |
| One pull request for each repository touched (2026-09-12) | One for each change, section 7 | follows from `docs/adr/0007` |

## 3. The build, up to show-ready

The areas are in the order in which each needs the ones before it.
Every area is checked against ALN: ALN's pack, ALN's real sessions
from blue, and ALN's room. Every area is also checked against the toy
game, which is scored differently from ALN, so that nothing in the
engine depends on ALN's rules.

Each area opens with its detailed design, which comes to the owner
with its size and with whatever in it is the owner's to decide. Its
tests are written first, from `2026-11-20-each-decision-and-its-test.md`.
It is finished when they pass on the rig.

| Area | What is built | It needs | Who it serves | What was paused in September and is built here | Tests |
|---|---|---|---|---|---|
| The test rig, and what to check against | The test rig: a computer set up with the real video and music players, and software standing in for the speakers, lights and TV. ALN's real sessions from blue, made usable as a check. A new toy game scored differently from ALN. | Nothing | Every later area | The rest of the repair of the test set-up | These are what the other areas are checked with |
| The session's record, the rules and the messages | The session's record. The game's rules worked out from the pack, with ALN's rules written as pack rules. The messages, in one definition. Credentials. The GM scanner holding a copy of the record and carrying on without the backend. A game with no backend. The session's file. | The test rig | The designer: a game's rules are theirs. The GM: every screen agrees on the game's facts, and a lost connection never stops a scan. | Credentials | Sections 1 and 3, and the rules in 4 |
| The room's equipment | The video player, music, sound, audio routing, Bluetooth, lights and the TV browser, all controlled the same way. Restarting a crashed program, with the buttons a GM has when it cannot. Gear not installed shown grey. The check of the installation's settings at start. One start-up sequence, so the computer powers on into a running system. What comes back after a restart. A copy of the backend started for a test leaves the installed one alone. | The record and the messages | The GM: whether each part works. The technician: power-on to a running show. | Restarting crashed programs and the GM's buttons for a fault; the fixes to "not installed" that were lost in September; the check of an installation's settings at start; the file that sets how each program is restarted | Section 5, and restarts in 4 |
| Cues, video, music and the clock | Cues and timelines, the video queue, music, the game clock and its phases, the TV's modes and held items, each fitted so that what it did is in the record and its panel is worked out from the gear's own report. A verb can ask the room for something. | The record, the messages and the room's equipment | The GM: the panels for the room show what is really happening. | | Sections 1 and 4, captures of the room's panels |
| The GM scanner | Its game screens and its panels, worked out from the record. The preflight, in the panel and from the command line. A capture of every screen checked against the record. The transfer between accounts. | The three areas above | The GM | The preflight's checks, its command line and its panel; a GM scanner fixing its own out-of-date pack; the screen checks | Sections 1 to 4 as a GM sees them |
| The player scanners and the scoreboard | The player scanner page, opened from a tag's link. The hardware scanner's firmware: a credential, a version, the time from the backend, both tag layouts, updates over the air, a setting for no backend. The scoreboard. | The record and the messages | Players. The technician: no cable after the cutover. | | Section 2 |
| The config tool, the tag tools, the checks and the report | The config tool working through the engine's definitions and no longer writing the backend's files. The tag tools. The post-session checks reading the record. The report made from the record in the form the owner ruled. | The record and the messages | The designer, the technician, the director | | Sections 2 and 4 |
| Moving ALN to the new engine | Green proven on hardware with the new engine. The kit's real name and certificate. The cutover plan with its way back. One full rehearsal at the venue. The owner's review as GM. | Everything above | ALN | | Real devices |

The room's equipment and the player scanners can be built at the same
time, once the record and the messages exist. The rest follow in the
order shown.

## 4. Show-ready, restated

Deploying ALN on the new engine becomes the owner's choice when all
four hold:

1. **Hardware-proven.** Green is built from the guide and passes the
   home hardware pass with the new engine: real video, real sound and
   speaker, real lights, tags read over a secure connection on a real
   tablet, a hardware scanner updated and synced, the preflight.
2. **The build is finished.** Every test in "Each decision and its
   test" passes on the rig, on ALN's pack and on the toy pack. ALN's
   real sessions give the same final scores. The report keeps its
   form.
3. **One full rehearsal at the venue**, with the cutover plan's way
   back rehearsed too.
4. **The owner has reviewed, as GM, the list of what looks or works
   differently.** r4's list of sixteen is rewritten for the new
   engine before this.

## 5. After show-ready

The order of r4 stands. Each piece of work is named here by what it
does, with r4's name for it after.

- **Recording a session as it is played** (r4: the capture block).
  The roster before the game, notes and photos during it, the
  accusation at the end. They become lines in the session's record,
  which the build has already made. Somewhere to keep photos is still
  to design. Whether this comes before or after the next item is
  decided once it is sized, as r4 says.
- **The config tool's pages for previewing a game** (r4: the preview
  block). It reaches previewable. Its editor now covers a game's
  verbs and formulas as well as its values. A designer changes
  something, applies it and plays it, and a rehearsal runs on a copy
  of the backend that leaves the installed one alone.
- **The rest of the config tool's pages** (r4: the depth-and-close
  block). Texts and look, the show's cues on a timeline, the content
  view, the equipment a game needs, and the pages a technician uses to
  tie a pack's names to a venue's real equipment. It ends with the
  check that no temporary shortcut recorded in the project is left
  without someone named to remove it.
- **Players' own phones.** What is left after the build: what a player
  sees when a token arrives on their phone, actions that take two
  tokens, and how many phones one kit can carry.
- **The second game.** The capabilities it needs that the engine does
  not have (a score read off a graph, state that spreads between
  players, its own screen), each added once for every game. Its design
  goes at the owner's pace.
- **Tools for writing a game's content.** Replacing Notion with an
  interface for a game's whole content: tokens, characters, timeline,
  puzzles. Uploading a game's media files.
- **Running kits and the public release.** It reaches adoptable. The
  engine's repository is made public here. Before that: the secret
  that is in today's repository is dealt with, the documents are
  checked for private details, and a licence is chosen. The hardware
  scanner's firmware uses two libraries under the GPL licence, so the
  firmware itself must be released under the GPL.

## 6. The cutover, and the way back

r4's section 6 stands in this: the cutover is a swap of computers,
green is built as a real production computer, blue stays untouched
until then and frozen for the first events after.

What changes: three decisions of 2026-11-13 mean the scanners do
notice. The hardware scanners get new firmware and blue cannot talk to
them. Every device gets its credential from the new backend. Tags are
rewritten with the link first, and blue's firmware reads only a tag
with the id first.

So the cutover plan has to say how to go back, and the rehearsal has
to try it. What keeps a way back: the new firmware reads tags written
either way, so the tags are rewritten only when the owner calls the
new engine good; some hardware scanners stay on the old firmware until
then; a rehearsal at the venue uses spare scanners. The plan is
written in the last area and comes to the owner.

## 7. How the build is carried out

These are the agent's engineering calls. Each follows from the design.
The owner can overrule any of them.

- **Today's code.** Where one of the owner's decisions changed how a
  part works, that part is written to the decision. Where none touched
  it, it is kept and moved across with its tests. So the session
  store, how a scan is handled, the messages and the GM scanner's own
  copy of the rules are written new. The code that drives the video
  player, music, sound, audio, Bluetooth, lights and the TV browser is
  kept. Each area's detailed design lists which is which.
- **Where the code is kept.** Two decisions settle it: one definition
  that every program is checked against, and the same rules code in
  the backend and in the GM scanner. Programs that must agree at every
  change are kept and released together, in one repository. The
  hardware scanner's firmware agrees with them through a handful of
  messages, is built with other tools and carries GPL libraries, so it
  keeps its own repository and is checked against the definition.
  ALN's pack, media and tools are ALN's and stay outside the engine.
- **A repository that can be made public.** The end is a public
  platform with nothing of any one game in it and no secret. Today's
  repository holds a live secret as a tracked file. So the engine's
  code starts in a new repository. Creating it needs the owner's
  account, and the agent asks when the first area is about to start.
- **A release** is a built bundle that is installed on the backend's
  computer, with the firmware version it carries named in it.

## 8. What is the owner's in this revision

1. **To sign off this revision**, or send it back.
2. **The GM scanner at the cutover.** Its game screens are built
   around ALN's fields and two modes, so they are written new either
   way. Either they keep today's layout, with only what the owner's
   decisions add (the "not confirmed" mark, the list after a restart,
   the transfer), and the redesign follows after show-ready as r4
   places it. Or the redesign is brought forward and designed with the
   owner before that area is built. Recommended: today's layout at the
   cutover. The show-ready gate is strict because a changed instrument
   in a GM's hands is a risk, and the redesign deserves its own time.
3. **When the kit gets its real name and certificate.** The owner
   moved this to the players' phones block on 2026-09-12. Since
   2026-11-13 the name is written into every tag, and what a phone or
   tablet has stored is tied to the name. Recommended: before the
   cutover, in the last area, so that no device and no tag ever has
   to change name afterwards.
4. **How a device is added to a kit.** Decided in the detailed design
   of the area that builds credentials. It comes to the owner then.
5. **Two needs, when the build starts.** A few session files from real
   ALN sessions on blue, with the report downloaded for each and which
   pack and which of blue's versions each ran. And the go-ahead to
   create the engine's repository.
