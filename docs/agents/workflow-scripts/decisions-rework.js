export const meta = {
  name: 'decisions-rework',
  description: "Rework the owner site's Decisions page around the owner's real decisions (the owner's ruling of 2026-11-02): three independent readers, one writer, two refute-by-default checks, one corrector",
  phases: [
    { title: 'Read', detail: 'the owner-only questions, drafted blind; the sorting of version 9\'s eighteen; what the 2026-11-02 decisions change' },
    { title: 'Write', detail: 'one writer reworks the overlays, the requirements and the panel brief' },
    { title: 'Check', detail: 'two refute-by-default checkers' },
    { title: 'Apply', detail: 'one corrector applies both checks' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const OUT = SITE + '/v9'
const REQ = AP + '/requirements'
const RW = AP + '/rework'
const REC = AP + '/DECISIONS.md'
const COMMENTS = RW + '/2026-11-02-owner-comments.md'
const JT = SITE + '/checks/jargon-table.md'
const ROADMAP = ROOT + '/docs/plans/ROADMAP.md'
const BRIEF = AP + '/panel/2026-11-01-panel-brief.md'
const PLAN2 = SITE + '/2026-11-01-site-plan-v2.md'

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) is redesigning the engine for the long term, top-down. Their goal, in their words: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)". The end state is an open-source show platform that other productions adopt. Their site "What the Engine Promises", version 9, is six pages built into ${SITE}/ by ${RP}/build_site.py from overlays in ${OUT} (front.json, decisions.json, design.json, changes.json, rules.json), the requirements (${REQ}/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json) and the page data in ${RP}. The decision record ${REC} holds every decision by title and topic; read it whole, including the six entries of 2026-11-02. On 2026-11-02 the owner asked whether all eighteen questions on the Decisions page were really theirs, and whether they were the questions the top-down frame needs; the agent running the pass said no to both, and the owner said to rework the page, after commenting on seven questions the agent proposed instead. Those comments, word for word, are in ${COMMENTS}: read them closely, they are the primary source for this work.

The rules: plain, short, active sentences; no metaphors; no em dashes; the jargon table's wordings (${JT}); decisions by their titles in the record, as [[dec:<slug>]] markers where a page links them (the slug is the title in lower case, every run of non-letters one hyphen, trimmed); promises, quality targets, extension cases and flaws by marker ([[promise:J3]], [[qt:QT3]], [[ex:EX5]], [[flaw:C9]]); no visible ids; question letters only on the Decisions page; no numbered lists of decisions or choices; the owner is "you" in the site's own prose, while the shared texts the panel also reads (the requirements' situation, case, numberToSet and why fields, the standing rules, the promise data, the cards, the earlier candidate) keep "the owner" as a role; "the agent running the pass", never "orchestrator"; nothing inferred from the owner's words is written as if the owner had said it.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Write only the files your task names.`

const R1 = `Your task: find the questions only the owner can answer that the engine's top-level design needs answered now, before the independent panel proposes designs. Work from the owner's goal and comments, the decision record, the roadmap ${ROADMAP} (sections 1, 2 and 7), the requirements (the promises in ${RP}/2026-10-31-engine-jobs.json; the quality targets; the extension cases; the standing rules ${OUT}/rules.json) and the six decisions ahead in ${OUT}/design.json ("ahead": the agenda of the design rounds). Draft independently: do not open ${OUT}/decisions.json or the built decisions.html. The seven questions the agent proposed are in the comments file only as context for the owner's replies; the owner found two of them confused (the standalone one and the extension one), so treat them as neither complete nor right.

A question belongs on your list only if all four hold, and you write down the evidence for each:
1. Only the owner can answer it: it is about what the product must do or allow, for whom, or which of two goods matters more; never about how to build it.
2. The record does not already answer it: cite the entry that leaves it open, or say no entry covers it.
3. At least one of the six decisions ahead depends on the answer: name which, and say how the answer changes the design.
4. It is needed before the panel's blind round or the first design round, not later.

For each question: a plain title; what it decides; what it means in practice, through concrete situations (at a show, for the GM at a failure, for the designer, for someone adopting the engine for a different production, venue and hardware); the options, and what each means in practice and for the build, now and in the years after the new engine runs ALN; which decision ahead depends on it; the sources.

Two of the owner's comments ask for an explanation before they can answer. Give each its own section:
- Where the qualities pull against each other. Find the specific conflicts between the qualities (the twelve groups of the quality targets) that the top-level design of this engine will actually face, each explained by what happens: at a show, for the designer, for the people maintaining the engine, for an adopter. Mark the conflicts the owner's decisions already settle, and which way. The open ones become questions.
- Release day. What "everything updates together" against "older versions keep working with a newer engine" means in practice today (the GM tablets' app and the phones' page are served by the engine; the hardware scanners update only by cable; packs are published separately) and in the long term, once the new engine runs ALN and other productions adopt it; how the answer changes the published protocol's design and the build; the options with their costs.

Also cover what the 2026-11-02 decisions raise: from "No technical failure stops a game", for example how a networked game carries on when the show machine itself fails mid-game, and how that meets "Standalone games: declared, never mixed"; from the standalone purpose, which shapes of standalone game the engine must support (GM scanners alone, player scanners alone, both; one or several GM tablets; with or without any network between devices); from the hardware decision and "The engine says what is fixed and what each production sets", what the owner must say now and what the design rounds should propose for the owner to decide.

Write ${RW}/owner-questions.md: the questions; the two explanation sections; then every question you considered and dropped, with the test it failed. Done when: every question passes the four tests with its evidence written, both explanation sections are complete, and the dropped list is written.`

const R2 = `Your task: sort the eighteen questions on version 9's Decisions page (${OUT}/decisions.json "groups"; the built ${SITE}/decisions.html) under the owner's ruling "The Decisions page holds only your decisions" (in the record). For each question, one of:
- answered: the owner's decisions, including those of 2026-11-02, already answer it (cite the words);
- the owner's: only the owner can decide it, and it is still open;
- the agent's call: the agent should make it and tell the owner, because it is about wording, grouping, method, a technical default, or a reading that follows from an owner decision. Give the call (the question's own recommendation, unless the 2026-11-02 decisions change it) and a one- or two-sentence reason a non-engineer can follow;
- a review: the owner reads and flags what is wrong or missing; no decision is asked.
Then sort each of the fourteen numbers the quality targets leave to set (their numberToSet fields), under "The engine says what is fixed and what each production sets": an engine requirement or a limit the engine states; a production's own setting (ALN's being the first); or a technical default the agent proposes. Then list every reading in the record marked "to be confirmed" and say whether it is a product reading the owner should confirm (it changes what the product does or allows) or a bookkeeping reading that follows from the owner's later decisions (the agent's call). Write ${RW}/sorting.md: three tables, each row with its reason and source. Done when: every question, number and reading is sorted, each with its reason and source.`

const R3 = `Your task: list everything the owner's 2026-11-02 decisions change in the site's sources and in the panel's brief, each with its exact place and a proposed text. The decisions, in the record: "No technical failure stops a game"; "Standalone games: declared, never mixed", with its purpose; "The engine is hardware-flexible; the roadmap sets the bounds"; "Two kinds of game extension"; "The engine says what is fixed and what each production sets". Check, at least:
- the quality targets: the disconnected tablet in "A tablet reconnects to the same facts"; any target a failure must not stop the game touches; the standalone targets; each target whose number is one production's setting; whether a new target is needed so that the GMs know their fallbacks at a failure, written as a testable situation that names no design;
- the extension cases: cases for the two kinds of extension, using the owner's two examples; a case for someone adopting the engine for a different production, venue and hardware, who must find what is fixed and what they can set; a case for different hardware; any case the decisions contradict;
- the promises' data (${RP}/2026-10-31-engine-jobs.json), where a promise's words now conflict;
- the standing rules (${OUT}/rules.json): they come from the roadmap, so none change unless the roadmap did; say so;
- the Design page (${OUT}/design.json): each decision ahead's "settled" line; the later choices, including how an extension for all games relates to the engine's main release; the panel section: the setting (ALN's kit as the first production's hardware, the engine meant to be hardware-flexible), the decisions that bind any design, the lenses;
- the front page (${OUT}/front.json): what you can do now; decided lately; the words box, which needs plain words for a fixed requirement and for what the engine lets a production change; any line the decisions contradict;
- the panel's brief ${BRIEF}.
Write ${RW}/impact.md: one row per change (file, field or item, what it says now, what it should say, the decision behind it). Done when: every file and field the five decisions touch is listed with a proposed text.`

const WRITE = `Your task: write the reworked content from the three reports (${RW}/owner-questions.md, ${RW}/sorting.md, ${RW}/impact.md), the decision record and the owner's comments.

