# Planning-corpus audit vs the 2026-09-04 owner rulings

**Method note:** all six documents were read in full before this audit was
written: `docs/plans/ROADMAP.md` (397 lines), `docs/plans/2026-06-11-phase3-program.md`
(559 lines), `docs/plans/PHASE3-STATUS.md` (1017 lines, read in four
sequential chunks covering 1–1017 with no gaps), `docs/plans/2026-09-04-ux-foundation.md`
(543 lines), `docs/plans/2026-09-04-phase3-design-workspace-pages.md`
(653 lines), `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md`
(593 lines). `CONTEXT.md` (628 lines) was also read in full, since the task
requires citing it for vocabulary rather than paraphrasing it.

Vocabulary in this report follows CONTEXT.md as instructed: "Design
workspace pages" (CONTEXT.md §7, `CONTEXT.md:547-551`), "resolver
presentation" (CONTEXT.md §7, `CONTEXT.md:552-557`), "profile" /
"installation profile" (CONTEXT.md §2/§1), "verdict" / "resolve()" /
"one truth, three loops" (CONTEXT.md §2, `CONTEXT.md:174-190`), "Author /
Rehearse / Run / Review" (CONTEXT.md §5b, `CONTEXT.md:442-448`).

---

## 1. Statements that assume post-Phase-3 work waits until after the Oct-18 run

Ruling (a) retires the assumption that hardware-proving and cutover work
sit behind a fixed "Phase 3 must close first" wall, and explicitly turns
"no cutover mid-run" from a rule into a decision (Mon–Thu gaps inside the
Fri–Sun run become candidate windows). The following statements encode
the retired assumption:

1. **`docs/plans/ROADMAP.md:192-194`** — "**Timing (owner, 2026-08-29): no
   green-Pi work until after Phase 3 is done, at the earliest.** The
   testing ladder therefore starts at Phase-3 close, not on the show
   calendar." This is the direct textual ancestor of ruling (a)'s R2
   milestone (green-Pi Stage B) — the ruling detaches Stage B from "Phase-3
   done" and reframes it as an independently-achievable readiness rung.
2. **`docs/plans/ROADMAP.md:200`** — "**Stage B (at home, after Phase-3
   close):** set up the green Pi and run a partial-kit test." Same
   dependency, restated as the Stage-B header itself.
3. **`docs/plans/ROADMAP.md:167-169`** — "The cutover happens after
   2026-10-18 unless everything is finished AND tested in production
   conditions earlier. **No cutover happens mid-run.**" Ruling (a)
   explicitly names this exact sentence's premise as retired: "the
   Sept-18–Oct-18 run's Monday–Thursday gaps are candidate windows —
   'no cutover mid-run' becomes an explicit decision, not a rule."
4. **`docs/plans/ROADMAP.md:375-376`** (§9.1, "The committed order") —
   "green-Pi setup and testing Stages B/C (§3b; starts after Phase-3
   close, owner direction) → the cutover (blue/green swap; after
   2026-10-18 per §3)." This is the master sequencing statement placing
   R2/R3-equivalent work strictly after a monolithic "Phase 3 remainder"
   block (see also Finding #2.1 and Section 5 below, where this same line
   is flagged as a phase-wall framing problem).
5. **`docs/plans/2026-06-11-phase3-program.md:511-513`** (§13.8) — "the
   cutover MECHANISM is ratified as the blue/green Pi swap (ROADMAP §3b) —
   **green-Pi work opens after Phase-3 close at the earliest** (owner
   direction). The 2026-09-18 → 2026-10-18 weekly ALN run executes on
   `production-2026-07`."
6. **`docs/plans/PHASE3-STATUS.md:987`** ("Final cutover" enumeration) —
   "Green-Pi preparation opens after Phase-3 close at the earliest (owner
   direction); the 2026-09-18 → 2026-10-18 weekly run executes on
   `production-2026-07` (blue) untouched." Restates the same retired
   premise inside the live execution-state document, so the assumption is
   duplicated in all three planning documents that touch cutover timing.
7. **`docs/plans/2026-06-11-phase3-program.md:427-430`** (§12.1,
   "Development model") — "production is FROZEN until the program
   completes... final deployment = ONE coordinated cutover through the
   preflight." Weaker form of the same assumption: frames the *entire*
   post-Phase-3 hardware/cutover arc as a single event gated on program
   completion, rather than the graduated R1–R3 ladder ruling (a)
   introduces. (Flagged as supporting context, not a direct contradiction:
   blue staying frozen is compatible with green being swapped in during a
   run gap — but the "ONE coordinated cutover... completes" framing needs
   restating once cutover becomes a mid-run *decision point* rather than a
   single terminal event.)
8. **Partial counter-evidence already in the corpus** —
   `docs/plans/ROADMAP.md:271-272`: "Phase 4 is 'not months away' (owner,
   2026-07-18); the D-track wireframes can start any time." This is the
   one place the existing corpus *already* cracks the phase-wall
   assumption (planning/wireframe work for Phase-4 Track D is explicitly
   allowed to start during Phase 3) — worth noting because ruling (b) goes
   further than this precedent (moving actual run-intake *shipping*, not
   just wireframing, ahead of remaining Design-workspace-pages work).

