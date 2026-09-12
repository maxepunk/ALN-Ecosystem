#!/usr/bin/env bash
# Rung-1 harness bring-up (CS.1; CONTEXT.md "Environment ladder").
# Real software on the ENGINE'S OWN TRANSPORTS, fake physics only.
#
# Process ownership (audit-corrected, venue-faithful): on the venue Pi
# EVERYTHING runs as one non-root user. The harness mirrors that: the
# session bus and pipewire run AS $RUNG1_USER, and the engine is booted
# as $RUNG1_USER by engine.sh. Root does only what root must: docker,
# the HA container, user/dir creation, stale-artifact sweep.
#
# The harness does NOT start MPD or VLC: the engine SELF-HOSTS both
# (musicService spawns mpd on /tmp/aln-mpd.sock; vlcMprisService spawns
# cvlc owning org.mpris.MediaPlayer2.vlc). A harness-owned instance
# CONTENDS with the engine's child (Unix-socket steal, MPRIS bus-name
# collision -> the child-identity confusion in the CS.1 audit record).
#
# Idempotent: safe to re-run. Sources of truth:
#   docs/plans/2026-09-04-rung1-capability-research.md (recipes)
#   docs/plans/2026-09-04-phase3-c2c3-resolution-dormancy.md §9 (audit)
#
# Usage: up.sh [PACK_DIR]   (default: the repo's ALN-TokenData)
# After: tests/rung1/engine.sh start   (boots the engine non-root)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../.." && pwd)"
REPO="$(cd "$BACKEND/.." && pwd)"
PACK_DIR="${1:-$REPO/ALN-TokenData}"
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
RUNG1_USER="${RUNG1_USER:-rung1vlc}"
HA_IMAGE="ghcr.io/home-assistant/home-assistant:stable"
FAILURES=0

note() { echo "[rung1] $*"; }
fail() { echo "[rung1] FAIL: $*"; FAILURES=$((FAILURES + 1)); }
as_user() { runuser -u "$RUNG1_USER" -- "$@"; }

mkdir -p "$RUNG1"
id "$RUNG1_USER" >/dev/null 2>&1 || useradd -m "$RUNG1_USER" 2>/dev/null || true

# --- generated fixtures (one truth: regenerated from the pack) -----
node "$HERE/generate-fixtures.js" "$PACK_DIR" "$RUNG1" \
  && note "fixtures generated from $(basename "$PACK_DIR")" \
  || fail "fixture generation"

# --- ownership + engine-writable dirs ------------------------------
mkdir -p "$RUNG1/xdg" "$RUNG1/engine-logs" "$RUNG1/engine-data"
chown -R "$RUNG1_USER" "$RUNG1"
chmod 700 "$RUNG1/xdg"

# --- stale engine artifacts (a prior ROOT boot leaves root-owned ---
# files in sticky /tmp that block a non-root engine's own writes)
if ! pgrep -f 'node src/server.js' >/dev/null 2>&1; then
  rm -f /tmp/aln-pm-*.pid /tmp/aln-mpd.conf /tmp/aln-mpd.sock \
    /tmp/aln-mpd.db /tmp/aln-mpd.log /tmp/aln-mpd.state \
    /tmp/aln-mpd-internal.pid
  rm -rf /tmp/aln-mpd-playlists
else
  note "engine already running — skipping /tmp sweep"
fi

# --- shared session bus (as $RUNG1_USER; permissive conf kept so a --
# root-launched tool can still probe the same bus)
export DBUS_SESSION_BUS_ADDRESS="unix:path=$RUNG1/dbus.sock"
bus_ok() {
  as_user env DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
    dbus-send --session --dest=org.freedesktop.DBus --type=method_call \
    / org.freedesktop.DBus.ListNames >/dev/null 2>&1
}
if ! bus_ok; then
  cat > "$RUNG1/dbus-rung1.conf" <<EOF
<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-Bus Bus Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">
<busconfig>
  <type>session</type>
  <listen>unix:path=$RUNG1/dbus.sock</listen>
  <auth>EXTERNAL</auth>
  <policy context="default">
    <allow user="*"/>
    <allow send_destination="*" eavesdrop="true"/>
    <allow eavesdrop="true"/>
    <allow own="*"/>
  </policy>
</busconfig>
EOF
  chown "$RUNG1_USER" "$RUNG1/dbus-rung1.conf"
  as_user dbus-daemon --config-file="$RUNG1/dbus-rung1.conf" --nofork \
    > "$RUNG1/dbus-daemon.log" 2>&1 &
  echo $! > "$RUNG1/dbus.pid"
  sleep 1
  chmod 666 "$RUNG1/dbus.sock" 2>/dev/null
