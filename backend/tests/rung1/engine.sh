#!/usr/bin/env bash
# Boot/stop the engine against the rung-1 harness AS THE NON-ROOT
# harness user (CS.1 audit requirement: VLC refuses root, so a root
# engine's own VLC supervisor loops forever — the audit must run the
# engine the way the venue does: one non-root user for everything).
#
# Usage: engine.sh start|stop|status
# Prereq: up.sh has run (env.sh + user + writable dirs exist).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$(cd "$HERE/../.." && pwd)"
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
RUNG1_USER="${RUNG1_USER:-rung1vlc}"
PORT="${RUNG1_ENGINE_PORT:-3199}"

note() { echo "[rung1-engine] $*"; }

engine_pid() { [ -f "$RUNG1/engine.pid" ] && cat "$RUNG1/engine.pid"; }
running() {
  local pid; pid=$(engine_pid)
  [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null
}

case "${1:-}" in
  start)
    if running; then note "already running (pid $(engine_pid))"; exit 0; fi
    [ -f "$RUNG1/env.sh" ] || { note "no $RUNG1/env.sh — run up.sh first"; exit 1; }
    # A prior ROOT boot leaves root-owned files in sticky /tmp that
    # block the non-root engine's own writes (mpd conf/socket/db, pm
    # pid files). Sweep needs root; refuse loudly if we can't.
    stale=$(find /tmp -maxdepth 1 -name 'aln-*' ! -user "$RUNG1_USER" 2>/dev/null)
    if [ -n "$stale" ]; then
      if [ "$(id -u)" = "0" ]; then
        rm -rf /tmp/aln-pm-*.pid /tmp/aln-mpd.conf /tmp/aln-mpd.sock \
          /tmp/aln-mpd.db /tmp/aln-mpd.log /tmp/aln-mpd.state \
          /tmp/aln-mpd-internal.pid /tmp/aln-mpd-playlists
        note "swept stale root-owned /tmp/aln-* artifacts"
      else
        note "stale /tmp/aln-* artifacts owned by another user — run as root once"
        exit 1
      fi
    fi
    # shellcheck disable=SC1091
    . "$RUNG1/env.sh"
    # cwd MUST be $BACKEND: dotenv loads backend/.env from process.cwd()
    # — invoked from the repo root (CI), the engine otherwise boots with
    # no ADMIN_PASSWORD and the audit's auth gets 401 (run 3's failure).
    runuser -u "$RUNG1_USER" -- env \
      DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" \
      XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" \
      MPD_HOST="$MPD_HOST" \
      HOME_ASSISTANT_URL="$HOME_ASSISTANT_URL" \
      HOME_ASSISTANT_TOKEN="$HOME_ASSISTANT_TOKEN" \
      PROFILE_PATH="$PROFILE_PATH" \
      PACK_PATH="$PACK_PATH" \
      DATA_DIR="$DATA_DIR" \
      LOGS_DIR="$LOGS_DIR" \
      DISPLAY="${DISPLAY:-:99}" CHROMIUM_BIN="${CHROMIUM_BIN:-}" \
      PORT="$PORT" ENABLE_HTTPS=false ENABLE_VIDEO_PLAYBACK=true \
      sh -c "cd '$BACKEND' && exec node src/server.js" \
      > "$RUNG1/engine.log" 2>&1 &
    echo $! > "$RUNG1/engine.pid"
    for i in $(seq 1 20); do
      sleep 1
      curl -s "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
    done
    if curl -s "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
      note "engine up as $RUNG1_USER on :$PORT (log: $RUNG1/engine.log)"
    else
      note "engine not answering /health after 20s — see $RUNG1/engine.log"
      exit 1
    fi
    ;;
  stop)
    if ! running; then note "not running"; exit 0; fi
    pid=$(engine_pid)
    kill -TERM "$pid" 2>/dev/null
    for i in $(seq 1 10); do
      sleep 1; kill -0 "$pid" 2>/dev/null || break
    done
    kill -0 "$pid" 2>/dev/null && { kill -KILL "$pid"; note "escalated to SIGKILL"; }
    rm -f "$RUNG1/engine.pid"
    note "engine stopped"
    ;;
  status)
    if running; then
      note "running (pid $(engine_pid))"
      curl -s "http://127.0.0.1:$PORT/health" | head -c 400; echo
    else
      note "not running"
    fi
    ;;
  *)
    echo "usage: engine.sh start|stop|status"; exit 2
    ;;
esac
