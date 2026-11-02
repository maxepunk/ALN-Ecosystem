export const meta = {
  name: 'page-consistency',
  description: 'Put the owner page\'s card and job text into plain words within firm lengths, merge and rebuild, then check the page for internal consistency and agreement with the engine shape, refute by default',
  phases: [
    { title: 'Plain', detail: 'three editors (cards C1-C8, cards C9-C16, the ten jobs), each writing an overlay; meaning kept' },
    { title: 'Merge', detail: 'merge the overlays into the page data and rebuild the page' },
    { title: 'Check', detail: 'two readers: the new section and questions against the shape; the jobs and cards against the section, and the edits against their originals' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const CONS = AP + '/consistency'
const PAGE = RP + '/2026-10-31-cause-report.html'
const BUILDER = RP + '/build_report.py'
const MERGE = RP + '/merge_plain.py'
const CARDS = RP + '/2026-10-31-cause-cards.json'
const JOBS = RP + '/2026-10-31-engine-jobs.json'
const SA_LINES = RP + '/2026-10-31-standalone-lines.json'
const SHAPE = AP + '/2026-11-01-engine-shape.md'
const SHAPE_JSON = RP + '/2026-11-01-engine-shape.json'
const EJ = AP + '/2026-10-31-engine-jobs.md'
const CS = ROOT + '/docs/plans/CURRENT-STATE.md'
const OUT = k => `${CONS}/2026-11-01-page-${k}.md`
const SKILL = '/root/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/codebase-design/SKILL.md'
const BASE = args && args.base ? args.base : 'HEAD'

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page: ${PAGE}, built by ${BUILDER} from JSON files in ${RP}. The page leads with the engine's ten jobs (J1 to J10), each with the design flaws (C1 to C16, N1 proposed) that keep it from being done well, one card per flaw. A section "How the jobs fit together" (id "fit") maps how the jobs relate and offers a candidate shape of 17 parts, from ${SHAPE} and ${SHAPE_JSON}. The cards and jobs were then reconciled with that shape and checked. The questions at the end ask the owner to decide the jobs list, questions A to G about the jobs' wording, and a few more; a last group previews the choices step 3 will ask.

The owner's words that set the bar: "I'm just generally having a hard time with the vocabulary you're using"; the page must be internally consistent, "without pieces that disagree or conflict with each other"; and design choices elsewhere on the page must follow the relationship map. The house writing rules are docs/agents/process.md sections 4 and 5: plain, clear language; short sentences; active voice; one idea per sentence; no metaphors; no compressed jargon chains; explain each decision by how the system behaves during a game, in words a product manager follows; leave out internal codes and jargon.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner (stale clones). Never open backend/.env. Write only the files you are told to write.`

const PLAIN_RULES = `How to edit. For each string: read it once as the owner would, a product person who runs the show and does not read code. Mark every word or phrase that person would stop at: a code or function name (anything with brackets or an arrow, a file name, a field name), an internal id other than C1 to C16, N1 and J1 to J10, an engineering term the page does not define, a compressed chain of nouns, a "candidate A" or "B" with no words saying what A and B are (say "in the candidate shape" and "if the tablet keeps an engine of its own" instead). Rewrite what you marked with the plainest words that keep the meaning: say what happens at a show, who sees what, what changes. Keep every fact, every count and every part name (the 17 part names are the page's own words: Game rules, Pack channel, Game record, Answering, The night's record, Delivery, Connections and roles, Equipment, Show runner, Verdict, Lifecycle, Venue fit, Engine instance, Screens, Design studio, Joins and proofs, Release). In the "In design terms" lines the design words the page defines stay (module, interface, seam, adapter, deep, shallow, leverage, locality, as ${SKILL} defines them); code signatures go: say what the interface lets a caller do.

Lengths are firm; cut repetition and asides first, never a fact the string exists to carry: "what changed" (shapeChange) two short sentences, at most 40 words, saying what the card or job proposed before, what it proposes now, and why, in show terms; a candidate note at most 45 words; a design-terms line at most 55 words; a standalone line at most 50 words, starting "In a standalone game:"; a job's need at most 60 words, its people and its moment at most 20 words each, its goal at most 60 words. In a candidate diagram keep every node and edge, keep the owner class line, and break any label longer than six words with <br/> (at most six words per line); keep every label in double quotes, no semicolon or # inside a label.

Write your overlay as valid JSON and parse it after writing (python3 -I -c "import json; json.load(open('<your file>'))"). Include every entry in your share, with every field you were given, edited or not.`

const EDITORS = [
  { key: 'cards-a', ids: 'C1 to C8', file: CONS + '/2026-11-01-plain-cards-a.json', kind: 'cards' },
  { key: 'cards-b', ids: 'C9 to C16', file: CONS + '/2026-11-01-plain-cards-b.json', kind: 'cards' },
  { key: 'jobs', ids: 'J1 to J10', file: CONS + '/2026-11-01-plain-jobs.json', kind: 'jobs' },
]

const editTask = ed => ed.kind === 'cards'
  ? `Your share: cards ${ed.ids} in ${CARDS} (fields shapeChange, atAShow, whyItHappens, designTerms, after.note, after.mermaid) and their lines in ${SA_LINES}. Read the page's "How the jobs fit together" section first (in ${SHAPE_JSON}, the parts' names and plain descriptions) so your words match the page's.

${PLAIN_RULES}

Write ${ed.file}: {"cards": [{"id": "C1", "shapeChange": "...", "atAShow": "...", "whyItHappens": "...", "designTerms": "...", "after": {"note": "...", "mermaid": "..."}, "standaloneLine": "In a standalone game: ...", "log": [{"field": "...", "replaced": "...", "why": "..."}]}]}. Do not edit ${CARDS} or ${SA_LINES} themselves.

Done when: every card in your share is in the overlay with all seven fields, every string is within its length, every marked phrase is rewritten or justified in its log, and the file parses. Return the file, how many strings you read, how many you changed, and five key points.`
  : `Your share: the ten jobs in ${JOBS} (fields functional.people, functional.moment, functional.need, functional.proposedTitle, goal, standalone, shapeChange). Read the page's "How the jobs fit together" section first (in ${SHAPE_JSON}) so your words match the page's. Keep each proposedTitle exactly as it is: titles are the owner's to decide in the page's questions.

${PLAIN_RULES}

Write ${ed.file}: {"jobs": [{"id": "J1", "functional": {"people": "...", "moment": "...", "need": "...", "proposedTitle": "..."}, "goal": "...", "standalone": "...", "shapeChange": "...", "log": [{"field": "...", "replaced": "...", "why": "..."}]}]}. Do not edit ${JOBS} itself.

Done when: all ten jobs are in the overlay with every field, every string is within its length, every marked phrase is rewritten or justified in its log, and the file parses. Return the file, how many strings you read, how many you changed, and five key points.`

const EDIT_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, read: { type: 'integer' }, changed: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'read', 'changed', 'keyPoints'],
}
const MERGE_SCHEMA = {
  type: 'object',
  properties: { merged: { type: 'boolean' }, output: { type: 'string' } },
  required: ['merged', 'output'],
}
const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'conflicts', 'checked', 'keyPoints'],
}

