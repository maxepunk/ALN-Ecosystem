# ESP32 UDP Discovery Implementation Plan

**Status:** Planned (not yet implemented)
**Priority:** Low - Nice-to-have enhancement
**Estimated Effort:** 2-3 hours
**Dependencies:** None (uses existing backend UDP discovery service)

## Problem Statement

ESP32 hardware scanners currently require a hardcoded `ORCHESTRATOR_URL` in the SD card config file. If the orchestrator's IP address changes, all ESP32 scanners need manual config updates.

## Solution

Leverage the existing backend UDP discovery service (port 8888) to auto-discover the orchestrator at boot time. Discovery is the primary method; config file URL is the fallback.

### Backend Service (Already Exists)

Location: `backend/src/services/discoveryService.js`

The orchestrator already listens on UDP port 8888 and responds to `ALN_DISCOVER` messages with:

```json
{
  "service": "ALN_ORCHESTRATOR",
  "version": "1.0.0",
  "port": 3000,
  "protocol": "https",
  "addresses": ["10.0.0.177", "192.168.1.100"],
  "timestamp": "2025-12-05T10:30:00.000Z"
}
```

### ESP32 Implementation

#### 1. Create Discovery Module

**File:** `ALNScanner_v5/services/DiscoveryService.h`

```cpp
#pragma once

#include <WiFiUdp.h>
#include <ArduinoJson.h>

namespace services {

struct DiscoveryResult {
    bool found;
    String protocol;
    String address;
    int port;
    String version;

    String getUrl() const {
        if (!found) return "";
        return protocol + "://" + address + ":" + String(port);
    }
};

class DiscoveryService {
public:
    static DiscoveryService& getInstance() {
        static DiscoveryService instance;
        return instance;
    }

    /**
     * Discover orchestrator via UDP broadcast
     * @param timeoutMs Maximum time to wait for response (default 3000ms)
     * @param retries Number of broadcast attempts (default 3)
     * @return DiscoveryResult with orchestrator details or found=false
     */
    DiscoveryResult discover(unsigned long timeoutMs = 3000, int retries = 3) {
        DiscoveryResult result = {false, "", "", 0, ""};

        WiFiUDP udp;
        if (!udp.begin(0)) {  // Random local port
            Serial.println("[DISCOVERY] Failed to start UDP");
            return result;
        }

        for (int attempt = 1; attempt <= retries; attempt++) {
            Serial.printf("[DISCOVERY] Broadcast attempt %d/%d\n", attempt, retries);

            // Send discovery broadcast
            udp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
            udp.print("ALN_DISCOVER");
            udp.endPacket();

            // Wait for response
            unsigned long start = millis();
            while (millis() - start < timeoutMs) {
                int packetSize = udp.parsePacket();
                if (packetSize > 0) {
                    char buffer[512];
                    int len = udp.read(buffer, sizeof(buffer) - 1);
                    buffer[len] = '\0';

                    // Parse JSON response
                    StaticJsonDocument<512> doc;
                    DeserializationError err = deserializeJson(doc, buffer);

                    if (err) {
                        Serial.printf("[DISCOVERY] JSON parse error: %s\n", err.c_str());
                        continue;
                    }

                    // Validate response
                    if (doc["service"] != "ALN_ORCHESTRATOR") {
                        continue;
                    }

                    // Extract first address
                    JsonArray addresses = doc["addresses"];
                    if (addresses.size() == 0) {
                        Serial.println("[DISCOVERY] No addresses in response");
                        continue;
                    }

                    result.found = true;
                    result.protocol = doc["protocol"].as<String>();
                    result.address = addresses[0].as<String>();
                    result.port = doc["port"];
                    result.version = doc["version"].as<String>();

                    Serial.printf("[DISCOVERY] Found orchestrator: %s\n",
                                  result.getUrl().c_str());

                    udp.stop();
                    return result;
                }
                delay(10);
            }
        }

        Serial.println("[DISCOVERY] No orchestrator found after all retries");
        udp.stop();
        return result;
    }

private:
    static constexpr int DISCOVERY_PORT = 8888;

    DiscoveryService() = default;
    DiscoveryService(const DiscoveryService&) = delete;
    DiscoveryService& operator=(const DiscoveryService&) = delete;
};

} // namespace services
```

