# Mode Propagation Root Cause Investigation

## Findings

**Where mode is lost:** browser-mocks.js initialization

**Evidence:**

### 1. Browser Mock Initialization (browser-mocks.js:208-216)
```javascript
// Mock Settings global (App module uses Settings.deviceId, Settings.mode)
// In browser, loaded via separate <script> tag
// Will be overwritten by actual Settings module when imported
global.Settings = {
  deviceId: '001',
  mode: 'detective',  // HARDCODED TO 'detective'
  load: () => {},
  save: () => {}
};
```

**Problem:** Tests call `createAuthenticatedScanner(url, deviceId, 'blackmarket')` but the mock Settings object is hardcoded to `mode: 'detective'`, ignoring the parameter.

### 2. Transaction Payload Creation (ALNScanner/js/app/app.js:758-806)
```javascript
recordTransaction(token, tokenId, isUnknown) {
    const transaction = {
        timestamp: new Date().toISOString(),
        deviceId: Settings.deviceId,
        mode: Settings.mode,  // ← Reads from Settings.mode
        teamId: this.currentTeamId,
        rfid: tokenId,
        // ... rest of transaction
    };

    // For networked mode, queue to orchestrator:
    const txId = window.queueManager.queueTransaction({
        tokenId: tokenId,
        teamId: this.currentTeamId,
        deviceId: Settings.deviceId,
        mode: Settings.mode,  // ← AsyncAPI contract field
        timestamp: transaction.timestamp
    });
}
```

**Flow:** Transaction payload correctly reads `Settings.mode`, but since Settings.mode is hardcoded to 'detective', all transactions are sent as detective mode.

### 3. Test Helper (websocket-helpers.js:70-82)
```javascript
async function connectAndIdentify(socketOrUrl, deviceType, deviceId, timeout = 5000) {
  const socket = typeof socketOrUrl === 'string'
    ? createTrackedSocket(socketOrUrl, {
        auth: {
          token: 'test-jwt-token',
          deviceId: deviceId,
          deviceType: deviceType,
          version: '1.0.0'
        }
      })
    : socketOrUrl;
  // ...
}
```

**Note:** The `createAuthenticatedScanner` function passes mode as a parameter, but there's no mechanism to set `global.Settings.mode` from that parameter.

## Root Cause

**The browser-mocks.js file initializes `global.Settings.mode = 'detective'` as a static value, and tests have no way to override it when creating scanners with different modes.**

When tests call:
```javascript
createAuthenticatedScanner('http://localhost:3000', 'GM_001', 'blackmarket')
```

The 'blackmarket' parameter is unused because:
1. browser-mocks.js runs once at import time with hardcoded 'detective'
2. No setter exists to update Settings.mode after initialization
3. Scanner code reads Settings.mode directly, getting 'detective'
4. Transaction payloads are sent with mode: 'detective'
5. Backend scores with detective logic (0 points) instead of blackmarket
6. Tests timeout waiting for score updates that never match expectations

## Fix Required

**File:** `backend/tests/helpers/browser-mocks.js` (line 208-216)

**Option 1: Make Settings.mode dynamic (preferred)**
```javascript
// Mock Settings global with getter/setter support
global.Settings = {
  _mode: 'detective',  // Default
  deviceId: '001',

  get mode() {
    return this._mode;
  },

  set mode(value) {
    this._mode = value;
    // Also update localStorage to match real Settings behavior
    global.localStorage.setItem('mode', value);
  },

  load: () => {
    // Load from localStorage if available
    const storedMode = global.localStorage.getItem('mode');
    if (storedMode) {
      global.Settings._mode = storedMode;
    }
  },

  save: () => {
    global.localStorage.setItem('mode', global.Settings._mode);
  }
};
```

**Option 2: Add initialization helper**
```javascript
// Add after browser-mocks setup
function setupScannerMode(mode) {
  global.Settings.mode = mode;
  global.localStorage.setItem('mode', mode);
}

// Export for tests
module.exports = { setupScannerMode };
```

Then modify `createAuthenticatedScanner` in test helpers to call:
```javascript
setupScannerMode(mode);  // Set before scanner operations
```

## Verification

After fix, tests should:
1. ✅ Create scanner with mode: 'blackmarket'
2. ✅ Settings.mode reads as 'blackmarket'
3. ✅ Transaction payload includes mode: 'blackmarket'
4. ✅ Backend receives mode: 'blackmarket' and scores accordingly
5. ✅ Tests receive score:updated events with expected point values
6. ✅ No more timeouts waiting for score events

## Impact

**7+ test failures resolved:**
- group-completion.test.js (3 tests) - Timeout waiting for group bonus scores
- transaction-flow.test.js (3 tests) - Timeout waiting for blackmarket scores
- app-transaction-flow.test.js (1 test) - Mode mismatch in transaction flow
- session-lifecycle.test.js (1 test - potentially cascading) - Session operations with wrong mode
