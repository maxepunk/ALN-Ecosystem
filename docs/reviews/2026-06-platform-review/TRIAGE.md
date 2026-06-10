# Triage Backlog — Post-Discovery Execution Plan

**Date:** 2026-06-10
**Status:** Discovery COMPLETE (waves 1+2: 9 reports, ~170 findings: 11 P0 / 41 P1 / 66 P2 / 50 P3).
Owner decisions recorded in `docs/decisions/` (Tiers A-D). This document converts
findings × decisions into ordered, tagged work batches. Finding details live in the
per-unit reports; this is the index.

**Runtime confirmation:** 11 wave-1 findings reproduced live, 0 refuted
(`runtime-confirmation.md` — includes the working headless harness recipe).

---

## Batch 0 — Parent-side Phase 0 guardrails (FIRST, no behavior changes)

| Item | Notes |
|---|---|
| Backend lint job in CI | `.github/workflows/test.yml`; eslint+prettier exist, just not gated |
| config-tool: eslint + test scaffolding | Weakest component (zero lint, routes.js untested); add lint + a routes HTTP-test harness so Batch 2 config-tool fixes land test-first |
| scripts/: requirements.txt + pytest scaffold | Pure functions (`parse_sf_fields` etc.) testable immediately; F-TOOL-17/29 regressions |

## Batch 1 — Backend fix-now (parent repo; failing test first; contract-first where behavior changes)

### 1a. Score-state cluster (root cause: dual score ownership)
| Finding | Fix | Decision |
|---|---|---|
| F-BCORE-01 (P0) | metadata counters via production path | — |
| F-BCORE-02 (P0) | reset listener: real fields; coherent persist | A3 |
| F-BCORE-03 (P0) | rebuild preserves adminAdjustments; persist all teams | owner: adjustments replay on rebuild |
| F-BCORE-04 (P1) | reset clears `session.transactions` (+ device-scanned state) | A3 |
| F-BCORE-05/06 (P1) | createSession ends paused/setup; resume-from-setup throws | — |
| F-BCORE-07 (P1) | persistence write queue | — |
| Structural follow-on | **Dual-ownership collapse** (session.scores canonical) — scheduled as the first Phase-2 structural PR, after these point fixes prove the behaviors | review rec |

### 1b. Scan/replay cluster
| Finding | Fix | Decision |
|---|---|---|
| F-SCAN-05 + F-RT-01 (P1) | `/api/scan/batch`: NEVER queue videos; don't claim `videoQueued` | A4 |
| D1 | broadcast replayed scans to GMs (`player:scan` w/ `replayed:true`) + contract addition | D1 |
| F-SCAN-04 + D2 | DELETE backend offline-acceptance path (+ flag, + dead `getQueueSize` F-SCAN-16); keep GM-tx queue only if reconnect path needs it | D2 confirmed |
| F-SCAN-12 (P2) | response schemas in openapi (404/409-no-session/503) + response-side contract tests | — |
| F-SCAN-14 (P2) | per-item batch validation; reject/flag 1970 timestamps | — |
| F-SCAN-08 | wontfix — document intent (player scans allowed in setup/paused) | A6 |

### 1c. Group rules per A1
| Finding | Fix |
|---|---|
| F-SCAN-06 (P1) | backend `isGroupComplete` filters blackmarket (matches standalone + rebuild); order-dependence dissolves |
| F-SCAN-09 (P2) | min-2-tokens: backend stays; standalone fix → Batch 2 (submodule) |
| Test fixture | add 2+-token group fixture so parity E2E executes (also unblocks failing-test for A1) |

### 1d. Show-control fix-now (NOT gated on Tier E)
F-SHOW-02 (P0 ducking wiring + broadcast-wiring test) · F-SHOW-09 (lock pre-play hook) ·
F-SHOW-10 (no fixture fallback in prod) · F-SHOW-11 (mpd idle handlers via `_send`) ·
F-SHOW-13 partial (suspend cues on session end? → E4 gates policy; clock stopped-event push is ungated) ·
F-SHOW-18 (path guard) · F-SHOW-22 (hook order parity) · F-SHOW-23 (init health probe) ·
F-SHOW-14 (delete dead `applyRoutingWithFallback`/`updateFromSession`; **seek: C4 answered YES** →
add `video:seek`/`music:seek` actions contract-first, expose existing `vlcMprisService.seek()`) ·
F-GMCMD-08 (honest acks) · F-GMCMD-18 (queue durations) ·
F-GMCMD-01 backend half (add `paused` to videoQueueItem state machine + getState; freeze position) — with F-SHOW-21 hygiene ·
F-BCORE-08 (contract: nullable transactionId or synthesize) · F-BCORE-22/23 (trivia)

### 1e. Show-control fix-now (GATED on Tier E answers below)
F-SHOW-01+03 (cue restore + replay policy → E1) · F-SHOW-04 (95% threshold → E2) ·
F-SHOW-05/06 (restore target → E3; empty-array guard + serialization ungated)

