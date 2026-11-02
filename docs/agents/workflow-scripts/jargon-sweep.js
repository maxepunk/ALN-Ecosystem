export const meta = {
  name: 'jargon-sweep',
  description: "Find every carried-over term on the owner site that the owner could not understand without the internal working documents, and merge one plain wording per term into a site-wide table",
  phases: [
    { title: 'Find', detail: 'six readers, one per page, each listing terms, occurrences and a plain wording' },
    { title: 'Merge', detail: 'one agent builds the site-wide table: one wording per term, every occurrence placed' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const CHECKS = SITE + '/checks'

const COMMON = `Context. The ALN show engine's architecture pass publishes a site for the owner, "What the Engine Promises": six pages in ${SITE}/ (index.html the front page, decisions.html, promises.html, parts.html, flaws.html, changes.html), built by ${RP}/build_site.py from the page data (${RP}/2026-10-31-cause-cards.json, ${RP}/2026-10-31-engine-jobs.json, ${RP}/2026-10-31-standalone-lines.json, ${RP}/2026-11-01-engine-shape.json), three overlays (${SITE}/front.json, decisions.json, changes.json) and constants inside build_site.py. Its plan is ${SITE}/2026-11-01-site-plan.md.

The owner read the front page and wrote: "I'm seeing two pieces of jargon that seem to have been carried through from previous work without much thought. I don't understand what 'designer's week' or 'developer's proof' or 'Step 3' are supposed to mean." They mean: "the designer's week" = the designer's changes to the game between shows; "the developer's proof" = the tests a developer runs to show a change to the engine works before it reaches a show; "step 3" = the design stage of this review, where each design choice comes to the owner as its own page with two or three designs side by side.

Who the owner is: the producer and designer of About Last Night. They know the game and its words (tokens, memories, GM, players, Black Market, Detective, the scoreboard, the TV), the kit (the show machine, GM tablets, phones and hardware scanners), the words their decisions set (promise, part, quality, design flaw, moment, venue technician, candidate shape, standalone, the director), and every term the site's words box defines (front.json words). They do not read the internal working documents (workflow reports, reader sheets, maps, the program document's step tables, the capability list), and they do not keep numbered codes in their head.

What counts as jargon here: (a) coinages from working documents ("the designer's week", "the developer's proof", "its own names", "the map", "adopt" a pack); (b) process shorthand and numbered codes: step and phase numbers, round numbers, block and track names, rung numbers, capability numbers ("capability 8", "(capabilities 30 and 31)"), finding ids other than the flaw ids C1 to C16 and N1, which the owner already reads on the cards; (c) code names, module or file names, and engineering words used in running text where a plain word exists, when the words box does not define them (a card's list of code files is reference for engineers: leave it); (d) the program's codenames, such as blue and green, where the sentence does not make them clear. Not jargon: the owner's words above, the seventeen part names, the flaw titles and ids, the promise titles, terms the words box defines, ALN's own game words.

Starting wordings for the recurring terms, so every reader proposes the same thing (improve one only with a reason):
- step 1 -> this first step (the promises and the design flaws, this site); step 2 -> the test rig (rebuilding it); step 3 -> the design rounds (after the test rig, each design choice comes to the owner as its own page, with two or three designs side by side); "phase 1" -> the planning half of the review; "phase 2" -> the building half, when the engine is changed; the architecture pass -> keep, the owner knows it.
- capability numbers -> drop the number and keep the capability's plain name (the names are in ${AP}/2026-10-31-jobs-capabilities.md, table rows "| N | Name |").
- "the map" (the relationship map) -> the candidate design, or "mapping how the promises fit together", whichever the sentence means; the status tag "Recommendation changed by the map" -> "Recommendation changed by the candidate design".
- "its own names" / "each engine having its own names" -> each running copy of the engine keeping its own files, network ports and settings.
- "adopt" a pack -> load (a new version of the game); "start or adopt" an outside program -> start it, or use one already running.
- "preview engine" -> a separate trial copy of the engine; "hot-apply" -> applying a change while the engine runs, between games.
- blue and green -> define once in the words box (blue is the show machine in use now, left untouched; green is the new machine this work builds; the cutover swaps them) and reword any use whose sentence stays unclear.

Read a page as text: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>. To find where a sentence comes from, grep its words in the overlays, the data files and build_site.py.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Write only your report.`

const PAGES = ['index', 'decisions', 'promises', 'parts', 'flaws', 'changes']
const FIND_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, terms: { type: 'integer' }, occurrences: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'terms', 'occurrences', 'keyPoints'] }
const MERGE_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, terms: { type: 'integer' }, occurrences: { type: 'integer' }, wordsBoxAdds: { type: 'integer' }, openCalls: { type: 'array', items: { type: 'string' } }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'terms', 'occurrences', 'wordsBoxAdds', 'openCalls', 'keyPoints'] }

