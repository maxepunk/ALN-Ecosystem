# Phase 2 Merge — PR Package & Protocol

**Date:** 2026-06-11
**Purpose:** Merge the Phase 1 review + Phase 2 refactor + Phase 2.x harness
work to mains via reviewed PRs — five repos, ordered — without disturbing the
ability to run a live ALN game. This doc is the working reference for the
REVIEWING session and for the merge executor.

## Why PRs (owner decision)

Production runs from main on the Pi. Nothing merges until a session OTHER
than the authoring one has reviewed each PR. If a game is scheduled before
review completes, hold all merges until after the event.

## Merge order (strict)

```
1. Four submodule PRs — review + merge in any order among themselves:
     a. ALN-TokenData    claude/phase2-token-schema      → main   PR #1
     b. ALNScanner       claude/phase2-domain-split      → main   PR #10
     c. ALNPlayerScan    claude/phase2-es6-modules       → main   PR #5
     d. arduino-cyd-...  claude/review-fix-batch         → main   PR #6
2. Parent branch: re-pin all four submodule gitlinks to the NEW main merge
   commits; commit "chore: re-pin submodules to merged mains"; push.
3. Parent PR (ALN-Ecosystem #17, draft) — final review of the re-pin
   commit → merge.
4. Post-merge validation on real hardware (owner):
   - Pi: pull main, `npm run test:e2e:tier-h`, then full Tier L if desired
   - ESP32: flash main, boot + scan smoke test
```

**Live PRs (created 2026-06-11):**
- https://github.com/maxepunk/ALN-TokenData/pull/1
- https://github.com/maxepunk/ALNScanner/pull/10
- https://github.com/maxepunk/ALNPlayerScan/pull/5
- https://github.com/maxepunk/arduino-cyd-player-scanner/pull/6
- https://github.com/maxepunk/ALN-Ecosystem/pull/17 (draft — merges last)

Branch-state facts (verified 2026-06-11): every branch is 0 behind its main
except ALNScanner (1 behind — the PR #9 merge-commit object only; content
already present; test merge is conflict-free).

## Review guidance for the reviewing session

- The four scanner/data repos are publicly readable — fetch branches via
  plain git even without MCP repo scope.
- Review against intent docs in the parent repo branch
  `claude/game-system-review-refactor-jbk05w`:
  - `docs/reviews/2026-06-platform-review/` (findings (F-*) + TRIAGE)
  - `docs/decisions/2026-06-*` (tier decisions, kit model, engine notes)
  - `docs/plans/2026-06-09-platform-review-refactor-workflow.md` (master plan)
  - `docs/plans/2026-06-11-phase2x-e2e-harness.md` (harness work, executed)
- Each PR description below lists its test evidence. Re-run cheaply where
  possible (all suites run in a web container EXCEPT Tier H/hardware).

---

## PR 1 — ALN-TokenData: `claude/phase2-token-schema` → main

**Title:** feat: tokens.schema.json v1 (current format, contract-enforced)

Adds a JSON Schema describing the CURRENT tokens.json format — the single
file, nothing else changes. The backend contract test
(`backend/tests/contract/scanner/request-schema-validation.test.js` and the
tokens-schema test) validates production tokens.json against it, so format
drift between Notion sync output and consumers now fails CI instead of
failing a game. Schema v2 (structured group field, replacing the "(xN)"
microformat) is a Phase 3/A1 coordinated change — explicitly NOT this PR.

**Test evidence:** backend contract suite green against production
tokens.json; schema also validates the E2E fixture pack.
**Risk:** none at runtime (data repo; schema file is additive).

## PR 2 — ALNScanner: `claude/phase2-domain-split` → main

**Title:** Phase 2: four-domain structural split + P0/P1 review fixes (23 commits)

Two layers, sequenced bottom-up in the history:

