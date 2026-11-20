export const meta = {
  name: 'lane-build',
  description: 'Build one lane from its brief: per task an implementer, a task review and a bounded fix loop; a whole-lane review when the lane has several tasks; then a hostile tester with one refuter per finding',
  phases: [
    { title: 'Implement', detail: 'one implementer per task, from the brief' },
    { title: 'Review', detail: 'task review: spec compliance and quality' },
    { title: 'Fix', detail: 'up to three rounds per task: fix + scoped re-review' },
    { title: 'Lane review', detail: 'whole-lane review when the lane has several tasks' },
    { title: 'Attack', detail: 'hostile tester with experiments in the scratchpad' },
    { title: 'Refute', detail: 'one refuter per hostile finding' },
  ],
}

const A = args // { lane, tree, branch, base, brief, report, precisions, tasks: [{id, title, section}], scanner, claims, attacks, scratchpad }
const REPO = '/home/user/ALN-Ecosystem'
const PLAN = A.tree + '/docs/plans/2026-09-12-block2-hardening-plan.md'
const SCANNER_NOTE = A.scanner ? ` The ALNScanner submodule at ${A.tree}/ALNScanner is on branch ${A.branch} too (confirm with git -C ${A.tree}/ALNScanner branch --show-current): commit scanner changes there first, then commit the updated submodule pin in the parent; the nested data submodule stays at its pin.` : ''
const WORKDIR = `Work only under ${A.tree}/ (branch ${A.branch}; confirm with git -C ${A.tree} branch --show-current before the first edit).${SCANNER_NOTE} The top-level /home/user/ALNScanner and /home/user/ALN-TokenData directories are stale clones: never read them; other worktrees under ${REPO}/.worktrees/ belong to other lanes: never read or write them. Push nothing. Dispatch no subagents. The rig's shared daemons under /tmp/rung1 are up and are not yours to stop or start; before any Playwright, E2E or Tier L run take the lock: flock /tmp/rung1/e2e.lock <command> (other lanes share the rig); bound every run that spawns an orchestrator and check df -h / before and after. Vocabulary by reference: ${A.tree}/CONTEXT.md §2, §4, §5.`
const GLOBAL = `Global constraints binding every task (plan §6, verbatim): Contract-first at every wire change, each in the task that implements it. Red-first at the seams named per task; no test at an unagreed seam. No new discrete WebSocket event; MESSAGE_TYPES untouched. Ratchet never lowered; lint clean in both repos; every close gate includes the integration suite. Vocabulary per CONTEXT.md; every temporary construct gets a ledger row. Implementers never dispatch subagents. Every claim of "done" is verified against the diff and a fresh run. RULED_NON_FLOOR grows only by owner ruling.`

const IMPL_SCHEMA = { type: 'object', properties: { status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] }, head: { type: 'string', description: 'git rev-parse HEAD of the parent tree after your last commit (7+ hex chars)' }, scannerHead: { type: 'string', description: 'git rev-parse HEAD of ALNScanner after your last commit, or empty' }, commits: { type: 'array', items: { type: 'string' } }, testSummary: { type: 'string' }, concerns: { type: 'array', items: { type: 'string' } } }, required: ['status', 'head', 'scannerHead', 'commits', 'testSummary', 'concerns'] }
const FINDING = { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'important', 'minor'] }, file: { type: 'string' }, line: { type: 'integer' }, summary: { type: 'string' }, planConflict: { type: 'boolean', description: 'true when fixing it would contradict the brief or the plan pin text' } }, required: ['id', 'severity', 'file', 'summary', 'planConflict'] }
const REVIEW_SCHEMA = { type: 'object', properties: { specVerdict: { type: 'string', enum: ['pass', 'fail'] }, qualityVerdict: { type: 'string', enum: ['approved', 'needs-fixes'] }, findings: { type: 'array', items: FINDING }, cannotVerify: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['specVerdict', 'qualityVerdict', 'findings', 'cannotVerify', 'notes'] }
const REREVIEW_SCHEMA = { type: 'object', properties: { addressed: { type: 'array', items: { type: 'string' } }, notAddressed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] } }, newBreakage: { type: 'array', items: FINDING }, notes: { type: 'string' } }, required: ['addressed', 'notAddressed', 'newBreakage', 'notes'] }
const HFINDING = { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['major', 'minor'] }, file: { type: 'string' }, line: { type: 'integer' }, claim: { type: 'string' }, effect: { type: 'string' }, reproduction: { type: 'string' } }, required: ['id', 'severity', 'file', 'line', 'claim', 'effect', 'reproduction'] }
const ATTACK_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: HFINDING }, held: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['findings', 'held', 'notes'] }
const REFUTE_SCHEMA = { type: 'object', properties: { refuted: { type: 'boolean' }, why: { type: 'string' }, evidence: { type: 'string' }, severityIfStands: { type: 'string', enum: ['major', 'minor'] } }, required: ['refuted', 'why', 'evidence', 'severityIfStands'] }

