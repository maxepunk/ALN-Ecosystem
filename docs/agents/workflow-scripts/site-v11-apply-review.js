export const meta = {
  name: 'site-v11-apply-review',
  description: 'Version 11 of the owner site: apply the independent review of version 10 (five writers on separate files, one integration build), then four refute-by-default page checks, one editor, one verifier',
  phases: [
    { title: 'Write', detail: 'Decisions data; requirements and promise data; Design, front page, change log and brief; the decision record; the builder' },
    { title: 'Integrate', detail: 'cross-file items, build, smoke, a look at phone width' },
    { title: 'Check', detail: 'four refute-by-default readers' },
    { title: 'Apply', detail: 'one editor applies every confirmed conflict' },
    { title: 'Verify', detail: 'one reader confirms each fix and reads every changed line' },
  ],
}

// args: { model: '<model for every agent>', date: '2026-11-10', base: '<commit before the run>', scratch: '<the session scratchpad>' }
const A = args || {}
const MODEL = A.model
const DATE = A.date
const BASE = A.base
const SCRATCH = A.scratch
const ROOT = '/home/user/ALN-Ecosystem'
const AP = `${ROOT}/docs/plans/architecture-pass`
const REPORT = `${AP}/report`
const SITE = `${REPORT}/site`
const V9 = `${SITE}/v9`
const CHECKS = `${SITE}/checks`
const MERMAID = `${SCRATCH}/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js`
const SHOTS = `${SCRATCH}/site-shots-v11`
const TEXT11 = `${SCRATCH}/v11text`
const H2T = `${SCRATCH}/html2text.py`
const opts = (label, phase, schema, effort) => ({ label, phase, schema, effort: effort || 'high', ...(MODEL ? { model: MODEL } : {}) })

