# GM Scanner DRY/SOLID Cleanup

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate dead code, fix bugs, consolidate duplicated logic, and remove a deprecated UI screen from the GM Scanner (ALNScanner).

**Architecture:** 8 targeted changes across the GM Scanner codebase, organized in 3 batches by risk profile. All changes must pass 753+ unit tests and backend e2e test 30 (full game session multi-device flow).

**Tech Stack:** ES6 modules, Vite, Jest, Playwright, Socket.io

**Critical constraint:** Backend e2e test 30 (`backend/tests/e2e/flows/30-full-game-session-multi-device.test.js`) is the mission-critical verification gate. Run it after each batch.

---

## Batch A: Bug Fixes

### Task 1: Fix scan screen stats bar (getSessionStats bug)

The scan screen shows "X Tokens" and "$Y Score" at the bottom while a GM actively scans tokens for a team. These always show 0 because `UnifiedDataManager.getSessionStats()` references `this.app?.currentTeamId` but `this.app` is never set.

**Files:**
- Modify: `ALNScanner/src/main.js:244` (after app creation)
- Test: `ALNScanner/tests/unit/core/unifiedDataManager.test.js`

**Step 1: Write failing test**

In `ALNScanner/tests/unit/core/unifiedDataManager.test.js`, add inside the existing top-level `describe('UnifiedDataManager')` block:

```javascript
describe('getSessionStats', () => {
  it('should return stats for current team when app is wired', () => {
    // Setup: standalone mode with a transaction
    manager.setStrategy(standaloneStrategy);
    const tx = {
      tokenId: 'test001', teamId: 'TeamA', mode: 'blackmarket',
      valueRating: 3, memoryType: 'Personal', points: 50000,
      timestamp: new Date().toISOString()
    };
    manager.addTransaction(tx);

    // Wire app reference with currentTeamId
    manager.app = { currentTeamId: 'TeamA' };

    const stats = manager.getSessionStats();
    expect(stats.count).toBe(1);
    expect(stats.totalScore).toBeGreaterThanOrEqual(0);
  });

  it('should return zeros when no app is wired', () => {
    manager.setStrategy(standaloneStrategy);
    manager.app = null;
    const stats = manager.getSessionStats();
    expect(stats).toEqual({ count: 0, totalValue: 0, totalScore: 0 });
  });

  it('should return zeros when no team is selected', () => {
    manager.setStrategy(standaloneStrategy);
    manager.app = { currentTeamId: '' };
    const stats = manager.getSessionStats();
    expect(stats).toEqual({ count: 0, totalValue: 0, totalScore: 0 });
  });
});
```

**Step 2: Run test to verify first test fails**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.test.js --testNamePattern="should return stats for current team" -v
```

Expected: FAIL — `stats.count` is 0 because `this.app` is undefined.

**Step 3: Wire the app reference in main.js**

In `ALNScanner/src/main.js`, after line 244 (after `const app = new App({...});`), add:

```javascript
// Wire app reference for getSessionStats (same pattern as UIManager at app.js:79)
DataManager.app = app;
```

**Step 4: Run tests**

```bash
cd ALNScanner && npx jest tests/unit/core/unifiedDataManager.test.js --testNamePattern="getSessionStats" -v
```

Expected: All 3 PASS.

**Step 5: Run full unit suite**

```bash
cd ALNScanner && npm test
```

Expected: All tests pass.

**Step 6: Commit**

```bash
cd ALNScanner && git add src/main.js tests/unit/core/unifiedDataManager.test.js
git commit -m "fix: wire DataManager.app so scan screen stats bar shows live data"
```

---

### Task 2: Remove broken Promise.race concurrency limiter

`scanForServers` in `connectionWizard.js` tries to limit concurrent requests with `Promise.race(promises)` but the array grows unbounded — the limiter is a no-op. Browser connection pooling already handles rate limiting.

**Files:**
- Modify: `ALNScanner/src/ui/connectionWizard.js:72-92`

**Step 1: Remove the broken limiter**

In `ALNScanner/src/ui/connectionWizard.js`, replace lines 72-92:

```javascript
      const promises = [];

      // Scan detected subnet (254 IPs × 2 ports = 508 requests max)
      // Limited to 20 concurrent to avoid overwhelming network
      for (let i = 1; i <= 254; i++) {
        for (const port of commonPorts) {
          const url = `${protocol}://${subnet}.${i}:${port}`;
          promises.push(
            fetch(`${url}/health`, {
              method: 'GET',
              mode: 'cors',
              signal: AbortSignal.timeout(500)
            })
            .then(response => response.ok ? url : null)
            .catch(() => null)
          );
        }

        // Limit concurrent requests to avoid overwhelming the network
        if (promises.length >= 20) {
          await Promise.race(promises);
        }
      }
