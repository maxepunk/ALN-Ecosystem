# UX foundation — the whole tool, ground up (2026-09-04, DRAFT r1)

Status: DRAFT — for the owner grill (/grill-with-docs).
Origin: pages doc §11 (owner reframe: existing tool is not the
baseline; ground-up UX from industry best practice, improved for our
flows; open-source learnability is first-class).
Vocabulary: CONTEXT.md. Verdict semantics: C1 §2 / resolution.js.

## 0e. Review — the CONFIRMED picture (owner + primary sources,
2026-09-04; supersedes 0d's first interpretation, which overreached)

The owner rejected 0d's "automated website reveal" reading as
fabrication. Verified by reading the actual consumer
(github.com/maxepunk/aboutlastnight, cloned read-only) and the FULL
ROADMAP (which had not been re-loaded this session — a recorded
process failure):

- The consumer is the **ALN Director Console**
  (console.aboutlastnightgame.com): a LangGraph pipeline with TEN
  human-in-the-loop checkpoints where the director curates paper
  evidence, roster/photos, narrative arcs, outline, and final
  article. It produces a **BESPOKE in-fiction investigative article
  for EACH session's players**, built from their choices and actions
  as recorded by the game system (player RFID actions + GM
  observations), emailed to players as the post-show payoff. Review
  is a CREATIVE PRODUCTION stage — as authored as Author — not
  automated output and not log-reading.
- The three-layer evidence model (exposed/buried/context) closes the
  mode loop: Detective EXPOSES a memory into the story; Black Market
  SELLS it into buried. The players' per-token choices during Run
  directly shape what Review can tell.
- ROADMAP Track D (Phase 4) is the platform half, verbatim gate:
  "report intake writing B9 bundles. Intake means: the roster
  captured before the game; one-tap, dictation-friendly director
  notes and photo capture during the game; the accusation and
  whiteboard captured at the end." Intake happens DURING Run, via
  the GM scanner; its consumer is Review. Phase 5 makes the report
  pipeline the content database's second consumer.
- Boundary (Q15r, now roadmap-grounded): the platform owns the
  RECORD (bundle), the INTAKE, and the HANDOFF; the game owns the
  TELLING — which can be an entire per-game application. Cross-tool
  vocabulary spans config tool, GM scanner, AND the Director
  Console.

## 0d. Grill round 4 first interpretation (SUPERSEDED by 0e —
kept as the record of the overreach)

The owner stopped the round: "you're forgetting how Review is used
DIRECTLY as part of the ALN player experience — re-load the
fundamentals." Verified from primary sources, not summaries:

- `ALNScanner/docs/session-report-contract.md`: the session report's
  ONLY consumer is the GenAI pipeline in
  github.com/maxepunk/aboutlastnight (the game's website), which
  parses evidence/timeline/economics "for LLM interpretation" and
  indexes evidence cards to DEDUPLICATE ACROSS SESSIONS — the
  player-facing post-game reveal, with cross-session continuity, is
  the report's reason for existing. The GM-readable markdown is the
  transport, not the audience.
- CONTEXT.md attribution model: "Exposed By" is a byline players can
  claim credit on — player-facing narrative credit via the entity
  system.
- The arc already points here: slice 7 made report WORDING
  pack-declared; B9's structured bundle is the canonical artifact the
  pipeline migrates to (ROADMAP §8.10) — "how a game tells the story
  of the night" is per-pack content on a contracted engine seam.

Consequences: Q15 withdrawn as posed (it asked whether a player
debrief should be "in scope" when it is the report's primary
consumer). Q15r posed instead: Review = the home of the session
bundle — generated, inspected, handed to THE GAME'S OWN post-game
channel (pack-specific); the tool owns the record and the handoff,
the pack owns the telling. Q13 stands with Review's weight raised
(player-facing production output + design-learning loop). Q14
unchanged. Awaiting rulings on Q13/Q14/Q15r.

## 0c. Grill round 3 rulings (owner, 2026-09-04)

- **Q10 CORRECTED twice — the pipeline was the engineer's frame**:
  (1) Prepare is not a stage: trying-it-in-my-space is HOW authoring
  works — the creator's practice is a LOOP, not a line. Venue
  configuration (bindings/profile) is cross-cutting infrastructure
  surfaced in context; the preflight is the OPENING RITUAL OF RUN,
  not a stage. (2) Review is not log-review: it is (a) the STORY OF
  THE NIGHT — what teams did, found, missed — feeding the debrief
  (part of the show's emotional payoff), and (b) design learning
  flowing back into Author. The lifecycle is a CYCLE.
- **Q11**: workspace naming still open — follows the loop model.
- **Q12 CORRECTED — input transports are physics**: QR is a leftover
  fallback path, not a designed game path. The designer's frame is
  "a player touches a memory → my show responds"; input primitives
  (NFC, QR, simulate-button) are venue-bound details like lighting
  fixtures. The demo is REHEARSAL: every player action performable
  in its simulated form, framed as the player's action, not a
  transport test. Unification surfaced: first-run demo = authoring
  preview = Track D simulation anchor = ONE concept, Rehearse
  (rung-1 is engineering's rehearsal rig).
- Round 4 posed: Q13 loop-model ratification (Author⇄Rehearse → Run
  → Review → Author), Q14 Rehearse as first-class named concept,
  Q15 Review's audience (production-team story vs player-facing
  debrief, phased).

## 0b. Grill round 2 rulings (owner, 2026-09-04)

- **Q7 RATIFIED**: the two-dimensional method — every element decided
  on the FINAL design surface, then placed on the PHASE-LANDING MAP.
- **Q8 OVERRULED to (c)**: the first-success moment is the platform's
  distinctive promise kept — SCAN → THE SHOW REACTS (video plays, a
  cue fires, a light changes). A scored scan alone is the engineer's
  minimal moment, not the user's motivating moment; the "second
  beat" framing was incoherent and is withdrawn. Convergence pinned:
  the rung-1 simulation machinery (real VLC, real cues, witness
  lights) IS the hardware-free demo engine for this moment.
- **Q9 CORRECTED — "Adopt" is not a stage**: it has no meaning to a
  user who cannot yet Author; it is a threshold crossed once, not a
  room. Stage model r2: **Author → Prepare → Run → Review**. The
  tool owns Author, Prepare, Review; the GM scanner owns Run.
  Getting-the-platform is the tool's FIRST-RUN STATE: a persistent
  checklist overlay + teaching empty states + templates at the
  threshold — patterns of Author, not a workspace.

## 0a. Grill round 1 rulings (owner, 2026-09-04)

- **Adopter floor**: (c) now — README-courage, paste-able commands,
  every failure state self-explains; packaged installer (b) anchored
  to ROADMAP.
- **Metrics**: all three adopted (P1 clone→scored scan <30min —
  FINAL-surface metric; P2 edit→published-applied <2min and P3
  preflight walk <10min — now-metrics).
- **Personas**: hats now (one human switches workspaces, state
  preserved); separate-humans hardening → ROADMAP.
- **Scanner boundary**: absolute. PLUS two new directives: (1) the
  rigor of this tool's IA/UX work MIRRORS what the GM scanner needs —
  a GM-scanner UX overhaul under the same method is a ROADMAP item;
  (2) CROSS-TOOL VOCABULARY: the two tools must share vocabulary so
  users can shift between them — CONTEXT.md is the mechanism, and
  every naming decision here must check against scanner usage.
- **Workspace names**: all three candidates REJECTED ("none capture
  the purpose of this tool and this stage of usage") — naming reopens
  after the stage model settles (round 2).
- **METHOD DEFECT (owner, on F-N1)**: the grill conflated the
  now-surface with the FINAL design surface. Correction: every
  element is designed against the FINAL surface, then mapped to where
  it lands across Phase 3 and beyond (the PHASE-LANDING MAP). The
  old piecemeal sequencing questions (Setup-in-Phase-3, Q-UX3/4)
  dissolve into rows of that map.

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

## 1. Personas (r1 — loop-model propagation, rulings 0a-0e applied)

- **P1 New adopter** (open-source arc, PRIMARY for learnability;
  OWNER-CONFIRMED): a game designer/creator who wants to run their
  OWN immersive game. Creative professional, not developer. Their
  arc through the ratified loop: first-run state → Author (from
  template, never blank) → **Rehearse (the first-success moment:
  their show REACTS — Q8=c)** → eventually Run and Review. Success
  metric: clone → rehearsed toy show (video + cue + light respond)
  < 30 min, zero hardware.
- **P2 Designer**: lives in the Author ⇄ Rehearse creative loop —
  edit → verdict badges → rehearse the change → validate → publish.
- **P3 Operator / show tech**: Run's supporting human — the opening
  ritual (preflight), venue config when verdicts point at it,
  re-route/re-run when the venue changes. Pressure-legible surfaces,
  verbs on every red thing.
- **P4 Director (a HAT, usually the same human as GM/designer)**:
  Review's user — crafts the night's telling from the record (for
  ALN: the Director Console's ten-checkpoint production of the
  bespoke per-session article) and harvests design learning back
  into Author. Named because Review is a CREATIVE PRODUCTION stage
  (0e), and its UX serves this hat, not a log-reader.
- **(Excluded) GM during show**: the scanner is Run's surface, never
  this tool. Hard boundary; the nav teaches it (L3).

Hats, not humans (round-1 ruling): one person switches freely,
state preserved; separate-humans hardening → ROADMAP. P1 becomes
P2/P3/P4 within their first sessions — learnability is the RAMP.

Baseline principle (from 0e): the platform's built-in Review must
stand ALONE — an adopter has no Director Console; ALN's console is
an advanced per-game instance of the telling, never the baseline.

## 2. Flow inventory (r0)

First-run (owns the open-source goal; finish line RE-RULED Q8=c):
- **F-N1 clone → rehearsed toy show**: platform up, toy pack active,
  and the adopter REHEARSES it — performs a player action (its
  simulated input primitive, framed as the player's act) and the
  show reacts: video plays, a cue fires, a witness light changes.
  The rung-1 machinery IS this demo's engine. < 30 min.
- **F-N2 first edit**: change a value in Author, rehearse it, see
  the show change — the Author ⇄ Rehearse loop experienced once.

Designer (Author ⇄ Rehearse): F-D1 tweak-a-value (…→ rehearse →
publish → apply); F-D2 author-a-show-moment (show designer →
missing media loud → resolve → rehearse); F-D3 new-game (template,
never blank); F-D4 inspect-history.

Operator (Run support): F-O1 prepare-tonight (bindings → preflight
= Run's opening ritual → go/go-degraded/no-go); F-O2 venue-changed;
F-O3 box-is-stale.

Review (NEW family, from 0e + Track D):
- **F-R1 tell the night**: session ends → the record (B9 bundle) is
  generated and inspected → handed to the game's own telling (ALN:
  Director Console → bespoke article to players; baseline: the
  platform's own story-of-the-night reading).
- **F-R2 learn the night**: what the session taught (never-found
  tokens, pacing, buried-vs-exposed balance) flows back into Author.
- **F-R3 intake during Run** (Phase-4 Track D, scanner-side): roster
  before; one-tap dictation notes + photos during; accusation +
  whiteboard at the end — captured in Run, consumed by Review.

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

## 4b. Phase-landing map (L2 — the Q7 method applied; owner rules
the rows)

Every element decided on the FINAL surface, landed by phase.
"Seam" = Phase 3 builds only the not-precluding contract.

| Element (final surface) | Phase 3 | Later landing |
|---|---|---|
| Author workspace (pack manager hub + editors) | LANDS (the ratified pages build, re-cut under this foundation) | grows w/ token designer (P5) |
| Rehearse surface | SEAM: preview orchestrator + simulation profile (pages §9) + editor rehearse-affordance | full surface = Track D simulation anchor (P4); first-run demo = OSS milestone |
| Verdict badges everywhere | LANDS (Q1 ratified; resolve core shipped CS.1) | — |
| Venue config as cross-cutting (bindings page) | LANDS (C4, committed) | — |
| Run handoff in nav + preflight ritual | preflight LANDS (CS.4); nav handoff LANDS with shell | intake = P4 Track D (charted) |
| Review workspace (record + handoff + team reading) | SEAM: B9 bundle (landed, slice 7); scanner report download stays | workspace lands P4 with intake; bundle→console migration ROADMAP §8.10 |
| First-run state (checklist overlay + templates) | SEAM: shell reserves the slot; toy template ships | OSS milestone |
| Native token authoring | reserved room only (owner ruling) | P5 charter (Notion → adapter) |
| Packaged installer / hosted demo | none | OSS milestone (installer ruled 0a; hosted demo = OPEN, Q-UX4) |
| GM-scanner UX overhaul (same method) | none | ROADMAP item (round-1 ruling) |

## 5. IA proposal (r0 — SUPERSEDED by §5r below; kept for the record)

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

## 5r. Structure (L3 r1 — derived from the ratified loop; NEXT GRILL)

The nav IS the lifecycle: **Author · Rehearse · Run · Review** — with
Run rendered as a visibly labeled HANDOFF to the GM scanner (the
boundary taught, not hidden). Venue config is cross-cutting: the
identity chip's profile half + the bindings surface (C4), reachable
wherever verdicts point, never a top-level stage. The first-run
state is an overlay (persistent checklist + teaching empty states +
template-at-threshold), not a room.

Open L3 decisions (the recomputed frontier):
1. **Nav naming**: are the four stage words themselves the nav
   labels (Author/Rehearse/Run/Review)? Q11's earlier candidates
   were rejected; these four derive from the ratified loop and must
   read correctly from the scanner and console too (cross-tool
   vocabulary ruling).
2. **Rehearse's shape**: a dwellable surface AND a one-keystroke
   affordance from every editor (Resolve Cut/Edit lesson says both
   tiers on one data)? Or affordance-only in Phase 3's seam?
3. **Review v1 content**: what the baseline story-of-the-night
   reading shows (bundle inspector + team reading + handoff status).

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

## 7. Grill frontier (current)

Settled: L1 in full (personas r1, flows r1, metrics, boundaries,
loop model Q13r, Rehearse Q14, Review boundary Q15f). L2 map drafted
(§4b) — owner rules the rows, esp. hosted-demo (Q-UX4) and first-run
landing. L3 opens next: §5r's three decisions. L4 stays closed until
L3 ratifies; L5 approved.
