# Phase 3 — Design-workspace pages (+ E10 hot-apply)

**Status:** census recorded; design r1 DRAFTED; red-team next; owner
batch (§5) OPEN — build does not start before the §14.1 split
sign-off.
**Unit:** the five Design-workspace pages (program Track B; §14
rulings 2026-09-03) + E10 hot-apply, on the B0 store/auth/harness
foundation. Branch: continues `claude/phase3-b0` chain (a new
`claude/phase3-pages` branch at open-of-build).

## 1. Scope and inputs

The five pages: **pack manager**, **mechanics editor**,
**strings+theme editor**, **show designer**, **content view** — each
with a per-page build/deferred split the OWNER approves before build
(§14.1), every deferral getting a NAMED ROADMAP §8 row. E10
hot-apply is INSIDE the Phase-3 gate and forms ONE deliverable with
the mechanics editor's draft→publish→hot-apply path (§14.2 /
ROADMAP 8.6). Inputs: program Track B page definitions; the
2026-06-11 config-tool pre-read; the B0 design doc §3-§10 (store,
auth, harness, pages-era carry-forwards); ROADMAP §8 rows 8.1-8.3,
8.5, 8.6, 8.16; CONTEXT.md vocabulary (Design workspace pages,
resolver presentation, idle loop vs game-event video, draft/publish,
observe token).

## 2. Census record (2026-09-04 — two legs: surface + constraints)

### 2.1 Existing surface (leg A; B0-substrate claims verified against
the B0 build itself, block inventory ×2-verified on both packs)

Shared substrate (B0, all landed): draft CRUD + draft-scoped
scoring/cues writers + strings/theme file PUTs + publish
(`config-tool/lib/routes.js`), the DraftStore + publish pipeline +
packFs (`lib/draftStore.js`, `lib/publish.js`), login/HTTPS/all-routes
gate (`lib/toolAuth.js`, `server.js`), the shared client store + draft
bar + served vocabulary (`public/js/store.js`,
`utils/vocabulary.js`), jsdom + Playwright harness.

Per page — what exists / what's missing:

1. **Pack manager**: only the toolbar `draftBar` exists. MISSING:
   pack identity/list surface, publish-log READ (the JSONL is
   append-only with no GET route), validate surface (the runner has
   no tool route), export/import/create, commit&push, media-reference
   validation. The tool binds ONE sourceDir (D-4.7c).
2. **Mechanics editor**: `sections/economy.js` edits ONLY
   `scoring.baseValues` + `typeMultipliers` (draft-routed, merge-safe).
   MISSING: editors + a draft game.json writer for every other block —
   `modes`, `groups`, `groupRules`, `duplicatePolicy`, `entities`,
   `functions`, `gameClock` (incl. `phases`), `lightingRoles` +
   `lightingRoleFallbacks`, `scoring.display/semantics` (and
   `surfaces` — home OPEN, §5 Q1). `DRAFT_FILE_WHITELIST` is
   strings/theme only — game.json edits go through validated writers,
   which exist only for scoring and cues.
3. **Strings+theme editor**: server side complete (first-writer file
   PUTs, manifest-paired); ZERO UI; `readPackContent()` doesn't return
   strings/theme yet.
4. **Show designer**: the richest proto — `showcontrol.js` +
   `cueEditor`/`commandForm`/`conditionBuilder`/`timelineView`/
   `assetManager`, draft-routed and vocabulary-re-sourced since BS.3.
   MISSING: TRUE-duration timeline (ruled IN), preview/simulation.
5. **Content view**: `tokenBrowser.js` read-only inside economy;
   `GET /api/tokens` reads the LIVE pack only — no draft-scoped token
   read route; no summary/owner columns, no media presence.

Pack block inventory (×2-verified identical on ALN + toy): `kind,
schemaVersion, requires, id, title, modes, scoring, groupRules,
groups, duplicatePolicy, entities, functions, gameClock{duration,
overtimeAt, phases[]}, strings, cues, lightingRoles,
lightingRoleFallbacks, surfaces{idleLoop: <channel>, scoreboard:
{enabled, evidenceCycleMs}}, theme` — plus the sibling files
tokens.json / strings.json / theme.json / cues.json.

**E10 adjacency (verified):** the freeze point is
`packService.activatePack()` (called once at boot; drift warn says
"restart the orchestrator"); the A4-corrected SECOND step is the token
re-bake — `tokenService.loadTokens()` bakes value/group-multiplier/
tokenNoun from the frozen rules, then `persistenceService.saveTokens()`
+ `transactionService.init(tokens)`. No runtime path re-runs either
today. The GM scanner side is ALREADY hot (runtime packLoader).

### 2.2 Constraint census (leg B — 19 bindings, 4 named owner
questions; sources cited in the leg record, spot-checked)

