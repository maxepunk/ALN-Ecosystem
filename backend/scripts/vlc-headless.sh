#!/bin/bash
# Start VLC in headless mode (no GUI) for CI/testing environments
# This is for environments without display capability

# Check if VLC is already running with HTTP interface
if pgrep -f "vlc.*http.*8080" > /dev/null; then
    echo "⚠️  VLC is already running with HTTP interface"
    echo "   To restart: pkill -f 'vlc.*http' && $0"
    exit 0
fi

echo "🖥️  Starting VLC in headless mode (no video output)..."
echo "   Mode: HTTP interface only"
echo "   Use case: CI/testing environments"

# Start VLC without GUI (dummy interface)
vlc \
    --intf dummy \
    --extraintf http \
    --http-password vlc \
    --http-host 0.0.0.0 \
    --http-port 8080 \
    --no-video \
    --quiet \
    2>/dev/null &

VLC_PID=$!

# Wait briefly for VLC to start
sleep 2

# Verify VLC started successfully
if kill -0 $VLC_PID 2>/dev/null; then
    echo "✅ VLC started successfully in headless mode (PID: $VLC_PID)"
    echo ""
    echo "🌐 HTTP control: http://localhost:8080"
    echo "🔑 Password: vlc"
    echo "⚠️  Note: No video output (headless mode)"
    echo ""
    echo "To stop VLC: pkill -f 'vlc.*http'"
else
    echo "❌ Failed to start VLC"
    echo "   Check if port 8080 is already in use: lsof -i :8080"
    exit 1
fi