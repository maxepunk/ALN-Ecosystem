
> aln-orchestrator@1.0.0 session:validate
> node scripts/validate-session.js 0327gamereal

# ALN Session Validation Report

## Session Summary

| Property | Value |
|----------|-------|
| Session ID | 4d6daf2b-0a56-4bd3-a04b-56d8a78cc2b0 |
| Session Name | 0327gamereal |
| Status | ended |
| Started | 3/27/2026, 7:33:13 PM |
| Ended | 3/27/2026, 10:02:56 PM |
| Duration | 2h 29m |
| Total Transactions | 34 |
| Teams | 4 |

## Overall Status: ❌ FAIL

## Validation Checks

| Check | Status | Issues |
|-------|--------|--------|
| Transaction Flow | ✅ PASS | 0 |
| Scoring Integrity | ❌ FAIL | 5 |
| Detective Mode | ⚠️ WARNING | 4 |
| Video Playback | ✅ PASS | 0 |
| Device Connectivity | ✅ PASS | 0 |
| Group Completion | ✅ PASS | 0 |
| Duplicate Handling | ✅ PASS | 0 |
| Error Analysis | ⚠️ WARNING | 3 |
| Session Lifecycle | ⚠️ WARNING | 3 |

## Team Scores (Calculated vs Broadcast)

> **Note**: session.scores is always zeros. This compares calculated scores + admin adjustments against log broadcasts (what scoreboard displayed).

| Team | Calculated | Adj | Total | Broadcast | Base | Bonus | BM | Det | Status |
|------|------------|-----|-------|-----------|------|-------|----|----|--------|
| NovaNews | $25,000 | $-75,000 | $-50,000 | N/A | $25,000 | $0 | 1 | 25 | — |
| Victoria | $125,000 | $-375,000 | $-250,000 | N/A | $125,000 | $0 | 2 | 0 | — |
| Vic | $10,000 | +$475,000 | $485,000 | N/A | $10,000 | $0 | 1 | 0 | — |
| NeurAI | $350,000 | — | $350,000 | N/A | $350,000 | $0 | 5 | 0 | — |

## Detective Mode Summary

- **Detective scans**: 25
- **Blackmarket scans**: 9
- **Valid detective transactions**: 25
- **Missing summary field**: 4

## Error Summary

- **Errors**: 10
- **Warnings**: 148
- HTTP errors: 92
- WebSocket errors: 22
- **Unhandled exceptions**: 4

## Session Lifecycle Events

> These events may affect game state and explain anomalies.

### 🗑️ Transaction Deletions: 2

> ⚠️ **Logger duplication detected**: 12 raw log entries → 2 unique events (6.0x duplication)

**Deleted tokens:**
- `fli002`
- `jes003`

> Transaction deletions remove scans from the session. The token may have been rescanned afterward.

## Detailed Findings

### Transaction Flow

**Info:**
- ℹ️ Analyzed 34 transactions: 34 valid, 0 errors, 0 warnings

**Summary:**
```json
{
  "totalTransactions": 34,
  "validCount": 34,
  "errorCount": 0,
  "warningCount": 0,
  "fieldStats": {
    "missingTokenId": 0,
    "missingTeamId": 0,
    "missingStatus": 0,
    "missingTimestamp": 0,
    "missingMode": 0,
    "missingDeviceId": 0,
    "invalidStatus": 0,
    "invalidMode": 0,
    "unknownTokens": 0,
    "outsideTimeframe": 0
  }
}
```

### Scoring Integrity

**Errors:**
- ❌ 9 transactions have incorrect points values
  ```json
  {
    "mismatches": [
      {
        "tokenId": "mor002",
        "teamId": "Victoria",
        "expected": 75000,
        "actual": 225000,
        "difference": 150000
      },
      {
        "tokenId": "vic001",
        "teamId": "Victoria",
        "expected": 50000,
        "actual": 150000,
        "difference": 100000
      },
      {
        "tokenId": "mel001",
        "teamId": "Vic",
        "expected": 10000,
        "actual": 30000,
        "difference": 20000
      },
      {
        "tokenId": "kai002",
        "teamId": "NovaNews",
        "expected": 25000,
        "actual": 75000,
        "difference": 50000
      },
      {
        "tokenId": "sar002",
        "teamId": "NeurAI",
        "expected": 75000,
        "actual": 225000,
        "difference": 150000
      },
      {
        "tokenId": "zia002",
        "teamId": "NeurAI",
        "expected": 25000,
        "actual": 75000,
        "difference": 50000
      },
      {
        "tokenId": "nat003",
        "teamId": "NeurAI",
        "expected": 150000,
        "actual": 450000,
        "difference": 300000
      },
      {
        "tokenId": "kai003",
        "teamId": "NeurAI",
        "expected": 25000,
        "actual": 75000,
        "difference": 50000
      },
      {
        "tokenId": "sam002",
        "teamId": "NeurAI",
        "expected": 75000,
        "actual": 375000,
        "difference": 300000
      }
    ]
  }
  ```

