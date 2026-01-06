# Phase 3: Admin UI Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable admin panel access in standalone mode with feature parity for session management, score display, and game activity.

**Architecture:** Extend the Phase 2 strategy pattern to include session lifecycle methods (pause/resume). Add UIManager.renderSessionStatus() for mode-agnostic session display. Use ScreenUpdateManager container handlers for reactive admin panel updates. CSS-hide networked-only sections (Video/System) in standalone mode.

**Tech Stack:** ES6 modules, Jest unit tests, EventTarget pub/sub, localStorage persistence, CSS conditional display.

---

## Summary of Tasks (9 total)

| Task | Description | Risk | Files |
|------|-------------|------|-------|
| 1 | Add pauseSession/resumeSession to IStorageStrategy | Low | Interface + LocalStorage |
| 2 | Block scanning when session paused | Low | LocalStorage |
| 3 | Add resetScores to LocalStorage | Low | LocalStorage |
| 4 | Update App admin methods for dual-mode | Medium | app.js |
| 5 | Add UIManager.renderSessionStatus() | Medium | uiManager.js |
| 6 | Enable viewSelector in standalone mode | Low | app.js |
| 7 | Hide networked-only admin sections | Low | CSS + HTML |
| 8 | Register ScreenUpdateManager handlers | Medium | main.js |
| 9 | Final verification | Low | All tests |

---

## Task 1: Add pauseSession/resumeSession to Storage Interface

**Files:**
- Modify: `src/core/storage/IStorageStrategy.js`
- Modify: `src/core/storage/LocalStorage.js`
- Modify: `src/core/unifiedDataManager.js`
- Test: `tests/unit/core/storage/localStorage.test.js`

### Step 1: Write failing tests for LocalStorage

Add to `tests/unit/core/storage/localStorage.test.js`:

```javascript
describe('Session Lifecycle', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorage({ debug: mockDebug });
    storage.initialize();
  });

  describe('pauseSession', () => {
    it('should set session status to paused', async () => {
      await storage.createSession('Test Session', []);

      const result = await storage.pauseSession();

      expect(result.success).toBe(true);
      expect(storage.getCurrentSession().status).toBe('paused');
    });

    it('should return error if no active session', async () => {
      const result = await storage.pauseSession();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active session');
    });

    it('should persist paused status to localStorage', async () => {
      await storage.createSession('Test Session', []);
      await storage.pauseSession();

      const saved = JSON.parse(localStorage.getItem('aln_standalone_session'));
      expect(saved.status).toBe('paused');
    });
  });

  describe('resumeSession', () => {
    it('should set session status to active', async () => {
      await storage.createSession('Test Session', []);
      await storage.pauseSession();

      const result = await storage.resumeSession();

      expect(result.success).toBe(true);
      expect(storage.getCurrentSession().status).toBe('active');
    });

    it('should return error if session not paused', async () => {
      await storage.createSession('Test Session', []);

      const result = await storage.resumeSession();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not paused');
    });
  });
});
```

