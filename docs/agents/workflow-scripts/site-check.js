export const meta = {
  name: 'site-check',
  description: "Check each page of the owner's new site refute-by-default, apply the fixes in one pass, rebuild, then verify every fix",
  phases: [
    { title: 'Check', detail: 'six refute-by-default readers, one per page' },
    { title: 'Apply', detail: 'one editor applies every conflict, rebuilds and smoke-tests' },
    { title: 'Verify', detail: 'two refute-by-default readers confirm each fix and look for new conflicts' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const CHECKS = SITE + '/checks'
const PLAN = SITE + '/2026-11-01-site-plan.md'
const SCRATCH = '/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad'
const MERMAID_JS = SCRATCH + '/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js'
const BASE = args && args.base ? args.base : 'HEAD'

const COMMON = `Context. The ALN show engine's architecture pass publishes a site for the owner, "What the Engine Promises": five linked pages and a change log (decision 29), replacing version 7, one long page. The site's plan is ${PLAN} (its section 3 says what each page holds, section 6 the rules). The pages are built into ${SITE}/ by ${RP}/build_site.py from the page data (${RP}/2026-10-31-cause-cards.json, ${RP}/2026-10-31-engine-jobs.json, ${RP}/2026-10-31-standalone-lines.json, ${RP}/2026-11-01-engine-shape.json) and three content overlays (${SITE}/front.json, ${SITE}/decisions.json, ${SITE}/changes.json, whose [[markers]] the builder turns into links). ${SITE}/inventory.md lists every element of version 7 and its home on the site. Version 7 is ${RP}/2026-10-31-cause-report.html (built by ${RP}/build_report.py). The owner's decisions 20 to 29 are in ${ROOT}/docs/plans/CURRENT-STATE.md section 0; decision 28 (the after-game article and emailer) is detailed in ${AP}/2026-11-01-after-game-report.md; the glossary is ${ROOT}/CONTEXT.md sections 5 and 7.

The rules every page follows:
- A promise is what a person can count on at a given moment; parts keep promises; design flaws break them; a quality is something every part must have, never a promise or a part. Promises go by their exact titles, never by number (no J1 to J10 anywhere a reader sees). The venue technician, never "installer". "Job" and "installer" appear only on changes.html, in its history.
- Decision 28 holds: the night's-record half of "Every tap gets its answer, and the night can be told afterwards" names the director and the players; what players receive after the show is the game's business; the night's record carries the game it ran and the texts the players saw; players' emails stay outside the engine; the Director Console stays a separate program that reads the record, with room to run inside the Review stage later; the two clocks are finding X-08 under C9.
- The shape is a candidate, never written as decided. Edit history belongs on the change log, not on the other pages.
- Plain, short, active sentences; no metaphors; no em dashes. A link's words read naturally in their sentence: a full flaw or promise title dropped mid-sentence where it reads stiffly is a conflict, fixed by rewording or by the short marker form [[flaw:C9|C9]].
- Facts match their sources; meaning moved from version 7 is kept; nothing version 7 held is lost (the inventory names each element's home).

Read a page as text, diagrams' labels kept: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit.`

const PAGES = [
  { key: 'engine', file: 'index.html', focus: 'The front page: the whole engine in one read. Besides the rules, check that it shows how the engine fits together without restating the Promises page table, that each moment matches the promises\' who and when, and that "Around the engine" matches decision 28 and the after-game survey.' },
  { key: 'decisions', file: 'decisions.html', focus: 'Every open question keeps version 7\'s key, group, status, meaning, options with costs and the substance of its recommendation (version 7\'s questions are in the TEMPLATE of build_report.py); each evidence line is true and its links point where it says; the step-3 list and the decided list are complete and right.' },
  { key: 'promises', file: 'promises.html', focus: 'Each of the ten entries against its data and version 7\'s entry: who and when, the need, built today, the goal, kept by, broken by (main one first), the standalone line, the needs and the test cases with their questions line; the glance table and the two diagrams.' },
  { key: 'parts', file: 'parts.html', focus: 'The qualities, the layers, the five walkthroughs with their reading key, the seventeen part cards, which part runs where, the tangles and the alternatives, each against version 7 and the shape data and ' + AP + '/2026-11-01-engine-shape.md; the night\'s record card against decision 28.' },
  { key: 'flaws', file: 'flaws.html', focus: 'The glance table, the sixteen cards grouped under the promise each mainly breaks, the N1 entry, the standalone section with the parity table, and the evidence (337 under the flaws, 21 set aside, 358 in all); each card against version 7\'s card and its data; C9 carries X-08.' },
  { key: 'changes', file: 'changes.html', focus: 'Every version, promise, card, recommendation and word entry against its sources (CURRENT-STATE.md, the git log of ' + RP + ', the data files\' shapeChange notes, the promises\' "title" fields); nothing invented; "job" and "installer" allowed here only as history.' },
]

const CHECK_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, newConflicts: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'] }

phase('Check')
const checks = (await parallel(PAGES.map(p => () => agent(`${COMMON}

Your page: ${SITE}/${p.file}. ${p.focus}

Read your page as text, the plan's section for it, every inventory row whose home is your page, and the sources each element came from. Refute by default: anything that breaks a rule, misstates its source, loses or changes version 7's meaning, is missing although the inventory homes it on your page, links somewhere other than its words say, reads stiffly, repeats itself within the page, or reads as edit history, is a conflict. For each conflict give where on the page, what it says, what it should say, and the exact place to change it: the overlay and its field, the data file and its field, or the build_site.py function or constant (with its line).

Write ${CHECKS}/page-${p.key}.md: a short header, the conflicts table, then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.

Done when: every element of your page has been read against the rules and its source, every inventory row homed on your page is accounted for, every conflict names the place to change it, and the counts match your table.`, { label: 'check:' + p.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })))).filter(Boolean)
log('page checks: ' + checks.map(c => `${c.file.split('/').pop()} ${c.conflicts} of ${c.checked}`).join('; '))

const total = checks.reduce((n, c) => n + c.conflicts, 0)
if (total === 0) return { checks, apply: null, verify: [] }

phase('Apply')
const apply = await agent(`${COMMON}

Your task: apply every conflict in the six page checks (${checks.map(c => c.file).join(', ')}) to the files they name, rebuild the site and smoke-test it.

- For each conflict, verify it against the source it names first. Apply it, or reject it with a reason when the check is wrong. Where two checks touch the same text, make one change that settles both.
- Edit only the overlays (${SITE}/front.json, decisions.json, changes.json), the four data files and ${RP}/build_site.py. When you change a fact in a data file, change the same fact in the document it was drawn from where that document states it (${AP}/2026-10-31-engine-jobs.md, ${AP}/2026-11-01-engine-shape.md, ${AP}/2026-10-30-cause-analysis.md, ${AP}/2026-10-31-standalone-pass.md). Never edit build_report.py, render_diagrams.js, diagram_theme.py or the plan; if one of them is wrong, say so in your notes. Keep every JSON file valid and its formatting (the shape JSON uses a compact layout: edit its text in place rather than re-dumping it).
- Rebuild: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py (its checks must pass). Smoke-test: node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots (24 loads must pass).
- Write ${CHECKS}/apply-log.md: one row per conflict (page, row, applied or rejected, the change or the reason, the source verified), then the build's and the smoke test's results.

Return the log, how many conflicts you applied and rejected, whether the build and the smoke test passed, and a note for each rejection.

Done when: every conflict of every check is applied or rejected with a reason, the build's checks pass and the smoke test passes.`, { label: 'apply:site', phase: 'Apply', effort: 'high', schema: APPLY_SCHEMA })

phase('Verify')
const halves = [
  { key: 'a', pages: PAGES.filter(p => ['engine', 'decisions', 'changes'].includes(p.key)) },
  { key: 'b', pages: PAGES.filter(p => ['promises', 'parts', 'flaws'].includes(p.key)) },
]
const verify = (await parallel(halves.map(h => () => agent(`${COMMON}

Your pages: ${h.pages.map(p => SITE + '/' + p.file).join(', ')}. Their checks: ${h.pages.map(p => CHECKS + '/page-' + p.key + '.md').join(', ')}. The editor's log: ${CHECKS}/apply-log.md. The changes since the checks: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/.

Refute by default. For every conflict row in your pages' checks, read the rebuilt page and say resolved, partly or unresolved; for a rejection, say whether the reason holds. Then read your rebuilt pages whole against the rules and list any new conflict the edits introduced, with where, what it says, what it should say and the place to change it.

Write ${CHECKS}/verify-${h.key}.md: a short header, the verdict table, the new conflicts table, then what you found right. Return the file, the counts of resolved, partly, unresolved and new conflicts, and five key points.

Done when: every row of your pages' checks has a verdict and your pages have been read whole.`, { label: 'verify:' + h.key, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })))).filter(Boolean)
log('verify: ' + verify.map(v => `${v.file.split('/').pop()}: ${v.resolved} resolved, ${v.partly} partly, ${v.unresolved} unresolved, ${v.newConflicts} new`).join('; '))
return { checks, apply, verify }