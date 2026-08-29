# Phase 3 · A3 slice 4 — show-control content into the pack (+ ALN installation profile)

**Status: DESIGN r3 — RATIFIED. OQ1–OQ7 answered by the owner
(2026-08-29 grill, four rounds); build UNBLOCKED, S1 next.** §4 now
records the ANSWERS; the sound/playlist scope narrowings are logged as
program §13.1; landing slots per `ROADMAP.md` (ratified same day).
Date: 2026-08-29 (r1 same day; r2 folds in the pre-build red-team — workflow
`wf_0394f96d`, 3 attackers ×2 Opus/1 Fable, 17 MAJOR + 7 minor, ALL accepted;
adjudication record §8). Branch: `claude/phase3-a3-slice4` (chained from
closers tip `00d39fe`), draft PR #28. Census: workflow `wf_bb42d8c1-9af`
(5 legs), disputed facts settled by direct verification (§2.4) — and two
census claims r1 carried were DISPROVEN by the red team (§2.4a).

Program scope sentence (§3, RESCOPED): cues become pack content referencing
ROLES (lighting roles per B8; sound/video by pack-relative reference, never
HA entity ids or concrete venue filenames); music/playlist REFERENCES join
them (files stay on the venue/asset channel). Settles audit F7 + the
reference half of F6. Videos-in-pack (F5) stays deferred to the B pages'
media story. The R4 ordering guard ships in the same slice: (a) a backend
role→scene resolver reading the active installation profile, (b) an in-repo
ALN profile whose lighting bindings cover every migrated role, (c) a
concrete-id fallback (loud, ledgered, retires at C4).

**r2 scope narrowings — BOTH RULED in r3 (§4):** OQ3 → option B
(references-only, deviation logged as program §13.1) and OQ5r → playlist
move deferred entirely (same amendment; landing slots ROADMAP §8.1).

---

## 1. Extraction brake (R13) — capability-matrix rows cited

| Row | Matrix classification | This slice | Logged decision |
|---|---|---|---|
| 2.21 Cue definitions (incl. token-ID conditions) | game-content, "Pack `cues.json`" | **MOVED** — cues.json becomes pack content | Sanctioned by the matrix change-note verbatim. |
| 2.18 Cue → scene-ID references | **uncertain (Q9)** — game-content referencing venue entities | **RECLASSIFIED → game-content-referencing-roles, then MOVED** | Explicit reclassification, citing B8: roles are *game events* the pack authors; the venue maps role→instrument in the C1 profile. This is exactly the matrix's own proposed resolution ("Abstract scene *roles* in pack, venue maps role→entity"); logging it here discharges the Q9 uncertainty (1.23 precedent: slice-doc logging suffices, the matrix file is never edited). |
| 2.8 Music playlists + tracks | game-content, "Move into pack (`playlists.json` + assets)" | **DEFERRED (r2, red-team)** — recommended: no playlist move this slice at all (OQ5r). Rationale: zero cue `music:*` references exist in ALN content, so the program's "playlist REFERENCES join them" clause is vacuous today, while playlist DEFINITIONS carry a contracted LIVE-WRITE surface (OpenAPI `GET/PUT /api/music/playlists`, musicService `fs.watch` hot reload, config-tool music editor, seed script) that cannot enter the boot-frozen pack without either breaking the freeze doctrine or retiring mid-session playlist editing — a design fork that belongs with B0's store/authoring story | **OQ5r CONFIRMED (r3, owner 2026-08-29):** deferral ratified — logged narrowing = program §13.1; the move rides the B-pages media story (ROADMAP §8.1). |
| 2.10 Sound files | game-content, "Pack `assets/audio/`" | **RULED (r3, owner 2026-08-29): option B** — references-only; the 74 MB of wavs stay on the venue channel | The deviation from "never … concrete venue filenames" is LOGGED (program §13.1); packaging lands at the pack-manager media page under the ratified media-bundle model (ROADMAP §2.3/§8.1). |
| 2.22 Cue-triggerable event vocabulary | engine-fixed | **NOT moved** — stays engine | Its change-note ("document as the cue-authoring contract in game-pack schema") is DISCHARGED by S1: `cues.schema.json` + the S2 gate's trigger/action-vocabulary checks become that contract. |
| 2.24 Command gating + resource validation | engine-fixed | **NOT moved** — executeCommand gains a role-normalization step (engine work on an engine row) | No classification change. |
| 2.17 Lighting scenes (HA, runtime fetch) | venue-config | **NOT moved** | Scenes stay venue; only *references* to them leave the venue files. |
| 2.14 Ducking rules | uncertain (Q8), matrix note "likely game-pack with venue override" | **NOT moved** — stays venue | **Matrix-note correction logged:** B7 (ratified with C1, 2026-08-22) ruled routes AND ducking are venue config. The matrix's "likely game-pack" note is stale; row 2.14 resolves venue-config. |
| 6.7 config-tool music playlist editor | (tool row) | **NOT moved** under the OQ5r deferral — the editor keeps editing the venue file | Logged here per the red team (doctrine MAJOR-2): if OQ5r is answered "move", row 6.7's re-point joins the slice and the price rises. |

No `engine-fixed` row is moved. Brake satisfied.

## 2. Census facts (verified)

### 2.1 Migration inventory — `backend/config/environment/cues.json` (ground truth, re-verified 2026-08-29 on this branch)

- **10 cues**: 5 named/designed (`attention-before-video`, `restore-after-video`,
  `tension-hit`, `e2e-compound-test`, `e2e-video-compound`) + 5 timestamp-id
  operator-created (`cue-1772422843217`, `…894866`, `…917681`, `…984913`,
  `…004537` — the 90/60/30/15-minute warnings + ENDGAME; OQ2 triages them).
  3 carry `timeline` (compound); the rest are flat `commands`. The 5
  operator cues carry an explicit `"trigger": null` — the S1 schema MUST
  accept it or "migrate verbatim" is schema-invalid on day one (red team).
- **22 command instances**: `sound:play` ×9, `lighting:scene:activate` ×11,
  `video:queue:add` ×2, `music:*` ×0.
- **7 distinct scenes**: `scene.game`, `scene.off`, `scene.police_1`,
  `scene.police2`, `scene.police3`, `scene.policeglitch`, `scene.video`
  (venue-side naming inconsistency `police_1` vs `police2/3` — roles erase
  it from pack content).
- **7 distinct sounds**: `15min.wav`, `30min.wav`, `60min.wav`, `90min.wav`,
  `attention.wav`, `policesounds.wav`, `tension.wav`.
- **2 video refs**: `policesequencewoverlay.mp4` (real show content —
  **NOT in the repo**: `backend/public/videos/` holds only test fixtures;
  the real file lives on the venue Pi. Any gate that checks video-file
  existence therefore fails every dev/CI machine — one of three reasons the
  r1 activation sweep died, §8) and `test_2sec.mp4` (E2E fixture, already
  living in production cues today).
- **1 routing target literal**: `"target": "bluetooth"` on one `sound:play`
  (bypasses sink resolution → raw `pw-play --target`; §3 D-4.6 / OQ7).
- **2 conditions**: both `{field: tokenId, op: neq, value: 'policesequencewoverlay'}`.
  **r2 CORRECTION (red-team MAJOR):** r1 called this "a pack-internal
  reference — tokenIds are pack content". FALSE — `policesequencewoverlay`
  is not a token (tokens.json has 81 keys; it is absent). It is the
  SYNTHETIC tokenId `videoQueueService.addVideoByFilename` mints for a
  standalone video (filename minus extension; videoQueueService.js:759-768),
  which the `video:*` normalizers then surface (standingEvaluator.js:27-29)
  — exactly what these guard cues compare against. Consequence: cue
  condition tokenIds on `video:*` triggers live in a filename-derived
  ENGINE namespace, not the pack token namespace (gate rule 3, §3 D-4.3).
