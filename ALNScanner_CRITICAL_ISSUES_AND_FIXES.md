# ALNScanner Critical Issues & Fixes

## 📊 Current Implementation Status
**Last Updated**: Phase 2 Complete - Connection Wizard Working

### What's Working Now ✅
- Scanner works completely offline (Phase 0 complete)
- No more "undefined device" errors (Phase 1 complete)
- No race conditions on startup (Phase 6 complete)
- **Connection wizard with discovery** (Phase 2 complete)
- Network scanning finds servers automatically
- Unified login replaces browser prompt()
- Background reconnection with exponential backoff
- Offline mode toggle button functional

### What Still Needs Work ❌
1. **Deprecated code still present** - Old network panel, test functions, config.html
2. **Direct localStorage access** - No centralized ConnectionConfig class
3. **No visual status indicators** - Users can't see connection state or queue
4. **No token expiry checking** - JWTs never refresh after 24 hours

### Next Critical Step
**Phase 2.5: Clean Up Deprecated Code** - Remove old network configuration panel, test functions, and config.html page now that connection wizard handles everything.

## 🎯 Core Requirements
The ALNScanner MUST function as a standalone NFC scanning tool that:
1. Works completely offline without any network connection
2. Optionally connects to orchestrator when available
3. Seamlessly syncs data when connection is restored
4. Never blocks core functionality due to network issues
5. **NEW**: Enables non-technical volunteers to connect at live events via network discovery

## 🏟️ Live Event Context
**Primary Use Case**: Multiple GM stations at "About Last Night" live events
- **Environment**: Local WiFi network, no internet, dynamic IPs
- **Users**: Non-technical volunteers operating 3-5 GM stations
- **Challenge**: Need to connect multiple tablets to coordinator's laptop
- **Solution**: UDP discovery system on port 8888 for automatic server detection

### User Personas
1. **Event Volunteer** (Primary): Needs discovery, follows simple instructions
2. **Event Coordinator** (Secondary): Sets up server, knows IPs, manages stations
3. **Developer/Tester** (Tertiary): Local development, full technical knowledge

## 📋 Executive Summary

**Current State**: Scanner has fragmented connection UX spread across multiple pages and paths, making it difficult for volunteers at live events.

**Root Cause**:
- Discovery system hidden in separate config.html page
- Authentication split from configuration (2-step process)
- Three different connection paths with no clear primary
- Technical language ("orchestrator", "deviceId") confusing to volunteers

**Solution**: Unified "Connect to Game Server" wizard that:
- Prioritizes discovery for live events
- Combines URL discovery/entry + authentication in single modal
- Uses event-friendly language
- Works offline by default with clear online option
- Auto-syncs queued data when connected

**Critical Insight**: The UDP discovery system (port 8888) is NOT optional - it's the PRIMARY connection method for live events where volunteers need to connect tablets to a coordinator's laptop.

## 🔴 Critical Issues Identified

### 1. **Device Shows as "undefined" on Initial Connection**

**Root Cause**: Race condition between socket connection and GM identification
- Socket connects immediately with auth in handshake
- `gm:identify` event sent AFTER connection established
- Backend sees connected socket but no device info yet
- Window of time where device is "undefined"

**Evidence**:
```javascript
// Line 3661-3666: Connection happens first, THEN identification
this.socket.on('connect', () => {
    this.connectionStatus = 'connected';  // Connected but not identified!
    this.startIdentification();           // This happens AFTER connection
});
```

### 2. **Erratic Login Popup Behavior**

**Root Causes**:
1. **Dual DOMContentLoaded listeners** (lines 3503 and 4164) may race
2. **Browser `prompt()` used for password** - terrible UX:
   - Can be blocked by browser
   - Can't be styled
   - Appears at unpredictable times
   - No loading states

**Evidence**:
```javascript
// Line 4181: Blocking prompt that may not appear
const password = prompt('Enter game manager password to connect to orchestrator:');
```

### 3. **Authentication Flow Problems**

**Issues**:
- Token passed in both socket handshake AND gm:identify (redundant)
- No token expiry checking (24hr tokens never refresh)
- Auth endpoint mismatch: scanner uses `/api/admin/auth` but line 4188 shows different path
- No retry mechanism for failed auth

