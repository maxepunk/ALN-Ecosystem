export const meta = {
  name: 'engine-jobs',
  description: 'Restructure step 1 around the engine\'s jobs: map the 52 capabilities and the design flaws onto the jobs, write the jobs document, check it, fold',
  phases: [
    { title: 'Map', detail: 'capabilities onto jobs; design flaws onto jobs' },
    { title: 'Write', detail: 'the engine-jobs document and the page data' },
    { title: 'Check', detail: 'refute-by-default check' },
    { title: 'Fold', detail: 'apply the check' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const DIR_MAP = AP + '/2026-10-30-map-direction.md'
const CA = AP + '/2026-10-30-cause-analysis.md'
const SP = AP + '/2026-10-31-standalone-pass.md'
const OUT_DOC = AP + '/2026-10-31-engine-jobs.md'
const OUT_JSON = AP + '/report/2026-10-31-engine-jobs.json'

const JOBS = [
  'J1. Run any game from its pack. The pack describes the game: its tokens and their content, modes, scoring, groups, cues, the clock, what each screen shows. The engine runs whatever the pack says. ALN is one pack; the toy pack proves the engine is generic.',
  'J2. Keep one true record of the game, and show it truly everywhere. Teams, scores, used tokens, exposed evidence and the game\'s phase are decided in one place, and every screen (GM tablets, the TV and other scoreboards, player devices) shows that record, also after it reconnects.',
  'J3. Answer every action, and remember what happened. Every scan and every GM command gets one clear answer, and the game keeps a record of what was done, so the show can be reviewed, reported and captured afterwards.',
  'J4. Run the show\'s equipment, and know its true state. Video, music, sound, lights, displays and speakers: the engine drives them, knows whether each one works or is not installed tonight, and lets the GM control them, by hand or by cues.',
  'J5. Move each game through its life cleanly. Setup, start, pause, end, reset, an engine restart and the next game: every fact has a defined fate at each of these moments.',
  'J6. Let designers build, change and try games safely. Publish a pack, apply a change to a running game, rehearse on a preview engine, all without disturbing a live show.',
  'J7. Give each person exactly what their role needs. The GM gets the command center, the audience the public scoreboard, players the content of what they scan, designers and installers their tools. The engine knows who is connected and keeps private what should be private.',
  'J8. Run wherever the venue and the game need. On the show machine, with the venue\'s equipment, with or without an engine (standalone games, decision 22), and on other kits later.',
  'J9. Tell the truth about what it knows. Unknown, out of date, broken and not installed tonight each show as what they are; red always means act now; the preflight answers go or no-go honestly.',
  'J10. Stay trustworthy as it changes. Tests prove the real show path, the parts that join are checked against each other, the installed pieces match, and testing never touches a live show.',
].join('\n')

const COMMON = [
  'Context. The ALN show engine is in its architecture pass. The owner\'s decision 26 (docs/plans/CURRENT-STATE.md section 0) sets the frame: design the best architecture for the next iteration of the engine, for long-term use and future development as its use grows beyond ALN. Blue\'s fixes and findings are clues to where today\'s design is off, never the driver. Step 1 was built the other way round: it grouped every known problem into sixteen design flaws, C1 to C16 (' + CA + '), and checked them against standalone games (' + SP + '; it also proposes a seventeenth flaw, N1). The owner found that hard to follow and asked to restructure step 1 around the engine\'s jobs first.',
  '',
  'The engine\'s purpose, users and standing rules are in ' + DIR_MAP + ' section 1; its 52 built and planned capabilities are in section 2 (a table, ids C1 to C52) and what each asks of the design is in section 3. Those capability ids clash with the flaw ids C1 to C16. In everything you write, call a capability by its name with "capability N" in brackets (for example "hot-apply (capability 16)"), and keep C1 to C16 and N1 for the design flaws only.',
  '',
  'The orchestrator\'s draft of the engine\'s jobs, written for any game, not only ALN:',
  JOBS,
  '',
  'Vocabulary: CONTEXT.md, sections 1, 2, 4b and 7. The owner reads like a product manager and finds technical words hard: in owner-facing text use everyday words and explain each job by what it does at a show (docs/agents/process.md section 5). Work only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv. The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner are stale clones; read nothing there. Never open backend/.env. Every claim cites a file and section or line. Write only the file you are told to write.',
].join('\n')

const MAP_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, placed: { type: 'integer' }, unplaced: { type: 'array', items: { type: 'string' } }, jobChanges: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'placed', 'unplaced', 'jobChanges'],
}

phase('Map')
const maps = await parallel([
  () => agent([COMMON, '',
    'Your job: map all 52 capabilities and every standing rule in ' + DIR_MAP + ' section 1 onto the draft jobs. For each capability: its primary job, any secondary jobs, and in one plain sentence what it needs from that job, from section 3 (cite the line). Then, for each job, list what the planned capabilities need from it, in plain words.',
    'Test the draft: say which capabilities fit no job, which job has no capability, and whether any job should be split, merged or added, with the reason. Propose changes; do not apply them.',
    'Write ' + AP + '/2026-10-31-jobs-capabilities.md: a capability table (capability N, name, status, primary job, secondary jobs, what it needs, citation), a per-job list of needs, the standing rules per job, and your proposed job changes. Return the structured summary.',
    'Done when: all 52 capabilities and every standing rule have a row, and the count is checked against a raw count of the table rows in section 2.',
  ].join('\n'), { label: 'map:capabilities', phase: 'Map', model: 'sonnet', effort: 'high', schema: MAP_SCHEMA }),
  () => agent([COMMON, '',
    'Your job: map every design flaw onto the draft jobs: C1 to C16 from ' + CA + ' (sections 1 and 2; if a section 8 "Consistency check" exists, read it too, since it corrects earlier text) and N1 plus the standalone shortfalls from ' + SP + '. For each flaw: its primary job, any secondary jobs, and in one plain sentence how it keeps that job from being done well. For each job: the flaws under it, two or three of the strongest show-night examples as clues (from the cards in ' + AP + '/report/2026-10-31-cause-cards.json or the analysis, with their finding ids), and two to four test cases the new design must pass, taken from the analysis\'s candidate proving tests.',
    'Test the draft: say which flaw fits no job, and whether any job should be split, merged or added, with the reason. Propose changes; do not apply them.',
    'Write ' + AP + '/2026-10-31-jobs-flaws.md: a flaw table (flaw, primary job, secondary jobs, how it blocks the job, citation), a per-job list of flaws, clues and test cases, and your proposed job changes. Return the structured summary.',
    'Done when: C1 to C16 and N1 each have a row, and every job lists its flaws, or says it has none.',
  ].join('\n'), { label: 'map:flaws', phase: 'Map', model: 'sonnet', effort: 'high', schema: MAP_SCHEMA }),
])
log('map: ' + maps.filter(Boolean).map(m => m.placed + ' placed, unplaced ' + (m.unplaced.join(', ') || 'none') + ', job changes proposed ' + m.jobChanges.length).join(' | '))

const WRITE_SCHEMA = {
  type: 'object',
  properties: { doc: { type: 'string' }, json: { type: 'string' }, jobs: { type: 'array', items: { type: 'string' } } },
  required: ['doc', 'json', 'jobs'],
}
phase('Write')
const written = await agent([COMMON, '',
  'Your job: write the engine-jobs document from the two mapping sheets (' + AP + '/2026-10-31-jobs-capabilities.md and ' + AP + '/2026-10-31-jobs-flaws.md), the analysis and the standalone pass. It replaces the flaw list as the front of step 1: the jobs come first, the flaws sit under the jobs as where today\'s design falls short, and blue\'s problems are clues and test cases.',
  'Keep the draft jobs unless both mapping sheets give a strong reason to change one; when you change a job, say so and why in a short section the owner will see as a question. Never decide a design: the long-term goal of each job is the direction the roadmap and the owner\'s decisions already set (cite them); where they set none, write the goal as an open question for step 3.',
  '',
  'Write ' + OUT_DOC + ' in Markdown:',
  '- Header: status "draft for the owner\'s confirmation", what changed and why (decision 26), the sources.',
  '- Section 1, what the engine is for: five to eight plain sentences on who it serves and its standing rules (from the direction map section 1).',
  '- Section 2, the jobs at a glance: one line per job.',
  '- Section 3, one entry per job: what it means for any game (at most 60 words); who relies on it; the long-term goal (at most 60 words, cited, or an open question); what the planned capabilities need from it (bullets, capability names); where today\'s design falls short (each flaw under it, one plain sentence each, primary flaws first); in a standalone game (one or two sentences); the pass\'s questions it answers (the nine of docs/plans/2026-10-30-architecture-pass.md section 3); test cases from the shows (two to four, plain words: what to do, what must happen).',
  '- Section 4, proposed job changes from the mapping sheets, if any, each as a question for the owner.',
  '- Section 5, coverage: every capability and every flaw, and the job it went to.',
  'Then write ' + OUT_JSON + ' as valid JSON for the page: {"purpose": [sentences], "jobs": [{"id": "J1", "title": "...", "meaning": "...", "roles": ["..."], "goal": "...", "goalOpen": true|false, "needs": ["..."], "flaws": [{"id": "C9", "primary": true|false, "how": "..."}], "standalone": "...", "questions": [1, 5], "tests": ["..."]}], "jobChanges": ["..."]}. Owner-facing fields use everyday words, no file names or finding ids.',
  'Return the structured summary.',
  'Done when: every job has every field; every capability and every flaw appears in section 5; the JSON parses.',
].join('\n'), { label: 'write', phase: 'Write', model: 'fable', effort: 'high', schema: WRITE_SCHEMA })

const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, holds: { type: 'integer' }, corrected: { type: 'integer' } },
  required: ['file', 'holds', 'corrected'],
}
phase('Check')
const check = await agent([COMMON, '',
  'Your job: check the engine-jobs document ' + OUT_DOC + ' and its page data ' + OUT_JSON + ', refute by default. Test each claim, and default to "corrected" when you cannot confirm it:',
  '1. Every one of the 52 capabilities and every flaw (C1 to C16, N1) is placed in section 5, and the placement agrees with the mapping sheets or the document says why it differs.',
  '2. Every long-term goal is traceable to the roadmap, the direction map or a recorded owner decision (cite it), or is marked as an open question. A goal that decides a design the owner has not decided is "corrected".',
  '3. Every "falls short" sentence agrees with the analysis (including its section 8, if present) and the standalone pass: same mechanism, same scope, no overstatement.',
  '4. Every test case comes from the analysis\'s candidate proving tests and would fail on today\'s engine.',
  '5. Capability ids and flaw ids are never confused, and owner-facing fields carry no file names, codes or finding ids.',
  'Write ' + AP + '/2026-10-31-engine-jobs-check.md: a verdict table (claim, verdict, evidence, the corrected text in full). Return the structured summary.',
  'Done when: every job entry and every coverage row has a verdict.',
].join('\n'), { label: 'check', phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })

const FOLD_SCHEMA = {
  type: 'object',
  properties: { changes: { type: 'integer' }, jsonValid: { type: 'boolean' } },
  required: ['changes', 'jsonValid'],
}
phase('Fold')
const fold = await agent([COMMON, '',
  'Your job: apply the check ' + AP + '/2026-10-31-engine-jobs-check.md to ' + OUT_DOC + ' and ' + OUT_JSON + '. Apply every corrected verdict in both; add a last section "Corrections from the check" to the document, one line per change; keep the JSON valid (parse it after editing). Change nothing the check did not touch. Return the structured summary.',
  'Done when: no corrected claim remains in either file and the JSON parses.',
].join('\n'), { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return { maps, written, check, fold }
