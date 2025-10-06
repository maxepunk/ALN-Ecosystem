/**
 * UDP Discovery Integration Test
 * Tests orchestrator auto-discovery on local network
 *
 * Feature: Orchestrator listens on UDP port 8888 for "ALN_DISCOVER" messages
 * and responds with service information (port, addresses, version).
 *
 * NOTE: Browser-based scanners (Player/GM) cannot use UDP directly due to
 * browser security restrictions. This feature is for:
 * - Native client applications
 * - ESP32/embedded devices
 * - Network discovery tools
 * - Future non-browser scanner implementations
 *
 * Contract: Not defined in OpenAPI/AsyncAPI (network-level protocol)
 * Implementation: src/services/discoveryService.js
 */

const dgram = require('dgram');
const { setupIntegrationTestServer, cleanupIntegrationTestServer } = require('../helpers/integration-test-server');
const DiscoveryService = require('../../src/services/discoveryService');

describe('UDP Discovery Integration', () => {
  let testContext, discoveryService, udpPort;

  beforeAll(async () => {
    // Start integration test server
    testContext = await setupIntegrationTestServer();

    // Manually create and start discovery service
    // Use port 0 (random) to avoid conflicts with running dev servers
    discoveryService = new DiscoveryService();
    udpPort = await discoveryService.start(testContext.port, 0);  // 0 = random port
  });

  afterAll(async () => {
    // Stop discovery service
    if (discoveryService) {
      discoveryService.stop();
    }

    // Cleanup test server
    await cleanupIntegrationTestServer(testContext);
  });

  describe('UDP Discovery Protocol', () => {
    it('should respond to ALN_DISCOVER broadcast with service information', async () => {
      const client = dgram.createSocket('udp4');

      try {
        // Listen for discovery response
        const responsePromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Discovery timeout - no response received within 2s'));
          }, 2000);

          client.on('message', (msg) => {
            clearTimeout(timeout);
            try {
              resolve(JSON.parse(msg.toString()));
            } catch (err) {
              reject(new Error(`Invalid JSON response: ${msg.toString()}`));
            }
          });

          client.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        // Bind to random port
        await new Promise((resolve) => {
          client.bind(0, () => resolve());
        });

        // Send discovery broadcast to orchestrator on dynamic port
        const message = Buffer.from('ALN_DISCOVER');
        client.send(message, 0, message.length, udpPort, '127.0.0.1');

        // Wait for response
        const response = await responsePromise;

        // Validate response structure
        expect(response).toHaveProperty('service', 'ALN_ORCHESTRATOR');
        expect(response).toHaveProperty('version');
        expect(response.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version
        expect(response).toHaveProperty('port', testContext.port);
        expect(response).toHaveProperty('addresses');
        expect(Array.isArray(response.addresses)).toBe(true);
        expect(response).toHaveProperty('timestamp');
        expect(new Date(response.timestamp).getTime()).toBeGreaterThan(0); // Valid ISO8601

        // Validate addresses are IPv4
        response.addresses.forEach(addr => {
          expect(addr).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        });
      } finally {
        client.close();
      }
    });

    it('should ignore non-discovery messages', async () => {
      const client = dgram.createSocket('udp4');

      try {
        // Listen for any response
        const responsePromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve(null); // No response is success for this test
          }, 1000);

          client.on('message', (msg) => {
            clearTimeout(timeout);
            reject(new Error(`Unexpected response to non-discovery message: ${msg.toString()}`));
          });
        });

        // Bind to random port
        await new Promise((resolve) => {
          client.bind(0, () => resolve());
        });

        // Send non-discovery message to dynamic port
        const message = Buffer.from('HELLO_WORLD');
        client.send(message, 0, message.length, udpPort, '127.0.0.1');

        // Wait for timeout (should NOT receive response)
        const response = await responsePromise;
        expect(response).toBeNull();
      } finally {
        client.close();
      }
    });

    it('should handle multiple concurrent discovery requests', async () => {
      const clients = [];
      const responses = [];

      try {
        // Create 5 clients and send concurrent requests
        for (let i = 0; i < 5; i++) {
          const client = dgram.createSocket('udp4');
          clients.push(client);

          const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Client ${i} timeout`));
            }, 2000);

            client.on('message', (msg) => {
              clearTimeout(timeout);
              try {
                resolve(JSON.parse(msg.toString()));
              } catch (err) {
                reject(err);
              }
            });
          });

          // Bind and send
          await new Promise((resolve) => {
            client.bind(0, () => resolve());
          });

          const message = Buffer.from('ALN_DISCOVER');
          client.send(message, 0, message.length, udpPort, '127.0.0.1');

          responses.push(responsePromise);
        }

        // Wait for all responses
        const results = await Promise.all(responses);

        // All should have same service info (but different timestamps)
        results.forEach((response, i) => {
          expect(response.service).toBe('ALN_ORCHESTRATOR');
          expect(response.port).toBe(testContext.port);
          expect(response.version).toBeDefined();
        });
      } finally {
        clients.forEach(client => client.close());
      }
    });
  });

  describe('Network Interface Discovery', () => {
    it('should return valid IPv4 addresses', () => {
      const addresses = discoveryService.getNetworkIPs();

      // Should return array (may be empty if no network interfaces)
      expect(Array.isArray(addresses)).toBe(true);

      // Each address should be valid IPv4
      addresses.forEach(addr => {
        expect(addr).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);

        // Should not include loopback or internal addresses
        expect(addr).not.toBe('127.0.0.1');
        expect(addr).not.toMatch(/^169\.254\./); // Link-local
      });
    });
  });
});