const diffCmds = (base, head) => `git -C ${A.tree} log --oneline ${base}..${head}; git -C ${A.tree} diff --stat ${base}..${head}; git -C ${A.tree} diff -U10 ${base}..${head}${A.scanner ? `; and for the scanner side: git -C ${A.tree}/ALNScanner log --oneline <scanner base>..HEAD and git -C ${A.tree}/ALNScanner diff -U10 <scanner base>..HEAD, where <scanner base> is the ALNScanner pin recorded in the parent at ${base} (git -C ${A.tree} ls-tree ${base} ALNScanner)` : ''}`

function implPrompt(task, prior) {
  return `You are the implementer for the ${A.lane} lane of the hardening block of ALN-Ecosystem, task "${task.title}" (${task.section}).${prior ? ` Earlier tasks of this lane landed on this branch at ${prior}; read their diff against ${A.base} before starting and build on their interfaces.` : ''}

Read this first — it is your requirements, with the exact values to use verbatim: ${A.brief}. Implement ONLY the task named above; the brief's other tasks belong to later dispatches.

${WORKDIR}

${A.precisions}

${GLOBAL}

Method: tests first at every seam the brief names (RED, then GREEN); commit per seam with a message naming the pin or ruling it lands; never amend or rewrite an earlier commit. Every verification run the brief names for this task must be run fresh by you and its last lines pasted into the report.

Report: create ${A.report} at the START (status line, then a section per task; append under a heading for this task if the file exists) and extend it as you go, so an interruption leaves a partial report: what you built per commit, the RED/GREEN evidence per seam, the run tails, every deviation from a pin and why, concerns. Your final answer is the structured object only (status, head, scannerHead, commits, testSummary, concerns).`
}

function reviewPrompt(task, base, head) {
  return `You are reviewing one task's implementation: first whether it matches its requirements, then whether it is well-built. This is a task-scoped gate, not a merge review. Lane: ${A.lane}; task "${task.title}" (${task.section}).

What was requested: the brief ${A.brief} (this task's section, plus the sections that bind every task). ${GLOBAL} Also binding: ${A.precisions}

What the implementer claims: read ${A.report} (this task's section). Treat it as unverified claims; verify against the diff; a stated rationale never downgrades a finding.

Diff under review: base ${base}, head ${head}: ${diffCmds(base, head)}. The diff's context lines are the changed files; inspect code outside the diff only to evaluate a concrete risk you can name, one focused check per risk, and name both in your notes. Do not re-run the suite the implementer ran; run a focused test only when reading raises a specific doubt no existing run answers.

Read-only: do not mutate the working tree, the index, HEAD or branch state. Dispatch no subagents. Work only under ${A.tree}/; the top-level /home/user/ALNScanner and /home/user/ALN-TokenData are stale clones; other worktrees under ${REPO}/.worktrees/ are other lanes.

Verdicts: specVerdict pass only if every deliverable of this task and every precision is met by the diff, nothing more and nothing less; qualityVerdict approved only if the code is clean, tested at the named seams (red then green as the report evidences), and maintainable. Findings: one entry each with severity (critical = wrong or unsafe; important = spec gap or real defect; minor = style or nit), file, line, one-sentence summary, and planConflict true when the fix would contradict the brief or plan text. cannotVerify: requirements that live in unchanged code or span tasks. Return the structured object only.`
}

function fixPrompt(task, open, round, fixBase) {
  const list = open.map(f => `- ${f.id} [${f.severity}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.summary}`).join('\n')
  return `You are the implementer for the ${A.lane} lane of ALN-Ecosystem, task "${task.title}", fix round ${round} of at most 3. A task review found open findings on the current head ${fixBase}; you own the fix.

Read first: the brief ${A.brief} (your requirements, exact values verbatim) and the report ${A.report} (what was built and tried; append your fix report under a heading "Fix round ${round} (${task.title})"). ${WORKDIR}

${A.precisions}

Open findings (address each; say in the report how, or why a finding is wrong with evidence — do not silently skip):
${list}

For each fix: re-run the tests covering the amended code (name the test files), paste the command and its last lines into the report, commit with a message naming the finding ids. Never amend or rewrite earlier commits. Your final answer is the structured object only (status, head, scannerHead, commits, testSummary, concerns).`
}

