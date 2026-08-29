# Phase 3 · A3 slice 4 — show-control content into the pack (+ ALN installation profile)

**Status: DESIGN — awaiting pre-build red-team, then owner questions, then build.**
Date: 2026-08-29. Branch: `claude/phase3-a3-slice4` (chained from closers tip
`00d39fe`, per the slice-train model). Census: workflow `wf_bb42d8c1-9af`
(5 legs: 4 Sonnet readers + Fable doctrine leg), disputed facts settled by
direct verification (§2.4).

Program scope sentence (§3, RESCOPED): cues become pack content referencing
ROLES (lighting roles per B8; sound/video by pack-relative reference, never
HA entity ids or concrete venue filenames); music/playlist REFERENCES join
them (files stay on the venue/asset channel). Settles audit F7 + the
reference half of F6. Videos-in-pack (F5) stays deferred to the B pages'
media story. The R4 ordering guard ships in the same slice: (a) a backend
role→scene resolver reading the active installation profile, (b) an in-repo
ALN profile whose lighting bindings cover every migrated role, (c) a
concrete-id fallback (loud, ledgered, retires at C4).

---

## 1. Extraction brake (R13) — capability-matrix rows cited

| Row | Matrix classification | This slice | Logged decision |
|---|---|---|---|
| 2.21 Cue definitions (incl. token-ID conditions) | game-content, "Pack `cues.json`" | **MOVED** — cues.json becomes pack content | Sanctioned by the matrix change-note verbatim. |
| 2.18 Cue → scene-ID references | **uncertain (Q9)** — game-content referencing venue entities | **RECLASSIFIED → game-content-referencing-roles, then MOVED** | Explicit reclassification, citing B8: roles are *game events* the pack authors; the venue maps role→instrument in the C1 profile. This is exactly the matrix's own proposed resolution ("Abstract scene *roles* in pack, venue maps role→entity"); logging it here discharges the Q9 uncertainty. |
| 2.8 Music playlists + tracks | game-content, "Move into pack (`playlists.json` + assets)" | **REFERENCE HALF MOVED** — playlist *definitions* (ids, names, track refs, flags per OQ5) become pack `playlists.json`; MP3 *files* stay `backend/public/music/` (program: "files stay on the venue/asset channel") | Partial move logged; the asset half rides the B-pages media story with F5. |
| 2.10 Sound files | game-content, "Pack `assets/audio/`" | **REFERENCE-ONLY this slice** (recommended default, held as OQ3) — cues keep referencing sound files by name; files stay `backend/public/audio/` | The program sentence is ambiguous on whether "files stay" covers sound; §4 OQ3 carries it to the owner. Either answer keeps row 2.10's end-state intact. |
| 2.22 Cue-triggerable event vocabulary | engine-fixed | **NOT moved** — stays engine | Its change-note ("document as the cue-authoring contract in game-pack schema") is DISCHARGED by S1: `cues.schema.json` + the S2 gate's action/trigger-vocabulary check become that contract. |
| 2.24 Command gating + resource validation | engine-fixed | **NOT moved** — `validateCommand` gains a role-resolution line (engine work on an engine row) | No classification change. |
| 2.17 Lighting scenes (HA, runtime fetch) | venue-config | **NOT moved** | Scenes stay venue; only *references* to them leave the venue files. |
| 2.14 Ducking rules | uncertain (Q8), matrix note "likely game-pack with venue override" | **NOT moved** — stays venue | **Matrix-note correction logged:** B7 (ratified with C1, 2026-08-22) ruled routes AND ducking are venue config (profile-resident eventually, `routing.json` today). The matrix's "likely game-pack" note is stale; row 2.14 resolves venue-config. No code motion this slice. |

No `engine-fixed` row is moved. Brake satisfied.

## 2. Census facts (verified)

### 2.1 Migration inventory — `backend/config/environment/cues.json` (ground truth, re-verified 2026-08-29 on this branch)

- **10 cues**: 5 named/designed (`attention-before-video`, `restore-after-video`,
  `tension-hit`, `e2e-compound-test`, `e2e-video-compound`) + 5 timestamp-id
  operator-created (`cue-1772422843217`, `…894866`, `…917681`, `…984913`,
  `…004537` — the 90/60/30/15-minute warnings + ENDGAME; OQ2 triages them).
  3 carry `timeline` (compound); the rest are flat `commands`.
- **22 command instances**: `sound:play` ×9, `lighting:scene:activate` ×11,
  `video:queue:add` ×2, `music:*` ×0.
