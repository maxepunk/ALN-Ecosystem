/**
 * SSL Certificate Helper for E2E Tests
 *
 * SECURITY WARNING: This module disables SSL certificate validation for testing purposes.
 *
 * ⚠️  TEST-ONLY UTILITIES ⚠️
 * These functions bypass SSL certificate validation to support testing against
 * self-signed certificates used in local development. NEVER use these in production.
 *
 * Context:
 * The ALN Orchestrator runs with HTTPS (self-signed certificates) to support
 * Web NFC API in GM Scanner. E2E tests need to accept these certificates.
 *
 * Usage Examples:
 *
 * 1. Playwright Browser Context:
 * ```javascript
 * const context = await browser.newContext();
 * configurePlaywrightHTTPS(context); // Not needed if using playwright.config.js
 * ```
 *
 * 2. Axios HTTP Client:
 * ```javascript
 * const axios = require('axios');
 * const client = axios.create();
 * configureAxiosForHTTPS(client);
 * await client.get('https://localhost:3000/health');
 * ```
 *
 * 3. Node.js Built-in HTTPS:
 * ```javascript
 * const https = require('https');
 * const agent = createHTTPSAgent();
 * https.get('https://localhost:3000/health', { agent }, callback);
 * ```
 *
 * @module tests/e2e/setup/ssl-cert-helper
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const logger = require('../../../src/utils/logger');

// Store original TLS settings for restoration
let originalTLSRejectUnauthorized = null;

/**
 * Get paths to SSL certificate files
 *
 * Returns absolute paths to SSL key and certificate files used by the orchestrator.
 * Paths are resolved from backend root directory.
 *
 * @returns {Object} Certificate paths
 * @returns {string} return.keyPath - Absolute path to SSL private key
 * @returns {string} return.certPath - Absolute path to SSL certificate
 *
 * @example
 * const { keyPath, certPath } = getCertPaths();
 * console.log(`Key: ${keyPath}, Cert: ${certPath}`);
 */
function getCertPaths() {
  const backendRoot = path.join(__dirname, '../../../');

  return {
    keyPath: path.join(backendRoot, 'ssl', 'key.pem'),
    certPath: path.join(backendRoot, 'ssl', 'cert.pem')
  };
}

/**
 * Verify SSL certificate files exist
 *
 * Checks if both SSL key and certificate files exist on disk.
 * Used to validate test environment setup before running HTTPS tests.
 *
 * @returns {boolean} True if both files exist, false otherwise
 *
 * @example
 * if (!verifyCertsExist()) {
 *   throw new Error('SSL certificates not found - run setup script');
 * }
 */
