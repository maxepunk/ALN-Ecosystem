# Phase 3 · A3 slice 3c — CSS/mode/type taxonomy (styling survives pack-open vocabularies)

Status: **DRAFT** (census VERIFIED 2026-08-21 against the post-3b tree at parent `54e248c` / ALNScanner `04e8b79`; decision-free core may build ahead per the slice-2 precedent)
Program: §3/F9 (3a strings ✅ core / 3b formatting ✅ core / **3c CSS taxonomy**)

## 0. The problem, precisely

Mode and type ids are PACK-OPEN vocabularies (slice 1 / D2b), but styling is keyed to the baked ALN ids. The census (dedicated sweep, all sites verified with current line numbers) found:

- **Live id-keyed CSS**: the mode pill (`components.css:300-310`), the type badge closed set (`admin.css:834-839` — 5 ALN types + `type-unknown`), the activity status/timeline mode borders (`admin.css:869-876`, `:952-953`), and scoreboard's `body.mode-detective` ticker-hide (`scoreboard.html:631-639`).
- **Unknown-id behavior today**: the toy pack's `fence`/`tipoff`/`appraise` render an UNSTYLED pill (no background/color/glow), missing status/timeline borders, and an always-ALN-orange team-detail accent. Functional but broken-looking — and **no test can see it** (every E2E selector is structural; the degradation is visual-only).
- **LATENT, not active, type break (census correction)**: toy-heist declares the SAME five type ids as ALN (different multipliers only) — so every `.type-*` class currently matches on both packs and the dual-pack gate cannot exercise type-vocabulary openness at all.
- **Class-attr injection surface**: mode ids are schema-patterned (`^[a-z0-9][a-z0-9-]*$`) which is the ONLY thing keeping the unescaped `${claimEvent?.mode}` interpolations (`GameOpsRenderer.js:487/561`) safe; type keys carry **no pattern**, and `type-${memoryType.toLowerCase()}` emits TWO classes for a type like `"Deep Cover"`.
- **Orphan CSS** (zero emitters, dead weight): `.card-accent.detective/.blackmarket`, the retired binary-toggle `.slider` rules, `.transaction-card.detective/.blackmarket`.
- **Baked-token-as-generic-accent**: `scanner.css:404/444` use `--color-mode-blackmarket` unconditionally on the team-detail card/value.
- **`theme` pointer**: free-filename `*.json`, no description, ZERO consumers (`build-pack-manifest.js`'s role mapper is filename-keyed, never reads the pointer). No pack declares it.
- **Semantic flags already gate all BEHAVIOR** (`modeSemantics` twin seams, both sides): `scoringPolicy`/`surface`/`claims` drive SOLD-vs-EXPOSED, 💰/🔍, scoreboard nav, evidence membership. Styling is the last id-keyed surface.

## 1. Mechanism (ruling R-3c-1, recommended): style by SEMANTICS, not ids

The engine styles what it UNDERSTANDS — the semantic flags — exactly as it already behaves by them:

1. **Semantic mode classes ride alongside the id class.** Every mode-class emitter adds engine-derived classes: `mode-scoring` when `isScoringMode(id)`, `mode-evidence` when `isEvidenceMode(id)` (both may be absent for a mode with neither trait). Emitters: `uiManager.js:231` pill, `GameOpsRenderer.js:487` status, `:561` timeline row, `index.html:71` static seed. The `mode-${id}` class STAYS (pack-specific theming hooks later; also keeps ALN CSS working unchanged during the transition).
2. **The visual-role rules re-key to the semantic classes.** `--color-mode-detective/blackmarket` become `--color-mode-evidence/--color-mode-scoring` (same values — green/orange); `.mode-detective/.mode-blackmarket` pill rules become `.mode-evidence/.mode-scoring`; status/timeline borders likewise. ALN renders BYTE-VISUAL-IDENTICAL (detective≡evidence, blackmarket≡scoring); the toy pack's pills/borders BECOME styled — a visible dual-pack improvement.
3. **Type badges get a sane open-vocabulary floor.** Type ids have NO semantic flags (pure data), so: the base `.token-type` rule gains the `type-unknown` visuals as its default (an unlisted type renders like unknown instead of unstyled); the five ALN `.type-*` overrides stay as baked theming; class emission goes through a `slugifyId()` (lowercase, non-`[a-z0-9-]` → `-`) killing the two-class bug. Pack-DECLARED type colors are theme.json territory — **Q-3c-1, held**.
4. **Scoreboard's `?mode=detective` branch keys off the surface.** The page already computes `evidenceModes` from `displayBehavior.surface`; the branch accepts any mode id in that set (after modes load), with `detective` continuing to work as the pre-modes-loaded baked alias. Body class becomes `mode-evidence` (the CSS re-keys with it).
5. **Hygiene**: delete the three orphan rule sets; rename the `scanner.css:404/444` accent to a neutral token (`--color-accent-value`, same orange value — not a mode color); belt-and-braces `escapeHtml`/slugify the two unescaped mode interpolations (schema-patterned today, but defense in depth is free).
6. **Fixture: the toy pack gets a genuinely divergent type id** (e.g. `Contraband` declared in `typeMultipliers` + one token retyped) so the dual-pack gate exercises type-vocabulary openness for real — the E2E scoring oracles are pack-derived and flow through automatically. The methodology rule ("every pack artifact exercised by a second consumer") currently does NOT hold for type vocabulary.

## 2. Test-coupling ledger

Unit pins moving in lockstep: `initializationSteps.test.js:18/31/34/45` + `uiManager.test.js:233/237/246/248` pin `className` EXACTLY (`'mode-indicator mode-blackmarket'`) — these gain the semantic class in the same commit. No unit test pins any `.type-*` class (none exists to break; new pins land WITH the slugify + fallback). All E2E selectors are structural (survive unchanged); mode assertions already go through pack-derived labels. New pins: semantic-class emission (unit), slugify table, toy-leg type-badge fallback (the divergent type id makes flow-level coverage real), scoreboard surface-keyed branch.

## 3. Sequencing (decision-free core)

1. Scanner: `slugifyId` + semantic-class emission in the three emitters + index.html seed; CSS re-key + type-badge floor + orphan deletion + accent rename; lockstep unit pins. (One commit — CSS and emitters must move together.)
2. Scoreboard page: surface-keyed branch + `mode-evidence` body class + CSS re-key.
3. Toy pack: divergent type id (+ manifest regen); verify dual-pack flows.
4. Close ladder: full suites + ratchets, dual-pack Tier L, adversarial review workflow, STATUS/design close records.

## 4. Owner questions (HELD — do not build)

- **Q-3c-1 — theme.json scope** (overlaps 3a's Q5 scoreboard-theming-depth and 3b's Q-3b-2 star glyphs): should packs declare visual identity (mode colors, type colors, glyphs, fonts) via the `theme` pointer? The pointer exists with zero consumers and no canonical-filename pin (the `strings` lesson says pin it before consuming). Recommend: 3c ships the SEMANTIC layer only; theme.json is designed once, with Q5 + Q-3b-2 folded in, as its own unit after the owner rules on theming depth.

## 5. Execution record (2026-08-21 — decision-free core COMPLETE)

Built same-day in landing order: **scanner lockstep commit** (ALNScanner `a05afc2`: modeClassNames + slugifyId + three emitters + static seed + CSS re-key + orphan deletion + type-badge floor + lockstep/new pins); **scoreboard surface-keyed view + toy divergent type** (parent `fd636bd`: `body.mode-evidence` + two-site branch, toy `Contraband` ×3 with `alibi01` retyped, NEW dual-pack flow-23 pin — a toy `?mode=` was a silent no-op before). Flow 23 verified dual-pack at the step.

**Adversarial review round 1** (workflow: 4 lenses → strict refuters; 13 agents / 0 errors; 9 deduped → **8 confirmed / 1 refuted → 4 distinct defects, all fixed same-day** — ALNScanner `d407f19`, parent pin `fd04970`): (A, MAJOR, three lenses independently + computed-style verified) the bare re-keyed pill rules leaked the pill's glow + white text onto Game Activity status bars and timeline rows, which now carry the same semantic classes — pill visuals SCOPED to `.mode-indicator.mode-*`; (B) a schema-legal mode id `scoring`/`evidence` FORGED the semantic class and `indicator`/`segment` collided with structural classes — reserved slugs suppress the id class, keeping only true semantics; (C, MAJOR test) the timeline claim-row emission was unpinned despite the test header's claim (revert survived the whole suite) — pinned; (D) the type-badge floor had no pin — CSS-source tripwires added (pill scoping, floor, re-keyed activity rules; jsdom cannot compute the cascade).

**Close gate (final heads parent `fd04970` / ALNScanner `d407f19`, exit codes direct):** backend 2411 + fresh ratchet + lint; integration 342; scanner 1525 + ratchet (slugify.js at 100%) + L2 50 ×2; dual-pack Tier L **ALN 113P / 0F / 0-flaky** + **toy 114P / 0F / 0-flaky** (both +1: the surface-keyed view pin); scanner CI runs 88 + 89 green. **Remaining 3c work = Q-3c-1 only (held for owner).**

## 6. Estimate

~1-2 focused sessions for the decision-free core. The scanner commit is the big one (emitters + CSS + pins in lockstep); the scoreboard and fixture steps are small.
