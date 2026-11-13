export const meta = {
  name: 'requirements-drafts',
  description: "Draft the two missing requirements for the engine (quality targets as testable situations; the ways the platform must be extended, and by whom) from the owner's decisions and the roadmap; check each refute-by-default; correct",
  phases: [
    { title: 'Write', detail: 'one writer for quality targets, one for extension cases' },
    { title: 'Check', detail: 'one refute-by-default checker each' },
    { title: 'Apply', detail: 'each draft corrected from its check' },
  ],
}

const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const OUT = AP + '/requirements'

const COMMON = `Context. The owner is redesigning the ALN show engine for the long term. Their goal, in their words (2026-11-01): "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)", not "fixing issues seen / fixed on blue to run ALN (reactive)". Decisions 26 and 31 (${ROOT}/docs/plans/CURRENT-STATE.md section 0) set that frame: today's problems are clues and test cases, never the driver. Decision 31 adds two requirements the engine's design must meet, which do not exist yet and which you draft now: quality targets written as testable situations, and the ways the platform must be extended, and by whom. The owner confirms them; an independent panel of architects will then design against them, so they must say what is needed, never how to build it.

What is already settled and must be honoured (read these):
- The ten promises: what each person can count on, when: ${RP}/2026-10-31-engine-jobs.json (each promise's functional.proposedTitle, people, moment, need, and its goal and needs).
- The platform's final outcome and its standing constraints: ${ROOT}/docs/plans/ROADMAP.md sections 1 and 2 (privacy defaults 2.1, growth without corners 2.2, the media model 2.3, the design-iteration loop 2.4, platform parity 2.5, the engine holds no opinion 2.6), the readiness ladder (section 3), the later blocks (section 7) and the deferral registry (section 8).
- The owner's decisions 20 to 32 (CURRENT-STATE.md section 0), decision 22 (standalone games) and decision 28 (the after-game article: ${AP}/2026-11-01-after-game-report.md).
- The glossary: ${ROOT}/CONTEXT.md (simulation is a venue profile; the environment ladder; the capability catalog; the tech rider; Review and the director; the production stages Author, Rehearse, Run, Review).
- The planned capabilities: ${AP}/2026-10-30-map-direction.md (52 capabilities, each by name).

How to write: plain, short, active sentences, written for the owner, who is the game's producer and designer, not an engineer; no metaphors; no em dashes; no internal codes (no promise numbers, capability numbers, step or phase or block numbers, finding ids); the plain wordings in ${RP}/site/checks/jargon-table.md where a term appears there. Name a promise by its exact title. Every item names its source (file and section or line) in the log; nothing invented. Where a number would make a target testable but no source gives one, write the situation without the number and add "number to set: <what>" so the owner sets it.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit. Write only the files your task names.`

