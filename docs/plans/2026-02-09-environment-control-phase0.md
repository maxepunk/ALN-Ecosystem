# Environment Control Phase 0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Bluetooth speaker management, PipeWire audio routing, and Home Assistant lighting scene control to the ALN orchestrator + GM Scanner admin panel — with architecture that supports the full Phase 0-4 roadmap.

**Architecture:** Three new backend services (bluetoothService, audioRoutingService, lightingService) expose functionality via `gm:command` WebSocket actions. GM Scanner gets three new controllers + HTML sections in the admin panel. All environment state is included in `sync:full` payloads for reconnect resilience. The audio routing layer uses a **streams-and-sinks** model designed to grow from "one VLC stream, two outputs" (Phase 0) to "N streams, M outputs with ducking and volume control" (Phases 1-4).

**Tech Stack:** Node.js `child_process.execFile/spawn` for `bluetoothctl`/`pactl` CLI, `axios` for Home Assistant REST API, `persistenceService` for routing preferences, Socket.io for real-time updates.

**PRD Reference:** `docs/proposals/environment-control-phase0-prd.md`

---

## Roadmap Context (Why This Architecture)

Phase 0 only implements manual controls for one audio stream and one BT speaker. But later phases add significant complexity that **must** inform the data model now:

| Phase | Audio Streams Added | Output Changes | Lighting Changes |
|-------|-------------------|----------------|-----------------|
| **0 (this)** | VLC video | HDMI ↔ 1 BT speaker | Manual scene activation |
| **1** | mpv ambient, one-shot cues | Volume per-stream | Game event → scene triggers |
| **2** | spotifyd/Spotify Connect | — | Time/score-based automation |
| **3** | Attention sound pre-video | Ducking (lower ambient during video) | Dim during video, restore after |
| **4** | — | Multi-speaker combine-sink | — |

### Key Architectural Decisions for Future-Proofing

**Audio Routing: Streams-and-Sinks Model**

The naive Phase 0 approach is a boolean `output: 'hdmi' | 'bluetooth'`. This breaks in Phase 1 when we add ambient audio (should ambient go to BT? HDMI? Both?). Instead, we model:

```
STREAM ROUTING TABLE (persisted)
┌─────────────┬──────────────────┬────────┐
│ Stream Name │ Target Sink      │ Volume │
├─────────────┼──────────────────┼────────┤
│ video       │ bluetooth:AA:BB  │ 100    │  ← Phase 0: only this row exists
│ ambient     │ bluetooth:AA:BB  │ 60     │  ← Phase 1 adds this
│ cue         │ _all_            │ 80     │  ← Phase 1 adds this
│ attention   │ _all_            │ 100    │  ← Phase 3 adds this
└─────────────┴──────────────────┴────────┘

AVAILABLE SINKS (discovered via pactl)
┌──────────────────────────────────────┬───────────┐
│ PipeWire Sink Name                   │ Type      │
├──────────────────────────────────────┼───────────┤
│ alsa_output.platform-*.hdmi-stereo   │ hdmi      │
│ bluez_output.AA_BB_CC_DD_EE_FF.1     │ bluetooth │
│ combine-sink (Phase 4)               │ combined  │
└──────────────────────────────────────┴───────────┘
```

**Phase 0 implements the table with one row (`video`), two possible sinks, no volume control.** But the data model, persistence format, and API are designed to hold N streams. The GM Scanner UI shows it as a simple HDMI/Bluetooth toggle (mapping to `video` stream routing), but the backend stores it as a routing table entry.

**Bluetooth: Multiple Devices Tracked, One Active**

Phase 4 needs multi-speaker combine-sinks. Phase 0 already tracks all paired devices and their connection state. The architecture supports multiple simultaneous connections — we just don't build the combine-sink plumbing yet.

**Lighting: Event-Capable Service**

Phase 1 needs `lightingService.activateScene()` called from game event handlers (token scan, score threshold). Phase 0 builds the service with the same method signature — the only difference is who calls it (manual gm:command now, automated event handler later).

---

## Decisions Log (from planning session)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Admin UI: HTML `<section>` blocks in `index.html` | AdminScreen.js doesn't exist. Existing pattern uses `<section class="admin-section">` in `#admin-view` |
| D2 | Mid-play BT connect: Auto-switch current video immediately | More user-friendly than waiting for next video |
| D3 | BT scan: Real-time device discovery via `device:discovered` events | 15s scan with no feedback is poor UX |
| D4 | Docker: `--privileged` flag (PRD as-written) | Simplicity for future hardware additions |
| D5 | State wiring: Import singletons directly in `gmAuth.js`/`broadcasts.js` | `sync:full` is assembled directly from services, not from stateService |
| D6 | Audio persistence: Use `persistenceService` | Consistent with existing backend patterns |
| D7 | Controllers: 3 separate files | Matches one-controller-per-domain pattern |
| D8 | Concurrent scans: No-op if already scanning | Simple, prevents confusion |
| D9 | Standalone mode: `data-requires="networked"` on environment sections | Pure CSS guard, matches Video Controls |
| D10 | No new HTTP endpoints | Environment state delivered via `sync:full` WebSocket |
| D11 | Audio routing uses streams-and-sinks table, not boolean toggle | Future phases need per-stream routing; model it correctly from day one |
| D12 | Persist routing as `{ streamName → sinkTarget }` map | Extensible for Phase 1+ without migration |

## Gap Fixes (PRD corrections from codebase analysis)

| # | PRD Statement | Actual Finding | Fix |
|---|---------------|----------------|-----|
| G1 | "Modify AdminScreen.js" | File doesn't exist | Add sections to `index.html` |
| G2 | "Modify stateService.js" | `sync:full` assembled directly from services | Add environment fields to `gmAuth.js` and `broadcasts.js` |
| G3 | "Modify server.js — Service Init" | Init lives in `app.js` | Initialize in existing `app.js` flow |
| G4 | PRD doesn't specify `cleanup()` behavior | Must kill child processes | Document per-service cleanup |
| G5 | `getDiscoveredDevices()` timing unclear | `bluetoothctl devices` only shows cached/paired | Parse scan stdout for real-time discovery |
| G6 | PRD omits standalone mode guard | Environment is networked-only | Add `data-requires="networked"` |
| G7 | PRD doesn't address `sync:full` for environment | GM Scanner needs state on connect | Add environment snapshot to `sync:full` |
| G8 | PRD says `node-persist` for audio prefs | Backend has `persistenceService` | Use `persistenceService` |
| G9 | Speaker connects mid-video: "wait for next" | Decision D2: auto-switch | `applyRouting()` on `sink:added` event |
| G10 | PRD models audio as `output: 'hdmi'\|'bluetooth'` | Doesn't scale to Phase 1+ | Streams-and-sinks routing table (D11) |

---

## Phase A: Hardware Setup & Verification

> **INTERACTIVE PHASE.** These are hands-on Pi configuration steps where we work together at the terminal. Each step has explicit expected outputs — if any step fails, we STOP and troubleshoot before proceeding. No code is written until this phase completes successfully.

### Task 1: Verify Current System State

**What:** Confirm the PRD's system state audit (Section 5.0) against the actual Pi.

