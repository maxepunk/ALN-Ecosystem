# Test Data Value Mapping - Integration Test Fixtures

**Date:** 2025-10-30
**Purpose:** Document all test assertions that expect production-scale values but use test fixture data
**Related:** Task 2.1 from `2025-10-30-fix-test-failures-comprehensive.md`

## Executive Summary

**Root Cause:** Integration tests expect production-scale point values (e.g., 15000 for rat001) but test fixtures use small test values (e.g., 40 for rat001). This causes 26+ test assertion failures.

**Impact:**
- 26 failing test assertions across 9 test files
- All failures are value mismatches between expected (production) and actual (test fixture)
- 7 unique token IDs affected

**Solution:** Update test assertions to use test fixture values OR recalculate test fixture values to match production scale.

## Token Value Mapping (Test Fixture → Expected in Tests)

### Current Test Fixture Values (test-tokens.js)

```javascript
// Calculated as: rating * 10 (simplified for testing)
rat001: value=40, type=Business, rating=4
asm001: value=30, type=Personal, rating=3
534e2b03: value=30, type=Technical, rating=3
jaw001: value=50, type=Personal, rating=5
tac001: value=10, type=Business, rating=1
fli001: value=10, type=Personal, rating=1
hos001: value=30, type=Business, rating=3
534e2b02: value=30, type=Technical, rating=3
test_srv001: value=20, type=Technical, rating=2
test_srv002: value=30, type=Technical, rating=3
```

### Production-Scale Values (Expected in Tests)

Production calculation: `typeMultiplier * rating * 1000`
- Personal: 1x multiplier
- Business: 3x multiplier
- Technical: 5x multiplier

```javascript
// If using production calculation:
rat001: 3 * 4 * 1000 = 12000 (Business, rating 4)
asm001: 1 * 3 * 1000 = 3000  (Personal, rating 3)
534e2b03: 5 * 3 * 1000 = 15000 (Technical, rating 3)
jaw001: 1 * 5 * 1000 = 5000  (Personal, rating 5)
tac001: 3 * 1 * 1000 = 3000  (Business, rating 1)
fli001: 1 * 2 * 1000 = 2000  (Personal, rating 2) // NOTE: rating changed in production
hos001: 3 * 4 * 1000 = 12000 (Business, rating 4) // NOTE: production has different rating
```

### Value Mismatch Summary

| Token ID | Test Fixture Value | Expected in Tests | Difference | Type | Rating |
|----------|-------------------|-------------------|------------|------|--------|
| 534e2b03 | 30 | 5000 | -4970 | Technical | 3 |
| rat001 | 40 | 15000 | -14960 | Business | 4 |
| asm001 | 30 | 1000 | -970 | Personal | 3 |
| tac001 | 10 | 100 | -90 | Business | 1 |
| jaw001 | 50 | (varies) | N/A | Personal | 5 |
| fli001 | 10 | (not tested) | N/A | Personal | 1 |
| hos001 | 30 | (not tested) | N/A | Business | 3 |

**CRITICAL FINDING:** Tests expect production values (1000s scale) but fixtures use test values (10s scale). The expected values in comments are also INCORRECT - they don't match production calculation.

### Discrepancy Analysis

The comments in tests say:
- `rat001 = 15000` (comment) but production formula gives 12000
- `534e2b03: Technical rating 3 = 5000` (comment) but production formula gives 15000
- `asm001 only = 1000` (comment) but production formula gives 3000

**ISSUE:** The test comments themselves are incorrect! They don't match the actual production value calculation formula.

## Files Requiring Updates

