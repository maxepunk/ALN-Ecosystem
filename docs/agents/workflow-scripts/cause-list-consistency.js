export const meta = {
  name: 'cause-list-consistency',
  description: 'Check the cause analysis, the standalone pass, the cards and the page for pieces that disagree, refute by default; then apply the fixes',
  phases: [
    { title: 'Check', detail: 'four checkers: causes 1-8, causes 9-16, cross-cutting, the page text' },
    { title: 'Fold', detail: 'apply every fix to the documents and data files' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const CON = AP + '/consistency'
const FILES = [
  AP + '/2026-10-30-cause-analysis.md (sections 1 to 7)',
  AP + '/2026-10-31-standalone-pass.md',
  AP + '/report/2026-10-31-cause-cards.json (the owner-facing cards)',
  AP + '/report/2026-10-31-standalone-lines.json (one standalone line per cause)',
  AP + '/2026-10-31-engine-jobs.md (the front of step 1 since 2026-11-01: the engine\'s ten jobs, with the flaws under each job)',
  AP + '/report/2026-10-31-engine-jobs.json (the jobs page data: per job, flaws[].how sentences and test cases)',
  AP + '/report/2026-10-31-cause-report.html (the published page, built by report/build_report.py from the JSON files plus text written in build_report.py)',
]

const COMMON = [
  'Context: the ALN show engine is in its architecture pass. Step 1 grouped every known problem (blue\'s fixes, findings blue left open, findings from the code maps) under sixteen design flaws, C1 to C16, and then checked what each flaw means in a whole standalone game (decision 22). The owner says the material is hard to follow and asked us to make sure no two pieces disagree. The pieces:',
  FILES.map(f => '- ' + f).join('\n'),
  'Supporting files: the reader sheets ' + AP + '/2026-10-30-causes-*.md, the check files ' + AP + '/2026-10-30-cause-analysis-check-*.md, the standalone sheets ' + AP + '/2026-10-31-standalone-*.md and the card check files ' + AP + '/report/2026-10-31-cards-check-*.md.',
  '',
  'A conflict is two places that state different things about the same fact: a count, a question number, a candidate design, which device decides something, what happens at a show, a finding\'s cause or status, a correction recorded in one place and not applied in another. Wording that differs but means the same is not a conflict. Refute by default: report a conflict only when you quote both texts with their locations, and settle which one is right by reading the code (file:line in the current tree) or the record it cites. When you cannot settle it, say so and do not guess.',
  '',
  'Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv. The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner are stale clones; read nothing there. Never open backend/.env. Write only your own report file; change nothing else.',
].join('\n')

const REPORT_FMT = [
  'Write your report as Markdown: a header (your scope, the files read, the date 2026-10-31); a conflicts table with columns: id, place 1 (file, section or JSON key, and the quoted text), place 2 (same), what disagrees, which is right and why (with file:line evidence), the fix (the exact replacement text for each place that is wrong); then a list of places you checked and found consistent, one line each, so the reader sees your coverage.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, unsettled: { type: 'integer' }, checked: { type: 'integer' } },
  required: ['file', 'conflicts', 'unsettled', 'checked'],
}

const CHECKERS = [
  { key: 'causes-1-8', scope: 'Your scope: causes C1 to C8. For each cause, compare every statement about it across: the cause analysis section 1 paragraph, its section 2 entry (statement, findings table, other places, candidate designs, proving tests, questions), its section 5 placements and the section 5.6 count, its card (title, atAShow, whyItHappens, designTerms, examples, findings, questions, blueFixes, seenLive, the after note), its standalone line and its standalone pass section 2 entry, every sentence the engine-jobs document and its JSON write about it (flaws[].how under each job, and any test case drawn from it), and the corrections recorded in section 6 of the cause analysis and section 7 of the standalone pass (a correction must be applied in every place, not only one).' },
  { key: 'causes-9-16', scope: 'Your scope: causes C9 to C16, the same comparison as for C1 to C8: the cause analysis section 1 paragraph, section 2 entry, section 5 placements and 5.6 count, the card, the standalone line and the standalone pass section 2 entry, every sentence the engine-jobs document and its JSON write about it, and whether every recorded correction (cause analysis section 6, standalone pass section 7) is applied in every place.' },
  { key: 'cross-cutting', scope: 'Your scope: clashes between causes and between sections. Check: a finding id described two different ways in two places; one cause saying something happens that another says does not (for example what a reload does, what Reset System does, what the ESP32 does with no engine); section 3 (set aside) against every other mention of those ids; section 4 (live proof) against the findings\' live-proof marks and the four reproductions the program document names (docs/plans/2026-10-30-architecture-pass.md section 4.1, step 2); section 7 and the standalone pass against sections 1 to 5 (for example, a cause the standalone pass says "does not apply" while section 2 says otherwise); every count stated anywhere (357, 336, 21, 35, 161, the per-cause counts, the check numbers) against a count you make yourself from the documents; and the engine-jobs document\'s section 5 coverage and job placements against the analysis and the standalone pass.' },
  { key: 'page', scope: 'Your scope: the published page\'s own text, written in ' + AP + '/report/build_report.py and visible in the built page ' + AP + '/report/2026-10-31-cause-report.html. Since 2026-11-01 the page leads with the engine\'s jobs: the lead, the "What you are deciding" box, "What the engine is for", "How to read a job", "The ten jobs at a glance" table, each job section (its fields come from report/2026-10-31-engine-jobs.json, which had its own check: verify only that the page shows them faithfully, and check the "Built today" lines in the BUILT table of build_report.py against the root CLAUDE.md and the direction map\'s built capabilities), the flaw cards nested under their main job, the standalone section, the evidence section (its counts and the set-aside table against cause analysis section 3) and the questions section (numbers, options and recommendations against docs/plans/CURRENT-STATE.md section 0 and the engine-jobs document section 4). For the page, give each fix as the exact old text in build_report.py and its replacement.' },
]

phase('Check')
const checks = await parallel(CHECKERS.map(c => () => agent([
  COMMON, '', c.scope, '', REPORT_FMT,
  'Write it to ' + CON + '/2026-10-31-consistency-' + c.key + '.md. Then return the structured summary.',
  'Done when: every place in your scope is either in the conflicts table or in the consistent list.',
].join('\n'), { label: 'check:' + c.key, phase: 'Check', model: 'opus', effort: 'high', schema: SCHEMA })))
const files = checks.filter(Boolean).map(c => c.file)
log('checks: ' + checks.filter(Boolean).map((c, i) => CHECKERS[i].key + ' ' + c.conflicts + ' conflicts, ' + c.unsettled + ' unsettled').join('; '))

const FOLD_SCHEMA = {
  type: 'object',
  properties: { applied: { type: 'integer' }, skipped: { type: 'integer' }, pageFixesLeft: { type: 'integer' } },
  required: ['applied', 'skipped', 'pageFixesLeft'],
}
phase('Fold')
const fold = await agent([
  COMMON, '',
  'Your job: apply the fixes from the check reports ' + files.join(', ') + '.',
  'Apply each settled fix in place, in these files only: ' + AP + '/2026-10-30-cause-analysis.md, ' + AP + '/2026-10-31-standalone-pass.md, ' + AP + '/2026-10-31-engine-jobs.md, ' + AP + '/report/2026-10-31-cause-cards.json, ' + AP + '/report/2026-10-31-standalone-lines.json, ' + AP + '/report/2026-10-31-engine-jobs.json. Keep the three JSON files valid (parse them after editing) and keep every card field within its limit (title 9 words, atAShow 70, whyItHappens 50, designTerms 45, after note 35, standalone line 45). Leave the fixes the "page" report gives for build_report.py alone: the orchestrator applies those.',
  'Then append to the cause analysis a section "## 8. Consistency check (2026-10-31)": one line per change, naming the report row it came from, and one line per unsettled conflict saying what remains open.',
  'Return the structured summary: fixes applied, fixes skipped (with reasons in section 8), and how many page fixes the orchestrator must apply.',
  'Done when: every settled conflict in the reports is applied or listed in section 8 with a reason, and all three JSON files parse.',
].join('\n'), { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return { checks, fold }
