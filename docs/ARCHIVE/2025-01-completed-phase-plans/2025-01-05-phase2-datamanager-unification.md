# Phase 2: DataManager Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate ~400 LOC duplication between DataManager and StandaloneDataManager using Strategy Pattern, achieve API parity, and unify event naming.

**Architecture:** Extract shared utilities to `DataManagerUtils`, define `IStorageStrategy` interface implemented by `NetworkedStorage` and `LocalStorage` classes, compose into `UnifiedDataManager` that delegates storage operations while providing consistent public API.

**Tech Stack:** ES6 modules, Jest unit tests, Vite build system, EventTarget pattern

---

## Phase 2 Scope Summary

From `gm-scanner-architecture-refactoring.md`:

| Item | Description | Status |
|------|-------------|--------|
| 4a | Extract common interface | 🔲 |
| 4b | Implement strategy pattern | 🔲 |
| 4c | Create LocalStorage strategy | 🔲 |
| 4d | Migrate StandaloneDataManager → LocalStorage | 🔲 |
| 4e | Comprehensive testing | 🔲 |
| 5a | Add `getGameActivity()` to LocalStorage | 🔲 |
| 5b | Add `adjustTeamScore()` to unified interface | 🔲 |
| 5c | Add session lifecycle methods | 🔲 |
| Fix | Unify event names (`transaction:deleted`) | 🔲 |

---

## Task 1: Extract DataManagerUtils (100% Duplicate Methods)

**Files:**
- Create: `ALNScanner/src/core/dataManagerUtils.js`
- Create: `ALNScanner/tests/unit/core/dataManagerUtils.test.js`

### Step 1.1: Write failing test for isTokenScanned utility

```javascript
// ALNScanner/tests/unit/core/dataManagerUtils.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataManagerUtils } from '../../../src/core/dataManagerUtils.js';

describe('DataManagerUtils', () => {
  describe('isTokenScanned', () => {
    it('should return true if token is in Set', () => {
      const scannedTokens = new Set(['token1', 'token2']);
      expect(DataManagerUtils.isTokenScanned(scannedTokens, 'token1')).toBe(true);
    });

    it('should return false if token is not in Set', () => {
      const scannedTokens = new Set(['token1']);
      expect(DataManagerUtils.isTokenScanned(scannedTokens, 'token2')).toBe(false);
    });

    it('should return false for empty Set', () => {
      const scannedTokens = new Set();
      expect(DataManagerUtils.isTokenScanned(scannedTokens, 'token1')).toBe(false);
    });
  });
});
```

### Step 1.2: Run test to verify it fails

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: FAIL with "Cannot find module '../../../src/core/dataManagerUtils.js'"

### Step 1.3: Write minimal implementation

```javascript
// ALNScanner/src/core/dataManagerUtils.js
/**
 * DataManagerUtils - Shared utilities for data management
 * Extracted from DataManager and StandaloneDataManager to eliminate duplication
 *
 * @module core/dataManagerUtils
 */

export class DataManagerUtils {
  /**
   * Check if token has been scanned (duplicate detection)
   * @param {Set} scannedTokens - Set of scanned token IDs
   * @param {string} tokenId - Token ID to check
   * @returns {boolean} True if token already scanned
   */
  static isTokenScanned(scannedTokens, tokenId) {
    return scannedTokens.has(tokenId);
  }
}
```

### Step 1.4: Run test to verify it passes

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: PASS

### Step 1.5: Add markTokenAsScanned test

```javascript
  describe('markTokenAsScanned', () => {
    it('should add token to Set', () => {
      const scannedTokens = new Set();
      DataManagerUtils.markTokenAsScanned(scannedTokens, 'token1');
      expect(scannedTokens.has('token1')).toBe(true);
    });

    it('should not duplicate if already present', () => {
      const scannedTokens = new Set(['token1']);
      DataManagerUtils.markTokenAsScanned(scannedTokens, 'token1');
      expect(scannedTokens.size).toBe(1);
    });
  });
```

### Step 1.6: Run test to verify it fails

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: FAIL with "markTokenAsScanned is not a function"

### Step 1.7: Implement markTokenAsScanned

```javascript
  /**
   * Mark token as scanned (for duplicate detection)
   * @param {Set} scannedTokens - Set of scanned token IDs
   * @param {string} tokenId - Token ID to mark
   */
  static markTokenAsScanned(scannedTokens, tokenId) {
    scannedTokens.add(tokenId);
  }
```

### Step 1.8: Run test to verify it passes

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: PASS

### Step 1.9: Add unmarkTokenAsScanned test

```javascript
  describe('unmarkTokenAsScanned', () => {
    it('should remove token from Set', () => {
      const scannedTokens = new Set(['token1', 'token2']);
      const result = DataManagerUtils.unmarkTokenAsScanned(scannedTokens, 'token1');
      expect(result).toBe(true);
      expect(scannedTokens.has('token1')).toBe(false);
      expect(scannedTokens.has('token2')).toBe(true);
    });

    it('should return false if token not present', () => {
      const scannedTokens = new Set(['token1']);
      const result = DataManagerUtils.unmarkTokenAsScanned(scannedTokens, 'token2');
      expect(result).toBe(false);
    });
  });
```

### Step 1.10: Implement unmarkTokenAsScanned

```javascript
  /**
   * Unmark token as scanned (allow re-scanning after delete)
   * @param {Set} scannedTokens - Set of scanned token IDs
   * @param {string} tokenId - Token ID to unmark
   * @returns {boolean} True if token was removed, false if not present
   */
  static unmarkTokenAsScanned(scannedTokens, tokenId) {
    return scannedTokens.delete(tokenId);
  }
```

### Step 1.11: Run all utils tests

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: All PASS

### Step 1.12: Commit

```bash
cd ALNScanner && git add src/core/dataManagerUtils.js tests/unit/core/dataManagerUtils.test.js && git commit -m "$(cat <<'EOF'
feat(core): add DataManagerUtils with duplicate detection utilities

Extract 100% duplicate methods from DataManager and StandaloneDataManager:
- isTokenScanned: Check if token in Set
- markTokenAsScanned: Add token to Set
- unmarkTokenAsScanned: Remove token from Set (for re-scanning after delete)

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add calculateGlobalStats to DataManagerUtils

**Files:**
- Modify: `ALNScanner/src/core/dataManagerUtils.js`
- Modify: `ALNScanner/tests/unit/core/dataManagerUtils.test.js`

### Step 2.1: Write failing test for calculateGlobalStats

```javascript
import { calculateTokenValue } from '../../../src/core/scoring.js';

