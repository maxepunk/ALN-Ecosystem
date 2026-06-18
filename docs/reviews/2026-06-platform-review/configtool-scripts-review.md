# Wave 2 Discovery — config-tool/ + scripts/ Static Review

**Date:** 2026-06-10
**Scope A:** `config-tool/` (Express app, port 9000) — lib, server, public/js, presets system
**Scope B:** `scripts/` — Notion → tokens.json pipeline (sync, manifest, compare, NeurAI generators)
**Method:** static read of all 25 JS files + 5 Python scripts, cross-checked against backend
consumers (`app.js`, `config/index.js`, `cueEngineService.js`, `cueEngineWiring.js`,
`commandExecutor.js`, `ALNScanner/src/core/scoring.js`) and both READMEs. No code executed.

## Summary

| Severity | Count |
|---|---|
| P0 confirmed | 1 |
| P1 likely defects | 8 |
| P2 debt/latent | 13 |
| P3 polish | 10 |
| **Total** | **32** |

Plus 14 doc-drift items, a test-gap inventory, a preset-split (venue-profile vs game-pack)
tangle assessment, and 7 open questions.

**Headline:** the single worst finding in this scope is the sync pipeline's failure posture
(F-TOOL-01): any Notion API failure mid-run degrades silently into a *truncated tokens.json
plus deletion of asset files*, with exit code 0. The config-tool's worst class is
write-safety: every config write is unvalidated and non-atomic against a live backend, on an
unauthenticated API that also serves the venue's secrets to anyone on the player LAN.

---

## Findings

Format: `F-TOOL-NN | severity | file:line | description | evidence | tag`

### P0

**F-TOOL-01 | P0 | scripts/sync_notion_to_tokens.py:556-567, 734-756 | Notion API failure mid-sync silently writes truncated tokens.json AND deletes asset files; exit code 0.**
Evidence chain:
- `fetch_all_memory_tokens()` checks `if "results" not in data: print(...); break` (`:559-561`) — an auth error, revoked integration, changed DB ID, 429 rate-limit, or network failure mid-pagination yields a *partial or empty* `all_results`, and `main()` proceeds normally.
- The only guard is `:734-738`: if the new count < 50% of the existing file it prints `⚠️ WARNING` — print-only; it does **not** gate the write. A mid-pagination failure that returns 51% of tokens passes the check entirely.
- `:742-743` then overwrites `ALN-TokenData/tokens.json` (the submodule consumed by backend + all three scanners).
- `:750` then calls `generate_asset_manifest.prune_orphans(ASSETS_ROOT, sorted_tokens.keys())` — every BMP/audio file whose token didn't make it into the degraded set is **unlinked from disk** (`generate_asset_manifest.py:148-151`). With an empty result set this deletes the entire generated asset library; the new (shrunken) manifest is then pushed to every ESP32 at next boot.
- `main()` has no failure exit path; the process always exits 0, so nothing scripted around it can detect the damage.
This confirms and substantially worsens the plan-doc claim that "the script fails silently if the database ID changes": it does print one line, but then *destructively completes*. Same `break`-and-continue pattern exists in `fetch_all_characters()` (`:507-509`, see F-TOOL-07) and `compare_rfid_with_files.py:86-87` (which prints nothing at all). | tag: data-loss, pipeline

### P1

**F-TOOL-02 | P1 | config-tool/server.js:10-29, lib/routes.js:11-17 | No authentication on any endpoint; `GET /api/config` returns all backend secrets to anyone on the venue LAN.**
`readAll()` returns the full parsed `.env` (`configManager.js:27-34`), which includes `ADMIN_PASSWORD`, `JWT_SECRET`, `HOME_ASSISTANT_TOKEN`, VLC password (the infra section explicitly edits these — `infra.js:28-33`, `audio.js:224`). The server binds the default interface with no auth middleware of any kind, and every mutating endpoint (`PUT /config/env`, asset delete, preset load) is equally open. The README's posture ("should only be run on the local network — it has no authentication", README:233) ignores that *the local network is the player network* — player phones must join this LAN to use the PWA scanners. Combined with wave-1's scoreboard-password-hardcode finding, the admin password is currently retrievable two independent ways. Whether config-tool runs during games (vs setup-only) is an open question (Q1 below), but nothing stops it. | tag: security

