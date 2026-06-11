# Phase 2.x — E2E Harness as Platform Infrastructure

**Date:** 2026-06-11
**Status:** ✅ EXECUTED 2026-06-11 (all four items + exit criteria; see
Completion record at the bottom)
**Assessment basis:** docs/reviews/2026-06-platform-review/e2e-harness-assessment.md
**Position in the workflow:** between Phase 2 (structural, COMPLETE) and the
Phase 3 build. Phase 3 *design* docs (3.0/3.1 schemas) proceed in parallel —
two of the 2.x items are explicitly co-designed with them.

## Why this is platform work, not test chores

Three of the four items are rehearsals of Phase 3/4 product problems:

1. **Capability manifest ≙ venue preflight.** Phase 3's Venue workspace
   needs a go/no-go preflight (probe venue hardware, check every pack
   reference resolves). The harness capability model is the same artifact:
   enumerate capabilities, declare requirements, degrade loudly. Build them
   on ONE vocabulary and (where sensible) one probe implementation
   (`validateCommand` / serviceHealthRegistry are the shared substrate).
2. **Fixture injection ≙ runtime pack loading's first consumer.** "Run the
   suite against an injected token set" is primitive "run the system on a
   different game pack." When game.json lands, the harness runs the WHOLE
   E2E suite against a synthetic second game — which IS Phase 4 acceptance
   test 1. It is also the only practical way to test the never-field-tested
   deployment topologies (Phase 4 acceptance test 2): each topology is just
   a capability profile.
3. **Tier L CI floor ≙ Phase 3 development speed.** Phase 3's surface (pack
   loading, draft/publish, config-tool workspaces, staleness) is almost all
   logic — Tier L. Without tiering, every Phase 3 change lands against a
   30-minute Pi-only suite; with it, a fast E2E gate runs everywhere.
4. The event-cache redesign is plain hardening, but do it BEFORE Phase 3
   adds event types (pack:updated, publish lifecycle) to the helper's blast
   radius.

## Work items

### 2.x.1 — Capability manifest + declared requirements
- One probe at suite start → `{vlc, sound, lighting, bluetooth, audio, ha,
  music}` manifest (reuse serviceHealthRegistry semantics; the per-flow
  `setupVLC`/health fetches collapse into it).
- `requireCapabilities(test, [...])` helper: uniform loud skip. Replace every
  hand-rolled health check in flows. RULE (established in the 2026-06-11
  audit, enforce in review): primary paths skip loudly; designed-degradation
  paths are their own named tests gated the opposite way; NEVER a silent
  if/else branch on environment.
- Run report ends with the manifest + per-tier counts ("all green" must
  never again mean "the show was silently skipped").
- **Co-design coupling:** the capability vocabulary is drafted together with
  the installation-profile schema (Phase 3.1, B7/B8 — see the kit-model
  decision, docs/decisions/2026-06-11-kit-model-install-tiers.md): games ship
  as scalable hardware KITS, and the same vocabulary drives (1) the planning
  view "what install tier unlocks what game elements", (2) the venue
  preflight, and (3) this harness manifest. SCOPE HONESTY (per the
  stack/endpoints refinement in the kit-model decision): the harness
  manifest models TEST environments, which can be partial-stack in ways
  production never is — shared vocabulary with install tiers, distinct
  profiles; only endpoint absence realistically simulates a production
  tier.

### 2.x.2 — Suite tiering
- **Tier L (logic/UI):** session lifecycle, scan/score, duplicates,
  multi-client propagation, scoreboard, player scanner, admin UI, pack
  loading (when it lands). Must be 100% runnable + green on any machine.
  Becomes a CI job and the pre-merge E2E floor (~115 tests today).
- **Tier H (hardware):** video/display, real audio, BT, lighting. Pi-only,
  tagged (Playwright project or grep tag), run as the pre-show/release gate.
- **Tier L parallelization (deliverable):** `workers=1` exists to protect
  SYSTEM-GLOBAL resources (the Chromium kiosk, pkill loops, fixed ports) —
  all Tier H concerns. Tier L flows use per-flow orchestrators on random
  ports and should parallelize; per-flow server boot dominates the current
  ~30-min wall clock. Target: Tier L CI job ≤ ~15 min.
- NOTE: current CI (test.yml) runs NO E2E at all — the Tier L job is
  net-new (runner needs Playwright chromium; the 2026-06-11 toolless-
  sandbox runs prove viability).