```

With:

```javascript
      const promises = [];

      // Scan detected subnet (254 IPs × 2 ports = 508 requests max)
      // Browser connection pooling naturally rate-limits concurrent requests
      for (let i = 1; i <= 254; i++) {
        for (const port of commonPorts) {
          const url = `${protocol}://${subnet}.${i}:${port}`;
          promises.push(
            fetch(`${url}/health`, {
              method: 'GET',
              mode: 'cors',
              signal: AbortSignal.timeout(500)
            })
            .then(response => response.ok ? url : null)
            .catch(() => null)
          );
        }
      }
```

**Step 2: Run tests**

```bash
cd ALNScanner && npm test
```

Expected: All pass (no tests exercise this code path directly).

**Step 3: Commit**

```bash
cd ALNScanner && git add src/ui/connectionWizard.js
git commit -m "fix: remove broken Promise.race concurrency limiter in server scan"
```

---

### Task 3: Verify Batch A with e2e test 30

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test tests/e2e/flows/30-full-game-session-multi-device.test.js
```

Expected: PASS (all 7 phases).

---

## Batch B: DRY Extractions & Dead Code Removal

### Task 4: Extract `isTokenValid` to shared utility

4 identical JWT validation implementations exist. Extract to a single shared utility.

**Files:**
- Create: `ALNScanner/src/utils/jwtUtils.js`
- Create: `ALNScanner/tests/unit/utils/jwtUtils.test.js`
- Modify: `ALNScanner/src/app/app.js:577-596` (delete `_isTokenValid`)
- Modify: `ALNScanner/src/app/initializationSteps.js:271-298` (delete `isTokenValid`)
- Modify: `ALNScanner/src/network/connectionManager.js:47-69` (delegate)
- Modify: `ALNScanner/src/services/StateValidationService.js:110-131` (delegate)

**Step 1: Write the test for the shared utility**

Create `ALNScanner/tests/unit/utils/jwtUtils.test.js`:

```javascript
import { isTokenValid } from '../../../src/utils/jwtUtils.js';

// Helper to create JWT with specific expiry
function createToken(expiresInSeconds) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000)
  }));
  return `${header}.${payload}.test-signature`;
}

describe('isTokenValid', () => {
  it('should return true for token expiring in 1 hour', () => {
    expect(isTokenValid(createToken(3600))).toBe(true);
  });

  it('should return false for expired token', () => {
    expect(isTokenValid(createToken(-60))).toBe(false);
  });

  it('should return false for token expiring within 1-minute buffer', () => {
    expect(isTokenValid(createToken(30))).toBe(false);
  });

  it('should return true for token expiring just beyond buffer', () => {
    expect(isTokenValid(createToken(120))).toBe(true);
  });

  it('should return false for null/undefined/empty', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid(undefined)).toBe(false);
    expect(isTokenValid('')).toBe(false);
  });

  it('should return false for malformed tokens', () => {
    expect(isTokenValid('not-a-jwt')).toBe(false);
    expect(isTokenValid('only.two')).toBe(false);
    expect(isTokenValid('a.b.c.d')).toBe(false);
  });

  it('should return false for token with no exp claim', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ iat: 123 }));
    expect(isTokenValid(`${header}.${payload}.sig`)).toBe(false);
  });

  it('should return false for invalid base64 payload', () => {
    expect(isTokenValid('valid.!!!invalid!!!.sig')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ALNScanner && npx jest tests/unit/utils/jwtUtils.test.js -v
```

