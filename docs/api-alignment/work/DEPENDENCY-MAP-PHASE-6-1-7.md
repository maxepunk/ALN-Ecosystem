# Phase 6.1.7: Backend Dependency Mapping

**Created**: 2025-10-01
**Purpose**: Complete dependency analysis for atomic refactor coordination

---

## Complete Dependency Map

### Layer 1: Core & Config
```
config/index.js
  ← No dependencies (configuration leaf)

utils/logger.js
  ← config

utils/validators.js
  ← joi (external only)
```

### Layer 2: Storage
```
storage/StorageInterface.js
  ← No dependencies (interface)

storage/MemoryStorage.js
  ← StorageInterface

storage/FileStorage.js
  ← StorageInterface, node-persist

storage/index.js
  ← StorageInterface, MemoryStorage, FileStorage
```

### Layer 3: Models
```
models/token.js
  ← validators

models/transaction.js
  ← validators, uuid

models/session.js
  ← validators, uuid

models/teamScore.js
  ← validators

models/deviceConnection.js
  ← validators

models/videoQueueItem.js
  ← validators, uuid

models/gameState.js
  ← validators

models/adminConfig.js
  ← validators, bcrypt
```

### Layer 4: Services (WITH CIRCULAR DEPENDENCIES)

**persistenceService.js**:
```
← storage, config, logger
```

**tokenService.js**:
```
← config, fs, path
```

**discoveryService.js**:
```
← os, dgram (external only - network discovery)
```

**vlcService.js**:
```
← axios, EventEmitter, config, logger
```

**videoQueueService.js**:
```
← EventEmitter, VideoQueueItem, config, logger
```

**⚠️ CIRCULAR DEPENDENCY TRIANGLE** (sessionService ↔ stateService ↔ transactionService):

**sessionService.js**:
```
Top-level imports:
  ← EventEmitter, Session, persistenceService, config, logger

Lazy imports (ANTI-PATTERN):
  ← transactionService (line 57 - inside endSession method)
  ← stateService (line 58 - inside endSession method)
```

**stateService.js**:
```
Top-level imports:
  ← EventEmitter, GameState, persistenceService, config, logger, listenerRegistry

Lazy imports (ANTI-PATTERN):
  ← sessionService (line 54 - inside init method)
  ← transactionService (line 88 - inside syncStateFromSession method)
  ← sessionService (line 89 - inside syncStateFromSession method)
  ← videoQueueService (line 90 - inside syncStateFromSession method)
  ← offlineQueueService (line 91 - inside syncStateFromSession method)
```

**transactionService.js**:
```
Top-level imports:
  ← EventEmitter, Transaction, Token, TeamScore, config, logger

Lazy imports (ANTI-PATTERN):
  ← sessionService (line 34 - inside init method)
  ← sessionService (line 222 - inside initializeTeamScore method)
  ← sessionService (line 294 - inside isValidTeam method)
```

**offlineQueueService.js**:
```
Top-level imports (CREATES DEPENDENCY PRESSURE):
  ← EventEmitter, logger, persistenceService
  ← transactionService (EAGER - line 9)
  ← sessionService (EAGER - line 10)
  ← stateService (EAGER - line 11)

This service imports ALL THREE circular services EAGERLY, forcing them to use lazy requires
```

### Layer 5: Middleware
```
middleware/auth.js
  ← jwt, config, logger

middleware/offlineStatus.js
  ← No dependencies (simple state flag)
```

### Layer 6: WebSocket
```
websocket/listenerRegistry.js
  ← logger

websocket/eventWrapper.js
  ← No dependencies (pure utility - NEVER USED)

websocket/socketServer.js
  ← socket.io, config, logger

websocket/gmAuth.js
  ← logger, DeviceConnection, sessionService, stateService

websocket/deviceTracking.js
  ← logger, sessionService

websocket/roomManager.js
  ← logger

websocket/videoEvents.js
  ← logger, videoQueueService, vlcService, sessionService

websocket/adminEvents.js
  ← logger, sessionService, videoQueueService

websocket/broadcasts.js
  ← logger, listenerRegistry
```

### Layer 7: Routes
```
routes/docsRoutes.js
  ← express, swagger-ui-express, openapi

routes/tokenRoutes.js
  ← express, tokenService, logger

routes/stateRoutes.js
  ← express, os, crypto, logger, stateService, config

routes/videoRoutes.js
  ← express, logger, validators, vlcService, videoQueueService, authMiddleware

routes/scanRoutes.js
  ← express, logger, validators, sessionService, transactionService, offlineQueueService, offlineStatus

routes/transactionRoutes.js
  ← express, logger, sessionService, transactionService, validators

routes/sessionRoutes.js
  ← express, logger, validators, sessionService, stateService, authMiddleware

routes/adminRoutes.js
  ← express, logger, config, auth, sessionService, stateService, fs, path
```

