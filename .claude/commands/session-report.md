---
description: Generate comprehensive gameplay session report with GM and player scan analysis
argument-hint: [sessionId or name or "list"]
---

# Session Gameplay Report Generator

Generate a comprehensive gameplay report for the specified session.

## Arguments
- **$ARGUMENTS**: Session identifier (ID, partial name, or "list" to see available sessions)

## Your Task

If `$ARGUMENTS` is empty or "list", show available sessions from `backend/data/` with:
- Session name
- Session ID
- Start time (local timezone)
- Status
- Transaction count

Otherwise, find the session matching `$ARGUMENTS` (by ID or name partial match) and generate:

### 1. Detective Scans Breakdown (Alphabetically by Token)
For all transactions where `mode: "detective"`:
- Token ID
- Character (extract from summary, e.g., "SOFIA", "MARCUS")
- Scan time (local timezone)
- Device ID
- Team ID
- Evidence summary (the full summary field)

Sort alphabetically by token ID.

### 2. Black Market Scans with Scoring Analysis
For all transactions where `mode: "blackmarket"`:
- Token ID
- Team ID
- Points awarded (from transaction `points` field)
- Scoring breakdown (look up token in tokens:all database):
  - Base value from `metadata.rating`: 1=$10000, 2=$25000, 3=$50000, 4=$75000, 5=$150000
  - Type multiplier from `memoryType`: Personal=1x, Business=3x, Technical=5x
  - Formula: `points = baseValue × typeMultiplier`
  - Pre-calculated `value` field can be used for verification
- Running team totals
- Timestamp

Reference @docs/SCORING_LOGIC.md for scoring logic details.

### 3. Duplicate Scan Analysis
For all transactions where `status: "duplicate"`:
- Token ID
- When (timestamp)
- Which scanner (deviceId)
- Original transaction ID and timestamp
- Time delta between original and duplicate
- Any concurrent system events from logs around that timestamp

### 4. Player Scan Analysis
Parse `backend/logs/combined.log` for "Player scan received" entries during the session timeframe.

**Log format**: Winston JSON (one JSON object per line):
```json
{"level":"info","message":"Player scan received","metadata":{"metadata":{"deviceId":"...","teamId":"...","tokenId":"..."}},"timestamp":"2025-12-03 15:12:21.442"}
```

Include:
- Device ID patterns (PLAYER_*, SCANNER_001, etc.)
- Token IDs scanned
- Timestamps
- Team IDs (if present)
- Cross-reference: Did this token eventually get turned into detective or blackmarket?
- Behavioral patterns:
  - Which tokens were most scanned?
  - Which players were most active?
  - Time distribution of scans
  - Tokens scanned but never turned in

## Data Sources

### Session Files: `backend/data/` (node-persist format)
- Files are **hash-named** (e.g., `25724c868abc49b7fb3222bc5189309a`)
- Each file contains JSON: `{"key":"...", "value":{...}}`
- **To list sessions**: Grep all files for `"key":"session:` patterns
- **Historical data**: Also check `"key":"backup:session:` for session backups
- Session value structure includes: `id`, `name`, `startTime`, `endTime`, `status`, `teams`, `transactions[]`, `scores[]`

### Token Metadata: `backend/data/`
- Grep for `"key":"tokens:all"` to find the token database file
- The `value` is an array of token objects with:
  - `id`, `name`, `value` (pre-calculated points)
  - `memoryType` (Personal/Business/Technical)
  - `groupId`, `groupMultiplier`
  - `metadata.rating` (1-5), `metadata.summary`, `metadata.rfid`

### Log Files: `backend/logs/combined.log`
- Winston JSON format (one JSON object per line)
- Key fields: `level`, `message`, `metadata`, `timestamp`

### Scoring Reference: @docs/SCORING_LOGIC.md

## Output Format

Generate a well-structured markdown report with clear sections, tables where appropriate, and analytical insights.

## Session Timeframe

Use the session's `startTime` and `endTime` to filter relevant log entries.
Convert all timestamps to the system's local timezone for readability.