### 1. tests/integration/duplicate-detection.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 101: expect(result1.data.points).toBe(5000); // Technical rating 3 = 5000
Line 134: expect(team001Score.currentScore).toBe(5000);
Line 195: expect(result1.data.points).toBe(5000);
Line 224: expect(team001Score.currentScore).toBe(5000);
Line 268: expect(accepted.data.points).toBe(15000); // Business rating 4
Line 299: expect(blackmarketResult.data.points).toBe(5000);
Line 470: expect(result2.data.points).toBe(5000);
```

**Tokens Used:**
- `534e2b03` (7 occurrences) - expects 5000, fixture has 30
- `rat001` (2 occurrences) - expects 15000, fixture has 40
- `tac001` (4 occurrences) - expects 100, fixture has 10

**Required Changes:**
- Line 101: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 134: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 195: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 224: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 268: `toBe(15000)` → `toBe(40)` (rat001)
- Line 299: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 470: `toBe(5000)` → `toBe(30)` (534e2b03)

**Impact:** 7 assertions

---

### 2. tests/integration/admin-interventions.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 95:  expect(teamScore.currentScore).toBe(15000); // rat001 = 15000
Line 137: expect(scoreEvent.data.currentScore).toBe(14500); // 15000 - 500
Line 149: expect(teamScore.currentScore).toBe(14500);
Line 190: expect(scoreEvent.data.currentScore).toBe(3000); // 1000 + 2000
Line 194: expect(teamScore.currentScore).toBe(3000);
Line 351: expect(result.data.points).toBe(15000);
Line 365: expect(scoreBefore.currentScore).toBe(15000);
```

**Tokens Used:**
- `rat001` (7 occurrences) - expects 15000, fixture has 40
- `asm001` (2 occurrences) - expects 1000, fixture has 30

**Required Changes:**
- Line 95: `toBe(15000)` → `toBe(40)` (rat001 base)
- Line 137: `toBe(14500)` → `toBe(-460)` (40 - 500) **OR** adjust penalty to -10
- Line 149: `toBe(14500)` → `toBe(-460)` (40 - 500) **OR** adjust penalty to -10
- Line 190: `toBe(3000)` → `toBe(70)` (40 + 30 for rat001+asm001)
- Line 194: `toBe(3000)` → `toBe(70)` (40 + 30)
- Line 351: `toBe(15000)` → `toBe(40)` (rat001)
- Line 365: `toBe(15000)` → `toBe(40)` (rat001)

**Special Case:** Lines 137, 149 have a -500 penalty which would make score NEGATIVE with test fixtures. Need to either:
- Adjust penalty to match scale (e.g., -10 instead of -500)
- Accept negative scores in test
- Increase fixture value

**Impact:** 7 assertions + 1 penalty calculation

---

### 3. tests/integration/multi-gm-coordination.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 120: expect(team001Score.currentScore).toBe(5000);
Line 150: expect(result1.data.points).toBe(5000);
Line 176: expect(team001Score.currentScore).toBe(5000);
Line 230: expect(team001Score.currentScore).toBe(15000); // rat001 only
Line 231: expect(team002Score.currentScore).toBe(1000); // asm001 only
Line 335: expect(team001Score.currentScore).toBe(15000); // Only rat001 (blackmarket scan)
```

**Tokens Used:**
- `534e2b03` (4 occurrences) - expects 5000, fixture has 30
- `rat001` (2 occurrences) - expects 15000, fixture has 40
- `asm001` (2 occurrences) - expects 1000, fixture has 30
- `tac001` (2 occurrences) - expects 100, fixture has 10

**Required Changes:**
- Line 120: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 150: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 176: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 230: `toBe(15000)` → `toBe(40)` (rat001)
- Line 231: `toBe(1000)` → `toBe(30)` (asm001)
- Line 335: `toBe(15000)` → `toBe(40)` (rat001)

**Impact:** 6 assertions

---

### 4. tests/integration/transaction-flow.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 107: expect(resultEvent.data.points).toBe(5000);  // CRITICAL: 5000, not 3000!
Line 121: expect(newEvent.data.transaction.points).toBe(5000);
Line 132: expect(scoreEvent.data.currentScore).toBe(5000);
Line 133: expect(scoreEvent.data.baseScore).toBe(5000);
Line 144: expect(teamScore.currentScore).toBe(5000);
Line 283: expect(teamScore.currentScore).toBe(5000);
```

**Tokens Used:**
- `534e2b03` (all occurrences) - expects 5000, fixture has 30

