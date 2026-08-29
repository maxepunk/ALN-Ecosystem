# A3 Slice 6 — display surfaces (pack selects/parameterizes the built-in three)

Status: BUILT (S6.1 + S6.3), owner rulings RULED (§4), closing (S6.4). See §8
execution record. Program pointer: `2026-06-11-phase3-program.md` §13 item 2 (ratified 2026-08-29,
"minimal reading"); ROADMAP §6 (headroom boundary), §8.1/§8.3 (idle-loop home),
row 8.8 (constellation renderer). Vocabulary: CONTEXT.md §1 "surface" (both senses).

Census: three parallel readers (backend machinery, GM-scanner side, schema +
deferrals + R13), 2026-08-29. This doc is the synthesis.

---

## 1. Extraction brake (R13) — capability-matrix rows this slice moves

R13 (CONTEXT.md §7): no slice opens without citing the capability-matrix rows it
touches and logging any reclassification as an explicit slice-doc decision (the
matrix file itself is never edited — the 1.23 precedent, reaffirmed by slice 4).
Source rows: `docs/reviews/2026-06-platform-review/capability-matrix.md`.

| Row | Matrix classification (today) | This slice | Logged decision |
|-----|-------------------------------|------------|-----------------|
| 2.3 (idle-loop video `idle-loop.mp4` literal) | game-content (file) / engine-fixed (mode); resolution "Hardcoded filename → pack `display.idleLoop`" | The pack gains a NAME reference to its idle-loop channel (`surfaces.idleLoop`); the media FILE stays out of the pack (ROADMAP §2.3) and its carriage rides §8.1's pack-manager media page | RECLASSIFY the *name* from engine-config-literal to game-content (pack-referenced); the *file* and the venue channel→file resolution stay deferred. Partial move, logged here. |
| 2.4 (display-mode state machine IDLE_LOOP/SCOREBOARD/VIDEO) | engine-fixed (set of modes — see Q14); remediation "Likely none; confirm Q14" | The surface *set* stays engine-fixed at three (Q14 answered: no pack-defined new surfaces in Phase 3); packs gain SELECT + PARAMETERIZE of the existing three | RECLASSIFY from "engine-fixed, likely none" to "engine-fixed inventory + pack-parameterized instances". The genuinely-new-surface extensibility (constellation renderer) stays BILL-era headroom (ROADMAP §6, row 8.8). Q14 CLOSED by §13.2. |
| 2.5 (scoreboard window discovery by HTML title) | engine-fixed mechanism coupled to game-content string; remediation "search by a stable non-themed marker" | UNCHANGED — already remediated by the 3a pre-fix (the `%%WINDOW_MARKER%%` injection + `scoreboardWindowMarker` tripwire). Watch for re-coupling only. | No move. Cited to confirm the theme-unit slice, not this one, owns any scoreboard-title theming. |

Nothing here is classified `engine-fixed`-and-frozen or `venue-config` in a way
R13 forbids moving; both 2.3 and 2.4 are explicitly flagged in the ratified scope
as "logged at slice-6 open."

---

## 2. Census facts (verified, file:line)

### 2.1 The two "surface" axes — keep them distinct (CONTEXT.md §1)

CONTEXT.md names two senses of "surface" precisely because they collide:

- **Display surface** (sense 1): an HDMI output the engine renders. The built-in
  three are `IDLE_LOOP` / `SCOREBOARD` / `VIDEO` — the `displayControlService`
  device-mode state machine (`backend/src/services/displayControlService.js:21-23`,
  behaviors `:138-177` / `:185-232` / `:280-328`). This is slice-6's axis.
- **Mode display surface** (sense 2): the per-mode `displayBehavior.surface` value
  (`scoreboard-rankings` / `scoreboard-evidence` / `none`), gated by
  `ENGINE_MODE_CAPS.surface` (`packService.js:72`, refusal `:671-673`). Where a
  mode's results land WITHIN the scoreboard. **Already pack-driven** (slice 1/3c),
  tested dual-pack (`backend/tests/e2e/flows/23-scoreboard-live-data.test.js:111-135`
  keys off the surface value, not the `detective` literal). OUT of slice-6 scope.

