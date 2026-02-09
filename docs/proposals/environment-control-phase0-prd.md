# PRD: Venue Environment Control Foundation (Phase 0)

## Document Overview

**Project**: About Last Night (ALN) Ecosystem
**Feature**: Bluetooth Audio + Lighting Scene Control
**Version**: 2.0
**Date**: February 2026
**Status**: Draft — Pending Review

---

## 1. Objective

Establish foundational infrastructure for venue environment control in the ALN orchestrator:

1. **Bluetooth speaker** discovery, pairing, and connection management
2. **Video audio routing** between HDMI and Bluetooth via PipeWire
3. **Lighting scene control** via Home Assistant integration
4. **Admin panel UI** for speaker management, audio output selection, and scene triggering

This phase provides the plumbing. It does **NOT** include ambient soundscapes, audio cues, attention sounds, or automated game-event-to-lighting triggers — only the manual controls required for a GM to manage venue audio and lighting during a session.

---

## 2. Success Criteria

| Criteria | Measurement |
|----------|-------------|
| GM can discover nearby Bluetooth speakers from admin panel | Speaker appears in list within 30s |
| GM can pair with a speaker | Pairing completes via "Just Works" SSP |
| GM can connect/disconnect paired speakers | State changes within 10s |
| GM can select video audio output (HDMI/Bluetooth) | Selection persists across videos and backend restarts |
| Video plays with audio to selected output | Audio audible on correct device |
| Speaker disconnection is handled gracefully | Falls back to HDMI with warning toast |
| GM can see available HA lighting scenes | Scenes listed within 5s of panel load |
| GM can trigger a lighting scene with one tap | Scene activates within 1s |
| System works without Home Assistant present | Audio fully functional; lighting shows "not connected" |

---

## 3. User Stories

### 3.1 Bluetooth Speaker Management

**US-BT-001**: As a GM, I want to scan for nearby Bluetooth speakers so I can find available speakers to connect.

**US-BT-002**: As a GM, I want to pair with a new speaker from the admin panel so I don't need SSH access to the Pi.

**US-BT-003**: As a GM, I want to see which speakers are paired (saved) so I know what's available.

**US-BT-004**: As a GM, I want to connect to a paired speaker with one tap so I can set up quickly.

**US-BT-005**: As a GM, I want to disconnect a speaker so I can switch to a different one.

**US-BT-006**: As a GM, I want to remove (unpair) a speaker I no longer use so the list stays clean.

**US-BT-007**: As a GM, I want to see real-time connection status so I know if a speaker drops.

### 3.2 Video Audio Routing

**US-AV-001**: As a GM, I want to select whether video audio plays through HDMI or a connected Bluetooth speaker.

**US-AV-002**: As a GM, I want the system to fall back to HDMI if no Bluetooth speakers are connected.

**US-AV-003**: As a GM, I want a warning when Bluetooth is selected but no speakers are connected.

### 3.3 Lighting Scene Control

**US-LT-001**: As a GM, I want to see a list of available lighting scenes so I can choose the right mood.

**US-LT-002**: As a GM, I want to trigger a lighting scene with one tap.

**US-LT-003**: As a GM, I want to see which scene is currently active.

**US-LT-004**: As a GM, I want lighting to degrade gracefully if Home Assistant is unavailable.

---

## 4. Technology Choices

### 4.1 Decision Summary

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Bluetooth management | `bluetoothctl` CLI via `child_process.execFile()` | First-party BlueZ tool; ships with RPi OS; zero npm deps; stable across BlueZ 5.x |
| Audio sink routing | `pactl` CLI via `child_process.execFile()` | First-party PipeWire tool (via pipewire-pulse); `move-sink-input` for per-app routing; tab-delimited output |
| Sink event monitoring | `pactl subscribe` via `child_process.spawn()` | Real-time new/removed sink detection |
| Lighting control | Home Assistant REST API via `fetch()`/`axios` | Supports thousands of device types; built-in scene editor; no per-protocol code |
| Node.js ↔ system | `child_process` (built-in) | Standard Node.js, well-understood, no exotic deps |

### 4.2 What We Explicitly Chose NOT to Use and Why

| Rejected Option | Reason |
|----------------|--------|
| `node-bluez` / `bluez` npm (`^0.6.0`) | Version doesn't exist. Latest is 0.4.5, last published 4 years ago. Native C++ `dbus` dependency. |
| `dbus-next` direct D-Bus | Unmaintained (last commit Feb 2023). `ObjectManager` not implemented — required for device discovery. |
| `bluetooth-autoconnect` | Unvetted third-party GitHub script. WirePlumber already handles auto-reconnect for trusted devices. |
| WLED / Zigbee2MQTT direct | Locks hardware purchases to one protocol. HA abstracts device types — buy whatever's well-priced. |
| Home Assistant for BT audio | HA can't do A2DP speaker management (confirmed via research — community hacks only, not native). |