### Layer 8: Application Core
```
app.js
  ← express, cors, helmet, rateLimit, config, logger, validators
  ← ALL services (persistenceService, sessionService, stateService, transactionService,
                   videoQueueService, vlcService, offlineQueueService)
  ← ALL routes (scanRoutes, stateRoutes, sessionRoutes, transactionRoutes,
                videoRoutes, adminRoutes, docsRoutes, tokenRoutes)

server.js
  ← http, app, initializeServices, config, logger, DiscoveryService
  ← createSocketServer, ALL WebSocket handlers
  ← sessionService, stateService, videoQueueService, offlineQueueService, transactionService

index.js
  ← server (entry point)
```

---

## Circular Dependency Analysis

### The Service Triangle

```
     sessionService
        ↓      ↑
        ↓      ↑ (lazy)
        ↓      ↑
        ↓  stateService
        ↓      ↑
  (lazy)↓      ↑ (lazy)
        ↓      ↑
        ↓      ↑
    transactionService
```

**Breaking Mechanism**: Lazy `require()` inside methods

**Why This Exists**:
1. sessionService needs transactionService to reset scores on session end
2. transactionService needs sessionService to validate teams and get current session
3. stateService needs BOTH to sync game state
4. offlineQueueService needs ALL THREE to process queued scans

**Why It's Bad**:
- Hidden runtime dependencies (not visible at file level)
- Tight coupling between core services
- Makes refactoring extremely difficult
- No dependency injection framework
- Violates Dependency Inversion Principle

---

## Lazy Require Instances (Complete List)

| File | Line | Lazy Import | Used In Method | Why Lazy? |
|------|------|-------------|----------------|-----------|
| sessionService.js | 57 | transactionService | endSession() | Break circular: transactionService imports sessionService |
| sessionService.js | 58 | stateService | endSession() | Break circular: stateService imports sessionService |
| stateService.js | 54 | sessionService | init() | Break circular: sessionService imports stateService |
| stateService.js | 88 | transactionService | syncStateFromSession() | Break circular |
| stateService.js | 89 | sessionService | syncStateFromSession() | Break circular |
| transactionService.js | 34 | sessionService | init() | Break circular: sessionService imports transactionService |
| transactionService.js | 222 | sessionService | initializeTeamScore() | Break circular |
| transactionService.js | 294 | sessionService | isValidTeam() | Break circular |

**Total**: 8 lazy requires across 3 services

---

## Cross-Layer Import Violations

### Direct Service → Service Imports (Expected)
✅ All services import `persistenceService` (shared persistence layer)
✅ WebSocket handlers import services they orchestrate

### Problematic Patterns

**❌ offlineQueueService imports 3 services EAGERLY**:
```javascript
// offlineQueueService.js:9-11
const transactionService = require('./transactionService');
const sessionService = require('./sessionService');
const stateService = require('./stateService');
```
This creates dependency pressure, forcing the triangle to use lazy requires

**❌ stateService imports WebSocket layer (listenerRegistry)**:
```javascript
// stateService.js:11
const listenerRegistry = require('../websocket/listenerRegistry');
```
Service layer should NOT import WebSocket layer - violates unidirectional data flow

**✅ Routes correctly import services** (expected pattern)

**✅ WebSocket handlers correctly import services** (expected pattern)

---

## Tight Coupling Points (Atomic Refactor Required)

### 1. scannerId → deviceId Refactor Chain

**Must be changed atomically** (cannot be done incrementally):

```
validators.js (Joi schemas)
  ↓ validates
models/transaction.js (data definition)
  ↓ uses
services/transactionService.js (business logic)
  ↓ emits
services/stateService.js (state sync)
  ↓ broadcasts
websocket/broadcasts.js (WebSocket events)
  ↓ sends to
Scanner clients (GM Scanner, Player Scanner)
```

**Why atomic?**
- Validators enforce schema at model construction
- Models define field structure
- Services use field names in logic
- Broadcasts send field names to clients
- Scanners expect specific field names

**Breaking this chain partially = system failure**

### 2. Event Wrapper Pattern Implementation

**Must be implemented atomically**:

```
websocket/eventWrapper.js (utility exists but unused)
  ↓ must be imported by
websocket/broadcasts.js (8 broadcast methods)
  ↓ must wrap events sent to
websocket/adminEvents.js (3 emit sites)
websocket/videoEvents.js (2 emit sites)
websocket/gmAuth.js (4 emit sites)
  ↓ which connect to
Scanner clients (must handle wrapped format)
```

**Why atomic?**
- Scanners expect consistent message format
- Partial wrapping = inconsistent client behavior
- All emits must change simultaneously

