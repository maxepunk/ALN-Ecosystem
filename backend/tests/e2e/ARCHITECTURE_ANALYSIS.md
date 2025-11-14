# E2E Test Architecture Analysis - Token Loading Issue

**Date**: 2025-11-13
**Status**: CRITICAL BLOCKER for PR merge
**Impact**: All transaction E2E tests failing

---

## Executive Summary

The E2E test architecture has a **fundamental design flaw**: tests hardcode expectations for specific production token IDs, but there's no mechanism ensuring those tokens exist in the database. The `test-tokens.json` fixture file is **abandoned infrastructure** - neither the scanner nor backend load from it.

**Root Cause**: Tests were written assuming a fixture-based architecture that was never fully implemented.

---

## Current Architecture (BROKEN)

### Token Data Flow

```
Production Tokens (ALN-TokenData/tokens.json)
├── Backend: tokenService.js loads from ../../../ALN-TokenData/tokens.json
├── GM Scanner: loads from data/tokens.json (git submodule → ALN-TokenData)
└── Player Scanner: loads from data/tokens.json (git submodule → ALN-TokenData)

Test Fixtures (backend/tests/e2e/fixtures/test-tokens.json)
└── NOT LOADED BY ANYTHING (orphaned file)
```

### The Problem

**File**: `backend/tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js`

Lines 391, 396, 432, 437 hardcode token IDs:
```javascript
await scanner.manualScan('sof002');  // Line 391
expect(tx1Event.data.transaction.tokenId).toBe('sof002');  // Line 396
await scanner.manualScan('rat002');  // Line 432
expect(tx3Event.data.transaction.tokenId).toBe('rat002');  // Line 437
```

**These token IDs are from production data** (`ALN-TokenData/tokens.json`), NOT from `test-tokens.json`.

### Test Execution Flow

1. E2E test starts orchestrator
2. Orchestrator loads `ALN-TokenData/tokens.json` (production tokens)
3. Test starts browser with GM Scanner
4. Scanner loads `data/tokens.json` (production tokens via git submodule)
5. Test hardcodes `await scanner.manualScan('sof002')`
6. **IF `sof002` exists in production data** → Test might pass
7. **IF `sof002` removed/renamed in production data** → Test fails with token not found

**Current state**: Tests are failing because someone scanned a different token (`mab002` expected, `sof002` received)

---

## Why This Is An Anti-Pattern

### 1. Tests Depend on Production Data

**Problem**: Production token data changes (tokens added/removed/renamed). Tests break.

**Example**: If ALN-TokenData maintainer renames `sof002` to `sophia_002`, all E2E tests fail.

### 2. Fixture Files Are Misleading

**File**: `backend/tests/e2e/fixtures/README.md`

Lines 1-7 claim:
> "This directory contains minimal test data optimized for fast E2E test execution... Rather than using the production ALN-TokenData (100+ tokens, large videos), these fixtures provide: fast test execution, predictable test data..."

**Reality**: This is FALSE. The scanner and backend BOTH load production tokens. The fixture file is unused.

### 3. Hardcoded Expectations Break Flexibility

Tests assert:
```javascript
expect(tx.tokenId).toBe('sof002');  // WRONG: testing specific data
```

Should assert:
```javascript
expect(tx.tokenId).toBe(selectedToken.id);  // CORRECT: testing behavior
expect(tx.status).toBe('accepted');
expect(tx.score).toBe(expectedScore);
```

---

## Correct Architecture

### Principle: E2E Tests Use Production Data, Assert on Behavior

**E2E tests should:**
1. Query `/api/tokens` to discover available tokens
2. Dynamically select tokens matching test criteria
3. Assert on BEHAVIOR (duplicate detection works, scoring is correct), NOT specific token IDs

### Token Selection Helper

**New file**: `backend/tests/e2e/helpers/token-selection.js`

```javascript
/**
 * Query backend for available tokens and select suitable ones for testing
 */
async function selectTestTokens(criteria) {
  // GET /api/tokens to fetch production token database
  const response = await fetch('https://localhost:3000/api/tokens');
  const tokens = await response.json();

  return {
    // Find a 2-star Personal token for basic scan test
    personalToken: Object.values(tokens).find(t =>
      t.SF_ValueRating === 2 && t.SF_MemoryType === 'Personal'
    ),

    // Find a 3-star Business token for type multiplier test
    businessToken: Object.values(tokens).find(t =>
      t.SF_ValueRating === 3 && t.SF_MemoryType === 'Business'
    ),

    // Find 2 tokens in the same group for completion bonus test
    groupTokens: findGroupTokens(tokens, 2),

    // Find 5 unique tokens for duplicate detection test
    uniqueTokens: Object.values(tokens).slice(0, 5)
  };
}

function findGroupTokens(tokens, count) {
  const grouped = {};

  // Group tokens by SF_Group field
  Object.values(tokens).forEach(token => {
    if (token.SF_Group) {
      const groupName = token.SF_Group.replace(/\s*\(x\d+\)/i, '').trim();
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(token);
    }
  });

  // Find a group with at least 'count' tokens
  for (const [groupName, groupTokens] of Object.entries(grouped)) {
    if (groupTokens.length >= count) {
      return groupTokens.slice(0, count);
    }
  }

  return [];  // No suitable group found
}
```