The design and every agent prompt must not conflate them. "Detective evidence
terminal vs black-market rankings" is sense 2, done; slice 6 is sense 1.

### 2.2 Dormant schema headroom exists TODAY

`ALN-TokenData/game.schema.json:489-492` already reserves the key this slice fills:
```json
"surfaces": {
  "description": "B12 headroom: engine built-in surfaces, themable per pack. Optional until the surfaces slice.",
  "type": "object"
}
```
Pure `type: object`, no sub-schema, no `required`, no engine consumer
(`packService.js` never reads `surfaces` — grep-confirmed). It is schema-only
decoration, exactly the slice-4 §2.2 "dormant headroom" pattern (`cues`/`theme`/
`report`/`lightingRoles` all sat dormant before their slice). **There is no
`display` top-level key** anywhere (only `modes[].displayBehavior` and the
slice-3b `scoring.display` money block — both unrelated). So the pack home is
`surfaces`, not a new `display` key — despite matrix row 2.3's shorthand
"`display.idleLoop`", the reserved key is `surfaces` and reusing it beats minting
a synonym (D-6.1).

### 2.3 Idle-loop identity today — an engine config key, not pack content

- `backend/src/config/index.js:96-114`: `config.display.idleLoopFile =
  process.env.IDLE_LOOP_FILE || 'idle-loop.mp4'`, with the in-code note "videos are
  not pack content until slice 6/B12+F5".
- Consumers: `backend/src/services/vlcMprisService.js:316` (`initializeIdleLoop`),
  `:333` (`returnToIdleLoop`), `:346` (`_idleLoopExists()` guard).
- 3a consolidated the literal to this ONE engine key and deferred the pack home to
  slice 6 (`2026-08-21-phase3-a3-slice3a-strings.md`, F-SHOW-29). §13.2(c) re-points
  it at ROADMAP §8.3: "ships it as a venue-channel NAME reference; the pack half
  rides 8.1". Media file carriage stays out of Phase 3 (ROADMAP §2.3 — media never
  lives in git packs).
- LANDMINE (out of scope, flagged): `idle-loop.mp4` is currently ABSENT from
  `backend/public/videos/` in this checkout, silently disabling the idle loop. Not
  slice-6 work; noted so a test author does not mistake it for a regression.

### 2.4 Surface selection today — 100% operator-command, zero pack input (the gap)

- `backend/src/services/commandExecutor.js:341-384`: the `display:idle-loop` /
  `display:scoreboard` / `display:return-to-video` / `display:status` gm:commands,
  each a direct GM call into `displayControlService`. No pack read.
- `displayControlService.js` has zero pack/mode reads — a pure state machine driven
  by method calls + VLC/queue events. Auto-transitions (video pre-play hook, return
  to previous mode) are engine-fixed.
- Cues CAN already fire the three display commands (`CUE_ACTIONS` includes
  `display:scoreboard`/`display:idle-loop`/`display:return-to-video`,
  `cueValidation.js`), but a cue just names a fixed engine action — there is no pack
  concept of "the surface this game wants".
- GM-scanner side (`ALNScanner`): the scanner's own 8 screens are internal GM UI,
  NOT the display surface. The scanner's remote for the venue surface is
  `src/admin/DisplayController.js:26-53` (three hard string literals), reflected by
  `MonitoringDisplay.js:284-304` and `VideoRenderer.js:34-64` (`'IDLE_LOOP'` /
  `'SCOREBOARD'` literal comparisons). Per §13.2 the SET stays three, so these
  three-value enums may INTENTIONALLY stay literal (D-6.3).

### 2.5 How scoreboard.html gets pack data (the seam a `surfaces` read would extend)

