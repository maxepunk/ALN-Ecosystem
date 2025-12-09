# CLAUDE.md

Last verified: 2025-12-08

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ALN (About Last Night) Ecosystem is a memory token scanning and video playback system for a 2-hour immersive game. It's a **monorepo with Git submodules** for both code sharing (scanners) and data sharing (token definitions).

**Components:**
- **Backend Orchestrator** (`backend/`): Node.js server - @backend/CLAUDE.md
- **GM Scanner** (`ALNScanner/`): ES6 module PWA for game masters - @ALNScanner/CLAUDE.md
- **Player Scanner (Web)** (`aln-memory-scanner/`): Vanilla JS PWA - @aln-memory-scanner/CLAUDE.md
- **Player Scanner (ESP32)** (`arduino-cyd-player-scanner/`): Hardware scanner - @arduino-cyd-player-scanner/CLAUDE.md
- **Token Data** (`ALN-TokenData/`): Shared JSON token definitions
- **Notion Sync Scripts** (`scripts/`): Python scripts for Notion → tokens.json

## Operation Modes (Cross-Cutting)

Components support two operation modes:

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
- See @docs/SCORING_LOGIC.md for parity risks

## Game Modes (Cross-Cutting)

Two distinct game modes affect scoring, display, and behavior:

**Detective Mode (`mode: 'detective'`):**
- Star ratings (1-5) for token value
- Evidence-based UI with summary text
- Scoreboard shows "Classified Evidence Terminal"

**Black Market Mode (`mode: 'blackmarket'`):**
- Currency-based scoring ($100 - $10,000)
- Type multipliers + group completion bonuses
- Scoreboard shows team rankings

**Affected Components:**
- Backend scoring logic
- GM Scanner UI and scoring
- Scoreboard display modes
- Result screen rendering

## Scoring Business Logic (Cross-Cutting)

**Single Source of Truth:** @docs/SCORING_LOGIC.md

**Quick Reference (Black Market Mode):**
```
tokenScore = BASE_VALUES[rating] × TYPE_MULTIPLIERS[type]

BASE_VALUES: {1: $100, 2: $500, 3: $1000, 4: $5000, 5: $10000}
TYPE_MULTIPLIERS: {Personal: 1x, Business: 3x, Technical: 5x, UNKNOWN: 0x}
```

**CRITICAL - Dual Implementation Warning:**

| Component | File | Lines |
|-----------|------|-------|
| Backend | `backend/src/services/transactionService.js` | 318-448 |
| GM Scanner | `ALNScanner/src/core/dataManager.js` | 29-43, 469-571 |

Values are IDENTICAL but timing differs for group completion detection. When updating scoring, ALWAYS update both files.

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
| GM Scanner | `gm` | Global dedup (any duplicate rejected) |
| Player Scanner (Web) | `player` | Per-team dedup |
| ESP32 Scanner | `esp32` | Per-team dedup |

**Scan Request Format:**
```javascript
{
  tokenId: 'abc123',
  teamId: '001',          // Optional for GM
  deviceId: 'device-uuid',
  deviceType: 'gm',       // REQUIRED
  timestamp: '2025-12-08T10:30:00Z'
}
```

## Scanner Protocol Comparison

| Aspect | GM Scanner | Player Scanner (Web) | ESP32 Scanner |
|--------|-----------|---------------------|---------------|
| Language | ES6 modules (Vite) | Vanilla JS | C++ (Arduino) |
| Protocol | WebSocket (Socket.io) | HTTP (fetch) | HTTP/HTTPS |
| Auth | JWT token (24h) | Device ID | Device ID |
| Real-time | Yes (broadcasts) | No | No |
| Offline | Queue + localStorage | Dual-mode | SD card queue |
| Admin | Session/Video/System | None | None |

## Contract-First Architecture

**CRITICAL**: Update contracts FIRST before changing APIs or events.

| Contract | Purpose | Location |
|----------|---------|----------|
| OpenAPI | HTTP endpoints | `backend/contracts/openapi.yaml` |
| AsyncAPI | WebSocket events | `backend/contracts/asyncapi.yaml` |

See @backend/contracts/README.md for full documentation.

Breaking changes require coordinated updates across backend + all 3 scanner submodules.

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

For submodule management procedures, see @SUBMODULE_MANAGEMENT.md.

**Quick Commands:**
```bash
git submodule update --init --recursive    # Initialize all
git submodule update --remote --merge      # Update to latest
git submodule status --recursive           # Check sync status
```

## Key Commands

**Backend:** See @backend/CLAUDE.md for full command reference.
```bash
cd backend
npm run dev        # Development
npm test           # Unit + contract tests
npm run test:e2e   # Playwright E2E
npm start          # Production (PM2)
```

**GM Scanner:** See @ALNScanner/CLAUDE.md for full command reference.
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
1. Verify both implementations match @docs/SCORING_LOGIC.md
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
**Details:** See @backend/CLAUDE.md "Post-Session Analysis" section

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

- @backend/CLAUDE.md - Backend Orchestrator
- @ALNScanner/CLAUDE.md - GM Scanner
- @aln-memory-scanner/CLAUDE.md - Player Scanner (Web)
- @arduino-cyd-player-scanner/CLAUDE.md - ESP32 Scanner
- @docs/SCORING_LOGIC.md - Scoring single source of truth
- @DEPLOYMENT_GUIDE.md - Deployment procedures
- @SUBMODULE_MANAGEMENT.md - Git submodule workflows
- @backend/contracts/README.md - API contracts
- @logs/README_LOG_ARCHIVAL.md - Log maintenance procedures
