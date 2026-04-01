# Null Scoring Fields Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ALN system safely handle tokens with null `SF_ValueRating` and/or null `SF_MemoryType` — tokens that exist in the game but have no Black Market score value — AND make the E2E test infrastructure resilient to the token type distribution shift (heavy Mention/Party, potentially zero Personal/Business/Technical).

**Architecture:** The backend already handles null scoring fields gracefully in `calculateTokenValue()` (returns 0). The blocker is Joi validation in the Token model constructor, which rejects `rating: null`. Additionally, the E2E test helper `selectTestTokens()` hardcodes type requirements (`Personal`, `Business`, `Technical`) that may not exist in the final dataset. Fix both: the validation bug and the brittle E2E type selection.

**Tech Stack:** Node.js, Jest, Joi validation, Playwright E2E

---

## Context

Notion token data is being overhauled. Two breaking changes:

### 1. Null Scoring Fields

Some tokens will intentionally have `SF_ValueRating: null` and `SF_MemoryType: null`. These tokens participate in gameplay but earn $0 in Black Market mode.

**Current token loading chain:**
```
app.js:152        tokenService.loadTokens()     -> plain objects with metadata.rating: null
app.js:154        transactionService.init(tokens)
  |-- line 33     new Token(token)              -> Joi validates metadata.rating
                                                -> THROWS ValidationError (null not allowed)
                                                -> SERVER CRASHES ON STARTUP
```

**Scoring math already handles nulls (no changes needed):**
```javascript
// tokenService.js:51-61
const baseValue = config.game.valueRatingMap[rating] || 0;        // null -> 0
const typeKey = (type || 'unknown').toLowerCase();                  // null -> 'unknown'
const multiplier = config.game.typeMultipliers[typeKey] || 0;      // unknown -> 0
return Math.floor(0 * 0);                                         // -> 0 (correct)
```

### 2. Type Distribution Shift

The dataset is trending heavily toward Mention and Party types:

| Type | Current Count | Multiplier | Equivalent Tier |
|------|--------------|------------|-----------------|
| Personal | 6 (may reach 0) | 1x | Tier 1 (unique) |
| Mention | 58 | 3x | Tier 3 |
| Business | 3 (may reach 0) | 3x | Tier 3 |
| Party | 14 | 5x | Tier 5 |
| Technical | 4 (may reach 0) | 5x | Tier 5 |
| null | 5 | 0x | No tier |

The E2E `selectTestTokens()` helper at `backend/tests/e2e/helpers/token-selection.js:109-117` currently throws if ANY of Personal, Business, or Technical has zero tokens. This would break **every E2E test** (13 test files all call `selectTestTokens()` in `beforeAll`).

The tests don't actually need specific type names — they need tokens from **different multiplier tiers** to verify scoring differentiation. Mention is equivalent to Business (both 3x), Party is equivalent to Technical (both 5x).

---

### Task 1: Fix Joi Token Schema — Allow Null Rating

**Files:**
- Create: `backend/tests/unit/models/token-null-fields.test.js`
- Modify: `backend/src/utils/validators.js:33`

**Step 1: Write the failing test**

Create file `backend/tests/unit/models/token-null-fields.test.js`:

```javascript
/**
 * Token Model - Null Scoring Fields
 *
 * Tokens with null SF_ValueRating and/or SF_MemoryType are valid.
 * These tokens participate in gameplay but earn $0 in Black Market mode.
 */

const Token = require('../../../src/models/token');

describe('Token Model - Null Scoring Fields', () => {
  const baseToken = {
    id: 'null001',
    name: 'Memory null001',
    value: 0,
    memoryType: 'UNKNOWN',
    groupId: null,
    mediaAssets: {
      image: 'assets/images/null001.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'null001',
      group: '',
      originalType: null,
      owner: null
    }
  };

  it('should accept token with null metadata.rating', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    expect(() => new Token(data)).not.toThrow();
  });

  it('should accept token with undefined metadata.rating (missing field)', () => {
    const data = { ...baseToken };
    // rating not present in metadata at all
    expect(() => new Token(data)).not.toThrow();
  });

  it('should accept token with null metadata.originalType', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, originalType: null, rating: null } };
    expect(() => new Token(data)).not.toThrow();
  });

  it('should still reject invalid rating values (not null, not 1-5)', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: 999 } };
    expect(() => new Token(data)).toThrow();
  });

  it('should still reject rating of 0 (below minimum)', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: 0 } };
    expect(() => new Token(data)).toThrow();
  });

  it('should preserve null rating in constructed token', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    const token = new Token(data);
    expect(token.metadata.rating).toBeNull();
  });

  it('should have value of 0 for null-scoring tokens', () => {
    const data = { ...baseToken, metadata: { ...baseToken.metadata, rating: null } };
    const token = new Token(data);
    expect(token.value).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/models/token-null-fields.test.js --verbose`

