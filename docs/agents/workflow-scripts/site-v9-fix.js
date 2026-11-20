export const meta = {
  name: 'site-v9-fix',
  description: "Settle the owner site version 9's partly-resolved and new conflicts with the lead agent's rulings, rebuild, then verify the whole site refute-by-default",
  phases: [
    { title: 'Apply', detail: 'one editor settles the partly-resolved and new rows' },
    { title: 'Verify', detail: 'two refute-by-default readers confirm the fixes and read the pages whole' },
  ],
}

// args.base: the commit before this round (the verifiers diff against it).
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const OUT = SITE + '/v9'
const CHECKS = SITE + '/checks'
const REQ = AP + '/requirements'
const PLAN2 = SITE + '/2026-11-01-site-plan-v2.md'
const PLAN1 = SITE + '/2026-11-01-site-plan.md'
const REC = AP + '/DECISIONS.md'
const JT = CHECKS + '/jargon-table.md'
const ROADMAP = ROOT + '/docs/plans/ROADMAP.md'
const BRIEF = AP + '/panel/2026-11-01-panel-brief.md'
const SCRATCH = '/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad'
const MERMAID_JS = SCRATCH + '/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js'
const BASE = args && args.base ? args.base : 'HEAD'

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) is redesigning the engine for the long term. Their goal, in their words: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)". Their site "What the Engine Promises", version 9, is six linked pages built into ${SITE}/ by ${RP}/build_site.py from the plan ${PLAN2} (where it is silent, ${PLAN1} sections 2, 4, 5 and 6 hold). Its sources: the overlays in ${OUT} (front.json, decisions.json, design.json, changes.json, rules.json), the requirements ${REQ}/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json, the page data in ${RP} (2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json, 2026-10-31-standalone-lines.json, 2026-11-01-engine-shape.json), the decision record ${REC}, the roadmap ${ROADMAP}, the panel's brief ${BRIEF} and the jargon table ${JT}. The pages were checked page by page (${CHECKS}/v9-page-*.md), fixed (${CHECKS}/v9-apply-log.md) and verified (${CHECKS}/v9-verify-a.md, ${CHECKS}/v9-verify-b.md).

The rules (plan v2 sections 2 and 6): the requirements and the decisions ahead come first; today's engine is evidence and test situations, never the reason for a design; the earlier 17-part candidate is one input among the panel's, never current or decided, and is called "the earlier candidate" on every page but the change log; decisions as the record states them, by their titles, with readings the record marks "to be confirmed" never shown as settled; titles, not numbers (no visible id; question letters only on Decisions; no numbered lists of decisions, steps or choices; no bare phase, step, block, round, decision or question number outside the change log); the jargon table's wordings, and any term the owner could not understand without the internal documents is a conflict; the agent running the pass, never "the orchestrator"; the panel's "blind round" and "second round"; the owner is "you" throughout; plain, short, active sentences; no metaphors; no em dashes; a title dropped bare into the middle of a sentence is a conflict (reword, quote it, or put it last); facts match their sources.

Read a page as text, diagram labels kept: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); t=re.sub(r'<script>.*?</script>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit.`

const RULINGS = `The lead agent's rulings on the judgment calls (follow them):
1. The hardening block's finished pieces carry one wording on every page: "the kinds of equipment a pack can ask for and a venue profile can name, the code that marks equipment not installed tonight, and the smallest test set-up". The hardening block carries one meaning on every page, taken from the roadmap's own description of that block (read ${ROADMAP}, its section on the work re-sequenced by value), in the words box and wherever a page explains it.
2. The requirements' status lines address the owner as "you" ("your decision", "your open question", "settled by you"), as every other page does. The line after a status tag begins "Rests on:" (never "On:"); "your word on the direction", never "your word in direction". Internal glossary entry names leave the status lines: name what the entry says, not the entry (for example "the glossary's entry on the abilities a pack requires", not "its Capability entry").
3. "Joins and proofs" is marked as replaced once per card or entry, in the parts row's note, worded "has since been replaced by the published protocol and the test bench outside the engine"; drop the other repeats. Diagram labels keep the part's name.
4. "In the candidate" and "the candidate shape" become "In the earlier candidate" and "the earlier candidate" on every page but the change log.
5. The front page's prose stays under the build's hard limit (2,625 words of sentences); trim rather than add when a fix needs room.
6. Questions P, Q and R take their source from the panel's brief: record that in ${OUT}/decisions-log.md.`

const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, newConflicts: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'] }

phase('Apply')
const apply = await agent(`${COMMON}

${RULINGS}

Your task: settle every row marked partly resolved and every new conflict in ${CHECKS}/v9-verify-a.md and ${CHECKS}/v9-verify-b.md (including verify-b's note on question M), with the rulings above; rebuild; smoke-test.

- Verify each row against its source before changing anything; apply it, or reject it with a reason.
- Edit only the overlays in ${OUT}, the two requirements files, the four data files and ${RP}/build_site.py. When you change a fact in a data or requirements file, change it where its source document states it too. Never edit render_diagrams.js, diagram_theme.py, the plans, the decision record, the roadmap or the panel's brief; if one of them is wrong, say so in your notes. Keep every JSON valid and its layout: edit text in place, never re-dump a file.
- Rebuild: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py (its checks must pass). Smoke: node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots-v9 (24 loads must pass).
- Write ${CHECKS}/v9-apply-log-2.md: one row per settled row (its verify file and row, applied or rejected, the change or the reason, the source), one row per ruling with what you changed, then the build and smoke results.

Return the log, how many you applied and rejected, whether the build and smoke passed, and a note per rejection.

Done when: every partly and new row of both verify files and every ruling is settled, the build's checks pass and the smoke test passes.`, { label: 'apply:round2', phase: 'Apply', effort: 'high', schema: APPLY_SCHEMA })

phase('Verify')
const halves = [
  { key: 'a', files: ['index.html', 'decisions.html', 'changes.html'], verify: 'v9-verify-a.md' },
  { key: 'b', files: ['requirements.html', 'design.html', 'today.html'], verify: 'v9-verify-b.md' },
]
const verify = (await parallel(halves.map(h => () => agent(`${COMMON}

${RULINGS}

Your pages: ${h.files.map(f => SITE + '/' + f).join(', ')}. The rows settled in this round: the partly and new rows of ${CHECKS}/${h.verify}, and the rulings, as ${CHECKS}/v9-apply-log-2.md records them. The changes this round: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/.

Refute by default. For each settled row and each ruling as it touches your pages, read the rebuilt pages and say resolved, partly or unresolved; for a rejection, say whether its reason holds. Then read your pages whole against the rules and list any conflict you find, new or old, with where, what it says, what it should say and the exact place to change it. Keep to real conflicts a careful reader would notice; a wording you would merely prefer is not a conflict.

Write ${CHECKS}/v9-verify-2${h.key}.md: a short header, the verdict table, the conflicts table, then what you found right. Return the file, the counts, and five key points.

Done when: every settled row and ruling has a verdict and your pages have been read whole.`, { label: 'verify:' + h.key, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })))).filter(Boolean)
log('round 2: applied ' + (apply ? apply.applied : '?') + '; ' + verify.map(v => `${v.file.split('/').pop()}: ${v.resolved} resolved, ${v.partly} partly, ${v.unresolved} unresolved, ${v.newConflicts} conflicts`).join('; '))
return { apply, verify }
