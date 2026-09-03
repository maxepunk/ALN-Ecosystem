# Environment Control Roadmap — Phases 1-4 Design

**Date:** 2026-02-13 (updated 2026-02-14)
**Status:** Phases 1-3 complete, Phase 4 pending
**Foundation:** Phase 0 complete (Bluetooth speaker management, PipeWire audio routing, Home Assistant lighting scenes)
**PRD Reference:** `docs/proposals/environment-control-phase0-prd.md`
**Phase 1 Plan:** `docs/plans/2026-02-14-environment-control-phase1.md`
**Phase 1 Branch:** `phase1/cue-engine` (parent + ALNScanner submodule)
**Phases 2-3 Plan:** `docs/plans/2026-02-14-environment-control-phases-2-3.md`
**Phases 2-3 Branch:** `phase2/compound-cues-spotify` (parent + ALNScanner submodule)

---

## 1. Architectural Principle: Cues Are Automated GM Commands

The entire environment control system beyond Phase 0 rests on one insight: **a cue is a `gm:command` that fires automatically instead of being tapped manually by the GM.**

The existing `gm:command` architecture already handles lighting, video, display mode, audio routing, Bluetooth, scoring, and session control. Rather than building a parallel action system for automated environment control, the cue engine dispatches the same commands through the same code path.

```
┌─────────────────────────────────────────────────────────────┐
│                     gm:command execution                     │
│                                                              │
│  GM taps button ──┐                                          │
│                   ├──▶ executeCommand({action, payload,      │
│  Cue engine ──────┘      source: 'gm' | 'cue'})             │
│                                                              │
│  Same handler. Same broadcasts. Same side effects.           │
│  Distinguished in logs by the `source` field.                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

Extract the command-handling logic from `adminEvents.js` into a shared `executeCommand({action, payload, source, trigger?})` function. The WebSocket handler calls it with `source: 'gm'`. The cue engine calls it with `source: 'cue'` and an optional `trigger` field for provenance (e.g., `"trigger": "cue:opening-sequence@30s"` or `"trigger": "event:group:completed"`).

All existing `gm:command` actions are automatically cue-able. New actions (Spotify, sounds, compound cues) are added to the same list and are also cue-able from day one.

**Re-entrancy guard:** When `executeCommand()` is called with `source: 'cue'`, standing cue evaluation is skipped. This prevents infinite loops (cue fires command → command triggers event → event matches standing cue → cue fires command...). Standing cues only evaluate against game events, not cue-dispatched commands.

**Simultaneous cue execution:** When multiple cues fire at the same clock time (or from the same event), all execute in definition order (position in `cues.json`). For shared resources like lighting, last-write-wins — the final cue to set a lighting scene determines the visible result. This is intentional and predictable.

---

## 2. Game Clock: The Master Heartbeat

The game clock is the sole time authority for the cue engine. It's a single `setInterval(1000)` that ticks every second while the game is active — one tick source, multiple consumers.

### Session Lifecycle

Currently `createSession()` sets status to `active` and starts the overtime timer immediately. Setup time (pairing speakers, testing audio, adding teams) counts against the 120-minute game window. The new lifecycle adds a `setup` phase:

```
session:create          session:start          session:pause
     │                       │                      │
     ▼                       ▼                      ▼
   SETUP ──────────────▶ ACTIVE ◀──────────────▶ PAUSED

                            │
                            ▼
                          ENDED
```

| Phase | Session Status | Clock | Cue Engine | Transactions |
|-------|---------------|-------|------------|--------------|
| **Setup** | `setup` | Stopped, elapsed = 0 | Inactive | Rejected |
| **Active** | `active` | Running | Listening + firing | Accepted |
| **Paused** | `paused` | Frozen (elapsed preserved) | Suspended | Rejected |
| **Ended** | `ended` | Stopped | Cleared | Rejected |

- `session:create` — Creates session in `setup` status (networked mode) or `active` status (standalone mode — no cue engine or game clock in standalone). GM can add teams, pair speakers, test audio routing, verify Spotify cache, review loaded cues. No game clock, no cue engine, no transactions.
- `session:start` — Transitions `setup` → `active` (networked only). Records `gameStartTime`. Starts the game clock. Activates the cue engine. Transactions now accepted. Standalone mode skips this step — sessions are immediately active on creation.
- `session:pause` / `session:resume` — Existing commands gain clock behavior (see Pause Cascade below).
- `session:end` — Stops everything.

### Pause Cascade

When the game pauses, **everything** pauses. One action, total freeze:

```
session:pause
  ├── Game clock freezes (elapsed time preserved)
  ├── Cue engine suspends
  │   ├── Standing cues stop evaluating
  │   ├── Clock-triggered cues disarmed
  │   └── Active compound cues frozen
  ├── Active video-driven compound cue → VLC paused (flagged as clock-paused)
  ├── Spotify → paused
  └── Transaction processing → rejects with "session paused"

session:resume
  ├── Game clock resumes
  ├── Cue engine reactivates
  │   ├── Standing cues resume listening
  │   ├── Clock-triggered cues rearmed
  │   └── Compound cues pick up where stopped
  ├── VLC resumes (only if clock-paused, not if GM had manually paused)
  ├── Spotify → resumes
  └── Transaction processing → accepts again
```

The `pausedByGameClock` flag ensures resume only auto-starts things the pause stopped — not things the GM had already manually paused before the game pause. The flag is stored on `stateService`'s VLC state (for video) and on `spotifyService`'s internal state (for Spotify). Each service checks its own flag on resume.

### What the Game Clock Drives

**Clock-triggered cues.** Standing cues with a `clock` trigger that fire at specific elapsed times:

```json
{
  "id": "midgame-tension",
  "trigger": { "clock": "01:00:00" },
  "commands": [
    {"action": "lighting:scene:activate", "payload": {"sceneId": "scene.tension_amber"}}
  ]
}
```

Fired once when elapsed time reaches the threshold. Marked as fired so they don't re-trigger.

**Clock-driven compound cue timing.** Instead of spawning independent `setInterval` timers, compound cues without video subscribe to the game clock tick and check `gameClockElapsed - cueStartElapsed >= nextEntryTime`. One timer, N consumers.

**Overtime detection.** Replaces the current standalone `setTimeout`. The game clock checks elapsed time against the configured threshold on each tick. Only counts actual game time (paused time excluded).

### What the Game Clock Does NOT Drive

**Video-driven compound cues** still sync to VLC's `video:progress` position. Video playback has its own clock — a 30-second timeline entry in a video means 30 seconds into the video, regardless of when in the game it started. The game clock notes *when* the video-driven compound cue started (for logging and session analysis).

**Event-triggered standing cues** remain purely event-driven. They fire on event match, not on clock ticks.

### Implementation

```javascript
// gameClockService.js — tracks paused time in milliseconds for precision
start() {
  this.gameStartTime = Date.now();
  this.totalPausedMs = 0;
  this.interval = setInterval(() => this.tick(), 1000);
}

tick() {
  const elapsed = this.getElapsed();
  this.emit('gameclock:tick', { elapsed });
}

getElapsed() {
  const now = this.status === 'paused' ? this.pauseStartTime : Date.now();
  return Math.floor((now - this.gameStartTime - this.totalPausedMs) / 1000);
}

pause() {
  this.pauseStartTime = Date.now();
  clearInterval(this.interval);
}