### 4. **Connection State Management**

**Issues**:
- Station ID defaults to 'GM_STATION_UNKNOWN' causing validation failures
- No proper offline mode indication
- Config page and main page don't share connection state
- localStorage keys inconsistent (`orchestrator_url` vs `orchestratorUrl`)

### 5. **Offline/Standalone Mode Failures**

**Critical Issues**:
1. **Forced Authentication on Network Failure**
   - If orchestrator URL exists but network is down, still prompts for password
   - No way to skip authentication and run offline
   - Blocks scanner functionality when orchestrator unreachable

2. **No Intentional Offline Mode**
   - Can't choose to work offline when orchestrator IS available
   - No "Work Offline" button on main screen
   - Must clear localStorage to force offline mode

3. **Poor Network Failure Handling**
   ```javascript
   // Line 4188: Tries to authenticate even if network is down
   const response = await fetch(`${orchestratorUrl}/api/admin/auth`, {...});
   // This will hang/timeout, then show alert blocking the UI
   ```

4. **No Background Connection Attempts**
   - Once offline, stays offline forever
   - No automatic reconnection when network restored
   - Must refresh page to retry connection

5. **Unclear Offline Status**
   - "Running in offline mode" only in console
   - No UI indication of offline vs connection failed
   - Users don't know if data will sync later

### 6. **Fragmented Connection UX for Live Events**

**Critical Issues**:
1. **Discovery Hidden**
   - UDP discovery on separate config.html page
   - Volunteers don't know to look there
   - Primary connection method is buried

2. **Three Confusing Paths**
   - Connection status badge → config.html → password prompt
   - Offline toggle → fails silently if not configured
   - Auto-connect → invisible to users

3. **Split Configuration**
   - URL configuration in config.html
   - Password prompt in index.html
   - Station ID in different place than password

4. **Technical Language**
   - "Orchestrator URL" meaningless to volunteers
   - "deviceId" instead of "Station Name"
   - No guidance for live event setup

## ✅ Comprehensive Fix Plan

### Phase 0: Enable True Offline-First Operation ✅ COMPLETE

**Status**: IMPLEMENTED in index.html
- ✅ tryOrchestratorConnection() function added (lines 4200-4238)
- ✅ Background reconnection with exponential backoff (lines 4241-4268)
- ✅ Offline mode toggle button added (line 1105)
- ✅ toggleOfflineMode() function implemented (line 4400+)

**Key Insight**: The scanner ALREADY works offline via DataManager (lines 1790-1834). The problem is the orchestrator connection code BLOCKS functionality.

**Implemented Changes**:

1. **Make Orchestrator Connection Non-Blocking** (Lines 4164-4272)
   ```javascript
   // CURRENT: Blocks with prompt
   if (!token) {
       const password = prompt('Enter password:'); // BLOCKS UI
   }

   // NEW: Non-blocking check
   async function tryOrchestratorConnection() {
       const orchestratorUrl = localStorage.getItem('orchestrator_url');
       if (!orchestratorUrl) return; // Silent return, no blocking

       // Check if orchestrator is reachable FIRST
       try {
           const healthCheck = await fetch(`${orchestratorUrl}/health`, {
               signal: AbortSignal.timeout(3000) // 3 second timeout
           });

           if (!healthCheck.ok) {
               console.log('Orchestrator unreachable, continuing offline');
               updateConnectionStatus('offline', 'Offline Mode');
               return;
           }
       } catch {
           console.log('Network unavailable, continuing offline');
           updateConnectionStatus('offline', 'Offline Mode');
           scheduleReconnectionAttempt(); // Try again in background
           return;
       }

       // Only NOW try authentication if needed
       let token = localStorage.getItem('gmToken');
       if (!token && localStorage.getItem('attemptOrchestratorAuth') !== 'false') {
           showAuthModal(); // Non-blocking modal
       } else if (token) {
           connectWithToken(token);
       }
   }
   ```

2. **Add Offline Mode Toggle** (Add to teamEntryScreen at line 1102)
   ```html
   <!-- Add after connection status indicator -->
   <button id="offlineModeToggle" class="mode-toggle" onclick="toggleOfflineMode()">
       <span class="mode-icon">🌐</span>
       <span class="mode-text">Go Offline</span>
   </button>
   ```

