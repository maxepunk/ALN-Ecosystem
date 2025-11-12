#!/bin/bash
#
# ALN-Ecosystem (Parent Repo) Merge Readiness Verification
# Validates all critical requirements before merging PR #5
#
# Usage: ./verify-merge-ready.sh
#

set -e

echo "======================================"
echo " ALN-Ecosystem Merge Readiness Check"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail_count=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
  else
    echo -e "${RED}✗${NC} $1"
    ((fail_count++))
  fi
}

# 1. Submodules initialized
echo "[1/7] Checking Git submodules..."
git submodule status --recursive | grep -q "ALNScanner" && \
git submodule status --recursive | grep -q "ALN-TokenData"
check "Submodules initialized"
echo ""

# 2. Scanner dist exists
echo "[2/7] Checking scanner build..."
if [ -d "ALNScanner/dist" ]; then
  check "Scanner dist/ directory exists"
  if [ -f "ALNScanner/dist/index.html" ]; then
    check "Scanner dist/index.html present"
  else
    echo -e "${RED}✗${NC} Scanner dist/index.html missing"
    echo "Run: cd ALNScanner && npm run build"
    ((fail_count++))
  fi
else
  echo -e "${RED}✗${NC} Scanner dist/ missing"
  echo "Run: cd ALNScanner && npm run build"
  ((fail_count++))
fi
echo ""

# 3. Backend dependencies
echo "[3/7] Checking backend dependencies..."
cd backend
npm list > /dev/null 2>&1
check "Backend dependencies installed"
cd ..
echo ""

# 4. Test config present
echo "[4/7] Checking E2E test configuration..."
if [ -f "backend/tests/e2e/helpers/test-config.js" ]; then
  check "test-config.js present"
else
  echo -e "${RED}✗${NC} test-config.js missing"
  ((fail_count++))
fi

if grep -q "ADMIN_PASSWORD" backend/tests/e2e/helpers/test-config.js 2>/dev/null; then
  check "ADMIN_PASSWORD exported from test-config.js"
else
  echo -e "${RED}✗${NC} ADMIN_PASSWORD not found in test-config.js"
  ((fail_count++))
fi
echo ""

# 5. No hardcoded passwords
echo "[5/7] Checking for hardcoded passwords..."
HARDCODED=$(grep -r "'@LN-c0nn3ct'" backend/tests/e2e/flows/ 2>/dev/null | wc -l)
if [ "$HARDCODED" -eq 0 ]; then
  check "No hardcoded passwords in E2E tests"
else
  echo -e "${RED}✗${NC} Found $HARDCODED hardcoded password(s)"
  echo "All passwords should use ADMIN_PASSWORD constant"
  ((fail_count++))
fi
echo ""

# 6. E2E tests passing
echo "[6/7] Running E2E smoke test..."
cd backend
npm run test:e2e -- tests/e2e/flows/00-smoke-test.test.js --quiet > /tmp/e2e-output.log 2>&1
if [ $? -eq 0 ]; then
  PASSED=$(grep -o "[0-9]* passed" /tmp/e2e-output.log | head -1 | awk '{print $1}')
  check "E2E smoke tests passing ($PASSED tests)"
else
  echo -e "${RED}✗${NC} E2E tests failing"
  tail -20 /tmp/e2e-output.log
  ((fail_count++))
fi
cd ..
echo ""

# 7. Regression test coverage
echo "[7/7] Verifying L3 regression coverage..."
cd backend
npm run test:e2e -- tests/e2e/flows/07b-gm-scanner-networked-blackmarket.test.js --quiet > /tmp/regression-output.log 2>&1
if [ $? -eq 0 ]; then
  PASSED=$(grep -o "[0-9]* passed" /tmp/regression-output.log | head -1 | awk '{print $1}')
  check "L3 transaction flow tests passing ($PASSED tests)"
else
  echo -e "${RED}✗${NC} Regression tests failing"
  tail -20 /tmp/regression-output.log
  ((fail_count++))
fi
cd ..
echo ""

# Summary
echo "======================================"
if [ $fail_count -eq 0 ]; then
  echo -e "${GREEN}✅ MERGE READY${NC}"
  echo "All verification checks passed!"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff main"
  echo "  2. Commit remaining work"
  echo "  3. Push to GitHub"
  echo "  4. Merge PR #5 (after ALNScanner PR #4 merged)"
  exit 0
else
  echo -e "${RED}❌ NOT READY${NC}"
  echo "$fail_count check(s) failed"
  echo ""
  echo "Fix the issues above before merging."
  exit 1
fi