**F-TOOL-03 | P1 | config-tool/lib/envParser.js:62-66, lib/configManager.js:51-61 | `.env` newline injection: values containing `\n` are serialized raw, injecting arbitrary env lines.**
`serializeEnv` quotes only when value `includes(' ')`, `'#'`, or `'"'` — never `\n`. `writeEnvValues` does `String(value)` with no sanitization. `PUT /api/config/env` with `{"HOST": "0.0.0.0\nADMIN_PASSWORD=x"}` writes two lines into `backend/.env`; the injected key wins on next backend restart (or both copies persist — see F-TOOL-26). Also unescaped: a value *containing* `"` is wrapped in quotes without escaping inner quotes (round-trips today only by accident of the strip logic, `envParser.js:32-34`). | tag: security, correctness

**F-TOOL-04 | P1 | config-tool/lib/routes.js:19-53, lib/configManager.js:63-77 | All four config writers accept any JSON body with zero validation; a malformed scoring write silently reverts the live game's economy to defaults.**
`writeScoring(req.body)` / `writeCues` / `writeRouting` serialize whatever arrives — `{}`, `null`-shaped, missing keys, wrong types. Consequences on the running backend, traced:
- **scoring-config.json**: backend loads it once at startup with a catch that *silently substitutes default values* (`backend/src/config/index.js:16-25`, "Failed to load shared scoring config, using defaults"). A venue that tuned a custom economy and then saved a structurally bad file (or a file emptied by a crashed write, F-TOOL-10) runs the next game on the default economy with only a console.warn at boot. The GM Scanner's Vite import would *fail the next build* instead — a third behavior.
- **cues.json**: backend warns and runs with an *empty cue engine* (`backend/src/app.js:214-223`) — all standing/clock cues silently gone.
- **routing.json**: ducking engine silently inactive (`app.js:240-251`).
The only validation in the system is client-side in `showcontrol.js save():246-294` — trivially bypassed and not shared by preset load/import, which writes all four files unvalidated (`configManager.js:177-181`). | tag: correctness, data-loss

**F-TOOL-05 | P1 | config-tool/lib/configManager.js:11,63-64 vs ALNScanner/src/core/scoring.js:12 | Editing scoring-config via config-tool diverges backend and GM Scanner: the scanner bakes the values in at build time.**
Config-tool writes `ALN-TokenData/scoring-config.json`; the backend re-reads it on restart, but the GM Scanner imports it via Vite (`import sharedConfig from '../../data/scoring-config.json'` — resolved **at build time** into `dist/`). Tuning the economy in the Game Economy section therefore changes networked scoring (backend-authoritative) while standalone-mode scoring and all scanner-local displays keep the old values until someone rebuilds `ALNScanner/dist`. The tool's own UI (live formula preview, token browser values) shows the new numbers, making the divergence invisible. This is a tool-created instance of the scoring-parity risk class from wave 1; neither config-tool/README.md nor root CLAUDE.md ("loaded by both backend and GM Scanner at runtime. No manual sync needed") mentions the rebuild requirement — the CLAUDE.md claim is wrong for the scanner. | tag: parity, doc-drift

**F-TOOL-06 | P1 | scripts/generate_asset_manifest.py:33,65-66,146-148 | `placeholder.bmp` is NOT protected by the tokenId filter — it gets pruned on sync and included in the ESP32 manifest, contrary to three docstrings.**
`TOKEN_ID_PATTERN = ^[a-z0-9_]+$` matches the stem `placeholder` (verified: `re.match → True`). Therefore: (a) `prune_orphans` — called by every sync run (`sync:750`) with only real token IDs in the allow-list — **deletes `aln-memory-scanner/assets/images/placeholder.bmp`**, breaking the ESP32's unknown-token fallback (root CLAUDE.md ESP32 section: "CYD scanner shows placeholder.bmp for known tokens"); (b) `_scan_dir` includes it in the manifest as a fake token. The module's own docstrings claim the opposite three times (`:16-18`, `:53-55`, `:128-131`: "placeholder.bmp is preserved because its stem isn't a legal tokenId"), as does the sync script comment (`sync:746-747`) and scripts/README.md:115-118. The file currently exists on disk, so either sync hasn't run since prune_orphans landed, or someone manually restored it. Fix is one line (exempt list or require a digit), but the doc claims must be corrected too. | tag: data-loss, doc-drift

**F-TOOL-07 | P1 | scripts/sync_notion_to_tokens.py:500-513, 639-644 | Characters-DB fetch failure silently nulls every `owner` field in the written tokens.json.**
`fetch_all_characters()` uses the same print-and-`break` error handling as F-TOOL-01; a partial/empty `character_map` makes `character_map.get(owner_id)` return `None` for every token, and the sync **completes successfully** with all owners stripped. Owner feeds the session report's "Detective Evidence Log" Owner column and the scoreboard's per-owner paging (`commandExecutor.js` `scoreboard:page:owner`) — downstream symptoms appear hours later at game time with no traceable cause. No count check or warning exists for owner resolution (contrast with the token-count warning at `:734-738`). | tag: data-loss, pipeline

