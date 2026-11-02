# Check of the reconciled cards C2, C3, C4, C5, C7, C13 against the engine shape

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`.
- **Checked file:** `docs/plans/architecture-pass/report/2026-11-01-cards-shape-running.json` (six cards). Corrections are applied in that file; it parses (checked with `python3 json.load`), and a script confirmed each card's Mermaid starts `flowchart LR` or `flowchart TD`, has at most 12 nodes, quotes every label, carries no `;` or `#` inside a label, and marks one owner node.
- **Read against:** `docs/plans/architecture-pass/2026-11-01-engine-shape.md` (ES; whole document, section 8 included), `report/2026-11-01-engine-shape.json` (ESJ), `report/2026-10-31-cause-cards.json` (CC), `report/2026-10-31-standalone-lines.json` (SL), `2026-10-30-cause-analysis.md` (AN), `2026-10-31-standalone-pass.md` (SP), the codebase-design skill (SKILL), `relationships/2026-11-01-today-components.md` (TC), `relationships/2026-11-01-today-backend-modules.md` (BM).
- **Method:** refute by default. A claim I could not confirm from the cited record is marked corrected. 42 verdicts: 18 held, 24 corrected. Each card's `notes` now ends with a "Check (2026-11-01)" sentence naming what changed.

| Card | Test | Verdict | What was wrong | What I changed |
|---|---|---|---|---|
| C2 | 1 Parts | corrected | Parts were P6, P8 while the owner node and the design-terms line both lead with Equipment. ES:356 (section 5 G) says P8 decides state and health as one dated object and P6 carries it, so Equipment owns the fact. The set P6, P8 matches ES:187, ES:191 and ES:211. | Parts reordered to P8, P6. |
| C2 | 2 Candidate | corrected | Drawing fits ES:187 (P6 reads P8's dated state, no authority calls P6) and ES:191. The note said "one record per service"; the shape's interface is per capability (ES:191; 4.4 row 3, ES:339). Note also framed the fix as "a panel opened late", while the card's At a show is a service going down or coming back. The Or line is 4.4 row 1 B (ES:337), fine. | Note: "one dated record per thing the room can do"; adds that every panel sees a service go down or come back. |
| C2 | 3 Design terms | held | Equipment (owner) named first; "adapter", "seam", "interface", "locality" used per SKILL; today sentence verbatim from CC C2. | Only the code name, under test 7. |
| C2 | 4 Standalone | held | Today facts match SL C2 and SP:35-39; the stand-in reporting every duty dormant is ES:321; B is ES:340. | None. |
| C2 | 5 Today facts | corrected | shapeChange tied the lighting panel that stayed dead until a reload to "a tablet that connects late". AN:113-114 (A-11, A-12) say a reload fixes it: the fault is the live change never sent when Home Assistant or MPD comes back. The writer's note cites AN:110-111, which is the table header. No factFix covered this. | shapeChange rewritten; check sentence in notes gives AN:113-114. |
| C2 | 6 shapeChange | corrected | Misstated the moment (above) and did not mention the changed Or line or the age now shown on the panel. | Rewritten: record moved to Equipment, push to Delivery, panels change with no reload, age shown, option now the shape's. |
| C2 | 7 Writing and Mermaid | corrected | designTerms carried the code name `state()`. Mermaid passed. | Code name replaced by "one interface that reports value, health and age". |
| C3 | 1 Parts | held | P8, P9 matches ES:191 (C3), ES:193 (C3's trust half), ES:211; owner P8 first and owner node is Equipment. | None. |
| C3 | 2 Candidate | held | Adapter under Equipment with timed re-read is AN:178 (a) placed per ES:191 seams; Show runner reads P8's picture (ES:193); supervisor is ES:191; the Delivery path closes X-01 (AN C3 table). Or line is 4.4 row 3 B (ES:339). | None. |
| C3 | 3 Design terms | held | Equipment named as owner; SKILL words used correctly; today sentence verbatim from CC C3. | Only the code name, under test 7. |
| C3 | 4 Standalone | corrected | "A video token reads as not tonight" decides owner choice 3 (ES:364), and a video token is a player-device scan, which the tablet's Equipment stand-in does not touch. | Line now says the stand-in reports every duty dormant (A), nothing changes (B), and what a video token shows is the owner's choice. |
| C3 | 5 Today facts | corrected | shapeChange said the queue and timeline "stop reading their own cache"; today they read each service's cache (CC C3 designTerms, AN C3 statement). No factFix. | Fixed in the rewritten shapeChange. |
| C3 | 6 shapeChange | corrected | Said the queue and timeline "ask Show runner's one picture"; the picture is Equipment's and the queue and timeline move into Show runner (ES:193). Did not mention the supervisor or the changed Or line. | Rewritten. |
| C3 | 7 Writing and Mermaid | corrected | Note was one long sentence with three ideas joined by semicolons; designTerms carried `state()`. Mermaid passed. | Note split into short sentences; code name removed. |
| C4 | 1 Parts | held | P11 alone matches ES:197 and ES:211 "C4 (P11)". | None. |
| C4 | 2 Candidate | corrected | Drawing fits ES:197 (only mover, only caller of resets) and ES:187 (P6 reads P11's onBoundary); player devices as Screens told the boundary fit ES:197 "every screen is told". But the note said "plus one boundary message", contradicting the drawing and shapeChange ("instead of a separate message"). Or line is 4.4 row 6 B (ES:342), fine. | Note: Delivery carries each boundary as a fact with a version. |
| C4 | 3 Design terms | held | Lifecycle named as owner; SKILL words correct; today sentence kept from CC C4 with "Today" prefixed. | Only the code name, under test 7. |
| C4 | 4 Standalone | corrected | "Player devices learn one only if the owner joins them to it": SP:54 gives a device-side new-game action or a game id the tablet shows and the device checks, neither of which needs a join. | Last sentence replaced with SP:54's two options. |
| C4 | 5 Today facts | held | Today facts compressed but kept (SL C4; SP:51-52). No factFix needed. Writer's note cited TC:623 for split 5, which is TC:627. | Note citation corrected to TC:627. |
| C4 | 6 shapeChange | corrected | Did not mention the new player-device node or the changed Or line. | Rewritten to name both. |
| C4 | 7 Writing and Mermaid | corrected | designTerms carried `move(game, to moment)`; note was one long sentence. Mermaid passed (9 nodes). | Code name replaced with plain words; note split. |
| C5 | 1 Parts | held | P11, P13 matches ES:197 (C5), ES:201 (C5's wiring half), ES:211; owner Lifecycle first. | None. |
| C5 | 2 Candidate | held | Starting point called by boot, Reset System and a test's setup is ES:201 and section 8 row P13 (ES:423); Lifecycle one path (ES:197); verdict asked with the fresh picture (ES:217). Or line is 4.4 row 6 B (ES:342). | None (the node rename is under test 7). |
| C5 | 3 Design terms | corrected | Line led with "a composition root", which is not a part, instead of Lifecycle, the owning part; "alone call" was ungrammatical. | Leads with Lifecycle; the root is "a starting point above every part". Today sentence verbatim. |
| C5 | 4 Standalone | held | Facts match SL C5 and SP:59-62; A from ES:321; B's begin-game function is SP:62. | Wording only, under test 7. |
| C5 | 5 Today facts | held | None changed; BM:462 confirms music left out of the reset bag. | None. |
| C5 | 6 shapeChange | corrected | Called it "a root", did not mention the Display row fix shown in the drawing, the test's setup node, or the changed Or line. | Rewritten. |
| C5 | 7 Writing and Mermaid | corrected | "Composition root" in the node, note and designTerms is not a plain part name; ESJ parts P13 plain and the sibling card C8 call it "a starting point". Standalone line's B clause read "rows of ... one tablet begin-game function". | Node, note and designTerms say "Starting point"; standalone B clause rewritten. |
| C7 | 1 Parts | held | P4 alone matches ES:183 and ES:211 "C7 (P4)". | None. |
| C7 | 2 Candidate | corrected | Drawing fits ES:181 (record applies and returns the outcome) and ES:183 (one door, two transports, grants once, word list). But the Or line, J3 as one part (4.4 row 5, ES:341), is not another way to remove C7. | Or line replaced with AN:355 candidate (c): each device asks which of its scans are stored and deletes only those. |
| C7 | 3 Design terms | held | Answering named as owner; SKILL words correct; today sentence verbatim from CC C7. | Only the code name, under test 7. |
| C7 | 4 Standalone | corrected | Line covered only the tablet; SP:78 and SL C7 require each device's record step to return the same words, and ES:323 gives the player devices the reply words as data. | Added the player devices' record step. |
| C7 | 5 Today facts | held | Today facts kept from SL C7. | None. |
| C7 | 6 shapeChange | corrected | "A batch with no game is refused" decides an outcome AN's C7 proving test leaves open (refuse or store); did not mention the changed Or line. | Rewritten: one answer, stored or refused; option changed. |
| C7 | 7 Writing and Mermaid | corrected | designTerms carried `answer(request)`; note was one long sentence. Mermaid passed. | Code name replaced; note split. |
| C13 | 1 Parts | held | P7, P4 matches ES:189 (C13), ES:183 (C13's floor half), ES:211; owner P7 first. | None. |
| C13 | 2 Candidate | corrected | Drawing fits ES:189 (admit, liveness, tiers) and ES:187 (role filter from P7). The Or line, the scoreboard as a view of the GM app (4.4 row 7, ES:343), is not another way to remove C13. | Or line replaced with AN:676 candidate (b): public and operator surfaces, closed by default. |
| C13 | 3 Design terms | held | Connections and roles named as owner; SKILL words correct; today sentence verbatim from CC C13. | Only the code name, under test 7. |
| C13 | 4 Standalone | corrected | "So the record names which device acted": ES:321 gives the stand-in one connection, the tablet itself, and nothing in the shape gives it a new name, so device id 001 (SP:123-126) stays. | Unsupported clause removed. |
| C13 | 5 Today facts | held | Today facts kept from SL C13; "three separate checks" matches ES:144 "the floor checked in three places". | None. |
| C13 | 6 shapeChange | corrected | Did not mention the device pass for the phone and the hardware scanner or the changed Or line; "one admit and two readers" was jargon. | Rewritten. |
| C13 | 7 Writing and Mermaid | corrected | designTerms carried `admit(pass, claim)`. Mermaid passed (9 nodes). | Code name replaced. |

## Not settled

- **Owning part for C2.** I read "owning part" as the part that decides the fact (ES:356, P8). If the page means the part whose Removes line names the flaw whole, P6 would lead and the owner node and the design-terms line would move to Delivery. The card is now consistent under the first reading.
- **Standalone lines' "(candidate A)" and "(B)".** All six lines refer to 4.4 row 4 by letter. That is plain only if the page shows that row near the cards; I did not change the pattern.
- **Edges that read as a lower part notifying a higher one** ("picture changed" from Equipment to Delivery in C2 and C3, "announces" from Lifecycle to Delivery in C4). I held them as change feeds and the onBoundary hook that ES:187 says Delivery reads; a stricter reading would relabel them as reads by Delivery.