**Run each command and verify output matches expectations:**

```bash
# 1. OS and hardware
cat /etc/os-release | grep PRETTY_NAME
# Expected: Debian GNU/Linux 12 (bookworm)

# 2. Node.js
node --version
# Expected: v22.x.x

# 3. PM2
pm2 --version
# Expected: 6.x.x

# 4. BlueZ (Bluetooth stack)
bluetoothctl --version
# Expected: bluetoothctl: 5.66

# 5. Bluetooth service running
systemctl is-active bluetooth
# Expected: active

# 6. Bluetooth adapter state (PRD says powered off)
bluetoothctl show | grep -E "Powered|Name|Address"
# Expected: Powered: no (this is what we're fixing in Task 2)

# 7. PipeWire running
systemctl --user is-active pipewire pipewire-pulse wireplumber
# Expected: active (3 lines)

# 8. PipeWire version
pipewire --version
# Expected: 1.2.7 or similar

# 9. Bluetooth PipeWire plugin installed
dpkg -l | grep libspa-0.2-bluetooth
# Expected: ii  libspa-0.2-bluetooth ...

# 10. pactl available
pactl --version
# Expected: pactl 16.x (or pipewire equivalent)

# 11. VLC installed
vlc --version 2>&1 | head -1
# Expected: VLC media player 3.0.x

# 12. Current audio sinks (before BT)
pactl list sinks short
# Expected: At least one HDMI sink (alsa_output.platform-*hdmi*)
# Note: May show "Dummy Output" if no HDMI display connected — this is OK

# 13. Docker status
docker --version 2>&1 || echo "Docker NOT installed"
# Expected: "Docker NOT installed" (we install in Task 5)

# 14. Available RAM
free -h | grep Mem
# Expected: ~6.4GB available
```

**GATE:** If any critical component (BlueZ, PipeWire, pactl) is missing, install before proceeding. If PipeWire isn't running, the entire audio routing approach won't work.

**Record actual outputs** — they may differ from PRD assumptions and affect later tasks.

### Task 2: Enable Bluetooth Adapter Auto-Power

**What:** The adapter is currently powered off. Configure BlueZ to auto-power on boot.

**Step 1: Check current config**
```bash
grep -n "AutoEnable" /etc/bluetooth/main.conf
# Expected: Either commented out (#AutoEnable=false) or missing
```

**Step 2: Edit config**
```bash
sudo nano /etc/bluetooth/main.conf
# Find [Policy] section, set: AutoEnable=true
# If [Policy] section doesn't exist, add it at the end:
# [Policy]
# AutoEnable=true
```

**Step 3: Restart bluetooth service**
```bash
sudo systemctl restart bluetooth
```

**Step 4: Verify adapter is now powered**
```bash
bluetoothctl show | grep -E "Powered|Discovering"
# Expected:
#   Powered: yes
#   Discovering: no
```

**GATE:** If `Powered: no` after restart, check `journalctl -u bluetooth -n 20` for errors.

### Task 3: Create WirePlumber A2DP-Only Config

**What:** Prevent WirePlumber from switching connected speakers to low-quality HFP/HSP headset profiles. This forces A2DP (high-quality stereo audio).

**Why this matters for future phases:** Phase 4's multi-speaker combine-sink requires all speakers on A2DP. Getting the profile right now prevents debugging audio quality issues later.

**Step 1: Check if override directory exists**
```bash
ls -la /etc/wireplumber/wireplumber.conf.d/ 2>&1
# Expected: "No such file or directory" (we create it)
```

**Step 2: Create config directory**
```bash
sudo mkdir -p /etc/wireplumber/wireplumber.conf.d
```

**Step 3: Create A2DP-only config file**
```bash
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

**Step 4: Restart WirePlumber**
```bash
systemctl --user restart wireplumber
```

**Step 5: Verify**
```bash
systemctl --user is-active wireplumber
# Expected: active

cat /etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf
# Expected: Contents match what we wrote above
```

**GATE:** If WirePlumber fails to start, check `journalctl --user -u wireplumber -n 20`. Config syntax errors are the usual cause.

### Task 4: Bluetooth Speaker Smoke Test (Interactive)

**Depends on:** Tasks 2 + 3 both passing their gates.

**What:** Verify the ENTIRE Bluetooth audio chain works end-to-end before writing a single line of code. This is the most critical validation step — it proves our technology choices work on this specific hardware.

**You will need:** A Bluetooth speaker in pairing mode.

**Step 1: Put speaker in pairing mode**
(Physically — usually hold power/BT button until LED flashes rapidly)

**Step 2: Scan for devices**
```bash
bluetoothctl --timeout 15 scan on
# Expected: Lines like "Device AA:BB:CC:DD:EE:FF Speaker Name"
# Watch for your speaker to appear. Note the MAC address.
```

**Step 3: List discovered devices**
```bash
bluetoothctl devices
# Expected: Your speaker listed with MAC address
```

**Step 4: Verify it's an audio device** (replace MAC)
```bash
bluetoothctl info AA:BB:CC:DD:EE:FF | grep -i "uuid\|audio\|sink\|icon"
# Expected:
#   UUID: Audio Sink (0000110b-...)
#   Icon: audio-card
# If no Audio Sink UUID → this device can't be used as a speaker
```

**GATE:** If no Audio Sink UUID, try a different speaker. Not all BT devices support A2DP.

**Step 5: Pair and trust**
```bash
bluetoothctl --agent NoInputNoOutput pair AA:BB:CC:DD:EE:FF
# Expected: "Pairing successful"
# If "AuthenticationFailed" → speaker may need PIN. Try without --agent flag.

bluetoothctl trust AA:BB:CC:DD:EE:FF
# Expected: "trust succeeded"
```

**Step 6: Connect**
```bash
bluetoothctl connect AA:BB:CC:DD:EE:FF
# Expected: "Connection successful"
# Wait 2-3 seconds for PipeWire to register the sink
```

**Step 7: Verify BT sink appeared in PipeWire**
```bash
pactl list sinks short
# Expected: A NEW line containing "bluez_output.AA_BB_CC_DD_EE_FF" with state IDLE or RUNNING
# Record the EXACT sink name — we need it for audio routing verification
```

**GATE:** If no `bluez_output` sink appears:
1. `journalctl --user -u wireplumber -n 30` — check for profile issues
2. `wpctl status` — check PipeWire node graph
3. `bluetoothctl info AA:BB:CC:DD:EE:FF | grep "Connected"` — confirm still connected

**Step 8: Verify A2DP profile (NOT HSP/HFP)**
```bash
pactl list sinks | grep -A10 "bluez_output" | grep -E "Description|sample spec|State"
# Expected:
#   sample spec: s16le 2ch 44100Hz  OR  s16le 2ch 48000Hz  (A2DP)
#   NOT: s16le 1ch 8000Hz (that would be HSP - low quality)
```

**GATE:** If sample rate is 8000Hz mono, the A2DP config from Task 3 didn't take effect. Check WirePlumber config and restart.

**Step 9: Test audio playback** (choose whichever works)
```bash
# Option A: speaker-test
speaker-test -D bluez_output.AA_BB_CC_DD_EE_FF.1 -c 2 -t sine -l 1 2>/dev/null