describe('calculateGlobalStats', () => {
  const mockCalculateTokenValue = (tx) => calculateTokenValue(tx);

  it('should calculate stats for empty transactions', () => {
    const result = DataManagerUtils.calculateGlobalStats([], mockCalculateTokenValue);
    expect(result).toEqual({
      total: 0,
      teams: 0,
      totalValue: 0,
      avgValue: 0,
      blackMarketScore: 0
    });
  });

  it('should count unique teams', () => {
    const transactions = [
      { teamId: '001', mode: 'blackmarket', isUnknown: false, valueRating: 1, memoryType: 'Personal' },
      { teamId: '001', mode: 'blackmarket', isUnknown: false, valueRating: 2, memoryType: 'Personal' },
      { teamId: '002', mode: 'blackmarket', isUnknown: false, valueRating: 3, memoryType: 'Personal' }
    ];
    const result = DataManagerUtils.calculateGlobalStats(transactions, mockCalculateTokenValue);
    expect(result.teams).toBe(2);
    expect(result.total).toBe(3);
  });

  it('should exclude unknown tokens from scoring', () => {
    const transactions = [
      { teamId: '001', mode: 'blackmarket', isUnknown: true, valueRating: 5, memoryType: 'Technical' },
      { teamId: '001', mode: 'blackmarket', isUnknown: false, valueRating: 1, memoryType: 'Personal' }
    ];
    const result = DataManagerUtils.calculateGlobalStats(transactions, mockCalculateTokenValue);
    expect(result.blackMarketScore).toBe(10000); // Only the 1-star Personal
  });

  it('should only score blackmarket mode transactions', () => {
    const transactions = [
      { teamId: '001', mode: 'detective', isUnknown: false, valueRating: 5, memoryType: 'Technical' },
      { teamId: '001', mode: 'blackmarket', isUnknown: false, valueRating: 1, memoryType: 'Personal' }
    ];
    const result = DataManagerUtils.calculateGlobalStats(transactions, mockCalculateTokenValue);
    expect(result.blackMarketScore).toBe(10000); // Only blackmarket counts
  });
});
```

### Step 2.2: Run test to verify it fails

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: FAIL with "calculateGlobalStats is not a function"

### Step 2.3: Implement calculateGlobalStats

```javascript
  /**
   * Calculate global statistics from transactions
   * @param {Array} transactions - Array of transaction objects
   * @param {Function} calculateTokenValue - Function to calculate token value
   * @returns {Object} Global stats object
   */
  static calculateGlobalStats(transactions, calculateTokenValue) {
    const total = transactions.length;
    const teams = [...new Set(transactions.map(t => t.teamId))].length;
    const known = transactions.filter(t => !t.isUnknown);

    const blackMarketTransactions = known.filter(t => t.mode === 'blackmarket');

    const blackMarketScore = blackMarketTransactions.reduce((sum, t) => {
      return sum + calculateTokenValue(t);
    }, 0);

    // totalValue derived from blackMarketScore only - detective mode has no scoring
    const totalValue = Math.floor(blackMarketScore / 1000);
    const avgValue = known.length > 0 ? parseFloat((totalValue / known.length).toFixed(1)) : 0;

    return { total, teams, totalValue, avgValue, blackMarketScore };
  }
```

### Step 2.4: Run test to verify it passes

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManagerUtils" --verbose`
Expected: PASS

### Step 2.5: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
feat(core): add calculateGlobalStats to DataManagerUtils

Extract global statistics calculation (90% duplicate code):
- Count total transactions and unique teams
- Calculate blackMarketScore from valid transactions
- Exclude unknown tokens and non-blackmarket modes

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Define IStorageStrategy Interface

**Files:**
- Create: `ALNScanner/src/core/storage/IStorageStrategy.js`
- Create: `ALNScanner/tests/unit/core/storage/IStorageStrategy.test.js`

### Step 3.1: Write interface definition with JSDoc contracts

```javascript
// ALNScanner/src/core/storage/IStorageStrategy.js
/**
 * IStorageStrategy - Interface for data storage strategies
 * Implemented by NetworkedStorage and LocalStorage
 *
 * @interface IStorageStrategy
 */

/**
 * @typedef {Object} TransactionResult
 * @property {boolean} success - Whether operation succeeded
 * @property {Object} [transaction] - The processed transaction
 * @property {Object} [teamScore] - Updated team score
 * @property {Object} [groupBonusInfo] - Group completion info if applicable
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} SessionInfo
 * @property {string} sessionId - Session identifier
 * @property {string} startTime - ISO timestamp
 * @property {string} [status] - Session status (active/paused/ended)
 */

/**
 * Storage strategy interface - defines contract for data persistence
 *
 * Implementations:
 * - NetworkedStorage: WebSocket communication with backend
 * - LocalStorage: Browser localStorage persistence
 */
export class IStorageStrategy {
  /**
   * Initialize the storage strategy
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('IStorageStrategy.initialize() must be implemented');
  }

  /**
   * Add a transaction
   * @param {Object} transaction - Transaction data
   * @returns {Promise<TransactionResult>}
   */
  async addTransaction(transaction) {
    throw new Error('IStorageStrategy.addTransaction() must be implemented');
  }

  /**
   * Remove a transaction
   * @param {string} transactionId - Transaction ID to remove
   * @returns {Promise<TransactionResult>}
   */
  async removeTransaction(transactionId) {
    throw new Error('IStorageStrategy.removeTransaction() must be implemented');
  }

  /**
   * Get all transactions
   * @returns {Array} Array of transactions
   */
  getTransactions() {
    throw new Error('IStorageStrategy.getTransactions() must be implemented');
  }

  /**
   * Get team scores
   * @returns {Array} Array of team score objects
   */
  getTeamScores() {
    throw new Error('IStorageStrategy.getTeamScores() must be implemented');
  }

  /**
   * Adjust team score (admin operation)
   * @param {string} teamId - Team identifier
   * @param {number} delta - Score adjustment amount
   * @param {string} reason - Reason for adjustment
   * @returns {Promise<TransactionResult>}
   */
  async adjustTeamScore(teamId, delta, reason) {
    throw new Error('IStorageStrategy.adjustTeamScore() must be implemented');
  }

  /**
   * Get game activity (player discoveries + GM transactions)
   * @returns {Object} { tokens: Array, stats: Object }
   */
  getGameActivity() {
    throw new Error('IStorageStrategy.getGameActivity() must be implemented');
  }

  /**
   * Create a new session
   * @param {string} name - Session name
   * @param {Array} teams - Initial teams array
   * @returns {Promise<SessionInfo>}
   */
  async createSession(name, teams) {
    throw new Error('IStorageStrategy.createSession() must be implemented');
  }

  /**
   * End the current session
   * @returns {Promise<void>}
   */
  async endSession() {
    throw new Error('IStorageStrategy.endSession() must be implemented');
  }

  /**
   * Get current session info
   * @returns {SessionInfo|null}
   */
  getCurrentSession() {
    throw new Error('IStorageStrategy.getCurrentSession() must be implemented');
  }

  /**
   * Check if storage is ready/connected
   * @returns {boolean}
   */
  isReady() {
    throw new Error('IStorageStrategy.isReady() must be implemented');
  }

  /**
   * Dispose of resources
   */
  dispose() {
    // Optional cleanup - default no-op
  }
}
```

### Step 3.2: Write test verifying interface contract

```javascript
// ALNScanner/tests/unit/core/storage/IStorageStrategy.test.js
import { describe, it, expect } from '@jest/globals';
import { IStorageStrategy } from '../../../../src/core/storage/IStorageStrategy.js';

describe('IStorageStrategy Interface', () => {
  it('should throw on initialize() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.initialize()).rejects.toThrow('must be implemented');
  });

  it('should throw on addTransaction() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.addTransaction({})).rejects.toThrow('must be implemented');
  });

  it('should throw on removeTransaction() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.removeTransaction('id')).rejects.toThrow('must be implemented');
  });

  it('should throw on getTransactions() if not implemented', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.getTransactions()).toThrow('must be implemented');
  });

  it('should throw on getTeamScores() if not implemented', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.getTeamScores()).toThrow('must be implemented');
  });

  it('should throw on adjustTeamScore() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.adjustTeamScore('001', 100, 'test')).rejects.toThrow('must be implemented');
  });

  it('should throw on getGameActivity() if not implemented', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.getGameActivity()).toThrow('must be implemented');
  });

  it('should throw on createSession() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.createSession('Test', [])).rejects.toThrow('must be implemented');
  });

  it('should throw on endSession() if not implemented', async () => {
    const strategy = new IStorageStrategy();
    await expect(strategy.endSession()).rejects.toThrow('must be implemented');
  });

  it('should throw on getCurrentSession() if not implemented', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.getCurrentSession()).toThrow('must be implemented');
  });

  it('should throw on isReady() if not implemented', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.isReady()).toThrow('must be implemented');
  });

  it('should not throw on dispose() (optional)', () => {
    const strategy = new IStorageStrategy();
    expect(() => strategy.dispose()).not.toThrow();
  });
});
```