---

## 2. Internal conflicts between documents that the re-charter must adjudicate

### 2.1 Sequencing conflict: ROADMAP's linear queue vs. the actual ratified interleaving

- **`docs/plans/ROADMAP.md:160`** (§3, "Remaining queue") states the order
  as: "...→ theme unit) → B0 → B pages → C2+C3 → C4 + DoD close-out." This
  reads as a strictly linear block: all of the Design-workspace pages unit
  finishes, *then* C2+C3 opens.
- **`docs/plans/PHASE3-STATUS.md:756-759`** (C2+C3 unit ratification,
  2026-09-04) directly contradicts that order: "**Build OPEN with
  re-sequenced order: CS.1 (rung-1 harness + pure resolve core...) runs
  FIRST, then the pages build, then CS.2–CS.5, then C4.**" C2+C3's first
  stage runs *before* the pages unit even opens, and the remaining four
  C2+C3 stages run *after* it — an interleaving ROADMAP's flat "B0 → B
  pages → C2+C3 → C4" line does not express at all.
- **`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:379-389`**
  (§8, "Re-sequenced stages") confirms the same interleaved order in the
  authoritative design doc: "CS.1... *(Pages build PS.1–PS.6 runs next —
  see the pages doc §9.)* CS.2 — dormancy lifecycle... CS.3... CS.4...
  CS.5 — close."
- **`docs/plans/2026-09-04-phase3-design-workspace-pages.md:508-510`** (§9)
  agrees from the pages side: "the pages build runs AFTER C2+C3's CS.1
  (the badges and the preview profile consume the resolve core...)."
- ROADMAP.md (RATIFIED r3, dated 2026-08-29) was never amended after the
  2026-09-04 design sessions that produced this interleaving, so its §3
  queue line is now flatly wrong about execution order — and this is
  exactly the kind of statement ruling (b)'s further re-sequencing (show
  hardening CS.2–CS.5 moving ahead of remaining pages work "where
  dependencies allow") will re-order yet again. The re-charter must
  replace ROADMAP §3's queue line, not merely annotate it.

### 2.2 DoD statements: program §7 vs. the §13.3 amendment vs. ROADMAP §3 vs. CONTEXT.md

