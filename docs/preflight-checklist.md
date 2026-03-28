# ALN Ecosystem Pre-Flight Checklist

**Purpose:** Step-by-step environment and system state verification for the ALN backend orchestrator. Designed to be followed by a Claude Code instance before starting the server.

**Working Directory:** `/home/maxepunk/projects/AboutLastNight/ALN-Ecosystem`
**Server Directory:** `backend/` (relative to above)
**Platform:** Raspberry Pi 5, Linux ARM64

## How to Use This Checklist

1. Run each check in order within its section (later checks depend on earlier ones)
2. Sections are independent — but within a section, order matters
3. Every check has: what to verify, the command, expected output, and remediation
4. Severity levels:
   - **CRITICAL**: Server will crash or core gameplay broken. Must fix.
   - **REQUIRED**: A service will be degraded. Should fix.
5. Scenario tags:
   - `[COLD]` — Relevant after fresh boot (service not yet started)
   - `[WARM]` — Relevant after server stop/restart (orphans, stale state)
   - `[BOTH]` — Always relevant
6. If a check fails and remediation doesn't resolve it, stop and report the failure before continuing.

---

## 1. System Fundamentals

### 1.1 Node.js Version [BOTH] — CRITICAL

Node.js must be installed and at a version compatible with the backend dependencies (ES2020+, v18+).

**Check:**
```bash
node --version
```

**Expected:** `v18.x.x` or higher (v20+ preferred)

**If fails:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 1.2 npm Packages Installed [BOTH] — CRITICAL

The backend's `node_modules/` must be populated. There is no root-level package.json — you must be in `backend/`.

**Check:**
```bash
ls backend/node_modules/.package-lock.json 2>/dev/null && echo "OK" || echo "MISSING"
```

**Expected:** `OK`

**If fails:**
```bash
cd backend && npm ci && cd ..
```

### 1.3 Available Disk Space [BOTH] — CRITICAL

The backend writes logs to `backend/logs/`, persists session data to `backend/data/`, and VLC plays videos from `backend/public/videos/`. Low disk causes silent failures.

**Check:**
```bash
df -h / | awk 'NR==2 {print $4}'
```

**Expected:** At least 1GB free

**If low:**
- Archive old logs: check `backend/logs/` for large rotated files
- See `logs/README_LOG_ARCHIVAL.md` for log maintenance procedures
- Check `backend/data/` for stale session persistence files from old games

### 1.4 Available RAM [BOTH] — CRITICAL

The PM2 config allocates up to 2GB heap to Node.js (`--max-old-space-size=2048`). The Pi needs headroom for VLC, PipeWire, D-Bus, and the OS.

**Check:**
```bash
free -m | awk '/^Mem:/ {printf "Total: %dMB, Available: %dMB\n", $2, $7}'
```

**Expected:** Total at least 8GB (8192MB). Available at least 4GB before server start.

**If low:**
- Check for rogue processes: `ps aux --sort=-%mem | head -10`
- Kill any leftover VLC or Node processes from previous runs (Section 2 covers this)

### 1.5 GPU Memory / Video Decode Capability [COLD] — REQUIRED

VLC uses hardware-accelerated H.264 decoding. The check differs by Pi model.

**Check:**
```bash
PI_MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "unknown")
echo "Model: $PI_MODEL"

if echo "$PI_MODEL" | grep -q "Raspberry Pi 5"; then
  # Pi 5 uses dynamic CMA allocation — gpu_mem is not used
  # Check CMA is available (default 256MB on Pi 5, dynamically allocated)
  CMA=$(cat /proc/meminfo | grep CmaTotal | awk '{print $2}')
  echo "CMA Total: ${CMA}kB ($(( CMA / 1024 ))MB)"
  if [ "$CMA" -ge 131072 ]; then
    echo "OK: CMA allocation sufficient for video decode"
  else
    echo "WARNING: CMA below 128MB — video decode may fail"
  fi
elif echo "$PI_MODEL" | grep -q "Raspberry Pi 4"; then
  # Pi 4 uses fixed gpu_mem allocation
  GPU_MEM=$(vcgencmd get_mem gpu 2>/dev/null)
  echo "$GPU_MEM"
  if echo "$GPU_MEM" | grep -qE "gpu=(256|384|512)M"; then
    echo "OK: GPU memory sufficient"
  else
    echo "WARNING: Set gpu_mem=256 in /boot/firmware/config.txt and reboot"
  fi
else
  echo "Non-Pi platform — GPU memory check skipped"
fi
```

**Expected:** CMA >= 128MB on Pi 5, or gpu=256M+ on Pi 4.

**If insufficient on Pi 4:**
- Edit `/boot/firmware/config.txt`, set `gpu_mem=256`
- Requires reboot: `sudo reboot`

### 1.6 CPU Temperature [BOTH] — REQUIRED

Thermal throttling degrades VLC playback and causes frame drops.

**Check:**
```bash
vcgencmd measure_temp 2>/dev/null || echo "vcgencmd not available"
vcgencmd get_throttled 2>/dev/null || echo "throttle check unavailable"
```

**Expected:** Temperature below 70°C. `throttled=0x0` means no throttling has occurred.

Above 80°C = active throttling. If throttled:
- Check ventilation and heatsink attachment
- Reduce ambient temperature or add active cooling

---

## 2. Orphan Process Cleanup

Stale processes from previous server runs can hold ports, lock D-Bus names, and prevent clean startup. This section is especially important on `[WARM]` restarts but safe to run on `[COLD]` boots (checks will simply find nothing).

### 2.1 Stale Node.js / PM2 Processes [WARM] — CRITICAL

A previous server instance may still be running or in a zombie state.

**Check:**
```bash
pm2 list 2>/dev/null | grep -E "aln-orchestrator" || echo "No PM2 processes"
pgrep -f "node.*src/server.js" --exact 2>/dev/null || pgrep -fa "node.*ALN-Ecosystem/backend.*server" | grep -v pgrep || echo "No bare node server processes"
```

**Expected:** No running instances. If restarting intentionally, PM2 should show `stopped`.

**If found:**
```bash
# If PM2 is managing it:
cd backend && pm2 stop aln-orchestrator && cd ..

# If bare node process (use PID from pgrep output):
kill <PID>
```

### 2.2 Stale VLC Processes [WARM] — CRITICAL

VLC is spawned by ProcessMonitor as `cvlc` but the process name becomes `vlc` after exec. A stale VLC holds the MPRIS D-Bus name and the display.

**Check:**
```bash
pgrep -a vlc || echo "No VLC processes"
cat /tmp/aln-pm-vlc.pid 2>/dev/null && echo "(PID file exists)" || echo "No VLC PID file"
```

**Expected:** No VLC processes running, no PID file (or PID file pointing to a dead process).

**If found:**
```bash
pkill vlc
rm -f /tmp/aln-pm-vlc.pid
```

**Note:** ProcessMonitor performs its own orphan recovery at startup (reads PID file, kills if alive), but cleaning up manually ensures no surprises.

### 2.3 Stale D-Bus Monitor Processes [WARM] — REQUIRED

Three D-Bus monitors run as ProcessMonitor children. They can survive parent crashes.

**Check:**
```bash
pgrep -fa "dbus-monitor.*monitor" | grep -v pgrep || echo "No dbus-monitor processes"
ls /tmp/aln-pm-*-dbus-monitor.pid 2>/dev/null || echo "No D-Bus monitor PID files"
```

**Expected PID files (if present from previous run):**
- `/tmp/aln-pm-vlc-dbus-monitor.pid` — VLC MPRIS monitor (session bus)
- `/tmp/aln-pm-spotify-dbus-monitor.pid` — Spotify MPRIS monitor (session bus)
- `/tmp/aln-pm-bluez-dbus-monitor.pid` — BlueZ device monitor (system bus)

