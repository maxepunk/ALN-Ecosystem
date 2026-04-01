# Status Screen Live Data Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the ESP32 scanner's status screen to display real system data (WiFi, orchestrator, queue, config) instead of hardcoded placeholder values.

**Architecture:** UIStateMachine currently constructs `StatusScreen::SystemStatus` with placeholder data in `handleTouchInState()` (lines 326-333). The fix adds a status provider callback (`std::function`) that Application sets after creating the UI, keeping the UI layer decoupled from the service layer. Additionally, `_rfidReady` and `_debugMode` are stored as members in UIStateMachine so internal transitions (dismiss status, dismiss token, processing timeout) use correct values instead of hardcoded `showReady(true, false)`.

**Tech Stack:** C++ (Arduino framework), ESP32, header-only architecture

---

## Problem Analysis

### Bug 1: Status screen always shows "offline" placeholder data
**Location:** `ALNScanner_v5/ui/UIStateMachine.h:326-333`
```cpp
// This is a placeholder - will be fixed in integration
StatusScreen::SystemStatus status;
status.connState = models::ORCH_DISCONNECTED;  // Always "DISCONNECTED"
status.wifiSSID = "N/A";
status.localIP = "0.0.0.0";
status.queueSize = 0;
status.teamID = "000";
status.deviceID = "UNKNOWN";
```

### Bug 2: Internal transitions hardcode rfid/debug state
**Location:** `ALNScanner_v5/ui/UIStateMachine.h` lines 220, 290, 302
```cpp
showReady(true, false);  // Always claims RFID ready, debug off
```
This means: if you're in debug mode, dismiss the status screen, and the ready screen incorrectly shows "READY TO SCAN" (green) instead of "DEBUG MODE" (red).

### Data Sources (all accessible via singletons)
| Field | Source | Method |
|-------|--------|--------|
| `connState` | `OrchestratorService` | `.getState()` returns `models::ConnectionState` |
| `wifiSSID` | `WiFi` (ESP32 lib) | `WiFi.SSID()` |
| `localIP` | `WiFi` (ESP32 lib) | `WiFi.localIP().toString()` |
| `queueSize` | `OrchestratorService` | `.getQueueSize()` returns `int` |
| `maxQueueSize` | `queue_config` | `::MAX_QUEUE_SIZE` (constant, already used) |
| `teamID` | `ConfigService` | `.getConfig().teamID` |
| `deviceID` | `ConfigService` | `.getConfig().deviceID` |
| `rfidReady` | `Application` | `_rfidInitialized` member |
| `debugMode` | `Application` | `_debugMode` member |

### Design Decision: Callback vs Direct Singleton Access

**Option A: Callback (chosen)**
- UIStateMachine stores `std::function<SystemStatus()>` set by Application
- Application's lambda captures `this` and reads services + own state
- UI layer stays decoupled from service layer
- `std::function` already used in SerialService (same codebase), so no new overhead
- Consistent with existing dependency injection pattern (HAL refs passed to constructor)

**Option B: Direct singleton access (rejected)**
- UIStateMachine would `#include` OrchestratorService and ConfigService
- Simpler code but breaks the layered architecture (UI -> Services dependency)
- Would need WiFi.h include too (ESP32 system lib in UI layer)

### Downstream Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `std::function` heap allocation | ~32 bytes per callback | Already used in SerialService; negligible |
| Callback not set (null) | Crash on tap | Null check before calling; fall back to placeholder |
| Flash size increase | ~200 bytes | Well within no_ota 2MB partition |
| `<functional>` include in UIStateMachine | Already transitively included | No new dependency |
| Thread safety of status reads | Main loop only (Core 1) | Touch handling is Core 1 only; OrchestratorService connection state uses thread-safe holder |
| Stale null byte at offset 715 in UIStateMachine.h | grep/ripgrep treats as binary | Fix with `tr` or rewrite; not blocking but should clean up |

---

## Tasks

### Task 1: Fix null byte in UIStateMachine.h

The file has a stray null byte at offset 715 causing grep to treat it as binary. Fix before making edits.

**Files:**
- Fix: `ALNScanner_v5/ui/UIStateMachine.h`

**Step 1: Remove null bytes**