# Option B: paplay with a system sound
paplay --device=bluez_output.AA_BB_CC_DD_EE_FF.1 /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null

# Option C: Use VLC directly
cvlc --play-and-exit --aout pulse /usr/share/sounds/freedesktop/stereo/bell.oga 2>/dev/null

# Expected: Sound comes from the Bluetooth speaker
```

**GATE:** If no audio plays, check `wpctl status` and verify the BT sink is the default sink or explicitly specify it.

**Step 10: Test VLC audio routing (the actual use case)**
```bash
# Start VLC with a test file (or any .mp4 with audio in the videos directory)
cvlc --play-and-exit -A pulse /path/to/test-video.mp4 &
VLC_PID=$!

# Wait for VLC to register its sink-input
sleep 2

# Find VLC's sink-input
pactl list sink-inputs short
# Expected: A line containing "VLC" or showing VLC's PID
# Record the sink-input index (first column)

# Move VLC's audio to Bluetooth speaker
pactl move-sink-input <INDEX> bluez_output.AA_BB_CC_DD_EE_FF.1
# Expected: VLC audio now comes from Bluetooth speaker

# Move it back to HDMI
pactl move-sink-input <INDEX> alsa_output.platform-fef00700.hdmi.hdmi-stereo
# Expected: VLC audio now comes from HDMI

kill $VLC_PID 2>/dev/null
```

**CRITICAL GATE:** If `pactl move-sink-input` doesn't work, our entire audio routing approach is broken. Debug before proceeding. Check that VLC was started with `-A pulse` (not ALSA direct).

**Step 11: Verify auto-reconnect behavior**
```bash
# Disconnect
bluetoothctl disconnect AA:BB:CC:DD:EE:FF
# Expected: "Successful disconnected"

# Verify sink disappeared
pactl list sinks short
# Expected: No bluez_output line

# Reconnect (tests WirePlumber auto-connect for trusted devices)
bluetoothctl connect AA:BB:CC:DD:EE:FF
# Expected: "Connection successful" + sink reappears in pactl

# Or: Turn speaker off and back on to test auto-reconnect
# Expected: WirePlumber automatically connects trusted device
```

**Step 12: Cleanup (leave speaker paired but disconnected)**
```bash
bluetoothctl disconnect AA:BB:CC:DD:EE:FF
```

**Record these findings for the implementation:**
- Exact sink name format: `bluez_output.{MAC_UNDERSCORED}.1`
- Exact HDMI sink name: `alsa_output.platform-{ID}.hdmi.hdmi-stereo`
- VLC sink-input identifier pattern (application.name or PID-based?)
- Time between `connect` and sink appearing in `pactl` (~2-3s expected)
- Whether auto-reconnect works on power cycle

### Task 5: Install Docker

**What:** Docker is needed for Home Assistant container.

**Step 1: Install**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Step 2: Add user to docker group**
```bash
sudo usermod -aG docker maxepunk
newgrp docker
```

**Step 3: Verify**
```bash
docker --version
# Expected: Docker version 2X.x.x

docker run --rm hello-world
# Expected: "Hello from Docker!" message
```

**GATE:** If `docker run` fails with permission error, log out and back in (group change needs new session).

### Task 6: Deploy and Configure Home Assistant

**Depends on:** Task 5

**Step 1: Create persistent config directory**
```bash
sudo mkdir -p /opt/homeassistant
sudo chown maxepunk:maxepunk /opt/homeassistant
```

**Step 2: Start Home Assistant container**
```bash
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -v /opt/homeassistant:/config \
  -v /run/dbus:/run/dbus:ro \
  --network=host \
  ghcr.io/home-assistant/home-assistant:stable
```

**Step 3: Wait for HA to initialize (1-2 minutes)**
```bash
# Poll until ready
for i in {1..24}; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8123 2>/dev/null)
  echo "Attempt $i: HTTP $CODE"
  [ "$CODE" = "200" ] && echo "HA is ready!" && break
  sleep 5
done
```

**Step 4: Complete HA onboarding** (browser-based, not scriptable)
1. Open `http://<pi-ip>:8123` in a browser
2. Create admin account
3. Set location, timezone, unit system
4. Complete wizard

**Step 5: Add device integrations** (if you have lighting hardware)
- Settings → Devices & Services → Add Integration
- WLED, ZHA, Tuya, etc. depending on what you've bought
- This step is optional for now — lighting features work with 0 devices (just shows "no scenes")

**Step 6: Create test scenes** (so we have something to verify)
1. Settings → Automations & Scenes → Scenes
2. Create at least 2 scenes (even if controlling no real lights):
   - `scene.house_lights` — normal lighting
   - `scene.blackout` — all lights off
3. More scenes can be added anytime

**Step 7: Generate Long-Lived Access Token**
1. Click your user profile (bottom-left of HA UI)
2. Scroll to "Long-Lived Access Tokens"
3. Click "Create Token", name it `aln-backend`
4. **Copy the token immediately** (only shown once)

**Step 8: Verify API access**
```bash
# Replace YOUR_TOKEN with the actual token
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/
# Expected: {"message": "API running."}

# List scenes
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/states | \
  python3 -c "import json,sys; [print(f'  {s[\"entity_id\"]}') for s in json.load(sys.stdin) if s['entity_id'].startswith('scene.')]"
# Expected: Your created scenes listed
```

**GATE:** If API returns 401, the token is wrong. If connection refused, HA container isn't running (`docker ps`).

### Task 7: Configure Backend Environment

**Depends on:** Tasks 4 (BT smoke test findings) + 6 (HA token)

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`

**Add to `backend/.env`:**
```env
# ============================================================
# ENVIRONMENT CONTROL (Phase 0)
# ============================================================

# Bluetooth
BLUETOOTH_SCAN_TIMEOUT_SEC=15
BLUETOOTH_CONNECT_TIMEOUT_SEC=10

# Audio Routing
AUDIO_DEFAULT_OUTPUT=hdmi

