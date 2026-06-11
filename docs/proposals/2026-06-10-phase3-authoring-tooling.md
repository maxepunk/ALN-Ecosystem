# Proposal: Phase 3 Authoring & Configuration Tooling

**Date:** 2026-06-10
**Status:** Draft for owner review
**Context:** Owner direction: Phase 3 "will require something more usable than
working in config text files by hand." This proposal designs that layer.
Builds on decisions B1-B12, C1-C7, E5-E11 and the capability matrix
(notably §6 config-tool, row 6.9 presets-as-proto-pack).

---

## 1. The users, not the files

The current config-tool is organized around *files* (.env, scoring, cues,
routing). The usable version is organized around *roles*:

| Role | When | Edits | Today's experience |
|---|---|---|---|
| **Game Designer** | pre-production | game pack: modes, scoring tables, group rules, clock/phases, strings/theme, cues/show design, narrative config | hand-edits JSON; some cue UI exists |
| **Venue Operator** | venue setup / pre-show | venue profile: audio routing+ducking, lighting role→instrument bindings, env/infrastructure, hardware preflight | config-tool sections + .env editing |
| **GM** | live game | nothing here — runtime control lives in the GM scanner (four domains, per C1) | already designed |

**Proposal:** config-tool evolves into two workspaces — **Design** (edits the
game pack) and **Venue** (edits the venue profile + binds the pack to this
venue). One codebase, one server, two navigation roots. This makes the
pack/venue boundary (B7/B8/E9, preset-split assessment) *visible in the UI*
instead of a convention people must remember.

## 2. The architectural prerequisite: runtime pack loading

The best editor UI is dishonest while consumers bake config in at build time:
- GM Scanner imports scoring-config (and future strings/game.json) **at Vite
  build time** (F-TOOL-05) — a Design-workspace edit would silently not reach
  standalone scanners until someone rebuilds dist.
- Backend loads scoring/cues/routing at startup only (E10).

**Prerequisite work (Phase 3.1.5, before the editors):**
1. Backend serves the active pack over HTTP (`GET /api/pack/*` — manifest +
   files; extends the existing `GET /api/tokens` + asset-manifest channel).
2. **Web scanners fetch pack data at runtime** (networked: from backend;
   standalone: bundled pack as fallback + service-worker-cached pack refresh).
   Vite imports become fetches with build-time defaults.
3. **ESP32**: pack delivery rides the existing asset-manifest sync (3.2f as
   planned — strings/config files become manifest entries).
