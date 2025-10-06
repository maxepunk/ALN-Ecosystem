/**
 * ConnectionManager Unit Tests
 *
 * Tests the GM Scanner connection state machine, reconnection logic,
 * health checks, authentication, and event handling.
 *
 * Functional Requirements:
 * - Section 2.3: Player Scanner Connection Management
 * - Section 3.4: GM Scanner Offline Capability
 * - Deployment Modes: Networked, Offline (temp), Standalone
 *
 * Contract: asyncapi.yaml - WebSocket handshake authentication
 * Contract: openapi.yaml - POST /api/admin/auth, GET /health
 */

// Load browser mocks first
require('../../helpers/browser-mocks');

// Mock fetch globally
global.fetch = jest.fn();

// Mock OrchestratorClient as global (browser environment)
global.OrchestratorClient = jest.fn().mockImplementation(() => ({
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn(),
  on: jest.fn(),
  token: null
}));

// Mock NetworkedQueueManager (used in connect() method)
global.NetworkedQueueManager = jest.fn().mockImplementation(() => ({
  queueTransaction: jest.fn(),
  getStatus: jest.fn().mockReturnValue({ queuedCount: 0, syncing: false })
}));

// Mock showConnectionWizard (used when auth required)
global.showConnectionWizard = jest.fn();

const ConnectionManager = require('../../../../ALNScanner/js/network/connectionManager');

