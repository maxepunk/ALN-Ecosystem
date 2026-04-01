# ALN Ecosystem — Investigation Context

## CRITICAL INSTRUCTIONS

1. **READ ACTUAL SOURCE CODE.** Do NOT rely on CLAUDE.md or other documentation as ground truth. There is KNOWN DRIFT between documentation and actual implementation.
2. **Think from GAMEPLAY PURPOSE.** Every piece of code exists to serve the game experience. Understand WHAT it's supposed to accomplish for players, GMs, and the audience.
3. **Report what you actually find.** If something is unclear, say so. Do not guess.
4. **Be precise about file paths and line numbers.** Other investigators will cross-reference your findings.

## What This System Is

ALN is a 2-hour immersive crime thriller game running on a single Raspberry Pi 5. The Pi runs everything: game server (Node.js backend), media center (VLC video on HDMI, Spotify on Bluetooth speakers, sound effects, smart lighting), web server for PWAs and a TV scoreboard.

### Three Audiences
1. **Players** — roam the venue with ESP32 hardware scanners (primary). Find NFC tokens, discover "memories" (images/audio/video). Make strategic decisions per-token.
2. **Game Masters (GMs)** — sit at GM stations with phones running GM Scanner PWA. Process tokens teams bring them, monitor show control, manage the game.
3. **Everyone in the venue** — see the scoreboard on TV, watch triggered videos, hear Spotify music and sound effects, experience lighting changes.

### The Game Loop
1. Player scans NFC token with ESP32 -> sees memory content. If video token -> TV plays video for everyone.
2. Team decides: sell on Black Market (earn money) or expose to Detective (evidence on scoreboard).
3. At GM station: GM selects/creates team -> selects transaction mode -> scans token. This sequence matters.
4. Backend processes transaction, calculates score, persists, broadcasts.
5. Scoreboard on TV updates live. Other GMs see the transaction.

### The Scoreboard
Displayed on TV via HDMI. Shows team rankings and exposed evidence. MUST be fire-and-forget — turn on TV, navigate to page, it works. Stays synced through server restarts without manual intervention.

### The GM Scanner
The game command center. Controls: session lifecycle, video queue, audio routing (HDMI vs Bluetooth), Bluetooth speakers, lighting, Spotify, cue engine, sound effects, service health, and more. ALL admin commands go through WebSocket.

## Architecture Overview

### Backend (Node.js)
- WebSocket server (Socket.io) for real-time communication with GM Scanners and Scoreboard
- HTTP API for player scanners (ESP32 and phone)
- Services emit internal EventEmitter events
- `broadcasts.js` listens to service events and forwards to WebSocket clients
- `syncHelpers.js` builds `sync:full` payload for state restoration
- `service:state` with domain envelope is the push mechanism for 10 service domains

### GM Scanner PWA
- `orchestratorClient.js` — WebSocket connection, has explicit `messageTypes` array that filters which events get forwarded
- `networkedSession.js` — routes incoming events to data manager methods
- `unifiedDataManager.js` — manages transactions, scores, player scans
- `NetworkedStorage.js` — backend-authoritative storage strategy
- `stateStore.js` — domain-keyed reactive store for admin panel service state

### Scoreboard
- Self-contained HTML page with embedded JavaScript
- Connects via WebSocket with JWT auth
- Must stay synced autonomously

## Key Questions To Investigate

1. **Room membership**: When each WebSocket client connects, what room(s) does it join? This determines which broadcast events it receives.
2. **Score delivery**: How many paths deliver score data to each consumer? Do they all work?
3. **sync:full consistency**: Multiple code paths emit sync:full. Do they all include the same fields? Target the same rooms?
4. **Payload shape mismatches**: When backend emits an event payload, does the consumer's handler destructure it correctly?
5. **Listener lifecycle**: After system resets, are listeners correctly torn down and re-registered without duplication?
6. **Dead code**: Events emitted with no consumer? Handlers for events never emitted?

## What Went Wrong Yesterday

Yesterday's game had transactions missing from session reports despite scores displaying correctly on the scoreboard. This is believed to be a SYMPTOM of larger architectural drift, not the sole problem. The system has also been experiencing erratic behavior in audio routing and service state management.
