/**
 * JWT Authentication Middleware
 * Handles authentication and authorization for protected endpoints
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

// Store admin tokens (in production, use Redis or database)
const adminTokens = new Set();
const tokenExpiry = new Map();

// INDEPENDENT observe-token store (B0 BS.1 slice 5, red-team S1/S8):
// display-class tokens NEVER enter adminTokens — every HTTP gate
// refuses them via set membership — and flushing this store never
// touches a live GM session.
const observeTokens = new Map(); // token → expiry ms

/**
 * Generate an OPERATOR-tier JWT (one-auth §1 full claim shape — B0
 * BS.1). Grants are computed AT ISSUANCE via the pure gameRules
 * algebra; packHash records which active pack the grants were computed
 * against (stale-grant detection after a pack switch). Back-compat
 * fields (id/role/timestamp) stay for existing consumers.
 * @param {string} adminId
 * @param {{aud?: string}} [opts] audience — 'orchestrator' (default) or 'config-tool'
 */
function generateAdminToken(adminId = 'admin', { aud = 'orchestrator' } = {}) {
  const grants = require('../gameRules/grants');
  let packHash = null;
  try {
    const info = require('../services/packService').getActivePackInfo();
    packHash = info ? info.contentHash : null;
  } catch { /* packless/boot-order: grants still mint; hash stays null */ }
  const token = jwt.sign(
    {
      id: adminId,
      role: 'admin',
      timestamp: Date.now(),
      tier: 'operator',
      'class': 'staffed',
      deviceId: adminId,
      functions: grants.computeGrants({ tier: 'operator', deviceClass: 'staffed' }),
      packHash,
    },
    config.security.jwtSecret || 'test-jwt-secret',
    {
      expiresIn: config.security.jwtExpiry || '24h',
      audience: aud,
    }
  );

  // Store token
  adminTokens.add(token);
  
  // Set expiry tracking
  const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  tokenExpiry.set(token, expiryTime);
  
  // Clean up expired tokens periodically
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Verify JWT token. When opts.audience is given, jwt.verify enforces
 * the aud claim (red-team S4 — without the option, aud is decorative).
 * @param {string} token
 * @param {{audience?: string}} [opts]
 */
function verifyToken(token, { audience } = {}) {
  try {
    // Check if token is in our valid set
    if (!adminTokens.has(token)) {
      return null;
    }

    // Check expiry
    const expiry = tokenExpiry.get(token);
    if (expiry && Date.now() > expiry) {
      adminTokens.delete(token);
      tokenExpiry.delete(token);
      return null;
    }

    // Verify JWT signature (and audience when required)
    const decoded = jwt.verify(
      token,
      config.security.jwtSecret || 'test-jwt-secret',
      audience ? { audience } : {}
    );

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      adminTokens.delete(token);
      tokenExpiry.delete(token);
    }
    return null;
  }
}

/**
 * Mint a device-tier, display-class OBSERVE token (one-auth §3 —
 * the scoreboard row; B0 BS.1 slice 5). Minted per page serve; NEVER
 * role admin, never stored beside operator tokens. Read-only by
 * grant: functions = exactly ['observe'].
 * @param {string} deviceId
 */
function generateObserveToken(deviceId = 'SCOREBOARD') {
  const grants = require('../gameRules/grants');
  let packHash = null;
  try {
    const info = require('../services/packService').getActivePackInfo();
    packHash = info ? info.contentHash : null;
  } catch { /* packless: hash stays null */ }
  const token = jwt.sign(
    {
      tier: 'device',
      'class': 'display',
      deviceId,
      functions: grants.computeGrants({ tier: 'device', deviceClass: 'display' }),
      packHash,
    },
    config.security.jwtSecret || 'test-jwt-secret',
    {
      expiresIn: config.security.jwtExpiry || '24h',
      audience: 'orchestrator',
    }
  );
  observeTokens.set(token, Date.now() + (24 * 60 * 60 * 1000));
  return token;
}

/**
 * Verify an OBSERVE token: its own store, signature+audience, and the
 * device/display identity asserted — an operator token never passes
 * here (the stores never cross).
 * @param {string} token
 * @returns {Object|null} claims or null
 */
