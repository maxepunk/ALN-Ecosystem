# Phase 3 Program — Engine/Game-Pack Separation & Platform Build

**Date:** 2026-06-11 (this is the Phase 3.0 design doc)
**Status:** Draft for owner review. One decision requires ratification
(§7 Definition of Done); everything else synthesizes already-made
decisions into an executable structure.
**Companion deliverable:** the 3.1 schema drafts (game.json,
pack-manifest, installation-profile) follow this doc.

## 1. Purpose

**Make games data, not code.** Designing a new game = authoring a pack;
the engine never changes. The falsifiable test (Phase 4 gate): a toy
second game — different title, strings, modes, scoring, group rules, a
handful of tokens — passes the full E2E suite with **zero engine-code
changes**, and each claimed install tier runs via scripted capability
profiles.

## 2. Inputs ledger (what this doc synthesizes)

| Source | What it contributes |
|---|---|
| Tier A/B/C/D/E decision records | game-rule semantics, platform mechanics, show-control pipeline, UX scope, operational semantics (E1-E11) |
| capability-matrix.md (113 rows) | engine-fixed / game-configurable / game-content / venue classification |
| 2026-06-10 tooling proposal (Q1-Q3 decided) | two workspaces, draft+publish, LAN+password+HTTPS, real-device preview |
| 2026-06-11 kit-model decision (+stack/endpoints) | installation profile, install tiers, planning view, dormant-vs-fault |
| 2026-06-11 engine design notes (P1-P8) | ledger entity, attribution axis, device classes, function assignment, affordances, tap-to-web, pseudonymous sessions |
| O1-O5 + Q11 | open design questions RESOLVED IN the 3.1 docs (see §8) |
| Phase 2/2.x landed code | gameRules/ (tier-zero logic), four-domain GM split, TOKENS_PATH injection seam, capability vocabulary + harness manifest, session-report golden master, tokens.schema.json v1 |

## 3. The five tracks

### Track A — The Pack (the spine)
The engine/game separation itself. Everything else hangs off this.

1. **A1. Schemas (3.1):** `game.json` (modes B1, scoring tables B2, group
   rules B3, duplicate/claim policy A2, clock & phases B11, entity +
   attribution model O1, function-assignment table O2/P4, strings/theme
   catalog refs, narrative/report config B9), `pack-manifest`
   (version + content hash, file inventory, **hardware manifest**: roles,
   required instrument types/counts, token objects, device-class
   affordance requirements P5), and tokens.schema.json **v2** (structured
   group field — kills the "(xN)" microformat; coordinated change across
   backend + GM scanner parsers).
2. **A2. Runtime pack loading (3.1.5):** backend serves the active pack
   (`GET /api/pack/*`, extending /api/tokens + the asset-manifest
   channel); web scanners fetch at runtime (networked) with
   bundled-default + SW-cached refresh (standalone — see §6.1); ESP32
   pack delivery rides the existing asset-manifest sync; hot-reload/apply
   (E10) where safe; **staleness visibility**: every consumer reports
   loaded pack version/hash (sync:full, /health) — kills F-TOOL-05's
   silent-stale-scoring class. Grows directly from the 2.x.4 TOKENS_PATH
   seam (its first consumer and its test harness).
3. **A3. The extraction grind** (slice by slice, each slice = extract →
   toy pack exercises it → editor page consumes it):
   modes & mode names → scoring/group/duplicate policy (gameRules/
   already pure; this moves their CONFIG into the pack) → strings &
   theming (window titles, mode labels, transaction verbs, currency/
   locale, emoji vocabulary, scoreboard branding, CSS taxonomy classes;
   pre-fixes: scoreboard password, F-SHOW-29 third idle-loop literal) →
   cue/lighting ROLE references (B8: cues name roles, never HA entity
   ids) → clock/phase params (B11; overtime threshold out of env config)
   → display surfaces (B12) → report template refs (B9).