Expected: FAIL — module not found.

**Step 3: Create the shared utility**

Create `ALNScanner/src/utils/jwtUtils.js`:

```javascript
/**
 * Validate JWT token expiration with 1-minute safety buffer.
 * Shared utility — replaces 4 duplicate implementations.
 *
 * @param {string} token - JWT token string
 * @returns {boolean} True if token exists, is well-formed, and not expired
 */
export function isTokenValid(token) {
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const decode = typeof atob !== 'undefined'
      ? (str) => atob(str)
      : (str) => Buffer.from(str, 'base64').toString();

    const payload = JSON.parse(decode(parts[1]));
    if (!payload.exp) return false;

    const now = Math.floor(Date.now() / 1000);
    const BUFFER_SECONDS = 60;
    return (payload.exp - BUFFER_SECONDS) > now;
  } catch {
    return false;
  }
}
```

**Step 4: Run the new test**

```bash
cd ALNScanner && npx jest tests/unit/utils/jwtUtils.test.js -v
```

Expected: All 8 PASS.

**Step 5: Replace all 4 duplicates**

**app.js** — Replace `_isTokenValid` method (lines 577-596) with:

```javascript
  _isTokenValid(token) {
    return isTokenValid(token);
  }
```

Add import at top of file: `import { isTokenValid } from '../utils/jwtUtils.js';`

**initializationSteps.js** — Delete the `isTokenValid` function (lines 271-298). Add import at top: `import { isTokenValid } from '../utils/jwtUtils.js';` (the call sites at lines ~200 already reference `isTokenValid(token)` by name).

**connectionManager.js** — Replace `isTokenValid` method body (lines 47-69) with:

```javascript
  isTokenValid() {
    return validateToken(this.token);
  }
```

Add import at top: `import { isTokenValid as validateToken } from '../utils/jwtUtils.js';` (aliased to avoid name collision with the method).

**StateValidationService.js** — Replace `isTokenValid` method body (lines 110-131) with:

```javascript
  isTokenValid(token) {
    return validateToken(token);
  }
```

Add import at top: `import { isTokenValid as validateToken } from '../utils/jwtUtils.js';`

**Step 6: Run full test suite**

```bash
cd ALNScanner && npm test
```

Expected: All pass. Existing tests for each caller still work since the public API is unchanged.

**Step 7: Commit**

```bash
cd ALNScanner && git add src/utils/jwtUtils.js tests/unit/utils/jwtUtils.test.js src/app/app.js src/app/initializationSteps.js src/network/connectionManager.js src/services/StateValidationService.js
git commit -m "refactor: extract isTokenValid to shared jwtUtils (DRY — was duplicated 4x)"
```

---

### Task 5: Delete dead migration code

`mergeOrphanedTransactions()` reads a localStorage key that nothing writes to. Always a no-op.

**Files:**
- Modify: `ALNScanner/src/network/networkedQueueManager.js:32-76`
- Modify: `ALNScanner/tests/unit/network/networkedQueueManager.test.js`

**Step 1: Delete the method and constructor call**

In `ALNScanner/src/network/networkedQueueManager.js`:
- Delete line 33: `this.mergeOrphanedTransactions();`
- Delete lines 36-76: the entire `mergeOrphanedTransactions()` method and its JSDoc

**Step 2: Delete the associated test**

In `ALNScanner/tests/unit/network/networkedQueueManager.test.js`, find and delete the test `'should merge orphaned transactions from fallback queue'` (approximately lines 93-107).

**Step 3: Run tests**

```bash
cd ALNScanner && npx jest tests/unit/network/networkedQueueManager.test.js -v
```

Expected: All remaining tests pass.

**Step 4: Run full suite**

```bash
cd ALNScanner && npm test
```

Expected: All pass.

**Step 5: Commit**

```bash
cd ALNScanner && git add src/network/networkedQueueManager.js tests/unit/network/networkedQueueManager.test.js
git commit -m "refactor: delete dead mergeOrphanedTransactions migration code"
```

---

### Task 6: Inline DataManagerUtils and delete

