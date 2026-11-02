export const meta = {
  name: 'site-v10-hand-verify',
  description: 'Two refute-by-default readers verify the lead agent\'s hand fixes after the version 10 workflow: one reads the rebuilt pages, one reads the decision record against the site',
  phases: [
    { title: 'Verify', detail: 'the pages; the decision record' },
  ],
}

// args: { base: the commit holding the workflow's output before the hand fixes }
const BASE = (args && args.base) || '7a6dcf7b'
const ROOT = '/home/user/ALN-Ecosystem'
const AP = `${ROOT}/docs/plans/architecture-pass`
const OUT = `${AP}/report/site/checks`

const COMMON = `
You are checking the owner site "What the Engine Promises" (the architecture pass of the ALN engine) after the agent running the pass made hand fixes on top of the version 10 workflow's output. Refute by default: a fix counts as resolved only when you have read it where it lands and found nothing wrong. Read only; do not edit any file except the one report you are asked to write.

Where things are (all under ${AP}):
- The built pages: report/site/index.html, decisions.html, requirements.html, design.html, today.html, changes.html. They are built by report/build_site.py from the overlays in report/site/v9/ (front.json, decisions.json, design.json, changes.json), the requirements in requirements/, and the promise data and cards in report/. The pages are current: they were rebuilt after the hand fixes.
- The workflow's reports, which say what the hand fixes were meant to fix: report/site/checks/v10-verify.md (the "Slips the apply round made" table, seven rows) and report/site/checks/v10-apply-log.md (the section "For the agent running the pass").
- The owner's comments of 2026-11-02, word for word: rework/2026-11-02-owner-comments.md.
- The hand fixes are the git diff from commit ${BASE} to the working tree: run \`git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass\` (ignore the built .html files in that diff; read the pages themselves instead).

The site's standing rules, which every changed line must keep:
- Plain, short, active sentences; no metaphors; no em dashes; no internal codes or code names (the two show machines are "the show machine in use now" and "the new show machine", never blue or green, except in the owner's own quoted words, in history on the change log, and in the record's notes on a retitle).
- A title dropped into a sentence takes typographic quotes “ ” outside its marker or link; no straight quotes around titles.
- On the owner's pages the overlays and the builder's own texts say "you" to the owner; the shared data (promise data, cases, cards, situations) says "the owner". The decision record calls the owner "the owner" and the lead agent "the agent running the pass", never "orchestrator".
- No question letters off the Decisions page, except as history on the change log.
- The owner's words are quoted exactly. Nothing inferred is written as if the owner said it. A reading of the owner's words is marked as a reading; an agent's call is marked as the agent's call, which the owner can overrule.

Write a report in plain markdown with: a one-paragraph scope; a verdict table (row, Resolved / Partly / Unresolved, where it lands now, with page or file and the words); a table of every new conflict the hand fixes introduced (page or file, the exact words, why it is wrong, exact replacement, exact place to change); and a short "what I found right" list. Then return a brief summary: counts and the three most important points.
`

