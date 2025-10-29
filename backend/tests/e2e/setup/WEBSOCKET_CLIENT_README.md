# WebSocket Client Helper for E2E Tests

## Overview

`websocket-client.js` provides a complete WebSocket client helper for E2E testing with Socket.io and JWT authentication. It handles the full authentication flow, event waiting, envelope validation, and cleanup.

## File Location

`/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/backend/tests/e2e/setup/websocket-client.js`

## Implemented Functions

### 1. `connectWithAuth(baseUrl, password, deviceId, deviceType, options)`

Connects to WebSocket with JWT authentication following the complete flow:
1. HTTP POST to `/api/admin/auth` to get JWT token
2. Socket.io connection with token in `handshake.auth`
3. Server validates JWT and sends `sync:full` event on success

**Parameters:**
- `baseUrl` (string): Server URL (e.g., 'https://localhost:3000')
- `password` (string): Admin password
- `deviceId` (string): Unique device identifier
- `deviceType` (string): 'gm' or 'admin'
- `options` (object, optional):
  - `timeout` (number): Connection timeout in ms (default: 10000)
  - `version` (string): Client version (default: '1.0.0')

**Returns:** Promise<Socket> - Connected and authenticated Socket.io client

**HTTPS Support:** Automatically handles self-signed certificates via `rejectUnauthorized: false`

**Example:**
```javascript
const socket = await connectWithAuth(
  'https://localhost:3000',
  'admin-password',
  'GM_Station_1',
  'gm'
);
```

### 2. `setupEventListener(socket, eventName, handler)`

Simple wrapper around `socket.on()` for persistent event listeners.

**Parameters:**
- `socket` (Socket): Socket.io client
- `eventName` (string): Event name to listen for
- `handler` (Function): Event handler `(data) => void`

**Example:**
```javascript
setupEventListener(socket, 'transaction:new', (event) => {
  console.log('Transaction:', event.data.transaction.tokenId);
});
```

### 3. `waitForEvent(socket, eventName, predicate, timeout)`

Promise-based event waiting with optional predicate filter.

**Parameters:**
- `socket` (Socket): Socket.io client
- `eventName` (string): Event name to wait for
- `predicate` (Function|null): Optional filter `(eventData) => boolean` (default: null)
- `timeout` (number): Timeout in ms (default: 5000)

**Returns:** Promise<Object> - Event data with envelope `{event, data, timestamp}`

**Example:**
```javascript
// Wait for any sync:full event
const event = await waitForEvent(socket, 'sync:full');

// Wait for specific team score update
const scoreEvent = await waitForEvent(
  socket,
  'score:updated',
  (data) => data.teamId === '001',
  5000
);
```

### 4. `validateEventEnvelope(event, expectedEventType)`

Validates event follows AsyncAPI contract envelope pattern.

**Validation Rules:**
- Event must be an object
- Must have `event`, `data`, and `timestamp` fields
- `event` field must match expected type
- `timestamp` must be ISO 8601 UTC format

**Parameters:**
- `event` (Object): Event object to validate
- `expectedEventType` (string): Expected value of `event.event` field

**Returns:** boolean - True if valid

**Throws:** Error with details if validation fails

**Example:**
```javascript
const event = await waitForEvent(socket, 'transaction:result');
validateEventEnvelope(event, 'transaction:result');
// Throws if event doesn't match envelope pattern
```

### 5. `disconnectSocket(socket)`

Gracefully disconnect a single socket and remove from tracking.

**Parameters:**
- `socket` (Socket): Socket.io client to disconnect

**Example:**
```javascript
disconnectSocket(socket);
```

### 6. `cleanupAllSockets()`

Disconnects all tracked sockets. Call in `afterAll()` hook.

**Example:**
```javascript
afterAll(() => {
  cleanupAllSockets();
});
```

### 7. `getActiveSocketCount()`

Returns the number of active tracked sockets (for debugging).

**Returns:** number - Count of active sockets

**Example:**
```javascript
console.log(`Active sockets: ${getActiveSocketCount()}`);
```

## Complete E2E Test Example

