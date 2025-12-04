/**
 * E2E Test Server Helper - Usage Examples
 *
 * This file demonstrates practical usage patterns for the test-server.js helper
 * in end-to-end tests. Copy and adapt these examples for your own tests.
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const axios = require('axios');
const https = require('https');
const io = require('socket.io-client');
const {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  getOrchestratorUrl,
  clearSessionData
} = require('./test-server');

// ============================================
// EXAMPLE 1: Basic HTTP Endpoint Testing
// ============================================
describe('Example 1: Basic HTTP Endpoint Testing', () => {
  // Create axios instance that accepts self-signed certs
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  beforeAll(async () => {
    // Start orchestrator with HTTP (simpler for basic tests)
    await startOrchestrator({ https: false, port: 3001 });
  });

  afterAll(async () => {
    await stopOrchestrator();
  });

  it('should test health endpoint', async () => {
    const url = getOrchestratorUrl();
    const response = await axiosInstance.get(`${url}/health`);

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('online');
  });

  it('should test player scanner scan endpoint', async () => {
    const url = getOrchestratorUrl();

    const scanData = {
      tokenId: 'test-token-001',
      deviceId: 'player-scanner-1',
      timestamp: new Date().toISOString()
    };

    // Note: This will fail without a session, but demonstrates endpoint testing
    const response = await axiosInstance.post(`${url}/api/scan`, scanData);
    // In real test, you'd create a session first
  });
});

// ============================================
// EXAMPLE 2: WebSocket Connection Testing
// ============================================
describe('Example 2: WebSocket Connection Testing', () => {
  let socket;

  beforeAll(async () => {
    await startOrchestrator({ https: false, port: 3002 });
  });

  afterAll(async () => {
    if (socket) {
      socket.disconnect();
    }
    await stopOrchestrator();
  });

  it('should connect to WebSocket server', async () => {
    const url = getOrchestratorUrl();

    // First get JWT token
    const authResponse = await axios.post(`${url}/api/admin/auth`, {
      password: 'test-admin-password'
    });

    const { token } = authResponse.data;

    // Connect with WebSocket using handshake auth
    socket = io(url, {
      auth: {
        token,
        deviceId: 'test-gm-station',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket']
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    expect(socket.connected).toBe(true);

    // Wait for auto-sync:full after connection
    const syncData = await new Promise((resolve) => {
      socket.on('sync:full', (data) => {
        resolve(data);
      });
    });

    expect(syncData).toBeDefined();
    expect(syncData.event).toBe('sync:full');
  });
});

// ============================================
// EXAMPLE 3: Session Persistence Testing
// ============================================
describe('Example 3: Session Persistence Testing', () => {
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  beforeAll(async () => {
    await startOrchestrator({ https: false, port: 3003 });
  });

  afterAll(async () => {
    await stopOrchestrator();
  });

  it('should preserve session across restart', async () => {
    const url = getOrchestratorUrl();

    // Get auth token
    const authResponse = await axiosInstance.post(`${url}/api/admin/auth`, {
      password: 'test-admin-password'
    });
    const { token } = authResponse.data;

    // Create WebSocket connection to send session command
    const socket = io(url, {
      auth: {
        token,
        deviceId: 'test-admin',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Create session via WebSocket command
    const sessionCreated = new Promise((resolve) => {
      socket.on('session:update', (data) => {
        if (data.data.status === 'active') {
          resolve(data.data);
        }
      });
    });

    socket.emit('gm:command', {
      command: 'create_session',
      sessionName: 'Test Persistence Session',
      teams: ['Team Alpha', 'Detectives', 'Blue Squad']
    });

    const session = await sessionCreated;
    const sessionId = session.id;

    expect(session.name).toBe('Test Persistence Session');

    socket.disconnect();

    // Restart orchestrator WITH session preservation
    await restartOrchestrator({ preserveSession: true });

    // Reconnect and verify session restored
    const newUrl = getOrchestratorUrl();
    const socket2 = io(newUrl, {
      auth: {
        token,
        deviceId: 'test-admin-2',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket']
    });

    await new Promise((resolve, reject) => {
      socket2.on('connect', resolve);
      socket2.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Receive sync:full with restored session
    const restoredState = await new Promise((resolve) => {
      socket2.on('sync:full', (data) => {
        resolve(data.data);
      });
    });

    expect(restoredState.session).toBeDefined();
    expect(restoredState.session.id).toBe(sessionId);
    expect(restoredState.session.name).toBe('Test Persistence Session');

    socket2.disconnect();
  }, 120000); // Longer timeout for restart
});

// ============================================
// EXAMPLE 4: Clean State Between Tests
// ============================================
describe('Example 4: Clean State Between Tests', () => {
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  beforeAll(async () => {
    await startOrchestrator({ https: false, port: 3004 });
  });

  afterAll(async () => {
    await stopOrchestrator();
  });

  beforeEach(async () => {
    // Clear session data before each test for isolation
    await clearSessionData();
  });

  it('test 1 - should start with clean state', async () => {
    const url = getOrchestratorUrl();

    // Get auth token and connect
    const authResponse = await axiosInstance.post(`${url}/api/admin/auth`, {
      password: 'test-admin-password'
    });
    const { token } = authResponse.data;

    const socket = io(url, {
      auth: {
        token,
        deviceId: 'test-1',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket']
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const state = await new Promise((resolve) => {
      socket.on('sync:full', (data) => resolve(data.data));
    });

    // Should have no session initially
    expect(state.session).toBeNull();

    socket.disconnect();
  });

  it('test 2 - should also start with clean state', async () => {
    // Same as test 1 - demonstrates state isolation
    const url = getOrchestratorUrl();

    const authResponse = await axiosInstance.post(`${url}/api/admin/auth`, {
      password: 'test-admin-password'
    });
    const { token } = authResponse.data;

    const socket = io(url, {
      auth: {
        token,
        deviceId: 'test-2',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket']
    });

    await new Promise((resolve) => socket.on('connect', resolve));

    const state = await new Promise((resolve) => {
      socket.on('sync:full', (data) => resolve(data.data));
    });

    expect(state.session).toBeNull();

    socket.disconnect();
  });
});

// ============================================
// EXAMPLE 5: HTTPS Mode Testing
// ============================================
describe('Example 5: HTTPS Mode Testing', () => {
  // IMPORTANT: HTTPS requires self-signed cert acceptance
  const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  beforeAll(async () => {
    // Start with HTTPS enabled (required for Web NFC API)
    await startOrchestrator({ https: true, port: 3005 });
  });

  afterAll(async () => {
    await stopOrchestrator();
  });

  it('should work with HTTPS endpoints', async () => {
    const url = getOrchestratorUrl();

    // URL should use https://
    expect(url).toMatch(/^https:/);

    const response = await axiosInstance.get(`${url}/health`);
    expect(response.status).toBe(200);
  });

  it('should work with WebSocket over HTTPS', async () => {
    const url = getOrchestratorUrl();

    const authResponse = await axiosInstance.post(`${url}/api/admin/auth`, {
      password: 'test-admin-password'
    });
    const { token } = authResponse.data;

    const socket = io(url, {
      auth: {
        token,
        deviceId: 'test-https',
        deviceType: 'gm',
        version: '1.0.0'
      },
      transports: ['websocket'],
      rejectUnauthorized: false // Accept self-signed cert
    });

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    expect(socket.connected).toBe(true);

    socket.disconnect();
  });
});

// ============================================
// Best Practices Summary
// ============================================

/**
 * BEST PRACTICES:
 *
 * 1. Use different ports for each test suite to avoid conflicts
 *    - Suite A: port 3001
 *    - Suite B: port 3002
 *    - etc.
 *
 * 2. Always clean up WebSocket connections in afterAll/afterEach
 *    - socket.disconnect() before stopOrchestrator()
 *
 * 3. Use clearSessionData() in beforeEach for test isolation
 *    - Ensures each test starts with clean state
 *
 * 4. Handle HTTPS with rejectUnauthorized: false
 *    - Required for self-signed certificates in tests
 *
 * 5. Use realistic timeouts
 *    - Server startup: 30-60s
 *    - WebSocket connection: 5s
 *    - API requests: 5s
 *
 * 6. Test session persistence separately
 *    - Use restartOrchestrator({ preserveSession: true })
 *    - Verify data restored after restart
 *
 * 7. Use event-based waits, not arbitrary timeouts
 *    - await new Promise((resolve) => socket.on('event', resolve))
 *    - Better than setTimeout()
 *
 * 8. Enable debug output for troubleshooting
 *    - TEST_DEBUG=true npm run test:e2e
 */