---

## 5. System Setup (One-Time Pi Configuration)

These steps must be completed on the Pi before any development begins. They have strict dependencies — follow in order.

### 5.0 Current System State (Verified 2026-02-08)

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Debian Bookworm (RPi OS) | Installed | None |
| Pi 5, 8GB RAM | 6.4GB available | None |
| Node.js 22.20.0 | Installed | None |
| PM2 6.0.13 | Installed | None |
| BlueZ 5.66 | Installed, service active | **Adapter powered off** |
| PipeWire 1.2.7 | Running (pipewire + pipewire-pulse + wireplumber) | None |
| `libspa-0.2-bluetooth` | Installed | None |
| `pulseaudio-utils` (provides `pactl`) | Installed | None |
| VLC 3.0.23 | Installed, PM2 config uses `-A pulse` | None |
| HDMI force hotplug | Configured in boot config | None (Dummy Output expected when no display) |
| Docker | **NOT installed** | Install |
| Home Assistant | **NOT installed** | Install after Docker |
| WirePlumber BT config | **No custom config** | Create A2DP-only override |
| Bluetooth adapter | **Powered: no** | Enable AutoEnable |

### 5.1 Enable Bluetooth Adapter Auto-Power

**Depends on**: Nothing
**Why**: The adapter is currently off (`Powered: no`). Without `AutoEnable=true`, it stays off after every reboot.

```bash
# Edit BlueZ main config
sudo nano /etc/bluetooth/main.conf

# Uncomment and set:
AutoEnable=true
```

```bash
# Restart bluetooth service
sudo systemctl restart bluetooth
```

**Verify:**
```bash
bluetoothctl show | grep Powered
# Expected: Powered: yes
```

### 5.2 Create WirePlumber A2DP-Only Config

**Depends on**: Nothing (can run in parallel with 5.1)
**Why**: Prevents WirePlumber from switching connected speakers to low-quality HFP/HSP (headset) profiles. Forces A2DP (high-quality audio) only.

```bash
# Create override directory (doesn't exist yet)
sudo mkdir -p /etc/wireplumber/wireplumber.conf.d
```

```bash
# Create A2DP-only config
sudo tee /etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf << 'EOF'
monitor.bluez.properties = {
  # Only enable A2DP sink role (no HSP/HFP headset profiles)
  bluez5.roles = [ a2dp_sink ]

  # Enable hardware volume control on speaker
  bluez5.hw-volume = [ a2dp_sink ]

  # Auto-connect trusted A2DP devices
  bluez5.auto-connect = [ a2dp_sink ]
}

# Disable automatic profile switching to headset mode
wireplumber.settings = {
  bluetooth.autoswitch-to-headset-profile = false
}
EOF
```

```bash
# Restart WirePlumber to pick up new config
systemctl --user restart wireplumber
```

**Verify:**
```bash
# Config file exists and is readable
cat /etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf
# WirePlumber is running
systemctl --user is-active wireplumber
# Expected: active
```

Full verification requires connecting a BT speaker (see Step 5.3).

### 5.3 Verify Bluetooth Speaker Pairing (Manual Smoke Test)

**Depends on**: Adapter powered on (5.1), WirePlumber config (5.2)
**Why**: Validates the entire BT audio chain before writing any code. Do this NOW — before spending time on Docker/HA.

```bash
# 1. Put your Bluetooth speaker in pairing mode

# 2. Scan for devices (15 second timeout)
bluetoothctl --timeout 15 scan on

# 3. Find your speaker in the output, note its MAC address
bluetoothctl devices

# 4. Check it's an audio device
bluetoothctl info AA:BB:CC:DD:EE:FF | grep -i "uuid\|audio\|sink"
# Expected: UUID line containing "Audio Sink" or "0000110b"

# 5. Pair and trust
bluetoothctl --agent NoInputNoOutput pair AA:BB:CC:DD:EE:FF
bluetoothctl trust AA:BB:CC:DD:EE:FF

# 6. Connect
bluetoothctl connect AA:BB:CC:DD:EE:FF
# Expected: "Connection successful"

# 7. Verify BT sink appeared in PipeWire
pactl list sinks short
# Expected: A line containing "bluez_output.AA_BB_CC_DD_EE_FF" with state IDLE or RUNNING

# 8. Test audio (optional)
speaker-test -D bluez_output.AA_BB_CC_DD_EE_FF.1 -c 2 -t sine -l 1 2>/dev/null || \
  paplay --device=bluez_output.AA_BB_CC_DD_EE_FF.1 /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null || \
  echo "Audio test tools not available — test with VLC instead"

# 9. Verify A2DP profile (not HSP/HFP)
pactl list sinks | grep -A5 "bluez_output" | grep "Description\|sample spec"
# Expected: 44100Hz or 48000Hz stereo (A2DP), NOT 8000Hz mono (HSP)

# 10. Disconnect (cleanup)
bluetoothctl disconnect AA:BB:CC:DD:EE:FF
```

