# Transaction Flow Integration Test - Implementation Investigation

**Date**: 2025-10-04
**Purpose**: Deep investigation of ACTUAL implementation behavior before writing integration tests
**Rule**: NEVER write tests to pass based on current implementation - write tests to REVEAL bugs vs. INTENDED behavior

---

## INTENDED BEHAVIOR (from AsyncAPI Contract)

### Transaction Flow (AsyncAPI lines 580-585):
1. Client sends `transaction:submit` (wrapped event)
2. Server validates and processes
3. Server sends `transaction:result` to **submitter only**
4. Server broadcasts `transaction:new` to **all GMs in session**
5. Server broadcasts `score:updated` to **all GMs in session**

### Event Payloads (AsyncAPI Contract):

**transaction:result** (sent to submitter):
```yaml
Required fields:
  - status: "accepted" | "duplicate" | "error"
  - transactionId: UUID
  - tokenId: string
  - teamId: string (pattern: '^[0-9]{3}$')
  - points: integer (0 if duplicate/error)
  - message: string
  - error: string | null
```

**transaction:new** (broadcast to all GMs):
```yaml
Required fields:
  - transaction:
      - id: UUID
      - tokenId: string
      - teamId: string
      - deviceId: string
      - mode: string (blackmarket | detective)
      - points: integer
      - timestamp: ISO 8601
  - Enriched with: memoryType, valueRating (from tokens.json)
```

**score:updated** (broadcast to GM stations):
```yaml
Required fields:
  - teamId: string
  - currentScore: integer
  - baseScore: integer
  - bonusPoints: integer
  - tokensScanned: integer
  - completedGroups: array
  - lastUpdate: ISO 8601
```

---

## ACTUAL IMPLEMENTATION ANALYSIS

### WebSocket Handler (adminEvents.js):

**handleTransactionSubmit()** (lines 113-212):
1. Line 115-121: Auth check (requires socket.deviceId)
2. Line 124: Unwraps envelope → `transactionData = data.data || data`
3. Line 127: Validates using `scanRequestSchema`
4. Line 137-160: **Offline queue logic** (if offline, queues transaction)
5. Line 162-169: **Session check** (requires active session)
6. Line 172: Calls `transactionService.processScan(scanRequest, session)`
7. Line 176: Calls `sessionService.addTransaction(result.transaction)`
8. Line 180-188: Transforms result to AsyncAPI contract format
9. Line 191: **Sends transaction:result to SUBMITTER** (`emitWrapped(socket, ...)`)
10. Line 193-195: Comments say broadcasting handled by broadcasts.js

**✅ CORRECT**: Matches intended behavior - result sent to submitter only

---

### Transaction Service (transactionService.js):

**processScan()** (lines 83-189):
1. Line 90: Creates transaction from request
2. Line 93: Gets token from `this.tokens` Map
3. Line 96-122: **Test mode**: Creates mock tokens for TEST_ IDs
4. Line 124-128: **Invalid token**: Rejects transaction, returns error
5. Line 131-143: **Duplicate check**:
   - Checks if token already scanned in session
   - Returns duplicate status with claimedBy team
6. Line 147: **Accepts transaction**: `transaction.accept(token.value)`
7. Line 157-166: **CRITICAL MODE CHECK**:
   ```javascript
   if (transaction.mode !== 'detective') {
     this.updateTeamScore(transaction.teamId, token);
   } else {
     logger.info('Detective mode transaction - skipping scoring');
   }
   ```
8. Line 172: **Emits** `'transaction:accepted'` (unwrapped domain event)

**updateTeamScore()** (lines 241-299):
1. Line 242-250: Gets/creates team score
2. Line 252: `teamScore.addPoints(token.value)`
3. Line 253: `teamScore.incrementTokensScanned()`
4. Line 256: Calls `emitScoreUpdate(teamScore)`
5. Line 258-296: **Group completion check**
6. Line 298: **Emits** `'score:updated'` (unwrapped domain event)