**Required Changes:**
- Line 107: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 121: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 132: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 133: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 144: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 283: `toBe(5000)` → `toBe(30)` (534e2b03)

**Impact:** 6 assertions

---

### 5. tests/integration/error-propagation.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 235: expect(validResult.data.points).toBe(5000); // Technical rating 3 = 5000 points
Line 388: expect(validResult.data.points).toBe(5000);
Line 393: expect(team001Score.currentScore).toBe(5000);
Line 399-403: Hardcoded expected values in array
```

**Tokens Used:**
- `534e2b03` (3 occurrences) - expects 5000, fixture has 30
- `tac001` (1 occurrence) - expects 100, fixture has 10
- `rat001` (1 occurrence) - expects 15000, fixture has 40

**Required Changes:**
- Line 235: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 388: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 393: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 399: `points: 5000` → `points: 30` (534e2b03)
- Line 401: `points: 100` → `points: 10` (tac001)
- Line 403: `points: 15000` → `points: 40` (rat001)

**Impact:** 6 assertions

---

### 6. tests/integration/multi-client-broadcasts.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 160: expect(score1.data.currentScore).toBe(5000);  // Corrected: Technical rating 3 = 5000
```

**Tokens Used:**
- `534e2b03` (multiple) - expects 5000, fixture has 30
- `tac001` (used) - expects 100, fixture has 10
- `rat001` (used) - not explicitly tested
- `asm001` (used) - not explicitly tested
- `jaw001` (used) - not explicitly tested

**Required Changes:**
- Line 160: `toBe(5000)` → `toBe(30)` (534e2b03)

**Impact:** 1 assertion

---

### 7. tests/integration/session-lifecycle.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 260: expect(result.data.points).toBe(5000);
Line 343: expect(team001.currentScore).toBe(5000);
Line 344: expect(team002.currentScore).toBe(100);  // Corrected: rating 1 Personal = 100
Line 382: expect(team002.currentScore).toBe(100); // No change (still 100)
Line 407: expect(team001.currentScore).toBe(5000);
```

**Tokens Used:**
- `534e2b03` (3 occurrences) - expects 5000, fixture has 30
- `tac001` (2 occurrences) - expects 100, fixture has 10

**Required Changes:**
- Line 260: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 343: `toBe(5000)` → `toBe(30)` (534e2b03)
- Line 344: `toBe(100)` → `toBe(10)` (tac001)
- Line 382: `toBe(100)` → `toBe(10)` (tac001)
- Line 407: `toBe(5000)` → `toBe(30)` (534e2b03)

**Impact:** 5 assertions

---

### 8. tests/integration/state-synchronization.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 85: expect(team001Score.currentScore).toBe(5000); // Token 534e2b03: Technical (5x) * rating 3 (1000) = 5000
```

**Tokens Used:**
- `534e2b03` (1 occurrence) - expects 5000, fixture has 30

**Required Changes:**
- Line 85: `toBe(5000)` → `toBe(30)` (534e2b03)

**Comment Fix:** The calculation comment is WRONG. Should be: `Technical (5x) * rating 3 * 1000 = 15000` in production, but test fixture uses simplified calculation = 30

**Impact:** 1 assertion + 1 comment correction

---

### 9. tests/integration/group-completion.test.js

**Current Assertions (INCORRECT):**
```javascript
Line 125: expect(team001Score.currentScore).toBe(15000); // Only base score (rat001)
Line 126: expect(team001Score.baseScore).toBe(15000);
Line 192: expect(team001Score.currentScore).toBe(15000); // Only token value
```

**Tokens Used:**
- `rat001` (3 occurrences) - expects 15000, fixture has 40

**Required Changes:**
- Line 125: `toBe(15000)` → `toBe(40)` (rat001)
- Line 126: `toBe(15000)` → `toBe(40)` (rat001)
- Line 192: `toBe(15000)` → `toBe(40)` (rat001)

**Impact:** 3 assertions

---

### 10. tests/integration/service-events.test.js

