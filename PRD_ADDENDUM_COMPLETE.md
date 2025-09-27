# PRD Addendum: Complete ALN System Integration Requirements

**Document Version**: 3.0 COMPLETE  
**Date**: 2025-09-23  
**Status**: Implementation Ready  
**Original PRD**: VIDEO_PLAYBACK_PRD.md  
**Supersedes**: PRD_ADDENDUM_INTEGRATION.md v2.0

## Executive Summary

This COMPLETE addendum documents ALL integration work required to connect the ALN ecosystem components following the hybrid submodule architecture. The system consists of:

1. **ALN-TokenData** - Shared token database (nested submodule in scanners)
2. **aln-memory-scanner** - Player scanner PWA (submodule with nested ALN-TokenData)
3. **ALNScanner** - GM scanner web app (submodule with nested ALN-TokenData)
4. **backend/** - Orchestrator server (direct folder in ALN-Ecosystem)
5. **hardware/esp32/** - ESP32 scanner implementation (direct folder)

**Total Implementation Time: 48 hours** (increased from 32 to include ESP32 and admin interface)

## Part 1: Git Submodule Architecture (4 hours)

### 1.1 Fix Nested Submodule Structure (2 hours)

The scanners already have ALN-TokenData as a nested submodule in their `data/` folders. We need to properly configure this in ALN-Ecosystem:

```bash
cd /home/spide/projects/AboutLastNight/ALN-Ecosystem

# Add scanner repositories as submodules
git submodule add ../aln-memory-scanner aln-memory-scanner
git submodule add ../ALNScanner ALNScanner

# IMPORTANT: These already have ALN-TokenData nested in their data/ folders
# Configure recursive submodule updates
git config --file=.gitmodules submodule.aln-memory-scanner.recurse true
git config --file=.gitmodules submodule.ALNScanner.recurse true

# Also add ALN-TokenData directly for backend access
git submodule add ../ALN-TokenData ALN-TokenData

# Initialize all submodules recursively
git submodule update --init --recursive
```

The resulting structure:
```
ALN-Ecosystem/
├── aln-memory-scanner/         [SUBMODULE]
│   └── data/                   [NESTED SUBMODULE → ALN-TokenData]
├── ALNScanner/                 [SUBMODULE]
│   └── data/                   [NESTED SUBMODULE → ALN-TokenData]
├── ALN-TokenData/              [SUBMODULE for backend direct access]
└── backend/                    [DIRECT FOLDER]
```

### 1.2 Fix Backend Token Loading (CRITICAL - 2 hours)

**Current Violation**: Backend has hard-coded tokens in config
**Required**: Load from ALN-TokenData submodule

Update `backend/src/config/config.js`:
```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CRITICAL: Load tokens from ALN-TokenData submodule
export const loadTokens = () => {
  // Try multiple paths for flexibility
  const paths = [
    join(__dirname, '../../../ALN-TokenData/tokens.json'),          // Direct submodule
    join(__dirname, '../../../aln-memory-scanner/data/tokens.json'), // Via scanner
    join(__dirname, '../../tokens/tokens.json')                      // Fallback
  ];
  
  for (const path of paths) {
    try {
      const tokenData = readFileSync(path, 'utf8');
      console.log(`Loaded tokens from: ${path}`);
      return JSON.parse(tokenData);
    } catch (error) {
      // Try next path
    }
  }
  
  throw new Error('ALN-TokenData not found. Run: git submodule update --init --recursive');
};

export const tokens = loadTokens();

// DELETE ALL HARD-CODED TOKEN OBJECTS
```

## Part 2: Player Scanner Implementation (10 hours)

### 2.1 Token Detection Logic Enhancement (PRD lines 263-294)

Create `aln-memory-scanner/js/orchestratorIntegration.js`:
```javascript
// Orchestrator integration for video token handling
class OrchestratorIntegration {
  constructor() {
    this.baseUrl = this.discoverOrchestrator();
    this.deviceId = this.getOrCreateDeviceId();
    this.offlineQueue = this.loadOfflineQueue();
    this.connected = false;
    
    // Start monitoring
    this.monitorConnection();
    this.processQueuePeriodically();
  }
  
  discoverOrchestrator() {
    // Try mDNS discovery first (PRD line 304)
    // Fallback to configured URL
    return localStorage.getItem('orchestrator_url') || 'http://192.168.1.10:3000';
  }
  
  getOrCreateDeviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', id);
    }
    return id;
  }
  
  async processScannedToken(tokenId, tokenData) {
    // Token type detection (PRD lines 270-272)
    const hasImage = tokenData.image !== null;
    const hasAudio = tokenData.audio !== null;
    const hasVideo = tokenData.video !== null;
    
    if (hasVideo) {
      // Video token - send to orchestrator (PRD lines 275-289)
      return await this.handleVideoToken(tokenId, tokenData);
    } else if (hasImage || hasAudio) {
      // Standard memory token - local playback (PRD lines 291-292)
      return { status: 'local', data: tokenData };
    }
    
    return { status: 'unknown', error: 'Invalid token type' };
  }
  
  async handleVideoToken(tokenId, tokenData) {
    const transaction = {
      tokenId: tokenId,
      deviceId: this.deviceId,
      timestamp: Date.now()
    };
    
    // FR-007: Support offline mode
    if (!this.connected) {
      return this.queueForLater(transaction, tokenData);
    }
    
    try {
      const response = await this.postToOrchestrator('/api/scan', transaction);
      
      if (response.status === 'playing') {
        this.displayProcessingScreen(tokenData.processingImage);
      } else if (response.status === 'busy') {
        this.displayBusyMessage(response.message || 'Memory processing, try again');
      }
      
      return response;
    } catch (error) {
      console.error('Orchestrator error:', error);
      return this.queueForLater(transaction, tokenData);
    }
  }
  
  async postToOrchestrator(endpoint, data) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(this.baseUrl + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  queueForLater(transaction, tokenData) {
    // FR-020: Queue up to 100 transactions
    if (this.offlineQueue.length >= 100) {
      this.offlineQueue.shift();
    }
    
    this.offlineQueue.push(transaction);
    this.saveOfflineQueue();
    
    // Show queued status
    this.displayQueuedStatus(this.offlineQueue.length);
    
    return {
      status: 'queued',
      message: `Saved for sync (${this.offlineQueue.length} pending)`,
      queue_length: this.offlineQueue.length
    };
  }
  
  async monitorConnection() {
    setInterval(async () => {
      try {
        const response = await fetch(this.baseUrl + '/api/status', {
          timeout: 2000
        });
        this.connected = response.ok;
      } catch {
        this.connected = false;
      }
      
      this.updateConnectionUI();
    }, 10000); // Check every 10 seconds
  }
  
  processQueuePeriodically() {
    // FR-020: Retry every 30 seconds
    setInterval(() => {
      if (this.connected && this.offlineQueue.length > 0) {
        this.processOfflineQueue();
      }
    }, 30000);
  }
  
  async processOfflineQueue() {
    // FR-022: Auto-sync when reconnected
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const transaction of queue) {
      try {
        await this.postToOrchestrator('/api/scan', transaction);
      } catch {
        this.offlineQueue.push(transaction); // Re-queue on failure
      }
    }
    
    this.saveOfflineQueue();
    this.updateConnectionUI();
  }
  
  // UI Methods
  displayProcessingScreen(imagePath) {
    const modal = document.getElementById('video-processing-modal');
    if (modal && imagePath) {
      const img = modal.querySelector('img');
      img.src = imagePath;
      modal.classList.add('active');
      setTimeout(() => modal.classList.remove('active'), 30000);
    }
  }
  
  displayBusyMessage(message) {
    const notification = document.getElementById('busy-notification');
    if (notification) {
      notification.textContent = message;
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 5000);
    }
  }
  
  displayQueuedStatus(count) {
    const status = document.getElementById('queue-status');
    if (status) {
      status.textContent = `${count} scans queued`;
      status.classList.add('visible');
    }
  }
  
  updateConnectionUI() {
    // FR-021: Clear offline status indication
    const indicator = document.getElementById('connection-indicator');
    if (indicator) {
      if (this.connected) {
        indicator.className = 'connected';
        indicator.innerHTML = '🟢 Online';
      } else {
        indicator.className = 'disconnected';
        indicator.innerHTML = `🔴 Offline - ${this.offlineQueue.length} queued`;
      }
    }
  }
  
  // Storage helpers
  loadOfflineQueue() {
    const stored = localStorage.getItem('offline_scan_queue');
    return stored ? JSON.parse(stored) : [];
  }
  
  saveOfflineQueue() {
    localStorage.setItem('offline_scan_queue', JSON.stringify(this.offlineQueue));
  }
}

// Export for use in main scanner
window.OrchestratorIntegration = OrchestratorIntegration;
```

### 2.2 Integrate with Existing Scanner (3 hours)

Modify `aln-memory-scanner/index.html`:
```html
<!-- Add orchestrator integration -->
<script src="js/orchestratorIntegration.js"></script>

<!-- Add UI elements for orchestrator status -->
<div id="connection-indicator" class="disconnected">🔴 Offline</div>

<div id="video-processing-modal" class="modal">
  <div class="modal-content">
    <img src="" alt="Processing memory...">
    <p>Memory processing on main display...</p>
    <div class="processing-spinner"></div>
  </div>
</div>

<div id="busy-notification" class="notification"></div>
<div id="queue-status" class="queue-status"></div>
```

Modify scanner JavaScript:
```javascript
// Initialize orchestrator integration
const orchestrator = new OrchestratorIntegration();

// Modify existing processScannedData function
async function processScannedData(nfcId) {
  const tokenData = tokens[nfcId];
  
  if (!tokenData) {
    displayError('Unknown token');
    return;
  }
  
  // Use orchestrator integration for video tokens
  const result = await orchestrator.processScannedToken(nfcId, tokenData);
  
  if (result.status === 'local') {
    // Continue with existing local playback
    displayMemory(tokenData);
  } else if (result.status === 'playing' || result.status === 'busy' || result.status === 'queued') {
    // Orchestrator is handling it
    console.log('Orchestrator handling:', result);
  }
}
```

## Part 3: GM Scanner WebSocket Integration (12 hours)

### 3.1 WebSocket Client Implementation (PRD lines 327-374)

Create `ALNScanner/js/orchestratorWebSocket.js`:
```javascript
// Real-time synchronization with orchestrator
class OrchestratorWebSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.localQueue = [];
    this.stationId = this.getOrCreateStationId();
    this.orchestratorUrl = localStorage.getItem('orchestrator_url') || 'http://192.168.1.10:3000';
    
    this.connect();
  }
  
  getOrCreateStationId() {
    let id = localStorage.getItem('gm_station_id');
    if (!id) {
      id = 'gm_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('gm_station_id', id);
    }
    return id;
  }
  
  connect() {
    // Use Socket.io for robust WebSocket connection
    this.socket = io(this.orchestratorUrl, {
      query: {
        stationId: this.stationId,
        type: 'gm_station'
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Connection lifecycle
    this.socket.on('connect', () => {
      console.log('Connected to orchestrator');
      this.connected = true;
      this.onConnect();
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.connected = false;
      this.onDisconnect();
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      this.requestFullSync();
    });
    
    // State synchronization (PRD lines 343-357)
    this.socket.on('state_sync', (data) => {
      this.handleFullStateSync(data);
    });
    
    this.socket.on('state_update', (data) => {
      this.handleIncrementalUpdate(data);
    });
    
    // Video events (PRD lines 354-356)
    this.socket.on('video_started', (data) => {
      this.handleVideoStarted(data);
    });
    
    this.socket.on('video_stopped', () => {
      this.handleVideoStopped();
    });
    
    // Transaction feedback
    this.socket.on('transaction_accepted', (data) => {
      this.handleTransactionAccepted(data);
    });
    
    this.socket.on('transaction_rejected', (data) => {
      this.handleTransactionRejected(data);
    });
    
    // Admin events
    this.socket.on('admin_message', (data) => {
      this.handleAdminMessage(data);
    });
  }
  
  onConnect() {
    // Update UI
    this.updateConnectionStatus(true);
    
    // Flush queued transactions (PRD line 338)
    this.flushQueue();
    
    // Request full state sync (PRD line 340)
    this.requestFullSync();
  }
  
  onDisconnect() {
    // Update UI
    this.updateConnectionStatus(false);
    
    // Switch to offline mode (PRD line 361)
    console.log('Operating in offline mode');
  }
  
  requestFullSync() {
    this.socket.emit('request_sync', {
      stationId: this.stationId,
      lastTransactionId: this.getLastTransactionId()
    });
  }
  
  sendTransaction(transaction) {
    // Add metadata
    transaction.stationId = this.stationId;
    transaction.timestamp = transaction.timestamp || Date.now();
    transaction.id = this.generateTransactionId();
    
    if (this.connected) {
      // Send via WebSocket (PRD line 368)
      this.socket.emit('transaction', {
        type: 'transaction',
        transaction: transaction
      });
      
      // Optimistic update
      this.addOptimisticTransaction(transaction);
    } else {
      // Queue for later (PRD lines 370-371)
      this.queueTransaction(transaction);
    }
    
    return transaction;
  }
  
  queueTransaction(transaction) {
    this.localQueue.push(transaction);
    localStorage.setItem('gm_transaction_queue', JSON.stringify(this.localQueue));
    this.updateQueueStatus();
  }
  
  flushQueue() {
    if (this.localQueue.length === 0) return;
    
    console.log(`Sending ${this.localQueue.length} queued transactions`);
    
    this.localQueue.forEach(tx => {
      this.socket.emit('transaction', {
        type: 'transaction',
        transaction: tx
      });
    });
    
    this.localQueue = [];
    localStorage.removeItem('gm_transaction_queue');
    this.updateQueueStatus();
  }
  
  // State handlers
  handleFullStateSync(data) {
    console.log('Full state sync received');
    
    // Replace all local state (PRD lines 347-349)
    if (data.transactions) {
      DataManager.replaceAllTransactions(data.transactions);
    }
    
    if (data.scores) {
      UIManager.updateScoreboard(data.scores);
    }
    
    if (data.sessionInfo) {
      UIManager.updateSessionInfo(data.sessionInfo);
    }
    
    if (data.groupCompletions) {
      UIManager.updateGroupCompletions(data.groupCompletions);
    }
  }
  
  handleIncrementalUpdate(data) {
    console.log('Incremental update received');
    
    // Merge updates (PRD lines 351-353)
    if (data.transactions) {
      DataManager.mergeTransactions(data.transactions);
    }
    
    if (data.scores) {
      UIManager.updateScoreboard(data.scores);
    }
    
    if (data.groupCompletions) {
      UIManager.updateGroupCompletions(data.groupCompletions);
    }
  }
  
  handleVideoStarted(data) {
    console.log('Video started:', data);
    UIManager.showVideoPlayingIndicator({
      tokenId: data.token.SF_RFID,
      tokenName: data.token.SF_MemoryType,
      triggeredBy: data.deviceId,
      startTime: Date.now()
    });
  }
  
  handleVideoStopped() {
    console.log('Video playback stopped');
    UIManager.hideVideoPlayingIndicator();
  }
  
  handleTransactionAccepted(data) {
    console.log('Transaction confirmed:', data.transactionId);
    DataManager.confirmTransaction(data.transactionId);
    UIManager.showNotification('Transaction confirmed', 'success');
  }
  
  handleTransactionRejected(data) {
    console.log('Transaction rejected:', data.reason);
    DataManager.removeTransaction(data.transactionId);
    
    if (data.reason === 'duplicate') {
      UIManager.showDuplicateWarning(data.tokenId);
    } else {
      UIManager.showNotification(`Transaction rejected: ${data.reason}`, 'error');
    }
  }
  
  handleAdminMessage(data) {
    console.log('Admin message:', data);
    UIManager.showAdminNotification(data.message, data.priority);
  }
  
  // UI helpers
  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('ws-connection-status');
    if (statusEl) {
      statusEl.className = connected ? 'ws-connected' : 'ws-disconnected';
      statusEl.innerHTML = connected ? 
        '🟢 Orchestrator Connected' : 
        `🔴 Orchestrator Disconnected`;
    }
    
    // Enable/disable sync features
    document.querySelectorAll('.requires-orchestrator').forEach(el => {
      el.disabled = !connected;
    });
  }
  
  updateQueueStatus() {
    const queueEl = document.getElementById('transaction-queue-status');
    if (queueEl) {
      if (this.localQueue.length > 0) {
        queueEl.innerHTML = `📦 ${this.localQueue.length} transactions queued`;
        queueEl.style.display = 'block';
      } else {
        queueEl.style.display = 'none';
      }
    }
  }
  
  // Utilities
  generateTransactionId() {
    return `${this.stationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getLastTransactionId() {
    const transactions = DataManager.getAllTransactions();
    return transactions.length > 0 ? transactions[transactions.length - 1].id : null;
  }
  
  addOptimisticTransaction(transaction) {
    transaction.pending = true;
    DataManager.addTransaction(transaction);
  }
  
  // Admin controls
  sendAdminCommand(command, data) {
    if (this.connected) {
      this.socket.emit('admin_command', {
        command: command,
        data: data,
        stationId: this.stationId
      });
    } else {
      UIManager.showNotification('Cannot send command while disconnected', 'error');
    }
  }
  
  stopVideo() {
    this.sendAdminCommand('stop_video', {});
  }
  
  endSession() {
    if (confirm('Are you sure you want to end the current session?')) {
      this.sendAdminCommand('end_session', {
        timestamp: Date.now()
      });
    }
  }
  
  exportSession() {
    this.sendAdminCommand('export_session', {});
  }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  window.orchestratorWS = new OrchestratorWebSocket();
});
```

### 3.2 Integrate with DataManager (PRD lines 380-396)

Modify `ALNScanner/index.html`:
```javascript
// Wrap existing DataManager methods for orchestrator sync
(function() {
  const originalAddTransaction = DataManager.addTransaction;
  
  DataManager.addTransaction = function(transaction) {
    // Always save locally first (PRD lines 382-384)
    const result = originalAddTransaction.call(this, transaction);
    
    if (result.success && window.orchestratorWS) {
      // Try to sync with orchestrator (PRD lines 386-388)
      orchestratorWS.sendTransaction(transaction);
    }
    
    // Calculate scores locally if offline (PRD lines 391-393)
    if (!window.orchestratorWS || !orchestratorWS.connected) {
      this.calculateLocalScores();
    }
    
    return result;
  };
  
  // Add merge capability for sync
  DataManager.mergeTransactions = function(transactions) {
    transactions.forEach(tx => {
      const existing = this.transactions.find(t => t.id === tx.id);
      if (!existing) {
        this.transactions.push(tx);
      } else if (existing.pending && !tx.pending) {
        // Replace pending with confirmed
        Object.assign(existing, tx);
      }
    });
    
    this.saveToLocalStorage();
    UIManager.updateTransactionHistory();
  };
  
  DataManager.replaceAllTransactions = function(transactions) {
    this.transactions = transactions;
    this.saveToLocalStorage();
    UIManager.updateTransactionHistory();
    this.recalculateAllScores();
  };
  
  DataManager.confirmTransaction = function(transactionId) {
    const tx = this.transactions.find(t => t.id === transactionId);
    if (tx) {
      tx.pending = false;
      tx.confirmed = true;
      this.saveToLocalStorage();
      UIManager.updateTransactionStatus(transactionId, 'confirmed');
    }
  };
  
  DataManager.removeTransaction = function(transactionId) {
    const index = this.transactions.findIndex(t => t.id === transactionId);
    if (index >= -1) {
      this.transactions.splice(index, 1);
      this.saveToLocalStorage();
      UIManager.removeTransactionFromHistory(transactionId);
    }
  };
})();
```

## Part 4: ESP32 Hardware Implementation (8 hours)

### 4.1 File Structure (PRD lines 426-433)

Create ESP32 project structure:
```
hardware/esp32/
├── src/
│   ├── main.cpp
│   ├── orchestrator_client.h
│   ├── orchestrator_client.cpp
│   ├── token_detector.h
│   ├── token_detector.cpp
│   ├── display_manager.h
│   └── display_manager.cpp
├── data/
│   ├── images/          # Processing screen images
│   ├── audio/           # Audio files
│   └── markers/         # Video token markers
├── platformio.ini
├── README.md
└── upload_assets.sh
```

### 4.2 Token Detection Logic (PRD lines 437-454)

Create `hardware/esp32/src/token_detector.cpp`:
```cpp
#include "token_detector.h"
#include <SD.h>
#include <FS.h>

TokenType TokenDetector::detectTokenType(String tokenId) {
    // Check for video marker file first (PRD lines 443-444)
    String videoMarker = "/markers/" + tokenId + ".vid";
    if (SD.exists(videoMarker)) {
        return TOKEN_VIDEO;
    }
    
    // Check for standard media files
    String imagePath = "/images/" + tokenId + ".jpg";
    String audioPath = "/audio/" + tokenId + ".mp3";
    
    bool hasImage = SD.exists(imagePath);
    bool hasAudio = SD.exists(audioPath);
    
    if (hasImage && hasAudio) {
        return TOKEN_IMAGE_AUDIO;
    } else if (hasImage) {
        return TOKEN_IMAGE;
    } else if (hasAudio) {
        return TOKEN_AUDIO;
    } else {
        return TOKEN_UNKNOWN;
    }
}

String TokenDetector::getProcessingImage(String tokenId) {
    // For video tokens, get the processing screen image
    String imagePath = "/images/" + tokenId + ".jpg";
    if (SD.exists(imagePath)) {
        return imagePath;
    }
    return "/images/default_processing.jpg";
}
```

### 4.3 Orchestrator Communication (PRD lines 459-493)

Create `hardware/esp32/src/orchestrator_client.cpp`:
```cpp
#include "orchestrator_client.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

OrchestratorClient::OrchestratorClient() {
    serverUrl = "http://192.168.1.10:3000";
    deviceId = getDeviceId();
}

void OrchestratorClient::sendScan(String tokenId, TokenType type) {
    if (type == TOKEN_VIDEO) {
        // Send to orchestrator for video playback (PRD lines 464-482)
        HTTPClient http;
        http.begin(serverUrl + "/api/scan");
        http.addHeader("Content-Type", "application/json");
        
        // Create JSON payload
        StaticJsonDocument<256> doc;
        doc["tokenId"] = tokenId;
        doc["deviceId"] = deviceId;
        doc["timestamp"] = millis();
        
        String payload;
        serializeJson(doc, payload);
        
        int responseCode = http.POST(payload);
        
        if (responseCode == 200) {
            String response = http.getString();
            handleOrchestratorResponse(response, tokenId);
        } else {
            displayManager.showError("Network error");
        }
        
        http.end();
        
        // Enter deep sleep to save battery (PRD lines 485-486)
        enterLowPowerMode();
    } else {
        // Handle local playback for non-video tokens (PRD line 489)
        handleLocalToken(tokenId, type);
    }
}

void OrchestratorClient::handleOrchestratorResponse(String response, String tokenId) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
        String status = doc["status"];
        
        if (status == "playing") {
            // Show processing image (PRD lines 475-476)
            String imagePath = tokenDetector.getProcessingImage(tokenId);
            displayManager.showProcessingImage(imagePath);
        } else if (status == "busy") {
            // Show busy message (PRD lines 477-478)
            displayManager.showBusyMessage(doc["message"]);
        } else if (status == "queued") {
            displayManager.showQueuedMessage(doc["queue_length"]);
        }
    }
}

void OrchestratorClient::handleLocalToken(String tokenId, TokenType type) {
    switch (type) {
        case TOKEN_IMAGE:
            displayManager.showImage("/images/" + tokenId + ".jpg");
            break;
        case TOKEN_AUDIO:
            audioPlayer.play("/audio/" + tokenId + ".mp3");
            break;
        case TOKEN_IMAGE_AUDIO:
            displayManager.showImage("/images/" + tokenId + ".jpg");
            audioPlayer.play("/audio/" + tokenId + ".mp3");
            break;
        default:
            displayManager.showError("Unknown token");
    }
}

void OrchestratorClient::enterLowPowerMode() {
    // Aggressive power saving (PRD lines 497-509)
    esp_wifi_set_ps(WIFI_PS_MAX_MODEM);
    setCpuFrequencyMhz(80);
    
    if (!activePlayback) {
        esp_sleep_enable_timer_wakeup(100000); // 100ms
        esp_deep_sleep_start();
    }
}
```

### 4.4 Main Program

Create `hardware/esp32/src/main.cpp`:
```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <SD.h>
#include <SPI.h>
#include <MFRC522.h>
#include "orchestrator_client.h"
#include "token_detector.h"
#include "display_manager.h"

// Pin definitions
#define SD_CS 5
#define RFID_SS 21
#define RFID_RST 22

// Network credentials
const char* ssid = "ALN_GAME_NET";
const char* password = "your_password";

MFRC522 rfid(RFID_SS, RFID_RST);
OrchestratorClient orchestrator;
TokenDetector tokenDetector;
DisplayManager displayManager;

void setup() {
    Serial.begin(115200);
    
    // Initialize SD card
    if (!SD.begin(SD_CS)) {
        Serial.println("SD Card initialization failed!");
        return;
    }
    
    // Initialize RFID reader
    SPI.begin();
    rfid.PCD_Init();
    
    // Initialize display
    displayManager.begin();
    
    // Connect to WiFi
    connectToWiFi();
    
    // Configure power saving
    configurePowerSaving();
    
    Serial.println("ESP32 Scanner Ready");
}

void loop() {
    // Check for RFID card
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
        delay(100);
        return;
    }
    
    // Get token ID from card
    String tokenId = getTokenId(rfid.uid.uidByte, rfid.uid.size);
    
    // Detect token type
    TokenType type = tokenDetector.detectTokenType(tokenId);
    
    // Send to orchestrator or handle locally
    orchestrator.sendScan(tokenId, type);
    
    // Halt PICC
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
}

void connectToWiFi() {
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nConnected to WiFi");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nFailed to connect - operating offline");
    }
}

void configurePowerSaving() {
    // Set WiFi power saving mode (PRD line 500)
    esp_wifi_set_ps(WIFI_PS_MAX_MODEM);
    
    // Lower CPU frequency when idle (PRD line 503)
    setCpuFrequencyMhz(80);
}

String getTokenId(byte *buffer, byte bufferSize) {
    String id = "";
    for (byte i = 0; i < bufferSize; i++) {
        id += String(buffer[i], HEX);
    }
    return id;
}
```

### 4.5 PlatformIO Configuration

Create `hardware/esp32/platformio.ini`:
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps = 
    miguelbalboa/MFRC522@^1.4.10
    bblanchon/ArduinoJson@^6.19.4
    adafruit/Adafruit GFX Library@^1.11.5
    adafruit/Adafruit SSD1306@^2.5.7
upload_port = /dev/ttyUSB0
monitor_port = /dev/ttyUSB0
board_build.partitions = default.csv
board_build.filesystem = littlefs
```

## Part 5: Admin Interface Implementation (6 hours)

### 5.1 Admin Panel Structure

The admin panel already exists in `backend/public/admin/`. Enhance it:

```html
<!-- backend/public/admin/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>ALN Orchestrator Admin</title>
    <link rel="stylesheet" href="admin.css">
</head>
<body>
    <div class="admin-container">
        <header>
            <h1>ALN Orchestrator Control Panel</h1>
            <div id="system-status" class="status-indicator">
                <span class="status-dot"></span>
                <span class="status-text">System Ready</span>
            </div>
        </header>
        
        <main>
            <!-- Video Control Section -->
            <section class="control-section">
                <h2>Video Playback Control</h2>
                <div id="current-video" class="info-panel">
                    <p>Status: <span id="video-status">Idle</span></p>
                    <p>Current: <span id="video-name">None</span></p>
                    <p>Duration: <span id="video-duration">--:--</span></p>
                </div>
                <div class="control-buttons">
                    <button onclick="adminControl.stopVideo()">⏹ Stop Video</button>
                    <button onclick="adminControl.skipVideo()">⏭ Skip</button>
                    <button onclick="adminControl.testVideo()">🎬 Test Video</button>
                </div>
            </section>
            
            <!-- Session Management -->
            <section class="control-section">
                <h2>Session Management</h2>
                <div id="session-info" class="info-panel">
                    <p>Session ID: <span id="session-id">--</span></p>
                    <p>Started: <span id="session-start">--</span></p>
                    <p>Transactions: <span id="transaction-count">0</span></p>
                    <p>Players: <span id="player-count">0</span></p>
                    <p>GM Stations: <span id="gm-count">0</span></p>
                </div>
                <div class="control-buttons">
                    <button onclick="adminControl.newSession()">📝 New Session</button>
                    <button onclick="adminControl.endSession()">🏁 End Session</button>
                    <button onclick="adminControl.exportSession()">💾 Export Data</button>
                </div>
            </section>
            
            <!-- Connected Devices -->
            <section class="control-section">
                <h2>Connected Devices</h2>
                <div id="device-list" class="device-grid">
                    <!-- Dynamically populated -->
                </div>
            </section>
            
            <!-- Activity Log -->
            <section class="control-section">
                <h2>Activity Log</h2>
                <div class="log-controls">
                    <select id="log-filter">
                        <option value="all">All Events</option>
                        <option value="scan">Scans</option>
                        <option value="video">Video</option>
                        <option value="connection">Connections</option>
                        <option value="error">Errors</option>
                    </select>
                    <button onclick="adminControl.clearLog()">Clear</button>
                </div>
                <div id="activity-log" class="log-container">
                    <!-- Dynamically populated -->
                </div>
            </section>
            
            <!-- Manual Controls -->
            <section class="control-section">
                <h2>Manual Controls</h2>
                <div class="manual-controls">
                    <div class="control-group">
                        <label>Test Token Scan:</label>
                        <select id="test-token">
                            <option value="">Select token...</option>
                        </select>
                        <button onclick="adminControl.testScan()">Scan</button>
                    </div>
                    <div class="control-group">
                        <label>Add Transaction:</label>
                        <input type="text" id="manual-token" placeholder="Token ID">
                        <select id="manual-team">
                            <option value="team1">Team 1</option>
                            <option value="team2">Team 2</option>
                            <option value="team3">Team 3</option>
                            <option value="team4">Team 4</option>
                        </select>
                        <button onclick="adminControl.addTransaction()">Add</button>
                    </div>
                    <div class="control-group">
                        <label>Score Adjustment:</label>
                        <select id="adjust-team">
                            <option value="team1">Team 1</option>
                            <option value="team2">Team 2</option>
                            <option value="team3">Team 3</option>
                            <option value="team4">Team 4</option>
                        </select>
                        <input type="number" id="adjust-amount" placeholder="Points">
                        <input type="text" id="adjust-reason" placeholder="Reason">
                        <button onclick="adminControl.adjustScore()">Adjust</button>
                    </div>
                </div>
            </section>
        </main>
    </div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script src="admin.js"></script>
</body>
</html>
```

### 5.2 Admin JavaScript Controller

Create `backend/public/admin/admin.js`:
```javascript
class AdminController {
    constructor() {
        this.socket = null;
        this.sessionData = {};
        this.devices = new Map();
        this.activityLog = [];
        
        this.init();
    }
    
    async init() {
        // Authenticate
        await this.authenticate();
        
        // Connect WebSocket
        this.connectWebSocket();
        
        // Load initial data
        await this.loadSessionData();
        await this.loadTokenList();
        
        // Start periodic updates
        this.startMonitoring();
    }
    
    async authenticate() {
        const token = localStorage.getItem('admin_token');
        
        if (!token) {
            const password = prompt('Admin password:');
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: 'admin', 
                    password: password 
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('admin_token', data.token);
            } else {
                alert('Invalid password');
                window.location.reload();
            }
        }
    }
    
    connectWebSocket() {
        this.socket = io('/', {
            query: {
                type: 'admin',
                token: localStorage.getItem('admin_token')
            }
        });
        
        this.socket.on('connect', () => {
            console.log('Admin WebSocket connected');
            this.updateSystemStatus('connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Admin WebSocket disconnected');
            this.updateSystemStatus('disconnected');
        });
        
        // Real-time updates
        this.socket.on('device_connected', (device) => {
            this.addDevice(device);
        });
        
        this.socket.on('device_disconnected', (deviceId) => {
            this.removeDevice(deviceId);
        });
        
        this.socket.on('activity', (event) => {
            this.logActivity(event);
        });
        
        this.socket.on('video_status', (status) => {
            this.updateVideoStatus(status);
        });
        
        this.socket.on('session_update', (data) => {
            this.updateSessionInfo(data);
        });
    }
    
    // Video Controls
    async stopVideo() {
        const response = await fetch('/api/admin/video/stop', {
            method: 'POST',
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            this.logActivity({
                type: 'video',
                message: 'Video stopped by admin'
            });
        }
    }
    
    async skipVideo() {
        const response = await fetch('/api/admin/video/skip', {
            method: 'POST',
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            this.logActivity({
                type: 'video',
                message: 'Video skipped by admin'
            });
        }
    }
    
    async testVideo() {
        const tokenId = prompt('Enter video token ID:');
        if (!tokenId) return;
        
        const response = await fetch('/api/admin/video/play', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ tokenId })
        });
        
        if (response.ok) {
            this.logActivity({
                type: 'video',
                message: `Test video: ${tokenId}`
            });
        }
    }
    
    // Session Management
    async newSession() {
        if (!confirm('Start a new session? This will archive the current session.')) {
            return;
        }
        
        const response = await fetch('/api/admin/session/new', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                name: prompt('Session name:') || `Session_${Date.now()}`
            })
        });
        
        if (response.ok) {
            const session = await response.json();
            this.sessionData = session;
            this.updateSessionInfo(session);
            this.clearActivityLog();
        }
    }
    
    async endSession() {
        if (!confirm('End the current session?')) {
            return;
        }
        
        const response = await fetch('/api/admin/session/end', {
            method: 'POST',
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            alert('Session ended and archived');
            await this.loadSessionData();
        }
    }
    
    async exportSession() {
        const response = await fetch('/api/admin/session/export', {
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            const data = await response.blob();
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session_${this.sessionData.id}_export.json`;
            a.click();
        }
    }
    
    // Manual Controls
    async testScan() {
        const tokenId = document.getElementById('test-token').value;
        if (!tokenId) return;
        
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokenId: tokenId,
                deviceId: 'admin_test',
                timestamp: Date.now()
            })
        });
        
        const result = await response.json();
        this.logActivity({
            type: 'scan',
            message: `Test scan: ${tokenId} - ${result.status}`
        });
    }
    
    async addTransaction() {
        const tokenId = document.getElementById('manual-token').value;
        const team = document.getElementById('manual-team').value;
        
        if (!tokenId || !team) {
            alert('Please fill all fields');
            return;
        }
        
        const response = await fetch('/api/admin/transaction/add', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                tokenId: tokenId,
                team: team,
                source: 'admin_manual',
                timestamp: Date.now()
            })
        });
        
        if (response.ok) {
            this.logActivity({
                type: 'transaction',
                message: `Manual transaction: ${tokenId} for ${team}`
            });
            document.getElementById('manual-token').value = '';
        }
    }
    
    async adjustScore() {
        const team = document.getElementById('adjust-team').value;
        const amount = parseInt(document.getElementById('adjust-amount').value);
        const reason = document.getElementById('adjust-reason').value;
        
        if (!team || isNaN(amount) || !reason) {
            alert('Please fill all fields');
            return;
        }
        
        const response = await fetch('/api/admin/transaction/adjust', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                teamId: team,
                adjustment: amount,
                reason: reason
            })
        });
        
        if (response.ok) {
            this.logActivity({
                type: 'adjustment',
                message: `Score adjustment: ${team} ${amount > 0 ? '+' : ''}${amount} - ${reason}`
            });
            
            // Clear form
            document.getElementById('adjust-amount').value = '';
            document.getElementById('adjust-reason').value = '';
        }
    }
    
    // UI Updates
    updateSystemStatus(status) {
        const statusEl = document.getElementById('system-status');
        statusEl.className = `status-indicator ${status}`;
        
        const statusText = {
            'connected': 'System Online',
            'disconnected': 'System Offline',
            'error': 'System Error'
        };
        
        statusEl.querySelector('.status-text').textContent = statusText[status] || 'Unknown';
    }
    
    updateVideoStatus(status) {
        document.getElementById('video-status').textContent = status.playing ? 'Playing' : 'Idle';
        document.getElementById('video-name').textContent = status.currentVideo || 'None';
        document.getElementById('video-duration').textContent = status.duration || '--:--';
    }
    
    updateSessionInfo(session) {
        document.getElementById('session-id').textContent = session.id || '--';
        document.getElementById('session-start').textContent = 
            session.startTime ? new Date(session.startTime).toLocaleString() : '--';
        document.getElementById('transaction-count').textContent = session.transactionCount || 0;
        document.getElementById('player-count').textContent = session.playerCount || 0;
        document.getElementById('gm-count').textContent = session.gmCount || 0;
    }
    
    addDevice(device) {
        this.devices.set(device.id, device);
        this.renderDeviceList();
    }
    
    removeDevice(deviceId) {
        this.devices.delete(deviceId);
        this.renderDeviceList();
    }
    
    renderDeviceList() {
        const container = document.getElementById('device-list');
        container.innerHTML = '';
        
        this.devices.forEach(device => {
            const deviceEl = document.createElement('div');
            deviceEl.className = `device-card ${device.type}`;
            deviceEl.innerHTML = `
                <div class="device-type">${device.type}</div>
                <div class="device-id">${device.id}</div>
                <div class="device-status">${device.connected ? '🟢' : '🔴'}</div>
                <div class="device-last-seen">${new Date(device.lastSeen).toLocaleTimeString()}</div>
            `;
            container.appendChild(deviceEl);
        });
    }
    
    logActivity(event) {
        // Add to log array
        this.activityLog.unshift({
            ...event,
            timestamp: Date.now()
        });
        
        // Keep only last 100 events
        if (this.activityLog.length > 100) {
            this.activityLog.pop();
        }
        
        this.renderActivityLog();
    }
    
    renderActivityLog() {
        const container = document.getElementById('activity-log');
        const filter = document.getElementById('log-filter').value;
        
        container.innerHTML = '';
        
        this.activityLog
            .filter(event => filter === 'all' || event.type === filter)
            .forEach(event => {
                const logEl = document.createElement('div');
                logEl.className = `log-entry ${event.type}`;
                logEl.innerHTML = `
                    <span class="log-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span class="log-type">[${event.type}]</span>
                    <span class="log-message">${event.message}</span>
                `;
                container.appendChild(logEl);
            });
    }
    
    clearLog() {
        this.activityLog = [];
        this.renderActivityLog();
    }
    
    clearActivityLog() {
        this.activityLog = [];
        document.getElementById('activity-log').innerHTML = '';
    }
    
    // Data Loading
    async loadSessionData() {
        const response = await fetch('/api/admin/session/current', {
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            this.sessionData = await response.json();
            this.updateSessionInfo(this.sessionData);
        }
    }
    
    async loadTokenList() {
        const response = await fetch('/api/tokens', {
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            const tokens = await response.json();
            const select = document.getElementById('test-token');
            
            Object.entries(tokens).forEach(([id, token]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${id} - ${token.SF_MemoryType} (${token.SF_ValueRating})`;
                select.appendChild(option);
            });
        }
    }
    
    // Monitoring
    startMonitoring() {
        // Update device list every 5 seconds
        setInterval(() => {
            this.refreshDeviceList();
        }, 5000);
        
        // Update session info every 10 seconds
        setInterval(() => {
            this.loadSessionData();
        }, 10000);
    }
    
    async refreshDeviceList() {
        const response = await fetch('/api/admin/devices', {
            headers: this.getHeaders()
        });
        
        if (response.ok) {
            const devices = await response.json();
            this.devices.clear();
            devices.forEach(device => {
                this.devices.set(device.id, device);
            });
            this.renderDeviceList();
        }
    }
    
    // Utilities
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        };
    }
}

// Initialize admin controller
const adminControl = new AdminController();
```

## Part 6: Network Configuration (3 hours)

### 6.1 Router Setup (PRD lines 515-527)

Create `docs/NETWORK_SETUP.md`:
```markdown
# ALN Network Configuration Guide

## Router Configuration

### 1. Static IP Assignments
```
Device                  | IP Address      | MAC Address (if known)
------------------------|-----------------|----------------------
Orchestrator (Pi)       | 192.168.1.10   | [Pi MAC]
Projector/Display       | 192.168.1.11   | [Display MAC]
Admin Laptop            | 192.168.1.12   | [Admin MAC]
DHCP Pool (Players/GMs) | 192.168.1.100-200 | Dynamic
```

### 2. WiFi Settings
- **SSID**: ALN_GAME_NET
- **Password**: [Secure password - min 12 chars]
- **Security**: WPA2-PSK (WPA3 if all devices support)
- **Channel**: 6 (or use auto if no interference)
- **Band**: 2.4GHz only (for ESP32 compatibility)
- **Broadcast SSID**: Yes

### 3. Router Web Interface Steps
1. Access router at http://192.168.1.1
2. Navigate to LAN Settings → DHCP Server
3. Set DHCP range: 192.168.1.100 to 192.168.1.200
4. Add static reservations for orchestrator, projector, admin
5. Save and apply settings

### 4. Firewall Rules (Optional)
```
# Allow orchestrator communication
ALLOW TCP 3000 FROM 192.168.1.0/24 TO 192.168.1.10
ALLOW TCP 8080 FROM 192.168.1.10 TO 192.168.1.11 (VLC)

# Block internet access (optional for security)
DENY ALL FROM 192.168.1.0/24 TO WAN
```

## Raspberry Pi Network Configuration

### Static IP Setup
Edit `/etc/dhcpcd.conf`:
```bash
sudo nano /etc/dhcpcd.conf
```

Add:
```
interface wlan0
static ip_address=192.168.1.10/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

interface eth0
static ip_address=192.168.1.10/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### mDNS Service Advertisement (PRD lines 530-541)
Create `/home/pi/ALN-Ecosystem/backend/src/services/mdnsService.js`:
```javascript
import mdns from 'mdns';

export class MDNSService {
  constructor() {
    this.advertisement = null;
  }
  
  start(port = 3000) {
    try {
      this.advertisement = mdns.createAdvertisement(mdns.tcp('http'), port, {
        name: 'aln-orchestrator',
        txtRecord: {
          version: '1.0',
          api: '/api',
          admin: '/admin'
        }
      });
      
      this.advertisement.start();
      console.log('mDNS service advertising as aln-orchestrator.local');
    } catch (error) {
      console.error('mDNS advertisement failed:', error);
    }
  }
  
  stop() {
    if (this.advertisement) {
      this.advertisement.stop();
    }
  }
}
```

## Scanner Network Configuration

### Player Scanner (aln-memory-scanner)
1. Access scanner on device
2. Open settings/config menu
3. Set Orchestrator URL:
   - Primary: `http://aln-orchestrator.local:3000`
   - Fallback: `http://192.168.1.10:3000`
4. Save and reload

### GM Scanner (ALNScanner)
1. Access GM scanner interface
2. Navigate to Settings
3. Configure Orchestrator:
   - WebSocket URL: `ws://192.168.1.10:3000`
   - Station ID: Auto-generated or manual
4. Test connection
5. Save settings

### ESP32 Hardware Scanner
Update WiFi credentials in code:
```cpp
const char* ssid = "ALN_GAME_NET";
const char* password = "your_secure_password";
const char* orchestratorUrl = "http://192.168.1.10:3000";
```

## Troubleshooting

### Cannot Connect to Orchestrator
1. Verify Pi has correct IP: `ip addr show`
2. Check orchestrator is running: `sudo systemctl status aln-orchestrator`
3. Test connectivity: `ping 192.168.1.10`
4. Check firewall: `sudo ufw status`

### WebSocket Connection Fails
1. Verify CORS settings in backend
2. Check if port 3000 is open
3. Try direct IP instead of mDNS
4. Check browser console for errors

### Video Won't Play
1. Verify VLC is running: `ps aux | grep vlc`
2. Check VLC HTTP interface: `curl http://localhost:8080`
3. Verify video file exists in backend/videos/
4. Check orchestrator logs
```

### 6.2 VLC Configuration (PRD lines 238-243)

Create `scripts/setup-vlc.sh`:
```bash
#!/bin/bash

echo "Setting up VLC for ALN video playback..."

# Install VLC if not present
if ! command -v vlc &> /dev/null; then
    echo "Installing VLC..."
    sudo apt-get update
    sudo apt-get install -y vlc
fi

# Create VLC startup script
cat > /home/pi/start-vlc.sh << 'EOF'
#!/bin/bash

# Kill any existing VLC instances
pkill -f vlc

# Start VLC with HTTP interface (PRD lines 239-242)
cvlc \
    --intf http \
    --http-password aln2024 \
    --fullscreen \
    --no-video-title-show \
    --http-host 0.0.0.0 \
    --http-port 8080 \
    --loop \
    --playlist-autostart \
    --video-on-top \
    --no-video-deco \
    --no-embedded-video \
    --no-audio \
    &

echo "VLC started with HTTP interface on port 8080"
echo "Access at: http://localhost:8080"
echo "Password: aln2024"
EOF

chmod +x /home/pi/start-vlc.sh

# Create systemd service for VLC
sudo tee /etc/systemd/system/vlc-http.service > /dev/null << 'EOF'
[Unit]
Description=VLC HTTP Interface for ALN
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/home/pi/start-vlc.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vlc-http

echo "VLC setup complete!"
echo "Start VLC: sudo systemctl start vlc-http"
echo "Stop VLC: sudo systemctl stop vlc-http"
echo "Status: sudo systemctl status vlc-http"
```

## Part 7: Docker Deployment (Optional - 4 hours)

### 7.1 Docker Compose Configuration (PRD lines 849-874)

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  orchestrator:
    build: ./backend
    container_name: aln-orchestrator
    ports:
      - "3000:3000"
    volumes:
      - ./backend/videos:/app/videos
      - ./backend/sessions:/app/sessions
      - ./backend/storage:/app/storage
      - ./backend/logs:/app/logs
      - ./ALN-TokenData:/app/tokens:ro
    environment:
      - NODE_ENV=production
      - ADMIN_USERNAME=${ADMIN_USERNAME}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - VLC_HOST=vlc
      - VLC_PORT=8080
      - VLC_PASSWORD=${VLC_PASSWORD}
    depends_on:
      - vlc
    restart: unless-stopped
    networks:
      - aln-network

  vlc:
    image: flavioribeiro/docker-vlc:latest
    container_name: aln-vlc
    ports:
      - "8080:8080"
    volumes:
      - ./backend/videos:/videos:ro
    environment:
      - VLC_PASSWORD=${VLC_PASSWORD:-aln2024}
    command: >
      vlc 
      --intf http 
      --http-password ${VLC_PASSWORD:-aln2024}
      --http-host 0.0.0.0 
      --http-port 8080
      --fullscreen
      --no-video-title-show
      --loop
    restart: unless-stopped
    networks:
      - aln-network

networks:
  aln-network:
    driver: bridge
```

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p videos sessions storage logs

# Set permissions
RUN chmod -R 755 /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
CMD ["node", "src/server.js"]
```

Create `.env` for Docker:
```env
# Required secrets (no defaults)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
JWT_SECRET=your_random_jwt_secret_here

# VLC Configuration
VLC_PASSWORD=aln2024

# Network
ORCHESTRATOR_IP=192.168.1.10
```

### 7.2 Docker Commands

Create `scripts/docker-commands.sh`:
```bash
#!/bin/bash

case "$1" in
  start)
    echo "Starting ALN Orchestrator with Docker..."
    docker-compose up -d
    ;;
  
  stop)
    echo "Stopping ALN Orchestrator..."
    docker-compose down
    ;;
  
  restart)
    echo "Restarting ALN Orchestrator..."
    docker-compose restart
    ;;
  
  logs)
    docker-compose logs -f orchestrator
    ;;
  
  vlc-logs)
    docker-compose logs -f vlc
    ;;
  
  build)
    echo "Building Docker images..."
    docker-compose build --no-cache
    ;;
  
  status)
    docker-compose ps
    ;;
  
  backup)
    echo "Backing up session data..."
    tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" \
      backend/sessions \
      backend/storage \
      backend/logs
    ;;
  
  *)
    echo "Usage: $0 {start|stop|restart|logs|vlc-logs|build|status|backup}"
    exit 1
    ;;
esac
```

## Part 8: Testing Scenarios (6 hours)

### 8.1 Contract Tests (PRD spec requirement)

Create comprehensive contract tests:
```javascript
// backend/tests/contract/player-scanner-api.test.js
import request from 'supertest';
import { app } from '../../src/app.js';
import { testTokens } from '../fixtures/tokens.js';

describe('Player Scanner API Contract', () => {
  describe('POST /api/scan', () => {
    test('accepts video token scan', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send({
          tokenId: 'video_moment_001',
          deviceId: 'test_player_001',
          timestamp: Date.now()
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: expect.stringMatching(/playing|busy|queued/),
        message: expect.any(String)
      });
    });
    
    test('rejects when video playing', async () => {
      // Start first video
      await request(app)
        .post('/api/scan')
        .send({
          tokenId: 'video_moment_001',
          deviceId: 'test_player_001',
          timestamp: Date.now()
        });
      
      // Try second video
      const response = await request(app)
        .post('/api/scan')
        .send({
          tokenId: 'video_moment_002',
          deviceId: 'test_player_002',
          timestamp: Date.now()
        });
      
      expect(response.status).toBe(409);
      expect(response.body.status).toBe('busy');
    });
  });
});
```

### 8.2 Integration Tests (PRD lines 545-551)

Create `backend/tests/integration/end-to-end.test.js`:
```javascript
import { io } from 'socket.io-client';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('End-to-End Integration', () => {
  let gmClient;
  let server;
  
  beforeAll(async () => {
    server = app.listen(0);
    const port = server.address().port;
    
    gmClient = io(`http://localhost:${port}`, {
      query: { stationId: 'test_gm', type: 'gm_station' }
    });
    
    await new Promise(resolve => gmClient.on('connect', resolve));
  });
  
  afterAll(async () => {
    gmClient.disconnect();
    await new Promise(resolve => server.close(resolve));
  });
  
  test('Video Playback Flow', async (done) => {
    // GM listens for video event
    gmClient.on('video_started', (data) => {
      expect(data.token.SF_RFID).toBe('video_moment_001');
      done();
    });
    
    // Player scans video token
    await request(app)
      .post('/api/scan')
      .send({
        tokenId: 'video_moment_001',
        deviceId: 'test_player',
        timestamp: Date.now()
      });
  });
  
  test('Network Failure Recovery', async () => {
    // Disconnect GM
    gmClient.disconnect();
    
    // Add transaction while disconnected
    const txId = 'test_tx_001';
    
    // Reconnect
    gmClient.connect();
    
    // Request sync
    gmClient.emit('request_sync', { stationId: 'test_gm' });
    
    // Should receive state including missed transaction
    const stateSync = await new Promise(resolve => {
      gmClient.once('state_sync', resolve);
    });
    
    expect(stateSync.transactions).toBeDefined();
  });
  
  test('Score Calculation', async () => {
    // Add transactions
    const transactions = [
      { tokenId: 'token1', team: 'team1', value: 3 },
      { tokenId: 'token2', team: 'team1', value: 5 },
      { tokenId: 'token3', team: 'team2', value: 4 }
    ];
    
    for (const tx of transactions) {
      gmClient.emit('transaction', { type: 'transaction', transaction: tx });
    }
    
    // Wait for score update
    const scoreUpdate = await new Promise(resolve => {
      gmClient.once('state_update', resolve);
    });
    
    expect(scoreUpdate.scores).toContainEqual(
      expect.objectContaining({
        teamId: 'team1',
        totalScore: 8
      })
    );
  });
});
```

### 8.3 Performance Tests

Create `backend/tests/performance/load.test.js`:
```javascript
import autocannon from 'autocannon';
import { startServer } from '../../src/server.js';

describe('Performance Requirements', () => {
  let server;
  let url;
  
  beforeAll(async () => {
    server = await startServer({ port: 0 });
    const port = server.address().port;
    url = `http://localhost:${port}`;
  });
  
  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });
  
  test('NFR-001: API responds within 100ms', async () => {
    const result = await autocannon({
      url: `${url}/api/status`,
      duration: 10,
      connections: 10
    });
    
    expect(result.latency.mean).toBeLessThan(100);
    expect(result.latency.p99).toBeLessThan(200);
  });
  
  test('NFR-002: Handles 15 concurrent connections', async () => {
    const result = await autocannon({
      url: `${url}/api/scan`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: 'test',
        deviceId: 'perf_test',
        timestamp: Date.now()
      }),
      duration: 10,
      connections: 15
    });
    
    expect(result.errors).toBe(0);
    expect(result.non2xx).toBe(0);
  });
});
```

## Part 9: Development Workflow (PRD lines 789-823)

### 9.1 Development Setup

Create `scripts/dev-setup.sh`:
```bash
#!/bin/bash

echo "Setting up ALN development environment..."

# Clone with submodules
git clone --recurse-submodules https://github.com/[username]/ALN-Ecosystem.git
cd ALN-Ecosystem

# Update all submodules
git submodule update --init --recursive

# Install backend dependencies
cd backend
npm install

# Copy environment template
cp .env.example .env
echo "Please edit backend/.env with your configuration"

# Create necessary directories
mkdir -p videos sessions storage logs

# Install git hooks
cat > ../.git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Run tests before commit
cd backend
npm test
EOF
chmod +x ../.git/hooks/pre-commit

echo "Development environment ready!"
echo "Start backend: cd backend && npm run dev"
echo "Run tests: cd backend && npm test"
```

### 9.2 Submodule Workflow (PRD lines 791-807)

Create `docs/DEVELOPMENT_WORKFLOW.md`:
```markdown
# ALN Development Workflow

## Working with Submodules

### Initial Setup
```bash
# Clone entire ecosystem with submodules
git clone --recurse-submodules https://github.com/[username]/ALN-Ecosystem.git

# If already cloned without submodules
git submodule update --init --recursive
```

### Updating Token Data
```bash
# Navigate to token data
cd ALN-TokenData

# Make changes to tokens.json
vim tokens.json

# Commit and push
git add tokens.json
git commit -m "Add new video tokens"
git push

# Update parent repository reference
cd ..
git add ALN-TokenData
git commit -m "Update token data submodule"
git push
```

### Working on Scanners
```bash
# Navigate to scanner
cd aln-memory-scanner

# Switch to feature branch
git checkout -b feature/orchestrator-integration

# Make changes
vim js/orchestratorIntegration.js

# Commit and push
git add .
git commit -m "Add orchestrator integration"
git push -u origin feature/orchestrator-integration

# Update parent reference
cd ..
git add aln-memory-scanner
git commit -m "Update scanner submodule"
```

### Pulling Updates
```bash
# Update all submodules to latest
git submodule update --remote --merge

# Or update specific submodule
git submodule update --remote ALN-TokenData
```

## Development Commands

### Backend Development
```bash
# Start development server with hot reload
npm run dev

# Run all tests
npm test

# Run specific test suite
npm test:contract
npm test:integration
npm test:unit

# Check code quality
npm run lint
npm run format

# Clear storage/sessions
npm run storage:clear
```

### Scanner Development
```bash
# Player Scanner (PWA)
cd aln-memory-scanner
python -m http.server 8000
# Access at http://localhost:8000

# GM Scanner
cd ALNScanner  
python -m http.server 8001
# Access at http://localhost:8001
```

### ESP32 Development
```bash
cd hardware/esp32

# Build
pio run

# Upload
pio run --target upload

# Monitor serial
pio device monitor

# Upload filesystem
pio run --target uploadfs
```

## Testing Workflow

### Before Committing
1. Run unit tests: `npm test:unit`
2. Run integration tests: `npm test:integration`
3. Check linting: `npm run lint`
4. Test locally with all components

### Full System Test
1. Start orchestrator: `npm start`
2. Start VLC: `./start-vlc.sh`
3. Open player scanner: http://localhost:8000
4. Open GM scanner: http://localhost:8001
5. Open admin panel: http://localhost:3000/admin
6. Test video playback flow
7. Test offline/reconnection
8. Test score synchronization

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Token data updated in all submodules
- [ ] CORS origins configured for production URLs
- [ ] Admin password changed from default
- [ ] JWT secret generated

### Deployment Steps
1. Push all changes to GitHub
2. Update submodules on Pi: `git submodule update --remote`
3. Install/update dependencies: `npm ci`
4. Restart services: `sudo systemctl restart aln-orchestrator`
5. Verify VLC running: `sudo systemctl status vlc-http`
6. Test from scanner devices

### Post-deployment
- [ ] Test player scanner from mobile device
- [ ] Test GM scanner from tablet
- [ ] Verify video playback works
- [ ] Check WebSocket connections
- [ ] Monitor logs: `journalctl -u aln-orchestrator -f`
```

## Success Criteria - Complete Checklist

### Architecture & Submodules ✅
- [ ] ALN-TokenData configured as submodule in ALN-Ecosystem
- [ ] aln-memory-scanner configured as submodule
- [ ] ALNScanner configured as submodule  
- [ ] Nested submodules properly configured
- [ ] Backend loads tokens from ALN-TokenData submodule
- [ ] NO hard-coded tokens in backend

### Token Support ✅
- [ ] Video field added to token schema
- [ ] ProcessingImage field added
- [ ] At least 3 video tokens defined
- [ ] Player scanner detects video tokens
- [ ] GM scanner receives video notifications

### Player Scanner Integration ✅
- [ ] Orchestrator client implemented
- [ ] Video token detection works
- [ ] Offline queue with 100 limit
- [ ] Auto-retry every 30 seconds
- [ ] Connection status indicator
- [ ] Processing screen displays

### GM Scanner Integration ✅
- [ ] WebSocket client implemented
- [ ] State synchronization works
- [ ] Transaction queueing when offline
- [ ] Video playback indicator
- [ ] Admin controls functional
- [ ] Duplicate detection works

### ESP32 Hardware ✅
- [ ] Token detection via SD card markers
- [ ] HTTP POST to orchestrator
- [ ] Power management implemented
- [ ] Processing image display
- [ ] Deep sleep between scans

### Admin Interface ✅
- [ ] Authentication required
- [ ] Video control (stop/skip/test)
- [ ] Session management
- [ ] Device monitoring
- [ ] Activity logging
- [ ] Manual controls

### Network & Deployment ✅
- [ ] Static IP configuration
- [ ] mDNS service advertisement
- [ ] GitHub Pages deployment
- [ ] CORS properly configured
- [ ] VLC HTTP interface working
- [ ] Docker option available

### Testing ✅
- [ ] Contract tests passing
- [ ] Integration tests passing
- [ ] Performance requirements met
- [ ] End-to-end flow validated
- [ ] Network resilience tested
- [ ] Load testing completed

### Documentation ✅
- [ ] Network setup guide
- [ ] Development workflow
- [ ] Deployment instructions
- [ ] ESP32 setup guide
- [ ] Admin interface guide

## Total Implementation Time: 48 hours

### Detailed Breakdown:
1. **Git Submodules & Backend Fix**: 4 hours (CRITICAL PATH)
2. **Token Schema Updates**: 2 hours
3. **Player Scanner Integration**: 10 hours
4. **GM Scanner Integration**: 12 hours
5. **ESP32 Implementation**: 8 hours
6. **Admin Interface**: 6 hours
7. **Network Configuration**: 3 hours
8. **Testing & Deployment**: 6 hours
9. **Docker Setup** (optional): 4 hours

## Implementation Priority Order

### Phase 1: Foundation (Day 1 - 6 hours)
1. Configure git submodules (2 hours)
2. Fix backend token loading (2 hours)
3. Update token schema (2 hours)

### Phase 2: Scanner Integration (Day 2-3 - 22 hours)
4. Player scanner orchestrator client (10 hours)
5. GM scanner WebSocket client (12 hours)

### Phase 3: Hardware & Admin (Day 4 - 14 hours)
6. ESP32 implementation (8 hours)
7. Admin interface enhancements (6 hours)

### Phase 4: Deployment & Testing (Day 5 - 6 hours)
8. Network configuration (3 hours)
9. Testing and validation (3 hours)

---

*This complete addendum provides ALL implementation details for the ALN Video Playback & State Synchronization System, following the original PRD architecture and constitutional principles.*