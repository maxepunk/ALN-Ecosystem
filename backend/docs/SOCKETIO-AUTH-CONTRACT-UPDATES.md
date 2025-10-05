# Socket.io Standard Auth Flow - Contract Update Specification

**Status**: DRAFT - Pending Review
**Created**: 2025-10-05
**Purpose**: Remove redundant gm:identify/gm:identified events and implement Socket.io standard handshake authentication

---

## Executive Summary

The current contracts define a **redundant two-step authentication process**:
1. JWT obtained via POST /api/admin/auth ✅ (standard)
2. WebSocket connection with token in handshake.auth ✅ (standard)
3. Client sends `gm:identify` event with token **AGAIN** ❌ (redundant)
4. Server validates and responds with `gm:identified` ❌ (redundant)
5. Server sends sync:full ✅ (standard)

**Proposal**: Eliminate steps 3-4 and use Socket.io middleware for handshake authentication (industry standard pattern).

---

## Current vs Proposed Flow

### Current Flow (Redundant)
```
┌─────────┐                          ┌─────────┐
│ Client  │                          │ Server  │
└────┬────┘                          └────┬────┘
     │                                    │
     │ 1. POST /api/admin/auth           │
     ├──────────────────────────────────>│
     │ 2. {token, expiresIn}             │
     │<──────────────────────────────────┤
     │                                    │
     │ 3. WebSocket connect               │
     │    handshake.auth: {token, ...}   │
     ├──────────────────────────────────>│
     │ 4. Connection accepted             │
     │<──────────────────────────────────┤
     │                                    │
     │ 5. gm:identify {token, deviceId}  │  ← REDUNDANT
     ├──────────────────────────────────>│
     │ 6. gm:identified {success: true}  │  ← REDUNDANT
     │<──────────────────────────────────┤
     │                                    │
     │ 7. sync:full {state}              │
     │<──────────────────────────────────┤
     └                                    ┘
```

### Proposed Flow (Socket.io Standard)
```
┌─────────┐                          ┌─────────┐
│ Client  │                          │ Server  │
└────┬────┘                          └────┬────┘
     │                                    │
     │ 1. POST /api/admin/auth           │
     ├──────────────────────────────────>│
     │ 2. {token, expiresIn}             │
     │<──────────────────────────────────┤
     │                                    │
     │ 3. WebSocket connect               │
     │    handshake.auth: {               │
     │      token,                        │
     │      deviceId,                     │
     │      deviceType,                   │
     │      version                       │
     │    }                               │
     ├──────────────────────────────────>│
     │                                    │ ← Middleware validates JWT
     │                                    │ ← Creates device connection
     │                                    │ ← Broadcasts device:connected
     │                                    │
     │ 4. sync:full {state}              │ ← Auto-sent on connection
     │<──────────────────────────────────┤
     └                                    ┘

Alternative: Auth Failure
     │ 3. WebSocket connect               │
     │    handshake.auth: {invalid}      │
     ├──────────────────────────────────>│
     │                                    │ ← Middleware rejects
     │ 4. connect_error (AUTH_REQUIRED)  │ ← Connection refused
     │<──────────────────────────────────┤
     └                                    ┘
```

**Benefits**:
- Eliminates 2 round trips (20-40ms latency reduction)
- Fails fast: invalid auth rejected at connection time
- Industry standard Socket.io pattern
- Simpler client and server code
- No window where client is "connected but not identified"

---

## Handshake.auth Structure

### Client → Server (during connection)

```typescript
interface HandshakeAuth {
  // REQUIRED: JWT token from POST /api/admin/auth
  token: string;

  // REQUIRED: Unique device identifier
  // Format: "GM_STATION_1", "ADMIN_PANEL_1", etc.
  deviceId: string;

  // REQUIRED: Device type for role-based permissions
  deviceType: 'gm' | 'admin';

  // OPTIONAL: Client version for compatibility checks
  version?: string;  // e.g., "1.0.0"
}
```

### Example
```javascript
io('http://localhost:3000', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    deviceId: 'GM_STATION_1',
    deviceType: 'gm',
    version: '1.0.0'
  }
});
```

---