- **Structure note for future counters**: timeline entries are FLAT
  `{at, action, payload}` objects, NOT nested under a `command` key.
  Two census legs undercounted by walking the wrong shape.
- **Playlists** (`backend/config/music-playlists.json`): 1 playlist
  (`all-tracks`, bootstrap), `shuffle`/`loop`/`crossfadeMs` flags, concrete
  venue MP3 filenames as track refs. **r2 surface census (red-team, three
  attackers independently):** this file is NOT read-only config — it has a
  contracted HTTP surface (`GET/PUT /api/music/playlists`, OpenAPI describes
  both by file path "verbatim"/"atomically replaces"), a live `fs.watch`
  hot-reloader in musicService, a seed script
  (`backend/scripts/seed-music-playlist.js`, `npm run music:seed`), and the
  config-tool music editor riding the HTTP proxy. Grounds for OQ5r.

### 2.2 Dormant schema headroom (exists TODAY, activated by S1)

- `ALN-TokenData/game.schema.json`: `lightingRoles` (array of
  `^[a-z0-9][a-z0-9-]*$` strings) and a `cues` file pointer
  (`type: string, pattern: \.json$` — **NOT const-pinned**, unlike
  `strings: {const: 'strings.json'}`; S1 const-pins it per the 3a
  role-vs-pointer lesson). `surfaces` object also present (slice 6's, untouched).
- Manifest builder `roleFor('cues.json') → 'cues'` already exists; role enums
  in openapi/pack-manifest.schema already list it.
- Both manifest builders' EXCLUDE sets enumerate schema filenames
  LITERALLY — without an S1 extension, `cues.schema.json` would be
  inventoried, served, and folded into contentHash (red team; §5 S1).
- **Zero** role-resolution or installation-profile code exists anywhere.

### 2.3 Engine load sites and consumers

- Cues load at `backend/src/app.js:239` and `src/services/systemReset.js:228`
  — both hardcode `config/environment/cues.json`; zero tests pin the PATH.
  **r2 CORRECTION (red-team MAJOR):** r1 inferred "cutover is
  test-transparent" — true of the path, FALSE of the CONTENT. Four E2E
  flows pin ALN cue ids/behavior and today pass on the TOY leg only because
  the venue file loads pack-independently: `07d-03` (tension-hit,
  e2e-compound-test, attention-before-video), `22-player-video-lifecycle`
  (attention-before-video/restore-after-video firing), `30-full-game-session`
  (fires e2e-compound-test), `admin-state-reactivity` (quick-fire grid
  data-cue-id). After the cutover the toy leg loads TOY cues and all four
  fail. (Verified NOT pins: 07d-04 mentions a cue id in a comment only;
  tests/integration/compound-cues.test.js injects its own fixtures via
  `loadCues([cue])` — both survive untouched.) Mechanism: §3 D-4.7e.
- `loadCues` validates structure only (`commands` XOR `timeline`).
  `validateCommand` resource checks (5) run health-first and read live
  service state — see §3 D-4.3 for why they CANNOT run at activation.
- The GM Scanner NEVER receives cue internals (`getCueSummaries` strips to
  id/label/icon/quickFire/once/triggerType/enabled — red-team verified).
  E1 persistence is reference-free. MESSAGE_TYPES untouched. **The scanner
  repos are NOT in this slice's train** (red-team verified: scanner gates
  schemaVersion only, no `requires` check; packLoader filters files by
  RULES_ROLES={game,tokens,strings} and ignores unknown manifest roles).
- config-tool cues surface (**r2 census, red-team MAJOR** — r1 named only
  the PUT): `cuesPath` feeds SIX paths in configManager/routes — the
  `GET /config` bundle read (`readAll`), the sound/video asset-usage maps,
  `PUT /config/cues` → `writeCues` (bare write, NO manifest rebuild —
  unlike `writeScoring`, which got validate+rebuild+rollback hardening),
  preset CAPTURE (`savePreset` snapshots cues), preset APPLY
  (`loadPreset → writeCues(preset.cues)`), backup RESTORE
  (`writeCues(backup.cues)`); preset IMPORT validation REQUIRES a `cues`
  key. Every preset/backup on disk carries PRE-migration cues (concrete
  sceneIds). §3 D-4.7c handles all of it.
- Preflight checklist (`docs/preflight-checklist.md`) reads the venue cues
  file in three checks incl. a hard existence test — the cutover instrument
  breaks at the cutover unless rewritten in the same train (slice-2 §4.4
  precedent; §5 S4).
- Toy pack today: NO cues; `hardware.stack = {}`, `endpoints = {}`. The ALN
  pack-manifest's `hardware.stack` ALREADY claims `cue sound effects`/
  `lighting cues` usedBy — claims that become true only with this slice.

### 2.4 Census-leg corrections (settled by direct verification)

- Doctrine leg undercounted scenes (3 vs **7**) and sounds (2 vs **7**);
  contracts leg said 9 cues vs **10**. Consequence: the ALN role vocabulary
  must cover **seven** scenes (OQ1).
- Tooling leg's "pack-manifest schemaVersion drift" surprise REFUTED — it
  read the stale standalone checkout at `/home/user/ALN-TokenData`
  (schemaVersion 1). In-repo: `schemaVersion: 2, const: 2`. No drift.

### 2.4a r1 claims DISPROVEN by the red team (recorded per program honesty rules)

1. "tokenIds are pack content" for the two cue conditions — false (§2.1).
2. "07d-03 untouched and green" + "cutover is test-transparent" — false (§2.3).
3. "reuse the existing validateCommand checks at activation" — structurally
   impossible AND doctrinally wrong (§3 D-4.3, §8 G1/R2).
4. The §1 r1 row-2.8 "REFERENCE HALF MOVED" disposition understated a
   contracted live-write surface (§2.1 playlists; §8 G4/R3/D2).

## 3. Design positions (r2 — the mechanism)

### D-4.1 — No PACK_SCHEMA_VERSION bump; gate by capability (`requires`)

**r2 re-based justification (red-team):** the no-bump position SURVIVED
adversarial consumer enumeration — packLoader filters by RULES_ROLES and
ignores unknown roles; `resolvePackFile`'s whitelist IS the manifest
inventory, so `cues.json` serves the moment it is inventoried; the PWA,
ESP32, and validate-session packResolver read identity fields only; the
schema/openapi role enums already carry `cues`. THAT tolerance — no
consumer breaks — is the argument. r1's second pillar ("rule 6 closes the
old-engine silent-ignore hole") is RETRACTED as inverted: a gate rule in
the NEW engine cannot run on a pre-slice-4 engine, and the old engine's
`requires` check fires only when the array is present. The residual
exposure (a cues-bearing pack that forgets `requires` activates on an old
engine with no show control) is ACCEPTED explicitly under the
frozen-production preconditions: single producer, coordinated cutover, no
old-engine deployment class after it.

- New keys are ADDITIVE-OPTIONAL in game.schema v2.
- Three new append-only capability ids (D1 `area.variant` convention):
  `cues.standing`, `cues.timeline`, `lighting.roles`.
- A cues-bearing pack declares the matching ids in `requires`; the existing
  slice-0 gate refuses on a non-implementing engine, NAMING the missing
  capability.
- **Coherence rule (relabeled r2):** a pack declaring a `cues` pointer or
  `lightingRoles` without the matching `requires` ids is refused — an
  AUTHORING-coherence lint (flavor-i, same family as the phases/modes
  self-contradiction rules), NOT a compatibility guard.

### D-4.2 — Schema activation (S1)