phase('Plain')
const edits = await parallel(EDITORS.map(ed => () => agent(`${COMMON}\n\n${editTask(ed)}`,
  { label: 'plain:' + ed.key, phase: 'Plain', model: 'fable', effort: 'high', schema: EDIT_SCHEMA })))
log('plain words: ' + edits.map((r, i) => EDITORS[i].key + (r ? ` ${r.changed} of ${r.read} changed` : ' FAILED')).join('; '))
if (edits.some(r => !r)) return { edits, stopped: 'an editor failed; nothing merged' }

phase('Merge')
const merged = await agent(`Run this command from /home/user/ALN-Ecosystem and report its output exactly: python3 -I ${MERGE}
It merges three overlay files into the page data and rebuilds the page. Change no file yourself. Done when the command has run: return merged true if it printed "merged" and a "wrote" line and exited 0, with its full output.`,
  { label: 'merge', phase: 'Merge', model: 'sonnet', effort: 'low', schema: MERGE_SCHEMA })
log('merge: ' + (merged ? merged.output.split('\n').join(' | ') : 'FAILED'))
if (!merged || !merged.merged) return { edits, merged, stopped: 'the merge failed; no checks run' }

const READERS = [
  { key: 'section-and-questions', task: `Your part: the page's top (header, "What you are deciding", "How to read a job", the design words), the "How the jobs fit together" section, and the questions at the end, against ${SHAPE} (all of it, including its last section, "Corrections from the check"), ${EJ} section 4 (the questions A to G as first asked) and ${CS} section 0 (the decisions so far and the open questions). The builder writes some of this text by hand: FIT_SUMMARY, FIT_DEVICES, OVERVIEW, BUILT, SET_ASIDE and the TEMPLATE's questions, in ${BUILDER}.
Check: every count (jobs, mechanisms, qualities, tangles, parts, dependencies, alternatives); every sentence of the hand-written summary, device lines and the at-a-glance diagram against the shape's sections 2.1, 2.2 and 4.3 (an arrow drawn solid must be a dependency the shape draws; a dashed one a quality or a shared piece); every question's facts, options and costs against the shape's section 5 notes and EJ section 4, so that each question gives both sides' costs and its recommendation follows from what the page says; that the "What you are deciding" box names the questions whose recommendation changed, and only those; that every step-3 preview item matches a choice in the shape's section 6 or its alternatives, or a place where the page departs from a ratified record; that nothing presents an open choice as decided; and that the text is in plain words by the house rules.` },
  { key: 'jobs-and-cards', task: `Your part: the ten job entries (titles, "was" lines, who and when, need, built today, goal, the parts that carry each, what changed, standalone line, the flaws listed, the needs and tests) and the sixteen cards (what changed, story, diagrams, the parts that remove each flaw, design terms, standalone line), against the "How the jobs fit together" section of the same page and against ${SHAPE}.
Check: every job's title is the same in the glance table, the at-a-glance diagram, its heading and the questions; every part named on a job or card exists in the section and is named the same way; each card's parts are the ones the shape's section 4.1 (and its corrections) says remove that flaw, and each job's parts are the ones the shape lands it on; each card's candidate diagram and note agree with the parts it names and with the one-direction rule (an arrow in a card's diagram shows a fact moving, so an arrow from an owner to Delivery reads as Delivery reading the owner's change, which the shape allows); no card or job says a screen, a tablet or a player scanner decides a fact the section gives to an engine part; each "what changed" note matches what the card or job now says; each standalone line agrees with the section's standalone tablet line; no two cards or jobs contradict each other.
Also check the plain-words edits: run git -C ${ROOT} diff ${BASE} -- ${CARDS} ${JOBS} ${SA_LINES} and confirm each edit kept its string's meaning, facts and counts (the editors' logs are in ${CONS}/2026-11-01-plain-*.json); a changed meaning or a dropped fact is a conflict.` },
]

phase('Check')
const results = await parallel(READERS.map(r => () => agent(`${COMMON}

To read the page as text: python3 -I -c "import html,re; t=open('${PAGE}').read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))".

${r.task}

Refute by default: a claim you cannot confirm against its source is a conflict. Write ${OUT(r.key)} in Markdown: a short header (what you read, tree, date 2026-11-01), then a table with one row per conflict (where on the page, what it says, what it should say and why, citing the shape's section or the page's other place, and the file and field to change), then a list of what you checked and found consistent. Return the file, the number of conflicts, how many claims you checked, and five key points.

Done when: every element named in your part has been read against its source, every conflict has a proposed fix naming the file and field, and the counts in your summary match your table.`, { label: 'check:' + r.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })))
const ok = results.filter(Boolean)
log('page checks: ' + ok.map(r => `${r.file.split('/').pop()} ${r.conflicts} conflicts of ${r.checked}`).join('; '))
return { edits, merged, checks: ok }