function rereviewPrompt(task, open, fixBase, head) {
  const list = open.map(f => `- ${f.id} [${f.severity}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.summary}`).join('\n')
  return `Scoped re-review of a fix round for the ${A.lane} lane of ALN-Ecosystem, task "${task.title}". Verdict each finding below ADDRESSED or NOT ADDRESSED on the fix diff, and flag new breakage in the fix diff only; observations on untouched code are out of scope.

Findings under review:
${list}

Inputs: the brief ${A.brief}; the report ${A.report} (the latest "Fix round" section); the fix diff: ${diffCmds(fixBase, head)}. Read-only: do not mutate the working tree, index, HEAD or branch. Dispatch no subagents. Work only under ${A.tree}/. Do not re-run the suite; a focused test only on a specific doubt. Return the structured object only: addressed (ids), notAddressed (id + why), newBreakage (findings with severity, file, line, summary, planConflict false), notes.`
}

function laneReviewPrompt(head) {
  return `Whole-lane review of the ${A.lane} lane of the ALN-Ecosystem hardening block, every task now landed: base ${A.base}, head ${head}: ${diffCmds(A.base, head)}. The brief ${A.brief} is the requirement set; the report ${A.report} the implementer's claims (unverified). ${GLOBAL} Also binding: ${A.precisions}

Look for what task-scoped reviews cannot see: seams between tasks that disagree (a shape produced by one task and consumed differently by another), duplicated logic across tasks, a wire change with one side missing, a test that passes against a wrong build, dead code left by a later task, and any global constraint broken across the lane. Read-only; dispatch no subagents; work only under ${A.tree}/. Findings as for a task review (severity, file, line, summary, planConflict). Return the structured object only.`
}

function attackPrompt(head) {
  return `You are the hostile tester for the ${A.lane} lane of the ALN-Ecosystem hardening block at head ${head} (diff: ${diffCmds(A.base, head)}). The change claims: ${A.claims}. Your job is to make each claim FAIL with a real experiment, not by reading alone. Read first: the brief ${A.brief}, the implementer's report ${A.report}, then the diff. ${WORKDIR} Your own experiment scripts go under ${A.scratchpad}/ (create it); never modify a tracked file, never run a git write command, never commit; if an experiment needs a modified copy of a module, copy it into the scratchpad and run the copy.

Attacks to run, and any others you devise: ${A.attacks}

For every attack, record what you ran and what you saw. A finding is a broken claim or a real loss (signal, safety, isolation, a false word shown to the GM) with a reproduction; severity major when a game night or a test run can be harmed, minor otherwise. List every attack that held, with its evidence, so the record shows coverage. Your final answer is the structured object only.`
}

function refutePrompt(f, head) {
  return `You are an independent refuter for one finding a hostile tester raised on the ${A.lane} lane of ALN-Ecosystem (diff ${A.base}..${head} in ${A.tree}). Try to REFUTE it: show it is wrong, already handled, out of the brief's scope by design, or not the severity claimed. Default to refuted=false only when the evidence clearly supports the finding. The brief: ${A.brief}. The report: ${A.report}. The finding: ${JSON.stringify(f)}. ${WORKDIR} Re-run the finding's reproduction yourself when it is bounded and cheap; otherwise trace the path in the code. Your final answer is the structured object only.`
}