**F-TOOL-08 | P1 | scripts/sync_notion_to_tokens.py:410-422 | Sync performs no semantic validation and emits no warnings: misspelled SF_MemoryType flows straight to the silent-0×-scoring bug; out-of-range/non-numeric ratings become accepted data.**
- `SF_MemoryType`: any string is stored verbatim (`:417-418`); missing field → `None`. No check against `scoring-config.json` typeMultipliers keys, no warning. Wave 1 established the backend accepts ANY memoryType with silent 0× scoring (matrix row 1.3) — this is the authoring-time gate that should catch it, and it doesn't. A Notion author typing `[personal ]`→ trailing space is stripped, but `[Personnal]` or `[party]` (case differs; standalone lookup is case-sensitive per wave 1) sails through.
- `SF_ValueRating`: `int(value)` with no 1-5 range check (`6`, `0`, `-3` accepted); non-numeric → silently `None` (`:413-416`).
- `SF_Group`: multiplier suffix `(xN)` never validated against the parsing regexes that 3+ consumers apply (matrix row 1.8).
The script has all the information needed (it could load scoring-config.json) and a print-based reporting channel already in use. scripts/README.md:222 lists rating validation under "Future Improvements" — acknowledged, still absent. | tag: pipeline, validation

**F-TOOL-09 | P1 | config-tool/public/js/components/cueEditor.js:16-17 vs backend/src/services/cueEngineWiring.js:56-90 | Cue editor offers `video:paused` / `video:resumed` as standing-cue event triggers, but the backend never evaluates standing cues for those events — authored cues silently never fire.**
The wiring forwards `video:started`/`video:completed` to `handleGameEvent` (standing-cue evaluation) but routes paused/resumed **only** to `handleVideoLifecycleEvent` (`cueEngineWiring.js:74-86`), which exclusively controls active compound-cue timelines (`cueEngineService.js:872-884`) — it never calls `evaluateConditions`/`fireCue` for standing cues. A GM authoring "when video pauses → lights up" gets a cue that validates, saves, loads, and never fires, with no error anywhere. Either forward the two events to `handleGameEvent` too, or remove them from `TRIGGER_EVENTS`. (Inverse gap, P3: `music:playback:changed` and `music:playlist:changed` ARE forwarded — `cueEngineWiring.js:119-125` — but are not offered in the editor.) | tag: correctness, drift

### P2

**F-TOOL-10 | P2 | config-tool/lib/configManager.js:75-77; scripts/sync_notion_to_tokens.py:742-743 | All JSON config writes are non-atomic (`fs.writeFileSync` / `open('w')` truncate-then-write); a crash or power loss mid-write leaves corrupt JSON in live backend config or the tokens submodule.**
The pipeline already contains the correct pattern — `generate_asset_manifest.write_manifest` does tmp + fsync + `Path.replace()` with explicit atomicity rationale (`generate_asset_manifest.py:89-116`) — but neither `_writeJson` (scoring/cues/routing/presets) nor the tokens.json write uses it. Failure interacts with F-TOOL-04's silent-fallback consumers: a truncated scoring-config silently becomes the default economy. There is also a startup race: backend reads these files without retry at boot (`app.js:213-251`); a config-tool write coinciding with `pm2 restart` can read a half-written file. | tag: correctness, data-loss

**F-TOOL-11 | P2 | config-tool/lib/configManager.js:171-184, 27-47 | Preset load is non-transactional across four files, and the restore path is bricked exactly when it's needed (corrupt config).**
`loadPreset` writes env → scoring → cues → routing sequentially; a throw midway (e.g., preset missing `cues` key from a hand-edited import: `Object.entries(undefined)` in `writeEnvValues`, or any fs error) leaves a half-applied mix of old and new config with a `success:false` toast as the only signal. Worse: the auto-backup calls `savePreset` → `readAll()` → `_readJson`, which **rethrows** parse errors for any existing-but-corrupt file (`:40-47` only swallows ENOENT) — so if cues.json is corrupted (the very scenario presets exist to recover from), loading any preset 500s at the backup step and recovery via the tool is impossible. | tag: correctness, presets

