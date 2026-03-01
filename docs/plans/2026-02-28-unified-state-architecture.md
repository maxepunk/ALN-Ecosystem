# Unified State Architecture Design

**Date:** 2026-02-28
**Status:** Implementation complete (all 9 phases) — 2026-03-01
**Scope:** Backend service control/monitoring + Frontend state management + Renderer pipeline

## Problem Statement

The current show control system has a fundamental architectural flaw: **command results and state observations are two completely separate, uncoordinated systems**. Commands fire via WebSocket, return an ACK that gets swallowed, and the UI depends entirely on a separate broadcast from a D-Bus monitor. When the monitor is behind, dead, or a service deregisters its interface, the UI provides zero feedback.

Symptoms:
- Buttons provide no feedback (pending, success, or failure)
- Spotify interface becomes unresponsive after `stop` (spotifyd deregisters MPRIS interface)
- VLC uses HTTP polling at 3s intervals — sluggish progress bar, missed state transitions
- SpotifyRenderer destroys the entire DOM on every state update (innerHTML replacement)
- Volume slider breaks mid-drag because state updates rebuild the panel
- 11 separate `updateX()` methods with 11 event types on UnifiedDataManager
- 30+ case statements in networkedSession.js routing messages
- Dual event paths — renderers listen to DataManager events AND WebSocket directly
- No error feedback reaches the user (safeAdminAction logs to debug panel only)

## Core Principle

**One state flow. State change IS the command result.**

There is no separate ACK event. When a GM presses play:
1. Backend executes the command
2. Backend reads back the actual service state
3. Backend pushes the state to all clients
4. The state update arriving at the frontend IS the confirmation

Same flow for external changes (someone pauses Spotify from their phone):
1. D-Bus monitor detects the change
2. Backend reads the service state
3. Backend pushes to all clients

One path. Always.

---

## Backend Design

### 1. Command Execution → State Push

Commands no longer return meaningful ACKs. After executing a command, the backend reads the service's actual state and pushes it:

```
GM clicks play
  → WebSocket gm:command { action: 'spotify:play' }
  → commandExecutor.execute('spotify:play')
  → spotifyService.play()
  → spotifyService.getState()
  → broadcast 'service:state' { domain: 'spotify', state: {...} }
```

The ACK becomes a simple receipt (`{ success: true }`) with no state payload. The real response is the `service:state` broadcast that follows.

### 2. Event-Driven External Change Detection

All 6 external services have native event mechanisms. No polling.

| Service | Detection Method | Mechanism |
|---------|-----------------|-----------|
| **Spotify** | D-Bus MPRIS PropertiesChanged | ProcessMonitor + DbusSignalParser (existing) |
| **VLC** | D-Bus MPRIS PropertiesChanged | ProcessMonitor + DbusSignalParser (NEW — replaces HTTP polling) |
| **Bluetooth** | `bluetoothctl` event stream | ProcessMonitor (existing) |
| **Audio Routing** | `pactl subscribe` | ProcessMonitor (existing) |
| **Lighting** | Home Assistant WebSocket | Persistent WS connection (existing) |
| **Sound** | Process lifecycle events | Node.js child_process (existing) |

Every detection mechanism flows to the same output: read service state → push `service:state`.

### 3. VLC Moves to D-Bus MPRIS

VLC's HTTP polling interface is replaced entirely with D-Bus MPRIS:

- **Control:** Play, Pause, Stop, OpenUri, Seek via `org.mpris.MediaPlayer2.Player`
- **Monitoring:** PropertiesChanged signals for PlaybackStatus, Volume, Metadata, Position
- **Destination:** Static `org.mpris.MediaPlayer2.vlc` (confirmed working on Pi)
- **Progress:** MPRIS provides position on state change; frontend interpolates between updates

Confirmed working on the Pi:
- PlaybackStatus, Position, Volume, Metadata reads all work
- Play, Pause, OpenUri commands work
- PropertiesChanged signals fire immediately
- Stable D-Bus destination

