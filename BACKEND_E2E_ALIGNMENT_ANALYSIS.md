# Backend E2E Test Suite Alignment Analysis

**Date**: 2025-11-11
**Context**: ALNScanner ES6 Migration - Backend E2E Test Alignment
**Status**: Investigation Complete - Implementation Required

---

## Executive Summary

The backend E2E test suite has **critical misalignments** with the ALNScanner ES6 refactor work done in the `ALNScanner-es6-migration` worktree. The tests are broken due to:

1. **Window globals removed** (Phase 7.0 of ES6 migration)
2. **Page Object location mismatch** (deleted from wrong location)
3. **Incomplete scanner deployment** (worktree changes not yet in backend/public/gm-scanner)
4. **Anti-pattern window global checks** in test code

---

## Current State Assessment

### What's Working ✅
- **Backend E2E infrastructure**: Test server, VLC setup, WebSocket client helpers all functional
- **Page Object pattern adoption**: Tests already migrated to use `GMScannerPage` (good!)
- **Contract-based testing**: Tests properly validate AsyncAPI contracts

### What's Broken ❌

#### 1. **GMScannerPage Import Path Issue**
**Files Affected**:
- `backend/tests/e2e/helpers/scanner-init.js:10`
- `backend/tests/e2e/flows/duplicate-detection.spec.js:22` (via scanner-init)
- `backend/tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js:43` (via scanner-init)
- `backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js` (via scanner-init)

**Current Code**:
```javascript
const { GMScannerPage } = require('../page-objects/GMScannerPage');
```

**Problem**:
- Git shows `deleted: backend/tests/e2e/helpers/page-objects/GMScannerPage.js`
- But file exists at `backend/tests/e2e/page-objects/GMScannerPage.js`
- Import path expects `helpers/page-objects/` but file is at `page-objects/`

**Resolution**: Update import paths to `../page-objects/GMScannerPage`

#### 2. **Window Global Usage Anti-Pattern**
**Files Affected**:
- `backend/tests/e2e/flows/duplicate-detection.spec.js:247-248, 262-263, 307-308`

**Current Code**:
```javascript
// Line 247-248: Disconnect WebSocket
await page.evaluate(() => {
  if (window.connectionManager?.client?.socket) {
    window.connectionManager.client.socket.close();
  }
});

// Line 262-263: Reconnect
await page.evaluate(() => {
  if (window.connectionManager) {
    window.connectionManager.connect();
  }
});

// Line 307-308: Workaround for standalone bug
await page.evaluate(() => {
  if (!window.UIManager.updateScoreboard) {
    window.UIManager.updateScoreboard = () => {};
  }
});
```

**Problem**:
- Phase 7.0 removed ALL window globals (`window.App`, `window.connectionManager`, `window.UIManager`, etc.)
- ES6 architecture uses pure DOM interaction via `data-action` attributes
- Tests trying to access non-existent globals will throw `TypeError: Cannot read property 'client' of undefined`

**Resolution**: Replace with DOM-based reconnection methods in Page Object

#### 3. **Scanner Deployment Mismatch**
**Current Deployment**:
- `backend/public/gm-scanner/` is a **submodule symlink** to `ALNScanner` repo
- Points to commit `a88c34a` (November 7, 2025 - pre-ES6 migration)
- Still has old architecture with window globals

**Worktree State**:
- `ALNScanner-es6-migration/` has ES6 refactored code (commit `0785d16`, November 11)
- No window globals ✅
- Event-driven architecture ✅
- DOM event bindings ✅

**Problem**: Tests are running against OLD scanner code that hasn't been updated yet

**Resolution**: Deploy ES6 scanner to backend OR update submodule reference

#### 4. **Page Object Version Mismatch**
**Backend Version** (`backend/tests/e2e/page-objects/GMScannerPage.js`):
- Lines 78-153: Enhanced `goto()` with extensive debugging
- Uses `/gm-scanner/` path
- Has window global checks in debugging code

**Worktree Version** (`ALNScanner-es6-migration/tests/e2e/page-objects/GMScannerPage.js`):
- Lines 74-80: Simple `goto()` without debugging
- Uses `/` path (assumes serving from root)
- No window global checks