**F-TOOL-12 | P2 | config-tool/lib/configManager.js:154-168, 196-200; lib/routes.js:204-215 | Preset format is unversioned and name-slug collisions silently overwrite.**
Filename = `name.toLowerCase().replace(/[^a-z0-9]+/g,'-')` — "Friday Show" and "FRIDAY  show!" collide; save and import both clobber the existing file with no warning. The preset JSON carries no `version`/schema field, so the owner-decided venue-profile/game-pack split (matrix 6.9) has no migration hook: old exports will simply fail the `name/env/scoringConfig/cues/routing` presence check (`routes.js:207-208`) or, worse, pass it and write the wrong granularity. Import also performs no structural validation *inside* the five top-level keys (a preset with `cues: "hello"` imports fine and corrupts on load). | tag: presets, structure

**F-TOOL-13 | P2 | config-tool/public/js/components/cueEditor.js:329 | "Convert to Timeline/Sequential" re-renders into the wrong DOM node, detaching the editor container — subsequent cue selection renders into a dead node.**
`renderCueEditor(container.parentElement, ...)` wipes the right-panel div, removing the `editorContainer` that `showcontrol.js` holds in module state (`showcontrol.js:82-83`, `:175-184`). After one Convert click, `selectCue()` renders every later cue into the detached element: the visible editor freezes on the converted cue until the user navigates away and back. Data edits via the stale-rendered controls still mutate `cuesData` (closures hold real objects), compounding confusion. Needs runtime confirmation but the logic is unambiguous. | tag: correctness, ui

**F-TOOL-14 | P2 | config-tool/public/js/components/conditionBuilder.js:78-79 vs backend/src/services/cueEngineService.js:73-81 | "is one of" (`in`) conditions store values as strings; backend uses strict `includes` — numeric-field conditions never match.**
For `eq/gt/...` the builder auto-coerces numerics (`:81-84`), but the `in` branch does `split(',').map(trim)` only — `valueRating in [4, 5]` is stored as `["4","5"]`, and `CONDITION_OPS.in = expected.includes(actual)` compares `4 !== "4"`. The cue silently never fires (and `evaluateConditions` gives no per-condition diagnostics). All numeric fields offered in `TRIGGER_EVENTS` (`points`, `valueRating`, `teamScore`, `duration`, `multiplier`, `bonus`) are affected. | tag: correctness

**F-TOOL-15 | P2 | config-tool/public/js/sections/music.js:46-60 + app.js:60-65 | Navigating away from and back to the Music section silently discards unsaved edits.**
`app.js loadSection` calls `mod.refresh()` on revisit; music's `refresh()` unconditionally refetches and `model.setPlaylists(serverData)` — wiping in-progress edits while `dirtyState['music']` remains `true`, so the toolbar still claims unsaved changes and Save then persists the *server's* data as a no-op. Music is the only section exporting `refresh`, so it's uniquely affected. Guard: skip refetch when dirty, or confirm. | tag: ui, data-loss

**F-TOOL-16 | P2 | config-tool/lib/configManager.js:144-152, 175 | One malformed preset file 500s the entire preset list; `_backup_` presets accumulate unboundedly and are undeletable via UI.**
`listPresets` `JSON.parse`s every `*.json` in the dir with no per-file try — a single truncated backup (see F-TOOL-10: `savePreset` uses the same non-atomic `_writeJson`) makes `GET /api/presets` throw, taking the whole Presets section down including the recovery path. Every preset load also adds a new `_backup_<ts>` (`:175`); the UI deliberately hides Delete for backups (`presets.js:78-84`, README:136), and nothing prunes them — the failure surface grows with use. | tag: robustness, presets

**F-TOOL-17 | P2 | scripts/sync_notion_to_tokens.py:396-401 | SF_ field regex `\[([^\]]*)\]` silently truncates any value containing `]`; concrete breaking inputs for the parsing conventions.**
- `SF_Summary: [He said "do it [now]" and left]` → captures `He said "do it [now` — truncated summary propagates to the public scoreboard evidence card with no warning.
- A description containing two `SF_RFID:` lines (copy-paste template residue) → `re.search` takes the first silently.
- `SF_ValueRating: [4.5]` → `int()` ValueError → silently `None` (F-TOOL-08).
- Token prefix stripping (`:84`, `^[A-Za-z]{2,4}\d{2,4}`) misses 5-letter codes or codes like `TAC-001` → the code leaks into the rendered BMP body text.
- Timestamp regexes (`:80-82`) only match at string start after the prefix; `Recorded 11:32PM - ...` keeps the timestamp in body text (dim/bright header semantics lost). | tag: pipeline, brittleness

