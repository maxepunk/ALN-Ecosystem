# Music Cutover Review Record

**Date:** 2026-05-20
**Branch:** `feature/replace-spotify-with-mpd` (parent + `ALNScanner` submodule)
**Plan:** [`docs/superpowers/plans/2026-05-20-replace-spotify-with-mpd.md`](../superpowers/plans/2026-05-20-replace-spotify-with-mpd.md)
**Scope:** 66 parent commits + 11 ALNScanner submodule commits
**Phases:** 0–10 implementation + post-implementation review rounds

This document captures the review and simplification work applied to the
Spotify→MPD migration branch prior to merging to `main`. It exists because
the merge bypassed the standard PR review workflow — the rigor of multiple
parallel subagent reviews replaced the GitHub PR conversation, and this
record preserves their findings for future archaeology.

---

## 1. Pre-merge code review (three parallel reviewers)

Each reviewer received the same git range (`6d61fe69..e8501680`) with
explicit non-overlapping scope to maximize coverage. All three are
`feature-dev:code-reviewer` agents with confidence-based filtering.

### 1A. Backend reviewer

**Scope:** Phases 1–6 (musicService, routes, MPD lifecycle, integration
glue, contracts, integration tests) + backend portion of Phase 10.

**Strengths called out:**
- `MPD_STATE_MAP` normalization with locked-in regression test
- `_pausedByGameClock` sticky-flag correctly distinguishes user-paused
  vs clock-paused (since-removed but originally noted)
- `_quoteMpdArg` correctly handles MPD's quote dialect (backslash + `"`)
  and rejects `\n`/`\r`/`\x00`
- `buildSyncFullPayload` audit guard (static-analysis test) directly
  attacks the recurring sync-full-missing-service bug class
- Phase 10 cleanup structurally complete in `backend/src/`

**Issues raised:**

| # | Severity | Finding | Confidence | Action |
|---|---|---|---|---|
| 1 | Critical | `checkConnection()` reconnect-race listener accumulation | 95 | Applied (commit a5847363) |
| 2 | Critical | Residual `SPOTIFY_DEFAULT_PLAYLIST` in `backend/.env` | 90 | Applied (commit a5847363) |
| 3 | Important | Path traversal not rejected in PUT /playlists track names | 85 | Applied (commit a5847363) |
| 4 | Important | `_wireMpdEvents` could double-register on `init()` retry | 82 | Applied (commit a5847363) |
| 5 | Important | `reset()` doesn't disconnect MPD or stop watcher | 80 | Deferred (matches VLC-pattern design) |

### 1B. Frontend reviewer

**Scope:** Phase 7 (ALNScanner submodule) + Phase 8 (config-tool) +
frontend portion of Phase 10.

**Strengths called out:**
- `MusicRenderer` differential rendering with `_playlistsSig`
- `StateStore` shallow-merge correctly handles music domain
- `musicModel.js` defensively coded with 18-test coverage
- Spotify cleanup complete (`grep -ri spotify` returns zero hits in
  `ALNScanner/src` and `config-tool/`)

**Issues raised:**

| # | Severity | Finding | Confidence | Action |
|---|---|---|---|---|
| 1 | Important | `music:setShuffle`/`setLoop` string-`'false'` → `!!"false" === true` (cue-authoring inversion) | 85 | Applied (commit a5847363) |
| 2 | Important | `music.js section` missing `refresh()` + unguarded `save()` after load error | 82 | Applied (commit a5847363) |

### 1C. Tests / docs / cross-cutting reviewer

**Scope:** Phase 9 E2E + Phase 10 docs (CLAUDE.md, DEPLOYMENT_GUIDE.md) +
audit/coverage + Phase 11 readiness.

**Strengths called out:**
- Spotify audit grep returns zero hits across active code
- E2E skip guards correctly check `serviceHealth.music?.status` AND
  `musicLibraryPopulated()` before running
- `07d-04` `playingPromise` registered before `sendGMCommand(loadPlaylist)`
  (correct race-prevention pattern per project memory)
- Coverage thresholds regenerated post-Phase-10
- DEPLOYMENT_GUIDE MPD content accurate (install + systemctl disable +
  music:seed + PipeWire `aln-music` stream name)

**Issues raised:**

