# ALN Ecosystem Deployment Guide

## System Overview

The About Last Night (ALN) Ecosystem is a memory token scanning and video playback system designed for a 2-hour immersive game. It supports two deployment modes:

1. **Networked Mode** - Full integration with orchestrator server, video playback, session management, real-time sync
2. **Standalone Mode** - Scanners work independently via GitHub Pages, no server infrastructure required

**IMPORTANT**: These are mutually exclusive deployment choices made at game setup time, not fallback mechanisms. Networked mode has its own resilience features (offline queue, localStorage backup) for handling temporary network issues.

## Prerequisites

### Required Software
- **Node.js 20+** or **22+** (LTS recommended)
- **VLC Media Player** (for video output)
- **PM2** (for production deployment)
- **Git** with submodule support
- **Python 3** (for local scanner testing)

### Hardware Requirements
- **Minimum RAM**: 256MB (Raspberry Pi), 512MB (Desktop)
- **Storage**: 500MB for application + space for videos
- **Display**: HDMI or monitor for video output
- **Network**: WiFi or Ethernet for scanner connectivity

## Installation

### 1. Clone Repository with Submodules

```bash
# Clone with all submodules
git clone --recurse-submodules https://github.com/[user]/ALN-Ecosystem.git
cd ALN-Ecosystem

# If already cloned without submodules
git submodule update --init --recursive
```

### 2. Platform-Specific Setup

#### Ubuntu/Debian (Including Raspberry Pi OS)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install VLC, MPD, and display management tools
sudo apt-get update
sudo apt-get install -y vlc mpd xdotool wmctrl

# Disable the system MPD — the orchestrator spawns and supervises its own
# MPD instance via ProcessMonitor.
sudo systemctl stop mpd && sudo systemctl disable mpd
sudo systemctl stop mpd.socket 2>/dev/null && sudo systemctl disable mpd.socket 2>/dev/null

# Install PM2 globally
sudo npm install -g pm2

# Setup backend
cd backend
npm install
```

After install, regenerate the All Tracks bootstrap playlist whenever MP3 files
under `backend/public/music/` change:

```bash
cd backend && npm run music:seed
```

The orchestrator controls MPD over the Unix socket `/tmp/aln-mpd.sock` using
the `mpd2` Node client. MPD's audio output is named `aln-music`, which is the
identifier `audioRoutingService` matches on (`pactl list sink-inputs | grep -i aln-music`).

#### Windows (WSL2)

```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install VLC (requires X server like VcXsrv)
sudo apt update
sudo apt install -y vlc

# Set DISPLAY for GUI apps
echo 'export DISPLAY=:0' >> ~/.bashrc
source ~/.bashrc

# Install PM2
npm install -g pm2

# Setup backend
cd backend
npm install
```

#### macOS

```bash
# Install Node.js via Homebrew
brew install node@20

# Install VLC
brew install --cask vlc

# Install PM2
npm install -g pm2

# Setup backend
cd backend
npm install
```

### 3. Configure Environment

Create `.env` file in backend directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your settings. A production Raspberry Pi minimally
sets:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# HTTPS (required for Web NFC)
ENABLE_HTTPS=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem
HTTP_REDIRECT_PORT=8000

# Security — change both
ADMIN_PASSWORD=choose-a-strong-password
JWT_SECRET=choose-a-long-random-secret

# Video + display
ENABLE_VIDEO_PLAYBACK=true
FEATURE_IDLE_LOOP=true

# Environment control (lighting)
HOME_ASSISTANT_URL=http://localhost:8123
HOME_ASSISTANT_TOKEN=your-ha-long-lived-access-token
LIGHTING_ENABLED=true

# Logging
LOG_LEVEL=info
```

