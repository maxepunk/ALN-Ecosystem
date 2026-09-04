# UX foundation — the whole tool, ground up (2026-09-04, DRAFT r1)

Status: DRAFT — for the owner grill (/grill-with-docs).
Origin: pages doc §11 (owner reframe: existing tool is not the
baseline; ground-up UX from industry best practice, improved for our
flows; open-source learnability is first-class).
Vocabulary: CONTEXT.md. Verdict semantics: C1 §2 / resolution.js.

## 0. Method — one layer at a time, correct hierarchy (owner
direction, 2026-09-04)

The design is optimized LAYER BY LAYER on Garrett's five planes; each
layer is gated (grilled/ratified) against the layer above before the
next opens, and the loop-and-review directive (§10.5 of the pages
doc) applies WITHIN a layer, never across two at once.

| Layer | Content here | Status |
|---|---|---|
| L1 Strategy | §1 personas, §2 flows, metrics, open-source goal | drafted — grill-ready |
| L2 Scope | per-workspace capabilities, deferrals (Q4 list + Setup + token room) | half-ratified (Q4); Setup + token room UNSCOPED — the sequencing question lives here |
| L3 Structure | §5 IA (workspaces), §6 interaction patterns, element model, draft lifecycle, identity chip, auth-at-write | proposed r0 — ungrilled |
| L4 Skeleton | per-screen layout (§10.4 mechanics survive as its rubric); the per-screen loop-and-review | CLOSED until L3 ratifies |
| L5 Surface | Control Room seed (tokens + verdict badges) | owner-APPROVED (out of order; acceptable as restyle of an existing identity — L4 must never be driven by L5) |

Method note (the recorded failure this fixes): PS.1 variants A/B/C
varied L4 while L1 was unsettled — unjudgeable; variant D optimized
L4 inside an unratified L3. Both owner corrections in this sitting
were layer corrections. Never again optimize a layer while one above
it is open.

## 1. Personas (r0 — for the grill)

- **P1 New adopter** (open-source arc, PRIMARY for learnability;
  OWNER-CONFIRMED 2026-09-04): a game designer/creator who wants to
  run their OWN immersive game on this platform. Creative
  professional, not developer. Success metric: time-to-first-running
  -toy-game on a laptop, no hardware.
- **P2 Designer**: authors game content (mechanics, strings, theme,
  cues, tokens) off-venue against a preview orchestrator + preview
  profile. May be non-technical. Lives in the edit → verdict →
  validate → publish loop.
- **P3 Operator / show tech**: prepares TONIGHT at the venue against
  the live orchestrator: profile, bindings, media, preflight. Reads
  verdicts under time pressure; every red thing must carry verbs.
- **(Excluded) GM during show**: scanner admin panel, never this
  tool. Boundary stays hard.

Note: P1 becomes P2 or P3 within their first sessions — the
learnability design is the RAMP between personas, not a fourth
destination.

## 2. Flow inventory (r0)

First-run (NEW — owns the open-source goal):
- **F-N1 clone → first game running**: get the platform running with
  the toy pack, zero hardware, and SEE a scan score points. Every
  step currently lives in READMEs; the foundation decides what moves
  into the tool (wizard? guided empty states? doctor command?).
- **F-N2 first edit**: from running toy game to "I changed a value
  and saw it change" — the adopter's first authoring success.

Designer (from pages doc §10.2, surviving): F-D1 tweak-a-value;
F-D2 author-a-show-moment; F-D3 new-game; F-D4 inspect-history.

Operator (surviving): F-O1 prepare-tonight; F-O2 venue-changed;
F-O3 box-is-stale.

## 3. Touch-point inventory (r0 — "optimal interaction patterns at
every touch point" is the owner's bar)

For each, the foundation must name its pattern + its teaching moment:
navigate (IA/wayfinding) · first-open (empty states) · edit (forms,
inline validation) · understand state (verdict badges, ambient
identity) · save vs publish (draft lifecycle) · recover (errors as
doors, undo) · learn (in-app help ↔ docs) · leave & return
(resume where you were).

## 4. Research findings (three cited reports, 2026-09-04)