**F-TOOL-18 | P2 | scripts/sync_notion_to_tokens.py:585, 519-520; compare_rfid_with_files.py:137 | A Notion @mention or equation in Description/Text or a title crashes the sync with a raw KeyError.**
`block["text"]["content"]` assumes every rich_text block is type `text`; mention/equation blocks have no `text` key. Crash occurs before the tokens.json write (so non-destructive), but the traceback gives an author no clue that an @mention in one Element's description is the cause. Same pattern in the title parse and in the compare script. | tag: pipeline, robustness

**F-TOOL-19 | P2 | scripts/compare_rfid_with_files.py:34, 63 | QA tool is broken twice: hardcoded `/home/maxepunk/...` absolute path, and its Basic Type filter diverges from the sync script's.**
`ECOSYSTEM_ROOT = Path("/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem")` (the sync script computes it from `__file__`; the compare tool predates that fix) — on any other machine all asset dirs read empty and every token reports "no assets - OK". Filter: compare queries `"Memory Token Image"` (`:63`); sync queries `"Memory Token"` (`sync:535`) — the two scripts examine different element sets, so the pre-sync mismatch check (README workflow step) cannot vouch for what sync will actually process. scripts/README.md:210-215 lists the compare tool's variant as the canonical filter — one of the three is wrong. | tag: pipeline, doc-drift

**F-TOOL-20 | P2 | scripts/sync_notion_to_tokens.py:500-505, 552-557 | Notion requests have no timeout, no retry, no 429/Retry-After handling.**
`requests.post` without `timeout=` can hang the sync indefinitely; a 429 response body lacks `results` and funnels into the F-TOOL-01 silent-degradation path rather than backing off. With ~50 tokens this is currently 2-3 paginated calls, but the GenAI reports pipeline as a second Notion consumer (decision context, matrix 8.5) makes shared rate-limit pressure likelier. Belongs in the planned source-adapter (Phase 3.2e) as adapter-level retry policy. | tag: pipeline, robustness

**F-TOOL-21 | P2 | scripts/sync_notion_to_tokens.py:694-698 | Duplicate SF_RFID across two Notion pages: last processed silently wins.**
`tokens[rfid] = token_entry` with no collision check — two Elements both claiming `[jaw001]` (an easy copy-paste error given the template workflow) produce one merged-over token and no warning, while the loser's page appears to have synced successfully in the log. One `if rfid in tokens: warn` line fixes it. | tag: pipeline, validation

**F-TOOL-22 | P2 | config-tool/lib/configManager.js:11 + root CLAUDE.md submodule commands | Scoring edits dirty the ALN-TokenData submodule; the documented `git submodule update --remote --merge` flow can clobber venue tuning.**
The tool writes into a git submodule with no commit/push step and no UI indication that the change is uncommitted. The "Quick Commands" in root CLAUDE.md (update --remote --merge) and the scripts/README sync workflow both manipulate that submodule; an un-committed economy tune can be merged-over or produce a conflicted submodule that blocks the next token sync. Presets partially mitigate (the value survives in the preset file) but nothing in the tool or docs flags the interaction. | tag: presets, structure

### P3

**F-TOOL-23 | P3 | config-tool/server.js:17 vs lib/configManager.js:131-140 | `/video` static preview route uses `paths.videosDir` directly, ignoring the `VIDEO_DIR` env override that `_getVideosDir()` applies everywhere else** (listing, upload, delete). With `VIDEO_DIR` set, the asset list shows files the preview route can't serve. Currently latent — the UI only previews sounds — but it's a trap for the planned video preview. | tag: correctness

**F-TOOL-24 | P3 | config-tool/server.js (absent), public/js/utils/api.js:18 | No Express error middleware: multer errors (file too large, missing dest dir) and JSON body-parse errors return HTML; `api.js` then throws `Unexpected token '<'...` instead of the real message.** A 2.1GB video upload fails with an unintelligible toast. | tag: robustness

**F-TOOL-25 | P3 | config-tool/lib/routes.js:90-104 | Asset upload silently overwrites an existing same-name file (no exists-check in `multer.diskStorage.filename`), and upload to a not-yet-created `backend/public/audio` dir errors as raw multer ENOENT.** Overwriting a sound referenced by cues changes show behavior with zero confirmation (delete has a used-by warning; overwrite has none). | tag: correctness

**F-TOOL-26 | P3 | config-tool/lib/configManager.js:54, lib/envParser.js:61-66 | `writeEnvValues` stringifies objects to `"[object Object]"`; duplicate keys in .env are both rewritten to the last value on serialize** (parse keeps last-wins in `values`, serialize emits `values[line.key]` for *every* occurrence — silently "fixing" the earlier line). | tag: correctness