1. ${OUT}/decisions.json, in a new shape (the builder will be changed to render it; keep the keys designRounds, later and decided as they are shaped now):
- intro: what the page asks and how to answer; that it now asks only what is yours to decide; where the agent's calls and the reviews are.
- groups: the owner's questions from owner-questions.md (only those that pass its tests), grouped by topic in plain words, each group with an optional "intro". Letters A, B, C and on, in page order. Each question in version 9's shape (letter, anchor q-<letter>, title, status "open", decides, evidence, options with what each means in practice and its cost, recommendation, recKind). Give a recommendation only where the agent has a sound one; where the answer is the owner's values call, set recKind to "What we need from you" and write one plain line. "Where the qualities pull against each other" becomes one question per open conflict, each explained by what happens; the conflicts the owner has already settled go in that group's intro. "Release day" becomes one explained question. Keep "What the panel gets in its blind round" (it amends the owner's own decision), updated so the binding decisions include those of 2026-11-02.
- readings: [{text, source}]: the product readings of the owner's words that the owner should confirm (from sorting.md and the 2026-11-02 entries), one sentence each, the source a [[dec:]] marker.
- calls: [{title, call, why}]: every call that is the agent's (version 9's questions sorted as the agent's, the bookkeeping readings, the technical defaults), each with a short plain title, the call, and why in one or two sentences a non-engineer can follow; markers where they help.
- review: [{title, what, link}]: what the owner may read and flag (the promises, the quality targets, the extension cases, the standing rules), one line each, the link a [[page:requirements#...]] marker.
- decided: every standing decision in the record, by its topics, with the 2026-11-02 entries added or updated (title, date, one plain line); slugs by the slug rule.
- designRounds and later: as now, updated for the new decisions (for example a later choice on how an extension made for all games relates to the engine's main release).
2. The requirements: apply impact.md's rows to the two requirements files, and add a "numberKind" field right after "numberToSet" in every target that has a number ("engine" for an engine requirement or a limit the engine states, "production" for a production's own setting, "default" for a technical default the agent proposes), with numberToSet worded to match. New targets or cases go at the end of their list with the next free id, a unique title, the same fields as the others (and statusKind), and promises fields naming promises by their exact titles. Edit in place; keep each file's layout.
3. ${OUT}/design.json: apply impact.md's rows (the decisions ahead's settled lines, the later choices, the panel section, whose question markers must point to the new letters or, where a question became the agent's call, to the call in plain words).
4. ${OUT}/front.json: apply impact.md's rows (what you can do now, decided lately, the words, any line the decisions change).
5. ${OUT}/changes.json: add version 10 (2026-11-02) first: what changed and why, quoting the owner's question and comments where it helps; and a table mapping every version 9 letter to where its question went (a new letter, an agent's call, a review, or answered by which decision).
6. The panel's brief ${BRIEF}: apply impact.md's rows; keep it in step with the Design page's panel section.
Write ${RW}/write-log.md: each change and its source. Done when: every report row is applied or listed as not applied with a reason, every JSON file parses and keeps its layout, and the log is complete.`

const C1 = `Check the reworked ${OUT}/decisions.json, ${OUT}/front.json and ${OUT}/changes.json against the record, the owner's comments, the three reports in ${RW} and the rules. Refute by default:
- an owner question that fails one of owner-questions.md's four tests (it is not only the owner's; the record already answers it; no decision ahead depends on it; it can wait);
- a question not explained in practice, or options that misstate what they mean or cost;
- a recommendation where the answer is the owner's values call;
- a call that is really the owner's, or whose reason is unsound or not plain;
- a reading that misstates the owner's words, or an inference written as the owner's;
- a version 9 question missing from the mapping, or mapped wrongly;
- an owner quote that is not word for word;
- jargon, ids, metaphors or em dashes; a marker whose letter, slug, id or page does not exist.
Write ${RW}/check-decisions.md: the conflicts table (where, what it says, what it should say, the source), then what you checked and found right.`

const C2 = `Check the reworked requirements (${REQ}/2026-11-01-quality-targets.json, 2026-11-01-extension-cases.json; git -C ${ROOT} diff -- docs/plans/architecture-pass/requirements shows the changes), ${OUT}/design.json and the panel's brief ${BRIEF} against the record, the owner's comments, ${RW}/impact.md and the rules. Refute by default:
- a change that misstates the decision behind it;
- a requirement that names a design (how to build) rather than what is needed;
- a numberKind wrong for its number, or a numberToSet that no longer matches it;
- a new target that is not a testable situation, or a new case not in the cases' shape;
- a promises field naming no promise's exact title;
- a decision ahead's settled line that misstates the record, or a later choice that is now a top-level decision;
- the Design page's panel section and the brief out of step, or a 2026-11-02 decision missing from what binds any design;
- jargon, ids, metaphors or em dashes; a broken layout or invalid JSON.
Write ${RW}/check-requirements-design.md: the conflicts table (where, what it says, what it should say, the source), then what you checked and found right.`

const RS = { type: 'object', properties: { file: { type: 'string' }, items: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'items', 'keyPoints'] }
const WS = { type: 'object', properties: { log: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, notApplied: { type: 'array', items: { type: 'string' } }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['log', 'changed', 'notApplied', 'keyPoints'] }
const CS = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const AS = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'notes'] }

phase('Read')
const reads = await parallel([
  () => agent(`${COMMON}\n\n${R1}\n\nReturn the file, how many questions you kept, and five key points.`, { label: 'read:owner-questions', phase: 'Read', model: 'fable', effort: 'xhigh', schema: RS }),
  () => agent(`${COMMON}\n\n${R2}\n\nReturn the file, how many items you sorted, and five key points.`, { label: 'read:sorting', phase: 'Read', model: 'opus', effort: 'high', schema: RS }),
  () => agent(`${COMMON}\n\n${R3}\n\nReturn the file, how many changes you listed, and five key points.`, { label: 'read:impact', phase: 'Read', model: 'fable', effort: 'high', schema: RS }),
])
log('read: ' + reads.map(r => r ? `${r.file.split('/').pop()} ${r.items}` : 'missing').join('; '))
if (reads.some(r => !r)) return { reads, error: 'a reader returned nothing' }

phase('Write')
const written = await agent(`${COMMON}\n\n${WRITE}\n\nReturn the log, the files you changed, anything not applied with its reason, and five key points.`, { label: 'write:rework', phase: 'Write', model: 'fable', effort: 'high', schema: WS })
if (!written) return { reads, error: 'the writer returned nothing' }

phase('Check')
const checks = (await parallel([
  () => agent(`${COMMON}\n\n${C1}\n\nReturn the file, the number of conflicts, how many items you checked, and five key points.\n\nDone when: every question, reading, call, review line and mapping row has been read against its sources.`, { label: 'check:decisions', phase: 'Check', model: 'opus', effort: 'high', schema: CS }),
  () => agent(`${COMMON}\n\n${C2}\n\nReturn the file, the number of conflicts, how many items you checked, and five key points.\n\nDone when: every changed requirement, design line and brief passage has been read against its sources.`, { label: 'check:requirements-design', phase: 'Check', model: 'opus', effort: 'high', schema: CS }),
])).filter(Boolean)
log('checks: ' + checks.map(c => `${c.file.split('/').pop()} ${c.conflicts} of ${c.checked}`).join('; '))

phase('Apply')
const total = checks.reduce((n, c) => n + c.conflicts, 0)
const applied = total === 0 ? null : await agent(`${COMMON}\n\nYour task: apply the checks ${checks.map(c => c.file).join(' and ')} to the files they name (the overlays in ${OUT}, the two requirements files, the panel's brief). Verify each conflict against its source first; apply it, or reject it with a reason. Keep every JSON valid and its layout (edit in place). Record each row in ${RW}/apply-log.md (check, row, applied or rejected, the change or the reason). Return the log, how many you applied and rejected, and a note per rejection.\n\nDone when: every row of both checks is applied or rejected with a reason.`, { label: 'apply:rework', phase: 'Apply', model: 'fable', effort: 'high', schema: AS })
return { reads, written, checks, applied }
