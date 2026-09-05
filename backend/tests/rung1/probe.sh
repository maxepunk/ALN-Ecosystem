#!/usr/bin/env bash
# Rung-1 capability probe -> runner manifest (CS.1; CONTEXT.md
# "Environment ladder": probe-then-verdict, gaps recorded WITH
# reasons, never silently). Writes runner-manifest.json to RUNG1_DIR
# and prints it.
set -u
RUNG1="${RUNG1_DIR:-/tmp/rung1}"
mkdir -p "$RUNG1"
OUT="$RUNG1/runner-manifest.json"

cap() { # name ok reason
  printf '    "%s": {"ok": %s, "reason": "%s"}' "$1" "$2" "$3"
}

DOCKER_OK=false; DOCKER_WHY="daemon unreachable"
docker info >/dev/null 2>&1 && { DOCKER_OK=true; DOCKER_WHY="daemon responds"; }

PW_OK=false; PW_WHY="pactl cannot reach a pipewire session"
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-$RUNG1/xdg}" pactl info >/dev/null 2>&1 \
  && { PW_OK=true; PW_WHY="pactl info responds"; }

# MPD and VLC are ENGINE-OWNED transports (the engine self-hosts both);
# these report true only while the engine runs — false beforehand is
# honest, not a harness failure.
MPD_OK=false
MPD_WHY="engine-owned: engine self-hosts mpd on /tmp/aln-mpd.sock (engine not running?)"
MPD_HOST=/tmp/aln-mpd.sock mpc status >/dev/null 2>&1 \
  && { MPD_OK=true; MPD_WHY="mpc status responds on the engine socket"; }

# Engine-faithful VLC check: the same MPRIS dbus-send the engine makes.
VLC_OK=false
VLC_WHY="engine-owned: engine self-hosts cvlc on the shared bus (engine not running?)"
DBUS_SESSION_BUS_ADDRESS="unix:path=$RUNG1/dbus.sock" dbus-send --session \
  --print-reply --dest=org.mpris.MediaPlayer2.vlc /org/mpris/MediaPlayer2 \
  org.freedesktop.DBus.Properties.Get \
  string:org.mpris.MediaPlayer2.Player string:PlaybackStatus \
  >/dev/null 2>&1 && { VLC_OK=true; VLC_WHY="MPRIS PlaybackStatus responds"; }

HA_OK=false; HA_WHY="no HTTP on :8123"
c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/auth/providers)
c2=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8123/api/onboarding)
{ [ "$c" = "200" ] || [ "$c2" = "200" ]; } && { HA_OK=true; HA_WHY="http responds"; }

BT_OK=false; BT_WHY="unknown"
if command -v btvirt >/dev/null 2>&1; then
  if timeout 5 btvirt -l1 >/dev/null 2>&1; then
    BT_OK=true; BT_WHY="btvirt opened a virtual controller"
  else
    BT_WHY="btvirt cannot open /dev/vhci (kernel lacks hci_vhci or container wall)"
  fi
else
  BT_WHY="btvirt not installed (package: bluez-test-tools)"
fi

DBM_OK=false; DBM_WHY="python-dbusmock not importable"
for py in /usr/bin/python3.12 /usr/bin/python3 python3; do
  if "$py" -c 'import dbusmock' >/dev/null 2>&1; then
    DBM_OK=true; DBM_WHY="importable via $py"; break
  fi
done

{
  echo '{'
  echo "  \"runner\": \"$(uname -r)\","
  echo '  "capabilities": {'
  cap docker $DOCKER_OK "$DOCKER_WHY"; echo ','
  cap pipewire $PW_OK "$PW_WHY"; echo ','
  cap mpd $MPD_OK "$MPD_WHY"; echo ','
  cap vlc $VLC_OK "$VLC_WHY"; echo ','
  cap ha $HA_OK "$HA_WHY"; echo ','
  cap btvirt $BT_OK "$BT_WHY"; echo ','
  cap dbusmock $DBM_OK "$DBM_WHY"; echo ''
  echo '  }'
  echo '}'
} > "$OUT"
cat "$OUT"
