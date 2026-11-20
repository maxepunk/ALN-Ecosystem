export const meta = {
  name: 'cause-analysis',
  description: 'Architecture pass phase 1 step 1: group every blue fix and evidence finding by design cause, then check the grouping refute-by-default',
  phases: [
    { title: 'Read', detail: 'four readers split by source: blue, backend, GM scanner, other clients and tests' },
    { title: 'Merge', detail: 'group every finding by design cause' },
    { title: 'Check', detail: 'refute-by-default check of the merge, two halves' },
    { title: 'Fold', detail: 'apply the check to the cause analysis' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const DIR = ROOT + '/docs/plans/architecture-pass'
const DOC = DIR + '/2026-10-30-cause-analysis.md'

const COMMON = [
  'You are one agent in a read-only analysis for the ALN engine\'s architecture pass, phase 1, step 1: the cause analysis.',
  '',
  'Read first: docs/plans/2026-10-30-architecture-pass.md sections 3 (the nine questions), 4.1 (step 1) and 6 (how blue\'s fixes are used); CONTEXT.md sections 2, 4b and 7 for the vocabulary (one truth, verdict, runtime state, authority, copy, delivery path, architecture pass). Use those terms exactly as defined there.',
  '',
  'Where you work: only under /home/user/ALN-Ecosystem/, the main checkout, on branch claude/nice-curie-hescfv at 12baf920, with ALNScanner at e83723c. This is "the current tree". The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner directories are stale copies that have misled agents before; read nothing there. Read nothing under /home/user/ALN-Ecosystem/.worktrees/ either: it holds another task\'s copy, mid-edit. Never open backend/.env (it holds a live credential). Read blue\'s code and records with git only: "git show origin/production-2026-07:<path>" in the parent repository, "git -C ALNScanner show origin/production-2026-07:<path>" for the GM scanner. Write only the one file you are told to write; change no code.',
  '',
  'Evidence rule: every claim cites a file and line: the current tree\'s file:line for code, or the record\'s path and section or line for a record. A claim you cannot cite is left out, or marked "not verified".',
  '',
  'Plain words: describe what happens during a game in sentences a product manager follows (docs/agents/process.md section 5). A design cause says why the design lets the fault happen; it is never the fault restated. Example of a cause: "each tablet keeps its own list of claimed tokens, so it must hear about every way a claim can change". The matching symptom: "the tablet refuses a deleted token".',
  '',
  'A finding is any statement in your sources that something in the engine is wrong, missing, contradictory or unsafe, or does something other than what a screen, a contract or a document says, including a risk the source names for a planned capability. A description of how something works, with no fault in it, is not a finding. Each of blue\'s fixes counts as a finding: it is evidence of the fault it fixed.',
].join('\n')

const READER_FIELDS = (prefix, file) => [
  'For every finding in your sources, record:',
  '- id: ' + prefix + '-NN, numbered in reading order.',
  '- what happens during a game: plain words, one or two sentences.',
  '- source: the record path and section or line where the finding is stated (all of them, if several sources state it).',
  '- code now: the current tree\'s file:line where the fault lives, read by you today; and its status: present (the fault is in the current tree), gone (the current tree no longer has it; cite why), changed (it moved or changed shape; say how), or not-checkable (seeing it needs running programs; say which).',
  '- problem area: the part of the engine, in a few words.',
  '- design cause: the id of your local cause (below).',
  '- questions: the numbers of the nine questions (program document section 3) whose rule would remove it; one or more.',
  '- live proof: "yes" when the finding has only code-reading evidence and showing it needs real programs, a restart, a reset or real devices (say what a rig run would show); "no" when it was seen on running software (cite where) or the code alone settles it.',
  '- proving test: plain words, what to do and what must happen, written so that it fails on today\'s engine. It is a candidate only; phase 1 decides the tests.',
  '',
  'Then group your findings by design cause. For each local cause, id ' + prefix + '-cN:',
  '- the design cause, in one or two plain sentences;',
  '- the findings behind it (ids);',
  '- every other place in the current tree with the same cause: file:line, each one read by you, found by a search you record (the command or pattern). Search the whole engine for the pattern, not only the files your sources name, and list a place only after you have read it;',
  '- the candidate design choice that would remove the cause, in one or two sentences, marked "candidate, not decided". When you see two credible choices, give both.',
  '',
  'Write your sheet to ' + file + ' in Markdown: a short header (your source list, the tree, the date 2026-10-30); section 1, the findings table; section 2, the local causes; section 3, the completion check. Then return the structured summary.',
  '',
  'Done when: every finding in every source on your list has a row; section 3 lists each source with the sections you read and how many findings you took from each, with a one-line reason for every section that yielded none; and every local cause\'s list of other places records the search it came from.',
].join('\n')

const READERS = [
  {
    key: 'blue', prefix: 'A', file: DIR + '/2026-10-30-causes-blue.md',
    scope: [
      'Your source: blue\'s records, the production machine\'s September fixes and the findings it left unfixed. Blue\'s records hold three kinds of item; take all three: fixes (packages W1 to W10 and each of their parts), findings blue\'s review raised that were never fixed, and follow-ups or deferred items the plan or the commits name.',
      '1. git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-review.md (every finding, fixed or not).',
      '2. git show origin/production-2026-07:docs/plans/2026-09-15-alnscanner-wiring-fixes-plan.md (every package, every part, every deferred item and follow-up).',
      '3. Blue\'s commit messages, for follow-ups recorded only there: git log --format="%h %ad %s%n%b" --date=short blue-2026-07..origin/production-2026-07, and the same in ALNScanner (git -C ALNScanner log ... blue-2026-07..origin/production-2026-07).',
      '4. The record changes on blue\'s branch: git diff blue-2026-07 origin/production-2026-07 -- DEPLOYMENT_GUIDE.md CLAUDE.md backend/CLAUDE.md backend/tests/e2e/README.md SUBMODULE_MANAGEMENT.md scripts/README.md (faults they record only).',
      '5. docs/plans/2026-10-30-production-fixes-triage.md: each fix\'s verdict on the new engine. Re-read the lines it cites in the current tree before relying on it; it was written against an earlier commit.',
      'For a fix, "code now" is where the fault it fixed lives in the current tree (the new engine), or why it is gone.',
    ].join('\n'),
  },
  {
    key: 'backend', prefix: 'B', file: DIR + '/2026-10-30-causes-backend.md',
    scope: [
      'Your source: the backend. Take every finding whose fault lives in backend/src, backend/contracts, backend/config, backend/scripts, the process manager config, or the pack files (ALN-TokenData). A finding whose fault spans the backend and another component is yours too; the merge joins duplicates.',
      '1. docs/plans/architecture-pass/2026-10-30-map-backend-game.md (all sections).',
      '2. docs/plans/architecture-pass/2026-10-30-map-backend-show.md (all sections).',
      '3. docs/plans/architecture-pass/2026-10-30-map-runtime-state.md: read section 0 first; where it disagrees with the body, section 0 wins. Take the findings in the backend.',
      '4. docs/plans/architecture-pass/2026-10-30-map-runtime-state-check.md: its verdict table refutes or corrects map claims. A refuted claim is not a finding; a corrected one is taken in its corrected form.',
      '5. docs/plans/architecture-pass/2026-10-30-map-inbound.md: the findings in the backend.',
      '6. docs/plans/2026-10-30-recovered-review-findings.md: every standing finding about the backend, in sections 1 to 5 (section 1 is the merged dormancy core; sections 2 to 4 are pre-build reviews of paused briefs, whose findings show weaknesses in planned designs).',
      '7. docs/plans/2026-09-12-block3-truth-sweep-census.md: the findings in the backend, including the recorded desync classes in section 8.',
      '8. docs/plans/architecture-pass/2026-10-30-map-roadmap.md sections 3 and 4: each paused hardening piece exists to remove a fault in today\'s engine. Record that fault, citing the piece\'s brief in docs/plans/briefs/.',
    ].join('\n'),
  },
  {
    key: 'gm-scanner', prefix: 'C', file: DIR + '/2026-10-30-causes-gm-scanner.md',
    scope: [
      'Your source: the GM scanner. Take every finding whose fault lives in ALNScanner/src, ALNScanner/sw.js or ALNScanner/index.html. A finding whose fault spans the GM scanner and another component is yours too; the merge joins duplicates.',
      '1. docs/plans/architecture-pass/2026-10-30-map-gm-scanner.md (all sections, including Appendix A).',
      '2. docs/plans/architecture-pass/2026-10-30-map-runtime-state.md: read section 0 first; where it disagrees with the body, section 0 wins. Take the findings in the GM scanner.',
      '3. docs/plans/architecture-pass/2026-10-30-map-runtime-state-check.md: its verdict table refutes or corrects map claims. A refuted claim is not a finding; a corrected one is taken in its corrected form.',
      '4. docs/plans/architecture-pass/2026-10-30-map-inbound.md: the findings in the GM scanner.',
      '5. docs/plans/2026-09-12-block3-truth-sweep-census.md: the findings in the GM scanner (sections 4, 5, 7, 8 and 11 hold most of them).',
      '6. docs/plans/2026-10-30-recovered-review-findings.md: every standing finding about the GM scanner.',
    ].join('\n'),
  },
  {
    key: 'clients-tests', prefix: 'D', file: DIR + '/2026-10-30-causes-clients-tests.md',
    scope: [
      'Your source: the other clients and the tests. Take every finding whose fault lives in the scoreboard page (backend/public/scoreboard.html and what it loads), the web player scanner (aln-memory-scanner/), the ESP32 player scanner (arduino-cyd-player-scanner/), the config tool (config-tool/), any test layer (backend/tests/, ALNScanner/tests/), the rung-1 rig (backend/tests/rung1/), CI (.github/workflows/), or in how tests and other engines share the show machine. A finding whose fault spans these and another component is yours too; the merge joins duplicates.',
      '1. docs/plans/architecture-pass/2026-10-30-map-clients-tests.md (all sections).',
      '2. docs/plans/architecture-pass/2026-10-30-map-runtime-state.md: read section 0 first; where it disagrees with the body, section 0 wins. Take section 7 (machine sharing) and every other finding in your paths.',
      '3. docs/plans/architecture-pass/2026-10-30-map-runtime-state-check.md: its verdict table refutes or corrects map claims. A refuted claim is not a finding; a corrected one is taken in its corrected form.',
      '4. docs/plans/architecture-pass/2026-10-30-map-inbound.md: the findings in the player scanners, the ESP32, the scoreboard and the config tool.',
      '5. docs/plans/2026-10-30-recovered-review-findings.md: every standing finding about the harness, the tests or the rig.',
      '6. docs/plans/2026-09-12-block3-truth-sweep-census.md sections 9 and 10 (tests and screen capture on the store path).',
    ].join('\n'),
  },
]

const READER_SCHEMA = {
  type: 'object',
  properties: {
    sheetPath: { type: 'string' },
    sourcesRead: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' }, findingsTaken: { type: 'integer' } }, required: ['source', 'findingsTaken'] } },
    findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, localCause: { type: 'string' }, questions: { type: 'array', items: { type: 'integer' } }, status: { type: 'string', enum: ['present', 'gone', 'changed', 'not-checkable'] }, liveProof: { type: 'boolean' } }, required: ['id', 'title', 'localCause', 'questions', 'status', 'liveProof'] } },
    causes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, statement: { type: 'string' }, findingIds: { type: 'array', items: { type: 'string' } }, otherPlaces: { type: 'integer' } }, required: ['id', 'statement', 'findingIds', 'otherPlaces'] } },
  },
  required: ['sheetPath', 'sourcesRead', 'findings', 'causes'],
}

