export const meta = {
  name: 'site-content',
  description: "Write the owner site's three content overlays (front page, decisions, change log) and the v7 inventory; check each refute-by-default; apply the fixes",
  phases: [
    { title: 'Write', detail: 'three writers (front page, decisions, change log) and one inventory reader' },
    { title: 'Check', detail: 'one refute-by-default checker per output' },
    { title: 'Apply', detail: 'each output corrected from its check' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const PLAN = SITE + '/2026-11-01-site-plan.md'

const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one published page, "What the Engine Promises" (version 7: ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py from the JSON data in ${RP}/). The owner decided (decision 29) that it becomes five linked pages and a change log, and (decision 28) how the after-game article and emailer fit the engine. The plan for the new site is ${PLAN}: read it first and follow it exactly; its section 4 gives the JSON schema and the link markers, its section 6 the rules, its section 7 the sources and the command that prints version 7 as text. Decisions 20 to 29 are in ${ROOT}/docs/plans/CURRENT-STATE.md section 0; the after-game survey with the owner's answers is ${AP}/2026-11-01-after-game-report.md.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Write only the files your task names.

Valid marker ids: promises J1 to J10; parts P1 to P17; flaws C1 to C16 and N1; questions promises, A to G, 22, 24, 25, 19, 21; pages engine, decisions, promises, parts, flaws, changes. Promise and part titles come from ${RP}/2026-10-31-engine-jobs.json (functional.proposedTitle) and ${RP}/2026-11-01-engine-shape.json (parts[].name); the builder fills them, so never type a title where a marker belongs.`

const WRITE_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, log: { type: 'string' }, items: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'log', 'items', 'keyPoints'] }
const CHECK_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const APPLY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['file', 'applied', 'rejected', 'notes'] }

const TASKS = [
  {
    key: 'front', out: SITE + '/front.json', log: SITE + '/front-log.md',
    write: `Your task: write ${SITE}/front.json (plan section 4.1) for the front page and the three page intros, and ${SITE}/front-log.md (each section's sources, sentence by sentence where a sentence is new).

What each field must hold (plan section 3.1):
- lead: two to four sentences. The engine runs shows for any game, not only ALN; the site starts from its ten promises; what the other pages hold; the shape is a candidate.
- whereYouAre: open (the open questions on [[page:decisions]], named by group, with how many), decided lately (decisions 29, 28 and 27, a line each), next (step 2 rebuilds the test rig and proves flaws live, as question 21 sets; step 3 designs rule by rule and each rule's page joins this site).
- moments: built from every promise's functional.people and functional.moment in ${RP}/2026-10-31-engine-jobs.json. One entry per moment a promise names: production stages (Author, Rehearse, Run, Review), points in a show (for example before doors, during play, the end of a game) and release day; add a moment only if a promise names it. Every promise appears at least once; every person any promise names appears at least once; each "why" is one line in that promise's own terms. The night's record moment names the director and the players (decision 28).
- standaloneLine: one or two sentences on decision 22 (a whole game can run with no engine, declared by the game, never mixed), linking [[page:flaws]] for the detail.
- fitSummary: three or four short passages on how the engine fits together, adapted from FIT_SUMMARY in ${RP}/build_report.py and ${AP}/2026-11-01-engine-shape.md: what happens at every tap, the engine's own machinery, what reaches the show from outside, and the night's record after the end. Link parts and promises with markers. Do not restate which parts keep which promise one by one: the Promises page holds that table.
- around: what sits outside the engine and how each connects. Include at least: where the game comes from (Notion, the sync script, the pack files) and the design studio; the venue's own programs the engine drives (video, music, audio and Bluetooth, lighting); the after-game article (ALN's Director Console, a separate program that reads the night's record, with room to run inside the Review stage later), the emailer and the booking list (outside the engine; the game's business; later perhaps the ticketing service), each per decision 28 and ${AP}/2026-11-01-after-game-report.md. status says what is true today and what is decided or candidate.
- aroundMermaid: an optional small flowchart (TD or LR, short labels, at most twelve nodes) of the after-game flow and the outside programs; or an empty string.
- siteGuide: one line for each of the six pages.
- words: every term in v7's words box (the TEMPLATE in ${RP}/build_report.py), meaning kept, the page's own words first (group page) then the design words (group design). Add "Director" if the front page uses it, consistent with ${ROOT}/CONTEXT.md section 5.
- intros.promises (how to read a promise entry, per plan 3.3), intros.parts (a candidate shape, not decided; how to read a part card, per plan 3.4), intros.flaws (how to read a card, per plan 3.5: a moment at a show, why it happens, the Today and Candidate diagrams, the parts that would remove it, the design terms, the standalone line, the examples).

Done when: every field is filled; every marker uses a valid id; every promise is placed in moments; every v7 word is kept; the log names a source for each new sentence.`,
    check: `Check ${SITE}/front.json against the plan, the sources and the rules. Refute by default: anything not supported by a source, any rule broken (plan section 6), any promise missing from moments, any person a promise names missing from moments, any "why" that misstates its promise, any v7 word lost or changed in meaning (TEMPLATE words box in ${RP}/build_report.py), any statement about the after-game article or emailer that departs from decision 28, any invalid marker id, any field that breaks the schema (plan 4.1), any sentence that restates the promise-by-promise mapping the Promises page holds, any sentence that reads as if the candidate shape were decided.`,
  },
  {
    key: 'decisions', out: SITE + '/decisions.json', log: SITE + '/decisions-log.md',
    write: `Your task: write ${SITE}/decisions.json (plan section 4.2) for the Decisions page, and ${SITE}/decisions-log.md (for each question: the v7 text you started from, what you changed and why, and the source of each evidence line).

Start from version 7's questions, word for word: the TEMPLATE in ${RP}/build_report.py from "Your questions" to the footer, plus the shape's questionNotes and ownerChoices in ${RP}/2026-11-01-engine-shape.json. Keep every question, its key (promises, A to G, 22, 24, 25, 19, 21), its group, its status (A, B and C "applied"; E, F and G "changed"; the rest "open"), its meaning, its options and their costs, and the substance of its recommendation or suggestion. Tighten wording only where the rules ask. Where decision 28 touches a question, say so in its evidence: the second half of the promise in question D now names the director and the players; D itself stays open.
- heading: the question as v7 asks it.
- decides: one line on what the answer changes.
- evidence: two to five short lines, each a fact with markers to where the owner reads more (a promise, a part, a flaw, another question). Facts from the promises, the cards, the shape, the standalone pass, the cause analysis. No claim without a source in the log.
- options: each option the question offers, with its cost as v7 states it; an empty list where v7 offers none.
- intro: how to answer (in the chat, by letter or number; each question stands alone).
- step3: v7's "Coming in step 3" items, plus whether paper documents join the pack with "unlocked" recorded during play (decision 28, point 3). Where an item matches a row of the shape's alternatives (${RP}/2026-11-01-engine-shape.json alternatives), end it with a [[page:parts]] marker and note the match in the log.
- decided: decisions 20, 22, 26, 27, 28 and 29, each with its date and one plain line, from ${ROOT}/docs/plans/CURRENT-STATE.md.

Done when: all thirteen question blocks are present with their keys and anchors (plan section 2), every evidence line has a source in the log, every marker is valid, and the step-3 and decided lists are complete.`,
    check: `Check ${SITE}/decisions.json against version 7's questions (the TEMPLATE in ${RP}/build_report.py), the shape's questionNotes and ownerChoices, the sources and the rules. Refute by default: a question missing or with a changed key, group, status or meaning; a recommendation whose substance changed; an option or cost missing or misstated; an evidence line that is false, unsupported by its logged source, or links the wrong thing; anything that departs from decision 28 or presents question D as decided; a step-3 item missing; a decided line that misstates its decision (${ROOT}/docs/plans/CURRENT-STATE.md); an invalid marker; a schema break (plan 4.2); a rule broken (plan section 6).`,
  },
  {
    key: 'changes', out: SITE + '/changes.json', log: SITE + '/changes-log.md',
    write: `Your task: write ${SITE}/changes.json (plan section 4.3) for the Change log page, and ${SITE}/changes-log.md (the source of every item).

- versions: every published version of the owner page, newest first, from version 8 (this site, 2026-11-01: five linked pages and a change log, decision 29; decision 28 folded in) back to the first cause report. Sources: the "The owner's page" entry and section 0 of ${ROOT}/docs/plans/CURRENT-STATE.md, and git -C ${ROOT} log --format='%h %ad %s' --date=short -- docs/plans/architecture-pass/report/ docs/plans/CURRENT-STATE.md. Each: version, date, title, items (what changed), prompt (what the owner said or asked that led to it, where the record has it, in the owner's words if quoted there).
- promises: for each of the ten, earlierTitle = its first wording as a job (the "title" field in ${RP}/2026-10-31-engine-jobs.json, which is v7's "Earlier wording, as a job"), and changes = what changed since: its shapeChange note, its new title (decision 27) and, for J3, decision 28's change to its people, need and goal.
- cards: for each of the sixteen, its shapeChange note from ${RP}/2026-10-31-cause-cards.json; for C9 also that finding X-08 (the two clocks) joined it under decision 28.
- recommendations: E, F and G: the earlier recommendation, the new one, and why the map changed it (v7's question texts say "This replaces the earlier recommendation"; the earlier ones are in git history of ${RP}/build_report.py and in ${AP}/relationships/2026-11-01-job-relationships.md and ${AP}/2026-11-01-engine-shape.md section 5).
- vocabulary: what decision 27 replaced: job to promise, installer to venue technician, numbers to titles, and the other word changes it records.
- intro: one or two sentences.

Done when: every version has a date and items with a source; all ten promises and sixteen cards have entries; E, F and G each have before, after and why; nothing is invented.`,
    check: `Check ${SITE}/changes.json against its sources. Refute by default: a version missing, misdated or misdescribed (CURRENT-STATE.md and the git log); an earlierTitle that is not the promise's "title" field; a card or promise change that misstates its shapeChange note; anything about decisions 27, 28 or 29 that departs from CURRENT-STATE.md; a recommendation before or after that misstates the record; anything invented; a schema break (plan 4.3); a rule broken (plan section 6; "job" is allowed here in history).`,
  },
  {
    key: 'inventory', out: SITE + '/inventory.md', log: SITE + '/inventory.md',
    write: `Your task: write ${SITE}/inventory.md, the guard that nothing from version 7 is lost in the move to the site.

Read version 7 as text (plan section 7 gives the command) and its builder ${RP}/build_report.py (TEMPLATE, FIT_SUMMARY, WALKS, FIT_DEVICES, fit_html, job_html, card_html, part_html, glance_html, parity_html, grid_html, SET_ASIDE). List every element of version 7: every section and box; every table and figure; every diagram; every question and list; and, once per kind, every field a promise entry, a flaw card, a part card and a walkthrough shows. For each element give: what it is; where it sits in version 7; its new home under the plan (file and section), or "change log" (with the changes.json field), or "duplicate: kept at <home>", or "GAP: the plan places it nowhere". Then list what the plan adds that version 7 lacked.

Done when: every heading of version 7 and every field kind appears in the table; every GAP is named; the counts at the top match the table.`,
    check: `Check ${SITE}/inventory.md for completeness and accuracy. Refute by default: any element of version 7 (its text, plan section 7, and ${RP}/build_report.py) missing from the table; any home that does not match the plan (${PLAN}); any element marked duplicate whose kept copy does not hold the same content; any GAP not flagged; any count that does not match.`,
  },
]

const results = await pipeline(
  TASKS,
  (t) => agent(`${COMMON}

${t.write}

Return the file you wrote, its log, how many items you wrote (questions, moments, versions or rows), and five key points.`, { label: 'write:' + t.key, phase: 'Write', model: 'fable', effort: 'high', schema: WRITE_SCHEMA }),
  (w, t) => w ? agent(`${COMMON}

${t.check}

Write ${SITE}/checks/check-${t.key}.md: a short header, a conflicts table (where, what it says, what it should say, the source that shows it), then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.

Done when: every item of ${t.out} has been read against the sources and rules, and the counts match your table.`, { label: 'check:' + t.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA }).then(c => ({ w, c })) : null,
  (wc, t) => {
    if (!wc || !wc.c) return wc
    if (wc.c.conflicts === 0) return { ...wc, a: { file: t.out, applied: 0, rejected: 0, notes: ['no conflicts'] } }
    return agent(`${COMMON}

Your task: apply the check ${wc.c.file} to ${t.out}${t.key === 'inventory' ? '' : ` and record each change in ${t.log}`}. For each conflict, fix the file as the check says, or reject it with a reason when the check is wrong (verify against the source it names before rejecting). Keep everything the check found right. ${t.key === 'inventory' ? '' : 'Keep the JSON valid (python3 -I -m json.tool ' + t.out + ').'}

Return the file, how many conflicts you applied and rejected, and a note for each rejection.

Done when: every row of the check's conflicts table is applied or rejected with a reason.`, { label: 'apply:' + t.key, phase: 'Apply', model: 'fable', effort: 'high', schema: APPLY_SCHEMA }).then(a => ({ ...wc, a }))
  },
)

const out = results.filter(Boolean).map((r, i) => ({ key: TASKS[i] ? TASKS[i].key : '?', write: r.w, check: r.c, apply: r.a }))
log('site content: ' + out.map(o => `${o.key}: ${o.check ? o.check.conflicts : '?'} conflicts, ${o.apply ? o.apply.applied : '?'} applied, ${o.apply ? o.apply.rejected : '?'} rejected`).join('; '))
return out