### Step 2: Run tests to verify they fail

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --verbose
```

Expected: FAIL - `pauseSession` and `resumeSession` not defined

### Step 3: Add interface methods to IStorageStrategy

In `src/core/storage/IStorageStrategy.js`, add after `endSession()` (around line 137):

```javascript
  /**
   * Pause the current session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async pauseSession() {
    throw new Error('IStorageStrategy.pauseSession() must be implemented');
  }

  /**
   * Resume a paused session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resumeSession() {
    throw new Error('IStorageStrategy.resumeSession() must be implemented');
  }
```

### Step 4: Implement in LocalStorage

In `src/core/storage/LocalStorage.js`, add after `endSession()` (around line 180):

```javascript
  /**
   * Pause the current session
   * Blocks scanning while paused
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async pauseSession() {
    if (!this.sessionData?.sessionId) {
      return { success: false, error: 'No active session to pause' };
    }

    if (this.sessionData.status === 'paused') {
      return { success: false, error: 'Session already paused' };
    }

    this.sessionData.status = 'paused';
    this.sessionData.pausedAt = new Date().toISOString();
    this._saveSession();

    // Emit event for UI updates
    this.dispatchEvent(new CustomEvent('session:updated', {
      detail: { session: this.getCurrentSession() }
    }));

    return { success: true };
  }

  /**
   * Resume a paused session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resumeSession() {
    if (!this.sessionData?.sessionId) {
      return { success: false, error: 'No session to resume' };
    }

    if (this.sessionData.status !== 'paused') {
      return { success: false, error: 'Session is not paused' };
    }

    this.sessionData.status = 'active';
    delete this.sessionData.pausedAt;
    this._saveSession();

    // Emit event for UI updates
    this.dispatchEvent(new CustomEvent('session:updated', {
      detail: { session: this.getCurrentSession() }
    }));

    return { success: true };
  }
```

### Step 5: Add delegation in UnifiedDataManager

In `src/core/unifiedDataManager.js`, add after `endSession()` (around line 270):

```javascript
  /**
   * Pause the current session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async pauseSession() {
    this._ensureStrategy('pauseSession');
    return this._activeStrategy.pauseSession();
  }

  /**
   * Resume a paused session
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async resumeSession() {
    this._ensureStrategy('resumeSession');
    return this._activeStrategy.resumeSession();
  }
```

### Step 6: Update createSession to set initial status

In `src/core/storage/LocalStorage.js`, modify `createSession()` (around line 158):

```javascript
  async createSession(name, teams) {
    this.sessionData = {
      sessionId: this._generateSessionId(),
      name: name,
      status: 'active',  // ADD THIS LINE
      startTime: new Date().toISOString(),
      transactions: [],
      teams: {},
      mode: 'standalone'
    };
    this.scannedTokens.clear();
    this._saveSession();

    return this.getCurrentSession();
  }
```

### Step 7: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --verbose
```

Expected: PASS

### Step 8: Commit

```bash
git add src/core/storage/IStorageStrategy.js src/core/storage/LocalStorage.js src/core/unifiedDataManager.js tests/unit/core/storage/localStorage.test.js
git commit -m "feat(storage): add pauseSession/resumeSession to LocalStorage

- Add interface methods to IStorageStrategy
- Implement in LocalStorage with status tracking
- Add delegation in UnifiedDataManager
- Emit session:updated events for UI reactivity

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Block Scanning When Session Paused

**Files:**
- Modify: `src/core/storage/LocalStorage.js`
- Test: `tests/unit/core/storage/localStorage.test.js`

### Step 1: Write failing test

Add to `tests/unit/core/storage/localStorage.test.js`:

```javascript
describe('addTransaction with paused session', () => {
  it('should reject transactions when session is paused', async () => {
    await storage.createSession('Test Session', []);
    await storage.pauseSession();

    const result = await storage.addTransaction({
      id: 'tx-001',
      tokenId: 'token-123',
      teamId: 'Team Alpha',
      mode: 'blackmarket'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('paused');
  });

  it('should accept transactions after session resumed', async () => {
    await storage.createSession('Test Session', []);
    await storage.pauseSession();
    await storage.resumeSession();

    const result = await storage.addTransaction({
      id: 'tx-001',
      tokenId: 'token-123',
      teamId: 'Team Alpha',
      mode: 'blackmarket',
      points: 50000
    });

    expect(result.success).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --testNamePattern="paused session" --verbose
```

Expected: FAIL - transactions still accepted when paused

### Step 3: Add pause check to addTransaction

In `src/core/storage/LocalStorage.js`, modify `addTransaction()` (around line 186), add at the start:

```javascript
  async addTransaction(transaction) {
    // Check if session is paused
    if (this.sessionData?.status === 'paused') {
      return {
        success: false,
        error: 'Cannot add transaction: session is paused'
      };
    }

    // Validate required fields (existing code continues...)
    if (!transaction || !transaction.teamId) {
```

### Step 4: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --verbose
```

Expected: PASS

### Step 5: Commit

```bash
git add src/core/storage/LocalStorage.js tests/unit/core/storage/localStorage.test.js
git commit -m "feat(storage): block transactions when session paused

Enforces pause semantics by rejecting addTransaction() calls
when session status is 'paused'. Matches networked mode behavior.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add resetScores to LocalStorage

**Files:**
- Modify: `src/core/storage/IStorageStrategy.js`
- Modify: `src/core/storage/LocalStorage.js`
- Modify: `src/core/unifiedDataManager.js`
- Test: `tests/unit/core/storage/localStorage.test.js`

### Step 1: Write failing test

Add to `tests/unit/core/storage/localStorage.test.js`:

```javascript
describe('resetScores', () => {
  it('should zero all team scores while keeping transactions', async () => {
    await storage.createSession('Test Session', []);

    // Add some transactions
    await storage.addTransaction({
      id: 'tx-001', tokenId: 'token-1', teamId: 'Team Alpha',
      mode: 'blackmarket', points: 50000, valueRating: 3, memoryType: 'Personal'
    });
    await storage.addTransaction({
      id: 'tx-002', tokenId: 'token-2', teamId: 'Team Beta',
      mode: 'blackmarket', points: 75000, valueRating: 4, memoryType: 'Personal'
    });

    // Verify scores exist
    let scores = storage.getTeamScores();
    expect(scores.find(t => t.teamId === 'Team Alpha').score).toBeGreaterThan(0);

    // Reset scores
    const result = await storage.resetScores();

    expect(result.success).toBe(true);

    // Verify scores are zero but transactions remain
    scores = storage.getTeamScores();
    expect(scores.find(t => t.teamId === 'Team Alpha').score).toBe(0);
    expect(scores.find(t => t.teamId === 'Team Beta').score).toBe(0);
    expect(storage.getTransactions().length).toBe(2);
  });

  it('should emit scores:cleared event', async () => {
    await storage.createSession('Test Session', []);
    await storage.addTransaction({
      id: 'tx-001', tokenId: 'token-1', teamId: 'Team Alpha',
      mode: 'blackmarket', points: 50000
    });

    const eventPromise = new Promise(resolve => {
      storage.addEventListener('scores:cleared', resolve, { once: true });
    });

    await storage.resetScores();

    const event = await eventPromise;
    expect(event.type).toBe('scores:cleared');
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --testNamePattern="resetScores" --verbose
```

Expected: FAIL - `resetScores` not defined

### Step 3: Add interface method

In `src/core/storage/IStorageStrategy.js`, add after `resumeSession()`:

```javascript
  /**
   * Reset all team scores to zero (keeps transactions for audit)
   * @returns {Promise<{success: boolean}>}
   */
  async resetScores() {
    throw new Error('IStorageStrategy.resetScores() must be implemented');
  }