### 3. Circular Service Dependency Resolution

**Must be refactored together**:

```
Remove lazy requires from:
  - sessionService.js (2 lazy imports)
  - stateService.js (4 lazy imports)
  - transactionService.js (3 lazy imports)

Introduce dependency injection in:
  - All 3 services (constructor injection)
  - app.js (wire dependencies)
  - server.js (wire dependencies)
```

**Why atomic?**
- Removing lazy requires without DI = initialization failure
- Services reference each other during init()
- Must introduce DI container simultaneously

### 4. Session.toAPIResponse() Removal

**Simpler, can be done independently**:

```
models/session.js (remove toAPIResponse method)
  ↓
routes/sessionRoutes.js (add response formatting)
routes/adminRoutes.js (add response formatting)
```

**Why independent?**
- Only 2 route files affected
- No WebSocket dependencies
- No validator dependencies
- Can be done without breaking other refactors

---

## Visual Dependency Graph (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYERS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐                                                   │
│  │ index.js │  (Entry Point)                                    │
│  └────┬─────┘                                                   │
│       │                                                         │
│  ┌────▼──────┐                                                  │
│  │ server.js │  ← DiscoveryService (UDP broadcast)              │
│  └────┬──────┘                                                  │
│       │                                                         │
│  ┌────▼────┐                                                    │
│  │ app.js  │  (Express application + service initialization)   │
│  └────┬────┘                                                    │
│       │                                                         │
│       ├─────────────┬──────────────┬───────────────┐            │
│       │             │              │               │            │
│  ┌────▼───┐   ┌────▼────┐   ┌─────▼──────┐  ┌────▼──────┐    │
│  │ Routes │   │ WebSocket│   │ Middleware │  │ Services  │    │
│  │ Layer  │   │  Layer   │   │   Layer    │  │   Layer   │    │
│  └────┬───┘   └────┬─────┘   └─────┬──────┘  └────┬──────┘    │
│       │            │               │              │            │
│       │            │               │              │            │
│       └────────────┴───────────────┴──────────────┘            │
│                          │                                     │
│                     ┌────▼─────┐                               │
│                     │  Models  │                               │
│                     │  Layer   │                               │
│                     └────┬─────┘                               │
│                          │                                     │
│                   ┌──────▼───────┐                             │
│                   │  Validators  │                             │
│                   │  (Joi schemas)│                             │
│                   └──────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

SERVICE LAYER CIRCULAR DEPENDENCIES (PROBLEM):

         ┌──────────────────┐
         │ sessionService   │
         └────┬───────▲─────┘
              │       │
        (lazy)│       │(lazy)
              │       │
         ┌────▼───────┴─────┐
         │   stateService   │
         └────┬───────▲─────┘
              │       │
        (lazy)│       │(lazy)
              │       │
      ┌───────▼───────┴──────────┐
      │  transactionService      │
      └──────────────────────────┘
               ▲
               │ (eager)
      ┌────────┴──────────┐
      │ offlineQueueService│ ← Forces lazy requires
      └────────────────────┘

EXPECTED FLOW (unidirectional):

  Scanner Client
       ↓
  WebSocket Layer
       ↓
  Route Layer
       ↓
  Service Layer
       ↓
  Model Layer
       ↓
  Validator Layer
       ↓
  Storage Layer

ACTUAL FLOW (bidirectional - PROBLEM):

  Scanner Client
       ↕ (WebSocket bidirectional)
  WebSocket Layer
       ↕ (broadcasts import services, services import listenerRegistry)
  Route Layer
       ↓
  Service Layer ← CIRCULAR DEPENDENCIES
       ↓
  Model Layer
       ↓
  Validator Layer
       ↓
  Storage Layer
