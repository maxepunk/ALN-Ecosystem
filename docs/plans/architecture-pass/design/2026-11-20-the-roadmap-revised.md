# The roadmap, revised (draft for the owner, 2026-11-20)

Status: draft. It is the second of the two documents the design hands
over (the program document, sections 5 and 7). When the owner signs it
off, `docs/plans/ROADMAP.md` is amended in place as revision r5 and the
r4 text stays in git history. Until then `ROADMAP.md` is not edited.
The first document is `2026-11-20-each-decision-and-its-test.md`.

## 1. What stays as it is

- The final outcome: an open-source platform on which a designer builds
  a game as a pack, a technician installs it, a GM runs it and players
  play (`ROADMAP.md` section 1).
- The standing rules: no player accounts, growth without corners, the
  media model, the designer's loop, parity between the phone page and
  the hardware scanner, the engine holds no opinion (section 2).
- The five states the work is steered by: coherent on main (reached),
  hardware-proven, show-ready, previewable, adoptable (section 3).
- The five pains the owner named: panels drifting from what is really
  happening, not knowing whether each part works, piecing a session
  together afterwards, the GM scanner's layout in the middle of a game,
  and needing a technician to get from power-on to a running show
  (section 4).
- Blue runs every ALN session until one cutover. No date governs the
  work.
- The charters of the capture block, the preview block, the
  depth-and-close block and the later blocks.
- The rule on sizes: each piece of work gets its size when its
  detailed design is made, and the owner approves it before building.

## 2. What the pass changed

The hardening block and the truth sweep are replaced by **the build**:
the engine brought to the design the owner decided between 2026-11-10
and 2026-11-20 (the proposal's seven changes; `docs/adr/0001` to
`0011`). The owner ratified its frame on 2026-10-30: one area at a
time, each area with its detailed design just before it is built and
its tests written first, finished when every test passes on the test
rig. It is the engine work that must land before green can replace
blue.

Items of the r4 roadmap that the owner's decisions moved or answered:

| r4 | What changed | By |
|---|---|---|
| The hardening block's unbuilt pieces (credentials, restarting crashed programs, the pack fix on the GM scanner, the preflight, the profile check) | Rebuilt inside the build's areas, section 3 | owner, 2026-10-30 |
| The truth sweep | Its purpose, every screen proven true, is met in the build: every screen is worked out from the session's record, and proven by captures | owner, 2026-10-30; `docs/adr/0001` |
| The capture block's second deliverable, the file a finished session is handed over in | Built in the build. The session's record is that file. The capture block keeps the capture itself and the photo store | `docs/adr/0001`, `0002` |
| Row 8.5, a GM scanner with the wrong pack | Decided: it fixes itself. Built in the build | owner, 2026-11-13 |
| Row 8.11, whether the kit's own machines get a credential | Answered yes | `docs/adr/0004` |
| Row 8.16, a GM's scan starting a video | Answered by the designer's rules: what a verb does can include what the room does | `docs/adr/0011` |
| Row 8.17, the GM scanner's redesign | Gains the transfer between accounts. Its place is a decision for the owner, section 8 | owner, 2026-11-13 |
| Row 8.19, the kit's real name and certificate | Needed earlier: the name is written into every tag once the link comes first. Its place is a decision for the owner, section 8 | `docs/adr/0005` |
| The players' phones block | Part of it is built in the build: a phone's credential, the tag with the link first, the phone page opened from a link | `docs/adr/0004`, `0005`; owner, 2026-11-13 |
| The second game's modules | A game's scoring and verbs are the designer's. A developer adds only a capability the engine lacks | `docs/adr/0011` |
| Section 6, "going back is immediate: swap back to blue" | No longer true by itself. Section 6 below | `docs/adr/0004`, `0005`, `0006` |
| One pull request for each repository touched (2026-09-12) | One for each change, section 7 | follows from `docs/adr/0007` |

## 3. The build, on the road to show-ready

The order is by what stands on what. ALN is the measure in every
area: ALN's pack, ALN's real sessions from blue, ALN's room. The toy
pack, scored its own way, is the second measure, so that nothing in
the engine is ALN's.

Each area opens with its detailed design, which comes to the owner
with its size and with whatever in it is the owner's to decide. Its
tests are written first, from `2026-11-20-each-decision-and-its-test.md`.
It is finished when they pass on the rig.

