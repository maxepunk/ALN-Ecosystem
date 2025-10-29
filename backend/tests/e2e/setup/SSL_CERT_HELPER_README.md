# SSL Certificate Helper - Usage Guide

## Overview

The `ssl-cert-helper.js` module provides utilities for handling HTTPS connections with self-signed certificates in E2E tests. The ALN Orchestrator runs with HTTPS to support the Web NFC API in the GM Scanner, which requires a secure context.

**IMPORTANT: These are TEST-ONLY utilities that disable SSL certificate validation. Never use in production.**

## Quick Start

### 1. Playwright Tests (Recommended Approach)

The easiest way is to use the global config in `playwright.config.js`:

```javascript
// playwright.config.js (already configured)
module.exports = defineConfig({
  use: {
    ignoreHTTPSErrors: true,  // Handles self-signed certs globally
  }
});
```

No additional code needed in your test files! Playwright automatically accepts self-signed certificates.

### 2. Axios HTTP Requests

For API calls using axios:

```javascript
const axios = require('axios');
const { configureAxiosForHTTPS } = require('./setup/ssl-cert-helper');

// Create and configure axios instance
const client = configureAxiosForHTTPS(axios.create({
  baseURL: 'https://localhost:3000'
}));

// Make requests - self-signed certs are accepted
const response = await client.get('/health');
```

### 3. Node.js Built-in HTTPS Module

For direct https module usage:

```javascript
const https = require('https');
const { createHTTPSAgent } = require('./setup/ssl-cert-helper');

const agent = createHTTPSAgent();

https.get('https://localhost:3000/health', { agent }, (res) => {
  console.log('Status:', res.statusCode);
});
```

## Complete Integration Examples

### Example 1: Playwright E2E Test with HTTPS

```javascript
// tests/e2e/flows/admin-authentication.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Admin Authentication Flow', () => {
  test('should login to admin panel with valid credentials', async ({ page }) => {
    // HTTPS handled automatically by playwright.config.js
    await page.goto('https://localhost:3000/admin/');

    // Self-signed cert is automatically accepted
    await page.fill('#password', 'test-admin-password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/admin\//);
  });
});
```

### Example 2: Axios in Test Setup

```javascript
// tests/e2e/setup/test-helpers.js
const axios = require('axios');
const { configureAxiosForHTTPS } = require('./ssl-cert-helper');

/**
 * Create HTTP client for E2E tests
 */
function createTestClient(baseURL = 'https://localhost:3000') {
  return configureAxiosForHTTPS(axios.create({
    baseURL,
    timeout: 5000
  }));
}

/**
 * Wait for orchestrator to be ready
 */
async function waitForOrchestrator(timeout = 30000) {
  const client = createTestClient();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await client.get('/health');
      if (response.data.status === 'online') {
        return true;
      }
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  throw new Error('Orchestrator did not become ready');
}

module.exports = { createTestClient, waitForOrchestrator };
```

### Example 3: WebSocket Client with HTTPS

```javascript
// tests/e2e/setup/test-websocket.js
const io = require('socket.io-client');
const axios = require('axios');
const { configureAxiosForHTTPS } = require('./ssl-cert-helper');

/**
 * Authenticate and connect WebSocket client
 */
async function connectAuthenticatedClient(deviceId, deviceType = 'gm') {
  // Step 1: Get JWT token via HTTPS
  const httpClient = configureAxiosForHTTPS(axios.create({
    baseURL: 'https://localhost:3000'
  }));

  const authResponse = await httpClient.post('/api/admin/auth', {
    password: 'test-admin-password'
  });

  const token = authResponse.data.token;

  // Step 2: Connect WebSocket with token
  const socket = io('https://localhost:3000', {
    auth: {
      token,
      deviceId,
      deviceType,
      version: '1.0.0'
    },
    // Socket.io automatically accepts self-signed certs when using https URL
    rejectUnauthorized: false
  });

  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
  });
}

module.exports = { connectAuthenticatedClient };
```

### Example 4: Global TLS Configuration (Use Sparingly)

```javascript
// tests/e2e/legacy-integration.test.js
const { configureNodeHTTPS, restoreNodeHTTPS } = require('./setup/ssl-cert-helper');

describe('Legacy API Integration', () => {
  beforeAll(() => {
    // Disable TLS validation globally for all Node.js HTTPS requests
    // WARNING: Affects entire process
    configureNodeHTTPS();
  });

  afterAll(() => {
    // CRITICAL: Always restore original settings
    restoreNodeHTTPS();
  });

  test('legacy endpoint works', async () => {
    // All HTTPS requests accept self-signed certs
    const https = require('https');
    // ... test code ...
  });
});
```

## Certificate Management

### Verify Certificates Exist

