# Decision Record: Tier A — Game-Rule Semantics

**Date:** 2026-06-09
**Decided by:** owner (max@maxepunk.com), via discovery-report triage
**Context:** Wave-1 discovery found these seven rules implemented 2-3
contradictory ways. Owner picked the intended rule for each. These decisions
gate the fix-now batches; finding IDs reference the wave-1 reports in
`docs/reviews/2026-06-platform-review/`.

## A1 — Detective tokens do NOT count toward group completion

All point-related mechanics belong to Black Market transactions only.

- **Correct today:** standalone (`LocalStorage._checkGroupCompletion` filters
  `mode === 'blackmarket'`) and the backend *rebuild* path.
- **Wrong today:** backend live path (`transactionService.isGroupComplete`
  counts all accepted transactions, order-dependently). Fix: filter to
  blackmarket, matching standalone.
- Side effect: with completion restricted to blackmarket members, the
  bonus-base divergence (catalog values vs transaction points) converges —
  both sum the same numbers. Keep the shared-rules module as the place where
  this is enforced by construction.
- Resolves: F-SCAN-06 (all three sub-divergences), informs F-GMS-02.
- Test fixture requirement stands: add a 2+-token group so the parity E2E
  stops self-skipping.

## A2 — Token claims are permanent ("used up")

Once a token is transacted (sold OR added to the detective log), it is
consumed for the session. First-come-first-served across teams, detective
claims included, is **intended behavior**.

- No code change; document in SCORING_LOGIC.md and the duplicate-policy code.
- **Platform note (owner):** this may be a per-game configurable mechanic in
  the future → matrix Q4 answer = "policy switch in game.json eventually;
  ALN = claim-once". Feed into game.json `duplicatePolicy` design.
- Resolves: BCORE open question 1, matrix Q4 (direction).

## A3 — Score reset ALSO clears transaction history

"Reset All Scores" = full game restart semantics.

- Fix direction for F-BCORE-04: `resetScores` must clear
  `session.transactions` (and playerScans? — assume transactions only;
  playerScans are intel-tracking, not points. Confirm if disputed).
- F-BCORE-02 (broken field names in the reset listener) still needs its own
  fix; with A3, the listener should clear score entries AND transactions and
  persist coherently.
- Dedup state: clearing transactions implies cleared device-scanned-token
  state (tokens become claimable again) — consistent with "full restart".

## A4 — Replayed scans NEVER trigger video playback

If video playback is unavailable at scan time (orchestrator offline, video
busy, no session), the user is **alerted at scan time**, and that scan must
not start playback later.

- Backend: `/api/scan/batch` must never call `videoQueueService.addToQueue`.
  Also kills the no-session batch-video bug (F-SCAN-05).
- Scanners: video tokens scanned while offline/queued should show a
  "video unavailable — rescan later" treatment, not the normal
  video-triggered treatment (today both implementations show the video
  treatment even when merely queued — F-PARITY-05 noted parity-in-the-flaw).
- Resolves: F-SCAN-05; reshapes F-PARITY-05 (UX treatment per state).

## A5 — Server-rejected scans are FINAL (no requeue); rescan to retry

If video can't be triggered in realtime, the user must rescan later. Rejected
(4xx) scans are definitive — the offline queue exists ONLY for
network-unreachable failures.

- Web scanner: fix F-SCAN-01 exactly as proposed — queue only on
  network-level failure (fetch rejection / 5xx); 4xx = final + user alert.
- ESP32: stop treating 409 as success (F-SCAN-03 / F-PARITY-03); show the
  failure (e.g., reuse SCAN_FAILED screen pattern), do not queue.
- Local content display is unaffected in all cases (core function stays
  offline-capable); the alert concerns the video/recording aspect only.
- Resolves: F-SCAN-01 (P0), F-SCAN-03, F-PARITY-03.

## A6 — Player scans during setup/paused sessions are ALLOWED (intentional)

Purpose: flow testing during the setup phase of a game.

- Current behavior is correct; no gate added. Document in scanRoutes and
  root CLAUDE.md (player scans accepted whenever a session exists, any
  status; GM transactions remain active-only).
- Resolves: F-SCAN-08 → reclassified `wontfix` (documented intent).

## A7 — Cross-device duplicates must surface "already claimed by Team X"

GM-B scanning a token GM-A processed must see the claim message, not a false
"Transaction Complete!".

- Minimum fix: stop swallowing `transaction:result status:'duplicate'` —
  dispatch it to the UI as the claimed-by message (replace/correct the
  optimistic result screen).
- Recommended addition (implementation choice, not yet owner-mandated):
  mark tokens scanned from `transaction:new` broadcasts so the attempt is
  blocked client-side before the optimistic screen ever shows.
- Resolves: F-SCAN-07 / F-GMS-05.

---

**Downstream:** these answers feed the shared-rules module spec (Phase 2
flagship), the player-scanner role spec (parity audit §3), and game.json
`modes` / `duplicatePolicy` / `groupRules` design (Phase 3).
