# ESP32 Player Scanner (arduino-cyd-player-scanner) Connection Analysis

## Executive Summary

The ESP32 scanner implements a robust, dual-core connection architecture with intelligent fallback mechanisms. It uses WiFiClientSecure for HTTPS support, maintains an offline queue on SD card, and runs a background sync task on Core 0 while the main RFID processing loop runs on Core 1.

---

## 1. ORCHESTRATOR DISCOVERY & CONFIGURATION

### Configuration Source: SD Card (config.txt)

**File Location:** `/config.txt` on SD card
**Load Timing:** During `Application::setup()` → `ConfigService::loadFromSD()`

**Configuration Fields:**
```ini
# REQUIRED (validation enforced)
WIFI_SSID=NetworkName
WIFI_PASSWORD=password
ORCHESTRATOR_URL=http://10.0.0.177:3000    # or https://
TEAM_ID=001                                  # Exactly 3 digits

# OPTIONAL (with smart defaults)
DEVICE_ID=SCANNER_FLOOR1_001               # Auto-generated from MAC if omitted
SYNC_TOKENS=true                            # Download tokens.json on boot
DEBUG_MODE=false                            # Defer RFID init for serial commands
```

### No Discovery Service (Unlike Web Scanners)

**IMPORTANT DIFFERENCE FROM WEB SCANNERS:**
- Web scanners use UDP discovery (`/health?deviceId=X`) to find orchestrator
- **ESP32 scanner: Static configuration ONLY** - must manually set ORCHESTRATOR_URL
- No auto-discovery mechanism
- URL can use `http://` or `https://` (auto-upgraded to `https://` for backward compatibility)

**Validation (ConfigService::loadFromSD, line 195):**
```cpp
// Model validation in Config.h lines 39-52
if (orchestratorURL.length() == 0) {
    return false;  // REQUIRED
}

// Accept both http:// and https://
if (!orchestratorURL.startsWith("http://") && !orchestratorURL.startsWith("https://")) {
    return false;
}

// Auto-upgrade for backward compatibility
if (orchestratorURL.startsWith("http://")) {
    orchestratorURL.replace("http://", "https://");
    Serial.println("[CONFIG] Auto-upgraded URL: http:// -> https://");
}
```

**Runtime Editing Support:**
```cpp
// Via serial commands in DEBUG_MODE:
SET_CONFIG:ORCHESTRATOR_URL=https://192.168.1.100:3000
SAVE_CONFIG
REBOOT
```

---

## 2. HTTP CLIENT SETUP: WiFiClient vs WiFiClientSecure

### Architecture: Consolidated HTTPHelper Class

**Key Design (OrchestratorService.h, lines 649-729):**

```cpp
class HTTPHelper {
private:
    WiFiClientSecure _secureClient;  // Single reusable secure client
    
    void configureClient(HTTPClient& client, const String& url, uint32_t timeoutMs) {
        if (url.startsWith("https://")) {
            client.begin(_secureClient, url);  // Use secure client for HTTPS
        } else {
            client.begin(url);                 // Use default client for HTTP
        }
        client.setTimeout(timeoutMs);          // Per-request timeout
    }
};
```

### HTTPS Certificate Handling

**Certificate Validation: DISABLED**
```cpp
HTTPHelper() {
    _secureClient.setInsecure();  // Skip certificate verification
}
```

**Rationale (from comments):**
- Acceptable for local network deployments
- Orchestrator on same network, not internet-exposed
- Self-signed certificates used on orchestrator (expected with `ENABLE_HTTPS=true`)
- Required for Web NFC API which mandates HTTPS even on localhost

**Flash Savings Architecture:**
- **Problem in v4.1:** HTTP client setup duplicated in 4 places (sendScan, uploadQueueBatch, syncTokenDatabase, checkHealth)
- **Solution in v5.0:** Consolidated HTTPHelper class saves ~15KB flash
- Each method now delegates to `httpGET()` or `httpPOST()`

### HTTP Timeout Configuration

