# The supervisor lane — plan-and-brief review brief (reader, before any implementer runs)

You read; you write one file, the review named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (one truth, three loops), §4
(dormant vs fault, alarm integrity, status with verbs), §5 (paper vs
live). Model: Opus. You dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them. The main checkout may be on another
lane's task branch with uncommitted backend test-harness edits; a clean
tree of the designated branch is at `.worktrees/docs`.

## Why

The owner ruled (2026-09-12) that planning gets a real review before an
implementer starts. You are that review for the supervisor lane, the
largest lane of the block: four pins, five orchestrator rulings, one
brief, four checks.

## Inputs

1. The pins: `docs/plans/2026-09-12-block2-hardening-plan.md` §3 P10,
   P11, P12, P13 (search `P10.`), P7 (the reason normalization P12
   cites), P3 and P5 (dormant never holds; the dormant branch), the
   rulings R6, R13, R15 in §1, the task section "the supervisor and the
   fault buttons" in §4, §6 Global constraints.
2. The implementer brief: `docs/plans/briefs/2026-09-12-supervisor-lane.md`,
   including its five rulings R-S1–R-S5.
3. The fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-factsheet.md`
   (all ten sections; verify file:line claims the brief depends on).
4. The collision matrix's supervisor rows:
   `.superpowers/sdd/2026-09-12-block2-hardening-plan/collision-matrix.md`.
5. The authorities: the spec
   `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md` §8
   (R-C2-1, R-C3-1, R-C3-2 and neighbours where a pin cites them);
   `CONTEXT.md` §4 "Dormant vs fault", "Alarm integrity", "Status with
   verbs"; `ROADMAP.md` §3 (the show-ready gate).

## Checks

1. **Pins against the authorities and the code.** For each of P10–P13:
   agreement or contradiction with the spec, the vocabulary and what the
   code does today — name the sentence on each side. In particular:
   does R-S2 (an exit not initiated by stop/restart counts, whatever the
   stdout) agree with alarm integrity, and is there any process whose
   normal behaviour would trip it? Does R-S3's meaning of `off` serve
   R13's fallback (removes every automatic kill and restart; boots as
   today), and is there a better reading of P11's three modes? Does
   R-S1 (a shared pure policy; Chromium keeps its own spawn) satisfy
   P10's "chromium is display-aware" without duplicating ruling 27's
   logic? Does R-S4 satisfy P13 given the two hold stores are different
   implementations?
2. **Brief against the pins.** Every clause of P10–P13 has a
   deliverable and a red-first seam; every deliverable traces to a
   clause; nothing exceeds the pins. Name any pin clause the brief
   drops or weakens (e.g. P10's "computed-delay cap and non-finite
   fallback", P12's "marks past-due cues fired", P11's headroom).
3. **Would the seams go red, then green?** For each red-first line:
   fails today for the stated reason, passes after. Name seams that are
   green already or unreachable. Check the exact strings the brief pins
   (the `gave-up` message, the alias mapping, the mode names) against
   the pins and the contract.
4. **Collision and size.** The shared-file rules against R15 and the
   matrix: are the reserved sections right (the `action` enum tail,
   `gmAuth.js`, the scanner router)? Is the lane too large for one
   implementer at one review — if so, name the seam to cut it at
   (backend policy+config+verbs | holds+display | scanner verbs+audit)
   and what each part's close gate would be.

## Output

`.superpowers/sdd/2026-09-12-block2-hardening-plan/supervisor-lane-review.md`,
opening with a `## Conclusions` section of at most 40 lines: the
verdict (DISPATCH / REVISE), blocking findings first, each one line
with the sentence to change; then the evidence sections. Return to the
orchestrator only: the verdict and the count of blocking findings.
