# Workflow scripts (recovered 2026-10-30)

Three scripts the hardening block used, recovered verbatim from the
session transcript after the container that held them was reclaimed.
They are working tools, not requirements: a brief stays the single
source of requirements for any task they run.

| Script | What it does | Status |
|---|---|---|
| `redteam-brief.js` | Pre-build adversarial review of one implementer brief: two attacking lenses, one independent refuter per finding, a written report | Ran three times on 2026-09-13. Each run spent several million subagent tokens; together they hit the session's usage limit, and two writers never ran. |
| `lane-build.js` | Builds one lane from its brief: per task an implementer, a task review, at most three fix rounds; a whole-lane review when the lane has several tasks; then a hostile tester with one refuter per finding | Never completed a run: its first implementer was stopped by the usage limit after seven unpushed commits, which the container loss then destroyed. |
| `cause-analysis.js` | The architecture pass's phase 1, step 1: four readers split by source (blue's records, the backend, the GM scanner, the other clients and tests), a merge that groups every finding by design cause, a refute-by-default check in two halves, and a fold that applies the check. Takes no arguments | First run 2026-10-30, `wf_5b8300fe-cb6` |
| `cause-report-cards.js` | Draws the cause analysis as cards for the owner: four drafters write one card per cause (plain-words story, before-and-after Mermaid diagrams, the codebase-design vocabulary), two checkers test every card against the analysis and the code, a fold writes the final cards file | First run 2026-10-31, `wf_6fea384f-ddd` |
| `standalone-pass.js` | Decision 22's evidence: what a whole standalone game needs from each of the sixteen causes; two readers (the GM scanner; the web and ESP32 player scanners with the parity gap), a merge, a refute-by-default check and a fold that writes one standalone line per card | First run 2026-10-31, `wf_d1152165-580` |
| `cause-list-consistency.js` | Checks the cause analysis, the standalone pass, the cards and the published page for pieces that disagree (four refute-by-default checkers: causes 1 to 8, causes 9 to 16, cross-cutting, the page text), then folds the fixes | First run 2026-10-31, `wf_1dea6411-991` |
| `engine-jobs.js` | Restructures step 1 around the engine's jobs (decision 26): two mappers place the 52 capabilities and the design flaws on a draft list of jobs, a writer produces the jobs document and the page data, a refute-by-default check and a fold | First run 2026-10-31, `wf_f3c1ef9e-a97` |
| `engine-shape.js` | How the engine's jobs relate and where each lives today, at the component and module levels, with a candidate shape for the engine's parts: four readers, a shape writer, a refute-by-default check, a fold | First run 2026-11-01, `wf_5f2445a0-bac` |
| `cut-lane-worktree.sh` | Cuts and provisions one lane worktree from the designated branch, with an ALNScanner branch of the same name when the lane edits the scanner | Proven on 2026-09-12. Pass `scanner` for every lane that edits the scanner; one lane was cut without it by mistake. |

How to run the two workflow scripts: pass the script file to the
Workflow tool as `scriptPath`, with the arguments each script reads
from `args`. The fields are listed at the top of each file. A stopped
run resumes from its run id only inside the session that started it.

Lessons from their use, also recorded in `docs/agents/process.md`:
- Size a fleet to the question. Several large fleets at once exhaust
  the session's usage limit and stop every running agent.
- Have each workflow write its findings into the repository, or copy
  them there as soon as they land. Scratch files die with the
  container.
- An unpushed task branch dies with the container. Only the
  designated branch is pushed today; whether task branches may be
  pushed as a backup is the owner's call, still open.