resume() {
  this.totalPausedMs += Date.now() - this.pauseStartTime;
  this.interval = setInterval(() => this.tick(), 1000);
}
```

The `gameclock:tick` event is internal only (not broadcast over WebSocket — too chatty). Consumers (cue engine, compound cues, overtime) listen within the backend process.

### Persistence

Game clock state is stored on the session model, persisted via `sessionService.saveCurrentSession()`:

```json
{
  "gameClock": {
    "startTime": "2026-02-14T19:30:00.000Z",
    "pausedAt": null,
    "totalPausedMs": 0
  }
}
```

On backend restart, `sessionService.init()` restores from `persistenceService.load('session:current')`. The game clock service recalculates elapsed from `startTime` + `totalPausedMs`. This is the same pattern used for transactions, scores, and player scans — the session model is the single source of truth, persisted after every mutation.

The current standalone overtime `setTimeout` does NOT survive restarts. The game clock replaces it with tick-based checking against persisted elapsed time, which does survive.

---

## 3. Unified Cue Model

Everything is a **cue**. There are two types and three evaluation contexts:

### Two Types

| Type | Has | Execution | Lifecycle |
|------|-----|-----------|-----------|
| **Simple cue** | `commands` array | All commands fire immediately | Fire-and-forget. No state, no progress, not shown in Active Cues. |
| **Compound cue** | `timeline` array | Commands fire at timed positions (`{ at, action, payload }`) | Has state (started/running/paused/completed), progress tracking, shown in Active Cues UI, can be paused/stopped. |

A compound cue is not a separate concept — it's a cue with a timeline. `cue:fire` is polymorphic: simple cues execute immediately, compound cues start a timeline.

**`commands` and `timeline` are mutually exclusive.** A cue has one or the other. The `commands` array is semantically a degenerate timeline where everything fires at position zero — but without lifecycle tracking. If you need immediate setup actions before a timed sequence, use `"at": 0` entries at the start of the timeline. The cue engine validates this at load time: a cue with both `commands` and `timeline` is rejected with an error identifying the offending cue ID.

### Three Evaluation Contexts

One mechanism, evaluated in different contexts:

| Context | What advances it | Example |
|---------|-----------------|---------|
| **Event** | A game event fires | Play fanfare on `group:completed` |
| **Clock** | Game clock ticks to threshold | Shift playlist at minute 60 |
| **Timeline** | Active compound cue position advances | At 30s into video, flash lights |

These are NOT three separate mechanisms. A cue is a cue regardless of what triggers it.

### Standing Cues

Cues with a `trigger` field are standing cues — they're registered for the session and auto-fire when conditions match. A standing cue can be:

- **Event-triggered:** `"trigger": { "event": "transaction:accepted" }` — fires when the named event occurs and all conditions match
- **Clock-triggered:** `"trigger": { "clock": "01:00:00" }` — fires when game clock reaches the specified elapsed time

Standing cues can be simple or compound. An event-triggered compound cue starts its timeline when the event fires. A clock-triggered compound cue starts its timeline at the specified game time.

### Condition Matching

Standing cues optionally include a `conditions` array evaluated against normalized trigger event fields:

```json
{
  "id": "business-sale-fanfare",
  "trigger": { "event": "transaction:accepted" },
  "conditions": [
    { "field": "memoryType", "op": "eq", "value": "Business" },
    { "field": "teamScore", "op": "gte", "value": 500000 }
  ],
  "commands": [
    { "action": "sound:play", "payload": { "file": "big-sale.wav" } }
  ]
}
```

Multiple conditions use implicit AND (all must be true). No structural OR — use the `in` operator for multi-value matching, or create separate cues for true cross-field OR.

**Operators:**

| Op | Example | Use Case |
|----|---------|----------|
| `eq` | `"value": "Technical"` | Exact match |
| `neq` | `"value": "Technical"` | Exclusion |
| `gt`, `gte`, `lt`, `lte` | `"value": 500000` | Numeric thresholds |
| `in` | `"value": ["Technical", "Business"]` | Multi-value match |

### Event Payload Normalization

Internal backend events have nested payloads (e.g., `transaction:accepted` carries `{transaction: {...}, teamScore: {...}, groupBonus: {...}}`). Cue authors should not need to know internal payload structure. The cue engine normalizes each event to a flat evaluation context before condition matching:

```javascript
// cueEngineService.js
const EVENT_NORMALIZERS = {
  'transaction:accepted': (payload) => ({
    tokenId:      payload.transaction.tokenId,
    teamId:       payload.transaction.teamId,
    deviceType:   payload.transaction.deviceType,
    points:       payload.transaction.points,
    memoryType:   payload.transaction.memoryType,
    valueRating:  payload.transaction.valueRating,
    groupId:      payload.transaction.groupId,
    teamScore:    payload.teamScore?.currentScore ?? 0,
    hasGroupBonus: payload.groupBonus !== null,
  }),
  'group:completed': (payload) => ({
    teamId:     payload.teamId,
    groupId:    payload.groupId,
    multiplier: payload.multiplier,
    bonus:      payload.bonus,
  }),
  'video:loading':   (payload) => ({ tokenId: payload.tokenId }),
  'video:started':   (payload) => ({ tokenId: payload.queueItem?.tokenId, duration: payload.duration }),
  'video:completed': (payload) => ({ tokenId: payload.queueItem?.tokenId }),
  'video:paused':    (payload) => ({ tokenId: payload?.tokenId }),
  'video:resumed':   (payload) => ({ tokenId: payload?.tokenId }),
  'player:scan':     (payload) => ({ tokenId: payload.tokenId, deviceId: payload.deviceId, deviceType: payload.deviceType }),
  'session:created': (payload) => ({ sessionId: payload.sessionId }),
  'cue:completed':   (payload) => ({ cueId: payload.cueId }),
  'sound:completed': (payload) => ({ file: payload.file }),
  'spotify:track:changed': (payload) => ({ title: payload.title, artist: payload.artist }),
  'gameclock:started':     (payload) => ({ gameStartTime: payload.gameStartTime }),
};
```

This follows the same pattern as `broadcasts.js`, which already transforms internal event payloads before sending them over WebSocket. The normalizer IS the schema — the "Key Payload Fields" column in the Available Trigger Events table below documents exactly what fields are available for condition matching after normalization.

When an unknown event fires (no normalizer defined), the cue engine passes the raw payload through unchanged. This allows new events to be used in cues before a normalizer is written, with the understanding that field paths may need updating if the internal payload later changes.

### Manual Cues

Cues without a `trigger` field are manual-only — they appear in the GM's Quick Fire grid but never auto-fire. The GM taps them to fire via `cue:fire {cueId}`.

### Compound Cue Nesting

A compound cue can fire another cue via `cue:fire` in its timeline:

```json
{
  "id": "grand-finale",
  "timeline": [
    { "at": 0,  "action": "lighting:activate", "payload": { "sceneId": "blackout" } },
    { "at": 3,  "action": "cue:fire", "payload": { "cueId": "dramatic-reveal" } },
    { "at": 60, "action": "spotify:play", "payload": { "playlist": "finale" } },
    { "at": 65, "action": "cue:fire", "payload": { "cueId": "evidence-montage" } }
  ]
}
```

No special nesting mechanism — `cue:fire` is just another command dispatched through `executeCommand()`. The child cue runs its own independent timeline.

**Cycle detection:** The cue engine maintains a visited set per execution chain. When `cue:fire` dispatches a nested cue, the parent's cue ID is added to the chain. If a `cue:fire` targets a cue ID already in the chain, it's logged as an error and skipped. Maximum nesting depth is capped at 5 levels as a safety limit.

**Cascading stop:** When a parent compound cue is stopped, all children it spawned are also stopped. The cue engine tracks a `spawnedBy` relationship at runtime. Pause/resume also cascade to children.

### Behavior Flags

| Flag | Default | Effect |
|------|---------|--------|
| `once` | `false` | When true, auto-disables after first fire (like the GM pressing Disable) |
| `quickFire` | `false` | When true, appears as a tile in the GM's Quick Fire grid |

### Available Trigger Events

All events below are existing backend internal events (emitted by their respective services via EventEmitter). The cue engine listens to these directly — no new events are created for cue triggering. The "Key Payload Fields" column shows the **normalized** flat fields available for condition matching (see Event Payload Normalization above).

| Event | Source | Key Payload Fields (normalized) |
|-------|--------|--------------------------------|
| `transaction:accepted` | transactionService | `tokenId`, `teamId`, `deviceType`, `points`, `memoryType`, `valueRating`, `groupId`, `teamScore`, `hasGroupBonus` |
| `group:completed` | transactionService | `groupId`, `teamId`, `multiplier`, `bonus` |
| `video:loading` | videoQueueService | `tokenId` |
| `video:started` | videoQueueService | `tokenId`, `duration` |
| `video:completed` | videoQueueService | `tokenId` |
| `video:paused` | videoQueueService | `tokenId` |
| `video:resumed` | videoQueueService | `tokenId` |
| `player:scan` | sessionService | `tokenId`, `deviceId`, `deviceType` |
| `session:created` | sessionService | `sessionId` |
| `cue:completed` | cueEngineService (new) | `cueId` |
| `sound:completed` | soundService (new) | `file` |
| `spotify:track:changed` | spotifyService (new) | `title`, `artist` |
| `gameclock:started` | gameClockService (new) | `gameStartTime` |

Clock-triggered cues use `"trigger": { "clock": "HH:MM:SS" }` instead of event matching.

---

## 4. Compound Cues and the Queue

Compound cues with video integrate with the existing `videoQueueService`:

### Queue Rules

1. **No video in compound cue** → Start immediately. No queue involvement. No conflict possible.
2. **Has video, nothing playing** → Start immediately through queue.
3. **Has video, something already playing** → GM gets a `cue:conflict` event with [Override] and [Cancel] options. If GM doesn't respond within 10 seconds, the cue is automatically cancelled. GM's response is a `gm:command`.

### Compound Cue Timeline

- **Video-driven compound cues:** Timeline positions sync to VLC's `video:progress` events (fires every 1 second). At 30s means 30 seconds into the video.
- **Clock-driven compound cues** (no video): Timeline positions derive from the game clock tick (see Section 2) — no independent timers.

### GM Video Actions on Media Compound Cues (Decisions D12, D35)

A video-driven compound cue's timeline is driven by `video:progress` events. GM video actions on the cue's video are therefore actions on the cue itself — no separate "suspend" mechanism needed:

| GM action | Effect on video-driven compound cue |
|-----------|------------------------------|
| `video:pause` | Cue pauses naturally (no progress events → timeline stalls). Cue state = `paused`. |
| `video:resume` | Cue resumes (progress events resume → timeline advances). Cue state = `running`. |
| `video:stop` | Cue stops. Timeline cancelled, cascading stop to children. |
| `video:play` (different file) | Cue stops (video replaced → old cue is dead). |

The cue engine watches video lifecycle events. When `video:paused` fires and the paused video matches an active compound cue's video, the cue engine updates cue state to `paused` for the Active Cues UI. Same for `video:resumed` → `running`, `video:completed` → `completed`.

**Clock-driven compound cues** (no video) have no implicit pause path — the GM uses explicit `cue:pause {cueId}` or `session:pause` (cascade).

**Concurrent and state resources** do NOT affect running compound cues. Sound effects overlap naturally (each pw-play is a separate process). Lighting is last-write-wins. The GM can freely trigger sounds or adjust lighting alongside running compound cues. Only video is an exclusive resource — one video at a time on the display.

### Timeline Error Handling

When a command in a compound cue timeline fails (pw-play crashes, VLC connection drops, lighting API error), the cue engine:

1. **Logs** the error with cue ID, timeline position, and failed action
2. **Toasts** the GM via WebSocket: `cue:error {cueId, action, position, error}`
3. **Continues** the timeline — remaining entries still fire at their scheduled positions

A failed command in a live show is better handled by the GM seeing a notification and deciding whether to intervene, rather than the system aborting an entire choreographed sequence.

---

## 5. Audio Architecture

### Streams

Phase 0 has one stream (`video`). The full model adds:

| Stream | Source Process | Description |
|--------|---------------|-------------|
| `video` | VLC | Video/audio playback |
| `spotify` | spotifyd | Spotify soundtrack |
| `sound` | pw-play | Sound effects |

Each stream is a PipeWire sink-input identified by `application.name`. Each can be independently routed to any available sink and have its volume adjusted independently.

### Global Routing with Fallbacks

One global routing configuration, persisted via `persistenceService`:

```json
{
  "routes": {
    "video": {"sink": "combine-bt", "fallback": "hdmi"},
    "spotify": {"sink": "combine-bt", "fallback": "hdmi"},
    "sound": {"sink": "combine-bt", "fallback": "hdmi"}
  }
}
```

Resolution at playback time: try configured sink → try fallback → warn GM. The existing `routing:fallback` event broadcasts to the GM Scanner.

### Routing Inheritance (3 Tiers)

```
Global routing config (base for all streams)
  └── Compound cue routing override (optional, for this cue's duration)
        └── Individual command target (optional, for this specific command)
```

Most specific wins. Example: global says sounds go to `combine-bt`. A compound cue overrides sound routing to `bt-right`. But one specific command within that cue specifies `"target": "bt-left"`. That sound plays on `bt-left`.

Compound cue routing override:

```json
{
  "id": "the-confrontation",
  "timeline": [
    {"at": 10, "action": "sound:play", "payload": {"file": "door-creak.wav", "target": "bt-left"}},
    {"at": 25, "action": "sound:play", "payload": {"file": "glass-break.wav"}}
  ],
  "routing": {"sound": "bt-right"}
}
```

Here `door-creak.wav` plays on `bt-left` (command override). `glass-break.wav` plays on `bt-right` (compound cue override). Video audio plays on `combine-bt` (global default).

**Routing resolution happens at command dispatch time in the cue engine — not as a persistent override on `audioRoutingService`.** When the cue engine dispatches a timeline command, it resolves the target sink using the 3-tier hierarchy and passes the resolved target in the command payload to `executeCommand()`. By the time `soundService` or `audioRoutingService` sees the command, routing is already resolved — they play to the specified target, or fall back to global if no target specified.

This means:
- **No revert needed when a compound cue ends.** The override is the cue definition's `routing` field, read at dispatch time. No persistent state is created or torn down.
- **Overlapping compound cues resolve independently.** Each cue resolves its own routing per-command. No conflict between concurrent cues with different routing overrides.
- **GM global routing changes take effect immediately** for any cue commands that don't have a cue-level or command-level override. The cue engine reads the current global config at dispatch time.
- **No changes to `audioRoutingService` for compound cue routing.** The cue engine is the only component aware of the routing inheritance hierarchy.

### Multi-Speaker: PipeWire Combine-Sink

The Pi 5's built-in Bluetooth adapter connects to multiple A2DP speakers. PipeWire's `libpipewire-module-combine-stream` creates a virtual sink (`combine-bt`) that forwards audio to both BT speakers simultaneously. Individual speakers remain addressable by their sink names (`bt-left`, `bt-right`) for directional effects.

### Per-Stream Volume

`pactl set-sink-input-volume <sink-input-id> <volume>` adjusts volume per-stream. The `audioRoutingService` already identifies sink-inputs by `application.name`. New `gm:command`: `audio:volume:set {stream, volume: 0-100}`.

### Ducking

Automatic rule-based defaults with command override capability. The ducking engine is **event-driven** — it listens to `videoQueueService` and `soundService` events rather than polling or maintaining a separate state machine:

| Service Event | Ducking Action |
|---------------|---------------|
| `video:started` (videoQueueService) | Duck Spotify per rules |
| `video:completed` (videoQueueService) | Restore Spotify |
| `video:paused` (videoQueueService) | Restore Spotify (video audio stops) |
| `video:resumed` (videoQueueService) | Re-duck Spotify |
| `sound:started` (soundService) | Duck Spotify (lighter) |
| `sound:completed` (soundService) | Restore (if no other sounds active) |

These are the same `videoQueueService` events already used by `stateService.js` for state coordination — the ducking engine subscribes alongside it, not via a separate mechanism.

Default ducking rules (in global config):

```json
{
  "duckingRules": [
    {"when": "video", "duck": "spotify", "to": 20, "fadeMs": 500},
    {"when": "sound", "duck": "spotify", "to": 40, "fadeMs": 200}
  ]
}
```

The `when` field maps to a stream name, not a pseudo-event. The ducking engine activates the rule when any event from that stream indicates playback started, and deactivates when playback ends.

When a video starts, Spotify automatically ducks to 20%. When the video ends, it restores. A compound cue command can override this — e.g., `{"action": "audio:volume:set", "payload": {"stream": "spotify", "volume": 80}}` keeps Spotify louder during a specific video.

---

## 6. Sounds: pw-play

Sound effects are played via `pw-play` (native PipeWire, fire-and-forget):

```javascript
const proc = spawn('pw-play', [
  '--target', sinkName,
  '--volume', String(volume),
  filePath
]);
```

- Concurrent sounds overlap naturally (each is a separate process/PipeWire node)
- Stop a sound by killing its process
- No looping support — use pre-rendered longer audio files or Spotify for ambient/looping audio. A dedicated non-Spotify ambient audio path (e.g., looping pw-play or GStreamer) may be developed in a future phase if needed
- Lightweight: 3-8 MB per instance, exits when playback finishes

New `gm:command` actions:
- `sound:play {file, target?, volume?}` — play sound, optional speaker/volume override
- `sound:stop {file?}` — kill running pw-play by filename, or all if no file specified

---

## 7. Spotify Integration

### Technology: spotifyd + D-Bus MPRIS

[spotifyd](https://github.com/Spotifyd/spotifyd) (or [raspotify](https://github.com/dtcooper/raspotify)) runs as a lightweight Rust daemon (~30-50 MB). Creates a PipeWire sink-input routable like any other stream. Controlled locally via D-Bus MPRIS interface — no internet required for playback control.

**Why not the official Spotify client:** No ARM64 Linux build exists. spotifyd/raspotify are the only options on Pi 5.

### Offline Playback

spotifyd uses librespot, which downloads complete tracks in 128KB chunks and caches them to disk at the configured `cache_path`. Cache persists across reboots.

**One-time setup workflow:**
1. Connect Pi to internet
2. Run pre-cache script: plays through each game playlist with audio routed to a null sink (inaudible)
3. librespot caches every track to disk
4. Disconnect internet — cached tracks play offline from that point forward

**Session setup verification:**
`spotify:cache:verify` command checks that all tracks in all configured game playlists are present in the cache. Returns status to the GM Scanner admin panel: green (all cached) or red (N tracks missing, connect to internet to re-cache). This runs during session setup, NOT at every startup.

### gm:command Actions

| Action | Payload | Notes |
|--------|---------|-------|
| `spotify:play` | `{}` | Resume playback (D-Bus MPRIS Play) |
| `spotify:pause` | `{}` | Pause (D-Bus MPRIS Pause) |
| `spotify:stop` | `{}` | Stop (D-Bus MPRIS Stop) |
| `spotify:next` | `{}` | Next track (D-Bus MPRIS Next) |
| `spotify:previous` | `{}` | Previous track (D-Bus MPRIS Previous) |
| `spotify:playlist` | `{uri}` | Switch playlist (D-Bus MPRIS OpenUri) |
| `spotify:volume` | `{volume: 0-100}` | Set volume (D-Bus MPRIS Volume) |
| `spotify:cache:verify` | `{}` | Verify playlists cached, return status |

All callable manually by GM or automatically by cues.

---

## 8. Configuration

### File Layout

```
backend/config/environment/
  routing.json        ← Global routing + fallbacks + ducking rules
  cues.json           ← All cue definitions (simple + compound, standing + manual)
backend/public/
  audio/              ← Sound effect files (.wav) for pw-play (parallel to videos/)
```

### routing.json

```json
{
  "routes": {
    "video": {"sink": "combine-bt", "fallback": "hdmi"},
    "spotify": {"sink": "combine-bt", "fallback": "hdmi"},
    "sound": {"sink": "combine-bt", "fallback": "hdmi"}
  },
  "duckingRules": [
    {"when": "video", "duck": "spotify", "to": 20, "fadeMs": 500},
    {"when": "sound", "duck": "spotify", "to": 40, "fadeMs": 200}
  ]
}
```

### cues.json — Schema

Each cue definition follows this structure:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique cue identifier |
| `label` | string | Yes | Display name for GM UI |
| `icon` | string | No | Icon hint for Quick Fire tile (`sound`, `video`, `alert`, etc.) |
| `quickFire` | boolean | No | Show as tile in Quick Fire grid (default: false) |
| `once` | boolean | No | Auto-disable after first fire (default: false) |
| `trigger` | object | No | Standing cue trigger. Absent = manual-only |
| `trigger.event` | string | Conditional | Event name to match (mutually exclusive with `clock`) |
| `trigger.clock` | string | Conditional | Game elapsed time `"HH:MM:SS"` (mutually exclusive with `event`) |
| `conditions` | array | No | Array of `{field, op, value}` predicates. Implicit AND. |
| `routing` | object | No | Per-cue audio routing override (e.g., `{"sound": "bt-right"}`) |
| `commands` | array | Conditional | Simple cue: commands to fire immediately (mutually exclusive with `timeline`) |
| `timeline` | array | Conditional | Compound cue: `{at, action, payload}` entries where `at` is elapsed seconds (mutually exclusive with `commands`) |

### cues.json — Full Example

```json
{
  "cues": [
    {
      "id": "first-scan-fanfare",
      "label": "First Scan",
      "icon": "sound",
      "quickFire": false,
      "once": true,
      "trigger": { "event": "transaction:accepted" },
      "conditions": [],
      "commands": [
        { "action": "sound:play", "payload": { "file": "fanfare.wav" } }
      ]
    },

    {
      "id": "business-sale",
      "label": "Business Sale",
      "icon": "sound",
      "trigger": { "event": "transaction:accepted" },
      "conditions": [
        { "field": "memoryType", "op": "eq", "value": "Business" }
      ],
      "commands": [
        { "action": "sound:play", "payload": { "file": "big-sale.wav" } },
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.flash_green" } }
      ]
    },

    {
      "id": "attention-before-video",
      "label": "Pre-Video Alert",
      "icon": "alert",
      "trigger": { "event": "video:loading" },
      "commands": [
        { "action": "sound:play", "payload": { "file": "attention.wav" } },
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.dim" } }
      ]
    },

    {
      "id": "restore-after-video",
      "label": "Post-Video Restore",
      "icon": "alert",
      "trigger": { "event": "video:completed" },
      "commands": [
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.house_lights" } }
      ]
    },

    {
      "id": "group-reveal",
      "label": "Group Reveal",
      "icon": "video",
      "quickFire": true,
      "trigger": { "event": "group:completed" },
      "timeline": [
        { "at": 0,  "action": "lighting:scene:activate", "payload": { "sceneId": "scene.dim" } },
        { "at": 2,  "action": "sound:play", "payload": { "file": "reveal-sting.wav" } },
        { "at": 3,  "action": "video:play", "payload": { "file": "group-reveal.mp4" } },
        { "at": 35, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.house_lights" } }
      ]
    },

    {
      "id": "midgame-tension",
      "label": "Midgame Tension Shift",
      "icon": "alert",
      "once": true,
      "trigger": { "clock": "01:00:00" },
      "commands": [
        { "action": "spotify:playlist", "payload": { "uri": "spotify:playlist:act2" } },
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.tension_amber" } }
      ]
    },

    {
      "id": "overtime-warning",
      "label": "Overtime Warning",
      "icon": "alert",
      "once": true,
      "trigger": { "clock": "01:45:00" },
      "commands": [
        { "action": "sound:play", "payload": { "file": "warning.wav" } },
        { "action": "lighting:scene:activate", "payload": { "sceneId": "scene.warning" } }
      ]
    },

    {
      "id": "countdown-atmosphere",
      "label": "Final Countdown",
      "icon": "alert",
      "quickFire": true,
      "once": true,
      "trigger": { "clock": "01:50:00" },
      "timeline": [
        { "at": 0,  "action": "lighting:scene:activate", "payload": { "sceneId": "scene.urgent_amber" } },
        { "at": 0,  "action": "spotify:pause", "payload": {} },
        { "at": 30, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.urgent_red" } },
        { "at": 60, "action": "sound:play", "payload": { "file": "buzzer.wav" } },
        { "at": 60, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.blackout" } }
      ]
    },

    {
      "id": "tension-hit",
      "label": "Tension Hit",
      "icon": "sound",
      "quickFire": true,
      "commands": [
        { "action": "sound:play", "payload": { "file": "tension.wav" } }
      ]
    },

    {
      "id": "opening-sequence",
      "label": "Opening Sequence",
      "icon": "video",
      "quickFire": true,
      "once": true,
      "trigger": { "clock": "00:00:05" },
      "routing": { "sound": "combine-bt" },
      "timeline": [
        { "at": 0,  "action": "lighting:scene:activate", "payload": { "sceneId": "scene.blackout" } },
        { "at": 2,  "action": "video:play", "payload": { "file": "opening.mp4" } },
        { "at": 5,  "action": "sound:play", "payload": { "file": "intro-sting.wav" } },
        { "at": 65, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.gameplay" } }
      ]
    },

    {
      "id": "grand-finale",
      "label": "Grand Finale",
      "icon": "video",
      "quickFire": true,
      "timeline": [
        { "at": 0,  "action": "lighting:scene:activate", "payload": { "sceneId": "scene.blackout" } },
        { "at": 3,  "action": "cue:fire", "payload": { "cueId": "dramatic-reveal" } },
        { "at": 60, "action": "spotify:playlist", "payload": { "uri": "spotify:playlist:finale" } },
        { "at": 60, "action": "spotify:play", "payload": {} },
        { "at": 65, "action": "cue:fire", "payload": { "cueId": "evidence-montage" } }
      ]
    },

    {
      "id": "the-confrontation",
      "label": "The Confrontation",
      "icon": "video",
      "quickFire": true,
      "routing": { "sound": "bt-right" },
      "timeline": [
        { "at": 0,  "action": "lighting:scene:activate", "payload": { "sceneId": "scene.dim" } },
        { "at": 0,  "action": "video:play", "payload": { "file": "confrontation.mp4" } },
        { "at": 10, "action": "sound:play", "payload": { "file": "door-creak.wav", "target": "bt-left" } },
        { "at": 30, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.red_pulse" } },
        { "at": 30, "action": "sound:play", "payload": { "file": "tension-hit.wav" } },
        { "at": 45, "action": "lighting:scene:activate", "payload": { "sceneId": "scene.reveal" } }
      ]
    }
  ]
}
```

---

## 9. Complete gm:command Action List

### Existing (Phase 0, implemented)

| Category | Actions |
|----------|---------|
| Session | `session:create`, `session:pause`, `session:resume`, `session:end`, `session:addTeam` |
| Video | `video:play`, `video:pause`, `video:stop`, `video:skip`, `video:queue:add`, `video:queue:reorder`, `video:queue:clear` |
| Display | `display:idle-loop`, `display:scoreboard`, `display:toggle`, `display:status` |
| Scoring | `score:adjust`, `score:reset` |
| Transaction | `transaction:delete`, `transaction:create` |
| System | `system:reset` |
| Bluetooth | `bluetooth:scan:start`, `bluetooth:scan:stop`, `bluetooth:pair`, `bluetooth:unpair`, `bluetooth:connect`, `bluetooth:disconnect` |
| Audio Routing | `audio:route:set` |
| Lighting | `lighting:scene:activate`, `lighting:scenes:refresh` |

### New (Phases 1-4)

| Category | Action | Payload | Service |
|----------|--------|---------|---------|
| Session | `session:start` | `{}` | sessionService → cueEngineService |
| Cue | `cue:fire` | `{cueId}` | cueEngineService (polymorphic) |
| Cue | `cue:stop` | `{cueId}` | cueEngineService (cascades to children) |
| Cue | `cue:pause` | `{cueId}` | cueEngineService (cascades to children) |
| Cue | `cue:resume` | `{cueId}` | cueEngineService |
| Cue | `cue:enable` | `{cueId}` | cueEngineService |
| Cue | `cue:disable` | `{cueId}` | cueEngineService |
| Sound | `sound:play` | `{file, target?, volume?}` | soundService (pw-play) |
| Sound | `sound:stop` | `{file?}` | soundService |
| Spotify | `spotify:play` | `{}` | spotifyService (D-Bus) |
| Spotify | `spotify:pause` | `{}` | spotifyService |
| Spotify | `spotify:stop` | `{}` | spotifyService |
| Spotify | `spotify:next` | `{}` | spotifyService |
| Spotify | `spotify:previous` | `{}` | spotifyService |
| Spotify | `spotify:playlist` | `{uri}` | spotifyService |
| Spotify | `spotify:volume` | `{volume: 0-100}` | spotifyService |
| Spotify | `spotify:cache:verify` | `{}` | spotifyService |
| Audio | `audio:volume:set` | `{stream, volume: 0-100}` | audioRoutingService |

**DRY implementation:** Spotify transport commands use a BT_COMMANDS-style lookup table. Cue management commands (`fire/stop/pause/resume/enable/disable`) use a similar pattern.

---

## 10. New Backend Services

### gameClockService.js

The master time authority. Single `setInterval(1000)` heartbeat when the game is active. Separated from the cue engine for clean single-responsibility.

**Responsibilities:**
- Start/pause/resume the game clock
- Emit `gameclock:tick` with elapsed seconds (excluding paused time)
- Persist clock state to session model via `sessionService.saveCurrentSession()`
- Restore clock state on backend restart from session model
- Overtime detection: check elapsed time against configured threshold on each tick

**Pattern:** `module.exports = new GameClockService()` with EventEmitter, `init()`/`cleanup()`/`reset()`.

**Events emitted:**
- `gameclock:tick` — `{elapsed}` (internal only, not broadcast)
- `gameclock:started` — `{gameStartTime}`
- `gameclock:paused` — `{elapsed}`
- `gameclock:resumed` — `{elapsed}`

### cueEngineService.js

The core cue orchestration service. Listens to the game clock and game events, evaluates cues, dispatches commands.

**Responsibilities:**
- Load cue definitions from `cues.json` at startup
- Listen to game events, evaluate event-triggered standing cues, dispatch matching commands via `executeCommand()`
- Listen to `gameclock:tick`, evaluate clock-triggered cues, fire once when elapsed time threshold reached
- Manage compound cue lifecycle: start/pause/resume/stop
- Track compound cue timeline (VLC position for video-driven cues, game clock offset for clock-driven cues)
- Fire timed commands when timeline crosses entry positions
- Track parent-child relationships for cascading stop
- Track compound cue state from video lifecycle events (`video:paused` → cue paused, `video:stopped` → cue stopped)
- **Timeline error handling**: log failed commands, toast GM via `cue:error`, continue timeline
- **Pause cascade**: on `session:pause`, suspend all active cues, pause active media (VLC/Spotify)

**Pattern:** `module.exports = new CueEngineService()` with EventEmitter, `init()`/`cleanup()`/`reset()`.

**Events emitted:**
- `cue:fired` — `{cueId, trigger, source}` (Phase 1)
- `cue:started` — `{cueId, hasVideo}` (Phase 2: compound cue timeline began)
- `cue:completed` — `{cueId}`
- `cue:paused` — `{cueId, reason: 'gm-video-action' | 'game-paused' | 'manual'}` (Phase 2)
- `cue:error` — `{cueId, action, position, error}` (timeline command failed, continuing)

### spotifyService.js

Wraps D-Bus MPRIS interface for spotifyd control. Responsibilities:
- Detect spotifyd availability
- Transport controls (play/pause/stop/next/previous)
- Playlist switching via `OpenUri`
- Volume control
- Cache verification (inspect cache directory for track completeness)
- Current track metadata

**Pattern:** Same singleton EventEmitter pattern.

**Events emitted:**
- `track:changed` — `{title, artist, album}`
- `playback:changed` — `{state: 'playing'|'paused'|'stopped'}`
- `connection:changed` — `{connected: boolean}`

### soundService.js

Wraps `pw-play` for sound effect playback. Responsibilities:
- Spawn `pw-play` processes with target sink and volume
- Track running sound processes (by file or generated ID)
- Kill processes for `sound:stop`
- Cleanup all running sounds on service shutdown
- Resolve target sink from routing inheritance (global → compound cue → command)

**Pattern:** Same singleton EventEmitter pattern.

**Events emitted:**
- `sound:started` — `{file, target, volume, pid}`
- `sound:completed` — `{file, pid}`
- `sound:stopped` — `{file, pid, reason: 'killed'|'error'}`
- `sound:error` — `{file, error}` (file not found or pw-play spawn failure)

---

## 11. Modified Existing Services

### sessionService.js

- Add `setup` status to session lifecycle. `createSession()` now creates session with `status: 'setup'` instead of `'active'`
- New `session:start` handler transitions `setup` → `active`, records `gameStartTime`, notifies `gameClockService` to start the game clock
- `session:pause` now also tells `gameClockService` to pause and `cueEngineService` to suspend (cascade freeze)
- `session:resume` now also tells `gameClockService` to resume and `cueEngineService` to reactivate (cascade unfreeze)
- Remove standalone `startSessionTimeout()` / `stopSessionTimeout()` — overtime detection moves to game clock
- `gameStartTime` stored on session model (separate from `startTime` which tracks when the admin session was created)

### transactionService.js

- Add session status check early in `processScan()`: reject with `"No active game"` if session status is not `active` (covers both `setup` and `paused` states)
- Same check in `createManualTransaction()`

### audioRoutingService.js (Phase 2+)

- Expand `VALID_STREAMS` from `['video']` to `['video', 'spotify', 'sound']`
- Add `fallback` field to route entries in persistence format
- Add `audio:volume:set` support via `pactl set-sink-input-volume`
- Add ducking rule engine (watch for video/sound playback events, auto-adjust Spotify volume)
- Add combine-sink creation/management for multi-speaker default
- Detect spotifyd and pw-play sink-inputs by `application.name`

### videoQueueService.js (Phase 2)

- Extend queue item concept to support compound cue video (polymorphic: video item vs. compound cue item)
- When processing a compound cue item: start video (if present) via `vlcService`, then activate the cue engine's timeline
- Video conflict detection: if video-driven compound cue starts while something is playing, emit `cue:conflict` event to GM Scanner
- Clock-driven compound cues (no video) bypass the queue entirely (cueEngineService handles them directly)

### adminEvents.js + commandExecutor.js (Phase 1: extracted)

- Command logic extracted to `backend/src/services/commandExecutor.js` (separate module, not inline in adminEvents)
- WebSocket handler in `adminEvents.js` delegates to `executeCommand()` with `source: 'gm'`
- `executeCommand()` returns `{success, message, data?, source, broadcasts[]}` — broadcasts array separates socket emission from command logic
- Add all new gm:command cases (cue, sound, spotify, audio volume)
- Log `source` field with every command execution

### app.js (Phase 1)

- Load cue config from `config/environment/cues.json`
- Initialize Phase 1 services (`gameClockService`, `cueEngineService`, `soundService`) alongside Phase 0 services
- Call `setupCueEngineForwarding()` to wire event listeners

### systemReset.js (Phase 1)

- Reset Phase 1 services (`gameClockService`, `cueEngineService`, `soundService`) during `system:reset`
- Re-wire cue engine event forwarding after reset (via `cueEngineWiring.js`)
- Reload cue config from file

### cueEngineWiring.js (Phase 1: new utility)

- Extracted event forwarding setup shared by `app.js` and `systemReset.js`
- Registers tracked listeners from game services → `cueEngineService.handleGameEvent()`
- Uses `listenerRegistry` for cleanup-safe listener management

### broadcasts.js

- Add event bridges for new services (cueEngine, spotify, sound)
- Phase 1 WebSocket events broadcast to GM room:
  - `gameclock:status` — `{state: 'running'|'paused'|'stopped', elapsed}` (on start/pause/resume, NOT every tick)
  - `cue:fired` — `{cueId, trigger, source}` (point-in-time notification)
  - `cue:completed` — `{cueId}`
  - `cue:error` — `{cueId, action, position, error}` (timeline command failed, continuing)
  - `sound:status` — `{playing: [{file, target}]}`
- Phase 2 WebSocket events:
  - `cue:status` — `{cueId, state, progress?, duration?}` (active compound cue progress)
  - `cue:conflict` — `{cueId, reason, currentVideo}` (video conflict prompt, auto-cancels after 10s)
  - `spotify:status` — `{state, track?, volume?, playlist?}`

### orchestratorClient.js (GM Scanner)

Add to `messageTypes` array:
- `gameclock:status`
- `cue:fired`
- `cue:status`
- `cue:completed`
- `cue:error`
- `cue:conflict`
- `spotify:status`
- `sound:status`

---

## 12. GM Scanner Admin UI

### Deployment Mode

All cue engine features are **networked-only**. Standalone mode serves offline games without venue hardware — cue features require backend + venue infrastructure. The Show Control section uses `data-requires="networked"` and is hidden automatically in standalone mode via the existing CSS rule.

### Session Management (updated)

Session panel gains the `setup` → `active` lifecycle:

**Setup state:**
```
┌─────────────────────────────────────────────┐
│ 🔧 Friday Night Game — SETUP                │
│                                              │
│ Created: 7:15 PM                             │
│ Teams: 3                                     │
│ Cues: 14 loaded                              │
│ Game Clock: Not Started                      │
│                                              │
│ [       ▶ Start Game       ]  [End Session]  │
└─────────────────────────────────────────────┘
```

**Active state:**
```
┌─────────────────────────────────────────────┐
│ SESSION                       ⏱ 01:23:45    │
│                                              │
│ Friday Night Game                            │
│ Teams: 4  |  Scans: 42                       │
│                                              │
│ [Pause]                       [End Session]  │
└─────────────────────────────────────────────┘
```

The elapsed clock display is driven by `gameclock:status` events from the backend (on start/pause/resume) plus local `setInterval` rendering between status events.

### Show Control (NEW — `data-requires="networked"`)

New admin section between Video Controls and Audio Output. The GM's view into cue engine activity and manual intervention controls.

**Active Cues** — Shows compound cues currently executing:
```
┌─── Active Cues ──────────────────────────────────┐
│ ▶ "Opening Sequence"  [02:15 / 04:30]  [⏸] [⏹]  │
│ ▶ "Ambient Loop"      [spotify]        [⏹]       │
│                                                   │
│ (empty when nothing running)                      │
└───────────────────────────────────────────────────┘
```
Simple cues fire-and-forget — they don't appear here. Each compound cue gets pause and stop buttons. Progress bar for timeline position.

**Quick Fire** — Tile grid of manually-fireable cues:
```
┌─── Quick Fire ───────────────────────────────────┐
│ [🎵 Tension Hit] [🎵 Reveal Sting]               │
│ [📺 Evidence Reel] [🔦 Blackout]                  │
│ [📺 Grand Finale] [📺 The Confrontation]          │
└───────────────────────────────────────────────────┘
```
Populated from `cueEngine.cues[]` where `quickFire: true`, sent via `sync:full`. Same tile pattern as lighting scenes (`data-action="admin.fireCue"`, `data-cue-id`). Active compound cues get `.cue-tile--active` class.

**Standing Cues** — Toggle list for event/clock-triggered cues:
```
┌─── Standing Cues ────────────────────────────────┐
│ ✅ attention-before-video        [Disable]        │
│ ✅ business-sale                 [Disable]        │
│ ✅ midgame-tension (01:00:00)    [Disable]        │
│ ❌ overtime-warning (disabled)    [Enable]         │
└───────────────────────────────────────────────────┘
```
GM can disable standing cues they don't want auto-firing tonight, re-enable later.

**Now Playing** — Spotify status:
```
┌─── Now Playing ──────────────────────────────────┐
│ 🎵 Spotify: "Noir Jazz Vol 2" — Track 4          │
│ [⏮] [⏸] [⏭]              [🔊 ████████░░ 80%]    │
│ Playlist: Game Soundtrack              [Change ▼] │
└───────────────────────────────────────────────────┘
```

### Audio Routing (expanded)

Per-stream dropdowns replacing the Phase 0 HDMI/Bluetooth radio toggle:

```
┌─────────────────────────────────────────────┐
│ AUDIO ROUTING                               │
├─────────────────────────────────────────────┤
│ Video Audio     [Both BT Speakers  ▼]       │
│ Spotify Music   [Both BT Speakers  ▼]       │
│ Sound Effects   [Both BT Speakers  ▼]       │
└─────────────────────────────────────────────┘
```

Dropdown options populated from available sinks: HDMI, BT Speaker 1, BT Speaker 2, Both BT Speakers (combine-sink).

### System Status (expanded)

Add cue engine indicator alongside existing status dots:

```
Orchestrator: ● Connected
VLC:          ● Connected
Cue Engine:   ● 14 cues (3 active)
```

### Controller Architecture

| Controller | Commands | Pattern |
|------------|----------|---------|
| `CueController` | `cue:fire/stop/pause/resume/enable/disable`, `session:start` | BT_COMMANDS-style lookup |
| `SpotifyController` | `spotify:play/pause/stop/next/previous/playlist/volume/cache:verify` | BT_COMMANDS-style lookup |
| `SoundController` | `sound:play`, `sound:stop` | Direct sendCommand |

All use `sendCommand(connection, action, payload, timeout)` from existing `utils/CommandSender.js`.

### Cue Icon Mapping

The `icon` field in cue definitions maps to visual indicators in the Quick Fire grid:

| Icon Value | Display | Use Case |
|------------|---------|----------|
| `sound` | Speaker/waveform | Sound effects, audio cues |
| `video` | Play/film | Video playback, media sequences |
| `alert` | Bell/flash | Attention cues, warnings, transitions |
| `lighting` | Lightbulb | Lighting-only cues |
| `music` | Musical note | Spotify/playlist cues |

Icons are rendered via CSS classes (`.cue-icon--{value}`) following the existing tile pattern used for lighting scenes. Unrecognized or missing `icon` values fall back to `.cue-icon--default` (generic cue indicator).

### MonitoringDisplay New Event Handlers

```javascript
// In _handleMessage() switch:
case 'gameclock:status':   // Update clock display in session section
case 'cue:fired':          // Toast notification + update cue activity
case 'cue:status':         // Update Active Cues progress
case 'cue:completed':      // Remove from Active Cues list
case 'cue:error':          // Toast notification (timeline command failed, cue continues)
case 'cue:conflict':       // Toast with [Override] [Cancel] buttons (auto-cancels after 10s)
case 'spotify:status':     // Update Now Playing subsection
case 'sound:status':       // Brief indicator (fire-and-forget, low priority)
```

### sync:full Expansion

Three new sections in the sync:full payload (built by expanded `syncHelpers.js`):

```javascript
{
  // ...existing: session, scores, recentTransactions, videoStatus,
  //     devices, systemStatus, playerScans, environment ...

  cueEngine: {
    loaded: true,
    cues: [/* summary only: {id, label, icon, quickFire, once, triggerType, enabled} — NO commands/timeline arrays */],
    activeCues: [/* {id, state, progress, duration} for currently executing compound cues */],
    disabledCues: [/* IDs of disabled standing cues */],
  },
  spotify: {
    connected: true,
    state: 'playing',
    track: { title: '...', artist: '...' },
    volume: 70,
    playlist: 'spotify:playlist:act1',
    cacheStatus: 'verified',
  },
  gameClock: {
    status: 'running',  // stopped | running | paused
    elapsed: 3600,
    expectedDuration: 7200,
  },
}
```

Graceful degradation: each new section returns safe defaults when services are unavailable (following existing `buildEnvironmentState()` pattern).

### GM Workflow Scenarios

**Pre-game setup:**
1. GM connects, selects Networked mode
2. Creates session → enters `setup` status
3. Adds teams, pairs BT speakers, tests audio routing
4. Show Control section shows loaded cues
5. Reviews standing cues, disables any not wanted tonight
6. Verifies Spotify cache status
7. Presses "Start Game" → `session:start` → clock starts, cues activate

**Standing cue auto-fires:**
1. Game event occurs (e.g., Business token scanned)
2. Cue engine evaluates standing cues, condition matches
3. `executeCommand()` dispatched with `source: 'cue'`
4. GM sees toast: "Cue fired: Business Sale"
5. Lighting tiles and audio routing update automatically

**GM manual trigger:**
1. GM taps "Tension Hit" in Quick Fire grid
2. `cue:fire {cueId: 'tension-hit'}` → backend
3. Sound plays via pw-play (fire-and-forget, no conflict)

**Video conflict:**
1. Compound cue with video triggered while video is playing
2. GM sees toast: "Conflict: 'Evidence Reel' would interrupt 'Opening Sequence'"
3. Toast has [Override] and [Cancel] buttons
4. Override → replaces current (old compound cue stops). Cancel → discards.

**GM video control during compound cue:**
1. Video-driven compound cue running ("The Confrontation" — video + lighting + sound timeline)
2. GM pauses video via Video Controls
3. Compound cue pauses naturally (timeline stalls — no progress events)
4. Active Cues UI shows ⏸ state
5. GM resumes video → compound cue resumes from where it paused

**Pause cascade:**
1. GM presses Pause → `session:pause`
2. Clock freezes, compound cues pause, Spotify pauses, transactions rejected
3. Show Control reflects paused state (active cues show ⏸)
4. GM presses Resume → everything resumes from where it stopped

---

## 13. Incremental Delivery Phases

### Phase 1: Game Clock + Cue Engine + Sounds + Standing Cues — COMPLETE

**Status:** ✅ Implemented on `phase1/cue-engine` branch (2026-02-14). 14 parent commits, 4 ALNScanner submodule commits. All tests passing (865 unit + 214 integration + E2E).

**What:** The core automation layer. Game clock as master heartbeat with setup/active/paused session lifecycle. Standing cues (event-triggered + clock-triggered) watch game events and clock, fire gm:commands. Sounds via pw-play. Attention sound before video. Lighting reactions to game events.

**New services:** `gameClockService`, `cueEngineService`, `soundService`, `commandExecutor` (extracted), `cueEngineWiring` (extracted)
**Modified:** `sessionService` (setup phase, `session:start`, game clock integration), `transactionService` (status check), `adminEvents.js` (executeCommand extraction + new actions), `broadcasts.js`, `systemReset.js` (cue engine re-wiring), `app.js` (service initialization)
**Config:** `backend/config/environment/cues.json`, `backend/config/environment/routing.json` (expanded)
**GM Scanner:** Session setup/start flow, live game clock display, Show Control section (standing cues list, Quick Fire grid for simple cues), CueController, SoundController, MonitoringDisplay event handlers
**No new hardware/software installs.**

**Delivered:**
- Session setup phase (GM preps without eating into game time)
- Explicit "Start Game" action with live elapsed clock display
- Pause/resume cascades through entire system (clock, cues, media, transactions)
- Clock-triggered cues (shift music at minute 60, trigger countdown at minute 110)
- Event-triggered standing cues (attention sound + dim lights before video, restore after)
- Sound effects on transactions (cha-ching on Business sale, fanfare on group completion)
- Manual cue firing via Quick Fire grid
- Standing cue enable/disable
- 13 event normalizers for flat condition evaluation (transaction:accepted, group:completed, video:*, player:scan, session:created, cue:completed, sound:completed, gameclock:started)
- Re-entrancy guard (cue-dispatched commands don't re-trigger standing cues)
- Cue engine event wiring survives system:reset

**Deferred to Phase 2+:**
- Per-stream volume control via `audio:volume:set` (audioRoutingService expansion — roadmap Section 5)
- Overtime detection via game clock (straightforward to add — currently the existing setTimeout approach still works)
- `audioRoutingService` VALID_STREAMS expansion and fallback field (roadmap Section 5, 11)

### Phase 2: Compound Cues + Spotify — COMPLETE

**What:** Time-synced compound cue timelines (video-synced + clock-synced). Spotify integration for soundtrack. Also picks up deferred Phase 1 items (per-stream volume, overtime via game clock, audioRoutingService expansion).

**FIRST:** Update AsyncAPI contract with `spotify:status`, `cue:conflict`, compound cue progress events, and all `spotify:*` gm:command actions.

**New services:** `spotifyService`
**Modified:** `videoQueueService` (compound cue items), `cueEngineService` (timeline engine, nesting, cascading stop), `audioRoutingService` (VALID_STREAMS expansion, `audio:volume:set`, fallback field)
**Install:** spotifyd/raspotify
**Config:** Compound cue definitions added to `cues.json`, Spotify cache setup
**GM Scanner:** SpotifyController, compound cue progress in Active Cues, Now Playing subsection, cache verification

**Delivers:**
- GM-triggered compound cues (video + sound + lighting choreography)
- Event/clock-triggered compound cues (auto-fire scripted sequences)
- Compound cue nesting via `cue:fire` in timelines
- Cascading stop (parent → children)
- Spotify soundtrack playback routed to speakers
- Playlist switching as a gm:command (manual or automated)
- Pre-cached offline Spotify playback
- Video conflict resolution (GM prompt)
- GM video control integration (pause/stop video = pause/stop compound cue)
- Per-stream volume control via `audio:volume:set` (deferred from Phase 1)
- Overtime detection via game clock (deferred from Phase 1)
- `audioRoutingService` VALID_STREAMS + fallback expansion (deferred from Phase 1)

### Phase 3: Multi-Speaker Routing + Ducking — COMPLETE

**What:** PipeWire combine-sink for multi-speaker. Routing inheritance. Automatic ducking.

**FIRST:** Update AsyncAPI contract with ducking status events and expanded `audio:route:set` payload schema.

**Modified:** `audioRoutingService` (combine-sink management, ducking engine, fallback logic)
**Config:** `routing.json` (ducking rules)
**GM Scanner:** Per-stream routing dropdowns, combine-sink display

**Delivers:**
- Default audio to both BT speakers simultaneously
- Directional sound effects to individual speakers
- Compound cue and command-level routing overrides
- Automatic Spotify ducking during video/sound playback
- Graceful fallback to HDMI when BT speakers unavailable

### Phase 4: Polish + Reliability

**What:** Stability hardening, GM workflow refinement, edge case handling.

**Work:**
- 4+ hour stability testing with all services running simultaneously
- Bluetooth reconnection hardening
- Video conflict UX polish
- GM video control + compound cue interaction polish
- Admin UI refinement from real GM usage feedback
- Session logging of all automated cue actions for post-game review
- Standing cue hot-reload (edit cues without restart)

---

## 14. Resource Budget (Simultaneous Operation)

All components running during a game session on Pi 5 (8 GB):

| Component | RAM (MB) |
|-----------|----------|
| Xorg + desktop | 340 |
| PipeWire + pulse + WirePlumber | 120 |
| PM2 + Node.js backend | 216 |
| VLC (video playback) | 100 |
| Home Assistant (Docker) | 370 |
| Docker daemon + containerd | 120 |
| spotifyd | 40 |
| pw-play sound instances | 5-10 |
| tailscaled | 82 |
| OS + kernel | 200 |
| **Total** | **~1,600** |
| **Available** | **~6,300** |

VLC video decoding offloads to the Pi 5 GPU. CPU handles Node.js, spotifyd, PipeWire routing, and Home Assistant comfortably on 4x Cortex-A76 cores.

---

## 15. Key Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Cues = automated gm:commands | No parallel action system. One primitive, one code path. |
| D2 | `source` field distinguishes manual vs automated | Same execution, distinguishable in logs and broadcasts. |
| D3 | `executeCommand()` shared function | Extracted from adminEvents.js. WebSocket handler and cue engine both call it. |
| D4 | Re-entrancy guard: `source:'cue'` skips standing cue evaluation | Prevents infinite loops (cue → command → event → cue). |
| D5 | pw-play for sounds | Native PipeWire, lightweight, concurrent, fire-and-forget. |
| D6 | spotifyd + D-Bus MPRIS for Spotify | Only viable option on ARM64 Linux. Local control, no internet for playback. |
| D7 | One-time pre-cache + session verification | Cache once, verify before each game, never discover missing music mid-session. |
| D8 | Single global routing config with fallbacks | Simpler than named presets. Fallback to HDMI when BT unavailable. |
| D9 | 3-tier routing inheritance: global → compound cue → command | Default to both speakers, override per-cue or per-command for directional effects. |
| D10 | Automatic ducking with command override | Sensible defaults (duck Spotify during video), compound cue commands can override. |
| D11 | No looping in pw-play — use pre-rendered files or Spotify | Accept the limitation, design around it. |
| D12 | GM video actions on compound cue's video = cue actions | `video:pause` pauses the cue (timeline stalls). `video:stop` stops the cue. No separate "suspend" mechanism. |
| D13 | Compound cues with video go through queue | One-at-a-time guarantee. GM sees compound cues alongside videos. |
| D14 | Pi 5 built-in BT handles multiple A2DP connections | No USB dongles required. |
| D15 | Game clock as master heartbeat | One tick source, multiple consumers. No independent timers. |
| D16 | Session `setup` phase before `active` | GM preps without eating into game time. Transactions rejected until game starts. |
| D17 | `session:start` (not `game:start`) | Stays in `session:` namespace. No architectural inconsistency. |
| D18 | Pause cascades freeze everything | One action pauses clock, cue engine, media, Spotify, transactions. Resume reverses. |
| D19 | `pausedByGameClock` flag prevents unintended resume | Only auto-resume things the pause stopped, not things GM had manually paused. |
| D20 | "sound" not "audio cue" | Clear semantics. `sound:play` is two-level like `video:play`. Avoids overloading "cue". |
| D21 | Unified cue model (simple + compound) | No separate "sequences" namespace. `cue:fire` is polymorphic. One engine, one config, one controller. |
| D22 | Three evaluation contexts, one mechanism | Event, clock, and timeline are contexts a cue is evaluated in — not three separate systems. |
| D23 | Predicate conditions (`{field, op, value}`) | More expressive than dot-path equality. Operators: eq, neq, gt, gte, lt, lte, in. |
| D24 | Implicit AND for multiple conditions | Array of conditions, all must match. No structural OR — use `in` operator or separate cues. |
| D25 | `once` flag for fire-once cues | Auto-disables after first fire. Same as GM pressing Disable manually. |
| D26 | `quickFire` flag for GM soundboard tiles | Populated from cue config. Same tile pattern as lighting scenes. |
| D27 | Compound cue nesting via `cue:fire` in timelines | No special nesting mechanism. `cue:fire` is just another command. |
| D28 | Cascading stop: parent → children | GM stops a parent, everything related stops. Engine tracks `spawnedBy` at runtime. |
| D29 | Cue config at `backend/config/environment/cues.json` | Alongside `routing.json`. Venue-specific, GM edits between sessions. |
| D30 | All cue features networked-only | Standalone mode serves offline games without venue hardware. `data-requires="networked"`. |
| D31 | Show Control admin section | Single section with: Active Cues, Quick Fire grid, Standing Cues toggles, Now Playing. |
| D32 | `cue:stop/pause/resume` take `{cueId}` | Explicit targeting needed because multiple compound cues can be active (nesting). |
| D33 | Audio stream name `sound` (not `cue`) | Matches `sound:play` command namespace. |
| D34 | Simultaneous cues: definition order, last-write-wins | Predictable behavior for shared resources (lighting). All cues at same time execute; last one sets final state. |
| D35 | Only video is an exclusive resource | Sound overlaps (concurrent processes). Lighting is last-write-wins. Neither affects running compound cues. |
| D36 | Timeline error: log + toast GM + continue | Live show must go on. GM sees notification, decides whether to intervene. |
| D37 | cue:conflict auto-cancels after 10 seconds | GM may be busy. No-response = cancel, not hang indefinitely. |
| D38 | Game clock state on session model | Persisted via `saveCurrentSession()`. Survives backend restart. Same pattern as transactions/scores. |
| D39 | sync:full sends cue summaries, not full definitions | Prevents payload bloat. Timeline/command arrays excluded. Full definitions via HTTP if needed. |
| D40 | Ducking engine is event-driven | Listens to `video:started/completed/paused/resumed` and `sound:started/completed`. No polling, no separate state machine. Consistent with `stateService.js` pattern. |
| D41 | Contracts defined before implementation per phase | AsyncAPI/OpenAPI updated FIRST in each phase. Interface defines implementation. |
| D42 | `gameClockService` separate from `cueEngineService` | Single responsibility. Clock is a utility; cue engine is orchestration. Clean dependency: cue engine listens to clock ticks. |
| D43 | `spotify:play` does not accept playlist — use `spotify:playlist` + `spotify:play` | One action, one purpose. No overloaded payloads. |
| D44 | Standalone mode keeps `status: 'active'` on session creation | Standalone has no game clock or cue engine. `setup` phase is networked-only. `LocalStorage.js` unchanged. |
| D45 | Game clock status is `stopped/running/paused`, not session status | `setup` is a session status, not a clock status. Clock doesn't exist during setup — it hasn't started. |
| D46 | Cue nesting capped at 5 levels with visited-set cycle detection | Prevents runaway `cue:fire` chains. Cycles logged and skipped. |
| D47 | Sound effect files in `backend/public/audio/` | Parallel to `backend/public/videos/`. Same static-file serving pattern. |
| D48 | Ducking `when` field is a stream name, not an event name | `"when": "video"` not `"when": "video:playing"`. Engine activates rule on any playback-start event from that stream. |
| D49 | Cue engine normalizes event payloads to flat fields | Decouples cue definitions from internal payload structure. Normalizers defined per event type, same pattern as `broadcasts.js`. |
| D50 | Cue trigger events are existing backend events | No new events created for cue triggering. `group:completed` already exists in `transactionService.js`. Cue engine listens to the same internal EventEmitter events as `stateService` and `broadcasts.js`. |
| D51 | Compound cue routing resolved at dispatch time, not stored as persistent override | Cue engine resolves 3-tier hierarchy per-command. No revert needed on cue end. No changes to `audioRoutingService` for cue routing. |
| D52 | `commands` and `timeline` are mutually exclusive | `commands` = fire-and-forget (no lifecycle). `timeline` = has lifecycle. Use `at: 0` entries for immediate setup in compound cues. Both present → validation error at load time. |