**F-TOOL-27 | P3 | config-tool/public/js/sections/showcontrol.js:256-261, 110-120 | Clock-trigger validation accepts `99:99:99` and `"3x"` (`parseInt` per part, no range check) — backend `parseClockTime` accepts the same, so a typo becomes a never-fires cue at 99 hours; `getCueBadge` returns 'Auto' for a cue with neither quickFire nor trigger** (an orphan cue displays as automatic). | tag: validation, ui

**F-TOOL-28 | P3 | config-tool/public/js/components/commandForm.js:290-299 | Cue picker for `cue:fire` lists ALL cues including the one being edited — self-referencing (and mutually recursive) cue chains are authorable with no warning.** Backend re-entrancy guard (cueEngineService D4 comment) limits standing-cue loops, but `cue:fire`-chains execute commands directly. Needs a runtime check of the backend's chain-depth behavior. | tag: validation

**F-TOOL-29 | P3 | scripts/sync_notion_to_tokens.py:75, 84 | `CHARACTER_NAME_PATTERN = \b[A-Z]{2,}\b` red-highlights any all-caps token in BMP body text — "TV", "USB", "CEO", "VIP", "DNA" all render as character names.** Pure theme-content logic (matrix 7.3) — concrete argument for moving it to adapter parse-rules config rather than fixing the regex in place. | tag: pipeline, brittleness

**F-TOOL-30 | P3 | scripts/neurai_display_generator.py (entire file), scripts/neurai-display-generator.jsx, scripts/NeurAI.png | Three copies of the NeurAI display generator; the sync script uses none of them.**
`sync_notion_to_tokens.py:203-380` contains its own inline `generate_neurai_display` (the live one, ASCII-art logo, no NeurAI.png); `neurai_display_generator.py` is imported by nothing (grep: only its own docstring); the .jsx is a third variant. `NeurAI.png` is referenced by zero code. Capability-matrix row 7.4 cites "NeurAI.png logo" — describes the dead copy, not the live path. Theme-extraction (pack `displayTheme`) should consolidate to one implementation first. | tag: structure, doc-drift

**F-TOOL-31 | P3 | scripts/sync_notion_to_tokens.py:87-99 | Font loading: bare `except:` ladder hardcoding Debian DejaVu/Liberation paths; on any other OS silently falls back to PIL's ~10px bitmap default font** — the measure-and-fit ladder then produces degenerate layouts with no warning. | tag: robustness

**F-TOOL-32 | P3 | config-tool/public/js/components/cueEditor.js:10-24 | Editor's TRIGGER_EVENTS omits `music:playback:changed` and `music:playlist:changed`, which the backend forwards for standing-cue evaluation (cueEngineWiring.js:119-125)** — those triggers are reachable only by hand-editing cues.json. (Counterpart of F-TOOL-09.) Also: `timelineView.js:233-244` canvas drop handler parses any `text/plain` drag payload — dragging a cue-list item from the left panel onto a timeline silently repositions an unrelated timeline entry by index. | tag: drift, ui

**Verified non-findings (checked, OK):** boolean-as-string `'true'/'false'` from the setShuffle/setLoop selects is correctly handled by backend `coerceBool` (`commandExecutor.js:27-30`, comment explicitly cites config-tool); `trigger.conditions` placement is normalized by `loadCues` (`cueEngineService.js:157`); all 26 ACTION_DEFS action names exist in `commandExecutor.js`'s switch; path traversal is consistently blocked via `path.basename()` on upload filename, asset delete, and all preset filename params (and has tests); preset import size-capped at 1MB in memory storage.

---

## Preset split assessment (venue-profile vs game-pack) — owner decision input

Current preset = flat bundle `{name, created, description, env, scoringConfig, cues, routing}`
(`configManager.js:157-165`). Re-cutting it along the decided boundary (B7: routing+ducking =
venue; scoring/cues/tokens/assets = pack; B8: cues reference lighting *roles*, venue maps
roles→instruments):

**Cleanly separable today (low effort):**
- `scoringConfig` → pack. Already a self-contained file.
- `routing` → venue. Already a self-contained file (B7 keeps routes+ducking together in venue).
- `env` → venue, *mostly*: the tool already partitions env keys by section (`infra.js
  ENV_GROUPS` vs `audio.js` save-list) — that key-ownership map is the seed of the split.
  Caveat: a few env keys are arguably game-scoped (`SESSION_TIMEOUT` = game duration, matrix
  1.21; `TRANSACTION_HISTORY_LIMIT`) and will need explicit assignment.

