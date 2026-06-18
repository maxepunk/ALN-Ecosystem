# Decision Record: Tier B (part 1) — Platform Shape: Core Mechanics

**Date:** 2026-06-09
**Decided by:** owner, via discovery-report triage (mobile chunk 2)
**Context:** These answers define what `game.json` must be able to express
(Phase 3 schema design). Matrix row references → `capability-matrix.md`.

## B1 — Modes are game-defined (Q1: OPEN variability)

A game defines its own set of transaction modes — 1, 2, or 3+ — each with
name, scoring policy, and scoreboard behavior.

- game.json gets a first-class `modes: [{id, label, scoringPolicy,
  displayBehavior, ...}]` array. `detective`/`blackmarket` become ALN's two
  entries, not engine vocabulary.
- Wire protocol: `mode` field stays a string; validation moves from a Joi
  enum to runtime validation against the loaded pack's mode list (matrix 3.2).
- GM scanner mode toggle becomes a rendered selector driven by the pack
  (matrix 4.3).

## B2 — Token formula stays simple (tables); modes carry formula variety

Owner correction accepted: group mechanics already are set-collection — the
question conflated token-value formula with collection mechanics. Decision:
keep the base token formula as-is (`base[rating] × mult[type]`, games supply
tables), and treat **per-mode scoring policies** (B1) as the extension point
if a future game needs a structurally different formula.

- Engine: one fixed token-value function over pack-supplied tables.
- Mode `scoringPolicy` starts as an enum (`standard`, `none`) and can grow
  variants later without touching the base formula.
- Matrix Q2 → resolved as "tables-only now, extensible via modes".

## B3 — Group mechanics: partial-completion and ordered collection are in scope (Q3: OPEN)

The engine's group/collection system must support rule variants, not just
collect-all.

- Shared rules module design: `groupRules: {type: all|threshold|ordered,
  params...}` — implement `all` now (ALN), leave the dispatch seam for
  `threshold`/`ordered`.
- Wire protocol: `group:completed` event and `TeamScore.completedGroups`
  survive but should be reviewed for shape-compat with partial progress
  (e.g., a future `progress` field) during Phase 3 contract work (matrix
  3.3-3.4).

## B4 — Team/player management needs to grow substantially (Q5: OPEN)

Future games will likely need much better team AND individual-player
management than today's dynamic-freeform-team model.

- This is the largest scope expansion in Tier B. Defer detailed design, but
  the Phase 3 session/team model must not bake in "team = opaque string".
  Minimum future-proofing now: treat teamId as an entity reference, keep a
  `teams` collection on the session (already exists), and design game.json
  `teams:` block as a placeholder with the current behavior as its first
  variant.
- Follow-up elicitation needed before Phase 3 detail design: what does
  "better management" mean concretely (rosters? individual scan attribution?
  player accounts across sessions?).

## B5 — Evidence-exposure behavior is per-game configurable (Q6)

What an "expose"-type mode shows, where, and when is pack-defined.

- Folds into B1's per-mode `displayBehavior` (e.g., ALN detective =
  `{surface: 'scoreboard-evidence', fields: [summary, owner], when:
  'immediate'}`).
- Scoreboard evidence rendering becomes a configurable surface rather than
  hardcoded detective semantics (matrix 1.11).

## B6 — Numeric semantics vary per game, not just presentation (Q7)

Negative scores, non-monetary scales, etc. are in scope.

- Engine score arithmetic must not assume currency or non-negativity.
  Audit during rules-module build: clamping, formatting, and the `$`
  formatter (matrix 1.25) all become pack concerns (`scoring.display:
  {unit, format}` + `scoring.semantics: {allowNegative, ...}`).
- Multiple currencies per game: not explicitly requested — treat as out of
  scope until a game needs it (note in schema doc).

---

**Net effect on plan:** game.json's heart is the `modes` array (B1) + group
rule variants (B3) + team model placeholder (B4). The shared rules module
(Phase 2 flagship) should be built with these seams visible even while
implementing only ALN's variants — rules as data-dispatched strategies, not
hardcoded branches.