fi
bus_ok && note "session bus OK (user: $RUNG1_USER)" || fail "session bus"

# --- pipewire + null sinks (as $RUNG1_USER, same bus) --------------
export XDG_RUNTIME_DIR="$RUNG1/xdg"
pw_env() {
  as_user env XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
    DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" "$@"
}
if ! pw_env pactl info >/dev/null 2>&1; then
  pw_env pipewire > "$RUNG1/pipewire.log" 2>&1 &
  echo $! > "$RUNG1/pipewire.pid"
  pw_env wireplumber > "$RUNG1/wireplumber.log" 2>&1 &
  echo $! > "$RUNG1/wireplumber.pid"
  pw_env pipewire-pulse > "$RUNG1/pwpulse.log" 2>&1 &
  echo $! > "$RUNG1/pwpulse.pid"
  sleep 4
  pw_env pactl load-module module-null-sink sink_name=rung1_hdmi >/dev/null 2>&1
  pw_env pactl load-module module-null-sink sink_name=rung1_bt >/dev/null 2>&1
fi
pw_env pactl info >/dev/null 2>&1 && note "pipewire OK (user: $RUNG1_USER)" \
  || fail "pipewire"

# --- Xvfb: the display's fake physics ------------------------------
# The engine's VLC vout and the scoreboard Chromium kiosk both need a
# REAL X server; only the screen is virtual. Without it every VLC item
# lands `stopped` (found by the first live-flow audit: video:loading
# fired, playback never started, restore-after-video never fired).
export DISPLAY="${RUNG1_DISPLAY:-:99}"
if ! as_user env DISPLAY="$DISPLAY" xdotool getdisplaygeometry >/dev/null 2>&1; then
  as_user Xvfb "$DISPLAY" -screen 0 1280x720x24 \
    > "$RUNG1/xvfb.log" 2>&1 &
  echo $! > "$RUNG1/xvfb.pid"
  sleep 2
fi
as_user env DISPLAY="$DISPLAY" xdotool getdisplaygeometry >/dev/null 2>&1 \
  && note "xvfb OK ($DISPLAY)" || fail "xvfb"

# --- Home Assistant (witness register + API onboarding) ------------
if ! docker info >/dev/null 2>&1; then
  dockerd --iptables=false --bridge=none --storage-driver=vfs \
    > "$RUNG1/dockerd.log" 2>&1 &
  echo $! > "$RUNG1/dockerd.pid"
  for i in $(seq 1 15); do sleep 2; docker info >/dev/null 2>&1 && break; done
fi
if docker info >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' | grep -q '^rung1-ha$'; then
    docker rm -f rung1-ha >/dev/null 2>&1 || true
    docker run -d --name rung1-ha --network=host \
      -v "$RUNG1/ha-config:/config" "$HA_IMAGE" > /dev/null 2>&1 \
      || fail "ha container start"
  fi
  READY=""
  for i in $(seq 1 60); do
    c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/auth/providers)
    [ "$c" = "200" ] && { READY=1; break; }
    c2=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/api/onboarding)
    [ "$c2" = "200" ] && { READY=1; break; }
    sleep 3
  done
  if [ -n "$READY" ]; then
    node "$HERE/onboard-ha.js" "$RUNG1" \
      && note "ha OK (onboarded, token at $RUNG1/ha-auth.json)" \
      || fail "ha onboarding"
  else
    fail "ha readiness"
  fi
else
  fail "dockerd"
fi

# --- engine environment file --------------------------------------
HA_TOKEN=""
[ -f "$RUNG1/ha-auth.json" ] && HA_TOKEN=$(node -e \
  "console.log(require('$RUNG1/ha-auth.json').access_token)" 2>/dev/null)
cat > "$RUNG1/env.sh" <<EOF
# source me before booting the engine against the rung-1 harness
export DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS"
export XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR"
export MPD_HOST="/tmp/aln-mpd.sock"
export HOME_ASSISTANT_URL="http://127.0.0.1:8123"
export HOME_ASSISTANT_TOKEN="$HA_TOKEN"
export PROFILE_PATH="$RUNG1/simulation-profile.json"
export PACK_PATH="$PACK_DIR"
export DATA_DIR="$RUNG1/engine-data"
export LOGS_DIR="$RUNG1/engine-logs"
export DISPLAY="$DISPLAY"
export CHROMIUM_BIN="/opt/pw-browsers/chromium"
EOF
chown "$RUNG1_USER" "$RUNG1/env.sh"
note "engine env written to $RUNG1/env.sh"

if [ "$FAILURES" -gt 0 ]; then
  note "$FAILURES arm(s) failed — see logs under $RUNG1"
  exit 1
fi
note "harness up — boot the engine with tests/rung1/engine.sh start"
