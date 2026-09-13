# ALN Ecosystem Deployment Guide

## Green, fresh install, September 2026 — start here

This section is the whole build in one place: the install order, the
three copy/read/never lists, what comes from git, and the four inputs
only you hold. Every line names the step below that carries it. Read
it once, then work down the steps in order.

It runs longer than one screen. That is deliberate — four tables that
name every file by its path on both machines are worth more here than
a paragraph that sends the reader hunting. Skim the "Install order"
table; read the three lists when you reach the step that uses them.

Green is the second Pi, built as a complete production machine while
blue keeps running the show. The cutover is physical: unplug blue,
plug in green, move the router's address reservation. Rolling back is
the reverse.

**The machine today is Raspberry Pi OS Trixie (Debian 13), not
Bookworm.** Five things to know about this release, each with its own
step below: the desktop is Wayland and must be switched to X11; the
WirePlumber drop-in is a `.conf` file in a different directory; the
browser package is `chromium`, not `chromium-browser`; and
`pip install` is refused. The fifth, Node 22, is not a Trixie change —
it is what `backend/package.json` requires, and Node 20 reached end of
life on 2026-04-30.

### Install order

Work down this list. **The step numbers under "Raspberry Pi
Deployment" run in this order**, so following the numbers and
following this table are the same thing. Two of the steps (Home
Assistant, media transfer) have their procedure in their own top-level
section; the numbered step there is a one-paragraph pointer that keeps
the sequence intact.

| # | Do this | Step |
|---|---|---|
| 1 | Image the card: 64-bit **Desktop**, hostname, user, WiFi, SSH — and set Localisation to blue's time zone | "0. Image the machine", entry 1 |
| 2 | Set the time zone (if the Imager did not) | "0. Image the machine", entry 2 |
| 3 | `raspi-config`: desktop autologin (two menu entries on Trixie) | "0. Image the machine", entry 3 |
| 4 | `raspi-config`: Advanced Options → Wayland → **W1 X11**, reboot | "0. Image the machine", entry 4 |
| 5 | `usermod -aG video,audio,bluetooth` | "0. Image the machine", entry 5 |
| 6 | `apt update && apt upgrade` | "1. Prepare Raspberry Pi" |
| 7 | Node 22 from NodeSource, then the apt package line | "1. Prepare Raspberry Pi" |
| 8 | Disable the system MPD | "1. Prepare Raspberry Pi" |
| 9 | `npm install -g pm2` | "1. Prepare Raspberry Pi" |
| 10 | Clone with submodules, pin `ALN-TokenData` to blue's revision, `npm install` | "1. Prepare Raspberry Pi" |
| 11 | Mount blue's share | "2. Mount blue's share" |
| 12 | Certificate: check what blue serves, copy that pair | "3. Certificate — check, then copy" |
| 13 | Copy `backend/.env` from blue and audit it | "4. The environment file — copy, then audit" |
| 14 | Copy `~/ha-config/`, install Docker, run HA on blue's image digest | "5. Home Assistant" → the procedure in "Home Assistant (Lighting)" |
| 15 | WirePlumber `.conf` drop-in — **before the first `npm start`** | "6. Install the WirePlumber rule" |
| 16 | Copy the media (videos, music, cue sounds), then verify | "7. Media transfer" → the procedure in "Media Transfer (building a new machine)" |
| 17 | Read the session bus address, put the two bus lines in `.env` | "8. Boot-to-running (auto-start posture)" |
| 18 | First `npm start`, `pm2 save`, `pm2 startup` | "8. Boot-to-running (auto-start posture)" |
| 19 | Cold-boot check, read after the logind window | "8. Boot-to-running (auto-start posture)" |
| 20 | HDMI settings in `/boot/firmware/config.txt` — compare blue's, cold-boot with the TV attached | "9. Configure for HDMI Output" |
| 21 | Run the acceptance gate: `docs/preflight-checklist.md` | "Acceptance gate" |
| 22 | **At cutover only:** move the router's address reservation to green's MAC | "10. The venue address (cutover step)" |

**Why step 6 comes before step 8.** The WirePlumber rule stops
WirePlumber restoring VLC's saved volume over the orchestrator's.
Install it after the first `npm start` and the machine can come up
with video audio silently muted — the 2026-05-22 incident.

Optional, and only if Thursday's Notion token sync will be run on
green: the four apt Python packages ("Token sync on the machine").

Skip on a fresh image: the `ufw` firewall section — `ufw` is not
installed and the kit network does not need it.

### Copy from blue (over the share)

Blue's filesystem is reachable from green over a network share. The
share's name and credentials are the owner's; the mount step writes
them as `//<blue>/<share>`. Copy with a tool that keeps permissions
(`rsync -a` over the mount), then fix ownership on green.

| What, on blue's disk | Where it goes on green | Step |
|---|---|---|
| `~/ALN-Ecosystem/backend/ssl/cert.pem` + `key.pem` — only the pair whose fingerprint blue actually serves | `backend/ssl/` — after the clone, **before** the first `npm start` | "3. Certificate — check, then copy" |
| `~/ALN-Ecosystem/backend/.env` | `backend/.env` — after the clone, **before** the Home Assistant container step and before the first `npm start`; then audited for blue-only values | "4. The environment file — copy, then audit" |
| `~/ha-config/` (the whole Home Assistant volume: `scenes.yaml`, the owner account, the long-lived token) | `~/ha-config/` — **before** the first `docker run` | "Home Assistant (Lighting)" |
| `~/ALN-Ecosystem/backend/public/videos/*.mp4` (idle loop included) | `backend/public/videos/` | "Media Transfer (building a new machine)" |
| `~/ALN-Ecosystem/backend/public/music/` | `backend/public/music/` | "Media Transfer (building a new machine)" |
| `~/ALN-Ecosystem/backend/public/audio/` — only the files git does not carry | `backend/public/audio/` | "Media Transfer (building a new machine)" |

### Read on blue, do not copy

| What | Command on blue | Used by |
|---|---|---|
| The pack pin (the `ALN-TokenData` revision) | `git -C ~/ALN-Ecosystem/ALN-TokenData rev-parse HEAD` | "1. Prepare Raspberry Pi" (green checks that sha out) |
| The time zone | `timedatectl` — the `Time zone:` line | "0. Image the machine", step 2 |
| The served certificate's sha256 fingerprint, SAN and `notAfter` | `openssl s_client -connect 192.168.0.191:3000 </dev/null 2>/dev/null \| openssl x509 -noout -fingerprint -sha256 -ext subjectAltName -enddate` | "3. Certificate — check, then copy" |
| Home Assistant's version and image digest | `curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" http://localhost:8123/api/config` and `docker inspect homeassistant --format '{{.Config.Image}}'` + `docker images --digests ghcr.io/home-assistant/home-assistant` | "Home Assistant (Lighting)" |
| `/boot/firmware/config.txt` and `cmdline.txt` — compare, never copy | `cat /boot/firmware/config.txt` | "9. Configure for HDMI Output" |
| `backend/config/profiles/aln-full-kit.json` — diff against git; carry any hand edit as a commit, never a copy | `diff` against green's clone | "Installation Profile (the venue document)" |

`ALN-TokenData/pack-manifest.json`'s `contentHash` is a digest of the
pack's contents, not a revision. It is the check AFTER the pin, never
the source of it: with blue's sha checked out, green's `/health` must
report the same hash.

### Never copy

| What | Why |
|---|---|
| `~/ALN-Ecosystem/backend/data/` | A new machine starts clean. Session history stays on blue and on the backup medium. |
| `~/.pm2/` | Regenerated by `pm2 save` and `pm2 startup` on green. |
| `/var/lib/bluetooth/` | Pairing is per computer. Re-pair the speaker from the GM panel. |
| `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua` | WirePlumber 0.5 never reads Lua config. Copying it silences the boot warning and changes nothing. Green gets the `.conf` drop-in instead. |
| Audio routing volumes (they live in `backend/data/`) | Reset to the defaults in `backend/config/environment/routing.json`. |

### Pull from git

```bash
git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git ~/ALN-Ecosystem
```

