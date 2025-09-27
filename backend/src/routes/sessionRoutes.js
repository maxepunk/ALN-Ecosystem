/**
 * Session Routes
 * Handles session management endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { sessionCreateSchema, sessionUpdateSchema, validate, ValidationError } = require('../utils/validators');
const sessionService = require('../services/sessionService');
const stateService = require('../services/stateService');
const authMiddleware = require('../middleware/auth');

/**
 * GET /api/session
 * Get current active session
 */
router.get('/', async (req, res) => {
  try {
    const session = sessionService.getCurrentSession();

    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No active session',
      });
    }
    
    res.json(session.toAPIResponse());
  } catch (error) {
    logger.error('Get current session error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/session/:id
 * Get specific session by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found',
      });
    }
    
    res.json(session.toAPIResponse());
  } catch (error) {
    logger.error('Get session endpoint error', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
});

/**
 * POST /api/session
 * Create new session (requires auth)
 */
router.post('/', async (req, res) => {
  // Always require authentication for POST /api/session
  const authHeader = req.headers.authorization;

  // Verify the token is present
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'auth required',
    });
  }

  const token = authHeader.substring(7);
  const decoded = authMiddleware.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Invalid or expired token',
    });
  }

  req.admin = decoded;
  
  try {
    const sessionData = validate(req.body, sessionCreateSchema);
    
    const session = await sessionService.createSession(sessionData);
    
    // Sync state with new session
    await stateService.syncFromSession(session);

    // Add Location header for new resource
    res.location(`/api/session/${session.id}`);
    res.status(201).json(session.toAPIResponse());
  } catch (error) {
    if (error instanceof ValidationError) {
      // Include field names in message for better test compatibility
      const fieldMessages = error.details?.map(d => d.field).filter(f => f);
      const message = fieldMessages?.length > 0 
        ? `Validation failed: ${fieldMessages.join(', ')}` 
        : error.message;
      
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: message,
        details: error.details,
      });
    } else {
      logger.error('Create session endpoint error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  }
});

/**
 * PUT /api/session
 * Update current session (requires auth)
 */
router.put('/', async (req, res) => {
  // Always require authentication for PUT /api/session
  const authHeader = req.headers.authorization;

  // Verify the token is present
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'auth required',
    });
  }

  const token = authHeader.substring(7);
  const decoded = authMiddleware.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Invalid or expired token',
    });
  }

  req.admin = decoded;

  try {
    const updates = validate(req.body, sessionUpdateSchema);

    const session = sessionService.getCurrentSession();
    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No active session',
      });
    }

    const updated = await sessionService.updateSession(updates);

    // Sync state if status changed
    if (updates.status) {
      await stateService.syncFromSession(updated);
    }

    res.json(updated.toAPIResponse());
  } catch (error) {
    if (error instanceof ValidationError) {
      // Include field names in message for better test compatibility
      const fieldMessages = error.details?.map(d => d.field).filter(f => f);
      let message = fieldMessages?.length > 0
        ? `Validation failed: ${fieldMessages.join(', ')}`
        : error.message;

      // Special case for empty object to mention required fields
      if (message.includes('must have at least 1 key')) {
        message = 'Request must include status or name field';
      }

      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: message,
        details: error.details,
      });
    } else {
      logger.error('Update session endpoint error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  }
});

/**
 * PUT /api/session/:id
 * Update specific session by ID (requires auth)
 */
router.put('/:id', async (req, res) => {
  // Always require authentication for PUT /api/session/:id
  const authHeader = req.headers.authorization;

  // Verify the token is present
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'auth required',
    });
  }

  const token = authHeader.substring(7);
  const decoded = authMiddleware.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Invalid or expired token',
    });
  }

  req.admin = decoded;
  
  try {
    const updates = validate(req.body, sessionUpdateSchema);
    
    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Session not found',
      });
    }
    
    const updated = await sessionService.updateSession(updates);
    
    // Sync state if status changed
    if (updates.status) {
      await stateService.syncFromSession(updated);
    }
    
    res.json(updated.toAPIResponse());
  } catch (error) {
    if (error instanceof ValidationError) {
      // Include field names in message for better test compatibility
      const fieldMessages = error.details?.map(d => d.field).filter(f => f);
      const message = fieldMessages?.length > 0 
        ? `Validation failed: ${fieldMessages.join(', ')}` 
        : error.message;
      
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: message,
        details: error.details,
      });
    } else {
      logger.error('Update session endpoint error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      });
    }
  }
});

module.exports = router;