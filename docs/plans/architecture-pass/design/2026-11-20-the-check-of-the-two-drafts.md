# The check of the two handover drafts (2026-11-20)

The two drafts are `2026-11-20-each-decision-and-its-test.md` and
`2026-11-20-the-roadmap-revised.md`. The first drafts were committed
at `395baa69`, and their wording was swept at `180880f6` after the
owner's note on titles and nicknames.

## The first check

One independent reader read both first drafts against the owner's
recorded rulings. It was a strong model one step below the session's
own, at high effort, as the owner's rule on helpers asks for a review.
It returned sixteen findings. The agent checked each against the
record it cites before changing anything. All sixteen held. Two held
with a correction of the agent's own, noted below.

| No. | The finding | Checked against | What it changed |
|---|---|---|---|
| 1 | The transfer between accounts was put in the build. The owner placed it with the GM scanner's redesign, "not before". | `../DECISIONS.md`, "A transfer between accounts is one action" | Out of the build and out of the cutover's layout. Test 1.20 is marked later. Row 8.17 says the owner placed it with the redesign. |
| 2 | The rule on pull requests was changed in a table row, citing a decision note that is about something else. | The hardening plan, ruling R4 | The rule stands as the owner made it. The roadmap draft states it in section 1 and reads each area as the block it speaks of. The owner can correct the reading. |
| 3 | The "thin first version that works end to end", in the order the owner confirmed on 2026-11-13, had vanished. The first area was not end to end. | `../DECISIONS.md`, "The order of work"; the agent's reply to the owner of 2026-11-20 | The build's second area is that first version, defined by the eleven things a person can do with it. The areas were recut so that each builds a part together with the screens that show it. |
| 4 | Losing the immediate way back to blue was written as settled, with a rehearsal on "spare scanners". The rule for borrowing components was missing. | `docs/plans/ROADMAP.md`, section 6; `docs/plans/CURRENT-STATE.md`, section 3 (three hardware scanners at the venue) | The roadmap draft's section 6 says what going back takes part by part, and restates the borrowing rule with lines for the hardware scanner, a game's tag, a GM tablet and the second scoreboard. The way back for the hardware scanners is a decision for the owner. |
| 5 | Changing the secrets was moved from "before previewable" to the release. | `ROADMAP.md`, section 3 (the owner, 2026-09-05) and section 7.4 | Restored: before the first outside person uses the system. |
| 6 | Tests given to the first area needed parts built in later areas. | The first draft's own tables | Every test row names the area that makes it passable. A test that spans areas is split into one row for each. |
| 7 | The scanners' area needed the web name, which was recommended for the last area. The draft said "the kit's real name" where the name is the production's. | `docs/adr/0005`, `0006`; `docs/decisions/2026-07-09-kit-network-posture.md` | The web name is its own area, right after the first version if the owner places it before the cutover. "The production's web name" throughout. The firmware's check of the backend's certificate is in its area's list. |
| 8 | Green's hardware pass at home on today's engine had vanished. | `ROADMAP.md`, section 3; the program document, section 7; `CURRENT-STATE.md`, section 6 | Hardware-proven keeps its meaning. Show-ready's second condition adds the real-device tests on green with the new engine. The build needs green before the hardware scanner's tests are due. |
| 9 | The reference pictures of blue's screens, the truth sweep's five recorded faults and the four findings nobody has run were not tests. The delete test checked only the score. | `ROADMAP.md`, sections 3 and 4; ruling R22; `2026-09-04-roadmap-r4-draft.md`, lines 238 to 247; `../2026-10-30-cause-analysis.md`, section 4 | The pictures are taken in the test bench. Section 6 of the tests document turns the named faults into tests and says where every other reproduction goes. Test 1.1 says the token can be scanned again on every GM scanner with no reload. |
| 10 | The conditions for ending the design, the hardware list and the registry's rows were not shown. The tests document said "one of the two documents". | The program document, sections 4.2 and 4.3; `../DECISIONS.md`, "When the design half is finished" and "The engine is hardware-flexible" | The tests document's sections 7 and 8. The roadmap draft's sections 8, 9, 10 and 12. |
| 11 | The guide for the new engine, ALN's content tools and the flash of every scanner were in no area. | `docs/adr/0006`; `CURRENT-STATE.md`, section 4 | The area "Releasing and installing the engine, and ALN's content in the new form", and the last area. |
| 12 | Tests that need a real hardware scanner or tag were not marked, and the header still said every test passes on the rig. | `docs/plans/2026-09-12-container-baseline.md`; `CONTEXT.md`, "Environment ladder" | Marked "real devices" and proven on green at home. The header says so, and says this is the agent's reading of the ratified sentence. |
| 13 | The tests for the designer's rules proved less than the decision. One row read like the limit the owner rejected. | `docs/adr/0011`; `../DECISIONS.md`, "A designer designs a game's rules" | Tests 4.6 to 4.13. Test 4.8 names only the three staff actions, and test 4.7 shows a verb that changes points being accepted. |
| 14 | Several decisions had no test. | `../DECISIONS.md`, "Since the proposal"; `docs/adr/0003`, `0004`, `0008`, `0010`; the hardening plan | Tests 1.7, 1.18, 2.11, 2.13, 2.16, 2.23, 3.16, 3.17, 4.19, 5.2, 5.3, 5.5 and 5.16. |
| 15 | "A release is a built bundle" had no reason, and "the firmware must be released under the GPL" settled part of the owner's licence choice. | `../2026-10-30-cause-analysis.md`, cause 15; `ROADMAP.md`, section 7.4; the two libraries' licence files | The release is grounded in cause 15 and in what a technician does. The GPL is stated as a cost with its alternative, for the owner's licence choice. |
| 16 | Coined labels: "the centre", "the measures", "the show on the record", "ALN's move" and others. | The owner's note of 2026-11-20 | Mostly fixed in the sweep before the reader's report came. Each area is now named by what it builds. |

