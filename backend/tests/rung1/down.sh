#!/usr/bin/env bash
# Rung-1 harness teardown: stops what up.sh/engine.sh started (CS.1).
# Kills by the EXACT pid files up.sh writes — an earlier version named
# a pid file up.sh never wrote and left whole process generations
# alive across re-runs (recorded in the CS.1 audit).
set -u
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
HERE="$(cd "$(dirname "$0")" && pwd)"

"$HERE/engine.sh" stop 2>/dev/null

docker rm -f rung1-ha >/dev/null 2>&1 && echo "[rung1] ha stopped"

for name in pipewire wireplumber pwpulse xvfb dbus; do
  f="$RUNG1/$name.pid"
  if [ -f "$f" ]; then
    kill "$(cat "$f")" 2>/dev/null && echo "[rung1] $name stopped"
    rm -f "$f"
  fi
done

# Engine-spawned children the engine failed to reap (crash paths):
for f in /tmp/aln-pm-*.pid; do
  [ -f "$f" ] || continue
  kill "$(cat "$f")" 2>/dev/null && echo "[rung1] reaped $(basename "$f")"
  rm -f "$f" 2>/dev/null
done

# dockerd is left running if up.sh started it: other work may share it.
echo "[rung1] down (dockerd left as-is)"
