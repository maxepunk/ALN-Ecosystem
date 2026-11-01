export const meta = {
  name: 'site-v9-check',
  description: "Check each page of the owner site's version 9 refute-by-default, apply the fixes in one pass, rebuild, then verify every fix",
  phases: [
    { title: 'Check', detail: 'six refute-by-default readers, one per page' },
    { title: 'Apply', detail: 'one editor applies every conflict, rebuilds and smoke-tests' },
    { title: 'Verify', detail: 'two refute-by-default readers confirm each fix and read the pages whole' },
  ],
}

// args.base: the commit the checks read (the verifiers diff against it).
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
const V8 = args && args.v8 ? args.v8 : 'HEAD'

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) is redesigning the engine for the long term. Their goal, in their words: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)". Their site "What the Engine Promises" is now version 9, six linked pages built into ${SITE}/ by ${RP}/build_site.py from the plan ${PLAN2} (where it is silent, ${PLAN1} sections 2, 4, 5 and 6 hold). Its sources: the overlays ${OUT}/front.json, decisions.json, design.json, changes.json and rules.json (their writers' logs beside them name the source of each sentence); the requirements ${REQ}/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json; the page data in ${RP} (2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json, 2026-10-31-standalone-lines.json, 2026-11-01-engine-shape.json); the decision record ${REC}; the roadmap ${ROADMAP}; the panel's brief ${BRIEF}; the jargon table ${JT}; the builder's log ${OUT}/build-log.md. Version 8's pages, for what must not be lost: git -C ${ROOT} show ${V8}:docs/plans/architecture-pass/report/site/<page>.html (index, decisions, promises, parts, flaws, changes).

The rules every page follows (plan v2 sections 2 and 6):
- The proactive frame: the requirements and the decisions ahead come first; today's engine is evidence and test situations, never the reason for a design; the earlier 17-part candidate is one input among the panel's, never written as current or decided.
- Decisions as the record states them, by their titles. Readings the record marks "to be confirmed" never appear as settled.
- Titles, not numbers: no visible promise, decision, question, flaw, finding, quality-target or extension-case id outside the change log; questions carry letters only on the Decisions page.
- Sequencing names only: the architecture pass's design half and build half; the requirements, the panel, the design rounds, the build plan, the hostile review, the final questions, the owner's sign-off; blocks by name; question rounds by date; test levels by name. A bare phase, step, block, round, decision or question number outside the change log is a conflict.
- Plain words: every term in the jargon table takes its plain wording, and any term the owner could not understand without the internal documents is a conflict even if the table does not list it (give its plain wording). Short, active sentences; no metaphors; no em dashes. A link's words read naturally in their sentence.
- Facts match their sources; nothing version 8 held is lost unless the plan or the build log drops it with a reason.