- **`docs/plans/2026-06-11-phase3-program.md:312-314`** (§7, "Definition of
  Done — RATIFIED") — unedited original text: "Phase 3 completes when
  **A + B + C** are done and the toy-pack gate passes (**second game, zero
  engine changes, tier ladder via capability profiles**)." This embeds the
  tier-ladder/capability-profiles proof *inside* the Phase-3 toy-pack gate.
- **`docs/plans/2026-06-11-phase3-program.md:478-482`** (§13.3, amendment
  dated 2026-08-29) — "**§1/§7 toy-gate wording reconciled:** Phase 3's
  completion gate is the DUAL-PACK TIER L run (exercised every slice); the
  tier-ladder / scripted-capability-profiles proof is Phase 4 acceptance...
  **§1's parenthetical reads accordingly.**" Note precisely: the amendment
  says *§1's* parenthetical was corrected — it does not say §7's was. §7's
  own DoD sentence (line 312-314, quoted above) was never edited and still
  contains the tier-ladder clause the same amendment retired.
- **`docs/plans/ROADMAP.md:162-163`** (§3) states the reconciled version
  cleanly: "Phase 3's completion gate is the dual-pack Tier L run. The
  tier-ladder proof moved to Phase-4 acceptance (2026-08-29, Q14)."
- **`CONTEXT.md:599-604`** ("Close record / DoD") *also* states the
  reconciled version, citing program §7 as its source even though program
  §7's literal text (above) still contains the retired tier-ladder clause:
  "The DoD... is Phase 3's ratified completion checklist (program §7):
  Tracks A, B, and C are finished and the dual-pack Tier L run passes. The
  tier-ladder-proof belongs to Phase-4 acceptance, not Phase 3."
- Net effect: three of four sources (§13.3, ROADMAP §3, CONTEXT.md) agree
  on the reconciled DoD; one source — the literal, still-standing §7 text
  that all three cite as authoritative — contradicts them. This is a
  textual-hygiene defect the re-charter should fix directly (edit §7, not
  just its amendment record).
- **`CONTEXT.md:604-607`** adds a *further* completion condition neither
  program §7 nor ROADMAP §3 states: "Phase 3 is not done while any ledger
  row, doc obligation, or residue item lacks a named executor
  (PHASE3-STATUS, 'DoD linkage'..." — traced to
  **`docs/plans/PHASE3-STATUS.md:230-245`** ("DoD linkage" clause). ROADMAP
  §3's one-sentence DoD statement (line 162-163) omits this clause
  entirely, so a reader consulting only ROADMAP would believe Phase 3 is
  "done" once Tracks A/B/C ship and Tier L passes green — missing the
  ledger/doc-obligation/residue conditions PHASE3-STATUS and CONTEXT.md
  both hold as binding.

### 2.3 Estimate-rollup staleness

- **`docs/plans/2026-06-11-phase3-program.md:356-363`** (§9, re-priced
  2026-07-17): "**A3 ≈7-11.5... B0 ≈1.5-2.5 · B pages ≈3-5 · C2-C4
  ≈1.5-3 → remaining Phase 3 ≈ 13-20 sessions**."
- Actual per-unit honest estimates ratified afterward, none rolled back
  into that total: B0 landed at "**the honest 3.5–5-session estimate**"
  (`docs/plans/PHASE3-STATUS.md:267`, more than double the §9 rollup's
  1.5–2.5 for that line item); the Design-workspace pages unit priced at
  "**≈ 6–7.5 sessions**" (`docs/plans/2026-09-04-phase3-design-workspace-pages.md:511`,
  above the rollup's whole 3–5 "B pages" line); C2+C3 alone (excluding C4)
  priced at "**≈ 5.5–7 sessions**"
  (`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:402-403`,
  already exceeding the rollup's combined "C2-C4 ≈1.5-3" figure with C4
  not even included). Summing just these three ratified figures (≈15–19.5
  sessions) already approaches or exceeds the *entire* §9 rollup total for
  ALL remaining Phase-3 work (13–20), before counting slices 4/6/7 and the
  theme unit that have separately closed since. No document restates the
  rollup total; a reader of program §9 alone would carry a stale
  1.5–3-session expectation for work now separately estimated at 5.5–7+.

### 2.4 Dangling "ROADMAP item" pointer

- **`docs/plans/2026-09-04-ux-foundation.md:133-134`** (§0a, round-1
  ruling): "a GM-scanner UX overhaul under the same method is a **ROADMAP
  item**." Restated at **`docs/plans/2026-09-04-ux-foundation.md:363`**
  (phase-landing map): "GM-scanner UX overhaul (same method) | none |
  **ROADMAP item** (round-1 ruling)."
- `grep -n "GM.scanner.*UX\|GM.scanner.*overhaul\|scanner UX"
  docs/plans/ROADMAP.md` returns **no matches** — there is no §8 row for
  it. ROADMAP's own standing rule (`docs/plans/ROADMAP.md:20-24`) calls
  exactly this pattern a defect: "every deferral recorded anywhere in the
  corpus must point at a named entry in this roadmap (§8). A deferral that
  points at a vague phrase... is a defect." Ruling (b)'s third clause
  ("the GM-scanner IA/UX gets redesigned under the UX foundation's
  method") is precisely what this dangling pointer anticipated — the
  re-charter is the first place this item can get a real §8 row.

### 2.5 Q16r left open, now resolved out-of-band by ruling (d)

- **`docs/plans/2026-09-04-ux-foundation.md:466-472`** (§5r, "Open L3
  decisions", frontier r3): "**Nav words (Q16r)**: owner counter-proposal
  on the table — Design / Author / Rehearse / Run — plus the sharper
  question: is the tool's fourth item RUN or DEPLOY (the GM scanner
  holding Run)?... Recommendation: tool nav ends in DEPLOY... **held for
  the owner**."
- `grep -n "Deploy\b" CONTEXT.md docs/plans/ROADMAP.md docs/plans/2026-09-04-ux-foundation.md docs/plans/2026-09-04-phase3-design-workspace-pages.md docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md docs/plans/PHASE3-STATUS.md docs/plans/2026-06-11-phase3-program.md`
  returns **zero matches outside the Q16r passage itself** — "Deploy" as a
  ratified stage word appears nowhere in the corpus. Ruling (d) is the
  owner's answer to this exact open question, and no document in the
  corpus reflects it yet: CONTEXT.md §5b (`CONTEXT.md:442-448`) still only
  states the four *production*-level stages (Author/Rehearse/Run/Review)
  without the tool-nav-specific "Deploy" distinction ruling (d) adds. The
  re-charter must (a) close Q16r explicitly, (b) add a CONTEXT.md §5b
  entry (or sibling entry) for "Deploy" as the config-tool's nav word, and
  (c) update `docs/plans/2026-09-04-phase3-design-workspace-pages.md`
  wherever it discusses tool-level navigation.

### 2.6 L8 ledger row and ROADMAP §8.2 stale against the pages doc's own ratification

- **`docs/plans/ROADMAP.md:355`** (§8 row 8.2): "Ledger **L8** (the ENDGAME
  `target:"bluetooth"` — preserved as deliberate staging, Q9) | A
  checkpoint at the pack-manager media page: its design must either
  **retire L8**... or explicitly **re-ratify it** with a new named point."
- **`docs/plans/PHASE3-STATUS.md:256`** (ledger table, L8 row): "**[
  post-Phase-3, owner-ratified 2026-08-29 (OQ7a)...]**... | The
  pack-manager media page's design (ROADMAP §8.2 checkpoint): **retire it
  via audio roles / re-authoring, or explicitly re-ratify it**."
- Both of the above still frame the L8 question as *open*, pending the
  pages design. But **`docs/plans/2026-09-04-phase3-design-workspace-pages.md:485-487`**
  (§9, owner ratification, same day as the c2c3/pages sitting) already
  answers it: "**Q3 → RETIRE the ENDGAME `target:"bluetooth"` literal**
  (ledger L8): re-authored as an audio role; the ALN profile binds it;
  lands during this build." The checkpoint has fired and the answer is
  RETIRE — but neither ROADMAP §8.2 nor the PHASE3-STATUS ledger table
  reflects that outcome; both still read as an open future decision. This
  is a live staleness the re-charter must close (retire the L8 row, mark
  ROADMAP §8.2 done).

### 2.7 L12 taxonomy also resolved out-of-band

- **`docs/plans/PHASE3-STATUS.md:262`** (ledger row L12, recorded
  2026-08-29 at slice-6 S6.3): frames the idle-loop-channel-with-no-binding
  fallback as an unresolved future flip, landing at "the pack-manager
  media page + venue-media binding UI (ROADMAP §8.1)."
- **`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:353-357`**
  (§8, R-C3-1, ratified 2026-09-04): "unbound idle-loop channel =
  **DORMANT**. AND the require gate:... (This also fixes C4's
  `_resolveIdleLoopFile` flip: refuse only `onAbsent: require`.)" The
  taxonomy call (dormant vs. fault) that L12 needed is now made, and the
  hard-refusal flip is explicitly assigned to C4
  (`docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:394-396`, "L12
  split (S-M6)"). PHASE3-STATUS's L12 row was never updated to reflect
  this — another ledger row the re-charter must refresh, not just re-home.

---

## 3. Deferral-registry and ledger rows whose landing slot/trigger the re-sequencing would move or rename

All ROADMAP §8 rows and PHASE3-STATUS ledger rows were checked against the
rulings. Rows below need a new landing slot, a rename, or a status flip;
rows not listed were checked and found stable under the re-charter.

| Row | Current text (doc:line) | Why it moves/renames |
|---|---|---|
| ROADMAP §8.1 | `docs/plans/ROADMAP.md:354` — "**The B-pages pack-manager page** (Phase 3, Track B) owns the reference half." | Uses the retired "B-pages"/"Track B" shorthand (see §4 below); plain name is "Design-workspace pages, pack manager" (already built as PS.1, `docs/plans/PHASE3-STATUS.md:680-710`). |
| ROADMAP §8.2 | `docs/plans/ROADMAP.md:355` | Stale — the checkpoint already fired (RETIRE), see Finding 2.6. Row should read "RETIRED" with the pages-doc citation, not "must decide." |
| ROADMAP §8.3 | `docs/plans/ROADMAP.md:356` — "Slice 6 ships it as a venue-channel name reference; the pack half rides 8.1." | Slice 6 CLOSED 2026-08-29 (`docs/plans/PHASE3-STATUS.md:460-483`); the venue-channel half is done, only the 8.1-riding pack half remains — row should be split into "done" + "remaining." |
| ROADMAP §8.4 | `docs/plans/ROADMAP.md:357` — "Phase-4/5 venue tooling" | Under the readiness ladder, planning-view UI (an installer/operator tool) needs a milestone home (R4/R5-adjacent) rather than a bare "Phase-4/5" phase-wall pointer. |
| ROADMAP §8.5 | `docs/plans/ROADMAP.md:358` — "**C2+C3** (re-homed from a slice name that never existed)." | Already re-homed once; now further re-homed to a specific sub-stage — `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:129-130` puts the two scanner tests on CS.3, and `2026-09-04-phase3-c2c3-resolution-dormancy.md:260` (finding S9) notes they ride CS.3 but are not its gate criterion. Ruling (b)'s CS.2–CS.5 reprioritization directly moves this row's landing timing again. |
| ROADMAP §8.6 | `docs/plans/ROADMAP.md:359` — "E10 hot-apply \| **The B-pages era**, as part of the §2.4 loop." | Retired "B-pages era" phrase (see §4); actual landing is the named PS.2 stage — "**E10 = FOUR named steps**" (`docs/plans/2026-09-04-phase3-design-workspace-pages.md:336-344`). Row should cite "Design-workspace pages, PS.2." |
| ROADMAP §8.7 | `docs/plans/ROADMAP.md:360` — "the DoD close-out unit" | The whole notion of "DoD close-out" as a terminal Phase-3 event is a phase-wall construct (see Section 5); under the readiness ladder this bounded triage may need to be reattached to R1 (coherent-on-main) rather than a Phase-3-ending ritual. |
| ROADMAP §8.10 | `docs/plans/ROADMAP.md:363` — "Owner-paced, after **Phase-4 D intake** ships." | Ruling (b) moves run intake ahead of remaining Design-workspace-pages work — i.e., ahead of where "Phase-4 D intake" previously sat in the committed order. This row's *trigger* fires earlier than the document currently implies. |
| ROADMAP §8.13 | `docs/plans/ROADMAP.md:366` — "The Phase-4 track-entry grill sessions" | Landing slot presumes a monolithic "Phase-4 track-entry" gate; the readiness ladder's R4 (designer-previewable) and R1/R2 milestones may reach some of B4/B10's content earlier, independent of a Phase-4 entry ritual. |
| ROADMAP §8.16 | `docs/plans/ROADMAP.md:369` — "**Phase-4 E5** (interaction primitives)" | Uses the Track-E item code "E5" (needs the alias table, §4) and assumes the fix waits for a monolithic Phase 4; the new "scanner state-truth sweep" unit and the GM-scanner IA/UX redesign (ruling b) both touch the same GM-scanner surface and may reach this earlier. |
| PHASE3-STATUS ledger L8 | `docs/plans/PHASE3-STATUS.md:256` | Stale — see Finding 2.6; should read RETIRED. |
| PHASE3-STATUS ledger L12 | `docs/plans/PHASE3-STATUS.md:262` | Stale — see Finding 2.7; taxonomy (DORMANT) and the flip's owner (C4) are both already decided. |
| PHASE3-STATUS ledger L2 | `docs/plans/PHASE3-STATUS.md:250` — "One release cycle after the FINAL cutover deploys A2 everywhere" | Trigger timing depends on when the blue/green cutover actually happens; ruling (a) turns that from "fixed, after 2026-10-18" into a decision with earlier candidate windows, so this trigger's calendar position is no longer fixed either. |
| PHASE3-STATUS ledger L6 | `docs/plans/PHASE3-STATUS.md:254` — "retire when the pre-pack deployment class is gone — at latest the final cutover" | Same cutover-timing dependency as L2. |
| PHASE3-STATUS ledger L9 | `docs/plans/PHASE3-STATUS.md:257` — "Retires with L2 (the shim family dies together at cutover + one cycle)" | Same cutover-timing dependency as L2. |
| PHASE3-STATUS ledger L7 | `docs/plans/PHASE3-STATUS.md:255` — "C4 (the bindings page)" | C4's position in the sequence is itself moving under ruling (b)'s run-value resequencing (C4 currently "stays queued behind [C2+C3]'s taxonomy," `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:13-14`); L7's trigger inherits whatever new position C4 gets. |

---

## 4. Alias table — track letters / item codes in forward-looking text

Scope note: ruling (c) names three categories to retire — **track letters
(Track A–E)**, **item codes** (giving E10, B9, C2/C3/C4, B0 as examples),
and **slice numbers**. I built the table below by grepping all six
documents for every Letter+Number token matching that description and
kept every one that appears in *forward-looking* text (a plan, a queue, a
landing slot, an open question) rather than only inside a closed
execution record. Verification greps used (all run against the six
documents together):

```
grep -noE "\bTrack [A-E]\b"                              # track letters
grep -noE "\bB(0|1|2|3|4|5|6|7|8|9|10|11|12)\b"           # B-items
grep -noE "\bA[1-3]\b"                                    # A-items
grep -noE "\bC[1-4]\b"                                    # C-items
grep -noE "\bO[1-5]\b"                                    # open-question items
grep -noE "\bE(10|11|[1-9])\b"                             # E-items (both series)
grep -n "slice [0-9]\|slice 2b\|slice 3[abc]"             # slice numbers
grep -n "CS\.[1-5]\|PS\.[1-6]\|BS\.[1-4]"                 # sub-unit stage codes
```
I excluded one false-friend class found by the same greps: in
`docs/plans/2026-09-04-ux-foundation.md` §4 ("Research findings"), tokens
like B1–B7, O1–O9, H2–H12 are **citation keys for three outside research
reports** (Blender/Resolve, OBS/live-tools, Home-Assistant), not
ALN-Ecosystem process vocabulary — e.g. `2026-09-04-ux-foundation.md:272`
"B2 Workspaces: task-scoped layouts..." These are local footnote labels
scoped to that one document's §4 and do not collide with the process
codes below in practice (no reader would mistake "H6" for a Track-E
decision), but they are a second, unrelated numbering system living in
the same corpus and worth flagging to whoever builds the alias table so
they are not swept in by accident.

| Code | Plain-language name | Defining citation |
|---|---|---|
| Track A | The Pack (engine/pack schema + extraction work) | `docs/plans/2026-06-11-phase3-program.md:50` — "### Track A — The Pack (the spine)" |
| Track B | Authoring tooling / **Design-workspace pages** (already-ratified alias) | `docs/plans/2026-06-11-phase3-program.md:180` — "### Track B — Authoring tooling (consumes A, page by page)"; alias ratified at `CONTEXT.md:547-551` ("Use this full term — 'the B pages' is track-letter shorthand... that never became shared language") |
| Track C | Install/venue layer (installation profile + resolution + dormancy) | `docs/plans/2026-06-11-phase3-program.md:200` — "### Track C — Install/venue layer (co-evolves with A1)" |
| Track D | The GM experience (four-domain UX + report intake) | `docs/plans/2026-06-11-phase3-program.md:219` — "### Track D — GM experience..."; `docs/plans/ROADMAP.md:247` |
| Track E | The player platform (spikes, tap-to-web, function-gated auth, interaction primitives) | `docs/plans/2026-06-11-phase3-program.md:229` — "### Track E — Player platform..."; `docs/plans/ROADMAP.md:253` |
| A1 | Schemas (game.json / pack-manifest / tokens.schema.json v2) | `docs/plans/2026-06-11-phase3-program.md:53` — "**A1. Schemas (3.1):**" |
| A2 | Runtime pack loading (backend serves the active pack; scanners fetch at runtime) | `docs/plans/2026-06-11-phase3-program.md:62` — "**A2. Runtime pack loading (3.1.5):**" |
| A3 | The extraction grind (the slice-by-slice engine→pack migration) | `docs/plans/2026-06-11-phase3-program.md:71` — "**A3. The extraction grind**" |
| B0 | Config-tool tooling foundation (draft→publish store, auth, harness) | `docs/plans/2026-06-11-phase3-program.md:182` — "**B0 first**... pack/profile store with draft→publish lifecycle" |
| B1 | Pack modes (game.json `modes` block design decision) | `docs/plans/2026-06-11-phase3-program.md:53` — "modes B1" |
| B2 | Scoring tables (game.json `scoring` block design decision) | `docs/plans/2026-06-11-phase3-program.md:53` — "scoring tables B2" |
| B3 | Group rules (game.json `groupRules` design decision) | `docs/plans/2026-06-11-phase3-program.md:54` — "group rules B3" |
| B4 | Team/player-management design questions | `docs/plans/ROADMAP.md:366` — "The B4 team/player-management questions" |
| B8 | Lighting-role indirection (role→instrument bindings) | `docs/plans/2026-06-11-phase3-program.md:156` — "referencing ROLES (lighting roles per B8..." |
| B9 | The session-bundle schema (structured report contract, per-game state namespaces) | `docs/plans/2026-06-11-phase3-program.md:56` — "narrative/report config B9"; `docs/plans/ROADMAP.md:248` — "report intake writing B9 bundles" |
| B10 | Player-interaction brainstorm | `docs/plans/ROADMAP.md:366` — "the B10 player-interaction brainstorm" |
| B11 | Clock & phases (game.json `gameClock` design decision) | `docs/plans/2026-06-11-phase3-program.md:54` — "clock & phases B11"; slice 5 `docs/plans/2026-06-11-phase3-program.md:167` |
| B12 | Display surfaces (renderer-selection design decision) | `docs/plans/2026-06-11-phase3-program.md:169` — "surfaces (B12** — renderer selection..." |
| C1 | Installation-profile schema | `docs/plans/2026-06-11-phase3-program.md:200` — "**C1. Installation-profile schema:**" |
| C2 | The resolution mechanism (`resolve()`; needs × profile → runs/degrades/unavailable) | `docs/plans/2026-06-11-phase3-program.md:205` — "**C2. One resolution mechanism, three faces:**" |
| C3 | Dormant-vs-fault semantics (health enum, session-start disables) | `docs/plans/2026-06-11-phase3-program.md:211` — "**C3. Dormant-vs-fault semantics:**" |
| C4 | Lighting/venue bindings page | `docs/plans/2026-06-11-phase3-program.md:216` — "**C4. Lighting bindings page** (Venue workspace)" |
| O1 | Entity/attribution schema (ledger vs. attribution roles) | `docs/plans/2026-06-11-phase3-program.md:340` (§8 table) — "O1 entity/attribution schema \| A1 game.json draft" |
| O2 | Device-class registry + affordances + function table | `docs/plans/2026-06-11-phase3-program.md:341` |
| O3 | The one-auth story (auth floor design) | `docs/plans/2026-06-11-phase3-program.md:342` |
| O4 | Interaction primitives v1 | `docs/plans/2026-06-11-phase3-program.md:343` |
| O5 | Scan-economy expression (subsumed by function assignment) | `docs/plans/2026-06-11-phase3-program.md:344` |
| E-series (decision numbers, `docs/plans/2026-06-11-phase3-program.md` "Tier A/B/C/D/E decision records") | Operational-semantics decisions E1 (cue restore), E2 (video-completion margin), E4 (cues suspend at session end), E5 (three-segment timeline), E10 (pack reload without restart / hot-apply) | `CONTEXT.md:129-138` — CONTEXT.md itself documents that this series **collides** with Track E's own E1/E2/E4/E5 numbering ("E1, E2, E4, and E5 all collide") and instructs: "Say 'decision E5' or 'Track E's E5'." |
| Track E's E1 | Spikes first (S1 NFC-tap test, S2 DNS-01 cert test) | `docs/plans/2026-06-11-phase3-program.md:230` — "**E1. Spikes first (owner, cheap):**" |
| Track E's E2 | Trust plumbing (real domain + certificate for the orchestrator) | `docs/plans/2026-06-11-phase3-program.md:233` — "**E2. Trust plumbing:**" |
| Track E's E3 | Tap-to-web receiving experience | `docs/plans/2026-06-11-phase3-program.md:236` — "**E3. Tap-to-web receiving experience:**" |
| Track E's E4 | Function-gated transaction API (device identity + pack-assigned permissions) | `docs/plans/2026-06-11-phase3-program.md:241` — "**E4. Function-gated transaction API (O3):**" |
| Track E's E5 | Interaction primitives v1 (BILL's compound-scan tap grammar) | `docs/plans/2026-06-11-phase3-program.md:250` — "**E5. Interaction primitives v1 (O4):**"; landing cited forward at `docs/plans/ROADMAP.md:369` (§8.16, "Phase-4 E5") |
| E10 (unambiguous — no Track-E collision) | Hot-apply (reload a pack without restarting the orchestrator) | `docs/plans/ROADMAP.md:122-125` (§2.4) — "**E10 hot-apply** (reload a pack without restarting the orchestrator) is what makes the loop fast" |
| Slice 0 | Dual-pack gate infrastructure (E2E_PACK_PATH, capability-gate skeleton) | `docs/plans/2026-06-11-phase3-program.md:78` |
| Slice 1 | Modes → open-vocabulary semantics flags | `docs/plans/2026-06-11-phase3-program.md:92` |
| Slice 2 | Scoring/group/duplicate/clock rules migration | `docs/plans/2026-06-11-phase3-program.md:118` |
| Slice 2b | tokens.json v2 + pack-declared category/group vocabulary | `docs/plans/2026-06-11-phase3-program.md:128` |
| Slice 3a/3b/3c | Strings & theming, split (text / formatting logic / CSS taxonomy) | `docs/plans/2026-06-11-phase3-program.md:147` |
| Slice 4 | Show-control content into the pack (cues + lighting roles) | `docs/plans/2026-06-11-phase3-program.md:155` |
| Slice 5 | Clock/phase params (multi-phase clock, trigger-starts) | `docs/plans/2026-06-11-phase3-program.md:167` |
| Slice 6 | Display surfaces (pack selects/configures the three built-in surfaces) | `docs/plans/2026-06-11-phase3-program.md:169` |
| Slice 7 | Report-template refs / B9 bundle schema | `docs/plans/2026-06-11-phase3-program.md:171` |
| "Closers" | The A3 owner-ruled closers unit (Q1/Q2/Q3/Q5/Q-3b-1 batch build) | `docs/plans/PHASE3-STATUS.md:40` — "**A3 owner-ruled closers (Q1/Q2/Q3/Q5/Q-3b-1)**" |
| "Theme unit" | The minimal theme.json unit (mode colors, rating glyph, scoreboard accent) | `docs/plans/PHASE3-STATUS.md:568` — "**THEME UNIT — ✅ FULLY CLOSED**" |
| "C2+C3" (compound code) | The resolution-mechanism + dormant-vs-fault unit (one build spanning Track C's C2 and C3 items) | `docs/plans/PHASE3-STATUS.md:713` — "**C2+C3 (resolution mechanism + dormant-vs-fault)**" |
| CS.1 | Rung-1 harness + the pure resolve() core | `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:381-386` |
| CS.2 | Dormancy lifecycle + health-enum contract change | `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:390` |
| CS.3 | Supervisor + fault verbs + scanner self-heal | `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:394` |
| CS.4 | Preflight presentation (all six C1 checklist groups + Host arm) | `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:397` |
| CS.5 | Unit close (dual-pack Tier L + rung-1 CI, review, records) | `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md:399` |
| PS.1 | Pack manager page | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:375` |
| PS.2 | Mechanics editor + E10 hot-apply (one deliverable) | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:376-378` |
| PS.3 | Strings+theme editor + real-device preview | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:379` |
| PS.4 | Show designer uplift (true-duration timeline) | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:380` |
| PS.5 | Content view (read-only draft-scoped token browser) | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:381` |
| PS.6 | Design-workspace-pages unit close | `docs/plans/2026-09-04-phase3-design-workspace-pages.md:381-383` |
| BS.1 | Grants algebra + gate runner + operator floor + observe token | `docs/plans/PHASE3-STATUS.md:613-620` |
| BS.2 | Draft store + publish pipeline | `docs/plans/PHASE3-STATUS.md:621-631` |
| BS.3 | Tool login/auth + shared store + Design/Venue split | `docs/plans/PHASE3-STATUS.md:632-642` |
| BS.4 | B0 close proofs + whole-unit adversarial review | `docs/plans/PHASE3-STATUS.md:643-663` |
| S1 (spike) | The iPhone-taps-a-token NDEF spike (PASSED 2026-07-17) | `docs/plans/2026-06-11-phase3-program.md:230` |
| S2 (spike) | The Cloudflare DNS-01 certificate spike (gates E2/Track E) | `docs/plans/2026-06-11-phase3-program.md:230`; still open per `docs/plans/ROADMAP.md:204-205` |

Ledger rows (L1–L14), finding codes (F1–F9), red-team finding codes
(R1–R24, M1–M8, S1–S10 inside the two 2026-09-04 design docs), and owner
open-question codes (Q1–Q5, Q-C2-*, Q-C3-*, D-P#, D-C#) were deliberately
**excluded** from this alias table: they are review/audit-trail citation
keys pointing at a specific finding or ruling inside one already-decided
document, not forward-facing unit-of-work names a re-charter would need
to rename. Ledger rows are handled separately in Section 3, since ruling
(b)/(c) treat them as a landing-slot question, not a vocabulary question.

---

## 5. Statements that contradict the readiness-ladder framing itself

1. **`docs/plans/ROADMAP.md:373-379`** (§9.1, "The committed order") is
   the single clearest instance of gates-as-phase-walls in the corpus:
   "Phase 3 remainder (§3 queue) → green-Pi setup and testing Stages B/C
   (§3b; starts after Phase-3 close...) → the cutover... → Phase 4 (D and
   E; internal order decided at entry) → the BILL-modules block (§6) →
   Phase 5 (§5) → the operations era (§7)." This renders the entire
   program as one strict chain of phase walls, each fully closing before
   the next opens — precisely the shape ruling (a)'s milestone ladder
   (R1–R5, reachable independently and reorderable by run-value) replaces.
2. **`docs/plans/2026-06-11-phase3-program.md:314-317`** (§7, DoD): "**D
   and E are Phase 4** — a clean phase of their own after the foundation,
   **NOT parallel tracks** (owner: cleaner boundary, the falsifiable proof
   isn't delayed behind UX/platform work)." This ratified 2026-06-12
   principle is a phase-wall commitment device — it explicitly forbids the
   kind of cross-phase reordering ruling (b) now directs (run intake,
   Track D content, moving ahead of remaining Track B/Design-workspace
   work). The re-charter must explicitly supersede this clause, not just
   route around it.
3. **`docs/plans/ROADMAP.md:247-251`** (§4, Track D gate): "Gate: the
   **four-domain UX shipped, AND report intake writing B9 bundles.**"
   bundles all of Track D's work behind one all-or-nothing gate. Under a
   milestone ladder, run intake (roster/notes/photos/accusation) could
   reach readiness independently of the four-domain UX redesign — exactly
   what ruling (b) does by pulling intake ahead of remaining Design
   workspace work. The gate-as-a-single-pass/fail-wall framing is what
   needs to go.
4. **Confirmed absence of the new framing anywhere in the corpus** —
   `grep -n "readiness milestone\|coherent-on-main\|show-proven-on-hardware\|show-deployable\|designer-previewable\|adoption-ready\|merge train walked\|green-Pi Stage B" docs/plans/*.md CONTEXT.md`
   returns **zero matches**. None of R1–R5's names, nor the "merge train
   walked" formulation of R1, exist anywhere in the six documents or
   CONTEXT.md — confirming the readiness-ladder vocabulary is wholly new
   and that every phase-wall statement above will need active
   replacement, not a synonym swap.
5. **`docs/plans/ROADMAP.md:12-18`** (Authority statement): "This document
   frames the whole arc: which phases exist, what each phase is for, who
   each phase serves, and where every deferred item lands." ROADMAP's own
   self-description is phase-first ("which phases exist... where every
   deferred item lands" inside those phases) rather than milestone-first.
   The re-charter changes the organizing axis of the document itself, not
   just individual clauses inside it.

---

## Count

| Section | Findings |
|---|---|
| 1. Post-Oct-18 assumption statements | 8 |
| 2. Internal conflicts to adjudicate | 7 (2.1 sequencing; 2.2 DoD three-way; 2.3 estimate rollup; 2.4 dangling ROADMAP pointer; 2.5 Q16r/ruling-d gap; 2.6 L8/§8.2 staleness; 2.7 L12 staleness) |
| 3. Deferral-registry / ledger rows needing a new landing slot or rename | 15 (10 ROADMAP §8 rows + 5 PHASE3-STATUS ledger rows) |
| 4. Alias-table entries (track letters + item codes + slice/stage codes) | 63 rows: 5 Track letters, 3 A-items (A1-A3), 10 B-items (B0,B1,B2,B3,B4,B8,B9,B10,B11,B12), 4 C-items (C1-C4), 5 O-items (O1-O5), 1 E-series collision note + 5 Track-E items (E1-E5) + 1 E10 entry, 9 slice-name rows (0,1,2,2b,3a/3b/3c,4,5,6,7), "closers", "theme unit", "C2+C3", 5 CS.x, 6 PS.x, 4 BS.x, 2 spikes (S1,S2) |
| 5. Readiness-ladder framing contradictions | 5 |
