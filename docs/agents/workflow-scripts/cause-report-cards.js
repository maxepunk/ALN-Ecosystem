export const meta = {
  name: 'cause-report-cards',
  description: 'Draft, check and fold one visual card per cause (before/after diagrams) for the owner-facing cause report',
  phases: [
    { title: 'Draft', detail: 'four drafters, four causes each' },
    { title: 'Check', detail: 'two refute-by-default checkers, eight cards each' },
    { title: 'Fold', detail: 'apply the checks and write the final cards file' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const DOC = ROOT + '/docs/plans/architecture-pass/2026-10-30-cause-analysis.md'
const OUT = ROOT + '/docs/plans/architecture-pass/report'
const SKILL = '/root/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering'
const LINES = { C1: '55-102', C2: '103-138', C3: '139-190', C4: '191-246', C5: '247-280', C6: '281-320', C7: '321-366', C8: '367-431', C9: '432-480', C10: '481-531', C11: '532-594', C12: '595-641', C13: '642-687', C14: '688-751', C15: '752-793', C16: '794-842' }
const GROUPS = [
  { n: 1, causes: ['C1', 'C4', 'C6', 'C7'] },
  { n: 2, causes: ['C5', 'C9', 'C10', 'C12'] },
  { n: 3, causes: ['C2', 'C3', 'C8', 'C11'] },
  { n: 4, causes: ['C13', 'C14', 'C15', 'C16'] },
]

const COMMON = [
  'Context: the ALN engine (an immersive-game show engine: a Node.js backend that runs the game and drives VLC, music, audio and lighting; GM tablets; a TV scoreboard; player scanners) is in its architecture pass. Step 1 produced a cause analysis: ' + DOC + '. Its section 1 is a short list of sixteen causes; section 2 has each cause in full, with code citations; section 5 lists every finding id and where it went. The owner, the show\'s producer, reads like a product manager and found the list too dense to judge. A visual report will carry it: one card per cause, built the way the improve-codebase-architecture skill builds its report (' + SKILL + '/improve-codebase-architecture/HTML-REPORT.md, sections "Candidate card" and "Diagram patterns"): diagrams carry the weight, prose is sparse.',
  '',
  'Vocabulary. For the plain-words fields, use the project\'s own terms from CONTEXT.md sections 2 and 4b (one truth, verdict, runtime state, authority, copy, delivery path) only where they help, and otherwise everyday words; no finding ids, file names or internal codes in those fields (docs/agents/process.md section 5). For the design-terms field, use the codebase-design vocabulary exactly as defined in ' + SKILL + '/codebase-design/SKILL.md: module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.',
  '',
  'Where you work: only under /home/user/ALN-Ecosystem/, on branch claude/nice-curie-hescfv (code as of 12baf920 plus green\'s follow-ups merged at 089dd527; ALNScanner at e83723c). The top-level /home/user/ALNScanner and /home/user/ALN-TokenData are stale clones; read nothing there. Never open backend/.env. Write only the file you are told to write.',
  '',
  'Ground rule: every card says only what the cause analysis says, and every diagram shows a mechanism the cited code has. The "after" diagram shows a candidate design choice that the cause analysis itself lists for that cause, marked as a candidate; never invent one. Where the analysis lists competing candidates, draw the first and name the other in the note.',
].join('\n')

const CARD_SPEC = [
  'Card fields (JSON), for each cause:',
  '- "id": the cause id, e.g. "C1".',
  '- "title": the cause in plain words, at most 9 words.',
  '- "atAShow": what happens during a show, at most 70 words, one or two concrete moments from the analysis.',
  '- "whyItHappens": the design reason in plain words, at most 50 words.',
  '- "designTerms": the same reason in codebase-design vocabulary, at most 45 words; name the module that should own the fact, and say where the seam leaks or which module is shallow.',
  '- "modules": up to 6 repository paths of the modules involved, from the analysis\'s citations.',
  '- "before": {"caption": "Today", "mermaid": source}: the mechanism that lets the fault happen, as the code has it.',
  '- "after": {"caption": "Candidate, not decided", "mermaid": source, "note": at most 35 words naming the candidate, and the competing one if any}.',
  '- "examples": 3 to 6 objects {"ids": the finding ids as the analysis writes them, e.g. "A-05 / C-04", "text": at most 22 words}; each id must be placed under this cause in section 5.',
  '- "blueFixes": blue\'s fix packages behind this cause as the analysis names them, e.g. ["W1"]; [] if none.',
  '- "questions": the question numbers the analysis gives in section 1; [] when it says no question covers the cause.',
  '- "findings": the cause\'s finding count from section 5.6.',
  '- "seenLive": "" or at most 20 words on where a finding of this cause was seen on running software (the analysis or blue\'s records say so).',
  '',
  'Mermaid rules (the page renders Mermaid natively; a syntax error blanks the diagram):',
  '- First line exactly one of: flowchart LR, flowchart TD, sequenceDiagram.',
  '- Flowchart node ids are letters and digits only. Every node label is in double quotes inside its brackets, e.g. tabA["Tablet A<br/>own claimed list"]. No double quote, semicolon or # inside a label. Line breaks only as <br/>. Never use the bare word end, graph or class as an id.',
  '- Edges: A -->|"label"| B, or dotted A -.->|"label"| B. Edge labels in double quotes.',
  '- Mark where the fault happens with: classDef fault stroke:#dc2626,stroke-width:3px; on its own line, then class X,Y fault; on its own line. In the after diagram, mark the one module that owns the fact with: classDef owner stroke:#0f766e,stroke-width:3px; then class Z owner;. Use no other styling.',
  '- sequenceDiagram: declare participants as participant T as Tablet. Messages T->>B: text. A message that never arrives or is ignored: T--xB: text. Notes: Note over T: text. No semicolons or # in text.',
  '- At most 8 nodes or 8 messages per diagram; labels at most 5 words per line and 2 lines.',
  '- Both diagrams of a card use the same names for the same things, so the reader sees what changed.',
].join('\n')

const DRAFT_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, cards: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } }, required: ['id', 'title'] } } },
  required: ['file', 'cards'],
}

