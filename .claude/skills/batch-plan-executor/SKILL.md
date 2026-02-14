---
name: batch-plan-executor
description: Use when executing implementation plans with multiple tasks — analyzes dependencies, groups into parallel batches, dispatches subagents with rich context, verifies with real test runs, and reviews at checkpoints. Replaces sequential one-at-a-time execution with dependency-aware batched orchestration.
---

# Batch Plan Executor

Execute implementation plans using dependency-aware parallel batches, checkpoint reviews, git safety, and real verification gates.

**Announce at start:** "I'm using the batch-plan-executor skill to execute this plan."

**Replaces:** `subagent-driven-development` for plans with 5+ tasks. Use the simpler skill for 1-4 task plans where sequencing doesn't matter.

## Core Principles

1. **Dependency-aware batching** — Independent tasks run in parallel. Dependent tasks wait.
2. **Checkpoint reviews** — Review at batch boundaries, not after every task.
3. **Rich context injection** — Subagents get conventions, patterns, and prior batch results.
4. **Git safety** — SHA tracking before each batch. Revert on failure, don't "fix forward" blindly.
5. **Real verification** — Orchestrator runs test suites. Never trust "tests pass" claims.
6. **Bellwether test** — Identify the project's most comprehensive E2E test and run it at key batch boundaries. This is the canary that catches regressions no unit test covers.
7. **Right-sized agents** — Match agent type and model to task complexity.

---

## Phase 1: Analyze Plan and Build Batch Schedule

### Step 1: Read the plan

Read the plan file. Identify all tasks, their files, and their dependencies.

### Step 2: Build dependency graph

For each task, determine:
- **Inputs**: What files/services must exist before this task can start?
- **Outputs**: What files/services does this task create or modify?
- **Blocks**: Which later tasks depend on this task's output?

Two tasks are **independent** if they touch completely different files and neither reads the other's output. Two tasks are **dependent** if one creates/modifies something the other needs.

### Step 3: Group into batches

**Rules:**
- Tasks in the same batch MUST be independent (no shared files, no dependency)
- Batches execute sequentially (Batch N completes before Batch N+1 starts)
- Tasks within a batch execute in parallel (multiple subagents)
- Keep batches to 2-4 tasks max (more = harder to debug failures)
- First batch should be low-risk setup (branching, config scaffolding)

### Step 4: Assign verification and review checkpoints

**After every batch:** Run the relevant test suite(s) as a verification gate.

**Bellwether test:** Identify the project's most comprehensive E2E test — the one that exercises the full system end-to-end. Run it at these points:
- After any batch that modifies shared infrastructure (service wiring, session lifecycle, event contracts)
- After all backend work completes (before moving to frontend)
- As the final gate before merge

If the bellwether test must be **extended** to cover new features (e.g., a new session lifecycle step), do so in the batch that introduces the breaking change — not as a separate task.

**Review checkpoints** (dispatch code-reviewer) at these boundaries:
- After the first implementation batch (catch pattern issues early)
- After all backend work completes (before moving to frontend)
- After all frontend work completes (before integration testing)
- Final review after everything

Don't review after trivial batches (branch setup, config files).

### Step 5: Present batch schedule to user

Show the user the planned batch schedule before executing:

```
Batch 0: [Task names] — [why grouped] — verify: [test command]
Batch 1: [Task names] — [why grouped] — verify: [test command] — REVIEW
Batch 2: ...
```

Get user approval before starting execution.

### Step 6: Create task tracking

Create TaskCreate entries for each task. Set up `blockedBy` relationships matching the batch schedule.

---

## Phase 2: Execute Batches

### For each batch:

#### 1. Record git SHA (safety net)

```bash
git rev-parse HEAD  # Record as BATCH_N_BASE_SHA
```

If the batch involves submodule work:
```bash
cd SubmodulePath && git rev-parse HEAD  # Record submodule SHA too
```

#### 2. Dispatch subagents for this batch

**For independent tasks in the batch:** Dispatch all subagents in a single message (parallel execution via multiple Task tool calls).

**For a single task:** Dispatch one subagent.

#### 3. Subagent prompt template

Every implementation subagent gets this structure:

```
You are implementing [Task Name] from the plan at [plan-file-path].

## Your Task
Read the plan file, find [Task N], and implement exactly what it specifies.

## Project Context
- Working directory: [absolute path]
- This is a [Node.js backend / ES6 PWA / etc.] project
- Services use `module.exports = new ClassName()` singleton pattern
- Tests use Jest with `describe/it` blocks
- [Any other key conventions from CLAUDE.md]

## What Previous Batches Built
[List files created/modified by earlier batches so the subagent knows what exists]

## Key Files You'll Need
[List 3-5 most relevant existing files the subagent should read first]

## Requirements
1. Follow TDD: write failing test first, then implement, then verify
2. Run the test suite before reporting: [exact test command]
3. Commit your work with a descriptive conventional commit message
4. Do NOT modify files outside your task's scope

## Report Back With
- Files created/modified (with paths)
- Test results (paste actual output, not just "tests pass")
- Any issues or discoveries
- The git commit SHA of your work
```