3. **Background Reconnection** (New function after line 4272)
   ```javascript
   let reconnectionTimer = null;
   let reconnectionDelay = 5000; // Start with 5 seconds

   function scheduleReconnectionAttempt() {
       if (reconnectionTimer) return; // Already scheduled

       reconnectionTimer = setTimeout(async () => {
           reconnectionTimer = null;

           // Only try if user hasn't explicitly chosen offline
           if (localStorage.getItem('preferOfflineMode') !== 'true') {
               await tryOrchestratorConnection();

               // If still offline, schedule next attempt with backoff
               if (!window.orchestratorClient?.isConnected) {
                   reconnectionDelay = Math.min(reconnectionDelay * 2, 300000); // Max 5 min
                   scheduleReconnectionAttempt();
               }
           }
       }, reconnectionDelay);
   }
   ```

### Phase 1: Fix Authentication & Connection Timing ✅ COMPLETE

**Status**: IMPLEMENTED in backend
- ✅ Pre-authentication from handshake (backend/src/server.js lines 39-65)
- ✅ Device info stored immediately on connection
- ✅ Broadcast structure fixed to flat format (gmAuth.js line 137, deviceTracking.js lines 28, 121)

**Implemented Changes**:
```javascript
// 1. Backend now reads auth from handshake immediately
createSocketConnection() {
    this.socket = io(this.config.url, {
        auth: {
            token: this.token,
            stationId: this.config.stationId,
            deviceType: 'gm',
            version: this.config.version
        }
    });
}

// 2. Backend: Read auth from handshake instead of waiting for gm:identify
io.on('connection', async (socket) => {
    const { token, stationId, deviceType, version } = socket.handshake.auth;

    if (!token) {
        socket.emit('error', { code: 'AUTH_REQUIRED' });
        socket.disconnect();
        return;
    }

    // Validate and store device info immediately
    socket.deviceId = stationId;
    socket.deviceType = deviceType;
    // Device is now defined from the start!
});
```

### Phase 2: Connection Wizard for Live Events ✅ COMPLETE

**Status**: IMPLEMENTED in index.html
- ✅ Modal HTML created (lines 1172-1212)
- ✅ Discovery integrated with scanForServers() (lines 4469-4547)
- ✅ Unified form handler with health check and auth (lines 4552-4625)
- ✅ workOffline() function for explicit offline choice (lines 4627-4639)
- ✅ showAuthModal() replaced to show wizard (lines 4740-4754)
- ✅ Connection status click opens wizard instead of config.html (line 1217)

### Phase 2.5: Clean Up Deprecated Elements 🧹 REQUIRED

**Elements to Remove** (now redundant with connection wizard):

1. **Settings Screen Network Panel** (lines 1266-1282)
   - Remove orchestratorUrl input field (line 1270)
   - Remove Test Connection button (lines 1274-1275)
   - Remove Network Discovery link to config.html (lines 1276-1277)
   - Remove connectionTestResult div (lines 1279-1281)

2. **Settings Module Orchestrator Logic** (lines 3180-3230)
   - Remove orchestratorUrl property (line 3183)
   - Remove orchestratorUrl loading/saving (lines 3191, 3225-3229)
   - Remove auto-detect logic (lines 3200-3205)

3. **App.testOrchestratorConnection()** (lines 3323-3354)
   - Remove entire function (obsolete with wizard)

4. **config.html File**
   - Can be deleted after verifying no other dependencies
   - All functionality now in connection wizard

5. **Direct localStorage Access** (multiple locations)
   - Replace all direct localStorage calls with ConnectionConfig class
   - Standardize keys to avoid duplicates

**Required Implementation**: Clean removal of deprecated code