```

### Step 4: Implement in LocalStorage

In `src/core/storage/LocalStorage.js`, add after `resumeSession()`:

```javascript
  /**
   * Reset all team scores to zero
   * Keeps transactions for audit trail
   * @returns {Promise<{success: boolean}>}
   */
  async resetScores() {
    // Zero all team scores
    Object.keys(this.sessionData.teams).forEach(teamId => {
      const team = this.sessionData.teams[teamId];
      team.score = 0;
      team.baseScore = 0;
      team.bonusPoints = 0;
      team.adminAdjustments = [];
    });

    this._saveSession();

    // Emit event for UI updates
    this.dispatchEvent(new CustomEvent('scores:cleared', {
      detail: {}
    }));

    return { success: true };
  }
```

### Step 5: Add delegation in UnifiedDataManager

In `src/core/unifiedDataManager.js`, add after `resumeSession()`:

```javascript
  /**
   * Reset all team scores to zero
   * @returns {Promise<{success: boolean}>}
   */
  async resetScores() {
    this._ensureStrategy('resetScores');
    return this._activeStrategy.resetScores();
  }
```

### Step 6: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="localStorage.test" --verbose
```

Expected: PASS

### Step 7: Commit

```bash
git add src/core/storage/IStorageStrategy.js src/core/storage/LocalStorage.js src/core/unifiedDataManager.js tests/unit/core/storage/localStorage.test.js
git commit -m "feat(storage): add resetScores to LocalStorage

Zeros all team scores while preserving transactions for audit.
Emits scores:cleared event for UI reactivity.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update App Admin Methods for Dual-Mode

**Files:**
- Modify: `src/app/app.js`
- Test: `tests/app/app.test.js`

### Step 1: Write failing tests

Add to `tests/app/app.test.js` in a new describe block:

```javascript
describe('Admin Session Methods (Dual-Mode)', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('adminCreateSession', () => {
    it('should use dataManager in standalone mode', async () => {
      mockSessionModeManager.isStandalone.mockReturnValue(true);
      mockSessionModeManager.isNetworked.mockReturnValue(false);

      // Mock prompt
      global.prompt = jest.fn(() => 'Test Session');

      await app.adminCreateSession();

      expect(DataManager.createSession).toHaveBeenCalledWith('Test Session', []);
    });
  });

  describe('adminPauseSession', () => {
    it('should use dataManager in standalone mode', async () => {
      mockSessionModeManager.isStandalone.mockReturnValue(true);
      mockSessionModeManager.isNetworked.mockReturnValue(false);

      await app.adminPauseSession();

      expect(DataManager.pauseSession).toHaveBeenCalled();
    });
  });

  describe('adminResumeSession', () => {
    it('should use dataManager in standalone mode', async () => {
      mockSessionModeManager.isStandalone.mockReturnValue(true);
      mockSessionModeManager.isNetworked.mockReturnValue(false);

      await app.adminResumeSession();

      expect(DataManager.resumeSession).toHaveBeenCalled();
    });
  });

  describe('adminEndSession', () => {
    it('should use dataManager in standalone mode', async () => {
      mockSessionModeManager.isStandalone.mockReturnValue(true);
      mockSessionModeManager.isNetworked.mockReturnValue(false);

      // Mock confirm
      global.confirm = jest.fn(() => true);

      await app.adminEndSession();

      expect(DataManager.endSession).toHaveBeenCalled();
    });
  });

  describe('adminResetScores', () => {
    it('should use dataManager in standalone mode', async () => {
      mockSessionModeManager.isStandalone.mockReturnValue(true);
      mockSessionModeManager.isNetworked.mockReturnValue(false);

      // Mock confirm
      global.confirm = jest.fn(() => true);

      await app.adminResetScores();

      expect(DataManager.resetScores).toHaveBeenCalled();
    });
  });
});
```

Also update the DataManager mock at the top of the file to include new methods:

```javascript
jest.mock('../../src/core/dataManager.js', () => ({
  default: {
    // ... existing mocks ...
    createSession: jest.fn().mockResolvedValue({ sessionId: 'test-123' }),
    pauseSession: jest.fn().mockResolvedValue({ success: true }),
    resumeSession: jest.fn().mockResolvedValue({ success: true }),
    endSession: jest.fn().mockResolvedValue(),
    resetScores: jest.fn().mockResolvedValue({ success: true }),
    getCurrentSession: jest.fn(() => ({ sessionId: 'test-123', status: 'active' })),
  }
}));
```

### Step 2: Run tests to verify they fail

```bash
cd ALNScanner && npm test -- --testPathPattern="app.test" --testNamePattern="Dual-Mode" --verbose
```

Expected: FAIL - methods don't check for standalone mode

### Step 3: Update adminCreateSession

In `src/app/app.js`, replace `adminCreateSession()` (around line 981):

```javascript
  async adminCreateSession() {
    const name = prompt('Enter session name:');
    if (!name) return;

    const isStandalone = this.sessionModeManager?.isStandalone();

    // Standalone mode: Use UnifiedDataManager (LocalStorage strategy)
    if (isStandalone) {
      try {
        await this.dataManager.createSession(name.trim(), []);
        this.debug.log(`Session created (standalone): ${name}`);
        this.uiManager.showToast('Session created', 'success');

        // Refresh session display
        this._refreshAdminSessionDisplay();
      } catch (error) {
        console.error('Failed to create session (standalone):', error);
        this.uiManager.showError(`Failed to create session: ${error.message}`);
      }
      return;
    }

    // Networked mode: Use SessionManager (existing code)
    if (!this.viewController.adminInstances?.sessionManager) {
      alert('Admin functions not available. Please ensure you are connected.');
      return;
    }

    try {
      await this.viewController.adminInstances.sessionManager.createSession(name);
      this.debug.log(`Session created: ${name}`);
    } catch (error) {
      console.error('Failed to create session:', error);
      this.uiManager.showError('Failed to create session. Check connection.');
    }
  }