| # | Severity | Finding | Confidence | Action |
|---|---|---|---|---|
| 1 | Important | `console.log()` after `test.skip()` is dead code (10 sites in 07d-04) | 82 | Applied (commit a5847363) |
| 2 | Important | `backend/public/music/` described as "gitignored" but actually untracked | 82 | Applied (commit a5847363) |
| 3 | Minor | DEPLOYMENT_GUIDE MPD content embedded vs standalone heading | 80 | Deferred (placement contextually correct under install block) |
| 4 | Minor | `sendGMCommand` helper duplicated across 3 E2E test files | 80 | Deferred (plan explicit "rewrite in place" scope) |

---

## 2. First-round fixes applied (commit `a5847363`)

```
fix(music): apply final code-review remediations before merge
```

7 fixes touching 7 files:

1. **commandExecutor.js** — `music:setShuffle`/`setLoop` boolean coercion
   (`payload.enabled === true || payload.enabled === 'true'`)
2. **musicRoutes.js** — path traversal validation in PUT /playlists (reject
   absolute paths and `..` segments)
3. **musicService.js** — `_reconnecting` flag + `_eventsWired` idempotency
   guard in `checkConnection` / `_wireMpdEvents`
4. **config-tool/music.js** — `refresh()` export + `save()` loadError guard
5. **.gitignore** — `backend/public/music/*.mp3` (prevents accidental
   commit of 66 production MP3s)
6. **backend/.env** — removed orphaned `SPOTIFY_DEFAULT_PLAYLIST` line
7. **07d-04 E2E** — swapped `test.skip()`/`console.log()` order at 10 sites

**Verification after this commit:** 1654/1655 unit+contract, 65/65
coverage, 46/46 config-tool, 15/15 music integration, 39/39 cue/session/
compound integration, 0 spotify refs in active code.

---

## 3. Post-fix simplification review (three parallel reviewers)

After the remediation commit, three more parallel reviewers performed a
simplification pass. Different reviewer team (`general-purpose`), different
angles (reuse / quality / efficiency).

### 3A. Reuse reviewer

**Verdict:** Zero actionable findings. The implementation reuses existing
patterns appropriately:
- `ProcessMonitor`, `serviceHealthRegistry`, `escapeHtml`, `el()` DOM helper
- `MusicController` matches `SoundController`/`BluetoothController` plain-
  wrapper pattern
- `MusicRenderer` matches `VideoRenderer`/`EnvironmentRenderer` no-base-class
  convention
- Hand-rolled MPD parsing/escaping is defensible:
  - `_quoteMpdArg` fixes a `mpd2.escapeArg` bug (missing backslash escape)
  - `_parseKV` vs `mpd2.parseObject` differ on key normalization (toggling
    the global flag has process-wide effects)

### 3B. Quality reviewer

| # | Severity | Finding | Confidence | Action |
|---|---|---|---|---|
| 1 | Important | `musicService.connected` drifts from `serviceHealthRegistry` on stale-connection ping failure | 85 | Applied (commit ad7d49b1) |
| 3 | Medium | `validatePlaylistsBody` reinvents Joi-style validation | 70 | Deferred (current works; scope creep) |
| 4 | Medium | `musicRoutes.js` reaches into private `_mpd` and `_playlistFile` fields | 75 | Applied (commit ad7d49b1) |
| 5 | Low | `setShuffle/setLoop` coercion comment over-explained | 60 | Applied (commit ad7d49b1) |
| 9 | Low | `validateCommand` doesn't pre-check `music:loadPlaylist.playlistId` | 65 | Applied (commit ad7d49b1) |

### 3C. Efficiency reviewer

| # | Severity | Finding | Confidence | Action |
|---|---|---|---|---|
| 1 | Important | `_pollPosition` 1Hz timer mutates `track.position` but no consumer reads it | 95 | Applied (commit ad7d49b1) |
| 2 | Important | 3× redundant `status` round-trips per MPD state transition (`Promise.all` is misleading; mpd2 serializes) | 80 | Partially applied — `sendCommands` batch for `_handlePlayerEvent`; redundant `_handlePlaylistEvent` folded |
| 3 | Important | `_handlePlaylistEvent` reads status but emits nothing — dead mutation | 75 | Folded into player handler (preserves data while removing round-trip) |

---

## 4. Implementation gap discovered + filled

The efficiency reviewer flagged `_pollPosition` and `_handlePlaylistEvent`
as "dead code" because the data they updated was never observed by any
consumer. Investigation revealed the data **was being pushed** to the
frontend via `service:state.music` — but `MusicRenderer` never rendered it.

This was reframed as a **frontend implementation gap**, not backend bloat:

