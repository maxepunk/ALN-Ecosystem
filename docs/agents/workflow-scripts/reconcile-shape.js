export const meta = {
  name: 'reconcile-shape',
  description: 'Bring the owner page\'s flaw cards and job entries into line with the engine shape; check each group refute-by-default and apply its corrections',
  phases: [
    { title: 'Reconcile', detail: 'three card groups and the ten jobs, each against the candidate shape' },
    { title: 'Check', detail: 'refute-by-default check of each group, corrections applied in place' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SHAPE = AP + '/2026-11-01-engine-shape.md'
const SHAPE_JSON = RP + '/2026-11-01-engine-shape.json'
const CARDS = RP + '/2026-10-31-cause-cards.json'
const JOBS = RP + '/2026-10-31-engine-jobs.json'
const SA_LINES = RP + '/2026-10-31-standalone-lines.json'
const AN = AP + '/2026-10-30-cause-analysis.md'
const SP = AP + '/2026-10-31-standalone-pass.md'
const EJ = AP + '/2026-10-31-engine-jobs.md'
const JR = AP + '/relationships/2026-11-01-job-relationships.md'
const SKILL = '/root/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/codebase-design/SKILL.md'
const PARTS = args && args.partNames ? args.partNames : 'Game rules, Pack channel, Game record, Answering, The night\'s record, Delivery, Connections and roles, Equipment, Show runner, Verdict, Lifecycle, Venue fit, Engine instance, Screens, Design studio, Joins and proofs, Release'

const COMMON = `Context. The ALN show engine is a Node.js backend that runs immersive games and drives video, music, sound, lights and displays, with GM tablets (the GM scanner), a TV scoreboard and a Pi 4 scoreboard, two player scanners (a web one and an ESP32), a config tool and game packs. It is in its architecture pass, phase 1, step 1. The owner's frame is decision 26 (docs/plans/CURRENT-STATE.md section 0): design the best architecture for the engine's long-term use as it grows beyond ALN; problems seen on the production machine (blue) are clues, never the driver.

The owner reviews one page. It leads with the engine's ten jobs (J1 to J10). Under each job sit cards, one per design flaw (C1 to C16; N1 is a proposed seventeenth with no card). Each card tells a moment at a show, why it happens, a "Today" diagram, a "Candidate, not decided" diagram with a note, a line "In design terms" and a line "In a standalone game". Those candidates were drawn one flaw at a time, before anyone mapped how the jobs relate.

That map now exists, and it ends in a candidate shape for the whole engine: ${SHAPE}, with its page data ${SHAPE_JSON}. Read the whole document before anything else, including its last section, "Corrections from the check", which overrides the text above it where they differ. In it: the jobs said from the side of the people they serve (section 1); how the jobs depend on each other and the eleven shared mechanisms (section 2); where each job lives in today's code, and the tangles (section 3); the candidate parts, each with its interface, the jobs it serves and the flaws it removes (4.1), one direction of dependency between them (4.2), which parts run on which device (4.3), and the real alternatives (4.4); notes on the open questions (sections 5 and 6).

The owner asked for this step in their words: "depending on what we get from the relationship mapping, some of our design choices that are elsewhere in the page may also need to be updated". Everything stays a candidate for step 3; nothing is decided.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv. The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner are stale clones; read nothing there. Never open backend/.env. Write only the files you are told to write.

Vocabulary: the design words (module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality) exactly as ${SKILL} defines them; the domain words as CONTEXT.md sections 1, 2, 4b and 5 define them (authority, copy, delivery path, verdict, dormant, paper and live, standalone, networked).`

const WRITING = `Writing rules for every string the owner reads. The owner is a product person: explain by what happens at a show, in plain, short, active sentences, one idea each, with no em dashes. Name parts by their plain names (${PARTS}), never by number. Leave out file names, code names and finding ids, except C1 to C16, N1 and J1 to J10. Mermaid rules: first line flowchart LR or flowchart TD; node ids letters and digits only; every node label and edge label in double quotes; a line break inside a label is <br/>; no semicolon or # inside a label; at most 12 nodes; mark the one node that owns the fact with "classDef owner stroke:#0f766e,stroke-width:3px;" and "class <id> owner;" as the existing cards do. In your notes for the checker, cite file:line or a record's path and section for every claim.`

const GROUPS = [
  { key: 'facts', ids: ['C1', 'C6', 'C9', 'C10', 'C11'], about: 'the game\'s facts: who decides them, how they reach screens, and what a screen does with them' },
  { key: 'running', ids: ['C2', 'C3', 'C4', 'C5', 'C7', 'C13'], about: 'the equipment, the life of a game, answering requests, and knowing who is connected' },
  { key: 'kit', ids: ['C8', 'C12', 'C14', 'C15', 'C16'], about: 'how the pack travels, the names joined parts share, the deployed pieces, and proof' },
]
const out = g => `${RP}/2026-11-01-cards-shape-${g.key}.json`
const chk = g => `${RP}/2026-11-01-cards-shape-${g.key}-check.md`
const JOBS_OUT = RP + '/2026-11-01-jobs-shape.json'
const JOBS_CHK = RP + '/2026-11-01-jobs-shape-check.md'

const RECONCILE_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, unchanged: { type: 'array', items: { type: 'string' } }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'changed', 'unchanged', 'keyPoints'],
}
const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, checkFile: { type: 'string' }, verdicts: { type: 'integer' }, corrected: { type: 'integer' }, jsonValid: { type: 'boolean' }, unsettled: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'checkFile', 'verdicts', 'corrected', 'jsonValid', 'unsettled'],
}