phase('Draft')
const drafts = await parallel(GROUPS.map(g => () => agent([
  COMMON, '',
  'Your causes: ' + g.causes.join(', ') + '. Read each one\'s paragraph in section 1 and its full section 2 entry (lines ' + g.causes.map(c => c + ' ' + LINES[c]).join(', ') + ' of the analysis), and check section 5 for the ids you use. Open the cited code wherever you need it to draw the "before" diagram truly.',
  '', CARD_SPEC, '',
  'Write {"cards": [...]} as valid JSON (two-space indent) to ' + OUT + '/2026-10-31-cards-g' + g.n + '.json, in the order given. Then return the structured summary.',
  'Done when: every one of your causes has every field filled within its limits, every Mermaid source follows the rules above, and the file parses as JSON.',
].join('\n'), { label: 'draft:g' + g.n, phase: 'Draft', model: 'fable', effort: 'high', schema: DRAFT_SCHEMA })))
const drafted = drafts.map((d, i) => d ? OUT + '/2026-10-31-cards-g' + GROUPS[i].n + '.json' : null).filter(Boolean)
log('drafted: ' + drafts.filter(Boolean).map(d => d.cards.map(c => c.id).join(' ')).join(' | '))

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    counts: { type: 'object', properties: { holds: { type: 'integer' }, corrected: { type: 'integer' } }, required: ['holds', 'corrected'] },
  },
  required: ['file', 'counts'],
}
const shares = [['C1', 'C4', 'C6', 'C7', 'C5', 'C9', 'C10', 'C12'], ['C2', 'C3', 'C8', 'C11', 'C13', 'C14', 'C15', 'C16']]
phase('Check')
const checks = await parallel(shares.map((s, i) => () => agent([
  COMMON, '',
  'Your job: check the drafted cards for causes ' + s.join(', ') + ', refute by default. The drafts: ' + drafted.join(', ') + ' (each holds four cards). The analysis: ' + DOC + ' (section 2 line ranges: ' + s.map(c => c + ' ' + LINES[c]).join(', ') + ').',
  '', CARD_SPEC, '',
  'For each card, test every claim and default to "corrected" when you cannot confirm it:',
  '1. atAShow and whyItHappens say only what the analysis says for this cause.',
  '2. The before diagram shows the mechanism the cited code has: open the code and check the boxes and arrows (cite file:line).',
  '3. The after diagram is a candidate the analysis lists for this cause, marked as a candidate, with the competing one named if the analysis has one.',
  '4. designTerms uses the codebase-design vocabulary correctly and names the owning module.',
  '5. Every example id sits under this cause in section 5; findings, blueFixes and questions match sections 1, 2 and 5.6.',
  '6. Both Mermaid sources follow the rules above.',
  'For each claim that fails, write the corrected field value in full.',
  '',
  'Write ' + OUT + '/2026-10-31-cards-check-' + (i + 1) + '.md: one section per card, with a verdict table (claim, holds or corrected, evidence with file:line) and, for each corrected field, the full replacement value in a fenced block labelled with the field name. Then return the structured summary.',
  'Done when: every card in your share has a verdict for each of the six claims.',
].join('\n'), { label: 'check:' + (i + 1), phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA })))
log('check: ' + checks.filter(Boolean).map(c => 'holds ' + c.counts.holds + ', corrected ' + c.counts.corrected).join(' | '))

const FOLD_SCHEMA = {
  type: 'object',
  properties: { file: { type: 'string' }, cards: { type: 'integer' }, changesApplied: { type: 'integer' }, order: { type: 'array', items: { type: 'string' } } },
  required: ['file', 'cards', 'changesApplied', 'order'],
}
phase('Fold')
const fold = await agent([
  COMMON, '',
  'Your job: apply the two check files to the drafted cards and write the final cards file. Drafts: ' + drafted.join(', ') + '. Checks: ' + checks.filter(Boolean).map(c => c.file).join(', ') + '.',
  '', CARD_SPEC, '',
  'Do: take every corrected field\'s replacement value from the checks; keep every field that holds; re-read the Mermaid rules and fix any source that breaks them; keep every field within its limits. Then write {"cards": [...]} with all sixteen cards in id order C1 to C16, as valid JSON (two-space indent), to ' + OUT + '/2026-10-31-cause-cards.json. Return the structured summary.',
  'Done when: the file parses as JSON, holds sixteen cards with every field, and every corrected value from the checks is in it.',
].join('\n'), { label: 'fold', phase: 'Fold', model: 'fable', effort: 'high', schema: FOLD_SCHEMA })

return { drafted, checks: checks.map(c => c && c.counts), fold }
