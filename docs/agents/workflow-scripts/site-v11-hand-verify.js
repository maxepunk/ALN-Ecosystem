export const meta = {
  name: 'site-v11-hand-verify',
  description: 'Two refute-by-default readers verify the lead agent\'s hand fixes after the version 11 workflow: one reads the rebuilt pages, one reads the record, the brief and the data files',
  phases: [
    { title: 'Verify', detail: 'the pages; the record, the brief and the data' },
  ],
}

// args: { base: the commit holding the workflow's output before the hand fixes, text: the folder of the pages as text, model: optional model for both readers }
const A = args || {}
const BASE = A.base || '5b52aacd'
const TEXT = A.text
const MODEL = A.model
const ROOT = '/home/user/ALN-Ecosystem'
const AP = `${ROOT}/docs/plans/architecture-pass`
const OUT = `${AP}/report/site/checks`
const opts = (label) => ({ label, phase: 'Verify', schema: SUMMARY, effort: 'high', ...(MODEL ? { model: MODEL } : {}) })

const COMMON = `
You are checking the owner site "What the Engine Promises" (the architecture pass of the ALN engine) after the agent running the pass made hand fixes on top of the version 11 workflow's output. Version 11 applies an independent review of version 10 that the owner asked for before answering the Decisions page. Refute by default: a fix counts as resolved only when you have read it where it lands and found nothing wrong. Read only; do not edit any file except the one report you are asked to write.

Where things are (all under ${AP}):
- The built pages: report/site/index.html, decisions.html, requirements.html, design.html, today.html, changes.html, built by report/build_site.py from the overlays in report/site/v9/ (front.json, decisions.json, design.json, changes.json), the requirements in requirements/, the promise data report/2026-10-31-engine-jobs.json, the standalone lines report/2026-10-31-standalone-lines.json, the cards report/2026-10-31-cause-cards.json and the earlier candidate report/2026-11-01-engine-shape.json. The pages are current: they were rebuilt after the hand fixes, the build's checks passed (1,777 links resolve) and the smoke test passed. The same pages as text are in ${TEXT} (index.md, decisions.md, requirements.md, design.md, today.md, changes.md); use them to search, and the .html to confirm.
- What the hand fixes were meant to fix: report/site/checks/v11-verify.md, the table "Conflicts" (sixteen rows), and report/site/checks/v11-apply-log.md (its items for the lead). Beyond those rows the lead made two wording sweeps: (1) where a standalone tablet kept "an engine of its own" (or "its own engine", or "an engine kept equal by tests"), the text now says "code of its own"; (2) where a test ran "on an engine of its own" (or "of their own", or "its own engine"), it now runs on "its own copy of the engine". Both follow the front page's word list entry "The engine": all the software that is the same for every game, and a standalone game still runs it on its devices (${ROOT}/CONTEXT.md, section 0, defines the engine the same way). The change log's word list records both.
- The hand fixes are the git diff from commit ${BASE} to HEAD: run \`git -C ${ROOT} diff ${BASE} HEAD -- docs/plans/architecture-pass\` (ignore the built .html files in that diff; read the pages themselves instead).
- The owner's comments of 2026-11-02, word for word: rework/2026-11-02-owner-comments.md.

The site's standing rules, which every changed line must keep:
- Plain, short, active sentences; no metaphors or figures of speech; no em dashes; no internal codes or code names (the two show machines are "the show machine in use now" and "the new show machine"). No model name, model id or vendor name anywhere.
- On the site a title dropped into a sentence takes typographic quotes “ ” and is the exact title; the decision record writes titles in straight quotes.
- The overlays and the builder's own texts say "you" to the owner; the shared data (promise data, cases, cards, standalone lines, the earlier candidate) says "the owner". The record calls the owner "the owner" and the lead agent "the agent running the pass".
- No question letters off the Decisions page, except as history on the change log.
- The owner's words are quoted exactly. Nothing inferred is written as if the owner said it. A reading of the owner's words is marked as a reading; an agent's call is marked as the agent's call. The Decisions page holds nine questions (A to I), five readings and thirteen calls; the requirements hold 47 quality targets (22 settled, 19 partly settled, 6 proposed) and 28 extension cases. The front page's prose stays under 2,625 words.
- History stays history: the change log's entries for older versions, and the record's dated lines and tables of old numbers, keep the words of their time.

Do not read the top-level clones /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner; read code only inside ${ROOT}. Never open ${ROOT}/backend/.env.

Write a report in plain markdown with: a one-paragraph scope; a verdict table (row or item, Resolved / Partly / Unresolved, where it lands now, with page or file and the words); a table of every new conflict the hand fixes introduced or left (page or file, the exact words, why it is wrong, exact replacement, exact place to change); and a short "what I found right" list. Then return a brief summary: counts and the most important points.
`