const cardsTask = g => `Your group: ${g.ids.join(', ')} (${g.about}). The cards are in ${CARDS}; their standalone lines in ${SA_LINES}; each flaw's record, with the competing designs (a) to (e) its card note lists, in ${AN} (the flaw's section); its standalone side in ${SP}.

For each card, in order:
1. Parts. Find the parts that remove this flaw: the "Removes" line of each part in section 4.1, the list after the last part, and the corrections section. Record their ids in "parts", the part that owns the fix first.
2. The candidate. Read the card's "after" diagram and note against those parts' interfaces (4.1) and the one direction of dependency (4.2). Where it agrees, keep it. Where it conflicts (a screen keeping a copy or a rule the shape takes away, a fact owned by a module the shape replaces, a route the shape folds into one delivery part, a dependency running upward), redraw it to show the shape's answer for this flaw at this flaw's scale: who decides the fact, which route carries it, what the screen does with it. When one of the card's competing designs is the shape's choice, say so in the note by its plain description, and drop the other competing designs from the note (the cause analysis keeps them). When section 4.4 gives a real alternative that bears on this flaw, end the note with it in one sentence that starts "Or:". Keep the note under 60 words and the caption "Candidate, not decided".
3. In design terms. Rewrite the line so it names the owning part and the seam by plain name, in the design vocabulary. Keep its account of today; change the target only. Under 70 words.
4. In a standalone game. Read the card's standalone line against 4.3 (the standalone tablet, candidate A: the same record, lifecycle, answering and delivery modules the engine runs, hosted on the tablet) and 4.4's row on the standalone tablet (candidate B: the tablet's own engine kept equal by tests), and against the standalone pass. Keep its facts about today. Where it says what the design should do, make that agree with the shape, naming both candidates when the choice matters to this flaw. Start the line "In a standalone game:". Under 60 words.
5. Facts. Keep every fact about today (title, "At a show", "Why it happens", the "Today" diagram, the examples) as it is. Where the shape's sources (the sheets in ${AP}/relationships/) show one is wrong, fix it and record the fix in "factFixes" with the sheet's section.
6. What changed. Write "shapeChange": one or two sentences for the owner on what changed on this card after the relationship map and why, in show terms; the empty string when nothing changed.

${WRITING}

Write ${out(g)} as valid JSON: {"cards": [{"id": "C1", "parts": ["P3", "P6"], "after": {"caption": "Candidate, not decided", "mermaid": "...", "note": "..."}, "designTerms": "...", "standaloneLine": "In a standalone game: ...", "factFixes": [{"field": "...", "from": "...", "to": "...", "why": "..."}], "shapeChange": "...", "notes": "for the checker: what you kept and changed, and the shape section each choice rests on"}]}. Every card in your group appears, changed or not, with every field filled. Parse the file after writing it (python3 -I -c "import json; json.load(open('${out(g)}'))").

Done when: every card in your group has its parts, a candidate that agrees with the shape or names the alternative it keeps, a design-terms line naming its owning part, a standalone line and a shapeChange (possibly empty), and the file parses. Return the file, the ids you changed, the ids you left unchanged, and five key points.`

