# Device Type Behavior Requirements

**Date:** 2025-11-06
**Purpose:** Define device-specific behavior to prevent implementation errors
**Status:** ✅ Authoritative Reference

---

## Critical Business Rules

### Duplicate Scan Behavior (MUST NEVER BE VIOLATED)

| Device Type | Duplicate Behavior | Reason | Example |
|-------------|-------------------|--------|---------|
| **GM Scanner** | ❌ **REJECT** duplicates | Scoring system - prevent accidental double-scoring | GM scans kaa001 twice → 2nd scan rejected |
| **Player Scanner (Web)** | ✅ **ALLOW** duplicates | Content consumption - players re-view memories | Player scans kaa001 twice → both show content |
| **ESP32 Scanner (Hardware)** | ✅ **ALLOW** duplicates | Content consumption - players re-view memories | ESP32 scans kaa001 twice → both show content |

### Implementation Requirements

**Backend Detection Logic:**
```javascript
// backend/src/services/transactionService.js
isDuplicate(transaction, session) {
  // CRITICAL: Only check duplicates for GM scanners
  // Players and ESP32 devices MUST be allowed to re-scan tokens

  if (transaction.deviceType !== 'gm') {
    return false;  // ← ALWAYS allow duplicates for player/ESP32
  }

  // GM Scanner: Check if THIS GM device already scanned this token
  if (session.hasDeviceScannedToken(transaction.deviceId, transaction.tokenId)) {
    return true;  // Duplicate for THIS GM station
  }

  return false;
}
```

**Frontend Scan Request:**
```javascript
// ALL scanners must include deviceType in scan requests
{
  tokenId: "kaa001",
  deviceId: "GM_STATION_1",  // or "PLAYER_001", "ESP32_001"
  deviceType: "gm",          // ← REQUIRED: 'gm', 'player', or 'esp32'
  teamId: "001",
  timestamp: "2025-11-06T..."
}
```

---

## Device Type Taxonomy

### 1. GM Scanner (Game Master)

**Device Type:** `gm`
**Device ID Pattern:** `GM_STATION_1`, `GM_STATION_2`, etc.
**Communication:** WebSocket (real-time state sync)
**Duplicate Policy:** ❌ REJECT

**Capabilities:**
- ✅ Real-time scoring updates
- ✅ Session control (start/pause/end)
- ✅ Admin interventions (add points, modify state)
- ✅ Offline queue with batch ACK via WebSocket
- ✅ Device-specific duplicate rejection
- ✅ Video trigger control

**Use Case:**
Game Master scans tokens to track team progress and award points. Duplicate scans are prevented to avoid scoring errors.

---

### 2. Player Scanner (Web PWA)

**Device Type:** `player`
**Device ID Pattern:** `PLAYER_001`, `PLAYER_002`, etc.
**Communication:** HTTP (polling for health checks)
**Duplicate Policy:** ✅ ALLOW

**Capabilities:**
- ✅ Content viewing (images, audio)
- ✅ Video playback triggering (orchestrator queues video)
- ✅ Offline queue with batch upload
- ✅ Dual-mode operation (standalone/networked)
- ❌ NO duplicate rejection (players can re-view)
- ❌ NO scoring control
- ❌ NO admin functions

**Use Case:**
Players scan QR codes/RFID tokens to view memory content. They should be able to re-scan tokens to review content multiple times.

---

### 3. ESP32 Scanner (Hardware)

**Device Type:** `esp32`
**Device ID Pattern:** `ESP32_001`, `ESP32_002`, etc.
**Communication:** HTTP (with SD card queue persistence)
**Duplicate Policy:** ✅ ALLOW

**Capabilities:**
- ✅ Content viewing (images on LCD, audio playback)
- ✅ Video playback triggering (orchestrator queues video)
- ✅ SD card queue (survives power loss)
- ✅ Offline queue with batch upload
- ❌ NO duplicate rejection (players can re-view)
- ❌ NO scoring control
- ❌ NO admin functions

**Use Case:**
Hardware alternative to web player scanner. Same content consumption model - players can re-scan tokens.

---

## API Contract Requirements

### POST /api/scan (Single Scan)

**Request Body:**
```json
{
  "tokenId": "kaa001",
  "deviceId": "GM_STATION_1",
  "deviceType": "gm",           // ← REQUIRED
  "teamId": "001",
  "timestamp": "2025-11-06T12:00:00.000Z"
}
```

**Response (GM Scanner - Duplicate):**
```json
{
  "status": "rejected",
  "duplicate": true,
  "message": "Token already scanned by this device"
}
```
HTTP Status: `409 Conflict`

**Response (Player Scanner - Duplicate Allowed):**
```json
{
  "status": "accepted",
  "duplicate": false,           // ← NOT a duplicate for player
  "tokenId": "kaa001",
  "points": 0,                  // Players don't score
  "video": "filename.mp4"
}
```
HTTP Status: `200 OK`

---

### POST /api/scan/batch (Batch Upload)

**Request Body:**
```json
{
  "batchId": "uuid-12345",
  "transactions": [
    {
      "tokenId": "kaa001",
      "deviceId": "PLAYER_001",
      "deviceType": "player",   // ← REQUIRED for each transaction
      "teamId": "001",
      "timestamp": "2025-11-06T12:00:00.000Z"
    }
  ]
}
```

**Behavior:**
- GM transactions: Check duplicates, reject if already scanned by same GM
- Player transactions: NEVER check duplicates, always accept
- ESP32 transactions: NEVER check duplicates, always accept

---

## Session Metadata Structure

