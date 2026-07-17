# Phase 3 Program — Engine/Game-Pack Separation & Platform Build

**Date:** 2026-06-11 (this is the Phase 3.0 design doc)
**Status:** ACTIVE — DoD RATIFIED by owner (2026-06-12): Phase 3 = A+B+C
gated by the toy-pack proof; Tracks D and E moved OUT to **Phase 4** (not
parallel tracks) with E1 spikes + E2 cert/domain + O3 auth DESIGN retained
inside Phase 3 (E2 reclassified as Track C infrastructure). Live execution
state: docs/plans/PHASE3-STATUS.md.
**AMENDED 2026-07-17** (owner-directed, post-A2 forward audit + BILL
scoping — see §11): A3 slice list revised in place (§3); E4/E5 sharpened
in place (Track E); platform-phases vs game-projects framing adopted.
DoD and phase gates UNCHANGED.
**Companion deliverable:** the 3.1 schema drafts (game.json,
pack-manifest, installation-profile) follow this doc.

## 1. Purpose

**Make ALN-class games data, not code.** For games that fit the
engine's implemented model (transaction-at-station scoring, tabular
values, all-of-group completion), designing a new game = authoring a
pack with ZERO engine changes — that is the falsifiable Phase-3 gate.
Games in a NEW mechanical class ship a small set of generic,
pack-parameterized engine modules (see §11.3 platform-vs-game-projects;
the BILL scoping is the worked example): per-game code TRENDS toward
zero as the module library grows, but is not zero for the first game of
a new class. The falsifiable test (Phase 4 gate): a toy
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
3. **A3. The extraction grind** (slice by slice; the per-slice GATE =
   toy pack exercises it + dual-pack Tier L green. The consuming B page
   follows in Track B after B0 — the editor is NOT part of the slice
   gate; adversarial review R10 resolved the earlier contradictory
   wording). *Slice list REVISED 2026-07-17 (§11 amendments):*
   - **Slice 0 — gate infrastructure (FIRST, small):** dual-pack Tier L
     plumbing (E2E_PACK_PATH across the harness + npm script + CI matrix
     over {production, toy-heist}); grow toy pack to ≥10 distinct-owner
     tokens; `packService.getGameConfig()` (activation-snapshot
     semantics); capability-gate skeleton + `requires` declaration block
     in game.schema.json — the gate ALSO enforces `engine.minVersion` +
     `schemaVersion` (semver compare, loud refusal; adversarial R6).
     Adopted skew policy (R12): the ALN pack keeps mode ids
     {blackmarket, detective} through Phase 3; scoring-config.json
     deletion ships in the SAME TokenData pin bump as the slice-2
     backend deploy; assume SW-cached GM scanners lag the backend by up
     to one event.
   - **Slice 1 — modes:** migrate BEHAVIOR to the pack's per-mode
     semantics flags (`scoringPolicy`/`entityRole`/`countsTowardGroups`/
     `displayBehavior`) — the mode ids are load-bearing string constants
     in ~40 branch points today; flag vocabulary designed OPEN
     (modes are proto-verbs — BILL scoping §2.1); wire-mode validation
     becomes pack-derived; gate rejects undrivable modes. **UI boundary
     (R3, gate-blocking without it):** the binary mode checkbox becomes a
     data-driven segmented selector rendered from `gameConfig.modes`
     (labels from mode.label; scoreboard/evidence surfaces driven by
     `displayBehavior.surface`, not the 'blackmarket' literal). Scope
     ENDS there — mode-count ergonomics beyond ~3, per-mode theming, and
     the four-domain redesign stay Track D; the toy pack stays within
     what the segmented selector renders for all of Phase 3. **Coherence
     validator (R9):** cross-field rule table (dependentSchemas where
     expressible + contract-suite rules — e.g. scoringPolicy:none ⇒
     countsTowardGroups:false) — the capability gate catches UNSUPPORTED
     shapes, this catches CONTRADICTORY ones; resolve the toy pack's
     ambiguous `appraise` mode here.
   - **Slice 2 — scoring/group/duplicate/clock rules migration:** backend
     reads game.json via getGameConfig(); scoring-config.json retires;
     gameClock.duration/overtimeAt consumed (delete the masking pin);
     gate extended — headroom shapes (threshold/ordered, per-entity/
     unlimited) flip from silently-ignored to LOUDLY-REJECTED. **Same
     commit (R2):** pack-rollback runbook lands in DEPLOYMENT_GUIDE
     (TokenData checkout last-good + restart, or PACK_PATH pin — legal
     because rules freeze at boot) AND preflight §4.4 is rewritten to
     validate pack-manifest.json + game.json scoring instead of the
     retired scoring-config.json.
   - **Slices 3a/3b/3c — strings & theming, SPLIT (audit F9):**
     3a pure text/branding (pre-fixes: scoreboard password, F-SHOW-29
     idle-loop literal; the "Case File" title is a FUNCTIONAL xdotool
     selector — extract as shared config, displayDriver + scoreboard);
     3b formatting LOGIC (currency ×5 implementations, star rendering ×4
     with hardcoded 5-scale → one pluggable formatter each);
     3c CSS/mode/memory-type taxonomy (vocabulary lives in both code and
     stylesheets).
   - **Slice 4 — show-control content into the pack (RESCOPED):** cues
     become pack content referencing ROLES (lighting roles per B8, sound/
     video by pack-relative reference, never HA entity ids or concrete
     venue filenames); music/playlist REFERENCES join them (files stay on
     the venue/asset channel). Settles audit F7 + the reference half of
     F6. Videos-in-pack (F5) deferred to the B pages' media story.
     **Ordering guard (R4 — without it, live lighting goes dark):** this
     slice ships (a) a backend role→scene resolver reading the active
     installation profile, (b) an in-repo ALN profile whose lighting
     bindings cover every migrated role, and (c) a concrete-id fallback
     on cues (ledger row; retires when C4's binding page ships). C4 then
     only makes already-working bindings editable.
   - **Slice 5 — clock/phase params (B11)** (duration/overtime landed in
     slice 2; phases + trigger-starts here) → **Slice 6 — display
     surfaces (B12** — renderer selection; the surface mechanism BILL's
     constellation renderer later plugs into**)** → **Slice 7 — report
     template refs (B9** — bundle schema reserves per-game state
     namespaces**)**.

   **Extraction brake (R13, standing rule):** no new A3 slice opens
   without citing the capability-matrix row(s) it moves and confirming
   they are not `engine-fixed`/`venue-config`; reclassifying a row is an
   explicit, logged decision. (First row to re-litigate: 1.23, the SF_*
   token schema — see adversarial review R11.)

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
   tool (one identity story — see §6.2). *Amended 2026-07-17 (§11):
   function resolution must accept ACTOR identity presented in the
   interaction (e.g. a scanned band) with the device as transport; and
   surfaces receive SERVER-SIDE projections scoped to their granted
   functions — mandatory for hidden-information games, good hygiene for
   ALN's scoreboard today.*
5. **E5. Interaction primitives v1 (O4):** scoped AFTER the spikes;
   engine ships few generic primitives, packs compose (P6); station
   primitives constrained by declared affordances (coarse-tap only).
   *Amended 2026-07-17 (§11): the v1 requirements now EXIST — BILL's tap
   grammar (compound-scan sessions: accumulate 1–3 identified objects →
   pack-declared legality → atomic commit → refusal-with-reason; actor-
   role gating). ALN is the degenerate single-object case.*

## 4. Dependency spine & sequencing

```
A1 schemas ←co-design→ C1 installation-profile (+ capability vocabulary, drafted)
   │
A2 runtime pack loading  (consumes the 2.x.4 seam; §6.1 standalone design)
   │
A3 extraction slices ──→ B pages (follow after B0; the slice gate is
                         the toy pack + dual-pack Tier L, NOT the editor — R10)
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
   four ad-hoc systems (five once bound stations arrive). O3 resolves here.
3. **Report contract evolution (Q11/B9).** Bundle schema is engine-fixed
   data; presentation is pack-variable; ALN's markdown stays
   byte-compatible (golden master) until the GenAI pipeline consumes the
   bundle. Sequence: bundle schema (A1) → intake writes bundle (D) →
   pipeline migration (owner-paced) → only then may the markdown vary.
4. **ESP32 pack delivery + primitive set.** Pack files ride the
   asset-manifest sync (planned); the CYD's interaction primitives are
   firmware-shipped and tiny (P6, affordance-constrained). Decide the v1
   primitive list with E5, not before the spikes.

## 7. Definition of Done — RATIFIED (owner, 2026-06-12)

Phase 3 completes when **A + B + C** are done and the toy-pack gate
passes (second game, zero engine changes, tier ladder via capability
profiles). **D and E are Phase 4** — a clean phase of their own after the
foundation, NOT parallel tracks (owner: cleaner boundary, the falsifiable
proof isn't delayed behind UX/platform work). Carve-ins that stay in
Phase 3: E1 spikes (owner-run, information only), E2 real domain+cert
(reclassified as Track C infrastructure — benefits Phase 3's own
deliverables; **2026-07-17 adversarial review R8:** E2 does NOT gate the
toy-pack DoD — C2's preflight cert line runs WARN-ONLY until E2 lands;
spike S2 is the E2 prerequisite and sits atop the owner list), and the
O3 one-auth story — **Phase 3 implements the OPERATOR-TIER v1 subset**
(config-tool auth B0.3 including its BACKEND substrate: token claims,
issuance-time grant computation, the function check in
commandExecutor/routes; plus the scoreboard token with a PLAIN read
scope) while the player-facing tiers, enrollment, actor-centric
resolution, and server-side projection are Phase 4 (adversarial review
R1 — this replaces the earlier 'paper only' wording, which contradicted
Track B's stated dependencies).

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

*Original (2026-06-11):* A1+C1 ≈1.5 · A2 ≈1.5 · A3 ≈2-3 · B ≈2-3 ·
C2-C4 ≈1.5 · D ≈2-3 · E2 ≈0.5 · E3-E5 ≈2 → core gate ≈ 8-10.

**RE-PRICED 2026-07-17 (adversarial review R7)** — calibrated against
A2's ACTUAL cost (~2.3-2.7× its estimate; the only track with an
execution record) AND bottom-up costing of the ten-slice A3; two methods
converge: **A3 ≈6-10 · B0 ≈1.5-2.5 · B pages ≈3-5 · C2-C4 ≈1.5-3 →
remaining Phase 3 ≈ 12-18 sessions** (plus ~15-25% review/deploy/doc
overhead the original numbers never counted). A disciplined CUT SET
(defer slices 4, 6, 7 + the 3c tail; trim B to the three gate-required
pages) recovers ≈5-7 sessions → **≈8-11 "gate-first"** with the DoD
intact — owner decision recorded in STATUS. Phase-4 figures inherit the
same ~2× understatement until re-priced at Phase-4 entry.

## 10. Immediate next deliverables

1. game.json + pack-manifest schema drafts (A1) with O1/O2 resolutions
   proposed for owner review
2. installation-profile schema draft (C1) folding in the capability
   vocabulary
3. Standalone-pack-loading design section (§6.1)
4. One-auth-story design section (§6.2 / O3)
5. Owner: ratify §7 DoD; run E1 spikes when convenient

## 11. Amendments — 2026-07-17 (post-A2 forward audit + BILL scoping)

Sources: the five-dimension forward audit (PHASE3-STATUS "2026-07-17
FORWARD audit") and `2026-07-17-bill-capability-scoping.md` (esp. §7,
the plan integration). Owner-directed integration; DoD (§7) and the
Phase 4 sub-gates are UNCHANGED by every item below.

1. **A3 slice list revised in place (§3):** new slice 0 (dual-pack gate
   infrastructure + capability-gate skeleton + getGameConfig — the
   program's per-slice toy-pack rule previously had NO executable gate);
   slice 1 migrates mode BEHAVIOR to open-vocabulary semantics flags;
   slice 2 extends the capability gate (headroom → loudly-rejected);
   slice 3 split into 3a/3b/3c (text vs formatting logic vs CSS
   taxonomy); slice 4 rescoped to "show-control content into the pack"
   (settles audit F7 + music refs of F6; F5 videos deferred to B).
2. **Track E sharpened in place:** E5's primitive requirements now exist
   (BILL tap grammar); E4 gains actor-centric function resolution +
   server-side per-surface projection.
3. **Framing adopted: platform PHASES (3–5) vs recurring GAME PROJECTS.**
   BILL is the first game project with new-module needs (compound-scan
   engine lands in E5; contagion module, graph scoring model, and
   constellation renderer belong to the BILL project, entry-gated on
   Phase 3 DoD + E4/E5). Within Phase 4, E-before-D ordering is
   AVAILABLE if BILL pressure grows — an option, not a decision.
4. **D-track note:** the B9 session-bundle schema reserves per-game
   state namespaces.
5. **A2→main landing order (R14):** submodule PRs first (TokenData →
   ALNScanner → PWA → ESP32), each reviewed and merged; THEN the parent
   PR bumping all four pins to the merged SHAs; only then are slice
   branches cut from main. ("Rebase foundations onto main" describes
   starting slices, not landing A2 — the landing is this PR train.)
6. **2026-07-17 adversarial review applied:** findings R1-R24 and their
   resolutions live in `2026-07-17-adversarial-plan-review.md`; the
   R-numbers cited inline above trace to it. §1, §7, §9 and the slice
   list were corrected in place the same day.
7. **Known plan-level gaps intentionally left open:** F8 ESP32 rebrand
   posture (conditional on CYDs-as-BILL-scanners); F5 videos-in-pack
   (B pages' media story); draft-pack real-device preview mechanism
   (B0 design, options recorded in the audit).
