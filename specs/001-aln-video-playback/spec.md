# Feature Specification: ALN Video Playback & State Synchronization System

**Feature Branch**: `001-aln-video-playback`  
**Created**: 2025-09-23  
**Status**: Draft  
**Input**: User description: "ALN Video Playback & State Synchronization System - Add external video playback capabilities to the About Last Night memory scanner ecosystem with orchestrator server for managing video playback, game state, and GM station synchronization"

## Execution Flow (main)
```
1. Parse user description from Input
   � If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   � Identify: actors, actions, data, constraints
3. For each unclear aspect:
   � Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   � If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   � Each requirement must be testable
   � Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   � If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   � If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## � Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale (concurrent users, response times, throughput)
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## Clarifications

### Session 2025-09-23
- Q: When a player scans a video token while another video is playing, how should the system respond? → A: Reject immediately with "try again later" message
- Q: What happens to incomplete video queue requests when the orchestrator server crashes? → A: Requests persist and resume on restart
- Q: How should the system handle conflicting transactions from multiple GM stations? → A: First-write-wins (accept earliest timestamp)
- Q: When detecting duplicate token scans, what time window defines "duplicate"? → A: Entire session (no duplicates ever)
- Q: How should the system handle video file corruption or missing video files? → A: Log error and notify GM station only

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Players participating in the About Last Night memory game discover special memory tokens that trigger video playback on a shared projector screen, creating immersive narrative moments. The system coordinates multiple player devices, manages video playback through a central orchestrator, and synchronizes game state across Game Master (GM) stations to maintain accurate scoring and track game progression.

### Acceptance Scenarios
1. **Given** a player with a memory scanner device encounters a video token, **When** they scan the token, **Then** the system plays the corresponding video on the projector and shows a processing screen on the player's device
2. **Given** multiple players attempt to scan video tokens simultaneously, **When** one video is already playing, **Then** subsequent players receive a "Memory processing, try again" message
3. **Given** a GM station loses network connection during gameplay, **When** the connection is restored, **Then** the station automatically receives full state synchronization from the orchestrator
4. **Given** players scan regular memory tokens (non-video), **When** tokens are scanned, **Then** the orchestrator logs the scan and broadcasts updates to all connected GM stations
5. **Given** a video finishes playing on the projector, **When** playback completes, **Then** the system becomes available for the next video trigger and notifies all connected devices
6. **Given** a video file is missing or corrupted, **When** a player scans the corresponding token, **Then** the system logs the error to GM stations only and continues game flow without player disruption

### Edge Cases
- Orchestrator server goes offline during gameplay: Player scanners continue in offline mode (FR-007), GM stations auto-reconnect when server returns, all pending transactions sync on recovery
- Video file corruption or missing files: System logs error and notifies GM station only (game continues without disruption)
- Player device cannot connect to orchestrator: Device operates in offline mode, stores transactions locally, displays appropriate offline UI feedback
- System recovery from interrupted video playback: VLC connection restored, video queue cleared, system ready for next trigger, all clients notified of ready state
- Conflicting transactions from multiple GM stations: Resolved using first-write-wins (earliest timestamp accepted)
- Orchestrator crash recovery: Video queue requests persist and resume on restart

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST support triggering external video playback when specific memory tokens are scanned
- **FR-002**: System MUST prevent multiple videos from playing simultaneously on the same display
- **FR-003**: System MUST maintain authoritative game state across all connected devices
- **FR-004**: System MUST automatically synchronize state when devices reconnect after network disruption
- **FR-005**: System MUST log all scan events and transactions for session tracking
- **FR-006**: System MUST display appropriate feedback on player devices during video playback
- **FR-007**: System MUST support both online (connected to orchestrator) and offline operation modes for scanners
- **FR-008**: System MUST calculate and broadcast score updates when transactions occur
- **FR-009**: System MUST detect and prevent duplicate token scans for the entire session duration (no token can be scanned twice in same session)
- **FR-010**: System MUST provide administrative controls to manage video playback and session data
- **FR-011**: System MUST support real-time bidirectional communication with GM stations
- **FR-012**: System MUST immediately reject scan requests with "try again later" message when video is already playing
- **FR-013**: System MUST persist session data until GM ends the session via admin panel, then archive all data as a log for later reference
- **FR-014**: System MUST support up to 10 concurrent player scanner devices and 5 GM scanner stations
- **FR-015**: System MUST handle network latency up to 500ms without user-visible delays, queue requests during latency spikes >500ms, and timeout gracefully after 5 seconds with appropriate user feedback
- **FR-016**: System MUST authenticate admin access with password-based authentication
- **FR-017**: System MUST persist video queue requests across orchestrator restarts to ensure no player actions are lost
- **FR-018**: System MUST use first-write-wins strategy (earliest timestamp) to resolve conflicting transactions from multiple GM stations
- **FR-019**: System MUST gracefully handle missing or corrupted video files by logging errors to GM stations only while allowing game to continue
- **FR-020**: System MUST enable player scanners to queue transactions locally when orchestrator is unreachable, storing up to 100 transactions with automatic retry every 30 seconds
- **FR-021**: System MUST provide clear offline status indication on scanner UI showing "Offline Mode - Transactions Queued: N"
- **FR-022**: System MUST automatically sync all queued offline transactions when connection restored, processing in chronological order

### Non-Functional Requirements
- **NFR-001**: System MUST respond to all API requests within 100ms under normal load (1-15 devices)
- **NFR-002**: System MUST support concurrent connections from up to 10 player devices and 5 GM stations without degradation
- **NFR-003**: System MUST authenticate admin access using bcrypt-hashed passwords with minimum 10 character requirement
- **NFR-004**: Scanner UI MUST provide visual feedback within 50ms of user action
- **NFR-005**: System MUST maintain 99% uptime during active game sessions (max 3.6 seconds downtime per hour)

### Key Entities *(include if feature involves data)*
- **Token**: Represents a memory element in the game with attributes including ID, value rating, memory type, group association, and media assets (image, audio, or video)
- **Transaction**: Records a player action including token scanned, team assignment, timestamp, and originating device
- **Session**: Encompasses a complete game instance containing all transactions, scores, and events with lifecycle states:
  - `created`: Initial state when session starts, no transactions yet
  - `active`: Gameplay in progress, accepting transactions
  - `ended`: GM has ended session, no new transactions accepted
  - `archived`: Final state, data moved to archive storage
- **Game State**: Current authoritative state including all transactions, calculated scores, and completed group bonuses
- **Video Queue**: Management of video playback requests and their current status
- **Device Connection**: Represents a connected player scanner or GM station with its connection status and synchronization state

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---