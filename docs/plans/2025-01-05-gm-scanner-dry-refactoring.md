# GM Scanner DRY Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate scoring configuration duplication across frontend/backend and remove deprecated detectiveValue code.

**Architecture:** Create shared scoring config in ALN-TokenData submodule consumed by both backend (Node.js require) and frontend (Vite build-time import). Remove deprecated star-based detective scoring that was replaced by content-only detective mode.

**Tech Stack:** Node.js, ES6 modules, Jest, Vite, JSON config files

---

## Prerequisites

- All tests currently pass: `npm test` (ALNScanner), `npm test` (backend)
- Working directory: `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem`

## Branch Strategy

**Parallel feature branches across all affected repos:**

| Repo | Branch | What Changes |
|------|--------|--------------|
| ALN-Ecosystem (parent) | `feature/dry-scoring-config` | backend/ config loading |
| ALN-TokenData (submodule) | `feature/dry-scoring-config` | scoring-config.json |
| ALNScanner (submodule) | `feature/dry-scoring-config` | scoring.js, dataManager.js |

**Merge Order (when complete):**
1. Merge ALN-TokenData → push to remote
2. Update ALN-TokenData pointer in parent → commit
3. Merge ALNScanner → push to remote
4. Update ALNScanner pointer in parent → commit
5. Merge parent → push to remote

---

## Phase 1: Create Shared Scoring Configuration

### Task 1.1: Create Shared Scoring Config File

**Files:**
- Create: `ALN-TokenData/scoring-config.json`

**Step 1: Write the config file**

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
    "Business": 3,
    "Technical": 5,
    "UNKNOWN": 0
  }
}
```

**Step 2: Verify file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('ALN-TokenData/scoring-config.json'))"`
Expected: No output (success)

**Step 3: Commit**

```bash
git add ALN-TokenData/scoring-config.json
git commit -m "feat(scoring): create shared scoring config in token data submodule

Single source of truth for scoring values consumed by both backend and GM Scanner.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Add Backend Test for Loading Shared Config

**Files:**
- Create: `backend/tests/unit/services/scoring-config.test.js`

**Step 1: Write the failing test**

```javascript
/**
 * Scoring Config Tests
 * Validates shared config loading and parity with current values
 */

const path = require('path');
const fs = require('fs');

