const os = require('os');
const dgram = require('dgram');
const config = require('../config');

class DiscoveryService {
  constructor() {
    this.udpServer = null;
    this.port = null;
  }

  /**
   * Get all IPv4 network interfaces
   * @returns {Array} Array of IPv4 addresses
   */
  getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    Object.values(interfaces).flat()
      .filter(i => !i.internal && i.family === 'IPv4')
      .forEach(i => addresses.push(i.address));

    return addresses;
  }

  /**
   * Display network IPs for scanner configuration
   * @param {number} port - Server port
   */
  displayNetworkInfo(port) {
    const addresses = this.getNetworkIPs();
    const protocol = config.ssl.enabled ? 'https' : 'http';

    console.log('\n' + '='.repeat(50));
    console.log('   ALN ORCHESTRATOR STARTED');
    console.log('='.repeat(50));
    console.log('\nConnect scanners to any of these addresses:\n');

    if (addresses.length > 0) {
      addresses.forEach(addr => {
        console.log(`  → ${protocol}://${addr}:${port}`);
      });
      console.log(`  → ${protocol}://localhost:${port}`);
    } else {
      console.log(`  → ${protocol}://localhost:${port} (no network interfaces found)`);
    }

    if (config.ssl.enabled) {
      console.log('\n⚠️  HTTPS is enabled - browsers will show certificate warning');
      console.log('   Accept the warning to establish trust (one-time per device)');
      console.log(`   HTTP redirect available on port ${config.ssl.httpRedirectPort}`);
    }

    console.log('\nFor scanner configuration:');
    console.log('  1. Open scanner config page');
    console.log('  2. Enter one of the above URLs');
    console.log('  3. Test connection');
    console.log('\n' + '='.repeat(50) + '\n');
  }

  /**
   * Start UDP discovery broadcast server
   * @param {number} httpPort - HTTP server port to advertise
   * @param {number} udpPort - UDP port to listen on (0 for random, default 8888)
   * @returns {Promise<number>} Resolves with actual UDP port when server is listening
   */
  startUDPBroadcast(httpPort, udpPort = null) {
    return new Promise((resolve, reject) => {
      this.port = httpPort;
      this.udpServer = dgram.createSocket('udp4');

      this.udpServer.on('error', (err) => {
        console.error('Discovery UDP server error:', err);
        reject(err);
      });

      this.udpServer.on('message', (msg, rinfo) => {
        const message = msg.toString();

        // Respond to ALN discovery requests
        if (message === 'ALN_DISCOVER') {
          const response = JSON.stringify({
            service: 'ALN_ORCHESTRATOR',
            version: '1.0.0',
            port: this.port,
            protocol: config.ssl.enabled ? 'https' : 'http',
            addresses: this.getNetworkIPs(),
            timestamp: new Date().toISOString()
          });

          this.udpServer.send(response, rinfo.port, rinfo.address, (err) => {
            if (err) {
              console.error('Failed to send discovery response:', err);
            } else {
              console.log(`Discovery response sent to ${rinfo.address}:${rinfo.port}`);
            }
          });
        }
      });

      this.udpServer.on('listening', () => {
        const address = this.udpServer.address();
        console.log(`UDP discovery server listening on port ${address.port}`);
        this.udpPort = address.port;  // Store actual port
        resolve(address.port);
      });

      // Use provided port, or env var, or default 8888
      const port = udpPort !== null ? udpPort : (process.env.DISCOVERY_UDP_PORT || 8888);
      this.udpServer.bind(port, '0.0.0.0');
    });
  }

  /**
   * Start all discovery services
   * @param {number} httpPort - HTTP server port
   * @param {number} udpPort - UDP port to listen on (0 for random, default 8888)
   */
  async start(httpPort, udpPort = null) {
    // Display network info immediately
    this.displayNetworkInfo(httpPort);

    // Start UDP discovery server
    try {
      const actualUdpPort = await this.startUDPBroadcast(httpPort, udpPort);
      return actualUdpPort;
    } catch (err) {
      console.warn('UDP discovery server failed to start:', err.message);
      console.warn('Manual configuration will be required for scanners');
      return null;
    }
  }

  /**
   * Stop discovery services
   */
  stop() {
    if (this.udpServer) {
      this.udpServer.close();
      this.udpServer = null;
      console.log('Discovery service stopped');
    }
  }
}

module.exports = DiscoveryService;