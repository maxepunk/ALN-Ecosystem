# Backend as Source of Truth Implementation Plan

## Executive Summary
Implement backend as the authoritative source for score calculations when GM scanners are connected, while maintaining local calculation capability for disconnected operation.

## Current Architecture Analysis

### What Already Works:
1. **Backend Events**: TransactionService emits:
   - `transaction:accepted` - When a transaction is processed
   - `score:updated` - When team score changes
   - `group:completed` - When a team completes a group
   - `team:created` - When a new team is created

2. **WebSocket Infrastructure**:
   - `adminEvents.js` - Handles transaction submission from GM scanners
   - `broadcasts.js` - Sets up event listeners and broadcasts to clients
   - Transaction processing returns results to submitter

3. **GM Scanner**:
   - Has `calculateTeamScoreWithBonuses()` for local calculation
   - Listens for `transaction:new` events (but not score updates)
   - Submits transactions via WebSocket when connected
   - Falls back to local storage when disconnected

### What's Missing:
1. **Score Broadcasting**: TransactionService events aren't being broadcast to GM stations
2. **Score Reception**: GM scanner doesn't listen for score update events
3. **Source Switching**: GM scanner always calculates locally, even when connected

## Implementation Strategy

### Design Principles:
1. **Minimal Complexity**: Reuse existing event system
2. **Progressive Enhancement**: Local calculation remains as fallback
3. **Event-Driven**: Backend pushes updates, no polling
4. **Backward Compatible**: Existing disconnected behavior unchanged

### Architecture Decision:
**Option A: Full State Sync** ❌
- Replace local calculation entirely when connected
- Complex state management
- Risk of desync issues

**Option B: Score Event Broadcasting** ✅
- Backend broadcasts score updates after transactions
- GM scanner updates display from events
- Local calculation remains as fallback
- Simple, incremental implementation

## Implementation Plan

### Phase 1: Backend Broadcasting

#### 1.1 Add TransactionService to Broadcast Listeners
**File**: `/backend/src/websocket/broadcasts.js`

Add transactionService to the setupBroadcastListeners function:

```javascript
function setupBroadcastListeners(io, services) {
  const { sessionService, stateService, videoQueueService, offlineQueueService, transactionService } = services;

  // ... existing listeners ...

  // Score events - broadcast to GM stations only
  addTrackedListener(transactionService, 'score:updated', (teamScore) => {
    const scoreUpdate = {
      event: 'score:updated',
      data: {
        teamId: teamScore.teamId,
        currentScore: teamScore.currentScore,
        baseScore: teamScore.currentScore - (teamScore.bonusPoints || 0),
        bonusPoints: teamScore.bonusPoints || 0,
        tokensScanned: teamScore.tokensScanned,
        completedGroups: teamScore.completedGroups || [],
        lastUpdate: teamScore.lastUpdate
      },
      timestamp: new Date().toISOString()
    };

    io.to('gm-stations').emit('score:updated', scoreUpdate);
    logger.info('Broadcasted score:updated to GM stations', {
      teamId: teamScore.teamId,
      score: teamScore.currentScore
    });
  });

  // Group completion events - broadcast to GM stations only
  addTrackedListener(transactionService, 'group:completed', (data) => {
    const groupCompletion = {
      event: 'group:completed',
      data: {
        teamId: data.teamId,
        groupId: data.groupId,
        bonus: data.bonus,
        multiplier: data.multiplier
      },
      timestamp: new Date().toISOString()
    };

    io.to('gm-stations').emit('group:completed', groupCompletion);
    logger.info('Broadcasted group:completed to GM stations', data);
  });

  // Team creation events
  addTrackedListener(transactionService, 'team:created', (data) => {
    const teamCreation = {
      event: 'team:created',
      data: {
        teamId: data.teamId
      },
      timestamp: new Date().toISOString()
    };

    io.to('gm-stations').emit('team:created', teamCreation);
    logger.info('Broadcasted team:created to GM stations', data);
  });
}
```

#### 1.2 Pass TransactionService to Setup
**File**: `/backend/src/server.js`

Update the setupBroadcastListeners call:

```javascript
const transactionService = require('./services/transactionService');

// ... in initializeWebSocket ...

setupBroadcastListeners(ioInstance, {
  sessionService,
  stateService,
  videoQueueService,
  offlineQueueService,
  transactionService,  // ADD THIS
});
```

### Phase 2: GM Scanner Reception

#### 2.1 Add Score Event Listeners
**File**: `/ALNScanner/index.html`

In the OrchestratorClient class, add listeners for score events:

```javascript
// In connect() method, after existing socket.on handlers:

this.socket.on('score:updated', (data) => {
    this.emit('score:updated', data);
    // Update local score cache for the team
    if (window.DataManager) {
        window.DataManager.updateTeamScoreFromBackend(data.data);
    }
});

this.socket.on('group:completed', (data) => {
    this.emit('group:completed', data);
    // Show notification about group completion
    if (window.UIManager) {
        window.UIManager.showGroupCompletionNotification(data.data);
    }
});

this.socket.on('team:created', (data) => {
    this.emit('team:created', data);
});
```