- **7 distinct scenes**: `scene.game`, `scene.off`, `scene.police_1`,
  `scene.police2`, `scene.police3`, `scene.policeglitch`, `scene.video`
  (note the venue-side naming inconsistency `police_1` vs `police2/3` —
  roles erase it from pack content).
- **7 distinct sounds**: `15min.wav`, `30min.wav`, `60min.wav`, `90min.wav`,
  `attention.wav`, `policesounds.wav`, `tension.wav`.
- **2 video refs**: `policesequencewoverlay.mp4` (real show content),
  `test_2sec.mp4` (E2E fixture — already living in production cues today).
- **1 routing target literal**: `"target": "bluetooth"` on one `sound:play`
  (bypasses sink resolution → raw `pw-play --target`; §3 D6 handles it).
- **2 conditions**: both `{field: tokenId, op: neq, value: 'policesequencewoverlay'}`
  (pack-internal reference — tokenIds are pack content).
- **Structure note for future counters**: timeline entries are FLAT
  `{at, action, payload}` objects, NOT nested under a `command` key.
  Two census legs undercounted by walking the wrong shape.
- **Playlists** (`backend/config/music-playlists.json`): 1 playlist
  (`all-tracks`, bootstrap), with `shuffle`/`loop`/`crossfadeMs` flags and
  concrete venue MP3 filenames as track refs.

### 2.2 Dormant schema headroom (exists TODAY, activated by S1)

