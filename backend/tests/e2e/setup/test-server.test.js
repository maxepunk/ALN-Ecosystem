/**
 * Test Server Helper Validation
 *
 * Validates that the E2E test server helper can:
 * 1. Start orchestrator process
 * 2. Wait for healthy status
 * 3. Stop orchestrator gracefully
 * 4. Clear session data
 * 5. Restart with session persistence
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const axios = require('axios');
const https = require('https');
const {
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator,
  getOrchestratorUrl,
  clearSessionData,
  waitForHealthy,
  getServerStatus
} = require('./test-server');

// Create axios instance that accepts self-signed certs
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 5000
});

describe('E2E Test Server Helper', () => {
  describe('Basic Lifecycle', () => {
    it('should start orchestrator and respond to health check', async () => {
      // Start server (HTTP mode for simplicity)
      const server = await startOrchestrator({ https: false, port: 3001 });

      expect(server).toBeDefined();
      expect(server.url).toBe('http://localhost:3001');
      expect(server.port).toBe(3001);
      expect(server.protocol).toBe('http');
      expect(server.process).toBeDefined();

      // Verify health endpoint responds
      const response = await axiosInstance.get(`${server.url}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('online');

      // Stop server
      await stopOrchestrator();
    }, 60000); // 60s timeout for startup

    it('should return server status when running', async () => {
      await startOrchestrator({ https: false, port: 3001 });

      const status = getServerStatus();
      expect(status).toBeDefined();
      expect(status.running).toBe(true);
      expect(status.port).toBe(3001);
      expect(status.protocol).toBe('http');
      expect(status.pid).toBeGreaterThan(0);

      await stopOrchestrator();
    }, 60000);

    it('should return null status when not running', async () => {
      const status = getServerStatus();
      expect(status).toBeNull();
    });

    it('should stop orchestrator gracefully', async () => {
      await startOrchestrator({ https: false, port: 3001 });

      // Stop server
      await stopOrchestrator({ timeout: 5000 });

      // Verify process is stopped
      const status = getServerStatus();
      expect(status).toBeNull();

      // Verify health endpoint is unreachable
      await expect(
        axiosInstance.get('http://localhost:3001/health', { timeout: 2000 })
      ).rejects.toThrow();
    }, 70000);
  });

  describe('Session Management', () => {
    it('should clear session data', async () => {
      await clearSessionData();
      // If this doesn't throw, session data was cleared successfully
      expect(true).toBe(true);
    });

    it('should restart orchestrator', async () => {
      // Start initial server
      await startOrchestrator({ https: false, port: 3001 });

      // Restart server
      const server = await restartOrchestrator({ preserveSession: false });

      expect(server).toBeDefined();
      expect(server.url).toBe('http://localhost:3001');

      // Verify health check works
      const response = await axiosInstance.get(`${server.url}/health`);
      expect(response.status).toBe(200);

      await stopOrchestrator();
    }, 90000);
  });

  describe('Utility Functions', () => {
    beforeAll(async () => {
      await startOrchestrator({ https: false, port: 3001 });
    });

    afterAll(async () => {
      await stopOrchestrator();
    });

    it('should return orchestrator URL', () => {
      const url = getOrchestratorUrl();
      expect(url).toBe('http://localhost:3001');
    });

    it('should wait for healthy status', async () => {
      // Server is already running, should return immediately
      await expect(waitForHealthy(5000)).resolves.not.toThrow();
    });

    it('should throw if URL requested when not running', async () => {
      await stopOrchestrator();

      expect(() => getOrchestratorUrl()).toThrow('Orchestrator not started');

      // Restart for other tests
      await startOrchestrator({ https: false, port: 3001 });
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should handle multiple start calls gracefully', async () => {
      await startOrchestrator({ https: false, port: 3001 });

      // Second start should return existing server info
      const server = await startOrchestrator({ https: false, port: 3001 });
      expect(server).toBeDefined();
      expect(server.url).toBe('http://localhost:3001');

      await stopOrchestrator();
    }, 60000);

    it('should handle stop when not running', async () => {
      // Should not throw
      await expect(stopOrchestrator()).resolves.not.toThrow();
    });
  });
});