| Backend field | Surface | Frontend display (before) | Frontend display (after) |
|---|---|---|---|
| `track.position` / `track.duration` | `service:state` | None | Progress bar + mm:ss / mm:ss |
| `playlist.position` / `playlist.total` | `service:state` | None | "Track X of Y" counter |
| `pausedByGameClock` | `service:state` | Plain text | Text with ⏸ icon |

**Fix applied to `MusicRenderer.js`** (submodule commit `24c7db0`):
- Queue counter next to picker (hidden when no playlist)
- Track progress bar with client-side extrapolation at 250ms (no extra
  websocket chatter), correctly handles pause-then-resume timing without
  replaying paused duration
- Clock-paused indicator gains ⏸ icon

**Tests added:** 9 new MusicRenderer tests (3 queue counter + 6 progress bar
including extrapolation, freeze-on-pause, track-change reset, duration cap,
and `_formatTime` edge cases).

The reframe is important: a naive "delete dead code" simplification would
have removed backend capabilities that the frontend should have used all
along. The simplification work simultaneously removed dead code AND added
the frontend consumption that justified keeping the data exposure.

---

## 5. Second-round fixes applied

Two coordinated commits:

### Parent: `ad7d49b1` — `refactor(music): apply simplification review findings`

Backend correctness (`musicService.js` + `commandExecutor.js`):
- `checkConnection` ping-failure branch now `registry.report('music', 'down', ...)`
- `validateCommand` pre-checks `music:loadPlaylist.playlistId` resource

Backend efficiency (`musicService.js`):
- Deleted `_pollPosition` / `_startPositionPolling` / `_stopPositionPolling`
  (1Hz timer mutated invisible state)
- Folded `_handlePlaylistEvent` queue-position update into `_handlePlayerEvent`
  (saves a status round-trip per track change)
- `Promise.all([sendCommand×2])` → `sendCommands(['status','currentsong'])`
  (one command_list batch instead of two serialized calls)

Backend quality (`commandExecutor.js` + `musicService.js` + `musicRoutes.js`):
- Extracted `coerceBool` helper for setShuffle/setLoop
- Added accessor methods: `listAllTracks`, `readPlaylistFileRaw`,
  `writePlaylistFile`, `hasPlaylistFile`
- Moved `parseListAllInfo` from routes to service (MPD protocol parsing is
  service domain)
- Refactored `musicRoutes.js` to use accessors (no more `_mpd`/`_playlistFile`
  access from outside the service)

Test updates:
- `musicService.test.js`: removed position polling tests (methods gone),
  updated player event tests for `sendCommands` signature, added
  `playlist.position` update test
- `musicRoutes.test.js`: rewrote to use accessor contract, added explicit
  path-traversal rejection tests

### Submodule: `24c7db0` — `feat(music): expose queue position + progress bar in MusicRenderer`

Frontend additions described in Section 4 above.

---

## 6. Findings explicitly deferred

| Finding | Reason for deferral |
|---|---|
| `reset()` doesn't disconnect MPD | Deliberate VLC-pattern design — preserves ProcessMonitor across resets. Mock-based integration tests insulate against ghost-event risk. |
| `GET /tracks` checks `_mpd` directly | Cosmetic; narrow inconsistency window when `_mpd` exists but `connected = false` between detection and nulling. |
| DEPLOYMENT_GUIDE.md MPD heading vs install-block placement | Style preference; current placement under `#### Ubuntu/Debian` install block is contextually correct. |
| `sendGMCommand` helper duplicated across 3 E2E test files | Plan explicitly scoped "rewrite in place" rather than abstracting helpers. Acceptable follow-up refactor candidate. |
| `validatePlaylistsBody` reinvents Joi | Current hand-rolled validation works correctly and is short; switching to Joi introduces dep pattern change and risk of error-message format breakage in contract tests. Acceptable follow-up. |

---

## 7. Out-of-scope security note (pre-existing — not blocking)

**`backend/.env` is tracked in git history with real secrets** going back
to commit `331e0fd0` (initial backend implementation):
- `ADMIN_PASSWORD=@LN-c0nn3ct`
- `HOME_ASSISTANT_TOKEN=eyJ…` (long-lived HA JWT)
- Historical `JWT_SECRET=your-secret-key-here-change-in-production` (default placeholder)

This is **pre-existing** — not introduced by this branch. It's been visible
to anyone with repo access since the project was first committed. The
Spotify cleanup happens to remove one line from `.env` (the orphaned
`SPOTIFY_DEFAULT_PLAYLIST` Spotify URI, which is a public playlist
identifier not a credential).