Full reports in the session record; curated set below. Grouped by the
decision they drive. (B#=Blender/Resolve report, O#=OBS/live-tools,
H#=Home-Assistant/config-flows.)

**Structure**
- B2 Workspaces: task-scoped layouts, "one task without overwhelming
  the user" (code.blender.org 2.8 design doc) — progressive
  disclosure at the LAYOUT level.
- B6/B7 Resolve page model + Cut-vs-Edit: role- and tier-scoped pages
  over one shared project — a deliberately reduced entry tier makes
  novices fully productive on the SAME data experts refine
  (blackmagicdesign.com; wipster.io).
- O8 Thin guided layer over one shared format (Streamlabs-over-OBS):
  novices get wizard+templates, pros edit the same file directly
  (restream.io) — no fork of formats.

**First run / adoption**
- H6 A one-time wizard is INSUFFICIENT — HA's own roadmap: users get
  lost after first login; ongoing guidance needed
  (github.com/home-assistant/roadmap/issues/25) → persistent setup
  checklist, not a splash wizard.
- O1 Wizard replaces configuration with one binary choice + self-
  benchmarking (OBS auto-config) — derive, don't ask.
- H2 Discovery opt-in: found devices surface as "tap to add," never
  auto-added, never manual-IP-first (HA 0.94 release post).
- B4 Templates at the threshold: never begin from an empty schema
  (Blender splash templates; docs.blender.org).
- H11 Time-to-first-value in minutes is THE adoption metric
  (buildwithfern.com) — F-N1 target: clone → scored scan < 30 min.
- O5 State what the tool is NOT on first contact (OBS "extremely
  confused" forum class) — prevents imported wrong mental models.
- O6 Friction at commit, not explore (QLab free tier: build and
  rehearse freely; blocked only at save) — auth/ceremony arrives at
  first WRITE, not at the door.

**Editing / element model**
- O7 One Inspector location for every element type; shared tabs +
  type-specific tabs (qlab.app/docs/v5) — learning one element
  teaches all.
- O2/O3 One spatial metaphor + one universal "add" affordance
  (OBS scenes/sources) — visible orderable lists, not nested files.
- H4 Blueprints: shareable pre-built logic with fill-in-the-blank
  inputs (HA 2020.12) — the future of pack/show templates.
- H7 Progressive disclosure of advanced fields (NN/g).
- H9 Inline field-level validation (NN/g errors guidelines) — our
  verdict badges are this pattern at venue-truth depth.
- H10 Undo over confirmation for reversible edits (NN/g) — soft
  delete + undo toast; modals only for the unrecoverable.
- H12 Sensible defaults + escape hatch (thoughtworks.com) — raw pack
  JSON stays the honest escape hatch; never the entry path.
- H8/B4 Empty states teach (NN/g) — every empty container names its
  next action with a worked example.

**Conventions / chrome**
- B1 Match cross-application muscle memory (Blender LMB lesson:
  "why is this backwards" tax) — web-form/spreadsheet semantics, no
  exotic interactions.
- B3 Quick favorites: recognition over recall — pinnable actions.
- B5 Dark muted chrome, content pops (Blender 2.80 release notes) —
  validates the Control Room seed; chrome recedes, verdicts/preview
  read as the object of attention.

**Named anti-patterns (documented pain)**
- O4 SPLIT-BRAIN settings: OBS Profiles vs Scene Collections
  versioned separately burns beginners (obsproject forum) — our
  pack/profile split has the same shape; mitigation = the ambient
  identity chip must always show WHICH PACK against WHICH PROFILE,
  everywhere.
- O9 Presets lower the floor; the ceiling still needs its own path
  (Bitfocus Companion) — do not pretend one screen serves both
  audiences; tier them (B7).
- H5 Self-hosting barrier blocks trial (howtogeek on HA) — the
  single-command demo path (rung-1-style, toy pack, no hardware) is
  an adoption feature, not just a test harness.

## 5. IA proposal (r0 — for the grill)

**Three top-level workspaces, one underlying truth** (B2+B6+O8; the
§10.1 sidebar-split hypothesis survives but PROMOTED to workspaces,
not groups in one nav):

1. **Setup** — the new adopter's home (F-N1/F-N2). A PERSISTENT
   checklist (H6), not a wizard: backend detected (H2: discovery via
   the existing UDP 8888, "found → tap to add"), toy pack active,
   first scan scored, first edit published. Opens with one line on
   what the tool is and is NOT (O5). Collapses to a toolbar entry
   once complete; returns on demand. Target: < 30 min to scored scan
   (H11).
2. **Design** — the designer's workspace (P2; F-D1..4). Hub = pack
   manager (draft lifecycle spine, §10 re-cut direction survives);
   editor pages (mechanics, strings+theme, show designer, content
   view) share ONE Inspector pattern (O7) and one universal "add"
   (O3). New pack = template picker, toy-heist as starter (B4);
   blueprints direction noted for later (H4). Designer density.
3. **Tonight** — the operator's workspace (P3; F-O1..3). Profile +
   bindings (C4), media presence, preflight button, staleness/apply.
   Reduced-tier surface on the same data (B7): verify/toggle-first,
   pressure-legible density, verbs on every red thing. NOT a
   simplified toy — a deliberately reduced-capability tier.

**Global chrome**: ambient identity chip in the toolbar on every
workspace — "PACK about-last-night@caa6c7 · draft ✎ · running ▲ ·
PROFILE aln-full-kit" (O4 mitigation + ArgoCD anchor). Auth arrives
at first write, not at the door (O6) — read/browse is free.

**Shell ruling (owner, 2026-09-04): rebuilding the shell IS in
scope.** The workspace architecture is designed on its merits; B0
substrate reuse (stores, auth, publish pipeline) is an implementation
choice, never a design constraint. Working posture: design the
three-workspace shell ground-up; reuse plumbing where it fits the
design, rebuild where it does not.

**Reserved room — native token authoring (owner direction,
2026-09-04):** the token design process today lives in Notion and
syncs to tokens.json; a later phase brings it INTO the tool natively.
This is load-bearing for the open-source arc: an adopter has no
Notion database, so without native token authoring their packs are
never fully self-contained. Foundation consequences NOW: (a) tokens
are modeled as first-class editable elements in the Inspector and
universal-add patterns (not read-only synced data); (b) the Design
workspace reserves a token-designer surface (the content view grows
into it); (c) near-term, the toy template ships tokens editable via
the raw-JSON escape hatch (H12) and the ALN production keeps Notion
sync; (d) the deferral is anchored in the ROADMAP registry.

## 6. Interaction-pattern language (per §3 touch point)

- **Navigate**: three workspaces; within Design, hub-and-spoke from
  the pack manager; every fault/validate line is a DOOR to where it
  is fixed (§10.4 #3 survives).
- **First-open**: persistent Setup checklist (H6); empty states teach
  with a worked example + next action (H8); template picker over
  blank schema (B4).
- **Edit**: one Inspector location (O7); web-form conventions (B1);
  progressive disclosure of advanced fields (H7); one "add"
  affordance (O3).
- **Understand state**: verdict badges at the point of choice
  (ratified Q1) with edge-column row discipline (§10.4 #1); ambient
  identity chip everywhere (O4); paper/live depth always labeled.
- **Save vs publish**: draft lifecycle spine; Continue-editing vs
  Publish visually unmistakable (§10.3 WordPress criterion); publish
  friction at commit only (O6).
- **Recover**: undo toast over confirmation for reversible edits
  (H10); hard modals reserved for unrecoverable acts (system reset);
  every fault carries verbs (Loop 3).
- **Learn**: pinnable quick actions (B3); in-app links from empty
  states and errors to docs; the toy pack IS the tutorial content.
- **Leave & return**: workspaces restore last position; the draft
  bar/chip says what was in flight.

## 7. Open questions for the owner grill

- Q-UX1: RESOLVED (owner 2026-09-04) — shell rebuild in scope;
  three-workspace shell designed ground-up, plumbing reuse is an
  implementation choice.
- Q-UX2: RESOLVED (owner 2026-09-04) — primary adopter is a game
  designer/creator running their own immersive game on this platform.
- Q-UX3: F-N1 home — recommendation: in-tool persistent Setup
  checklist (H6) + a single-command demo path documented in README
  (H5); the checklist links the docs. Confirm.
- Q-UX4 (new, from H5): is a hosted/demo instance (beyond the local
  single command) in the open-source arc's scope, and when?
