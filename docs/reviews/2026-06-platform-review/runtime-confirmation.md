# Runtime Confirmation — Wave-1 Findings

**Date:** 2026-06-10
**Method:** real orchestrator process driven via HTTP + socket.io clients; GM scanner and
player scanner driven via headless Chromium (Playwright library scripts, no repo changes);
two narrowly-scoped in-process probes where the environment lacked VLC/MPD.
**Verdict summary: 11 CONFIRMED, 0 REFUTED, 1 confirmed-as-intended (F-SCAN-08), 1 skipped
(F-SCAN-04/D2, statically verified per brief), plus 2 NEW runtime defects (F-RT-01, F-RT-02).**

---

## 1. Environment recipe (repeatable harness)

Headless Linux container, Node v22.22.2, no VLC/MPD/PipeWire/Bluetooth/HA.

```bash
# 1. Backend deps
cd backend && npm ci

# 2. REQUIRED: stub missing binaries — the orchestrator CRASHES at boot without them (see F-RT-02)
mkdir -p /tmp/fakebin
printf '#!/bin/sh\nif [ "$1" = "subscribe" ]; then exec sleep 100000; fi\nexit 0\n' > /tmp/fakebin/pactl
printf '#!/bin/sh\nexec sleep 100000\n' > /tmp/fakebin/cvlc
chmod +x /tmp/fakebin/pactl /tmp/fakebin/cvlc
# (CI gets pactl from `apt-get install pulseaudio-utils`; nothing provides cvlc in CI —
#  CI never boots src/server.js with video enabled, which is why this never surfaced.)

# 3. Run the orchestrator with degraded-services env
cd backend
env PATH="/tmp/fakebin:$PATH" NODE_ENV=development PORT=3000 \
  ENABLE_HTTPS=false ENABLE_MUSIC_PLAYBACK=false HA_DOCKER_MANAGE=false \
  LIGHTING_ENABLED=false FEATURE_IDLE_LOOP=false DISCOVERY_ENABLED=false \
  DATA_DIR=/tmp/aln-rt-data LOGS_DIR=/tmp/aln-rt-logs ENABLE_VIDEO_PLAYBACK=true \
  node src/server.js
# Health: curl http://localhost:3000/health
# Resulting service health: audio/cueengine/gameclock healthy; vlc/music/sound/bluetooth/lighting down.

# 4. GM scanner (serves at http://localhost:3000/gm-scanner/ via dist symlink)
cd ALNScanner && npm ci && npx playwright install chromium && npm run build

# 5. Driver scripts (this run's copies in /tmp/rt/*.js): plain node scripts using
#    backend/node_modules/socket.io-client and ALNScanner/node_modules/playwright-core
#    (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers). Auth: POST /api/admin/auth
#    {password:'@LN-c0nn3ct'} → JWT → socket.io handshake auth
#    {token, deviceId, deviceType:'gm', version}; sessions via gm:command
#    session:create + session:start; scans via wrapped transaction:submit envelope.
```

Gotchas for the next harness run:
- `kill` the **node** PID (find via `ps aux | grep src/server.js`), not the wrapping shell —
  a half-killed server caused an EADDRINUSE non-restart that initially produced a false
  REFUTED for F-BCORE-02. Always verify port 3000 is free before "restart" assertions.
- `/api/scan/batch` requires `batchId` (400 without it).
- Player scanner served at `/player-scanner/` (networked-mode path detection works there);
  manual scans via `window.app.handleScan(tokenId)` in page context.

---

## 2. Per-finding verdicts

### F-BCORE-01 — session metadata never updates for GM scans — **CONFIRMED (P0)**
Fresh session, 3 accepted GM transactions (`ale001`, `ale002`, `ash001`; 150000/225000/75000 pts).
`GET /api/session` after each:
```json
"metadata": {"gmStations":1, "playerDevices":0, "totalScans":0, "uniqueTokensScanned":[],
             "scannedTokensByDevice": {"GM_RT_1": ["ale001","ale002"]}}
```
`totalScans` stays 0 and `uniqueTokensScanned` stays `[]` forever, while
`scannedTokensByDevice` (a different writer) populates fine — exactly the
idempotency-check early-return described in backend-core-review.

