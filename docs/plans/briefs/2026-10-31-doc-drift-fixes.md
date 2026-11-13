# Doc-drift fixes brief: two living documents the cause analysis found wrong (implementer)

> Written 2026-10-31. The owner's decision 20 (architecture pass, round 8): documents are fixed as we go, always (`docs/agents/process.md` §4, last paragraph). The cause analysis set these two findings aside as documents (`docs/plans/architecture-pass/2026-10-30-cause-analysis.md` §3, B-97 and C-17).

Read this first; it is your single source of requirements. Model: Sonnet. You dispatch no subagents; review arrives from the orchestrator after your report.

## What this buys

Agents and people work from `backend/CLAUDE.md` and `ALNScanner/CLAUDE.md`. Where those files describe code that does not exist, the next reader builds on a false picture. This task makes each named passage say what the code does.

## Where you work

The worktree and branches the dispatch names: the parent repository's task branch, and inside it the ALNScanner submodule on its branch of the same name. Push nothing. Never amend or rewrite a commit. The top-level `/home/user/ALNScanner` and `/home/user/ALN-TokenData` directories are stale clones: never read them.

## Deliverables

For each item: read the code first, then make the document say what the code does, in plain, short, active sentences with no em dashes (`docs/agents/process.md` §4). Where a passage cites line numbers that drift, cite the function or method name instead. If the code shows the passage is right after all, leave it and say so in the report.

1. **`backend/CLAUDE.md`** (parent repository): the passage near line 522 that names `cueEngine.standingCues`, a key no code has. Find what the cue engine's state really carries (its `getState()` and the snapshot builder that sends it) and name that.
2. **`ALNScanner/CLAUDE.md`** (ALNScanner repository), each claim checked against the code named beside it:
   - "Phase 1H: Load DataManager (transactions + scannedTokens)" in the initialization list, against `src/app/initializationSteps.js` (around lines 77-79).
   - The console recipes that read a `transactions` localStorage key, against what the storage code actually writes (`src/core/storage/LocalStorage.js` and the keys it uses). Keep the recipes only if their keys exist.
   - "`MonitoringDisplay.refreshAllDisplays()` re-renders the template ... calls `_requestInitialState()`", against `src/admin/MonitoringDisplay.js` (around lines 374-378).
   - The StateStore API list, against `src/core/stateStore.js` (it has a `replace` method the list leaves out, around line 50).
   - "Strategy selection: Mode determined at startup by SessionModeManager", against where the strategy is really chosen.
   - The standalone-mode claim that `scannedTokens` are persisted, against the standalone storage code.
   - The connection-restoration line numbers ("initializationSteps.js:187-224"), against the current function.
3. **`ALNScanner/src/network/messageRouters.js`** (around lines 186-188): the comment saying no router consumes `session:overtime`. `src/admin/MonitoringDisplay.js` (around lines 230-232) consumes it; make the comment say who does.

Out of scope: the contract notes about who fetches `/api/tokens` and who uploads batches. The cause analysis puts them under cause C14, whose rule the pass designs.

## Commits

One commit in ALNScanner (items 2 and 3) on its branch, then one commit in the parent (item 1 and the ALNScanner pin moved to your new commit). End each commit message with the two trailer lines the dispatch gives.

## Proof runs

From `ALNScanner/`: `npx jest tests/unit/network` (the comment edit sits in that module). From the parent root: a grep showing each old claim is gone (`standingCues` in `backend/CLAUDE.md`; "refreshAllDisplays() re-renders"; "no router consumes"). Paste each command and its summary line.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-10-30-architecture-pass/doc-drift-report.md`: Status; Commits; each item with what the code does (file:line) and what you changed; Proof runs; Concerns. Reply with at most 6 lines.
