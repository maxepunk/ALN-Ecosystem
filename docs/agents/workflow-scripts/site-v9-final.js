export const meta = {
  name: 'site-v9-final',
  description: "Settle the last conflicts of the owner site version 9 with the lead agent's rulings, rebuild, then one refute-by-default reader confirms every changed line",
  phases: [
    { title: 'Apply', detail: 'one editor settles the second verification round' },
    { title: 'Verify', detail: 'one refute-by-default reader reads every changed line' },
  ],
}

// args.base: the commit before this round (the reader diffs against it).
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const SITE = RP + '/site'
const OUT = SITE + '/v9'
const CHECKS = SITE + '/checks'
const REQ = AP + '/requirements'
const PLAN2 = SITE + '/2026-11-01-site-plan-v2.md'
const REC = AP + '/DECISIONS.md'
const JT = CHECKS + '/jargon-table.md'
const ROADMAP = ROOT + '/docs/plans/ROADMAP.md'
const BRIEF = AP + '/panel/2026-11-01-panel-brief.md'
const SCRATCH = '/tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad'
const MERMAID_JS = SCRATCH + '/mermaid-pkg/node_modules/mermaid/dist/mermaid.min.js'
const BASE = args && args.base ? args.base : 'HEAD'

const COMMON = `Context. The owner of the ALN show engine (the game's producer and designer, not an engineer) is redesigning the engine for the long term. Their site "What the Engine Promises", version 9, is six linked pages built into ${SITE}/ by ${RP}/build_site.py from the plan ${PLAN2}. Its sources: the overlays in ${OUT} (front.json, decisions.json, design.json, changes.json, rules.json), the requirements ${REQ}/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json, the page data in ${RP} (2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json, 2026-10-31-standalone-lines.json, 2026-11-01-engine-shape.json), the decision record ${REC}, the roadmap ${ROADMAP}, the panel's brief ${BRIEF} and the jargon table ${JT}. The pages have been through page checks, a fix round and a second verification (${CHECKS}/v9-verify-2a.md and ${CHECKS}/v9-verify-2b.md list what is left).

The rules: the earlier 17-part candidate is "the earlier candidate", one input among the panel's, never current or decided; decisions by their record titles, with "to be confirmed" readings never shown as settled; no visible id, no question letter off the Decisions page, no numbered lists of decisions, steps or choices, no bare phase, step, block, round, decision or question number outside the change log; the jargon table's wordings and no metaphors; plain, short, active sentences; no em dashes; facts match their sources. A title dropped bare into a sentence is quoted with typographic quotes (“ ”), the quotes outside any [[marker]], or the sentence is reworded so it reads naturally.

Where you work: only under ${ROOT}, branch claude/nice-curie-hescfv. Read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Do not commit.`

const RULINGS = `The lead agent's rulings (follow them):
1. "You" and "the owner". The site's own prose addresses the owner as "you": the overlays (front.json, decisions.json, design.json, changes.json, apart from past-tense history and quoted earlier wordings on the change log), the builder's own texts, and the requirements' status lines (already done). "The owner" stays as a role name in the shared texts the independent panel will also read: the requirements files' situation, case, numberToSet and why fields, the standing rules (rules.json), the promise data (2026-10-31-engine-jobs.json), the cards (2026-10-31-cause-cards.json, 2026-10-31-standalone-lines.json) and the earlier candidate (2026-11-01-engine-shape.json). So in v9-verify-2b row 1, change only what sits in the overlays or the builder's texts, and record the rest as kept by this ruling. Titles that contain "the owner" stay as titles.
2. "Door" is a metaphor: replace it with plain words everywhere it appears in the earlier candidate, as v9-verify-2b row 7 lists (the builder's constants and the shape data), and in the words box if it defines "door".
3. Everything else in both files: apply as the verifier words it, after checking the source it names.`

const APPLY_SCHEMA = { type: 'object', properties: { log: { type: 'string' }, applied: { type: 'integer' }, rejected: { type: 'integer' }, buildPassed: { type: 'boolean' }, smokePassed: { type: 'boolean' }, notes: { type: 'array', items: { type: 'string' } } }, required: ['log', 'applied', 'rejected', 'buildPassed', 'smokePassed', 'notes'] }
const VERIFY_SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, slips: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'slips', 'keyPoints'] }

phase('Apply')
const apply = await agent(`${COMMON}

${RULINGS}

Your task: settle every conflict in ${CHECKS}/v9-verify-2a.md and ${CHECKS}/v9-verify-2b.md with the rulings above; rebuild; smoke-test.

- Verify each conflict against its source before changing anything; apply it, or reject it with a reason.
- Edit only the overlays in ${OUT}, the two requirements files, the four data files and ${RP}/build_site.py. When you change a fact in a data or requirements file, change it where its source document states it too. Keep every JSON valid and its layout: edit text in place, never re-dump a file.
- Rebuild: cd ${RP} && MERMAID_JS=${MERMAID_JS} python3 -I build_site.py (its checks must pass). Smoke: node ${RP}/site_smoke.js ${SITE} ${SCRATCH}/site-shots-v9 (24 loads must pass).
- Write ${CHECKS}/v9-apply-log-3.md: one row per conflict (its verify file and row, applied, kept by a ruling or rejected, the change or the reason, the source), then the build and smoke results.

Return the log, how many you applied and rejected (count rows kept by ruling 1 as rejected, and say so in a note), whether the build and smoke passed, and a note per rejection.

Done when: every conflict of both files is settled, the build's checks pass and the smoke test passes.`, { label: 'apply:round3', phase: 'Apply', effort: 'high', schema: APPLY_SCHEMA })

phase('Verify')
const verify = await agent(`${COMMON}

${RULINGS}

The rows settled in this round: every conflict in ${CHECKS}/v9-verify-2a.md and ${CHECKS}/v9-verify-2b.md, as ${CHECKS}/v9-apply-log-3.md records them. The changes this round: git -C ${ROOT} diff ${BASE} -- docs/plans/architecture-pass/ (the overlays, requirements, data and builder) and the rebuilt pages in ${SITE}.

Refute by default. For each row, read the rebuilt page where it lands and say resolved, partly or unresolved; for a rejection or a row kept by ruling 1, say whether the reason holds. Then read every line this round changed, as it now reads on its page, and list any slip the change made (a broken sentence, a wrong fact, a rule broken), with where, what it says, what it should say and the exact place to change it. Do not reopen lines this round did not touch.

Write ${CHECKS}/v9-final-verify.md: a short header, the verdict table, the slips table, then what you found right. Return the file, the counts (resolved, partly, unresolved, slips), and five key points.

Done when: every row has a verdict and every changed line has been read on its page.`, { label: 'verify:final', phase: 'Verify', model: 'opus', effort: 'high', schema: VERIFY_SCHEMA })
log('final round: applied ' + (apply ? apply.applied : '?') + ', rejected ' + (apply ? apply.rejected : '?') + '; verify: ' + (verify ? `${verify.resolved} resolved, ${verify.partly} partly, ${verify.unresolved} unresolved, ${verify.slips} slips` : '?'))
return { apply, verify }