**Per-Request Timeouts (configurable):**
```cpp
// Scan submission (single entry)
String url = config.orchestratorURL + "/api/scan";
auto resp = httpWithRetry([&]() {
    return _http.httpPOST(url, requestBody, 10000);  // 10s timeout
}, "scan submission");

// Batch upload (multiple entries)
String url = config.orchestratorURL + "/api/scan/batch";
auto resp = httpWithRetry([&]() {
    return _http.httpPOST(url, requestBody, 30000);  // 30s timeout
}, "batch upload");

// Health check
auto resp = httpWithRetry([&]() {
    return _http.httpGET(url, 5000);  // 5s timeout
}, "health check");
```

---

## 3. CONNECTION LIFECYCLE: When & How Often It Connects

### Initialization Phase (Application::setup)

**Sequence:**
1. **WiFi Initialization** (OrchestratorService::initializeWiFi, line 61)
   - Registers WiFi event handlers
   - Calls `WiFi.begin()` with credentials
   - Waits up to 10 seconds for connection (timing::WIFI_CONNECT_TIMEOUT_MS)
   - Updates state: `ORCH_DISCONNECTED` → `ORCH_WIFI_CONNECTED`

2. **Orchestrator Health Check** (OrchestratorService::checkHealth, line 327)
   - Sends GET request to `/health?deviceId=DEVICE_ID`
   - If 200 OK: State → `ORCH_CONNECTED`
   - If timeout/error: Stays at `ORCH_WIFI_CONNECTED`

3. **Token Sync (optional)** (if SYNC_TOKENS=true)
   - GET `/api/tokens`
   - Caches to SD card as `/tokens.json`

**Connection State Machine:**
```
┌─────────────────┐
│  DISCONNECTED   │  WiFi down, orchestrator unreachable
└────────┬────────┘
         │ WiFi.begin() succeeds
         ▼
┌─────────────────────────┐
│  WIFI_CONNECTED         │  WiFi up, orchestrator unknown/down
└────────┬────────────────┘
         │ GET /health → 200 OK
         ▼
┌─────────────────────────┐
│  CONNECTED              │  WiFi up, orchestrator reachable
└─────────────────────────┘
```

### Scanning Phase: Per-Scan Connection Behavior

**Connection Check (Application::processRFIDScan, lines 518-532):**
```cpp
auto connState = orchestrator.getState();

if (connState == models::ORCH_CONNECTED) {
    // Attempt immediate send
    if (!orchestrator.sendScan(scan, config.getConfig())) {
        // Send failed - queue for later
        orchestrator.queueScan(scan);
    }
} else {
    // Offline or WiFi-only - queue immediately
    orchestrator.queueScan(scan);
}
```

**Key Behavior:**
- **NO persistent connection per scan** - Each scan attempt opens a new HTTP connection
- If connected: 1 POST request per scan
- If offline: 1 SD card write per scan
- Connection state checked from cache (atomic variable), not by probing

### Background Task Phase: Periodic Keep-Alive & Queue Sync

**Every 10 seconds (timing::ORCHESTRATOR_CHECK_INTERVAL_MS):**

**Background Task Loop (OrchestratorService::backgroundTaskLoop, lines 986-1040):**
```cpp
while (true) {
    if (now - lastCheck > 10000) {  // Every 10 seconds
        lastCheck = now;
        
        // 1. Check orchestrator health
        if (checkHealth(_config)) {
            if (state != ORCH_CONNECTED) {
                _connState.set(ORCH_CONNECTED);  // Reconnected!
            }
            
            // 2. If connected and queue has entries
            int queueSize = getQueueSize();
            if (queueSize > 0) {
                uploadQueueBatch(_config);  // Upload up to 10 entries
            }
        } else {
            if (state == ORCH_CONNECTED) {
                _connState.set(ORCH_WIFI_CONNECTED);  // Lost orchestrator
            }
        }
    }
    
    vTaskDelay(100 / portTICK_PERIOD_MS);  // Non-blocking delay
}
```