If any step fails, resolve before proceeding.

### 5.4 Install Docker

**Depends on**: Nothing (can run in parallel with 5.1–5.3)
**Why**: Home Assistant runs in Docker.

```bash
# Install Docker using official convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

```bash
# Add user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker maxepunk
```

```bash
# Apply group change (either log out/in, or use newgrp for current session)
newgrp docker
```

**Verify:**
```bash
docker --version
# Expected: Docker version 2X.X.X
docker run --rm hello-world
# Expected: "Hello from Docker!" message
```

### 5.5 Deploy Home Assistant

**Depends on**: Docker installed (5.4)
**Why**: HA manages lighting devices and scenes. Our backend calls its REST API.

```bash
# Create persistent config directory
sudo mkdir -p /opt/homeassistant
sudo chown maxepunk:maxepunk /opt/homeassistant
```

```bash
# Start Home Assistant container
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -v /opt/homeassistant:/config \
  -v /run/dbus:/run/dbus:ro \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

Notes:
- `--network=host` lets HA discover devices on the local network (WLED, etc.)
- `-v /run/dbus:/run/dbus:ro` gives HA read access to D-Bus (for Bluetooth discovery if needed later)
- `--privileged` required for USB device access (Zigbee dongles, etc.)
- `--restart=unless-stopped` survives reboots
- First startup takes 1-2 minutes to initialize

**Verify:**
```bash
# Container is running
docker ps | grep homeassistant
# Expected: status "Up X minutes"

# HA web interface is accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:8123
# Expected: 200 (may take 1-2 min after first start)
```

### 5.6 Configure Home Assistant

**Depends on**: HA running (5.5)
**Why**: HA needs initial setup, device integrations, scenes, and an API token before the backend can use it.

This is done via the HA web UI — not scriptable.

**Step 5.6a: Onboarding**
1. Open `http://<pi-ip>:8123` in a browser
2. Create admin account (remember credentials)
3. Set location, timezone, unit system
4. Complete onboarding wizard

**Step 5.6b: Add Device Integrations**
1. Go to Settings → Devices & Services → Add Integration
2. Add integrations for whatever lighting hardware you've purchased:
   - **WLED** (for ESP32 LED strips): Auto-discovered if on same network
   - **Zigbee Home Automation (ZHA)** or **Zigbee2MQTT**: If using Zigbee bulbs with a USB dongle
   - **Tuya** / **TP-Link Kasa** / **LIFX** / **Govee**: For WiFi bulbs (varies by brand)
3. Pair/discover devices through each integration's setup flow

**Step 5.6c: Create Scenes**
1. Go to Settings → Automations & Scenes → Scenes
2. Create scenes for key game moments, e.g.:
   - `scene.interrogation_red` — dim, red accent lighting
   - `scene.reveal_bright` — full brightness, cool white
   - `scene.suspense_low` — very dim, warm
   - `scene.blackout` — all lights off
   - `scene.house_lights` — normal pre/post-game lighting
3. Each scene captures the state of all included lights (color, brightness, on/off)

