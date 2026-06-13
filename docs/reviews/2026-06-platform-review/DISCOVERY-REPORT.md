# Consolidated Discovery Report — ALN Ecosystem Platform Review

**Date:** 2026-06-09
**Inputs:** six wave-1 discovery reviews in this directory:
`flows-gm-commands.md` · `flows-scan-transaction.md` · `backend-core-review.md` ·
`gm-scanner-review.md` · `parity-audit.md` · `capability-matrix.md`
**Purpose:** the single document the owner reads. Leads with decisions to talk
through; full evidence lives in the per-unit reports (every finding there has
file:line traces).

## Scorecard

| | P0 confirmed bugs | P1 likely defects | P2 debt | P3 polish |
|---|---|---|---|---|
| GM command flows | 3 | 5 | 7 | 7 |
| Scan/transaction flows | 1 | 8 | 7 | 4 |
| Backend core | 3 | 4 | 10 | 6 |
| GM scanner static | 1 | 4 | 10 | 10 |
| Player-scanner parity | 0 | 3 | 6 | 7 |
| **Totals** | **8** | **24** | **40** | **34** |

Plus: capability matrix (113 rows: 62 engine-fixed / 17 game-configurable /
18 game-content / 7 venue-config / 9 uncertain), a draft player-scanner role
spec, a GM-scanner domain-split blueprint, ~32 doc-drift items, and 42 owner
questions consolidated into the decision agenda below.

---

## The Big Picture (six cross-cutting conclusions)

### 1. The happy path is solid. Everything around correction and recovery is where it breaks.
Live scan → score → broadcast → UI traces clean end-to-end, in both modes.
All 8 P0s and most P1s live in the *secondary* paths: score reset, transaction
delete, restart restore, page reload, reboot, offline replay, pause. These are
exactly the paths exercised under game-night stress and almost never in
rehearsal — they explain the "works but feels broken" experience.

### 2. One root cause underlies the worst backend bugs: dual score ownership.
`transactionService.teamScores` (in-memory Map) and `session.scores`
(persisted array) are synchronized by four hand-written paths; all three
backend P0s are desync bugs between them (stale metadata, resurrected scores
after reset+restart, admin adjustments wiped by any transaction delete).
**Consequence for the plan:** collapsing this dual ownership is now a named
prerequisite before the engine/game-rules split — otherwise the split
fossilizes the duplication.

### 3. The components disagree about the protocol's edge semantics.
The contracts are good for happy paths, but error/edge semantics drifted in
implementation and are not contract-tested: 409 means three different things
to three components (ESP32 drops pre-session scans as "success"; web requeues
video-busy scans into surprise replays; backend never sends the 409 the docs
describe). The ESP32's reboot-reset batch counter collides with the backend's
idempotency cache → silent scan loss. The backend's own offline-queue drain
*logs* player scans instead of persisting them. **Consequence:** response-side
contract tests (not just request-side) are a Phase 2 must.

### 4. The game rules exist in three divergent implementations — worse than "duplicated."
Group completion: backend live path counts detective tokens (order-dependently
— bonus fires only if the *last* group token is blackmarket), standalone never
counts them, and the backend's own delete-rebuild path uses a third rule that
silently revokes the bonus. Single-token groups bonus in standalone only.
Memory-type lookup is case-insensitive networked, case-sensitive standalone.
All currently *latent* (production token data has no real groups) — which is
also why the flagship parity E2E test silently self-skips and certifies
nothing. **Consequence:** the shared-rules-module extraction is confirmed as
the flagship Phase 2 item, with rule *semantics* decisions needed from the
owner first (agenda §A).

### 5. The test suite's weakness is seams and certified bugs, not coverage.
Multiple unit tests assert the broken behavior (standalone-restore P0, the
`getTeamCompletedGroups → []` mock, `transactionId: null` contract violation,
metadata test that bypasses the production path). The strongest layer is the
backend contract tests; the weakest is integration seams (UDM↔strategy↔UI,
processScan↔session). The coverage ratchet measures lines, not seams — as
suspected.