**Current Assertions (CORRECT - No Changes Needed):**
```javascript
Line 52: expect(scoresBefore.find(s => s.teamId === '001').currentScore).toBe(100);
Line 53: expect(scoresBefore.find(s => s.teamId === '002').currentScore).toBe(50);
```

**Tokens Used:**
- None - uses manually set scores (lines 47-48), not token-based transactions

**Required Changes:**
- None - these assertions are correct as-is

**Impact:** 0 assertions

---

## Summary Statistics

### By Token ID

| Token ID | Test Fixture Value | Expected (Incorrect) | Occurrences | Files Affected |
|----------|-------------------|---------------------|-------------|----------------|
| 534e2b03 | 30 | 5000 | 25 | 8 files |
| rat001 | 40 | 15000 | 13 | 4 files |
| asm001 | 30 | 1000 | 4 | 2 files |
| tac001 | 10 | 100 | 8 | 5 files |

### By File

| File | Assertions to Update | Tokens Affected |
|------|---------------------|-----------------|
| duplicate-detection.test.js | 7 | 534e2b03, rat001, tac001 |
| admin-interventions.test.js | 8 | rat001, asm001 |
| multi-gm-coordination.test.js | 6 | 534e2b03, rat001, asm001, tac001 |
| transaction-flow.test.js | 6 | 534e2b03 |
| error-propagation.test.js | 6 | 534e2b03, tac001, rat001 |
| session-lifecycle.test.js | 5 | 534e2b03, tac001 |
| group-completion.test.js | 3 | rat001 |
| state-synchronization.test.js | 1 | 534e2b03 |
| multi-client-broadcasts.test.js | 1 | 534e2b03 |
| service-events.test.js | 0 | None (manually set scores) |

**Total:** 43 assertions across 9 test files

### Additional Issues Found

1. **Incorrect Comments:** Many test comments have wrong expected values that don't match production calculation
2. **Negative Score Risk:** admin-interventions.test.js applies -500 penalty to 40-point token, resulting in negative score
3. **Missing Production Tokens:** Test fixtures use IDs like '534e2b03' that don't exist in production ALN-TokenData
4. **Calculation Inconsistency:** Test comments claim different formulas than actual production calculation

## Recommended Approach

### Option A: Update Test Assertions (RECOMMENDED)

**Pros:**
- Keeps test fixtures lightweight and fast
- No risk of breaking fixture dependencies
- Clear separation between test and production data

**Cons:**
- Many files to update (10 files, 44 assertions)
- Need to update comments too

**Implementation:**
```bash
# Use find-replace for each token:
# 534e2b03: 5000 → 30
# rat001: 15000 → 40
# asm001: 1000 → 30
# tac001: 100 → 10
```

### Option B: Update Test Fixtures

**Pros:**
- Fewer changes (1 file vs 10 files)
- Tests would use production-scale values

**Cons:**
- May break E2E tests that also use test fixtures
- Doesn't fix incorrect comment formulas
- Loses benefit of small test values

**Not Recommended** due to potential ripple effects.

### Option C: Hybrid Approach

1. Fix test-tokens.js to use production calculation formula
2. Update all test assertions to match
3. Fix all incorrect comments
4. Add validation test to ensure fixture values match formula

**Most Thorough** but requires most work.

## Next Steps (Task 2.2)

1. Choose approach (recommend Option A)
2. Create automated find-replace script
3. Update all 44 assertions across 10 files
4. Update comments to reflect actual calculation
5. Fix negative score issue in admin-interventions.test.js
6. Run tests to verify all value assertions pass
7. Commit changes with clear documentation

## Validation Checklist

- [ ] All 44 assertions identified
- [ ] Token value mapping verified against test-tokens.js
- [ ] Production calculation formula documented
- [ ] Comment errors identified
- [ ] Special cases flagged (negative scores, etc.)
- [ ] Recommendation provided with rationale

---

**Document Status:** Complete
**Created By:** Task 2.1 systematic analysis
**Verified Against:**
- `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/tests/fixtures/test-tokens.js`
- All integration test files in `tests/integration/`
- Production calculation formula from scoring logic
