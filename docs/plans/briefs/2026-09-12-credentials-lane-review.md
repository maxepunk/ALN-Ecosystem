# The credentials lane — plan-and-brief review brief (reader, before any implementer runs)

You read; you write one file, the review named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (one truth, three loops), §4
(alarm integrity). Model: Opus. You dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them. Read the repository at the designated
branch's content; the main checkout may be on a task branch of another
lane (the harness minimum) — its backend edits are not this lane's.

## Why

The owner ruled (2026-09-12) that planning gets a real review before an
implementer starts. You are that review for the credentials lane: one
pin, one brief, three checks.

## Inputs

1. The pin: `docs/plans/2026-09-12-block2-hardening-plan.md` §3 P15
   (search `P15.`), the ruling R5 in §1, the lane policy R15 in §1, the
   task section "credentials on every connection" in §4, and §6 Global
   constraints.
2. The implementer brief: `docs/plans/briefs/2026-09-12-credentials-lane.md`.
3. The fact sheet the brief was written from:
   `.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-factsheet.md`
   (all sections; verify its file:line claims against the code where a
   brief line depends on them).
4. The collision matrix's credentials rows:
   `.superpowers/sdd/2026-09-12-block2-hardening-plan/collision-matrix.md`
   (section "Credentials (T3b)" and the `asyncapi.yaml` / `gmAuth.js`
   rows).
5. The authorities: `CONTEXT.md` §2 and §4; the observe-token entry in
   `CONTEXT.md` (search "Observe token").

## Checks

1. **Pin against the authorities and the code.** Does P15 as the brief
   states it agree with the vocabulary and with what the code does
   today (fact sheet §1, §4)? Name any sentence that contradicts. Say
   whether refusing every non-`gm` deviceType breaks any real client
   (fact sheet §4 lists them all) and whether the scoreboard's path
   (`verifyObserveToken` fall-through) survives the brief's handshake
   order (a)–(f) unchanged.
2. **Brief against the pin.** Every clause of P15 that is in scope has a
   deliverable and a red-first seam, except the held eviction clause —
   confirm the brief holds it and says why. Every deliverable traces to
   a pin clause; nothing in the brief exceeds the pin. The three tests
   the pin names are each handled (fact sheet §6); say whether the
   brief's rewrite of `room-broadcasts.test.js:81` keeps the test's
   purpose or should be dropped, and what an observe socket receives
   today (fact sheet §1/§7 and `gmAuth.js`).
3. **Would the seams go red, then green?** For each red-first line:
   the test as described fails on today's code for the stated reason
   and passes after the described change. Name any seam that is green
   already or unreachable. Check the exact message text the brief pins
   (`AUTH_REQUIRED: deviceType must be gm`) against the existing
   `AUTH_REQUIRED:` shape in `socketServer.js` and against any contract
   listing of `connect_error` messages; say whether the contract needs
   a line.
4. **Collision.** The brief's shared-file rules against R15 and the
   matrix: does the lane's file list stay inside what it names, and is
   the `show-control` room join correctly kept out?

## Output

`.superpowers/sdd/2026-09-12-block2-hardening-plan/credentials-lane-review.md`,
opening with a `## Conclusions` section of at most 40 lines: the
verdict (DISPATCH / REVISE), blocking findings first, each one line
with the sentence to change; then the evidence sections. Return to the
orchestrator only: the verdict and the count of blocking findings.
