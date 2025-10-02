# Backend Adjustments Required

## Test Analysis Summary
Based on test results (80% failure rate), the backend needs critical fixes before integration can proceed.

## Priority 1: Core Functionality Fixes (Must fix before ANY integration)

### 1.1 Package.json Updates
- Current: Node.js 18.x with CommonJS
- Required: Node.js 22.x (already installed)
- Action: Update engine requirement only (skip ES6 migration for now)

### 1.2 Token Service Implementation
- Issue: Hardcoded tokens in app.js lines 144-193
- Fix: Create tokenService.js to load from filesystem
- Fallback: Use hardcoded tokens ONLY if no file found

### 1.3 Missing Routes
Test failures show these routes don't exist:
- `/api/admin/auth` - Admin authentication endpoint
- `/api/state` - Returns wrong format (missing `state` wrapper)
- `/socket.io` - WebSocket not initialized

### 1.4 WebSocket Initialization
- Socket.io is installed but NOT initialized in server.js
- This causes all WebSocket tests to fail (100% failure)

### 1.5 Response Format Issues
Tests expect:
```json
{
  "state": {
    "scores": [...],
    "recentTransactions": [...],
    ...
  }
}
```
Backend returns unwrapped state object.

## Priority 2: Test Infrastructure (Fix to enable development)

### 2.1 Jest Open Handles
- All tests hang due to unclosed connections
- Need proper cleanup in afterAll() hooks
- Server instances not being closed

### 2.2 Test Data Issues
- Tests create tokens like "MEM_LOAD_0" that don't exist
- Need test fixtures that match actual token structure

## Priority 3: Deferred to Integration Phase

These from tasks.md can wait:
- ES6 module conversion (big refactor, not critical)
- Git submodules (independent task)
- Network discovery service (new feature)
- Scanner integration (depends on working backend)
- Admin UI (depends on working API)

## Immediate Action Plan

### Step 1: Fix Package.json (2 min)
```json
{
  "engines": {
    "node": ">=20.0.0"  // Update from >=18.0.0
  }
}
```

### Step 2: Create Token Service (10 min)
Create `backend/src/services/tokenService.js`:
- Load tokens from ../../../ALN-TokenData/tokens.json (if exists)
- Fallback to hardcoded tokens for testing
- Export loadTokens() function

### Step 3: Add Missing Routes (20 min)
1. Create `backend/src/routes/adminRoutes.js`:
   - POST /api/admin/auth endpoint
   - Return JWT token on success

2. Fix `backend/src/routes/stateRoutes.js`:
   - Wrap response in { state: {...} }
   - Add cache headers

### Step 4: Initialize WebSocket (15 min)
Update `backend/src/server.js`:
- Import and attach Socket.io
- Configure WebSocket handlers
- Ensure proper cleanup on shutdown

### Step 5: Fix Test Cleanup (10 min)
Update test files:
- Add proper afterAll() hooks
- Close server instances
- Clear timeouts/intervals

## Success Criteria
After these fixes:
- Contract tests should have >70% pass rate
- Tests should complete without hanging
- Backend ready for integration tasks

## Skip For Now (from tasks.md)
- T005: ES6 module conversion (high risk, low immediate value)
- T001-T003: Git submodules (can do parallel to backend fixes)
- T006: Discovery service (new feature, not fixing existing)
- T013-T030: Scanner integration (needs working backend first)

## Next Steps After Fixes
1. Verify contract tests pass
2. Then proceed with submodule configuration
3. Then implement scanner integration
4. Finally add new features (discovery, admin UI)

This approach fixes what's broken BEFORE adding new features.