**Warnings:**
- ⚠️ Team NovaNews: Has transactions but no broadcast found in logs
  ```json
  {
    "teamId": "NovaNews",
    "calculated": 25000,
    "adminAdjustment": -75000,
    "blackmarketCount": 1,
    "detectiveCount": 25
  }
  ```
- ⚠️ Team Victoria: Has transactions but no broadcast found in logs
  ```json
  {
    "teamId": "Victoria",
    "calculated": 125000,
    "adminAdjustment": -375000,
    "blackmarketCount": 2,
    "detectiveCount": 0
  }
  ```
- ⚠️ Team Vic: Has transactions but no broadcast found in logs
  ```json
  {
    "teamId": "Vic",
    "calculated": 10000,
    "adminAdjustment": 475000,
    "blackmarketCount": 1,
    "detectiveCount": 0
  }
  ```
- ⚠️ Team NeurAI: Has transactions but no broadcast found in logs
  ```json
  {
    "teamId": "NeurAI",
    "calculated": 350000,
    "adminAdjustment": 0,
    "blackmarketCount": 5,
    "detectiveCount": 0
  }
  ```

### Detective Mode

**Warnings:**
- ⚠️ Transaction d7393984-2a2d-4730-834c-418321727ff2: Detective mode transaction missing summary field
  ```json
  {
    "tokenId": "zia004",
    "teamId": "NovaNews",
    "note": "Summary is displayed on Evidence Board"
  }
  ```
- ⚠️ Transaction 6f382089-0e13-4241-ad0d-e7ef62fbe021: Detective mode transaction missing summary field
  ```json
  {
    "tokenId": "rem004",
    "teamId": "NovaNews",
    "note": "Summary is displayed on Evidence Board"
  }
  ```
- ⚠️ Transaction f75c811e-73f9-4ba6-9e25-022523ffa0dd: Detective mode transaction missing summary field
  ```json
  {
    "tokenId": "vic004",
    "teamId": "NovaNews",
    "note": "Summary is displayed on Evidence Board"
  }
  ```
- ⚠️ Transaction 2cf2c908-fc3c-43a2-b5ed-609793f66228: Detective mode transaction missing summary field
  ```json
  {
    "tokenId": "qui004",
    "teamId": "NovaNews",
    "note": "Summary is displayed on Evidence Board"
  }
  ```

**Summary:**
```json
{
  "totalTransactions": 34,
  "detectiveCount": 25,
  "blackmarketCount": 9,
  "validDetective": 25,
  "nonZeroPoints": 0,
  "missingSummary": 4,
  "teamDetectiveCounts": {
    "NovaNews": 25
  }
}
```

### Video Playback

**Info:**
- ℹ️ Video token database: 0 tokens have video assets
- ℹ️ Video events in logs: 32 playback started, 2 queued
- ℹ️ Video token scans in session: 0
- ℹ️ More playback events than video token scans (may include idle loop or manual plays)

**Summary:**
```json
{
  "videoTokensInDB": 0,
  "videoTokenScans": 0,
  "playbackStartedEvents": 32,
  "queuedEvents": 2,
  "vlcErrors": 0
}
```

### Device Connectivity

**Info:**
- ℹ️ Connection events: 74 connections, 28 authentications
- ℹ️ State sync events: 2 sync:full broadcasts
- ℹ️ Disconnection events: 0

**Summary:**
```json
{
  "connections": 74,
  "authentications": 28,
  "syncs": 2,
  "disconnections": 0,
  "sessionDevices": 0
}
```

### Group Completion

**Summary:**
```json
{
  "teamsChecked": 4,
  "totalGroupsInGame": 1,
  "groupsWithBonus": 0,
  "groupBroadcastsInLogs": 0
}
```

### Duplicate Handling

**Info:**
- ℹ️ No duplicate transactions in session

**Summary:**
```json
{
  "totalTransactions": 34,
  "duplicateCount": 0,
  "validDuplicates": 0,
  "orphanedDuplicates": 0,
  "duplicatesWithPoints": 0,
  "crossModeBlocks": 0,
  "falsePositiveCount": 0,
  "ghostScoringCount": 0,
  "duplicateTokens": [],
  "falsePositiveTokens": [],
  "ghostScoringTokens": []
}
```

### Error Analysis

