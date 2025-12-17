# CLAUDE.md

Last verified: 2025-12-16

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for a 2-hour immersive game. It's a **monorepo with Git submodules** for both code sharing (scanners) and data sharing (token definitions).

**Components:**
- **Backend Orchestrator** (`backend/`): Node.js server - 'backend/CLAUDE.md'
- **GM Scanner** (`ALNScanner/`): ES6 module PWA for game masters - 'ALNScanner/CLAUDE.md'
- **Player Scanner (Web)** (`aln-memory-scanner/`): Vanilla JS PWA - 'aln-memory-scanner/CLAUDE.md'
- **Player Scanner (ESP32)** (`arduino-cyd-player-scanner/`): Hardware scanner - 'arduino-cyd-player-scanner/CLAUDE.md'
- **Token Data** (`ALN-TokenData/`): Shared JSON token definitions
- **Notion Sync Scripts** (`scripts/`): Python scripts for Notion → tokens.json

## How the Game Works

**CRITICAL**: Player scanners and GM scanners serve DIFFERENT purposes:

| Scanner Type | Purpose | Scoring | Tracking |
|--------------|---------|---------|----------|
| **Player Scanner** (Web/ESP32) | Intel gathering - view memory content | No | Yes (Game Activity) |
| **GM Scanner** | Game command center + token processing | Yes (Black Market earns $) | Yes (Transactions) |

### Gameplay Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GAMEPLAY FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│   INTEL GATHERING              DECISION                PROCESSING           │
│   (Player Scanner)                                     (GM Scanner)         │
│                                                                              │
│   ┌──────────────┐        ┌───────────────┐       ┌───────────────────┐    │
│   │ Scan Token   │        │ What to do    │       │ GM Scans Token    │    │
│   │ (NFC/QR)     │───────▶│ with this     │──────▶│ for Team          │    │
│   │              │        │ memory?       │       │                   │    │
│   │ See: Image   │        │               │       │ Black Market:     │    │
│   │ Hear: Audio  │        │ • Sell it?    │       │  → Team earns $$  │    │
│   │ (Video token │        │ • Expose it?  │       │                   │    │
│   │  triggers TV │        │               │       │ Detective:        │    │
│   │  playback)   │        │               │       │  → Token exposed  │    │
│   └──────────────┘        └───────────────┘       │    on scoreboard  │    │
│                                                    └───────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Transaction Types (Player Choices)

When a team brings a token to a GM, they CHOOSE how to process it:

| Choice | What Happens | Points |
|--------|--------------|--------|
| **Black Market** (Sell) | Team earns currency based on token rating × type | $10,000 - $750,000 |
| **Detective** (Expose) | Token summary appears publicly on scoreboard | 0 (evidence only) |

**CRITICAL**: These are NOT mutually exclusive modes. A single game session can have BOTH Black Market and Detective transactions. Teams decide per-token.

## Deployment Modes (Networked vs Standalone)

Deployment modes determine WHERE data lives and WHETHER a backend orchestrator is present. This is a deployment/infrastructure choice, NOT a gameplay choice.

**CRITICAL**: Do not confuse with Transaction Types (Black Market/Detective) which are player choices during gameplay.

| Mode | Backend Required | Data Authority | Scoring |
|------|-----------------|----------------|---------|
| **Networked** | Yes | Backend | Backend calculates |
| **Standalone** | No | Local | Local calculation |

**Component Support:**

| Component | Networked | Standalone | Mode Detection |
|-----------|-----------|------------|----------------|
| Backend | N/A | N/A | Always runs |
| GM Scanner | Yes | Yes | User selection (locked once chosen) |
| Player Scanner (Web) | Yes | Yes | Path-based (`/player-scanner/` = networked) |
| ESP32 Scanner | Yes | No | Always networked (offline queue for resilience) |

**Mode Detection (Player Scanner Web):**
```javascript
const pathname = window.location.pathname;
this.isStandalone = !pathname.startsWith('/player-scanner/');
```

**CRITICAL - Scoring Authority:**
- **Networked mode**: Backend is authoritative (`transactionService.js`)
- **Standalone mode**: Local calculation (`dataManager.js`)
- See 'docs/SCORING_LOGIC.md' for parity risks

## Scoring Business Logic (Cross-Cutting)

**Single Source of Truth:** 'docs/SCORING_LOGIC.md'

**Quick Reference (Black Market Mode):**
```
tokenScore = BASE_VALUES[rating] × TYPE_MULTIPLIERS[type]

BASE_VALUES: {1: $10000, 2: $25000, 3: $50000, 4: $75000, 5: $150000}
TYPE_MULTIPLIERS: {Personal: 1x, Business: 3x, Technical: 5x, UNKNOWN: 0x}
```

**CRITICAL - Dual Implementation Warning:**

