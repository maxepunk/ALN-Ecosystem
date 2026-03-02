#!/bin/bash
# PM2-managed VLC startup wrapper.
# Kills any stale VLC processes before starting, ensuring the PM2-managed
# instance is the sole VLC on D-Bus (prevents stale process shadowing).
#
# Usage: Called by PM2 via ecosystem.config.js — not intended for direct use.
# Args are passed through from PM2's computed VLC_ARGS.

# Kill any existing VLC processes — PM2 is the sole authority for VLC
pkill vlc 2>/dev/null || true

# Brief wait for D-Bus name release
sleep 1

# Replace this shell with cvlc so PM2 tracks the VLC PID directly
exec /usr/bin/cvlc "$@"