```javascript
const { verifyCertsExist, getCertPaths, getCertificateInfo } = require('./setup/ssl-cert-helper');

// Quick check
if (!verifyCertsExist()) {
  throw new Error('SSL certificates not found - run setup script');
}

// Detailed info
const certInfo = getCertificateInfo();
console.log('Certificate valid:', certInfo.valid);
console.log('Key path:', certInfo.keyPath);
console.log('Cert size:', certInfo.certSize, 'bytes');

// Get paths for manual operations
const { keyPath, certPath } = getCertPaths();
```

## Integration with Existing Test Infrastructure

### With test-server.js

The `test-server.js` already handles HTTPS properly:

```javascript
// tests/e2e/setup/test-server.js
const { startOrchestrator } = require('./test-server');

// Starts orchestrator with HTTPS enabled
const server = await startOrchestrator({
  https: true,  // Uses SSL certs from backend/ssl/
  port: 3000
});

// Server URL is https://localhost:3000
console.log('Server running at:', server.url);
```

The `waitForHealthy()` function inside `test-server.js` already uses the SSL helper pattern:

```javascript
// From test-server.js line 354-359
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false  // Same as createHTTPSAgent()
  }),
  timeout: 2000
});
```

### With websocket-client.js

The WebSocket client can use HTTPS URLs directly:

```javascript
const { createWebSocketClient } = require('./setup/websocket-client');

// Connect with HTTPS URL and authentication
const client = await createWebSocketClient({
  url: 'https://localhost:3000',
  deviceId: 'GM_Station_1',
  deviceType: 'gm',
  password: 'test-admin-password'
});

// Socket.io handles self-signed certs when rejectUnauthorized: false
```

## Security Warnings

### What These Functions Do

All functions in this module **disable SSL certificate validation** by:

1. **Playwright**: `ignoreHTTPSErrors: true` - Browser accepts invalid certs
2. **Axios/HTTPS**: `rejectUnauthorized: false` - Node.js accepts invalid certs
3. **Global**: `NODE_TLS_REJECT_UNAUTHORIZED=0` - All Node.js HTTPS disabled

### Why This Is Dangerous in Production

- **Man-in-the-Middle Attacks**: Attacker can intercept traffic without detection
- **No Certificate Validation**: Any certificate is accepted, even expired or wrong domain
- **Data Exposure**: Encrypted traffic can be decrypted by attackers

### Safe Usage Guidelines

✅ **DO:**
- Use only in test environments
- Use per-instance configuration (axios, https.Agent)
- Document security implications in code comments
- Verify you're testing against localhost/known test servers

❌ **DON'T:**
- Use in production code
- Use `configureNodeHTTPS()` unless absolutely necessary (affects entire process)
- Forget to call `restoreNodeHTTPS()` after tests
- Copy-paste into production configuration

## Troubleshooting

### Certificate Not Found Errors

```bash
# Verify certificates exist
ls -la backend/ssl/
# Should show: key.pem and cert.pem

# If missing, generate self-signed certs
cd backend
openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

### Playwright Still Shows SSL Error

Check `playwright.config.js` has `ignoreHTTPSErrors: true`:

```javascript
// playwright.config.js
module.exports = defineConfig({
  use: {
    ignoreHTTPSErrors: true,  // Must be set
    baseURL: 'https://localhost:3000'
  }
});
```

### Axios Request Fails with CERT_UNTRUSTED

Ensure you're using the configured instance:

```javascript
// ❌ Wrong - default axios doesn't have HTTPS agent
await axios.get('https://localhost:3000/health');

// ✅ Correct - configured instance
const client = configureAxiosForHTTPS(axios.create());
await client.get('https://localhost:3000/health');
```

### WebSocket Connection Refused

Check both HTTP authentication AND WebSocket configuration:

```javascript
// Socket.io client needs rejectUnauthorized: false
const socket = io('https://localhost:3000', {
  auth: { token, deviceId, deviceType },
  rejectUnauthorized: false  // Important!
});
```

## File Locations

- **Helper Module**: `/backend/tests/e2e/setup/ssl-cert-helper.js`
- **Tests**: `/backend/tests/e2e/setup/ssl-cert-helper.test.js`
- **SSL Certificates**: `/backend/ssl/key.pem` and `/backend/ssl/cert.pem`
- **Config**: `/backend/src/config/index.js` (see `ssl` section)
- **Playwright Config**: `/backend/playwright.config.js` (line 68)

## API Reference

See JSDoc comments in `ssl-cert-helper.js` for complete API documentation:

- `getCertPaths()` - Get absolute paths to SSL files
- `verifyCertsExist()` - Check if certificates exist
- `getCertificateInfo()` - Get detailed cert metadata
- `createHTTPSAgent()` - Create Node.js HTTPS agent
- `configureAxiosForHTTPS(instance)` - Configure axios instance
- `configurePlaywrightHTTPS(context)` - Configure Playwright context (informational)
- `configurePageHTTPS(page)` - Configure Playwright page (informational)
- `configureNodeHTTPS()` - Globally disable TLS validation (use with caution)
- `restoreNodeHTTPS()` - Restore TLS validation after global config