Future cleanup tasks (NOT in scope for this PR):
1. `git rm --cached backend/.env`
2. Verify the `.env` line in root `.gitignore` covers `backend/.env`
   after untracking (it should match by pattern)
3. **Rotate the admin password + HA token** since both are in immutable
   git history accessible to anyone who has ever cloned the repo
4. If the repo ever needs to be made public, do (1)–(3) first

The plan's Phase 10.10 already removed the spotifyd plaintext credentials
from `~/.config/spotifyd/spotifyd.conf` on this Pi. Spotify Premium
credentials in that now-deleted file should be rotated if they were ever
reused elsewhere.

---

## 8. Verification artifacts (final state at commit `ad7d49b1` + submodule `24c7db0`)

| Suite | Result | Suites |
|---|---|---|
| Backend unit+contract | 1656/1657 (1 pre-existing todo) | 87 |
| Backend coverage ratchet | 65/65 files meet thresholds | — |
| Backend music integration | 15/15 | 1 |
| Backend cue/session/compound integration | 39/39 | 3 |
| ALNScanner unit | 1166/1166 | 59 |
| ALNScanner coverage ratchet | 50/50 files meet thresholds | — |
| ALNScanner Vite build | clean (179 kB main bundle) | — |
| Config-tool | 46/46 | 7 |

Cleanup audit grep (run on this branch HEAD):
```
grep -rli "spotify" backend ALNScanner config-tool \
  DEPLOYMENT_GUIDE.md CLAUDE.md \
  --include="*.js" --include="*.json" --include="*.yaml" --include="*.md" \
  --include="*.html" --include="*.ts" --include="*.css" \
  2>/dev/null \
  | grep -vE "node_modules|dist/|\.git|coverage|playwright-report|/data/|backend/docs/plans/|docs/superpowers/plans/"
```
**Result:** empty (zero spotify references in active code).

---

## 9. Manual post-merge verification (Pi-only — Task 11.4)

To run on the Pi after merging both branches:

```bash
git pull --ff-only
git submodule update --init --recursive
cd backend && npm install          # picks up mpd2 dep
cd ../ALNScanner && npm install && npm run build  # rebuild dist for /gm-scanner symlink
cd ../backend && npm run prod:restart

# Smoke
curl -s http://localhost:3000/health | jq
pgrep -a mpd                       # MPD running under ProcessMonitor
ls /tmp/aln-pm-mpd.pid             # PID file exists
mpc -h /tmp/aln-mpd.sock status    # if mpc CLI installed

# When music is playing
pactl list sink-inputs | grep -i "Music Player Daemon"  # confirms aln-music sink-input
```

Functional smoke checklist:
- [ ] GM Scanner admin: pick "All Tracks" → music plays from track 1
- [ ] Next/prev work; loop wraps from track 66 → 1
- [ ] Queue counter advances "Track X of Y" as tracks change
- [ ] Progress bar visibly advances during playback
- [ ] Trigger a video → music ducks to 20%, restores after
- [ ] Trigger a sound effect → music ducks to 40%, restores after
- [ ] Pause game clock → music pauses + clock-paused indicator shows
- [ ] Resume game clock → music resumes (only if it was clock-paused)
- [ ] Fire a cue with `music:loadPlaylist` → playlist switches
- [ ] `kill -9 $(cat /tmp/aln-pm-mpd.pid)` → MPD respawns
- [ ] Backend restart → sync:full delivers music + playlists to GM
- [ ] `dpkg -l | grep spotifyd` → no results
- [ ] `ls /usr/local/bin/spotifyd` → no such file

---

## Process notes (for next time)

This branch used a heavier review process than typical:
- 3 parallel review subagents pre-merge
- 3 parallel simplification subagents post-fix
- 64 + 11 commits with disciplined TDD per the plan

The dual-review pattern (independent reviewer triads at different points)
caught a surprising amount: the second round's efficiency reviewer noticed
dead position-polling that the first round missed, and that observation
itself led to recognizing the frontend implementation gap. Worth repeating
for similarly-sized cross-cutting refactors.

The plan file
([`docs/superpowers/plans/2026-05-20-replace-spotify-with-mpd.md`](../superpowers/plans/2026-05-20-replace-spotify-with-mpd.md))
is comprehensive and self-contained — it would have been adequate
documentation on its own. This review record adds the *audit trail* of
what reviewers actually said and which findings became commits, which the
plan file can't capture by nature.