const cardsCheck = g => `Your job: check the reconciled cards in ${out(g)} against the shape, refute by default, and apply your corrections to that file. Its writer was told what you see in the rules below; you were not its writer.
Read: the reconciled file; the same cards as they were in ${CARDS} and their standalone lines in ${SA_LINES}; the flaw records in ${AN} and ${SP}.
For each card, test each of these and give a verdict, held or corrected; default to corrected when you cannot confirm a claim:
1. Parts: section 4.1's Removes lines, the list after the last part and the corrections section place this flaw on exactly these parts, the owning part first.
2. The candidate matches those parts' interfaces (4.1) and the one direction of dependency (4.2): no screen decides a rule the shape gives to the game rules, the game record or the verdict; no lower part calls a higher one. It removes the flaw as the card's "At a show" tells it. Any alternative it keeps is one the shape offers (4.4) or the cause analysis lists.
3. The design-terms line names the owning part correctly, uses every design word as ${SKILL} defines it, and keeps the account of today unless a factFix justifies a change.
4. The standalone line agrees with 4.3, 4.4's row on the standalone tablet and the standalone pass, and keeps today's facts.
5. No fact about today changed without a factFix citing a sheet; each factFix is right (read the cited code or sheet).
6. "shapeChange" says truly what changed and why, and mentions every change a reader would notice; it is empty only when nothing changed.
7. The writing rules and the Mermaid rules below hold.

${WRITING}

Then apply every correction to ${out(g)}, keeping it valid JSON (parse it after editing), and write ${chk(g)}: a short header, then a table with one row per card per test (card, test, verdict, what was wrong, what you changed), then a short list of anything you could not settle.

Done when: every card in the group has seven verdicts, every correction is applied in the file, and the file parses. Return the file, the check file, the number of verdicts, the number corrected, whether the JSON parses, and anything unsettled.`

const jobsTask = `Your job: bring the page's ten job entries into line with the relationship map and the candidate shape. The page will now lead each job with the shape's restatement from the side of the people it serves (section 1 of the shape and the "functional" entries in ${SHAPE_JSON}: who, when, what must happen, and a proposed title where the current one names a mechanism), in place of the old "meaning" line.
Read: the job data ${JOBS} (each job's title, meaning, roles, goal, needs, flaws, standalone, questions, tests); the engine-jobs document ${EJ}; the relationship sheet ${JR}.

For each job, in order:
1. Parts: the parts the job lands on (the sentence "Every job lands" after the last part in 4.1, and the corrections section), the main one first.
2. Functional: start from the shape's restatement ("people", "moment", "need", "proposedTitle"). Compare it with the old title and meaning. Where the old wording carries a requirement the restatement drops, and the shape did not move it to a quality (2.4) or to another job's part, add it to "need" in a few plain words. Keep "need" under 70 words, "people" and "moment" under 25 words each, and keep "proposedTitle" null where the shape keeps the old title. List each addition in "needAdditions" with the old words it comes from.
3. The long-term goal: keep it where it agrees with the shape. Where it names a design answer the shape replaces, or misses something the shape gives this job to deliver, rewrite it (plain, under 70 words).
4. In a standalone game: keep its facts about today; make what it says about the design agree with 4.3 and 4.4's row on the standalone tablet. Under 60 words.
5. Needs and tests: list in "conflicts" any line that contradicts the shape, with the fix. Change nothing else in them.
6. What changed: "shapeChange", one or two sentences for the owner on what changed in this job's entry after the relationship map and why; the empty string when nothing did.

${WRITING}

Write ${JOBS_OUT} as valid JSON: {"jobs": [{"id": "J1", "parts": ["P1", "P2"], "functional": {"people": "...", "moment": "...", "need": "...", "proposedTitle": "..." or null}, "needAdditions": [{"words": "...", "from": "..."}], "goal": "...", "standalone": "...", "conflicts": [{"field": "needs or tests", "line": "...", "fix": "..."}], "shapeChange": "...", "notes": "for the checker, with the shape sections each choice rests on"}]}. All ten jobs appear. Parse the file after writing it.

Done when: all ten jobs have parts, a functional entry, needAdditions (possibly empty), a goal, a standalone line, conflicts (possibly empty) and a shapeChange, and the file parses. Return the file, the ids you changed, the ids you left unchanged, and five key points.`