3 static methods wrapping `Set.has()`, `.add()`, `.delete()`. LocalStorage.js already bypasses this abstraction.

**Files:**
- Modify: `ALNScanner/src/core/unifiedDataManager.js:371-389`
- Delete: `ALNScanner/src/core/dataManagerUtils.js`
- Delete: `ALNScanner/tests/unit/core/dataManagerUtils.test.js`

**Step 1: Inline the Set operations in UnifiedDataManager**

In `ALNScanner/src/core/unifiedDataManager.js`:

Remove the import: `import { DataManagerUtils } from './dataManagerUtils.js';`

Replace the three methods (lines 371-389) with:

```javascript
  isTokenScanned(tokenId) {
    return this.scannedTokens.has(tokenId);
  }

  markTokenAsScanned(tokenId) {
    this.scannedTokens.add(tokenId);
  }

  unmarkTokenAsScanned(tokenId) {
    this.scannedTokens.delete(tokenId);
  }
```

**Step 2: Delete the utils file and its test**

```bash
cd ALNScanner && rm src/core/dataManagerUtils.js tests/unit/core/dataManagerUtils.test.js
```

**Step 3: Run tests**

```bash
cd ALNScanner && npm test
```

Expected: All pass. UnifiedDataManager tests already cover `isTokenScanned`/`markTokenAsScanned`/`unmarkTokenAsScanned` directly.

**Step 4: Commit**

```bash
cd ALNScanner && git add -u src/core/dataManagerUtils.js src/core/unifiedDataManager.js tests/unit/core/dataManagerUtils.test.js
git commit -m "refactor: inline DataManagerUtils Set wrappers, delete premature abstraction"
```

---

### Task 7: Verify Batch B with e2e test 30

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test tests/e2e/flows/30-full-game-session-multi-device.test.js
```

Expected: PASS.

---

## Batch C: Feature, DRY Extraction, and Dead UI Removal

### Task 8: Extract shared getGameActivity builder

~90% identical logic between `LocalStorage.getGameActivity()` and `NetworkedStorage.getGameActivity()`. Extract to a shared builder with options for the load-bearing differences.

**Files:**
- Create: `ALNScanner/src/core/gameActivityBuilder.js`
- Create: `ALNScanner/tests/unit/core/gameActivityBuilder.test.js`
- Modify: `ALNScanner/src/core/storage/LocalStorage.js:495-584`
- Modify: `ALNScanner/src/core/storage/NetworkedStorage.js:184-279`

**Step 1: Write the test for the builder**

Create `ALNScanner/tests/unit/core/gameActivityBuilder.test.js`:

```javascript
import { buildGameActivity } from '../../../src/core/gameActivityBuilder.js';

const mockTokenManager = {
  findToken: jest.fn((id) => ({
    SF_MemoryType: 'Technical',
    SF_ValueRating: 3,
    SF_Group: 'Test Group (x3)',
    summary: 'Test summary'
  }))
};

