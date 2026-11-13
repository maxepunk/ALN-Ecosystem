export const meta = {
  name: 'site-v10-build',
  description: "Build the owner site's version 10: the builder renders the reworked Decisions page and the sorted requirements, the promise data takes the decisions of 2026-11-02; four refute-by-default page readers, one editor, one verifier",
  phases: [
    { title: 'Build', detail: 'one builder: the promise data rows, build_site.py and site_smoke.js, rebuild and smoke' },
    { title: 'Check', detail: 'four refute-by-default readers, by page' },
    { title: 'Apply', detail: 'one editor settles every conflict, rebuilds and smoke-tests' },
    { title: 'Verify', detail: 'one reader confirms each row and reads every changed line' },
  ],
}

// args.base: the commit before this run (readers diff against it).
// args.v9: a commit holding version 9's built pages, as published (readers compare against it).
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const OUT = SITE + '/v9'
const CHECKS = SITE + '/checks'
const REQ = AP + '/requirements'
const RW = AP + '/rework'
const PLAN2 = SITE + '/2026-11-01-site-plan-v2.md'
const REC = AP + '/DECISIONS.md'
const JT = CHECKS + '/jargon-table.md'
const ROADMAP = ROOT + '/docs/plans/ROADMAP.md'
const BRIEF = AP + '/panel/2026-11-01-panel-brief.md'
const SCRATCH = '/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad'
const MERMAID_JS = SCRATCH + '/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js'
const BASE = args && args.base ? args.base : 'HEAD'
const V9 = args && args.v9 ? args.v9 : 'HEAD'
const BUILD = `cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py`
const SMOKE = `node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots-v10`

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) is redesigning the engine for the long term, top-down: requirements first, then an independent panel of architects, then design rounds taking the hardest-to-reverse decisions first. The owner reads one site, "What the Engine Promises": six linked pages (index.html, requirements.html, decisions.html, design.html, today.html, changes.html) built into ${SITE}/ by ${RP}/build_site.py from the plan ${PLAN2}. Its sources: the overlays in ${OUT} (front.json, decisions.json, design.json, changes.json, rules.json; the folder keeps its name from version 9), the requirements ${REQ}/2026-11-01-quality-targets.json and ${REQ}/2026-11-01-extension-cases.json, the page data in ${RP} (2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json, 2026-10-31-standalone-lines.json, 2026-11-01-engine-shape.json), the decision record ${REC}, the roadmap ${ROADMAP}, the panel's brief ${BRIEF} and the jargon table ${JT}.