| Component | File | Lines |
|-----------|------|-------|
| Backend Config | `backend/src/config/index.js` | 69-83 |
| Backend Group Logic | `backend/src/services/transactionService.js` | 330-387 |
| GM Scanner Config | `ALNScanner/src/core/scoring.js` | 15-29 |
| GM Scanner Group Logic | `ALNScanner/src/core/dataManager.js` | 418-471 |

Values are IDENTICAL but timing differs for group completion detection. When updating scoring, ALWAYS update both config files.

## Token Data Schema (Cross-Cutting)

**Structure:**
```json
{
  "tokenId": {
    "image": "assets/images/{tokenId}.bmp" | null,
    "audio": "assets/audio/{tokenId}.wav" | null,
    "video": "{tokenId}.mp4" | null,
    "SF_RFID": "tokenId",
    "SF_ValueRating": 1-5,
    "SF_MemoryType": "Personal" | "Business" | "Technical",
    "SF_Group": "Group Name (xN)" | "",
    "summary": "Optional summary text"
  }
}
```

**Data Flow:**
```
Notion Elements DB → sync_notion_to_tokens.py → ALN-TokenData/tokens.json
                                                      ↓
                  ┌───────────────────────────────────┴───────────────────────────┐
                  ↓                     ↓                     ↓                   ↓
              Backend              GM Scanner           Player Scanner       ESP32 Scanner
        (loads directly)     (nested submodule)    (nested submodule)    (downloads via API)
```

**SF_* Fields (Notion Source of Truth):**
- `SF_RFID`: Token identifier (matches filename)
- `SF_ValueRating`: 1-5 star rating
- `SF_MemoryType`: Personal, Business, or Technical
- `SF_Group`: Group name with multiplier, e.g., "Server Logs (x5)"

## deviceType Duplicate Detection (Cross-Cutting)

All scan requests MUST include `deviceType` field:

| Scanner | deviceType | Duplicate Logic |
|---------|------------|-----------------|
| GM Scanner | `gm` | **Rejected globally** (each token processed once per session) |
| Player Scanner (Web) | `player` | **Allowed** (players can re-view same memory) |
| ESP32 Scanner | `esp32` | **Allowed** (players can re-view same memory) |

**CRITICAL**: Only GM scanners enforce duplicate rejection. Player scanners are for intel gathering - players SHOULD be able to re-scan tokens to review content. See `transactionService.js:222-256` for implementation.

**Scan Request Format:**
```javascript
{
  tokenId: 'abc123',
  teamId: 'Team Alpha',   // Optional for GM (alphanumeric, 1-30 chars)
  deviceId: 'device-uuid',
  deviceType: 'gm',       // REQUIRED
  timestamp: '2025-12-08T10:30:00Z'
}
```

## Dynamic Team Creation (Cross-Cutting)

Teams are created dynamically during sessions - no pre-defined team list required.

**How it works:**
- Sessions start with an empty teams array (`[]`)
- GM Scanner creates teams via `session:addTeam` command
- Any non-empty string is a valid team name (GM types what they want)
- Teams appear in dropdown after creation for future selections

**Team Entry UI:**
- **Standalone Mode**: Text input field (`#standaloneTeamName`)
- **Networked Mode**: Dropdown with existing teams + "Add Team" button

**No validation restrictions:** Team names like "Whitemetal Inc.", "O'Brien & Co.", etc. are all valid. The GM is paid staff on their own device - there's no abuse scenario requiring validation.

## Scanner Protocol Comparison

| Aspect | GM Scanner | Player Scanner (Web) | ESP32 Scanner |
|--------|-----------|---------------------|---------------|
| **Purpose** | **Game command center + token processing** | **Intel gathering (view memory)** | **Intel gathering (hardware)** |
| **Scoring** | **Yes (Black Market earns $)** | **No (tracked only)** | **No (tracked only)** |
| Language | ES6 modules (Vite) | Vanilla JS | C++ (Arduino) |
| Protocol | WebSocket (Socket.io) | HTTP (fetch) | HTTP/HTTPS |
| Auth | JWT token (24h) | Device ID | Device ID |
| Real-time | Yes (broadcasts) | No | No |
| Offline | Queue + localStorage | Dual-mode | SD card queue |
| Admin | Session/Video/System | None | None |
| **Persistence** | Transactions in session | Player scans in session | Player scans in session |

## GM Scanner Admin Capabilities

The GM Scanner is NOT just for scanning tokens - it's the **game command center**. In Networked mode, the admin panel provides:

| Category | Capabilities |
|----------|--------------|
| **Session** | Create/Pause/Resume/End sessions, Add teams mid-game |
| **Video** | Play/Pause/Stop/Skip, Queue management, Display mode toggle |
| **Scoring** | Manual adjustments, Reset all scores, Delete transactions |
| **Game Activity** | Unified view of player discoveries + GM transactions, Device status |

All admin commands use WebSocket `gm:command` events. See 'ALNScanner/CLAUDE.md' for implementation details.

