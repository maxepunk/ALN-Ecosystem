# ALN Ecosystem Investigation — Shared Context for All Agents

## IMPORTANT: How to Use This Document

This document provides GAMEPLAY CONTEXT so you understand the PURPOSE of the code you're reading. It is NOT a source of truth about implementation details — our documentation has drifted from actual code reality, which is precisely what we're investigating.

**Your job is to READ THE ACTUAL CODE and report what it ACTUALLY DOES, not what this document or any CLAUDE.md file says it should do.** If you find the code contradicts documentation, that's a FINDING worth reporting.

---

## What This System Is (Gameplay Context)

ALN is a 2-hour immersive crime thriller game running on a single Raspberry Pi 5. The Pi runs everything: game server, media center (VLC video on HDMI, Spotify on Bluetooth speakers, sound effects, smart lighting), web server (PWAs + scoreboard).

### The Three Audiences
1. **Players** — roam the venue with ESP32 hardware scanners (primary) or phone scanners (fallback). Find NFC tokens, discover "memories" (images/audio/video). Make strategic decisions per-token.
2. **Game Masters** — sit at GM stations with phones running GM Scanner PWA. Process tokens teams bring them, monitor show control, manage the game.
3. **Everyone in the venue** — see the scoreboard on TV, watch triggered videos, hear Spotify music and sound effects, experience lighting changes.

### The Game Loop
1. Player scans NFC token with ESP32 → sees memory content. If video token → TV plays video for everyone.
2. Team decides what to do with the token: sell on Black Market (earn money) or expose to Detective (evidence goes public on scoreboard).
3. At GM station: GM selects/creates team → selects transaction mode (Black Market or Detective) → scans token. This sequence matters.
4. Backend processes, calculates score, persists, broadcasts.
5. Scoreboard updates live. Other GMs see the transaction. Session report tracks everything.

### The GM Scanner Is the Game Command Center
Not just for scanning tokens. The admin panel controls session lifecycle, video queue, audio routing, Bluetooth speakers, lighting scenes, Spotify, cue engine, sound effects, service health, held items, game activity view, score adjustments, and session reports.

### The Scoreboard
Displayed on TV. Shows team rankings (Black Market mode) and exposed evidence (Detective mode).
MUST be a fire-and-forget kiosk — turn on the TV, it works. Stays synced through server restarts and multiple sessions without manual intervention. No one touches it during a game.

### What Happened Yesterday (0306 Game)
Transaction records were missing from session reports despite scores displaying correctly on screen. This is a SYMPTOM of larger architectural drift, not the only issue. The system has also had erratic behavior in audio routing, video playback, and other areas.

---

## Architectural Context (For Understanding What You're Reading)

The system evolved through three architectural layers, each built on top of the previous without fully removing the old:

**Layer 1 (original):** `stateService` computed monolithic `GameState`, emitted `state:updated`. Clients pulled state via `state:request` → `state:sync`.

**Layer 2 (SRP refactor):** `sessionService` became persistence owner. `transaction:accepted` → `transaction:added` event chain. `broadcasts.js` became the bridge between internal events and WebSocket delivery. `transaction:new` and `score:updated` became incremental update events.

**Layer 3 (unified service:state):** 10 domain-specific state snapshots for service/environment state. `StateStore` on GM Scanner for reactive rendering. `sync:full` enhanced with all domains. ~3200 lines removed March 1.

**The investigation question:** Did each layer get fully completed? Or does Layer 1 dead code interfere with Layer 2/3? Do Layer 2 and 3 have overlapping/contradictory responsibilities? Has post-March-1 feature work introduced new confusion?

---

## Key Code Locations