describe('buildGameActivity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return empty results for no data', () => {
    const result = buildGameActivity({
      transactions: [], playerScans: [], tokenManager: mockTokenManager
    });
    expect(result.tokens).toEqual([]);
    expect(result.stats.totalTokens).toBe(0);
  });

  it('should create discovery events from player scans', () => {
    const scans = [{
      tokenId: 'tok1', deviceId: 'dev1', timestamp: '2026-01-01T00:00:00Z',
      tokenData: { SF_ValueRating: 3, SF_MemoryType: 'Technical' }
    }];
    const result = buildGameActivity({
      transactions: [], playerScans: scans, tokenManager: mockTokenManager
    });
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].status).toBe('available');
    expect(result.tokens[0].events[0].type).toBe('discovery');
    expect(result.stats.available).toBe(1);
  });

  it('should create claim events from transactions', () => {
    const txs = [{
      tokenId: 'tok1', teamId: 'TeamA', mode: 'blackmarket',
      timestamp: '2026-01-01T00:00:00Z', points: 50000,
      memoryType: 'Technical', valueRating: 3
    }];
    const result = buildGameActivity({
      transactions: txs, playerScans: [], tokenManager: mockTokenManager
    });
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].status).toBe('claimed');
    expect(result.tokens[0].events[0].type).toBe('claim');
    expect(result.stats.claimed).toBe(1);
    expect(result.stats.claimedWithoutDiscovery).toBe(1);
  });

  it('should apply transactionFilter when provided', () => {
    const txs = [
      { tokenId: 'tok1', teamId: 'A', mode: 'blackmarket', timestamp: '2026-01-01T00:00:00Z', points: 100, status: 'accepted', memoryType: 'Personal', valueRating: 1 },
      { tokenId: 'tok2', teamId: 'A', mode: 'blackmarket', timestamp: '2026-01-01T00:01:00Z', points: 200, status: 'duplicate', memoryType: 'Personal', valueRating: 1 }
    ];
    const result = buildGameActivity({
      transactions: txs, playerScans: [], tokenManager: mockTokenManager,
      options: { transactionFilter: (tx) => !tx.status || tx.status === 'accepted' }
    });
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].tokenId).toBe('tok1');
  });

  it('should use pointsFallback when tx.points is missing', () => {
    const txs = [{
      tokenId: 'tok1', teamId: 'A', mode: 'blackmarket',
      timestamp: '2026-01-01T00:00:00Z', points: 0,
      memoryType: 'Technical', valueRating: 3
    }];
    const fallback = jest.fn(() => 99999);
    const result = buildGameActivity({
      transactions: txs, playerScans: [], tokenManager: mockTokenManager,
      options: { pointsFallback: fallback }
    });
    expect(fallback).toHaveBeenCalledWith(txs[0]);
    expect(result.tokens[0].events[0].points).toBe(99999);
  });

  it('should sort events chronologically within each token', () => {
    const scans = [{
      tokenId: 'tok1', deviceId: 'dev1', timestamp: '2026-01-01T00:05:00Z',
      tokenData: { SF_ValueRating: 1, SF_MemoryType: 'Personal' }
    }];
    const txs = [{
      tokenId: 'tok1', teamId: 'A', mode: 'blackmarket',
      timestamp: '2026-01-01T00:01:00Z', points: 100,
      memoryType: 'Personal', valueRating: 1
    }];
    const result = buildGameActivity({
      transactions: txs, playerScans: scans, tokenManager: mockTokenManager
    });
    expect(result.tokens[0].events[0].type).toBe('claim');
    expect(result.tokens[0].events[1].type).toBe('scan');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd ALNScanner && npx jest tests/unit/core/gameActivityBuilder.test.js -v
```

Expected: FAIL — module not found.

**Step 3: Create the builder**

Create `ALNScanner/src/core/gameActivityBuilder.js`:

```javascript
import { calculateTokenValue } from './scoring.js';

/**
 * Build unified game activity from transactions and player scans.
 * Shared implementation for LocalStorage and NetworkedStorage.
 *
 * @param {Object} params
 * @param {Array} params.transactions - GM transaction records
 * @param {Array} params.playerScans - Player scanner discovery records
 * @param {Object} params.tokenManager - TokenManager for token lookup
 * @param {Object} [params.options] - Mode-specific options
 * @param {Function} [params.options.transactionFilter] - Filter function for transactions (networked: exclude non-accepted)
 * @param {Function} [params.options.pointsFallback] - Fallback for missing tx.points (networked: recalculate)
 * @returns {Object} { tokens: Array, stats: Object }
 */
export function buildGameActivity({ transactions, playerScans, tokenManager, options = {} }) {
  const { transactionFilter, pointsFallback } = options;
  const tokenMap = new Map();

  // Process player scans (discoveries)
  playerScans.forEach(scan => {
    if (!tokenMap.has(scan.tokenId)) {
      const tokenData = scan.tokenData || {};
      tokenMap.set(scan.tokenId, {
        tokenId: scan.tokenId,
        tokenData,
        potentialValue: calculateTokenValue({
          valueRating: tokenData.SF_ValueRating,
          memoryType: tokenData.SF_MemoryType
        }),
        events: [{
          type: 'discovery',
          timestamp: scan.timestamp,
          deviceId: scan.deviceId
        }],
        status: 'available',
        discoveredByPlayers: true
      });
    } else {
      tokenMap.get(scan.tokenId).events.push({
        type: 'scan',
        timestamp: scan.timestamp,
        deviceId: scan.deviceId
      });
    }
  });

  // Process GM transactions (claims)
  transactions.forEach(tx => {
    if (transactionFilter && !transactionFilter(tx)) return;

    let activity = tokenMap.get(tx.tokenId);

    if (!activity) {
      const lookedUpToken = tokenManager?.findToken(tx.tokenId);
      const tokenData = lookedUpToken ? {
        SF_MemoryType: lookedUpToken.SF_MemoryType,
        SF_ValueRating: lookedUpToken.SF_ValueRating,
        SF_Group: lookedUpToken.SF_Group || null,
        summary: lookedUpToken.summary || null
      } : {
        SF_MemoryType: tx.memoryType,
        SF_ValueRating: tx.valueRating
      };

      activity = {
        tokenId: tx.tokenId,
        tokenData,
        potentialValue: calculateTokenValue({
          valueRating: tokenData.SF_ValueRating,
          memoryType: tokenData.SF_MemoryType
        }),
        events: [],
        status: 'claimed',
        discoveredByPlayers: false
      };
      tokenMap.set(tx.tokenId, activity);
    }

    const points = pointsFallback && !tx.points
      ? pointsFallback(tx)
      : (tx.points || 0);

    activity.events.push({
      type: 'claim',
      timestamp: tx.timestamp,
      mode: tx.mode,
      teamId: tx.teamId,
      points,
      summary: tx.summary || activity.tokenData?.summary || null
    });
    activity.status = 'claimed';
  });

  // Sort events chronologically within each token
  tokenMap.forEach(activity => {
    activity.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });

  const tokens = Array.from(tokenMap.values());

  return {
    tokens,
    stats: {
      totalTokens: tokens.length,
      available: tokens.filter(t => t.status === 'available').length,
      claimed: tokens.filter(t => t.status === 'claimed').length,
      claimedWithoutDiscovery: tokens.filter(t => t.status === 'claimed' && !t.discoveredByPlayers).length,
      totalPlayerScans: playerScans.length
    }
  };
}
```

**Step 4: Run builder tests**

```bash
cd ALNScanner && npx jest tests/unit/core/gameActivityBuilder.test.js -v
```

Expected: All 6 PASS.

**Step 5: Replace LocalStorage.getGameActivity()**

In `ALNScanner/src/core/storage/LocalStorage.js`, add import at top:

```javascript
import { buildGameActivity } from '../gameActivityBuilder.js';
```

Replace `getGameActivity()` method body (lines 495-584) with:

```javascript
  getGameActivity() {
    return buildGameActivity({
      transactions: this.sessionData.transactions,
      playerScans: this.playerScans,
      tokenManager: this.tokenManager
    });
  }
```

**Step 6: Replace NetworkedStorage.getGameActivity()**

In `ALNScanner/src/core/storage/NetworkedStorage.js`, add import at top (alongside existing `calculateTokenValue` import):

```javascript
import { buildGameActivity } from '../gameActivityBuilder.js';
```

Replace `getGameActivity()` method body (lines 184-279) with:

```javascript
  getGameActivity() {
    return buildGameActivity({
      transactions: this.transactions,
      playerScans: this.playerScans,
      tokenManager: this.tokenManager,
      options: {
        transactionFilter: (tx) => !tx.status || tx.status === 'accepted',
        pointsFallback: (tx) => calculateTokenValue({
          valueRating: tx.valueRating,
          memoryType: tx.memoryType
        })
      }
    });
  }
```

**Step 7: Run full test suite**

```bash
cd ALNScanner && npm test
```

Expected: All pass. Existing LocalStorage and NetworkedStorage tests validate getGameActivity behavior through the strategy interface.

**Step 8: Commit**

```bash
cd ALNScanner && git add src/core/gameActivityBuilder.js tests/unit/core/gameActivityBuilder.test.js src/core/storage/LocalStorage.js src/core/storage/NetworkedStorage.js
git commit -m "refactor: extract shared getGameActivity builder (DRY — was duplicated across storage strategies)"
```

---

### Task 9: Add minimal group:completed toast handler

Backend broadcasts group completion bonuses but the GM scanner drops the event. Add a minimal handler that shows a toast.

**Files:**
- Modify: `ALNScanner/src/network/networkedSession.js:254` (add case in switch)
- Modify: `ALNScanner/src/app/app.js:152` (add listener in `_wireNetworkedSessionEvents`)

**Step 1: Add the case in networkedSession.js**

In `ALNScanner/src/network/networkedSession.js`, inside the `_messageHandler` switch statement, add before the closing `}` of the switch (after the `case 'player:scan':` block at line 253):

```javascript
        case 'group:completed':
          this.dispatchEvent(new CustomEvent('group:completed', {
            detail: payload
          }));
          break;
```

**Step 2: Wire the toast in app.js**

In `ALNScanner/src/app/app.js`, inside `_wireNetworkedSessionEvents()`, add after the `auth:required` listener (after line 152):

```javascript
    this.networkedSession.addEventListener('group:completed', (event) => {
      const { teamId, bonus } = event.detail || {};
      const formattedBonus = bonus ? ` +$${bonus.toLocaleString()}` : '';
      this.uiManager.showToast(`Group completed by ${teamId || 'team'}${formattedBonus}`);
    });
```

**Step 3: Run tests**

```bash
cd ALNScanner && npm test
```

Expected: All pass. No existing tests exercise `group:completed`.

**Step 4: Commit**

```bash
cd ALNScanner && git add src/network/networkedSession.js src/app/app.js
git commit -m "feat: show toast when team completes a token group"
```

---

### Task 10: Delete the settings screen

The settings screen is dead — 3 buttons call methods that don't exist, 6 are developer test harnesses, and both real settings (device ID, mode) are available elsewhere. The gear icon is visible to GMs who may tap into a broken interface.

**Files:**
- Modify: `ALNScanner/index.html:68-70` (delete gear icon nav button)
- Modify: `ALNScanner/index.html:107-141` (delete settings screen HTML)
- Modify: `ALNScanner/src/app/app.js:262-300` (delete `showSettings`, `saveSettings`, `updateModeFromToggle`)
- Modify: `ALNScanner/src/app/app.js:1511-1642` (delete 6 test methods)
- Modify: `ALNScanner/src/ui/settings.js:33-45,62-78` (remove DOM references)
- Modify: `ALNScanner/src/ui/uiManager.js:41` (remove settings from screen map)
- Modify: Test files (update/remove settings screen tests)

**Step 1: Delete the gear icon from nav bar**

In `ALNScanner/index.html`, delete lines 68-70:

```html
                <button class="nav-button" data-action="app.showSettings" title="Settings">
                    ⚙️
                </button>
```

**Step 2: Delete the settings screen HTML**

In `ALNScanner/index.html`, delete lines 106-141 (the entire `<div id="settingsScreen">` block, including the comment above it).

**Step 3: Delete settings-related methods from app.js**

In `ALNScanner/src/app/app.js`:

- Delete `showSettings()` method (lines 262-264)
- Delete `saveSettings()` method (lines 266-269)
- Delete `updateModeFromToggle()` method (lines 294-300)
- Delete all 6 test methods: `testTokenMatch`, `testGroupParsing`, `testGroupInventory`, `testCompletionDetection`, `testBonusCalculations`, `testEnhancedUI` (lines 1511-1642)

**Step 4: Remove DOM references from settings.js**

In `ALNScanner/src/ui/settings.js`, simplify `load()` by removing DOM element updates (lines 33-45 that reference `deviceId`, `deviceIdDisplay`, `modeToggle` elements inside settingsScreen):

Replace the `load()` method with:

```javascript
  load() {
    this.deviceId = localStorage.getItem('deviceId') || '001';
    this.mode = localStorage.getItem('mode') || 'detective';

    this.dispatchEvent(new CustomEvent('settings:loaded', {
      detail: { deviceId: this.deviceId, mode: this.mode }
    }));
  }
```

Simplify `save()` by removing the DOM-reading block (lines 62-78 that check for `settingsScreen.active` and read from DOM inputs):

Replace the `save()` method with:

```javascript
  save() {
    const oldDeviceId = this.deviceId;
    const oldMode = this.mode;

    localStorage.setItem('deviceId', this.deviceId);
    localStorage.setItem('mode', this.mode);

    const deviceIdDisplay = document.getElementById('deviceIdDisplay');
    if (deviceIdDisplay) {
      deviceIdDisplay.textContent = this.deviceId;
    }

    this.dispatchEvent(new CustomEvent('settings:saved', {
      detail: { deviceId: this.deviceId, mode: this.mode }
    }));

    if (oldDeviceId !== this.deviceId || oldMode !== this.mode) {
      this.dispatchEvent(new CustomEvent('settings:changed', {
        detail: { deviceId: this.deviceId, mode: this.mode, oldDeviceId, oldMode }
      }));
    }
  }
```

**Step 5: Remove settings from uiManager screen map**

In `ALNScanner/src/ui/uiManager.js`, delete line 41:

```javascript
      settings: document.getElementById('settingsScreen'),
```

**Step 6: Update tests**

Multiple test files reference the settings screen. For each:

- **`tests/unit/ui/settings.test.js`**: Rewrite to test `Settings` as a state holder + localStorage persistence without DOM elements. Remove all tests that create/check `#settingsScreen`, `#deviceId` input, `#modeToggle` checkbox. Keep tests for `load()` reading from localStorage, `save()` writing to localStorage, and event emission.

- **`tests/app/app.test.js`**: Remove test blocks for `showSettings()`, `saveSettings()`, `updateModeFromToggle()`, and any `testXxx()` methods.

- **`tests/e2e/page-objects/GMScannerPage.js`**: Remove `settingsScreen`, `settingsButton`, `saveSettingsBtn` locators and `saveSettings()` helper method.

- **`tests/e2e/specs/00-smoke-no-globals.spec.js`**: Remove test that clicks settings button and checks settings screen visibility.

- **`tests/e2e/specs/01-integration.spec.js`**: Remove test that navigates to settings screen.

- **`tests/e2e/specs/02-standalone-mode.spec.js`**: Remove or rewrite the settings persistence test (lines ~190-264). If the test sets device ID via the settings screen, it should be removed — device ID is set by Connection Wizard or defaults.

**Step 7: Run full test suite**

```bash
cd ALNScanner && npm test
cd ALNScanner && npm run test:e2e
```

Expected: All pass after test updates.

**Step 8: Commit**

```bash
cd ALNScanner && git add -A
git commit -m "refactor: delete dead settings screen, test methods, and broken buttons"
```

---

### Task 11: Verify Batch C with e2e test 30

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test tests/e2e/flows/30-full-game-session-multi-device.test.js
```

Expected: PASS.

---

### Task 12: Final full verification

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm test
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/ALNScanner && npm run test:e2e
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npm test
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend && npx playwright test tests/e2e/flows/30-full-game-session-multi-device.test.js
```

All must pass.

---

## Summary

| Task | Type | Risk | Lines Changed |
|------|------|------|:---:|
| 1. Fix scan screen stats | Bug fix | Very Low | +1 |
| 2. Fix scanForServers | Bug fix | Very Low | -4 |
| 3. Verify Batch A | Gate | — | — |
| 4. Extract jwtUtils | DRY | Low | +20, -80 |
| 5. Delete migration code | Dead code | Very Low | -45 |
| 6. Inline DataManagerUtils | KISS | Very Low | -40 |
| 7. Verify Batch B | Gate | — | — |
| 8. Extract gameActivityBuilder | DRY | Medium | +100, -180 |
| 9. Group completion toast | Feature | Low | +8 |
| 10. Delete settings screen | Dead code | Low-Medium | -170 |
| 11. Verify Batch C | Gate | — | — |
| 12. Final verification | Gate | — | — |

**Net reduction: ~390 lines** (not counting test changes).