1. **Review fixes (F-GMS-*, F-GMCMD-*, F-SCAN-*):** standalone restore
   re-initialization (P0), BT-fallback warning (P0), XSS escaping at all
   flagged innerHTML sites, cross-device duplicate UX ("already claimed by
   Team X"), transaction:deleted cache pruning, strategy-event contract in
   LocalStorage, mode persistence, error-event display, offline-queue
   indicator, divergent fallback scoreboard deletion, paused-video
   rendering, Now Showing single writer, standalone group completion
   requires 2+ tokens, `score:reset` action name fix.
2. **Structural split (decision C1):** app.js, message routing, store
   subscriptions, renderers, and admin HTML re-sectioned into the four
   domains (Game Ops / Show Control / Environment / Game Admin). Golden-
   master contract test pins the session-report external contract (B9).

**Test evidence:** Jest unit suite green; coverage ratchet green; standalone
Playwright E2E green; parent-repo Tier L E2E (112 passed) runs against this
branch's built dist via the `backend/public/gm-scanner` symlink.
**Risk:** largest scanner diff. The four-domain split is structural (no
behavior change intended) — review focus there is wiring, not logic. The
review-fix commits each cite their finding ID for intent-checking.
**Reminder:** after merge, GM scanner deployments need `npm run build`
(scoring config bakes in at build time — F-TOOL-05).

## PR 3 — ALNPlayerScan (aln-memory-scanner): `claude/phase2-es6-modules` → main

**Title:** Phase 2: testable module extraction + queue/identity/SW fixes (10 commits)

- **Structure:** MemoryScanner class extracted into testable modules
  (UMD/no-build preserved — this is NOT a bundler migration).
- **Fixes:** stable per-batch batchId + final-4xx batch handling; never
  requeue server-rejected scans; indeterminate batch response treated as
  network-class failure; persisted generated deviceId; tokens.json served
  network-first with cache fallback in the service worker; image-error
  fallback wiring.
- **Tooling:** ESLint baseline + jest coverage ratchet.

**Test evidence:** Jest suite green; backend contract test validates this
scanner's request payloads against OpenAPI schemas.
**Risk:** service-worker caching change (network-first tokens.json) alters
offline behavior intentionally — review that the fallback path is correct.

## PR 4 — arduino-cyd-player-scanner: `claude/review-fix-batch` → main

**Title:** Phase 2: scan-path 409 classification + batch-id nonce (3 commits)

- 409 responses classified by body (duplicate vs other) with a single
  bounded send attempt on the scan path
- Batch ids unique across reboots via per-boot nonce
- Doc fixes (stale 409 claim, UID-hex comment)

**Test evidence:** `pio test -e native` green (models + NDEF parser).
**Risk:** firmware — native tests can't prove on-device behavior.
**MERGE GATE:** owner flashes this branch (or post-merge main) to a CYD and
runs a boot + scan smoke test before/at merge. This is the one PR with a
hardware step in the loop.

## PR 5 — ALN-Ecosystem (parent): `claude/game-system-review-refactor-jbk05w` → main

**Title:** Platform review + Phase 2 refactor + Phase 2.x E2E harness (122 commits)

195 files, +19,155/−4,068. Three layers:

1. **Phase 1 — review record:** `docs/reviews/2026-06-platform-review/`
   (per-component reviews, findings, TRIAGE), tier decision records,
   113-row capability matrix, kit-model + engine-design decision docs,
   Phase 3 program doc.
2. **Phase 2 — backend refactor:** session.scores as the single canonical
   score store; pure `gameRules/` (scoring, duplicatePolicy, cueVocabulary);
   cueEngine facade (standingEvaluator / timelineRuntime / HeldItemsStore);
   audioRouting facade (pactlClient / DuckingEngine, awaited-write
   contract); `service:state` 10-domain envelope with contract-enforced
   DomainState schemas; sessionService owns all persistence; dead events
   removed (state:update/state:sync, score:updated, videoEvents.js);
   ProcessMonitor + scoreboard product fixes (spawn-error handler,
   socket.io served locally).
3. **Phase 2.x — E2E harness:** capability manifest with loud skips +
   named degraded tests; Tier L/H split (Tier L = CI job, workers=3,
   ~9 min); event-cache footgun eliminated (pure listener-from-now
   waitForEvent across 31 call sites); no-fixed-sleeps lint; TOKENS_PATH
   pack-injection seam + fixture pack (first-ever green E2E for
   group-completion scoring parity); SessionStart bootstrap hook for web
   sessions.

**Test evidence:** unit + contract green with coverage ratchet; integration
suite green; Tier L E2E 112 passed / 0 failed (capability skips loud +
manifested); zero todos/skips/quarantines across suites.
**Merge mechanics:** merges LAST, after a re-pin commit moves the four
submodule gitlinks to their merged main SHAs. Review the re-pin commit as
part of this PR.
**Post-merge (owner):** Tier H on the Pi; production note — no completable
token group exists in live ALN data, so group bonuses are unreachable until
content adds one (flagged, content decision).

---

## After the merge

- Phase 3 work proceeds on fresh, slice-sized branches off main (per the
  Phase 3 program methodology) — no more mega-branches.
- The bootstrap hook lands on main with the parent PR, activating for all
  future web sessions.

## Branch policy during the review window (recorded on phase3-foundations)

| Branch set | Role | What may land there |
|---|---|---|
| `claude/game-system-review-refactor-jbk05w` + the four phase2 submodule branches | FROZEN under PR review | review-requested fixes and the final re-pin commit ONLY |
| `claude/phase3-foundations` (parent + all four submodules, cut at the frozen tips) | active work | config-tool pre-read, 3.1 schema drafts, all new Phase 3 work |

Fresh-container note: with two branches pointing at each submodule pin, the
bootstrap hook's branch-attach is deliberately ambiguous — it leaves the
submodule DETACHED and prints both candidates, so no session silently lands
work on a PR branch. Check out the branch you mean, explicitly.

After the merge: `claude/phase3-foundations` rebases onto main; subsequent
Phase 3 slices use fresh slice-sized branches per the program methodology.