### Backend (Node.js server at `backend/`)
- `backend/src/server.js` — HTTP + WebSocket server setup, socket event registration
- `backend/src/app.js` — Service initialization
- `backend/src/websocket/broadcasts.js` — Internal events → WebSocket delivery bridge (THE critical file for understanding what gets sent where)
- `backend/src/websocket/adminEvents.js` — WebSocket event handlers for GM commands
- `backend/src/websocket/gmAuth.js` — GM authentication and session joining
- `backend/src/websocket/syncHelpers.js` — `buildSyncFullPayload()` assembly
- `backend/src/services/transactionService.js` — Transaction processing, scoring, event emission
- `backend/src/services/sessionService.js` — Session persistence, listener setup
- `backend/src/services/stateService.js` — Legacy Layer 1 state aggregator (may be dead code)
- `backend/src/services/systemReset.js` — Full system reset between games
- `backend/src/services/audioRoutingService.js` — PulseAudio sink routing
- `backend/src/services/spotifyService.js` — Spotify via D-Bus/MPRIS
- `backend/src/services/vlcMprisService.js` — VLC via D-Bus/MPRIS
- `backend/src/services/mprisPlayerBase.js` — Shared MPRIS base class
- `backend/src/models/gameState.js` — Legacy GameState model
- `backend/src/utils/listenerRegistry.js` — Cross-service listener tracking
- `backend/public/scoreboard.html` — Self-contained scoreboard (HTML + JS + CSS in one file)

### GM Scanner (Vite PWA at `ALNScanner/`)
- `ALNScanner/src/network/orchestratorClient.js` — WebSocket client, event forwarding
- `ALNScanner/src/network/networkedSession.js` — Event routing to data manager
- `ALNScanner/src/core/UnifiedDataManager.js` — Central data orchestrator
- `ALNScanner/src/core/storage/NetworkedStorage.js` — Backend-connected storage strategy
- `ALNScanner/src/core/stateStore.js` — Domain-keyed reactive state store for service:state
- `ALNScanner/src/core/sessionReportGenerator.js` — Report generation from session data

### Contracts (intended design, may have drifted)
- `backend/contracts/openapi.yaml` — HTTP API spec
- `backend/contracts/asyncapi.yaml` — WebSocket event spec

---

## Cross-Agent Awareness

Four agents are investigating in parallel. Each agent should focus on their domain but FLAG anything relevant to another agent's domain at the end of their report.

### Agent A: Scoreboard Architecture
Read the COMPLETE `scoreboard.html` file. Map every aspect of how it works:
- Connection and authentication flow
- Room joining — does it join a session room? The `gm` room? How?
- Every WebSocket event it listens for, and what each handler does with the data
- Client-side data structures and state management
- Display update logic for both Black Market and Detective modes
- Reconnection and kiosk resilience behavior
- How it handles session transitions (new session, reset, etc.)

### Agent B: GM Scanner Data Pipeline
Trace data from WebSocket receipt through to storage and rendering:
- `orchestratorClient.js`: What events does it forward? Is the forwarding list complete vs what backend sends?
- `networkedSession.js`: How does it route each event? What method does it call for each? Are payload shapes correct?
- `UnifiedDataManager.js`: What does each data method actually do?
- Storage strategies: How does `NetworkedStorage` process incoming data?
- Find ALL cases where wrong methods are called, wrong payload shapes assumed, or events are silently dropped

### Agent C: Backend Event Chains & Lifecycle
Trace every event from emission through ALL consumers to WebSocket delivery:
- For each event emitted by a service: who listens? What do they do? What WebSocket event results? What room does it target?
- `sync:full`: Every code path that builds and emits it. What fields? What room/target?
- `broadcasts.js`: Complete map of internal event → WebSocket event translations
- `systemReset.js`: Exact sequence, listener teardown and re-registration, idempotency
- Service initialization order and listener registration
- `listenerRegistry`: How does it work in production vs test?

### Agent D: Uncommitted Audio Routing Changes
Review the 8 modified files from yesterday's rushed pre-game bug fixing:
- `backend/src/services/audioRoutingService.js` (staged)
- `backend/src/services/mprisPlayerBase.js` (unstaged)
- `backend/src/services/spotifyService.js` (unstaged)
- `backend/src/services/vlcMprisService.js` (unstaged)
- Plus their 4 corresponding test files (all unstaged)
- Also read: `docs/plans/2026-03-06-audio-routing-spotify-fixes.md` (the plan these changes were based on)
- Understand what bugs they were trying to fix
- Assess whether the changes are complete, correct, and safe
- Check if test changes match implementation changes
- Flag any risks these changes pose for tonight's game
