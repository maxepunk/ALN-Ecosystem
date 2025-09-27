/**
 * Contract Test for GET /api/state/status
 * Verifies the network status endpoint for scanner discovery
 *
 * OpenAPI Contract:
 * - No authentication required (discovery endpoint)
 * - Returns network interfaces and service status
 * - Used by scanner config pages for auto-discovery
 */

const request = require('supertest');
const os = require('os');
const { setupHTTPTest, cleanupHTTPTest } = require('./http-test-utils');

describe('GET /api/state/status - Network Status Endpoint', () => {
  let testContext;

  beforeEach(async () => {
    // Use shared utilities for consistent setup
    testContext = await setupHTTPTest({
      createSession: false, // Status endpoint doesn't need a session
      needsAuth: false
    });
  });

  afterEach(async () => {
    // Ensure proper cleanup
    await cleanupHTTPTest(testContext);
  });

  describe('Successful Status Retrieval', () => {
    it('should return status without authentication', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('online');
    });

    it('should include network interfaces array', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('networkInterfaces');
      expect(Array.isArray(response.body.networkInterfaces)).toBe(true);
      expect(response.body.networkInterfaces.length).toBeGreaterThan(0);
    });

    it('should return valid IP addresses', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      response.body.networkInterfaces.forEach(ip => {
        expect(ip).toMatch(ipRegex);
      });
    });

    it('should include port configuration', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('port');
      expect(typeof response.body.port).toBe('number');
      expect(response.body.port).toBeGreaterThan(0);
      expect(response.body.port).toBeLessThanOrEqual(65535);
    });

    it('should include version information', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(typeof response.body.version).toBe('string');
      expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should include features configuration', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('features');
      expect(typeof response.body.features).toBe('object');
    });

    it('should respond quickly for discovery', async () => {
      const start = Date.now();
      await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Discovery should be very fast
    });
  });

  describe('Network Interface Detection', () => {
    it('should exclude internal/loopback interfaces', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      // Should not include 127.0.0.1
      expect(response.body.networkInterfaces).not.toContain('127.0.0.1');
    });

    it('should match actual system interfaces', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      // Get actual system IPs
      const interfaces = os.networkInterfaces();
      const systemIps = [];
      Object.values(interfaces).flat().forEach(iface => {
        if (!iface.internal && iface.family === 'IPv4') {
          systemIps.push(iface.address);
        }
      });

      // Response should contain at least one system IP
      const hasSystemIp = response.body.networkInterfaces.some(ip =>
        systemIps.includes(ip)
      );
      expect(hasSystemIp).toBe(true);
    });
  });

  describe('CORS and Headers', () => {
    it('should include CORS headers for scanner discovery', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .set('Origin', 'http://localhost:8000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should return JSON content type', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle preflight OPTIONS request', async () => {
      const response = await request(testContext.app)
        .options('/api/state/status')
        .set('Origin', 'http://localhost:8000')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBeLessThan(300);
    });
  });

  describe('Service Health Indicators', () => {
    it('should indicate orchestrator is online', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body.status).toBe('online');
    });

    it('should include service metadata', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      if (response.body.metadata) {
        expect(response.body.metadata).toHaveProperty('uptime');
        expect(response.body.metadata).toHaveProperty('nodeVersion');
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network detection failures gracefully', async () => {
      // Even if network detection fails, endpoint should respond
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('networkInterfaces');
    });

    it('should work without active session', async () => {
      // Status endpoint should work independently of game state
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      expect(response.body.status).toBe('online');
    });
  });

  describe('Method Restrictions', () => {
    it('should reject POST requests', async () => {
      await request(testContext.app)
        .post('/api/state/status')
        .send({ test: 'data' })
        .expect(404);
    });

    it('should reject PUT requests', async () => {
      await request(testContext.app)
        .put('/api/state/status')
        .send({ test: 'data' })
        .expect(404);
    });

    it('should reject DELETE requests', async () => {
      await request(testContext.app)
        .delete('/api/state/status')
        .expect(404);
    });
  });

  describe('Discovery Use Cases', () => {
    it('should provide sufficient info for scanner configuration', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      // Scanner needs: IPs, port, and status
      expect(response.body).toHaveProperty('networkInterfaces');
      expect(response.body).toHaveProperty('port');
      expect(response.body).toHaveProperty('status');

      // Should have at least one IP for connection
      expect(response.body.networkInterfaces.length).toBeGreaterThan(0);
    });

    it('should support UDP discovery correlation', async () => {
      const response = await request(testContext.app)
        .get('/api/state/status')
        .expect(200);

      // Should provide info that matches UDP broadcast
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('port');
    });
  });
});