### Step 3.3: Create directory and run test

Run: `mkdir -p ALNScanner/src/core/storage ALNScanner/tests/unit/core/storage`
Run: `cd ALNScanner && npm test -- --testPathPattern="IStorageStrategy" --verbose`
Expected: All PASS (interface methods throw as expected)

### Step 3.4: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
feat(core): define IStorageStrategy interface

Define contract for storage strategies:
- initialize/dispose lifecycle
- addTransaction/removeTransaction
- getTransactions/getTeamScores
- adjustTeamScore (admin operation)
- getGameActivity (unified view)
- createSession/endSession/getCurrentSession lifecycle
- isReady() connection status

Implementations will be NetworkedStorage and LocalStorage.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement LocalStorage Strategy

**Files:**
- Create: `ALNScanner/src/core/storage/LocalStorage.js`
- Create: `ALNScanner/tests/unit/core/storage/LocalStorage.test.js`

### Step 4.1: Write failing test for LocalStorage basic operations

```javascript
// ALNScanner/tests/unit/core/storage/LocalStorage.test.js
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LocalStorage } from '../../../../src/core/storage/LocalStorage.js';

describe('LocalStorage Strategy', () => {
  let storage;
  let mockTokenManager;
  let mockDebug;

  beforeEach(() => {
    localStorage.clear();

    mockTokenManager = {
      getAllTokens: jest.fn(() => []),
      findToken: jest.fn()
    };

    mockDebug = {
      log: jest.fn()
    };

    storage = new LocalStorage({
      tokenManager: mockTokenManager,
      debug: mockDebug
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should create instance with dependencies', () => {
      expect(storage.tokenManager).toBe(mockTokenManager);
      expect(storage.debug).toBe(mockDebug);
    });

    it('should initialize empty session data', () => {
      expect(storage.sessionData).toBeDefined();
      expect(storage.sessionData.transactions).toEqual([]);
      expect(storage.sessionData.teams).toEqual({});
    });
  });

  describe('isReady', () => {
    it('should return true (localStorage always available)', () => {
      expect(storage.isReady()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should resolve immediately', async () => {
      await expect(storage.initialize()).resolves.toBeUndefined();
    });
  });
});
```

### Step 4.2: Run test to verify it fails

Run: `cd ALNScanner && npm test -- --testPathPattern="LocalStorage.test" --verbose`
Expected: FAIL with "Cannot find module"

### Step 4.3: Implement LocalStorage skeleton

```javascript
// ALNScanner/src/core/storage/LocalStorage.js
/**
 * LocalStorage Strategy - Browser localStorage persistence
 * Implements IStorageStrategy for standalone mode operation
 *
 * @module core/storage/LocalStorage
 */

import { IStorageStrategy } from './IStorageStrategy.js';
import {
  SCORING_CONFIG,
  parseGroupInfo,
  calculateTokenValue
} from '../scoring.js';

export class LocalStorage extends IStorageStrategy {
  /**
   * Create LocalStorage instance
   * @param {Object} options - Dependencies
   * @param {Object} options.tokenManager - TokenManager instance
   * @param {Object} [options.debug] - Debug instance
   */
  constructor({ tokenManager, debug } = {}) {
    super();

    this.tokenManager = tokenManager;
    this.debug = debug;
    this.SCORING_CONFIG = SCORING_CONFIG;

    // Initialize session data
    this.sessionData = {
      sessionId: this._generateSessionId(),
      startTime: new Date().toISOString(),
      transactions: [],
      teams: {},
      mode: 'standalone'
    };

    // Track scanned tokens for duplicate detection
    this.scannedTokens = new Set();

    // Player scans (for getGameActivity parity)
    this.playerScans = [];
  }

  /**
   * Generate unique local session ID
   * @private
   */
  _generateSessionId() {
    return `LOCAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if storage is ready
   * @returns {boolean} Always true for localStorage
   */
  isReady() {
    return true;
  }

  /**
   * Initialize storage (load from localStorage)
   * @returns {Promise<void>}
   */
  async initialize() {
    this._loadSession();
  }

  /**
   * Load session from localStorage
   * @private
   */
  _loadSession() {
    const saved = localStorage.getItem('standaloneSession');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sessionDate = new Date(parsed.startTime).toDateString();
        const today = new Date().toDateString();

        if (sessionDate === today) {
          this.sessionData = parsed;
          this._repopulateScannedTokens();
          this.debug?.log(`Loaded session: ${parsed.sessionId}`);
        }
      } catch (e) {
        this.debug?.log('Failed to load session', true);
      }
    }
  }

  /**
   * Repopulate scannedTokens Set from loaded transactions
   * @private
   */
  _repopulateScannedTokens() {
    this.scannedTokens.clear();
    this.sessionData.transactions.forEach(tx => {
      const tokenId = tx.tokenId || tx.rfid;
      if (tokenId) {
        this.scannedTokens.add(tokenId);
      }
    });
  }

  /**
   * Save session to localStorage
   * @private
   */
  _saveSession() {
    localStorage.setItem('standaloneSession', JSON.stringify(this.sessionData));
  }

  // Implement remaining interface methods...
  // (Will be added in subsequent steps)

  getTransactions() {
    return this.sessionData.transactions;
  }

  getTeamScores() {
    return Object.values(this.sessionData.teams)
      .map(team => ({
        teamId: team.teamId,
        score: team.score,
        baseScore: team.baseScore,
        bonusScore: team.bonusPoints,
        tokenCount: team.tokensScanned,
        completedGroups: team.completedGroups?.length || 0,
        isFromBackend: false
      }))
      .sort((a, b) => b.score - a.score);
  }

  getCurrentSession() {
    return {
      sessionId: this.sessionData.sessionId,
      startTime: this.sessionData.startTime,
      status: 'active'
    };
  }

  async createSession(name, teams) {
    this.sessionData = {
      sessionId: this._generateSessionId(),
      name: name,
      startTime: new Date().toISOString(),
      transactions: [],
      teams: {},
      mode: 'standalone'
    };
    this.scannedTokens.clear();
    this._saveSession();

    return this.getCurrentSession();
  }

  async endSession() {
    this._saveSession();
    // Optionally clear for next session
  }

  async addTransaction(transaction) {
    throw new Error('addTransaction not yet implemented');
  }

  async removeTransaction(transactionId) {
    throw new Error('removeTransaction not yet implemented');
  }

  async adjustTeamScore(teamId, delta, reason) {
    throw new Error('adjustTeamScore not yet implemented');
  }

  getGameActivity() {
    throw new Error('getGameActivity not yet implemented');
  }
}
```

### Step 4.4: Run test to verify skeleton passes

Run: `cd ALNScanner && npm test -- --testPathPattern="LocalStorage.test" --verbose`
Expected: PASS for constructor, isReady, initialize tests

### Step 4.5: Add addTransaction tests

```javascript
  describe('addTransaction', () => {
    it('should add transaction to session', async () => {
      const tx = {
        id: 'tx-1',
        tokenId: 'token1',
        teamId: '001',
        mode: 'blackmarket',
        points: 10000,
        valueRating: 1,
        memoryType: 'Personal',
        timestamp: new Date().toISOString()
      };

      const result = await storage.addTransaction(tx);

      expect(result.success).toBe(true);
      expect(storage.getTransactions()).toHaveLength(1);
      expect(storage.getTransactions()[0].tokenId).toBe('token1');
    });

    it('should update team score for blackmarket transactions', async () => {
      const tx = {
        id: 'tx-1',
        tokenId: 'token1',
        teamId: '001',
        mode: 'blackmarket',
        points: 50000, // 3-star Personal = $50,000
        valueRating: 3,
        memoryType: 'Personal',
        timestamp: new Date().toISOString()
      };

      await storage.addTransaction(tx);

      const scores = storage.getTeamScores();
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(50000);
    });

    it('should mark token as scanned', async () => {
      const tx = {
        id: 'tx-1',
        tokenId: 'token1',
        teamId: '001',
        mode: 'blackmarket',
        points: 10000,
        timestamp: new Date().toISOString()
      };

      await storage.addTransaction(tx);

      expect(storage.scannedTokens.has('token1')).toBe(true);
    });

    it('should persist to localStorage', async () => {
      const tx = {
        id: 'tx-1',
        tokenId: 'token1',
        teamId: '001',
        mode: 'blackmarket',
        points: 10000,
        timestamp: new Date().toISOString()
      };

      await storage.addTransaction(tx);

      const saved = JSON.parse(localStorage.getItem('standaloneSession'));
      expect(saved.transactions).toHaveLength(1);
    });
  });
