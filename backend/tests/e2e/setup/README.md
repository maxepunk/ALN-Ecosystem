# E2E Test Infrastructure Setup

This directory contains infrastructure helpers for end-to-end (E2E) tests.

## Purpose

E2E tests validate the complete ALN Ecosystem by testing real orchestrator instances with actual HTTP/WebSocket connections, as opposed to unit/integration tests that mock services.

## Files

### `test-server.js`

Orchestrator lifecycle management helper for E2E tests.

**Key Features:**
- Spawns real orchestrator process using `child_process.spawn`
- Tests actual HTTP/HTTPS and WebSocket endpoints (no mocking)
- Handles HTTPS self-signed certificates
- Manages session data persistence between tests
- Graceful shutdown with SIGTERM → SIGKILL fallback
- Health check polling for startup verification

**API:**

#### `startOrchestrator(options)`

Start orchestrator server for E2E tests.

**Parameters:**
- `options.https` (boolean) - Enable HTTPS server (default: false)
- `options.port` (number) - Custom port (default: 3000)
- `options.timeout` (number) - Startup timeout in ms (default: 30000)
- `options.preserveSession` (boolean) - Keep session data from previous run (default: false)

**Returns:** `Promise<Object>` - Server info `{ url, port, protocol, process }`

**Example:**
```javascript
const server = await startOrchestrator({
  https: true,
  port: 3001,
  timeout: 60000
});
console.log(`Server running at ${server.url}`);
```

#### `stopOrchestrator(options)`

Stop orchestrator server gracefully.

**Parameters:**
- `options.timeout` (number) - Shutdown timeout before SIGKILL (default: 5000)

**Returns:** `Promise<void>`

**Example:**
```javascript
await stopOrchestrator({ timeout: 10000 });
```

#### `restartOrchestrator(options)`

Restart orchestrator server.

**Parameters:**
- `options.preserveSession` (boolean) - Keep session data across restart (default: true)
- `options.timeout` (number) - Startup timeout (default: 30000)

**Returns:** `Promise<Object>` - New server info

**Example:**
```javascript
// Test session recovery after crash
await restartOrchestrator({ preserveSession: true });
```

#### `getOrchestratorUrl()`

Get orchestrator base URL.

**Returns:** `string` - Base URL (e.g., "https://localhost:3000")

**Example:**
```javascript
const url = getOrchestratorUrl();
const response = await fetch(`${url}/health`);
```

#### `clearSessionData()`

Clear session data between tests.

**Returns:** `Promise<void>`

**Example:**
```javascript
beforeEach(async () => {
  await clearSessionData();
});
```

#### `waitForHealthy(timeout)`

Wait for orchestrator to be healthy and ready.

**Parameters:**
- `timeout` (number) - Maximum wait time in ms (default: 30000)

**Returns:** `Promise<void>`

**Throws:** Error if server doesn't become healthy within timeout

**Example:**
```javascript
await waitForHealthy(10000); // Wait up to 10 seconds
```

#### `getServerStatus()`

Get current server status.

**Returns:** `Object|null` - Status object or null if not running

**Example:**
```javascript
const status = getServerStatus();
if (status) {
  console.log(`Server running on port ${status.port}`);
}
```

## Usage in Tests

### Basic Test Setup

```javascript
const { startOrchestrator, stopOrchestrator } = require('./setup/test-server');

describe('My E2E Test', () => {
  beforeAll(async () => {
    await startOrchestrator({ https: true });
  });

  afterAll(async () => {
    await stopOrchestrator();
  });

  it('should test something', async () => {
    // Your test code here
  });
});
```

### Testing Session Persistence

```javascript
const { restartOrchestrator, getOrchestratorUrl } = require('./setup/test-server');
const axios = require('axios');

it('should restore session after restart', async () => {
  // Create session
  const url = getOrchestratorUrl();
  await axios.post(`${url}/api/session`, { name: 'Test Session' });

  // Restart with session preservation
  await restartOrchestrator({ preserveSession: true });

  // Verify session restored
  const response = await axios.get(`${url}/api/session`);
  expect(response.data.name).toBe('Test Session');
});
```

### Clean State Between Tests

```javascript
const { clearSessionData } = require('./setup/test-server');

beforeEach(async () => {
  await clearSessionData();
});
```

## Environment Variables

The helper uses these test-specific environment variables:

- `TEST_PORT` - Server port (default: 3000)
- `TEST_HTTPS` - Enable HTTPS (default: false)
- `TEST_DEBUG` - Show server output (default: false)

**Example:**
```bash
TEST_PORT=3001 TEST_HTTPS=true npm run test:e2e
```

## Differences from Integration Tests

| Aspect | Integration Tests | E2E Tests |
|--------|------------------|-----------|
| Server | In-process (same Node.js process) | Separate process (child_process) |
| Lifecycle | Manual setup/teardown | Automatic process management |
| HTTP | Direct Express app | Real HTTP requests |
| WebSocket | Mock Socket.io | Real WebSocket connections |
| Session | Test-only state | Persistent disk storage |
| Cleanup | Manual service reset | Process termination |

## Troubleshooting

### Server Won't Start

**Problem:** `Orchestrator startup failed: timeout`

**Solutions:**
1. Increase timeout: `await startOrchestrator({ timeout: 60000 })`
2. Check port is free: `lsof -i :3000`
3. Enable debug output: `TEST_DEBUG=true npm run test:e2e`

### Port Already in Use

**Problem:** `EADDRINUSE: address already in use`

**Solutions:**
1. Use different port: `await startOrchestrator({ port: 3001 })`
2. Kill existing process: `lsof -ti:3000 | xargs kill -9`

### Tests Hang on Exit

**Problem:** Jest hangs after tests complete

**Solutions:**
1. Ensure `stopOrchestrator()` is called in `afterAll()`
2. Check for open connections in tests
3. Use `--detectOpenHandles` to find leaks

### HTTPS Certificate Errors

**Problem:** `self signed certificate` error

**Solutions:**
1. Use axios with `rejectUnauthorized: false`:
```javascript
const https = require('https');
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});
```
2. Or use HTTP mode for tests: `await startOrchestrator({ https: false })`

## Next Steps

1. Create additional helpers:
   - `vlc-service.js` - VLC integration testing
   - `browser-contexts.js` - Playwright browser management
   - `websocket-client.js` - WebSocket test client

2. Implement page objects:
   - `helpers/page-objects/GMScannerPage.js`
   - `helpers/page-objects/PlayerScannerPage.js`
   - `helpers/page-objects/ScoreboardPage.js`

3. Create test fixtures:
   - `fixtures/test-tokens.json`
   - `fixtures/test-videos/`

See `docs/E2E_TEST_IMPLEMENTATION_PLAN.md` for complete roadmap.
