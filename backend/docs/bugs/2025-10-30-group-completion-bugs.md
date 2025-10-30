# Group Completion Test Failures - 2025-10-30

## Summary
All 3 tests in group-completion.test.js fail with timeout errors after updating expected token values from production (15000) to test fixture (40).

## Test File
`backend/tests/integration/group-completion.test.js`

## Failures

### Test 1: "should detect group completion and award bonus"
**Expected:** Group completion after scanning 2 tokens, bonus points awarded
**Actual:** Timeout waiting for `group:completed` and `score:updated` events

### Test 2: "should not award bonus for incomplete group"
**Expected:** Score of 40 points (test fixture value for rat001)
**Actual:** Timeout waiting for `score:updated` event

### Test 3: "should complete group regardless of scan order"
**Expected:** Group completion with reversed scan order
**Actual:** Timeout waiting for `group:completed` and `score:updated` events

## Root Cause
Scanner is in **detective mode** when it should be in **blackmarket mode**.

### Evidence from Logs
```
{"level":"info","message":"Detective mode transaction - skipping scoring"...
{"level":"info","message":"Scan accepted","metadata":{"metadata":{"points":0,...
```

Scanner console output:
```
[app.js] Transaction points set to 0 (detective mode or unknown token)
Backend scores cleared - falling back to local calculation
```

### Code Location
Line 95 in group-completion.test.js:
```javascript
gmScanner = await createAuthenticatedScanner(testContext.url, 'GM_GROUP_TEST', 'blackmarket');
```

The scanner is created with mode='blackmarket', but the backend is treating it as detective mode.

## Investigation Needed

### Possible Causes
1. **Mode not propagating in authentication handshake**: Check if `handshake.auth.mode` is being sent and read correctly
2. **Scanner mock not setting mode**: Global Scanner.Settings.mode may not be initialized
3. **Mode field mismatch**: Backend expecting different field name (stationMode vs mode)
4. **Transaction submission missing mode**: Transaction payload may not include mode field

### Files to Check
- `backend/tests/helpers/websocket-helpers.js:createAuthenticatedScanner()` - Does it set mode in handshake?
- `backend/src/websocket/gmAuth.js` - Does it read mode from handshake?
- `backend/tests/helpers/browser-mocks.js` - Is Scanner.Settings.mode initialized?
- `backend/src/websocket/transactionHandler.js` - How does it determine mode?
- `ALNScanner/js/app/app.js` - How does processNFCRead() include mode?

### Next Steps
1. Add debug logging to see what mode value is being received by backend
2. Verify handshake.auth includes mode field
3. Check if Scanner.Settings.mode is set in test setup
4. Verify transaction payload includes correct mode field
5. Review October 2025 mode standardization changes (see CLAUDE.md lines 34-37)

## Impact
**BLOCKER**: All group completion integration tests are failing. This affects Task 2.4 of the test baseline fix plan.

## Related
- Task 2.4: docs/plans/2025-10-30-fix-test-failures-comprehensive.md (lines 734-803)
- Mode standardization: CLAUDE.md (lines 34-37)
- AsyncAPI contract: backend/contracts/asyncapi.yaml (handshake authentication)