### F-BCORE-02 — score reset + restart resurrects pre-reset scores — **CONFIRMED (P0)**
Team R scans `ale004` → 450000. `score:reset` ack success. Observed all three predicted stages:
1. **Inconsistent reset broadcast:** the post-reset `sync:full` carried top-level
   `scores: [{currentScore:0, baseScore:0, ...}]` but
   `session.scores: [{currentScore:0, baseScore:450000, tokensScanned:1, transactionCount:0, lastUpdated:...}]`
   — including the two **nonexistent fields** (`transactionCount`, `lastUpdated`) the listener writes.
2. **Disk state** (`session:current`): `currentScore:0` with stale `baseScore:450000`.
3. **Resurrection:** genuine restart (verified new PID, no EADDRINUSE) → restored scores show
   `currentScore:0 / baseScore:450000`; first new scan (`ash002`, 150000) →
   `transaction:new.teamScore = {currentScore:600000, baseScore:600000}`. The full 450000 returned.

Note: the bug only fires if the restart happens before any post-reset scan for that team — a
post-reset transaction's `transaction:accepted` upsert overwrites the stale session copy
(observed during the aborted first attempt). Game-night window: reset, then crash/restart.

### F-BCORE-03 — transaction:delete wipes ALL teams' admin adjustments — **CONFIRMED (P0)**
Team A: 2 scans + `score:adjust +123456` → in-memory `currentScore:498456`,
`adminAdjustments:[{delta:123456,...}]`. Deleted one of **Team B's** transactions. After delete:
- in-memory/sync: Team A `currentScore:375000`, `adminAdjustments: []` — the adjustment and its
  audit trail are gone, for a team unrelated to the delete.
- persisted `session.scores`: Team A **still 498456 with the adjustment** — the predicted
  split-brain (only the affected team is upserted), so the on-disk audit now contradicts every
  live broadcast until Team A's next scan overwrites it.

### F-SCAN-04 / D2 — backend offline-drain drops player scans / setOfflineStatus unreachable —
**SKIPPED (statically verified in wave 1, per brief).**

### F-SCAN-05 — batch replay queues videos, even with NO session — **CONFIRMED (P1)**
Two-part runtime evidence:
1. **Live server (VLC down):** `/api/scan/batch` with NO current session, entries `rem001`/`kai001`
   (video tokens, timestamps 2h old) → 200, all `status:"processed"`, video entries returned
   `"message":"Video playback unavailable"` — i.e. the handler consulted `canAcceptVideo()` for a
   session-less batch; only the VLC outage stopped the queueing.
2. **In-process (VLC health forced, vlc methods stubbed):** same no-session batch →
   `videoQueueService.addToQueue` **was called** (spy: `addToQueue CALLED rem001 PLAYER_RT_X`),
   response `videoQueued:true`, queue length 1. A 2-hour-old replayed scan starts a video at
   upload time with no game running, exactly as flagged.

### F-SCAN-08 — player scans during paused session — **CONFIRMED WORKING (intended per owner)**
Session paused (verified `status:"paused"`). Player `POST /api/scan ale003` → **200 accepted**,
persisted (`sync:full.playerScans` contains it), `player:scan` broadcast to GM room. Video token
`rem001` during pause also reaches the video path (409 only because VLC is down here; with VLC up
it would queue). GM transactions remain blocked in paused sessions. Behavior matches the
"intel gathering is ungated" intent — recommend documenting it (incl. that **videos can start
during pause**, which the owner may still want gated separately).

### F-GMCMD-08 — video transport acks success for no-ops — **CONFIRMED (P1)**
In-process with VLC health forced and **nothing playing**:
`pauseCurrent()`/`skipCurrent()` returned `false`, yet
`executeCommand('video:pause'|'video:skip'|'video:play')` each returned
`{success:true, message:"Video playback paused"|"Video skipped successfully"|"Video playback resumed"}`.
Also with `features.videoPlayback=false` (service call skipped entirely): still
`{success:true}`. Contrast confirmed on the live server: with VLC down the
SERVICE_DEPENDENCIES gate correctly rejects (`"vlc is down: D-Bus unreachable"`).

