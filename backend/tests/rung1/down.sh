#!/usr/bin/env bash
# Rung-1 harness teardown: stops what up.sh started (CS.1).
set -u
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
docker rm -f rung1-ha >/dev/null 2>&1 && echo "[rung1] ha stopped"
[ -f "$RUNG1/vlc.pid" ] && kill "$(cat "$RUNG1/vlc.pid")" 2>/dev/null \
  && echo "[rung1] vlc stopped"
[ -f "$RUNG1/mpd/pid" ] && kill "$(cat "$RUNG1/mpd/pid")" 2>/dev/null \
  && echo "[rung1] mpd stopped"
[ -f "$RUNG1/pipewire-session.pid" ] \
  && kill "$(cat "$RUNG1/pipewire-session.pid")" 2>/dev/null \
  && echo "[rung1] pipewire session stopped"
# dockerd is left running if up.sh started it: other work may share it.
echo "[rung1] down (dockerd left as-is)"