phase('Read')
const sheets = await parallel(READERS.map(r => () =>
  agent(COMMON + '\n\n' + r.scope + '\n\n' + READER_FIELDS(r.prefix, r.file), { label: 'read:' + r.key, phase: 'Read', model: 'sonnet', effort: 'high', schema: READER_SCHEMA })))
const lost = READERS.filter((r, i) => !sheets[i]).map(r => r.key)
if (lost.length) log('readers that returned nothing: ' + lost.join(', '))
const got = READERS.map((r, i) => ({ r, s: sheets[i] })).filter(x => x.s)
const sheetIds = got.flatMap(x => x.s.findings.map(f => f.id))
log('read: ' + got.map(x => x.r.key + ' ' + x.s.findings.length + ' findings / ' + x.s.causes.length + ' local causes').join('; '))

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    docPath: { type: 'string' },
    causes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, findingIds: { type: 'array', items: { type: 'string' } }, questions: { type: 'array', items: { type: 'integer' } } }, required: ['id', 'title', 'findingIds', 'questions'] } },
    setAside: { type: 'array', items: { type: 'object', properties: { findingId: { type: 'string' }, reason: { type: 'string' } }, required: ['findingId', 'reason'] } },
    liveProof: { type: 'array', items: { type: 'string' } },
  },
  required: ['docPath', 'causes', 'setAside', 'liveProof'],
}

