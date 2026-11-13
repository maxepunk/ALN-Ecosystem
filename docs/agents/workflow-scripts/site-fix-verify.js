export const meta = {
  name: 'site-fix-verify',
  description: "Apply the owner site's remaining partly-resolved and new conflicts with the orchestrator's rulings, rebuild, then verify the whole site refute-by-default",
  phases: [
    { title: 'Apply', detail: 'one editor settles the partly-resolved and new rows' },
    { title: 'Verify', detail: 'two refute-by-default readers confirm the fixes and read the pages whole' },
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

const COMMON = `Context. The ALN show engine's architecture pass publishes a site for the owner, "What the Engine Promises": five linked pages and a change log (decision 29). The site's plan is ${PLAN} (section 3: what each page holds; section 6: the rules). ${RP}/build_site.py builds the pages into ${SITE}/ from the page data (${RP}/2026-10-31-cause-cards.json, ${RP}/2026-10-31-engine-jobs.json, ${RP}/2026-10-31-standalone-lines.json, ${RP}/2026-11-01-engine-shape.json) and three overlays (${SITE}/front.json, decisions.json, changes.json). The pages were checked page by page (${CHECKS}/page-*.md), fixed (${CHECKS}/apply-log.md) and verified (${CHECKS}/verify-a.md, ${CHECKS}/verify-b.md). The owner's decisions 20 to 29 are in ${ROOT}/docs/plans/CURRENT-STATE.md section 0; decision 28 is detailed in ${AP}/2026-11-01-after-game-report.md; the glossary is ${ROOT}/CONTEXT.md sections 5 and 7.

The rules: promises by their exact titles, never by number; parts keep promises, design flaws break them, a quality is never a promise or a part; the venue technician, never "installer"; "job" and "installer" only on changes.html, as history; decision 28 everywhere (the night's-record half names the director and the players; what players receive is the game's business; the record carries the game it ran and the texts the players saw; emails stay outside the engine; the Director Console stays separate with room to run inside Review later; the two clocks are X-08 under C9); the shape is a candidate, never decided; edit history only on the change log; plain short active sentences, no metaphors, no em dashes; a link's words read naturally (use [[flaw:C9|C9]] or reword where a full title reads stiffly); facts match their sources.

Read a page as text, diagrams' labels kept: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit.`

const RULINGS = `The orchestrator's rulings on the judgment calls (follow them):
1. The front page has no eyebrow: the plan (3.1.1) and the inventory (row 3) now name the status line as the kept copy. Remove the eyebrow from page_engine in build_site.py.
2. The pass's nine questions (the program document's list, each answered by a rule) carry one name on every page, so no reader confuses them with the questions on the Decisions page: "the architecture pass's nine questions" in prose and "Architecture pass questions 6, 5, 8" (or "question 6" for one) on chips and summary lines. Add one entry to the words box (front.json words, group page) saying what they are and that they are not the questions on Decisions.
3. Seen live: a card whose problem was reproduced only in a test (C5 and C11, per the cause analysis's "in-process" reproductions) shows "Reproduced in a test", not "Seen live", and the flaws glance table counts the two apart; the six seen live at a show keep "Seen live". Add the field or rule in the data and build_site.py that makes this exact.
4. "Door": define it in the words box so it fits every use on the site (a single way in or out that every request or every fact passes through; today's code has several, the candidate has two, Answering and Delivery), and keep it apart from the "door" of a dormant service (why it is not installed tonight, profile or operator), naming that one plainly where it appears.`

const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, newConflicts: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'] }

phase('Apply')
const apply = await agent(`${COMMON}

${RULINGS}

Your task: settle every row marked partly resolved and every new conflict in ${CHECKS}/verify-a.md and ${CHECKS}/verify-b.md, with the rulings above; rebuild; smoke-test.

- Verify each row against its source before changing anything; apply it, or reject it with a reason.
- Edit only the overlays, the four data files and build_site.py. When you change a fact in a data file, change the same fact in its source document where that document states it (${AP}/2026-10-31-engine-jobs.md, ${AP}/2026-11-01-engine-shape.md, ${AP}/2026-10-30-cause-analysis.md). Keep every JSON valid and its layout (edit the shape JSON's text in place).
- Rebuild: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py (its checks must pass). Smoke: node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots (24 loads must pass).
- Write ${CHECKS}/apply-log-2.md: one row per settled row (its verify file and row, applied or rejected, the change or reason, the source), one row per ruling with what you changed, then the build and smoke results.

Return the log, how many you applied and rejected, whether the build and smoke passed, and a note per rejection.

Done when: every partly and new row of both verify files and every ruling is settled, the build's checks pass and the smoke test passes.`, { label: 'apply:round2', phase: 'Apply', effort: 'high', schema: APPLY_SCHEMA })

phase('Verify')
const halves = [
  { key: 'a', files: ['index.html', 'decisions.html', 'changes.html'], verify: 'verify-a.md' },
  { key: 'b', files: ['promises.html', 'parts.html', 'flaws.html'], verify: 'verify-b.md' },
]
const verify = (await parallel(halves.map(h => () => agent(`${COMMON}

${RULINGS}

Your pages: ${h.files.map(f => SITE + '/' + f).join(', ')}. The rows settled in this round: the partly and new rows of ${CHECKS}/${h.verify}, and the rulings, as ${CHECKS}/apply-log-2.md records them. The changes this round: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/.

Refute by default. For each settled row and each ruling as it touches your pages, read the rebuilt pages and say resolved, partly or unresolved; for a rejection, say whether its reason holds. Then read your pages whole against the rules and list any conflict you find, new or old, with where, what it says, what it should say and the exact place to change it.

Write ${CHECKS}/verify-2${h.key}.md: a short header, the verdict table, the conflicts table, then what you found right. Return the file, the counts, and five key points.

Done when: every settled row and ruling has a verdict and your pages have been read whole.`, { label: 'verify:' + h.key, phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })))).filter(Boolean)
log('round 2: applied ' + (apply ? apply.applied : '?') + '; ' + verify.map(v => `${v.file.split('/').pop()}: ${v.resolved} resolved, ${v.partly} partly, ${v.unresolved} unresolved, ${v.newConflicts} conflicts`).join('; '))
return { apply, verify }