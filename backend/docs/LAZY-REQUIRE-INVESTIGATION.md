# Lazy Require Pattern Investigation & Remediation Plan

**Date**: 2025-10-04
**Issue**: Integration tests failing due to module reset + lazy requires breaking singleton pattern
**Root Cause**: Architectural inconsistency between intended design and implementation

---

## Executive Summary

**Problem**: Integration tests revealed that `jest.config.js` has `resetModules: true`, which creates new singleton instances between tests. Combined with lazy `require()` calls inside handlers, this breaks the singleton pattern and causes service state loss.

**Core Issue**: **Architectural inconsistency** - we have an event-driven singleton architecture, but some handlers use lazy requires that bypass it.

**Impact**:
- ❌ Integration tests fail (tokens Map empty)
- ❌ Production risk (if Node.js ever clears module cache)
- ❌ Maintainability (hidden dependencies, unclear initialization)
- ❌ Performance (repeated require() overhead)

---

## Investigation Findings

### 1. Intended Architecture (Correct Pattern)

**app.js (lines 14-21)** - Entry point shows correct pattern:
```javascript
// Import services at TOP (singleton initialization)
const persistenceService = require('./services/persistenceService');
const sessionService = require('./services/sessionService');
const stateService = require('./services/stateService');
const transactionService = require('./services/transactionService');
const videoQueueService = require('./services/videoQueueService');
const vlcService = require('./services/vlcService');
const offlineQueueService = require('./services/offlineQueueService');
```

**WebSocket handlers (broadcasts.js, gmAuth.js, deviceTracking.js, videoEvents.js)** - All use top-level requires ✅

### 2. Broken Pattern (Lazy Requires)

**adminEvents.js** - 4 lazy requires inside functions:
```javascript
// Line 73 - inside handleGmCommand()
const transactionService = require('../services/transactionService');

// Line 130 - inside handleTransactionSubmit()
const offlineQueueService = require('../services/offlineQueueService');

// Line 171 - inside handleTransactionSubmit()  ← BREAKS INTEGRATION TESTS
const transactionService = require('../services/transactionService');

// Line 228 - inside handleSyncRequest()
const stateService = require('../services/stateService');
```

**scanRoutes.js** - 4 lazy requires inside route handlers:
```javascript
// Line 78 - inside POST /api/scan
const Token = require('../models/token');

// Line 91 - inside POST /api/scan
const videoQueueService = require('../services/videoQueueService');

// Line 172 - inside POST /api/scan/batch
const videoQueueService = require('../services/videoQueueService');

// Line 192 - inside POST /api/scan/batch
const Token = require('../models/token');
```

**stateRoutes.js** - 1 lazy require:
```javascript
// Line 83 - inside GET /api/state
const vlcService = require('../services/vlcService');
```

### 3. Why Lazy Requires Fail with resetModules

**Production (works by accident)**:
1. First request loads module → singleton created ✅
2. Module cache keeps singleton ✅
3. Subsequent requires return same instance ✅

**Tests with `resetModules: true` (broken)**:
1. Test initializes service: `transactionService.init(tokens)` → tokens Map populated
2. Jest clears module cache (between/during tests)
3. Handler does lazy require: gets **NEW instance** with empty tokens Map ❌
4. Transaction fails: "invalid token"

**The Pattern Violates**:
- ✅ Singleton pattern (multiple instances created)
- ✅ Event-driven architecture (listeners expect stable emitter)
- ✅ Dependency injection (dependencies hidden in functions)
- ✅ Node.js best practices (requires should be at top)

---

## Architectural Analysis

### Why Lazy Requires Might Exist (Hypotheses)

**Hypothesis 1: Circular Dependency Avoidance**
- ❌ **Rejected**: No circular dependency comments found
- ❌ **Rejected**: app.js loads all services at top without issues

**Hypothesis 2: Conditional Initialization**
- ⚠️ **Partial**: vlcService can run in degraded mode
- ❌ **But**: vlcService is still initialized as singleton in app.js
- ❌ **But**: Lazy require doesn't help - service already loaded

**Hypothesis 3: Performance Optimization**
- ❌ **Rejected**: Requires are cached anyway after first load
- ❌ **Rejected**: Lazy requires in hot paths hurt performance