- `game.json` pointers: `cues: {const: 'cues.json'}` (const-pinned; the
  red team verified nothing reads the free-form pattern — both manifest
  builders already hardcode the literal). NO `playlists` pointer under the
  OQ5r deferral.
- NEW `ALN-TokenData/cues.schema.json`: cue shape = today's engine contract
  (`commands` XOR `timeline`; flat `{at, action, payload}` entries;
  `"trigger": null` explicitly legal; trigger/conditions vocabulary
  enumerated = the row-2.22 authoring contract), EXCEPT
  `lighting:scene:activate` payloads carry `role`, not `sceneId`.
- `lightingRoles` stays the ratified array-of-role-name-strings; NEW
  top-level `lightingRoleFallbacks` (D-4.5).
- Manifest builders: EXCLUDE gains a `.schema.json` SUFFIX rule in BOTH
  builders (covers slice 6/7 schemas too); pack-contract assertion that no
  inventoried path ends `.schema.json`; regen both real packs; byte-parity
  suite extends.
- `installation-profile.schema.json` to the ratified C1 §1 shape — homed
  ENGINE-SIDE at `backend/config/profiles/` (OQ6).

### D-4.3 — Gate rules (S2) — **r2: pack-internal only, pure reads, zero services**

Hard boundary (red-team, two attackers independently): `activatePack()` is
deliberately the FIRST act of `initializeServices()` (app.js:184-192
ordering invariant) — every service is health-seeded `down`, lighting's
scene list and music's playlist map are empty, and one referenced video
exists only on the venue Pi. Therefore the gate runs NOTHING that touches a
service or a venue resource. Venue-resource existence (sound/video files,
HA scenes, sinks) stays where C1 §3 item 5 already homes it: the
PREFLIGHT/pre-show `validateCommand` sweep, run after services init,
reported through serviceHealth/held-items — never a boot refusal (a
`degrade`-class venue absence must never kill the orchestrator).

Activation refusals (flavor-i "self-contradictory" unless noted):
1. Cue lighting `role` refs ⊆ declared `lightingRoles` (groups-coverage
   precedent).
2. Cue `action` ∈ the engine cue-action vocabulary + payload shape valid
   (flavor-ii "not driveable by this engine yet" for unknown actions).
3. **(narrowed r2)** Condition `tokenId` values resolve against pack
   tokens.json ONLY for triggers whose normalizer tokenId is
   token-derived (`transaction:accepted`, `player:scan`); `video:*`
   trigger tokenIds are a filename-derived engine namespace — EXEMPT.
   The two ALN guard cues become green fixtures in the S2 gate suite so
   this rule can never be re-written to refuse them.
4. **(replaced r2)** Pack-internal reference completeness only — under
   OQ5r deferral this reduces to rules 1–3; if OQ5r is answered "move",
   `music:loadPlaylist` ids ⊆ pack playlists.json joins here.
5. `lightingRoleFallbacks` keys ⊆ `lightingRoles`.
6. Pointer/`requires` coherence per D-4.1 (authoring lint).
7. **(new r2, phases-gate-grade shape rules** — packService's own precedent:
   "the gate cannot assume schema validation ran"): (a) duplicate/empty cue
   id → refusal (loadCues silently last-wins today); (b) trigger coherence
   — at most one of `trigger.event` | `trigger.clock` | null, with
   `trigger.event` ∈ EVENT_NORMALIZERS (flavor-ii) and `trigger.clock`
   parseable HH:MM:SS (flavor-i — an unparseable string today THROWS out
   of the unguarded synchronous tick listener once per second mid-show);
   (c) every `condition.op` ∈ CONDITION_OPS (unknown ops silently never
   fire); (d) every timeline entry has a finite non-negative numeric `at`
   and a string `action` (a missing `at` NaN-poisons maxAt → the cue never
   completes); (e) ≤1 video entry per timeline (F-SHOW-08, warn-only today).

**Engine hardening (same stage):** guard `findMatchingClockCues`/
`handleClockTick` so a bad clock string can never escape into the tick
interval (the restore path already try/catches the same call; the live
path must too), and make `loadCues` refuse duplicate ids defensively.

Packless boot = benign emptiness (no cues, no baked-cues shim).

### D-4.4 — Profile loader + fire-time resolver (S3)

- NEW minimal `src/services/profileService.js`: loads ONE profile at boot
  (frozen, packService template), `PROFILE_PATH` env injection seam.
  Default: `backend/config/profiles/aln-full-kit.json` (OQ6). v1 reads
  ONLY `kind`/`schemaVersion`/`profileId`/`forPack`/`bindings.lighting`;
  everything else passes through unread (no duplication of routing.json).
- In-repo ALN profile: fully bound — all roles → real HA scene ids (OQ1).
  R4(b) satisfied; the unbound-role path is UNREACHABLE for ALN.
- **Resolution point (r2 — red-team MAJOR):** role→sceneId normalization
  happens at the TOP of `executeCommand`, keyed on action, BEFORE the
  `REQUIRED_PAYLOAD_FIELDS` loop — because that loop maps
  `lighting:scene:activate → ['sceneId']` and would reject every role
  payload with a misleading "sceneId is required" before r1's resolver
  site was ever reached (this kills 100% of the 11 migrated lighting
  commands on ALL FOUR dispatch paths: simple cue, compound timeline
  entry, held-cue release re-fire, direct gm:command — all funnel through
  `executeCommand`). The required-fields-before-health-gate rationale
  (commandExecutor.js:68-74) is preserved: normalization runs first, so
  every downstream guard (required-fields, the inline case guard,
  `validateCommand`'s sceneExists) sees a normalized `sceneId`.
  Resolution order: profile binding → pack `lightingRoleFallbacks` (LOUD
  warn per fire) → fail through the existing `cue:error` channel
  ("unresolvable lighting role 'x'"). `validateCommand` mirrors the
  normalization before its sceneExists line. GM concrete-`sceneId`
  payloads bypass normalization entirely — unchanged.
- **Contract-first (r2):** the AsyncAPI `role` payload alternative for
  `lighting:scene:activate` is S3's OPENING commit (root doctrine:
  contracts first; slice-1 precedent), not an S4 afterthought.
- Unit pins on all four dispatch paths (incl. held-release re-fire — the
  red team verified release re-enters via `fireCue` by cueId, never a
  stored payload, so the single site suffices; pin that property).
- **Deliberately NOT built (C2/C3 territory):** session-start dormancy
  disabling, preflight faces, planning view.

### D-4.5 — Concrete-id fallback: `lightingRoleFallbacks` (R4(c), ledger L7)

Reading (ii): a top-level game.json key `lightingRoleFallbacks:
{role: 'scene.x', …}` — one venue id per role, one clearly-marked
temporary block whose existence IS the debt. Retirement at C4 = delete the
key + schema + gate rule. Loud warn on every fallback-resolved fire.
**Ledger row L7** lands with the code.
**Tripwire (r2 precision — red-team):** a BUILD-TIME unit test, never a
boot-time check (a boot check would refuse every injected-pack/profile
combination the harness legitimately mixes). Compare defined as
`game.json.lightingRoleFallbacks[role] === profile.bindings.lighting[role].ha`
(projection through the ratified C1 object shape), skipping roles whose
binding declares a non-`ha` provider (C1 WLED headroom). Same shape as the
LEGACY_ALN_SCORING drift tripwire. Any harness profile env seam must be
pinned in the SAME startOrchestrator call as packPath, never as an
independent global.

### D-4.6 — Audio target literal (`"target": "bluetooth"`) — RULED: option (a) (r3, OQ7)