```javascript
Session.metadata = {
  gmStations: 2,                    // Count of connected GM devices
  playerDevices: 5,                 // Count of connected Player devices
  totalScans: 47,
  uniqueTokensScanned: ["kaa001", "rat001", ...],
  scannedTokensByDevice: {
    // GM Scanners: Track for duplicate detection
    "GM_STATION_1": ["kaa001", "rat001"],
    "GM_STATION_2": ["kaa002"],

    // Player Scanners: Track for analytics ONLY (not duplicate detection)
    "PLAYER_001": ["kaa001", "kaa001", "rat001"],  // ← Note duplicates allowed
    "PLAYER_002": ["kaa002", "kaa002", "kaa002"],  // ← Player re-scanned 3x

    // ESP32 Scanners: Track for analytics ONLY
    "ESP32_001": ["kaa003", "kaa003"]              // ← Duplicates allowed
  }
}
```

**Purpose by Device Type:**
- **GM:** Duplicate detection (business logic)
- **Player/ESP32:** Analytics only (track engagement, no rejection)

---

## Testing Requirements

### Unit Tests (MUST HAVE)

```javascript
describe('Duplicate Detection by Device Type', () => {
  it('should REJECT duplicate scans for GM scanners', async () => {
    // Scan 1: GM_STATION_1 scans kaa001
    const result1 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'GM_STATION_1',
      deviceType: 'gm',
      teamId: '001'
    }, session);
    expect(result1.status).toBe('accepted');

    // Scan 2: Same GM scans kaa001 again
    const result2 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'GM_STATION_1',
      deviceType: 'gm',
      teamId: '001'
    }, session);
    expect(result2.status).toBe('rejected');
    expect(result2.duplicate).toBe(true);
  });

  it('should ALLOW duplicate scans for Player scanners', async () => {
    // Scan 1: PLAYER_001 scans kaa001
    const result1 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'PLAYER_001',
      deviceType: 'player',
      teamId: '001'
    }, session);
    expect(result1.status).toBe('accepted');

    // Scan 2: Same Player scans kaa001 again (re-viewing content)
    const result2 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'PLAYER_001',
      deviceType: 'player',
      teamId: '001'
    }, session);
    expect(result2.status).toBe('accepted');  // ← MUST accept
    expect(result2.duplicate).toBe(false);     // ← NOT a duplicate for player
  });

  it('should ALLOW duplicate scans for ESP32 scanners', async () => {
    // Scan 1: ESP32_001 scans kaa001
    const result1 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'ESP32_001',
      deviceType: 'esp32',
      teamId: '001'
    }, session);
    expect(result1.status).toBe('accepted');

    // Scan 2: Same ESP32 scans kaa001 again
    const result2 = await transactionService.processScan({
      tokenId: 'kaa001',
      deviceId: 'ESP32_001',
      deviceType: 'esp32',
      teamId: '001'
    }, session);
    expect(result2.status).toBe('accepted');  // ← MUST accept
    expect(result2.duplicate).toBe(false);
  });
});
```

---

## Common Pitfalls to Avoid

### ❌ WRONG: Apply duplicate detection to all devices
```javascript
// DON'T DO THIS
isDuplicate(transaction, session) {
  if (session.hasDeviceScannedToken(transaction.deviceId, transaction.tokenId)) {
    return true;  // ← WRONG: Applies to ALL devices
  }
}
```

### ✅ CORRECT: Check deviceType first
```javascript
// DO THIS
isDuplicate(transaction, session) {
  // Only GM scanners reject duplicates
  if (transaction.deviceType !== 'gm') {
    return false;  // ← Players and ESP32 always allowed
  }

  // GM duplicate check
  if (session.hasDeviceScannedToken(transaction.deviceId, transaction.tokenId)) {
    return true;
  }

  return false;
}
```

---

### ❌ WRONG: Assume deviceType from deviceId pattern
```javascript
// DON'T DO THIS
const deviceType = deviceId.startsWith('GM_') ? 'gm' : 'player';
```

### ✅ CORRECT: Require explicit deviceType in request
```javascript
// DO THIS
if (!transaction.deviceType || !['gm', 'player', 'esp32'].includes(transaction.deviceType)) {
  throw new Error('Invalid or missing deviceType');
}
```

---

## Documentation Updates Required

When implementing ANY feature that behaves differently per device type:

1. ✅ Check this document FIRST
2. ✅ Add device-type column to feature tables
3. ✅ Write tests for ALL three device types
4. ✅ Document behavior differences clearly
5. ✅ Update API contracts with deviceType examples

---

## Phase Implementation Checklist

**Before implementing ANY phase task:**

- [ ] Does this feature behave differently for GM vs Player vs ESP32?
- [ ] If yes, have I consulted DEVICE_TYPE_BEHAVIOR_REQUIREMENTS.md?
- [ ] Do my tests cover all three device types?
- [ ] Does my implementation check `deviceType` explicitly?
- [ ] Is `deviceType` included in all API requests?
- [ ] Have I updated contracts to show device-type-specific behavior?

---

## References

- **Backend Implementation:** `backend/src/services/transactionService.js`
- **API Contracts:** `backend/contracts/openapi.yaml`
- **Session Model:** `backend/src/models/session.js`
- **Transaction Model:** `backend/src/models/transaction.js`
- **GM Scanner:** `ALNScanner/js/network/orchestratorClient.js`
- **Player Scanner:** `aln-memory-scanner/js/orchestratorIntegration.js`
- **ESP32 Scanner:** `arduino-cyd-player-scanner/src/ScanManager.cpp`

---

**Prepared by:** Claude Code
**Date:** 2025-11-06
**Status:** ✅ Authoritative Reference - MUST be followed for ALL device-type logic