describe('Shared Scoring Config', () => {
  const configPath = path.join(__dirname, '../../../../ALN-TokenData/scoring-config.json');

  it('should load scoring config from ALN-TokenData submodule', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.version).toBe('1.0');
    expect(config.baseValues).toBeDefined();
    expect(config.typeMultipliers).toBeDefined();
  });

  it('should have all required base values (1-5 star ratings)', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.baseValues['1']).toBe(10000);
    expect(config.baseValues['2']).toBe(25000);
    expect(config.baseValues['3']).toBe(50000);
    expect(config.baseValues['4']).toBe(75000);
    expect(config.baseValues['5']).toBe(150000);
  });

  it('should have all required type multipliers', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(config.typeMultipliers['Personal']).toBe(1);
    expect(config.typeMultipliers['Business']).toBe(3);
    expect(config.typeMultipliers['Technical']).toBe(5);
    expect(config.typeMultipliers['UNKNOWN']).toBe(0);
  });

  it('should have UNKNOWN type multiplier as 0 (critical for security)', () => {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // CRITICAL: Unknown tokens must score 0 to prevent exploitation
    expect(config.typeMultipliers['UNKNOWN']).toBe(0);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd backend && npm test -- --testPathPattern="scoring-config" --verbose`
Expected: PASS (config file exists from Task 1.1)

**Step 3: Commit**

```bash
git add backend/tests/unit/services/scoring-config.test.js
git commit -m "test(backend): add tests for shared scoring config loading

Validates ALN-TokenData/scoring-config.json is loadable and has all required values.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Add Frontend Test for Shared Config Import

**Files:**
- Create: `ALNScanner/tests/unit/core/scoring-config.test.js`

**Step 1: Write the failing test**

```javascript
/**
 * @jest-environment jsdom
 */

import { describe, it, expect } from '@jest/globals';
import scoringConfig from '../../../data/scoring-config.json';

describe('Shared Scoring Config (Frontend)', () => {
  it('should import scoring config from data submodule', () => {
    expect(scoringConfig.version).toBe('1.0');
    expect(scoringConfig.baseValues).toBeDefined();
    expect(scoringConfig.typeMultipliers).toBeDefined();
  });

  it('should have identical values to SCORING_CONFIG in scoring.js', async () => {
    const { SCORING_CONFIG } = await import('../../../src/core/scoring.js');

    // Verify base values match
    Object.entries(scoringConfig.baseValues).forEach(([rating, value]) => {
      expect(SCORING_CONFIG.BASE_VALUES[parseInt(rating)]).toBe(value);
    });

    // Verify type multipliers match
    Object.entries(scoringConfig.typeMultipliers).forEach(([type, multiplier]) => {
      expect(SCORING_CONFIG.TYPE_MULTIPLIERS[type]).toBe(multiplier);
    });
  });

  it('should have UNKNOWN type multiplier as 0', () => {
    expect(scoringConfig.typeMultipliers['UNKNOWN']).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails (JSON import not configured)**

Run: `cd ALNScanner && npm test -- --testPathPattern="scoring-config" --verbose`
Expected: FAIL (JSON import needs Jest config)

**Step 3: Update Jest config to support JSON imports**

Edit `ALNScanner/jest.config.js`, add to moduleNameMapper:

```javascript
// Add to moduleNameMapper object
'^.+\\.json$': '<rootDir>/tests/helpers/json-transformer.js',
```

**Step 4: Create JSON transformer helper**

Create file `ALNScanner/tests/helpers/json-transformer.js`:

```javascript
/**
 * Jest transformer for JSON files
 * Allows importing JSON in tests same as Vite does at build time
 */
module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${sourceText};`,
    };
  },
};
```

**Step 5: Run test to verify it passes**

Run: `cd ALNScanner && npm test -- --testPathPattern="scoring-config" --verbose`
Expected: PASS

**Step 6: Commit**

```bash
git add ALNScanner/tests/unit/core/scoring-config.test.js ALNScanner/tests/helpers/json-transformer.js ALNScanner/jest.config.js
git commit -m "test(scanner): add tests for shared scoring config import

Validates frontend can import scoring-config.json and values match SCORING_CONFIG.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Update Backend to Load Shared Config

**Files:**
- Modify: `backend/src/config/index.js:70-83`

**Step 1: Write failing test for UNKNOWN type**

The existing `tokenService.test.js:117-121` tests unknown type defaults to 1.0. We need to verify it now returns 0 after loading shared config.

Run: `cd backend && npm test -- --testPathPattern="tokenService" --verbose`
Expected: PASS (current behavior returns 1.0 for unknown)

**Step 2: Modify config to load from shared file**

Edit `backend/src/config/index.js`, replace lines 70-83:

```javascript
// Load shared scoring config from ALN-TokenData submodule
const scoringConfigPath = path.join(__dirname, '../../../ALN-TokenData/scoring-config.json');
let sharedScoringConfig;
try {
  sharedScoringConfig = JSON.parse(fs.readFileSync(scoringConfigPath, 'utf8'));
  console.log('Loaded shared scoring config from:', scoringConfigPath);
} catch (e) {
  console.warn('Failed to load shared scoring config, using defaults:', e.message);
  sharedScoringConfig = {
    baseValues: { '1': 10000, '2': 25000, '3': 50000, '4': 75000, '5': 150000 },
    typeMultipliers: { Personal: 1, Business: 3, Technical: 5, UNKNOWN: 0 }
  };
}

// Game Configuration
game: {
  transactionHistoryLimit: parseInt(process.env.TRANSACTION_HISTORY_LIMIT || '1000', 10),
  recentTransactionsCount: parseInt(process.env.RECENT_TRANSACTIONS_COUNT || '10', 10),
  bonusThreshold: parseInt(process.env.BONUS_THRESHOLD || '5', 10),
  bonusMultiplier: parseFloat(process.env.BONUS_MULTIPLIER || '1.5'),

  // Value rating to points mapping (from shared config, env vars override)
  valueRatingMap: {
    1: parseInt(process.env.VALUE_RATING_1 || sharedScoringConfig.baseValues['1'], 10),
    2: parseInt(process.env.VALUE_RATING_2 || sharedScoringConfig.baseValues['2'], 10),
    3: parseInt(process.env.VALUE_RATING_3 || sharedScoringConfig.baseValues['3'], 10),
    4: parseInt(process.env.VALUE_RATING_4 || sharedScoringConfig.baseValues['4'], 10),
    5: parseInt(process.env.VALUE_RATING_5 || sharedScoringConfig.baseValues['5'], 10),
  },

  // Type multipliers (from shared config, env vars override)
  typeMultipliers: {
    personal: parseFloat(process.env.TYPE_MULT_PERSONAL || sharedScoringConfig.typeMultipliers['Personal']),
    business: parseFloat(process.env.TYPE_MULT_BUSINESS || sharedScoringConfig.typeMultipliers['Business']),
    technical: parseFloat(process.env.TYPE_MULT_TECHNICAL || sharedScoringConfig.typeMultipliers['Technical']),
    unknown: parseFloat(process.env.TYPE_MULT_UNKNOWN || sharedScoringConfig.typeMultipliers['UNKNOWN'] || 0),
  },
},
```

**Step 3: Add fs require at top of file**

Add after line 6 (`const dotenv = require('dotenv');`):

```javascript
const fs = require('fs');
```

**Step 4: Update tokenService to use unknown multiplier**

Edit `backend/src/services/tokenService.js:56-57`, change:

```javascript
const typeKey = (type || 'personal').toLowerCase();
const multiplier = config.game.typeMultipliers[typeKey] || config.game.typeMultipliers.unknown || 0;
```

**Step 5: Run all backend tests to verify no regressions**

Run: `cd backend && npm test`
Expected: PASS (all tests including tokenService)

**Step 6: Commit**

```bash
git add backend/src/config/index.js backend/src/services/tokenService.js
git commit -m "feat(backend): load scoring config from shared ALN-TokenData submodule

- Config loaded from ALN-TokenData/scoring-config.json at startup
- Env vars still override for flexibility
- Unknown type now correctly uses 0 multiplier (was defaulting to 1.0)

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 1.5: Update Frontend scoring.js to Import Shared Config

**Files:**
- Modify: `ALNScanner/src/core/scoring.js:15-29`

**Step 1: Verify current tests pass**

Run: `cd ALNScanner && npm test -- --testPathPattern="scoring|dataManager|standaloneDataManager" --verbose`
Expected: PASS

**Step 2: Update scoring.js to import shared config**

Replace lines 1-29 in `ALNScanner/src/core/scoring.js`:

```javascript
/**
 * Scoring Module - Shared Scoring Configuration and Utilities
 * ES6 Module Export
 *
 * Loads scoring configuration from shared ALN-TokenData submodule.
 * This ensures frontend and backend use identical scoring values.
 *
 * @module core/scoring
 */

// Import shared config from data submodule (Vite resolves at build time)
import sharedConfig from '../../data/scoring-config.json';

/**
 * Scoring configuration for Black Market mode
 * Maps value ratings and memory types to point values
 *
 * NOTE: Values loaded from ALN-TokenData/scoring-config.json
 */
export const SCORING_CONFIG = {
    BASE_VALUES: Object.fromEntries(
        Object.entries(sharedConfig.baseValues).map(([k, v]) => [parseInt(k), v])
    ),
    TYPE_MULTIPLIERS: { ...sharedConfig.typeMultipliers }
};
```

**Step 3: Run tests to verify no regressions**

Run: `cd ALNScanner && npm test -- --testPathPattern="scoring|dataManager|standaloneDataManager" --verbose`
Expected: PASS

**Step 4: Verify Vite build works**

Run: `cd ALNScanner && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add ALNScanner/src/core/scoring.js
git commit -m "feat(scanner): load scoring config from shared ALN-TokenData submodule

SCORING_CONFIG now imports from data/scoring-config.json at build time.
Ensures frontend/backend scoring parity from single source of truth.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Remove Deprecated detectiveValue

### Task 2.1: Remove detectiveValue from dataManager.js

**Files:**
- Modify: `ALNScanner/src/core/dataManager.js:407-414`
- Modify: `ALNScanner/tests/unit/core/dataManager.test.js:731`

**Step 1: Update test to not expect detectiveValue**

Edit `ALNScanner/tests/unit/core/dataManager.test.js`, find line ~731 and change:

```javascript
// BEFORE (line 731)
expect(result.detectiveValue).toBe(3);  // Just star rating

// AFTER (remove or change to)
// detectiveValue removed - detective mode has no scoring
expect(result.detectiveValue).toBeUndefined();
```

**Step 2: Run test to verify it fails**

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManager" --verbose`
Expected: FAIL (detectiveValue still returned)

**Step 3: Remove detectiveValue calculation from getGlobalStats**

Edit `ALNScanner/src/core/dataManager.js`, find `getGlobalStats()` method and remove detectiveValue:

```javascript
// In getGlobalStats() method, remove these lines (~407-414):
// DELETE: const detectiveValue = detectiveTransactions.reduce((sum, t) => {
// DELETE:   return sum + (t.valueRating || 0);
// DELETE: }, 0);
// DELETE: const totalValue = detectiveValue + Math.floor(blackMarketScore / 1000);

// Change return to:
return { total, teams, totalValue: Math.floor(blackMarketScore / 1000), avgValue, blackMarketScore };
```

**Step 4: Run test to verify it passes**

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManager" --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add ALNScanner/src/core/dataManager.js ALNScanner/tests/unit/core/dataManager.test.js
git commit -m "refactor(scanner): remove deprecated detectiveValue from dataManager

Detective mode is content organization, not scoring.
detectiveValue accumulation removed from getGlobalStats().

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Remove detectiveValue from standaloneDataManager.js

**Files:**
- Modify: `ALNScanner/src/core/standaloneDataManager.js:498-505`

**Step 1: Search for all detectiveValue references**

Run: `grep -n "detectiveValue" ALNScanner/src/core/standaloneDataManager.js`
Expected: Lines ~498-505

**Step 2: Update test if any exist for detectiveValue**

Run: `grep -n "detectiveValue" ALNScanner/tests/unit/core/standaloneDataManager.test.js`
Expected: No matches (or update if found)

**Step 3: Remove detectiveValue from getGlobalStats**

Edit `ALNScanner/src/core/standaloneDataManager.js`, find `getGlobalStats()` and remove detectiveValue:

```javascript
// In getGlobalStats() method, remove these lines (~498-505):
// DELETE: const detectiveValue = detectiveTransactions.reduce((sum, t) => {
// DELETE:   return sum + (t.token?.metadata?.rating || 0);
// DELETE: }, 0);
// DELETE: const totalValue = detectiveValue + Math.floor(blackMarketScore / 1000);

// Change return to:
return { total, teams, totalValue: Math.floor(blackMarketScore / 1000), avgValue, blackMarketScore };
```

**Step 4: Run tests to verify no regressions**

Run: `cd ALNScanner && npm test -- --testPathPattern="standaloneDataManager" --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add ALNScanner/src/core/standaloneDataManager.js
git commit -m "refactor(scanner): remove deprecated detectiveValue from standaloneDataManager

Parity with dataManager.js - detective mode has no scoring.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2.3: Verify No UI References to detectiveValue

**Files:**
- Search: `ALNScanner/src/ui/`

**Step 1: Search for detectiveValue in UI code**

Run: `grep -rn "detectiveValue" ALNScanner/src/`
Expected: No matches (after previous tasks)

**Step 2: If matches found, remove display logic**

If `uiManager.js` has references (e.g., star display), remove them:

```javascript
// REMOVE any code like:
// const starDisplay = score.detectiveValue > 0
//   ? `⭐ ${score.detectiveValue}`
//   : '';
```

**Step 3: Run all frontend tests**

Run: `cd ALNScanner && npm test`
Expected: PASS

**Step 4: Commit if changes made**

```bash
git add -A
git commit -m "refactor(scanner): remove detectiveValue display from UI

Completes removal of deprecated detective star scoring.

$(cat <<'EOF'
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Final Verification

### Task 3.1: Run Full Test Suite

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: PASS

**Step 2: Run all frontend tests**

Run: `cd ALNScanner && npm test`
Expected: PASS

**Step 3: Verify build works**

Run: `cd ALNScanner && npm run build`
Expected: Build succeeds

**Step 4: Document completion**

Update `docs/SCORING_LOGIC.md` if needed to reference shared config location.

---

## Summary

**Files Created:**
- `ALN-TokenData/scoring-config.json` - Single source of truth for scoring values
- `backend/tests/unit/services/scoring-config.test.js` - Backend config tests
- `ALNScanner/tests/unit/core/scoring-config.test.js` - Frontend config tests
- `ALNScanner/tests/helpers/json-transformer.js` - Jest JSON import support

**Files Modified:**
- `backend/src/config/index.js` - Load from shared config
- `backend/src/services/tokenService.js` - Use unknown multiplier from config
- `ALNScanner/src/core/scoring.js` - Import from shared config
- `ALNScanner/src/core/dataManager.js` - Remove detectiveValue
- `ALNScanner/src/core/standaloneDataManager.js` - Remove detectiveValue
- `ALNScanner/jest.config.js` - Add JSON transformer

**Deprecated Code Removed:**
- `detectiveValue` calculation in both DataManager implementations
- Star-based detective scoring (replaced by content-only mode)

**Key Benefit:**
Single source of truth for scoring values in `ALN-TokenData/scoring-config.json`, consumed by:
- Backend at startup via `fs.readFileSync()`
- Frontend at build time via Vite JSON import