#### 2. Integration with ConfigService

**File:** `ALNScanner_v5/services/ConfigService.h` (modify existing)

Discovery is PRIMARY, config URL is FALLBACK:

```cpp
String getOrchestratorUrl() {
    // PRIMARY: Attempt UDP discovery first
    Serial.println("[CONFIG] Attempting orchestrator discovery...");
    auto& discovery = DiscoveryService::getInstance();
    DiscoveryResult result = discovery.discover();

    if (result.found) {
        Serial.printf("[CONFIG] Using discovered URL: %s\n", result.getUrl().c_str());
        return result.getUrl();
    }

    // FALLBACK: Use config file URL if discovery failed
    String configUrl = _config.orchestratorUrl;
    if (configUrl.length() > 0) {
        Serial.printf("[CONFIG] Discovery failed, using config URL: %s\n", configUrl.c_str());
        return configUrl;
    }

    // No URL available
    Serial.println("[CONFIG] ERROR: No orchestrator URL (discovery failed, no config fallback)");
    return "";
}
```

#### 3. Config File Behavior

**File:** `config.txt` on SD card

```ini
# URL is now a FALLBACK only (discovery is tried first)
# Leave empty to require discovery, or set for fallback
ORCHESTRATOR_URL=http://10.0.0.177:3000

# To disable discovery and use config URL directly:
# DISCOVERY_ENABLED=false
# ORCHESTRATOR_URL=http://10.0.0.177:3000
```

### Testing

#### Test Sketch

Create `test-sketches/62-udp-discovery/62-udp-discovery.ino`:

```cpp
#include <WiFi.h>
#include "../../ALNScanner_v5/services/DiscoveryService.h"

const char* ssid = "YourNetwork";
const char* password = "YourPassword";

void setup() {
    Serial.begin(115200);

    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nConnected: %s\n", WiFi.localIP().toString().c_str());

    // Test discovery
    auto& discovery = services::DiscoveryService::getInstance();
    auto result = discovery.discover();

    if (result.found) {
        Serial.println("=== DISCOVERY SUCCESS ===");
        Serial.printf("URL: %s\n", result.getUrl().c_str());
        Serial.printf("Protocol: %s\n", result.protocol.c_str());
        Serial.printf("Address: %s\n", result.address.c_str());
        Serial.printf("Port: %d\n", result.port);
        Serial.printf("Version: %s\n", result.version.c_str());
    } else {
        Serial.println("=== DISCOVERY FAILED ===");
    }
}

void loop() {
    // Interactive commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();

        if (cmd == "DISCOVER") {
            auto& discovery = services::DiscoveryService::getInstance();
            auto result = discovery.discover();
            Serial.printf("Result: %s\n", result.found ? result.getUrl().c_str() : "NOT FOUND");
        }
    }
}
```

### Verification Checklist

- [ ] Backend discovery service running (check: `netstat -uln | grep 8888`)
- [ ] Test sketch discovers orchestrator on same subnet
- [ ] Discovery works after WiFi reconnect
- [ ] Timeout behavior correct (3 retries × 3 seconds = 9 seconds max)
- [ ] Falls back to config URL when discovery fails
- [ ] Works with empty config URL (discovery-only mode)
- [ ] Integration with OrchestratorService works end-to-end

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| UDP broadcast blocked by network | Fall back to config URL; document network requirements |
| Discovery delays boot time | 9 second max; acceptable for robust discovery |
| Multiple orchestrators respond | Use first response (sufficient for single-orchestrator setup) |
| Broadcast storm on boot | 3 retries with 3s timeout = max 9s, acceptable |

### Future Enhancements

1. **Cache discovered URL** to SD card for faster subsequent boots
2. **Periodic re-discovery** if connection lost
3. **Multi-orchestrator support** - let user choose from discovered list
4. **Service health in response** - backend could include current session state
5. **DISCOVERY_ENABLED config flag** - allow disabling discovery entirely

---

## Implementation Notes

This plan is self-contained and can be implemented independently of the dual-record NFC tag work. The ESP32 can continue using hardcoded IPs until this is implemented.