**Warnings:**
- ⚠️ HTTP errors: 92
  ```json
  {
    "count": 92,
    "samples": [
      {
        "message": "Request failed",
        "timestamp": "2026-03-27 19:35:02.274"
      },
      {
        "message": "Request failed",
        "timestamp": "2026-03-27 19:35:02.276"
      },
      {
        "message": "Request failed",
        "timestamp": "2026-03-27 19:35:02.326"
      },
      {
        "message": "Request failed",
        "timestamp": "2026-03-27 19:35:02.326"
      },
      {
        "message": "Request failed",
        "timestamp": "2026-03-27 20:08:02.724"
      }
    ]
  }
  ```
- ⚠️ WebSocket errors: 22
  ```json
  {
    "count": 22,
    "samples": [
      {
        "message": "GM connection rejected: invalid token",
        "timestamp": "2026-03-27 19:34:58.345"
      },
      {
        "message": "GM connection rejected: invalid token",
        "timestamp": "2026-03-27 19:34:58.345"
      },
      {
        "message": "GM connection rejected: device ID already in use",
        "timestamp": "2026-03-27 19:34:58.454"
      },
      {
        "message": "GM connection rejected: device ID already in use",
        "timestamp": "2026-03-27 19:34:58.453"
      },
      {
        "message": "GM connection rejected: invalid token",
        "timestamp": "2026-03-27 19:35:02.394"
      }
    ]
  }
  ```
- ⚠️ Unhandled exceptions: 4
  ```json
  {
    "count": 4,
    "exceptions": [
      {
        "message": "unhandledRejection: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\nError: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\n    at /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/node_modules/node-persist/src/local-storage.js:316:89\n    at FSReqCallback.readFileAfterClose [as oncomplete] (node:internal/fs/read/context:68:3)",
        "timestamp": "2026-03-27 19:34:51.420",
        "stack": "Error: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\n    at /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/node_modules/node-persist/src/local-storage.js:316:89\n    at FSReqCallback.readFileAfterClose [as oncomplete] (node:internal/fs/read/context:68:3)"
      },
      {
        "message": "unhandledRejection: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\nError: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\n    at /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/node_modules/node-persist/src/local-storage.js:316:89\n    at FSReqCallback.readFileAfterClose [as oncomplete] (node:internal/fs/read/context:68:3)",
        "timestamp": "2026-03-27 19:34:51.419",
        "stack": "Error: [node-persist][readFile] /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/data/78b478a66c67446549fd1f02f2202b5f does not look like a valid storage file!\n    at /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/node_modules/node-persist/src/local-storage.js:316:89\n    at FSReqCallback.readFileAfterClose [as oncomplete] (node:internal/fs/read/context:68:3)"
      },
      {
        "message": "Unhandled Rejection",
        "timestamp": "2026-03-27 19:34:51.421"
      },
      {
        "message": "Unhandled Rejection",
        "timestamp": "2026-03-27 19:34:51.421"
      }
    ]
  }
  ```

**Summary:**
```json
{
  "totalErrors": 10,
  "totalWarnings": 148,
  "httpErrors": 92,
  "websocketErrors": 22,
  "vlcErrors": 0,
  "unhandledExceptions": 4,
  "validationErrors": 0,
  "otherErrors": 40
}
```

### Session Lifecycle

**Warnings:**
- ⚠️ High log duplication for deletion events (12 raw → 2 unique, ratio: 6.0x)
  ```json
  {
    "rawLogCount": 12,
    "uniqueCount": 2,
    "duplicationRatio": "6.0",
    "note": "High duplication may indicate logger bug or redundant event handlers"
  }
  ```
- ⚠️ Transaction deleted mid-session: fli002
  ```json
  {
    "tokenId": "fli002",
    "teamId": "NovaNews",
    "transactionId": "974ef7bc-753c-4b5d-a0ee-c3285f39d7bf",
    "timestamp": "2026-03-27 21:32:31.417",
    "wasRescanned": false,
    "stillExistsInSession": false
  }
  ```
- ⚠️ Transaction deleted mid-session: jes003
  ```json
  {
    "tokenId": "jes003",
    "teamId": "NovaNews",
    "transactionId": "65d7f217-e388-4992-9a8a-3a44683e8ce0",
    "timestamp": "2026-03-27 21:32:47.171",
    "wasRescanned": false,
    "stillExistsInSession": false
  }
  ```

**Summary:**
```json
{
  "deletionCount": 2,
  "deletionRawLogCount": 12,
  "deletionDuplicationRatio": "6.0",
  "deletedTokens": [
    "fli002",
    "jes003"
  ],
  "scoreResetCount": 0,
  "pauseResumeCount": 0,
  "manualCreationCount": 0,
  "preSessionTransactions": 0,
  "postSessionTransactions": 0,
  "hasLifecycleEvents": true
}
```

---
*Report generated: 2026-03-28T05:28:51.177Z*