The full key reference below is authoritative against
`backend/src/config/index.js` (the engine's single env intake) plus
the four service-direct reads (`VLC_HW_ACCEL`, `FEATURE_IDLE_LOOP`,
`DISCOVERY_UDP_PORT`, `ENABLE_MUSIC_PLAYBACK`). Verified 2026-09-05.

#### Environment Variables Explained

##### Server Configuration

- **NODE_ENV** (`development` | `test` | `production`)
  - `development`: Enables debug logging, hot reload, detailed error messages
  - `test`: Used for running tests, disables rate limiting
  - `production`: Optimized performance, minimal logging, security features enabled
  - Default: `development`

- **PORT** (number)
  - TCP port for the HTTP/WebSocket server
  - Common values: `3000` (development), `80` (production HTTP), `443` (production HTTPS)
  - Ensure port is not in use: `lsof -i :3000`
  - Default: `3000`

- **HOST** (IP address)
  - Network interface to bind to
  - `0.0.0.0`: Listen on all network interfaces (recommended for network access)
  - `127.0.0.1` or `localhost`: Local access only (more secure but no network access)
  - Default: `0.0.0.0`

##### VLC Configuration

VLC is controlled via **D-Bus MPRIS** (`org.mpris.MediaPlayer2.vlc`) — there is **no HTTP interface, password, or port**. VLC is auto-spawned and supervised by the orchestrator (`vlcMprisService.init()` via `ProcessMonitor`); you do not start or configure it separately.

- **VLC_HW_ACCEL** (string, optional)
  - The only VLC-related environment variable.
  - Overrides the auto-detected hardware-acceleration / video-output args passed to VLC.
  - On a Raspberry Pi 5 the auto-detected value is `--vout=gles2`.
  - Set to an empty string to pass no extra args, or a space-separated arg list to override.
  - Default: auto-detected per platform (`vlcMprisService._getHwAccelArgs()`)

##### Feature Flags

- **ENABLE_VIDEO_PLAYBACK** (`true` | `false`)
  - `true`: Enable VLC integration and video playback
  - `false`: Disable video features (scanner-only mode)
  - Use `false` if VLC not available or for testing without video
  - Default: `true`

- **FEATURE_IDLE_LOOP** (`true` | `false`)
  - `false`: skip playing the idle-loop video when nothing else is
    playing (useful during hands-on development)
  - Read directly by `vlcMprisService`
  - Default: `true`

- **ENABLE_MUSIC_PLAYBACK** (`true` | `false`)
  - `false`: skip spawning MPD entirely (tests/CI without audio
    hardware). When unset/true the orchestrator spawns and
    supervises its own MPD via ProcessMonitor (socket
    `/tmp/aln-mpd.sock`)
  - Read directly by `app.js`
  - Default: `true`

(The offline GM-transaction queue is always active — there is no `ENABLE_OFFLINE_MODE` flag.)

##### Pack and Installation Profile

- **PACK_PATH** (directory path)
  - Points the ENTIRE engine (rules, tokens, pack channel) at an
    alternate game-pack directory instead of the in-repo
    `ALN-TokenData/`. Frozen at boot by `packService.activatePack()`.
  - Logs a LOUD warning when active — a production machine should
    normally NOT set it (it is the harness/rollback seam; see "Game
    Pack Rollback" below)
  - Default: unset (the in-repo `ALN-TokenData/` pack)

- **PROFILE_PATH** (file path)
  - Points the engine at an alternate installation profile (the
    venue document — see "Installation Profile" below). Loud warning
    when active.
  - Default: unset (`backend/config/profiles/aln-full-kit.json`)

##### Display / Kiosk

- **IDLE_LOOP_FILE** (filename)
  - The idle-loop video's filename inside `VIDEO_DIR`; one key for
    all three `vlcMprisService` sites (init play, return play,
    existence guard). NOTE: on the current tree the installation
    profile's `bindings.surfaces` entry for the pack's idle-loop
    channel is the primary source; this key is the loud fallback
    (ledger L12).
  - Default: `idle-loop.mp4`

- **SCOREBOARD_WINDOW_MARKER** (string)
  - The FUNCTIONAL window-title marker `displayDriver` uses to find
    the scoreboard Chromium window (xdotool) and the server injects
    into the served page's `<title>`. Both sides follow this one
    key — never rebrand either side independently.
  - Default: `ALN-SCOREBOARD`

- **CHROMIUM_BIN** (path)
  - Overrides the browser binary `displayDriver` spawns for the
    scoreboard kiosk (a test-environment seam; the hardware default
    is right for Raspberry Pi OS)
  - Default: `chromium-browser`

##### Network Configuration

- **CORS_ORIGINS** (comma-separated URLs)
  - Allowed origins for cross-origin requests
  - Format: `protocol://host:port,protocol://host2:port2`
  - Example: `http://localhost:3000,http://192.168.1.100:3000,https://example.com`
  - Leave empty to allow configured defaults
  - Add scanner GitHub Pages URLs if using hybrid mode
  - Default: Allows localhost and local network IPs

##### Logging Configuration

- **LOG_LEVEL** (`error` | `warn` | `info` | `debug`)
  - `error`: Only critical errors
  - `warn`: Errors and warnings
  - `info`: Normal operation logs (recommended for production)
  - `debug`: Detailed debugging information
  - Default: `info`

- **LOGS_DIR** (path)
  - Log directory
  - Default: `./logs`

(`LOG_TO_FILE` is not read by the engine — logging always writes to
`LOGS_DIR` under PM2; the key survives only in old notes.)

##### Session Configuration

- **SESSION_TIMEOUT** (**minutes** — NOT milliseconds; the engine
  parses this as minutes, `config/index.js:41`)
  - How long before an inactive session expires
  - `120` = 2 hours (default)
  - Default: `120`

- **DATA_DIR** (path)
  - Where to store persistent data (sessions, state, backups)
  - Relative paths are from backend directory
  - Default: `./data`
  - (The engine reads `DATA_DIR`; the old `PERSISTENCE_DIR` key is
    dead — it is read nowhere.)

##### Video Configuration

- **VIDEO_DIR** (path)
  - Directory containing video files (including the idle loop)
  - Default: `./public/videos`

(`MAX_QUEUE_SIZE`, `VIDEO_TRANSITION_DELAY`, and
`DEFAULT_VIDEO_DURATION` are NOT read by the engine — dead keys from
an older architecture.)

##### Discovery Service

- **DISCOVERY_UDP_PORT** (number)
  - UDP port for discovery broadcasts
  - Scanners can automatically find orchestrator
  - Read directly by `discoveryService`; the template's old
    `DISCOVERY_ENABLED`/`DISCOVERY_PORT`/`DISCOVERY_INTERVAL` keys
    are dead
  - Default: `8888`

##### Environment Control (lighting, audio, Bluetooth)

- **LIGHTING_ENABLED** (`true` | `false`) — set `false` to run with
  no Home Assistant at all (lighting reports down/absent instead of
  erroring). Default: `true`
- **HOME_ASSISTANT_URL** — the HA instance the lighting service
  drives. Default: `http://localhost:8123`
- **HOME_ASSISTANT_TOKEN** — an HA long-lived access token (see the
  Home Assistant section below). Default: empty (lighting disables
  itself gracefully)
- **HA_DOCKER_MANAGE** (`true` | `false`) — when true the backend
  auto-starts/stops the HA Docker container around its own
  lifecycle. Default: `true`
- **HA_DOCKER_CONTAINER** — the container name it manages.
  Default: `homeassistant`
- **HA_DOCKER_STOP_TIMEOUT** (seconds) — graceful-stop window before
  SIGKILL. Default: `10`
- **AUDIO_DEFAULT_OUTPUT** (`hdmi` | sink name) — default audio
  routing target. Default: `hdmi`
- **BLUETOOTH_SCAN_TIMEOUT_SEC** / **BLUETOOTH_CONNECT_TIMEOUT_SEC**
  — BT discovery/connect timeouts. Defaults: `15` / `10`

##### Rarely-changed keys (complete for reference; defaults are fine)

| Key | Default | What it is |
|---|---|---|
| `MAX_PLAYERS` / `MAX_GM_STATIONS` | 10 / 5 | session limits |
| `DUPLICATE_WINDOW` | 5 (seconds) | duplicate-scan window |
| `STORAGE_TYPE` | `file` (`memory` under test) | persistence backend |
| `BACKUP_INTERVAL` | 100 (transactions) | backup cadence |
| `ARCHIVE_AFTER` | 24 (hours) | session archive age |
| `TRANSACTION_HISTORY_LIMIT` | 1000 | kept transactions |
| `RECENT_TRANSACTIONS_COUNT` | 10 | recent-list size |
| `LOG_FORMAT` / `LOG_MAX_FILES` / `LOG_MAX_SIZE` | `json` / 5 / `10m` | log rotation |
| `ENABLE_ADMIN_PANEL` | `true` | admin surface flag |
| `ENABLE_DEBUGGING` | `false` | verbose debug flag |
| `WS_PING_INTERVAL` / `WS_PING_TIMEOUT` / `WS_MAX_PAYLOAD` | 25000 / 60000 / 1000000 | WebSocket tuning |
| `TEST_ADMIN_PASSWORD` | unset | E2E-test-only override (never set in production) |

##### Security Settings (Production)

- **RATE_LIMIT_WINDOW** (milliseconds)
  - Time window for rate limiting
  - `60000` = 1 minute (default)
  - Default: `60000`

- **RATE_LIMIT_MAX** (number)
  - Maximum requests per window per IP
  - Prevents API abuse
  - Default: `100`

- **ADMIN_PASSWORD** (string)
  - Password for admin panel and WebSocket authentication
  - Required for GM Scanner connections
  - Generate strong password for production
  - The served scoreboard page receives its credential at SERVE TIME
    (`resourceRoutes` injection) — changing this key requires NO
    file edits anywhere else
  - Default: `admin`

- **JWT_SECRET** (string)
  - Secret key for signing JWT tokens
  - **CRITICAL**: Change in production
  - Default: `change-this-secret-in-production`

- **JWT_EXPIRY** (string)
  - JWT token expiration time
  - Default: `24h`

#### Example Configurations

##### Development Setup
```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
ENABLE_VIDEO_PLAYBACK=true
ENABLE_HTTPS=true
```

##### Production Raspberry Pi
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
ENABLE_VIDEO_PLAYBACK=true
ENABLE_HTTPS=true
SESSION_TIMEOUT=120
DATA_DIR=/var/lib/aln-orchestrator
ADMIN_PASSWORD=ChangeMeInProduction!
JWT_SECRET=your-unique-secret-key-here
```

##### Scanner-Only Mode (No Video)
```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
ENABLE_VIDEO_PLAYBACK=false
ENABLE_HTTPS=true
```

##### High-Security Setup
```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1
CORS_ORIGINS=https://trusted-domain.com
RATE_LIMIT_MAX=50
ADMIN_PASSWORD=VerySecureAdminPass123!
JWT_SECRET=your-very-long-random-secret-key
LOG_LEVEL=warn
ENABLE_HTTPS=true
```

## HTTPS Deployment

### Overview

**CRITICAL**: The system requires HTTPS because the Web NFC API (used by GM Scanner) only works in secure contexts. The backend serves HTTPS on port 3000 and redirects HTTP (port 8000) to HTTPS.

### SSL Certificate Setup

Generate a self-signed certificate (valid 365 days):

```bash
cd backend
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

For production with domain name:
```bash
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -subj "/CN=your-pi-hostname.local"
```

### Environment Configuration

Add to `.env`:

```env
ENABLE_HTTPS=true
SSL_KEY_PATH=./ssl/key.pem
SSL_CERT_PATH=./ssl/cert.pem
HTTP_REDIRECT_PORT=8000
```

**Architecture:**
- **HTTPS Server**: Port 3000 (primary, supports NFC)
- **HTTP Redirect**: Port 8000 (301 redirect to HTTPS:3000)
- Discovery service advertises `protocol: "https"`

### Scanner Protocol Defaults

**GM Scanner:**
- Defaults to `https://` protocol (required for Web NFC)
- Configured in `ALNScanner/src/network/connectionManager.js` (constructor default `url: config.url || 'https://localhost:3000'`)

**Player Scanner (Web):**
- Uses `window.location.origin` or `https://localhost:3000`
- Auto-detects protocol from browser

**ESP32 Scanner:**
- Uses `WiFiClientSecure` for HTTPS
- Supports both `http://` and `https://` in config.txt
- Auto-upgrades `http://` → `https://` URLs
- Downloads certificates from server on boot

### Certificate Trust Workflow

Since the certificate is self-signed, each client device requires one-time certificate trust:

**Browser-Based Scanners (GM/Player):**
1. Navigate to `https://[PI-IP]:3000/gm-scanner/` or `/player-scanner/`
2. Browser shows "Your connection is not private" warning
3. Click "Advanced" → "Proceed to [PI-IP] (unsafe)"
4. Certificate is trusted for this browser/device
5. NFC API now works (GM Scanner only)

**ESP32 Scanner:**
- No trust workflow needed
- WiFiClientSecure accepts self-signed certificates by default
- Validates connection but doesn't enforce CA chain

### Real Domain Certificate (spike S2 — OPEN, procedure home)

The self-signed certificate above is the working default and stays
so until spike S2 passes. S2's goal: a real certificate on a real
domain, issued via a DNS-01 challenge against a Cloudflare-managed
domain — which removes the per-device trust workflow entirely and is
the prerequisite for the players'-phones work (tap-to-web cannot ask
guests to click through a certificate warning).

The spike runs during the home hardware pass (Stage B; ROADMAP §6).
Planned shape, to be verified and recorded by the spike itself:

1. A domain managed in Cloudflare, with an API token scoped to DNS
   edits for that zone.
2. `certbot` with the `dns-cloudflare` plugin issues a certificate
   for the kit's hostname (or a wildcard) via DNS-01 — no inbound
   port 80/443 needed, so it works behind the kit router.
3. The issued key/cert are pointed at by `SSL_KEY_PATH` /
   `SSL_CERT_PATH` in `.env` (the engine needs no other change).
4. Renewal is certbot's standard timer; the renewal hook restarts
   the orchestrator (`pm2 restart aln-orchestrator`) so the new cert
   is picked up.
5. The kit's DNS name must resolve to the orchestrator's reserved
   LAN IP for devices on the kit network (router DNS entry or
   public DNS A record to the private IP — the spike decides which).

Record the spike's outcome (exact commands, gotchas, renewal
verification) in this section when it runs; until then this section
is the procedure's home, not its proof.

