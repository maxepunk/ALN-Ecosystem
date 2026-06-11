# E2E Harness Design Assessment

**Date:** 2026-06-11 (Phase 2 closeout)
**Trigger:** owner question during the Phase 2 E2E audit — "is the e2e harness
design actually optimal for this system? important for stability and
reliability once we are past Phase 2."
**Evidence base:** first-ever full E2E runs outside the Pi (toolless sandbox),
the Phase-2 cross-reference audit (selectors/actions/page-object API vs the
refactored apps), and the failure triage that followed.

## Verdict in one paragraph

The harness's core philosophy — **real-first, no mock fallback** (stated
identically in vlc-service.js, sound-service.js, ha-service.js) — is the right
choice for a hardware show-control system: E2E exists to prove the show works,
and a mocked VLC proves nothing about the show. The structural weakness is
that this philosophy was implemented WITHOUT an environment-capability model:
each flow hand-rolls its own health checks (or doesn't), so on any machine
that isn't the fully-equipped Pi, coverage silently mutates — some tests skip,
some assert vacuously, some fail on designed degradation paths (held cues),
and nothing in the report says which game-critical flows actually ran. That is
the reliability gap to close before Phase 3 multiplies the surface (config-tool
workspaces, pack loading, more E2E).

## What the audit found (evidence)

| Finding | Class |
|---|---|
| 22/22 flows boot their own orchestrator (~7s + VLC wait each) → 30-min wall-clock, workers=1 | design cost, deliberate (isolation) |
| `webServer` in playwright.config is commented out — per-flow servers are the sole mechanism | confirmed intentional |
| 13 fixed sleeps in flows despite condition-based helpers existing (`wait-conditions.js`, `waitForEvent`) | drift from own conventions; caused the system-reset false quarantine |
| `websocket-core.js` event cache (`socket.lastGmCommandAck`) requires 31 manual `clearEventCache` call sites; a missed one resolves `waitForEvent` from a STALE ack | helper footgun (root cause of the false quarantine) |
| 15 page-object members referenced UI that exists in NO version of the scanner (settings screen, admin transaction log, Returns-To indicator, bt/lighting fallback states); several `expect(...).toBe(false)` assertions passed vacuously for their entire life | no app↔harness drift detection |
| Cue tests assumed fire-on-down-dependency; the held system (by design) holds instead — primary-path tests failed on degraded envs and NOTHING covered the held path E2E | env-behavior fork unmodeled |
| Flow 21 asserted `retryCount`, deleted in Batch 2 (F-PARITY-16) — first run since caught it | suites must RUN to protect; they hadn't |
| Scoreboard loaded socket.io from cdn.socket.io → dead scoreboard on any internet-less venue (PRODUCT bug, fixed: served from the orchestrator, version-matched) | E2E-found product bug |
| `ProcessMonitor` and the E2E vlc-service both crashed on spawn-ENOENT (unhandled child 'error') — the former would crash the PRODUCTION orchestrator on a missing/corrupt binary | E2E-found product bug |
| E2E uses production tokens.json (by design): group-completion flow self-skips because production data has NO completable group (Marcus Mention is x1) — also unreachable in the real game | content-coupled coverage (owner decision pending) |

## What is RIGHT and should be kept

1. **Real-first, no mocks.** Correct for this system. Do not add stub
   binaries; fidelity is the point of this layer (unit/integration already
   cover logic exhaustively — 2,000+ backend tests).
2. **Per-flow orchestrator lifecycle.** Expensive but honest: restart
   recovery, persistence, and listener-leak classes of bug are only testable
   this way, and cross-flow contamination (the disease the integration suite
   fights constantly) is structurally impossible. Keep; recover speed via
   tiering (below), not by sharing servers.
3. **Page objects + condition-based wait helpers + production token data.**
   Sound patterns; the failures were drift, not design.

## Recommended changes (Phase 2.x backlog, before Phase 3 E2E growth)

### 1. Explicit capability model (the big one)
One probe at suite start (the per-flow `setupVLC`/health fetches already
gather this) producing a **capability manifest**: `{vlc, sound, lighting,
bluetooth, audio, ha}`. Flows DECLARE requirements instead of hand-rolling
checks:

```js
requireCapabilities(test, ['sound', 'lighting']); // skip-with-reason, uniformly
```

- Primary-path tests skip LOUDLY when a capability is absent (never silent
  if/else branches — a silent branch means a broken health probe silently
  un-tests the happy path everywhere, including the Pi).
- Designed-degradation paths (held cues, offline queues, BT fallback) become
  their own named tests gated the OPPOSITE way — degraded envs then EXERCISE
  the venue-failure behaviors the Pi never can. (Started in this pass:
  held-propagation and held+discard tests now run/pass in the sandbox.)
- The run report ends with the capability manifest + counts per tier, so "all
  green" can never again mean "most of the show was silently skipped".

### 2. Tier the suite by capability, not by file
- **Tier L (logic/UI):** session lifecycle, scanning/scoring, duplicates,
  multi-client propagation, scoreboard, player scanner, admin UI — must be
  100% runnable and green on ANY machine (CI gate). After this pass the
  sandbox runs ~110 of these green; make that an enforced floor.
- **Tier H (hardware):** video playback/display, real audio, BT, HA — Pi-only,
  tagged (`@hardware` or a Playwright project), run as the pre-show/release
  gate. The "69 skipped" of a sandbox run becomes an EXPECTED, reported number.

### 3. Kill the event-cache footgun
Replace `websocket-core.js`'s cache-then-wait with explicit
`startWaiting(event) → emit → await` ordering (listener registered BEFORE the
action, no cross-action cache). The 31 `clearEventCache` call sites and the
false quarantine were all symptoms of one helper default.

### 4. App↔harness drift gates (cheap, high value)
- Page-object self-consistency check (every `this.*` used is defined) — a
  10-line static test, would have caught all 15 dead members. Added this pass
  as an ad-hoc script; make it a unit test in the backend suite.
- Selector existence audit: every `#id` in page objects greps against
  ALNScanner/PWA sources (monorepo makes this trivial). Run with the
  pre-merge checks.
- Zero new fixed sleeps in flows (lint rule for `waitForTimeout`/`setTimeout`
  in tests/e2e/flows).

### 5. Content-independent fixtures for content-dependent coverage
Group-completion and video flows currently depend on what the CURRENT game's
tokens.json happens to contain. Keep production data as the default (it
validates the real deployment) but allow a flow to inject a fixture token set
via the existing test-server env injection when the production set lacks the
shape (no completable group today). Owner note: production has no completable
group at all — decide whether that's intended game content.

## Owner notes surfaced by this audit
- **No completable group in production tokens** (Marcus Mention x1 only):
  group bonuses are currently unreachable in the live game.
- **Unbuilt fallback UI:** the scanner renders nothing for "bluetooth
  unavailable", "lighting not connected", or a "Returns To" indicator during
  video-behind-scoreboard — tests referenced all three as if they existed.
  Candidates for the Phase 3 UX pass (C1/C4) or explicit wontfix.
- **Google Fonts CDN** in scoreboard.html: degrades to fallback fonts when the
  venue has no internet (cosmetic, unlike the now-fixed socket.io CDN which
  was fatal).