const COMMON = `
You are applying an independent review to the owner's site "What the Engine Promises", the site of the architecture pass of the ALN engine, to make version 11. Today is ${DATE}. The sources stood at commit ${BASE} before this run.

The engine runs "About Last Night", a two-hour immersive game: a server on a Raspberry Pi 5 (the show machine) runs the game, video, sound, music and lighting; game masters (GMs) work from tablets (a web app); players scan memory tokens with phones (a web page) or small hardware scanners (ESP32); a TV shows the scoreboard. The pass designs the engine's next iteration under the owner's goal: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)". It is in its design half: the requirements now; then an independent panel of architects; then design rounds, hardest-to-reverse decisions first.

The owner has not answered version 10's questions. Before answering they asked for an independent review, "to make sure the design is optimal and what you need input from me about is clearly defined before I give my input". Four reviewers, a refute-by-default check of each and a merge produced ${CHECKS}/v10-review.md, the merged report. Its parts: "Where the checks disagreed, and how I ruled"; (a) the owner's questions; (b) readings and the agent's calls; (c) facts to correct; (d) the design approach; (e) smaller clarity fixes; "Parts the checks refused. Do not apply these"; part 3, for the owner. Several of its changes point to texts in the eight files beside it: v10-review-asks-1.md and v10-review-asks-1-verify.md, v10-review-asks-2.md and -verify, v10-review-design.md and -verify, v10-review-outside.md and -verify (the merged report cites the design check's "texts H2-S, H2-T, H2-E, H5-D", the asks-1 check's "I-1", the asks-2 check's texts under "A2-M2", "A2-M3", "A2-M4", "A2-H4", the outside check's list under "O5", and so on). Read the merged report in full first, then the files beside it wherever your share points.

The agent running the pass accepts every ruling in the merged report, with these rulings of its own, which win where they differ:
R1. Version 11, dated ${DATE}. The questions are re-lettered. A to F keep their letters and titles. The new question "A player who sends a scan without the token" is G, last in the first group. Version 10's G, "Which standalone games the engine must run", becomes H. Version 10's J, "What the panel gets in its blind round", becomes I. Version 10's H and I leave. Anchors follow the letters (q-a to q-i), so every link to a question on any page must be re-pointed, and every such link is labelled with that question's exact title.
R2. Five readings to confirm, not six. The merged report's (b) lists five: one kept, one reworded, three new. Use five everywhere.
R3. Thirteen agent's calls. Kept, with the changes (b) gives: "Four readings of earlier decisions are confirmed"; "The quality targets' numbers are sorted, not asked"; "The missing standalone declaration is a design flaw of its own"; "The tap promise is to be split in two"; "Every refused GM scan attempt is recorded"; "The panel's three lenses"; "The second round reads today's code". Merged into one: "Three choices about how the promises are worded" (from "The venue promise stays one", "Proof and release stay one promise" and "The route for equipment state is named in neither promise"). New: "A standalone game follows the rule you ratified for missing equipment"; "Who wins when two tablets claimed one token while apart"; "The design allows other hardware; what the first release requires comes with the build plan"; "Each architect lists the decisions before seeing the agenda"; "In a standalone game, whoever holds the GM tablet holds the game's controls". Leaving the list: "The program watcher's retries", "How long before a screen says the engine is silent" and "The show machine's limits" (their content and reasons stay in the review's list of numbers), and "Exposed evidence and video with no engine" (deleted; its content becomes the three proposed rows in the standalone group's introduction). A call's anchor is "call-" plus the slug of its title (lower case, every run of characters that are not letters becomes one hyphen, trimmed), and [[call:slug]] markers use the same slug.
R4. Nine questions, five readings, thirteen calls, forty-seven quality targets (the four new ones are QT45 to QT48, each proposed) and twenty-eight extension cases. Every count on every page and in the record agrees with these.
R5. The engine's shipped default for how long data is kept: the agent proposes 90 days for every kind of data, until a production sets its own. QT30's number line and the review's numbers line say the same, marked as the agent's proposal.
R6. Today's behaviour written inside the requirements (the design check's D-L5 list: "why", "numberToSet", "case", "status", "when", "throughWhat") moves into a new field "today" on that target or case, one or two plain sentences; the field it left is reworded to read well without it. Requirements shows "today" under its own tag. The panel's folder will leave the field out, and the brief says so.
R7. The seventh decision, "How the engine drives the room", is put to the owner inside question I only. It is not added to Design's list of decisions ahead now. Design's introduction to that list says in one sentence that it is proposed and joins the list only if the owner says yes under "What the panel gets in its blind round". Its full draft entry (title, what it decides, its drivers, what is settled, its test situations, as d1 and the outside check under O5 give them) goes into the Design writer's log, for later.
R8. The later choices: decisions.json "later" is the source. design.json's copy is made identical to it at integration.
R9. No model name, model id or vendor name in any file. Where a page or the record mentions this review it says "an independent review" or "the review you asked for".
R10. Edit only the files your task owns. Where a change in the merged report lands in a file another writer owns, write it in your log under the heading "For other files", with the file, the field and the exact change; the integration step applies it.

The contract for new data, which the builder renders:
- decisions.json. Each question gains "neededBy" (string, required; the marks in a8). A new top-level "waitsFor": {"title": "What the panel waits for", "text": [paragraphs]}, a8's block. A new top-level "answerSheet": [{"label": "A. <title>", "form": "<the exact form of the answer>"}, ...], one line per question in order, then one line each for the readings, the requirements ("reviewed"), the panel's brief, and the three small facts only the owner has (whether the GMs keep a token once it is sold or exposed; whether the show machine ever failed for good during a show; any device the owner expects to use soon that is not in ALN's kit). A group may have "questions": [] (the hardware group, after a7).
- changes.json. A new top-level "lettersV10": ten rows {"was": "X. <version 10's title>", "where": "<plain text>"} for A to J, plain text with no question marker. A new first entry in "versions" for version 11 (version, date, title, items, prompt).
- The requirements JSON files. An optional "today" (string) on any target or case. New targets QT45 to QT48 with every field the other targets have and "statusKind": "proposed".
- Markers in any text: [[dec:slug]], [[call:slug]], [[qt:QTnn]], [[ex:EXnn]], [[promise:Jn]], [[flaw:Cn]] or [[flaw:N1]], [[part:Pn]], [[page:<page>#<anchor>|<label>]], and [[q:X]] (in decisions.json only). Every marker must resolve, or the build fails.

The owner's rules for anything they read, which every text you write follows: plain, short, active sentences; no metaphors; no em dashes; no internal codes or code names (the two machines are "the show machine in use now" and "the new show machine"); explain by how the system behaves at a show; a title dropped into a sentence takes typographic quotes “ ” outside its marker. The site's own texts (the overlays and the builder's texts) say "you" to the owner. The shared texts the panel also reads (the requirements, the promise data, the cards, the brief) say "the owner", except the requirements' status lines, which say "you" as they do now. The decision record calls the owner "the owner" and the lead "the agent running the pass"; it keeps the owner's words exactly, writes nothing inferred as if the owner said it, and records each change as a dated history line (${DATE}). The owner's own words, which every quote must match, are in ${AP}/rework/2026-11-02-owner-comments.md.

Before you write a fact about today's engine, check it in the code (${ROOT}/backend, ${ROOT}/ALNScanner, ${ROOT}/aln-memory-scanner, ${ROOT}/arduino-cyd-player-scanner, ${ROOT}/ALN-TokenData; each has a CLAUDE.md). The merged report names three checks to make before publishing: what a cut-off tablet can do with the game's clock; each row of the standalone table; and every place that names the two removed questions.

The files: the overlays ${V9}/decisions.json, design.json, front.json, changes.json; the requirements ${AP}/requirements/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json; the promise data ${REPORT}/2026-10-31-engine-jobs.json and its markdown twin ${AP}/2026-10-31-engine-jobs.md; ${REPORT}/2026-10-31-standalone-lines.json; the cards ${REPORT}/2026-10-31-cause-cards.json; the record ${AP}/DECISIONS.md; the brief ${AP}/panel/2026-11-01-panel-brief.md; the builder ${REPORT}/build_site.py and the smoke test ${REPORT}/site_smoke.js; the built pages ${SITE}/*.html. Version 10's pages as text are in ${SCRATCH}/v10text. JSON files round-trip with json.dumps(indent=2, ensure_ascii=False) plus a newline, so load, change and write back, and only the changed strings differ. front.json does not round-trip: edit it as text, one string at a time, and check it still parses.

Safety: never open ${ROOT}/backend/.env (it holds a live access token). Never read /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner (stale copies). Run no git command that changes anything; nothing is committed in this run.`