function verifyObserveToken(token) {
  try {
    const expiry = observeTokens.get(token);
    if (expiry === undefined) return null;
    if (Date.now() > expiry) {
      observeTokens.delete(token);
      return null;
    }
    const decoded = jwt.verify(
      token,
      config.security.jwtSecret || 'test-jwt-secret',
      { audience: 'orchestrator' }
    );
    if (decoded.tier !== 'device' || decoded['class'] !== 'display') return null;
    return decoded;
  } catch {
    observeTokens.delete(token);
    return null;
  }
}

/**
 * Flush every observe token (S8 rotation: kills display sessions only —
 * GM sessions live in the separate admin store).
 */
function invalidateObserveTokens() {
  observeTokens.clear();
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, expiry] of tokenExpiry.entries()) {
    if (now > expiry) {
      adminTokens.delete(token);
      tokenExpiry.delete(token);
    }
  }
}

/**
 * Shared authentication body (B0 BS.1): Bearer extraction, verified
 * decode WITH audience, tier assertion, optional function assertion.
 * FAIL-CLOSED throughout — a legacy-shape token (no tier/functions)
 * never passes (red-team S1: decode alone is not authorization; the
 * in-memory store empties on restart, so no live compat window exists).
 * @private
 */
function _authenticate(req, res, next, { audience, requiredTier, requiredFunction }) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authorization required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token, { audience });

    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }

    if (requiredTier && decoded.tier !== requiredTier) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `This action requires the ${requiredTier} tier`,
      });
    }

    if (requiredFunction &&
        !(Array.isArray(decoded.functions) && decoded.functions.includes(requiredFunction))) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `This action requires the '${requiredFunction}' function`,
      });
    }

    req.admin = decoded;

    logger.info('Admin action', {
      adminId: decoded.id,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication error',
    });
  }
}

/**
 * Middleware factory: require a specific granted FUNCTION (and the
 * matching audience). The one-auth enforcement primitive — routes name
 * the function they need, never a role.
 * @param {string} fn - required function id (e.g. 'session-lifecycle')
 * @param {{audience?: string, tier?: string}} [opts]
 */
function requireFunction(fn, { audience = 'orchestrator', tier } = {}) {
  return (req, res, next) =>
    _authenticate(req, res, next, { audience, requiredTier: tier, requiredFunction: fn });
}

/**
 * Middleware to require operator-tier authentication (absorbed into the
 * shared body — decode alone no longer passes; the operator tier is
 * asserted, so a device/display token in the store still fails).
 */
function requireAdmin(req, res, next) {
  return _authenticate(req, res, next, { audience: 'orchestrator', requiredTier: 'operator' });
}

/**
 * Middleware for optional admin authentication
 * Allows access but provides admin context if authenticated
 */
function optionalAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded) {
        req.admin = decoded;
      }
    }
    
    next();
  } catch (error) {
    // Continue without admin context
    next();
  }
}

/**
 * Middleware to check if request is from admin
 */
function isAdmin(req) {
  return req.admin && req.admin.role === 'admin';
}

/**
 * Invalidate a token (for logout)
 */
function invalidateToken(token) {
  adminTokens.delete(token);
  tokenExpiry.delete(token);
}

/**
 * Check if a token is valid
 */
function isValidToken(token) {
  return adminTokens.has(token) && verifyToken(token) !== null;
}

// Clean up expired tokens every hour
let tokenCleanupInterval = null;
if (process.env.NODE_ENV !== 'test') {
  tokenCleanupInterval = setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
}

// Cleanup function for tests
function stopTokenCleanup() {
  if (tokenCleanupInterval) {
    clearInterval(tokenCleanupInterval);
    tokenCleanupInterval = null;
  }
}

module.exports = {
  generateAdminToken,
  generateObserveToken,
  verifyToken,
  verifyObserveToken,
  invalidateObserveTokens,
  requireAdmin,
  requireFunction,
  optionalAdmin,
  isAdmin,
  invalidateToken,
  isValidToken,
  stopTokenCleanup
};