async function fixLoop(task, review, head) {
  const minors = review.findings.filter(f => f.severity === 'minor')
  let open = review.findings.filter(f => f.severity !== 'minor')
  if (review.specVerdict === 'fail' && open.length === 0) open = review.findings.slice()
  const conflicts = open.filter(f => f.planConflict)
  if (conflicts.length) return { head, rounds: [], open, minors, conflicts }
  const rounds = []
  let round = 0
  while (open.length && round < 3) {
    round += 1
    const fixBase = head
    log(`${task.id} fix round ${round}: ${open.length} open`)
    const fix = await agent(fixPrompt(task, open, round, fixBase), { label: `${task.id}:fix-${round}`, phase: 'Fix', model: 'opus', agentType: 'general-purpose', schema: IMPL_SCHEMA })
    if (!fix) { rounds.push({ round, fixBase, lost: 'fixer' }); break }
    head = fix.head
    const re = await agent(rereviewPrompt(task, open, fixBase, head), { label: `${task.id}:re-review-${round}`, phase: 'Fix', model: 'sonnet', agentType: 'general-purpose', schema: REREVIEW_SCHEMA })
    if (!re) { rounds.push({ round, fixBase, head, lost: 're-review' }); break }
    const stillOpen = open.filter(f => !re.addressed.includes(f.id))
    const breakage = (re.newBreakage || []).filter(b => b.severity !== 'minor').map((b, i) => ({ id: `${task.id}-new-${round}-${i + 1}`, severity: b.severity, file: b.file, line: b.line || 0, summary: b.summary, planConflict: false }))
    rounds.push({ round, fixBase, head, fix, re })
    open = stillOpen.concat(breakage)
  }
  return { head, rounds, open, minors, conflicts: [] }
}

const results = []
let head = A.base
let prior = null
for (const task of A.tasks) {
  phase('Implement')
  const impl = await agent(implPrompt(task, prior), { label: `${task.id}:implementer`, phase: 'Implement', model: 'opus', agentType: 'general-purpose', schema: IMPL_SCHEMA })
  if (!impl) return { stage: 'implementer-lost', task: task.id, results, head }
  if (impl.status === 'BLOCKED' || impl.status === 'NEEDS_CONTEXT') return { stage: 'implementer-' + impl.status, task: task.id, impl, results, head }
  const taskBase = head
  head = impl.head
  phase('Review')
  const review = await agent(reviewPrompt(task, taskBase, head), { label: `${task.id}:task-review`, phase: 'Review', model: 'opus', agentType: 'general-purpose', schema: REVIEW_SCHEMA })
  if (!review) return { stage: 'review-lost', task: task.id, impl, results, head }
  const loop = await fixLoop(task, review, head)
  head = loop.head
  results.push({ task: task.id, taskBase, head, impl, review, rounds: loop.rounds, open: loop.open, minors: loop.minors, conflicts: loop.conflicts })
  if (loop.conflicts.length) return { stage: 'plan-conflict', task: task.id, results, head }
  if (loop.open.length) return { stage: 'open-after-rounds', task: task.id, results, head }
  prior = head
}

let laneReview = null
if (A.tasks.length > 1) {
  phase('Lane review')
  laneReview = await agent(laneReviewPrompt(head), { label: 'lane-review', phase: 'Lane review', model: 'opus', agentType: 'general-purpose', schema: REVIEW_SCHEMA })
  if (laneReview) {
    const loop = await fixLoop({ id: 'lane', title: 'whole-lane review findings', section: 'all tasks' }, laneReview, head)
    head = loop.head
    laneReview = Object.assign({}, laneReview, { rounds: loop.rounds, open: loop.open, minors: loop.minors, conflicts: loop.conflicts })
    if (loop.conflicts.length) return { stage: 'plan-conflict', task: 'lane', results, laneReview, head }
    if (loop.open.length) return { stage: 'open-after-rounds', task: 'lane', results, laneReview, head }
  }
}

phase('Attack')
const r = await agent(attackPrompt(head), { label: 'hostile-tester', phase: 'Attack', model: 'opus', effort: 'high', agentType: 'general-purpose', schema: ATTACK_SCHEMA })
if (!r) return { stage: 'tester-lost', results, laneReview, head }
log(`attack: ${r.findings.length} findings, ${r.held.length} attacks held`)
phase('Refute')
const verdicts = await parallel(r.findings.map(f => () => agent(refutePrompt(f, head), { label: `refute:${f.id}`, phase: 'Refute', model: 'opus', agentType: 'general-purpose', schema: REFUTE_SCHEMA })))
const standing = [], refuted = []
for (let i = 0; i < r.findings.length; i++) {
  const f = r.findings[i]; const v = verdicts[i] || { refuted: false, why: 'refuter lost', evidence: '', severityIfStands: f.severity }
  const e = Object.assign({}, f, { refuter: v })
  if (v.refuted) refuted.push(e); else standing.push(Object.assign(e, { severity: v.severityIfStands }))
}
return { stage: 'done', head, results, laneReview, hostile: { standing, refutedCount: refuted.length, refuted, held: r.held, notes: r.notes } }
