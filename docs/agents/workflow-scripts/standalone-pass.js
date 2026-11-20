export const meta = {
  name: 'standalone-pass',
  description: 'Decision 22: what a whole standalone game needs from each cause and candidate design, the GM scanner and both player scanners, with the ESP32 parity gap',
  phases: [
    { title: 'Read', detail: 'GM scanner standalone; player scanners standalone and the ESP32 parity gap' },
    { title: 'Merge', detail: 'one standalone line per cause, new findings placed' },
    { title: 'Check', detail: 'refute-by-default check' },
    { title: 'Fold', detail: 'apply the check; write the final lines' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const DOC = AP + '/2026-10-30-cause-analysis.md'
const CARDS = AP + '/report/2026-10-31-cause-cards.json'
const OUT_DOC = AP + '/2026-10-31-standalone-pass.md'
const OUT_LINES = AP + '/report/2026-10-31-standalone-lines.json'

const COMMON = [
  'Context: the ALN engine (a Node.js backend that runs an immersive game and drives video, music, audio and lights; GM tablets running the GM scanner; a TV scoreboard; player scanners, web and ESP32) is in its architecture pass. Step 1 produced a cause analysis of sixteen design causes: ' + DOC + ' (section 1 short list; section 2 each cause in full with candidate design choices; section 5 where every finding went). The owner-facing cards: ' + CARDS + '.',
  '',
  'The owner\'s decision 22 (2026-10-31, recorded in docs/plans/CURRENT-STATE.md section 0): standalone games join the list of capabilities every rule must serve. Yes to a whole game run with no engine, the GM scanner and the player scanners each working alone, as a choice a game can declare. No to mixed games: no game mixes networked and standalone devices. On the ESP32, the owner\'s reasoning is parity: the web and ESP32 player scanners keep feature parity wherever possible, so the ESP32\'s missing standalone mode is a parity gap. Until now the analysis treated standalone only as a source of faults, and most candidate designs assume the engine is present. Your work fills that gap.',
  '',
  'Vocabulary: CONTEXT.md section 1 ("mode", meaning 2, deployment mode), section 2 and section 4b (one truth, verdict, runtime state, authority, copy, delivery path). Use the terms as defined there. Plain words for anything the owner reads (docs/agents/process.md section 5).',
  '',
  'Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv (ALNScanner at b521774; the player scanners at their pinned commits). The top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan and /home/user/arduino-cyd-player-scanner are stale clones; read nothing there. Never open backend/.env. Write only the file you are told to write.',
  '',
  'Evidence rule: every claim cites file:line in the current tree, or the record path and section. A claim you cannot cite is left out or marked "not verified".',
].join('\n')

const PER_CAUSE = [
  'For each of the sixteen causes C1 to C16, answer:',
  '- applies: yes, partly or no: does this cause produce faults in a whole standalone game, on the devices you cover? Say why in one sentence, with a citation.',
  '- authority: in a standalone game, which device decides the fact this cause is about (for example "the GM tablet decides claims and scores").',
  '- candidate: does the analysis\'s first candidate design for this cause (section 2, "Candidate design choices", the first listed) still work when no engine is present? yes, partly or no, with one sentence.',
  '- change: if not yes, the smallest change to the candidate that would serve standalone too, in one sentence, marked "candidate, not decided".',
].join('\n')

const READ_SCHEMA = {
  type: 'object',
  properties: {
    sheet: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, cause: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'cause', 'text'] } },
    perCause: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, applies: { type: 'string' }, candidate: { type: 'string' } }, required: ['id', 'applies', 'candidate'] } },
  },
  required: ['sheet', 'findings', 'perCause'],
}

const READERS = [
  {
    key: 'gm', file: AP + '/2026-10-31-standalone-gm.md', prefix: 'SG',
    scope: [
      'Your device: the GM scanner in standalone mode (ALNScanner/src). Read first: docs/plans/architecture-pass/2026-10-30-map-gm-scanner.md section 5 (standalone mode); docs/plans/2026-07-09-phase3-1-standalone-pack-loading.md (how a standalone device gets the game); the GM-scanner findings the cause analysis already holds about standalone (search it for "standalone").',
      'Answer, with file:line:',
      '1. In a standalone game, every fact the GM sees that the tablet now decides alone: scores, claimed tokens, group completion, teams, the session and its phases (start, pause, end), pack modes and their claim behaviour, evidence shown for a detective-style exposure, the report. For each: where the standalone rule lives, and whether it is the same module the backend uses (backend/src/gameRules/) or a second copy.',
      '2. How the standalone tablet gets the game (the pack) and its updates, and what happens when the pack changes.',
      '3. What a standalone game needs that today\'s standalone mode lacks or gets wrong. Take the findings the analysis already has (cite their ids) and add any new ones you find (ids ' + 'SG-NN' + '), each assigned to the cause C1 to C16 it belongs under, or to "new cause" with a one-line reason.',
    ].join('\n'),
  },
  {
    key: 'players', file: AP + '/2026-10-31-standalone-players.md', prefix: 'SP',
    scope: [
      'Your devices: the web player scanner (aln-memory-scanner/) and the ESP32 player scanner (arduino-cyd-player-scanner/ALNScanner_v5/). Read first: each one\'s CLAUDE.md; docs/plans/architecture-pass/2026-10-30-map-clients-tests.md section 1; the root CLAUDE.md "Deployment Modes" table (it lists the ESP32 as networked only).',
      'Answer, with file:line:',
      '1. The web player scanner in standalone mode today: how the mode is chosen, where its token list and content come from (is it the active pack, or its own copy?), what it does with a scan, what the screen shows, and what it lacks for a standalone game.',
      '2. The ESP32 with no engine reachable today: boot (config validation, token sync, asset sync), where its token list and pictures and sounds come from, what happens to each scan (queue size, limits, what the player sees), video tokens, the status screen, and whether any setting turns the engine off.',
      '3. The parity gap: a table of every difference between the web scanner\'s standalone behaviour and the ESP32\'s behaviour with no engine, and for each, what the ESP32 would need to match (candidate, not decided).',
      '4. Findings: what a standalone game needs that either player scanner lacks or gets wrong; take the analysis\'s existing ids where they apply and add new ones (ids SP-NN), each assigned to a cause C1 to C16 or to "new cause" with a reason.',
    ].join('\n'),
  },
]

