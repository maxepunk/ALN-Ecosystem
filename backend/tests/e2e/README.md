# E2E Testing Guide - ALN Orchestrator Backend

Comprehensive guide to E2E (End-to-End) testing for the ALN Orchestrator backend and full-stack integration scenarios.

## Table of Contents

- [Overview](#overview)
- [Test Taxonomy](#test-taxonomy)
- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Configuration](#configuration)
- [Writing Tests](#writing-tests)
- [Test Patterns](#test-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

The E2E test suite validates **full-stack integration** between:
- Backend orchestrator (Node.js server)
- GM Scanner (WebSocket client)
- Player Scanner (HTTP client)
- VLC integration (video playback)
- Session persistence
- Scoring engine

### Test Framework

- **Runner**: Playwright Test
- **Browser**: Chromium
- **Parallelization**: 2 workers (optimized for Raspberry Pi 4 8GB)
- **Duration**: ~4-5 minutes for full suite
- **Coverage**: 28 tests (6 transaction flow tests with retries)

## Test Taxonomy

### L1: Unit Tests (Scanner)
- **Location**: `ALNScanner/tests/unit/`
- **Scope**: Module-level with mocks
- **Run**: `cd ALNScanner && npm test`

### L2: Scanner E2E (No Backend)
- **Location**: `ALNScanner/tests/e2e/specs/`
- **Scope**: Scanner standalone mode testing
- **Run**: `cd ALNScanner && npm run test:e2e`

### L3: Full Stack E2E (This Suite)
- **Location**: `backend/tests/e2e/flows/`
- **Scope**: Complete integration with live orchestrator
- **Run**: `cd backend && npm run test:e2e`
- **Intent**: Validate networked mode, WebSocket communication, transaction processing, scoring

**CRITICAL**: L3 tests require orchestrator running (`npm run dev:full` or `npm run dev:no-video`)

## Quick Start

### Prerequisites

1. **Orchestrator Running**:
```bash
cd backend
npm run dev:full        # With VLC video playback
# OR
npm run dev:no-video    # Orchestrator only (faster for testing)
```

2. **Scanner Built** (for scanner integration tests):
```bash
cd ALNScanner
npm install
npm run build           # Creates dist/ directory
```

### Run Tests

```bash
cd backend

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/e2e/flows/00-smoke-test.test.js

# Run with UI mode (interactive)
npx playwright test --ui

# Run with debug mode (step-through)
npx playwright test --debug

# View HTML report
npx playwright show-report
```

### Test Modes

**Headed Mode** (see browser):
```bash
npx playwright test --headed
```

**Specific Browser**:
```bash
npx playwright test --project=chromium
```

**Watch Mode**:
```bash
npx playwright test --watch
```

## Test Structure

```
backend/tests/e2e/
├── README.md                           # This file
├── fixtures/                           # Test data (lightweight fixtures)
│   ├── tokens/
│   │   └── test-tokens.json           # Minimal token set for testing
│   └── sessions/
│       └── test-session.json          # Sample session data
├── flows/                              # Test scenarios
│   ├── 00-smoke-test.test.js          # Basic health checks
│   ├── 01-session-lifecycle.test.js   # Session CRUD operations
│   ├── 01-session-persistence.test.js # Session persistence across restarts
│   ├── 07b-gm-scanner-networked-blackmarket.test.js  # Transaction flow (L3)
│   ├── 07c-gm-scanner-scoring-parity.test.js         # Scoring validation
│   ├── 21-player-scanner-diagnostic.test.js          # Player scanner health
│   ├── 21-player-scanner-networked-scanning.test.js  # Player scanner flow
│   └── duplicate-detection.spec.js    # Duplicate token prevention
├── helpers/                            # Utilities
│   ├── test-config.js                 # Centralized configuration
│   └── testHelpers.js                 # Reusable helper functions
└── setup/                              # Test setup
    └── global-setup.js                # Pre-test initialization
```

## Configuration

### Environment Variables

Tests use `test-config.js` for centralized configuration:

```javascript
const { ADMIN_PASSWORD, ORCHESTRATOR_URL } = require('./helpers/test-config');
```

**Configuration Options**:
- `ADMIN_PASSWORD`: Admin password (default: `@LN-c0nn3ct`)
- `ORCHESTRATOR_URL`: Backend URL (default: `https://localhost:3000`)
- `DEFAULT_TIMEOUT`: Standard timeout (10s)
- `EXTENDED_TIMEOUT`: Extended timeout for slow operations (30s)
- `NETWORK_IDLE_TIMEOUT`: Wait for network idle (5s)

**Override via Environment**:
```bash
# Set custom admin password
export TEST_ADMIN_PASSWORD="my-custom-password"
npm run test:e2e

# Set custom orchestrator URL
export ORCHESTRATOR_URL="https://192.168.1.100:3000"
npm run test:e2e
```

### Playwright Configuration

See `playwright.config.js` in backend root:
- **Workers**: 2 (parallelization for Pi 4)
- **Retries**: 1 (flaky test resilience)
- **Timeout**: 30s per test
- **Reporter**: HTML + list

## Writing Tests

### Basic Test Structure

```javascript
const { test, expect } = require('@playwright/test');
const { ADMIN_PASSWORD, ORCHESTRATOR_URL } = require('../helpers/test-config');

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Navigate to orchestrator
    await page.goto(`${ORCHESTRATOR_URL}/health`);

    // Assertions
    const response = await page.textContent('body');
    expect(response).toContain('healthy');
  });
});
```

### GM Scanner Integration Test

```javascript
test('should authenticate and receive sync:full', async ({ page }) => {
  // 1. Navigate to scanner
  await page.goto(`${ORCHESTRATOR_URL}/gm-scanner/`);

  // 2. Select networked mode
  await page.click('text=Networked Mode');

  // 3. Enter orchestrator URL
  await page.fill('input[placeholder*="URL"]', ORCHESTRATOR_URL);
  await page.click('text=Connect');

  // 4. Authenticate
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('text=Login');

  // 5. Wait for WebSocket connection
  await page.waitForSelector('text=Connected', { timeout: 5000 });

  // 6. Verify sync:full received
  const state = await page.evaluate(() => window.App?.lastSyncState);
  expect(state).toBeDefined();
});
```

### Transaction Flow Test

```javascript
test('should submit transaction and receive broadcast', async ({ page }) => {
  // Setup: Authenticate and create session
  // ... (authentication steps)

  // Create session
  await page.click('text=Admin');
  await page.fill('input[name="sessionName"]', 'Test Session');
  await page.fill('input[name="teams"]', '["001", "002"]');
  await page.click('button:has-text("Create Session")');

  // Select team
  await page.goto(`${ORCHESTRATOR_URL}/gm-scanner/`);
  await page.fill('input[id="teamId"]', '001');
  await page.click('text=Enter');

  // Submit transaction
  await page.click('text=Manual Entry');
  await page.fill('input[placeholder*="Token"]', 'test_token_1');
  await page.click('text=Submit');

  // Verify transaction processed
  await page.waitForSelector('text=Success', { timeout: 5000 });

  // Verify score updated
  const score = await page.textContent('.score-display');
  expect(parseInt(score)).toBeGreaterThan(0);
});
```

## Test Patterns

### Pattern 1: WebSocket Event Verification

```javascript
// Listen for WebSocket events
await page.evaluate(() => {
  window.testEvents = [];
  window.connectionManager?.client?.socket.onAny((event, data) => {
    window.testEvents.push({ event, data, timestamp: Date.now() });
  });
});

// Trigger action
await page.click('button:has-text("Submit")');

// Verify event received
await page.waitForFunction(() => {
  return window.testEvents?.some(e => e.event === 'transaction:new');
}, { timeout: 5000 });
```

### Pattern 2: Async Wait for Backend Processing

```javascript
// CORRECT: Wait for backend processing
await page.waitForResponse(
  response => response.url().includes('/api/scan') && response.status() === 200,
  { timeout: 5000 }
);

// WRONG: Arbitrary wait (flaky)
await page.waitForTimeout(2000); // ❌ Don't do this
```

### Pattern 3: State Verification

```javascript
// Verify application state
const state = await page.evaluate(() => ({
  sessionId: window.App?.sessionId,
  teamId: window.App?.currentTeamId,
  transactions: window.DataManager?.transactions.length,
  connected: window.connectionManager?.isConnected
}));

expect(state.sessionId).toBeDefined();
expect(state.connected).toBe(true);
```

### Pattern 4: Fixture Data Loading

```javascript
const fs = require('fs');
const path = require('path');

test('should load test tokens', async ({ page }) => {
  // Load fixture
  const tokensPath = path.join(__dirname, '../fixtures/tokens/test-tokens.json');
  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));

  // Inject into page
  await page.evaluate((tokenData) => {
    window.TokenManager.database = tokenData;
  }, tokens);
});
```

## Troubleshooting

### Common Issues

#### Tests Fail with "Target page closed"

**Cause**: Orchestrator not running or crashed during test

**Fix**:
```bash
# Verify orchestrator running
curl -k https://localhost:3000/health

# Start orchestrator
npm run dev:no-video
```

#### Tests Timeout Waiting for Elements

**Cause**: Scanner not built or dist/ missing

**Fix**:
```bash
cd ../ALNScanner
npm run build
```

#### WebSocket Connection Failures

**Cause**: Invalid JWT token or authentication failure

**Debug**:
```javascript
// Check token in test
await page.evaluate(() => {
  const token = localStorage.getItem('aln_auth_token');
  console.log('Token:', token);
  if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Expires:', new Date(payload.exp * 1000));
  }
});
```

**Fix**: Ensure `ADMIN_PASSWORD` in test-config.js matches backend `.env`

#### Flaky Tests (Pass/Fail Intermittently)

**Cause**: Race conditions, arbitrary waits

**Fix**: Use Playwright's built-in waiting mechanisms:
```javascript
// ✅ GOOD: Wait for specific condition
await page.waitForSelector('text=Connected', { state: 'visible' });
await page.waitForResponse(r => r.url().includes('/api/scan'));
await page.waitForFunction(() => window.App?.initialized);

// ❌ BAD: Arbitrary wait
await page.waitForTimeout(2000);
```

### Debug Commands

**View Browser Console in Test**:
```javascript
page.on('console', msg => console.log('Browser:', msg.text()));
```

**Take Screenshot on Failure**:
```javascript
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== 'passed') {
    await page.screenshot({ path: `test-results/${testInfo.title}.png` });
  }
});
```

**Trace Recording**:
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Performance Optimization

**Raspberry Pi 4 Specific**:
- Use 2 workers (not more, RAM limited)
- Run `dev:no-video` mode (VLC adds overhead)
- Close browser tabs/apps to free memory
- Consider `--shard` for splitting tests across multiple runs

```bash
# Split tests across 2 runs
npx playwright test --shard=1/2
npx playwright test --shard=2/2
```

## Test Coverage

### Current Coverage (L3)

**Transaction Flow Tests** (`07b-gm-scanner-networked-blackmarket.test.js`):
- ✅ Scanner initialization in networked mode
- ✅ WebSocket authentication
- ✅ Session creation via WebSocket
- ✅ UI navigation
- ✅ Transaction submission (scanner → backend via WebSocket)
- ✅ Type multiplier scoring (Personal 1x, Business 3x, Technical 5x)
- ✅ Group completion bonuses
- ✅ Duplicate detection (same team & cross-team)

**Scoring Parity Tests** (`07c-gm-scanner-scoring-parity.test.js`):
- ✅ Backend vs frontend score calculation consistency
- ✅ Group bonus calculation accuracy

**Session Tests** (`01-*.test.js`):
- ✅ Session CRUD operations
- ✅ Session persistence across restarts
- ✅ Team management

**Player Scanner Tests** (`21-*.test.js`):
- ✅ Health checks
- ✅ HTTP scan submission
- ✅ Offline queue behavior

### Coverage Gaps

Areas requiring additional E2E tests:
- [ ] Video playback integration (VLC)
- [ ] Multi-GM scanner coordination
- [ ] Session timeout/expiration
- [ ] Offline queue synchronization
- [ ] Device connection/disconnection tracking

## Related Documentation

### Scanner Documentation
- [ALNScanner/CLAUDE.md](../../ALNScanner/CLAUDE.md) - Scanner architecture
- [ALNScanner/README.md](../../ALNScanner/README.md) - Scanner user guide
- [ALNScanner Testing](../../ALNScanner/CLAUDE.md#testing-architecture) - L1/L2 tests

### Backend Documentation
- [../CLAUDE.md](../CLAUDE.md) - Backend architecture
- [contracts/asyncapi.yaml](../contracts/asyncapi.yaml) - WebSocket event contracts
- [contracts/openapi.yaml](../contracts/openapi.yaml) - HTTP endpoint contracts

### Testing Documentation
- [playwright.config.js](../../playwright.config.js) - Playwright configuration
- [test-config.js](./helpers/test-config.js) - Test configuration constants

---

**Last Updated**: November 12, 2025
**Test Suite**: L3 Full Stack E2E
**Framework**: Playwright Test
**Coverage**: 28 tests, ~4-5 min runtime
