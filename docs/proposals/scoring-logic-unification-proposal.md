# Proposal: Unify Standalone and Networked Scoring Logic

**Status**: Draft
**Date**: 2025-10-28
**Author**: Systematic Debugging Session (Test 07c)
**Priority**: Medium (Technical Debt)

---

## Executive Summary

E2E testing revealed 4 bugs in ALNScanner's standalone scoring logic, indicating a fundamental architectural issue: scoring logic is duplicated between the backend orchestrator (networked mode) and ALNScanner StandaloneDataManager (standalone mode). This proposal recommends consolidating scoring logic into a single, shared module to eliminate divergence and reduce maintenance burden.

---

## Problem Statement

### Bugs Found During Test 07c Implementation

1. **Test Helper Anti-Pattern**: Test fallback calculation reimplemented scoring, masking production bugs
2. **Missing `transaction.points` Field**: Backend calculated points not passed to StandaloneDataManager
3. **Missing `TokenManager.getAllTokens()` Method**: Group completion logic couldn't validate group membership
4. **Save-Before-Score Bug**: `saveLocalSession()` called BEFORE `updateLocalScores()`, causing last token's score to never persist to localStorage

### Root Cause Analysis

**Architectural Issue**: Scoring logic exists in TWO independent implementations:

| Location | Used By | Responsibility |
|----------|---------|----------------|
| `backend/src/services/transactionService.js` | Networked mode | Authoritative scoring, group completion, admin adjustments |
| `ALNScanner/js/core/standaloneDataManager.js` | Standalone mode | Local-only scoring, group completion |

**Consequences**:
- Logic drift over time (4 bugs caught by parity tests)
- Duplicate code maintenance (2 scoring implementations to update)
- Contract violations possible (standalone may not match OpenAPI/AsyncAPI)
- Testing burden (must verify parity for all scoring scenarios)

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NETWORKED MODE                           │
│                                                              │
│  GM Scanner          WebSocket           Backend            │
│  ┌──────────┐        ┌──────┐        ┌──────────────┐      │
│  │ App.js   │───────▶│ WS   │───────▶│ transaction  │      │
│  │          │  scan  │      │  event │ Service.js   │      │
│  └──────────┘        └──────┘        └──────────────┘      │
│                                              │               │
│                                              ▼               │
│                                       ┌──────────────┐      │
│                                       │ SCORING      │      │
│                                       │ LOGIC (A)    │      │
│                                       └──────────────┘      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    STANDALONE MODE                           │
│                                                              │
│  GM Scanner                                                  │
│  ┌──────────┐        ┌──────────────────────┐              │
│  │ App.js   │───────▶│ StandaloneData       │              │
│  │          │  scan  │ Manager.js           │              │
│  └──────────┘        └──────────────────────┘              │
│                              │                               │
│                              ▼                               │
│                       ┌──────────────┐                      │
│                       │ SCORING      │                      │
│                       │ LOGIC (B)    │  ← DUPLICATE!        │
│                       └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Proposed Architecture

### Option 1: Extract Shared Scoring Module (Recommended)

Create a shared scoring module that both backend and ALNScanner can use:

```
┌─────────────────────────────────────────────────────────────┐
│                  SHARED SCORING MODULE                       │
│                                                              │
│  ALNScanner/js/core/scoringEngine.js                        │
│  backend/src/services/scoringEngine.js (symlink or copy)   │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │  calculateTokenValue(token)                │            │
│  │  checkGroupCompletion(team, group, tokens) │            │
│  │  applyGroupBonus(team, group, multiplier)  │            │
│  │  getTeamScore(team)                        │            │
│  └────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                          ▲             ▲
                          │             │
          ┌───────────────┘             └──────────────┐
          │                                            │
┌─────────────────────┐                   ┌────────────────────┐
│  StandaloneData     │                   │  Transaction       │
│  Manager.js         │                   │  Service.js        │
│  (Standalone Mode)  │                   │  (Networked Mode)  │
└─────────────────────┘                   └────────────────────┘
```

**Implementation**:
1. Extract scoring functions from `transactionService.js` into standalone `scoringEngine.js`
2. Make module work in both Node.js (backend) and browser (ALNScanner)
3. Update both `transactionService.js` and `standaloneDataManager.js` to import shared module
4. Run Test 07c to verify parity maintained

