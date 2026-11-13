export const meta = {
  name: 'decision-record',
  description: "Rebuild the owner's decision record by topic with titles instead of numbers: inventory every decision, write the record as current truth with dated history, check it refute-by-default, then apply it to the state page and the living documents",
  phases: [
    { title: 'Inventory', detail: 'one reader lists every decision and numbered question with its fate and a proposed title' },
    { title: 'Write', detail: 'one writer drafts the record by topic' },
    { title: 'Check', detail: 'one refute-by-default checker' },
    { title: 'Apply', detail: 'one editor fixes the record and points the living documents at it' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const PLANS = ROOT + '/docs/plans'
const AP = PLANS + '/architecture-pass'
const REC = AP + '/DECISIONS.md'
const WORK = AP + '/decision-record'

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) runs an architecture pass to redesign the engine for the long term. Their decisions were numbered 1 to 36: 1 to 16 in the definition session (word for word in Appendix A of ${PLANS}/2026-10-30-architecture-pass.md), and 17 onward as questions and decisions on the state page (${PLANS}/CURRENT-STATE.md section 0, which also lists the open questions by number). On 2026-11-01 the owner decided "titles, not numbers" (the last entry on the state page's list): decisions, questions and design flaws go by short plain titles in conversation and on the owner's pages; ids stay only inside records; the decision record is reorganized by topic, what stands now written as current truth with a dated history beneath, superseded decisions moved into that history. The owner's frame for all of it, in their words: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)".

How to write: plain, short, active sentences, for the owner; no metaphors; no em dashes; no internal codes in titles or statements (no decision, question, step, phase, block or round numbers; promises by their exact titles; the sequencing names the owner approved: the architecture pass's design half and build half, its steps named by what they do, blocks by name, question rounds by date, test levels by name). Every statement must match its source; where a later decision amends an earlier one, the standing statement says what holds now, and the history says what changed, when and why.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Write only the files your task names.`

const S = { type: 'object', properties: { file: { type: 'string' }, items: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'items', 'keyPoints'] }
const C = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const A = { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, applied: { type: 'integer' }, rejected: { type: 'integer' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['files', 'applied', 'rejected', 'notes'] }

phase('Inventory')
const inv = await agent(`${COMMON}

Your task: write ${WORK}/inventory.md, every decision and numbered question there has been. Sources: Appendix A of the program document (1 to 16), the state page's section 0 (17 onward, the open questions, and the "Pending" and "Under discussion" notes), its git history (git -C ${ROOT} log -p -- docs/plans/CURRENT-STATE.md) for numbers that left the page, and ${AP}/2026-10-30-cause-analysis.md and ${AP}/2026-10-31-engine-jobs.md for the numbered questions of the question rounds (17 to 25: what each asked, and whether it was answered, folded into another, withdrawn or still open).

One row per number: the number; the date and round; what it decided or asked, in one plain sentence; its fate (stands as written; stands as amended by which; superseded by which; folded into which; withdrawn; still open); a proposed title (three to eight plain words, distinct from every other title, saying what was decided); a proposed topic. Propose the topics from what the decisions are about, for example: the goal and the frame; the words; what the engine must do (its scope and its boundaries); how the design is made and in what order; the owner's site; how the work runs (documents, records, tools). Then list where the living documents refer to decisions or questions by number: ${ROOT}/CONTEXT.md, ${PLANS}/ROADMAP.md, ${ROOT}/docs/agents/process.md, ${PLANS}/CURRENT-STATE.md, each occurrence with its line.

Return the file, the number of rows, and five key points.

Done when: every number from 1 to 36 and every numbered question has a row, and every number in the four living documents is listed.`, { label: 'inventory', phase: 'Inventory', model: 'opus', effort: 'high', schema: S })

phase('Write')
const draft = inv ? await agent(`${COMMON}

Your task: write the new decision record, ${REC}, from ${WORK}/inventory.md and the sources it names.

- Title: "What the owner has decided". A short opening: what the record is, that it says what stands now by topic, that each entry is current truth with its history beneath, and that the open questions live on the owner site's Decisions page.
- One section per topic, in an order that reads from the big picture down (the goal and the frame first). In each, one entry per standing decision: its title in bold; the decision as it stands now, merging every amendment, in two to six plain sentences; the date it was made and, under "History", one line per change (date, what changed, why, and what it replaced). Where the owner's own words were recorded, quote them.
- A "Superseded and withdrawn" section by date: each with its title, what it said, what replaced it and when.
- A "Still open" section that only points to the Decisions page and lists the open items by title.
- Last, "For older records: number to title": one table mapping every old number (decisions and numbered questions) to its title and its section, because dated records still use the numbers.

Write ${WORK}/write-log.md: for each entry, its sources and any judgment you made in merging.

Return the file, how many entries you wrote, and five key points.

Done when: every row of the inventory appears in the record (as a standing entry, in the history of one, in the superseded section or in the open list) and in the number-to-title table, and no title or statement carries a number.`, { label: 'write', phase: 'Write', model: 'fable', effort: 'high', schema: S }) : null

phase('Check')
const check = draft ? await agent(`${COMMON}

Check ${REC} against ${WORK}/inventory.md and the sources (Appendix A of the program document, the state page's section 0 and its git history, the cause analysis and the promises document for the numbered questions). Refute by default: a decision missing or misplaced; a standing statement that misstates its source or drops an amendment; a superseded decision written as standing, or the reverse; a wrong date; a history line that misstates what changed; a title that is unclear, carries a number, or duplicates another; a topic that mixes unrelated decisions; the number-to-title table missing a number or pointing to the wrong title; jargon, metaphors, em dashes; a quote that is not the owner's recorded words.

Write ${WORK}/check.md: a short header, the conflicts table (where, what it says, what it should say, the source), then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.

Done when: every entry and every table row has been read against its source and the counts match your table.`, { label: 'check', phase: 'Check', model: 'opus', effort: 'high', schema: C }) : null

phase('Apply')
const apply = check ? await agent(`${COMMON}

Your task, in order:
1. Apply ${WORK}/check.md to ${REC}: verify each conflict against its source first; apply it or reject it with a reason; record each in ${WORK}/apply-log.md.
2. The state page, ${PLANS}/CURRENT-STATE.md section 0: replace the numbered decision list (from its first numbered entry through the last, including the "Open in round 8" paragraph and the "Pending" note) with a short pointer to ${REC}, the open items by title (pointing to the owner site's Decisions page), and a one-line note that old numbers map to titles in the record's last table. Keep every other part of section 0 and the rest of the page as it is, except numbers elsewhere on the page, which become titles.
3. The living documents: in ${ROOT}/CONTEXT.md, ${PLANS}/ROADMAP.md and ${ROOT}/docs/agents/process.md, replace each reference to a decision or question by number with its title (and the record's file where a reader needs to find it). Keep the meaning of every sentence.
4. The dated records keep their numbers. Add one line at the top of each of these, under its title, saying that decision and question numbers in it map to titles in ${REC}: ${PLANS}/2026-10-30-architecture-pass.md (put it under the Appendix A heading too), ${AP}/2026-10-30-cause-analysis.md, ${AP}/2026-10-31-engine-jobs.md, ${AP}/2026-11-01-engine-shape.md, ${AP}/2026-11-01-after-game-report.md.

Return the files you changed, how many conflicts you applied and rejected, and a note per rejection and per judgment call.

Done when: every conflict is settled, the state page carries no numbered decision list, the three living documents carry no decision or question numbers, and the five dated records carry their note.`, { label: 'apply', phase: 'Apply', model: 'fable', effort: 'high', schema: A }) : null

log(`decision record: inventory ${inv ? inv.items : '?'} rows; record ${draft ? draft.items : '?'} entries; check ${check ? check.conflicts : '?'} conflicts; applied ${apply ? apply.applied : '?'}`)
return { inv, draft, check, apply }