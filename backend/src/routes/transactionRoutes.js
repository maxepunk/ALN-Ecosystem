/**
 * Transaction Routes
 * Handles transaction-related endpoints
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const sessionService = require('../services/sessionService');
const transactionService = require('../services/transactionService');
const { validateTransaction } = require('../utils/validators');

/**
 * POST /api/transaction/submit
 * Submit a scoring transaction
 */
router.post('/submit', async (req, res) => {
  try {
    const session = sessionService.getCurrentSession();
    if (!session) {
      return res.status(400).json({
        status: 'error',
        error: 'No active session'
      });
    }

    const { tokenId, teamId, points, gmStation } = req.body;

    // Validate required fields
    if (!tokenId || !teamId || points === undefined) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required fields: tokenId, teamId, points'
      });
    }

    // Check for duplicate transaction
    const isDuplicate = session.transactions?.some(t => 
      t.tokenId === tokenId && 
      t.teamId === teamId &&
      t.status !== 'rejected'
    );

    if (isDuplicate) {
      return res.status(409).json({
        status: 'error',
        error: 'Duplicate transaction'
      });
    }

    // Process transaction
    const transaction = await transactionService.processTransaction({
      tokenId,
      teamId,
      points: parseInt(points),
      gmStation: gmStation || 'API',
      timestamp: new Date().toISOString()
    });

    // Add to session
    await sessionService.addTransaction(transaction);

    res.status(202).json({
      status: 'success',
      data: {
        transactionId: transaction.id,
        status: 'accepted',
        points: transaction.points
      }
    });

    logger.info('Transaction submitted', { 
      transactionId: transaction.id,
      tokenId,
      teamId,
      points 
    });

  } catch (error) {
    logger.error('Transaction submission error', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/transaction/history
 * Get transaction history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 100, offset = 0, sessionId, teamId, tokenId } = req.query;
    
    // Get transactions from session
    const session = sessionId ? 
      await sessionService.getSession(sessionId) : 
      sessionService.getCurrentSession();

    if (!session) {
      return res.status(404).json({
        status: 'error',
        error: 'Session not found'
      });
    }

    let transactions = session.transactions || [];

    // Apply filters
    if (teamId) {
      transactions = transactions.filter(t => t.teamId === teamId);
    }
    if (tokenId) {
      transactions = transactions.filter(t => t.tokenId === tokenId);
    }

    // Apply pagination
    const total = transactions.length;
    const paginatedTransactions = transactions.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    res.json({
      status: 'success',
      data: {
        transactions: paginatedTransactions,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Transaction history error', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/transaction/:id
 * Get specific transaction
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = sessionService.getCurrentSession();

    if (!session) {
      return res.status(400).json({
        status: 'error',
        error: 'No active session'
      });
    }

    const transaction = session.transactions?.find(t => t.id === id);

    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        error: 'Transaction not found'
      });
    }

    res.json({
      status: 'success',
      data: transaction
    });

  } catch (error) {
    logger.error('Get transaction error', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/transaction/:id
 * Cancel/delete a transaction (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check admin auth
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== require('../config').adminToken) {
      return res.status(401).json({
        status: 'error',
        error: 'Unauthorized'
      });
    }

    const { id } = req.params;
    const session = sessionService.getCurrentSession();

    if (!session) {
      return res.status(400).json({
        status: 'error',
        error: 'No active session'
      });
    }

    const transactionIndex = session.transactions?.findIndex(t => t.id === id);

    if (transactionIndex === -1) {
      return res.status(404).json({
        status: 'error',
        error: 'Transaction not found'
      });
    }

    // Remove transaction
    const removed = session.transactions.splice(transactionIndex, 1)[0];
    await sessionService.updateSession(session);

    res.json({
      status: 'success',
      data: {
        message: 'Transaction deleted',
        transaction: removed
      }
    });

    logger.info('Transaction deleted', { transactionId: id });

  } catch (error) {
    logger.error('Delete transaction error', { error });
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;