const mergePrompt = [
  COMMON,
  '',
  'Your job: merge the readers\' finding sheets into the cause analysis. It is one of the five documents phase 1 hands over (program document section 4.2, item 2), and it is what the owner reviews at step 1: a short list of causes, each with the fixes and findings behind it. The owner then decides whether the list is right: anything missing or wrongly grouped.',
  '',
  'Inputs: the sheets ' + got.map(x => x.r.file).join(', ') + (lost.length ? ' (no sheet came back for: ' + lost.join(', ') + '; say so in the header)' : '') + '. Also docs/plans/architecture-pass/2026-10-30-map-direction.md sections 2 and 3, to name the planned capabilities each cause blocks or burdens.',
  '',
  'Do:',
  '1. Read every sheet in full.',
  '2. Group every finding by design cause across the sheets. Join local causes that are the same cause; split a local cause that mixes two. Group to the deepest shared design cause that one rule could remove. A cause with a single finding is right only when nothing else shares it. Join duplicate findings (the same fault from two readers) under one cause, keeping both ids.',
  '3. Set aside, with a one-line reason, each finding that needs no rule: gone from the current tree; a one-off slip with no other place sharing its cause, which a plain fix removes (it still goes into phase 2 as a plain fix); or outside the engine.',
  '4. For each cause, ids C1, C2 and so on: a title in plain words; the statement (what goes wrong at a show and why the design lets it, two to four sentences); the findings behind it (a table: id, what happens, source, code now, status); every other place, merged from the readers\' lists and deduplicated, each with file:line; the candidate design choices, marked "candidate, not decided", competing candidates side by side, each with the reader that proposed it; candidate proving tests; the questions (1 to 9) whose rules would remove it; live-proof marks; the planned capabilities it blocks or burdens (map-direction names, cited).',
  '5. Order the causes by how much they affect a show night, most first, with one line on why each sits where it does.',
  '',
  'Write ' + DOC + ':',
  '- Header: status "draft for the owner\'s confirmation (program document section 4.1, step 1)"; the tree; the sources; a note that a refute-by-default check runs next and its corrections land in section 6.',
  '- Section 1, the causes in short: one paragraph per cause, plain words, at most five sentences: what goes wrong at the show, why, the fixes and findings behind it (the count, and two or three named examples), the questions.',
  '- Section 2, each cause in full (the fields above).',
  '- Section 3, set aside, with reasons.',
  '- Section 4, marked for live proof: what step 2\'s rig must reproduce, as finding id, what to do, what we expect to see. Include the four the program document names in section 4.1, step 2.',
  '- Section 5, coverage: every finding id from every sheet and where it went; the count per sheet.',
  '',
  'Done when: every finding id in every sheet appears in section 5 exactly once, pointing at a cause or at section 3; every cause in section 2 has every field; section 1 has one paragraph per cause. Then return the structured summary.',
].join('\n')

