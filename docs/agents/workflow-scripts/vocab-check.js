export const meta = {
  name: 'vocab-check',
  description: 'Check the rebuilt owner page against the owner\'s vocabulary decision 27 and for meaning kept, refute by default; two readers split by page half',
  phases: [{ title: 'Check', detail: 'two refute-by-default readers: the top, the fit section and the questions; the promises and the cards' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const CONS = AP + '/consistency'
const BASE = args && args.base ? args.base : 'HEAD'
const TITLES = `"The designer's game is the game the whole kit plays"; "One game, the same on every screen"; "Every tap gets its answer, and the night can be told afterwards"; "The room does what the designer cued and the GM asked"; "Each lifecycle button does exactly what its name says"; "The designer changes a value and plays it within minutes, and the live show never notices"; "Each person sees their part and can do only their part"; "The game fits the venue it is in tonight"; "Anyone reading a screen can act on it without a second question"; "A change is proven before it reaches anyone, and the owner alone sends it to the show"`

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page, ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py from ${RP}/2026-10-31-cause-cards.json, ${RP}/2026-10-31-engine-jobs.json, ${RP}/2026-10-31-standalone-lines.json and ${RP}/2026-11-01-engine-shape.json. The owner has just decided the page's vocabulary (decision 27: ${ROOT}/docs/plans/CURRENT-STATE.md section 0; the glossary entries in ${ROOT}/CONTEXT.md section 7 (promise, moment, part, quality, design flaw) and section 5 (venue technician)). The page was rebuilt in those words; the changes are in git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/report/ (and the editors' logs ${CONS}/2026-11-01-vocab-*.md).

The rules the page must follow:
- A promise is what a person can count on at a given moment. "Job" no longer names anything on the page; the only allowed mentions are the historical ones that say the promises were first written as jobs ("Earlier wording, as a job", "first written there as jobs", "\\"job\\" is gone").
- Parts keep promises; design flaws break them; a quality is something every part must have so a promise holds everywhere, never a promise or a part.
- Promises go by their titles, with no numbers: no J1 to J10 anywhere a reader sees (headings, tables, diagram labels, cards, questions). The ten titles, verbatim: ${TITLES}. Every reference to a promise uses one of these exactly, or plainly says what is meant without a number.
- The person who fits a kit to a venue is the venue technician, never "installer".
- Meaning, facts, counts, part names, flaw ids (C1 to C16, N1) and question letters and numbers are unchanged from before the vocabulary change, except where the vocabulary itself changed them.
- Plain, short, active sentences; no metaphors; no em dashes (docs/agents/process.md sections 4 and 5).

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Write only your report file.

Read the page as text, with diagrams' labels kept: python3 -I -c "import html,re; t=open('${RP}/2026-10-31-cause-report.html').read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))".`

const READERS = [
  { key: 'top-fit-questions', task: `Your part: the page's top (header, "What you are deciding", "How to read a promise", the words box), the glance table, the section "How the promises fit together" (summary, both diagrams' labels, qualities table, tangles, parts and their cards, the devices list, the alternatives) and every question at the end.` },
  { key: 'promises-cards', task: `Your part: the ten promise entries (title, earlier wording, need, who and when, what changed, the parts that keep it, built today, the goal, the design flaws that break it, the standalone line, the needs and test cases) and the sixteen cards (what changed, story, both diagrams' labels, the parts that remove each flaw, design terms, standalone line, examples).` },
]
const SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }

phase('Check')
const results = await parallel(READERS.map(r => () => agent(`${COMMON}

${r.task}

Refute by default: anything that breaks a rule above, reads unnaturally because a word was swapped rather than the sentence rewritten, or changes a meaning is a conflict. For each conflict give where on the page, what it says, what it should say, and the file and field (or the builder's text) to change. Write ${CONS}/2026-11-01-vocab-check-${r.key}.md: a short header, the conflicts table, then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.

Done when: every element in your part has been read against the rules, every conflict names its file and field, and the counts match your table.`, { label: 'check:' + r.key, phase: 'Check', model: 'opus', effort: 'high', schema: SCHEMA })))
log('vocab check: ' + results.filter(Boolean).map(r => `${r.file.split('/').pop()} ${r.conflicts} conflicts of ${r.checked}`).join('; '))
return results.filter(Boolean)