### F-GMS-01 — standalone reload bricks scanning — **CONFIRMED (P0)**
Built dist served by backend. Standalone → team "RT Reload Team" → manual scan `ale001` →
"Transaction Complete!" (works). **Reload** → lands on `teamEntryScreen` but:
- `document.body.className` is `""` (missing `standalone-mode` class — sub-claim (d) confirmed);
- entering a team and clicking Confirm **never reaches the scan screen** (timeout), with
  **zero console errors** — the silent `_createTeamOnBackend → 'Not connected'` failure path.
The GM cannot get past team entry after a mid-show reload.

### F-GMS-06 — mode toggle not persisted across reload — **CONFIRMED (P2)**
Clicked mode indicator: "Detective Mode" → "Black Market Mode". `localStorage.getItem('mode')`
**null** after toggle. Reload → indicator back to "Detective Mode". A station toggled to Black
Market silently reverts to non-scoring Detective on any reload.

### F-GMCMD-04 — clicking the playlist `<select>` fires music:loadPlaylist — **CONFIRMED (P1)**
Networked GM connected via the real wizard (station auto-assign + password). One caveat: in this
environment music is down so the picker renders `disabled`; removed only the `disabled`
attribute in-page to simulate MPD-up, then sent a plain click on the **closed** select:
```
framesent: 42["gm:command",{"event":"gm:command","data":{"action":"music:loadPlaylist",
            "payload":{"playlistId":"all-tracks"}}, ...}]
```
Server log shows `[executeCommand] action=music:loadPlaylist source=gm` — the command executed
from the click alone (it was only inert because MPD is absent here). Selecting an option then
fired the **same command a second time** (change event). With MPD up this is "music restarts
when the GM touches the picker," twice.

### F-SCAN-07 / F-GMS-05 — cross-device GM duplicate shows false success — **CONFIRMED (P1)**
GM#1 (socket) claims `ash001` for Team R (75000 accepted). GM#2 (browser, same team) scans the
same token. Backend correctly sent GM#2:
`transaction:result {status:"duplicate", points:0, message:"Token already claimed by Team R", claimedBy:"Team R"}`
— but GM#2's screen showed **"Transaction Complete!"**, still showed it 2.5s later, and no
toast/error element appeared. The rejection is invisible to the operator.

### F-SCAN-01 — web player scanner requeues 409-rejected scans — **CONFIRMED (core mechanism, P0)**
Player scanner at `/player-scanner/` (networked). Scanned video token `rem001` → backend 409
("Video playback unavailable"; would be `video_busy` with VLC up — same non-OK path). Observed:
1. The scan **was persisted server-side anyway** (`playerScans` count went 0 → 1; persistence
   happens before the video check), and
2. the client **also queued it for replay**: console `"Scan failed … Queued offline: rem001"`,
   `localStorage.offline_queue = [{"tokenId":"rem001","teamId":"001","retryCount":0}]`.
Combined with the confirmed batch behavior (F-SCAN-05: batch persists again **and** calls
`addToQueue`), the replay produces the duplicate record + surprise later playback. The
hours-later video replay itself wasn't run end-to-end here (no VLC), but both halves of the
mechanism were observed live.

### F-GMCMD-01 — paused video unrepresentable in state — **CONFIRMED (backend half, P0)**
In-process probe (stubbed VLC, simulated playing queue item): `pauseCurrent()` succeeded
(returned `true`, vlc.pause called) yet `getState()` reported `status:"playing"` immediately
after and 2s later, with `position` advancing `0.00003 → 0.0668` on wall-clock **while paused**
(`videoQueueService.js:566-589` has no paused status and computes position from
`Date.now() - playbackStart`). The scanner-renderer half (progress bar animation) was not
exercised — but any client of `getState()`/`service:state` receives "Playing + advancing"
for a paused video. UNTESTABLE-HERE for the full VLC round-trip.