### 4. Shared MPRIS Service Base Class

VLC and Spotify both use D-Bus MPRIS. A shared base class handles:

- D-Bus destination management (static for VLC, dynamic discovery for Spotify)
- Transport commands (Play, Pause, Stop, Next, Previous, OpenUri)
- PropertiesChanged signal monitoring via ProcessMonitor + DbusSignalParser
- State reading (PlaybackStatus, Volume, Metadata, Position)
- Connection/disconnection lifecycle

Each service extends the base with service-specific behavior:
- **VLC:** Video queue management, display mode, file-based media loading
- **Spotify:** Dynamic destination discovery (spotifyd PID-based naming), playlist management, TransferPlayback activation/recovery

This is a DRY/SOLID design that makes the system easily extensible to other MPRIS-compatible services.

### 5. Single-Authority Pattern (Preserved)

The existing Spotify single-authority pattern is correct and extends to VLC:

> Commands MUST NOT update state or emit events. The D-Bus monitor is the sole state authority.

This prevents feedback loops where D-Bus echoes of commands overwrite newer state. Commands fire, monitors observe, state flows one way.

### 6. State Push Event Shape

All service state pushes use one envelope:

```javascript
// Backend emits:
io.to('gm').emit('service:state', {
  domain: 'spotify',
  state: { connected: true, state: 'Playing', volume: 65, track: { title: '...', artist: '...' } }
});

io.to('gm').emit('service:state', {
  domain: 'vlc',
  state: { connected: true, state: 'Playing', position: 45.2, duration: 180, media: '...' }
});

io.to('gm').emit('service:state', {
  domain: 'health',
  state: { vlc: 'healthy', spotify: 'healthy', sound: 'down', ... }
});
```

Non-service events (session lifecycle, transactions, player scans) retain their own event types but route through the same frontend store.

---

## Frontend Design

### 1. Single State Store

One store, keyed by domain. Every piece of state the admin panel cares about lives under a domain key:

```javascript
// StateStore handles SERVICE DOMAINS ONLY (snapshot/shallow-merge semantics).
// Session/transaction data stays in UDM + storage strategies (list/accumulator semantics).
// This is an intentional architectural boundary — see implementation plan Review Decisions.
store = {
  // Service domains (via service:state envelope)
  spotify:      { connected, state, volume, track, ... },
  video:        { status, currentVideo, queue, queueLength, volume, connected, ... },  // owned by videoQueueService.getState()
  bluetooth:    { scanning, devices: [...] },
  audio:        { sinks: [...], routes: {...}, ducking: {...} },
  lighting:     { connected, scenes: [...], activeScene },
  sound:        { playing, file, ... },
  gameclock:    { running, elapsed, ... },
  cueengine:    { activeCues: [...], ... },
  health:       { vlc: 'healthy', spotify: 'down', ... },
  held:         { items: [...] },
}
// Session-level data (session lifecycle, transactions, scores, teams, player scans)
// flows through UDM + storage strategies — NOT through the store.
```

One method: `store.update(domain, state)` — shallow-merges incoming state, stores previous.

One event: `state:changed` carrying `{ domain, state, prev }`.

Renderers subscribe with a domain filter: `store.on('spotify', (state, prev) => ...)`. Called only when their domain updates. Receive both new and previous state for diffing.

**Note:** The exact store shape — which domains exist, what's a "service" vs "session-level" — needs careful mapping during implementation planning. The principle is: one envelope, one handler, one path into the store.

### 2. WebSocket → Store Flow

`networkedSession.js` collapses from 30+ case statements to ~6 handlers:

```javascript
// One handler covers ~8 service domains
socket.on('service:state', ({ domain, state }) => {
  store.update(domain, state);
});

// ~5 session-level handlers
socket.on('transaction:accepted', (data) => {
  store.update('transactions', { latest: data.transaction, teamScore: data.teamScore });
});

socket.on('session:update', (data) => {
  store.update('session', data);
});

// etc.
```

