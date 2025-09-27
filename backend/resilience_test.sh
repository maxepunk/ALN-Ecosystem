#!/bin/bash

echo "=== ALN Orchestrator Resilience Testing ==="
echo ""

# Test 1: Crash Recovery
echo "1. Crash Recovery Test"
echo "----------------------"

# Create some state
echo "Creating initial state..."
curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"hos001","teamId":"TEAM_A","scannerId":"CRASH_TEST"}' > /dev/null
echo "✅ Initial scan recorded"

# Get server PID
pid=$(pgrep -f "node src")
echo "Server PID: $pid"

# Kill server abruptly
echo "Killing server with SIGKILL..."
kill -9 $pid 2>/dev/null
sleep 2

# Restart server
echo "Restarting server..."
cd /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend
node src/server.js > /tmp/restart_test.log 2>&1 &
new_pid=$!
sleep 5

# Check if state persisted
echo "Checking state recovery..."
state=$(curl -s http://localhost:3000/api/state | jq '.gameState')
if [ ! -z "$state" ] && [ "$state" != "null" ]; then
  echo "✅ State recovered successfully"
else
  echo "❌ State recovery failed"
fi

# Test 2: Invalid Input Handling
echo ""
echo "2. Invalid Input Testing"
echo "------------------------"

# Missing required field
response=$(curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"teamId":"TEAM_A"}')
if echo "$response" | grep -q "VALIDATION_ERROR"; then
  echo "✅ Missing field validation works"
else
  echo "❌ Missing field validation failed"
fi

# Invalid JSON
response=$(curl -s -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{invalid json}' 2>&1)
if echo "$response" | grep -q "error"; then
  echo "✅ Invalid JSON handled"
else
  echo "❌ Invalid JSON not handled"
fi

# Test 3: Network Disruption Simulation
echo ""
echo "3. Network Resilience Test"
echo "--------------------------"

# Create WebSocket test with reconnection
cat > /tmp/ws_reconnect_test.js << 'EOF'
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

let disconnectCount = 0;

socket.on('connect', () => {
  console.log('Connected');
  if (disconnectCount > 0) {
    console.log('✅ Reconnection successful after', disconnectCount, 'attempts');
    process.exit(0);
  }
});

socket.on('disconnect', () => {
  disconnectCount++;
  console.log('Disconnected, attempt', disconnectCount);
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error.message);
});

// Force disconnect after 2 seconds
setTimeout(() => {
  console.log('Forcing disconnect...');
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 1000);
}, 2000);

setTimeout(() => {
  console.log('❌ Reconnection test timeout');
  process.exit(1);
}, 10000);
EOF

cd /home/spide/projects/AboutLastNight/ALN-Ecosystem/backend
node /tmp/ws_reconnect_test.js

# Test 4: Queue Overflow
echo ""
echo "4. Queue Overflow Test"
echo "---------------------"

# Send 1000 rapid requests to test queue limits
echo "Sending 1000 rapid requests..."
success=0
for i in {1..1000}; do
  response=$(curl -s -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"overflow_$i\",\"teamId\":\"TEAM_A\",\"scannerId\":\"OVERFLOW_TEST\"}")
  if echo "$response" | grep -q "accepted"; then
    ((success++))
  fi
done
echo "Processed $success/1000 requests successfully"

# Check memory after stress
pid=$(pgrep -f "node src")
if [ ! -z "$pid" ]; then
  mem=$(ps -o rss= -p $pid | awk '{print $1/1024}')
  echo "Memory after stress: ${mem} MB"
  if (( $(echo "$mem < 100" | bc -l) )); then
    echo "✅ Memory usage acceptable (<100MB)"
  else
    echo "⚠️  Memory usage high (${mem}MB)"
  fi
fi

echo ""
echo "=== Resilience Testing Complete ==="