### Track B — Authoring tooling (consumes A, page by page)
config-tool restructured into **Design** and **Venue** workspaces
(decided). **B0 first** (per the 2026-06-11 config-tool pre-read,
docs/reviews/2026-06-11-config-tool-preread.md): pack/profile store with
draft→publish lifecycle (the tool stops editing live files), app-shell
shared store + model-module discipline + frontend test harness, auth from
the O3 design + backend-served trigger/action vocabulary. B0 is the
tool-side implementation of the A1/C1/O3 design docs (+≈1 session). Pages
then follow, build order = value ÷ effort, gated on the matching A3 slice:
pack manager (create/open/validate/diff/export, draft+**publish**,
"commit & push pack" making submodule state visible) → mechanics editor
(modes, scoring tables, group rules, duplicate policy, clock/phases;
teams block per O1's entity model) → strings & theme editor (in-browser
replica previews + **real-device scoreboard preview**, decided Q3) →
show designer upgrade (E5 three-segment timeline rendered at true video
duration; role pickers; trigger/condition vocab pinned to backend
contract — F-TOOL-09/32 class gets a pinning test) → content view
(read-only token browser + pack-level validation; Phase 5 docks here).

### Track C — Install/venue layer (co-evolves with A1)
1. **C1. Installation-profile schema:** this event's kit slice —
   installed endpoints, role→instrument bindings (B8), expected-live
   services, network/env. Replaces the preset system (versioned,
   F-TOOL-12; `kind: installation-profile`).
2. **C2. One resolution mechanism, three faces:** pack requirements ×
   capability profile → runs / degrades / unavailable. Faces: **planning
   view** ("what does bringing X unlock" — usable before packing the
   van), **preflight** (go/no-go against tonight's actual install,
   extending validateCommand + the existing health registry), **harness**
   (already built, 2.x.1 — same vocabulary, distinct profiles).
3. **C3. Dormant-vs-fault semantics:** health enum gains expected/dormant
   (contract change, coordinated with GM dashboard); endpoint-less game
   elements **disabled at session start** via the standing evaluator's
   existing disabledCues seam (never held-forever); SERVICE_DEPENDENCIES
   rejections distinguish "down" from "not installed tonight".
4. **C4. Lighting bindings page** (Venue workspace): pack roles ←→
   live-fetched HA scenes/WLED, Test buttons, UNBOUND-role flags.

### Track D — GM experience (visual half of the Phase 2 structural split)
Four-domain UX redesign (C1 decision; wireframes → owner walkthrough
before build) · C2 sound-vs-music mental model · C3 finish BT pairing
UI · C4 seek + playback QoL to standard-player par · C5 video picker +
queue reorder · dormant-aware health dashboard (from C3) · **report
intake** (photos, director notes, roster, accusation → Game Admin),
writing into the **B9 structured session bundle** (versioned JSON as the
canonical artifact; markdown report becomes a themed rendering; the
golden-master test protects the GenAI pipeline until its migration).

### Track E — Player platform (new; from the 2026-06-11 elicitation)
1. **E1. Spikes first (owner, cheap):** S1 tap a production token with an
   iPhone (NDEF URL background read fires?); S2 prototype real-domain +
   DNS-01 cert resolving to a LAN address on the Pi.
2. **E2. Trust plumbing:** real domain + real certificate for the
   orchestrator — de-jankifies EVERY web client (GM scanners and
   scoreboard included). Do early; broadest payoff in the whole phase.
3. **E3. Tap-to-web receiving experience:** OS tag-read → web client with
   token context (the URL-token path exists, vestigial); venue-WiFi
   onboarding; pseudonymous-by-default sessions with explicit
   claim-credit moments (P8/P2); per-game device-class roles (P3) so a
   design can keep stations scarce where scarcity is the mechanic.
4. **E4. Function-gated transaction API (O3):** device identity +
   pack-assigned permissions replace the GM-JWT-or-anonymous split; the
   SAME auth model serves bound stations, no-GM tiers, and the config
   tool (one identity story — see §6.2).
5. **E5. Interaction primitives v1 (O4):** scoped AFTER the spikes;
   engine ships few generic primitives, packs compose (P6); station
   primitives constrained by declared affordances (coarse-tap only).

## 4. Dependency spine & sequencing

```
A1 schemas ←co-design→ C1 installation-profile (+ capability vocabulary, drafted)
   │
A2 runtime pack loading  (consumes the 2.x.4 seam; §6.1 standalone design)
   │
A3 extraction slices ──→ B pages (each slice lands WITH its editor)
   │        │
   │        └─ toy pack grows as second consumer of EVERY slice (§5)
   │
C2/C3 resolution + dormancy ── after C1; C4 after B8 role extraction
D (GM UX) ───────────── parallel after wireframe walkthrough; report
                         intake gated on B9 bundle schema (in A1)
E2 cert/domain ───────── early + independent (after S2 spike)
E3/E4/E5 ─────────────── parallel after spikes; E4 designed in 3.1 (O3)
```