### Rewritten Test Example

**Before** (WRONG):
```javascript
test('backend rejects duplicate scan by same team', async () => {
  await scanner.manualScan('sof002');  // HARDCODED
  expect(tx.tokenId).toBe('sof002');  // BRITTLE
  expect(scoreAfterFirst).toBe(500);  // HARDCODED SCORE
});
```

**After** (CORRECT):
```javascript
test('backend rejects duplicate scan by same team', async () => {
  // Dynamically select suitable token
  const { personalToken } = await selectTestTokens();

  // Calculate expected score based on token properties
  const expectedScore = calculateScore(personalToken);

  await scanner.manualScan(personalToken.SF_RFID);
  expect(tx.tokenId).toBe(personalToken.SF_RFID);  // FLEXIBLE
  expect(tx.status).toBe('accepted');  // BEHAVIOR
  expect(scoreAfterFirst).toBe(expectedScore);  // CALCULATED

  // Duplicate scan
  await scanner.manualScan(personalToken.SF_RFID);  // Same token
  expect(scoreAfterDuplicate).toBe(expectedScore);  // Should not increase
});
```

---

## Migration Plan

### Phase 1: Create Token Selection Infrastructure (2 hours)

**Task 1.1**: Create `token-selection.js` helper
- Query `/api/tokens`
- Implement `selectTestTokens()` with criteria
- Implement `findGroupTokens()` for bonus testing
- Add `calculateScore()` helper (mirrors backend scoring logic)

**Task 1.2**: Add validation
- Throw descriptive error if no suitable tokens found
- Log selected tokens for debugging
- Document token requirements in test output

### Phase 2: Rewrite Transaction Tests (3 hours)

**Files to update**:
1. `tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js`
   - Replace all hardcoded `'sof002'`, `'rat002'`, `'mab002'` with dynamic selection
   - Replace all hardcoded score expectations with `calculateScore()`
   - Update 12 tests

2. `tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js`
   - Same pattern

3. `tests/e2e/flows/07a-gm-scanner-standalone-blackmarket.test.js`
   - Same pattern

### Phase 3: Update Documentation (1 hour)

**Task 3.1**: Update `backend/tests/e2e/README.md`
- Remove "lightweight fixtures" claims
- Document dynamic token selection pattern
- Add troubleshooting for "no suitable tokens found"

**Task 3.2**: Update `backend/tests/e2e/fixtures/README.md`
- Add deprecation notice for `test-tokens.json`
- Explain it's only for media fixtures now (videos, images, audio)
- Remove misleading claims about token data

**Task 3.3**: Consider deleting `test-tokens.json`
- OR add clear comment: `// DEPRECATED: Not loaded by E2E tests. Use production tokens via /api/tokens`

### Phase 4: Verification (30 min)

**Task 4.1**: Run full E2E suite
```bash
npm run test:e2e
```

**Task 4.2**: Test with modified token data
- Rename a token in `ALN-TokenData/tokens.json`
- Verify tests still pass (using different token)

**Task 4.3**: Document token requirements
- Add comment in each test describing what tokens it needs
- Example: `// Requires: 1x Personal token (any rating), 2x tokens in same group`

---

## Success Criteria

✅ **Tests pass regardless of specific token IDs in production data**
✅ **Tests fail if production data lacks required token types** (e.g., no Personal tokens)
✅ **Test output shows which tokens were selected** (debugging visibility)
✅ **Documentation accurately describes architecture** (no misleading fixture claims)
✅ **Future token data changes don't break tests** (unless they remove entire token types)

---

## Estimated Time: 6.5 hours

**Priority**: CRITICAL - blocks PR #4 merge

**Risk**: LOW - changes are isolated to test code, no production impact

---

## Alternative: Fixture Injection (NOT RECOMMENDED)

We COULD implement fixture loading by:
1. Adding env var `TEST_TOKEN_PATH` to backend
2. Making `tokenService.js` load from that path in test mode
3. Making scanner load from injected path

**Why NOT do this:**
- ❌ Adds complexity to production code for test purposes
- ❌ Tests would no longer validate production token loading paths
- ❌ Requires maintaining separate fixture data
- ❌ Violates "test production behavior" principle

**E2E tests exist to validate the REAL system.** Use REAL data.

---

## Related Issues

- **Merge Plan Phase 2.5**: Admin password externalization (DONE)
- **Merge Plan Phase 3**: Regression tests (PENDING - blocked by this)
- **ALNScanner/CLAUDE.md Line 15**: Claims E2E uses "lightweight fixtures" (INCORRECT)

---

**Next Steps**: Implement Phase 1 token selection infrastructure, then rewrite tests in Phase 2.