const PAGES = `${COMMON}
Your part: the pages.
1. For each of the sixteen rows of the "Conflicts" table in v11-verify.md that lands on a page (rows 1, 2, 3, 6, 7, 8, 9, 10, 11, 13, 14 and 15; for row 1 the earlier candidate on Design, folded, and the change log's word list that promises it), read the rebuilt page where it lands and give a verdict. Check that each changed sentence reads whole in its place and agrees with the other pages.
2. The two sweeps. Search every page (case-insensitive) for "engine of its own", "engine of their own", "its own engine", "engine kept equal", "no engine" and "with no engine". Each remaining hit must be history (an older version's entry on the change log, an old title in a table of where things went), a different meaning (for example "no engine change"), or listed as a conflict. Read each swept sentence in its place: the thirteen standalone lines on Today's engine (the line "In a standalone game" on each card); Design's fifth decision and the later choice "The standalone tablet" on Design and on Decisions (the two copies must be identical); the earlier candidate on Design (its qualities, its parts, its drawing's labels, the comparison of where parts would run and its row on the tests); the cards' text and drawings on Today's engine that speak of the tests. Check that "code of its own" and "its own copy of the engine" say what the old words meant, and that "The tablet runs the engine either way" in the change log's word list is true under the word list's entry "The engine".
3. The change log's version 11 entry: the two added sentences on the promises (check each claim against the promise data, the ninth and tenth promises, and against Requirements, where the same promises show), the reworded sentence on the tablet's clock, and the sentence on a spare show machine (check the claim that the TV, the sound and the lights come back only if a GM moves them to it or the kit connects them to both against the code: ${ROOT}/backend/src/services/displayControlService.js and the services that drive sound and lights, and against question B on Decisions, which says the same).
4. The front page's word list entry "The engine": the question's title in quotes must be the exact title on Decisions.
5. Note anything else wrong you meet on the way, marked as outside the hand fixes.
Write your report to ${OUT}/v11-hand-verify-pages.md.`

const RECORD = `${COMMON}
Your part: the decision record ${AP}/DECISIONS.md, the panel's brief ${AP}/panel/2026-11-01-panel-brief.md, and the data files the hand fixes touched.
1. The record: read its diff from ${BASE} in full, then each changed entry whole. Rows 10, 11, 12 and 13 of v11-verify.md land here, and the sweep changed two lines on the tests. Check that the line on what the blind round's folder holds of each promise says the same as the brief and as Design (design.json, panel.sections[1].items[1].text and panel.sections[4].paragraphs[1]), that it no longer counts the choice as one of the agent's calls and that this agrees with "Still open" (which lists thirteen calls by title, the same as decisions.json "calls"), and that the line on the tablet's clock is true against version 10's Decisions page (\`git -C ${ROOT} show 9f7f8a31:docs/plans/architecture-pass/report/site/decisions.html\`, the question "What a standalone game gives up, and what it keeps"). Check the record's wrapping at 72 characters and that no quoted words of the owner changed.
2. The brief: read its diff from ${BASE}; rows 5, 10 and 11 land here. Unwrap each changed paragraph and compare it with the paragraph before the fix: only the intended words may differ. Check the seventh decision's paragraph against question I on Decisions (decisions.json, the question "What the panel gets in its blind round", its evidence on the seventh decision) and against Design's introduction and first decision: all three must say the same about where the room's state sits and what a yes and a no do. Check that no line is over 72 characters.
3. What the blind folder holds of a promise. The brief, Design and the record now say: of each promise the folder holds who counts on it and when, what they count on and the long-term goal; the targets and cases that serve a promise name it themselves; the rest under a promise (where today's engine falls short, the line "In a standalone game", what the planned capabilities need from it, the test situations from the shows) waits for the second round. Read report/2026-10-31-engine-jobs.json and build_site.py's drawing of a promise on Requirements, and list every field of a promise that the Requirements page shows. Say whether each is covered by that sentence (held, or waiting), and list any shown field that is neither, with a wording that covers it.
4. The data files: report/2026-11-01-engine-shape.json (every changed string; "no show machine" where it means a game with no show machine; "code of its own"; "its own copy of the engine"; the one-kit rule with its bound "where avoiding it costs little" as the requirements word it), and its twin ${AP}/2026-11-01-engine-shape.md (the new dated vocabulary note: is it true, does it follow the earlier note's form, does it cover every old wording left in the twin's body); report/2026-10-31-engine-jobs.json and its twin ${AP}/2026-10-31-engine-jobs.md (the ninth promise's people now say the TV clock "must show when it is unconfirmed": does that agree with the promise's need and fourth test and with the twin's note of 2026-11-10); report/2026-10-31-standalone-lines.json (all thirteen swept lines read whole); report/2026-10-31-cause-cards.json (the test line and the drawing's label on the program watcher); report/build_site.py (the row on the standalone tablet and the row and label on the tests).
5. List anything still stale in the record or the brief against the site that the hand fixes missed (search for "engine of its own", "its own engine", "no engine", "holds the line", "the other lists", "none of the six decides"), marked as outside the hand fixes.
Write your report to ${OUT}/v11-hand-verify-record.md.`

const SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    resolved: { type: 'integer' },
    partly: { type: 'integer' },
    unresolved: { type: 'integer' },
    newConflicts: { type: 'integer' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'],
}

phase('Verify')
const [pages, record] = await parallel([
  () => agent(PAGES, opts('verify:pages')),
  () => agent(RECORD, opts('verify:record')),
])
return { pages, record }
