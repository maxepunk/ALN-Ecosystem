# Test Analysis by Implementation Phase

## Contract Tests Mapping

Based on test file analysis and tasks.md phases:

### Core Backend Tests (Should Already Work)
- **scan_post.test.js** - POST /api/scan endpoint (core functionality, should work NOW)
- **session_get.test.js** - GET /api/session endpoint (core functionality)
- **session_post.test.js** - POST /api/session endpoint (core functionality)
- **session_put.test.js** - PUT /api/session endpoint (core functionality)
- **state_get.test.js** - GET /api/state endpoint (core functionality)
- **video_control.test.js** - Video control endpoints (core VLC integration)

### Phase 4 Tests (GM Scanner Integration)
- **ws_device_events.test.js** - WebSocket device events (Phase 4: T022-T030)
- **ws_gm_identify.test.js** - WebSocket GM identification (Phase 4: T022)
- **ws_state_update.test.js** - WebSocket state updates (Phase 4: T027)
- **ws_connection.test.js** - WebSocket connection handling (Phase 4: T022)

### Phase 5 Tests (Admin Interface)
- **admin_auth.test.js** - Admin authentication (Phase 5: T031-T035)

## Expected Pass Rates by Phase

### Phase 0: Backend Stabilization
- Core backend tests (6 tests) should pass 100%
- WebSocket tests will fail (expected - not implemented yet)
- Admin tests will fail (expected - not implemented yet)
- **Target: 6/11 contract tests passing (55%)**

### After Phase 4: GM Scanner Integration
- Core backend tests: 100%
- WebSocket tests: 100%
- Admin tests will still fail
- **Target: 10/11 contract tests passing (91%)**

### After Phase 5: Admin Interface
- All tests should pass
- **Target: 11/11 contract tests passing (100%)**

## Verification Gates Needed

### Phase 0 Gate: Backend Core Functionality
```bash
npx jest tests/contract/scan_post.test.js --forceExit
npx jest tests/contract/session*.test.js --forceExit
npx jest tests/contract/state_get.test.js --forceExit
npx jest tests/contract/video_control.test.js --forceExit
```
All must pass 100%

### Phase 1 Gate: Submodule Integration
```bash
# Verify token loading from submodule
node -e "const tokens = require('./src/services/tokenService').loadTokens(); console.log(tokens.length > 0)"
# Verify submodule structure
test -f ALN-TokenData/tokens.json && echo "PASS"
```

### Phase 2 Gate: Backend Enhancements
```bash
# Test discovery service
curl http://localhost:3000/api/status | grep "networkInterfaces"
# Test token endpoint
curl http://localhost:3000/api/tokens | grep "id"
```

### Phase 3 Gate: Player Scanner Integration
```bash
# Test scan endpoint with offline queue
curl -X POST http://localhost:3000/api/scan -d '{"tokenId":"TEST","teamId":"A"}'
# Verify player scanner can connect from different device
```

### Phase 4 Gate: GM Scanner WebSocket
```bash
npx jest tests/contract/ws*.test.js --forceExit
# All WebSocket tests must pass 100%
```

### Phase 5 Gate: Admin Interface
```bash
npx jest tests/contract/admin_auth.test.js --forceExit
# Admin auth test must pass 100%
# Verify admin UI loads
curl http://localhost:3000/admin/ | grep "Orchestrator Control Panel"
```

### Phase 6 Gate: Full Integration
```bash
npm test # All tests pass
# Run quickstart.md scenarios
# No failing tests allowed
```