Branch `main`. Submodules: `ALN-TokenData` (the game pack — pin it to
blue's revision), `ALNScanner` with its nested `data`,
`aln-memory-scanner` with its nested `data` (this one carries the
hardware scanners' 127-image asset corpus and `assets/manifest.json`),
`arduino-cyd-player-scanner`. The installation profile
`backend/config/profiles/aln-full-kit.json` arrives with the clone.

Built on green, not copied: `backend/` `npm install`; the GM scanner
build (`npm start`'s prestart hook runs it); `npm run music:seed` after
the music copy; `python3 scripts/generate_asset_manifest.py` only if
the served asset manifest's pack hash differs from `/health`.

### The inputs only the owner holds

These four cannot be read off a machine or out of git. Have them ready
before starting.

1. **The share's name and credentials** — blue's network share, written
   `//<blue>/<share>` in the mount step.
2. **The Bluetooth speaker's sink name** — pair the W-KING X10 from the
   GM panel, then read `pactl list sinks short` for its
   `bluez_output.<MAC>.1` name. Nothing in the repository carries it;
   the installation profile carries only the label.
3. **The seven Home Assistant scene definitions** — they ride the
   `~/ha-config` copy. If HA is ever rebuilt from scratch instead of
   from that volume, the scenes must be captured from blue by hand
   first (see the Home Assistant section's OWNER TASK note).
4. **The router's admin access** — to move the 192.168.0.191
   reservation from blue's MAC to green's at cutover.


## System Overview

The About Last Night (ALN) Ecosystem is a memory token scanning and video playback system designed for a 2-hour immersive game. It supports two deployment modes:

1. **Networked Mode** - Full integration with orchestrator server, video playback, session management, real-time sync
2. **Standalone Mode** - Scanners work independently via GitHub Pages, no server infrastructure required

**IMPORTANT**: These are mutually exclusive deployment choices made at game setup time, not fallback mechanisms. Networked mode has its own resilience features (offline queue, localStorage backup) for handling temporary network issues.

## Prerequisites

### Required Software
- **Node.js 22 (LTS)** — `backend/package.json` declares
  `engines.node >= 22.0.0`. Node 20 reached end of life on
  2026-04-30; an earlier revision of this guide installed it.
- **VLC Media Player** (for video output)
- **PM2** (for production deployment)
- **Git** with submodule support
- **Python 3** (for local scanner testing and the Notion token sync).
  On Debian 13 / Raspberry Pi OS Trixie, `pip install` into the system
  interpreter is refused (PEP 668). Install the sync script's
  dependencies from apt instead — see "Token sync on the machine".

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
# Install Node.js 22 (LTS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install VLC, MPD, and display management tools
sudo apt-get update
sudo apt-get install -y vlc mpd xdotool wmctrl chromium \
  pulseaudio-utils pipewire-bin dbus-bin
# The browser package is `chromium` on Debian 13 / Raspberry Pi OS
# Trixie. `chromium-browser` was the pre-Bookworm Pi build and does
# not exist here — see CHROMIUM_BIN in the environment reference.
# pulseaudio-utils supplies `pactl`, pipewire-bin `pw-play` and
# `pw-dump`, dbus-bin `dbus-monitor`. The last two are normally
# present already; naming them is idempotent.

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
nvm install 22
nvm use 22

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
brew install node@22

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
`DISCOVERY_UDP_PORT`, `ENABLE_MUSIC_PLAYBACK`). Verified 2026-09-05;
re-checked against `backend/.env.example` 2026-09-13 — all 40 keys in
the template have an entry below.

Two keys the machine needs are NOT in the template and must be
written by hand: `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR`.
They have their own subsection under "Display / Kiosk".

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

##### HTTPS

Full procedure and the certificate itself: "HTTPS Deployment" below.

- **ENABLE_HTTPS** (`true` | `false`)
  - Serve HTTPS on `PORT` and redirect HTTP. **Required** — the GM
    Scanner's Web NFC API only works in a secure context, and the
    discovery service advertises the protocol it finds here.
  - **Default: `false` — unset means plain HTTP.** The read is
    `process.env.ENABLE_HTTPS === 'true'`
    (`backend/src/config/index.js:30`), so anything but the exact
    string `true` is off. `backend/.env.example:108` and
    `ecosystem.config.js`'s default `env` block (`:17-24`) both set
    it, so a normal machine has it — but a copied `.env` that lost the
    line drops the machine to HTTP silently, and Web NFC dies on the
    GM tablets.

- **SSL_KEY_PATH** / **SSL_CERT_PATH** (paths, relative to `backend/`)
  - The key and certificate the server presents. Leave them relative
    (`./ssl/key.pem`, `./ssl/cert.pem`) — a copied `.env` from another
    machine may carry absolute paths that do not exist here.
  - Defaults: `./ssl/key.pem`, `./ssl/cert.pem`

- **HTTP_REDIRECT_PORT** (number)
  - The plain-HTTP port that 301-redirects to HTTPS.
  - Default: `8000`

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
  - Read at `backend/src/services/packService.js:167`; the loud
    warning is at `:172`, the resolve at `:175`.
  - Logs a LOUD warning when active — a production machine should
    normally NOT set it (it is the harness/rollback seam; see "Game
    Pack Rollback" below)
  - Default: unset (the in-repo `ALN-TokenData/` pack)

- **PROFILE_PATH** (file path)
  - Points the engine at an alternate installation profile (the
    venue document — see "Installation Profile" below). Loud warning
    when active.
  - Read at `backend/src/services/profileService.js:48`; the loud
    warning at `:53`; the default at
    `backend/src/services/profileService.js:31`.
  - Default: unset (`backend/config/profiles/aln-full-kit.json`)

##### Display / Kiosk

- **IDLE_LOOP_FILE** (filename)
  - The idle-loop video's filename inside `VIDEO_DIR`; one key for
    all three `vlcMprisService` sites (init play, return play,
    existence guard). NOTE: on the current tree the installation
    profile's `bindings.surfaces` entry for the pack's idle-loop
    channel is the primary source; this key is the loud fallback
    (ledger L12).
  - Read at `backend/src/config/index.js:122`
    (`config.display.idleLoopFile`); the loud L12 fallback is at
    `backend/src/services/vlcMprisService.js:393-395`.
  - Default: `idle-loop.mp4`

- **SCOREBOARD_WINDOW_MARKER** (string)
  - The FUNCTIONAL window-title marker `displayDriver` uses to find
    the scoreboard Chromium window (xdotool) and the server injects
    into the served page's `<title>`. Both sides follow this one
    key — never rebrand either side independently.
  - Read at `backend/src/config/index.js:114`; used by the window
    lookup at `backend/src/utils/displayDriver.js:104`.
  - Default: `ALN-SCOREBOARD`

- **CHROMIUM_BIN** (path)
  - The browser binary `displayDriver` spawns for the scoreboard
    kiosk.
  - Read at `backend/src/utils/displayDriver.js:165`
    (`process.env.CHROMIUM_BIN || 'chromium-browser'`).
  - **On Raspberry Pi OS Trixie (Debian 13) SET THIS to
    `/usr/bin/chromium`.** The package and binary are named
    `chromium`; `chromium-browser` was the pre-Bookworm Pi build and
    does not exist. Left unset, the kiosk spawn fails with
    `spawn chromium-browser ENOENT`, the `display` service reports
    down (`displayDriver.js:240`) and the scoreboard never reaches
    the TV.
  - This key lives in `backend/.env` only. `dotenv.config()` reads it
    inside the orchestrator (`backend/src/config/index.js:10`);
    nothing exports it to a shell, so any check of it from a terminal
    must read it out of that file.
  - Default: `chromium-browser`

- **VLC_SELF_SPAWN** (`true` | `false`)
  - Who supervises the VLC process. `true` (production): the engine
    spawns and restarts VLC itself. `false`: an external supervisor
    owns VLC (the rung-1 test harness) and the engine adopts whatever
    holds the MPRIS name.
  - Read at `backend/src/config/index.js:98`; the adoption log line is
    at `backend/src/services/vlcMprisService.js:143`.
  - Default: `true`

##### Session bus and runtime directory (not in the template — write them by hand)

Neither key is in `backend/.env.example`, and the engine sets neither
of its own: a grep of `backend/src` for either name finds nothing.
Every `pactl`, `dbus-send` and `dbus-monitor` call the orchestrator
makes inherits them from the process environment, and PM2 freezes that
environment at the first `npm start`. Getting them wrong is the
quietest failure on the machine — see "8. Boot-to-running" for the
procedure and the shape rule.

- **DBUS_SESSION_BUS_ADDRESS** (`unix:path=/run/user/<uid>/bus`)
  - The session bus the orchestrator talks to VLC's MPRIS interface
    over (`backend/src/services/mprisPlayerBase.js:66-86`, `:205-207`).
  - Write the `unix:path=` form with the login user's real uid
    (`id -u`). An `unix:abstract=…` address is minted per session and
    is dead after the first power-cycle.
  - Default: unset — inherited from the shell, or absent.

- **XDG_RUNTIME_DIR** (`/run/user/<uid>`)
  - How `pactl` reaches PipeWire's PulseAudio socket
    (`backend/src/services/audioRoutingService.js:158`, `:215`, `:948`).
  - Default: unset — inherited from the shell, or absent.

**The rule that makes these two lines work.** `dotenv.config()`
(`backend/src/config/index.js:10`) passes no `override`, so dotenv
leaves alone any variable already present in `process.env`. The two
`.env` lines therefore take effect ONLY in a shell that has not
already exported them — which means SSH. Green's desktop terminal
always exports `DBUS_SESSION_BUS_ADDRESS`, so there the shell's value
is what gets frozen and `.env` cannot rescue a bad one.

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

- **DEBUG** (`true` | `false`) — **the engine does not read it; one
  script does.** Its only reader is
  `backend/scripts/validate-session.js:104`, which prints the stack
  trace when the post-session validator hits an error (see "Post-Game
  Session" in the component docs). `ecosystem.config.js`'s
  `env_development` block sets it. The engine's verbose-logging flag
  is a different key, `ENABLE_DEBUGGING`
  (`backend/src/config/index.js:100`).
  - Default: unset — the validator prints the message without the
    stack trace

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

**Read this before generating anything.** A fresh clone already
carries a certificate and key: `backend/ssl/cert.pem` and `key.pem`
are tracked, and no `.gitignore` excludes them. That tracked pair is
`CN=10.0.0.177`, SAN `IP:10.0.0.177, DNS:raspberrypi.local,
DNS:localhost`, valid 2025-10-24 to 2026-10-24. `npm start` serves it
with no warning (`backend/.env.example:111-112`;
`backend/ecosystem.config.js:22-23`). At the venue address
192.168.0.191 it is a **name mismatch**: Chrome ignores the CN and
matches only the SAN, and an IP host needs an `iPAddress` SAN that
matches exactly.

So on a new machine there are two correct routes, and one wrong one.

**Route 1 (the one green takes): copy the pair blue actually serves.**
The GM tablets and the Pi 4 remote display accepted blue's certificate
once each; copying it keeps that trust. The full procedure — the
fingerprint check first, then the copy, placed after the clone and
before the first `npm start` — is the step
"3. Certificate — check, then copy" under "Raspberry Pi Deployment".

**Route 2: generate a new one WITH an IP SAN.** Use this if blue's
`notAfter` falls before a show, or the SAN does not name the venue
address and a tablet warns with a name error. Every tablet and the
remote display then warn and accept once again.

```bash
cd backend
mkdir -p ssl
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/CN=192.168.0.191" \
  -addext "subjectAltName=IP:192.168.0.191,DNS:localhost"
chmod 600 ssl/key.pem
```

Substitute the machine's real address for `192.168.0.191`. The
`-addext` flag is what writes the SAN; without it the certificate is
useless to a browser reaching the machine by IP.

Check what you produced, or what you copied:

```bash
openssl x509 -in backend/ssl/cert.pem -noout \
  -fingerprint -sha256 -ext subjectAltName -enddate
```

> **Changed from:** an earlier revision of this guide generated
> `-subj "/CN=localhost"` or `-subj "/CN=your-pi-hostname.local"`
> with no `-addext`. Those recipes emit no SAN at all, so the
> certificates they make are rejected by every current browser.
> Do not use them.

**Note for the record:** the tracked private key is in the repository
history. Secrets rotation is deferred by ruling; the real fix is a
certificate on a real domain (ROADMAP row 8.19, spike S2 — see "Real
Domain Certificate" below).

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
├── data/                    # ALN-TokenData nested submodule
│   └── tokens.json          #   the web player scanner's OWN pin
└── assets/                  # in the scanner repo, NOT in ALN-TokenData
    ├── manifest.json        #   the hardware scanners' sync manifest
    ├── images/              # 127 BMPs, displayed on the scanner device
    │   ├── kaa001.bmp
    │   └── jaw001.bmp
    └── audio/               # played on the scanner device
        ├── asm031.wav
        └── rat031.mp3
```

> **Changed from:** an earlier revision of this guide drew `assets/`
> inside `data/`. It is not there. The backend's asset-sync endpoints
> resolve into `aln-memory-scanner/assets/`
> (`backend/src/routes/resourceRoutes.js:17-22`), and the web player
> scanner reads `./data/tokens.json`
> (`aln-memory-scanner/js/app.js:64`) — a separate submodule pin from
> the pack the backend activates. See "Two things a sync does not
> fix".

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
   - Add files to `aln-memory-scanner/assets/images/` or
     `aln-memory-scanner/assets/audio/` — NOT to `ALN-TokenData`,
     which has no `assets/` directory
   - Update tokens.json: `"image": "assets/images/filename.bmp"`
   - Commit and push the `aln-memory-scanner` submodule, and
     `ALN-TokenData` for the tokens.json change
   - Update the submodule references in the parent repo
   - The Notion sync places nothing here: it only LOOKS for files
     already on disk. See "Audio and video files are placed by hand,
     before the sync".

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

#### Building green from blue: copy the volume, pin the image

Do this INSTEAD of the plain `docker run` above, and do it before the
first `docker run` — the copied volume must be in place when the
container first starts.

The seven `scene.*` definitions, the owner account and the long-lived
access token exist only inside blue's config volume. They are in no
git repository.

```bash
# 1. Copy blue's whole volume over the share (see "2. Mount blue's
#    share"), before any container exists on green.
rsync -a /mnt/blue/ha-config/ ~/ha-config/
sudo chown -R $USER:$USER ~/ha-config

# 2. Read blue's exact image, ON BLUE — not `:stable`.
docker inspect homeassistant --format '{{.Config.Image}}'
docker images --digests ghcr.io/home-assistant/home-assistant
curl -s -H "Authorization: Bearer $HOME_ASSISTANT_TOKEN" \
  http://localhost:8123/api/config    # the `version` field

# 3. Run green on that digest.
docker run -d --name homeassistant \
  --network=host \
  --restart=unless-stopped \
  -v ~/ha-config:/config \
  ghcr.io/home-assistant/home-assistant@sha256:<blue's digest>
```

Why the digest and not `:stable`: `:stable` moves. If green lands on a
newer release than blue's, Home Assistant migrates `.storage` on its
first start, on show week, with a fallback measured in days.
`scenes.yaml` is not part of that migration, but the rest of the
volume is. Upgrade both machines later, deliberately.

If `:stable` is used anyway, watch `docker logs homeassistant` through
the first start, then run the seven-scene check in step 4 below before
calling lighting done.

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

# Or read them straight out of HA (same seven ids as the profile's
# bindings.lighting block):
curl -s -H "Authorization: Bearer $HA_TOKEN" http://localhost:8123/api/states \
  | grep -o '"entity_id":"scene\.[a-z0-9_]*"' | sort
```

Then activate one scene from the GM panel and watch a real bulb. That
is the end-to-end proof; the scene list only proves HA has the ids.

## Media Transfer (building a new machine)

Media files are deliberately NOT in git (videos and music are
git-excluded; ROADMAP §2.3). A new machine gets them by copy. The
scanner-side images and audio ARE in git — in
`aln-memory-scanner/assets/` (127 BMPs in `images/`, three audio
files, and `manifest.json`), which is where the backend's asset-sync
endpoints resolve them from
(`backend/src/routes/resourceRoutes.js:17-22`). They arrive with the
clone, and hardware scanners then sync them from the orchestrator
automatically.

> **Changed from:** an earlier revision of this guide named
> `ALN-TokenData/assets/`. That directory does not exist.

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

Building green from blue, the source is the mounted share rather than
ssh — see "2. Mount blue's share":

```bash
cd ~/ALN-Ecosystem
rsync -a /mnt/blue/ALN-Ecosystem/backend/public/videos/ backend/public/videos/
rsync -a /mnt/blue/ALN-Ecosystem/backend/public/music/  backend/public/music/
# Cue sounds: git already carries the seven the pack references.
# Copy only what blue has and git does not.
rsync -a --ignore-existing /mnt/blue/ALN-Ecosystem/backend/public/audio/ backend/public/audio/
```

Videos must be HEVC — see "9b. Pi 5 Video Settings". `test_tone.wav`
in `backend/public/audio/` is the gitignored E2E scratch file, not
content; it does not need copying.

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

```bash
# 4. Hardware-scanner asset manifest: its pack identity must match the
#    pack the orchestrator activated. Run with the orchestrator up.
curl -sk https://localhost:3000/api/assets/manifest | grep -o '"contentHash":"[^"]*"'
curl -sk https://localhost:3000/health              | grep -o '"contentHash":"[^"]*"'
```

The two must print the same hash. On a mismatch, or on a 404
("Asset manifest not generated yet",
`backend/src/routes/resourceRoutes.js:74-76`), regenerate it and
re-check:

```bash
python3 scripts/generate_asset_manifest.py
```

That script imports the standard library only
(`scripts/generate_asset_manifest.py:23-30`) — it needs none of the
apt Python packages.

The in-panel preflight's resource checks (`validateCommand`: sound
files, video files, lighting scenes, audio sinks) are the same
verification run continuously once the system is up.

## Token sync on the machine (operations)

The Notion token sync rewrites `tokens.json`, regenerates the
hardware scanners' BMP images, and rebuilds the pack manifest. Nine of
its facts are properties of the MACHINE rather than of the sync, so
they belong here. The step-by-step run itself lives in
`docs/runbooks/2026-09-thursday-token-sync.md`; that runbook points at
this section rather than repeating it.

**Do not run a sync within two hours of a show.**

### The Python dependencies come from apt, not pip

On Debian 13 / Raspberry Pi OS Trixie, `pip install` into the system
interpreter exits with `externally-managed-environment` (PEP 668).
`scripts/requirements.txt` still says `pip install -r`; on this
machine that command fails.

```bash
sudo apt install -y python3-requests python3-pil python3-dotenv python3-jsonschema
```

Or, if a virtual environment is preferred:

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
```

`requests` and Pillow are required; `dotenv` is optional and
`jsonschema` is a soft dependency that turns the schema check on.
`scripts/generate_asset_manifest.py` needs none of them — it imports
the standard library only.

### Install `fonts-dejavu-core` before the first sync on this machine

The sync draws every token's BMP with DejaVu Sans Mono, falling back
to Liberation and then to PIL's bitmap default
(`scripts/sync_notion_to_tokens.py:203-215`). The Desktop image ships
`fonts-dejavu-core`, but verify rather than assume: if this machine's
fonts differ from the machine that produced the committed BMPs, every
one of the 127 images re-renders to different bytes. That is a ~29 MB
git diff, a new sha1 for every asset, and **a full ~38 MB re-sync on
every hardware scanner** — five to fifteen minutes per device.

```bash
sudo apt install -y fonts-dejavu-core
fc-list | grep -ci dejavu          # want a non-zero count
```

**The check that catches it.** Run the sync once on this machine
before it matters, then count what changed:

```bash
git -C aln-memory-scanner status --short | wc -l
```

Expect roughly the number of tokens you edited. **A count near 127
means the fonts differ** — install `fonts-dejavu-core`, re-run the
sync, and only then commit.

### Audio and video files are placed by hand, before the sync

The sync creates BMP images. It creates no audio and no video, ever.

- **Audio:** it only LOOKS for `{tokenId}.{mp3,wav,ogg}` already
  sitting in `aln-memory-scanner/assets/audio/`
  (`scripts/sync_notion_to_tokens.py:698`). A new audio memory needs
  its file placed there BEFORE the sync runs, or the token's `audio`
  field is written `null` and the token plays nothing.
- **Video:** same pattern against `backend/public/videos/`
  (`:699`). A new video token needs its `.mp4` dropped into
  `backend/public/videos/` (git-excluded — see "Media Transfer")
  before the sync, or `video` is written `null` and no TV playback is
  possible.

A BMP is generated only when the Notion page carries display text
before its `SF_` block. With no text there is no BMP and the token
silently falls back to `placeholder.bmp`.

### Restart the orchestrator after a sync — then reboot devices

The active pack is frozen at boot by `packService.activatePack()`.
There is no hot reload, no admin command, and `system:reset` does not
re-activate it. **Restarting the orchestrator is mandatory** after
any change to pack files on disk. The only feedback otherwise is one
log warning per drift.

Two channels are live, which is worse than uniformly frozen:
`/api/tokens` re-reads `tokens.json` on every request
(`backend/src/services/tokenService.js:75-119`) and the asset
endpoints re-read the asset directory on mtime
(`backend/src/routes/resourceRoutes.js:32-46`). So a hardware scanner
rebooted after the sync but BEFORE the orchestrator restart gets the
NEW tokens and NEW images from a server still scoring on the OLD
pack.

**Order: sync → restart the orchestrator → then reboot devices.**

```bash
cd backend && npm run prod:restart
```

### Rebuild the pack manifest after any hand edit

A full sync rebuilds the manifest for you. A hand edit to any pack
file does not.

```bash
node backend/scripts/build-pack-manifest.js ALN-TokenData
```

Skip it and the orchestrator still boots — the activation gate does
not check manifest freshness — but every GM tablet's staged pack
refresh fails its per-file sha1 compare and quietly falls back to its
cached, older rules. The failure looks like "the new values just did
not take".

### Two things a sync does not fix

- **The web player scanner reads a different pin.** It loads
  `./data/tokens.json` (`aln-memory-scanner/js/app.js:64`), which is
  the `aln-memory-scanner/data` nested submodule — a separate
  revision from the pack the backend activates. A sync does not touch
  it. Its IMAGES are current (they are served from
  `backend/public/player-scanner → aln-memory-scanner`), but its
  token JSON will be stale until that pin is deliberately bumped.
- **The hardware scanners have a 50,000-byte token-database
  ceiling** (`arduino-cyd-player-scanner/ALNScanner_v5/config.h:90`,
  `MAX_TOKEN_DB_SIZE`). Today's `/api/tokens` payload is around
  34 KB. A large content drop can cross it, and then every device
  logs `Token DB too large` and keeps its cached database
  (`.../services/TokenService.h:223-228`) — which looks exactly like
  "the new tokens just did not show up". Check after every sync:

```bash
curl -sk https://localhost:3000/api/tokens | wc -c
```

## Acceptance gate

A machine is not ready because the steps were followed. It is ready
because it passed `docs/preflight-checklist.md`, which is green's
acceptance gate (ROADMAP §3). Run it on the machine, from the
machine's own checkout.

Two things in it are worth knowing before it is run:

- The **only** proof that the TV display works is the TV. Start the
  orchestrator, show the scoreboard from the GM panel, look at the
  venue TV, hide it again, and play one video on top. The panel's
  `display` light reads healthy while the kiosk is hidden, so it
  proves nothing on its own.
- Its §8.3 window-control check needs the orchestrator running AND
  the scoreboard shown once from the panel, or there is no window for
  it to find.

The show-ready acceptance items beyond the checklist (a real video on
the TV with picture and sound; audio routed to the Bluetooth speaker
and ducking under a video; a lighting scene on a real bulb; a tablet
scanning a tag over the secure connection; a hardware scanner doing a
full asset sync) are the owner's, and are listed in ROADMAP §6
Stage B.

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

> **Building a venue machine? Do this from "8. Boot-to-running
> (auto-start posture)" instead** — not from here. PM2 freezes the
> environment of the shell that runs the first start and replays it on
> every boot, and the wrong shell is the quietest failure on this
> system: the machine comes up, serves, and looks fine while `audio`
> reports down, every VLC D-Bus call throws, and the idle loop never
> starts. That section decides the shell before it runs these
> commands.

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
Pi OS 64-bit, Desktop edition**. The desktop matters: the
orchestrator's VLC and the scoreboard's Chromium kiosk render on the
Pi's own graphical session, and the code drives that session through
X11 (`DISPLAY=:0` at `backend/src/utils/displayDriver.js:56`, window
control with `xdotool` and `wmctrl` at `:104`, `:289-290`, `:319`).

A card imaged today gets **Raspberry Pi OS Trixie (Debian 13)**. Its
desktop is Wayland with the labwc compositor, on every model. Under
labwc there is no X window manager for `xdotool` and `wmctrl` to talk
to: the kiosk is never shown or hidden and the `display` service
reports down. Step 4 below switches the session to X11, which is the
single most important step in this guide.

> **Changed from:** an earlier revision of this guide named Bookworm
> and an Xorg/LXDE session, and had no Wayland step. On Bookworm the
> X11 session was the default and step 4 did not exist.

1. **Flash the OS with Raspberry Pi Imager.** 64-bit **Desktop**
   edition. In the imager's settings gear set hostname, user, WiFi
   and SSH — **and open the Localisation subtab and set the time
   zone to blue's**. See step 2 for why.

2. **Set the time zone** (skip if the Imager already did it, but
   verify either way).

   The host time zone is machine state that is not in git, and
   nothing warns when it is wrong. The orchestrator derives it from
   the host (`backend/src/utils/timezone.js:51-54`), publishes it in
   `/health` (`backend/src/routes/healthRoutes.js:38`), and every
   hardware scanner reads `/health` and applies it with
   `setenv("TZ", tz, 1); tzset()`
   (`arduino-cyd-player-scanner/ALNScanner_v5/services/OrchestratorService.h:377-385`).
   A wrong zone shifts every scan timestamp and every line of the
   post-session report by hours, silently, until someone reads a
   report after the show.

   ```bash
   # On blue — read the `Time zone:` line:
   timedatectl

   # On green:
   sudo timedatectl set-timezone <blue's zone>
   ```

   Verify later, once both machines are up: the same string must come
   back from each.

   ```bash
   curl -sk https://localhost:3000/health | grep -o '"timezone":"[^"]*"'
   ```

   Home Assistant keeps its own clock in its config volume; the
   `docker run` passes no `-e TZ`, so a copied volume needs nothing.

3. **Enable auto-login to desktop.** Without it nothing can own the
   display after an unattended power-up (see "8. Boot-to-running"
   below).

   On Trixie this is **two** menu entries, not one:

   - `sudo raspi-config` → System Options → **S5 Boot** → **B2
     Desktop**
   - `sudo raspi-config` → System Options → **S6 Auto Login** → answer
     **yes** to "Would you like to automatically log in to the
     desktop?"

   Or, in one command:

   ```bash
   sudo raspi-config nonint do_boot_behaviour B4
   ```

   > **Changed from:** on Bookworm this was one entry, System Options
   > → Boot / Auto Login → Desktop Autologin. The four-way menu is
   > still in the file but no interactive path reaches it any more.

4. **Switch the desktop session to X11**, then reboot.

   `sudo raspi-config` → Advanced Options → **Wayland** → **W1 X11**
   ("Openbox window manager with X11 backend") → reboot when asked.

   The X11 stack is already on the Desktop image (the image installs
   both `rpd-wayland-core` and `rpd-x-core`), so this is a switch,
   not an install. W1 writes `rpd-x` into `/etc/lightdm/lightdm.conf`
   as `user-session`, `autologin-session` and `greeter-session` —
   the same file step 3 wrote `autologin-user=` into. Both must be
   set for the X11 desktop to come up unattended.

   Check after the reboot:

   ```bash
   echo $XDG_SESSION_TYPE                    # must print: x11
   DISPLAY=:0 wmctrl -m                      # must name Openbox
   DISPLAY=:0 xdotool getdisplaygeometry     # must print the TV size
   systemctl get-default                     # graphical.target
   grep -E '^(autologin-user|autologin-session)=' /etc/lightdm/lightdm.conf
   ```

   **If the desktop does not come up after W1:**
   `grep -n session /etc/lightdm/lightdm.conf` must show `rpd-x` on
   all three keys; then `sudo apt install --reinstall rpd-x-core` and
   reboot.

   **If the session comes up but no window can be controlled**
   (`DISPLAY=:0 wmctrl -l` empty, or `xdotool search` finds nothing
   while the kiosk is visible): do not debug this on show week. Blue
   runs the show; the rollback is unplugging green and plugging blue
   back in.

5. **Add the service user to the device groups the system touches:**
   ```bash
   sudo usermod -aG video,audio,bluetooth $USER
   # docker group comes with the Home Assistant install step
   ```
   Log out and back in for the groups to take effect.

### 1. Prepare Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs vlc mpd git xdotool wmctrl chromium \
  pulseaudio-utils pipewire-bin dbus-bin

# Disable the system MPD — the orchestrator spawns and supervises its own
sudo systemctl stop mpd && sudo systemctl disable mpd
sudo systemctl stop mpd.socket 2>/dev/null && sudo systemctl disable mpd.socket 2>/dev/null

# Install PM2
sudo npm install -g pm2

# Clone repository
cd ~
git clone --recurse-submodules https://github.com/maxepunk/ALN-Ecosystem.git
cd ALN-Ecosystem/backend
npm install
```

Three things in that block changed with Trixie:

- **Node 22, not 20.** `backend/package.json` declares
  `engines.node >= 22.0.0`; Node 20 reached end of life on
  2026-04-30. NodeSource re-signed its repositories for the 20, 22
  and 24 lines in January 2026, so `setup_22.x` runs the same way
  `setup_20.x` did.
- **`chromium`, not `chromium-browser`.** The rename is the whole
  reason the kiosk fails on a fresh install. Set `CHROMIUM_BIN` too —
  step 4.
- **`pulseaudio-utils pipewire-bin dbus-bin` added.** `pactl` comes
  from `pulseaudio-utils` and the guide never installed it;
  `pw-play`/`pw-dump` come from `pipewire-bin` and `dbus-monitor`
  from `dbus-bin`, both normally present already. Naming all three is
  idempotent.

**Pin the game pack to blue's revision.** Green must activate the
same pack blue is running, or scoring and token content differ
between the two machines.

```bash
# On blue — read the revision:
git -C ~/ALN-Ecosystem/ALN-TokenData rev-parse HEAD
# (the parent's recorded gitlink is the same sha:
#  git -C ~/ALN-Ecosystem ls-tree HEAD ALN-TokenData)

# On green — check that sha out:
cd ~/ALN-Ecosystem
git -C ALN-TokenData checkout <that sha>

# Verify the manifest is fresh at that commit:
node backend/scripts/build-pack-manifest.js ALN-TokenData \
  && git -C ALN-TokenData diff --quiet pack-manifest.json && echo OK
```

`pack-manifest.json`'s `contentHash` is a digest of the pack's
contents, not a revision — nothing maps it back to one. Read it as
the check AFTER the pin: with blue's sha checked out, green's
`/health` reports the same hash blue's does.

### 2. Mount blue's share

Blue's filesystem is reachable from green over a network share. Six
things are copied from it and six more are read off it; everything
between here and the first `npm start` needs it mounted.

The share's name and credentials are the owner's. Substitute them for
the placeholders.

```bash
sudo apt install -y cifs-utils
sudo mkdir -p /mnt/blue
sudo mount -t cifs //<blue>/<share> /mnt/blue \
  -o username=<user>,uid=$(id -u),gid=$(id -g)
```

Check the mount by listing the one directory the next step needs:

```bash
ls -l /mnt/blue/ALN-Ecosystem/backend/ssl/
```

Two files, `cert.pem` and `key.pem`. If that listing fails, stop and
fix the mount — every copy step below reads through it.

Unmount when the build is done: `sudo umount /mnt/blue`.

### 3. Certificate — check, then copy

Do this **after the clone** and **before the first `npm start`**. A
fresh clone already serves a certificate (`CN=10.0.0.177` — see "SSL
Certificate Setup"), so a machine started before this step serves the
wrong one silently, and a copy made after it without a restart
changes nothing.

**1. Establish what blue actually serves.** The file on blue's disk
and the certificate blue serves on the wire are not the same claim.
Check both.

```bash
# On blue — the file:
openssl x509 -in ~/ALN-Ecosystem/backend/ssl/cert.pem -noout \
  -fingerprint -sha256 -ext subjectAltName -enddate

# From any machine on the kit network — the wire:
openssl s_client -connect 192.168.0.191:3000 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256 -ext subjectAltName -enddate
```

Same fingerprint means the file on disk is the certificate the
tablets accepted. Note the SAN and the `notAfter` date — those are
what decide whether route 1 or route 2 applies.

**2. Copy that pair onto green.**

```bash
cd ~/ALN-Ecosystem
cp /mnt/blue/ALN-Ecosystem/backend/ssl/cert.pem backend/ssl/cert.pem
cp /mnt/blue/ALN-Ecosystem/backend/ssl/key.pem  backend/ssl/key.pem
chmod 600 backend/ssl/key.pem
```

`git status` will now show `backend/ssl/*` modified — the pair is
tracked in the repository. **Leave it uncommitted, and never
`git checkout` or `git pull` over it.**

**3. Verify on green**, once the server is up: the fingerprint must
equal blue's.

```bash
openssl s_client -connect localhost:3000 </dev/null 2>/dev/null \
  | openssl x509 -noout -fingerprint -sha256
```

**If the fingerprints differ, or `notAfter` falls before a show, or
the SAN does not name the venue address and a tablet warns with a
name error:** regenerate with the IP-SAN recipe in "SSL Certificate
Setup" instead. Every tablet and the Pi 4 remote display then warn
and accept once again.

### 4. The environment file — copy, then audit

Do this **after the clone**, and **before both** the Home Assistant
container step and the first `npm start`.

With no `.env` the server still boots — that is what makes this step
easy to skip and expensive to skip. It boots on
`adminPassword: 'admin'` and
`jwtSecret: 'change-this-secret-in-production'`
(`backend/src/config/index.js:67-68`), and `validateConfig()`
(`:163-185`) checks neither. It spawns `chromium-browser`, which does
not exist. An empty `HOME_ASSISTANT_TOKEN` makes the lighting service
disable itself. Nothing in the log names any of it.

```bash
cd ~/ALN-Ecosystem
cp /mnt/blue/ALN-Ecosystem/backend/.env backend/.env
chmod 600 backend/.env
```

**Then audit it for blue-only values.** Print the keys that carry
machine-specific state:

```bash
grep -n -E '^(PACK_PATH|PROFILE_PATH|SSL_KEY_PATH|SSL_CERT_PATH|VIDEO_DIR|HOME_ASSISTANT_URL|HOME_ASSISTANT_TOKEN|HA_DOCKER_CONTAINER|SCOREBOARD_WINDOW_MARKER|IDLE_LOOP_FILE|CHROMIUM_BIN|DBUS_SESSION_BUS_ADDRESS|XDG_RUNTIME_DIR)=' backend/.env
```

| Key | What it must be on green |
|---|---|
| `PACK_PATH`, `PROFILE_PATH` | **Unset.** Both are loud-warning override seams a production machine leaves alone. An absolute path off blue's disk does not refuse boot; it degrades lighting and the idle loop. Delete the line, or repoint it. |
| `SSL_KEY_PATH`, `SSL_CERT_PATH` | The relative `./ssl/key.pem` / `./ssl/cert.pem`. |
| `VIDEO_DIR` | Unset, or the relative `./public/videos`. |
| `HOME_ASSISTANT_URL` | `http://localhost:8123` — HA runs on this machine. |
| `HOME_ASSISTANT_TOKEN` | Blue's token is valid ONLY with blue's copied config volume. Keep it if the volume was copied; mint a new one if HA was rebuilt from scratch. |
| `HA_DOCKER_CONTAINER` | Must equal the `docker run --name` used in the Home Assistant step (default `homeassistant`). |
| `CHROMIUM_BIN` | **Set it: `CHROMIUM_BIN=/usr/bin/chromium`.** |
| `SCOREBOARD_WINDOW_MARKER`, `IDLE_LOOP_FILE` | Normally unset; the defaults are right. |
| `DBUS_SESSION_BUS_ADDRESS`, `XDG_RUNTIME_DIR` | They embed a uid. Keep blue's values only if green's login user has the same `id -u`; otherwise rewrite them. Step 8 is where they are decided. |

Last, diff the key set against the template. A key in one and not the
other is a documentation defect worth reporting:

```bash
cd ~/ALN-Ecosystem/backend
diff <(grep -oE '^#?[A-Z_][A-Z0-9_]*=' .env.example | tr -d '#=' | sort -u) \
     <(grep -oE '^[A-Z_][A-Z0-9_]*='   .env         | tr -d  '=' | sort -u)
```

### 5. Home Assistant — copy the volume, then run the container

The procedure lives in its own section: **"Home Assistant
(Lighting)"**, above. Do it here in the sequence, after the `.env`
copy (`HA_DOCKER_CONTAINER` must equal the `docker run --name`) and
before the first `npm start`.

In short: `rsync -a /mnt/blue/ha-config/ ~/ha-config/` first, install
Docker, then run the container on blue's exact image digest rather
than `:stable`.

### 6. Install the WirePlumber rule (required for video audio)

The orchestrator owns VLC's stream volume. Without this drop-in,
WirePlumber's stream-restore competes with the orchestrator and can
silently mute video audio across reboots (the 2026-05-22 incident).
See `backend/CLAUDE.md` → "WirePlumber Configuration Dependency" for
the full rationale.

**WirePlumber 0.5 does not read Lua configuration at all.** Debian 13
ships 0.5.8, and drop-ins are now SPA-JSON `.conf` files in
`wireplumber.conf.d/`. A Lua file in `main.lua.d/` is silently
ignored — and the orchestrator's own boot check
(`backend/src/services/audioRoutingService.js:618`) only tests that
the old Lua path exists, so **copying blue's `.lua` file onto green
silences the warning and changes nothing.** Write the `.conf`.

> **Expect the orchestrator to log `WirePlumber rule missing` on
> every boot anyway, and do NOT act on it.** The boot check
> (`backend/src/services/audioRoutingService.js:617-630`) still tests
> only the old Lua path, so on a correctly built Trixie machine that
> warning is a **false alarm**. Its own text points at "DEPLOYMENT_GUIDE.md
> Step 5" — this section's old number, now step 6 — and the obedient response, writing
> the `.lua` file, is exactly what the never-copy list forbids: it
> silences the warning and protects nothing. The `pw-dump` check below
> is the truth about whether the rule is live. The orchestrator fix
> (teach the check the `.conf` path) is queued as a separate task;
> this paragraph goes away when it merges.

Create the directory first. No package ships `/etc/wireplumber/` —
WirePlumber's own configuration lives in `/usr/share/wireplumber/`,
and `/etc/wireplumber` is admin-created. A bare `tee` into it fails
with "No such file or directory".

```bash
sudo mkdir -p /etc/wireplumber/wireplumber.conf.d/
sudo tee /etc/wireplumber/wireplumber.conf.d/51-aln-vlc-no-restore.conf > /dev/null <<'EOF'
# ALN orchestrator: do not save or restore stream props/target for VLC.
# The orchestrator owns VLC's stream volume (audioRoutingService).
stream.rules = [
  {
    matches = [
      { application.process.binary = "vlc" }
    ]
    actions = {
      update-props = {
        state.restore-props = "false"
        state.restore-target = "false"
      }
    }
  }
]
EOF
systemctl --user restart wireplumber
systemctl --user status wireplumber
```

The values are the STRING `"false"`, quoted. WirePlumber's stream
script compares against the string; an unquoted `false` does not
match.

The status line must say `active`. A syntax error shows up in
`journalctl --user -u wireplumber`.

**Then prove the rule matched VLC.** The status check passes even
with a wrong key, a `tee` that failed, or a drop-in written into the
old `main.lua.d/`. This is the only check that does not:

```bash
# With a video playing:
pw-dump | grep -c '"state.restore-props": "false"'
```

At least 1. (`pw-dump` comes from `pipewire-bin`.)

End to end: set the video volume from the GM panel, restart the
orchestrator, play again. The volume must be what the orchestrator
set.

> **Changed from:** an earlier revision of this guide wrote a Lua
> drop-in to `/etc/wireplumber/main.lua.d/51-aln-vlc-no-restore.lua`.
> That was right for WirePlumber 0.4 on Bookworm and is inert on
> 0.5.8. The canonical copies of both files are under
> `docs/wireplumber/`. Note that the `mkdir -p` line moves with the
> path — an operator who adapts the old block by changing only the
> `tee` target writes the drop-in where 0.5.8 never looks.

### 7. Media transfer — videos, music, cue sounds

The procedure lives in its own section: **"Media Transfer (building a
new machine)"**, above. Do it here in the sequence, after the
WirePlumber rule and before the first `npm start` — the idle loop is a
video file, and boot-to-running has nothing to show without it.

In short: three `rsync` lines off the mounted share, then the four
verify blocks (videos, cue sounds, `npm run music:seed`, the asset
manifest hash).

### 8. Boot-to-running (auto-start posture)

Goal (ROADMAP, the boot pain): power on the Pi with the venue TV
connected and arrive at a running show system — orchestrator up, VLC
idle loop on the TV — with no terminal work. The pieces:

#### First, decide the environment the first start freezes

**Do this before the first `npm start`.** PM2 injects the current
shell's environment when it first starts a process and keeps it:
`pm2 save` writes the process list with that environment into the
dump file, and the unit `pm2 startup` generates carries only `PATH`
and `PM2_HOME` and runs `pm2 resurrect`. A restart re-reads the shell
only with `--update-env`.

The orchestrator adds nothing of its own. `backend/ecosystem.config.js`
sets `NODE_ENV`, `PORT`, `HOST`, `HTTPS` and the SSL paths and no
more; only `DISPLAY` is defaulted in code
(`backend/src/utils/displayDriver.js:56-57`). So whatever the first
`npm start`'s shell had for `DBUS_SESSION_BUS_ADDRESS` and
`XDG_RUNTIME_DIR` is what **every boot after it** gets — and every
`pactl` call, every `dbus-send`, every `dbus-monitor` inherits it.

Get this wrong and the machine boots, serves, and looks fine: `audio`
reports down, every VLC D-Bus call throws, the idle loop never
starts, and nothing in the log names the cause.

**1. Read the address in a terminal inside green's desktop session.**

```bash
echo $DBUS_SESSION_BUS_ADDRESS
id -u
```

Two shapes come back, and they are not equal:

- `unix:path=/run/user/1000/bus` — a fixed path that exists on every
  boot once the user is logged in. Good.
- `unix:abstract=/tmp/dbus-XXXXX` — minted per session and dead the
  moment the machine is power-cycled. It freezes into PM2 just as
  well, passes the bench on the day, and fails the first cold boot at
  the venue.

**2. Write the two lines into `backend/.env`,** using the uid `id -u`
printed:

```env
DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
XDG_RUNTIME_DIR=/run/user/1000
```

`.env` is untracked and machine-local, which is where a uid belongs.

**3. Start from the right shell.** `dotenv.config()`
(`backend/src/config/index.js:10`) passes no `override`, so dotenv
leaves alone any variable already in `process.env`. The two lines
above therefore bite only in a shell that has NOT already exported
them:

- If the echo in step 1 printed the `unix:path=/run/user/<uid>/bus`
  form, a first `npm start` from the desktop terminal is fine — the
  shell's value and the `.env` value agree.
- If it printed an `abstract=` address, **start from SSH**, where the
  variable is unset and `.env` supplies it.

If PM2 already holds a bad environment, fix it from SSH as well —
`--update-env` re-injects the invoking shell's environment, so from
the desktop terminal it re-freezes the same bad address:

```bash
pm2 restart aln-orchestrator --update-env && pm2 save
```

> **Changed from:** the preflight checklist used to say to add
> `DBUS_SESSION_BUS_ADDRESS` to an `env_production` block in
> `backend/ecosystem.config.js`. **There is no such block.**
> `ecosystem.config.js` has `env`, `env_development` and
> `env_staging`, and `npm start` is a bare
> `pm2 start ecosystem.config.js` with no `--env`, so PM2 applies only
> the default `env` block. Following that instruction creates a block
> PM2 never reads. Use `backend/.env`.

#### Then start it, and make it resurrect

```bash
cd ~/ALN-Ecosystem/backend
npm start            # first manual start (builds GM scanner, starts PM2)
pm2 save             # snapshot the process list AND its environment
pm2 startup          # generate the systemd unit
# Run the sudo command it outputs — PM2 now resurrects on boot
```

What each boot then does, and what it depends on:

1. systemd starts PM2's resurrect service → `aln-orchestrator` runs.
2. The orchestrator spawns and supervises its own VLC, MPD, and
   (when the display mode calls for it) the scoreboard Chromium —
   none of these need separate auto-start entries.
3. **Display dependency:** VLC and Chromium render on `DISPLAY=:0`,
   so the desktop auto-login AND the X11 session (step 0, entries 3
   and 4) must both be set. PM2's systemd unit can start BEFORE the
   graphical session exists; the orchestrator's ProcessMonitor
   retries VLC, which papers over the race — but this ordering is
   exactly the kind of thing CI cannot test.
4. Home Assistant: with `--restart=unless-stopped` on the container
   (and/or `HA_DOCKER_MANAGE=true`), lighting comes up without
   intervention.

#### The cold-boot check

Power-cycle with nothing attached but power, network and the TV. Once
the idle loop is up, run all four.

```bash
# 1. The orchestrator's own environment carries all three variables.
PID=$(pgrep -f 'node .*src/server.js' | head -1)
tr '\0' '\n' < /proc/$PID/environ \
  | grep -E '^(DBUS_SESSION_BUS_ADDRESS|XDG_RUNTIME_DIR|DISPLAY)='
```

2. The GM panel's System Status shows `audio` healthy — that is
   `pactl info` answering inside the orchestrator's own environment —
   and `vlc` healthy.
3. Pause, then resume, the idle loop from the panel. That is a
   transport command over D-Bus, and the TV must react.
4. From a terminal in the desktop session, VLC answers on the bus the
   desktop sees:

```bash
dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply \
  /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping
```

**Read these after the logind window, not inside it.**
`/run/user/<uid>` is created by pam_systemd when the user's first
login session opens; PM2's unit starts `After=network.target`, not
the graphical target. So for the first seconds after a cold boot the
orchestrator can be up before the directory and the bus socket exist:
`pactl info` fails with the path correct and `audio` reports down. The
health registry re-probes every service every 15 seconds
(`backend/src/app.js:333-340`), so `audio` recovers on the next pass.
**A light still down a minute after the idle loop appears is the
fault; one that clears on the first re-probe is the window.**

> **Stage-B checklist item (home hardware pass):** perform at least
> one cold power-cycle with nothing attached but power, network, and
> the TV, and verify the idle loop appears unaided. If VLC loses the
> boot race and the ProcessMonitor retries don't recover it, the fix
> to test is delaying PM2's unit until the graphical target
> (`systemctl edit pm2-<user>` → `After=graphical.target`); record
> what the bench shows.

### 9. Configure for HDMI Output

Edit `/boot/firmware/config.txt` (this path is the same on Bookworm
and Trixie; releases before Bookworm used `/boot/config.txt`):
```ini
# Force HDMI output
hdmi_force_hotplug=1
hdmi_drive=2
hdmi_group=2
hdmi_mode=82  # 1080p 60Hz
```

These are legacy firmware keys. Whether the Pi 5's KMS driver honours
them has not been established. Building green from blue: compare
blue's file rather than copying it — a boot config written for
Bookworm does not belong on Trixie.

```bash
diff /mnt/blue/boot/firmware/config.txt /boot/firmware/config.txt
```

The test that settles it is a cold boot with the TV attached and the
picture right.

### 9b. Pi 5 Video Settings (CRITICAL — HEVC only)

These settings used to live only in `backend/CLAUDE.md`. They are
deployment facts, so they live here now; the agent document points
back at this section.

**The Pi 5 has NO H.264 hardware decoder.** The hardware block is
physically absent. Only HEVC (H.265) is hardware-decoded, through
`rpi-hevc-dec` at `/dev/video19`. **Every game video, the idle loop
included, MUST be HEVC**, or VLC software-decodes at ~47% CPU with
visible artifacts.

**VLC's video output must be `--vout=gles2`** (EGL/OpenGL ES 2, the
Pi 5's native GPU path, ~8% CPU). It is auto-detected on the Pi 5 by
`vlcMprisService._getHwAccelArgs()`; override only through the
`VLC_HW_ACCEL` environment key. `--vout=gl` goes through Mesa's
desktop-OpenGL compatibility layer: 280% CPU and black screens. Both
`gles2` and `gl` avoid DRM plane conflicts with Xorg; only `gles2` is
cheap.

**Encoding a video for this machine:**

```bash
ffmpeg -i INPUT.mp4 \
  -c:v libx265 -crf 20 -preset medium -tag:v hvc1 \
  -g 60 -keyint_min 30 \
  -movflags +faststart \
  -c:a copy \
  OUTPUT.mp4 -y
```

- `-tag:v hvc1` is what makes players recognise the stream as HEVC.
- `-movflags +faststart` is required. Without it the moov atom sits
  at the end of the file and the first frame freezes.
- `-g 60 -keyint_min 30` is a keyframe every two seconds at 30fps,
  which is what makes seeking reliable.

**Verify hardware decode on the bench:**

```bash
DISPLAY=:0 cvlc --verbose 2 --play-and-exit video.mp4 2>&1 \
  | grep -i "v4l2\|Hwaccel\|hw fail\|codec.*started\|gles2"
```

- `Hwaccel V4L2 HEVC stateless V4` — hardware decode is working.
- `Set hw fail` at init — a false alarm from the pre-vout probe.
  Look for the `Hwaccel` lines that come after it.
- `Could not find a valid device` for `h264_v4l2m2m` — expected on a
  Pi 5. There is no H.264 hardware.

Measure CPU with `top -b -n2 -d1 -p <pid>` (instantaneous), not
`ps -o %cpu` (a cumulative average that will flatter a bad setup).

### 10. The venue address (cutover step)

The orchestrator answers on one fixed address on the kit network:
**192.168.0.191**. Every GM tablet and every hardware scanner is
configured against it. It is not set on the Pi — it is a **DHCP
reservation on the kit router, keyed to the Pi's MAC address**.

**So the cutover step is a router change, not a green change.** Green
has a new MAC. When blue is unplugged and green is plugged in, move
the 192.168.0.191 reservation from blue's MAC to green's. Rolling
back is moving it back. Two machines cannot hold the address at once,
so leave green on plain DHCP at home and make this change only at
cutover.

Read green's MAC before the day: `ip link show` — the `link/ether`
line of the interface that is on the kit WiFi.

**If the address must be set on the machine instead**, Raspberry Pi
OS uses **NetworkManager** (`nmcli` / `nmtui`), not `dhcpcd`:

```bash
# List connections to find the name (e.g. "preconfigured" or "Wired connection 1")
nmcli con show

# Apply a static IPv4 config
sudo nmcli con mod "<connection-name>" \
  ipv4.addresses 192.168.0.191/24 \
  ipv4.gateway <router> \
  ipv4.dns <router> \
  ipv4.method manual

# Re-activate the connection to apply
sudo nmcli con up "<connection-name>"
```

Then reboot and check that it survived. On Trixie a profile written
by `nmcli con mod` can land under `/run/NetworkManager/system-connections/`,
which is a tmpfs — it is gone after a reboot.

```bash
ip addr
ls /etc/NetworkManager/system-connections/
```

If the profile is only under `/run`, copy it to
`/etc/NetworkManager/system-connections/` with mode 600 and run
`nmcli con reload`.

DNS is not set up on the kit network today, and the profile records
that. DNS and a real-domain certificate are deferred together
(ROADMAP row 8.19).

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

**Skip this on a fresh Raspberry Pi OS image.** `ufw` is not
installed, the kit network carries its own router and no internet
connection, and nothing on it needs a host firewall. The rules below
are for a machine that already runs one.

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

### The connection posture and the two scoreboard displays

How the venue is wired today. This is the posture green must
reproduce, not a menu of options.

**One fixed address, over HTTPS.** Every device reaches the
orchestrator at `https://192.168.0.191:3000` on the kit WiFi. The
address is a DHCP reservation on the kit router — see "10. The venue
address". There is no DNS on the kit network: DNS and a real-domain
certificate are deferred together (ROADMAP row 8.19, spike S2), so
every URL is an IP address and every browser sees a self-signed
certificate.

**One certificate, accepted once per device.** Green serves the same
self-signed pair blue served, copied over the share ("3.
Certificate — check, then copy"). Because the fingerprint is
unchanged, the two GM tablets and the Pi 4 remote display keep the
trust they already granted and warn no-one at the cutover. If the
certificate is ever regenerated, every one of those devices warns
once and has to be clicked through again — on each device, by hand.
GM tablets need this: Web NFC only works in a secure context.
Hardware scanners do not: they skip certificate checks.

**Two scoreboard displays, and they are not the same thing.**

| | The TV | The remote display |
|---|---|---|
| What it is | The venue TV on the orchestrator Pi's own HDMI output | A separate Pi 4 running a browser in fullscreen |
| Who runs the browser | **The orchestrator does.** It spawns Chromium in kiosk mode itself (`backend/src/utils/displayDriver.js:165`) | A person, or that machine's own autostart |
| When the browser starts | Only when the scoreboard is first SHOWN from the GM panel — not at boot | At that machine's boot |
| Setup on green | None beyond `CHROMIUM_BIN` and the X11 session. Do not add an autostart entry for it | None. It is not rebuilt this week |
| Shares the screen with | The idle loop and the game-event videos, which is why the orchestrator shows and hides it | Nothing |

The TV kiosk being absent is **not** a fault. The panel's `display`
light reads healthy both when the kiosk is running and when there is
no kiosk process and the scoreboard is hidden
(`backend/src/utils/displayDriver.js:340-378`) — hidden is the idle
posture. **The only proof that the TV display works is the TV:** show
the scoreboard from the panel, see it on the venue TV, hide it again.
A green light proves nothing on its own.

The remote display is a display, not a GM station: it does not occupy
a GM-station slot or appear as a device row.

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

This is for a SEPARATE display device — the Pi 4 remote display. The
orchestrator Pi's own TV kiosk is spawned by the orchestrator and
needs none of this; see "The connection posture and the two
scoreboard displays" below.

```bash
# Install Chromium if needed. The package is `chromium` on Debian 13
# and Bookworm; `chromium-browser` was the pre-Bookworm Pi build.
sudo apt install chromium

# Create kiosk launcher script
cat > ~/scoreboard.sh << 'EOF'
#!/bin/bash
chromium --kiosk --noerrdialogs --disable-infobars \
  --disable-session-crashed-bubble \
  --ignore-certificate-errors \
  --app=https://[ORCHESTRATOR-IP]:3000/scoreboard
EOF
chmod +x ~/scoreboard.sh

# Auto-start on boot. On an X11/LXDE session, add this line to
# ~/.config/lxsession/LXDE-pi/autostart:
@/home/pi/scoreboard.sh
```

The remote display in service today is a Pi 4 still on its original
image and is **not** rebuilt this week. When it is reimaged, both the
package name above and the autostart file change: a Wayland/labwc
session does not read the `lxsession` autostart file. Establish the
right autostart path on that machine at the time.

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
- **Flexibility**: Works on any local network. On the kit network the
  orchestrator's address is a router DHCP reservation, and moving that
  reservation is the cutover step — see "10. The venue address".
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