phase('Merge')
let merged = await agent(mergePrompt, { label: 'merge', phase: 'Merge', model: 'fable', schema: MERGE_SCHEMA })
if (!merged) {
  log('merge on fable returned nothing; retrying on opus')
  merged = await agent(mergePrompt, { label: 'merge-retry', phase: 'Merge', model: 'opus', schema: MERGE_SCHEMA })
}
if (!merged) return { error: 'merge failed', sheets: got.map(x => x.r.file) }

const placed = new Set(merged.causes.flatMap(c => c.findingIds).concat(merged.setAside.map(s => s.findingId)))
const missing = sheetIds.filter(id => !placed.has(id))
const unknown = Array.from(placed).filter(id => !sheetIds.includes(id))
log('merge: ' + merged.causes.length + ' causes, ' + merged.setAside.length + ' set aside, ' + merged.liveProof.length + ' marked for live proof; ' + missing.length + ' sheet ids unplaced, ' + unknown.length + ' ids not in any sheet')

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    checkPath: { type: 'string' },
    counts: { type: 'object', properties: { holds: { type: 'integer' }, refuted: { type: 'integer' }, corrected: { type: 'integer' }, missed: { type: 'integer' } }, required: ['holds', 'refuted', 'corrected', 'missed'] },
    changes: { type: 'array', items: { type: 'object', properties: { target: { type: 'string' }, verdict: { type: 'string', enum: ['refuted', 'corrected'] }, oneLine: { type: 'string' } }, required: ['target', 'verdict', 'oneLine'] } },
  },
  required: ['checkPath', 'counts', 'changes'],
}

const shares = [0, 1].map(n => ({
  n: n + 1,
  causes: merged.causes.filter((c, i) => i % 2 === n).map(c => c.id),
  setAside: merged.setAside.filter((s, i) => i % 2 === n).map(s => s.findingId),
}))