r1's L8 row had a "revisit when…" trigger that fails the ledger doctrine's
DoD-linkage clause (every row retires in-phase or carries an owner-ratified
post-Phase-3 retirement point). r2 puts the choice to the owner (OQ7):
(a) migrate the target verbatim (behavior parity) + owner ratifies L8's
retirement point (e.g. "B-pages media story or the theme unit — whichever
first touches cue audio"); or (b) strip the target so the sound follows the
venue's global sound route — a BEHAVIOR CHANGE (that cue's audio moves off
the bluetooth speaker) the owner must approve. No third option: inventing
per-cue audio overrides in the profile is mechanism C1 does not ratify.

### D-4.7 — One-shot cutover (S4, tokens-v2 precedent)

Single commit train, no dual-accept window (single producer, atomic pack
activation, frozen production all hold):

a. ALN pack gains `cues.json` (10 cues verbatim behavior, scene ids →
   roles; OQ2 triage applied), `lightingRoles`, `lightingRoleFallbacks`,
   `requires` additions; manifest regen. (NO playlists.json under OQ5r.)
b. Engine re-points: `app.js:239` + `systemReset.js:228` load cues via
   `packService.resolvePackFile(gameConfig.cues)`. The venue cues file is
   deleted in the same train (grep-clean, scoring-config precedent).
   musicService is UNTOUCHED under OQ5r.
c. **config-tool (r2 — full surface, red-team ×3):** the `cuesPath`
   re-point covers ALL configManager consumers at once (readAll, usage
   maps, writeCues, presets, backups). `writeCues` gets the `writeScoring`
   shape: validate via shared helper → snapshot previous → write →
   manifest rebuild → restore-on-rebuild-failure. Preset system: `cues`
   is STRIPPED from preset capture/apply/import in the same train (import
   validation updated; applying an old preset no longer writes its
   pre-migration sceneId cues anywhere — the operator's recovery tool must
   never be able to brick the pack). §6 note: this is a deliberate,
   logged exception to "presets out of slice" — re-pointing a writer they
   share forces it.
d. **Shared validator homing (r2):** `validateCuesBlock(cues, gameConfig,
   tokens)` lives in `backend/src/gameRules/` (dependency-free seam —
   config-tool cannot require packService, whose import chain pulls
   winston + dotenv and mkdirs at module load; precedent:
   build-pack-manifest.js). packService imports it; config-tool requires
   it directly. config-tool writes the CHECKED-IN submodule pack
   (`ALN-TokenData/`), matching writeScoring; PACK_PATH-injected runs are
   out of the tool's scope (stated limitation).
e. **E2E (r2 — red-team MAJOR, two attackers):** r1's "07d-03 untouched"
   is RETRACTED. The four cue-pinning flows (07d-03, 22, 30,
   admin-state-reactivity) become ALN-pack-PINNED (explicit `packPath` in
   their startOrchestrator calls — the 07c precedent; an explicit pin wins
   over E2E_PACK_PATH by design), so they keep testing ALN cue behavior
   identically on BOTH Tier L legs. Toy cue coverage is a NEW toy-pinned
   flow (D-4.8). Behavior parity = those four flows green + unchanged.
f. Preflight checklist: the three venue-cues-file checks are rewritten
   pack-aware in the same train (slice-2 §4.4 fix-what-you-break
   precedent) — the checklist is the cutover's own instrument.
g. Contracts: AsyncAPI `role` alternative landed at S3-open; S4 carries
   only cutover-specific contract text. (No OpenAPI music changes under
   OQ5r.)

### D-4.8 — Toy pack as second consumer (S5)

