export const meta = {
  name: 'engine-shape',
  description: 'Map how the engine\'s jobs relate, map where each job lives today (components and modules), and derive a candidate shape for the engine\'s parts; check and fold',
  phases: [
    { title: 'Read', detail: 'today: components; backend modules; client modules; and the jobs\' relationships, restated functionally' },
    { title: 'Shape', detail: 'the relationship map and a candidate shape for the engine\'s parts' },
    { title: 'Check', detail: 'refute-by-default check' },
    { title: 'Fold', detail: 'apply the check' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const REL = AP + '/relationships'
const SHAPE = AP + '/2026-11-01-engine-shape.md'
const SHAPE_JSON = AP + '/report/2026-11-01-engine-shape.json'
const SKILL = '/root/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering'

const COMMON = `Context. The ALN show engine (a Node.js backend that runs immersive games and drives video, music, sound, lights and displays; GM tablets running the GM scanner; a TV scoreboard and a Pi 4 scoreboard; player scanners, a web one and an ESP32; a config tool; game packs) is in its architecture pass. The owner's decision 26 (docs/plans/CURRENT-STATE.md section 0) sets the frame: design the best architecture for the next iteration of the engine, for long-term use and future development as its use grows beyond ALN; problems seen on the production machine (blue) are clues, never the driver.

Step 1 now leads with the engine's ten jobs: ${AP}/2026-10-31-engine-jobs.md (and its mapping sheets ${AP}/2026-10-31-jobs-capabilities.md and ${AP}/2026-10-31-jobs-flaws.md). The design flaws C1 to C16 (and the proposed N1) sit under the jobs: ${AP}/2026-10-30-cause-analysis.md and ${AP}/2026-10-31-standalone-pass.md. The engine's purpose, its five users and its 52 built and planned capabilities: ${AP}/2026-10-30-map-direction.md. The evidence maps of today's engine: ${AP}/2026-10-30-map-backend-game.md, -map-backend-show.md, -map-gm-scanner.md, -map-clients-tests.md, -map-inbound.md, -map-runtime-state.md (read its section 0 first) and -map-runtime-state-check.md.

What the owner asked for now, in their words: the jobs seem about right, but some are understood "more surface level and technical/mechanical rather than functional, like jobs 8 and 9"; and "make sure we've fully considered how these jobs all map out in relation to each other ... in order to make sure we're designing our architecture appropriately in a way that makes sense for all of the relevant modules/components of the engine to be most maintainable and easy to continue development on". Both levels: the big components (backend, GM scanner, player scanners, scoreboards, config tool, packs, tests) and the modules inside them.

Design vocabulary, exactly as defined in ${SKILL}/codebase-design/SKILL.md: module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality. Domain vocabulary: CONTEXT.md (sections 1, 2, 4b, 5, 7). When you describe a job or anything the owner reads, write from the side of the people the engine serves (designer, venue installer, GM, player, audience, and the developer who keeps building the engine): who, at what moment, what they need to happen. Mechanisms come second. Nothing here is decided: every target shape is a candidate for step 3.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv. The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner are stale clones; read nothing there. Never open backend/.env. Every claim about today's engine cites file:line or a record's path and section. Write only the file you are told to write.`

const READ_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, items: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'items', 'keyPoints'],
}

const READERS = [
  { key: 'components', file: REL + '/2026-11-01-today-components.md', task: `Your job: map today's big components against the ten jobs. The components: the backend; the GM scanner (networked and standalone); the web player scanner; the ESP32 player scanner; the TV scoreboard and the Pi 4 scoreboard; the config tool; the pack data (ALN-TokenData and the pack files); the tests, the CI and the rung-1 rig; the outside programs the backend drives (VLC, MPD, the audio system, Home Assistant, Bluetooth, the TV's browser).
For each component: which jobs it serves and how (cite), what it decides itself and what it only shows, and its interface to the others: every message, request, file or event that crosses between components, grouped by the job it serves. Then a component-by-job matrix, and the places where one job is split across several components with nothing joining them, or where a component does a job that belongs to another.
Done when: every component has an entry, every crossing in docs/plans/architecture-pass/2026-10-30-map-inbound.md and the runtime-state map is placed under a job, and the matrix has a row per component.` },
  { key: 'backend-modules', file: REL + '/2026-11-01-today-backend-modules.md', task: `Your job: map today's backend modules against the ten jobs. List every module under backend/src (services, websocket, routes, gameRules, models, utils, config, and any other folder), and for each: the jobs it serves, its interface (what callers must know), whether it is deep or shallow by the codebase-design definition, and which modules it depends on (read the require calls; record the command you used to list them).
Then: for each job, every module that holds part of it (a job spread over many modules has no locality); every module that serves three or more jobs; every dependency that runs against the grain (a lower-level module reaching up into a higher one, or a cycle); and the seams that exist today (adapters: VLC, MPD, PipeWire, Home Assistant, Bluetooth, storage) with how many adapters each seam really has.
Done when: every file under backend/src has a row (check the count against a raw listing), and every job lists its modules.` },
  { key: 'client-modules', file: REL + '/2026-11-01-today-client-modules.md', task: `Your job: map today's client modules against the ten jobs: ALNScanner/src (the GM scanner), aln-memory-scanner/js (the web player scanner), arduino-cyd-player-scanner/ALNScanner_v5 (the ESP32: hal, models, services, ui), and the scoreboard page (backend/public/scoreboard.html and what it loads). For each module: the jobs it serves, its interface, deep or shallow by the codebase-design definition, and its dependencies.
Then: which modules on a client re-implement a job the backend also does (rules, claims, scores, phases, the pack's identity), and how each copy is kept equal (or not); which modules would have to carry the game alone in a standalone game (decision 22); and what the web and ESP32 player scanners share or duplicate, under the owner's parity rule.
Done when: every source file in those four places has a row (check the counts against raw listings), and every job lists its client modules.` },
  { key: 'jobs', file: REL + '/2026-11-01-job-relationships.md', task: `Your job: work out how the ten jobs relate to each other, and restate each one functionally.
First, restate every job from the side of the people it serves: who relies on it, at what moment of a show or of a game's life (designing, fitting to a venue, setting up, doors open, during play, a hiccup, the end, the next game, a new release), and what must happen for them. Start with J8 and J9, which the owner says are described by their mechanics; then check every other job for the same problem. Keep each restatement under 60 words, and say what the current wording gets wrong, if anything.
Then the relationships, for every pair of jobs: does one need the other's output (a dependency, with its direction); do they share a mechanism (for example, getting state onto screens, applying the pack's rules, knowing who is connected, handling a boundary); or is one a quality that applies across the other (for example, telling the truth, staying trustworthy). Name each shared mechanism once, list the jobs that use it, and say whether it looks like a part of its own or a job's internal piece. Draw the dependencies as a Mermaid flowchart (job ids as nodes; at most 25 edges; the rules: first line flowchart TD, node labels in double quotes, edges A -->|"label"| B).
Finally, say which of the open questions D to G in the engine-jobs document section 4 (split J3? split J8? widen or split J10? who owns the equipment's state on screens?) the relationships answer, and how.
Done when: all ten jobs have a functional restatement, all 45 pairs have a verdict (in a table), and every shared mechanism lists its jobs.` },
]

phase('Read')
const reads = await parallel(READERS.map(r => () => agent(`${COMMON}

${r.task}

Write your sheet to ${r.file} in Markdown, with a short header (sources, tree, date 2026-11-01) and a completion check at the end. Then return the structured summary: the file, how many items you covered, and five to ten key points.`, { label: 'read:' + r.key, phase: 'Read', model: r.key === 'jobs' ? 'fable' : 'sonnet', effort: 'high', schema: READ_SCHEMA })))
const sheets = reads.map((r, i) => r ? READERS[i].file : null).filter(Boolean)
log('read: ' + reads.map((r, i) => READERS[i].key + (r ? ' ' + r.items + ' items' : ' FAILED')).join('; '))

const SHAPE_SCHEMA = {
  type: 'object',
  properties: { doc: { type: 'string' }, json: { type: 'string' }, parts: { type: 'array', items: { type: 'string' } }, openChoices: { type: 'array', items: { type: 'string' } } },
  required: ['doc', 'json', 'parts', 'openChoices'],
}
phase('Shape')
const shaped = await agent(`${COMMON}

Your job: from the four sheets (${sheets.join(', ')}), the engine-jobs document and the list of design flaws, write the engine-shape document: how the jobs fit together, where each job lives today, and a candidate shape for the engine's parts that a developer could keep building on for years.

Write ${SHAPE} in Markdown:
- Header: status "candidate for the owner; nothing decided", sources, date 2026-11-01.
- Section 1, the jobs restated functionally: one line per job from the people's side (from the jobs sheet), and the proposed new wording where the current one is mechanical.
- Section 2, how the jobs relate: the dependency diagram, the shared mechanisms (each with the jobs that use it), and the qualities that run across jobs. Plain words first.
- Section 3, where each job lives today, at both levels: a table of job against component, and against modules; the tangles (one job spread over many modules with nothing joining them; one module doing many jobs; dependencies against the grain); each tangle tied to the design flaws it causes (cite them).
- Section 4, a candidate shape: the engine's main parts at the module level (each with one job or one shared mechanism, its interface in plain words, and its seams and adapters), how they depend on each other (one direction, no cycles; draw it), and the component level: which parts run on the backend, which on the GM tablet (including what it needs to run a standalone game), which on the player devices and scoreboards, and which in the config tool. For each part: the jobs it serves, the flaws it would remove (each of C1 to C16 and N1 must land on at least one part), and the planned capabilities it makes room for. Where a real alternative exists (for example, whether getting state onto screens is one part or each job's own piece), give both and say what each costs.
- Section 5, what this means for the open questions: for each of D, E, F and G, and for A to C, what the map says.
- Section 6, choices only the owner can make, listed.
Use the codebase-design vocabulary in the design paragraphs, and plain words everywhere the owner reads first.

Then write ${SHAPE_JSON} as valid JSON for the owner's page: {"functional": [{"id": "J1", "people": "...", "moment": "...", "need": "...", "proposedTitle": "..." or null}], "relationsMermaid": "...", "mechanisms": [{"name": "...", "jobs": ["J2", ...], "plain": "..."}], "qualities": [{"name": "...", "jobs": [...], "plain": "..."}], "today": {"tangles": [{"title": "...", "plain": "...", "flaws": ["C1", ...]}]}, "parts": [{"id": "P1", "name": "...", "plain": "...", "level": "module", "runsOn": ["backend", ...], "jobs": ["J2"], "flaws": ["C1"], "seams": "..."}], "partsMermaid": "...", "componentsMermaid": "...", "alternatives": [{"title": "...", "a": "...", "b": "...", "cost": "..."}], "questionNotes": [{"q": "D", "note": "..."}], "ownerChoices": ["..."]}. Mermaid rules: first line flowchart TD or flowchart LR; node ids letters and digits only; every label in double quotes inside its brackets; edge labels in double quotes; no semicolons or # inside labels; at most 20 nodes per diagram. Owner-facing strings carry no file names or finding ids except flaw ids C1 to C16 and N1 and job ids J1 to J10.

Return the structured summary.
Done when: every job, every shared mechanism and every flaw is placed; the parts' dependency diagram has no cycle; the JSON parses.`, { label: 'shape', phase: 'Shape', model: 'fable', effort: 'high', schema: SHAPE_SCHEMA })

const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, holds: { type: 'integer' }, corrected: { type: 'integer' } },
  required: ['file', 'holds', 'corrected'],
}
phase('Check')
const check = await agent(`${COMMON}

Your job: check the engine-shape document ${SHAPE} and its page data ${SHAPE_JSON}, refute by default. Its sources: ${sheets.join(', ')}. Test each claim, and default to "corrected" when you cannot confirm it:
1. Every claim about today's engine (which component or module does what, every dependency, every tangle) matches the code: open the cited lines.
2. Every functional restatement is written from the people's side and keeps the job's meaning from the engine-jobs document; a restatement that changes what a job covers is flagged, not silently accepted.
3. The relationships: each dependency's direction is right, each shared mechanism's job list is complete, and the diagram matches the table.
4. The candidate shape: every job, every shared mechanism and every flaw (C1 to C16 and N1) lands on at least one part; the parts' dependencies have no cycle; nothing is presented as decided; each alternative's costs are fair to both sides.
5. The notes on questions A to G agree with the engine-jobs document section 4 and do not decide for the owner.
6. Owner-facing JSON strings are in plain words and carry no file names or finding ids beyond job and flaw ids; every Mermaid source follows the rules in the shape prompt (first line flowchart TD or LR; ids letters and digits; labels in double quotes; no semicolons or # in labels; at most 20 nodes).
Write ${AP}/2026-11-01-engine-shape-check.md: a verdict table (claim, verdict, evidence with file:line, the corrected text in full). Return the structured summary.
Done when: every section of the document and every JSON entry has a verdict.`, { label: 'check', phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })

const FOLD_SCHEMA = {
  type: 'object',
  properties: { changes: { type: 'integer' }, jsonValid: { type: 'boolean' } },
  required: ['changes', 'jsonValid'],
}
phase('Fold')
const fold = await agent(`${COMMON}

Your job: apply the check ${AP}/2026-11-01-engine-shape-check.md to ${SHAPE} and ${SHAPE_JSON}. Apply every corrected verdict in both; add a last section "Corrections from the check" to the document, one line per change naming its check row; keep the JSON valid (parse it after editing); change nothing the check did not touch. Return the structured summary.
Done when: no corrected claim remains in either file and the JSON parses.`, { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return { reads, shaped, check, fold }