## Contract-First Architecture

**CRITICAL**: Update contracts FIRST before changing APIs or events.

| Contract | Purpose | Location |
|----------|---------|----------|
| OpenAPI | HTTP endpoints | `backend/contracts/openapi.yaml` |
| AsyncAPI | WebSocket events | `backend/contracts/asyncapi.yaml` |

See 'backend/contracts/README.md' for full documentation.

Breaking changes require coordinated updates across backend + all 3 scanner submodules.

**Event Architecture (SRP Refactor):**
- Primary event is `transaction:accepted` (contains transaction, teamScore, groupBonusInfo)
- `sessionService` owns ALL persistence (not transactionService or stateService)
- Admin score adjustments emit `score:adjusted` (separate from transactions)
- `score:updated` is deprecated - extract score from `transaction:accepted.teamScore`
- `player:scan` broadcasts player scanner activity to GM room (persisted to session.playerScans)
- `sync:full` includes `playerScans` array for session restoration

## Submodule Architecture

```
ALN-Ecosystem/                     # Parent repo
├── backend/                       # [DIRECT] Orchestrator server
├── ALN-TokenData/                 # [SUBMODULE] Token definitions
├── aln-memory-scanner/            # [SUBMODULE] Player scanner
│   └── data/                      # [NESTED → ALN-TokenData]
├── ALNScanner/                    # [SUBMODULE] GM scanner
│   └── data/                      # [NESTED → ALN-TokenData]
└── arduino-cyd-player-scanner/    # [SUBMODULE] ESP32 scanner
```

For submodule management procedures, see 'SUBMODULE_MANAGEMENT.md'.

**Quick Commands:**
```bash
git submodule update --init --recursive    # Initialize all
git submodule update --remote --merge      # Update to latest
git submodule status --recursive           # Check sync status
```

## Key Commands

**Backend:** See 'backend/CLAUDE.md' for full command reference.
```bash
cd backend
npm run dev        # Development
npm test           # Unit + contract tests
npm run test:e2e   # Playwright E2E
npm start          # Production (PM2)
```

**GM Scanner:** See 'ALNScanner/CLAUDE.md' for full command reference.
```bash
cd ALNScanner
npm run dev        # Vite dev server (HTTPS:8443)
npm test           # Jest unit tests
npm run test:e2e   # Playwright E2E
npm run build      # Production build
```

## Cross-Module Debugging

### Token Data Sync Issues
**Symptoms:** Backend reports token not found, scanners show different data

**Debug:**
1. `git submodule status --recursive` - Check for detached HEAD
2. `git submodule update --remote --merge` - Sync all submodules
3. Restart backend to reload token data

**Key Files:** `backend/src/services/tokenService.js:49-66`, `.gitmodules`

### Scoring Mismatch (Networked vs Standalone)
**Symptoms:** Different scores for same tokens in different modes

**Debug:**
1. Verify both implementations match 'docs/SCORING_LOGIC.md'
2. Check group completion timing differences
3. Compare `transactionService.js` vs `dataManager.js`

### Cross-Scanner Communication Issues
**Symptoms:** Scans from one scanner type not appearing in another

**Debug:**
1. Verify `deviceType` field included in scan request
2. Check backend logs for duplicate detection
3. Verify WebSocket `sync:full` event sent after reconnect

### Post-Session Analysis
**Tool:** `npm run session:validate latest` (from backend/)
**Purpose:** Detect scoring discrepancies, video issues, duplicate handling bugs after a game session.
**Details:** See 'backend/CLAUDE.md' "Post-Session Analysis" section

## Notion Sync Scripts

**Purpose:** Sync Notion Elements database to `ALN-TokenData/tokens.json`

**Scripts:**
- `scripts/sync_notion_to_tokens.py` - Main sync (generates NeurAI BMPs)
- `scripts/compare_rfid_with_files.py` - Mismatch detection

**Notion Description/Text Format:**
```
Display text goes here

SF_RFID: [tokenId]
SF_ValueRating: [1-5]
SF_MemoryType: [Personal|Business|Technical]
SF_Group: [Group Name (xN)]
SF_Summary: [Optional summary]
```

## Component References

- 'backend/CLAUDE.md' - Backend Orchestrator
- 'ALNScanner/CLAUDE.md' - GM Scanner
- 'aln-memory-scanner/CLAUDE.md' - Player Scanner (Web)
- 'arduino-cyd-player-scanner/CLAUDE.md' - ESP32 Scanner
- 'docs/SCORING_LOGIC.md' - Scoring single source of truth
- 'DEPLOYMENT_GUIDE.md' - Deployment procedures
- 'SUBMODULE_MANAGEMENT.md' - Git submodule workflows
- 'backend/contracts/README.md' - API contracts
- 'logs/README_LOG_ARCHIVAL.md' - Log maintenance procedures