**Hypothesis 4: Historical Code Evolution**
- ✅ **Likely**: Some files follow pattern, some don't
- ✅ **Likely**: Copy-paste from different sources
- ✅ **Likely**: No enforced architecture guidelines

### Consistency Analysis

| File | Pattern | Services Required | Consistent? |
|------|---------|------------------|-------------|
| app.js | Top-level | All 7 services | ✅ |
| broadcasts.js | Top-level | listenerRegistry | ✅ |
| gmAuth.js | Top-level | 6 services | ✅ |
| deviceTracking.js | Top-level | 4 services | ✅ |
| videoEvents.js | Top-level | 3 services | ✅ |
| **adminEvents.js** | **Mixed** | **4 lazy, 3 top** | ❌ |
| sessionRoutes.js | Top-level | sessionService | ✅ |
| **scanRoutes.js** | **Mixed** | **4 lazy, 3 top** | ❌ |
| **stateRoutes.js** | **Mixed** | **1 lazy, 3 top** | ❌ |

**Conclusion**: **3 of 9 files** violate the architecture pattern (33% inconsistency)

---

## Impact Assessment

### Current Impact

**Integration Tests**:
- ❌ 5/6 transaction flow tests failing
- ❌ Tokens not found despite being loaded
- ❌ Reveals critical architectural flaw

**Production Risk (Current)**:
- ⚠️ **Low but non-zero**: Node.js doesn't usually clear cache
- ⚠️ **Module reload edge cases**: Some bundlers/watchers can trigger
- ⚠️ **Future risk**: Architecture refactors could expose this