### 6. The platform is *closer* than the 35% estimate suggested — with three traps.
The wire protocol is almost engine-clean (game flavor leaks at exactly four
points: `mode` enum, `group:completed`, TeamScore group fields, session-report
markdown). Distribution channels for game packs already exist (the token
submodule + the ESP32 asset manifest). config-tool presets are a
proto-game-pack at the wrong granularity. Traps discovered: (a) a **third
config bucket — venue-config** (routing/ducking/HA scene IDs) that the pack
must explicitly exclude or packs won't be venue-portable; (b) the scoreboard
window is located by its themed `<title>` string — naive strings extraction
breaks window management; (c) scoreboard.html hardcodes the admin password.

---

## The 8 confirmed bugs (P0)

| # | Finding | One line | Where fixable |
|---|---|---|---|
| 1 | F-BCORE-01 | Session scan metadata (totalScans/uniqueTokens) never updates for GM scans | backend (parent repo — unblocked) |
| 2 | F-BCORE-02 | Score reset + restart resurrects pre-reset scores (listener writes nonexistent fields) | backend |
| 3 | F-BCORE-03 | Any transaction delete silently wipes ALL teams' admin adjustments | backend |
| 4 | F-SCAN-01 | Web scanner requeues 409-rejected scans → duplicate records + videos playing hours later | aln-memory-scanner (submodule) + backend ordering |
| 5 | F-GMCMD-01 | Video pause unrepresentable: panel shows "Playing" + advancing progress bar while paused | backend getState + scanner renderer |
| 6 | F-GMCMD-02 | "No Bluetooth — using HDMI" warning can never display (both writers hide it) | ALNScanner (submodule) |
| 7 | F-GMCMD-03 | Backend error events never shown to operator (contract violation; no listener) | ALNScanner (submodule) |
| 8 | F-GMS-01 | Standalone reload bricks scanning (restore path skips storage-strategy init); unit test certifies it | ALNScanner (submodule) |

High-priority P1s worth the same breath: ESP32 silent scan loss on reboot
(batchId reuse — F-PARITY-02/F-SCAN-02), ESP32 drops all pre-session scans
(F-SCAN-03), backend offline-drain loses player scans (F-SCAN-04), cross-device
GM duplicates show false "Transaction Complete!" (F-SCAN-07/F-GMS-05), XSS via
NFC tokenId/team names into innerHTML (F-GMS-04), `<select>` click fires
commands — opening the playlist picker restarts music (F-GMCMD-04).

---

## Decision Agenda (what we need from the owner, tiered)

### Tier A — Game-rule semantics (gate the fix-now/Phase-2 fixes; each currently has 2-3 contradictory implementations)
1. **Detective tokens & groups:** do exposed (detective) tokens count toward
   group completion? Backend-live says yes (order-dependently), standalone
   says no, backend-rebuild says no. Pick one. *(F-SCAN-06)*
2. **Detective claims = permanent?** A detective scan permanently blocks any
   team from later selling that token (FCFS counts it). Intended
   "decide-once-irrevocably," or bug? *(BCORE Q1, matrix Q4)*
3. **`scores:reset` semantics:** full restart (clear transactions too) or
   score-only (keep history)? Today's half-state causes ghost-score
   resurrection. *(F-BCORE-04)*
4. **Replayed scans & video:** should batch-replayed scans ever trigger
   videos (currently: first one fires at upload time, even session-less)?
   Proposal: never, or only within N minutes of scan time. *(F-SCAN-05)*
5. **409 policy for player scanners:** queue-and-retry no-session scans,
   accept video-busy as final — confirm, then both implementations align.
   *(F-PARITY-03)*
6. **Player scans during setup/paused sessions:** allowed (intel gathering
   pre-game) or gated like GM scans? *(F-SCAN-08)*
7. **Cross-device duplicate UX:** surface "claimed by Team X" to the scanning
   GM (toast), and/or mark tokens from other GMs' broadcasts to prevent the
   attempt? *(F-SCAN-07/F-GMS-05)*

### Tier B — Platform shape (gate game.json schema; full list = capability-matrix §10, Q1-Q14)
The three most consequential:
1. **Q1 Modes:** is sell-vs-expose a fixed engine duality, or can a game
   define N modes (each with name, scoring policy, scoreboard behavior)?