**✅ CORRECT**: Blackmarket mode scores, detective mode doesn't

---

### Session Service (sessionService.js):

**addTransaction()** (lines 349-358):
1. Line 354: Adds transaction to session
2. Line 355: Saves session
3. Line 356: **Emits** `'transaction:added'` (unwrapped domain event)

---

### Broadcast Handler (broadcasts.js):

**Listens to sessionService 'transaction:added'** (line 73):
```javascript
addTrackedListener(sessionService, 'transaction:added', (transaction) => {
  const token = transactionService.getToken(transaction.tokenId);

  const payload = {
    transaction: {
      id: transaction.id,
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
      deviceId: transaction.deviceId,
      mode: transaction.mode,
      points: transaction.points,
      timestamp: transaction.timestamp,
      memoryType: token?.memoryType || 'UNKNOWN',
      valueRating: token?.metadata?.rating || 0
    }
  };

  emitToRoom(io, `session:${session.id}`, 'transaction:new', payload);
});
```

**Listens to transactionService 'score:updated'** (line 144):
```javascript
addTrackedListener(transactionService, 'score:updated', (teamScore) => {
  const payload = {
    teamId: teamScore.teamId,
    currentScore: teamScore.currentScore,
    baseScore: teamScore.baseScore,
    bonusPoints: teamScore.bonusPoints || 0,
    tokensScanned: teamScore.tokensScanned,
    completedGroups: teamScore.completedGroups || [],
    lastUpdate: teamScore.lastUpdate
  };

  emitToRoom(io, 'gm-stations', 'score:updated', payload);
});
```

**✅ CORRECT**: Broadcasts to all GMs in session/room

---

## COMPLETE EVENT FLOW (ACTUAL)

### Blackmarket Mode Transaction:
```
1. GM_BLACKMARKET emits transaction:submit (wrapped)
2. handleTransactionSubmit() unwraps → validates
3. transactionService.processScan():
   - Validates token
   - Checks duplicate
   - Accepts transaction (sets points = token.value)
   - Updates team score (because mode !== 'detective')
   - Emits 'transaction:accepted'
4. sessionService.addTransaction():
   - Adds to session
   - Emits 'transaction:added'
5. handleTransactionSubmit() sends transaction:result to GM_BLACKMARKET (submitter)
6. broadcasts.js hears 'transaction:added':
   - Enriches with token metadata
   - Broadcasts transaction:new to ALL GMs in session
7. updateTeamScore() emits 'score:updated'
8. broadcasts.js hears 'score:updated':
   - Broadcasts score:updated to ALL GM stations
```

**Events GM_BLACKMARKET receives**: transaction:result, transaction:new, score:updated
**Events GM_DETECTIVE receives**: transaction:new, score:updated

### Detective Mode Transaction:
```
1. GM_DETECTIVE emits transaction:submit (wrapped)
2. handleTransactionSubmit() unwraps → validates
3. transactionService.processScan():
   - Validates token
   - Checks duplicate
   - Accepts transaction (sets points = token.value)
   - SKIPS team score update (because mode === 'detective')
   - Emits 'transaction:accepted'
4. sessionService.addTransaction():
   - Adds to session
   - Emits 'transaction:added'
5. handleTransactionSubmit() sends transaction:result to GM_DETECTIVE (submitter)
6. broadcasts.js hears 'transaction:added':
   - Enriches with token metadata
   - Broadcasts transaction:new to ALL GMs in session
7. NO score:updated event (team score not updated)
```

**Events GM_DETECTIVE receives**: transaction:result, transaction:new
**Events GM_BLACKMARKET receives**: transaction:new (NO score:updated!)

---

## TEST TOKEN CALCULATIONS (ACTUAL VALUES)

### Token: 534e2b03
```yaml
SF_RFID: 534e2b03
SF_ValueRating: 3
SF_MemoryType: "Technical"
SF_Group: "" (not in a group)
video: "test_30sec.mp4"
```

