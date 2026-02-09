/**
 * DiscoveryService Unit Tests
 * Tests UDP broadcast functionality for network discovery
 * Layer 1: Service Logic - NO server, NO WebSocket, pure UDP logic
 *
 * Anti-Pattern #5 (tests as afterthought) - Network discovery had no tests
 */

const DiscoveryService = require('../../../src/services/discoveryService');
const dgram = require('dgram');
const os = require('os');

describe('DiscoveryService', () => {
  let discoveryService;

  beforeEach(() => {
    // Create fresh instance for each test
    discoveryService = new DiscoveryService();
  });

  afterEach(async () => {
    // Cleanup - ensure UDP server is stopped
    if (discoveryService && discoveryService.udpServer) {
      discoveryService.stop();
    }
    // Small delay to allow socket cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('getNetworkIPs', () => {
    it('should return array of IPv4 addresses', () => {
      // ACT
      const ips = discoveryService.getNetworkIPs();

      // ASSERT
      expect(Array.isArray(ips)).toBe(true);
      // Should filter out internal and IPv6
      ips.forEach(ip => {
        expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      });
    });

    it('should exclude internal interfaces', () => {
      // ACT
      const ips = discoveryService.getNetworkIPs();

      // ASSERT - 127.0.0.1 should not be in the list
      expect(ips).not.toContain('127.0.0.1');
    });
  });

  describe('startUDPBroadcast', () => {
    it('should initialize UDP broadcast and bind to a port', async () => {
      // ACT - use port 0 to avoid conflicts with running services
      const actualPort = await discoveryService.startUDPBroadcast(3000, 0);

      // ASSERT
      expect(actualPort).toBeGreaterThan(0);
      expect(discoveryService.udpServer).toBeTruthy();
      expect(discoveryService.port).toBe(3000);
      expect(discoveryService.udpPort).toBe(actualPort);
    });

    it('should use custom UDP port when provided', async () => {
      // ARRANGE - Use port 0 for random available port
      const customPort = 0;

      // ACT
      const actualPort = await discoveryService.startUDPBroadcast(3000, customPort);

      // ASSERT
      expect(actualPort).toBeGreaterThan(0);
      expect(discoveryService.udpPort).toBe(actualPort);
    });

    it('should respond to ALN_DISCOVER messages', async () => {
      // ARRANGE - use port 0 to avoid conflicts with running services
      const serverPort = await discoveryService.startUDPBroadcast(3000, 0);

      // Create client socket to send discovery request
      const client = dgram.createSocket('udp4');

      // ACT & ASSERT
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Discovery response timeout'));
        }, 2000);

        client.on('message', (msg) => {
          clearTimeout(timeout);
          const data = JSON.parse(msg.toString());
          resolve(data);
        });

        client.bind(() => {
          const message = Buffer.from('ALN_DISCOVER');
          client.send(message, 0, message.length, serverPort, 'localhost', (err) => {
            if (err) reject(err);
          });
        });
      });

      // ASSERT response structure
      expect(response).toHaveProperty('service', 'ALN_ORCHESTRATOR');
      expect(response).toHaveProperty('version', '1.0.0');
      expect(response).toHaveProperty('port', 3000);
      expect(response).toHaveProperty('protocol');
      expect(response).toHaveProperty('addresses');
      expect(response).toHaveProperty('timestamp');
      expect(Array.isArray(response.addresses)).toBe(true);

      // Cleanup
      client.close();
    });
  });

  describe('stop', () => {
    it('should close UDP socket', async () => {
      // ARRANGE - use port 0 to avoid conflicts
      await discoveryService.startUDPBroadcast(3000, 0);
      expect(discoveryService.udpServer).toBeTruthy();

      // ACT
      discoveryService.stop();

      // ASSERT
      expect(discoveryService.udpServer).toBe(null);
    });

    it('should not error if already stopped', () => {
      // ACT & ASSERT - should not throw
      expect(() => discoveryService.stop()).not.toThrow();
    });

    it('should not error when called multiple times', async () => {
      // ARRANGE - use port 0 to avoid conflicts
      await discoveryService.startUDPBroadcast(3000, 0);

      // ACT & ASSERT
      expect(() => {
        discoveryService.stop();
        discoveryService.stop();
        discoveryService.stop();
      }).not.toThrow();
    });
  });

  describe('start', () => {
    it('should return UDP port on success', async () => {
      // ACT - use port 0 to avoid conflicts with running services
      const udpPort = await discoveryService.start(3000, 0);

      // ASSERT
      expect(udpPort).toBeGreaterThan(0);
      expect(discoveryService.udpServer).toBeTruthy();
    });
  });
});
