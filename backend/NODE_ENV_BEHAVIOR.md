# ALN Orchestrator NODE_ENV Behavior Reference

## Overview

The ALN Orchestrator system behaves differently based on the NODE_ENV environment variable. This document details the exact differences between test, development, and production modes based on the actual codebase implementation.

## Environment-Specific Behaviors

### TEST Environment (`NODE_ENV=test`)

**Purpose**: Fast, isolated, and predictable testing environment

#### Storage & Persistence
- **Uses MEMORY storage exclusively** - All data stored in RAM, nothing written to disk
- Sessions automatically cleared on startup (`sessionService.js:init()`)
- Offline queue automatically cleared on startup (`offlineQueueService.js:init()`)
- Perfect test isolation - each test run starts fresh

#### Mock Data Support
- **Auto-creates mock tokens** for IDs starting with `TEST_` or `MEM_`
  - Location: `scanRoutes.js`, `transactionService.js`
  - Example: `TEST_VIDEO_TOKEN`, `MEM_123`
- **Auto-creates test sessions** when none exists during scan attempts
- Enables testing without real token data or manual setup

#### Network & Security
- **CORS**: Allows ANY localhost origin (supports dynamic test port allocation)
- **Rate limiting**: DISABLED - Tests can make unlimited requests
- **Discovery service**: DISABLED - No UDP broadcasts during tests
- **Health monitoring**: DISABLED - No background intervals that could interfere with tests

#### Processing Behavior
- Video queue processes **synchronously/immediately** for predictable test results
  - No `setImmediate()` delays - everything runs in current tick
  - Location: `videoQueueService.js:processQueue()`
- **Listener registry enabled** for tracking and cleaning up event handlers
  - Location: `websocket/listenerRegistry.js`

#### Logging
- **Crash handlers disabled** - Tests handle their own errors
- Clean exit without error logging noise
- No automatic error recovery

### DEVELOPMENT Environment (`NODE_ENV=development`)

**Purpose**: Convenient development with debugging support and persistence

#### Storage & Persistence
- **Uses FILE storage** - Data persists in `backend/data/` directory
- Sessions preserved between server restarts
- Enables iterative development without losing state

#### Network & Security
- **CORS**: Default origins allowed (localhost + local network IPs)
- **Rate limiting**: ENABLED at default levels (100 requests per 15 minutes)
- **Discovery service**: ENABLED - UDP broadcasts every 5 seconds on port 8888
- **Health monitoring**: ENABLED - Background health checks every 30 seconds

#### Processing Behavior
- Video queue uses **asynchronous processing** with `setImmediate()`
- Realistic timing delays between operations
- **Listener registry disabled** - Normal event handling without tracking

#### Logging
- **Default level**: DEBUG (most verbose)
- **Format**: Colorized console output for readability
- **Crash handlers**: ENABLED - Logs uncaught exceptions
- **Output**: Console + optional file logging

### PRODUCTION Environment (`NODE_ENV=production`)

**Purpose**: Optimized for reliability, security, and performance

#### Storage & Persistence
- **Uses FILE storage** with configurable directory
- Can use system directories like `/var/lib/aln-orchestrator`
- Full persistence for system reliability
- Automatic backup capabilities

#### Network & Security
- **CORS**: Strict - Only explicitly configured origins allowed
- **Rate limiting**: ENABLED with production limits
- **Discovery service**: ENABLED for network flexibility
- **Health monitoring**: ENABLED with production intervals

#### Processing Behavior
- **Optimized async processing** with proper queue management
- Graceful degradation when services unavailable
- **Listener registry disabled** - Minimal overhead
- Error recovery and retry mechanisms active

#### Logging
- **Default level**: INFO (balanced verbosity)
- **Format**: JSON for log aggregation tools
- **Output**: File-based logging to `logs/` directory
- **Crash handling**: Full error recovery and reporting
- Log rotation and management

## Code Examples

### 1. Storage Selection
```javascript
// persistenceService.js
const storageType = process.env.NODE_ENV === 'test' ? 'memory' : 'file';
```

### 2. CORS Configuration
```javascript
// app.js
if (process.env.NODE_ENV === 'test' &&
    (!origin || origin?.includes('localhost'))) {
  callback(null, true);  // Allow any localhost in tests
}
```

### 3. Rate Limiting
```javascript
// app.js
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', createRateLimiter());  // Disabled in tests
}
```

