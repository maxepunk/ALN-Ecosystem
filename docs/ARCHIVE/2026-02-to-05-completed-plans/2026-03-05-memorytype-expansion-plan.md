# MemoryType Expansion & Empty Field Handling - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Mention (3x) and Party (5x) memory types, make empty fields score $0 instead of silently defaulting, and remove brittle enum gatekeeping.

**Architecture:** All changes flow from the single source of truth (`scoring-config.json`). Backend config loading becomes dynamic (no per-type listing). Validation relaxes enum to accept any string. Empty fields default to UNKNOWN/0 instead of Personal/$10k.

**Tech Stack:** Node.js (backend), ES6/Vite (GM Scanner), Joi (validation), Jest (backend tests), Jest (ALNScanner tests), Node.js built-in test runner (config-tool tests)

**Design Document:** `docs/plans/2026-03-05-memorytype-expansion-design.md`

---

## Verification Notes from Design Review

All design claims verified against codebase. Key findings:

- `scoring-config.json` lines 10-15: Currently has Personal/Business/Technical/UNKNOWN (confirmed)
- `config/index.js` lines 78-83: Manual per-type mapping from shared config (confirmed) - design's "dynamic mapping" fix is correct
- `config/index.js` lines 16-25: Hardcoded fallback (confirmed, note: line 16 not 19) - design's "throw on missing" fix is correct
- `tokenService.js` line 53: `|| config.game.valueRatingMap[1]` (confirmed)
- `tokenService.js` line 56: `(type || 'personal')` (confirmed)
- `tokenService.js` line 118: `|| 'Personal'` (confirmed)
- `validators.js` line 19: Joi enum `valid('Technical', 'Business', 'Personal')` (confirmed)
- `openapi.yaml` line 1046: enum restriction (confirmed)
- `openapi.yaml` line 1228: SECOND enum restriction in transaction response (confirmed - missed in design)
- `openapi.yaml` line 170: description text lists only 3 types (confirmed - missed in design)
- `openapi.yaml` lines 1008-1012: required list (confirmed)
- `asyncapi.yaml` lines 465, 825: two enum restrictions (confirmed)
- `uiManager.js` line 663: `|| 1` fallback (confirmed)
- `admin.css` line 835: Business uses green `#dcfce7`/`#166534` (confirmed)
- `admin.css` line 837: `.type-unknown` is last type rule (CSS insertion should be after 837, not 835)
- `getTestTokens()` lines 142-150: dead code with invalid types (confirmed)
- All "no changes needed" files verified correct

**Issues found in second review (post-plan):**
- `openapi.yaml:1228`: Second memoryType enum not in original plan → added to Task 7
- `openapi.yaml:170`: Description text not in original plan → added to Task 7
- `admin.css` insertion point: Fixed from "after line 835" to "after line 837" in Task 9
- `00-smoke-test.test.js:307`: Hardcoded `['Personal', 'Business', 'Technical']` assertion → new Task 13
- `validate-fixtures.sh:99`: Hardcoded `media_types` set → new Task 13
- `event-handling.test.js:366`: Contract test iterates only 3 types → new Task 13
- `uiManager.test.js:34`: Mock TYPE_MULTIPLIERS missing new types → new Task 13
- `convert-arduino-assets.py:123` and `scripts/setup.sh:210`: Additional `colors` dicts → added to Task 12

---

## Task 1: Add Mention and Party to scoring-config.json

**Files:**
- Modify: `ALN-TokenData/scoring-config.json`

**Step 1: Update scoring config**

```json
{
  "version": "1.0",
  "baseValues": {
    "1": 10000,
    "2": 25000,
    "3": 50000,
    "4": 75000,
    "5": 150000
  },
  "typeMultipliers": {
    "Personal": 1,
    "Mention": 3,
    "Business": 3,
    "Party": 5,
    "Technical": 5,
    "UNKNOWN": 0
  }
}
```

**Step 2: Run backend scoring-config tests to verify**