const jobsCheck = `Your job: check the reconciled job entries in ${JOBS_OUT} against the shape, refute by default, and apply your corrections to that file. Its writer was told what you see in the rules below; you were not its writer.
Read: the reconciled file; the job data as it was in ${JOBS}; the engine-jobs document ${EJ}; the relationship sheet ${JR}.
For each job, test each of these and give a verdict, held or corrected; default to corrected when you cannot confirm a claim:
1. Parts match the sentence "Every job lands" in 4.1 and the corrections section, the main part first.
2. The functional entry keeps the shape's restatement (section 1, and the corrections section) except for additions listed in needAdditions; each addition restores a requirement the old wording really carried and the shape did not move to a quality or another job; nothing the old wording required is lost without a home in the shape; proposedTitle is the shape's, or null where the shape keeps the title.
3. The goal agrees with the shape and keeps everything in the old goal that the shape does not replace.
4. The standalone line agrees with 4.3, 4.4's row on the standalone tablet and the standalone pass, and keeps today's facts.
5. Every listed conflict in needs or tests is real, and no conflicting line was missed.
6. shapeChange says truly what changed and why.
7. The writing rules below hold.

${WRITING}

Then apply every correction to ${JOBS_OUT}, keeping it valid JSON (parse it after editing), and write ${JOBS_CHK}: a short header, then a table with one row per job per test (job, test, verdict, what was wrong, what you changed), then a short list of anything you could not settle.

Done when: every job has seven verdicts, every correction is applied in the file, and the file parses. Return the file, the check file, the number of verdicts, the number corrected, whether the JSON parses, and anything unsettled.`

const ITEMS = [...GROUPS.map(g => ({ kind: 'cards', key: g.key, g })), { kind: 'jobs', key: 'jobs' }]

const results = await pipeline(ITEMS,
  item => agent(`${COMMON}\n\n${item.kind === 'cards' ? cardsTask(item.g) : jobsTask}`,
    { label: 'reconcile:' + item.key, phase: 'Reconcile', model: 'fable', effort: 'high', schema: RECONCILE_SCHEMA }),
  (rec, item) => rec ? agent(`${COMMON}\n\n${item.kind === 'cards' ? cardsCheck(item.g) : jobsCheck}`,
    { label: 'check:' + item.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA }).then(c => ({ key: item.key, rec, check: c })) : null,
)
const done = results.filter(Boolean)
log('reconciled and checked: ' + done.map(r => `${r.key} (${r.rec.changed.length} changed; ${r.check ? r.check.corrected + ' corrected of ' + r.check.verdicts : 'check FAILED'})`).join('; '))
return { groups: done, missing: ITEMS.map(i => i.key).filter(k => !done.find(d => d.key === k)) }