## 5. Methodology: the toy pack is not a Phase 4 artifact

Start the toy pack ("second game") the day A1 schemas exist, as a
near-empty pack. **Rule: no A3 extraction slice is done until the toy
pack exercises it and Tier L passes against BOTH packs** (the 2.x.4
injection machinery runs the suite per pack). Phase 4 then confirms
rather than discovers — the same way the fixture pack just made
group-completion parity testable for the first time. The toy pack lives
in-repo permanently as regression fixture and as
how-to-make-a-game-by-example.

## 6. Design problems to solve IN the 3.1 docs (not during build)

1. **Standalone pack loading.** Networked clients fetch from the
   orchestrator. True tier-zero (standalone GM, no orchestrator) needs:
   bundled default pack + service-worker-cached refresh + version
   display so a GM can SEE what pack/version their device holds. This is
   the hard half of A2 — design it first, not as a retrofit.
2. **One auth story.** Function-gated transactions (E4), config-tool
   LAN auth (decided: shared password + JWT), bound-station device
   identity, and pseudonymous player sessions must be ONE
   identity/permission model with different credential strengths — not
   three ad-hoc systems. O3 resolves here.
3. **Report contract evolution (Q11/B9).** Bundle schema is engine-fixed
   data; presentation is pack-variable; ALN's markdown stays
   byte-compatible (golden master) until the GenAI pipeline consumes the
   bundle. Sequence: bundle schema (A1) → intake writes bundle (D) →
   pipeline migration (owner-paced) → only then may the markdown vary.
4. **ESP32 pack delivery + primitive set.** Pack files ride the
   asset-manifest sync (planned); the CYD's interaction primitives are
   firmware-shipped and tiny (P6, affordance-constrained). Decide the v1
   primitive list with E5, not before the spikes.

## 7. Definition of Done — REQUIRES OWNER RATIFICATION

**Recommendation:** Phase 3 completes when **A + B + C** are done and
the Phase 4 gate passes (toy pack + tier ladder). **D and E are named
parallel tracks with their own gates**, started during Phase 3 but not
holding the phase boundary; they improve a game that already runs,
while A is what everything compounds on.

The alternative — all five tracks gate the boundary — roughly doubles
the phase and delays the falsifiable proof behind UX/platform work that
doesn't affect it.

Sub-gates either way:
- D gate: four-domain UX shipped + report intake writing B9 bundles.
- E gate: spikes evaluated → go/no-go on tap-to-web; if go: cert/domain
  + receiving experience + E4 auth model shipped; primitives v1 scoped.

## 8. Open decisions and where they land

| Item | Resolves in |
|---|---|
| O1 entity/attribution schema | A1 game.json draft |
| O2 device-class registry + affordances + function table | A1 + C1 drafts |
| O3 auth floor / one-auth-story | E4 design section of 3.1 |
| O4 interaction primitives v1 | after E1 spikes |
| O5 scan-economy expression | subsumed by function assignment (revisit only on demand) |
| Q11 report contract | §6.3 sequence (decided shape, owner-paced migration) |
| DoD | §7 — owner ratifies |

## 9. Estimates (sessions, same gates discipline as Phase 2)

A1+C1 schemas ≈1.5 · A2 ≈1.5 · A3 ≈2-3 (sliced) · B ≈2-3 (paged) ·
C2-C4 ≈1.5 · D ≈2-3 (after wireframes) · E2 ≈0.5 · E3-E5 ≈2 (post-spike)
→ core gate (A+B+C+Phase 4) ≈ 8-10; D+E tracks ≈ 4-6 alongside.

## 10. Immediate next deliverables

1. game.json + pack-manifest schema drafts (A1) with O1/O2 resolutions
   proposed for owner review
2. installation-profile schema draft (C1) folding in the capability
   vocabulary
3. Standalone-pack-loading design section (§6.1)
4. One-auth-story design section (§6.2 / O3)
5. Owner: ratify §7 DoD; run E1 spikes when convenient