**Benefits**:
- ✅ Single source of truth for scoring logic
- ✅ Bug fixes automatically apply to both modes
- ✅ Guaranteed parity (tested by 07c)
- ✅ Contract alignment (both use same logic)

**Challenges**:
- 🔧 Module must work in Node.js + browser (use UMD pattern or separate builds)
- 🔧 Requires coordination across submodules (ALNScanner is git submodule)
- 🔧 Initial refactor effort (~4-6 hours)

---

### Option 2: Backend Scoring as Single Source of Truth

Make backend the ONLY place scoring happens, even in standalone mode:

```
┌─────────────────────────────────────────────────────────────┐
│                    STANDALONE MODE                           │
│                                                              │
│  GM Scanner                                                  │
│  ┌──────────┐        ┌──────────────────────┐              │
│  │ App.js   │───────▶│ StandaloneData       │              │
│  │          │  scan  │ Manager.js           │              │
│  └──────────┘        └──────────────────────┘              │
│                              │                               │
│                              ▼                               │
│                       ┌──────────────┐                      │
│                       │ Call Backend │                      │
│                       │ Scoring API  │                      │
│                       │ (Local)      │                      │
│                       └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
1. Bundle minimal backend scoring service with ALNScanner for GitHub Pages deployment
2. StandaloneDataManager calls backend scoring API (via localhost or embedded worker)
3. Backend becomes single source of truth in ALL scenarios

**Benefits**:
- ✅ Absolute single source of truth
- ✅ No logic duplication

**Challenges**:
- ❌ Requires bundling backend with frontend deployment (complex)
- ❌ Adds latency to standalone mode (API calls)
- ❌ Defeats purpose of "offline-first" standalone mode
- ❌ Large refactor, changes deployment model

**Verdict**: NOT RECOMMENDED (too complex, defeats offline-first design)

---

### Option 3: Contract-Driven Development (Status Quo+)

Keep duplicate implementations but enforce strict contract testing:

**Implementation**:
1. Expand Test 07c to cover ALL scoring scenarios (edge cases, all token types, all group sizes)
2. Add contract validation tests that compare standalone vs networked for randomized token sequences
3. Run parity tests in CI on every commit

**Benefits**:
- ✅ Minimal code changes (test-only)
- ✅ Catches divergence early (CI fails if parity breaks)

**Challenges**:
- ❌ Duplicate code still exists (maintenance burden)
- ❌ Bugs still possible (requires comprehensive test coverage)
- ❌ Doesn't address root cause (only mitigates)

**Verdict**: ACCEPTABLE SHORT-TERM (current approach), but tech debt remains

---

## Recommendation

**Phase 1 (Immediate)**: Option 3 (Status Quo+ with enhanced parity tests)
- Expand Test 07c with additional scoring scenarios
- Run in CI to catch future divergence
- Low risk, immediate value

**Phase 2 (Next Quarter)**: Option 1 (Shared Scoring Module)
- Extract scoring logic into shared module
- Update both implementations to use shared code
- Medium risk, high long-term value
- Estimated effort: 1-2 sprints

**Do NOT pursue**: Option 2 (Backend as single source) - too complex, defeats offline-first design

---

## Implementation Plan (Phase 2 - Shared Module)

### Step 1: Extract Scoring Engine (4 hours)

**Create**: `ALNScanner/js/core/scoringEngine.js`

```javascript
/**
 * Shared Scoring Engine
 * Used by both backend (transactionService) and frontend (standaloneDataManager)
 */

export class ScoringEngine {
    constructor(config = {}) {
        this.BASE_VALUES = config.BASE_VALUES || {
            1: 10000,
            2: 25000,
            3: 50000,
            4: 75000,
            5: 150000
        };

        this.TYPE_MULTIPLIERS = config.TYPE_MULTIPLIERS || {
            'Personal': 1,
            'Business': 3,
            'Technical': 5,
            'UNKNOWN': 0
        };
    }

    calculateTokenValue(token) {
        if (token.isUnknown) return 0;
        const baseValue = this.BASE_VALUES[token.valueRating] || 0;
        const multiplier = this.TYPE_MULTIPLIERS[token.memoryType] || 1;
        return baseValue * multiplier;
    }