## Contract Changes Required

### 1. OpenAPI Contract (openapi.yaml)

#### Change 1.1: Update POST /api/admin/auth Description

**Location**: Lines 54-71

**Current**:
```yaml
**Flow**:
1. Admin Panel sends password
2. Backend validates password
3. Returns JWT token (24-hour expiry)
4. Token used for WebSocket handshake (gm:identify event)

**Security**:
- Password validation via environment variable
- JWT tokens for stateless auth
- Tokens tracked for active sessions
```

**New**:
```yaml
**Flow**:
1. Admin Panel sends password
2. Backend validates password
3. Returns JWT token (24-hour expiry)
4. Token used for WebSocket connection authentication

**WebSocket Authentication**:
Client includes JWT token in Socket.io `handshake.auth` object when connecting.
Server validates token via middleware during connection handshake (before connection accepted).

Authentication succeeds:
  - Connection established
  - Device registered in session
  - `device:connected` broadcast to other clients
  - `sync:full` event auto-sent to newly connected client

Authentication fails:
  - Connection rejected immediately
  - Client receives Socket.io `connect_error` event
  - Error code: AUTH_REQUIRED, INVALID_TOKEN, or TOKEN_EXPIRED

**Handshake.auth Structure**:
```javascript
{
  token: "JWT_TOKEN",           // Required: JWT from this endpoint
  deviceId: "DEVICE_ID",        // Required: Unique device identifier
  deviceType: "gm" | "admin",   // Required: Device type
  version: "1.0.0"              // Optional: Client version
}
```

**Security**:
- Password validation via environment variable
- JWT tokens for stateless WebSocket authentication
- Token validation during Socket.io handshake (connection-time)
- Tokens tracked for active sessions (revocable via logout)
- Failed authentication blocks connection establishment
```

---

### 2. AsyncAPI Contract (asyncapi.yaml)

#### Change 2.1: Update info.description

**Location**: Lines 3-24

**Add after line 19** (after "Real-time state sync via sync:full event"):

```yaml
**Authentication Pattern**:
This API uses Socket.io handshake authentication (NOT application-level auth events).

**Authentication Flow**:
1. Client obtains JWT token via HTTP POST /api/admin/auth (see OpenAPI spec)
2. Client connects WebSocket with token in `handshake.auth` object
3. Server validates JWT in Socket.io middleware before accepting connection
4. Success: Connection established → server auto-sends sync:full event
5. Failure: Connection rejected → client receives connect_error (transport-level)

**Handshake.auth Object**:
```javascript
{
  token: "JWT_TOKEN",           // Required: JWT from POST /api/admin/auth
  deviceId: "DEVICE_ID",        // Required: Unique device identifier
  deviceType: "gm" | "admin",   // Required: Device type for permissions
  version: "1.0.0"              // Optional: Client version string
}
```

**Connection Validation**:
Server middleware checks:
- JWT signature validity (HMAC SHA256)
- JWT expiration (24-hour window)
- Token presence in active token registry
- deviceId format and uniqueness
- deviceType matches allowed values

**Connection Rejection Reasons**:
- Missing or malformed token
- Invalid JWT signature
- Expired JWT (> 24 hours old)
- Token revoked (logout/admin action)
- Invalid deviceId or deviceType
- Server at capacity (max GM stations reached)

On rejection: Client receives Socket.io connect_error event with error message.
NOT an application-level error event (which requires established connection).

**Device Registration**:
After successful authentication, server:
1. Extracts device info from handshake.auth
2. Creates DeviceConnection model
3. Registers device in current session (if exists)
4. Broadcasts device:connected event to other clients
5. Sends sync:full event to newly connected client
```

#### Change 2.2: Remove GmIdentify Message

**Location**: Lines 80-136 (entire GmIdentify message definition)

**Action**: DELETE ENTIRE SECTION

This includes:
- Message schema definition
- Payload structure
- Documentation
- Examples

#### Change 2.3: Remove GmIdentified Message

**Location**: Lines 138-188 (entire GmIdentified message definition)

**Action**: DELETE ENTIRE SECTION

