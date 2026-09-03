# Phase 3 — theme unit: minimal theme.json (design r1)

Date: 2026-09-03 · Branch: `claude/phase3-theme-unit` (from slice-7 tip
`4923575`) · Draft PR #31 (opened at unit open).

Governed as a full A3 slice (program §13.5): census → design → red-team
→ build → adversarial review → close record.

## 1. Scope and ruled inputs

The unit builds the pack's visual identity file, minimal version
(CONTEXT.md §3 "Theme"): **semantic mode colors, rating glyph/display
choice, scoreboard accent** — so the Track-B strings-&-theme editor
page has a real substrate (Q-3c-1 option (a), ruled 2026-08-22). Full
theming depth waits for the first real second game.

Ruled inputs, verbatim anchors:

- **Q-3c-1 (a)** — minimal theme.json is its own scheduled unit
  (PHASE3-STATUS owner-rulings block).
- **Q-3b-2 + the star ruling** — "glyphs are visual identity → theme
  unit. Owner confirmed the star map (rating = bury-value input; star
  DISPLAYS are informational-only) and ruled ALN does not need the
  star displays — rating display becomes a themed choice; ALN opts
  out."
- **Program §13.5** — "star-drop = the three GM-scanner display sites
  only (config-tool previews + the report ★ excluded); 'Q5 depth'
  declared discharged by the closers; the unit is governed as a full
  A3 slice."
- **Ledger L11** — scoreboard Google-Fonts CDN links retire in "the
  styling-bearing slice" (this one). The census extended the class:
  `config-tool/public/index.html:7,9` carries the same CDN links.

OUT (each with its named home): ESP32/NeurAI BMP theming (matrix 7.4 —
Phase-5 content tooling / ROADMAP §8.x family), player-scanner branding
(matrix 5.3 — L3 posture), ESP32 theme delivery channels (matrix
3.11/3.12), the narrative slot (matrix 8.6), config-tool star previews
and the report ★ cell (§13.5 exclusions), full font theming (the pack
choosing FAMILIES — first-real-second-game depth; this unit only fixes
L11's delivery risk), `modes[].icon` (already pack data in game.json,
presentation stratum — stays where it is).

### R13 extraction brake

Matrix rows moved (both classified **game-content** — neither
engine-fixed nor venue-config; brake satisfied):

- **1.26** "Star-rating presentation (⭐ repeat for detective)…
  game-content… Hardcoded glyph… strings.json/theme"
  (capability-matrix.md:59) → the rating display/glyph choice moves to
  theme.json.
- **4.21** (the visual half) "App branding, titles, evidence-red CSS,
  screen copy… game-content… strings.json + theme.css (Phase 3.2a)"
  (capability-matrix.md:146) → the WORDING half moved in 3a; this unit
  moves the semantic COLOR half (mode colors, accents) into theme.json.
  Matrix 2.5's window-title coupling (the row's named prerequisite) was
  already fixed in 3a (SCOREBOARD_WINDOW_MARKER).

## 2. Census record (workflow `wf_242fab04-73f`, 2026-09-03; 7 agents, counts verified by 2 independent recount legs)

**Star/rating display sites (counts agree across legs):**

| # | Site | What | Class |
|---|---|---|---|
| 1 | `ALNScanner/src/ui/uiManager.js:471` | Result screen, non-scoring branch: `formatStars(SF_ValueRating)` (filled-only ⭐) into `#resultValue` | gm-scanner-display (IN) |
| 2 | `ALNScanner/src/ui/renderers/GameOpsRenderer.js:360` | Team Details per-token "Base Rating" (filled-only ⭐; 'N/A' for unknown) | gm-scanner-display (IN) |
| 3 | `ALNScanner/src/ui/renderers/GameOpsRenderer.js:502` | Game Activity token card `.token-card__rating` (`★`/`☆` padded, scale-clamped) | gm-scanner-display (IN) |
| 4-5 | `config-tool` economy.js:58, tokenBrowser.js:95 | formatStars previews (+ economy.js:57 numeric key cell) | EXCLUDED (§13.5) |
| 6 | `sessionReportGenerator.js:291` | The contracted ★ delimiter | EXCLUDED (§13.5) |