```javascript
const { startOrchestrator, stopOrchestrator } = require('./setup/test-server');
const {
  connectWithAuth,
  waitForEvent,
  validateEventEnvelope,
  cleanupAllSockets
} = require('./setup/websocket-client');

describe('WebSocket E2E Test', () => {
  let server;
  let socket;

  beforeAll(async () => {
    // Start orchestrator with HTTPS
    server = await startOrchestrator({ https: true });
  });

  afterAll(async () => {
    // Cleanup all sockets
    cleanupAllSockets();

    // Stop orchestrator
    await stopOrchestrator();
  });

  beforeEach(async () => {
    // Connect GM scanner
    socket = await connectWithAuth(
      server.url,
      'test-admin-password',
      'GM_Station_1',
      'gm'
    );
  });

  afterEach(() => {
    if (socket) {
      disconnectSocket(socket);
    }
  });

  it('should receive sync:full on connection', async () => {
    // Wait for initial sync
    const syncEvent = await waitForEvent(socket, 'sync:full', null, 5000);

    // Validate envelope
    validateEventEnvelope(syncEvent, 'sync:full');

    // Verify data structure
    expect(syncEvent.data).toHaveProperty('session');
    expect(syncEvent.data).toHaveProperty('scores');
  });

  it('should handle transaction submission', async () => {
    // Setup listeners BEFORE emitting
    const resultListener = waitForEvent(socket, 'transaction:result');
    const broadcastListener = waitForEvent(socket, 'transaction:new');

    // Submit transaction
    socket.emit('transaction:submit', {
      event: 'transaction:submit',
      data: {
        tokenId: '534e2b03',
        teamId: '001',
        deviceId: 'GM_Station_1',
        mode: 'blackmarket'
      },
      timestamp: new Date().toISOString()
    });

    // Wait for responses
    const resultEvent = await resultListener;
    const broadcastEvent = await broadcastListener;

    // Validate envelopes
    validateEventEnvelope(resultEvent, 'transaction:result');
    validateEventEnvelope(broadcastEvent, 'transaction:new');

    // Verify results
    expect(resultEvent.data.status).toBe('accepted');
    expect(broadcastEvent.data.transaction.tokenId).toBe('534e2b03');
  });
});
```

## Key Design Decisions

### 1. **HTTPS Support Built-In**
- Uses `rejectUnauthorized: false` for both axios and Socket.io
- Required for E2E tests with self-signed certificates
- Aligns with production HTTPS setup (required for NFC API in GM Scanner)

### 2. **Automatic Socket Tracking**
- All sockets created via `connectWithAuth()` are automatically tracked
- `cleanupAllSockets()` disconnects all at once
- Prevents socket leaks between tests

### 3. **Promise-Based Event Waiting**
- Follows integration test pattern from `backend/tests/helpers/websocket-helpers.js`
- Supports predicate filtering for conditional event matching
- Configurable timeouts per-event

### 4. **Contract-First Validation**
- `validateEventEnvelope()` enforces AsyncAPI contract compliance
- Checks envelope structure: `{event, data, timestamp}`
- Validates ISO 8601 UTC timestamp format
- Provides detailed error messages for debugging

### 5. **No Additional Dependencies**
- Uses only existing npm packages: `socket.io-client`, `axios`, `https`
- No new dependencies added to `package.json`
- Compatible with current test infrastructure

### 6. **Separated from Integration Tests**
- Located in `/tests/e2e/setup/` (not `/tests/helpers/`)
- Designed for Playwright E2E tests (not Jest integration tests)
- Handles real HTTPS/WebSocket connections (not in-process)

## Differences from Integration Test Helper

### `backend/tests/helpers/websocket-helpers.js` (Integration Tests)
- Uses in-process server (no HTTPS)
- Includes complex GM Scanner initialization (`createAuthenticatedScanner`)
- Loads token data from submodules
- Mocks browser environment

### `backend/tests/e2e/setup/websocket-client.js` (E2E Tests)
- Connects to real server via HTTPS
- Simple WebSocket client only (no scanner code)
- No token data loading (orchestrator provides)
- No browser mocks needed

## Testing with the Helper

The helper will be tested via the smoke test:
- `backend/tests/e2e/flows/smoke.test.js` (to be created)
- Tests authentication flow
- Tests event waiting
- Tests envelope validation
- Demonstrates real-world usage patterns

## References

- **AsyncAPI Contract**: `backend/contracts/asyncapi.yaml` (lines 22-45 for auth flow)
- **Integration Helpers**: `backend/tests/helpers/websocket-helpers.js`
- **Wait Conditions**: `backend/tests/e2e/helpers/wait-conditions.js`
- **Testing Guide**: `WEBSOCKET_TESTING_GUIDE.md`
- **Project Instructions**: `CLAUDE.md` (WebSocket authentication section)

## Module Statistics

- **Total Lines**: 342
- **Functions**: 7 (all exported)
- **Dependencies**: 3 (socket.io-client, axios, https)
- **JSDoc Comments**: Complete for all public functions