This includes:
- Message schema definition
- Payload structure
- Documentation
- Examples
- Note about sync:full being sent after this event

#### Change 2.4: Update channel publish.message.oneOf

**Location**: Line 70 (within publish.message.oneOf array)

**Current**:
```yaml
publish:
  summary: Send events to orchestrator
  message:
    oneOf:
      - $ref: '#/components/messages/GmIdentify'
      - $ref: '#/components/messages/TransactionSubmit'
      - $ref: '#/components/messages/GmCommand'
```

**New**:
```yaml
publish:
  summary: Send events to orchestrator
  description: |
    Client-to-server events (incoming from orchestrator perspective).
    All events use wrapped envelope pattern per Decision #2.

    Note: Authentication happens at connection time via Socket.io handshake,
    not via application-level events.
  message:
    oneOf:
      - $ref: '#/components/messages/TransactionSubmit'
      - $ref: '#/components/messages/GmCommand'
```

#### Change 2.5: Update channel subscribe.message.oneOf

**Location**: Line 50 (within subscribe.message.oneOf array)

**Current**:
```yaml
subscribe:
  summary: Receive events from orchestrator
  message:
    oneOf:
      - $ref: '#/components/messages/GmIdentified'
      - $ref: '#/components/messages/DeviceConnected'
      # ... other messages
```

**New**:
```yaml
subscribe:
  summary: Receive events from orchestrator
  description: |
    Server-to-client events (outgoing from orchestrator perspective).
    All events use wrapped envelope pattern per Decision #2.

    After successful authentication, client receives sync:full automatically.
  message:
    oneOf:
      - $ref: '#/components/messages/DeviceConnected'
      # ... other messages (GmIdentified removed)
```

#### Change 2.6: Update AUTHENTICATION & CONNECTION Comment

**Location**: Line 77

**Current**:
```yaml
# AUTHENTICATION & CONNECTION (4 events)
```

**New**:
```yaml
# DEVICE TRACKING (2 events)
# Note: Authentication happens via Socket.io handshake middleware (not events)
```

#### Change 2.7: Update SyncFull Message Description

**Location**: Lines 302-321 (SyncFull message definition)

**Current** (lines 319-321):
```yaml
**When Sent**:
- On WebSocket connection (after gm:identified)
- After offline queue processing
- On explicit request (eliminated sync:request event)
```

**New**:
```yaml
**When Sent**:
- Automatically on successful WebSocket connection (immediately after handshake authentication)
- After offline queue processing completes
- After admin commands that affect multiple state components
- After session state changes requiring full resync

**Initial Connection Behavior**:
When a GM Scanner or Admin Panel successfully authenticates and connects,
server automatically sends sync:full as the FIRST event. No request needed.
This replaces the old gm:identified → sync:full pattern.
```

#### Change 2.8: Update DeviceConnected Message Description

**Location**: Lines 190-249 (DeviceConnected message definition)

**Current** (lines 193-196):
```yaml
summary: Broadcast when device connects
description: |
  Broadcast to all connected clients when new device connects.
```

**New**:
```yaml
summary: Broadcast when device connects
description: |
  Broadcast to all connected clients when new device successfully authenticates and connects.

  **Trigger**: After successful Socket.io handshake authentication:
  1. Server middleware validates JWT in handshake.auth
  2. Connection accepted
  3. Device info extracted from handshake.auth
  4. DeviceConnection model created
  5. Device registered in current session (if exists)
  6. THIS EVENT broadcast to all OTHER connected clients
  7. sync:full sent to the newly connected device

  **Important**: This event is NOT sent to the connecting device itself,
  only broadcast to existing connected clients for awareness.
```

**Also update** (line 199):

**Current**:
```yaml
**CRITICAL - Decision #8**:
Send single device object, NOT array.
Current scanner admin handler has bug expecting array (must fix scanner).
```

**New**:
```yaml
**CRITICAL - Decision #8**:
Send single device object, NOT array.
This event represents a SINGLE device connecting, not a list.
```

---

## Implementation Impact

### Backend Changes Required

1. **NEW FILE**: `src/websocket/middleware/auth.js`
   - Implement Socket.io middleware for handshake authentication
   - Validate JWT from handshake.auth.token
   - Attach device info to socket object
   - Reject connection if validation fails