Run: `cd backend && npx jest tests/unit/services/scoring-config.test.js --verbose`
Expected: PASS (existing tests only check Personal/Business/Technical/UNKNOWN - new types are additive)

**Step 3: Run ALNScanner scoring-config tests to verify**

Run: `cd ALNScanner && npx jest tests/unit/core/scoring-config.test.js --verbose`
Expected: PASS (same reasoning)

**Step 4: Commit**

```bash
git add ALN-TokenData/scoring-config.json
git commit -m "feat(scoring): add Mention (3x) and Party (5x) memory types"
```

---

## Task 2: Add scoring-config tests for new types

**Files:**
- Modify: `backend/tests/unit/services/scoring-config.test.js`
- Modify: `ALNScanner/tests/unit/core/scoring-config.test.js`

**Step 1: Write failing tests - backend**

Add to `backend/tests/unit/services/scoring-config.test.js` inside the `'should have all required type multipliers'` test (line 30), add two new assertions after line 36:

```javascript
  it('should have all required type multipliers', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.typeMultipliers['Personal']).toBe(1);
    expect(config.typeMultipliers['Mention']).toBe(3);
    expect(config.typeMultipliers['Business']).toBe(3);
    expect(config.typeMultipliers['Party']).toBe(5);
    expect(config.typeMultipliers['Technical']).toBe(5);
    expect(config.typeMultipliers['UNKNOWN']).toBe(0);
  });
```

**Step 2: Run backend test to verify it passes** (config already updated in Task 1)

Run: `cd backend && npx jest tests/unit/services/scoring-config.test.js --verbose`
Expected: PASS

**Step 3: Write tests - ALNScanner**

Add to `ALNScanner/tests/unit/core/scoring-config.test.js`. In the test `'should have UNKNOWN type multiplier as 0'` (line 29), add Mention and Party assertions, or add a new test:

```javascript
  it('should have Mention and Party type multipliers', () => {
    expect(scoringConfig.typeMultipliers['Mention']).toBe(3);
    expect(scoringConfig.typeMultipliers['Party']).toBe(5);
  });
```

**Step 4: Run ALNScanner test to verify it passes**

Run: `cd ALNScanner && npx jest tests/unit/core/scoring-config.test.js --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/tests/unit/services/scoring-config.test.js ALNScanner/tests/unit/core/scoring-config.test.js
git commit -m "test(scoring): add Mention and Party multiplier assertions"
```

---

## Task 3: Make backend config loading dynamic

**Files:**
- Modify: `backend/src/config/index.js` (lines 16-25 fallback, lines 78-83 type mapping)

**Step 1: Write failing test for dynamic type loading**

No new test file needed. The existing `calculateTokenValue` tests in `tokenService.test.js` will validate this works. But we need to verify Mention/Party work end-to-end after the config change.

Add to `backend/tests/unit/services/tokenService.test.js` after the `'should use unknown multiplier (0) for unknown type'` test (line 121):

```javascript
    it('should calculate value for Mention type (3x multiplier)', () => {
      const value = tokenService.calculateTokenValue(2, 'Mention');
      expect(value).toBe(calcExpected(2, 'Business')); // Both are 3x
    });

    it('should calculate value for Party type (5x multiplier)', () => {
      const value = tokenService.calculateTokenValue(3, 'Party');
      expect(value).toBe(calcExpected(3, 'Technical')); // Both are 5x
    });
```

