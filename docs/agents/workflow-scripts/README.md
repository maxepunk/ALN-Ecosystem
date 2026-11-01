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
| `reconcile-shape.js` | Brings the owner page's flaw cards and job entries into line with the engine shape: three card groups and the ten jobs, each written by one agent and checked refute-by-default by another, corrections applied in each group's overlay (merged into the page data by hand) | First run 2026-11-01, `wf_b02b162e-653`: 8 agents, 182 verdicts, 96 corrected; the checks lengthened the text, which the plain-words stage of `page-consistency.js` then cut |
| `page-consistency.js` | Puts the owner page's card and job text into plain words within firm lengths (three editors writing overlays), merges them with `report/merge_plain.py` and rebuilds, then two refute-by-default readers check the whole page (the new section and the questions against the shape; the jobs and cards against the section and the edits against their originals). Pass `args.base`, the commit before the edits, so a mid-run commit does not hide them | First run 2026-11-01, `wf_c3571dd0-522`: 6 agents; 27 and 30 conflicts, all applied by hand |
| `page-fix-verify.js` | One refute-by-default reader confirms each conflict the page checks found is resolved on the rebuilt page, and lists any new conflict the fixes introduced | First run 2026-11-01, `wf_206a51c3-758` |
| `vocab-promises.js` | Applies the owner's vocabulary decision 27 to the owner page's data: three editors (the cards and standalone lines; the promises; the shape's page data), each rewriting its files' owner-facing strings into promise words, exact titles and "venue technician", with a log per file | First run 2026-11-01, `wf_d5b390ac-27a`: 3 agents, 46 strings changed |
| `vocab-check.js` | Two refute-by-default readers check the rebuilt page against decision 27 and for meaning kept (the top, the section and the questions; the promises and the cards). Pass `args.base`, the commit before the vocabulary edits | First run 2026-11-01, `wf_81c41f8d-ec0`: 15 and 13 conflicts, all applied |
| `shape-picture-check.js` | Two refute-by-default readers check the page's whole-engine picture and its five walkthroughs against the candidate shape (one reader each) | First run 2026-11-01, `wf_ef6158a7-f16` |
| `picture-fix-verify.js` | One refute-by-default reader confirms the picture and walkthrough fixes on the rebuilt page against the shape | First run 2026-11-01, `wf_6b57ff3f-3f3` |
| `site-content.js` | For the owner site (decision 29): three writers draft the front page, the Decisions page and the change log as JSON overlays, and a reader lists every element of version 7 with its home on the site; each output is checked refute-by-default, then corrected | First run 2026-11-01, `wf_d5c8c6db-981`: 12 agents, 41 conflicts, 40 applied |
| `site-build.js` | One builder writes `report/build_site.py` and `report/site_smoke.js` from the site plan, the inventory and the overlays, builds the six pages and smoke-tests them at two widths in both themes | First run 2026-11-01, `wf_c3df370d-0dc` |
| `site-check.js` | Six refute-by-default readers check the built site page by page; one editor applies every conflict, rebuilds and smoke-tests; two readers verify each fix. Pass `args.base`, the commit the checks read | First run 2026-11-01, `wf_73d06a3f-69f` |
| `site-fix-verify.js` | One editor settles the partly-resolved and new rows of the site checks' verification with the orchestrator's rulings on the judgment calls, rebuilds and smoke-tests; two readers verify and read the pages whole. Pass `args.base` | First run 2026-11-01, `wf_88aa92da-12e` |
| `site-final-verify.js` | One refute-by-default reader confirms the last hand fixes on the rebuilt pages and reads only the lines they changed | First run 2026-11-01, `wf_2d4b9ada-f47`: 15 of 16 resolved, 6 small slips |
| `jargon-sweep.js` | After the owner found carried-over jargon on the front page: six readers, one per page, list every term the owner could not understand without the internal documents, with each occurrence and a plain wording; one agent merges them into a site-wide table, one wording per term | First run 2026-11-01, `wf_f936e773-ae0` |
| `requirements-drafts.js` | Drafts the requirements the top-down order adds: quality targets as testable situations and the ways the platform must be extended, and by whom; one writer each, a refute-by-default check each, corrections | First run 2026-11-01, `wf_f5869e39-e8b`: 42 targets, 24 cases |
| `decision-record.js` | Rebuilds the owner's decision record by topic with titles instead of numbers: an inventory of every numbered decision and question, the record as current truth with dated history, a refute-by-default check, then the state page and living documents pointed at it | First run 2026-11-01, `wf_f813af13-7fd`: 28 standing entries in six topics |
| `site-v9-content.js` | Writes the owner site's version 9 content for the proactive frame: the front page, Decisions and Design overlays, requirement titles, the page data's plain wordings and the change log; a refute-by-default check and corrections per output | First run 2026-11-01, `wf_e076baba-f34`: 18 agents, 99 conflicts, 95 applied |
| `site-v9-build.js` | Builds version 9: a writer drafts the standing rules from the roadmap and another puts the requirements into plain words (with a settled/proposed kind per item); one builder restructures `build_site.py` and `site_smoke.js` for the six pages while each content piece is checked refute-by-default and corrected | First run 2026-11-01, `wf_0a97fbef-eae` |
| `cut-lane-worktree.sh` | Cuts and provisions one lane worktree from the designated branch, with an ALNScanner branch of the same name when the lane edits the scanner | Proven on 2026-09-12. Pass `scanner` for every lane that edits the scanner; one lane was cut without it by mistake. |

How to run the workflow scripts: pass the script file to the
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
