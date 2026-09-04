# Phase 3 — Design-workspace pages (+ E10 hot-apply)

**Status: OWNER RATIFIED 2026-09-04 ("ratify all") — §9 is the
NORMATIVE record.** Build OPEN, sequenced AFTER C2+C3's CS.1 (the
mechanics-editor badges and the preview profile consume the resolve
core). Design history: census (§2, one correction §2.1a) → r1 →
red-team (§6, 21 findings) → r2 (§7) → batch (§8, answered) → §9.
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
today.

**§2.1a census CORRECTION (red-team B1):** r1's "the GM scanner side
is ALREADY hot" was FALSE — `packLoader.loadPack()` runs at APP START
only (its own header says a mid-session publish is not picked up
until reload). A connected scanner keeps the old pack until it
reloads, and its handshake packHash goes stale. E10's design carries
a THIRD named step for clients (§7 D-P2r2). Also missed in r1: the
cue ENGINE holds a boot-time COPY of the cues
(`cueEngineService.loadCues(getCues())` at app.js boot and
systemReset only) — re-activation alone leaves the old cues firing.

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

## 5. Owner questions — r1 draft (SUPERSEDED by §8; kept for the record)

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

## 6. Design red-team record + adjudications (2026-09-04)

Two Opus legs over r1 (architecture/state; scope/rulings/UX).
21 findings; every survivor adjudicated below (r2 carries the folds).

| # | Leg·Sev | Finding | Adjudication |
|---|---------|---------|--------------|
| A-F1 | arch·BLOCKING | E10's two steps never reload cues into the ENGINE (boot-time copy; only app.js boot + systemReset call loadCues) — the show designer's own output is what hot-apply would silently drop | FOLD: E10 step 3 = the systemReset re-init recipe reused (cue engine reload + re-activate), every boot-copy consumer named (§7 D-P2r2) |
| A-F2 + S-B1 | both·BLOCKING/MAJOR | "then a sync:full push" is not a client contract — packLoader loads at app start ONLY (r1's census overclaimed "already hot", corrected §2.1a); scanners keep old scoring/strings and their handshake packHash goes stale; the setup session's pack stamp mismatches | FOLD: E10 step 4 = the `pack:applied` client directive (contract-first: asyncapi) — GM scanners reload their pack (SW-update pattern), kiosk pages reload; the setup session's stamp is re-stamped; reconciled with 8.5 (§7) |
| A-F3 | arch·BLOCKING | The preview orchestrator is NOT isolated by PORT+PACK_PATH: ProcessMonitor's singleton PID files (/tmp/aln-pm-*) mean the preview KILLS the live orchestrator's helpers; it shares dataDir (writes into live persistence) and secrets (mints tokens the live server accepts) | FOLD: the RUNTIME NAMESPACE seam is designed INTO the unit (§7 D-P3r2): env-prefixed PID/socket/db/data paths, preview posture (loopback, hardware services disabled, its own secret), tool-owned lifecycle + orphan reaping. Priced in the estimate |
| A-F4 | arch·MAJOR | Per-block PUTs pass per-block validation while orphaning cross-refs already in the draft (groups↔SF_Group, lightingRoles↔cue roles) — surfacing only at publish | FOLD: every block writer runs the DRAFT-WIDE referential checks and refuses on new orphans, message naming them; the validate route feeds a standing draft-problems panel (§7) |
| A-F5 | arch·MAJOR | tokens.json cannot "join the whitelist read-only" — one constant gates BOTH read and write | FOLD: split READ/WRITE whitelists; tokens.json read-only (§7 D-P5r2) |
| A-F6 | arch·MAJOR | commit&push has no credential story and no parent-pointer story — a pushed submodule commit the parent never references is the exact invisible-state failure the button claims to kill | FOLD: the tool shells git with the USER'S ambient credentials (the sync.py posture — it runs on the owner's box); the button does submodule commit+push ONLY, then RENDERS the exact parent-bump commands (parent bumps stay owner-driven per the merge train); refuses on detached/unexpected branch or mid-publish (§7 D-P1r2) |
| A-F7 | arch·MINOR | validate route spawns the 60s gate unserialised | FOLD: validate shares the publish mutex (refuse-while-busy, same PublishRefused wire semantics) |
| S-B2 | scope·BLOCKING | No estimate anywhere (program §12.3 + the B0 Q10 precedent make an owner-signed figure mandatory; the program priced 3–5 before E10 + the preview seam joined) | FOLD: per-stage estimate in §7; the sign-off joins Q4 |
| S-M3 | scope·MAJOR | Deferring multi-pack re-punts what B0 §8 adjudicated INTO this unit; the tool must open toy-heist or the pages get no dual-pack exercise | FOLD: pack SELECTION among configured on-disk pack roots is IN (default roots: the submodule + the fixture packs); full import/create stays deferred (§7 D-P1r2) |
| S-M4 | scope·MAJOR | No editor owns scoring.display/semantics, requires, id, title — the build-a-game walk stops | FOLD: display+semantics join the scoring tab; id/title/requires = the mechanics "Meta" tab (requires edited against the served engine-capability list) (§7 D-P2r2) |
| S-M5 | scope·MAJOR | P5's "problems re-rendered per-token" is unbuildable over newline-split strings; the deferral row's "same consumers as diff" was false | FOLD: the per-token gate-problems claim is DROPPED from P5 (media-presence stays, computed tool-side); the structured-problems deferral row stands with corrected consumers |
| S-M6 | scope·MAJOR | L12 over-claimed: a "loud row" retires nothing — L12 needs every channel bound AND the engine fallback flipped to hard refusal | FOLD: the pages deliver the visibility row only; the hard-refusal flip is NAMED C4 (venue-side) work — the C4 queue item text gains it (§7) |
| S-M7 | scope·MAJOR | Theme previews miss the theme's actual consumers (the three GM-scanner star sites) | FOLD: replica panes for scoreboard AND the scanner star sites; the real-device preview covers BOTH surfaces because the preview orchestrator serves /gm-scanner and /scoreboard itself (§7 D-P3r2) |
| S-M8 | scope·MAJOR | Q2 hides the playtest-loop cost of refusing hot-apply during ACTIVE | FOLD: Q2 rewritten with the cost stated and the recorded-rules-change alternative offered (§8) |
| S-M9 | scope·MAJOR | §14.3 requires wireframes IN VIEW for the surfaces-home decision; r1 asked without them | FOLD: both wireframes attached (§8 Q1) |
| S-M10/11 | scope·MINOR | Deferral rows must each be named with a slot; "ruled luxury" overstated a PRIOR | FOLD: four rows, each named + slotted (§7); wording fixed |
| S-M12 | scope·MINOR | The pack manager should show THREE identities (live tree / draft / running orchestrator) — the staleness surface and E10's precondition | FOLD (§7 D-P1r2) |
| S-M13 | scope·MINOR | Draft-edited lightingRoles invisible to the cue editor's role picker (reads live) | FOLD: pickers consume the draft-aware effective config (§7 D-P4r2) |
| S-M14 | scope·MINOR | Q5 answerable from L14; Q4 should list plainly what a designer cannot do until later phases | FOLD: Q5 → record note; Q4 rewritten (§8) |