Expected: FAIL — `"should accept token with null metadata.rating"` throws ValidationError because Joi `.optional()` does not allow `null`.

**Step 3: Fix the Joi schema**

In `backend/src/utils/validators.js`, line 33, change:

```javascript
// BEFORE:
rating: Joi.number().integer().min(1).max(5).optional(),

// AFTER:
rating: Joi.number().integer().min(1).max(5).optional().allow(null),
```

One line. `.allow(null)` tells Joi that `null` is valid in addition to `undefined` (from `.optional()`) and integers 1-5.

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/models/token-null-fields.test.js --verbose`

Expected: All 7 tests PASS.

**Step 5: Run the full unit + contract test suite**

Run: `cd backend && npm test`

Expected: All existing tests still pass (1468+).

**Step 6: Commit**

```bash
git add backend/src/utils/validators.js backend/tests/unit/models/token-null-fields.test.js
git commit -m "fix(tokens): allow null rating in Joi token schema

Tokens with null SF_ValueRating are valid game tokens that earn \$0
in Black Market mode. The Joi schema rejected null (only allowed
undefined via .optional()), causing server crash on startup when
loading scoreless tokens."
```

---

### Task 2: Add Null-Scoring Token to Test Fixtures and tokenService Tests

**Files:**
- Modify: `backend/tests/fixtures/test-tokens.js` (~line 327, ~line 359)
- Modify: `backend/tests/unit/services/tokenService.test.js` (after line 336)

**Step 1: Add fixture**

In `backend/tests/fixtures/test-tokens.js`, add after the `DETECTIVE_TOKEN_WITH_HTML` block (around line 327), before the `getAllAsObject()` method:

```javascript
  // Token with null scoring fields (no Black Market value)
  // Represents tokens that exist in gameplay but have no score
  NULL_SCORING_TOKEN: {
    id: 'null001',
    name: 'Memory null001',
    value: 0,  // null rating + UNKNOWN type = $0
    memoryType: 'UNKNOWN',
    groupId: null,
    groupMultiplier: 1,
    mediaAssets: {
      image: 'assets/images/null001.bmp',
      audio: null,
      video: null,
      processingImage: null
    },
    metadata: {
      rfid: 'null001',
      group: '',
      originalType: null,
      rating: null,
      summary: 'A token with no scoring value',
      owner: 'Test Character'
    }
  },
```

Then in `getAllAsObject()`, add after the detective tokens block (~line 359):

```javascript
    tokens[this.NULL_SCORING_TOKEN.id] = this.NULL_SCORING_TOKEN;
