# Decision Record: Tier B (part 2) — Show Control, Content, Pipeline

**Date:** 2026-06-09
**Decided by:** owner, via discovery-report triage (mobile chunk 3)

## B7 — Ducking rules are VENUE config (Q8)

- routing.json split (already planned) assigns BOTH routes and ducking to the
  venue layer. Game packs carry no ducking rules.
- config-tool routing editor stays a venue surface.

## B8 — Lighting: cue scene IDs are GAME EVENTS; venue maps them to instruments (Q9 — reframed by owner)

Owner correction: the scene IDs in cues correspond to *game events* (roles),
which are then configured to venue-specific instruments via Home Assistant /
WLED. The two-layer intent already exists conceptually; it is just implicit
(the "role" names live as literal HA entity IDs).

**Owner directive:** think carefully about this flow and design an optimal
configuration surface/interface that acknowledges the external dependencies
(HA, WLED) as first-class parts of the game system.

→ **Design task (Phase 3, show-control track):**
- Make the layering explicit: pack `cues.json` references named *lighting
  roles* (game vocabulary); a venue mapping (role → HA scene/WLED preset)
  lives in venue config; the engine resolves at fire time.
- Configuration surface: config-tool grows a "lighting mapping" page —
  lists the pack's roles, fetches available HA scenes/WLED instruments live,
  lets the venue operator bind each role, and **preflight-verifies** every
  role is bound (ties into commandExecutor.validateCommand pre-show checks).
- External-dependency posture: HA (and WLED behind it) is a managed
  dependency of the system — the design doc must cover discovery, health,
  and what "unmapped role" does at runtime (held cue? skip with warning?).

## B9 — Session report format is per-game configurable (Q11)

Combined with the GenAI pipeline dependency, this forces a layering decision.
**Recommended architecture (to validate in Phase 3 design):**
- Engine emits a **structured session bundle** (JSON, versioned schema) as
  the canonical artifact — game-agnostic data.
- The human-readable report (markdown/HTML) becomes a *themed rendering* of
  that bundle, defined per pack (templates).
- The GenAI pipeline migrates from parsing ALN's markdown tables to
  consuming the structured bundle (its LLM-parse step gets simpler, not
  harder). Until migration, ALN's pack template stays byte-compatible with
  today's tables, protected by the planned contract test.
- This dissolves the "engine-fixed vs game-variable" tension: data schema
  engine-fixed, presentation pack-variable.

## B10 — Player-side interactions: extensible system required (Q12)

Owner: we need to think about what additional player-side interactions are
possible, and have a system that allows extending functionality for other
games.

→ **Open design track (pre-Phase-3 elicitation + design):**
- Brainstorm the interaction space (choices, puzzles, multi-step reveals,
  token combinations, location/sequence gating...).
- Role-spec gets an extensibility model rather than a fixed behavior list.
- **Platform-reality note:** web PWA can ship new interactions as content/
  config; ESP32 interactions are firmware-bound — manifest-delivered config
  can parametrize existing interaction types, but genuinely new types need
  firmware releases. The extensibility design must declare which interaction
  primitives the firmware supports.

## B11 — Game clock: phases/acts, time- OR trigger-driven (Q13)

- gameClockService grows a phase model: `game.json gameClock: {duration,
  overtimeAt, phases: [{id, label, start: time|trigger, ...}]}`.
- Phase transitions become cue-engine trigger events (`phase:changed`) and
  cue conditions — feeds the cue-authoring contract (matrix 2.22).
- ALN = single phase + overtime threshold (the degenerate case).

## B12 — Display surfaces are pack-definable/themable (Q14)

- The IDLE_LOOP/SCOREBOARD/VIDEO set becomes the engine's *built-in
  surfaces*, each themable per pack; packs can define additional surfaces.
- Scoreboard becomes "a themed surface whose content type is
  evidence-board/rankings" rather than hardcoded ALN markup — aligns with
  B5 (exposure display behavior) and the strings/theme extraction.
- Window-management coupling (xdotool title search) must be fixed before any
  of this (already flagged: matrix 2.5).

---

## Synthesis note (honest scope check)

Tier B part 1+2 together describe a substantially more ambitious engine than
ALN-as-built: game-defined modes, group-rule variants, richer team/player
management, extensible player interactions, phases, definable surfaces, and
a structured-report layer. **The Phase 3 design doc must therefore define an
ALN-v1 implementable subset for every one of these** — schema headroom is
cheap; building all variants now is not. Pattern: implement ALN's variant
behind a seam shaped for the named variants, and let the toy second game
(Phase 4) exercise ONE non-ALN variant per area to prove the seams are real.
