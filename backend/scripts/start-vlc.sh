#!/bin/bash
# Start VLC with HTTP interface for ALN Orchestrator
# This script starts VLC in HTTP mode for video control

# Check if VLC is already running
if pgrep -x "vlc" > /dev/null; then
    echo "VLC is already running"
    exit 0
fi

# Start VLC with HTTP interface
echo "Starting VLC with HTTP interface..."
vlc \
    --intf http \
    --http-password vlc \
    --http-host 0.0.0.0 \
    --http-port 8080 \
    --no-video-title-show \
    --quiet \
    --daemon \
    2>/dev/null &

# Wait for VLC to start
sleep 2

# Check if VLC started successfully
if pgrep -x "vlc" > /dev/null; then
    echo "✅ VLC started successfully on port 8080"
    echo "   HTTP interface: http://localhost:8080"
    echo "   Password: vlc"
else
    echo "❌ Failed to start VLC"
    exit 1
fi