### Troubleshooting HTTPS Issues

**Mixed Content Errors:**
```
Blocked loading mixed active content "http://..."
```
- **Cause**: HTTPS page trying to load HTTP resources
- **Fix**: Ensure all scanners use `https://` in connection URLs
- **Check**: GM Scanner `connectionManager.js`, Player Scanner origin detection

**Discovery Fails:**
```
Scanner can't find orchestrator via UDP broadcast
```
- **Cause**: `ENABLE_HTTPS=false` or missing in `.env`
- **Fix**: Verify `ENABLE_HTTPS=true` in backend/.env
- **Check**: Discovery service advertises correct protocol

**Certificate Errors on Reconnect:**
```
NET::ERR_CERT_DATE_INVALID
```
- **Cause**: Certificate expired (365-day validity)
- **Fix**: Regenerate certificate with openssl command above
- **Note**: Clients will need to trust new certificate (clear browser cache)

**NFC Not Working (GM Scanner):**
```
NotAllowedError: Web NFC is not allowed in insecure contexts
```
- **Cause**: GM Scanner loaded over HTTP instead of HTTPS
- **Fix**: Ensure URL uses `https://` protocol
- **Check**: Browser address bar shows padlock icon

**Port Already in Use:**
```
Error: listen EADDRINUSE: address already in use :::3000
```
- **Cause**: Another process using port 3000 or 8000
- **Fix**: `lsof -i :3000` to find process, `kill -9 <PID>`
- **Or**: Change `PORT` in `.env` (update scanner configs too)

### Network URLs (HTTPS Enabled)

- **Orchestrator**: `https://[IP]:3000`
- **GM Scanner**: `https://[IP]:3000/gm-scanner/` (HTTPS required for NFC)
- **Player Scanner**: `https://[IP]:3000/player-scanner/`
- **Scoreboard**: `https://[IP]:3000/scoreboard`

(VLC has no network control endpoint — it is controlled locally via D-Bus MPRIS.)

### Verification

Test HTTPS setup:

```bash
# Check HTTPS server responds
curl -k https://localhost:3000/health

# Check HTTP redirect works
curl -I http://localhost:8000

# Expected: HTTP/1.1 301 Moved Permanently
# Location: https://localhost:3000/
```

## Token Configuration

### CRITICAL: Token Media Path Format

The `ALN-TokenData/tokens.json` file is shared between scanners and orchestrator via git submodules. Different components use different media types:

```json
{
  "534e2b03": {
    "video": "test_30sec.mp4",              // Orchestrator: plays from backend/public/videos/
    "audio": "assets/audio/534e2b03.mp3",   // Scanners: play locally from scanner's data/assets/
    "image": "assets/images/534e2b03.jpg",  // Scanners: display locally from scanner's data/assets/
    "processingImage": "assets/images/processing.jpg", // Scanners: local loading image
    "SF_RFID": "534e2b03",
    "SF_ValueRating": 3,
    "SF_MemoryType": "Technical"
  }
}
```

### Path Rules by Media Type

#### Videos (Orchestrator handles these)
- Use **just the filename**: `"video": "memory_video.mp4"`
- Orchestrator looks in: `backend/public/videos/`
- Played on TV/display via VLC when token is scanned

#### Images & Audio (Scanners handle these)
- Use **assets/ paths**: `"image": "assets/images/token123.jpg"`
- Use **assets/ paths**: `"audio": "assets/audio/sound.mp3"`
- Scanners play these locally from their `data/assets/` directory
- Each scanner has the files via ALN-TokenData submodule