The two corrections of the agent's own:

- Finding 4 said a rehearsal on spare scanners weakens the rehearsal.
  That holds. The agent also found that a GM tablet's way back is
  immediate only if the new engine is never served at blue's own
  address and port, and wrote that into section 6.
- The reader treated the GM scanner's layout at the cutover as a fresh
  choice for the owner. The current roadmap already orders it: the
  redesign comes after show-ready. So the draft states that order,
  adds the one new fact (the build writes the game screens new, and
  the redesign writes them again) and recommends keeping the order.

Found by the agent while checking, and fixed:

- The first draft's test "start a session with a required piece of
  gear down: refused" misstated the September ruling. A program that
  is installed and has crashed never blocks a start. A start is
  refused in three cases only: the pack requires equipment the
  installation does not have, fewer devices of a kind are connected
  than the pack's minimum, or the installation's settings file fails
  its check (the hardening plan, pins P1, P7 and P19). Tests 5.9 and
  5.10.
- The owner's decision of 2026-07-09 on the kit's network already says
  how the web name and certificate work, renewal at home included. The
  roadmap draft's area builds that decision.
- The project's list of temporary shortcuts
  (`docs/plans/PHASE3-STATUS.md`) was not accounted for. The roadmap
  draft's section 10.

## What the agent got wrong, as a pattern

Four findings were again a ruling of the owner's contradicted or
dropped (1, 2, 3, 5), and three were a decision of the owner's written
as settled or left out (4, 8, 10). The cause was the same each time:
the agent wrote from its memory of the design and did not open the
record. For the second drafts the agent read, in full, `ROADMAP.md`,
the program document, the section "Since the proposal" and the section
on how the design is made in `../DECISIONS.md`, all eleven decision
notes, the hardening plan's rulings and pins, the cause analysis's
sections 1, 3 and 4, and the state page.

## The second check

