# System Functional Requirements

**Created**: 2025-09-30
**Status**: ✅ COMPLETE - Confirmed with User
**Purpose**: Define intended functionality for each system component to ground contract design

---

## Document Purpose

This document defines the **intended functionality** for each component of the ALN system. These requirements serve as the **authoritative source** for:
- Contract endpoint design (Phase 5)
- Identifying redundant/missing APIs
- Distinguishing essential vs over-engineered features
- Grounding architectural decisions in actual needs

**Key Principle**: Design contracts based on **what components SHOULD do**, not what current confused implementation does.

---

## System Overview

**Components:**
1. **Orchestrator** (Backend) - Central coordination, state management, video control
2. **Player Scanner** - Simple token scanning for players (HTTP-only, fire-and-forget)
3. **GM Scanner** - Game transaction processing (WebSocket-driven, real-time)
4. **Admin Panel** - Monitoring and intervention (integrated into GM Scanner, shares WebSocket)

**Architecture Pattern:**
- Player Scanner: HTTP only (stateless, fire-and-forget for ESP32 compatibility)
- GM Scanner + Admin: WebSocket-driven (persistent connection, real-time bidirectional)
- Orchestrator: Serves both (minimal HTTP for Player/resources, WebSocket for real-time)

**Core Constraint**: Minimal architectural complexity for live-event tool (not enterprise SaaS)

---

## Deployment Modes (CRITICAL ARCHITECTURAL CONSTRAINT)

The ALN system operates in **two fundamentally different deployment modes**. This constraint shapes all architectural decisions, state management, and game logic distribution.

### Mode 1: Networked Mode (WITH Orchestrator)

**Deployment:**
- Orchestrator running on local network (Raspberry Pi or server)
- Scanners connect to orchestrator via discovered IP or manual configuration
- WebSocket connections for real-time synchronization

**Characteristics:**
- **Authoritative state**: Orchestrator is source of truth
- **Cross-device sync**: All GM scanners see same game state
- **Video playback**: Player Scanner scans trigger VLC video on shared screen
- **Centralized scoring**: Server calculates scores, broadcasts to all GMs
- **Offline queue**: Temporary disconnections queue for later sync

**Player Scanner Functionality:**
- ✅ Scan tokens → send to orchestrator
- ✅ Display local media (images/audio)
- ✅ Trigger video playback (via orchestrator → VLC)
- ✅ Offline queue when connection lost

**GM Scanner Functionality:**
- ✅ Scan tokens → submit transactions via WebSocket
- ✅ Real-time score updates from orchestrator
- ✅ See transactions from ALL GMs (synchronized)
- ✅ Admin panel monitoring (full visibility)
- ✅ Admin intervention (centralized control)
- ✅ Offline queue when connection lost

**When Connection Lost (Temporary):**
- Queue scans locally
- Calculate provisional scores (client-side game logic)
- Display "offline" status
- Auto-reconnect and sync when orchestrator reachable
- **Expectation**: Will sync eventually (orchestrator exists)

---

### Mode 2: Standalone Mode (WITHOUT Orchestrator)

**Deployment:**
- Scanners deployed via GitHub Pages (static hosting)
- No orchestrator running
- No cross-device communication
- Each device operates independently

**Characteristics:**
- **Authoritative state**: Each scanner is its own source of truth
- **No synchronization**: GMs operate independently (no shared state)
- **No video playback**: Player Scanner loses video functionality
- **Local scoring**: GM Scanner calculates scores client-side
- **No admin panel**: Monitoring/intervention not available (no centralized state)

**Player Scanner Functionality:**
- ✅ Scan tokens → log locally only
- ✅ Display local media (images/audio)
- ❌ Video playback (no orchestrator/VLC to control)
- ✅ Full functionality for narrative content discovery

