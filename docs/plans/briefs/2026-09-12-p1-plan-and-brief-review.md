# P1 plan-and-brief review brief (reader, before any implementer runs)

You read; you write one file, the review named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (the gate, one truth), §4
(dormant vs fault, alarm integrity), §5 (preflight, paper vs live).
Model: Opus. You dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them.

## Why

The owner ruled (2026-09-12) that planning gets a real review before an
implementer starts, because three wrong lines in an earlier brief went
straight into code. You are that review for task P1. Two objects, three
checks.

## Inputs

1. The plan section "Pre-round tasks" with pins P17–P20:
   `docs/plans/2026-09-12-block2-hardening-plan.md` (search `P17.`).
2. The implementer brief: `docs/plans/briefs/2026-09-12-p1-profile-check.md`.
3. The fact sheet the pins were written from:
   `.superpowers/sdd/2026-09-12-block2-hardening-plan/p1-factsheet.md`.
4. The authorities the pins must agree with: the spec
   `docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md` §8
   (R-C3-1, the require gate; R-C2-2); `CONTEXT.md` §2 "One truth,
   three loops" and "The gate", §4 "Dormant vs fault" and "Alarm
   integrity", §5 "Preflight" and "Paper vs live checks"; the plan's
   pins P7 (the require gate; `blocking` closed) and P8 (one preflight
   evaluator); and the owner's ruling recorded in the plan section: a
   profile that fails its check blocks `session:start`, typed override
   available.

## Checks

1. **Pins against the authorities.** For each of P17–P20: does it
   agree with the spec and the vocabulary, or does it contradict them?
   Name the sentence on each side. P19 deliberately widens `blocking`
   from two rules to three under the owner's ruling; say whether the
   widening is stated narrowly enough that no future arm can ride it,
   and whether "paper" is the right depth label for a file-against-
   schema fact.
2. **Brief against the pins.** Every exact value in the brief
   (module name, function names, need kind and id, row id, reason
   format and cap, fixture path, flow name, the pinned `packPath` and
   `profilePath`) traced to a pin or to a fact-sheet line; any value in
   the brief that the pins do not settle; any pin the brief drops or
   weakens; the completion criterion checkable (what could an
   implementer claim done without having done?).
3. **Fact-sheet risks.** For each of the seven "Risks the orchestrator
   should know" in the fact sheet: addressed by a pin, explicitly
   deferred with a home, or missed.

Also answer: does P18 (load the content anyway, mark not valid, block
the start) serve the GM better on show night than refusing the content,
given CONTEXT.md §4 "Alarm integrity" and §2 "one truth"? One paragraph
with the reasoning either way.

## Completion criterion

Every pin checked against every named authority with both sentences
quoted; every exact value in the brief traced; every fact-sheet risk
dispositioned. A verdict line: `DISPATCH` (no blocking finding),
`REVISE` (list the findings the orchestrator must rule on first).

## Output

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p1-plan-brief-review.md`
with sections: Findings (numbered, each with severity Blocking / Should
fix / Note, the object it is in, the quoted sentences, and the proposed
wording); the P18 paragraph; the risk table; the verdict. Reply with at
most five lines: the verdict and the blocking findings.