The load-bearing ones: §14.1 (five pages IN, owner-signed split,
named §8 rows, diffing-is-the-luxury, real-device scoreboard preview
+ true-duration timeline IN); §14.2/8.6 (E10 one-deliverable);
§14.3 (surfaces home = named question, wireframes in view); Track B
page definitions (incl. pack manager's create/open/validate/diff/
export + commit&push; F-TOOL-09/32 vocabulary pinning); 8.1 (media
REFERENCE validation here, file carriage Phase 5); 8.2/L8 (ENDGAME
bluetooth literal: retire-or-re-ratify checkpoint AT the media page);
8.3/L12 (idle-loop channel bindings → hard refusal); 8.16 (no
scan→video vocabulary invention — standing-cue interim); B0 §6/§3
(merge/diff = pack-manager features; commit&push = pack-manager;
publish log is the version trail); B0 §7 (string-lossy problems —
pages-era refinement; execFile/argv only); D-4.7c (no PACK_PATH in
the tool; multi-pack editing = pack-manager design question); D-B0.2
(model-module discipline REQUIRED — five pages, not five snowflakes);
A4 (E10 = re-activation + re-bake, two named steps); PHASE3-STATUS
~186 (real-device preview via a PACK_PATH second-orchestrator; the
preview handshake-mismatch EXEMPTION must be recorded and survive
8.5); pre-read §5 (keep timelineView/cueEditor/tokenBrowser as bases;
no-build vanilla JS unless preview panes force otherwise); L14 (NFC
tools' font sweep IF this unit subsumes them); CONTEXT.md vocabulary.

## 3. Design r1 (2026-09-04)

### D-P1 — pack manager: the store's face

One page, four panels, all reading B0 primitives:

- **Identity & status**: pack id/title/version/contentHash (live +
  draft when one exists), the draft bar's functions absorbed here
  (the toolbar bar stays as the cross-page summary).
- **Version trail**: a `GET /api/drafts/publish-log` route (read the
  JSONL, newest first) rendered as the publish history — when, which
  draft, base → published hash. This is the trail the (deferred)
  diff feature later reads.
- **Validate**: a `POST /api/drafts/:id/validate` route running the
  SAME gate runner (execFile/argv — the §7 pin) WITHOUT landing;
  problems rendered as the engine's own text lines (string-lossy is
  accepted — a list renders strings fine; structured problem objects
  stay DEFERRED with a named row, see §4).
- **Media & needs** ("what this pack needs", 8.1): reference
  validation — every `video:queue:add` videoFile, `sound:play` file,
  idle-loop channel, and playlist the pack names, checked against the
  live asset dirs + profile bindings; missing = loud rows. The
  L8 ENDGAME-bluetooth checkpoint surfaces HERE (§5 Q3). The L12
  idle-loop binding hard-refusal ruling is IMPLEMENTED at this
  surface's "unbound channel" row.