**Tangled (the real work):**
1. **cues.json is mixed-layer**: cue payloads embed venue vocabulary — concrete HA scene IDs
   (`scene-picker` writes `scene.xxx` entity IDs, `commandForm.js:301-319`) and literal sink
   names `hdmi`/`bluetooth` in routing overrides (`cueEditor.js:26`) and `audio:route:set`
   payloads. Until B8's role indirection exists, a "game pack" cues.json is venue-coupled by
   construction. The B8 lighting-mapping page is therefore a *prerequisite* surface for the
   split, not a parallel feature.
2. **Assets aren't captured at all**: presets reference sound/video filenames inside cues but
   the files live in `backend/public/{audio,videos}` and are excluded from save/export/import
   — today's preset is neither a complete venue profile nor a complete pack. Pack export needs
   an asset bundle (the ESP32 manifest machinery — sha1+size per file — is reusable here, as
   matrix target #10 anticipates).
3. **tokens.json + scoring live in a git submodule** (F-TOOL-22): pack export must decide
   whether the pack is the submodule (current distribution channel, per discovery report §6)
   or a separate artifact that *feeds* it.
4. **No format version** (F-TOOL-12): add `version` + `kind: venue-profile|game-pack` to the
   schema *now*, before the split, so existing presets are migratable and import can dispatch.
5. **Backups entangled**: `_backup_` snapshots are whole-bundle; after the split a load of
   either half should back up only that half (or backups become the mixed-granularity legacy).

Net: the split is moderate, not severe — two of four sources are clean, env has an existing
key map — but it is **blocked behind B8 (lighting roles) and an asset-bundle design**, and
should land together with a versioned preset schema.

---

## Doc drift

| # | Doc | Claim | Reality |
|---|---|---|---|
| D1 | config-tool/README.md:38 | JSON config changes take effect "immediately (loaded at runtime)" | cues.json/routing.json load at backend startup and system:reset only (`app.js:213-251`, `systemReset.js:188-232`); scoring-config at startup only. Restart/reset required for everything |
| D2 | root CLAUDE.md (Shared Scoring Config) | scoring-config "loaded by both backend and GM Scanner at runtime. No manual sync needed" | GM Scanner bakes it at Vite **build** time (`scoring.js:12`); a config-tool edit requires an ALNScanner rebuild (F-TOOL-05) |
| D3 | config-tool/README.md:86 | Sink pickers offer "(default), hdmi, bluetooth, combine-bt" | `combine-bt` absent from both pickers (`cueEditor.js:26`, `commandForm.js:277`) and from audioRoutingService |
| D4 | config-tool/README.md:110-115 | Infrastructure has a "VLC — VLC host, port, password, reconnection settings" group | Actual group is "Video" with only `VIDEO_DIR`, `VLC_HW_ACCEL` (`infra.js:34-39`); no VLC host/port/password fields exist in the tool |
| D5 | config-tool/README.md:226 | "27 tests" in 2 listed test files | 3 test files, ~45 cases (16+10+19); architecture tree omits `musicModel.test.js`, `sections/music.js`, `sections/musicModel.js`, and `utils/formFields.js` |
| D6 | config-tool/README.md:69 | Cue list filter "Quick Fire (Manual)" shows GM-triggerable cues | Predicate is `quickFire && !trigger` (`showcontrol.js:95`) — "Both"-mode cues (also GM-triggerable) are excluded from that filter |
| D7 | generate_asset_manifest.py:16-18,53-55,128-131 + sync:746-747 + scripts/README.md:115-118 | placeholder.bmp preserved/skipped by tokenId filter | Pattern matches it; it is pruned and manifested (F-TOOL-06) |
| D8 | scripts/README.md:197 | "Uses Notion Integration Token (hardcoded in scripts)" | Env var / .env since the dotenv refactor (`sync:24-41`) |
| D9 | scripts/README.md:210-215 | Filter includes "Memory Token Image" | Sync filters `"Memory Token"` (`sync:535`); only the (broken) compare tool uses "Memory Token Image" (F-TOOL-19) |
| D10 | scripts/README.md:126-133 | "All 21 memory tokens synced", MAB001 status | Stale snapshot; config-tool README says 48 tokens; neither is maintained |
| D11 | scripts/README.md:18-20, 230-232 | Requirements: `requests` (+ troubleshooting suggests `notion-client`) | Actual imports: requests, **Pillow**, dotenv (optional); `notion-client` is never imported. No requirements.txt exists anywhere for scripts/ |
| D12 | capability-matrix row 7.4 | NeurAI generation uses "NeurAI.png logo" | Live inline generator draws an ASCII-block logo; NeurAI.png referenced by no code (F-TOOL-30) |
| D13 | config-tool/README.md:128 | Preset saves "all four config sources" — described as "complete venue configurations" | Excludes assets, tokens, music playlists; "complete" is wrong in the sense venues will assume (preset restore does not restore sounds/videos a cue references) |
| D14 | scripts/README.md (whole) | No mention of asset pruning or manifest generation as sync side-effects | `prune_orphans` deletes files on every run (`sync:749-756`) — the single most dangerous behavior of the script is undocumented in its own README (root CLAUDE.md mentions manifest only) |

---

## Test gaps

**config-tool (3 test files, ~45 cases, no lint, no CI hook):**
- `lib/routes.js` (281L) has **zero** tests — no HTTP-layer tests for: preset import validation,
  asset usage-map building, delete type whitelist, the music proxy error paths, or (most
  importantly) what malformed bodies do to `PUT /config/*` (F-TOOL-04 would surface instantly).
- `envParser` tests cover round-trip happy paths but not: newline-in-value (F-TOOL-03),
  quote-in-value escaping, duplicate keys, object values.
- `configManager` tests assert writes succeed but never assert *rejection* of anything —
  there is no invalid input in the entire suite except path traversal.
- No test for `loadPreset` partial-failure ordering or corrupt-config backup behavior (F-TOOL-11).
- The entire `public/js/` tree (~2,400 lines, where F-TOOL-13/14/15 live) is untested and
  untestable as written (no DOM harness; modules hold top-level singleton state).
- No contract linkage: ACTION_DEFS, TRIGGER_EVENTS, and CONDITION ops are hand-mirrored from
  backend code with no test pinning them (F-TOOL-09/32 are exactly the drift class such a
  test would catch — e.g., a test importing ACTION_DEFS and asserting each key appears in
  commandExecutor's switch, like the existing scanner request-schema-validation pattern).

**scripts/ (zero tests, zero lint, no requirements.txt):**
- `parse_sf_fields`, `extract_timestamp`, `segment_line_for_highlighting` are pure functions —
  trivially unit-testable today, covering F-TOOL-17/29 regression-style.
- `prune_orphans`/`_scan_dir` are pure-ish (tmpdir-testable); a single test would have caught
  F-TOOL-06.
- The fetch/degrade/write pipeline needs a seam (inject the fetcher) before F-TOOL-01's
  behavior can be tested; that seam **is** the planned source-adapter interface (3.2e) — i.e.,
  testability and the adapter refactor are the same work.
- No CI invocation of any script; exit-code-always-0 means even a smoke run can't gate.

---

## Open questions (owner / next wave)

1. **Q-TOOL-1:** Is config-tool expected to run during games or strictly pre-show? Determines
   whether F-TOOL-02 needs auth (shared admin password? bind 127.0.0.1 + SSH tunnel?) or just
   a documented "stop it before doors" rule. Either way `GET /api/config` should stop
   returning secret values it doesn't need to render (mask + write-only).
2. **Q-TOOL-2:** Should sync failure abort before write? Proposed posture for F-TOOL-01:
   any non-200/non-complete pagination → exit 1 with NO write and NO prune; `--force` to
   override; prune gated behind a fresh-and-complete fetch. Does the owner want a
   `--dry-run` (already on README's wishlist) as the default for prune?
3. **Q-TOOL-3:** Are `video:paused`/`video:resumed` *meant* to be standing-cue triggers
   (forward to handleGameEvent) or editor-only mistakes (remove from TRIGGER_EVENTS)? (F-TOOL-09)
4. **Q-TOOL-4:** For the preset split: is the game pack the ALN-TokenData submodule itself
   (extended), or a new artifact? This decides where config-tool's pack-export writes and
   whether F-TOOL-22's submodule-dirtying becomes a feature (pack commit flow) or stays a bug.
5. **Q-TOOL-5:** Should config-tool gain a "nudge backend" action (call `system:reset` or a
   new reload endpoint) after JSON writes, making README's "immediately" claim true instead
   of fixing the doc? (Interacts with D1 and the B8 preflight-verification design.)
6. **Q-TOOL-6:** Backend `cue:fire` chain depth: is there a recursion guard for
   cue→cue:fire→cue loops authorable per F-TOOL-28? (Needs the runtime exploratory pass.)
7. **Q-TOOL-7:** The compare tool (F-TOOL-19) — fix it (portable root + same filter as sync,
   ideally importing the filter from a shared module) or fold its check into sync itself as a
   pre-write validation phase? The latter halves the maintenance surface and feeds Q-TOOL-2.