Nothing else listens to WebSocket events for state. No renderer reaches into the socket. No dual paths.

### 3. Differential Rendering

Every renderer gets `render(state, prev)`:

- **First render** (`prev` is null): build full DOM, store references to dynamic elements
- **Subsequent renders**: compare `state` vs `prev`, update only what changed

```javascript
render(state, prev) {
  if (!prev) return this._buildFull(state);

  if (state.state !== prev.state) {
    this._playBtn.textContent = state.state === 'Playing' ? '⏸' : '▶';
  }
  if (state.volume !== prev.volume && !this._volumeDragging) {
    this._volumeSlider.value = state.volume;
  }
  if (state.track?.title !== prev.track?.title) {
    this._trackName.textContent = state.track?.title || '';
  }
}
```

Key details:
- Volume slider: don't overwrite while user is dragging (`_volumeDragging` flag on pointerdown/pointerup)
- No virtual DOM, no framework — just element references and targeted updates
- HeldItemsRenderer's incremental pattern is directionally right but its implementation is unproven and needs validation

### 4. Command Lifecycle UX

When a GM clicks a button:

1. **Button enters pending state** — disabled, subtle visual indicator. Instant, local.
2. **Command fires** via WebSocket.
3. **State update arrives** for that service domain → renderer clears pending state.
4. **Timeout safety net** (~3 seconds) — pending clears, inline error indicator on the button. Not a modal or toast.

```javascript
// On click:
this._playBtn.classList.add('pending');
sendCommand('spotify:play');

// On render(state, prev):
this._playBtn.classList.remove('pending');  // state arrived
```

No ACK parsing, no event correlation. The state update IS the confirmation.

### 5. Eliminate ScreenUpdateManager (State Routing Layer)

**Current:** ScreenUpdateManager routes data events to different handlers depending on which screen/view is active. It has three handler tiers: global handlers (always run), container handlers (run if element exists in DOM), and screen-specific handlers (run only if that screen has `.active` class). MonitoringDisplay listens to both DataManager events AND WebSocket messages directly.

**Problem:** This routing layer is a state management concern masquerading as a UI concern. It exists because renderers rebuilt their entire DOM on every update (innerHTML replacement), making it expensive to update invisible sections. With differential rendering (targeted `.textContent` assignments), updating off-screen elements costs microseconds.

**What gets removed:** ScreenUpdateManager and its event routing logic. Badge updates (history count, BT speaker count) move to simple store subscriptions in main.js — always active regardless of which view is showing.

**What stays:** The Scanner/Admin/Debug tab bar (`viewController.switchView()`) is preserved. The Scanner and Admin views are genuinely different activities — the GM scans tokens in Scanner view and controls the show (video, audio, lighting, cues) in Admin view. With ~40-80 transactions over a 2-hour game (~1 every 1.5-4 minutes), the GM spends most time in Admin view, occasionally switching to Scanner for a transaction. The tab system is a layout/navigation concern, not a state concern.

**Why this works:** The store makes tab switching free. Subscribed renderers update their DOM whether visible or not. When the GM flips from Admin to Scanner, everything is current. No state routing needed.

**Summary of what changes vs what doesn't:**
- Scanner/Admin/Debug tab navigation → **KEPT** (pure layout concern)
- 8 scanner screens within Scanner view → **KEPT** (`.active` class toggling, pure CSS)
- Admin sections as vertical scrolling column → **KEPT** (already the right pattern)
- ScreenUpdateManager event routing → **REMOVED** (store handles all state flow)
- Badge logic → **MOVED** to simple store/UDM listeners in main.js
- Responsive breakpoints and admin section ordering → **UNCHANGED**

### 6. Eliminate Dual Event Paths

**Current:** MonitoringDisplay listens to DataManager events AND WebSocket messages directly.

**Proposed:** Store is the sole source of truth. All renderers subscribe to store domains only. No direct socket listeners in any renderer or display component.