```html
<!-- Add connection wizard modal to index.html before line 1014 -->
<div id="connectionModal" class="modal" style="display: none;">
    <div class="modal-content">
        <h2>🎮 Connect to Game Server</h2>

        <!-- Discovery Section (PRIMARY) -->
        <div id="discoverySection">
            <button id="scanServersBtn" class="primary-btn">
                🔍 Scan for Game Servers
            </button>
            <div id="discoveryStatus"></div>
            <div id="discoveredServers"></div>
        </div>

        <div class="divider">─── OR Enter Manually ───</div>

        <!-- Manual Configuration -->
        <form id="connectionForm">
            <div class="form-group">
                <label>Server Address:</label>
                <input type="text" id="serverUrl" placeholder="http://10.0.0.135:3000">
            </div>

            <div class="form-group">
                <label>Station Name:</label>
                <input type="text" id="stationName" placeholder="GM Station 1">
            </div>

            <div class="form-group">
                <label>GM Password:</label>
                <input type="password" id="gmPassword" placeholder="Enter password">
            </div>

            <div id="connectionStatus"></div>

            <div class="button-group">
                <button type="submit" class="primary-btn">Connect</button>
                <button type="button" onclick="workOffline()" class="secondary-btn">Work Without Server</button>
            </div>
        </form>
    </div>
</div>
```

```javascript
// Unified connection wizard replacing showAuthModal()
async function showConnectionWizard() {
    const modal = document.getElementById('connectionModal');
    modal.style.display = 'flex';

    // Auto-scan on open for better UX
    await scanForServers();
}

// Discovery function integrated into main page
async function scanForServers() {
    const statusDiv = document.getElementById('discoveryStatus');
    const serversDiv = document.getElementById('discoveredServers');

    statusDiv.textContent = '🔍 Scanning local network...';
    serversDiv.innerHTML = '';

    try {
        // Scan common local subnets for orchestrators
        const subnet = window.location.hostname.split('.').slice(0, 3).join('.');
        const scanPromises = [];

        for (let i = 1; i <= 254; i++) {
            const testUrl = `http://${subnet}.${i}:3000/status`;
            scanPromises.push(
                fetch(testUrl, { signal: AbortSignal.timeout(100) })
                    .then(r => r.ok ? { url: `http://${subnet}.${i}:3000`, ip: `${subnet}.${i}` } : null)
                    .catch(() => null)
            );
        }

        const results = (await Promise.all(scanPromises)).filter(Boolean);

        if (results.length > 0) {
            statusDiv.textContent = `✅ Found ${results.length} game server(s)`;
            results.forEach(server => {
                const serverEl = document.createElement('div');
                serverEl.className = 'server-item';
                serverEl.innerHTML = `
                    <span>🎮 Game Server at ${server.ip}</span>
                    <button onclick="selectServer('${server.url}')">Select</button>
                `;
                serversDiv.appendChild(serverEl);
            });
        } else {
            statusDiv.textContent = '❌ No servers found - enter address manually';
        }
    } catch (error) {
        statusDiv.textContent = '⚠️ Discovery failed - enter address manually';
    }
}

// Select discovered server
function selectServer(url) {
    document.getElementById('serverUrl').value = url;
    document.getElementById('discoveryStatus').textContent = '✅ Server selected';

    // Generate station name if empty
    if (!document.getElementById('stationName').value) {
        const stationNum = localStorage.getItem('lastStationNum') || '1';
        document.getElementById('stationName').value = `GM Station ${stationNum}`;
    }
}

