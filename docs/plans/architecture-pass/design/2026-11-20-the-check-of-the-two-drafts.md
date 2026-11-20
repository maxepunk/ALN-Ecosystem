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

Two independent readers with different angles check the second
drafts, as the method the owner ratified asks ("two reviewers with
different angles, a checker for each finding"). One reads them against
the owner's recorded rulings and against the sixteen findings above.
The other reads them as an engineer who has to build from them. Their
findings, and what each changed, are recorded here when both have
finished. Until this section holds them, the second drafts have not
been through their check.
