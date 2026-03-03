#!/bin/bash
# Health check script for ALN Orchestrator system
# Verifies all components are running and properly connected

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 ALN System Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall health
HEALTH_STATUS=0

# Function to check a service
check_service() {
    local name=$1
    local url=$2
    local auth=$3

    if [ -n "$auth" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -u "$auth" "$url" 2>/dev/null)
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    fi

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅${NC} $name: Running"
        return 0
    else
        echo -e "${RED}❌${NC} $name: Not responding (HTTP $response)"
        HEALTH_STATUS=1
        return 1
    fi
}

# Check Node.js process
echo "1. Process Status"
echo "─────────────────"
if pgrep -f "node.*server.js" > /dev/null; then
    echo -e "${GREEN}✅${NC} Orchestrator process: Running"
else
    echo -e "${RED}❌${NC} Orchestrator process: Not found"
    HEALTH_STATUS=1
fi

if pgrep -x cvlc > /dev/null; then
    echo -e "${GREEN}✅${NC} VLC process: Running"
else
    echo -e "${YELLOW}⚠️${NC}  VLC process: Not found (video playback unavailable)"
fi
echo ""

# Check HTTP endpoints
echo "2. Service Endpoints"
echo "───────────────────"
check_service "Orchestrator API" "http://localhost:3000/health" ""
echo ""

# Check integration status
echo "3. Integration Status"
echo "────────────────────"
HEALTH_JSON=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ -n "$HEALTH_JSON" ]; then
    # Check VLC D-Bus availability
    if dbus-send --session --dest=org.mpris.MediaPlayer2.vlc --print-reply /org/mpris/MediaPlayer2 org.freedesktop.DBus.Peer.Ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} VLC Integration: Connected (D-Bus MPRIS)"
    else
        echo -e "${YELLOW}⚠️${NC}  VLC Integration: Not connected (degraded mode)"
    fi

    # Check video display readiness
    if echo "$HEALTH_JSON" | grep -q '"videoDisplay":true'; then
        echo -e "${GREEN}✅${NC} Video Display: Ready"
    else
        echo -e "${YELLOW}⚠️${NC}  Video Display: Not ready"
    fi
else
    echo -e "${RED}❌${NC} Cannot check integration (orchestrator not responding)"
    HEALTH_STATUS=1
fi
echo ""

# Check ports
echo "4. Network Ports"
echo "───────────────"
if lsof -i :3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Port 3000: In use (Orchestrator)"
else
    echo -e "${RED}❌${NC} Port 3000: Not in use"
    HEALTH_STATUS=1
fi

if lsof -i :8888 > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Port 8888: In use (Discovery)"
else
    echo -e "ℹ️  Port 8888: Not in use (discovery disabled)"
fi
echo ""

# Check file structure
echo "5. File System"
echo "─────────────"
if [ -d "public/videos" ] && [ "$(ls -A public/videos 2>/dev/null)" ]; then
    VIDEO_COUNT=$(ls -1 public/videos/*.mp4 2>/dev/null | wc -l)
    echo -e "${GREEN}✅${NC} Video directory: $VIDEO_COUNT videos found"
else
    echo -e "${YELLOW}⚠️${NC}  Video directory: Empty or missing"
fi

if [ -f ".env" ]; then
    echo -e "${GREEN}✅${NC} Configuration: .env file exists"
else
    echo -e "${RED}❌${NC} Configuration: .env file missing"
    HEALTH_STATUS=1
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $HEALTH_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ System Status: HEALTHY${NC}"
    echo ""
    echo "Access points:"
    echo "  • Orchestrator: http://localhost:3000"
    echo "  • Admin Panel: http://localhost:3000/admin/"
    echo "  • Player Scanner: http://localhost:3000/player-scanner/"
    echo "  • GM Scanner: http://localhost:3000/gm-scanner/"
else
    echo -e "${RED}❌ System Status: ISSUES DETECTED${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Start orchestrator: npm start"
    echo "  • Start with PM2: pm2 start ecosystem.config.js"
    echo "  • Check logs: pm2 logs"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $HEALTH_STATUS