#### Important Notes
- **DO NOT** put images/audio in backend - scanners can't access them
- **DO NOT** use assets/video/ paths - videos only exist on orchestrator
- The same tokens.json works for both systems because each ignores irrelevant paths

### File Locations

#### Scanner Repositories (via submodule)
```bash
aln-memory-scanner/
└── data/                    # ALN-TokenData submodule
    ├── tokens.json
    └── assets/
        ├── images/          # Local images displayed on scanner device
        │   ├── token1.jpg
        │   └── token2.png
        └── audio/           # Local audio played on scanner device
            ├── sound1.mp3
            └── sound2.wav
```

#### Orchestrator Backend
```bash
ALN-Ecosystem/
├── ALN-TokenData/           # The game pack (root submodule) — the
│   ├── tokens.json          #   backend reads THIS checkout
│   ├── game.json            #   (packService DEFAULT_PACK_DIR)
│   └── cues.json
└── backend/
    └── public/
        ├── videos/          # Video files for TV playback (git-excluded)
        ├── music/           # Music library (git-excluded)
        └── audio/           # Cue sound files
```

### Adding New Media

1. **For Videos** (TV playback):
   - Add .mp4 file to `backend/public/videos/`
   - Update tokens.json: `"video": "filename.mp4"`

2. **For Images/Audio** (scanner feedback):
   - Add files to `ALN-TokenData/assets/images/` or `assets/audio/`
   - Update tokens.json: `"image": "assets/images/filename.jpg"`
   - Commit and push ALN-TokenData submodule
   - Update submodule reference in scanner repos

## Installation Profile (the venue document)

The installation profile connects the pack's abstract hardware names
to the real instruments in the room. It is a single JSON file,
frozen at orchestrator boot (`profileService`), and it is
load-bearing: **without it, every lighting cue and the idle loop
degrade loudly** (ledger L7/L12 warnings on every fire — the show
runs, but lights don't change and the idle loop falls back to engine
config).

- **Default location:** `backend/config/profiles/aln-full-kit.json`
  (in-repo — a fresh clone carries ALN's full-kit profile already).
- **Override:** the `PROFILE_PATH` env key points at an alternate
  profile file (loud warning when active).
- **Shape** (see the in-repo file for the live example):
  - `bindings.lighting` — pack lighting ROLE → Home Assistant scene
    id. ALN's seven roles bind to seven `scene.*` ids (`scene.game`,
    `scene.video`, `scene.off`, `scene.police_1`, `scene.police2`,
    `scene.police3`, `scene.policeglitch`). Those scenes must exist
    in the Home Assistant instance — see the next section.
  - `bindings.surfaces` — display-surface channel → media file.
    ALN binds its idle-loop channel (`aln-idle`) to `idle-loop.mp4`
    in `VIDEO_DIR`.
- **What breaks without it:** a missing/renamed profile does NOT
  refuse boot (deliberate — the engine degrades loudly instead).
  Symptoms: `unresolvable lighting role` / ledger-L7 warnings in the
  log on cue fires, and the idle loop resolving from
  `IDLE_LOOP_FILE` with a ledger-L12 warning.
- **Verification:** after boot, fire one lighting cue (or activate a
  scene from the GM panel) and grep the log — zero L7/L12 fallback
  warnings means the profile bound.

## Home Assistant (Lighting)

Lighting scenes are driven through a local Home Assistant instance
in Docker. Nothing in the engine installs it — this section is the
install procedure a new machine needs.

### 1. Install Docker and create the container

```bash
# Docker (official convenience script, or distro packages)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out/in, or use `sg docker -c '...'`

# Persistent config volume + container (host networking; HA needs
# LAN discovery for bulbs). The container name MUST match
# HA_DOCKER_CONTAINER in .env (default: homeassistant).
mkdir -p ~/ha-config
docker run -d --name homeassistant \
  --network=host \
  --restart=unless-stopped \
  -v ~/ha-config:/config \
  ghcr.io/home-assistant/home-assistant:stable
```

Notes:
- With `HA_DOCKER_MANAGE=true` (the default) the backend starts and
  stops this container around its own lifecycle — but only a
  container that already EXISTS by this name; creation is this
  one-time step.
- `--restart=unless-stopped` keeps HA up across reboots
  independently of the backend (the backend tolerates either
  posture).
- First boot takes a few minutes. Ready when
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:8123/api/`
  returns `401`.

### 2. Onboard and create the access token

1. Open `http://[PI-IP]:8123`, create the owner account, finish
   onboarding.
2. Pair the venue's lights (Settings → Devices & Services — the
   integration depends on the bulb brand).
3. Profile (bottom-left) → Security → Long-Lived Access Tokens →
   Create Token. Put it in `backend/.env` as `HOME_ASSISTANT_TOKEN`.

### 3. Restore the scene definitions

The seven `scene.*` ids the ALN profile binds (listed in the
Installation Profile section) are **venue content that lives only in
the HA config volume — they exist in no git repository.**

> **OWNER TASK (recorded in ROADMAP Appendix C):** capture the seven
> scene definitions from the live machine's HA before building a new
> one — Settings → Automations & Scenes → Scenes → open each → the
> ⋮ menu → Edit in YAML, and save the seven YAML bodies (or copy
> `scenes.yaml` / the `.storage` scene entries out of the live
> machine's HA config volume). Store them beside this guide when
> captured.

On the new machine, recreate each scene (Settings → Automations &
Scenes → Add Scene → paste the captured YAML via Edit in YAML), with
the SAME entity ids — or place the captured `scenes.yaml` into the
config volume and reload scenes. Scene IDs must match the profile's
bindings exactly; the preflight's lighting checks and one manual
scene activation from the GM panel verify the chain.

### 4. Verify

```bash
# Reachable (401 = up, needs token; 200 = authorized)
curl -s -o /dev/null -w '%{http_code}' http://localhost:8123/api/

# Token works
curl -s -H "Authorization: Bearer $HA_TOKEN" \
  http://localhost:8123/api/ | head -c 100

# Scenes visible to the engine: from the GM panel, Environment →
# Lighting → refresh scene list; all seven scene.* ids should appear.
```

## Media Transfer (building a new machine)

Media files are deliberately NOT in git (videos and music are
git-excluded; ROADMAP §2.3). A new machine gets them by copy. The
scanner-side images/audio ARE in git (`ALN-TokenData/assets/`) and
arrive with the clone — hardware scanners then sync them from the
orchestrator automatically.

### Inventory (what must be copied)

| What | Where | Source of truth for the list |
|---|---|---|
| Game videos + `idle-loop.mp4` | `backend/public/videos/` | every non-null `video` field in the active pack's `tokens.json`, plus the profile's `bindings.surfaces` file |
| Music library | `backend/public/music/` | `backend/config/music-playlists.json` references |
| Cue sound files | `backend/public/audio/` | every sound file named in the active pack's `cues.json` |

### Copy (from the old machine or the post-event backup)

```bash
# From the old machine over the LAN (or restore from the rsync
# backup medium — see "Backups" below):
rsync -av old-pi:ALN-Ecosystem/backend/public/videos/ backend/public/videos/
rsync -av old-pi:ALN-Ecosystem/backend/public/music/  backend/public/music/
rsync -av old-pi:ALN-Ecosystem/backend/public/audio/  backend/public/audio/
```

Session data (`backend/data/`) is deliberately NOT part of a fresh
build — a new machine starts clean; the old machine and the backup
medium keep history.

### Verify (before calling the machine ready)

```bash
cd backend

# 1. Every pack-referenced video exists (idle loop included)
node -e "
const t=require('../ALN-TokenData/tokens.json'),fs=require('fs');
const missing=Object.values(t).map(x=>x.video).filter(Boolean)
  .filter(v=>!fs.existsSync('public/videos/'+v));
console.log(missing.length?'MISSING: '+missing.join(', '):'videos OK');"
ls public/videos/idle-loop.mp4

# 2. Every cue sound exists
node -e "
const c=require('../ALN-TokenData/cues.json'),fs=require('fs');
const refs=JSON.stringify(c).match(/[\w-]+\.(wav|mp3)/g)||[];
const missing=[...new Set(refs)].filter(f=>!fs.existsSync('public/audio/'+f));
console.log(missing.length?'MISSING: '+missing.join(', '):'sounds OK');"

# 3. Music: regenerate the bootstrap playlist from what's on disk
npm run music:seed
```

The in-panel preflight's resource checks (`validateCommand`: sound
files, video files, lighting scenes, audio sinks) are the same
verification run continuously once the system is up.