**Adjust per task type:**
- Simple setup tasks (branch creation, config files): Skip TDD requirement, use `mode: "bypassPermissions"` if safe
- Service implementation: Full TDD, include relevant test helper paths
- UI/frontend tasks: Include DOM patterns, CSS conventions, event binding patterns
- Wiring/integration: Include list of all services and their event names

#### 4. Agent type selection

| Task Type | subagent_type | model | Rationale |
|-----------|--------------|-------|-----------|
| Branch/config setup | Bash | haiku | Simple git/file operations |
| Contract updates | general-purpose | sonnet | Schema writing, moderate complexity |
| New service (TDD) | general-purpose | sonnet | Full implementation with tests |
| Refactoring existing code | general-purpose | sonnet | Needs to understand existing patterns |
| UI/frontend changes | general-purpose | sonnet | DOM, CSS, event wiring |
| Integration tests | general-purpose | sonnet | Cross-service understanding |
| Docs updates | general-purpose | haiku | Straightforward text changes |

Use `opus` only for tasks that require deep architectural reasoning or complex cross-cutting changes.

#### 5. Collect results

When subagents complete:
- Read their reports
- Note files changed, commit SHAs, any issues raised
- Accumulate into a **batch context summary** for the next batch

#### 6. Verification gate (MANDATORY)

**The orchestrator runs the test suite directly.** Do not skip this.

```bash
cd /path/to/project && npm test  # Or whatever the plan specifies
```

**If tests pass:** Proceed to review (if checkpoint) or next batch.

**If tests fail:**
1. Check which tests failed and which subagent's work caused it
2. Try a targeted fix subagent first (give it the exact error)
3. If fix subagent fails, revert to BATCH_N_BASE_SHA and re-attempt the batch with better instructions
4. If second attempt fails, STOP and ask the user

#### 7. Review checkpoint (when scheduled)

Dispatch `superpowers:code-reviewer` with:
- What was implemented across this batch (and previous since last review)
- The plan requirements being verified
- Base SHA (last review or start) and HEAD SHA
- Specific concerns to check

**If Critical issues found:** Fix before next batch.
**If Important issues found:** Fix before next batch if they affect dependent tasks. Otherwise note for cleanup.
**If Minor only:** Note and continue.

#### 8. Update task tracking

Mark completed tasks. Update batch context summary.

---

## Phase 3: Final Verification and Completion

After all batches complete:

### 1. Run full test suite

```bash
# All test levels
npm test                    # Unit + contract
npm run test:integration    # Integration (if applicable)
npm run test:e2e           # E2E (if applicable)
```

### 2. Final code review

Dispatch `superpowers:code-reviewer` covering:
- All changes from first batch to last
- Full plan requirements
- Architecture coherence
- Test coverage adequacy

### 3. Complete development

Use `superpowers:finishing-a-development-branch` to present merge/PR options.

---

## Batch Context Summary Template

Maintain this between batches (passed to next batch's subagents):

```markdown
## Completed So Far

### Batch 0: [name]
- Created: [file list]
- Modified: [file list]
- Key decisions: [any deviations from plan]

### Batch 1: [name]
- Created: [file list]
- Modified: [file list]
- Test results: [pass count / total]
- Key patterns established: [e.g., "gameClockService uses EventEmitter with gameclock: prefix events"]

### Current State
- All tests passing: yes/no
- Files that exist now: [key new files]
- Known issues: [any deferred items]
```

This prevents later subagents from duplicating work or contradicting earlier decisions.

---

## Rollback Protocol

**When to revert vs. fix forward:**

| Situation | Action |
|-----------|--------|
| 1-2 test failures, cause is obvious | Fix forward (targeted fix subagent) |
| Many test failures, unclear cause | Revert to batch base SHA, re-attempt |
| Subagent modified wrong files | Revert, re-dispatch with tighter scope |
| Subagent's approach is fundamentally wrong | Revert, rewrite prompt with different approach |
| Two parallel subagents conflicted | Revert, make tasks sequential |

**Revert command:**
```bash
git reset --hard BATCH_N_BASE_SHA
# For submodules:
cd SubmodulePath && git reset --hard SUBMODULE_BATCH_N_BASE_SHA
```

---

## Anti-Patterns

**Never:**
- Dispatch 5+ implementation subagents in one batch (too hard to debug conflicts)
- Skip the verification gate ("tests probably pass")
- Let a subagent modify files outside its task scope
- Trust "I ran the tests and they pass" without seeing output
- Continue after test failures "because it's probably fine"
- Fix forward more than once on the same failure (revert instead)

**Always:**
- Show batch schedule to user before starting
- Record SHA before each batch
- Run tests yourself after each batch
- Pass batch context to next batch's subagents
- Stop and ask when stuck (don't burn tokens guessing)

---

## Quick Reference: Orchestrator Checklist Per Batch

```
[ ] Record git SHA(s)
[ ] Dispatch subagent(s) with rich context
[ ] Collect reports from all subagents
[ ] Run test suite (verification gate)
[ ] If review checkpoint: dispatch code-reviewer
[ ] Update batch context summary
[ ] Mark tasks complete
[ ] Proceed to next batch (or stop if blocked)
```
