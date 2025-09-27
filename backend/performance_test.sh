#!/bin/bash

echo "=== ALN Orchestrator Performance Testing ==="
echo ""

# Test 1: Response Time Analysis
echo "1. Response Time Test (100 requests)"
echo "-----------------------------------"
times=()
for i in {1..100}; do
  start=$(date +%s%N)
  curl -s -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"test_$i\",\"teamId\":\"TEAM_A\",\"scannerId\":\"PERF_TEST\"}" > /dev/null
  end=$(date +%s%N)
  duration=$((($end - $start) / 1000000))
  times+=($duration)
  echo -n "."
done
echo ""

# Calculate statistics
sum=0
max=0
min=999999
for t in ${times[@]}; do
  sum=$(($sum + $t))
  if [ $t -gt $max ]; then max=$t; fi
  if [ $t -lt $min ]; then min=$t; fi
done
avg=$(($sum / 100))

echo "Results:"
echo "  Average: ${avg}ms"
echo "  Min: ${min}ms"
echo "  Max: ${max}ms"
echo ""

# Test 2: Concurrent Connections
echo "2. Concurrent Connection Test (15 parallel)"
echo "-------------------------------------------"
for i in {1..15}; do
  curl -s -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"concurrent_$i\",\"teamId\":\"TEAM_B\",\"scannerId\":\"CONCURRENT_$i\"}" > /dev/null &
done
wait
echo "✅ 15 concurrent requests completed"
echo ""

# Test 3: Memory Usage
echo "3. Memory Usage Check"
echo "--------------------"
pid=$(pgrep -f "node src")
if [ ! -z "$pid" ]; then
  mem=$(ps -o rss= -p $pid | awk '{print $1/1024 " MB"}')
  echo "Current memory usage: $mem"
else
  echo "Server process not found"
fi
echo ""

# Test 4: Rapid Fire Test
echo "4. Rapid Fire Test (500 requests, no delay)"
echo "-------------------------------------------"
start=$(date +%s)
for i in {1..500}; do
  curl -s -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -d "{\"tokenId\":\"rapid_$i\",\"teamId\":\"TEAM_A\",\"scannerId\":\"RAPID_TEST\"}" > /dev/null &
  if [ $(($i % 50)) -eq 0 ]; then
    echo -n "."
    wait
  fi
done
wait
end=$(date +%s)
duration=$(($end - $start))
echo ""
echo "500 requests completed in ${duration}s"
echo "Rate: $((500 / $duration)) req/s"
echo ""

echo "=== Performance Testing Complete ==="