**If found:**
```bash
pkill -f "dbus-monitor.*monitor"
rm -f /tmp/aln-pm-vlc-dbus-monitor.pid /tmp/aln-pm-spotify-dbus-monitor.pid /tmp/aln-pm-bluez-dbus-monitor.pid
```

### 2.4 Stale pactl Subscribe Process [WARM] — REQUIRED

Audio routing uses a `pactl subscribe` process to watch for sink add/remove events.

**Check:**
```bash
pgrep -fa "pactl subscribe" | grep -v pgrep || echo "No pactl subscribe processes"
cat /tmp/aln-pm-pactl-subscribe.pid 2>/dev/null && echo "(PID file exists)" || echo "No pactl PID file"
```

**Expected:** No running pactl subscribe processes.

**If found:**
```bash
killall -9 pactl 2>/dev/null
rm -f /tmp/aln-pm-pactl-subscribe.pid
```

**Note:** `audioRoutingService.init()` runs `killall -9 pactl` itself at startup, but pre-cleaning avoids noisy error logs.

### 2.5 All PID Files Summary [BOTH] — REQUIRED

Quick verification that no orphan PID files remain.

**Check:**
```bash
ls /tmp/aln-pm-*.pid 2>/dev/null || echo "Clean — no PID files"
```

**Expected:** `Clean — no PID files`

**If any remain after steps 2.1–2.4:**
```bash
rm -f /tmp/aln-pm-*.pid
```

---

## 3. Port Availability

The server binds three ports. If any are already in use, the server will fail to start or silently lose functionality.

### 3.1 Primary Server Port (3000) [BOTH] — CRITICAL

The HTTPS server (API, WebSocket, static files) binds to this port. Configurable via `PORT` env var.

**Check:**
```bash
ss -tlnp | grep ':3000 ' || echo "Port 3000 available"
```

**Expected:** `Port 3000 available`

**If occupied:**
- Identify the process: `ss -tlnp | grep ':3000 '` — the rightmost column shows `pid/process`
- If it's a previous server instance, handle via Section 2
- If it's another service, either stop it or set a different `PORT` in `backend/.env`

### 3.2 HTTP Redirect Port (8000) [BOTH] — REQUIRED

When HTTPS is enabled, a secondary HTTP server on this port redirects all requests to HTTPS. Configurable via `HTTP_REDIRECT_PORT` env var.

**Check:**
```bash
ss -tlnp | grep ':8000 ' || echo "Port 8000 available"
```

**Expected:** `Port 8000 available`

**If occupied:**
- Same investigation as 3.1
- This port is only used when `ENABLE_HTTPS=true` in `backend/.env`
- If not using HTTPS, this port is not bound and the check can be noted as N/A

### 3.3 UDP Discovery Port (8888) [BOTH] — REQUIRED

Scanners auto-discover the orchestrator by sending `ALN_DISCOVER` UDP broadcasts to this port. The server responds with its IP, port, and protocol.

**Check:**
```bash
ss -ulnp | grep ':8888 ' || echo "Port 8888 available"
```

**Expected:** `Port 8888 available`

**If occupied:**
- Identify: `ss -ulnp | grep ':8888 '`
- If it's a previous discovery service instance, kill the parent node process (Section 2)
- This port is hardcoded in `backend/src/services/discoveryService.js` — changing it requires a code edit, not an env var

---

## 4. Git Submodules & Token Data

Token definitions are the single most critical data dependency. The server will not start without `tokens.json`. Tokens live in the `ALN-TokenData` submodule, which is also nested inside `ALNScanner/data/` and `aln-memory-scanner/data/`.

### 4.1 Submodule Initialization [BOTH] — CRITICAL

All four submodules must be initialized and checked out.

**Check:**
```bash
git submodule status --recursive
```

**Expected:** Each line starts with a commit hash (no `-` prefix, which means uninitialized):
```
<hash> ALN-TokenData (heads/main)
<hash> ALNScanner (...)
<hash> ALNScanner/data (...)
<hash> aln-memory-scanner (heads/main)
<hash> aln-memory-scanner/data (...)
<hash> arduino-cyd-player-scanner (heads/main)
```

A leading `-` means the submodule is not initialized. A leading `+` means it's at a different commit than the parent repo expects (acceptable but worth noting).

**If any show `-` prefix:**
```bash
git submodule update --init --recursive
```

### 4.2 Primary Token File [BOTH] — CRITICAL

The backend loads tokens from `ALN-TokenData/tokens.json` first. If this fails, it falls back to `aln-memory-scanner/data/tokens.json`. If both fail, the server exits with a fatal error.

**Check:**
```bash
test -f ALN-TokenData/tokens.json && echo "OK: Primary tokens.json exists" || echo "MISSING"
```

**Expected:** `OK: Primary tokens.json exists`

**Verify it parses as valid JSON:**
```bash
node -e "const t = require('./ALN-TokenData/tokens.json'); console.log('Tokens loaded:', Object.keys(t).length, 'entries')"
```

**Expected:** `Tokens loaded: NN entries` (a positive number)

**If missing or invalid:**
```bash
git submodule update --init --recursive
# If still missing, the submodule remote may have issues:
cd ALN-TokenData && git fetch origin && git checkout main && git pull && cd ..
```

### 4.3 Fallback Token File [BOTH] — REQUIRED

The nested submodule copy used as fallback if primary path fails.

**Check:**
```bash
test -f aln-memory-scanner/data/tokens.json && echo "OK: Fallback tokens.json exists" || echo "MISSING"
```

**Expected:** `OK: Fallback tokens.json exists`

**Verify token counts match between primary and fallback:**
```bash
node -e "
  const p = Object.keys(require('./ALN-TokenData/tokens.json')).length;
  const f = Object.keys(require('./aln-memory-scanner/data/tokens.json')).length;
  console.log('Primary:', p, '| Fallback:', f, '|', p === f ? 'MATCH' : 'MISMATCH');
"
```

**Expected:** Both counts match. A mismatch means the nested submodule is at a different commit.

**If mismatch:**
```bash
cd aln-memory-scanner/data && git fetch origin && git reset --hard origin/main && cd ../..
```

### 4.4 Scoring Config [BOTH] — REQUIRED

Shared scoring values loaded by both backend and GM Scanner at runtime. The backend falls back to hardcoded defaults if missing, but this means scoring may differ from the GM Scanner.

**Check:**
```bash
test -f ALN-TokenData/scoring-config.json && echo "OK" || echo "MISSING"
```

**Verify structure:**
```bash
node -e "
  const s = require('./ALN-TokenData/scoring-config.json');
  const ok = s.baseValues && s.typeMultipliers;
  console.log(ok ? 'OK: scoring-config has baseValues + typeMultipliers' : 'INVALID: missing expected keys');
"
```

**Expected:** `OK: scoring-config has baseValues + typeMultipliers`

**If missing:** Same submodule update as 4.2. If the file genuinely doesn't exist in the repo, the backend will use hardcoded defaults (non-fatal but a parity risk with the GM Scanner).

---

## 5. SSL/HTTPS Certificates

Web NFC (used by the GM Scanner for token scanning) requires a secure context (HTTPS). The server uses self-signed certificates stored in `backend/ssl/`. Without them, the server falls back to HTTP and NFC scanning will not work.

### 5.1 Certificate Files Exist [BOTH] — CRITICAL

**Check:**
```bash
test -f backend/ssl/cert.pem && test -f backend/ssl/key.pem && echo "OK: Both SSL files exist" || echo "MISSING"
```

**Expected:** `OK: Both SSL files exist`