Two independent readers with different angles checked the second
drafts (`b08defec`), as the method the owner ratified asks ("two
reviewers with different angles, a checker for each finding"). Both
were a strong model one step below the session's own, at high effort.
One read the drafts against the owner's recorded rulings and against
the sixteen findings above. The other read them as an engineer who
has to build from them with nobody to ask. They returned twelve and
fourteen findings. The agent checked each against the record or the
code it cites. All twenty-six held, and the third drafts answer them.

### Against the owner's rulings (twelve)

| No. | The finding | What it changed |
|---|---|---|
| 1 | The first version was credited to the owner "2026-11-13 and 2026-11-20". On 2026-11-20 the owner asked why it exists; the owner's "yeah" confirmed the missing connection and ruled nothing about the first version. The state page warns of exactly this fault. | The credit is the order of 2026-11-13 only. What the first version holds and why it comes second is in the roadmap draft's section 7, as the agent's engineering call. |
| 2 | The web name's area stood after the firmware, which needed it, while section 11 recommended it after the first version. Tests and the cutover assumed the owner's answer. | The area is third. The roadmap draft says what leaves the build if the owner keeps the name with players' own phones, and show-ready says so too. |
| 3 | Section 1 restated the roadmap's rules shorter than they are, and the sign-off said the amended roadmap would state them that way. Sub-rules on kits, media, firmware work and privacy were dropped, and so were rulings on the later config tool pages and the second game. | The roadmap's own text stays word for word; only a title gains its rule's first sentence. Section 1 now carries the sub-rules, and section 5 the rulings. |
| 4 | Removing the secret from today's repository and its history had become conditional. The Wi-Fi password the owner put off on 2026-09-12 was in neither draft. | The removal stands as ruled, before anything is public. The Wi-Fi password is proposed to go with the other secrets, for the owner to approve. |
| 5 | The tests document named the wrong rows for the four reproductions the program document names. | Corrected: tests 1.1, 1.12, 4.26 and 6.1. |
| 6 | Section 12 credited the owner with reading one condition as overtaken, which is the agent's call. It said the second check had happened before it had. Two sentences on when the build ends disagreed. | Credited to the agent's call. The sentence on the check is now true. The two sentences agree. |
| 7 | Two rulings made for the hardening block (parallel work, R15; reviews, R26) were applied to the whole build without saying it was a reading. | Both are among the five readings in section 11. Ruling R17 is cited for trying work on green at home. |
| 8 | "Players never have accounts" could be read as ALN's accounts. | "A player never has a login or a user account of their own." |
| 9 | The word "team" in the messages (ledger L4) and two changes to who may do what were moved out of the players' phones work with no row saying so. | A row in section 2's table. |
| 10 | Six findings the cause analysis set aside as plain fixes had no home, and neither had the September pieces called the final wiring and the close review. | Section 7 of the tests document names the area for each plain fix. Section 2 of the roadmap draft places the two pieces. |
| 11 | Two tests were in the wrong area: a set bonus in the first version, and "every program reports the new version" before the firmware has a version. | Test 4.9 is split into 4.9 and 4.10. Test 4.16 no longer speaks of versions; test 6.23 does. |
| 12 | Wording: "GM tablet"; area nicknames in the tests' last column; "fitted to the one pattern"; the GM scanner's layout asked as a question though the roadmap orders it. | "A device that runs the GM scanner". The column uses the areas' own names. The layout is under "To know, with nothing to decide". |

### As the engineer who builds from them (fourteen)

| No. | The finding | What it changed |
|---|---|---|
| 1 | The firmware's check of the backend's certificate, and the length of a tag's link, need the web name's decision whether or not the name is in service before the cutover. A certificate changed later could leave every scanner refusing the backend. | The name itself is a need of the first version. The firmware's area designs what the firmware trusts so that the certificate can change with no cable (test 2.42). |
| 2 | Show-ready and the cutover assumed the web name was in service. | As finding 2 above. Test 2.33 moved to a whole game session, which now builds the GM scanner reading a tag whenever it is on screen. |
| 3 | Tests used "publish" from the first version on, but only a late area built publishing. | The first version builds the command that publishes a pack. The tests document defines "publish a pack", and says the backend takes a published pack up when it next starts. |
| 4 | The room's equipment and cues needed each other, and a whole game session needed the TV. "Start over" was built in one area and tested in another. | What the TV shows, and playing a video at a GM's command, are in the room's equipment. A whole game session builds the scoreboard page, not the TV. Tests 5.5 and 5.6 are split. Test 6.21 uses ending a session and creating the next; test 4.26 covers both ways of starting over. |
| 5 | Seven rows could not pass in their area. | Tests 2.6 and 2.7, 2.21 and 2.22, 4.9 and 4.10, 5.16 and 6.19 are split or reassigned. The firmware's area builds the backend's part that offers a firmware file. Test 2.43 says each repository's own checks fail. |
| 6 | A phone's credential "lasts for one session", yet a phone must work with no session and hand over a stored scan after the end. | Test 2.24 states a reading, which is also the fifth reading in section 11. |
| 7 | A game with no backend had no place to serve its pages from. | It joins the owner's decision on how a device is added to a kit. The release area builds those pages as a set of files. The cutover replaces ALN's public copies. A row in the hardware list. |
| 8 | The first version's list of what is built did not match its eleven steps. Its stand-in was a sound player, which is one short process for each sound and has nothing to restart. | Session and account controls, the publish command and the firmware's two files are in the list. The stand-in is the video player. |
| 9 | The test bench could not convert blue's sessions before the record's form exists. | The bench keeps the files and blue's final scores. The converter is built in a whole game session. |
| 10 | Missing work: ALN's installation settings in the new form; whether the config tool's screen for ALN's values is kept; no tests for the tools and release areas; a spare backend taking over; September leftovers. | The release area builds ALN's settings. The screen is kept. Tests 3.18, 5.18 to 5.20 and 6.27. A whole game session builds the take-over. The census, the tidying of documents, the border check and the review after the rehearsal are placed; the recount of the lost audit reports is set aside with its reason. |
| 11 | Four thin reasons in section 7: "moved across with its tests", though the tests reach inside the code; the GPL as a reason for the firmware's own repository; a wrong test cited for the release; the new repository resting on the secret alone. | Each reason rewritten. The owner's rule on pinning today's behaviour first is applied to the kept equipment code as well as the firmware. |
| 12 | The hardware list understated what the backend's computer needs. | The row names the programs, the one operating system the guide covers, the video format and the browser. |
| 13 | The claim about which areas can be built side by side was partly wrong. | Restated from the areas' needs, and marked as a reading. |
| 14 | The ten most ambiguous test rows. | Each reworded: tests 1.10, 1.15, 2.16, 2.25, 2.29, 2.32, 2.36, 3.6, 4.15 and 6.9, and the rule on which pack a test uses. |

## What the three checks show

Forty-two findings in two rounds. In the second round the faults had
moved from contradicting the owner to the plan not holding together:
tests placed before the parts they need, and work with no area. One
fault came back in the second round after being fixed in the first:
crediting the owner with something the owner did not rule. Whoever
edits these two documents next should check every "the owner decided"
against the record before writing it.