Run:
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/arduino-cyd-player-scanner
tr -d '\0' < ALNScanner_v5/ui/UIStateMachine.h > /tmp/UIStateMachine_clean.h
mv /tmp/UIStateMachine_clean.h ALNScanner_v5/ui/UIStateMachine.h
```

**Step 2: Verify fix**

Run:
```bash
file ALNScanner_v5/ui/UIStateMachine.h
grep -c 'showReady' ALNScanner_v5/ui/UIStateMachine.h
```
Expected: File type shows "C source" or "ASCII text", grep returns a count (not "binary file matches").

---

### Task 2: Store rfid/debug state in UIStateMachine

Add `_rfidReady` and `_debugMode` members so internal transitions don't need to hardcode values.

**Files:**
- Modify: `ALNScanner_v5/ui/UIStateMachine.h`

**Step 1: Add member variables**

After the existing `_processingStartTime` member (around line 256), add:
```cpp
    // Cached application state for internal transitions
    bool _rfidReady;
    bool _debugMode;
```

**Step 2: Initialize in constructor**

In the constructor initializer list, after `_processingStartTime(0)`, add:
```cpp
        , _rfidReady(false)
        , _debugMode(false)
```

**Step 3: Cache values in showReady()**

At the top of `showReady()`, before the LOG_INFO, add:
```cpp
        _rfidReady = rfidReady;
        _debugMode = debugMode;
```

**Step 4: Replace all hardcoded showReady(true, false) calls**

Three locations in `handleTouchInState()` and `update()`:

- Line 220 (processing timeout): `showReady(true, false)` -> `showReady(_rfidReady, _debugMode)`
- Line 290 (dismiss status): `showReady(true, false)` -> `showReady(_rfidReady, _debugMode)`
- Line 302 (dismiss token): `showReady(true, false)` -> `showReady(_rfidReady, _debugMode)`

---

### Task 3: Add status provider callback to UIStateMachine

**Files:**
- Modify: `ALNScanner_v5/ui/UIStateMachine.h`

**Step 1: Add callback type and member**

Add `#include <functional>` to the includes (after `#include <memory>`).

Add the callback type alias inside the class (after the `State` enum):
```cpp
    // Callback to get real system status from Application layer
    using StatusProvider = std::function<StatusScreen::SystemStatus()>;
```

Add setter method (after `isBlockingRFID()`):
```cpp
    // Set callback for providing real system status data
    void setStatusProvider(StatusProvider provider) {
        _statusProvider = std::move(provider);
    }
```

Add member variable (after `_debugMode`):
```cpp
    StatusProvider _statusProvider;  // Callback to get real status from Application
```

**Step 2: Replace hardcoded status in handleTouchInState()**

Replace the entire READY case's status construction block (lines 326-335) with:
```cpp
                    // Single tap - show status
                    LOG_INFO("[UI-STATE] READY: Single-tap - showing status\n");

                    if (_statusProvider) {
                        showStatus(_statusProvider());
                    } else {
                        // Fallback if provider not set (shouldn't happen in production)
                        LOG_ERROR("UI-STATE", "No status provider set - using defaults");
                        StatusScreen::SystemStatus status;
                        status.connState = models::ORCH_DISCONNECTED;
                        status.wifiSSID = "N/A";
                        status.localIP = "0.0.0.0";
                        status.queueSize = 0;
                        status.maxQueueSize = queue_config::MAX_QUEUE_SIZE;
                        status.teamID = "---";
                        status.deviceID = "NO PROVIDER";
                        showStatus(status);
                    }
```

---

### Task 4: Wire Application to provide real status data

**Files:**
- Modify: `ALNScanner_v5/Application.h`

**Step 1: Add WiFi include**

Add after existing includes (around line 41, after `#include "ui/UIStateMachine.h"`):
```cpp
#include <WiFi.h>
```

Check if WiFi.h is already included transitively (OrchestratorService likely includes it). If so, skip.

**Step 2: Set status provider after UI creation**

In `Application::setup()`, after `_ui = new ui::UIStateMachine(...)` (line 1368) and before `_ui->showReady(...)` (line 1369), add:
```cpp
    // Wire status provider so tap-for-status shows real data
    _ui->setStatusProvider([this]() -> ui::StatusScreen::SystemStatus {
        auto& orch = services::OrchestratorService::getInstance();
        auto& config = services::ConfigService::getInstance();

        ui::StatusScreen::SystemStatus status;
        status.connState = orch.getState();
        status.wifiSSID = WiFi.SSID();
        status.localIP = WiFi.localIP().toString();
        status.queueSize = orch.getQueueSize();
        status.maxQueueSize = queue_config::MAX_QUEUE_SIZE;
        status.teamID = config.getConfig().teamID;
        status.deviceID = config.getConfig().deviceID;
        return status;
    });
```