Three channels (`backend/src/routes/resourceRoutes.js:160-178`,
`packRoutes.js:34-46`, `scoreboard.html`):
1. WebSocket `sync:full` + `service:state` (live scores/clock/session).
2. `GET /api/pack/files/game.json` fetched at init (`scoreboard.html:1185-1210`,
   `loadEvidenceModes()`) — the page ALREADY reads live pack `game.modes[]` and
   `scoring.display.format`. This is where a `surfaces` read would extend.
3. Serve-time `%%WINDOW_MARKER%%` / `%%ADMIN_PASSWORD%%` / `%%PACK_STRINGS%%`
   injection (`renderScoreboardHtml`).

### 2.6 Ledger L10 — the `7200` fallback is already-delivered, inert duplication

`PHASE3-STATUS.md:258` (line numbers stale). Current sites:
`backend/public/scoreboard.html:853` (`expectedDuration: 7200` initial seed) and
`:946` (`gameClock.expectedDuration || 7200`). The REAL duration already arrives
live: pack `gameClock.duration` (`game.json:138`) → `packService.getClockRules()`
(`:991-1030`) → `syncHelpers.buildGameClockState()` (`:161-184`) → delivered via
`sync:full.gameClock` (`scoreboard.html:1737-1739`) and `service:state` domain
`gameclock` (`:1748-1752`). The two `7200` literals only matter before first sync.
Resolution (D-6.4): DOCUMENT them as inert pre-connect chrome (the value is already
pack-delivered — there is nothing to wire); L10 retires with that record.

### 2.7 Config-tool — no display-surface editor today

Grep-clean of `config-tool/lib` + `public` for a display/surface editor. Only hit:
`public/js/components/commandForm.js:63-64` exposes `display:idle-loop` /
`display:scoreboard` as CUE actions (firing, not configuring). The surfaces
designer page is B-pages (ROADMAP §8) future; this slice adds NO config-tool UI
(D-6.5 — the pack `surfaces` block is hand-authored / Notion-synced for now, same
posture strings/cues took at their build slice).

### 2.8 Test surface (what pins behavior today)

Backend: `tests/unit/services/displayControlService.test.js` (state machine, 607L,
mock-only no pack), `tests/contract/websocket/display-events.test.js`,
`tests/unit/services/commandExecutor.test.js:480` (the four display commands),
`tests/contract/http/resource.test.js:164-175` (serve-time injection), E2E
`flows/08-display-control.test.js` (@hardware), `flows/23/24/25-scoreboard-*`.
Scanner: `tests/unit/admin/DisplayController.test.js` pins the three literal command
strings — the tripwire that flips if the DisplayController API changes.
NONE exercise a pack `surfaces` block (it does not exist yet) — this is open ground.

---

## 3. Design positions (the mechanism)

### D-6.1 — Fill the reserved `surfaces` key; do NOT mint a `display` sibling

The schema already reserves `surfaces` (§2.2). Fill its sub-schema rather than add a
`display` key that would duplicate the concept. Matrix row 2.3's "`display.idleLoop`"
is shorthand for "the pack's idle-loop name"; the actual key is `surfaces.idleLoop`.
This keeps the honesty table (CONTEXT.md) single-homed on one surfaces concept.

### D-6.2 — `surfaces.idleLoop` is a venue-channel NAME reference, not a filename