```

### Step 4.6: Implement addTransaction

```javascript
  /**
   * Add transaction to local storage
   * @param {Object} transaction - Transaction data
   * @returns {Promise<TransactionResult>}
   */
  async addTransaction(transaction) {
    // Add to transactions array
    this.sessionData.transactions.push(transaction);

    // Mark token as scanned
    const tokenId = transaction.tokenId || transaction.rfid;
    if (tokenId) {
      this.scannedTokens.add(tokenId);
    }

    // Update team scores
    this._updateTeamScore(transaction);

    // Persist
    this._saveSession();

    return {
      success: true,
      transaction,
      teamScore: this.sessionData.teams[transaction.teamId]
    };
  }

  /**
   * Update team score from transaction
   * @private
   */
  _updateTeamScore(transaction) {
    const teamId = transaction.teamId;

    if (!this.sessionData.teams[teamId]) {
      this.sessionData.teams[teamId] = {
        teamId,
        score: 0,
        baseScore: 0,
        bonusPoints: 0,
        tokensScanned: 0,
        completedGroups: [],
        lastScanTime: null
      };
    }

    const team = this.sessionData.teams[teamId];

    // Only score blackmarket mode
    if (transaction.mode === 'blackmarket' && transaction.points) {
      team.baseScore += transaction.points;
      team.score = team.baseScore + team.bonusPoints;
    }

    team.tokensScanned++;
    team.lastScanTime = transaction.timestamp;

    // Check group completion
    if (transaction.mode === 'blackmarket' && transaction.group) {
      this._checkGroupCompletion(teamId, transaction.group);
    }
  }

  /**
   * Check and award group completion bonus
   * @private
   */
  _checkGroupCompletion(teamId, groupName) {
    const groupInfo = parseGroupInfo(groupName);
    if (groupInfo.multiplier <= 1) return;

    const team = this.sessionData.teams[teamId];
    if (team.completedGroups.includes(groupInfo.name)) return;

    // Get all team transactions for this group
    const teamTxs = this.sessionData.transactions.filter(tx =>
      tx.teamId === teamId && tx.mode === 'blackmarket'
    );

    const groupTxs = teamTxs.filter(tx => {
      const txGroupInfo = parseGroupInfo(tx.group);
      return txGroupInfo.name === groupInfo.name;
    });

    // Check if all group tokens collected (requires tokenManager)
    if (!this.tokenManager) return;

    const allTokens = this.tokenManager.getAllTokens();
    const groupTokens = allTokens.filter(token => {
      if (!token.SF_Group) return false;
      const tokenGroupInfo = parseGroupInfo(token.SF_Group);
      return tokenGroupInfo.name === groupInfo.name;
    });

    const scannedIds = groupTxs.map(tx => tx.tokenId);
    const allGroupIds = groupTokens.map(t => t.SF_RFID);
    const allScanned = allGroupIds.every(id => scannedIds.includes(id));

    if (allScanned && groupTokens.length > 0) {
      const groupBaseScore = groupTxs.reduce((sum, tx) => sum + (tx.points || 0), 0);
      const bonus = (groupInfo.multiplier - 1) * groupBaseScore;

      team.bonusPoints += bonus;
      team.score = team.baseScore + team.bonusPoints;
      team.completedGroups.push(groupInfo.name);

      this.debug?.log(`Group completed: ${groupInfo.name}, bonus: ${bonus}`);
    }
  }
```

### Step 4.7: Run addTransaction tests

Run: `cd ALNScanner && npm test -- --testPathPattern="LocalStorage.test" --verbose`
Expected: All addTransaction tests PASS

### Step 4.8: Add removeTransaction tests and implementation

```javascript
  describe('removeTransaction', () => {
    it('should remove transaction and recalculate scores', async () => {
      // Add two transactions
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 10000, timestamp: new Date().toISOString()
      });
      await storage.addTransaction({
        id: 'tx-2', tokenId: 'token2', teamId: '001',
        mode: 'blackmarket', points: 25000, timestamp: new Date().toISOString()
      });

      expect(storage.getTeamScores()[0].score).toBe(35000);

      // Remove first
      const result = await storage.removeTransaction('tx-1');

      expect(result.success).toBe(true);
      expect(storage.getTransactions()).toHaveLength(1);
      expect(storage.getTeamScores()[0].score).toBe(25000);
    });

    it('should return error for non-existent transaction', async () => {
      const result = await storage.removeTransaction('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow token re-scanning after removal', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 10000, timestamp: new Date().toISOString()
      });

      expect(storage.scannedTokens.has('token1')).toBe(true);

      await storage.removeTransaction('tx-1');

      expect(storage.scannedTokens.has('token1')).toBe(false);
    });
  });
```

Implementation:

```javascript
  /**
   * Remove transaction and recalculate team scores
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<TransactionResult>}
   */
  async removeTransaction(transactionId) {
    const index = this.sessionData.transactions.findIndex(tx => tx.id === transactionId);

    if (index === -1) {
      return {
        success: false,
        error: `Transaction not found: ${transactionId}`
      };
    }

    const removedTx = this.sessionData.transactions.splice(index, 1)[0];
    const tokenId = removedTx.tokenId || removedTx.rfid;
    const teamId = removedTx.teamId;

    // Allow re-scanning if no other transactions have this token
    const tokenStillExists = this.sessionData.transactions.some(
      tx => (tx.tokenId || tx.rfid) === tokenId
    );
    if (!tokenStillExists && tokenId) {
      this.scannedTokens.delete(tokenId);
    }

    // Recalculate team scores from scratch
    if (teamId && this.sessionData.teams[teamId]) {
      this._recalculateTeamScores(teamId);
    }

    this._saveSession();

    return {
      success: true,
      transaction: removedTx
    };
  }

  /**
   * Recalculate team scores from remaining transactions
   * @private
   */
  _recalculateTeamScores(teamId) {
    const team = this.sessionData.teams[teamId];

    // Reset
    team.baseScore = 0;
    team.bonusPoints = 0;
    team.score = 0;
    team.tokensScanned = 0;
    team.completedGroups = [];

    // Replay transactions
    this.sessionData.transactions
      .filter(tx => tx.teamId === teamId)
      .forEach(tx => this._updateTeamScore(tx));
  }
