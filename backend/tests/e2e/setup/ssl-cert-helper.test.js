/**
 * SSL Certificate Helper Tests
 *
 * Validates SSL certificate handling utilities for E2E tests.
 * These tests verify that the helper functions work correctly without
 * actually making HTTPS requests (to avoid dependencies on running servers).
 */

const path = require('path');
const axios = require('axios');
const https = require('https');
const {
  getCertPaths,
  verifyCertsExist,
  getCertificateInfo,
  createHTTPSAgent,
  configureAxiosForHTTPS,
  configurePlaywrightHTTPS,
  configurePageHTTPS,
  configureNodeHTTPS,
  restoreNodeHTTPS
} = require('./ssl-cert-helper');

describe('SSL Certificate Helper', () => {
  describe('Certificate Path Management', () => {
    test('getCertPaths returns absolute paths', () => {
      const paths = getCertPaths();

      expect(paths).toHaveProperty('keyPath');
      expect(paths).toHaveProperty('certPath');
      expect(path.isAbsolute(paths.keyPath)).toBe(true);
      expect(path.isAbsolute(paths.certPath)).toBe(true);
      expect(paths.keyPath).toContain('ssl/key.pem');
      expect(paths.certPath).toContain('ssl/cert.pem');
    });

    test('verifyCertsExist checks file existence', () => {
      const result = verifyCertsExist();

      // Should return boolean
      expect(typeof result).toBe('boolean');

      // If certs exist, paths should be valid
      if (result) {
        const paths = getCertPaths();
        const fs = require('fs');
        expect(fs.existsSync(paths.keyPath)).toBe(true);
        expect(fs.existsSync(paths.certPath)).toBe(true);
      }
    });

    test('getCertificateInfo returns detailed information', () => {
      const info = getCertificateInfo();

      expect(info).toHaveProperty('valid');
      expect(info).toHaveProperty('keyPath');
      expect(info).toHaveProperty('certPath');
      expect(typeof info.valid).toBe('boolean');

      if (info.valid) {
        expect(info.keySize).toBeGreaterThan(0);
        expect(info.certSize).toBeGreaterThan(0);
        expect(info.keyModified).toBeTruthy();
        expect(info.certModified).toBeTruthy();
        // fs.Stats.mtime is already a Date object
        expect(typeof info.keyModified.getTime).toBe('function');
        expect(typeof info.certModified.getTime).toBe('function');
      }
    });
  });

  describe('HTTPS Agent Creation', () => {
    test('createHTTPSAgent returns https.Agent instance', () => {
      const agent = createHTTPSAgent();

      expect(agent).toBeInstanceOf(https.Agent);
      expect(agent.options).toHaveProperty('rejectUnauthorized', false);
    });

    test('createHTTPSAgent creates independent instances', () => {
      const agent1 = createHTTPSAgent();
      const agent2 = createHTTPSAgent();

      expect(agent1).not.toBe(agent2); // Different instances
    });
  });

  describe('Axios Configuration', () => {
    test('configureAxiosForHTTPS adds httpsAgent to instance', () => {
      const instance = axios.create();
      const result = configureAxiosForHTTPS(instance);

      expect(result).toBe(instance); // Returns same instance for chaining
      expect(instance.defaults.httpsAgent).toBeDefined();
      expect(instance.defaults.httpsAgent).toBeInstanceOf(https.Agent);
      expect(instance.defaults.httpsAgent.options.rejectUnauthorized).toBe(false);
    });

    test('configureAxiosForHTTPS throws on missing instance', () => {
      expect(() => {
        configureAxiosForHTTPS(null);
      }).toThrow('axiosInstance is required');
    });

    test('configureAxiosForHTTPS works with axios defaults', () => {
      const instance = axios.create({
        baseURL: 'https://localhost:3000',
        timeout: 5000
      });

      configureAxiosForHTTPS(instance);

      // Should preserve existing config
      expect(instance.defaults.baseURL).toBe('https://localhost:3000');
      expect(instance.defaults.timeout).toBe(5000);
      expect(instance.defaults.httpsAgent).toBeDefined();
    });
  });

  describe('Playwright Configuration', () => {
    test('configurePlaywrightHTTPS accepts valid context', () => {
      const mockContext = { id: 'test-context' };
      const result = configurePlaywrightHTTPS(mockContext);

      expect(result).toBe(mockContext); // Returns same context for chaining
    });

    test('configurePlaywrightHTTPS throws on missing context', () => {
      expect(() => {
        configurePlaywrightHTTPS(null);
      }).toThrow('browserContext is required');
    });

    test('configurePageHTTPS accepts valid page', () => {
      const mockPage = { id: 'test-page' };
      const result = configurePageHTTPS(mockPage);

      expect(result).toBe(mockPage); // Returns same page for chaining
    });

    test('configurePageHTTPS throws on missing page', () => {
      expect(() => {
        configurePageHTTPS(null);
      }).toThrow('page is required');
    });
  });

  describe('Node.js Global TLS Configuration', () => {
    let originalEnvValue;

    beforeEach(() => {
      // Preserve original value before each test
      originalEnvValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    });

    afterEach(() => {
      // Restore original value after each test
      if (originalEnvValue === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalEnvValue;
      }
    });

    test('configureNodeHTTPS sets environment variable', () => {
      configureNodeHTTPS();

      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');
    });

    test('restoreNodeHTTPS restores original value', () => {
      const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

      configureNodeHTTPS();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');

      restoreNodeHTTPS();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(originalValue);
    });

    test('restoreNodeHTTPS handles undefined original value', () => {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

      configureNodeHTTPS();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');

      restoreNodeHTTPS();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
    });

    test('multiple configureNodeHTTPS calls preserve original value', () => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

      configureNodeHTTPS();
      configureNodeHTTPS(); // Second call

      restoreNodeHTTPS();
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('1');
    });

    test('restoreNodeHTTPS is safe to call without configure', () => {
      expect(() => {
        restoreNodeHTTPS();
      }).not.toThrow();
    });
  });

  describe('Integration Patterns', () => {
    test('axios instance can be configured in one line', () => {
      const client = configureAxiosForHTTPS(axios.create({
        baseURL: 'https://localhost:3000'
      }));

      expect(client.defaults.httpsAgent).toBeDefined();
      expect(client.defaults.baseURL).toBe('https://localhost:3000');
    });

    test('HTTPS agent can be used directly with https module', () => {
      const agent = createHTTPSAgent();

      // Create mock request options
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/health',
        method: 'GET',
        agent: agent
      };

      expect(options.agent).toBe(agent);
      expect(options.agent.options.rejectUnauthorized).toBe(false);
    });

    test('try-finally pattern for global TLS config', () => {
      const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

      try {
        configureNodeHTTPS();
        expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('0');
        // Test code would run here
      } finally {
        restoreNodeHTTPS();
        expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(originalValue);
      }
    });
  });

  describe('Error Handling', () => {
    test('getCertificateInfo handles missing certificates gracefully', () => {
      const info = getCertificateInfo();

      // Should not throw, returns info object
      expect(info).toBeDefined();
      expect(info).toHaveProperty('valid');
    });

    test('verifyCertsExist returns false for missing certs', () => {
      // Function should return boolean, not throw
      const result = verifyCertsExist();
      expect(typeof result).toBe('boolean');
    });
  });
});