**Maintainability**:
- ❌ Hidden dependencies (can't see imports at file top)
- ❌ Unclear initialization order
- ❌ Mixed patterns confuse developers
- ❌ Harder to trace event flow

**Performance**:
- ⚠️ Repeated require() calls in hot paths (POST /api/scan)
- ⚠️ Each transaction does 2 lazy requires (lines 91, 171)
- ✅ Node.js caching mitigates (but still overhead)

### Future Impact (Without Fix)

**Event-Driven Architecture**:
- ❌ Can't rely on stable service instances
- ❌ Event listeners might attach to wrong instance
- ❌ Hard to reason about event flow

**REST Principles**:
- ❌ Handlers have hidden state dependencies
- ❌ Not truly stateless (depends on module cache)

**Scalability**:
- ❌ Worker threads / clustering might expose bugs
- ❌ Hot reload patterns will break
- ❌ Microservice extraction harder

---

## Remediation Plan

### Phase 1: Fix jest.config.js (Immediate)

**Change**:
```javascript
// jest.config.js
module.exports = {
  // ...
  resetModules: false,  // ← Change from true
  // Services use explicit reset()/init() for isolation
};
```

**Why This Alone Isn't Enough**:
- ✅ Fixes integration tests immediately
- ❌ Doesn't fix architectural inconsistency
- ❌ Leaves lazy requires in production code
- ❌ Future developers might re-enable resetModules

### Phase 2: Move All Requires to Top (Recommended)

**Files to Fix**:

**adminEvents.js**:
```javascript
// TOP OF FILE (add these)
const transactionService = require('../services/transactionService');
const offlineQueueService = require('../services/offlineQueueService');
const stateService = require('../services/stateService');

// REMOVE from inside functions (lines 73, 130, 171, 228)
```

**scanRoutes.js**:
```javascript
// TOP OF FILE (add these)
const Token = require('../models/token');
const videoQueueService = require('../services/videoQueueService');

// REMOVE from inside route handlers (lines 78, 91, 172, 192)
```

**stateRoutes.js**:
```javascript
// TOP OF FILE (add this)
const vlcService = require('../services/vlcService');

// REMOVE from inside route handler (line 83)
```

**Benefits**:
- ✅ Matches app.js pattern (architectural consistency)
- ✅ Matches other WebSocket handlers (code consistency)
- ✅ Dependencies visible at file top (maintainability)
- ✅ Follows Node.js best practices
- ✅ Better performance (no repeated requires)
- ✅ Singleton pattern preserved

### Phase 3: Enforce Pattern (Long-term)

**Add ESLint Rule**:
```javascript
// .eslintrc.js
rules: {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'CallExpression[callee.name="require"]:not(:has(VariableDeclarator))',
      message: 'require() must be at top-level, not inside functions'
    }
  ]
}
```

**Documentation**:
- Update CLAUDE.md with require() policy
- Add architecture decision record (ADR)
- Document in onboarding guide

---

## Additional Considerations

### Do We Need resetModules at All?

**Arguments FOR removal**:
- ✅ Services have explicit `reset()` and `init()` methods
- ✅ Tests use `beforeEach`/`afterEach` cleanup
- ✅ Breaks singleton pattern intentionally
- ✅ jest.setup.js already documents "clearing module cache breaks singletons"

**Arguments AGAINST removal**:
- ⚠️ Some tests might rely on it (need verification)
- ⚠️ Ensures absolute test isolation (but at what cost?)

**Recommendation**: **Remove it** - our architecture doesn't need it, and it contradicts our singleton pattern.

### Test Pattern Validation

**Current integration test pattern** (CORRECT):
```javascript
beforeEach(async () => {
  await sessionService.reset();
  await transactionService.reset();

  // Re-initialize after reset (explicit state management)
  const tokens = tokenService.loadTokens();
  await transactionService.init(tokens);
});
```

This pattern works **without** `resetModules: true` and is more explicit.

---

## Implementation Steps

### Step 1: Validate Current Tests Pass (Baseline)
```bash
npm test -- --testPathIgnorePatterns=integration
```
**Expected**: 271/271 pass (excluding broken integration tests)

### Step 2: Remove resetModules
```javascript
// jest.config.js line 20
resetModules: false,  // Services use explicit reset()/init()
```

### Step 3: Move Requires to Top

**adminEvents.js**:
- Move lines 73, 130, 171, 228 to top of file (lines 6-10)
- Update imports to include transactionService, offlineQueueService, stateService

**scanRoutes.js**:
- Move lines 78, 91, 172, 192 to top of file (lines 6-15)
- Update imports to include Token, videoQueueService

**stateRoutes.js**:
- Move line 83 to top of file (lines 6-15)
- Update imports to include vlcService

### Step 4: Run All Tests
```bash
npm test
```
**Expected**: 277/277 pass (271 existing + 6 integration tests)

### Step 5: Verify No Regressions
- Run in dev mode: `npm run dev:full`
- Test actual scanner → transaction → broadcast flow
- Check logs for unexpected service re-initialization

### Step 6: Document Decision
- Update PHASE-5.4-SESSION-DISCOVERIES.md
- Add note to CLAUDE.md about require() policy
- Commit with detailed message explaining architectural fix

---

## Risk Assessment

### Risks of Making Changes

**Low Risk**:
- ✅ Moving requires to top is mechanical (low chance of error)
- ✅ Behavior identical (Node.js caches modules anyway)
- ✅ All tests validate correctness

**Medium Risk**:
- ⚠️ Some edge case might rely on lazy loading
- ⚠️ Module initialization order could matter (unlikely)

**Mitigation**:
- Run full test suite after each change
- Test manually in dev environment
- Can revert easily if issues found

### Risks of NOT Making Changes

**High Risk**:
- ❌ Integration tests remain broken
- ❌ Architectural inconsistency persists
- ❌ Future refactors harder
- ❌ Team confusion about patterns

---

## Decision Required

**Proposed Implementation Order**:

1. ✅ **Immediate**: Remove `resetModules: true` from jest.config.js
2. ✅ **Same commit**: Move all lazy requires to top of files
3. ✅ **Validation**: Run full test suite
4. ✅ **Documentation**: Update session discoveries + CLAUDE.md

**Alternative (Minimal Fix)**:
1. ✅ **Only**: Remove `resetModules: true`
2. ❌ **Leave**: Lazy requires (technical debt)

**Recommendation**: **Full fix** - lazy requires are architectural debt that will cause issues later.

---

## Approval Needed

- [ ] Approve removing `resetModules: true`
- [ ] Approve moving all lazy requires to top-level
- [ ] Approve enforcing pattern via ESLint (future)

**Ready to implement upon approval.**