const PAGES = `${COMMON}
Your part: the pages.
1. For each of the seven slips in v10-verify.md, read the rebuilt page where it lands and give a verdict. Check the facts the new lines state against the code: the GM app's Manual Entry (${ROOT}/ALNScanner/src/app/domains/gameOps.js, ${ROOT}/ALNScanner/index.html, and whether the tests drive it: ${ROOT}/ALNScanner/tests/e2e/page-objects/GMScannerPage.js and ${ROOT}/backend/tests/e2e/helpers/page-objects/GMScannerPage.js). Do not read the top-level clones /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner; read only inside ${ROOT}.
2. Three titles were changed to drop the code names: the decision "Blue's fixes are evidence of design causes" is now "Fixes to today's engine are evidence of design causes"; "Green's follow-ups ship when the definition session ends" is now "The new show machine's follow-ups ship when the definition session ends"; the flaw C16 "A green test run proves nothing about the show" is now "A passing test run proves nothing about the show". Search every built page for the old titles and for every remaining "blue" or "green" (case-insensitive, whole words, including in link text and anchors); each remaining one must be the owner's own quoted words, history on the change log, or a colour; list any other. Check the new titles render wherever the old ones did (Decided on Decisions, the intro on Today's engine, the change log's tables, every flaw link to C16), and that the version 10 change-log entry naming the three renames reads right and is true.
3. Read the words-box entry "The show machine in use now, the new show machine" on The engine page: two sentences were removed; check it still reads whole and that nothing on any page now leans on a removed gloss.
4. Read every other changed line on its page (the Decisions intro's second paragraph, question B's "What we need from you", question H's first item, question I's "For the GM at a failure", the call "The quality targets' numbers are sorted, not asked", the decided line on the owner's site, Design's "How games and venues extend the engine" (Already settled) and its authority round's panel paragraph, Today's "Standalone today" first paragraph, the change log's blue/green row in "The words replaced in version 9"). Check each against the rules above and against the other pages: the Decisions intro's count of where version 9's eighteen questions went must match the change log's letters table row by row; question B's ask must match its options.
5. Note anything else wrong you meet on the way, marked as outside the hand fixes.
Write your report to ${OUT}/v10-hand-verify-pages.md.`

const RECORD = `${COMMON}
Your part: the decision record, ${AP}/DECISIONS.md, and two working files.
1. Read the record's diff from ${BASE} in full, then read each changed entry whole. For each change say whether it is right: the two retitled entries (the new titles; a dated history line keeping the old title; the number-to-title table); the four readings of earlier decisions now "confirmed as the agent's call" in "The nine questions the pass answers", "One program: design half, then build half", "Five documents the design half hands over", "When the design half is finished" and the section in "Superseded and withdrawn" that lists them (now "Read as overtaken, confirmed as the agent's call"), and the record's intro that names that section; the sorting of the quality targets' numbers in "The engine says what is fixed and what each production sets"; "Two kinds of game extension" (which open question is the owner's and which the design round's); "What the architects' panel sees, and when" (reviews, not confirms; "the agent running the pass" in place of "orchestrator"); "Independent architects propose the top-level design"; version 9's two dates in "The owner's site: five linked pages"; the standalone pass's three questions in the history of "Standalone games: declared, never mixed"; "Still open" (the tap promise's call; the withdrawn rig question); the tables of old numbers and the old site questions, row by row.
2. Check every changed passage against the site's own data, which the owner reads: ${AP}/report/site/v9/decisions.json (its "calls", "readings", "groups", "later" and "decided" entries; the decided "line" of each retitled or changed entry must agree with the record), design.json, and the change log's letters table in changes.json. The record and the pages must say the same thing in their own words; list each disagreement with the side that should change.
3. Check that nothing the record says the owner decided or said was changed in meaning, that the owner's quoted words are untouched (compare with rework/2026-11-02-owner-comments.md), that no reading meant for the owner to confirm (the three on the Decisions page: a standalone game may have no GM tablet; a cut-off GM tablet keeps taking scans; the design must say how a networked game carries on if the show machine fails) was turned into a call, and that every "to be confirmed" left in the record is either history or one of those three.
4. The working files: rework/sorting.md, Table 2's row for QT2 (check it against ${ROOT}/backend/src/utils/processMonitor.js and ${ROOT}/backend/src/services/vlcMprisService.js), and report/site/checks/jargon-table.md row 17 (retired).
5. List anything still stale in the record against the site that the hand fixes missed (search the whole record for "Decisions page", "to be confirmed", "Still open", "orchestrator", "blue", "green"), marked as outside the hand fixes.
Write your report to ${OUT}/v10-hand-verify-record.md.`

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
  () => agent(PAGES, { label: 'verify:pages', phase: 'Verify', schema: SUMMARY, effort: 'high' }),
  () => agent(RECORD, { label: 'verify:record', phase: 'Verify', schema: SUMMARY, effort: 'high' }),
])
return { pages, record }
