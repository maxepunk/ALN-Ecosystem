export const meta = {
  name: 'redteam-brief',
  description: 'Pre-build red team on one implementer brief (R26): two attack lenses, one refuter per finding, a written report',
  phases: [
    { title: 'Attack', detail: 'two lenses: the real tree; doctrine and show night' },
    { title: 'Refute', detail: 'one independent refuter per finding' },
    { title: 'Write', detail: 'the report: standing findings first, each with its brief edit' },
  ],
}

const A = args // { lane, tree, brief, factsheet, pins, scope, report, head }
const SPEC = A.tree + '/docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md'
const PLAN = A.tree + '/docs/plans/2026-09-12-block2-hardening-plan.md'
const CONTEXT = A.tree + '/CONTEXT.md'

const WORK = `Work only under ${A.tree}/ (a checkout of the designated branch at ${A.head}, submodules at their pins; cite every claim as file:line on THIS tree). The top-level /home/user/ALNScanner and /home/user/ALN-TokenData directories are stale clones: never read them. Read-only: change nothing under the tree; never run a git write command. Dispatch no subagents. Vocabulary by reference: ${CONTEXT} §2 (one truth, the gate), §4 (dormant vs fault, alarm integrity, status with verbs, held item, supervisor = how not whether), §5 (endpoints vs stack, preflight, paper vs live, self-heal, remote display) — use those words as defined there.`

const AUTHORITIES = `Authorities, in order: (1) the ratified design ${SPEC} §8 (normative), §5 (adjudications), §6; (2) ${CONTEXT}; (3) the plan ${PLAN}: §1 rulings R1–R27 (later rulings supersede earlier ones where they say so), §3 pins ${A.pins}, §6 global constraints; (4) the fact sheet ${A.factsheet} (its Conclusions section is the census the brief was written from); (5) the tree itself, which wins over every document about it.`

const FINDING = { type: 'object', properties: {
  id: { type: 'string' }, severity: { type: 'string', enum: ['blocking', 'should-fix', 'note'] },
  where: { type: 'string', description: 'brief section or line, plus the tree file:line it conflicts with' },
  claim: { type: 'string' }, effect: { type: 'string', description: 'what the implementer builds wrong, or what breaks on show night' },
  fix: { type: 'string', description: 'the exact edit to the brief that resolves it' } },
  required: ['id', 'severity', 'where', 'claim', 'effect', 'fix'] }
const ATTACK_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: FINDING }, held: { type: 'array', items: { type: 'string' }, description: 'attack paths that held, each with the evidence' }, notes: { type: 'string' } }, required: ['findings', 'held', 'notes'] }
const REFUTE_SCHEMA = { type: 'object', properties: { refuted: { type: 'boolean' }, why: { type: 'string' }, evidence: { type: 'string' }, severityIfStands: { type: 'string', enum: ['blocking', 'should-fix', 'note'] }, fixIfStands: { type: 'string' } }, required: ['refuted', 'why', 'evidence', 'severityIfStands', 'fixIfStands'] }

const LENSES = [
  { id: 'tree', prompt: `Lens: THE REAL TREE. The brief was written from a fact sheet taken before later merges (the dormancy core's follow-ups, the harness minimum: per-worker data and log directories in tests/e2e/setup/test-server.js, the logger guard). Attack every concrete claim: every file:line the brief cites (does it still hold at HEAD; what moved); every function, helper, signature, option, event, test file and test line it names (exists as named; the arity and the return shape it assumes); every "exact value" (consistent with itself, with the pins, with the contracts on the tree); every deliverable (buildable as written with no hidden decision left to the implementer; name each decision the brief leaves open that two implementers would settle differently); every proof-run command (runs on this tree: the scripts and legs exist; the env vars are the ones the harness reads); every "leave untouched" instruction that a deliverable forces the implementer to break; every test the brief specifies (would it pass against a WRONG build, i.e. is it vacuous; does its RED shape actually go red). Run a grep or a focused read for each claim; a finding without a tree citation is not a finding.` },
  { id: 'doctrine', prompt: `Lens: DOCTRINE AND SHOW NIGHT. Attack the mechanisms, not the typos. For each mechanism the brief specifies: does it keep the ratified rulings (${SPEC} §8 and §5) and the vocabulary's rules (one truth; alarm integrity; dormant vs fault; status with verbs; the supervisor decides how, never whether; endpoints vs stack; paper vs live)? Walk show night with the brief built EXACTLY as written: boot, the GM's first connection, a restart of the orchestrator mid-game, a reconnect, the override, the remote display and the TV display, a second tablet; name every place the built system would tell the GM something false, hide a failure, or refuse a legitimate action. Parity: every wire change has both sides (backend, contracts, scanner, the E2E helpers) named in the brief with a test; name each side it misses. Ambiguity: every sentence an implementer could read two ways, with the two builds it yields. Scope: anything the brief mandates that contradicts a plan pin or a ruling R1–R27 (later rulings win), and anything a pin mandates that the brief drops silently. Debt: every temporary construct without a ledger row.` },
]