2. **Q2 Scoring formula:** is `base[rating] × mult[type]` the permanent
   engine formula (games supply tables only — dramatically cheaper), or do
   games need structurally different formulas?
3. **Q3 Group mechanics:** is collect-all → multiplier-bonus the only
   completion mechanic, or are partial/ordered/cross-team variants needed?
Plus: team structure (Q5), evidence-exposure behavior (Q6), ducking ownership
game-vs-venue (Q8), lighting scene roles vs HA entity IDs (Q9), report
contract theming (Q11), player-role fixedness (Q12), clock phases (Q13),
display surfaces (Q14), score presentation semantics (Q7).

### Tier C — UX/scope decisions (gate the three-domain UX design)
1. **Where does video/show-control live** in Game Ops / Environment / Game
   Admin? It's the largest admin surface and fits none cleanly. *(GMS Q1)*
2. **Sound UI:** GM-playable sounds, or cue-only? (Today: status display
   with no stop button — a stuck sound is unrecoverable from the UI.)
3. **Bluetooth pairing:** in-UI (needs backend discovered-devices state) or
   CLI-only (then remove the inviting-but-dead scan flow)?
4. **Missing standard controls:** seek (video+music progress bars look
   interactive, aren't); video file picker (needs `GET /api/videos`);
   queue reorder UI; pre-attempt control disabling when services are down.
5. **Player-scanner role:** is the collection/"memory log" part of the role
   (ESP32 lacks it)? ESP32 passive connectivity glyph? teamId on player
   scanners at all? ESP32 explicit standalone stance (Q10)?
6. **Standalone reload:** supported scenario (fix F-GMS-01 properly) or
   "reload = fresh start" acceptable? (Recommend: supported — it's a
   mid-show crash-recovery path.)

### Tier D — Pipeline/report
1. Report contract: pin the three parsed table structures as engine-fixed
   (recommended) vs game-variable (forces pipeline parser config). *(Q11)*
2. Batch visibility: push sync:full (or flagged player:scan) after batch
   processing so Game Activity reflects drained queues?
3. Backend offline-queue mode (`isOffline` HTTP path): still supported?
   If yes fix F-SCAN-04; if no, delete the path.

---

## Recommended execution from here

1. **Triage conversation** (the agenda above; Tier A first — those answers
   unblock the most code).
2. **Fix-now batch, backend track** (parent repo, unblocked today; backend
   already has lint+ratchet): F-BCORE-01/02/03 with failing tests first;
   F-SCAN-04; F-GMCMD-08 (no-op acks); F-GMCMD-18; response-side contract
   tests for /api/scan; the dual-score-ownership collapse as the structural
   fix behind BCORE-01/02/03.
3. **Fix-now batch, scanner track** (needs submodule access): F-GMS-01,
   F-GMCMD-02/03, F-GMS-03 (delete-echo), F-GMS-04 (XSS), F-GMS-06/07/08/11/13,
   F-GMCMD-04 (select-click), F-PARITY-02 (ESP32 batchId), F-PARITY-04
   (web deviceId), F-PARITY-12 — plus Phase 0 lint/CI for the scanner repos
   before this batch lands.
4. **Doc-drift cleanup** (parent + submodules): ~32 items across all six
   reports; cheap, prevents the next misleading-docs incident.
5. **Phase 2 structure** stays as planned with one amendment (dual-ownership
   prerequisite) and one addition (report schema + contract test BEFORE any
   strings work).
6. **Wave 2 discovery** (smaller, can run during/after triage): show-control
   services static review (audioRouting/cueEngine internals — flow traces
   covered their wiring but not their internals), config-tool/scripts static
   review, live runtime exploratory pass to confirm the P1s marked
   needs-runtime-confirmation.

## What changed in the plan because of discovery

- Dual score ownership collapse = named prerequisite to the rules-module split.
- Venue-config = third config bucket; game.json schema must exclude it.
- Strings extraction has two named pre-fixes (scoreboard window-title
  coupling; scoreboard admin password hardcode).
- Response-side contract testing added to Phase 2 scope.
- The parity E2E self-skip means test fixtures need a real 2+-token group
  regardless of which group-rule semantics the owner picks.