Per §13.2(c) + ROADMAP §2.3 (media never in packs). The pack declares a NAME (a
stable channel identifier, e.g. `"idleLoop": "house-idle"` or the game's own label);
the engine resolves that name to an actual media file through venue/installation
config — NOT the pack. This is the SAME shape as slice-4 lighting roles: pack names a
role, the installation profile binds it to a concrete scene. **Resolution mechanism
is an owner question (Q6-2)** — the attractive default is profile symmetry (the
installation profile gains a `bindings.surfaces.idleLoop → file/channel`), with the
existing `config.display.idleLoopFile` as the loud engine fallback (the L7 pattern).
The decision-free core can land the pack DECLARATION + schema + gate WITHOUT choosing
the resolver, if the resolver is the held part — but the declaration is inert without
a consumer, so this slice's build order sequences the resolver behind Q6-2.

### D-6.3 — The surface SET stays engine-fixed at three; the three-value enums stay literal

Q14 is answered (§13.2): no pack-defined new surfaces in Phase 3. So
`displayControlService`'s `DisplayMode`, the scanner's `DisplayController` three
commands, and the `MonitoringDisplay`/`VideoRenderer` `'IDLE_LOOP'`/`'SCOREBOARD'`
comparisons all stay literal — reclassifying them would be building the BILL-era
extensibility this slice explicitly defers. "Parameterize" acts on surface CONTENT
(idle-loop identity, and the already-done mode-surface/strings/scoring axes), not on
the surface INVENTORY.

### D-6.4 — L10 retires by documentation (the value is already delivered)

See §2.6. Add a source comment at `scoreboard.html:853,946` marking the `7200`
literals as inert pre-connect chrome (real value arrives via sync), and close L10 in
the ledger. No new wire.

### D-6.5 — No config-tool UI this slice; `surfaces` is hand/Notion-authored

Same posture strings (3a) and cues (pre-S4) took: the pack block lands
hand-authored; the designer page is B-pages. A validator/gate refusal is the safety
net, not a form.

### D-6.6 — slice1-modes.md:39 wording correction (decision-free)

Replace "B12/slice 6 later makes the surface set itself pack-extensible" with wording
that matches the ratified honesty table: the surface set stays engine-fixed; slice 6
makes the three built-ins pack-selectable/parameterizable; a genuinely NEW surface
(the constellation renderer) is BILL-era headroom (ROADMAP §6, row 8.8). The
RESOLUTION seam built in slice 1 is what the parameterization plugs into.

### D-6.7 — The Q6-3 scoreboard parameter is `surfaces.scoreboard.evidenceCycleMs`

The Q6-3 census (2026-08-29) weighed the scoreboard's hard-coded content/behavior
knobs against the theme-unit boundary and recommended the **evidence-card cycling
cadence** — the cleanest cut (pure timing, zero styling), a single scalar with the
same delivery cost as `idleLoop`, and no new backend wiring (`scoreboard.html` already
fetches `game.json` at init and reads `scoring.display.format` the same way).

- **Parameter:** `surfaces.scoreboard.evidenceCycleMs` — a positive integer, the BASE
  evidence-page cycling interval in ms. Today (`scoreboard.html:1287`) the interval is
  a hard two-tier heuristic: `pages.length <= 3 ? 18000 : 12000`. The pack sets the
  base (the ≤3-pages value); the engine KEEPS the "speed up when 4+ pages" adaptation
  as engine behavior, deriving the dense tier as `round(base * 2/3)`. ALN declares
  `18000` → few=18000, many=12000, BYTE-FAITHFUL to today's two values. The toy pack
  declares a different base (dual-pack proof). Absent → the engine default (18000).
- **Delivery:** client-side only — `scoreboard.html` reads
  `game.surfaces?.scoreboard?.evidenceCycleMs` in the existing `game.json` init fetch;
  no server engine change (unlike `idleLoop`, which needs the profile resolver). This
  is the cheaper of the two `surfaces` parameters.
- **Doc-drift caught (fix when touching the code):** `backend/CLAUDE.md:255-263`
  describes a STALE scoreboard design (a three-tier 18/15/12s cadence, a "hero
  evidence card", "dynamic slot calculation") that the actual two-tier code has NONE
  of. Correct it to ground truth in S6.3.
- **Boundary held:** styling knobs (paper-tilt jitter, flash timings, ticker scroll
  speed, pagination px-geometry) stay OUT — theme unit / venue-display concerns. The
  `displayBehavior.fields` dead letter (declared in packs, parsed by modeSemantics,
  never read by scoreboard.html) is a pre-existing gap under `modes[]`, NOT this
  slice's `surfaces` parameter — noted, not touched.

---

## 4. Owner answers (RULED 2026-08-29 — build input)

The owner ruled all three the EXPANSIVE way — this is a full slice, not the minimal
reading. Recommendations (minimal) were declined; the rulings below are the build
contract.

- **Q6-1 (SELECT depth) → ALLOW OPT-OUT.** A pack may declare it has no idle loop, or
  no scoreboard, and the display-mode state machine HONORS it (skips the surface).
  This is a real `displayControlService` change: `setIdleLoop()`/`setScoreboard()`
  and the return-to-previous-mode logic must degrade gracefully when a surface is
  suppressed (e.g. a no-idle-loop pack returns to a blank/black output or stays on
  the last surface, never to a missing idle loop; a no-scoreboard pack's
  `display:scoreboard` command is refused with a clean message). Own E2E matrix.
- **Q6-2 (idle-loop RESOLUTION) → PROFILE-BINDING RESOLVER NOW.** Reuse slice-4's
  installation-profile pattern: the pack names an idle-loop CHANNEL
  (`surfaces.idleLoop`), the installation profile binds the channel to a concrete
  media file/target, and `config.display.idleLoopFile` is the loud L-ledger fallback
  when the profile has no binding (the L7 lighting-role shape, exactly). Build the
  full resolver this slice (S6.3 UN-HELD). profileService gains a
  `bindings.surfaces` (or equivalent) read beside `bindings.lighting`;
  `vlcMprisService` idle-loop init resolves through it.
- **Q6-3 (PARAMETERIZE breadth) → SCOREBOARD ALSO GAINS A PARAMETER.** Beyond
  `surfaces.idleLoop`, the SCOREBOARD surface gains one pack-declared parameter this
  slice. The specific parameter is NOT yet named ("e.g. layout/columns") — the ruling
  explicitly calls for "its own census of what's worth parameterizing." So a focused
  scoreboard-parameter census runs at S6 open (in flight); the candidate must be
  CONTENT/behavior config that belongs to the surface, NOT visual styling (colors/
  fonts/star-drop are the THEME UNIT's scope — keep the slice-6/theme-unit boundary
  clean). Candidate axes the census weighs: evidence-card cycling cadence, rankings
  display count / column set, idle↔scoreboard auto-switch timing. Decision recorded
  once the census lands (D-6.7, pending).

Scope consequence: S6.3 is now in-scope and larger (resolver + opt-out state machine +
the ruled scoreboard parameter). Estimate moves to the upper band (§7).

---

## 5. Build order (per the RULED expanded scope)

- **S6.2 (housekeeping, decision-free) — DONE 2026-08-29:** L10 retired (D-6.4
  comments + ledger), slice1-modes:39 correction (D-6.6), the R13 table (§1),
  matrix reclassification logged in PHASE3-STATUS. Landed with the slice-open commit.
- **S6.1 (schema + gate):** fill the `surfaces` sub-schema:
  - `surfaces.idleLoop` — a venue-channel NAME (non-empty string; refuse a path/
    filename shape). OPT-OUT (Q6-1): absent or explicit `null` = "this game has no
    idle loop" (schema-legal, gate-accepted).
  - `surfaces.scoreboard` — an object carrying `enabled` (Q6-1 opt-out: `false` =
    no scoreboard) plus the ONE ruled content parameter from the Q6-3 census (D-6.7,
    pending — schema shape lands once the census picks the parameter).
  - Capability id (e.g. `surfaces.select`) in `ENGINE_CAPABILITIES`; a pack declaring
    `surfaces` lists it in `requires` (cues/lightingRoles precedent). Gate: shape +
    requires lint + the opt-out coherence rules. Contract tests + gate unit tests.
  - TokenData: ALN pack declares its idle-loop channel + scoreboard param
    (byte-faithful intent); toy pack declares DIFFERENT values AND exercises an
    opt-out (e.g. toy has no idle loop) for the dual-pack proof. Manifest regen.
- **S6.3 (resolver + opt-out state machine + scoreboard param):**
  - Profile resolver (Q6-2): profileService reads `bindings.surfaces.idleLoop`
    (beside `bindings.lighting`); `vlcMprisService` idle-loop init resolves the pack
    channel → profile binding → `config.display.idleLoopFile` loud fallback (the L7
    shape). New ledger row for the fallback.
  - Opt-out (Q6-1): `displayControlService` honors a suppressed surface —
    `setScoreboard()` refuses cleanly when the pack opts out of the scoreboard;
    idle-loop suppression degrades to a defined output (no crash, no missing-file
    loop). The SCANNER reflection (hiding the "Show Scoreboard" button) is DEFERRED
    — see §6: the backend refusal is the functional enforcement; hiding the button
    is cosmetic and costs a full scanner leg.
  - Scoreboard param (Q6-3/D-6.7): `scoreboard.html` reads the ruled parameter from
    the delivered `game.json` `surfaces` block; the pack value drives it.
  - Dual-pack E2E: each pack drives a different idle loop + scoreboard param; the
    toy's opt-out path proves surface suppression. Capability-gated on VLC (slice-4
    lighting posture).
- **S6.4 (close):** dual-pack Tier L (both legs), coverage ratchet, mixed-model
  adversarial review (subagent policy), PHASE3-STATUS close + queue advance to slice 7.

---

## 6. Residue / deferrals (explicit, each pointing at a named roadmap entry)

- SCANNER reflection of a suppressed surface (hiding the GM "Show Scoreboard" button
  when a pack opts out) → DEFERRED. The owner's ruling ("the state machine honors
  opt-out") is met by the BACKEND: `displayControlService.setScoreboard()` refuses
  cleanly (a `gm:command:ack` failure), so the button is functionally inert already.
  Hiding it is cosmetic UX that costs a full scanner leg (data/ submodule bump + code +
  dist rebuild); it rides the B-pages surfaces work (ROADMAP §8) or a later scanner
  touch. Recorded, not built this slice.
- Pack-DEFINED new surfaces + the constellation renderer → ROADMAP §6 BILL-modules
  block / row 8.8 (post-Phase-4). Slice 6 builds only the select/parameterize seam.
- Idle-loop media FILE carriage → ROADMAP §8.1 (pack-manager media page). Slice 6
  ships only the NAME reference.
- The full venue-channel resolution mechanism (if Q6-2 rules it a new map, not the
  profile) → C-series / ROADMAP §8.3. Slice 6 uses the minimal resolver Q6-2 rules.
- Config-tool surfaces designer → B-pages (ROADMAP §8).
- Scoreboard-title theming (row 2.5) → theme unit, not this slice.
- `idle-loop.mp4` absent from `public/videos/` → an ops landmine, not a pack change.

---

## 7. Honest estimate (program §12.3 calibration)

**≈3.5–5.5 sessions** at the RULED (expansive) scope. The owner took all three the
big way: profile-binding resolver (couples to profileService, `vlcMprisService`
idle-loop init, a new ledger fallback row), opt-out (a `displayControlService`
state-machine change with its own dual-pack E2E matrix, plus the scanner-side reduced
surface set), AND a new pack-declared scoreboard parameter (a fresh census + a
`scoreboard.html` consumer + delivery). That is three of slice-4's kinds of work
(schema+gate, profile resolver, a state-machine touch) minus the config-tool UI. The
calibration multiplier (program's own ~2× under-estimation history) is folded in.
Widest bands: S6.3 opt-out state machine (the return-to-previous-mode logic with a
surface missing) and the Q6-3 parameter (its behavior + its E2E). The minimal-reading
≈1.5–3 estimate is RETRACTED — it assumed the recommendations the owner declined.

---

## 8. Execution record

(Filled per stage as S6.1–S6.4 land, mirroring slice-4 §9.)
