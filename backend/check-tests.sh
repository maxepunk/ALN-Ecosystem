#!/bin/bash

echo "=== ALN Backend Test Status Report ==="
echo ""

# Contract tests
echo "CONTRACT TESTS:"
for test in tests/contract/*.test.js; do
  name=$(basename "$test" .test.js)
  result=$(npx jest "$test" --testTimeout=3000 --forceExit --silent 2>&1 | grep "Tests:" | head -1)
  echo "  $name: $result"
done

echo ""
echo "INTEGRATION TESTS:"
for test in tests/integration/*.test.js; do
  name=$(basename "$test" .test.js)
  result=$(npx jest "$test" --testTimeout=3000 --forceExit --silent 2>&1 | grep "Tests:" | head -1)
  echo "  $name: $result"
done

echo ""
echo "=== Summary Complete ==="