# Capability census — evidence ground truth

CS-era fact-finding for the UX foundation's capability catalog. The
foundation (`docs/plans/2026-09-04-ux-foundation.md` §4b) rules: "census
FIRST (owner-ruled design exercise: enumerate every hardware surface the
system allows; downstream IA/UX designed against it); BS.1 vocabulary
endpoint is the seed data." Owner-ruled 2026-09-04. This document is that
census — an exhaustive, code-cited enumeration of everything the engine
can drive or accept, i.e. the **capability catalog**: "everything the
platform can drive, browsable — the palette a designer composes a venue
from" (`CONTEXT.md` §5b). It is fact-finding, not design: no IA, no
editor mockups, no row-grouping decisions beyond the domain groupings the
code itself already uses.

Vocabulary is drawn as-is from `CONTEXT.md` §2 (engine ↔ pack contract),
§4 (show control), §5 (venue, kit, installation), and §5b (production
lifecycle). Every row below cites the **defining site** — the file:line
where the capability, action, need-kind, or field is actually declared
in code or schema — never a doc that merely mentions it.

All paths are relative to `/home/user/ALN-Ecosystem/` unless the citation
names a different repo root explicitly (the `ALN-TokenData/` submodule
paths are given in full).

---

## 1. ENGINE_CAPABILITIES and ENGINE_MODE_CAPS

Both live in `backend/src/services/packService.js`. Per `CONTEXT.md` §2:
"**Capability.** A named ability of the engine, listed in
`ENGINE_CAPABILITIES`... A pack lists what it needs in `requires`. If
the engine lacks a required capability, the gate refuses and names it."

### 1a. ENGINE_CAPABILITIES (8 ids)

The `Set` a pack's `game.json` `requires` array is checked against at
activation (`backend/src/services/packService.js:700`:
`gameConfig.requires.filter((cap) => !ENGINE_CAPABILITIES.has(cap))`).
An unknown id refuses activation with "pack requires unsupported engine
capabilities".

| # | Capability id | file:line | What it gates |
|---|---|---|---|
| 1 | `scoring.tabular` | `backend/src/services/packService.js:53` | A pack declaring this requires the engine's `baseValues × typeMultipliers` scoring table shape (`gameRules/scoring.js`). |
| 2 | `groupRules.all` | `backend/src/services/packService.js:54` | All-of-group completion detection (`groupRules.type: 'all'`, gated separately at `packService.js:727`). |
| 3 | `duplicatePolicy.once` | `backend/src/services/packService.js:55` | FCFS session-scoped claim rejection (`gameRules/duplicatePolicy.js`; `duplicatePolicy.claim: 'once'`, gated at `packService.js:711`). |
| 4 | `cues.standing` | `backend/src/services/packService.js:56` | Event/clock-triggered standing cues (slice 4) — declaring this is required whenever the pack ships a `cues.json` with standing cues (enforced by `validateCuesBlock`, `gameRules/cueValidation.js`). |
| 5 | `cues.timeline` | `backend/src/services/packService.js:57` | Compound cue timelines, the three-segment clock model (decision E5). |
| 6 | `lighting.roles` | `backend/src/services/packService.js:58` | Role-addressed lighting: `game.json` `lightingRoles` + the installation profile's `bindings.lighting` resolution path (`commandExecutor.js` `_resolveLightingRole`, line 896). |
| 7 | `surfaces.select` | `backend/src/services/packService.js:59` | A pack declaring a `game.json` `surfaces` block (idle-loop channel selection, scoreboard enable/parameterize) must list this — enforced by `_validateSurfacesBlock` (`packService.js:958`). |
| 8 | `theme.identity` | `backend/src/services/packService.js:60` | The minimal visual-identity sidecar: semantic colors, rating display/glyphs, scoreboard accent (`theme.json`, `THEME_SCHEMA_VERSION`). |

Ids are append-only (slice-1 D1): adding one is a minor engine-version
bump, removing one a major bump.

### 1b. ENGINE_MODE_CAPS (4 dimensions)