Refuted by the legs themselves (not filed): activatePack re-entry
safety (gate throws before assignment); gameClock self-heal;
transactionService.init re-entrancy; publish-log GET leak; "teams
block" coverage; token-write need; E10 stage placement; the
vocabulary pinning (landed in B0).

## 7. Design r2 — superseding decisions + stage plan + estimate

**D-P1r2 (pack manager).** As r1 PLUS: THREE identities (live tree /
draft / RUNNING orchestrator's activated hash — the staleness surface
and E10's precondition); pack SELECTION among configured on-disk pack
roots (default: the ALN-TokenData submodule + the E2E fixture packs;
selection re-points the DraftStore source + pack paths at runtime —
the D-4.7c posture becomes "one pack AT A TIME", never PACK_PATH);
commit&push per A-F6 (user's ambient git creds, submodule-only, then
renders the parent-bump instructions, refuses on detached branch or
mid-publish); validate shares the publish mutex. Import/create stays
deferred.

**D-P2r2 (mechanics + E10).** As r1 PLUS: the scoring tab owns
`scoring.display` + `scoring.semantics`; a "Meta" tab owns
`id`/`title`/`requires` (edited against the served capability list);
every block writer runs DRAFT-WIDE referential checks (refuse on new
orphans, named) and the draft carries a standing problems panel.
**E10 = FOUR named steps**: (1) `activatePack()` re-entry; (2) token
re-bake (`tokenService.loadTokens()` + persistence save +
`transactionService.init`); (3) engine re-init per the systemReset
recipe — `cueEngineService.loadCues(getCues())` (+ re-activate),
naming every boot-copy consumer; (4) the `pack:applied` client
directive (contract-first asyncapi addition): GM scanners re-run
their pack load (the SW-update reload pattern), kiosk pages reload,
the setup session's pack stamp re-stamped — recorded as an 8.5
touchpoint so the warn→enforce decision inherits it. Guard: §8 Q2.

**D-P3r2 (strings+theme + preview).** As r1 PLUS: replica panes for
the scoreboard AND the three GM-scanner star sites; the real-device
preview reaches BOTH surfaces (the preview orchestrator serves
/gm-scanner and /scoreboard itself). The preview REQUIRES the
runtime-namespace seam (A-F3), designed here: an `ALN_RUNTIME_PREFIX`
(or equivalent) env seam namespacing every /tmp/aln-* PID/socket/
conf/db path AND the persistence dataDir; preview posture = loopback
bind, video/music/bluetooth/audio/lighting services disabled, its own
JWT secret, no discovery broadcast; the tool owns the child lifecycle
(kill on stop/idle/tool-exit; stale-preview sweep at spawn). The
preview handshake-mismatch EXEMPTION stands recorded.

**D-P4r2 (show designer).** As r1 PLUS: role/asset pickers consume
the DRAFT-AWARE effective config (S-M13).

**D-P5r2 (content view).** As r1 MINUS the per-token gate-problems
claim (S-M5); READ whitelist split from WRITE (tokens.json read-only
by construction).

**Deferral rows (each named, each slotted — replaces r1 §4's list):**
1. "Pack diff & draft merge tooling" — Phase 4 (first multi-author
   window) — diffing (the §14.1 prior's luxury), merge/rebase, and
   STRUCTURED gate problems (its real consumer).
2. "Pack onboarding: import/create" — Phase 5 (designer onboarding).
3. "Cue preview/simulation" — Phase 4 E5 (rides the renderer).
4. "Scanner real-device theme preview beyond the preview
   orchestrator" — none needed: covered by D-P3r2; row exists only if
   the owner wants device-lab tooling — otherwise struck at sign-off.

**Stage plan r2:** PS.1 pack manager (identity ×3, selection, version
trail, validate, media/needs incl. the L8 checkpoint surface,
commit&push) → PS.2 mechanics + E10 (per-block writers +
cross-checks, Meta tab, the four-step hot-apply + `pack:applied`
contract) → PS.3 strings+theme (+ the runtime-namespace seam + the
preview) → PS.4 show designer uplift (true-duration timeline,
draft-aware pickers) → PS.5 content view → PS.6 unit close
(dual-pack Tier L exercised THROUGH the pages via pack selection,
panel, records). Each stage under the standard frame.

**Estimate r2 (honest, per §12.3 + the B0 Q10 precedent):**
PS.1 ≈ 1–1.25; PS.2 ≈ 1.5–2 (E10's four steps + cross-checks are the
risk); PS.3 ≈ 1.25–1.75 (the namespace seam is real backend work);
PS.4 ≈ 0.5–0.75; PS.5 ≈ 0.5; PS.6 ≈ 0.5–0.75. **Total ≈ 5.25–7
sessions — ABOVE the program's 3–5 for B pages**, driven by E10
joining the gate (§14.2), the preview isolation the red-team proved
necessary, and multi-pack selection re-entering (S-M3). Carried to
the owner (Q4), not squeezed.

**L12 split (S-M6):** the pages deliver binding VISIBILITY; the
`_resolveIdleLoopFile` fallback→hard-refusal flip is C4 venue-side
work — the C4 queue item gains it by name.

**NFC tools (r1 Q5 → record note):** NOT subsumed — they are game-day
tools, not Design workspace; L14's font sweep stays "when next
touched" per its own text. No owner question needed.

## 8. Owner questions (grill batch r2 — build gate holds on Q1 + Q4)

**Q1 — Where does the `surfaces` block live?** It is one small block:
`idleLoop: "<channel-name>"` plus `scoreboard: {enabled,
evidenceCycleMs}`. Two homes, wireframes below (§14.3):

(a) **Pack manager → Media & needs panel** (recommended): the
idle-loop line sits WITH its binding/needs row, so "this channel has
no venue binding" and "change the channel" are one surface.

```
┌─ Pack: About Last Night ─ Media & needs ─────────────────┐
│ Idle loop channel   [aln-idle        ▼]  ✓ bound: HDMI-1 │
│ Scoreboard surface  [x] enabled   cycle [18000] ms       │
│ ──────────────────────────────────────────────────────── │
│ VIDEO REFS   jaw001.mp4 ✓   kaa001.mp4 ✓   miss.mp4 ✗    │
│ SOUND REFS   alarm.wav ✓                                 │
│ ⚠ channel "aln-idle-b" named by cue END has NO binding   │
└──────────────────────────────────────────────────────────┘
```

(b) **Mechanics editor → its own tab**: surfaces is a game.json block
like the others — one page owns the whole file.

```
┌─ Mechanics ─ [Scoring][Modes][Groups][Clock][Surfaces]…──┐
│ Surfaces                                                 │
│ Idle loop channel   [aln-idle        ▼]                  │
│ Scoreboard          [x] enabled   cycle [18000] ms       │
│ (binding status shown read-only; edit bindings on the    │
│  Pack page's Media panel)                                │
└──────────────────────────────────────────────────────────┘
```

My recommendation: **(a)** — the decisions a designer makes about
surfaces are media/binding decisions, and splitting "pick the
channel" from "is it bound" across pages serves nobody. (b) is purer
file-ownership but makes the Media panel read-only about the very
thing it warns on.

**Q2 — When may hot-apply run?** My r1 proposal — refuse while a
session is ACTIVE or PAUSED — protects score accountability, but be
aware of the COST: your playtest loop becomes end-session → apply →
new session each iteration, and E10 exists to speed exactly that
loop. Options: (a) refuse during active/paused (safe, slower
playtests — my recommendation); (b) allow anytime, with a
rules-changed marker recorded into the session (the post-game
validator would then read score history across the boundary honestly).
Pick (a) or (b), or name a third rule.

**Q3 — the L8 checkpoint** (due at the Media panel): the ALN pack's
ENDGAME cue still routes audio with the literal `target:"bluetooth"`.
Retire it (replace with an audio ROLE the venue profile binds — the
8.2 re-authoring, my recommendation: it is the last venue-hardware
literal in pack content) or re-ratify the literal as acceptable?

**Q4 — the §14.1 sign-off.** Approve: (i) the §7 build list; (ii) the
deferral rows 1–3 (row 4 struck unless you want it); (iii) the honest
estimate ≈ 5.25–7 sessions, above the program's 3–5 — the growth is
E10-in-the-gate, the preview isolation, and multi-pack selection.
What a designer CANNOT do until later phases under this split, in
plain terms: see a side-by-side diff of two pack versions; merge two
divergent drafts; create a brand-new pack from nothing in the tool
(they copy an existing pack on disk instead); simulate a cue timeline
without running the preview orchestrator. Everything else in the
five-page story is IN.

## 9. Owner ratification (2026-09-04 — "ratify all")

The consolidated sitting (this batch + the C2+C3 batch + the
architecture) closed with "ratify all". Governing frame: "one truth,
three loops" (CONTEXT.md §2). Rulings for this unit:

- **Q1 → mechanics editor owns game.json entire**, including the
  surfaces block, with LIVE VERDICT BADGES on every venue-resolvable
  field (idle-loop channel, roles, media refs) — computed by running
  the C2 pure resolve() against the DRAFT + the loaded profile, and
  labeled paper/live + profile identity per CONTEXT.md. The pack
  manager's Media panel stays read-only inventory. (Supersedes §8
  Q1's a/b framing — the badge dissolves the choice.)
- **Q2 → (a) ratified**: hot-apply REFUSES while a session is active
  or paused. A per-session "playtest" opt-in flag is a recorded
  later addition, not built now.
- **Q3 → RETIRE the ENDGAME `target:"bluetooth"` literal** (ledger
  L8): re-authored as an audio role; the ALN profile binds it; lands
  during this build; reaches production only via the merge train.
- **Q4 → build list APPROVED with one change: minimal
  CREATE-NEW-PACK is IN** ("New pack" = name → skeleton copy →
  opens as a draft; the editors are the authoring path). Deferred
  with anchors to the ROADMAP registry: pack diff + draft merge →
  the multi-author milestone; cue-timeline simulation without the
  preview orchestrator → rehearsal tooling (Track D). Row 4 struck.
- **Additions from the sitting**: the preview orchestrator ships
  with a PREVIEW PROFILE (hardware-shaped needs resolve dormant on a
  laptop — no red wall); E10's client re-load composes with the
  C2-ratified scanner SELF-HEAL (each orchestrator authoritative for
  its own stations — no preview exemption machinery).

**Sequencing (re-ratified)**: the pages build runs AFTER C2+C3's CS.1
(the badges and the preview profile consume the resolve core and the
profile plurality it lands). PS.1–PS.6 order otherwise stands.
**Estimate ≈ 6–7.5 sessions** (badges + create-new-pack + preview
profile priced in), under the ratified price principle.
