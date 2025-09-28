# Data Model Specification: ALN Video Playback System

**Feature**: ALN Video Playback & State Synchronization
**Version**: 1.1.0
**Date**: 2025-09-24
**Runtime**: Node.js 20+ with ES6 modules
**Dependencies**: Socket.io v4.6.0+, Express.js, PM2

## Overview
This document defines the data structures and relationships for the ALN orchestrator system that manages video playback, game state, and cross-device synchronization with support for offline resilience and connection state recovery.

## Core Entities

### 1. Token
Represents a memory element with potential video trigger capability.

```typescript
interface Token {
  id: string;                    // Unique identifier (e.g., "MEM_001")
  name: string;                   // Display name
  value: number;                  // Point value for scoring
  memoryType: 'visual' | 'audio' | 'mixed';
  groupId?: string;               // Optional group association
  mediaAssets: {
    image?: string;               // Image URL/path
    audio?: string;               // Audio URL/path  
    video?: string;               // Video URL/path for projector playback
  };
  metadata: {
    duration?: number;            // Video duration in seconds
    priority?: number;            // Playback priority if queued
  };
}
```

### 2. Transaction
Records each player scanning action in the game.

```typescript
interface Transaction {
  id: string;                     // UUID v4
  tokenId: string;                // Reference to Token.id
  teamId: string;                 // Team identifier (e.g., "TEAM_A")
  scannerId: string;              // Device that performed scan
  timestamp: string;              // ISO 8601 format
  sessionId: string;              // Reference to Session.id
  status: 'accepted' | 'rejected' | 'duplicate';
  rejectionReason?: string;       // If status is rejected
  points: number;                 // Points awarded (0 if rejected)
}
```

### 3. Session
Represents a complete game instance from start to finish.

```typescript
interface Session {
  id: string;                     // UUID v4
  name: string;                   // Session display name
  startTime: string;              // ISO 8601 format
  endTime?: string;               // ISO 8601 format when ended
  status: 'active' | 'paused' | 'completed' | 'archived';
  transactions: Transaction[];    // All transactions in session
  connectedDevices: DeviceConnection[];
  videoQueue: VideoQueueItem[];
  scores: TeamScore[];
  metadata: {
    gmStations: number;           // Number of GM stations connected
    playerDevices: number;        // Number of player devices connected
    totalScans: number;           // Running count of all scans
    uniqueTokensScanned: string[]; // Array of unique token IDs scanned
  };
}
```

### 4. GameState
Current authoritative state of the game, derived from session data.

```typescript
interface GameState {
  sessionId: string;              // Current session
  lastUpdate: string;             // ISO 8601 timestamp
  currentVideo?: {
    tokenId: string;
    startTime: string;
    expectedEndTime: string;
    requestedBy: string;          // Scanner device ID
  };
  scores: TeamScore[];
  recentTransactions: Transaction[]; // Last 10 transactions
  systemStatus: {
    orchestratorOnline: boolean;
    vlcConnected: boolean;
    videoDisplayReady: boolean;
  };
  processInfo?: {
    pm2InstanceId?: number;       // PM2 cluster instance ID
    memoryUsage: number;          // Memory usage in MB (critical for Pi)
    cpuUsage?: number;            // CPU percentage
    uptime: number;               // Process uptime in seconds
    restartCount: number;         // PM2 restart counter
    nodeVersion: string;          // Node.js version (should be 20+)
    platform: string;             // Platform (linux/darwin/win32)
    arch: string;                 // Architecture (arm/x64)
  };
}
```

### 5. VideoQueueItem
Manages video playback requests and state.

```typescript
interface VideoQueueItem {
  id: string;                     // UUID v4
  tokenId: string;                // Token with video asset
  requestedBy: string;            // Scanner device ID
  requestTime: string;            // ISO 8601 format
  status: 'pending' | 'playing' | 'completed' | 'failed';
  videoPath: string;              // Path to video file
  playbackStart?: string;         // When playback began
  playbackEnd?: string;           // When playback ended
  error?: string;                 // Error message if failed
}
```