Backend/src, backend/public: ZERO rating renders (verified both legs).
Builders: scanner `scoring.js:113` `formatStars` (default '⭐');
config-tool twin `formatting.js:31` (default '★'). The scanner builder's
own comment confirms it was built to serve exactly these three sites
(3b). §13.5's "three" CONFIRMED from code.

**Semantic color substrate (scanner):** `variables.css` defines 110
custom props; the color-bearing set includes the mode-semantic pair
`--color-mode-scoring: #ff6b35` (:37) / `--color-mode-evidence:
#22c55e` (:38), the accent family (:27-32, primary `#c41e3a` crimson),
status colors (:42-44), and `--color-accent-value` (:39, deliberately
mode-decoupled). (Count-rule note: reader legs reported 25-38
"color-valued" props depending on whether shadow/overlay rgba values
count — adjudicated by direct read; the design hinges on the semantic
SET above, not the scalar.) Six visual-role rules key off
`.mode-scoring`/`.mode-evidence`: `components.css:298,304` correctly
read the custom props; **`screens/admin.css:874,878,956,957` hardcode
`#f59e0b`/`#3b82f6` literals that DRIFT from the declared tokens** — a
census-caught defect: a theme could never recolor those four sites.
Runtime injection precedent: `initializationSteps.js:219`
`setProperty('--entity-empty-team-list', …)` (the closers).
`modeClassNames()` also emits `mode-<slug>` id classes with zero CSS
consumers today (3c headroom, untouched here).

**Scoreboard (backend/public/scoreboard.html, 1844 lines):** its OWN
`:root` palette (10 tokens; `--evidence-red: #c41e3a` = the accent the
Q-3c-1 ruling names, byte-equal to the scanner's accent-primary but
independently declared), 29 color literals (13 hex + 16 rgba/hsla),
including hardcoded strays `#dc3545` (:342, blended into a gradient),
`#666` (:404), `#000` (:596). Fonts: 3 CDN links (:12-14; IBM Plex
Mono, Libre Baskerville, Playfair Display, Special Elite),
4 `--font-*` vars (:35-38; `--font-display` is defined but UNUSED),
11 usage sites; zero web-font files anywhere in the repo; no other
page shares the families. Injection: 3 placeholders
(`%%WINDOW_MARKER%%` :9, `%%ADMIN_PASSWORD%%` :774, `%%PACK_STRINGS%%`
:785) via `resourceRoutes.renderScoreboardHtml` (:160-179; jsonForScript
+ function replacements; route mounts before express.static :188).

**Sidecar plumbing (strings.json is the template; theme's current
state per hop):** (1) `build-pack-manifest.js:43` + Python twin `:52` —
role 'theme' ALREADY EXISTS; (2) `pack-manifest.schema.json:34` — in
the enum; (3) backend gate twin — ABSENT (template:
`packService._loadDeclaredStrings` :407-476, gate call :738-745, throw
:829-836, activate freeze :959-984, accessor `getStrings()`
:1031-1034); (4) `GET /api/pack/files/*` serving is role-agnostic
(manifest-membership only, `resolvePackFile` :1176-1186) — theme.json
servable the moment it is inventoried; (5) scanner
`packLoader.js:63` `RULES_ROLES = {game, tokens, strings}` — 'theme'
NOT fetched/staged today (staged loop :217-231, declared-must-be-staged
check :245-248, cache read :301-328, bundled best-effort :335-363,
`_activate` return shape :385-415); (6) scanner-side module — ABSENT
(template: `strings.js` DECLINE mirror, kind/schemaVersion exact-match
:99-119); (7) `%%PACK_STRINGS%%` injection — the server-page template;
(8) capability precedent — `surfaces.select` in `ENGINE_CAPABILITIES`
(:52-60) + requires⊆caps check (:520) + the block-lint precedent
`_validateSurfacesBlock` (:319-404) + the schema-description convention
(game.schema.json:495); (9) `strings.schema.json` — the sidecar-schema
shape (kind/schemaVersion consts). **Load-bearing find:**
`game.schema.json:476` ALREADY declares a `theme` property — but as a
loose `{"type":"string","pattern":"\\.json$"}`, NOT the canonical
`const` the strings (:472) and cues (:480) pointers use; nothing reads
it anywhere.