const TASKS = [
  {
    key: 'quality', file: OUT + '/2026-11-01-quality-targets.json', log: OUT + '/2026-11-01-quality-targets-log.md',
    write: `Your task: draft the quality targets. Write ${OUT}/2026-11-01-quality-targets.json: {"intro": "two or three sentences", "targets": [{"id": "QT1", "quality": "the quality's plain name", "situation": "a situation at a show, in rehearsal, at the desk or in development, told so it can be tested: what happens, then what must be true", "numberToSet": "what the owner must set, or an empty string", "promises": ["exact titles this target serves"], "status": "settled by the owner (say which decision or roadmap section) | proposed", "why": "one sentence: why it matters for the long term"}]}.

Cover at least these qualities, each with one to four targets: staying up through a live show (restarts, outages, weak network); every screen telling the truth (age, certainty, absence on purpose); the designer's iteration speed; operating it without technical help (venue technician, GM, director); easy to understand and change for the people and the AI agents who develop it (one place for each decision, small clear interfaces, documented for both); easy to extend (new games, devices, outside programs, screens) without changing the engine where a pack, a profile or a published interface can do it; testable without the live show (every part provable with stand-ins, two games); privacy and access (the privacy defaults; who may do what); running well on the show machine and the venue network at the size of a show (number to set where no source gives one); standalone and offline (decision 22). Add any other quality the sources demand.

Write ${OUT}/2026-11-01-quality-targets-log.md: each target's sources.

Done when: every quality above has at least one testable target, every promise is served by at least one target, every target has a source or is marked proposed, and the log names each source.`,
    check: `Check ${OUT}/2026-11-01-quality-targets.json against its sources. Refute by default: a target that is not testable as written; a number given that no source supports; a target marked settled that no decision or roadmap section settles; a target that says how to build instead of what must be true; a promise served by no target; a quality from the list missing; a misquoted promise title; jargon, internal codes, metaphors or em dashes; anything that contradicts a decision or the roadmap's constraints.`,
  },
  {
    key: 'extension', file: OUT + '/2026-11-01-extension-cases.json', log: OUT + '/2026-11-01-extension-cases-log.md',
    write: `Your task: draft the ways the platform must be extended, and by whom. Write ${OUT}/2026-11-01-extension-cases.json: {"intro": "two or three sentences", "cases": [{"id": "EX1", "who": "the person who extends it: designer, venue technician, operator, developer, game author, director", "case": "what they add or change, told as a situation", "throughWhat": "what they should need to touch: a pack, a venue profile, a published interface, a module of the game's own, or the engine's code", "mustNotNeed": "what must stay untouched, for example the engine's code or another game's pack", "when": "now | a planned block (name it) | later (name the roadmap section)", "promises": ["exact titles"], "status": "settled by the owner (decision or roadmap section) | proposed", "why": "one sentence"}]}.

Cover at least: a new game as a pack; a new scoring rule or mode; new content and new media; a new screen or display surface; a new kind of player device and a new interaction (players' phones); a new outside program the engine drives (another video player, another lighting system); a new venue and its equipment; a second kit or another operator; a new source of game content besides Notion; a game's own after-game telling reading the night's record (decision 28); the second game's own modules (ROADMAP section 7.2); a developer from outside the team building on the open-source platform. Add any case the sources demand.

Write ${OUT}/2026-11-01-extension-cases-log.md: each case's sources.

Done when: every case above is covered, every case says what it should need and what it must not need, every case has a source or is marked proposed, and the log names each source.`,
    check: `Check ${OUT}/2026-11-01-extension-cases.json against its sources. Refute by default: a case the sources demand that is missing; a "throughWhat" or "mustNotNeed" that contradicts a decision or the roadmap (for example media inside packs, player accounts, person-level identity as an engine default); a case marked settled that no decision or roadmap section settles; a case that says how to build instead of what must be possible; a wrong "when"; a misquoted promise title; jargon, internal codes, metaphors or em dashes.`,
  },
]

const WRITE_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, log: { type: 'string' }, items: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'log', 'items', 'keyPoints'] }
const CHECK_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'keyPoints'] }
const APPLY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['file', 'applied', 'rejected', 'notes'] }

const results = await pipeline(
  TASKS,
  (t) => agent(`${COMMON}\n\n${t.write}\n\nReturn the file, its log, how many items you wrote, and five key points.`, { label: 'write:' + t.key, phase: 'Write', model: 'fable', effort: 'high', schema: WRITE_SCHEMA }),
  (w, t) => w ? agent(`${COMMON}\n\n${t.check}\n\nWrite ${OUT}/check-${t.key}.md: a short header, the conflicts table (where, what it says, what it should say, the source), then what you checked and found right. Return the file, the number of conflicts, how many items you checked, and five key points.\n\nDone when: every item has been read against its sources and the counts match your table.`, { label: 'check:' + t.key, phase: 'Check', model: 'opus', effort: 'high', schema: CHECK_SCHEMA }).then(c => ({ w, c })) : null,
  (wc, t) => {
    if (!wc || !wc.c) return wc
    if (wc.c.conflicts === 0) return { ...wc, a: { file: t.file, applied: 0, rejected: 0, notes: ['no conflicts'] } }
    return agent(`${COMMON}\n\nYour task: apply the check ${wc.c.file} to ${t.file} and record each change in ${t.log}. Verify each conflict against its source first; apply it, or reject it with a reason. Keep the JSON valid. Return the file, how many you applied and rejected, and a note per rejection.\n\nDone when: every row of the check is applied or rejected with a reason.`, { label: 'apply:' + t.key, phase: 'Apply', model: 'fable', effort: 'high', schema: APPLY_SCHEMA }).then(a => ({ ...wc, a }))
  },
)
log('requirements drafts: ' + results.filter(Boolean).map((r, i) => `${TASKS[i].key}: ${r.w ? r.w.items : '?'} items, ${r.c ? r.c.conflicts : '?'} conflicts, ${r.a ? r.a.applied : '?'} applied`).join('; '))
return results