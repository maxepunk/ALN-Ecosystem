# Session Management Fix - Precise Implementation TODOs

**Created:** 2025-10-07
**Reference:** SESSION_MANAGEMENT_FIX_PLAN.md
**Status:** Ready to Execute

---

## Prerequisites

- [ ] **P1:** Verify git status clean or stash uncommitted work
  ```bash
  cd /home/pi/ALN-Ecosystem
  git status
  # If needed: git stash
  ```

- [ ] **P2:** Verify backend tests baseline (note any existing failures)
  ```bash
  cd backend
  # Individual test suites (faster, isolated):
  npx jest --testPathPattern=tests/unit --silent
  npx jest --testPathPattern=tests/contract --silent
  npx jest --testPathPattern=tests/integration --runInBand --silent
  # NOTE: Integration tests may have isolation issue causing timeout
  # Document which test if timeout occurs
  ```

- [ ] **P3:** Create feature branch
  ```bash
  git checkout -b fix/session-gamestate-derivation
  ```

---

## PHASE 1: Technical Fix - GameState Derivation

### 1.1: Remove Stored currentState Property

- [ ] **1.1.1:** Open `backend/src/services/stateService.js`

- [ ] **1.1.2:** Delete line 15: `this.currentState = null;`
  - Location: In `initState()` method
  - Confirm deletion doesn't break nearby code

- [ ] **1.1.3:** Search for all `this.currentState =` assignments
  ```bash
  cd backend
  grep -n "this.currentState =" src/services/stateService.js
  ```
  - Expected locations: lines ~104, ~145, ~152
  - Delete each assignment line

- [ ] **1.1.4:** Keep `this.vlcConnected` and `this.videoDisplayReady` properties
  - Location: Lines ~16-17 in `initState()`
  - These are needed for computed GameState
  - Do NOT delete these

---

### 1.2: Rewrite getCurrentState() as Computed Property

- [ ] **1.2.1:** Locate `getCurrentState()` method (line ~179-184)

- [ ] **1.2.2:** Replace entire method with:
  ```javascript
  /**
   * Get current game state - computed fresh from session
   * GameState is NOT stored - always derived from current session + system status
   * @returns {GameState|null}
   */
  getCurrentState() {
    const session = sessionService.getCurrentSession();
    if (!session) return null;

    // Always derive fresh from session
    return GameState.fromSession(session, {
      vlcConnected: this.vlcConnected || false,
      videoDisplayReady: this.videoDisplayReady || false,
      offline: offlineQueueService.isOffline || false
    });
  }
  ```

- [ ] **1.2.3:** Verify imports at top of file include:
  - `const sessionService = require('./sessionService');`
  - `const offlineQueueService = require('./offlineQueueService');`
  - `const GameState = require('../models/gameState');`

---

### 1.3: Update session:created Listener

- [ ] **1.3.1:** Locate `session:created` listener (lines ~96-120)

- [ ] **1.3.2:** Replace the try block content with:
  ```javascript
  try {
    logger.info('Session created event received', { sessionId: sessionData.id });

    // GameState is now computed on-demand, not stored
    // Just emit state:updated to trigger broadcasts
    const currentState = this.getCurrentState();
    if (currentState) {
      this.emit('state:updated', currentState.toJSON());
      logger.info('State updated after session creation', { sessionId: sessionData.id });
    } else {
      logger.warn('Could not derive GameState after session creation', { sessionId: sessionData.id });
    }
  } catch (error) {
    logger.error('Failed to emit state update after session:created', {
      error: error.message,
      stack: error.stack,
      sessionId: sessionData.id
    });
  }
  ```

- [ ] **1.3.3:** Delete the following lines from this listener:
  - `this.currentState = this.createStateFromSession(session);`
  - `await this.saveState();`
  - Keep the listener structure, only change what's inside

---

### 1.4: Update Other State Update Points

- [ ] **1.4.1:** Search for all `this.emit('state:updated'` calls
  ```bash
  grep -n "this.emit('state:updated'" src/services/stateService.js
  ```

- [ ] **1.4.2:** For each emit, ensure pattern is:
  ```javascript
  this.emit('state:updated', this.getCurrentState()?.toJSON());
  ```
  - Uses computed getCurrentState()
  - Uses optional chaining `?.toJSON()`
  - No stored state reference

- [ ] **1.4.3:** Update `updateSystemStatus()` method (lines ~201-214)
  - Ensure it emits using computed state:
  ```javascript
  updateSystemStatus(status) {
    if (status.vlcConnected !== undefined) {
      this.vlcConnected = status.vlcConnected;
    }
    if (status.videoDisplayReady !== undefined) {
      this.videoDisplayReady = status.videoDisplayReady;
    }

    // Emit updated state (computed from session + new status)
    const currentState = this.getCurrentState();
    if (currentState) {
      this.emit('state:updated', currentState.toJSON());
    }
  }
  ```