**Retry Schedule on Health Check Failure:**
```cpp
// From httpWithRetry() lines 752-785
const int BACKOFF_DELAYS[] = {1000, 2000, 4000, 8000, 16000, 30000};

// Retry logic:
// - On success (2xx) or semantic error (404/409): Return immediately
// - On connection failure (< 0) or 5xx: Retry with exponential backoff
// - Max 6 attempts, max 61 seconds total wait
```

---

## 4. TOKEN DOWNLOAD & CACHING

### Initial Token Sync (Boot-Time)

**Condition:** `SYNC_TOKENS=true` in config.txt

**Flow (TokenService::syncFromOrchestrator):**
1. GET `{ORCHESTRATOR_URL}/api/tokens`
2. Parse JSON response
3. Cache to SD card: `/tokens.json`
4. Load into memory: std::vector<TokenMetadata> (max 50 tokens)

**Fallback if Offline at Boot:**
- If sync fails: Load from cached `/tokens.json` on SD
- If no cached file: Device can still operate with UID-based fallback paths

**Memory-Safe Design (avoiding OOM):**
```cpp
// Max 50 tokens in memory (50KB limit from config.h)
constexpr int MAX_TOKENS = 50;
constexpr int MAX_TOKEN_DB_SIZE = 50000; // 50KB
```

### Runtime Token Lookup

**Per-Scan Lookup (Application::processRFIDScan, lines 535-559):**
```cpp
auto& tokens = services::TokenService::getInstance();
const models::TokenMetadata* token = tokens.get(tokenId);

if (token) {
    // Known token - check video flag
    if (token->isVideoToken()) {
        _ui->showProcessing(*token);  // Video modal (2.5s auto-dismiss)
    } else {
        _ui->showToken(*token);  // Regular token (double-tap dismiss)
    }
} else {
    // Unknown token - use UID-based fallback
    // Fallback paths: /images/{tokenId}.bmp, /audio/{tokenId}.wav
    _ui->showToken(fallback);
}
```

**Video Token Distinction:**
```cpp
// From Token.h model
struct TokenMetadata {
    String tokenId;          // "kaa001"
    String video;            // "kaa001.mp4" if video, "" if regular
    String image;            // "images/kaa001.bmp"
    String audio;            // "audio/kaa001.wav"
};

bool isVideoToken() const {
    return video.length() > 0;
}
```

**Image File Caching:**
- Images stored on SD card: `/images/{tokenId}.bmp` (24-bit, 240x320)
- Audio files on SD card: `/audio/{tokenId}.wav`
- Downloaded by TokenService during token sync or on-demand
- **No online cache validation** - Uses whatever is on SD card

---

## 5. SCAN SUBMISSION: HTTP POST LOGIC & ERROR HANDLING

### Scan Submission Flow

**Immediate Send (if ORCH_CONNECTED):**

```cpp
bool OrchestratorService::sendScan(const models::ScanData& scan, 
                                   const models::DeviceConfig& config) {
    // 1. Build JSON payload
    JsonDocument doc;
    doc["tokenId"] = scan.tokenId;
    if (scan.teamId.length() > 0) doc["teamId"] = scan.teamId;
    doc["deviceId"] = scan.deviceId;
    doc["timestamp"] = scan.timestamp;
    
    String requestBody;
    serializeJson(doc, requestBody);
    
    // 2. Send with retry (exponential backoff)
    String url = config.orchestratorURL + "/api/scan";
    auto resp = httpWithRetry([&]() {
        return _http.httpPOST(url, requestBody, 10000);
    }, "scan submission");
    
    // 3. Handle response
    bool success = resp.success || (resp.code == 409);  // Accept 409 (duplicate)
    return success;
}
```

**Payload Example:**
```json
{
  "tokenId": "kaa001",
  "teamId": "001",
  "deviceId": "SCANNER_FLOOR1_001",
  "timestamp": "1970-01-01T00:15:32.847Z"
}
```

### Error Handling: Retry Mechanism