Read a page as text, diagram labels kept: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); t=re.sub(r'<script>.*?</script>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit.`

const PAGES = [
  { key: 'engine', file: 'index.html', focus: `The front page, the whole picture in one read. Check the lead and the timeline against the roadmap and the record (the design half's steps, the requirements marked current, nothing numbered); each moment against its promises' people and moments; each quality line against its quality targets; each growth line against its extension cases; the world picture against the requirements (every person, device, outside program and file present; the published protocol drawn as the line every message and file crosses; no design drawn inside the engine), at 400 pixels too (screenshots in ${SCRATCH}/site-shots-v9); decided lately against the record; every word in the words box against its source; the site guide against the pages.` },
  { key: 'decisions', file: 'decisions.html', focus: `Every question against its source: the ones carried from version 8 keep their meaning, status, options with costs and the substance of their recommendation; question A lists every number the quality targets leave for the owner, each true to its target; the "to be confirmed" question lists every such reading in the record; the panel's question matches the brief and the record's decision on what the panel sees. The design-round list is the record's six decisions in order, each link landing on its entry; the later choices match the record's "Still open"; every standing decision is in the decided list, by topic, with its exact title, date and a line true to the record.` },
  { key: 'requirements', file: 'requirements.html', focus: `The promises: each entry against its data (who, when, the need, the goal, the planned capabilities by name, where today's engine falls short, the test situations, the nine questions by name) and version 8's entry; the served-by lists and the glance table's counts against the promises fields of the targets and cases. The quality targets: all of them, each grouped under its quality, every field true to its file, every number to set shown and marked, every status kind supported by its status sentence. The extension cases: all of them, each in exactly one group of the six kinds of person, every field true to its file. The standing rules against roadmap section 2: every constraint present, none added, meanings kept.` },
  { key: 'design', file: 'design.html', focus: `The six decisions ahead against the record and the requirements (nothing proposes or favours an option; every driver pushes on its decision; every "already settled" line is true to the record); the decided directions against the record (the published protocol, the outside test bench with "Proof" a quality, the test rig built when building starts, the after-game boundary); the panel's brief, if the page shows it, against ${BRIEF} and the record; the later choices; the earlier candidate, folded, against version 8's Parts page (nothing lost; labelled as an earlier candidate the panel compares in its second round; "Joins and proofs" marked as replaced by the published protocol and the test bench).` },
  { key: 'today', file: 'today.html', focus: `What works today against version 8's "built today" and its sources; the glance table and the sixteen cards against version 8's Design flaws page and the cards data (titles only, grouped by the promise each mainly touches, no finding ids, blue's fixes as a count, seen live and reproduced in a test counted apart, each card's second diagram folded as "How the earlier candidate would remove it"); the proposed seventeenth; standalone today with the hardware-scanner table; the evidence (337 under the flaws, 21 set aside, 358 in all). The page reads as evidence and test situations, never as the reason for a design.` },
  { key: 'changes', file: 'changes.html', focus: `Version 9's entry against what changed (the plan, the record's decisions of 2026-11-01, the owner's words as the record quotes them); every version 8 entry kept, quoted earlier wordings unchanged; the three tables (the words replaced, the old numbers and their titles, the old sequencing words) complete and true against the jargon table, the record's last tables and the program document; every link landing where its words say.` },
]

const CHECK_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, newConflicts: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'] }

phase('Check')
const checks = (await parallel(PAGES.map(p => () => agent(`${COMMON}

Your page: ${SITE}/${p.file}. ${p.focus}

Read your page as text, the plan's section for it, and the sources each element comes from. Refute by default: anything that breaks a rule, misstates its source, loses version 8's meaning, is missing although the plan puts it on your page, links somewhere other than its words say, reads stiffly, repeats itself within the page, or reads as edit history is a conflict. For each conflict give where on the page, what it says, what it should say, and the exact place to change it: the overlay and its field, the requirements file and its field, the data file and its field, or the build_site.py function or constant.

Write ${CHECKS}/v9-page-${p.key}.md: a short header, the conflicts table, then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.

Done when: every element of your page has been read against the rules and its source, every conflict names the place to change it, and the counts match your table.`, { label: 'check:' + p.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })))).filter(Boolean)
log('page checks: ' + checks.map(c => `${c.file.split('/').pop()} ${c.conflicts} of ${c.checked}`).join('; '))

const total = checks.reduce((n, c) => n + c.conflicts, 0)
if (total === 0) return { checks, apply: null, verify: [] }

phase('Apply')
const apply = await agent(`${COMMON}

Your task: apply every conflict in the six page checks (${checks.map(c => c.file).join(', ')}) to the files they name, rebuild the site and smoke-test it.

- Verify each conflict against the source it names first. Apply it, or reject it with a reason when the check is wrong. Where two checks touch the same text, make one change that settles both.
- Edit only the overlays in ${OUT}, the two requirements files, the four data files and ${RP}/build_site.py (and ${RP}/site_smoke.js if a smoke failure needs it). When you change a fact in a data file or a requirements file, change it where its source document states it too. Never edit render_diagrams.js, diagram_theme.py, the plans, the decision record or the roadmap; if one of them is wrong, say so in your notes. Keep every JSON file valid and its layout: edit text in place, never re-dump a file.
- Rebuild: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py (its checks must pass). Smoke-test: node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots-v9 (24 loads must pass).
- Write ${CHECKS}/v9-apply-log.md: one row per conflict (page, row, applied or rejected, the change or the reason, the source verified), then the build's and the smoke test's results.

Return the log, how many conflicts you applied and rejected, whether the build and the smoke test passed, and a note for each rejection.

Done when: every conflict of every check is applied or rejected with a reason, the build's checks pass and the smoke test passes.`, { label: 'apply:site', phase: 'Apply', effort: 'high', schema: APPLY_SCHEMA })

phase('Verify')
const halves = [
  { key: 'a', pages: PAGES.filter(p => ['engine', 'decisions', 'changes'].includes(p.key)) },
  { key: 'b', pages: PAGES.filter(p => ['requirements', 'design', 'today'].includes(p.key)) },
]
const verify = (await parallel(halves.map(h => () => agent(`${COMMON}

Your pages: ${h.pages.map(p => SITE + '/' + p.file).join(', ')}. Their checks: ${h.pages.map(p => CHECKS + '/v9-page-' + p.key + '.md').join(', ')}. The editor's log: ${CHECKS}/v9-apply-log.md. The changes since the checks: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/.

Refute by default. For every conflict row in your pages' checks, read the rebuilt page and say resolved, partly or unresolved; for a rejection, say whether the reason holds. Then read your rebuilt pages whole against the rules and list any new conflict the edits introduced, with where, what it says, what it should say and the place to change it.

Write ${CHECKS}/v9-verify-${h.key}.md: a short header, the verdict table, the new conflicts table, then what you found right. Return the file, the counts of resolved, partly, unresolved and new conflicts, and five key points.

Done when: every row of your pages' checks has a verdict and your pages have been read whole.`, { label: 'verify:' + h.key, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })))).filter(Boolean)
log('verify: ' + verify.map(v => `${v.file.split('/').pop()}: ${v.resolved} resolved, ${v.partly} partly, ${v.unresolved} unresolved, ${v.newConflicts} new`).join('; '))
return { checks, apply, verify }