### 6. DeviceConnection
Tracks connected scanner devices and GM stations with Socket.io v4 state recovery.

```typescript
interface DeviceConnection {
  id: string;                     // Device identifier
  type: 'player' | 'gm';         // Device type
  name?: string;                  // Optional friendly name
  connectionTime: string;         // ISO 8601 format
  lastHeartbeat: string;          // ISO 8601 format
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  ipAddress?: string;             // Device IP if available
  syncState: {
    lastSyncTime: string;         // Last successful sync
    pendingUpdates: number;       // Number of updates queued
    syncErrors: number;           // Count of sync failures
  };
  socketInfo?: {
    socketId: string;             // Socket.io socket ID
    recovered: boolean;           // v4.6.0+ state recovery status
    missedEvents?: number;        // Events missed during disconnect
    rooms: string[];              // Socket.io rooms membership
    transport: 'websocket' | 'polling'; // Current transport type
  };
  connectivityCheck: {
    lastPingTime: string;         // Last successful ping (ISO 8601)
    isReachable: boolean;         // Actual internet connectivity
    method: 'ping' | 'heartbeat' | 'navigator'; // Detection method used
    latency?: number;             // Round-trip time in ms
    packetLoss?: number;          // Percentage of lost packets
  };
}
```

### 7. TeamScore
Tracks scoring for each team in the session.

```typescript
interface TeamScore {
  teamId: string;                 // Team identifier
  currentScore: number;           // Total points
  tokensScanned: number;          // Number of tokens scanned
  bonusPoints: number;            // Bonus points from groups
  completedGroups: string[];      // Group IDs completed
  lastUpdate: string;             // ISO 8601 timestamp
}
```

### 8. AdminConfig
System configuration managed through admin panel.

```typescript
interface AdminConfig {
  vlcConfig: {
    host: string;                 // VLC HTTP interface host
    port: number;                 // VLC HTTP interface port (default 8080)
    password: string;             // VLC HTTP password (encrypted)
  };
  sessionConfig: {
    maxPlayers: number;           // Maximum player devices (10)
    maxGmStations: number;        // Maximum GM stations (5)
    duplicateWindow: number;      // Seconds for duplicate detection
    sessionTimeout: number;       // Minutes before auto-archive
  };
  networkConfig: {
    orchestratorPort: number;     // Server port
    corsOrigins: string[];        // Allowed CORS origins
    staticIps?: {                // Optional static IP mapping
      [deviceId: string]: string;
    };
  };
  discoveryConfig: {
    enableMdns: boolean;          // Use mDNS/Bonjour discovery
    mdnsServiceName: string;      // Service name (e.g., 'ALN Orchestrator')
    udpBroadcast: boolean;        // Enable UDP broadcast fallback
    broadcastPort: number;        // UDP broadcast port (default 5353)
    discoveryInterval: number;    // Seconds between discovery broadcasts
  };
  retryConfig: {
    minRetryDelay: number;        // Minimum retry delay in ms (default 1000)
    maxRetryDelay: number;        // Maximum retry delay in ms (default 30000)
    backoffFactor: number;        // Exponential backoff factor (default 2)
    maxAttempts: number;          // Maximum retry attempts (default 3)
  };
}
```

### 9. OfflineQueueItem
Manages offline operations with retry logic based on 2025 best practices.

```typescript
interface OfflineQueueItem {
  id: string;                    // UUID v4
  type: 'transaction' | 'state-update' | 'heartbeat';
  payload: any;                  // Original data payload
  timestamp: string;             // ISO 8601 creation time
  deviceId: string;              // Source device identifier
  retryCount: number;            // Current retry attempt
  maxRetries: number;            // Maximum retry attempts (default 3)
  nextRetryTime: string;         // ISO 8601 next retry time (exponential backoff)
  status: 'pending' | 'processing' | 'failed' | 'expired';
  error?: string;                // Last error message if failed
  ackTimestamp?: string;         // Multi-tab coordination timestamp
  priority: number;              // Queue priority (higher = more important)
}
```