2. **UPDATE**: `src/websocket/socketServer.js`
   - Register auth middleware: `io.use(authMiddleware)`
   - Move device registration logic to connection handler
   - Auto-send sync:full on connection
   - Remove gm:identify event listener

3. **DELETE**: `src/websocket/gmAuth.js`
   - Move JWT validation to auth middleware
   - Move device registration to connection handler
   - Delete handleGmIdentify function entirely

4. **UPDATE**: `src/websocket/listenerRegistry.js`
   - Remove gm:identify event registration

5. **UPDATE**: All test files
   - Use proper JWT auth in handshake
   - Remove gm:identify event emissions
   - Expect sync:full immediately after connection

### Client Changes Required

**GM Scanner (ALNScanner)**:
- ✅ Already implements handshake.auth correctly (orchestratorClient.js:97-102)
- ❌ Remove any lingering gm:identify emission code
- ✅ Already handles sync:full after connection
- **Action**: Verify no gm:identify code remains, test

**Admin Panel** (if separate):
- Similar to GM Scanner
- Ensure handshake.auth includes deviceType: 'admin'

**Player Scanner (aln-memory-scanner)**:
- ✅ No changes needed (HTTP-only, no WebSocket)

### Test Changes Required

**Unit Tests**:
- Test JWT middleware validation logic
- Test handshake rejection scenarios
- Test device registration on connection

**Contract Tests**:
- Remove auth-events.test.js tests for gm:identify/gm:identified
- Update all tests to use JWT in handshake.auth
- Expect sync:full as first event after connection
- Test connection rejection scenarios

**Integration Tests**:
- Update all WebSocket connection code
- Use real JWT auth flow
- Remove test mode bypasses

---

## Migration Strategy

### Phase 1: Contract Update (This Document)
1. Review and approve this specification
2. Update OpenAPI contract
3. Update AsyncAPI contract
4. Commit: "docs: Update contracts to Socket.io standard auth flow"

### Phase 2: Backend Implementation
1. Create auth middleware
2. Update socketServer.js
3. Delete gmAuth.js
4. Update tests to use new auth
5. Commit: "refactor: Implement Socket.io handshake auth, remove gm:identify"

### Phase 3: Remove Test Mode Bypasses
1. Remove all `process.env.NODE_ENV === 'test'` conditionals
2. Update tests to use real production code paths
3. Commit: "refactor: Remove test mode bypasses, use production auth in tests"

### Phase 4: Validation
1. Run full test suite
2. Test with real GM Scanner hardware
3. Verify no regressions
4. Document any breaking changes for deployments

---

## Breaking Changes

**For Clients**:
- ⚠️ Clients must now authenticate in handshake.auth (most already do)
- ⚠️ No more gm:identify event (remove if still emitting)
- ⚠️ No more gm:identified event (remove listeners)
- ✅ sync:full behavior unchanged (still first event after connection)

**For Server**:
- ⚠️ Connection will be rejected if JWT invalid (was previously accepted then failed on gm:identify)
- ✅ More secure: no window where unauthenticated client is connected
- ✅ Simpler code: authentication in one place (middleware)

**Deployment Notes**:
- Clients and server must be updated together (breaking change)
- Old clients will fail to connect to new server
- New clients will fail to connect to old server
- Plan coordinated deployment

---

## Questions for Review

1. Should we add rate limiting to POST /api/admin/auth to prevent brute force?
2. Should JWT token refresh be supported, or 24hr absolute expiry acceptable?
3. Should we log all failed connection attempts for security monitoring?
4. Should deviceId be validated against a whitelist, or any string accepted?
5. Should we support revoking specific tokens (logout feature)?

---

## Approval Checklist

- [ ] Flow diagrams reviewed and approved
- [ ] Handshake.auth structure approved
- [ ] OpenAPI changes approved
- [ ] AsyncAPI changes approved
- [ ] Breaking changes acknowledged
- [ ] Migration strategy approved
- [ ] Ready to implement

---

**Next Steps**: Review this specification, provide feedback, then proceed with contract file updates.