function attackPrompt(lens) {
  return `You are a red-team reviewer attacking an implementer brief BEFORE any code is written, for the ${A.lane} lane of the hardening block of ALN-Ecosystem. Your job is to break the brief: find what would make an implementer who follows it exactly build the wrong thing, fail on the real tree, or contradict the ratified design. The brief: ${A.brief} (read it in full). Scope of the change it specifies: ${A.scope}. ${AUTHORITIES} ${WORK}

${lens.prompt}

Findings: one per defect; severity blocking (the build would be wrong or would not build), should-fix (a real gap the implementer would have to guess at), note (a precision). Each carries where (brief section plus the tree file:line), the claim, the effect, and the exact fix to the brief. Also list every attack path that held, with its evidence, so the record shows coverage. Your final answer is the structured object only.`
}

function refutePrompt(f) {
  return `You are an independent refuter for one red-team finding on the ${A.lane} implementer brief ${A.brief} of ALN-Ecosystem. Try to REFUTE it: show it is wrong on the tree, already handled by the brief or a plan pin or ruling, out of the brief's scope by design, or not the severity claimed. Default to refuted=false only when the evidence clearly supports the finding. ${AUTHORITIES} ${WORK} Re-verify every file:line the finding cites yourself. The finding: ${JSON.stringify(f)}. If it stands, give its severity and the exact brief edit. Your final answer is the structured object only.`
}

function writePrompt(standing, refuted, held) {
  return `You write the report of the pre-build red team on the ${A.lane} implementer brief (${A.brief}) of ALN-Ecosystem. Write exactly one file: ${A.report} (create it; the directory is git-ignored scratch). Structure: "## Conclusions (at most 30 lines)" — the standing findings first, one line each: id, severity, where, the fix; then a counts line (found, refuted, standing). Then "## Standing findings" with each finding's full text and its refuter's note. Then "## Refuted findings" (each with the refutation). Then "## Coverage": the attack paths that held, per lens. Plain language, short sentences, no headers beyond these four. Data: STANDING=${JSON.stringify(standing)} REFUTED=${JSON.stringify(refuted)} HELD=${JSON.stringify(held)}. Your final answer is one line: the path written and the counts.`
}

phase('Attack')
const attacks = await parallel(LENSES.map(l => () => agent(attackPrompt(l), { label: `attack:${l.id}`, phase: 'Attack', model: 'opus', effort: 'high', agentType: 'general-purpose', schema: ATTACK_SCHEMA }).then(r => r && Object.assign(r, { lens: l.id }))))
const got = attacks.filter(Boolean)
const findings = got.flatMap(r => r.findings.map(f => Object.assign({}, f, { id: `${r.lens}-${f.id}`, lens: r.lens })))
const held = got.flatMap(r => r.held.map(h => `[${r.lens}] ${h}`))
log(`attack: ${findings.length} findings (${got.length}/${LENSES.length} lenses returned), ${held.length} paths held`)

phase('Refute')
const verdicts = await parallel(findings.map(f => () => agent(refutePrompt(f), { label: `refute:${f.id}`, phase: 'Refute', model: 'opus', agentType: 'general-purpose', schema: REFUTE_SCHEMA })))
const standing = [], refuted = []
for (let i = 0; i < findings.length; i++) {
  const f = findings[i]; const v = verdicts[i] || { refuted: false, why: 'refuter lost', evidence: '', severityIfStands: f.severity, fixIfStands: f.fix }
  const e = Object.assign({}, f, { refuter: v })
  if (v.refuted) refuted.push(e); else standing.push(Object.assign(e, { severity: v.severityIfStands, fix: v.fixIfStands || f.fix }))
}
log(`refute: ${standing.length} standing, ${refuted.length} refuted`)

phase('Write')
const written = await agent(writePrompt(standing, refuted, held), { label: 'writer', phase: 'Write', model: 'sonnet', agentType: 'general-purpose' })
return { stage: 'done', lane: A.lane, head: A.head, standing, refutedCount: refuted.length, heldCount: held.length, written, lensesReturned: got.length }