const WRITE_SUMMARY = {
  type: 'object',
  properties: {
    log: { type: 'string' },
    applied: { type: 'integer' },
    notApplied: { type: 'integer' },
    forOtherFiles: { type: 'integer' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['log', 'applied', 'notApplied', 'forOtherFiles', 'keyPoints'],
}

const WRITERS = [
  {
    key: 'decisions',
    task: `Your task: ${V9}/decisions.json, and only that file. Apply every change of the merged report that lands in it: all of (a), a1 to a12 (the texts of a5 and a7 that become calls go into "calls"); (b), the readings and the calls, with R2 and R3 (the leads READINGS_LEAD, CALLS_LEAD and REVIEW_LEAD are the builder's, so list them for other files); from (c), items 1 to 3 (inside (a)), 6, 7 and 8 (the conflicts' introduction), 10 and 11 (the numbers list), 14; from (d), d4's practice item for C, d12's naming of the four new targets in the review, d13's first numbers line; from (e), 1 to 4, 6 (the later choices, including the one on B) and 7 as it concerns this file; R5's numbers line; the contract's "neededBy", "waitsFor" and "answerSheet"; R1's letters, anchors and [[q:X]] markers; and every place in the file that names a removed question, reading or call, the decided entries included (restore "and no live game feed" in the settled roles' entry, as a11 says). Check in the code the facts you write, and above all the game's clock on a cut-off tablet and each row of the standalone table; write what you found in your log. Write your log to ${V9}/apply-log-v11-decisions.md: every change (the field, what changed, the finding ids), every item not applied with its reason, and "For other files". Done when every item of the merged report that lands in decisions.json is applied or listed with a reason, and the file parses and round-trips.`,
  },
  {
    key: 'requirements',
    task: `Your task: the two requirements files, the promise data and its markdown twin, the standalone lines and the cards, and only those files. Apply: from (c), items 4 and 5 (QT42, EX17, QT11, QT43, with the design check's texts H2-S, H2-T and H2-E), 6 (QT31's situation and status, QT14's addition, both proposed), 7 (QT21), 9 ("no engine" becomes "no show machine" in every requirement and promise text the panel gets; the glossary's sense of "the engine" is in ${ROOT}/CONTEXT.md near line 26), 10 (QT5), 11 (QT40), 12 (QT24's title and situation, EX16's case); from (d), d8 (QT44), d11 (EX12's goes-through and must-not-need, QT27), d12 (QT45 to QT48, each proposed and placed under its quality by that quality's exact name in the file); R5 (QT30); R6 (move today's behaviour into "today" fields, the design check's D-L5 list); from (a), a2's EX25 "when" and a5's three proposed rows mirrored in QT37's status; from (b), EX12's "who" and "case" and the clause leaving QT38's status; the files' own introductions and counts; and every place in your files that names a removed question, reading or call (a [[call:]] marker to a call that left or merged; a [[page:decisions#q-..|..]] link re-pointed and relabelled by R1). Where the card for the seventeenth flaw, a card's standalone line or the standalone comparison text named the deleted call "Exposed evidence and video with no engine", point instead to the proposed rows in the standalone group's introduction ([[page:decisions#g-standalone-games|Standalone games]]); where that text lives in the builder, list it for other files. Write your log to ${V9}/apply-log-v11-requirements.md, as the other writers do, with "For other files". Done when every item of the merged report that lands in your files is applied or listed with a reason, and each JSON file parses and round-trips.`,
  },
  {
    key: 'design',
    task: `Your task: ${V9}/design.json, ${V9}/front.json, ${V9}/changes.json and ${AP}/panel/2026-11-01-panel-brief.md, and only those files. Apply: from (d), d1 (the wording changes it asks whatever the owner answers; R7 for the seventh decision, whose full draft goes in your log), d2, d3, d4 (Design's parts), d5, d6, d7, d8, d9 and d14; R6's line in the brief; from (c), item 9 (the front page's words list gains the entry "The engine"; "no show machine" wherever Design and the brief mean it), item 12 (the front page's and Design's one-kit lines and their bound), item 13 (Design's decided paragraph on the protocol's versions); from (e), item 6's change to Design's authority round; from (a), a8's line for the brief (an open question goes to the panel as its "What it decides" paragraph only) and a11's changes as they reach the brief and Design (the settled roles go to the setting, the agenda staging, how readings reach the panel), and (b)'s brief lines (the asks-2 check under A2-M4, the brief's lines 110 to 120 and 172 to 174); the front page's every count and list of questions (nine, by title, R1 and R4) and every place on it that names a removed question, reading or call, keeping its prose under 2,625 words (the build counts it; cut repetition first, never a decision); changes.json: the version 11 entry (R9; its prompt says what the owner asked, without a model name, and quotes the owner's words that carry none) and "lettersV10" (ten rows, from where the merged report sends each of version 10's questions). Leave design.json's later choices alone (R8). Write your log to ${V9}/apply-log-v11-design.md, with "For other files" and R7's full draft. Done when every item of the merged report that lands in your files is applied or listed with a reason, and each file parses.`,
  },
  {
    key: 'record',
    task: `Your task: ${AP}/DECISIONS.md, and only that file. Apply every change of the merged report that lands in the record: the reading that leaves (a GM tablet that loses the engine keeps taking scans: it is one of the options of the owner's question "A GM tablet cut off from the engine") and the reworded and new readings, each in its entry and marked to be confirmed; the changed content of the call "Four readings of earlier decisions are confirmed" in "The nine questions the pass answers" and in "Read as overtaken, confirmed as the agent's call" (the four questions on the game's live facts are designed together in the first decision); the clause on QT38 in "Still open"; (c) item 9's summary sentence in "Standalone games: declared, never mixed" ("no engine" becomes "no show machine"; the owner's quote stays); history lines dated ${DATE} where a question leaves the page for a call (the standalone entry, for the rule on what a standalone game gives up; "The engine is hardware-flexible; the roadmap sets the bounds", for the hardware question) and in "What the architects' panel sees, and when" (an open question goes to the panel as its "What it decides" paragraph only, the agent's reading of the owner's rule that its recommendations are withheld; the agenda staging is the agent's call); "Still open" rewritten for version 11 (the nine questions by group and title, the five readings, the reviews with their counts, the thirteen calls, the fifteen later choices, and what the panel waits for), by R1 to R4; and the tables of old numbers, where rows that point to a removed question, reading or call now point to where it went, with one line on version 10's letters and the change log's table "Where version 10's ten questions went". Keep the record's wrapping at 72 characters. Add no line saying version 11 is published: the agent running the pass adds that after it publishes. Write your log to ${V9}/apply-log-v11-record.md. Done when every item of the merged report that lands in the record is applied or listed with a reason.`,
  },
  {
    key: 'builder',
    task: `Your task: ${REPORT}/build_site.py and ${REPORT}/site_smoke.js, and only those files. Make the builder render the contract: "neededBy" on a line under each question's title, with the tag "When to answer"; "waitsFor" as a box before "Open now" (anchor "waits-for"), listed first under "On this page"; "answerSheet" as a section at the end of "Open now", headed "Your answers, in one place" (anchor "answers"), listed under "On this page", each line its label in bold then its form; a group with no questions (its intro still renders, and the page's links to it work); "today" on Requirements under the tag "Today", after the item's other fields; "lettersV10" on the change log as "Where version 10's ten questions went" (anchor "letters-v10"), before the version 9 table, plain text, with its own check (ten rows, letters A to J). Write READINGS_LEAD, CALLS_LEAD and REVIEW_LEAD as (b) and (e) item 5 give them. Set STATUS_LINE's date to ${DATE}. Derive every count from the data (the navigation count, the readings, the calls, the targets, the cases); write none as a fixed number. Add checks: every [[page:decisions#q-x|label]] link's label equals the title of question x; no [[call:]] or [[q:]] marker points to a removed call or letter; each question has "neededBy"; the answer sheet has a line for every question. Update the builder's own texts that name a removed question or call or a moved anchor: STANDALONE_P1's link to the standalone question (now #q-h, labelled with its title), the comparison table's video-token cell and any set-aside row or note that named the deleted call (point them to the proposed rows in the standalone group's introduction), and any text that says ten questions or three readings. In site_smoke.js, follow the new anchors ("waits-for", "answers", "letters-v10") as it follows the others, keeping 24 loads. A first attempt at this task was stopped by a container restart, and build_site.py was restored to its committed version, so start from that file. The four other writers have finished: their logs are ${V9}/apply-log-v11-decisions.md, -requirements.md, -design.md and -record.md, and the data files now carry the new fields. Test your code by building a scratch copy of the report folder in the scratchpad from the real data; leave the real build to the integration step. Write your log to ${V9}/apply-log-v11-builder.md, with "For other files" if any. Done when every rendering and check above is written and tested on the copy.`,
  },
]

phase('Write')
const written = await parallel(WRITERS.map((w) => () =>
  agent(`${COMMON}\n\n${w.task}`, opts(`write:${w.key}`, 'Write', WRITE_SUMMARY))))
const writeOk = WRITERS.map((w, i) => ({ key: w.key, ok: Boolean(written[i]), result: written[i] }))
const failedWriters = writeOk.filter((w) => !w.ok).map((w) => w.key)
if (failedWriters.length) {
  log(`Writers that returned nothing: ${failedWriters.join(', ')}. Stopping before the build.`)
  return { stage: 'write', writeOk }
}

phase('Integrate')
const integrated = await agent(`${COMMON}\n\nYour task: put version 11 together and build it. The five writers have finished. Their logs: ${V9}/apply-log-v11-decisions.md, -requirements.md, -design.md, -record.md and -builder.md. First apply every item under "For other files" in the five logs to its file, faithfully. Make design.json's later choices identical to decisions.json's "later" (R8). Then build: cd ${REPORT} && MERMAID_JS=${MERMAID} python3 -I build_site.py. Fix every failure at its source, the data or the builder, keeping to the merged report and the rulings; never loosen a check to pass it. Then smoke: cd ${REPORT} && node site_smoke.js site ${SHOTS}. It must pass 24 loads. Look at the Decisions page at 400 pixels wide in light and dark, from the smoke test's screenshots and element screenshots you take of the waits-for box, question B, the answer sheet, the readings and the calls: nothing overflows and every tag sits on its text's line. Check that the front page is under 2,625 words in sentences (the build prints the count) and that every count agrees across the pages and the record (R4). Then write the pages as text for the checkers: mkdir -p ${TEXT11} && cd ${SITE} && python3 -I ${H2T} ${TEXT11} index.html decisions.html requirements.html design.html today.html changes.html. Write ${V9}/build-log-v11.md: what you applied for other files, every failure and its fix, the build and smoke results, the counts, and anything left for the agent running the pass. Return whether the build and the smoke test passed.`,
  opts('integrate', 'Integrate', {
    type: 'object',
    properties: {
      log: { type: 'string' },
      buildPassed: { type: 'boolean' },
      smokePassed: { type: 'boolean' },
      frontWords: { type: 'integer' },
      notes: { type: 'array', items: { type: 'string' } },
    },
    required: ['log', 'buildPassed', 'smokePassed', 'frontWords', 'notes'],
  }))
if (!integrated || !integrated.buildPassed || !integrated.smokePassed) {
  log('The integration build or smoke test did not pass; stopping before the checks.')
  return { stage: 'integrate', writeOk, integrated }
}

const CHECK_COMMON = `${COMMON}\n\nYour task is to check version 11 as it is now built, refute by default: a part is right only when you have read it where it lands and found nothing wrong. Read only, and write only your report. The pages as text: ${TEXT11}/*.md (links as [text](href), ids as {#id}); the built pages ${SITE}/*.html; version 10 as text: ${SCRATCH}/v10text/*.md; what changed: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass (read the pages, not the built .html in the diff). The writers' logs and the build log are in ${V9} (apply-log-v11-*.md, build-log-v11.md). Write a markdown report: a one-paragraph scope; a table of conflicts (page, the exact words, why it is wrong, the exact replacement, the exact place to change: file and field); then "What is right". Return a brief summary.`
const CHECKS_LIST = [
  { key: 'decisions', task: `Your lens: the Decisions page whole, read as the owner reads it before answering, and the front page's lines about the questions. For each of the nine questions, the waits-for block, the answer sheet, each of the five readings and each of the thirteen calls: is it now clearly defined and answerable; does it say exactly what the owner must give, and when; is each fact true in the code; did every change in the merged report's (a) and (b) land as the report and the rulings say; is anything new wrong (a rule break, a count, a link that lands on the wrong question or is labelled with another title, an owner's quote changed, a reading shown as settled or a call shown as the owner's)? Write ${CHECKS}/v11-check-decisions.md.` },
  { key: 'requirements', task: `Your lens: Requirements and Today's engine. Did (c) items 4 to 7 and 9 to 12, d8, d11, d12, R5 and R6 land as the merged report and the rulings say; is every moved "today" sentence true in the code and every field it left still whole; are QT45 to QT48 sound, testable and placed under the right quality; do the counts, the sorted numbers and the links to Decisions hold; does Today's engine still say nothing that the changes made stale (the cards, the standalone section and its comparison table)? Write ${CHECKS}/v11-check-requirements.md.` },
  { key: 'design', task: `Your lens: Design, the panel's brief, the front page and the change log. Did d1 to d9 and d14, R6's line in the brief, R7, (c) items 9, 12 and 13, and the brief's changes from a8, a11 and (b) land as the merged report and the rulings say; do Design and the brief agree with each other and with Decisions; is the front page true, plain and under its word limit; is the version 11 entry of the change log true and free of model names; is each row of "Where version 10's ten questions went" right against version 10's titles (version 10's Decisions page: git -C ${ROOT} show ${BASE}:docs/plans/architecture-pass/report/site/decisions.html)? Write ${CHECKS}/v11-check-design.md.` },
  { key: 'record', task: `Your lens: the decision record, ${AP}/DECISIONS.md, against the site and the merged report. Read its diff from ${BASE} in full, then each changed entry whole. Do the record and the pages say the same thing in their own words (decisions.json's "decided", "readings", "calls", "later" and "groups"; Design); does "Still open" match version 11 exactly; are the owner's quoted words untouched; is every reading still marked to be confirmed and every call marked as the agent's; is anything inferred written as if the owner said it; do the tables of old numbers point where each question went? Write ${CHECKS}/v11-check-record.md.` },
]
const CHECK_SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    conflicts: { type: 'integer' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'conflicts', 'keyPoints'],
}
phase('Check')
const checks = await parallel(CHECKS_LIST.map((c) => () =>
  agent(`${CHECK_COMMON}\n\n${c.task}`, opts(`check:${c.key}`, 'Check', CHECK_SUMMARY))))

phase('Apply')
const checkFiles = CHECKS_LIST.map((c) => `${CHECKS}/v11-check-${c.key}.md`).join(', ')
const applied = await agent(`${COMMON}\n\nYour task: apply every conflict in the four checks of version 11: ${checkFiles}. You may edit every file named above, the record included. Read each row against its source before you change anything. Rulings: a question stays a question and a call stays a call unless the row shows by the four tests that it is otherwise (list such rows for the agent running the pass instead of applying them); never cut an explanation of what something means at a show; keep the owner's words exactly; keep the record's rules (nothing inferred as the owner's; a dated history line for each change; wrapping at 72). Then rebuild (cd ${REPORT} && MERMAID_JS=${MERMAID} python3 -I build_site.py) and smoke-test (node site_smoke.js site ${SHOTS}); both must pass. Refresh the text copies: cd ${SITE} && python3 -I ${H2T} ${TEXT11} index.html decisions.html requirements.html design.html today.html changes.html. Write ${CHECKS}/v11-apply-log.md: each row, applied or not and why, and a list "For the agent running the pass". Return the counts.`,
  opts('apply', 'Apply', {
    type: 'object',
    properties: {
      log: { type: 'string' },
      applied: { type: 'integer' },
      rejected: { type: 'integer' },
      forLead: { type: 'array', items: { type: 'string' } },
      buildPassed: { type: 'boolean' },
      smokePassed: { type: 'boolean' },
    },
    required: ['log', 'applied', 'rejected', 'forLead', 'buildPassed', 'smokePassed'],
  }))

phase('Verify')
const verified = await agent(`${CHECK_COMMON}\n\nYour lens: the apply round. Read ${CHECKS}/v11-apply-log.md and each row of the four checks (${checkFiles}) where it lands on the rebuilt pages, and give each row a verdict: resolved, partly or unresolved. Then read every line the apply round changed and list any new conflict it made (a slip), with the exact fix and place. Write ${CHECKS}/v11-verify.md.`,
  opts('verify', 'Verify', {
    type: 'object',
    properties: {
      file: { type: 'string' },
      resolved: { type: 'integer' },
      partly: { type: 'integer' },
      unresolved: { type: 'integer' },
      slips: { type: 'integer' },
      keyPoints: { type: 'array', items: { type: 'string' } },
    },
    required: ['file', 'resolved', 'partly', 'unresolved', 'slips', 'keyPoints'],
  }))

return { writeOk, integrated, checks, applied, verified }
