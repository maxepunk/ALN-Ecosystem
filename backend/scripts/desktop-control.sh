#!/bin/bash
#
# Desktop Control Script
# Stops/starts LXDE desktop components to free resources during game.
# Keeps Xorg + openbox running (VLC and Chromium need them).
#
# Usage:
#   ./scripts/desktop-control.sh stop    # Kill panel + desktop icons (~290MB freed)
#   ./scripts/desktop-control.sh start   # Restore desktop components

case "$1" in
  stop)
    # Only act if LXDE desktop is actually running
    if pgrep -x lxpanel > /dev/null 2>&1 || pgrep -f "pcmanfm --desktop" > /dev/null 2>&1; then
      echo "Stopping desktop components to free resources..."
      pkill -x lxpanel 2>/dev/null || true
      pkill -f "pcmanfm --desktop" 2>/dev/null || true
      echo "Desktop components stopped (Xorg + openbox still running)"
    else
      echo "Desktop components not running, nothing to stop"
    fi
    ;;

  start)
    # Only restart if lxsession is running (desktop session exists)
    if pgrep -x lxsession > /dev/null 2>&1; then
      if ! pgrep -x lxpanel > /dev/null 2>&1; then
        echo "Restoring desktop components..."
        DISPLAY=:0 lxpanel --profile LXDE-pi &
        DISPLAY=:0 pcmanfm --desktop --profile LXDE-pi &
        echo "Desktop components restored"
      else
        echo "Desktop components already running"
      fi
    else
      echo "No LXDE session found, skipping desktop restore"
    fi
    ;;

  *)
    echo "Usage: $0 {stop|start}"
    exit 1
    ;;
esac