phase('Find')
const finds = (await parallel(PAGES.map(p => () => agent(`${COMMON}

Your page: ${SITE}/${p}.html. Read all of it as the owner would. Every term the owner could not understand without the internal working documents is a finding; when unsure, list it. Change changes.html's history only where a term would stop the owner understanding the entry; its quoted earlier wordings stay as they were.

Write ${CHECKS}/jargon-${p}.md. First a terms table: term; what it means here, in plain words; the plain wording you propose (from the starting wordings where one fits); or "define in the words box" when the term should stay and be defined. Then an occurrences table: every place the term appears on your page, with the sentence as it reads now, the sentence as it should read, and the exact source to change (overlay and field, data file and field with its id, or the build_site.py constant or function and line). Return the file, the counts of terms and occurrences, and five key points.

Done when: every sentence of your page has been read, and every occurrence of every term you list names its source.`, { label: 'find:' + p, phase: 'Find', model: 'opus', effort: 'high', schema: FIND_SCHEMA })))).filter(Boolean)
log('find: ' + finds.map(f => `${f.file.split('/').pop()} ${f.terms} terms, ${f.occurrences} places`).join('; '))

phase('Merge')
const merged = await agent(`${COMMON}

Your task: merge the six readers' reports (${finds.map(f => f.file).join(', ')}) into one site-wide table, ${CHECKS}/jargon-table.md, that an editor can apply without further judgment.

- One plain wording per term across the whole site, so the same idea reads the same everywhere. Where readers proposed different wordings, pick one and say why in a line. Check each wording against the term's real meaning in the sources (the shape document ${AP}/2026-11-01-engine-shape.md, the promises document ${AP}/2026-10-31-engine-jobs.md, the cause analysis ${AP}/2026-10-30-cause-analysis.md, the program document ${ROOT}/docs/plans/2026-10-30-architecture-pass.md, ${ROOT}/CONTEXT.md).
- Every occurrence from every report, deduplicated where two pages render the same source field (one change fixes both), each with its exact source and the sentence as it should read. A sentence that only works rewritten whole gets the whole sentence.
- A list of words-box additions (term and definition) for terms that stay, written for the owner.
- Open calls: anything where the plain wording would change a meaning, or where the owner's own word may be meant; say what you chose and the alternative.

Write the table with a short header (counts, what changes most), the wording table, the occurrences table grouped by source file, the words-box additions, and the open calls. Return the file, the counts, the number of words-box additions, the open calls, and five key points.

Done when: every occurrence in every report is in the table with one wording and one source, and the counts match.`, { label: 'merge', phase: 'Merge', model: 'opus', effort: 'high', schema: MERGE_SCHEMA })
log(merged ? `merged: ${merged.terms} terms, ${merged.occurrences} places, ${merged.wordsBoxAdds} words-box additions, ${merged.openCalls.length} open calls` : 'merge: no result')
return { finds, merged }