const checkPrompt = s => [
  COMMON,
  '',
  'Your job: check part of the cause analysis, refute by default. The document: ' + DOC + '. The sheets it merged: ' + got.map(x => x.r.file).join(', ') + '.',
  'Your share: causes ' + (s.causes.join(', ') || 'none') + '; set-aside entries ' + (s.setAside.join(', ') || 'none') + '.',
  '',
  'For each cause in your share, test each of these claims. Default to "refuted" whenever you cannot confirm a claim from the current tree or the cited record:',
  '1. Each finding\'s code citation and status: read the file:line in the current tree.',
  '2. Each finding belongs under this cause: its fault comes from the stated design cause. When it belongs elsewhere, name where: another cause id, "new cause", or "set aside".',
  '3. Each other place: read it, and say whether it has the same design cause.',
  '4. The statement is a design cause, not the symptom restated.',
  '5. Each candidate proving test would fail on today\'s engine: trace the code path it exercises.',
  'For each set-aside entry in your share: does the reason hold? Gone: confirm in the current tree. One-off: confirm that no other place shares its cause.',
  'Record as "missed" any fault you meet while checking that no sheet recorded, with file:line.',
  '',
  'Write ' + DIR + '/2026-10-30-cause-analysis-check-' + s.n + '.md: a verdict table (target, claim, verdict holds, refuted or corrected, the correction, the evidence with file:line), then the missed faults. Return the structured summary; its "changes" list holds only the refuted and corrected rows.',
  '',
  'Done when: every claim of kinds 1 to 5 for every cause in your share, and every set-aside entry in your share, has a verdict row.',
].join('\n')

phase('Check')
const checks = await parallel(shares.map(s => () =>
  agent(checkPrompt(s), { label: 'check:' + s.n, phase: 'Check', model: 'opus', schema: CHECK_SCHEMA })))
const checkFiles = checks.map((c, i) => c ? c.checkPath : null).filter(Boolean)
if (checkFiles.length < 2) log('a checker returned nothing; the fold applies what exists and says which share went unchecked')
log('check: ' + checks.filter(Boolean).map(c => 'holds ' + c.counts.holds + ', refuted ' + c.counts.refuted + ', corrected ' + c.counts.corrected + ', missed ' + c.counts.missed).join(' | '))

const FOLD_SCHEMA = {
  type: 'object',
  properties: {
    docPath: { type: 'string' },
    causes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, findings: { type: 'integer' } }, required: ['id', 'title', 'findings'] } },
    setAside: { type: 'integer' },
    liveProof: { type: 'integer' },
    changesApplied: { type: 'integer' },
  },
  required: ['docPath', 'causes', 'setAside', 'liveProof', 'changesApplied'],
}

const unchecked = shares.filter((s, i) => !checks[i])
const foldPrompt = [
  COMMON,
  '',
  'Your job: apply the check to the cause analysis, ' + DOC + '. The check files: ' + (checkFiles.join(', ') || 'none') + '.' + (unchecked.length ? ' Unchecked shares (no checker came back): ' + unchecked.map(s => 'causes ' + s.causes.join(', ') + '; set aside ' + s.setAside.join(', ')).join(' / ') + '; say so in the header.' : ''),
  'Coverage gaps the script found by comparing ids: sheet finding ids that no cause or set-aside entry holds: ' + (missing.join(', ') || 'none') + '. Ids the merge used that no sheet holds: ' + (unknown.join(', ') || 'none') + '. The sheets: ' + got.map(x => x.r.file).join(', ') + '.',
  '',
  'Do:',
  '1. Apply every refuted and corrected verdict: remove or correct the claim; move a finding the check placed elsewhere; open a new cause only when the check shows one; set aside with the check\'s reason when it says so.',
  '2. Place every unplaced sheet id under a cause or in section 3, with a reason. Remove or explain every id that no sheet holds.',
  '3. Add each "missed" fault the checkers recorded as a finding with id X-NN, placed like the others and marked "found by the check; not swept by a reader".',
  '4. Bring section 1 in line with section 2, section 4 with the live-proof marks, and section 5 with every id.',
  '5. Add section 6, "Corrections from the check": one line per change, naming the check row it came from. Change the header status to "draft for the owner\'s confirmation; checked".',
  'Keep the plain-words standard. Change nothing the check did not touch.',
  '',
  'Done when: no refuted claim remains in the text; section 5 covers every finding id from the sheets and the check exactly once; section 6 lists every change. Then return the structured summary.',
].join('\n')

phase('Fold')
const fold = await agent(foldPrompt, { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return {
  sheets: got.map(x => ({ key: x.r.key, path: x.r.file, findings: x.s.findings.length, causes: x.s.causes.length, sources: x.s.sourcesRead })),
  lostReaders: lost,
  merge: { causes: merged.causes.length, setAside: merged.setAside.length, liveProof: merged.liveProof.length, missing, unknown },
  checks: checks.map(c => c && { path: c.checkPath, counts: c.counts }),
  fold,
}