4. Backend hot-reload endpoint (E10's "apply" action): re-load pack + venue
   files without full restart where safe; system:reset where not.
5. **Staleness visibility**: every consumer reports its loaded pack
   version/hash (sync:full, /health); the tool shows "running vs on-disk"
   drift. (The pack gets a `version` + content hash in its manifest.)

Without this, we'd build editors whose Save button lies. With it, an edit →
"Apply" → all connected components visibly on the new version.

## 3. The Design workspace (game-pack authoring)

Pages, in build order (value ÷ effort):

1. **Pack manager** — create/open pack, version metadata, validate
   (completeness: every referenced sound/video/scene-role/token asset exists),
   export/import as a bundle (reuse the sha1 manifest machinery; fixes the
   preset system's missing-assets gap), diff vs running.
2. **Mechanics editor** (game.json):
   - **Modes builder** (B1): list of modes; per mode: id, label, scoring
     policy (standard/none to start), display behavior (B5: evidence-board /
     none), default-mode picker. ALN ships as the two-mode example.
   - **Scoring tables** (B2): the existing Game Economy editor, moved here,
     with the live formula preview it already has.
   - **Group rules** (B3): rule type (all — v1; threshold/ordered — schema
     present, disabled until engine support), min size, bonus parameters.
   - **Duplicate policy** (A2/Q4): per-deviceType matrix; claim-once toggle
     (engine supports ALN's value now; the knob exists for future games).
   - **Clock & phases** (B11): duration, overtime, phase list (time- or
     trigger-driven starts); phases appear as cue-trigger vocabulary.
   - **Teams** (B4): placeholder block — current dynamic model only, until
     the team/player elicitation lands.
3. **Strings & theme editor**: grouped string catalog (scanner screens,
   scoreboard, report headings) with **live preview panes** (render the real
   scoreboard/scanner result-screen templates against draft strings); theme
   tokens (colors, logo upload, display-BMP theme per matrix 7.4).
4. **Show designer** (existing cue editor, upgraded):
   - Lighting actions reference **roles** (pack vocabulary), not HA entity
     IDs (B8) — role list managed here.
   - Timeline editor renders the E5 three-segment model: video block at true
     duration (from backend probe), clock segments before/after, entries
     snap-positionable; the E5 anchor syntax (`after: video, offset`) lands
     here when the schema gains it.
   - Trigger/condition pickers stay generated from the backend contract
     (the F-TOOL-09/32 drift class gets a pinning test instead of hand-sync).
5. **Content view** (tokens): read-only browser (exists) + pack-level
   validation (schema check, asset presence, group sanity, memory-type vs
   scoring tables). Full token *authoring* remains Notion → Phase 5 replaces
   it; this page is where Phase 5 will eventually dock.
6. **Narrative config** (B9 slot): report template/theme selection, structured
   bundle version — thin v1 (mostly displays the contract), grows with the
   reports-pipeline migration.

## 4. The Venue workspace

> **Model update (2026-06-11, owner decision — see
> docs/decisions/2026-06-11-kit-model-install-tiers.md):** games ship as
> production-owned hardware KITS with per-venue scalable installs (player
> scanners only → full Pi/lighting/audio/display rig). "Venue profile" is an
> INSTALLATION profile for this event's kit slice, and this workspace gains a
> first-class **planning view**: pack + proposed install tier → which
> mechanics/show elements run, degrade, or are unavailable — the same
> resolution mechanism as the preflight, usable before packing the van.

1. **Audio** — routing + ducking editors (exist; stay venue per B7).
2. **Lighting bindings** (B8, owner-directed design): the pack's role list on
   the left; live-fetched HA scenes / WLED presets on the right; bind, with
   **Test** buttons that fire the real instrument; UNBOUND roles flagged red.
   Depends on F-SHOW-10's fix (already landed — no more phantom fixture
   scenes).
3. **Infrastructure** — .env editor (exists, now masked/validated).
4. **Preflight dashboard** — one button, runs the full pre-show verification:
   service health (existing registry), every pack reference resolvable on
   this venue (extends `validateCommand`), all lighting roles bound, scanner
   pack-version match (catches the stale-dist failure class), report-contract
   version match. Output: a go/no-go checklist usable the hour before doors.
5. **Venue profile manager** — the preset system, re-cut: `kind:
   venue-profile` bundles (env+routing+bindings), versioned (F-TOOL-12 fix),
   no longer pretending to capture game content.

## 5. Implementation posture

- **Evolve config-tool, don't rewrite.** It now has tests, lint, validation,
  and serviceable component patterns (cueEditor/timelineView/commandForm).
  Restructure navigation into the two workspaces; keep the no-build vanilla
  JS approach (consistent with the repo's deployment model; revisit only if
  the preview panes demand more).
- **Schemas are the contract**: game.json / venue-profile / pack-manifest
  JSON Schemas (Phase 3.0/3.1 design docs) are shared by backend loaders,
  config-tool validators, and CI checks — one definition, three enforcers.
- **Pack = ALN-TokenData submodule extended** (E9): the Design workspace's
  save target is the pack directory; export = the bundle; the existing
  submodule pipes distribute it. The tool gains a "commit & push pack"
  affordance (resolves F-TOOL-22's silent-dirty-submodule trap by making the
  pack's git state visible).

## 6. Sequencing within Phase 3 (revised)

0. **Phase 2.x E2E harness work precedes the build** (committed 2026-06-11,
   see docs/plans/2026-06-11-phase2x-e2e-harness.md): the capability
   vocabulary is co-designed with the venue-profile schema (step 1 below),
   the fixture/pack-injection seam feeds 3.1.5's loading design, and Tier L
   gives every step below a fast E2E gate.
1. 3.0/3.1: capability-matrix finalization → game.json + pack-manifest +
   venue-profile schemas (design docs, as planned; includes the shared
   capability vocabulary section per 2.x.1)
2. **3.1.5 (NEW): runtime pack loading + version/staleness plumbing** (§2)
3. 3.2a strings extraction (now WITH the strings editor + preview, §3.3)
4. Mechanics editor over game.json as each extraction lands (modes → groups
   → duplicate policy → clock)
5. B8: role indirection in engine + Lighting bindings page + preflight
6. Pack manager + export bundles + venue-profile re-cut
7. Show-designer upgrade (E5 visualization, roles, anchors)
8. UX redesign of GM scanner proceeds in parallel as already planned (3.3)

## 7. Open design questions for the owner

1. **Pack editing model** — **DECIDED (owner): draft + publish.** Edits land
   in a draft copy; an explicit Publish step makes them the active pack
   (and is the natural unit for pack versioning + the Apply/staleness flow).
2. **Auth posture** — **DECIDED (owner): LAN + shared admin password +
   HTTPS**, superseding E7's localhost-bind default (E7's "pre-show only"
   survives as operational guidance). Rationale: Phase 5 authoring requires
   LAN access anyway; reuses the backend's existing ADMIN_PASSWORD→JWT
   pattern (one auth story, not two); enables future role separation.
   Riders: HTTPS required (reuse backend cert approach); secret masking
   stays as defense-in-depth.
3. **Strings preview fidelity** — **DECIDED (owner): build Option B**
   (preview drafts on the real device) in addition to in-browser replica
   previews. Scope v1: scoreboard TV only (backend already drives it;
   draft+publish keeps live games isolated from previews). Scanner-screen
   device preview deferred unless a need emerges.