```

### Step 4: Update adminPauseSession

Replace `adminPauseSession()` (around line 999):

```javascript
  async adminPauseSession() {
    const isStandalone = this.sessionModeManager?.isStandalone();

    // Standalone mode: Use UnifiedDataManager
    if (isStandalone) {
      try {
        const result = await this.dataManager.pauseSession();
        if (result.success) {
          this.debug.log('Session paused (standalone)');
          this.uiManager.showToast('Session paused', 'info');
          this._refreshAdminSessionDisplay();
        } else {
          this.uiManager.showError(result.error || 'Failed to pause session');
        }
      } catch (error) {
        console.error('Failed to pause session (standalone):', error);
        this.uiManager.showError(`Failed to pause session: ${error.message}`);
      }
      return;
    }

    // Networked mode (existing code)
    if (!this.viewController.adminInstances?.sessionManager) {
      alert('Admin functions not available.');
      return;
    }
    try {
      await this.viewController.adminInstances.sessionManager.pauseSession();
      this.debug.log('Session paused');
    } catch (error) {
      console.error('Failed to pause session:', error);
      this.uiManager.showError('Failed to pause session.');
    }
  }
```

### Step 5: Update adminResumeSession

Replace `adminResumeSession()` (around line 1013):

```javascript
  async adminResumeSession() {
    const isStandalone = this.sessionModeManager?.isStandalone();

    // Standalone mode: Use UnifiedDataManager
    if (isStandalone) {
      try {
        const result = await this.dataManager.resumeSession();
        if (result.success) {
          this.debug.log('Session resumed (standalone)');
          this.uiManager.showToast('Session resumed', 'success');
          this._refreshAdminSessionDisplay();
        } else {
          this.uiManager.showError(result.error || 'Failed to resume session');
        }
      } catch (error) {
        console.error('Failed to resume session (standalone):', error);
        this.uiManager.showError(`Failed to resume session: ${error.message}`);
      }
      return;
    }

    // Networked mode (existing code)
    if (!this.viewController.adminInstances?.sessionManager) {
      alert('Admin functions not available.');
      return;
    }
    try {
      await this.viewController.adminInstances.sessionManager.resumeSession();
      this.debug.log('Session resumed');
    } catch (error) {
      console.error('Failed to resume session:', error);
      this.uiManager.showError('Failed to resume session.');
    }
  }