```

### Step 4.9: Add adjustTeamScore tests and implementation

```javascript
  describe('adjustTeamScore', () => {
    it('should adjust existing team score', async () => {
      // Create team via transaction
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 10000, timestamp: new Date().toISOString()
      });

      const result = await storage.adjustTeamScore('001', 5000, 'Bonus award');

      expect(result.success).toBe(true);
      expect(storage.getTeamScores()[0].score).toBe(15000);
    });

    it('should track adjustment in audit trail', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 10000, timestamp: new Date().toISOString()
      });

      await storage.adjustTeamScore('001', -2000, 'Penalty');

      const team = storage.sessionData.teams['001'];
      expect(team.adminAdjustments).toHaveLength(1);
      expect(team.adminAdjustments[0].delta).toBe(-2000);
      expect(team.adminAdjustments[0].reason).toBe('Penalty');
    });

    it('should fail for non-existent team', async () => {
      const result = await storage.adjustTeamScore('non-existent', 100, 'test');
      expect(result.success).toBe(false);
    });
  });
```

Implementation:

```javascript
  /**
   * Adjust team score (admin operation)
   * @param {string} teamId - Team identifier
   * @param {number} delta - Score adjustment
   * @param {string} reason - Reason for adjustment
   * @returns {Promise<TransactionResult>}
   */
  async adjustTeamScore(teamId, delta, reason = 'Manual adjustment') {
    if (!this.sessionData.teams[teamId]) {
      return {
        success: false,
        error: `Team not found: ${teamId}`
      };
    }

    const team = this.sessionData.teams[teamId];

    if (!team.adminAdjustments) {
      team.adminAdjustments = [];
    }

    const adjustment = {
      delta: parseInt(delta),
      reason,
      timestamp: new Date().toISOString()
    };

    team.adminAdjustments.push(adjustment);
    team.score += adjustment.delta;

    this._saveSession();

    return {
      success: true,
      teamScore: { ...team }
    };
  }
```

### Step 4.10: Add getGameActivity tests and implementation

This is the **missing method** from StandaloneDataManager that we need to add for parity.

```javascript
  describe('getGameActivity', () => {
    it('should return empty activity for new session', () => {
      const activity = storage.getGameActivity();

      expect(activity.tokens).toEqual([]);
      expect(activity.stats.totalTokens).toBe(0);
    });

    it('should include GM transactions as claims', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 50000, valueRating: 3, memoryType: 'Personal',
        timestamp: '2025-01-05T10:00:00Z'
      });

      const activity = storage.getGameActivity();

      expect(activity.tokens).toHaveLength(1);
      expect(activity.tokens[0].tokenId).toBe('token1');
      expect(activity.tokens[0].status).toBe('claimed');
      expect(activity.tokens[0].events[0].type).toBe('claim');
      expect(activity.tokens[0].events[0].teamId).toBe('001');
    });

    it('should calculate stats correctly', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 50000, timestamp: new Date().toISOString()
      });
      await storage.addTransaction({
        id: 'tx-2', tokenId: 'token2', teamId: '002',
        mode: 'blackmarket', points: 75000, timestamp: new Date().toISOString()
      });

      const activity = storage.getGameActivity();

      expect(activity.stats.totalTokens).toBe(2);
      expect(activity.stats.claimed).toBe(2);
      expect(activity.stats.available).toBe(0);
    });
  });
```

Implementation:

```javascript
  /**
   * Get unified game activity
   * Matches DataManager.getGameActivity() API for parity
   *
   * Note: LocalStorage doesn't have player scans (no backend to receive them)
   * but we maintain the same structure for API compatibility.
   *
   * @returns {Object} { tokens: Array, stats: Object }
   */
  getGameActivity() {
    const tokenMap = new Map();

    // Process player scans (empty in standalone, but maintain structure)
    this.playerScans.forEach(scan => {
      if (!tokenMap.has(scan.tokenId)) {
        tokenMap.set(scan.tokenId, {
          tokenId: scan.tokenId,
          tokenData: scan.tokenData || {},
          potentialValue: calculateTokenValue({
            valueRating: scan.tokenData?.SF_ValueRating,
            memoryType: scan.tokenData?.SF_MemoryType
          }),
          events: [{
            type: 'discovery',
            timestamp: scan.timestamp,
            deviceId: scan.deviceId
          }],
          status: 'available',
          discoveredByPlayers: true
        });
      } else {
        tokenMap.get(scan.tokenId).events.push({
          type: 'scan',
          timestamp: scan.timestamp,
          deviceId: scan.deviceId
        });
      }
    });

    // Process GM transactions (claims)
    this.sessionData.transactions.forEach(tx => {
      let activity = tokenMap.get(tx.tokenId);

      if (!activity) {
        // Look up token data
        const lookedUpToken = this.tokenManager?.findToken(tx.tokenId);
        const tokenData = lookedUpToken ? {
          SF_MemoryType: lookedUpToken.SF_MemoryType,
          SF_ValueRating: lookedUpToken.SF_ValueRating,
          SF_Group: lookedUpToken.SF_Group || null,
          summary: lookedUpToken.summary || null
        } : {
          SF_MemoryType: tx.memoryType,
          SF_ValueRating: tx.valueRating
        };

        activity = {
          tokenId: tx.tokenId,
          tokenData,
          potentialValue: calculateTokenValue({
            valueRating: tokenData.SF_ValueRating,
            memoryType: tokenData.SF_MemoryType
          }),
          events: [],
          status: 'claimed',
          discoveredByPlayers: false
        };
        tokenMap.set(tx.tokenId, activity);
      }

      // Add claim event
      activity.events.push({
        type: 'claim',
        timestamp: tx.timestamp,
        mode: tx.mode,
        teamId: tx.teamId,
        points: tx.points || 0,
        summary: tx.summary || activity.tokenData?.summary || null
      });
      activity.status = 'claimed';
    });

    // Sort events within each token
    tokenMap.forEach(activity => {
      activity.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    const tokens = Array.from(tokenMap.values());

    const stats = {
      totalTokens: tokens.length,
      available: tokens.filter(t => t.status === 'available').length,
      claimed: tokens.filter(t => t.status === 'claimed').length,
      claimedWithoutDiscovery: tokens.filter(t => t.status === 'claimed' && !t.discoveredByPlayers).length,
      totalPlayerScans: this.playerScans.length
    };

    return { tokens, stats };
  }
```

### Step 4.11: Run all LocalStorage tests

Run: `cd ALNScanner && npm test -- --testPathPattern="LocalStorage.test" --verbose`
Expected: All PASS

### Step 4.12: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
feat(core): implement LocalStorage strategy

Complete IStorageStrategy implementation for standalone mode:
- addTransaction with team scoring and group completion
- removeTransaction with score recalculation
- adjustTeamScore with admin audit trail
- getGameActivity (NEW - was missing in StandaloneDataManager)
- Session lifecycle methods

This provides parity with NetworkedStorage capabilities.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Implement NetworkedStorage Strategy

**Files:**
- Create: `ALNScanner/src/core/storage/NetworkedStorage.js`
- Create: `ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js`

### Step 5.1: Write failing test for NetworkedStorage

```javascript
// ALNScanner/tests/unit/core/storage/NetworkedStorage.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NetworkedStorage } from '../../../../src/core/storage/NetworkedStorage.js';

describe('NetworkedStorage Strategy', () => {
  let storage;
  let mockSocket;
  let mockTokenManager;
  let mockDebug;

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      connected: true
    };

    mockTokenManager = {
      findToken: jest.fn(),
      getGroupInventory: jest.fn(() => ({}))
    };

    mockDebug = { log: jest.fn() };

    storage = new NetworkedStorage({
      socket: mockSocket,
      tokenManager: mockTokenManager,
      debug: mockDebug
    });
  });

  describe('isReady', () => {
    it('should return true when socket is connected', () => {
      mockSocket.connected = true;
      expect(storage.isReady()).toBe(true);
    });

    it('should return false when socket is disconnected', () => {
      mockSocket.connected = false;
      expect(storage.isReady()).toBe(false);
    });
  });

  describe('addTransaction', () => {
    it('should emit transaction:submit to socket', async () => {
      const tx = {
        tokenId: 'token1',
        teamId: '001',
        mode: 'blackmarket'
      };

      // Don't await - it needs server response
      storage.addTransaction(tx);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'transaction:submit',
        expect.objectContaining({
          tokenId: 'token1',
          teamId: '001'
        })
      );
    });
  });

  describe('adjustTeamScore', () => {
    it('should emit gm:command with score:adjust action', async () => {
      storage.adjustTeamScore('001', 5000, 'Bonus');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'gm:command',
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'score:adjust',
            payload: expect.objectContaining({
              teamId: '001',
              delta: 5000,
              reason: 'Bonus'
            })
          })
        })
      );
    });
  });
});
```

### Step 5.2: Implement NetworkedStorage

```javascript
// ALNScanner/src/core/storage/NetworkedStorage.js
/**
 * NetworkedStorage Strategy - WebSocket backend communication
 * Implements IStorageStrategy for networked mode operation
 *
 * @module core/storage/NetworkedStorage
 */

