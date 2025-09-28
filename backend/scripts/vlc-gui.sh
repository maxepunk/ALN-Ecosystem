#!/bin/bash
# Start VLC with GUI and HTTP interface for ALN Orchestrator
# This configuration matches the PM2 ecosystem.config.js exactly

# Load environment variables if .env exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
fi

# Check if VLC is already running with HTTP interface
if pgrep -f "vlc.*http.*8080" > /dev/null; then
    echo "⚠️  VLC is already running with HTTP interface"
    echo "   To restart: pkill -f 'vlc.*http' && $0"
    exit 0
fi

# Ensure DISPLAY is set for GUI
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
    echo "ℹ️  Setting DISPLAY=:0 for GUI output"
fi

# Prepare VLC command arguments for clean kiosk mode
VLC_ARGS="--intf http --http-password vlc --http-host 0.0.0.0 --http-port 8080 --fullscreen --video-on-top --no-video-title-show --no-video-deco --no-osd"

echo "🎬 Starting VLC with clean interface..."
echo "   Video: Fullscreen kiosk mode (no GUI controls)"
echo "   Control: http://localhost:8080 (password: vlc)"
echo "   Idle Loop: Managed by orchestrator"

# Start cvlc for clean interface
cvlc $VLC_ARGS 2>/dev/null &

VLC_PID=$!

# Wait briefly for VLC to start
sleep 2

# Verify VLC started successfully
if kill -0 $VLC_PID 2>/dev/null; then
    echo "✅ VLC started successfully (PID: $VLC_PID)"
    echo ""
    echo "📺 Video output: Display/HDMI (fullscreen)"
    echo "🌐 HTTP control: http://localhost:8080"
    echo "🔑 Password: vlc"
    echo ""
    echo "To stop VLC: pkill -f 'vlc.*http'"
else
    echo "❌ Failed to start VLC"
    echo "   Check if port 8080 is already in use: lsof -i :8080"
    exit 1
fi