```

### Step 6: Update adminEndSession

Replace `adminEndSession()` (around line 1027):

```javascript
  async adminEndSession() {
    if (!confirm('Are you sure you want to end the session?')) return;

    const isStandalone = this.sessionModeManager?.isStandalone();

    // Standalone mode: Use UnifiedDataManager
    if (isStandalone) {
      try {
        await this.dataManager.endSession();
        this.debug.log('Session ended (standalone)');
        this.uiManager.showToast('Session ended', 'info');
        this._refreshAdminSessionDisplay();
      } catch (error) {
        console.error('Failed to end session (standalone):', error);
        this.uiManager.showError(`Failed to end session: ${error.message}`);
      }
      return;
    }

    // Networked mode (existing code)
    if (!this.viewController.adminInstances?.sessionManager) {
      alert('Admin functions not available.');
      return;
    }
    try {
      await this.viewController.adminInstances.sessionManager.endSession();
      this.debug.log('Session ended');
    } catch (error) {
      console.error('Failed to end session:', error);
      this.uiManager.showError('Failed to end session.');
    }
  }
```

### Step 7: Update adminResetScores

Find and update `adminResetScores()` (search for it, likely around line 1140):

```javascript
  async adminResetScores() {
    if (!confirm('Reset all team scores to zero? Transactions will be preserved.')) return;

    const isStandalone = this.sessionModeManager?.isStandalone();

    // Standalone mode: Use UnifiedDataManager
    if (isStandalone) {
      try {
        const result = await this.dataManager.resetScores();
        if (result.success) {
          this.debug.log('Scores reset (standalone)');
          this.uiManager.showToast('All scores reset to zero', 'success');
        } else {
          this.uiManager.showError(result.error || 'Failed to reset scores');
        }
      } catch (error) {
        console.error('Failed to reset scores (standalone):', error);
        this.uiManager.showError(`Failed to reset scores: ${error.message}`);
      }
      return;
    }

    // Networked mode: Use AdminOps
    if (!this.viewController.adminInstances?.adminOps) {
      alert('Admin functions not available.');
      return;
    }
    try {
      await this.viewController.adminInstances.adminOps.resetScores();
      this.debug.log('Scores reset');
      this.uiManager.showToast('All scores reset', 'success');
    } catch (error) {
      console.error('Failed to reset scores:', error);
      this.uiManager.showError('Failed to reset scores.');
    }
  }
```

### Step 8: Add helper method for refreshing session display

Add this new method in the App class (around line 1380, near other helpers):

```javascript
  /**
   * Refresh admin session display (standalone mode)
   * @private
   */
  _refreshAdminSessionDisplay() {
    const container = document.getElementById('session-status-container');
    if (container && this.uiManager) {
      this.uiManager.renderSessionStatus(container);
    }
  }
```

### Step 9: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="app.test" --verbose
```

Expected: PASS

### Step 10: Commit