- **Commit & push pack**: one button, server-side `git add/commit/push`
  of the pack submodule with a message naming the published
  contentHash (kills F-TOOL-22's invisible-submodule-state). Shown
  only when the submodule is dirty-or-ahead; refuses mid-publish.
- Export = "download the pack as a zip" (references only, no media —
  §2.3). Import/create-pack: DEFER (named row — creating a pack from
  scratch is the Phase-5 designer-onboarding story; every present
  need edits an existing pack).
- Multi-pack: the tool keeps editing ONE pack (D-4.7c posture); the
  pack manager SHOWS which one. Multi-pack switching: DEFER to the
  same named row as import/create.

### D-P2 — mechanics editor + E10 (ONE deliverable)

- Absorb economy.js as the scoring tab; add tabs for `modes`
  (labels/claimedLabel/icon/scoringPolicy/displayBehavior),
  `groups` (+groupRules), `duplicatePolicy`, `entities`, `gameClock`
  (duration/overtimeAt/phases), `lightingRoles`(+fallbacks).
  `functions` renders READ-ONLY v1 (the E4 grant model owns its
  future; schema locks the floor anyway).
- Server: a validated draft game.json writer per block —
  `PUT /api/drafts/:id/game/:block` with per-block validation the
  same shape as writeScoring (merge-preserving, manifest-paired,
  gate-parity checks where the activation gate has an opinion).
  Model-module discipline: one pure model per block, thin DOM.
- **E10 hot-apply**: `POST /api/admin/pack/hot-apply` (backend,
  requireFunction('session-lifecycle')) running the TWO NAMED STEPS —
  `activatePack()` re-entry + the token re-bake
  (`tokenService.loadTokens()` + `transactionService.init` +
  persistence save) — then a `sync:full` push to all clients. GUARD:
  refused while a session is ACTIVE or PAUSED (scores computed under
  changed rules mid-game are unaccountable); allowed in
  setup/ended/no-session. The tool's publish flow gains an "Apply to
  orchestrator now" affordance when the orchestrator is reachable and
  the session state permits; otherwise the existing "applies at next
  boot" wording stands. (§5 Q2 puts the guard to the owner.)

### D-P3 — strings+theme editor

- Two tabs on one page (one file each, first-writers already exist).
  Strings: grouped key editor with the baked-fallback value shown
  ghosted per key. Theme: the `rating` block (glyph/color) with an
  in-browser scoreboard-replica preview pane (the scoreboard's CSS
  variables re-applied to a miniature — replica previews per Track B).
- **Real-device preview** (ruled IN): a second orchestrator process on
  the DRAFT dir via the PACK_PATH seam — `POST /api/preview/start`
  (tool-side) spawns `PORT=3001 PACK_PATH=<draftDir> node server.js`
  bounded-lifetime (auto-kill on idle/stop), and the page shows the
  preview scoreboard URL/QR. The tool still never EDITS via
  PACK_PATH — the seam carries the preview only (D-4.7c intact). The
  preview EXEMPTION for the handshake packHash mismatch-warn is
  RECORDED here and must survive 8.5's C2 decision: a preview
  orchestrator legitimately serves a non-live pack.

### D-P4 — show designer

- Uplift, not rebuild (pre-read §5): showcontrol + cueEditor +
  commandForm + conditionBuilder keep their BS.3 vocabulary-driven
  form. NEW: **true-duration timeline** — timelineView reads real
  video durations (the assets listing already carries ffprobe
  `duration`) so the three-segment E5 model renders at true scale;
  clock-relative segments at true clock scale.
- No scan→video vocabulary (8.16): the standing-cue interim is what
  the editor authors; a small helper affordance ("make a standing cue
  for this token→video pairing") is IN only as sugar over the legal
  vocabulary — it invents no new declaration.
- Cue preview/simulation: DEFER (named row — the real-device preview
  in P3 plus validate-on-save covers the pre-show confidence need).

### D-P5 — content view

- A Design-workspace page wrapping tokenBrowser with: draft-scoped
  token read (`GET /api/drafts/:id/files/tokens.json` joins the
  whitelist READ-only — tokens stay Notion-synced, no token WRITER),
  summary/owner columns, media-presence indicators (image/audio/video
  refs resolved against the asset dirs), and the pack-level
  validation summary (the P1 validate surface re-rendered per-token
  where problems name tokens). Phase-5 docks here; v1 is read-only.

### D-P6 — page set, shell, order

Design workspace nav: Pack (P1) / Mechanics (P2) / Strings & Theme
(P3) / Show (P4) / Content (P5). Build order by value ÷ effort, each
page a stage under the standard frame (red-first at seams, two-axis
review): **PS.1 pack manager** (the store's face unlocks everything;
smallest server delta) → **PS.2 mechanics + E10** (the one-deliverable
core) → **PS.3 strings+theme (+ real-device preview)** → **PS.4 show
designer uplift** → **PS.5 content view** → **PS.6 unit close**
(dual-pack Tier L, panel, records). Surfaces home lands per §5 Q1
into P1 or P2 at build time.

## 4. Proposed build/deferred split (for §14.1 sign-off — §5 Q4)

IN: everything in §3 not marked DEFER — all five pages' cores, E10
with the session-state guard, real-device scoreboard preview,
true-duration timeline, commit&push, publish-log history, validate
surface, media-reference validation (with L12 hard-refusal rows and
the L8 checkpoint), draft-scoped content view.

DEFERRED (each gets a NAMED ROADMAP §8 row at sign-off):
- **Pack-version diffing** (the ruled luxury) + merge/rebase draft
  conveniences (the Q11(a) follow-on) — one row: "pack diff & draft
  merge tooling", landing Phase 4/5 alongside real multi-author use.
- **Pack import/create + multi-pack switching** — one row: "pack
  onboarding & multi-pack", landing Phase 5 (designer onboarding).
- **Structured gate problems** (the B0 §7 string-lossy refinement) —
  rides the diff row (same consumers).
- **Cue preview/simulation** — rides E5's Phase-4 renderer work.

## 5. Owner questions (grill batch — build waits on Q1 + Q4)

**Q1 — Where does the `surfaces` block get edited?** It is small:
`idleLoop: "<channel>"` + `scoreboard: {enabled, evidenceCycleMs}`.
(a) **Pack manager's media panel** — idleLoop is a media-channel
binding (8.1/8.3 territory: the unbound-channel hard-refusal row
lives there), and scoreboard on/off is a pack-capability fact;
evidenceCycleMs rides along. (b) Mechanics editor — it's a game.json
block like the others, one home for the file. My recommendation:
**(a)** — the media/bindings adjacency does the real work; P3's
preview still SHOWS the result. Wireframe sketches for both will be
in the red-teamed r2 per §14.3.

**Q2 — E10 guard**: hot-apply refused while a session is ACTIVE or
PAUSED (allowed in setup/ended/none) — mid-game rule changes make
scores unaccountable. Confirm, or name the looser rule you want.

**Q3 — L8 checkpoint** (due at the media panel): the pack's ENDGAME
cue still carries the literal `target:"bluetooth"` routing. Retire it
(replace with an audio ROLE the profile binds, the 8.2 re-authoring)
or re-ratify the literal? Recommendation: retire — it is the one
venue-hardware literal left in pack content.

**Q4 — The §14.1 sign-off itself**: approve the §4 split (and its
four named deferral rows) as the pages bar? Diffing is the sole
ruled luxury and heads the deferred list, per your prior.

**Q5 (small) — NFC tools**: this unit does NOT subsume
tag-writer/token-checkin (they are game-day tools, not design
workspace). L14's font sweep stays "when next touched". Object if
you want them pulled in.