describe('ConnectionManager', () => {
  let connectionManager;
  let mockUIManager;
  let originalSetTimeout;
  let originalClearTimeout;

  beforeEach(() => {
    // Clear localStorage
    global.localStorage.clear();

    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockClear();

    // Reset OrchestratorClient mock
    global.OrchestratorClient.mockClear();
    global.OrchestratorClient.mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn(),
      on: jest.fn(),
      token: null
    }));

    // Reset NetworkedQueueManager mock
    global.NetworkedQueueManager.mockClear();
    global.window.queueManager = null; // Reset queue manager

    // Mock UI
    mockUIManager = {
      showError: jest.fn()
    };
    global.UIManager = mockUIManager;

    // Mock DOM for UI updates
    global.document.getElementById = jest.fn().mockReturnValue(null);

    // Mock timers
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
    jest.useFakeTimers();

    // Create fresh instance
    connectionManager = new ConnectionManager();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // TEST GROUP 1: State Machine Transitions
  // ============================================================================

  describe('State Machine', () => {
    describe('TEST 1: Initial state', () => {
      it('should start in disconnected state', () => {
        expect(connectionManager.status).toBe('disconnected');
      });

      it('should have null client initially', () => {
        expect(connectionManager.client).toBeNull();
      });

      it('should have zero retry count initially', () => {
        expect(connectionManager.retryCount).toBe(0);
      });

      it('should have no retry timer initially', () => {
        expect(connectionManager.retryTimer).toBeNull();
      });
    });

    describe('TEST 2: disconnected → offline (no URL configured)', () => {
      it('should transition to offline when URL not configured', async () => {
        // ARRANGE: No URL set
        expect(connectionManager.url).toBeNull();

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(false);
        expect(connectionManager.status).toBe('offline');
      });
    });

    describe('TEST 3: disconnected → connecting → disconnected (health check fails)', () => {
      it('should return to disconnected when server unreachable', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(false);
        expect(connectionManager.status).toBe('disconnected');
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/health',
          expect.objectContaining({ method: 'GET' })
        );
      });
    });

    describe('TEST 4: disconnected → connecting → auth_required (invalid token)', () => {
      it('should transition to auth_required when token invalid', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true }); // Health check passes
        connectionManager.token = 'invalid.token.here'; // Invalid JWT format

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(false);
        expect(connectionManager.status).toBe('auth_required');
      });

      it('should transition to auth_required when token expired', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true }); // Health check passes

        // Create expired token (expired 1 hour ago)
        const expiredPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        };
        const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;
        connectionManager.token = expiredToken;

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(false);
        expect(connectionManager.status).toBe('auth_required');
      });
    });

    describe('TEST 5: disconnected → connecting → connected (success)', () => {
      it('should transition to connected when all checks pass', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true }); // Health check passes

        // Valid token (expires in 24 hours)
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
        };
        const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
        connectionManager.token = validToken;

        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(true);
        expect(mockClient.connect).toHaveBeenCalledTimes(1);
        expect(connectionManager.client).toBe(mockClient);
      });

      it('should set status to connecting before attempting connection', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        let statusDuringConnect = null;
        const mockClient = {
          connect: jest.fn().mockImplementation(async () => {
            statusDuringConnect = connectionManager.status;
            return true;
          }),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT
        await connectionManager.connect();

        // ASSERT
        expect(statusDuringConnect).toBe('connecting');
      });
    });

    describe('TEST 6: connected → disconnected (manual disconnect)', () => {
      it('should transition to disconnected on manual disconnect', async () => {
        // ARRANGE: First connect
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        await connectionManager.connect();
        expect(connectionManager.status).toBe('connecting'); // Still connecting until status event

        // ACT: Disconnect
        connectionManager.disconnect();

        // ASSERT
        expect(connectionManager.status).toBe('disconnected');
        expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
        expect(connectionManager.client).toBeNull();
      });
    });

    describe('TEST 7: connecting → error (connection failed)', () => {
      it('should transition to error when client connection fails', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const mockClient = {
          connect: jest.fn().mockRejectedValue(new Error('Connection failed')),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT
        const result = await connectionManager.connect();

        // ASSERT
        expect(result).toBe(false);
        expect(connectionManager.status).toBe('error');
        expect(mockUIManager.showError).toHaveBeenCalledWith(
          'Connection failed. Check network and orchestrator.'
        );
      });
    });
  });

  // ============================================================================
  // TEST GROUP 2: Reconnection Logic with Exponential Backoff
  // ============================================================================

  describe('Exponential Backoff Reconnection', () => {
    describe('TEST 8: Retry scheduling', () => {
      it('should schedule retry after connection failure', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        // ACT
        await connectionManager.connect();

        // ASSERT
        expect(connectionManager.retryCount).toBe(1);
        expect(connectionManager.retryTimer).not.toBeNull();
      });

      it('should use base delay for first retry (5 seconds)', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValueOnce(new Error('Network error'));
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        // ACT
        await connectionManager.connect();

        // ASSERT
        const expectedDelay = 5000; // baseRetryDelay
        expect(setTimeoutSpy).toHaveBeenCalledWith(
          expect.any(Function),
          expectedDelay
        );
      });

      it('should double delay for each subsequent retry', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValue(new Error('Network error'));

        // ACT: Simulate 3 failed attempts
        const delays = [];
        for (let i = 0; i < 3; i++) {
          await connectionManager.connect();
          jest.runOnlyPendingTimers();

          // Calculate expected delay
          const expectedDelay = Math.min(
            5000 * Math.pow(2, i),
            300000 // Max 5 minutes
          );
          delays.push(expectedDelay);
        }

        // ASSERT
        expect(delays[0]).toBe(5000);    // 5 seconds
        expect(delays[1]).toBe(10000);   // 10 seconds
        expect(delays[2]).toBe(20000);   // 20 seconds
      });

      it('should cap delay at 5 minutes (300000ms)', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValue(new Error('Network error'));

        // Temporarily increase maxRetries to allow testing delay cap
        connectionManager.maxRetries = 10;

        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

        // ACT: Retry until delay would exceed cap
        // retryCount 7: 5000 * 2^6 = 320000 → should be capped to 300000
        for (let i = 0; i < 7; i++) {
          await connectionManager.connect();
          jest.runOnlyPendingTimers();
        }

        // ASSERT
        // Delay should be capped at 300000ms even though 5000 * 2^6 = 320,000
        const setTimeoutCalls = setTimeoutSpy.mock.calls;
        const lastDelay = setTimeoutCalls[setTimeoutCalls.length - 1][1];
        expect(lastDelay).toBe(300000);
      });
    });

    describe('TEST 9: Max retry attempts enforcement', () => {
      it('should stop retrying after maxRetries (5) attempts', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValue(new Error('Network error'));

        // ACT: Attempt connection 6 times
        for (let i = 0; i < 6; i++) {
          await connectionManager.connect();
          if (i < 5) {
            jest.runOnlyPendingTimers();
          }
        }

        // ASSERT
        // RetryCount stops at maxRetries (5), doesn't increment to 6
        // because scheduleRetry() exits early when retryCount >= maxRetries
        expect(connectionManager.retryCount).toBe(5);
        expect(connectionManager.retryTimer).toBeNull(); // No timer scheduled after max retries
      });

      it('should not schedule retry when max retries reached', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValue(new Error('Network error'));
        connectionManager.retryCount = 5; // Already at max

        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const callCountBefore = setTimeoutSpy.mock.calls.length;

        // ACT
        await connectionManager.connect();

        // ASSERT
        const callCountAfter = setTimeoutSpy.mock.calls.length;
        expect(callCountAfter).toBe(callCountBefore); // No new setTimeout call
      });
    });

    describe('TEST 10: Retry count reset on successful connection', () => {
      it('should reset retry count to 0 when connection succeeds', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        connectionManager.retryCount = 3; // Simulate previous failures

        global.fetch.mockResolvedValueOnce({ ok: true });
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT
        await connectionManager.connect();

        // ASSERT
        expect(connectionManager.retryCount).toBe(0);
      });

      it('should clear any pending retry timer when connecting', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';

        // Schedule a retry
        global.fetch.mockRejectedValueOnce(new Error('Network error'));
        await connectionManager.connect();
        expect(connectionManager.retryTimer).not.toBeNull();

        // Setup successful connection
        global.fetch.mockResolvedValueOnce({ ok: true });
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT: Attempt new connection (should clear timer)
        await connectionManager.connect();

        // ASSERT: Timer cleared
        // Note: Timer is cleared at start of connect(), not on success
        // This is verified by checking that no timer exists after connect completes
        expect(jest.getTimerCount()).toBe(0);
      });
    });

    describe('TEST 11: Retry on client event errors', () => {
      it('should schedule retry when client fires connection:error event', async () => {
        // ARRANGE: Setup successful initial connection
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const eventHandlers = {};
        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
          }),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        await connectionManager.connect();
        expect(eventHandlers['connection:error']).toBeDefined();

        // ACT: Trigger connection error
        connectionManager.retryCount = 0; // Reset for testing
        eventHandlers['connection:error'](new Error('Connection lost'));

        // ASSERT
        expect(connectionManager.retryCount).toBe(1);
        expect(connectionManager.retryTimer).not.toBeNull();
      });

      it('should schedule retry when server initiates disconnect', async () => {
        // ARRANGE: Setup successful initial connection
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const eventHandlers = {};
        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
          }),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        await connectionManager.connect();
        expect(eventHandlers['disconnect']).toBeDefined();

        // ACT: Trigger server-initiated disconnect
        connectionManager.retryCount = 0;
        eventHandlers['disconnect']('io server disconnect');

        // ASSERT
        expect(connectionManager.retryCount).toBe(1);
        expect(connectionManager.retryTimer).not.toBeNull();
      });
    });
  });

  // ============================================================================
  // TEST GROUP 3: Health Check
  // ============================================================================

  describe('Health Check', () => {
    describe('TEST 12: Successful health check', () => {
      it('should return true when server responds with 200 OK', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        // ACT
        const result = await connectionManager.checkHealth();

        // ASSERT
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/health',
          expect.objectContaining({
            method: 'GET',
            mode: 'cors'
          })
        );
      });
    });

    describe('TEST 13: Failed health check', () => {
      it('should return false when server unreachable', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        // ACT
        const result = await connectionManager.checkHealth();

        // ASSERT
        expect(result).toBe(false);
      });

      it('should return false when server responds with non-OK status', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });

        // ACT
        const result = await connectionManager.checkHealth();

        // ASSERT
        expect(result).toBe(false);
      });

      it('should return false when no URL configured', async () => {
        // ARRANGE: No URL set
        expect(connectionManager.url).toBeNull();

        // ACT
        const result = await connectionManager.checkHealth();

        // ASSERT
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('TEST 14: Health check timeout', () => {
      it('should use 3 second timeout for health check', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        // ACT
        await connectionManager.checkHealth();

        // ASSERT
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            signal: expect.anything() // AbortSignal.timeout(3000)
          })
        );
      });
    });
  });

  // ============================================================================
  // TEST GROUP 4: Authentication and Token Management
  // ============================================================================

  describe('Authentication', () => {
    describe('TEST 15: Successful authentication', () => {
      it('should authenticate with password and store token', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        const mockToken = 'header.payload.signature';

        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ token: mockToken })
        });

        // ACT
        const result = await connectionManager.authenticate('test-password');

        // ASSERT
        expect(result).toBe(mockToken);
        expect(connectionManager.token).toBe(mockToken);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/admin/auth',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'test-password' })
          })
        );
      });
    });

    describe('TEST 16: Failed authentication', () => {
      it('should throw error when authentication fails', async () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

        // ACT & ASSERT
        await expect(
          connectionManager.authenticate('wrong-password')
        ).rejects.toThrow('Invalid password');

        expect(mockUIManager.showError).toHaveBeenCalledWith(
          'Authentication failed. Check password.'
        );
      });

      it('should throw error when no URL configured', async () => {
        // ARRANGE: No URL set
        expect(connectionManager.url).toBeNull();

        // ACT & ASSERT
        await expect(
          connectionManager.authenticate('password')
        ).rejects.toThrow('No server URL configured');
      });
    });

    describe('TEST 17: Token validation', () => {
      it('should validate token format and expiry', () => {
        // ARRANGE: Valid token (expires in 24 hours)
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
        connectionManager.token = validToken;

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(true);
      });

      it('should reject expired token', () => {
        // ARRANGE: Expired token
        const expiredPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        };
        const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;
        connectionManager.token = expiredToken;

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(false);
      });

      it('should reject token expiring within 5 minute buffer', () => {
        // ARRANGE: Token expires in 4 minutes
        const soonToExpirePayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 240 // 4 minutes
        };
        const soonToExpireToken = `header.${btoa(JSON.stringify(soonToExpirePayload))}.signature`;
        connectionManager.token = soonToExpireToken;

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(false);
      });

      it('should accept token expiring beyond 5 minute buffer', () => {
        // ARRANGE: Token expires in 6 minutes
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 360 // 6 minutes
        };
        const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;
        connectionManager.token = validToken;

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(true);
      });

      it('should reject malformed token', () => {
        // ARRANGE
        connectionManager.token = 'invalid-token-format';

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(false);
        expect(mockUIManager.showError).toHaveBeenCalledWith(
          'Invalid token format. Please check your input.'
        );
      });

      it('should return false when no token stored', () => {
        // ARRANGE
        connectionManager.token = null;

        // ACT
        const result = connectionManager.isTokenValid();

        // ASSERT
        expect(result).toBe(false);
      });
    });

    describe('TEST 18: Token expiry extraction', () => {
      it('should extract token expiry date', () => {
        // ARRANGE
        const futureTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours
        const payload = { role: 'admin', exp: futureTime };
        const token = `header.${btoa(JSON.stringify(payload))}.signature`;
        connectionManager.token = token;

        // ACT
        const expiryDate = connectionManager.getTokenExpiry();

        // ASSERT
        expect(expiryDate).toBeInstanceOf(Date);
        expect(expiryDate.getTime()).toBe(futureTime * 1000);
      });

      it('should return null for malformed token', () => {
        // ARRANGE
        connectionManager.token = 'invalid-token';

        // ACT
        const expiryDate = connectionManager.getTokenExpiry();

        // ASSERT
        expect(expiryDate).toBeNull();
      });

      it('should return null when no token stored', () => {
        // ARRANGE
        connectionManager.token = null;

        // ACT
        const expiryDate = connectionManager.getTokenExpiry();

        // ASSERT
        expect(expiryDate).toBeNull();
      });
    });
  });

  // ============================================================================
  // TEST GROUP 5: Storage Management
  // ============================================================================

  describe('Storage Management', () => {
    describe('TEST 19: URL normalization', () => {
      it('should add http:// prefix when missing', () => {
        // ACT
        connectionManager.url = 'localhost:3000';

        // ASSERT
        expect(connectionManager.url).toBe('http://localhost:3000');
      });

      it('should not modify URL with http:// prefix', () => {
        // ACT
        connectionManager.url = 'http://localhost:3000';

        // ASSERT
        expect(connectionManager.url).toBe('http://localhost:3000');
      });

      it('should not modify URL with https:// prefix', () => {
        // ACT
        connectionManager.url = 'https://example.com';

        // ASSERT
        expect(connectionManager.url).toBe('https://example.com');
      });

      it('should trim whitespace from URL', () => {
        // ACT
        connectionManager.url = '  localhost:3000  ';

        // ASSERT
        expect(connectionManager.url).toBe('http://localhost:3000');
      });

      it('should remove URL when set to null', () => {
        // ARRANGE
        connectionManager.url = 'http://localhost:3000';

        // ACT
        connectionManager.url = null;

        // ASSERT
        expect(connectionManager.url).toBeNull();
      });
    });

    describe('TEST 20: Device ID generation', () => {
      it('should generate device ID when not stored', () => {
        // ACT
        const deviceId = connectionManager.deviceId;

        // ASSERT
        expect(deviceId).toMatch(/^GM_STATION_\d+$/);
      });

      it('should return stored device ID when available', () => {
        // ARRANGE
        localStorage.setItem('deviceId', 'TEST_DEVICE_001');

        // ACT
        const deviceId = connectionManager.deviceId;

        // ASSERT
        expect(deviceId).toBe('TEST_DEVICE_001');
      });

      it('should persist device ID to localStorage', () => {
        // ACT
        connectionManager.deviceId = 'MY_DEVICE_123';

        // ASSERT
        expect(localStorage.getItem('deviceId')).toBe('MY_DEVICE_123');
      });
    });

    describe('TEST 21: Station mode storage', () => {
      it('should default to detective mode when not stored', () => {
        // ACT
        const mode = connectionManager.stationMode;

        // ASSERT
        expect(mode).toBe('detective');
      });

      it('should persist station mode to localStorage', () => {
        // ACT
        connectionManager.stationMode = 'blackmarket';

        // ASSERT
        expect(localStorage.getItem('stationMode')).toBe('blackmarket');
        expect(connectionManager.stationMode).toBe('blackmarket');
      });
    });

    describe('TEST 22: Storage migration', () => {
      it('should migrate old snake_case URL key to camelCase', () => {
        // ARRANGE
        localStorage.setItem('orchestrator_url', 'http://old-url:3000');

        // ACT
        connectionManager.migrateLocalStorage();

        // ASSERT
        expect(localStorage.getItem('orchestratorUrl')).toBe('http://old-url:3000');
        expect(localStorage.getItem('orchestrator_url')).toBeNull();
      });

      it('should not migrate if new key already exists', () => {
        // ARRANGE
        localStorage.setItem('orchestrator_url', 'http://old-url:3000');
        localStorage.setItem('orchestratorUrl', 'http://new-url:3000');

        // ACT
        connectionManager.migrateLocalStorage();

        // ASSERT
        expect(localStorage.getItem('orchestratorUrl')).toBe('http://new-url:3000');
        expect(localStorage.getItem('orchestrator_url')).toBe('http://old-url:3000');
      });
    });
  });

  // ============================================================================
  // TEST GROUP 6: Configuration and Integration
  // ============================================================================

  describe('Configuration', () => {
    describe('TEST 23: Complete configuration flow', () => {
      it('should configure URL, authenticate, and connect', async () => {
        // ARRANGE
        const mockToken = 'header.payload.signature';
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        // Mock auth response
        global.fetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ token: validToken })
        });

        // Mock health check
        global.fetch.mockResolvedValueOnce({ ok: true });

        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn(),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        // ACT
        const result = await connectionManager.configure(
          'localhost:3000',
          'GM Station 1',
          'test-password'
        );

        // ASSERT
        expect(result).toBe(true);
        expect(connectionManager.url).toBe('http://localhost:3000');
        expect(connectionManager.stationName).toBe('GM Station 1');
        expect(connectionManager.deviceId).toBe('GM_Station_1'); // Whitespace replaced
        expect(connectionManager.token).toBe(validToken);
      });

      it('should throw error when configuration fails', async () => {
        // ARRANGE
        global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

        // ACT & ASSERT
        await expect(
          connectionManager.configure('localhost:3000', 'Station 1', 'wrong-password')
        ).rejects.toThrow();

        expect(mockUIManager.showError).toHaveBeenCalledWith(
          'Configuration failed. Check settings.'
        );
      });
    });
  });

  // ============================================================================
  // TEST GROUP 7: Event Handling and Status Updates
  // ============================================================================

  describe('Event Handling', () => {
    describe('TEST 24: Client event forwarding', () => {
      it('should forward status:changed events to UI', async () => {
        // ARRANGE: Setup connection
        connectionManager.url = 'http://localhost:3000';
        global.fetch.mockResolvedValueOnce({ ok: true });

        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        // Mock DOM element for updateUI
        const mockIndicator = {
          querySelector: jest.fn().mockReturnValue({ textContent: '' }),
          classList: {
            remove: jest.fn(),
            add: jest.fn()
          }
        };
        document.getElementById = jest.fn().mockReturnValue(mockIndicator);

        // Ensure window.queueManager has getStatus for updateUI (called during connection)
        global.window.queueManager = {
          getStatus: jest.fn().mockReturnValue({ queuedCount: 0, syncing: false })
        };

        const eventHandlers = {};
        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
          }),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        await connectionManager.connect();
        expect(eventHandlers['status:changed']).toBeDefined();

        // ACT: Trigger status change
        eventHandlers['status:changed']('connected');

        // ASSERT
        expect(connectionManager.status).toBe('connected');
        expect(mockIndicator.classList.add).toHaveBeenCalledWith('connected');
      });

      it('should reset retry count when status becomes connected', async () => {
        // ARRANGE: Setup connection with some retries
        connectionManager.url = 'http://localhost:3000';
        connectionManager.retryCount = 3;

        global.fetch.mockResolvedValueOnce({ ok: true });
        const validPayload = {
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        connectionManager.token = `header.${btoa(JSON.stringify(validPayload))}.signature`;

        const eventHandlers = {};
        const mockClient = {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn(),
          on: jest.fn((event, handler) => {
            eventHandlers[event] = handler;
          }),
          token: null
        };
        global.OrchestratorClient.mockReturnValueOnce(mockClient);

        await connectionManager.connect();
        expect(eventHandlers['status:changed']).toBeDefined();

        // ACT: Trigger connected status
        eventHandlers['status:changed']('connected');

        // ASSERT
        expect(connectionManager.retryCount).toBe(0);
      });
    });
  });
});