# Lighting (Home Assistant)
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=<paste actual token from Task 6>
LIGHTING_ENABLED=true
```

**Add same section to `backend/.env.example`** (with placeholder token).

**Verify:**
```bash
grep -c "HOME_ASSISTANT_TOKEN" backend/.env
# Expected: 1 (and not empty)
```

---

## Phase B: Contracts

> Update AsyncAPI contract BEFORE any implementation (project convention).

### Task 8: Update AsyncAPI Contract

**Files:**
- Modify: `backend/contracts/asyncapi.yaml`

**What:** Add all new event schemas and gm:command payloads per PRD Section 6.4.

**Step 1: Add new server→client message refs** to `subscribe.message.oneOf` (after existing refs):
```yaml
- $ref: '#/components/messages/BluetoothDevice'
- $ref: '#/components/messages/BluetoothScan'
- $ref: '#/components/messages/AudioRouting'
- $ref: '#/components/messages/AudioRoutingFallback'
- $ref: '#/components/messages/LightingScene'
- $ref: '#/components/messages/LightingStatus'
```

**Step 2: Define message schemas** in `components.messages`

Each follows the existing wrapped envelope pattern. Key schemas:

- `bluetooth:device` — `{type: connected|disconnected|paired|unpaired|discovered, device: {address, name, connected?, paired?}}`
- `bluetooth:scan` — `{scanning: boolean, devices?: [{address, name, rssi?}]}`
- `audio:routing` — `{stream: string, sink: string, sinkType: 'hdmi'|'bluetooth'|'other'}` (Note: `stream` field supports future multi-stream routing)
- `audio:routing:fallback` — `{stream: string, reason: string, from: string, to: string}`
- `lighting:scene` — `{sceneId: string, sceneName?: string}`
- `lighting:status` — `{connected: boolean, sceneCount?: number}`

**Step 3: Document new gm:command action payloads** in GmCommand description:
- `bluetooth:scan:start` — `{timeout?: integer}`
- `bluetooth:scan:stop` — `{}`
- `bluetooth:pair` — `{address: string}`
- `bluetooth:unpair` — `{address: string}`
- `bluetooth:connect` — `{address: string}`
- `bluetooth:disconnect` — `{address: string}`
- `audio:route:set` — `{stream: 'video', sink: 'hdmi'|'bluetooth'}` (Note: Phase 0 only accepts `stream: 'video'` but the field exists for Phase 1+)
- `lighting:scene:activate` — `{sceneId: string}`
- `lighting:scenes:refresh` — `{}`

**Step 4: Run contract validation**
```bash
cd backend && npm run test:contract
```
Expected: PASS

**Step 5: Commit**
```bash
git add backend/contracts/asyncapi.yaml
git commit -m "feat(contracts): add environment control events to AsyncAPI"
```

---

## Phase C: Backend Config

### Task 9: Add Config Sections

**Files:**
- Modify: `backend/src/config/index.js`
- Create/Modify: `backend/tests/unit/config.test.js`

**Step 1: Write failing test**
```javascript
describe('Environment Control Config', () => {
  it('should have bluetooth config with defaults', () => {
    const config = require('../../src/config');
    expect(config.bluetooth).toBeDefined();
    expect(config.bluetooth.scanTimeout).toBe(15);
    expect(config.bluetooth.connectTimeout).toBe(10);
  });

  it('should have audio config with defaults', () => {
    const config = require('../../src/config');
    expect(config.audio).toBeDefined();
    expect(config.audio.defaultOutput).toBe('hdmi');
  });

  it('should have lighting config with defaults', () => {
    const config = require('../../src/config');
    expect(config.lighting).toBeDefined();
    expect(config.lighting.enabled).toBe(true);
    expect(config.lighting.homeAssistantUrl).toBe('http://localhost:8123');
  });
});
```

**Step 2: Run test** → Expected FAIL

**Step 3: Add config sections** to `backend/src/config/index.js` after `features` (~line 132):
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
},
```

**Step 4: Run test** → Expected PASS

**Step 5: Commit**

---

## Phase D: Backend Services

> Tasks 10, 11, 12 are independent services that can be developed in parallel.

### Task 10: bluetoothService.js

**Files:**
- Create: `backend/src/services/bluetoothService.js`
- Create: `backend/tests/unit/services/bluetoothService.test.js`

**Pattern Reference:** `backend/src/services/vlcService.js` — singleton EventEmitter, `init()`/`cleanup()`/`reset()`.

**Future-proofing notes:**
- Track ALL paired devices and their connection state (Phase 4 needs multiple simultaneous connections for combine-sink)
- `getConnectedDevices()` returns array, not single device (even though Phase 0 UI only connects one at a time)
- MAC address validation on all commands: `/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/`

**Step 1: Write failing tests** (mock `child_process.execFile`)

Key test cases:
- `isAvailable()` — true when adapter powered, false when no adapter
- `startScan(timeout)` — spawns `bluetoothctl --timeout N scan on`
- `startScan()` — no-ops if already scanning (Decision D8)
- `startScan()` — emits `scan:started`, parses stdout for `device:discovered` events (Decision D3)
- `getPairedDevices()` — parses `bluetoothctl devices Paired`, filters by Audio Sink UUID
- `getConnectedDevices()` — parses `bluetoothctl devices Connected`, filters by Audio Sink UUID
- `pairDevice(address)` — calls `--agent NoInputNoOutput pair` + `trust`
- `connectDevice(address)` — calls `connect`, validates MAC format
- `disconnectDevice(address)` — calls `disconnect`
- `unpairDevice(address)` — calls `remove`
- `isAudioDevice(address)` — checks UUIDs for `0000110b` (Audio Sink)
- `getAdapterStatus()` — parses `bluetoothctl show`
- `cleanup()` — kills active scan process
- `reset()` — kills processes, removes listeners, resets state

Parsing-specific tests (critical — exact output formats from Task 4):
```javascript
it('should parse device line: "Device AA:BB:CC:DD:EE:FF Speaker Name"', () => {
  const match = 'Device AA:BB:CC:DD:EE:FF My Speaker'.match(/^Device ([0-9A-Fa-f:]{17}) (.+)$/);
  expect(match[1]).toBe('AA:BB:CC:DD:EE:FF');
  expect(match[2]).toBe('My Speaker');
});

it('should reject invalid MAC addresses', () => {
  expect(() => service.connectDevice('not-a-mac')).rejects.toThrow();
  expect(() => service.connectDevice('AA:BB:CC:DD:EE')).rejects.toThrow();
});
```

**Step 2: Run tests** → Expected FAIL

**Step 3: Implement `bluetoothService.js`**

Implementation notes:
- Use `execFile` (not `exec`) — prevents shell injection
- `startScan()`: Use `spawn('bluetoothctl', ['--timeout', N, 'scan', 'on'])`, parse stdout line-by-line for `[NEW] Device ...` lines → emit `device:discovered`
- `startScan()`: Guard with `if (this._scanProc) return { alreadyScanning: true }`
- Filter by Audio Sink UUID in `getPairedDevices()` and `getDiscoveredDevices()` — don't expose non-audio BT devices
- `cleanup()`: `this._scanProc?.kill()` — prevent orphaned processes on shutdown

**Step 4: Run tests** → Expected PASS

**Step 5: Commit**

### Task 11: audioRoutingService.js

**Files:**
- Create: `backend/src/services/audioRoutingService.js`
- Create: `backend/tests/unit/services/audioRoutingService.test.js`

**CRITICAL ARCHITECTURE: Streams-and-Sinks Model (Decision D11)**

This service manages a **routing table** mapping named audio streams to PipeWire sinks.

Phase 0 data model:
```javascript
// Persisted via persistenceService as 'config:audioRouting'
{
  routes: {
    video: { sink: 'hdmi' }  // 'hdmi' | 'bluetooth' | specific sink name
  },
  defaultSink: 'hdmi'
}
```

Phase 1+ will add rows:
```javascript
{
  routes: {
    video: { sink: 'bluetooth', volume: 100 },
    ambient: { sink: 'bluetooth', volume: 60 },
    cue: { sink: '_all_', volume: 80 }
  },
  defaultSink: 'hdmi'
}
```

**Phase 0 implements:**
- One route (`video`), two possible sinks (`hdmi`/`bluetooth`)
- Sink discovery and classification
- `pactl subscribe` monitoring for sink add/remove
- Stream routing via `pactl move-sink-input`
- Preference persistence via `persistenceService`