**If missing:**
```bash
mkdir -p backend/ssl
openssl req -x509 -newkey rsa:2048 -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -days 365 -nodes -subj "/CN=aln-orchestrator"
```

**Note:** After generating new certs, every device (GM Scanner tablets, player phones) will need to re-trust the certificate by navigating to `https://<PI_IP>:3000/gm-scanner/` and accepting the browser warning.

### 5.2 Certificate Not Expired [BOTH] — REQUIRED

Self-signed certs are generated with a finite lifetime. An expired cert causes browser connection failures with no clear error on the server side.

**Check:**
```bash
openssl x509 -in backend/ssl/cert.pem -noout -dates 2>/dev/null
```

**Expected:** `notAfter` date should be in the future. Example:
```
notBefore=Mar  1 00:00:00 2026 GMT
notAfter=Mar  1 00:00:00 2027 GMT
```

**If expired:** Regenerate using the command in 5.1.

### 5.3 ENABLE_HTTPS Set in Environment [BOTH] — CRITICAL

The server defaults to `ENABLE_HTTPS=false` unless explicitly set. Without this, the server starts on HTTP and Web NFC will not function on any scanner.

**Check:**
```bash
grep -E '^ENABLE_HTTPS=' backend/.env 2>/dev/null || echo "NOT SET in .env"
```

**Expected:** `ENABLE_HTTPS=true`

**If not set or false:**
- If `backend/.env` exists, add or update the line: `ENABLE_HTTPS=true`
- If `backend/.env` doesn't exist, it will be created in Section 6
- The PM2 production config (`ecosystem.config.js`) sets `ENABLE_HTTPS: 'true'` in `env_production`, but only applies when started with `pm2 start ecosystem.config.js --env production`

---

## 6. Environment Configuration

The backend loads environment variables from `backend/.env` via the `dotenv` package at startup. The file `backend/.env.example` documents all variables with defaults.

### 6.1 .env File Exists [BOTH] — CRITICAL

**Check:**
```bash
test -f backend/.env && echo "OK: .env exists" || echo "MISSING"
```

**Expected:** `OK: .env exists`

**If missing:**
```bash
cp backend/.env.example backend/.env
```

Then review and edit the file — at minimum, set the values in checks 6.2–6.5 below.

### 6.2 JWT Secret Is Not Default [BOTH] — CRITICAL

The default JWT secret is a placeholder. Using it in production means any attacker who reads the source code can forge GM authentication tokens.

**Check:**
```bash
grep -E '^JWT_SECRET=' backend/.env | grep -v 'your-secret-key-here' | grep -v 'change-in-production' | grep -q . && echo "OK: Custom JWT secret set" || echo "INSECURE: Using default JWT secret"
```

**Expected:** `OK: Custom JWT secret set`

**If default:**
```bash
# Generate a random secret and set it:
NEW_SECRET=$(openssl rand -hex 32)
# Then edit backend/.env and set: JWT_SECRET=<the generated value>
```

### 6.3 HTTPS Enabled [BOTH] — CRITICAL

Already covered in Section 5.3, but verify it's present here as part of the full .env review.

**Check:**
```bash
grep -E '^ENABLE_HTTPS=true' backend/.env && echo "OK" || echo "NOT ENABLED"
```

### 6.4 Home Assistant Token [BOTH] — REQUIRED

Lighting control requires a Home Assistant long-lived access token. If empty, the lighting service disables itself gracefully (non-fatal, but no scene control).

**Check:**
```bash
HA_LINE=$(grep -E '^HOME_ASSISTANT_TOKEN=' backend/.env 2>/dev/null)
if [ -z "$HA_LINE" ] || [ "$HA_LINE" = "HOME_ASSISTANT_TOKEN=" ] || echo "$HA_LINE" | grep -q 'your-ha-long-lived-access-token'; then
  echo "NOT SET: Lighting will be disabled"
else
  echo "OK: HA token configured"
fi
```

**Expected:** `OK: HA token configured`

**If not set:**
- Open Home Assistant at `http://localhost:8123` (or the configured `HOME_ASSISTANT_URL`)
- Go to Profile → Long-Lived Access Tokens → Create Token
- Copy the token into `backend/.env` as `HOME_ASSISTANT_TOKEN=<token>`
- If Home Assistant is intentionally not used, this is acceptable — the service degrades gracefully

### 6.5 DISPLAY Variable [BOTH] — REQUIRED

VLC and the Chromium scoreboard driver both need an X11 display. The backend defaults to `:0` if unset, which is correct for the Pi's primary display. Only needs attention if running headless or with a non-standard display setup.

**Check:**
```bash
echo "DISPLAY=${DISPLAY:-not set (will default to :0)}"
```

**Expected:** `:0` or the appropriate display number for your setup.

**If running headless (no monitor attached):**
- VLC will fail to open a video window — this is expected if no display is connected
- Set `FEATURE_VIDEO_PLAYBACK=false` in `backend/.env` to disable VLC entirely

### 6.6 Full .env Sanity Check [BOTH] — REQUIRED

Verify critical variables are set. This runs from the `backend/` directory to access `dotenv`.

**Check:**
```bash
cd backend && node -e "
  require('dotenv').config();
  const critical = ['PORT', 'ENABLE_HTTPS', 'JWT_SECRET'];
  critical.forEach(k => {
    const v = process.env[k];
    console.log(k + '=' + (v ? '(set)' : 'MISSING'));
  });
" && cd ..
```

**Expected:** All three show `(set)`.

---

## 7. System Binaries

The backend spawns 9 external executables at runtime. Missing binaries cause the dependent service to report `down` in the health registry. This section checks each binary exists and is executable.

### 7.1 cvlc (VLC Headless) [BOTH] — REQUIRED

VLC video playback. `cvlc` is a shell script that `exec`s `/usr/bin/vlc` — after exec, the process name becomes `vlc`, not `cvlc`. Spawned by ProcessMonitor in `vlcMprisService.init()`.

**Check:**
```bash
which cvlc && cvlc --version 2>&1 | head -1 || echo "MISSING: cvlc not found"
```

**Expected:** Path (e.g., `/usr/bin/cvlc`) and a version line like `VLC media player 3.x.x`

**If missing:**
```bash
sudo apt-get update && sudo apt-get install -y vlc
```

### 7.2 dbus-send [BOTH] — REQUIRED

Used for D-Bus method calls to VLC and Spotify MPRIS interfaces, and for Spotify's TransferPlayback activation.

**Check:**
```bash
which dbus-send || echo "MISSING: dbus-send not found"
```

**Expected:** `/usr/bin/dbus-send`

**If missing:**
```bash
sudo apt-get install -y dbus
```

### 7.3 dbus-monitor [BOTH] — REQUIRED

Three ProcessMonitor instances run `dbus-monitor` for real-time state tracking: VLC MPRIS (session bus), Spotify MPRIS (session bus), BlueZ device changes (system bus).

**Check:**
```bash
which dbus-monitor || echo "MISSING: dbus-monitor not found"
```

**Expected:** `/usr/bin/dbus-monitor`

**If missing:** Same package as 7.2: `sudo apt-get install -y dbus`

### 7.4 pactl (PipeWire/PulseAudio Control) [BOTH] — REQUIRED

Audio routing service uses `pactl` for sink discovery, stream routing, volume control, and profile management. Also runs `pactl subscribe` via ProcessMonitor to watch for sink add/remove events.

**Check:**
```bash
which pactl && pactl info > /dev/null 2>&1 && echo "OK: pactl responding" || echo "ISSUE: pactl not found or not responding"
```

**Expected:** Path (e.g., `/usr/bin/pactl`) and `OK: pactl responding`

