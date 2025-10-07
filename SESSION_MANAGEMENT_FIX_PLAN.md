# Session Management Fix - Implementation Plan

**Created:** 2025-10-07
**Status:** Ready for Implementation
**Estimated Time:** 4-6 hours

---

## Executive Summary

This plan addresses two critical issues in the ALN Ecosystem session management:

1. **Technical Bug:** GameState not created when sessions are loaded from disk (orchestrator restart)
2. **UX Gap:** No clear workflow for transitioning from completed session to new game

**Solution Approach:**
- Fix root cause: Make GameState a computed view (not stored entity)
- Add UX workflow: Guide GM through completed session → new session transition
- Use existing infrastructure: Leverage `system:reset` command (already in contract)

---

## Prerequisites

**Before Starting:**
- [ ] All tests passing (run `npm test` in backend/)
- [ ] Git working directory clean or changes stashed
- [ ] Backend running locally for manual testing
- [ ] GM Scanner accessible for UI testing

**Required Knowledge:**
- Session lifecycle (active → paused → completed)
- GameState vs Session distinction
- WebSocket event flow (gm:command, session:update, sync:full)
- GM Scanner admin panel architecture (MonitoringDisplay pattern)

---

## Phase 1: Technical Fix - GameState Derivation

**Goal:** Eliminate event-driven GameState creation bug

### Task 1.1: Convert GameState to Computed Property

**File:** `backend/src/services/stateService.js`
**Lines:** 179-184, 96-120
**Estimated Time:** 30 minutes

**Subtasks:**

1. **Remove stored currentState property**
   - [ ] Delete line 15: `this.currentState = null;`
   - [ ] Remove all assignments to `this.currentState` (lines 104, 145, 152, etc.)

2. **Rewrite getCurrentState() as computed property**
   ```javascript
   // Lines 179-184 - Replace entire method
   getCurrentState() {
     const session = sessionService.getCurrentSession();
     if (!session) return null;

     // Always derive fresh from session + live system status
     return GameState.fromSession(session, {
       vlcConnected: this.vlcConnected || false,
       videoDisplayReady: this.videoDisplayReady || false,
       offline: offlineQueueService.isOffline || false
     });
   }
   ```

3. **Keep ephemeral system status flags**
   - [ ] Retain `this.vlcConnected` property (used in derivation)
   - [ ] Retain `this.videoDisplayReady` property (used in derivation)
   - [ ] Keep `updateSystemStatus()` method (lines 201-214) - updates flags

4. **Update event handlers to emit without storing**
   - [ ] Lines 97-120: Remove GameState creation from `session:created` listener
   - [ ] Replace with: `this.emit('state:updated', this.getCurrentState()?.toJSON())`
   - [ ] Keep listener for triggering broadcasts, but don't store state

5. **Remove persistence of GameState**
   - [ ] Line 106: Delete `await this.saveState()`
   - [ ] Keep `saveState()` method for now (used elsewhere)
   - [ ] Note: GameState persistence becomes redundant (derived from Session)

**Testing:**
- [ ] Run unit tests: `npm run test:unit -- stateService.test.js`
- [ ] Verify: `getCurrentState()` returns GameState when session exists
- [ ] Verify: `getCurrentState()` returns null when no session

---

### Task 1.2: Update State Sync Logic

**File:** `backend/src/app.js`
**Lines:** 184-188
**Estimated Time:** 15 minutes

**Subtasks:**

1. **Simplify startup sync logic**
   ```javascript
   // Lines 184-188 - Replace with:
   const currentSession = sessionService.getCurrentSession();
   if (currentSession) {
     // GameState now always derives from session - just verify
     const state = stateService.getCurrentState();
     logger.info('Session and state ready', {
       sessionId: currentSession.id,
       hasState: !!state
     });
   }
   ```

2. **Remove syncFromSession() calls if they exist**
   - [ ] Search for `syncFromSession` usage
   - [ ] Replace with getCurrentState() calls (already computed)