**Phase 0 does NOT implement but the model supports:**
- Volume control per-stream (`pactl set-sink-input-volume`)
- Multiple routes
- `_all_` sink target (broadcast to all sinks)
- Ducking (Phase 3 — temporarily reduce one stream's volume)

**Step 1: Write failing tests** (mock `child_process`, `persistenceService`)

Key test cases:
- `getAvailableSinks()` — parses `pactl list sinks short` tab-delimited output
- `classifySink(name)` — `bluez_output.*` → `bluetooth`, `*hdmi*` (case-insensitive) → `hdmi`, else `other`
- `getBluetoothSinks()` — returns array (not single) of BT sinks (future: multiple speakers)
- `getHdmiSink()` — returns first HDMI sink
- `setStreamRoute('video', 'bluetooth')` — persists via `persistenceService`
- `getStreamRoute('video')` — returns persisted preference, defaults to `'hdmi'`
- `applyRouting('video')` — finds VLC sink-input, moves to target sink
- `applyRouting('video')` — retries `findSinkInput('VLC')` with 100ms backoff, up to 2s
- `applyRouting('video')` — falls back to HDMI when BT unavailable, emits `routing:fallback`
- `startSinkMonitor()` — spawns `pactl subscribe`, parses `Event 'new' on sink #N` / `Event 'remove' on sink #N`
- `startSinkMonitor()` — emits `sink:added`/`sink:removed` with classified sink type
- On `sink:added` for bluetooth: if `video` route targets `bluetooth`, auto-calls `applyRouting('video')` (Decision D2)
- `getRoutingStatus()` — returns full routing state for `sync:full`
- `cleanup()` — kills `pactl subscribe` process
- Invalid stream name → error
- Persistence format: `{ routes: { video: { sink: 'hdmi' } }, defaultSink: 'hdmi' }`

Parsing tests:
```javascript
it('should parse pactl list sinks short', () => {
  const output = [
    '47\talsa_output.platform-fef00700.hdmi.hdmi-stereo\tPipeWire\ts32le 2ch 48000Hz\tRUNNING',
    '89\tbluez_output.AA_BB_CC_DD_EE_FF.1\tPipeWire\ts16le 2ch 44100Hz\tIDLE'
  ].join('\n');
  const sinks = parseShortSinkList(output);
  expect(sinks).toHaveLength(2);
  expect(sinks[0].type).toBe('hdmi');
  expect(sinks[1].type).toBe('bluetooth');
});

it('should parse pactl subscribe events', () => {
  expect(parsePactlEvent("Event 'new' on sink #89")).toEqual({ action: 'new', type: 'sink', id: '89' });
  expect(parsePactlEvent("Event 'remove' on sink #89")).toEqual({ action: 'remove', type: 'sink', id: '89' });
  expect(parsePactlEvent("Event 'change' on server")).toBeNull(); // Ignore non-sink events
});
```

**Step 2: Run tests** → Expected FAIL

**Step 3: Implement `audioRoutingService.js`**

Key implementation notes:
- `findSinkInput(appName)`: Parse `pactl list sink-inputs` → find line with `application.name = "VLC media player"` → return sink-input index
- `moveStreamToSink(sinkInputIdx, sinkName)`: `execFile('pactl', ['move-sink-input', sinkInputIdx, sinkName])`
- Persistence key: `'config:audioRouting'` via `persistenceService.save()`/`persistenceService.load()`
- Sink monitor: `spawn('pactl', ['subscribe'])` — long-lived process, parse stdout line by line
- On `sink:added` event with `type === 'bluetooth'` AND `this.routes.video.sink === 'bluetooth'`: automatically call `applyRouting('video')` — this implements auto-switch on speaker connect (Decision D2)
- Health check: if `pactl subscribe` process dies, auto-restart with backoff

**GM Scanner API (Phase 0):** The `audio:route:set` command accepts `{stream: 'video', sink: 'hdmi'|'bluetooth'}`. The controller sends this. Internally it's stored as a routing table entry. The UI shows it as a simple toggle because Phase 0 only has one stream — but the backend is ready for Phase 1.

**Step 4: Run tests** → Expected PASS

**Step 5: Commit**

### Task 12: lightingService.js

**Files:**
- Create: `backend/src/services/lightingService.js`
- Create: `backend/tests/unit/services/lightingService.test.js`

**Future-proofing notes:**
- `activateScene(sceneId)` is the same method called manually (Phase 0) and by game event handlers (Phase 1). No API changes needed later.
- Scene list is cached and refreshable — Phase 1 automation will use `getCachedScenes()` to resolve scene names.
- `connection:changed` event enables Phase 1 automations to degrade gracefully when HA drops.

**Step 1: Write failing tests** (mock `axios`)

Key test cases:
- `init()` — succeeds silently when HA unreachable (graceful degradation)
- `init()` — connects and fetches scenes when HA available
- `isConnected()` — false when token empty, false when HA unreachable
- `getScenes()` — GET `/api/states`, filter `scene.*` entities, return `[{id, name}]`
- `getCachedScenes()` — returns cached list without HTTP call
- `activateScene(sceneId)` — POST `/api/services/scene/turn_on` with `{entity_id: sceneId}`
- `activateScene()` — emits `scene:activated` with `{sceneId, sceneName}`
- `activateScene()` — updates `this._activeScene`
- `getActiveScene()` — returns last-activated scene ID
- `checkConnection()` — GET `/api/` ping, updates connection status
- Connection loss emits `connection:changed` with `{connected: false}`
- Periodic reconnect every 30s when disconnected
- `refreshScenes()` — re-fetches from HA, emits `scenes:refreshed`
- `cleanup()` — clears reconnect interval

**Step 2: Run tests** → Expected FAIL

**Step 3: Implement**

Implementation notes:
- Auth header: `{ Authorization: \`Bearer ${config.lighting.homeAssistantToken}\` }`
- Scene list from HA: `GET /api/states` → filter `entity_id.startsWith('scene.')` → map to `{id: entity_id, name: attributes.friendly_name}`
- `init()` is non-blocking — try/catch around connection check, log warning on failure
- When token is empty string, skip everything (lighting section hidden in UI via `sync:full` state)
- Reconnect: `setInterval(() => this.checkConnection(), 30000)` — clear in `cleanup()`

**Step 4: Run tests** → Expected PASS

**Step 5: Commit**

---

## Phase E: Backend Integration

### Task 13: Wire gm:command Actions in adminEvents.js

**Files:**
- Modify: `backend/src/websocket/adminEvents.js`
- Modify/Create: tests

**What:** Add 9 new cases to `handleGmCommand` switch (after `system:reset` ~line 339).

**Step 1: Write failing tests** — each action calls correct service method
**Step 2: Run tests** → FAIL
**Step 3: Add cases.** Pattern matches existing: extract payload, call service, emit ack.

```javascript
// --- Environment Control (Phase 0) ---

case 'bluetooth:scan:start': {
  const timeout = payload?.timeout || config.bluetooth.scanTimeout;
  await bluetoothService.startScan(timeout);
  break;
}
case 'bluetooth:scan:stop': {
  bluetoothService.stopScan();
  break;
}
case 'bluetooth:pair': {
  if (!payload?.address) throw new Error('address is required');
  await bluetoothService.pairDevice(payload.address);
  break;
}
case 'bluetooth:unpair': {
  if (!payload?.address) throw new Error('address is required');
  await bluetoothService.unpairDevice(payload.address);
  break;
}
case 'bluetooth:connect': {
  if (!payload?.address) throw new Error('address is required');
  await bluetoothService.connectDevice(payload.address);
  break;
}
case 'bluetooth:disconnect': {
  if (!payload?.address) throw new Error('address is required');
  await bluetoothService.disconnectDevice(payload.address);
  break;
}
case 'audio:route:set': {
  const { stream = 'video', sink } = payload || {};
  if (!sink) throw new Error('sink is required');
  await audioRoutingService.setStreamRoute(stream, sink);
  await audioRoutingService.applyRouting(stream);
  break;
}
case 'lighting:scene:activate': {
  if (!payload?.sceneId) throw new Error('sceneId is required');
  await lightingService.activateScene(payload.sceneId);
  break;
}
case 'lighting:scenes:refresh': {
  await lightingService.refreshScenes();
  break;
}
```

**Step 4: Run tests** → PASS
**Step 5: Commit**

### Task 14: Wire Event Broadcasts in broadcasts.js

**Files:**
- Modify: `backend/src/websocket/broadcasts.js`

**What:** Bridge service events to WebSocket (GM room only).

**Step 1: Write failing tests**
**Step 2: Run tests** → FAIL
**Step 3: Add broadcast listeners** at end of `setupBroadcastListeners()`:

```javascript
// ============================================================
// ENVIRONMENT CONTROL BROADCASTS (Phase 0)
// ============================================================

// Bluetooth events
addTrackedListener(bluetoothService, 'device:connected', (device) => {
  emitWrapped(io, 'bluetooth:device', { type: 'connected', device });
});
addTrackedListener(bluetoothService, 'device:disconnected', (device) => {
  emitWrapped(io, 'bluetooth:device', { type: 'disconnected', device });
});
addTrackedListener(bluetoothService, 'device:paired', (device) => {
  emitWrapped(io, 'bluetooth:device', { type: 'paired', device });
});
addTrackedListener(bluetoothService, 'device:unpaired', (device) => {
  emitWrapped(io, 'bluetooth:device', { type: 'unpaired', device });
});
addTrackedListener(bluetoothService, 'device:discovered', (device) => {
  emitWrapped(io, 'bluetooth:device', { type: 'discovered', device });
});
addTrackedListener(bluetoothService, 'scan:started', () => {
  emitWrapped(io, 'bluetooth:scan', { scanning: true });
});
addTrackedListener(bluetoothService, 'scan:stopped', () => {
  emitWrapped(io, 'bluetooth:scan', { scanning: false });
});

// Audio routing events
addTrackedListener(audioRoutingService, 'routing:changed', (data) => {
  emitWrapped(io, 'audio:routing', data);
});
addTrackedListener(audioRoutingService, 'routing:fallback', (data) => {
  emitWrapped(io, 'audio:routing:fallback', data);
});

// Lighting events
addTrackedListener(lightingService, 'scene:activated', (data) => {
  emitWrapped(io, 'lighting:scene', data);
});
addTrackedListener(lightingService, 'connection:changed', (data) => {
  emitWrapped(io, 'lighting:status', data);
});
```

**Step 4: Run tests** → PASS
**Step 5: Commit**

### Task 15: Add Environment State to sync:full

**Files:**
- Modify: `backend/src/websocket/gmAuth.js`
- Modify: `backend/src/websocket/broadcasts.js` (offline:queue:processed sync:full)

**What:** Include BT/audio/lighting state in `sync:full` so GM Scanner has full state on connect/reconnect.

**Step 1: Write failing test** — `sync:full` payload includes `environment` object
**Step 2: Run test** → FAIL
**Step 3: Add environment snapshot**

In `gmAuth.js` (~line 196), add to `emitWrapped(socket, 'sync:full', {...})`:
```javascript
environment: {
  bluetooth: {
    available: await bluetoothService.isAvailable(),
    scanning: bluetoothService.isScanning(),
    pairedDevices: await bluetoothService.getPairedDevices(),
    connectedDevices: await bluetoothService.getConnectedDevices(),
  },
  audio: audioRoutingService.getRoutingStatus(),
  // getRoutingStatus() returns: { routes: {video: {sink}}, availableSinks: [...], defaultSink }
  lighting: {
    connected: lightingService.isConnected(),
    scenes: lightingService.getCachedScenes(),
    activeScene: lightingService.getActiveScene(),
  }
}
```

Same addition in `broadcasts.js` offline:queue:processed sync:full assembly (~line 576).

**Step 4: Run test** → PASS
**Step 5: Commit**

### Task 16: Hook Audio Routing into vlcService

**Files:**
- Modify: `backend/src/services/vlcService.js`

**What:** After video playback starts, route audio to the correct output.

**Step 1: Write failing test**
```javascript
it('playVideo() calls audioRoutingService.applyRouting("video") after playback starts', async () => {
  const applySpy = jest.spyOn(audioRoutingService, 'applyRouting').mockResolvedValue();
  await vlcService.playVideo('test.mp4');
  expect(applySpy).toHaveBeenCalledWith('video');
});
```

**Step 2: Run test** → FAIL
**Step 3: Add routing hook** after `in_play` succeeds (~line 188):
```javascript
// Route video audio to selected output (Phase 0: Environment Control)
const audioRoutingService = require('./audioRoutingService');
audioRoutingService.applyRouting('video').catch(err => {
  logger.warn('Audio routing failed after playVideo', { error: err.message });
});
```

**Step 4: Run test** → PASS
**Step 5: Commit**

### Task 17: Initialize Services in App Startup

**Files:**
- Modify: `backend/src/app.js` (verify exact location with `grep -rn "vlcService.init\|persistenceService.init" backend/src/`)

**Step 1: Add initialization** (after existing service inits):
```javascript
await bluetoothService.init();        // Check adapter, warn if unavailable
await audioRoutingService.init();     // Start sink monitor, load persisted routes
await lightingService.init();         // Non-blocking HA connection check
```

**Step 2: Add cleanup** (in graceful shutdown handler):
```javascript
bluetoothService.cleanup();
audioRoutingService.cleanup();
lightingService.cleanup();
```

**Step 3: Verify**
```bash
cd backend && npm run dev:no-video
# Expected: Starts without errors
# Expected: Bluetooth status logged (available or warning)
# Expected: Lighting status logged (connected or "HA not configured")
# Expected: Audio routing loaded (default: hdmi)
```

**Step 4: Commit**

---

## Phase F: GM Scanner — Controllers

### Task 18: BluetoothController.js

**Files:**
- Create: `ALNScanner/src/admin/BluetoothController.js`
- Create: `ALNScanner/tests/unit/admin/BluetoothController.test.js`

**Pattern:** Matches `VideoController.js` — stateless, all methods call `sendCommand()`.

TDD: test → fail → implement → pass → commit.

```javascript
import { sendCommand } from './utils/CommandSender.js';

export default class BluetoothController {
  constructor(connection) { this.connection = connection; }

  async startScan(timeout) {
    return sendCommand(this.connection, 'bluetooth:scan:start', timeout ? { timeout } : {});
  }
  async stopScan() {
    return sendCommand(this.connection, 'bluetooth:scan:stop', {});
  }
  async pairDevice(address) {
    return sendCommand(this.connection, 'bluetooth:pair', { address });
  }
  async unpairDevice(address) {
    return sendCommand(this.connection, 'bluetooth:unpair', { address });
  }
  async connectDevice(address) {
    return sendCommand(this.connection, 'bluetooth:connect', { address });
  }
  async disconnectDevice(address) {
    return sendCommand(this.connection, 'bluetooth:disconnect', { address });
  }
  destroy() { /* no-op */ }
}
```

### Task 19: AudioController.js

Same pattern. Note: sends `audio:route:set` with `stream` field for future-proofing.

```javascript
async setVideoOutput(output) {
  return sendCommand(this.connection, 'audio:route:set', { stream: 'video', sink: output });
}
```

### Task 20: LightingController.js

Same pattern. Two methods: `activateScene(sceneId)`, `refreshScenes()`.

### Task 21: Wire Controllers into AdminController

**Modify:** `ALNScanner/src/app/adminController.js`

Add to `this.modules` in `initialize()` (~line 49):
```javascript
bluetoothController: new BluetoothController(this.client),
audioController: new AudioController(this.client),
lightingController: new LightingController(this.client),
```

Import at top of file. Test. Commit.

---

## Phase G: GM Scanner — Event Handling

### Task 22: Update orchestratorClient.js messageTypes

**CRITICAL:** Without this, all new events are silently dropped.

**Modify:** `ALNScanner/src/network/orchestratorClient.js`

Add to `messageTypes` array (line 240) after `'player:scan'`:
```javascript
'bluetooth:device',
'bluetooth:scan',
'audio:routing',
'audio:routing:fallback',
'lighting:scene',
'lighting:status',
```

Test with unit test. Commit.

### Task 23: Update MonitoringDisplay._handleMessage

**Modify:** `ALNScanner/src/admin/MonitoringDisplay.js`

Add switch cases for all 6 new event types. Each handler updates DOM in the new admin sections.

Handler implementations:
- `_handleBluetoothDevice(payload)` — Update device list: add discovered device, update connected/paired state, remove unpaired
- `_handleBluetoothScan(payload)` — Toggle scan button text/state, show/hide spinner
- `_handleAudioRouting(payload)` — Set radio button selection matching `payload.sink`
- `_handleAudioFallback(payload)` — Show warning toast: `"Audio fell back to HDMI: {reason}"`
- `_handleLightingScene(payload)` — Add `--active` class to matching scene tile, remove from others
- `_handleLightingStatus(payload)` — Show/hide lighting section, toggle "not connected" message

Update `updateAllDisplays()` (sync:full handler) to process `payload.environment`:
- Populate device list from `environment.bluetooth.pairedDevices`/`connectedDevices`
- Set audio toggle from `environment.audio.routes.video.sink`
- Populate scene grid from `environment.lighting.scenes`
- Show/hide lighting section based on `environment.lighting.connected`

TDD throughout. Commit.

---

## Phase H: GM Scanner — Admin Panel UI

### Task 24: Add HTML Sections to index.html

**Modify:** `ALNScanner/index.html`

Insert after "Video Controls" section (~line 403), before "System Status" (~line 406).

**Both sections use `data-requires="networked"`** (Decision D9) — automatically hidden in standalone mode via existing CSS rule `body.standalone-mode [data-requires="networked"] { display: none !important; }`.

```html
<!-- Audio Output Section (Networked mode only - Phase 0 Environment Control) -->
<section class="admin-section" data-requires="networked" id="audio-output-section">
    <h3>Audio Output <span id="bt-speaker-count" class="section-badge"></span></h3>

    <!-- Video Audio Route Toggle -->
    <div class="audio-output-toggle">
        <label class="radio-toggle">
            <input type="radio" name="audioOutput" value="hdmi" checked
                   data-action="admin.setAudioRoute" data-stream="video">
            <span>HDMI</span>
        </label>
        <label class="radio-toggle">
            <input type="radio" name="audioOutput" value="bluetooth"
                   data-action="admin.setAudioRoute" data-stream="video">
            <span>Bluetooth</span>
        </label>
    </div>

    <!-- BT Fallback Warning (hidden by default) -->
    <div id="bt-warning" class="alert alert-warning" style="display:none;">
        No Bluetooth speaker connected — video audio will use HDMI
    </div>

    <!-- Bluetooth Speakers -->
    <div class="bt-speakers-header">
        <h4>Bluetooth Speakers</h4>
        <button id="btn-bt-scan" class="btn btn-sm" data-action="admin.bluetoothScan">Scan</button>
    </div>
    <div id="bt-scan-status" style="display:none;">
        <span class="spinner-sm"></span> Scanning...
    </div>
    <div id="bt-device-list" class="device-list">
        <!-- Populated dynamically by MonitoringDisplay -->
        <p class="empty-state">No speakers found. Put your speaker in pairing mode and tap Scan.</p>
    </div>
    <div id="bt-unavailable" style="display:none;">
        Bluetooth adapter not available
    </div>
</section>

<!-- Lighting Section (Networked mode only - Phase 0 Environment Control) -->
<section class="admin-section" data-requires="networked" id="lighting-section" style="display:none;">
    <h3>Lighting <span id="ha-connection-status" class="section-badge"></span></h3>
    <div id="lighting-scenes" class="scene-grid">
        <!-- Populated dynamically by MonitoringDisplay -->
    </div>
    <div id="lighting-no-scenes" style="display:none;">
        No scenes configured in Home Assistant
    </div>
    <div id="lighting-not-connected" style="display:none;">
        Home Assistant not connected
        <button class="btn btn-sm" data-action="admin.lightingRetry">Retry</button>
    </div>
</section>
```

Commit.

### Task 25: Add CSS Styles

**Create:** `ALNScanner/src/styles/components/environment.css`
**Modify:** `ALNScanner/src/styles/main.css` (add `@import`)

Key styles:
- `.audio-output-toggle` — horizontal pill-style radio group
- `.device-list` — BT speaker list with status indicators
- `.device-item` — speaker row (name, status, action buttons)
- `.device-item--connected` — green accent for connected speaker
- `.device-item--discovering` — pulsing animation for newly found devices
- `.scene-grid` — CSS grid (3 columns, responsive)
- `.scene-tile` — tappable scene button (dark background, border)
- `.scene-tile--active` — highlighted with accent color
- `.spinner-sm` — small inline spinner for scan state
- `.empty-state` — muted text for empty lists

Match existing admin panel style. Commit.

### Task 26: Wire data-action Buttons

**Modify:** `ALNScanner/src/utils/domEventBindings.js` (or equivalent)

New action handlers:
- `admin.bluetoothScan` → `adminController.getModule('bluetoothController').startScan()`
- `admin.setAudioRoute` → read `data-stream` + radio value → `adminController.getModule('audioController').setVideoOutput(value)`
- `admin.lightingRetry` → `adminController.getModule('lightingController').refreshScenes()`

Dynamic buttons (connect/disconnect/pair/remove) are attached by MonitoringDisplay when rendering device list items — not data-action. They use event delegation on `#bt-device-list`.

Commit.

---

## Phase I: Integration & Hardware Verification

### Task 27: Backend Integration Test

**Create:** `backend/tests/integration/environment_control.test.js`

Key scenarios:
- WebSocket connect → `sync:full` includes `environment` object
- `bluetooth:scan:start` → `bluetooth:scan` broadcast `{scanning: true}`
- `audio:route:set` → `audio:routing` broadcast
- `lighting:scene:activate` → `lighting:scene` broadcast
- BT service unavailable → graceful degradation
- HA unreachable → `lighting:status` `{connected: false}`
- Backend restart → audio routing preference persisted

```bash
cd backend && npm run test:integration
```

Commit.

### Task 28: End-to-End Hardware Verification (Interactive)

> **INTERACTIVE.** Work through each step with the actual hardware. This is the final validation before the feature is complete.

**Prerequisites:** Backend running with all env vars, GM Scanner open in browser, BT speaker available, HA running.

**BT Audio Flow:**
```
Step 1: Open GM Scanner → Admin panel → Audio Output section visible
  - VERIFY: Section shows "HDMI" selected, "No speakers found" message
  - VERIFY: Lighting section shows scenes from HA (or "not connected" if HA down)

Step 2: Tap "Scan" button
  - VERIFY: Button changes to disabled state, spinner appears
  - VERIFY: Speakers appear in list as they're discovered (real-time, Decision D3)
  - VERIFY: Scan stops after timeout, button re-enables

Step 3: Tap your speaker in the discovered list
  - VERIFY: "Pairing..." status appears
  - VERIFY: Speaker moves to "Paired" state with Connect/Remove buttons

Step 4: Tap "Connect" on paired speaker
  - VERIFY: Speaker shows "Connecting..."
  - VERIFY: Speaker shows "Connected" with green indicator
  - VERIFY: Speaker count badge updates ("1 speaker")

Step 5: Select "Bluetooth" radio button
  - VERIFY: `audio:routing` event received (check browser console)

Step 6: Trigger video playback (via Video Controls → play a video)
  - VERIFY: Audio comes from Bluetooth speaker, NOT HDMI
  - VERIFY: Video plays on HDMI display (video is HDMI, audio is BT)

Step 7: While video is playing, disconnect speaker (tap "Disconnect")
  - VERIFY: Warning toast appears: "Audio fell back to HDMI"
  - VERIFY: Audio output label stays on "Bluetooth" (preference preserved)
  - VERIFY: BT warning message appears: "No Bluetooth speaker connected..."

Step 8: Reconnect speaker (tap "Connect")
  - VERIFY: Audio automatically switches back to BT speaker (Decision D2)
  - VERIFY: Warning disappears

Step 9: Stop video. Select "HDMI". Play another video.
  - VERIFY: Audio comes from HDMI

Step 10: Restart backend (Ctrl+C and restart)
  - VERIFY: After reconnect, audio preference is still "Bluetooth" (persisted)
  - VERIFY: Speaker reconnects automatically (WirePlumber trusted device)
```

**Lighting Flow:**
```
Step 11: Lighting section shows scenes from HA
  - VERIFY: Scene tiles appear with friendly names
  - VERIFY: No scene is highlighted as active initially

Step 12: Tap a scene tile (e.g., "House Lights")
  - VERIFY: Tile highlights as active
  - VERIFY: Actual lights change (if real hardware connected)
  - VERIFY: Other tiles deactivate

Step 13: Stop HA container: docker stop homeassistant
  - VERIFY: "Home Assistant not connected" appears with Retry button
  - VERIFY: Audio controls still work (independent of HA)

Step 14: Restart HA: docker start homeassistant
  - VERIFY: After ~30s, lighting section reconnects automatically
  - VERIFY: Scenes re-appear
```

**Edge Cases to Test:**
```
Step 15: Standalone mode guard
  - Reload scanner, select "Standalone Mode"
  - VERIFY: Audio Output and Lighting sections are hidden

Step 16: No BT adapter (if testable — disable adapter)
  - bluetoothctl power off
  - Reload scanner
  - VERIFY: "Bluetooth adapter not available" message
  - VERIFY: Audio toggle locked to HDMI (BT option disabled)
```

---

## File Change Summary

**New files (8):**
| File | Purpose |
|------|---------|
| `backend/src/services/bluetoothService.js` | BT management via bluetoothctl |
| `backend/src/services/audioRoutingService.js` | PipeWire routing (streams-and-sinks model) |
| `backend/src/services/lightingService.js` | HA scene control |
| `ALNScanner/src/admin/BluetoothController.js` | BT command sender |
| `ALNScanner/src/admin/AudioController.js` | Audio routing command sender |
| `ALNScanner/src/admin/LightingController.js` | Lighting command sender |
| `ALNScanner/src/styles/components/environment.css` | Audio + lighting styles |
| `/etc/wireplumber/wireplumber.conf.d/50-aln-bluetooth.conf` | A2DP-only config |

**Modified files (12):**
| File | Change |
|------|--------|
| `backend/contracts/asyncapi.yaml` | New events + command schemas |
| `backend/src/config/index.js` | BT/audio/lighting config sections |
| `backend/src/websocket/adminEvents.js` | 9 new gm:command actions |
| `backend/src/websocket/broadcasts.js` | Event bridges + sync:full environment |
| `backend/src/websocket/gmAuth.js` | Environment state in sync:full |
| `backend/src/services/vlcService.js` | Audio routing hook after playVideo |
| `backend/src/app.js` | Service init + cleanup |
| `backend/.env.example` | New env vars |
| `ALNScanner/src/network/orchestratorClient.js` | 6 new messageTypes entries |
| `ALNScanner/src/app/adminController.js` | 3 new controller modules |
| `ALNScanner/src/admin/MonitoringDisplay.js` | 6 new event handlers + sync:full |
| `ALNScanner/index.html` | Audio + Lighting HTML sections |

**PRD corrections (NOT modified):**
| PRD Said | Why Not |
|----------|---------|
| `AdminScreen.js` | Doesn't exist — use `index.html` sections |
| `stateService.js` | Not needed — env state in sync:full directly |
| `server.js` (service init) | Init is in `app.js` |

**New test files (7+):**
| File | Covers |
|------|--------|
| `backend/tests/unit/services/bluetoothService.test.js` | BT service |
| `backend/tests/unit/services/audioRoutingService.test.js` | Audio routing |
| `backend/tests/unit/services/lightingService.test.js` | Lighting |
| `backend/tests/unit/config.test.js` (additions) | Config sections |
| `backend/tests/integration/environment_control.test.js` | Full backend flow |
| `ALNScanner/tests/unit/admin/BluetoothController.test.js` | BT controller |
| `ALNScanner/tests/unit/admin/AudioController.test.js` | Audio controller |
| `ALNScanner/tests/unit/admin/LightingController.test.js` | Lighting controller |
