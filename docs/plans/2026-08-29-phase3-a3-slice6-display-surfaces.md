# A3 Slice 6 — display surfaces (pack selects/parameterizes the built-in three)

Status: DESIGN, decision-free core buildable; owner questions HELD (§4).
Program pointer: `2026-06-11-phase3-program.md` §13 item 2 (ratified 2026-08-29,
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

---

## 4. Owner questions (HELD — do not build past these)

These gate the parts of "select and parameterize" that §13.2's one-line "minimal"
does not pin. The decision-free core (§5) builds everything NOT gated here.

- **Q6-1 (SELECT depth):** Does "select the three surfaces" let a pack OPT OUT of a
  built-in surface — e.g. a game with no idle loop, or no scoreboard — or is "select"
  satisfied by parameterizing content within the always-present three? (Recommend:
  minimal = no opt-out this slice; a pack that wants a blank idle loop names an empty/
  black channel. Opt-out is a larger state-machine change.)
- **Q6-2 (idle-loop RESOLUTION mechanism):** How does `surfaces.idleLoop`'s venue-
  channel name resolve to a file? (a) Installation-profile binding (slice-4 lighting-
  role symmetry) + `config.display.idleLoopFile` loud fallback; (b) a new venue-channel
  map (C-series territory); (c) engine-config passthrough only (the pack name is
  advisory, the venue env var still wins). Recommend (a) for symmetry, but it couples
  slice 6 to the profile mechanism and may overreach the "minimal" reading — owner
  call.
- **Q6-3 (PARAMETERIZE breadth):** Is the minimal reading JUST `surfaces.idleLoop`,
  or does the SCOREBOARD surface also gain a pack parameter this slice (beyond the
  already-done mode-surface/strings/scoring)? (Recommend: idleLoop only; scoreboard
  content is already pack-driven through three prior slices.)

Until Q6-1/2/3 are ruled, the build lands the schema + gate + declaration and the
L10/wording/R13 housekeeping; the RESOLVER + any opt-out state-machine work waits.

---

## 5. Build order (decision-free core first)

- **S6.1 (schema + gate, decision-free):** fill `surfaces` sub-schema with
  `idleLoop` (string, venue-channel name; NOT a path — a refusal if it looks like a
  filename/path is a candidate rule). Add capability id (e.g. `surfaces.select`) to
  `ENGINE_CAPABILITIES`; a pack declaring `surfaces` must list it in `requires`
  (the cues/lightingRoles precedent). Gate: `surfaces` shape + the requires lint.
  Contract tests both sides. TokenData ALN pack declares its idle-loop channel name
  (byte-faithful to today's `idle-loop.mp4` intent). Toy pack declares a DIFFERENT
  name (dual-pack proof). Manifest regen.
- **S6.2 (housekeeping, decision-free):** L10 retire (D-6.4 comments + ledger),
  slice1-modes:39 correction (D-6.6), the R13 table recorded in this doc (done in §1),
  matrix reclassification logged in PHASE3-STATUS.
- **S6.3 (resolver — GATED on Q6-2):** engine consumption of `surfaces.idleLoop`
  through the ruled resolution mechanism; `vlcMprisService` idle-loop init reads the
  resolved value; loud fallback. Dual-pack E2E: each pack drives a different idle
  loop (capability-gated on VLC, same posture as slice-4 lighting).
- **S6.4 (close):** dual-pack Tier L, ratchet, adversarial review, close record.

If Q6-1/2/3 come back "minimal, idleLoop-only, profile-resolved", S6.1→S6.4 is a
small slice (schema + one engine read + housekeeping). If "select includes opt-out"
or "scoreboard also parameterized", the state-machine work widens S6.3.

---

## 6. Residue / deferrals (explicit, each pointing at a named roadmap entry)

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

**≈1.5–3 sessions** if the owner rules Q6-1/2/3 minimal (schema + gate + one engine
read + housekeeping + dual-pack gate + review — smaller than slice 4, no new service,
no contract-event change, no config-tool UI). **≈3–4.5** if "select" gains opt-out
(a display-state-machine change with its own E2E matrix) or Q6-2 rules a new
venue-channel map (a resolution mechanism rather than a profile binding). The
calibration multiplier (program's own ~2× under-estimation history) is already folded
in. Widest band: S6.3 (resolver), pending Q6-2.

---

## 8. Execution record

(Filled per stage as S6.1–S6.4 land, mirroring slice-4 §9.)