import { IStorageStrategy } from './IStorageStrategy.js';
import { calculateTokenValue } from '../scoring.js';

export class NetworkedStorage extends IStorageStrategy {
  /**
   * Create NetworkedStorage instance
   * @param {Object} options - Dependencies
   * @param {Object} options.socket - Socket.io client
   * @param {Object} options.tokenManager - TokenManager instance
   * @param {Object} [options.debug] - Debug instance
   */
  constructor({ socket, tokenManager, debug } = {}) {
    super();

    this.socket = socket;
    this.tokenManager = tokenManager;
    this.debug = debug;

    // Local cache (synced from backend)
    this.transactions = [];
    this.backendScores = new Map();
    this.scannedTokens = new Set();
    this.playerScans = [];
    this.currentSessionId = null;
  }

  isReady() {
    return this.socket?.connected === true;
  }

  async initialize() {
    // Setup event listeners for sync
    this._setupEventListeners();
  }

  _setupEventListeners() {
    if (!this.socket) return;

    // These would typically be set up by NetworkedSession
    // This is a pass-through storage that delegates to backend
  }

  /**
   * Add transaction - delegates to backend
   * Note: Backend confirms via transaction:new broadcast
   */
  async addTransaction(transaction) {
    this.socket.emit('transaction:submit', {
      tokenId: transaction.tokenId,
      teamId: transaction.teamId,
      deviceId: transaction.deviceId,
      deviceType: 'gm',
      mode: transaction.mode,
      timestamp: transaction.timestamp || new Date().toISOString()
    });

    // Mark locally for duplicate prevention
    if (transaction.tokenId) {
      this.scannedTokens.add(transaction.tokenId);
    }

    // Return pending - actual result comes via WebSocket
    return {
      success: true,
      pending: true
    };
  }

