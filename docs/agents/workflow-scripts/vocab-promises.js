export const meta = {
  name: 'vocab-promises',
  description: 'Apply the owner\'s vocabulary decision 27 (promise, not job; venue technician, not installer; titles only, no J numbers) to the owner page\'s data files: three editors, one per file group',
  phases: [{ title: 'Edit', detail: 'cards and standalone lines; the ten promises; the shape page data' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const CONS = AP + '/consistency'
const TITLES = `J1: "The designer's game is the game the whole kit plays"
J2: "One game, the same on every screen"
J3: "Every tap gets its answer, and the night can be told afterwards"
J4: "The room does what the designer cued and the GM asked"
J5: "Each lifecycle button does exactly what its name says"
J6: "The designer changes a value and plays it within minutes, and the live show never notices"
J7: "Each person sees their part and can do only their part"
J8: "The game fits the venue it is in tonight"
J9: "Anyone reading a screen can act on it without a second question"
J10: "A change is proven before it reaches anyone, and the owner alone sends it to the show"`

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page, ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py from JSON data files. The page was organized around ten "jobs" (J1 to J10). The owner found the word forced and decided the page's vocabulary (decision 27, ${ROOT}/docs/plans/CURRENT-STATE.md section 0):
- A **promise** is what a person can count on at a given moment. The page is organized around ten promises; "job" is retired everywhere on the page.
- **Parts** (the 17 pieces of the candidate design) keep promises. **Design flaws** (C1 to C16; N1 proposed) break them.
- A **quality** is something every part must have so that a promise holds everywhere (for example, every fact on a screen says how old and how sure it is). A quality keeps promises; it is never a promise itself.
- A **moment** is when a promise matters: a production stage (Author, Rehearse, Run, Review), a point in a show (doors open, mid-show, the end of a game), or release day.
- The person who fits a kit to a venue is the **venue technician**, never "installer" or "venue installer".
- Promises carry **titles only**: no numbers, so a card reads without memorizing ids. J1 to J10 must never appear in an owner-facing string.
- Shared work several promises depend on needs no word of its own: each such piece of work becomes one part in the candidate shape.

The exact titles, which you use verbatim (in double quotes) whenever a string refers to a promise; the J number on the left is only for your mapping and never appears in the output:
${TITLES}

How to rewrite. Keep each string's meaning, every fact, every count, every part name (Game rules, Pack channel, Game record, Answering, The night's record, Delivery, Connections and roles, Equipment, Show runner, Verdict, Lifecycle, Venue fit, Engine instance, Screens, Design studio, Joins and proofs, Release), every flaw id (C1 to C16, N1) and every question letter or number (A to G, 19, 21, 22, 23, 24, 25). Make the sentence fit the new word, not just swap it: "this job" becomes "this promise"; "carried by these parts" becomes "kept by these parts"; "a flaw blocks a job" becomes "a flaw breaks a promise"; "J9's label" becomes "the label every fact carries"; "J10 stays open as question F" becomes "question F stays open". Refer to another promise by its exact title in double quotes; inside a promise's own entry say "this promise". Where a long title would make a sentence hard to read, say plainly what is meant instead, and never use a number. Keep each string within about ten words of its current length. Plain, short, active sentences; no em dashes; no metaphors.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Edit only the files named in your share; another editor owns each other file, and the orchestrator owns build_report.py.`

const SCHEMA = { type: 'object', properties: { log: { type: 'string' }, changed: { type: 'integer' }, read: { type: 'integer' }, leftovers: { type: 'array', items: { type: 'string' } }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['log', 'changed', 'read', 'leftovers', 'keyPoints'] }

const EDITORS = [
  { key: 'cards', task: `Your share: ${RP}/2026-10-31-cause-cards.json (every card's title, atAShow, whyItHappens, designTerms, shapeChange, seenLive, examples[].text, after.note, and the labels in before.mermaid and after.mermaid) and ${RP}/2026-10-31-standalone-lines.json (every entry of "lines"). Keep each file's formatting: load it, edit, and write it back with json.dumps(data, indent=2, ensure_ascii=False) plus a trailing newline.` },
  { key: 'promises', task: `Your share: ${RP}/2026-10-31-engine-jobs.json. The owner-facing strings: every "purpose" paragraph; and for each entry of "jobs": functional.people, functional.moment, functional.need, functional.proposedTitle, goal, standalone, shapeChange, every line of needs and tests, and every flaws[].how. Set the seventh entry's functional.proposedTitle (J8) to exactly "The game fits the venue it is in tonight", and make every other proposedTitle exactly its title from the list. Leave each entry's "title", "meaning", "roles" and "jobChanges" fields as they are: they are the earlier wording, kept as a record. Keep the file's formatting: json.dumps(data, indent=2, ensure_ascii=False) plus a trailing newline.` },
  { key: 'shape', task: `Your share: ${RP}/2026-11-01-engine-shape.json, the page data for the "How the jobs fit together" section (it becomes "How the promises fit together"). The owner-facing strings: mechanisms[].name and .plain (the part of each plain text after "Today" will appear on a part's card, so it must read on its own), qualities[].name and .plain, today.tangles[].title and .plain, parts[].plain and .seams (keep parts[].name exactly), alternatives[].title, .a, .b and .cost, the edge labels in relationsMermaid and partsMermaid, and the labels in componentsMermaid. In relationsMermaid keep the node lines as they are (the builder relabels the nodes from the titles). Also set functional[] entries' proposedTitle to the exact titles from the list (J8 becomes "The game fits the venue it is in tonight"). Keep the file's compact formatting by editing with this formatter: python3 -I -c with
import json
def fmt(v, ind=0):
    sp='  '*ind
    if isinstance(v, dict):
        if not v: return '{}'
        return '{\\n' + ',\\n'.join(f'{sp}  {json.dumps(k, ensure_ascii=False)}: {fmt(x, ind+1)}' for k,x in v.items()) + '\\n' + sp + '}'
    if isinstance(v, list):
        if all(isinstance(x,str) and len(x)<20 for x in v): return '[' + ', '.join(json.dumps(x, ensure_ascii=False) for x in v) + ']'
        if not v: return '[]'
        return '[\\n' + ',\\n'.join(f'{sp}  {fmt(x, ind+1)}' for x in v) + '\\n' + sp + ']'
    return json.dumps(v, ensure_ascii=False)
and write fmt(data) plus a trailing newline. Leave questionNotes and ownerChoices as they are (the page does not show them).` },
]

phase('Edit')
const results = await parallel(EDITORS.map(ed => () => agent(`${COMMON}

${ed.task}

Write ${CONS}/2026-11-01-vocab-${ed.key}.md: a short header, then one table row per changed string (where, before, after), then the count of strings you read and changed.

Done when: every owner-facing string in your share has been read; python3 -I finds no whole word "job" or "jobs" (any case), no J1 to J10 token and no "installer" in those strings (show the command and its empty output in your log); every promise reference is an exact title from the list; and every file you edited parses. Return the log file, the counts, any string you could not settle (leftovers), and five key points.`, { label: 'vocab:' + ed.key, phase: 'Edit', model: 'fable', effort: 'high', schema: SCHEMA })))
log('vocab: ' + results.map((r, i) => EDITORS[i].key + (r ? ` ${r.changed} of ${r.read} changed, ${r.leftovers.length} leftovers` : ' FAILED')).join('; '))
return results