**Testing:**
- [ ] Restart orchestrator with active session in storage
- [ ] Verify logs show "Session and state ready"
- [ ] Verify GM Scanner receives sync:full with both session and state

---

### Task 1.3: Update Broadcast Logic

**File:** `backend/src/websocket/broadcasts.js`
**Lines:** 111-127, 135-142
**Estimated Time:** 20 minutes

**Subtasks:**

1. **Update state:updated broadcast handler**
   ```javascript
   // Lines 111-127 - Update listener
   addTrackedListener(stateService, 'state:updated', (delta) => {
     // Delta is already the JSON from getCurrentState()
     // Just broadcast to GM stations
     emitToRoom(io, 'gm-stations', 'state:update', delta);

     logger.debug('Broadcasted state:update to GM stations', {
       deltaKeys: Object.keys(delta || {}),
       gmStationCount: gmRoom ? gmRoom.size : 0
     });
   });
   ```

2. **Update sync:full broadcast handler**
   ```javascript
   // Lines 135-142 - Verify it uses getCurrentState()
   addTrackedListener(stateService, 'sync:full', (fullState) => {
     // fullState should be from getCurrentState().toJSON()
     emitWrapped(io, 'sync:full', fullState);
     logger.info('Broadcasted sync:full', {
       hasSession: !!fullState.session,
       hasState: !!fullState.state
     });
   });
   ```

**Testing:**
- [ ] Create session via admin panel
- [ ] Verify `state:update` broadcast received by GM Scanner
- [ ] Check DevTools → Network → WS → see state data

---

## Phase 2: UX Fix - Completed Session Workflow

**Goal:** Guide GM through completed session → new session transition

### Task 2.1: Enhance system:reset Command

**File:** `backend/src/websocket/adminEvents.js`
**Lines:** 201-213
**Estimated Time:** 20 minutes

**Subtasks:**

1. **Add archiving logic to system:reset**
   ```javascript
   // Lines 201-213 - Replace case block:
   case 'system:reset':
     // Get current session before resetting
     const currentSession = sessionService.getCurrentSession();

     // Archive completed session before reset (preserve data)
     if (currentSession && currentSession.status === 'completed') {
       await persistenceService.archiveSession(currentSession.toJSON());
       logger.info('Completed session archived before reset', {
         sessionId: currentSession.id
       });
     }

     // End current session if active/paused
     if (currentSession) {
       await sessionService.endSession();
     }

     // Reset all services
     await sessionService.reset();
     transactionService.reset();
     videoQueueService.clearQueue();

     resultMessage = 'System reset complete - ready for new session';
     logger.info('System reset by GM', { gmStation: socket.deviceId });
     break;
   ```

