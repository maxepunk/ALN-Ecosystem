# Phase 2 Merge Package — Round-2 Package Review & Fix Record

**Date:** 2026-06-12
**Reviewer/executor:** independent session (round 2; round 1 =
`2026-06-11-phase2-merge-readiness-review.md`)
**Scope:** all five PRs at the SHAs pinned by the parent branch after the
round-1 fixes (parent 3198f14; submodules 0ee77cd / e6b35a4 / b65b853 /
bc8db2b), reviewed by six parallel deep-review agents (one per submodule
PR; parent split into backend, E2E/infra, and config-tool/scripts scopes —
the third scope had no dedicated round-1 reviewer), then ALL findings
fixed on the PR branches per owner decision ("rock solid before merge").

## Round-2 review outcome

Every round-1 finding — blockers, majors, and the entire pulled-forward
deferred-minors batch — was independently re-verified as genuinely fixed
(file:line + test evidence per finding; no gate was weakened anywhere:
coverage thresholds untouched, "deterministic coverage" is real new tests,
flow-21 assertions got stronger). Verification highlights beyond
diff-reading: attribute-context escaping proven quote-safe; the
no-fixed-sleeps lint rule proven to fire via eslint --stdin; the live
container's credential helper confirmed github-scoped with 0600 creds; the
CI Tier L job confirmed to rebuild the gitignored scanner dist; the
backend idempotency-cache premise behind the PS-1 snapshot model confirmed
in scanRoutes.js; tokens.schema.json machine-validated against all 81
production tokens.

**Per-PR verdicts (pre-fix):** #1 READY · #10 READY · #5 READY ·
#6 READY (hardware gate stands) · #17 READY after CT-1.

## New findings (round 2) — ALL FIXED on the PR branches

| # | Sev | Finding | Fixed in |
|---|-----|---------|----------|
| CT-1 | **MAJOR** | Preset export/load API responses served raw secrets (JWT_SECRET, ADMIN_PASSWORD, HA token), bypassing the E7 masking added for GET /api/config; list+import verified leak-free | parent 13d9a25 |
| CT-F2 | MINOR | Preset apply transactional for validation but not I/O — mid-sequence write failure left config half-applied, backup never auto-restored | parent 13d9a25 |
| CT-F3 | MINOR | Cue-editor condition coercion was type-blind — a team literally named "42" could never match (backend compares strictly) | parent 13d9a25 |
| CT-F4 | NIT | Secret mask suffix list missed _KEY/_PASS/_APIKEY/API_KEY | parent 13d9a25 |
| CT-F5 | NIT | envParser inline-`#` semantics diverge from backend dotenv (undocumented) | parent 13d9a25 (doc+pin) |
| CT-F6 | NIT | >50%-shrink warning didn't gate --prune — bulk-archived Notion DB + --prune would bulk-delete real assets | parent 13d9a25 |
| BE-N1 | LOW | sessionService.reset() deleted persisted state outside the F-BCORE-07 write queue and initState() abandoned the in-flight chain | parent c0ed08c |
| BE-N2 | INFO | archiveOldSessions wrote outside the queue (zero callers) | parent c0ed08c |
| BE-N3 | INFO | No test pinned the exact P17-M1 interleaving (ended-status-persists-last) | parent c0ed08c |
| E2E-N1 | MINOR | manifest-reporter counted per-attempt: a fail-then-pass retry counted once failed + once flaky ("1 failed" against exit 0) | parent c0ed08c |
| E2E-N2 | LOW | Bootstrap hook silently deferred to a pre-existing UNSCOPED credential helper (PAT to any host) | parent c0ed08c (WARN) |
| PS-N1 | LOW/MED | Batch stranded by 5xx/send-timeout never retried while health stayed green (no flip → no drain); new comments claimed otherwise | ALNPlayerScan 42df0c5 |
| PS-N2 | LOW | getQueueStatus hid snapshot items (up to 10 unsent scans reported as queue 0) | ALNPlayerScan 42df0c5 |
| PS-N3 | LOW | Crash between queue-shrink and snapshot persist lost up to 10 scans (write order) | ALNPlayerScan 42df0c5 |
| PS-N4 | INFO | Missing .catch on self-chains; corrupted localStorage item → poison batch (infinite same-batchId retry) | ALNPlayerScan 42df0c5 |
| GM-a/b/c | INFO | Three trusted-source interpolations unescaped (memoryType, transaction id, heldAt) — defense-in-depth | ALNScanner 44ee450 |
| GM-d | NIT | Round-1 MAJOR XSS fixes had no dedicated regression pins | ALNScanner 44ee450 |
| TD-N1 | INFO | Root + nested CLAUDE.md omitted SF_MemoryType:null (3 production tokens) | parent c0ed08c + ALN-TokenData 88ef4e7 |
| TD-N3 | NIT | Schema image patterns extension-loose (ESP32 is BMP-only); group pattern permitted (x0) | ALN-TokenData 88ef4e7 |
| ESP-F1 | INFO | Benign dual-core lazy-nonce race undocumented (DEBUG-only trigger; uniqueness property unaffected) | arduino-cyd 1d2469d (comment) |

Explicitly NOT fixed (unchanged owner decisions): ESP-1
(REJECTED_NO_SESSION content display — decide at the CYD smoke test,
decision point Application.h:699-707); nested data-pin bump question at
the re-pin step; PR #6 hardware merge gate.

## Fix-round test evidence

- ALN-TokenData: backend tokens-schema contract suite 5/5 against
  tightened schema (production 81 tokens + fixture packs)
- ALNScanner: Jest 1368/1368, coverage ratchet green, lint clean,
  vite build green
- ALNPlayerScan: Jest 158/158, `jest --coverage` exit 0 (ratchet raised,
  not weakened), lint clean
- arduino-cyd: comment-only change (native suite not runnable in this
  container — pio registry egress-blocked; CI covers, 120/120)
- config-tool 91/91 + lint 0 errors; scripts pytest 56/56
- Parent battery on the fixed tree: backend unit+contract 2098/2098
  (110 suites) with ratchet green — includes the backend mirror suite
  (tests/unit/player-scanner) updated for the additive pendingBatchSize
  field, the one cross-repo coupling the scanner fixes surfaced;
  integration 336/336; Tier L E2E 111 passed / 0 failed / 58
  capability-gated loud skips / 1 flaky — which the round-2 reporter fix
  NAMED (HELD-cue propagation to GM2, passed on retry 1; environment
  flake — the only diff near that path, the data-held-at escape, is an
  identity transform on ISO timestamps). Old reporter would have printed
  "1 failed" against exit 0 for this exact run.

## Branch tips after round 2

| Repo | Branch | Tip |
|------|--------|-----|
| ALN-TokenData | claude/phase2-token-schema | 88ef4e7 |
| ALNScanner | claude/phase2-domain-split | 44ee450 |
| ALNPlayerScan | claude/phase2-es6-modules | 42df0c5 |
| arduino-cyd-player-scanner | claude/review-fix-batch | 1d2469d |
| ALN-Ecosystem | claude/game-system-review-refactor-jbk05w | re-pinned to the four tips above |