**If not found:**
```bash
sudo apt-get install -y pipewire-pulse
# or for PulseAudio setups:
sudo apt-get install -y pulseaudio-utils
```

**If found but not responding:**
- PipeWire/PulseAudio service may not be running
- Check: `systemctl --user status pipewire pipewire-pulse`
- Start: `systemctl --user start pipewire pipewire-pulse`

### 7.5 pw-play (PipeWire Audio Playback) [BOTH] — REQUIRED

Sound service uses `pw-play` to play WAV audio files (game clock alerts, attention sounds). The health check uses `which pw-play` to verify availability.

**Check:**
```bash
which pw-play || echo "MISSING: pw-play not found"
```

**Expected:** `/usr/bin/pw-play`

**If missing:**
```bash
sudo apt-get install -y pipewire
```

### 7.6 bluetoothctl & Bluetooth Adapter [BOTH] — REQUIRED

Bluetooth service uses `bluetoothctl` for device scanning, pairing, and connecting.

**Check:**
```bash
which bluetoothctl && bluetoothctl show 2>/dev/null | grep -E "Powered:" || echo "MISSING or no adapter"
```

**Expected:** Path and `Powered: yes`

**If not found:**
```bash
sudo apt-get install -y bluez
```

**If `Powered: no`:**
```bash
bluetoothctl power on
```

### 7.7 Paired Bluetooth Devices Available [BOTH] — REQUIRED

The show uses Bluetooth speakers for audio output. All expected speakers should be paired, connected, using the A2DP audio profile (not HFP/HSP which produces mono 16kHz garbled audio), and have their sink volume at 100%.

**Step 1 — List paired audio devices:**
```bash
bluetoothctl devices Paired
```

**Expected:** One or more lines like:
```
Device AA:BB:CC:DD:EE:FF Speaker Name
```