---

## 3. NEW defects observed (F-RT-NN)

### F-RT-01 — `player:scan` broadcast claims `videoQueued:true` for scans whose video was rejected
`backend/src/routes/scanRoutes.js:110-124`: the GM-room broadcast sets
`videoQueued: token.hasVideo()` and is emitted **before** the `canAcceptVideo()` check.
Observed live: `rem001` scan returned 409 to the player (`videoQueued:false` in the HTTP
response) while GMs simultaneously received `player:scan {tokenId:"rem001", videoQueued:true}`.
Game Activity tells operators a video is queued when it was rejected. (Same field is then
persisted truthfully? — no: `addPlayerScan` doesn't store videoQueued; only the broadcast lies.)
Severity: P2 (operator-facing misinformation during the exact VLC-outage/busy windows that
already confuse game night).

### F-RT-02 — orchestrator crashes at boot when `pactl` or `cvlc` binaries are absent
First boot attempt (no stubs) died with
`uncaughtException: spawn pactl ENOENT` (audioRoutingService's `pactl subscribe`
ProcessMonitor) and, with pactl stubbed, `uncaughtException: spawn cvlc ENOENT`
(vlcMprisService's VLC ProcessMonitor) — process exit 1 despite every service init being
documented as "non-blocking: logs a warning and continues". `spawn` ENOENT is emitted as an
async `error` event on the child process; `ProcessMonitor` (backend/src/utils/processMonitor.js)
doesn't attach an `error` handler, so it escapes as an uncaughtException. Root CLAUDE.md's
"service degradation should let it boot anyway" does not hold on a machine missing the
binaries (CI masks this: it installs pulseaudio-utils and never boots the full server with
video enabled). Severity: P1 for the platform goal (venue portability / dev onboarding);
fix is a one-line `error` listener + degraded health report.

### Minor observations (not tagged)
- With dbus absent, `VLC-dbus-monitor` enters a 5s restart loop forever (log noise; no backoff cap).
- `GET /api/session` exposes `metadata` but not `scores`/`transactions` — fine, but it means
  F-BCORE-01's broken counters are the *only* scan stats that endpoint offers.
- GM scanner connection wizard worked cleanly end-to-end against the degraded backend
  (station auto-assignment, JWT, sync:full) — the happy path really is solid, matching the
  wave-1 big-picture conclusion.

---

## 4. Scorecard

| Finding | Verdict |
|---|---|
| F-BCORE-01 | CONFIRMED |
| F-BCORE-02 | CONFIRMED (incl. inconsistent sync:full + bogus persisted fields) |
| F-BCORE-03 | CONFIRMED (incl. memory/disk split-brain) |
| F-SCAN-01 | CONFIRMED (requeue + double-persist halves observed; VLC replay not runnable) |
| F-SCAN-04 / D2 | SKIPPED (statically verified, per brief) |
| F-SCAN-05 | CONFIRMED (addToQueue fires session-less) |
| F-SCAN-07 / F-GMS-05 | CONFIRMED (false "Transaction Complete!", no operator signal) |
| F-SCAN-08 | CONFIRMED working as intended (incl. video path during pause) |
| F-GMCMD-01 | CONFIRMED backend half; full VLC round-trip UNTESTABLE-HERE |
| F-GMCMD-04 | CONFIRMED (click on closed select executes command server-side) |
| F-GMCMD-08 | CONFIRMED (no-op + feature-off both ack success) |
| F-GMS-01 | CONFIRMED (silent brick after standalone reload) |
| F-GMS-06 | CONFIRMED (mode reverts on reload) |
| NEW F-RT-01 | player:scan broadcasts videoQueued:true for rejected videos |
| NEW F-RT-02 | boot crash on missing pactl/cvlc (uncaught spawn ENOENT in ProcessMonitor) |

No wave-1 finding was refuted. One earlier *apparent* refutation of F-BCORE-02 was traced to a
botched restart (EADDRINUSE; old process survived) — re-run with a verified restart confirmed
the bug exactly as written.