// Unified connection handler
document.getElementById('connectionForm').onsubmit = async (e) => {
    e.preventDefault();

    const serverUrl = document.getElementById('serverUrl').value;
    const stationName = document.getElementById('stationName').value;
    const password = document.getElementById('gmPassword').value;
    const statusDiv = document.getElementById('connectionStatus');

    // Validate inputs
    if (!serverUrl || !stationName || !password) {
        statusDiv.textContent = '⚠️ Please fill in all fields';
        return;
    }

    statusDiv.textContent = '⏳ Connecting...';

    try {
        // 1. Test server reachability
        const healthCheck = await fetch(`${serverUrl}/health`, {
            signal: AbortSignal.timeout(3000)
        });

        if (!healthCheck.ok) {
            throw new Error('Server not responding');
        }

        // 2. Authenticate
        const authResponse = await fetch(`${serverUrl}/api/admin/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!authResponse.ok) {
            statusDiv.textContent = '❌ Invalid password';
            return;
        }

        const { token } = await authResponse.json();

        // 3. Save configuration
        localStorage.setItem('orchestrator_url', serverUrl);
        localStorage.setItem('stationId', stationName.replace(/\s+/g, '_'));
        localStorage.setItem('stationName', stationName);
        localStorage.setItem('gmToken', token);

        // 4. Connect with saved config
        statusDiv.textContent = '✅ Connected! Syncing data...';
        await connectWithToken(token);

        // 5. Close modal and update UI
        document.getElementById('connectionModal').style.display = 'none';
        updateConnectionStatus('connected', 'Connected to Server');

    } catch (error) {
        statusDiv.textContent = `❌ Connection failed: ${error.message}`;
    }
}

// Work offline option
function workOffline() {
    localStorage.setItem('preferOfflineMode', 'true');
    document.getElementById('connectionModal').style.display = 'none';
    updateConnectionStatus('disconnected', 'Working Offline');
}
```

### Phase 3: Fix Connection State Management ❌ NOT STARTED

**Status**: localStorage keys still inconsistent
- ❌ No ConnectionConfig class created
- ❌ Still using mixed snake_case and camelCase keys

**Required Implementation**:
```javascript
// 1. Single source of truth for connection config
class ConnectionConfig {
    static get orchestratorUrl() {
        return localStorage.getItem('orchestrator_url');
    }

    static set orchestratorUrl(url) {
        localStorage.setItem('orchestrator_url', url);
    }

    static get stationId() {
        return localStorage.getItem('stationId') || `GM_STATION_${Date.now()}`;
    }

    static set stationId(id) {
        localStorage.setItem('stationId', id);
    }
}

// 2. Single DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize app first
    await App.init();

    // Then check for orchestrator
    if (ConnectionConfig.orchestratorUrl) {
        await initializeOrchestrator();
    } else {
        showOfflineMode();
    }
});
```

### Phase 4: Improve UX Patterns ❌ NOT STARTED

**Status**: Basic improvements not implemented
- ❌ No token expiry checking
- ❌ No visual queue indicators

**Required Implementation**:
1. **Connection Status Indicator**
   - Always visible badge showing: 🟢 Connected | 🟡 Connecting | 🔴 Offline
   - Click to show connection details/retry

2. **Auto-reconnection with Backoff**
   ```javascript
   let reconnectDelay = 1000;

   socket.on('disconnect', () => {
       setTimeout(() => {
           reconnectDelay = Math.min(reconnectDelay * 2, 30000);
           attemptReconnect();
       }, reconnectDelay);
   });
   ```

3. **Token Refresh**
   ```javascript
   // Check token expiry on page load
   const tokenData = parseJWT(localStorage.getItem('gmToken'));
   if (tokenData.exp < Date.now() / 1000) {
       localStorage.removeItem('gmToken');
       await showLoginModal();
   }
   ```

4. **Offline Queue Persistence**
   - Save failed transactions to localStorage
   - Auto-retry when connection restored
   - Visual indicator of queued items

### Phase 5: Enhanced Offline Mode UI ❌ NOT STARTED

**Status**: No enhanced UI implemented
- ❌ No visual status states
- ❌ No queue count display
- ❌ No sync indicators

**Required Implementation**:
```javascript
const CONNECTION_STATES = {
    OFFLINE: { class: 'offline', text: 'Offline Mode', icon: '📴' },
    CONNECTING: { class: 'connecting', text: 'Connecting...', icon: '🔄' },
    CONNECTED: { class: 'connected', text: 'Connected', icon: '✅' },
    FAILED: { class: 'failed', text: 'Connection Failed', icon: '⚠️' },
    QUEUED: { class: 'queued', text: 'Syncing (X items)', icon: '📤' }
};

function updateConnectionStatus(state, queueCount = 0) {
    const indicator = document.getElementById('connectionStatus');
    const config = CONNECTION_STATES[state];

    // Clear all classes
    indicator.className = 'connection-status';
    indicator.classList.add(config.class);

    // Update text with queue count if offline
    let text = config.text;
    if (state === 'OFFLINE' && queueCount > 0) {
        text = `${config.text} (${queueCount} pending)`;
    } else if (state === 'QUEUED') {
        text = `Syncing (${queueCount} items)`;
    }

    indicator.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">${text}</span>
    `;
}
```

**Data Sync on Reconnection** (Integrate at line 3667):
```javascript
// In OrchestratorClient.setupSocketEventHandlers()
this.socket.on('connect', async () => {
    this.isConnected = true;

    // Start identification
    this.startIdentification();

    // Sync local transactions that occurred offline
    await this.syncOfflineData();

    // Update UI to show syncing
    updateConnectionStatus('QUEUED', this.offlineQueue.length);

    // Process queue
    await this.processOfflineQueue();

    // Show connected when done
    updateConnectionStatus('CONNECTED');
});

async syncOfflineData() {
    // Get transactions that haven't been synced
    const unsyncedTransactions = DataManager.transactions.filter(t => !t.synced);

    for (const transaction of unsyncedTransactions) {
        this.queueTransaction(transaction);
        transaction.synced = true; // Mark as queued for sync
    }

    // Save updated transaction state
    DataManager.saveTransactions();
}
```

## 🚀 Implementation Status & Remaining Work

### ✅ Completed Phases
1. **Phase 0**: Make orchestrator non-blocking - COMPLETE
   - Scanner now works even if orchestrator is down
   - Background reconnection with exponential backoff

2. **Phase 1**: Fix device undefined issue - COMPLETE
   - Device info sent in handshake
   - Broadcast structure fixed to flat format

3. **Phase 6**: Merge DOMContentLoaded handlers - COMPLETE
   - Single unified initialization
   - No more race conditions

### ❌ Remaining Implementation Priority

1. **CRITICAL**: Clean up deprecated elements (Phase 2.5) - 1 hour
   - Remove settings screen network panel
   - Remove testOrchestratorConnection function
   - Clean up Settings module orchestrator logic
   - Delete config.html file after verification

2. **HIGH**: Enhanced offline mode UI (Phase 5) - 2 hours
   - Visual connection status indicators
   - Queue count display
   - Sync progress indicators

3. **MEDIUM**: Connection state management (Phase 3) - 2 hours
   - Create ConnectionConfig class
   - Unify localStorage keys

4. **MEDIUM**: UX improvements (Phase 4) - 2 hours
   - JWT token expiry checking
   - Auto-reconnection improvements

### Phase 6: Merge DOMContentLoaded Handlers ✅ COMPLETE

**Status**: IMPLEMENTED in index.html
- ✅ Single unified handler at line 3522
- ✅ App.init() called first (offline capability)
- ✅ tryOrchestratorConnection() called with 100ms delay
- ✅ No more race conditions

**Implemented Solution**:
```javascript
// Replace BOTH handlers (3503 and 4164) with single handler
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Initialize core app (always works offline)
        await App.init();

        // 2. Try orchestrator connection (non-blocking)
        setTimeout(tryOrchestratorConnection, 100); // Small delay to let UI render

    } catch (error) {
        Debug.log(`Initialization error: ${error.message}`, true);
        // Don't block with alert, just log
        console.error('App initialization failed:', error);
    }
});
```

## Testing Checklist

### Offline Mode Testing
- [ ] Scanner works with no network at all
- [ ] Scanner works when orchestrator URL not configured
- [ ] Scanner works when orchestrator is down
- [ ] Can explicitly choose offline mode via toggle
- [ ] Transactions saved locally in offline mode
- [ ] Queue count shows in connection indicator

### Connection Testing
- [ ] Device never shows as undefined
- [ ] No blocking prompts on network failure
- [ ] Background reconnection attempts work
- [ ] Data syncs when connection restored
- [ ] Connection status accurately reflects state
- [ ] Auth modal appears only when needed

### Data Integrity
- [ ] Token persists across refreshes
- [ ] Transactions persist in localStorage
- [ ] Scores calculate correctly offline
- [ ] No data loss on connection failures
- [ ] Sync doesn't duplicate transactions

### UX Testing
- [ ] Connection status always visible
- [ ] Clear difference between offline/failed/connecting
- [ ] No blocking alerts or prompts
- [ ] Can switch modes without refresh
- [ ] Config page settings persist to main page
- [ ] Station ID generates properly (not UNKNOWN)