`backend/src/services/packService.js:78-83`. Per-mode flag **values**
the engine can drive — the `game.schema.json` fields themselves are OPEN
strings (schema-valid as any string); these `Set`s are the gate that
refuses a schema-valid-but-undrivable value at activation
(`packService.js:961-979`, "Mode drivability... every declared mode's
flag VALUES must be in the engine's implemented sets").

| Dimension | file:line | Allowed values | Mode field gated |
|---|---|---|---|
| `scoringPolicy` | `backend/src/services/packService.js:79` | `standard`, `none` | `modes[].scoringPolicy` (checked `packService.js:964`) |
| `entityRole` | `backend/src/services/packService.js:80` | `ledger`, `attribution` | `modes[].entityRole` (checked `packService.js:967`) |
| `surface` | `backend/src/services/packService.js:81` | `scoreboard-rankings`, `scoreboard-evidence`, `none` | `modes[].displayBehavior.surface` (checked `packService.js:970-973`; absent normalizes to `'none'`) |
| `claims` | `backend/src/services/packService.js:82` | `consuming`, `non-consuming` | `modes[].claims` (checked `packService.js:976-979`; absent normalizes to `'consuming'`) |

**Count:** 8 `ENGINE_CAPABILITIES` rows + 4 `ENGINE_MODE_CAPS` dimension
rows = 12 total lines in this section (not subject to the item 3/8 count
gate below, since the task scopes that gate to items 3 and 8 only).

---

## 2. The 8 `serviceHealthRegistry` services

`KNOWN_SERVICES` array: `backend/src/services/serviceHealthRegistry.js:14`
— `['vlc', 'music', 'sound', 'bluetooth', 'audio', 'lighting', 'gameclock', 'cueengine']`.
Per `CONTEXT.md` §5: "**Endpoints vs stack.** ... the *stack* is the
orchestrator's service software. If the orchestrator is present, every
stack service is expected to run." These 8 are that stack.

| # | Service id | Driving service file | Physical/software thing it drives | Health-report citation |
|---|---|---|---|---|
| 1 | `vlc` | `backend/src/services/vlcMprisService.js` | VLC video player, controlled via D-Bus MPRIS (`destination: 'org.mpris.MediaPlayer2.vlc'`, `vlcMprisService.js:16`) | `vlcMprisService.js:424` (`registry.report('vlc', 'healthy', 'MPRIS signal received')`) |
| 2 | `music` | `backend/src/services/musicService.js` | MPD (Music Player Daemon) over a Unix socket via the `mpd2` client (`require('mpd2')`, `musicService.js:96`) | `musicService.js:232` (`require('./serviceHealthRegistry').report('music', connected ? 'healthy' : 'down', message)`) |
| 3 | `sound` | `backend/src/services/soundService.js` | PipeWire `pw-play` CLI wrapper for one-shot sound effects (`soundService.js:1-4` header; probe at `soundService.js:44`) | `soundService.js:45` / `:48` |
| 4 | `bluetooth` | `backend/src/services/bluetoothService.js` | BlueZ, via the `bluetoothctl` CLI (`bluetoothService.js:3-9` header; e.g. `bluetoothctl show` at `bluetoothService.js:117`) | `bluetoothService.js:77` / `:86` / `:96` / `:98` / `:105` |
| 5 | `audio` | `backend/src/services/audioRoutingService.js` | PipeWire audio routing/sink management via the `pactl` CLI (`audioRoutingService.js:1-13` header) | `audioRoutingService.js:159` / `:162` |
| 6 | `lighting` | `backend/src/services/lightingService.js` | Home Assistant scenes via its REST + WebSocket API (`lightingService.js:1-7` header) | `lightingService.js:114` / `:116` / `:207` / `:254` |
| 7 | `gameclock` | `backend/src/services/gameClockService.js` | The game clock — an in-process `setInterval(1000)` master time authority, no external process (`gameClockService.js:1-4` header) | `gameClockService.js:17` (always `'healthy'` at construction — "In-process timer") |
| 8 | `cueengine` | `backend/src/services/cueEngineService.js` | The cue engine — in-process standing/manual cue evaluation and firing (`cueEngineService.js:1-19` header, facade over `StandingEvaluator`/`TimelineRuntime`/`HeldItemsStore`) | `cueEngineService.js:142` (`'healthy'` once cues load) |

`gameclock` and `cueengine` never fail a live health check (in-process,
no external dependency) — `serviceHealthRegistry.js:120` comment: "//
gameclock + cueengine are always healthy (in-process) — skip" inside
`startRevalidation()`'s `HEALTH_CHECKS` map (`serviceHealthRegistry.js:113-121`).

---

## 3. gm:command action inventory — every case in `commandExecutor.js`

Ground truth: `grep "case '" backend/src/services/commandExecutor.js`.
The file contains **two** switch statements: `executeCommand()`'s
dispatch switch (lines 199-868, 59 case labels covering 47 distinct
actions after de-duplicating fallthrough labels) and `validateCommand()`'s
pre-show resource-existence switch (lines 922-955, 5 case labels, all of
which repeat actions already dispatched above — the second switch adds
zero new action names, only a "does the referenced file/scene/sink/
playlist exist" check for 5 of the 47).

### 3a. `executeCommand()` dispatch switch (59 case labels / 47 actions)

**Session** (6 case labels / 6 actions)

| Action | file:line |
|---|---|
| `session:create` | `backend/src/services/commandExecutor.js:202` |
| `session:start` | `backend/src/services/commandExecutor.js:217` |
| `session:pause` | `backend/src/services/commandExecutor.js:224` |
| `session:resume` | `backend/src/services/commandExecutor.js:231` |
| `session:end` | `backend/src/services/commandExecutor.js:238` |
| `session:addTeam` | `backend/src/services/commandExecutor.js:245` |

**Video** (8 case labels / 8 actions)

| Action | file:line |
|---|---|
| `video:play` | `backend/src/services/commandExecutor.js:276` |
| `video:pause` | `backend/src/services/commandExecutor.js:286` |
| `video:stop` | `backend/src/services/commandExecutor.js:296` |
| `video:skip` | `backend/src/services/commandExecutor.js:307` |
| `video:seek` | `backend/src/services/commandExecutor.js:317` |
| `video:queue:add` | `backend/src/services/commandExecutor.js:332` |
| `video:queue:reorder` | `backend/src/services/commandExecutor.js:344` |
| `video:queue:clear` | `backend/src/services/commandExecutor.js:356` |

**Display** (4 case labels / 4 actions)

| Action | file:line |
|---|---|
| `display:idle-loop` | `backend/src/services/commandExecutor.js:365` |
| `display:scoreboard` | `backend/src/services/commandExecutor.js:366` |
| `display:return-to-video` | `backend/src/services/commandExecutor.js:367` |
| `display:status` | `backend/src/services/commandExecutor.js:401` |

**Scoreboard paging** (3 case labels / 3 actions)

| Action | file:line |
|---|---|
| `scoreboard:page:next` | `backend/src/services/commandExecutor.js:412` |
| `scoreboard:page:prev` | `backend/src/services/commandExecutor.js:418` |
| `scoreboard:page:owner` | `backend/src/services/commandExecutor.js:424` |

**Scoring** (2 case labels / 2 actions)

| Action | file:line |
|---|---|
| `score:adjust` | `backend/src/services/commandExecutor.js:437` |
| `score:reset` | `backend/src/services/commandExecutor.js:455` |

**Transaction** (2 case labels / 2 actions)

| Action | file:line |
|---|---|
| `transaction:delete` | `backend/src/services/commandExecutor.js:470` |
| `transaction:create` | `backend/src/services/commandExecutor.js:492` |

**System** (1 case label / 1 action)

| Action | file:line |
|---|---|
| `system:reset` | `backend/src/services/commandExecutor.js:520` (throws — actually executed in `adminEvents.js` due to mutex/io needs) |

**Bluetooth** (6 case labels / 6 actions)

| Action | file:line |
|---|---|
| `bluetooth:scan:start` | `backend/src/services/commandExecutor.js:527` |
| `bluetooth:scan:stop` | `backend/src/services/commandExecutor.js:535` |
| `bluetooth:pair` | `backend/src/services/commandExecutor.js:542` |
| `bluetooth:unpair` | `backend/src/services/commandExecutor.js:543` |
| `bluetooth:connect` | `backend/src/services/commandExecutor.js:544` |
| `bluetooth:disconnect` | `backend/src/services/commandExecutor.js:545` |

**Audio** (2 case labels / 2 actions)

| Action | file:line |
|---|---|
| `audio:route:set` | `backend/src/services/commandExecutor.js:562` |
| `audio:volume:set` | `backend/src/services/commandExecutor.js:853` |

**Lighting** (2 case labels / 2 actions)

| Action | file:line |
|---|---|
| `lighting:scene:activate` | `backend/src/services/commandExecutor.js:575` |
| `lighting:scenes:refresh` | `backend/src/services/commandExecutor.js:583` |

**Sound** (2 case labels / 2 actions)

| Action | file:line |
|---|---|
| `sound:play` | `backend/src/services/commandExecutor.js:592` |
| `sound:stop` | `backend/src/services/commandExecutor.js:613` |

**Cue** (6 case labels / 6 actions)

| Action | file:line |
|---|---|
| `cue:fire` | `backend/src/services/commandExecutor.js:622` |
| `cue:enable` | `backend/src/services/commandExecutor.js:635` |
| `cue:disable` | `backend/src/services/commandExecutor.js:644` |
| `cue:stop` | `backend/src/services/commandExecutor.js:655` |
| `cue:pause` | `backend/src/services/commandExecutor.js:665` |
| `cue:resume` | `backend/src/services/commandExecutor.js:675` |

**Held items** (4 case labels / 4 actions)

| Action | file:line |
|---|---|
| `held:release` | `backend/src/services/commandExecutor.js:685` |
| `held:discard` | `backend/src/services/commandExecutor.js:700` |
| `held:release-all` | `backend/src/services/commandExecutor.js:715` |
| `held:discard-all` | `backend/src/services/commandExecutor.js:728` |

**Music** (10 case labels / 10 actions)

| Action | file:line |
|---|---|
| `music:play` | `backend/src/services/commandExecutor.js:743` |
| `music:pause` | `backend/src/services/commandExecutor.js:744` |
| `music:stop` | `backend/src/services/commandExecutor.js:745` |
| `music:next` | `backend/src/services/commandExecutor.js:746` |
| `music:previous` | `backend/src/services/commandExecutor.js:747` |
| `music:setVolume` | `backend/src/services/commandExecutor.js:755` |
| `music:setShuffle` | `backend/src/services/commandExecutor.js:764` |
| `music:setLoop` | `backend/src/services/commandExecutor.js:772` |
| `music:loadPlaylist` | `backend/src/services/commandExecutor.js:780` |
| `music:seek` | `backend/src/services/commandExecutor.js:789` |

**Service health** (1 case label / 1 action)

| Action | file:line |
|---|---|
| `service:check` | `backend/src/services/commandExecutor.js:805` |

### 3b. `validateCommand()` resource-existence switch (5 case labels, 0 new actions)

Pre-show verification only — checks that the referenced file/scene/
sink/playlist exists for 5 of the 47 actions already listed above.

| Action re-checked | file:line | Resource checked |
|---|---|---|
| `sound:play` | `backend/src/services/commandExecutor.js:923` | `soundService.fileExists(payload.file)` |
| `video:queue:add` | `backend/src/services/commandExecutor.js:927` | `videoQueueService.videoFileExists(payload.videoFile)` |
| `lighting:scene:activate` | `backend/src/services/commandExecutor.js:931` | `lightingService.sceneExists(sceneId)` (role-normalized first) |
| `audio:route:set` | `backend/src/services/commandExecutor.js:947` | `audioRoutingService.sinkExists(payload.sink)` |
| `music:loadPlaylist` | `backend/src/services/commandExecutor.js:951` | `musicService.getPlaylist(payload.playlistId)` |

### Row-count reconciliation for item 3

Domain-by-domain case-label counts: Session 6, Video 8, Display 4,
Scoreboard 3, Scoring 2, Transaction 2, System 1, Bluetooth 6, Audio 2,
Lighting 2, Sound 2, Cue 6, Held 4, Music 10, Service 1 = **59** (matches
`executeCommand`'s switch). Plus the 5 `validateCommand` resource-check
case labels = **64 total**, matching `grep -c "case '"` exactly (see
Count verification section).

---

## 4. Pack need kinds — `collectPackNeeds` (`backend/src/gameRules/packNeeds.js`)

Pure aggregator: walks one pack snapshot `{game, cues, manifest}` into a
typed list `resolve()` (`gameRules/resolution.js`) turns into verdicts —
the "ONE TRUTH" of `CONTEXT.md` §2's "One truth, three loops". Per
`CONTEXT.md` §5b: "**Tech rider.** The pack's declared hardware needs
presented human-readably for the venue technician... Derived
(collectPackNeeds), never a second source of truth."

| # | `kind` | file:line | Derived from (pack field) | Notes |
|---|---|---|---|---|
| 1 | `service` | `backend/src/gameRules/packNeeds.js:22` | `pack-manifest.json` `hardware.stack.<id>` | Stack service need (e.g. `vlc`, `music`); `onAbsent` from `decl.onAbsent`, default `'degrade'`. |
| 2 | `endpoint` | `backend/src/gameRules/packNeeds.js:32` | `pack-manifest.json` `hardware.endpoints.<id>` | Physical device need (speaker, light, display); `onAbsent` from `decl.onAbsent`, default `'degrade'`. |
| 3 | `lighting-role` | `backend/src/gameRules/packNeeds.js:43` | `game.json` `lightingRoles[]` | One need per declared role; carries a `fallback` (from `game.json` `lightingRoleFallbacks`) or `null`. |
| 4 | `surface-channel` | `backend/src/gameRules/packNeeds.js:57` | `game.json` `surfaces.idleLoop` | Only emitted when `idleLoop` is a non-null channel name (a null channel is a surface opt-out, not a need). |
| 5 | `capability` | `backend/src/gameRules/packNeeds.js:65` | `game.json` `requires[]` | One need per declared `ENGINE_CAPABILITIES` id the pack requires (§1a above). |
| 6 | `sound` | `backend/src/gameRules/packNeeds.js:93` | `cues.json` cue/timeline-step commands where `action === 'sound:play'` and `payload.file` is set | Cue-implied media file need; sources list every cue that references the file. |
| 7 | `lighting-role-ref` | `backend/src/gameRules/packNeeds.js:96` | `cues.json` cue/timeline-step commands where `action === 'lighting:scene:activate'` and `payload.role` is set | Cue-implied role reference (distinct from `lighting-role`, which comes from the declared `lightingRoles[]` list itself). |
| 8 | `device-class` | `backend/src/gameRules/packNeeds.js:104` | `pack-manifest.json` `hardware.deviceClasses[]` | Only emitted when `decl.min > 0` (`min: 0` asks nothing of the venue — `packNeeds.js:99-100`); carries `min`. |

All 8 kinds are exhaustive — `collectPackNeeds` (`packNeeds.js:15-113`)
pushes to `needs[]` at exactly these 8 call sites and nowhere else.

---

## 5. Installation-profile surface — `installation-profile.schema.json`

`backend/config/profiles/installation-profile.schema.json`. Per
`CONTEXT.md` §1 ("profile"): "*Installation profile.* The venue document
defined by C1: lighting bindings, installed endpoints, network posture."
The v1 engine reads a NAMED SUBSET (per the schema's own `description`
at line 5): "The v1 engine reads `kind`, `schemaVersion`, `profileId`,
`forPack`, `bindings.lighting`, and `bindings.surfaces` (slice 6);
nothing else. The other sections are the ratified C1 shape... typed to
catch authoring typos."

| Field (path) | file:line | Type / allowed values | v1-engine-read? |
|---|---|---|---|
| `kind` | `installation-profile.schema.json:10-12` | `const: "installation-profile"` | Yes |
| `schemaVersion` | `installation-profile.schema.json:13-15` | `const: 1` | Yes |
| `profileId` | `installation-profile.schema.json:16-19` | string, pattern `^[a-z0-9][a-z0-9-]*$` (required) | Yes |
| `label` | `installation-profile.schema.json:20-23` | string, minLength 1 | No (typo-catch only) |
| `version` | `installation-profile.schema.json:24-28` | integer ≥ 1, bumped on every save (F-TOOL-12) | No |
| `forPack` | `installation-profile.schema.json:29-33` | string; optional pack pin — tooling warns on mismatch, never refuses | Yes |
| `network.mode` | `installation-profile.schema.json:39-41` | enum `["kit-network", "venue-wifi"]` | No (C2/C3 consume it) |
| `network.kitNetwork.ssid` | `installation-profile.schema.json:46-49` | string | No |
| `network.kitNetwork.orchestratorIp` | `installation-profile.schema.json:50-53` | string | No |
| `network.kitNetwork.orchestratorName` | `installation-profile.schema.json:54-57` | string | No |
| `network.kitNetwork.localDnsOverride` | `installation-profile.schema.json:58-60` | boolean | No |
| `orchestrator` | `installation-profile.schema.json:65-68` | boolean; "The stack is ONE switch... `true`: every stack service is expected live, and a missing one is a FAULT. `false`: the minimum install tier" | No (C2/C3 consume it) |
| `endpoints` | `installation-profile.schema.json:69-72` | `type: object` — interior OPEN in v1 ("pinned when resolution becomes the consumer") | No |
| `bindings.lighting.<role>.ha` | `installation-profile.schema.json:78-95` | object, `propertyNames` pattern `^[a-z0-9][a-z0-9-]*$`; each value requires `ha` (string, minLength 1) — a concrete Home Assistant scene id | **Yes** |
| `bindings.surfaces.<channel>.file` | `installation-profile.schema.json:96-114` | object, same key pattern; each value requires `file` (string, minLength 1) — a concrete media filename resolved against the orchestrator's video dir | **Yes** |
| `audio.routes` | `installation-profile.schema.json:122-128` | object of string values | No |
| `audio.ducking[]` | `installation-profile.schema.json:129-155` | array of `{when, duck, to, fadeMs?}` (`when`/`duck` strings, `to` number 0-100, `fadeMs` number ≥ 0) | No |
| `env` | `installation-profile.schema.json:158-164` | object, values `string \| null`; "the venue-owned slice of `.env`... `null` = use the engine default" | No |

`additionalProperties: false` at the top level (`installation-profile.schema.json:8`)
and inside `bindings` (`:76`) — the schema is closed; nothing beyond
this table can appear in a valid profile. Confirmed by the shipped
instance `backend/config/profiles/aln-full-kit.json:1-22`, which
populates `kind`, `schemaVersion`, `profileId`, `label`, `version`,
`forPack`, `orchestrator`, `bindings.lighting` (7 roles), and
`bindings.surfaces` (1 channel, `aln-idle`).

---

## 6. Display surfaces

Per `CONTEXT.md` §1 ("surface", meaning 1): "Since slice 6 a pack
selects and configures the built-in three through its `surfaces` block.
A pack can opt out of a surface... Packs cannot define new surfaces;
that is reserved for the BILL era."

### 6a. Pack-declarable `surfaces` block — `ALN-TokenData/game.schema.json`

| Field | file:line (schema) | Type / constraint | ALN's declared value | file:line (instance) |
|---|---|---|---|---|
| `surfaces.idleLoop` | `ALN-TokenData/game.schema.json:500-504` | `["string", "null"]`, pattern `^[a-z0-9][a-z0-9-]*$` — a venue-channel NAME, never a filename; `null` = surface opt-out, absent = engine default idle loop | `"aln-idle"` | `ALN-TokenData/game.json:175` |
| `surfaces.scoreboard.enabled` | `ALN-TokenData/game.schema.json:509-513` | boolean; `false` = no scoreboard surface, engine refuses `display:scoreboard`; absent = `true` | `true` | `ALN-TokenData/game.json:177` |
| `surfaces.scoreboard.evidenceCycleMs` | `ALN-TokenData/game.schema.json:514-518` | integer ≥ 1000; base evidence-page cycling interval; absent = engine default 18000 | `18000` | `ALN-TokenData/game.json:178` |

A pack declaring `surfaces` must list `surfaces.select` in `requires`
(`ALN-TokenData/game.schema.json:496`; §1a row 7 above).

### 6b. Per-mode `displayBehavior.surface` — `ALN-TokenData/game.schema.json`

| field | file:line (schema) | Constraint | Engine-drivable values (gate) |
|---|---|---|---|
| `modes[].displayBehavior.surface` | `ALN-TokenData/game.schema.json:117-121` | OPEN string, schema-valid as any value; "the engine's gate refuses surfaces it cannot render" | `scoreboard-rankings`, `scoreboard-evidence`, `none` — `ENGINE_MODE_CAPS.surface` (`backend/src/services/packService.js:81`, §1b above) |

ALN's two declared modes use two of the three drivable values:

| Mode id | `displayBehavior.surface` | file:line |
|---|---|---|
| `blackmarket` | `scoreboard-rankings` | `ALN-TokenData/game.json:26` |
| `detective` | `scoreboard-evidence` | `ALN-TokenData/game.json:41` |

`modes[].displayBehavior.fields[]` and `.when` are additional
per-mode display parameters (`ALN-TokenData/game.schema.json:122-133`):
`fields` is an array of field names to surface (ALN's `detective` mode
declares `["summary", "owner"]`, `ALN-TokenData/game.json:42-45`);
`when` is currently a closed enum of exactly `["immediate"]`
(`ALN-TokenData/game.schema.json:128-132`).

---

## 7. Input transports — every way a player action enters the system

Per `CONTEXT.md` §5b ("Rehearse"): "Input transports (NFC, QR, a button)
are venue-bound physics, never the designer's frame." This section is
the physics inventory those transports implement.

| # | Transport | Component | Code path | file:line |
|---|---|---|---|---|
| 1 | Web NFC (`NDEFReader`) | GM Scanner (ALNScanner) | `NFCHandlerClass.startScan()` attaches a `reading` listener on `new NDEFReader()` | `ALNScanner/src/utils/nfcHandler.js:9-49` (class at `:9`, `startScan` at `:31`, listener at `:49`) |
| 2 | Manual entry (`prompt()`) | GM Scanner (ALNScanner) | `GameOpsDomain.manualEntry()` prompts for a raw RFID string, feeds it into the same `processNFCRead()` pipeline with `source: 'manual'` | `ALNScanner/src/app/domains/gameOps.js:370-374` |
| 3 | Web NFC (`NDEFReader`), primary path | Player Scanner (Web/PWA) | `MemoryScanner.startScanning()` tries `startNFCScanning()` first (skipped on iOS, since Apple's WebKit has no Web NFC) | `aln-memory-scanner/js/app.js:265-278` (`startNFCScanning()` body at `:312`) |
| 4 | QR code (camera, `qr-scanner` library) | Player Scanner (Web/PWA) | `MemoryScanner.startQRScanning()` — fallback when NFC unsupported/unavailable, wired to `handleScan()` | `aln-memory-scanner/js/app.js:280-303` |
| 5 | Manual entry (modal + text input) | Player Scanner (Web/PWA) | `MemoryScanner.processManualEntry()` reads `#manualTokenId`, calls `handleScan(tokenId)` | `aln-memory-scanner/js/app.js:516-522` |
| 6 | NFC/RFID hardware (MFRC522, software SPI) | ESP32 Scanner | `RFIDReader::detectCard()` — WUPA → cascade select → NDEF extraction via `FAST_READ` (0x3A); returns `DetectResult::{NoCard, Detected, CommFailed}` | `arduino-cyd-player-scanner/ALNScanner_v5/hal/RFIDReader.h:54-66` (class + `detectCard()` declaration) |
| 7 | Simulated scan (serial command, no RFID hardware) | ESP32 Scanner | `SIMULATE_SCAN:tokenId` serial command — mirrors `processRFIDScan()`'s token-DB lookup then orchestrator send, "NO RFID HARDWARE" | `arduino-cyd-player-scanner/ALNScanner_v5/Application.h:1206-1225` |
| 8 | Simulated scan (direct HTTP POST) | E2E / audit harness | `POST /api/scan` called directly (no scanner UI at all) — the transport E2E suites and any rung-1 capability-probe harness use to inject a scan without hardware or a browser | route: `backend/src/routes/scanRoutes.js:19` (`router.post('/', ...)`); direct-POST usage e.g. `backend/tests/contract/http/scan.test.js:52` (`.post('/api/scan')`) |

All 8 transports converge on the same wire shape (`tokenId`, `teamId?`,
`deviceId`, `deviceType`, `timestamp`) — GM-sourced transports (1, 2) go
through the WebSocket `transaction:submit` path
(`ALNScanner/src/network/...`), while player/ESP32-sourced transports
(3-8) go through the HTTP `POST /api/scan` route
(`backend/src/routes/scanRoutes.js:19`).

---

## 8. Cue trigger vocabulary and CUE_ACTIONS

### 8a. Trigger vocabulary — `CUE_TRIGGER_EVENTS` (`backend/src/gameRules/cueValidation.js:42-59`)

This is the ENFORCED authoring vocabulary — the gate refuses a standing
cue's `trigger.event` outside this list ("not driveable by this engine
yet"). It is generated to mirror the union of
`ENGINE_EVENT_NORMALIZERS` (`backend/src/services/cue/standingEvaluator.js:26-61`,
14 keys) and `GAME_EVENT_NORMALIZERS` (`backend/src/gameRules/cueVocabulary.js:29-50`,
2 keys) that together form `EVENT_NORMALIZERS`
(`standingEvaluator.js:68`) — 16 keys total, exactly matching
`CUE_TRIGGER_EVENTS`' 16 entries.

| # | Trigger event | file:line (`CUE_TRIGGER_EVENTS`) | Normalizer source | Normalizer file:line |
|---|---|---|---|---|
| 1 | `cue:completed` | `backend/src/gameRules/cueValidation.js:43` | engine | `backend/src/services/cue/standingEvaluator.js:34` |
| 2 | `gameclock:started` | `backend/src/gameRules/cueValidation.js:44` | engine | `backend/src/services/cue/standingEvaluator.js:49` |
| 3 | `group:completed` | `backend/src/gameRules/cueValidation.js:45` | game (scoring) | `backend/src/gameRules/cueVocabulary.js:45` |
| 4 | `music:playback:changed` | `backend/src/gameRules/cueValidation.js:46` | engine | `backend/src/services/cue/standingEvaluator.js:42` |
| 5 | `music:playlist:changed` | `backend/src/gameRules/cueValidation.js:47` | engine | `backend/src/services/cue/standingEvaluator.js:43` |
| 6 | `music:track:changed` | `backend/src/gameRules/cueValidation.js:48` | engine | `backend/src/services/cue/standingEvaluator.js:37` |
| 7 | `phase:changed` | `backend/src/gameRules/cueValidation.js:49` | engine (clock/phase) | `backend/src/services/cue/standingEvaluator.js:54` |
| 8 | `player:scan` | `backend/src/gameRules/cueValidation.js:50` | engine | `backend/src/services/cue/standingEvaluator.js:32` |
| 9 | `session:created` | `backend/src/gameRules/cueValidation.js:51` | engine | `backend/src/services/cue/standingEvaluator.js:33` |
| 10 | `sound:completed` | `backend/src/gameRules/cueValidation.js:52` | engine | `backend/src/services/cue/standingEvaluator.js:35` |
| 11 | `transaction:accepted` | `backend/src/gameRules/cueValidation.js:53` | game (scoring) | `backend/src/gameRules/cueVocabulary.js:29` |
| 12 | `video:completed` | `backend/src/gameRules/cueValidation.js:54` | engine | `backend/src/services/cue/standingEvaluator.js:29` |
| 13 | `video:loading` | `backend/src/gameRules/cueValidation.js:55` | engine | `backend/src/services/cue/standingEvaluator.js:27` |
| 14 | `video:paused` | `backend/src/gameRules/cueValidation.js:56` | engine | `backend/src/services/cue/standingEvaluator.js:30` |
| 15 | `video:resumed` | `backend/src/gameRules/cueValidation.js:57` | engine | `backend/src/services/cue/standingEvaluator.js:31` |
| 16 | `video:started` | `backend/src/gameRules/cueValidation.js:58` | engine | `backend/src/services/cue/standingEvaluator.js:28` |

`TOKEN_DERIVED_TRIGGER_EVENTS` (`cueValidation.js:70`) further narrows
which of these 16 have a `tokenId` field resolved against the pack's
token database for condition-authoring purposes: exactly
`player:scan` and `transaction:accepted` (`video:*` trigger tokenIds are
a filename-derived engine namespace, exempt per the code comment at
`cueValidation.js:64-69`).

### 8b. Command actions cues may dispatch — `CUE_ACTIONS` (`backend/src/gameRules/cueValidation.js:82-107`)

A deliberate SUBSET of the full `gm:command` action inventory (§3
above): "Excluded: session lifecycle, score intervention, and
transaction surgery — game-state interventions this project reserves
for staffed operators" (`cueValidation.js:20-30`), enforced a second
time at dispatch by the auth-floor guard
(`backend/src/services/commandExecutor.js:121-128`, "REFUSED
off-vocabulary action... from source 'cue' (auth floor)").

| # | Action | file:line | Required payload field(s) |
|---|---|---|---|
| 1 | `sound:play` | `backend/src/gameRules/cueValidation.js:83` | `file: string` |
| 2 | `sound:stop` | `backend/src/gameRules/cueValidation.js:84` | (none) |
| 3 | `lighting:scene:activate` | `backend/src/gameRules/cueValidation.js:85` | `role: string` (role-form; distinct from the GM-panel `sceneId`-form of the same action) |
| 4 | `video:queue:add` | `backend/src/gameRules/cueValidation.js:86` | `videoFile: string` |
| 5 | `video:play` | `backend/src/gameRules/cueValidation.js:87` | (none) |
| 6 | `video:pause` | `backend/src/gameRules/cueValidation.js:88` | (none) |
| 7 | `video:stop` | `backend/src/gameRules/cueValidation.js:89` | (none) |
| 8 | `video:skip` | `backend/src/gameRules/cueValidation.js:90` | (none) |
| 9 | `video:seek` | `backend/src/gameRules/cueValidation.js:91` | `position: number` |
| 10 | `music:play` | `backend/src/gameRules/cueValidation.js:92` | (none) |
| 11 | `music:pause` | `backend/src/gameRules/cueValidation.js:93` | (none) |
| 12 | `music:stop` | `backend/src/gameRules/cueValidation.js:94` | (none) |
| 13 | `music:next` | `backend/src/gameRules/cueValidation.js:95` | (none) |
| 14 | `music:previous` | `backend/src/gameRules/cueValidation.js:96` | (none) |
| 15 | `music:setVolume` | `backend/src/gameRules/cueValidation.js:97` | `volume: number` |
| 16 | `music:setShuffle` | `backend/src/gameRules/cueValidation.js:98` | `enabled: boolean` |
| 17 | `music:setLoop` | `backend/src/gameRules/cueValidation.js:99` | `enabled: boolean` |
| 18 | `music:loadPlaylist` | `backend/src/gameRules/cueValidation.js:100` | `playlistId: string` |
| 19 | `music:seek` | `backend/src/gameRules/cueValidation.js:101` | `position: number` |
| 20 | `display:scoreboard` | `backend/src/gameRules/cueValidation.js:102` | (none) |
| 21 | `display:idle-loop` | `backend/src/gameRules/cueValidation.js:103` | (none) |
| 22 | `display:return-to-video` | `backend/src/gameRules/cueValidation.js:104` | (none) |
| 23 | `audio:route:set` | `backend/src/gameRules/cueValidation.js:105` | `sink: string` |
| 24 | `audio:volume:set` | `backend/src/gameRules/cueValidation.js:106` | `stream: string`, `volume: number` |

`CUE_ACTIONS` also excludes, by the same comment: `cue:fire` itself
("cue chaining works through standing triggers on `cue:completed`"),
`system:reset`, `bluetooth:*` pairing, `held:*` management,
`scoreboard:page:*`, and `service:check` — all present in the full
gm:command inventory (§3) but never dispatchable by pack cue content.

---

## 9. The BS.1 vocabulary endpoint

`GET /api/vocabulary` — `backend/src/routes/resourceRoutes.js:168-176`.
Doc comment at `resourceRoutes.js:160-166`: "the engine's cue-authoring
vocabulary (B0 BS.1; program Track B 'backend-served trigger/action
vocabulary'). Served from the SAME exported tables the activation gate
validates cues against — one source, zero drift; the config-tool's
editors re-source from here instead of hand-mirroring. Read-only engine
metadata, no auth (the `/api/tokens` posture)." Mounted at `/api` via
`app.use('/api', resourceRoutes)` (`backend/src/app.js:119`).

This is the literal "BS.1 vocabulary endpoint is the seed data" the UX
foundation names as the capability catalog's starting point
(`docs/plans/2026-09-04-ux-foundation.md:361`).

Response shape (`resourceRoutes.js:170-175`):

```js
res.json({
  triggerEvents: cueValidation.CUE_TRIGGER_EVENTS,          // §8a, 16 entries
  conditionOperators: cueValidation.CONDITION_OP_NAMES,     // ['eq','gt','gte','in','lt','lte','neq']
  actions: cueValidation.CUE_ACTIONS,                       // §8b, 24 entries, {action: {field: type}}
  tokenDerivedTriggerEvents: cueValidation.TOKEN_DERIVED_TRIGGER_EVENTS, // ['player:scan','transaction:accepted']
});
```

`CONDITION_OP_NAMES` itself is declared at
`backend/src/gameRules/cueValidation.js:61`:
`['eq', 'gt', 'gte', 'in', 'lt', 'lte', 'neq']` — the 7 condition
operators standing-cue authors may use against a normalized trigger
context field (e.g. `{field: 'phaseId', op: 'eq', value: 'the-job'}`).

Consumers confirmed in `config-tool/`: `public/js/utils/vocabulary.js`,
`public/js/components/cueEditor.js`, and
`public/js/components/commandForm.js` all fetch this endpoint — the
config-tool re-sources the cue editor's trigger/action pickers from it
rather than hand-mirroring the backend tables, exactly as the doc
comment states.

---

## Count verification

**Item 3 — gm:command action inventory (`commandExecutor.js`):**

```
grep -c "case '" backend/src/services/commandExecutor.js
```
→ **64**

Table row count: §3a's 15 domain sub-tables (Session 6 + Video 8 +
Display 4 + Scoreboard 3 + Scoring 2 + Transaction 2 + System 1 +
Bluetooth 6 + Audio 2 + Lighting 2 + Sound 2 + Cue 6 + Held 4 + Music 10
+ Service 1 = 59 case-label rows) + §3b's 5 `validateCommand`
resource-check rows = **64 rows total**. Matches the grep count exactly.

**Item 8 — cue trigger vocabulary and CUE_ACTIONS:**

```
sed -n '42,59p' backend/src/gameRules/cueValidation.js | grep -cE "^\s+'[a-zA-Z:]+',"
```
→ **16** (`CUE_TRIGGER_EVENTS`, §8a — 16 table rows, exact match)

```
sed -n '82,107p' backend/src/gameRules/cueValidation.js | grep -cE "^\s+'[a-zA-Z:-]+':"
```
→ **24** (`CUE_ACTIONS`, §8b — 24 table rows, exact match)

(The `sed` range narrows to each object literal's line span so the grep
counts only that table's keys, not the whole file's quoted strings; both
ranges were located via `grep -n "CUE_TRIGGER_EVENTS\|CUE_ACTIONS ="
backend/src/gameRules/cueValidation.js` and confirmed by reading the
file directly.)