### 4. Mock Token Creation
```javascript
// scanRoutes.js
if (!token && process.env.NODE_ENV === 'test' &&
    scanRequest.tokenId.startsWith('TEST_')) {
  // Create mock token for testing
  token = {
    id: tokenId,
    video: tokenId.includes('VIDEO') ? 'test.mp4' : null,
    // ... mock properties
  };
}
```

### 5. Queue Processing Timing
```javascript
// videoQueueService.js
if (process.env.NODE_ENV === 'test') {
  this.processQueue();  // Immediate (synchronous)
} else {
  setImmediate(() => this.processQueue());  // Asynchronous
}
```

### 6. Background Services
```javascript
// server.js
if (process.env.NODE_ENV !== 'test') {
  discoveryService = new DiscoveryService();  // No UDP in tests
  startHealthMonitoring();  // No background intervals in tests
}
```

### 7. Session Initialization
```javascript
// sessionService.js
if (process.env.NODE_ENV === 'test') {
  await persistenceService.delete('session:current');  // Clear for tests
}
```

### 8. Error Handling
```javascript
// utils/logger.js
if (!handlersRegistered && process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', handleCrash);
  process.on('unhandledRejection', handleCrash);
}
```

## Comparison Table

| Feature | Test | Development | Production |
|---------|------|-------------|------------|
| **Storage Type** | Memory only | File (./data) | File (configurable) |
| **Data Persistence** | None (cleared) | Yes | Yes |
| **Session Cleanup** | Auto-cleared | Preserved | Preserved |
| **Mock Tokens** | Auto-created | No | No |
| **Test Sessions** | Auto-created | Manual | Manual |
| **CORS Policy** | Any localhost | Configured + defaults | Strict configured |
| **Rate Limiting** | Disabled | Enabled (default) | Enabled (strict) |
| **Discovery/UDP** | Disabled | Enabled | Enabled |
| **Health Monitoring** | Disabled | Enabled | Enabled |
| **Queue Processing** | Synchronous | Asynchronous | Asynchronous |
| **Event Registry** | Enabled | Disabled | Disabled |
| **Default Log Level** | Configurable | Debug | Info |
| **Log Format** | Configurable | Colorized console | JSON files |
| **Crash Handlers** | Disabled | Enabled | Enabled |
| **Error Recovery** | None | Basic | Full |

## Usage Examples

### Running in Different Modes

```bash
# Test mode (for automated testing)
NODE_ENV=test npm test

# Development mode (default when not specified)
npm start
# or explicitly:
NODE_ENV=development npm start

# Production mode (for deployment)
NODE_ENV=production npm start
# or with PM2:
pm2 start ecosystem.config.js --env production
```

### Checking Current Mode

```javascript
// In application code
console.log(`Running in ${process.env.NODE_ENV || 'development'} mode`);

// Check specific mode
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isTest && !isProduction;
```

## Design Philosophy

### Test Environment
- **Fast**: No delays, immediate processing
- **Isolated**: Memory storage, no persistence between runs
- **Predictable**: Synchronous operations, no background tasks
- **Flexible**: Mock data support, relaxed security

### Development Environment
- **Convenient**: State persistence, verbose logging
- **Realistic**: Async processing, background services
- **Debuggable**: Detailed logs, error traces
- **Flexible**: Reasonable defaults, easy overrides

### Production Environment
- **Reliable**: Full persistence, error recovery
- **Secure**: Strict CORS, rate limiting
- **Optimized**: Efficient logging, proper async handling
- **Monitorable**: Health checks, structured logs

## Migration Notes

When moving between environments:

1. **Test → Development**:
   - Real tokens needed (no auto-mocking)
   - Data will persist between runs
   - Rate limits apply

2. **Development → Production**:
   - Update CORS origins in .env
   - Configure proper VLC password
   - Set up log rotation
   - Enable firewall rules

3. **Any → Test**:
   - All data cleared on start
   - No network services (UDP/health checks)
   - Mock tokens available

## Related Configuration

See `.env` file for additional environment-specific settings:
- `LOG_LEVEL`: Override default log level
- `CORS_ORIGINS`: Specify allowed origins
- `RATE_LIMIT_MAX`: Adjust rate limits
- `SESSION_TIMEOUT`: Session duration
- `PERSISTENCE_DIR`: Storage location (production)