---

### 1.5: Clean Up State Persistence Calls

- [ ] **1.5.1:** Search for `await this.saveState()` calls
  ```bash
  grep -n "await this.saveState()" src/services/stateService.js
  ```

- [ ] **1.5.2:** Delete all `await this.saveState()` calls
  - GameState is no longer persisted
  - Session is persisted (that's the source of truth)
  - Keep the `saveState()` method itself (may be called elsewhere)

- [ ] **1.5.3:** Verify `loadState()` is not called in `init()`
  - We don't load GameState anymore
  - It's computed from loaded Session

---

### 1.6: Update App.js Startup Logic

- [ ] **1.6.1:** Open `backend/src/app.js`

- [ ] **1.6.2:** Locate lines 184-188 (session sync on startup)

- [ ] **1.6.3:** Replace with:
  ```javascript
  // GameState is now computed - verify it derives correctly
  const currentSession = sessionService.getCurrentSession();
  if (currentSession) {
    const currentState = stateService.getCurrentState();
    logger.info('Session loaded on startup', {
      sessionId: currentSession.id,
      status: currentSession.status,
      hasState: !!currentState
    });

    // Sanity check: state should exist if session exists
    if (!currentState) {
      logger.error('CRITICAL: Session exists but GameState failed to derive', {
        sessionId: currentSession.id
      });
    }
  } else {
    logger.info('No previous session - ready for new game');
  }
  ```

- [ ] **1.6.4:** Remove any `syncFromSession()` calls if they exist
  ```bash
  grep -n "syncFromSession" src/app.js
  ```

---

### 1.7: Verify and Test Phase 1

- [ ] **1.7.1:** Run unit tests for stateService
  ```bash
  cd backend
  npx jest tests/unit/services/stateService.test.js --verbose
  ```
  - Expected: Some tests may fail (they expect stored state)
  - Document failures for fixing in next step

- [ ] **1.7.2:** Run unit tests for sessionService
  ```bash
  npx jest tests/unit/services/sessionService.test.js --verbose
  ```
  - Should still pass (no changes to sessionService yet)

- [ ] **1.7.3:** Manual verification - start server
  ```bash
  npm run dev:no-video
  ```
  - Watch logs for errors
  - Should start without crashes
  - Ctrl+C to stop when verified

- [ ] **1.7.4:** Commit Phase 1 changes
  ```bash
  git add src/services/stateService.js src/app.js
  git commit -m "refactor(state): Convert GameState to computed property

  - Remove stored currentState (always derive from session)
  - Update getCurrentState() to compute from sessionService
  - Update session:created listener to emit without storing
  - Remove state persistence calls (session is source of truth)

  BREAKING: Tests expecting stored state will fail (next commit fixes)"
  ```

---

## PHASE 2: Fix Failing Tests

### 2.1: Update stateService Unit Tests

- [ ] **2.1.1:** Open `backend/tests/unit/services/stateService.test.js`

- [ ] **2.1.2:** Find tests that check `stateService.currentState`
  ```bash
  grep -n "currentState" tests/unit/services/stateService.test.js
  ```

- [ ] **2.1.3:** Replace `stateService.currentState` with `stateService.getCurrentState()`
  - Update all test assertions
  - Update all test expectations

- [ ] **2.1.4:** Find tests that mock session creation
  - Ensure they mock `sessionService.getCurrentSession()` to return session
  - GameState will derive from this mock

- [ ] **2.1.5:** Run stateService tests
  ```bash
  npx jest tests/unit/services/stateService.test.js --verbose
  ```
  - All tests should pass now
  - If failures remain, debug and fix

---

### 2.2: Update Contract Tests

- [ ] **2.2.1:** Search for state-related contract test failures
  ```bash
  npx jest --testPathPattern=tests/contract --silent 2>&1 | grep -i "fail\|error"
  ```

- [ ] **2.2.2:** If websocket/session-events.test.js fails:
  - Check if it expects `currentState` property
  - Update to use `getCurrentState()`

- [ ] **2.2.3:** Run contract tests
  ```bash
  npx jest --testPathPattern=tests/contract --verbose
  ```
  - All should pass
  - Document any persistent failures

---

### 2.3: Update Integration Tests

- [ ] **2.3.1:** Check admin-interventions.test.js
  ```bash
  npx jest tests/integration/admin-interventions.test.js --runInBand --verbose
  ```
  - May timeout due to isolation issue (known problem)
  - If fails for reasons other than timeout, investigate

- [ ] **2.3.2:** Check nfc-integration.test.js
  ```bash
  npx jest tests/integration/nfc-integration.test.js --runInBand --verbose
  ```

- [ ] **2.3.3:** Update any tests checking state persistence
  - State is no longer saved to disk
  - Tests should check session persistence instead

---

### 2.4: Commit Test Fixes

- [ ] **2.4.1:** Run all unit + contract tests
  ```bash
  npx jest --testPathPattern=tests/unit --silent
  npx jest --testPathPattern=tests/contract --silent
  ```
  - Should have no failures (except known integration timeout)

- [ ] **2.4.2:** Commit test updates
  ```bash
  git add tests/
  git commit -m "test: Update tests for computed GameState

  - Replace currentState references with getCurrentState()
  - Update mocks to return session for derivation
  - Remove state persistence test expectations"
  ```

---

## PHASE 3: Backend UX - system:reset Enhancement

### 3.1: Add Archiving to system:reset

- [ ] **3.1.1:** Open `backend/src/websocket/adminEvents.js`

- [ ] **3.1.2:** Locate `case 'system:reset':` (line ~201-213)

- [ ] **3.1.3:** Replace entire case block with:
  ```javascript
  case 'system:reset': {
    // System reset - FR 4.2.5 (full reset with archiving)
    const currentSession = sessionService.getCurrentSession();

    // Archive completed sessions before destroying them
    if (currentSession) {
      if (currentSession.status === 'completed') {
        await persistenceService.archiveSession(currentSession.toJSON());
        logger.info('Completed session archived before system reset', {
          sessionId: currentSession.id,
          gmStation: socket.deviceId
        });
      } else {
        logger.warn('Active session being reset by GM', {
          sessionId: currentSession.id,
          status: currentSession.status,
          gmStation: socket.deviceId
        });
      }
    }

    // End current session (if any)
    await sessionService.endSession();

    // Reset all services
    await sessionService.reset();
    transactionService.reset();
    videoQueueService.clearQueue();

    resultMessage = 'System reset complete - ready for new session';
    logger.info('System reset by GM', { gmStation: socket.deviceId });
    break;
  }
  ```

- [ ] **3.1.4:** Add block scope with curly braces (note: `case 'system:reset': {`)
  - Allows `const currentSession` declaration
  - Prevents variable declaration errors

---

### 3.2: Test system:reset Command

- [ ] **3.2.1:** Start orchestrator
  ```bash
  cd backend
  npm run dev:no-video
  ```

- [ ] **3.2.2:** Open GM Scanner in browser
  - URL: http://localhost:3000/gm-scanner/
  - Open DevTools console

- [ ] **3.2.3:** Connect to WebSocket and send test command
  ```javascript
  // In browser console:
  // (Connection should auto-establish when page loads)

  // Send system:reset command
  window.connectionManager.client.socket.emit('gm:command', {
    event: 'gm:command',
    data: {
      action: 'system:reset',
      payload: {}
    },
    timestamp: new Date().toISOString()
  });
  ```

- [ ] **3.2.4:** Verify in orchestrator logs:
  - "System reset by GM" message
  - No errors
  - If session existed: archiving log message

- [ ] **3.2.5:** Stop orchestrator (Ctrl+C)

---

### 3.3: Commit Backend Changes

- [ ] **3.3.1:** Verify changes
  ```bash
  git diff src/websocket/adminEvents.js
  ```

- [ ] **3.3.2:** Commit
  ```bash
  git add src/websocket/adminEvents.js
  git commit -m "feat(admin): Archive completed sessions in system:reset

  - Add archiving logic before system reset
  - Preserve completed session data in archive storage
  - Log warning if resetting active session
  - Maintains existing system:reset contract compliance"
  ```

---

## PHASE 4: Frontend UX - Admin Panel Updates

### 4.1: Update HTML Structure

- [ ] **4.1.1:** Open `ALNScanner/index.html`

- [ ] **4.1.2:** Locate Session Management section (lines 1714-1726)

- [ ] **4.1.3:** Replace entire `<section class="admin-section">` with:
  ```html
  <!-- Session Management Section -->
  <section class="admin-section">
      <h3>Session Management</h3>
      <!-- Dynamic status container updated by MonitoringDisplay -->
      <div id="session-status-container">
          <!-- Content rendered by updateSessionDisplay() based on session state -->
      </div>
  </section>
  ```

- [ ] **4.1.4:** Delete old elements:
  - `<div id="session-info" class="info-row">` and children
  - `<div class="session-controls">` and buttons
  - All static session buttons (New Session, Pause, Resume, End)

- [ ] **4.1.5:** Save file

---

### 4.2: Rewrite updateSessionDisplay()

- [ ] **4.2.1:** Open `ALNScanner/js/utils/adminModule.js`

- [ ] **4.2.2:** Locate `updateSessionDisplay(session)` method (lines ~544-555)

- [ ] **4.2.3:** Replace entire method with:
  ```javascript
  /**
   * Update session display with rich status UI
   * Shows different UI for each session state: null, active, paused, completed
   */
  updateSessionDisplay(session) {
    const container = document.getElementById('session-status-container');
    if (!container) {
      console.warn('session-status-container not found in DOM');
      return;
    }

    // STATE: No session
    if (!session) {
      container.innerHTML = `
        <div class="session-status empty" style="text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <p style="color: #666; margin-bottom: 15px; font-size: 14px;">No Active Session</p>
          <p style="color: #999; margin-bottom: 15px; font-size: 12px;">Create a new session to begin tracking gameplay</p>
          <button class="btn btn-primary" onclick="App.adminCreateSession()" style="padding: 10px 20px;">
            Create New Session
          </button>
        </div>
      `;
      return;
    }

    // STATE: Completed session
    if (session.status === 'completed') {
      const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'Unknown';
      const duration = session.getDuration ? this.formatDuration(session.getDuration()) : 'Unknown';

      container.innerHTML = `
        <div class="session-status completed" style="background: #fff3e0; padding: 15px; border-radius: 8px; border: 2px solid #ff9800;">
          <h4 style="margin: 0 0 10px 0; color: #e65100; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">⚠️</span>
            <span>Previous Session Completed</span>
          </h4>
          <div style="margin-bottom: 12px;">
            <p style="margin: 5px 0; font-weight: bold; color: #333;">${this.escapeHtml(session.name || 'Unnamed Session')}</p>
            <p style="margin: 3px 0; color: #666; font-size: 13px;">Ended: ${this.escapeHtml(endTime)}</p>
            <p style="margin: 3px 0; color: #666; font-size: 13px;">Duration: ${this.escapeHtml(duration)}</p>
            <p style="margin: 3px 0; color: #666; font-size: 13px;">Total Scans: ${session.metadata?.totalScans || 0}</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="App.adminResetAndCreateNew()" style="flex: 1; min-width: 150px;">
              Reset & Start New Session
            </button>
            <button class="btn" onclick="App.adminViewSessionDetails()" style="flex: 0;">
              View Details
            </button>
          </div>
          <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #ffb74d; color: #e65100; font-size: 12px;">
            💡 Start a new session to continue gameplay
          </p>
        </div>
      `;
      return;
    }

    // STATE: Paused session
    if (session.status === 'paused') {
      const startTime = session.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown';

      container.innerHTML = `
        <div class="session-status paused" style="background: #e3f2fd; padding: 15px; border-radius: 8px; border: 2px solid #2196f3;">
          <h4 style="margin: 0 0 10px 0; color: #1565c0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">⏸️</span>
            <span>Session Paused</span>
          </h4>
          <div style="margin-bottom: 12px;">
            <p style="margin: 5px 0; font-weight: bold; color: #333;">${this.escapeHtml(session.name || 'Session')}</p>
            <p style="margin: 3px 0; color: #666; font-size: 13px;">Started: ${this.escapeHtml(startTime)}</p>
            <p style="margin: 3px 0; color: #666; font-size: 13px;">Scans: ${session.metadata?.totalScans || 0}</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="App.adminResumeSession()" style="flex: 1;">
              Resume Session
            </button>
            <button class="btn btn-danger" onclick="App.adminEndSession()">
              End Session
            </button>
          </div>
        </div>
      `;
      return;
    }

    // STATE: Active session (default)
    const startTime = session.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown';
    const totalScans = session.metadata?.totalScans || 0;

    container.innerHTML = `
      <div class="session-status active" style="background: #e8f5e9; padding: 15px; border-radius: 8px; border: 2px solid #4caf50;">
        <h4 style="margin: 0 0 10px 0; color: #2e7d32; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">✅</span>
          <span>${this.escapeHtml(session.name || 'Active Session')}</span>
        </h4>
        <div style="margin-bottom: 12px;">
          <p style="margin: 3px 0; color: #666; font-size: 13px;">Started: ${this.escapeHtml(startTime)}</p>
          <p style="margin: 3px 0; color: #666; font-size: 13px;">Total Scans: ${totalScans}</p>
          <p style="margin: 3px 0; color: #666; font-size: 13px;">Status: <span style="color: #2e7d32; font-weight: bold;">Active</span></p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn" onclick="App.adminPauseSession()">
            Pause
          </button>
          <button class="btn btn-danger" onclick="App.adminEndSession()">
            End Session
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Helper: Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Helper: Format duration in ms to human readable
   */
  formatDuration(ms) {
    if (!ms || ms < 0) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  ```

- [ ] **4.2.4:** Save file

- [ ] **4.2.5:** Note: Added helper methods `escapeHtml()` and `formatDuration()`
  - Place these after `updateSessionDisplay()` in the MonitoringDisplay class
  - They prevent XSS and format duration nicely

---

### 4.3: Add Frontend Admin Methods

- [ ] **4.3.1:** Open `ALNScanner/js/app/app.js`

- [ ] **4.3.2:** Locate `adminEndSession()` method (around line 278)

- [ ] **4.3.3:** After `adminEndSession()`, add new methods:
  ```javascript
  async adminResetAndCreateNew() {
    // Step 0: Confirm with user
    const confirmReset = confirm(
      'Reset system and start new session?\n\n' +
      'This will:\n' +
      '• Archive the current completed session\n' +
      '• Clear all current data\n' +
      '• Prepare system for a new game\n\n' +
      'Continue?'
    );

    if (!confirmReset) return;

    // Step 1: Get new session name
    const name = prompt('Enter new session name:');
    if (!name || name.trim() === '') {
      alert('Session name is required');
      return;
    }

    // Step 2: Verify admin instances available
    if (!App.viewController.adminInstances?.sessionManager) {
      alert('Admin functions not available. Please ensure you are connected to the orchestrator.');
      return;
    }

    try {
      // Step 3: Send system:reset command
      Debug.log('Sending system:reset command...');

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('System reset timeout (5s)'));
        }, 5000);

        const socket = App.viewController.adminInstances.sessionManager.connection.socket;

        socket.once('gm:command:ack', (response) => {
          clearTimeout(timeout);

          if (response.data && response.data.success) {
            Debug.log('System reset successful');
            resolve();
          } else {
            const errorMsg = response.data?.message || 'Reset failed';
            reject(new Error(errorMsg));
          }
        });

        socket.emit('gm:command', {
          event: 'gm:command',
          data: {
            action: 'system:reset',
            payload: {}
          },
          timestamp: new Date().toISOString()
        });
      });

      Debug.log('System reset complete, creating new session...');

      // Step 4: Create new session
      await App.viewController.adminInstances.sessionManager.createSession(name.trim());

      Debug.log(`New session created: ${name}`);

      // Step 5: Show success feedback
      if (UIManager.showToast) {
        UIManager.showToast(`Session "${name}" started successfully`, 'success', 5000);
      } else {
        alert(`Session "${name}" created successfully!`);
      }

    } catch (error) {
      console.error('Failed to reset and create session:', error);

      const errorMsg = `Failed to reset and create session: ${error.message}`;

      if (UIManager.showError) {
        UIManager.showError(errorMsg);
      } else {
        alert(errorMsg);
      }
    }
  },

  async adminViewSessionDetails() {
    const session = App.viewController.adminInstances?.sessionManager?.currentSession;

    if (!session) {
      alert('No session data available');
      return;
    }

    // Format session details
    const startTime = session.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown';
    const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'Ongoing';
    const duration = session.getDuration ? this.formatSessionDuration(session.getDuration()) : 'Unknown';

    const details = `
═══════════════════════════════════
SESSION DETAILS
═══════════════════════════════════

Name: ${session.name || 'Unnamed Session'}
ID: ${session.id}
Status: ${session.status.toUpperCase()}

TIMING
──────────────────────────────────
Started: ${startTime}
${session.endTime ? 'Ended: ' + endTime : 'Status: In Progress'}
Duration: ${duration}

STATISTICS
──────────────────────────────────
Total Scans: ${session.metadata?.totalScans || 0}
Unique Tokens: ${session.metadata?.uniqueTokensScanned?.length || 0}
Teams: ${session.scores?.length || 0}
GM Stations: ${session.connectedDevices?.filter(d => d.type === 'gm').length || 0}

═══════════════════════════════════
    `.trim();

    alert(details);
  },

  /**
   * Helper: Format duration for session details
   */
  formatSessionDuration(ms) {
    if (!ms || ms < 0) return 'Unknown';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0 && parts.length < 2) parts.push(`${seconds % 60}s`);

    return parts.length > 0 ? parts.join(' ') : '0s';
  },
  ```

- [ ] **4.3.4:** Save file

---

### 4.4: Test Frontend Changes Locally

- [ ] **4.4.1:** Start orchestrator
  ```bash
  cd /home/pi/ALN-Ecosystem/backend
  npm run dev:no-video
  ```

- [ ] **4.4.2:** Open GM Scanner
  - URL: http://localhost:3000/gm-scanner/
  - Click "Admin" tab

- [ ] **4.4.3:** Test NO SESSION state
  - Should see: "Create New Session" button
  - UI should be clean, centered, with gray background

- [ ] **4.4.4:** Create a session
  - Click "Create New Session"
  - Enter name: "Test Session 1"
  - Verify: Green active session card appears
  - Should show: session name, start time, 0 scans, Pause/End buttons

- [ ] **4.4.5:** Test PAUSED state
  - Click "Pause" button
  - Verify: Blue paused session card appears
  - Should show: Resume/End buttons

- [ ] **4.4.6:** Test back to ACTIVE
  - Click "Resume"
  - Verify: Green active card returns

- [ ] **4.4.7:** Test COMPLETED state
  - Click "End Session"
  - Verify: Orange completed session card appears
  - Should show: "Reset & Start New Session" button and "View Details" button

- [ ] **4.4.8:** Test "View Details"
  - Click "View Details" button
  - Verify: Alert shows formatted session details
  - Check all fields populated correctly

- [ ] **4.4.9:** Test "Reset & Start New Session"
  - Click "Reset & Start New Session"
  - Verify: Confirmation dialog appears
  - Click OK
  - Enter new session name: "Test Session 2"
  - Verify: New green active session card appears
  - Check orchestrator logs for: "Completed session archived before system reset"

- [ ] **4.4.10:** Stop orchestrator (Ctrl+C)

---

### 4.5: Commit Frontend Changes

- [ ] **4.5.1:** Review changes
  ```bash
  git diff ALNScanner/
  ```

- [ ] **4.5.2:** Commit
  ```bash
  git add ALNScanner/index.html ALNScanner/js/utils/adminModule.js ALNScanner/js/app/app.js
  git commit -m "feat(ui): Add rich session status UI to admin panel

  - Replace static session info with dynamic container
  - Show distinct UI for each session state (null/active/paused/completed)
  - Add 'Reset & Start New Session' workflow for completed sessions
  - Add 'View Details' modal for session information
  - Implement system:reset + create sequence in frontend
  - Add XSS protection and duration formatting helpers"
  ```

---

## PHASE 5: Integration Testing

### 5.1: Test Orchestrator Restart with Active Session

- [ ] **5.1.1:** Start fresh orchestrator
  ```bash
  cd backend
  npm run dev:no-video
  ```

- [ ] **5.1.2:** Create test session via GM Scanner
  - Open http://localhost:3000/gm-scanner/
  - Admin tab → Create session: "Crash Test Session"
  - Verify session created (green card)

- [ ] **5.1.3:** Scan some tokens (simulate gameplay)
  - Black Market tab → Set team: 001
  - Scan 5-10 tokens (use Manual Entry if no NFC)
  - Note: Total scans count

- [ ] **5.1.4:** Stop orchestrator (simulate crash)
  ```bash
  # In orchestrator terminal: Ctrl+C
  ```

- [ ] **5.1.5:** Restart orchestrator
  ```bash
  npm run dev:no-video
  ```

- [ ] **5.1.6:** Verify logs show session loaded
  ```
  Look for: "Session loaded on startup"
  Should show: sessionId, status: "active", hasState: true
  Should NOT show: "GameState failed to derive"
  ```

- [ ] **5.1.7:** Reconnect GM Scanner (refresh page)
  - Admin tab should show active session
  - Session name: "Crash Test Session"
  - Total scans should match previous count
  - ✅ **SUCCESS**: Session and state recovered

- [ ] **5.1.8:** End session and stop orchestrator
  ```bash
  # In browser: End Session
  # In terminal: Ctrl+C
  ```

---

### 5.2: Test Orchestrator Restart with Completed Session

- [ ] **5.2.1:** Create and complete a session
  ```bash
  # Start orchestrator
  npm run dev:no-video
  ```
  - Create session: "Completed Test Session"
  - Immediately end it (don't need to scan)

- [ ] **5.2.2:** Verify completed state in browser
  - Should show orange "Previous Session Completed" card

- [ ] **5.2.3:** Restart orchestrator
  ```bash
  # Ctrl+C to stop
  npm run dev:no-video
  ```

- [ ] **5.2.4:** Verify logs
  ```
  Should show: "Session loaded on startup"
  sessionId: [id], status: "completed", hasState: true
  ```

- [ ] **5.2.5:** Refresh GM Scanner
  - Admin tab should show completed session card
  - Orange background, "Reset & Start New Session" button
  - ✅ **SUCCESS**: Completed session UI works after restart

- [ ] **5.2.6:** Test reset workflow
  - Click "Reset & Start New Session"
  - Confirm dialog → OK
  - Enter name: "Fresh Session"
  - Verify: Green active card appears with new name

- [ ] **5.2.7:** Check orchestrator logs
  ```
  Should show: "Completed session archived before system reset"
  Should show: "System reset by GM"
  Should show: "Session created by GM" with new name
  ```

- [ ] **5.2.8:** Stop orchestrator

---

### 5.3: Test Multi-Device Sync

- [ ] **5.3.1:** Start orchestrator
  ```bash
  npm run dev:no-video
  ```

- [ ] **5.3.2:** Open TWO browser windows
  - Window A: http://localhost:3000/gm-scanner/ (Admin tab)
  - Window B: http://localhost:3000/gm-scanner/ (Admin tab)

- [ ] **5.3.3:** Create session in Window A
  - Create session: "Sync Test"
  - Verify: Window B updates automatically (shows green active card)

- [ ] **5.3.4:** Pause session in Window B
  - Click Pause
  - Verify: Window A updates to blue paused card

- [ ] **5.3.5:** Resume in Window A
  - Click Resume
  - Verify: Window B updates to green active card

- [ ] **5.3.6:** End in Window B
  - Click End Session
  - Verify: Window A updates to orange completed card

- [ ] **5.3.7:** ✅ **SUCCESS**: Real-time sync working

- [ ] **5.3.8:** Stop orchestrator

---

### 5.4: Run Automated Test Suites

- [ ] **5.4.1:** Run unit tests
  ```bash
  cd backend
  npx jest --testPathPattern=tests/unit --silent
  ```
  - Note any failures
  - Expected: All pass (we fixed stateService tests)

- [ ] **5.4.2:** Run contract tests
  ```bash
  npx jest --testPathPattern=tests/contract --silent
  ```
  - Note any failures
  - Expected: All pass

- [ ] **5.4.3:** Run integration tests (may timeout)
  ```bash
  npx jest --testPathPattern=tests/integration --runInBand --silent
  ```
  - Note: Known isolation issue may cause timeout
  - Document which test times out
  - Other tests should pass

- [ ] **5.4.4:** Document test results
  ```bash
  # Create test results file
  echo "Test Results - Session Management Fix" > test-results.txt
  echo "=====================================" >> test-results.txt
  echo "" >> test-results.txt
  echo "Unit Tests:" >> test-results.txt
  npx jest --testPathPattern=tests/unit --silent 2>&1 | tail -5 >> test-results.txt
  echo "" >> test-results.txt
  echo "Contract Tests:" >> test-results.txt
  npx jest --testPathPattern=tests/contract --silent 2>&1 | tail -5 >> test-results.txt
  echo "" >> test-results.txt
  echo "Integration Tests:" >> test-results.txt
  npx jest --testPathPattern=tests/integration --runInBand --silent 2>&1 | tail -10 >> test-results.txt

  cat test-results.txt
  ```

---

## PHASE 6: Documentation & Finalization

### 6.1: Update Documentation

- [ ] **6.1.1:** Update CLAUDE.md
  ```bash
  # Open in editor
  nano CLAUDE.md
  ```
  - Find "Core Services Architecture" section
  - Update stateService description:
  ```
  - **stateService**: Game state coordination (computed from session + live status)
    - getCurrentState() derives GameState on-demand from sessionService
    - Not persisted (derived from Session which IS persisted)
    - Aggregates: session data + VLC status + offline status
  ```
  - Save (Ctrl+O, Enter, Ctrl+X)

- [ ] **6.1.2:** Add inline comment in stateService.js
  ```javascript
  // At top of getCurrentState() method:
  /**
   * ARCHITECTURAL NOTE: GameState is a COMPUTED VIEW, not a stored entity.
   * It's always derived fresh from the current session + live system status.
   * This eliminates sync bugs on orchestrator restart and ensures state
   * always matches session (single source of truth pattern).
   */
  ```

- [ ] **6.1.3:** Add inline comment in adminEvents.js
  ```javascript
  // In system:reset case block:
  // Archive completed sessions before reset to preserve game history
  ```

- [ ] **6.1.4:** Commit docs
  ```bash
  git add CLAUDE.md src/services/stateService.js src/websocket/adminEvents.js
  git commit -m "docs: Update architecture docs for computed GameState

  - Document GameState as derived view in CLAUDE.md
  - Add architectural note to stateService.getCurrentState()
  - Comment archiving behavior in system:reset"
  ```

---

### 6.2: Final Verification

- [ ] **6.2.1:** Review all commits
  ```bash
  git log --oneline fix/session-gamestate-derivation
  ```
  - Should see ~6-7 commits
  - Each with clear, descriptive messages

- [ ] **6.2.2:** Check git status
  ```bash
  git status
  ```
  - Should be clean (all changes committed)

- [ ] **6.2.3:** Run full test suite one more time
  ```bash
  npx jest --testPathPattern=tests/unit --silent
  npx jest --testPathPattern=tests/contract --silent
  # Integration may timeout (known issue), that's OK
  ```

- [ ] **6.2.4:** Verify no debug code left
  ```bash
  grep -r "console.log" src/ | grep -v "// console.log" | grep -v node_modules
  # Should find none (or only intentional logs)
  ```

---

### 6.3: Merge to Main

- [ ] **6.3.1:** Switch to main and pull
  ```bash
  git checkout main
  git pull origin main
  ```

- [ ] **6.3.2:** Merge feature branch
  ```bash
  git merge fix/session-gamestate-derivation --no-ff
  ```
  - Creates merge commit
  - Preserves feature branch history

- [ ] **6.3.3:** Verify merge
  ```bash
  git log --oneline -10
  # Should show merge commit + all feature commits
  ```

- [ ] **6.3.4:** Push to remote
  ```bash
  git push origin main
  ```

---

## PHASE 7: Production Deployment

### 7.1: Deploy to Raspberry Pi

- [ ] **7.1.1:** SSH to Pi
  ```bash
  ssh pi@aln-orchestrator.local
  # Or: ssh pi@10.0.0.176
  ```

- [ ] **7.1.2:** Navigate to project
  ```bash
  cd ALN-Ecosystem
  ```

- [ ] **7.1.3:** Check current status
  ```bash
  cd backend
  npm run prod:status
  # Note running processes
  ```

- [ ] **7.1.4:** Pull latest code
  ```bash
  cd /home/pi/ALN-Ecosystem
  git pull origin main
  ```

- [ ] **7.1.5:** Install dependencies (if package.json changed)
  ```bash
  cd backend
  npm install
  # Unlikely to be needed, but check anyway
  ```

- [ ] **7.1.6:** Restart services
  ```bash
  npm run prod:restart
  ```

- [ ] **7.1.7:** Check logs for errors
  ```bash
  npm run prod:logs
  # Watch for 30 seconds
  # Ctrl+C to exit
  ```

- [ ] **7.1.8:** Verify services running
  ```bash
  npm run prod:status
  # Both aln-orchestrator and vlc-http should be "online"
  ```

---

### 7.2: Production Smoke Test

- [ ] **7.2.1:** Open GM Scanner from another device
  - URL: http://aln-orchestrator.local:3000/gm-scanner/
  - Or: http://10.0.0.176:3000/gm-scanner/

- [ ] **7.2.2:** Test session creation
  - Admin tab → Create New Session
  - Name: "Production Test [DATE]"
  - Verify: Green active session card appears

- [ ] **7.2.3:** Test token scanning
  - Black Market tab
  - Set team: 001
  - Scan 2-3 tokens
  - Verify: Scores update

- [ ] **7.2.4:** Test session end
  - Admin tab → End Session
  - Verify: Orange completed session card

- [ ] **7.2.5:** Test reset workflow
  - Click "Reset & Start New Session"
  - Confirm → Enter name: "Production Live"
  - Verify: New session created

- [ ] **7.2.6:** Test orchestrator restart resilience
  ```bash
  # On Pi via SSH:
  npm run prod:restart
  ```
  - Wait 10 seconds
  - Refresh GM Scanner
  - Verify: Session still shown (active)
  - ✅ **SUCCESS**: Production deployment complete

---

### 7.3: Monitor Production

- [ ] **7.3.1:** Watch logs for 5 minutes
  ```bash
  npm run prod:logs
  ```
  - Look for errors
  - Look for "GameState failed to derive" (should NOT appear)
  - Look for normal operation logs

- [ ] **7.3.2:** Check for warnings
  ```bash
  npm run prod:logs | grep -i warn
  ```
  - Document any warnings
  - Determine if action needed

- [ ] **7.3.3:** Verify disk space
  ```bash
  df -h
  # Check root filesystem usage
  # Should have >500MB free
  ```

- [ ] **7.3.4:** Exit SSH
  ```bash
  exit
  ```

---

## SUCCESS CRITERIA CHECKLIST

### Technical
- [ ] GameState always derives when Session exists (no null state bug)
- [ ] Orchestrator restart with active session works correctly
- [ ] Orchestrator restart with completed session shows proper UI
- [ ] system:reset archives completed sessions before reset
- [ ] Unit tests pass (stateService, sessionService)
- [ ] Contract tests pass
- [ ] No "GameState failed to derive" errors in logs

### UX
- [ ] Admin panel shows distinct UI for each session state
- [ ] Completed session workflow is clear (Reset & Start New button)
- [ ] Session details view shows formatted information
- [ ] Real-time sync works across multiple GM scanners
- [ ] No confusion about next steps in any state

### Architecture
- [ ] GameState is computed view (not stored entity)
- [ ] Session is single source of truth
- [ ] No new WebSocket commands added (uses system:reset)
- [ ] No AsyncAPI contract changes needed
- [ ] Event-driven fragility eliminated

---

## ROLLBACK PROCEDURE

**If critical issues found in production:**

```bash
# On development machine:
git revert [merge-commit-hash] --no-edit
git push origin main

# On Raspberry Pi:
ssh pi@aln-orchestrator.local
cd ALN-Ecosystem
git pull origin main
cd backend
npm run prod:restart
npm run prod:logs  # Verify rollback successful
```

---

## KNOWN ISSUES

1. **Integration Test Timeout**
   - Issue: One integration test may timeout due to test isolation problem
   - Impact: Does not affect functionality, only test suite
   - Action: Document which test, continue with deployment
   - Future: Fix test isolation in separate PR

2. **Disk Space Warning**
   - Issue: Pi root filesystem 96% full (from ENVIRONMENT.md)
   - Impact: May affect logs and video storage
   - Action: Monitor, clean up old logs if needed
   - Command: `npm run clean:logs` if space critical

---

**END OF PRECISE TODOS**