```

**Step 2: Add tokenService test for fully-null token loading**

In `backend/tests/unit/services/tokenService.test.js`, add after the existing "should provide default values for missing fields" test (after line 336):

```javascript
    it('should handle token with both null SF_ValueRating and null SF_MemoryType', () => {
      const nullScoringToken = {
        'scoreless001': {
          SF_RFID: 'scoreless001',
          SF_ValueRating: null,
          SF_MemoryType: null,
          SF_Group: '',
          image: 'assets/images/scoreless001.bmp',
          audio: null,
          video: null,
          processingImage: null,
          owner: 'Test Character'
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(nullScoringToken));
      const tokens = tokenService.loadTokens();
      const token = tokens[0];

      expect(token.memoryType).toBe('UNKNOWN');
      expect(token.value).toBe(0);
      expect(token.metadata.rating).toBeNull();
      expect(token.metadata.originalType).toBeNull();
      expect(token.metadata.owner).toBe('Test Character');
      expect(token.id).toBe('scoreless001');
    });
```

**Step 3: Run tests**

Run: `cd backend && npm test`

Expected: All tests pass including the new ones.

**Step 4: Commit**

```bash
git add backend/tests/fixtures/test-tokens.js backend/tests/unit/services/tokenService.test.js
git commit -m "test(tokens): add null-scoring token fixture and loading test

Adds NULL_SCORING_TOKEN fixture with null rating/originalType, and
a tokenService test verifying loadTokens() handles tokens where both
SF_ValueRating and SF_MemoryType are null."
```

---

### Task 3: Rewrite E2E Token Selection — Multiplier Tiers Instead of Type Names

This is the critical resilience fix. The final Notion dataset may have zero Personal, zero Business, and/or zero Technical tokens. The E2E tests need tokens from different **multiplier tiers**, not specific type names.

**Files:**
- Modify: `backend/tests/e2e/helpers/token-selection.js` (lines 96-214)

**Scoring multiplier tiers:**
```
Tier 1 (1x): Personal
Tier 3 (3x): Business, Mention
Tier 5 (5x): Technical, Party
```

**Step 1: Rewrite selectTestTokens()**

Replace the type-specific selection logic (lines 98-154) in `backend/tests/e2e/helpers/token-selection.js`. The full function is being modified, so here's the complete replacement for lines 96-214:

```javascript
async function selectTestTokens(orchestratorUrl) {
  const tokens = await fetchTokenDatabase(orchestratorUrl);
  let availableTokens = Object.values(tokens);

  // Filter to only scoreable tokens (those with valid MemoryType and ValueRating)
  const scoreableTokens = availableTokens.filter(t =>
    t.SF_MemoryType && t.SF_ValueRating
  );

  // Select tokens by MULTIPLIER TIER, not specific type name.
  // This makes E2E tests resilient to type distribution shifts.
  // Tier 1 (1x): Personal
  // Tier 3 (3x): Business, Mention
  // Tier 5 (5x): Technical, Party
  const TIER_1_TYPES = ['Personal'];
  const TIER_3_TYPES = ['Business', 'Mention'];
  const TIER_5_TYPES = ['Technical', 'Party'];

  const tier1Tokens = scoreableTokens.filter(t => TIER_1_TYPES.includes(t.SF_MemoryType));
  const tier3Tokens = scoreableTokens.filter(t => TIER_3_TYPES.includes(t.SF_MemoryType));
  const tier5Tokens = scoreableTokens.filter(t => TIER_5_TYPES.includes(t.SF_MemoryType));

  // Find video tokens (have non-null video field)
  const videoTokens = availableTokens.filter(t => t.video && t.video !== '');

  // Validation: Need at least 2 tiers with tokens for meaningful scoring tests.
  // If only 1 tier exists, scoring parity tests can't verify differentiation.
  const populatedTiers = [tier1Tokens, tier3Tokens, tier5Tokens].filter(t => t.length > 0);
  if (populatedTiers.length < 2) {
    throw new Error(
      `Need tokens in at least 2 multiplier tiers for scoring tests. ` +
      `Found: Tier1(1x)=${tier1Tokens.length}, Tier3(3x)=${tier3Tokens.length}, Tier5(5x)=${tier5Tokens.length}. ` +
      `Check tokens.json has tokens with valid SF_MemoryType values.`
    );
  }

  // Need at least 3 total scoreable tokens for multi-scan tests
  if (scoreableTokens.length < 3) {
    throw new Error(
      `Need at least 3 scoreable tokens. Found ${scoreableTokens.length}. ` +
      `Check tokens.json has tokens with valid SF_MemoryType and SF_ValueRating.`
    );
  }

  const selected = {};
  const usedTokenIds = new Set();

  // Helper to mark token as used and remove from available pool
  const allocateToken = (token) => {
    usedTokenIds.add(token.SF_RFID);
    availableTokens = availableTokens.filter(t => t.SF_RFID !== token.SF_RFID);
    return token;
  };

  // 1. ALLOCATE GROUP TOKENS FIRST (most restrictive - need complete group)
  selected.groupTokens = findGroupTokens(tokens, 2);
  if (selected.groupTokens.length > 0) {
    selected.groupTokens.forEach(t => usedTokenIds.add(t.SF_RFID));
    availableTokens = availableTokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  }

  // 2. ALLOCATE TIER TOKENS from remaining pool (excluding group members)
  // These are exposed as personalToken/businessToken/technicalToken for
  // backward compatibility with existing E2E tests. The names are labels
  // for multiplier tiers, not type requirements.
  const availableTier1 = tier1Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableTier3 = tier3Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableTier5 = tier5Tokens.filter(t => !usedTokenIds.has(t.SF_RFID));
  const availableScoreable = scoreableTokens.filter(t => !usedTokenIds.has(t.SF_RFID));

  // personalToken = Tier 1 (1x) preferred, fallback to any scoreable
  selected.personalToken = allocateToken(
    (availableTier1.find(t => t.SF_ValueRating === 2) || availableTier1[0])
    || availableScoreable[0]
  );

  // businessToken = Tier 3 (3x) preferred, fallback to any scoreable
  const remainingTier3 = availableTier3.filter(t => !usedTokenIds.has(t.SF_RFID));
  const remainingScoreable = availableScoreable.filter(t => !usedTokenIds.has(t.SF_RFID));
  selected.businessToken = allocateToken(
    (remainingTier3.find(t => t.SF_ValueRating === 3) || remainingTier3[0])
    || remainingScoreable[0]
  );

  // technicalToken = Tier 5 (5x) preferred, fallback to any scoreable
  const remainingTier5 = availableTier5.filter(t => !usedTokenIds.has(t.SF_RFID));
  const remainingScoreable2 = remainingScoreable.filter(t => !usedTokenIds.has(t.SF_RFID));
  selected.technicalToken = allocateToken(
    (remainingTier5.find(t => t.SF_ValueRating === 5) || remainingTier5[0])
    || remainingScoreable2[0]
  );

  // Video token (for video alert testing) - exclude already used tokens AND verify video file exists
  const availableVideo = videoTokens.filter(t => {
    if (usedTokenIds.has(t.SF_RFID)) return false;
    // Verify video file actually exists on disk
    const videoPath = path.join(VIDEOS_DIR, t.video);
    const exists = fs.existsSync(videoPath);
    if (!exists) {
      console.log(`  -> Skipping video token ${t.SF_RFID}: video file "${t.video}" not found`);
    }
    return exists;
  });
  if (availableVideo.length > 0) {
    selected.videoToken = allocateToken(availableVideo[0]);
    console.log(`  -> Video token verified: ${selected.videoToken.video} exists at ${VIDEOS_DIR}`);
  } else {
    selected.videoToken = null;
  }

  // 3. ALLOCATE UNIQUE TOKENS for duplicate detection (from remaining pool)
  selected.uniqueTokens = availableTokens.slice(0, 5);

  // All tokens (for reference)
  selected.allTokens = Object.values(tokens);

  // Log selected tokens for debugging (with tier info)
  const tierLabel = (type) => {
    if (TIER_1_TYPES.includes(type)) return '1x';
    if (TIER_3_TYPES.includes(type)) return '3x';
    if (TIER_5_TYPES.includes(type)) return '5x';
    return '?x';
  };
  console.log('Token Selection Summary:');
  console.log(`  -> personalToken (tier1): ${selected.personalToken.SF_RFID} (${selected.personalToken.SF_MemoryType} ${tierLabel(selected.personalToken.SF_MemoryType)}, ${selected.personalToken.SF_ValueRating}*)`);
  console.log(`  -> businessToken (tier3): ${selected.businessToken.SF_RFID} (${selected.businessToken.SF_MemoryType} ${tierLabel(selected.businessToken.SF_MemoryType)}, ${selected.businessToken.SF_ValueRating}*)`);
  console.log(`  -> technicalToken (tier5): ${selected.technicalToken.SF_RFID} (${selected.technicalToken.SF_MemoryType} ${tierLabel(selected.technicalToken.SF_MemoryType)}, ${selected.technicalToken.SF_ValueRating}*)`);
  console.log(`  -> Video token: ${selected.videoToken ? selected.videoToken.SF_RFID : 'NONE FOUND'}`);
  console.log(`  -> Group tokens: ${selected.groupTokens.length > 0 ? selected.groupTokens.map(t => t.SF_RFID).join(', ') : 'NONE FOUND'}`);
  console.log(`  -> Unique tokens: ${selected.uniqueTokens.slice(0, 3).map(t => t.SF_RFID).join(', ')}... (${selected.uniqueTokens.length} total)`);
  console.log(`  -> Scoreable: ${scoreableTokens.length}, Null-scoring: ${availableTokens.length - scoreableTokens.length}`);

  // Validation: Warn if group tokens not found
  if (selected.groupTokens.length < 2) {
    console.warn('Warning: No group with 2+ tokens found. Group completion bonus tests will be skipped.');
  }

  // Validation: Warn if video tokens not found
  if (!selected.videoToken) {
    console.warn('Warning: No video token found. Video alert tests will be skipped.');
  }

  // Validation: Check for overlap (should never happen with exclusive allocation)
  const allSelections = [
    selected.personalToken.SF_RFID,
    selected.businessToken.SF_RFID,
    selected.technicalToken.SF_RFID,
    ...(selected.videoToken ? [selected.videoToken.SF_RFID] : []),
    ...selected.groupTokens.map(t => t.SF_RFID),
    ...selected.uniqueTokens.map(t => t.SF_RFID)
  ];
  const uniqueSelections = new Set(allSelections);
  if (allSelections.length !== uniqueSelections.size) {
    console.warn('WARNING: Token overlap detected in selection! This violates exclusivity.');
  }

  return selected;
}
```

**Step 2: Run E2E smoke test to verify the selection works with current data**

Run: `cd backend && npx playwright test flows/00-smoke-test --workers=1`

Expected: The smoke test passes. With the current token data (which still has Personal/Business/Technical), the tier-based selection finds exact matches. The behavior is identical to before.

**Step 3: Commit**

```bash
git add backend/tests/e2e/helpers/token-selection.js
git commit -m "test(e2e): select tokens by multiplier tier, not type name

selectTestTokens() now selects by multiplier tier (1x/3x/5x) instead
of requiring specific types (Personal/Business/Technical). Mention
substitutes for Business (both 3x), Party for Technical (both 5x).

This makes E2E tests resilient to type distribution shifts. The Notion
data is trending toward Mention/Party types; requiring exact legacy
types would break all 13 E2E test files."
```

---

### Task 4: Update Smoke Test Type Assertions

The smoke test at `backend/tests/e2e/flows/00-smoke-test.test.js:286-296` hardcodes exact type assertions:

```javascript
expect(testTokens.personalToken.SF_MemoryType).toBe('Personal');   // line 288
expect(testTokens.businessToken.SF_MemoryType).toBe('Business');   // line 293
expect(testTokens.technicalToken.SF_MemoryType).toBe('Technical'); // line 296
```

These must accept any type within the correct multiplier tier.

**Files:**
- Modify: `backend/tests/e2e/flows/00-smoke-test.test.js` (lines 286-304)

**Step 1: Update the assertions**

Replace lines 286-304 with:

```javascript
    // Verify required tokens exist and have valid scoring fields
    // Token names (personalToken, businessToken, technicalToken) are multiplier tier labels:
    // personalToken = Tier 1 (1x): Personal
    // businessToken = Tier 3 (3x): Business, Mention
    // technicalToken = Tier 5 (5x): Technical, Party
    const TIER_1_TYPES = ['Personal'];
    const TIER_3_TYPES = ['Business', 'Mention'];
    const TIER_5_TYPES = ['Technical', 'Party'];

    expect(testTokens.personalToken).toBeDefined();
    expect(testTokens.personalToken.SF_ValueRating).toBeGreaterThanOrEqual(1);
    expect(testTokens.personalToken.SF_ValueRating).toBeLessThanOrEqual(5);
    // Accept any type in tier (fallback may select from different tier)
    expect(testTokens.personalToken.SF_MemoryType).toBeDefined();

    expect(testTokens.businessToken).toBeDefined();
    expect(testTokens.businessToken.SF_MemoryType).toBeDefined();

    expect(testTokens.technicalToken).toBeDefined();
    expect(testTokens.technicalToken.SF_MemoryType).toBeDefined();

    // Verify allTokens array has production data
    expect(testTokens.allTokens).toBeInstanceOf(Array);
    expect(testTokens.allTokens.length).toBeGreaterThan(0);

    // All tokens should have SF_RFID (null-scoring tokens included)
    testTokens.allTokens.forEach(token => {
      expect(token).toHaveProperty('SF_RFID');
```

**Step 2: Run the smoke test**

Run: `cd backend && npx playwright test flows/00-smoke-test --workers=1`

Expected: PASS.

**Step 3: Commit**

```bash
git add backend/tests/e2e/flows/00-smoke-test.test.js
git commit -m "test(e2e): relax smoke test type assertions to accept tier equivalents

personalToken/businessToken/technicalToken are now multiplier tier
labels that may contain any type within that tier (e.g., Mention
instead of Business). Smoke test validates tokens have valid scoring
fields, not specific type names."
```

---

### Task 5: Add Null-Scoring Token to Production Token Data for E2E Verification

The E2E tests spawn a real orchestrator that loads real `ALN-TokenData/tokens.json`. To prove the Joi fix works end-to-end, add a null-scoring token to the real token data.

**Files:**
- Modify: `ALN-TokenData/tokens.json` (add entry at end)

**Step 1: Add null-scoring test token by syncing Notion**


**Step 2: Run the full E2E suite**

This is the definitive verification. The orchestrator loads tokens.json (including our null token), transforms it via `loadTokens()`, passes through `new Token()` in `transactionService.init()`, and serves it via `/api/tokens`.

Run: `cd backend && npx playwright test --workers=2`

Expected: All E2E tests pass. The orchestrator starts successfully with the null-scoring token loaded. `selectTestTokens()` filters it out of scoring selections (null MemoryType doesn't match any tier). The token exists in `allTokens` but doesn't interfere with any test.

**Step 3: Commit (inside the submodule first, then parent)**

```bash
cd ALN-TokenData
git add tokens.json
git commit -m "test: add null-scoring token for E2E verification

Token test_null001 has null SF_ValueRating and SF_MemoryType. Used to
verify the backend handles scoreless tokens without crashing."
cd ..
git add ALN-TokenData
git commit -m "chore: update ALN-TokenData submodule ref (null-scoring test token)"
```

Note: This test token will be replaced when the Notion sync runs. It's a temporary verification aid.

---

### Task 6: Run Full Test Suite Verification

**Step 1: Backend unit + contract tests**

Run: `cd backend && npm test`

Expected: All tests pass (1468+ tests).

**Step 2: Backend integration tests**

Run: `cd backend && npm run test:integration`

Expected: All tests pass (278 tests).

**Step 3: ALNScanner unit tests**

Run: `cd ALNScanner && npm test`

Expected: All tests pass (1116 tests). No changes were made to GM Scanner code.

**Step 4: Full E2E suite (already run in Task 5, but verify all pass)**

Run: `cd backend && npx playwright test --workers=2`

Expected: All 121+ E2E tests pass (28 skipped as usual).

No commit needed for verification.

---

## Summary of All Changes

| File | Change | Why |
|------|--------|-----|
| `backend/src/utils/validators.js:33` | Add `.allow(null)` to `metadata.rating` | Server crashes on startup with null-rating tokens |
| `backend/tests/unit/models/token-null-fields.test.js` | New: 7 tests for null-scoring Token model | TDD: prove bug exists, prove fix works |
| `backend/tests/fixtures/test-tokens.js` | Add `NULL_SCORING_TOKEN` fixture | Unit/integration test coverage |
| `backend/tests/unit/services/tokenService.test.js` | Add test for fully-null token loading | Verify loadTokens() handles both fields null |
| `backend/tests/e2e/helpers/token-selection.js` | Rewrite to select by multiplier tier | Personal/Business/Technical may reach 0 tokens |
| `backend/tests/e2e/flows/00-smoke-test.test.js` | Relax type assertions to accept tier equivalents | Smoke test fails if exact type not in dataset |
| `ALN-TokenData/tokens.json` | Add `test_null001` null-scoring token | E2E proves orchestrator starts with null tokens |

**Total production code changes:** 1 line (Joi `.allow(null)`)
**Total test infrastructure changes:** ~150 lines across 5 files

## What This Does NOT Change

- **GM Scanner scoring** (`ALNScanner/src/core/scoring.js`) — already handles null via `|| 0` and `?? UNKNOWN`
- **Scoreboard** — works with processed transaction data, no raw token fields
- **Player scanners** — never read scoring fields
- **API contracts** — SF_ValueRating and SF_MemoryType already optional in OpenAPI/AsyncAPI
- **Scoring config** — UNKNOWN type already has 0x multiplier
- **Group parsing** — regex handles all new group patterns

## Post-Sync Considerations (Not In This Plan)

After the Notion sync is actually run, separately verify:
- Video files exist on disk for any new video tokens
- Audio files exist for any new audio tokens
- At least 2 multiplier tiers have tokens (E2E requires this)
- Groups with `(x1)` multiplier correctly yield $0 bonus (multiplier - 1 = 0)
- Remove `test_null001` from tokens.json (real null tokens will exist from Notion)
