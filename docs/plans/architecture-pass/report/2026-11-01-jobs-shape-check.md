# Check of the reconciled job entries against the engine shape

**Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`. **Checked:** `docs/plans/architecture-pass/report/2026-11-01-jobs-shape.json` against `2026-11-01-engine-shape.md` (all sections, its section 8 corrections taking precedence) and `report/2026-11-01-engine-shape.json`; old data from `report/2026-10-31-engine-jobs.json`, `2026-10-31-engine-jobs.md`, `relationships/2026-11-01-job-relationships.md`, with `2026-10-31-standalone-pass.md`, `2026-10-30-map-direction.md` and `CONTEXT.md` for cited facts. Refuted by default. Seven tests per job, 70 verdicts: 33 held, 37 corrected. Every correction is applied in the JSON, which parses; each corrected job's `notes` ends with a "Check:" sentence giving the citations. Only `sed`, `grep` and short Python scripts (word counts, a forbidden-token scan, the JSON edit and parse) were run.

Shorthand in the table: ES = `2026-11-01-engine-shape.md`, ESJ = `report/2026-11-01-engine-shape.json`, EJJ = `report/2026-10-31-engine-jobs.json`, JR = `relationships/2026-11-01-job-relationships.md`, SP = `2026-10-31-standalone-pass.md`, MD = `2026-10-30-map-direction.md`. Tests: 1 parts, 2 functional, 3 goal, 4 standalone, 5 conflicts, 6 shapeChange, 7 writing.

| Job | Test | Verdict | What was wrong | What I changed |
|---|---|---|---|---|
| J1 | 1 | held | P1, P2 match ES:213; both are J1 owners (ES:86, ES:94). | none |
| J1 | 2 | held | The addition "A second designer's game runs on the same engine" is in ES:18 and JR:36, dropped only from ESJ functional[0]; people already names that designer. | none |
| J1 | 3 | corrected | Lost "or configuration" from EJJ jobs[0].goal (MD:53); the shape replaces nothing there. | Restored "never touches code or configuration". |
| J1 | 4 | corrected | "no record or device shows a pack stamp" is false for the tablet (its settings pack line, root CLAUDE.md pack paragraph); SP:119 and EJJ say "no player device"; "online" dropped. | Restored "reloading online" and "no player device shows one"; design says one pack per game, stamped (ES:179, ES:313). |
| J1 | 5 | held | needs[0] "keeps the pack ... for as long as it runs" against adopt once per boundary (ES:179, ES:197 cap 16) is real; no other needs or tests line contradicts. | none |
| J1 | 6 | corrected | Did not mention the needs[0] conflict. | Added "one needs line now takes a new pack only between games". |
| J1 | 7 | corrected | Passive "Media is named by fingerprint and checked against the bundle". | "The pack names media by fingerprint, checked against the bundle." |
| J2 | 1 | held | P3, P6, P14 match ES:213; P3 is J2's authority (ES:181). | none |
| J2 | 2 | held | Hidden-fact addition is JR:42's own last sentence; people in ESJ functional[1] already names that player; EJJ jobs[1].roles[2-3] carry it. | none |
| J2 | 3 | corrected | "One Game record ... hosted by the tablet" picks candidate A of ES:340 (owner choice 7, ES:368); "every fact reaches every screen" contradicts the hidden-fact filter (ES:187 "every screen that may see it"). | The engine's Game record decides networked, the tablet decides standalone, under the same rules; each fact reaches the screens that may see it. |
| J2 | 4 | held | Keeps SP:31 facts; names both candidates of ES:340. | none |
| J2 | 5 | held | No line contradicts: needs[3] matches the Delivery part (ES:187), needs[5] the Pack channel notice (ES:179), tests[2] one builder per fact. | none |
| J2 | 6 | corrected | Said "decided in one place" moved to the qualities; it is the design answer, the Game record (JR:44, ES:181); only the standalone authority is a quality (ES:107). | Rewrote that sentence. |
| J2 | 7 | held | No rule broken. | none |
| J3 | 1 | held | P4, P5 match ES:213; P4 owner (ES:183). | none |
| J3 | 2 | held | "held" and "try again" are in EJJ jobs[2].meaning and needs[3] and are Answering's outcome words (ES:183); not moved elsewhere. | none |
| J3 | 3 | corrected | Lost "the post-game report builds itself" (EJJ jobs[2].goal; MD:55), which The night's record makes room for (ES:185, cap 33). | Added "the report builds itself from it"; trimmed to stay under 70 words. |
| J3 | 4 | corrected | Cut the fact "the only way to start over deletes the finished game's record" as a J5 fact; J5's line does not carry it, and losing the night's record is J3's second half. | Restored it, kept the local night's record with player scans only if delivered (ES:321, choice 2). |
| J3 | 5 | corrected | tests[2] (Download Report still shown after reconnect) contradicts nothing: it does not say the tablet builds the report. needs[0] "No planned capability concerns the answer" contradicts Answering's caps 14 and 36 (ES:183) and was missed. | Removed the tests[2] conflict; added needs[0] with a fix naming caps 14 and 36. |
| J3 | 6 | corrected | Did not mention the needs line; "at one door" was not in the goal. | Rewrote the last sentences. |
| J3 | 7 | corrected | "one reply shape at one door" left "door" unexplained for the owner. | Removed "at one door". |
| J4 | 1 | held | P8, P9 match ES:213; P8 owner (ES:191). | none |
| J4 | 2 | held | Functional equals ESJ functional[3]; "know its true state" moved to J9 (ES:21, ES:356). | none |
| J4 | 3 | corrected | "Each thing the room can do sits behind one interface" picks candidate A of ES:339 (owner choice 6, ES:367), though the notes claimed neutrality; "Restart button" became "a button"; the three health words were dropped for J9's goal, which did not carry them. | Neutral wording (each outside program through one interface), "Restart button" restored; health words moved into J9's goal. |
| J4 | 4 | held | Keeps EJJ jobs[3].standalone facts; matches ES:321 (equipment and show runner report dormant). | none |
| J4 | 5 | held | needs[1] host-config file against the profile's start-or-adopt setting (ES:199, ES:191) is the shape's choice; no other line contradicts. | none |
| J4 | 6 | corrected | Described the goal as "one interface per thing the room can do". | Rewrote to match the new goal and say the health words went to J9. |
| J4 | 7 | corrected | "the engine's picture is dated and reconciled with it": passive, and "reconciled" is jargon. | "the engine dates its picture of it and checks that picture against it". |
| J5 | 1 | held | P11 matches ES:213. | none |
| J5 | 2 | held | "and no scan lands in it" is EJJ jobs[4].roles[2]; the shape does not move it. | none |
| J5 | 3 | corrected | Lost three items of EJJ jobs[4].goal the shape keeps: the engine updates only between events (cap 44 on the Lifecycle, ES:197), a scanner's old pack copy replaced at a boundary (ES:179, ES:197), reset as one path in tests too (ES:89, ES:197 cap 46). | Restored all three. |
| J5 | 4 | corrected | Dropped "a day change"; "player devices' queues" is wrong for the phone, which keeps a seen list (SP:55, EJJ jobs[4].standalone). | Restored both; kept both candidates. |
| J5 | 5 | held | No line contradicts; needs[4] asks less than the shape gives, not the opposite. | none |
| J5 | 6 | held | True to the change. | none |
| J5 | 7 | corrected | Passives: "every screen is told the boundary", "A pack change is refused". | Active: "it tells every screen the boundary", "The engine refuses a pack change mid-game". |
| J6 | 1 | held | P15 matches ES:213. | none |
| J6 | 2 | held | The gate at the desk is EJJ jobs[5].meaning ("through the engine's own check") and stays on J6's own part (ES:205). | none (wording fixed under test 7) |
| J6 | 3 | corrected | Lost "the mechanics editor and hot-apply are one deliverable" (EJJ jobs[5].goal; MD:61) and "hardware-shaped needs read as not installed on a laptop"; "publish and apply ... at a window" puts a window on publish, which has none (ES:327). | Restored both; only the apply waits for a window. |
| J6 | 4 | held | Keeps EJJ jobs[5].standalone facts; ES:313 (the same pack, stamped). | none |
| J6 | 5 | held | tests[0] restart fallback against ES:205, ES:327 is real; tests[2]'s restart is a statement about today. | none |
| J6 | 6 | corrected | "The goal replaces files and imports with messages": the old goal never named files or imports. | Rewrote: the goal now says the studio talks by message. |
| J6 | 7 | corrected | Passive addition "is refused at the desk"; "The studio" not the part's plain name. | "the engine's own check refuses a bad pack at the desk"; "The Design studio". |
| J7 | 1 | held | P7 matches ES:213. | none |
| J7 | 2 | corrected | The secrets addition names the owner, who is not in people, at a moment ("before outsiders") that is not the entry's moment; JR:152 files it as J10's quality over J7; it keeps its home in the goal and needs[5]. | Removed the addition; need is ESJ functional[6] again. People keep "designers and installers" per ES:397 (correction 1.9). |
| J7 | 3 | corrected | Lost "the engine's only identity is the device or session id" and "each screen receives only what its role needs, filtered by the engine" (EJJ jobs[6].goal; ES:187); "the GM alone moves the game" narrowed lifecycle, show control and scores (ES:108). | Restored all three under 70 words. |
| J7 | 4 | held | Keeps EJJ jobs[6].standalone facts; ES:321 (one connection, the tablet itself). | none |
| J7 | 5 | corrected | Conflict real (MD:237 passes minted per page serve; ES:317, ES:325), but the fix dropped "capped in number". | Fix keeps "capped in number". |
| J7 | 6 | corrected | Said the goal adds the display pass (it is a needs fix) and that the secrets rule returns to the need (now removed). | Rewrote. |
| J7 | 7 | held | No rule broken. | none |
| J8 | 1 | held | P12, P17 match ES:213; P12 owner (ES:199). | none |
| J8 | 2 | corrected | "declared before the night" goes beyond the old words and fixes when the declaration happens, which owner choice 1 leaves open (ES:362); "never mixed" is the quality at ES:107. | Need says "A game declared standalone"; addition is "declared". "or a new machine" held (EJJ jobs[7].meaning; ES:199). |
| J8 | 3 | corrected | Lost "pack and profile chosen by path or id" (MD:120) and "phones and hardware scanners stay equal" (MD:62; ES:323). | Restored both; the Release check kept. |
| J8 | 4 | corrected | "the declaration lives in Venue fit" asserts owner choice 1 (ES:358, ES:362); cut the seven parity rows fact. | Declaration "wherever the owner puts it"; parity rows restored. |
| J8 | 5 | held | needs[1] host-config file against the profile (ES:199) is the shape's choice; tests[3] is today's method. | none |
| J8 | 6 | corrected | Did not mention the needs line; tied to the old need wording. | Rewrote. |
| J8 | 7 | held | No rule broken. | none |
| J9 | 1 | corrected | Order P10, P6, P4, P14 differs from ES:213 (P10, then P4, P6, P14). | Reordered. |
| J9 | 2 | held | Both additions come from EJJ jobs[8] (meaning: paper or live; roles[2]: same words in editor and show) and stay on J9's own part (ES:195). | none |
| J9 | 3 | corrected | Lost from EJJ jobs[8].goal: the preflight states its limits, red and grey, unknown never broken, the start refusal; the three health words that left J4's goal were nowhere. | Restored, with the health words and the switched-off door (ES:195). |
| J9 | 4 | corrected | Cut "all night", "a rising queue" and "though rescanning can never work" (SP:103). | Restored. |
| J9 | 5 | held | No line contradicts. | none |
| J9 | 6 | corrected | "a quality, not a part: one Verdict of its own" contradicts itself; the Verdict is a part (ES:195). | Rewrote. |
| J9 | 7 | corrected | The first shapeChange sentence ran to 30 words with four clauses. | Split into short sentences. |
| J10 | 1 | held | P13, P16, P17 match ES:213; P13 and P16 are both J10 owners (ES:201, ES:207); P16 first holds (ES:105, three of J10's four primary flaws). | none |
| J10 | 2 | corrected | "nothing two parts share drifts unseen" is already in the green run: JR:80 grounds that need in C16, C14 and C8. | Removed it; "one matching set" held (ES:209). |
| J10 | 3 | corrected | Lost "a ladder of test environments, first rung the real stack with fake physics" (EJJ jobs[9].goal; ES:207). | Restored; fake check made active. |
| J10 | 4 | corrected | Cut the phone's pack-test fact (SP:151); named only candidate A, though here the choice decides which proof runs (ES:340; SP section 5). | Restored the fact; names the cross-check for candidate B. |
| J10 | 5 | held | Both conflicts real (ES:201, ES:93, ES:162); no line missed. | none |
| J10 | 6 | held | True to the change. | none |
| J10 | 7 | corrected | Passive "fakes are checked against the real thing". | "tests check every fake against the real thing". |

## Not settled

- The people fields of J7 ("designers and installers at their tools") and J9 ("the designer reading a badge") differ from the shape's JSON, and `needAdditions` has no place for a people change. J7 follows the shape's own correction 1.9 (ES:397); J9 follows its listed addition. Left as they are.
- J4 and J8 move start-or-adopt into the installer's profile, following the Venue fit part (ES:199). The ratified direction kept a separate host file (MD:172, HP:55). The owner may want that file back.
- The dormant word's two doors are now "not installed or switched off" in J9's goal. "By the GM" did not fit in 70 words.
- J3, J4, J7 and J9 still describe only candidate A ("In the candidate the tablet hosts..."). I judged that 4.4's candidate B changes nothing these lines claim.
- J4 needs[0] counts "four different restart shapes"; ES:161 counts two supervision shapes. These are different counts, not a contradiction, so I listed no conflict.
- J10's main part: P13 and P16 are both J10 owners. I kept P16 first.