- Exit: one command per tier; CI runs Tier L on the parent repo.

### 2.x.3 — websocket-core event-cache redesign
- Replace cache-then-wait with explicit listener-before-action ordering; no
  cross-action cache. Delete the 31 `clearEventCache` call sites. The false
  system-reset quarantine was this footgun's work.

### 2.x.4 — Content-independent fixture injection
- A flow can inject a fixture token set (and later: a full pack) via the
  existing test-server env injection, defaulting to production data.
- First users: group-completion flow (production has NO completable group),
  video flows (media files absent off-Pi).
- **Forward coupling:** the injection seam is designed as "give the system a
  pack," so Phase 3's runtime pack loading slots into the same seam and
  Phase 4's toy-pack suite run is `injectPack(toyPack) + run Tier L+H`.

### Already landed (2026-06-11 audit)
- Drift gates in the fast unit suite (page-object self-consistency +
  selector existence vs app sources).
- Loud-skip + named-degradation-test pattern applied to the cue/display/
  multi-device flows; held-path behavior E2E-asserted for the first time.
- No-fixed-sleeps and no-silent-env-branch rules documented (lint rule for
  `waitForTimeout` in flows belongs to 2.x.2's CI wiring).

## Out of scope (decided 2026-06-11)
- **Tap-to-web / real-domain-cert plumbing** (engine-design-notes P7,
  spikes S1/S2) is Phase 3 work — product infrastructure, not harness.
  The harness benefits when it lands but does not wait for it.

## Sequencing

```
Phase 3.0/3.1 design docs (schemas) ──┬─ co-design capability vocabulary (2.x.1)
                                      │
2.x.3 event-cache  ── independent, first (small, de-risks everything after)
2.x.1 capability manifest ─┐
2.x.2 tiering + CI floor ──┴─ together (tiering consumes the manifest)
2.x.4 fixture injection ── after 2.x.1; BEFORE Phase 3.1.5 runtime pack
                           loading (its design feeds the loading seam)
```

Phase 3 BUILD (3.1.5 onward) starts after 2.x.1/2.x.2/2.x.4 — the build then
develops against a fast Tier L gate from day one, and the pack-loading work
inherits a consumer-tested seam.

## Exit criteria
- Tier L green in CI on a toolless runner, zero silent environment branches
  (greps for `serviceHealth` inside flow bodies return only
  `requireCapabilities` usage).
- `clearEventCache` no longer exists.
- Group-completion E2E runs green everywhere via injected fixture.
- Capability vocabulary section exists in the installation-profile schema
  doc and matches the harness manifest keys.
- Run report shows manifest + tier counts.

## Estimate
≈2 sessions (2.x.3 small; 2.x.1+2.x.2 one focused session; 2.x.4 one) —
comparable to one Phase 2 batch, with the same gates discipline.

## Completion record (2026-06-11)

- **2.x.3** ✅ waitForEvent is pure listener-from-now; clearEventCache and
  getCachedEvent no longer exist (31 call sites removed); explicit history
  = socket.initialSync + lastServiceState state-mirror only.
- **2.x.1** ✅ tests/e2e/helpers/capabilities.js (getCapabilities /
  requireCapabilities / requireDegraded / waitForCapability / manifest);
  ~64 hand-rolled health checks across 10 flows migrated; vocabulary draft
  at docs/proposals/2026-06-11-capability-vocabulary.md (folds into the
  installation-profile schema doc at Phase 3.1).
- **2.x.2** ✅ @hardware tags (08/22/25 — 22 tests), test:e2e:tier-l
  (workers=3) / test:e2e:tier-h scripts, manifest-reporter prints
  host-tool manifest + tier counts on every run, Tier L CI job added to
  test.yml (summary-gated), no-fixed-sleeps lint rule (8 time-semantic
  waits annotated with justifications, 5 racy settles converted to
  condition polls).
- **2.x.4** ✅ TOKENS_PATH injection seam (tokenService first-candidate +
  conditional scanner-relative routes in app.js — zero production change
  when unset), startOrchestrator({tokensPath}), schema-validated fixture
  pack; flow 07c opted in: **group-completion parity runs green E2E for
  the first time** (production data has no completable group).
- **Gates:** unit+contract 2068, integration 336/336, lint 0, ratchet
  76/76, Tier L E2E 112 passed / 0 failed at workers=3 (~9-10 min; the
  pre-tag full-suite parallel proof: 111 passed, 9.7 min vs ~30 serial).