**Problem**: Different implementations, different assumptions about deployment

**Resolution**: Consolidate to single source of truth

---

## Scanner Initialization Flow Analysis

### Current Backend Test Flow (scanner-init.js)

```javascript
async function initializeGMScannerWithMode(page, sessionMode, gameMode, options) {
  const gmScanner = new GMScannerPage(page);
  await gmScanner.goto();                    // ← FAILS if path wrong

  // Game mode selection
  const buttonSelector = `button[data-action="app.selectGameMode"][data-arg="${sessionMode}"]`;
  await page.click(buttonSelector);          // ← WORKS (uses data-action) ✅

  // Networked mode connection
  if (sessionMode === 'networked') {
    await gmScanner.manualConnect(           // ← Missing method in Page Object
      options.orchestratorUrl,
      options.stationName,
      options.password
    );
  }
}
```

**Issues**:
1. `goto()` path differs between versions
2. `manualConnect()` method doesn't exist in Page Object
3. No reconnection support methods

### Required Page Object Methods (Missing)

```javascript
class GMScannerPage {
  // MISSING: Manual orchestrator connection
  async manualConnect(url, stationName, password) { }

  // MISSING: Wait for WebSocket connection
  async waitForConnection() { }

  // MISSING: Disconnect/reconnect methods for testing
  async disconnectWebSocket() { }
  async reconnectWebSocket() { }

  // MISSING: Error message getter
  async getErrorMessage() { }

  // MISSING: Connection status getter
  async getConnectionStatus() { }

  // MISSING: Admin panel selectors
  adminTab = page.locator('[data-view="admin"]');
  scannerTab = page.locator('[data-view="scanner"]');
  adminView = page.locator('#admin-view');
  connectionStatus = page.locator('#connectionStatus');
  errorMessage = page.locator('.error-message:visible');
}
```

---

## Scoring Verification Anti-Pattern

### Current Implementation (scanner-init.js:74-104)

```javascript
async function getTeamScore(page, teamId, sessionMode) {
  if (sessionMode === 'standalone') {
    return await page.evaluate((tid) => {
      const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
      return sessionData.teams?.[tid]?.score || 0;
    }, teamId);
  } else {
    // Networked: read from scoreboard DOM
    return await page.evaluate((tid) => {
      const scoreboardEntries = document.querySelectorAll('.scoreboard-entry');
      for (const entry of scoreboardEntries) {
        const teamElement = entry.querySelector('.scoreboard-team');
        if (teamElement?.textContent.includes(tid)) {
          const scoreElement = entry.querySelector('.scoreboard-score');
          return parseInt(scoreElement?.textContent.replace(/[^0-9]/g, '') || '0', 10);
        }
      }
      return 0;
    }, teamId);
  }
}
```