**Pack state:** neither real pack ships theme.json or any `theme.*`
capability (requires arrays quoted in the census output); both
strings.json files are 100% wording; the only visual glyphs in pack
data are `modes[].icon` (game.json), schema-documented as a distinct
stratum. ROADMAP theme mentions: §1:39 (design-tool scope), §3:158
(this unit's queue entry).

## 3. Design

### D-T.1 — theme.json: a declared sidecar in the strings mold

`ALN-TokenData/theme.schema.json` (new), shape per the sidecar
template: `kind: const 'theme'`, `schemaVersion: const 1` (a NEW
artifact — starts at 1; the strings sidecar's 2 reflects its own
history), `additionalProperties: false`, all sections optional:

```json
{
  "kind": "theme",
  "schemaVersion": 1,
  "colors": {
    "modeScoring":  "#rrggbb",
    "modeEvidence": "#rrggbb",
    "accentPrimary": "#rrggbb",
    "accentValue":  "#rrggbb"
  },
  "rating": {
    "display": "stars" | "numeric" | "none",
    "glyph":   { "filled": "★", "empty": "☆" }
  },
  "scoreboard": {
    "accent":     "#rrggbb",
    "accentDark": "#rrggbb"
  }
}
```

- Colors are STRICT 6-digit hex (`^#[0-9a-fA-F]{6}$`). Hex-only is the
  whole injection-safety story for CSS sinks: no `var()`, no
  `url()`, no functions, nothing that can escape a CSS custom-property
  value or smuggle an import. (The 3b/closers XSS findings — pack
  content reaching innerHTML/CSS — make this a hard rule, red-teamable.)
- `rating.display` drives the three GM-scanner sites: `stars` renders
  through `formatStars` with the declared glyphs; `numeric` renders the
  plain number (with the baked `/5`-free form — just the digit, as
  economy.js:57's precedent); `none` suppresses the rating element
  (ALN's ruled choice). `glyph.filled`/`glyph.empty` are 1-4 code-point
  plain glyphs (the icon idiom: control/bidi stripped, no markup chars,
  code-point cap — schema pattern + value-twin normalization).
- `scoreboard.accent`/`accentDark` re-point the page's
  `--evidence-red`/`--evidence-red-dark` tokens.
- The section keys deliberately mirror the CONSUMING token names, not
  CSS property spellings — the theme declares semantics; the engine
  maps them onto its own custom properties.

`game.schema.json` change: tighten the existing loose `theme` slot
(:476) to the canonical pointer — `const "theme.json"` — matching
strings/cues. Schema-tightening on a never-used slot: no pack can
break (census: zero declarations anywhere).

Capability: new `theme.minimal` id in `ENGINE_CAPABILITIES` (append-only
minor per slice-1 D1). A pack declaring `theme` in game.json must list
`theme.minimal` in `requires` (the surfaces.select precedent:
schema-description note + gate lint twin).

### D-T.2 — backend: gate twin + snapshot + serve

`packService` gains the strings-mirror set: `_loadDeclaredTheme()`
(declared-must-load-or-refuse; undeclared = benign null),
`themeCheck` in `_gateCheck` (schema validation against
theme.schema.json + the requires-lint), `activeTheme` frozen at
`activatePack()`, `getTheme()` accessor (null when undeclared — the
`getStrings()` posture). Serving needs NO route work (role-agnostic
whitelist) — the manifest entry makes it servable.

The scoreboard page gains `%%PACK_THEME%%` injected exactly as
`%%PACK_STRINGS%%` (jsonForScript, function replacement); a small
inline `applyTheme(t)` sets `--evidence-red`/`--evidence-red-dark`
from `t?.scoreboard?.*` when present (hex-validated AGAIN client-side —
defense in depth at the sink, the closers' posture). Undeclared theme:
zero visual change (baked page palette stays; benign class — wrong
colors cannot corrupt a game; NO loud shim).

### D-T.3 — scanner: theme rides the pack channel; three sites obey it

- `packLoader.js`: add `'theme'` to `RULES_ROLES`; the declared-theme
  staged check, cache read, bundled best-effort, and `_activate` return
  field — each the strings twin at the cited lines (census hop 5).
- NEW `src/core/theme.js` (strings.js mold): `THEME_SCHEMA_VERSION = 1`,
  `applyPackTheme(sidecar)` (kind/schemaVersion exact-match DECLINE
  with warn; per-leaf validation — hex pattern for colors, icon-idiom
  normalization for glyphs, enum for display), plus read accessors:
  `ratingDisplay()` (`'stars'` baked default — packless byte-identical),
  `ratingGlyphs()` (baked `{filled:'⭐'}` for sites 1-2's filled-only
  form and `{filled:'★', empty:'☆'}` for site 3 — see D-T.5),
  `themeColors()` (null when undeclared).
- Color injection: at `tokenManager.loadDatabase()` time (the
  applyPack* moment), declared colors set the scanner custom props via
  `documentElement.style.setProperty` (the :219 precedent):
  `colors.modeScoring → --color-mode-scoring`, `modeEvidence →
  --color-mode-evidence`, `accentPrimary → --color-accent-primary`,
  `accentValue → --color-accent-value`. Undeclared: no setProperty
  call at all — the stylesheet values stand (benign class).
- The three star sites re-point through the theme choice:
  - `display:'none'` → the rating element is not rendered (site 1: the
    non-scoring result branch shows no value line; site 2: the "Base
    Rating" field omitted; site 3: no `.token-card__rating` span).
  - `display:'numeric'` → the plain rating digit.
  - `display:'stars'` (baked default) → `formatStars` with the
    resolved glyphs — byte-identical packless output.
- **Census-caught drift fix:** `admin.css:874,878,956,957` re-keyed to
  `var(--color-mode-scoring)`/`var(--color-mode-evidence)`. This is a
  VISUAL change at those four sites for ALN (from the drifted
  `#f59e0b`/`#3b82f6` literals to the declared `#ff6b35`/`#22c55e`
  tokens — the colors 3c ratified as the semantic pair). Recorded as a
  deliberate correction: the drift means today's admin cards disagree
  with the mode indicator colors on the SAME screen; the tokens are
  the ruled source. Flagged for the red-team + close-record visibility.

### D-T.4 — the packs

- **ALN** declares `"theme": "theme.json"` + `theme.minimal` in
  requires; its theme.json is exactly `{kind, schemaVersion, rating:
  {display: "none"}}` — the ruled star-drop, nothing else (colors stay
  undeclared: the baked values ARE ALN's identity — the
  bake-is-the-voice doctrine, now WITH the slice-7 lesson applied: an
  inverted pin asserts ALN declares no `colors`/`scoreboard` section,
  so the baked tier stays the proven tier).
- **Toy** declares a genuinely divergent theme (the second-consumer
  doctrine): heist colors (e.g. amber/teal), `rating: {display:
  "stars", glyph: {filled: "💎"}}` (exercises the glyph path the ALN
  drop turns off), and a scoreboard accent. Every declared leaf lands
  in a Tier-L-visible or unit-pinned surface.
- Manifests regenerated (both builders, byte-parity as always).

### D-T.5 — glyph semantics (one choice, not three)

Today's three sites use TWO different star forms (filled-only ⭐ at
sites 1-2; padded ★/☆ at site 3). The theme declares ONE glyph pair;
the SITES keep their forms: filled-only sites render
`formatStars(r, {filled})`; the padded site renders
`formatStars(r, {filled, empty})`. A theme that declares only `filled`
gets filled-only everywhere (empty defaults to null = no pad at site 3
— schema documents this). Baked defaults reproduce today's bytes
exactly (⭐ filled-only at 1-2; ★/☆ at 3) — the packless golden
surface. The baked GLYPH split stays engine behavior; the theme only
overrides the pair.

### D-T.6 — fonts (ledger L11)

Self-host the four scoreboard families as woff2 under
`backend/public/fonts/` + a generated `fonts.css` with `@font-face` +
the existing fallback stacks; the three CDN `<link>`s (:12-14) are
replaced by one local stylesheet link. Rationale: the venue is
OFFLINE-LAN — today the CDN fonts silently fail at the venue and the
page renders fallbacks, so self-hosting RESTORES the intended look
where it matters; dropping the links would instead canonize the
fallback look. Weight: woff2 subsets, expected well under ~400 KB
total — engine page assets (not pack media; ROADMAP §2.3 governs game
MEDIA, not the engine's own page chrome). `--font-display`
(:35, unused) is DELETED (dead token). Config-tool's two CDN links
(index.html:7,9) get the same treatment (its families TBD at build —
whatever :7,9 request). If woff2 files cannot be fetched in this
environment (proxy), the fallback remedy is: drop the CDN links +
promote the fallback stacks, recorded as the L11 fix with the
self-host step left as a named residue. L11 retires either way (no
runtime CDN dependency).

Font FAMILIES stay engine-fixed this unit (no `fonts` section in
theme.schema.json) — family theming is first-real-second-game depth
(Q-3c-1's boundary), and the schema's closed shape means adding a
`fonts` section later is additive.

### D-T.7 — what this unit does NOT touch

The report generator (slice-7 contract surface — the ★ cell is
contracted), config-tool previews (§13.5), `modes[].icon`,
`formatCurrency`/money formats (3b), the strings sidecar, CSS beyond
the four drift sites + the custom-prop injection, the scoreboard's
non-accent literals (`#666`, `#000`, `#dc3545` stay — minimal scope;
the `#dc3545` stray is RECORDED as a candidate for the accent family
in the B-pages theme editor era).

## 4. Owner questions

None held — every choice above traces to a ruled input (Q-3c-1a,
Q-3b-2, §13.5, L11) or an established doctrine (sidecar mold, benign
wording class, second-consumer, bake-is-the-voice + inverted pin).
Two calls the red-team should specifically attack as potential
owner-question material:
(a) D-T.3's drift fix changes four admin-card colors ALN GMs currently
see (defended as a correction to the ratified tokens);
(b) D-T.6's self-host remedy (defended as restoring the intended venue
look; bounded fallback recorded).

## 5. Build order

- **ST.1 — schema + gate (TokenData + backend, red-first):**
  theme.schema.json; game.schema theme-const tightening; capability id
  + requires-lint; `_loadDeclaredTheme`/themeCheck/activeTheme/
  `getTheme()`; contract pins (legal theme on both real-pack clones;
  refusal twins: bad kind/version, non-hex color, table of glyph
  refusals; undeclared = null; declared-without-requires refused).
- **ST.2 — scanner (red-first):** packLoader theme role + staged
  checks; core/theme.js (DECLINE mirror + accessors); custom-prop
  injection; the three sites through `ratingDisplay()`; admin.css
  drift fix; unit + contract pins (packless byte-identity for all
  three sites; display:none/numeric/stars renders; hostile glyph
  DECLINE; inverted pin for ALN's undeclared colors).
- **ST.3 — packs + scoreboard + fonts:** ALN theme.json (star-drop) +
  requires + manifest regen; toy divergent theme + manifest; scoreboard
  `%%PACK_THEME%%` + applyTheme + sink-side hex guard; L11 fonts
  (scoreboard + config-tool); Tier-L pins (toy leg sees its accent
  and/or glyph; ALN leg byte/visual-identical minus the ruled drop +
  drift fix).
- **ST.4 — close:** dual-pack Tier L, fresh ratchets, lint both repos,
  mixed-model adversarial review, records, train re-point (TokenData
  #5 + Scanner #14 gain the theme commits — same branches), task #9.

Per-stage two-axis reviews per the stage frame; the design red-team
runs BEFORE ST.1.

## 6. Residue / ledger

- L11 RETIRES at ST.3 (tripwire: grep fonts.googleapis — must be zero
  in backend/public + config-tool).
- NEW candidate row (recorded at close if unfixed): the scoreboard's
  non-accent hardcoded strays (`#dc3545` :342 et al) — retire in the
  B-pages theme-editor era.
- The B9/report surface, `mode-<slug>` CSS headroom, and font-family
  theming carry their existing homes (untouched).

## 7. Estimate

2.5–3.5 work sessions: ST.1 ≈ 0.75, ST.2 ≈ 1, ST.3 ≈ 0.75–1 (fonts
fetch uncertainty), ST.4 ≈ 0.5–0.75. Smaller than slice 7 (no external
contract surface, no lockstep four-repo schema dance beyond the
established sidecar mold).

## 8. Execution record

(Filled as stages close.)

- 2026-09-03: unit OPENED (branch + draft PR #31 at open); census
  workflow `wf_242fab04-73f` (5 readers + 2 independent recount legs,
  0 errors; the one count discrepancy — variables.css color-prop
  scalar — adjudicated by direct read as a counting-rule artifact;
  §13.5's "three GM-scanner sites" CONFIRMED from code). Census caught
  two real defects folded into the design: the admin.css visual-role
  color drift (D-T.3) and the config-tool extension of L11 (D-T.6).
  Design r1 drafted; red-team next.
