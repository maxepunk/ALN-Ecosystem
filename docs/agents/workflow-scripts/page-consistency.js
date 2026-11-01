export const meta = {
  name: 'page-consistency',
  description: 'Put the owner page\'s card and job text into plain words, rebuild, then check the page for internal consistency and agreement with the engine shape, refute by default',
  phases: [
    { title: 'Plain', detail: 'one editor: every owner-facing card and job string in plain words, meaning kept; the page rebuilt' },
    { title: 'Check', detail: 'two readers: the new section and questions against the shape; the jobs and cards against the new section, and the plain-words edits against their originals' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const PAGE = RP + '/2026-10-31-cause-report.html'
const BUILDER = RP + '/build_report.py'
const CARDS = RP + '/2026-10-31-cause-cards.json'
const JOBS = RP + '/2026-10-31-engine-jobs.json'
const SA_LINES = RP + '/2026-10-31-standalone-lines.json'
const SHAPE = AP + '/2026-11-01-engine-shape.md'
const SHAPE_JSON = RP + '/2026-11-01-engine-shape.json'
const EJ = AP + '/2026-10-31-engine-jobs.md'
const CS = ROOT + '/docs/plans/CURRENT-STATE.md'
const PLAIN_LOG = AP + '/consistency/2026-11-01-plain-words.md'
const OUT = k => `${AP}/consistency/2026-11-01-page-${k}.md`
const SKILL = '/root/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/codebase-design/SKILL.md'

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page: ${PAGE}, built by ${BUILDER} from JSON files in ${RP}. The page leads with the engine's ten jobs (J1 to J10), each with the design flaws (C1 to C16, N1 proposed) that keep it from being done well, one card per flaw. A section "How the jobs fit together" (id "fit") maps how the jobs relate and offers a candidate shape of 17 parts, from ${SHAPE} and ${SHAPE_JSON}. The cards and jobs were then reconciled with that shape. The questions at the end ask the owner to decide the jobs list, questions A to G about the jobs' wording, and a few more; a last group previews the choices step 3 will ask.

The owner's words that set the bar: "I'm just generally having a hard time with the vocabulary you're using"; the page must be internally consistent, "without pieces that disagree or conflict with each other"; and design choices elsewhere on the page must follow the relationship map. The house writing rules are docs/agents/process.md sections 4 and 5: plain, clear language; short sentences; active voice; one idea per sentence; no metaphors; no compressed jargon chains; explain each decision by how the system behaves during a game, in words a product manager follows; leave out internal codes and jargon.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner (stale clones). Never open backend/.env. Write only the files you are told to write.

To read the page as text: python3 -I -c "import html,re; t=open('${PAGE}').read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))". The builder writes some text by hand: FIT_SUMMARY, FIT_DEVICES, OVERVIEW, BUILT, SET_ASIDE and the TEMPLATE's questions.`

const PLAIN_SCHEMA = {
  type: 'object',
  properties: { log: { type: 'string' }, edited: { type: 'integer' }, read: { type: 'integer' }, rebuilt: { type: 'boolean' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['log', 'edited', 'read', 'rebuilt', 'keyPoints'],
}
const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'conflicts', 'checked', 'keyPoints'],
}

phase('Plain')
const plain = await agent(`${COMMON}

Your job: put every owner-facing string on the cards and jobs into plain words, keeping each one's meaning exactly. Edit these files in place: ${CARDS} (each card's shapeChange, atAShow, whyItHappens, designTerms, after.note, and the node and edge labels of the after diagram), ${SA_LINES} (each line), and ${JOBS} (each job's functional.people, functional.moment, functional.need, functional.proposedTitle, goal, standalone and shapeChange).

For each string, in order:
1. Read it once as the owner would: a product person who runs the show and does not read code. Mark every word or phrase that person would stop at: a code or function name (anything with brackets or an arrow, a file name, a field name), an internal id other than C1 to C16, N1 and J1 to J10, an engineering term the page does not define, a compressed chain of nouns, a "candidate A" or "B" with no words saying what A and B are.
2. Rewrite only what you marked, with the plainest words that keep the meaning: say what happens at a show, who sees what, what changes. Keep every fact, every count and every part name (the 17 part names in the section are the page's own words and stay as they are). In the "In design terms" lines, the design words the page defines stay (module, interface, seam, adapter, deep, shallow, leverage, locality, as ${SKILL} defines them), but code signatures go: say what the interface lets a caller do.
3. Keep each string within its length: shapeChange two sentences, after.note 60 words, designTerms 70 words, a standalone line 60 words, a job's need 70 words. Shorter is better when nothing is lost.

Leave the "Today" diagrams, titles, examples, test cases and needs lists alone. Keep the JSON valid and the formatting as it is (two-space indent; parse each file after editing). Then rebuild the page with python3 -I ${BUILDER} and confirm it prints "wrote".

Write ${PLAIN_LOG}: a short header, then one table row per edited string (where, before, after, the words you replaced and why), then the count of strings you read and the count you edited.

Done when: every string named above has been read, every marked phrase is rewritten or justified in the log, the three JSON files parse, and the page is rebuilt. Return the log file, the counts, whether the page rebuilt, and five key points.`, { label: 'plain-words', phase: 'Plain', model: 'fable', effort: 'high', schema: PLAIN_SCHEMA })
log(plain ? `plain words: ${plain.edited} of ${plain.read} strings edited; rebuilt ${plain.rebuilt}` : 'plain words: FAILED')

const READERS = [
  { key: 'section-and-questions', task: `Your part: the page's top (header, "What you are deciding", "How to read a job", the design words), the "How the jobs fit together" section, and the questions at the end, against ${SHAPE} (all of it, including its last section, "Corrections from the check"), ${EJ} section 4 (the questions A to G as first asked) and ${CS} section 0 (the decisions so far and the open questions).
Check: every count (jobs, mechanisms, qualities, tangles, parts, dependencies, alternatives); every sentence of the hand-written summary, device lines and the at-a-glance diagram against the shape's sections 2.1, 2.2 and 4.3 (an arrow drawn solid must be a dependency the shape draws; a dashed one a quality or a shared piece); every question's facts, options and costs against the shape's section 5 notes and EJ section 4, so that each question gives both sides' costs and its recommendation follows from what the page says; that the "What you are deciding" box names the questions whose recommendation changed, and only those; that every step-3 preview item matches a choice in the shape's section 6 or its alternatives; that nothing presents an open choice as decided; and that the text is in plain words by the house rules.` },
  { key: 'jobs-and-cards', task: `Your part: the ten job entries (titles, "was" lines, who and when, need, built today, goal, the parts that carry each, what changed, standalone line, the flaws listed) and the sixteen cards (what changed, story, diagrams, the parts that remove each flaw, design terms, standalone line), against the "How the jobs fit together" section of the same page and against ${SHAPE}.
Check: every job's title is the same in the glance table, the at-a-glance diagram, its heading and the questions; every part named on a job or card exists in the section and is named the same way; each card's parts are the ones the shape's section 4.1 (and its corrections) says remove that flaw, and each job's parts are the ones the shape lands it on; each card's candidate diagram and note agree with the parts it names and with the one-direction rule; no card or job says a screen, a tablet or a player scanner decides a fact the section gives to an engine part; each "what changed" note matches what the card or job now says; each standalone line agrees with the section's standalone tablet line; no two cards or jobs contradict each other.
Also check the plain-words edits: run git -C ${ROOT} diff -- ${CARDS} ${JOBS} ${SA_LINES} and confirm each edit kept its string's meaning, facts and counts (the editor's log is ${PLAIN_LOG}); a changed meaning is a conflict.` },
]

phase('Check')
const results = await parallel(READERS.map(r => () => agent(`${COMMON}

${r.task}

Refute by default: a claim you cannot confirm against its source is a conflict. Write ${OUT(r.key)} in Markdown: a short header (what you read, tree, date 2026-11-01), then a table with one row per conflict (where on the page, what it says, what it should say and why, citing the shape's section or the page's other place, and the file and field to change), then a list of what you checked and found consistent. Return the file, the number of conflicts, how many claims you checked, and five key points.

Done when: every element named in your part has been read against its source, every conflict has a proposed fix naming the file and field, and the counts in your summary match your table.`, { label: 'check:' + r.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })))
const ok = results.filter(Boolean)
log('page checks: ' + ok.map(r => `${r.file.split('/').pop()} ${r.conflicts} conflicts of ${r.checked}`).join('; '))
return { plain, checks: ok }