    checkGroupCompletion(teamTransactions, groupName, allTokensInGroup) {
        // Extract logic from standaloneDataManager.js:133-205
        // Return: { complete: boolean, bonus: number }
    }

    calculateTeamScore(transactions, completedGroups) {
        // Extract logic from dataManager.js:425-483
        // Return: { baseScore, bonusScore, totalScore }
    }
}

// UMD export pattern (works in Node.js and browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoringEngine };
}
if (typeof window !== 'undefined') {
    window.ScoringEngine = ScoringEngine;
}
```

### Step 2: Update Backend to Use Shared Engine (2 hours)

**Modify**: `backend/src/services/transactionService.js`

```javascript
const { ScoringEngine } = require('../../ALNScanner/js/core/scoringEngine.js');

class TransactionService extends EventEmitter {
    constructor() {
        super();
        this.scoringEngine = new ScoringEngine();
        // ... rest of constructor
    }

    processTransaction(transaction) {
        // Replace inline scoring with:
        transaction.points = this.scoringEngine.calculateTokenValue(transaction);

        // Replace group completion with:
        const groupResult = this.scoringEngine.checkGroupCompletion(
            teamTransactions,
            transaction.group,
            allGroupTokens
        );

        if (groupResult.complete) {
            team.bonusPoints += groupResult.bonus;
        }
    }
}
```

### Step 3: Update StandaloneDataManager to Use Shared Engine (2 hours)

**Modify**: `ALNScanner/js/core/standaloneDataManager.js`

```javascript
class StandaloneDataManager {
    constructor() {
        this.scoringEngine = new window.ScoringEngine();
        // ... rest of constructor
    }

    updateLocalScores(transaction) {
        // Replace inline scoring with shared engine calls
        // (same pattern as backend)
    }
}
```

### Step 4: Run Test 07c to Verify Parity (1 hour)

```bash
npm test 07c
# Expected: All 10 tests pass (parity maintained)
```

### Step 5: Update Contracts (1 hour)

Update `backend/contracts/asyncapi.yaml` and `openapi.yaml` to document that scoring logic is shared between modes.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes during refactor | Use Test 07c as regression suite; all 10 tests must pass |
| Browser compatibility issues | Use UMD pattern, test in Chrome + Firefox + Safari |
| Submodule coordination complexity | Land changes in ALNScanner first, then update parent repo reference |
| Performance regression | Benchmark scoring before/after; ensure < 10ms per transaction |

---

## Success Metrics

- ✅ Test 07c passes (10/10 tests) after refactor
- ✅ No duplicate scoring code in codebase (grep confirms)
- ✅ Scoring logic < 200 lines (consolidated from ~400 lines total)
- ✅ Future scoring changes require 1 edit (not 2)

---

## Alternatives Considered

**Alternative A**: Keep duplicate logic, add extensive comments linking the two
- Rejected: Comments don't prevent drift; only code sharing does

**Alternative B**: Standalone mode doesn't calculate scores, just stores transactions
- Rejected: Defeats purpose of offline-first design; scores needed for UI display

**Alternative C**: Use WebAssembly module for scoring (shared binary)
- Rejected: Overkill for JavaScript; adds build complexity

---

## References

- Bug trace: `backend/TEST_07C_DEBUGGING_SESSION_HANDOFF.md`
- Test file: `backend/tests/e2e/flows/07c-gm-scanner-scoring-parity.test.js`
- Backend scoring: `backend/src/services/transactionService.js:128-217`
- Standalone scoring: `ALNScanner/js/core/standaloneDataManager.js:35-205`
- Contracts: `backend/contracts/openapi.yaml`, `backend/contracts/asyncapi.yaml`

---

## Conclusion

The 4 bugs found during Test 07c demonstrate that duplicate scoring logic is a maintenance liability. While immediate fixes have restored parity, long-term architectural alignment requires extracting scoring into a shared module. This proposal recommends a phased approach: expand parity tests immediately (Phase 1), then consolidate logic when capacity allows (Phase 2).

**Immediate action**: Mark as technical debt, prioritize in Q1 2026 planning.