Note: `this` is captured but only `_rfidInitialized` and `_debugMode` are NOT needed here — those are handled by Task 2's cached members. The lambda only reads from service singletons which are safe to access from Core 1 (main loop).

---

### Task 5: Add "Double-Tap to Escape Memory" hint to ReadyScreen

Players need to know how to dismiss a token display. Add this instruction to the ready screen, more prominent than "Tap for Status".

**Files:**
- Modify: `ALNScanner_v5/ui/screens/ReadyScreen.h`

**Step 1: Add the hint in onRender()**

In `onRender()`, between the RFID status block and the "Tap for Status" hint, replace:
```cpp
        // Display touch interaction hint (cyan text, size 2)
        tft.println("");  // Blank line for spacing
        tft.setTextColor(TFT_CYAN, TFT_BLACK);
        tft.setTextSize(2);
        tft.println("Tap for Status");
```

With:
```cpp
        // Player instruction - how to dismiss token display (prominent, white)
        tft.println("");
        tft.setTextColor(TFT_WHITE, TFT_BLACK);
        tft.setTextSize(2);
        tft.println("Double-Tap to");
        tft.println("Escape Memory");

        // Secondary hint - status screen (less prominent, cyan size 1)
        tft.println("");
        tft.setTextColor(TFT_CYAN, TFT_BLACK);
        tft.setTextSize(1);
        tft.println("Tap for Status");
```

**Design rationale:**
- "Double-Tap to Escape Memory" is white size 2 (bold, high contrast) — the primary player instruction
- "Tap for Status" is demoted to cyan size 1 — secondary/operational hint, still visible but not competing
- Split across two lines ("Double-Tap to" / "Escape Memory") because 240px wide at size 2 fits ~20 chars per line
- Layout fits within 320px height in both production and debug modes

---

### Task 6: Compile and verify (all changes)

**Step 1: Compile**

Run:
```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem/arduino-cyd-player-scanner/ALNScanner_v5
arduino-cli compile --fqbn esp32:esp32:esp32:PartitionScheme=no_ota,UploadSpeed=921600 .
```
Expected: Successful compilation. Watch for flash size (must be under ~2MB).

**Step 2: Upload**

Run:
```bash
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 .
```

**Step 3: Verify via serial monitor**

Reset device, send boot override character, then:

1. Wait for boot complete
2. Tap screen → status screen should show:
   - WiFi: `aboutlastnetwork` (green) with real IP
   - Orchestrator: `OFFLINE` (orange, since backend isn't running)
   - Queue: `0 scans` (green, since we just cleared it)
   - Team: `001`
   - Device: `SCANNER_001`
3. Tap again to dismiss → ready screen should show "DEBUG MODE" (red) since we used boot override

**Step 4: Verify non-debug mode**

Reset device WITHOUT sending override character. Wait 30s for normal boot. Tap screen:
- Same real status data
- Dismiss → should show "READY TO SCAN" (green) since RFID initialized

---

### Task 7: Commit

```bash
cd /home/maxepunk/projects/AboutLastNight/ALN-Ecosystem
git add arduino-cyd-player-scanner/ALNScanner_v5/ui/UIStateMachine.h
git add arduino-cyd-player-scanner/ALNScanner_v5/ui/screens/ReadyScreen.h
git add arduino-cyd-player-scanner/ALNScanner_v5/Application.h
git commit -m "fix(esp32): wire status screen to real system data, add escape hint

Status screen tap was showing hardcoded placeholder values (always
'offline'). Wire StatusProvider callback from Application to
UIStateMachine so status screen reads real WiFi, orchestrator,
queue, and config state.

Fix internal transitions (dismiss status, dismiss token, processing
timeout) that hardcoded showReady(true, false) — now use cached
_rfidReady/_debugMode values so debug mode indicator persists
correctly across screen transitions.

Add 'Double-Tap to Escape Memory' instruction to ready screen so
players know how to dismiss token displays."
```