**Problem**:
- Networked mode reads from **scoreboard DOM** (client-side UI)
- Should read from **backend session** (authoritative source)
- Misses duplicate rejections (they don't update scoreboard immediately)

**Resolution**: Use WebSocket state or backend API query

---

## Required Fixes - Prioritized

### CRITICAL (Blocks All Tests)

#### Fix 1: Update GMScannerPage Import Paths
**Files**: All flow test files that use scanner-init
**Change**:
```javascript
// BEFORE
const { GMScannerPage } = require('../page-objects/GMScannerPage');

// AFTER
// Option A: Move file to helpers/page-objects/
// Option B: Update import in scanner-init.js
const { GMScannerPage } = require('../page-objects/GMScannerPage');
```
**Impact**: Fixes import errors, tests can run

#### Fix 2: Remove Window Global Usage
**File**: `duplicate-detection.spec.js`
**Changes**:
```javascript
// BEFORE (Line 247-248)
await page.evaluate(() => {
  if (window.connectionManager?.client?.socket) {
    window.connectionManager.client.socket.close();
  }
});

// AFTER
await scanner.disconnectWebSocket(); // New Page Object method
```

**File**: `scanner-init.js` line 307-308
```javascript
// BEFORE
await page.evaluate(() => {
  if (!window.UIManager.updateScoreboard) {
    window.UIManager.updateScoreboard = () => {};
  }
});

// AFTER
// Remove entirely - bug should be fixed in scanner, not worked around in tests
```

#### Fix 3: Deploy ES6 Scanner to Backend
**Options**:

**Option A: Update Submodule Reference** (Recommended for local dev)
```bash
cd backend/public/gm-scanner
git fetch origin
git checkout feature/es6-module-migration  # or merge to main first
cd ../../..
git add backend/public/gm-scanner
git commit -m "chore: update GM scanner submodule to ES6 architecture"
```

**Option B: Build and Deploy** (Production approach)
```bash
cd ALNScanner-es6-migration
npm run build
# Copy dist/ to backend/public/gm-scanner/
```

**Option C: Symlink Worktree** (Quick local testing)
```bash
cd backend/public
rm -rf gm-scanner
ln -s ../../ALNScanner-es6-migration gm-scanner
```

### HIGH (Functional but Wrong)

#### Fix 4: Add Missing Page Object Methods
**File**: `backend/tests/e2e/page-objects/GMScannerPage.js`
**Add**:
```javascript
/**
 * Manual connection to orchestrator (networked mode)
 */
async manualConnect(url, stationName, password) {
  // Wait for connection modal
  await this.page.waitForSelector('#connectionModal', { state: 'visible' });

  // Fill connection form
  await this.page.fill('#orchestratorUrl', url);
  await this.page.fill('#stationName', stationName);
  await this.page.fill('#password', password);

  // Click connect
  await this.page.click('button[data-action="connection.connect"]');
}

/**
 * Wait for WebSocket connection established
 */
async waitForConnection() {
  // Wait for connection status to show "Connected"
  await this.page.waitForFunction(() => {
    const status = document.querySelector('#connectionStatus');
    return status && status.textContent.toLowerCase().includes('connected');
  }, { timeout: 10000 });
}

/**
 * Disconnect WebSocket (for testing reconnection)
 */
async disconnectWebSocket() {
  // Trigger disconnection via settings or admin panel
  // This is DOM-based, not window.connectionManager
  await this.page.click('button[data-action="connection.disconnect"]');
  await this.page.waitForTimeout(1000); // Give time for disconnect
}

/**
 * Reconnect WebSocket
 */
async reconnectWebSocket() {
  await this.page.click('button[data-action="connection.reconnect"]');
  await this.waitForConnection();
}

/**
 * Get error message from toast/alert
 */
async getErrorMessage() {
  const errorElement = await this.page.locator('.error-message:visible').first();
  if (await errorElement.isVisible()) {
    return await errorElement.textContent();
  }
  return null;
}

/**
 * Get connection status text
 */
async getConnectionStatus() {
  return await this.page.locator('#connectionStatus').textContent();
}
```

#### Fix 5: Fix Score Verification for Networked Mode
**File**: `scanner-init.js`
**Change**:
```javascript
async function getTeamScore(page, teamId, sessionMode, socket) {
  if (sessionMode === 'standalone') {
    // Unchanged - localStorage read is correct
    return await page.evaluate((tid) => {
      const sessionData = JSON.parse(localStorage.getItem('standaloneSession') || '{}');
      return sessionData.teams?.[tid]?.score || 0;
    }, teamId);
  } else {
    // CHANGED: Read from WebSocket state, not DOM
    // Listen for sync:full event and extract team score
    return new Promise((resolve) => {
      socket.once('sync:full', (event) => {
        const session = event.data.session;
        const team = session.teams?.find(t => t.id === teamId);
        resolve(team?.score || 0);
      });

      // Request state sync
      socket.emit('gm:command', {
        event: 'gm:command',
        data: { action: 'session:get' }
      });
    });
  }
}
```

### MEDIUM (Quality of Life)

#### Fix 6: Consolidate Page Object Versions
**Action**: Choose single source of truth
**Recommendation**: Use worktree version as canonical, enhance with backend debugging features

#### Fix 7: Add E2E Test Documentation
**File**: `backend/tests/e2e/README.md`
**Content**: Document ES6 scanner requirements, Page Object usage, debugging tips

---

## Scanner Implementation Issues (Found During Investigation)

### Issue 1: Missing Disconnect/Reconnect Controls
**Location**: ALNScanner-es6-migration UI
**Problem**: No UI buttons for manual disconnect/reconnect
**Impact**: Tests can't trigger reconnection scenarios via DOM
**Resolution**: Add admin panel controls or test-mode buttons

### Issue 2: UIManager.updateScoreboard Undefined
**Location**: Standalone mode
**Problem**: Tests add workaround at line 307-308
**Root Cause**: Method not implemented in standalone DataManager
**Resolution**: Fix scanner implementation, remove test workaround

---

## Deployment Strategy

### Immediate (Unblock Tests)
1. Fix import paths (5 min)
2. Comment out window global usage temporarily (10 min)
3. Run tests against current deployed scanner (verify other issues)

### Short-term (This Session)
1. Deploy ES6 scanner to backend/public/gm-scanner (symlink approach) (15 min)
2. Add missing Page Object methods (30 min)
3. Fix window global usage with DOM methods (20 min)
4. Fix score verification for networked mode (20 min)
5. Run full test suite (10 min)

### Long-term (Before Merge)
1. Merge ES6 migration to ALNScanner main branch
2. Update backend submodule reference
3. Add disconnect/reconnect controls to scanner
4. Fix UIManager.updateScoreboard bug
5. Consolidate Page Object versions
6. Document E2E testing approach

---

## Test Execution Plan

### Phase 1: Import Fix Only
```bash
# Update scanner-init.js import path
# Comment out window global usage
npm run test:e2e -- duplicate-detection
# Expected: Import errors gone, new errors about missing methods
```

### Phase 2: Deploy ES6 Scanner
```bash
cd backend/public
ln -s ../../ALNScanner-es6-migration gm-scanner
cd ../..
npm run test:e2e -- duplicate-detection
# Expected: Window global errors, method missing errors
```

### Phase 3: Add Page Object Methods + Fix Window Globals
```bash
# Apply fixes from this document
npm run test:e2e -- duplicate-detection
# Expected: Tests run but may fail on assertions
```

### Phase 4: Fix Score Verification
```bash
# Apply score verification fix
npm run test:e2e -- duplicate-detection
npm run test:e2e -- 07b-gm-scanner-networked-blackmarket
# Expected: All tests pass
```

---

## Risk Assessment

### High Risk
- **Scanner deployment mismatch**: Tests run against wrong code version
- **Window global breakage**: All networked tests will fail

### Medium Risk
- **Page Object method gaps**: Tests can't execute full workflows
- **Score verification accuracy**: False positives/negatives possible

### Low Risk
- **Import path issues**: Easy to fix, clear error messages
- **Documentation gaps**: Doesn't block functionality

---

## Success Criteria

✅ **All E2E tests pass** with ES6 scanner deployed
✅ **No window global usage** in test code or scanner
✅ **Page Object methods complete** for all test scenarios
✅ **Score verification accurate** (reads from authoritative source)
✅ **Tests run reliably** without workarounds or polyfills

---

## Next Steps

1. **Review this analysis** with user
2. **Choose deployment strategy** (symlink vs submodule update)
3. **Execute fixes** in priority order (Critical → High → Medium)
4. **Run test suite** after each fix to validate
5. **Document learnings** in backend E2E README

---

## Files Requiring Changes

### Immediate Fixes
- [ ] `backend/tests/e2e/helpers/scanner-init.js` (import path)
- [ ] `backend/tests/e2e/flows/duplicate-detection.spec.js` (window globals)
- [ ] `backend/public/gm-scanner` (deployment)

### Page Object Enhancements
- [ ] `backend/tests/e2e/page-objects/GMScannerPage.js` (add methods)

### Scanner Implementation (Separate Task)
- [ ] `ALNScanner-es6-migration/src/ui/UIManager.js` (fix updateScoreboard)
- [ ] `ALNScanner-es6-migration/index.html` (add reconnect controls)

---

**Analysis Complete**: Ready for implementation planning