| Area | What is built | It stands on | Who it serves | September's paused pieces placed here | Tests |
|---|---|---|---|---|---|
| The rig and the measures | The test rig with the real video and music players and stand-in gear. ALN's real sessions gathered and made usable as a check. The new toy pack. | Nothing | Every later area | The rest of the test set-up repair | They are the means |
| The centre | The session's record. The game's rules worked out from the pack, with ALN's rules written as pack rules. The messages, in one definition. Credentials. The GM scanner holding a copy of the record and carrying on without the backend. A game with no backend. The session's file. | The rig | The designer: a game's rules are theirs. The GM: every screen agrees on the game's facts, and a lost connection never stops a scan. | Credentials | Sections 1 and 3, and the rules in 4 |
| The room | The seven kinds of gear under one pattern. Restarting a crashed program, with the buttons a GM has when it cannot. Gear not installed shown grey. The check of the installation's settings at start. Start-up as one sequence, so the computer powers on into a running system. What comes back after a restart. Copies kept apart. | The centre's record and messages | The GM: whether each part works. The technician: power-on to a running show. | Restarting crashed programs and the fault buttons, the lost fixes to "not installed", the profile check, the host settings file | Section 5, and restarts in 4 |
| The show on the record | Cues and timelines, the video queue, music, the game clock and its phases, the TV's modes and held items, each fitted so that what it did is in the record and its panel is worked out from the gear's own report. A verb can ask the room for something. | The centre and the room | The GM: the room's panels stop drifting. | | Sections 1 and 4, captures of the room's panels |
| The GM scanner | Its game screens and its panels on the centre. The preflight in the panel and from the command line. Every screen proven by captures. The transfer between accounts. | The centre, the room, the show | The GM | The preflight checks, its command line and its panel; the pack fix; the wiring and the sweep rows | Sections 1 to 4 as a GM sees them |
| Players' devices | The player scanner page, opened from a tag's link. The hardware scanner's firmware: a credential, a version, the time from the backend, both tag layouts, updates over the air, a setting for no backend. The scoreboard. | The centre | Players. The technician: no cable after the cutover. | | Section 2 |
| The tools | The config tool working through the engine's definitions and no longer writing the backend's files. The tag tools. The post-session checks reading the record. The report made from the record in the form the owner ruled. | The centre | The designer, the technician, the director | | Sections 2 and 4 |
| ALN's move | Green proven on hardware with the new engine. The kit's real name and certificate. The cutover plan with its way back. One full rehearsal at the venue. The owner's review as GM. | Everything above | ALN | | Real devices |

The room and the players' devices can be built side by side once the
centre's record and messages exist. The rest follow in order.

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

The order of r4 stands, with what the pass changed:

- **The capture block.** The roster, notes, photos and the accusation
  join the record, which already exists. The photo store is still to
  design. Its place against the preview block is decided once it is
  sized, as r4 says.
- **The preview block**, to previewable. The mechanics editor now
  covers a game's verbs and formulas, which is more than values. The
  designer's loop of change, apply, play stays as ratified, and a
  rehearsal runs on a copy kept apart from the installed backend.
- **The depth-and-close block.** As r4.
- **Players' phones.** What is left after the build: the experience of
  receiving a token on a phone, actions that take two tokens, how many
  phones a kit carries.
- **The second game.** The capabilities it needs that the engine
  lacks (a score read off a graph, state that spreads, its screen),
  each added once for every game. Its design stays at the owner's
  pace.
- **Content tooling.** As r4.
- **Operations and the release**, to adoptable. The engine's
  repository is made public here. Before that: the secret that is in
  today's repository is dealt with, the documents are swept for
  private details, and a licence is chosen. The hardware scanner's
  firmware uses two libraries under the GPL, so the firmware itself
  must be released under the GPL.

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
  account, and the agent asks when the centre is about to start.
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
   cutover, in ALN's move, so that no device and no tag ever has to
   change name afterwards.
4. **How a device is added to a kit.** Decided in the centre's
   detailed design. It comes to the owner then.
5. **Two needs, when the build starts.** A few session files from real
   ALN sessions on blue, with the report downloaded for each and which
   pack and which of blue's versions each ran. And the go-ahead to
   create the engine's repository.
