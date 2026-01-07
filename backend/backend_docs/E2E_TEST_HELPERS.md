# E2E Testing Helpers for Admin Interfaces

## Command Examples (Copy-Paste Ready)

### 1. Authentication
```javascript
// Get JWT token
const authResp = await fetch('http://localhost:3000/api/admin/auth', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({password: 'your-admin-password'})
});
const {token} = await authResp.json();
console.log('Token:', token);
```

### 2. WebSocket Connection
```javascript
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  auth: {
    token: token,
    deviceId: 'TEST_ADMIN_PANEL',
    deviceType: 'gm',
    version: '1.0.0'
  }
});

socket.on('connect', () => console.log('Connected'));
socket.on('sync:full', (data) => console.log('Initial sync:', data.data));
```

### 3. Session Commands
```javascript
// Create session
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'session:create',
    payload: {
      name: 'Test Game - ' + new Date().toISOString(),
      teams: ['001', '002', '003']
    }
  },
  timestamp: new Date().toISOString()
});

// Pause session
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'session:pause', payload: {}},
  timestamp: new Date().toISOString()
});

// Resume session
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'session:resume', payload: {}},
  timestamp: new Date().toISOString()
});

// End session
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'session:end', payload: {}},
  timestamp: new Date().toISOString()
});
```

### 4. Video Commands
```javascript
// Add to queue
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'video:queue:add',
    payload: {videoFile: 'test_30sec.mp4'}
  },
  timestamp: new Date().toISOString()
});

// Play/Pause/Stop
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'video:play', payload: {}},
  timestamp: new Date().toISOString()
});

socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'video:pause', payload: {}},
  timestamp: new Date().toISOString()
});

// Skip current video
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'video:skip', payload: {}},
  timestamp: new Date().toISOString()
});

// Reorder queue (move item at index 1 to index 0)
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'video:queue:reorder',
    payload: {fromIndex: 1, toIndex: 0}
  },
  timestamp: new Date().toISOString()
});

// Clear entire queue
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'video:queue:clear', payload: {}},
  timestamp: new Date().toISOString()
});
```

### 5. Score Commands
```javascript
// Adjust team score
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'score:adjust',
    payload: {
      teamId: '001',
      delta: -500,
      reason: 'Penalty for rule violation'
    }
  },
  timestamp: new Date().toISOString()
});

// Bonus correction
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'score:adjust',
    payload: {
      teamId: '002',
      delta: 250,
      reason: 'Correct scoring error'
    }
  },
  timestamp: new Date().toISOString()
});
```

### 6. Transaction Commands
```javascript
// Create manual transaction
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'transaction:create',
    payload: {
      tokenId: '534e2b03',
      teamId: '001',
      mode: 'blackmarket'  // or 'detective'
    }
  },
  timestamp: new Date().toISOString()
});

// Delete transaction (need valid transactionId from earlier sync)
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'transaction:delete',
    payload: {
      transactionId: 'uuid-from-sync-full'
    }
  },
  timestamp: new Date().toISOString()
});
```

### 7. System Commands
```javascript
// Reset entire system
socket.emit('gm:command', {
  event: 'gm:command',
  data: {action: 'system:reset', payload: {}},
  timestamp: new Date().toISOString()
});
```

---

## Event Listeners

### Listen for Command Acknowledgment
```javascript
socket.on('gm:command:ack', (eventData) => {
  console.log('Command result:', {
    action: eventData.data.action,
    success: eventData.data.success,
    message: eventData.data.message,
    error: eventData.data.error
  });
});
```

### Listen for Broadcasts
```javascript
// ⚠️ DEPRECATED: score:updated - Use transaction:new.teamScore instead
// socket.on('score:updated', (eventData) => { ... });

// PREFERRED: Extract score from transaction:new events
socket.on('transaction:new', (eventData) => {
  console.log('New transaction:', eventData.data.transaction);
  console.log('Updated team score:', eventData.data.teamScore);
  if (eventData.data.groupBonusInfo) {
    console.log('Group bonus:', eventData.data.groupBonusInfo);
  }
});

// Session changes
socket.on('session:update', (eventData) => {
  console.log('Session status:', eventData.data.status);
  console.log('Teams:', eventData.data.teams);
});

// Video status
socket.on('video:status', (eventData) => {
  console.log('Video:', eventData.data.status, 'Queue length:', eventData.data.queueLength);
});

// Queue updates
socket.on('video:queue:update', (eventData) => {
  console.log('Queue items:', eventData.data.items);
});

// Group completion
socket.on('group:completed', (eventData) => {
  console.log(`Team ${eventData.data.teamId} completed ${eventData.data.group}`);
  console.log('Bonus points:', eventData.data.bonusPoints);
});

// Errors
socket.on('error', (eventData) => {
  console.error('Error:', eventData.data.code, eventData.data.message);
});
```

---

## Helper Functions

### Capture Single Event
```javascript
function captureEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener(eventName, handler);
      reject(new Error(`Timeout waiting for ${eventName}`));
    }, timeout);
    
    const handler = (data) => {
      clearTimeout(timer);
      socket.removeListener(eventName, handler);
      resolve(data);
    };
    
    socket.on(eventName, handler);
  });
}

// Usage:
const ack = await captureEvent(socket, 'gm:command:ack');
console.log(ack.data.message);
```

