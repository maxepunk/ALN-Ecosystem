# T1a follow-up (scanner) brief — three review-bot findings on ALNScanner PR #17

Read this first; it is your single source of requirements. Vocabulary:
`CONTEXT.md` §4 (dormant vs fault, status with verbs). Model: Sonnet.
You dispatch no subagents.

## Where you work

The GM scanner submodule `/home/user/ALN-Ecosystem/ALNScanner/` (a git
repository of its own), on a NEW branch `claude/nice-curie-hescfv-t1a-fu`
cut from its current HEAD `be0d701` (branch `claude/nice-curie-hescfv`).
Dependencies are installed. Work only inside that directory; never run
git commands in the parent repository `/home/user/ALN-Ecosystem/` (the
parent sees your work as a moved submodule pin; the orchestrator moves
it). Component guidance: `ALNScanner/CLAUDE.md`. Push nothing.

## The findings (verbatim from the review bot on PR #17, all three are bug reports to fix)

1. "`CueRenderer._gridSignatureOf()` (src/ui/renderers/CueRenderer.js:69-75)
   only folds `dormantCommands.length` into the signature, not which
   services/doors are dormant. If a MIXED cue keeps the same
   skipped-command count but the actual absent service changes, the
   quick-fire grid won't rebuild, and the badge title / disabled-tile
   reason text will keep showing the stale service/door."
2. "`CueRenderer._updateStandingCues()` (src/ui/renderers/CueRenderer.js:216)
   has the same issue on the standing-cue path: the guard
   `isDisabled !== wasDisabled || isDormant !== wasDormant` skips the
   update whenever a row stays dormant across renders, so if the `door`
   reason changes (e.g. `profile` → `operator`) while `disabledBy` stays
   `'dormant'`, the dormant-note text goes stale."
3. "The collapsed health summary gets `role="button" tabindex="0"` +
   `data-action="admin.toggleHealthDetail"` (src/ui/renderers/HealthRenderer.js:128),
   but `domEventBindings.js` only delegates `click` events (no
   `keydown`), so a keyboard user can Tab to it but Enter/Space won't
   activate it. Simplest fix is probably just using a real `<button>` for
   the summary instead of a `div`."
   Plus the coverage note: "`MonitoringDisplay.toggleHealthDetail()` and
   the `domEventBindings.js` `'toggleHealthDetail'` case aren't directly
   exercised."

## Deliverables (tests first: red, then green, per test file)

1. `_gridSignatureOf()` folds, per cue, `disabledBy` and the FIRST
   dormant command's `service` and `door` (the values the tile's title
   and reason text are built from) — not only the count. Test: two
   summaries with the same `dormantCommands.length` but a different
   service or door produce different signatures and force a rebuild.
2. `_updateStandingCues()` also compares the dormant note's inputs
   (`disabledBy`, first dormant command's `door`/`service`, or the
   rendered note text) so a door change re-renders the row. Test: a row
   that stays `disabledBy: 'dormant'` while its door flips
   `profile → operator` shows the new wording.
3. The collapsed health summary becomes a real `<button type="button">`
   carrying the same classes and `data-action`; drop `role`/`tabindex`.
   Existing tests asserting the summary text/toggle keep passing (adjust
   selectors only if they targeted the `div`). Test: the summary element
   is a `BUTTON` and a click still toggles.
4. A passthrough test for `toggleHealthDetail` at the wiring layer,
   following `tests/unit/utils/domEventBindings-safeAction.test.js`'s
   pattern (the module-name string and the method name are the things a
   typo would break), and one for `MonitoringDisplay.toggleHealthDetail()`
   delegating to the renderer.

Then from `ALNScanner/`: `npm test -- --coverage`, `npm run coverage:check`,
`npm run lint`, `npm run build` (the parent's E2E serves `dist`). Commit
on the task branch with messages naming the finding (e.g. "fix(cues):
grid and standing-row change detection key on the dormant service and
door, not the count (PR #17 review)").

## Guardrails

Edit only `src/ui/renderers/CueRenderer.js`, `src/ui/renderers/HealthRenderer.js`,
the styles if the button needs a reset, and tests. Keep the parity note
in `dormancyWording.js` untouched. Push nothing.

## Report

Write `/home/user/ALN-Ecosystem/.superpowers/sdd/2026-09-12-block2-hardening-plan/t1a-scanner-fu-report.md`:
Status; Commits; TDD evidence per test file (RED/GREEN commands and
lines); Proof runs (the four commands with summary lines); Files changed;
Deviations; Concerns. Reply with at most 10 lines: status, commits,
one-line test summary, report path.