## State Transitions

### Transaction States
```
created → accepted → logged
     ↓
   rejected (duplicate/video playing/error)
```

### Video Queue States
```
pending → playing → completed
     ↓        ↓
   failed   failed
```

### Session States
```
active → paused → active
   ↓        ↓
completed → archived
```

### Device Connection States
```
connected → disconnected → reconnecting → connected
                ↓
             disconnected (timeout)
```

### Offline Queue States
```
pending → processing → failed
     ↓         ↓          ↓
   expired  expired    expired
```

## Validation Rules

### Token Validation
- `id` must be unique across all tokens
- `value` must be >= 0
- If `mediaAssets.video` exists, `metadata.duration` should be provided
- `memoryType` must be one of defined values

### Transaction Validation
- `timestamp` must be valid ISO 8601
- `tokenId` must reference existing token
- `teamId` must match pattern /^TEAM_[A-Z]$/
- Cannot create duplicate transaction (same token + session)

### Session Validation
- `startTime` must be before `endTime` (if ended)
- `status` transitions must follow state diagram
- Active sessions cannot exceed `maxPlayers` and `maxGmStations`

### VideoQueue Validation
- Only one item can have status 'playing' at a time
- `videoPath` must point to existing file
- `requestTime` must be within current session timeframe

### OfflineQueueItem Validation
- `retryCount` must not exceed `maxRetries`
- `nextRetryTime` must use exponential backoff calculation
- `priority` must be >= 0
- `ackTimestamp` required for multi-tab scenarios
- Items marked 'expired' after maxRetries reached

### DeviceConnection Validation
- `socketInfo.recovered` only valid for Socket.io v4.6.0+
- `connectivityCheck.method` must be valid detection type
- `latency` must be positive if present
- `packetLoss` must be 0-100 if present

### AdminConfig Validation
- `discoveryConfig.broadcastPort` default 5353
- `retryConfig.minRetryDelay` < `maxRetryDelay`
- `retryConfig.backoffFactor` must be > 1
- `corsOrigins` must include scanner URLs

## Relationships

```
Session 1 ←→ * Transaction
Session 1 ←→ * DeviceConnection
Session 1 ←→ * VideoQueueItem
Session 1 ←→ * TeamScore

Transaction * → 1 Token
VideoQueueItem * → 1 Token

DeviceConnection 1 ←→ * OfflineQueueItem
OfflineQueueItem * → 1 DeviceConnection

GameState 1 → 1 Session (current)
AdminConfig 1 → * Session (configuration applied)
```

## Indexing Strategy

For JSON file storage, maintain these indices in memory:
- Token by ID (primary key)
- Transactions by sessionId + timestamp (compound)
- Active video queue items by status
- Device connections by type and status
- Unique tokens scanned per session (Set)
- OfflineQueueItems by deviceId + priority (compound)
- Socket connections by socketId (for recovery)
- Pending retries by nextRetryTime (sorted)

## Data Persistence

### Write Patterns
- Transactions: Append-only log
- Session: Update on state change
- GameState: Update on any change (throttled)
- VideoQueue: Update on status change
- OfflineQueue: Batch writes for efficiency
- DeviceConnection: Update on Socket.io events
- ProcessInfo: Update every 30 seconds (PM2 metrics)

### Backup Strategy
- Session snapshot every 100 transactions
- Full backup on session completion
- Archive completed sessions after 24 hours

## Performance Considerations

### Memory Limits
- Keep only current session in memory
- Archive completed sessions to disk
- Limit transaction history to 1000 recent

### Query Optimization
- Cache calculated scores (update on transaction)
- Maintain running totals vs recalculation
- Index frequently accessed fields in memory

## Migration Path

For future enhancements:
1. Token data remains in ALN-TokenData submodule
2. Session data exportable as JSON for analytics
3. Transaction log format supports event sourcing
4. Schema versioning in all persisted files