```
WebSocket message
    → networkedSession.js (thin router)
    → store.update(domain, state)
    → store emits state:changed { domain, state, prev }
    → subscribed renderers called with (state, prev)
```

UnifiedDataManager's 11 `updateX()` methods and their 11 event types collapse into `store.update(domain, state)`. UDM either becomes the store (refactored) or gets replaced by it.

---

## What Gets Removed

| Component | Reason |
|-----------|--------|
| VLC HTTP polling interface | Replaced by D-Bus MPRIS |
| `gm:command:ack` state payload | State push IS the response |
| `safeAdminAction` swallowing results | Replaced by pending state UX |
| 11 `updateX()` methods on UDM | Replaced by `store.update()` |
| 11 separate event types | Replaced by `state:changed` |
| 30+ case router in networkedSession | Replaced by ~6 handlers |
| ScreenUpdateManager | State routing layer eliminated (tab navigation preserved) |
| Dual event paths in MonitoringDisplay | Store is sole source |
| innerHTML replacement in renderers | Replaced by differential rendering |

## What Gets Added

| Component | Purpose |
|-----------|---------|
| MPRIS base class | Shared D-Bus MPRIS control + monitoring (VLC + Spotify) |
| VLC MPRIS service | VLC control + monitoring via D-Bus |
| State store | Single keyed store with domain-based subscriptions |
| Pending state UX | Inline button feedback for command lifecycle |
| Differential renderers | Targeted DOM updates instead of full rebuilds |

## Open Questions for Implementation Planning

1. ~~**Store shape taxonomy:**~~ **RESOLVED.** Store handles service domains only (snapshot semantics). Session/transaction data stays in UDM + storage strategies (list/accumulator semantics). See implementation plan Review Decision #2.
2. **HeldItemsRenderer:** Incremental pattern is right but implementation is unproven. Validate during refactor.
3. ~~**Layout after screen collapse:**~~ **RESOLVED.** Keep Scanner/Admin/Debug tab navigation (pure layout concern). Remove ScreenUpdateManager (state routing layer). The tab system serves genuinely different activities on a phone-sized device. Store makes tab switching free — renderers update whether visible or not. Badge logic moves to main.js. See implementation plan Review Decision #14.
4. ~~**sync:full integration:**~~ **RESOLVED.** sync:full maps service-related keys to `store.update()` calls. Session/transaction data continues to flow through UDM. See implementation plan Phase 5 Task 5.4.
5. ~~**MPRIS base class API surface:**~~ **RESOLVED.** `_dbusCall()` is the override point (no error hook). Spotify overrides entire method for recovery. VLC inherits base. See implementation plan Review Decision #5.
6. ~~**Migration strategy:**~~ **RESOLVED.** Incremental with dual-emit/dual-path periods. See implementation plan phases 4-8.
7. ~~**VLC HTTP cleanup scope:**~~ **RESOLVED.** Full audit complete. `clearPlaylist()` and `toggleFullscreen()` removed (no MPRIS equivalent, no independent callers / not used in show). See implementation plan Review Decisions #9 and #12.

---

## Decision Log

These decisions were made during brainstorming and are final:

1. **State change IS the command result** — no separate ACK event carries state
2. **Event-driven detection for all external services** — no polling anywhere
3. **VLC moves to D-Bus MPRIS** — HTTP interface fully removed
4. **Shared MPRIS base class** — DRY/SOLID, extensible to future MPRIS services
5. **Single state store** — one update method, one event type, domain-keyed
6. **Differential rendering** — `render(state, prev)`, no innerHTML replacement
7. **Pending button UX** — local pending state, clears on state arrival, timeout fallback
8. **Eliminate ScreenUpdateManager** — state routing layer removed, Scanner/Admin tab navigation preserved as pure layout concern
9. **Eliminate dual event paths** — store is sole source of truth for all renderers
10. **Client-side progress interpolation** — frontend interpolates position between MPRIS updates
