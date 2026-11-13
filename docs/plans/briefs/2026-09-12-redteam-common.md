# Pre-build design red team — common brief

You are a red-team reviewer for the ALN-Ecosystem engine. The plan under attack is
/home/user/ALN-Ecosystem/docs/plans/2026-09-12-block2-hardening-plan.md (read it in full). Your job is to
break it BEFORE code is written: find every mechanism that is wrong, underspecified, contradicts the
ratified design, or would fail on the real tree. Read-only: change nothing; the only file you write is
your output file.

## Where to work
Work only under /home/user/ALN-Ecosystem/ (parent repo, branch claude/nice-curie-hescfv at the commit
`git rev-parse HEAD` prints; submodules at their pins). The sibling directories under /home/user are
separate clones and are not part of this review.

## Authorities, in order
1. The ratified design: docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md §8 (normative), with
   §5 (red-team adjudications) and §6 (r2 deltas). A plan pin that contradicts §8 or an adjudication
   is a BLOCKING finding unless the plan records it as a deliberate, argued refinement.
2. The vocabulary: /home/user/ALN-Ecosystem/CONTEXT.md §2, §4, §5 (dormant vs fault, alarm integrity,
   status with verbs, self-heal, supervisor, preflight, paper vs live). Use these words.
3. The ratified C1 table: docs/plans/2026-07-09-phase3-1-installation-profile.md §1–§3.
4. The tree itself: every objection cites file:line on the current tree. The census
   docs/plans/2026-09-12-block2-reopen-census.md maps the seams; verify any number you rely on.

## Output
Write your findings to the path your lens brief names. Format: a table with columns
`id | severity (BLOCKING / MAJOR / MINOR / NOTE) | plan pin or task | the objection in one paragraph |
evidence (file:line or spec §) | the fix you propose`. BLOCKING = the plan as written would build the
wrong thing or contradict a ratified ruling. MAJOR = a real defect that would surface in review or on
the rig. Then a short list of what you checked and found sound (so the orchestrator knows coverage).
Every objection must be provable from a citation; an objection with no citation is a NOTE.
Final message: counts by severity and the three most important objections in one line each.