Toy pack gains: `lightingRoles` (2 toy roles), `lightingRoleFallbacks`,
cues at ONE ACTION CLASS PER CUE (r2 — a single multi-action cue is held
whole by `fireCue`'s pre-dispatch dependency scan if ANY service is down),
`requires` additions, `hardware.stack`/`endpoints` updated; a toy test
profile. Toy cues are manual/quickFire only. Harness: profile env seam
(`E2E_PROFILE_PATH`-analog) wired in `tests/e2e/setup/test-server.js`'s
startOrchestrator (r2 correction: capabilities.js is a read-only prober,
not an env seam), pinned per-call alongside packPath.
**CI reality (r2):** the toy lighting-role E2E is gated
`requireCapabilities(test, caps, ['lighting'])` and SKIPS on HA-less
runners — so the slice gate does NOT rest on it: a NON-E2E integration
test proves role resolution end-to-end (executeCommand + stubbed lighting
service + real profileService), and runs everywhere. Dual-pack Tier L both
legs green = the standing slice gate.

## 4. Owner answers (2026-08-29 grill — ALL SEVEN RULED; this section is now build input)

- **OQ1 ANSWERED — role vocabulary + bindings (S3/S4 content input):**
  all seven HA scene ids confirmed LIVE as-is; roles as proposed:

  | HA id (profile binding) | Role (pack vocabulary) |
  |---|---|
  | `scene.game` | `gameplay` |
  | `scene.video` | `video-playback` |
  | `scene.off` | `blackout` |
  | `scene.police_1` | `police-arrival-1` |
  | `scene.police2` | `police-arrival-2` |
  | `scene.police3` | `police-arrival-3` |
  | `scene.policeglitch` | `police-glitch` |

  Any later HA-side rename is a one-line profile edit (the seam's point).
- **OQ2 ANSWERED — migrate all five, renamed:** `warning-90min`,
  `warning-60min`, `warning-30min`, `warning-15min`, `endgame`
  (labels preserved). They are the show's spine, not cruft. Rename
  verified safe by the red team (mark-don't-fire restore; nothing pins
  the timestamp ids). The two e2e fixture cues migrate VERBATIM
  (ids E2E-pinned; Quick-Fire visibility = today's parity).
- **OQ3 ANSWERED — Option B (references-only):** cues name the files;
  the 7 wavs (74 MB — 440x the pack's size) stay on the venue channel.
  The program-sentence deviation is LOGGED as program §13.1; packaging
  lands at the pack-manager media page (ROADMAP §8.1) under the
  ratified media-bundle model (ROADMAP §2.3: media never lives in git
  packs).
- **OQ4 ANSWERED — concrete filenames confirmed** (same reference form
  as tokens.json `video` fields; rides the recorded F5 deferral —
  ROADMAP §8.1).
- **OQ5r ANSWERED — DEFERRED entirely** (program §13.1; ROADMAP §8.1).
  musicService, musicRoutes, OpenAPI music paths, config-tool music
  editor, seed script: ALL UNTOUCHED this slice.
- **OQ6 ANSWERED — confirmed:** `backend/config/profiles/aln-full-kit.json`
  + `PROFILE_PATH` env; B0.1's store absorbs it later (C1 §5 amended by
  this record rather than silently contradicted).
- **OQ7 ANSWERED — option (a), migrate verbatim:** the
  `target: "bluetooth"` routing is deliberate diegetic staging (ENDGAME
  police sounds from a specific speaker) and is PRESERVED. Ledger
  **L8** lands post-Phase-3-classed with the owner-ratified checkpoint
  trigger: the pack-manager media page's design must retire it (audio
  roles / re-authoring) or explicitly re-ratify it (ROADMAP §8.2).

## 5. Build order (S1–S6) and obligations

1. **S1 Schemas** (TokenData + backend profile schema): cues.schema.json
   (trigger:null legal), game.schema `cues` const-pin +
   `lightingRoleFallbacks`, EXCLUDE `.schema.json` suffix rule in BOTH
   manifest builders + no-inventoried-schema contract assertion, manifest
   regen, pack-contract suite extension, Python/Node byte-parity;
   installation-profile.schema.json.
2. **S2 Gate** (backend): D-4.3 rules 1–7 in activatePack via shared
   `validateCuesBlock` homed in `src/gameRules/`; ALN guard cues as green
   fixtures; engine hardening (tick guard, loadCues dupe refusal).
   Obligations: refusal-twin unit pins per rule, two-flavor wording tests.
3. **S3 Resolver + profile** (backend): OPENS with the AsyncAPI `role`
   contract commit; then profileService (+PROFILE_PATH),
   executeCommand-top normalization + validateCommand mirror, fallback +
   loud warns, cue:error path; in-repo ALN profile (OQ1 content).
   Obligations: unit pins for bound/fallback/unresolvable/GM-sceneId
   paths ×4 dispatch routes; L7 BUILD-TIME tripwire (D-4.5 projection);
   non-E2E role-resolution integration test (D-4.8).
4. **S4 Cutover** (TokenData + backend + config-tool, one train): pack
   files authored (OQ2/OQ3 applied), engine loads re-pointed, venue cues
   file deleted, config-tool full-surface re-point + writeCues hardening +
   preset cues-strip + role picker, preflight checklist cue checks
   rewritten, four E2E flows ALN-pack-pinned, cutover contract text,
   manifests regen, ledger rows L7(+L8 if OQ7a) recorded in PHASE3-STATUS.
   Obligations: behavior-parity = the four pinned flows green + unchanged;
   grep-clean retirement.
5. **S5 Toy second consumer**: D-4.8 (one action class per cue, toy
   profile, test-server profile seam, capability-gated toy E2E + the
   always-on integration proof). Obligations: dual-pack Tier L green both
   legs.
6. **S6 Close**: dist rebuild + full local E2E (closers MAJOR precedent:
   stale dist), full suites + ratchet raises, mixed-model adversarial
   review, R13 citation confirmed logged, PHASE3-STATUS row + queue
   advance + residue re-homing note (§6).

## 6. Residue claims / deferrals (explicit)

- PR-review residue (a) packLoader behavioral timeout and (b)
  staging-cache race test — **DEFERRED to the C2+C3 slice** (this slice
  never touches the scanner repos; the "C1 preflight bucket" has no queue
  slot, so both are explicitly RE-HOMED to C2+C3). PHASE3-STATUS note
  lands with S6.
- Preflight FULL refresh stays with C2; S4 rewrites ONLY the three cue
  checks it breaks (fix-what-you-break).
- Dormancy (C2/C3), C4 bindings page, planning view: out of scope by design.
- config-tool presets: out of slice EXCEPT the D-4.7c cues-strip, a
  logged exception forced by sharing a writer with the re-pointed path.
- Playlists/music surface: untouched under OQ5r (else see OQ5r
  alternative pricing).

## 7. Honest estimate (program §12.3 — r2 re-priced with calibration)

**≈4–6.5 sessions.** Calibration (red-team; r1's 2.5–3.5 RETRACTED):
slice 2 — single-repo, no new services, no tool UI — was priced at the
same 2.5–3.5 and landed at its upper band; 3a priced 5–7 with its
schema+gate+manifest+loader infrastructure alone at 1–1.5; the program's
own A2 record is 2.3–2.7× under-estimation. This slice spans two new
schemas, a new backend service, an executeCommand normalization touching
every command path, a three-repo cutover train (TokenData + backend +
config-tool), four E2E flow re-points, preset surgery, contracts in both
specs, toy expansion, dual-pack Tier L ×2, and the adversarial review.
The OQ5r deferral is what keeps this below the doctrine attacker's 5–8
(it removes the OpenAPI/music/fs.watch/seed/row-6.7 surface); if OQ5r is
answered "move now", adopt **5.5–8**. Widest bands: S4 (cutover +
config-tool) and S5 (dual-pack fallout).

## 8. Red-team adjudication record (r1 → r2)

Workflow `wf_0394f96d`, 2026-08-29: 3 attackers (gate/versioning — Opus;
runtime/cutover — Opus; doctrine/completeness — Fable), 742k tokens,
findings verified against the repo with file:line evidence; author
spot-checked the five most load-bearing claims directly (all confirmed).
**All 17 MAJOR + 7 minor findings ACCEPTED.** Dispositions:

| # | Finding (abridged) | Resolution in r2 |
|---|---|---|
| G1/R2 | validateCommand-at-activation boot-fails everywhere (services down-seeded, playlists unloaded, video file venue-only); venue checks at boot invert `degrade` semantics | D-4.3 rebuilt: gate = pack-internal pure reads only; venue existence stays at preflight (C1 §3.5) |
| G2 | Rule 3 refuses the real ALN pack — `policesequencewoverlay` is a synthetic filename-derived tokenId | Census corrected (§2.1); rule 3 narrowed to token-derived normalizers; ALN guard cues = green gate fixtures |
| G3 | Gate shape-blind where engine shape-fragile (clock-parse throw per tick, dupe ids, dead ops, NaN maxAt, F-SHOW-08 warn-only, trigger:null) | Rule 7 added (phases-gate model) + engine tick-guard/loadCues hardening + schema accepts trigger:null |
| G4/R3/D2 | Playlist re-point puts a contracted live writer + fs.watch + seed script inside the frozen pack, invisibly to drift detection; OpenAPI paths + editor uncensused | OQ5r: deferral recommended (option b); full surface censused (§2.1); "move now" path priced (§7) |
| G5 | Rule 6 cannot protect pre-slice-4 engines (inverted argument) | D-4.1 re-based on verified consumer tolerance; rule relabeled authoring lint; residual exposure accepted explicitly |
| R1 | REQUIRED_PAYLOAD_FIELDS rejects role payloads before r1's resolver site, on all four dispatch paths | Resolution moved to executeCommand top, pre-guards (D-4.4) |
| R4/D3/Gm3 | Preset apply/restore = second unvalidated manifest-blind pack-cue writer; six config-tool consumers uncensused; writeCues lacks writeScoring hardening | D-4.7c: full-surface re-point, writeCues hardened, cues stripped from presets (logged §6 exception) |
| R5/D1 | "07d-03 untouched" ∧ "dual-pack both legs" contradiction; 4 flows pin ALN cue ids (r2 verified: 07d-04 comment-only, integration suite fixture-injected — not pins) | D-4.7e: four flows ALN-pack-pinned (07c precedent); toy coverage = new pinned flow |
| R6 | Toy multi-action cue held whole when any service down; capabilities.js is not an env seam | D-4.8: one action class per cue; requireCapabilities gating; always-on integration proof; seam = test-server.js |
| D4/Gm2 | OQ3 default smuggles a program-sentence deviation as "ambiguity" | OQ3 reframed with both options priced; deviation requires logged amendment/ledger row |
| D5 | Estimate ignores calibration record | §7 re-priced 4–6.5 (5.5–8 if OQ5r="move") with calibration paragraph |
| D6 | L8 trigger violates ledger DoD-linkage; not held for owner | OQ7 added; D-4.6 rewritten (ratify retirement point, or strip target = behavior change) |
| Dm7 | Contract-first inverted (AsyncAPI in S4 after S3 behavior) | AsyncAPI role commit opens S3 |
| Dm8 | Preflight checklist reads the deleted file (cutover instrument breaks) | S4/D-4.7f: three cue checks rewritten in-train |
| Gm1 | Manifest EXCLUDE would inventory the new schemas | S1: `.schema.json` suffix rule both builders + contract assertion |
| Rm7 | L7 tripwire home/shape unstated; C1 binding is an object | D-4.5: build-time only; `.ha` projection; non-ha providers skipped; env seams pinned per-call |
| Rm8 | validateCuesBlock can't export from packService; config-tool can't know PACK_PATH | D-4.7d: homed in gameRules/ (dep-free); tool writes the checked-in pack; limitation stated |

What the red team CONFIRMED (claims that survived attack, kept
load-bearing): the no-bump position itself; the const-pin; the three
capability ids and area.variant granularity; held-release re-entry through
fireCue (single resolution site suffices); cue:fired/getCueSummaries/E1
carry no cue internals (no role leak); scanner-repos-untouched; the §2.1
inventory (byte-accurate); OQ2 rename safety; R13 row citations faithful +
1.23 logging precedent; D-4.5 reading-(ii) within R4(c)'s sanction;
validate-session unaffected.

## 9. Execution record

### S1 — schemas (DONE 2026-08-29)

Branches: TokenData `claude/phase3-a3-slice4` created from closers tip
`1d323a7`; parent work on the existing slice branch. Built test-first at
the §5.1 seams (pack-contract suite, Python parity suite, refusal twins).

**Landed:**
- `ALN-TokenData/cues.schema.json` (NEW): the authoring half of the
  row-2.22 contract. Commands XOR timeline (oneOf); flat
  `{at, action, payload}` entries (nested `command` refused); `trigger`
  accepts an event object, a clock object, null, or absence; trigger
  event enum (16 values) and condition op enum (7) are enumerated and
  DRIFT-TRIPWIRED against `standingEvaluator` `EVENT_NORMALIZERS` /
  `CONDITION_OPS` by the contract suite; `lighting:scene:activate`
  payloads require `role` and refuse `sceneId`; `op: in` requires an
  array value; conditions on clock triggers are refused (engine never
  evaluates them); file header `kind: 'cues'` + `schemaVersion: 1`
  follows the strings sidecar convention (S4 authors the header in).
- `ALN-TokenData/game.schema.json`: `cues` const-pinned to `cues.json`
  (3a role-vs-pointer lesson); NEW `lightingRoleFallbacks` (role-name
  keys → concrete scene-id strings; description marks it ledger L7,
  temporary, retires at C4).
- Both manifest builders: schema exclusion moved from literal names to a
  `.schema.json` SUFFIX rule (`isSchemaFile`/`_is_schema_file`);
  redundant literals pruned so the suffix rule is the single source; the
  L1 `scoring-config.json` tombstone stays.
- Manifests regenerated: the ALN inventory dropped `strings.schema.json`
  — a LIVE instance of red-team Gm1 that had already slipped past the
  literal list (4 files → 3, contentHash moved). Toy and parity-pack
  regens were byte-identical (no schema files inside). No consumer pins
  the old hash (grepped).
- `backend/config/profiles/installation-profile.schema.json` (NEW,
  OQ6 home): the ratified C1 §1 shape. Required core is
  kind/schemaVersion/profileId so harness profiles stay minimal;
  `bindings.lighting` values require `ha` (v1 drives ha only — WLED is
  schema evolution); `endpoints` interior deliberately open until C2
  consumes it; network v1 covers kit-network, venue-wifi dynamic-DNS
  fields arrive with Track-E E2.
- Tests: `tests/contract/pack/cues-schema.test.js` (26, incl. the two
  vocabulary tripwires), pack-schemas extensions (const-pin +
  fallbacks twins, guarded declared-cues walk — S4 adds the
  ≥1-declarer assertion, no-inventoried-schema assertion over all
  packs + a literal-list-can't-cover-this case),
  `tests/contract/profile/installation-profile-schema.test.js` (11),
  Python suffix-exclusion test. Counts: pack+profile contract 82/82,
  scripts pytest 74/74, config-tool 100/100, full backend suite green
  (see stage commits).

**Census correction found during build:** the repo venue cues file has
NO `trigger` key on the five operator cues — §2.1's "explicit
`trigger: null`" is wrong for this checkout (null may exist on the
venue Pi's copy). No design consequence: the schema accepts both null
and absence, and both mean manual-only.

**In-sanction calls made at build time (recorded for the reviewer):**
the engine-unread `duration` key is schema-refused (S4 drops it at
migration; behavior verbatim since nothing reads it — **REVERSED by the
stage review; see below**); clock strings pinned to
`^[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]$` (schema stricter than
`parseClockTime` is the safe direction); cue `icon` pinned to
class-name-safe characters (it renders as a CSS class key); cue-level
`routing` keys pinned to the three engine stream names.

**S1 stage review (two-axis, 2 Opus lenses, 2026-08-29) — adjudication:**

Fixed in the same stage (second commit pair):
1. **`duration` refusal REVERSED.** The spec lens disproved "nothing
   reads it": the config-tool timeline editor READS AND WRITES
   `cue.duration` (`timelineView.js:49-55` write, `:116` read for
   display length), and the D-4.7c-hardened `writeCues` would have
   refused the editor's own writes. The schema now accepts `duration`
   (number > 0, `dependentRequired` on `timeline`). S4 migrates the key
   VERBATIM instead of dropping it. This paragraph supersedes the
   in-sanction call above.
2. Plain-language (§4) breaches in three new schema descriptions
   rewritten (cues root; profile root; profile `endpoints` metaphor);
   "tier zero" replaced with the CONTEXT.md term (minimum install
   tier).
3. The game.schema `cues` description no longer states the S2 gate rule
   in the present tense.
4. Test-helper duplication extracted (`fixturePacks`/`declaringPacks`;
   one `validateMutated` per file — renamed from `mutate`, which
   returned a boolean, not a document); `os` require hoisted; PEP8
   spacing in the Python builder.

Rejected, with reasons: command/timelineEntry duplication in
cues.schema.json (forced — `additionalProperties: false` does not see
allOf-referenced properties, so composing one from the other would
refuse `at`); the mirrored suffix predicate in both builders (the
two-builder byte-parity architecture is documented and tripwired);
"speculative generality" on the profile's typed interiors (they are the
ratified C1 §1 shape, and `venue-wifi` is C1's own mode vocabulary);
the literal-name pruning in EXCLUDE (deliberate single-source refactor,
behavior pinned by tests on both sides); the empty declared-cues walk
(forward wiring; S4 adds the ≥1-declarer assertion); the un-bumped
ALNScanner `data/` pin (scanner repos are outside this slice's train;
nested pins ride the merge train — Final-cutover item 2b).

Carried to S4: the L7 ledger row lands there per §5.4 (the code has
carried the marker since S1); `duration` migrates verbatim.

### S2 — gate (DONE 2026-08-29)

Built test-first in three cycles: the validator module, the packService
wiring, then the engine hardening. Each cycle wrote its failing tests
before its code.

**Landed:**
- `backend/src/gameRules/cueValidation.js` (NEW): `validateCuesBlock`
  — rules 1-7 as pack-internal PURE reads (no services, no logger, no
  I/O; the dep-free seam the config-tool imports at S4). The module
  OWNS the row-2.22 vocabulary: `CUE_TRIGGER_EVENTS` (16),
  `CONDITION_OP_NAMES` (7), `CLOCK_PATTERN`, and `CUE_ACTIONS` — the
  cue-action vocabulary with required payload fields, pinned at build
  time as the show-control subset of gm:command (24 actions: sound,
  lighting-by-role, video transport + queue, music, display,
  audio routing/volume). Deliberately excluded: session lifecycle,
  score intervention, and transaction surgery (the auth floor — pack
  data never drives operator-only functions), plus admin/maintenance
  actions (system, bluetooth pairing, held-item management, per-client
  scoreboard paging, health probes, direct cue:fire — chaining rides
  standing triggers on `cue:completed`).
- packService: `ENGINE_CAPABILITIES` grew the ratified trio
  (`cues.standing`, `cues.timeline`, `lighting.roles`);
  `_loadDeclaredCues` mirrors the strings loader (canonical filename,
  header form, kind/schemaVersion checks); the gate block runs after
  the strings block, file-less rules (5 and the rule-6 requires lint)
  included. Refusals join the existing CAPABILITY GATE message in the
  two-flavor language, wording-pinned in tests both ways.
- Engine hardening: `loadCues` refuses duplicate cue ids (the Map
  silently last-won); `findMatchingClockCues` skips-and-warns on an
  unparseable clock string instead of throwing out of the tick
  listener once per second (the restore path already guarded).
- S1 consistency fix folded in: the cues sidecar `schemaVersion` is
  the PACK-WIDE version (const 2, strings precedent) — S1 had minted a
  per-sidecar series at 1.
- Tests: `tests/unit/gameRules/cueValidation.test.js` (36: per-rule
  refusal twins, both ALN guard cues green at the validator level, the
  rule-3 exemption pinned, two-flavor language pins, and five
  tripwires — validator↔standingEvaluator events + ops,
  validator↔schema enums + clock pattern, every cue-action a real
  executeCommand case via the root-CLAUDE-blessed source grep,
  validator payload fields ⊇ engine REQUIRED_PAYLOAD_FIELDS with
  lighting exempt by design). packService gate suite +11 (guard cues
  green AT THE GATE, benign emptiness with zero cue warns, flavor
  wording pins, file-less rule 5/6, canonical-filename and
  declared-but-broken refusals). cueEngineService +2 (dupe refusal,
  tick guard with a healthy cue still firing past a poisoned one).

**Observed, not changed (for the record):** `fireCue` counts a command
whose action `executeCommand` does not know as COMPLETED — the
`default:` case returns `{success:false}` and `result.success` is
never checked. Pre-existing behavior; the gate now makes it
unreachable from pack content, and the venue file retires at S4. If it
survives S6 review it belongs in the backlog, not this slice.

**S2 stage review (two-axis, 2 Opus lenses, 2026-08-29) — adjudication:**

Fixed in the same stage (second commit pair):
1. (standards — real bug) the `CUE_ACTIONS` lookup used a truthy index:
   an action named `constructor` resolved through the prototype chain
   and threw a raw TypeError out of the gate — the exact C11 class the
   neighboring groups block documents. Now `Object.hasOwn`, with a
   refusal twin.
2. (spec — the real hole) rule-2 payload validation was presence-only:
   `{role: 7}`, `{volume: null}`, `{position: "soon"}` all passed.
   `CUE_ACTIONS` is now action → {field: type} and the gate checks
   non-empty-string / finite-number / boolean. This also resolved the
   standards lens's shape complaint (the `{requiredFields: []}` wrapper
   objects are gone).
3. (spec) the module header misquoted the floor: it wrote "session
   lifecycle, score intervention, and transaction surgery" where
   CONTEXT.md §6's floor is session lifecycle, SHOW CONTROL, and score
   intervention. Rationale rewritten: the floor governs WHO may act;
   the excluded actions are game-state interventions a standing cue
   would fire with no operator in the loop.
4. (standards) orphaned JSDoc unstacked (the strings loader has its
   doc back); the dead `cueId` parameter dropped; the third duplicated
   tokens read extracted to `_readPackTokens()` (also the spec lens's
   read-twice nit); metaphor phrasing in this record replaced.

Recorded, not changed:
- Rule 6 is built as a USAGE-derived lint (standing triggers, timelines,
  or roles actually used → the matching id required), which is narrower
  than D-4.1's by-declaration wording: a manual-only, flat,
  lighting-free cues pointer needs no capability ids. No id for "manual
  flat cues" exists in the ratified trio, and the residual class is
  exactly D-4.1's accepted exposure. Pinned by test.
- The sceneId-in-pack-payload refusal is a deliberate corollary of
  D-4.2's roles-only clause, now recorded as such.
- The unknown-op refusal stays flavor-i against the standards lens's
  consistency argument: D-4.3 classes rule 7 "flavor-i unless noted"
  and notes only 7b's trigger event as flavor-ii. The ops are a closed
  seven-entry set; an unknown op is a typo, not an engine-growth
  request.

### S3 — resolver + profile (DONE 2026-08-29)

Opened with the AsyncAPI contract commit (Dm7 disposition honored):
the `role` payload alternative for `lighting:scene:activate`, with the
resolution order and the GM bypass documented, plus a role-form
example.

**Landed:**
- `backend/src/services/profileService.js` (NEW): loads ONE profile at
  boot, frozen (packService template — pre-activation reads fall
  through to live disk for selective-init harnesses); `PROFILE_PATH`
  seam with the loud warn-once; v1 reads kind, schemaVersion,
  profileId, forPack, and bindings.lighting ONLY. A missing or broken
  venue profile warns loudly and resolves every role unbound — the
  degrade class never kills the boot. `getLightingBinding` drives the
  `ha` provider only (D-4.5 skip clause) and is prototype-chain safe.
- `backend/config/profiles/aln-full-kit.json` (NEW): the real venue
  document — all seven OQ1 roles bound to the confirmed HA scene ids.
  Deliberately carries NO audio section (D-4.4: no duplication of
  routing.json) and no invented network values. Contract-validated
  against the schema; the unit suite pins the OQ1 table verbatim.
- executeCommand: role → sceneId normalization at the TOP, before the
  REQUIRED_PAYLOAD_FIELDS loop (red-team R1). Resolution order:
  profile binding, then the pack's lightingRoleFallbacks (each
  fallback-resolved FIRE warns loudly — ledger L7), else
  `{success:false, "unresolvable lighting role 'x'"}`.
  Concrete-sceneId payloads bypass entirely. validateCommand mirrors
  the normalization silently (a pre-show sweep is not a fire — no L7
  warn spam).
- **Scope call (recorded):** D-4.4 promises the unresolvable role
  "fails through the existing cue:error channel", but executeCommand
  catches its own throws into `{success:false}` and BOTH cue dispatch
  paths counted such results as COMPLETED (the S2 observed-not-changed
  swallow). The promise upgrades the fix into S3 scope: the simple-cue
  loop and the timeline entry executor now route `success:false` into
  failedCommands + cue:error. Side effect, deliberate: every rejected
  command in a cue (service-down, missing field, unknown action) is now
  visible on cue:error instead of silently completing — strictly more
  honest, and the failedCommands array existed for exactly this.
- app.js: `activateProfile()` beside `activatePack()` at boot.
- Tests: profileService unit (11, incl. the OQ1 drift pin against the
  real profile), executor normalization pins (7: bound/fallback-warn/
  unresolvable/prototype-chain/GM-bypass/validate-mirror-silent/
  validate-unresolvable), cue-path visibility pins (simple +
  timeline-with-position), the held-release single-site property pin
  (the role payload reaches executeCommand in ORIGINAL role form at
  release time), the L7 BUILD-TIME tripwire (`.ha` projection,
  non-ha skip, vacuous until S4 authors the fallbacks), and the
  always-on non-E2E integration proof (real profileService + real
  executeCommand + stubbed lighting; D-4.8) — 4 cases incl. the
  PACK_PATH fallback path.

**S3 stage review (two-axis, 2 Opus lenses, 2026-08-29) — adjudication:**

The spec lens found every §5.3 deliverable present, nothing wrong, and
ruled the cue:error scope call FAITHFUL ("without the change the
promise is unfulfillable"; special-casing lighting failures would have
been the arbitrary choice). Fixed in the same stage (third commit):
1. (standards — doc registry) backend/CLAUDE.md gained the
   profileService row and the role-form lighting entry in the admin
   command table.
2. (standards — the retrofit rule's trigger) CONTEXT.md said "no code
   reads PROFILE_PATH today" and "the mechanism lands with the slice-4
   build" — both stale the moment S3 landed. Both entries fixed on the
   spot with the edit noted, per process.md §4.
3. (spec — the L7 bookkeeping conflict) D-4.5 says the ledger row
   "lands with the code" while §5.4 slots it at S4; the resolver code
   path shipped in S3, so the row is RECORDED NOW in PHASE3-STATUS
   (L7 in-queue, retires at C4; L8 stays reserved for the S4 pack
   authoring).
4. (standards — accepted judgement calls) `packService.
   getLightingRoleFallback(role)` added as the normalized accessor
   (getScoringRules idiom; commandExecutor no longer digs raw pack
   shape) with its own unit twin; profileService gained drift-warn
   parity with packService (one loud warn when the profile changes on
   disk after activation) and `activateProfile` returns the identity;
   the nullish guards in both cue paths made consistent
   (`result?.success` / `result?.data`).

Rejected, with reasons: factoring the two success:false blocks into a
shared helper (two files, two error shapes — locality wins over six
lines); the five lighting:scene:activate sites in commandExecutor
(inherent to its table design); removing `getProfileInfo` (the C2
preflight and health surfacing consume profile identity next — kept,
now also exercised by activateProfile's return).

### S4 — cutover (DONE 2026-08-29)

One train on the slice branches (TokenData `5ff057b`, parent `726b552`
engine + `c8a2c1c` config-tool):

**Landed:**
- ALN pack authored: `cues.json` with all 10 cues, verbatim behavior.
  OQ2 renames applied (warning-90min/60min/30min/15min + endgame;
  labels preserved; the two e2e fixture cue ids untouched). Lighting
  payloads carry the OQ1 roles; the ENDGAME bluetooth target migrated
  verbatim (OQ7a → ledger L8 recorded); `duration` kept (S1 review
  ruling). game.json: cues pointer, seven lightingRoles, the
  lightingRoleFallbacks block mirroring the profile (the L7 tripwire is
  now live on real data), requires + the capability trio. Manifest
  regenerated.
- Engine re-point: `packService.getCues()` joins the activation
  snapshot (frozen; null = benign emptiness; pre-activation live-read;
  unit-pinned). app.js and systemReset load from it — a reset reloads
  the SAME frozen snapshot, never mid-run pack edits. The venue
  `config/environment/cues.json` is DELETED, grep-clean in backend.
- Preflight checklist: the three cue checks rewritten pack-aware.
  Found in passing: the old snippets read a `cue.actions` key that
  never existed in the real file (`commands`/`timeline`); the rewrites
  use the real shapes.
- E2E: the four cue-pinning flows (07d-03, 22, 30,
  admin-state-reactivity) ALN-pack-PINNED via explicit `packPath`
  (07c precedent). Verified on this machine: Tier L 17 passed /
  0 failed / 0 flaky (hardware tiers capability-skip loudly).
  Integration suite 348/348 after the re-point.
- config-tool (DELEGATED BUILD — the first under process.md rule 2's
  amendment; a Sonnet agent, brief per §3, report verified
  independently: suite rerun 109/109, grep-clean rerun, writeCues diff
  read): cuesPath → the pack; header form flows through the six
  censused consumers plus three more the sweep found (preset-import
  gate, preset validators, pack identity); writeCues in the
  writeScoring shape calling the SAME validateCuesBlock the gate runs;
  presets stripped of cues at capture/apply/import; the lighting UI
  authors ROLES (role-picker fed from GET /config pack.lightingRoles).

**S4 stage review (two-axis, 2 Opus lenses, 2026-08-29) — adjudication:**

The standards lens ran a normalized deep compare of the authored pack
against the deleted venue file: ZERO deltas beyond the ruled renames,
the role mapping, and the header — the migration is byte-faithful. The
spec lens ran the real gate on the real pack (0 problems) and found
every D-4.7 item MET, one PARTIAL. Fixed in the same stage:
1. (standards — BLOCKING, in the delegated code) writeCues's rollback
   fabricated `{}` into a previously-ABSENT cues.json on
   manifest-rebuild failure (`_readJson` returns `{}` on ENOENT), a
   file the gate then refuses. The snapshot is now existence-aware:
   rollback DELETES a first-write file instead. Regression test added
   (config-tool 110/110).
2. (standards — delegated seam gap) the show-control page built its
   PUT payload without the header when the pack had no cues file, so
   the tool could never author a FIRST cues.json. The page now seeds
   `{kind, schemaVersion}`.
3. (spec — D-4.7f partial) the preflight check's PROSE still promised
   the retired bare-array/wrapper tolerance and the old output line;
   rewritten. Adjacent retrofit: config-tool README's two
   scoring-config.json rows (stale since ledger L1) fixed on the spot.
4. (standards — minor) `getCues` guard polarity aligned to its sibling
   getters; the trailing restating comment trimmed; two README run-on
   sentences split (§4 standard).

Recorded, not changed: the dead `getScenes`/`GET /scenes` pair stays
(adjudicated with the agent's flag #4 — a possible future direct-HA
surface; not this slice's deletion to make). The census's
"trigger: null" line stays corrected by the §9 S1 record.

### S5 — toy second consumer (DONE 2026-08-29)

**Landed (parent `551ce49`):**
- Toy pack: `cues.json` with two quickFire manual cues at ONE action
  class each (R6 — a multi-action cue is held whole when any service is
  down); `lightingRoles` vault-alarm/all-clear; a deliberately PARTIAL
  `lightingRoleFallbacks` (vault-alarm bridged, all-clear profile-only —
  proves both legal states); `requires` gains `lighting.roles` (the
  usage-derived lint asks for nothing else: manual flat cues need no
  cues.standing/cues.timeline); manifest hardware.stack claims sound +
  lighting; manifest regenerated.
- The `profilePath` seam in test-server's startOrchestrator
  (E2E_PROFILE_PATH default, caller wins) — pinned per-call beside
  packPath, exactly the Rm7 shape. Static `toy-test-rig` profile
  fixture.
- NEW flow `toy-pack-lighting-roles`: capability-gated on lighting; the
  toy pack activates through the same gate and exposes both quick-fire
  summaries; and the core proof — HA scene ids are machine state, so
  the flow DISCOVERS a real scene from the running system, binds the
  toy role to it in a runtime-written temp profile, restarts through
  the seam, and fires the cue asserting ZERO failedCommands and zero
  cue:error (the S3 visibility fix makes that assertion load-bearing).
  Run here: 2 passed / 0 failed, lighting live via the HA container.
- Builder hardening found in-stage: a jest run from a pack cwd made
  winston create `logs/` INSIDE the toy pack, which the inventory
  picked up (caught by the Python byte-parity suite). Both builders now
  skip `logs/` — the contamination class can never enter served
  inventory.

**Dual-pack gate, toy leg:** full Tier L with E2E_PACK_PATH=toy-heist —
**116 passed / 0 failed / 0 flaky** (60 capability-gated loud skips;
Tier H 4/0/18), behind unit+contract 2582/2582. The four ALN-pinned
flows ran their ALN behavior inside the toy leg (the D-4.7e pins doing
their job). The ALN default leg runs at S6 with the slice close.

**Delegated-agent judgement calls, adjudicated:**
1. writeCues refuses on a missing/empty game.json — ACCEPTED (closes a
   real gap: validateCuesBlock's null-gameConfig early-return would
   have let a pack-less write through; writeScoring symmetry).
2. The old "cue must have quickFire and/or trigger" tool rule dropped —
   ACCEPTED, and the agent's "permanently unreachable" worry is wrong:
   `cue:fire` reaches any cue by id; quickFire only controls grid
   visibility. The old rule was over-strict.
3. Preset import keeps a legacy `cues` section as inert baggage in the
   stored preset file (never written to the pack) — ACCEPTED.
4. `getScenes`/`GET /scenes` left in place, now unused by cue
   authoring — ACCEPTED (possible future direct-HA surface; not this
   slice's call to delete).
5. `lightingRoles` rides the GET /config `pack` sub-object — ACCEPTED.
