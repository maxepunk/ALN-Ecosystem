/**
 * WebSocket Broadcast Handler
 * Manages event broadcasting to connected clients
 */

const logger = require('../utils/logger');
const listenerRegistry = require('./listenerRegistry');

/**
 * Helper function to add and track event listeners
 * @param {EventEmitter} service - Service instance
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 */
function addTrackedListener(service, event, handler) {
  const serviceName = service.constructor.name;
  service.on(event, handler);
  listenerRegistry.trackListener(service, event, handler);
  logger.debug('Added tracked listener', {
    service: serviceName,
    event,
    totalListeners: service.listenerCount(event)
  });
}

/**
 * Setup service event listeners for broadcasting
 * @param {Server} io - Socket.io server instance
 * @param {Object} services - Service instances
 */
function setupBroadcastListeners(io, services) {
  const { sessionService, stateService, videoQueueService } = services;

  // Session events
  addTrackedListener(sessionService, 'session:created', (session) => {
    io.emit('session:new', {
      sessionId: session.id,
      name: session.name,
    });
    logger.info('Broadcasted session:new', { sessionId: session.id });
  });

  addTrackedListener(sessionService, 'session:updated', (session) => {
    io.emit('session:update', {
      sessionId: session.id,
      status: session.status,
    });
    logger.info('Broadcasted session:update', { sessionId: session.id });
  });

  addTrackedListener(sessionService, 'transaction:added', (transaction) => {
    // Contract-compliant transaction event
    const eventData = {
      event: 'transaction:new',
      data: {
        id: transaction.id,
        tokenId: transaction.tokenId,
        teamId: transaction.teamId,
        scannerId: transaction.scannerId,
        status: transaction.status,
        points: transaction.points,
        timestamp: transaction.timestamp
      },
      timestamp: new Date().toISOString(),
    };

    // Per contract: broadcast to session room only
    const session = sessionService.getCurrentSession();
    if (session) {
      io.to(`session:${session.id}`).emit('transaction:new', eventData);
      logger.info('Broadcasted transaction:new to session', {
        transactionId: transaction.id,
        sessionId: session.id
      });
    } else {
      // Fallback: if no session, broadcast to all (shouldn't happen)
      io.emit('transaction:new', eventData);
      logger.warn('Broadcasted transaction:new globally - no session found');
    }
  });

  // State events (contract-compliant)
  addTrackedListener(stateService, 'state:updated', (delta) => {
    logger.debug('Received state:updated event for broadcast', {
      deltaKeys: Object.keys(delta),
      deltaPreview: JSON.stringify(delta).substring(0, 200)
    });

    // CRITICAL: Only broadcast to GM stations, not all clients
    const gmRoom = io.sockets.adapter.rooms.get('gm-stations');
    const gmCount = gmRoom ? gmRoom.size : 0;

    io.to('gm-stations').emit('state:update', {
      event: 'state:update',
      data: delta,
      timestamp: new Date().toISOString()
    });

    logger.debug('Broadcasted state:update to GM stations', {
      deltaKeys: Object.keys(delta),
      gmStationCount: gmCount
    });
  });

  addTrackedListener(stateService, 'state:sync', (state) => {
    io.emit('state:sync', state);
    logger.info('Broadcasted state:sync');
  });

  // Full sync event (contract compliant)
  addTrackedListener(stateService, 'sync:full', (fullState) => {
    io.emit('sync:full', fullState);
    logger.info('Broadcasted sync:full', { 
      hasSession: !!fullState.session,
      hasState: !!fullState.state,
      hasQueue: !!fullState.queue 
    });
  });

  // Video events (contract-compliant)
  addTrackedListener(videoQueueService, 'video:loading', (data) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'loading',
        tokenId: data.tokenId
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:loading to GM stations', { tokenId: data.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:started', (data) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'playing',
        tokenId: data.queueItem.tokenId,
        duration: data.duration,
        expectedEndTime: data.expectedEndTime,
        progress: 0
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:started to GM stations', { tokenId: data.queueItem.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:completed', (queueItem) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'completed',
        tokenId: queueItem.tokenId,
        progress: 100
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:completed to GM stations', { tokenId: queueItem.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:failed', (queueItem) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'error',
        tokenId: queueItem.tokenId,
        error: queueItem.error
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.error('Broadcasted video:failed to GM stations', { tokenId: queueItem.tokenId, error: queueItem.error });
  });

  addTrackedListener(videoQueueService, 'video:paused', (queueItem) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'paused',
        tokenId: queueItem?.tokenId || null,
        progress: queueItem?.progress || 0
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:paused to GM stations', { tokenId: queueItem?.tokenId });
  });

  addTrackedListener(videoQueueService, 'video:idle', () => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'idle',
        tokenId: null,
        progress: 0
      },
      timestamp: new Date().toISOString(),
    };

    // Video status only goes to GM stations
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:idle to GM stations');
  });

  // Handle video resumed event
  addTrackedListener(videoQueueService, 'video:resumed', (queueItem) => {
    const videoStatus = {
      event: 'video:status',
      data: {
        status: 'playing', // Resume returns to playing state
        tokenId: queueItem?.tokenId || null,
        progress: queueItem?.progress || 0
      },
      timestamp: new Date().toISOString(),
    };
    
    io.to('gm-stations').emit('video:status', videoStatus);
    logger.info('Broadcasted video:resumed as playing to GM stations');
  });

  // Error events
  const handleServiceError = (service, error) => {
    io.emit('error', {
      service,
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    logger.error(`Service error broadcasted`, { service, error: error.message });
  };

  addTrackedListener(sessionService, 'error', (error) => handleServiceError('session', error));
  addTrackedListener(stateService, 'error', (error) => handleServiceError('state', error));
  addTrackedListener(videoQueueService, 'error', (error) => handleServiceError('video', error));

  logger.info('Broadcast listeners initialized');
}

/**
 * Clean up all broadcast listeners
 * CRITICAL: Call this between tests to prevent listener accumulation
 */
function cleanupBroadcastListeners() {
  logger.info('Starting broadcast listener cleanup');
  listenerRegistry.cleanup();
  logger.info('Broadcast listener cleanup completed');
}

/**
 * Broadcast to specific room
 * @param {Server} io - Socket.io server instance
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToRoom(io, room, event, data) {
  io.to(room).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.debug(`Broadcasted ${event} to room ${room}`);
}

/**
 * Broadcast to GM stations only
 * @param {Server} io - Socket.io server instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToGmStations(io, event, data) {
  broadcastToRoom(io, 'gm-stations', event, data);
}

/**
 * Broadcast to players only
 * @param {Server} io - Socket.io server instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToPlayers(io, event, data) {
  broadcastToRoom(io, 'players', event, data);
}

module.exports = {
  setupBroadcastListeners,
  cleanupBroadcastListeners,
  broadcastToRoom,
  broadcastToGmStations,
  broadcastToPlayers,
};