**For Single Scans:**
```cpp
// From httpWithRetry() - applies to all HTTP operations
// Max 6 attempts with exponential backoff:
const int BACKOFF_DELAYS[] = {1000, 2000, 4000, 8000, 16000, 30000};

// Retry on:
// - Connection failure (code < 0)
// - 5xx server errors
// - Timeouts

// Do NOT retry on:
// - 2xx success
// - 404 Not Found (semantic error)
// - 409 Conflict (scan already received - acceptable)
```

**Queue Fallback:**
```cpp
// If send fails after all retries:
if (!orchestrator.sendScan(scan, config.getConfig())) {
    orchestrator.queueScan(scan);  // Queue to SD card for later
}
```

### Batch Upload

**Background Task Triggers Upload (every 10 seconds if queue has entries):**

```cpp
bool OrchestratorService::uploadQueueBatch(const models::DeviceConfig& config) {
    // 1. Read up to 10 entries from queue
    std::vector<models::ScanData> batch;
    readQueue(batch, queue_config::BATCH_UPLOAD_SIZE);  // Max 10
    
    // 2. Build batch JSON
    JsonDocument doc;
    JsonArray transactions = doc["transactions"].to<JsonArray>();
    for (const auto& entry : batch) {
        JsonObject obj = transactions.add<JsonObject>();
        obj["tokenId"] = entry.tokenId;
        obj["deviceId"] = entry.deviceId;
        obj["timestamp"] = entry.timestamp;
    }
    
    // 3. Send batch with 30s timeout (longer than single scans)
    String url = config.orchestratorURL + "/api/scan/batch";
    auto resp = httpWithRetry([&]() {
        return _http.httpPOST(url, requestBody, 30000);
    }, "batch upload");
    
    // 4. On 200 OK: Remove uploaded entries (stream-based!)
    if (resp.code == 200) {
        removeUploadedEntries(batch.size());
        
        // 5. Recursive: If more entries remain, upload next batch
        if (getQueueSize() > 0) {
            delay(1000);
            return uploadQueueBatch(config);  // Recursive!
        }
    }
}
```

**Batch Payload Example:**
```json
{
  "transactions": [
    {"tokenId": "kaa001", "deviceId": "SCANNER_001", "timestamp": "..."},
    {"tokenId": "kaa002", "deviceId": "SCANNER_001", "timestamp": "..."},
    ...
  ]
}
```

---

## 6. CONNECTION MONITORING: Health Check & Reconnection

### Health Check Implementation

**Manual Trigger (from diagnostic commands):**
```cpp
// From SerialService - on STATUS command
bool isConnected = orchestrator.checkHealth(config.getConfig());
```

**Automatic Check (Background Task):**
```cpp
// Every 10 seconds (line 1002)
if (now - lastCheck > 10000) {
    if (checkHealth(_config)) {
        // Orchestrator is reachable
        _connState.set(models::ORCH_CONNECTED);
    } else {
        // Lost orchestrator
        _connState.set(models::ORCH_WIFI_CONNECTED);
    }
}
```

**Health Check Endpoint:**
```cpp
bool OrchestratorService::checkHealth(const models::DeviceConfig& config) {
    // GET /health?deviceId=SCANNER_001
    String url = config.orchestratorURL + "/health?deviceId=" + config.deviceID;
    auto resp = httpWithRetry([&]() {
        return _http.httpGET(url, 5000);
    }, "health check");
    
    return (resp.code == 200);
}
```

### WiFi Reconnection (Automatic)

**WiFi Event Handlers (OrchestratorService::, lines 1051-1089):**
```cpp
static void onWiFiDisconnected(WiFiEvent_t event, WiFiEventInfo_t info) {
    LOG_INFO("[ORCH-WIFI] Disconnected from AP\n");
    auto& instance = getInstance();
    instance._connState.set(models::ORCH_DISCONNECTED);
    // WiFi library handles auto-reconnect, don't call WiFi.reconnect()
}
```

**WiFi Library Auto-Reconnect:**
- Built into ESP32 Arduino WiFi library
- Automatic exponential backoff
- No manual intervention needed