- `ALN-TokenData/game.schema.json`: `lightingRoles` (array of
  `^[a-z0-9][a-z0-9-]*$` strings) and a `cues` file pointer
  (`type: string, pattern: \.json$` — **NOT const-pinned**, unlike
  `strings: {const: 'strings.json'}`; S1 const-pins it per the 3a
  role-vs-pointer lesson). `surfaces` object also present (slice 6's, untouched).
- Manifest builder `roleFor('cues.json') → 'cues'` already exists; role enums
  in openapi/pack-manifest.schema already list it. `playlists` role is NEW (S1).
- **Zero** role-resolution or installation-profile code exists anywhere
  (`grep lightingRoles|installationProfile` = 0 hits outside schemas/docs).

### 2.3 Engine load sites and consumers

- Cues load at `backend/src/app.js:239` and `src/services/systemReset.js:228`
  — both hardcode `config/environment/cues.json`; **zero tests pin the path**
  (cutover is test-transparent at the load seam).
- `loadCues` validates structure only (`commands` XOR `timeline`); resource
  existence lives in `commandExecutor.validateCommand` (5 checks; the role
  resolver inserts BEFORE `sceneExists`).
- The GM Scanner NEVER receives cue internals (`getCueSummaries` strips to
  id/label/icon/quickFire/once/triggerType/enabled). E1 persistence is
  reference-free (`{firedClockCues, disabledCues, active}`). MESSAGE_TYPES
  untouched. **The scanner repos are NOT in this slice's train** —
  the lockstep is TokenData → backend/parent only.
- E2E `07d-03` pins cue ids `tension-hit`/`e2e-compound-test`/
  `attention-before-video` — migration preserves ids verbatim.
- config-tool: `PUT /config/cues` → `writeCues` (no manifest rebuild today);
  its scene-picker fetches live HA ids. §3 D7 re-points it.
- Toy pack today: NO cues; `hardware.stack = {}`, `endpoints = {}`. The ALN
  pack-manifest's `hardware.stack` ALREADY claims `cue playlists`/`cue sound
  effects`/`lighting cues` usedBy — claims that become true only with this slice.

### 2.4 Census-leg corrections (settled by direct verification)

- Doctrine leg undercounted scenes (3 vs **7**) and sounds (2 vs **7**);
  contracts leg said 9 cues vs **10**. All doc numbers above are re-verified.
  Consequence: the ALN role vocabulary must cover **seven** scenes, not three
  (OQ1 reworded accordingly).
- Tooling leg's "pack-manifest schemaVersion drift" surprise is **REFUTED** —
  it read the stale standalone checkout at `/home/user/ALN-TokenData`
  (schemaVersion 1). The in-repo submodule manifest and schema both say
  `schemaVersion: 2, const: 2`. No drift exists.

## 3. Design positions (the mechanism — red-team targets)

### D-4.1 — No PACK_SCHEMA_VERSION bump; gate by capability (`requires`)

The doctrine leg leaned "likely bump since consumers change" — **rejected**:
only ONE consumer changes (the backend engine; §2.3 shows scanners never see
cue internals). Instead:

- New keys are ADDITIVE-OPTIONAL in game.schema v2 (they already exist as
  headroom; old engines schema-accept and ignore them).
- Three new append-only capability ids (D1 `area.variant` convention):
  `cues.standing` (event/clock standing cues + manual fire),
  `cues.timeline` (compound three-segment timelines, E5),
  `lighting.roles` (role-indirected lighting commands).
- A cues-bearing pack declares the matching ids in `requires`; the EXISTING
  slice-0 gate (`requires ⊆ ENGINE_CAPABILITIES`) then makes an old engine
  refuse loudly, NAMING the missing capability — a strictly better error
  than "schemaVersion 3 unsupported", with zero touch to the exact-match
  schemaVersion checks in every consumer.
- **Closing the silent-ignore hole (new gate rule, flavor-i):** a pack whose
  game.json declares a `cues` pointer (or `lightingRoles`, or `playlists`)
  WITHOUT declaring the matching capability in `requires` is refused as
  self-contradictory ("declares cues but does not require a cue-driving
  engine"). Without this rule, such a pack would activate on a pre-slice-4
  engine and silently ship no show control.

### D-4.2 — Schema activation (S1)

- `game.json` pointers: `cues: {const: 'cues.json'}` (const-pinned NOW, per
  the 3a lesson: pointers that will ever be role-keyed in the manifest must
  not float), `playlists: {const: 'playlists.json'}`. `lightingRoles` stays
  the ratified array-of-role-name-strings (C1 §1: profile binding keys must
  be ⊆ this list).
- NEW `ALN-TokenData/cues.schema.json`: cue shape = today's engine contract
  (`commands` XOR `timeline`; flat `{at, action, payload}` timeline entries;
  trigger/conditions vocabulary enumerated = the row-2.22 authoring contract),
  EXCEPT `lighting:scene:activate` payloads carry `role` (pack vocabulary),
  not `sceneId`. NEW `playlists.schema.json` mirroring the current
  music-playlists shape (per OQ5 flag ownership).
- Manifest: add `playlists` to roleFor + role enums; regen both real packs'
  manifests (`build-pack-manifest.js`), Python/Node byte-parity suite extends.
- `installation-profile.schema.json` to the ratified C1 §1 shape — homed
  ENGINE-SIDE at `backend/config/profiles/` (profiles are venue config, not
  pack content; TokenData holds pack schemas only). B0.1 absorbs later (OQ6).

### D-4.3 — Gate rules (S2, two-flavor wording)

Activation-time refusals (packService gate, all flavor-i "self-contradictory"
unless noted):
1. Cue lighting `role` refs ⊆ declared `lightingRoles` (groups-coverage-gate
   precedent).
2. Cue `action` ∈ engine cue-action vocabulary + payload shape valid
   (flavor-ii "not driveable by this engine yet" for unknown actions —
   mirrors ENGINE_MODE_CAPS posture).
3. Cue condition `tokenId` values resolve against pack tokens.json.
4. Cue sound/video refs + playlist ids referenced by `music:loadPlaylist`
   resolve (sounds/videos against the venue asset dirs via the existing
   validateCommand checks at activation sweep — consistent with
   "files stay on the venue channel"; playlist ids against pack playlists.json).
5. `lightingRoleFallbacks` keys ⊆ `lightingRoles` (D-4.5).
6. Pointer/requires coherence per D-4.1.
Packless boot = benign emptiness (no cues, no baked-cues shim — there is no
pre-pack deployment class that had cues from a pack, so no L6-family shim).

### D-4.4 — Profile loader + fire-time resolver (S3)

- NEW minimal `src/services/profileService.js`: loads ONE profile at boot
  (frozen, packService template), `PROFILE_PATH` env injection seam (the
  PACK_PATH precedent — "load-bearing for testing, preview, AND rollback").
  Default: `backend/config/profiles/aln-full-kit.json` (interim home, OQ6).
  v1 reads ONLY `kind`/`schemaVersion`/`profileId`/`forPack`/`bindings.lighting`;
  everything else passes through unread (no duplication of routing.json —
  B7 data stays where it lives until its own slice).
- In-repo ALN profile: fully bound — all roles → real HA scene ids (owner
  supplies, OQ1). R4(b) satisfied; the unbound-role path is UNREACHABLE for
  ALN in production.
- Fire-time resolution in `commandExecutor`'s `lighting:scene:activate` case
  (+ the same line in `validateCommand`, inserted BEFORE `sceneExists`):
  payload has `sceneId` → GM/manual path, unchanged, zero resolution;
  payload has `role` → profile binding → else pack `lightingRoleFallbacks`
  (LOUD warn per fire) → else fail through the existing `cue:error` channel
  ("unresolvable lighting role 'x'"). One dispatch site serves both the GM
  path and the cue path; AsyncAPI documents the optional `role` alternative.
- **Deliberately NOT built (C2/C3 territory):** session-start dormancy
  disabling, preflight faces, planning view. The minimum R4 subset is
  fire-time lookup + full ALN bindings; unbound-role dormancy semantics
  arrive with C2+C3 (queued task) where they belong.

### D-4.5 — Concrete-id fallback: `lightingRoleFallbacks` (R4(c), ledger L7)

Reading (ii) chosen over per-command fallback ids: a separate top-level
game.json key `lightingRoleFallbacks: {role: 'scene.x', …}` — one venue id
per role, in ONE clearly-marked temporary block whose entire existence IS
the debt. Retirement at C4 = delete the key + its schema + its gate rule.
Drift tripwire: fallback map == the in-repo ALN profile's bindings
(byte-compared both ways — catches either side rotting). Loud warn on every
fallback-resolved fire. **Ledger row L7** lands with the code.

### D-4.6 — Audio target literal (`"target": "bluetooth"`) — ledger L8

One migrated cue carries a venue sink name in pack content. Stripping it
changes behavior (the sound would follow global routing); audio ROLES are
explicitly C1 headroom ("audio 'roles' if a pack ever needs them"), not this
slice. Position: migrate verbatim (behavior parity wins), **ledger row L8**:
"audio target literals ride in pack cues; revisit when C1's audio-roles
headroom activates or the cue is re-authored." Detection: grep pack cues for
`target`.

### D-4.7 — One-shot cutover (S4, tokens-v2 precedent)

Single commit train, no dual-accept window (same three preconditions hold:
single producer, atomic pack activation, frozen production):
- ALN pack gains `cues.json` (10 cues verbatim behavior, scene ids → roles;
  OQ2 triage applied), `playlists.json`, `lightingRoles`,
  `lightingRoleFallbacks`, `requires` additions; manifest regen.
- Engine re-points: `app.js:239` + `systemReset.js:228` load cues via
  `packService.resolvePackFile(gameConfig.cues)`; musicService playlist load
  re-points from `config/music-playlists.json` to the pack file. Old venue
  files stop being read (deleted from the repo in the same train — grep-clean,
  like scoring-config.json's retirement).
- config-tool `PUT /config/cues`: **re-pointed, not disabled** — it is the
  owner's only cue-authoring surface until the B pages. Writes go to the
  active pack dir's cues.json + manifest rebuild (sync-pipeline precedent),
  after validating through the SAME gate helpers (exported pure
  `validateCuesBlock(cues, gameConfig, tokens)` shared by packService and
  config-tool — an invalid save is refused at write time, never discovered
  at next boot). Scene-picker UI keeps offering live HA ids as FALLBACK
  authoring targets? No — it now offers the pack's declared roles (small UI
  swap; live-HA picker moves behind the profile-bindings context, C4's page).
- E2E `07d-03` and both dual-pack Tier L legs are the behavior-parity
  tripwire: ALN cues must fire identically end-to-end.

### D-4.8 — Toy pack as second consumer (S5)

Toy pack gains: `lightingRoles` (2 toy roles), `lightingRoleFallbacks`, ≥1 cue
per action class (`sound:play`, `lighting:scene:activate` via role,
`video:queue:add`, `music:loadPlaylist`), a toy playlist, `requires`
additions, `hardware.stack`/`endpoints` updated to claim what toy cues use;
a toy test profile + `E2E_PROFILE_PATH`-analog wiring in `capabilities.js`/
`startOrchestrator`. Toy cues are **manual/quickFire only** (no standing
triggers) so existing toy-leg E2E flows can't fire them incidentally; a new
E2E test fires them explicitly. Dual-pack Tier L both legs = the standing
slice gate.

## 4. Held owner questions (build proceeds on decision-free stages; S3+S4 content needs these)

- **OQ1 (blocks S3/S4 content):** Role NAMES for the seven-scene vocabulary
  (`scene.game/off/police_1/police2/police3/policeglitch/video`) — roles are
  game vocabulary the owner authors (B8) — AND the real HA scene ids for the
  in-repo ALN profile bindings (C1's examples are illustrative; R4(b) demands
  real coverage). *Note: seven, not the three the census first reported.*
- **OQ2 (blocks S4 content):** The five timestamp-id operator cues — migrate
  as ALN game content (they look like designed show beats: 90/60/30/15-minute
  warnings + ENDGAME) or prune as venue/session cruft? Recommended default:
  migrate, with honest ids (`warning-90min` etc.) since ids are not pinned
  anywhere (§2.3: only the three named ids are E2E-pinned).
- **OQ3:** Sound FILES into the pack (matrix 2.10's end-state) vs
  references-only this slice. Recommended default: references-only (matches
  the F5 video posture; file movement rides the B-pages media story).
- **OQ4:** Interim video reference form under the F5 deferral. Recommended
  default: keep concrete filenames — this is the SAME reference form
  tokens.json `video` fields already use; both migrate together under F5.
  No new debt class, no ledger row (F5 deferral is already program-recorded).
- **OQ5:** Playlist track refs = concrete venue MP3 filenames, ledger-free
  (consistent with files-stay) — confirm; and do `shuffle`/`loop`/
  `crossfadeMs` belong to the pack (show design) or profile (venue tuning)?
  Recommended default: pack (they describe the show's feel, not the room;
  B7 ruled only routes/ducking venue).
- **OQ6:** Interim profile home `backend/config/profiles/` + `PROFILE_PATH`
  env, absorbed by B0.1's store later — confirm, so C1 §5's ratified storage
  statement is amended rather than silently contradicted.

## 5. Build order (S1–S6) and obligations

Per the lockstep-train precedent (TokenData → backend/parent) and TDD:

1. **S1 Schemas** (TokenData): cues.schema.json, playlists.schema.json,
   game.schema pointer const-pins + lightingRoleFallbacks, manifest
   playlists role; profile schema (backend-side). Obligations: schema
   refusal-twin tests, manifest regen, pack-contract suite extension,
   Python/Node manifest byte-parity.
2. **S2 Gate** (backend): D-4.3 rules in activatePack; exported
   `validateCuesBlock`. Obligations: refusal-twin unit pins per rule,
   two-flavor wording tests.
3. **S3 Resolver + profile** (backend): profileService (+PROFILE_PATH),
   commandExecutor/validateCommand role line, fallback + loud warns,
   cue:error path; in-repo ALN profile (OQ1 content). Obligations:
   unit pins for bound/fallback/unresolvable/GM-sceneId-passthrough paths;
   L7 tripwire (fallback map == profile bindings).
4. **S4 Cutover** (TokenData + backend, one train): pack files authored
   (OQ2 triage), engine loads re-pointed, venue files deleted, config-tool
   PUT re-pointed + role picker, contracts (AsyncAPI `role`), manifests
   regen, ledger rows L7/L8 recorded in PHASE3-STATUS. Obligations:
   behavior-parity pins (07d-03 untouched and green), grep-clean retirement.
5. **S5 Toy second consumer**: D-4.8. Obligations: dual-pack Tier L green
   both legs, new toy cue E2E.
6. **S6 Close**: dist rebuild + full local E2E (the closers MAJOR: stale
   dist), full suites + ratchet raises both repos, mixed-model adversarial
   review, R13 citation confirmed logged, PHASE3-STATUS row + queue advance.

## 6. Residue claims / deferrals (explicit, per the closers close-out rule)

- PR-review residue (a) packLoader behavioral timeout and (b) staging-cache
  race test — **DEFERRED to the C2+C3 slice** (queued task): both live in
  the GM scanner's packLoader, and this slice does not touch the scanner
  repos at all; the "C1 preflight bucket" they were homed to has no queue
  slot, so they are explicitly RE-HOMED to C2+C3 (the next slice that opens
  scanner-side pack machinery). PHASE3-STATUS re-homing note lands with S6.
- Preflight §4 bindings check, dormancy (C2/C3), C4 bindings page: out of
  scope by design (§3 D-4.4).
- config-tool presets/scene-picker deep rework: out of slice (drop-cold
  ruling stands); only the minimal PUT re-point + role-picker swap rides.

## 7. Honest estimate (program §12.3)

≈2.5–3.5 sessions: S1+S2 ≈ 1, S3 ≈ 0.5–1, S4 ≈ 0.5–1 (content volume is
small — 10 cues, 1 playlist), S5+S6 ≈ 1 (dual-pack Tier L ×2 + review +
close records). Risk concentrations: config-tool PUT re-point (untested
surface today), AsyncAPI contract ripple, and OQ1 latency (S3/S4 content
blocks on owner answers — decision-free stages S1/S2 proceed regardless).
