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

/**
 * Generate JWT token for admin authentication
 */
function generateAdminToken(adminId = 'admin') {
  const token = jwt.sign(
    {
      id: adminId,
      role: 'admin',
      timestamp: Date.now(),
    },
    config.security.jwtSecret || 'test-jwt-secret',
    {
      expiresIn: config.security.jwtExpiry || '24h',
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
 * Verify JWT token
 */
function verifyToken(token) {
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
    
    // Verify JWT signature
    const decoded = jwt.verify(
      token,
      config.security.jwtSecret || 'test-jwt-secret'
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
 * Middleware to require admin authentication
 */
function requireAdmin(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Authorization required',
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Invalid or expired token',
      });
    }
    
    // Attach admin info to request
    req.admin = decoded;
    
    // Log admin action
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
  verifyToken,
  requireAdmin,
  optionalAdmin,
  isAdmin,
  invalidateToken,
  isValidToken,
  stopTokenCleanup
};