```bash
git add src/app/app.js tests/app/app.test.js
git commit -m "feat(app): update admin methods for dual-mode operation

All admin session methods now check for standalone mode and
use dataManager directly instead of requiring adminInstances.
Matches pattern established by adjustTeamScore/deleteTransaction.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add UIManager.renderSessionStatus()

**Files:**
- Modify: `src/ui/uiManager.js`
- Test: `tests/unit/ui/uiManager.test.js`

### Step 1: Write failing test

Add to `tests/unit/ui/uiManager.test.js`:

```javascript
describe('renderSessionStatus', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'session-status-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should render no-session state when no session exists', () => {
    uiManager.dataManager = {
      getCurrentSession: jest.fn(() => null)
    };

    uiManager.renderSessionStatus(container);

    expect(container.innerHTML).toContain('No Active Session');
    expect(container.innerHTML).toContain('data-action="app.adminCreateSession"');
  });

  it('should render active session state', () => {
    uiManager.dataManager = {
      getCurrentSession: jest.fn(() => ({
        sessionId: 'test-123',
        name: 'Friday Game',
        status: 'active',
        startTime: new Date().toISOString()
      }))
    };

    uiManager.renderSessionStatus(container);

    expect(container.innerHTML).toContain('Friday Game');
    expect(container.innerHTML).toContain('Active');
    expect(container.innerHTML).toContain('data-action="app.adminPauseSession"');
  });

  it('should render paused session state', () => {
    uiManager.dataManager = {
      getCurrentSession: jest.fn(() => ({
        sessionId: 'test-123',
        name: 'Friday Game',
        status: 'paused',
        startTime: new Date().toISOString()
      }))
    };

    uiManager.renderSessionStatus(container);

    expect(container.innerHTML).toContain('Paused');
    expect(container.innerHTML).toContain('data-action="app.adminResumeSession"');
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd ALNScanner && npm test -- --testPathPattern="uiManager.test" --testNamePattern="renderSessionStatus" --verbose
```

Expected: FAIL - `renderSessionStatus` not defined

### Step 3: Implement renderSessionStatus

In `src/ui/uiManager.js`, add after `renderScoreboard()` (around line 313):

```javascript
  /**
   * Render session status display (mode-agnostic)
   * Used by standalone mode admin panel
   * @param {HTMLElement} container - Container element
   */
  renderSessionStatus(container) {
    if (!container) return;

    const session = this.dataManager?.getCurrentSession?.();

    // No session
    if (!session) {
      container.innerHTML = `
        <div class="session-status session-status--empty">
          <p class="session-status__message">No Active Session</p>
          <p class="session-status__hint">Create a new session to begin tracking gameplay</p>
          <button class="btn btn-primary" data-action="app.adminCreateSession">
            Create New Session
          </button>
        </div>
      `;
      return;
    }

    // Calculate duration
    const startTime = new Date(session.startTime);
    const duration = this._formatDuration(Date.now() - startTime.getTime());

    // Paused session
    if (session.status === 'paused') {
      container.innerHTML = `
        <div class="session-status session-status--paused">
          <h4 class="session-status__header">
            <span class="session-status__icon">⏸️</span>
            <span>${this._escapeHtml(session.name || 'Session')}</span>
            <span class="session-status__badge session-status__badge--paused">Paused</span>
          </h4>
          <div class="session-status__details">
            <span>Started: ${startTime.toLocaleTimeString()}</span>
            <span>Duration: ${duration}</span>
          </div>
          <div class="session-status__actions">
            <button class="btn btn-primary" data-action="app.adminResumeSession">
              Resume Session
            </button>
            <button class="btn btn-danger" data-action="app.adminEndSession">
              End Session
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Active session (default)
    container.innerHTML = `
      <div class="session-status session-status--active">
        <h4 class="session-status__header">
          <span class="session-status__icon">🎮</span>
          <span>${this._escapeHtml(session.name || 'Session')}</span>
          <span class="session-status__badge session-status__badge--active">Active</span>
        </h4>
        <div class="session-status__details">
          <span>Started: ${startTime.toLocaleTimeString()}</span>
          <span>Duration: ${duration}</span>
        </div>
        <div class="session-status__actions">
          <button class="btn btn-secondary" data-action="app.adminPauseSession">
            Pause Session
          </button>
          <button class="btn btn-danger" data-action="app.adminEndSession">
            End Session
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Format duration in milliseconds to human readable
   * @private
   */
  _formatDuration(ms) {
    if (!ms || ms < 0) return '0m';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
```

### Step 4: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="uiManager.test" --verbose
```

Expected: PASS

### Step 5: Remove stale "networked only" check in renderGameActivity

In `src/ui/uiManager.js`, find `renderGameActivity()` (around line 745) and remove the stale check:

**Before:**
```javascript
  renderGameActivity(container, options = {}) {
    if (!container) return;

    const { showSummary = true, showFilters = true } = options;
    const dataSource = this.dataManager;
    if (!dataSource) return;

    // Check if getGameActivity exists (UnifiedDataManager delegates to strategy)
    if (typeof dataSource.getGameActivity !== 'function') {
      // Fall back to transactions for standalone mode
      container.innerHTML = `
        <div class="empty-state">
          <h3>Game Activity</h3>
          <p>Available in networked mode only</p>
        </div>
      `;
      return;
    }

    const { tokens, stats } = dataSource.getGameActivity();
```

**After:**
```javascript
  renderGameActivity(container, options = {}) {
    if (!container) return;

    const { showSummary = true, showFilters = true } = options;
    const dataSource = this.dataManager;
    if (!dataSource) return;

    // UnifiedDataManager delegates to strategy - both modes support this now
    const { tokens, stats } = dataSource.getGameActivity();
```

### Step 6: Run full test suite

```bash
cd ALNScanner && npm test
```

Expected: All tests pass

### Step 7: Commit

```bash
git add src/ui/uiManager.js tests/unit/ui/uiManager.test.js
git commit -m "feat(ui): add renderSessionStatus for standalone admin panel

- Add mode-agnostic session status rendering
- Remove stale 'networked only' check from renderGameActivity
- Add _formatDuration and _escapeHtml helper methods

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Enable viewSelector in Standalone Mode

**Files:**
- Modify: `src/app/app.js`
- Test: `tests/app/app.test.js`

### Step 1: Write failing test

Add to `tests/app/app.test.js` in the `ViewController` describe block:

```javascript
it('should show viewSelector in standalone mode', () => {
  mockSessionModeManager.isNetworked.mockReturnValue(false);
  mockSessionModeManager.isStandalone.mockReturnValue(true);

  app.viewController.init();

  expect(document.getElementById('viewSelector').style.display).toBe('flex');
});
```

### Step 2: Run test to verify it fails

```bash
cd ALNScanner && npm test -- --testPathPattern="app.test" --testNamePattern="viewSelector in standalone" --verbose
```

Expected: FAIL - viewSelector hidden in standalone mode

### Step 3: Update viewController.init()

In `src/app/app.js`, find `_createViewController()` (around line 170) and modify the `init()` method:

**Before:**
```javascript
      init() {
        // Initialize based on session mode
        if (app.sessionModeManager?.isNetworked()) {
          // Show view selector tabs in networked mode
          const viewSelector = document.getElementById('viewSelector');
          if (viewSelector) {
            viewSelector.style.display = 'flex';
          }
          // Admin modules will be initialized after connection
        }
      },
```

**After:**
```javascript
      init() {
        // Show view selector tabs in BOTH networked and standalone modes
        // Phase 3: Admin panel is now available in standalone mode
        const viewSelector = document.getElementById('viewSelector');
        if (viewSelector) {
          viewSelector.style.display = 'flex';
        }

        // Admin modules (WebSocket-based) only initialized in networked mode
        // Standalone admin operations use dataManager directly
      },
```

### Step 4: Also update _initializeStandaloneMode to call viewController.init()

Find `_initializeStandaloneMode()` in app.js and ensure it calls `viewController.init()`:

```javascript
  async _initializeStandaloneMode() {
    this.debug.log('Initializing standalone mode...');

    // Initialize the unified DataManager with LocalStorage strategy
    this.dataManager.sessionModeManager = this.sessionModeManager;
    await this.dataManager.initializeStandaloneMode();

    // Initialize view controller (shows admin tabs)
    this.viewController.init();

    // Initialize team entry UI
    this.initTeamEntryUI();

    this.debug.log('Standalone mode initialized');
  }
```

### Step 5: Run tests to verify they pass

```bash
cd ALNScanner && npm test -- --testPathPattern="app.test" --verbose
```

Expected: PASS

### Step 6: Commit

```bash
git add src/app/app.js tests/app/app.test.js
git commit -m "feat(app): enable viewSelector in standalone mode

Phase 3: Admin panel tabs now visible in both modes.
Standalone admin operations use dataManager directly,
while networked mode uses WebSocket-based admin modules.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Hide Networked-Only Admin Sections

**Files:**
- Modify: `src/styles/admin.css` (or create if needed)
- Modify: `index.html`

### Step 1: Add data attribute to networked-only sections

In `index.html`, add `data-requires="networked"` to Video Controls and System Status sections:

Find Video Controls section (around line 383):
```html
            <!-- Video Controls Section -->
            <section class="admin-section" data-requires="networked">
                <h3>Video Controls</h3>
```

Find System Status section (around line 456):
```html
            <!-- System Status Section -->
            <section class="admin-section" data-requires="networked">
                <h3>System Status</h3>
```

### Step 2: Add CSS to hide sections based on body class

Create or modify `src/styles/admin.css`:

```css
/* Phase 3: Hide networked-only sections in standalone mode */
body.standalone-mode [data-requires="networked"] {
  display: none !important;
}

/* Session status styling */
.session-status {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.session-status--empty {
  background: rgba(255, 152, 0, 0.1);
  text-align: center;
}

.session-status--active {
  background: rgba(76, 175, 80, 0.1);
}

.session-status--paused {
  background: rgba(255, 193, 7, 0.1);
}

.session-status__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.session-status__icon {
  font-size: 1.5em;
}

.session-status__badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
}

.session-status__badge--active {
  background: #4CAF50;
  color: white;
}

.session-status__badge--paused {
  background: #FFC107;
  color: black;
}

.session-status__details {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  font-size: 0.9em;
  color: #666;
}

.session-status__actions {
  display: flex;
  gap: 10px;
}

.session-status__message {
  font-size: 1.2em;
  margin-bottom: 5px;
}

.session-status__hint {
  color: #666;
  margin-bottom: 15px;
}
```

### Step 3: Add body class based on mode in App

In `src/app/app.js`, update `_initializeStandaloneMode()`:

```javascript
  async _initializeStandaloneMode() {
    this.debug.log('Initializing standalone mode...');

    // Add body class for CSS-based feature hiding
    document.body.classList.add('standalone-mode');
    document.body.classList.remove('networked-mode');

    // ... rest of existing code
```

Also update `_initializeNetworkedMode()` to add the opposite class:

```javascript
  async _initializeNetworkedMode() {
    // Add body class for CSS-based feature display
    document.body.classList.add('networked-mode');
    document.body.classList.remove('standalone-mode');

    // ... rest of existing code
```

### Step 4: Ensure admin.css is imported

In `src/styles/main.css` or `index.html`, ensure admin.css is imported:

```css
@import './admin.css';
```

Or in index.html if using direct link.

### Step 5: Test manually

```bash
cd ALNScanner && npm run dev
```

1. Select Standalone mode
2. Navigate to Admin tab
3. Verify Video Controls and System Status sections are hidden
4. Verify Session Management, Team Scores, and Game Activity are visible

### Step 6: Commit

```bash
git add index.html src/styles/admin.css src/app/app.js
git commit -m "feat(ui): hide networked-only admin sections in standalone

- Add data-requires='networked' attribute to Video/System sections
- Add CSS rule to hide sections based on body.standalone-mode class
- Add session status styling
- Set body class based on mode during initialization

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Register ScreenUpdateManager Handlers for Admin

**Files:**
- Modify: `src/main.js`

### Step 1: Add container handlers for standalone admin panel

In `src/main.js`, find the container handlers section (around line 182) and add:

```javascript
// Session status container - renders session state
screenUpdateManager.registerContainer('session-status-container', {
  'session:updated': (eventData, container) => {
    Debug.log('[main.js] Updating session-status-container');
    UIManager.renderSessionStatus(container);
  }
});
```

### Step 2: Connect to session:updated event

In `src/main.js`, update the `connectToDataSource` call to include `session:updated`:

```javascript
// Connect ScreenUpdateManager to UnifiedDataManager events
// Phase 2: Single connection - UnifiedDataManager emits all events
screenUpdateManager.connectToDataSource(DataManager, [
  'transaction:added',
  'transaction:deleted',
  'scores:cleared',
  'data:cleared',
  'game-state:updated',
  'team-score:updated',
  'player-scan:added',
  'session:updated'  // Phase 3: Session lifecycle events
]);
```

### Step 3: Add initial render call for standalone session status

In `src/main.js`, in the `initializeApp()` function, add after app initialization:

```javascript
async function initializeApp() {
  // ... existing code ...

  try {
    await app.init();
    Debug.log('Application initialization complete');

    // Phase 3: Initialize admin session display in standalone mode
    if (app.sessionModeManager?.isStandalone()) {
      const sessionContainer = document.getElementById('session-status-container');
      if (sessionContainer) {
        UIManager.renderSessionStatus(sessionContainer);
      }
    }

    // ... rest of existing code ...
```

### Step 4: Test manually

```bash
cd ALNScanner && npm run dev
```

1. Select Standalone mode
2. Navigate to Admin tab
3. Verify "No Active Session" appears with Create button
4. Create session
5. Verify session status updates
6. Pause session
7. Verify paused state shows with Resume button

### Step 5: Commit

```bash
git add src/main.js
git commit -m "feat(main): register ScreenUpdateManager handlers for admin

- Add session-status-container handler for session:updated events
- Connect to session:updated event from DataManager
- Initialize session display on standalone mode startup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Verification

### Step 1: Run full test suite

```bash
cd ALNScanner && npm test
```

Expected: All 862+ tests pass

### Step 2: Run build

```bash
cd ALNScanner && npm run build
```

Expected: Build succeeds

### Step 3: Manual E2E verification

```bash
cd ALNScanner && npm run dev
```

**Test Standalone Admin Flow:**

1. Select "Standalone Mode" on game mode screen
2. Verify view selector tabs appear (Scanner | Admin | Debug)
3. Switch to Admin tab
4. Verify Video Controls and System Status are HIDDEN
5. Verify Session Management shows "No Active Session"
6. Click "Create New Session", enter name
7. Verify session shows as "Active" with Pause/End buttons
8. Click "Pause Session"
9. Verify session shows as "Paused" with Resume/End buttons
10. Try to scan a token - verify it's rejected (session paused)
11. Click "Resume Session"
12. Scan a token - verify it's accepted
13. Check Team Scores section - verify team appears
14. Check Game Activity section - verify token appears
15. Click "Reset All Scores" - verify scores go to zero
16. Click "End Session" - verify returns to "No Active Session"

### Step 4: Update architecture plan

Update `docs/plans/gm-scanner-architecture-refactoring.md`:
- Mark Phase 3 as COMPLETE
- Update completion status table
- Document implemented features

### Step 5: Final commit

```bash
git add -A
git commit -m "docs: mark Phase 3 complete in architecture plan

Phase 3: Admin UI Parity - Complete
- Session lifecycle (create/pause/resume/end) in standalone
- Score reset in standalone
- viewSelector visible in both modes
- Networked-only sections hidden in standalone
- ScreenUpdateManager handlers for admin panel reactivity

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add pauseSession/resumeSession to IStorageStrategy | 🔲 |
| 2 | Block scanning when session paused | 🔲 |
| 3 | Add resetScores to LocalStorage | 🔲 |
| 4 | Update App admin methods for dual-mode | 🔲 |
| 5 | Add UIManager.renderSessionStatus() | 🔲 |
| 6 | Enable viewSelector in standalone mode | 🔲 |
| 7 | Hide networked-only admin sections | 🔲 |
| 8 | Register ScreenUpdateManager handlers | 🔲 |
| 9 | Final verification | 🔲 |

**Estimated effort:** 9 tasks, ~2-3 hours total

**Risk:** Low-Medium (builds on proven Phase 2 patterns)