## Deployment

### Quick Start

```bash
cd backend
npm install         # Install dependencies (if not done)
npm start           # Builds GM Scanner + starts full system with PM2
```

**What happens when you run `npm start`:**
1. **Prestart hook** - Runs `scripts/desktop-control.sh stop` (frees the display for the orchestrator-owned Chromium/VLC) then `scripts/build-scanner.sh` to build `ALNScanner/dist/`
2. **Orchestrator Launch** - Starts orchestrator with PM2 (the only PM2 app — see `ecosystem.config.js`)
3. **VLC Launch** - VLC is auto-spawned and supervised by the orchestrator (`vlcMprisService.init()` via `ProcessMonitor`), **not** by PM2, and is controlled via D-Bus MPRIS

`npm run stop` (and `npm run prod:stop`) restore the desktop afterward via `scripts/desktop-control.sh start`.

The GM Scanner is automatically served at `https://localhost:3000/gm-scanner/` via symlink.

### Development Workflows

#### Interactive Development Mode (Recommended)
```bash
npm run dev         # Opens interactive menu
```

Choose from:
1. **Full System** - Orchestrator with hot reload + video (VLC auto-spawned by the orchestrator)
2. **Orchestrator Only** - No video playback (for API development)
3. **PM2 Managed** - Like production but for development

#### Direct Commands
```bash
# Full system with hot reload (VLC auto-spawned by the orchestrator)
npm run dev:full

# Just the orchestrator, no video (ENABLE_VIDEO_PLAYBACK=false)
npm run dev:no-video

# Just orchestrator with nodemon
npm run orchestrator:dev
```

VLC has no separate start/stop script — its lifecycle is tied to the orchestrator (spawned in `vlcMprisService.init()`).

### Production Deployment

#### Using PM2 (Recommended)
```bash
# Start production system
npm run prod:start          # or just: npm start
# Note: Automatically builds GM Scanner before starting

# Monitor and manage
npm run prod:status         # Check process status
npm run prod:logs           # View logs
npm run prod:monit          # Real-time monitoring

# Control processes
npm run prod:stop           # Stop all
npm run prod:restart        # Restart all
npm run prod:reload         # Zero-downtime reload
```

#### Auto-start on Boot
```bash
# Save current PM2 configuration
npm run prod:save

# Generate startup script
npm run prod:startup
# Follow the command it outputs (usually a systemctl command)

# After reboot, both processes auto-start
```

### System Health Verification

```bash
# Full health check
npm run health

# Quick checks
npm run health:api          # Check orchestrator (curl /health | jq)
npm run health:quick        # Basic connectivity (HTTP status code only)
```

Expected healthy output:
```
✅ Orchestrator: Running
✅ VLC: Running
✅ VLC Integration: Connected
✅ Video Display: Ready
```

### Understanding the System

The ALN system has TWO components that must run together:

1. **Orchestrator** (Node.js server)
   - Handles scanner connections
   - Manages sessions and state
   - Controls video playback
   - Serves admin interface

2. **VLC Media Player**
   - Displays videos on screen/HDMI
   - Controlled via D-Bus MPRIS (`org.mpris.MediaPlayer2.vlc`)
   - Auto-spawned and supervised by the orchestrator (`vlcMprisService.init()` via `ProcessMonitor`) — a child of the orchestrator, **not** a separate PM2 app
   - Must have GUI for video output

### Common Workflows

#### Testing Video Playback
```bash
# 1. Start the system
npm start

# 2. Check health
npm run health

# 3. Trigger test scan
curl -k -X POST https://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "Team Alpha", "deviceId": "test-scanner", "deviceType": "player"}'
```

#### Switching Configurations
```bash
# Stop everything
npm run stop

# Clean slate
npm run reset               # Clears logs and data

# Start with different mode
npm run dev                 # Interactive chooser
```

#### Troubleshooting Commands
```bash
# Check what's running
npm run prod:status

# View logs
npm run prod:logs

# Clean restart (VLC restarts with the orchestrator)
npm run stop && npm run clean:all && npm start
```

### Access Points

Once running (any method):
- **Orchestrator API**: `https://localhost:3000`
- **Health Status**: `https://localhost:3000/health`
- **Player Scanner**: `https://localhost:3000/player-scanner/`
- **GM Scanner**: `https://localhost:3000/gm-scanner/` (HTTPS required for NFC)
- **Scoreboard Display**: `https://localhost:3000/scoreboard`

(VLC has no network control endpoint — it is controlled locally via D-Bus MPRIS.)

## Raspberry Pi Deployment

### 0. Image the machine

The production platform is a **Raspberry Pi 5** running **Raspberry
Pi OS Bookworm 64-bit, Desktop edition** — the desktop matters: the
orchestrator's VLC and the scoreboard's Chromium kiosk render on the
Pi's own graphical session (Xorg/LXDE; the `desktop-control.sh`
prestart hook assumes LXDE components).

