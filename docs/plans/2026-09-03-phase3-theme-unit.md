# Phase 3 — theme unit: minimal theme.json (design r2 — §4a fixes folded)

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
  code-point cap — schema pattern + value-twin normalization). The
  schema pattern excludes C0/markup only; DEL/bidi pass it and are
  stripped-then-checked by the VALUE twins, the runtime authority (the
  verbNoun precedent — schema deliberately no stricter than the twins).
- `scoreboard.accent`/`accentDark` re-point the page's
  `--evidence-red`/`--evidence-red-dark` tokens.
- The section keys deliberately mirror the CONSUMING token names, not
  CSS property spellings — the theme declares semantics; the engine
  maps them onto its own custom properties.

`game.schema.json` change: tighten the existing loose `theme` slot
(:476) to the canonical pointer — `const "theme.json"` — matching
strings/cues. Schema-tightening on a never-used slot: no pack can
break (census: zero declarations anywhere).

Capability: new `theme.identity` id in `ENGINE_CAPABILITIES`
(append-only minor per slice-1 D1; renamed from r1's `theme.minimal`
per §4a OBJ-6 — variants name ABILITIES, and 'minimal' is the unit's
scoping word, not an ability; `theme.fonts` etc. stay clean future
siblings). A pack declaring `theme` in game.json must list
`theme.identity` in `requires` (the surfaces.select precedent:
schema-description note + gate lint twin). The gate ALSO warns loudly
when the active manifest inventories a role-'theme' file that game.json
does not declare (§4a O3 — inventoried+served+applied-by-nothing is a
silent no-op; the warn is generic over the sidecar roles, covering the
strings twin of the same hole in the same three lines).

### D-T.2 — backend: gate twin + snapshot + serve