  async removeTransaction(transactionId) {
    this.socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'transaction:delete',
        payload: { transactionId }
      },
      timestamp: new Date().toISOString()
    });

    return { success: true, pending: true };
  }

  getTransactions() {
    return this.transactions;
  }

  getTeamScores() {
    if (this.backendScores.size > 0) {
      return Array.from(this.backendScores.entries())
        .map(([teamId, score]) => ({
          teamId,
          score: score.currentScore,
          baseScore: score.baseScore,
          bonusScore: score.bonusPoints,
          tokenCount: score.tokensScanned,
          completedGroups: score.completedGroups?.length || 0,
          isFromBackend: true
        }))
        .sort((a, b) => b.score - a.score);
    }
    return [];
  }

  async adjustTeamScore(teamId, delta, reason) {
    this.socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'score:adjust',
        payload: { teamId, delta, reason }
      },
      timestamp: new Date().toISOString()
    });

    return { success: true, pending: true };
  }

  getGameActivity() {
    // Implementation mirrors DataManager.getGameActivity()
    const tokenMap = new Map();

    // Process player scans
    this.playerScans.forEach(scan => {
      if (!tokenMap.has(scan.tokenId)) {
        const tokenData = scan.tokenData || {};
        tokenMap.set(scan.tokenId, {
          tokenId: scan.tokenId,
          tokenData,
          potentialValue: calculateTokenValue({
            valueRating: tokenData.SF_ValueRating,
            memoryType: tokenData.SF_MemoryType
          }),
          events: [{
            type: 'discovery',
            timestamp: scan.timestamp,
            deviceId: scan.deviceId
          }],
          status: 'available',
          discoveredByPlayers: true
        });
      } else {
        tokenMap.get(scan.tokenId).events.push({
          type: 'scan',
          timestamp: scan.timestamp,
          deviceId: scan.deviceId
        });
      }
    });

    // Process transactions
    this.transactions.forEach(tx => {
      if (tx.status && tx.status !== 'accepted') return;

      let activity = tokenMap.get(tx.tokenId);

      if (!activity) {
        const lookedUpToken = this.tokenManager?.findToken(tx.tokenId);
        const tokenData = lookedUpToken ? {
          SF_MemoryType: lookedUpToken.SF_MemoryType,
          SF_ValueRating: lookedUpToken.SF_ValueRating,
          SF_Group: lookedUpToken.SF_Group,
          summary: lookedUpToken.summary
        } : {
          SF_MemoryType: tx.memoryType,
          SF_ValueRating: tx.valueRating
        };

        activity = {
          tokenId: tx.tokenId,
          tokenData,
          potentialValue: calculateTokenValue({
            valueRating: tokenData.SF_ValueRating,
            memoryType: tokenData.SF_MemoryType
          }),
          events: [],
          status: 'claimed',
          discoveredByPlayers: false
        };
        tokenMap.set(tx.tokenId, activity);
      }

      activity.events.push({
        type: 'claim',
        timestamp: tx.timestamp,
        mode: tx.mode,
        teamId: tx.teamId,
        points: calculateTokenValue(tx),
        summary: tx.summary || activity.tokenData?.summary
      });
      activity.status = 'claimed';
    });

    tokenMap.forEach(activity => {
      activity.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    const tokens = Array.from(tokenMap.values());

    return {
      tokens,
      stats: {
        totalTokens: tokens.length,
        available: tokens.filter(t => t.status === 'available').length,
        claimed: tokens.filter(t => t.status === 'claimed').length,
        claimedWithoutDiscovery: tokens.filter(t => !t.discoveredByPlayers && t.status === 'claimed').length,
        totalPlayerScans: this.playerScans.length
      }
    };
  }

  async createSession(name, teams) {
    this.socket.emit('gm:command', {
      event: 'gm:command',
      data: {
        action: 'session:create',
        payload: { name, teams }
      },
      timestamp: new Date().toISOString()
    });

    return { pending: true };
  }

  async endSession() {
    this.socket.emit('gm:command', {
      event: 'gm:command',
      data: { action: 'session:end', payload: {} },
      timestamp: new Date().toISOString()
    });
  }

  getCurrentSession() {
    return this.currentSessionId ? {
      sessionId: this.currentSessionId,
      status: 'active'
    } : null;
  }

  // Methods for NetworkedSession to update local cache

  setTransactions(transactions) {
    this.transactions = transactions;
  }

  addTransactionFromBroadcast(tx) {
    const exists = this.transactions.some(t => t.id === tx.id);
    if (!exists) {
      this.transactions.push(tx);
    }
  }

  setBackendScores(teamId, scoreData) {
    this.backendScores.set(teamId, scoreData);
  }

  setScannedTokens(tokens) {
    this.scannedTokens = new Set(tokens);
  }

  setPlayerScans(scans) {
    this.playerScans = scans;
  }

  addPlayerScan(scan) {
    const exists = this.playerScans.some(s => s.id === scan.id);
    if (!exists) {
      this.playerScans.push(scan);
    }
  }

  setSessionId(sessionId) {
    this.currentSessionId = sessionId;
  }
}
```

### Step 5.3: Run NetworkedStorage tests

Run: `cd ALNScanner && npm test -- --testPathPattern="NetworkedStorage" --verbose`
Expected: PASS

### Step 5.4: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
feat(core): implement NetworkedStorage strategy

Complete IStorageStrategy implementation for networked mode:
- Delegates operations to backend via WebSocket
- Maintains local cache synced from broadcasts
- getGameActivity matches LocalStorage API
- Methods for NetworkedSession to update cache

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fix Event Naming Inconsistency

**Files:**
- Modify: `ALNScanner/src/core/standaloneDataManager.js`
- Modify: `ALNScanner/tests/unit/core/standaloneDataManager.test.js`

### Step 6.1: Find and update event name

**Current (line 148):**
```javascript
this.dispatchEvent(new CustomEvent('standalone:transaction-removed', {
```

**Change to:**
```javascript
this.dispatchEvent(new CustomEvent('transaction:deleted', {
```

### Step 6.2: Update any tests expecting old event name

Search: `grep -r "standalone:transaction-removed" ALNScanner/`

Update test files to expect `transaction:deleted`.

### Step 6.3: Run tests to verify no regressions

Run: `cd ALNScanner && npm test --verbose`
Expected: All PASS

### Step 6.4: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
fix(core): unify event name to 'transaction:deleted'

StandaloneDataManager was using 'standalone:transaction-removed'
while DataManager used 'transaction:deleted'. Unified to single
event name for simpler UI code.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update DataManager to Use DataManagerUtils

**Files:**
- Modify: `ALNScanner/src/core/dataManager.js`
- Modify: `ALNScanner/tests/unit/core/dataManager.test.js`

### Step 7.1: Import DataManagerUtils

Add at top of dataManager.js:
```javascript
import { DataManagerUtils } from './dataManagerUtils.js';
```

### Step 7.2: Replace duplicate methods with utility calls

**isTokenScanned (line 108-110):**
```javascript
isTokenScanned(tokenId) {
  return DataManagerUtils.isTokenScanned(this.scannedTokens, tokenId);
}
```

**markTokenAsScanned (line 116-119):**
```javascript
markTokenAsScanned(tokenId) {
  DataManagerUtils.markTokenAsScanned(this.scannedTokens, tokenId);
  this.saveScannedTokens();
}
```

**unmarkTokenAsScanned (line 126-133):**
```javascript
unmarkTokenAsScanned(tokenId) {
  const wasRemoved = DataManagerUtils.unmarkTokenAsScanned(this.scannedTokens, tokenId);
  if (wasRemoved) {
    this.saveScannedTokens();
    this.debug?.log(`[DataManager] Token unmarked for re-scanning: ${tokenId}`);
  }
  return wasRemoved;
}
```

### Step 7.3: Run existing tests

Run: `cd ALNScanner && npm test -- --testPathPattern="dataManager.test" --verbose`
Expected: All PASS (behavior unchanged)

### Step 7.4: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
refactor(core): use DataManagerUtils in DataManager

Replace duplicate detection methods with shared utility calls:
- isTokenScanned → DataManagerUtils.isTokenScanned
- markTokenAsScanned → DataManagerUtils.markTokenAsScanned
- unmarkTokenAsScanned → DataManagerUtils.unmarkTokenAsScanned

Reduces duplication, maintains identical behavior.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update StandaloneDataManager to Use DataManagerUtils

**Files:**
- Modify: `ALNScanner/src/core/standaloneDataManager.js`

### Step 8.1: Import DataManagerUtils

Add import at top:
```javascript
import { DataManagerUtils } from './dataManagerUtils.js';
```

### Step 8.2: Replace duplicate methods

**isTokenScanned (line 170-172):**
```javascript
isTokenScanned(tokenId) {
  return DataManagerUtils.isTokenScanned(this.scannedTokens, tokenId);
}
```

**markTokenAsScanned (line 178-180):**
```javascript
markTokenAsScanned(tokenId) {
  DataManagerUtils.markTokenAsScanned(this.scannedTokens, tokenId);
}
```

### Step 8.3: Run tests

Run: `cd ALNScanner && npm test -- --testPathPattern="standaloneDataManager" --verbose`
Expected: All PASS

### Step 8.4: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
refactor(core): use DataManagerUtils in StandaloneDataManager

Replace duplicate detection methods with shared utility calls.
Now both DataManager and StandaloneDataManager use identical
underlying implementation.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add getGameActivity to StandaloneDataManager

This adds the **missing method** to achieve API parity.

**Files:**
- Modify: `ALNScanner/src/core/standaloneDataManager.js`
- Modify: `ALNScanner/tests/unit/core/standaloneDataManager.test.js`

### Step 9.1: Write failing test

```javascript
describe('getGameActivity', () => {
  it('should return game activity structure', () => {
    manager.addTransaction({
      id: 'tx-1',
      tokenId: 'token1',
      teamId: '001',
      mode: 'blackmarket',
      points: 50000,
      valueRating: 3,
      memoryType: 'Personal',
      timestamp: '2025-01-05T10:00:00Z'
    });

    const activity = manager.getGameActivity();

    expect(activity.tokens).toBeDefined();
    expect(activity.stats).toBeDefined();
    expect(activity.tokens).toHaveLength(1);
    expect(activity.tokens[0].status).toBe('claimed');
    expect(activity.stats.claimed).toBe(1);
  });
});
```

### Step 9.2: Run test to verify it fails

Run: `cd ALNScanner && npm test -- --testPathPattern="standaloneDataManager" --verbose`
Expected: FAIL with "getGameActivity is not a function"

### Step 9.3: Implement getGameActivity

Add to StandaloneDataManager class (copy from LocalStorage implementation):

```javascript
/**
 * Get unified game activity
 * Added for API parity with DataManager
 *
 * @returns {Object} { tokens: Array, stats: Object }
 */
getGameActivity() {
  const tokenMap = new Map();

  // Process transactions as claims (no player scans in standalone)
  this.sessionData.transactions.forEach(tx => {
    let activity = tokenMap.get(tx.tokenId);

    if (!activity) {
      const lookedUpToken = this.tokenManager?.findToken(tx.tokenId);
      const tokenData = lookedUpToken ? {
        SF_MemoryType: lookedUpToken.SF_MemoryType,
        SF_ValueRating: lookedUpToken.SF_ValueRating,
        SF_Group: lookedUpToken.SF_Group,
        summary: lookedUpToken.summary
      } : {
        SF_MemoryType: tx.memoryType,
        SF_ValueRating: tx.valueRating
      };

      activity = {
        tokenId: tx.tokenId,
        tokenData,
        potentialValue: this.calculateTokenValue({
          valueRating: tokenData.SF_ValueRating,
          memoryType: tokenData.SF_MemoryType
        }),
        events: [],
        status: 'claimed',
        discoveredByPlayers: false
      };
      tokenMap.set(tx.tokenId, activity);
    }

    activity.events.push({
      type: 'claim',
      timestamp: tx.timestamp,
      mode: tx.mode,
      teamId: tx.teamId,
      points: tx.points || 0,
      summary: tx.summary || activity.tokenData?.summary
    });
    activity.status = 'claimed';
  });

  // Sort events
  tokenMap.forEach(activity => {
    activity.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });

  const tokens = Array.from(tokenMap.values());

  return {
    tokens,
    stats: {
      totalTokens: tokens.length,
      available: 0,  // No player scans in standalone
      claimed: tokens.length,
      claimedWithoutDiscovery: tokens.length,
      totalPlayerScans: 0
    }
  };
}
```

### Step 9.4: Run test to verify it passes

Run: `cd ALNScanner && npm test -- --testPathPattern="standaloneDataManager" --verbose`
Expected: PASS

### Step 9.5: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
feat(core): add getGameActivity to StandaloneDataManager

Add missing method for API parity with DataManager:
- Returns token-centric activity view
- Includes stats for UI display
- Compatible with UIManager.renderGameActivity()

This enables Game Activity view in standalone mode.

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Integration Tests

**Files:**
- Create: `ALNScanner/tests/integration/storage-strategies.test.js`

### Step 10.1: Write integration tests

```javascript
// ALNScanner/tests/integration/storage-strategies.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LocalStorage } from '../../src/core/storage/LocalStorage.js';

describe('Storage Strategy Integration', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorage({
      tokenManager: {
        getAllTokens: () => [],
        findToken: () => null
      }
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Session Lifecycle', () => {
    it('should create → scan → end session', async () => {
      // Create session
      const session = await storage.createSession('Test Game', []);
      expect(session.sessionId).toMatch(/^LOCAL_/);

      // Add transactions
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 50000
      });
      await storage.addTransaction({
        id: 'tx-2', tokenId: 'token2', teamId: '002',
        mode: 'blackmarket', points: 75000
      });

      // Verify state
      expect(storage.getTransactions()).toHaveLength(2);
      expect(storage.getTeamScores()).toHaveLength(2);
      expect(storage.getTeamScores()[0].score).toBe(75000); // Sorted by score

      // End session
      await storage.endSession();

      // Verify persisted
      const saved = localStorage.getItem('standaloneSession');
      expect(saved).toBeTruthy();
    });
  });

  describe('Score Adjustment', () => {
    it('should persist adjustments to localStorage', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 10000
      });

      await storage.adjustTeamScore('001', 5000, 'Bonus');

      // Reload from localStorage
      const newStorage = new LocalStorage({
        tokenManager: { getAllTokens: () => [], findToken: () => null }
      });

      const scores = newStorage.getTeamScores();
      expect(scores[0].score).toBe(15000);
    });
  });

  describe('Data Format Compatibility', () => {
    it('should produce same getGameActivity structure as DataManager', async () => {
      await storage.addTransaction({
        id: 'tx-1', tokenId: 'token1', teamId: '001',
        mode: 'blackmarket', points: 50000, valueRating: 3, memoryType: 'Personal'
      });

      const activity = storage.getGameActivity();

      // Verify structure matches DataManager
      expect(activity).toHaveProperty('tokens');
      expect(activity).toHaveProperty('stats');
      expect(activity.tokens[0]).toHaveProperty('tokenId');
      expect(activity.tokens[0]).toHaveProperty('tokenData');
      expect(activity.tokens[0]).toHaveProperty('events');
      expect(activity.tokens[0]).toHaveProperty('status');
      expect(activity.tokens[0].events[0]).toHaveProperty('type');
      expect(activity.tokens[0].events[0]).toHaveProperty('teamId');
      expect(activity.tokens[0].events[0]).toHaveProperty('points');
    });
  });
});
```

### Step 10.2: Run integration tests

Run: `cd ALNScanner && npm test -- --testPathPattern="storage-strategies" --verbose`
Expected: All PASS

### Step 10.3: Commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
test(integration): add storage strategy integration tests

Verify:
- Session lifecycle (create → scan → end)
- Score adjustment persistence
- Data format compatibility with DataManager

Part of Phase 2: DataManager Unification

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Run Full Test Suite and Verify

### Step 11.1: Run all unit tests

Run: `cd ALNScanner && npm test --verbose`
Expected: All 598+ tests PASS

### Step 11.2: Run E2E tests

Run: `cd ALNScanner && npm run test:e2e`
Expected: All PASS

### Step 11.3: Run build

Run: `cd ALNScanner && npm run build`
Expected: Build succeeds, dist/ created

### Step 11.4: Update architecture document

Mark Phase 2 tasks as complete in `docs/plans/gm-scanner-architecture-refactoring.md`.

### Step 11.5: Final commit

```bash
cd ALNScanner && git add -A && git commit -m "$(cat <<'EOF'
docs: mark Phase 2 DataManager unification complete

Phase 2 deliverables:
✅ Extract common interface (DataManagerUtils)
✅ Implement strategy pattern (IStorageStrategy)
✅ Create LocalStorage strategy
✅ Create NetworkedStorage strategy
✅ Add getGameActivity() to standalone
✅ Fix event naming inconsistency
✅ Comprehensive testing

~400 LOC duplication eliminated.
API parity achieved between modes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

**Phase 2 Complete Deliverables:**

| Task | Description | Files Created/Modified |
|------|-------------|------------------------|
| 1-2 | DataManagerUtils | `src/core/dataManagerUtils.js` |
| 3 | IStorageStrategy interface | `src/core/storage/IStorageStrategy.js` |
| 4 | LocalStorage implementation | `src/core/storage/LocalStorage.js` |
| 5 | NetworkedStorage implementation | `src/core/storage/NetworkedStorage.js` |
| 6 | Event naming fix | `src/core/standaloneDataManager.js` |
| 7-8 | DataManager refactor | `src/core/dataManager.js`, `standaloneDataManager.js` |
| 9 | Add getGameActivity | `src/core/standaloneDataManager.js` |
| 10 | Integration tests | `tests/integration/storage-strategies.test.js` |

**Lines Eliminated:** ~150 LOC direct duplication (duplicate detection, getGlobalStats)

**API Parity Achieved:**
- ✅ `getGameActivity()` now in both modes
- ✅ `adjustTeamScore()` documented in interface
- ✅ Event names unified (`transaction:deleted`)

**Ready for Phase 3:** Command Executor Pattern for Admin Parity