### 1f. Pipeline/config-tool fix-now
| Finding | Fix | Gate |
|---|---|---|
| F-TOOL-01 (P0) | sync: abort-no-write-no-prune on any incomplete fetch | E8 posture |
| F-TOOL-06 (P1) | exempt placeholder.bmp (+ fix 5 doc claims) | — |
| F-TOOL-07 (P1) | abort/warn on empty character map | E8 |
| F-TOOL-02 (P1) | mask secrets in GET /api/config (ungated); auth approach | E7 |
| F-TOOL-03 (P1) | env newline/quote escaping | — |
| F-TOOL-04 (P1) | schema validation on all 4 config writers (+ loud backend fallbacks) | — |
| F-TOOL-10 (P2) | atomic writes everywhere (pattern exists in manifest writer) | — |
| F-TOOL-21 (P2) | duplicate-RFID warning | — |
| F-TOOL-14 (P2) | `in`-condition type coercion | — |
| F-TOOL-09 (P1) | video:paused/resumed triggers | E6 |

## Batch 2 — Scanner fix-now (BLOCKED on submodule access)
**ALNScanner:** F-GMS-01 (P0, per C7) · F-GMS-03 (delete echo + cache prune) · F-GMS-04 (XSS) ·
F-GMS-06 (mode persist) · F-GMS-07 (standalone endSession) · F-GMS-08 (strategy events) ·
F-GMS-10/F-GMCMD-03 (backend:error toast) · F-GMS-11 (queue indicator) · F-GMS-13 (fallback scoreboard delete) ·
F-GMCMD-02 (BT warning) · F-GMCMD-04 (select click guard) · F-GMCMD-06 (Now Showing single writer) ·
F-SCAN-07/F-GMS-05 (duplicate → "claimed by Team X", per A7) · standalone min-2 group rule (A1/F-SCAN-09)
**aln-memory-scanner:** F-SCAN-01 (4xx final, per A5) · F-SCAN-10 (stable batchId per batch) ·
F-PARITY-04 (persist deviceId) · F-PARITY-12 (img onerror) · F-PARITY-16 (dead retry scaffolding) · sw.js tokens network-first (F-PARITY-07)
**ESP32:** F-PARITY-02 (batchId persistence) · F-PARITY-03 (409 body-aware handling per A5) · F-PARITY-06 (async send)
**Parent contract edits supporting these:** F-GMS-12 (deviceScannedTokens into asyncapi) · F-GMCMD-14 (gm:identified) · F-SHOW-15 (cue:fired source/trigger)

## Phase 2 structural (post fix-now; aligned to platform seams)
Dual-ownership collapse → shared rules module (A1/A2/B1-B3 shapes) → transactionService/sessionService splits (per backend-core seams) → audioRouting split (PactlClient/Routing/DuckingEngine — absorbs F-SHOW-05/06/07/24/27) → cueEngine split (evaluator/timeline/HeldItemsStore — absorbs F-SHOW-08/16/20; normalizers-from-rules-module seam) → GM scanner four-domain split (C1; blueprint in gm-scanner-review) → aln-memory-scanner ES6 migration → report schema + contract test (before strings!) → tokens.json JSON Schema + structured group field → response-side + service-domain contract test coverage → doc-drift sweep (~46 items)

## Phase 3 platform (design docs first; gated on E9 + B4/B10 elicitations)
game.json (modes/groups/teams/clock-phases/surfaces per Tier B) · strings/theming (pre-fixes: window-title
coupling, scoreboard password, F-SHOW-29 third idle-loop literal) · B8 lighting-role mapping surface
(pre-fix: F-SHOW-10) · source adapter (= sync testability seam, F-TOOL-20 retry policy) · preset→
venue-profile/pack split (assessment in configtool-scripts review; needs versioned schema first, F-TOOL-12) ·
structured session bundle (B9) · ESP32 pack delivery · UX redesign (four domains, C2 sound/music model,
C3 BT pairing completion, C4 seek/QoL, C5 picker+reorder, report-intake capture points)

## Wontfix / intended (documented)
F-SCAN-08 (A6) · FCFS detective claims (A2) · F-PARITY-08 collection log (C6: web nicety) ·
F-PARITY-05 video UX → role spec decides treatment, offline variant per A4 alert ·
batch fire-and-forget per-item failures (F-PARITY-09 → server-side audit is the contract; document)

---

## Tier E — New owner questions from wave 2 (next decision chunk)

| # | Question | Recommendation |
|---|---|---|
| E1 | Cue restore after restart: past clock cues (a) marked-fired-without-firing, (b) replayed, (c) prompt? | (a) |
| E2 | Video 95% completion threshold: intentional margin or bug? | time-based: `duration − 1s` |
| E3 | Ducking restore target: captured pre-duck vs persisted user volume? | persisted user volume |
| E4 | Should event cues keep firing after session:end (post-game atmosphere) or suspend? | suspend; GM can re-enable |
| E5 | Compound-cue `at:` times before the video starts: clock-relative or wait-for-video? | gate entries until video starts |
| E6 | `video:paused`/`resumed` as standing-cue triggers: wire them or remove from editor? | wire them |
| E7 | config-tool: used during games or pre-show only? (decides auth approach; secrets get masked either way) | pre-show only + bind localhost/LAN-note; revisit if in-game use is wanted |
| E8 | Notion sync failure posture: abort-no-write default with `--force`; prune only after complete fetch; `--dry-run` default for prune? | yes to all three |
| E9 | Is the game pack the ALN-TokenData submodule (extended) or a new artifact feeding it? | extend the submodule (distribution already proven) — Phase 3 design doc argues this fully |
| E10 | config-tool post-write: add a "reload backend" action (system:reset or new reload endpoint) vs fix the docs to say restart required? | add reload action in Phase 3 (config surface work); fix docs now |
| E11 | Compare-tool: fix standalone or fold its checks into sync as pre-write validation? | fold into sync |
