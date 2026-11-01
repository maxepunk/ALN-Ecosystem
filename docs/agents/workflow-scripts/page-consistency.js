export const meta = {
  name: 'page-consistency',
  description: 'Check the rebuilt owner page for internal consistency and for agreement with the engine shape, refute by default; report each conflict with its fix',
  phases: [
    { title: 'Check', detail: 'two readers: the new section and questions against the shape; the jobs and cards against the new section' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const PAGE = RP + '/2026-10-31-cause-report.html'
const BUILDER = RP + '/build_report.py'
const SHAPE = AP + '/2026-11-01-engine-shape.md'
const SHAPE_JSON = RP + '/2026-11-01-engine-shape.json'
const EJ = AP + '/2026-10-31-engine-jobs.md'
const CS = ROOT + '/docs/plans/CURRENT-STATE.md'
const OUT = k => `${AP}/consistency/2026-11-01-page-${k}.md`

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page: ${PAGE}, built by ${BUILDER} from JSON files in ${RP}. The page leads with the engine's ten jobs (J1 to J10), each with the design flaws (C1 to C16, N1 proposed) that keep it from being done well, one card per flaw. A new section, "How the jobs fit together" (id "fit"), maps how the jobs relate and offers a candidate shape of seventeen-odd parts, from ${SHAPE} and ${SHAPE_JSON}. The cards and jobs were then reconciled with that shape. The questions at the end ask the owner to decide the jobs list, questions A to G about the jobs' wording, and a few more; a last group previews the choices step 3 will ask.

The owner asked earlier that the page be internally consistent, "without pieces that disagree or conflict with each other", and that design choices elsewhere on the page follow the relationship map. Your job is to find every place where it does not, refute by default: a claim you cannot confirm against the shape document or the page's other parts is a conflict.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner (stale clones). Never open backend/.env. Write only your report file.

Read the page as text (for example, python3 -I -c "import html,re,sys; t=open('${PAGE}').read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))"), and read the builder for the text it writes by hand (FIT_SUMMARY, FIT_DEVICES, OVERVIEW, BUILT, SET_ASIDE and the TEMPLATE's questions).`

const SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'conflicts', 'checked', 'keyPoints'],
}

const READERS = [
  { key: 'section-and-questions', task: `Your part: the page's top (header, "What you are deciding", "How to read a job", the design words), the "How the jobs fit together" section, and the questions at the end, against ${SHAPE} (all of it, including its "Corrections from the check" section), ${EJ} section 4 (the questions A to G as first asked) and ${CS} section 0 (the decisions so far and the open questions).
Check: every count (jobs, mechanisms, qualities, tangles, parts, dependencies, alternatives); every sentence of the hand-written summary, device lines and the at-a-glance diagram against the shape's sections 2.1, 2.2 and 4.3 (an arrow drawn solid must be a dependency the shape draws; a dashed one a quality or a shared piece); every question's facts, options and costs against the shape's section 5 notes and EJ section 4, so that each question gives both sides' costs and the recommendation follows from what the page says; that the "What you are deciding" box names the questions whose recommendation changed, and only those; that every step-3 preview item matches a choice in the shape's section 6 and the alternatives table; that nothing presents an open choice as decided.` },
  { key: 'jobs-and-cards', task: `Your part: the ten job entries (their titles, "was" lines, who and when, need, built today, goal, the parts that carry each, what changed, standalone line, the flaws listed) and the sixteen cards (what changed, story, diagrams, the parts that remove each flaw, design terms, standalone line), against the "How the jobs fit together" section of the same page and against ${SHAPE}.
Check: every job's title is the same in the glance table, the at-a-glance diagram, its heading and the questions; every part named on a job or card exists in the section and is named the same way; each card's parts are the ones the shape's section 4.1 (and its corrections) says remove that flaw, and each job's parts are the ones the shape lands it on; each card's candidate diagram and note agree with the interfaces of the parts it names and with the one-direction rule; no card or job says a screen, a tablet or a player scanner decides a fact the section gives to an engine part; each "what changed" note matches what the card or job now says; each standalone line agrees with the section's standalone tablet lines; no two cards or jobs contradict each other.` },
]

phase('Check')
const results = await parallel(READERS.map(r => () => agent(`${COMMON}

${r.task}

Write ${OUT(r.key)} in Markdown: a short header (what you read, tree, date 2026-11-01), then a table with one row per conflict (where on the page, what it says, what it should say and why, citing the shape's section or the page's other place), then a list of what you checked and found consistent. Then return the file, the number of conflicts, how many claims you checked, and five key points.

Done when: every element named in your part has been read against its source, every conflict has a proposed fix, and the counts in your summary match your table.`, { label: 'check:' + r.key, phase: 'Check', model: 'opus', effort: 'high', schema: SCHEMA })))
const ok = results.filter(Boolean)
log('page checks: ' + ok.map(r => `${r.file.split('/').pop()} ${r.conflicts} conflicts of ${r.checked}`).join('; '))
return ok