**GM Scanner Functionality:**
- ✅ Scan tokens → process locally
- ✅ Calculate scores (client-side game logic)
- ✅ Track team scores (local storage)
- ✅ Detect duplicate scans (within this scanner's session)
- ✅ Group completion bonuses (local calculation)
- ❌ Cross-device sync (each GM scanner independent)
- ❌ Admin panel monitoring (no centralized state to monitor)
- ❌ Admin intervention (no shared state to modify)
- ⚠️ Multiple GMs see different states (no synchronization)

**Standalone "Offline" State:**
- **Always offline** from orchestrator perspective
- Never attempts to connect/sync
- Never queues for sync
- **Permanent independent operation** (not temporary)

---

### Key Architectural Implications

#### 1. **Game Logic MUST Exist Client-Side**

**Critical Requirement**: GM Scanner must be able to calculate scores without server

**Why**: Standalone mode requires full game logic on client

**Implications:**
- Scoring rules implemented in scanner JavaScript
- Token metadata (memoryType, valueRating, group) bundled with scanner
- Duplicate detection logic in scanner
- Group completion logic in scanner

**Networked Mode Benefit**: Server can validate/recalculate but client is capable

---

#### 2. **State Management Patterns**

**Networked Mode:**
- **Server authoritative**: Orchestrator calculates scores, broadcasts to clients
- **Client provisional**: Client calculates speculatively during offline queue
- **Conflict resolution**: Server state wins on sync

**Standalone Mode:**
- **Client authoritative**: Scanner's state is the only state
- **No conflicts**: No other sources of truth to conflict with

**Design Requirement**: Scanner must support BOTH patterns

---

#### 3. **Token Data Distribution**

**Both Modes Require:**
- tokens.json bundled with scanner OR fetched from orchestrator
- All token metadata available locally (memoryType, valueRating, group, etc.)
- Scanner can operate without server token lookups

**Networked Mode Bonus:**
- Can fetch updated tokens.json from orchestrator
- Server enriches transactions with token metadata (convenience)

**Standalone Mode:**
- Uses bundled tokens.json (static, deployed with scanner)
- Client enriches transactions from local data

---

#### 4. **Testing Requirements** (For Later Phases)

**Test Suite Must Cover:**
- ✅ Networked mode (with orchestrator)
- ✅ Offline mode (temporary disconnection, will sync)
- ✅ Standalone mode (no orchestrator, never syncs)
- ✅ Transition between modes (networked → offline → reconnect)

**Contract Testing Must Verify:**
- Networked mode APIs (HTTP + WebSocket)
- Standalone mode doesn't break when APIs unavailable

---

#### 5. **Refactor Planning Constraints** (For Phase 6-7)

**Cannot Do:**
- ❌ Move game logic exclusively to server (scanner needs it standalone)
- ❌ Require server for score calculation (must work client-side)
- ❌ Centralize duplicate detection (scanner detects locally in standalone)

**Must Maintain:**
- ✅ Client-side game logic (scoring, bonuses, duplicates)
- ✅ Client-side state management (local storage)
- ✅ Scanner can initialize without server connection
- ✅ Scanner can operate indefinitely without server

**Server Role in Networked Mode:**
- Centralizes state (single source of truth)
- Broadcasts to synchronize GMs
- Validates client calculations (sanity check)
- Enables admin intervention
- Controls video playback

---

#### 6. **"Offline" vs "Standalone" Distinction**

**Critical for Design:**

**Offline (Networked Mode, Temporary):**
- Scanner **expects** to reconnect
- Queues transactions for sync
- Calculates provisional scores
- Shows "reconnecting" status
- Auto-syncs when orchestrator reachable
- **Transient state** (will resolve)

**Standalone (No Orchestrator, Permanent):**
- Scanner **never** expects orchestrator
- No queue (transactions processed immediately)
- Calculates authoritative scores (not provisional)
- Shows "standalone mode" or no connection indicator
- Never attempts sync
- **Permanent state** (normal operation)

**Detection:**
- Networked → Offline: Connection lost after initial connection
- Standalone: Never connects, no orchestrator URL configured

---

### Deployment Decision Matrix

| Feature | Networked | Offline (Temp) | Standalone |
|---------|-----------|----------------|------------|
| **Player Scanner** |
| Scan tokens | ✅ Send to server | ✅ Queue | ✅ Log locally |
| Display media | ✅ Local | ✅ Local | ✅ Local |
| Video playback | ✅ Via VLC | ❌ Queue | ❌ Not available |
| **GM Scanner** |
| Scan tokens | ✅ Via WebSocket | ✅ Queue | ✅ Process locally |
| Score calculation | ✅ Server (client validates) | ✅ Client (provisional) | ✅ Client (authoritative) |
| Cross-device sync | ✅ Real-time | ❌ Queued | ❌ Never |
| Duplicate detection | ✅ Server (across all GMs) | ✅ Client (local session) | ✅ Client (local session) |
| Group bonuses | ✅ Server broadcasts | ✅ Client calculates | ✅ Client calculates |
| Admin panel | ✅ Full functionality | ⚠️ Read-only | ❌ Not available |
| State sync | ✅ Real-time | ❌ Queued | ❌ Never |

---

### Impact on Contract Design

**Contracts Define Networked Mode:**
- OpenAPI/AsyncAPI specify orchestrator APIs
- Scanners use these APIs when orchestrator available
- Contracts do NOT constrain standalone mode (client-only)

**Standalone Mode is Client-Only:**
- No server communication
- No contracts to validate
- Pure client-side JavaScript execution

**Testing Strategy:**
- Contract tests validate networked mode
- Unit tests validate client-side game logic (used in both modes)
- Integration tests validate mode transitions

---

### Summary: Why This Matters

1. **Architecture**: Game logic duplicated (client + server), not centralized
2. **State Management**: Context-dependent authority (server in networked, client in standalone)
3. **Testing**: Must test three operational contexts (networked, offline, standalone)
4. **Refactoring**: Cannot remove client-side capabilities (standalone depends on them)
5. **Contracts**: Define networked mode only (standalone is out-of-band)

**This constraint must be kept in mind for:**
- ✅ Phase 5: Contract design (networked APIs only)
- ✅ Phase 6: Refactor planning (preserve client-side logic)
- ✅ Phase 7: Implementation (test all three modes)

---

## 1. ORCHESTRATOR (Backend Server)

### Core Responsibilities
- Central state management for ONE active game session
- Video playback coordination via VLC
- Real-time event broadcasting to connected clients
- Authentication and authorization
- Offline queue management
- Static resource serving (token data, video files)

---

### 1.1 Authentication & Authorization

**Functions:**
1. Validate admin password
2. Issue JWT tokens for WebSocket authentication
3. Validate JWT tokens during WebSocket handshake
4. Track active admin tokens

**Why Needed:**
- Secure WebSocket connections (handshake auth)
- Distinguish GM scanners from Player scanners
- Prevent unauthorized admin operations

**Transport:**
- HTTP POST for initial auth (return JWT)
- WebSocket handshake validation (JWT in auth payload)

---

### 1.2 Session Management

**System Constraint**: ONE active session at a time (2-hour live event)

**Functions:**
1. Create new session (start game event)
2. Track session state (active/paused/ended)
3. Pause session (technical issue, break)
4. Resume session (continue after pause)
5. End session (event complete)
6. Broadcast session state changes to all connected clients
7. Provide session info (current session only)
8. Store recent session history (last 24 hours for recovery scenarios)

**Session Data:**
- id (unique identifier)
- name (event name)
- startTime (ISO8601)
- endTime (ISO8601 or null if active)
- status (active/paused/ended)
- currentScores (team scores at time of query/end)

**Why Needed:**
- Game has distinct start/end (2-hour event window)
- May need pause for technical issues
- Recovery from mid-game failures (session history)

**Transport:**
- Session commands: WebSocket (admin commands via persistent connection)
- Session state broadcasts: WebSocket (real-time updates to all clients)
- Session query: HTTP GET (stateless resource retrieval - "what's the current session?")

**Eliminated Over-Engineering:**
- ❌ Multi-session support (ONE session at a time)
- ❌ Session CRUD by ID (no need for arbitrary session access)
- ❌ Granular session lifecycle events (paused/resumed/ended → just use session:update with status)

---

### 1.3 Transaction Processing

**Functions:**
1. Receive token scans from GM Scanner (via WebSocket)
2. Validate transaction (token exists, session active, not duplicate within session)
3. Calculate points based on game rules (token value, mode, group bonuses)
4. Update team scores (base + bonus)
5. Detect duplicate scans (same token, same team, same session)
6. Handle group completion bonuses (when team completes token group)
7. Broadcast transaction events to session participants (real-time)
8. Store transaction history (for admin review and intervention)

**Transaction Data:**
- id (unique identifier)
- tokenId (RFID token scanned)
- teamId (which team)
- deviceId (which scanner created it)
- mode (detective/blackmarket)
- points (calculated score value)
- timestamp (when created)
- memoryType (from token metadata)
- valueRating (from token metadata)
- group (from token metadata)

**Why Needed:**
- Core game mechanic (turn in tokens → earn points)
- Real-time scoring display for GMs
- Audit trail for admin intervention

**Transport:**
- Submit transaction: WebSocket (GM Scanner persistent connection, real-time)
- Transaction broadcasts: WebSocket (notify all GMs in session)
- Transaction history query: WebSocket subscription pattern (admin monitoring)

**Eliminated Over-Engineering:**
- ❌ HTTP transaction submission endpoint (game logic is real-time, WebSocket only)

---

### 1.4 Score Management

**Functions:**
1. Track team scores (base points + bonus points)
2. Calculate score updates from transactions
3. Handle group completion bonuses
4. Broadcast score updates to GMs (real-time)
5. Allow admin manual score adjustment (delta: +/- points)
6. Reset all scores (full system reset)

**Score Data:**
- teamId
- currentScore (total points)
- baseScore (from individual tokens)
- bonusPoints (from group completions)
- tokensScanned (count)
- completedGroups (array of group IDs)
- lastUpdate (timestamp)

**Why Needed:**
- Competitive game requires score tracking
- Admin intervention for calculation errors or unforeseen situations

**Transport:**
- Score broadcasts: WebSocket (real-time updates to GMs)
- Score adjustments: WebSocket commands (admin intervention)
- Score reset: WebSocket command (system reset)

---

### 1.5 Video Orchestration

**System Context:**
- Orchestrator hosts video files locally (`backend/public/videos/`)
- Controls external VLC player via HTTP API
- Player Scanner determines if token has video (client-side from tokens.json)
- Videos queued for sequential playback on shared screen

**Functions:**
1. **Queue Management:**
   - Accept video queue requests (from Player Scanner scans)
   - Maintain video playback queue (FIFO with admin overrides)
   - Track queue state (length, current position)
   - Allow admin to view full queue contents (tokenId, filename, position)
   - Allow admin to add videos to queue (any file from video directory)
   - Allow admin to reorder queue (index-based positioning)
   - Allow admin to clear queue (remove all)

2. **VLC Control:**
   - Play video (from queue or ad-hoc)
   - Pause playback
   - Stop playback
   - Skip to next in queue
   - Track VLC connection status

3. **State Broadcasting:**
   - Broadcast video status to GMs (real-time)
   - Video status includes: status, queueLength, tokenId (if playing), duration, progress

**Video Status States:**
- loading (queued, preparing to play)
- playing (currently playing)
- paused (paused by admin)
- completed (finished playing)
- error (VLC error)
- idle (nothing in queue)

**Why Needed:**
- Player Scanner scans trigger video playback (game mechanic)
- Admin intervention when Player Scanner issues occur
- Queue management prevents video conflicts

**Transport:**
- Queue video: HTTP POST from Player Scanner (fire-and-forget)
- Admin video commands: WebSocket (play/pause/stop/skip/queue management)
- Video status broadcasts: WebSocket (real-time status to GMs)

---

### 1.6 Device Tracking

**Functions:**
1. Track connected devices (GM scanners, Player scanners)
2. Monitor connection health (heartbeats)
3. Detect disconnections (timeout or manual)
4. Broadcast device connection/disconnection events
5. Provide device list (currently connected)
6. Store recent device history (current session only, last 10 connections per device)
7. **API Future-Proofed**: Support kick/disconnect (API designed, UI deferred)

**Device Data:**
- deviceId (unique identifier)
- type (gm/player)
- name (friendly name)
- ipAddress (network address)
- connectionTime (when connected)
- disconnectionTime (when disconnected, null if connected)
- status (connected/disconnected)

**Why Needed:**
- Admin visibility into system state
- Troubleshooting connection issues
- Context for transaction intervention (which scanner created transaction)

**Transport:**
- Device events: WebSocket broadcasts (real-time connection tracking)
- Device list query: WebSocket subscription (admin monitoring)
- Kick device: WebSocket command (future feature)

**Design Note**: Device history built on same storage as transaction history (simplest architecture)

---

### 1.7 State Synchronization

**Functions:**
1. Provide full state sync on GM Scanner connection (initial load)
2. Broadcast state changes in real-time (event-driven)
3. Handle explicit sync requests from clients

**Full State Includes:**
- Current session (if active)
- All team scores
- Recent transactions
- Current video status
- Connected devices
- System status (orchestrator/VLC health)

**Why Needed:**
- GM Scanner needs complete picture on connection
- Ensure all clients have consistent view of game state

**Transport:**
- Full state sync: WebSocket (on connection, or on request)
- State changes: WebSocket specific events (transaction:new, score:updated, etc.)

**Eliminated:**
- ❌ `state:update` event (redundant - covered by specific domain events per Decision 6)
- ❌ HTTP polling for state (anti-pattern for real-time system)

---

### 1.8 Offline Queue Management

**Functions:**
1. Queue scans when orchestrator offline/unreachable
2. Store queued scans persistently
3. Process queued scans when orchestrator back online
4. Notify clients of queue processing results
5. Handle queue failures gracefully

**Why Needed:**
- Graceful degradation during network issues
- Live event can continue without orchestrator (scanners standalone)
- No lost transactions

**Transport:**
- Queue submission: HTTP POST (Player/GM scanners when offline)
- Queue processing notifications: WebSocket (when back online)

---

### 1.9 Static Resource Serving

**Functions:**
1. Serve token database (tokens.json) to scanners
2. Host video files for VLC player
3. Provide health check endpoint

**Why Needed:**
- Scanners need token metadata
- VLC needs video file access
- Connection health checks

**Transport:**
- Token data: HTTP GET (static resource)
- Video files: Static file serving (for VLC)
- Health check: HTTP GET (standard pattern)

---

### 1.10 System Administration

**Functions:**
1. **System Reset:**
   - Reset all scores
   - Clear all transactions
   - Reset session state
   - Full "nuclear option" reset

2. **Logging:**
   - Provide minimal log access for troubleshooting
   - Last 100 lines of error logs
   - HTTP GET endpoint (not real-time streaming)

3. **Monitoring:**
   - Report orchestrator status
   - Report VLC connection status
   - System health metrics

**Why Needed:**
- Quick recovery between game events
- Troubleshooting during live event
- System health visibility

**Transport:**
- System reset: WebSocket command (admin intervention)
- Logs: HTTP GET (one-time fetch for troubleshooting)
- Health: HTTP GET (standard health check pattern)

**Not In Scope:**
- ❌ Runtime configuration changes (config is pre-event)
- ❌ Scanning mode toggle (GMs select mode manually)
- ❌ Offline mode toggle (doesn't make sense for networked orchestrator)

---

## 2. PLAYER SCANNER

### Core Responsibilities
- Allow players to scan memory tokens
- Display local media (images/audio) from tokens
- Trigger video playback on orchestrator screen (when connected)
- Function independently when orchestrator unavailable

### Design Constraint
**Fire-and-forget pattern** for ESP32 portability:
- Minimal response parsing
- Client-side decisions (not server responses)
- HTTP-only (no WebSocket complexity)

---

### 2.1 Token Scanning

**Functions:**
1. Read RFID token IDs
2. Send scan to orchestrator (if connected)
3. Log scan locally (always)
4. Determine if token has video (from local tokens.json)
5. **Client decides** whether to trigger video (not based on server response)

**Why Needed:**
- Core game mechanic (players discover memory tokens)
- Video triggering for narrative content

**Transport:**
- Scan submission: HTTP POST (fire-and-forget)
- Batch scans: HTTP POST (offline queue upload)

**Key Design:**
- Player Scanner **ignores** HTTP response body
- Video trigger decision is **client-side** (from local tokens.json)
- Server response provided for future non-ESP32 clients and debugging

---

### 2.2 Local Media Display

**Functions:**
1. Load token database (tokens.json from orchestrator)
2. Parse token metadata
3. Display images from token
4. Play audio from token
5. Show narrative content (memory text)

**Why Needed:**
- Immediate feedback for players
- Works offline (local assets)

**Transport:**
- Token database: HTTP GET on app load
- Media files: Local to scanner (bundled in scanner deployment)

---

### 2.3 Connection Management

**Functions:**
1. Check if orchestrator available (health check)
2. Switch between standalone/networked modes
3. Handle connection failures gracefully
4. Queue scans when offline

**Why Needed:**
- Scanners work independently (GitHub Pages deployment)
- Graceful degradation when orchestrator unavailable

**Transport:**
- Health check: HTTP GET
- Offline queue: Local storage + batch HTTP POST when reconnected

---

## 3. GM SCANNER (Standard Game Flow)

### Core Responsibilities
- Handle routine game transactions (players turn in tokens)
- Execute game business logic (detective/black market modes)
- Display real-time game state

### Design Constraint
**WebSocket-driven** for real-time bidirectional communication

---

### 3.1 Token Scanning

**Functions:**
1. Read RFID token IDs
2. Select scanning mode (Detective / Black Market)
3. Select team for transaction
4. Submit transaction to orchestrator via WebSocket
5. Receive transaction result (accepted/duplicate/error)

**Why Needed:**
- Core GM function (process player token turn-ins)
- Different modes have different scoring rules

**Transport:**
- Transaction submission: WebSocket (real-time, bidirectional)
- Transaction result: WebSocket response

---

### 3.2 Real-Time State Display

**Functions:**
1. Show current session status (id, name, status)
2. Display team scores (live updates)
3. Show recent transactions (real-time stream)
4. Show video playback status (current, queue length)
5. Connection status indicators (orchestrator, VLC)

**Why Needed:**
- GMs need live view of game state
- Make informed decisions during gameplay

**Transport:**
- All state updates: WebSocket events (real-time broadcasts from orchestrator)

---

### 3.3 Mode Selection

**Functions:**
1. **Detective Mode**: Logs tokens scanned by Detective character (future: create public log)
2. **Black Market Mode**: Processes tokens for team scoring (game business logic)

**Why Needed:**
- Different game mechanics for different scanner types

**Transport:**
- Mode selection: Local (UI state, sent with each transaction)

---

### 3.4 Offline Capability

**Functions:**
1. Queue scans when disconnected
2. Calculate scores locally (provisional)
3. Sync when reconnected
4. Handle conflicts (server state wins)

**Why Needed:**
- Live event resilience
- Continue gameplay during network issues

**Transport:**
- Offline queue: WebSocket submission when reconnected
- Conflict resolution: Server authoritative

---

## 4. ADMIN PANEL (Integrated into GM Scanner)

### Core Responsibilities
- Monitor ALL game activity in real-time
- Handle edge cases requiring human intervention
- Fix errors from unpredictable technical/human elements
- Control video screen when issues arise

### Design Constraint
**Shares GM Scanner WebSocket connection** (not separate app)

---

### 4.1 Monitoring Functions

#### Session Monitoring
**Display:**
- Current session ID
- Session status (active/paused/ended)
- Session start/end times
- **Recent session history** (last 24 hours):
  - Session name
  - Start/end time
  - Status
  - Final scores (if ended)

**Why Needed:**
- Visibility into current game state
- Recovery from mid-game failures

**Transport:** WebSocket events (session:update, initial state:sync)

---

#### Video Monitoring
**Display:**
- Current video playing (tokenId)
- Video queue length
- **Full queue contents:**
  - TokenId
  - Video filename
  - Position in queue
- VLC connection status

**Why Needed:**
- Troubleshoot video playback issues
- Manual queue management

**Transport:** WebSocket events (video:status with enhanced queue data)

---

#### System Monitoring
**Display:**
- Orchestrator connection status
- VLC connection status
- Connected device count
- **Device list** (currently connected):
  - DeviceId
  - Type (gm/player)
  - Connection time
  - IP address

**Why Needed:**
- System health visibility
- Troubleshoot connection issues

**Transport:** WebSocket events (device:connected, device:disconnected, state:sync)

---

#### Score Monitoring
**Display:**
- All team scores (real-time)
- Score breakdown (base + bonus)
- Tokens scanned count
- Completed groups

**Why Needed:**
- Verify scoring accuracy
- Identify when manual adjustment needed

**Transport:** WebSocket events (score:updated)

---

#### Transaction Monitoring
**Display:**
- Recent transactions (real-time stream)
- **Transaction details** (for each):
  - TokenId
  - TeamId
  - DeviceId (which scanner)
  - Mode (detective/blackmarket)
  - Points awarded
  - Timestamp
  - Token metadata (memoryType, valueRating, group)

**Why Needed:**
- Audit trail
- Identify erroneous scans
- Context for intervention decisions

**Transport:** WebSocket events (transaction:new)

---

### 4.2 Intervention Functions

#### Session Control
**Commands:**
1. Create new session (start game event)
2. Pause session (technical issue, break)
3. Resume session (continue after pause)
4. End session (event complete)

**Why Needed:**
- Manual game flow control
- Handle technical issues

**Transport:** WebSocket commands (via gm:command event)

---

#### Video Control
**Commands:**
1. Play video (manual trigger)
2. Pause video (interrupt playback)
3. Stop video (cancel playback)
4. Skip to next in queue
5. **View full queue** (see all queued videos)
6. **Add video to queue** (manual entry - any video file from directory)
7. **Reorder queue** (index-based - move video to position N)
8. **Clear queue** (remove all queued videos)

**Why Needed:**
- Manual intervention when Player Scanner issues occur
- Queue management for game pacing

**Transport:** WebSocket commands (via gm:command event with video actions)

**Queue Management Details:**
- Add: Specify video filename (same as tokenId)
- Reorder: Move video from position X to position Y (index-based)
- View: Return array of {tokenId, filename, position, estimatedDuration}

---

#### Score Intervention
**Commands:**
1. **Adjust team score by delta** (+/- points)
   - Specify teamId
   - Specify delta (positive or negative integer)
   - Reason (optional text for audit)
2. Reset all scores (full system reset - see System Control)

**Why Needed:**
- Fix calculation errors
- Account for unforeseen live-event situations
- Manual compensation for technical issues

**Transport:** WebSocket commands (via gm:command event)

**Note:** Score reset is part of full system reset (coupled with transaction reset)

---

#### Transaction Intervention
**Commands:**
1. **View transaction details** (query by transactionId)
   - Return all fields
   - Include device history context (which scanner, when)

2. **Delete transaction** (undo erroneous scan)
   - Specify transactionId
   - Recalculate affected team score
   - Broadcast score update

3. **Create manual transaction** (when physical scan failed)
   - Required fields:
     - tokenId
     - teamId
     - mode (detective/blackmarket)
   - Auto-generated:
     - transactionId
     - deviceId (admin's scanner)
     - timestamp
   - Calculated:
     - points (from game rules)
     - Token metadata (from tokens.json)

**Why Needed:**
- Fix scanning errors
- Account for physical token scan failures
- Manual corrections during live event

**Transport:** WebSocket commands (via gm:command event)

**Design Note:** Transaction history provides context (device history) for intervention decisions

---

#### System Control
**Commands:**
1. **System Reset** (full "nuclear option"):
   - Reset all scores
   - Clear all transactions
   - Reset session state (end current session)
   - Clear video queue
   - Return to fresh state

2. **View system logs** (troubleshooting):
   - HTTP GET request for recent logs
   - Last 100 lines
   - Error level only
   - One-time fetch (not streaming)

**Why Needed:**
- Quick reset between game events
- Troubleshooting during live event

**Transport:**
- System reset: WebSocket command
- Logs: HTTP GET (one-time fetch)

**Note:** Scores and transactions are tightly coupled (reset together for consistency)

---

#### Device Management
**Commands:**
1. **View connected devices** (essential now)
2. **View device history** (current session, last 10 per device)
3. **Kick/disconnect device** (API designed, UI deferred)

**Why Needed:**
- System visibility
- Context for transaction intervention
- Future: Force-disconnect misbehaving devices

**Transport:**
- View devices: WebSocket subscription (real-time device list)
- Kick device: WebSocket command (future feature)

**Design Note:** Device history built on transaction/event storage (simplest architecture)

---

## 5. Cross-Cutting Concerns

### Error Handling
**All Components:**
- Display errors to users (not just console logging per Decision 10)
- User-friendly error messages (actionable)
- Connection status awareness
- Graceful degradation when offline

### Data Consistency
**Authoritative Source:** Orchestrator
- Server state wins in conflicts
- Client state is provisional when offline
- Sync on reconnection

### Network Resilience
**Design Patterns:**
- Player Scanner: Fire-and-forget (no dependency on responses)
- GM Scanner: Offline queue with auto-sync
- WebSocket: Auto-reconnect with state:sync on reconnection

---

## 6. Eliminated Over-Engineering

Based on user feedback and system constraints:

### Multi-Session Support ❌
- System supports ONE session at a time (2-hour event)
- Eliminated endpoints:
  - GET/PUT/DELETE /api/session/:id
  - GET /api/admin/sessions
- Simplified to: Current session only

### Granular Session Lifecycle Events ❌
- Session state changes covered by single `session:update` event with status field
- Eliminated redundant events:
  - session:paused → session:update {status: 'paused'}
  - session:resumed → session:update {status: 'active'}
  - session:ended → session:update {status: 'ended'}

### HTTP Polling Patterns ❌
- WebSocket system should not use HTTP polling for state
- Eliminated/reconsidered:
  - GET /api/state (if used for polling)
  - GET /api/transaction/history (use WebSocket subscription)

### Runtime Configuration ❌
- Configuration is pre-event only
- Eliminated:
  - POST /api/admin/config (not needed during live event)
  - Scanning mode toggle (GMs select mode manually)

### Offline Mode Toggle ❌
- Doesn't make sense for networked orchestrator
- Eliminated: POST /api/admin/offline-mode

---

## 7. Key Design Principles

### Transport Selection
**HTTP for:**
- Authentication (JWT issuance)
- Static resources (tokens.json, health checks)
- Player Scanner operations (fire-and-forget)
- One-time fetches (logs)
- RESTful resource retrieval (current session)

**WebSocket for:**
- Real-time game logic (transactions, scoring)
- Admin commands (session/video/score control)
- State synchronization
- Event broadcasting
- Monitoring subscriptions

### Simplest Architecture
- Device history uses same storage as transactions
- Score reset coupled with transaction reset
- Single session eliminates multi-session complexity
- WebSocket commands unified under `gm:command` event

### Live Event Constraints
- Minimal complexity (not enterprise SaaS)
- Troubleshooting during event (logs access)
- Recovery scenarios (session history)
- Manual intervention capabilities (comprehensive admin controls)

---

## Document Status

**Confirmed with User**: ✅ 2025-09-30

**Next Steps:**
1. Investigate remaining unknown endpoints (with functional context)
2. Design definitive contract endpoint list
3. Create OpenAPI and AsyncAPI specifications

---

*This document is the authoritative source for system functionality. All contract design decisions must trace back to these requirements.*
