# The self-heal lane — plan-and-brief review brief (reader, before any implementer runs)

You read; you write one file, the review named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (one truth, three loops), §5
(activation frozen at boot, the pack channel). Model: Opus. You
dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them. Scanner files: the main checkout's
`ALNScanner/` (committed HEAD `e83723c`). Backend E2E harness files: the
main checkout may carry uncommitted harness-minimum edits to
`backend/tests/e2e/setup/test-server.js`; read the committed version
from `.worktrees/docs`.

## Why

The owner ruled (2026-09-12) that planning gets a real review before an
implementer starts. You are that review for the self-heal lane: one
pin, five orchestrator rulings, one brief, four checks.

## Inputs

1. The pin: `docs/plans/2026-09-12-block2-hardening-plan.md` §3 P14
   (search `P14.`), the rulings R15 in §1, the task section "the
   scanner's pack self-heal" in §4, DoD (h) in §5, §6 Global constraints.
2. The implementer brief: `docs/plans/briefs/2026-09-12-self-heal-lane.md`
   with its rulings R-H1–R-H5.
3. The fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-factsheet.md`
   (all sections; verify file:line claims the brief depends on).
4. The collision matrix's self-heal rows:
   `.superpowers/sdd/2026-09-12-block2-hardening-plan/collision-matrix.md`.
5. The authorities: the spec
   `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md` §8 R-C2-1
   (the self-heal ruling) and its neighbours; `CONTEXT.md` §5 (the pack
   channel, staleness); `ROADMAP.md` §8.5 row (the two owed tests) and
   `PHASE3-STATUS.md:106-109`; `ALNScanner/CLAUDE.md` "Pack loading".

## Checks

1. **Pin and rulings against the authorities and the code.** Does P14
   as the brief states it agree with R-C2-1 and the vocabulary? Does
   R-H1 (validate with predicates that mirror the apply chain; flip;
   apply in place) honour "validates the consumer re-apply against the
   staged content and only then flips", and is the test seam "re-apply
   failure leaves pointer and cache untouched" reachable under it —
   name what an apply-time failure NOT covered by a predicate would do.
   Is R-H2's boundary the pin's boundary (both halves), and is the
   read-before-overwrite ordering right? Is R-H3's single 750 ms retry
   what "one short bounded retry" means?
2. **Brief against the pin.** Every clause of P14 and DoD (h) has a
   deliverable and a red-first seam; every deliverable traces back;
   nothing exceeds the pin. Say whether R-H5's flow proves DoD (h) as
   worded (a scanner in the browser reconnecting with the new hash),
   and whether the toy leg + `toy-heist` → `parity-pack` restart is
   feasible in the Tier L harness (fact sheet §8; the scanner served
   from `backend/public/gm-scanner` needs a rebuilt `dist`).
3. **Would the seams go red, then green?** For each red-first line:
   fails today for the stated reason, passes after. Name seams green
   already or unreachable. The two §8.5 tests: does the brief's
   description match the roadmap's intent (a behavioural timeout, a
   forced interleaving)?
4. **Collision and size.** The shared-file rules against R15 and the
   matrix (the router's `sync:full` case; `test-server.js` after the
   harness minimum; the supervisor lane's scanner files). Is the lane
   too large for one implementer at one review — if so, name the seam
   to cut (loader+manager | router+UI+reconnect | owed tests+flow) and
   each part's close gate.

## Output

`.superpowers/sdd/2026-09-12-block2-hardening-plan/self-heal-lane-review.md`,
opening with a `## Conclusions` section of at most 40 lines: the
verdict (DISPATCH / REVISE), blocking findings first, each one line
with the sentence to change; then the evidence sections. Return to the
orchestrator only: the verdict and the count of blocking findings.
