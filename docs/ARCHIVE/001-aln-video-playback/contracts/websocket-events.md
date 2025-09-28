# WebSocket Events Contract

## Overview
This document defines the WebSocket event protocol for real-time communication between the orchestrator server and GM stations.

## Connection Protocol

### Connection Establishment
```javascript
// Client connects to ws://orchestrator:3000/ws
const socket = io('ws://orchestrator:3000', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity
});
```

### Authentication Flow
```javascript
// Client → Server: Identify as GM station
socket.emit('gm:identify', {
  stationId: 'GM_STATION_01',
  version: '1.0.0'
});

// Server → Client: Acknowledgement
socket.on('gm:identified', {
  success: true,
  sessionId: 'uuid-v4',
  state: GameState
});
```

## Server → Client Events

### state:update
Emitted when game state changes.
```typescript
{
  event: 'state:update',
  data: GameState,
  timestamp: string // ISO 8601
}
```

### transaction:new
Emitted when a new transaction is recorded.
```typescript
{
  event: 'transaction:new',
  data: Transaction,
  timestamp: string
}
```

### video:status
Emitted when video playback status changes.
```typescript
{
  event: 'video:status',
  data: {
    status: 'idle' | 'loading' | 'playing' | 'paused' | 'completed' | 'error',
    tokenId?: string,
    progress?: number, // 0-100
    duration?: number, // seconds
    error?: string
  },
  timestamp: string
}
```

### device:connected
Emitted when a device connects to the orchestrator.
```typescript
{
  event: 'device:connected',
  data: {
    deviceId: string,
    type: 'player' | 'gm',
    name?: string,
    ipAddress?: string
  },
  timestamp: string
}
```

### device:disconnected
Emitted when a device disconnects from the orchestrator.
```typescript
{
  event: 'device:disconnected',
  data: {
    deviceId: string,
    reason: 'timeout' | 'manual' | 'error'
  },
  timestamp: string
}
```

### sync:full
Emitted to provide full state synchronization.
```typescript
{
  event: 'sync:full',
  data: {
    session: Session,
    state: GameState,
    devices: DeviceConnection[],
    transactions: Transaction[] // Last 100
  },
  timestamp: string
}
```

### error
Emitted when an error occurs.
```typescript
{
  event: 'error',
  data: {
    code: string,
    message: string,
    details?: any
  },
  timestamp: string
}
```

## Client → Server Events

### gm:identify
Identify client as a GM station.
```typescript
{
  event: 'gm:identify',
  data: {
    stationId: string,
    version: string
  }
}
```

### state:request
Request full state synchronization.
```typescript
{
  event: 'state:request',
  data: {} // Empty object
}
```

### transaction:submit
Submit a transaction from GM scanner.
```typescript
{
  event: 'transaction:submit',
  data: {
    tokenId: string,
    teamId: string,
    scannerId: string
  }
}
```

### heartbeat
Keep-alive signal from client.
```typescript
{
  event: 'heartbeat',
  data: {
    stationId: string
  }
}
```

## Rooms & Broadcasting

### Room Structure
- `gm-stations`: All authenticated GM stations
- `session:{sessionId}`: All devices in a specific session
- `admin`: Admin panel connections

### Broadcast Patterns
```javascript
// To all GM stations
io.to('gm-stations').emit('state:update', data);

// To specific session
io.to(`session:${sessionId}`).emit('transaction:new', data);

// To all except sender
socket.broadcast.to('gm-stations').emit('device:connected', data);
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication required for this operation |
| `INVALID_TOKEN` | Invalid or expired authentication token |
| `SESSION_NOT_FOUND` | Requested session does not exist |
| `DEVICE_LIMIT` | Maximum device connections exceeded |
| `INVALID_DATA` | Malformed or invalid event data |
| `SERVER_ERROR` | Internal server error |

## Reconnection Strategy

### Client-Side
```javascript
socket.on('disconnect', (reason) => {
  // reason: 'io server disconnect', 'io client disconnect', 
  //         'ping timeout', 'transport close', 'transport error'
  
  if (reason === 'io server disconnect') {
    // Server forcefully disconnected, manual reconnect needed
    socket.connect();
  }
  // Otherwise, automatic reconnection will occur
});

socket.on('reconnect', (attemptNumber) => {
  // Request full state sync after reconnection
  socket.emit('state:request', {});
});
```

### Server-Side
- Maintain device connection state for 30 seconds after disconnect
- Queue events during disconnection (max 100 events)
- Send queued events on reconnection
- Full state sync if queue overflow

## Rate Limiting

| Event | Limit |
|-------|-------|
| `transaction:submit` | 10 per second |
| `state:request` | 1 per 5 seconds |
| `heartbeat` | 1 per second |
| All events combined | 50 per second |

## Performance Considerations

- State updates are debounced to max 10 per second
- Large state transfers use compression
- Binary data (if any) uses MessagePack encoding
- Heartbeat timeout: 30 seconds
- Reconnection backoff: exponential up to 30 seconds