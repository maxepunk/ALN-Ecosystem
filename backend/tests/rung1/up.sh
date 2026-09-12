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

# --- the shared arms (tests/rung1/provision.js — ONE implementation
# with the E2E suite: fixtures from the pack, session bus, Xvfb,
# pipewire + null sinks, dockerd + witness Home Assistant, Bluetooth
# mock; recipes and lifecycle decisions live THERE, not here) --------
export DBUS_SESSION_BUS_ADDRESS="unix:path=$RUNG1/dbus.sock"
export XDG_RUNTIME_DIR="$RUNG1/xdg"
export DISPLAY="${RUNG1_DISPLAY:-:99}"
if node "$HERE/provision.js" --rung1-dir "$RUNG1" --pack "$PACK_DIR" \
    --bus-socket "$RUNG1/dbus.sock" --display "$DISPLAY" \
    > "$RUNG1/provision-result.json"; then
  note "shared arms up ($(node -e "
    const r = require('$RUNG1/provision-result.json');
    console.log(['bus','display','pulseServer','ha','bt']
      .filter((k) => r[k]).join(', '));"))"
else
  fail "shared provisioning (see $RUNG1/provision-result.json + logs)"
fi
BT_BUS=$(node -e "
  const r = require('$RUNG1/provision-result.json');
  console.log(r.bt && r.bt.mode === 'mock' ? r.bt.address : '');" 2>/dev/null)

# --- engine environment file --------------------------------------
# Long-lived HA token preferred (the engine's expected credential
# shape; the login-flow token expires in ~30 min — shorter than a leg).
HA_TOKEN=""
[ -f "$RUNG1/ha-auth.json" ] && HA_TOKEN=$(node -e "
  const a = require('$RUNG1/ha-auth.json');
  console.log(a.long_lived_token || a.access_token);" 2>/dev/null)
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
# Bluetooth: when the mock arm is live, the engine's bluetoothctl and
# dbus-monitor children must reach the private system bus.
[ -n "$BT_BUS" ] && echo "export DBUS_SYSTEM_BUS_ADDRESS=\"$BT_BUS\"" >> "$RUNG1/env.sh"
chown "$RUNG1_USER" "$RUNG1/env.sh"
note "engine env written to $RUNG1/env.sh"

if [ "$FAILURES" -gt 0 ]; then
  note "$FAILURES arm(s) failed — see logs under $RUNG1"
  exit 1
fi
note "harness up — boot the engine with tests/rung1/engine.sh start"