**Point Calculation**:
- valueRatingMap[3] = 1000 (base value)
- typeMultipliers.technical = 5.0
- **Calculated value**: Math.floor(1000 * 5.0) = **5000 points**

**⚠️ CRITICAL**: Original plan said "3000 points" - **THIS IS WRONG!**
**Correct value**: **5000 points**

### Recommended Test Tokens:

**Personal rating=1** (low value):
- valueRatingMap[1] = 100
- typeMultipliers.personal = 1.0
- **Points**: 100

**Business rating=2** (medium value):
- valueRatingMap[2] = 500
- typeMultipliers.business = 3.0
- **Points**: 1500

**Technical rating=3** (high value):
- valueRatingMap[3] = 1000
- typeMultipliers.technical = 5.0
- **Points**: 5000 ← Use 534e2b03 for this

---

## POTENTIAL BUGS / AREAS TO TEST

### ⚠️ Issue 1: Detective Mode Points in Transaction Object

**Observation**: Line 147 of transactionService.processScan():
```javascript
transaction.accept(token.value); // Sets points BEFORE mode check
```

Then line 157-166:
```javascript
if (transaction.mode !== 'detective') {
  this.updateTeamScore(transaction.teamId, token);
}
```

**Question**: Should detective mode transactions have `points: 0` or `points: token.value`?

**Current behavior**: Detective transactions have `points: token.value` in transaction object, but team score is NOT updated.

**Contract says** (line 684): `points: integer - Points awarded (0 if duplicate/error)`

**Interpretation**: Detective mode might need `points: 0` since points are NOT actually awarded to team.

**Test should verify**: What points value appears in transaction:result and transaction:new for detective mode?

### ✅ Issue 2: Broadcast Consistency

**To test**: Both GMs (blackmarket and detective) should receive IDENTICAL transaction:new broadcasts, regardless of which submitted.

### ✅ Issue 3: Duplicate Detection

**To test**:
- Same token by same team → duplicate
- Same token by different team → duplicate (first-come-first-served)
- Error message includes claiming team

---

## TEST DESIGN STRATEGY

### Test 1: Blackmarket Mode Transaction
**Setup**: 1 GM in blackmarket mode
**Action**: Submit transaction for token 534e2b03, team 001
**Expected Events**:
1. transaction:result (to submitter):
   - status: "accepted"
   - points: 5000
   - tokenId: "534e2b03"
   - teamId: "001"
2. transaction:new (to all GMs):
   - transaction.mode: "blackmarket"
   - transaction.points: 5000
3. score:updated (to all GMs):
   - teamId: "001"
   - currentScore: 5000
   - tokensScanned: 1

### Test 2: Detective Mode Transaction
**Setup**: 1 GM in detective mode
**Action**: Submit transaction for different token, team 002
**Expected Events**:
1. transaction:result (to submitter):
   - status: "accepted"
   - points: ??? (test will reveal: 0 or token.value)
2. transaction:new (to all GMs):
   - transaction.mode: "detective"
   - transaction.points: ??? (test will reveal)
3. NO score:updated event
**Verify**: Team 002 score remains 0

### Test 3: Dual GM Mode Interaction
**Setup**: 2 GMs (GM_BLACKMARKET + GM_DETECTIVE)
**Action**:
1. GM_BLACKMARKET submits blackmarket transaction
2. GM_DETECTIVE submits detective transaction
**Verify**: Both GMs receive ALL transaction:new broadcasts

### Test 4: Duplicate Detection
**Setup**: 2 GMs, both in blackmarket mode
**Action**:
1. GM1 scans token 534e2b03 for team 001
2. GM2 scans same token for team 002
**Expected**:
1. First scan: accepted, 5000 points to team 001
2. Second scan: duplicate, 0 points, message includes "team 001"

---

## CONCLUSION

**Ready to write tests**: ✅
**Actual values confirmed**: ✅
**Potential bugs identified**: ✅ (detective mode points behavior)
**Test strategy defined**: ✅

**Next**: Create transaction-flow.test.js with tests designed to REVEAL the detective mode points behavior (not assume it).