If no devices listed, speakers need to be paired first (done via the GM Scanner admin panel's Bluetooth section, or manually via `bluetoothctl`).

**Step 2 — Check connection status of each paired device:**

For each MAC address from Step 1:
```bash
bluetoothctl info AA:BB:CC:DD:EE:FF | grep -E "Connected:|Name:"
```

**Expected:** `Connected: yes` for each speaker.

**If `Connected: no`:**
```bash
bluetoothctl connect AA:BB:CC:DD:EE:FF
```

Wait a few seconds for PipeWire to register the Bluetooth sink.

**Step 3 — Verify A2DP profile (not HFP/HSP):**

Once connected, the device must use the `a2dp-sink` profile for high-quality stereo audio. The backend enforces this via `pactl set-card-profile`, but it should be verified independently.

For each connected device (replace colons with underscores in the MAC):
```bash
pactl list cards short | grep bluez_card
```

**Expected output:** One line per connected BT device, e.g.:
```
42	bluez_card.AA_BB_CC_DD_EE_FF	module-bluez5-device.c
```

Then check the active profile:
```bash
pactl list cards | grep -A 30 "bluez_card.AA_BB_CC_DD_EE_FF" | grep "Active Profile:"
```

**Expected:** `Active Profile: a2dp-sink`

**If shows `headset-head-unit` or `off` or anything other than `a2dp-sink`:**
```bash
pactl set-card-profile bluez_card.AA_BB_CC_DD_EE_FF a2dp-sink
```

**Naming conventions (MAC address translation):**
- bluetoothctl uses colons: `AA:BB:CC:DD:EE:FF`
- PipeWire card name uses underscores: `bluez_card.AA_BB_CC_DD_EE_FF`
- PipeWire sink name uses underscores with numeric suffix: `bluez_output.AA_BB_CC_DD_EE_FF.1`

**Note on sink naming:** PipeWire names Bluetooth sinks with a numeric suffix (e.g., `.1`), NOT with the profile name. The actual profile can be confirmed via the card's `Active Profile` field or the sink's `api.bluez5.profile` property in `pactl list sinks` output.

**Step 4 — Set Bluetooth sink volume to 100%:**

PipeWire Bluetooth sinks have their own volume level independent of application stream volumes. A low sink volume caps the maximum output regardless of app volume settings.

First, find the exact sink name:
```bash
pactl list sinks short | grep bluez_output
```

This returns the full sink name (e.g., `bluez_output.AA_BB_CC_DD_EE_FF.1`). Then set volume:
```bash
pactl set-sink-volume <FULL_SINK_NAME> 100%
```

Verify:
```bash
pactl list sinks | grep -A 10 "bluez_output" | grep -E "Name:|Volume:|Mute:"
```

**Expected:** Volume at 100%, Mute: no.

**Step 5 — Verify audio reaches the speaker:**

Quick functional test — play a short sound through the BT sink:
```bash
pw-play --target=<FULL_SINK_NAME> backend/public/audio/attention.wav
```

**Expected:** You hear the attention sound from the physical speaker. If silent, check the speaker's own hardware volume and power state.

### 7.8 docker [BOTH] — REQUIRED

Lighting service optionally manages a Home Assistant Docker container (start/stop lifecycle). Only used when `HA_DOCKER_MANAGE=true` in `.env` (the default).

**Check:**
```bash
which docker && sg docker -c 'docker info' > /dev/null 2>&1 && echo "OK: Docker accessible" || echo "ISSUE: Docker not found or not accessible"
```

**Note:** Docker commands need `sg docker -c '...'` wrapper on this system because the user is in the docker group but the shell doesn't inherit it.

**Expected:** `OK: Docker accessible`

**If not accessible:**
- Verify user is in docker group: `groups | grep docker`
- If not: `sudo usermod -aG docker $USER` (requires logout/login)
- If Docker service not running: `sudo systemctl start docker`

### 7.9 pgrep (Process Matching) [BOTH] — REQUIRED

Used by `vlcMprisService.init()` for audit logging of existing VLC processes at startup.

**Check:**
```bash
which pgrep || echo "MISSING: pgrep not found"
```

**Expected:** `/usr/bin/pgrep`

**If missing:**
```bash
sudo apt-get install -y procps
```

### 7.10 All Binaries Summary [BOTH] — REQUIRED

Quick one-shot verification of all 8 binaries.

**Check:**
```bash
for bin in cvlc dbus-send dbus-monitor pactl pw-play bluetoothctl docker pgrep; do
  printf "%-15s %s\n" "$bin" "$(which $bin 2>/dev/null || echo 'MISSING')"
done
```

**Expected:** All 8 show paths, no `MISSING`.

---

## 8. D-Bus & X11 Display

Three services use the D-Bus session bus (VLC MPRIS, Spotify MPRIS) and one uses the system bus (BlueZ). VLC and the Chromium scoreboard driver require an X11 display.

### 8.1 Session Bus Available [BOTH] — REQUIRED

The D-Bus session bus must be running for VLC and Spotify MPRIS communication.

**Check:**
```bash
dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1 && echo "OK: Session bus responding" || echo "FAIL: Session bus not available"
```

**Expected:** `OK: Session bus responding`

**If fails:**
- The `DBUS_SESSION_BUS_ADDRESS` env var may not be set
- Check: `echo $DBUS_SESSION_BUS_ADDRESS`
- On a Pi with desktop session, this is normally set automatically
- If running via SSH without a desktop session, D-Bus session bus may not exist — VLC and Spotify MPRIS will not function

### 8.2 System Bus Available [BOTH] — REQUIRED

The D-Bus system bus is used by the BlueZ monitor for Bluetooth device state changes.

**Check:**
```bash
dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1 && echo "OK: System bus responding" || echo "FAIL: System bus not available"
```

**Expected:** `OK: System bus responding`

**If fails:**
- System bus is managed by systemd: `sudo systemctl status dbus`
- Restart: `sudo systemctl restart dbus`

### 8.3 X11 Display Accessible [BOTH] — REQUIRED

VLC opens a fullscreen video window and the display driver launches Chromium in kiosk mode. Both require a working X11 display.

**Check:**
```bash
DISPLAY=${DISPLAY:-:0} xset q > /dev/null 2>&1 && echo "OK: Display ${DISPLAY:-:0} accessible" || echo "FAIL: Cannot connect to display ${DISPLAY:-:0}"
```

**Expected:** `OK: Display :0 accessible`

**If fails:**
- If running via SSH: `export DISPLAY=:0` (uses the Pi's local display)
- Verify a desktop session is running: `loginctl list-sessions` — look for a session with `Type=x11`
- Check X11 socket exists: `ls /tmp/.X11-unix/`
- If headless (no monitor): Set `FEATURE_VIDEO_PLAYBACK=false` in `backend/.env` and skip video-related checks

### 8.4 DBUS_SESSION_BUS_ADDRESS Exported [BOTH] — REQUIRED

When starting the server via SSH or PM2, the `DBUS_SESSION_BUS_ADDRESS` env var may not be inherited. Without it, all D-Bus session bus calls fail silently.

**Check:**
```bash
echo "DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-NOT SET}"
```

**Expected:** Something like `unix:path=/run/user/1000/bus` or `unix:abstract=/tmp/dbus-XXXXX`

**If not set:**
```bash
# Find the session bus address from a running desktop session:
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
# Verify it works:
dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1 && echo "OK" || echo "STILL FAILING"
```

**If starting via PM2:** Add `DBUS_SESSION_BUS_ADDRESS` to the `env_production` block in `backend/ecosystem.config.js`, or set it in `backend/.env`.

---

## 9. PipeWire / Audio Subsystem

The backend uses PipeWire (via its PulseAudio compatibility layer) for all audio routing, volume control, and sink management. Three audio streams are managed: VLC (video), spotifyd (Spotify), and pw-play (sound effects).

### 9.1 PipeWire Services Running [BOTH] — REQUIRED

PipeWire and its PulseAudio compatibility layer must both be active.

**Check:**
```bash
systemctl --user status pipewire pipewire-pulse --no-pager 2>&1 | grep -E "Active:"
```

**Expected:** Both show `active (running)`:
```
Active: active (running) ...
Active: active (running) ...
```

**If either is inactive:**
```bash
systemctl --user start pipewire pipewire-pulse
```

**If systemd user session not available (e.g., SSH without lingering):**
```bash
loginctl enable-linger $USER
systemctl --user start pipewire pipewire-pulse
```

### 9.2 pactl Responds [BOTH] — REQUIRED

Already verified the binary exists in Section 7.4, but now confirm the audio server is actually accepting commands.

**Check:**
```bash
pactl info 2>&1 | grep -E "Server Name:|Default Sink:"
```

**Expected:** Two lines showing the server name (should mention PipeWire) and a default sink:
```
Server Name: PulseAudio (on PipeWire 0.3.xx)
Default Sink: alsa_output.platform-...
```

**If `Connection refused` or `Connection failure`:**
- PipeWire-pulse is not running (see 9.1)
- Or `PULSE_SERVER` env var points to wrong socket
- Check: `echo $PULSE_SERVER` — should be empty (uses default) or `unix:/run/user/$(id -u)/pulse/native`

### 9.3 HDMI Sink Available [BOTH] — REQUIRED

HDMI is the default audio output (`AUDIO_DEFAULT_OUTPUT=hdmi`). The HDMI card profile must be active for audio to reach the projector/TV.

**Check:**
```bash
pactl list sinks short | grep -i hdmi
```

**Expected:** At least one HDMI sink listed, e.g.:
```
65	alsa_output.platform-XXXX.hdmi-stereo	PipeWire	s32le 2ch 48000Hz	IDLE
```

**If no HDMI sink:**

The HDMI card may exist but have its profile set to `off`. Check cards:
```bash
pactl list cards short
```

Look for a card with `hdmi` in the name, then activate it:
```bash
pactl set-card-profile <CARD_NAME> output:hdmi-stereo
```

**If no HDMI card at all:**
- The display/projector may not be connected or powered on — HDMI audio requires an active HDMI connection
- Check: `cat /sys/class/drm/card?-HDMI-A-*/status` — should show `connected`
- If headless: HDMI audio is unavailable, Bluetooth becomes the sole output

### 9.4 HDMI Sink Volume at 100% [BOTH] — REQUIRED

Same principle as Bluetooth sinks — the HDMI sink has its own volume level that caps all audio routed through it.

**Check:**
```bash
HDMI_SINK=$(pactl list sinks short | grep -i hdmi | awk '{print $2}')
if [ -n "$HDMI_SINK" ]; then
  pactl list sinks | grep -A 10 "$HDMI_SINK" | grep -E "Volume:|Mute:"
else
  echo "No HDMI sink found (see 9.3)"
fi
```

**Expected:** Volume at or near 100%, Mute: no.

**If not at 100%:**
```bash
pactl set-sink-volume <HDMI_SINK_NAME> 100%
```

### 9.5 Audio Functional Test [BOTH] — REQUIRED

Verify audio actually reaches the HDMI output with a quick sound test.

**Check:**
```bash
pw-play backend/public/audio/attention.wav
```

**Expected:** The attention sound plays audibly through the connected speaker/projector.

**If silent:**
- Verify the default sink is correct: `pactl info | grep "Default Sink:"`
- Set default to HDMI if needed: `pactl set-default-sink <HDMI_SINK_NAME>`
- Check projector/TV is not muted and is set to the correct HDMI input
- Check ALSA mixer levels: `amixer -c 0 sget Master` — should not show `[off]`

---

## 10. Video & Audio Asset Cross-Reference

Token definitions in `tokens.json` reference video and audio files by filename. This section cross-references every token's media fields against actual files on disk to catch missing assets before the show.

### 10.1 Token Video Files [BOTH] — CRITICAL

Tokens with a `video` field trigger VLC playback when scanned by a player scanner. A missing video file causes a `video:failed` event and a bad player experience.

**Check:**
```bash
node -e "
  const tokens = require('./ALN-TokenData/tokens.json');
  const fs = require('fs');
  const videoDir = 'backend/public/videos';
  let missing = 0, found = 0, total = 0;
  for (const [id, token] of Object.entries(tokens)) {
    if (token.video) {
      total++;
      const filePath = videoDir + '/' + token.video;
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size === 0) {
          console.log('EMPTY: ' + id + ' -> ' + token.video + ' (0 bytes)');
          missing++;
        } else {
          found++;
        }
      } else {
        console.log('MISSING: ' + id + ' -> ' + token.video);
        missing++;
      }
    }
  }
  console.log('\nVideo summary: ' + found + '/' + total + ' found, ' + missing + ' missing');
  if (missing > 0) process.exit(1);
"
```

**Expected:** All video tokens resolve to non-empty files. Output ends with:
```
Video summary: N/N found, 0 missing
```

**If any missing:**
- The video file needs to be placed in `backend/public/videos/`
- Filename must exactly match the token's `video` field value (case-sensitive on Linux)
- Video format: MP4 (H.264 for hardware-accelerated decode on Pi)

### 10.2 Token Audio Files [BOTH] — REQUIRED

Tokens with an `audio` field play audio when scanned by a player scanner. Audio files can be `.wav` or `.mp3`. They live in the scanner submodules' `assets/audio/` directories, but the backend itself does not serve them directly — player scanners load audio from their own bundled assets. This check verifies the source data is complete.

**Check:**
```bash
node -e "
  const tokens = require('./ALN-TokenData/tokens.json');
  const fs = require('fs');
  const audioDirs = ['aln-memory-scanner/assets/audio', 'ALNScanner/data/shared'];
  let missing = 0, found = 0, total = 0;
  for (const [id, token] of Object.entries(tokens)) {
    if (token.audio) {
      total++;
      const basename = token.audio.replace(/^assets\/audio\//, '');
      let fileFound = false;
      for (const dir of audioDirs) {
        if (fs.existsSync(dir + '/' + basename)) { fileFound = true; break; }
      }
      if (fileFound) {
        found++;
      } else {
        console.log('MISSING: ' + id + ' -> ' + token.audio);
        missing++;
      }
    }
  }
  console.log('\nAudio summary: ' + found + '/' + total + ' found, ' + missing + ' missing');
  if (missing > 0) process.exit(1);
"
```

**Expected:** All audio tokens resolve to files. A result of `0/0` means no tokens currently have audio assigned (this is valid — audio is optional per token).

### 10.3 Token Image Files [BOTH] — REQUIRED

Tokens with an `image` field display a memory image when scanned. Like audio, images are served from scanner submodule assets, not the backend directly.

**Check:**
```bash
node -e "
  const tokens = require('./ALN-TokenData/tokens.json');
  const fs = require('fs');
  let missing = 0, found = 0, total = 0;
  for (const [id, token] of Object.entries(tokens)) {
    if (token.image) {
      total++;
      const filePath = 'aln-memory-scanner/' + token.image;
      if (fs.existsSync(filePath)) {
        found++;
      } else {
        console.log('MISSING: ' + id + ' -> ' + token.image);
        missing++;
      }
    }
  }
  console.log('\nImage summary: ' + found + '/' + total + ' found, ' + missing + ' missing');
  if (missing > 0) process.exit(1);
"
```

**Expected:** All image tokens resolve to files.

### 10.4 Idle Loop Video [BOTH] — REQUIRED

When no token video is playing, VLC loops `idle-loop.mp4` on the display. This is the visual "screensaver" between scans. Controlled by the `FEATURE_IDLE_LOOP` feature flag (enabled by default if the file exists).

**Check:**
```bash
test -f backend/public/videos/idle-loop.mp4 && echo "OK: idle-loop.mp4 exists ($(du -h backend/public/videos/idle-loop.mp4 | cut -f1))" || echo "MISSING: idle-loop.mp4"
```

**Expected:** `OK: idle-loop.mp4 exists` with a non-trivial size (e.g., 65M)

**If missing:**
- The idle loop video must be placed at `backend/public/videos/idle-loop.mp4`
- Without it, the display shows a black/frozen screen between token scans
- If intentionally not using idle loop, set `FEATURE_IDLE_LOOP=false` in `backend/.env`

### 10.5 Sound Effect Files [BOTH] — REQUIRED

The sound service plays WAV files from `backend/public/audio/` for game clock alerts and cue-triggered sounds. These are distinct from token audio (which lives in scanner submodules).

**Check:**
```bash
echo "Sound effect files in backend/public/audio/:"
ls -lh backend/public/audio/ 2>/dev/null || echo "MISSING: audio directory does not exist"
```

**Expected:** At minimum these files (used by game clock and cue engine):
```
15min.wav
30min.wav
60min.wav
90min.wav
attention.wav
tension.wav
```

**Verify cue definitions don't reference missing sound files:**
```bash
node -e "
  const fs = require('fs');
  try {
    const cues = JSON.parse(fs.readFileSync('backend/config/environment/cues.json', 'utf8'));
    const cueArray = Array.isArray(cues) ? cues : (cues.cues || []);
    const audioDir = 'backend/public/audio';
    let missing = 0;
    for (const cue of cueArray) {
      if (cue.actions) {
        for (const action of cue.actions) {
          if (action.action === 'sound:play' && action.payload && action.payload.file) {
            const filePath = audioDir + '/' + action.payload.file;
            if (!fs.existsSync(filePath)) {
              console.log('MISSING: cue \"' + cue.name + '\" references ' + action.payload.file);
              missing++;
            }
          }
        }
      }
    }
    if (missing === 0) console.log('OK: All cue sound references resolve');
  } catch (e) {
    console.log('SKIP: Could not load cues.json (' + e.message + ')');
  }
"
```

**Expected:** `OK: All cue sound references resolve`

---

## 11. Static File Serving

The backend serves the GM Scanner, Player Scanner, and Scoreboard as static files from `backend/public/`. The GM Scanner and Player Scanner are served via symlinks into their respective submodule directories.

### 11.1 GM Scanner Symlink [BOTH] — CRITICAL

The GM Scanner PWA is served from `backend/public/gm-scanner/`, which is a symlink to `../../ALNScanner/dist`. This means the GM Scanner must be built (`npm run build`) for the symlink to resolve to actual files.

**Check:**
```bash
ls -la backend/public/gm-scanner 2>/dev/null | grep -E "^l" && echo "Symlink exists" || echo "MISSING: gm-scanner symlink"
```

**Verify the symlink target resolves and contains built files:**
```bash
test -f backend/public/gm-scanner/index.html && echo "OK: GM Scanner build present" || echo "MISSING: GM Scanner not built"
```

**Expected:** Both lines confirm the symlink exists and `index.html` is present.

**If symlink missing:**
```bash
ln -s ../../ALNScanner/dist backend/public/gm-scanner
```

**If symlink exists but `index.html` missing (not built):**
```bash
cd ALNScanner && npm ci && npm run build && cd ..
```

**Note:** Any source changes to the GM Scanner require a rebuild. E2E tests also require the build to be current — the backend serves the built output, not the dev server.

### 11.2 Player Scanner Symlink [BOTH] — CRITICAL

The Player Scanner is served from `backend/public/player-scanner/`, which is a symlink to `../../aln-memory-scanner`. The Player Scanner is vanilla JS with no build step — the symlink points directly to the submodule root.

**Check:**
```bash
ls -la backend/public/player-scanner 2>/dev/null | grep -E "^l" && echo "Symlink exists" || echo "MISSING: player-scanner symlink"
```

**Verify the symlink target resolves:**
```bash
test -f backend/public/player-scanner/index.html && echo "OK: Player Scanner present" || echo "MISSING: Player Scanner index.html"
```

**Expected:** Symlink exists and `index.html` is present.

**If symlink missing:**
```bash
ln -s ../../aln-memory-scanner backend/public/player-scanner
```

**If `index.html` missing:** The submodule is not initialized — run `git submodule update --init --recursive` (Section 4.1).

### 11.3 Scoreboard HTML [BOTH] — REQUIRED

The scoreboard is a static HTML page served directly from `backend/public/scoreboard.html`. It displays team scores and exposed memories during the game.

**Check:**
```bash
test -f backend/public/scoreboard.html && echo "OK: scoreboard.html present ($(du -h backend/public/scoreboard.html | cut -f1))" || echo "MISSING: scoreboard.html"
```

**Expected:** `OK: scoreboard.html present` with a non-trivial file size.

**If missing:** This file lives directly in the backend repo (not a submodule). If it's missing, the git checkout is incomplete:
```bash
git checkout -- backend/public/scoreboard.html
```

### 11.4 Player Scanner Token Data Accessible [BOTH] — REQUIRED

The Player Scanner loads token definitions from its own `data/tokens.json` (nested submodule). When served via the backend symlink, this resolves to `backend/public/player-scanner/data/tokens.json`.

**Check:**
```bash
test -f backend/public/player-scanner/data/tokens.json && echo "OK: Player Scanner token data accessible" || echo "MISSING: Player Scanner cannot load tokens"
```

**Expected:** `OK: Player Scanner token data accessible`

**If missing:** The nested submodule inside `aln-memory-scanner/` is not initialized:
```bash
cd aln-memory-scanner && git submodule update --init && cd ..
```

---

## 12. External Services

These are services running outside the Node.js process that the backend connects to at runtime.

### 12.1 Home Assistant Reachable [BOTH] — REQUIRED

Lighting control requires Home Assistant to be running and accessible at the configured URL.

**Check:**
```bash
HA_URL=$(grep -E '^HOME_ASSISTANT_URL=' backend/.env 2>/dev/null | cut -d= -f2-)
HA_URL=${HA_URL:-http://localhost:8123}
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${HA_URL}/api/" 2>/dev/null)
echo "Home Assistant at ${HA_URL}: HTTP ${STATUS:-unreachable}"
```

**Expected:** HTTP status `401` (unauthorized — means HA is running but needs a token) or `200` (authorized).

**If unreachable:**

Check if HA Docker container is running (the backend manages this automatically when `HA_DOCKER_MANAGE=true`, but pre-verifying saves startup time):
```bash
sg docker -c 'docker ps --filter name=homeassistant --format "{{.Status}}"' 2>/dev/null || echo "Docker not accessible"
```

**If container not running:**
```bash
sg docker -c 'docker start homeassistant'
```

**If container doesn't exist:** Home Assistant needs to be installed and configured separately. The backend's lighting service will log a warning and continue without scene control.

### 12.2 Home Assistant Token Valid [BOTH] — REQUIRED

If Home Assistant is reachable, verify the configured long-lived access token actually works.

**Check:**
```bash
HA_URL=$(grep -E '^HOME_ASSISTANT_URL=' backend/.env 2>/dev/null | cut -d= -f2-)
HA_URL=${HA_URL:-http://localhost:8123}
HA_TOKEN=$(grep -E '^HOME_ASSISTANT_TOKEN=' backend/.env 2>/dev/null | cut -d= -f2-)
if [ -z "$HA_TOKEN" ]; then
  echo "SKIP: No HA token configured"
else
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "Authorization: Bearer ${HA_TOKEN}" "${HA_URL}/api/states" 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo "OK: HA token valid"
  else
    echo "FAIL: HA token returned HTTP $STATUS (expected 200)"
  fi
fi
```

**Expected:** `OK: HA token valid`

**If `401`:** The token is expired or revoked. Generate a new one in HA: Profile → Long-Lived Access Tokens → Create Token.

**If `SKIP`:** No token configured — lighting service will disable itself gracefully.

### 12.3 spotifyd Running [BOTH] — REQUIRED

Spotify playback is managed by `spotifyd`, a Spotify Connect daemon. The backend does NOT start spotifyd — it must be running independently (typically as a systemd user service).

**Check:**
```bash
pgrep -a spotifyd && echo "OK: spotifyd running" || echo "NOT RUNNING: spotifyd not found"
```

**Expected:** `OK: spotifyd running`

**If not running:**
```bash
systemctl --user start spotifyd
```

**If systemd service not configured:**
- spotifyd may be installed but not set up as a service
- Check if binary exists: `which spotifyd`
- If installed, start manually: `spotifyd --no-daemon &`
- If not installed: the Spotify service will report `down` in the health registry but the server will start and run without Spotify

**Verify D-Bus registration:**
```bash
dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames 2>/dev/null | grep -i spotifyd && echo "OK: spotifyd on D-Bus" || echo "NOT REGISTERED: spotifyd not on session bus (may appear after first playback)"
```

**Note:** spotifyd may not register its D-Bus MPRIS name until it starts playing audio. The backend handles this gracefully — it will discover the D-Bus destination dynamically when playback begins.

### 12.4 Docker Service Running [BOTH] — REQUIRED

Docker is used by the lighting service to manage the Home Assistant container lifecycle.

**Check:**
```bash
sg docker -c 'docker info' > /dev/null 2>&1 && echo "OK: Docker daemon running" || echo "NOT RUNNING: Docker daemon not accessible"
```

**Expected:** `OK: Docker daemon running`

**If not running:**
```bash
sudo systemctl start docker
```

**Note:** Docker commands on this system require the `sg docker -c '...'` wrapper because the user's shell doesn't inherit the docker group membership without it.

---

## 13. Config Files

The backend loads two JSON config files at startup for the cue engine and audio ducking. Both are optional — missing files log a warning and continue with empty defaults — but a malformed file will silently break the feature.

### 13.1 Cue Definitions [BOTH] — REQUIRED

The cue engine fires timed actions during gameplay (sounds, lighting changes, video triggers). Cues are defined in a JSON file loaded at startup.

**Check:**
```bash
test -f backend/config/environment/cues.json && echo "OK: cues.json exists" || echo "MISSING: cues.json (cue engine will start empty)"
```

**Verify valid JSON and inspect contents:**
```bash
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('backend/config/environment/cues.json', 'utf8'));
  const cues = Array.isArray(data) ? data : (data.cues || []);
  console.log('OK: cues.json valid, ' + cues.length + ' cues defined');
  cues.forEach(c => console.log('  - ' + (c.name || c.id || 'unnamed') + ' (' + (c.actions ? c.actions.length : 0) + ' actions)'));
"
```

**Expected:** `OK: cues.json valid, N cues defined` followed by a list of cue names.

**If parse error:** Fix the JSON syntax. Common issues: trailing commas, unescaped quotes in strings.

**If missing:** The cue engine starts with no cues loaded. This is non-fatal but means no timed game events will fire. The file supports both plain array `[{...}]` and wrapped `{"cues": [{...}]}` formats.

### 13.2 Audio Routing / Ducking Rules [BOTH] — REQUIRED

Ducking rules auto-lower Spotify volume when video or sound effects play, then restore it. Defined in the routing config file.

**Check:**
```bash
test -f backend/config/environment/routing.json && echo "OK: routing.json exists" || echo "MISSING: routing.json (ducking engine will be inactive)"
```

**Verify valid JSON and inspect ducking rules:**
```bash
node -e "
  const fs = require('fs');
  const data = JSON.parse(fs.readFileSync('backend/config/environment/routing.json', 'utf8'));
  if (data.ducking && Array.isArray(data.ducking)) {
    console.log('OK: routing.json valid, ' + data.ducking.length + ' ducking rules');
    data.ducking.forEach(r => console.log('  - trigger: ' + r.trigger + ', target: ' + r.target + ', volume: ' + r.duckVolume + '%'));
  } else {
    console.log('WARNING: routing.json has no ducking array — ducking engine will be inactive');
  }
"
```

**Expected:** `OK: routing.json valid, N ducking rules` with listed rules.

**If parse error:** Fix the JSON syntax.

**If missing or no ducking array:** Non-fatal. Spotify will play at full volume even during video/sound playback. This may be intentional for simple setups.

### 13.3 Scoring Config Matches Across Components [BOTH] — REQUIRED

Already verified in Section 4.4 that `scoring-config.json` exists and has the right keys. This check verifies the backend's loaded scoring values actually match the shared config (in case env var overrides or code defaults have diverged).

**Check:**
```bash
cd backend && node -e "
  const shared = require('../ALN-TokenData/scoring-config.json');
  const config = require('./src/config/index.js');
  const bv = config.game.valueRatingMap;
  const tm = config.game.typeMultipliers;
  let issues = 0;
  for (const [rating, value] of Object.entries(shared.baseValues)) {
    if (bv[rating] !== value) {
      console.log('MISMATCH: baseValues[' + rating + '] shared=' + value + ' backend=' + bv[rating]);
      issues++;
    }
  }
  for (const [type, mult] of Object.entries(shared.typeMultipliers)) {
    const key = type.toLowerCase();
    if (tm[key] !== mult) {
      console.log('MISMATCH: typeMultipliers[' + type + '] shared=' + mult + ' backend=' + tm[key]);
      issues++;
    }
  }
  console.log(issues === 0 ? 'OK: Scoring config matches shared config' : issues + ' mismatches found');
" && cd ..
```

**Expected:** `OK: Scoring config matches shared config`

**If mismatches:** Check `backend/.env` for scoring-related env var overrides. The backend's `config/index.js` loads from the shared config but env vars can override individual values. Remove any stale overrides unless they're intentional.

---

## 14. Data Persistence Directory

The backend persists session state, audio routing config, and token data to `backend/data/` using the `node-persist` library. This directory must be writable and in a known state.

### 14.1 Data Directory Exists and Is Writable [BOTH] — CRITICAL

**Check:**
```bash
test -d backend/data && test -w backend/data && echo "OK: data/ exists and is writable" || echo "FAIL: data/ missing or not writable"
```

**Expected:** `OK: data/ exists and is writable`

**If missing:**
```bash
mkdir -p backend/data
```

**If not writable:**
```bash
chmod 755 backend/data
```

### 14.2 Stale Session State [WARM] — REQUIRED

After a server stop, session state is preserved to disk for warm restart recovery. On a `[COLD]` start for a fresh show, stale session data from a previous game can cause confusion (old teams, old scores appearing).

**Check:**
```bash
FILE_COUNT=$(ls backend/data/ 2>/dev/null | wc -l)
echo "Persistence files: $FILE_COUNT"
if [ "$FILE_COUNT" -gt 0 ]; then
  echo "Data directory contains persisted state from a previous run"
  ls -lhS backend/data/ | head -10
fi
```

**Expected for fresh show:** `Persistence files: 0` (clean start)
**Expected for warm restart:** Files present — the server will restore the previous session.

**If starting a fresh show and old data is present:**
```bash
rm -f backend/data/*
```

**Warning:** Only clear persistence data if you are intentionally starting a brand new game. If the server crashed mid-show and you're restarting, the persisted session is how scores and transactions are recovered.

### 14.3 Disk Space for Persistence [BOTH] — REQUIRED

Session files grow during gameplay as transactions accumulate. A typical 2-hour game with active scanning produces session files in the 50–150KB range.

**Check:**
```bash
df -h backend/data/ | awk 'NR==2 {print "Available: " $4}'
```

**Expected:** At least 100MB free (persistence files are small, but logs in `backend/logs/` share the same filesystem).

**If low:** See Section 1.3 remediation for disk space.

### 14.4 Log Directory Exists [BOTH] — REQUIRED

Winston logger writes to `backend/logs/`. If the directory doesn't exist, the server may fail to start or lose log output.

**Check:**
```bash
test -d backend/logs && test -w backend/logs && echo "OK: logs/ exists and is writable" || echo "FAIL: logs/ missing or not writable"
```

**Expected:** `OK: logs/ exists and is writable`

**If missing:**
```bash
mkdir -p backend/logs
```

**Check for oversized log files from previous runs:**
```bash
du -sh backend/logs/ 2>/dev/null
ls -lhS backend/logs/ | head -5
```

**If logs directory is large (>500MB):**
- See `logs/README_LOG_ARCHIVAL.md` for the archival procedure
- At minimum, rotate current logs before starting:
```bash
for f in backend/logs/*.log; do
  [ -f "$f" ] && mv "$f" "${f}.$(date +%Y%m%d-%H%M%S).bak"
done
```

---

## 15. Pre-Start Summary

After completing all sections above, produce a summary table:

```bash
echo "===== ALN Pre-Flight Summary ====="
echo ""
echo "System:"
echo "  Node.js:     $(node --version 2>/dev/null || echo 'MISSING')"
echo "  Disk free:   $(df -h / | awk 'NR==2 {print $4}')"
echo "  RAM avail:   $(free -m | awk '/^Mem:/ {print $7 "MB"}')"
echo "  CPU temp:    $(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"
echo ""
echo "Ports:"
echo "  3000 (HTTPS):  $(ss -tlnp | grep -q ':3000 ' && echo 'IN USE' || echo 'available')"
echo "  8000 (HTTP):   $(ss -tlnp | grep -q ':8000 ' && echo 'IN USE' || echo 'available')"
echo "  8888 (UDP):    $(ss -ulnp | grep -q ':8888 ' && echo 'IN USE' || echo 'available')"
echo ""
echo "Data:"
echo "  tokens.json:    $(test -f ALN-TokenData/tokens.json && echo 'OK' || echo 'MISSING')"
echo "  scoring-config: $(test -f ALN-TokenData/scoring-config.json && echo 'OK' || echo 'MISSING')"
echo "  SSL certs:      $(test -f backend/ssl/cert.pem && test -f backend/ssl/key.pem && echo 'OK' || echo 'MISSING')"
echo "  .env:           $(test -f backend/.env && echo 'OK' || echo 'MISSING')"
echo ""
echo "Binaries:"
for bin in cvlc dbus-send dbus-monitor pactl pw-play bluetoothctl docker pgrep; do
  printf "  %-15s %s\n" "$bin:" "$(which $bin > /dev/null 2>&1 && echo 'OK' || echo 'MISSING')"
done
echo ""
echo "Services:"
echo "  PipeWire:       $(systemctl --user is-active pipewire 2>/dev/null || echo 'unknown')"
echo "  PipeWire-Pulse: $(systemctl --user is-active pipewire-pulse 2>/dev/null || echo 'unknown')"
echo "  spotifyd:       $(pgrep spotifyd > /dev/null 2>&1 && echo 'running' || echo 'not running')"
echo "  Docker:         $(sg docker -c 'docker info' > /dev/null 2>&1 && echo 'running' || echo 'not running')"
echo "  Home Assistant:  $(HA_URL=$(grep -E '^HOME_ASSISTANT_URL=' backend/.env 2>/dev/null | cut -d= -f2-); curl -s -o /dev/null -w '%{http_code}' --max-time 3 ${HA_URL:-http://localhost:8123}/api/ 2>/dev/null || echo 'unreachable')"
echo "  D-Bus session:  $(dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1 && echo 'OK' || echo 'FAIL')"
echo "  D-Bus system:   $(dbus-send --system --dest=org.freedesktop.DBus --type=method_call --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames > /dev/null 2>&1 && echo 'OK' || echo 'FAIL')"
echo "  DISPLAY:        ${DISPLAY:-not set}"
echo ""
echo "Static Serving:"
echo "  GM Scanner:     $(test -f backend/public/gm-scanner/index.html && echo 'OK' || echo 'MISSING/NOT BUILT')"
echo "  Player Scanner: $(test -f backend/public/player-scanner/index.html && echo 'OK' || echo 'MISSING')"
echo "  Scoreboard:     $(test -f backend/public/scoreboard.html && echo 'OK' || echo 'MISSING')"
echo "  Idle loop:      $(test -f backend/public/videos/idle-loop.mp4 && echo 'OK' || echo 'MISSING')"
echo ""
echo "Persistence:"
echo "  data/ dir:      $(test -d backend/data && test -w backend/data && echo 'OK' || echo 'FAIL')"
echo "  logs/ dir:      $(test -d backend/logs && test -w backend/logs && echo 'OK' || echo 'FAIL')"
echo "  Session files:  $(ls backend/data/ 2>/dev/null | wc -l) files"
echo ""
echo "===== End Pre-Flight ====="
```

If all items show OK/available/running, the system is ready to start:
```bash
cd backend && npm start
# Or for development:
cd backend && npm run dev:full
```

If any items show MISSING/FAIL/IN USE, refer back to the relevant section for remediation steps before starting.