**Step 2: Run tests to verify they FAIL** (config doesn't have mention/party keys yet)

Run: `cd backend && npx jest tests/unit/services/tokenService.test.js -t "Mention|Party" --verbose`
Expected: FAIL - Mention and Party will score 0 (unknown multiplier) because config/index.js manually maps only personal/business/technical/unknown

**Step 3: Update config/index.js - remove fallback, make dynamic**

Replace lines 16-25 (the try/catch with fallback) with:

```javascript
const scoringConfigPath = path.join(__dirname, '../../../ALN-TokenData/scoring-config.json');
const sharedScoringConfig = JSON.parse(fs.readFileSync(scoringConfigPath, 'utf8'));
console.log('Loaded shared scoring config from:', scoringConfigPath);
```

Replace lines 78-83 (manual type mapping) with:

```javascript
    // Type multipliers - dynamically mapped from shared config (lowercase keys)
    typeMultipliers: Object.fromEntries(
      Object.entries(sharedScoringConfig.typeMultipliers)
        .map(([k, v]) => [k.toLowerCase(), v])
    ),
```

**Step 4: Run tests to verify they PASS**

Run: `cd backend && npx jest tests/unit/services/tokenService.test.js --verbose`
Expected: PASS - all tests including new Mention/Party ones

**Step 5: Run full backend test suite to check for regressions**

Run: `cd backend && npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add backend/src/config/index.js backend/tests/unit/services/tokenService.test.js
git commit -m "refactor(config): dynamic type multiplier loading, remove hardcoded fallback"
```

---

## Task 4: Fix empty field defaults ($0 instead of silent defaults)

**Files:**
- Modify: `backend/src/services/tokenService.js` (lines 53, 56, 118)
- Modify: `backend/tests/unit/services/tokenService.test.js` (update existing tests)

**Step 1: Update tests for new empty-field behavior**

Find the test `'should handle null or undefined type'` (line 123-131). Change it to expect $0:

```javascript
    it('should handle null or undefined type (scores $0)', () => {
      // Empty type defaults to 'unknown' (0x multiplier) = $0
      const value1 = tokenService.calculateTokenValue(2, null);
      const value2 = tokenService.calculateTokenValue(2, undefined);
      expect(value1).toBe(0);
      expect(value2).toBe(0);
    });
```

Find the test `'should default to rating 1 value for invalid rating'` (line 112-115). Change expectation:

```javascript
    it('should default to $0 for invalid rating', () => {
      const value = tokenService.calculateTokenValue(999, 'Personal');
      expect(value).toBe(0); // Missing/invalid rating = $0 base
    });
```

Find the test `'should provide default values for missing fields'` (lines 312-328). Change `'Personal'` expectation to `'UNKNOWN'`:

```javascript
    it('should provide default values for missing fields', () => {
      const tokensWithMissing = {
        'incomplete': {
          SF_RFID: 'incomplete',
          SF_ValueRating: 2,
          // Missing SF_MemoryType, SF_Group
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(tokensWithMissing));
      const tokens = tokenService.loadTokens();
      const incomplete = tokens[0];

      expect(incomplete.memoryType).toBe('UNKNOWN'); // Was 'Personal'
      expect(incomplete.value).toBe(0); // UNKNOWN = 0x multiplier
      expect(incomplete.groupId).toBe(null);
      expect(incomplete.groupMultiplier).toBe(1);
    });
```

**Step 2: Run tests to verify they FAIL**

Run: `cd backend && npx jest tests/unit/services/tokenService.test.js --verbose`
Expected: FAIL - tests expect new behavior, code still has old defaults

**Step 3: Update tokenService.js**

Line 53 - change:
```javascript
  const baseValue = config.game.valueRatingMap[rating] || config.game.valueRatingMap[1];
```
To:
```javascript
  const baseValue = config.game.valueRatingMap[rating] || 0;
```

Line 56 - change:
```javascript
  const typeKey = (type || 'personal').toLowerCase();
```
To:
```javascript
  const typeKey = (type || 'unknown').toLowerCase();
```

Line 118 - change:
```javascript
      memoryType: token.SF_MemoryType || 'Personal',  // AsyncAPI contract requires capitalized (Decision #4)
```
To:
```javascript
      memoryType: token.SF_MemoryType || 'UNKNOWN',
```

**Step 4: Run tests to verify they PASS**

Run: `cd backend && npx jest tests/unit/services/tokenService.test.js --verbose`
Expected: PASS

**Step 5: Run full backend test suite**

Run: `cd backend && npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add backend/src/services/tokenService.js backend/tests/unit/services/tokenService.test.js
git commit -m "fix(scoring): empty type/rating defaults to $0 instead of silent non-zero"
```

---

## Task 5: Remove tokenSchema enum restriction

**Files:**
- Modify: `backend/src/utils/validators.js` (line 19)

**Step 1: Write a test that proves the enum blocks new types**

Add to `backend/tests/unit/services/tokenService.test.js` inside `'Token Loading'` > `'loadTokens'` describe block (after line 328):

```javascript
    it('should load tokens with Mention memory type', () => {
      const mentionToken = {
        'mention001': {
          SF_RFID: 'mention001',
          SF_ValueRating: 3,
          SF_MemoryType: 'Mention',
          SF_Group: ''
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mentionToken));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].memoryType).toBe('Mention');
      expect(tokens[0].value).toBe(calcExpected(3, 'Mention'));
    });

    it('should load tokens with Party memory type', () => {
      const partyToken = {
        'party001': {
          SF_RFID: 'party001',
          SF_ValueRating: 4,
          SF_MemoryType: 'Party',
          SF_Group: ''
        }
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(partyToken));
      const tokens = tokenService.loadTokens();

      expect(tokens[0].memoryType).toBe('Party');
      expect(tokens[0].value).toBe(calcExpected(4, 'Party'));
    });
```

**Step 2: Run tests to verify they PASS** (loadTokens doesn't use tokenSchema validation internally - it's the Token model constructor that does)

Run: `cd backend && npx jest tests/unit/services/tokenService.test.js -t "Mention|Party memory type" --verbose`
Expected: PASS (tokenService.loadTokens() doesn't validate against tokenSchema)

Note: The tokenSchema enum restriction would only crash the backend if Token model validation is invoked at startup. The design doc says it happens in the Token model constructor. However, our loadTokens() doesn't use the Token model. The enum restriction is still dangerous because other code paths (contract tests) validate against it. Remove it anyway.

**Step 3: Remove enum restriction from validators.js**

Line 19 - change:
```javascript
  memoryType: Joi.string().valid('Technical', 'Business', 'Personal').required(),  // AsyncAPI contract values (Decision #4)
```
To:
```javascript
  memoryType: Joi.string().required(),
```

**Step 4: Run full backend test suite to check for regressions**

Run: `cd backend && npm test`
Expected: All pass (contract tests may need attention - check next)

**Step 5: Commit**

```bash
git add backend/src/utils/validators.js backend/tests/unit/services/tokenService.test.js
git commit -m "refactor(validation): remove memoryType enum restriction from tokenSchema"
```

---

## Task 6: Remove getTestTokens dead code

**Files:**
- Modify: `backend/src/services/tokenService.js` (lines 142-150, line 155)
- Modify: `backend/tests/unit/services/tokenService.test.js` (lines 347-375)

**Step 1: Remove getTestTokens function from tokenService.js**

Delete lines 142-150 (the `getTestTokens` function).

Remove `getTestTokens` from the module.exports (line 155):
```javascript
module.exports = {
  loadTokens,
  loadRawTokens,
  parseGroupMultiplier,
  extractGroupName,
  calculateTokenValue
};
```

**Step 2: Remove getTestTokens tests from tokenService.test.js**

Delete the entire `describe('getTestTokens', ...)` block (lines 347-375).

**Step 3: Run tests to verify nothing breaks**

Run: `cd backend && npm test`
Expected: All pass (fewer tests, no failures)

**Step 4: Commit**

```bash
git add backend/src/services/tokenService.js backend/tests/unit/services/tokenService.test.js
git commit -m "chore: remove getTestTokens dead code"
```

---

## Task 7: Update contracts (OpenAPI + AsyncAPI)

**Files:**
- Modify: `backend/contracts/openapi.yaml` (lines 170, 1008-1012, 1046, 1228)
- Modify: `backend/contracts/asyncapi.yaml` (lines 465, 825)

**Step 1: Update OpenAPI**

Line 1046 - remove enum from Token schema SF_MemoryType:
```yaml
        SF_MemoryType:
          type: string
          description: Memory category (scoring multiplier varies by type)
          example: "Technical"
```
(Remove the `enum` line entirely - matches the validator change)

Line 1228 - remove enum from transaction response memoryType (SECOND enum location):
```yaml
              memoryType:
                type: string
                description: Token memory type (from tokens.json)
                example: "Technical"
```
(Remove the `enum` line entirely)

Line 170 - update description text:
```yaml
        - SF_MemoryType ("Technical", "Business", "Personal", "Mention", "Party")
```

Lines 1008-1012 - remove `SF_ValueRating` and `SF_MemoryType` from required list:
```yaml
    Token:
      type: object
      required:
        - SF_RFID
        - SF_Group
      properties:
```

**Step 2: Update AsyncAPI**

Line 465 - change:
```yaml
                    memoryType:
                      type: string
                      description: Token memory type (Personal, Business, Technical, Mention, Party, or UNKNOWN)
                      example: "Technical"
```
(Remove `enum` line)

Line 825 - change:
```yaml
                  memoryType:
                    type: string
                    description: Token memory type (Personal, Business, Technical, Mention, Party, or UNKNOWN)
                    example: "Technical"
```
(Remove `enum` line)

**Step 3: Run contract tests to verify**

Run: `cd backend && npx jest tests/unit/contracts/ --verbose`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/contracts/openapi.yaml backend/contracts/asyncapi.yaml
git commit -m "docs(contracts): remove memoryType enum, relax required fields for empty tokens"
```

---

## Task 8: Fix UI multiplier display

**Files:**
- Modify: `ALNScanner/src/ui/uiManager.js` (line 663)

**Step 1: Write failing test**

Check if there's an existing test for this line. Search for test coverage of multiplier display in ALNScanner tests. If not, add a unit test for the multiplier lookup behavior.

The fix is a one-liner. Change line 663 from:
```javascript
const multiplier = dataSource.SCORING_CONFIG.TYPE_MULTIPLIERS[token.memoryType] || 1;
```
To:
```javascript
const multiplier = dataSource.SCORING_CONFIG.TYPE_MULTIPLIERS[token.memoryType] ?? 0;
```

**Step 2: Run ALNScanner tests**

Run: `cd ALNScanner && npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add ALNScanner/src/ui/uiManager.js
git commit -m "fix(ui): show 0x multiplier for unknown types instead of 1x"
```

---

## Task 9: Add CSS for new memory types

**Files:**
- Modify: `ALNScanner/src/styles/screens/admin.css` (after line 835)

**Step 1: Add CSS rules**

After line 837 (the `.type-unknown` rule — last existing type rule), add:

```css
.token-card .token-type.type-mention { background: #d9f99d; color: #365314; }
.token-card .token-type.type-party { background: #f3e8ff; color: #6b21a8; }
```

Mention = lime green (distinct from Business's emerald green)
Party = purple

**Step 2: Run ALNScanner tests**

Run: `cd ALNScanner && npm test`
Expected: PASS (CSS changes don't break tests)

**Step 3: Commit**

```bash
git add ALNScanner/src/styles/screens/admin.css
git commit -m "feat(ui): add Mention (lime) and Party (purple) type badges"
```

---

## Task 10: Update config-tool mock scoring config

**Files:**
- Modify: `config-tool/tests/configManager.test.js` (line 17)

**Step 1: Update mock to include new types**

Line 17 - change the mock typeMultipliers:
```javascript
    fs.writeFileSync(path.join(tmpDir, 'scoring-config.json'), JSON.stringify({
      version: '1.0',
      baseValues: { '1': 10000, '2': 25000 },
      typeMultipliers: { Personal: 1, Mention: 3, Business: 3, Party: 5, Technical: 5, UNKNOWN: 0 }
    }));
```

**Step 2: Run config-tool tests**

Run: `cd config-tool && npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add config-tool/tests/configManager.test.js
git commit -m "test(config-tool): update mock scoring config with Mention and Party types"
```

---

## Task 11: Update documentation

**Files:**
- Modify: `docs/SCORING_LOGIC.md`
- Modify: `CLAUDE.md`
- Modify: `ALNScanner/CLAUDE.md`
- Modify: `ALN-TokenData/CLAUDE.md`

**Step 1: Update SCORING_LOGIC.md**

Replace the Type Multipliers table (lines 19-26) with:

```markdown
## Type Multipliers (SF_MemoryType)

| Type | Multiplier |
|------|------------|
| Personal | 1x |
| Mention | 3x |
| Business | 3x |
| Party | 5x |
| Technical | 5x |
| UNKNOWN / empty | 0x (no points) |
```

Add after line 27 (after the UNKNOWN row):

```markdown
**Empty Field Handling:**
- Missing/empty `SF_MemoryType` defaults to UNKNOWN (0x multiplier = $0)
- Missing/empty `SF_ValueRating` defaults to $0 base value
```

Update the Implementation Locations table (lines 59-66) - update "Last verified" to current date.

**Step 2: Update root CLAUDE.md**

In the "Scoring Business Logic" Quick Reference section, update TYPE_MULTIPLIERS:
```
TYPE_MULTIPLIERS: {Personal: 1x, Mention: 3x, Business: 3x, Party: 5x, Technical: 5x, UNKNOWN: 0x}
```

In the Token Data Schema, update SF_MemoryType:
```
"SF_MemoryType": "Personal" | "Business" | "Technical" | "Mention" | "Party",
```

**Step 3: Update ALNScanner/CLAUDE.md**

In the "Valid Memory Types" section, add:
```markdown
- `Mention` - 3x multiplier
- `Party` - 5x multiplier
```

**Step 4: Update ALN-TokenData/CLAUDE.md**

In the Token Schema section, update SF_MemoryType:
```
"SF_MemoryType": "Personal" | "Business" | "Technical" | "Mention" | "Party",
```

**Step 5: Commit**

```bash
git add docs/SCORING_LOGIC.md CLAUDE.md ALNScanner/CLAUDE.md ALN-TokenData/CLAUDE.md
git commit -m "docs: update scoring docs with Mention, Party types and empty-field behavior"
```

---

## Task 12: Update Python placeholder scripts

**Files:**
- Modify: `aln-memory-scanner/create_placeholders.py` (line 15 — `colors` dict)
- Modify: `aln-memory-scanner/generate-qr.py` (line 164 — `colors` dict)
- Modify: `aln-memory-scanner/convert-arduino-assets.py` (line 123 — `colors` dict)
- Modify: `aln-memory-scanner/scripts/setup.sh` (line 210 — embedded Python `colors` dict)

**Step 1: Add Mention and Party color entries**

In all four files, add `Mention` and `Party` to their `colors` dicts. The dict varies slightly per file (some have `Test`/`Classified`, some don't). Add after the `Business` entry in each:

```python
    'Mention': (163, 230, 53),       # Lime green
    'Party': (192, 132, 252),        # Purple
```

**Step 2: Commit**

```bash
git add aln-memory-scanner/create_placeholders.py aln-memory-scanner/generate-qr.py aln-memory-scanner/convert-arduino-assets.py aln-memory-scanner/scripts/setup.sh
git commit -m "feat(placeholders): add Mention and Party color entries"
```

---

## Task 13: Fix hardcoded type enums in tests and fixtures

**Files:**
- Modify: `backend/tests/e2e/flows/00-smoke-test.test.js` (line 307)
- Modify: `backend/tests/e2e/fixtures/validate-fixtures.sh` (line 99)
- Modify: `backend/tests/contract/scanner/event-handling.test.js` (line 366)
- Modify: `ALNScanner/tests/unit/ui/uiManager.test.js` (line 34)

**Step 1: Fix E2E smoke test** (CRITICAL — will break when Mention/Party tokens appear in tokens.json)

Line 307 - change:
```javascript
      expect(['Personal', 'Business', 'Technical']).toContain(token.SF_MemoryType);
```
To:
```javascript
      expect(token.SF_MemoryType).toBeDefined();
      expect(typeof token.SF_MemoryType).toBe('string');
```

Rationale: The smoke test should verify tokens have a memoryType, not gatekeep which types are allowed. The scoring system already handles unknown types (0x multiplier).

**Step 2: Fix fixture validator**

Line 99 - change:
```python
media_types = {'Personal', 'Business', 'Technical'}
```
To:
```python
media_types = {'Personal', 'Business', 'Technical', 'Mention', 'Party'}
```

**Step 3: Expand contract test coverage** (non-critical, additive)

Line 366 - change:
```javascript
      const memoryTypes = ['Technical', 'Business', 'Personal'];
```
To:
```javascript
      const memoryTypes = ['Technical', 'Business', 'Personal', 'Mention', 'Party'];
```

**Step 4: Update ALNScanner uiManager test mock** (non-critical, additive)

Line 34 - change:
```javascript
        TYPE_MULTIPLIERS: { 'Personal': 1, 'Business': 3, 'Technical': 5, 'UNKNOWN': 0 }
```
To:
```javascript
        TYPE_MULTIPLIERS: { 'Personal': 1, 'Mention': 3, 'Business': 3, 'Party': 5, 'Technical': 5, 'UNKNOWN': 0 }
```

**Step 5: Run affected test suites**

Run: `cd backend && npx jest tests/contract/ --verbose`
Run: `cd ALNScanner && npx jest tests/unit/ui/uiManager.test.js --verbose`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/tests/e2e/flows/00-smoke-test.test.js backend/tests/e2e/fixtures/validate-fixtures.sh backend/tests/contract/scanner/event-handling.test.js ALNScanner/tests/unit/ui/uiManager.test.js
git commit -m "test: remove hardcoded memoryType enums from tests and fixtures"
```

---

## Task 14: Final verification

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All pass

**Step 2: Run all ALNScanner tests**

Run: `cd ALNScanner && npm test`
Expected: All pass

**Step 3: Run config-tool tests**

Run: `cd config-tool && npm test`
Expected: All pass

**Step 4: Rebuild ALNScanner dist**

Run: `cd ALNScanner && npm run build`
Expected: Build succeeds

**Step 5: Verify no untracked changes**

Run: `git status`
Expected: Clean working tree (all committed)

---

## Dependency Graph

```
Task 1 (scoring-config.json)
  |
  +-- Task 2 (scoring-config tests) -- no deps beyond Task 1
  |
  +-- Task 3 (dynamic config loading) -- depends on Task 1
  |     |
  |     +-- Task 4 (empty field defaults) -- depends on Task 3
  |           |
  |           +-- Task 5 (remove enum) -- depends on Task 4
  |
  +-- Task 8 (UI multiplier) -- depends on Task 1
  +-- Task 9 (CSS) -- no deps
  +-- Task 10 (config-tool mock) -- depends on Task 1
  +-- Task 12 (Python scripts) -- no deps

Task 6 (remove dead code) -- independent
Task 7 (contracts) -- depends on Task 5
Task 11 (documentation) -- depends on all above
Task 13 (hardcoded enum cleanup) -- depends on Task 7
Task 14 (final verification) -- depends on all above
```

**Parallelizable batches:**
- Batch 1: Task 1
- Batch 2: Tasks 2, 6, 9, 12 (all independent after Task 1)
- Batch 3: Tasks 3, 8, 10 (depend on Task 1)
- Batch 4: Task 4 (depends on Task 3)
- Batch 5: Tasks 5, 7 (depend on Task 4)
- Batch 6: Tasks 11, 13 (documentation + test enum cleanup)
- Batch 7: Task 14 (final verification)
