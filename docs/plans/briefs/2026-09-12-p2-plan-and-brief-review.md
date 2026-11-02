# P2 plan-and-brief review brief (reader, before any implementer runs)

You read; you write one file, the review named under Output. Change
nothing else. Vocabulary: `CONTEXT.md` §2 (benign emptiness), §5
(environment ladder, rung, witness lights, simulation). Model: Opus.
You dispatch no subagents.

## Where you work

Work only under `/home/user/ALN-Ecosystem/`. The top-level
`/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are
stale clones: never read them.

## Why

The owner ruled (2026-09-12) that planning gets a real review before an
implementer starts. You are that review for the harness tasks P2b and
P2a. Three objects, three checks, one safety question.

## Inputs

1. The plan section "Pre-round tasks", pins P21–P27:
   `docs/plans/2026-09-12-block2-hardening-plan.md` (search `P21.`).
2. The briefs: `docs/plans/briefs/2026-09-12-p2b-log-guard-timer-fixtures.md`
   and `docs/plans/briefs/2026-09-12-p2a-isolation-teardown-merge-gate.md`.
3. The fact sheet: `.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-factsheet.md`
   (its "Risks the orchestrator should know" has five entries).
4. Authorities: `CONTEXT.md` §2 "Benign emptiness", §5 "Environment
   ladder / rung", "Witness lights", "Simulation"; the T1b ruling 10 in
   the plan's §9 (the witness register is pack content, generated on
   every provisioning pass); the T1a record's findings (i) in §9 (the
   log loop, the per-orchestrator log directory); the code the pins
   name, read directly where a pin's claim about it matters.

## Checks

1. **Pins against the authorities and the code.** For each of P21–P27:
   does it agree with the vocabulary and the earlier rulings, and does
   the code it names behave as the pin assumes? Quote both sides where
   they differ. In particular: does P24's fixed pack set still honor
   ruling 10, and does generating for `parity-pack` change what the
   other packs' runs see; does P25's process-group stop risk killing
   anything the rig owns; is P22 really inert under PM2.
2. **Briefs against the pins.** Every exact value traced to a pin or a
   fact-sheet line; any value the pins do not settle; any pin a brief
   drops or weakens; each completion criterion checkable; and whether
   the reproductions are bounded tightly enough for a container with
   7.3 GB free.
3. **Fact-sheet risks.** Each of the five: addressed by a pin,
   explicitly deferred with a home, or missed.

The safety question: list every process a teardown or a sweep under
these pins could kill, and say for each whether the rig or a
concurrent run could own it. Anything ambiguous is a blocking finding.

## Completion criterion

Every pin checked with both sentences quoted where they differ; every
exact value traced; every risk dispositioned; the kill list complete.
A verdict line: `DISPATCH` or `REVISE` with the findings the
orchestrator must rule on first.

## Output

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/p2-plan-brief-review.md`
with sections: Findings (numbered, severity Blocking / Should fix /
Note, the object, the quoted sentences, proposed wording); the kill
list; the risk table; the verdict. Reply with at most five lines: the
verdict and the blocking findings.