1. Flash the OS with Raspberry Pi Imager (set hostname, user, WiFi,
   and SSH in the imager's settings gear).
2. Boot, then enable **auto-login to desktop**:
   `sudo raspi-config` → System Options → Boot / Auto Login →
   Desktop Autologin. Without this, nothing can own the display
   after an unattended power-up (see "Boot-to-running" below).
3. Add the service user to the device groups the system touches:
   ```bash
   sudo usermod -aG video,audio,bluetooth $USER
   # docker group comes with the Home Assistant install step
   ```

### 1. Prepare Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs vlc mpd git xdotool wmctrl chromium-browser

# Disable the system MPD — the orchestrator spawns and supervises its own
sudo systemctl stop mpd && sudo systemctl disable mpd
sudo systemctl stop mpd.socket 2>/dev/null && sudo systemctl disable mpd.socket 2>/dev/null

# Install PM2
sudo npm install -g pm2

# Clone repository
cd ~
git clone --recurse-submodules https://github.com/[user]/ALN-Ecosystem.git
cd ALN-Ecosystem/backend
npm install
```

### 2. Configure for HDMI Output

Edit `/boot/firmware/config.txt` (Raspberry Pi OS Bookworm; older releases used `/boot/config.txt`):
```ini
# Force HDMI output
hdmi_force_hotplug=1
hdmi_drive=2
hdmi_group=2
hdmi_mode=82  # 1080p 60Hz
```

### 2b. Pi 5 Video Settings (CRITICAL — HEVC only)

Full detail: `backend/CLAUDE.md` → "Raspberry Pi 5 Specifics". The
load-bearing facts:

- **The Pi 5 has NO H.264 hardware decoder.** Only HEVC (H.265) is
  hardware-decoded. Every game video (idle loop included) MUST be
  HEVC, or VLC software-decodes at ~47% CPU with artifacts. Encode
  with `-c:v libx265 -tag:v hvc1 -movflags +faststart` (the
  faststart flag prevents a frozen first frame; the full ffmpeg
  recipe is in backend/CLAUDE.md).
- **VLC video output must be `--vout=gles2`** — auto-detected on
  Pi 5 by `vlcMprisService._getHwAccelArgs()`; override only via
  `VLC_HW_ACCEL`. (`--vout=gl` = 280% CPU + black screens.)
- Verify hardware decode on the bench:
  `DISPLAY=:0 cvlc --verbose 2 --play-and-exit video.mp4 2>&1 | grep -i hwaccel`
  — a `Hwaccel V4L2 HEVC` line means the hardware path engaged.

### 3. Set Static IP (Optional)

Raspberry Pi OS Bookworm uses **NetworkManager** (`nmcli` / `nmtui`), not `dhcpcd`. Configure a static IP on the active connection:

```bash
# List connections to find the name (e.g. "preconfigured" or "Wired connection 1")
nmcli con show

# Apply a static IPv4 config
sudo nmcli con mod "<connection-name>" \
  ipv4.addresses 192.168.1.100/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "8.8.8.8 8.8.4.4" \
  ipv4.method manual

# Re-activate the connection to apply
sudo nmcli con up "<connection-name>"
```

Or use the interactive TUI: `sudo nmtui`. (On pre-Bookworm releases, edit `/etc/dhcpcd.conf` instead.)

### 4. Boot-to-running (auto-start posture)

Goal (ROADMAP, the boot pain): power on the Pi with the venue TV
connected and arrive at a running show system — orchestrator up, VLC
idle loop on the TV — with no terminal work. The pieces:

```bash
cd ~/ALN-Ecosystem/backend
npm start            # first manual start (builds GM scanner, starts PM2)
pm2 save             # snapshot the process list
pm2 startup          # generate the systemd unit
# Run the sudo command it outputs — PM2 now resurrects on boot
```

What each boot then does, and what it depends on:

1. systemd starts PM2's resurrect service → `aln-orchestrator` runs.
2. The orchestrator spawns and supervises its own VLC, MPD, and
   (when the display mode calls for it) the scoreboard Chromium —
   none of these need separate auto-start entries.
3. **Display dependency:** VLC and Chromium render on `DISPLAY=:0`,
   so the desktop auto-login (step 0) must be enabled. PM2's systemd
   unit can start BEFORE the graphical session exists; the
   orchestrator's ProcessMonitor retries VLC, which papers over the
   race — but this ordering is exactly the kind of thing CI cannot
   test.
4. Home Assistant: with `--restart=unless-stopped` on the container
   (and/or `HA_DOCKER_MANAGE=true`), lighting comes up without
   intervention.

> **Stage-B checklist item (home hardware pass):** perform at least
> one cold power-cycle with nothing attached but power, network, and
> the TV, and verify the idle loop appears unaided. If VLC loses the
> boot race and the ProcessMonitor retries don't recover it, the fix
> to test is delaying PM2's unit until the graphical target
> (`systemctl edit pm2-<user>` → `After=graphical.target`); record
> what the bench shows.

### 5. Install WirePlumber Rule (Required for Video Audio)

The orchestrator owns VLC's stream volume. Without this drop-in, WirePlumber's
`restore-stream` competes with the orchestrator and can silently mute video
audio across reboots (2026-05-22 incident). See `backend/CLAUDE.md` →
"WirePlumber Configuration Dependency" for the full rationale.

```bash
sudo mkdir -p /etc/wireplumber/main.lua.d/
sudo tee /etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua > /dev/null <<'EOF'
-- ALN orchestrator: bypass WirePlumber's stream-restore for VLC streams.
-- See backend/CLAUDE.md → "WirePlumber Configuration Dependency" for context.
table.insert(stream_defaults.rules, {
  matches = {
    {
      { "application.process.binary", "matches", "vlc" },
    },
  },
  apply_properties = {
    ["state.restore-props"]  = false,
    ["state.restore-target"] = false,
  },
})
EOF
systemctl --user restart wireplumber
```

## Network Configuration

### Finding Your IP Address

```bash
# Linux/Mac
hostname -I | cut -d' ' -f1

# Windows (in WSL2)
ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'

# Alternative
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Firewall Configuration

```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp  # HTTPS + WebSocket (primary)
sudo ufw allow 8000/tcp  # HTTP → HTTPS redirect
sudo ufw allow 8888/udp  # Discovery broadcast

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --permanent --add-port=8888/udp
sudo firewall-cmd --reload
```

## Scanner Access

### Networked Mode (With Orchestrator)

Mobile devices on same network:
1. Connect to same WiFi
2. Open browser to:
   - Player: `https://[SERVER-IP]:3000/player-scanner/`
   - GM: `https://[SERVER-IP]:3000/gm-scanner/`
3. Accept self-signed certificate warning (one-time per device)
4. Scanners auto-detect orchestrator via UDP broadcast

### Standalone Mode (Without Orchestrator)

For deployments without orchestrator infrastructure:
- Player: `https://[username].github.io/ALNPlayerScan/`
- GM: `https://[username].github.io/ALNScanner/`

Standalone mode provides full scanning functionality with local storage. Video playback is not available (requires orchestrator + VLC).

## Scoreboard Display

### Accessing the Scoreboard

The scoreboard is a TV-optimized display showing live Black Market rankings and Detective Log entries:

**URL**: `https://[SERVER-IP]:3000/scoreboard`

- **Purpose**: Large-screen display of team scores, group completions, and detective scans
- **Optimized for**: TV/monitor displays with responsive design
- **Updates**: Real-time via WebSocket connection
- **Network**: Works on any device with browser access to orchestrator

### Features

1. **Team Rankings** - Live scoreboard with medals (🥇🥈🥉) for top 3 teams
   - Shows only teams with activity (teams appear after first token scan)
   - Real-time score updates
   - Token counts and completed group bonuses

2. **Detective Log** - Token IDs scanned in Detective Mode
   - Chronological list of detective scans
   - Shows token ID and scan timestamp
   - Placeholder for future narrative log expansion

3. **Group Completion Notifications** - Animated alerts when teams complete token groups
   - Shows team, group name, and bonus points
   - Auto-dismisses after 8 seconds

4. **Connection Status** - Visual indicator in top-right corner
   - Green: Connected (live updates)
   - Red: Offline (displays last known state, attempting reconnect)
   - Yellow: Connecting

### Setup for Display Devices

#### Option 1: Dedicated Device (Recommended)
Use any spare device with a browser:
- Raspberry Pi Zero W ($15) + monitor
- Old tablet in kiosk mode
- Spare laptop/computer
- Amazon Fire Tablet

Steps:
1. Connect device to same network as orchestrator
2. Open browser to `https://[ORCHESTRATOR-IP]:3000/scoreboard`
3. Accept self-signed certificate warning (one-time)
4. Press F11 for fullscreen (or use device's kiosk mode)
5. Display auto-updates as teams scan tokens

#### Option 2: Chromium Kiosk Mode (Linux/Raspberry Pi)
```bash
# Install Chromium if needed
sudo apt install chromium-browser

# Create kiosk launcher script
cat > ~/scoreboard.sh << 'EOF'
#!/bin/bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble \
  --ignore-certificate-errors \
  --app=https://[ORCHESTRATOR-IP]:3000/scoreboard
EOF
chmod +x ~/scoreboard.sh

# Auto-start on boot (add to ~/.config/lxsession/LXDE-pi/autostart)
@/home/pi/scoreboard.sh
```

#### Option 3: Firefox Kiosk Mode
```bash
firefox --kiosk https://[ORCHESTRATOR-IP]:3000/scoreboard
```

### Authentication Details

The scoreboard authenticates automatically for read-only display
access — **no file edits are ever needed.**

- **How it works**: the server injects the credential into the page
  AT SERVE TIME (`resourceRoutes.renderScoreboardHtml` — the page
  source in the repo carries only a placeholder, never a real
  password). Change `ADMIN_PASSWORD` in `.env`, restart, done.
- **Recovery**: if the display ever looks wrong or stale, a page
  reload is the fix — the page re-fetches its credential and full
  state on load (this retired the old blank-TV-after-restart
  failure).
- **Read-only**: the scoreboard can only receive updates, not send
  commands.

> The old instruction to edit `const CONFIG = { adminPassword: … }`
> inside `scoreboard.html` is OBSOLETE — that line no longer exists
> in the file, and grep-ing for it proves nothing is broken.

**For higher security:**
- Keep scoreboard on local/trusted network only
- Use firewall rules to restrict access to port 3000
- Change `ADMIN_PASSWORD` from default value
- Consider separate VLAN for display devices

### Troubleshooting Scoreboard

#### Blank screen or "Auth Failed"
```bash
# The credential is injected at serve time — first move is a page
# reload on the display device. Then:

# Check orchestrator is running
curl -k https://localhost:3000/health

# Confirm the SERVED page carries an injected token (not the raw
# placeholder — a placeholder in the served output means the
# injection path broke):
curl -ks https://localhost:3000/scoreboard | grep -c '%%' # expect 0

# Check browser console for errors (F12)
```

#### No teams showing
- Teams only appear after scanning at least one token
- Check WebSocket connection status (indicator in top-right)
- Verify session is active and teams exist: `curl -k https://localhost:3000/api/state`

#### Connection keeps dropping
- Check network stability between display device and orchestrator
- Ensure display device doesn't sleep/hibernate
- Verify firewall allows WebSocket connections (port 3000)

#### Not responsive on TV
- Try different browser (Chromium recommended)
- Check TV resolution settings
- Use `Ctrl + 0` to reset zoom level
- Enable fullscreen mode (F11)

### Display Recommendations

**Optimal Setup:**
- **Resolution**: 1080p or higher
- **Orientation**: Landscape (responsive design supports both)
- **Browser**: Chrome/Chromium 89+ or Firefox 90+
- **Network**: Wired ethernet preferred for reliability
- **Power**: Disable sleep mode on display device

**Layout Adapts:**
- **Desktop/TV**: 2-column layout (scoreboard + detective log side-by-side)
- **Tablet**: Single column, stacked layout
- **Mobile**: Optimized touch targets and font sizes

## Testing

### 1. Test VLC Integration (D-Bus MPRIS)

The orchestrator controls VLC via D-Bus MPRIS — it spawns VLC itself, so you do
not launch VLC manually. With the orchestrator running, confirm VLC is up and
reachable on D-Bus:

```bash
# VLC process is alive (orchestrator spawns `cvlc`)
pgrep -x cvlc

# D-Bus MPRIS responds (same probe check-health.sh uses)
dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply \
  /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping
```

On a Raspberry Pi 5 the orchestrator launches VLC with `--vout=gles2`
(`vlcMprisService._getHwAccelArgs()`).

### 2. Test API Endpoints

```bash
# Health check
curl -k https://localhost:3000/health | jq

# Simulate token scan (player scanner format)
curl -k -X POST https://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId": "534e2b03", "teamId": "Team Alpha", "deviceId": "test-device", "deviceType": "player"}' | jq
```

### 3. Test Scanner Connection

```bash
# Start local scanner for testing
cd aln-memory-scanner
python3 -m http.server 8001

# Access at http://localhost:8001
# Check WebSocket connection in browser console
```

## Troubleshooting

### Common Issues and Solutions

#### npm start not working
```bash
# Check package.json points to correct file
grep '"start"' package.json
# Should show: "start": "node src/server.js"

# Run directly if needed
node src/server.js
```

#### VLC not showing video
```bash
# VLC launch args live in src/services/vlcMprisService.js (_getHwAccelArgs);
# on Pi 5 the video output is --vout=gles2. Confirm VLC is running:
pgrep -x cvlc

# Check DISPLAY variable (Linux)
echo $DISPLAY  # Should be :0 or similar

# Review VLC / ProcessMonitor lines in the orchestrator log
grep -i vlc backend/logs/combined.log | tail -50

# Restart the orchestrator (this also restarts VLC)
pm2 restart aln-orchestrator
```

#### "VLC not connected" error
```bash
# Verify VLC is running (orchestrator spawns `cvlc`)
pgrep -x cvlc

# Confirm D-Bus MPRIS responds (there is no HTTP interface)
dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply \
  /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping

# Review VLC / ProcessMonitor lines in the orchestrator log
grep -i vlc backend/logs/combined.log | tail -50
```

#### Token scan plays wrong/no video
```bash
# Check token paths in ALN-TokenData/tokens.json
# Should be just filenames, not assets/video/...

# Verify video file exists
ls backend/public/videos/

# Check logs
pm2 logs aln-orchestrator --lines 50
```

#### Mobile can't connect
1. Verify same network: `ping [server-ip]` from mobile
2. Check firewall: `sudo ufw status`
3. Ensure using IP not localhost in URL
4. Try disabling mobile browser's "HTTPS-only" mode

#### Port already in use
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :8000

# Kill if needed (use PID from above)
kill -9 [PID]
```

#### Music (MPD) not playing / no audio

The orchestrator spawns and supervises its own MPD instance via `ProcessMonitor`
and controls it over the Unix socket `/tmp/aln-mpd.sock` using the `mpd2` Node
client (see the install step above, and `backend/CLAUDE.md` → "Music Service").

```bash
# Confirm the system MPD is disabled (the orchestrator owns its own instance)
systemctl status mpd

# The orchestrator-managed MPD process is tracked via this PID file
cat /tmp/aln-pm-mpd.pid

# Verify MPD's PipeWire sink is present (audioRoutingService matches on aln-music)
pactl list sink-inputs | grep -i aln-music

# Review MPD / ProcessMonitor lines in the orchestrator log
grep -i "mpd\|music" backend/logs/combined.log | tail -50
```

Operational notes:
- **Playlists** are loaded from `backend/config/music-playlists.json` and
  hot-reloaded (`fs.watch`) — edit that file and the change is picked up without
  a restart. After adding/removing MP3s under `backend/public/music/`, run
  `cd backend && npm run music:seed` to regenerate the All Tracks bootstrap
  playlist.
- The MPD database (`aln-mpd.db`) is wiped on reboot — MPD rebuilds it on the
  next clean boot, so a brief "music unavailable" window right after boot is
  expected while the rebuild completes.

## Performance Optimization

### For Raspberry Pi
```bash
# Limit memory usage in ecosystem.config.js
max_memory_restart: '256M'
node_args: '--max-old-space-size=256'
```

**Do NOT disable the bluetooth service** — the GM panel pairs and
routes audio to a Bluetooth speaker through BlueZ
(`bluetoothService`); disabling it kills a supported show feature.
(An older revision of this guide said to disable it — that was
wrong.) `avahi-daemon` may be disabled if `.local` mDNS names are
not in use.

### For Production
- Use wired ethernet when possible
- Set static IP to avoid DHCP delays
- Pre-load videos in VLC playlist
- Minimize background processes

## Security Considerations

### Production Deployment
1. Change the default `ADMIN_PASSWORD` and `JWT_SECRET` in `.env` (the scoreboard picks the password up automatically at serve time — no other edits)
2. Use firewall to restrict access
3. Enable HTTPS with reverse proxy (nginx/caddy)
4. Limit CORS origins in .env
5. Run as non-root user

### Basic Security Setup
```bash
# Create dedicated user
sudo useradd -m -s /bin/bash alnuser
sudo usermod -aG video,audio alnuser

# Set ownership
sudo chown -R alnuser:alnuser /opt/aln-ecosystem

# Run PM2 as user
sudo -u alnuser pm2 start ecosystem.config.js
```

## Monitoring

### Health Checks
```bash
# Simple health check
curl -k https://localhost:3000/health

# Detailed status
curl -k https://localhost:3000/api/state

# PM2 monitoring
pm2 web  # Opens web dashboard on port 9615
```

### Log Locations
```
backend/logs/
├── combined.log   # All logs (includes VLC output via the orchestrator's ProcessMonitor)
├── error.log      # Errors only
└── out.log        # PM2 stdout
```

> Note: `vlc-error.log` / `vlc-out.log` may still exist in `backend/logs/` as
> 0-byte legacy files from the removed `vlc-http` PM2 app. They are no longer
> written — VLC is now a child of the orchestrator, and its stdout/stderr flow
> through `ProcessMonitor` into `combined.log`.

## Quick Reference

| Feature | Development | Production (PM2) |
|---------|------------|------------------|
| Start | `npm start` | `pm2 start ecosystem.config.js` |
| Stop | `Ctrl+C` | `pm2 stop all` |
| Logs | Console output | `pm2 logs` |
| Restart | Stop & Start | `pm2 restart all` |
| Auto-start | No | `pm2 startup && pm2 save` |

| URL | Purpose | Mode |
|-----|---------|------|
| https://[ip]:3000 | Main orchestrator | Networked |
| https://[ip]:3000/health | Health check | Networked |
| https://[ip]:3000/player-scanner/ | Player scanner | Networked |
| https://[ip]:3000/gm-scanner/ | GM scanner (NFC requires HTTPS) | Networked |
| https://[ip]:3000/scoreboard | Scoreboard display | Networked |
| https://[user].github.io/ALNPlayerScan/ | Player scanner | Standalone |
| https://[user].github.io/ALNScanner/ | GM scanner | Standalone |

## Support

For issues or questions:
1. Check logs: `pm2 logs --lines 100`
2. Verify configuration: `pm2 show aln-orchestrator`
3. Test health endpoint: `curl -k https://localhost:3000/health`
4. Review this guide's troubleshooting section

## Summary

This deployment provides:
- **Two Deployment Options**: Networked mode (full features with orchestrator) or Standalone mode (no server infrastructure)
- **Networked Mode Resilience**: Offline queue and localStorage backup handle temporary network issues
- **Simplicity**: Single `pm2 start` command for production
- **Flexibility**: Works on any local network without router config
- **Scalability**: From Raspberry Pi to cloud deployment
## Backups & pack rollback (2026-07-17, adversarial review R2/R20)

- **Off-device data backup:** after every event, copy the orchestrator's
  persisted state off the Pi's SD card (it holds sessions, backups, AND
  archives on the same disk): `rsync -a backend/data/ <other-medium>/aln-data-$(date +%F)/`

### Game Pack Rollback (runbook — A3 slice 2)

The active pack (`ALN-TokenData/`: `game.json` rules, `tokens.json`,
manifest) is frozen at orchestrator boot by `packService.activatePack()`.
Rules, mode tables, scoring, and token values all derive from that
snapshot — which makes rollback a plain git-checkout-and-restart, always.

**When to roll back:**
- The server REFUSES to boot after a pack publish (gate refusal: the log
  names the pack, the mode/flag, and why it isn't driveable — this is the
  gate working, not a crash)
- Scoring values are visibly wrong after a publish
- Scanners fail pack refresh (per-file sha1 verify) — usually a pack file
  edited without regenerating the manifest

**Steps:**

1. **Identify the last-good pack commit.** Session records stamp the pack
   identity at creation; a running/last server reports it at `/health`
   (`pack.packId`/`pack.contentHash`). Otherwise: `git -C ALN-TokenData log --oneline -10`.
2. **Revert the checkout:**
   ```bash
   git -C ALN-TokenData checkout <last-good-sha>
   ```
3. **Verify the manifest is fresh at that commit** (should always be true
   for a previously-deployed commit):
   ```bash
   node backend/scripts/build-pack-manifest.js ALN-TokenData && git -C ALN-TokenData diff --quiet pack-manifest.json && echo OK
   ```
4. **Restart the orchestrator:** `npm run prod:restart` (from `backend/`).
5. **Verify before doors:** `/health` shows the expected
   `pack.contentHash`; a GM scanner's settings header shows the same hash
   after its next load; preflight §4.4/§13.3 pass.

**Alternative — PACK_PATH pin:** start the orchestrator with
`PACK_PATH=<known-good-pack-dir>` to point the ENTIRE engine (rules,
tokens, pack channel) at a separate known-good directory without touching
the submodule checkout. Legal precisely because rules freeze at boot —
there is no half-old/half-new state. Remove the override once the
checkout is fixed; a stale PACK_PATH in the environment is the first
thing preflight §13.3 catches.

**Mid-session honesty:** sessions survive restarts (restored from disk),
but token values re-bake from the NOW-ACTIVE pack at boot. Scores already
banked persist as recorded; scans AFTER the rollback score under the
rolled-back tables. Rolling back mid-session is therefore safe but not
retroactive — prefer ending the session first if score continuity matters.

**Scanner side:** networked GM scanners fetch the pack from the
orchestrator's channel on next load (staged atomic refresh — a failed
verify discards the staged pack and keeps the last-activated one, so a
bad publish cannot brick a scanner). Standalone scanners refresh on their
next online page load.