**State Transitions:**
```
CONNECTED → [WiFi drops] → WIFI_CONNECTED → [WiFi recovers] → [health check passes] → CONNECTED
                         → [no WiFi after 60s] → DISCONNECTED
```

---

## 7. ISSUES FOUND

### 1. ⚠️ **No Persistent Connection Pooling**

**Issue:** Each scan creates a new HTTP connection
```cpp
// Per scan: New HTTPClient() → begin() → POST() → end()
// This is inefficient for high-frequency scanning
```

**Impact:**
- Latency: ~500-800ms per scan (connection overhead)
- If scanning 1 token every 3 seconds: 20% of time spent on connection setup

**Comparison to Web Scanners:**
- Web scanners use persistent Socket.io connection (single connection per client)
- ESP32 does new connection per request (much higher overhead)

**Workaround:** Batch uploads help (10 entries per connection), but single scans are slow

**Recommendation:** Consider connection pooling if scanning frequency > 1/5s

---

### 2. ⚠️ **Race Condition in Background Task**

**Issue:** Background task accesses config without synchronization

```cpp
// From backgroundTaskLoop (line 1026)
uploadQueueBatch(_config);  // _config copied in startBackgroundTask()
```

**Problem:**
- Main loop can call `SET_CONFIG:KEY=VALUE` via serial (updates _config)
- Background task reads stale _config copy
- Device ID or URL change won't apply until reboot

**Current Mitigation:** _config is copied at task start (line 142)
```cpp
void startBackgroundTask(const models::DeviceConfig& config) {
    _config = config;  // Copy at task creation
}
```

**Better Solution:** Pass config by reference via shared_ptr or accessor method

---

### 3. ⚠️ **Queue Corruption Recovery Only at Boot**

**Issue:** Queue file corruption detected only during initialization

```cpp
// initializeQueue() - lines 348-411
if (fileSize > queue_config::MAX_QUEUE_FILE_SIZE) {  // 100KB threshold
    SD.remove(queue_config::QUEUE_FILE);  // Delete corrupted file
}
```

**Scenario Leading to Corruption:**
1. Power loss during queue write
2. File pointer left in inconsistent state
3. Next write appends to corrupted file
4. File grows to 102KB+ on next boot
5. **Queue is deleted, scans lost**

**Current Protection:**
- Corruption threshold: 102KB (from 50-100 normal scans)
- Automatic deletion on boot
- **Problem:** Already-queued scans are lost silently

**Better Solution:** 
- Use atomic file writes (write to temp, then rename)
- Or use database format (SQLite) instead of JSONL

---

### 4. ⚠️ **Certificate Validation Disabled Permanently**

**Issue:** `setInsecure()` disables all certificate checks

```cpp
// HTTPHelper constructor (line 654)
_secureClient.setInsecure();  // No validation at all
```

**Security Implications:**
- Vulnerable to MITM attacks on untrusted networks
- Dev/prod parity issue: Device works on WiFi network but would fail on cellular/VPN

**Comparison to Orchestrator:**
- Orchestrator accepts self-signed certs with browser warning (one-time trust)
- ESP32 blindly accepts ANY certificate (including forged ones)