2. **Add safety check for active sessions**
   - [ ] Consider: Should we prevent system:reset during active game?
   - [ ] Decision: Allow it (GM knows what they're doing) but log warning
   - [ ] Add log: `logger.warn('Active session reset by GM', {...})`

**Testing:**
- [ ] Create session, end it (status: completed)
- [ ] Run system:reset command
- [ ] Verify session archived to `archive:session:${sessionId}` key
- [ ] Verify `currentSession` cleared
- [ ] Verify ready for new session creation

---

### Task 2.2: Update Admin Panel HTML

**File:** `ALNScanner/index.html`
**Lines:** 1714-1726
**Estimated Time:** 15 minutes

**Subtasks:**

1. **Replace static session info with dynamic container**
   ```html
   <!-- Lines 1714-1726 - Replace section with: -->
   <section class="admin-section">
       <h3>Session Management</h3>
       <!-- Dynamic content rendered by MonitoringDisplay.updateSessionDisplay() -->
       <div id="session-status-container">
           <!-- Content updated via JavaScript -->
       </div>
   </section>
   ```

2. **Remove old static elements**
   - [ ] Delete `<div id="session-info">`
   - [ ] Delete `<div class="session-controls">`
   - [ ] Delete individual session buttons (will be conditionally rendered)

**Testing:**
- [ ] Open GM Scanner in browser
- [ ] Verify container exists: `document.getElementById('session-status-container')`
- [ ] Should be empty initially (populated by JS)

---

### Task 2.3: Rewrite updateSessionDisplay()

**File:** `ALNScanner/js/utils/adminModule.js`
**Lines:** 544-555
**Estimated Time:** 45 minutes

**Subtasks:**

1. **Replace method with rich conditional UI**
   ```javascript
   // Lines 544-555 - Complete replacement:
   updateSessionDisplay(session) {
     const container = document.getElementById('session-status-container');
     if (!container) return;

     // STATE 1: No session
     if (!session) {
       container.innerHTML = `
         <div class="session-status empty" style="text-align: center; padding: 20px;">
           <p style="color: #666; margin-bottom: 15px;">No Active Session</p>
           <button class="btn btn-primary" onclick="App.adminCreateSession()">
             Create New Session
           </button>
         </div>
       `;
       return;
     }

     // STATE 2: Completed session
     if (session.status === 'completed') {
       const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'Unknown';
       container.innerHTML = `
         <div class="session-status completed" style="background: #fff3e0; padding: 15px; border-radius: 8px; border: 2px solid #ff9800;">
           <h4 style="margin-top: 0; color: #e65100;">⚠️ Previous Session Completed</h4>
           <p style="margin: 10px 0;"><strong>${session.name || 'Unnamed Session'}</strong></p>
           <p style="margin: 5px 0; color: #666; font-size: 14px;">
             Ended: ${endTime}<br>
             Total Scans: ${session.metadata?.totalScans || 0}
           </p>
           <div style="margin-top: 15px; display: flex; gap: 10px;">
             <button class="btn btn-primary" onclick="App.adminResetAndCreateNew()">
               Reset & Start New Session
             </button>
             <button class="btn" onclick="App.adminViewSessionDetails()">
               View Details
             </button>
           </div>
         </div>
       `;
       return;
     }

     // STATE 3: Paused session
     if (session.status === 'paused') {
       const startTime = session.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown';
       container.innerHTML = `
         <div class="session-status paused" style="background: #e3f2fd; padding: 15px; border-radius: 8px;">
           <h4 style="margin-top: 0; color: #1976d2;">⏸️ Session Paused</h4>
           <p style="margin: 10px 0;"><strong>${session.name || 'Session'}</strong></p>
           <p style="margin: 5px 0; color: #666; font-size: 14px;">Started: ${startTime}</p>
           <div style="margin-top: 15px; display: flex; gap: 10px;">
             <button class="btn btn-primary" onclick="App.adminResumeSession()">Resume</button>
             <button class="btn btn-danger" onclick="App.adminEndSession()">End Session</button>
           </div>
         </div>
       `;
       return;
     }

     // STATE 4: Active session
     const startTime = session.startTime ? new Date(session.startTime).toLocaleString() : 'Unknown';
     const totalScans = session.metadata?.totalScans || 0;
     container.innerHTML = `
       <div class="session-status active" style="background: #e8f5e9; padding: 15px; border-radius: 8px;">
         <h4 style="margin-top: 0; color: #2e7d32;">✅ ${session.name || 'Active Session'}</h4>
         <p style="margin: 5px 0; color: #666; font-size: 14px;">
           Started: ${startTime}<br>
           Total Scans: ${totalScans}
         </p>
         <div style="margin-top: 15px; display: flex; gap: 10px;">
           <button class="btn" onclick="App.adminPauseSession()">Pause</button>
           <button class="btn btn-danger" onclick="App.adminEndSession()">End Session</button>
         </div>
       </div>
     `;
   }
   ```

2. **Ensure styles are inline**
   - [ ] All styles inline (no external CSS dependencies)
   - [ ] Responsive (works on tablet-sized screens)
   - [ ] Clear visual distinction between states (colors, icons)

**Testing:**
- [ ] Test null session → shows "Create New Session"
- [ ] Test active session → shows pause/end buttons
- [ ] Test paused session → shows resume/end buttons
- [ ] Test completed session → shows reset button + details

---

### Task 2.4: Add Frontend Methods

**File:** `ALNScanner/js/app/app.js`
**Lines:** After 278 (after adminEndSession())
**Estimated Time:** 30 minutes

**Subtasks:**

1. **Add adminResetAndCreateNew() method**
   ```javascript
   // Insert after line 278:
   async adminResetAndCreateNew() {
     // Confirm action
     if (!confirm('Reset system and start new session? This will clear all current data.')) {
       return;
     }

     const name = prompt('Enter new session name:');
     if (!name) return;

     if (!App.viewController.adminInstances?.sessionManager) {
       alert('Admin functions not available.');
       return;
     }

     try {
       // Step 1: System reset (clears everything)
       await new Promise((resolve, reject) => {
         const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

         const socket = App.viewController.adminInstances.sessionManager.connection.socket;

         socket.once('gm:command:ack', (response) => {
           clearTimeout(timeout);
           if (response.data.success) {
             resolve();
           } else {
             reject(new Error(response.data.message || 'Reset failed'));
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

       Debug.log('System reset complete');

       // Step 2: Create new session
       await App.viewController.adminInstances.sessionManager.createSession(name);

       Debug.log(`New session created: ${name}`);
       UIManager.showToast('New session started successfully', 'success');

     } catch (error) {
       console.error('Failed to reset and create session:', error);
       UIManager.showError(`Failed: ${error.message}`);
     }
   },
   ```

2. **Add adminViewSessionDetails() method**
   ```javascript
   // Insert after adminResetAndCreateNew():
   async adminViewSessionDetails() {
     const session = App.viewController.adminInstances?.sessionManager?.currentSession;
     if (!session) {
       alert('No session to view');
       return;
     }

     const details = `
   Session Details
   ===============
   Name: ${session.name || 'Unnamed'}
   ID: ${session.id}
   Status: ${session.status}
   Started: ${new Date(session.startTime).toLocaleString()}
   ${session.endTime ? 'Ended: ' + new Date(session.endTime).toLocaleString() : ''}

   Statistics:
   - Total Scans: ${session.metadata?.totalScans || 0}
   - Unique Tokens: ${session.metadata?.uniqueTokensScanned?.length || 0}
   - GM Stations: ${session.metadata?.gmStations || 0}
     `.trim();

     alert(details);
   },
   ```

**Testing:**
- [ ] Click "Reset & Start New" on completed session
- [ ] Verify confirmation dialog
- [ ] Verify name prompt
- [ ] Verify system:reset command sent
- [ ] Verify session:create command sent
- [ ] Verify new session appears in UI

---

## Phase 3: Testing & Validation

**Goal:** Verify all scenarios work correctly

### Task 3.1: Unit Tests

**Estimated Time:** 30 minutes

**Subtasks:**

1. **Test GameState derivation**
   - [ ] `npm run test:unit -- stateService.test.js`
   - [ ] Verify getCurrentState() derives from session
   - [ ] Verify returns null when no session

2. **Test session lifecycle**
   - [ ] `npm run test:unit -- sessionService.test.js`
   - [ ] Verify endSession() clears currentSession
   - [ ] Verify reset() clears storage

3. **Fix any broken tests**
   - [ ] Update tests expecting stored currentState
   - [ ] Update to use getCurrentState() instead

---

### Task 3.2: Integration Tests

**Estimated Time:** 45 minutes

**Subtasks:**

1. **Test orchestrator restart scenarios**
   - [ ] Create active session with transactions
   - [ ] Stop orchestrator (Ctrl+C)
   - [ ] Restart: `npm run dev:full`
   - [ ] Verify session loads from disk
   - [ ] Verify GameState derives (not null)
   - [ ] Verify GM Scanner shows session correctly

2. **Test completed session workflow**
   - [ ] Create session, end it (status: completed)
   - [ ] Restart orchestrator
   - [ ] Connect GM Scanner
   - [ ] Verify completed session shown with reset button
   - [ ] Click "Reset & Start New Session"
   - [ ] Verify new session created successfully

3. **Test crash recovery**
   - [ ] Start game, scan 20 tokens
   - [ ] Kill orchestrator process: `pm2 stop aln-orchestrator`
   - [ ] Restart: `pm2 restart aln-orchestrator`
   - [ ] Reconnect GM Scanner
   - [ ] Verify game state intact (scores, transactions)
   - [ ] Verify can continue scanning

---

### Task 3.3: Manual UI Testing

**Estimated Time:** 30 minutes

**Subtasks:**

1. **Test all session states in admin panel**
   - [ ] No session → "Create New Session" button
   - [ ] Active session → Green card, pause/end buttons
   - [ ] Paused session → Blue card, resume/end buttons
   - [ ] Completed session → Orange card, reset button

2. **Test transitions**
   - [ ] Create → shows active
   - [ ] Pause → shows paused
   - [ ] Resume → shows active
   - [ ] End → shows completed
   - [ ] Reset & Create → shows new active

3. **Test multi-device sync**
   - [ ] Open 2 GM Scanners
   - [ ] Create session on Scanner A
   - [ ] Verify Scanner B updates automatically
   - [ ] Pause on Scanner B
   - [ ] Verify Scanner A shows paused

---

## Phase 4: Documentation & Cleanup

**Goal:** Update docs and clean up code

### Task 4.1: Update Documentation

**Estimated Time:** 20 minutes

**Subtasks:**

1. **Update CLAUDE.md**
   - [ ] Document GameState as computed view (not stored)
   - [ ] Update session lifecycle explanation
   - [ ] Add "Reset & Start New" workflow

2. **Update API documentation**
   - [ ] Note: system:reset now archives completed sessions
   - [ ] Document session state transitions

3. **Add inline comments**
   - [ ] Comment: "GameState derived from Session (not persisted)"
   - [ ] Comment: "system:reset archives completed sessions before reset"

---

### Task 4.2: Code Cleanup

**Estimated Time:** 15 minutes

**Subtasks:**

1. **Remove unused code**
   - [ ] Search for `this.currentState =` assignments (should be gone)
   - [ ] Remove unused `saveState()` calls
   - [ ] Remove `syncFromSession()` if no longer used

2. **Verify logging**
   - [ ] Check logs are meaningful
   - [ ] No "GameState missing" warnings (should be fixed)
   - [ ] Log when GameState derived vs created

3. **Check for TODOs**
   - [ ] Search for TODO comments added during implementation
   - [ ] Resolve or document them

---

## Phase 5: Deployment

**Goal:** Deploy to production Raspberry Pi

### Task 5.1: Pre-deployment Checks

**Estimated Time:** 15 minutes

**Subtasks:**

1. **Run full test suite**
   - [ ] `npm test` (all 271 tests should pass)
   - [ ] Check coverage: `npm run test:coverage`
   - [ ] Verify no regressions

2. **Git status check**
   - [ ] `git status` - review all changes
   - [ ] `git diff` - review code changes
   - [ ] Ensure no debug code left in

3. **Lint check**
   - [ ] `npm run lint`
   - [ ] Fix any linting errors

---

### Task 5.2: Deployment

**Estimated Time:** 15 minutes

**Subtasks:**

1. **Commit changes**
   ```bash
   git add -A
   git commit -m "fix(session): Make GameState computed and add completed session workflow

   - Convert GameState to computed view (eliminates restart bug)
   - Add UI for completed session → new session transition
   - Use system:reset command for clean slate
   - Archive completed sessions before reset

   Fixes session state sync issues on orchestrator restart"
   ```

2. **Deploy to Raspberry Pi**
   - [ ] SSH to Pi: `ssh pi@aln-orchestrator.local`
   - [ ] Navigate: `cd ALN-Ecosystem`
   - [ ] Pull: `git pull origin main`
   - [ ] Install: `cd backend && npm install` (if needed)
   - [ ] Restart: `npm run prod:restart`

3. **Verify deployment**
   - [ ] Check logs: `npm run prod:logs`
   - [ ] Check status: `npm run prod:status`
   - [ ] Test GM Scanner connection

---

### Task 5.3: Post-deployment Validation

**Estimated Time:** 15 minutes

**Subtasks:**

1. **Smoke test production**
   - [ ] Open GM Scanner: `http://aln-orchestrator.local:3000/gm-scanner/`
   - [ ] Create session
   - [ ] Scan some tokens
   - [ ] Verify scores update

2. **Test orchestrator restart**
   - [ ] `npm run prod:restart`
   - [ ] Reconnect GM Scanner
   - [ ] Verify session/state intact

3. **Monitor for errors**
   - [ ] Watch logs: `npm run prod:logs`
   - [ ] Check for errors or warnings
   - [ ] Verify no "GameState missing" messages

---

## Success Criteria

**Technical:**
- [ ] GameState always exists when Session exists (no null state bug)
- [ ] Orchestrator restart preserves active sessions correctly
- [ ] Completed sessions show proper UI workflow
- [ ] All 271 tests pass
- [ ] No new errors in logs

**UX:**
- [ ] GM sees clear status for each session state
- [ ] "Reset & Start New Session" workflow is obvious
- [ ] No confusion about what to do with completed sessions
- [ ] Recovery from crash is transparent

**Architecture:**
- [ ] No new commands added (uses existing system:reset)
- [ ] No contract changes needed
- [ ] GameState is computed view (simpler mental model)
- [ ] Event-driven fragility eliminated

---

## Rollback Plan

**If issues arise:**

1. **Immediate rollback**
   ```bash
   git revert HEAD
   git push origin main
   # On Pi:
   git pull origin main
   npm run prod:restart
   ```

2. **Identify issue**
   - Check logs: `npm run prod:logs`
   - Check test failures: `npm test`
   - Check browser console for frontend errors

3. **Incremental fix**
   - Revert only problematic changes
   - Fix and redeploy specific component
   - Maintain working system throughout

---

## Timeline Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Technical Fix | 3 tasks | 1.5 hours |
| Phase 2: UX Fix | 4 tasks | 2 hours |
| Phase 3: Testing | 3 tasks | 1.75 hours |
| Phase 4: Documentation | 2 tasks | 35 minutes |
| Phase 5: Deployment | 3 tasks | 45 minutes |
| **Total** | **15 tasks** | **~6 hours** |

**Realistic estimate with breaks and debugging: 6-8 hours**

---

## Notes

**Critical Decisions:**
- ✅ Use computed GameState (don't store it)
- ✅ Use existing system:reset (don't add new commands)
- ✅ Archive completed sessions before reset (preserve data)
- ✅ Inline styles in admin panel (no CSS file dependency)

**Key Files Modified:**
1. `backend/src/services/stateService.js` - GameState computation
2. `backend/src/websocket/adminEvents.js` - system:reset archiving
3. `ALNScanner/index.html` - Session status container
4. `ALNScanner/js/utils/adminModule.js` - updateSessionDisplay()
5. `ALNScanner/js/app/app.js` - New admin methods

**No Changes Needed:**
- ❌ AsyncAPI contract (system:reset already defined)
- ❌ Session model (archive() already exists)
- ❌ PersistenceService (archiveSession() already exists)
- ❌ Database schema (no new fields)

---

**End of Implementation Plan**