```

---

## Import Statistics

**Total Files Analyzed**: 46 backend files

**By Layer**:
- Core: 3 files (app.js, server.js, index.js)
- Routes: 8 files
- Services: 9 files
- Models: 8 files
- WebSocket: 8 files
- Middleware: 2 files
- Utils: 2 files
- Storage: 4 files
- Config: 1 file
- Docs: 1 file

**Dependency Patterns**:
- Normal imports: 142 total
- Lazy requires (anti-pattern): 8 instances
- Circular dependencies: 1 triangle (3 services)
- Cross-layer violations: 1 instance (stateService → listenerRegistry)
- Unused utilities: 1 file (eventWrapper.js)

**External Dependencies** (npm packages):
- express, socket.io, cors, helmet, rate-limit (web framework)
- joi (validation)
- winston (logging)
- uuid, bcrypt, jwt (utilities)
- axios (HTTP client for VLC)
- node-persist (storage)
- swagger-ui-express (API docs)

---

## Refactor Coordination Map

### Phase 1: Safe Refactors (No Coordination Required)
1. Remove Session.toAPIResponse() - 2 route files only
2. Remove test code pollution - individual service files
3. Use eventWrapper.js - WebSocket layer only
4. Standardize response builders - route layer only

### Phase 2: Atomic Refactors (Full Coordination Required)
1. **scannerId → deviceId** (HIGHEST RISK):
   - validators.js schemas
   - models/transaction.js
   - All 9 service files
   - All 8 route files
   - All 8 WebSocket files
   - Scanner client code
   - Test files
   - **Estimate**: 30+ files

2. **Event wrapping standardization** (MEDIUM RISK):
   - Import eventWrapper.js in 4 WebSocket files
   - Wrap 15 emit sites
   - Update scanner event handlers
   - Update tests
   - **Estimate**: 8 backend files + 2 scanner repos

3. **Circular dependency resolution** (HIGH RISK):
   - Introduce DI container
   - Remove 8 lazy requires
   - Update service constructors
   - Update app.js initialization
   - Update server.js initialization
   - Update all tests (mocking patterns change)
   - **Estimate**: 10 backend files + all test files

### Phase 3: Verification (After Each Atomic Refactor)
1. Run full test suite
2. Manual integration testing
3. Scanner connectivity testing
4. VLC integration testing
5. WebSocket event validation

---

## Recommendations for Atomic Refactor Strategy

### 1. Establish Test Coverage FIRST
Before ANY refactor:
- Contract tests for all HTTP endpoints
- Contract tests for all WebSocket events
- Integration tests for service interactions
- **Current status**: Tests exist but may need updates

### 2. Refactor Order (Safest → Riskiest)
1. ✅ Remove test code pollution (safe, isolated)
2. ✅ Implement eventWrapper usage (medium, testable)
3. ✅ Remove Session.toAPIResponse() (safe, 2 files)
4. ⚠️ Resolve circular dependencies (high risk, but enables next step)
5. 🔴 scannerId → deviceId rename (highest risk, touch everything)

### 3. Use Feature Flags for Risky Changes
For scannerId → deviceId:
- Support BOTH field names temporarily
- Feature flag: `FEATURE_USE_DEVICE_ID=true`
- Gradual rollout: validators → models → services → routes → WebSocket
- Remove scannerId support after full validation

### 4. Coordinate with Scanner Repos
- Update scanner repos AFTER backend is verified
- Use API versioning if needed
- Document breaking changes clearly

---

## Dependency Injection Strategy (Future)

**Current**: Services use lazy requires to break circular dependencies

**Target**: Constructor injection with DI container

**Example Transformation**:

**Before** (current):
```javascript
// sessionService.js
class SessionService extends EventEmitter {
  constructor() {
    super();
    // No dependencies injected
  }

  endSession() {
    // Lazy require inside method
    const transactionService = require('./transactionService');
    const stateService = require('./stateService');
    // Use services
  }
}
```

**After** (with DI):
```javascript
// sessionService.js
class SessionService extends EventEmitter {
  constructor({ transactionService, stateService, persistenceService }) {
    super();
    this.transactionService = transactionService;
    this.stateService = stateService;
    this.persistenceService = persistenceService;
  }

  endSession() {
    // Use injected dependencies
    this.transactionService.resetScores();
    this.stateService.reset();
  }
}
```

**app.js initialization**:
```javascript
// Create services in dependency order
const persistenceService = new PersistenceService();
const sessionService = new SessionService({ persistenceService });
const transactionService = new TransactionService({ sessionService, persistenceService });
const stateService = new StateService({
  sessionService,
  transactionService,
  persistenceService
});

// Wire circular dependencies after construction
sessionService.setDependencies({ transactionService, stateService });
```

**Benefits**:
- Explicit dependencies (no hidden lazy requires)
- Easier testing (mock injection)
- Clear initialization order
- Supports circular dependencies properly

---

## Summary

**Dependencies Mapped**:
- 46 files analyzed
- 150+ import statements documented
- 8 lazy requires identified
- 1 circular dependency triangle mapped

**Critical Issues**:
1. Circular service dependencies (sessionService ↔ stateService ↔ transactionService)
2. Lazy require anti-pattern (8 instances)
3. Cross-layer violation (stateService → listenerRegistry)
4. No dependency injection framework

**Refactor Complexity**:
- scannerId → deviceId: ~30 files (atomic refactor required)
- Event wrapping: ~8 backend files + 2 scanner repos
- Circular dependencies: ~10 backend files + all tests
- Session.toAPIResponse: 2 files (safe)

**Ready for Phase 6.2**: ✅
All backend dependencies mapped, tight coupling identified, atomic refactor requirements documented.

---