`packService` gains the strings-mirror set: `_loadDeclaredTheme()`
(declared-must-load-or-refuse; undeclared = benign null),
`themeCheck` in `_gateCheck` (schema validation against
theme.schema.json + the requires-lint + a GLYPH VALUE TWIN — §4a
OBJ-1: the rating.glyph pair goes through the normalizedIcon-class
normalization (control/bidi strip, markup-char refusal, 1-4 code-point
cap counted as code points) as a gate REFUSAL twin, the three-layer
mold the verbNoun fold ratified: schema + backend twin + scanner twin,
astral acceptance/refusal pinned on all three), `activeTheme` frozen
at `activatePack()`, `getTheme()` accessor (null when undeclared — the
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
  field — each the strings twin at the cited lines (census hop 5) —
  PLUS the network fast-path flag the census range-list missed (§4a
  T-3, the red-team's sharpest catch): `requireDeclaredTheme: true` at
  the `loadPack` pointer fast path (packLoader.js:153) and its
  `_readPackFromCache` branch (twin of :319), with `_themePath()`.
  Without it, a cache staged by pre-theme code passes the contentHash
  check and silently serves theme-less content — ALN's ruled star-drop
  would silently not happen. Pinned in ST.2.
- NEW `src/core/theme.js` (strings.js mold with ONE deliberate
  divergence, §4a O2): `THEME_SCHEMA_VERSION = 1`;
  `applyPackTheme(sidecar)` DECLINEs when kind/schemaVersion are
  ABSENT as well as when they contradict (strings' absence-tolerance
  was backward-compat for pre-3a packs; theme is a NEW artifact with
  zero legacy files, and tolerance would open a gate/DECLINE split —
  headerless applied standalone, refused at the orchestrator);
  per-leaf validation — hex pattern for colors, the icon-idiom glyph
  twin, enum for display; `packThemeApplied()` introspection (§4a
  OBJ-2 — the slice-7 packStringsApplied precedent) with the settings
  pack line gaining the declared-but-unapplied signal (console warns
  are not an operator surface; the design-iteration loop must not fail
  silently); read accessors `ratingDisplay()` (`'stars'` baked default
  — packless byte-identical), `ratingGlyphs()` (baked
  `{filled:'⭐'}` for sites 1-2's filled-only form and
  `{filled:'★', empty:'☆'}` for site 3 — see D-T.5), `themeColors()`
  (null when undeclared).
- Color injection: at `tokenManager.loadDatabase()` time (the
  applyPack* moment), declared colors set the scanner custom props via
  `documentElement.style.setProperty` (the :219 precedent):
  `colors.modeScoring → --color-mode-scoring`, `modeEvidence →
  --color-mode-evidence`, `accentPrimary → --color-accent-primary`,
  `accentValue → --color-accent-value`. Undeclared: no setProperty
  call at all — the stylesheet values stand (benign class).
- The three star sites re-point through the theme choice. The DOM unit
  and the edge cases are specified per site (§4a T-1/T-6/O4 — the
  result screen's `#resultValue` is a static shared span with a
  `Value Rating:` label and four writers; 'skip the assignment' would
  leave the PREVIOUS scan's stars visible under ALN's ruled config):

  | | `stars` (baked) | `numeric` | `none` |
  |---|---|---|---|
  | Site 1 result screen (non-scoring KNOWN-token branch only; scoring branch untouched) | today's ⭐ repeat | rating digit | the whole `.transaction-detail` row (label included) hidden via `el.hidden`, and the span CLEARED — show/hide discipline on EVERY render (the summaryContainer pattern), pinned by a consecutive-scan test |
  | Site 2 Team Details "Base Rating" (isUnknown keeps 'N/A' under stars/numeric) | today's ⭐ repeat; unrated-known = blank | digit when rating ≥ 1; unrated-known stays blank | the whole Base Rating field omitted ('N/A' included) |
  | Site 3 Game Activity card (rating may be 0/undefined for DB-absent tokens) | today's ★/☆ pad; rating 0 = ☆☆☆☆☆ (the deliberate unrated affordance) | digit when rating ≥ 1; else '—' (0 must not read as a score) | no `.token-card__rating` span |

  Glyph output is ESCAPED AT THE SINK at sites 2/3 (§4a O1 — both sit
  in innerHTML template literals; every neighboring pack-derived value
  there already goes through `escapeHtml`, including `modes[].icon`;
  the render pin proves a hostile glyph reaches the DOM as text, since
  the standalone tiers have no gate and DECLINE is their only other
  barrier). Site 1 is textContent (safe as-is).
- **Mode-keyed rule fix (reframed by §4a T-2):** r1 called the
  admin.css literals "drift"; the red-team showed `#f59e0b` IS
  `--color-accent-warning`'s value and `#3b82f6` IS
  `--color-accent-info`'s, and the same literals appear at FIVE more
  non-mode-keyed sites (:762, :846, :888, :966, :988) — so "drift from
  the tokens" was the wrong frame and a four-site recolor by count
  would be arbitrary. The principled class: rules KEYED ON the
  semantic mode classes must read the mode tokens — that is what 3c's
  semantic classes are FOR. Exactly four rules are mode-keyed
  (`.token-card__status.mode-scoring/.mode-evidence` at :874-879's
  blocks — literals on :875/:879, r1's :874/:878 cites were the
  selector lines — and `.token-card__timeline .event.claim.mode-*` at
  :956/:957); those four re-key to
  `var(--color-mode-scoring)`/`var(--color-mode-evidence)`. The
  non-mode-keyed literal sites stay (rating/points text legitimately
  reads warning-amber today) and are RECORDED beside the scoreboard
  strays as theme-editor-era candidates (§6). This is an ALN-visible
  change at four rules (amber→orange, blue→green on admin cards),
  kept flagged as §4's owner-visibility item (a).

### D-T.4 — the packs

- **ALN** declares `"theme": "theme.json"` + `theme.identity` in
  requires; its theme.json is exactly `{kind: "theme", schemaVersion:
  1, rating: {display: "none"}}` — the ruled star-drop, nothing else
  (colors stay undeclared: the baked values ARE ALN's identity — the
  bake-is-the-voice doctrine with the slice-7 lesson applied, and per
  §4a OBJ-3 the pin is ONE DEEP-EQUAL contract assertion on the whole
  file, not per-section absence checks — it covers colors, scoreboard,
  glyph, and every future key at once; a later addition to ALN's theme
  requires touching that pin, which is the point). Under the ruled
  drop, an ALN detective result screen shows NO Value Rating row at
  all — owner-visible, recorded here deliberately (§4 item (a) family).
- **Toy** declares a genuinely divergent theme (the second-consumer
  doctrine): `rating: {display: "stars", glyph: {filled: "💎"}}`
  (exercises the glyph path the ALN drop turns off), divergent mode
  colors, and a scoreboard accent — CHOSEN TO HARMONIZE with the
  baked status palette (§4a T-5: the minimal 4-key colors block
  recolors the mode pair but not the status/accent families it sits
  beside — e.g. `--color-accent-success` stays baked green next to a
  themed evidence color; a theme author in the minimal era picks mode
  colors that read coherently against that; recorded as an authoring
  constraint, retired when theme depth widens the palette). Every
  declared leaf lands in a Tier-L-visible or unit-pinned surface.
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

Self-host SIX families across TWO pages (§4a T-4 corrected r1's
four-family/one-page scope): the scoreboard's four (IBM Plex Mono,
Libre Baskerville, Playfair Display, Special Elite — scoreboard.html
:35-38) and config-tool's two (DM Sans, JetBrains Mono —
config-tool/public/css/styles.css:56-57), as woff2 under each app's
public tree + generated `@font-face` css with the existing fallback
stacks. The CDN links replaced INCLUDE the gstatic preconnects
(scoreboard.html:12-14 is googleapis-preconnect + gstatic-preconnect +
stylesheet; config-tool index.html:7-9 the same trio — r1's "two
links" miscounted). L11's tripwire becomes
`grep -RE 'fonts\.(googleapis|gstatic)' backend/public config-tool`
= zero. Rationale: the venue is OFFLINE-LAN — today the CDN fonts
silently fail at the venue and the pages render fallbacks, so
self-hosting RESTORES the intended look where it matters; dropping
the links would canonize the fallback look. Weight: woff2 subsets,
engine page assets (not pack media; ROADMAP §2.3 governs game MEDIA,
not the engine's own page chrome). `--font-display` (:35, unused) is
DELETED (dead token). If woff2 files cannot be fetched in this
environment (proxy), the bounded fallback remedy is: drop the CDN
links + promote the fallback stacks — L11 still retires (no runtime
CDN dependency), and the intended-look debt gets the PRE-NAMED
conditional ledger row in §6 (§4a OBJ-4), never a bare residue note.

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
The red-team examined the two flagged calls and CONFIRMED neither is a
held question: the doctrine leg verified display:'none' is the only
faithful reading of "ALN opts out" ('numeric' would be opting INTO a
rating display), and the T-2 reframe grounds the four-rule recolor in
what 3c's semantic classes are for. Both stay recorded as
OWNER-VISIBLE changes for the close record: (a) four admin-card rules
recolor (amber→orange, blue→green) + the ALN detective result screen
loses its Value Rating row (the ruled drop itself); (b) the fonts
self-host remedy.

## 4a. Design red-team record (2026-09-03, pre-build — workflow `wf_77d60ad6-a89`, 2 Opus + 1 Fable, 16 objections: 6 BLOCKING / 10 ADVISORY, ALL ACCEPTED — two as amended)

| ID | Sev | Finding (compressed) | Disposition folded |
|---|---|---|---|
| O1 | B | Themed glyphs reach innerHTML UNESCAPED at sites 2/3 (every neighboring pack value there escapes; standalone tiers have no gate) | escapeHtml at both sinks + hostile-glyph render pin (D-T.3) |
| O2 | B | strings.js's kind/schemaVersion ABSENCE-tolerance imported into a NEW artifact = headerless sidecar applied standalone, refused at orchestrator | theme.js DECLINEs on absent headers; headerless refusal pin; divergence documented (D-T.3) |
| O3 | A | theme.json present-but-undeclared: inventoried + served + applied by nothing, silently | generic gate warn over sidecar roles (covers the strings twin of the hole) (D-T.1) |
| O4 | A | display:'none' as skip-the-assignment leaves the PREVIOUS scan's stars visible | merged into T-1's show/hide discipline + consecutive-scan pin |
| T-1 | B | Site 1's DOM unit misidentified: `#resultValue` is a static shared span with a label and four writers | per-site behavior TABLE; hide the whole row via el.hidden; clear on every render; scoped to non-scoring known-token branch (D-T.3) |
| T-2 | B | "Drift" was the wrong frame (#f59e0b/#3b82f6 ARE the warning/info token values; 5 more sites carry them; 4-site recolor = new in-card incoherence) + two line cites off by one | ACCEPTED AS AMENDED: recolor scoped to the principled class (the four MODE-KEYED rules only — that is what 3c's semantic classes are for); cites fixed (:875/:879); non-mode-keyed literals recorded as theme-editor-era candidates (D-T.3, §6) |
| T-3 | B | packLoader's network FAST PATH (`requireDeclaredStrings` at :153) outside every census range — a pre-theme cache would silently cancel ALN's ruled star-drop | `requireDeclaredTheme` at the fast path + cache-read branch + `_themePath()`; pinned (D-T.3) |
| T-4 | A | L11 tripwire blind to gstatic preconnects; config-tool families (DM Sans, JetBrains Mono) disjoint from the scoreboard's | six families / two pages; tripwire covers googleapis|gstatic (D-T.6) |
| T-5 | A | 4-key colors block recolors half of each visual pair — a divergent toy reads as broken styling | harmonize-with-baked-status authoring constraint recorded; toy palette chosen accordingly (D-T.4) |
| T-6 | A | rating 0/undefined/isUnknown unspecified under numeric/none (site 3's ☆☆☆☆☆ is a deliberate affordance; numeric '0' reads as a score) | the per-site case table (D-T.3), each row pinned in ST.2 |
| OBJ-1 | B | Glyph validation lacked the BACKEND value twin (the three-layer verbNoun mold: schema + both twins + gate refusal) | themeCheck gains the glyph refusal twin (normalizedIcon-class), astral pins all three layers (D-T.2) |
| OBJ-2 | A | Declared-but-DECLINEd theme is operator-invisible (console is not an operator surface; the design-iteration loop fails silently) | `packThemeApplied()` + settings pack-line signal, red-first pins (D-T.3) |
| OBJ-3 | A | Inverted pin under-scoped (colors-only) — later ALN theme additions would rot the bake-is-the-voice proof silently | ONE deep-equal pin on ALN's whole theme.json (D-T.4) |
| OBJ-4 | A | The fonts fallback remedy was a bare residue note — a ledger-row-less temporary construct (DoD violation class) | pre-named conditional-watch row in §6 (D-T.6) |
| OBJ-5 | A | ST.3 overloaded (four jobs incl. the fonts wildcard); estimate repeats the pre-re-price optimism slice 7 was caught on | fonts split into stage ST.F (independent); estimate re-priced §7 |
| OBJ-6 | A | 'theme.minimal' names a roadmap depth, not an ability — append-only makes the misnomer permanent | renamed `theme.identity` (D-T.1) |

Survived attack (recorded): the hex-only inertness claim (every
consumer of the target props verified color-position-only; the one
content-var in the repo is a different property), jsonForScript's
protections adequate for `%%PACK_THEME%%`, D-T.5's packless
byte-identity verified against the exact glyph forms, SW-cache /
settings pack line / WS handshake need no theme-specific work
(refuted candidate objections), star-ruling fidelity ('none' is the
only faithful reading), undeclared-theme = benign emptiness is
doctrinally correct, R13 record adequate, schema-const tightening
safe.

## 5. Build order

- **ST.1 — schema + gate (TokenData + backend, red-first):**
  theme.schema.json; game.schema theme-const tightening; capability id
  + requires-lint; `_loadDeclaredTheme`/themeCheck/activeTheme/
  `getTheme()`; contract pins (refusal twins: bad kind/version,
  non-hex color, table of glyph refusals incl. the bidi boundary;
  undeclared = null; declared-without-requires refused; cleaned-glyph
  freeze). [The r2 list also placed the legal-theme-on-both-real-pack
  clones pin here — moved to ST.3 at the ST.1 review: the pin needs
  the real files, which land there.]
- **ST.2 — scanner (red-first):** packLoader theme role + staged
  checks; core/theme.js (DECLINE mirror + accessors); custom-prop
  injection; the three sites through `ratingDisplay()`; admin.css
  drift fix; unit + contract pins (packless byte-identity for all
  three sites; display:none/numeric/stars renders; hostile glyph
  DECLINE; inverted pin for ALN's undeclared colors).
- **ST.3 — packs + scoreboard:** ALN theme.json (star-drop, deep-equal
  pin) + requires + manifest regen + the legal-theme-on-both-real-pack
  clones pin (moved from ST.1's list — needs the real files); toy divergent theme + manifest;
  scoreboard `%%PACK_THEME%%` + applyTheme + sink-side hex guard;
  Tier-L pins (toy leg sees its accent and/or glyph; ALN leg
  byte/visual-identical minus the ruled drop + the four-rule recolor).
- **ST.F — fonts (L11):** its own stage per §4a OBJ-5 (zero dependency
  on ST.1-3; may run at any point): six families / two pages
  self-hosted, preconnects removed, tripwire green — or the bounded
  fallback remedy + the §6 conditional row.
- **ST.4 — close:** dual-pack Tier L, fresh ratchets, lint both repos,
  mixed-model adversarial review, records, train re-point (TokenData
  #5 + Scanner #14 gain the theme commits — same branches), task #9.

Per-stage two-axis reviews per the stage frame; the design red-team
ran BEFORE ST.1 (§4a).

## 6. Residue / ledger

- L11 RETIRES at ST.F (tripwire:
  `grep -RE 'fonts\.(googleapis|gstatic)' backend/public config-tool`
  must be zero).
- PRE-NAMED conditional-watch row (§4a OBJ-4; ACTIVATES only if ST.F's
  fallback remedy fires): debt = the two pages render fallback stacks
  instead of the intended families at the venue; trigger = woff2
  self-host lands; tripwire = `@font-face` rules present under each
  app's public tree; class = conditional-watch.
- NEW candidate row (recorded at close): the theme-editor-era color
  strays — the scoreboard's non-accent hardcoded literals (`#dc3545`
  :342, `#666` :404, `#000` :596) AND the scanner's non-mode-keyed
  `#f59e0b`/`#3b82f6` literal sites (admin.css :762, :846, :888,
  :966, :988) — retire when the B-pages theme editor widens the
  palette.
- The T-5 authoring constraint (mode colors harmonize with the baked
  status palette) retires when theme depth widens the palette (same
  trigger).
- The B9/report surface, `mode-<slug>` CSS headroom, and font-family
  theming carry their existing homes (untouched).

## 7. Estimate

3–4.5 work sessions (re-priced at the red-team fold per §4a OBJ-5 and
the slice-7 lesson): ST.1 ≈ 0.75–1, ST.2 ≈ 1–1.5 (the case table +
fast-path + escape pins grew it), ST.3 ≈ 0.5–0.75, ST.F ≈ 0.5 (fonts
fetch uncertainty bounded by the fallback remedy), ST.4 ≈ 0.5–0.75.
r1's "no lockstep dance" line is WITHDRAWN — the TokenData→backend→
scanner→packs ordering IS the established lockstep, just a smaller one
than slice 7's.

## 8. Execution record

(Filled as stages close.)

- 2026-09-03: unit OPENED (branch + draft PR #31 at open); census
  workflow `wf_242fab04-73f` (5 readers + 2 independent recount legs,
  0 errors; the one count discrepancy — variables.css color-prop
  scalar — adjudicated by direct read as a counting-rule artifact;
  §13.5's "three GM-scanner sites" CONFIRMED from code). Census caught
  two real defects folded into the design: the admin.css mode-keyed
  color literals (D-T.3, reframed at §4a T-2) and the config-tool
  extension of L11 (D-T.6). Design r1 drafted.
- 2026-09-03: pre-build design red-team `wf_77d60ad6-a89` (2 Opus +
  1 Fable, 16 objections: 6 BLOCKING / 10 ADVISORY, all accepted —
  T-2 and T-5 as amended) — design revised to r2, §4a adjudication
  table. Estimate re-priced 2.5–3.5 → 3–4.5. ST.1 next.
- 2026-09-03: **ST.1 DONE** (red-first: 26 tests written against the
  missing schema + absent gate twin, watched red, then built to
  green). TokenData `c6d2403`: theme.schema.json (headers REQUIRED,
  strict hex, glyph idiom, closed shape) + the game.schema theme
  pointer tightened to const. Backend: `theme.identity` capability,
  `_loadDeclaredTheme` (the strings mirror with the §4a O2 header
  divergence + the OBJ-1 glyph value twin reusing normalizedIcon,
  frozen values = CLEANED glyphs), themeCheck + the requires-lint in
  _gateCheck, the §4a O3 present-but-undeclared sidecar warn (generic
  over strings + theme), activeTheme freeze + getTheme() accessor
  (live-disk pre-activation, the getStrings posture). The ratchet's
  100-floor on packService caught two coverage gaps mid-stage (five
  unexercised refusal arms, then getTheme's pre-activation branch) —
  covered with real refusal rows + the selective-init read test,
  floor untouched. Verified: backend 2704 + ratchet (82 files) +
  lint.
- 2026-09-03: **ST.1 two-axis review FOLDED** (parallel Sonnet agents).
  Standards: 1 hard — the theme requires-lint was inlined in _gateCheck
  against the per-block-validator mold; MOVED into _loadDeclaredTheme
  (one home for the block's declaration problems, gate call stays one
  line). The orphan-loop's redundant 2-tuple simplified to a role list.
  Judgement calls accepted-as-documented: the header-required and
  own-schemaVersion divergences from strings (both §4a-reasoned
  in-comment); the triplicated loader skeleton is the repo's own mold.
  Spec: (1) the §5 "legal theme on both real-pack clones" pin was a
  drafting misplacement — it needs the real theme.json files, which
  land at ST.3; §5 corrected. (2) The glyph schema-pattern/value-twin
  bidi boundary was undocumented and untested: schema-legal bidi-only
  glyphs are twin-refused (the SAFE direction — twins are the runtime
  authority); pinned both ways (bidi-only refusal + cleaned-glyph
  freeze proof) and the precision note added to theme.schema.json and
  D-T.1 (the verbNoun-precedent wording). No scope creep found; the
  orphan warn, refusal twins, and freeze semantics verified clean.
- 2026-09-03: **ST.2 DONE** (red-first at all five seams; 48 new
  tests). Scanner `ae927ab` (branch cut from the slice-7 tip
  `46db231`): core/theme.js (DECLINE mirror, headers required,
  per-leaf validation, packThemeApplied, the D-T.5 glyph-form
  mapping, applyThemeColorsToDom with sink-side hex re-check +
  stale-injection clearing); packLoader theme role + _themePath +
  staged twin + the T-3 fast-path/cache-read requireDeclaredTheme +
  bundled best-effort + _activate theme field; the three rating
  sites through the D-T.3 behavior table (site 1 whole-row hide with
  show/hide-on-every-render + consecutive-scan pin; site 2 field
  omission with N/A kept; site 3 element omission + the '—' unrated
  mark under numeric) with glyph output ESCAPED at both innerHTML
  sinks; the four mode-keyed admin.css rules re-keyed to the mode
  tokens + the tokens-not-literals CSS tripwire; tokenManager
  applies the sidecar, loadTokenDatabase injects colors, the pack
  line carries 'theme: declined'. Packless byte-identity pinned at
  all three sites. Verified: scanner 1652 + ratchet (65 files) +
  lint + build. [Process note: the ST.2 commit initially landed on
  the scanner's slice-7 branch — the theme-unit branch had not been
  cut there; repaired by cutting the branch AT the commit and
  restoring slice-7 to its recorded tip 46db231 before any push, so
  origin never saw the slip.]
- 2026-09-03: **ST.2 REVIEW FOLDED** (two-axis, parallel agents;
  scanner `9a0c5b6`). STANDARDS — hard: site 1's show/hide used
  `el.hidden`, breaking the codebase-wide `style.display` idiom
  (used in the same function at summaryContainer and by every
  renderer; zero `.hidden` in src/ before the diff) — switched, five
  themed tests updated to the idiom form. Adjudication note: the
  red-team's OBJ disposition had named `el.hidden` as the mechanism;
  that was a mechanism-level detail the repo idiom overrides — the
  RULING (whole-row hide) is unchanged. Judgement calls: padded-empty
  `?? null` accepted (it IS D-T.5's ruled semantics); headers-required
  divergence documented; applyThemeColorsToDom now mirrors the
  `style?.setProperty` feature-detect precedent; Long-Function /
  CONTROL_AND_BIDI-triplication smells noted, excused by policy.
  SPEC — (1) the glyph escape pin was VACUOUS (empirically green
  without escapeHtml — the DECLINE twin pre-filters markup); replaced
  with a sink-alone pin that mocks theme.js to drive a markup-bearing
  glyph at both innerHTML sinks (lesson: a defense-in-depth pin must
  BYPASS the outer layer or it proves nothing). (2) REAL BUG:
  showDuplicateError wrote #resultValue while the row could still
  carry a prior themed-'none' hide — under ALN's ruled config a
  duplicate rescan showed nothing; fixed red-first (row visibility
  reset before the write). (3) the 'theme: declined' signal was
  pinned only at the renderPackInfo format layer; added the real
  loadTokenDatabase wiring test. Verified post-fold: scanner 1657
  (5 new) + ratchet 65 files + lint 0 errors + build.
- 2026-09-03: **ST.3 DONE + REVIEW FOLDED** (red-first at the contract
  seams; parent `42edba6` build + `65a281d` fold; TokenData `491c513`).
  Build: ALN theme.json = the ruled star-drop only, pinned by ONE
  deep-equal on the whole file (§4a OBJ-3); theme.identity in both
  packs' requires; toy divergent theme (💎 stars, gold/sky mode colors,
  teal scoreboard pair — T-5-harmonized); manifests regenerated; the
  scoreboard's `%%PACK_THEME%%` via jsonForScript function replacement
  (the strings mold, so the breakout/$-substitution pins cover the path
  by construction) + inline applyPackTheme behind the sink-side
  strict-hex re-check; Tier-L pins in flow 23 (loadPackTheme helper,
  dual-pack valid), RUN LIVE on both legs: ALN — value row hidden
  (star-drop end-to-end), palette baked byte-identical; toy — 💎 stars,
  #0e7490/#164e63 accents. REVIEW (two-axis): SPEC caught the sink-pin
  VACUOUS AGAIN (source-text match only — green with the guard
  stripped; the ST.2 lesson generalizes: a guard pin must EXECUTE the
  guard); replaced with an extract-and-drive pin (page span + recording
  document stub + hostile-value rows), proven 4-red with the guard
  stripped. SPEC partial: the every-declared-leaf doctrine lacked a
  mode-color Tier-L pin — flow 23 now reads the scanner root's mode
  tokens (toy gold/sky vs ALN baked, both legs re-run). STANDARDS
  judgement calls folded: t→theme rename, the at-load timing constraint
  stated, _fetchPackSidecar extraction (strings/theme loaders
  delegate); the inline rating-pin placement accepted (it needs the
  detective test's scanner bring-up). Verified post-fold: backend 2723
  + ratchet 82 files + lint 0; config-tool 114.