**Recommendation:**
- For production: Use certificate pinning (pin orchestrator's public key)
- Or: Accept orchestrator's cert hash and validate against it

---

### 5. ⚠️ **No Connection Timeout on Initial WiFi**

**Issue:** Initial WiFi timeout is very long

```cpp
// initializeWiFi() (line 84)
unsigned long startTime = millis();
while (WiFi.status() != WL_CONNECTED &&
       millis() - startTime < timing::WIFI_CONNECT_TIMEOUT_MS) {  // 10 seconds!
    delay(500);
}
```

**Problem:**
- If WiFi SSID exists but password is wrong: Waits full 10 seconds
- User sees black screen for 10s before moving on
- Bad user experience

**Better Approach:**
- WiFi library provides connection status callbacks
- Fail fast on AUTH_FAIL instead of waiting

---

### 6. ⚠️ **Thread Safety: Queue Size Cache**

**Current Implementation (lines 310-313):**
```cpp
int OrchestratorService::getQueueSize() const {
    portENTER_CRITICAL(&_queue.mutex);
    int size = _queue.size;
    portEXIT_CRITICAL(&_queue.mutex);
    return size;
}
```

**This is Correct** but:
- Queue size is cached in RAM, not synchronized with SD file
- If device crashes after queueScan() but before updateQueueSize():
  - RAM cache: 10 entries
  - SD file: 11 entries
  - Size mismatch on next boot (countQueueEntries reads actual file)

**Not a critical bug** (corrected on boot), but something to be aware of

---

### 7. ✅ **Good: Stream-Based Queue Removal**

**No issue here** - excellent implementation:

```cpp
// removeUploadedEntries() (lines 862-944)
// - Reads from queue.jsonl line-by-line
// - Writes to queue.tmp only lines to keep
// - Atomic rename: queue.tmp → queue.jsonl
// - Peak memory: ~100 bytes (String buffer) not 10KB
```

This is memory-safe and efficient. ✅

---

## 8. COMPARISON WITH WEB SCANNER PATTERNS

### Connection Architecture

| Aspect | ESP32 Scanner | Web Scanner (JS) |
|--------|--------------|------------------|
| **Transport** | WiFi (UDP) | HTTP/HTTPS or WebSocket |
| **Connection Type** | Per-request HTTP | Persistent Socket.io |
| **Discovery** | Static config (manual) | UDP broadcast discovery |
| **Timeout Handling** | Per-request timeout (5-30s) | Connection timeout (25s), then 60s idle before drop |
| **Reconnection** | Background task every 10s | Built-in Socket.io auto-reconnect |
| **Certificate Validation** | Disabled (setInsecure) | Browser handles (HTTPS required) |

### Offline Handling

| Aspect | ESP32 Scanner | Web Scanner |
|--------|--------------|------------|
| **Queue Type** | JSONL on SD card | IndexedDB in browser |
| **Queue Persistence** | Survives power loss | Survives browser close only |
| **Queue Size** | Max 100 entries (100KB) | Max ~50MB (browser quota) |
| **Upload Mechanism** | Background task, batch-based | Periodic sync on connection restore |
| **Rate Limiting** | Exponential backoff retries | Manual retry UI |

### Health Monitoring

| Aspect | ESP32 Scanner | Web Scanner |
|--------|--------------|------------|
| **Health Check** | GET /health every 10s | WebSocket ping/pong every 25s |
| **Health Check Trigger** | Automatic background task | Built-in Socket.io |
| **Failure Detection** | 5s timeout on health check | 60s idle timeout |
| **Recovery Latency** | ~10s (next health check) | < 1s (immediate reconnect) |

---

## 9. SUMMARY: Key Takeaways

### Strengths ✅
1. **Robust offline handling** - Queue on SD card survives power loss
2. **Memory-efficient** - Stream-based queue operations
3. **HTTPS support** - Can work with secure orchestrator
4. **Dual-core architecture** - Non-blocking background sync task
5. **Smart fallback** - UID-based token paths when database missing
6. **Comprehensive error handling** - Retry with exponential backoff

### Weaknesses ⚠️
1. **No persistent connections** - High latency per scan (connection overhead)
2. **Manual configuration** - No auto-discovery, requires hardcoded URL
3. **Certificate validation disabled** - MITM vulnerability on untrusted networks
4. **Background task config coupling** - Runtime config changes won't apply
5. **Long WiFi timeout** - Black screen for 10 seconds on auth failure
6. **Queue corruption recovery** - Silently drops scans if file corrupted

### Comparison to Web Scanners
- **Web:** Persistent connection, auto-discovery, better UX responsiveness
- **ESP32:** Offline resilience, production-hardened queue, power-loss safe

### Connection Stability Profile
- **Good for:** Periodic scanning (< 1/second), stable WiFi networks, production deployments
- **Not ideal for:** High-frequency scanning (> 3/second), unreliable networks, certificate pinning required