What changed for version 10. On 2026-11-02, after version 9 went live, the owner asked whether all eighteen of its questions were really the owner's to decide. Most were not. The owner then commented on seven open points; their words are in ${RW}/2026-11-02-owner-comments.md, word for word, and five decisions were recorded that day in ${REC}: "No technical failure stops a game", the purpose added to "Standalone games: declared, never mixed", "The engine is hardware-flexible; the roadmap sets the bounds", "Two kinds of game extension", "The engine says what is fixed and what each production sets", plus "The Decisions page holds only your decisions". A rework then rewrote decisions.json in a new shape (ten questions A to J in four groups, each group with an intro; options with a label, what the option means and what it costs; a recommendation tagged "Recommendation" or "What we need from you"; then the agent's readings of the owner's words to confirm, the agent's calls with reasons for the owner to overrule, and the requirements for review) and updated the requirements (a new target QT44, four new cases EX25 to EX28, every number sorted by a numberKind field, every case marked by a kind field), design.json, front.json, changes.json (a version 10 entry and a "letters" table saying where each of version 9's eighteen letters went) and the panel brief. The rework's working files are in ${RW}: owner-questions.md (the questions drafted blind), sorting.md, impact.md (every change the decisions cause, by row), write-log.md, check-decisions.md, check-requirements-design.md, apply-log.md.

The rules for every page: the earlier 17-part candidate is "the earlier candidate", one input among the panel's, never current or decided. Decisions go by their record titles; a reading of the owner's words marked "to be confirmed" is never shown as settled or as the owner's. No visible id. Question letters appear only on the Decisions page, and as history on the change log. No numbered lists of decisions, steps or choices; no bare phase, step, block, round, decision or question number outside the change log. The jargon table's wordings; no metaphors; no internal code names (for example "blue" and "green" for the two show machines: say "the show machine in use now" and "the new show machine", or "today's engine" and "the new engine"). Plain, short, active sentences; no em dashes; facts match their sources. A title dropped bare into a sentence is quoted with typographic quotes (“ ”), the quotes outside any [[marker]]. The site's own prose addresses the owner as "you": the overlays, the builder's own texts and the requirements' status lines (whose machine-read lead "settled by the owner" stays as it is; the builder rewrites it). "The owner" stays as a role name in the shared texts the independent panel will also read: the requirements' situation, case, numberToSet and why fields, rules.json, the promise data (2026-10-31-engine-jobs.json), the cards and the earlier candidate. "The agent running the pass" names the lead agent; never "orchestrator" (in this project that word means the backend).

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Do not edit ${REC}: list any change the record needs in your log for the agent running the pass.`

const BUILD_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, dataRows: { type: 'integer' }, frontWords: { type: 'integer' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'buildPassed', 'smokePassed', 'dataRows', 'frontWords', 'notes'] }
const CHECK_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, forLead: { type: 'array', items: { type: 'string' } }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'forLead', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, slips: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'slips', 'keyPoints'] }

// ---------------------------------------------------------------------------------------------------
phase('Build')
const build = await agent(`${COMMON}

Your task: make the site build version 10 from the reworked sources. The build fails today (its first error: an extension case linked twice in one front-page growth line is counted as falling in two groups). Three parts.

1. The promise data. Apply rows 49 to 62 of ${RW}/impact.md: rows 49 to 60 to ${RP}/2026-10-31-engine-jobs.json (and the same facts where its markdown twin ${AP}/2026-10-31-engine-jobs.md states them), rows 61 and 62 to ${RP}/2026-10-31-standalone-lines.json. These are shared texts: "the owner" as a role, no "you", no question letters and no [[q:]] markers; a title in a sentence takes typographic quotes. Check each row's "before" against the file first; where the file's words differ, apply the row's intent to the words the file has. Edit text in place and keep each file's layout; never re-dump a file that does not already round-trip.

2. The builder ${RP}/build_site.py and the smoke test ${RP}/site_smoke.js.
- The Decisions page renders decisions.json's new shape, in this order: the page heading and intro paragraphs; "Open now" with each group's title, its intro paragraphs and its questions; then three new sections, each with an anchor and a one-line lead-in in the builder's own words, addressing the owner as "you": the readings (anchor "readings"; each reading's text, then its source introduced as where the reading comes from; the lead-in says each is the agent's reading of the owner's words, not something the owner said, and nothing is built on it until the owner confirms it), the agent's calls (anchor "calls"; each call's title as a heading with the anchor "call-" plus its title under the site's slug rule, then the call, then its reason under a "Why" tag; the lead-in says these are choices that are not the owner's to make, made by the agent running the pass, and that each stands unless the owner overrules it by its title in the chat) and the review (anchor "review"; each item's title, what to review and its link; the quality targets item lists its "numbers" under a short tag such as "How each number is sorted"); then the design rounds and the later choices, then "Decided, by topic", as now. Each question shows its status tag, "A." and its title, "What it decides", "What we know" (its evidence list), its options and its recommendation. Each option shows its label, what it means and what it costs, each part visibly labelled. The recommendation shows its recKind as its tag; style "What we need from you" so it reads at a glance as a call the owner must make, distinct from "Recommendation". Update any on-page contents, navigation or anchors the Decisions page lists.
- Add a [[call:slug]] marker (the slug of a call's title under the same rule as [[dec:]]) that renders the call's title as a link to decisions.html#call-<slug>, and fails the build on an unknown slug.
- The builder's own texts that still name version 9's questions by letter: the set-aside row "A question for you" ([[q:O]]) becomes a row for the agent's call [[call:every-refused-gm-scan-attempt-is-recorded]], with a category label that says it was settled by the agent's call; the quality targets' "Listed with the other numbers to set on [[q:A|Decisions]]" and the qualities lead-in ("... leave a number for you to set; Decisions lists them in one place, under the question “[[q:A]]”") say instead that each number is sorted as an engine requirement or limit, a production's setting or a technical default, and that Decisions lists them in one place under the review, linking decisions.html#review; the today page's "Waiting for your answer" note on the standalone declaration ([[q:G]]) becomes a note on the agent's call [[call:the-missing-standalone-declaration-is-a-design-flaw-of-its-own]], which the owner can overrule. No text should tell the owner a number is theirs to set.
- The Requirements page: each quality target with a numberToSet shows it under the tag "The number" (not "Number to set") with the sort its numberKind names: engine, "An engine requirement or limit"; production, "A production's setting"; default, "A technical default"; mixed, "Mixed: the text gives each part's sort". Each extension case shows its kind after "Who", under a "Kind" tag: "inside the game", "A mechanic made inside the game"; "for all games", "An extension for all games"; the two "neither: ..." values as "Neither kind: " plus the rest of the value. The build fails on a numberToSet with no numberKind, and on a missing or unknown kind.
- growth_groups: a case linked more than once in one group's line counts once; a case in two different groups still fails the build.
- The change log renders changes.json's new top-level "letters" table (version 9's eighteen letters and where each went) under the anchor "letters", where the change log's intro places it; the recommendations table accepts a plain title in recommendations[].question as well as a [[q:X]] marker. The letters on the change log are version 9's history, never [[q:]] markers to version 10's questions.
- The build's checks: no [[q:]] marker outside decisions.json and none in the builder's own texts; every [[call:]], [[dec:]], [[qt:]], [[ex:]], [[promise:]], [[part:]], [[flaw:]] and [[page:]] marker resolves; each question's recKind is "Recommendation" or "What we need from you"; each option has a label, a means and a cost; each reading has a source; the call anchors are unique. Keep every existing check. The docstring and comments that describe the current site say version 10; history ("The words replaced in version 9") stays.
- The front page's word limit stays at 2,625 words. If the front page is over it, cut front.json text (repetition first), keeping every fact and decision, and log each cut.
- site_smoke.js: load the new sections and anchors, and keep the 24 loads (six pages, two widths, both themes).

3. Rebuild and smoke-test until both pass: ${BUILD} (its checks must pass), then ${SMOKE} (24 loads must pass). Look at the Decisions page yourself at phone width in both themes (the smoke test's screenshots are in ${SCRATCH}/site-shots-v10) and fix any layout fault you see: overflow, a tag on its own line, a section with no visible heading.

Write ${OUT}/build-log-v10.md: the data rows (each applied, or adapted with the reason), every builder and smoke change, the checks added, any front-page cuts, the build and smoke results, and any change the record needs. Return the log's path and a summary, whether the build and smoke passed, how many data rows you applied, the front page's word count, and notes.

Done when: the build's checks pass, the smoke test passes all 24 loads, every row 49 to 62 is applied or adapted with its reason, and the Decisions page shows every field of decisions.json.`, { label: 'build:v10', phase: 'Build', effort: 'high', schema: BUILD_SCHEMA })
log('build: ' + (build ? `build ${build.buildPassed ? 'passed' : 'FAILED'}, smoke ${build.smokePassed ? 'passed' : 'FAILED'}, ${build.dataRows} data rows, front ${build.frontWords} words` : 'no result'))
if (!build || !build.buildPassed || !build.smokePassed) {
  return { build, stopped: 'the build or the smoke test did not pass; the checks did not run' }
}

// ---------------------------------------------------------------------------------------------------
phase('Check')
const CHECK_HOW = `How to check. Refute by default: assume a line is wrong until its source shows it right. Read the built page in ${SITE} (open the HTML; a browser is not needed), its sources, and version 9's page as published (git -C ${ROOT} show ${V9}:docs/plans/architecture-pass/report/site/<page>.html) for anything lost or changed by accident; the source changes since the run began are git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/. Every conflict gets a row: where on the page (section and the first words), what it says, what is wrong and against which source, the fix in exact words, and the file and field to change. Group the rows by kind: facts, meaning lost or changed, the owner's voice ("you" and "the owner"), plain words and jargon, rendering, rule breaks. Then a short list of what you found right. Write the file, then return its path, the number of conflicts and of lines checked, and five key points.`

const READERS = [
  { key: 'decisions', file: CHECKS + '/v10-check-decisions.md', effort: 'xhigh', model: 'fable',
    task: `Check decisions.html, the page the owner will answer from, against decisions.json, ${REC}, the owner's comments word for word, owner-questions.md and sorting.md (the reasons behind each question and call), and the rules. Read it as the owner would: the producer, not an engineer, who asked to see each conflict and what it means functionally at a show before answering. Flag any sentence the owner could not follow without the internal documents (a term the jargon table replaces, a code name, a file name, a name for a design round the site never defines); any question whose explanation of what happens at a show, for the GM at a failure, for the designer or for an adopting production is missing, unclear or wrong against its sources; any option whose meaning or cost is unclear; any recommendation that says something is the owner's when the record says it is the agent's, or the reverse; any reading or call shown as settled; any question that does not end with a request the owner can answer in one line; any fact that disagrees with its source; any place the page repeats itself at length (name what to cut, never a practice explanation the owner asked for); and any rendering fault (a missing field, a broken link, the wrong tag, the wrong order).` },
  { key: 'requirements', file: CHECKS + '/v10-check-requirements.md', effort: 'high',
    task: `Check requirements.html against the two requirements files, the promise data (2026-10-31-engine-jobs.json), the standing rules (rules.json), ${REC}, impact.md and sorting.md. In particular: the new target QT44 and cases EX25 to EX28; each number's sort as numberKind gives it and as the review on decisions.html states it (the two must agree); each case's kind and whether it fits the definitions of the two kinds in ${REC} ("Two kinds of game extension", in the owner's tentative words); the status lines ("you" in the site's voice; "settled by the owner" rendered as the builder rewrites it); the promise entries that rows 49 to 60 of impact.md changed; the counts stated anywhere on the page (forty-three targets, twenty-eight cases); every link.` },
  { key: 'design-front-changes', file: CHECKS + '/v10-check-design-front-changes.md', effort: 'high',
    task: `Check design.html, index.html and changes.html against design.json, front.json, changes.json, ${REC} and ${BRIEF}. In particular: the decisions of 2026-11-02 stated as the record states them (tentative words kept where the record keeps them; a reading never stated as settled); no reference to version 9's eighteen questions or their letters outside the change log's history; the counts (ten questions, forty-three targets, twenty-eight cases, fifteen later choices, the same fifteen in the same words on Decisions and Design); the panel section on design.html against the brief; the front page's own words and its picture against the record; the change log's version 10 entry and its "letters" table checked row by row against version 9's Decisions page as published (git -C ${ROOT} show ${V9}:docs/plans/architecture-pass/report/site/decisions.html) and against version 10's decisions.json.` },
  { key: 'today-data', file: CHECKS + '/v10-check-today-data.md', effort: 'high',
    task: `Check today.html, and the promise texts wherever a page shows them, against 2026-10-31-engine-jobs.json, its markdown twin ${AP}/2026-10-31-engine-jobs.md, 2026-10-31-standalone-lines.json, 2026-10-31-cause-cards.json, ${REC} and rows 49 to 62 of impact.md. In particular: each of rows 49 to 62 applied as its intent says and agreeing with the record (a reading to be confirmed never stated as settled); the review of standalone games and the flaw it names; the set-aside list's row on refused GM scans; the note on the missing standalone declaration; no question letter, no [[q:]] leftover and no "your open question" pointing at a question that moved.` },
]

const checks = await parallel(READERS.map(r => () => agent(`${COMMON}

${r.task}

${CHECK_HOW}

Write ${r.file}.

Done when: every line of the page in your scope has been read against its source, and every conflict has a row with its exact fix.`, { label: 'check:' + r.key, phase: 'Check', effort: r.effort, model: r.model, schema: CHECK_SCHEMA })))
const found = checks.filter(Boolean)
log('checks: ' + found.map(c => c.file.split('/').pop() + ' ' + c.conflicts).join('; '))

// ---------------------------------------------------------------------------------------------------
phase('Apply')
const files = READERS.map(r => r.file).join(', ')
const apply = await agent(`${COMMON}

Your task: settle every conflict in ${files}; rebuild; smoke-test.

- Verify each conflict against its source before changing anything; apply it, or reject it with a reason.
- Rulings of the agent running the pass: a question stays a question and a call stays a call (if a row argues that a question is not the owner's or a call is, change nothing and list the row under "for the lead"); a practice explanation the owner asked for is never cut, only repetition; the owner's words stay word for word where quoted; a fact you change in a shared text you change where its source document states it too, except ${REC}, whose needed changes you list for the lead.
- Edit only the overlays in ${OUT}, the two requirements files, the four data files and ${AP}/2026-10-31-engine-jobs.md, ${BRIEF} (where a fixed fact is also stated there), ${RP}/build_site.py and ${RP}/site_smoke.js. Keep every JSON valid and its layout: edit text in place.
- Rebuild: ${BUILD} (its checks must pass). Smoke: ${SMOKE} (24 loads must pass).
- Write ${CHECKS}/v10-apply-log.md: one row per conflict (its check file and row, applied, rejected or for the lead, the change or the reason, the source), the list for the lead, then the build and smoke results.

Return the log, how many rows you applied and rejected, the rows for the lead, whether the build and smoke passed, and a note per rejection.

Done when: every conflict of the four files is settled, the build's checks pass and the smoke test passes.`, { label: 'apply:v10', phase: 'Apply', effort: 'high', model: 'fable', schema: APPLY_SCHEMA })

// ---------------------------------------------------------------------------------------------------
phase('Verify')
const verify = await agent(`${COMMON}

The rows settled in this run: every conflict in ${files}, as ${CHECKS}/v10-apply-log.md records them. The changes: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/ (sources, builder) and the rebuilt pages in ${SITE}.

Refute by default. For each row, read the rebuilt page where it lands and say resolved, partly or unresolved; for a rejection, say whether the reason holds. Then read every line the apply round changed, as it now reads on its page, and list any slip the change made (a broken sentence, a wrong fact, a rule broken), with where, what it says, what it should say and the exact place to change it. Do not reopen lines this run did not touch after the checks.

Write ${CHECKS}/v10-verify.md: a short header, the verdict table, the slips table, then what you found right. Return the file, the counts (resolved, partly, unresolved, slips) and five key points.

Done when: every row has a verdict and every line the apply round changed has been read on its page.`, { label: 'verify:v10', phase: 'Verify', effort: 'high', schema: VERIFY_SCHEMA })
log('apply: ' + (apply ? `${apply.applied} applied, ${apply.rejected} rejected, ${apply.forLead.length} for the lead` : '?') + '; verify: ' + (verify ? `${verify.resolved} resolved, ${verify.partly} partly, ${verify.unresolved} unresolved, ${verify.slips} slips` : '?'))
return { build, checks: found, apply, verify }
