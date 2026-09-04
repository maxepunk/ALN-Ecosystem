#!/usr/bin/env bash
# Rung-1 harness bring-up (CS.1; CONTEXT.md "Environment ladder").
# Real software, fake physics: VLC dummy-out, MPD null-output,
# pipewire null sinks, Home Assistant (pinned container) loaded with
# the pack-generated witness register. Idempotent: safe to re-run.
#
# Usage: up.sh [PACK_DIR]   (default: the repo's ALN-TokenData)
# Recipes and measured verdicts:
#   docs/plans/2026-09-04-rung1-capability-research.md
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../.." && pwd)"
REPO="$(cd "$BACKEND/.." && pwd)"
PACK_DIR="${1:-$REPO/ALN-TokenData}"
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
mkdir -p "$RUNG1"
HA_IMAGE="ghcr.io/home-assistant/home-assistant:stable"
FAILURES=0

note() { echo "[rung1] $*"; }
fail() { echo "[rung1] FAIL: $*"; FAILURES=$((FAILURES + 1)); }

# --- generated fixtures (one truth: regenerated from the pack) -----
mkdir -p "$RUNG1/ha-config"
node "$HERE/generate-fixtures.js" "$PACK_DIR" "$RUNG1" \
  && note "fixtures generated from $(basename "$PACK_DIR")" \
  || fail "fixture generation"

# --- pipewire + null sink -----------------------------------------
export XDG_RUNTIME_DIR="$RUNG1/xdg"
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
if ! pactl info >/dev/null 2>&1; then
  # No systemd user session in containers: run the trio under a
  # private dbus session (research doc recipe).
  dbus-run-session -- sh -c \
    "pipewire > '$RUNG1/pipewire.log' 2>&1 & wireplumber > '$RUNG1/wireplumber.log' 2>&1 & pipewire-pulse > '$RUNG1/pwpulse.log' 2>&1 & sleep 4; pactl load-module module-null-sink sink_name=rung1_hdmi; pactl load-module module-null-sink sink_name=rung1_bt; sleep infinity" \
    > "$RUNG1/dbus-session.log" 2>&1 &
  echo $! > "$RUNG1/pipewire-session.pid"
  sleep 5
fi
pactl info >/dev/null 2>&1 && note "pipewire OK" || fail "pipewire"

# --- MPD -----------------------------------------------------------
if ! mpc -h 127.0.0.1 status >/dev/null 2>&1; then
  mkdir -p "$RUNG1/mpd/music" "$RUNG1/mpd/playlists"
  cat > "$RUNG1/mpd/mpd.conf" <<EOF
music_directory "$RUNG1/mpd/music"
playlist_directory "$RUNG1/mpd/playlists"
db_file "$RUNG1/mpd/db"
log_file "$RUNG1/mpd/log"
pid_file "$RUNG1/mpd/pid"
bind_to_address "127.0.0.1"
port "6600"
audio_output {
  type "null"
  name "null"
}
EOF
  mpd "$RUNG1/mpd/mpd.conf" 2>/dev/null
  sleep 1
fi
mpc -h 127.0.0.1 status >/dev/null 2>&1 && note "mpd OK" || fail "mpd"

# --- VLC (refuses root: dedicated user) ---------------------------
if ! curl -s -o /dev/null -u ":rung1" http://127.0.0.1:8090/requests/status.json; then
  id rung1vlc >/dev/null 2>&1 || useradd -m rung1vlc 2>/dev/null || true
  runuser -u rung1vlc -- cvlc -I http --http-host 127.0.0.1 \
    --http-port 8090 --http-password rung1 --vout dummy --aout dummy \
    > "$RUNG1/vlc.log" 2>&1 &
  echo $! > "$RUNG1/vlc.pid"
  for i in $(seq 1 10); do
    sleep 1
    curl -s -o /dev/null -u ":rung1" \
      http://127.0.0.1:8090/requests/status.json && break
  done
fi
curl -s -o /dev/null -u ":rung1" http://127.0.0.1:8090/requests/status.json \
  && note "vlc OK" || fail "vlc"

# --- Home Assistant (witness register) ----------------------------
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
    # First boot serves onboarding instead of auth providers.
    c2=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/api/onboarding)
    [ "$c2" = "200" ] && { READY=1; break; }
    sleep 3
  done
  [ -n "$READY" ] && note "ha OK" || fail "ha readiness"
else
  fail "dockerd"
fi

if [ "$FAILURES" -gt 0 ]; then
  note "$FAILURES arm(s) failed — see logs under $RUNG1"
  exit 1
fi
note "harness up (state under $RUNG1)"