phase('Read')
const reads = await parallel(READERS.map(r => () => agent([
  COMMON, '', r.scope, '', PER_CAUSE, '',
  'Write your sheet to ' + r.file + ' in Markdown: header (sources, tree, date 2026-10-31); section 1, the answers above; section 2, the findings table (id, what happens in a show, citation, cause); section 3, the per-cause table (cause, applies, authority, candidate, change); section 4, the completion check (every question answered, every cause has a row, every finding cites code). Then return the structured summary.',
  'Done when: every question above is answered with citations, all sixteen causes have a row, and every new finding is assigned.',
].join('\n'), { label: 'read:' + r.key, phase: 'Read', model: 'sonnet', effort: 'high', schema: READ_SCHEMA })))
const sheets = reads.map((r, i) => r ? READERS[i].file : null).filter(Boolean)
log('read: ' + reads.filter(Boolean).map((r, i) => READERS[i].key + ' ' + r.findings.length + ' findings').join('; '))

const MERGE_SCHEMA = {
  type: 'object',
  properties: { doc: { type: 'string' }, newFindings: { type: 'integer' }, newCauses: { type: 'array', items: { type: 'string' } } },
  required: ['doc', 'newFindings', 'newCauses'],
}
phase('Merge')
const merged = await agent([
  COMMON, '',
  'Your job: merge the two standalone sheets (' + sheets.join(', ') + ') into the standalone pass document, ' + OUT_DOC + '. It will become section 7 of the cause analysis and one line on each owner-facing card.',
  '', PER_CAUSE, '',
  'Write the document in Markdown:',
  '- Header: what decision 22 asks, the sources, the tree, the date 2026-10-31, and that a refute-by-default check runs next.',
  '- Section 1, in short: five to eight plain sentences on what a whole standalone game changes for the design (who decides what, which candidate designs survive, the one or two biggest gaps).',
  '- Section 2, one entry per cause C1 to C16: applies, authority in a standalone game, whether the first candidate serves standalone, the change if not, and the line for the owner\'s card: "In a standalone game: ..." at most 45 plain words.',
  '- Section 3, the new findings (SG-NN and SP-NN), each with its cause; any finding the readers put under "new cause" gets either a home under C1 to C16 with a reason or a proposed new cause, stated as a question for the owner.',
  '- Section 4, the ESP32 parity gap table, merged from the players sheet.',
  '- Section 5, what this means for the rule design (step 3): two to five plain bullets.',
  'Then return the structured summary.',
  'Done when: all sixteen causes have every field; every finding from both sheets appears once in section 3 or in a cause entry; the parity table carries every row the players sheet had.',
].join('\n'), { label: 'merge', phase: 'Merge', model: 'fable', effort: 'high', schema: MERGE_SCHEMA })

const CHECK_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, holds: { type: 'integer' }, corrected: { type: 'integer' } },
  required: ['file', 'holds', 'corrected'],
}
phase('Check')
const check = await agent([
  COMMON, '',
  'Your job: check the standalone pass document ' + OUT_DOC + ' refute by default. Its sources: ' + sheets.join(', ') + '.',
  'For every claim in sections 1 to 5, read the cited code or record and give a verdict: holds or corrected (with the corrected text in full). Default to corrected when you cannot confirm a claim. Pay most attention to: which device the document says decides each fact in a standalone game; whether each first candidate really fails or survives without an engine; the ESP32 behaviour with no engine (read the ALNScanner_v5 headers, not only the docs); and the card lines, which the owner will read.',
  'Write ' + AP + '/2026-10-31-standalone-pass-check.md: a verdict table (claim, verdict, evidence with file:line, the corrected text). Then return the structured summary.',
  'Done when: every claim in sections 1 to 5 has a verdict.',
].join('\n'), { label: 'check', phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })

const FOLD_SCHEMA = {
  type: 'object',
  properties: { doc: { type: 'string' }, lines: { type: 'string' }, changes: { type: 'integer' } },
  required: ['doc', 'lines', 'changes'],
}
phase('Fold')
const fold = await agent([
  COMMON, '',
  'Your job: apply the check (' + (check ? check.file : 'none came back; say so in the header') + ') to the standalone pass document ' + OUT_DOC + ', then write the card lines.',
  'Do: apply every corrected verdict in place; add a final section 6, "Corrections from the check", one line per change naming its check row; change nothing the check did not touch. Then write ' + OUT_LINES + ' as valid JSON: {"lines": {"C1": "In a standalone game: ...", ..., "C16": "..."}, "newFindings": [{"id": "...", "cause": "...", "text": "..."}]}, the lines taken from section 2 after the corrections, each at most 45 plain words.',
  'Return the structured summary.',
  'Done when: no corrected claim remains uncorrected in the document, and the JSON parses and holds all sixteen lines.',
].join('\n'), { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return { sheets, reads: reads.map(r => r && { findings: r.findings.length }), merged, check, fold }