**Step 5.6d: Generate Long-Lived Access Token**
1. Click your user profile (bottom-left)
2. Scroll to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Name it `aln-backend`
5. Copy the token immediately (it's only shown once)

**Verify:**
```bash
# Test API access with the token
curl -s -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:8123/api/ | head -20
# Expected: {"message": "API running."}

# List scenes
curl -s -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:8123/api/states | python3 -c "
import json, sys
states = json.load(sys.stdin)
scenes = [s for s in states if s['entity_id'].startswith('scene.')]
for s in scenes:
    print(f\"  {s['entity_id']}: {s['attributes'].get('friendly_name', 'unnamed')}\")"
# Expected: List of your created scenes
```

### 5.7 Configure Backend Environment

**Depends on**: HA token generated (5.6d)

Add to `backend/.env`:
```env
# Bluetooth
BLUETOOTH_SCAN_TIMEOUT_SEC=15
BLUETOOTH_CONNECT_TIMEOUT_SEC=10

# Audio Routing
AUDIO_DEFAULT_OUTPUT=hdmi

# Lighting (Home Assistant)
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=<paste your long-lived token here>
LIGHTING_ENABLED=true
```

**Verify:**
```bash
# Token is set (non-empty)
grep HOME_ASSISTANT_TOKEN backend/.env | grep -v "^#" | grep -v "=$"
```

---

## 6. Technical Architecture

### 6.1 System Context

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR (Pi 5)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────┐  ┌───────────────────┐  ┌──────────────────┐         │
│  │  vlcService    │  │ bluetoothService  │  │ lightingService  │         │
│  │  (existing)    │  │ (NEW)             │  │ (NEW)            │         │
│  │                │  │                   │  │                  │         │
│  │  VLC HTTP API  │  │ bluetoothctl CLI  │  │ HA REST API      │         │
│  │  via axios     │  │ via execFile()    │  │ via fetch/axios  │         │
│  └───────┬────────┘  └────────┬──────────┘  └───────┬──────────┘         │
│          │                    │                      │                    │
│          │           ┌────────┴──────────┐           │                    │
│          │           │audioRoutingService│           │                    │
│          │           │ (NEW)             │           │                    │
│          │           │                   │           │                    │
│          │           │ pactl CLI         │           │                    │
│          │           │ via execFile()    │           │                    │
│          │           │ + spawn() monitor │           │                    │
│          │           └────────┬──────────┘           │                    │
│          │                    │                      │                    │
│          ▼                    ▼                      ▼                    │
│  ┌────────────────────────────────────┐  ┌───────────────────────┐       │
│  │         PipeWire 1.2.7             │  │   Home Assistant      │       │
│  │         (pipewire-pulse)           │  │   (Docker container)  │       │
│  │                                    │  │                       │       │
│  │  ┌────────────┐ ┌──────────────┐   │  │ Scenes → Any device:  │       │
│  │  │ HDMI Sink  │ │ BT A2DP Sink │   │  │  WLED, Zigbee, WiFi  │       │
│  │  │ alsa_*hdmi*│ │ bluez_output*│   │  │  bulbs, strips, etc  │       │
│  │  └────────────┘ └──────────────┘   │  └───────────────────────┘       │
│  └────────────────────────────────────┘                                   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 New Backend Services

All services follow the existing pattern: `module.exports = new ServiceClass()` with EventEmitter.

#### 6.2.1 bluetoothService.js

**Location**: `backend/src/services/bluetoothService.js`
**Dependencies**: `child_process` (built-in)

Each method calls `bluetoothctl` as a one-shot command via `execFile()`. Clean text output (no ANSI codes) for one-shot commands. Scan uses `--timeout` flag. Pairing uses `--agent NoInputNoOutput`.

```javascript
class BluetoothService extends EventEmitter {
  // Discovery
  async startScan(timeoutSec = 15) {}   // bluetoothctl --timeout N scan on
  async getDiscoveredDevices() {}        // bluetoothctl devices → filter A2DP via info
  isScanning() {}

  // Pairing (pair + trust in one call)
  async pairDevice(address) {}           // --agent NoInputNoOutput pair + trust
  async unpairDevice(address) {}         // bluetoothctl remove
  async getPairedDevices() {}            // bluetoothctl devices Paired → filter A2DP

  // Connection
  async connectDevice(address) {}        // bluetoothctl connect
  async disconnectDevice(address) {}     // bluetoothctl disconnect
  async getConnectedDevices() {}         // bluetoothctl devices Connected → filter A2DP

  // Device info
  async getDeviceInfo(address) {}        // bluetoothctl info → parse key:value pairs
  async isAudioDevice(address) {}        // Check UUIDs for 0000110b (Audio Sink)

  // Adapter status
  async getAdapterStatus() {}            // bluetoothctl show
  async isAvailable() {}                 // Adapter exists and Powered: yes

  // Lifecycle
  async init() {}
  cleanup() {}
  reset() {}
}

// Events:
// 'device:connected', 'device:disconnected', 'device:paired', 'device:unpaired'
// 'scan:started', 'scan:stopped'
// 'error'
```

**Output parsing patterns:**

```javascript
// "Device AA:BB:CC:DD:EE:FF Speaker Name" → {address, name}
const DEVICE_LINE = /^Device ([0-9A-Fa-f:]{17}) (.+)$/;

// bluetoothctl info → tab-indented "Key: Value" pairs
// Check for Audio Sink UUID: line containing '0000110b'
```

**Scan handling:**
```javascript
async startScan(timeoutSec = 15) {
  // --timeout causes exit after N seconds
  this._scanProc = execFile('bluetoothctl',
    ['--timeout', String(timeoutSec), 'scan', 'on'],
    { timeout: (timeoutSec + 5) * 1000 }
  );
  this._scanProc.on('exit', () => { this._scanProc = null; this.emit('scan:stopped'); });
  this.emit('scan:started');
}
```

#### 6.2.2 audioRoutingService.js

**Location**: `backend/src/services/audioRoutingService.js`
**Dependencies**: `child_process` (built-in), `node-persist` (already in project for preference storage)

```javascript
class AudioRoutingService extends EventEmitter {
  // Sink discovery
  async getAvailableSinks() {}        // pactl list sinks short → tab-delimited
  async getBluetoothSink() {}         // First sink matching bluez_output.*
  async getHdmiSink() {}              // First sink matching *hdmi*

  // Video audio routing
  async setVideoAudioOutput(output) {}  // 'hdmi' | 'bluetooth'; persists via node-persist
  getVideoAudioOutput() {}              // Returns stored preference
  async applyRouting() {}               // Find VLC sink-input, move to target sink

  // VLC stream management (internal)
  async findVlcSinkInput() {}         // pactl list sink-inputs → find "VLC media player"
  async moveStreamToSink(idx, sink) {}  // pactl move-sink-input <idx> <sink>

  // Monitoring
  startSinkMonitor() {}               // spawn('pactl', ['subscribe']) — long-lived
  stopSinkMonitor() {}

  // Status
  getRoutingStatus() {}               // {videoOutput, btSinkAvailable, hdmiSinkAvailable}

  // Lifecycle
  async init() {}
  cleanup() {}
  reset() {}
}

// Events:
// 'sink:added', 'sink:removed'    — {name, type: 'hdmi'|'bluetooth'|'other'}
// 'routing:changed'               — {videoOutput, sink}
// 'routing:fallback'              — {reason, from, to}
```

**pactl output formats:**

```
# pactl list sinks short (tab-delimited):
47  alsa_output.platform-fef00700.hdmi.hdmi-stereo  PipeWire  s32le 2ch 48000Hz  RUNNING
89  bluez_output.AA_BB_CC_DD_EE_FF.1                PipeWire  s16le 2ch 44100Hz  IDLE

# pactl subscribe (line-based events):
Event 'new' on sink #89
Event 'remove' on sink #89
```

**Sink detection:**
```javascript
function classifySink(name) {
  if (name.startsWith('bluez_output.')) return 'bluetooth';
  if (name.includes('hdmi')) return 'hdmi';
  return 'other';
}
```

**VLC routing timing:** VLC registers its sink-input with PipeWire shortly after playback starts. `applyRouting()` retries `findVlcSinkInput()` with short backoff (100ms intervals, up to 2s) to handle this delay.

**Preference persistence:** Audio output preference is stored via `node-persist` (already a project dependency). Survives backend restarts. Defaults to `'hdmi'`.

#### 6.2.3 lightingService.js

**Location**: `backend/src/services/lightingService.js`
**Dependencies**: `axios` (already in project)

```javascript
class LightingService extends EventEmitter {
  // Scene control
  async getScenes() {}                // GET /api/states → filter scene.* entities
  async activateScene(sceneId) {}     // POST /api/services/scene/turn_on
  getActiveScene() {}                 // Last-activated scene ID
  getCachedScenes() {}                // Returns cached scene list

  // Connection
  async checkConnection() {}          // GET /api/ (ping)
  isConnected() {}
  async refreshScenes() {}            // Re-fetch scene list from HA

  // Lifecycle
  async init() {}                     // Non-blocking — HA may not be available
  cleanup() {}
  reset() {}
}

// Events:
// 'scene:activated'      — {sceneId, sceneName}
// 'connection:changed'   — {connected: boolean}
// 'error'                — {code, message}
```

**HA REST API calls:**
```javascript
// All requests use the same auth header
const headers = { 'Authorization': `Bearer ${config.lighting.homeAssistantToken}` };

// List scenes: GET /api/states → filter entity_id starting with "scene."
// Activate scene: POST /api/services/scene/turn_on
//   body: { entity_id: "scene.interrogation_red" }
```

**Graceful degradation:** If HA is unreachable at init, `isConnected()` returns false, scene list is empty, lighting section in admin panel shows "not connected". All other features work normally. Periodic reconnect attempts (every 30s) when disconnected.

### 6.3 Modifications to Existing Components

#### 6.3.1 adminEvents.js — New gm:command Actions

Add to the existing switch statement in `handleGmCommand`:

```javascript
// Bluetooth
case 'bluetooth:scan:start':
case 'bluetooth:scan:stop':
case 'bluetooth:pair':        // payload: {address}
case 'bluetooth:unpair':      // payload: {address}
case 'bluetooth:connect':     // payload: {address}
case 'bluetooth:disconnect':  // payload: {address}

// Audio routing
case 'audio:output:set':      // payload: {output: 'hdmi'|'bluetooth'}

// Lighting
case 'lighting:scene:activate':  // payload: {sceneId}
case 'lighting:scenes:refresh':
```

#### 6.3.2 broadcasts.js — Event Bridges

Bridge service events to WebSocket. All new events broadcast to GM room only (not all clients):

```javascript
// Bluetooth → 'bluetooth:device', 'bluetooth:scan'
// Audio    → 'audio:routing', 'audio:routing:fallback'
// Lighting → 'lighting:scene', 'lighting:status'
```

#### 6.3.3 stateService.js — State Additions

Add `bluetooth`, `audio`, and `lighting` objects to computed state. These are included in `sync:full` payloads so the GM Scanner has full state on connect/reconnect.

#### 6.3.4 vlcService.js — Audio Routing Hook

After `playVideo()` confirms playback started, call `audioRoutingService.applyRouting()`. This finds VLC's PipeWire sink-input and moves it to the correct sink (HDMI or Bluetooth).

Note: VLC is managed by PM2 with `-A pulse`, so its audio goes through `pipewire-pulse`. The `pactl move-sink-input` command works on this stream.

#### 6.3.5 server.js — Service Initialization

Add new services to `initializeServices()`:
```javascript
await bluetoothService.init();        // Check adapter, may warn if unavailable
await audioRoutingService.init();     // Start sink monitor, load persisted preference
await lightingService.init();         // Non-blocking HA connection check
```

#### 6.3.6 orchestratorClient.js — CRITICAL: messageTypes Update

New WebSocket event types MUST be added to the `messageTypes` array in `ALNScanner/src/network/orchestratorClient.js`. Without this, events are silently dropped:

```javascript
const messageTypes = [
  // ... all existing types ...
  'bluetooth:device',
  'bluetooth:scan',
  'audio:routing',
  'audio:routing:fallback',
  'lighting:scene',
  'lighting:status',
];
```

#### 6.3.7 config/index.js — New Config Sections

```javascript
bluetooth: {
  scanTimeout: parseInt(process.env.BLUETOOTH_SCAN_TIMEOUT_SEC, 10) || 15,
  connectTimeout: parseInt(process.env.BLUETOOTH_CONNECT_TIMEOUT_SEC, 10) || 10,
},
audio: {
  defaultOutput: process.env.AUDIO_DEFAULT_OUTPUT || 'hdmi',
},
lighting: {
  enabled: process.env.LIGHTING_ENABLED !== 'false',
  homeAssistantUrl: process.env.HOME_ASSISTANT_URL || 'http://localhost:8123',
  homeAssistantToken: process.env.HOME_ASSISTANT_TOKEN || '',
}
```

### 6.4 AsyncAPI Contract Additions

**Per project conventions, contracts are updated FIRST (before implementation).**

Add to `backend/contracts/asyncapi.yaml`:

**Server → Client events:**
- `bluetooth:device` — `{type: connected|disconnected|paired|unpaired, device: {address, name}}`
- `bluetooth:scan` — `{scanning: boolean}`
- `audio:routing` — `{videoOutput: hdmi|bluetooth, sink?: string}`
- `audio:routing:fallback` — `{reason, from, to}`
- `lighting:scene` — `{sceneId, sceneName?}`
- `lighting:status` — `{connected: boolean}`

**Client → Server commands (gm:command payloads):**
- `bluetooth:scan:start` — `{timeout?: integer}`
- `bluetooth:scan:stop` — `{}`
- `bluetooth:pair` — `{address: string}` (required)
- `bluetooth:unpair` — `{address: string}` (required)
- `bluetooth:connect` — `{address: string}` (required)
- `bluetooth:disconnect` — `{address: string}` (required)
- `audio:output:set` — `{output: 'hdmi'|'bluetooth'}` (required)
- `lighting:scene:activate` — `{sceneId: string}` (required)
- `lighting:scenes:refresh` — `{}`

### 6.5 GM Scanner Components

All controllers follow the **VideoController pattern**: stateless command senders via `CommandSender.sendCommand()`. No persistent listeners, minimal destroy.

State display is handled by **MonitoringDisplay** (existing broadcast listener pattern).

#### BluetoothController.js

`ALNScanner/src/admin/BluetoothController.js` — One method per user story, each calls `sendCommand()`.

Methods: `startScan()`, `stopScan()`, `pairDevice(address)`, `unpairDevice(address)`, `connectDevice(address)`, `disconnectDevice(address)`

#### AudioController.js

`ALNScanner/src/admin/AudioController.js`

Methods: `setVideoOutput(output)` — `'hdmi'` | `'bluetooth'`

#### LightingController.js

`ALNScanner/src/admin/LightingController.js`

Methods: `activateScene(sceneId)`, `refreshScenes()`

#### MonitoringDisplay.js Additions

Add `_handleMessage` cases for all new event types. Update DOM for bluetooth device list, scan status, audio routing state, active scene, HA connection status.

---

## 7. User Interface Design

### 7.1 Admin Panel — Audio Section

Below existing Video Controls:

```
┌───────────────────────────────────────────────────────────────┐
│ AUDIO OUTPUT                                    1 speaker     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ VIDEO AUDIO                                                   │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │      ● HDMI              ○ BLUETOOTH                      │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ BLUETOOTH SPEAKERS                              [SCAN]        │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ● Beats Pill                            [DISCONNECT]      │ │
│ │   Connected                                               │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ ○ W-King X10                              [CONNECT]       │ │
│ │   Paired · Not connected                  [REMOVE]        │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 Admin Panel — Lighting Section

```
┌───────────────────────────────────────────────────────────────┐
│ LIGHTING                                        Connected     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ Interroga-   │ │   Reveal     │ │  Suspense    │           │
│ │ tion Red     │ │   Bright     │ │  Low         │           │
│ │              │ │   ● active   │ │              │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │  Blackout    │ │  House       │ │  Warm        │           │
│ │              │ │  Lights      │ │  Welcome     │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
└───────────────────────────────────────────────────────────────┘
```

### 7.3 Error States

- **No BT adapter**: Audio toggle locked to HDMI, speaker list replaced with "Bluetooth not available"
- **BT selected, no speaker**: Warning box with "Video audio will fall back to HDMI" + [SCAN] button
- **HA not configured**: Lighting section hidden entirely
- **HA unreachable**: "Home Assistant not connected" with [RETRY] button
- **HA connected, no scenes**: "No scenes configured in Home Assistant"

---

## 8. Edge Cases

### 8.1 Bluetooth

| Scenario | Behavior |
|----------|----------|
| No adapter present | `isAvailable()` returns false; UI shows unavailable state |
| Adapter powered off | `init()` attempts `bluetoothctl power on`; warns if fails |
| Scan finds nothing | Empty list with "put speaker in pairing mode" hint |
| Pairing fails | Toast with BlueZ error message (e.g., "AuthenticationFailed") |
| Connection fails | Toast: "Connection failed — speaker may be out of range" |
| Speaker drops mid-session | `pactl subscribe` detects removed sink → toast + fallback to HDMI |
| Speaker auto-reconnects | `pactl subscribe` detects new sink → update UI |
| Multiple speakers paired | All shown; GM explicitly connects one at a time |

### 8.2 Audio Routing

| Scenario | Behavior |
|----------|----------|
| BT selected, no speaker | Fall back to HDMI, show warning |
| Speaker connects after video starts | Current video stays on HDMI; next video routes to BT |
| Speaker drops during video | Audio goes silent (PipeWire behavior); warning toast; preference stays |
| VLC not running | `applyRouting()` finds no sink-input; no-op; applied on next playback |
| No HDMI sink (no display) | Only Dummy Output available; warn in UI |
| Backend restarts | Preference loaded from `node-persist`; BT speaker may auto-reconnect (trusted) |

### 8.3 Lighting

| Scenario | Behavior |
|----------|----------|
| HA not configured (empty token) | Lighting disabled, section hidden |
| HA unreachable at startup | `isConnected()` false; periodic retry every 30s |
| HA drops mid-session | Toast warning; buttons disabled; retry on next user action |
| No scenes in HA | "No scenes configured" message |
| Scene activation fails | Toast with error; keep previous active scene indicator |

---

## 9. Implementation Plan — Dependency-Ordered

### Phase A: System Setup (Pi configuration, no code)

```
5.1 Enable BT auto-power ──────────────┐
                                        ├──→ 5.3 Smoke test BT speaker
5.2 WirePlumber A2DP config ────────────┘

5.4 Install Docker ─────→ 5.5 Deploy HA ─────→ 5.6 Configure HA ─────→ 5.7 Backend .env
```

### Phase B: Contracts (before any implementation)

```
B.1 Update asyncapi.yaml with all new events/commands
B.2 Run contract validation tests
```

### Phase C: Backend Services (can parallelize C.1–C.3)

```
C.1 bluetoothService.js ──────────┐
C.2 audioRoutingService.js ───────┼──→ C.4 Integration (adminEvents, broadcasts,
C.3 lightingService.js ───────────┘         stateService, vlcService hook, server.js)
```

### Phase D: GM Scanner (can start D.1 after Phase B)

```
D.1 Controllers (BT, Audio, Lighting) ──→ D.3 Wire up to AdminController
D.2 Update orchestratorClient.js ────────┘
D.4 MonitoringDisplay handlers ──→ D.5 AdminScreen HTML + CSS
```

### Phase E: Testing

```
E.1 Unit tests (mocked CLI/HTTP) ──→ E.2 Integration test ──→ E.3 Manual hardware test
                                      with real services
```

### File Changes Summary

**New files:**
| File | Purpose |
|------|---------|
| `backend/src/services/bluetoothService.js` | BT management via bluetoothctl |
| `backend/src/services/audioRoutingService.js` | PipeWire routing via pactl |
| `backend/src/services/lightingService.js` | HA scene control |
| `ALNScanner/src/admin/BluetoothController.js` | BT command sender |
| `ALNScanner/src/admin/AudioController.js` | Audio routing command sender |
| `ALNScanner/src/admin/LightingController.js` | Lighting command sender |
| `ALNScanner/src/styles/components/environment.css` | Audio + lighting styles |
| `/etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf` | A2DP-only config |

**Modified files:**
| File | Change |
|------|--------|
| `backend/contracts/asyncapi.yaml` | New events + command schemas |
| `backend/src/websocket/adminEvents.js` | New gm:command actions |
| `backend/src/websocket/broadcasts.js` | New event bridges |
| `backend/src/services/stateService.js` | BT/audio/lighting in state |
| `backend/src/services/vlcService.js` | Audio routing hook after playVideo() |
| `backend/src/config/index.js` | New config sections |
| `backend/src/server.js` | Service init |
| `backend/.env.example` | New env vars |
| `ALNScanner/src/network/orchestratorClient.js` | **messageTypes array** |
| `ALNScanner/src/app/adminController.js` | Init new controllers |
| `ALNScanner/src/admin/MonitoringDisplay.js` | New event handlers |
| `ALNScanner/src/ui/screens/AdminScreen.js` | Environment section |
| `ALNScanner/src/styles/main.css` | Import environment.css |
| `/etc/bluetooth/main.conf` | `AutoEnable=true` |

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `bluetoothctl` output format changes | Low | Medium | Stable within BlueZ 5.x; upgrade path to D-Bus exists |
| HDMI sink absent (no display at boot) | Expected | Low | Detect and warn; Dummy Output is normal without display |
| BT speaker selects HSP/HFP profile | Medium | Medium | WirePlumber A2DP-only config (Step 5.2); `wpctl set-profile` fallback |
| VLC sink-input registration delay | Medium | Low | Retry with backoff in `applyRouting()` |
| HA Docker resource usage | Low | Low | Pi 5 8GB; HA idles at ~300-500MB; 6.4GB currently free |
| HA API token management | Low | Low | Long-lived tokens don't expire |
| WiFi congestion from smart lights | Medium | Low | Recommend Zigbee for >10 devices |
| `pactl subscribe` process dies | Low | Medium | Health check + auto-restart in audioRoutingService |

---

## 11. Out of Scope & Future Phases

### Phase 1: Ambient Audio & Game-Linked Lighting
- Ambient audio playback (mpv with IPC socket)
- Triggered audio cues (one-shot sounds)
- Volume controls (slider + presets)
- Game event → lighting scene triggers (token scan, score threshold, etc.)

### Phase 2: Spotify & Advanced Scenes
- spotifyd / Spotify Connect integration
- Time-based or score-based automated lighting changes

### Phase 3: Pre-Video Integration
- Attention sound before video playback
- Audio ducking during video/cues
- Lighting dim during video, restore after

### Phase 4: Polish & Reliability
- Multi-speaker PipeWire combine-sink
- 4+ hour stability testing
- Bluetooth reconnection hardening
- Admin UI refinement from real GM usage

---

## 12. References

### Bluetooth
- [bluetoothctl man page](https://man.archlinux.org/man/bluetoothctl.1)
- [bluetoothctl non-interactive scripting](https://www.linuxbash.sh/post/use-bluetoothctl-to-pair-devices-non-interactively-in-a-script)
- [Debian A2DP guide](https://wiki.debian.org/BluetoothUser/a2dp)

### PipeWire / Audio
- [PipeWire ArchWiki](https://wiki.archlinux.org/title/PipeWire)
- [pactl man page](https://www.mankier.com/1/pactl)
- [WirePlumber BT config](https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html)
- [RPi + PipeWire + BT (Collabora)](https://www.collabora.com/news-and-blog/blog/2022/09/02/using-a-raspberry-pi-as-a-bluetooth-speaker-with-pipewire-wireplumber/)

### Home Assistant
- [HA REST API](https://developers.home-assistant.io/docs/api/rest/)
- [HA Scenes](https://www.home-assistant.io/integrations/scene/)
- [HA Docker install](https://www.home-assistant.io/installation/linux#docker-compose)

### Codebase (Pattern References)
- `backend/src/services/vlcService.js` — Service singleton + EventEmitter pattern
- `ALNScanner/src/admin/VideoController.js` — Stateless controller pattern
- `ALNScanner/src/admin/utils/CommandSender.js` — Command sending utility
- `ALNScanner/src/network/orchestratorClient.js` — messageTypes array (must update)
- `backend/contracts/asyncapi.yaml` — Contract-first architecture
