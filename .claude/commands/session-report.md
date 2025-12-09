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
- Points awarded
- Scoring breakdown:
  - Base value (from SF_ValueRating: 1=$100, 2=$500, 3=$1000, 4=$5000, 5=$10000)
  - Type multiplier (Personal=1x, Business=3x, Technical=5x)
  - Formula: `points = baseValue x typeMultiplier`
- Running team totals
- Timestamp

Reference @docs/SCORING_LOGIC.md for scoring logic details.
Reference token metadata from `backend/data/` file with key `tokens:all`.

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

Session files: `backend/data/` (node-persist format, look for `session:*` keys)
Log files: `backend/logs/combined.log`
Token metadata: `backend/data/` file with key `tokens:all`
Scoring reference: @docs/SCORING_LOGIC.md

## Output Format

Generate a well-structured markdown report with clear sections, tables where appropriate, and analytical insights.

## Session Timeframe

Use the session's `startTime` and `endTime` to filter relevant log entries.
Convert all timestamps to local timezone (Pacific) for readability.