#### 2.2 Add Backend Score Integration to DataManager
**File**: `/ALNScanner/index.html`

Add method to update scores from backend:

```javascript
// In DataManager object:

updateTeamScoreFromBackend(scoreData) {
    // Only update if we're connected to orchestrator
    if (!window.orchestratorClient?.isConnected) {
        return;
    }

    // Store backend scores for display
    if (!this.backendScores) {
        this.backendScores = new Map();
    }

    this.backendScores.set(scoreData.teamId, {
        currentScore: scoreData.currentScore,
        baseScore: scoreData.baseScore,
        bonusPoints: scoreData.bonusPoints,
        tokensScanned: scoreData.tokensScanned,
        completedGroups: scoreData.completedGroups,
        lastUpdate: scoreData.lastUpdate
    });

    // Trigger UI update if viewing scores
    if (document.getElementById('scoreboardContainer')) {
        UIManager.renderScoreboard();
    }

    Debug.log(`Score updated from backend for team ${scoreData.teamId}: $${scoreData.currentScore}`);
},

// Modify getTeamScores to prefer backend scores when connected:
getTeamScores() {
    // If connected and have backend scores, use those as source of truth
    if (window.orchestratorClient?.isConnected && this.backendScores?.size > 0) {
        const scores = Array.from(this.backendScores.entries()).map(([teamId, score]) => ({
            teamId,
            score: score.currentScore,
            baseScore: score.baseScore,
            bonusScore: score.bonusPoints,
            tokenCount: score.tokensScanned,
            completedGroups: score.completedGroups,
            isFromBackend: true  // Flag to show this is authoritative
        }));

        // Sort by score
        scores.sort((a, b) => b.score - a.score);
        return scores;
    }

    // Fallback to local calculation when disconnected
    return this.calculateLocalTeamScores();
},
```

#### 2.3 Add Visual Indicator for Score Source
**File**: `/ALNScanner/index.html`

Update the scoreboard rendering to show score source:

```javascript
// In UIManager.renderScoreboard():

const scoreSource = teamScores[0]?.isFromBackend ?
    '<div class="score-source">🔗 Live from Orchestrator</div>' :
    '<div class="score-source">📱 Local Calculation</div>';

container.innerHTML = scoreSource + teamScores.map((team, index) => {
    // ... existing rendering code ...
}).join('');
```

### Phase 3: Testing & Validation

#### 3.1 Unit Tests
- Test event emission from transactionService
- Test event broadcasting in broadcasts.js
- Test score update reception in GM scanner

#### 3.2 Integration Tests
1. **Connected Mode**:
   - Start orchestrator
   - Connect GM scanner
   - Submit transactions
   - Verify scores update from backend events
   - Verify bonus calculations match

2. **Disconnection Handling**:
   - Connect GM scanner
   - Submit transactions (backend scores)
   - Disconnect network
   - Continue scanning (local scores)
   - Reconnect
   - Verify scores resync

3. **Multi-Station Sync**:
   - Connect 2 GM scanners
   - Submit transaction from Scanner A
   - Verify Scanner B updates immediately
   - Verify scores match exactly

## Benefits

1. **Single Source of Truth**: Backend controls all scoring when connected
2. **Real-time Sync**: All GM stations see same scores instantly
3. **Preserved Offline**: Local calculation still works when disconnected
4. **Minimal Complexity**: Uses existing event system
5. **Progressive Enhancement**: Graceful degradation to local mode

## Risk Mitigation

1. **Network Latency**: Score updates are async but near-instant on LAN
2. **Disconnection**: Local scores continue, resync on reconnect
3. **Event Loss**: State sync on reconnect ensures consistency
4. **Backward Compatibility**: Old scanners continue working with local calc

## Success Metrics

✅ Scores update in <100ms across all connected GM stations
✅ Group bonuses calculated identically on backend and frontend
✅ Seamless transition between connected/disconnected modes
✅ No duplicate score calculations when connected
✅ Visual indication of score source (backend vs local)

## Implementation Effort

- **Backend Changes**: ~30 lines (add event listeners)
- **GM Scanner Changes**: ~100 lines (add handlers and score management)
- **Testing**: 2-3 hours for comprehensive validation
- **Total Effort**: < 1 day implementation + testing

## Conclusion

This implementation follows engineering best practices by:
- Reusing existing infrastructure (event system, WebSocket rooms)
- Maintaining backward compatibility
- Providing graceful degradation
- Minimizing code changes
- Ensuring clear separation of concerns

The backend becomes the authoritative source for scores when connected, while preserving the GM scanner's ability to operate independently when offline.