function verifyCertsExist() {
  const { keyPath, certPath } = getCertPaths();

  try {
    const keyExists = fs.existsSync(keyPath);
    const certExists = fs.existsSync(certPath);

    if (!keyExists || !certExists) {
      logger.warn('SSL certificate files missing', {
        keyExists,
        certExists,
        keyPath,
        certPath
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking SSL certificates', { error: error.message });
    return false;
  }
}

/**
 * Create HTTPS agent for Node.js requests
 *
 * ⚠️  SECURITY WARNING: Disables certificate validation
 * Creates an HTTPS agent that accepts self-signed certificates.
 * Used with Node.js built-in https module or axios.
 *
 * UNSAFE FOR PRODUCTION - Test environments only
 *
 * @returns {https.Agent} HTTPS agent with disabled certificate validation
 *
 * @example
 * const https = require('https');
 * const agent = createHTTPSAgent();
 *
 * https.get('https://localhost:3000/health', { agent }, (res) => {
 *   console.log('Status:', res.statusCode);
 * });
 */
function createHTTPSAgent() {
  return new https.Agent({
    rejectUnauthorized: false // UNSAFE: Accept self-signed certificates
  });
}

/**
 * Configure Axios instance to accept self-signed certificates
 *
 * ⚠️  SECURITY WARNING: Disables certificate validation
 * Adds HTTPS agent to axios instance to bypass SSL verification.
 *
 * UNSAFE FOR PRODUCTION - Test environments only
 *
 * @param {Object} axiosInstance - Axios instance to configure
 * @returns {Object} The same axios instance (for chaining)
 *
 * @example
 * const axios = require('axios');
 * const client = axios.create({ baseURL: 'https://localhost:3000' });
 * configureAxiosForHTTPS(client);
 *
 * // Now client accepts self-signed certs
 * await client.get('/health');
 */
function configureAxiosForHTTPS(axiosInstance) {
  if (!axiosInstance) {
    throw new Error('axiosInstance is required');
  }

  // Add HTTPS agent to axios defaults
  axiosInstance.defaults.httpsAgent = createHTTPSAgent();

  logger.debug('Axios configured to accept self-signed SSL certificates');

  return axiosInstance;
}

/**
 * Configure Playwright browser context to accept self-signed certificates
 *
 * NOTE: This is typically handled in playwright.config.js via `ignoreHTTPSErrors: true`
 * This function is provided for programmatic configuration if needed.
 *
 * ⚠️  SECURITY WARNING: Disables certificate validation
 * UNSAFE FOR PRODUCTION - Test environments only
 *
 * @param {Object} browserContext - Playwright browser context
 * @returns {Object} The same browser context (for chaining)
 *
 * @example
 * const { chromium } = require('@playwright/test');
 * const browser = await chromium.launch();
 * const context = await browser.newContext();
 * configurePlaywrightHTTPS(context);
 *
 * const page = await context.newPage();
 * await page.goto('https://localhost:3000'); // Accepts self-signed cert
 */
function configurePlaywrightHTTPS(browserContext) {
  if (!browserContext) {
    throw new Error('browserContext is required');
  }

  // NOTE: Playwright's ignoreHTTPSErrors is set at context creation time
  // This function is mostly for documentation - the actual config is in playwright.config.js

  logger.debug('Playwright context should have ignoreHTTPSErrors enabled in config');
  logger.debug('This is configured in playwright.config.js, not programmatically');

  return browserContext;
}

/**
 * Configure Playwright page to handle HTTPS errors (if needed)
 *
 * NOTE: Typically not needed as ignoreHTTPSErrors is set at context level.
 * Provided for completeness and edge cases.
 *
 * @param {Object} page - Playwright page object
 * @returns {Object} The same page (for chaining)
 *
 * @example
 * const page = await context.newPage();
 * configurePageHTTPS(page);
 * await page.goto('https://localhost:3000');
 */
function configurePageHTTPS(page) {
  if (!page) {
    throw new Error('page is required');
  }

  // Playwright handles HTTPS errors at context level (ignoreHTTPSErrors)
  // Page-level configuration is typically not needed

  logger.debug('Page HTTPS handling is managed at browser context level');

  return page;
}

/**
 * Configure Node.js to globally ignore SSL certificate errors
 *
 * ⚠️  EXTREME SECURITY WARNING ⚠️
 * Sets NODE_TLS_REJECT_UNAUTHORIZED=0 which affects ALL HTTPS requests
 * in the entire Node.js process.
 *
 * DANGEROUS - Use createHTTPSAgent() for individual requests instead
 * Only use this for specific test scenarios where you control all network calls
 *
 * NEVER USE IN PRODUCTION
 *
 * Call restoreNodeHTTPS() when done to restore original settings
 *
 * @example
 * // Start of test
 * configureNodeHTTPS();
 *
 * // ... run tests with HTTPS ...
 *
 * // End of test - ALWAYS restore
 * restoreNodeHTTPS();
 */
function configureNodeHTTPS() {
  // Store original value if not already stored
  if (originalTLSRejectUnauthorized === null) {
    originalTLSRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }

  // Disable TLS certificate verification globally
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  logger.warn('⚠️  NODE_TLS_REJECT_UNAUTHORIZED set to 0 - ALL SSL verification disabled');
  logger.warn('⚠️  Remember to call restoreNodeHTTPS() when tests complete');
}

/**
 * Restore Node.js TLS certificate validation to original state
 *
 * Reverses the effects of configureNodeHTTPS() by restoring the original
 * NODE_TLS_REJECT_UNAUTHORIZED environment variable value.
 *
 * ALWAYS call this after using configureNodeHTTPS()
 *
 * @example
 * try {
 *   configureNodeHTTPS();
 *   await runHTTPSTests();
 * } finally {
 *   restoreNodeHTTPS(); // Ensure cleanup even on test failure
 * }
 */
function restoreNodeHTTPS() {
  if (originalTLSRejectUnauthorized !== null) {
    if (originalTLSRejectUnauthorized === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLSRejectUnauthorized;
    }

    originalTLSRejectUnauthorized = null;

    logger.info('TLS certificate validation restored to original settings');
  }
}

/**
 * Get certificate information (for debugging)
 *
 * Returns detailed information about the SSL certificates including
 * file existence, size, and modification time.
 *
 * Useful for debugging SSL setup issues in tests.
 *
 * @returns {Object} Certificate information
 *
 * @example
 * const certInfo = getCertificateInfo();
 * console.log(`Cert valid: ${certInfo.valid}`);
 * console.log(`Key size: ${certInfo.keySize} bytes`);
 */
function getCertificateInfo() {
  const { keyPath, certPath } = getCertPaths();

  try {
    const keyStats = fs.existsSync(keyPath) ? fs.statSync(keyPath) : null;
    const certStats = fs.existsSync(certPath) ? fs.statSync(certPath) : null;

    return {
      valid: keyStats !== null && certStats !== null,
      keyPath,
      certPath,
      keySize: keyStats ? keyStats.size : null,
      certSize: certStats ? certStats.size : null,
      keyModified: keyStats ? keyStats.mtime : null,
      certModified: certStats ? certStats.mtime : null
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      keyPath,
      certPath
    };
  }
}

module.exports = {
  // Certificate management
  getCertPaths,
  verifyCertsExist,
  getCertificateInfo,

  // HTTPS configuration
  createHTTPSAgent,
  configureAxiosForHTTPS,
  configurePlaywrightHTTPS,
  configurePageHTTPS,

  // Global Node.js TLS configuration (use with extreme caution)
  configureNodeHTTPS,
  restoreNodeHTTPS
};