### Send Command and Wait for Ack
```javascript
async function sendCommand(socket, action, payload = {}) {
  socket.emit('gm:command', {
    event: 'gm:command',
    data: {action, payload},
    timestamp: new Date().toISOString()
  });
  
  const ack = await captureEvent(socket, 'gm:command:ack');
  
  if (!ack.data.success) {
    throw new Error(`Command failed: ${ack.data.message}`);
  }
  
  return ack.data;
}

// Usage:
try {
  const result = await sendCommand(socket, 'video:skip');
  console.log(result.message);
} catch (err) {
  console.error(err.message);
}
```

### Create Session Helper
```javascript
async function createSession(socket, teamIds) {
  const result = await sendCommand(socket, 'session:create', {
    name: 'Test Session - ' + new Date().toISOString(),
    teams: teamIds
  });
  
  // Wait for session:update broadcast
  const sessionUpdate = await captureEvent(socket, 'session:update');
  return sessionUpdate.data;
}

// Usage:
const session = await createSession(socket, ['001', '002', '003']);
console.log('Session ID:', session.id);
console.log('Status:', session.status);
```

### Adjust Score Helper
```javascript
async function adjustScore(socket, teamId, points, reason) {
  const result = await sendCommand(socket, 'score:adjust', {
    teamId,
    delta: points,
    reason
  });

  // Wait for score:adjusted event (admin adjustments use this event)
  const scoreUpdate = await captureEvent(socket, 'score:adjusted');
  return scoreUpdate.data;
}

// Usage:
const updated = await adjustScore(socket, '001', -500, 'Rule violation');
console.log('New score:', updated.currentScore);
console.log('Audit trail:', updated.adminAdjustments);
```

---

## Scoreboard Testing

### Scoreboard Connection
```javascript
// Scoreboard uses hardcoded password
const scoreboardToken = 'get-from-post-auth-with-password';

const scoreboardSocket = io('http://localhost:3000', {
  auth: {
    token: scoreboardToken,
    deviceId: 'SCOREBOARD_DISPLAY',
    deviceType: 'gm'
  }
});

scoreboardSocket.on('sync:full', (data) => {
  console.log('Teams on scoreboard:', data.data.scores.length);
  console.log('Detective log entries:', data.data.recentTransactions
    .filter(tx => tx.mode === 'detective').length);
});

// ⚠️ DEPRECATED: score:updated - Use transaction:new.teamScore instead
scoreboardSocket.on('transaction:new', (data) => {
  console.log(`Scoreboard updated Team ${data.data.transaction.teamId}: $${data.data.teamScore}`);
});
```

---

## Complete Test Flow (Jest)

```javascript
describe('Admin Panel E2E', () => {
  let token;
  let socket;
  
  beforeAll(async () => {
    // Authenticate
    const res = await fetch('http://localhost:3000/api/admin/auth', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password: process.env.ADMIN_PASSWORD})
    });
    const data = await res.json();
    token = data.token;
    
    // Connect WebSocket
    socket = io('http://localhost:3000', {
      auth: {token, deviceId: 'TEST', deviceType: 'gm'}
    });
    
    await new Promise(resolve => socket.on('connect', resolve));
    await captureEvent(socket, 'sync:full'); // Wait for initial sync
  });
  
  afterAll(() => {
    socket.disconnect();
  });
  
  test('Create and manage session', async () => {
    // Create
    const session = await createSession(socket, ['001', '002']);
    expect(session.status).toBe('active');
    
    // Pause
    await sendCommand(socket, 'session:pause');
    const paused = await captureEvent(socket, 'session:update');
    expect(paused.data.status).toBe('paused');
    
    // Resume
    await sendCommand(socket, 'session:resume');
    const resumed = await captureEvent(socket, 'session:update');
    expect(resumed.data.status).toBe('active');
    
    // End
    await sendCommand(socket, 'session:end');
    const ended = await captureEvent(socket, 'session:update');
    expect(ended.data.status).toBe('ended');
  });
  
  test('Adjust score with audit trail', async () => {
    // First create a session with a team
    await createSession(socket, ['001']);
    
    // Adjust score
    const updated = await adjustScore(socket, '001', -500, 'Test penalty');
    
    // Verify audit trail
    expect(updated.adminAdjustments.length).toBeGreaterThan(0);
    const adjustment = updated.adminAdjustments[updated.adminAdjustments.length - 1];
    expect(adjustment.delta).toBe(-500);
    expect(adjustment.reason).toBe('Test penalty');
    expect(adjustment.gmStation).toBe('TEST');
  });
});
```

---

## Command Error Cases

### Missing Required Payload
```javascript
// This should fail - missing teamId
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'score:adjust',
    payload: {delta: -500}  // Missing teamId
  },
  timestamp: new Date().toISOString()
});

// Expect error:
socket.on('error', (data) => {
  console.log(data.data.code); // 'VALIDATION_ERROR'
});
```

### Invalid Action
```javascript
socket.emit('gm:command', {
  event: 'gm:command',
  data: {
    action: 'invalid:action',  // Unknown action
    payload: {}
  },
  timestamp: new Date().toISOString()
});

// Expect error:
socket.on('error', (data) => {
  console.log(data.data.code); // 'INVALID_COMMAND'
});
```

### Session Paused Transaction
```javascript
// First pause session
await sendCommand(socket, 'session:pause');

// Try to submit transaction
socket.emit('transaction:submit', {
  event: 'transaction:submit',
  data: {
    tokenId: '534e2b03',
    teamId: '001',
    deviceId: 'TEST',
    mode: 'blackmarket'
  },
  timestamp: new Date().toISOString()
});

// Expect:
socket.on('transaction:result', (data) => {
  console.log(data.data.status);  // 'error'
  console.log(data.data.message); // 'Session is paused'
});
```

